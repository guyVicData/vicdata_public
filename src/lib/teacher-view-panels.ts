// Teacher view, round 6: the three-panel card mechanism (round-6 brief §3, §6.6).
//
// Round 5's cards were "one hardcoded default box, plus a tick-list of per-subject axis
// views pinned beside it". Round 6 replaces that with three peers -- Current, Trend and
// % change -- any two of which can be removed, leaving whichever ONE the person kept
// (brief §3: "default panel is not always the last one left"). §6.6 settled that this
// REPLACES the old AXES tick-list in Candidates and Results rather than sitting beside
// it; axis-style comparisons now live only in Context's combined picker (§4.2).
//
// Everything here is pure: the panel set, the measures the panels can point at, the real
// year ranges the From:/Since: controls offer, and the arithmetic behind the summary
// sentences. The components render it; none of them re-derive it.
import type { TeacherPhase } from "./teacher-view-phases";

// ---------------------------------------------------------------- the panels

export type PanelId = "current" | "trend" | "change";

// Render order on the card, and the order the Add picker offers them in -- the
// wireframe's own order (Main.dc.html), not alphabetical.
export const PANEL_ORDER: readonly PanelId[] = ["current", "trend", "change"] as const;

// A column nobody has touched shows Current alone. Deliberately the SAME shape
// resetColumn already uses (the column's key absent from `columns`), so "never
// customised" and "reset" stay one state rather than drifting into two -- see
// teacher-view-data.ts's own note on that.
export const DEFAULT_PANELS: readonly PanelId[] = ["current"] as const;

export function isPanelId(value: string): value is PanelId {
  return (PANEL_ORDER as readonly string[]).includes(value);
}

// The panels a column is currently showing, in PANEL_ORDER. Anything saved that is not a
// panel id is ignored rather than rendered -- and an empty result falls back to the
// default, so a column can never come back from the database with nothing on it.
export function panelsFrom(saved: string[] | undefined): PanelId[] {
  const kept = PANEL_ORDER.filter((p) => saved?.includes(p));
  return kept.length ? kept : [...DEFAULT_PANELS];
}

// §3: the remove control is disabled, never hidden, once it is the only panel left.
// Expressed here rather than in each column so all four can only ever agree.
export function canRemovePanel(panels: PanelId[]): boolean {
  return panels.length > 1;
}

export function addPanel(panels: PanelId[], id: PanelId): PanelId[] {
  return PANEL_ORDER.filter((p) => p === id || panels.includes(p));
}

export function removePanel(panels: PanelId[], id: PanelId): PanelId[] {
  if (!canRemovePanel(panels)) return panels;
  return panels.filter((p) => p !== id);
}

// --------------------------------------------------------------- the measures
//
// A measure is "which data", orthogonal to the panels' "how do I want to look at it"
// (§4.1). One descriptor carries everything the panels need to render it, so adding a
// measure never means editing four columns.

export type MeasureId = "entries" | "points" | "threshold";

export type Measure = {
  id: MeasureId;
  label: string;
  // How the column's own "% change in {…}" Add row reads.
  changeLabel: string;
  format: (value: number) => string;
  // Deltas carry their own unit: a point score differs by points, a rate by percentage
  // POINTS, which is a different statement from a percentage and reads wrong as one.
  formatDelta: (delta: number) => string;
  // The axis rounds to this, so a 0-100 rate does not get a 0.5 step and a points scale
  // does not get a 10 one.
  axisStep: number;
  // Combining several subjects into one "All subjects" line. Entries sum (two subjects'
  // candidates really do add up); scores and rates mean (summing average point scores
  // across subjects describes nothing real).
  aggregate: "sum" | "mean";
  // The trend summary's noun phrase: "… has grown" reads off this.
  noun: string;
  // A fixed top of scale where one exists, for the bar views. null = scale to the data.
  barScaleMax: number | null;
};

// GCSE grades run 9-1 and post-16 points per entry top out at 60 (A*), the same two
// scales onboarding step 3 already draws against.
export function pointsScaleMax(phase: TeacherPhase): number {
  return phase === "ks4" ? 9 : 60;
}

// The threshold measure is a different question at each phase, because the grade scale
// is: KS4 publishes 9-1, so "grade 4 or above" is the real, universally-cited bar; at
// KS5 the A-level family runs A*-E, where the equivalent statement is "graded at all"
// (§6.5). KS2 has no per-subject grades and no measure switcher.
export function thresholdLabel(phase: TeacherPhase): string {
  return phase === "ks5" ? "A*–E rate" : "Grade 4+ rate";
}

export function measuresFor(phase: TeacherPhase): Measure[] {
  const points: Measure = {
    id: "points",
    label: "Average point score",
    changeLabel: "% change in average point score",
    format: (v) => v.toFixed(1),
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`,
    axisStep: phase === "ks4" ? 0.5 : 5,
    aggregate: "mean",
    noun: "average point score",
    barScaleMax: pointsScaleMax(phase),
  };
  const threshold: Measure = {
    id: "threshold",
    label: thresholdLabel(phase),
    changeLabel: `% change in ${thresholdLabel(phase).toLowerCase()}`,
    format: (v) => `${Math.round(v)}%`,
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}pp`,
    axisStep: 5,
    aggregate: "mean",
    noun: thresholdLabel(phase).toLowerCase(),
    barScaleMax: 100,
  };
  return [points, threshold];
}

export const ENTRIES_MEASURE: Measure = {
  id: "entries",
  label: "Candidates",
  changeLabel: "% change in candidate numbers",
  format: (v) => Math.round(v).toLocaleString(),
  formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d)).toLocaleString()}`,
  axisStep: 10,
  aggregate: "sum",
  noun: "number of candidates",
  barScaleMax: null,
};

// The two measures the switcher shows but cannot select (§4.1). Present rather than
// hidden, so their absence reads as a known gap rather than an omission nobody noticed
// -- both need a distribution per subject, not one number, which is its own design
// problem once the data exists.
export const COMING_SOON_MEASURES: { id: string; label: string }[] = [
  { id: "bands", label: "Grade bands" },
  { id: "counts", label: "Grade counts" },
];

// Comparisons compares SCHOOLS, so its measure is the phase's whole-school headline
// (Attainment 8 at KS4, A-level points per entry at Post-16, the expected-standard
// percentage at KS2), not a per-subject one. Its label comes from HEADLINE_LABEL via the
// dashboard route, so the card, the map and this all name the same figure.
export function headlineMeasure(phase: TeacherPhase, label: string): Measure {
  const isPercent = phase === "ks2";
  return {
    id: "points",
    label: isPercent ? "Expected standard" : phase === "ks4" ? "Attainment 8" : "Average point score",
    changeLabel: `% change in ${label}`,
    format: (v) => (isPercent ? `${Math.round(v)}%` : v.toFixed(1)),
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${isPercent ? `${Math.abs(Math.round(d))}pp` : Math.abs(d).toFixed(1)}`,
    axisStep: 5,
    aggregate: "mean",
    noun: label,
    barScaleMax: isPercent ? 100 : null,
  };
}

export function measureById(phase: TeacherPhase, id: string | undefined): Measure {
  const all = [ENTRIES_MEASURE, ...measuresFor(phase)];
  return all.find((m) => m.id === id) ?? all[0];
}

// ------------------------------------------------------------------ the series

// One plotted line or bar group: real periods, and a value per period that may genuinely
// be missing. Nulls stay null all the way to the renderer -- "no published figure" and
// "zero" are different statements and only one of them is ever true.
export type PanelSeries = {
  key: string;
  label: string;
  colour: string;
  values: (number | null)[];
  // The comparison group's line rather than your own: drawn dashed grey (§4.2, §4.3).
  comparison?: boolean;
};

export type PanelData = {
  periods: number[];
  series: PanelSeries[];
};

export function meanOf(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null);
  return real.length ? real.reduce((a, b) => a + b, 0) / real.length : null;
}

export function sumOf(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null);
  return real.length ? real.reduce((a, b) => a + b, 0) : null;
}

export function combine(values: (number | null)[], how: "sum" | "mean"): number | null {
  return how === "sum" ? sumOf(values) : meanOf(values);
}

// ------------------------------------------------------- real year ranges (§6.3)
//
// Resolved decision: no hardcoded start year anywhere. Both wireframe ranges (2018/19 on
// Comparisons, 2019/20 on the other three) were placeholder constants in a mock array,
// never real -- so the columns are reconciled by deriving the range instead of by picking
// one of two invented ones. Each From:/Since: control offers exactly the periods that
// school, measure and subject genuinely have a figure for, which is also why the
// inconsistency cannot come back.

// Periods where at least one plotted series has a real value, ascending.
export function periodsWithData(data: PanelData): number[] {
  return data.periods.filter((_, i) => data.series.some((s) => s.values[i] !== null));
}

// Drop the leading and trailing periods where NOTHING is published, so a panel's first
// period is a period it can actually draw.
//
// Round 7 §7, the real bug this fixes. `academic_subject_headline` has rows for 2020/21 --
// entries were recorded -- but `avg_point_score` is null for every school and every
// subject that year, nationwide: 2020/21 GCSE grades were teacher-assessed and DfE never
// published average point scores for that cohort. So every Results trend arrived here
// with a leading null, and everything that read `periods[0]` -- the panel's own tag, the
// "From:" pill, and the narrative's "since <year>" -- named 2020/21 as the start of a
// series that genuinely begins in 2021/22.
//
// Note what was NOT wrong: the values. `endpoints()` has always skipped nulls, so the
// figures either side of "grown from X to Y" were real. It was the period they were
// attributed to that was not, which is its own kind of wrong -- a 2021/22 figure labelled
// 2020/21 is not a real fact about 2020/21.
//
// Fixed here, once, rather than in each column: all three panel sets build their series
// through this, so the tag, the pill, the axis and the sentence cannot disagree about
// where a series starts. Interior gaps are LEFT ALONE -- a missing middle year is real
// and TrendChart draws it as a break in the line.
export function trimToData(data: PanelData): PanelData {
  const real = data.periods.map((_, i) => data.series.some((s) => s.values[i] !== null));
  const first = real.indexOf(true);
  if (first === -1) return { periods: [], series: data.series.map((s) => ({ ...s, values: [] })) };
  const last = real.lastIndexOf(true);
  return {
    periods: data.periods.slice(first, last + 1),
    series: data.series.map((s) => ({ ...s, values: s.values.slice(first, last + 1) })),
  };
}

// The start years a From:/Since: control can offer. A range needs two points to be a
// range, so the last period is never a valid start -- picking it would draw a single dot
// and describe a change over no elapsed time.
export function startOptions(periods: number[]): number[] {
  return periods.slice(0, Math.max(0, periods.length - 1));
}

// Cycling wraps, as the wireframe's pills do. Returns the next start period, or null when
// there is nothing to cycle through.
export function nextStart(periods: number[], current: number | null): number | null {
  const options = startOptions(periods);
  if (options.length === 0) return null;
  const at = current === null ? -1 : options.indexOf(current);
  return options[(at + 1) % options.length];
}

// The data from `start` onwards. Everything downstream (the chart, the summary, the
// source line) reads this one slice, so the picture and the sentence can never describe
// different spans.
export function sliceFrom(data: PanelData, start: number | null): PanelData {
  if (start === null) return data;
  const at = data.periods.indexOf(start);
  if (at <= 0) return data;
  return {
    periods: data.periods.slice(at),
    series: data.series.map((s) => ({ ...s, values: s.values.slice(at) })),
  };
}

// ------------------------------------------------------------- trend arithmetic

export function leastSquares(values: (number | null)[]): { slope: number; intercept: number } | null {
  const points = values.map((v, i) => ({ x: i, y: v })).filter((p): p is { x: number; y: number } => p.y !== null);
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  return { slope, intercept: (sumY - slope * sumX) / n };
}

export type Direction = "up" | "down" | "flat";

// ±4% is the wireframe's own threshold for calling a trend rather than reading noise as
// one, kept as-is rather than re-invented here.
const FLAT_BAND_PERCENT = 4;

export function classifyChange(percent: number | null): Direction {
  if (percent === null) return "flat";
  if (percent > FLAT_BAND_PERCENT) return "up";
  if (percent < -FLAT_BAND_PERCENT) return "down";
  return "flat";
}

// First and last REAL values, not first and last slots: a series that starts with a gap
// would otherwise report a change from nothing.
export function endpoints(values: (number | null)[]): { first: number; last: number } | null {
  const real = values.filter((v): v is number => v !== null);
  return real.length >= 2 ? { first: real[0], last: real[real.length - 1] } : null;
}

export function percentChange(values: (number | null)[]): number | null {
  const ends = endpoints(values);
  if (!ends || ends.first === 0) return null;
  return ((ends.last - ends.first) / ends.first) * 100;
}

export const DIRECTION_WORD: Record<Direction, string> = { up: "Growing", down: "Declining", flat: "Broadly stable" };
export const DIRECTION_ARROW: Record<Direction, string> = { up: "↑", down: "↓", flat: "→" };
export const DIRECTION_VERB: Record<Direction, string> = { up: "grown", down: "fallen", flat: "stayed roughly level" };
export const DIRECTION_NOUN: Record<Direction, string> = { up: "rise", down: "fall", flat: "change" };

// "a 5% rise" / "an 8% rise". Covers the 8-, 11- and 18- leads, which is every case a
// percentage in this range actually hits.
export function article(n: number): string {
  const s = String(Math.abs(n));
  return s[0] === "8" || s.slice(0, 2) === "11" || s.slice(0, 2) === "18" ? "an" : "a";
}

// The Trend panel's sentence, built once here so all four columns phrase it identically:
// "<subject clause> has <verb> from X to Y; a Z% <noun> since <year>."
export function trendSentence({
  subjectClause,
  values,
  measure,
  startLabel,
}: {
  subjectClause: string;
  values: (number | null)[];
  measure: Measure;
  startLabel: string;
}): { direction: Direction; sentence: string } | null {
  const ends = endpoints(values);
  if (!ends) return null;
  const percent = percentChange(values);
  const direction = classifyChange(percent);
  const pct = percent === null ? null : Math.abs(Math.round(percent));
  const tail = pct === null ? "" : `; ${article(pct)} ${pct}% ${DIRECTION_NOUN[direction]} since ${startLabel}`;
  return {
    direction,
    sentence: `${subjectClause} has ${DIRECTION_VERB[direction]} from ${measure.format(ends.first)} to ${measure.format(ends.last)}${tail}.`,
  };
}
