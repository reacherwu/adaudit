/**
 * Shared entity shapes + pure helpers for the persistence layer.
 * These types are the contract every store backend (Postgres in
 * production, JSON file for local dev) implements — see lib/store.ts.
 */

import { randomBytes } from "crypto";
import type { Aggregates, Finding, ReportNarrative } from "./audit/types";
import { REPORT_RETENTION_DAYS } from "./audit/thresholds";

export type AuditStatus = "awaiting_email" | "processing" | "ready" | "failed";

export interface AuditRecord {
  id: string;
  token: string | null; // set when the email is provided
  email: string | null;
  ip: string;
  status: AuditStatus;
  stage: string; // current processing stage label for the progress page
  level: "adset" | "ad";
  /** ISO 4217 code of the audited account. Absent on records created
   *  before currency detection existed — readers must use ?? "USD". */
  currency?: string;
  target_cpa: number | null;
  industry: string | null;
  columns_found: string[];
  /** honest data-quality notes shown on the report (e.g. clamped rows) */
  data_notes: string[];
  aggregates: Aggregates | null;
  findings: Finding[] | null;
  health_score: number | null;
  grade: string | null;
  total_waste: number | null;
  issue_count: number | null;
  narrative: ReportNarrative | null;
  paid: boolean;
  paid_via: "creem" | "recheck" | null;
  order_id: string | null;
  /** if this audit consumed a free re-check, the source order's audit id */
  recheck_source_audit_id: string | null;
  recheck_used: boolean; // whether THIS audit's own re-check credit has been spent
  error: string | null;
  created_at: string;
}

export interface OrderRecord {
  id: string;
  audit_id: string;
  email: string;
  amount_usd: number;
  status: "pending" | "paid" | "failed" | "refunded" | "refund_pending";
  creem_checkout_id: string | null;
  /** Creem's own order id (checkout.completed event), when seen */
  creem_order_id: string | null;
  /** Creem transaction id — the refund target. Captured from the webhook
   *  event when Creem includes it; otherwise resolved via the Creem API
   *  at refund time (see lib/creem.ts createRefund). */
  creem_transaction_id: string | null;
  /** Creem refund id once a refund has actually been created */
  refund_id: string | null;
  /** why the last refund attempt did not complete (refund_pending only) */
  refund_error: string | null;
  refund_attempted_at: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface LlmCallRecord {
  id: string;
  audit_id: string;
  model: string;
  status: "ok" | "failed" | "no_key" | "invalid_numbers" | "rejected_output";
  input_tokens: number;
  output_tokens: number;
  est_cost_usd: number;
  created_at: string;
}

export interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  status: "sent" | "not_configured" | "failed";
  created_at: string;
}

/**
 * Anonymous counters kept when retention purging deletes records, so the
 * funnel/cost stats stay continuous. Deliberately counts and sums ONLY:
 * no emails, no tokens, no report content — nothing that could identify
 * or reconstruct a purged audit.
 */
export interface RetentionStats {
  audits_purged: number;
  orders_purged: number;
  paid_orders_purged: number;
  llm_calls_purged: number;
  llm_cost_usd_purged: number;
  emails_purged: number;
  last_purged_at: string | null;
}

export const EMPTY_RETENTION_STATS: RetentionStats = {
  audits_purged: 0,
  orders_purged: 0,
  paid_orders_purged: 0,
  llm_calls_purged: 0,
  llm_cost_usd_purged: 0,
  emails_purged: 0,
  last_purged_at: null,
};

export function newToken(): string {
  return randomBytes(24).toString("base64url"); // 192-bit, unguessable (PRD F8)
}

export const RETENTION_MS = REPORT_RETENTION_DAYS * 24 * 3600 * 1000;

export function isAuditExpired(audit: AuditRecord, nowMs: number = Date.now()): boolean {
  return nowMs - new Date(audit.created_at).getTime() > RETENTION_MS;
}

export interface PurgeSummary {
  audits: number;
  orders: number;
  llm_calls: number;
  emails: number;
  /** expired audits NOT deleted because a refund is still pending on one
   *  of their orders — money resolution comes before data deletion; an
   *  admin must settle the refund first (it is retried by cron). */
  held_for_refund: number;
}
