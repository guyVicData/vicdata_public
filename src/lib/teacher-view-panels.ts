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
import { MODERN_GRADE_FROM } from "./grade-rows";

// ---------------------------------------------------------------- the panels

// Trends row merge round (Guy's two-row reorg): Trend and % change are one "Trends" panel
// now -- every table, chart, list and map from both behind one view rail -- so a column has
// two panels, Current above Trends. A saved "change" id (an old open % change panel) is
// simply dropped by panelsFrom's filter; that panel's views now live in "trend".
export type PanelId = "current" | "trend";

// Render order on the card -- the wireframe's own order (Main.dc.html), not alphabetical.
export const PANEL_ORDER: readonly PanelId[] = ["current", "trend"] as const;

// Content round S10: every column always has all three panels, each OPEN or collapsed to a
// header bar ("so teacher builds complexity"). The accordion round made them a standard
// accordion -- one open at a time (see togglePanel). What is stored per column is
// the set of OPEN panels -- the same key and the same list the Add/remove mechanism
// stored as the set of PRESENT panels, which is what makes the change safe for saved
// state: anything someone had added comes back open, and nothing they kept disappears.
//
// A column nobody has touched opens Current alone. Deliberately the SAME shape
// resetColumn already uses (the column's key absent from `columns`), so "never
// customised" and "reset" stay one state rather than drifting into two -- see
// teacher-view-data.ts's own note on that.
export const DEFAULT_PANELS: readonly PanelId[] = ["current"] as const;

export function isPanelId(value: string): value is PanelId {
  return (PANEL_ORDER as readonly string[]).includes(value);
}

// The panels a column has OPEN, in PANEL_ORDER. Anything saved that is not a panel id is
// ignored. Absent = the default. An empty list is now a real state -- every panel
// collapsed -- where under Add/remove it could not arise.
export function panelsFrom(saved: string[] | undefined): PanelId[] {
  if (!saved) return [...DEFAULT_PANELS];
  return PANEL_ORDER.filter((p) => saved.includes(p));
}

// Opening a closed panel makes it the only open one; opening the open one closes it.
// A standard accordion, not S10's independent-toggle model -- see the round's own
// note on why: a wider panel with only one thing in it draws a much better chart.
// (Guy, accordion round: "opening one panel closes the other two -- and the height of the
// open one can therefore expand substantially.") The stored open set is now always zero or
// one panel; a set saved under S10 with two or three open still reads, and the next click
// in that column settles it to one. Nothing needs migrating.
export function togglePanel(open: PanelId[], id: PanelId): PanelId[] {
  return open.includes(id) ? open.filter((p) => p !== id) : [id];
}

// --------------------------------------------------------------- the measures
//
// A measure is "which data", orthogonal to the panels' "how do I want to look at it"
// (§4.1). One descriptor carries everything the panels need to render it, so adding a
// measure never means editing four columns.

// "bands": the share of entries inside a teacher-chosen grade range (a rate, like
// threshold, once a range is picked). "counts": the whole grade distribution -- no single
// figure, so the panels that plot one number never receive it; Column 1 draws it with its
// own distribution views (GradeCountsPanels), and Context and Comparisons fall back.
export type MeasureId = "entries" | "points" | "threshold" | "bands" | "counts";

// R-NUMBER-TYPE-HONESTY (catalogue §3; S3b, Guy's decision 3): how a change over time is
// honestly stated for a measure. Counts (entries, grade counts) change by a PERCENTAGE;
// an average point score changes by POINTS; a rate (Grade 4+ / A*-E, a grade band, KS2's
// expected standard) by PERCENTAGE POINTS -- 60% -> 66% is +6pp, not +10%.
export type ChangeKind = "percent" | "points" | "pp";

export type Measure = {
  id: MeasureId;
  label: string;
  // "change in average point score, in points" -- the measure's own change phrase.
  changeLabel: string;
  // R-NUMBER-TYPE-HONESTY: the only change this measure is shown in (changeOf, formatChange).
  changeKind: ChangeKind;
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
    // C3 (catalogue doc §3, decided): one term, "points" -- the switcher says "Average
    // points", and so does every title built from this label.
    label: "Average points",
    changeLabel: "change in average points, in points",
    changeKind: "points",
    format: (v) => v.toFixed(1),
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`,
    axisStep: phase === "ks4" ? 0.5 : 5,
    aggregate: "mean",
    noun: "average points",
    barScaleMax: pointsScaleMax(phase),
  };
  const threshold: Measure = {
    id: "threshold",
    label: thresholdLabel(phase),
    changeLabel: `change in ${thresholdLabel(phase).toLowerCase()}, in percentage points`,
    changeKind: "pp",
    format: (v) => `${Math.round(v)}%`,
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}pp`,
    axisStep: 5,
    aggregate: "mean",
    noun: thresholdLabel(phase).toLowerCase(),
    barScaleMax: 100,
  };
  // Grade bands and counts (grade bands frontend round): the range and its label are
  // chosen on the dashboard, which narrows `noun` to the span ("share of entries at grades
  // 7–9"); these are the measures as the switcher lists them.
  const bands: Measure = {
    id: "bands",
    label: "Grade bands",
    changeLabel: "change in the share at the chosen grades, in percentage points",
    changeKind: "pp",
    format: (v) => `${Math.round(v)}%`,
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}pp`,
    axisStep: 5,
    aggregate: "mean",
    noun: "share of entries at the chosen grades",
    barScaleMax: 100,
  };
  const counts: Measure = {
    id: "counts",
    label: "Grade counts",
    changeLabel: "% change in entries at each grade",
    changeKind: "percent",
    format: (v) => Math.round(v).toLocaleString(),
    formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d)).toLocaleString()}`,
    axisStep: 10,
    aggregate: "sum",
    noun: "entries at each grade",
    barScaleMax: null,
  };
  return [points, threshold, bands, counts];
}

export const ENTRIES_MEASURE: Measure = {
  id: "entries",
  label: "Candidates",
  changeLabel: "% change in candidate numbers",
  changeKind: "percent",
  format: (v) => Math.round(v).toLocaleString(),
  formatDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d)).toLocaleString()}`,
  axisStep: 10,
  aggregate: "sum",
  noun: "number of candidates",
  barScaleMax: null,
};

// Measures the switcher shows but cannot select yet (§4.1), greyed and tagged. Empty since
// the grade bands frontend round made Grade bands and Grade counts real; kept so the next
// not-yet-real measure has a place to go.
export const COMING_SOON_MEASURES: { id: string; label: string }[] = [];

// Comparisons compares SCHOOLS, so its measure is the phase's whole-school headline
// (Attainment 8 at KS4, A-level points per entry at Post-16, the expected-standard
// percentage at KS2), not a per-subject one. Its label comes from HEADLINE_LABEL via the
// dashboard route, so the card, the map and this all name the same figure.
export function headlineMeasure(phase: TeacherPhase, label: string): Measure {
  const isPercent = phase === "ks2";
  return {
    id: "points",
    label: isPercent ? "Expected standard" : phase === "ks4" ? "Attainment 8" : "Average point score",
    changeLabel: isPercent ? `change in ${label}, in percentage points` : `change in ${label}, in points`,
    changeKind: isPercent ? "pp" : "points",
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
  // R-TREND-FROM-2223 (0.6.2 S4b): on a grade or points trend, the year its statements are
  // measured from -- the change column, a fitted line, a short span's change bars -- while
  // every period is still drawn. Absent / null = from the first year shown, as before.
  statementFrom?: number | null;
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
// R-PERIOD-TRIM
export function trimToData(data: PanelData): PanelData {
  const real = data.periods.map((_, i) => data.series.some((s) => s.values[i] !== null));
  const first = real.indexOf(true);
  const keep = data.statementFrom === undefined ? {} : { statementFrom: data.statementFrom };
  if (first === -1) return { periods: [], series: data.series.map((s) => ({ ...s, values: [] })), ...keep };
  const last = real.lastIndexOf(true);
  return {
    periods: data.periods.slice(first, last + 1),
    series: data.series.map((s) => ({ ...s, values: s.values.slice(first, last + 1) })),
    ...keep,
  };
}

// The start years a "From {year}" menu can offer (FromYearMenu). A range needs two points to be a
// range, so the last period is never a valid start -- picking it would draw a single dot
// and describe a change over no elapsed time.
export function startOptions(periods: number[]): number[] {
  return periods.slice(0, Math.max(0, periods.length - 1));
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
    ...(data.statementFrom === undefined ? {} : { statementFrom: data.statementFrom }),
  };
}

// ------------------------------------------- trends measured from 2022/23 (R-TREND-FROM-2223)
//
// 0.6.2 S4b (Guy, 6 Oct 2026): 2021/22 was graded more generously (Ofqual's transition year),
// so a grade or points trend still DRAWS it, but says nothing measured from it. The base year
// and which measures follow the rule are src/catalogue/notes.ts's (trendBaseFor); these apply
// it to a panel's data. `base` null = the rule doesn't apply (entries, KS2): data unchanged.

/** A Trend half's data, marked to be measured from `base` where it draws an earlier year. */
export function withTrendBase(data: PanelData, base: number | null): PanelData {
  if (base === null || !data.periods.some((p) => p < base)) return data;
  return { ...data, statementFrom: base };
}

/** The span a trend's statements are measured over: `data` from its statementFrom on. */
export function statementSpan(data: PanelData): PanelData {
  const from = data.statementFrom;
  if (from === null || from === undefined) return data;
  const at = data.periods.findIndex((p) => p >= from);
  if (at <= 0) return at === 0 ? data : { periods: [], series: data.series.map((s) => ({ ...s, values: [] })) };
  return { periods: data.periods.slice(at), series: data.series.map((s) => ({ ...s, values: s.values.slice(at) })) };
}

/** One series' values with every year before `from` left out (null), so the positions still
 * line up with the drawn periods -- what a fitted line or a change column counts. */
export function countedValues(values: (number | null)[], periods: number[], from: number | null | undefined): (number | null)[] {
  if (from === null || from === undefined) return values;
  return values.map((v, i) => (periods[i] !== undefined && periods[i] < from ? null : v));
}

// ------------------------------- latest-year grade views from 2023/24 (R-CURRENT-GRADES-FROM-2324)
//
// 0.6.2 S4b (Guy, 6 Oct 2026): school grade rows reach back to 2021/22 for the trends, but a
// latest-year view on a grade measure (Grade 4+ / A*-E, Grade bands, Grade counts) reads the
// 2023/24-on rows only, as before -- its subject list, its "vs last year" and its year menu
// stay exactly as they were. (The band scale already does: TeacherDashboard's focusScale.)

/** The first year a latest-year view on this measure reads, or null (points, entries: all). */
export function latestYearFrom(measureId: string): number | null {
  return measureId === "threshold" || measureId === "bands" || measureId === "counts" ? MODERN_GRADE_FROM : null;
}

/** Each series with its years before `from` left out (null), and any that then has no figure
 * at all dropped -- except the focused one, which always stays (R-FOCUS-NEVER-FILTERED). */
export function latestYearSeries<S extends { key: string; values: (number | null)[] }>(series: S[], periods: number[], from: number | null, focusKey: string | null): S[] {
  if (from === null) return series;
  return series
    .map((s) => ({ ...s, values: countedValues(s.values, periods, from) }))
    .filter((s) => s.key === focusKey || s.values.some((v) => v !== null));
}

// --------------------------------------------------- how a trend is drawn (§4)
//
// Round 7 §4: a trend with three real years or fewer is drawn as bars, four or more as a
// line. A line through two or three points overstates the precision a short series has --
// it draws a trajectory between them that nobody measured -- where bars simply state each
// year's figure and leave the reading to the person.
//
// This is a real threshold, not a hint, and the two measures either side of it are real:
// average point score genuinely has four years (2021/22 on, since DfE published no point
// scores for the teacher-assessed 2020/21 cohort), while the threshold measure genuinely
// has two (2023/24 on). Same column, same card, two different DfE datasets.
// R-TREND-LINE-4YR
export const TREND_LINE_MIN_YEARS = 4;

export function trendChartKind(data: PanelData): "bars" | "line" {
  return periodsWithData(data).length >= TREND_LINE_MIN_YEARS ? "line" : "bars";
}

// Ranking a comparator set on whatever figure is active (round 7 §9). Schools with no
// published figure are left UNRANKED rather than placed last: "no data" is not a
// position, and giving it one would let a school with nothing published appear to beat
// one with a genuinely low score.
//
// Ties share a position and the next rank skips accordingly -- two schools 3rd means the
// next is 5th -- because the alternative is telling two identical schools that one of
// them is better.
// R-RANK-TIES, R-COMPARATOR-NO-FIGURE (never ranked last).
export function rankByValue(rows: { key: string; value: number | null }[]): Map<string, number> {
  const placed = rows.filter((r) => r.value !== null).sort((a, b) => b.value! - a.value!);
  const ranks = new Map<string, number>();
  placed.forEach((r, i) => {
    const previous = placed[i - 1];
    ranks.set(r.key, previous && previous.value === r.value ? ranks.get(previous.key)! : i + 1);
  });
  return ranks;
}

// R-PREV-YEAR-FALLBACK, R-SAME-YEAR-BENCH: Current's rows for the year at `latestIdx`, each
// with its delta. Against the benchmark for the SAME year where the measure has one
// (`hasBenchmark`); otherwise against the subject's own previous published year, which is
// the other real comparison available -- never a column of dashes. (Lifted verbatim from
// SubjectPanels in 0.6 S2.)
export function currentRowsWithDelta<S extends { values: (number | null)[]; benchmark?: (number | null)[] }>(
  subjects: S[],
  latestIdx: number,
  hasBenchmark: boolean,
): { s: S; value: number | null; bench: number | null; delta: number | null }[] {
  const previousValue = (s: S): number | null => {
    for (let i = latestIdx - 1; i >= 0; i--) if (s.values[i] !== null) return s.values[i];
    return null;
  };
  return subjects.map((s) => {
    const value = latestIdx >= 0 ? s.values[latestIdx] : null;
    const bench = latestIdx >= 0 ? s.benchmark?.[latestIdx] ?? null : null;
    const against = hasBenchmark ? bench : previousValue(s);
    const delta = value !== null && against !== null ? value - against : null;
    return { s, value, bench, delta };
  });
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
// R-TREND-FLAT-4PCT
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

// ------------------------------------------------- honest change (R-NUMBER-TYPE-HONESTY)
//
// S3b (Guy's decision 3): every change view -- ranked change lists, change tables, change
// maps, their titles and summaries -- states a change in the measure's own honest type.
// Counts keep % change; points and rates show the absolute difference first -> last.

/** R-NUMBER-TYPE-HONESTY: the change over a span, first to last REAL value, in the measure's honest type. */
export function changeOf(measure: Pick<Measure, "changeKind">, values: (number | null)[]): number | null {
  if (measure.changeKind === "percent") return percentChange(values);
  const ends = endpoints(values);
  return ends ? ends.last - ends.first : null;
}

/**
 * R-NUMBER-TYPE-HONESTY: a change printed with its sign, in the measure's own delta format:
 * "+5%" (a count, exactly as the % views always printed it), "+0.4" (points), "+3pp" (a
 * rate). A points or pp change that rounds to nothing prints unsigned ("0.0", "0pp"),
 * never "−0.0".
 */
export function formatChange(measure: Pick<Measure, "changeKind" | "formatDelta">, value: number): string {
  if (measure.changeKind === "percent") return `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value))}%`;
  const printed = measure.formatDelta(value);
  return /^[+−]0(\.0+)?(pp)?$/.test(printed) ? printed.slice(1) : printed;
}

/** R-NUMBER-TYPE-HONESTY: a change's size in words, unsigned: "5%", "0.4 points", "3 percentage points". */
export function changeMagnitude(measure: Pick<Measure, "changeKind">, value: number): string {
  const v = Math.abs(value);
  if (measure.changeKind === "percent") return `${Math.round(v)}%`;
  if (measure.changeKind === "points") return `${v.toFixed(1)} ${v.toFixed(1) === "1.0" ? "point" : "points"}`;
  return `${Math.round(v)} ${Math.round(v) === 1 ? "percentage point" : "percentage points"}`;
}

/** R-NUMBER-TYPE-HONESTY: what a change view is titled: "% change", "Change in points", "Change in percentage points". */
export function changeTitle(measure: Pick<Measure, "changeKind">): string {
  return measure.changeKind === "percent" ? "% change" : measure.changeKind === "points" ? "Change in points" : "Change in percentage points";
}

/**
 * R-NUMBER-TYPE-HONESTY: a change view's title over one named figure: "% change in
 * entries since 2021/22"; "Change in Attainment 8 since 2021/22, in points"; "Change in
 * grade 4+ rate since 2023/24, in percentage points".
 */
export function changeInTitle(measure: Pick<Measure, "changeKind">, what: string, since: string): string {
  if (measure.changeKind === "percent") return `% change in ${what} since ${since}`;
  return `Change in ${what} since ${since}, in ${measure.changeKind === "points" ? "points" : "percentage points"}`;
}

/** changeTitle mid-sentence: "% change", "change in points", "change in percentage points". */
export function changePhrase(measure: Pick<Measure, "changeKind">): string {
  const t = changeTitle(measure);
  return t.charAt(0).toLowerCase() + t.slice(1);
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
// "<subject clause> has <verb> from X to Y; a Z% <noun> since <year>." -- on points and
// rates "...; a <noun> of 0.4 points / 3 percentage points since <year>." (S3b).
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
  // The direction word keeps R-TREND-FLAT-4PCT's ±4% band on the relative change; the
  // figure printed is the measure's honest change (R-NUMBER-TYPE-HONESTY, S3b).
  const direction = classifyChange(percent);
  const pct = percent === null ? null : Math.abs(Math.round(percent));
  const tail =
    measure.changeKind === "percent"
      ? pct === null ? "" : `; ${article(pct)} ${pct}% ${DIRECTION_NOUN[direction]} since ${startLabel}`
      : `; a ${DIRECTION_NOUN[direction]} of ${changeMagnitude(measure, ends.last - ends.first)} since ${startLabel}`;
  return {
    direction,
    sentence: `${subjectClause} has ${DIRECTION_VERB[direction]} from ${measure.format(ends.first)} to ${measure.format(ends.last)}${tail}.`,
  };
}
