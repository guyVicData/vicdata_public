// VicData 0.6.3 S1: Grade counts' grade selection -- click one grade or a range in Column 1's
// Current, and Columns 2 and 3 follow it.
//
// The selection IS the top bar's grade band setting (band:range, saved as {top, bottom}):
// one setting, two ways in. Set Custom 9-5 in the top bar and Grade counts highlights 9-5;
// click grade 9 in Grade counts and Grade bands shows 9. Pure (no React, no fetching).
//
//   nextSelection     what a click on a grade does to the saved selection
//   rangeEndGrade     whether a grade can be a range end (U / Fail / Unclassified can't)
//   englandShare      England's share of graded entries inside the selection, honest about
//                     suppressed grades (R-ENGLAND-GRADED-ONLY)
//   answerLine        Column 1 Current's one-line answer, in the scale's own wording
import { BOTTOM_RANK, NON_GRADE_VALUES, bandRate, rangeLabel, spanBetween, type GradeRange } from "./subject-grades";
import type { GradeCountRow } from "./grade-spread";

export type Selection = { top: string; bottom: string };

/**
 * R-RANGE-ENDS-GRADED: U, Fail and Unclassified can't start or end a range (the top bar's
 * picker hides them, pickableGrades), at both phases. Nor can a non-grade, a grade off the
 * focused subject's scale, or "*" (A-level's raw duplicate of A*, R-ALEVEL-STAR).
 */
export function rangeEndGrade(scale: string[], grade: string): boolean {
  return !(grade in BOTTOM_RANK) && !NON_GRADE_VALUES.has(grade) && grade !== "*" && scale.includes(grade);
}

/** Why a grade can't be clicked (its tooltip), or null when it can. */
export function notRangeEndReason(scale: string[], grade: string): string | null {
  if (rangeEndGrade(scale, grade)) return null;
  if (grade in BOTTOM_RANK) return `${grade} can't start or end a range: ranges run between graded results.`;
  return `${grade} isn't on this subject's grade scale, so it can't start or end a range.`;
}

/**
 * R-COUNTS-SELECTION: a click on a grade.
 *   no selection                       -> that grade alone
 *   one grade, a click on another      -> the range between them (either way round)
 *   one grade, a click on the same     -> cleared (null)
 *   a range, any click                 -> a new selection from the clicked grade
 * "ignore" for a grade that can't be a range end (nothing changes).
 */
export function nextSelection(scale: string[], current: Selection | null, grade: string): Selection | null | "ignore" {
  if (!rangeEndGrade(scale, grade)) return "ignore";
  if (!current) return { top: grade, bottom: grade };
  if (current.top === current.bottom) {
    if (current.top === grade) return null;
    return spanBetween(scale, current.top, grade);
  }
  return { top: grade, bottom: grade };
}

/**
 * R-COUNTS-SELECTION: the saved selection, read for Grade counts -- the saved band:range
 * while both ends are range ends on the focused subject's scale, else none. Unlike
 * bandRangeFor (Grade bands), never a preset: Grade counts starts with nothing selected.
 */
export function savedSelection(scale: string[], savedRaw: string | undefined): GradeRange | null {
  try {
    const saved = JSON.parse(savedRaw ?? "null") as Selection | null;
    if (saved && typeof saved.top === "string" && typeof saved.bottom === "string" && rangeEndGrade(scale, saved.top) && rangeEndGrade(scale, saved.bottom)) {
      return { scale, top: saved.top, bottom: saved.bottom };
    }
  } catch {
    // an unreadable saved range reads as none
  }
  return null;
}

export type EnglandShare = { pct: number; partial: boolean } | null;

/**
 * R-ENGLAND-GRADED-ONLY: England's share of graded entries inside the range, over graded,
 * non-suppressed rows only. A grade England doesn't publish (fewer than 5 schools, common
 * for BTEC, IB and T Level) is missing from both sides, so the share would be of a smaller
 * total than the school's: `partial` says so, and a caller shows no England figure then
 * (or marks it partial). `scaleGrades` are the grades the school's own spread draws.
 */
export function englandShare(englandRows: GradeCountRow[], period: number | null, range: GradeRange, scaleGrades: string[]): EnglandShare {
  if (period === null) return null;
  const rows = englandRows.filter((r) => r.period === period && !NON_GRADE_VALUES.has(r.grade));
  if (!rows.length) return null;
  const published = new Set(rows.map((r) => r.grade));
  const suppressed = englandRows.some((r) => r.period === period && r.grade === "Suppressed");
  const missing = scaleGrades.filter((g) => !NON_GRADE_VALUES.has(g) && !published.has(g));
  const out = bandRate(rows, range);
  return out ? { pct: out.rate, partial: suppressed || missing.length > 0 } : null;
}

/**
 * R-COUNTS-SELECTION: Column 1 Current's answer line, in the scale's own wording
 * (rangeLabel says "Grade" only on GCSE 9-1):
 *   "Grade 9: 3% of entries (7) · England 5%"
 *   "Grades 7–9: 23% of entries (53) · England 21%"
 *   "A*: 18% of entries (9)"
 * England's figure is left off when it isn't published, or is partial (a grade suppressed).
 */
export function answerLine(range: GradeRange, own: { met: number; entries: number } | null, england: EnglandShare): string | null {
  if (!own || own.entries <= 0) return null;
  const pct = Math.round((own.met / own.entries) * 100);
  const head = `${rangeLabel(range)}: ${pct}% of entries (${own.met.toLocaleString()})`;
  return england && !england.partial ? `${head} · England ${Math.round(england.pct)}%` : head;
}

/** The chip on Columns 2 and 3's titles: "Grade 9 · from your highlight". */
export function selectionChipLabel(range: GradeRange): string {
  return `${rangeLabel(range)} · from your highlight`;
}
