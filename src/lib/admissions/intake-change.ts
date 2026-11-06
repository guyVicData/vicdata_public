// VicData 0.8 Admissions feedback round 1 (F-13, Guy's decision of 29 Oct): "Why did our intake change?"
// -- the Funnel rebuilt as a waterfall from 2019/20 to the latest year. Pure; intake.ts reads the data.
// Admissions feedback round 2 (F-31, Guy's design of 6 Nov): two steps, and families moving as an
// "of which" inside the first.
//
// The school's entry cohort is a product of two things, both in one area (the school's catchment radius,
// catchment.ts, never its feeder list):
//
//   entry  =  local cohort  x  (school Y7 / local cohort)
//             cohort size      the school's share
//
// where the local cohort is the area's children at the age a year below entry (Y6 = 10 at 11+; Y11 = 15 at
// 16+), the mid-year before entry. The change from the base year to the latest is split into those two
// steps by the log-mean (LMDI) split, so the steps always add up to the whole change exactly:
//
//   step_k = L(entry_1, entry_0) x ln(factor_k,1 / factor_k,0),   L(a, b) = (a - b) / (ln a - ln b)
//
// Rounded to whole pupils with the largest remainders, so the rounded steps still add up to the rounded
// change. Families moving is NOT a step: the local cohort = the same children's count at the earliest age
// (born here, or here since the youngest age the LSOA years hold) + moved in since (net). The cohort-size
// step is shared between those two in proportion to each one's change from the base year to the latest
// (each local child is worth the same pupils), rounded so the two still add up to the step. Where the
// school's intake is small (under SMALL_INTAKE at either end), each end is a 3-year average (the base and
// the two years after it; the latest and the two before it), every figure alike. R-ADM-VIEW-INTAKE-CHANGE.

export const SMALL_INTAKE = 30;
export const AVERAGE_YEARS = 3;

/** One end: the cohort at its earliest age held (`here`, null when no age before the local-cohort age is
 * held), the local cohort (`area`), and the school's entry cohort. Moved in (net) = area - here. */
export type IntakeEnd = { here: number | null; area: number; school: number };
export type IntakePartKey = "cohort" | "share";
export type IntakePart = { key: IntakePartKey; value: number; exact: number };
/** The cohort-size step's "of which": the pupils that came with the children here at the earliest age and
 * with families moving (net). here + moved = the cohort step, exactly and rounded. */
export type IntakeOfWhich = { here: number; moved: number; exactHere: number; exactMoved: number };
export type IntakeSplit = { start: number; end: number; change: number; parts: IntakePart[]; ofWhich: IntakeOfWhich | null };

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

/** The two steps of the change from `base` to `latest`, with the cohort step's "of which", or null where
 * the local cohort or the school's intake is missing or 0 (a share of nothing: the split isn't defined).
 * A missing earliest-age count only drops the "of which". */
export function splitIntake(base: IntakeEnd, latest: IntakeEnd): IntakeSplit | null {
  const all = [base.area, base.school, latest.area, latest.school];
  if (all.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  const L = logMean(latest.school, base.school);
  const f0 = [base.area, base.school / base.area];
  const f1 = [latest.area, latest.school / latest.area];
  const exact = f0.map((f, k) => L * Math.log(f1[k] / f));
  const start = Math.round(base.school);
  const end = Math.round(latest.school);
  const rounded = roundToTotal(exact, end - start);
  const keys: IntakePartKey[] = ["cohort", "share"];
  return { start, end, change: end - start, parts: keys.map((key, k) => ({ key, value: rounded[k], exact: exact[k] })), ofWhich: ofWhich(base, latest, exact[0], rounded[0], L) };
}

/** The cohort step shared between the children here at the earliest age and families moving (net), in
 * proportion to each one's change. Each local child is worth exact / (change in the local cohort) pupils;
 * where the local cohort didn't change, the limit of that, L / cohort. */
function ofWhich(base: IntakeEnd, latest: IntakeEnd, exact: number, value: number, L: number): IntakeOfWhich | null {
  if (base.here === null || latest.here === null || !Number.isFinite(base.here) || !Number.isFinite(latest.here)) return null;
  const dHere = latest.here - base.here;
  const dMoved = latest.area - latest.here - (base.area - base.here);
  const dArea = latest.area - base.area;
  const perChild = dArea !== 0 ? exact / dArea : L / base.area;
  const exactHere = perChild * dHere;
  const exactMoved = perChild * dMoved;
  const [here, moved] = roundToTotal([exactHere, exactMoved], value);
  return { here, moved, exactHere, exactMoved };
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
 * The earliest age the "of which" counts the cohort at. A cohort entering at `entryAge` in census period
 * E was aged a at mid-year E - entryAge + a (ONS mid-year ages, as the census's ages at 31 August). Births
 * are age 0 ("born here"); where the area's single ages don't reach back to the base cohort's birth year,
 * the youngest age held for it is used at both ends ("here since age 8"), so the two ends are like with
 * like (Guy: "use the earliest age held and say so"). Null when even that is at or past the local-cohort
 * age (no "of which" to draw).
 */
export function birthsAge(entryAge: number, baseYear: number, firstAreaYear: number): number | null {
  const a = Math.max(0, firstAreaYear - (baseYear - entryAge));
  return a < entryAge - 1 ? a : null;
}

/** The mid-year at which a cohort entering at `entryAge` in period `entryYear` was aged `age`. */
export const midYearAt = (entryYear: number, entryAge: number, age: number) => entryYear - entryAge + age;
