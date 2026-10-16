// 0.8 audit fixes (R-IGCSE-GROUP-LABEL): an IGCSE school's subject group says which subjects it takes as IGCSE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { igcseGroupLabel, igcseGroupLabelFor } from "./igcse-words";

test("sciences without maths at an IGCSE school: sciences only", () => {
  assert.equal(igcseGroupLabel("sciences_maths", "Sciences & Maths", ["Biology", "Chemistry", "Physics", "Combined Science"], true), "Sciences & Maths (sciences only: maths taken as IGCSE)");
});

test("other maths subjects held: names Mathematics alone", () => {
  assert.equal(igcseGroupLabel("sciences_maths", "Sciences & Maths", ["Biology", "Statistics"], true), "Sciences & Maths (no Mathematics: taken as IGCSE)");
});

test("languages without English", () => {
  assert.equal(igcseGroupLabel("languages_literature", "Languages & Literature", ["Latin", "Chinese"], true), "Languages & Literature (no English: taken as IGCSE)");
  assert.equal(igcseGroupLabel("languages_literature", "Languages & Literature", ["English Literature", "French"], true), "Languages & Literature (no English Language: taken as IGCSE)");
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
  assert.equal(igcseGroupLabelFor(h, "Biology", true), "Sciences & Maths (sciences only: maths taken as IGCSE)");
  assert.equal(igcseGroupLabelFor(h, "Physics", true), null);
});
