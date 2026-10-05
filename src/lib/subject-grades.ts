// Real DfE grade scales at subject grain, and what can honestly be computed from them.
//
// Moved here from SubjectDeepDiveDrawer when round 6's Teacher view needed the SAME
// knowledge for its threshold measure (Grade 4+ at KS4, A*-E at Post-16). Two copies of
// "which scale is this subject on" would be two things to get wrong the first time DfE
// adds a band -- exactly the failure the original comment below was written about -- so
// there is one copy and both callers read it.
import type { SubjectGradeCount } from "./academic-data-view";
import type { TeacherPhase } from "./teacher-view-phases";

// Grade bands used to be two hardcoded lists picked by stage alone, so everything that
// was not GCSE got forced into the A-level bands. Confirmed live 2026-09-18 against
// ingested grade rows: that is wrong for most qualification types, not just IB.
// 31 qualification types carry real subject-grain grade rows at KS5 alone, across at
// least eight genuinely different scales:
//
//   A-level / AS / Core Maths / Extended Project   A*  A  B  C  D  E   (+ Fail)
//   IBO Higher + Standard level component          7 6 5 4 3 2 1
//   IBO Diploma Programme Core                     A  B  C  D  E       (a different
//                                                                       A-E scale)
//   International Baccalaureate (the Diploma)      45 ... 24
//   BTEC / OCR Technicals / VRQ, single award      Distinction* ... Pass
//   ... double award                               Distinction*-Distinction* ...
//   ... triple award                               Distinction*-Distinction*-D* ...
//   Pre-U                                          D1 D2 D3 M1 M2 M3 P1 P2 P3
//
// and at KS4 only "GCSE (9-1) Full Course" matches the old GCSE list -- Double Award
// publishes two-digit pairs (99, 98, 87 ... 11) and the vocational labels use two
// different encodings between their own label variants ("Level 2 distinction" vs
// "D2"). Hardcoding every one of those, times their label variants, would be wrong
// again the first time DfE adds a band.
//
// So the order is derived from the grades actually present in this subject's real
// SubjectGradeCount rows, and only the ORDERING is knowledge we supply: a rank table
// covering the scales above, highest attainment first. A grade outside the table still
// renders, sorted after the ones we recognise, rather than vanishing.
// Ordered best-to-worst, one array per real scale. Deliberately NOT flattened into a
// single global rank table: the same grade string means opposite things in different
// scales. "D1" is the TOP Pre-U grade but the LOWER of the two vocational distinctions
// (where the digit is the level, so D2 beats D1), and a flat table ranked Pre-U as
// "D3 D1 M2 P3". So the scale is chosen per subject, by which one best covers the
// grades actually present, and only then used to order them.
export const GRADE_SCALES: string[][] = [
  // KS4 GCSE 9-1, then the Double Award pairs, highest first.
  ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
  ["99", "98", "88", "87", "77", "76", "66", "65", "55", "54", "44", "43", "33", "32", "22", "21", "11"],
  // A-level family. "*" appears as a real raw value alongside "A*" in the source.
  ["A*", "*", "A", "B", "C", "D", "E"],
  // IB subject components (Higher and Standard level).
  ["7", "6", "5", "4", "3", "2", "1"],
  // IB Diploma points total.
  ["45", "44", "43", "42", "41", "40", "39", "38", "37", "36", "35", "34", "33", "32", "31", "30", "29", "28", "27", "26", "25", "24"],
  // Vocational single / double / triple award, highest first.
  ["Distinction*", "Distinction", "High merit", "Merit", "High pass", "Pass"],
  ["Distinction*-Distinction*", "Distinction*-Distinction", "Distinction-Distinction", "Distinction-Merit", "Merit-Merit", "Merit-Pass", "Pass-Pass"],
  [
    "Distinction*-Distinction*-Distinction*", "Distinction*-Distinction*-Distinction", "Distinction*-Distinction-Distinction",
    "Distinction-Distinction-Distinction", "Distinction-Distinction-Merit", "Distinction-Merit-Merit",
    "Merit-Merit-Merit", "Merit-Merit-Pass", "Merit-Pass-Pass", "Pass-Pass-Pass",
  ],
  // KS4 vocational, both real encodings.
  ["L2*", "L2D", "L2M", "L2P", "L1D", "L1M", "L1P"],
  ["*2", "*1", "D2", "D1", "M2", "M1", "P2", "P1"],
  ["Level 2 distinction star", "Level 2 distinction", "Level 2 merit", "Level 2 pass", "Level 1 distinction star", "Level 1 distinction", "Level 1 merit", "Level 1 pass"],
  // Pre-U.
  ["D1", "D2", "D3", "M1", "M2", "M3", "P1", "P2", "P3"],
  // T Level, its OWN scale rather than the vocational one above. The two share
  // Distinction*/Distinction/Merit/Pass, so a T Level distribution would part-match the
  // vocational scale and silently drop its two distinctive bands -- the same shape as
  // the bug that forced IB into A-level's A*-E and rendered an empty chart. "Partial
  // achievement" is a real T Level outcome (a student who passed some but not all
  // components), ranked below Pass and above Unclassified, and deliberately NOT treated
  // as a non-result: it is a real attainment band, just one with no derivable points.
  ["Distinction*", "Distinction", "Merit", "Pass", "Partial achievement", "Unclassified"],
];

// Present in almost every scale and always the bottom of it, so they are ranked below
// every graded band rather than being indexed alongside them -- otherwise a fail sorts
// to the TOP of the chart.
export const BOTTOM_RANK: Record<string, number> = { Fail: 900, U: 901, Unclassified: 902 };

// Not attainment bands: DfE suppression and non-results. Excluded from the chart's axis
// so a distribution is not padded with rows that cannot be compared between schools.
// R-NON-GRADES-EXCL: never counted on either side of a grade rate or distribution.
// 0.6.2 (R-HISTORIC-GRADE-LABELS): "COVID result" and "Supp" are the 2021/22-2022/23 KS5
// files' own non-grade labels; counted as grades they would leave about 9% of 2021/22 A-level
// sets with no A*-E figure (S1 §4).
export const NON_GRADE_VALUES = new Set(["Suppressed", "No result", "No result / X", "X", "Covid impacted", "Not Awarded", "Awarded", "COVID result", "Supp"]);

// The GRADE_SCALES entry that best covers these grades (the same array object, so a caller
// can test scale identity), or [] when none covers any of them. Shared by gradeOrderFrom
// and the grade-bands range below, so "which scale is this subject on" has one answer.
export function bestScale(grades: Iterable<string>): string[] {
  const graded = Array.from(new Set(grades)).filter((g) => !NON_GRADE_VALUES.has(g) && !(g in BOTTOM_RANK));
  // Pick the scale covering the most of what is actually here. Ties go to the shorter
  // scale, which is the more specific match for the same coverage.
  let best: string[] = [];
  let bestHits = 0;
  for (const scale of GRADE_SCALES) {
    const hits = graded.filter((g) => scale.includes(g)).length;
    if (hits > bestHits || (hits === bestHits && hits > 0 && scale.length < best.length)) {
      best = scale;
      bestHits = hits;
    }
  }
  return best;
}

// A grade's position on a scale, best first: its index, BOTTOM_RANK's 900s for Fail/U/
// Unclassified, and 800 for a grade the scale does not know (it still sorts, after them).
function rankOn(scale: string[], g: string): number {
  if (g in BOTTOM_RANK) return BOTTOM_RANK[g];
  const i = scale.indexOf(g);
  return i === -1 ? 800 : i;
}

export function gradeOrderFrom(...gradeSets: Iterable<string>[]): string[] {
  const present = new Set<string>();
  for (const set of gradeSets) for (const g of set) if (!NON_GRADE_VALUES.has(g)) present.add(g);
  const best = bestScale(present);
  return Array.from(present).sort((a, b) => rankOn(best, a) - rankOn(best, b) || a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// The threshold measure (round-6 brief §4.1, §6.5)
// ---------------------------------------------------------------------------
//
// "What share of entries reached the bar?" -- which bar depends on the scale, because the
// scales are genuinely different questions:
//   - KS4's GCSE 9-1: grade 4 or above, the universally-cited "standard pass".
//   - KS4 Double Award, published as two-digit pairs ("54", "43"): counted only when BOTH
//     digits are 4 or above (§6.5's resolved "strict" reading), matching how DfE reports
//     a double award against a threshold rather than treating half a pass as a pass.
//   - KS5's A-level family, A*-E: graded at all, since E is the lowest pass and U is not.
//
// Every other real scale returns null rather than a number. A BTEC's Distinction/Merit/
// Pass has no grade 4 and no E; DfE does publish equivalences elsewhere, but applying one
// here would be this module inventing a mapping rather than reading a published figure --
// so the measure says "no figure" for those subjects, which is true, instead of a number
// nobody published. Flagged in the round-6 build report as the judgement it is.
const GCSE_NUMERIC = new Set(["9", "8", "7", "6", "5", "4", "3", "2", "1"]);
const ALEVEL_GRADES = new Set(["A*", "*", "A", "B", "C", "D", "E"]);
const ALEVEL_SCALE = new Set([...ALEVEL_GRADES, "U", "Fail", "Unclassified"]);

// A Double Award pair is two single digits written together ("99" ... "11").
function doubleAwardDigits(grade: string): [number, number] | null {
  if (!/^[1-9][1-9]$/.test(grade)) return null;
  return [Number(grade[0]), Number(grade[1])];
}

export type ThresholdOutcome = { rate: number; entries: number } | null;

// The share of this subject's real graded entries that met the phase's threshold.
// `rows` must already be scoped to one subject, one qualification grain and one period.
//
// Non-grades (suppression, "No result", "Covid impacted") are excluded from BOTH sides:
// they are not attainment, so counting them in the denominator would depress a real rate
// by however much of the cohort DfE chose not to publish.
// R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL
export function thresholdRate(rows: SubjectGradeCount[], phase: TeacherPhase): ThresholdOutcome {
  const graded = rows.filter((r) => !NON_GRADE_VALUES.has(r.grade));
  const total = graded.reduce((a, r) => a + r.entries, 0);
  if (total === 0) return null;

  const scale = graded.map((r) => r.grade);
  const onGcse = scale.some((g) => GCSE_NUMERIC.has(g) || doubleAwardDigits(g) !== null);
  const onALevel = scale.some((g) => ALEVEL_GRADES.has(g));

  // KS5's IB component scale is also 7-1, which would read as GCSE numerics; the phase
  // decides which question is being asked, so an IB row at Post-16 is not scored against
  // a GCSE bar it was never on.
  const useGcseBar = phase !== "ks5" && onGcse;
  const useALevelBar = phase === "ks5" && onALevel && scale.every((g) => ALEVEL_SCALE.has(g));
  if (!useGcseBar && !useALevelBar) return null;

  const meets = (grade: string): boolean => {
    if (useALevelBar) return ALEVEL_GRADES.has(grade);
    const pair = doubleAwardDigits(grade);
    if (pair) return pair[0] >= 4 && pair[1] >= 4;
    return GCSE_NUMERIC.has(grade) && Number(grade) >= 4;
  };

  const met = graded.filter((r) => meets(r.grade)).reduce((a, r) => a + r.entries, 0);
  return { rate: (met / total) * 100, entries: total };
}

// ---------------------------------------------------------------------------
// Grade bands (docs/vicdata_phase3_grade_bands_frontend_claude_code_prompt_v1.md)
// ---------------------------------------------------------------------------
//
// The threshold measure above, generalised from its one fixed bar to any contiguous span a
// teacher picks on the subject's OWN scale -- "grades 7-9", "Distinction* to Merit".
// `top` is the better end, `bottom` the worse; both are inclusive. `scale` is the
// GRADE_SCALES entry the span was picked on (by identity), so a subject on a different
// scale -- a Double Award beside GCSE, IB beside A level -- is never scored against a span
// it was never on: it gets no figure, as thresholdRate gives a vocational scale none.
export type GradeRange = { scale: string[]; top: string; bottom: string };

// Presets only where there is a real, established convention: GCSE 9-1's "grade 4 or
// above" (the standard pass this module's threshold measure already uses) and 7-9, the
// strong-pass band. No other scale gets presets -- nothing in this codebase or DfE's
// headline measures establishes one for A level, IB, vocational, Pre-U or T Level, and
// inventing "Merit or above" would be exactly the kind of made-up convention the
// threshold measure declines. Those scales are custom-range only.
export const GCSE_SCALE = GRADE_SCALES[0];
export const BAND_PRESETS: { id: string; label: string; scale: string[]; top: string; bottom: string }[] = [
  { id: "4-9", label: "4–9", scale: GCSE_SCALE, top: "9", bottom: "4" },
  { id: "7-9", label: "7–9", scale: GCSE_SCALE, top: "9", bottom: "7" },
];
export const presetsFor = (scale: string[]) => BAND_PRESETS.filter((p) => p.scale === scale);

// "Grades 7–9" on GCSE's numbers, "Distinction* to Merit" on a named scale, one grade alone.
export function rangeLabel(range: GradeRange): string {
  if (range.top === range.bottom) return range.scale === GCSE_SCALE ? `Grade ${range.top}` : range.top;
  return range.scale === GCSE_SCALE ? `Grades ${range.bottom}–${range.top}` : `${range.top} to ${range.bottom}`;
}

// 0.6.1 S6: a range label inside a sentence ("of 40 graded entries at grades 7–9", "England,
// A*–B"). Lower-casing the label whole printed a named scale's grades in lower case ("a* to
// b"); the scale's own grades keep their case, joined as the qualification names do
// ("A*–E"). A grade that has its own hyphen (Double Award's "9-9") keeps "to".
export function inlineRangeLabel(label: string): string {
  if (/^Grades? /.test(label)) return label.toLowerCase();
  const [top, bottom, ...rest] = label.split(" to ");
  if (bottom === undefined || rest.length || /[-–]/.test(top + bottom)) return label;
  return `${top}–${bottom}`;
}

// The two-click range: the first click is a one-grade span; the second makes the span
// between the two clicks, in scale order whichever was clicked first.
export function spanBetween(scale: string[], a: string, b: string): { top: string; bottom: string } {
  return rankOn(scale, a) <= rankOn(scale, b) ? { top: a, bottom: b } : { top: b, bottom: a };
}

export function inRange(range: GradeRange, grade: string): boolean {
  const r = rankOn(range.scale, grade);
  return r >= rankOn(range.scale, range.top) && r <= rankOn(range.scale, range.bottom);
}

export type BandOutcome = { rate: number; met: number; entries: number } | null;

// The share of this subject's graded entries inside the range -- ONE function for the
// school's own rows, a comparator school's, and the LA/region/England per-grade rows
// (academic_subject_grade_geography_lookup), so the rate is computed the same way on every
// side. `rows` must be one subject, one exact qualification and one period. Non-grades are
// excluded from both sides, as in thresholdRate. null when there are no graded entries, or
// when these rows are on a different scale from the one the range was picked on.
export function bandRate(rows: { grade: string; entries: number }[], range: GradeRange): BandOutcome {
  const graded = rows.filter((r) => !NON_GRADE_VALUES.has(r.grade));
  const total = graded.reduce((a, r) => a + r.entries, 0);
  if (total === 0) return null;
  // The range's own ends count toward choosing the scale, so a small cohort with only
  // grades 7-4 still reads as GCSE (not IB's 7-1) when the span was picked on GCSE.
  if (bestScale([...graded.map((r) => r.grade), range.top, range.bottom]) !== range.scale) return null;
  const met = graded.filter((r) => inRange(range, r.grade)).reduce((a, r) => a + r.entries, 0);
  return { rate: (met / total) * 100, met, entries: total };
}
