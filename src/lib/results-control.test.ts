// VicData 0.6.1 S5 (D3 + D4): the top bar's Results switch and grade band choice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsControl, bandValue, pickableGrades } from "@/components/teacher/ResultsControl";
import { GCSE_SCALE, GRADE_SCALES, inlineRangeLabel, presetsFor, rangeLabel } from "@/lib/subject-grades";
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

// 0.6.1 S6: a range inside a sentence keeps the scale's own grades (the Post-16 tiles read
// "a* to b" before), as "A*–B"; GCSE stays "grades 7–9".
test("inline range labels keep the scale's own grades", () => {
  assert.equal(inlineRangeLabel(rangeLabel({ scale: A_LEVEL, top: "A*", bottom: "B" })), "A*–B");
  assert.equal(inlineRangeLabel(rangeLabel({ scale: A_LEVEL, top: "A", bottom: "A" })), "A");
  assert.equal(inlineRangeLabel(rangeLabel({ scale: GCSE_SCALE, top: "9", bottom: "7" })), "grades 7–9");
  assert.equal(inlineRangeLabel(rangeLabel({ scale: GCSE_SCALE, top: "5", bottom: "5" })), "grade 5");
  assert.equal(inlineRangeLabel("9-9 to 5-5"), "9-9 to 5-5");
});

// 0.6.5 S1 (the 0.6.4 audit's change 1): Grade bands opens on a default range at Post-16.
test("Post-16 opens on each scale's default band; GCSE is unchanged; KS4 never gains a Post-16 preset", () => {
  const ks5 = (qualificationType: string) => ({ phase: "ks5", qualificationType });
  const at = (scale: string[], q: string) => bandRangeFor(scale, null, undefined, ks5(q));
  const [IB, VOC1, VOC2, VOC3] = [GRADE_SCALES[3], GRADE_SCALES[5], GRADE_SCALES[6], GRADE_SCALES[7]];
  const TLEVEL = GRADE_SCALES[GRADE_SCALES.length - 1];
  const ends = (r: ReturnType<typeof bandRangeFor>) => (r ? `${r.top}..${r.bottom}` : null);
  assert.equal(ends(at(A_LEVEL, "GCE A level")), "A*..A");
  assert.equal(ends(at(A_LEVEL, "GCE AS level")), "A..B");
  assert.equal(ends(at(A_LEVEL, "Core Maths Qualifications at Level 3")), "A..B");
  assert.equal(ends(at(A_LEVEL, "Extended Project (Diploma)")), "A*..A");
  assert.equal(ends(at(IB, "IBO Higher level component")), "7..6");
  assert.equal(ends(at(VOC1, "BTEC National Extended Certificate L3 - Band F - P-D*")), "Distinction*..Distinction");
  assert.equal(ends(at(VOC2, "BTEC National Diploma L3 - Band J - PP-D*D*")), "Distinction*-Distinction*..Distinction-Distinction");
  assert.equal(ends(at(VOC3, "BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*")), "Distinction*-Distinction*-Distinction*..Distinction-Distinction-Distinction");
  assert.equal(ends(at(TLEVEL, "T Level")), "Distinction*..Merit");
  // A scale with no listed default (Pre-U) and an A*-E qualification not listed: custom only.
  assert.equal(at(GRADE_SCALES[11], "Cambridge Pre-U Principal Subject"), null);
  assert.equal(at(A_LEVEL, "Other General Qualification"), null);
  // GCSE: 7-9 as before, with or without the context; a GCSE cohort read as the IB 7-1 scale
  // gains no band (the Post-16 presets are Post-16 only).
  assert.deepEqual(bandRangeFor(GCSE_SCALE, null, undefined, { phase: "ks4", qualificationType: "GCSE (9-1) Full Course" }), { scale: GCSE_SCALE, top: "9", bottom: "7" });
  assert.equal(bandRangeFor(IB, null, undefined, { phase: "ks4", qualificationType: "GCSE (9-1) Full Course" }), null);
  assert.deepEqual(presetsFor(GCSE_SCALE, { phase: "ks4" }).map((p) => p.label), ["4–9", "7–9"]);
  // The menu: the default plus Custom, as at GCSE.
  assert.deepEqual(presetsFor(A_LEVEL, ks5("GCE A level")).map((p) => p.label), ["A* to A"]);
});

test("a saved range wins; one that isn't on the new focus's scale falls back to that scale's default", () => {
  const ks5 = { phase: "ks5", qualificationType: "GCE A level" };
  assert.deepEqual(bandRangeFor(A_LEVEL, null, JSON.stringify({ top: "A*", bottom: "B" }), ks5), { scale: A_LEVEL, top: "A*", bottom: "B" });
  // A BTEC range saved, then the focus moves to an A level: A* to A, never a stale or blank range.
  const saved = JSON.stringify({ top: "Distinction*", bottom: "Merit" });
  assert.deepEqual(bandRangeFor(A_LEVEL, null, saved, ks5), { scale: A_LEVEL, top: "A*", bottom: "A" });
  // ...and back to the BTEC: the saved range again.
  assert.deepEqual(bandRangeFor(GRADE_SCALES[5], null, saved, { phase: "ks5", qualificationType: "BTEC National Extended Certificate L3 - Band F - P-D*" }), { scale: GRADE_SCALES[5], top: "Distinction*", bottom: "Merit" });
});

test("the top bar at Post-16: Grades A* to A, with its preset and Custom", () => {
  const band = { scale: A_LEVEL, range: { scale: A_LEVEL, top: "A*", bottom: "A" }, onRange: () => {}, presets: { phase: "ks5", qualificationType: "GCE A level" } };
  assert.match(text(html("bands", band)), /Grades: A\* to A/);
});
