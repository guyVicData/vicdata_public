"use client";

// Grade bands frontend round: Column 1 Results on Grade counts -- the focused subject's whole
// grade distribution, which has no single figure, so it gets its own three panels rather
// than being forced through the one-number-per-year panels every other measure uses:
//
//   Current   the distribution this year, each grade's share against England's share at the
//             same grade (GradeDistribution). 0.6.3 S1: a click selects one grade, a second
//             widens to the range between them, a third starts again; Clear (or clicking the
//             one selected grade) removes it. The selection IS the top bar's grade band
//             (band:range, the page's `selection`), so Columns 2 and 3 follow it, and the
//             summary is its answer line (src/lib/grade-selection.ts).
//   Trend     this year's spread against an earlier year's, grade by grade (the FromYearMenu
//             picks the earlier year) -- not a line, since there is no one number to plot.
//   % change  each grade's own count, first year to latest, in grade order (YearTable with
//             its change column), so the shift reads down the scale.
//
// Grade-level figures are published from 2021/22 (0.6.2; 2023/24 before), so Trend and %
// change have up to four years to work with, and with one say so rather than padding an axis.
import { useState, type ReactNode } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { ENTRIES_MEASURE, type PanelData, type PanelId } from "@/lib/teacher-view-panels";
import { bandRate, inlineRangeLabel, rangeLabel, type GradeRange } from "@/lib/subject-grades";
import { answerLine, englandShare, nextSelection, notRangeEndReason, rangeEndGrade, type Selection } from "@/lib/grade-selection";
import { gradeCounts } from "@/lib/grade-spread";
import type { FrameSetGrades, GradesFrame } from "@/lib/view-series/frames";
import { useSubjectGradeGeography, type GradeGeographyInput } from "@/lib/teacher-view-grade-geography";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { FromYearMenu } from "./FromYearMenu";
import { GradeDistribution } from "./GradeDistribution";
import { GradesIcon, IconButton, Pill, TableIcon } from "./PanelIcons";
import { ViewTitle, YearTable } from "./SeriesViews";

type OwnRow = { period: number; grade: string; entries: number };

export function GradeCountsPanels({
  columnId,
  subjectLabel,
  ownRows,
  geography,
  colour,
  panels,
  onPanelsChange,
  notes,
  question,
  source,
  controls,
  schoolSetGrades,
  selection = null,
}: {
  columnId: string;
  subjectLabel: string;
  // The focused subject's own per-grade rows, every year it has them.
  ownRows: OwnRow[];
  geography: GradeGeographyInput | null;
  colour: string;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  notes?: PanelNotes;
  question: string;
  source: (span?: string) => ReactNode;
  controls?: ReactNode;
  // 0.6.2 S3: the Compared-against set's grade rows, for a view of its own's "Add an average"
  // across schools (views=v2 only; built when asked).
  schoolSetGrades?: () => FrameSetGrades | null;
  // 0.6.3 S1 (R-COUNTS-SELECTION): the page's grade selection -- band:range, read without a
  // preset (savedSelection) -- on the focused subject's own scale, and how to change it.
  // null = nothing to select on (no focused subject's scale).
  selection?: { scale: string[]; range: GradeRange | null; onSelect: (next: Selection | null) => void } | null;
}) {
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [changeFrom, setChangeFrom] = useState<number | null>(null);
  // Trends row merge round: this year's spread against an earlier year, and each grade's
  // change, are two views of one Trends panel.
  const [trendsView, setTrendsView] = useState<"spread" | "changeTable">("spread");
  const isChange = trendsView === "changeTable";

  const geo = useSubjectGradeGeography(geography);
  const england = geo?.data?.national?.rows ?? [];
  // 0.6.1 S3d: the figures, from src/lib/grade-spread.ts (the renderer reads the same).
  const g = gradeCounts(ownRows, england, { compareFrom, changeFrom });
  const { latest, earlier, changeEarlier, cmpYear, chgYear, ownTotal, cmpTotal, rowsFor, englandLabel, modal } = g;

  // 0.6.3 S1: Current's selection is the page's (band:range), applied straight away: one
  // click a grade, a second widens to the range, a third starts again, the same grade again
  // clears. U / Fail / Unclassified can't be range ends (R-RANGE-ENDS-GRADED). The scale is
  // the page's focusScale (the 2023/24-on rows, 0.6.2 S2).
  const scale = selection?.scale ?? [];
  const range: GradeRange | null = selection?.range ?? null;
  const pending: string | null = null;
  const click = (grade: string) => {
    if (!selection) return;
    const next = nextSelection(scale, range ? { top: range.top, bottom: range.bottom } : null, grade);
    if (next !== "ignore") selection.onSelect(next);
  };
  const clickable = (grade: string) => rangeEndGrade(scale, grade);
  const single = !!range && range.top === range.bottom;
  const clickTitle = (grade: string) =>
    notRangeEndReason(scale, grade) ??
    (!range ? `Select ${grade}` : single ? (grade === range.top ? `Clear ${grade}` : `Widen to ${spanLabel(range.top, grade)}`) : `Start again from ${grade}`);
  const spanLabel = (a: string, b: string) => {
    const ranked = scale.indexOf(a) <= scale.indexOf(b) ? { top: a, bottom: b } : { top: b, bottom: a };
    return inlineRangeLabel(rangeLabel({ scale, ...ranked }));
  };
  // The answer line: the share of this year's graded entries inside the selection, with
  // England's beside it where England publishes every grade drawn (R-ENGLAND-GRADED-ONLY).
  const answer = range && latest !== null ? answerLine(range, bandRate(g.own, range), englandShare(england, latest, range, g.order)) : null;

  const yearText = latest === null ? "" : academicYearLabel(latest);
  const oneYearOnly = <PanelSummary>This subject has published grades for one year only; a second year is needed to compare.</PanelSummary>;

  const current: PanelRender = {
    tag: `Grade counts ${yearText}`.trim(),
    question,
    controls: selection ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] text-[var(--muted)]">
          {!range
            ? "Click a grade to compare it across subjects and schools"
            : single
              ? `Showing ${inlineRangeLabel(rangeLabel(range))}: click another grade to widen`
              : `Showing ${inlineRangeLabel(rangeLabel(range))}: click a grade to start again`}
        </span>
        {range && <Pill label="Clear" onClick={() => selection.onSelect(null)} />}
      </div>
    ) : undefined,
    body: (fullscreen) =>
      ownTotal > 0 ? (
        // A long scale (Double Award's 17 pairs, IB Diploma's 22 points) scrolls in the card.
        // No title of its own (the tag names it); a view's title override shows here.
        <>
        <ViewTitle />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <GradeDistribution
            rows={rowsFor(false)}
            total={ownTotal}
            colour={colour}
            range={range}
            pending={pending}
            {...(selection ? { onGradeClick: click, clickable, clickTitle } : {})}
            benchLabel={englandLabel}
            fullscreen={fullscreen}
          />
        </div>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">No published grades for {subjectLabel} yet.</p>
      ),
    // R-COUNTS-SELECTION: with a selection, its answer line ("Grade 9: 3% of entries (7) ·
    // England 5%"); without one, the spread's mode as before.
    summary: answer ? (
      <PanelSummary>{answer}</PanelSummary>
    ) : modal ? (
      <PanelSummary>
        {subjectLabel}&rsquo;s {ownTotal.toLocaleString()} graded entries in {yearText}: most at {modal} ({Math.round((g.modalCount / ownTotal) * 100)}%).
      </PanelSummary>
    ) : undefined,
    // ...and on the card, shown without a click (the answer to the click just made).
    ...(answer ? { visibleCaption: <span data-answer-line="">{answer}</span> } : {}),
    source: source(yearText),
    headline: ownTotal > 0 ? ownTotal.toLocaleString() : undefined,
  };

  const trendHalf: PanelRender = {
    tag: "Trends",
    afterTag: earlier.length ? <FromYearMenu mode="year" periods={earlier} from={cmpYear} onChange={setCompareFrom} /> : undefined,
    question: `How has ${subjectLabel}'s spread of grades moved?`,
    body: (fullscreen) =>
      cmpYear === null || ownTotal === 0 ? (
        <p className="text-sm text-[var(--muted)]">Only one year of published grades so far, so there is no earlier spread to compare.</p>
      ) : (
        <>
        <ViewTitle>{subjectLabel}&rsquo;s spread of grades: {yearText} against {academicYearLabel(cmpYear)}, grade by grade</ViewTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <GradeDistribution
          rows={rowsFor(true)}
          total={ownTotal}
          compareTotal={cmpTotal}
          compareLabel={academicYearLabel(cmpYear)}
          colour={colour}
          range={null}
          pending={null}
          benchLabel={null}
          fullscreen={fullscreen}
        />
        </div>
        </>
      ),
    summary: cmpYear === null ? oneYearOnly : undefined,
    source: source(cmpYear === null ? yearText : `${academicYearLabel(cmpYear)}–${yearText}`),
    // R-TREND-FROM-2223: this year's spread against the compare year (the note where that is 2021/22).
    gradingYears: cmpYear === null || latest === null || ownTotal === 0 ? null : [cmpYear, latest],
  };

  const changeData: PanelData = g.changeDataIn(colour);
  const changeHalf: PanelRender = {
    tag: "% Change",
    // R-TREND-FROM-2223: the change is measured from 2022/23 at the earliest.
    afterTag: changeEarlier.length ? <FromYearMenu periods={[...changeEarlier, ...(latest === null ? [] : [latest])]} from={chgYear} onChange={setChangeFrom} /> : undefined,
    question: `Which of ${subjectLabel}'s grades have moved most?`,
    body: (fullscreen) =>
      chgYear === null ? (
        <p className="text-sm text-[var(--muted)]">Only one year of published grades so far, so there is nothing to measure a change against.</p>
      ) : (
        <>
          <ViewTitle>
            {subjectLabel}&rsquo;s entries at each grade: {academicYearLabel(chgYear)} against {yearText}, with the change
          </ViewTitle>
          <YearTable data={changeData} measure={ENTRIES_MEASURE} focusKey={null} fullscreen={fullscreen} nameHeading="Grade" showRank={false} />
        </>
      ),
    summary: chgYear === null ? oneYearOnly : undefined,
    source: source(chgYear === null ? yearText : `${academicYearLabel(chgYear)}–${yearText}`),
    gradingYears: chgYear === null || latest === null ? null : [chgYear, latest],
  };

  // The one Trends panel: the spread comparison then the change table, each half's "From"
  // menu, question, summary and source following the view on screen.
  const trend: PanelRender = {
    ...trendHalf,
    afterTag: isChange ? changeHalf.afterTag : trendHalf.afterTag,
    question: isChange ? changeHalf.question : trendHalf.question,
    actions: (
      <>
        <IconButton label="Spread by year" active={!isChange} onClick={() => setTrendsView("spread")}>{GradesIcon}</IconButton>
        <IconButton label="Change table" active={isChange} onClick={() => setTrendsView("changeTable")}>{TableIcon}</IconButton>
      </>
    ),
    body: (fullscreen) => (isChange ? changeHalf.body(fullscreen) : trendHalf.body(fullscreen)),
    summary: isChange ? changeHalf.summary : trendHalf.summary,
    source: isChange ? changeHalf.source : trendHalf.source,
    gradingYears: isChange ? changeHalf.gradingYears : trendHalf.gradingYears,
  };

  // 0.6.1 S3d: what the config-driven view renderer draws from (under `views=v2` only): the
  // subject's own grade rows and England's, as fetched above, and the members' own picks.
  const frame: GradesFrame = {
    kind: "grades",
    phase: geography?.phase,
    subjectLabel,
    ownRows,
    englandRows: england,
    colour,
    schoolSetGrades,
    state: { compareFrom, changeFrom, highlight: selection ? { range, pending, onGradeClick: click, clickable, clickTitle } : { range: null, pending: null, onGradeClick: () => {}, clickable: () => false } },
  };

  return <ColumnPanels columnId={columnId} host="teacher.c1.counts" panels={panels} onPanelsChange={onPanelsChange} notes={notes} controls={controls} render={{ current: { ...current, frame }, trend: { ...trend, frame } }} />;
}
