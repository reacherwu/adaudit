/**
 * Column mapping for Ads Manager exports (PRD F2).
 * Headers are normalized (lowercase, trimmed, currency parenthetical removed)
 * and matched against alias lists, so "Amount spent (USD)", "Amount spent"
 * and "AMOUNT SPENT" all resolve to the same field.
 */

import type { AdRow, Level } from "./types";

export type FieldKey = keyof AdRow;

const ALIASES: Record<string, FieldKey> = {
  "campaign name": "campaign_name",
  "ad set name": "adset_name",
  "adset name": "adset_name",
  "ad name": "ad_name",
  "amount spent": "amount_spent",
  impressions: "impressions",
  reach: "reach",
  frequency: "frequency",
  "clicks (all)": "clicks",
  clicks: "clicks",
  "ctr (all)": "ctr",
  ctr: "ctr",
  "cpc (all)": "cpc",
  cpc: "cpc",
  results: "results",
  "cost per result": "cost_per_result",
  "ad set daily budget": "daily_budget",
  "daily budget": "daily_budget",
  "ad set lifetime budget": "lifetime_budget",
  "lifetime budget": "lifetime_budget",
};

/** Human-facing column names — the SAME list is shown in the export guide and
 *  in the missing-column error, so users can tick boxes by name (DESIGN §4.2). */
export const REQUIRED_COLUMN_LABELS: { field: FieldKey; label: string; why: string }[] = [
  { field: "campaign_name", label: "Campaign name", why: "Account structure analysis" },
  { field: "adset_name", label: "Ad set name", why: "Most checks run per ad set" },
  { field: "amount_spent", label: "Amount spent", why: "Every waste calculation" },
  { field: "impressions", label: "Impressions", why: "Frequency and CPM checks" },
  { field: "reach", label: "Reach", why: "Frequency cross-check" },
  { field: "frequency", label: "Frequency", why: "Audience fatigue checks" },
  { field: "clicks", label: "Clicks (all)", why: "Click-through analysis" },
  { field: "ctr", label: "CTR (all)", why: "Fatigue and quality checks" },
  { field: "cpc", label: "CPC (all)", why: "Cheap-traffic trap detection" },
  { field: "results", label: "Results", why: "Conversions — the whole point of the audit" },
  { field: "cost_per_result", label: "Cost per result", why: "CPA blowout detection" },
];

export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(([a-z]{3}|account currency)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapHeader(raw: string): FieldKey | null {
  return ALIASES[normalizeHeader(raw)] ?? null;
}

/**
 * Given the headers found in a file, return which required fields are missing.
 * Frequency is derivable from impressions/reach, and ad_name is only required
 * at ad level; adset_name only at ad set level.
 */
export function missingRequiredFields(
  foundFields: Set<FieldKey>,
  level: Level,
): FieldKey[] {
  const required: FieldKey[] = [
    "campaign_name",
    "amount_spent",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "results",
    "cost_per_result",
  ];
  if (level === "adset") required.push("adset_name");
  if (level === "ad") required.push("ad_name", "adset_name");
  const missing = required.filter((f) => !foundFields.has(f));
  // Frequency can be derived (impressions / reach) when both are present.
  if (!foundFields.has("frequency")) {
    // not in `required` — frequency absence is handled by derivation in parse.
  }
  return missing;
}

export function labelForField(field: FieldKey): string {
  return REQUIRED_COLUMN_LABELS.find((c) => c.field === field)?.label ?? field;
}
