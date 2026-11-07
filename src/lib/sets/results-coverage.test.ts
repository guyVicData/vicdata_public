// VicData 0.8 Sets r1 (F25): the GCSE / post-16 rule for a set (results-coverage.ts).
// Run: npx -y tsx --test src/lib/sets/results-coverage.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { IGCSE_SWITCH_SHARE, resultsMeasureFor, switchedLine, type ResultsCoverageSchool } from "./results-coverage";

const set = (noGcse: number, of: number, o: { noPost16?: number; igcse?: number } = {}): ResultsCoverageSchool[] =>
  Array.from({ length: of }, (_, i) => ({ urn: String(100000 + i), hasGcse: i >= noGcse, hasPost16: i >= (o.noPost16 ?? 0), igcse: i < (o.igcse ?? noGcse) }));

test("the threshold is 40%, and over it (not at it) switches", () => {
  assert.equal(IGCSE_SWITCH_SHARE, 0.4);
  assert.equal(resultsMeasureFor(11, set(4, 10)).measure, "gcse");
  const r = resultsMeasureFor(11, set(5, 10));
  assert.equal(r.measure, "post16");
  assert.equal(r.switched, true);
  assert.deepEqual([r.noGcse, r.of, r.noPost16], [5, 10, 0]);
});

test("on GCSE the schools without it are left out, in order; on post-16 those without post-16", () => {
  const g = resultsMeasureFor(11, set(2, 10, { noPost16: 6 }));
  assert.deepEqual(g.leftOut, ["100000", "100001"]);
  const p = resultsMeasureFor(11, set(6, 10, { noPost16: 1 }));
  assert.equal(p.measure, "post16");
  assert.deepEqual(p.leftOut, ["100000"]);
});

test("over 40% but post-16 covers no more of the set (preps, no sixth forms): stays on GCSE", () => {
  assert.equal(resultsMeasureFor(11, set(6, 10, { noPost16: 6 })).measure, "gcse");
  assert.equal(resultsMeasureFor(11, set(6, 10, { noPost16: 8 })).switched, false);
});

test("16+ is post-16 and 4+ KS2, whatever the share; an empty set stays on GCSE", () => {
  const s16 = resultsMeasureFor(16, set(9, 10, { noPost16: 3 }));
  assert.deepEqual([s16.measure, s16.switched, s16.leftOut.length], ["post16", false, 3]);
  assert.equal(resultsMeasureFor(4, set(9, 10)).measure, "ks2");
  assert.deepEqual([resultsMeasureFor(11, []).measure, resultsMeasureFor(11, []).switched], ["gcse", false]);
});

test("the line under the title, with real counts", () => {
  assert.equal(switchedLine(resultsMeasureFor(11, set(6, 10, { igcse: 5 }))), "Post-16 results: 6 of 10 rivals have no GCSE results (mostly IGCSE)");
  assert.equal(switchedLine(resultsMeasureFor(11, set(6, 10, { igcse: 2 }))), "Post-16 results: 6 of 10 rivals have no GCSE results (2 IGCSE)");
  assert.equal(switchedLine(resultsMeasureFor(11, set(6, 10, { igcse: 0 })), "schools"), "Post-16 results: 6 of 10 schools have no GCSE results");
  assert.equal(switchedLine(resultsMeasureFor(11, set(2, 10))), null);
});
