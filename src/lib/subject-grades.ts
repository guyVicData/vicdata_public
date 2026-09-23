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
export const NON_GRADE_VALUES = new Set(["Suppressed", "No result", "No result / X", "X", "Covid impacted", "Not Awarded", "Awarded"]);

export function gradeOrderFrom(...gradeSets: Iterable<string>[]): string[] {
  const present = new Set<string>();
  for (const set of gradeSets) for (const g of set) if (!NON_GRADE_VALUES.has(g)) present.add(g);
  const graded = Array.from(present).filter((g) => !(g in BOTTOM_RANK));

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

  const rank = (g: string) => {
    if (g in BOTTOM_RANK) return BOTTOM_RANK[g];
    const i = best.indexOf(g);
    return i === -1 ? 800 : i; // unrecognised grades still render, just after the known ones
  };
  return Array.from(present).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
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
