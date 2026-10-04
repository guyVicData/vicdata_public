// 0.6.1 S1 (pinch points 1 and 2): "Updated — what's changed" never shows a raw
// placeholder or an internal view name, whether the summary is written now (diffConfigs)
// or was published before the fix (memberSummary at display); and a removed view never
// keeps drawing (rail.tsx offRailEntry falls back to the panel's default).
// Run: npx -y tsx --test src/lib/change-summary.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DATAVIEWS, dataviewForRail } from "@/catalogue";
import { TEACHER_DASHBOARDS, teacherDashboardFor } from "@/catalogue/dashboards";
import { RESULTS_MEASURES, followsResultsPill } from "@/catalogue/results";
import type { DashboardConfig, DataviewInstance, HostId, PanelConfig } from "@/catalogue/types";
import { configViewIds, offRailEntry, onDefault, type RailEntry } from "@/components/dashboard-config/rail";
import * as ops from "./editor-ops";
import { memberSummary, neutralWords } from "./change-summary";

type View = Extract<DataviewInstance, { kind: "view" }>;
const LABELS = new Set(DATAVIEWS.map((d) => d.label));
// Every *emphasised* name in a summary.
const named = (s: string) => [...s.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]);
const memberFacing = (s: string, why: string) => {
  assert.ok(!s.includes("["), `${why}: placeholder in “${s}”`);
  for (const n of named(s)) assert.ok(!LABELS.has(n), `${why}: internal name *${n}* in “${s}”`);
};

test("generated summaries name views by their resolved titles, on all four Teacher dashboards", () => {
  for (const base of TEACHER_DASHBOARDS) {
    for (const p of base.panels)
      for (const v of p.dataviews) {
        if (v.kind !== "view") continue;
        // Removed.
        memberFacing(ops.changeSummary(base, ops.removeView(base, v.id)), `${v.id} removed`);
        // Retitled with placeholders, and back.
        const titled = structuredClone(base);
        const tp = titled.panels.find((x) => x.id === p.id)!;
        const i = tp.dataviews.findIndex((x) => x.id === v.id);
        tp.dataviews[i] = { ...(tp.dataviews[i] as View), title: "[subject] results from [from-year]", params: { title: "[subject] results from [from-year]" } };
        memberFacing(ops.changeSummary(base, titled), `${v.id} retitled`);
        memberFacing(ops.changeSummary(titled, base), `${v.id} title cleared`);
        // Made the default.
        const def = structuredClone(base);
        def.panels.find((x) => x.id === p.id)!.defaultView = v.id;
        memberFacing(ops.changeSummary(base, def), `${v.id} default`);
      }
  }
});

test("a measure taken off reads with the view's title, not its rail name", () => {
  const g = teacherDashboardFor("ks4", "results");
  const id = "vicdata.ks4.results.c1.trends/DV-C1-RES-TR-GEO-CHART";
  const s = ops.changeSummary(g, ops.setViewResults(g, id, ["points"]));
  memberFacing(s, "geo chart");
  assert.match(s, /^Grade 4\+ rate, Grade bands: removed \*This subject against its LA and England, year by year\* from Results · Trends/);
});

test("a summary published before the fix is made member-facing at display", () => {
  const g = teacherDashboardFor("ks4", "results");
  const old =
    "Grade bands: removed *Area chart* from Results · Trends; Grade counts: added *Trend table* to Context · Trends; retitled *Bar chart* “[subject] results from [from-year]” in Context · Current; added *[subject] beside [category]* to Comparisons · Trends.";
  const s = memberSummary(old, g);
  memberFacing(s, "stored summary");
  assert.match(s, /removed \*This subject against its LA and England, year by year\* from Results · Trends/);
  assert.match(s, /“This subject results from the first year”/);
  assert.match(s, /added \*This subject beside its category\* to/);
  // With no config: plain words still, never the internal name.
  const bare = memberSummary(old, null);
  memberFacing(bare, "stored summary, no config");
  // A summary already member-facing is left as it is.
  const fine = "Added *Maths points vs 10 nearest* to Comparisons · Trends; renamed row “Trends” to “Over time”.";
  assert.equal(memberSummary(fine, g), fine);
  assert.equal(neutralWords("[subject] since [year]"), "This subject since the chosen year");
});

// --- Pinch point 2: a removed view never keeps drawing ----------------------------------

// The host's rail as entries: every registered view of the panel's host with a rail
// button, the given one active (the remembered open view).
function hostEntries(host: HostId, which: "current" | "trend", active: string): RailEntry[] {
  return DATAVIEWS.filter((d) => d.host.id === host && d.host.panel === which && d.host.rail).map((d) => ({
    dataview: dataviewForRail(host, which, d.host.rail!)!.id,
    label: d.host.rail!,
    active: d.id === active,
    disabled: false,
    onClick: () => {},
    element: null as never,
  }));
}

const which = (c: DashboardConfig, p: PanelConfig) => (c.rows.find((r) => r.id === p.row)?.legacyPanelId ?? "current") as "current" | "trend";

test("a removed view that was the open view falls back to the panel's default", () => {
  const g = teacherDashboardFor("ks4", "results");
  const pid = "vicdata.ks4.results.c1.trends";
  const next = ops.removeView(g, `${pid}/DV-C1-RES-TR-GEO-TABLE`);
  const cfg = next.panels.find((p) => p.id === pid)!;
  const entries = hostEntries("teacher.c1.results", "trend", "DV-C1-RES-TR-GEO-TABLE");
  for (const state of [null, {}, { results: "bands" as const }, { results: "points" as const }]) {
    const to = offRailEntry(entries, cfg, state);
    assert.equal(to?.dataview, "DV-C1-RES-TR-CHART", `state ${JSON.stringify(state)}`);
  }
  // A Candidates dashboard (no page state at all) too.
  const c = teacherDashboardFor("ks4", "candidates");
  const cp = "vicdata.ks4.candidates.c1.trends";
  const cnext = ops.removeView(c, `${cp}/DV-C1-CAND-TR-GEO-CHART`);
  const to = offRailEntry(hostEntries("teacher.c1.candidates", "trend", "DV-C1-CAND-TR-GEO-CHART"), cnext.panels.find((p) => p.id === cp)!, null);
  assert.equal(to?.dataview, "DV-C1-CAND-TR-INDEXED");
});

test("a view not in the config never draws: every removal moves the host to a config view", () => {
  for (const base of TEACHER_DASHBOARDS) {
    const states = followsResultsPill(base) ? RESULTS_MEASURES.map((m) => ({ results: m })) : [null];
    for (const p of base.panels) {
      const host = base.columns.find((c) => c.id === p.column)?.host;
      if (!host) continue;
      for (const v of p.dataviews) {
        if (v.kind !== "view") continue;
        const dv = DATAVIEWS.find((d) => d.id === v.dataview)!;
        if (!dv.host.rail || dv.host.id !== host) continue;
        const cfg = ops.removeView(base, v.id).panels.find((x) => x.id === p.id)!;
        for (const state of states) {
          const ids = configViewIds(cfg, state);
          const entries = hostEntries(host, which(base, p), v.dataview);
          if (!ids.some((id) => entries.some((e) => e.dataview === id))) continue; // nothing on this state to move to
          const to = offRailEntry(entries, cfg, state);
          assert.ok(to && to.dataview && ids.includes(to.dataview), `${v.id} on ${JSON.stringify(state)}`);
        }
      }
    }
  }
  // A view the config lists is left where it is.
  const g = teacherDashboardFor("ks4", "results");
  const cfg = g.panels.find((p) => p.id === "vicdata.ks4.results.c1.trends")!;
  assert.equal(offRailEntry(hostEntries("teacher.c1.results", "trend", "DV-C1-RES-TR-TABLE"), cfg, { results: "points" }), null);
});

test("a panel already on its default counts as shown, so the first click away isn't undone", () => {
  const g = teacherDashboardFor("ks4", "results");
  const cfg = g.panels.find((p) => p.id === "vicdata.ks4.results.c1.trends")!;
  assert.equal(onDefault(hostEntries("teacher.c1.results", "trend", "DV-C1-RES-TR-CHART"), cfg, { results: "points" }), true);
  assert.equal(onDefault(hostEntries("teacher.c1.results", "trend", "DV-C1-RES-TR-TABLE"), cfg, { results: "points" }), false);
});
