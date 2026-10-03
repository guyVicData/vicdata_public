<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Renderers

Shape requirements only, no rules. 14 renderers.

### RD-NUMBER-TILES — NumberTiles

| Field | Content |
| --- | --- |
| File | src/components/teacher/NumberTiles.tsx |
| Accepts | One main figure (single year) plus any number of small tiles (rank, England average, gap, change); no series. |
| Empty | Main figure '—' when null; tiles are dropped by the caller when they have no figure (rank tile only if the category has >1 subject; England tiles only with a same-year benchmark). |
| Suppressed | — |
| Partial | — |
| Loading | — |
| Min height | About 160px: an 80px main figure plus one row of tiles (auto-fit, min 5.5rem each). |
| Fullscreen | Main figure 112px; tiles min 11rem, larger type and icons. |
| Phone | Tiles reflow by auto-fit grid; the main figure stays one line. |
| Used by | DV-C1-CAND-CUR-TILES, DV-C1-RES-CUR-TILES, DV-C3-CUR-TILES |

### RD-MULTI-TREND — MultiTrend

| Field | Content |
| --- | --- |
| File | src/components/teacher/SeriesViews.tsx |
| Accepts | A series per subject or school over ≥2 years; a line needs ≥4 real years (R-TREND-LINE-4YR). Indexed (first year = 100) only for sum measures. |
| Empty | No two years of published figures to compare yet. |
| Suppressed | — |
| Partial | Below 4 real years: a ranked change-in-units list (ChangeList with the measure's own delta), no reference line; the Actual and Trend-line toggles disable. |
| Loading | — |
| Min height | TrendChart's plot floor, 110px, plus legend. |
| Fullscreen | Plot height 220px; the caller adds a 'Subjects shown' legend rail (Column 1, Context). |
| Phone | Plot fills the card width; x labels thin to fit (TrendChart). |
| Used by | DV-C1-CAND-TR-INDEXED, DV-C1-CAND-TR-ACTUAL, DV-C1-RES-TR-CHART, DV-C2-TR-INDEXED, DV-C2-TR-CHART, DV-C2-TR-ACTUAL |

### RD-TREND-CHART — TrendChart

| Field | Content |
| --- | --- |
| File | src/components/teacher/TrendChart.tsx |
| Accepts | One or more series at real levels (never indexed by itself) over ≥2 years; ≥4 real years for a line, else per-year bars (TrendBars). |
| Empty | No published figures for this comparison yet. |
| Suppressed | — |
| Partial | Below 4 real years: per-year bars (TrendBars) instead of a line. |
| Loading | — |
| Min height | Plot row min-h 110px (accordion round floor); bars fallback 96px body. |
| Fullscreen | Plot height 220px (bars 200px). |
| Phone | SVG stretches to the width; HTML axes keep labels upright; x ticks thin by measured width. |
| Used by | DV-C3-TR-CHART |

### RD-YEAR-TABLE — YearTable

| Field | Content |
| --- | --- |
| File | src/components/teacher/SeriesViews.tsx |
| Accepts | A series per row (subjects, schools, areas or grades) over ≥1 year; shows first and last year with the change. |
| Empty | No published figures for this comparison yet. |
| Suppressed | '—' per null cell. |
| Partial | — |
| Loading | — |
| Min height | One header row plus rows; scrolls inside the panel, centred on the focused row. |
| Fullscreen | Every year between first and last; Rank column (where showRank). |
| Phone | Card shows first and last year only so name, years and change fit without sideways scroll. |
| Used by | DV-C1-CAND-TR-TABLE, DV-C1-CAND-TR-CHANGETABLE, DV-C1-RES-TR-TABLE, DV-C1-CNT-TR-CHANGETABLE, DV-C2-TR-TABLE, DV-C2-TR-CHANGETABLE, DV-C3-TR-TABLE, DV-C3-TR-CHANGETABLE |

### RD-CHANGE-LIST — ChangeList

| Field | Content |
| --- | --- |
| File | src/components/teacher/SeriesViews.tsx |
| Accepts | One change per row (a % change by default, or the measure's own delta via formatValue), optional group reference line. |
| Empty | No two years of published figures to compare yet. |
| Suppressed | '—' for a row with no change; nulls sort last. |
| Partial | — |
| Loading | — |
| Min height | One row per item, 1.5 gap; scrolls inside the panel. |
| Fullscreen | Same list, more room. |
| Phone | Diverging bars from a centre zero; every value printed beside its bar. |
| Used by | DV-C1-CAND-TR-CHANGELIST, DV-C2-TR-CHANGELIST, DV-C3-TR-CHANGELIST |

### RD-SHARE-DONUT — ShareDonut

| Field | Content |
| --- | --- |
| File | src/components/teacher/ShareDonut.tsx |
| Accepts | Part-of-whole only: one share (0-100, clamped) of a group total of counts (R-DONUT-COUNTS-ONLY). |
| Empty | Caller: 'No published figure for {subject} or for {group} in {year}.' |
| Suppressed | — |
| Partial | — |
| Loading | — |
| Min height | 104px circle + 60px legend (164px). |
| Fullscreen | 180px circle fallback; sized to the smaller of width and height left above the legend. |
| Phone | Stays a circle: size follows the smaller of measured width and height. |
| Used by | DV-C2-CUR-DONUT |

### RD-VERTICAL-BARS — VerticalBars

| Field | Content |
| --- | --- |
| File | src/components/teacher/VerticalBars.tsx |
| Accepts | One value per subject (counts, points or rates), single year. |
| Empty | No published figures for these subjects yet. |
| Suppressed | — |
| Partial | — |
| Loading | — |
| Min height | 90px fallback floor (fills the container's free height). |
| Fullscreen | 220px fallback; keeps more bars upright before turning on its side. |
| Phone | Turns horizontal (one row per subject) when the columns would not fit the measured width. |
| Used by | DV-C2-CUR-BARS |

### RD-RANKED-LIST — RankedList

| Field | Content |
| --- | --- |
| File | src/components/teacher/RankedList.tsx |
| Accepts | One value per subject, already sorted by the caller; focused row marked. |
| Empty | — |
| Suppressed | no published figure |
| Partial | — |
| Loading | — |
| Min height | One text line per row. |
| Fullscreen | Same list. |
| Phone | Plain text list; wraps. |
| Used by | DV-C2-CUR-LIST |

### RD-SORT-TABLE — SortTable

| Field | Content |
| --- | --- |
| File | src/components/teacher/SortTable.tsx |
| Accepts | Rows with a value and a delta (vs a benchmark, group average or last year); optional leading rank. |
| Empty | — |
| Suppressed | '—' per null cell; nulls sort last whichever way a column points. |
| Partial | — |
| Loading | — |
| Min height | Header plus rows; scrolls inside the panel, centred on the focused row. |
| Fullscreen | text-sm instead of 12.5px. |
| Phone | Three or four narrow columns; no sideways scroll. |
| Used by | DV-C1-RES-CUR-TABLE, DV-C2-CUR-TABLE |

### RD-VIEW-CHART — ViewChart

| Field | Content |
| --- | --- |
| File | src/components/teacher/ViewChart.tsx |
| Accepts | One value per row (subjects or schools), single year; optional marker (e.g. National average). |
| Empty | No published figures for this comparison. |
| Suppressed | '—' for a null row value. |
| Partial | — |
| Loading | — |
| Min height | One bar row per item (row layout); 96px for the column layout. |
| Fullscreen | Same bars, wider label column. |
| Phone | Label column narrows (4.5rem / 5.5rem below sm). |
| Used by | DV-C1-RES-CUR-BAR, DV-C3-CUR-BAR |

### RD-RANKINGS-MAP — RankingsMap

| Field | Content |
| --- | --- |
| File | src/components/teacher/RankingsMap.tsx |
| Accepts | A set of schools with locations and a value each (or a change: forcedColourMode trend / trend_absolute); needs geography; not for ranking samples (R-RANKING-SAMPLE). |
| Empty | No location is recorded for this school, so there is no map to draw. |
| Suppressed | — |
| Partial | — |
| Loading | Loading map… |
| Min height | min-h 10rem (160px), flex-1. |
| Fullscreen | min-h 22rem (Comparisons Current: h-70vh); the full legend stack. |
| Phone | Leaflet with gesture handling; untitled size legend on the card. |
| Used by | DV-C1-RES-TR-MAP, DV-C3-CUR-MAP, DV-C3-TR-MAP, DV-C3-TR-CHANGEMAP |

### RD-SCHOOL-RANKING-TABLE — SchoolRankingTable

| Field | Content |
| --- | --- |
| File | src/components/teacher/SchoolRankingTable.tsx |
| Accepts | A set of schools with value, rank, distance and sector; target row marked. |
| Empty | — |
| Suppressed | '—' for a null value or distance; 'not comparable' for an IGCSE-excluded target. |
| Partial | — |
| Loading | — |
| Min height | Header plus rows; scrolls, centred on the target. |
| Fullscreen | text-sm instead of 12px. |
| Phone | Name, value, rank and distance columns; no sideways scroll. |
| Used by | DV-C3-CUR-RANKING |

### RD-GRADE-DISTRIBUTION — GradeDistribution

| Field | Content |
| --- | --- |
| File | src/components/teacher/GradeDistribution.tsx |
| Accepts | One subject × qualification's grade rows (single scale), optional benchmark share ticks and an earlier year to compare; grades clickable to pick a range. |
| Empty | Caller: 'No published grades for {subject} in this year.' / 'No published grades for {subject} yet.' |
| Suppressed | {benchLabel}: not shown for this grade (fewer than 5 schools) |
| Partial | Caller (spread): 'Only one year of published grades so far, so there is no earlier spread to compare.' |
| Loading | — |
| Min height | One row per grade (about 9-10 rows on GCSE 9-1). |
| Fullscreen | Wider label (w-44) and value columns. |
| Phone | Rows stay one line; label column 4.5rem. |
| Used by | DV-C1-RES-CUR-GRADES, DV-C1-CNT-CUR-DIST, DV-C1-CNT-TR-SPREAD |

### RD-GEOGRAPHY-VIEW — GeographyView

| Field | Content |
| --- | --- |
| File | src/components/teacher/GeographyComparison.tsx |
| Accepts | The school's own series beside its LA, region and England over time (chart: LA and England; table: all three), via useSubjectGeography. |
| Empty | No LA, regional or national {noun} figures are published for {label}. |
| Suppressed | Caller's not-applicable note (R-GEO-APPLIES), e.g. 'LA, regional and national figures are published for average point score only, not {measure}…' |
| Partial | — |
| Loading | Loading LA, regional and national figures… |
| Min height | As MultiTrend (chart) or YearTable (table), under a plain heading. |
| Fullscreen | As MultiTrend / YearTable. |
| Phone | As MultiTrend / YearTable. |
| Used by | DV-C1-CAND-TR-GEO-CHART, DV-C1-CAND-TR-GEO-TABLE, DV-C1-RES-TR-GEO-CHART, DV-C1-RES-TR-GEO-TABLE |
