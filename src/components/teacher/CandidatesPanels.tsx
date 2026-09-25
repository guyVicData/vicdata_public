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
import { useMemo, useState, type ReactNode } from "react";
import type { SubjectEntry } from "@/lib/academic-data-view";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import {
  DIRECTION_ARROW,
  DIRECTION_WORD,
  ENTRIES_MEASURE,
  meanOf,
  nextStart,
  percentChange,
  periodsWithData,
  sliceFrom,
  trimToData,
  startOptions,
  trendSentence,
  type PanelData,
  type PanelId,
} from "@/lib/teacher-view-panels";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { ChangeChart, type ChangeBar } from "./ChangeChart";
import { IconButton, Pill, RankListIcon, VerticalBarsIcon } from "./PanelIcons";
import { TrendChart } from "./TrendChart";
import { VerticalBars } from "./VerticalBars";

export type CandidateSubject = { key: string; subject: string; qualificationType: string; label: string; colour: string };

// The summary sentences name the direction in colour, matching the wireframe: teal for
// growth, amber for decline, muted for flat. Same two tones the delta badges use.
const DIRECTION_COLOUR = { up: "#0d9488", down: "#b45309", flat: "var(--muted)" } as const;

// A four-letter stub ("Geog.", "Chem.") under a bar, where the full name would not fit.
function shortLabel(label: string): string {
  return label.length <= 6 ? label : `${label.slice(0, 4)}.`;
}

export function CandidatesPanels({
  phase,
  subjects,
  entries,
  panels,
  onPanelsChange,
  notes,
  question,
  source,
  currentLabel,
  focus,
  groupLabel,
}: {
  phase: TeacherPhase;
  subjects: CandidateSubject[];
  entries: SubjectEntry[];
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
}) {
  const [view, setView] = useState<"bars" | "list">("bars");
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);

  const measure = ENTRIES_MEASURE;

  // Every period any TICKED subject has entries for, ascending. Restricted to the ticked
  // set rather than the whole school, or a year only an untaught subject has data for
  // would open as an empty column on the chart. Derived from the data rather than a
  // constant, per §6.3 -- there is no hardcoded start year anywhere.
  const mine = useMemo(() => {
    const keys = new Set(subjects.map((s) => `${s.subject}::${s.qualificationType}`));
    return entries.filter((e) => keys.has(`${e.subject}::${e.qualificationType}`));
  }, [entries, subjects]);
  const periods = useMemo(() => Array.from(new Set(mine.map((e) => e.period))).sort((a, b) => a - b), [mine]);

  const valueAt = (s: CandidateSubject, period: number): number | null => {
    const rows = mine.filter((e) => e.subject === s.subject && e.qualificationType === s.qualificationType && e.period === period);
    return rows.length ? rows.reduce((a, r) => a + r.entries, 0) : null;
  };

  const subjectSeries = subjects.map((s) => ({
    key: s.key,
    label: s.label,
    colour: s.colour,
    values: periods.map((p) => valueAt(s, p)),
  }));

  const focused = subjects.find((s) => s.key === focus) ?? subjects[0];
  // Self-inclusive, per subject -- a category "average" of candidate numbers is what one
  // subject is comparable with; the category's total would dwarf it.
  const group =
    groupLabel && subjects.length > 1
      ? { key: "group", label: groupLabel, colour: "var(--muted3)", values: periods.map((_, i) => meanOf(subjectSeries.map((s) => s.values[i]))) }
      : null;
  const focusSeries: PanelData = trimToData({
    periods,
    series: [
      ...(focused
        ? [{ key: focused.key, label: focused.label, colour: focused.colour, values: subjectSeries.find((s) => s.key === focused.key)!.values }]
        : []),
      ...(group ? [{ ...group, comparison: true }] : []),
    ],
  });

  const trendPeriods = periodsWithData(focusSeries);
  const trendData = sliceFrom(focusSeries, trendStart);
  const changeFull = trimToData({ periods, series: [...subjectSeries, ...(group ? [{ ...group, colour: "#57534e" }] : [])] });
  const changeData = sliceFrom(changeFull, changeStart);
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
          bars={currentRows.map((r) => ({ key: r.key, label: r.label, shortLabel: shortLabel(r.subject), value: r.value, colour: r.colour }))}
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
  };

  // -------------------------------------------------------------------- Trend
  const trendFocusValues = trendData.series[0]?.values ?? [];
  const trendSaid = trendSentence({
    subjectClause: `The number of ${focused?.label ?? ""} candidates`,
    values: trendFocusValues,
    measure,
    startLabel: trendData.periods.length ? academicYearLabel(trendData.periods[0]) : "",
  });

  const trend: PanelRender = {
    tag: `Candidates — ${spanLabel(trendData) || "no history"}`,
    question: "How have candidate numbers moved, year on year?",
    controls: (
      <div className="flex flex-wrap items-center justify-end gap-2">
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
    body: (fullscreen) => <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} />,
    summary: trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend.</PanelSummary>
    ),
    source: source(spanLabel(trendData)),
  };

  // ---------------------------------------------------------------- % change
  const changeBars: ChangeBar[] = changeData.series.map((s) => ({
    key: s.key,
    label: s.label,
    shortLabel: shortLabel(subjects.find((x) => x.key === s.key)?.subject ?? s.label),
    colour: s.colour,
    percent: percentChange(s.values),
  }));
  const ranked = changeBars.filter((b) => b.percent !== null).sort((a, b) => b.percent! - a.percent!);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";

  const change: PanelRender = {
    tag: `% change by subject — since ${changeSince || "—"}`,
    question: "Which of the subjects I teach are growing, and which are shrinking?",
    controls:
      startOptions(changePeriods).length > 1 ? (
        <div className="flex justify-end">
          <Pill
            label={`Since: ${changeSince || "—"} ▾`}
            onClick={() => setChangeStart(nextStart(changePeriods, changeStart ?? changePeriods[0] ?? null))}
          />
        </div>
      ) : undefined,
    body: (fullscreen) => <ChangeChart bars={changeBars} fullscreen={fullscreen} />,
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
  };

  // KS2 never reaches here: it has no subject picker, so there is nothing to plot per
  // subject. The dashboard renders its own single box for that phase instead.
  if (phase === "ks2") return null;

  return (
    <ColumnPanels
      columnId="candidates"
      panels={panels}
      onPanelsChange={onPanelsChange}
      notes={notes}
      render={{ current, trend, change }}
    />
  );
}
