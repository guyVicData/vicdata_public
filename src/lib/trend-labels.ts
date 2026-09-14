// Round 3 (Academic Map edit 2), A4: ONE shared source of truth for growth/decline
// wording, read by both Rolls' own GraphsView.tsx (which previously hardcoded its own
// inline adjective form -- "Growing"/"Declining"/"Broadly stable") and Academic's new
// Map popups/Rankings tiles (which need a NOUN form -- "Growth"/"Decline"/"No change",
// per Guy's own worked examples: "Decline -25pp", "Decline -15%"). Two real forms in
// one module, not two separately-maintained string sets that can silently drift.
//
// Keyed on trendBadge()'s own real `direction` values (data-view-cards.ts) -- "up"/
// "down"/"flat" -- so every existing caller of trendBadge already has the right key
// with no extra mapping step.
export type TrendDirection = "up" | "down" | "flat";

export const TREND_LABELS: Record<TrendDirection, { noun: string; adjective: string }> = {
  up: { noun: "Growth", adjective: "Growing" },
  down: { noun: "Decline", adjective: "Declining" },
  flat: { noun: "No change", adjective: "Broadly stable" },
};

// Map colour/scale bug round, item 4: a genuinely SEPARATE 7-tier scheme, absolute
// percentage-POINT based, for the specific call sites where the number shown next to
// the word really is a raw pp difference (trendMagnitudeFor's own "pp" unit branch --
// currently KS2's headline trend only). Real design call, named here rather than
// silently resolved: this does NOT extend/replace TREND_LABELS or TrendDirection in
// place -- doing so would force every existing 3-tier consumer (Rolls' own
// GraphsView.tsx TrendStatement, Academic's own entries-trend caption, both
// genuinely ratio-based, no natural "point" unit) onto a 7-tier vocabulary they were
// never designed for and don't need. Same "separate tier type + separate label map"
// shape this codebase already established for population-trend.ts's own
// PopulationTrendTier/POPULATION_TREND_LABELS/classifyPopulationTrend -- followed
// directly rather than inventing a new pattern. Only ever read where the value being
// classified is confirmed pp-shaped (see trendWordingFor below); callers must not
// reach for PP_TREND_LABELS off a ratio pctChange.
export type PpTrendTier = "no_change" | "small_growth" | "growth" | "steep_growth" | "small_decline" | "decline" | "steep_decline";

export const PP_TREND_LABELS: Record<PpTrendTier, string> = {
  no_change: "No change",
  small_growth: "Small growth",
  growth: "Growth",
  steep_growth: "Steep growth",
  small_decline: "Small decline",
  decline: "Decline",
  steep_decline: "Steep decline",
};

// Guy's own absolute, symmetric spec: 0-1pp no change, 2-5pp small growth/decline,
// 6-15pp growth/decline, 16pp+ steep growth/decline -- no gap or overlap between
// tiers. Classified on the ROUNDED whole-pp value (same rounding `toFixed(0)` already
// applies to the number actually shown on screen), not the raw float -- otherwise a
// value like 1.6pp could round to a DISPLAYED "+2pp" while still being classified
// against the raw 1.6 as "no change," a visible mismatch of exactly the kind this
// fix exists to remove. A real, deliberate rounding choice, not an oversight.
export function classifyPpTrend(pp: number): PpTrendTier {
  const rounded = Math.round(pp);
  const magnitude = Math.abs(rounded);
  if (magnitude <= 1) return "no_change";
  const band = magnitude <= 5 ? "small" : magnitude <= 15 ? "mid" : "steep";
  const isGrowth = rounded > 0;
  if (band === "small") return isGrowth ? "small_growth" : "small_decline";
  if (band === "mid") return isGrowth ? "growth" : "decline";
  return isGrowth ? "steep_growth" : "steep_decline";
}
