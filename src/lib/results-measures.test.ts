// 0.6 snagging round 3 / 03: the Results pill's view sets (src/catalogue/results.ts), the
// config renderer's filtered rails (rail.tsx) and the editor's ops for them.
// Run: npx -y tsx --test src/lib/results-measures.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEACHER_DASHBOARDS, teacherDashboardFor } from "@/catalogue/dashboards";
import { DATAVIEWS } from "@/catalogue";
import {
  RESULTS_MEASURES,
  configuredDefault,
  defaultOnResults,
  effectiveResults,
  followsResultsPill,
  tagForPill,
  viewsOnResults,
  withResults,
  withoutResults,
} from "@/catalogue/results";
import { contextFromPanel, pickResults } from "@/catalogue/pick";
import type { DashboardConfig, DataviewId, DataviewInstance, ResultsMeasure } from "@/catalogue/types";
import { configViewIds } from "@/components/dashboard-config/rail";
import * as ops from "./editor-ops";
import { copyToDashboard, newDashboardFromView, type CopyViewSource } from "./copy-view";

const gcse = () => teacherDashboardFor("ks4", "results");
const C1T = "vicdata.ks4.results.c1.trends";
const C1C = "vicdata.ks4.results.c1.current";
const C2T = "vicdata.ks4.results.c2.trends";
const view = (dataview: string, extra: Partial<DataviewInstance> = {}): DataviewInstance => ({ id: `x/${dataview}`, kind: "view", dataview: dataview as DataviewId, ...extra }) as DataviewInstance;
const panel = (c: DashboardConfig, id: string) => c.panels.find((p) => p.id === id)!;
const dvs = (c: DashboardConfig, id: string, m: ResultsMeasure) => viewsOnResults(panel(c, id), m).map((v) => (v.kind === "view" ? v.dataview : v.id));

test("effective measures: the dataview's default, or the instance's override within it", () => {
  assert.deepEqual(effectiveResults(view("DV-C2-TR-CHART")), RESULTS_MEASURES, "unset = all four");
  assert.deepEqual(effectiveResults(view("DV-C1-RES-TR-TABLE")), ["points", "threshold", "bands"]);
  assert.deepEqual(effectiveResults(view("DV-C1-CNT-TR-SPREAD")), ["counts"]);
  assert.deepEqual(effectiveResults(view("DV-C2-TR-CHART", { resultsMeasures: ["counts", "points"] })), ["points", "counts"], "override, in pill order");
  // Never wider than the dataview can draw.
  assert.deepEqual(effectiveResults(view("DV-C1-RES-TR-TABLE", { resultsMeasures: ["points", "counts"] })), ["points"]);
  // Written without an override when it matches the default.
  assert.equal("resultsMeasures" in withResults(view("DV-C1-RES-TR-TABLE"), ["points", "threshold", "bands", "counts"]), false);
  assert.deepEqual((withResults(view("DV-C2-TR-CHART"), ["bands"]) as { resultsMeasures?: string[] }).resultsMeasures, ["bands"]);
});

test("a config without the new fields gives today's rails, per pill (read from the hosts)", () => {
  const RES_CUR = ["DV-C1-RES-CUR-TILES", "DV-C1-RES-CUR-BAR", "DV-C1-RES-CUR-TABLE"];
  const RES_TR = ["DV-C1-RES-TR-CHART", "DV-C1-RES-TR-TABLE", "DV-C1-RES-TR-MAP", "DV-C1-RES-TR-GEO-CHART", "DV-C1-RES-TR-GEO-TABLE"];
  for (const phase of ["ks4", "ks5"] as const) {
    const c = teacherDashboardFor(phase, "results");
    const id = (col: string, row: string) => `vicdata.${phase}.results.${col}.${row}`;
    assert.ok(followsResultsPill(c));
    for (const m of ["points", "threshold"] as const) {
      assert.deepEqual(dvs(c, id("c1", "current"), m), RES_CUR);
      assert.deepEqual(dvs(c, id("c1", "trends"), m), RES_TR);
    }
    assert.deepEqual(dvs(c, id("c1", "current"), "bands"), ["DV-C1-RES-CUR-TILES", "DV-C1-RES-CUR-GRADES", "DV-C1-RES-CUR-BAR", "DV-C1-RES-CUR-TABLE"]);
    assert.deepEqual(dvs(c, id("c1", "current"), "counts"), ["DV-C1-CNT-CUR-DIST"]);
    assert.deepEqual(dvs(c, id("c1", "trends"), "counts"), ["DV-C1-CNT-TR-SPREAD", "DV-C1-CNT-TR-CHANGETABLE"]);
    // Context and Comparisons draw every view on every pill (host rules on top).
    for (const p of c.panels.filter((x) => x.column !== "c1"))
      for (const m of RESULTS_MEASURES) assert.deepEqual(viewsOnResults(p, m), p.dataviews, `${p.id} on ${m}`);
    // Every panel opens where it did: defaultView, no per-measure entries.
    for (const p of c.panels) for (const m of RESULTS_MEASURES) assert.equal(configuredDefault(p, m), p.defaultView);
  }
  for (const c of TEACHER_DASHBOARDS.filter((d) => d.id.endsWith(".candidates"))) assert.equal(followsResultsPill(c), false, `${c.id} has no pill`);
});

test("the filtered rail keeps config order", () => {
  let c = gcse();
  // Reorder Trends so a counts view sits between two points views, and tag one for counts.
  c = ops.reorderView(c, C1T, 6, 1);
  c = ops.setViewResults(c, `${C1T}/DV-C1-RES-TR-TABLE`, ["points"]);
  const p = panel(c, C1T);
  assert.deepEqual(configViewIds(p, "counts"), ["DV-C1-CNT-TR-CHANGETABLE", "DV-C1-CNT-TR-SPREAD"]);
  assert.deepEqual(configViewIds(p, "points"), ["DV-C1-RES-TR-CHART", "DV-C1-RES-TR-TABLE", "DV-C1-RES-TR-MAP", "DV-C1-RES-TR-GEO-CHART", "DV-C1-RES-TR-GEO-TABLE"]);
  assert.deepEqual(configViewIds(p, "threshold"), ["DV-C1-RES-TR-CHART", "DV-C1-RES-TR-MAP", "DV-C1-RES-TR-GEO-CHART", "DV-C1-RES-TR-GEO-TABLE"]);
  assert.deepEqual(configViewIds(p), p.dataviews.map((v) => (v.kind === "view" ? v.dataview : "")), "no pill: every view");
});

test("the default per measure, with fallback to defaultView", () => {
  let c = gcse();
  const table = `${C1T}/DV-C1-CNT-TR-CHANGETABLE`;
  // Grade counts: defaultView (the points chart) isn't on its rail, so its first view.
  assert.equal(defaultOnResults(panel(c, C1T), "counts"), `${C1T}/DV-C1-CNT-TR-SPREAD`);
  assert.ok(ops.isDefaultView(panel(c, C1T), `${C1T}/DV-C1-CNT-TR-SPREAD`, "counts"));
  c = ops.setDefaultView(c, C1T, table, "counts");
  const p = panel(c, C1T);
  assert.deepEqual(p.defaultViewByResults, { counts: table });
  assert.equal(p.defaultView, `${C1T}/DV-C1-RES-TR-CHART`, "the panel's own default is untouched");
  assert.equal(configuredDefault(p, "counts"), table);
  assert.equal(configuredDefault(p, "points"), p.defaultView, "no entry: falls back");
  assert.ok(ops.isDefaultView(p, table, "counts") && !ops.isDefaultView(p, table, "points"));
  assert.throws(() => ops.setDefaultView(c, C1T, `${C1T}/DV-C1-RES-TR-CHART`, "counts"), ops.EditorError, "not on Grade counts");
  // Taking the view off Grade counts, or removing it, drops its entry.
  assert.equal(panel(ops.setViewResults(gcse(), `${C2T}/DV-C2-TR-TABLE`, ["points"]), C2T).defaultViewByResults, undefined);
  const c2 = ops.setDefaultView(gcse(), C2T, `${C2T}/DV-C2-TR-TABLE`, "bands");
  assert.equal(panel(ops.setViewResults(c2, `${C2T}/DV-C2-TR-TABLE`, ["points"]), C2T).defaultViewByResults, undefined);
  assert.equal(panel(ops.removeView(c, table), C1T).defaultViewByResults, undefined);
  assert.throws(() => ops.setViewResults(c, table, []), ops.EditorError, "at least one measure");
  assert.equal(ops.validateConfig(c).problems.length, 0);
});

test("adding a view under a pill tags it for that measure", () => {
  // Context's Trend table under Grade counts: shown on Grade counts only.
  const tagged = tagForPill(view("DV-C2-TR-TABLE"), "counts");
  assert.deepEqual(tagged.kind === "view" && tagged.resultsMeasures, ["counts"]);
  const r = ops.addView(gcse(), C2T, tagged);
  const p = panel(r.config, C2T);
  assert.deepEqual(viewsOnResults(p, "counts").map((v) => v.id).at(-1), r.instanceId);
  assert.ok(!viewsOnResults(p, "points").some((v) => v.id === r.instanceId));
  // A counts-only dataview needs no tag; one that can't draw the pill keeps its default.
  assert.equal("resultsMeasures" in tagForPill(view("DV-C1-CNT-TR-SPREAD"), "counts"), false);
  assert.equal("resultsMeasures" in tagForPill(view("DV-C1-RES-TR-TABLE"), "counts"), false);
  // Pick, on Grade counts: the views drawn on it first.
  const ctx = contextFromPanel(gcse(), C1T, { results: "counts" });
  const order = pickResults(ctx, { superAdmin: true }).map((x) => x.dataview);
  const draws = order.map((dv) => (dv.resultsMeasures ?? RESULTS_MEASURES).includes("counts"));
  assert.ok(draws.indexOf(false) === -1 || draws.slice(draws.indexOf(false)).every((d) => !d));
  assert.ok(DATAVIEWS.some((d) => d.resultsMeasures));
});

test("move, copy and swap keep the measures; a copy to a non-Results dashboard drops them", () => {
  const c0 = ops.setViewResults(gcse(), `${C2T}/DV-C2-TR-TABLE`, ["counts"]);
  const moved = ops.moveView(c0, `${C2T}/DV-C2-TR-TABLE`, "vicdata.ks4.results.c3.trends");
  const mv = panel(moved.config, "vicdata.ks4.results.c3.trends").dataviews.find((v) => v.id === moved.instanceId)!;
  assert.deepEqual(effectiveResults(mv), ["counts"]);
  const copied = ops.copyView(c0, `${C2T}/DV-C2-TR-TABLE`, C1C);
  assert.deepEqual(effectiveResults(panel(copied.config, C1C).dataviews.find((v) => v.id === copied.instanceId)!), ["counts"]);
  const swapped = ops.replaceView(c0, `${C2T}/DV-C2-TR-TABLE`, view("DV-C2-TR-CHANGETABLE"));
  assert.deepEqual(effectiveResults(panel(swapped.config, C2T).dataviews.find((v) => v.id === swapped.instanceId)!), ["counts"]);

  const inst = { id: `${C2T}/DV-C2-TR-TABLE`, kind: "view" as const, dataview: "DV-C2-TR-TABLE" as const, resultsMeasures: ["counts" as const] };
  const source: CopyViewSource = { instance: inst, context: contextFromPanel(c0, C2T, { results: "points" }), pinned: { phase: "ks4" }, title: "Trend table" };
  const fresh = newDashboardFromView(source, { id: "mine", name: "Mine" });
  assert.equal(followsResultsPill(fresh), false);
  assert.equal("resultsMeasures" in fresh.panels[0].dataviews[0], false, "a new dashboard has no pill");
  const into = copyToDashboard(gcse(), { kind: "rail", panelId: C2T }, source, { superAdmin: true });
  assert.ok(into.ok, JSON.stringify(into).slice(0, 80));
  if (into.ok) {
    const v = panel(into.config, C2T).dataviews.find((x) => x.id === into.instanceId)!;
    assert.deepEqual(v.kind === "view" && v.resultsMeasures, ["counts"], "to a Results dashboard: kept");
  }
  assert.equal("resultsMeasures" in withoutResults(inst), false);
});

test("history compare says measure changes in plain words", () => {
  const added = ops.addView(gcse(), C2T, tagForPill(view("DV-C2-TR-TABLE"), "counts")).config;
  assert.match(ops.changeSummary(gcse(), added), /^Grade counts: added \*Results in its category, year by year\* to Context · Trends/);
  const off = ops.setViewResults(gcse(), `${C2T}/DV-C2-TR-TABLE`, ["points", "threshold"]);
  assert.match(ops.changeSummary(gcse(), off), /Grade bands, Grade counts: removed \*Results in its category, year by year\* from Context · Trends/);
  const def = ops.setDefaultView(gcse(), C1T, `${C1T}/DV-C1-CNT-TR-CHANGETABLE`, "counts");
  assert.match(ops.changeSummary(gcse(), def), /Grade counts: \*This subject's entries at each grade: .* against .*, with the change\* is now the default in Results · Trends/);
  assert.match(ops.changeSummary(gcse(), ops.removeView(gcse(), `${C1T}/DV-C1-CNT-TR-SPREAD`)), /^Grade counts: removed \*This subject's spread of grades: /);
});
