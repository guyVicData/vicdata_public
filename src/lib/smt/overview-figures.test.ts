import { test } from "node:test";
import assert from "node:assert/strict";
import { cohortSeries, groupShare, groupShareOfSeries } from "../admissions/shares";
import type { CohortTable } from "../admissions/cohort";
import type { RollSnapshot } from "../roll-data";
import { ENTRY_AGE, overviewFigures, overviewMembers, overviewMembersFromRaw } from "./overview-figures";

const table = (rows: [number, number, number, number][]): CohortTable => {
  const t: CohortTable = new Map();
  for (const [p, age, male, female] of rows) (t.get(p) ?? t.set(p, new Map()).get(p)!).set(age, { male, female });
  return t;
};
const snap = (period: number, totalRoll: number, boarding: [number, number] | null): RollSnapshot => ({
  period,
  totalRoll,
  byAgeBand: [],
  gender: { male: 0, female: 0, total: totalRoll, sumMatchesTotal: false },
  boarding: boarding ? { day: boarding[0], boarders: boarding[1], total: boarding[0] + boarding[1] } : null,
});

test("groupShare is groupShareOfSeries over each table's cohort series (the refactor changes nothing)", () => {
  const tables = new Map<string, CohortTable>([
    ["a", table([[2022, 11, 40, 38], [2022, 12, 30, 30], [2023, 11, 41, 0], [2024, 12, 5, 5]])],
    ["b", table([[2023, 11, 0, 0], [2023, 14, 3, 3], [2024, 11, 60, 61]])],
    ["c", table([[2021, 11, 0, 0]])], // a year with no pupils at all: null, not 0
    ["d", new Map()],
  ]);
  for (const ages of [[11], [11, 12, 13, 14, 15]]) {
    const series = new Map(Array.from(tables, ([u, t]) => [u, cohortSeries(t, ages)] as const));
    assert.deepEqual(groupShareOfSeries(series), groupShare(tables, ages));
  }
  assert.deepEqual(Array.from(cohortSeries(tables.get("b")!, [11])), [[2023, 0], [2024, 121]]);
  assert.deepEqual(Array.from(cohortSeries(tables.get("c")!, [11])), [[2021, null]]);
});

test("overviewFigures: rolls, the day/boarding split, bands and the entry cohort", () => {
  const ageGender = new Map([[11, { male: 10, female: 12 }], [12, { male: 5, female: 5 }], [16, { male: 3, female: 4 }]]);
  const f = overviewFigures([snap(2022, 500, [400, 100]), snap(2023, 0, null)], { table: table([[2022, 11, 10, 12], [2023, 12, 1, 1]]), ageGender });
  assert.deepEqual(f.c, [[2022, 500, 400, 100], [2023, 0]]);
  assert.deepEqual(f.b, { secondary: 32, sixth_form: 7 });
  assert.equal(ENTRY_AGE, 11);
  assert.deepEqual(f.k, [[2022, 22], [2023, 0]]);
  assert.deepEqual(overviewFigures([], undefined), { c: [], b: {}, k: [] });
});

test("members read the same from today's reads and from stored (JSON round-tripped) figures", () => {
  const censusBy = new Map([["a", [snap(2021, 300, null), snap(2022, 310, [250, 60])]]]);
  const adm = new Map([["a", { table: table([[2021, 11, 20, 20]]), ageGender: new Map([[11, { male: 20, female: 20 }]]) }]]);
  const raw = overviewMembersFromRaw(censusBy, adm);
  const stored = JSON.parse(JSON.stringify({ a: overviewFigures(censusBy.get("a")!, adm.get("a")), b: overviewFigures([], undefined) }));
  const store = overviewMembers((u) => stored[u]);
  for (const u of ["a", "b"]) {
    assert.deepEqual(store.census(u), raw.census(u));
    assert.deepEqual(store.bands(u), raw.bands(u));
    assert.deepEqual(store.entry(u), raw.entry(u));
  }
  assert.deepEqual(raw.census("a")[1], { period: 2022, totalRoll: 310, boarding: { day: 250, boarders: 60 } });
});
