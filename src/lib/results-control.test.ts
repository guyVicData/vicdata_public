// VicData 0.6.1 S5 (D3 + D4): the top bar's Results switch and grade band choice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsControl, bandValue, pickableGrades } from "@/components/teacher/ResultsControl";
import { GCSE_SCALE, GRADE_SCALES, presetsFor } from "@/lib/subject-grades";
import { bandRangeFor } from "@/lib/teacher-view-measures";

const A_LEVEL = GRADE_SCALES[2];
const MEASURES = [
  { id: "points", label: "Average points" },
  { id: "threshold", label: "Grade 4+ rate" },
  { id: "bands", label: "Grade bands" },
  { id: "counts", label: "Grade counts" },
];
const html = (active: string, band: Parameters<typeof ResultsControl>[0]["band"]) =>
  renderToStaticMarkup(createElement(ResultsControl, { measures: MEASURES, active: MEASURES.find((m) => m.id === active)!, onMeasure: () => {}, band }));
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("the band follows the focused subject's scale: GCSE 9-1 has 4-9 and 7-9; Post-16 and other named scales have none (Custom only)", () => {
  assert.deepEqual(presetsFor(GCSE_SCALE).map((p) => p.label), ["4–9", "7–9"]);
  assert.deepEqual(presetsFor(A_LEVEL), []);
  for (const scale of GRADE_SCALES.slice(1)) assert.deepEqual(presetsFor(scale), []);
});

test("the saved setting carries over: band:range is read as before, the GCSE default stays 7-9, Post-16 has none", () => {
  assert.deepEqual(bandRangeFor(GCSE_SCALE, null, JSON.stringify({ top: "9", bottom: "5" })), { scale: GCSE_SCALE, top: "9", bottom: "5" });
  assert.deepEqual(bandRangeFor(GCSE_SCALE, null, undefined), { scale: GCSE_SCALE, top: "9", bottom: "7" });
  assert.equal(bandRangeFor(A_LEVEL, null, undefined), null);
  assert.deepEqual(bandRangeFor(A_LEVEL, null, JSON.stringify({ top: "A*", bottom: "B" })), { scale: A_LEVEL, top: "A*", bottom: "B" });
});

test("pill words: GCSE bottom-top, a named scale top to bottom; '*' isn't offered on its own", () => {
  assert.equal(bandValue({ scale: GCSE_SCALE, top: "9", bottom: "5" }), "5–9");
  assert.equal(bandValue({ scale: GCSE_SCALE, top: "7", bottom: "7" }), "7");
  assert.equal(bandValue({ scale: A_LEVEL, top: "A*", bottom: "B" }), "A* to B");
  assert.deepEqual(pickableGrades(A_LEVEL), ["A*", "A", "B", "C", "D", "E"]);
  assert.deepEqual(pickableGrades(GCSE_SCALE), GCSE_SCALE);
});

test("the control: Results always; Grades only on Grade bands, with a preset, Custom, or Pick a range", () => {
  const onRange = () => {};
  assert.equal(text(html("points", { scale: GCSE_SCALE, range: { scale: GCSE_SCALE, top: "9", bottom: "7" }, onRange })), "Results: Average points");
  assert.equal(text(html("bands", { scale: GCSE_SCALE, range: { scale: GCSE_SCALE, top: "9", bottom: "7" }, onRange })), "Results: Grade bands Grades: 7–9");
  assert.equal(text(html("bands", { scale: GCSE_SCALE, range: { scale: GCSE_SCALE, top: "9", bottom: "5" }, onRange })), "Results: Grade bands Grades: Custom 5–9");
  assert.equal(text(html("bands", { scale: A_LEVEL, range: null, onRange })), "Results: Grade bands Grades: Pick a range");
  assert.equal(text(html("bands", { scale: A_LEVEL, range: { scale: A_LEVEL, top: "A*", bottom: "B" }, onRange })), "Results: Grade bands Grades: A* to B");
  // No focused subject: no band to pick.
  assert.equal(text(html("bands", null)), "Results: Grade bands");
});
