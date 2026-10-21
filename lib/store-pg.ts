/**
 * Postgres implementation of the persistence layer (production).
 * Same functions, same entity shapes, same semantics as the JSON file
 * implementation in lib/store-file.ts — lib/store.ts dispatches between
 * them. Every record is stored whole in a `doc` jsonb column; the few
 * fields queries filter on are extracted into real columns. Mutations of
 * a single record run in a transaction with SELECT ... FOR UPDATE so two
 * serverless instances can never lose each other's writes.
 *
 * Retention (PRD §7): identical rules to the file backend — 90 days,
 * enforced by purgeExpiredAudits() (cron) and lazily by
 * expireAuditIfNeeded() on every report read path; an audit whose order
 * is mid-refund is held, never deleted under a pending refund.
 */

import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { ensureSchema, getPool, withTx } from "./db";
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

type Queryable = Pick<PoolClient, "query">;

function auditParams(rec: AuditRecord): unknown[] {
  return [
    rec.id,
    rec.token,
    rec.email,
    rec.ip,
    rec.status,
    rec.paid,
    rec.paid_via,
    rec.recheck_used,
    new Date(rec.created_at),
    JSON.stringify(rec),
  ];
}

const AUDIT_UPSERT = `
  INSERT INTO adaudit.audits (id, token, email, ip, status, paid, paid_via, recheck_used, created_at, doc)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ON CONFLICT (id) DO UPDATE SET
    token = EXCLUDED.token, email = EXCLUDED.email, ip = EXCLUDED.ip,
    status = EXCLUDED.status, paid = EXCLUDED.paid, paid_via = EXCLUDED.paid_via,
    recheck_used = EXCLUDED.recheck_used, created_at = EXCLUDED.created_at,
    doc = EXCLUDED.doc`;

async function upsertAudit(q: Queryable, rec: AuditRecord): Promise<void> {
  await q.query(AUDIT_UPSERT, auditParams(rec));
}

function baseAudit(input: Partial<AuditRecord>): AuditRecord {
  return {
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
}

export async function createAudit(input: Partial<AuditRecord>): Promise<AuditRecord> {
  await ensureSchema();
  const rec = baseAudit(input);
  await getPool().query(AUDIT_UPSERT, auditParams(rec));
  return rec;
}

export async function updateAudit(
  id: string,
  patch: Partial<AuditRecord>,
): Promise<AuditRecord | null> {
  await ensureSchema();
  return withTx(async (client) => {
    const { rows } = await client.query(
      "SELECT doc FROM adaudit.audits WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (rows.length === 0) return null;
    const rec = rows[0].doc as AuditRecord;
    if (!Array.isArray(rec.data_notes)) rec.data_notes = [];
    Object.assign(rec, patch);
    await upsertAudit(client, rec);
    return rec;
  });
}

export async function getAuditById(id: string): Promise<AuditRecord | null> {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT doc FROM adaudit.audits WHERE id = $1", [id]);
  return rows.length ? (rows[0].doc as AuditRecord) : null;
}

export async function getAuditByToken(token: string): Promise<AuditRecord | null> {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT doc FROM adaudit.audits WHERE token = $1", [
    token,
  ]);
  return rows.length ? (rows[0].doc as AuditRecord) : null;
}

/* ------------------------------ retention ------------------------------ */

async function getRetentionStats(client: PoolClient, lock: boolean): Promise<RetentionStats> {
  const { rows } = await client.query(
    `SELECT doc FROM adaudit.meta WHERE key = 'retention_stats'${lock ? " FOR UPDATE" : ""}`,
  );
  if (rows.length === 0) return { ...EMPTY_RETENTION_STATS };
  return { ...EMPTY_RETENTION_STATS, ...(rows[0].doc as RetentionStats) };
}

async function putRetentionStats(client: PoolClient, stats: RetentionStats): Promise<void> {
  await client.query(
    `INSERT INTO adaudit.meta (key, doc) VALUES ('retention_stats', $1)
     ON CONFLICT (key) DO UPDATE SET doc = EXCLUDED.doc`,
    [JSON.stringify(stats)],
  );
}

interface CascadeResult {
  deleted: boolean;
  orders: number;
  paidOrders: number;
  llmCalls: number;
  llmCost: number;
}

/** Delete one audit and everything that belongs to it, inside the
 *  caller's transaction. Refuses (deletes nothing) while one of its
 *  orders is mid-refund. */
async function deleteAuditCascade(client: PoolClient, auditId: string): Promise<CascadeResult> {
  const held = await client.query(
    "SELECT 1 FROM adaudit.orders WHERE audit_id = $1 AND status = 'refund_pending' LIMIT 1",
    [auditId],
  );
  if (held.rows.length > 0) {
    return { deleted: false, orders: 0, paidOrders: 0, llmCalls: 0, llmCost: 0 };
  }
  const orderStats = await client.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE status IN ('paid', 'refunded'))::int AS paid_n
       FROM adaudit.orders WHERE audit_id = $1`,
    [auditId],
  );
  const llmStats = await client.query(
    `SELECT count(*)::int AS n, COALESCE(sum(est_cost_usd), 0)::float8 AS cost
       FROM adaudit.llm_calls WHERE audit_id = $1`,
    [auditId],
  );
  await client.query("DELETE FROM adaudit.pending_rows WHERE audit_id = $1", [auditId]);
  await client.query("DELETE FROM adaudit.llm_calls WHERE audit_id = $1", [auditId]);
  await client.query("DELETE FROM adaudit.orders WHERE audit_id = $1", [auditId]);
  await client.query("DELETE FROM adaudit.audits WHERE id = $1", [auditId]);
  return {
    deleted: true,
    orders: orderStats.rows[0].n as number,
    paidOrders: orderStats.rows[0].paid_n as number,
    llmCalls: llmStats.rows[0].n as number,
    llmCost: llmStats.rows[0].cost as number,
  };
}

export async function purgeExpiredAudits(nowMs: number = Date.now()): Promise<PurgeSummary> {
  await ensureSchema();
  return withTx(async (client) => {
    const stats = await getRetentionStats(client, true);
    const before = { ...stats };
    let held = 0;
    const cutoff = new Date(nowMs - RETENTION_MS);
    const { rows: expired } = await client.query(
      "SELECT id FROM adaudit.audits WHERE created_at <= $1",
      [cutoff],
    );
    for (const row of expired) {
      const res = await deleteAuditCascade(client, row.id as string);
      if (!res.deleted) {
        held += 1;
        continue;
      }
      stats.audits_purged += 1;
      stats.orders_purged += res.orders;
      stats.paid_orders_purged += res.paidOrders;
      stats.llm_calls_purged += res.llmCalls;
      stats.llm_cost_usd_purged += res.llmCost;
    }
    // Email records carry addresses (PII) but no audit link; they age out
    // on their own timestamps under the same 90-day rule.
    const emailsBefore = await client.query(
      "SELECT count(*)::int AS n FROM adaudit.emails WHERE created_at <= $1",
      [cutoff],
    );
    const emailsPurged = emailsBefore.rows[0].n as number;
    if (emailsPurged > 0) {
      await client.query("DELETE FROM adaudit.emails WHERE created_at <= $1", [cutoff]);
      stats.emails_purged += emailsPurged;
    }
    const changed =
      stats.audits_purged !== before.audits_purged || stats.emails_purged !== before.emails_purged;
    if (changed) {
      stats.last_purged_at = new Date(nowMs).toISOString();
      await putRetentionStats(client, stats);
    }
    return {
      audits: stats.audits_purged - before.audits_purged,
      orders: stats.orders_purged - before.orders_purged,
      llm_calls: stats.llm_calls_purged - before.llm_calls_purged,
      emails: stats.emails_purged - before.emails_purged,
      held_for_refund: held,
    };
  });
}

export async function expireAuditIfNeeded(
  audit: AuditRecord,
  nowMs: number = Date.now(),
): Promise<"purged" | "held" | "not_expired"> {
  if (!isAuditExpired(audit, nowMs)) return "not_expired";
  await ensureSchema();
  return withTx(async (client) => {
    const { rows } = await client.query("SELECT id FROM adaudit.audits WHERE id = $1", [audit.id]);
    if (rows.length === 0) return "purged" as const; // already gone (cron beat us)
    const stats = await getRetentionStats(client, true);
    const res = await deleteAuditCascade(client, audit.id);
    if (!res.deleted) return "held" as const;
    stats.audits_purged += 1;
    stats.orders_purged += res.orders;
    stats.paid_orders_purged += res.paidOrders;
    stats.llm_calls_purged += res.llmCalls;
    stats.llm_cost_usd_purged += res.llmCost;
    stats.last_purged_at = new Date(nowMs).toISOString();
    await putRetentionStats(client, stats);
    return "purged" as const;
  });
}

/* ------------------------------ counters ------------------------------ */

export async function countAuditsByIpSince(ip: string, sinceMs: number): Promise<number> {
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT count(*)::int AS n FROM adaudit.audits WHERE ip = $1 AND created_at >= $2",
    [ip, new Date(sinceMs)],
  );
  return rows[0].n as number;
}

export async function countAuditsByEmailSince(email: string, sinceMs: number): Promise<number> {
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT count(*)::int AS n FROM adaudit.audits WHERE email = $1 AND created_at >= $2",
    [email, new Date(sinceMs)],
  );
  return rows[0].n as number;
}

/** Record one upload attempt (counted whether parsing succeeds or fails)
 *  and count attempts for an IP since a timestamp — failed uploads burn
 *  quota too, so parse-bombing can't bypass the daily cap. */
export async function recordUploadAttempt(ip: string): Promise<void> {
  await ensureSchema();
  const cutoff = Date.now() - 48 * 3600 * 1000;
  await getPool().query("DELETE FROM adaudit.attempts WHERE at_ms < $1", [cutoff]);
  await getPool().query("INSERT INTO adaudit.attempts (ip, at_ms) VALUES ($1, $2)", [
    ip,
    Date.now(),
  ]);
}

export async function countUploadAttemptsSince(ip: string, sinceMs: number): Promise<number> {
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT count(*)::int AS n FROM adaudit.attempts WHERE ip = $1 AND at_ms >= $2",
    [ip, sinceMs],
  );
  return rows[0].n as number;
}

/** Find a paid audit by email whose free re-check is still available
 *  (order <= 30 days old, credit unused) — PRD F7 scenario C.
 *  SECURITY: this lookup is used ONLY to decide whether to email a signed
 *  re-check magic link. It must never by itself unlock anything — the
 *  credit is claimed via the signed grant (report token or magic link),
 *  validated in the email step against the source audit id. */
export async function findRecheckCandidateByEmail(email: string): Promise<AuditRecord | null> {
  await ensureSchema();
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const { rows } = await getPool().query(
    `SELECT doc FROM adaudit.audits
      WHERE email = $1 AND paid = true AND paid_via = 'creem'
        AND recheck_used = false AND created_at >= $2
      ORDER BY created_at ASC LIMIT 1`,
    [email, cutoff],
  );
  return rows.length ? (rows[0].doc as AuditRecord) : null;
}

/* ------------------------------ orders ------------------------------ */

export async function createOrder(input: Partial<OrderRecord>): Promise<OrderRecord> {
  await ensureSchema();
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
  // backfill fields added after the type grew, for partial inputs
  rec.creem_order_id ??= null;
  rec.creem_transaction_id ??= null;
  rec.refund_id ??= null;
  rec.refund_error ??= null;
  rec.refund_attempted_at ??= null;
  await getPool().query(
    `INSERT INTO adaudit.orders (id, audit_id, status, created_at, doc)
     VALUES ($1, $2, $3, $4, $5)`,
    [rec.id, rec.audit_id, rec.status, new Date(rec.created_at), JSON.stringify(rec)],
  );
  return rec;
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT doc FROM adaudit.orders WHERE id = $1", [id]);
  return rows.length ? (rows[0].doc as OrderRecord) : null;
}

export async function updateOrder(id: string, patch: Partial<OrderRecord>): Promise<void> {
  await ensureSchema();
  await withTx(async (client) => {
    const { rows } = await client.query(
      "SELECT doc FROM adaudit.orders WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (rows.length === 0) return;
    const rec = rows[0].doc as OrderRecord;
    Object.assign(rec, patch);
    await client.query(
      `UPDATE adaudit.orders SET audit_id = $2, status = $3, created_at = $4, doc = $5 WHERE id = $1`,
      [rec.id, rec.audit_id, rec.status, new Date(rec.created_at), JSON.stringify(rec)],
    );
  });
}

export async function listOrdersByStatus(status: OrderRecord["status"]): Promise<OrderRecord[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT doc FROM adaudit.orders WHERE status = $1",
    [status],
  );
  return rows.map((r) => r.doc as OrderRecord);
}

/* ------------------------------ llm / email ------------------------------ */

export async function recordLlmCall(input: Partial<LlmCallRecord>): Promise<void> {
  await ensureSchema();
  const rec: LlmCallRecord = {
    id: randomUUID(),
    audit_id: "",
    model: "deepseek-chat",
    status: "ok",
    input_tokens: 0,
    output_tokens: 0,
    est_cost_usd: 0,
    created_at: new Date().toISOString(),
    ...input,
  };
  await getPool().query(
    `INSERT INTO adaudit.llm_calls (id, audit_id, created_at, est_cost_usd, doc)
     VALUES ($1, $2, $3, $4, $5)`,
    [rec.id, rec.audit_id, new Date(rec.created_at), rec.est_cost_usd, JSON.stringify(rec)],
  );
}

export async function countLlmCallsSince(sinceMs: number): Promise<number> {
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT count(*)::int AS n FROM adaudit.llm_calls WHERE created_at >= $1",
    [new Date(sinceMs)],
  );
  return rows[0].n as number;
}

export async function recordEmail(input: Partial<EmailRecord>): Promise<void> {
  await ensureSchema();
  const rec: EmailRecord = {
    id: randomUUID(),
    to: "",
    subject: "",
    status: "not_configured",
    created_at: new Date().toISOString(),
    ...input,
  };
  await getPool().query(
    `INSERT INTO adaudit.emails (id, created_at, doc) VALUES ($1, $2, $3)`,
    [rec.id, new Date(rec.created_at), JSON.stringify(rec)],
  );
}

/* ------------------------------ funnel ------------------------------ */

export async function funnelStats() {
  await ensureSchema();
  const pool = getPool();
  const stats = await withTx((client) => getRetentionStats(client, false));
  const counts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM adaudit.audits) AS audits_n,
      (SELECT count(*)::int FROM adaudit.audits WHERE email IS NOT NULL) AS emails_n,
      (SELECT count(*)::int FROM adaudit.audits WHERE status = 'ready') AS ready_n,
      (SELECT count(*)::int FROM adaudit.orders WHERE status = 'paid') AS paid_n,
      (SELECT count(*)::int FROM adaudit.audits WHERE paid_via = 'recheck') AS rechecks_n,
      (SELECT COALESCE(sum(est_cost_usd), 0)::float8 FROM adaudit.llm_calls) AS llm_cost
  `);
  const c = counts.rows[0] as Record<string, number>;
  const { rows: callRows } = await pool.query(
    "SELECT doc FROM adaudit.llm_calls ORDER BY created_at ASC",
  );
  const calls = callRows.map((r) => r.doc as LlmCallRecord);
  return {
    // purged records survive ONLY as these anonymous counters, so the
    // funnel totals stay continuous across retention purges
    uploads: c.audits_n + stats.audits_purged,
    emails: c.emails_n,
    reports_ready: c.ready_n,
    paid: c.paid_n + stats.paid_orders_purged,
    rechecks: c.rechecks_n,
    llm_calls: calls.map((call) => ({
      audit_id: call.audit_id,
      status: call.status,
      input_tokens: call.input_tokens,
      output_tokens: call.output_tokens,
      est_cost_usd: call.est_cost_usd,
      created_at: call.created_at,
    })),
    total_llm_cost_usd: c.llm_cost + stats.llm_cost_usd_purged,
    retention: stats,
  };
}
