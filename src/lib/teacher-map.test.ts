// VicData 0.6.3 S2: the Teacher maps' encoding (src/lib/teacher-map.ts). R-MAP-ENCODING.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RAG_DIVERGING_STOPS, RANK_SEQ_STOPS, changeMapFrom, colourAt, currentMapFrom, mapResultOf, teacherMapFills, type MapSeries } from "./teacher-map";
import { GCSE_SCALE } from "./subject-grades";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

test("R-MAP-ENCODING: the rank scale darkens steadily (reads without hue) and is not the change scale's hues", () => {
  for (let i = 1; i < RANK_SEQ_STOPS.length; i++) assert.ok(lum(RANK_SEQ_STOPS[i].hex) < lum(RANK_SEQ_STOPS[i - 1].hex), RANK_SEQ_STOPS[i].hex);
  assert.ok(lum(RANK_SEQ_STOPS[0].hex) < 0.6, "the lightest rank tint still shows on a white card");
  const shared = RANK_SEQ_STOPS.filter((s) => RAG_DIVERGING_STOPS.some((d) => d.hex === s.hex));
  assert.equal(shared.length, 0);
});

test("R-MAP-ENCODING: the change scale is pale at zero and symmetric in lightness either side", () => {
  const mid = lum(colourAt(RAG_DIVERGING_STOPS, 0.5));
  for (const d of [0.25, 0.5]) {
    const lo = lum(colourAt(RAG_DIVERGING_STOPS, 0.5 - d));
    const hi = lum(colourAt(RAG_DIVERGING_STOPS, 0.5 + d));
    assert.ok(lo < mid && hi < mid);
    assert.ok(Math.abs(lo - hi) < 0.12, `similar lightness at ±${d}`);
  }
});

const series = (over: Partial<MapSeries> = {}): MapSeries => ({
  periods: [2022, 2023, 2024],
  schools: [
    { urn: "own", values: [60, 64, 70], entries: [100, 110, 120] },
    { urn: "a", values: [70, 72, 80], entries: [50, 50, 58] },
    { urn: "b", values: [55, null, 50], entries: [30, 0, 40] },
    { urn: "c", values: [null, null, null], entries: [3, 3, 3], tooFew: true },
  ],
  measure: { id: "threshold", changeKind: "pp", format: (v) => `${Math.round(v)}%`, formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}pp` },
  result: { name: "Grade 4+", noun: "Grade 4+ rate", kind: "rate" },
  subjectLabel: "History",
  theme: "dark",
  ...over,
});

test("R-MAP-ENCODING: Results Current -- rank colour, the result first in the hover, rank on the same figure", () => {
  const spec = currentMapFrom(series(), 2);
  assert.equal(spec.colour, "rank");
  assert.deepEqual(spec.dots.a.lines, ["Grade 4+: 80% (46 of 58)", "58 entries (2024/25)"]);
  assert.deepEqual(spec.dots.c.lines, ["Too few entries", "3 entries (2024/25)"]);
  assert.equal(spec.legend, "Darker purple = higher Grade 4+ rate in the set");
  const { fill, rank } = teacherMapFills(spec, ["own", "a", "b", "c", "nofig"], "own");
  assert.deepEqual(rank, { rank: 2, total: 3 });
  assert.equal(fill.get("a"), RANK_SEQ_STOPS[RANK_SEQ_STOPS.length - 1].hex, "top = deepest");
  assert.equal(fill.get("c"), null, "too few: hollow");
  assert.equal(fill.get("nofig"), null, "no figure: hollow");
});

test("R-MAP-ENCODING: Candidates Current -- no colour, entries only", () => {
  const spec = currentMapFrom(series({ result: { name: "Entries", noun: "entries", kind: "entries" }, measure: { id: "entries", changeKind: "percent", format: String, formatDelta: String } }), 2);
  assert.equal(spec.colour, "none");
  assert.equal(spec.legend, null);
  assert.deepEqual(spec.dots.own.lines, ["120 entries (2024/25)"]);
});

test("R-MAP-ENCODING: a Trends map -- the change first, diverging, symmetric ends", () => {
  const spec = changeMapFrom(series(), [2022, 2023, 2024], "absolute", (v) => {
    const r = v.filter((x): x is number => x !== null);
    return r.length >= 2 ? r[r.length - 1] - r[0] : null;
  });
  assert.equal(spec.colour, "diverging");
  assert.deepEqual(spec.dots.own.lines, ["+10pp since 2022/23", "120 entries (2024/25)"]);
  assert.deepEqual(spec.ends, ["−10pp", "+10pp"]);
  const { fill } = teacherMapFills(spec, ["own", "b"], "own");
  assert.equal(fill.get("own"), RAG_DIVERGING_STOPS[4].hex);
  assert.equal(fill.get("b"), colourAt(RAG_DIVERGING_STOPS, 0.25));
});

test("R-MAP-ENCODING: the figure's name -- a range by its wording, a rate without 'rate'", () => {
  assert.deepEqual(mapResultOf({ id: "bands", label: "Share at grade 9", changeKind: "pp" }, { scale: GCSE_SCALE, top: "9", bottom: "9" }, true), { name: "Grade 9", noun: "share at grade 9", kind: "rate" });
  assert.equal(mapResultOf({ id: "threshold", label: "Grade 4+ rate", changeKind: "pp" }, null, true).name, "Grade 4+");
  assert.equal(mapResultOf({ id: "points", label: "Average point score", changeKind: "points" }, null, true).name, "Average points");
});
