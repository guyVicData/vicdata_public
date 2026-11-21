// Panel menu "Save as CSV" (21 Nov): Teacher's rows -- the GCSE and Post-16 dashboards, the custom
// dashboards and meeting slides drawn from the same hosts, and the v2 view renderer
// (src/components/views/SeriesView.tsx), which draws the same leaves.
//
// The leaves register, not the hosts: SortTable, RankedList, NumberTiles, TrendChart, YearTable,
// ChangeList, ViewChart, VerticalBars, ShareDonut, GradeDistribution, DumbbellView, ChangeChart,
// SchoolRankingTable and RankingsMap each call useTeacherCsv (csv-hooks.tsx) with one of the
// builders below over the rows they are handed -- already filtered, sliced and suppressed by the
// host -- so every panel that draws one of them offers its rows, wherever it is drawn.
//
// The figures are the screen's own: each builder takes the label the leaf prints (the measure's
// format: "45%", "5.3", "+3pp", "−12", "1,204") and turns it back into a number at that precision
// (readFigure), with its unit in the header ("Result (%)", "Change (percentage points)"). Anything
// that is not a plain figure -- "—", "too few entries", "not comparable", "no published figure",
// "fewer than 5 schools" -- is written as the words, never a number. Pure, so
// src/lib/panel-csv-teacher.test.ts checks each against the leaf's own markup.
import type { CsvCell, CsvTable } from "@/lib/csv";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import type { Measure, PanelData } from "@/lib/teacher-view-panels";
import type { ComputedView } from "@/lib/teacher-view-catalogue";
import type { DashboardDumbbell } from "@/lib/teacher-dumbbell";
import type { GradeRow } from "@/lib/grade-spread";
import type { TeacherMapSpec } from "@/lib/teacher-map";
import { SECTOR, sectorOf } from "@/lib/school-sector";

// ------------------------------------------------------------------ a printed figure, read back

export type FigureUnit = "" | "%" | "pp" | "rank";

/** A label the screen prints, read back as a number and its unit -- or null where it is words.
 * "45%" -> 45 %, "+3pp" -> 3 pp, "−0.4" -> -0.4, "±0" -> 0, "1,204" -> 1204, "=3rd" -> 3 rank. */
export function readFigure(label: string | null | undefined): { n: number; unit: FigureUnit } | null {
  if (label === null || label === undefined) return null;
  const s = label.trim().replace(/−/g, "-").replace(/^±/, "").replace(/^\+/, "");
  const ord = /^=?(\d[\d,]*)(st|nd|rd|th)$/.exec(s);
  if (ord) return { n: Number(ord[1].replace(/,/g, "")), unit: "rank" };
  const m = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%|pp)?$/.exec(s);
  if (!m) return null;
  const n = Number(`${m[1]}${m[2].replace(/,/g, "")}${m[3] ?? ""}`);
  return Number.isFinite(n) ? { n: Object.is(n, -0) ? 0 : n, unit: (m[4] as FigureUnit | undefined) ?? "" } : null;
}

const UNIT_SUFFIX: Record<FigureUnit, string> = { "": "", "%": " (%)", pp: " (percentage points)", rank: "" };

/** One column of printed figures: numbers (the unit in the header) where every figure shares a
 * unit, the words as printed where a cell is words. Mixed units stay as printed text. */
export function figureColumn(header: string, labels: (string | null | undefined)[]): { header: string; cells: CsvCell[] } {
  const read = labels.map(readFigure);
  const units = new Set(read.filter((r) => r !== null).map((r) => r!.unit));
  if (units.size > 1) return { header, cells: labels.map((l) => l ?? null) };
  const unit = units.size ? [...units][0] : "";
  return { header: header + UNIT_SUFFIX[unit], cells: labels.map((l, i) => (read[i] ? read[i]!.n : (l ?? null))) };
}

type Col = { header: string; cells: CsvCell[] };
const text = (header: string, cells: CsvCell[]): Col => ({ header, cells });

/** Columns (each a header and its cells, one per row) as a table. */
export function tableOf(cols: Col[], about?: CsvTable["about"]): CsvTable {
  const n = Math.max(0, ...cols.map((c) => c.cells.length));
  return {
    ...(about ? { about } : {}),
    columns: cols.map((c) => c.header),
    rows: Array.from({ length: n }, (_, i) => cols.map((c) => c.cells[i] ?? null)),
  };
}

// The trend leaves' own Year column: no "Data year" beside it.
const TREND: CsvTable["about"] = { year: null };

// ------------------------------------------------------------------ SortTable

export type SortTableCsvRow = { key: string; label: string; valueLabel: string; deltaLabel: string };

/** SortTable, in the order drawn: the bare rank (leadingRank), the name, the figure, the "vs" column. */
export function sortTableCsv(
  sorted: SortTableCsvRow[],
  columns: { name: string; value: string; delta: string },
  opts: { rankOf?: Map<string, number>; leadingRank?: boolean; showValue?: boolean; showDelta?: boolean },
): CsvTable | null {
  if (!sorted.length) return null;
  const cols: Col[] = [];
  if (opts.leadingRank) cols.push(text("Rank", sorted.map((r) => opts.rankOf?.get(r.key) ?? null)));
  cols.push(text(columns.name, sorted.map((r) => r.label)));
  if (opts.showValue !== false) cols.push(figureColumn(columns.value, sorted.map((r) => r.valueLabel)));
  if (opts.showDelta !== false) cols.push(figureColumn(columns.delta, sorted.map((r) => r.deltaLabel)));
  return tableOf(cols);
}

// ------------------------------------------------------------------ RankedList

export type RankedListCsvRow = { key: string; label: string; value: number | null; rank?: number | null; change?: string | null; n?: number | null };

/** RankedList: rank, name, figure ("no published figure" as words), and the look's change and entries. */
export function rankedListCsv(rows: RankedListCsvRow[], measure: Pick<Measure, "format" | "id" | "label">, columns?: string[]): CsvTable | null {
  if (!rows.length) return null;
  const has = (c: string) => !columns || columns.includes(c);
  const cols: Col[] = [];
  if (has("rank")) cols.push(text("Rank", rows.map((r, i) => r.rank ?? i + 1)));
  cols.push(text("Name", rows.map((r) => r.label)));
  if (has("value")) cols.push(figureColumn(measure.id === "entries" ? "Candidates" : measure.label, rows.map((r) => (r.value === null ? "no published figure" : measure.format(r.value)))));
  if (columns?.includes("change")) cols.push(figureColumn("Change on the year before", rows.map((r) => r.change ?? null)));
  if (columns?.includes("n")) cols.push(text("Entries", rows.map((r) => (r.n === null || r.n === undefined ? null : Math.round(r.n)))));
  return tableOf(cols);
}

// ------------------------------------------------------------------ NumberTiles

/** The tiles: the main figure, then each tile -- what it is (its scope line), its figure, its unit. */
export function tilesCsv(main: { figure: string; label: string } | null, tiles: { key: string; figure: string; detail: string }[]): CsvTable | null {
  const items = [...(main ? [{ what: main.label, figure: main.figure }] : []), ...tiles.map((t) => ({ what: t.detail, figure: t.figure }))];
  if (!items.length) return null;
  return {
    columns: ["Figure", "Value", "Unit"],
    rows: items.map((it) => {
      const r = readFigure(it.figure);
      return [it.what, r ? r.n : it.figure, r ? (r.unit === "%" ? "%" : r.unit === "pp" ? "percentage points" : r.unit === "rank" ? (it.figure.startsWith("=") ? "place (shared)" : "place") : "") : null];
    }),
  };
}

// ------------------------------------------------------------------ TrendChart (and its bars)

/** TrendChart: a row per year, a column per line (the band's ends and the reference after them). */
export function trendChartCsv(
  data: PanelData,
  measure: Pick<Measure, "format" | "noun">,
  extra?: { band?: { min: (number | null)[]; max: (number | null)[]; label: string } | null },
): CsvTable | null {
  if (!data.periods.length || !data.series.length) return null;
  const indexed = measure.noun === "index";
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : measure.format(v));
  const cols: Col[] = [text("Year", data.periods.map(academicYearLabel))];
  for (const s of data.series) cols.push(figureColumn(indexed ? `${s.label}: index (first year = 100)` : s.label, data.periods.map((_, i) => fmt(s.values[i]))));
  if (extra?.band) {
    cols.push(figureColumn(`${extra.band.label}: lowest`, data.periods.map((_, i) => fmt(extra.band!.min[i]))));
    cols.push(figureColumn(`${extra.band.label}: highest`, data.periods.map((_, i) => fmt(extra.band!.max[i]))));
  }
  return tableOf(cols, TREND);
}

// ------------------------------------------------------------------ YearTable

export type YearTableCsvRow = {
  key: string;
  label: string;
  values: (number | null)[];
  rank: number | null;
  change: { delta: number; percent: number | null } | null;
};

/** YearTable, in the order drawn (its sort, its window): rank, name, every year (the card's
 * "+N more years" included), entries, and the change in the measure's honest unit -- a count's
 * change and its %, points or percentage points otherwise. */
export function yearTableCsv(
  rows: YearTableCsvRow[],
  periods: number[],
  measure: Pick<Measure, "format" | "formatDelta" | "changeKind">,
  opts: { nameHeading: string; rank: boolean; counts?: Record<string, number | null>; showChange: boolean; signedPercent: (v: number) => string },
): CsvTable | null {
  if (!rows.length || !periods.length) return null;
  const cols: Col[] = [];
  if (opts.rank) cols.push(text("Rank", rows.map((r) => r.rank)));
  cols.push(text(opts.nameHeading, rows.map((r) => r.label)));
  periods.forEach((p, i) => cols.push(figureColumn(academicYearLabel(p), rows.map((r) => (r.values[i] === null || r.values[i] === undefined ? "—" : measure.format(r.values[i]!))))));
  if (opts.counts) cols.push(text("Entries", rows.map((r) => (opts.counts![r.key] === null || opts.counts![r.key] === undefined ? "—" : Math.round(opts.counts![r.key]!)))));
  if (opts.showChange) {
    cols.push(figureColumn("Change", rows.map((r) => (r.change ? measure.formatDelta(r.change.delta) : "—"))));
    if (measure.changeKind === "percent") {
      const pc = figureColumn("Change", rows.map((r) => (r.change?.percent !== null && r.change?.percent !== undefined ? opts.signedPercent(r.change.percent) : "—")));
      cols.push({ header: "Change (%)", cells: pc.cells });
    }
  }
  return tableOf(cols, TREND);
}

// ------------------------------------------------------------------ ChangeList

/** ChangeList, in the order drawn: rank, name, change, the two counts where shown, the small-base
 * mark; the group's and the average's reference lines as rows after. */
export function changeListCsv(
  drawn: { key: string; label: string; value: number | null; rank: number | null; from?: number | null; to?: number | null; small?: boolean }[],
  format: (v: number) => string,
  opts: { values: boolean; counts: boolean; group?: { label: string; value: number | null }; average?: { label: string; value: number }; smallNote?: string },
): CsvTable | null {
  if (!drawn.length) return null;
  const refs = [...(opts.group ? [{ label: opts.group.label, value: opts.group.value, ref: true }] : []), ...(opts.average ? [{ label: opts.average.label, value: opts.average.value as number | null, ref: true }] : [])];
  const all = [...drawn.map((r) => ({ ...r, ref: false })), ...refs.map((r) => ({ key: r.label, label: r.label, value: r.value, rank: null, from: null, to: null, small: false, ref: true }))];
  const cols: Col[] = [text("Rank", all.map((r) => (r.ref || r.value === null ? null : r.rank))), text("Name", all.map((r) => r.label))];
  if (opts.values) cols.push(figureColumn("Change", all.map((r) => (r.value === null ? (r.ref ? "no figure" : "—") : format(r.value)))));
  if (opts.values && opts.counts) {
    cols.push(text("Entries, first year", all.map((r) => r.from ?? null)));
    cols.push(text("Entries, latest year", all.map((r) => r.to ?? null)));
  }
  if (all.some((r) => r.small)) cols.push(text("Note", all.map((r) => (r.small ? opts.smallNote ?? "small base" : null))));
  return tableOf(cols, TREND);
}

// ------------------------------------------------------------------ ViewChart

/** ViewChart: a row per bar (name, its figure, its marker), or a year-by-series table. */
export function viewChartCsv(
  computed: ComputedView,
  show: (v: number | null) => string,
  opts: { nameHeading?: string; valueHeading?: string; markerLabel?: string; average?: { value: number; label: string }; values?: boolean; limit?: number },
): CsvTable | null {
  if (computed.series && computed.periods) {
    if (!computed.periods.length || !computed.series.length) return null;
    return tableOf([text("Year", computed.periods.map((p) => String(p))), ...computed.series.map((s) => figureColumn(s.label, s.values.map((v) => show(v))))], TREND);
  }
  const rows = (opts.limit ? computed.rows.slice(0, opts.limit) : computed.rows);
  if (!rows.length || !rows.some((r) => r.value !== null)) return null;
  const all = [...rows.map((r) => ({ label: r.label, sub: r.sublabel ?? null, value: r.value, marker: r.marker ?? null })), ...(opts.average ? [{ label: opts.average.label, sub: null, value: opts.average.value, marker: null }] : [])];
  const cols: Col[] = [text(opts.nameHeading ?? "Name", all.map((r) => r.label))];
  if (all.some((r) => r.sub)) cols.push(text("Detail", all.map((r) => r.sub)));
  if (opts.values !== false || opts.average) cols.push(figureColumn(opts.valueHeading ?? "Value", all.map((r) => show(r.value))));
  if (rows.some((r) => r.marker !== null && r.marker !== undefined)) cols.push(figureColumn(opts.markerLabel ?? "Benchmark", all.map((r) => (r.marker === null ? null : show(r.marker)))));
  return tableOf(cols);
}

// ------------------------------------------------------------------ VerticalBars

/** VerticalBars: a row per bar, its figure as printed ("no figure" as words), the average after. */
export function verticalBarsCsv(bars: { label: string; value: number | null }[], measure: Pick<Measure, "format" | "id" | "label">, average?: { value: number; label: string }): CsvTable | null {
  if (!bars.length || !bars.some((b) => b.value !== null)) return null;
  const all = [...bars, ...(average ? [{ label: average.label, value: average.value as number | null }] : [])];
  return tableOf([text("Name", all.map((b) => b.label)), figureColumn(measure.id === "entries" ? "Entries" : measure.label, all.map((b) => (b.value === null ? "no figure" : measure.format(b.value))))]);
}

// ------------------------------------------------------------------ ShareDonut

/** The donut's two slices: each with its figure and its share, as the legend and the centre print them. */
export function donutCsv(d: { percent: number; label: string; valueLabel: string; otherLabel: string; groupValueLabel: string }): CsvTable {
  const share = Math.max(0, Math.min(100, d.percent));
  const value = figureColumn("Value", [d.valueLabel, d.groupValueLabel]);
  return tableOf([text("Slice", [d.label, d.otherLabel]), value, text("Share (%)", [Math.round(share), 100 - Math.round(share)])]);
}

// ------------------------------------------------------------------ GradeDistribution

// The words the screen gives a grade the benchmark doesn't publish (R-MIN-SCHOOLS: the RPC
// withholds a grade fewer than 5 schools publish).
export const BENCH_WITHHELD = "fewer than 5 schools";

/** GradeDistribution: a row per grade -- entries and the share of graded entries (as printed,
 * whole %), the benchmark's share (the words where it is withheld), the earlier year's. */
export function gradeDistributionCsv(rows: GradeRow[], total: number, opts: { benchLabel: string | null; compareTotal?: number; compareLabel?: string; inRange?: (grade: string) => boolean }): CsvTable | null {
  if (!rows.length) return null;
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
  const cols: Col[] = [
    text("Grade", rows.map((r) => r.grade)),
    text("Entries", rows.map((r) => r.ownCount)),
    text("Share of graded entries (%)", rows.map((r) => pct(r.ownCount, total))),
  ];
  if (opts.benchLabel) cols.push(text(`${opts.benchLabel} (%)`, rows.map((r) => (r.benchPct === null ? BENCH_WITHHELD : Math.round(r.benchPct)))));
  if (opts.compareTotal) {
    const label = opts.compareLabel ?? "Earlier year";
    cols.push(text(`${label}: entries`, rows.map((r) => r.compareCount ?? 0)));
    cols.push(text(`${label}: share (%)`, rows.map((r) => pct(r.compareCount ?? 0, opts.compareTotal!))));
  }
  if (opts.inRange) cols.push(text("In the range", rows.map((r) => (opts.inRange!(r.grade) ? "yes" : "no"))));
  return tableOf(cols);
}

// ------------------------------------------------------------------ DumbbellView

/** The dumbbell: each subject's entries in the first and the latest year, and the change; the average last. */
export function dumbbellCsv(d: DashboardDumbbell, firstLabel: string, latestLabel: string): CsvTable | null {
  if (!d.rows.length) return null;
  const all = [...d.rows.map((r) => ({ label: r.label, first: r.first, latest: r.latest, change: r.change })), ...(d.average ? [d.average] : [])];
  return {
    about: TREND,
    columns: ["Subject", `Entries ${firstLabel}`, `Entries ${latestLabel}`, "Change in entries"],
    rows: all.map((r) => [r.label, Math.round(r.first), Math.round(r.latest), Math.round(r.change)]),
  };
}

// ------------------------------------------------------------------ ChangeChart

/** ChangeChart (the classic change bars): a row per bar, its change as printed. */
export function changeChartCsv(bars: { label: string; value: number | null }[], format: (v: number) => string): CsvTable | null {
  if (!bars.some((b) => b.value !== null)) return null;
  return tableOf([text("Name", bars.map((b) => b.label)), figureColumn("Change", bars.map((b) => (b.value === null ? "no figure" : format(b.value))))], TREND);
}

// ------------------------------------------------------------------ SchoolRankingTable

export type SchoolRankingCsvRow = { name: string; rank: number | null; valueLabel: string; distanceKm: number | null; independent: boolean | null; isTarget: boolean; change?: string | null; n?: number | null };

/** SchoolRankingTable, in the order drawn: rank, school, sector, figure (the words where a school
 * is listed but not placed -- "too few entries", "not comparable"), the look's change and n, the
 * distance; the set's average last. */
export function schoolRankingCsv(
  drawn: SchoolRankingCsvRow[],
  has: (c: "rank" | "sector" | "value" | "change" | "n" | "distance") => boolean,
  opts: { valueHeading: string; targetName: string; average?: { label: string; value: string } | null },
): CsvTable | null {
  if (!drawn.length) return null;
  const avg = opts.average ? [{ name: opts.average.label, rank: null, valueLabel: opts.average.value, distanceKm: null, independent: null, isTarget: false, change: null, n: null, avg: true }] : [];
  const all = [...drawn.map((r) => ({ ...r, avg: false })), ...avg];
  const cols: Col[] = [];
  if (has("rank")) cols.push(text("Rank", all.map((r) => r.rank)));
  cols.push(text("School", all.map((r) => r.name)));
  if (has("sector")) cols.push(text("Sector", all.map((r) => (r.independent === null ? null : SECTOR[sectorOf({ independent: r.independent })].label))));
  if (has("value")) cols.push(figureColumn(opts.valueHeading, all.map((r) => r.valueLabel)));
  if (has("change")) cols.push(figureColumn("Change", all.map((r) => (r.avg ? null : r.change ?? "—"))));
  if (has("n")) cols.push(text("n", all.map((r) => (r.avg ? null : r.n === null || r.n === undefined ? "—" : Math.round(r.n)))));
  if (has("distance")) cols.push(text(`Distance from ${opts.targetName} (km)`, all.map((r) => (r.avg ? null : r.isTarget || r.distanceKm === null ? "—" : Math.round(r.distanceKm * 10) / 10))));
  return tableOf(cols);
}

// ------------------------------------------------------------------ RankingsMap

/** A Teacher map's dots: each plotted school, its figure as the hover gives it ("Too few entries"
 * and "No published figure" as words), and the entries its dot is sized by. */
export function mapCsv(schools: { urn: string; name: string }[], targetUrn: string, spec: TeacherMapSpec): CsvTable | null {
  const plotted = schools.filter((s) => spec.dots[s.urn]);
  if (!plotted.length) return null;
  return {
    columns: ["School", "URN", "This school", "Figure (as the map gives it)", "Entries"],
    rows: plotted.map((s) => {
      const d = spec.dots[s.urn];
      return [s.name, s.urn, s.urn === targetUrn ? "yes" : "", d.lines[0] ?? null, d.size === null ? null : Math.round(d.size)];
    }),
  };
}

// ------------------------------------------------------------------ Comparisons' rank over time

/** The school's place in its set, year by year (the walk chart's line and its "Schools with a figure" row). */
export function rankOverTimeCsv(r: { years: string[]; ranks: (number | null)[]; of: (number | null)[] }): CsvTable | null {
  if (!r.years.length || !r.ranks.some((v) => v !== null)) return null;
  return { about: TREND, columns: ["Year", "Our place", "Schools with a figure"], rows: r.years.map((y, i) => [y, r.ranks[i] ?? "—", r.of[i] ?? "—"]) };
}
