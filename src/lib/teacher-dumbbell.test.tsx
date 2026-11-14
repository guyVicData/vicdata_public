// Run: npx -y tsx --test --test-force-exit src/lib/teacher-dumbbell.test.tsx
// VicData 0.8 front door 2b (M2): R-DUMBBELL on the dashboard -- "Change (dumbbell)" on the GCSE and Post-16
// Candidates dashboards' Context › Trends rail, after Ranked change, drawn by its host from the panel's own
// figures (the pill's subjects, the From menu's span, the group's average). No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TEACHER_DASHBOARDS } from "../catalogue/dashboards/teacher";
import { dataviewById, dataviewForRail } from "../catalogue/dataviews";
import { presetSpec } from "../catalogue/viewspec";
import "../components/views/index";
import { renderView } from "../components/views/registry";
import { DumbbellView } from "../components/teacher/DumbbellView";
import { dashboardDumbbell, dumbbellSentence } from "./teacher-dumbbell";

const ROOT = path.join(__dirname, "../..");
const trendsOf = (id: string) => TEACHER_DASHBOARDS.find((d) => d.id === id)!.panels.find((p) => p.column === "c2" && p.row === "trends")!.dataviews.map((v) => (v.kind === "view" ? v.dataview : null));

test("R-DUMBBELL: on both Candidates dashboards' Context › Trends, right after Ranked change; not on Results", () => {
  for (const id of ["vicdata.ks4.candidates", "vicdata.ks5.candidates"]) {
    const t = trendsOf(id);
    assert.equal(t[t.indexOf("DV-C2-TR-CHANGELIST") + 1], "DV-C2-TR-DUMBBELL", id);
    assert.equal(t.filter((x) => x === "DV-C2-TR-DUMBBELL").length, 1);
  }
  for (const id of ["vicdata.ks4.results", "vicdata.ks5.results"]) assert.ok(!trendsOf(id).includes("DV-C2-TR-DUMBBELL"), id);
});

test("R-DUMBBELL: the catalogue names its rail button, its icon and its own kind, drawn by the host", () => {
  const dv = dataviewById("DV-C2-TR-DUMBBELL")!;
  assert.equal(dv.status, "live");
  assert.equal(dv.railIcon, "DumbbellIcon");
  assert.equal(dataviewForRail("teacher.c2.context", "trend", "Change (dumbbell)")?.id, "DV-C2-TR-DUMBBELL");
  const spec = presetSpec("DV-C2-TR-DUMBBELL");
  assert.equal(spec.view.kind, "dumbbell");
  assert.equal(spec.data.source, "academic.candidates");
  // No builder: the config renderer hands the view back to Context's host (as the Admissions kinds).
  assert.equal(renderView(spec, { kind: "subjects" } as never, { fullscreen: false, params: null } as never), null);
  // The host's button sits between Ranked change and Change table, on Context's entries only.
  const host = readFileSync(path.join(ROOT, "src/components/teacher/SubjectPanels.tsx"), "utf8");
  const a = host.indexOf('label={geography ? "Area chart" : "Ranked change"}');
  const b = host.indexOf('label="Change (dumbbell)"');
  const c = host.indexOf('label="Change table"');
  assert.ok(a > 0 && b > a && c > b, "Ranked change, the dumbbell, Change table");
  assert.match(host, /const dumbbellOffered = redesigned && !geography && columnId === "context" && measure\.id === "entries";/);
});

const span = {
  periods: [2022, 2023, 2024],
  series: [
    { key: "geog", label: "Geography", colour: "#34d399", values: [62, 70, 84] },
    { key: "hist", label: "History", colour: "#888", values: [95, 90, 92] },
    { key: "fren", label: "French", colour: "#777", values: [80, 70, 64] },
    { key: "lat", label: "Latin", colour: "#666", values: [null, 4, 6] },
    { key: "rs", label: "Religious Studies", colour: "#555", values: [50, 55, 61] },
    { key: "group-0", label: "Humanities", colour: "#999", values: [70, 71, 74] },
  ],
};

test("R-DUMBBELL: largest this year first, the focus marked, the group's average dashed last, change in entries", () => {
  const d = dashboardDumbbell(span, { focusKey: "geog", shortLabels: new Map([["rs", "RS"]]), group: { label: "Humanities" } })!;
  assert.deepEqual(d.rows.map((r) => r.label), ["History", "Geography", "French", "Religious Studies"]);
  assert.deepEqual(d.rows.map((r) => r.change), [-3, 22, -16, 11]);
  assert.equal(d.rows.find((r) => r.focus)?.key, "geog");
  assert.equal(d.rows.find((r) => r.key === "rs")?.shortLabel, "RS");
  assert.deepEqual(d.average, { label: "Humanities average", first: 70, latest: 74, change: 4 });
  assert.equal(d.leftOut, 1, "Latin has no first-year figure");
  assert.equal(d.firstPeriod, 2022);
  assert.equal(d.latestPeriod, 2024);
  assert.equal(dumbbellSentence(d, "2022/23"), "Geography grew by 22 entries since 2022/23, more than any other subject; French fell most (−16).");
  // No group line: the plain average of the rows drawn.
  const plain = dashboardDumbbell({ ...span, series: span.series.filter((s) => s.key !== "group-0") }, { focusKey: "geog" })!;
  assert.equal(plain.average?.label, "Average of these subjects");
  assert.equal(plain.average?.latest, (92 + 84 + 64 + 61) / 4);
  // One year only, or nobody with both years: no view (the panel says so), never an invented row.
  assert.equal(dashboardDumbbell({ periods: [2024], series: span.series }, { focusKey: "geog" }), null);
  assert.equal(dashboardDumbbell({ periods: [2022, 2024], series: [{ key: "x", label: "X", colour: "#000", values: [null, 3] }] }, { focusKey: null }), null);
});

test("R-DUMBBELL: the dashboard view draws a row per subject, the focus tinted and centred, the average last", () => {
  const d = dashboardDumbbell(span, { focusKey: "geog", group: { label: "Humanities" } })!;
  for (const fullscreen of [false, true]) {
    const html = renderToStaticMarkup(createElement(DumbbellView, { d, fullscreen, firstLabel: "2022/23", latestLabel: "2024/25" }));
    assert.equal((html.match(/data-dumbbell-row="(subject|focus)"/g) ?? []).length, 4);
    assert.equal((html.match(/data-highlight=""/g) ?? []).length, 1, "the focus row is the one CentredOnTarget centres");
    assert.ok(html.lastIndexOf('data-dumbbell-row="average"') > html.lastIndexOf('data-dumbbell-row="subject"'), "the average last");
    assert.match(html, /▲ 22/);
    assert.match(html, /▼ 16/);
    assert.doesNotMatch(html, /#16a34a|#dc2626|#22c55e|#ef4444/i, "direction by triangles, not green and red");
    assert.match(html, /1 subject without both years left out/);
  }
});
