// VicData 0.7 admissions r1 (A1): the cohort ladder and pipeline maths (src/lib/admissions/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cohortTable, cohortAt, type CohortTable } from "./admissions/cohort";
import { entryPoint, firstEntryYear, horizonYears } from "./admissions/entry-points";
import { academicBirths, buildLadder, driftFor, poolChange } from "./admissions/ladder";
import { autoBlend, blendBirths } from "./admissions/blend";
import { groupShare, holdShare } from "./admissions/shares";
import { cohortFlow, latestLeaving16 } from "./admissions/flow";
import { percentile, ranksOf } from "./admissions/stats";
import { localShape } from "./admissions/shape";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";

const fact = (period: number, breakdown: string, v: number) => ({ entity_id: "x", period, breakdown, value_numeric: v }) as never;
// A school with a flat cohort of n at every age a in [lo, hi], every year 2019-2025.
const flat = (n: number, lo: number, hi: number): CohortTable => {
  const f: never[] = [];
  for (let p = 2019; p <= 2025; p++) for (let a = lo; a <= hi; a++) { f.push(fact(p, `full_time_male_aged_${a}`, n / 2), fact(p, `full_time_female_aged_${a}`, n / 2)); }
  return cohortTable(f);
};

test("R-ADM-LADDER: full-time pupils from age 4; full- plus part-time at nursery ages", () => {
  const t = cohortTable([fact(2025, "full_time_male_aged_3", 2), fact(2025, "part_time_male_aged_3", 5), fact(2025, "full_time_female_aged_4", 10), fact(2025, "part_time_female_aged_4", 3)]);
  assert.equal(cohortAt(t, 3, 2025), 7);
  assert.equal(cohortAt(t, 4, 2025), 10);
  assert.equal(cohortAt(t, 4, 2025, "female"), 10);
  assert.equal(cohortAt(t, 9, 2025), 0, "a census year with pupils: an absent age is 0");
  assert.equal(cohortAt(t, 9, 2024), null, "no census that year: null, not 0");
});

test("R-ADM-BIRTH-SPLIT: 8/12 of year X plus 4/12 of X-1", () => {
  const b = new Map([[2022, 1200], [2023, 900]]);
  assert.equal(academicBirths(b, 2023), (8 / 12) * 900 + (4 / 12) * 1200);
  assert.equal(academicBirths(b, 2022), null, "needs both years");
});

test("entry points, the first entry year and the horizons", () => {
  assert.equal(entryPoint("11+")?.age, 11);
  assert.equal(entryPoint("age:7")?.age, 7);
  assert.equal(entryPoint("7+")?.id, "age:7");
  assert.equal(entryPoint("age:18"), null);
  assert.equal(firstEntryYear(new Date("2026-10-07")), 2027);
  assert.equal(firstEntryYear(new Date("2026-08-31")), 2026);
  assert.equal(horizonYears(entryPoint("16+")!, 2027, 2025), 10);
  assert.equal(horizonYears(entryPoint("4+")!, 2027, 2025), 5, "Reception: to the last birth year's cohort (2029) plus two");
});

test("R-ADM-DRIFT-RANGE: percentiles of matched year-on-year ratios, compounding with distance; never a point beyond the counted rung", () => {
  assert.equal(percentile([1, 2, 3, 4], 50), 2.5);
  const set = [flat(100, 4, 10)];
  const d = driftFor({ entry: entryPoint("11+")!, rungSchools: () => set });
  assert.deepEqual([d?.low, d?.high], [1, 1], "a flat cohort drifts by exactly 1");
  // A set growing 10% a year at every age.
  const f: never[] = [];
  for (let p = 2019; p <= 2025; p++) for (let a = 4; a <= 10; a++) f.push(fact(p, `full_time_male_aged_${a}`, 100 * Math.pow(1.1, p - 2019 + a - 4)));
  const grow = [cohortTable(f)];
  const l = buildLadder({ entry: entryPoint("11+")!, censusPeriod: 2025, firstEntryYear: 2027, rungSchools: () => grow, birthsByYear: null });
  const [y27, y28] = l.future;
  assert.equal(y27.rungAge, 9);
  assert.ok(y27.low! < y27.high! || Math.abs(y27.low! - y27.high!) < 1e-9);
  assert.ok((y28.high! - y28.low!) / y28.pool! >= (y27.high! - y27.low!) / y27.pool! - 1e-12, "the range widens");
  assert.equal(l.past.at(-1)!.entryYear, 2026);
  assert.equal(l.past.at(-1)!.rungAge, 10);
});

test("R-ADM-LADDER: 16+ hands over from the secondaries to the primaries, scaled by the observed ratio", () => {
  const prim = [flat(50, 4, 10)];
  const sec = [flat(200, 11, 15)];
  const l = buildLadder({ entry: entryPoint("16+")!, censusPeriod: 2025, firstEntryYear: 2027, rungSchools: (a) => (a <= 10 ? prim : sec), birthsByYear: null });
  assert.equal(l.handovers.length, 1);
  assert.equal(l.handovers[0].spread?.mean, 4);
  const at10 = l.future.find((p) => p.rungAge === 10)!;
  assert.equal(at10.pool, 50 * 4, "a primary rung on the secondaries' scale");
  assert.equal(l.future.find((p) => p.rungAge === 14)!.pool, 200);
});

test("R-ADM-HOLD-SHARE and R-ADM-POOL-NOT-INTAKE: this year's intake over each future pool; worded as a requirement", () => {
  const set = [flat(400, 4, 10)];
  const school = flat(100, 11, 15);
  const l = buildLadder({ entry: entryPoint("11+")!, censusPeriod: 2025, firstEntryYear: 2027, rungSchools: () => set, birthsByYear: null });
  const h = holdShare(l, school, 2025);
  assert.equal(h.current?.share, 25);
  assert.equal(h.needed[0].share, 25);
  assert.match(ADMISSIONS_NOTES.holdShare, /requirement, not a forecast/);
  assert.match(ADMISSIONS_NOTES.pool, /pool, not an intake/);
  assert.equal(poolChange(l, 2029)?.pct, 0);
});

test("R-ADM-GROUP-SHARE: a share of this group, with shared ranks", () => {
  const tables = new Map([["a", flat(100, 11, 15)], ["b", flat(100, 11, 15)], ["c", flat(50, 11, 15)]]);
  const g = groupShare(tables, [11]);
  const r2025 = g.rows.filter((r) => r.period === 2025);
  assert.deepEqual(r2025.map((r) => [r.urn, r.share, r.rank]), [["a", 40, 1], ["b", 40, 1], ["c", 20, 3]]);
  assert.deepEqual(Array.from(ranksOf([{ key: "x", value: null }, { key: "y", value: 3 }])), [["y", 1]]);
  assert.match(ADMISSIONS_NOTES.groupShare, /not a share of the local market/i);
});

test("R-ADM-JOINERS-ESTIMATE: net growth across years; leaving at 16 from Year 11 to Year 12", () => {
  const f: never[] = [];
  for (const [p, a, v] of [[2024, 15, 200], [2025, 16, 80], [2024, 10, 30], [2025, 11, 120]] as const) f.push(fact(p, `full_time_male_aged_${a}`, v));
  const rows = cohortFlow(cohortTable(f));
  assert.equal(rows.find((r) => r.age === 11 && r.period === 2025)!.joinersEst, 90);
  assert.equal(latestLeaving16(rows)?.share, 0.6);
  assert.match(ADMISSIONS_NOTES.joiners, /estimate/i);
});

test("the LA blend: weights from pupils, births averaged by weight over the years every LA has", () => {
  const w = autoBlend([{ laCode: "885", pupils: 30 }, { laCode: "884", pupils: 10 }, { laCode: null, pupils: 5 }]);
  assert.deepEqual(Array.from(w), [["885", 0.75], ["884", 0.25]]);
  const b = blendBirths(w, new Map([["885", new Map([[2024, 1000], [2025, 900]])], ["884", new Map([[2024, 400]])]]));
  assert.deepEqual(Array.from(b), [[2024, 850]]);
});

test("R-ADM-SHAPE-NOT-RANKED: the local shape is the shared classifier on the set's summed profile", () => {
  const counts = new Map(Array.from({ length: 7 }, (_, i) => [11 + i, { male: 50, female: 50 }]));
  assert.equal(localShape([counts]), localShape([counts, counts]), "scale does not change a shape");
  assert.match(ADMISSIONS_NOTES.shape, /never ranked/);
});
