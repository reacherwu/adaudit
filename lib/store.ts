/**
 * Persistence — public entry point. Two backends behind one interface:
 *
 *  - Postgres (lib/store-pg.ts): used whenever DATABASE_URL is set —
 *    production. The team's managed Prisma Postgres instance, app data
 *    in the dedicated `adaudit` schema. This is shared, durable storage:
 *    any serverless instance sees the same audits, so a report token
 *    minted by one instance resolves on every other.
 *  - JSON file (lib/store-file.ts): local development only (no
 *    DATABASE_URL, not on Vercel). On Vercel without DATABASE_URL the
 *    dispatcher throws instead of silently using an instance-local file
 *    (see lib/db.ts storeBackend) — that silent fallback is what broke
 *    production report links.
 *
 * Only aggregates, findings, report text, email and orders are stored —
 * never the uploaded file itself (see lib/pending.ts for the parsed
 * rows' short-lived holding).
 */

import { storeBackend } from "./db";
import * as fileImpl from "./store-file";
import * as pgImpl from "./store-pg";
import type {
  AuditRecord,
  EmailRecord,
  LlmCallRecord,
  OrderRecord,
  PurgeSummary,
} from "./store-types";

export * from "./store-types";

type Impl = typeof pgImpl;

function impl(): Impl {
  return storeBackend() === "pg" ? pgImpl : (fileImpl as unknown as Impl);
}

export function createAudit(input: Partial<AuditRecord>): Promise<AuditRecord> {
  return impl().createAudit(input);
}

export function updateAudit(
  id: string,
  patch: Partial<AuditRecord>,
): Promise<AuditRecord | null> {
  return impl().updateAudit(id, patch);
}

export function getAuditById(id: string): Promise<AuditRecord | null> {
  return impl().getAuditById(id);
}

export function getAuditByToken(token: string): Promise<AuditRecord | null> {
  return impl().getAuditByToken(token);
}

export function purgeExpiredAudits(nowMs?: number): Promise<PurgeSummary> {
  return impl().purgeExpiredAudits(nowMs);
}

export function expireAuditIfNeeded(
  audit: AuditRecord,
  nowMs?: number,
): Promise<"purged" | "held" | "not_expired"> {
  return impl().expireAuditIfNeeded(audit, nowMs);
}

export function countAuditsByIpSince(ip: string, sinceMs: number): Promise<number> {
  return impl().countAuditsByIpSince(ip, sinceMs);
}

export function countAuditsByEmailSince(email: string, sinceMs: number): Promise<number> {
  return impl().countAuditsByEmailSince(email, sinceMs);
}

export function recordUploadAttempt(ip: string): Promise<void> {
  return impl().recordUploadAttempt(ip);
}

export function countUploadAttemptsSince(ip: string, sinceMs: number): Promise<number> {
  return impl().countUploadAttemptsSince(ip, sinceMs);
}

export function findRecheckCandidateByEmail(email: string): Promise<AuditRecord | null> {
  return impl().findRecheckCandidateByEmail(email);
}

export function createOrder(input: Partial<OrderRecord>): Promise<OrderRecord> {
  return impl().createOrder(input);
}

export function getOrder(id: string): Promise<OrderRecord | null> {
  return impl().getOrder(id);
}

export function updateOrder(id: string, patch: Partial<OrderRecord>): Promise<void> {
  return impl().updateOrder(id, patch);
}

export function listOrdersByStatus(
  status: OrderRecord["status"],
): Promise<OrderRecord[]> {
  return impl().listOrdersByStatus(status);
}

export function recordLlmCall(input: Partial<LlmCallRecord>): Promise<void> {
  return impl().recordLlmCall(input);
}

export function countLlmCallsSince(sinceMs: number): Promise<number> {
  return impl().countLlmCallsSince(sinceMs);
}

export function recordEmail(input: Partial<EmailRecord>): Promise<void> {
  return impl().recordEmail(input);
}

export function funnelStats() {
  return impl().funnelStats();
}
