// VicData 0.7 admissions (A1): the cohort ladder -- the POOL of children who will reach an entry
// point in a given September, traced back through whichever schools hold them now, then births.
// A pool, never an intake (R-ADM-POOL-NOT-INTAKE). Pure: the caller passes the census tables,
// births and projections (admissions/data.ts reads them).
//
// For entry age E, latest census period P (ages at 31 Aug P) and entry year Y (September):
//   counted     the rung age a = E - (Y - P) is 4 or more: the rung set's count at age a in
//               census P. Range: the pool times the set's observed year-on-year drift, compounded
//               over the k = E - a years still to go (R-ADM-DRIFT-RANGE).
//   births      a < 4: children born Sept (X-1) to Aug X, X = Y - E: 8/12 of calendar-year births
//               X plus 4/12 of X-1 (R-ADM-BIRTH-SPLIT), in the LA blend. For E > 4, scaled to the
//               set by its observed ratio of Reception (age 4) to those births, then drifted
//               from age 4; for E <= 4 the births ARE the pool (the area's children).
//   projection  11+ only, off by default: ONS age-10 projections (year Y - 1), scaled to the set
//               by its age-10 count against the projection base year. An overlay, never the line.
// Past pools (entry 2020 to P+1): the age E-1 rung in census Y-1 for E > 4 (the last counted
// step before entry); births for E <= 4.
import type { CohortTable, Sex } from "./cohort";
import { cohortAt, periodsOf } from "./cohort";
import { COUNTED_MIN_AGE, horizonYears, type EntryPoint } from "./entry-points";
import { percentile } from "./stats";

export const DRIFT_LOW_PCT = 10;
export const DRIFT_HIGH_PCT = 90;
export const MIN_DRIFT_COHORT = 10; // a ratio needs at least this many pupils underneath it
export const BIRTH_SEX_SHARE = { male: 0.51, female: 0.49 } as const; // births have no sex split: an estimate
export const PAST_FROM_ENTRY_YEAR = 2020;

export type PoolSource = "counted" | "births" | "projection";
export type PoolPoint = {
  entryYear: number;
  source: PoolSource;
  pool: number | null; // the counted or birth-based pool itself
  low: number | null; // the range at entry (never a single point beyond the counted rung)
  high: number | null;
  rungAge: number | null;
  censusPeriod: number | null;
  birthYear: number | null;
  yearsToGo: number; // drift steps applied
};

export type LadderInput = {
  entry: EntryPoint;
  censusPeriod: number; // P
  firstEntryYear: number; // the first September still to come
  // Each rung age's set, one cohort table per school (16+: secondaries for 11-15, primaries
  // below). The same set object for every age one kind of school holds.
  rungSchools: (age: number) => CohortTable[];
  birthsByYear: Map<number, number> | null; // the LA blend, calendar years
  projectionsByYear?: Map<number, number> | null; // age-10 projections, years (11+ only)
  sex?: Sex;
  includeProjection?: boolean;
};

export type Spread = { mean: number; low: number; high: number; n: number; from: number; to: number };
export type Drift = Spread | null;

const sumAt = (tables: CohortTable[], age: number, period: number, sex: Sex): number | null => {
  let total = 0;
  let any = false;
  for (const t of tables) {
    const v = cohortAt(t, age, period, sex);
    if (v !== null) { total += v; any = true; }
  }
  return any ? total : null;
};

export const MIN_COVERAGE = 0.9;

/** A set's count at an age in a year, when the schools WITH a census that year make up at least
 * MIN_COVERAGE of the set (by their count at the same age in the reference year); scaled up by
 * that coverage. A school missing a year (most often an academy conversion's new URN) then
 * neither drops the year nor reads as a smaller cohort. */
function coveredSum(set: CohortTable[], age: number, period: number, refPeriod: number, sex: Sex): number | null {
  let present = 0;
  let presentRef = 0;
  let allRef = 0;
  for (const s of set) {
    const ref = cohortAt(s, age, refPeriod, sex) ?? 0;
    allRef += ref;
    const v = cohortAt(s, age, period, sex);
    if (v === null) continue;
    present += v;
    presentRef += ref;
  }
  if (allRef <= 0) return null;
  const coverage = presentRef / allRef;
  return coverage >= MIN_COVERAGE && coverage > 0 ? present / coverage : null;
}

/** Over the schools with a census in BOTH years only, so a school missing a year never reads as
 * a cohort shrinking or growing. Null when the denominator is below MIN_DRIFT_COHORT. */
function matchedRatio(fromSet: CohortTable[], fromAge: number, toSet: CohortTable[], toAge: number, t: number, sex: Sex, strict: boolean): number | null {
  if (fromSet === toSet) {
    let num = 0;
    let den = 0;
    for (const s of fromSet) {
      const a = cohortAt(s, fromAge, t, sex);
      const b = cohortAt(s, toAge, t + 1, sex);
      if (a === null || b === null) continue;
      den += a;
      num += b;
    }
    return den >= MIN_DRIFT_COHORT ? num / den : null;
  }
  // A handover between two sets: each side covered (MIN_COVERAGE) in its own year.
  void strict;
  const den = coveredSum(fromSet, fromAge, t, refPeriodOf(fromSet), sex);
  const num = coveredSum(toSet, toAge, t + 1, refPeriodOf(toSet), sex);
  return den !== null && num !== null && den >= MIN_DRIFT_COHORT ? num / den : null;
}

const spreadOf = (pairs: { r: number; t: number }[]): Spread | null => {
  const rs = pairs.map((p) => p.r);
  const low = percentile(rs, DRIFT_LOW_PCT);
  const high = percentile(rs, DRIFT_HIGH_PCT);
  if (low === null || high === null) return null;
  return { mean: rs.reduce((a, b) => a + b, 0) / rs.length, low, high, n: rs.length, from: Math.min(...pairs.map((p) => p.t)), to: Math.max(...pairs.map((p) => p.t)) + 1 };
};

const refPeriodOf = (set: CohortTable[]) => Math.max(...set.flatMap(periodsOf));
const allPeriods = (sets: CohortTable[]) => Array.from(new Set(sets.flatMap(periodsOf))).sort((a, b) => a - b);

/** The set's observed year-on-year cohort ratios (age a in year t -> a+1 in t+1), within one
 * kind of school, between the youngest counted rung and the age before entry (R-ADM-DRIFT-RANGE). */
export function driftFor(input: Pick<LadderInput, "entry" | "rungSchools" | "sex">): Drift {
  const pairs: { r: number; t: number }[] = [];
  for (let a = COUNTED_MIN_AGE; a <= input.entry.age - 2; a++) {
    const from = input.rungSchools(a);
    if (from !== input.rungSchools(a + 1)) continue; // a handover, measured on its own
    for (const t of allPeriods(from)) {
      const r = matchedRatio(from, a, from, a + 1, t, input.sex ?? "all", false);
      if (r !== null) pairs.push({ r, t });
    }
  }
  return spreadOf(pairs);
}

/** A handover from one set to the next (16+: Year 6 in the primaries -> Year 7 in the
 * secondaries): the observed ratio, its mean scales the younger rung, its spread is the range. */
export function handoverFor(input: Pick<LadderInput, "rungSchools" | "sex">, a: number): Spread | null {
  const from = input.rungSchools(a);
  const to = input.rungSchools(a + 1);
  const pairs: { r: number; t: number }[] = [];
  for (const t of allPeriods(from)) {
    const r = matchedRatio(from, a, to, a + 1, t, input.sex ?? "all", true);
    if (r !== null) pairs.push({ r, t });
  }
  return spreadOf(pairs);
}

/** Pupils born Sept (x-1) to Aug x from calendar-year births (R-ADM-BIRTH-SPLIT). */
export function academicBirths(births: Map<number, number>, x: number): number | null {
  const a = births.get(x);
  const b = births.get(x - 1);
  return a === undefined || b === undefined ? null : (8 / 12) * a + (4 / 12) * b;
}

const sexFactor = (sex: Sex) => (sex === "all" ? 1 : BIRTH_SEX_SHARE[sex]);

/** The Reception set's age-4 count against its birth cohort, per census year (every school of
 * the set with a census that year): how births translate into pupils at these schools. */
export function birthCalibration(input: Pick<LadderInput, "rungSchools" | "birthsByYear" | "sex">): Spread | null {
  if (!input.birthsByYear) return null;
  const set = input.rungSchools(COUNTED_MIN_AGE);
  const pairs: { r: number; t: number }[] = [];
  for (const p of allPeriods(set)) {
    const reception = coveredSum(set, COUNTED_MIN_AGE, p, refPeriodOf(set), input.sex ?? "all");
    const births = academicBirths(input.birthsByYear, p - COUNTED_MIN_AGE);
    if (reception === null || births === null || births <= 0 || reception === 0) continue;
    pairs.push({ r: reception / (births * sexFactor(input.sex ?? "all")), t: p });
  }
  return spreadOf(pairs);
}

export type Ladder = {
  entry: EntryPoint;
  past: PoolPoint[];
  future: PoolPoint[];
  projection: PoolPoint[]; // empty unless asked for (11+ only)
  drift: Drift;
  handovers: { fromAge: number; spread: Spread | null }[];
  calibration: Spread | null;
  lastBirthYear: number | null;
};

export function buildLadder(input: LadderInput): Ladder {
  const E = input.entry.age;
  const P = input.censusPeriod;
  const sex = input.sex ?? "all";
  const drift = driftFor(input);
  const handovers: { fromAge: number; spread: Spread | null }[] = [];
  for (let a = COUNTED_MIN_AGE; a <= E - 2; a++) if (input.rungSchools(a) !== input.rungSchools(a + 1)) handovers.push({ fromAge: a, spread: handoverFor(input, a) });
  const cal = birthCalibration(input);
  const births = input.birthsByYear;
  const lastBirthYear = births && births.size ? Math.max(...births.keys()) : null;

  // From a count at rung age a to the pool at age E-1 (the last rung before entry): every step
  // either drifts (same schools) or hands over (to the next kind of school).
  const carry = (count: number, a: number): { pool: number | null; low: number | null; high: number | null; steps: number } => {
    let pool = count;
    let low = count;
    let high = count;
    let steps = 0;
    for (let s = a; s <= E - 2; s++) {
      const h = handovers.find((x) => x.fromAge === s);
      if (h) {
        if (!h.spread) return { pool: null, low: null, high: null, steps };
        pool *= h.spread.mean;
        low *= h.spread.low;
        high *= h.spread.high;
      } else {
        if (!drift) return { pool, low: null, high: null, steps };
        low *= drift.low;
        high *= drift.high;
      }
      steps++;
    }
    return { pool, low, high, steps };
  };

  const birthsPoint = (Y: number): PoolPoint | null => {
    if (!births) return null;
    const X = Y - E;
    const b = academicBirths(births, X);
    if (b === null) return null;
    const raw = b * sexFactor(sex);
    if (E <= COUNTED_MIN_AGE) {
      // The area's children are the pool; the Reception set's calibration spread (relative) is the range.
      return { entryYear: Y, source: "births", pool: raw, low: cal ? raw * (cal.low / cal.mean) : null, high: cal ? raw * (cal.high / cal.mean) : null, rungAge: null, censusPeriod: null, birthYear: X, yearsToGo: 0 };
    }
    if (!cal) return null;
    const c = carry(raw * cal.mean, COUNTED_MIN_AGE);
    const lo = carry(raw * cal.low, COUNTED_MIN_AGE).low;
    const hi = carry(raw * cal.high, COUNTED_MIN_AGE).high;
    return { entryYear: Y, source: "births", pool: c.pool, low: lo, high: hi, rungAge: null, censusPeriod: null, birthYear: X, yearsToGo: c.steps + 1 };
  };

  const past: PoolPoint[] = [];
  for (let Y = PAST_FROM_ENTRY_YEAR; Y < input.firstEntryYear; Y++) {
    if (E > COUNTED_MIN_AGE) {
      const a = E - 1;
      const pool = sumAt(input.rungSchools(a), a, Y - 1, sex);
      if (pool !== null) past.push({ entryYear: Y, source: "counted", pool, low: pool, high: pool, rungAge: a, censusPeriod: Y - 1, birthYear: null, yearsToGo: 0 });
    } else {
      const p = birthsPoint(Y);
      if (p) past.push(p);
    }
  }

  const future: PoolPoint[] = [];
  const years = horizonYears(input.entry, input.firstEntryYear, lastBirthYear ?? -Infinity);
  for (let Y = input.firstEntryYear; Y < input.firstEntryYear + years; Y++) {
    const a = E - 1 - (Y - 1 - P); // the age now of those at age E-1 in census Y-1
    if (E > COUNTED_MIN_AGE && a >= COUNTED_MIN_AGE && a <= E - 1) {
      const count = sumAt(input.rungSchools(a), a, P, sex);
      const c = count === null ? null : carry(count, a);
      future.push({ entryYear: Y, source: "counted", pool: c?.pool ?? null, low: c?.low ?? null, high: c?.high ?? null, rungAge: a, censusPeriod: P, birthYear: null, yearsToGo: c?.steps ?? 0 });
      continue;
    }
    const b = birthsPoint(Y);
    if (b) {
      future.push(b);
      continue;
    }
    // Beyond the last birth year nothing we hold covers it (Reception would need ONS projections
    // at ages 0-3): left as a gap, never invented.
    future.push({ entryYear: Y, source: "projection", pool: null, low: null, high: null, rungAge: null, censusPeriod: null, birthYear: Y - E, yearsToGo: 0 });
  }

  // 11+ only: ONS age-10 projections, scaled to the set by its age-10 count in the base year, as
  // an overlay (off by default). The range is one year's drift either way.
  const projection: PoolPoint[] = [];
  if (input.includeProjection && E === 11 && input.projectionsByYear?.size) {
    const proj = input.projectionsByYear;
    const base = proj.get(P);
    const setAt10 = sumAt(input.rungSchools(10), 10, P, sex);
    if (base && setAt10 !== null && base > 0) {
      const scale = setAt10 / (base * sexFactor(sex));
      for (const pt of future) {
        const v = proj.get(pt.entryYear - 1);
        if (v === undefined) continue;
        const raw = v * sexFactor(sex) * scale;
        projection.push({ entryYear: pt.entryYear, source: "projection", pool: raw, low: drift ? raw * drift.low : null, high: drift ? raw * drift.high : null, rungAge: 10, censusPeriod: null, birthYear: null, yearsToGo: 1 });
      }
    }
  }

  while (future.length && future[future.length - 1].pool === null) future.pop();
  return { entry: input.entry, past, future, projection, drift, handovers, calibration: cal, lastBirthYear };
}

/** "−8% by 2030 against 2026": the change in the pool from the latest past entry year. */
export function poolChange(l: Ladder, toYear: number): { fromYear: number; from: number; to: number; pct: number } | null {
  const last = [...l.past].reverse().find((p) => p.pool !== null);
  const target = l.future.find((p) => p.entryYear === toYear && p.pool !== null);
  if (!last || !target || !last.pool) return null;
  return { fromYear: last.entryYear, from: last.pool, to: target.pool!, pct: ((target.pool! - last.pool) / last.pool) * 100 };
}
