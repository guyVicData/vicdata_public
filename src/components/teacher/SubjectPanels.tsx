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
  currentRowsWithDelta,
  changeOf,
  changePhrase,
  changeTitle,
  formatChange,
  rankByValue,
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
import { GeographyView, frameGeography, useSubjectGeography, type GeographyInput } from "./GeographyComparison";
import { shouldIndex } from "@/lib/teacher-view-trend-styles";
import { ChangeList, MultiTrend, TrendScaleTitle, ViewTitle, YearTable, multiTrendHasLine } from "./SeriesViews";
import { DIRECTION_COLOUR, FOCUS_COLOUR, directionOf, paletteInOrder, tintInOrder } from "@/lib/teacher-view-trend-styles";
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";
import { ColumnPanels, DataDate, PanelSummary, type PanelNotes, type PanelRender } from "./ColumnPanels";
import { FromYearMenu } from "./FromYearMenu";
import { TrendLineToggle } from "./PanelFooter";
import { ChangeChart, type ChangeBar } from "./ChangeChart";
import { AverageIcon, DonutIcon, FlagIcon, GradesIcon, HorizontalBarsIcon, IconButton, IndexedLineIcon, MapPinIcon, PodiumIcon, RankListIcon, TableIcon, TilesIcon, TrendLineIcon, VerticalBarsIcon } from "./PanelIcons";
import { GradeDistribution } from "./GradeDistribution";
import { bandDistribution } from "@/lib/grade-spread";
import { bandRate, inlineRangeLabel, type GradeRange } from "@/lib/subject-grades";
import { useSubjectGradeGeography, withEnglandBandBenchmark, type GradeGeographyInput } from "@/lib/teacher-view-grade-geography";
import { ConfiguredNumberTiles, ordinal, type NumberTile } from "./NumberTiles";
import { RankingsMap } from "./RankingsMap";
import type { AcademicSchoolProfile, KsStage } from "@/lib/academic-data-view";
import { ShareDonut } from "./ShareDonut";
import { SortTable, nextSort, type SortRow, type SortState } from "./SortTable";
import { TrendChart } from "./TrendChart";
import { ViewChart } from "./ViewChart";
import { VerticalBars } from "./VerticalBars";
import { RankedList } from "./RankedList";
import { useDashboardRuntime } from "@/components/dashboard-config/runtime";
import type { FrameSchoolGroup, FrameSet, FrameSetGrades, SubjectsFrame } from "@/lib/view-series/frames";
import { gradingNoteEligible } from "@/catalogue/notes";

const NO_KEYS: ReadonlySet<string> = new Set();

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
  subjects: subjectsIn,
  measure,
  benchmarkLabel,
  benchmarkNoun,
  groups = [],
  donut,
  yearControl = false,
  pinnedYear = null,
  focus,
  controls,
  questions,
  source,
  panels,
  onPanelsChange,
  notes,
  emptyText,
  note,
  changeScope = "all",
  theme = "dark",
  accentHex = null,
  deltaHeading,
  rankedTable = false,
  spaciousBars = false,
  categoryLabel,
  geography,
  trendMap,
  tiles,
  cardTrend,
  gradeBand,
  rankedViews = false,
  compareAgainstLabel,
  schoolGroup,
  schoolSet,
  schoolSetGrades,
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
  donut?: {
    enabled: boolean;
    groupLabel: string;
    groupTotals: (number | null)[];
    shareOf?: string;
    // Grade bands frontend round: a share that is not the focused subject's -- the group's
    // entries inside the grade range, of all its graded entries -- aligned to `periods`,
    // with its own labels and number format (a headcount, where the measure is a %).
    share?: { values: (number | null)[]; totals: (number | null)[]; label: string; otherLabel: string; format: (v: number) => string };
  };
  // Context's year prev/next pair, so Current is no longer pinned to the latest year.
  // Only the years the active measure really has (§6.3); absent elsewhere, matching the
  // wireframe, which draws it on Context alone.
  yearControl?: boolean;
  // VicData 0.6 E: an embedded view pinned to a year (a meeting slot "as of 2023/24")
  // opens the year control there instead of on the latest year. Only with yearControl.
  pinnedYear?: number | null;
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
  // Current panel rework round 1: the tag is "Current" now, so nothing here reads this;
  // callers keep passing it as the column's name for the per-view titles to come.
  currentLabel?: string;
  // Round 2 §5: which subjects % change draws a bar for. "all" = every subject handed in
  // (Column 1's category); "focus" = the focused subject and the groups only, for Context,
  // whose subject list is now the whole school -- twenty-odd bars would be unreadable.
  //
  // Trend redesign steps 9-10 replace "focus" with two modes for Context, whose subject
  // list is either a hand-picked Selected set or the whole school:
  //   "individual" -- Selected subjects: like Column 1 Candidates. Every subject its own
  //                   line (Option B / D2) or row (Option H), tables E and I beside them.
  // All subjects was "curated" -- Option K (focus + top movers + a rest-of-school band)
  // -- until snagging round 1 Part 3 ("all subjects needs to show all, not just top and
  // bottom"): it is "individual" too now, with `cardTrend` below for its card graph.
  // "all" is Column 1 Results' classic behaviour and is deliberately unchanged.
  changeScope?: "all" | "individual";
  // Snagging round 1 Part 3: Context's All subjects. Every subject is still its own row
  // and, in fullscreen, its own line with the show/hide legend; but the CARD's graph --
  // a small box, where twenty-odd lines are noise -- draws just the focused subject
  // against the group's per-subject average (`groups[0]`, dashed), the same two-line
  // shape Results' classic Trend draws against England.
  cardTrend?: "focusVsGroup";
  // Live review Part D: Context's Trend lines take the categorical palette, which has light
  // and dark versions and skips hues close to the phase accent (see paletteInOrder).
  theme?: "dark" | "light";
  accentHex?: string | null;
  // The Current table's third-column heading, where the caller wants a fixed one --
  // Context's "vs average", the same whichever compare-against set is chosen. Absent =
  // "vs {benchmarkLabel}" (Results' "vs National"), or "vs last year" with no benchmark.
  deltaHeading?: string;
  // Context's Current table: a bare leading rank and no value column (the bars and the
  // donut already show the figure). Results keeps the value and no rank.
  rankedTable?: boolean;
  // Results' Current bars: ViewChart's roomier row style (thicker, more spaced, wrapping
  // labels). Context does not pass it and keeps the compact rows.
  spaciousBars?: boolean;
  // The focused subject's category ("Sciences & Maths"), for a "{Results|Entries} in
  // {category}" title over Current -- as Candidates titles its panels. Results passes it;
  // Context does not, and gets no title.
  categoryLabel?: string;
  // Results' % change: the focused GCSE subject's average point score against its LA,
  // region and England -- the same shared view Candidates uses for entries. When present
  // it replaces the category-subjects chart and table in % change. Context never passes it.
  geography?: GeographyInput;
  // Trend map/legend round Part 3: Column 1 Results' Trend gains a Map view -- Comparisons'
  // own RankingsMap (AcademicMapView), on the page's already-loaded map profiles, plotting
  // the focused subject. Absent (Context, KS2, or no focused subject with a map chip) = no
  // Map button.
  // Snagging round 1 Part 2: Column 1 Results' number tiles, the Current panel's default
  // view when set. Context never passes it.
  tiles?: boolean;
  // Grade bands frontend round: Results on Grade bands. The range lives on the page (so
  // Comparisons and Context read the same span); this draws the Grades view and the
  // range's own tiles. The rates themselves arrive as the usual subjects' values and
  // England benchmark. 0.6.1 S5 (D3): the range is picked in the top bar (ResultsControl);
  // the in-panel band row and click-two-grades picking are gone, and the Grades view is the
  // focused subject's grade distribution with the picked band shaded.
  gradeBand?: {
    range: GradeRange | null;
    rangeLabel: string | null;
    colour: string;
    // The focused subject's own per-grade rows (this school, every year it has them).
    ownRows: { period: number; grade: string; entries: number }[];
    // Its LA/region/England per-grade rows are fetched here (as useSubjectGeography is),
    // and England's is the benchmark: the focused subject's England rate on the range, the
    // distribution's ticks. null = no benchmark to fetch.
    geography: GradeGeographyInput | null;
  };
  // Current panel rework round 1: Context's Current draws Column 1's old Bar chart
  // (VerticalBars) and Ranked list in place of the horizontal bars, over whichever subjects
  // its compare-against pill resolves to, with the bar chart as its default view. Results
  // does not pass it and keeps its own Bar chart and Sortable table.
  rankedViews?: boolean;
  // Current panel rework round 1: the compare-against group as a title reads it -- the
  // category ("Sciences & Maths"), "all subjects" or "the subjects you selected" -- for
  // the titles over Context's donut, bar chart, ranked list and table. Absent = no title.
  compareAgainstLabel?: string;
  // 0.6.1 S3c: what a view of its own's "Add an average" reads (the page's groups of
  // subjects, and its Compared against set), built on demand. Read only under views=v2.
  schoolGroup?: FrameSchoolGroup;
  schoolSet?: () => FrameSet | null;
  // 0.6.2 S3: the set's grade rows for a spread's "Add an average" across schools.
  schoolSetGrades?: () => FrameSetGrades | null;
  trendMap?: {
    profiles: AcademicSchoolProfile[] | null;
    targetUrn: string;
    stage: KsStage;
    subject: string;
    subjectLabel: string;
    subjectBucket: string | null;
    familyId: string | null;
    accentHex: string | null;
  };
}) {
  // Current panel rework round 1: Context (rankedViews) opens on its bar chart.
  const [view, setView] = useState<"tiles" | "grades" | "donut" | "bar" | "list" | "table">(tiles ? "tiles" : donut && !rankedViews ? "donut" : "bar");
  // A ranked table opens in rank order (value, largest first), so its numbers read 1, 2, 3.
  const [sort, setSort] = useState<SortState>(rankedTable ? { key: "value", dir: "desc" } : { key: "delta", dir: "desc" });
  const [yearIdx, setYearIdx] = useState<number | null>(() =>
    yearControl && pinnedYear !== null && periods.includes(pinnedYear) ? periods.indexOf(pinnedYear) : null,
  );
  const [trendStart, setTrendStart] = useState<number | null>(null);
  const [changeStart, setChangeStart] = useState<number | null>(null);
  const [showFit, setShowFit] = useState(false);
  // Steps 9-10: Context's Trend and % change gain a table beside their chart.
  // "chart" is the default chart -- indexed for a headcount measure; "actual" (headcounts
  // only) the same lines at their real values.
  // Trends row merge round: Trend's and % change's views share one Trends panel, so one view
  // state spans both halves -- Trend's (chart, actual, table, map) then % change's
  // (ranked change or the geography chart, and its table).
  const [trendsView, setTrendsView] = useState<"chart" | "actual" | "table" | "map" | "changeChart" | "changeTable">("chart");
  const isChange = trendsView === "changeChart" || trendsView === "changeTable";
  const trendViewChosen = isChange ? null : trendsView;
  const setTrendView = (v: "chart" | "actual" | "table" | "map") => setTrendsView(v);
  // A Map choice falls back to the chart when the focus moves to a subject with no map.
  const trendView = trendViewChosen === "map" && !trendMap ? "chart" : trendViewChosen;
  // Trend map/legend round Part 1: the subjects the fullscreen legend has switched off,
  // stamped with the focus and scope they were chosen under (hiddenKeys, below, reads it).
  const [hidden, setHidden] = useState<{ scope: string; keys: Set<string> }>({ scope: "", keys: new Set() });
  const changeView: "chart" | "table" = trendsView === "changeTable" ? "table" : "chart";
  const setChangeView = (v: "chart" | "table") => setTrendsView(v === "table" ? "changeTable" : "changeChart");
  const geo = useSubjectGeography(geography);
  const runtime = useDashboardRuntime();
  // Grade bands: England's per-grade rows for the focused subject, every year, one fetch.
  const gradeGeo = useSubjectGradeGeography(gradeBand?.geography ?? null);
  const englandGradeRows = gradeGeo?.data?.national?.rows ?? [];
  // On Grade bands the focused subject's benchmark is England's rate on the same span (the
  // bars' marker, the table's "vs National", the tiles' gap); peers have no fetched
  // England rows, so they carry none, as on the threshold measure (R-BANDS-ENGLAND-BENCH,
  // in the grade geography lib).
  const subjects: SubjectSeries[] = gradeBand
    ? withEnglandBandBenchmark(subjectsIn, focus, periods, englandGradeRows, gradeBand.range)
    : subjectsIn;
  const redesigned = changeScope !== "all";

  // The donut is Candidates-only, so a measure switch has to fall back rather than leave
  // the panel on a view it can no longer draw. (R-DONUT-COUNTS-ONLY is decided by the
  // caller through shareApplies(), teacher-view-measures.ts; this only honours it.)
  const effectiveView = (view === "donut" && !donut?.enabled) || (view === "tiles" && !tiles) || (view === "grades" && !gradeBand) || (view === "list" && !rankedViews) ? "bar" : view;

  // R-2122-GRADING-NOTE: a grade or points figure (never entries; KS2 has no SubjectPanels)
  // carries the 2021/22 grading note on a Trends view whose years include 2021/22
  // (ColumnPanels adds it after the source, below).
  const graded = gradingNoteEligible(measure.id, runtime?.phase);

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

  // The focused subject's key, resolved once -- highlighted in the bars and table, and
  // the one Trend and the donut follow.
  const focusedKey = (subjects.find((s) => s.key === focus) ?? subjects[0])?.key ?? null;

  // The third column. Against a benchmark where there is one; otherwise against this
  // subject's own previous published year, which is the other real comparison available
  // -- never a column of dashes. Results' threshold measure is the case that needs it:
  // the national anchor this app holds is points per entry, so a Grade 4+ rate has no
  // published England figure to sit against (R-PREV-YEAR-FALLBACK, in the panels lib).
  const rows = currentRowsWithDelta(subjects, latestIdx, !!benchmarkLabel);

  const barRows = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  // Steps 9-10: in Context's modes every subject is tinted in Current's own order -- the
  // grey ramp, lightest for the largest -- with the focus in the accent, the same colours
  // in Current, Trend and % change. Results keeps the colours it is handed.
  const tints = tintInOrder(barRows.map((r) => r.s.key), focusedKey, FOCUS_COLOUR);
  const colourFor = (s: SubjectSeries) => (redesigned ? tints.get(s.key) ?? s.colour : s.colour);
  // Live review Part D: the Trend LINE chart alone gets real hues for the non-focused
  // subjects, as Candidates' does (b518e1e) -- same helper, same order, same focus accent.
  // Current's bars and % change keep the grey ramp above. In both Context modes every
  // subject is its own line in fullscreen (snagging round 1 Part 3), where the rail's
  // show/hide legend names each colour. The Trend table's dots read the same series, so
  // they match the lines.
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
  const donutShare = donut?.share;
  const donutValue = latestIdx < 0 ? null : donutShare ? donutShare.values[latestIdx] ?? null : focusedSubject ? focusedSubject.values[latestIdx] : null;
  const donutGroupValue = latestIdx >= 0 ? (donutShare ? donutShare.totals[latestIdx] : donut?.groupTotals[latestIdx]) ?? null : null;
  const donutFormat = donutShare?.format ?? measure.format;
  const donutPercent =
    donutValue !== null && donutGroupValue !== null && donutGroupValue > 0 ? (donutValue / donutGroupValue) * 100 : null;

  // Snagging round 1 Part 2: Results' number tiles. MAIN is the focused subject's figure
  // on the active measure (the panel's own headline value, unit-aware through measure);
  // then its rank in the category (the tables' own ranking), the school's average across
  // ALL its subjects on the same measure, and the gap to England (the same England anchor
  // the bars' marker and the table's "vs National" column read).
  const tileFocus = rows.find((r) => r.s.key === focusedKey) ?? null;
  const tilesMainBuilt =
    tiles && tileFocus && latest !== null
      ? { figure: tileFocus.value === null ? "—" : measure.format(tileFocus.value), label: `${tileFocus.s.label} ${measure.noun} in ${academicYearLabel(latest)}` }
      : null;
  const tileRow: NumberTile[] = [];
  if (tiles && gradeBand && tileFocus && tileFocus.value !== null) {
    // Grade bands: the range's own figures -- how many entries that is, England's share on
    // the same span, and the gap -- per the grade bands prompt, in place of the rank.
    const inBand = latest !== null && gradeBand.range ? bandRate(gradeBand.ownRows.filter((r) => r.period === latest), gradeBand.range) : null;
    if (inBand) {
      tileRow.push({ key: "count", icon: GradesIcon, figure: inBand.met.toLocaleString(), detail: `of ${inBand.entries.toLocaleString()} graded entries at ${inlineRangeLabel(gradeBand.rangeLabel ?? "")}`, vars: { total: inBand.entries } });
    }
    if (tileFocus.bench !== null) {
      tileRow.push({ key: "england-average", icon: AverageIcon, figure: measure.format(tileFocus.bench), detail: `England, ${inlineRangeLabel(gradeBand.rangeLabel ?? "")}` });
      const gap = tileFocus.value - tileFocus.bench;
      const dir = measure.formatDelta(gap).replace("−", "+") === measure.formatDelta(0) ? "flat" : directionOf(gap);
      tileRow.push({ key: "england", icon: FlagIcon, figure: measure.formatDelta(gap), detail: dir === "flat" ? "level with England" : `${dir === "up" ? "above" : "below"} England`, direction: dir, vars: { direction: dir === "flat" ? "level with" : dir === "up" ? "above" : "below" } });
    }
  } else if (tiles && tileFocus && tileFocus.value !== null) {
    const inCategory = rankByValue(rows.map((r) => ({ key: r.s.key, value: r.value })));
    const rank = inCategory.get(tileFocus.s.key);
    if (rank && inCategory.size > 1) {
      tileRow.push({ key: "category", icon: PodiumIcon, figure: ordinal(rank), detail: `of ${inCategory.size} in ${categoryLabel ?? "its category"}`, vars: { total: inCategory.size } });
    }
    // The middle tile: England's own figure for this subject, a benchmark beside the main
    // one -- the same England anchor the next tile's gap is taken from.
    if (tileFocus.bench !== null) {
      tileRow.push({ key: "england-average", icon: AverageIcon, figure: measure.format(tileFocus.bench), detail: `England average for ${tileFocus.s.label}` });
    }
    if (tileFocus.bench !== null) {
      const gap = tileFocus.value - tileFocus.bench;
      // A gap that rounds to nothing at the measure's own precision reads as level.
      const dir = measure.formatDelta(gap).replace("−", "+") === measure.formatDelta(0) ? "flat" : directionOf(gap);
      tileRow.push({
        key: "england",
        icon: FlagIcon,
        figure: measure.formatDelta(gap),
        detail: dir === "flat" ? "level with the England average" : `${dir === "up" ? "above" : "below"} the England average`,
        direction: dir,
        vars: { direction: dir === "flat" ? "level with" : dir === "up" ? "above" : "below" },
      });
    }
  }
  // Pick, order, relabel and hide per the view's settings; unset = the tiles above, as built.
  const tileVars = {
    subject: tileFocus?.s.label,
    category: categoryLabel,
    school: runtime?.school?.name,
    year: latest === null ? undefined : academicYearLabel(latest),
    measure: measure.noun,
    range: gradeBand?.rangeLabel ? inlineRangeLabel(gradeBand.rangeLabel) : undefined,
  };

  // Grade bands: the focused subject's distribution in the year Current shows, with
  // England's share at each grade (no tick where England's row was suppressed), and its
  // entries inside the range -- both from the same rows bandRate reads.
  // (0.6.1 S3d: src/lib/grade-spread.ts, which the renderer reads too.)
  const band = bandDistribution(gradeBand?.ownRows ?? [], englandGradeRows, gradeBand ? latest : null);

  // Current panel rework round 1: a title over each of Context's Current views. The donut's
  // wording is Guy's; the bar chart / ranked list / table one is provisional. On Grade
  // bands the donut is the group's entries in the range, not the focused subject's.
  const scopeNounCurrent = measure.id === "entries" ? "Entries" : "Results";
  const currentTitle: string | null = !compareAgainstLabel
    ? null
    : effectiveView === "donut"
      ? donutShare
        ? `Entries at ${inlineRangeLabel(donutShare.label)} as a proportion of graded entries in ${compareAgainstLabel}`
        : `Entries in ${focusedSubject?.label ?? "this subject"} as a proportion of ${compareAgainstLabel}`
      : effectiveView === "bar" || effectiveView === "list" || effectiveView === "table"
        ? `${scopeNounCurrent} by subject in ${compareAgainstLabel}`
        : null;

  const current: PanelRender = {
    // Current panel rework round 1: the tag is the fixed word "Current" in every column, and
    // the year follows it as plain text ("Data 2024/25"). currentLabel no longer builds the
    // tag; it stays a prop as the column's own name for titles.
    tag: "Current",
    question: questions.current,
    // Round 2 §4: Context's year choice is the same dropdown Trends and % Change use, in
    // its one-year mode, beside the tag -- replacing a prev/next chevron pair whose
    // usually-disabled left chevron read as a stray "back" button. It is the year in the
    // "Data {year}" line.
    afterTag: yearControl && realIdx.length > 1 ? (
      <DataDate>
        <FromYearMenu mode="year" periods={realIdx.map((i) => periods[i])} from={latest} onChange={(p) => setYearIdx(periods.indexOf(p))} />
      </DataDate>
    ) : latest === null ? undefined : (
      <DataDate>{academicYearLabel(latest)}</DataDate>
    ),
    actions: (
      <>
        {tiles && <IconButton label="Number tiles" active={effectiveView === "tiles"} onClick={() => setView("tiles")}>{TilesIcon}</IconButton>}
        {gradeBand && <IconButton label="Grade distribution" active={effectiveView === "grades"} onClick={() => setView("grades")}>{GradesIcon}</IconButton>}
        {donut && (
          <IconButton
            label={donut.enabled ? "Share (donut)" : "Share is only meaningful for candidate numbers"}
            railLabel="Share (donut)"
            active={effectiveView === "donut"}
            disabled={!donut.enabled}
            onClick={() => setView("donut")}
          >
            {DonutIcon}
          </IconButton>
        )}
        <IconButton label="Bar chart" active={effectiveView === "bar"} onClick={() => setView("bar")}>{rankedViews ? VerticalBarsIcon : HorizontalBarsIcon}</IconButton>
        {rankedViews && <IconButton label="Ranked list" active={effectiveView === "list"} onClick={() => setView("list")}>{RankListIcon}</IconButton>}
        <IconButton label="Sortable table" active={effectiveView === "table"} onClick={() => setView("table")}>{rankedViews ? TableIcon : RankListIcon}</IconButton>
      </>
    ),
    body: (fullscreen) =>
      subjects.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <>
          <ViewTitle>{currentTitle}</ViewTitle>
          {effectiveView === "grades" && gradeBand ? (
            band.total > 0 ? (
              <CentredOnTarget watch={`grades:${focusedKey}`}>
                <GradeDistribution
                  rows={band.rows}
                  total={band.total}
                  colour={gradeBand.colour}
                  range={gradeBand.range}
                  pending={null}
                  benchLabel={band.benchLabel}
                  fullscreen={fullscreen}
                />
              </CentredOnTarget>
            ) : (
              <p className="text-sm text-[var(--muted)]">No published grades for {focusedSubject?.label ?? "this subject"} in this year.</p>
            )
          ) : gradeBand && !gradeBand.range ? (
            // An honest empty state rather than a band nobody chose: this scale has no
            // preset, so the rate waits for a range -- picked in the top bar (0.6.1 S5).
            <p data-band-no-range="" className="text-sm text-[var(--muted)]">Pick a grade range from Grades ▾ in the top bar to see a rate.</p>
          ) : effectiveView === "tiles" ? (
            <ConfiguredNumberTiles main={tilesMainBuilt} tiles={tileRow} vars={tileVars} fullscreen={fullscreen} />
          ) : effectiveView === "donut" && donut ? (
            donutPercent === null ? (
              <p className="text-xs text-[var(--muted)]">
                No published figure for {focusedSubject?.label ?? "these subjects"} or for {donut.groupLabel} in{" "}
                {latest === null ? "this year" : academicYearLabel(latest)}.
              </p>
            ) : (
              <ShareDonut
                percent={donutPercent}
                label={donutShare?.label ?? focusedSubject?.label ?? ""}
                groupLabel={donut.groupLabel}
                valueLabel={donutFormat(donutValue!)}
                otherLabel={donutShare?.otherLabel}
                // Snagging round 1 Part 1: the legend's second line says "All other entries",
                // so it is the group LESS the focused subject -- it printed the whole group
                // total, which already contains the focus (the group is self-inclusive).
                groupValueLabel={donutFormat(Math.max(0, donutGroupValue! - donutValue!))}
                colour={focusedSubject?.colour ?? "var(--muted2)"}
                fullscreen={fullscreen}
              />
            )
          ) : effectiveView === "bar" && rankedViews ? (
            // Current panel rework round 1: Column 1's old bar chart, the same component,
            // over this column's subjects in Current's order and grey ramp.
            <VerticalBars
              bars={barRows.map((r) => ({ key: r.s.key, label: r.s.label, shortLabel: r.s.shortLabel, value: r.value, colour: colourFor(r.s) }))}
              measure={measure}
              fullscreen={fullscreen}
            />
          ) : effectiveView === "list" ? (
            <CentredOnTarget watch={`list:${focusedKey}:${barRows.map((r) => r.s.key).join(",")}`}>
              <RankedList rows={barRows.map((r) => ({ key: r.s.key, label: r.s.label, value: r.value }))} measure={measure} focusKey={focusedKey} />
            </CentredOnTarget>
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
                leadingRank={rankedTable}
                showValue={!rankedTable}
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
            {donutShare?.label ?? focusedSubject?.label} {donutShare ? "are" : "is"} {Math.round(donutPercent)}% of{" "}
            {donut.shareOf ?? donut.groupLabel.toLowerCase()} ({donutFormat(donutGroupValue!)}) in{" "}
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

  // Trend map/legend round Part 1: Selected subjects' fullscreen rail lists every line
  // with a show/hide box; the focused subject is always on. The choice resets when the
  // focus or scope changes -- the list is that subject's peers, so a set hidden from
  // another subject's list means nothing once the list is a different one. Only the
  // fullscreen chart and table are filtered: the card has no legend control to bring a
  // line back, so it keeps drawing every line with its own legend under the chart.
  const legendScope = `${changeScope}|${focusedKey ?? ""}`;
  const hiddenKeys: ReadonlySet<string> = hidden.scope === legendScope ? hidden.keys : NO_KEYS;
  const toggleHidden = (key: string) => {
    const next = new Set(hiddenKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden({ scope: legendScope, keys: next });
  };
  const railLegend = changeScope === "individual" && trendData.series.length > 1;
  // Part 3's card graph: the focused line and the group average over the same span.
  const focusVsGroup: PanelData = {
    periods: trendData.periods,
    series: [
      ...trendData.series.filter((x) => x.key === focusedKey),
      ...groups.slice(0, 1).map((g) => ({
        key: "group-0",
        label: g.label,
        colour: g.colour ?? "var(--muted3)",
        values: trendData.periods.map((p) => g.values[periods.indexOf(p)] ?? null),
        comparison: true,
      })),
    ],
  };
  const trendShown = (fullscreen: boolean): PanelData =>
    railLegend && fullscreen ? { ...trendData, series: trendData.series.filter((x) => x.key === focusedKey || !hiddenKeys.has(x.key)) } : trendData;
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

  // Whether this panel's Trend is an index (a headcount measure: Context on Candidates);
  // Results' points and rates never are.
  const indexedTrend = shouldIndex(measure.aggregate);
  // Trends row merge round: the one title line over every view (ViewTitle) -- the scope
  // (Results' category, as Candidates names its own: "Results in Humanities & Social
  // Sciences"; Context's group: "Entries in all subjects") plus the view's shape, so each
  // view reads as itself with the rail out of sight.
  const scopeNoun = measure.id === "entries" ? "Entries" : "Results";
  const scope = subjects.length > 1
    ? categoryLabel
      ? `${scopeNoun} in ${categoryLabel}`
      : benchmarkLabel && benchmarkLabel !== "National"
        ? `${scopeNoun} in ${benchmarkLabel.toLowerCase()}`
        : null
    : null;
  const trendHalf: PanelRender = {
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
        disabled={redesigned ? trendView === null || trendView === "table" || trendView === "map" || !multiTrendHasLine(trendData) : trendView === null || trendChartKind(trendData) === "bars"}
      />
    ),
    actions: redesigned ? (
      indexedTrend ? (
        // Indexed / Actual / Table, as on Candidates' Trend: two chart forms, so neither is
        // just "Chart". Points and rates are never indexed and keep Chart / Table.
        <>
          <IconButton label="Indexed" active={trendView === "chart"} onClick={() => setTrendView("chart")}>{IndexedLineIcon}</IconButton>
          <IconButton label="Actual" active={trendView === "actual"} disabled={!multiTrendHasLine(trendData)} onClick={() => setTrendView("actual")}>{TrendLineIcon}</IconButton>
          <IconButton label="Trend table" active={trendView === "table"} onClick={() => setTrendView("table")}>{TableIcon}</IconButton>
          {trendMap && <IconButton label="Map" active={trendView === "map"} onClick={() => setTrendView("map")}>{MapPinIcon}</IconButton>}
        </>
      ) : (
        <>
          <IconButton label="Chart" active={trendView === "chart" || trendView === "actual"} onClick={() => setTrendView("chart")}>{TrendLineIcon}</IconButton>
          <IconButton label="Trend table" active={trendView === "table"} onClick={() => setTrendView("table")}>{TableIcon}</IconButton>
          {trendMap && <IconButton label="Map" active={trendView === "map"} onClick={() => setTrendView("map")}>{MapPinIcon}</IconButton>}
        </>
      )
    ) : (
      // The classic path (changeScope "all", no caller today) had no rail: with two views
      // in one panel it needs one to reach the second.
      <IconButton label="Trend chart" active={trendView !== null} onClick={() => setTrendView("chart")}>{TrendLineIcon}</IconButton>
    ),
    legend: railLegend && trendView !== null && trendView !== "map" ? (
      <SubjectsShown series={trendData.series} focusKey={focusedKey} hidden={hiddenKeys} onToggle={toggleHidden} />
    ) : undefined,
    body: (fullscreen) =>
      !redesigned ? (
        <>
          <ViewTitle>{scope ? `${scope}, year by year` : null}</ViewTitle>
          <TrendChart data={trendData} measure={measure} showFit={showFit} fullscreen={fullscreen} />
        </>
      ) : trendView === "map" && trendMap ? (
        // Part 3: the same map as Comparisons', mounted the same way -- dense on the card,
        // the full legend stack in fullscreen -- but on the focused subject alone. The
        // fullscreen size key drops its "Dot size" heading (Guy's board); its caption
        // line under the dots already says what size means.
        // Fullscreen fills the chart's own flex area rather than Comparisons' fixed 70vh,
        // which overflowed it here and covered the summary line beneath.
        <div className="flex min-h-0 flex-1 flex-col print:hidden">
          {/* What the map plots: the focused subject at each comparator school (the map's
              own Grade band / Trends toggle picks the colour), not a change figure. */}
          <ViewTitle>{trendMap.subjectLabel} at each comparator school, on the map</ViewTitle>
          <RankingsMap
            profiles={trendMap.profiles}
            targetUrn={trendMap.targetUrn}
            stage={trendMap.stage}
            heightClass={fullscreen ? "min-h-[22rem] flex-1" : "min-h-[10rem] flex-1"}
            subject={trendMap.subject}
            subjectLabel={trendMap.subjectLabel}
            subjectBucket={trendMap.subjectBucket}
            familyId={trendMap.familyId}
            dense={!fullscreen}
            accentHex={trendMap.accentHex}
            untitledSizeLegend
          />
        </div>
      ) : trendView === "table" ? (
        // Every subject's row, on the card and in fullscreen (the card's list scrolls,
        // starting at the focused row).
        <>
          <ViewTitle>{scope ? `${scope}, year by year` : `${focusedSubject?.label ?? scopeNoun}, year by year`}</ViewTitle>
          <CentredOnTarget watch={`trend-table:${focusedKey}:${trendData.periods.join(",")}`}>
            <YearTable
              data={trendShown(fullscreen)}
              measure={measure}
              focusKey={focusedKey}
              fullscreen={fullscreen}
            />
          </CentredOnTarget>
        </>
      ) : (
        <>
          {/* The indexed and actual charts keep TrendScaleTitle's own sentence; the scope
              line above it names what the lines are (a points chart has only this line). */}
          <ViewTitle>{scope ? (indexedTrend ? scope : `${scope}: each subject's line`) : !indexedTrend ? `${focusedSubject?.label ?? scopeNoun}, each year` : null}</ViewTitle>
          {indexedTrend && multiTrendHasLine(trendData) && (
            <TrendScaleTitle view={trendView === "actual" ? "actual" : "indexed"} from={trendData.periods[0] ?? null} noun="entries" />
          )}
          <MultiTrend
            data={cardTrend === "focusVsGroup" && !fullscreen ? focusVsGroup : trendShown(fullscreen)}
            measure={measure}
            focusKey={focusedKey}
            showFit={showFit}
            fullscreen={fullscreen}
            index={indexedTrend && trendView === "actual" ? false : undefined}
            seriesLegend={!(railLegend && fullscreen)}
          />
        </>
      ),
    summary: trendSaid ? (
      <PanelSummary lead={`${DIRECTION_ARROW[trendSaid.direction]} ${DIRECTION_WORD[trendSaid.direction]}:`} leadColour={DIRECTION_COLOUR[trendSaid.direction]}>
        {trendSaid.sentence.replace(/\.$/, "")}{groupClause || "."}
      </PanelSummary>
    ) : (
      <PanelSummary>Not enough published years yet to describe a trend.</PanelSummary>
    ),
    // Part 3: the map, like Comparisons', reads far better with room.
    suggestFullscreen: trendView === "map",
    source: sourceWithNote(spanLabel(trendData.periods)),
    // R-2122-GRADING-NOTE: the years this Trend draws; the map plots one year (none).
    gradingYears: graded && trendView !== "map" ? trendData.periods : null,
    headline: trendSaid ? (
      <span style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}>
        {DIRECTION_ARROW[trendSaid.direction]} {DIRECTION_WORD[trendSaid.direction]}
      </span>
    ) : undefined,
  };

  // -------------------------------------------------------------- change
  // R-NUMBER-TYPE-HONESTY (S3b): every figure in this half is the measure's honest change --
  // % for Context on Candidates (entries), points on average point score, percentage
  // points on a rate -- and every title and sentence says which.
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
    value: changeOf(measure, s.values),
  }));
  // In Context's modes the group is a reference line, not a ranked peer (Option H).
  const rankedChange = changeBars
    .filter((b) => b.value !== null && !(redesigned && b.key.startsWith("group-")))
    .sort((a, b) => b.value! - a.value!);
  const fmtChange = (v: number) => formatChange(measure, v);
  const bestChange = rankedChange[0];
  const worstChange = rankedChange[rankedChange.length - 1];
  const changeSince = changeData.periods.length ? academicYearLabel(changeData.periods[0]) : "";

  const changeHalf: PanelRender = {
    tag: changeTitle(measure),
    afterTag: <FromYearMenu periods={changePeriods} from={changeData.periods[0] ?? null} onChange={setChangeStart} />,
    question: geography ? `How has ${geography.label} moved, against its LA, region and England?` : questions.change,
    actions: redesigned ? (
      <>
        {/* With the geography comparison the chart is a line chart, so its icon says so. */}
        <IconButton label={geography ? "Area chart" : "Ranked change"} active={isChange && changeView === "chart"} onClick={() => setChangeView("chart")}>
          {geography ? TrendLineIcon : HorizontalBarsIcon}
        </IconButton>
        <IconButton label="Change table" active={isChange && changeView === "table"} onClick={() => setChangeView("table")}>{TableIcon}</IconButton>
      </>
    ) : (
      <IconButton label="Change chart" active={isChange} onClick={() => setChangeView("chart")}>{HorizontalBarsIcon}</IconButton>
    ),
    body: (fullscreen) =>
      !redesigned ? (
        <>
          <ViewTitle>{scope ? `${scope}: ${changePhrase(measure)} since ${changeSince}` : `${changeTitle(measure)} since ${changeSince}`}</ViewTitle>
          <ChangeChart bars={changeBars} fullscreen={fullscreen} format={fmtChange} percent={measure.changeKind === "percent"} />
        </>
      ) : geography ? (
        <GeographyView
          geography={geography}
          geo={geo}
          metric="avgPointScore"
          ownPeriods={periods}
          spanPeriods={changeData.periods}
          measure={measure}
          theme={theme}
          accentHex={accentHex}
          view={changeView}
          fullscreen={fullscreen}
        />
      ) : changeView === "table" ? (
        <>
          <ViewTitle>
            {scope ? `${scope}: ${changeSince} against the latest year, ranked by change` : `${scopeNoun} by year, since ${changeSince}`}
          </ViewTitle>
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
        </>
      ) : (
        // Option H over every subject -- a list, so twenty rows just scroll.
        <>
        <ViewTitle>{scope ? `${scope}: ${changePhrase(measure)} since ${changeSince}, ranked` : `${scopeNoun}: ${changePhrase(measure)} since ${changeSince}`}</ViewTitle>
        <CentredOnTarget watch={`change-list:${focusedKey}:${changeData.periods.join(",")}`}>
          <ChangeList
            rows={changeBars.filter((b) => !b.key.startsWith("group-")).map((b) => ({ key: b.key, label: b.label, colour: b.colour, value: b.value }))}
            focusKey={focusedKey}
            group={
              groups[0]
                ? { label: groups[0].label, value: changeOf(measure, changeData.series.find((x) => x.key === "group-0")?.values ?? []) }
                : undefined
            }
            formatValue={measure.changeKind === "percent" ? undefined : fmtChange}
          />
        </CentredOnTarget>
        </>
      ),
    summary:
      bestChange && worstChange && bestChange.key !== worstChange.key ? (
        <PanelSummary>
          {bestChange.label} has grown the most ({fmtChange(bestChange.value!)}); {worstChange.label}{" "}
          {worstChange.value! < 0 ? "has declined the most" : "has grown the least"} ({fmtChange(worstChange.value!)}) since {changeSince}.
        </PanelSummary>
      ) : (
        <PanelSummary>Not enough published years yet to compare on change.</PanelSummary>
      ),
    source: sourceWithNote(spanLabel(changeData.periods)),
    gradingYears: graded ? changeData.periods : null,
    headline: (() => {
      const p = changeBars.find((b) => b.key === focusedSubject?.key)?.value ?? null;
      return p === null || p === undefined ? undefined : fmtChange(p);
    })(),
  };

  // Trends row merge round: the one Trends panel -- Trend's views then % change's in one
  // rail; the "From" menu, question, summary and source follow the half the view on screen
  // belongs to, so neither panel's sentences are lost. The tag, direction flag, Trend-line
  // toggle, legend and collapsed figure are Trend's.
  const trend: PanelRender = {
    ...trendHalf,
    afterTag: isChange ? changeHalf.afterTag : trendHalf.afterTag,
    question: isChange ? changeHalf.question : trendHalf.question,
    actions: (
      <>
        {trendHalf.actions}
        {changeHalf.actions}
      </>
    ),
    body: (fullscreen) => (isChange ? changeHalf.body(fullscreen) : trendHalf.body(fullscreen)),
    summary: isChange ? changeHalf.summary : trendHalf.summary,
    source: isChange ? changeHalf.source : trendHalf.source,
    gradingYears: isChange ? changeHalf.gradingYears : trendHalf.gradingYears,
  };

  // 0.6.1 S3: what the config-driven view renderer draws from (under `views=v2` only): the
  // props this host was handed, as the page derived them, and the members' own settings.
  const groupKind = columnId === "context" ? (runtime?.contextAgainst === "whole" ? "allSubjects" : runtime?.contextAgainst === "selected" ? "selectedSubjects" : "category") : "category";
  const frame: SubjectsFrame = {
    kind: "subjects",
    host: columnId === "context" ? "teacher.c2.context" : "teacher.c1.results",
    periods,
    subjects,
    measure,
    focus,
    groups,
    groupKind,
    benchmarkKind: benchmarkLabel ? (columnId === "context" ? groupKind : "england") : null,
    benchmarkLabel,
    deltaHeading,
    rankedTable,
    rankedViews,
    spaciousBars,
    categoryLabel,
    compareAgainstLabel,
    changeScope,
    cardTrend,
    theme,
    accentHex,
    currentBlocked: subjects.length === 0 || (!!gradeBand && !gradeBand.range),
    hasGeography: !!geography,
    tiles: !!tiles,
    gradeBand: gradeBand
      ? { range: gradeBand.range, rangeLabel: gradeBand.rangeLabel, ownRows: gradeBand.ownRows, englandRows: englandGradeRows, colour: gradeBand.colour }
      : null,
    schoolName: runtime?.school?.name,
    // S3c: the phase (D7's honest options), Context's donut, Results' geography comparison
    // (the fetch above, as fetched) and Results' Trend map.
    phase: runtime?.phase,
    donut: donut ?? null,
    geography: frameGeography(geography, geo, "avgPointScore"),
    trendMap: trendMap
      ? {
          profiles: trendMap.profiles,
          targetUrn: trendMap.targetUrn,
          stage: trendMap.stage,
          chip: { subject: trendMap.subject, legend: trendMap.subjectLabel, bucket: trendMap.subjectBucket, familyId: trendMap.familyId },
          accentHex: trendMap.accentHex,
          allowed: true,
          subjectLabel: trendMap.subjectLabel,
        }
      : null,
    schoolGroup,
    schoolSet,
    schoolSetGrades,
    state: { trendStart, changeStart, showFit, latestIdx, hiddenKeys, sort, onSort: (key) => setSort(nextSort(sort, key)) },
  };

  return (
    <ColumnPanels
      columnId={columnId}
      host={columnId === "context" ? "teacher.c2.context" : "teacher.c1.results"}
      panels={panels}
      onPanelsChange={onPanelsChange}
      notes={notes}
      controls={controls}
      // Title over Current's views (bar chart and table), only when there is a comparison
      // within the category -- a lone subject has nothing to name. Not over the number
      // tiles, whose rank tile already names the category.
      render={{
        current:
          categoryLabel && subjects.length > 1 && effectiveView !== "tiles" && effectiveView !== "grades"
            ? {
                ...current,
                body: (fullscreen) => (
                  <>
                    <p className="mb-2 shrink-0 text-[12px] font-semibold text-[var(--muted2)]">
                      {measure.id === "entries" ? "Entries" : "Results"} in {categoryLabel}
                    </p>
                    {current.body(fullscreen)}
                  </>
                ),
                frame,
              }
            : { ...current, frame },
        trend: { ...trend, frame },
      }}
    />
  );
}

// Trend map/legend round Part 1: the fullscreen rail's "Subjects shown" list. Each row is
// one control -- a box filled with the line's own colour when the line is drawn, hollow
// in that colour when hidden -- so the legend and the switch are the same thing. The
// focused subject's box is ticked and disabled: the chart is about it.
function SubjectsShown({
  series,
  focusKey,
  hidden,
  onToggle,
}: {
  series: PanelData["series"];
  focusKey: string | null;
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {series.map((s) => {
        const always = s.key === focusKey;
        const shown = always || !hidden.has(s.key);
        return (
          <li key={s.key}>
            <label className={`flex items-center gap-2 text-[12.5px] ${always ? "cursor-default" : "cursor-pointer"}`}>
              <input type="checkbox" className="peer sr-only" checked={shown} disabled={always} onChange={() => onToggle(s.key)} />
              <span
                aria-hidden="true"
                className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--fg)]"
                style={{ borderColor: s.colour, background: shown ? s.colour : "transparent" }}
              >
                {shown && (
                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 5.2 4.2 7.3 8 2.8" />
                  </svg>
                )}
              </span>
              <span className={`min-w-0 truncate ${always ? "font-semibold text-[var(--fg)]" : shown ? "text-[var(--fg)]" : "text-[var(--muted)]"}`}>{s.label}</span>
              {always && <span className="ml-auto shrink-0 text-[10.5px] text-[var(--muted3)]">always on</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
