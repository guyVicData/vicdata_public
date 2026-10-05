// VicData 0.6.1 S3d: the series builder for one subject's grades -- the grade spread and
// Grade counts' change table, the last of S3's view types.
//
//   Grade counts (a grades frame, GradeCountsPanels' data)
//     DV-C1-CNT-CUR-DIST        the latest year's spread, England's share as a tick on each
//                               grade, the members' click-two-grades highlight
//     DV-C1-CNT-TR-SPREAD       the latest year's spread against an earlier year's (the
//                               members' "From" year), no England
//     DV-C1-CNT-TR-CHANGETABLE  each grade's count, first year to latest, with the change
//   Results on Grade bands (a subjects frame with its grade band)
//     DV-C1-RES-CUR-GRADES      the spread in the year Current shows, England's ticks, the
//                               page's band range picked by two clicks (D3 retires it in S5)
//
// Every figure is src/lib/grade-spread.ts's (the hosts draw from the same functions). The
// spread's looks (2 · View: % or counts, an average grade marker, a shaded band, values) never
// change a figure. A note state -- no published grades, only one year to compare -- is the
// host's, as before (null).
import { compareHonest, type HonestMeasure } from "@/catalogue/honest";
import type { CompareSeries, SpreadLook, ViewSpec } from "@/catalogue/viewspec";
import { averageGrade, bandDistribution, gradeCounts, setShares, type GradeCountRow, type GradeRow } from "@/lib/grade-spread";
import { bestScale, inlineRangeLabel, rangeLabel, type GradeRange } from "@/lib/subject-grades";
import { ENTRIES_MEASURE } from "@/lib/teacher-view-panels";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { resolveCompare } from "./compare";
import type { GradesFrame, SubjectsFrame } from "./frames";
import type { LeafSeries, ViewSeries } from "./series";
import { tableLook } from "./subjects";

type SpreadLeaf = Extract<LeafSeries, { leaf: "gradeSpread" }>;

// D7: an explicit compare keeps England (ticks, the latest year) and the subject's own earlier
// year; nothing else has a per-grade figure (R-BANDS-ENGLAND-BENCH, Grade counts' England
// ticks only), so it drops out. 0.6.2 S3: and the set's average share at each grade, "Add an
// average" across schools (R-COMPARATOR-GRADE-SHARE) -- one tick per grade, so it takes the
// place of England's when both are asked for.
function compareOf(spec: ViewSpec, f: GradesFrame | SubjectsFrame) {
  const list: CompareSeries[] = resolveCompare(spec, f);
  const measure: HonestMeasure = f.kind === "grades" ? "counts" : "bands";
  const host = f.kind === "grades" ? "teacher.c1.counts" : f.host;
  const allowed = (c: CompareSeries) => spec.compare === "follows-page" || !f.phase || compareHonest({ phase: f.phase, measure, host }, c.kind).ok;
  const set = spec.compare === "follows-page" ? null : list.find((c) => (c.kind === "nearest" || c.kind === "savedSet") && allowed(c)) ?? null;
  return {
    england: !set && list.some((c) => c.kind === "england" && !c.at && allowed(c)),
    earlier: list.some((c) => c.kind === "self" && c.at === "earlier-year"),
    set: set ? { how: set.average === "median" ? ("median" as const) : ("mean" as const) } : null,
  };
}

// The set's ticks on a spread's rows, and their legend ("Average across the 10 nearest
// schools, 2024/25"), or null while the set's rows load / with none that year.
function setTicks(f: GradesFrame | SubjectsFrame, how: "mean" | "median", period: number | null, grades: string[]) {
  const g = f.schoolSetGrades?.();
  if (!g) return null;
  const shares = setShares(g.schools, period, grades, how);
  if (!shares || period === null) return null;
  return { pct: shares.pct, label: `${how === "median" ? "Median" : "Average"} across ${g.label.toLowerCase()}, ${academicYearLabel(period)}` };
}

// The school's own rows at an earlier year than `latest` (the year before it with grades).
function earlierCounts(rows: GradeCountRow[], latest: number | null, grades: string[]) {
  const before = [...new Set(rows.filter((r) => latest !== null && r.period < latest).map((r) => r.period))].sort((a, b) => b - a)[0];
  if (before === undefined) return null;
  const inYear = rows.filter((r) => r.period === before && grades.includes(r.grade));
  const at = (g: string) => inYear.filter((r) => r.grade === g).reduce((a, r) => a + r.entries, 0);
  const total = rows.filter((r) => r.period === before).filter((r) => grades.includes(r.grade)).reduce((a, r) => a + r.entries, 0);
  return { year: before, at, total };
}

// 2 · View's spread looks, onto the leaf.
function looks(look: SpreadLook, rows: GradeRow[], pageRange: GradeRange | null): Partial<SpreadLeaf> {
  const out: Partial<SpreadLeaf> = {};
  if (look.show === "counts") out.show = "counts";
  if (look.average === "mean" || look.average === "median") {
    const avg = averageGrade(rows, look.average);
    if (avg) out.average = avg;
  }
  let shade: GradeRange | null = null;
  if (look.bands && typeof look.bands === "object") {
    // A band named on a scale the subject isn't on (9-4 on an A level) shades nothing.
    const scale = bestScale([...rows.map((r) => r.grade), look.bands.top, look.bands.bottom]);
    if (scale.includes(look.bands.top) && scale.includes(look.bands.bottom)) shade = { scale, top: look.bands.top, bottom: look.bands.bottom };
  } else if (look.bands === "follows-page" && look.memberSpan !== "page-range") {
    shade = pageRange;
  }
  if (shade) {
    out.shade = shade;
    out.shadeLabel = `Shaded: ${inlineRangeLabel(rangeLabel(shade))}`;
  }
  if (look.values === false) out.values = false;
  return out;
}

// --------------------------------------------------------------------- Grade counts

export function buildGrades(spec: ViewSpec, f: GradesFrame): ViewSeries | null {
  const g = gradeCounts(f.ownRows, f.englandRows, { compareFrom: f.state.compareFrom, changeFrom: f.state.changeFrom });
  const yearText = g.latest === null ? "" : academicYearLabel(g.latest);
  if (spec.view.kind === "table" && spec.data.per === "grade") {
    if (g.chgYear === null) return null;
    return {
      kind: "table",
      heading: null,
      title: [f.subjectLabel, "’s entries at each grade: ", academicYearLabel(g.chgYear), " against ", yearText, ", with the change"],
      leaf: {
        leaf: "yearTable",
        data: g.changeDataIn(f.colour),
        measure: ENTRIES_MEASURE,
        focusKey: null,
        nameHeading: "Grade",
        showRank: false,
        ...tableLook(spec.view.look),
        // Grade counts' change table sits in the panel as it is (no scroll box of its own).
        centred: null,
      },
    };
  }
  if (spec.view.kind !== "spread") return null;
  const look = spec.view.look;
  const { england, earlier, set } = compareOf(spec, f);
  if (g.ownTotal === 0) return null;
  if (earlier && g.cmpYear === null) return null;
  const withBench = g.rowsFor(false);
  const withCompare = earlier ? g.rowsFor(true) : null;
  const ticks = set ? setTicks(f, set.how, g.latest, withBench.map((r) => r.grade)) : null;
  const rows: GradeRow[] = withBench.map((r, i) => ({
    grade: r.grade,
    ownCount: r.ownCount,
    benchPct: ticks ? ticks.pct.get(r.grade) ?? null : england ? r.benchPct : null,
    ...(withCompare ? { compareCount: withCompare[i].compareCount } : {}),
  }));
  const highlight = look.memberSpan === "highlight" ? f.state.highlight : null;
  return {
    kind: "spread",
    heading: null,
    // Spread by year names its two years; Current has no title of its own (the tag names it).
    title: earlier && g.cmpYear !== null ? [f.subjectLabel, "’s spread of grades: ", yearText, " against ", academicYearLabel(g.cmpYear), ", grade by grade"] : null,
    leaf: {
      leaf: "gradeSpread",
      rows,
      total: g.ownTotal,
      ...(earlier && g.cmpYear !== null ? { compareTotal: g.cmpTotal, compareLabel: academicYearLabel(g.cmpYear) } : {}),
      colour: f.colour,
      range: highlight?.range ?? null,
      pending: highlight?.pending ?? null,
      ...(highlight ? { onGradeClick: highlight.onGradeClick } : {}),
      benchLabel: ticks ? ticks.label : england ? g.englandLabel : null,
      ...looks(look, rows, null),
      centred: null,
    },
  };
}

// ------------------------------------------------------- Results on Grade bands

export function buildBandSpread(spec: ViewSpec, f: SubjectsFrame): ViewSeries | null {
  if (spec.view.kind !== "spread") return null;
  const gb = f.gradeBand;
  if (!gb || f.subjects.length === 0) return null;
  const look = spec.view.look;
  const latest = f.state.latestIdx >= 0 ? f.periods[f.state.latestIdx] : null;
  const band = bandDistribution(gb.ownRows, gb.englandRows ?? [], latest);
  if (band.total === 0) return null;
  const { england, earlier, set } = compareOf(spec, f);
  const before = earlier ? earlierCounts(gb.ownRows, latest, band.rows.map((r) => r.grade)) : null;
  if (earlier && !before) return null;
  const ticks = set ? setTicks(f, set.how, latest, band.rows.map((r) => r.grade)) : null;
  const rows: GradeRow[] = band.rows.map((r) => ({ ...r, benchPct: ticks ? ticks.pct.get(r.grade) ?? null : england ? r.benchPct : null, ...(before ? { compareCount: before.at(r.grade) } : {}) }));
  const page = look.memberSpan === "page-range";
  const focusedKey = (f.subjects.find((s) => s.key === f.focus) ?? f.subjects[0])?.key ?? null;
  return {
    kind: "spread",
    heading: null,
    title: null,
    leaf: {
      leaf: "gradeSpread",
      rows,
      total: band.total,
      ...(before ? { compareTotal: before.total, compareLabel: academicYearLabel(before.year) } : {}),
      colour: gb.colour ?? "var(--muted2)",
      range: page ? gb.range : null,
      pending: page ? gb.pending ?? null : null,
      ...(page && gb.onGradeClick ? { onGradeClick: gb.onGradeClick } : {}),
      benchLabel: ticks ? ticks.label : england ? band.benchLabel : null,
      ...looks(look, rows, gb.range),
      centred: `grades:${focusedKey}`,
    },
  };
}
