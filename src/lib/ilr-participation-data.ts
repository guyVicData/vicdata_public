// Turns raw `dfe_fe_participation_academy` facts (vicdata ingest repo, 2026-08-22) into
// a simple display snapshot for the "FE participation data (ILR)" card on the State of
// the School page. Deliberately NOT reusing roll-data.ts's RollSnapshot type or
// buildRollSnapshot logic, and deliberately not extending AGE_BREAKDOWN_RE to match this
// source's breakdown shape -- this is a genuinely different measure (ILR participation
// over the academic year, not a census-day headcount) from a genuinely different source
// (dfe_fe_participation_academy, not dfe_school_census). Keeping the builder and type
// fully separate is deliberate: see docs/OPEN_QUESTIONS.md in the vicdata ingest repo
// (2026-08-21/22) for the population-conflation mistake (dfe_fe_participation's original
// under-19/19+/Total mixing bug) this separation exists to avoid repeating.
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
const BREAKDOWN_RE = /^education_and_training_under_19_(total|male|female)$/;

export type IlrParticipationSnapshot = {
  period: number;
  total: number;
  male: number | null;
  female: number | null;
};

export function buildIlrParticipationSnapshot(
  facts: ReferenceFact[],
): IlrParticipationSnapshot | null {
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
      const match = BREAKDOWN_RE.exec(fact.breakdown);
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
