// Run: npx tsx --test src/lib/igcse-gcse-only.test.ts
// R-IGCSE-GCSE-ONLY (Guy, 20 Nov): an IGCSE school's GCSE options are its GCSE subjects; every other school keeps all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { offeredAtGcse, isGcseQualification } from "./teacher-view-theme";
import { buildTeacherModel } from "./front-door/teacher-model";

const items = [
  { key: "Biology::GCSE (9-1) Full Course", qualificationType: "GCSE (9-1) Full Course" },
  { key: "Combined Science::GCSE (9-1) Full Course (Double Award)", qualificationType: "GCSE (9-1) Full Course (Double Award)" },
  { key: "Multimedia::BTEC", qualificationType: "Pearson BTEC Level 1/Level 2 First Award" },
];

test("offeredAtGcse: GCSE subjects only at an IGCSE school's GCSE; unchanged anywhere else", () => {
  assert.deepEqual(offeredAtGcse(items, "ks4", true).map((i) => i.key), [items[0].key, items[1].key]);
  assert.equal(offeredAtGcse(items, "ks4", false).length, 3);
  assert.equal(offeredAtGcse(items, "ks5", true).length, 3);
  assert.ok(isGcseQualification("GCSE (9-1) Full Course"));
  assert.ok(!isGcseQualification("Pearson BTEC Level 1/Level 2 First Award"));
});

test("the Teacher model at an IGCSE school: the switcher and the focus hold GCSE subjects only, and say so", () => {
  const entries = [
    { subject: "Multimedia", qualificationType: "Pearson BTEC Level 1/Level 2 First Award", period: 2024, entries: 60 },
    { subject: "Biology", qualificationType: "GCSE (9-1) Full Course", period: 2024, entries: 49 },
    { subject: "Art and Design", qualificationType: "GCSE (9-1) Full Course", period: 2024, entries: 21 },
  ];
  const input = { phase: "ks4" as const, school: { urn: "110110", name: "Leighton Park School" }, entries, gradeRows: [], headline: [], qualificationHeadline: [], england: null, area: { la: null, region: null, england: null }, nearest: [], nearestNote: null };
  const igcse = buildTeacherModel({ ...input, igcseSchool: true }, null, ["Multimedia::Pearson BTEC Level 1/Level 2 First Award"]);
  assert.deepEqual(igcse.subjects.map((x) => x.subject).sort(), ["Art and Design", "Biology"]);
  assert.equal(igcse.focus?.subject, "Biology", "a ticked BTEC isn't offered: the largest GCSE subject opens");
  assert.equal(igcse.igcseSchool, true);
  const state = buildTeacherModel(input, null, []);
  assert.equal(state.subjects.length, 3);
  assert.equal(state.focus?.subject, "Multimedia");
  assert.ok(!state.igcseSchool);
});
