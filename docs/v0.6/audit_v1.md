# VicData 0.6, S0 audit (v1)

Read-only audit for night 1 (docs/v0.6/vicdata_0_6_night1_claude_code_prompt_v1.md, S0 items 1-10), 3 Oct 2026, branch `v0.6` from `main` at 5597757. Live evidence: SELECT-only queries against vicdata-public (`lnhulykjlxmoneappnsp`) and vicdata-production (`hrqrbvrrhlidpoybezhs`). It was assembled from four audit passes, reproduced in full below as Parts A–D. Their section numbers are their own.

| S0 item | Where |
|---|---|
| 1. View inventory (registry seed) | Part A §1 |
| 2. Rules (card format, must lift) | Part A §2 |
| 3. Measures (incl. Rolls, Live births) | Part B §1 |
| 4. Placement mismatches | Part A §3 |
| 5. Panel unit | **§5 below** |
| 6. Per-user state and notes, mapping plan | Part C §6 |
| 7. Meetings → presentation configs | Part C §7 |
| 8. Roles and RLS | Part C §8 |
| 9. Performance baseline | Part B §3 (fetch map §2, batching §4) |
| 10. Claims check | Part D |

## What changes the build (the short version)

1. **Two panels per column, not three**: Current and Trends, as a one-open accordion per column. Trend and % change merged into Trends (A §0.1).
2. **The panel unit is 351 × 384**, not 385 × 256 (§5 below). The meeting slide arithmetic in scope brief §7.2 doesn't hold at this unit: two rows are 780px. Logged for night 2.
3. **Most must-lift rules live in `page.tsx`**, not the panel components (A §2). The academic RPCs and points rules live in the sibling ingest repo (`/Users/guy/dev/vicdata`). The measure data is in vicdata-production, read over HTTP (B §0).
4. **Three live behaviours break rules the catalogue states.** Fixing any of them would change a figure, so S2 lifts them verbatim and logs them:
   - Post-16 Context blends qualifications' points (R-POINTS-SAME-QUAL);
   - "% change" is offered on points and rates (catalogue §3);
   - an AS-only focused subject is left out of its own group (Part D follow-up).
5. **R-TREND-3YR is really 4 years** for a line (R-TREND-LINE-4YR).
6. **Column 1's % change half is always the LA/region/England view.** F2 is the whole of Column 1's change content.
7. **Notes and preferences:** a key-mapping layer, not a `chart_key` rewrite (C §6.3). The 3 live notes use pre-merge keys and already show nowhere.
8. **Roles:**
   - `role` is single-valued text with a CHECK constraint;
   - School-Admin is `is_admin` plus the account holder;
   - nothing gates on `role`;
   - the join page offers no Teacher option;
   - there is no system-admin identity at all.
9. **Security hole, pre-existing:** any signed-in user can insert an approved admin membership in any school (C §8.7.3). The fix is written to `docs/v0.6/proposed_sql/membership_insert_hardening.sql`. It is **not applied**, because it's an RLS change on memberships (a stop condition).
10. **Performance:** about 80 upstream calls and about 4 s of summed query time per default load, with heavy duplication (B §3).

## 5. Panel unit

Measured from the real classes at the 1280px page cap (`max-w-7xl`, `sm:p-6`), not copied from the docs.

| Quantity | Value | Source |
|---|---|---|
| Content width | 1280 − 2 × 24 = 1232 px | `page.tsx` `max-w-7xl ... sm:p-6` |
| Column track | (1232 − 4 × 18 − 2 × 2) / 3 = **385 px** | `DashboardGrid.tsx` `gap-[18px]`, `xl:grid-cols-[1fr_2px_1fr_2px_1fr]` |
| Panel (CardBox) width | 385 − 2 × 1 (border) − 2 × 16 (`p-4`) = **351 px** | `DashboardColumn.tsx` |
| Panel height | **384 px** (`PANEL_HEIGHT`, accordion round) | `CardBox.tsx:83` |
| Gap between panels in a column | 12 px (`mt-3`) | `CardBox.tsx:303` |
| Gap between columns | 18 + 2 (divider) + 18 = 38 px track-to-track | `DashboardGrid.tsx` |
| Collapsed panel bar | about 46 px (+ 12 px `mt-3`) | `CardBox.tsx:227` comment budget |

So the unit is **351 × 384** inside a **385**-wide column track. The docs' "about 385 × 256 with 24 px gaps" predates the accordion round, which raised the height to 384. The renderer's `PANEL_UNIT` (`src/catalogue/config.ts`) carries these numbers, and a unit test pins it to `PANEL_HEIGHT`. Below `xl` the grid is two columns from `md` and stacked on a phone, with the panel full width at the same height.

**Consequence for meetings (night 2):** a 3 × 2 slide at this unit is 3 × 385 + 2 × 38 = 1231 px wide, which fits 1280. But it is 2 × 384 + 12 = 780 px tall, which does not fit 720 with a title. Logged in OPEN_QUESTIONS.md for Guy: scale slides, or a meeting-specific unit.

---


# Part A — Views, rules, placement, titles

Read-only audit, 3 Oct 2026. Every claim below was checked against code. File:line refs are to
`/Users/guy/dev/vicdata_public` unless prefixed `vicdata:` (the sibling reference-data repo
`/Users/guy/dev/vicdata`, where the RPCs and ingest rollups that back this app actually live —
**`supabase/migrations` in this repo holds none of the academic RPCs**; it holds only the
nearest-schools / comparator-candidate / app-table migrations).

Abbreviations: `P` = `src/app/teacher/[phase]/page.tsx`, `CP` = `src/components/teacher/CandidatesPanels.tsx`,
`SP` = `SubjectPanels.tsx`, `XP` = `ComparisonsPanels.tsx`, `GP` = `GradeCountsPanels.tsx`,
`GC` = `GeographyComparison.tsx`, `SV` = `SeriesViews.tsx`, `TVP` = `src/lib/teacher-view-panels.ts`,
`SG` = `src/lib/subject-grades.ts`.

---

## 0. Structural facts that brief-level docs get wrong

1. **Two panels per column, not three.** `PanelId = "current" | "trend"` (TVP:21-24). Trend and % change
   were merged into one "Trends" panel whose rail is Trend's views then % change's (CP:444-457,
   SP:1015-1028, XP:777-792, GP:201-214). A standard accordion: one panel open at a time
   (TVP:58-60, `togglePanel`). Default open set = `["current"]`, stored as the key being absent (P:408-420).
2. **Column 1 is one column with one persistence key `"candidates"`** in both modes (P:1461 `COL1`).
   The `DashboardColumn` id/icon switches `results`/`candidates` (P:1616) but panels and notes do not.
3. **The shared Candidates/Results toggle drives all three columns** (P:969-971, key `measure:shared`).
   The Results sub-measure is `measure:results` (P:986-988) — **Column 1 only**; Context and
   Comparisons resolve their own measure from it with fallbacks (P:1174-1175, P:1436-1443, see rule
   R-MEASURE-FALLBACK).
4. **Results sub-measures exist in BOTH phases: points, threshold, bands, counts** (TVP:110-159;
   MeasurePicker lists all four, no phase gating, `MeasurePicker.tsx`). Threshold is "Grade 4+ rate"
   at GCSE and "A*–E rate" at Post-16 (TVP:106-108). Bands presets exist only on the GCSE 9-1 scale
   (`4–9`, `7–9`, SG:201-205); default range is 7–9 when on that scale, else none (P:1004-1014).
   "Average point score" is still the label (TVP:113) — rename to "Average points" is decided (C3) but not done.
5. **Column 1's % change half is ALWAYS the geography view**, in both modes and both phases. The page
   passes `geography` whenever `focusItem && schoolUrn` (Candidates P:1850-1865, Results P:1720-1737),
   and both panels switch the whole change half on `geography` being present (CP:391-392, SP:946).
   `applies:false` only changes the body to a "not applicable" note. Consequence: Column 1's
   category **ChangeList and Change table are unreachable dead branches** (CP:393-417; Results'
   use of SP:959-991). CP's comment "GCSE only" (CP:95-96) is stale — Post-16 geography applies (P:1857).
6. **The catalogue's R-TREND-3YR is wrong.** The live threshold is **4 real years** for a line
   (`TREND_LINE_MIN_YEARS = 4`, TVP:311). `TREND_MIN_YEARS = 3` (`teacher-view-catalogue.ts:24`)
   is the round-5 axis catalogue, used only by `src/app/teacher/meetings/page.tsx:25,69,76,153`.
7. **Results' England-category group line is dead.** `resultsGroups[1]` ("England {category} average",
   P:1153-1159) is built but never drawn: Results uses `changeScope="individual"` (P:1709), whose Trend
   draws subjects only (SP:698-706), and its change half is geography (point 5).
8. `ComparisonsPanels`' `currentLabel` prop is declared (XP:160) and passed (P:2069-2073) but never
   destructured/read; `SubjectPanels`' `currentLabel` likewise unused (SP:161-167). Safe to drop from params.
9. KS2 has no panels: Column 1 and Context render single `CardBox`es (P:1627-1662, P:1887-1904);
   Comparisons **does** render `ComparisonsPanels` at KS2 (P:2015). Out of scope for the 4 dashboards but
   any registry must not assume ComparisonsPanels is ks4/ks5-only.

---

## 1. View inventory (dataview registry seed)

### 1.1 ID scheme
`DV-{column}-{mode}-{row}-{shape}` — column C1/C2/C3; mode CAND (Candidates), RES (Results on
points/threshold/bands), CNT (Results on Grade counts); C2/C3 omit mode where the same view serves both.
Row CUR (Current) / TR (Trends). Shape from the rail label.

### 1.2 Column 1 — Candidates mode (`CandidatesPanels`, mounted P:1819-1872; not at KS2)

Data: `entriesAt` = sum of the item's own headline rows' `entriesTotal` (P:941-944); GCSE rows are per
subject, Post-16 per exact qualification (P:489-495). Population: `candidateItems` = focus + same-category,
same-qualification-family, non-AS/AEA peers, deduped per subject at GCSE (P:1068-1099).

| ID | Where (body) | Row | Measure / focus / compare | Number type | Date | View type | Renders + key props | Title (file:line) | Empty / suppressed copy | Rules applied (where) | Rail |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DV-C1-CAND-CUR-TILES | CP:226-255 | Current | entries / subject / **subjects-in-school** (category rank, school rank) | totals (main), rank, pct_change (tile) | single (latest) | numerical | `NumberTiles{main,tiles,fullscreen}` (CP:238); tiles CP:197-220 | `"{focused.label} {currentLabel ?? "Candidates"}: {year}"` CP:236 (currentLabel="Candidates" P:1871) | `Pick a subject to see its entries.` CP:232; main figure `—` if null (CP:195); rank tile only if category size >1 (CP:201) | R-FOCUS-NEVER-FILTERED, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP (P:1068-1099, P:1836-1840); R-RANK-TIES (TVP:325) | none — Current has no rail |
| DV-C1-CAND-TR-INDEXED | CP:306-320 | Trends | entries / subject / subjects-in-school (category, each its own line) | index100 | trend | graph | `MultiTrend{data,measure,focusKey,showFit,fullscreen}` (+`TrendScaleTitle` CP:310) | `Entries in {category}` CP:270,308 (only if group); then TrendScaleTitle indexed (SV:116-124) | <4 yrs → ranked change-in-units list (SV:76-90); no data `No two years of published figures to compare yet.` (SV:165); summary fallback `Not enough published years yet to describe a trend.` CP:327 | R-TREND-LINE-4YR (SV:48-49), R-INDEX-HEADCOUNTS (trend-styles:102), R-PERIOD-TRIM (CP:165) | `Indexed` IndexedLineIcon CP:291 |
| DV-C1-CAND-TR-ACTUAL | same, `index={false}` CP:318 | Trends | same | totals | trend | graph | `MultiTrend index=false` | as above, TrendScaleTitle actual: `"{Noun} each year, real numbers: one scale for every subject, so small ones sit low."` SV:121 | button disabled when no line (CP:292) | R-TREND-LINE-4YR | `Actual` TrendLineIcon CP:292 |
| DV-C1-CAND-TR-TABLE | CP:297-305 | Trends | same | totals (+change col) | trend | table | `YearTable{data,measure,focusKey,fullscreen}` | `"{Entries in {category}}, year by year"` else `"{focused.label ?? "Entries"}, year by year"` CP:301 | `No published figures for this comparison yet.` (SV:270) | R-PERIOD-TRIM | `Trend table` TableIcon CP:293 |
| DV-C1-CAND-TR-GEO-CHART | GC:149-162 via CP:352-366 | Trends (% change half) | entries (**points-eligible**) / subject / **geography: LA, England** (region dropped from chart, GC:152) | index100 | trend | graph | `GeographyView{geography,geo,metric:"entries",ownPeriods,spanPeriods,measure,theme,accentHex,view:"chart",fullscreen}` | heading `"{label} against the wider system"` GC:91 (plain p, not ViewTitle); TrendScaleTitle indexed GC:159 | not applicable: `LA, regional and national entries figures aren't available for {subject}: they count GCSE (points-eligible) entries only, and this school's {subject} entries are in a qualification outside that.` (P:1858); loading `Loading LA, regional and national figures…` GC:100; none: `No LA, regional or national entries figures are published for {label}.` GC:118 | R-GEO-APPLIES (P:1857), R-GEO-POINTS-ELIGIBLE (P:1859-1862), R-MIN-SCHOOLS (RPC), R-KS5-ENGLAND-EXACT (route) | `Area chart` TrendLineIcon CP:384-386 |
| DV-C1-CAND-TR-GEO-TABLE | GC:131-147 | Trends (% change half) | same, incl. region | totals + pct change emphasis | trend | table | `GeographyView view:"table"` → `YearTable{nameHeading:"Where",showRank:false,changeEmphasis:"percent"}` | heading GC:91 | same three states | same | `Change table` TableIcon CP:387 |
| *(dead)* DV-C1-CAND-TR-CHANGELIST | CP:404-417 | — | entries / category | pct_change | trend | ranking | `ChangeList` | `"{inCategory}: % change since {yr}, ranked"` / `"Entries: % change since {yr}"` CP:408 | — | unreachable (§0.5) | — |
| *(dead)* DV-C1-CAND-TR-CHANGETABLE | CP:393-403 | — | — | — | — | table | `YearTable` | `"{inCategory}: {yr} against the latest year, with the change"` / `"Entries by year, since {yr}"` CP:398 | — | unreachable | — |

Trends rail order (CP:448-453): Indexed, Actual, Trend table, Area chart, Change table. Default `chart` (Indexed) CP:113.
Questions: Current `q.howMany` (P:1868); Trend `How have candidate numbers moved, year on year?` CP:275; change
`How has {label} moved, against its LA, region and England?` CP:378-380.

### 1.3 Column 1 — Results mode, points / threshold / bands (`SubjectPanels`, P:1697-1817)

Data: `valueForResults` (P:1037-1038): points = `pointsAt` (GCSE: only for `GCSE (9-1) Full Course` items,
P:935-939); threshold = `thresholdRate` per subject × exact qual (P:977-982, SG:155-180); bands = `bandRate`
(P:1030-1031, SG:232-241). Benchmark per subject = England same subject (GCSE) / same subject × exact qual
(Post-16), same year (P:1136, P:521-529) — **absent for threshold and bands** at page level; for bands SP sets
the focus's England rate from grade geography (SP:282-292). Periods: points = category periods; threshold/bands
= periods with grade rows (P:1112-1116).

| ID | Where | Row | Measure / focus / compare | Number type | Date | View | Renders + props | Title | Empty / suppressed | Rules (where) | Rail |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DV-C1-RES-CUR-TILES | SP:572-573, tiles SP:409-451 | Current | points\|threshold\|bands / subject / subjects-in-school (category rank) + **geography England** (avg + gap tiles) | points/rate (main), rank, points\|rate (England), change_points\|change_pp (gap) | single (latest; no year menu) | numerical | `NumberTiles{main,tiles}`; `tiles` prop P:1740 | none (wrapper title suppressed for tiles, SP:1042) | main `—` if null (SP:412); England tiles only if bench≠null (SP:436-450) — so threshold shows rank tile only | R-SAME-YEAR-BENCH (P:535-538), R-NO-GRADE-RATE-GEO (P:1136), R-BANDS-ENGLAND-BENCH (SP:284-292) | `Number tiles` TilesIcon SP:523 (default view SP:256) |
| DV-C1-RES-CUR-TILES (bands variant) | SP:415-427 | Current | bands / subject / England | totals (met count), rate, change_pp | single | numerical | same | none | tile `"of {n} graded entries at {range}"` SP:420; England tiles if bench | R-BANDS-ENGLAND-BENCH, R-NON-GRADES-EXCL (SG:233) | same |
| DV-C1-RES-CUR-GRADES | SP:546-562 | Current (bands only) | bands / subject / England share ticks | rate (share per grade) | single | graph | `GradeDistribution{rows,total,colour,range,pending,onGradeClick,benchLabel,fullscreen}` | none (wrapper suppressed SP:1042) | `No published grades for {subject} in this year.` SP:561; no range: `Pick a range to see a rate: open Grades and click one grade, then another.` + `Open Grades` SP:563-571 | R-NON-GRADES-EXCL (SP:456-457), R-GRADE-SCALE-MATCH | `Grades (pick a range)` GradesIcon SP:524 (+ `Custom…`/`Pick grades…` pill SP:482) |
| DV-C1-RES-CUR-BAR | SP:607-629 | Current | measure / subject / subjects-in-school (category) + **England marker** | points\|rate | single | ranking (bars) | `ViewChart{layout:"row",formatValue,markerLabel:"National average",scaleMax,spacious,computed.rows}` | wrapper `"{Results} in {category}"` SP:1047-1049 (plain p, if >1 subject) | `No published figures for this comparison.` (ViewChart:58/99); marker absent for threshold | R-SAME-YEAR-BENCH, R-NO-GRADE-RATE-GEO | `Bar chart` HorizontalBarsIcon SP:535 |
| DV-C1-RES-CUR-TABLE | SP:630-649 | Current | same | points\|rate + change_points\|change_pp vs England, or **vs last year** | single | table | `SortTable{rows,sort,onSort,columns{name:"Subject",value:"Result",delta:"vs National"|"vs last year"},leadingRank:false,showValue:true}` | wrapper as above | `—` per null cell | R-PREV-YEAR-FALLBACK (SP:331-344, P:1786) | `Sortable table` RankListIcon SP:537 |
| DV-C1-RES-TR-CHART | SP:862-879 | Trends | measure / subject / subjects-in-school (category, each its own line) | points\|rate | trend | graph | `MultiTrend{data,measure,focusKey,showFit,fullscreen,seriesLegend}` (never indexed: mean measure) | `"{Results in {category}}: each subject's line"` else `"{focus label}, each year"` SP:866 (scope SP:765-772) | <4 yrs → change-in-units ranked list (SV:76-90); summary `Not enough published years yet to describe a trend.` SP:886 | R-TREND-LINE-4YR, R-PERIOD-TRIM, R-THRESHOLD-PERIODS (P:1112-1116) | `Chart` TrendLineIcon SP:804 |
| DV-C1-RES-TR-TABLE | SP:848-861 | Trends | same | points\|rate | trend | table | `YearTable` | `"{scope}, year by year"` else `"{focus label ?? Results}, year by year"` SP:852 | SV:270 | same | `Trend table` TableIcon SP:805 |
| DV-C1-RES-TR-MAP | SP:823-847 | Trends | measure (map's own: points/grade band) / subject / **school set** (comparator schools) | points | single-ish (map's own toggle) | map | `RankingsMap{profiles,targetUrn,stage,heightClass,subject,subjectLabel,subjectBucket,familyId,dense,accentHex,untitledSizeLegend}`; needs `trendMap` (P:1743-1756: activeMapChip && schoolUrn) | `"{subjectLabel} at each comparator school, on the map"` SP:833 | `No location is recorded for this school, so there is no map to draw.` (RankingsMap:66); falls back to Chart if focus loses its chip (SP:274) | R-IGCSE-EXCL (RankingsMap:90) | `Map` MapPinIcon SP:806 |
| DV-C1-RES-TR-GEO-CHART | GC via SP:946-958 | Trends (% change half) | points / subject / geography LA, England | points | trend | graph | `GeographyView metric:"avgPointScore" view:"chart"` | heading GC:91; no TrendScaleTitle (not indexed, GC:159) | not applicable (points only): `LA, regional and national figures are published for average point score only, not {measure}. Switch Results to average point score to compare {subject} with the wider system.` (P:1733); GCSE non-full-course: `LA, regional and national figures cover GCSE (full course) average point scores only, and this school's {subject} entries are in a qualification outside that.` (P:1734); loading/none GC:100,118 | R-NO-GRADE-RATE-GEO (P:1728), R-KS4-POINTS-GCSE-FULL (P:1729), R-KS5-ENGLAND-EXACT, R-MIN-SCHOOLS | `Area chart` TrendLineIcon SP:932 |
| DV-C1-RES-TR-GEO-TABLE | GC:131-147 | Trends | same incl. region | points | trend | table | `GeographyView view:"table"` | GC:91 | same | same | `Change table` TableIcon SP:935 |

Results Current rail order (SP:521-539): Number tiles, [Grades — bands only], Bar chart, Sortable table. Default tiles.
Trends rail (points/threshold/bands, never indexed): Chart, Trend table, [Map], Area chart, Change table. Default Chart.
Band chips (Current `controls`, SP:472-487): `Grades 4–9`, `Grades 7–9` (GCSE only), `Custom…`/`Pick grades…`, status text.
Questions: Current `q.howWell`; Trend `How have my subjects' results moved, year on year?`; change (geo) `How has {label} moved, against its LA, region and England?` (P:1803-1807, SP:928).
"i" notes: threshold P:1798, bands P:1800.

### 1.4 Column 1 — Results mode, Grade counts (`GradeCountsPanels`, P:1674-1695; needs focusItem)

| ID | Where | Row | Measure / focus / compare | Number type | Date | View | Renders | Title | Empty | Rules | Rail |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DV-C1-CNT-CUR-DIST | GP:112-139 | Current | grade counts / subject / **England share ticks** | totals + rate (share per grade) | single | graph | `GradeDistribution{rows,total,colour,range,pending,onGradeClick,benchLabel,fullscreen}` | **none**; tag is `"Grade counts {year}"` GP:113 (not "Current", no DataDate) | `No published grades for {subject} yet.` GP:130 | R-NON-GRADES-EXCL (GP:56,86), R-MIN-SCHOOLS (grade RPC, England included, route comment) | none (no rail); `Click two grades…`/`Clear` controls GP:115-122 |
| DV-C1-CNT-TR-SPREAD | GP:141-168 | Trends | grade counts / subject / own earlier year | totals / share | trend (2 years) | graph | `GradeDistribution{compareTotal,compareLabel}` | `"{subject}'s spread of grades: {yr} against {cmpYr}, grade by grade"` GP:150 | `Only one year of published grades so far, so there is no earlier spread to compare.` GP:147; summary `Grades are published per subject from 2023/24 only; a second year is needed to compare.` GP:110 | R-NON-GRADES-EXCL | `Spread by year` GradesIcon GP:207 |
| DV-C1-CNT-TR-CHANGETABLE | GP:180-197 | Trends | grade counts / subject / none | totals + change | trend | table | `YearTable{measure:ENTRIES_MEASURE,nameHeading:"Grade",showRank:false}` | `"{subject}'s entries at each grade: {chgYr} against {yr}, with the change"` GP:189-191 | `Only one year of published grades so far, so there is nothing to measure a change against.` GP:186 | — | `Change table` TableIcon GP:208 |

### 1.5 Column 2 — Context (`SubjectPanels`, P:1910-2005; not at KS2)

Measure: `contextMeasure` — entries on Candidates; on Results the Column-1 sub-measure, **except counts or bands-without-range → points** (P:1174-1175). Compare-against pill `against:context` ∈ category (default) | whole ("All subjects") | selected (P:1179-1181; ContextPills.tsx:41,70-95). Subjects: category = Column 1's `candidateItems` (P:1359-1360); whole = every item with entries, non-AS/AEA (P:1361-1369, **no qualification-family filter**); selected = ticked set ∩ family + focus (P:1271-1283). Group average = mean over members (P:1306); group total = sum/mean by aggregate (P:1303-1305). Benchmark per subject = group average (P:1379). Year menu (`yearControl`).

| ID | Where | Row | Measure / focus / compare | Number type | Date | View | Renders | Title (SP:492-501) | Empty | Rules | Rail |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DV-C2-CUR-DONUT | SP:574-594 | Current | entries, or bands-with-range (group's entries in range) / subject (or group for bands) / subjects-in-school group | market_share | single (year menu) | donut | `ShareDonut{percent,label,groupLabel,valueLabel,otherLabel,groupValueLabel,colour,fullscreen}` (clamps 0-100, ShareDonut:60) | entries: `"Entries in {subject} as a proportion of {group phrase}"`; bands: `"Entries at {range} as a proportion of graded entries in {group phrase}"` | `No published figure for {subject} or for {group} in {year}.` SP:576-579; disabled tooltip `Share is only meaningful for candidate numbers` SP:527 | R-DONUT-COUNTS-ONLY (P:1956, SP:297, SP:525-534), R-SELF-INCLUSIVE-GROUP (P:1277), R-KS5-ASAEA-EXCL (P:1190, 1331) | `Share (donut)` DonutIcon SP:525-534 |
| DV-C2-CUR-BARS | SP:595-602 | Current (default, SP:256) | measure / subject / subjects-in-school | totals\|points\|rate | single | ranking (vertical bars) | `VerticalBars{bars,measure,fullscreen}` | `"{Entries|Results} by subject in {group phrase}"` | `No published figures for these subjects yet.` VerticalBars:156 | R-QUAL-FAMILY-MATCH (category/selected only) | `Bar chart` VerticalBarsIcon SP:535 |
| DV-C2-CUR-LIST | SP:603-606 | Current | same | same | single | ranking | `RankedList{rows,measure,focusKey}` | same | per row `no published figure` RankedList:29 | same | `Ranked list` RankListIcon SP:536 |
| DV-C2-CUR-TABLE | SP:630-649 | Current | same, delta vs group average | rank + change_points/pp/totals vs avg | single | table | `SortTable{leadingRank:true,showValue:false, delta:"vs average"}` (P:1923-1924) | same | — | R-SELF-INCLUSIVE-GROUP | `Sortable table` TableIcon SP:537 |
| DV-C2-TR-INDEXED (entries) / DV-C2-TR-CHART (results) | SP:862-879 | Trends | measure / subject / subjects-in-school (each its own line; card = focus vs group avg when "whole", P:1922, SP:726-738) | index100 (entries) / points\|rate | trend | graph | `MultiTrend` (+ fullscreen legend `SubjectsShown` SP:814-816, SP:1065) | entries: `{scope}` (SP:866) + TrendScaleTitle; results: `"{scope}: each subject's line"`. scope = `"{Entries|Results} in {benchmarkLabel lower}"` (SP:769-770) e.g. "Entries in all subjects" | as 1.3 | R-TREND-LINE-4YR, R-INDEX-HEADCOUNTS | entries `Indexed` SP:797 / results `Chart` SP:804 |
| DV-C2-TR-ACTUAL | SP:797-799 | Trends (entries only) | entries | totals | trend | graph | `MultiTrend index=false` | scope + TrendScaleTitle actual | disabled w/o line | — | `Actual` SP:798 |
| DV-C2-TR-TABLE | SP:848-861 | Trends | same | totals\|points\|rate | trend | table | `YearTable` (fullscreen filtered by legend) | `"{scope}, year by year"` | SV:270 | — | `Trend table` SP:799/805 |
| DV-C2-TR-CHANGELIST | SP:975-990 | Trends (% change half) | measure / subject / subjects-in-school, group avg as reference line | pct_change | trend | ranking | `ChangeList{rows,focusKey,group}` | `"{scope}: % change since {yr}, ranked"` / `"{Entries|Results}: % change since {yr}"` SP:978 | `No two years of published figures to compare yet.` SV:165; summary `Not enough published years yet to compare on change.` SP:1002 | **pct_change on points/rates** (see R-NUMBER-TYPE-HONESTY) | `Ranked change` HorizontalBarsIcon SP:932 |
| DV-C2-TR-CHANGETABLE | SP:959-974 | Trends | same | values + change | trend | table | `YearTable{leadingRank}` | `"{scope}: {yr} against the latest year, ranked by change"` / `"{noun} by year, since {yr}"` SP:961-963 | SV:270 | — | `Change table` TableIcon SP:935 |

Context Current rail (rankedViews): Share (donut), Bar chart, Ranked list, Sortable table; default Bar chart.
Context Trends rail: entries → Indexed, Actual, Trend table, Ranked change, Change table; results → Chart, Trend table, Ranked change, Change table. No Map (trendMap not passed).
Questions: Current `q.nearMe`; Trend `How have my subjects moved against {group lower}?`; change `Which of my subjects have moved most, against {group lower}?` (P:1981-1985). Notes P:1994-2004 (incl. fallback notes `Grade counts has no single figure to compare subjects on, so Context shows average point score.` / `Pick a grade range in Results to compare subjects on it; until then Context shows average point score.`).

### 1.6 Column 3 — Comparisons (`ComparisonsPanels`, P:2015-2074; all phases incl. KS2)

Measure: Candidates → entries; Results with a subject chip → points (`measuresFor[0]`) or threshold/bands-with-range (rate); Results with no chip → phase headline (Attainment 8 / A-level APS / KS2 expected std) (P:1437-1443). Rates come from per-school grade counts (`/api/teacher/comparator-grades`, XP:177-207). Set = saved set | chooser choice (urns | ranking) | default "10 nearest schools" (P:55-78, 1391-1403). Focus: subject when `activeMapChip`, else **school** (whole-school headline).

| ID | Where | Row | Measure / focus / compare | Number type | Date | View | Renders | Title (XP:316-328) | Empty | Rules | Rail |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DV-C3-CUR-MAP | XP:373-403 | Current (default, XP:210) | measure (map: accent value colour) / subject or school / school set | points\|totals | single | map | `RankingsMap{profiles,targetUrn,stage,heightClass,subject,subjectLabel,subjectBucket,familyId,dense,accentHex,onCaption,onTargetRank,forcedColourMode}` | `"{titleOn} by school, on the map"` | `No location is recorded for this school, so there is no map to draw.` XP:401; not offered for ranking sets (XP:213, 339-343) | R-IGCSE-EXCL (RankingsMap:90), R-RANKING-SAMPLE | `Map` MapPinIcon XP:342 |
| DV-C3-CUR-TILES | XP:349-369 | Current (ranking sets only; default there) | **headline only** / school / ranking population (rank, population average) | points + rank | single | numerical | `NumberTiles` | `"{target}'s rank in the {set}: {measureName}"` | — | R-RANKING-SAMPLE (chooser-sets.ts:46-61) | `Number tiles` TilesIcon XP:340 |
| DV-C3-CUR-BAR | XP:404-448 | Current | measure / subject or school / school set; on ranking-measure: school vs population average | points\|rate\|totals | single | ranking | `ViewChart{layout:"row",formatValue,scaleMax,computed.rows}` | `"{Entries|Results} by school in the {set}"`; ranking measure: `"{titleOn}: {target} against the {set}'s average"` | `No published figures for this comparison.` ViewChart | R-COMPARATOR-NO-FIGURE (XP:254, 274-277) | `Bar chart` HorizontalBarsIcon XP:344 |
| DV-C3-CUR-RANKING | XP:452-464 | Current | same | value + rank (+ distance, sector) | single | table | `SchoolRankingTable{rows,valueHeading,targetName,fullscreen}` | `"Schools ranked by {titleOn} in the {set}"` | `not comparable` value for IGCSE-excluded target (XP:306) | R-COMPARATOR-NO-FIGURE, R-RANK-TIES, R-IGCSE-EXCL | `Ranking` RankListIcon XP:345 |
| DV-C3-TR-CHART | XP:680-685 | Trends | measure / subject or school / **set average** or one named school (vs: pill) | points\|rate\|totals (real values; TrendChart not indexed) | trend | graph | `TrendChart{data,measure,showFit,fullscreen,focusKey:"own"}` | `"This school's {comparedOn} against {versus lower}, year by year"` XP:682 | <4 yrs → **table only, Chart button hidden** (XP:614-616, 649); summary `Not enough published years yet to describe a trend for this school.` XP:691 | R-TREND-LINE-4YR, R-RANKING-SAMPLE (population avg on ranking measure XP:499-506) | `Chart` TrendLineIcon XP:649 |
| DV-C3-TR-TABLE | XP:670-679 | Trends | measure / … / every school in set | values + change | trend | table | `YearTable{nameHeading:"School"}` | `"Every school in the {set}: {comparedOn}, year by year"` XP:675 | SV:270 | — | `Trend table` TableIcon XP:650 |
| DV-C3-TR-MAP | XP:659-669 | Trends | change in measure / … / set | change_points\|change_pp\|totals delta | trend | map | `RankingsMap{forcedColourMode:"trend_absolute",changeValues}` | `"Change in {comparedOn} since {yr}, coloured by school"` XP:663 | offered only if not ranking, has location, ≥2 periods (XP:615) | R-RANKING-SAMPLE | `Trend map` MapPinIcon XP:651 |
| DV-C3-TR-CHANGELIST | XP:747-755 | Trends (% change half) | pct change / … / set, set average reference | pct_change | trend | ranking | `ChangeList{rows,focusKey:"own",group}` | `"% change in {comparedOn} since {yr}, ranked against the {set}"` XP:751 | summary `Not enough published years yet to measure a change.` XP:759 | **pct_change on points/rates** | `Ranked bars` HorizontalBarsIcon XP:724 |
| DV-C3-TR-CHANGETABLE | XP:740-746 | Trends | same | values + change | trend | table | `YearTable{nameHeading:"School",leadingRank}` | `"Every school in the {set}: {yr} against the latest year, ranked by change"` XP:742 | SV:270 | — | `Change table` TableIcon XP:725 |
| DV-C3-TR-CHANGEMAP | XP:733-739 | Trends | pct change / … / set | pct_change | trend | map | `RankingsMap{forcedColourMode:"trend"}` | `"% change in {comparedOn} since {yr}, coloured by school"` XP:737 | as TR-MAP (XP:713-714) | R-RANKING-SAMPLE | `Change map` MapPinIcon XP:726 |

Column-wide states: loading `Loading {subject ?? "the comparison"}…` (XP:372, 658, 732); empty set `No schools in this comparison with comparable published data for this phase.` (P:1456); summary fallbacks XP:473-475; whole-column note on rates: `Comparator schools' {grade 4+ rate} for {subject} could not be loaded. Try again shortly.` / `None of the {set} publishes a {grade 4+ rate} for {subject}.` (XP:797-803) with heading `{subject} against comparator schools` (XP:812).
Current rail: [Number tiles | Map], Bar chart, Ranking. Trends rail: [Chart], Trend table, [Trend map], Ranked bars, Change table, [Change map]. `vs:` pill only on Trend half (XP:781). Questions: Current `q.wider`; Trend `How has this school moved against its comparators, year on year?` XP:626; change `How much has this school moved, against its comparators?` XP:719.

### 1.7 Phase / mode gating summary

| Gate | GCSE | Post-16 | Where |
|---|---|---|---|
| Item grain | subject (headline per subject) | subject × exact qualification | P:489-495 |
| Column 1 category dedup | one row per subject | none | P:1096-1099, P:1839 |
| Candidates geography applies | only `GCSE (9-1) Full Course` focus | always (exact qual) | P:1857 |
| Results geography applies | points AND GCSE full course | points | P:1727-1729 |
| Threshold | Grade 4+ (9-1, Double Award strict both digits ≥4) | A*–E (A-level scale only; IB 7-1 not scored) | SG:155-180 |
| Bands presets | 4–9, 7–9; default 7–9 | none; "Pick grades…" | SG:201-205, P:1012-1013 |
| Points scale max | 9 | 60 | TVP:98-100 |
| Comparisons headline | Attainment 8 | "Average point score" | TVP:182-195 |
| Ranking chooser sets | yes | yes (not KS2) | chooser-set route:49 |
| AS/AEA exclusion | n/a | yes | P:1055, 1190 |
| IGCSE comparator drop | yes | n/a | teacher-view-comparator-series.ts:130 |
| Map chips | per subject | per subject × bucket | P:876-899 |
| Grade counts / bands | yes | yes | TVP:136-158 |

### 1.8 State the views depend on (becomes per-user state / params)

**Persisted** (`teacher_view_preferences.columns`, via `writeSetting`/`writeList`, P:408-476; keys `teacher-view-data.ts:105-119`):
`candidates` / `context` / `rankings` (open panel list), `measure:shared` (candidates|results), `measure:results`
(points|threshold|bands|counts), `against:context` (category|whole|selected; legacy "area" → category), `chosen:context`
(list of item keys), `set:rankings` (saved set key or "chooser"), `chooser:rankings` (JSON ChooserChoice), `band:range`
(JSON {top,bottom}), `nav:labels`. Plus `subjects` (ticked items) and `lastSeenPeriod`.
**Not persisted (page useState):** `chosenFocusKey` (P:202 — the focus subject resets on reload to first ticked),
`bandPending` (P:195), `mapRank` (P:193).
**Panel-local useState (lost on reload; the registry must model these as view params):**
- CP: `trendsView` (CP:113, default chart), `trendStart` (CP:121), `changeStart` (CP:122), `showFit` (CP:123).
- SP: `view` (SP:256; default tiles if `tiles`, else bar for Context), `sort` (SP:258), `yearIdx` (SP:259), `trendStart`, `changeStart`, `showFit` (SP:260-262), `trendsView` (SP:269), legend `hidden` (SP:277).
- XP: `viewChosen` (XP:210, default map), `mapCaption` (XP:216), `versusChoice` (XP:221, stamped with set id), `versusOpen`, `trendStart`, `changeStart`, `showFit` (XP:224-227), `trendsView` (XP:232), comparator `grades` fetch (XP:179).
- GP: `compareFrom` (GP:60), `changeFrom` (GP:61), `trendsView` (GP:64), `pending`, `span` (GP:71-72).
**Notes key** `{phase}:{columnId}:{panelId}` (teacher-view-data.ts:189), columnId ∈ candidates|context|rankings, panelId ∈ current|trend. Notes saved under the pre-merge `change` panel id are no longer read anywhere (orphaned) — S0 key-mapping decision should cover them.

---

## 2. Rules (catalogue §2.1 format)

"Must lift" = enforced only in UI code (`src/components/**` or the client page `P`) rather than lib/route/RPC/ingest.
Lift target is named; "figure change?" assumes a verbatim move.

### R-ENTRIES-NOT-POINTS — confirm
- **Statement:** Entries count every qualification; points come only from qualifications with a real challenge table; where a row has no points of its own, show none rather than borrow.
- **Why:** at GCSE, headline rows are per subject, so a BTEC/OCR item in the same subject showed the GCSE score as its own.
- **Applies to:** M entries, M points (all columns).
- **Enforced in:** vicdata:ingest/academic_aggregates.py:139-142, 283-288 (entries_total from every TOTAL row; points only when `qualification == points_qual`); vicdata:supabase/migrations/20260915100000_academic_subject_rollup.sql:31,64-65 (avg_point_score, points_coverage_percent); page gate P:499, P:936 (pointsAt/resultsFor return null for non-full-course GCSE items).
- **Test case:** The Chase, GCSE: a BTEC item in a subject that also has GCSE shows no Results figure (no specific figure in docs — TBD).
- **Origin:** Academic Results phase build report; page gate from round 6 (comment P:478-482).
- **Status:** active. **Must lift (page part):** move `pointsAt`/`resultsFor` into a new `src/lib/teacher-view-measures.ts` (`subjectPointsAt(item, period, rows, phase)`). No figure change.

### R-POINTS-SAME-QUAL — confirm, with a live **conflict**
- **Statement:** A points figure is only comparable within one qualification type (KS4: qualification type; KS5: bucket/exact qual).
- **Enforced in:** `comparabilityKey` teacher-view-catalogue.ts:124-127 (map chips, colours); exact-qual England (dashboard route:56-72); Column 1 qualification-family match (see R-QUAL-FAMILY-MATCH).
- **Conflict (flag for Guy):** Context at Post-16 on points **blends qualifications**: `groupValueFor` (P:1207-1216) combines every non-AS qualification row of a subject (A level + BTEC + IB) into one weighted mean, and "All subjects" mode has no family filter (P:1265, P:1361-1369), so A-level and BTEC points share one bar chart and one group average. Part D report items 3 (130432 CS 13.1→7.0) acknowledges the weighting, not the cross-scale blend.
- **Test case:** 130432, Post-16, Context "All subjects", Average point score: Computer Science 7.0 (Part D report :57) — confirm whether intended.
- **Origin:** Academic Results phase; Post-16 Part C/D.
- **Status:** active but partially violated. **Must lift** into lib with the population functions (R-QUAL-FAMILY-MATCH). Fixing the blend **would change figures → STOP item**.

### R-KS4-POINTS-GCSE-FULL — confirm
- **Statement:** KS4 points come only from `GCSE (9-1) Full Course` with a clean single grade code.
- **Enforced in:** vicdata:ingest/academic_aggregates.py:139-140, 285 (`grade in points_table` = single grades only); rollup view comment vicdata migration 20260915100000:31; page P:499, 936; geography applicability P:1729, 1857. Constant `POINTS_BEARING_QUALIFICATION` lives in a **component**: `src/components/data-view/SubjectAreaSection.tsx:151-155`, imported by P:34.
- **Test case:** TBD (any GCSE school with GCSE + Cambridge National in one subject).
- **Status:** active. **Must lift (constant + page gate):** move the constant to `src/lib/dfe-qualification-buckets.ts`; gates into `teacher-view-measures.ts`. No figure change.

### R-KS5-ASAEA-EXCL — confirm
- **Statement:** AS level and AEA are left out of comparison lists, group totals and averages at Post-16, never out of the focused item's own figure.
- **Enforced in (all UI):** `isAsLevelOrAea` (lib, dfe-qualification-buckets.ts:138-141) applied in P:1055 (comparablePeer), P:1075 (category), P:1190-1191 (groupRows/inGroup), P:1228 (threshold group), P:1249-1253 (asOrAeaOnly), P:1265, P:1277, P:1282, P:1331 (band share), P:1367 (contextItems), P:1837 (schoolSubjects). Ingest buckets: AEA unscored (dfe-qualification-buckets.ts:231-232).
- **Test case:** 102239, Post-16, Context All subjects entries: group total 591 (was 2,480); 100369 group total 471 (Part D report :45-46, :71).
- **Open (self-inclusion):** an AS-only focus is not added to its own group (P:1277 requires `!asOrAeaOnly`), so its share/benchmark is against a group it is not in — the Part D follow-up.
- **Origin:** Post-16 Part C1 (`..._post16_category_context_exclude_as_aea_build_report_v1.md`), Part D.
- **Status:** active. **Must lift:** into `src/lib/teacher-view-populations.ts` (`categoryPeers`, `contextGroupRows`, `contextMembers`, `contextItems`). No figure change if verbatim.

### R-KS5-ENGLAND-EXACT — confirm
- **Statement:** The Post-16 England figure is the exact subject × qualification figure or nothing; no bucket fallback.
- **Enforced in:** `englandAverages` src/app/api/teacher/dashboard/route.ts:56-72 (exact lookup only); keying P:521-529; geography route subject-geography/route.ts:61-64 (exact qual at ks5).
- **Test case:** 100369, 2024/25, IB HL Chemistry own 58.29, England HL 43.13, SL 37.84 (Part D report :65).
- **Origin:** Post-16 Part C, Part D. **Status:** active. Route-level → **not must lift** (lift `englandValue` lookup P:521-538 into lib for reuse; no figure change).

### R-MIN-SCHOOLS — correct
- **Statement (corrected):** An LA/region benchmark row is suppressed below 5 schools. **England is exempt (min 1) for points/entries geography and the England anchor, but NOT for grade-grain geography** (every grade row needs 5 schools, England included).
- **Enforced in:** vicdata:supabase/migrations/20260926140000_subject_geography_lookup_min_school_count.sql:35,66,90,123; vicdata:…20260927121000_academic_subject_grade_geography_aggregate.sql:50,82; callers pass 1 for national: subject-geography/route.ts:59, dashboard/route.ts:66,74; grade geography passes null (src/lib/vicdata-reference.ts:633).
- **Test case:** TBD (an LA with <5 schools offering a subject).
- **Status:** active, RPC-level → not must lift.

### R-SINGLE-BUCKET-100 — confirm, but **not a Teacher-view rule**
- **Statement:** The unfiltered (Type = All) category view shows points only when the category's scoreable entries are 100% one scored bucket; comparator side must agree on the bucket.
- **Enforced in:** `src/components/data-view/SubjectAreaSection.tsx:68-100` (singleScoredBucketFor / agreedScoredBucketFor) — Data View only; no Teacher view code path uses it.
- **Test case:** TBD. **Status:** active (Data View). **Must lift** only when Data View category measures are registered → `src/lib/academic-data-view.ts`. No figure change.

### R-IB-NONSUBJECT — confirm
- **Statement:** Baccalaureate (Diploma total, Combined Certificate) and IB Core rows are excluded from subject entries; IB Core components are included in IB bucket points; the Diploma total is never scored.
- **Enforced in:** vicdata:ingest/academic_aggregates.py:103-135 (`_NON_SUBJECT_ROWS`), :270 (skip), :446-455 (points kept); TS twin `src/lib/dfe-qualification-buckets.ts:246-262`.
- **Test case:** 100369: including the Diploma total pushed IB average to 60.2 > HL max 60 (dfe-qualification-buckets.ts:256-262).
- **Status:** active, ingest-level → not must lift.

### R-FOCUS-NEVER-FILTERED — confirm
- **Statement:** The focused item (subject, or the school itself in Comparisons) is never filtered out of its own figures, only out of comparison lists.
- **Enforced in:** P:1068-1070 (focus first), P:1141, P:1381 (`r.key === focusKey ||`), P:1362, P:1837; XP:254 (`s.isTarget ||`), XP:276; lib teacher-view-comparator-series.ts:143 (target never dropped), :186 (target kept in fixed sets, flagged `igcseExcluded`).
- **Test case:** Focus AS Psychology at a Post-16 school: own panels still render (AS/AEA report :19,38).
- **Status:** active. **Must lift (P and XP parts)** into teacher-view-populations.ts and a new `comparisonSchools()` in teacher-view-comparator-series.ts. No figure change.

### R-TREND-3YR — **superseded** by R-TREND-LINE-4YR
- **R-TREND-LINE-4YR statement:** A trend is drawn as a line only with ≥4 real years; below that: per-year bars (TrendChart), a ranked change-in-units list (MultiTrend), or the table alone (Comparisons Trend); Actual and Trend-line toggles disable.
- **Enforced in:** TVP:311-315 (`TREND_LINE_MIN_YEARS`, `trendChartKind`), SV:48-49, SV:76-90, TrendChart.tsx:185; panel switches XP:614-616, 649 (table only), CP:284,292, SP:789,798.
- **Test case:** Results on Grade 4+ (2 years: 2023/24–2024/25) → MultiTrend shows the pp change list (TVP:307-310 comment).
- **Origin:** Round 7 §4. **Status:** active. Rule lives in lib; panel switches are renderer shape requirements → not must lift. Retire legacy `TREND_MIN_YEARS = 3` (teacher-view-catalogue.ts:24, meetings only) or document it.

### R-ZERO-CANDIDATE — correct
- **Statement:** A school with a stage row but no real candidate count and no real headline measure is not "present" for that stage; special schools are matched only with special schools (and vice versa) in nearest/comparator pools.
- **Enforced in:** `stagesPresent` src/lib/academic-data-view.ts:174-190 — used by Data View and dashboard card (AcademicDataView.tsx:356,463; academic-comparator-widen route:76), **not** by Teacher view comparator sets; is_special: supabase/migrations/20260930120000_nearest_schools_special_and_through_school.sql, 20261001120000_comparator_candidates_special_schools.sql:50-67.
- **Teacher view equivalent:** comparators with no figure for the measure are dropped (R-COMPARATOR-NO-FIGURE). A zero-candidate comparator with a 0-valued `entriesSeries` point is not excluded in Teacher Comparisons — gap, TBD whether it occurs.
- **Test case:** Ark Soane (candidates = 0) drops out of every Data View list; Harmood (special) 29/30 special comparators, Haverstock 0/30 (special_schools_zero_candidate report :24,34-35).
- **Status:** active (Data View + RPC). Not must lift; consider applying `stagesPresent` in `rankFixedSets`.

### R-POINTS-WEIGHTED — confirm (UI)
- **Statement:** A subject's points across several qualifications are weighted by points-eligible entries, not flat-averaged.
- **Enforced in:** P:1207-1216 (Context group, KS5); rollups weight by points-eligible entries in ingest (vicdata:ingest/academic_aggregates.py:285-288).
- **Test case:** 130432, Post-16: Computer Science 13.1 → 7.0, Chemistry 29.7 → 24.3 (Part D report :57).
- **Status:** active. **Must lift** `groupValueFor` into `teacher-view-measures.ts`. No figure change. (See R-POINTS-SAME-QUAL conflict.)

### New rules found

| ID | Statement | Enforced in | Must lift? → target | Test case | Origin |
|---|---|---|---|---|---|
| R-DONUT-COUNTS-ONLY | Share (donut) only for counts (entries) and for grade bands once a range is picked; never for averages or rates. | P:1956; SP:297 (fallback to bar), SP:525-534 (disabled); ShareDonut.tsx:10 comment | **Yes** → dataview capability (`numberType: market_share` only on count measures) + measure card | Context, Results on points: donut button disabled | Round 6 §4.2 |
| R-NO-GRADE-RATE-GEO | No LA/region/England benchmark for Grade 4+/A*–E rate; geography comparison is points-only (entries for Candidates). | P:1136 (no benchmark on rates), P:1153 (no England category line), P:1727-1734 (applies), P:1786 (benchmarkLabel undefined) | **Yes** → measure card `geographies` + `teacher-view-measures.ts` | Results → Grade 4+ → Area chart shows "published for average point score only" note | comparisons/grade4 wiring round |
| R-BANDS-ENGLAND-BENCH | On Grade bands the focused subject's benchmark is England's rate on the same span, from grade geography; peers carry none. | SP:282-292 (component) | **Yes** → `src/lib/teacher-view-grade-geography.ts` (`englandBandRateAt`) | The Chase GCSE History 2024 7–9: 34.1% vs England 26.6%; 4–9: 75.8% vs 64.6% (grade bands report :60) | Grade bands frontend round |
| R-GRADE-SCALE-MATCH | A rate is computed only on the scale it was defined on (threshold: GCSE 9-1/Double Award at KS4, A-level A*–E at KS5; bands: the scale the range was picked on). Vocational/IB/Pre-U get no figure. | SG:155-180, SG:232-241, presets SG:201-205 | No (lib) | IB 7-1 row at KS5 not scored against grade 4 (SG:164-168) | Round 6 §6.5; grade bands |
| R-NON-GRADES-EXCL | Suppressed / No result / X / Covid impacted etc. excluded from both sides of every grade rate and distribution. | SG:84, 156, 233; GP:56,86; SP:456-457 | No | TBD | Round 6 §6.5 |
| R-THRESHOLD-PERIODS | Grade-based measures cover 2023/24 on; axis shortened, never padded. | P:1112-1116, P:1315-1320 | **Yes** → teacher-view-measures.ts `periodsFor(measure)` | Results on Grade 4+ shows 2 years | Round 6 §6.5 |
| R-QUAL-FAMILY-MATCH | Column 1's category and Context's Selected set contain only the focus's qualification family (KS5 display bucket). Not applied to "All subjects". | P:1063-1065, 1076, 1261-1263, 1272, 1277, 1282 | **Yes** → teacher-view-populations.ts | The Chase, A-level Maths focus: 5 bars, Core Maths absent (qualification-match report :29) | Col1 qualification match round; combined round §4c |
| R-KS4-SUBJECT-DEDUP | At GCSE, one category row per subject (rows are per subject); at Post-16 none. | P:1096-1099, P:1839 | **Yes** → populations | TBD | Trend redesign step 1 |
| R-SELF-INCLUSIVE-GROUP | Group totals/averages include the focused subject. | P:1152, P:1270-1285 (esp. 1277), CP:157-160 | **Yes** → populations | Snagging round 1 Part 1: share could pass 100% before fix | Round 6 §4.2; snagging 1 Part 1 |
| R-SAME-YEAR-BENCH | A benchmark is read for the same year as the figure, or not at all. | P:531-538, P:963; SP:342 | **Yes** → teacher-view-measures.ts | TBD | Design brief §6/§14 |
| R-PREV-YEAR-FALLBACK | With no benchmark, the delta is against the subject's own previous published year ("vs last year"). | SP:326-345, SP:643 | **Yes** → lib helper `deltaAgainst()` in TVP | Results on Grade 4+ table: "vs last year" | Round 6 |
| R-MEASURE-FALLBACK | Context falls back to points when Results is on Grade counts or bands without a range; Comparisons falls back to points (chip) / headline (no chip). | P:1174-1175, P:1436-1443 | **Yes** → measure resolution in teacher-view-measures.ts (`measureForColumn`) | Results → Grade counts: Context shows APS with note | Grade bands frontend round |
| R-GEO-APPLIES | Geography comparison only where the area figure counts the same thing: KS4 GCSE full course only; Results points only. | P:1727-1734, P:1857 | **Yes** → teacher-view-geography.ts `geographyApplies()` | GCSE BTEC focus → not-applicable note | Candidates live review Part 5; Part C |
| R-GEO-POINTS-ELIGIBLE | The school's own row beside area entries is its points-eligible entries (entries × coverage), not its Candidates count. | P:1859-1862; caveat CP:370-371 | **Yes** → teacher-view-geography.ts | TBD | Candidates live review Part 5 |
| R-IGCSE-EXCL | At GCSE a comparator flagged by `igcseExclusionLikely` is dropped from every set; the target is kept but flagged and its results history withheld. | lib teacher-view-comparator-series.ts:130, 143, 159, 175, 186, 199; map RankingsMap.tsx:90 | No | Malvern College / Malvern St James absent (unconfirmed, content round report :152) | Commit 514e285; content round S4 |
| R-COMPARATOR-NO-FIGURE | A comparator with no figure for the measure (or none in the latest year) is not listed; never ranked last. Not applied while loading. | XP:254, XP:274-277; `rankByValue` TVP:325-333 | **Yes (XP part)** → teacher-view-comparator-series.ts `comparisonSchools()` | Post-16, a school not offering the focus subject disappears (content round S4) | Content round S4; round 7 §9 |
| R-COMPARATOR-RATE-PER-QUAL | Comparator rates scored per subject AND exact qualification, with the page's own rate function. | XP:199-207, P:2043-2053 | **Yes** → teacher-view-comparator-grades.ts `rateSeriesByUrn()` | Maths (General) +5pp (grade4 wiring report :35) | Comparisons grade 4 wiring |
| R-RANKING-SAMPLE | A national/regional ranking set is a sample: no map/change maps; rank and average come from the whole population on the ranking's own (headline) measure. | XP:213, 287-297, 494-506, 615, 713; lib chooser-sets.ts:46-61 | **Yes (XP part)** → chooser-sets.ts | TBD | Snagging round 1 Part 4 |
| R-PERIOD-TRIM | Leading/trailing periods with no published value are trimmed (2020/21 APS is null nationally). | TVP:269-278 | No | Any Results trend starts 2021/22 | Round 7 §7 |
| R-INDEX-HEADCOUNTS | Only sum measures (entries) are indexed to 100; points and rates are drawn at real levels. | trend-styles.ts:102-104; SV:92; GC:159 | No (renderer/measure) | — | Trend redesign |
| R-RANK-TIES | Ties share a rank; next rank skips; null = unranked. | TVP:325-333 | No | — | Round 7 §9 |
| R-TREND-FLAT-4PCT | A trend is "Broadly stable" within ±4%. | TVP:353-360 | No | — | Wireframe |
| R-NUMBER-TYPE-HONESTY (gap) | Catalogue §3 says % change of an average misleads; **live code shows % change on points/rates** in Context and Comparisons change lists/tables and summaries (SP:910-916, 993-1000; XP:703-711, 762-765), and pp-bars only in the <4yr MultiTrend fallback. | — | Decision for Guy: Results change views should be Change in points / pp (S4 Numbers options); changing it changes displayed figures → STOP unless decided | — | Catalogue doc §3 |

---

## 3. Placement mismatches (combinations doc §2 matching rule)

Column declarations assumed from combinations doc table A: Col 1 = my subject, **no comparison**; Col 2 = in-school group; Col 3 = school set.

| # | Panel / views | Declared column compare | Actual compare | Notes |
|---|---|---|---|---|
| F2 (confirmed) | Col 1 Trends, % change half: Area chart + Change table (GeographyView) — **both modes, both phases** | none | geography LA / region / England | CP:352-392, SP:946-958, wired P:1720-1737, 1850-1865. Larger than F2 assumed: it is the *only* % change content in Col 1 (§0.5). Seed as marked override (A4). |
| M1 | Col 1 Current tiles (Candidates): "rank in category", "rank of N subjects at school" | none | subjects-in-school (category, whole school) | CP:197-208 |
| M2 | Col 1 Trends (both modes): every category peer its own line / row / table | none | subjects-in-school (category) | CP:161-173, SP:698-706. Col 1 is de facto a fixed "category" compare; under the subset rule Col 1 Trends would offer nothing as declared. Recommend declaring Col 1 compare = `subjects-in-school:category (fixed)` — which then duplicates Context's default ("category", P:1359-1360 uses Column 1's own list). |
| M3 | Col 1 Results Current: England average tile + gap tile; bar marker "National average"; table "vs National" | none | geography England (average) | SP:434-450, 615, 643 |
| M4 | Col 1 Results Trends: Map ("{subject} at each comparator school") | none | school set | SP:823-847, P:1743-1756 |
| M5 | Col 1 Grade counts Current: England share ticks; Grade bands Grades view + tiles: England rate & gap | none | geography England | GP:97-106, SP:415-427, 546-558 |
| M6 | Col 2 Context on Results → Grade counts / bands-without-range: shows points | column measure = dashboard sub-measure | points (override) | P:1174-1175. Registry needs per-column measure resolution, not one dashboard measure. |
| M7 | Col 3 with no subject chip on Results: whole-school headline (Attainment 8) | focus = subject (follows chips) | focus = school | P:1437-1443. Focus mode silently switches. Ranking-set tiles are always headline (XP:349-369). |
| M8 | Col 3 Trends chart "vs Average across set" / ranking-set population average | school set | set + set-average (averages kind) | XP:499-506. Fine if "set" implies its own average; declare explicitly. |
| M9 | Col 2 Context "All subjects" crosses qualification families (and points scales at Post-16) | in-school, same qualification | in-school, any qualification | P:1361-1369 — see R-POINTS-SAME-QUAL conflict. |

---

## 4. Titles (every template and fallback)

Shared components: `ViewTitle` (SV:130-132, styled p), `TrendScaleTitle` (SV:116-124):
- indexed: `Change since {first year | "the first year shown"}: each line starts at 100 (no change); 110 = 10% more {noun}, 90 = 10% fewer.`
- actual: `{Noun} each year, real numbers: one scale for every subject, so small ones sit low.`
- `noun` is always `"entries"` at every call site (CP:310, SP:868, GC:159).

| Location | Template | Fallback / condition |
|---|---|---|
| CP:236 Current | `{focused.label} {currentLabel ?? "Candidates"}: {year}` | only if focus & latest |
| CP:270 | `inCategory = "Entries in {categoryLabel}"` | null when no group (≤1 subject or no groupLabel) |
| CP:301 Trend table | `{inCategory}, year by year` | `{focused.label ?? "Entries"}, year by year` |
| CP:308-310 Trend charts | `{inCategory}` + TrendScaleTitle | TrendScaleTitle only if line |
| CP:398 (dead) | `{inCategory}: {since} against the latest year, with the change` | `Entries by year, since {since}` |
| CP:408 (dead) | `{inCategory}: % change since {since}, ranked` | `Entries: % change since {since}` |
| GC:91 | `{label} against the wider system` (plain p) | also over notes |
| SP:492-501 Context Current | donut: `Entries in {subject ?? "this subject"} as a proportion of {phrase}`; bands donut: `Entries at {range lower} as a proportion of graded entries in {phrase}`; bar/list/table: `{Entries|Results} by subject in {phrase}` | null without `compareAgainstLabel` (Results); phrase = category label \| "your selected subjects" \| "all subjects" (P:1293-1294) — note it falls back to `"its subject category"` |
| SP:1041-1054 Results Current wrapper | `{Entries|Results} in {categoryLabel}` (plain p, not ViewTitle) | only if categoryLabel & >1 subject & view ∉ {tiles, grades} |
| SP:765-772 scope | `{Entries|Results} in {categoryLabel}` (Results) / `{…} in {benchmarkLabel lower}` (Context, unless "National") | null if ≤1 subject |
| SP:820 (classic, unused) | `{scope}, year by year` | — |
| SP:833 Map | `{subjectLabel} at each comparator school, on the map` | — |
| SP:852 Trend table | `{scope}, year by year` | `{focus label ?? scopeNoun}, year by year` |
| SP:866 Trend chart | indexed: `{scope}`; else `{scope}: each subject's line` | no scope & not indexed: `{focus label ?? scopeNoun}, each year`; no scope & indexed: TrendScaleTitle only |
| SP:943 (classic, unused) | `{scope}: % change since {since}` | `% change since {since}` |
| SP:961-963 Change table | `{scope}: {since} against the latest year, ranked by change` | `{scopeNoun} by year, since {since}` |
| SP:978 Change list | `{scope}: % change since {since}, ranked` | `{scopeNoun}: % change since {since}` |
| XP:316-328 Current | tiles(ranking): `{target}'s rank in the {set lower}: {measureName}`; map: `{titleOn} by school, on the map`; graph: `{Entries|Results} by school in the {set lower}` or (ranking measure) `{titleOn}: {target} against the {set lower}'s average`; ranking: `Schools ranked by {titleOn} in the {set lower}` | titleOn = `{subject} {entries | measure label lower}` or headline label |
| XP:663 | `Change in {comparedOn} since {trendFrom}, coloured by school` | trendFrom fallback `the first year` (XP:621) |
| XP:675 | `Every school in the {set lower}: {comparedOn}, year by year` | — |
| XP:682 | `This school's {comparedOn} against {versusLabel, first letter lower}, year by year` | versusLabel: school name \| `Average across this set ({n} schools)` \| `Average of the schools shown` \| `Average across {set lower}` (XP:492-498) |
| XP:737 | `% change in {comparedOn} since {since}, coloured by school` | — |
| XP:742 | `Every school in the {set lower}: {since} against the latest year, ranked by change` | — |
| XP:751 | `% change in {comparedOn} since {since}, ranked against the {set lower}` | — |
| XP:812 | `{subject} against comparator schools` (plain p, unavailable note) | — |
| GP:113 tag | `Grade counts {year}` — **not "Current", no "Data {year}"**; inconsistent with every other Current tag | — |
| GP:150 | `{subject}'s spread of grades: {year} against {cmpYear}, grade by grade` | — |
| GP:189-191 | `{subject}'s entries at each grade: {chgYear} against {year}, with the change` | — |
| Tags (all) | Current: `Current` + `Data {year}` (DataDate, ColumnPanels.tsx:157-163); Context: year menu inside DataDate (SP:514-520); Trends: `Trends` + `From {year} ▾`; afterTag follows the half on screen | — |
| Column headers | P:1513-1532 `How many {pupils|students} at {school} are entered for {subj} {qual}?` etc.; fallback PHASE_QUESTIONS (`teacher-view-phases.ts:45`) | — |

Note "provisional" wordings (Context bar/list/table, all four Comparisons Current titles) are flagged provisional in code comments (SP:489-491, XP:312).

---

# Part B — Measures, fetch map, performance

Read-only audit, 3 Oct 2026, branch `v0.6` at 5597757. Repo paths are relative to `/Users/guy/dev/vicdata_public` unless prefixed `vicdata/` (= `/Users/guy/dev/vicdata`, the ingest repo).

## 0. Grounding facts the briefs don't state (verified)

1. **The measure data does not live in the 0.6 Supabase project.** Every academic, census (rolls) and births figure lives in **vicdata-production (`hrqrbvrrhlidpoybezhs`)**. It is read over HTTP with the anon key through `src/lib/vicdata-reference.ts` (`fetchPage`, :27–55; env `VICDATA_API_URL` / `VICDATA_ANON_KEY`). The 0.6 project, **vicdata-public (`lnhulykjlxmoneappnsp`)**, holds only `schools`, memberships, prefs/notes, `school_nearest_neighbours` (6.9M rows), `school_region_nation`, the roll precomputes (`roll_aggregates`, `school_current_snapshot`, `age_profile_aggregates`, `census_age_gender_cache`, `sixth_form_sector_aggregates`), boundaries and saved sets. A "one batched fetch per dashboard" therefore crosses two databases. Any new RPC for academic measures has to be written in the vicdata repo (`vicdata/supabase/migrations`, 99 files), not in `supabase/migrations` here (68 files).
2. **`entity_keying` exists**, as a column of `source_registry` in vicdata-production (`vicdata/supabase/migrations/20260719093341_initial_schema.sql:41`, check `in ('geography','urn')`; live, `postcode` also occurs). Live values:
   - `urn`: every `dfe_ks*`, `dfe_school_census`, `dfe_fe_participation*`, `dfe_tlevel_results`, `gias*`, `isc_schools_list`.
   - `geography`: `ons_births`, `ons_population`, `ons_population_projections`, `isc_country_recruitment`, `ons_la_hierarchy_crosswalk`.
   - `postcode`: `postcode_geography`.

   Nothing in `src/` reads `entity_keying`. It is only mentioned in docs (`docs/v0.6/vicdata_0_6_add_a_view_combinations_v1.md:85`, `docs/vicdata_data_view_open_questions.md:559`).
3. **Briefing docs.** Only `docs/vicdata_briefing_ks2_what_is_measured_v1.md` is in this repo. The GCSE and Post-16 briefings are in the ingest repo: `vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md` and `vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md` (v1s in `vicdata/docs/archive/`). There is **no briefing doc for Rolls or Live births**.
4. **Period convention.** `period` N means academic year N/N+1 (`academicYearLabel`, `src/lib/teacher-view-theme.ts:117`). Census period 2025 is the Jan 2025 census (`CURRENT_CENSUS_PERIOD`, `src/lib/roll-data.ts:16`).
5. **Several "rules" are enforced upstream in the ingest repo**, not in this app:
   - GCSE / A-level points tables: `vicdata/ingest/academic_aggregates.py:93,100,139–142`.
   - IB non-subject rows: `_NON_SUBJECT_ROWS`, `academic_aggregates.py:108–128,446`.
   - The minimum-school-count default of 5 lives inside the geography RPCs (`vicdata/supabase/migrations/20260926140000_subject_geography_lookup_min_school_count.sql:35,90`; `20260927121000_academic_subject_grade_geography_aggregate.sql:50,82`).

   The rest live in `src/app/teacher/[phase]/page.tsx`, the presentation layer:
   - AS/AEA exclusion: :1055, :1190–1191, :1252.
   - IGCSE omit: `teacher-view-comparator-series.ts:130,159`.
   - `TREND_MIN_YEARS = 3`: `teacher-view-catalogue.ts:24`.

## 1. Measure cards

Live years come from SELECTs on vicdata-production (`academic_*_rollup`, `*_geography_aggregate`, `academic_headline_snapshot`, distinct periods in `canonical_facts_current`) and on vicdata-public `roll_aggregates`.

Common facts for every academic card below:
- **School-level reads go through two different paths:**
  - (a) Raw DfE facts via `reference_data_lookup`: `fetchSubjectLevelDataForSchools`, `src/lib/academic-data-view.ts:1193`, parsers :1100–1144. These cover **modern sources only, 2023/24–2024/25**.
  - (b) Ingest rollups via `academic_subject_headline_lookup` / `academic_subject_qualification_headline_lookup`: `fetchSubjectHeadlineForSchools` :1258 and `fetchSubjectQualificationHeadlineForSchools` :1296. These cover **2020/21–2024/25**.
- **No measure has a single "fetched by" function today.** The same number is reached through 3–5 routes (see the "Fetched by" rows).
- **Source registry ids:**
  - KS4: `dfe_ks4_subject_entries` (2023, 2024) and `dfe_ks4_subject_entries_historic` (2020–2022).
  - KS5: `dfe_ks5_subject_results` (2023, 2024), `dfe_ks5_subject_results_historic` (2020–2022), `dfe_tlevel_results` (2023, 2024) and `dfe_ks5_subject_value_added` (2023, 2024).
  - Headlines: `dfe_ks4_headline[_historic]` and `dfe_ks5_headline[_historic]`.
  - All have `entity_keying = urn`.

### M-KS4-ENTRIES — "GCSE candidates"
| Field | Content |
|---|---|
| Definition | Exam entries per subject (every qualification type, the DfE "Total" row), per school and year |
| Grain | Raw: school × subject × qualification type × year. Rollup: school × subject × year, with qualifications summed at KS4 (page.tsx:1090–1098 depends on this) |
| Years | Rollup entries 2020/21–2024/25 (5). Subject list/items: **latest year only**, from raw facts (`buildSubjectItems`, page.tsx:92–115). Whole-cohort `pupil_count` headline 2022/23–2024/25 (`academic_geography_aggregate`) |
| School | ✓ |
| Subject area | ✓ `academic_subject_family_rollup` 2020–2024 and share-of-family fields on the headline rows |
| Set | ✓ `fetchAcademicProfiles(...,{includeSubjects})` → `ks4Subjects.entriesTotal` (academic-data-view.ts:860, :892) |
| LA / region / England | **Partial.** Only *points-eligible* (GCSE 9-1 Full Course) entries, from `academic_subject_geography_aggregate.entries_total`, 2021/22–2024/25, min 5 schools (national 1) (`api/teacher/subject-geography/route.ts:39–52`, comment `src/lib/teacher-view-geography.ts:5–8`). All-qualification entries by area: ✗, no aggregate exists |
| Honest number types | Totals, % change, share (of school, category or set), Indexed |
| Rules | R-ENTRIES-NOT-POINTS (ingest) · R-IB-NONSUBJECT (ingest; n/a at KS4) · R-TREND-3YR (`teacher-view-catalogue.ts:24,261`) · IGCSE omit in sets (`teacher-view-comparator-series.ts:130–145`; a candidate new rule, `R-KS4-IGCSE-OMIT`) |
| Fetched by | (1) `/api/teacher/dashboard` → `fetchSubjectLevelDataForSchools` (route.ts:169) and `fetchSubjectHeadlineForSchools` (route.ts:172). (2) `/api/data-view/academic-schools` → `fetchAcademicProfiles` (route.ts:51). (3) `/api/teacher/subject-geography`. (4) The `seriesByUrn.candidates` series from `entriesSeries` (academic-data-view.ts:331, headline `pupil_count`) in dashboard, chooser-set and saved-sets |
| Gaps | Item list (raw, latest year) and trend (rollup) come from different tables. No all-qualification area benchmark |
| Briefing | `vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md` |

### M-KS4-POINTS — "GCSE average points" (UI today: "Average point score")
| Field | Content |
|---|---|
| Definition | Points per points-eligible entry, GCSE (9-1) Full Course only, on the 9–1 table (`vicdata/ingest/academic_aggregates.py:93,139–140`) |
| Grain | School × subject × year (`points_weighted_sum / points_eligible_entries`) |
| Years | **2021/22–2024/25** (4). The 2020/21 rollup rows have 0 points-eligible entries (teacher-assessed year) |
| School | ✓ |
| Subject area | ✓ |
| Set | ✓ (profiles `ks4Subjects.avgPointScore`) |
| LA / region / England | ✓ `academic_subject_geography_aggregate` 2021–2024 via `lookupAcademicSubjectGeography` (vicdata-reference.ts:497). LA/region need ≥5 schools; England uses minSchoolCount 1 (dashboard/route.ts:72) |
| Honest number types | Points, Change in points. **Code today offers "% change in average point score"** (`src/lib/teacher-view-panels.ts:112–121`), which §3 says should not be offered |
| Rules | R-KS4-POINTS-GCSE-FULL (ingest; `POINTS_BEARING_QUALIFICATION` SubjectAreaSection.tsx:151) · R-POINTS-WEIGHTED (ingest) · R-MIN-SCHOOLS (RPC default 5) · R-TREND-3YR |
| Fetched by | `/api/teacher/dashboard` (`fetchSubjectHeadlineForSchools`, route.ts:172; England `englandAverages`, route.ts:46–74) · `/api/teacher/subject-geography` (route.ts:39–52) · `/api/data-view/academic-schools` |
| Gaps | Rename to "Average points" still pending (catalogue §3) |
| Briefing | GCSE v2 (as above) |

### M-KS4-HEADLINE — "Attainment 8" (whole school; the Comparisons column's measure)
| Field | Content |
|---|---|
| Definition | DfE Attainment 8 average (`HEADLINE_MEASURE.ks4 = attainment8_average`, academic-data-view.ts:231) |
| Grain | School × year |
| Years | 2021/22–2024/25 (`academic_headline_snapshot`) |
| School | ✓ |
| Set | ✓ (`rankSets` / `rankFixedSets`) |
| LA / region / England | ✓ `academic_geography_aggregate` (`attainment8_average` 2021–2024) via `lookupAcademicGeography` (vicdata-reference.ts:643). Not used by Teacher view |
| Subject area | n/a |
| Honest number types | Points, Change in points |
| Rules | IGCSE omit (`igcseExclusionLikely`, academic-data-view.ts:679) |
| Fetched by | `lookupAcademicHeadline` (vicdata-reference.ts:145) inside `fetchAcademicProfiles` / `fetchLatestCohortSizes` / `resolveRankingSet` (chooser-sets.ts:105) |
| Gaps | Progress 8 stops at 2023/24 (no 2024/25 rows) |
| Briefing | GCSE v2 |

### M-KS4-GRADE4 — "Grade 4+ rate"; M-KS4-BANDS — "Grade bands"; M-KS4-COUNTS — "Grade counts"
| Field | Content |
|---|---|
| Definition | Per-grade entries for a subject × qualification. Grade 4+ = share of graded entries at 9–4 (`thresholdRate`, `src/lib/subject-grades.ts:155`). Bands = share inside a chosen range (`bandRate`, :232). Counts = entries per grade |
| Grain | School × subject × qualification type × grade × year |
| Years | **School: 2023/24–2024/25 only.** Read from raw modern facts (`parseSubjectGradeDistribution`, academic-data-view.ts:1115). Page comment page.tsx:1106–1109. **Yet `academic_subject_grade_rollup` holds 2021/22–2024/25 for 4,864 KS4 schools, and the app never reads it** |
| School | ✓ |
| Subject area | ✓ (computed client-side, page.tsx:1227–1237) |
| Set | ✓ `/api/teacher/comparator-grades` (rate scored per school, ComparisonsPanels.tsx:176–200) |
| LA / region / England | Bands/counts: ✓ `academic_subject_grade_geography_aggregate` 2021–2024 via `/api/teacher/subject-grade-geography` (min 5 schools in RPC). **Grade 4+ rate: ✗ in the UI** (page.tsx:1117–1120 says "no published England figure"), but the same grade geography would give it, since Grade 4+ is the 9–4 band |
| Honest number types | Rate, Change in pp (counts: Totals, change). **Code labels are "% change in grade 4+ rate" / "% change in the share…"** (teacher-view-panels.ts:125,140), although `formatDelta` prints pp |
| Rules | R-MIN-SCHOOLS (RPC) · R-FOCUS-NEVER-FILTERED · scale per qualification (`bestScale`, subject-grades.ts:89) |
| Fetched by | `/api/teacher/dashboard` (`subjectData.gradeDistribution`) · `/api/teacher/comparator-grades` (`fetchSubjectLevelDataForSchools(union)`, route.ts:45; **pulls every subject and grade for the whole set, then filters to one subject**) · `/api/teacher/subject-grade-geography` |
| Gaps | School years are shorter than the area years (2 vs 4). Grade 4+ has no area benchmark wired up, though the data exists |
| Briefing | GCSE v2 |

### M-KS5-ENTRIES — "Post-16 candidates"
| Field | Content |
|---|---|
| Definition | Entries per subject × **exact** qualification type (A level, AS, IB HL/SL, BTEC, T Level…) |
| Grain | School × subject × qualification type × year (`academic_subject_qualification_rollup`, 3,001 schools). Bucket rollup (`academic_subject_rollup.bucket`) for categories |
| Years | 2020/21–2024/25 (rollups) · raw items latest year (2024/25) |
| School | ✓ |
| Subject area | ✓ (bucket/family rows) |
| Set | ✓ (profiles `ks5Subjects` / `ks5SubjectsByBucket`, academic-data-view.ts:885–900) |
| LA / region / England | **Partial.** Only scored qualifications, per subject × exact qualification (`academic_subject_qualification_geography_aggregate`, 2021–2024). VRQ/AEA/Other have no area figure. **No KS5 rows exist in `academic_subject_geography_aggregate`** (subject-only area figures are GCSE-only) |
| Honest number types | Totals, % change, share, Indexed |
| Rules | R-KS5-ASAEA-EXCL (page.tsx:1055,1190–1191,1252) · R-IB-NONSUBJECT. For rollups this is enforced at ingest (`academic_aggregates.py:108–128,446`; `vicdata/supabase/migrations/20260918160000_remove_ib_non_subject_rows.sql`). **No filter on the raw-facts item list** (`parseSubjectEntries`, academic-data-view.ts:1100). It holds today only because 2024/25 raw data has no IB core/Baccalaureate rows: live check, 83 schools have them in 2023/24 and 0 in 2024/25, e.g. Sevenoaks 118952 has 225 "Baccalaureate" entries in 2023/24. So this is fragile · R-FOCUS-NEVER-FILTERED |
| Fetched by | `/api/teacher/dashboard` (route.ts:169,172,176) · `/api/data-view/academic-schools` · `/api/teacher/subject-geography?phase=ks5&qualificationType=` (route.ts:43–45) |
| Gaps | AS/AEA self-inclusion follow-up still open (catalogue §2.1) |
| Briefing | `vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md` |

### M-KS5-POINTS — "Post-16 average points"
| Field | Content |
|---|---|
| Definition | Points per entry on that qualification's own challenge table (A level A*=56…E=16; `academic_aggregates.py:100`), size-weighted (`points_size_units`) |
| Grain | School × subject × exact qualification × year |
| Years | 2021/22–2024/25 |
| School | ✓ |
| Subject area | ✓ (per bucket, never across buckets) |
| Set | ✓ |
| LA / region / England | ✓ per subject × exact qualification, scored qualifications only (min 5; England 1). England marker: exact or none (dashboard/route.ts:46–63, "Part D: no fallback") |
| Honest number types | Points, Change in points (same "% change" label issue, teacher-view-panels.ts:114) |
| Rules | R-POINTS-SAME-QUAL (`comparabilityKey`, teacher-view-catalogue.ts) · R-KS5-ENGLAND-EXACT · R-KS5-ASAEA-EXCL · R-SINGLE-BUCKET-100 · R-POINTS-WEIGHTED · R-IB-NONSUBJECT (points side kept) |
| Fetched by | As M-KS5-ENTRIES, plus `englandAverages` (route.ts:46) |
| Gaps | IB Diploma total ("Diploma total points") is a separate figure (`ibDiplomaHeadline`, academic-data-view.ts:551) |
| Briefing | Post-16 v2 |

### M-KS5-HEADLINE — "A-level points per entry" (whole school; Comparisons)
| Field | Content |
|---|---|
| Definition | `A level::aps_per_entry` (academic-data-view.ts:234) |
| Years | 2021/22–2024/25 |
| School / Set | ✓ / ✓ |
| LA / region / England | ✓ `academic_geography_aggregate` (also per cohort and per `bucket:*`); not used by Teacher view |
| Honest number types | Points, Change in points |
| Fetched by | As M-KS4-HEADLINE |
| Briefing | Post-16 v2 |

### M-KS5-AE-RATE / BANDS / COUNTS — "A*–E rate", "Grade bands", "Grade counts"
Same as the KS4 grade card (KS5 breakdown adds a size segment, academic-data-view.ts:1125–1128). School 2023/24–2024/25 only, against `academic_subject_grade_rollup` with 2021–2024 for 2,893 schools. Area grade figures exist for 2021–2024.

### M-ROLLS — "Rolls" (not in Teacher view; Data View, public school page)
| Field | Content |
|---|---|
| Definition | Census headcount by single age × sex × full/part-time, plus boarders (`src/lib/roll-data.ts:1–3,33`) |
| Source | `dfe_school_census` (`entity_keying = urn`), 26.5M facts |
| Grain | School × age × sex × attendance × census year |
| Years | 2019–2025 census (7) |
| School | ✓ `reference_data_lookup` |
| Set | ✓ Data View `/api/data-view/schools` → `fetchDataViewProfiles` (`src/lib/data-view-profiles.ts:256`) → `fetchCensusFactsBatched` (:112) |
| LA | ✓ two ways: `roll_aggregates` scope `regional`, which in that table **means LA** (`supabase/migrations/20260807112000_roll_aggregates.sql:12–18`; 153 keys, **2025 only**); and the RPC `region_nation_la_rollup` over `school_current_snapshot`, current + anchor years (`src/lib/la-choropleth.ts:71,122`) |
| Region / England | ✓ `roll_aggregates` scopes `ons_region` (9) and `national`, 2019–2025 (`src/lib/aggregate-trends.ts:16–30`); also a `sector` scope |
| Subject area | n/a |
| Honest number types | Totals, % change, share of LA/area, Indexed |
| Rules | Headcount not FTE (roll-data.ts:1–3) · mainstream-only aggregates (RollCard.tsx:86 note) · trend anchor 2019 (`TREND_ANCHOR_PERIOD`, data-view-profiles.ts:145) |
| Fetched by | Many: data-view-profiles.ts:126 · schools/[urn]/page.tsx:271 · surrounding-schools.ts:150,354 · comparator-set-peers/route.ts:60 · paid-trends/route.ts:46 · market-share.ts:37 · aggregate-trends.ts · la-choropleth.ts. Data View page: `src/app/schools/[urn]/data/page.tsx` |
| Gaps | LA rolls are only for the current year in `roll_aggregates`, so there is no LA roll trend table. "regional" means LA, a naming trap. KS2's "Year 6 cohort" (`rollAtAge10`) is the only Teacher-view use (dashboard/route.ts:149–151) |
| Briefing | None |

### M-BIRTHS — "Live births"
| Field | Content |
|---|---|
| Definition | ONS live births, `breakdown = 'total'` |
| Source | `ons_births` (`entity_keying = geography`) |
| Grain | LA/district GSS (E06/E07/E08/E09 only; 296 codes in 2024) × calendar year |
| Years | 1992–2025 in the DB. **The app reads 2021–2025 only** (`BIRTHS_EARLIEST_YEAR` / `LATEST`, `src/lib/population-trend-lookup.ts:89–90`) and returns nothing unless all 5 years exist (:117) |
| School | ✗ area data. "School" can only mean its LA |
| Set / Subject area | ✗ / n/a |
| LA | ✓ Shire counties are summed from districts (`SHIRE_COUNTY_DISTRICT_GSS_CODES`, :99) |
| Region / England | **✗ no rows** (would have to be summed from LAs) |
| Honest number types | Totals, % change, Indexed. Not share |
| Fetched by | `lookupBirthsTrend` (population-trend-lookup.ts:92) on the public school page only (`src/app/schools/[urn]/page.tsx:538` → `PopulationTrendSection` → `BirthsChart`, `src/components/dashboard/PopulationTrendSection.tsx:154`), plus a single birth-year read in `market-share.ts:68` |
| Gaps | **Births are not in the Data View or Teacher view at all**, contrary to the task framing |
| Briefing | None |

## 2. Fetch map — Teacher dashboards (`/teacher/[phase]`)

`src/app/teacher/[phase]/page.tsx` is a **client component** (`"use client"`, :1). **Nothing is fetched server-side at render.** Every API route below is a Next route handler that re-checks membership with the caller's bearer token (one extra PostgREST query each; saved-sets also calls `auth.getUser`).

| # | When | Call | Where | What it does upstream |
|---|---|---|---|---|
| 1 | Mount | `school_memberships` select (browser → vicdata-public) | page.tsx:225 | — |
| 2 | After 1 | `GET /api/teacher/dashboard` | page.tsx:235 → `src/app/api/teacher/dashboard/route.ts` | neighbours (:113) → `fetchLatestCohortSizes` (:128) → `rankSets` (:145; **builds 4 mothballed preset sets the page no longer reads**, :130–137; only `nearest` → `neighbours` and `seriesByUrn` are used) → `fetchSubjectLevelDataForSchools([urn])` (:169) → `fetchSubjectHeadlineForSchools` (:172) → KS5 `fetchSubjectQualificationHeadlineForSchools` (:176) → `englandAverages` (:177). All **sequential** on purpose (statement-timeout note, :29–32) |
| 3–6 | After 2, sequential | `fetchOnboardedPhases`, `fetchPreferences`, `fetchNotes`, `markPeriodSeen` (auth.getUser + **an upsert on every load**) | page.tsx:253,256,259,265; `src/lib/teacher-view-data.ts:22,52,197,373` | — |
| 7 | Once onboarded | `GET /api/teacher/saved-comparator-sets` | page.tsx:346–355 → `src/lib/teacher-view-saved-sets.ts:50` | `rankFixedSets` (**fetches the target's full profile even with zero saved sets**) plus neighbours again |
| 8 | Once prefs are known | `POST /api/teacher/chooser-set` `{kind:"nearest"}` | page.tsx:304–339 | `resolveDefaultNearest` (chooser-sets.ts:69) → `buildDefaultComparatorLists` (≈15 census and school queries) → `rankFixedSets` → `fetchAcademicProfiles(target+10)` |
| 9 | After 8 (needs its URNs) | `GET /api/data-view/academic-schools?includeSubjects=1` | page.tsx:357–377 | `fetchAcademicProfiles(union, {includeSubjects})`. **`includePopulation` defaults to true, so it also pulls 6 pages of census facts** that the Teacher map doesn't need (academic-data-view.ts:863,875) |
| 10 | Per panel, per focus | `GET /api/teacher/subject-geography` | `useSubjectGeography`, `src/components/teacher/GeographyComparison.tsx:45`; used by CandidatesPanels.tsx:120 **and** SubjectPanels.tsx:280 | schools + region resolve + 3 sequential lookups |
| 11 | Results on bands/counts | `GET /api/teacher/subject-grade-geography` | `src/lib/teacher-view-grade-geography.ts:30`; SubjectPanels.tsx:282, GradeCountsPanels.tsx:83 | Same shape |
| 12 | Comparisons on threshold/bands | `GET /api/teacher/comparator-grades` | ComparisonsPanels.tsx:187 via `src/lib/teacher-view-comparator-grades.ts:22` | Full subject data for the set |

**Per-dashboard vs per-panel.** Calls 1–9 run per dashboard. Calls 10–12 run per panel and are keyed by focus subject. Column 1 renders exactly one of Candidates / Subject / GradeCounts panels (page.tsx:1674–1867), and each hook's cache lives in component state. **So toggling Candidates ⇄ Results, or switching measure, unmounts the panel and refetches the same subject-geography payload.** No cross-component cache exists (no SWR/React Query).

**Duplicates measured at one GCSE load** (urn 100053, upstream RPCs):
- Target profile fetched **4×**: dashboard `rankSets`, saved-sets, chooser-set, academic-schools.
- `academic_headline_lookup` for the same 11 URNs 4×.
- `academic_subject_family_lookup` 4×.
- `school_nearest_neighbours` 3×.
- `schools` row for the target ≥6×.
- `school_region_nation` 3×.
- `academic_subject_family_map_lookup` 2×.
- Census `ids=11` 6 pages that are never used.

`fetchAcademicProfiles` always pulls KS2 attainment, KS5 qualification flags and **both** KS4 and KS5 headline/family data regardless of phase (academic-data-view.ts:866–876). `/teacher/meetings` re-calls `/api/teacher/dashboard` itself (meetings/page.tsx:207).

## 3. Performance baseline

**Method.** The app is gated, so I wrote `perf.ts` (in the scratchpad; not in the repo). It runs under `npx tsx --env-file=.env`, imports the repo's own lib modules and replays each route body after its membership check. It wraps `globalThis.fetch` to time every upstream HTTP call, including the response-body read. Each combination ran twice; both runs are shown.

**Schools:**
- **Acland Burghley School, URN 100053** (LA-maintained 11–18, Camden; has an approved member).
- **The King's School Worcester, URN 117037** (independent 2–19).

Both have GCSE and Post-16 data for 2020–2024.

Route-equivalent wall time in ms (run b / run c) and upstream call count:

| Route (order the page hits them) | 100053 GCSE | 100053 Post-16 | 117037 GCSE | 117037 Post-16 |
|---|---|---|---|---|
| dashboard | 1390 / 1081 (22 calls) | 1237 / 1256 (19) | 956 / 949 (21) | 936 / 1064 (19) |
| saved-comparator-sets (0 saved sets) | 407 / 169 (9) | 154 / 157 (9) | 152 / 180 (9) | 276 / 312 (9) |
| chooser-set (nearest) | 1005 / 1160 (26) | 985 / 934 (26) | 1993 / 1740 (33) | 1545 / 1346 (33) |
| academic-schools (9–11 URNs, includeSubjects) | 1253 / 1377 (18) | 1361 / 1258 (18) | 993 / 765 (15) | 1047 / 1054 (17) |
| subject-geography (largest subject) | 396 / 225 (5) | 261 / 377 (5) | 199 / 392 (5) | 229 / 350 (5) |
| subject-grade-geography | 214 / 391 (5) | 364 / 418 (5) | 307 / 222 (5) | 345 / 386 (5) |
| comparator-grades | 430 / 507 (6) | 423 / 420 (8) | 66 / 194 (2) | 118 / 155 (5) |
| **Sum of all 7** | **5.1 / 4.9 s, 91 calls** | **4.8 / 4.8 s, 90** | **4.7 / 4.4 s, 90** | **4.5 / 4.7 s, 93** |

**Default load:**
- 5 API routes: dashboard, saved-sets, chooser-set, academic-schools, subject-geography.
- Plus 6 direct Supabase calls from the browser: membership, onboarding, prefs, notes, getUser and an upsert.
- Plus 1 membership query inside each route.
- That is **≈ 80 upstream HTTP calls and ≈ 4 s of summed server-side query time**. Bands/threshold add 2 routes and about 10 calls.

**Critical path:** membership → dashboard (≈1.0–1.4 s) → 4–5 sequential small browser calls → first paint of Columns 1–2. Comparisons then waits on chooser-set (1.0–2.0 s) → academic-schools (0.8–1.4 s). So Column 3 completes **≈ 2–3.5 s after the dashboard response**, before network and cold-start overheads.

Dashboard payload (the equivalent object I assembled): GCSE 110–180 KB, **Post-16 490–550 KB** of JSON.

**What these numbers do measure:** upstream DB/PostgREST round trips from this Mac to eu-west-2, including body transfer, with the repo's own code and sequencing inside each route.

**What they don't measure:**
- The browser → Vercel hop, function cold starts and Basic-Auth gating.
- The membership checks and the browser-direct Supabase calls (not replayed; each ≈ 40–200 ms on the evidence of similar calls).
- React render and hydration time.
- Concurrency between routes in a real browser. Routes 7 and 8 overlap, so the sum overstates wall time while the critical path understates it.
- Saved sets were assumed to be empty.
- The first run of the very first process was a little slower (dashboard 1.75 s). Runs b/c are warm.

## 4. Implications for "one batched fetch per dashboard, de-duplicated"
- Biggest wins:
  - Drop the mothballed preset sets in the dashboard route (route.ts:130–145).
  - Fetch the target profile once.
  - Pass `includePopulation:false` from Teacher.
  - Add a phase filter to `fetchAcademicProfiles`.
  - Serve comparator-grades from `academic_subject_grade_rollup` for one subject instead of all raw facts.
  - Make chooser-set and academic-schools one call (the URNs are known server-side).
- Reading school-level grades from `academic_subject_grade_rollup` would also lengthen the grade measures from 2 to 4 years.
- A batch endpoint must span both projects. It is cheapest as one Next route fanning out to vicdata RPCs, not as a single Postgres RPC.

---

# Part C — Per-user state, Meetings, roles and RLS

Read-only. Live evidence comes from `supabase db query --linked` against lnhulykjlxmoneappnsp on 2026-10-03 (SELECTs only). Code references are to branch `v0.6` at 5597757.

**Repo vs live drift (applies to everything below).** Live `supabase_migrations.schema_migrations` records `teacher_view_role_vocabulary` 20260919120909, `teacher_view_persistence` 20260919121233, `teacher_view_last_seen_period` 20260919125711, `teacher_view_onboarding_school_scoped` 20260919135304 and `teacher_view_notes_school_scoped` 20260919135317. The repo has different timestamps (`20261101090000_…`, `20261101100000_…`). The last three have **no repo file at all**, and `20261101100000_teacher_view_persistence.sql` is a 23-line comment pointer. So the live schema below is the source of truth.

---

## 0. Every table in `public` (live), with RLS and policy count

All but one table have RLS on. Exact row counts are given where they matter.

| Table | RLS | Policies | Notes |
|---|---|---|---|
| age_band_pupil_distributions | on | 1 (select true) | public data |
| age_profile_aggregates | on | 1 (select true) | public data |
| boarding_quintiles | on | 1 (select true) | public data |
| census_age_gender_cache | on | 1 (select true) | public data |
| consortium_members | on | 1 (select true) | 48 rows |
| la_boundaries | on | 1 (select true) | |
| la_gss_crosswalk | on | 1 (select true) | |
| **meeting_slides** | on | 1 (ALL, via owning meeting) | **1 row** |
| **meetings** | on | 1 (ALL, own) | **1 row** |
| pending_school_requests | on | 1 (INSERT anyone, no SELECT) | 0 rows |
| profiles | on | 3 (select own, select school colleagues, update own) | 2 rows |
| recruitment_candidates | on | 1 (ALL via own job) | 1 |
| recruitment_jobs | on | 1 (ALL own) | 1 |
| region_boundaries | on | 1 (select true) | |
| roll_aggregates | on | 1 (select true) | |
| saved_rankings | on | 4 | 0 |
| saved_set_members | on | 2 | |
| saved_sets | on | 4 | 0 |
| school_accounts | on | 3 | 44 |
| school_current_snapshot | on | 1 (select true) | |
| **school_memberships** | on | 4 | **2 rows** |
| school_nearest_neighbours | on | 1 (select true) | |
| school_region_nation | on | 1 (select true) | |
| schools | on | 1 (select true) | |
| sixth_form_sector_aggregates | on | 1 (select true) | |
| spatial_ref_sys | **off** | 0 | PostGIS system table |
| **teacher_view_notes** | on | 1 (ALL own) | **3 rows** |
| teacher_view_onboarding | on | 1 (ALL own) | 6 |
| **teacher_view_preferences** | on | 1 (ALL own) | **7 rows** |
| vc_comparator_set_members | on | 1 (SELECT) | 0 |
| vc_comparator_sets | on | 1 (SELECT) | 0 |
| vc_set_school_visibility | on | 1 (SELECT) | 0 |

Other things that exist or don't:
- `public` has no views apart from PostGIS's `geography_columns` and `geometry_columns`.
- `public` defines no enum types. Every "enum" is a `text` column with a CHECK constraint.
- There are no team, department, sign-in or event tables in any schema (searched `information_schema.tables` by name).
- `auth.users` holds 2 rows and `auth.audit_log_entries` holds 0.
- `pg_cron` is not installed, so **nothing enforces `delete_by`** on meetings or recruitment.
- Grants are Supabase defaults: `anon` and `authenticated` have full DML on every table. RLS is the only gate.

---

## 6. Per-user state and notes

### 6.1 `teacher_view_preferences` (live)

**Columns:**

| Column | Type | Constraint |
|---|---|---|
| `profile_id` | uuid | not null, FK → `profiles` ON DELETE CASCADE |
| `school_urn` | text | not null, **no FK** |
| `phase` | text | not null, CHECK in (`ks2`, `ks4`, `ks5`) |
| `subjects` | jsonb | not null, default `'[]'` |
| `columns` | jsonb | not null, default `'{}'` |
| `updated_at` | timestamptz | |
| `last_seen_period` | integer | nullable |

- **Primary key:** `(profile_id, school_urn, phase)`, so state is per person, per school, per phase. It is **not** per dashboard: the GCSE Candidates and GCSE Results dashboards share one row.
- **RLS:** `teacher_view_preferences_own`, ALL, `profile_id = auth.uid()` (both USING and WITH CHECK). No school or membership check, so rows survive a lost or switched membership.

**Structure of the live data (7 rows, no personal content):**
- `subjects` is always a JSON array of strings shaped `"<Subject>::<Qualification type>"`, with 0 to 4 per row.
- `columns` is an object whose values are **always string arrays** (a scalar is stored as a 1-element array, per `teacher-view-data.ts:96-100`). The keys and their observed values:

| Key | Observed values | Read today? | Meaning |
|---|---|---|---|
| `candidates` | `["change"]`, `["candidates\|vs_category\|Mathematics::GCE A level\|trend", …]` | yes, via `panelsFrom` (`teacher-view-panels.ts:46`) | Column 1's open panels (`current`/`trend`). **Both** Candidates and Results modes read it (`COL1="candidates"`, `[phase]/page.tsx:1461`). Old round-5 view ids and `change` are silently filtered out. |
| `context` | old round-5 view ids | yes (filtered) | Column 2's open panels |
| `rankings` | `["trend"]` | yes | Column 3 (Comparisons) open panels |
| `results` | `["current"]`, `["trend"]`, `["vs_school_avg"]`, old view ids | **no** (Results was merged into Column 1 in round 8) | legacy |
| `measure:shared` | `candidates` \| `results` | yes (`page.tsx:969`) | the Candidates/Results toggle |
| `measure:results` | `bands`, `counts` (also `points`, `threshold`, `entries` are possible) | yes (`page.tsx:987`) | Results sub-measure pill |
| `band:range` | `{"top":"9","bottom":"7"}` (JSON in a string) | yes (`page.tsx:997-1007`) | grade-band range |
| `against:context` | `category` \| `whole` | yes (`page.tsx:1179`) | Context compare-against pill |
| `chosen:context` | `Subject::Qual` keys | yes (`page.tsx:1181`) | Context's hand-picked subject set |
| `set:rankings` | `nearest` \| `saved:<uuid>` \| `CHOOSER_SET_ID` | yes (`page.tsx:289`) | Comparisons set |
| `chooser:rankings` | JSON `{kind:"urns",label,urns[]}` | yes (`page.tsx:55,283`) | ad-hoc chooser set (URNs) |
| `nav:labels` | `off` | yes | nav label toggle, written to every phase row (`teacher-view-data.ts:119-136`) |
| `measure:context`, `measure:rankings` | `points`, `entries` | **no** (only deleted by `resetColumn`, `teacher-view-data.ts:172-177`) | legacy |

`last_seen_period` holds 2024 or null. It drives the "new data" banner (`teacher-view-data.ts:376-389`).

**Where it's read and written in `src/`:**
- `src/lib/teacher-view-data.ts:52-90`: `fetchPreferences` and `savePreferences`, which upsert on the primary key.
- `src/lib/teacher-view-data.ts:96-177`: the key helpers.
- `src/lib/teacher-view-data.ts:372-389`: `markPeriodSeen`.
- `src/app/teacher/[phase]/page.tsx`:
  - 255-264: load;
  - 407-421: `setPanels`, which deletes the key when the set is just `["current"]`;
  - 425-470: setting writers;
  - 2183-2185: the chooser.
- `src/app/teacher/meetings/page.tsx:218`, which reads `subjects` to build the slide picker.
- Not involved: the theme is in `localStorage` (`TeacherChrome.tsx:39-50`), and component-only state (view toggles, sort, focus chip, From:/Since:) resets on reload by design (`teacher-view-data.ts:89-95`).

### 6.2 `teacher_view_notes` (live)

**Columns:**

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | primary key |
| `profile_id` | uuid | not null, FK → `profiles` CASCADE |
| `chart_key` | text | not null |
| `body` | text | not null |
| `created_at`, `updated_at` | timestamptz | |
| `school_urn` | text | not null, **no FK** |

- **Unique:** `(profile_id, school_urn, chart_key)`.
- **RLS:** `teacher_view_notes_own`, ALL, `profile_id = auth.uid()`.

**Current key format** (written since round 8 and the trends merge): `panelNoteKey = "${phase}:${columnId}:${panelId}"` (`teacher-view-data.ts:189`):
- `phase` is ks2, ks4 or ks5;
- `columnId` is `candidates`, `context` or `rankings`;
- `panelId` is `current` or `trend`.

So a note is **per panel**, not per view. Column 1's note is **shared by the Candidates and Results modes** (`page.tsx:1461-1479, 1685, 1811, 1870`).

**The 3 live rows' `chart_key` values:**
- `ks4:results:Biology`
- `ks5:results`
- `ks4:candidates`

**None of them matches the current format.** All three are pre-round-8 (per-card or per-subject) keys, so **they don't render anywhere today**. They are already orphaned, and the docs' assumption that existing notes resolve is not true for any live row. The read path is `fetchNotes` (`teacher-view-data.ts:197-205`) and the write and delete path is `saveNote` (`:208-226`, where an empty body deletes the row).

### 6.3 Mapping plan: a key-mapping layer, not a `chart_key` migration

**Recommendation: a read-through key-mapping layer in code.** No rows are rewritten and no RLS changes. Reasons:

1. **Both renderers run side by side behind the flag** (scope §6). The unflagged live page reads `ks4:candidates:current` etc. and the column-id `columns` keys. A one-off rewrite of `chart_key` or `columns` would break notes and state on the live, unflagged dashboard. That is a stop condition.
2. **It's non-destructive.** The existing rows stay byte-identical, and the RLS (`profile_id = auth.uid()`) is untouched, so who can see what cannot change.
3. **The volume is trivial** (3 notes, 7 preference rows), so a later consolidation is cheap. Do that only after Step 4, once the old path is retired. It should be an additive copy, never an in-place rewrite.

**Shape:**
- Each seeded VicData dashboard config gives every panel a stable `panelId`, for example:
  - `gcse.candidates.c1.current`
  - `gcse.results.c1.trend`
  - `post16.candidates.c2.current`
- Each panel also gets a `legacy` block that the renderer consults when no new-style state exists:
  - `noteKey`: `"{phase}:{candidates|context|rankings}:{current|trend}"`;
  - `openKey`: the `columns[columnId]` key, with membership of `current`/`trend` in it;
  - `settingKeys`: `measure:results`, `against:context`, `chosen:context`, `set:rankings`, `chooser:rankings`, `band:range`.
- **Precedence when reading:** new-style state, then the legacy key, then the panel's default.
- **Writing during the flag period:** the config renderer **writes back through the legacy key**, so the old and new renderers stay in sync while both serve.
- **After the flag flips:** it writes new-style keys only, held in a sibling table with identical RLS, for example `dashboard_user_state (profile_id, school_urn, dashboard_id, panel_id, view_id null, state jsonb)` with an ALL policy on `profile_id = auth.uid()` (G1). The legacy rows are left in place as the fallback.

**Specific mappings the seed configs must carry:**
- **Column 1 is shared across the Candidates and Results dashboards.** Both dashboards' Column 1 panels alias the same legacy note key and the same `columns.candidates` open set. Today that behaviour is deliberate (`page.tsx:1612-1614`: "switching to Results and finding your Trend panel gone would read as a bug"). Recommend keeping the alias shared, and logging that a post-flip edit will fork the note between the two dashboards.
- `measure:shared` decides which member of the group is opened last. It is the group switcher's remembered choice and maps to `group.lastDashboardId`.
- `subjects`, `last_seen_period` and `nav:labels` are per person, school and phase, not per dashboard. They stay exactly where they are; the renderer reads `teacher_view_preferences` as it does now.
- **Notes attach to the panel, not the view.** G2 wants notes keyed on the view instance. Legacy notes are panel-level, so map each one to the panel as a whole and show it on every view in the rail. Don't guess which view it belonged to. Log this as an open question.
- **Leave the three orphaned legacy notes untouched.** Don't map them: guessing their panel would attach old text to a different figure, which is the failure the school-scoping round warned about (`teacher-view-data.ts:191-194`). Instead, log them so the 0.7 notes hub can list them as "older notes".
- **Ignore the legacy keys exactly as `panelsFrom` does today:** `results`, `measure:context`, `measure:rankings`, and the round-5 view ids and `change` inside the column arrays.

---

## 7. Meetings

### 7.1 Live tables

**`meetings`:**

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | |
| `profile_id` | uuid | not null, FK → `profiles` CASCADE |
| `name` | text | not null |
| `meeting_date` | date | nullable |
| `delete_by` | date | not null |
| `created_at` | timestamptz | |

- RLS `meetings_own`, ALL, `profile_id = auth.uid()`.
- **There is no `school_urn` and no membership link.** A meeting belongs to a person, not a school.
- 1 row: it has a date, and its `delete_by` is in the future.

**`meeting_slides`:**

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | |
| `meeting_id` | uuid | not null, FK → `meetings` CASCADE |
| `position` | int | not null |
| `chart_key` | text | not null |
| `caption` | text | nullable |

- Unique `(meeting_id, position)`, plus index `meeting_slides_meeting_idx`.
- RLS `meeting_slides_own`, ALL, `meeting_id IN (select id from meetings where profile_id = auth.uid())`.
- 1 row: `chart_key = "ks4:results:Biology"`, position 1, with a caption.

### 7.2 Code

- `src/lib/teacher-view-data.ts:311-357`: the `Meeting` and `MeetingSlide` types, `fetchMeetings`, `createMeeting`, `fetchSlides` and `addSlide(supabase, meetingId, chartKey, position, caption)`.
- `src/app/teacher/meetings/page.tsx`:
  - the slide key is `"${phase}::${view.id}"` (`:60-63`);
  - `view.id` is the **old round-5 catalogue id** `viewId(column, axis, subjectKey|"-", now|trend)` = `"results|vs_category|Biology::GCE A level|trend"` (`src/lib/teacher-view-catalogue.ts:191-193`), which `availableViews` (`:218`) builds;
  - `SlideBody` (`:65-85`) splits on `::` and re-resolves the view against live data, so the deck is always live;
  - slides are added **only** from this page's TickList (`:151-163`, `addSlide(..., slides.length, null)`), so captions are never set from the UI;
  - the school comes from `.maybeSingle()` on approved memberships (`:190-195`).
- **No panel-level "Add to meeting" or "Copy to meeting" exists anywhere** (grep of `src/components`). `addSlide` has one caller.
- **Meetings use a different view system from the dashboards.** Their views come from the round-5 axis catalogue (`teacher-view-catalogue.ts`), not from today's panels and rails.
- **The live slide is already broken.** Its key `ks4:results:Biology` has no `::`, so `SlideBody` shows "This slide's phase is no longer available to you".
- `delete_by` is UI-only. No job deletes expired meetings.

### 7.3 Mapping to a `kind: "presentation"` config (for S7)

**`meetings` row → `dashboards` row:**

| New field | Source |
|---|---|
| `kind` | `presentation` |
| owner scope | `user`, with `owner_profile_id = profile_id` |
| `name` | `name` |
| `meeting_date` | `meeting_date` (if null: needs a default, e.g. `created_at`'s date, logged) |
| `created_at` | `created_at` |
| `delete_by` | dropped (archive replaces it, brief §7.5); keep it in the migrated config's `legacy` block for audit |

- **The school has to be supplied.** It isn't stored today, so take it from the owner's single approved membership at migration time. If the owner has none, the meeting goes to a no-school or personal scope.
- **The archive state is derived from `meeting_date`.**
- A personal scope stays visible to its owner only, so who can see the meeting is unchanged.

**Each `meeting_slides` row → one slide:**

```
{ title: caption ?? <resolved view label>, speakerNotes: "", layout: "auto",
  slots: [ { kind:"view", dataview:<registry id>, pinned:{ phase, subject, qualificationType,
             compare:<axis → named compare>, time: now|trend }, year:{ mode:"live" } } ] }
```

- Order by `position`. Gaps are possible, so renumber.
- **The year is `mode: "live"`**, because today's decks are live by design ("a deck is never out of date"). Pinning the year at migration would change what existing decks show.
- **The registry needs a legacy-axis lookup table** that maps round-5 `column|axis|subject|now|trend` ids to registry entries plus pinned params. The axes are `vs_school_avg`, `vs_category`, `vs_all_subjects`, `vs_chosen`, `category_vs_categories`, `share_of_cohort` and the rankings sets.
- **A key that won't parse becomes a slide with a text slot**, keeping its caption, plus a "view no longer available" placeholder. The one live slide is this case.
- **RLS:** the new presentation rows must stay owner-only (user scope) until they are explicitly shared. Leave the old tables in place, read-only, until parity is checked.
- **Caps (G9):** 1 meeting, so none is reached.

---

## 8. Roles and RLS

### 8.1 Role storage (live)

**`school_memberships`:**

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | |
| `school_account_id` | uuid | FK CASCADE |
| `profile_id` | uuid | FK `profiles` CASCADE |
| `status` | text | default `pending_verification`; CHECK in (`pending_verification`, `pending_approval`, `approved`, `rejected`) |
| `is_admin` | bool | default false |
| `role` | text | default `'teacher'`, nullable; CHECK in (`teacher`, `hod`, `smt`, `finance`, `admissions`) |
| `individual_tier_active` | bool | |
| `requested_at`, `approved_at` | timestamptz | |
| `approved_by` | uuid | FK → `school_memberships`, no ON DELETE |

- Unique `(school_account_id, profile_id)`. One row per person per school, holding a **single** role value.
- **School-Admin today is not a role.** It is three separate mechanisms:
  - the `is_admin` boolean;
  - the account holder, `school_accounts.account_holder_membership_id` (plus `pending_account_holder_membership_id` for a handoff);
  - the trigger `school_memberships_is_admin_guard`, BEFORE UPDATE, running `enforce_is_admin_change_by_account_holder_only()`, so only the account holder can flip `is_admin`.
- **Live data:** 2 memberships, both `role='teacher'`, `status='approved'`, `is_admin=true`. Both were most likely created by the testing switcher, which inserts without a role and so picks up the default. 1 school account has a holder.
- **The role vocabulary migration IS applied live.** The check constraint and default match `20261101090000_teacher_view_role_vocabulary.sql`. **`src/lib/roles.ts:8-13` is stale** where it says the migration has "NOT been applied".
- **Teacher is not actually self-selectable on join.** `src/app/join/[urn]/page.tsx:6-12`:
  - still offers the **old** vocabulary (`head_governor` as the default, `admissions`, `finance`, `director_of_studies`, `head_of_department`);
  - offers no `teacher` option;
  - passes the choice to `join_school(p_role)` (`:76-79`).
- **Joining is broken for most choices.** The default and two other options violate the live CHECK, so `join_school` raises an error. Only `admissions` and `finance` would succeed.
- `src/app/account/page.tsx:9-15, 247, 367` shows roles with the old labels, so `teacher` renders an empty label.
- **Nothing gates on `role`.** `roles.ts`'s helpers (`normaliseRole`, `seesTeacherView`, …) have **no callers**, and no RLS policy or SQL function reads `role` apart from `join_school`, which writes it.

### 8.2 Every RLS helper and security-definer function (live `pg_get_functiondef`)

**The three RLS helpers** are all `LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public` and all school-scoped:
```sql
is_member_of_school_account(p uuid):  exists(select 1 from school_memberships where school_account_id=p and profile_id=auth.uid() and status='approved')
is_admin_of_school_account(p uuid):   … same … and is_admin = true
is_account_holder_of_school_account(p uuid): exists(select 1 from school_accounts sa join school_memberships sm on sm.id=sa.account_holder_membership_id where sa.id=p and sm.profile_id=auth.uid())
```

**Other functions:**

| Function | Kind | What it does |
|---|---|---|
| `check_school_has_member(p_urn)` | sql, SECURITY DEFINER, no search_path | Is there any approved member? Used by the join page. |
| `join_school(p_urn, p_role)` | plpgsql, SECURITY DEFINER, **no search_path** | Creates the account if missing. The first member is auto-approved when the email domain equals the school website's domain, and then becomes **account holder**; otherwise `pending_verification`. Later joiners get `pending_approval`. Inserts `role = p_role` **unvalidated**: any caller can self-assign `smt`/`finance`/`admissions`, limited only by the CHECK. |
| `initiate_account_holder_handoff`, `accept_account_holder_handoff` | plpgsql, SECURITY DEFINER, no search_path | Account-holder transfer. |
| `handle_new_user()` | trigger `on_auth_user_created` on `auth.users` | Inserts the `profiles` row. |
| `enforce_is_admin_change_by_account_holder_only()` | trigger, see 8.1 | |
| `enforce_personal_comparator_cap()`, `enforce_personal_ranking_cap()` | triggers | Cap of 8 per membership on `saved_sets` / `saved_rankings`. |

**Which tables use which helper:**

| Helper | Used by |
|---|---|
| `is_member_of_school_account` | `school_accounts` select; `school_memberships` select; `saved_sets` / `saved_rankings` / `saved_set_members` select (shared rows); `vc_set_school_visibility`, `vc_comparator_sets`, `vc_comparator_set_members` select |
| `is_admin_of_school_account` | `school_memberships` update and delete; `saved_sets` / `saved_rankings` insert-shared, update, delete; `saved_set_members` write |
| `is_account_holder_of_school_account` | the same set as `is_admin`, plus `school_accounts` update and the `is_admin` guard trigger |

`profiles_select_school_colleagues` inlines its own join, `my.status='approved'`, and does not require the colleague to be approved. The personal tables (`teacher_view_*`, `meetings`, `meeting_slides`, `recruitment_*`) use `profile_id = auth.uid()` with no helper.

### 8.3 How the VC Sets toggle authenticates

- **There is no in-app toggle.**
- The `vc_*` tables have SELECT policies only (migration `20261102100000_victoria_consultancy_sets.sql`), so writes need the service role.
- The only writer is `scripts/vc-sets.ts`. It runs locally with `SUPABASE_SERVICE_ROLE_KEY` via `createServiceRoleSupabaseClient` (`src/lib/supabase.ts:24-30`).
- The per-school switch is the commands `show <urn> <set-id>` and `hide <urn> <set-id>`, which insert or delete rows in `vc_set_school_visibility`.
- The read path is `src/app/api/teacher/saved-comparator-sets/route.ts:42-47, 97-120`. It uses the caller's own bearer token on the anon client, so RLS applies.
- `docs/OPEN_QUESTIONS.md:816-822` records the reasoning: there is no operator role, and the separate `vicdata` admin app is on a *different* Supabase project.

### 8.4 How the testing school switcher and preview session authenticate

**`/api/testing/switch-school`** (`src/app/api/testing/switch-school/route.ts`):
- **Gate:** the env flag `ENABLE_TESTING_SCHOOL_SWITCHER === "true"` (server side). The UI also needs `NEXT_PUBLIC_ENABLE_TESTING_SCHOOL_SWITCHER` (`src/app/account/page.tsx:154-167`).
- **Caller identity:** the caller's bearer token, checked via `auth.getUser()`. **No admin identity is checked: any signed-in user can use it in an environment where the flag is on.**
- **What it does:** on the service role, `grantApprovedMembership` (`src/lib/testing-membership.ts`):
  - nulls the holder and pending-holder fields on the caller's accounts;
  - nulls `approved_by` references to the caller;
  - **deletes the caller's personal `saved_sets`** and all of the caller's memberships;
  - inserts an `approved`, `is_admin=true` membership (role taken from the default, `teacher`);
  - makes that membership the account holder.
- **There is no role switch.** Only the school is switchable, and every switched account becomes admin and account holder.

**`/api/testing/preview-session`:**
- **Gate:** four env vars (`PREVIEW_ACCESS_ENABLED`, `_TOKEN`, `_EMAIL`, `_SITE_URL`) plus a timing-safe token in the query string.
- **What it does:** on the service role, it lists users, creates the preview user if missing, grants a starter membership (URN 100053), and redirects to a real Supabase magic link. It also sets the access-gate cookie.
- None of the `PREVIEW_ACCESS_*` names is in the local `.env`.

### 8.5 How "system admin" is identified today

**It isn't.** There is no allowlist, no email check and no column or claim. Grep for `system admin`, `super admin`, `platform admin`, `ADMIN_EMAILS` and similar finds nothing.

"Admin" powers today come from three places:
- possession of the service-role key (scripts);
- env-flagged routes open to any signed-in user;
- the per-school `is_admin` and account holder.

`is_platform_admin()` will be wholly new. Suggestion: a `platform_admins(profile_id pk, granted_at, granted_by)` table, writable only by the service role, plus an audit table. Don't use email matching.

### 8.6 Join requests, teams and sign-in logging

**Join request and approval flow: yes, it exists.**
- `join_school` puts later joiners in `pending_approval`.
- `/account` lists the school's memberships (`account/page.tsx:316`). An admin or account holder can:
  - approve (`:326-331`, an UPDATE `status='approved'`, `approved_by`);
  - reject or remove (`:335`, DELETE);
  - toggle admin (`:340`).
- **Gap 1:** a first member left in `pending_verification` (their email domain doesn't match the school's website) has no in-app approver, since there is no admin yet. That needs a service-role or manual step.
- **Gap 2:** `pending_school_requests` accepts inserts from anyone but has no SELECT policy, so only the service role can read it.

**Teams and departments: none**, in any schema.

**Sign-in logging: none.** `auth.audit_log_entries` has 0 rows, and nothing is per school.

### 8.7 Risks for S1 (roles as a set), and existing holes

1. **No policy compares the single `role` column.** Every policy goes through `status`, `is_admin` or the account holder. So adding `roles text[]` (backfilled `= array[role]`) and keeping `role` during the transition **does not change who can see anything**.
   - The only SQL that touches `role` is `join_school`.
   - The only app reader is the account page.
   - Keep the `role` column, and either keep it synced from `roles` by a trigger or drop it only after the code moves off it.
2. **Keep `is_admin` and the account holder as the RLS source of truth for School-Admin.** If `school_admin` becomes a member of the role set, `is_admin_of_school_account` must stay exactly equivalent. Either derive the role from `is_admin`, or redefine the helper and backfill from `is_admin`. The account-holder-only trigger guard must also cover `school_admin` in the new set; otherwise any admin could make admins, which is a privilege change.
3. **Existing security hole (not caused by 0.6, but S1 touches it).**
   - The policy `school_memberships_insert_own` checks only `profile_id = auth.uid()`.
   - So any authenticated user can, through PostgREST directly and bypassing `join_school`, insert themselves into **any** school account with `status='approved'` and `is_admin=true`. No INSERT trigger guards this.
   - That gives school-member reads (shared saved sets, colleagues' profile emails) and admin writes.
   - Similarly, `school_accounts_insert_authenticated` lets any user create accounts with arbitrary holder fields.
   - Tightening the WITH CHECK (to pending status, `is_admin=false` and `role`/`roles` = teacher, routing all other creation through `join_school`) narrows who can write. It removes no legitimate path, but it is an RLS change on memberships, so per the night-1 rules log it or stop for Guy.
4. **`join_school` trusts `p_role`, and the join UI sends values the live CHECK rejects.** S1 should make the RPC ignore client roles (always `teacher`, since the others are admin-granted per `roles.ts:20-23`) and fix the join page. This changes a write path only.
5. **Security-definer functions without `SET search_path`:** `join_school`, `check_school_has_member`, `initiate_account_holder_handoff` and `accept_account_holder_handoff`. Fix them while editing.
6. **The testing switcher deletes memberships and personal saved sets** and makes the caller admin and holder. Moving it onto `is_platform_admin()` as a read-only "Look at it as…" (S1) must not reuse this destructive path. Note `teacher_view_*` rows are keyed by `profile_id` and `school_urn`, with no membership FK, so they survive a switch.
7. **The pages assume one approved membership.** `/teacher`, `/teacher/[phase]` and `/teacher/meetings` use `.maybeSingle()` on approved memberships (`[phase]/page.tsx:226-229`, `meetings/page.tsx:190-194`, `teacher/page.tsx:64`), so a multi-school person errors. A role *set* is fine because it lives within one row, but don't add more membership rows per school.
8. **G13 sign-in events** will be a new table. Supabase has no per-school sign-in hook, so the app has to record the event (e.g. on `/teacher` load per school). Nothing exists to extend.

---

# Part D — Claims check

Read-only, 3 Oct 2026, branch `v0.6` at 5597757. Every "exists today" claim in the three design docs is checked:
- **Scope**: `docs/v0.6/vicdata_0_6_scope_brief_v1.md`
- **Cat**: `docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md`
- **Comb**: `docs/v0.6/vicdata_0_6_add_a_view_combinations_v1.md`

Evidence comes from audits A (views and rules), B (measures, performance, live vicdata-production) and C (state, meetings, roles, live lnhulykjlxmoneappnsp), plus my own reading of `src/`.

**Abbreviations:**
- `P` = `src/app/teacher/[phase]/page.tsx`
- `CP` / `SP` / `XP` / `GP` = `src/components/teacher/{Candidates,Subject,Comparisons,GradeCounts}Panels.tsx`
- `TVP` = `src/lib/teacher-view-panels.ts`

Design intent (what 0.6 *will* do) is not graded. Only assertions about what exists now are.

**Verdicts:** 31 Confirmed · 35 Partly · 15 Corrected (81 claims).

## Structure, layout, panel unit

| # | Claim (doc §) | Verdict | Correction / evidence (file:line) |
|---|---|---|---|
| 1 | Each Teacher dashboard is hand-built: `page.tsx` wires CandidatesPanels / SubjectPanels / ComparisonsPanels into DashboardGrid (Scope §0) | Confirmed | P:20-24 imports; `<DashboardGrid>` P:1609-2076. Column 1 also mounts **GradeCountsPanels** (P:1674-1695) for Results → Grade counts. SubjectPanels serves both Column 1 Results (P:1697) and Context (P:1910) |
| 2 | "Four live dashboards" (GCSE/Post-16 × Candidates/Results) (Scope §0, §5) | Partly | It is one route, `/teacher/[phase]`, per phase. A shared Candidates/Results toggle (`measure:shared`, P:969-971) re-drives **all three columns**, not just Column 1. KS2 is served by the same page (Column 1 and Context are single CardBoxes, P:1627-1662 and P:1887-1904; Comparisons does render ComparisonsPanels at KS2, P:2015) |
| 3 | Each panel's views are a local enum switched in a `body` (Scope §0) | Confirmed | `PanelRender.body(fullscreen)` (ColumnPanels.tsx:50). Panel-local useState holds the view: CP `trendsView` CP:113; SP `view` SP:256 and `trendsView` SP:269; XP `viewChosen` XP:210 and `trendsView` XP:232; GP `trendsView` GP:64 |
| 4 | The rail comes from the `actions` array in a PanelRender (Scope §0) | Partly | `actions` is a `ReactNode` (the icon buttons already rendered), not an array (ColumnPanels.tsx:48). Each panel builds its own buttons inline (e.g. CP:448-453, SP:521-539, XP:340-345). There is no declarative view list to read, so the registry has to be written by hand |
| 5 | Panel unit "about 385 × 256 at desktop, 24 px gaps", 1.5:1 shape (Scope §7.1) | **Corrected** | **PANEL_HEIGHT = 384** (CardBox.tsx:83; budget comment :60-82). 256 was round 8's value, superseded by the accordion round. Measurements: column track 385px at the 1280 cap; DashboardGrid `gap-[18px]` plus 2px divider tracks (DashboardGrid.tsx:37); column `p-4`; panels stack with `mt-3` (12px). **Panel box ≈ 351 × 384**, about 0.91:1 (taller than wide), not 1.5:1 |
| 6 | Today's layout is a 3×3 / 3×2 grid of panels; each column has Current and Trends (Comb §3A "3 columns × 2 rows") | Partly | Two panels per column (`PanelId = current \| trend`, TVP:21-24). It is a **one-open accordion**: one panel at 384px plus one collapsed 46px bar (TVP:58-60, CardBox.tsx:60-82). So a column never shows two panel units at once. ColumnPanels.tsx:142 still says "3x3 grid" (stale) |
| 7 | "Three units across and two down fits a 1280 × 720 slide exactly, with room for a title" (Scope §7.2) | **Corrected** | It doesn't fit at the real unit. Two rows = 2 × 384 + 12 = 780px > 720, before any title. Three across ≈ 3 × 351 + gaps ≈ 1.1k (fits). The slide grid needs its own unit or scale |
| 8 | Layout = DashboardGrid's grid template (Scope §1) | Confirmed | `xl:grid-cols-[1fr_2px_1fr_2px_1fr]`, `md:grid-cols-2`, stacked below md (DashboardGrid.tsx:37) |
| 9 | Existing phone pattern: columns become a tab strip (Scope G4) | **Corrected** | There is no tab strip. On phone the columns **stack**, at md they pair 2-up, and from xl there are 3 columns with dividers (DashboardGrid.tsx:2-7, 37). G4's tab strip would be new |
| 10 | Column heads (Candidates / Context / Comparisons) plus their pills (Scope §1) | Partly | Column 1's head switches Candidates ↔ Results (P:1616). Pills: the Results sub-measure pill appears in **Results mode only** (P:1775-1784); Context has the compare-against pill (ContextPills.tsx); Comparisons has the set pill. Candidates-mode Column 1 has no pill row |
| 11 | "The column-row alignment spacer" must be carried (Scope §5) | **Corrected** | There is no spacer element. The "row-alignment fix" moved measure-specific pills out of the shared bar into each column's `controls` slot (ControlBar.tsx:5-9, P:1776-1779). ColumnPanels renders controls only if present (ColumnPanels.tsx:92), so nothing reserves the row for Candidates-mode Column 1. What actually aligns the panels is the fixed `PANEL_HEIGHT` |
| 12 | Current/Trends row tags: "Current" + "Data 2024/25" (Scope §5) | Partly | Current = `Current` + `DataDate` "Data {year}" (ColumnPanels.tsx:157-163); Context's year menu sits inside it. Trends = `Trends` + "From {year} ▾". **Exception:** Grade counts' Current tag is `Grade counts {year}`, with no "Current" and no DataDate (GP:113) |
| 13 | Dashboard group ≈ the Candidates/Results toggle in the shared control bar (Scope §1) | Confirmed | ControlBar.tsx:11-13. Persisted as `measure:shared` (P:969). It is per phase, not per dashboard |
| 14 | Dataview ≈ one item in the action rail; Panel ≈ one PanelRender (Scope §1) | Confirmed | ColumnPanels.tsx:36-73. Trends rails merge Trend's and % change's views (CP:444-457, SP:1015-1028, XP:777-792, GP:201-214) |
| 15 | Every panel already has fullscreen (Scope §7.3 premise) | Confirmed | CardBox fullscreen plus the `FullscreenReport` count (DashboardGrid.tsx:25-28). Panels receive `fullscreen` in `body` |
| 16 | Export menu has disabled "Copy to custom dashboard" / "Copy to a presentation" from round 8 (Scope §4.6, §7.4) | Confirmed | PanelFooter.tsx:216-217, both `disabled`, tagged "Coming soon" |
| 17 | Existing print path to reuse (Scope G10) | Confirmed | `PanelExport onPrint` (ColumnPanels.tsx:134-140); `print:` classes across P (e.g. P:1551-1566, 1604); Data View's PdfExportButton |
| 18 | Dashboards are already built for both themes (Scope G12) | Confirmed | `Theme = "dark" \| "light"` (TeacherChrome.tsx:25), stored in localStorage (TeacherChrome.tsx:39-50) |
| 19 | The "68px problem from round 8" (Cat §2.3) | Partly | It was real at 256px (round-8 build report :70). With panels now 384px it is largely superseded, but the min-height field is still useful |
| 20 | Earlier LA queries already timed out (Scope G3) | Confirmed | dashboard/route.ts:29-33: calls kept sequential because running them together "produced a real statement timeout" |

## Column contents (Comb §1, §3A–B)

| # | Claim (doc §) | Verdict | Correction / evidence |
|---|---|---|---|
| 21 | Col 1 "my subject": **no comparison** (Comb §1, §3A) | **Corrected** | Col 1 compares throughout. Candidates tiles rank the subject in its category and in the school (M1, CP:197-208). Trends draws every same-category peer as its own line or row (M2, CP:161-173, SP:698-706). Results compares with England: avg/gap tiles, "National average" marker, "vs National" (M3, SP:434-450, 615, 643). The Results Map shows comparator schools (M4, SP:823-847). Grade views show England ticks (M5). Declare Col 1 compare as a fixed `subjects-in-school:category`, plus the overrides |
| 22 | Col 2 compares with other subjects; Col 3 with a school set (Comb §1) | Partly | Col 2 confirmed (category / whole / selected). Col 3: with no subject chip on Results, the **focus silently switches to the whole school** headline, Attainment 8 or A-level APS (M7, P:1437-1443). Ranking-set tiles are always headline (XP:349-369) |
| 23 | Col 1 × Current offers Number tiles (entries, rank in category, rank in school) (Comb §3A) | Confirmed | Candidates mode: CP:197-255, tiles only. Results mode adds Bar chart and Sortable table, plus Grades on bands (SP:521-539) |
| 24 | Col 1 × Trends: indexed/actual trend chart, trend table, change list, change table (Comb §3A) | **Corrected** | Live rail: Indexed, Actual, Trend table, **Area chart, Change table**. The last two are the geography (LA/region/England) views (CP:448-453). The category **ChangeList and change table are unreachable dead branches** (CP:393-417), because Column 1's % change half is *always* geography (CP:391-392, SP:946; P:1720-1737, 1850-1865) |
| 25 | Col 2 × Current: donut, bar chart, ranked list; "all subjects" / "my subjects" offer the same views (Comb §3A) | Confirmed | Plus a 4th, Sortable table (SP:525-537). Default is Bar chart (SP:256). Same rail in every compare-against mode |
| 26 | Col 2 × Trends: "share trend chart and table, change list" (Comb §3A) | **Corrected** | No share trend exists. Entries: Indexed, Actual, Trend table, Ranked change, Change table (each subject's entries, not shares). Results: Chart, Trend table, Ranked change, Change table (SP:797-805, 932-935). No Map in Context |
| 27 | Col 3 × Current: map, rank tiles, bar chart, ranking (Comb §3A) | Partly | Number tiles appear **only for ranking sets, replacing the Map** (XP:213, 339-345). Fixed sets get Map, Bar chart, Ranking. Default is Map (XP:210) |
| 28 | Col 3 × Trends: trend map, change map, ranked change bars, trend table, change table (Comb §3A) | Partly | Also has **Chart** (TrendChart vs set average or a named school via the `vs:` pill, XP:680-685). Chart is hidden below 4 years (XP:614-616, 649). Maps are hidden for ranking sets (XP:615, 713) |
| 29 | Results, average points, Col 2 Current: bar, ranked list, no donut; "the live code already drops it" (Comb §3B) | Confirmed | The donut is disabled with "Share is only meaningful for candidate numbers" (SP:525-534) and falls back to bars (SP:297, P:1956). Exception: the donut *is* offered for Grade bands once a range is picked (SP:492-501) |
| 30 | Grade 4+ rate, Col 1 Trends: trend chart, table, **pp change bar** (Comb §3B) | Partly | With 2 years (2023/24–2024/25) MultiTrend shows its <4-year **ranked change list in pp** (SV:76-90; TVP:307-310). There is no standalone pp-bar view. The % change half (Area chart / Change table) shows a "points only" not-applicable note (P:1733). The Map is also in the rail. Labels still say "% change in grade 4+ rate" (TVP:125) |
| 31 | Grade 4+, Col 3 with averages ticked: averages hidden because no LA/region/England benchmark exists (Comb §3B; Cat §2.2) | Partly | Col 3 has **no LA/region/England averages for any measure today**, only set averages. The UI wires no Grade 4+ area benchmark (P:1117-1120, 1136), but `academic_subject_grade_geography_aggregate` holds 2021–2024 grade geography (min 5 schools), so a 9–4 area rate is **derivable** (B §1). Since the data exists, "no benchmark exists" is a product choice, not a data gap |
| 32 | Grade bands "once the grade-bands round ships"; trend of bands "built or planned?" (Comb §3B) | **Corrected** | Shipped. Bands have a Current Grades distribution with range picking, tiles with England rate/gap, Bar, Table and a Context donut (SP:415-427, 546-571; SP:282-292). The **bands trend is built**, the same Trends rail as points/threshold (Chart, Trend table, Map, …), on 2 years |
| 33 | F2: Col 1 Trends' "against the wider system" views compare LA/region/England (Comb §3A F2; Scope §5) | Confirmed, and larger | They are the **whole** % change half, in both modes and both phases (CP:352-392, SP:946-958). Region is dropped from the chart and kept in the table (GC:152). Other mismatches S3 must also mark: M1–M9 (audit A §3) |
| 34 | Results sub-measure pill: APS / Grade 4+ / bands / counts (Scope §5; §3 "existing pill") | Confirmed | MeasurePicker, `measure:results` (P:986-988, TVP:110-159). **Both phases.** Post-16's threshold is "A\*–E rate" (TVP:106-108). The label is still "Average point score" (TVP:113): the C3 rename to "Average points" is not done |
| 35 | Context's compare-against pill, category default (Scope §5) | Confirmed | `CompareAgainstId = "whole" \| "selected" \| "category"` (ContextPills.tsx:41). Category is the default; a legacy "area" maps to category (P:1179-1181). Category = Column 1's own `candidateItems` (P:1359-1360) |
| 36 | Comparisons' compared-against set (Scope §5) | Confirmed | `set:rankings` (saved / chooser / `nearest`) and `chooser:rankings` (P:55-78, 289, 1391-1403). Default is "10 nearest schools" |
| 37 | View titles and their fallbacks exist (Scope §5) | Confirmed | Full template table in audit A §4. Context's bar/list/table and all four Comparisons Current titles are flagged *provisional* in code (SP:489-491, XP:312) |
| 38 | Qualification-type gating (Scope §5) | Confirmed | R-QUAL-FAMILY-MATCH (P:1063-1065, 1076, 1261-1282); geography applicability (P:1727-1734, 1857) |
| 39 | Post-16 AS/AEA exclusions and min-count rules (Scope §5) | Partly | AS/AEA: in the page, UI-only (P:1055, 1190-1191, 1252, 1277, 1331, 1367). Min counts are **not app config**: they live in the vicdata-repo geography RPCs (default 5; England 1 except grade geography) |
| 40 | Subject chips = your subjects; chips choose the focus (Comb §1, C11) | Confirmed | ControlBar chips are single-select focus over the ticked `subjects` (ControlBar.tsx:15-18). The focus key is **not persisted** and resets on reload (P:202) |
| 41 | C12: Col 1's several-subjects-side-by-side views use "my ticked subjects" (Comb C12) | **Corrected** | Col 1's multi-subject views use the focus subject's **same-category, same-qualification-family peers** (`candidateItems`, P:1068-1099), not the ticked subjects. Only Context's "Selected subjects" uses a user-chosen list (`chosen:context`). That list is separate from the ticked `subjects` |
| 42 | C13: subject with 2 years in a Trends row "shows a table" (Comb C13; Cat §2.1) | Partly | That holds only for Col 3, where the Chart button is hidden (XP:614-616). Col 1 and Col 2 MultiTrend show a ranked change-in-units list (SV:76-90). TrendChart draws per-year bars (TrendChart.tsx:185) |
| 43 | D3: "Custom area" = today's Context "Selected subjects" (Scope D3, G5) | Partly | Selected subjects exists (ContextPills.tsx:20-28). It is a **per-user, unnamed** list in `teacher_view_preferences.columns["chosen:context"]`. No named or saved "custom area" exists, so G5's "named custom areas are school-specific" has nothing to apply to yet |

## Rules (Cat §1, §2.1)

| # | Claim | Verdict | Correction / evidence |
|---|---|---|---|
| 44 | A lot of the rules live inside the panel components (Cat §1) | Partly | Most UI-enforced rules live in the **client page `P`** (populations, AS/AEA, qualification family, measure fallback, geography applicability), not in the panel components. Some are in components (SP:282-292 bands bench; XP:254, 274-277). Many are in lib (TVP, subject-grades, comparator-series), routes (England exact) or the **vicdata repo** (ingest and RPCs). Audit A §2 tags each rule "must lift" |
| 45 | R-ENTRIES-NOT-POINTS (Cat §2.1) | Confirmed | vicdata ingest academic_aggregates.py:139-142, 283-288; page gate P:499, 936 (must lift) |
| 46 | R-POINTS-SAME-QUAL (Cat §2.1) | Partly | Enforced by `comparabilityKey` (teacher-view-catalogue.ts:124-127) and the exact-qualification England lookup. **Violated live:** Context at Post-16 blends A level, BTEC and IB rows into one weighted mean (P:1207-1216), and "All subjects" has no family filter (P:1361-1369), e.g. 130432 Computer Science 7.0. Fixing it changes figures, so it is a STOP item |
| 47 | R-KS4-POINTS-GCSE-FULL (Cat §2.1) | Confirmed | Ingest :139-140, 285. The constant `POINTS_BEARING_QUALIFICATION` lives in a **component** (SubjectAreaSection.tsx:151-155) and is imported by P:34 |
| 48 | R-KS5-ASAEA-EXCL incl. open self-inclusion follow-up (Cat §2.1) | Confirmed | UI-only (row 39). Self-inclusion is still open: an AS-only focus is not in its own group (P:1277) |
| 49 | R-KS5-ENGLAND-EXACT (Cat §1, §2.1) | Confirmed | dashboard/route.ts:56-72; subject-geography/route.ts:61-64 |
| 50 | R-MIN-SCHOOLS "benchmark suppressed below the minimum school count" (Cat §1, §2.1) | Partly | Min is 5 for LA/region. **England is exempt (min 1) for points/entries geography and the England anchor, but not for grade-grain geography.** Enforced in vicdata-repo RPCs (…20260926140000…:35,66,90,123; …20260927121000…:50,82); callers pass 1 for national (subject-geography/route.ts:59; dashboard/route.ts:66,74) |
| 51 | R-SINGLE-BUCKET-100 (Cat §1, §2.1) | Partly | Exists as stated, but only in the **Data View** (SubjectAreaSection.tsx:68-100). No Teacher-view path uses it, so it is not one of "the Teacher dashboards' rules" |
| 52 | R-IB-NONSUBJECT (Cat §1, §2.1) | Partly | Ingest `_NON_SUBJECT_ROWS` (academic_aggregates.py:103-135, 446); TS twin dfe-qualification-buckets.ts:246-262. **Fragile:** the raw-facts item list is unfiltered (`parseSubjectEntries`, academic-data-view.ts:1100). It holds only because 2024/25 has no such rows: 83 schools had them in 2023/24, e.g. 118952 with 225 "Baccalaureate" entries (B) |
| 53 | R-FOCUS-NEVER-FILTERED (Cat §2.1) | Confirmed | P:1068-1070, 1141, 1381; XP:254, 276; comparator-series.ts:143, 186 |
| 54 | R-TREND-3YR "trend views need 3+ years; below that, table only" (Cat §1, §2.1; Scope §3 `requires`) | **Corrected** | The live line threshold is **4 years**: `TREND_LINE_MIN_YEARS = 4` (TVP:311). `TREND_MIN_YEARS = 3` (teacher-view-catalogue.ts:24) is the round-5 catalogue, used only by the meetings page. Below 4 years: bars, change list or table, depending on the renderer (row 42). Rename the rule R-TREND-LINE-4YR |
| 55 | R-ZERO-CANDIDATE: special and zero-candidate schools filtered out of comparison populations (Cat §2.1) | **Corrected** | `stagesPresent` (academic-data-view.ts:174-190) applies in the Data View and the dashboard card, **not** in Teacher comparator sets. Special-school matching is in the nearest/comparator RPC migrations. Teacher view only drops comparators with no figure (XP:254, 274-277) |
| 56 | R-POINTS-WEIGHTED (Cat §2.1) | Confirmed | P:1207-1216 (Context, KS5) plus ingest weighting. 130432 Computer Science 13.1 → 7.0 |
| 57 | "These IDs are illustrative; S0 confirms the real list" | Partly | Audit A §2 adds 22 rules found in code: R-DONUT-COUNTS-ONLY, R-NO-GRADE-RATE-GEO, R-BANDS-ENGLAND-BENCH, R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP, R-SELF-INCLUSIVE-GROUP, R-SAME-YEAR-BENCH, R-PREV-YEAR-FALLBACK, R-MEASURE-FALLBACK, R-GEO-APPLIES, R-GEO-POINTS-ELIGIBLE, R-IGCSE-EXCL, R-COMPARATOR-NO-FIGURE, R-COMPARATOR-RATE-PER-QUAL, R-RANKING-SAMPLE, R-PERIOD-TRIM, R-INDEX-HEADCOUNTS, R-RANK-TIES, R-TREND-FLAT-4PCT. It also flags the gap R-NUMBER-TYPE-HONESTY |
| 58 | Results change is shown as "Change in pp (the existing pp-bar)"; the four number types fit counts only (Cat §3) | Partly | **The live code shows % change on points and rates.** Context and Comparisons change lists, tables and summaries use it (SP:910-916, 993-1000; XP:703-711, 762-765), with labels such as "% change in average point score" (TVP:114, 125, 139). pp appears only in the <4-year MultiTrend fallback. Making these honest changes displayed figures, so it is a STOP unless Guy decides |
| 59 | "Diploma total points" keeps its own label (Cat §3) | Partly | No such label in `src/` today. The IB Diploma figure appears in the Data View (AcademicGraphsView.tsx:699; `ibDiplomaHeadline`, academic-data-view.ts:551) |
| 60 | Part D's donut shares "roughly doubling" (Cat §2.6) | Partly | Historical claim, not re-measured. At 102239 the Context group total went 2,480 → 591 (×4.2) and at 100369 it is 471 (Part D report :45-46, :71), so "roughly doubling" understates it at those schools |
| 61 | The NEW pill/notice mechanism from Teacher view brief §13 (Cat §2.6) | Confirmed | P:1595-1600, driven by `last_seen_period` (teacher-view-data.ts:372-389) |

## Measures, data, docs

| # | Claim | Verdict | Correction / evidence |
|---|---|---|---|
| 62 | `entity_keying` is recorded in the schema (Comb C8 / F7) | Partly | It exists as `source_registry.entity_keying` in **vicdata-production**, not in the 0.6 project (vicdata migration 20260719093341:41, CHECK `geography \| urn`). Live values: `urn` (dfe_ks\*, school_census, gias…), `geography` (ons_births, ons_population…) and also **`postcode`** (postcode_geography). Nothing in `src/` reads it |
| 63 | Rolls and Births live in the (advanced) Data View (Scope §8, S0 item D9) | Partly | **Rolls**: yes, in Data View (`components/data-view/RollTrendsChart`, `CombinedRollChart`, `MarketShareTrendChart`, `TargetRollBarChart`; `/api/data-view/schools` → data-view-profiles.ts:256). **Births: not in the Data View or Teacher view.** They appear only on the public school page (schools/[urn]/page.tsx:538 → `components/dashboard/PopulationTrendSection.tsx:154` → BirthsChart). The app reads 2021–2025 only and needs all 5 years (population-trend-lookup.ts:89-117). No region or England births rows |
| 64 | Years available "e.g. 2021/22 → 2024/25" (Cat §2.2) | Partly | Points and headlines: 2021/22–2024/25. Entries: 2020/21–2024/25. **School-level grade measures (Grade 4+, bands, counts): 2023/24–2024/25 only**, read from raw facts, although `academic_subject_grade_rollup` holds 2021–2024 unused (B) |
| 65 | Each measure has "the one data function/RPC every view must go through" (Cat §2.2 "Fetched by") | **Corrected** | No measure has a single fetcher today. Each is reached through 3–5 routes (B §1). Academic data is in **vicdata-production**, read over HTTP (vicdata-reference.ts:27-55), so new academic RPCs belong in the vicdata repo |
| 66 | Three `briefing_*_what_is_measured` docs; a knowledge-and-lessons doc (Cat §2.2, §2.5) | Partly | Only `docs/vicdata_briefing_ks2_what_is_measured_v1.md` is in this repo. GCSE and Post-16 v2 are in `/Users/guy/dev/vicdata/docs/`. No briefing exists for Rolls or Births. No "knowledge-and-lessons" doc was found in either `docs/` |
| 67 | "Mathematical Studies collision in the background aggregate" (Cat §2.2) | Partly | Recorded only in docs (col1 qualification-match build report and prompt). Not re-verified in data |
| 68 | Teacher = academic only (Comb §1; Cat §4.4) | Confirmed | Only KS2's "Year 6 cohort" reads rolls (dashboard/route.ts:149-151) |
| 69 | Tiers free / individual / school single / school all (Cat §4.1) | Partly | Only `school_memberships.individual_tier_active` (bool) exists. No tier gating anywhere |

## Roles, RLS, state, notes, meetings

| # | Claim | Verdict | Correction / evidence |
|---|---|---|---|
| 70 | Every RLS helper is school-scoped (`is_admin_of_school_account` etc.) (Scope §2) | Confirmed | Three helpers: `is_member_of_…`, `is_admin_of_…` and `is_account_holder_of_school_account`, all SQL SECURITY DEFINER (C §8.2; e.g. supabase/migrations/20261102090000_saved_rankings.sql:80) |
| 71 | The VC Sets toggle was worked around with a service-role path (Scope §2; "subsumes the VC Sets toggle") | Partly | There is **no in-app toggle**. It is a local script, `scripts/vc-sets.ts show/hide <urn> <set>`, using `SUPABASE_SERVICE_ROLE_KEY`. The `vc_*` tables are SELECT-only (C §8.3) |
| 72 | "The existing role/school preview switch" / internal "system admin" preview switch (Scope §2) | **Corrected** | There is **no role switch**, and no system-admin identity at all (C §8.4-8.5). There is a *school* switcher, `/api/testing/switch-school`. It is env-flag gated, open to **any signed-in user** when on, and **destructive**: it deletes the caller's memberships and personal saved sets, then makes them admin and holder. `/api/testing/preview-session` is a token-gated magic link |
| 73 | Roles are a single value per person per school; 0.6 migrates to a set (Scope §2) | Confirmed | `school_memberships.role` text, default `teacher`, unique `(school_account_id, profile_id)`. School-Admin is **not a role**: it is `is_admin` plus the account holder plus a guard trigger (C §8.1). Nothing gates on `role` |
| 74 | D1: keep HOD and Finance "in the DB enum" (Scope D1) | **Corrected** | There is no enum type. It is a text column with CHECK in (`teacher`, `hod`, `smt`, `finance`, `admissions`), applied live. `src/lib/roles.ts:8-13` wrongly says the migration hasn't been applied |
| 75 | Teacher is "still the self-select default on join" (Scope §2) | **Corrected** | The join page offers the **old** vocabulary: default `head_governor`, **no `teacher` option** (join/[urn]/page.tsx:6-12). Most choices violate the live CHECK, so `join_school` fails for them; only `admissions` and `finance` succeed. `teacher` is only the column default |
| 76 | Per-user `teacher_view_preferences` state (Scope §5, G1) | Confirmed | PK `(profile_id, school_urn, phase)`. One row is **shared by the Candidates and Results dashboards**. Key list in C §6.1. Focus subject and panel view choices are not persisted |
| 77 | Notes keys (`chart_key`) / "existing personal notes must still resolve after the switch" (Scope §5) | Partly | The current format is `{phase}:{candidates\|context\|rankings}:{current\|trend}` (teacher-view-data.ts:189). That is per panel, not per view, and shared across Candidates and Results. **All 3 live notes are pre-round-8 keys** (`ks4:results:Biology`, `ks5:results`, `ks4:candidates`) and **already render nowhere**. Notes under the pre-merge `change` panel id are also orphaned |
| 78 | G2 premise "notes attach to the view" (Scope G2) | Partly | Today notes attach to the **panel** (ColumnPanels.tsx:28-33). Mapping legacy notes to a single view would be a guess (C §6.3) |
| 79 | Today's Meetings: its page, two tables, `addSlide()` (Scope §7.5) | Partly | It exists: `meetings` and `meeting_slides`, `addSlide` (teacher-view-data.ts:311-357), meetings/page.tsx with Grid/Present (:89-122). Caveats: meetings are **per person** (no `school_urn`). Slide keys are **round-5 catalogue ids**, not today's panels. There is no title or speaker notes (caption only, never set from the UI). **No panel-level add exists.** The one live slide is **already broken** (key without `::`) |
| 80 | Meetings' old delete-by date / Recruitment keeps its delete-by (Scope §7.5) | Partly | Both have `delete_by` (meetings/page.tsx:42, 184; recruitment/page.tsx:44, 131-157). **Nothing enforces either**: there is no pg_cron or job (C §0) |
| 81 | Teacher home: key dashboards (GCSE, Post-16), Recruitment, Meetings (showing the next one); home → phase tile → onboarding → dashboard path (Scope §4.10-4.11) | Partly | Phase tiles plus Recruitment and Meetings HomeCards exist (teacher/page.tsx:112-141). The Meetings tile shows a fixed description, **not the next meeting**. There is no Dashboards library tile. Onboarding exists (`teacher_view_onboarding`, P:117, 178) |

## Biggest corrections for the S1–S3 prompts
1. **Panel unit**: about 351 × 384, 18px gaps plus 2px dividers, one-open accordion. A 3×2 slide at this unit doesn't fit 720px.
2. **Trends**: 4 years for a line, not 3.
3. **Column 1 is not "no comparison"**: it compares with its category peers, England and (on Results) comparator schools. Its % change half is all geography, and the category ChangeList and change table are dead code.
4. **No role or system-admin switch exists**: the school switcher is destructive and open to any signed-in user when its flag is on. The join page can't select `teacher` and fails on most of its options.
5. **Notes**: every live note is already orphaned. Meetings are per person, use round-5 keys, and the one live slide is already broken.
6. **Births**: not in the Data View. `entity_keying` lives in vicdata-production. No measure has a single fetcher.
7. **Number types**: % change is shown on points and rates today. The Grade 4+ area benchmark is derivable from existing data.
