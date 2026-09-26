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
  percentChange,
  periodsWithData,
  sliceFrom,
  trimToData,
  trendChartKind,
  trendSentence,
  type Measure,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { CentredOnTarget } from "./CentredOnTarget";
import { ChangeList, MultiTrend, YearTable, curatedKeys, multiTrendHasLine } from "./SeriesViews";
import { FOCUS_COLOUR, paletteInOrder, tintInOrder } from "@/lib/teacher-view-trend-styles";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { FromYearMenu } from "./FromYearMenu";
import { TrendLineToggle } from "./PanelFooter";
import { ChangeChart, type ChangeBar } from "./ChangeChart";
import { DonutIcon, HorizontalBarsIcon, IconButton, RankListIcon, TableIcon, TrendLineIcon } from "./PanelIcons";
import { ShareDonut } from "./ShareDonut";
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
  groups = [],
  donut,
  yearControl = false,
  focus,
  controls,
  questions,
  source,
  panels,
  onPanelsChange,
  notes,
  emptyText,
  note,
  currentLabel,
  changeScope = "all",
  theme = "dark",
  accentHex = null,
  deltaHeading,
  spaciousBars = false,
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
  // Comparison groups, each drawn as a dashed line on Trend and one extra bar on % change:
  // Context's comparison group, and (content round S6-S7) Column 1's category average and,
  // at GCSE, the England average across the same category. The first one is the group the
  // Trend sentence names. `colour` tells two of them apart; absent = the usual grey.
  groups?: { label: string; values: (number | null)[]; colour?: string }[];
  // Context's third Current view. Present = the donut icon exists; `enabled` false greys
  // it AND disables the button, so a Results measure cannot select it at all (§4.2) --
  // a share of an average point score is not a meaningful percentage.
  //
  // `groupTotals` is the group's own TOTAL per period, which is a different figure from
  // `groupSeries`. The lines and bars plot the group's per-subject average, because that
  // is what a single subject is comparable with; a share has to be of the whole, or the
  // percentage is of the wrong denominator.
  //
  // `shareOf` (round 2 §3) is what the donut's SENTENCE says the share is of -- "all
  // student entries at The Chase" -- deliberately separate from `groupLabel`, which the
  // benchmark label, trend/change questions and Current tag also read and which must keep
  // saying "Whole school".
  donut?: { enabled: boolean; groupLabel: string; groupTotals: (number | null)[]; shareOf?: string };
  // Context's year prev/next pair, so Current is no longer pinned to the latest year.
  // Only the years the active measure really has (§6.3); absent elsewhere, matching the
  // wireframe, which draws it on Context alone.
  yearControl?: boolean;
  // The dashboard's one focus subject (the shared control bar's chips). Content round S5
  // removed "All", so Trend and the donut always follow a single subject: this one, or
  // the first subject when it is not among `subjects`.
  focus: string | null;
  controls?: ReactNode;
  questions: { current: string; trend: string; change: string };
  source: (span?: string) => ReactNode;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  notes?: PanelNotes;
  emptyText: string;
  // An honest limit worth saying -- e.g. the threshold measure only having 2023/24
  // onward. Content round S11 moved it from under every panel's figure (printed three
  // times per column) into each panel's "i" popover, after the source it qualifies.
  note?: ReactNode;
  // Round 8 §4: the Current panel's tag names its own column ("Results 2024/25",
  // "Context 2024/25") rather than the generic "Current", so a panel read on its own --
  // fullscreen, or printed -- still says which card it came from. Absent falls back to
  // the old wording, which is what any caller that has not been given a name wants.
  currentLabel?: string;
  // Round 2 §5: which subjects % change draws a bar for. "all" = every subject handed in
  // (Column 1's category); "focus" = the focused subject and the groups only, for Context,
  // whose subject list is now the whole school -- twenty-odd bars would be unreadable.
  //
  // Trend redesign steps 9-10 replace "focus" with two modes for Context, whose subject
  // list is either a hand-picked Selected set or the whole school:
  //   "individual" -- Selected subjects: like Column 1 Candidates. Every subject its own
  //                   line (Option B / D2) or row (Option H), tables E and I beside them.
  //   "curated"    -- All subjects: Trend is Option K (focus + top movers + a rest-of-
  //                   school band) with a table of the same curated rows on the card;
  //                   % change is Option H over every subject (a list scales fine).
  // "all" is Column 1 Results' classic behaviour and is deliberately unchanged by both.
  changeScope?: "all" | "individual" | "curated";
  // Live review Part D: Context's Trend lines take the categorical palette, which has light
  // and dark versions and skips hues close to the phase accent (see paletteInOrder).
  theme?: "dark" | "light";
  accentHex?: string | null;
  // The Current table's third-column heading, where the caller wants a fixed one --
  // Context's "vs average", the same whichever compare-against set is chosen. Absent =
  // "vs {benchmarkLabel}" (Results' "vs National"), or "vs last year" with no benchmark.
  deltaHeading?: string;
  // Results' Current bars: ViewChart's roomier row style (thicker, more spaced, wrapping
  // labels). Context does not pass it and keeps the compact rows.
  spaciousBars?: boolean;
}) {
  const [view, setView] = useState<"donut" | "bar" | "table">(donut ? "donut" : "bar");
  const [sort, setSort] = useState<SortState>({ key: "delta", dir: "desc" });
  const [yearIdx, setYearIdx] = useState<number | null>(null);
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);
  // Steps 9-10: Context's Trend and % change gain a table beside their chart.
  const [trendView, setTrendView] = useState<"chart" | "table">("chart");
  const [changeView, setChangeView] = useState<"chart" | "table">("chart");
  const redesigned = changeScope !== "all";

  // The donut is Candidates-only, so a measure switch has to fall back rather than leave
  // the panel on a view it can no longer draw.
  const effectiveView = view === "donut" && !donut?.enabled ? "bar" : view;

  // The source line with the caveat after it -- what every panel's "i" opens.
  const sourceWithNote = (span?: string) => {
    const cited = source(span);
    return note ? (
      <>
        {cited}
        <span className="mt-1.5 block">{note}</span>
      </>
    ) : cited;
  };

  const spanLabel = (ps: number[]) =>
    ps.length ? `${academicYearLabel(ps[0])}–${academicYearLabel(ps[ps.length - 1])}` : "";

  // --------------------------------------------------------------- Current
  // Only the years this measure genuinely has a figure for, so the year menu can never
  // offer an empty one (§6.3). The threshold measure is the case that matters:
  // switching to it shortens this list rather than padding the axis.
  const realIdx = periods.map((_, i) => i).filter((i) => subjects.some((s) => s.values[i] !== null));
  // The latest period any subject has a figure for -- not simply the last period in the
  // list, which may be a year this measure has not been published for yet.
  const defaultIdx = realIdx.length ? realIdx[realIdx.length - 1] : -1;
  // A year chosen in the year menu survives a measure switch only while that year
  // still has data; otherwise it falls back rather than showing an empty card.
  const latestIdx = yearIdx !== null && realIdx.includes(yearIdx) ? yearIdx : defaultIdx;
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

  // The focused subject's key, resolved once -- highlighted in the bars and table, and
  // the one Trend and the donut follow.
  const focusedKey = (subjects.find((s) => s.key === focus) ?? subjects[0])?.key ?? null;

  const rows = subjects.map((s) => {
    const value = latestIdx >= 0 ? s.values[latestIdx] : null;
    const bench = latestIdx >= 0 ? s.benchmark?.[latestIdx] ?? null : null;
    const against = benchmarkLabel ? bench : previousValue(s);
    const delta = value !== null && against !== null ? value - against : null;
    return { s, value, bench, delta };
  });

  const barRows = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  // Steps 9-10: in Context's modes every subject is tinted in Current's own order -- the
  // grey ramp, lightest for the largest -- with the focus in the accent, the same colours
  // in Current, Trend and % change. Results keeps the colours it is handed.
  const tints = tintInOrder(barRows.map((r) => r.s.key), focusedKey, FOCUS_COLOUR);
  const colourFor = (s: SubjectSeries) => (redesigned ? tints.get(s.key) ?? s.colour : s.colour);
  // Live review Part D: the Trend LINE chart alone gets real hues for the non-focused
  // subjects, as Candidates' does (b518e1e) -- same helper, same order, same focus accent.
  // Current's bars and % change keep the grey ramp above. In both Context modes: Selected
  // subjects draws every subject as a line; All subjects (Option K) draws the focus and
  // four standouts, which need telling apart just as much -- the rest-of-school band
  // stays grey. The Trend table's dots read the same series, so they match the lines.
  const trendColours = paletteInOrder(
    barRows.map((r) => r.s.key),
    focusedKey,
    FOCUS_COLOUR,
    theme === "light" ? PALETTE_LIGHT : PALETTE_DARK,
    accentHex,
  );

  // Round 2 §5: the table reads like Comparisons' ranking -- no colour dots, the focused
  // subject's row tinted in the phase accent and centred when the list scrolls.
  const tableRows: SortRow[] = rows.map((r) => ({
    key: r.s.key,
    label: r.s.label,
    highlight: r.s.key === focusedKey,
    emphasis: r.s.key === focusedKey,
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
  // Round 2 §D2: in Context's modes (whose rows can be the whole school)
  // the sentence is about the focused subject alone. The extremes above only described it
  // when it happened to be top or bottom -- History focused read as a sentence about
  // Maths and Turkish.
  const focusedRow = rows.find((r) => r.s.key === focusedKey && r.delta !== null);

  // The donut's two numbers: the focused subject as a share of the comparison group's own
  // total for the SAME year Current is showing.
  const focusedSubject = subjects.find((s) => s.key === focus) ?? subjects[0];
  const donutValue = latestIdx < 0 || !focusedSubject ? null : focusedSubject.values[latestIdx];
  const donutGroupValue = latestIdx >= 0 ? donut?.groupTotals[latestIdx] ?? null : null;
  const donutPercent =
    donutValue !== null && donutGroupValue !== null && donutGroupValue > 0 ? (donutValue / donutGroupValue) * 100 : null;

  const current: PanelRender = {
    tag:
      yearControl && realIdx.length > 1 && currentLabel
        ? currentLabel
        : currentLabel
          ? `${currentLabel} ${latest === null ? "" : academicYearLabel(latest)}`.trim()
          : `Current — ${latest === null ? "no year" : academicYearLabel(latest)}`,
    question: questions.current,
    // Round 2 §4: Context's year choice is the same dropdown Trends and % Change use, in
    // its one-year mode, beside the tag -- replacing a prev/next chevron pair whose
    // usually-disabled left chevron read as a stray "back" button. The year leaves the
    // tag text, since the menu beside it now says it.
    afterTag: yearControl && realIdx.length > 1 ? (
      <FromYearMenu mode="year" periods={realIdx.map((i) => periods[i])} from={latest} onChange={(p) => setYearIdx(periods.indexOf(p))} />
    ) : undefined,
    actions: (
      <>
        {donut && (
          <IconButton
            label={donut.enabled ? "Share (donut)" : "Share is only meaningful for candidate numbers"}
            active={effectiveView === "donut"}
            disabled={!donut.enabled}
            onClick={() => setView("donut")}
          >
            {DonutIcon}
          </IconButton>
        )}
        <IconButton label="Bar chart" active={effectiveView === "bar"} onClick={() => setView("bar")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Sortable table" active={effectiveView === "table"} onClick={() => setView("table")}>{RankListIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      subjects.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <>
          {effectiveView === "donut" && donut ? (
            donutPercent === null ? (
              <p className="text-xs text-[var(--muted)]">
                No published figure for {focusedSubject?.label ?? "these subjects"} or for {donut.groupLabel} in{" "}
                {latest === null ? "this year" : academicYearLabel(latest)}.
              </p>
            ) : (
              <ShareDonut
                percent={donutPercent}
                label={focusedSubject?.label ?? ""}
                groupLabel={donut.groupLabel}
                valueLabel={measure.format(donutValue!)}
                groupValueLabel={measure.format(donutGroupValue!)}
                colour={focusedSubject?.colour ?? "var(--muted2)"}
                fullscreen={fullscreen}
              />
            )
          ) : effectiveView === "bar" ? (
            // Round 2 §5: with a long list (Context's whole school) the bars scroll inside
            // the panel, starting with the focused subject in view.
            <CentredOnTarget watch={`bar:${focusedKey}:${barRows.map((r) => r.s.key).join(",")}`}>
              <ViewChart
                layout="row"
                unit=""
                formatValue={measure.format}
                markerLabel={benchmarkLabel ? `${benchmarkLabel} average` : undefined}
                scaleMax={measure.barScaleMax ?? undefined}
                spacious={spaciousBars}
                computed={{
                  rows: barRows.map((r) => ({
                    label: r.s.label,
                    value: r.value,
                    isSubject: true,
                    color: colourFor(r.s),
                    marker: r.bench,
                    emphasis: r.s.key === focusedKey,
                  })),
                }}
              />
            </CentredOnTarget>
          ) : (
            <CentredOnTarget watch={`table:${focusedKey}:${sort.key}:${sort.dir}:${tableRows.length}`}>
              <SortTable
                rows={tableRows}
                sort={sort}
                onSort={(key) => setSort(nextSort(sort, key))}
                // Micro fix Part 1: "Entries" for a candidate count; and in Context the third
                // column is each subject against the comparison group's average, so Context
                // passes a fixed "vs average" (deltaHeading) -- "vs All subjects" read as
                // something else and crowded the narrow header. Results keeps "vs National".
                columns={{
                  name: "Subject",
                  value: measure.id === "entries" ? "Entries" : "Result",
                  delta: !benchmarkLabel ? "vs last year" : deltaHeading ?? `vs ${benchmarkLabel}`,
                }}
                fullscreen={fullscreen}
              />
            </CentredOnTarget>
          )}
        </>
      ),
    summary:
      effectiveView === "donut" && donut ? (
        donutPercent === null ? undefined : (
          <PanelSummary>
            {focusedSubject?.label} is {Math.round(donutPercent)}% of{" "}
            {donut.shareOf ?? donut.groupLabel.toLowerCase()} ({measure.format(donutGroupValue!)}) in{" "}
            {latest === null ? "this year" : academicYearLabel(latest)}.
          </PanelSummary>
        )
      ) : changeScope !== "all" ? (
        // No delta for the focused subject = no sentence, the same as the undefined
        // branch below when no row has one.
        focusedRow ? (
          <PanelSummary>
            {focusedRow.s.label} sits {measure.formatDelta(focusedRow.delta!)} against {againstNoun}.
          </PanelSummary>
        ) : undefined
      ) : bestRow && worstRow ? (
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
    source: sourceWithNote(),
    // S10: the collapsed bar's figure -- the focused subject's own value this year.
    headline: (() => {
      const v = focusedSubject && latestIdx >= 0 ? focusedSubject.values[latestIdx] : null;
      return v === null ? undefined : measure.format(v);
    })(),
  };

  // ----------------------------------------------------------------- Trend
  const focused = focusedSubject;
  const focusLabel = focused?.label ?? "";

  // Context's modes draw every subject individually, in Current's order; Results keeps
  // its focused line against the group line(s).
  const trendFull: PanelData = trimToData({
    periods,
    series: redesigned
      ? barRows.map((r) => ({ key: r.s.key, label: r.s.label, colour: trendColours.get(r.s.key) ?? colourFor(r.s), values: r.s.values }))
      : [
          ...(focused ? [{ key: focused.key, label: focused.label, colour: focused.colour, values: focused.values }] : []),
          ...groups.map((g, gi) => ({ key: `group-${gi}`, label: g.label, colour: g.colour ?? "var(--muted3)", values: g.values, comparison: true })),
        ],
  });
  const trendPeriods = periodsWithData(trendFull);
  const trendData = sliceFrom(trendFull, trendStart);
  const trendSaid = trendSentence({
    // A plural subject name takes a bare possessive -- "Classics's" reads as a typo.
    subjectClause: `${focusLabel}${focusLabel.endsWith("s") ? "'" : "'s"} ${measure.noun}`,
    values: trendData.series.find((x) => x.key === focused?.key)?.values ?? [],
    measure,
    startLabel: trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "",
  });
  // A trend with a group line says what the (first) group did over the same years, so
  // the focus line is never read in isolation.
  const groupClause = (() => {
    const first = trendData.series.find((x) => x.key === "group-0");
    if (!first) return "";
    const vals = first.values.filter((v): v is number => v !== null);
    if (vals.length < 2) return "";
    return ` — against ${first.label.toLowerCase()}'s own ${measure.format(vals[0])} to ${measure.format(vals[vals.length - 1])} over the same years.`;
  })();

  const trend: PanelRender = {
    // S11: one uniform title, with the span's start as its own dropdown beside it.
    tag: "Trends",
    afterTag: <FromYearMenu periods={trendPeriods} from={trendData.periods[0] ?? null} onChange={setTrendStart} />,
    question: questions.trend,
    // S12: the direction flag sits right-aligned in the footer; the full sentence is its
    // tooltip here and the caption in fullscreen, where there is room for it.
    flag: trendSaid ? (
      <span title={trendSaid.sentence} style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ) : undefined,
    footerLead: (
      <TrendLineToggle
        on={showFit}
        onToggle={() => setShowFit(!showFit)}
        disabled={redesigned ? trendView === "table" || !multiTrendHasLine(trendData) : trendChartKind(trendData) === "bars"}
      />
    ),
    actions: redesigned ? (
      <>
        <IconButton label="Chart" active={trendView === "chart"} onClick={() => setTrendView("chart")}>{TrendLineIcon}</IconButton>
        <IconButton label="Table" active={trendView === "table"} onClick={() => setTrendView("table")}>{TableIcon}</IconButton>
      </>
    ) : undefined,
    body: (fullscreen) =>
      !redesigned ? (
        <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} />
      ) : trendView === "table" ? (
        // All subjects: the card lists the rows the K chart draws (read from the same
        // curatedKeys/topMovers call) plus one rest-of-school range row; fullscreen, all.
        <CentredOnTarget watch={`trend-table:${focusedKey}:${trendData.periods.join(",")}`}>
          <YearTable
            data={trendData}
            measure={measure}
            focusKey={focusedKey}
            fullscreen={fullscreen}
            curate={changeScope === "curated" ? { keys: curatedKeys(trendData, measure, focusedKey), restLabel: "Rest of school" } : undefined}
          />
        </CentredOnTarget>
      ) : (
        <MultiTrend
          data={trendData}
          measure={measure}
          focusKey={focusedKey}
          curated={changeScope === "curated"}
          restLabel="rest of school"
          showFit={showFit}
          fullscreen={fullscreen}
        />
      ),
    summary: trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence.replace(/\.$/, "")}{groupClause || "."}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend.</PanelSummary>
    ),
    source: sourceWithNote(spanLabel(trendData.periods)),
    headline: trendSaid ? (
      <span style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ) : undefined,
  };

  // -------------------------------------------------------------- % change
  const changeFull: PanelData = trimToData({
    periods,
    series: [
      ...(redesigned ? barRows.map((r) => r.s) : subjects).map((s) => ({ key: s.key, label: s.label, colour: colourFor(s), values: s.values })),
      // §4.2: one extra bar per comparison group, alongside the per-subject ones --
      // "individual subjects and the school as a whole" in one picture.
      ...groups.map((g, gi) => ({ key: `group-${gi}`, label: g.label, colour: g.colour ?? "#57534e", values: g.values })),
    ],
  });
  const changePeriods = periodsWithData(changeFull);
  const changeData = sliceFrom(changeFull, changeStart);
  const changeBars: ChangeBar[] = changeData.series.map((s) => ({
    key: s.key,
    label: s.label,
    shortLabel: subjects.find((x) => x.key === s.key)?.shortLabel ?? s.label,
    colour: s.colour,
    percent: percentChange(s.values),
  }));
  // In Context's modes the group is a reference line, not a ranked peer (Option H).
  const rankedChange = changeBars
    .filter((b) => b.percent !== null && !(redesigned && b.key.startsWith("group-")))
    .sort((a, b) => b.percent! - a.percent!);
  const bestChange = rankedChange[0];
  const worstChange = rankedChange[rankedChange.length - 1];
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";

  const change: PanelRender = {
    tag: "% Change",
    afterTag: <FromYearMenu periods={changePeriods} from={changeData.periods[0] ?? null} onChange={setChangeStart} />,
    question: questions.change,
    actions: redesigned ? (
      <>
        <IconButton label="Ranked change" active={changeView === "chart"} onClick={() => setChangeView("chart")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Table" active={changeView === "table"} onClick={() => setChangeView("table")}>{TableIcon}</IconButton>
      </>
    ) : undefined,
    body: (fullscreen) =>
      !redesigned ? (
        <ChangeChart bars={changeBars} fullscreen={fullscreen} />
      ) : changeView === "table" ? (
        <CentredOnTarget watch={`change-table:${focusedKey}:${changeData.periods.join(",")}`}>
          <YearTable
            data={{ periods: changeData.periods, series: changeData.series.filter((x) => !x.key.startsWith("group-")) }}
            measure={measure}
            focusKey={focusedKey}
            fullscreen={fullscreen}
            // Live review Part E: ranked by change, bare rank first, no sorting.
            leadingRank
          />
        </CentredOnTarget>
      ) : (
        // Option H over every subject -- a list, so twenty rows just scroll.
        <CentredOnTarget watch={`change-list:${focusedKey}:${changeData.periods.join(",")}`}>
          <ChangeList
            rows={changeBars.filter((b) => !b.key.startsWith("group-"))}
            focusKey={focusedKey}
            group={
              groups[0]
                ? { label: groups[0].label, percent: percentChange(changeData.series.find((x) => x.key === "group-0")?.values ?? []) }
                : undefined
            }
          />
        </CentredOnTarget>
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
    source: sourceWithNote(spanLabel(changeData.periods)),
    headline: (() => {
      const p = changeBars.find((b) => b.key === focusedSubject?.key)?.percent ?? null;
      return p === null || p === undefined ? undefined : `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p))}%`;
    })(),
  };

  return (
    <ColumnPanels
      columnId={columnId}
      panels={panels}
      onPanelsChange={onPanelsChange}
      notes={notes}
      controls={controls}
      render={{ current, trend, change }}
    />
  );
}
