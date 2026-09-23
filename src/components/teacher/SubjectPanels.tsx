"use client";

// Teacher view, round 6: the per-subject three-panel set, shared by Results (§4.1) and
// Context (§4.2).
//
// Those two columns ask different questions -- "how well are my subjects doing against
// the country?" and "how do they sit against the rest of the school?" -- but they draw
// the SAME three panels from the same shape of data: one value per subject per year, and
// a benchmark to read each one against. The only real differences are which benchmark and
// which measure, and both arrive as props. Writing them twice is how the two would drift
// a sort order or a summary sentence apart, which §5 explicitly rules out ("every new
// sortable table follows the same pattern already shipped for Results").
//
// The caller owns "which data": it resolves the measure and hands over values already
// computed for it. This component owns "how it looks" and nothing else.
import { useState, type ReactNode } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import {
  DIRECTION_ARROW,
  DIRECTION_WORD,
  combine,
  nextStart,
  percentChange,
  periodsWithData,
  sliceFrom,
  startOptions,
  trendSentence,
  type Measure,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { ColumnPanels, PanelSummary, type PanelRender } from "./ColumnPanels";
import { ChangeChart, type ChangeBar } from "./ChangeChart";
import { HorizontalBarsIcon, IconButton, Pill, RankListIcon, SubjectChip } from "./PanelIcons";
import { SortTable, nextSort, type SortRow, type SortState } from "./SortTable";
import { TrendChart } from "./TrendChart";
import { ViewChart } from "./ViewChart";

const DIRECTION_COLOUR = { up: "#0d9488", down: "#b45309", flat: "var(--muted)" } as const;

export type SubjectSeries = {
  key: string;
  label: string;
  shortLabel: string;
  colour: string;
  // One value per period, aligned to `periods`. Null where nothing is published.
  values: (number | null)[];
  // What this subject is read against, per period -- the England average in Results, the
  // comparison group's own average in Context. Aligned the same way.
  benchmark?: (number | null)[];
};

export function SubjectPanels({
  columnId,
  periods,
  subjects,
  measure,
  benchmarkLabel,
  benchmarkNoun,
  groupSeries,
  controls,
  questions,
  source,
  panels,
  onPanelsChange,
  emptyText,
  note,
}: {
  columnId: string;
  periods: number[];
  subjects: SubjectSeries[];
  measure: Measure;
  // Names the marker under the bars and the table's third column ("National", "Whole
  // school"). Absent = there is no benchmark for this measure, and both the marker and
  // the delta fall back to the subject's own previous published year.
  benchmarkLabel?: string;
  // The same thing in a sentence ("the national average").
  benchmarkNoun?: string;
  // Context's comparison group, drawn as the Trend panel's second, dashed line and as one
  // extra bar on % change. Results has none -- its benchmark is per subject, not a group.
  groupSeries?: { label: string; values: (number | null)[] };
  controls?: ReactNode;
  questions: { current: string; trend: string; change: string };
  source: (span?: string) => ReactNode;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  emptyText: string;
  // An honest limit worth saying on the card -- e.g. the threshold measure only having
  // 2023/24 onward. Shown under the figure, not hidden in a tooltip.
  note?: ReactNode;
}) {
  const [view, setView] = useState<"bar" | "table">("bar");
  const [sort, setSort] = useState<SortState>({ key: "delta", dir: "desc" });
  const [focus, setFocus] = useState<string>("all");
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);

  const spanLabel = (ps: number[]) =>
    ps.length ? `${academicYearLabel(ps[0])}–${academicYearLabel(ps[ps.length - 1])}` : "";

  // --------------------------------------------------------------- Current
  // The latest period any subject has a figure for -- not simply the last period in the
  // list, which may be a year this measure has not been published for yet.
  const latestIdx = (() => {
    for (let i = periods.length - 1; i >= 0; i--) if (subjects.some((s) => s.values[i] !== null)) return i;
    return -1;
  })();
  const latest = latestIdx >= 0 ? periods[latestIdx] : null;

  // The third column. Against a benchmark where there is one; otherwise against this
  // subject's own previous published year, which is the other real comparison available
  // -- never a column of dashes. Results' threshold measure is the case that needs it:
  // the national anchor this app holds is points per entry, so a Grade 4+ rate has no
  // published England figure to sit against.
  const previousValue = (s: SubjectSeries): number | null => {
    for (let i = latestIdx - 1; i >= 0; i--) if (s.values[i] !== null) return s.values[i];
    return null;
  };

  const rows = subjects.map((s) => {
    const value = latestIdx >= 0 ? s.values[latestIdx] : null;
    const bench = latestIdx >= 0 ? s.benchmark?.[latestIdx] ?? null : null;
    const against = benchmarkLabel ? bench : previousValue(s);
    const delta = value !== null && against !== null ? value - against : null;
    return { s, value, bench, delta };
  });

  const barRows = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  const tableRows: SortRow[] = rows.map((r) => ({
    key: r.s.key,
    label: r.s.label,
    colour: r.s.colour,
    value: r.value,
    valueLabel: r.value === null ? "—" : measure.format(r.value),
    delta: r.delta,
    deltaLabel: r.delta === null ? "—" : measure.formatDelta(r.delta),
    deltaTone: r.delta === null ? "neutral" : r.delta >= 0 ? "positive" : "negative",
  }));

  // §5: computed from the unsorted rows, so reordering the table never rewrites the
  // sentence underneath it.
  const byDelta = rows.filter((r) => r.delta !== null).sort((a, b) => b.delta! - a.delta!);
  const bestRow = byDelta[0];
  const worstRow = byDelta[byDelta.length - 1];
  const againstNoun = benchmarkNoun ?? "its own previous year";

  const current: PanelRender = {
    tag: `Current — ${latest === null ? "no year" : academicYearLabel(latest)}`,
    question: questions.current,
    actions: (
      <>
        <IconButton label="Bar chart" active={view === "bar"} onClick={() => setView("bar")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Sortable table" active={view === "table"} onClick={() => setView("table")}>{RankListIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      subjects.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <>
          {view === "bar" ? (
            <ViewChart
              layout="row"
              unit=""
              formatValue={measure.format}
              markerLabel={benchmarkLabel ? `${benchmarkLabel} average` : undefined}
              scaleMax={measure.barScaleMax ?? undefined}
              computed={{
                rows: barRows.map((r) => ({
                  label: r.s.label,
                  value: r.value,
                  isSubject: true,
                  color: r.s.colour,
                  marker: r.bench,
                })),
              }}
            />
          ) : (
            <SortTable
              rows={tableRows}
              sort={sort}
              onSort={(key) => setSort(nextSort(sort, key))}
              columns={{ name: "Subject", value: "Result", delta: benchmarkLabel ? `vs ${benchmarkLabel}` : "vs last year" }}
              fullscreen={fullscreen}
            />
          )}
          {note && <p className="mt-2 text-[11px] text-[var(--muted3)]">{note}</p>}
        </>
      ),
    summary:
      bestRow && worstRow ? (
        bestRow.s.key === worstRow.s.key ? (
          <PanelSummary>
            {bestRow.s.label} sits {measure.formatDelta(bestRow.delta!)} against {againstNoun}.
          </PanelSummary>
        ) : (
          <PanelSummary>
            {bestRow.s.label} sits furthest above {againstNoun} ({measure.formatDelta(bestRow.delta!)});{" "}
            {worstRow.delta! < 0
              ? `${worstRow.s.label} is the one below it (${measure.formatDelta(worstRow.delta!)}).`
              : `${worstRow.s.label} is closest to it (${measure.formatDelta(worstRow.delta!)}).`}
          </PanelSummary>
        )
      ) : undefined,
    source: source(),
  };

  // ----------------------------------------------------------------- Trend
  const focused = subjects.find((s) => s.key === focus);
  const allValues = periods.map((_, i) => combine(subjects.map((s) => s.values[i]), measure.aggregate));
  const focusLabel = focused ? focused.label : subjects.length === 1 ? subjects[0].label : "All subjects";

  const trendFull: PanelData = {
    periods,
    series: [
      focused
        ? { key: focused.key, label: focused.label, colour: focused.colour, values: focused.values }
        : { key: "all", label: "All subjects", colour: "var(--muted2)", values: allValues },
      ...(groupSeries
        ? [{ key: "group", label: groupSeries.label, colour: "var(--muted3)", values: groupSeries.values, comparison: true }]
        : []),
    ],
  };
  const trendPeriods = periodsWithData(trendFull);
  const trendData = sliceFrom(trendFull, trendStart);
  const trendSaid = trendSentence({
    subjectClause: `${focusLabel}'s ${measure.noun}`,
    values: trendData.series[0]?.values ?? [],
    measure,
    startLabel: trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "",
  });
  // Context's two-line trend says what the group did over the same years, so the focus
  // line is never read in isolation. Results has no group line and no such clause.
  const groupClause = (() => {
    if (!groupSeries || !trendData.series[1]) return "";
    const vals = trendData.series[1].values.filter((v): v is number => v !== null);
    if (vals.length < 2) return "";
    return ` — against ${groupSeries.label.toLowerCase()}'s own ${measure.format(vals[0])} to ${measure.format(vals[vals.length - 1])} over the same years.`;
  })();

  const chipRow = (
    <div className="flex flex-wrap gap-1.5">
      <SubjectChip label="All subjects" colour="#57534e" active={focus === "all"} onClick={() => setFocus("all")} />
      {subjects.map((s) => (
        <SubjectChip key={s.key} label={s.label} colour={s.colour} active={focus === s.key} onClick={() => setFocus(s.key)} />
      ))}
    </div>
  );

  const trend: PanelRender = {
    tag: `${measure.label} — ${spanLabel(trendData.periods) || "no history"}`,
    question: questions.trend,
    controls: (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {chipRow}
        <div className="flex gap-1.5">
          {startOptions(trendPeriods).length > 1 && (
            <Pill
              label={`From: ${trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "—"} ▾`}
              onClick={() => setTrendStart(nextStart(trendPeriods, trendStart ?? trendPeriods[0] ?? null))}
            />
          )}
          <Pill label="Trend line" active={showFit} onClick={() => setShowFit(!showFit)} />
        </div>
      </div>
    ),
    body: (fullscreen) => (
      <>
        <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} />
        {note && <p className="mt-2 text-[11px] text-[var(--muted3)]">{note}</p>}
      </>
    ),
    summary: trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence.replace(/\.$/, "")}{groupClause || "."}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend.</PanelSummary>
    ),
    source: source(spanLabel(trendData.periods)),
  };

  // -------------------------------------------------------------- % change
  const changeFull: PanelData = {
    periods,
    series: [
      ...subjects.map((s) => ({ key: s.key, label: s.label, colour: s.colour, values: s.values })),
      // §4.2: one extra bar for the comparison group itself, alongside the per-subject
      // ones -- "individual subjects and the school as a whole" in one picture.
      ...(groupSeries ? [{ key: "group", label: groupSeries.label, colour: "#57534e", values: groupSeries.values }] : []),
    ],
  };
  const changePeriods = periodsWithData(changeFull);
  const changeData = sliceFrom(changeFull, changeStart);
  const changeBars: ChangeBar[] = changeData.series.map((s) => ({
    key: s.key,
    label: s.label,
    shortLabel: subjects.find((x) => x.key === s.key)?.shortLabel ?? s.label,
    colour: s.colour,
    percent: percentChange(s.values),
  }));
  const rankedChange = changeBars.filter((b) => b.percent !== null).sort((a, b) => b.percent! - a.percent!);
  const bestChange = rankedChange[0];
  const worstChange = rankedChange[rankedChange.length - 1];
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";

  const change: PanelRender = {
    tag: `% change in ${measure.label.toLowerCase()} — since ${changeSince || "—"}`,
    question: questions.change,
    controls:
      startOptions(changePeriods).length > 1 ? (
        <div className="flex justify-end">
          <Pill
            label={`Since: ${changeSince || "—"} ▾`}
            onClick={() => setChangeStart(nextStart(changePeriods, changeStart ?? changePeriods[0] ?? null))}
          />
        </div>
      ) : undefined,
    body: (fullscreen) => (
      <>
        <ChangeChart bars={changeBars} fullscreen={fullscreen} />
        {note && <p className="mt-2 text-[11px] text-[var(--muted3)]">{note}</p>}
      </>
    ),
    summary:
      bestChange && worstChange && bestChange.key !== worstChange.key ? (
        <PanelSummary>
          {bestChange.label} has grown the most ({bestChange.percent! >= 0 ? "+" : "−"}
          {Math.abs(Math.round(bestChange.percent!))}%); {worstChange.label}{" "}
          {worstChange.percent! < 0 ? "has declined the most" : "has grown the least"} (
          {worstChange.percent! >= 0 ? "+" : "−"}
          {Math.abs(Math.round(worstChange.percent!))}%) since {changeSince}.
        </PanelSummary>
      ) : (
        <PanelSummary>Not enough published years yet to compare on change.</PanelSummary>
      ),
    source: source(spanLabel(changeData.periods)),
  };

  return (
    <ColumnPanels
      columnId={columnId}
      panels={panels}
      onPanelsChange={onPanelsChange}
      controls={controls}
      changeLabel={measure.changeLabel}
      render={{ current, trend, change }}
    />
  );
}
