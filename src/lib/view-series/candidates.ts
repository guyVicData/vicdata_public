// VicData 0.6.1 S3: the series builder for a candidates frame -- Column 1 Candidates
// (CandidatesPanels' data: each subject's entries per period). Line, table and bar.
import type { BarLook, CompareSeries, LineLook, TableLook, ViewSpec } from "@/catalogue/viewspec";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import {
  ENTRIES_MEASURE,
  percentChange,
  periodsWithData,
  sliceFrom,
  trimToData,
  TREND_LINE_MIN_YEARS,
  type PanelData,
} from "@/lib/teacher-view-panels";
import { memberMeans } from "@/lib/teacher-view-populations";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { FOCUS_COLOUR, paletteInOrder, tintInOrder } from "@/lib/teacher-view-trend-styles";
import { onChangeHalf, resolveCompare } from "./compare";
import { compareLinesFor, pointsEligibleOwn, type CompareLine } from "./compare-lines";
import type { CandidatesFrame } from "./frames";
import { averageOfShown, fitOn, orderRows, topTen } from "./looks";
import type { ViewSeries } from "./series";

const hasLine = (d: PanelData) => periodsWithData(d).length >= TREND_LINE_MIN_YEARS;

// S3c: beside an LA / region / England line the focused subject counts points-eligible
// entries too (R-GEO-POINTS-ELIGIBLE: the area figures count only those), as the host's own
// geography row does.
function withPointsEligible<T extends { key: string; values: (number | null)[] }>(f: CandidatesFrame, rows: T[], extra: CompareLine[], focusKey: string | undefined): T[] {
  const pe = pointsEligibleOwn(f, extra);
  return pe ? rows.map((r) => (r.key === focusKey ? { ...r, values: pe } : r)) : rows;
}

// What CandidatesPanels works out before it draws: Current's order, the grey ramp, the line
// palette, the focused subject and the category's per-subject average.
export function basics(f: CandidatesFrame, highlight = true) {
  const { periods, subjects } = f;
  const valueAt = (s: CandidatesFrame["subjects"][number], period: number) => s.values[periods.indexOf(period)] ?? null;
  const latestPeriod = periods.length ? periods[periods.length - 1] : null;
  const currentOrder = [...subjects].sort(
    (a, b) => ((latestPeriod === null ? null : valueAt(b, latestPeriod)) ?? -Infinity) - ((latestPeriod === null ? null : valueAt(a, latestPeriod)) ?? -Infinity),
  );
  const focusKey = f.focus ?? subjects[0]?.key ?? null;
  const tints = tintInOrder(currentOrder.map((s) => s.key), highlight ? focusKey : null, FOCUS_COLOUR);
  const colourOf = (key: string) => tints.get(key) ?? "var(--muted3)";
  const subjectSeries = currentOrder.map((s) => ({ key: s.key, label: s.label, colour: colourOf(s.key), values: s.values }));
  const trendColours = paletteInOrder(currentOrder.map((s) => s.key), focusKey, FOCUS_COLOUR, f.theme === "light" ? PALETTE_LIGHT : PALETTE_DARK, f.accentHex);
  const trendSubjectSeries = currentOrder.map((s) => ({ key: s.key, label: s.label, colour: trendColours.get(s.key) ?? "var(--muted3)", values: s.values }));
  const focused = subjects.find((s) => s.key === f.focus) ?? subjects[0];
  // Self-inclusive, per subject (memberMeans): what one subject is comparable with.
  const group = f.groupLabel && subjects.length > 1 ? { key: "group", label: f.groupLabel, colour: "var(--muted3)", values: memberMeans(periods, subjectSeries) } : null;
  const inCategory = group && f.categoryLabel ? `Entries in ${f.categoryLabel}` : null;
  return { subjectSeries, trendSubjectSeries, focused, group, inCategory };
}

export function buildCandidates(spec: ViewSpec, f: CandidatesFrame): ViewSeries | null {
  if (f.subjects.length === 0) return null;
  const compare = resolveCompare(spec, f);
  const allRows = !!spec.data.rows;
  if (spec.view.kind === "line" && spec.data.per === "year") return line(spec, spec.view.look, f, compare, allRows);
  if (spec.view.kind === "table" && spec.data.per === "year") return table(spec, spec.view.look, f, allRows);
  if (spec.view.kind === "bar" && spec.data.per === "subject" && spec.data.shownAs === "change") return changeBars(spec.view.look, f, compare, allRows, spec.compare !== "follows-page");
  return null;
}

function line(spec: ViewSpec, look: LineLook, f: CandidatesFrame, compare: CompareSeries[], allRows: boolean): ViewSeries {
  const b = basics(f);
  // A spec of its own: its compare lines (S3c: the category's mean or median; LA / region /
  // England from the host's geography fetch, where the catalogue allows -- compare-lines.ts).
  const extra: CompareLine[] = spec.compare === "follows-page" ? [] : compareLinesFor(f, compare, { focusedKey: b.focused?.key ?? null, span: true, as: ["line"] });
  const own = withPointsEligible(f, allRows ? b.trendSubjectSeries : b.trendSubjectSeries.filter((s) => s.key === b.focused?.key), extra, b.focused?.key);
  const data = sliceFrom(trimToData({ periods: f.periods, series: [...own, ...extra] }), f.state.trendStart);
  const showFit = fitOn(look.trendLine, f.state.showFit);
  const looks = { ...(look.fromZero ? { fromZero: true } : {}), ...(look.endLabels ? { endLabels: true } : {}) };
  const wantIndex = spec.data.shownAs === "indexed";
  // 0.6.1 S6: whatever short-span fallback the look carries. "change-bars" is the many-row
  // chart's fallback (MultiTrend); a view the editor narrowed to one subject inherits it
  // from the column's preset, unseen, and drew a one-row change list instead of D8's
  // per-year bars. No preset is single-row with it, so no preset's drawing changes.
  if (!allRows && !wantIndex) {
    return {
      kind: "line",
      heading: null,
      title: `${b.focused?.label ?? "Entries"}, each year`,
      leaf: { leaf: "trendChart", data, measure: ENTRIES_MEASURE, ...(extra.length ? { focusKey: b.focused?.key } : {}), showFit, ...looks },
    };
  }
  return {
    kind: "line",
    heading: null,
    title: allRows ? b.inCategory : null,
    leaf: {
      leaf: "multiTrend",
      data,
      measure: ENTRIES_MEASURE,
      focusKey: b.focused?.key ?? null,
      showFit,
      ...(wantIndex ? {} : { index: false }),
      ...looks,
      scaleTitle: hasLine(data) ? { view: wantIndex ? "indexed" : "actual", from: data.periods[0] ?? null, noun: "entries" } : null,
    },
  };
}

export function changeData(f: CandidatesFrame, b: ReturnType<typeof basics>, allRows: boolean) {
  const own = allRows ? b.subjectSeries : b.subjectSeries.filter((s) => s.key === b.focused?.key);
  const data = sliceFrom(trimToData({ periods: f.periods, series: [...own, ...(b.group ? [{ ...b.group, colour: "#57534e" }] : [])] }), f.state.changeStart);
  return { data, changeSince: data.periods.length ? academicYearLabel(data.periods[0]) : "" };
}

function table(spec: ViewSpec, look: TableLook, f: CandidatesFrame, allRows: boolean): ViewSeries {
  const b = basics(f, look.highlight !== false);
  const shape = {
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
    // The count behind each row's latest figure IS the figure on entries.
  };
  if (onChangeHalf(spec)) {
    const { data, changeSince } = changeData(f, b, allRows);
    return {
      kind: "table",
      heading: null,
      title: b.inCategory && allRows ? `${b.inCategory}: ${changeSince} against the latest year, with the change` : `Entries by year, since ${changeSince}`,
      leaf: {
        leaf: "yearTable",
        data: { periods: data.periods, series: data.series.filter((s) => s.key !== "group") },
        measure: ENTRIES_MEASURE,
        focusKey: b.focused?.key ?? null,
        ...shape,
        centred: `change-table:${b.focused?.key}:${data.periods.join(",")}`,
      },
    };
  }
  // S3c: a spec of its own adds its compare series as labelled rows (no rank).
  const rows: CompareLine[] = spec.compare === "follows-page" ? [] : compareLinesFor(f, spec.compare, { focusedKey: b.focused?.key ?? null, span: true }).map((r) => ({ ...r, colour: "var(--muted3)" }));
  const own = withPointsEligible(f, allRows ? b.trendSubjectSeries : b.trendSubjectSeries.filter((s) => s.key === b.focused?.key), rows, b.focused?.key);
  const data = sliceFrom(trimToData({ periods: f.periods, series: [...own, ...rows] }), f.state.trendStart);
  return {
    kind: "table",
    heading: null,
    title: b.inCategory && allRows ? `${b.inCategory}, year by year` : `${b.focused?.label ?? "Entries"}, year by year`,
    leaf: { leaf: "yearTable", data, measure: ENTRIES_MEASURE, focusKey: b.focused?.key ?? null, ...shape, ...(rows.length ? { showRank: false } : {}), centred: `trend-table:${b.focused?.key}:${data.periods.join(",")}` },
  };
}

function changeBars(look: BarLook, f: CandidatesFrame, compare: CompareSeries[], allRows: boolean, explicit = false): ViewSeries {
  const b = basics(f);
  const { data, changeSince } = changeData(f, b, allRows);
  // S3c: a spec of its own reads its dashed reference from its own compare.
  const ownRef = explicit ? compareLinesFor(f, compare, { focusedKey: b.focused?.key ?? null, span: true, as: ["reference", "line"] })[0] : undefined;
  const rows = data.series.filter((s) => s.key !== "group").map((s) => ({ key: s.key, label: s.label, colour: s.colour, value: percentChange(s.values) }));
  const shown = look.top10 ? topTen(orderRows(rows, "highest"), b.focused?.key ?? null) : rows;
  const reference = b.group && compare.some((c) => c.kind === "category" && c.as === "reference");
  const average = averageOfShown(look.average, shown.map((r) => r.value), null, "subjects") ?? undefined;
  return {
    kind: "bar",
    heading: null,
    title: b.inCategory && allRows ? `${b.inCategory}: % change since ${changeSince}, ranked` : `Entries: % change since ${changeSince}`,
    leaf: {
      leaf: "changeList",
      rows: shown,
      focusKey: look.highlight === false ? null : b.focused?.key ?? null,
      ...(explicit
        ? ownRef
          ? { group: { label: ownRef.label, value: percentChange(data.periods.map((p) => ownRef.values[f.periods.indexOf(p)] ?? null)) } }
          : {}
        : reference && b.group
          ? { group: { label: b.group.label, value: percentChange(data.series.find((s) => s.key === "group")?.values ?? []) } }
          : {}),
      ...(average ? { average } : {}),
      format: "percent",
      measure: ENTRIES_MEASURE,
      ...(look.values === false ? { values: false } : {}),
      ...(look.order === "az" ? { order: "az" as const } : {}),
      centred: `change-list:${b.focused?.key}:${data.periods.join(",")}`,
    },
  };
}
