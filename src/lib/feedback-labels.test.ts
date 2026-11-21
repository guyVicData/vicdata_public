// Run: node --import tsx --test src/lib/feedback-labels.test.ts
// R-FEEDBACK-PLAIN-LABELS (review pack 22 Nov, issue 3): the feedback form's words are for beta testers --
// nothing about a demo, no team jargon -- while the stored ids (and so the API and the database) are unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FEEDBACK_APPLIES, FEEDBACK_APPLIES_PAGE, FEEDBACK_AREAS, FEEDBACK_IMPORTANCE, FEEDBACK_KINDS, FEEDBACK_SCOPE, FEEDBACK_WHERE } from "./view-ref";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

test("R-FEEDBACK-PLAIN-LABELS: the stored ids are unchanged", () => {
  assert.deepEqual(FEEDBACK_IMPORTANCE.map((o) => o.id), ["before_demo", "should_fix", "nice_to_have"]);
  assert.deepEqual(FEEDBACK_AREAS.map((o) => o.id), ["navigation", "set_bar", "level_pills", "layout", "banner", "home", "account", "other"]);
  assert.deepEqual(FEEDBACK_WHERE.map((o) => o.id), ["title", "figure", "chart", "table", "legend", "info", "pills"]);
});

test("R-FEEDBACK-PLAIN-LABELS: no label talks about a demo or uses team words", () => {
  const all = [FEEDBACK_IMPORTANCE, FEEDBACK_AREAS, FEEDBACK_WHERE, FEEDBACK_KINDS, FEEDBACK_SCOPE, FEEDBACK_APPLIES, FEEDBACK_APPLIES_PAGE].flat();
  for (const o of all) assert.doesNotMatch(o.label, /demo|pill|chip|set bar|set-bar|banner/i, `${o.id}: "${o.label}"`);
  assert.equal(FEEDBACK_IMPORTANCE[0].label, "urgent");
  const page = src("components/feedback/PageFeedback.tsx");
  assert.doesNotMatch(page.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"), /the bar, pills/);
});
