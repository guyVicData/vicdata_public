// 0.8 audit fixes (R-IGCSE-GROUP-LABEL) and 0.8 IGCSE subjects: what an IGCSE school took as IGCSE,
// which of its families are incomplete, and the short label with its (i) sentence.
// Run: npx -y tsx --test src/lib/igcse-words.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILY_REQUIRED_SUBJECTS, igcseFamilyIncomplete, igcseGroupLabel, igcseGroupLabelFor, igcseGroupNote, igcseGroupNoteFor, igcseTakenAsIgcse } from "./igcse-words";

test("inference: English Language and maths only, and only for an IGCSE school", () => {
  assert.deepEqual([...igcseTakenAsIgcse(true, ["Biology", "Latin"])].sort(), ["English Language", "Mathematics"]);
  assert.deepEqual([...igcseTakenAsIgcse(true, ["Mathematics", "English Literature"])], ["English Language"]);
  assert.deepEqual([...igcseTakenAsIgcse(true, ["Mathematics", "English Language"])], []);
  assert.deepEqual([...igcseTakenAsIgcse(false, [])], []);
  // Never inferred for a subject a school simply doesn't offer: Physics is absent, not "IGCSE".
  assert.ok(!igcseTakenAsIgcse(true, ["Biology"]).has("Physics"));
});

test("a family is incomplete only where it lacks English Language or maths (no family has required subjects)", () => {
  assert.deepEqual(FAMILY_REQUIRED_SUBJECTS, {});
  assert.equal(igcseFamilyIncomplete("sciences_maths", true, ["Biology", "Chemistry"]), true);
  assert.equal(igcseFamilyIncomplete("sciences_maths", true, ["Biology", "Mathematics"]), false);
  assert.equal(igcseFamilyIncomplete("languages_literature", true, ["English Literature", "French"]), true);
  assert.equal(igcseFamilyIncomplete("languages_literature", true, ["English Language", "French"]), false);
  assert.equal(igcseFamilyIncomplete("humanities_social", true, ["History"]), false);
  assert.equal(igcseFamilyIncomplete("arts_media_design", true, []), false);
  assert.equal(igcseFamilyIncomplete("sciences_maths", false, ["Biology"]), false);
});

test("the short label (follow-up 1): sciences without maths", () => {
  assert.equal(igcseGroupLabel("sciences_maths", "Sciences & Maths", ["Biology", "Chemistry", "Physics", "Combined Science"], true), "Sciences & Maths · no maths (IGCSE)");
  assert.equal(igcseGroupLabel("sciences_maths", "Sciences & Maths", ["Biology", "Statistics"], true), "Sciences & Maths · no Mathematics (IGCSE)");
});

test("the short label: languages without English", () => {
  assert.equal(igcseGroupLabel("languages_literature", "Languages & Literature", ["Latin", "Chinese"], true), "Languages & Literature · no English (IGCSE)");
  assert.equal(igcseGroupLabel("languages_literature", "Languages & Literature", ["English Literature", "French"], true), "Languages & Literature · no English Language (IGCSE)");
});

test("the (i) keeps the full sentence", () => {
  assert.match(igcseGroupNote("sciences_maths", "Sciences & Maths", ["Biology"], true)!, /^Sciences & Maths \(sciences only: maths taken as IGCSE\)\./);
  assert.match(igcseGroupNote("languages_literature", "Languages & Literature", ["Latin"], true)!, /\(no English: taken as IGCSE\)/);
  assert.equal(igcseGroupNote("sciences_maths", "Sciences & Maths", ["Mathematics"], true), null);
});

test("unchanged when nothing is missing, for other groups, and for a school the rule doesn't take out", () => {
  assert.equal(igcseGroupLabel("sciences_maths", "Sciences & Maths", ["Mathematics", "Biology"], true), "Sciences & Maths");
  assert.equal(igcseGroupLabel("languages_literature", "Languages & Literature", ["English Language"], true), "Languages & Literature");
  assert.equal(igcseGroupLabel("humanities", "Humanities", ["History"], true), "Humanities");
  assert.equal(igcseGroupLabel("sciences_maths", "Sciences & Maths", ["Biology"], false), "Sciences & Maths");
});

test("read from the latest year's rows with entries", () => {
  const row = (subject: string, period: number, entriesTotal = 20) => ({ subject, familyId: "sciences_maths", familyLabel: "Sciences & Maths", period, entriesTotal });
  // Maths as GCSE in 2023, gone by 2025: the latest year decides.
  const h = [row("Mathematics", 2023), row("Biology", 2023), row("Biology", 2025), row("Mathematics", 2025, 0)];
  assert.equal(igcseGroupLabelFor(h, "Biology", true), "Sciences & Maths · no maths (IGCSE)");
  assert.match(igcseGroupNoteFor(h, "Biology", true)!, /sciences only: maths taken as IGCSE/);
  assert.equal(igcseGroupLabelFor(h, "Physics", true), null);
});
