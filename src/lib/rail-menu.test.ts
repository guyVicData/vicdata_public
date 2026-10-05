// VicData 0.6.1 S5: the rail icon menu (RailMenu.dc.html) -- Take off [measure] against
// Remove everywhere (pinch point 6: removing on one measure unticks only that measure), and
// the "Shows for" chips (greyed from S4's honest options).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEACHER_DASHBOARDS } from "@/catalogue/dashboards";
import { effectiveResults } from "@/catalogue/results";
import type { DashboardConfig, DataviewInstance } from "@/catalogue/types";
import * as ops from "./editor-ops";
import { showsForRows, toggledStates } from "./rail-menu";

const gcse = () => structuredClone(TEACHER_DASHBOARDS.find((d) => d.id === "vicdata.ks4.results")!) as DashboardConfig;
const all = (c: DashboardConfig) => c.panels.flatMap((p) => p.dataviews);
const find = (c: DashboardConfig, suffix: string) => all(c).find((v) => v.id.endsWith(suffix))!;
const LABELS = { results: { name: "Results", labels: { points: "Average points", threshold: "Grade 4+ rate", bands: "Grade bands", counts: "Grade counts" } } };
const others = (c: DashboardConfig, id: string) => all(c).filter((v) => v.id !== id);

test("Take off Grade bands: the view stays, on Average points and Grade 4+ only; nothing else changes", () => {
  const c = gcse();
  const geo = find(c, "DV-C1-RES-TR-GEO-CHART");
  assert.deepEqual(effectiveResults(geo), ["points", "threshold", "bands"]);
  const n = ops.takeOffState(c, geo.id, "results", "bands");
  const after = find(n, "DV-C1-RES-TR-GEO-CHART");
  assert.ok(after, "still in the config");
  assert.deepEqual(effectiveResults(after), ["points", "threshold"]);
  assert.equal(all(n).length, all(c).length);
  assert.deepEqual(others(n, geo.id), others(c, geo.id));
  // Same panel, same place in the rail.
  const panel = (x: DashboardConfig) => x.panels.find((p) => p.dataviews.some((v) => v.id === geo.id))!;
  assert.equal(panel(n).dataviews.findIndex((v) => v.id === geo.id), panel(c).dataviews.findIndex((v) => v.id === geo.id));
});

test("Remove everywhere: the view goes from every measure", () => {
  const c = gcse();
  const geo = find(c, "DV-C1-RES-TR-GEO-CHART");
  const n = ops.removeView(c, geo.id);
  assert.equal(all(n).some((v) => v.id === geo.id), false);
  assert.equal(all(n).length, all(c).length - 1);
  assert.deepEqual(others(n, geo.id), others(c, geo.id));
});

test("Take off is undone by ticking it again; taking a view off its only measure is refused (use Remove everywhere)", () => {
  const c = gcse();
  const geo = find(c, "DV-C1-RES-TR-GEO-CHART");
  let n = ops.takeOffState(c, geo.id, "results", "bands");
  n = ops.takeOffState(n, geo.id, "results", "threshold");
  assert.deepEqual(effectiveResults(find(n, "DV-C1-RES-TR-GEO-CHART")), ["points"]);
  assert.throws(() => ops.takeOffState(n, geo.id, "results", "points"), (e: unknown) => e instanceof ops.EditorError && /Remove everywhere/.test((e as Error).message));
  // Not shown there at all: refused too.
  assert.throws(() => ops.takeOffState(n, geo.id, "results", "bands"), ops.EditorError);
  const back = ops.setViewStates(n, geo.id, "results", ["points", "threshold", "bands"]);
  assert.deepEqual(find(back, "DV-C1-RES-TR-GEO-CHART"), find(c, "DV-C1-RES-TR-GEO-CHART"));
  // The Grades view is Grade bands only: Take off has nothing to leave it on.
  const grades = find(c, "DV-C1-RES-CUR-GRADES");
  assert.throws(() => ops.takeOffState(c, grades.id, "results", "bands"), ops.EditorError);
});

test("Take off drops the view as that measure's default, and only that one", () => {
  const c = gcse();
  const panel = c.panels.find((p) => p.id === "vicdata.ks4.results.c1.trends")!;
  const table = panel.dataviews.find((v) => v.id.endsWith("DV-C1-RES-TR-TABLE"))!;
  let n = ops.setDefaultView(c, panel.id, table.id, { results: "bands" });
  n = ops.setDefaultView(n, panel.id, table.id, { results: "points" });
  n = ops.takeOffState(n, table.id, "results", "bands");
  const p = n.panels.find((x) => x.id === panel.id)!;
  assert.equal(p.defaultViewByResults?.bands, undefined);
  assert.equal(p.defaultViewByResults?.points, table.id);
});

test("Shows for: a chip per Results measure, ticked where it shows; Grade counts greyed with S4's reason", () => {
  const c = gcse();
  const panel = c.panels.find((p) => p.id === "vicdata.ks4.results.c1.trends")!;
  const chart = panel.dataviews.find((v) => v.id.endsWith("DV-C1-RES-TR-CHART")) as DataviewInstance;
  const rows = showsForRows(c, panel, chart, LABELS);
  assert.equal(rows.length, 1);
  const chips = rows[0].chips;
  assert.deepEqual(chips.map((x) => x.label), ["Avg points", "Grade 4+", "Bands", "Counts"]);
  assert.deepEqual(chips.map((x) => x.on), [true, true, true, false]);
  const counts = chips.find((x) => x.state === "counts")!;
  assert.equal(counts.ok, false);
  assert.match(counts.reason ?? "", /Grade spread/);
  // Clicking a ticked chip unticks only it; a greyed one does nothing.
  assert.deepEqual(toggledStates(rows[0], "bands"), ["points", "threshold"]);
  assert.equal(toggledStates(rows[0], "counts"), null);
  // Post-16 says A*–E.
  const ks5 = structuredClone(TEACHER_DASHBOARDS.find((d) => d.id === "vicdata.ks5.results")!) as DashboardConfig;
  const p5 = ks5.panels.find((p) => p.id === "vicdata.ks5.results.c1.trends")!;
  assert.equal(showsForRows(ks5, p5, p5.dataviews[0], LABELS)[0].chips[1].label, "A*–E");
});

test("Shows for: the last ticked chip is locked; Context panels get a Compare against row too", () => {
  const c = gcse();
  const panel = c.panels.find((p) => p.id === "vicdata.ks4.results.c1.current")!;
  const dist = panel.dataviews.find((v) => v.id.endsWith("DV-C1-CNT-CUR-DIST"))!;
  const row = showsForRows(c, panel, dist, LABELS)[0];
  const on = row.chips.filter((x) => x.on);
  assert.deepEqual(on.map((x) => x.state), ["counts"]);
  assert.equal(on[0].last, true);
  assert.equal(toggledStates(row, "counts"), null);
  const ctx = c.panels.find((p) => p.id === "vicdata.ks4.results.c2.current")!;
  const rows = showsForRows(c, ctx, ctx.dataviews[0], { ...LABELS, compareAgainst: { name: "Compare against", labels: { category: "Subject category", whole: "All subjects", selected: "Selected subjects" } } });
  assert.deepEqual(rows.map((r) => r.axis), ["results", "compareAgainst"]);
  // A Candidates dashboard has no Results row.
  const cand = structuredClone(TEACHER_DASHBOARDS.find((d) => d.id === "vicdata.ks4.candidates")!) as DashboardConfig;
  const cp = cand.panels.find((p) => p.id === "vicdata.ks4.candidates.c1.trends")!;
  assert.deepEqual(showsForRows(cand, cp, cp.dataviews[0], LABELS), []);
});
