// Teacher view: what a subject's figure is allowed to be, per measure (VicData 0.6 S2).
//
// The per-subject figures every Teacher view column plots -- entries, average point score,
// the Grade 4+ / A*-E rate and the grade-band share -- and the rules that decide them,
// lifted VERBATIM out of src/app/teacher/[phase]/page.tsx so a view moved out of its panel
// cannot reach a number without going through them (catalogue design doc §1). Pure and
// client-safe: no fetching, no React. Every enforcement point carries its rule ID
// (`grep -rn R-<ID> src` finds them all).
//
// S3b (Guy's decisions after night 1) fixed the Post-16 Context points blend: points are
// now compared within the focused item's qualification family only (contextKeepsToFamily,
// contextGroupValue). % change on points and rates is still offered elsewhere.
import type { AcademicSubjectHeadlineEntry, SubjectGradeCount } from "./academic-data-view";
import { POINTS_BEARING_QUALIFICATION, displayBucketFor } from "./dfe-qualification-buckets";
import { ENTRIES_MEASURE, headlineMeasure, measuresFor, type Measure, type MeasureId } from "./teacher-view-panels";
import { BOTTOM_RANK, bandRate, presetsFor, thresholdRate, type GradeRange } from "./subject-grades";
import type { TeacherPhase } from "./teacher-view-phases";

// The (subject, qualification) a figure belongs to -- the page's SubjectItem, structurally.
export type MeasureItem = { subject: string; qualificationType: string };

// ------------------------------------------------------------------ own rows

/**
 * R-POINTS-SAME-QUAL: an item's own headline rows, every period. At Post-16 the rows for
 * its EXACT qualification -- never the bucket's, which blends AS into A level, IB Standard
 * into Higher level and every BTEC size together. At GCSE, the subject's rows (one row per
 * subject there, entries already summed across its qualifications).
 */
export function ownHeadlineRows(
  phase: TeacherPhase | null,
  item: MeasureItem,
  headline: AcademicSubjectHeadlineEntry[],
  qualificationHeadline: AcademicSubjectHeadlineEntry[],
): AcademicSubjectHeadlineEntry[] {
  return phase === "ks5"
    ? qualificationHeadline.filter((h) => h.subject === item.subject && h.qualificationType === item.qualificationType)
    : headline.filter((h) => h.subject === item.subject);
}

// ------------------------------------------------------------------ points / entries

/**
 * R-KS4-POINTS-GCSE-FULL, R-ENTRIES-NOT-POINTS: at GCSE only "GCSE (9-1) Full Course"
 * carries points. Headline rows there are keyed by subject alone, so without this gate an
 * OCR or BTEC row for the same subject shows the GCSE score as its own. Suppress rather
 * than borrow.
 */
export function carriesOwnPoints(phase: TeacherPhase | null, item: MeasureItem): boolean {
  return !(phase === "ks4" && item.qualificationType !== POINTS_BEARING_QUALIFICATION.ks4);
}

/**
 * R-KS4-POINTS-GCSE-FULL, R-ENTRIES-NOT-POINTS: a subject's latest real score, with its
 * year so a benchmark can be read for the SAME year (R-SAME-YEAR-BENCH). `ownRows` is
 * ownHeadlineRows(item).
 */
export function latestOwnPoints(
  phase: TeacherPhase | null,
  item: MeasureItem,
  ownRows: AcademicSubjectHeadlineEntry[],
): { value: number; period: number } | null {
  if (!carriesOwnPoints(phase, item)) return null;
  const rows = ownRows
    .filter((h) => h.avgPointScore !== null)
    .sort((a, b) => a.period - b.period);
  const last = rows[rows.length - 1];
  return last ? { value: last.avgPointScore as number, period: last.period } : null;
}

/**
 * R-KS4-POINTS-GCSE-FULL, R-ENTRIES-NOT-POINTS: a subject's average point score in one
 * period, from its own rows for that period (the mean of their scores). Null for an item
 * that carries no points of its own.
 */
export function subjectPointsAt(phase: TeacherPhase, item: MeasureItem, rowsAtPeriod: AcademicSubjectHeadlineEntry[]): number | null {
  if (!carriesOwnPoints(phase, item)) return null;
  const vals = rowsAtPeriod.map((h) => h.avgPointScore).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * R-ENTRIES-NOT-POINTS: entries count every qualification -- the sum of the item's own
 * rows' entries for the period, whether or not they carry points.
 */
export function subjectEntriesAt(rowsAtPeriod: AcademicSubjectHeadlineEntry[]): number | null {
  return rowsAtPeriod.length ? rowsAtPeriod.reduce((a, h) => a + (h.entriesTotal ?? 0), 0) : null;
}

// ------------------------------------------------------------------ England anchor

export type EnglandAverages = {
  basis: "qualification" | "subject";
  values: { key: string; period: number; value: number }[];
};

/** The England figures keyed for lookup, "{key}@{period}" (see englandValueAt). */
export function englandIndexOf(englandAvg: EnglandAverages | null): Map<string, number> {
  return new Map((englandAvg?.values ?? []).map((v) => [`${v.key}@${v.period}`, v.value]));
}

/**
 * R-KS5-ENGLAND-EXACT, R-SAME-YEAR-BENCH: one item's England figure for one year. GCSE: the
 * subject. Post-16: the same subject in the same exact qualification, or nothing -- no
 * bucket fallback. Read for the same period as the score it sits beside, or not at all.
 */
export function englandValueAt(
  englandAvg: EnglandAverages | null,
  englandIndex: Map<string, number>,
  phase: TeacherPhase | null,
  item: MeasureItem,
  period: number,
): number | null {
  if (!englandAvg || !phase || phase === "ks2") return null;
  // GCSE rows are keyed by subject, spelt as the headline rows spell it.
  const key = englandAvg.basis === "subject" ? item.subject : `${item.subject}::${item.qualificationType}`;
  return englandIndex.get(`${key}@${period}`) ?? null;
}

/**
 * R-NO-GRADE-RATE-GEO: no LA/region/England figure is published for a Grade 4+ / A*-E rate
 * or a grade band at page level, so a Results series on those measures carries no England
 * benchmark (Grade bands' focused subject gets England's rate on the span from grade
 * geography instead, R-BANDS-ENGLAND-BENCH).
 */
export function hasEnglandPointsBenchmark(measureId: MeasureId): boolean {
  return !(measureId === "threshold" || measureId === "bands");
}

// ------------------------------------------------------------------ grade-based rates

/** One (subject, qualification)'s grade rows for one period. */
export function gradeRowsAt(gradeRows: SubjectGradeCount[], subject: string, qualificationType: string, period: number): SubjectGradeCount[] {
  return gradeRows.filter((g) => g.subject === subject && g.qualificationType === qualificationType && g.period === period);
}

/**
 * R-GRADE-SCALE-MATCH, R-COMPARATOR-RATE-PER-QUAL: the threshold rate, scored on this
 * subject AND this qualification type -- a GCSE and a Cambridge National in one subject are
 * scored separately rather than pooled into a rate belonging to neither.
 */
export function subjectThresholdAt(gradeRows: SubjectGradeCount[], item: MeasureItem, period: number, phase: TeacherPhase): number | null {
  return thresholdRate(gradeRowsAt(gradeRows, item.subject, item.qualificationType, period), phase)?.rate ?? null;
}

/**
 * R-GRADE-SCALE-MATCH: the share of the item's graded entries inside the range (bandRate
 * gives no figure for a qualification on another scale). No range = no figure.
 */
export function subjectBandAt(gradeRows: SubjectGradeCount[], item: MeasureItem, period: number, range: GradeRange | null): number | null {
  return range ? bandRate(gradeRowsAt(gradeRows, item.subject, item.qualificationType, period), range)?.rate ?? null : null;
}

/** Whether the item has any grade rows in the period (R-THRESHOLD-PERIODS reads it). */
export function hasGradesAt(gradeRows: SubjectGradeCount[], item: MeasureItem, period: number): boolean {
  return gradeRows.some((g) => g.subject === item.subject && g.qualificationType === item.qualificationType && g.period === period);
}

/**
 * R-GRADE-SCALE-MATCH, R-COMPARATOR-RATE-PER-QUAL: the rate a comparator school is scored
 * on, from its own grade rows for the subject and qualification -- the same function the
 * school's own figure uses (the band share once a range is picked, else the threshold).
 */
export function gradeRateScorer(onBands: boolean, range: GradeRange | null, phase: TeacherPhase): (rows: SubjectGradeCount[]) => number | null {
  return (rows) => (onBands && range ? bandRate(rows, range)?.rate ?? null : thresholdRate(rows, phase)?.rate ?? null);
}

/**
 * R-GRADE-SCALE-MATCH: whether a grade belongs to the focused subject's own scale (or is
 * one of the bottom grades every scale shares).
 */
export function onGradeScale(scale: string[], grade: string): boolean {
  return scale.includes(grade) || grade in BOTTOM_RANK;
}

/**
 * R-GRADE-SCALE-MATCH: the Grade bands range, always on the focused subject's own scale.
 * A pending first click on that scale; else the saved range while both ends are on it;
 * else the scale's 7-9 preset (GCSE 9-1 only); else none -- never an invented default band.
 */
export function bandRangeFor(scale: string[], pending: string | null, savedRaw: string | undefined): GradeRange | null {
  if (pending && onGradeScale(scale, pending)) return { scale, top: pending, bottom: pending };
  try {
    const saved = JSON.parse(savedRaw ?? "null") as { top: string; bottom: string } | null;
    if (saved && onGradeScale(scale, saved.top) && onGradeScale(scale, saved.bottom)) return { scale, top: saved.top, bottom: saved.bottom };
  } catch {
    // an unreadable saved range reads as none
  }
  const preset = presetsFor(scale).find((p) => p.id === "7-9");
  return preset ? { scale, top: preset.top, bottom: preset.bottom } : null;
}

// ------------------------------------------------------------------ periods

/**
 * R-THRESHOLD-PERIODS: the periods a measure genuinely covers. Grade rows go back to
 * 2023/24 only, so a threshold or band measure shortens the axis to the years some item
 * has them rather than padding it; every other measure keeps `periods`.
 */
export function periodsForMeasure<T>(
  measureId: MeasureId,
  periods: number[],
  items: T[],
  thresholdAt: (item: T, period: number) => number | null,
  hasGrades: (item: T, period: number) => boolean,
): number[] {
  return measureId === "threshold"
    ? periods.filter((p) => items.some((i) => thresholdAt(i, p) !== null))
    : measureId === "bands"
      ? periods.filter((p) => items.some((i) => hasGrades(i, p)))
      : periods;
}

// ------------------------------------------------------------------ measure resolution

/**
 * R-MEASURE-FALLBACK: Grade counts has no single figure to compare subjects on, and Grade
 * bands has none until a range is picked, so Context falls back to average point score.
 */
export function contextFallsBackFor(showingResults: boolean, resultsMeasureId: MeasureId, hasBandRange: boolean): boolean {
  return showingResults && (resultsMeasureId === "counts" || (resultsMeasureId === "bands" && !hasBandRange));
}

/** R-MEASURE-FALLBACK: Context's measure -- entries on Candidates, else Results' (or points). */
export function contextMeasureFor(phase: TeacherPhase, showingResults: boolean, fallsBack: boolean, resultsMeasureShown: Measure): Measure {
  return !showingResults ? ENTRIES_MEASURE : fallsBack ? measuresFor(phase)[0] : resultsMeasureShown;
}

/**
 * R-MEASURE-FALLBACK: Comparisons' measure. Candidates -> entries. Results with a subject
 * in focus -> that subject on the threshold rate or a picked band, otherwise its average
 * point score (Grade counts, or bands with no range). No subject -> the phase headline.
 */
export function comparisonsMeasureFor(
  phase: TeacherPhase,
  showingResults: boolean,
  hasSubject: boolean,
  usingThreshold: boolean,
  onBands: boolean,
  resultsMeasureShown: Measure,
  headlineLabel: string,
): Measure {
  return showingResults
    ? hasSubject
      ? usingThreshold || onBands
        ? resultsMeasureShown
        : measuresFor(phase)[0]
      : headlineMeasure(phase, headlineLabel)
    : ENTRIES_MEASURE;
}

/**
 * R-DONUT-COUNTS-ONLY: a share is only meaningful for counts -- entries, or the entries
 * inside a picked grade range. Never for an average or a rate.
 */
export function shareApplies(measureId: MeasureId, hasBandRange: boolean): boolean {
  return measureId === "entries" || (measureId === "bands" && hasBandRange);
}

// ------------------------------------------------------------------ Context's group

/**
 * R-POINTS-SAME-QUAL: whether Context keeps to the focused item's qualification family.
 * At Post-16 average point score sits on a different challenge table per qualification
 * (A level, BTEC, IB...), so on points every Context group -- All subjects included --
 * compares only the focus's family: its subject list (contextItemsOf) and each member's
 * group value (contextGroupValue). Entries are counts and add up across families; rates
 * are already scored only on their own grade scale (R-GRADE-SCALE-MATCH). GCSE points
 * come from GCSE (9-1) Full Course alone, so there is nothing to blend there.
 */
export function contextKeepsToFamily(phase: TeacherPhase, measureId: MeasureId): boolean {
  return phase === "ks5" && measureId === "points";
}

/**
 * R-POINTS-SAME-QUAL: whether a Post-16 row's points are on the focused item's family's
 * scale. The family is the display bucket (qualificationFamilyOf at ks5, the same family
 * Column 1's category and Context's Selected subjects use). A row with no qualification
 * cannot be placed on a scale, so it never counts: a blend is suppressed, not shown.
 */
export function onFocusPointsScale(focusFamily: string | null | undefined, qualificationType: string | null | undefined): boolean {
  return !!focusFamily && !!qualificationType && displayBucketFor(qualificationType) === focusFamily;
}

export type ContextGroupInputs = {
  phase: TeacherPhase;
  measureId: MeasureId;
  // contextGroupRows() (teacher-view-populations.ts): AS/AEA rows already left out at
  // Post-16, except the focused item's own.
  groupRows: AcademicSubjectHeadlineEntry[];
  gradeRows: SubjectGradeCount[];
  bandRange: GradeRange | null;
  // inContextGroup() (teacher-view-populations.ts), for the grade rows.
  inGroup: (qualificationType: string, subject: string) => boolean;
  // R-POINTS-SAME-QUAL: the focused item's qualification family (focusQualificationFamily),
  // which a Post-16 points group value keeps to. Null = no focus: no points group value.
  focusFamily?: string | null;
};

/**
 * One group member's value for one period, on the active measure. Members are subjects of
 * the whole school, addressed by NAME.
 *
 * R-POINTS-WEIGHTED: at Post-16 a subject's points across its qualifications are weighted
 * by points-eligible entries, not flat-averaged.
 * R-POINTS-SAME-QUAL (S3b fix): that weighted mean takes only the subject's rows in the
 * focused item's qualification family, never A level, BTEC and IB together. A subject with
 * no row in the family has no group value (it is not drawn as a blend).
 * R-KS5-ASAEA-EXCL: AS and AEA rows are out of `groupRows` and, through `inGroup`, out of
 * the grade rows. R-GRADE-SCALE-MATCH: rates are per qualification, then meaned.
 */
export function contextGroupValue(g: ContextGroupInputs, subject: string, period: number): number | null {
  const { phase, measureId, groupRows, gradeRows, bandRange, inGroup } = g;
  const rows = groupRows.filter((h) => h.subject === subject && h.period === period);
  if (rows.length === 0) return null;
  if (measureId === "entries") {
    return rows.reduce((a, h) => a + (h.entriesTotal ?? 0), 0);
  }
  if (measureId === "points") {
    // Post-16: one figure per subject from its qualifications' figures, each weighted by
    // its points-eligible entries -- the nearest this data gets to the whole-subject row
    // it replaces (DfE weights by size), and without letting one IB entry count as much
    // as forty A-level ones. GCSE has one row per subject, so it is read as it was.
    if (phase === "ks5") {
      let points = 0;
      let weight = 0;
      for (const h of rows) {
        if (!onFocusPointsScale(g.focusFamily, h.qualificationType)) continue;
        if (h.avgPointScore === null || !h.pointsCoveragePercent) continue;
        const eligible = (h.entriesTotal ?? 0) * (h.pointsCoveragePercent / 100);
        points += h.avgPointScore * eligible;
        weight += eligible;
      }
      return weight > 0 ? points / weight : null;
    }
    const vals = rows.map((h) => h.avgPointScore).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  // Threshold: rate per qualification type, then the mean of the ones that have a bar.
  // Pooling every grade row for a subject would mix scales -- a GCSE 9-1 row beside a
  // vocational Pass -- and score them against a bar only one of them is on. AS and AEA
  // are left out at Post-16, as in the other two measures.
  const quals = Array.from(
    new Set(
      gradeRows
        .filter((r) => r.subject === subject && r.period === period && inGroup(r.qualificationType, subject))
        .map((r) => r.qualificationType),
    ),
  );
  // Grade bands: the same per-qualification mean on the chosen range (bandRate, which
  // gives no figure for a qualification on a different scale).
  const rateOf = (rs: SubjectGradeCount[]) =>
    measureId === "bands" && bandRange ? bandRate(rs, bandRange)?.rate : thresholdRate(rs, phase)?.rate;
  const rates = quals
    .map((qt) => rateOf(gradeRows.filter((r) => r.subject === subject && r.qualificationType === qt && r.period === period)))
    .filter((v): v is number => v !== undefined && v !== null);
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
}

/**
 * R-SELF-INCLUSIVE-GROUP, R-KS5-ASAEA-EXCL, R-GRADE-SCALE-MATCH: Context's donut on Grade
 * bands -- the group's own entries inside the range, of all its graded entries, per
 * (subject, qualification) through bandRate, so a qualification on another scale adds to
 * neither side. `members` is contextMembers() (self-inclusive).
 */
export function contextBandShareAt(
  members: string[],
  gradeRows: SubjectGradeCount[],
  period: number,
  range: GradeRange | null,
  inGroup: (qualificationType: string, subject: string) => boolean,
): { met: number; entries: number } | null {
  if (!range) return null;
  let met = 0;
  let entries = 0;
  for (const subject of members) {
    const quals = new Set(gradeRows.filter((g) => g.subject === subject && g.period === period && inGroup(g.qualificationType, subject)).map((g) => g.qualificationType));
    for (const qt of quals) {
      const r = bandRate(gradeRowsAt(gradeRows, subject, qt, period), range);
      if (r) {
        met += r.met;
        entries += r.entries;
      }
    }
  }
  return entries > 0 ? { met, entries } : null;
}
