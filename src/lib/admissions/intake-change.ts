// VicData 0.8 Admissions feedback round 1 (F-13, Guy's decision of 29 Oct): "Why did our intake change?"
// -- the Funnel rebuilt as a waterfall from 2019/20 to the latest year. Pure; intake.ts reads the data.
//
// The school's entry cohort is a product of three things, all in one area (the school's catchment radius,
// catchment.ts, never its feeder list):
//
//   entry  =  births  x  (area Y6 / births)  x  (school Y7 / area Y6)
//             cohort      families moving        the school's share
//             size
//
// (16+: area Y11 and the school's Y12.) The change from the base year to the latest is split into those
// three parts by the log-mean (LMDI) split, so the parts always add up to the whole change exactly and
// the order the parts are taken in doesn't matter:
//
//   part_k = L(entry_1, entry_0) x ln(factor_k,1 / factor_k,0),   L(a, b) = (a - b) / (ln a - ln b)
//
// Rounded to whole pupils with the largest remainders, so the rounded parts still add up to the rounded
// change. Where the school's intake is small (under SMALL_INTAKE at either end), each end is a 3-year
// average (the base and the two years after it; the latest and the two before it), every figure alike.
// R-ADM-INTAKE-CHANGE.

export const SMALL_INTAKE = 30;
export const AVERAGE_YEARS = 3;

export type IntakeEnd = { births: number; area: number; school: number };
export type IntakePartKey = "births" | "moving" | "share";
export type IntakePart = { key: IntakePartKey; value: number; exact: number };
export type IntakeSplit = { start: number; end: number; change: number; parts: IntakePart[] };

/** L(a, b): the log mean (a when a = b). */
export function logMean(a: number, b: number): number {
  if (a === b) return a;
  return (a - b) / (Math.log(a) - Math.log(b));
}

/** Whole numbers that add up to `total`, each as near its exact value as can be (largest remainders). */
export function roundToTotal(exact: number[], total: number): number[] {
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => (left >= 0 ? b.r - a.r : a.r - b.r) || a.i - b.i);
  const out = [...floors];
  for (let k = 0; left !== 0 && k < 10 * order.length; k++) {
    const { i } = order[k % order.length];
    out[i] += left > 0 ? 1 : -1;
    left += left > 0 ? -1 : 1;
  }
  return out;
}

/** The three parts of the change from `base` to `latest`, or null where a figure is missing or 0 (a
 * share of nothing, or no births: the split isn't defined). */
export function splitIntake(base: IntakeEnd, latest: IntakeEnd): IntakeSplit | null {
  const all = [base.births, base.area, base.school, latest.births, latest.area, latest.school];
  if (all.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  const L = logMean(latest.school, base.school);
  const f0 = [base.births, base.area / base.births, base.school / base.area];
  const f1 = [latest.births, latest.area / latest.births, latest.school / latest.area];
  const exact = f0.map((f, k) => L * Math.log(f1[k] / f));
  const start = Math.round(base.school);
  const end = Math.round(latest.school);
  const rounded = roundToTotal(exact, end - start);
  const keys: IntakePartKey[] = ["births", "moving", "share"];
  return { start, end, change: end - start, parts: keys.map((key, k) => ({ key, value: rounded[k], exact: exact[k] })) };
}

/** The mean of the values that are there; null when none is. */
export function meanOf(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** The years each end averages over: one year, or AVERAGE_YEARS where the intake is small. */
export function endYears(baseYear: number, latestYear: number, averaged: boolean): { base: number[]; latest: number[] } {
  if (!averaged) return { base: [baseYear], latest: [latestYear] };
  const n = AVERAGE_YEARS;
  return { base: Array.from({ length: n }, (_, i) => baseYear + i), latest: Array.from({ length: n }, (_, i) => latestYear - n + 1 + i) };
}

/** Small: the school's single-year intake under SMALL_INTAKE at either end. */
export const isSmallIntake = (base: number | null, latest: number | null) => (base ?? 0) < SMALL_INTAKE || (latest ?? 0) < SMALL_INTAKE;

/**
 * Which age stands in for births. A cohort entering at `entryAge` in census period E was aged a at
 * mid-year E - entryAge + a (ONS mid-year ages, as the census's ages at 31 August). Births are age 0;
 * where the area's single ages don't reach back to the base cohort's birth year, the youngest age held
 * for it is used at both ends, so the two ends are like with like (Guy: "use the earliest age held and
 * say so"). Null when even that is at or past the area-year age (no births part to draw).
 */
export function birthsAge(entryAge: number, baseYear: number, firstAreaYear: number): number | null {
  const a = Math.max(0, firstAreaYear - (baseYear - entryAge));
  return a < entryAge - 1 ? a : null;
}

/** The mid-year at which a cohort entering at `entryAge` in period `entryYear` was aged `age`. */
export const midYearAt = (entryYear: number, entryAge: number, age: number) => entryYear - entryAge + age;
