// Run: npx -y tsx --test --test-force-exit src/lib/smt-fb1.test.ts
// VicData 0.8 SMT feedback round 1: the round's rules that run without a database --
//   R-TREND-PERIOD-PER-CELL  each Scorecard cell's own period; value added extends to a third year from the
//                            data alone (a synthetic 2025/26), with no code change
//   R-INDEP-ENTRY-TILES      Joining / Net change at 11 and Net change at 16, one sum with Leaving at 16
//   R-RAIL-HIDES-EMPTY       the rail drops empty views; a panel opens on the next view instead
//   R-FEEDBACK-FOLLOWS-VIEW  the window offers "Move to <view>" when its panel's rail changes, and keeps the draft
//   the set's short name (F-3) and the app version (F-1's "dev")
import { test } from "node:test";
import assert from "node:assert/strict";
import { setShortName } from "./set-short-name";
import { trendOf, vaTrend, trendYearsNote } from "./smt/overview";
import { entryTiles, yearOnYear } from "./smt/entry-net";
import type { CohortTable } from "./admissions/cohort";
import { activeWithContent, visibleRail } from "./rail-content";
import { appVersion } from "./feedback-server";
import { closeFeedback, feedbackSnapshot, moveFeedback, movedView, openFeedback, resetFeedbackStore, setPanelView } from "../components/feedback/store";
import type { ViewSurface } from "./view-ref";

test("F-3: every set has a short name for a tight header", () => {
  assert.equal(setShortName("10 nearest with a sixth form or 16+ provision"), "10 nearest");
  assert.equal(setShortName("10 nearest schools"), "10 nearest");
  assert.equal(setShortName("15 nearest schools"), "15 nearest");
  assert.equal(setShortName("Schools in Reading"), "Reading");
  assert.equal(setShortName("Rivals"), "Rivals");
  assert.equal(setShortName("All Dukes schools"), "All Dukes schools");
  assert.equal(setShortName("All Harris Federation schools"), "All Harris Federation");
  const long = setShortName("Our independent day and boarding rivals in Berkshire");
  assert.ok(long.length <= 22 && long.endsWith("…"), long);
});

test("R-TREND-PERIOD-PER-CELL: each cell says its own years; value added grows to a third year from the data", () => {
  assert.equal(trendOf(2022, 2024, 2.5, "points").period, "since 2022/23");
  assert.equal(trendOf(2019, 2025, 17.6, "pct").period, "since 2019/20");
  // Sixth-form value added: two published years today.
  const va = new Map([[2023, 0.02], [2024, 0.09]]);
  const two = vaTrend((p) => va.get(p) ?? null, 2024)!;
  assert.equal(two.period, "2023/24 → 2024/25");
  assert.ok(Math.abs(two.change - 0.07) < 1e-9);
  // 2025/26 lands (mid-November): the same code reads three years.
  va.set(2025, 0.12);
  const three = vaTrend((p) => va.get(p) ?? null, 2025)!;
  assert.equal(three.period, "2023/24 → 2025/26");
  assert.ok(Math.abs(three.change - 0.1) < 1e-9);
  // One published year: no trend, never a zero.
  assert.equal(vaTrend((p) => (p === 2024 ? 0.1 : null), 2024), null);
  // Nothing before 2023/24 is read for value added, even when a figure is present.
  assert.equal(vaTrend((p) => (p === 2021 ? 0.5 : p === 2024 ? 0.1 : null), 2024), null);
  // The one (i) note names every series' years, from years.ts.
  const note = trendYearsNote();
  for (const y of ["2022/23", "2021/22", "2023/24", "2019/20"]) assert.ok(note.includes(y), y);
});

const table = (rows: Record<number, Record<number, number>>): CohortTable =>
  new Map(Object.entries(rows).map(([p, ages]) => [Number(p), new Map(Object.entries(ages).map(([a, n]) => [Number(a), { male: Math.floor(n / 2), female: n - Math.floor(n / 2) }]))]));

test("R-INDEP-ENTRY-TILES: Joining at 11 (an 11-18 school), Net change at 11 (a through-school) and Net change at 16", () => {
  const senior = table({ 2019: { 11: 47, 15: 80, 16: 82 }, 2024: { 10: 1, 11: 55, 15: 87, 16: 85 }, 2025: { 11: 57, 15: 90, 16: 90 } });
  const t = entryTiles(senior, 2025, 2019, 11);
  assert.deepEqual(t.map((x) => [x.key, x.value]), [["join11", 57], ["net16", 3]]);
  assert.equal(Math.round(t[0].since!.pct), 21);
  // One sum with Pupils' Leaving at 16 (leaving = Year 11 last year - Year 12 now = -net).
  assert.equal(yearOnYear(senior, 16, 2025)!.net, 90 - 87);
  // A pupil aged 10 in an 11-18 school's census isn't a Year 6: GIAS's low age decides.
  assert.equal(entryTiles(senior, 2025, 2019, 11)[0].key, "join11");
  // A through-school with a Year 6: Year 7 now against Year 6 last year.
  const through = table({ 2019: { 11: 60, 16: 40 }, 2024: { 10: 40, 15: 70 }, 2025: { 10: 41, 11: 66, 16: 58 } });
  const u = entryTiles(through, 2025, 2019, 3);
  assert.deepEqual(u.map((x) => [x.key, x.value, x.before]), [["net11", 26, 40], ["net16", -12, 70]]);
  // No sixth form: no 16 tile; no Year 7: no 11 tile.
  assert.deepEqual(entryTiles(table({ 2024: { 10: 30 }, 2025: { 10: 30, 11: 30 } }), 2025, 2019, 4).map((x) => x.key), ["net11"]);
  assert.deepEqual(entryTiles(table({ 2024: { 15: 30 }, 2025: { 16: 20 } }), 2025, 2019, 16).map((x) => x.key), ["net16"]);
});

test("R-RAIL-HIDES-EMPTY: empty views leave the rail, and a panel opens on the next view instead", () => {
  const rail = [{ id: "score" }, { id: "map" }, { id: "flags" }];
  const has = (id: string) => id !== "flags";
  assert.deepEqual(visibleRail(rail, has).map((r) => r.id), ["score", "map"]);
  assert.equal(activeWithContent(rail, "flags", has), "score", "wraps round to the next view with content");
  assert.equal(activeWithContent(rail, "map", has), "map");
  assert.equal(activeWithContent([{ id: "a" }, { id: "b" }, { id: "c" }], "a", (id) => id === "c"), "c");
  // Nothing anywhere: the first stays, so the panel can say why.
  assert.deepEqual(visibleRail(rail, () => false).map((r) => r.id), ["score"]);
});

const SURFACE: ViewSurface = { product: "smt", dashboard: { id: "vicdata.smt.overview", name: "SMT Overview" }, scope: { kind: "school", urn: "110110", name: "Leighton Park School" }, role: "smt", viewAs: false, state: {}, pagePath: "/teacher/smt", pageQuery: "" } as unknown as ViewSurface;
const ref = (instanceId: string, label: string) => ({ panelId: "p-large", panelName: "Scorecard", instanceId, dataview: instanceId, label });

test("R-FEEDBACK-FOLLOWS-VIEW: the window never silently keeps the old view", () => {
  resetFeedbackStore({ status: "ready", allowed: true, items: [] });
  const map = { surface: SURFACE, view: ref("map", "Map"), viewKey: "vicdata.smt.overview:p-large:map", anchor: null };
  const flags = { surface: SURFACE, view: ref("flags", "Flags"), viewKey: "vicdata.smt.overview:p-large:flags", anchor: null };
  setPanelView(map);
  openFeedback(map);
  assert.equal(movedView(feedbackSnapshot()), null, "on the view the panel shows");
  // F-5: the rail moves to Flags while the window is open.
  setPanelView(flags);
  const s1 = feedbackSnapshot();
  assert.equal(movedView(s1)?.view.label, "Flags", "offers Move to Flags");
  const at = s1.target!.openedAt;
  moveFeedback(movedView(s1)!);
  const s2 = feedbackSnapshot();
  assert.equal(s2.target!.view.label, "Flags");
  assert.equal(s2.target!.openedAt, at, "the same opening: the draft is kept");
  assert.equal(movedView(s2), null);
  closeFeedback();
});

test("F-1: a missing app version is 'unknown' outside local dev, never 'dev'", () => {
  assert.equal(appVersion({ RENDER_GIT_COMMIT: "9af574369ae6e063f0", NODE_ENV: "production" }), "9af574369ae6");
  assert.equal(appVersion({ NODE_ENV: "production" }), "unknown");
  assert.equal(appVersion({ RENDER_GIT_COMMIT: "  ", NODE_ENV: "production" }), "unknown");
  assert.equal(appVersion({ NODE_ENV: "development" }), "dev");
});
