// VicData 0.6.1 S3d: one subject's grade spread -- the derivations Grade counts' panels
// (GradeCountsPanels) and Results' Grade distribution view (was "Grades (pick a range)") (SubjectPanels) drew inline,
// moved here unchanged so the hosts and the config-driven renderer (src/lib/view-series/
// grades.ts) read the same numbers from one place.
//
//   gradeCounts        Grade counts: the latest year's distribution against England's share
//                      at each grade, an earlier year's spread, each grade's change
//   bandDistribution   Results on Grade bands: the distribution in the year Current shows
//   averageGrade       2 · View's average grade marker (a look: an average of what is drawn)
//
// Grade-level figures are published from 2021/22 (0.6.2; 2023/24 only before, D8), so the
// spread compares the latest year with any earlier one. Pure (no React).
import { BOTTOM_RANK, GRADE_SCALES, NON_GRADE_VALUES, bestScale, gradeOrderFrom } from "./subject-grades";
import { academicYearLabel } from "./teacher-view-theme";
import type { PanelData } from "./teacher-view-panels";
import { MODERN_GRADE_FROM } from "./grade-rows";
import { TREND_BASE_PERIOD } from "@/catalogue/notes";

// One subject's own per-grade rows (or an area's), every year it has them.
export type GradeCountRow = { period: number; grade: string; entries: number };

// One row of the drawn distribution (GradeDistribution's).
export type GradeRow = {
  grade: string;
  ownCount: number;
  // The benchmark area's share at this grade, 0-100; null = not published for this grade.
  benchPct: number | null;
  // A second school distribution drawn under the first (an earlier year), as a share of ITS
  // OWN total. Absent = one distribution.
  compareCount?: number;
};

const inYear = (rows: GradeCountRow[], p: number | null) => (p === null ? [] : rows.filter((r) => r.period === p && !NON_GRADE_VALUES.has(r.grade)));
const countAt = (rows: GradeCountRow[], g: string) => rows.filter((r) => r.grade === g).reduce((a, r) => a + r.entries, 0);
const totalOf = (rows: GradeCountRow[]) => rows.reduce((a, r) => a + r.entries, 0);

// Grade counts (GradeCountsPanels): `compareFrom` / `changeFrom` are the members' own picks
// (the Trends "From" menus); null or a year not on offer = the default (the year before the
// latest for the spread, the first year for the change).
// 0.6.2 S4b: the latest year is the latest from 2023/24 on (R-CURRENT-GRADES-FROM-2324: a
// subject whose grades stop before then shows none, as before), and the change table measures
// from 2022/23 at the earliest (R-TREND-FROM-2223: `changeEarlier`, the years its menu offers).
// The spread still compares with any earlier year, 2021/22 included.
export function gradeCounts(ownRows: GradeCountRow[], englandRows: GradeCountRow[], picks: { compareFrom: number | null; changeFrom: number | null }) {
  const graded = ownRows.filter((r) => !NON_GRADE_VALUES.has(r.grade));
  const periods = Array.from(new Set(graded.map((r) => r.period))).sort((a, b) => a - b);
  const modern = periods.filter((p) => p >= MODERN_GRADE_FROM);
  const latest = modern.length ? modern[modern.length - 1] : null;
  const earlier = latest === null ? [] : periods.filter((p) => p < latest);
  const changeEarlier = earlier.filter((p) => p >= TREND_BASE_PERIOD);
  const cmpYear = picks.compareFrom !== null && earlier.includes(picks.compareFrom) ? picks.compareFrom : earlier[earlier.length - 1] ?? null;
  const chgYear = picks.changeFrom !== null && changeEarlier.includes(picks.changeFrom) ? picks.changeFrom : changeEarlier[0] ?? null;
  const own = inYear(graded, latest);
  const ownTotal = totalOf(own);
  const eng = inYear(englandRows, latest);
  const engTotal = totalOf(eng);
  const cmp = inYear(graded, cmpYear);
  const cmpTotal = totalOf(cmp);
  const order = gradeOrderFrom(own.map((r) => r.grade), eng.map((r) => r.grade), cmp.map((r) => r.grade));
  const rowsFor = (withCompare: boolean): GradeRow[] =>
    order.map((g) => ({
      grade: g,
      ownCount: countAt(own, g),
      // A grade England does not publish (suppressed below 5 schools) has no share at all.
      // The year-on-year view carries no England ticks: it compares the school with itself.
      benchPct: !withCompare && eng.some((r) => r.grade === g) && engTotal > 0 ? (countAt(eng, g) / engTotal) * 100 : null,
      ...(withCompare ? { compareCount: countAt(cmp, g) } : {}),
    }));
  const englandLabel = eng.length && latest !== null ? `England, ${academicYearLabel(latest)}` : null;
  const modal = own.length ? order.reduce((best, g) => (countAt(own, g) > countAt(own, best) ? g : best), order[0]) : null;
  // Each grade's own count, from the chosen year to the latest, in grade order.
  const changeData: PanelData = {
    periods: chgYear === null || latest === null ? [] : [chgYear, latest],
    series: order.map((g) => ({
      key: g,
      label: g,
      colour: "",
      values: chgYear === null || latest === null ? [] : [countAt(inYear(graded, chgYear), g), countAt(own, g)],
    })),
  };
  return {
    graded,
    periods,
    latest,
    earlier,
    changeEarlier,
    cmpYear,
    chgYear,
    own,
    ownTotal,
    cmpTotal,
    order,
    rowsFor,
    englandLabel,
    modal,
    modalCount: modal === null ? 0 : countAt(own, modal),
    // The change table's rows, in the subject's colour.
    changeDataIn: (colour: string): PanelData => ({ periods: changeData.periods, series: changeData.series.map((s) => ({ ...s, colour })) }),
  };
}

// Results on Grade bands (SubjectPanels): the focused subject's distribution in the year
// Current shows, with England's share at each grade (no tick where England's row was
// suppressed) -- the same rows bandRate reads. `benchLabel` reads "England, <year>" once
// England's rows have arrived (any year), as the host's.
export function bandDistribution(ownRows: GradeCountRow[], englandRows: GradeCountRow[], latest: number | null) {
  const ownLatest = latest !== null ? ownRows.filter((r) => r.period === latest && !NON_GRADE_VALUES.has(r.grade)) : [];
  const engLatest = latest !== null ? englandRows.filter((r) => r.period === latest && !NON_GRADE_VALUES.has(r.grade)) : [];
  const total = totalOf(ownLatest);
  const engTotal = totalOf(engLatest);
  const rows: GradeRow[] = gradeOrderFrom(ownLatest.map((r) => r.grade), engLatest.map((r) => r.grade)).map((g) => {
    const eng = engLatest.filter((r) => r.grade === g);
    return {
      grade: g,
      ownCount: ownLatest.filter((r) => r.grade === g).reduce((a, r) => a + r.entries, 0),
      benchPct: eng.length && engTotal > 0 ? (eng.reduce((a, r) => a + r.entries, 0) / engTotal) * 100 : null,
    };
  });
  const benchLabel = englandRows.length ? `England, ${latest === null ? "" : academicYearLabel(latest)}` : null;
  return { rows, total, benchLabel };
}

// ------------------------------------------------------------- the set's share (0.6.2 S3)

// R-COMPARATOR-GRADE-SHARE: "Add an average" across schools on a grade spread -- each grade's
// share of a school's graded entries in `period`, averaged (mean or median) over the schools
// with graded entries that year, at each of `grades` (the spread's own rows). A share, never
// a raw count: the schools differ in size. null = no school has graded entries that year.
export function setShares(schools: { rows: GradeCountRow[] }[], period: number | null, grades: string[], how: "mean" | "median"): { pct: Map<string, number>; schools: number } | null {
  if (period === null) return null;
  const shares: Map<string, number>[] = [];
  for (const s of schools) {
    const rows = inYear(s.rows, period);
    const total = totalOf(rows);
    if (total <= 0) continue;
    shares.push(new Map(grades.map((g) => [g, (countAt(rows, g) / total) * 100])));
  }
  if (!shares.length) return null;
  const pct = new Map<string, number>();
  for (const g of grades) {
    const vs = shares.map((m) => m.get(g) ?? 0).sort((a, b) => a - b);
    const mid = Math.floor(vs.length / 2);
    pct.set(g, how === "median" ? (vs.length % 2 ? vs[mid] : (vs[mid - 1] + vs[mid]) / 2) : vs.reduce((a, v) => a + v, 0) / vs.length);
  }
  return { pct, schools: shares.length };
}

// ------------------------------------------------------------------- the average grade

// 2 · View's average grade marker: the mean or the median of the grades drawn, weighted by
// this school's entries at each. `position` is where it falls down the drawn rows (0 = the
// first row's middle; a fraction between two rows). On a numbered scale (GCSE 9-1, IB 7-1,
// the IB Diploma's points) the mean is the grade number, U / Fail counted as 0; on a named
// scale (A level, vocational, Pre-U) it is the mean position, named by its nearest grade.
// The median is the grade the middle entry got. null = no entries. `value` is the marker's
// own tag ("5.3", "7", "≈ A"), drawn beside it so it reads as a value, not a row boundary.
export type AverageGrade = { position: number; label: string; value: string };

export function averageGrade(rows: GradeRow[], how: "mean" | "median"): AverageGrade | null {
  const total = rows.reduce((a, r) => a + r.ownCount, 0);
  if (total === 0 || rows.length === 0) return null;
  if (how === "median") {
    let run = 0;
    for (const [i, r] of rows.entries()) {
      run += r.ownCount;
      if (run * 2 >= total) return { position: i, label: `Median grade ${r.grade}`, value: r.grade };
    }
    return null;
  }
  const scale = bestScale(rows.map((r) => r.grade));
  const numbered = scale !== GRADE_SCALES[1] && scale.length > 0 && rows.every((r) => r.grade in BOTTOM_RANK || /^\d+$/.test(r.grade));
  if (numbered) {
    const num = (g: string) => (g in BOTTOM_RANK ? 0 : Number(g));
    const mean = rows.reduce((a, r) => a + num(r.grade) * r.ownCount, 0) / total;
    // Where the mean sits between the two drawn rows either side of it.
    let position = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const v = num(rows[i].grade);
      if (mean >= v) {
        if (i === 0) { position = 0; break; }
        const above = num(rows[i - 1].grade);
        position = above === v ? i : i - 1 + (above - mean) / (above - v);
        break;
      }
    }
    return { position, label: `Mean grade ${mean.toFixed(1)}`, value: mean.toFixed(1) };
  }
  const position = rows.reduce((a, r, i) => a + i * r.ownCount, 0) / total;
  return { position, label: `Mean grade ≈ ${rows[Math.round(position)].grade}`, value: `≈ ${rows[Math.round(position)].grade}` };
}
