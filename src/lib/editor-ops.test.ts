// Run: npx -y tsx --test src/lib/editor-ops.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DASHBOARDS } from "@/catalogue/dashboards";
import { contextFromPanel, type PickPanelContext } from "@/catalogue/pick";
import type { DashboardConfig, Dataview } from "@/catalogue/types";
import { DATAVIEWS } from "@/catalogue";
import * as ops from "./editor-ops";
import { plannedMarkdown } from "./editor-export";

const gcse = () => DASHBOARDS.find((d) => d.id === "vicdata.ks4.candidates")!;
const frozen = JSON.stringify(gcse());

const blank3 = (): DashboardConfig =>
  ops.newDashboardConfig({
    id: "dash1",
    name: "Admissions overview",
    owner: "vicdata",
    main: "rolls",
    colour: { key: "neutral", override: "#22d3ee" },
    tracks: [1, 1, 1],
    rows: 2,
    accordion: "auto-close",
    columns: ops.defaultColumns("rolls", 3),
  });

test("seeded configs are never mutated by an op", () => {
  ops.addRow(gcse(), { structure: [1, 1, 1] });
  ops.updateRow(gcse(), "current", { name: "Now" });
  ops.copyRow(gcse(), "trends");
  ops.setRowStructure(gcse(), "current", [3]);
  assert.equal(JSON.stringify(gcse()), frozen);
});

test("validateConfig allows empty panels in a draft but reports them", () => {
  const c = blank3();
  const v = ops.validateConfig(c);
  assert.deepEqual(v.problems, []);
  assert.equal(v.empty.length, 6, "rolls has no views yet: every panel starts empty");
  const g = ops.validateConfig(gcse());
  assert.deepEqual(g, { problems: [], empty: [] });
});

test("new dashboard: each panel opens with the first view Add a view offers", () => {
  const c = ops.newDashboardConfig({ id: "d2", name: "GCSE mine", owner: "user", main: "ks4", colour: { key: "ks4" }, tracks: [1, 1, 1], rows: 2, accordion: "auto-close", columns: ops.defaultColumns("ks4", 3) });
  assert.equal(c.panels.length, 6);
  assert.ok(c.panels.every((p) => p.dataviews.length === 1), "academic data has a view everywhere");
  assert.equal(c.rows[0].time, "latest");
  assert.equal(c.rows[1].time, "over_time");
  assert.equal(c.layout.preset, "3");
});

test("structures snap to the columns", () => {
  assert.deepEqual(ops.structuresFor(1), [[1]]);
  assert.deepEqual(ops.structuresFor(3), [[3], [2, 1], [1, 2], [1, 1, 1]]);
  assert.equal(ops.structuresFor(4).length, 8);
});

test("rows: add with a structure, rename, settings, copy, move, delete", () => {
  let c = ops.addRow(gcse(), { structure: [2, 1], name: "Overview" });
  const row = c.rows[2];
  assert.equal(row.time, "either");
  assert.equal(row.openByDefault, true);
  assert.deepEqual(ops.structureOf(c, row.id), [2, 1]);
  c = ops.updateRow(c, row.id, { name: "Detail", time: "latest", openByDefault: false });
  assert.equal(c.rows[2].name, "Detail");
  assert.throws(() => ops.updateRow(c, row.id, { name: "  " }), ops.EditorError);
  c = ops.copyRow(c, "current");
  assert.equal(c.rows[1].name, "Current (copy)");
  assert.equal(ops.rowPanels(c, c.rows[1].id).length, 3);
  assert.ok(ops.rowPanels(c, c.rows[1].id).every((p) => !p.legacy), "a copy has its own notes");
  assert.equal(ops.validateConfig(c).problems.length, 0);
  c = ops.moveRow(c, c.rows[1].id, 1);
  assert.equal(c.rows[2].name, "Current (copy)");
  c = ops.deleteRow(c, c.rows[2].id);
  assert.equal(c.rows.length, 3);
  assert.throws(() => ops.addRow(gcse(), { structure: [1, 1] }), /cover the dashboard's 3 columns/);
});

test("row structure: panels keep their order; lost panels are counted first", () => {
  assert.equal(ops.panelsLostBy(gcse(), "current", [2, 1]), 1);
  const c = ops.setRowStructure(gcse(), "current", [2, 1]);
  const ps = ops.rowPanels(c, "current");
  assert.equal(ps.length, 2);
  assert.equal(ops.spanOf(ps[0]), 2);
  assert.equal(ps[0].id, "vicdata.ks4.candidates.c1.current");
  assert.equal(ps[1].column, "c3");
});

test("panels: rename, override, delete, move (swap), span", () => {
  let c = ops.renamePanel(gcse(), "vicdata.ks4.candidates.c2.current", "Share");
  assert.equal(ops.panelAt(c, "vicdata.ks4.candidates.c2.current")!.name, "Share");
  c = ops.deletePanel(c, "vicdata.ks4.candidates.c3.current");
  assert.deepEqual(ops.rowCells(c, "current").map((x) => !!x.panel), [true, true, false]);
  // move into the gap
  c = ops.movePanel(c, "vicdata.ks4.candidates.c2.current", "current", "c3");
  assert.equal(ops.panelAt(c, "vicdata.ks4.candidates.c2.current")!.column, "c3");
  // swap two filled panels of the same span
  c = ops.movePanel(c, "vicdata.ks4.candidates.c1.trends", "current", "c1");
  assert.equal(ops.panelAt(c, "vicdata.ks4.candidates.c1.current")!.row, "trends");
  // span over a filled neighbour refuses; over a gap works
  assert.throws(() => ops.setSpan(gcse(), "vicdata.ks4.candidates.c1.current", 2), /in the way/);
  const g = ops.deletePanel(gcse(), "vicdata.ks4.candidates.c2.trends");
  const s = ops.setSpan(g, "vicdata.ks4.candidates.c1.trends", 2);
  assert.equal(ops.spanOf(ops.panelAt(s, "vicdata.ks4.candidates.c1.trends")!), 2);
  assert.throws(() => ops.setSpan(gcse(), "vicdata.ks4.candidates.c3.trends", 2), /past the last column/);
});

test("F3: the span question asks once, left-most first, only when columns differ", () => {
  const g = ops.deletePanel(ops.deletePanel(gcse(), "vicdata.ks4.candidates.c2.trends"), "vicdata.ks4.candidates.c3.trends");
  const q = ops.spanQuestion(g, "vicdata.ks4.candidates.c1.trends", 3)!;
  assert.deepEqual(q.map((o) => o.columnId), ["c1", "c2", "c3"]);
  assert.equal(q[0].leftMost, true);
  assert.match(q[2].line, /compared with/);
  // following Comparisons makes the panel overridden
  const s = ops.setSpan(g, "vicdata.ks4.candidates.c1.trends", 3, "c3");
  assert.match(ops.panelAt(s, "vicdata.ks4.candidates.c1.trends")!.override!.badge, /follows Comparisons/);
  // same-settings columns ask nothing
  const same = blank3();
  const sameCols = { ...same, columns: same.columns.map((c) => ({ ...c, compare: null })) };
  const e = ops.deletePanel(sameCols, "dash1.c2.current");
  assert.equal(ops.spanQuestion(e, "dash1.c1.current", 2), null);
});

test("views: add (chooser output + override), reorder, default, move, copy, remove", () => {
  const pid = "vicdata.ks4.candidates.c2.current";
  let r = ops.addView(gcse(), pid, { id: `${pid}/DV-C2-TR-INDEXED`, kind: "view", dataview: "DV-C2-TR-INDEXED" }, { badge: "overridden: over time", reason: "test" });
  let c = r.config;
  const p = ops.panelAt(c, pid)!;
  assert.equal(p.dataviews.at(-1)!.id, r.instanceId);
  assert.equal(p.override!.badge, "overridden: over time");
  c = ops.reorderView(c, pid, p.dataviews.length - 1, 0);
  assert.equal(ops.panelAt(c, pid)!.dataviews[0].id, r.instanceId);
  c = ops.setDefaultView(c, pid, r.instanceId);
  r = ops.moveView(c, r.instanceId, "vicdata.ks4.candidates.c2.trends");
  c = r.config;
  assert.ok(!ops.panelAt(c, pid)!.dataviews.some((v) => v.id.endsWith("DV-C2-TR-INDEXED") && v.id.startsWith(pid + "/")));
  assert.equal(ops.panelAt(c, pid)!.defaultView, undefined, "moving the default clears it");
  // the target already held DV-C2-TR-INDEXED: the moved copy gets a fresh id
  assert.match(r.instanceId, /~2$/);
  const copied = ops.copyView(c, r.instanceId, { row: "current", column: "c1" });
  assert.equal(ops.panelAt(copied.config, "vicdata.ks4.candidates.c1.current")!.dataviews.length, 2);
  c = ops.removeView(copied.config, copied.instanceId);
  assert.equal(ops.panelAt(c, "vicdata.ks4.candidates.c1.current")!.dataviews.length, 1);
  assert.equal(ops.validateConfig(c).problems.length, 0);
});

test("adding into a gap creates the panel", () => {
  const g = ops.deletePanel(gcse(), "vicdata.ks4.candidates.c3.current");
  const r = ops.addView(g, { row: "current", column: "c3" }, { id: "x", kind: "view", dataview: "DV-C3-CUR-MAP" });
  assert.equal(ops.panelAt(r.config, { row: "current", column: "c3" })!.dataviews.length, 1);
});

test("placeholders: saved with the exact context; ready to swap in when a draft matches", () => {
  const c0 = blank3();
  const ctx = contextFromPanel(c0, "dash1.c1.trends");
  const r = ops.addPlaceholder(c0, "dash1.c1.trends", { description: "Roll by year group since 2019", shape: "graph", notes: "Index to 100", context: ctx });
  const v = ops.panelAt(r.config, "dash1.c1.trends")!.dataviews[0];
  assert.equal(v.kind, "placeholder");
  assert.equal(v.kind === "placeholder" && v.context!.data, "rolls");
  assert.equal(v.kind === "placeholder" && v.context!.time, "over_time");
  assert.deepEqual(ops.readyToSwap(r.config), {});
  // A draft view registered for that context shows up.
  const draft: Dataview = { ...DATAVIEWS[0], id: "DV-ROLLS-TR-TEST", status: "draft", supports: { ...DATAVIEWS[0].supports, data: ["rolls"], phases: ["ks4", "ks5"], focus: ["school"], compare: [], dateMode: "trend" } };
  const ready = ops.readyToSwap(r.config, [...DATAVIEWS, draft]);
  assert.deepEqual(Object.keys(ready), [r.instanceId]);
  // the real catalogue's own drafts match a candidates placeholder
  const g = gcse();
  const gctx = contextFromPanel(g, "vicdata.ks4.candidates.c1.trends");
  const plain: PickPanelContext = { ...gctx, compare: { kinds: [] }, override: undefined };
  const gr = ops.addPlaceholder(ops.setOverride(g, "vicdata.ks4.candidates.c1.trends", null), "vicdata.ks4.candidates.c1.trends", { description: "x", shape: null, notes: "", context: plain });
  const hits = ops.readyToSwap(gr.config)[gr.instanceId] ?? [];
  assert.ok(hits.every((d) => d.status === "draft"));
  if (hits.length) {
    const swapped = ops.swapInPlaceholder(gr.config, gr.instanceId, hits[0].id);
    assert.equal(ops.plannedCount(swapped).planned, 0);
    assert.match(ops.changeSummary(gr.config, swapped), /^Swapped in/);
  }
});

test("F5: column change lists views that no longer fit, and keep / remove / swap apply", () => {
  const g = gcse();
  const patch = { compare: { kinds: ["schools" as const], schools: "10-nearest" as const } };
  const impact = ops.columnChangeImpact(g, "c2", patch);
  assert.ok(impact.misfits.length > 0, "Context's subject views don't fit a schools comparison");
  const keep = ops.applyColumnChange(g, "c2", patch, {});
  const kept = ops.panelAt(keep, impact.misfits[0].panelId)!;
  assert.match(kept.override!.badge, /^overridden: /);
  assert.equal(keep.columns[1].compare!.kinds[0], "schools");
  const removeAll = Object.fromEntries(impact.misfits.map((m) => [m.instanceId, "remove" as const]));
  const rem = ops.applyColumnChange(g, "c2", patch, removeAll);
  assert.ok(impact.misfits.every((m) => !rem.panels.some((p) => p.dataviews.some((v) => v.id === m.instanceId))));
  const swapAll = Object.fromEntries(impact.misfits.map((m) => [m.instanceId, "swap" as const]));
  const sw = ops.applyColumnChange(g, "c2", patch, swapAll);
  const withNearest = impact.misfits.filter((m) => m.nearest);
  for (const m of withNearest) assert.ok(sw.panels.find((p) => p.id === m.panelId)!.dataviews.some((v) => v.kind === "view" && v.dataview === m.nearest));
  // overridden panels are left alone (C17)
  const c1 = ops.columnChangeImpact(g, "c1", { compare: null });
  assert.ok(c1.skipped.includes("vicdata.ks4.candidates.c1.trends"));
});

test("columns: add and remove", () => {
  let c = ops.addColumn(blank3(), { title: "England", icon: "results", data: { data: "rolls", phase: "ks4" }, focus: { kind: "school" }, compare: null });
  assert.equal(c.columns.length, 4);
  assert.equal(c.layout.preset, "4");
  assert.throws(() => ops.addColumn(c, { title: "x", icon: "results", data: { data: "rolls", phase: "ks4" }, focus: { kind: "school" }, compare: null }), /Four columns/);
  c = ops.removeColumn(c, "c2");
  assert.equal(c.columns.length, 3);
  assert.equal(ops.validateConfig(c).problems.length, 0);
});

test("G8: undo/redo keeps the last 30 actions and coalesces typing", () => {
  let h = ops.initHistory(blank3());
  for (let i = 0; i < 35; i++) h = ops.record(h, ops.updateRow(h.present, "current", { name: `R${i}` }));
  assert.equal(h.past.length, 30);
  h = ops.undo(h);
  assert.equal(h.present.rows[0].name, "R33");
  h = ops.redo(h);
  assert.equal(h.present.rows[0].name, "R34");
  const before = h.past.length;
  h = ops.record(h, ops.updateSettings(h.present, { name: "A" }), "name");
  h = ops.record(h, ops.updateSettings(h.present, { name: "Ab" }), "name");
  assert.equal(h.past.length, Math.min(30, before + 1));
  assert.equal(ops.canRedo(h), false);
});

test("change summary reads like the board", () => {
  const g = gcse();
  let c = ops.addView(g, "vicdata.ks4.candidates.c3.trends", { id: "x", kind: "view", dataview: "DV-C3-TR-CHANGELIST", title: "Maths points vs 10 nearest" }).config;
  c = ops.updateRow(c, "trends", { name: "Over time" });
  assert.equal(ops.changeSummary(g, c), "Added *Maths points vs 10 nearest* to Comparisons · Trends; renamed row “Trends” to “Over time”.");
  assert.equal(ops.changeSummary(g, g), "No changes.");
  assert.equal(ops.changeSummary(null, g), "First version.");
});

test("copy as new: fresh ids, no legacy keys, passes validation", () => {
  const c = ops.copyAsNew(gcse(), "new1", "My GCSE", "user");
  assert.equal(c.id, "new1");
  assert.ok(c.panels.every((p) => p.id.startsWith("new1.") && !p.legacy));
  assert.ok(c.panels.every((p) => p.dataviews.every((v) => v.id.startsWith("new1."))));
  assert.equal(ops.validateConfig(c).problems.length, 0);
});

test("lines: column header, row band, column question", () => {
  const g = gcse();
  assert.equal(ops.columnLine(g.columns[0]), "Data: Candidates · subject · Compared to: subject category");
  assert.equal(ops.columnLine(g.columns[2]), "Data: Candidates · subject · Compared to: 10 nearest");
  assert.equal(ops.rowLine(g, g.rows[0]), "· latest year · 3 panels · opens by default");
  assert.equal(ops.columnQuestion({ data: { data: "rolls", phase: "ks4" }, compare: null }), "How many pupils do we have, and is that changing?");
  assert.equal(ops.columnQuestion({ data: { data: "rolls", phase: "ks4" }, compare: { kinds: ["schools"] } }), "How does our roll compare with the 10 nearest schools?");
});

test("export planned views: placeholders and asks in catalogue terms", () => {
  const c0 = blank3();
  const ctx = contextFromPanel(c0, "dash1.c2.current");
  const r = ops.addPlaceholder(c0, "dash1.c2.current", { description: "Births vs SE and England", shape: "numerical", notes: "Trend arrow", context: ctx });
  const md = plannedMarkdown(r.config, [{ description: "Rolls by gender", context: ctx, created_at: "2026-10-03T10:00:00Z", dashboard_slug: "dash1", panel_id: "dash1.c2.current", status: "open" }], "2026-10-03");
  assert.match(md, /^# Planned views: Admissions overview/);
  assert.match(md, /\*\*Births vs SE and England\*\*/);
  assert.match(md, /data: `rolls`/);
  assert.match(md, /compare: `averages`/);
  assert.match(md, /time: `latest`/);
  assert.match(md, /Shape: numerical/);
  assert.match(md, /## Asked for by users \(1\)/);
});

test("G1: per-user state survives where its panel survives", async () => {
  const { carryStateJson } = await import("./editor-upgrade");
  const prev = gcse();
  const next = ops.addView(prev, "vicdata.ks4.candidates.c3.trends", { id: "x", kind: "view", dataview: "DV-C3-TR-CHANGELIST" }).config;
  const state = { version: "1", panels: { "vicdata.ks4.candidates.c1.current": { open: true }, "vicdata.ks4.candidates.c3.trends": { view: "y" } } };
  const carried = carryStateJson(prev, next, state, 2);
  assert.deepEqual(Object.keys(carried.panels), ["vicdata.ks4.candidates.c1.current"]);
  assert.equal(carried.version, "2");
  assert.deepEqual(carryStateJson(prev, next, null, 2).panels, {});
});
