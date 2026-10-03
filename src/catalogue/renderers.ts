// Layer 3: renderers -- chart, table and map components: shape requirements only, no
// rules (catalogue doc §2.3). State copy is quoted exactly from the components (audit A §1).
// minHeight is the component's own floor inside today's fixed 384px panel (CardBox
// PANEL_HEIGHT); fullscreen is its behaviour in the panel's fullscreen modal.
import type { Renderer } from "./types";

const T = "src/components/teacher";

export const RENDERERS: Renderer[] = [
  {
    id: "RD-NUMBER-TILES",
    component: "NumberTiles",
    file: `${T}/NumberTiles.tsx`,
    accepts: "One main figure (single year) plus any number of small tiles (rank, England average, gap, change); no series.",
    states: {
      empty: "Main figure '—' when null; tiles are dropped by the caller when they have no figure (rank tile only if the category has >1 subject; England tiles only with a same-year benchmark).",
    },
    minHeight: "About 160px: an 80px main figure plus one row of tiles (auto-fit, min 5.5rem each).",
    fullscreen: "Main figure 112px; tiles min 11rem, larger type and icons.",
    phone: "Tiles reflow by auto-fit grid; the main figure stays one line.",
  },
  {
    id: "RD-MULTI-TREND",
    component: "MultiTrend",
    file: `${T}/SeriesViews.tsx`,
    accepts: "A series per subject or school over ≥2 years; a line needs ≥4 real years (R-TREND-LINE-4YR). Indexed (first year = 100) only for sum measures.",
    states: {
      empty: "No two years of published figures to compare yet.",
      partial: "Below 4 real years: a ranked change-in-units list (ChangeList with the measure's own delta), no reference line; the Actual and Trend-line toggles disable.",
    },
    minHeight: "TrendChart's plot floor, 110px, plus legend.",
    fullscreen: "Plot height 220px; the caller adds a 'Subjects shown' legend rail (Column 1, Context).",
    phone: "Plot fills the card width; x labels thin to fit (TrendChart).",
  },
  {
    id: "RD-TREND-CHART",
    component: "TrendChart",
    file: `${T}/TrendChart.tsx`,
    accepts: "One or more series at real levels (never indexed by itself) over ≥2 years; ≥4 real years for a line, else per-year bars (TrendBars).",
    states: {
      empty: "No published figures for this comparison yet.",
      partial: "Below 4 real years: per-year bars (TrendBars) instead of a line.",
    },
    minHeight: "Plot row min-h 110px (accordion round floor); bars fallback 96px body.",
    fullscreen: "Plot height 220px (bars 200px).",
    phone: "SVG stretches to the width; HTML axes keep labels upright; x ticks thin by measured width.",
  },
  {
    id: "RD-YEAR-TABLE",
    component: "YearTable",
    file: `${T}/SeriesViews.tsx`,
    accepts: "A series per row (subjects, schools, areas or grades) over ≥1 year; shows first and last year with the change.",
    states: {
      empty: "No published figures for this comparison yet.",
      suppressed: "'—' per null cell.",
    },
    minHeight: "One header row plus rows; scrolls inside the panel, centred on the focused row.",
    fullscreen: "Every year between first and last; Rank column (where showRank).",
    phone: "Card shows first and last year only so name, years and change fit without sideways scroll.",
  },
  {
    id: "RD-CHANGE-LIST",
    component: "ChangeList",
    file: `${T}/SeriesViews.tsx`,
    accepts: "One change per row (a % change by default, or the measure's own delta via formatValue), optional group reference line.",
    states: {
      empty: "No two years of published figures to compare yet.",
      suppressed: "'—' for a row with no change; nulls sort last.",
    },
    minHeight: "One row per item, 1.5 gap; scrolls inside the panel.",
    fullscreen: "Same list, more room.",
    phone: "Diverging bars from a centre zero; every value printed beside its bar.",
  },
  {
    id: "RD-SHARE-DONUT",
    component: "ShareDonut",
    file: `${T}/ShareDonut.tsx`,
    accepts: "Part-of-whole only: one share (0-100, clamped) of a group total of counts (R-DONUT-COUNTS-ONLY).",
    states: {
      empty: "Caller: 'No published figure for {subject} or for {group} in {year}.'",
    },
    minHeight: "104px circle + 60px legend (164px).",
    fullscreen: "180px circle fallback; sized to the smaller of width and height left above the legend.",
    phone: "Stays a circle: size follows the smaller of measured width and height.",
  },
  {
    id: "RD-VERTICAL-BARS",
    component: "VerticalBars",
    file: `${T}/VerticalBars.tsx`,
    accepts: "One value per subject (counts, points or rates), single year.",
    states: {
      empty: "No published figures for these subjects yet.",
    },
    minHeight: "90px fallback floor (fills the container's free height).",
    fullscreen: "220px fallback; keeps more bars upright before turning on its side.",
    phone: "Turns horizontal (one row per subject) when the columns would not fit the measured width.",
  },
  {
    id: "RD-RANKED-LIST",
    component: "RankedList",
    file: `${T}/RankedList.tsx`,
    accepts: "One value per subject, already sorted by the caller; focused row marked.",
    states: {
      suppressed: "no published figure",
    },
    minHeight: "One text line per row.",
    fullscreen: "Same list.",
    phone: "Plain text list; wraps.",
  },
  {
    id: "RD-SORT-TABLE",
    component: "SortTable",
    file: `${T}/SortTable.tsx`,
    accepts: "Rows with a value and a delta (vs a benchmark, group average or last year); optional leading rank.",
    states: {
      suppressed: "'—' per null cell; nulls sort last whichever way a column points.",
    },
    minHeight: "Header plus rows; scrolls inside the panel, centred on the focused row.",
    fullscreen: "text-sm instead of 12.5px.",
    phone: "Three or four narrow columns; no sideways scroll.",
  },
  {
    id: "RD-VIEW-CHART",
    component: "ViewChart",
    file: `${T}/ViewChart.tsx`,
    accepts: "One value per row (subjects or schools), single year; optional marker (e.g. National average).",
    states: {
      empty: "No published figures for this comparison.",
      suppressed: "'—' for a null row value.",
    },
    minHeight: "One bar row per item (row layout); 96px for the column layout.",
    fullscreen: "Same bars, wider label column.",
    phone: "Label column narrows (4.5rem / 5.5rem below sm).",
  },
  {
    id: "RD-RANKINGS-MAP",
    component: "RankingsMap",
    file: `${T}/RankingsMap.tsx`,
    accepts: "A set of schools with locations and a value each (or a change: forcedColourMode trend / trend_absolute); needs geography; not for ranking samples (R-RANKING-SAMPLE).",
    states: {
      loading: "Loading map…",
      empty: "No location is recorded for this school, so there is no map to draw.",
    },
    minHeight: "min-h 10rem (160px), flex-1.",
    fullscreen: "min-h 22rem (Comparisons Current: h-70vh); the full legend stack.",
    phone: "Leaflet with gesture handling; untitled size legend on the card.",
  },
  {
    id: "RD-SCHOOL-RANKING-TABLE",
    component: "SchoolRankingTable",
    file: `${T}/SchoolRankingTable.tsx`,
    accepts: "A set of schools with value, rank, distance and sector; target row marked.",
    states: {
      suppressed: "'—' for a null value or distance; 'not comparable' for an IGCSE-excluded target.",
    },
    minHeight: "Header plus rows; scrolls, centred on the target.",
    fullscreen: "text-sm instead of 12px.",
    phone: "Name, value, rank and distance columns; no sideways scroll.",
  },
  {
    id: "RD-GRADE-DISTRIBUTION",
    component: "GradeDistribution",
    file: `${T}/GradeDistribution.tsx`,
    accepts: "One subject × qualification's grade rows (single scale), optional benchmark share ticks and an earlier year to compare; grades clickable to pick a range.",
    states: {
      empty: "Caller: 'No published grades for {subject} in this year.' / 'No published grades for {subject} yet.'",
      suppressed: "{benchLabel}: not shown for this grade (fewer than 5 schools)",
      partial: "Caller (spread): 'Only one year of published grades so far, so there is no earlier spread to compare.'",
    },
    minHeight: "One row per grade (about 9-10 rows on GCSE 9-1).",
    fullscreen: "Wider label (w-44) and value columns.",
    phone: "Rows stay one line; label column 4.5rem.",
  },
  {
    id: "RD-GEOGRAPHY-VIEW",
    component: "GeographyView",
    file: `${T}/GeographyComparison.tsx`,
    accepts: "The school's own series beside its LA, region and England over time (chart: LA and England; table: all three), via useSubjectGeography.",
    states: {
      loading: "Loading LA, regional and national figures…",
      empty: "No LA, regional or national {noun} figures are published for {label}.",
      suppressed: "Caller's not-applicable note (R-GEO-APPLIES), e.g. 'LA, regional and national figures are published for average point score only, not {measure}…'",
    },
    minHeight: "As MultiTrend (chart) or YearTable (table), under a plain heading.",
    fullscreen: "As MultiTrend / YearTable.",
    phone: "As MultiTrend / YearTable.",
  },
];
