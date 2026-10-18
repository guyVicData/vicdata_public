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
// This file imports only the flat band (lib/signed-delta.ts, which imports nothing), so anything
// (catalogue, lib, components, scripts) can read it.

import { flatBand, type Direction } from "../lib/signed-delta";

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

// The Data View's academic "since" year, per key stage: GCSE and Post-16 follow R-TREND-FROM-2223
// (Guy, 13 Oct 2026: year rules follow-ups), as Teacher does; KS2 from its first year (2022/23:
// KS2 has no earlier rows), as Teacher's KS2 does. Its graphs still draw 2021/22, with the note.
// Candidates (entries) changes in the Data View are measured from the first year with data.
export const DATA_VIEW_TREND_BASELINE: Record<"ks2" | "ks4" | "ks5", number> = { ks2: 2022, ks4: TREND_BASE_PERIOD, ks5: TREND_BASE_PERIOD };

// R-ENTRIES-FIRST-YEAR (Guy, 16 Oct 2026: year rules leftovers): an entries (Candidates) view draws
// and measures from the first year with data, per phase and measure -- read from the data, never
// written here. For GCSE subjects that is 2020/21, the teacher-assessed year (entry totals, no
// grades). Grades and points keep R-TREND-FROM-2223. Pass the years that hold an entries figure.
export function entriesFirstPeriod(periodsWithData: Iterable<number>): number | null {
  let first: number | null = null;
  for (const p of periodsWithData) if (Number.isFinite(p) && (first === null || p < first)) first = p;
  return first;
}

// Where a change starts: entries from their first year with data (R-ENTRIES-FIRST-YEAR), everything
// else from 2022/23 (R-TREND-FROM-2223).
export function changeStartFor(kind: "entries" | "results", periodsWithData: Iterable<number>): number {
  return kind === "entries" ? (entriesFirstPeriod(periodsWithData) ?? TREND_BASE_PERIOD) : TREND_BASE_PERIOD;
}

// R-ROLL-WORDS-3YR (Guy, 17 Oct 2026: consistency): a roll or headcount direction word ("Growing",
// "Shrinking", "Steady", and any arrow that words one) compares the latest census year with 3 years
// earlier, everywhere. A school with fewer than 4 census years uses the longest span it has. Steady is
// R-FLAT-BAND: the 3-year change rounds to 0 at the precision shown. The "since" figures are separate
// (from the first census year, CENSUS_FIRST_PERIOD) and an arrow on one follows its own figure.
export const ROLL_DIRECTION_SPAN = 3;

export type RollWord = "Growing" | "Shrinking" | "Steady";
export const ROLL_WORD: Record<Direction, RollWord> = { up: "Growing", down: "Shrinking", flat: "Steady" };

export type RollDirection = { dir: Direction; word: RollWord; from: number; to: number; span: number; pct: number; short: boolean };

/** The roll direction from a yearly series (a roll, or an index of it: the ratio is the same). */
export function rollDirection(points: readonly { year: number; value: number | null }[], dp = 0): RollDirection | null {
  const real = points.filter((p): p is { year: number; value: number } => p.value !== null && Number.isFinite(p.value)).sort((a, b) => a.year - b.year);
  const to = real.at(-1);
  if (!to) return null;
  const base = real.find((p) => p.year >= to.year - ROLL_DIRECTION_SPAN && p.value > 0);
  if (!base || base.year >= to.year) return null;
  const pct = ((to.value - base.value) / base.value) * 100;
  const dir = flatBand(pct, dp);
  return { dir, word: ROLL_WORD[dir], from: base.year, to: to.year, span: to.year - base.year, pct, short: to.year - base.year < ROLL_DIRECTION_SPAN };
}

/** The roll word for a 3-year % change already computed (the groups' database figures). */
export function rollDirectionOfPct(pct: number, dp = 0): Direction {
  return flatBand(pct, dp);
}

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

// 0.8 SMT r4 (F5): the projection tile reaches this far past the latest counted year ("11-15s by
// 2030" from mid-2025). The charts run to the projection's own horizon (area_projection's horizon_end,
// latest + 11 in the settings), read from the data. (Round 3's SMT_PROJECTION_CHART_AHEAD and the
// projection-join threshold are retired with ONS's line as the main projection.)
export const SMT_PROJECTION_TILE_AHEAD = 5;

// 0.8 SMT feedback round 1 (F-3, F-4): where two measures' published series start and stop, the
// reasons the Scorecard's trend cells cover different years (R-TREND-PERIOD-PER-CELL).
// Sixth-form value added: DfE published none for 2021/22 or 2022/23 (those students' GCSEs were
// teacher-assessed in 2020 and 2021, so there is no prior-attainment baseline); 2023/24 is its first
// year. Later years are read from the data, so 2025/26 (mid-November) extends the trend unaided.
export const SIXTH_FORM_VA_FROM = 2023;
// Progress 8: 2023/24 is the last cohort with a KS2 baseline (summer 2019); there were no KS2 tests
// in 2020 or 2021, so none is published for 2024/25 or 2025/26.
export const PROGRESS8_LAST_PERIOD = 2023;

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
