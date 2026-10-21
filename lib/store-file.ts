/**
 * JSON file implementation of the persistence layer — LOCAL DEV ONLY.
 * Production runs the Postgres implementation in lib/store-pg.ts
 * (selected by lib/store.ts whenever DATABASE_URL is set; on Vercel a
 * missing DATABASE_URL throws rather than falling back to this file,
 * because a serverless instance's disk is ephemeral and shared with no
 * one — the original production bug). Path: $DATA_DIR/store.json
 * (default ./data/store.json). Never stores the uploaded file — only
 * aggregates, findings, report text, email, orders.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  EMPTY_RETENTION_STATS,
  RETENTION_MS,
  isAuditExpired,
  type AuditRecord,
  type EmailRecord,
  type LlmCallRecord,
  type OrderRecord,
  type PurgeSummary,
  type RetentionStats,
} from "./store-types";
import { dropPendingRows } from "./pending";

interface StoreShape {
  audits: AuditRecord[];
  orders: OrderRecord[];
  llm_calls: LlmCallRecord[];
  emails: EmailRecord[];
  /** every upload attempt (success or parse failure) for rate limiting */
  attempts: { ip: string; at: number }[];
  retention_stats: RetentionStats;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

let cache: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<StoreShape> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    cache = {
      audits: parsed.audits ?? [],
      orders: parsed.orders ?? [],
      llm_calls: parsed.llm_calls ?? [],
      emails: parsed.emails ?? [],
      attempts: parsed.attempts ?? [],
      retention_stats: { ...EMPTY_RETENTION_STATS, ...(parsed.retention_stats ?? {}) },
    };
    // backfill fields added after a store file was first written
    for (const a of cache.audits) {
      if (!Array.isArray(a.data_notes)) a.data_notes = [];
    }
    for (const o of cache.orders) {
      o.creem_order_id ??= null;
      o.creem_transaction_id ??= null;
      o.refund_id ??= null;
      o.refund_error ??= null;
      o.refund_attempted_at ??= null;
    }
  } catch {
    cache = {
      audits: [],
      orders: [],
      llm_calls: [],
      emails: [],
      attempts: [],
      retention_stats: { ...EMPTY_RETENTION_STATS },
    };
  }
  return cache;
}

async function persist(): Promise<void> {
  const snapshot = cache;
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf-8");
    await fs.rename(tmp, STORE_PATH);
  });
  return writeChain;
}

export async function createAudit(input: Partial<AuditRecord>): Promise<AuditRecord> {
  const store = await load();
  const rec: AuditRecord = {
    id: randomUUID(),
    token: null,
    email: null,
    ip: "",
    status: "awaiting_email",
    stage: "File checked",
    level: "adset",
    target_cpa: null,
    industry: null,
    columns_found: [],
    data_notes: [],
    aggregates: null,
    findings: null,
    health_score: null,
    grade: null,
    total_waste: null,
    issue_count: null,
    narrative: null,
    paid: false,
    paid_via: null,
    order_id: null,
    recheck_source_audit_id: null,
    recheck_used: false,
    error: null,
    created_at: new Date().toISOString(),
    ...input,
  };
  store.audits.push(rec);
  await persist();
  return rec;
}

export async function updateAudit(id: string, patch: Partial<AuditRecord>): Promise<AuditRecord | null> {
  const store = await load();
  const rec = store.audits.find((a) => a.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  await persist();
  return rec;
}

export async function getAuditById(id: string): Promise<AuditRecord | null> {
  const store = await load();
  return store.audits.find((a) => a.id === id) ?? null;
}

export async function getAuditByToken(token: string): Promise<AuditRecord | null> {
  const store = await load();
  return store.audits.find((a) => a.token === token) ?? null;
}

/* ------------------------------------------------------------------ */
/* Retention: reports are kept for REPORT_RETENTION_DAYS (90), then    */
/* deleted — privacy page, FAQ, footer, emails and the PDF all promise */
/* this, so it is enforced here, in the store, on two paths:           */
/*  - batch: purgeExpiredAudits(), run by the cron cleanup endpoint;   */
/*  - lazy: expireAuditIfNeeded(), called by every report read path so */
/*    an expired report is never served even if cron hasn't run yet.   */
/* ------------------------------------------------------------------ */

/** Delete one audit and everything that belongs to it: its orders, its
 *  LLM call records, and any in-memory pending rows. Returns false (and
 *  deletes nothing) when one of its orders is mid-refund. Anonymous
 *  counters are folded into retention_stats — never emails or content. */
function deleteAuditCascade(store: StoreShape, audit: AuditRecord): boolean {
  const orders = store.orders.filter((o) => o.audit_id === audit.id);
  if (orders.some((o) => o.status === "refund_pending")) return false;
  const calls = store.llm_calls.filter((c) => c.audit_id === audit.id);
  const s = store.retention_stats;
  s.audits_purged += 1;
  s.orders_purged += orders.length;
  s.paid_orders_purged += orders.filter((o) => o.status === "paid" || o.status === "refunded").length;
  s.llm_calls_purged += calls.length;
  s.llm_cost_usd_purged += calls.reduce((sum, c) => sum + c.est_cost_usd, 0);
  store.audits = store.audits.filter((a) => a.id !== audit.id);
  store.orders = store.orders.filter((o) => o.audit_id !== audit.id);
  store.llm_calls = store.llm_calls.filter((c) => c.audit_id !== audit.id);
  void dropPendingRows(audit.id);
  return true;
}

export async function purgeExpiredAudits(nowMs: number = Date.now()): Promise<PurgeSummary> {
  const store = await load();
  const before = { ...store.retention_stats };
  let held = 0;
  for (const audit of [...store.audits]) {
    if (!isAuditExpired(audit, nowMs)) continue;
    if (!deleteAuditCascade(store, audit)) held += 1;
  }
  // Email records carry addresses (PII) but no audit link; they age out on
  // their own timestamps under the same 90-day rule.
  const emailsBefore = store.emails.length;
  store.emails = store.emails.filter(
    (e) => nowMs - new Date(e.created_at).getTime() <= RETENTION_MS,
  );
  store.retention_stats.emails_purged += emailsBefore - store.emails.length;
  const after = store.retention_stats;
  const changed =
    after.audits_purged !== before.audits_purged || after.emails_purged !== before.emails_purged;
  if (changed) {
    after.last_purged_at = new Date(nowMs).toISOString();
    await persist();
  }
  return {
    audits: after.audits_purged - before.audits_purged,
    orders: after.orders_purged - before.orders_purged,
    llm_calls: after.llm_calls_purged - before.llm_calls_purged,
    emails: after.emails_purged - before.emails_purged,
    held_for_refund: held,
  };
}

/** Lazy expiry for read paths. Returns "purged" when the audit was expired
 *  and has now been deleted, "held" when it is expired but deletion is
 *  blocked by a pending refund (callers must still treat the report as
 *  expired and not serve its content), "not_expired" otherwise. */
export async function expireAuditIfNeeded(
  audit: AuditRecord,
  nowMs: number = Date.now(),
): Promise<"purged" | "held" | "not_expired"> {
  if (!isAuditExpired(audit, nowMs)) return "not_expired";
  const store = await load();
  const current = store.audits.find((a) => a.id === audit.id);
  if (!current) return "purged"; // already gone (e.g. cron beat us to it)
  if (!deleteAuditCascade(store, current)) return "held";
  store.retention_stats.last_purged_at = new Date(nowMs).toISOString();
  await persist();
  return "purged";
}

export async function countAuditsByIpSince(ip: string, sinceMs: number): Promise<number> {
  const store = await load();
  return store.audits.filter(
    (a) => a.ip === ip && new Date(a.created_at).getTime() >= sinceMs,
  ).length;
}

export async function countAuditsByEmailSince(email: string, sinceMs: number): Promise<number> {
  const store = await load();
  return store.audits.filter(
    (a) => a.email === email && new Date(a.created_at).getTime() >= sinceMs,
  ).length;
}

/** Record one upload attempt (counted whether parsing succeeds or fails)
 *  and count attempts for an IP since a timestamp — failed uploads burn
 *  quota too, so parse-bombing can't bypass the daily cap. */
export async function recordUploadAttempt(ip: string): Promise<void> {
  const store = await load();
  const cutoff = Date.now() - 48 * 3600 * 1000;
  store.attempts = store.attempts.filter((a) => a.at >= cutoff);
  store.attempts.push({ ip, at: Date.now() });
  await persist();
}

export async function countUploadAttemptsSince(ip: string, sinceMs: number): Promise<number> {
  const store = await load();
  return store.attempts.filter((a) => a.ip === ip && a.at >= sinceMs).length;
}

/** Find a paid audit by email whose free re-check is still available
 *  (order <= 30 days old, credit unused) — PRD F7 scenario C.
 *  SECURITY: this lookup is used ONLY to decide whether to email a signed
 *  re-check magic link. It must never by itself unlock anything — the
 *  credit is claimed via the signed grant (report token or magic link),
 *  validated in the email step against the source audit id. */
export async function findRecheckCandidateByEmail(email: string): Promise<AuditRecord | null> {
  const store = await load();
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const candidates = store.audits
    .filter(
      (a) =>
        a.email === email &&
        a.paid &&
        a.paid_via === "creem" &&
        !a.recheck_used &&
        new Date(a.created_at).getTime() >= cutoff,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return candidates[0] ?? null;
}

export async function createOrder(input: Partial<OrderRecord>): Promise<OrderRecord> {
  const store = await load();
  const rec: OrderRecord = {
    id: randomUUID(),
    audit_id: "",
    email: "",
    amount_usd: 49,
    status: "pending",
    creem_checkout_id: null,
    creem_order_id: null,
    creem_transaction_id: null,
    refund_id: null,
    refund_error: null,
    refund_attempted_at: null,
    created_at: new Date().toISOString(),
    paid_at: null,
    ...input,
  };
  store.orders.push(rec);
  await persist();
  return rec;
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  const store = await load();
  return store.orders.find((o) => o.id === id) ?? null;
}

export async function updateOrder(id: string, patch: Partial<OrderRecord>): Promise<void> {
  const store = await load();
  const rec = store.orders.find((o) => o.id === id);
  if (!rec) return;
  Object.assign(rec, patch);
  await persist();
}

export async function listOrdersByStatus(status: OrderRecord["status"]): Promise<OrderRecord[]> {
  const store = await load();
  return store.orders.filter((o) => o.status === status);
}

export async function recordLlmCall(input: Partial<LlmCallRecord>): Promise<void> {
  const store = await load();
  store.llm_calls.push({
    id: randomUUID(),
    audit_id: "",
    model: "deepseek-chat",
    status: "ok",
    input_tokens: 0,
    output_tokens: 0,
    est_cost_usd: 0,
    created_at: new Date().toISOString(),
    ...input,
  });
  await persist();
}

export async function countLlmCallsSince(sinceMs: number): Promise<number> {
  const store = await load();
  return store.llm_calls.filter((c) => new Date(c.created_at).getTime() >= sinceMs).length;
}

export async function recordEmail(input: Partial<EmailRecord>): Promise<void> {
  const store = await load();
  store.emails.push({
    id: randomUUID(),
    to: "",
    subject: "",
    status: "not_configured",
    created_at: new Date().toISOString(),
    ...input,
  });
  await persist();
}

export async function funnelStats() {
  const store = await load();
  const rs = store.retention_stats;
  return {
    // purged records survive ONLY as these anonymous counters, so the
    // funnel totals stay continuous across retention purges
    uploads: store.audits.length + rs.audits_purged,
    emails: store.audits.filter((a) => a.email).length,
    reports_ready: store.audits.filter((a) => a.status === "ready").length,
    paid: store.orders.filter((o) => o.status === "paid").length + rs.paid_orders_purged,
    rechecks: store.audits.filter((a) => a.paid_via === "recheck").length,
    llm_calls: store.llm_calls.map((c) => ({
      audit_id: c.audit_id,
      status: c.status,
      input_tokens: c.input_tokens,
      output_tokens: c.output_tokens,
      est_cost_usd: c.est_cost_usd,
      created_at: c.created_at,
    })),
    total_llm_cost_usd:
      store.llm_calls.reduce((s, c) => s + c.est_cost_usd, 0) + rs.llm_cost_usd_purged,
    retention: rs,
  };
}
