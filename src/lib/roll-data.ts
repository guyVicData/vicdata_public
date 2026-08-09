// Turns raw DfE census breakdown facts (from vicdata-reference.ts) into the "current
// state" figures the State of the School page and rolls topic need. Headcount, not
// FTE-adjusted, at all age bands -- rolls spec §4's resolved rule.

import type { ReferenceFact } from "./vicdata-reference";

// Fallback census period for surrounding-schools lookups when the target school has
// no roll data of its own to read a period off (bug fix, "Public View rebuild": a
// standalone 6th-form/FE-corporation school like Worcester Sixth Form College has no
// DfE census roll data -- confirmed real, permanent gap -- so buildRollSnapshot
// returns null for it, but its surrounding-schools section still needs *some* period
// to query candidate schools' roll data at). Same year sync-roll-aggregates.ts
// targets for its own precomputed aggregates -- kept as one shared constant so the
// two can't drift apart.
export const CURRENT_CENSUS_PERIOD = 2025;

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

// Multi-year trend (rolls spec §3: "Roll trends (historical line, by age band)" etc.,
// paid tier). Same zero-period skip as buildRollSnapshot above -- a genuinely
// all-zero year (Reigate College's data quirk) is dropped from the trend line rather
// than plotted as a real dip to 0, which would misrepresent the source, not the school.
export function buildRollTrend(facts: ReferenceFact[], urn: string): RollSnapshot[] {
  const periodsAsc = Array.from(new Set(facts.map((f) => f.period))).sort((a, b) => a - b);
  const trend: RollSnapshot[] = [];

  for (const period of periodsAsc) {
    const currentFacts = facts.filter((f) => f.period === period);
    const byBand = new Map<AgeBandKey, number>(AGE_BANDS.map((b) => [b.key, 0]));
    let male = 0;
    let female = 0;

    for (const fact of currentFacts) {
      const match = AGE_BREAKDOWN_RE.exec(fact.breakdown);
      if (!match || fact.value_numeric === null) continue;
      const [, , sex, ageStr] = match;
      const band = bandForAge(Number(ageStr));
      if (!band) continue;
      byBand.set(band, (byBand.get(band) ?? 0) + fact.value_numeric);
      if (sex === "male") male += fact.value_numeric;
      else female += fact.value_numeric;
    }

    const totalRoll = male + female;
    if (totalRoll === 0) continue;

    trend.push(finishSnapshot(currentFacts, period, totalRoll, male, female, byBand, urn));
  }

  return trend;
}

// Single-year-of-age headcount per period (both sexes, full_time + part_time summed) --
// finer granularity than the age bands above. Needed by the cohort-progression
// intake-size estimator (rolls spec §7), which tracks one specific age across
// consecutive years, not a banded group.
export function singleAgeCountsByPeriod(facts: ReferenceFact[]): Map<number, Map<number, number>> {
  const byPeriod = new Map<number, Map<number, number>>();
  for (const fact of facts) {
    const match = AGE_BREAKDOWN_RE.exec(fact.breakdown);
    if (!match || fact.value_numeric === null) continue;
    const age = Number(match[3]);
    if (!byPeriod.has(fact.period)) byPeriod.set(fact.period, new Map());
    const byAge = byPeriod.get(fact.period)!;
    byAge.set(age, (byAge.get(age) ?? 0) + fact.value_numeric);
  }
  return byPeriod;
}

// Single-year-of-age headcount, split by sex, for one specific period -- the
// population-pyramid shape chart's data source (chart palette doc, "Public View
// rebuild"). Same full_time + part_time summing as everything else in this module.
export type AgeGenderCounts = Map<number, { male: number; female: number }>;

export function singleAgeGenderCountsForPeriod(
  facts: ReferenceFact[],
  period: number,
): AgeGenderCounts {
  const byAge: AgeGenderCounts = new Map();
  for (const fact of facts) {
    if (fact.period !== period) continue;
    const match = AGE_BREAKDOWN_RE.exec(fact.breakdown);
    if (!match || fact.value_numeric === null) continue;
    const [, , sex, ageStr] = match;
    const age = Number(ageStr);
    if (!byAge.has(age)) byAge.set(age, { male: 0, female: 0 });
    const entry = byAge.get(age)!;
    if (sex === "male") entry.male += fact.value_numeric;
    else entry.female += fact.value_numeric;
  }
  return byAge;
}

// Ages 5-17 only: the design review's resolved shape-classification range (chart
// palette doc / review log). Ages 4 and 18 are excluded because they're structurally
// incomplete cohorts at census date (most 4- and 18-year-olds nationally aren't in a
// school-age census bracket yet/any more), which was producing a false "rise" at the
// very start of every primary school's age profile -- the root cause behind the
// classifier's universal "Mushroom" bias found in the Task 3 review. Ages 4 and 18
// still appear on the pyramid chart itself (task 31), just tinted to mark them as
// partial, and are never part of the classification input.
export const SHAPE_CLASSIFICATION_MIN_AGE = 5;
export const SHAPE_CLASSIFICATION_MAX_AGE = 17;

// Builds classifyShape()'s input from a single-age/sex breakdown: one point per age
// 5-17, both sexes combined, in age order so the bucket-transition method reads left
// to right by age the same way it used to read band to band.
export function shapeClassifierInput(
  ageGenderCounts: AgeGenderCounts,
): { key: string; total: number }[] {
  const points: { key: string; total: number }[] = [];
  for (let age = SHAPE_CLASSIFICATION_MIN_AGE; age <= SHAPE_CLASSIFICATION_MAX_AGE; age++) {
    const counts = ageGenderCounts.get(age);
    points.push({ key: String(age), total: (counts?.male ?? 0) + (counts?.female ?? 0) });
  }
  return points;
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
