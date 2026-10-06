// VicData 0.6.3 S3: Post-16 safeguards -- "*" is A*, area rows' historic labels, the scale
// from the qualification type (T Level / vocational tie).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseKs5AreaRows, starIsAStar } from "./grade-rows";
import { GRADE_SCALES, T_LEVEL_SCALE, bandRate, bestScale, scaleFits, scaleForQualification } from "./subject-grades";

test("R-ALEVEL-STAR: '*' merges into A* per subject, qualification, size and year", () => {
  const rows = [
    { qualificationType: "GCE A level", subject: "Mathematics", period: 2021, grade: "*", entries: 20, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Mathematics", period: 2021, grade: "A", entries: 12, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Mathematics", period: 2024, grade: "A*", entries: 8, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Mathematics", period: 2024, grade: "*", entries: 1, sizeWeight: 1 },
  ];
  const out = starIsAStar(rows, (r) => `${r.qualificationType}|${r.subject}|${r.period}|${r.sizeWeight}`);
  assert.deepEqual(out.map((r) => `${r.period}:${r.grade}:${r.entries}`), ["2021:A*:20", "2021:A:12", "2024:A*:9"]);
});

test("R-HISTORIC-GRADE-LABELS-AREA: England's BTEC codes take their words; an A level's '*' is A*", () => {
  const btec = normaliseKs5AreaRows(
    [
      { period: 2022, grade: "*", entries: 10, schoolCount: 40 },
      { period: 2022, grade: "D", entries: 30, schoolCount: 60 },
      { period: 2024, grade: "Distinction*", entries: 12, schoolCount: 41 },
    ],
    "BTEC National Extended Certificate L3 - Band F - P-D*",
  );
  assert.deepEqual(btec.map((r) => `${r.period}:${r.grade}`), ["2022:Distinction*", "2022:Distinction", "2024:Distinction*"]);
  const alevel = normaliseKs5AreaRows(
    [
      { period: 2022, grade: "*", entries: 100, schoolCount: 900 },
      { period: 2022, grade: "D", entries: 50, schoolCount: 800 },
      { period: 2024, grade: "A*", entries: 90, schoolCount: 900 },
    ],
    "GCE A level",
  );
  assert.deepEqual(alevel.map((r) => `${r.period}:${r.grade}`), ["2022:A*", "2022:D", "2024:A*"], "'D' stays an A-level D");
});

test("R-SCALE-FROM-QUAL: a T Level focus is on the T Level scale; a tied comparator is still scored", () => {
  const grades = ["Distinction*", "Distinction", "Merit", "Pass"];
  assert.equal(bestScale(grades), GRADE_SCALES[5], "the tie bestScale resolves to the vocational scale");
  assert.equal(scaleForQualification("T Level", grades), T_LEVEL_SCALE);
  assert.equal(scaleForQualification("GCE A level", ["A*", "A"]), GRADE_SCALES[2]);
  assert.ok(scaleFits(grades, T_LEVEL_SCALE));
  const range = { scale: T_LEVEL_SCALE, top: "Distinction*", bottom: "Distinction" };
  const r = bandRate(grades.map((g, i) => ({ grade: g, entries: [2, 3, 4, 1][i] })), range);
  assert.equal(r?.rate, 50, "a T Level comparator without Partial achievement is scored, not a grey dot");
  assert.equal(bandRate([{ grade: "A*", entries: 3 }, { grade: "B", entries: 1 }], range), null, "an A-level row still isn't scored on a T Level range");
});
