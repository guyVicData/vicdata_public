// VicData 0.7 admissions r1 (A4): the flags' rules on small cases (src/lib/admissions/flags.ts),
// and how saved lists become the maths' sets (lists.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { entryYearShrinking, feederFlag, gainingPupils, losingPupils, newSixthForm, resultsRisingFast, shapeChanged, strengthFlags, FLAG_RULES } from "./admissions/flags";
import { rungSetsFromLists, rivalsFromLists, blendFromLists } from "./admissions/lists";
import { entryPoint } from "./admissions/entry-points";
import type { Threshold } from "./admissions/thresholds";

const t = (low: number, high: number, minCohort = 10): Threshold => ({ phase: "secondary", measure: "headline", changeKind: "percent", low, high, lowPct: 20, highPct: 80, minCohort, nSchools: 1000, from: 2022, to: 2024 });

test("R-ADM-FLAG-MOMENTUM: results rising fast and gaining pupils fire only in the national top fifth, never on a small cohort", () => {
  assert.equal(resultsRisingFast({ from: 40, to: 46, fromYear: 2022, toYear: 2024 }, t(-2, 4), 120)?.id, "results_rising_fast", "+6 points, over the top fifth (+4)");
  assert.equal(resultsRisingFast({ from: 40, to: 43, fromYear: 2022, toYear: 2024 }, t(-2, 4), 120), null, "+3 points is under it");
  assert.equal(resultsRisingFast({ from: 40, to: 46, fromYear: 2022, toYear: 2024 }, t(-2, 4), 6), null, "a small cohort never flags");
  assert.equal(resultsRisingFast({ from: 40, to: 46, fromYear: 2022, toYear: 2024 }, null, 120), null, "no thresholds, no flag");
  assert.equal(gainingPupils({ from: 600, to: 700, fromYear: 2023, toYear: 2025 }, t(-6, 8))?.figures.changePct, (100 / 600) * 100);
});

test("R-ADM-FLAG-MOMENTUM: losing pupils three years running; the entry year shrinking; a new sixth form; a lasting shape change", () => {
  assert.equal(losingPupils([{ year: 2022, roll: 900 }, { year: 2023, roll: 880 }, { year: 2024, roll: 870 }, { year: 2025, roll: 860 }], 10)?.id, "losing_pupils_3y");
  assert.equal(losingPupils([{ year: 2022, roll: 900 }, { year: 2023, roll: 880 }, { year: 2024, roll: 890 }, { year: 2025, roll: 860 }], 10), null);
  assert.equal(entryYearShrinking({ from: 180, to: 150, fromYear: 2023, toYear: 2025, age: 11 }, t(-10, 10))?.label, "Year 7 shrinking");
  assert.equal(entryYearShrinking({ from: 180, to: 170, fromYear: 2023, toYear: 2025, age: 11 }, t(-10, 10)), null);
  const at16 = [2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => ({ year, count: year >= 2024 ? 40 : 0 }));
  assert.equal(newSixthForm(at16, 2025, 10)?.figures.firstYearWith, 2024);
  assert.equal(newSixthForm(at16.map((x) => ({ ...x, count: 40 })), 2025, 10), null, "an established sixth form");
  assert.equal(shapeChanged([{ year: 2022, shape: "tube" }, { year: 2024, shape: "pyramid" }, { year: 2025, shape: "pyramid" }], 2025)?.id, "shape_changed");
  assert.equal(shapeChanged([{ year: 2022, shape: "tube" }, { year: 2024, shape: "tube" }, { year: 2025, shape: "pyramid" }], 2025), null, "one year is not lasting");
});

test("R-ADM-FLAG-STRENGTHS: top or bottom third of the rivals with that area; growing / widening need the national fifth", () => {
  const s = strengthFlags({ mine: 6, rivals: [5, 5.2, 4.8, 5.1, 4.9], rank: 1, gapNow: 1, gapBase: 0.5, myTwoYearChange: 0.6 }, t(-0.3, 0.5));
  assert.deepEqual(s.map((f) => f.id), ["strength", "strength_growing"]);
  const w = strengthFlags({ mine: 4, rivals: [5, 5.2, 4.8, 5.1, 4.9], rank: 6, gapNow: -1, gapBase: -0.5, myTwoYearChange: -0.4 }, t(-0.3, 0.5));
  assert.deepEqual(w.map((f) => f.id), ["weakness", "weakness_widening"]);
  assert.deepEqual(strengthFlags({ mine: 6, rivals: [5], rank: 1, gapNow: 1, gapBase: 0, myTwoYearChange: 1 }, t(-0.3, 0.5)), [], "one rival is not a comparison");
});

test("R-ADM-FLAG-FEEDER: a drop bigger than the area's is red; rising or stable is a focus", () => {
  assert.equal(feederFlag({ from: 100, to: 80 }, { from: 1000, to: 980 }, 10)?.id, "feeder_red");
  assert.equal(feederFlag({ from: 100, to: 99 }, { from: 1000, to: 980 }, 10)?.label, "Stable");
  assert.equal(feederFlag({ from: 100, to: 110 }, { from: 1000, to: 980 }, 10)?.label, "Rising");
  assert.equal(feederFlag({ from: 100, to: 96 }, { from: 1000, to: 980 }, 10), null, "a fall like the area's");
  assert.equal(feederFlag({ from: 8, to: 2 }, { from: 1000, to: 980 }, 10), null, "never from a small cohort");
  assert.equal(FLAG_RULES.feederMarginPts, 5);
});

test("saved lists: rung lists win, day and boarding feeders together make the primary pool, rivals and blend", () => {
  const defaults = new Map([[9, ["d1"]], [10, ["d1"]], [11, ["s1"]], [14, ["s1"]]]);
  const lists = [
    { kind: "day_feeders", rung: "", members: ["a"], la_blend: { "885": 1 }, confirmed: true },
    { kind: "boarding_feeders", rung: "", members: ["b"], la_blend: null, confirmed: true },
    { kind: "rung", rung: "age:14", members: ["s9"], la_blend: null, confirmed: true },
    { kind: "rivals", rung: "", members: ["r1", "r2"], la_blend: null, confirmed: true },
  ];
  const at11 = rungSetsFromLists(entryPoint("11+")!, lists, defaults);
  assert.deepEqual(at11.get(10), ["a", "b"]);
  assert.deepEqual(at11.get(11), ["s1"], "at 11+ the secondaries are not feeders");
  const at16 = rungSetsFromLists(entryPoint("16+")!, lists, defaults);
  assert.deepEqual(at16.get(14), ["s9"]);
  assert.deepEqual(at16.get(11), ["a", "b"]);
  assert.deepEqual(rivalsFromLists(lists), ["r1", "r2"]);
  assert.deepEqual(blendFromLists(lists), { "885": 1 });
});
