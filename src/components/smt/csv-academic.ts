// Panel menu "Save as CSV" (21 Nov): SMT Academic's rows, one builder per view (see csv.ts). Each builder
// reads the same object its view draws (views/Academic.tsx) at the precision the view prints (fmtAc:
// value added and points per entry to 2 places, shares to 1, entries whole; fmtShort's points to 1). A
// figure the view withholds -- a subject under the entries floor, a school without a published figure --
// is written in the view's words ("not ranked", "no figure") with its reason beside it, never a number.
import type { CsvCell, CsvTable } from "@/lib/csv";
import { shown } from "@/lib/csv";
import { periodLabel } from "@/catalogue/years";
import { SUBJECT_FAMILY_NAMES } from "@/lib/subject-family-colours";
import type { Academic, AreaSubject, BoardRow, Unit } from "@/lib/smt/academic";
import { bandCsv } from "./csv";

const yr = (p: number | null | undefined) => (p === null || p === undefined ? null : periodLabel(p));
const isPct = (u: Unit) => u === "share" || u === "pct";
const pctHdr = (u: Unit) => (isPct(u) ? " (%)" : "");

/** A figure at fmtAc's precision (`short`: fmtShort's, points to 1 place). */
export function acNum(v: number | null | undefined, unit: Unit, short = false): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  switch (unit) {
    case "share":
    case "pct":
      return shown(v, 1);
    case "entries":
      return Math.round(v);
    case "points":
      return shown(v, short ? 1 : 2);
    default:
      return shown(v, 2);
  }
}
/** A change at fmtChangeAc's precision. */
const acChange = (v: number | null | undefined, unit: Unit) => (v === null || v === undefined ? null : unit === "entries" ? Math.round(v) : isPct(unit) || unit === "points" ? shown(v, 1) : shown(v, 2));
const unitWord = (u: Unit) => (u === "va" ? "value added" : isPct(u) ? "%" : u === "entries" ? "entries" : u === "grade" ? "grade" : "points");
const changeUnit = (u: Unit) => (isPct(u) ? "percentage points" : unitWord(u));

// ------------------------------------------------------------------------------- column 1

/** "Results now" / "Value added now" / "Entries now": one row per line, then the summary beside them. */
export function academicNowCsv(a: Academic): CsvTable {
  const va = a.state.mode === "va";
  const summary = a.col1.summary.map((s) => [s.label, s.value] as CsvCell[]);
  if (a.state.mode === "entries") {
    const periods = Array.from(new Set(a.lines.flatMap((l) => l.series.map((p) => p.period)))).sort((x, y) => x - y);
    return {
      about: { set: a.set.label, year: yr(a.period) },
      columns: ["Line", "Detail", "Entries", "Share of entries (%)", "Set's typical share (%)", ...periods.map((p) => `Entries ${periodLabel(p)}`), "Why no figure"],
      rows: [
        ...a.lines.map((l) => [l.label, l.sub, l.value === null ? null : (l.series.at(-1)?.value ?? 0), acNum(l.share, "share"), acNum(l.typical, "share"), ...periods.map((p) => { const v = l.series.find((x) => x.period === p); return v ? (v.value ?? 0) : null; }), l.value === null ? l.why : null]),
        ...summary,
      ],
    };
  }
  return {
    about: { set: a.set.label, year: yr(a.period) },
    columns: ["Line", "Detail", "Value", "Unit", va ? "Band" : "Grade", "Place", "Schools placed", "Placed among", "Last year", "Why no figure"],
    rows: [
      ...a.lines.map((l) => [l.label, l.sub, l.value === null ? "not ranked" : acNum(l.value, l.unit), unitWord(l.unit), va ? l.band : l.grade, l.value === null ? null : l.place ? l.place.rank : "not ranked", l.value !== null && l.place ? l.place.of : null, l.value !== null && l.place ? l.placeLabel : null, l.value === null ? null : acNum(l.last, l.unit, true), l.value === null ? l.why : null]),
      ...summary,
    ],
  };
}

// ------------------------------------------------------------------------------- the board

const quarterWord = (q: BoardRow["quarter"]) => (q === "top" ? "top quarter" : q === "bottom" ? "bottom quarter" : q === "middle" ? "middle half" : null);
const kmOf = (km: number | null) => (km === null ? null : km < 10 ? shown(km, 1) : Math.round(km));

/** The ranked chart, the ranking table and the map: the set's schools, figure by figure (the map: the
 * schools it can place). */
export function boardCsv(a: Academic, located = false): CsvTable | null {
  const b = a.board;
  if (b.empty) return null;
  const va = b.unit === "va";
  const rows = located ? b.rows.filter((r) => r.easting !== null && r.northing !== null) : b.rows;
  if (!rows.length) return null;
  const grade = !va && b.rows.some((r) => r.grade);
  const entries = b.rows.some((r) => r.entries !== null);
  const england = b.rows.some((r) => r.england);
  const prev = b.period !== null ? periodLabel(b.period - 1) : "Last year";
  return {
    about: { set: a.set.label, year: yr(b.period) },
    columns: ["Rank in set", "School", "URN", "You", "Km", `${b.measure}${pctHdr(b.unit)}`, ...(va ? ["95% range, low", "95% range, high", a.state.phase === "gcse" ? "DfE band" : "Band"] : ["Quarter of the set"]), ...(grade ? ["Grade"] : []), ...(entries ? ["Entries"] : []), `${prev}${pctHdr(b.unit)}`, ...(england ? ["England rank", "England schools ranked"] : []), "Why no figure"],
    rows: rows.map((r) => [
      r.value === null ? null : b.rows.filter((x) => x.value !== null && x.value > r.value!).length + 1,
      r.name,
      r.urn,
      r.you ? "yes" : null,
      kmOf(r.km),
      r.value === null ? "no figure" : acNum(r.value, b.unit),
      ...(va ? [acNum(r.lo, "va"), acNum(r.hi, "va"), r.band] : [quarterWord(r.quarter)]),
      ...(grade ? [r.grade] : []),
      ...(entries ? [r.entries] : []),
      acNum(r.last, b.unit),
      ...(england ? [r.england?.rank ?? null, r.england?.of ?? null] : []),
      r.value === null ? (r.why ?? null) : null,
    ]),
  };
}

// ------------------------------------------------------------------------------- subject areas

/** Subject areas: each area's subjects by qualification, then those outside the areas. */
export function areasCsv(a: Academic): CsvTable | null {
  if (a.areas.none) return null;
  const mode = a.state.mode;
  const unit: Unit = mode === "va" ? "va" : mode === "entries" ? "share" : a.state.phase === "gcse" ? "grade" : "points";
  const subjects = [...a.areas.blocks.flatMap((b) => b.quals.flatMap((q) => q.subjects)), ...a.areas.outside];
  if (!subjects.length) return null;
  const sized = subjects.some((s) => s.size !== null);
  const nCounts = Math.max(0, ...subjects.map((s) => s.counts.length));
  const P = a.areas.period;
  const countHdr = (i: number) => (P !== null ? `Entries ${periodLabel(P - (nCounts - 1) + i)}` : `Entries, year ${i + 1}`);
  const value = mode === "va" ? "Value added" : mode === "entries" ? "Share of the school's entries (%)" : a.state.phase === "gcse" ? "Average grade" : "Points per entry";
  const row = (area: string, short: string, s: AreaSubject): CsvCell[] => [
    area,
    short,
    s.subject,
    s.vicdata ? "yes" : null,
    s.entries,
    ...(mode === "entries" ? Array.from({ length: nCounts }, (_, i) => s.counts[i] ?? null) : []),
    ...(mode === "entries" && sized ? [s.size] : []),
    s.value === null ? (s.why ? "not ranked" : null) : acNum(s.value, unit),
    ...(mode === "entries"
      ? [s.value !== null && s.typical !== null ? shown(s.value - s.typical, 1) : "none", s.offering?.n ?? null, s.offering?.of ?? null]
      : [s.value === null ? null : s.only ? "only school" : (s.place?.rank ?? null), s.value === null || s.only ? null : (s.place?.of ?? null)]),
    s.value === null ? s.why : null,
  ];
  return {
    about: { set: a.set.label, year: yr(P) },
    columns: [
      "Subject area",
      "Qualification",
      "Subject",
      "Placed in its area by VicData",
      "Entries",
      ...(mode === "entries" ? Array.from({ length: nCounts }, (_, i) => countHdr(i)) : []),
      ...(mode === "entries" && sized ? ["Size (XS to XL)"] : []),
      value,
      ...(mode === "entries" ? ["Against the set's typical share (percentage points)", "Set schools offering it", "Set schools"] : ["Place in set", "Set schools placed"]),
      "Why not ranked",
    ],
    rows: [...a.areas.blocks.flatMap((b) => b.quals.flatMap((q) => q.subjects.map((s) => row(b.label, q.short, s)))), ...a.areas.outside.map((s) => row("Outside the subject areas", "EPQ", s))],
  };
}

/** The grade profile: each qualification's graded entries and its share in each grade band. */
export function gradesCsv(a: Academic): CsvTable | null {
  if (!a.grades.length) return null;
  return {
    about: { set: null, year: yr(a.areas.period ?? a.period) },
    columns: ["Qualification", "Graded entries", "Grades", "Share of graded entries (%)"],
    rows: a.grades.flatMap((g) => g.bands.map((b) => [g.short, g.entries, b.label, Math.round(b.pct)])),
  };
}

// ------------------------------------------------------------------------------- row 2

const bandUnit = (u: Unit) => (u === "va" ? "va" : u === "share" ? "share" : u === "grade" ? "grade" : u === "entries" ? "pupils" : "points") as Parameters<typeof bandCsv>[2];

/** The trend against the set's middle half (the chart, or its table). */
export function trendCsv(a: Academic, chart: boolean): CsvTable | null {
  const t = a.trends;
  if (chart) {
    if (t.school.filter((p) => p.value !== null).length < 1 && t.band.filter((b) => b.p25 !== null).length < 1) return null;
    return bandCsv(t.school.length ? t.school : t.band.map((x) => ({ year: x.year, value: null })), t.band, bandUnit(t.unit), a.set.label, t.label);
  }
  return bandCsv(t.school, t.band, bandUnit(t.unit), a.set.label, t.label);
}

/** Every line, last year to this: both figures and the change (fmtShort's and fmtChangeAc's places). */
export function everyLineCsv(a: Academic): CsvTable | null {
  const lines = a.trends.lines.filter((l) => l.from !== null || l.to !== null);
  if (!lines.length) return null;
  const unit = lines[0].unit;
  const fromP = lines[0].fromPeriod;
  const toP = lines[0].toPeriod;
  const h = pctHdr(unit);
  return {
    about: { set: null, year: null },
    columns: ["Line", "Detail", `${fromP !== null ? periodLabel(fromP) : "Last year"}${h}`, `${toP !== null ? periodLabel(toP) : "This year"}${h}`, "Change", "Change unit"],
    rows: lines.map((l) => {
      const d = l.to !== null && l.from !== null ? l.to - l.from : null;
      return [l.label, l.sub ?? null, acNum(l.from, unit, true), acNum(l.to, unit, true), d === null ? (l.to === null ? "no figure" : "new") : acChange(d, unit), changeUnit(unit)];
    }),
  };
}

/** Entries by subject, first year to latest (the dumbbell), the subjects' average last. */
export function dumbbellCsv(a: Academic): CsvTable | null {
  const d = a.trends.dumbbell;
  if (!d || !d.rows.length) return null;
  const fam = (id: string | null | undefined) => (id ? (a.areas.blocks.find((b) => b.id === id)?.label ?? SUBJECT_FAMILY_NAMES[id] ?? id) : null);
  return {
    about: { set: null, year: null },
    columns: ["Subject", "Qualification", "Subject family", `Entries ${periodLabel(d.firstYear)}`, `Entries ${periodLabel(d.latestYear)}`, "Change"],
    rows: [...d.rows.map((r) => [r.label, r.qualification, fam(r.familyId), Math.round(r.first), Math.round(r.latest), Math.round(r.latest - r.first)] as CsvCell[]), ...(d.average ? [["Average", null, null, Math.round(d.average.first), Math.round(d.average.latest), Math.round(d.average.latest - d.average.first)] as CsvCell[]] : [])],
  };
}

/** The biggest moves (subjects' entries) or the set's schools rising and falling. */
export function movesCsv(a: Academic): CsvTable | null {
  const m = a.trends.moves;
  if (!m.length) return null;
  const subjects = a.trends.movesKind === "subjects";
  const listed = [...m.filter((x) => x.change > 0).map((x) => ({ x, dir: subjects ? "Growing" : "Rising" })), ...m.filter((x) => x.change < 0).map((x) => ({ x, dir: subjects ? "Shrinking" : "Falling" }))];
  if (!listed.length) return null;
  return {
    about: { set: subjects ? null : a.set.label, year: null },
    columns: ["Direction", subjects ? "Subject" : "School", ...(subjects ? ["From", "To"] : []), "Change", "Change unit"],
    rows: listed.map(({ x, dir }) => [dir, x.label, ...(subjects ? [x.from ?? 0, x.to ?? 0] : []), acChange(x.change, x.unit), changeUnit(x.unit)]),
  };
}

/** Entries by qualification group, year by year: each group's entries and share, and all entries. */
export function mixCsv(a: Academic): CsvTable | null {
  const mix = a.trends.mix;
  if (!mix.years.length) return null;
  return {
    about: { set: null, year: null },
    columns: ["Year", ...mix.keys.flatMap((k) => [`${k.label}: entries`, `${k.label}: share (%)`]), "All entries"],
    rows: mix.years.map((y) => [periodLabel(y.year), ...mix.keys.flatMap((k) => (y.counts[k.key] ? [y.counts[k.key], Math.round(y.shares[k.key])] : [null, null])), y.total]),
  };
}

/** Where the school's mix differs most from the set's typical school. */
export function againstCsv(a: Academic): CsvTable | null {
  const x = a.trends.against;
  if (!x.length) return null;
  return {
    about: { set: a.set.label, year: null },
    columns: ["Subject", "Your share of Post-16 entries (%)", "Set's typical share (%)", "Gap (percentage points)"],
    rows: x.map((r) => [r.label, shown(r.mine, 1), shown(r.typical, 1), shown(r.gap, 1)]),
  };
}

/** The rows for one Academic view as ViewBody draws it; null where it draws nothing tabular. */
export function academicCsv(dv: string, d: Academic): CsvTable | null {
  switch (dv) {
    case "DV-SMT-A-NOW":
      return academicNowCsv(d);
    case "DV-SMT-A-CHART":
    case "DV-SMT-A-TABLE":
      return boardCsv(d);
    case "DV-SMT-A-MAP":
      return boardCsv(d, true);
    case "DV-SMT-A-AREAS":
      return areasCsv(d);
    case "DV-SMT-A-GRADES":
      return gradesCsv(d);
    case "DV-SMT-A-TREND-LINE":
      return trendCsv(d, true);
    case "DV-SMT-A-TREND-TABLE":
      return trendCsv(d, false);
    case "DV-SMT-A-LINES":
      return everyLineCsv(d);
    case "DV-SMT-A-DUMBBELL":
      return dumbbellCsv(d);
    case "DV-SMT-A-MOVES":
    case "DV-SMT-A-SETMOVES":
      return movesCsv(d);
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
      return mixCsv(d);
    case "DV-SMT-A-AGAINST":
      return againstCsv(d);
  }
  return null;
}
