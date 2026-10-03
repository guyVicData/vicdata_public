// Run: npx -y tsx --test src/lib/copy-view.test.ts src/lib/dashboard-icons.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DASHBOARDS, teacherDashboardFor } from "@/catalogue/dashboards";
import { contextFromPanel } from "@/catalogue/pick";
import type { DashboardConfig, SlideConfig } from "@/catalogue/types";
import { addViewToMeeting, newMeetingConfig } from "./meeting-ops";
import {
  canEditRow,
  copyToDashboard,
  defaultSlide,
  defaultTarget,
  fitCheck,
  meetingBanner,
  newDashboardFromView,
  newDashboardName,
  pinSummary,
  readLastUsed,
  shapeLine,
  slideLabel,
  slotContext,
  slotMap,
  writeLastUsed,
  type CopyViewSource,
} from "./copy-view";

const results = teacherDashboardFor("ks4", "results");
const labels = { results: "points" as const, subject: { label: "Maths (General)", key: "Maths" }, school: "The Chase", category: "Sciences & Maths", setLabel: "10 nearest" };

// The board's source: Comparisons · Trends, the trend chart, "Maths points against 10 nearest".
function sourceFrom(config: DashboardConfig, panelId: string, dataview: string): CopyViewSource {
  const context = contextFromPanel(config, panelId, labels);
  return {
    instance: { id: `${panelId}/${dataview}`, kind: "view", dataview: dataview as `DV-${string}` },
    context,
    pinned: { phase: "ks4", subject: "Maths", subjectLabel: "Maths (General)", compare: { kind: "schools", name: "10 nearest" }, yearRange: { from: "2021/22", to: "2024/25" } },
    title: "Maths (General) points against 10 nearest, since 2021/22",
  };
}

const trendSource = sourceFrom(results, "vicdata.ks4.results.c3.trends", "DV-C3-TR-CHART");

// A personal two-column watchlist: Maths vs 10 nearest (Comparisons' own settings), two rows.
function watchlist(): DashboardConfig {
  const base = newDashboardFromView(trendSource, { id: "mine-1", name: "Maths watchlist" });
  const c1 = base.columns[0];
  return {
    ...base,
    layout: { preset: "2", tracks: [1, 1], accordion: "auto-close" },
    columns: [c1, { ...c1, id: "c2", title: "vs 10 nearest" }],
    rows: [
      { id: "current", name: "Current", time: "latest", openByDefault: true },
      { id: "trends", name: "Trends", time: "over_time", openByDefault: true },
    ],
    panels: [
      { id: "mine-1.c1.current", row: "current", column: "c1", dataviews: [{ id: "a", kind: "view", dataview: "DV-C3-CUR-TILES" }] },
      { id: "mine-1.c2.current", row: "current", column: "c2", dataviews: [{ id: "b", kind: "view", dataview: "DV-C3-CUR-RANKING" }] },
      { id: "mine-1.c1.trends", row: "trends", column: "c1", dataviews: [{ id: "c", kind: "view", dataview: "DV-C3-TR-CHART" }] },
    ],
  };
}

test("slot map: columns, rows and cells (panels and empty slots)", () => {
  const m = slotMap(watchlist());
  assert.deepEqual(m.columns.map((c) => c.title), ["Comparisons", "vs 10 nearest"]);
  assert.deepEqual(m.rows.map((r) => r.cells.map((c) => c.kind)), [["panel", "panel"], ["panel", "empty"]]);
  const vic = slotMap(results);
  assert.equal(vic.rows.length, 2);
  assert.ok(vic.rows.every((r) => r.cells.length === 3 && r.cells.every((c) => c.kind === "panel")));
});

test("a span takes its columns in the map", () => {
  const d = watchlist();
  d.panels = d.panels.filter((p) => p.id !== "mine-1.c2.current");
  d.panels[0] = { ...d.panels[0], span: { cols: 2, rows: 1 } };
  const row = slotMap(d).rows[0];
  assert.equal(row.cells.length, 1);
  assert.equal(row.cells[0].kind === "panel" && row.cells[0].cols, 2);
});

test("default target: the empty cell whose row Time suits the view, else a new row", () => {
  assert.deepEqual(defaultTarget(watchlist(), undefined), { kind: "empty", columnId: "c2", rowId: "trends" });
  assert.deepEqual(defaultTarget(results, undefined), { kind: "new-row" });
});

test("fit check: same data, same comparison, over time -> follows the column", () => {
  const d = watchlist();
  const target = { kind: "empty" as const, columnId: "c2", rowId: "trends" };
  const slot = slotContext(d, target, trendSource)!;
  const fit = fitCheck(trendSource, slot, target);
  assert.equal(fit.fits, true);
  assert.equal(fit.override, undefined);
  assert.match(fit.message, /^Fits this slot: same data, same comparison, over time\. It follows the column from now on\.$/);
});

test("fit check: a trend view in a latest-year row arrives overridden", () => {
  const d = watchlist();
  d.panels = d.panels.filter((p) => p.id !== "mine-1.c2.current");
  const target = { kind: "empty" as const, columnId: "c2", rowId: "current" };
  const slot = slotContext(d, target, trendSource)!;
  const fit = fitCheck(trendSource, slot, target);
  assert.equal(fit.fits, false);
  assert.equal(fit.failure, "time");
  assert.equal(fit.blocked, false);
  assert.match(fit.override!.badge, /^overridden: over time$/);
  assert.match(fit.message, /keeps its own settings and shows “overridden”/);
});

test("fit check: a view that doesn't fit an existing panel's column can't join its rail", () => {
  const d = watchlist();
  const target = { kind: "rail" as const, panelId: "mine-1.c1.current" };
  const fit = fitCheck(trendSource, slotContext(d, target, trendSource)!, target);
  assert.equal(fit.blocked, true);
  assert.deepEqual(copyToDashboard(d, target, trendSource), { ok: false, reason: "blocked" });
});

test("copy onto a rail adds a fresh instance to that panel", () => {
  const d = watchlist();
  const r = copyToDashboard(d, { kind: "rail", panelId: "mine-1.c1.trends" }, trendSource);
  assert.ok(r.ok);
  const p = r.config.panels.find((x) => x.id === "mine-1.c1.trends")!;
  assert.equal(p.dataviews.length, 2);
  assert.equal(p.dataviews[1].id, "mine-1.c1.trends/DV-C3-TR-CHART");
  assert.equal(r.overridden, false);
  assert.equal(d.panels.find((x) => x.id === "mine-1.c1.trends")!.dataviews.length, 1, "source config untouched");
});

test("copy into an empty slot makes a panel; into a new row adds a row in column 1", () => {
  const d = watchlist();
  const e = copyToDashboard(d, { kind: "empty", columnId: "c2", rowId: "trends" }, trendSource);
  assert.ok(e.ok);
  const p = e.config.panels.find((x) => x.id === e.panelId)!;
  assert.deepEqual([p.row, p.column, p.defaultView, p.override], ["trends", "c2", e.instanceId, undefined]);

  const n = copyToDashboard(d, { kind: "new-row" }, trendSource);
  assert.ok(n.ok);
  assert.equal(n.config.rows.length, 3);
  const row = n.config.rows[2];
  assert.equal(row.time, "over_time");
  assert.equal(n.config.panels.find((x) => x.id === n.panelId)!.column, "c1");
});

test("copy marks the new panel overridden when it doesn't fit", () => {
  const tiles = sourceFrom(results, "vicdata.ks4.results.c1.current", "DV-C1-RES-CUR-TILES");
  const d = watchlist();
  const r = copyToDashboard(d, { kind: "empty", columnId: "c2", rowId: "trends" }, tiles);
  assert.ok(r.ok);
  assert.equal(r.overridden, true);
  assert.match(r.config.panels.find((x) => x.id === r.panelId)!.override!.badge, /^overridden: /);
});

test("copy refuses a VicData-shaped meeting and a missing slot", () => {
  const m = newMeetingConfig({ name: "M", meetingDate: "2026-11-14" });
  assert.deepEqual(copyToDashboard(m, { kind: "new-row" }, trendSource), { ok: false, reason: "not-a-dashboard" });
  assert.deepEqual(copyToDashboard(watchlist(), { kind: "rail", panelId: "nope" }, trendSource), { ok: false, reason: "no-such-slot" });
});

test("new dashboard from a view: its settings become column 1's", () => {
  const d = newDashboardFromView(trendSource, { id: "new-1", name: "Maths (General)" });
  assert.equal(d.columns.length, 1);
  assert.deepEqual(d.columns[0].compare?.kinds, ["schools"]);
  assert.equal(d.columns[0].data.data, "academic.results");
  assert.equal(d.rows[0].time, "over_time");
  assert.deepEqual(d.icon, { source: "view", ref: "DV-C3-TR-CHART" });
  assert.deepEqual(d.colour, { key: "ks4" });
  // Valid against the config rules, and the view follows its own column.
  const target = { kind: "rail" as const, panelId: d.panels[0].id };
  assert.equal(fitCheck(trendSource, slotContext(d, target, trendSource)!, target).fits, true);
});

test("new dashboard names are numbered past ones you have", () => {
  assert.equal(newDashboardName(trendSource, []), "Maths (General)");
  assert.equal(newDashboardName(trendSource, ["maths (general)", "Maths (General) 2"]), "Maths (General) 3");
});

test("who can edit: super-admin all; School-Admin their school's; anyone their own", () => {
  const me = { uid: "u1", superAdmin: false, adminAccountIds: ["acc1"] };
  assert.equal(canEditRow({ owner_scope: "vicdata", owner_profile_id: null, school_account_id: null }, me), false);
  assert.equal(canEditRow({ owner_scope: "school", owner_profile_id: null, school_account_id: "acc1" }, me), true);
  assert.equal(canEditRow({ owner_scope: "school", owner_profile_id: null, school_account_id: "acc2" }, me), false);
  assert.equal(canEditRow({ owner_scope: "user", owner_profile_id: "u1", school_account_id: null }, me), true);
  assert.equal(canEditRow({ owner_scope: "user", owner_profile_id: "u2", school_account_id: null }, me), false);
  assert.equal(canEditRow({ owner_scope: "vicdata", owner_profile_id: null, school_account_id: null }, { ...me, superAdmin: true }), true);
});

test("shape line", () => {
  assert.equal(shapeLine(watchlist()), "2 columns · 2 rows");
  assert.equal(shapeLine({ columns: [results.columns[0]], rows: [results.rows[0]] }), "1 column · 1 row");
});

// ---------------------------------------------------------------- meetings

function meetingWith(counts: number[]): DashboardConfig {
  const m = newMeetingConfig({ name: "Governors", meetingDate: "2026-11-14" });
  const slides: SlideConfig[] = counts.map((n, i) => ({
    id: `s${i + 1}`,
    title: "",
    layout: "auto",
    slots: Array.from({ length: n }, (_, j) => ({ id: `s${i + 1}-${j}`, view: { id: `v${i}${j}`, kind: "view" as const, dataview: "DV-C3-TR-CHART" as const } })),
  }));
  return { ...m, presentation: { meetingDate: "2026-11-14", slides } };
}

test("slide labels and the pre-picked slide (last with room, else new)", () => {
  const m = meetingWith([2, 6, 1]);
  const slides = m.presentation!.slides;
  assert.deepEqual(slides.map(slideLabel), ["Slide 1 · with 2 views", "Slide 2 · full", "Slide 3 · next to the graph"]);
  assert.equal(defaultSlide(slides), "s3");
  assert.equal(defaultSlide(meetingWith([6]).presentation!.slides), "new");
  assert.equal(slideLabel({ id: "x", title: "", layout: "auto", slots: [] }, 0), "Slide 1 · empty");
});

test("the meeting banner says how the slide re-arranges", () => {
  const slides = meetingWith([1, 0]).presentation!.slides;
  const b = meetingBanner(slides, "s1", "map");
  assert.equal(b.lead + b.strong + b.tail, "Slide 1 has the graph. Adding the map makes it side by side. Slides re-arrange themselves as views arrive: 1 → 2 across → 3 across → 3 × 2.");
  assert.match(meetingBanner(slides, "s2", "map").lead, /^Slide 2 is empty\. The map fills it\.$/);
  assert.match(meetingBanner(slides, "new", "map").lead, /^A new slide, with the map on its own\.$/);
});

test("copy to a meeting goes in the next free slot and re-arranges (via addViewToMeeting)", () => {
  const m = meetingWith([1]);
  const r = addViewToMeeting(m, "s1", { ...trendSource.instance, title: trendSource.title }, trendSource.pinned);
  assert.ok(r.ok);
  assert.equal(r.count, 2);
  assert.equal(r.arrangement, "side by side");
  const slot = r.config.presentation!.slides[0].slots[1];
  assert.equal((slot.view as { title?: string }).title, trendSource.title);
  assert.deepEqual((slot.view as { pinned?: unknown }).pinned, trendSource.pinned);
});

test("pin summary", () => {
  assert.equal(pinSummary(trendSource.pinned), "Maths (General), 10 nearest, 2021/22 to 2024/25");
  assert.equal(pinSummary({ subject: "History", year: "2024/25", keepLive: true }), "History, 2024/25, kept live");
});

test("last used: round-trips, and survives storage that throws", () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  writeLastUsed(store, { mode: "meeting", meetingId: "m1" });
  assert.deepEqual(readLastUsed(store), { mode: "meeting", meetingId: "m1" });
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readLastUsed(broken), null);
  assert.doesNotThrow(() => writeLastUsed(broken, { mode: "dashboard" }));
  assert.equal(readLastUsed({ getItem: () => "{nope", setItem: () => {} }), null);
  assert.equal(readLastUsed(null), null);
});

test("every VicData dashboard maps without error", () => {
  for (const d of DASHBOARDS) assert.ok(slotMap(d).rows.length > 0);
});
