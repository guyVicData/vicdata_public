// VicData 0.6.1 S3: the series builder for a subjects frame -- Column 1 Results and Context
// (SubjectPanels' data). Line, table and bar.
//
// For a translated preset (compare "follows-page", the preset's own look) this produces
// exactly the props SubjectPanels hands its leaf today: the same lib calls on the same frame
// (currentRowsWithDelta, trimToData / sliceFrom, changeOf, tintInOrder / paletteInOrder), the
// same titles. A spec of its own (rows left out, its own compare, its own look) is drawn
// from the same frame by the same rules.
import type { BarLook, CompareSeries, LineLook, TableLook, ViewSpec } from "@/catalogue/viewspec";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import {
  changeOf,
  changePhrase,
  currentRowsWithDelta,
  periodsWithData,
  sliceFrom,
  trimToData,
  TREND_LINE_MIN_YEARS,
  statementSpan,
  withTrendBase,
  type PanelData,
  type PanelSeries,
} from "@/lib/teacher-view-panels";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { trendBaseFor } from "@/catalogue/notes";
import { FOCUS_COLOUR, paletteInOrder, shouldIndex, tintInOrder } from "@/lib/teacher-view-trend-styles";
import { onChangeHalf, resolveCompare } from "./compare";
import { compareLinesFor } from "./compare-lines";
import type { SubjectsFrame } from "./frames";
import { averageOfShown, fitOn, orderRows, topTen } from "./looks";
import type { BuildContext, ViewSeries } from "./series";

const hasLine = (d: PanelData) => periodsWithData(d).length >= TREND_LINE_MIN_YEARS;

// Everything SubjectPanels works out before it draws any view.
function basics(f: SubjectsFrame) {
  const { subjects, measure } = f;
  const focusedKey = (subjects.find((s) => s.key === f.focus) ?? subjects[0])?.key ?? null;
  const focusedSubject = subjects.find((s) => s.key === f.focus) ?? subjects[0];
  const redesigned = f.changeScope !== "all";
  const scopeNoun = measure.id === "entries" ? "Entries" : "Results";
  // The one title scope over every Trends view (SubjectPanels' `scope`).
  const scope =
    subjects.length > 1
      ? f.categoryLabel
        ? `${scopeNoun} in ${f.categoryLabel}`
        : f.benchmarkLabel && f.benchmarkLabel !== "National"
          ? `${scopeNoun} in ${f.benchmarkLabel.toLowerCase()}`
          : null
      : null;
  return { subjects, measure, focusedKey, focusedSubject, redesigned, scopeNoun, scope };
}

// Current's rows, in Current's order, and the colours every view reads from it.
export function currentRows(f: SubjectsFrame, hasBenchmark: boolean, highlight = true) {
  const b = basics(f);
  const rows = currentRowsWithDelta(f.subjects, f.state.latestIdx, hasBenchmark);
  const barRows = [...rows].sort((a, c) => (c.value ?? -Infinity) - (a.value ?? -Infinity));
  const keys = barRows.map((r) => r.s.key);
  const tints = tintInOrder(keys, highlight ? b.focusedKey : null, FOCUS_COLOUR);
  const colourFor = (s: SubjectsFrame["subjects"][number]) => (b.redesigned ? tints.get(s.key) ?? s.colour : s.colour);
  const trendColours = paletteInOrder(keys, b.focusedKey, FOCUS_COLOUR, f.theme === "light" ? PALETTE_LIGHT : PALETTE_DARK, f.accentHex);
  return { ...b, rows, barRows, colourFor, trendColours };
}

const hasCompare = (list: CompareSeries[], kind: string | null, as?: CompareSeries["as"]) =>
  !!kind && list.some((c) => c.kind === kind && (as === undefined || (c.as ?? "line") === as));

export function buildSubjects(spec: ViewSpec, f: SubjectsFrame, ctx: BuildContext): ViewSeries | null {
  const compare = resolveCompare(spec, f);
  const allRows = !!spec.data.rows;
  if (spec.view.kind === "line" && spec.data.per === "year") return line(spec, spec.view.look, f, compare, allRows, ctx);
  if (spec.view.kind === "table") {
    if (spec.data.per === "subject" && "latest" in spec.data.years) return currentTable(spec.view.look, f, compare, allRows);
    if (spec.data.per === "year") return yearTable(spec, spec.view.look, f, allRows, ctx);
    return null;
  }
  if (spec.view.kind === "bar" && spec.data.per === "subject") {
    if (spec.data.shownAs === "change") return changeBars(spec.view.look, f, compare, allRows, spec.compare !== "follows-page");
    if ("latest" in spec.data.years) return currentBars(spec.view.look, f, compare, allRows);
  }
  return null;
}

// ------------------------------------------------------------------------------ Current

// "Results in {category}" over Results' Current bars and table (SubjectPanels' wrapper).
export const currentHeading = (f: SubjectsFrame) =>
  f.host === "teacher.c1.results" && f.categoryLabel && f.subjects.length > 1 ? [f.measure.id === "entries" ? "Entries" : "Results", " in ", f.categoryLabel] : null;
export const currentTitle = (f: SubjectsFrame) => (f.compareAgainstLabel ? `${f.measure.id === "entries" ? "Entries" : "Results"} by subject in ${f.compareAgainstLabel}` : null);

function currentBars(look: BarLook, f: SubjectsFrame, compare: CompareSeries[], allRows: boolean): ViewSeries | null {
  if (f.currentBlocked || f.subjects.length === 0) return null;
  const highlight = look.highlight !== false;
  const c = currentRows(f, !!f.benchmarkLabel, highlight);
  const markers = hasCompare(compare, f.benchmarkKind, "marker") && !!f.benchmarkLabel;
  const shownRaw = allRows ? c.barRows : c.barRows.filter((r) => r.s.key === c.focusedKey);
  const ordered = orderRows(
    shownRaw.map((r) => ({ key: r.s.key, label: r.s.label, value: r.value, against: r.bench, r })),
    look.order,
  ).map((x) => x.r);
  const shown = look.top10 ? topTen(ordered.map((r) => ({ key: r.s.key, r })), c.focusedKey).map((x) => x.r) : ordered;
  const average = averageOfShown(look.average, shown.map((r) => r.value), null, "subjects") ?? undefined;
  if (look.orientation === "vertical") {
    return {
      kind: "bar",
      heading: currentHeading(f),
      title: currentTitle(f),
      leaf: {
        leaf: "verticalBars",
        bars: shown.map((r) => ({ key: r.s.key, label: r.s.label, shortLabel: r.s.shortLabel, value: r.value, colour: c.colourFor(r.s) })),
        measure: f.measure,
        ...(average ? { average } : {}),
      },
    };
  }
  return {
    kind: "bar",
    heading: currentHeading(f),
    title: currentTitle(f),
    leaf: {
      leaf: "rowBars",
      rows: shown.map((r) => ({ label: r.s.label, value: r.value, isSubject: true, color: c.colourFor(r.s), marker: markers ? r.bench : null, emphasis: highlight && r.s.key === c.focusedKey })),
      measure: f.measure,
      ...(markers ? { markerLabel: `${f.benchmarkLabel} average` } : {}),
      scaleMax: f.measure.barScaleMax ?? undefined,
      spacious: !!look.spacious,
      ...(average ? { average } : {}),
      values: look.values !== false,
      centred: `bar:${c.focusedKey}:${shown.map((r) => r.s.key).join(",")}`,
    },
  };
}

function currentTable(look: TableLook, f: SubjectsFrame, compare: CompareSeries[], allRows: boolean): ViewSeries | null {
  if (f.currentBlocked || f.subjects.length === 0) return null;
  // The third column: against the benchmark where the view compares with it, else the
  // subject's own previous published year (R-PREV-YEAR-FALLBACK).
  const vsBench = hasCompare(compare, f.benchmarkKind) && !!f.benchmarkLabel;
  const c = currentRows(f, vsBench);
  const highlight = look.highlight !== false;
  const colour = look.colourChange !== false;
  const shown = allRows ? c.rows : c.rows.filter((r) => r.s.key === c.focusedKey);
  const rows = shown.map((r) => ({
    key: r.s.key,
    label: r.s.label,
    highlight: highlight && r.s.key === c.focusedKey,
    emphasis: highlight && r.s.key === c.focusedKey,
    value: r.value,
    valueLabel: r.value === null ? "—" : f.measure.format(r.value),
    delta: r.delta,
    deltaLabel: r.delta === null ? "—" : f.measure.formatDelta(r.delta),
    deltaTone: (r.delta === null || !colour ? "neutral" : r.delta >= 0 ? "positive" : "negative") as "positive" | "negative" | "neutral",
  }));
  // The member's sort is the host's (it outlives a view switch) when the view opens in the
  // host's own order: by value on a ranked table, by the third column otherwise.
  const initialSort = look.sort === "latest" || look.sort === "listed" ? { key: "value" as const, dir: "desc" as const } : look.sort === "change" || look.sort === "vs-comparison" ? { key: "delta" as const, dir: "desc" as const } : { key: "value" as const, dir: "desc" as const };
  const hostOrder = f.rankedTable ? "value" : "delta";
  return {
    kind: "table",
    heading: currentHeading(f),
    title: currentTitle(f),
    leaf: {
      leaf: "sortTable",
      rows,
      hostSort: initialSort.key === hostOrder ? { sort: f.state.sort, onSort: f.state.onSort } : null,
      initialSort,
      sortable: look.memberSort !== false,
      columns: {
        name: "Subject",
        value: f.measure.id === "entries" ? "Entries" : "Result",
        delta: !vsBench ? "vs last year" : f.deltaHeading ?? `vs ${f.benchmarkLabel}`,
      },
      leadingRank: !!look.leadingRank || !!look.extra?.includes("rank"),
      showValue: look.value !== false,
      showDelta: !!look.extra?.includes("vs-comparison"),
      centredPrefix: `table:${c.focusedKey}`,
    },
  };
}

// ------------------------------------------------------------------------------- Trends

// Each subject's line over the Trend half's span, in Current's order and the line palette.
function trendData(f: SubjectsFrame, allRows: boolean, extra: PanelSeries[]) {
  const c = currentRows(f, !!f.benchmarkLabel);
  const own = allRows ? c.barRows : c.barRows.filter((r) => r.s.key === c.focusedKey);
  // R-TREND-FROM-2223: every year drawn, statements (change column, fit) from 2022/23.
  const full = withTrendBase(
    trimToData({
      periods: f.periods,
      series: [...own.map((r) => ({ key: r.s.key, label: r.s.label, colour: c.trendColours.get(r.s.key) ?? c.colourFor(r.s), values: r.s.values })), ...extra],
    }),
    trendBaseFor(f.measure.id, f.phase),
  );
  return { c, data: sliceFrom(full, f.state.trendStart) };
}

function line(spec: ViewSpec, look: LineLook, f: SubjectsFrame, compare: CompareSeries[], allRows: boolean, ctx: BuildContext): ViewSeries | null {
  if (f.subjects.length === 0) return null;
  const b = basics(f);
  // A spec of its own: its compare lines (S3c: the group's mean or median, LA / region /
  // England from the host's geography fetch, where the catalogue allows -- compare-lines.ts).
  const extra = spec.compare === "follows-page" ? [] : compareLinesFor(f, compare, { focusedKey: b.focusedKey, span: true, as: ["line"] });
  const { c, data } = trendData(f, allRows, extra);
  const indexedTrend = shouldIndex(f.measure.aggregate);
  const wantIndex = spec.data.shownAs === "indexed";
  const showFit = fitOn(look.trendLine, f.state.showFit);
  const looks = { ...(look.fromZero ? { fromZero: true } : {}), ...(look.endLabels ? { endLabels: true } : {}) };
  // A focused subject on its own is TrendChart's:
  // a line from four real years, per-year bars below that (R-TREND-LINE-4YR, D8).
  // 0.6.1 S6: whatever short-span fallback the look carries. "change-bars" is the many-row
  // chart's fallback (MultiTrend); a view the editor narrowed to one subject inherits it
  // from the column's preset, unseen, and drew a one-row change list instead of D8's
  // per-year bars. No preset is single-row with it, so no preset's drawing changes.
  if (!allRows && !wantIndex) {
    return {
      kind: "line",
      heading: null,
      title: `${c.focusedSubject?.label ?? c.scopeNoun}, each year`,
      leaf: { leaf: "trendChart", data, measure: f.measure, ...(extra.length ? { focusKey: c.focusedKey ?? undefined } : {}), showFit, ...looks },
    };
  }
  const railLegend = f.changeScope === "individual" && data.series.length > 1;
  const shown: PanelData =
    railLegend && ctx.fullscreen ? { ...data, series: data.series.filter((x) => x.key === c.focusedKey || !f.state.hiddenKeys.has(x.key)) } : data;
  // Context's All subjects card: the focused subject against the group average only.
  const focusVsGroup =
    look.cardFocusVsAverage && f.cardTrend === "focusVsGroup" && !ctx.fullscreen
      ? {
          periods: data.periods,
          statementFrom: data.statementFrom,
          series: [
            ...data.series.filter((x) => x.key === c.focusedKey),
            ...f.groups.slice(0, 1).map((g) => ({
              key: "group-0",
              label: g.label,
              colour: g.colour ?? "var(--muted3)",
              values: data.periods.map((p) => g.values[f.periods.indexOf(p)] ?? null),
              comparison: true,
            })),
          ],
        }
      : null;
  const scope = allRows ? c.scope : null;
  return {
    kind: "line",
    heading: null,
    title: scope ? (indexedTrend ? scope : `${scope}: each subject's line`) : !indexedTrend ? `${c.focusedSubject?.label ?? c.scopeNoun}, each year` : null,
    leaf: {
      leaf: "multiTrend",
      data: focusVsGroup ?? shown,
      measure: f.measure,
      focusKey: c.focusedKey,
      showFit,
      // The measure's own rule unless the spec asks for the other form (Actual on a headcount).
      ...(wantIndex === indexedTrend ? {} : { index: wantIndex }),
      seriesLegend: !(railLegend && ctx.fullscreen),
      ...looks,
      scaleTitle:
        (indexedTrend || wantIndex) && hasLine(data)
          ? { view: wantIndex ? "indexed" : "actual", from: data.periods[0] ?? null, noun: indexedTrend ? "entries" : f.measure.noun }
          : null,
    },
  };
}

export function tableLook(look: TableLook) {
  return {
    ...(look.yearColumns && look.yearColumns !== "first-latest" ? { yearColumns: look.yearColumns } : {}),
    ...(look.extra && !look.extra.includes("change") ? { showChange: false } : {}),
    ...(look.extra?.includes("rank") && !look.leadingRank ? { rankColumn: "always" as const } : {}),
    // The hosts' year tables open in rank (= latest year) order; "listed" / "change" open
    // otherwise.
    ...(look.sort === "listed" || (look.sort === "change" && !look.leadingRank) ? { initialSort: look.sort } : {}),
    ...(look.highlight === false ? { highlight: false } : {}),
    ...(look.colourChange === false ? { colourChange: false } : {}),
    ...(look.memberSort === false && !look.leadingRank ? { sortable: false } : {}),
    ...(look.changeLeads === "percent" ? { changeEmphasis: "percent" as const } : {}),
  };
}

function yearTable(spec: ViewSpec, look: TableLook, f: SubjectsFrame, allRows: boolean, ctx: BuildContext): ViewSeries | null {
  if (f.subjects.length === 0) return null;
  if (onChangeHalf(spec)) {
    // The % change half's table: every subject (and, for the trim, the group lines) over its
    // own span, ranked by change.
    const { data, c, changeSince } = changeData(f, allRows);
    return {
      kind: "table",
      heading: null,
      title: c.scope ? `${c.scope}: ${changeSince} against the latest year, ranked by change` : `${c.scopeNoun} by year, since ${changeSince}`,
      leaf: {
        leaf: "yearTable",
        data: { ...data, series: data.series.filter((x) => !x.key.startsWith("group-")) },
        measure: f.measure,
        focusKey: c.focusedKey,
        ...(look.leadingRank ? { leadingRank: true } : {}),
        ...tableLook(look),
        centred: `change-table:${c.focusedKey}:${data.periods.join(",")}`,
      },
    };
  }
  // S3c: a spec of its own adds its compare series as rows (the geography table's way: LA /
  // region / England, or an average of the group, each a labelled row, no rank).
  const rows = spec.compare === "follows-page" ? [] : compareLinesFor(f, spec.compare, { focusedKey: basics(f).focusedKey, span: true });
  const { c, data } = trendData(f, allRows, rows.map((r) => ({ ...r, colour: "var(--muted3)" })));
  const railLegend = f.changeScope === "individual" && data.series.length > 1;
  const shown: PanelData =
    railLegend && ctx.fullscreen ? { ...data, series: data.series.filter((x) => x.key === c.focusedKey || x.comparison || !f.state.hiddenKeys.has(x.key)) } : data;
  const scope = allRows ? c.scope : null;
  return {
    kind: "table",
    heading: null,
    title: scope ? `${scope}, year by year` : `${c.focusedSubject?.label ?? c.scopeNoun}, year by year`,
    leaf: {
      leaf: "yearTable",
      data: shown,
      measure: f.measure,
      focusKey: c.focusedKey,
      ...(look.leadingRank ? { leadingRank: true } : {}),
      ...(rows.length ? { showRank: false } : {}),
      ...tableLook(look),
      centred: `trend-table:${c.focusedKey}:${data.periods.join(",")}`,
    },
  };
}

// The % change half's data: each subject in Current's grey ramp, then the group lines (for
// the trim, and the reference line), over the change half's span.
export function changeData(f: SubjectsFrame, allRows: boolean) {
  const c = currentRows(f, !!f.benchmarkLabel);
  const own = (c.redesigned ? c.barRows.map((r) => r.s) : f.subjects).filter((s) => allRows || s.key === c.focusedKey);
  // R-TREND-FROM-2223: the % change half still draws 2021/22; its changes count from 2022/23.
  const full = withTrendBase(
    trimToData({
      periods: f.periods,
      series: [
        ...own.map((s) => ({ key: s.key, label: s.label, colour: c.colourFor(s), values: s.values })),
        ...f.groups.map((g, gi) => ({ key: `group-${gi}`, label: g.label, colour: g.colour ?? "#57534e", values: g.values })),
      ],
    }),
    trendBaseFor(f.measure.id, f.phase),
  );
  const data = sliceFrom(full, f.state.changeStart);
  const span = statementSpan(data);
  return { c, data, span, changeSince: span.periods.length ? academicYearLabel(span.periods[0]) : "" };
}

function changeBars(look: BarLook, f: SubjectsFrame, compare: CompareSeries[], allRows: boolean, explicit = false): ViewSeries | null {
  if (f.subjects.length === 0) return null;
  // R-TREND-FROM-2223: every change over the statement span (2022/23 on a grade or points measure).
  const { c, span: data, changeSince } = changeData(f, allRows);
  // S3c: a spec of its own reads its dashed reference from its own compare (the group's mean
  // or median, an area), over the same span.
  const ownRef = explicit ? compareLinesFor(f, compare, { focusedKey: c.focusedKey, span: true, as: ["reference", "line"] })[0] : undefined;
  const rows = data.series
    .filter((s) => !s.key.startsWith("group-"))
    .map((s) => ({ key: s.key, label: s.label, colour: s.colour, value: changeOf(f.measure, s.values) }));
  const reference = hasCompare(compare, f.groupKind, "reference") && f.groups[0];
  const ranked = orderRows(rows, "highest");
  const shown = look.top10 ? topTen(ranked, c.focusedKey) : rows;
  const average = averageOfShown(look.average, shown.map((r) => r.value), null, "subjects") ?? undefined;
  return {
    kind: "bar",
    heading: null,
    title: c.scope && allRows ? `${c.scope}: ${changePhrase(f.measure)} since ${changeSince}, ranked` : `${c.scopeNoun}: ${changePhrase(f.measure)} since ${changeSince}`,
    leaf: {
      leaf: "changeList",
      rows: shown,
      focusKey: look.highlight === false ? null : c.focusedKey,
      ...(explicit
        ? ownRef
          ? { group: { label: ownRef.label, value: changeOf(f.measure, data.periods.map((p) => ownRef.values[f.periods.indexOf(p)] ?? null)) } }
          : {}
        : reference
          ? { group: { label: f.groups[0].label, value: changeOf(f.measure, data.series.find((x) => x.key === "group-0")?.values ?? []) } }
          : {}),
      ...(average ? { average } : {}),
      format: f.measure.changeKind === "percent" ? "percent" : "change",
      measure: f.measure,
      ...(look.values === false ? { values: false } : {}),
      ...(look.order === "az" ? { order: "az" as const } : {}),
      centred: `change-list:${c.focusedKey}:${data.periods.join(",")}`,
    },
  };
}
