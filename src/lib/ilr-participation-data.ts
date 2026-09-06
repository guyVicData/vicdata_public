// Turns raw ILR-participation facts (vicdata ingest repo, 2026-08-22) into a simple
// display snapshot for the "FE participation" cards on the State of the School page.
// Originally built for `dfe_fe_participation_academy` alone; confirmed 2026-09-12 (real
// rows, urn 130408/130401) that `dfe_fe_participation` (genuine FE-sector under-19) and
// `dfe_fe_participation_adult` (19+) share the exact same total/male/female breakdown
// shape one age-segment prefix apart, so this same builder now serves all three sources
// via the `ageSegment` parameter -- not a near-duplicate per source. Deliberately NOT
// reusing roll-data.ts's RollSnapshot type or buildRollSnapshot logic, and deliberately
// not extending AGE_BREAKDOWN_RE to match this source's breakdown shape -- this is a
// genuinely different measure (ILR participation over the academic year, not a
// census-day headcount) from a genuinely different source (dfe_fe_participation*, not
// dfe_school_census). Keeping the builder and type fully separate from roll-data.ts is
// deliberate: see docs/OPEN_QUESTIONS.md in the vicdata ingest repo (2026-08-21/22) for
// the population-conflation mistake (dfe_fe_participation's original under-19/19+/Total
// mixing bug) that separation exists to avoid repeating -- the under-19 and 19+ segments
// stay two distinct snapshots here too, never summed into one number by this module or
// its callers.
//
// Real, honest scope, confirmed against actual rows before this was built: total +
// male/female split ONLY. No age-band breakdown, no boarding data exist in the source
// file at all -- there is nothing here to build an age table or boarding split from, by
// design, not by omission.

import type { ReferenceFact } from "./vicdata-reference";

// Only education_and_training is ever meaningfully populated for this institution
// population (apprenticeships/tailored_learning suppressed, community_learning not
// applicable -- confirmed against real rows before this module was written). Hardcoded
// here deliberately, not a loop over provision types -- this card shows one figure, the
// one that's actually the closest analogue to a roll.
//
// 2026-09-12, FE-sector build: generalised from a single hardcoded under-19 regex to a
// per-segment lookup -- dfe_fe_participation_adult's real rows (confirmed live, City
// Lit/urn 130401 and Ealing Hammersmith & West London College/urn 130408) carry the
// exact same total/male/female shape one age segment over (education_and_training_
// 19_plus_*, not _under_19_*), not the total-only shape this module originally assumed
// before that source was checked. Same parsing logic either way -- only the breakdown
// prefix differs -- so this stays one function with a segment switch, not two
// near-duplicates.
const AGE_SEGMENT_RE: Record<"under_19" | "19_plus", RegExp> = {
  under_19: /^education_and_training_under_19_(total|male|female)$/,
  "19_plus": /^education_and_training_19_plus_(total|male|female)$/,
};

// Exported so a batched caller (data-view-profiles.ts's FE fallback -- many URNs in
// one lookupReferenceData call) can request exactly the breakdowns it needs rather
// than fetching every breakdown this source has (apprenticeships/tailored_learning/
// community_learning are real but unused here, same "only education_and_training is
// ever meaningfully populated for this institution population" reasoning as above).
export const AGE_SEGMENT_BREAKDOWNS: Record<"under_19" | "19_plus", string[]> = {
  under_19: ["education_and_training_under_19_total", "education_and_training_under_19_male", "education_and_training_under_19_female"],
  "19_plus": ["education_and_training_19_plus_total", "education_and_training_19_plus_male", "education_and_training_19_plus_female"],
};

export type IlrParticipationSnapshot = {
  period: number;
  total: number;
  male: number | null;
  female: number | null;
};

export function buildIlrParticipationSnapshot(
  facts: ReferenceFact[],
  ageSegment: "under_19" | "19_plus" = "under_19",
): IlrParticipationSnapshot | null {
  const breakdownRe = AGE_SEGMENT_RE[ageSegment];
  // Newest period first, same "skip a genuinely zero/absent period" discipline as
  // buildRollSnapshot -- in practice this source never writes a real zero (suppressed
  // values are dropped at ingest, not written as 0), so this is mostly defensive
  // symmetry with the census-side builder, not something expected to trigger often.
  const periodsDesc = Array.from(new Set(facts.map((f) => f.period))).sort((a, b) => b - a);

  for (const period of periodsDesc) {
    let total: number | null = null;
    let male: number | null = null;
    let female: number | null = null;

    for (const fact of facts) {
      if (fact.period !== period) continue;
      const match = breakdownRe.exec(fact.breakdown);
      if (!match || fact.value_numeric === null) continue;
      if (match[1] === "total") total = fact.value_numeric;
      else if (match[1] === "male") male = fact.value_numeric;
      else female = fact.value_numeric;
    }

    if (total === null || total === 0) continue;

    return { period, total, male, female };
  }

  return null;
}
