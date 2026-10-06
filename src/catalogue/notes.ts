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
