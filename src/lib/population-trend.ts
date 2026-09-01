// Population trend classification (dashboard rebuild, Shape card's "population
// trend in the area" piece) -- built from a real, multi-round investigation, logged
// in full in docs/OPEN_QUESTIONS.md (2026-08-28). Summary of what's real here, not
// guessed:
//  - Metric: (age15 - age5) / age15, both LA and region, straight from
//    age_profile_aggregates (real DfE census single-year-age school enrolment, same
//    undercount-vs-true-population limitation as every other census figure on this
//    page -- an accepted, already-precedented limitation, not a new problem).
//  - Denominator is age15 (the real, older baseline cohort), not age5 -- confirmed
//    this is not cosmetic: using age5 instead moved 17 of 153 LAs across a tier
//    boundary, including Surrey (a real worked example, Steep Decline -> Decline).
//  - Bands are real, absolute, zero-anchored cut points -- NOT percentile rank
//    against other LAs (a tercile/percentile approach was tried and explicitly
//    rejected: it would force a third of LAs into "Growing" even under uniform
//    national decline, which is the wrong behaviour for a literal, plain-language
//    label). Growing/Stable boundary (0%, then 2%) and the Decline/Steep/Severe
//    breakpoints (15%, 25%) were each checked against the real distribution shape
//    (histogram) before being fixed, not chosen blind.
//  - Reliability floor: age5 >= 100 excludes only Isles of Scilly (1 school) from
//    153 LAs -- protects the tiniest cases without hiding real small-but-genuine
//    areas (City of London, Rutland stay in, both real and structurally explicable).
export type PopulationTrendTier = "growing" | "stable" | "decline" | "steep_decline" | "severe_decline";

export const POPULATION_TREND_LABELS: Record<PopulationTrendTier, string> = {
  growing: "Growing",
  stable: "Stable",
  decline: "Decline",
  steep_decline: "Steep Decline",
  severe_decline: "Severe Decline",
};

const RELIABILITY_FLOOR_AGE5 = 100;

export type PopulationTrend = {
  tier: PopulationTrendTier;
  pct: number; // (age15 - age5) / age15 * 100 -- can be negative (Growing)
  age5: number;
  age15: number;
};

export function classifyPopulationTrend(tierPct: number): PopulationTrendTier {
  if (tierPct < 0) return "growing";
  if (tierPct <= 2) return "stable";
  if (tierPct <= 15) return "decline";
  if (tierPct <= 25) return "steep_decline";
  return "severe_decline";
}

export function computePopulationTrend(byAge: Record<string, number>): PopulationTrend | null {
  const age5 = byAge["5"] ?? 0;
  const age15 = byAge["15"] ?? 0;
  if (age5 < RELIABILITY_FLOOR_AGE5 || age15 <= 0) return null;
  const pct = ((age15 - age5) / age15) * 100;
  return { tier: classifyPopulationTrend(pct), pct, age5, age15 };
}

export type AgeProfileSeries = { age: number; total: number }[];

// Display-only sign flip (narrative generator v2, round 3, Guy's decision,
// 2026-08-31): the metric itself is positive for decline (a "how much smaller is
// the young cohort" measure) -- a real, deliberate technical definition, unchanged
// here. But a reader expects positive = growth, the near-universal convention
// (finance, weather, any signed percentage seen before). Negate ONLY at render time,
// in every place this pct is shown to a user -- currently PopulationTrendSection.tsx
// and the narrative generator's Paragraph 4 -- so the same real value never reads
// with opposite signs in two places on the platform. classifyPopulationTrend() and
// its tier boundaries above are untouched; they still classify on the real,
// un-negated metric.
export function displayPopulationTrendPct(pct: number): number {
  return -pct;
}

export function ageProfileSeries(byAge: Record<string, number>): AgeProfileSeries {
  const series: AgeProfileSeries = [];
  for (let age = 15; age >= 5; age--) series.push({ age, total: byAge[String(age)] ?? 0 });
  return series;
}
