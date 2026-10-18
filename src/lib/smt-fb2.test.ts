// Run: npx -y tsx --test --test-force-exit src/lib/smt-fb2.test.ts
// VicData 0.8 SMT feedback round 2: the selected set drives SMT Overview -- the pure parts.
//   setSizeOf    F-10: a phase's place by size in the set (largest first, ties share) and the set's median
//   setAverage   F-11 (R-ROLL-INDEXED-SET): the set's average roll over its schools with every year
import { test } from "node:test";
import assert from "node:assert/strict";
import { setAverage, setSizeOf } from "./smt/overview";

test("F-10: size by phase is a place in the set and the set's median", () => {
  assert.deepEqual(setSizeOf(386, [500, 300, 386, 120, 0, 0]), { rank: 2, of: 5, median: 343, schools: 4 });
  // Schools without the phase (0 pupils) aren't counted; alone in the set, first of one.
  assert.deepEqual(setSizeOf(195, [0, 0]), { rank: 1, of: 1, median: null, schools: 0 });
});

test("R-ROLL-INDEXED-SET: the set's average is over schools with a figure in every year", () => {
  const years = [2019, 2020, 2021];
  const avg = setAverage([[100, 110, 120], [200, 210, 220], [50, null, 60], [0, 10, 10]], years)!;
  assert.equal(avg.schools, 2, "a school missing a year, or with none, is left out");
  assert.deepEqual(avg.pts.map((p) => p.value), [150, 160, 170]);
  assert.equal(setAverage([[null, null, null]], years), null, "no school with every year: no line");
});

// ---------------------------------------------------------------------------- section 6: page feedback
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { feedbackRow } from "./feedback-server";
import { pageKey, type ViewSurface } from "./view-ref";
import { feedbackPayload, type FormState } from "../components/feedback/FeedbackWindow";
import { FooterPageFeedback } from "../components/feedback/PageFeedback";
import { resetFeedbackStore } from "../components/feedback/store";

const PAGE_SURFACE: ViewSurface = { product: "smt", dashboard: { id: "vicdata.smt.overview", name: "SMT Overview", versionId: "v1" }, scope: { kind: "school", urn: "110110", name: "Leighton Park School" }, role: "smt", viewAs: true, peek: false, noteScope: "110110", state: { set: "10 nearest with a sixth form or 16+ provision", level: "whole" } };
const PAGE_FORM: FormState = { kinds: ["layout"], importance: "should_fix", scope: "every_school", applies: "similar_views", where: ["figure"], area: ["set_bar", "level_pills"], saw: "", expected: "", text: "The set bar is hard to find" };
const pageTarget = { view: { panelId: "", panelName: null, instanceId: "", dataview: null, label: "SMT Overview" }, viewKey: pageKey("vicdata.smt.overview"), page: true };

test("R-FEEDBACK-PAGE: a page item carries the full context, its areas, and no panel or view", () => {
  const p = feedbackPayload(PAGE_SURFACE, pageTarget, PAGE_FORM, { path: "/teacher/smt", search: "?level=whole", width: 1440, theme: "dark" });
  assert.equal(p.view_key, "page:vicdata.smt.overview");
  assert.deepEqual([p.panel_id, p.view_instance_id, p.dataview_id, p.view_label], [null, null, null, null]);
  assert.deepEqual(p.area, ["set_bar", "level_pills"]);
  assert.deepEqual(p.where_in_view, [], "no 'where in the view' on a page");
  assert.equal(p.view_as, true);
  assert.equal((p.state as Record<string, unknown>).set, "10 nearest with a sixth form or 16+ provision");
  const r = feedbackRow({ ...p, area: [...p.area!, "colour"] }, "abc");
  assert.ok("row" in r);
  assert.deepEqual(r.row.area, ["set_bar", "level_pills"], "an unknown area is dropped");
  assert.equal(r.row.panel_id, null);
  // A view item is sent exactly as before: no area key at all.
  const v = feedbackRow({ ...p, view_key: "vicdata.smt.overview:p-large:v-score", panel_id: "p-large", view_instance_id: "v-score", area: ["layout"] }, "abc");
  assert.ok("row" in v && !("area" in v.row));
  // The shapes are held: a page key with a panel, or a view key without one, is refused.
  assert.ok("error" in feedbackRow({ ...p, panel_id: "p-large" }, "abc"));
  assert.ok("error" in feedbackRow({ ...p, view_key: "vicdata.smt.overview:p-large:v-score" }, "abc"));
  // The role homes, the group home and the Data View are products.
  assert.ok("row" in feedbackRow({ ...p, product: "home", dashboard_id: "home:smt", view_key: "page:home:smt" }, "abc"));
  assert.ok("row" in feedbackRow({ ...p, product: "dataview", dashboard_id: "dataview", view_key: "page:dataview" }, "abc"));
});

test("R-FEEDBACK-PAGE: the footer's button, for those let in, coloured by the viewer's page items", () => {
  resetFeedbackStore({ status: "ready", allowed: false, items: [], page: PAGE_SURFACE });
  assert.equal(renderToStaticMarkup(createElement(FooterPageFeedback)), "", "nobody else sees it");
  resetFeedbackStore({ status: "ready", allowed: true, items: [], page: null });
  assert.equal(renderToStaticMarkup(createElement(FooterPageFeedback)), "", "nothing on a page that hasn't said what it is");
  resetFeedbackStore({ status: "ready", allowed: true, items: [], page: PAGE_SURFACE });
  assert.match(renderToStaticMarkup(createElement(FooterPageFeedback)), /data-page-feedback="none"[^>]*>.*Feedback on this page/);
  const item = { id: "1", number: 12, created_at: "2026-10-18T20:00:00Z", view_key: "page:vicdata.smt.overview", school_urn: "110110", school_name: "Leighton Park School", group_id: null, group_name: null, looks_good: false, kinds: ["layout"], has_text: true, excerpt: "x" };
  resetFeedbackStore({ status: "ready", allowed: true, items: [{ ...item, status: "new" }], page: PAGE_SURFACE });
  assert.match(renderToStaticMarkup(createElement(FooterPageFeedback)), /data-page-feedback="open"/, "yellow with open page feedback");
  resetFeedbackStore({ status: "ready", allowed: true, items: [{ ...item, status: "new", looks_good: true, kinds: ["looks_good"], has_text: false }], page: PAGE_SURFACE });
  assert.match(renderToStaticMarkup(createElement(FooterPageFeedback)), /data-page-feedback="good"/, "green once marked Looks good");
  resetFeedbackStore({ status: "ready", allowed: true, items: [{ ...item, status: "done" }], page: PAGE_SURFACE });
  assert.match(renderToStaticMarkup(createElement(FooterPageFeedback)), /data-page-feedback="none"/, "monochrome once done");
  // A view item on the same dashboard doesn't colour the page's button.
  resetFeedbackStore({ status: "ready", allowed: true, items: [{ ...item, status: "new", view_key: "vicdata.smt.overview:p-large:v-score" }], page: PAGE_SURFACE });
  assert.match(renderToStaticMarkup(createElement(FooterPageFeedback)), /data-page-feedback="none"/);
});
