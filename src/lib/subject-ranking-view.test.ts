// VicData 0.6.6: the subject ranking's table window and words (src/lib/subject-ranking-view.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { subjectChangeTableSeries, subjectRankingNote, subjectTileDetails, windowCut } from "./subject-ranking-view";
import type { SubjectRanking } from "./subject-ranking";

const rows = (positions: number[], target: number | null) => positions.map((pos) => ({ pos, isTarget: pos === target }));
const shape = (cut: ({ pos: number } | null)[]) => cut.map((r) => (r === null ? "…" : r.pos)).join(" ");
const serverWindow = (target: number, total: number) => {
  const keep = new Set<number>();
  for (let p = 1; p <= Math.min(10, total); p++) keep.add(p);
  for (let p = Math.max(1, target - 10); p <= Math.min(total, target + 10); p++) keep.add(p);
  for (let p = total - 2; p <= total; p++) keep.add(p);
  return [...keep].sort((a, b) => a - b);
};

test("R-RANKING-MEASURE: the card is the top 3, a break, then 5 either side of the school", () => {
  assert.equal(shape(windowCut(rows(serverWindow(312, 3602), 312), false)), "1 2 3 … 307 308 309 310 311 312 313 314 315 316 317");
});

test("R-RANKING-MEASURE: a school in the top 8 is one continuous block on the card", () => {
  assert.equal(shape(windowCut(rows(serverWindow(8, 3602), 8), false)), "1 2 3 4 5 6 7 8 9 10 11 12 13");
  assert.equal(shape(windowCut(rows(serverWindow(9, 3602), 9), false)), "1 2 3 4 5 6 7 8 9 10 11 12 13 14");
});

test("R-RANKING-MEASURE: full screen is the top 10, 10 either side and the bottom 3, with breaks", () => {
  const cut = shape(windowCut(rows(serverWindow(312, 3602), 312), true));
  assert.equal(cut, "1 2 3 4 5 6 7 8 9 10 … " + Array.from({ length: 21 }, (_, i) => 302 + i).join(" ") + " … 3600 3601 3602");
});

test("R-RANKING-MEASURE: the words name the population and who is left out", () => {
  const d = { period: 2024, matched: 6139, ranked: 3565, noFigure: 2500, belowMin: 74, inRanking: true, targetRank: 988, target: { period: 2024, value: 75.76, n: 132 }, average: [{ period: 2024, value: 70, schools: 3565 }] } as unknown as SubjectRanking;
  assert.equal(
    subjectRankingNote(d, "The Chase", "GCSE History results", "2024/25", 5),
    "The Chase ranks 988th of 3,565 schools with GCSE History results in 2024/25. 6,139 schools are in this ranking; 2,500 have no figure that year and 74 have fewer than 5 entries. The table shows the top and the schools around The Chase.",
  );
  assert.deepEqual(subjectTileDetails(d, "GCSE History results", "2024/25"), { rankDetail: "of 3,565 schools with GCSE History results, 2024/25", averageDetail: "average across these 3,565 schools" });
  const out = { ...d, inRanking: false, ranked: 308, targetRank: 258 } as SubjectRanking;
  assert.match(subjectRankingNote(out, "The Chase", "GCSE History results", "2024/25", 5), /^The Chase is not itself in this ranking\. Placed against its 307 schools with GCSE History results in 2024\/25, it would be 258th\./);
});

test("R-RANKING-MEASURE: the change table's rows are the population change window at real ranks, never 1..N", () => {
  const window = [{ urn: "a", pos: 1, rank: 1, value: 3 }, { urn: "t", pos: 2249, rank: 2249, value: -0.2 }, { urn: "b", pos: 2250, rank: 2249, value: -0.2 }];
  const schools = [{ urn: "a", name: "A", values: [3.7, null, 6.7] }, { urn: "t", name: "The Chase", values: [5, null, 4.8] }, { urn: "b", name: "B", values: [4, null, 3.8] }];
  const rows = subjectChangeTableSeries(window, schools, [2022, 2023, 2024], [2022, 2024], "t", "The Chase", { own: "o", other: "x" });
  assert.deepEqual(rows.map((r) => [r.key, r.rank, r.pos, r.values]), [["a", 1, 1, [3.7, 6.7]], ["own", 2249, 2249, [5, 4.8]], ["b", 2249, 2250, [4, 3.8]]]);
  assert.equal(shape(windowCut(rows.map((r) => ({ pos: r.pos, isTarget: r.key === "own" })), false)), "1 … 2249 2250");
});
