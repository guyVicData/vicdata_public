// VicData 0.6.1 S3: the series builder for a comparisons frame -- Column 3 (ComparisonsPanels'
// data: each school's figure per period in the page's comparison set). Line, table and bar.
import type { BarLook, CompareSeries, LineLook, TableLook, ViewSpec } from "@/catalogue/viewspec";
import { changeInTitle, changeOf, meanOf, sliceFrom, statementSpan, trendChartKind, trimToData, withTrendBase, type PanelData } from "@/lib/teacher-view-panels";
import { trendBaseFor } from "@/catalogue/notes";
import { rankedComparisons } from "@/lib/teacher-view-comparisons";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { onChangeHalf, resolveCompare } from "./compare";
import { compareLinesFor, type CompareLine } from "./compare-lines";
import { comparisonsLeadTitle, type ComparisonsFrame } from "./frames";
import { averageOfShown, fitOn, orderRows, topTen } from "./looks";
import type { ViewSeries } from "./series";
import { subjectChangeRows, subjectChangeTableSeries } from "@/lib/subject-ranking-view";

const OWN = "var(--accent,var(--fg))";
const OTHER = "var(--muted3)";

export function basics(f: ComparisonsFrame) {
  const target = f.schools.find((s) => s.isTarget) ?? null;
  const others = f.schools.filter((s) => !s.isTarget);
  const latestIdx = (() => {
    for (let i = f.periods.length - 1; i >= 0; i--) if (f.schools.some((s) => s.values[i] !== null)) return i;
    return -1;
  })();
  const latest = latestIdx >= 0 ? f.periods[latestIdx] : null;
  const setNoun = f.setLabel.toLowerCase();
  return { target, others, latestIdx, latest, setNoun };
}

// The "vs:" line: one named school, a ranking's own population average, or the set's
// average over the schools with a figure that year (so a school joining or leaving the
// published data doesn't read as the set moving).
function versusValues(f: ComparisonsFrame, b: ReturnType<typeof basics>): (number | null)[] {
  const school = b.others.find((s) => s.urn === f.versus.urn);
  if (school) return school.values;
  if (f.onRankingMeasure && f.ranking) return f.periods.map((p) => f.ranking!.averageAt(p));
  return f.periods.map((_, i) => meanOf(b.others.map((s) => s.values[i])));
}

// The school and its comparison over the set's years (ComparisonsPanels' `full`), and every
// school's row over the same years. `own`: a spec of its own's compare lines (S3c) in place
// of the page's "vs:" line.
export function series(f: ComparisonsFrame, compare: CompareSeries[], own?: CompareLine[]) {
  const b = basics(f);
  const withVersus = !own && compare.some((c) => (c.as ?? "line") === "line" && (c.kind === "chosenSchool" || c.kind === f.setKind || c.kind === "nearest" || c.kind === "savedSet"));
  // R-TREND-FROM-2223: every year drawn; a grade or points trend's statements from 2022/23.
  const full = withTrendBase(
    trimToData({
      periods: f.periods,
      series: [
        { key: "own", label: "Your school", colour: OWN, values: b.target ? b.target.values : [] },
        ...(withVersus ? [{ key: "versus", label: f.versus.label, colour: OTHER, values: versusValues(f, b) }] : []),
        ...(own ?? []),
      ],
    }),
    trendBaseFor(f.measure.id, f.phase),
  );
  const everySchool: PanelData = {
    periods: full.periods,
    ...(full.statementFrom === undefined ? {} : { statementFrom: full.statementFrom }),
    series: f.schools.map((s) => ({
      key: s.isTarget ? "own" : s.urn,
      label: s.name,
      colour: s.isTarget ? OWN : OTHER,
      values: full.periods.map((p) => s.values[f.periods.indexOf(p)] ?? null),
    })),
  };
  return { b, full, everySchool };
}

// R-TREND-FROM-2223: the % change half's span as drawn (2021/22 too), and what its changes are
// measured over (2022/23 on, on a grade or points measure; `data` carries statementFrom).
export const changeDrawn = (f: ComparisonsFrame, data: PanelData): PanelData => sliceFrom(data, f.state.changeStart);
export const changeSpan = (f: ComparisonsFrame, data: PanelData): PanelData => statementSpan(changeDrawn(f, data));

// The page's own "vs:" line, which trims the set's years for every Trends view (the host's
// `full`), whatever a view itself compares with.
export const pageVersus = (f: ComparisonsFrame): CompareSeries[] => [
  f.versus.urn === "average" ? { kind: f.setKind, colour: "muted", as: "line", average: "mean" } : { kind: "chosenSchool", colour: "muted", as: "line" },
];

export function buildComparisons(spec: ViewSpec, f: ComparisonsFrame): ViewSeries | null {
  if (f.blocked || f.schools.length === 0) return null;
  const compare = resolveCompare(spec, f);
  const allRows = !!spec.data.rows;
  if (spec.view.kind === "line" && spec.data.per === "year") return line(spec.view.look, f, compare, allRows, spec.compare !== "follows-page");
  if (spec.view.kind === "table" && spec.data.per === "year") return table(spec, spec.view.look, f, compare, allRows);
  if (spec.view.kind === "bar" && spec.data.per === "school") {
    if (spec.data.shownAs === "change") return changeBars(spec.view.look, f, compare, allRows);
    if ("latest" in spec.data.years) return currentBars(spec.view.look, f, allRows);
  }
  return null;
}

function currentBars(look: BarLook, f: ComparisonsFrame, allRows: boolean): ViewSeries {
  const b = basics(f);
  const valueAt = (urn: string) => (b.latestIdx >= 0 ? f.schools.find((s) => s.urn === urn)?.values[b.latestIdx] ?? null : null);
  const titleSet = `the ${b.setNoun}`;
  const highlight = look.highlight !== false;
  const common = { leaf: "rowBars" as const, measure: f.measure, scaleMax: f.measure.barScaleMax ?? undefined, spacious: !!look.spacious, values: look.values !== false, centred: null };
  if (f.onRankingMeasure && f.ranking) {
    // A ranking, on its own measure: the school against the whole population's average.
    return {
      kind: "bar",
      heading: null,
      title: comparisonsLeadTitle(f) ?? `${f.titleOn}: ${f.targetName} against ${titleSet}'s average`,
      leaf: {
        ...common,
        rows: [
          ...(b.target ? [{ label: f.targetName, value: valueAt(b.target.urn), isSubject: true, color: OWN, emphasis: highlight }] : []),
          { label: "Set average", value: f.ranking.averageAt(b.latest), isSubject: false, color: OTHER, emphasis: false },
        ],
      },
    };
  }
  const ranked = rankedComparisons(f.schools, valueAt).filter((r) => allRows || r.isTarget);
  const ordered = look.order && look.order !== "highest" ? orderRows(ranked.map((r) => ({ key: r.urn, label: r.isTarget ? f.targetName : r.name, value: r.value, r })), look.order).map((x) => x.r) : ranked;
  const shown = look.top10 ? topTen(ordered.map((r) => ({ key: r.urn, r })), b.target?.urn ?? null).map((x) => x.r) : ordered;
  const weights = b.latestIdx >= 0 ? shown.map((r) => f.schools.find((s) => s.urn === r.urn)?.counts?.[b.latestIdx] ?? null) : null;
  const average = averageOfShown(look.average, shown.map((r) => r.value), weights && weights.some((w) => w !== null) ? weights : null, "schools") ?? undefined;
  return {
    kind: "bar",
    heading: null,
    title: comparisonsLeadTitle(f) ?? `${f.measure.id === "entries" ? "Entries" : "Results"} by school in ${titleSet}`,
    leaf: {
      ...common,
      // No benchmark marker: the other bars ARE the comparison; the school picked out.
      rows: shown.map((r) => ({
        label: r.isTarget ? f.targetName : r.name,
        value: r.value,
        isSubject: r.isTarget,
        color: r.isTarget && highlight ? OWN : OTHER,
        emphasis: r.isTarget && highlight,
      })),
      ...(average ? { average } : {}),
    },
  };
}

function line(look: LineLook, f: ComparisonsFrame, compare: CompareSeries[], allRows: boolean, explicit = false): ViewSeries {
  // S3c: a spec of its own draws its own compare lines (the set's mean / median / weighted
  // average, one named school -- compare-lines.ts); follows-page the page's "vs:" line.
  const own = explicit ? compareLinesFor(f, compare, { focusedKey: "own", span: true, as: ["line"] }) : undefined;
  const { full, everySchool, b } = series(f, compare, own);
  const trendData = sliceFrom(full, f.state.trendStart);
  // R-TREND-LINE-4YR, Comparisons' way: under four real years the panel is the table alone.
  if (look.shortSpan === "table" && trendChartKind(trendData) !== "line") return trendTable(f, everySchool, b.setNoun, {}, allRows);
  const first = explicit ? trendData.series.find((s) => s.key !== "own") : trendData.series.find((s) => s.key === "versus");
  const versus = first;
  const vsLabel = explicit ? first?.label ?? "" : f.versus.label;
  const vs = vsLabel.charAt(0).toLowerCase() + vsLabel.slice(1);
  return {
    kind: "line",
    heading: null,
    title: versus ? ["This school’s ", f.comparedOn, " against ", vs, ", year by year"] : ["This school’s ", f.comparedOn, ", year by year"],
    leaf: {
      leaf: "trendChart",
      data: trendData,
      measure: f.measure,
      focusKey: "own",
      showFit: fitOn(look.trendLine, f.state.showFit),
      ...(look.fromZero ? { fromZero: true } : {}),
      ...(look.endLabels ? { endLabels: true } : {}),
    },
  };
}

function tableShape(look: TableLook) {
  return {
    ...(look.yearColumns && look.yearColumns !== "first-latest" ? { yearColumns: look.yearColumns } : {}),
    // 0.6.3 S4: the view's own layout; absent = automatic.
    ...(look.years ? { years: look.years } : {}),
    ...(look.extra && !look.extra.includes("change") ? { showChange: false } : {}),
    ...(look.extra?.includes("rank") && !look.leadingRank ? { rankColumn: "always" as const } : {}),
    ...(look.sort === "listed" || (look.sort === "change" && !look.leadingRank) ? { initialSort: look.sort } : {}),
    ...(look.highlight === false ? { highlight: false } : {}),
    ...(look.colourChange === false ? { colourChange: false } : {}),
    ...(look.memberSort === false && !look.leadingRank ? { sortable: false } : {}),
    ...(look.leadingRank ? { leadingRank: true } : {}),
  };
}

// "n": the entries behind each school's latest figure, where the page has them.
function countsOf(f: ComparisonsFrame, data: PanelData): Record<string, number | null> | undefined {
  if (!f.schools.some((s) => s.counts)) return undefined;
  const last = data.periods[data.periods.length - 1];
  const at = f.periods.indexOf(last);
  return Object.fromEntries(f.schools.map((s) => [s.isTarget ? "own" : s.urn, at >= 0 ? s.counts?.[at] ?? null : null]));
}

function trendTable(f: ComparisonsFrame, everySchool: PanelData, setNoun: string, look: TableLook, allRows: boolean, keep: string[] = []): ViewSeries {
  const data = sliceFrom(allRows ? everySchool : { ...everySchool, series: everySchool.series.filter((s) => s.key === "own" || keep.includes(s.key)) }, f.state.trendStart);
  const counts = look.extra?.includes("n") ? countsOf(f, data) : undefined;
  return {
    kind: "table",
    heading: null,
    // 0.6.6: a ranking on the measure in view draws its window's schools, not every school.
    title: f.subjectRanking ? [f.subjectRanking.around, ": ", f.comparedOn, ", year by year"] : ["Every school in the ", setNoun, ": ", f.comparedOn, ", year by year"],
    leaf: { leaf: "yearTable", data, measure: f.measure, focusKey: "own", nameHeading: "School", ...tableShape(look), ...(counts ? { counts } : {}), centred: `trend-table:${data.periods.join(",")}:${data.series.length}` },
  };
}

function table(spec: ViewSpec, look: TableLook, f: ComparisonsFrame, compare: CompareSeries[], allRows: boolean): ViewSeries {
  void compare;
  const { everySchool, b, full } = series(f, pageVersus(f));
  if (!onChangeHalf(spec)) {
    // S3c: a spec of its own adds its compare series as labelled rows (no rank).
    const rows = spec.compare === "follows-page" ? [] : compareLinesFor(f, spec.compare, { focusedKey: "own", span: true });
    if (!rows.length) return trendTable(f, everySchool, b.setNoun, look, allRows);
    const withRows: PanelData = {
      ...everySchool,
      series: [...everySchool.series, ...rows.map((r) => ({ ...r, colour: OTHER, values: everySchool.periods.map((p) => r.values[f.periods.indexOf(p)] ?? null) }))],
    };
    const t = trendTable(f, withRows, b.setNoun, look, allRows, rows.map((r) => r.key));
    return t.leaf.leaf === "yearTable" ? { ...t, leaf: { ...t.leaf, showRank: false } } : t;
  }
  // 0.6.6: a ranking comparator's change table is the population change list's window at real
  // change ranks (ComparisonsPanels builds the same rows).
  const srChange = f.subjectRanking?.change ?? null;
  const target = f.schools.find((s) => s.isTarget) ?? null;
  const windowRows = srChange ? subjectChangeTableSeries(srChange.window, f.schools, f.periods, everySchool.periods, target?.urn ?? null, f.targetName, { own: OWN, other: OTHER }) : null;
  const changeTable = windowRows
    ? { ...everySchool, series: allRows ? windowRows : windowRows.filter((s) => s.key === "own") }
    : changeDrawn(f, allRows ? everySchool : { ...everySchool, series: everySchool.series.filter((s) => s.key === "own") });
  const changeData = changeSpan(f, full);
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";
  const counts = look.extra?.includes("n") ? countsOf(f, changeTable) : undefined;
  return {
    kind: "table",
    heading: null,
    title: f.subjectRanking ? [f.subjectRanking.around, ": ", changeSince, " against the latest year, ranked by change"] : ["Every school in the ", b.setNoun, ": ", changeSince, " against the latest year, ranked by change"],
    leaf: { leaf: "yearTable", data: changeTable, measure: f.measure, focusKey: "own", nameHeading: "School", ...tableShape(look), ...(counts ? { counts } : {}), centred: `change-table:${changeTable.periods.join(",")}:${changeTable.series.length}` },
  };
}

function changeBars(look: BarLook, f: ComparisonsFrame, compare: CompareSeries[], allRows: boolean): ViewSeries {
  // 0.6.6: a ranking on the measure in view -- the whole population's change from 2022/23,
  // in the window around the school at its real change ranks, against the population's average.
  if (f.subjectRanking) return subjectChangeBars(look, f, compare, allRows);
  // The span is the versus pair's (as the host trims it), whatever the bars compare with.
  const { everySchool, b, full } = series(f, pageVersus(f));
  const changeTable = changeSpan(f, everySchool);
  const changeData = changeSpan(f, full);
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";
  const rows = changeTable.series
    .filter((s) => allRows || s.key === "own")
    .map((s) => ({ key: s.key, label: s.label, colour: s.colour, value: changeOf(f.measure, s.values) }));
  // The set's average change (the mean per year over the other schools, as Trend's
  // "Average across" line) as the dashed reference.
  const reference = compare.some((c) => c.as === "reference" && (c.kind === f.setKind || c.kind === "nearest" || c.kind === "savedSet"));
  const averageChange = changeOf(
    f.measure,
    changeTable.periods.map((_, i) => meanOf(changeTable.series.filter((s) => s.key !== "own").map((s) => s.values[i]))),
  );
  const shown = look.top10 ? topTen(orderRows(rows, "highest"), "own") : rows;
  const average = averageOfShown(look.average, shown.map((r) => r.value), null, "schools") ?? undefined;
  return {
    kind: "bar",
    heading: null,
    title: [changeInTitle(f.measure, f.comparedOn, changeSince), ", ranked against the ", b.setNoun],
    leaf: {
      leaf: "changeList",
      rows: shown,
      focusKey: look.highlight === false ? null : "own",
      ...(reference ? { group: { label: `Average across ${b.setNoun}`, value: averageChange } } : {}),
      ...(average ? { average } : {}),
      format: f.measure.changeKind === "percent" ? "percent" : "change",
      measure: f.measure,
      ...(look.values === false ? { values: false } : {}),
      ...(look.order === "az" ? { order: "az" as const } : {}),
      centred: `change-list:${changeTable.periods.join(",")}:${changeTable.series.length}`,
    },
  };
}

function subjectChangeBars(look: BarLook, f: ComparisonsFrame, compare: CompareSeries[], allRows: boolean): ViewSeries {
  const sr = f.subjectRanking!;
  const target = f.schools.find((s) => s.isTarget) ?? null;
  const changeSince = sr.change ? academicYearLabel(sr.change.from) : "";
  const rows = sr.change ? subjectChangeRows(sr.change.window, f.schools, target?.urn ?? null, f.targetName, { own: OWN, other: OTHER }).filter((r) => allRows || r.key === "own") : [];
  const reference = compare.some((c) => c.as === "reference" && (c.kind === f.setKind || c.kind === "nearest" || c.kind === "savedSet"));
  return {
    kind: "bar",
    heading: null,
    title: [changeInTitle(f.measure, f.comparedOn, changeSince), ", ranked across ", sr.changePopulation],
    leaf: {
      leaf: "changeList",
      rows,
      focusKey: look.highlight === false ? null : "own",
      ...(reference && sr.change ? { group: { label: `Average across ${sr.changePopulation}`, value: sr.change.average } } : {}),
      format: f.measure.changeKind === "percent" ? "percent" : "change",
      measure: f.measure,
      ...(look.values === false ? { values: false } : {}),
      centred: `change-list:${rows.map((r) => r.key).join(",")}`,
    },
  };
}
