// VicData 0.8 IGCSE subjects (follow-up 2): the one ranking (R-RANK-TIES).
// Run: npx -y tsx --test src/lib/rank.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { competitionRanks, placeAmong } from "./rank";
import { rankByValue } from "./teacher-view-panels";
import { ranksOf } from "./admissions/stats";
import { rankIn } from "./admissions/ranks";
import { rankWithin } from "./groups/dash";
import { rankDescendingWithTies } from "./data-view-cards";

const rows = [{ key: "a", value: 9 }, { key: "b", value: 7 }, { key: "c", value: 7 }, { key: "d", value: 5 }, { key: "e", value: null }];

test("standard competition ranking: two at 2nd, then 4th; no figure, no place", () => {
  const r = competitionRanks(rows);
  assert.deepEqual(Object.fromEntries(r), { a: { rank: 1, of: 4, tied: false }, b: { rank: 2, of: 4, tied: true }, c: { rank: 2, of: 4, tied: true }, d: { rank: 4, of: 4, tied: false } });
  assert.deepEqual(placeAmong([9, 7, 7, 5], 7), { rank: 2, of: 4, tied: true });
});

test("every older helper agrees with it", () => {
  const want = { a: 1, b: 2, c: 2, d: 4 };
  assert.deepEqual(Object.fromEntries(rankByValue(rows)), want);
  assert.deepEqual(Object.fromEntries(ranksOf(rows)), want);
  assert.deepEqual(Object.fromEntries(Array.from(rankWithin(rows), ([k, p]) => [k, p.rank])), want);
  assert.deepEqual(rankIn([9, 7, 7, 5], 7), { rank: 2, of: 4 });
  const dv = rankDescendingWithTies(rows.map((r) => ({ urn: r.key, name: r.key, value: r.value, isTarget: r.key === "c" })));
  assert.deepEqual(dv.ranked.map((x) => [x.urn, x.rank]), [["a", 1], ["b", 2], ["c", 2], ["d", 4]]);
  assert.equal(dv.targetRank, 2);
});
