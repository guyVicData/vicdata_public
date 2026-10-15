// Run: npx -y tsx --test src/lib/subject-latest-names.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSTRUCTION_VRQ,
  latestBreakdown,
  latestNamesInKey,
  latestNamesInSaved,
  latestSubjectName,
  latestSubjectNameOrNull,
  SUBJECT_LATEST_NAMES,
  subjectNameVariants,
} from "./subject-latest-names";
import { shortSubject } from "./subject-short-labels";
import { parseLinkedSet } from "./teacher-view-linked-set";

test("old names read as DfE's latest; others pass through", () => {
  assert.equal(latestSubjectName("Maths (General)"), "Mathematics");
  assert.equal(latestSubjectName("Science Double Award"), "Combined Science");
  assert.equal(latestSubjectName("Hospitality/Catering Studies"), "Hospitality and Catering");
  assert.equal(latestSubjectName("History"), "History");
  assert.equal(latestSubjectName("Mathematics"), "Mathematics");
  assert.equal(latestSubjectNameOrNull(null), null);
});

test("the map never chains, and has the ingest map's 31 rows for every qualification", () => {
  assert.equal(Object.keys(SUBJECT_LATEST_NAMES).length, 31);
  for (const latest of Object.values(SUBJECT_LATEST_NAMES)) assert.equal(SUBJECT_LATEST_NAMES[latest], undefined, latest);
});

test("Construction: only VRQ Level 2 is the renamed VRQ subject", () => {
  assert.equal(latestSubjectName(CONSTRUCTION_VRQ.stored, "VRQ Level 2"), "Constructing and Maintaining the Built Environment");
  assert.equal(latestSubjectName(CONSTRUCTION_VRQ.stored, "BTEC Technical Award L1 / 2 - Band C - P-D*"), CONSTRUCTION_VRQ.stored);
  assert.equal(latestSubjectName(CONSTRUCTION_VRQ.stored), CONSTRUCTION_VRQ.stored);
  assert.equal(latestSubjectName("Construction and the Built Environment (Construction)"), CONSTRUCTION_VRQ.stored);
  assert.equal(
    latestBreakdown("VRQ Level 2::Construction and the Built Environment::Pass"),
    "VRQ Level 2::Constructing and Maintaining the Built Environment::Pass",
  );
});

test("raw fact breakdowns: the subject segment only", () => {
  assert.equal(latestBreakdown("GCSE (9-1) Full Course::Maths (General)::Total exam entries"), "GCSE (9-1) Full Course::Mathematics::Total exam entries");
  assert.equal(latestBreakdown("GCSE (9-1) Full Course::History::7"), "GCSE (9-1) Full Course::History::7");
  assert.equal(latestBreakdown("total_pupils"), "total_pupils");
});

test("variants: the latest name first, then every old one", () => {
  assert.deepEqual(subjectNameVariants("Maths (General)"), ["Mathematics", "Maths (General)"]);
  assert.deepEqual(subjectNameVariants("Hospitality and Catering"), ["Hospitality and Catering", "Hospitality / Catering Studies", "Hospitality/Catering Studies"]);
  assert.deepEqual(subjectNameVariants("History"), ["History"]);
});

test("saved keys and ids: whole strings and segments between | and ::", () => {
  assert.equal(latestNamesInKey("Maths (General)::GCSE (9-1) Full Course"), "Mathematics::GCSE (9-1) Full Course");
  assert.equal(latestNamesInKey("results|subject|Science Double Award::GCSE (9-1) Full Course (Double Award)|now"), "results|subject|Combined Science::GCSE (9-1) Full Course (Double Award)|now");
  assert.equal(latestNamesInKey("Tourism"), "Travel and Tourism");
  // Old names inside free text are left alone: only a whole value or a key segment is a subject.
  assert.equal(latestNamesInKey("Maths (General) results dipped"), "Maths (General) results dipped");
  assert.equal(latestNamesInKey("chosen:results"), "chosen:results");
});

test("saved configs and state: walked, keys too; unchanged objects come back as they are", () => {
  const config = {
    panels: [{ dataviews: [{ params: { subject: "Maths (General)" }, focus: { subject: { mode: "always", subject: "D & T" } } }] }],
    presentation: { slides: [{ slots: [{ view: { pinned: { subject: "Science Double Award", subjectLabel: "Science Double Award" } } }] }] },
    state: { "results|subject|Maths (General)::GCSE (9-1) Full Course|trend": { open: true } },
    "chosen:results": ["Maths (General)::GCSE (9-1) Full Course", "History::GCSE (9-1) Full Course"],
  };
  const out = latestNamesInSaved(config);
  assert.equal(out.panels[0].dataviews[0].params.subject, "Mathematics");
  assert.equal(out.panels[0].dataviews[0].focus.subject.subject, "Design and Technology");
  assert.equal(out.presentation.slides[0].slots[0].view.pinned.subjectLabel, "Combined Science");
  assert.deepEqual(Object.keys(out.state), ["results|subject|Mathematics::GCSE (9-1) Full Course|trend"]);
  assert.deepEqual(out["chosen:results"], ["Mathematics::GCSE (9-1) Full Course", "History::GCSE (9-1) Full Course"]);
  const plain = { panels: [{ dataviews: [{ params: { subject: "History" } }] }] };
  assert.equal(latestNamesInSaved(plain), plain);
});

test("short labels: the same under the latest name, or the new name's own", () => {
  // Shortened by the fallback from DfE's new wording; each reads as its new name.
  const renamed: Record<string, string> = {
    "Government/Politics Studies": "Gov & Pol",
    Greek: "Modern Greek",
    "Hebrew Language": "Modern Hebrew",
    "Hospitality/Catering Studies": "Hosp & Catering",
    "Japanese Language": "Japanese",
    "Land based Studies": "Land Based",
    "Persian Language": "Persian",
    Tourism: "Travel & Tourism",
  };
  for (const [old, latest] of Object.entries(SUBJECT_LATEST_NAMES)) {
    assert.equal(shortSubject(latest), renamed[old] ?? shortSubject(old), `${old} -> ${latest}`);
  }
  assert.equal(shortSubject("Mathematics (Additional)"), "Add Maths");
  assert.equal(shortSubject("Music Studies"), "Music");
});

test("an old link's subject reads as the latest name", () => {
  assert.equal(parseLinkedSet(new URLSearchParams("set=137625&subject=Maths (General)"))?.subject, "Mathematics");
});
