// Run: npx -y tsx --test --test-force-exit src/lib/feedback-resolved-views.test.ts
// VicData 0.8 Admissions feedback round 2, the app's half of items 3 and 4 (the database's:
// supabase/tests/v08_feedback_resolved_views_pglite.mjs; the window's: smt-fb1.test.ts, R-FEEDBACK-FOLLOWS-VIEW):
//   R-FEEDBACK-FOLLOWS-VIEW    the server refuses an item whose state and address disagree on the dashboard, the
//                              entry point or the level, with the window's message; the header's "· 16+".
//   R-FEEDBACK-RESOLVED-VIEWS  the inbox's resolved views are a triage field: a list of view keys, tidied.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entryLabel, stateMismatch, viewContext, viewWithEntry } from "./view-ref";
import { feedbackRow, triagePatch } from "./feedback-server";

const ITEM = { product: "admissions", school_urn: "110110", dashboard_id: "vicdata.admissions.pipelines", panel_id: "c1", view_key: "vicdata.admissions.pipelines:c1:sex", body: "x" };

test("R-FEEDBACK-FOLLOWS-VIEW: state and address must agree on dashboard, entry point and level", () => {
  assert.equal(
    stateMismatch({ dashboard: "pipelines", entry: "11+" }, "view=pipelines&entry=16%2B"),
    "This item's settings don't match its address: entry point 11+ is recorded, but the address says 16+. Nothing was sent. Move the window to the view on screen and send again.",
  );
  assert.match(stateMismatch({ dashboard: "market-share", entry: "16+" }, "view=pipelines&entry=16%2B") ?? "", /dashboard market-share is recorded, but the address says pipelines/);
  assert.match(stateMismatch({ level: "gcse" }, "level=post16") ?? "", /level gcse is recorded/);
  assert.equal(stateMismatch({ dashboard: "pipelines", entry: "16+" }, "view=pipelines&entry=16%2B"), null);
  assert.equal(stateMismatch({ entry: "16+" }, "entry=16+"), null, "a bare + typed by hand");
  assert.equal(stateMismatch({ level: "gcse" }, ""), null, "SMT's remembered level: the address says nothing");
  assert.equal(stateMismatch({}, "view=pipelines&entry=16%2B"), null);
  assert.equal(stateMismatch(null, null), null);
  // The server's row: refused with the same words; agreed, taken.
  const bad = feedbackRow({ ...ITEM, state: { dashboard: "pipelines", entry: "11+" }, page_query: "view=pipelines&entry=16%2B" }, "abc");
  assert.ok("error" in bad && bad.error.startsWith("This item's settings don't match its address"));
  const good = feedbackRow({ ...ITEM, state: { dashboard: "pipelines", entry: "16+" }, page_query: "view=pipelines&entry=16%2B" }, "abc");
  assert.ok("row" in good && good.row.page_query === "view=pipelines&entry=16%2B");
});

test("R-FEEDBACK-FOLLOWS-VIEW: the header names the view with its entry point", () => {
  assert.equal(viewWithEntry("Shape and size", { entry: "16+" }), "Shape and size · 16+");
  assert.equal(viewWithEntry("Scorecard", { level: "post16" }), "Scorecard · Post-16");
  assert.equal(viewWithEntry("Scorecard", { level: "whole" }), "Scorecard · Whole school");
  assert.equal(viewWithEntry("Results", { phase: "ks4" }), "Results · GCSE");
  assert.equal(entryLabel({ entry: "age:13" }), "13+");
  assert.equal(viewWithEntry("Group map", { focus: "x" }), "Group map", "no entry point: the label alone");
  assert.deepEqual(viewContext({ entry: "11+", rivals: "Rivals" }), { entry: "11+", set: "Rivals" });
});

test("R-FEEDBACK-RESOLVED-VIEWS: resolved_views is a triage field of view keys", () => {
  assert.deepEqual(triagePatch({ resolved_views: [" vicdata.admissions.pipelines:c1:sex ", "vicdata.admissions.pipelines:c1:sex", "", "page:vicdata.smt.overview"] }), { patch: { resolved_views: ["vicdata.admissions.pipelines:c1:sex", "page:vicdata.smt.overview"] } });
  assert.deepEqual(triagePatch({ resolved_views: [] }), { patch: { resolved_views: [] } }, "emptied");
  assert.ok("error" in triagePatch({ resolved_views: "vicdata.admissions.pipelines:c1:sex" }), "a list, not a string");
  assert.ok("error" in triagePatch({ resolved_views: ["not a key"] }));
  assert.ok("error" in triagePatch({ resolved_views: Array.from({ length: 51 }, (_, i) => `d:p:v${i}`) }), "at most 50");
  // Not sent, not touched (the inbox sends it only when changed, so it works before the migration).
  assert.ok(!("resolved_views" in (triagePatch({ triage_note: "x" }) as { patch: object }).patch));
});
