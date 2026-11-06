// Run: npx -y tsx --test --test-force-exit src/lib/smt-fb1.test.ts
// VicData 0.8 SMT feedback round 1: the round's rules that run without a database --
//   R-TREND-PERIOD-PER-CELL  each Scorecard cell's own period; value added extends to a third year from the
//                            data alone (a synthetic 2025/26), with no code change
//   R-INDEP-ENTRY-TILES      Joining / Net change at 11 and Net change at 16, one sum with Leaving at 16
//   R-RAIL-HIDES-EMPTY       the rail drops empty views; a panel opens on the next view instead
//   R-FEEDBACK-FOLLOWS-VIEW  the window offers "Move to <view>" when its panel's rail changes, and keeps the draft;
//                            since Admissions feedback round 2 (F-31) also another panel and the entry point, and
//                            Send records one moment: B at 16+ once moved, A at 11+ if not -- never a mix
//   the set's short name (F-3) and the app version (F-1's "dev")
import { test } from "node:test";
import assert from "node:assert/strict";
import { setShortName } from "./set-short-name";
import { trendOf, vaTrend, trendYearsNote } from "./smt/overview";
import { entryTiles, yearOnYear } from "./smt/entry-net";
import type { CohortTable } from "./admissions/cohort";
import { activeWithContent, visibleRail } from "./rail-content";
import { appVersion } from "./feedback-server";
import { closeFeedback, driftOf, feedbackSnapshot, moveFeedback, movedView, openFeedback, resetFeedbackStore, sendPlan, setLiveSurface, setPanelView, touchPanel } from "../components/feedback/store";
import { feedbackPayload, type FormState } from "../components/feedback/FeedbackWindow";
import { feedbackRow } from "./feedback-server";
import { stateMismatch, viewWithEntry, type ViewSurface } from "./view-ref";

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

// Admissions feedback round 2, item 3: what happened on 6 Nov (F-31). The window opened on "Your cohort, girls
// and boys" at 11+; Guy switched to 16+ and went to "Why did our intake change?" in another panel, and sent.
const ADM = (entry: string): ViewSurface => ({ product: "admissions", dashboard: { id: "vicdata.admissions.pipelines", name: "Pipelines", versionId: null }, scope: { kind: "school", urn: "110110", name: "Leighton Park School" }, role: "admissions", viewAs: false, peek: false, noteScope: "110110", state: { dashboard: "pipelines", entry, rivals: null, projection: false } });
const COHORT = { panelId: "vicdata.admissions.pipelines.c1.trends", panelName: "Trends", instanceId: "sex", dataview: "DV-ADM-P-ENTRY-SEX", label: "Your cohort, girls and boys" };
const FUNNEL = { panelId: "vicdata.admissions.pipelines.c2.funnel", panelName: "Funnel", instanceId: "funnel", dataview: "DV-ADM-P-FUNNEL", label: "Why did our intake change?" };
const key = (v: typeof COHORT) => `vicdata.admissions.pipelines:${v.panelId}:${v.instanceId}`;
const FORM: FormState = { kinds: [], importance: null, scope: null, applies: null, where: [], area: [], saw: "", expected: "", text: "The waterfall at 16+" };
const AT = (entry: string) => ({ path: "/teacher/admissions", search: `?view=pipelines&entry=${encodeURIComponent(entry)}` });
// Send, with the page's address at that moment (16+ unless said).
const payloadOf = (now = AT("16+")) => {
  const s = feedbackSnapshot();
  const plan = sendPlan(s, now)!;
  return { plan, p: feedbackPayload(plan.surface, s.target!, FORM, { ...plan.address, width: 1400, theme: "light" }) };
};

test("R-FEEDBACK-FOLLOWS-VIEW (round 2): A at 11+, then 16+ and B in another panel -- the window offers B at 16+; Send is B at 16+ or A at 11+, never a mix", () => {
  const setup = () => {
    resetFeedbackStore({ status: "ready", allowed: true, items: [] });
    setLiveSurface(ADM("11+"));
    setPanelView({ surface: ADM("11+"), view: COHORT, viewKey: key(COHORT), anchor: null });
    setPanelView({ surface: ADM("11+"), view: FUNNEL, viewKey: key(FUNNEL), anchor: null });
    touchPanel(ADM("11+"), COHORT.panelId);
    openFeedback({ surface: ADM("11+"), view: COHORT, viewKey: key(COHORT), anchor: null }, AT("11+"));
  };
  setup();
  assert.equal(driftOf(feedbackSnapshot()), null, "on the view the page shows");
  assert.equal(viewWithEntry(feedbackSnapshot().target!.view.label, feedbackSnapshot().target!.surface.state), "Your cohort, girls and boys · 11+", "the header names the view with its entry point");
  // A Send before anything changes: the page as it is at that moment.
  const clean = payloadOf(AT("11+"));
  assert.equal(clean.plan.drift, null);
  assert.deepEqual([clean.p.view_key, clean.p.state.entry, clean.p.page_query], [key(COHORT), "11+", "view=pipelines&entry=11%2B"]);
  // The entry point goes to 16+ (the page re-renders; the panels keep the copies they announced).
  setLiveSurface(ADM("16+"));
  const d1 = driftOf(feedbackSnapshot())!;
  assert.equal(d1.kind, "entry");
  assert.equal(d1.to!.view.label, COHORT.label, "offers the same view…");
  assert.equal(d1.to!.surface.state.entry, "16+", "…at 16+");
  // Then a click in the funnel's panel.
  touchPanel(ADM("16+"), FUNNEL.panelId);
  const d2 = driftOf(feedbackSnapshot())!;
  assert.equal(d2.kind, "panel", "another panel on the same dashboard");
  assert.equal(viewWithEntry(d2.to!.view.label, d2.to!.surface.state), "Why did our intake change? · 16+", "offers Move to B at 16+");
  assert.equal(movedView(feedbackSnapshot())?.viewKey, key(FUNNEL));

  // Declined: Send (after the warning) is A at 11+, its state and address both from when it was tied.
  const no = payloadOf();
  assert.ok(no.plan.drift, "Send warns first");
  assert.equal(no.p.view_key, key(COHORT));
  assert.equal(no.p.state.entry, "11+");
  assert.equal(no.p.page_query, "view=pipelines&entry=11%2B");
  assert.equal(stateMismatch(no.p.state, no.p.page_query), null, "never a mix");

  // What the old window sent on 6 Nov -- A's 11+ state with the 16+ address -- is refused, by the page and the server.
  const old = { ...no.p, page_query: "view=pipelines&entry=16%2B" };
  assert.match(stateMismatch(old.state, old.page_query) ?? "", /entry point 11\+ is recorded, but the address says 16\+/);
  const refused = feedbackRow(old, "abc");
  assert.ok("error" in refused && /don't match its address/.test(refused.error));

  // Accepted: Move to B, then Send is B at 16+, from the moment of sending; the draft is kept.
  const at = feedbackSnapshot().target!.openedAt;
  moveFeedback(d2.to!, AT("16+"));
  const yes = payloadOf();
  assert.equal(yes.plan.drift, null);
  assert.equal(yes.p.view_key, key(FUNNEL));
  assert.equal(yes.p.view_label, FUNNEL.label);
  assert.equal(yes.p.state.entry, "16+");
  assert.equal(yes.p.page_query, "view=pipelines&entry=16%2B");
  assert.equal(stateMismatch(yes.p.state, yes.p.page_query), null, "never a mix");
  assert.equal(feedbackSnapshot().target!.openedAt, at, "the same opening: the draft is kept");
  assert.ok(!("error" in feedbackRow(yes.p, "abc")));

  // A change of entry point alone, on the same view: the offer is that view at 16+; moved, Send is A at 16+.
  setup();
  setLiveSurface(ADM("16+"));
  moveFeedback(driftOf(feedbackSnapshot())!.to!, AT("16+"));
  const same = payloadOf();
  assert.deepEqual([same.p.view_key, same.p.state.entry, same.p.page_query], [key(COHORT), "16+", "view=pipelines&entry=16%2B"]);
  closeFeedback();
});

test("R-FEEDBACK-FOLLOWS-VIEW (round 2): a dashboard change warns with no move, and Send as it was is A at 11+", async () => {
  const st = await import("../components/feedback/store");
  st.resetFeedbackStore({ status: "ready", allowed: true, items: [] });
  st.setLiveSurface(ADM("11+"));
  st.setPanelView({ surface: ADM("11+"), view: COHORT, viewKey: key(COHORT), anchor: null });
  st.openFeedback({ surface: ADM("11+"), view: COHORT, viewKey: key(COHORT), anchor: null }, AT("11+"));
  // The page switches to Market share: the Pipelines surface goes, Market share's comes.
  st.clearLiveSurface(ADM("11+"));
  st.setLiveSurface({ ...ADM("11+"), state: { ...ADM("11+").state, dashboard: "market-share" }, dashboard: { id: "vicdata.admissions.market-share", name: "Market share", versionId: null } });
  const d = st.driftOf(st.feedbackSnapshot())!;
  assert.equal(d.kind, "dashboard");
  assert.equal(d.to, null, "no move to another dashboard: that view's own icon opens it there");
  assert.equal(d.now.dashboard.name, "Market share");
  const s = st.feedbackSnapshot();
  const plan = st.sendPlan(s, { path: "/teacher/admissions", search: "?view=market-share&entry=11%2B" })!;
  const p = feedbackPayload(plan.surface, s.target!, FORM, { ...plan.address, width: 1400, theme: "dark" });
  assert.deepEqual([p.view_key, p.state.dashboard, p.state.entry, p.page_query], [key(COHORT), "pipelines", "11+", "view=pipelines&entry=11%2B"]);
  st.closeFeedback();
});

test("F-1: a missing app version is 'unknown' outside local dev, never 'dev'", () => {
  assert.equal(appVersion({ RENDER_GIT_COMMIT: "9af574369ae6e063f0", NODE_ENV: "production" }), "9af574369ae6");
  assert.equal(appVersion({ NODE_ENV: "production" }), "unknown");
  assert.equal(appVersion({ RENDER_GIT_COMMIT: "  ", NODE_ENV: "production" }), "unknown");
  assert.equal(appVersion({ NODE_ENV: "development" }), "dev");
});
