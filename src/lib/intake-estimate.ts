// Cohort-progression intake-size estimator (rolls spec §7). Feeds Feeder Set's
// target-count scaling (§5) and the numerator of market share (§3).
//
// Method, directly from the spec: track a specific age cohort across consecutive
// census years; growth beyond what natural year-on-year continuity would predict is
// the net external intake at that transition (e.g. 85 ten-year-olds -> 140
// eleven-year-olds a year later implies ~55 external joiners).
//
// Status per the spec itself: "not yet built or validated -- this is new engineering,
// not a data check." Everything below is a first defensible implementation, not a
// calibrated one -- see docs/OPEN_QUESTIONS.md for the specific judgment calls made
// here, which is exactly the discipline that entry asks for.

import type { ReferenceFact } from "./vicdata-reference";
import { singleAgeCountsByPeriod } from "./roll-data";

export type EntryPoint = "y7" | "sixth_form";

// Age each entry point's pupils are counted at in DfE census's single-year-of-age
// breakdown. Standard UK convention (Y7 starts the September after a child turns 11;
// most of the Y7 cohort is captured under DfE's "aged 11" category at the January
// census date; sixth form/Y12 similarly falls mostly under "aged 16"). A judgment
// call, not spec-specified -- logged in OPEN_QUESTIONS.md.
const ENTRY_POINT_AGE: Record<EntryPoint, number> = {
  y7: 11,
  sixth_form: 16,
};

export type IntakeEstimate = {
  entryPoint: EntryPoint;
  // One estimate per available consecutive-year transition, oldest first.
  yearlyEstimates: { toPeriod: number; estimate: number }[];
  // Presented as a range, not a point estimate -- rolls spec §7: "consistent with the
  // roadmap's existing 'ranges not point estimates' honesty principle."
  rangeLow: number;
  rangeHigh: number;
  mostRecent: number | null;
};

/**
 * Estimates net external intake at one entry point across every consecutive-year
 * transition the data supports, using single-year-of-age headcounts.
 *
 * Judgment calls (see docs/OPEN_QUESTIONS.md for the full reasoning, not repeated
 * here as inline noise):
 * - Only uses transitions where BOTH years have a genuinely non-zero count at the
 *   relevant ages (same zero-quirk guard as buildRollSnapshot/buildRollTrend --
 *   Reigate College's all-zero year would otherwise produce a nonsense "full cohort
 *   is new intake" estimate).
 * - Returns the raw signal, negative values included (net attrition at that
 *   transition is real information, not something to hide) -- callers that need a
 *   non-negative number for their own purposes (e.g. a search radius) clip
 *   separately, deliberately not done here.
 */
export function estimateIntake(
  facts: ReferenceFact[],
  entryPoint: EntryPoint,
): IntakeEstimate {
  const age = ENTRY_POINT_AGE[entryPoint];
  const byPeriod = singleAgeCountsByPeriod(facts);
  const periodsAsc = Array.from(byPeriod.keys()).sort((a, b) => a - b);

  const yearlyEstimates: { toPeriod: number; estimate: number }[] = [];

  for (let i = 1; i < periodsAsc.length; i++) {
    const prevPeriod = periodsAsc[i - 1];
    const thisPeriod = periodsAsc[i];
    if (thisPeriod !== prevPeriod + 1) continue; // not actually consecutive years

    const prevCohort = byPeriod.get(prevPeriod)?.get(age - 1) ?? 0;
    const thisCohort = byPeriod.get(thisPeriod)?.get(age) ?? 0;
    if (prevCohort === 0 || thisCohort === 0) continue; // zero-quirk guard

    yearlyEstimates.push({ toPeriod: thisPeriod, estimate: thisCohort - prevCohort });
  }

  const values = yearlyEstimates.map((y) => y.estimate);
  const rangeLow = values.length ? Math.min(...values) : 0;
  const rangeHigh = values.length ? Math.max(...values) : 0;
  const mostRecent = values.length ? values[values.length - 1] : null;

  return { entryPoint, yearlyEstimates, rangeLow, rangeHigh, mostRecent };
}

// Feeder Set target-count scaling (rolls spec §5: "Target count scales with the
// receiving school's own intake size at that entry point"). The spec names the
// principle but not a formula -- this is a first, explicitly-unvalidated attempt,
// not a completion. See docs/OPEN_QUESTIONS.md.
const DEFAULT_TARGET_COUNT = 15; // fallback when no estimate is available at all
const MIN_TARGET_COUNT = 8;
const MAX_TARGET_COUNT = 40;

export function targetCountFromIntakeEstimate(estimate: IntakeEstimate): number {
  // Use the most recent single-year figure, floored at 0 -- a negative or zero
  // estimate (net attrition, or a school not really recruiting externally at this
  // entry point) doesn't mean "search for zero feeder schools," it means fall back to
  // the default net rather than propagate a nonsensical target count.
  const basis = estimate.mostRecent !== null ? Math.max(estimate.mostRecent, 0) : null;
  if (basis === null || basis === 0) return DEFAULT_TARGET_COUNT;

  // Rough starting multiplier: assume roughly 2 joining pupils per genuine feeder
  // school on average (most prep/primary schools send a handful, not a whole cohort,
  // to any one senior school), so target_count ~= intake / 2, run per sector (this
  // multiplier, unlike the age-to-entry-point mapping above, has no real-world basis
  // yet -- purely a starting point pending real feedback).
  const scaled = Math.round(basis / 2);
  return Math.min(Math.max(scaled, MIN_TARGET_COUNT), MAX_TARGET_COUNT);
}
