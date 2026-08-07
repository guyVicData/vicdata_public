// Turns raw DfE census breakdown facts (from vicdata-reference.ts) into the "current
// state" figures the State of the School page and rolls topic need. Headcount, not
// FTE-adjusted, at all age bands -- rolls spec §4's resolved rule.

import type { ReferenceFact } from "./vicdata-reference";

// Age-band boundaries: a reasonable, standard UK schooling-phase default -- not fixed
// by the spec (which specifies the age-band *axis* itself, not exact boundaries).
// Provisional, same discipline as the shape taxonomy itself (rolls spec §4) -- expected
// to move once run against more real school profiles.
export const AGE_BANDS = [
  { key: "early_years", label: "Early Years", minAge: 0, maxAge: 4 },
  { key: "primary", label: "Primary", minAge: 5, maxAge: 10 },
  { key: "secondary", label: "Secondary", minAge: 11, maxAge: 15 },
  { key: "sixth_form", label: "Sixth Form", minAge: 16, maxAge: 18 },
  { key: "nineteen_plus", label: "19+", minAge: 19, maxAge: 19 },
] as const;

export type AgeBandKey = (typeof AGE_BANDS)[number]["key"];

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;

function bandForAge(age: number): AgeBandKey | null {
  const band = AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
  return band ? band.key : null;
}

export function latestPeriod(facts: ReferenceFact[]): number | null {
  if (facts.length === 0) return null;
  return Math.max(...facts.map((f) => f.period));
}

export type RollSnapshot = {
  period: number;
  totalRoll: number;
  byAgeBand: { key: AgeBandKey; label: string; total: number }[];
  gender: { male: number; female: number; total: number; sumMatchesTotal: boolean };
  boarding: { boarders: number; day: number; total: number } | null;
};

export function buildRollSnapshot(
  facts: ReferenceFact[],
  urn: string,
): RollSnapshot | null {
  // Walk periods newest-first, not just the newest period present: confirmed for real
  // (Reigate College, a converted 16-19 academy, urn 145005) that a school can have
  // census rows for its most recent period that are ALL genuinely zero -- a real
  // source data-quality quirk for this institution type, not something ingest can fix
  // by re-parsing. Displaying "0 pupils" as if it were a real current-state fact would
  // be actively misleading, so this looks back for the most recent period with a real
  // non-zero total rather than trusting period recency alone.
  const periodsDesc = Array.from(new Set(facts.map((f) => f.period))).sort((a, b) => b - a);

  for (const period of periodsDesc) {
    const currentFacts = facts.filter((f) => f.period === period);

    const byBand = new Map<AgeBandKey, number>(AGE_BANDS.map((b) => [b.key, 0]));
    let male = 0;
    let female = 0;

    for (const fact of currentFacts) {
      const match = AGE_BREAKDOWN_RE.exec(fact.breakdown);
      if (!match || fact.value_numeric === null) continue;
      const [, , sex, ageStr] = match;
      const age = Number(ageStr);
      const band = bandForAge(age);
      if (!band) continue;
      byBand.set(band, (byBand.get(band) ?? 0) + fact.value_numeric);
      if (sex === "male") male += fact.value_numeric;
      else female += fact.value_numeric;
    }

    const totalRoll = male + female;
    if (totalRoll === 0) continue; // try the next-most-recent period instead

    return finishSnapshot(currentFacts, period, totalRoll, male, female, byBand, urn);
  }

  return null;
}

function finishSnapshot(
  currentFacts: ReferenceFact[],
  period: number,
  totalRoll: number,
  male: number,
  female: number,
  byBand: Map<AgeBandKey, number>,
  urn: string,
): RollSnapshot {

  // Single-sex-school gender-count suppression (rolls spec §8): documentation
  // discipline applies now -- log any arithmetic inconsistency, without a causal
  // hypothesis, per the child-protection design principle. The proportion-based
  // *display* suppression itself is a flagged to-do (rolls spec §8), not built here.
  const boardersFact = (sex: "male" | "female" | "total") =>
    currentFacts.find((f) => f.breakdown === `boarders_${sex}`)?.value_numeric ?? null;
  const boardersTotal = boardersFact("total");
  const boardersMale = boardersFact("male");
  const boardersFemale = boardersFact("female");

  let boarding: RollSnapshot["boarding"] = null;
  if (boardersTotal !== null) {
    if (
      boardersMale !== null &&
      boardersFemale !== null &&
      boardersMale + boardersFemale !== boardersTotal
    ) {
      // Trust total over summing the gender split (rolls spec §8's resolved rule for
      // Woldingham's known quirk) -- logged without a causal hypothesis, deliberately.
      console.warn(
        `[roll-data] urn=${urn} period=${period}: boarders_male + boarders_female ` +
          `(${boardersMale + boardersFemale}) != boarders_total (${boardersTotal}) -- ` +
          `unexplained source arithmetic inconsistency, trusting total.`,
      );
    }
    boarding = {
      boarders: boardersTotal,
      day: Math.max(totalRoll - boardersTotal, 0),
      total: totalRoll,
    };
  }

  const sumMatchesTotal = male + female === totalRoll; // always true by construction here,
  // kept as an explicit field so a future direct-total source (if ever added) can compare.

  return {
    period,
    totalRoll,
    byAgeBand: AGE_BANDS.map((b) => ({
      key: b.key,
      label: b.label,
      total: byBand.get(b.key) ?? 0,
    })),
    gender: { male, female, total: totalRoll, sumMatchesTotal },
    boarding,
  };
}
