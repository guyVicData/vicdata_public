// Teacher view, Phase 8: "this moved" (design brief v2 §13).
//
// §13 wants a card to surface a real, meaningful year-on-year change automatically,
// "rather than waiting for someone to notice". The whole difficulty is the word
// meaningful: a threshold that fires for a third of schools every year is not a signal,
// it is wallpaper, and it would quietly undermine §14's "never a bare number" discipline
// by attaching an alarm to ordinary movement.
//
// So the thresholds below are measured from real national year-on-year variation
// (2023 -> 2024), not invented:
//
//   KS4 candidate numbers, 4,176 schools with 20+ pupils:
//     median absolute change  5.1%
//     p75 12.6%   p90 23.5%   p95 34.8%
//     a 10% rule would flag 1,318 schools (32%) -- far too noisy
//     a 20% rule flags 553 (13.2%)
//
//   KS4 headline result (Attainment 8), 4,493 schools:
//     median absolute change  1.80 points
//     p75 3.30   p90 5.30   p95 7.40
//     a 2-point rule would flag 2,102 schools (47%) -- wallpaper
//     a 5-point rule flags 512 (11.4%)
//
// Both thresholds therefore sit at roughly the 90th percentile of real movement: about
// one school in eight in a given year, which is the level at which "this moved" is worth
// a person's attention. They are constants rather than a live percentile calculation
// because a self-adjusting threshold would always flag exactly 10% of schools however
// calm or turbulent the year really was -- the opposite of what §13 is asking for.
//
// RECOMPUTE THESE when a new year of data lands, using the same two queries; they are a
// measurement of the data, not a preference.
export const CANDIDATE_CHANGE_THRESHOLD_PCT = 20;
export const ATTAINMENT8_CHANGE_THRESHOLD_POINTS = 5;

export type MovedFlag = {
  kind: "candidates" | "results";
  direction: "up" | "down";
  magnitude: string;
  sentence: string;
};

// §14: the flag is phrased as what actually happened, in the same voice as every heading
// -- not "ALERT" or a bare delta.
export function candidatesMoved(previous: number | null, latest: number | null, periodLabel: string): MovedFlag | null {
  if (previous === null || latest === null || previous <= 0) return null;
  const pct = ((latest - previous) / previous) * 100;
  if (Math.abs(pct) < CANDIDATE_CHANGE_THRESHOLD_PCT) return null;
  const direction = pct > 0 ? "up" : "down";
  return {
    kind: "candidates",
    direction,
    magnitude: `${pct > 0 ? "+" : ""}${Math.round(pct)}%`,
    sentence: `Candidate numbers are ${direction} ${Math.abs(Math.round(pct))}% on last year, in ${periodLabel}.`,
  };
}

export function resultsMoved(previous: number | null, latest: number | null, periodLabel: string): MovedFlag | null {
  if (previous === null || latest === null) return null;
  const delta = latest - previous;
  if (Math.abs(delta) < ATTAINMENT8_CHANGE_THRESHOLD_POINTS) return null;
  const direction = delta > 0 ? "up" : "down";
  return {
    kind: "results",
    direction,
    magnitude: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
    sentence: `The headline result is ${direction} ${Math.abs(delta).toFixed(1)} points on last year, in ${periodLabel}.`,
  };
}
