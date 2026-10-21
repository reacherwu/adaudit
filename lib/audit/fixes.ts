/**
 * Fix checklist templates per rule (PRD F6 section 4).
 * Used two ways: as structured context for the LLM narrative, and verbatim
 * in the deterministic template-fallback report. {name} is replaced with the
 * top offending group name when the finding is rendered.
 */

import type { FixItem } from "./types";

export interface FixTemplate {
  priority: FixItem["priority"];
  group_label: FixItem["group_label"];
  action: string;
  path: string;
  expected: string;
}

export const FIX_TEMPLATES: Record<string, FixTemplate> = {
  R1: {
    priority: "P0",
    group_label: "This week",
    action: "Pause or fix the zero-conversion ad sets, starting with {name}",
    path: "Ads Manager → Ad sets → select the ad set → toggle off (or fix its conversion event first)",
    expected: "Stops the spend that produced no results at all; budget is freed for ad sets that convert.",
  },
  R2: {
    priority: "P0",
    group_label: "This week",
    action: "Cut budget on the ad sets paying 2x+ per result, starting with {name} — or narrow their audience",
    path: "Ads Manager → Ad sets → Edit → lower daily budget / tighten targeting",
    expected: "Brings cost per result back toward the account average instead of subsidising the most expensive conversions.",
  },
  R3: {
    priority: "P0",
    group_label: "This week",
    action: "Refresh creative or widen the audience for the fatigued ad sets, starting with {name}",
    path: "Ads Manager → Ads → duplicate the ad with new creative, or Ad sets → Edit audience to widen it",
    expected: "Frequency drops back under ~4 and CTR recovers as people stop seeing the same ad on loop.",
  },
  R4: {
    priority: "P1",
    group_label: "This month",
    action: "Consolidate the small, zero-result ad sets into fewer, better-funded ones",
    path: "Ads Manager → Ad sets → pause the fragments → move their budget into the 2–3 strongest sets",
    expected: "Each surviving ad set gets enough conversions for delivery to stabilise instead of starving.",
  },
  R5: {
    priority: "P0",
    group_label: "This week",
    action: "Set up conversion tracking before spending another dollar: install the Meta Pixel / Conversions API and define a Results event",
    path: "Events Manager → Connect data source → Web → follow the setup, then verify test events",
    expected: "Results stop reading zero, so every future decision is based on sales instead of clicks.",
  },
  R6: {
    priority: "P1",
    group_label: "This month",
    action: "Rotate in fresh creative for the over-exposed ad {name} and cap its share of spend",
    path: "Ads Manager → Ads → create 2–3 variants → spread budget across them",
    expected: "No single tired ad carries the account; CTR decay slows.",
  },
  R7: {
    priority: "P2",
    group_label: "Later",
    action: "Reduce single-ad dependency: build 2–3 backup ads so one ad isn't carrying 80%+ of spend",
    path: "Ads Manager → Ads → duplicate the winner with varied hooks/formats",
    expected: "If the top ad fatigues or gets disapproved, the account keeps delivering.",
  },
  R8: {
    priority: "P1",
    group_label: "This month",
    action: "Check for audience overlap between the ad sets in the flagged campaign and merge or exclude where they collide",
    path: "Ads Manager → select the ad sets → Audience Overlap tool; then Ad sets → Edit → exclude the other set's audience",
    expected: "Your own ad sets stop bidding against each other for the same people.",
  },
  R9: {
    priority: "P0",
    group_label: "This week",
    action: "Investigate the suspiciously cheap traffic in {name} — restrict placements (drop Audience Network) and tighten geography",
    path: "Ads Manager → Ad sets → Edit → Placements → Manual placements; and check location targeting",
    expected: "Cheap non-converting clicks stop eating the budget.",
  },
  R10: {
    priority: "P1",
    group_label: "This month",
    action: "Give the starved ad sets enough conversion volume to learn: merge similar sets or raise their budgets",
    path: "Ads Manager → Ad sets → consolidate audiences / raise daily budget toward 10x your target CPA per week",
    expected: "Delivery exits the limited-learning state and cost per result stabilises.",
  },
  R11: {
    priority: "P1",
    group_label: "This month",
    action: "Rewrite or replace the ads nobody clicks, starting with {name} — new hook, new first 3 seconds / headline",
    path: "Ads Manager → Ads → edit creative, or pause and launch a fresh variant",
    expected: "CTR climbs out of the sub-0.3% zone, which also lowers your effective CPM.",
  },
  R12: {
    priority: "P0",
    group_label: "This week",
    action: "Stop and diagnose before spending more: the account is producing no (or extremely expensive) results overall",
    path: "Events Manager (check tracking) → Ads Manager (check campaign objectives) → then re-run this audit",
    expected: "You find the root cause — tracking, objective or offer — instead of funding it another month.",
  },
};

/** Number-free titles used in the free preview for locked findings (PRD F7/DESIGN §7.3). */
export const PREVIEW_TITLES: Record<string, string> = {
  R1: "Ad sets spending with zero conversions",
  R2: "Ad sets paying far too much per result",
  R3: "Audiences seeing the same ads too many times",
  R4: "Budget spread across too many small ad sets",
  R5: "No conversion tracking detected",
  R6: "A single ad is over-exposed",
  R7: "Too much spend riding on one ad",
  R8: "Possible audience overlap between ad sets",
  R9: "Suspiciously cheap traffic that never converts",
  R10: "Ad sets starved of conversion volume",
  R11: "Ads with a collapsed click rate",
  R12: "The account overall is spending without results",
};
