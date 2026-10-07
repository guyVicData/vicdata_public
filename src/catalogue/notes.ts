// Notes a view carries after its source (the caveat line in the panel's "i", printed as text
// in fullscreen and in "Print this graph"), and the one trend rule they explain. One place for
// the wording and the base year, so either can be edited without touching a component.
//
// R-TREND-FROM-2223 (0.6.2 S4b, Guy's decision of 6 Oct 2026; it replaces S4's
// R-2122-GRADING-NOTE): 2021/22 (summer 2022, Ofqual's transition year) stays on a grade or
// points trend's graphs and tables, but every trend statement is measured from 2022/23 --
// direction words, "change since", change tables, ranked change lists, change maps, fitted
// lines, slopes, captions and summaries. A view whose drawn years include 2021/22 carries the
// note saying so. Never on a latest-year view, on Candidates (entries) or at KS2 (its tests
// aren't graded by Ofqual's GCSE / A-level transition).
import type { ViewSpec } from "./viewspec";

// The wording. Edit here; every view reads it.
export const TREND_BASE_NOTE =
  "Trends are measured from 2022/23. 2021/22 is still shown, but its grades were awarded more generously (Ofqual's transition year after the pandemic), so measuring from it would make most schools look as if results had fallen.";

// 2021/22, as the app's periods number it (the summer-2022 results).
export const GRADING_2122_PERIOD = 2021;

// The year every trend statement is measured from: 2022/23 (the summer-2023 results). The one
// place it is set.
export const TREND_BASE_PERIOD = 2022;

// The measures a view's figure can be on (teacher-view-panels' MeasureId): grades and points
// follow the rule, entries ("Candidates") don't.
const GRADED = new Set(["points", "threshold", "bands", "counts"]);

// Whether a view's figure is a grade or points one -- the panel's measure, at its phase.
export function trendBaseApplies(measureId: string, phase: string | null | undefined): boolean {
  return GRADED.has(measureId) && phase !== "ks2";
}

// The year statements on this measure are measured from, or null (entries, KS2: from the
// first year, as before).
export function trendBaseFor(measureId: string, phase: string | null | undefined): number | null {
  return trendBaseApplies(measureId, phase) ? TREND_BASE_PERIOD : null;
}

// The note for a view over `years` (the periods it draws, after any "From" trim), or null.
// A trend: two or more years, one of them 2021/22. `years` null = not a grade or points
// view, or a latest-year one.
export function trendNoteFor(years: readonly number[] | null | undefined): string | null {
  if (!years || years.length < 2) return null;
  return years.includes(GRADING_2122_PERIOD) ? TREND_BASE_NOTE : null;
}

// Under views=v2, the years the panel's showing view draws: its host's (the Trends "From"
// year, Grade counts' compare year), except a latest-year spec (none; one the member moves
// with a year menu -- Grade counts' Spread by year, latest against a picked year -- keeps
// the host's) and a slope with a fixed first year (that year and the latest; slope.ts is
// the one builder that reads a numeric `from`).
export function specYears(spec: ViewSpec | null | undefined, hostYears: readonly number[] | null | undefined): readonly number[] | null {
  if (!hostYears) return null;
  if (!spec) return hostYears;
  const years = spec.data.years;
  if ("latest" in years) return years.memberPick ? hostYears : null;
  // R-TREND-FROM-2223: a change map colours each school by its change from 2022/23 at the
  // earliest, so it draws no 2021/22 figure.
  if (spec.view.kind === "map") return hostYears.filter((p) => p >= TREND_BASE_PERIOD);
  if (spec.view.kind === "slope") {
    const last = hostYears[hostYears.length - 1];
    if (last === undefined) return null;
    // R-TREND-FROM-2223: a slope from the span's first year starts at 2022/23 at the
    // earliest (slope.ts), so it draws 2021/22 only when its first year is fixed there.
    const from = typeof years.from === "number" ? years.from : hostYears.find((p) => p >= TREND_BASE_PERIOD);
    return from === undefined || last < from ? null : [from, last];
  }
  return hostYears;
}

// ------------------------------------------------------------------ admissions (0.7 r1)
// The honesty wording for the Admissions dashboards (src/lib/admissions/), in one place like the
// trend notes above, so a view never words a pool, a share or an estimate on its own.
export const ADMISSIONS_NOTES = {
  // R-ADM-POOL-NOT-INTAKE
  pool: "This is the pool, not an intake: the children in these schools, or born in these areas, who will reach this entry point. It does not say how many will come.",
  // R-ADM-LADDER: the certainty of each year, by its source
  counted: "Counted: children in these schools now (the January census), followed forward.",
  births: "From births: the area's calendar-year births, scaled to these schools by how many of them have reached Reception in past years. A range, not a count.",
  projection: "From ONS projections (age 10, by local authority): a wider band, shown only on request.",
  // R-ADM-BIRTH-SPLIT
  birthSplit: "Births are counted by calendar year; a school year runs September to August, so each year's pool is 8/12 of one year's births plus 4/12 of the year before.",
  birthSex: "Births have no boy/girl split: a girls' or boys' pool from births is an estimate (49% / 51%).",
  // R-ADM-DRIFT-RANGE
  drift: "The range is how much these schools' year groups have actually grown or shrunk from one year to the next since 2019/20 (the middle 80% of those changes), applied for each year still to go -- so it widens the further ahead it looks.",
  // R-ADM-HOLD-SHARE
  holdShare: "The share needed to hold numbers steady: this year's intake as a share of each future pool. A requirement, not a forecast.",
  // R-ADM-GROUP-SHARE
  groupShare: "A share of this group: your pupils at this age as a share of the same age across these schools. Not a share of the local market.",
  // R-ADM-JOINERS-ESTIMATE
  joiners: "An estimate: the growth in a year group from one January to the next. It counts net arrivals, not every pupil who joined.",
  leaving16: "Leaving at 16: the fall from Year 11 to Year 12 at the same school, a year apart. An estimate of net leavers.",
  // R-ADM-SHAPE-NOT-RANKED
  shape: "Shapes describe a school's year groups; they are not better or worse, so they are never ranked.",
} as const;
