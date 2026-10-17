<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Renderers

Shape requirements only, no rules. 44 renderers.

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

### RD-ADM-TILES — EntryNowTiles

| Field | Content |
| --- | --- |
| File | src/components/admissions/panels/EntryNow.tsx |
| Accepts | The entry point now: four tiles, size by phase (XS-XL), the shape line and mini profile. |
| Empty | No census for this school: the tiles say so (an FE college shows its ILR series instead). |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-NOW, DV-ADM-M-NOW |

### RD-ADM-PIPELINE — PipelineChart

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/PipelineChart.tsx |
| Accepts | Past pools then the ladder by entry year, styled by certainty (counted solid, births dashed with a range band, projection only on request). |
| Empty | No feeder set or no census in it: 'No pool to draw'. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-PIPELINE |

### RD-ADM-FUNNEL — Funnel

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Funnel.tsx |
| Accepts | Births → each kind of school's pool → the school's entry cohort, for this September's entrants. |
| Empty | A stage without a figure says 'not held'. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-FUNNEL |

### RD-ADM-MAP — AdmissionsMap

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/AdmissionsMap.tsx |
| Accepts | Schools sized by pupils at the age, coloured by trend (feeders) or by share (rivals); the school ringed. |
| Empty | No located schools. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-MAP, DV-ADM-M-MAP |

### RD-ADM-TABLE — AdmissionsTable

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Tables.tsx |
| Accepts | A row per school (or year) with the figures, flags, distance, sector, gender and XS-XL. |
| Empty | No schools in the set. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-TABLE, DV-ADM-P-ENTRY-TABLE, DV-ADM-P-POOL-TABLE, DV-ADM-P-HOLD-TABLE, DV-ADM-M-TABLE, DV-ADM-M-ACAD-NUM, DV-ADM-M-SHARE-NUM, DV-ADM-M-SHARE-RANKS |

### RD-ADM-SHAPES — ShapeAndSize

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/ShapeAndSize.tsx |
| Accepts | The school's profile by gender, the local shape, and rivals' shapes as small multiples: described, not ranked. |
| Empty | No census for a school: its card says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-SHAPE, DV-ADM-M-SHAPE |

### RD-ADM-LINE — AdmLine

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Lines.tsx |
| Accepts | A series per line over census or entry years (actual or indexed). |
| Empty | Fewer than two years: 'Not enough years yet'. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-ENTRY-LINE, DV-ADM-P-POOL-INDEXED, DV-ADM-P-HOLD-LINE, DV-ADM-M-VS-LINE, DV-ADM-M-SHARE-LINE, DV-ADM-M-ROLL-LINE |

### RD-ADM-BARS — AdmBars

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Bars.tsx |
| Accepts | Bars per year or per school; ranked bars with share, trend and results ranks. |
| Empty | No figures. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-P-ENTRY-BARS, DV-ADM-P-AREA-POP, DV-ADM-M-BARS, DV-ADM-M-VS-BARS, DV-ADM-M-ACAD-CHANGE, DV-ADM-M-SHARE-CHANGE |

### RD-ADM-DONUT — ShareDonut

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Bars.tsx |
| Accepts | The school's share of this group at the entry age. |
| Empty | No group total. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-M-DONUT |

### RD-ADM-SCATTER — MomentumScatter

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Momentum.tsx |
| Accepts | Pupil change (entry age, over 3 census years) against results change since 2022/23, four quadrants, with the flag list. |
| Empty | Thresholds not loaded: 'flags not available yet'; a school without both changes is left off the scatter and said so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-M-MOMENTUM |

### RD-ADM-STRENGTHS — StrengthsBars

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Strengths.tsx |
| Accepts | Per subject area: rank among the rivals with it, the gap to their average (diverging), its direction since 2022/23, and flags. |
| Empty | KS2 has no subject areas; no ranked areas: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-M-STRENGTHS, DV-ADM-M-ACAD-RANK |

### RD-ADM-FLAGS — FlagList

| Field | Content |
| --- | --- |
| File | src/components/admissions/views/Momentum.tsx |
| Accepts | Each rival's momentum flags, each with the figures behind it on hover. |
| Empty | Thresholds not loaded: 'flags not available yet'. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The Admissions panel's body (row 1: 470px boards; row 2: 330px). |
| Fullscreen | The panel's fullscreen modal, the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-ADM-M-FLAGS |

### RD-SMT-NOW — SchoolNow

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Now.tsx |
| Accepts | Tiles: roll and change, girls and boys (or day and boarding), headline results with national ranks, value added, Progress 8's reason, XS-XL by phase. |
| Empty | No census: the tiles say so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-O-NOW, DV-SMT-A-NOW, DV-SMT-P-NOW, DV-SMT-C-NOW |

### RD-SMT-SCORECARD — Scorecard

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Scorecard.tsx |
| Accepts | A row per headline: you, the set, the region, England, since 2022/23; 'not ranked' rows for IGCSE; the flags line. |
| Empty | No headline figures. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-O-SCORECARD |

### RD-SMT-MAP — SetMap

| Field | Content |
| --- | --- |
| File | src/components/smt/views/SetMap.tsx |
| Accepts | The school and its comparison set, located. |
| Empty | No located schools. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-O-MAP |

### RD-SMT-FLAGS — SchoolFlags

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Flags.tsx |
| Accepts | The school's own flags, each with the figures behind it. |
| Empty | No flags: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-O-FLAGS |

### RD-SMT-LINE — SmtLine

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Lines.tsx |
| Accepts | Lines by year: indexed rolls, or results with the set's middle half as a band and 2021/22 shaded. |
| Empty | Fewer than two years: 'Not enough years yet'. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-O-ROLL-LINE, DV-SMT-O-RESULTS-LINE, DV-SMT-O-MARKET-LINE, DV-SMT-A-TREND-LINE, DV-SMT-P-MARKET, DV-SMT-P-PHASES, DV-SMT-P-POOL, DV-SMT-P-AREA, DV-SMT-C-BIRTHS, DV-SMT-C-BIRTHS-INDEXED, DV-SMT-C-PROJECTION |

### RD-SMT-TABLE — SmtTable

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Tables.tsx |
| Accepts | A row per year, or per subject, with the figures behind the chart. |
| Empty | No rows. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-O-ROLL-TABLE, DV-SMT-O-RESULTS-TABLE, DV-SMT-O-MARKET-TABLE, DV-SMT-A-TREND-TABLE, DV-SMT-A-MIX-TABLE, DV-SMT-P-PHASES-TABLE, DV-SMT-C-BIRTHS-TABLE |

### RD-SMT-AREAS — SubjectAreas

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Areas.tsx |
| Accepts | Admissions' strengths and weaknesses against the comparison set. |
| Empty | No subject area with set schools to compare. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-A-AREAS |

### RD-SMT-SUBJECTS — Subjects

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Subjects.tsx |
| Accepts | The area's subjects: entries, average, rank in the set and England, since 2022/23, the subject explorer link. |
| Empty | No subjects in this area. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-A-SUBJECTS |

### RD-SMT-VA — ValueAdded

| Field | Content |
| --- | --- |
| File | src/components/smt/views/ValueAdded.tsx |
| Accepts | A-level value added by qualification type and by subject with confidence intervals; Progress 8 or its reason. |
| Empty | Not published: says which reason applies. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-A-VA |

### RD-SMT-GRADES — GradeProfile

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Grades.tsx |
| Accepts | The grade profile in bands (9-7, 6-5, 4, 3-1; A*-A, B, C, D-U). |
| Empty | No graded entries. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-A-GRADES |

### RD-SMT-MIX — EntriesMix

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Mix.tsx |
| Accepts | Each area's (or subject's) share of the entries, year by year. |
| Empty | No entries. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-A-MIX |

### RD-SMT-RESERVED — ReservedPanel

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Reserved.tsx |
| Accepts | A reserved panel: the slot exists, the data doesn't yet. |
| Empty | Always its caption. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-A-BANDS |

### RD-SMT-SHAPE — ShapeAndSize

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Pupils.tsx |
| Accepts | Pupils in each year group, the shape and since when, and the shapes around: the LA's schools of the same type, the set's shapes, Year 12 against Year 11 in the set. Described, never ranked. |
| Empty | No census: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-P-SHAPE |

### RD-SMT-ENTRIES — EntryPointsAtAGlance

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Pupils.tsx |
| Accepts | Each Admissions entry point: its cohort now and its next pool, read-only, with Open in Admissions. |
| Empty | No entry points set: the reason, and Open in Admissions. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-P-ENTRIES |

### RD-SMT-LEAVING — LeavingAt16

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Pupils.tsx |
| Accepts | Year 11 to Year 12 at the school, year by year: Year 12 against Year 11 and the net leavers. |
| Empty | No sixth form, or no Year 11: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-P-LEAVING |

### RD-SMT-AREA-MAP — AreaMap

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Context.tsx |
| Accepts | Neighbourhoods (LSOAs) within 5 miles and a ring, shaded by children per hectare, IMD or IDACI decile (one sequential scale, decile 1 darkest), or schools coloured by FSM; the 5-mile circle; the school in the accent. Before the boundaries are loaded, and for the LA, round 2's LA shading. |
| Empty | No located schools: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-C-MAP |

### RD-SMT-AGES — AgeBars

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Context.tsx |
| Accepts | Residents by single year of age 0-18, within 5 miles or in the LA, the level's ages highlighted. |
| Empty | No ages held: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-C-BYAGE, DV-SMT-C-AGES |

### RD-SMT-NEARBY — NearbyOverTime

| Field | Content |
| --- | --- |
| File | src/components/smt/views/Context.tsx |
| Accepts | Children of the level's ages within 5 miles over time, indexed, against the LA and England (residents, not pupils). |
| Empty | No small-area figures: says so. |
| Suppressed | — |
| Partial | — |
| Loading | The panel's skeleton until the route answers. |
| Min height | The SMT panel's body (row 1: 530px; row 2: 340px, as Admissions'). |
| Fullscreen | The panel's full screen (focus mode), the same view larger. |
| Phone | Full width; the large view's views become tabs (Phone.dc.html). |
| Used by | DV-SMT-C-NEARBY |
