/**
 * Audit thresholds — PRD §5. Every number in the rules table lives here and
 * nowhere else, so tuning = editing this file. Values are the PRD v1 values.
 *
 * Changelog:
 * - 2026-10-21 v1: initial values transcribed from PRD §5.
 */

export const THRESHOLDS = {
  /** R1: zero-conversion big spender. spend >= max(R1_MIN_SPEND, R1_CPA_MULT x account avg CPA) and 0 results */
  R1_MIN_SPEND: 50,
  R1_CPA_MULT: 2,
  /** R2: CPA blowout. cost_per_result >= R2_CPA_MULT x (target CPA or account avg CPA), min results for sample */
  R2_CPA_MULT: 2,
  R2_MIN_RESULTS: 3,
  R3_FREQ_FLAG: 4,
  R3_FREQ_HIGH: 7,
  R3_WASTE_RATIO: 0.25,
  /** R4: fragmentation. >= R4_MIN_ADSETS active sets and >= R4_FRAG_RATIO of them small & zero-result */
  R4_MIN_ADSETS: 8,
  R4_FRAG_RATIO: 0.4,
  R4_SMALL_SPEND: 30,
  R4_LOW_DAILY_BUDGET: 5,
  R4_MIN_LOW_BUDGET_SETS: 3,
  R4_WASTE_RATIO: 0.5,
  /** R5: no conversion tracking. zero results account-wide and spend >= R5_MIN_SPEND */
  R5_MIN_SPEND: 100,
  /** R6: single-ad fatigue / over-concentration with bad CPA */
  R6_FREQ: 5,
  R6_CTR_MAX: 0.5,
  R6_SHARE: 0.6,
  R6_WASTE_RATIO: 0.2,
  /** R7: top-1 concentration risk */
  R7_SHARE: 0.8,
  /** R8: audience overlap heuristic, per campaign */
  R8_MIN_SETS_PER_CAMPAIGN: 3,
  R8_FREQ: 3,
  R8_CPM_SPREAD: 0.2,
  /** R9: cheap-traffic trap */
  R9_CPC_RATIO: 0.3,
  R9_IMPRESSION_SHARE: 0.2,
  /** R10: too few conversions to learn. results in [1..R10_MAX_RESULTS] and spend >= R10_MIN_SPEND */
  R10_MAX_RESULTS: 6,
  R10_MIN_SPEND: 100,
  /** R11: CTR collapse */
  R11_CTR_MAX: 0.3,
  R11_MIN_IMPRESSIONS: 10000,
  R11_MIN_SPEND: 30,
  R11_WASTE_RATIO: 0.3,
  /** R12: account-wide alarm */
  R12_MIN_SPEND_NO_RESULTS: 200,
  R12_CPA_MULT: 3,
} as const;

/** Max score deduction per rule (PRD §5 "扣分上限"). R12 deducts 0 by design. */
export const SCORE_CAPS: Record<string, number> = {
  R1: 15,
  R2: 12,
  R3: 10,
  R4: 8,
  R5: 15,
  R6: 8,
  R7: 4,
  R8: 5,
  R9: 8,
  R10: 5,
  R11: 6,
  R12: 0,
};

/**
 * Deduction formula (PRD F5): deduction = min(cap, BASE + wasteShare x COEF)
 * where wasteShare = rule waste / total spend. Rules without a waste amount
 * deduct NO_WASTE_FRACTION x cap (fixed heuristic share, still capped).
 */
export const SCORE_FORMULA = {
  BASE: 2,
  COEF: 40,
  NO_WASTE_FRACTION: 0.6,
} as const;

/** Upload / abuse limits (PRD §8). */
export const LIMITS = {
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  /** multipart overhead allowance on top of MAX_FILE_BYTES for the
   *  Content-Length pre-check (fields + boundaries), rejected pre-read */
  FORM_OVERHEAD_BYTES: 1 * 1024 * 1024,
  MAX_ROWS: 50000,
  MIN_ROWS: 3,
  FREE_AUDITS_PER_IP_PER_DAY: 3,
  FREE_AUDITS_PER_EMAIL_PER_DAY: 3,
  /** every upload attempt counts toward this cap, parse failures included */
  MAX_UPLOAD_ATTEMPTS_PER_IP_PER_DAY: 10,
  /** XLSX decompression-bomb guards, checked from the zip central
   *  directory BEFORE any XML is decompressed/parsed */
  MAX_XLSX_UNCOMPRESSED_BYTES: 64 * 1024 * 1024,
  MAX_XLSX_ENTRIES: 1000,
  LLM_DAILY_CALL_CAP: 200,
} as const;

/** DeepSeek pricing used for the per-audit cost estimate (USD per 1M tokens). */
export const DEEPSEEK_PRICING = {
  INPUT_PER_M: 0.27,
  OUTPUT_PER_M: 1.1,
} as const;

export const PRICE_USD = 49;
export const RECHECK_WINDOW_DAYS = 30;
export const REPORT_RETENTION_DAYS = 90;
