// Notes a view carries after its source (the caveat line in the panel's "i", printed as text
// in fullscreen and in "Print this graph"). One place for their wording, so it can be edited
// without touching a component.
//
// R-2122-GRADING-NOTE (0.6.2 S4): a grade or points trend whose years include 2021/22 says
// that year was graded more generously. Never on a latest-year view, on Candidates (entries)
// or at KS2 (its tests aren't graded by Ofqual's GCSE / A-level transition).
import type { ViewSpec } from "./viewspec";

// The wording. Edit here; every view reads it.
export const GRADING_2122_NOTE =
  "2021/22 grades were awarded more generously (Ofqual's transition year), so some fall from that year reflects grading, not results.";

// 2021/22, as the app's periods number it (the summer-2022 results).
export const GRADING_2122_PERIOD = 2021;

// The measures a view's figure can be on (teacher-view-panels' MeasureId): grades and points
// carry the note, entries ("Candidates") don't.
const GRADED = new Set(["points", "threshold", "bands", "counts"]);

// Whether a view's figure is a grade or points one -- the panel's measure, at its phase.
export function gradingNoteEligible(measureId: string, phase: string | null | undefined): boolean {
  return GRADED.has(measureId) && phase !== "ks2";
}

// The note for a view over `years` (the periods it draws, after any "From" trim), or null.
// A trend: two or more years, one of them 2021/22. `years` null = not a grade or points
// view, or a latest-year one.
export function gradingNoteFor(years: readonly number[] | null | undefined): string | null {
  if (!years || years.length < 2) return null;
  return years.includes(GRADING_2122_PERIOD) ? GRADING_2122_NOTE : null;
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
  if (spec.view.kind === "slope" && typeof years.from === "number") {
    const from = years.from;
    const last = hostYears[hostYears.length - 1];
    return last === undefined || last < from ? null : [from, last];
  }
  return hostYears;
}
