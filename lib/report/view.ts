/**
 * The client-facing view of a report. THIS is the paywall (PRD F7):
 * trimming happens here, on the server. When an audit is unpaid:
 *  - findings after the first are reduced to a number-free preview title
 *    and locked placeholders — real evidence, amounts and fix text never
 *    leave the server;
 *  - the exact total waste is withheld (field nulled, and dollar figures
 *    redacted from the executive summary prose);
 *  - the full aggregates object and the "What's working" prose are
 *    withheld — the preview shows the health score, the issue count and
 *    the first finding in full, nothing more.
 * The page and the JSON API both consume this same view.
 */

import type { AuditRecord } from "../store";
import type { Finding } from "../audit/types";
import { PRICE_USD } from "../audit/thresholds";

export interface FindingView {
  rule_id: string;
  severity: string;
  locked: boolean;
  title: string;
  evidence_text: string | null;
  waste_usd: number | null;
  waste_note: string | null;
  why_it_matters: string | null;
  applies_to: string[] | null;
  note: string | null;
}

export interface ReportView {
  status: string;
  stage: string;
  paid: boolean;
  price_usd: number;
  created_at: string;
  email_masked: string | null;
  health_score: number | null;
  grade: string | null;
  total_waste: number | null;
  issue_count: number | null;
  narrative_source: "llm" | "template" | null;
  executive_summary: string | null;
  score_reason: string | null;
  whats_working: string | null;
  data_notes: string[];
  findings: FindingView[];
  fixes:
    | { mode: "full"; items: NonNullable<AuditRecord["narrative"]>["fixes"] }
    | { mode: "counts"; counts: { label: string; count: number }[] }
    | null;
  aggregates: AuditRecord["aggregates"];
  recheck: { source: boolean; used: boolean } | null;
  error: string | null;
}

/** Strip every exact dollar figure from free-preview prose. The unpaid
 *  view may carry the health score, the issue count and the first finding
 *  in full — never the precise waste total, which also hides inside the
 *  executive summary text, not just the total_waste field. */
function redactMoney(text: string): string {
  return text.replace(/\$\s?[\d,]+(?:\.\d{1,2})?/g, "$•••");
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}•••@${domain}`;
}

function findingView(f: Finding, audit: AuditRecord, index: number): FindingView {
  const full = audit.paid || index === 0;
  if (full) {
    return {
      rule_id: f.rule_id,
      severity: f.severity,
      locked: false,
      title: f.title,
      evidence_text: f.evidence_text,
      waste_usd: f.waste_usd,
      waste_note: f.waste_note,
      why_it_matters: audit.narrative?.waste_notes[f.rule_id] ?? null,
      applies_to: f.applies_to,
      note: f.note,
    };
  }
  return {
    rule_id: f.rule_id,
    severity: f.severity,
    locked: true,
    // preview_title contains NO numbers by construction (fixes.ts)
    title: f.preview_title,
    evidence_text: null,
    waste_usd: null,
    waste_note: null,
    why_it_matters: null,
    applies_to: null,
    note: null,
  };
}

export function buildReportView(audit: AuditRecord): ReportView {
  const findings = (audit.findings ?? []).map((f, i) => findingView(f, audit, i));
  let fixes: ReportView["fixes"] = null;
  if (audit.narrative) {
    if (audit.paid) {
      fixes = { mode: "full", items: audit.narrative.fixes };
    } else {
      const counts = new Map<string, number>();
      for (const item of audit.narrative.fixes) {
        counts.set(item.group_label, (counts.get(item.group_label) ?? 0) + 1);
      }
      fixes = {
        mode: "counts",
        counts: ["This week", "This month", "Later"]
          .filter((l) => counts.has(l))
          .map((l) => ({ label: l, count: counts.get(l)! })),
      };
    }
  }
  const unpaid = !audit.paid;
  return {
    status: audit.status,
    stage: audit.stage,
    paid: audit.paid,
    price_usd: PRICE_USD,
    created_at: audit.created_at,
    email_masked: maskEmail(audit.email),
    health_score: audit.health_score,
    grade: audit.grade,
    // Free preview tightening: no exact waste total, no full aggregates,
    // no "What's working" prose until paid — only the issue count, the
    // health score and the first finding in full (see findingView).
    total_waste: unpaid ? null : audit.total_waste,
    issue_count: audit.issue_count,
    narrative_source: audit.narrative?.source ?? null,
    executive_summary: audit.narrative
      ? unpaid
        ? redactMoney(audit.narrative.executive_summary)
        : audit.narrative.executive_summary
      : null,
    score_reason: audit.narrative?.score_reason ?? null,
    whats_working: unpaid ? null : (audit.narrative?.whats_working ?? null),
    data_notes: audit.data_notes ?? [],
    findings,
    fixes,
    aggregates: unpaid ? null : audit.aggregates,
    recheck: audit.paid
      ? { source: audit.paid_via === "recheck", used: audit.recheck_used }
      : null,
    error: audit.error,
  };
}
