/**
 * Audit rules engine (PRD §5 + F5). Pure functions: AdRow[] in, AuditResult out.
 * Every number in a Finding comes from the parsed file — nothing is invented.
 * De-duplication (PRD §5): when several rules hit the same ad set/ad, the
 * group's waste is owned by the single largest estimate; other rules keep
 * their finding but contribute $0, so the total never double-counts.
 * "宁可少报，不许多报" — rather under-report than over-report.
 */

import type { AdRow, Aggregates, AuditResult, Finding, Level, RuleHit, Severity } from "./types";
import { THRESHOLDS as T, SCORE_CAPS, SCORE_FORMULA } from "./thresholds";
import { PREVIEW_TITLES } from "./fixes";

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US");

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupKeyOf(row: AdRow, level: Level): string {
  return level === "ad" && row.ad_name ? row.ad_name : row.adset_name;
}

/** Sum rows per group key (ad set or ad), keeping the group's own rows. */
function groupRows(rows: AdRow[], level: Level): Map<string, AdRow[]> {
  const map = new Map<string, AdRow[]>();
  for (const r of rows) {
    const k = groupKeyOf(r, level) || "(unnamed)";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return map;
}

interface GroupAgg {
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  /** weighted frequency: sum(freq x impressions)/sum(impressions), fallback max */
  frequency: number | null;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  daily_budget_min: number | null;
}

function aggregateGroup(key: string, rows: AdRow[]): GroupAgg {
  const spend = rows.reduce((s, r) => s + r.amount_spent, 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const results = rows.reduce((s, r) => s + (r.results ?? 0), 0);
  let weightedFreq: number | null = null;
  const withFreq = rows.filter((r) => r.frequency !== null && r.impressions);
  if (withFreq.length) {
    const numSum = withFreq.reduce((s, r) => s + r.frequency! * (r.impressions ?? 0), 0);
    const denSum = withFreq.reduce((s, r) => s + (r.impressions ?? 0), 0);
    if (denSum > 0) weightedFreq = numSum / denSum;
  }
  const budgets = rows.map((r) => r.daily_budget).filter((b): b is number => b !== null);
  return {
    key,
    spend,
    impressions,
    clicks,
    results,
    frequency: weightedFreq,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpa: results > 0 ? spend / results : null,
    daily_budget_min: budgets.length ? Math.min(...budgets) : null,
  };
}

export interface EngineOptions {
  targetCpa?: number | null;
  level: Level;
}

export function runAudit(rows: AdRow[], opts: EngineOptions): AuditResult {
  const level = opts.level;
  const S = rows.reduce((s, r) => s + r.amount_spent, 0);
  const totalResults = rows.reduce((s, r) => s + (r.results ?? 0), 0);
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const avgCpa = totalResults > 0 ? S / totalResults : null;
  const medianCtr = median(rows.map((r) => r.ctr).filter((v): v is number => v !== null));
  const medianCpc = median(rows.map((r) => r.cpc).filter((v): v is number => v !== null));
  const CPA_t = opts.targetCpa ?? null;
  const CPA_ref = avgCpa;

  const groups = [...groupRows(rows, level).entries()].map(([k, rs]) => aggregateGroup(k, rs));
  const activeGroups = groups.filter((g) => g.spend > 0);

  const hits: RuleHit[] = [];
  const hit = (
    rule_id: string,
    group_key: string,
    severity: Severity,
    evidence: Record<string, number | string>,
    waste_raw: number | null,
  ) => hits.push({ rule_id, group_key, severity, evidence, waste_raw });

  // ---------- R1: zero-conversion big spenders ----------
  const r1Threshold = Math.max(T.R1_MIN_SPEND, CPA_ref ? T.R1_CPA_MULT * CPA_ref : 0);
  for (const g of groups) {
    if (g.spend >= r1Threshold && g.results === 0) {
      hit("R1", g.key, "high",
        { spend: round2(g.spend), results: 0, impressions: g.impressions }, g.spend);
    }
  }

  // ---------- R2: CPA blowouts ----------
  const cpaBenchmark = CPA_t ?? CPA_ref;
  if (cpaBenchmark) {
    for (const g of groups) {
      if (g.results >= T.R2_MIN_RESULTS && g.cpa !== null && g.cpa >= T.R2_CPA_MULT * cpaBenchmark) {
        const waste = g.spend - g.spend * (cpaBenchmark / g.cpa);
        hit("R2", g.key, "high",
          { spend: round2(g.spend), results: g.results, cpa: round2(g.cpa), benchmark_cpa: round2(cpaBenchmark) },
          round2(waste));
      }
    }
  }

  // ---------- R3: frequency fatigue ----------
  for (const g of groups) {
    if (g.frequency === null) continue;
    const freq = g.frequency;
    if (freq >= T.R3_FREQ_HIGH) {
      hit("R3", g.key, "high", { frequency: round2(freq), spend: round2(g.spend) }, round2(g.spend * T.R3_WASTE_RATIO));
    } else if (freq >= T.R3_FREQ_FLAG && (g.ctr === null || medianCtr === null || g.ctr < medianCtr)) {
      hit("R3", g.key, "medium", { frequency: round2(freq), spend: round2(g.spend) }, round2(g.spend * T.R3_WASTE_RATIO));
    }
  }

  // ---------- R4: fragmentation ----------
  {
    const smallDead = activeGroups.filter((g) => g.spend < T.R4_SMALL_SPEND && g.results === 0);
    const lowBudget = activeGroups.filter(
      (g) => g.daily_budget_min !== null && g.daily_budget_min < T.R4_LOW_DAILY_BUDGET,
    );
    const fragRatioHit = activeGroups.length >= T.R4_MIN_ADSETS &&
      smallDead.length >= T.R4_FRAG_RATIO * activeGroups.length;
    const budgetHit = lowBudget.length >= T.R4_MIN_LOW_BUDGET_SETS;
    if (fragRatioHit || budgetHit) {
      const fragSpend = smallDead.reduce((s, g) => s + g.spend, 0);
      hit("R4", "__account__", "medium",
        { active_ad_sets: activeGroups.length, small_zero_result_sets: smallDead.length, fragmented_spend: round2(fragSpend) },
        round2(fragSpend * T.R4_WASTE_RATIO));
      // The fragmented sets themselves are the applies_to of R4.
      for (const g of smallDead) {
        hits.push({ rule_id: "R4_MEMBER", group_key: g.key, severity: "low", evidence: {}, waste_raw: null });
      }
    }
  }

  // ---------- R5: no conversion tracking ----------
  if (totalResults === 0 && S >= T.R5_MIN_SPEND) {
    hit("R5", "__account__", "high", { total_spend: round2(S), total_results: 0, total_clicks: totalClicks }, null);
  }

  // ---------- R6: single-ad fatigue / concentration with bad CPA (ad level; at ad-set level the key is the set) ----------
  for (const g of groups) {
    const freqHit = g.frequency !== null && g.frequency >= T.R6_FREQ && g.ctr !== null && g.ctr <= T.R6_CTR_MAX;
    const shareHit = S > 0 && g.spend / S >= T.R6_SHARE && avgCpa !== null && g.cpa !== null && g.cpa > avgCpa;
    if (freqHit || shareHit) {
      hit("R6", g.key, "medium",
        { spend: round2(g.spend), frequency: g.frequency ? round2(g.frequency) : "n/a", spend_share_pct: round2((g.spend / S) * 100) },
        round2(g.spend * T.R6_WASTE_RATIO));
    }
  }

  // ---------- R7: top-1 concentration risk ----------
  if (groups.length > 0 && S > 0) {
    const top = [...groups].sort((a, b) => b.spend - a.spend)[0];
    if (top.spend / S >= T.R7_SHARE) {
      hit("R7", top.key, "low", { spend: round2(top.spend), spend_share_pct: round2((top.spend / S) * 100) }, null);
    }
  }

  // ---------- R8: audience overlap heuristic (low confidence by design) ----------
  {
    const byCampaign = new Map<string, AdRow[]>();
    for (const r of rows) {
      if (!byCampaign.has(r.campaign_name)) byCampaign.set(r.campaign_name, []);
      byCampaign.get(r.campaign_name)!.push(r);
    }
    for (const [campaign, crows] of byCampaign) {
      const sets = [...groupRows(crows, "adset").entries()].map(([k, rs]) => aggregateGroup(k, rs))
        .filter((g) => g.spend > 0 && g.frequency !== null && g.frequency >= T.R8_FREQ);
      if (sets.length < T.R8_MIN_SETS_PER_CAMPAIGN) continue;
      const cpms = sets
        .map((g) => (g.impressions > 0 ? (g.spend / g.impressions) * 1000 : null))
        .filter((v): v is number => v !== null);
      if (cpms.length < T.R8_MIN_SETS_PER_CAMPAIGN) continue;
      const min = Math.min(...cpms), max = Math.max(...cpms);
      const mid = (min + max) / 2;
      if (mid > 0 && (max - min) / mid < T.R8_CPM_SPREAD) {
        hit("R8", "__account__", "low",
          { campaign, ad_sets: sets.length, cpm_min: round2(min), cpm_max: round2(max) }, null);
      }
    }
  }

  // ---------- R9: cheap-traffic trap ----------
  if (medianCpc !== null) {
    for (const g of groups) {
      if (
        g.cpc !== null && g.cpc <= T.R9_CPC_RATIO * medianCpc &&
        totalImpressions > 0 && g.impressions / totalImpressions >= T.R9_IMPRESSION_SHARE &&
        g.results === 0
      ) {
        hit("R9", g.key, "medium",
          { spend: round2(g.spend), cpc: round2(g.cpc), median_cpc: round2(medianCpc), impressions: g.impressions },
          g.spend);
      }
    }
  }

  // ---------- R10: starved of conversions ----------
  for (const g of groups) {
    if (g.results >= 1 && g.results <= T.R10_MAX_RESULTS && g.spend >= T.R10_MIN_SPEND) {
      hit("R10", g.key, "low", { spend: round2(g.spend), results: g.results }, null);
    }
  }

  // ---------- R11: CTR collapse ----------
  for (const g of groups) {
    if (g.ctr !== null && g.ctr <= T.R11_CTR_MAX && g.impressions >= T.R11_MIN_IMPRESSIONS && g.spend >= T.R11_MIN_SPEND) {
      hit("R11", g.key, "medium",
        { spend: round2(g.spend), ctr_pct: round2(g.ctr), impressions: g.impressions },
        round2(g.spend * T.R11_WASTE_RATIO));
    }
  }

  // ---------- R12: account-wide alarm (pinned, no deduction, no waste) ----------
  const r12NoResults = totalResults === 0 && S >= T.R12_MIN_SPEND_NO_RESULTS;
  const r12Cpa = CPA_t !== null && avgCpa !== null && avgCpa >= T.R12_CPA_MULT * CPA_t;
  if (r12NoResults || r12Cpa) {
    hit("R12", "__account__", "high",
      { total_spend: round2(S), total_results: totalResults, avg_cpa: avgCpa ? round2(avgCpa) : "n/a" }, null);
  }

  // ============ De-duplication: group waste owned by largest single estimate ============
  const groupOwnedWaste = new Map<string, { rule_id: string; waste: number }>();
  for (const h of hits) {
    if (h.waste_raw === null || h.group_key === "__account__") continue;
    const cur = groupOwnedWaste.get(h.group_key);
    if (!cur || h.waste_raw > cur.waste) groupOwnedWaste.set(h.group_key, { rule_id: h.rule_id, waste: h.waste_raw });
  }
  // R4's waste derives from its member sets; remove the part already owned by
  // another rule on those same sets so it is never counted twice.
  const r4Hit = hits.find((h) => h.rule_id === "R4");
  let r4AdjustedWaste: number | null = null;
  if (r4Hit && r4Hit.waste_raw !== null) {
    const memberKeys = hits.filter((h) => h.rule_id === "R4_MEMBER").map((h) => h.group_key);
    const memberSpendTotal = memberKeys.reduce(
      (s, k) => s + (groups.find((g) => g.key === k)?.spend ?? 0), 0);
    const ownedElsewhere = memberKeys.reduce((s, k) => {
      const o = groupOwnedWaste.get(k);
      return s + (o && o.rule_id !== "R4" ? Math.min(o.waste, groups.find((g) => g.key === k)?.spend ?? 0) : 0);
    }, 0);
    r4AdjustedWaste = Math.max(0, round2(Math.min(r4Hit.waste_raw, memberSpendTotal * T.R4_WASTE_RATIO - ownedElsewhere * T.R4_WASTE_RATIO)));
  }

  // ============ Aggregate hits into per-rule findings ============
  const byRule = new Map<string, RuleHit[]>();
  for (const h of hits) {
    if (h.rule_id === "R4_MEMBER") continue;
    if (!byRule.has(h.rule_id)) byRule.set(h.rule_id, []);
    byRule.get(h.rule_id)!.push(h);
  }

  const findings: Finding[] = [];
  for (const [ruleId, ruleHits] of byRule) {
    const applies = [...new Set(ruleHits.map((h) => h.group_key).filter((k) => k !== "__account__"))];
    if (ruleId === "R4") {
      applies.push(...hits.filter((h) => h.rule_id === "R4_MEMBER").map((h) => h.group_key));
    }
    let waste: number | null = null;
    let wasteNote: string | null = null;
    if (ruleId === "R4") {
      waste = r4AdjustedWaste;
      if (waste !== null && r4Hit && r4Hit.waste_raw !== null && waste < r4Hit.waste_raw) {
        wasteNote = "Reduced to avoid double-counting ad sets already counted above.";
      }
    } else if (ruleId === "R5" || ruleId === "R7" || ruleId === "R8" || ruleId === "R10" || ruleId === "R12") {
      waste = null;
    } else {
      let sum = 0;
      let anyRaw = false;
      for (const h of ruleHits) {
        if (h.waste_raw === null) continue;
        anyRaw = true;
        const owner = groupOwnedWaste.get(h.group_key);
        if (owner && owner.rule_id === ruleId) sum += h.waste_raw;
      }
      waste = anyRaw ? round2(sum) : null;
      if (anyRaw && waste === 0) {
        wasteNote = "Already counted in another issue for the same ad set — we never count the same dollars twice.";
      }
    }

    const severity = ruleHits.some((h) => h.severity === "high")
      ? "high"
      : ruleHits.some((h) => h.severity === "medium") ? "medium" : "low";

    findings.push({
      rule_id: ruleId,
      severity,
      title: buildTitle(ruleId, ruleHits, applies, level),
      preview_title: PREVIEW_TITLES[ruleId] ?? ruleId,
      evidence_text: buildEvidence(ruleId, ruleHits),
      waste_usd: waste,
      waste_note: wasteNote,
      fix_key: ruleId,
      applies_to: applies,
      note: ruleId === "R8"
        ? "Likely overlap — CSV data can't confirm targeting overlap; check the Audience Overlap tool in Ads Manager."
        : ruleId === "R5"
          ? "Tracking issue — no waste estimated for this item."
          : null,
      pin_top: ruleId === "R12",
      score_deduction: 0, // filled below
    });
  }

  // ============ Health score (PRD F5) ============
  let totalDeduction = 0;
  for (const f of findings) {
    const cap = SCORE_CAPS[f.rule_id] ?? 0;
    let d: number;
    if (cap === 0) d = 0;
    else if (f.waste_usd !== null && S > 0) {
      d = Math.min(cap, SCORE_FORMULA.BASE + (f.waste_usd / S) * SCORE_FORMULA.COEF);
    } else {
      d = cap * SCORE_FORMULA.NO_WASTE_FRACTION;
    }
    f.score_deduction = round2(d);
    totalDeduction += d;
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  const grade = score >= 80 ? "Healthy" : score >= 60 ? "Needs work" : score >= 40 ? "Wasteful" : "Critical";

  const totalWaste = round2(findings.reduce((s, f) => s + (f.waste_usd ?? 0), 0));

  // Sort: pinned first, then severity, then waste desc.
  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) =>
    Number(b.pin_top) - Number(a.pin_top) ||
    sevRank[a.severity] - sevRank[b.severity] ||
    (b.waste_usd ?? 0) - (a.waste_usd ?? 0),
  );

  const topPerformers = groups
    .filter((g) => g.results > 0 && g.cpa !== null)
    .sort((a, b) => (a.cpa ?? Infinity) - (b.cpa ?? Infinity))
    .slice(0, 3)
    .map((g) => ({ name: g.key, spend: round2(g.spend), results: g.results, cpa: round2(g.cpa!) }));

  const aggregates: Aggregates = {
    total_spend: round2(S),
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_results: totalResults,
    avg_cpa: avgCpa !== null ? round2(avgCpa) : null,
    median_ctr: medianCtr !== null ? round2(medianCtr) : null,
    median_cpc: medianCpc !== null ? round2(medianCpc) : null,
    row_count: rows.length,
    adset_count: new Set(rows.map((r) => r.adset_name)).size,
    campaign_count: new Set(rows.map((r) => r.campaign_name)).size,
    top_performers: topPerformers,
  };

  return {
    aggregates,
    findings,
    health_score: score,
    grade: grade as AuditResult["grade"],
    total_waste: totalWaste,
    issue_count: findings.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildTitle(ruleId: string, ruleHits: RuleHit[], applies: string[], level: Level): string {
  const unit = level === "ad" ? "ad" : "ad set";
  const n = applies.length;
  const sumSpend = ruleHits.reduce((s, h) => s + (typeof h.evidence.spend === "number" ? h.evidence.spend : 0), 0);
  switch (ruleId) {
    case "R1":
      return `${n} ${unit}${n === 1 ? "" : "s"} spent $${money(sumSpend)} with zero conversions`;
    case "R2":
      return `${n} ${unit}${n === 1 ? "" : "s"} paying 2x+ the benchmark cost per result`;
    case "R3": {
      const maxFreq = Math.max(...ruleHits.map((h) => (typeof h.evidence.frequency === "number" ? h.evidence.frequency : 0)));
      return `Frequency hit ${maxFreq.toFixed(1)} — the same people are seeing these ads on loop`;
    }
    case "R4":
      return "Budget fragmented across too many small, unproductive ad sets";
    case "R5":
      return "No conversion tracking detected — Results are zero across the whole account";
    case "R6":
      return `${n} ${unit}${n === 1 ? "" : "s"} over-exposed and under-performing`;
    case "R7":
      return `One ${unit} carries ${ruleHits[0]?.evidence.spend_share_pct ?? ""}% of the entire account's spend`;
    case "R8":
      return "Ad sets in the same campaign look like they're bidding against each other";
    case "R9":
      return "Suspiciously cheap clicks that never convert";
    case "R10":
      return `${n} ad set${n === 1 ? "" : "s"} starved of conversions — too little data to optimize`;
    case "R11":
      return `${n} ad set${n === 1 ? "" : "s"} with a collapsed click rate`;
    case "R12":
      return "Account-wide alarm: spending with no (or extremely expensive) results";
    default:
      return PREVIEW_TITLES[ruleId] ?? ruleId;
  }
}

function buildEvidence(ruleId: string, ruleHits: RuleHit[]): string {
  const parts: string[] = [];
  for (const h of ruleHits.slice(0, 12)) {
    const e = h.evidence;
    const label = h.group_key === "__account__" ? "Account" : `"${h.group_key}"`;
    const bits = Object.entries(e)
      .filter(([k]) => k !== "campaign")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" ? num(v) : v}`);
    parts.push(`${label} — ${bits.join(" · ")}`);
  }
  if (ruleHits.length > 12) parts.push(`…and ${ruleHits.length - 12} more`);
  return parts.join(" | ");
}
