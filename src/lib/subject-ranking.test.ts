// VicData 0.6.6: the subject ranking's definition (src/lib/subject-ranking.ts rankFigures) on
// small synthetic populations -- the SQL function mirrors it, and the parity scripts compare the
// two on real data (scripts/subject-ranking-cases.ts, the ingest repo's PGlite test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFigures, RANK_BOTTOM, RANK_WINDOW, type Figures, type SubjectRankingRequest } from "./subject-ranking";

const req = (urns: string[], target: string, kind: "points" | "entries" | "threshold" = "points"): SubjectRankingRequest => ({
  urns,
  targetUrn: target,
  phase: "ks4",
  subject: "History",
  familyId: "humanities_social",
  qualificationType: null,
  measure: { kind },
  period: null,
});
const figs = (rows: [string, number, number | null, number | null][]): Figures => {
  const out: Figures = new Map();
  for (const [u, p, value, n] of rows) (out.get(u) ?? out.set(u, new Map()).get(u)!).set(p, { value, n });
  return out;
};

test("R-RANKING-MEASURE: ties share a rank and the next rank skips; order breaks ties by URN", () => {
  const r = rankFigures(req(["a", "b", "c", "d"], "c"), figs([["a", 2024, 6, 20], ["b", 2024, 5, 20], ["c", 2024, 5, 20], ["d", 2024, 4, 20]]));
  assert.equal(r.ranked, 4);
  assert.deepEqual(r.window.map((w) => [w.urn, w.pos, w.rank]), [["a", 1, 1], ["b", 2, 2], ["c", 3, 2], ["d", 4, 4]]);
  assert.equal(r.targetRank, 2);
});

test("R-MIN-ENTRIES: under 5 entries is not ranked (counted as belowMin); entries rank from 1", () => {
  const f = figs([["a", 2024, 6, 4], ["b", 2024, 5, 20], ["c", 2024, null, null]]);
  const r = rankFigures(req(["a", "b", "c", "d"], "b"), f);
  assert.equal(r.ranked, 1);
  assert.equal(r.belowMin, 1);
  assert.equal(r.noFigure, 2, "c has no value, d no row");
  const e = rankFigures(req(["a", "b"], "a", "entries"), figs([["a", 2024, 3, 3], ["b", 2024, 12, 12]]));
  assert.equal(e.ranked, 2);
  assert.equal(e.targetRank, 2);
});

test("R-RANKING-MEASURE: a school its filters exclude is placed against the population, not averaged in", () => {
  const r = rankFigures(req(["a", "b"], "x"), figs([["a", 2024, 6, 20], ["b", 2024, 4, 20], ["x", 2024, 5, 20]]));
  assert.equal(r.inRanking, false);
  assert.equal(r.targetRank, 2);
  assert.equal(r.ranked, 3, "the order includes the placed school");
  assert.equal(r.averageLatest, 5, "the average is the ranking's own schools: (6 + 4) / 2");
  assert.equal(r.matched, 2);
});

test("R-CURRENT-GRADES-FROM-2324: a rate's default year is the latest from 2023/24, points the latest", () => {
  const f = figs([["a", 2022, 50, 20], ["a", 2024, 60, 20], ["b", 2022, 40, 20]]);
  assert.equal(rankFigures(req(["a", "b"], "a", "threshold"), f).period, 2024);
  const onlyOld = figs([["a", 2022, 50, 20]]);
  assert.equal(rankFigures(req(["a"], "a", "threshold"), onlyOld).period, null);
  assert.equal(rankFigures(req(["a"], "a", "points"), onlyOld).period, 2022);
});

test("R-TREND-FROM-2223 / R-NUMBER-TYPE-HONESTY: the change list is from 2022/23, entries in %", () => {
  const f = figs([["a", 2022, 10, 10], ["a", 2024, 15, 15], ["b", 2022, 20, 20], ["b", 2024, 10, 10]]);
  const pts = rankFigures(req(["a", "b"], "a", "points"), f);
  assert.equal(pts.change?.from, 2022);
  assert.equal(pts.change?.target, 5);
  assert.deepEqual(pts.change?.window.map((w) => [w.urn, w.rank, w.value]), [["a", 1, 5], ["b", 2, -10]]);
  const ent = rankFigures(req(["a", "b"], "a", "entries"), f);
  assert.equal(ent.change?.target, 50);
  assert.equal(ent.change?.average, (50 - 50) / 2);
});

test("R-RANKING-MEASURE: the window is the top 10, 10 either side of the school and the bottom 3", () => {
  const urns = Array.from({ length: 60 }, (_, i) => `u${String(i).padStart(2, "0")}`);
  const f = figs(urns.map((u, i) => [u, 2024, 100 - i, 20] as [string, number, number, number]));
  const r = rankFigures(req(urns, "u30"), f);
  const pos = r.window.map((w) => w.pos);
  const want = [...Array.from({ length: RANK_WINDOW }, (_, i) => i + 1), ...Array.from({ length: 2 * RANK_WINDOW + 1 }, (_, i) => 31 - RANK_WINDOW + i), ...Array.from({ length: RANK_BOTTOM }, (_, i) => 60 - RANK_BOTTOM + 1 + i)];
  assert.deepEqual(pos, want);
  assert.deepEqual(Object.keys(r.windowSeries).sort(), [...new Set(r.window.map((w) => w.urn))].sort());
});
