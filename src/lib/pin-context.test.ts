// Run: npx -y tsx --test src/lib/pin-context.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataviewById } from "@/catalogue";
import { teacherDashboardFor } from "@/catalogue/dashboards";
import { contextFromPanel, pickResults } from "@/catalogue/pick";
import { againstOfScope, copySourceFor, meetingChooserContext, meetingPin, pinFromContext, pinnedCompare, rollsForward, subjectOfKey, type RuntimeLabels } from "./pin-context";
import { viewInstance } from "@/catalogue/viewspec";

const school = { urn: "100053", name: "Acland Burghley School" };
const rt: RuntimeLabels = {
  school,
  results: "points",
  focus: { key: "Maths (General)::GCSE (9-1) Full Course", label: "Maths (General)" },
  category: "Sciences & Maths",
  contextAgainst: "whole",
  contextGroupLabel: "All subjects",
  setLabel: "Local rivals",
  latestYear: "2024/25",
  firstYear: "2021/22",
};

test("subjectOfKey splits a subject item key", () => {
  assert.deepEqual(subjectOfKey("Maths::GCSE (9-1) Full Course"), { subject: "Maths", qualificationType: "GCSE (9-1) Full Course" });
  assert.deepEqual(subjectOfKey("Maths"), { subject: "Maths", qualificationType: null });
});

test("againstOfScope maps the subjects scope to Context's compare-against", () => {
  assert.equal(againstOfScope("whole"), "whole");
  assert.equal(againstOfScope("my_subjects"), "selected");
  assert.equal(againstOfScope("pill"), "category");
  assert.equal(againstOfScope(undefined), null);
});

test("Comparisons panel: pinned to the school, the focus, the named set and the latest year", () => {
  const d = teacherDashboardFor("ks4", "results");
  const p = d.panels.find((x) => x.column === "c3" && x.row === "current")!;
  const v = p.dataviews.find((x) => x.kind === "view")!;
  assert.equal(v.kind, "view");
  const src = copySourceFor(d, p.id, v as Extract<typeof v, { kind: "view" }>, rt);
  assert.equal(src.pinned.schoolUrn, "100053");
  assert.equal(src.pinned.subject, "Maths (General)");
  assert.equal(src.pinned.qualificationType, "GCSE (9-1) Full Course");
  assert.equal(src.pinned.data, "academic.results");
  assert.equal(src.pinned.results, "points");
  assert.deepEqual(src.pinned.compare, { kind: "schools", name: "Local rivals" });
  assert.equal(src.pinned.keepLive, false);
  assert.ok(src.title.length > 0 && !src.title.includes("["), src.title);
});

test("Context panel follows the pill: compares with the group it is on now", () => {
  const d = teacherDashboardFor("ks4", "candidates");
  const p = d.panels.find((x) => x.column === "c2" && x.row === "trends")!;
  const v = p.dataviews.find((x) => x.kind === "view") as Extract<(typeof p.dataviews)[number], { kind: "view" }>;
  const src = copySourceFor(d, p.id, v, rt);
  assert.deepEqual(src.pinned.compare, { kind: "subjects", name: "All subjects" });
  assert.deepEqual(src.pinned.params, { against: "whole" });
  assert.equal(src.context.compare.subjects?.scope, "whole");
  // A trend view pins its span, from the page's first year to its latest.
  assert.deepEqual(src.pinned.yearRange, { from: "2021/22", to: "2024/25" });
});

test("pinnedCompare: the view's own comparison, named as the context names it", () => {
  const d = teacherDashboardFor("ks4", "results");
  const p = d.panels.find((x) => x.column === "c1" && x.row === "current")!;
  const ctx = contextFromPanel(d, p.id, { results: "points" });
  const dv = dataviewById((p.dataviews[0] as { dataview: string }).dataview);
  const c = pinnedCompare(ctx, dv);
  assert.ok(c === null || ["subjects", "averages"].includes(c.kind));
});

test("meeting: Add a view starts at no column, and the pick is pinned for the school", () => {
  const base = meetingChooserContext(school, null);
  assert.deepEqual(base.compare.kinds, ["subjects"]);
  assert.ok(pickResults(base).length > 0, "the meeting's start context offers views");
  assert.equal(base.labels.school, "Acland Burghley School");
  const ctx = { ...base, focus: { kind: "subject" as const, subject: { mode: "always" as const, label: "Maths (General)", key: "Maths (General)::GCSE (9-1) Full Course" } } };
  const instance = viewInstance("v1", "DV-C3-CUR-BAR" as const);
  assert.ok(dataviewById(instance.dataview), "a registered view");
  const pin = meetingPin(instance, ctx, school);
  assert.equal(pin.schoolUrn, "100053");
  assert.equal(pin.subject, "Maths (General)");
  assert.equal(pin.keepLive, false);
  assert.ok(pin.year || pin.yearRange, "a year is pinned");
  // Customise's roll-forward keeps it live.
  assert.equal(rollsForward({ ...instance, params: { rollForward: true } }), true);
  assert.equal(meetingPin({ ...instance, params: { rollForward: true } }, ctx, school).keepLive, true);
});

test("pinFromContext without a school still resolves the settings", () => {
  const pin = pinFromContext(meetingChooserContext(null, null), undefined, null);
  assert.equal(pin.schoolUrn, null);
  assert.equal(pin.phase, "ks4");
  assert.deepEqual(pin.compare, { kind: "subjects", name: "its category" });
});
