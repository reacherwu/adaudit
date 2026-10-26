/**
 * Core data types for the audit pipeline.
 * AdRow is the standardized internal shape every parsed Ads Manager export
 * is normalized into (PRD F3). All numbers are plain numbers; percentages
 * (CTR) are stored as percent values, e.g. 1.23 means 1.23%.
 */

export type Level = "adset" | "ad";

export interface AdRow {
  campaign_name: string;
  adset_name: string;
  /** null when the export is at ad set level */
  ad_name: string | null;
  amount_spent: number;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  clicks: number | null;
  ctr: number | null; // percent, e.g. 0.85 = 0.85%
  cpc: number | null;
  results: number | null;
  cost_per_result: number | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
}

export type Severity = "high" | "medium" | "low";

export interface RuleHit {
  rule_id: string;
  /** ad set name (or ad name at ad level); "__account__" for account-wide rules */
  group_key: string;
  severity: Severity;
  /** evidence numbers for this specific hit — all values come from the parsed file */
  evidence: Record<string, number | string>;
  /** raw waste estimate for this hit before cross-rule de-duplication */
  waste_raw: number | null;
}

export interface Finding {
  rule_id: string;
  severity: Severity;
  /** full title — may contain real numbers; only sent to the client when paid or for finding #1 */
  title: string;
  /** number-free preview title, safe to show in the free preview */
  preview_title: string;
  evidence_text: string;
  /** de-duplicated waste estimate owned by this rule (null = not estimated) */
  waste_usd: number | null;
  waste_note: string | null;
  fix_key: string;
  applies_to: string[];
  /** extra honesty note, e.g. R8 low-confidence disclaimer */
  note: string | null;
  /** R12 account-wide alarm: pinned to the top, no separate score deduction */
  pin_top: boolean;
  score_deduction: number;
}

export interface Aggregates {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
  avg_cpa: number | null;
  median_ctr: number | null;
  median_cpc: number | null;
  row_count: number;
  adset_count: number;
  campaign_count: number;
  /** best performing groups by CPA, for the "What's working" section */
  top_performers: { name: string; spend: number; results: number; cpa: number }[];
}

export interface AuditResult {
  aggregates: Aggregates;
  findings: Finding[];
  health_score: number;
  grade: "Healthy" | "Needs work" | "Wasteful" | "Critical";
  total_waste: number;
  issue_count: number;
  /** ISO 4217 code every amount in this result is denominated in.
   *  (Finding.waste_usd keeps its legacy name — it holds an amount in
   *  THIS currency; the name is frozen by stored data compatibility.) */
  currency: string;
}

export interface FixItem {
  key: string;
  priority: "P0" | "P1" | "P2";
  group_label: "This week" | "This month" | "Later";
  action: string;
  /** click-path inside Ads Manager */
  path: string;
  expected: string;
}

export interface ReportNarrative {
  executive_summary: string;
  score_reason: string;
  /** rule_id -> "why it matters" paragraph */
  waste_notes: Record<string, string>;
  fixes: FixItem[];
  whats_working: string;
  /** "llm" when written by DeepSeek, "template" when it is the rule-data fallback */
  source: "llm" | "template";
}
