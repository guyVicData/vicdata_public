// VicData 0.7 year rules (docs/v0.7/vicdata_0_7_year_rules_review_claude_code_prompt_v1.md).
//
// One file for the years the app treats as fixed, each with the reason beside it, and the one
// place "the latest year" is looked up from the data. Two kinds of year live here:
//
//   RULES       deliberate, and stay put when a new year lands (2022/23 as the year every trend
//               statement is measured from; the 2021/22 grading note). Edit them here.
//   ASSUMPTIONS still fixed, but they describe the data rather than decide anything (the census
//               year). Each says what would make it follow the data.
//
// "The latest year" is never written here: it is read from the data, per key stage (ks2, ks4,
// ks5), by latestPeriodOf() below, and each view also reads its own latest per measure (a
// school's, a subject's, a set's). After DfE's GCSE release, GCSE's latest moves on while
// Post-16's stays put until the A-level one, and each view labels its own year.
//
// Periods: P is the academic year P/(P+1) -- 2024 is 2024/25 (the summer-2025 exams; for the
// census, the January 2026 count).
//
// This file imports nothing, so anything (catalogue, lib, components, scripts) can read it.

// "2022/23" for 2022: the app's usual academic-year label, for the rule wording below.
export const periodLabel = (p: number): string => `${p}/${String((p + 1) % 100).padStart(2, "0")}`;

// ------------------------------------------------------------------------------------- RULES

// R-TREND-FROM-2223 (Guy, 6 Oct 2026): 2021/22 -- summer 2022, Ofqual's transition year after
// the pandemic, when grades were awarded more generously -- stays on a grade or points trend's
// graphs and tables, but carries the note (catalogue/notes.ts TREND_BASE_NOTE).
export const GRADING_2122_PERIOD = 2021;

// R-TREND-FROM-2223: every trend statement (direction words, "change since", change tables and
// lists, change maps, fitted lines, slopes) is measured from 2022/23, the first year graded on
// the normal scale. It stays 2022/23 as later years arrive (four years of change once 2025/26
// lands): Guy's call to move it (year rules report, question 1).
export const TREND_BASE_PERIOD = 2022;

// R-TREND-LINE-4YR: a trend is drawn as a line only with 4 or more real years; fewer read as a
// trend that isn't there.
export const TREND_LINE_MIN_YEARS = 4;

// R-TREND-3YR (superseded by R-TREND-LINE-4YR everywhere but the meetings slide picker, which
// still offers a "N-year trend" from 3 years: listed as a question in the year rules report).
export const MEETING_TREND_MIN_YEARS = 3;

// The Data View's academic "since" baseline, per key stage: KS4 and KS5 from 2021/22, KS2 from
// its first year (2022/23: KS2 has no earlier rows). NOT the Teacher rule above -- the Data
// View still measures KS4/KS5 change from 2021/22. Kept as it is; whether it should follow
// R-TREND-FROM-2223 is a question for Guy (year rules report).
export const DATA_VIEW_TREND_BASELINE: Record<"ks2" | "ks4" | "ks5", number> = { ks2: 2022, ks4: 2021, ks5: 2021 };

// ---------------------------------------------- RULES: where the sources start (source facts)

// Grade rows (src/lib/grade-rows.ts): the modern sources from 2023/24, the historic ones for
// 2021/22-2022/23 (they also hold 2020/21, totals only: the teacher-assessed year, no grades).
// R-CURRENT-GRADES-FROM-2324: a latest-year grade view reads the modern sources only.
export const MODERN_GRADE_FROM = 2023;
export const HISTORIC_GRADE_FROM = 2021;
export const HISTORIC_GRADE_TO = 2022;

// The school census series the app reads starts in 2019/20 (the January 2020 count): the
// Data View's "since" default and anchor, Admissions' first year and its indexed lines'
// "2019/20 = 100".
export const CENSUS_FIRST_PERIOD = 2019;

// Admissions' past pools start with September-2020 entry (the first entry year with a counted
// rung, census 2019/20).
export const PAST_FROM_ENTRY_YEAR = CENSUS_FIRST_PERIOD + 1;

// ------------------------------------------------------------------------------- ASSUMPTIONS

// The census year everything census-based reads (rolls, shapes, Admissions' pipeline, the
// surrounding-schools lists, the precomputed aggregates the sync scripts write). An
// ASSUMPTION: it should follow the census ingest. It doesn't yet because no national "latest
// census year" lookup exists (academic_current_periods has KS2/KS4/KS5 only), and this round
// makes no database change. Next: add a 'census' row to academic_current_periods in the ingest
// repo and read it through latestPeriodOf("census"). Until then, move it when the census lands.
export const CURRENT_CENSUS_PERIOD = 2025;

// ----------------------------------------------------------------- the latest year, from data

// The families whose latest year can differ: KS2, GCSE (KS4: headline and subject arrive
// together in DfE's October release), Post-16 (KS5), and the census. Value added (Progress 8)
// isn't a family: DfE published none after 2023/24, and no view draws it.
export type YearFamily = "ks2" | "ks4" | "ks5" | "census";

export type LatestYear = {
  period: number;
  // DfE's October KS4 data is provisional, revised in the spring. Set by the ingest (a column on
  // academic_current_periods, read when present); absent = false, so nothing changes until
  // the ingest says so.
  provisional: boolean;
};

export type LatestYears = Partial<Record<YearFamily, LatestYear>>;

// Filled from the data: on the server by whoever reads academic_current_periods, on a client
// by the payload that carries it (the Teacher dashboard's, /api/academic-periods). Empty until
// then; every reader falls back to its own data or its card's year.
const live: LatestYears = {};

export function setLatestYears(years: LatestYears | null | undefined): void {
  if (!years) return;
  for (const [k, v] of Object.entries(years) as [YearFamily, LatestYear | undefined][]) {
    if (v && Number.isFinite(v.period)) live[k] = { period: v.period, provisional: v.provisional === true };
  }
}

export function latestPeriodOf(family: YearFamily | null | undefined): number | null {
  return family ? (live[family]?.period ?? null) : null;
}

// Whether `period` is a provisional year for this family: only the family's latest can be.
export function isProvisional(family: YearFamily | null | undefined, period: number | null | undefined): boolean {
  if (!family || period === null || period === undefined) return false;
  const l = live[family];
  return !!l && l.provisional && l.period === period;
}

// "2025/26" -> "2025/26 (provisional)" where that year is the family's provisional latest.
export function withProvisional(label: string, family: YearFamily | null | undefined, period: number | null | undefined): string {
  return isProvisional(family, period) ? `${label} (provisional)` : label;
}

// An RPC row of academic_current_periods ({ ks_stage, latest_period, provisional? }) into the
// shape above. `provisional` is read only when the column exists.
export function latestYearsFromRows(rows: readonly { ks_stage: string; latest_period: number | null; provisional?: boolean | null }[] | null | undefined): LatestYears {
  const out: LatestYears = {};
  for (const r of rows ?? []) {
    if (r.latest_period === null || r.latest_period === undefined) continue;
    if (r.ks_stage === "ks2" || r.ks_stage === "ks4" || r.ks_stage === "ks5" || r.ks_stage === "census") {
      out[r.ks_stage] = { period: r.latest_period, provisional: r.provisional === true };
    }
  }
  return out;
}

// A measure card's latest year: the data's, for its family, where that has been read on this
// page or server; otherwise the card's own `to`. Written the card's way ("2024/25" or "2025").
export function measureYearsTo(years: { to: string; latest?: YearFamily }): string {
  const p = latestPeriodOf(years.latest);
  if (p === null) return years.to;
  return /^\d{4}\/\d{2}$/.test(years.to) ? periodLabel(p) : String(p);
}

// For tests: forget what was set.
export function resetLatestYears(): void {
  for (const k of Object.keys(live)) delete live[k as YearFamily];
}
