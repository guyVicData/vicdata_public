"use client";

// Grade bands frontend round: Column 1 Results on Grade counts -- the focused subject's whole
// grade distribution, which has no single figure, so it gets its own three panels rather
// than being forced through the one-number-per-year panels every other measure uses:
//
//   Current   the distribution this year, each grade's share against England's share at the
//             same grade (GradeDistribution). A span can be highlighted ad hoc with the
//             same two clicks as Grade bands, and cleared; nothing is highlighted at first.
//   Trend     this year's spread against an earlier year's, grade by grade (the FromYearMenu
//             picks the earlier year) -- not a line, since there is no one number to plot.
//   % change  each grade's own count, first year to latest, in grade order (YearTable with
//             its change column), so the shift reads down the scale.
//
// Grade-level figures are published from 2023/24 only, so Trend and % change have one or
// two years to work with and say so, rather than padding an axis.
import { useState, type ReactNode } from "react";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { ENTRIES_MEASURE, type PanelData, type PanelId } from "@/lib/teacher-view-panels";
import { NON_GRADE_VALUES, bestScale, gradeOrderFrom, rangeLabel, spanBetween, type GradeRange } from "@/lib/subject-grades";
import { useSubjectGradeGeography, type GradeGeographyInput } from "@/lib/teacher-view-grade-geography";
import { ColumnPanels, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { FromYearMenu } from "./FromYearMenu";
import { GradeDistribution, type GradeRow } from "./GradeDistribution";
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
}) {
  const graded = ownRows.filter((r) => !NON_GRADE_VALUES.has(r.grade));
  const periods = Array.from(new Set(graded.map((r) => r.period))).sort((a, b) => a - b);
  const latest = periods.length ? periods[periods.length - 1] : null;
  const earlier = periods.slice(0, -1);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [changeFrom, setChangeFrom] = useState<number | null>(null);
  // Trends row merge round: this year's spread against an earlier year, and each grade's
  // change, are two views of one Trends panel.
  const [trendsView, setTrendsView] = useState<"spread" | "changeTable">("spread");
  const isChange = trendsView === "changeTable";
  const cmpYear = compareFrom !== null && earlier.includes(compareFrom) ? compareFrom : earlier[earlier.length - 1] ?? null;
  const chgYear = changeFrom !== null && earlier.includes(changeFrom) ? changeFrom : earlier[0] ?? null;

  // Current's ad-hoc highlight: the same two clicks as Grade bands, local to this view.
  const scale = bestScale(graded.map((r) => r.grade));
  const [pending, setPending] = useState<string | null>(null);
  const [span, setSpan] = useState<{ top: string; bottom: string } | null>(null);
  const range: GradeRange | null = pending ? { scale, top: pending, bottom: pending } : span ? { scale, ...span } : null;
  const click = (g: string) => {
    if (pending) {
      setSpan(spanBetween(scale, pending, g));
      setPending(null);
    } else {
      setPending(g);
    }
  };

  const geo = useSubjectGradeGeography(geography);
  const england = geo?.data?.national?.rows ?? [];

  const inYear = (rows: OwnRow[], p: number | null) => (p === null ? [] : rows.filter((r) => r.period === p && !NON_GRADE_VALUES.has(r.grade)));
  const countAt = (rows: OwnRow[], g: string) => rows.filter((r) => r.grade === g).reduce((a, r) => a + r.entries, 0);
  const totalOf = (rows: OwnRow[]) => rows.reduce((a, r) => a + r.entries, 0);

  const own = inYear(graded, latest);
  const ownTotal = totalOf(own);
  const eng = inYear(england, latest);
  const engTotal = totalOf(eng);
  const cmp = inYear(graded, cmpYear);
  const cmpTotal = totalOf(cmp);
  const order = gradeOrderFrom(own.map((r) => r.grade), eng.map((r) => r.grade), cmp.map((r) => r.grade));
  const rowsFor = (withCompare: boolean): GradeRow[] =>
    order.map((g) => ({
      grade: g,
      ownCount: countAt(own, g),
      // A grade England does not publish (suppressed below 5 schools) has no share at all.
      // The year-on-year view carries no England ticks: it compares the school with itself.
      benchPct: !withCompare && eng.some((r) => r.grade === g) && engTotal > 0 ? (countAt(eng, g) / engTotal) * 100 : null,
      ...(withCompare ? { compareCount: countAt(cmp, g) } : {}),
    }));
  const englandLabel = eng.length && latest !== null ? `England, ${academicYearLabel(latest)}` : null;

  const modal = own.length ? order.reduce((best, g) => (countAt(own, g) > countAt(own, best) ? g : best), order[0]) : null;
  const yearText = latest === null ? "" : academicYearLabel(latest);
  const oneYearOnly = <PanelSummary>Grades are published per subject from 2023/24 only; a second year is needed to compare.</PanelSummary>;

  const current: PanelRender = {
    tag: `Grade counts ${yearText}`.trim(),
    question,
    controls: (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] text-[var(--muted)]">
          {pending ? `From ${pending}: click the other end` : range ? `Highlighting ${rangeLabel(range).toLowerCase()}` : "Click two grades to highlight a range"}
        </span>
        {(range || pending) && <Pill label="Clear" onClick={() => { setPending(null); setSpan(null); }} />}
      </div>
    ),
    body: (fullscreen) =>
      ownTotal > 0 ? (
        // A long scale (Double Award's 17 pairs, IB Diploma's 22 points) scrolls in the card.
        <div className="min-h-0 flex-1 overflow-y-auto">
          <GradeDistribution rows={rowsFor(false)} total={ownTotal} colour={colour} range={range} pending={pending} onGradeClick={click} benchLabel={englandLabel} fullscreen={fullscreen} />
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No published grades for {subjectLabel} yet.</p>
      ),
    summary: modal ? (
      <PanelSummary>
        {subjectLabel}&rsquo;s {ownTotal.toLocaleString()} graded entries in {yearText}: most at {modal} ({Math.round((countAt(own, modal) / ownTotal) * 100)}%).
      </PanelSummary>
    ) : undefined,
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
  };

  // Each grade's own count, from the chosen year to the latest, in grade order.
  const changeData: PanelData = {
    periods: chgYear === null || latest === null ? [] : [chgYear, latest],
    series: order.map((g) => ({
      key: g,
      label: g,
      colour,
      values: chgYear === null || latest === null ? [] : [countAt(inYear(graded, chgYear), g), countAt(own, g)],
    })),
  };
  const changeHalf: PanelRender = {
    tag: "% Change",
    afterTag: earlier.length ? <FromYearMenu periods={[...earlier, ...(latest === null ? [] : [latest])]} from={chgYear} onChange={setChangeFrom} /> : undefined,
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
  };

  return <ColumnPanels columnId={columnId} host="teacher.c1.counts" panels={panels} onPanelsChange={onPanelsChange} notes={notes} controls={controls} render={{ current, trend }} />;
}
