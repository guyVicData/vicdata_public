// VicData 0.7 year rules (docs/v0.7/vicdata_0_7_year_rules_review_claude_code_prompt_v1.md):
//   - the rules keep their years, in one file (src/catalogue/years.ts), and every old name reads
//     the same value;
//   - "latest" follows the data per key stage: a measure card's latest year is the data's when
//     it's known, else the card's own; GCSE can move on while Post-16 stays put;
//   - the provisional marker is off unless the data sets it, and only on the family's latest;
//   - Admissions' results reads keep the trend base when the latest year moves past it;
//   - a meeting's "move every view on" moves to the data's latest.
// Run: npx -y tsx --test src/lib/year-rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as Y from "../catalogue/years";
import { GRADING_2122_PERIOD, TREND_BASE_NOTE, TREND_BASE_PERIOD } from "../catalogue/notes";
import { MEASURES } from "../catalogue/measures";
import { yearsOf } from "../catalogue/pick";
import { HISTORIC_GRADE_FROM, HISTORIC_GRADE_TO, MODERN_GRADE_FROM } from "./grade-rows";
import { TREND_LINE_MIN_YEARS } from "./teacher-view-panels";
import { TREND_BASELINE_PERIOD } from "./academic-data-view";
import { CURRENT_CENSUS_PERIOD } from "./roll-data";
import { CENSUS_FIRST_PERIOD } from "./admissions/data";
import { PAST_FROM_ENTRY_YEAR } from "./admissions/ladder";
import { firstResultsYear } from "./admissions/ranks";
import { rollSlotForward } from "./meeting-views";

const measure = (id: string) => MEASURES.find((m) => m.id === id)!;

test("the rules keep their years, and every old name reads years.ts", () => {
  assert.equal(Y.GRADING_2122_PERIOD, 2021);
  assert.equal(Y.TREND_BASE_PERIOD, 2022);
  assert.equal(Y.TREND_LINE_MIN_YEARS, 4);
  // Year rules follow-ups (Guy, 13 Oct 2026): the Data View measures GCSE and Post-16 change from
  // 2022/23 (R-TREND-FROM-2223), KS2 from its first year. (Meetings follow R-TREND-LINE-4YR through
  // the host's panels; the round-5 catalogue's own constant went with it in the leftovers.)
  assert.deepEqual(Y.DATA_VIEW_TREND_BASELINE, { ks2: 2022, ks4: Y.TREND_BASE_PERIOD, ks5: Y.TREND_BASE_PERIOD });
  assert.equal(Y.MODERN_GRADE_FROM, 2023);
  assert.equal(Y.CENSUS_FIRST_PERIOD, 2019);
  assert.equal(Y.PAST_FROM_ENTRY_YEAR, 2020);
  assert.equal(Y.CURRENT_CENSUS_PERIOD, 2025);
  assert.equal(GRADING_2122_PERIOD, Y.GRADING_2122_PERIOD);
  assert.equal(TREND_BASE_PERIOD, Y.TREND_BASE_PERIOD);
  assert.equal(MODERN_GRADE_FROM, Y.MODERN_GRADE_FROM);
  assert.equal(HISTORIC_GRADE_FROM, 2021);
  assert.equal(HISTORIC_GRADE_TO, 2022);
  assert.equal(TREND_LINE_MIN_YEARS, Y.TREND_LINE_MIN_YEARS);
  assert.equal(TREND_BASELINE_PERIOD, Y.DATA_VIEW_TREND_BASELINE);
  assert.equal(CURRENT_CENSUS_PERIOD, Y.CURRENT_CENSUS_PERIOD);
  assert.equal(CENSUS_FIRST_PERIOD, Y.CENSUS_FIRST_PERIOD);
  assert.equal(PAST_FROM_ENTRY_YEAR, Y.PAST_FROM_ENTRY_YEAR);
  // The note's wording is built from the constants and reads exactly as before.
  assert.equal(
    TREND_BASE_NOTE,
    "Trends are measured from 2022/23. 2021/22 is still shown, but its grades were awarded more generously (Ofqual's transition year after the pandemic), so measuring from it would make most schools look as if results had fallen.",
  );
  assert.equal(Y.periodLabel(2022), "2022/23");
  assert.equal(Y.periodLabel(2099), "2099/00");
});

test("a measure card's latest year: the card's until the data is read, then the data's, per key stage", () => {
  Y.resetLatestYears();
  const ks4 = measure("M-KS4-HEADLINE");
  const ks5 = measure("M-KS5-HEADLINE");
  const rolls = measure("M-ROLLS");
  assert.deepEqual(yearsOf(ks4), ["2021/22", "2022/23", "2023/24", "2024/25"]);
  // Today's data: the same years exactly.
  Y.setLatestYears(Y.latestYearsFromRows([{ ks_stage: "ks4", latest_period: 2024 }, { ks_stage: "ks5", latest_period: 2024 }, { ks_stage: "ks2", latest_period: 2024 }]));
  assert.deepEqual(yearsOf(ks4), ["2021/22", "2022/23", "2023/24", "2024/25"]);
  assert.deepEqual(yearsOf(ks5), ["2021/22", "2022/23", "2023/24", "2024/25"]);
  // GCSE's 2025/26 lands; Post-16 waits for the A-level release.
  Y.setLatestYears({ ks4: { period: 2025, provisional: true } });
  assert.deepEqual(yearsOf(ks4), ["2021/22", "2022/23", "2023/24", "2024/25", "2025/26"]);
  assert.equal(yearsOf(measure("M-KS4-THRESHOLD")).at(-1), "2025/26");
  assert.equal(yearsOf(measure("M-KS4-ENTRIES")).at(-1), "2025/26");
  assert.equal(yearsOf(ks5).at(-1), "2024/25");
  assert.equal(yearsOf(measure("M-KS5-POINTS")).at(-1), "2024/25");
  // The census has no latest-year lookup yet: the card's year (an assumption, years.ts).
  assert.equal(yearsOf(rolls).at(-1), "2025");
  Y.resetLatestYears();
});

test("provisional: off unless the data says so, and only on that family's latest year", () => {
  Y.resetLatestYears();
  assert.equal(Y.withProvisional("2025/26", "ks4", 2025), "2025/26");
  Y.setLatestYears(Y.latestYearsFromRows([{ ks_stage: "ks4", latest_period: 2025 }]));
  assert.equal(Y.isProvisional("ks4", 2025), false); // no column: final
  Y.setLatestYears(Y.latestYearsFromRows([{ ks_stage: "ks4", latest_period: 2025, provisional: true }, { ks_stage: "ks5", latest_period: 2024, provisional: false }]));
  assert.equal(Y.withProvisional("2025/26", "ks4", 2025), "2025/26 (provisional)");
  assert.equal(Y.withProvisional("2024/25", "ks4", 2024), "2024/25");
  assert.equal(Y.withProvisional("2024/25", "ks5", 2024), "2024/25");
  assert.equal(Y.isProvisional(null, 2025), false);
  Y.resetLatestYears();
});

test("Admissions' results reads keep 2022/23 when the latest moves past it", () => {
  assert.equal(firstResultsYear(2024), 2022); // today: the latest three, the base among them
  assert.equal(firstResultsYear(2025), 2022); // 2025/26: four years, the base still loaded
  assert.equal(firstResultsYear(2026), 2022);
});

test("a meeting's 'move every view on' moves to the data's latest", () => {
  Y.resetLatestYears();
  const single = { view: { kind: "view", dataview: "DV-C3-CUR-MAP", pinned: { phase: "ks4", year: "2022/23" } } } as unknown as Parameters<typeof rollSlotForward>[0];
  const trend = { view: { kind: "view", dataview: "DV-C1-RES-TR-CHART", pinned: { phase: "ks4", yearRange: { from: "2021/22", to: "2024/25" } } } } as unknown as Parameters<typeof rollSlotForward>[0];
  const pin = (x: Parameters<typeof rollSlotForward>[0]) => (rollSlotForward(x).view as unknown as { pinned: { year?: string; yearRange?: unknown } }).pinned;
  // Before the data's read: the card's 2024/25, as before.
  assert.equal(pin(single).year, "2024/25");
  assert.deepEqual(pin(trend).yearRange, { from: "2021/22", to: "2024/25" });
  Y.setLatestYears({ ks4: { period: 2025, provisional: false } });
  assert.equal(pin(single).year, "2025/26");
  assert.deepEqual(pin(trend).yearRange, { from: "2022/23", to: "2025/26" });
  Y.resetLatestYears();
});
