// Run: npx -y tsx --test src/lib/tile-figures.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DATAVIEWS } from "@/catalogue";
import { teacherDashboardFor } from "@/catalogue/dashboards";
import { MEASURES } from "@/catalogue/measures";
import type { NumberType } from "@/catalogue/types";
import {
  TILE_FIGURES,
  addTile,
  applyMainLabel,
  applyTileFigures,
  defaultTileSpec,
  fillTileLabel,
  moveTile,
  moveTileTo,
  offeredFigures,
  readTileParams,
  removeTile,
  setTileHidden,
  setTileLabel,
  writeTileParams,
} from "./tile-figures";

// Candidates' tiles as CandidatesPanels builds them for a subject with all three.
const built = () => [
  { key: "category", detail: "of 5 in Sciences & Maths", vars: { total: 5 } },
  { key: "school", detail: "of 23 subjects at school", vars: { total: 23 } },
  { key: "change", detail: "since 2021/22", vars: { "from-year": "2021/22" } },
];
const DV = "DV-C1-CAND-CUR-TILES";
const shared = { subject: "Biology", category: "Sciences & Maths", school: "Acland Burghley School", year: "2024/25" };

test("a tile config round-trips through the instance params (and JSON)", () => {
  const spec = setTileLabel(setTileHidden(moveTile(defaultTileSpec(DV), "change", -1), "school", true), "category", "ranked [total] in [category]");
  const params = writeTileParams(DV, spec, "[subject] candidates, [year]");
  const back = readTileParams(JSON.parse(JSON.stringify({ numberType: "totals", look: "numerical", ...params })));
  assert.deepEqual(back, params);
  assert.deepEqual(back.tiles, [{ figure: "category", label: "ranked [total] in [category]" }, { figure: "change" }, { figure: "school", hidden: true }]);
  assert.equal(back.mainLabel, "[subject] candidates, [year]");
});

test("unset gives today's tiles exactly (same array, same objects)", () => {
  const b = built();
  assert.equal(applyTileFigures(b, readTileParams(undefined), shared), b);
  assert.equal(applyTileFigures(b, readTileParams({ numberType: "totals", title: "x" }), shared), b);
  assert.equal(applyTileFigures(b, null), b);
  const main = { figure: "120", label: "Biology entries in 2024/25" };
  assert.equal(applyMainLabel(main, readTileParams({}), shared), main);
  // The default list, saved, writes nothing: still unset.
  assert.deepEqual(writeTileParams(DV, defaultTileSpec(DV), null), {});
  // Every registered tiles view's default order draws the host's own tiles in its order.
  for (const id of Object.keys(TILE_FIGURES)) {
    const d = defaultTileSpec(id);
    const host = d.map((s) => ({ key: s.figure, detail: s.figure }));
    assert.deepEqual(applyTileFigures(host, { tiles: d }), host, id);
  }
});

test("a hidden tile is not drawn; a removed one neither; others keep their labels", () => {
  const out = applyTileFigures(built(), { tiles: setTileHidden(defaultTileSpec(DV), "school", true) }, shared);
  assert.deepEqual(out.map((t) => t.key), ["category", "change"]);
  assert.equal(out[0].detail, "of 5 in Sciences & Maths");
  assert.deepEqual(applyTileFigures(built(), { tiles: removeTile(defaultTileSpec(DV), "category") }).map((t) => t.key), ["school", "change"]);
  // Shown again: back in place.
  const again = setTileHidden(setTileHidden(defaultTileSpec(DV), "school", true), "school", false);
  assert.deepEqual(again, defaultTileSpec(DV));
});

test("reordering: up/down, past unlisted figures, and drag", () => {
  const d = defaultTileSpec(DV);
  assert.deepEqual(moveTile(d, "change", -1).map((s) => s.figure), ["category", "change", "school"]);
  assert.deepEqual(moveTile(d, "category", -1), d);
  assert.deepEqual(moveTile(d, "change", 1), d);
  // "school" not listed (e.g. not on this measure): "change" jumps over it to category's place.
  assert.deepEqual(moveTile(d, "change", -1, new Set(["category", "change"])).map((s) => s.figure), ["change", "school", "category"]);
  assert.deepEqual(moveTileTo(d, "change", "category").map((s) => s.figure), ["change", "category", "school"]);
  const drawn = applyTileFigures(built(), { tiles: moveTileTo(d, "change", "category") });
  assert.deepEqual(drawn.map((t) => t.key), ["change", "category", "school"]);
});

test("relabelling fills placeholders from the tile and the page; missing ones read as words", () => {
  const out = applyTileFigures(built(), { tiles: setTileLabel(defaultTileSpec(DV), "category", "of [total] [subject]-like subjects at [school]") }, shared);
  assert.equal(out[0].detail, "of 5 Biology-like subjects at Acland Burghley School");
  assert.equal(fillTileLabel("since [from-year] in [category]", {}), "since the first year in its category");
  assert.equal(fillTileLabel("of [total] in this set", { total: 1234 }), `of ${(1234).toLocaleString()} in this set`);
  assert.deepEqual(applyMainLabel({ figure: "5.3", label: "x" }, { mainLabel: "[subject] in [year]" }, shared), { figure: "5.3", label: "Biology in 2024/25" });
});

test("a figure that doesn't exist for this school or subject is dropped, as today", () => {
  // No category rank (only one subject in the category): the host never built it.
  const b = built().filter((t) => t.key !== "category");
  assert.deepEqual(applyTileFigures(b, { tiles: addTile(removeTile(defaultTileSpec(DV), "category"), "category") }).map((t) => t.key), ["school", "change"]);
  // An unknown figure in a saved list is ignored; duplicates read once.
  assert.deepEqual(readTileParams({ tiles: [{ figure: "x" }, { figure: "x" }, { nope: 1 }, "bad"] }).tiles, [{ figure: "x" }]);
});

test("Results' union order gives each measure today's order", () => {
  const d = defaultTileSpec("DV-C1-RES-CUR-TILES");
  const points = [{ key: "category", detail: "" }, { key: "england-average", detail: "" }, { key: "england", detail: "" }];
  const bands = [{ key: "count", detail: "" }, { key: "england-average", detail: "" }, { key: "england", detail: "" }];
  assert.deepEqual(applyTileFigures(points, { tiles: d }), points);
  assert.deepEqual(applyTileFigures(bands, { tiles: d }), bands);
});

test("only honest figures are offered for the measure", () => {
  const honestOf = (id: string) => new Set<NumberType>(MEASURES.find((m) => m.id === id)!.numberTypes);
  const pts = offeredFigures("DV-C1-RES-CUR-TILES", "points", honestOf("M-KS4-POINTS")).map((f) => f.id);
  assert.deepEqual(pts, ["category", "england-average", "england"]);
  // No % change is offered on points: a points measure doesn't declare pct_change.
  assert.equal(offeredFigures(DV, undefined, honestOf("M-KS4-POINTS")).some((f) => f.id === "change"), false);
  assert.deepEqual(offeredFigures(DV, undefined, honestOf("M-KS4-ENTRIES")).map((f) => f.id), ["category", "school", "change"]);
  // Bands: the range count, not the category rank.
  const bandsMeasure = MEASURES.find((m) => m.results === "bands" && m.phase === "ks4")!;
  assert.deepEqual(offeredFigures("DV-C1-RES-CUR-TILES", "bands", new Set(bandsMeasure.numberTypes)).map((f) => f.id), ["count", "england-average", "england"]);
});

test("the registry covers exactly the number-tiles views, and the seeded Teacher configs set nothing", () => {
  const tiles = DATAVIEWS.filter((d) => d.renderer === "RD-NUMBER-TILES").map((d) => d.id).sort();
  assert.deepEqual(Object.keys(TILE_FIGURES).sort(), tiles);
  for (const phase of ["ks4", "ks5"] as const)
    for (const mode of ["candidates", "results"] as const) {
      const cfg = teacherDashboardFor(phase, mode);
      for (const p of cfg.panels) for (const v of p.dataviews) if (v.kind === "view") assert.deepEqual(readTileParams(v.params), {}, `${cfg.id} ${v.id}`);
    }
});
