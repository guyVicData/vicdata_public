"use client";

// Teacher view, round 6: the Candidates card's three panels (Main.dc.html; brief §3).
//
// Candidates has no per-column section of its own in the build order because §3 IS its
// section -- it is the column the cross-column panel mechanism was designed against, so
// it gets the wireframe's full treatment here: Current as bars or a ranked list, Trend as
// one focused line with a chip row, % change as every taught subject side by side.
//
// Every figure is the school's own real entries, from the same `entries` rows the card
// already counted before this round -- grouped by period rather than collapsed to the
// latest one. Nothing here is derived a second way.
import { useState, type ReactNode } from "react";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import {
  DIRECTION_ARROW,
  DIRECTION_WORD,
  ENTRIES_MEASURE,
  meanOf,
  percentChange,
  periodsWithData,
  sliceFrom,
  trimToData,
  trendSentence,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { FromYearMenu } from "./FromYearMenu";
import { TrendLineToggle } from "./PanelFooter";
import { type ChangeBar } from "./ChangeChart";
import { HorizontalBarsIcon, IconButton, RankListIcon, TableIcon, TrendLineIcon, VerticalBarsIcon } from "./PanelIcons";
import { CentredOnTarget } from "./CentredOnTarget";
import { ChangeList, MultiTrend, YearTable, multiTrendHasLine } from "./SeriesViews";
import { FOCUS_COLOUR, tintInOrder } from "@/lib/teacher-view-trend-styles";
import { VerticalBars } from "./VerticalBars";

// Trend/% change redesign step 1: each subject arrives with its own values, aligned to the
// `periods` prop, read by the page from `headline`'s entriesTotal -- the same source and
// field Context and Results already read. It used to be derived here from the raw
// dfe_ks4_subject_entries facts, which only go back to 2023/24 (deliberately: the older
// sibling source's labels are ambiguous), and that short run was the whole reason
// Candidates' Trend and From menu stopped at 2023/24 while Context's went back to 2020/21.
// No colour: the redesign tints subjects here, in Current's order (step 2).
// `shortLabel` comes from the one shared shortener (step 8), computed by the page over
// every subject shown together so its collision check can see them all.
export type CandidateSubject = { key: string; subject: string; label: string; shortLabel: string; values: (number | null)[] };

// The summary sentences name the direction in colour, matching the wireframe: teal for
// growth, amber for decline, muted for flat. Same two tones the delta badges use.
const DIRECTION_COLOUR = { up: "#0d9488", down: "#b45309", flat: "var(--muted)" } as const;

export function CandidatesPanels({
  phase,
  subjects,
  periods,
  panels,
  onPanelsChange,
  notes,
  question,
  source,
  currentLabel,
  focus,
  groupLabel,
  categoryLabel,
}: {
  phase: TeacherPhase;
  subjects: CandidateSubject[];
  // Every period any of `subjects` has a figure for, ascending.
  periods: number[];
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  notes?: PanelNotes;
  question: string;
  source: (span?: string) => ReactNode;
  // §4: the Current tag names the column ("Candidates 2024/25") -- see SubjectPanels.
  currentLabel?: string;
  // The dashboard's one focus subject (content round S5: no "All"). Trend follows it, or
  // the first subject when it is not among `subjects`.
  focus: string | null;
  // Content round S6: `subjects` is the focused subject and its category peers, and this
  // names their per-subject average ("Sciences & Maths average"), drawn as Trend's dashed
  // line and one extra % change bar. Absent, or one subject only = no group to draw.
  groupLabel?: string;
  // The category itself ("Sciences & Maths") -- the same family label `groupLabel` is built
  // from -- for the "Entries in {category}" title over every panel.
  categoryLabel?: string;
}) {
  const [view, setView] = useState<"bars" | "list">("bars");
  // Step 6: Trend and % change each gain a table beside their chart.
  const [trendView, setTrendView] = useState<"chart" | "table">("chart");
  const [changeView, setChangeView] = useState<"chart" | "table">("chart");
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);

  const measure = ENTRIES_MEASURE;

  const valueAt = (s: CandidateSubject, period: number): number | null => s.values[periods.indexOf(period)] ?? null;

  // Trend redesign step 2: one colour per subject for every view -- greys in Current's own
  // order (largest this year first, lightest grey first), the focused subject in the
  // accent. Worked out once here so Current, Trend and % Change cannot disagree.
  const latestPeriod = periods.length ? periods[periods.length - 1] : null;
  const currentOrder = [...subjects].sort(
    (a, b) => ((latestPeriod === null ? null : valueAt(b, latestPeriod)) ?? -Infinity) - ((latestPeriod === null ? null : valueAt(a, latestPeriod)) ?? -Infinity),
  );
  const tints = tintInOrder(currentOrder.map((s) => s.key), focus ?? subjects[0]?.key ?? null, FOCUS_COLOUR);
  const colourOf = (key: string) => tints.get(key) ?? "var(--muted3)";

  const subjectSeries = currentOrder.map((s) => ({ key: s.key, label: s.label, colour: colourOf(s.key), values: s.values }));

  const focused = subjects.find((s) => s.key === focus) ?? subjects[0];
  // Self-inclusive, per subject -- a category "average" of candidate numbers is what one
  // subject is comparable with; the category's total would dwarf it.
  const group =
    groupLabel && subjects.length > 1
      ? { key: "group", label: groupLabel, colour: "var(--muted3)", values: periods.map((_, i) => meanOf(subjectSeries.map((s) => s.values[i]))) }
      : null;
  // Steps 2, 4, 5: Trend draws EVERY subject in the category individually -- the same
  // series % change already used -- not the focused subject against one category-average
  // line. MultiTrend picks the form: Option B under four real years, Option D2 (each
  // subject indexed to its own first year) from four.
  const trendFull: PanelData = trimToData({ periods, series: subjectSeries });

  const trendPeriods = periodsWithData(trendFull);
  const trendData = sliceFrom(trendFull, trendStart);
  const trendFocusData = trendData.series.find((s) => s.key === focused?.key);
  const changeFull = trimToData({ periods, series: [...subjectSeries, ...(group ? [{ ...group, colour: "#57534e" }] : [])] });
  const changeData = sliceFrom(changeFull, changeStart);
  // The subjects alone, without the group series -- what the tables list.
  const changeSubjectsData: PanelData = { periods: changeData.periods, series: changeData.series.filter((s) => s.key !== "group") };
  const changePeriods = periodsWithData(changeFull);

  const spanLabel = (data: PanelData) =>
    data.periods.length ? `${academicYearLabel(data.periods[0])}–${academicYearLabel(data.periods[data.periods.length - 1])}` : "";

  // ------------------------------------------------------------------ Current
  const latest = periods.length ? periods[periods.length - 1] : null;
  const currentRows = subjects
    .map((s) => ({ ...s, value: latest === null ? null : valueAt(s, latest) }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  const withFigures = currentRows.filter((r) => r.value !== null);
  const biggest = withFigures[0];
  const smallest = withFigures[withFigures.length - 1];

  const current: PanelRender = {
    tag: currentLabel
      ? `${currentLabel} ${latest === null ? "" : academicYearLabel(latest)}`.trim()
      : `Current — ${latest === null ? "no year" : academicYearLabel(latest)}`,
    question,
    actions: (
      <>
        <IconButton label="Bar chart" active={view === "bars"} onClick={() => setView("bars")}>{VerticalBarsIcon}</IconButton>
        <IconButton label="Ranked list" active={view === "list"} onClick={() => setView("list")}>{RankListIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      currentRows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Pick a subject to see its entries.</p>
      ) : view === "bars" ? (
        <VerticalBars
          bars={currentRows.map((r) => ({ key: r.key, label: r.label, shortLabel: r.shortLabel, value: r.value, colour: colourOf(r.key) }))}
          measure={measure}
          fullscreen={fullscreen}
        />
      ) : (
        <ol className="flex flex-col gap-1.5 px-0.5 text-[12.5px] text-[var(--muted2)]">
          {currentRows.map((r, i) => (
            <li key={r.key}>
              <span className="tabular-nums">{i + 1}</span>&nbsp;&nbsp;
              <span className="font-medium text-[var(--fg)]">{r.label}</span> —{" "}
              {r.value === null ? "no published figure" : `${measure.format(r.value)} candidates`}
            </li>
          ))}
        </ol>
      ),
    summary: biggest && smallest && biggest.key !== smallest.key ? (
      <PanelSummary>
        {biggest.label} is the largest subject {groupLabel ? "in this category " : ""}this year with {measure.format(biggest.value!)} candidates; {smallest.label} the
        smallest, with {measure.format(smallest.value!)}.
      </PanelSummary>
    ) : biggest ? (
      <PanelSummary>{biggest.label} is the only subject with a published entry count this year ({measure.format(biggest.value!)}).</PanelSummary>
    ) : undefined,
    source: source(),
    // S10: the collapsed bar's figure -- the focused subject's candidates this year.
    headline: (() => {
      const v = focused && latest !== null ? valueAt(focused, latest) : null;
      return v === null ? undefined : measure.format(v);
    })(),
  };

  // -------------------------------------------------------------------- Trend
  const trendFocusValues = trendFocusData?.values ?? [];
  const trendSaid = trendSentence({
    subjectClause: `The number of ${focused?.label ?? ""} candidates`,
    values: trendFocusValues,
    measure,
    startLabel: trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "",
  });

  const trend: PanelRender = {
    // S11: one uniform title, with the span's start as its own dropdown beside it.
    tag: "Trends",
    afterTag: <FromYearMenu periods={trendPeriods} from={trendData.periods[0] ?? null} onChange={setTrendStart} />,
    question: "How have candidate numbers moved, year on year?",
    // S12: the direction flag sits right-aligned in the footer; the full sentence is its
    // tooltip here and the caption in fullscreen, where there is room for it.
    flag: trendSaid ? (
      <span title={trendSaid.sentence} style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ) : undefined,
    footerLead: (
      <TrendLineToggle on={showFit} onToggle={() => setShowFit(!showFit)} disabled={trendView === "table" || !multiTrendHasLine(trendData)} />
    ),
    actions: (
      <>
        <IconButton label="Chart" active={trendView === "chart"} onClick={() => setTrendView("chart")}>{TrendLineIcon}</IconButton>
        <IconButton label="Table" active={trendView === "table"} onClick={() => setTrendView("table")}>{TableIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      trendView === "table" ? (
        // Option E: the real headcounts the indexed chart hides -- first and last year on
        // the card, every year in fullscreen.
        <CentredOnTarget watch={`trend-table:${focused?.key}:${trendData.periods.join(",")}`}>
          <YearTable data={trendData} measure={measure} focusKey={focused?.key ?? null} fullscreen={fullscreen} />
        </CentredOnTarget>
      ) : (
        <MultiTrend data={trendData} measure={measure} focusKey={focused?.key ?? null} showFit={showFit} fullscreen={fullscreen} />
      ),
    summary: trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend.</PanelSummary>
    ),
    source: source(spanLabel(trendData)),
    headline: trendSaid ? (
      <span style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ) : undefined,
  };

  // ---------------------------------------------------------------- % change
  const changeBars: ChangeBar[] = changeData.series.map((s) => ({
    key: s.key,
    label: s.label,
    shortLabel: subjects.find((x) => x.key === s.key)?.shortLabel ?? s.label,
    colour: s.colour,
    percent: percentChange(s.values),
  }));
  const ranked = changeBars.filter((b) => b.key !== "group" && b.percent !== null).sort((a, b) => b.percent! - a.percent!);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";

  const change: PanelRender = {
    tag: "% Change",
    afterTag: <FromYearMenu periods={changePeriods} from={changeData.periods[0] ?? null} onChange={setChangeStart} />,
    question: "Which subjects in this category are growing, and which are shrinking?",
    actions: (
      <>
        <IconButton label="Ranked change" active={changeView === "chart"} onClick={() => setChangeView("chart")}>{HorizontalBarsIcon}</IconButton>
        <IconButton label="Table" active={changeView === "table"} onClick={() => setChangeView("table")}>{TableIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      changeView === "table" ? (
        // Option I: the base year and the latest beside the change, so a big % on a
        // handful of candidates reads as what it is.
        <CentredOnTarget watch={`change-table:${focused?.key}:${changeData.periods.join(",")}`}>
          <YearTable data={changeSubjectsData} measure={measure} focusKey={focused?.key ?? null} fullscreen={fullscreen} />
        </CentredOnTarget>
      ) : (
        // Step 7, Option H: ranked by % change, the category average a dashed line
        // through the rows rather than an eighth bar competing with the subjects.
        <CentredOnTarget watch={`change-list:${focused?.key}:${changeData.periods.join(",")}`}>
          <ChangeList
            rows={changeBars.filter((b) => b.key !== "group")}
            focusKey={focused?.key ?? null}
            group={group ? { label: group.label, percent: percentChange(changeData.series.find((s) => s.key === "group")?.values ?? []) } : undefined}
          />
        </CentredOnTarget>
      ),
    summary:
      best && worst && best.key !== worst.key ? (
        <PanelSummary>
          {best.label} has grown the most ({best.percent! >= 0 ? "+" : "−"}
          {Math.abs(Math.round(best.percent!))}%); {worst.label}{" "}
          {worst.percent! < 0 ? "has declined the most" : "has grown the least"} ({worst.percent! >= 0 ? "+" : "−"}
          {Math.abs(Math.round(worst.percent!))}%) since {changeSince}.
        </PanelSummary>
      ) : (
        <PanelSummary>Not enough published years yet to compare subjects on change.</PanelSummary>
      ),
    source: source(spanLabel(changeData)),
    headline: (() => {
      const p = changeBars.find((b) => b.key === focused?.key)?.percent ?? null;
      return p === null || p === undefined ? undefined : `${p >= 0 ? "+" : "−"}${Math.abs(Math.round(p))}%`;
    })(),
  };

  // KS2 never reaches here: it has no subject picker, so there is nothing to plot per
  // subject. The dashboard renders its own single box for that phase instead.
  if (phase === "ks2") return null;

  // Live review Part 2: every panel names the category it is comparing within, above the
  // chart or table, whichever view is showing. Only when there IS a comparison (the
  // category average exists, i.e. more than one subject); a lone subject has nothing to
  // name, so no title rather than an empty-feeling one.
  const titled = (panel: PanelRender): PanelRender =>
    group && categoryLabel
      ? {
          ...panel,
          body: (fullscreen) => (
            <>
              <p className="shrink-0 text-[12px] font-semibold text-[var(--muted2)]">Entries in {categoryLabel}</p>
              {panel.body(fullscreen)}
            </>
          ),
        }
      : panel;

  return (
    <ColumnPanels
      columnId="candidates"
      panels={panels}
      onPanelsChange={onPanelsChange}
      notes={notes}
      render={{ current: titled(current), trend: titled(trend), change: titled(change) }}
    />
  );
}
