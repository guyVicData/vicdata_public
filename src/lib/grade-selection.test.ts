// VicData 0.6.3 S1: Grade counts' grade selection (src/lib/grade-selection.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { answerLine, englandShare, nextSelection, notRangeEndReason, rangeEndGrade, savedSelection, selectionChipLabel } from "./grade-selection";
import { GCSE_SCALE, GRADE_SCALES } from "./subject-grades";

const ALEVEL = GRADE_SCALES[2];
const BTEC = GRADE_SCALES[5];

test("R-COUNTS-SELECTION: first click selects one grade, the second widens, the third starts again", () => {
  const one = nextSelection(GCSE_SCALE, null, "9");
  assert.deepEqual(one, { top: "9", bottom: "9" });
  const widened = nextSelection(GCSE_SCALE, one as { top: string; bottom: string }, "7");
  assert.deepEqual(widened, { top: "9", bottom: "7" });
  // Either way round: a lower grade first, then a higher one.
  assert.deepEqual(nextSelection(GCSE_SCALE, { top: "5", bottom: "5" }, "9"), { top: "9", bottom: "5" });
  const third = nextSelection(GCSE_SCALE, widened as { top: string; bottom: string }, "4");
  assert.deepEqual(third, { top: "4", bottom: "4" }, "a new selection from the clicked grade");
});

test("R-COUNTS-SELECTION: clicking the single selected grade again clears it", () => {
  assert.equal(nextSelection(GCSE_SCALE, { top: "9", bottom: "9" }, "9"), null);
});

test("R-RANGE-ENDS-GRADED: U / Fail / Unclassified, non-grades, '*' and off-scale grades can't be range ends", () => {
  for (const g of ["U", "Fail", "Unclassified"]) {
    assert.equal(rangeEndGrade(GCSE_SCALE, g), false, g);
    assert.equal(nextSelection(GCSE_SCALE, null, g), "ignore", g);
    assert.match(notRangeEndReason(GCSE_SCALE, g) ?? "", /can't start or end a range/);
  }
  assert.equal(rangeEndGrade(ALEVEL, "*"), false, "'*' is A*'s raw duplicate");
  assert.equal(rangeEndGrade(ALEVEL, "A*"), true);
  assert.equal(rangeEndGrade(GCSE_SCALE, "A*"), false, "off the subject's scale");
  assert.equal(rangeEndGrade(GCSE_SCALE, "Suppressed"), false);
  assert.equal(notRangeEndReason(GCSE_SCALE, "9"), null);
  // Post-16 too: a BTEC's Unclassified isn't a range end.
  assert.equal(nextSelection(BTEC, null, "Unclassified"), "ignore");
  assert.deepEqual(nextSelection(BTEC, null, "Distinction*"), { top: "Distinction*", bottom: "Distinction*" });
});

test("R-COUNTS-SELECTION: the saved band:range is the selection, never a preset", () => {
  assert.equal(savedSelection(GCSE_SCALE, undefined), null, "nothing saved: nothing selected (no 7-9 preset)");
  assert.deepEqual(savedSelection(GCSE_SCALE, JSON.stringify({ top: "9", bottom: "5" })), { scale: GCSE_SCALE, top: "9", bottom: "5" });
  assert.equal(savedSelection(GCSE_SCALE, JSON.stringify({ top: "A*", bottom: "B" })), null, "off-scale ends read as none");
  assert.equal(savedSelection(GCSE_SCALE, "not json"), null);
  assert.equal(savedSelection(GCSE_SCALE, JSON.stringify({ top: "9", bottom: "U" })), null);
});

test("R-COUNTS-SELECTION: the answer line in the scale's own wording", () => {
  const nine = { scale: GCSE_SCALE, top: "9", bottom: "9" };
  assert.equal(answerLine(nine, { met: 7, entries: 233 }, { pct: 5.2, partial: false }), "Grade 9: 3% of entries (7) · England 5%");
  const sevenToNine = { scale: GCSE_SCALE, top: "9", bottom: "7" };
  assert.equal(answerLine(sevenToNine, { met: 53, entries: 230 }, { pct: 21.4, partial: false }), "Grades 7–9: 23% of entries (53) · England 21%");
  const aStar = { scale: ALEVEL, top: "A*", bottom: "A*" };
  assert.equal(answerLine(aStar, { met: 9, entries: 50 }, null), "A*: 18% of entries (9)");
  const dStar = { scale: BTEC, top: "Distinction*", bottom: "Distinction*" };
  assert.equal(answerLine(dStar, { met: 1, entries: 20 }, { pct: 12, partial: true }), "Distinction*: 5% of entries (1)", "a partial England figure is left off");
  assert.equal(answerLine(nine, null, null), null);
  assert.equal(selectionChipLabel(nine), "Grade 9 · from your highlight");
  assert.equal(selectionChipLabel(sevenToNine), "Grades 7–9 · from your highlight");
});

test("R-ENGLAND-GRADED-ONLY: England's share over graded, published grades; partial when one is suppressed", () => {
  const eng = [
    { period: 2024, grade: "Distinction*", entries: 10 },
    { period: 2024, grade: "Distinction", entries: 30 },
    { period: 2024, grade: "Merit", entries: 40 },
    { period: 2024, grade: "No result", entries: 99 },
  ];
  const dStar = { scale: BTEC, top: "Distinction*", bottom: "Distinction*" };
  const full = englandShare(eng, 2024, dStar, ["Distinction*", "Distinction", "Merit"]);
  assert.equal(full?.pct, 12.5);
  assert.equal(full?.partial, false, "no result is a non-grade: out of both sides, not a suppression");
  const missing = englandShare(eng, 2024, dStar, ["Distinction*", "Distinction", "Merit", "Pass"]);
  assert.equal(missing?.partial, true, "Pass is drawn for the school but England doesn't publish it");
  assert.equal(englandShare(eng, 2023, dStar, []), null);
  assert.equal(englandShare([...eng, { period: 2024, grade: "Suppressed", entries: 4 }], 2024, dStar, ["Distinction*"])?.partial, true);
});
