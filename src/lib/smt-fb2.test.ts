// Run: npx -y tsx --test --test-force-exit src/lib/smt-fb2.test.ts
// VicData 0.8 SMT feedback round 2: the selected set drives SMT Overview -- the pure parts.
//   setSizeOf    F-10: a phase's place by size in the set (largest first, ties share) and the set's median
//   setAverage   F-11 (R-ROLL-INDEXED-SET): the set's average roll over its schools with every year
import { test } from "node:test";
import assert from "node:assert/strict";
import { setAverage, setSizeOf } from "./smt/overview";

test("F-10: size by phase is a place in the set and the set's median", () => {
  assert.deepEqual(setSizeOf(386, [500, 300, 386, 120, 0, 0]), { rank: 2, of: 5, median: 343, schools: 4 });
  // Schools without the phase (0 pupils) aren't counted; alone in the set, first of one.
  assert.deepEqual(setSizeOf(195, [0, 0]), { rank: 1, of: 1, median: null, schools: 0 });
});

test("R-ROLL-INDEXED-SET: the set's average is over schools with a figure in every year", () => {
  const years = [2019, 2020, 2021];
  const avg = setAverage([[100, 110, 120], [200, 210, 220], [50, null, 60], [0, 10, 10]], years)!;
  assert.equal(avg.schools, 2, "a school missing a year, or with none, is left out");
  assert.deepEqual(avg.pts.map((p) => p.value), [150, 160, 170]);
  assert.equal(setAverage([[null, null, null]], years), null, "no school with every year: no line");
});
