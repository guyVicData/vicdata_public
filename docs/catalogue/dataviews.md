<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Dataviews

The registered recipes the chooser offers and dashboards place, in host then rail order. 114 dataviews: 111 live, 3 draft.

## Summary

| ID | Status | Host / rail | Data | Focus | Compare | Numbers | Date | View | Renderer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DV-C1-CAND-CUR-TILES | live | teacher.c1.candidates · current · (no rail) | academic.candidates | subject | subjects | totals, rank, pct_change | single | numerical | RD-NUMBER-TILES |
| DV-C1-CAND-TR-INDEXED | live | teacher.c1.candidates · trend · Indexed | academic.candidates | subject | subjects | index100 | trend | graph | RD-MULTI-TREND |
| DV-C1-CAND-TR-ACTUAL | live | teacher.c1.candidates · trend · Actual | academic.candidates | subject | subjects | totals | trend | graph | RD-MULTI-TREND |
| DV-C1-CAND-TR-TABLE | live | teacher.c1.candidates · trend · Trend table | academic.candidates | subject | subjects | totals, pct_change | trend | table | RD-YEAR-TABLE |
| DV-C1-CAND-TR-GEO-CHART | live | teacher.c1.candidates · trend · Area chart | academic.candidates | subject | averages | index100 | trend | graph | RD-GEOGRAPHY-VIEW |
| DV-C1-CAND-TR-GEO-TABLE | live | teacher.c1.candidates · trend · Change table | academic.candidates | subject | averages | totals, pct_change | trend | table | RD-GEOGRAPHY-VIEW |
| DV-C1-CAND-TR-CHANGELIST | draft | teacher.c1.candidates · trend · (no rail) | academic.candidates | subject | subjects | pct_change | trend | ranking | RD-CHANGE-LIST |
| DV-C1-CAND-TR-CHANGETABLE | draft | teacher.c1.candidates · trend · (no rail) | academic.candidates | subject | subjects | totals, pct_change | trend | table | RD-YEAR-TABLE |
| DV-C1-RES-CUR-TILES | live | teacher.c1.results · current · Number tiles | academic.results (points, threshold, bands) | subject | subjects, averages | points, rate, rank, change_points, change_pp, totals | single | numerical | RD-NUMBER-TILES |
| DV-C1-RES-CUR-GRADES | live | teacher.c1.results · current · Grade distribution | academic.results (bands) | subject | averages | rate | single | graph | RD-GRADE-DISTRIBUTION |
| DV-C1-RES-CUR-BAR | live | teacher.c1.results · current · Bar chart | academic.results (points, threshold, bands) | subject | subjects, averages | points, rate | single | ranking | RD-VIEW-CHART |
| DV-C1-RES-CUR-TABLE | live | teacher.c1.results · current · Sortable table | academic.results (points, threshold, bands) | subject | subjects, averages | points, rate, change_points, change_pp | single | table | RD-SORT-TABLE |
| DV-C1-RES-TR-CHART | live | teacher.c1.results · trend · Chart | academic.results (points, threshold, bands) | subject | subjects | points, rate, change_points, change_pp | trend | graph | RD-MULTI-TREND |
| DV-C1-RES-TR-TABLE | live | teacher.c1.results · trend · Trend table | academic.results (points, threshold, bands) | subject | subjects | points, rate, change_points, change_pp | trend | table | RD-YEAR-TABLE |
| DV-C1-RES-TR-MAP | live | teacher.c1.results · trend · Map | academic.results (points, threshold, bands) | subject | schools | points | single | map | RD-RANKINGS-MAP |
| DV-C1-RES-TR-GEO-CHART | live | teacher.c1.results · trend · Area chart | academic.results (points) | subject | averages | points | trend | graph | RD-GEOGRAPHY-VIEW |
| DV-C1-RES-TR-GEO-TABLE | live | teacher.c1.results · trend · Change table | academic.results (points) | subject | averages | points, change_points | trend | table | RD-GEOGRAPHY-VIEW |
| DV-C1-CNT-CUR-DIST | live | teacher.c1.counts · current · (no rail) | academic.results (counts) | subject | averages | totals, rate | single | graph | RD-GRADE-DISTRIBUTION |
| DV-C1-CNT-TR-SPREAD | live | teacher.c1.counts · trend · Spread by year | academic.results (counts) | subject | none | totals, rate | trend | graph | RD-GRADE-DISTRIBUTION |
| DV-C1-CNT-TR-CHANGETABLE | live | teacher.c1.counts · trend · Change table | academic.results (counts) | subject | none | totals | trend | table | RD-YEAR-TABLE |
| DV-C2-CUR-DONUT | live | teacher.c2.context · current · Share (donut) | academic.candidates, academic.results (bands) | subject | subjects | market_share | single | donut | RD-SHARE-DONUT |
| DV-C2-CUR-BARS | live | teacher.c2.context · current · Bar chart | academic.candidates, academic.results (points, threshold, bands) | subject | subjects | totals, points, rate | single | ranking | RD-VERTICAL-BARS |
| DV-C2-CUR-LIST | live | teacher.c2.context · current · Ranked list | academic.candidates, academic.results (points, threshold, bands) | subject | subjects | totals, points, rate, rank | single | ranking | RD-RANKED-LIST |
| DV-C2-CUR-TABLE | live | teacher.c2.context · current · Sortable table | academic.candidates, academic.results (points, threshold, bands) | subject | subjects | rank, totals, change_points, change_pp | single | table | RD-SORT-TABLE |
| DV-C2-TR-INDEXED | live | teacher.c2.context · trend · Indexed | academic.candidates | subject | subjects | index100 | trend | graph | RD-MULTI-TREND |
| DV-C2-TR-CHART | live | teacher.c2.context · trend · Chart | academic.results (points, threshold, bands) | subject | subjects | points, rate, change_points, change_pp | trend | graph | RD-MULTI-TREND |
| DV-C2-TR-ACTUAL | live | teacher.c2.context · trend · Actual | academic.candidates | subject | subjects | totals | trend | graph | RD-MULTI-TREND |
| DV-C2-TR-TABLE | live | teacher.c2.context · trend · Trend table | academic.candidates, academic.results (points, threshold, bands) | subject | subjects | totals, points, rate | trend | table | RD-YEAR-TABLE |
| DV-C2-TR-CHANGELIST | live | teacher.c2.context · trend · Ranked change | academic.candidates, academic.results (points, threshold, bands) | subject | subjects | pct_change, change_points, change_pp | trend | ranking | RD-CHANGE-LIST |
| DV-C2-TR-CHANGETABLE | live | teacher.c2.context · trend · Change table | academic.candidates, academic.results (points, threshold, bands) | subject | subjects | totals, points, rate, pct_change, change_points, change_pp | trend | table | RD-YEAR-TABLE |
| DV-C3-CUR-TILES | live | teacher.c3.comparisons · current · Number tiles | academic.candidates, academic.results (points, threshold, bands, counts) | school | schools | points, rank | single | numerical | RD-NUMBER-TILES |
| DV-C3-CUR-MAP | live | teacher.c3.comparisons · current · Map | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | points, totals | single | map | RD-RANKINGS-MAP |
| DV-C3-CUR-BAR | live | teacher.c3.comparisons · current · Bar chart | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | points, rate, totals | single | ranking | RD-VIEW-CHART |
| DV-C3-CUR-RANKING | live | teacher.c3.comparisons · current · Ranking | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | points, rate, totals, rank | single | table | RD-SCHOOL-RANKING-TABLE |
| DV-C3-TR-CHART | live | teacher.c3.comparisons · trend · Chart | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | points, rate, totals | trend | graph | RD-TREND-CHART |
| DV-C3-TR-TABLE | live | teacher.c3.comparisons · trend · Trend table | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | totals, points, rate | trend | table | RD-YEAR-TABLE |
| DV-C3-TR-MAP | live | teacher.c3.comparisons · trend · Trend map | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | change_points, change_pp, totals | trend | map | RD-RANKINGS-MAP |
| DV-C3-TR-CHANGELIST | live | teacher.c3.comparisons · trend · Ranked bars | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | pct_change, change_points, change_pp | trend | ranking | RD-CHANGE-LIST |
| DV-C3-TR-CHANGETABLE | live | teacher.c3.comparisons · trend · Change table | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | totals, points, rate, pct_change, change_points, change_pp | trend | table | RD-YEAR-TABLE |
| DV-C3-TR-CHANGEMAP | live | teacher.c3.comparisons · trend · Change map | academic.candidates, academic.results (points, threshold, bands) | subject, school | schools | pct_change, change_points, change_pp | trend | map | RD-RANKINGS-MAP |
| DV-ADM-P-NOW | live | admissions.pipelines · current · Entry point now | admissions.pupils | entry_point | none | totals, pct_change | single | numerical | RD-ADM-TILES |
| DV-ADM-P-PIPELINE | live | admissions.pipelines · current · Pipeline | admissions.pipeline | entry_point | schools | totals, pct_change | trend | graph | RD-ADM-PIPELINE |
| DV-ADM-P-FUNNEL | live | admissions.pipelines · current · Why did our intake change? | admissions.pipeline | entry_point | none | totals, pct_change | trend | graph | RD-ADM-FUNNEL |
| DV-ADM-P-BIRTHS | live | admissions.pipelines · current · Local births | admissions.pipeline | entry_point | averages | index100 | trend | graph | RD-ADM-BIRTHS |
| DV-ADM-P-MAP | live | admissions.pipelines · current · Map of feeders | admissions.pipeline | entry_point | schools | totals, pct_change | single | map | RD-ADM-MAP |
| DV-ADM-P-TABLE | live | admissions.pipelines · current · Feeder table | admissions.pipeline | entry_point | schools | totals, pct_change | single | table | RD-ADM-TABLE |
| DV-ADM-P-SHAPE | live | admissions.pipelines · current · Shape and size | admissions.pupils | entry_point | schools | totals | single | graph | RD-ADM-SHAPES |
| DV-ADM-P-ENTRY-LINE | live | admissions.pipelines · trend · Your cohort | admissions.pupils | entry_point | none | totals | trend | graph | RD-ADM-LINE |
| DV-ADM-P-ENTRY-BARS | live | admissions.pipelines · trend · Your cohort, bars | admissions.pupils | entry_point | none | totals | trend | graph | RD-ADM-BARS |
| DV-ADM-P-ENTRY-TABLE | live | admissions.pipelines · trend · Your cohort, table | admissions.pupils | entry_point | none | totals | trend | table | RD-ADM-TABLE |
| DV-ADM-P-ENTRY-SEX | live | admissions.pipelines · trend · Your cohort, girls and boys | admissions.pupils | entry_point | none | totals | trend | graph | RD-ADM-LINE |
| DV-ADM-P-POOL-INDEXED | live | admissions.pipelines · trend · Pool trends | admissions.pupils | entry_point | schools, averages | index100 | trend | graph | RD-ADM-LINE |
| DV-ADM-P-POOL-TABLE | live | admissions.pipelines · trend · Pool trends, table | admissions.pupils | entry_point | schools, averages | totals, index100 | trend | table | RD-ADM-TABLE |
| DV-ADM-P-AREA-POP | live | admissions.pipelines · trend · Area population | admissions.pupils | entry_point | averages | totals | single | graph | RD-ADM-BARS |
| DV-ADM-P-HOLD-LINE | live | admissions.pipelines · trend · Share needed | admissions.pipeline | entry_point | schools | market_share | trend | graph | RD-ADM-LINE |
| DV-ADM-P-HOLD-TABLE | live | admissions.pipelines · trend · Share needed, table | admissions.pipeline | entry_point | schools | market_share, totals | trend | table | RD-ADM-TABLE |
| DV-ADM-M-NOW | live | admissions.market · current · Your place now | admissions.market | entry_point | schools | rank, market_share, change_pp | single | numerical | RD-ADM-TILES |
| DV-ADM-M-DONUT | live | admissions.market · current · Share (donut) | admissions.market | entry_point | schools | market_share | single | donut | RD-ADM-DONUT |
| DV-ADM-M-BARS | live | admissions.market · current · Ranked bars | admissions.market | entry_point | schools | totals, market_share, rank | single | ranking | RD-ADM-BARS |
| DV-ADM-M-MAP | live | admissions.market · current · Map of rivals | admissions.market | entry_point | schools | totals, market_share | single | map | RD-ADM-MAP |
| DV-ADM-M-TABLE | live | admissions.market · current · Rivals table | admissions.market | entry_point | schools | totals, market_share, rank | single | table | RD-ADM-TABLE |
| DV-ADM-M-MOMENTUM | live | admissions.market · current · Rivals' momentum | admissions.rivals | entry_point | schools | pct_change, change_points | trend | graph | RD-ADM-SCATTER |
| DV-ADM-M-STRENGTHS | live | admissions.market · current · Strengths and weaknesses | admissions.rivals | entry_point | schools | points, change_points, rank | single | graph | RD-ADM-STRENGTHS |
| DV-ADM-M-SHAPE | live | admissions.market · current · Rivals' shapes | admissions.pupils | entry_point | schools | totals | single | graph | RD-ADM-SHAPES |
| DV-ADM-M-FLAGS | live | admissions.market · current · Flags | admissions.rivals | entry_point | schools | pct_change, change_points | trend | table | RD-ADM-FLAGS |
| DV-ADM-M-VS-LINE | live | admissions.market · trend · You and the rivals | admissions.market | entry_point | schools | index100 | trend | graph | RD-ADM-LINE |
| DV-ADM-M-VS-BARS | live | admissions.market · trend · You and the rivals, bars | admissions.market | entry_point | schools | totals | trend | graph | RD-ADM-BARS |
| DV-ADM-M-ACAD-RANK | live | admissions.market · trend · Academic ranking | admissions.rivals | entry_point | schools | rank, change_points | single | ranking | RD-ADM-STRENGTHS |
| DV-ADM-M-ACAD-NUM | live | admissions.market · trend · Academic numbers | admissions.rivals | entry_point | schools | points, rank | single | table | RD-ADM-TABLE |
| DV-ADM-M-ACAD-CHANGE | live | admissions.market · trend · Academic change | admissions.rivals | entry_point | schools | change_points | trend | graph | RD-ADM-BARS |
| DV-ADM-M-SHARE-LINE | live | admissions.market · trend · Market share | admissions.market | entry_point | schools | market_share | trend | graph | RD-ADM-LINE |
| DV-ADM-M-SHARE-NUM | live | admissions.market · trend · Market share numbers | admissions.market | entry_point | schools | totals, market_share | trend | table | RD-ADM-TABLE |
| DV-ADM-M-SHARE-RANKS | live | admissions.market · trend · Market share ranks | admissions.market | entry_point | schools | rank | trend | table | RD-ADM-TABLE |
| DV-ADM-M-SHARE-CHANGE | live | admissions.market · trend · Change in share | admissions.market | entry_point | schools | pct_change, change_pp | trend | graph | RD-ADM-BARS |
| DV-ADM-M-ROLL-LINE | live | admissions.market · trend · Entry age band roll | admissions.market | entry_point | schools | index100 | trend | graph | RD-ADM-LINE |
| DV-ADM-M-SHARE-BAND | live | admissions.market · trend · Share of Years 7–11 | admissions.market | entry_point | schools | market_share | trend | graph | RD-ADM-LINE |
| DV-SMT-O-NOW | live | smt.overview · current · The school now | smt.school | level | schools, averages | totals, pct_change, rank | single | numerical | RD-SMT-NOW |
| DV-SMT-O-SCORECARD | live | smt.overview · current · Scorecard | smt.results | level | schools, averages | points, rank, change_points | single | table | RD-SMT-SCORECARD |
| DV-SMT-O-MAP | live | smt.overview · current · Map | smt.school | level | schools | totals | single | map | RD-SMT-MAP |
| DV-SMT-O-FLAGS | live | smt.overview · current · Flags | smt.school | level | schools | pct_change, change_points | trend | table | RD-SMT-FLAGS |
| DV-SMT-O-ROLL-LINE | live | smt.overview · trend · Roll, indexed | smt.school | level | averages | index100 | trend | graph | RD-SMT-LINE |
| DV-SMT-O-ROLL-TABLE | live | smt.overview · trend · Roll, table | smt.school | level | averages | totals, index100 | trend | table | RD-SMT-TABLE |
| DV-SMT-O-RESULTS-LINE | live | smt.overview · trend · Results trend | smt.results | level | schools | points | trend | graph | RD-SMT-LINE |
| DV-SMT-O-RESULTS-TABLE | live | smt.overview · trend · Results, table | smt.results | level | schools | points | trend | table | RD-SMT-TABLE |
| DV-SMT-O-MARKET-LINE | live | smt.overview · trend · Market share | smt.school | level | schools | market_share | trend | graph | RD-SMT-LINE |
| DV-SMT-O-MARKET-TABLE | live | smt.overview · trend · Market share, table | smt.school | level | schools | market_share | trend | table | RD-SMT-TABLE |
| DV-SMT-A-NOW | live | smt.academic · current · The level now | smt.results | level | schools | totals, points, rank | single | numerical | RD-SMT-NOW |
| DV-SMT-A-AREAS | live | smt.academic · current · Subject areas | smt.subjects | level | schools | points, change_points, rank | single | graph | RD-SMT-AREAS |
| DV-SMT-A-SUBJECTS | live | smt.academic · current · Subjects | smt.subjects | level | schools | totals, points, rank, change_points | single | table | RD-SMT-SUBJECTS |
| DV-SMT-A-VA | live | smt.academic · current · Value added | smt.value_added | level | none | points | single | table | RD-SMT-VA |
| DV-SMT-A-GRADES | live | smt.academic · current · Grade profile | smt.subjects | level | none | totals | single | graph | RD-SMT-GRADES |
| DV-SMT-A-TREND-LINE | live | smt.academic · trend · Results trend | smt.results | level | schools | points | trend | graph | RD-SMT-LINE |
| DV-SMT-A-TREND-TABLE | live | smt.academic · trend · Results, table | smt.results | level | schools | points | trend | table | RD-SMT-TABLE |
| DV-SMT-A-BANDS | draft | smt.academic · trend · Results by band | smt.results | level | none | points | trend | graph | RD-SMT-RESERVED |
| DV-SMT-A-MIX | live | smt.academic · trend · Entries mix | smt.subjects | level | none | totals | trend | graph | RD-SMT-MIX |
| DV-SMT-A-MIX-TABLE | live | smt.academic · trend · Entries mix, table | smt.subjects | level | none | totals | trend | table | RD-SMT-TABLE |
| DV-SMT-P-NOW | live | smt.pupils · current · Your pupils now | smt.school | level | averages | totals, pct_change | single | numerical | RD-SMT-NOW |
| DV-SMT-P-SHAPE | live | smt.pupils · current · Shape and size | smt.school | level | schools | totals | single | graph | RD-SMT-SHAPE |
| DV-SMT-P-ENTRIES | live | smt.pupils · current · Entry points | smt.school | level | none | totals | single | table | RD-SMT-ENTRIES |
| DV-SMT-P-LEAVING | live | smt.pupils · current · Leaving at 16 | smt.school | level | none | totals, pct_change | trend | table | RD-SMT-LEAVING |
| DV-SMT-P-MARKET | live | smt.pupils · current · Market share | smt.school | level | schools | market_share | trend | graph | RD-SMT-LINE |
| DV-SMT-P-PHASES | live | smt.pupils · trend · Roll by phase | smt.school | level | averages | index100 | trend | graph | RD-SMT-LINE |
| DV-SMT-P-PHASES-TABLE | live | smt.pupils · trend · Roll by phase, table | smt.school | level | averages | index100 | trend | table | RD-SMT-TABLE |
| DV-SMT-P-POOL | live | smt.pupils · trend · The pool | smt.school | level | none | totals | trend | graph | RD-SMT-LINE |
| DV-SMT-P-AREA | live | smt.pupils · trend · School-age population | smt.school | level | averages | totals | trend | graph | RD-SMT-LINE |
| DV-SMT-C-NOW | live | smt.context · current · The area now | smt.area | level | averages | totals, pct_change | single | numerical | RD-SMT-NOW |
| DV-SMT-C-MAP | live | smt.context · current · Map | smt.area | level | averages | totals | single | map | RD-SMT-AREA-MAP |
| DV-SMT-C-BYAGE | live | smt.context · current · Population by age | smt.area | level | none | totals | single | graph | RD-SMT-AGES |
| DV-SMT-C-BIRTHS | live | smt.context · current · Births and projections | smt.area | level | averages | totals | trend | graph | RD-SMT-LINE |
| DV-SMT-C-NEARBY | live | smt.context · current · Children nearby over time | smt.area | level | averages | index100 | trend | graph | RD-SMT-NEARBY |
| DV-SMT-C-BIRTHS-INDEXED | live | smt.context · trend · Births, indexed | smt.area | level | averages | index100 | trend | graph | RD-SMT-LINE |
| DV-SMT-C-BIRTHS-TABLE | live | smt.context · trend · Births, table | smt.area | level | averages | totals, index100 | trend | table | RD-SMT-TABLE |
| DV-SMT-C-PROJECTION | live | smt.context · trend · Projection | smt.area | level | none | totals | trend | graph | RD-SMT-LINE |
| DV-SMT-C-AGES | live | smt.context · trend · By single year of age | smt.area | level | none | totals | single | graph | RD-SMT-AGES |

## Cards

### DV-C1-CAND-CUR-TILES — Number tiles

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, rank, pct_change |
| Date mode | single |
| View type | numerical |
| Renderer | RD-NUMBER-TILES |
| Title template | [subject] Candidates: [year] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | — |
| Rail icon | TilesIcon |
| Host | teacher.c1.candidates, current, rail "(none)" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Current panel rework round 1 (Column 1 Current is Number tiles only) |
| Rules | R-FOCUS-NEVER-FILTERED, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP, R-RANK-TIES |
| Used on | GCSE Candidates › Candidates › Current, Post-16 Candidates › Candidates › Current |
| Note | Railless: Column 1 Candidates' Current has no rail. Tiles: entries, rank in category (only if >1 subject), rank of N subjects at school, change. |
| Method | 1. We take the school's entries for each subject in the latest year. At GCSE this is every qualification in the subject added together; at Post-16 it is the entries for the one qualification you chose (for example A-level Biology).<br>2. The main figure is the number of entries in your subject that year.<br>3. We rank your subject against the other subjects at the school in the same subject category and qualification family, largest first. Subjects with the same number share a place.<br>4. We also rank it against every subject the school runs that year.<br>5. The change tile compares your subject's entries in the latest year with its first published year, as a percentage.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page)<br>Rounding: Entries are whole numbers. The change is a whole percentage. Ties share a rank and the next rank is skipped. |

### DV-C1-CAND-TR-INDEXED — Indexed

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-MULTI-TREND |
| Title template | Entries in [category] |
| Title fallback | TrendScaleTitle only (indexed): 'Change since [first year]: each line starts at 100 (no change); 110 = 10% more entries, 90 = 10% fewer.' |
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. |
| Params | trendStart, showFit |
| Rail icon | IndexedLineIcon |
| Host | teacher.c1.candidates, trend, rail "Indexed" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign (option D2); trends row merge round |
| Rules | R-TREND-LINE-4YR, R-INDEX-HEADCOUNTS, R-PERIOD-TRIM, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP |
| Used on | GCSE Candidates › Candidates › Trends, Post-16 Candidates › Candidates › Trends |
| Note | — |
| Method | 1. We take the school's entries for your subject and for the other subjects in its subject category and qualification family, for every year published (at GCSE all qualifications in a subject added together; at Post-16 the one qualification).<br>2. Years at the start or end with no figure for any subject are dropped; you can start the view at a later year with the 'From' menu.<br>3. Each subject's line is set to 100 in its own first year with entries, and later years are shown against that (110 means 10% more entries).<br>4. A line is drawn only with 4 or more years. With fewer, each subject's change in entries from its first to its last year is shown as ranked bars.<br>5. The words under the chart describe your subject's change from its first to its last year: within 4% either way it is 'broadly stable'.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page)<br>Rounding: Index values are whole numbers. The percentage in the trend sentence is a whole number. Within ±4% the trend reads 'Broadly stable'. |

### DV-C1-CAND-TR-ACTUAL — Actual

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-MULTI-TREND |
| Title template | Entries in [category] |
| Title fallback | TrendScaleTitle only (actual): 'Entries each year, real numbers: one scale for every subject, so small ones sit low.' |
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. The Actual button is disabled with no line. |
| Params | trendStart, showFit |
| Rail icon | TrendLineIcon |
| Host | teacher.c1.candidates, trend, rail "Actual" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Column 1 qualification match / trend actual numbers round |
| Rules | R-TREND-LINE-4YR, R-PERIOD-TRIM, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP |
| Used on | GCSE Candidates › Candidates › Trends, Post-16 Candidates › Candidates › Trends |
| Note | — |
| Method | 1. We take the school's entries for your subject and for the other subjects in its subject category and qualification family, for every year published (at GCSE all qualifications in a subject added together; at Post-16 the one qualification).<br>2. Years at the start or end with no figure for any subject are dropped; you can start the view at a later year with the 'From' menu.<br>3. Each subject is drawn at its real number of entries each year, all on one scale.<br>4. This view is only offered with 4 or more years of entries; with fewer the button is switched off.<br>5. The words under the chart describe your subject's change from its first to its last year: within 4% either way it is 'broadly stable'.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page)<br>Rounding: Entries are whole numbers. The percentage in the trend sentence is a whole number. |

### DV-C1-CAND-TR-TABLE — Trend table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, pct_change |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | Entries in [category], year by year |
| Title fallback | [subject], year by year |
| Requires (card warning) | — |
| Params | trendStart |
| Rail icon | TableIcon |
| Host | teacher.c1.candidates, trend, rail "Trend table" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign (options E, I); trends row merge round |
| Rules | R-PERIOD-TRIM, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP |
| Used on | GCSE Candidates › Candidates › Trends, Post-16 Candidates › Candidates › Trends |
| Note | — |
| Method | 1. We take the school's entries for your subject and for the other subjects in its subject category and qualification family, for every year published (at GCSE all qualifications in a subject added together; at Post-16 the one qualification).<br>2. Years at the start or end with no figure for any subject are dropped; you can start the view at a later year with the 'From' menu.<br>3. Each subject is one row with its entries in each year.<br>4. The change column is the difference between the first and last years with a figure, in entries, with the percentage change beneath it.<br>5. Rows are listed by the latest year's entries, largest first (you can re-sort); full screen adds each subject's rank.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page)<br>Rounding: Entries are whole numbers. The percentage change is a whole number. |

### DV-C1-CAND-TR-GEO-CHART — Area chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-GEOGRAPHY-VIEW |
| Title template | [subject] against its LA and England, year by year |
| Title fallback | Plain heading (not ViewTitle), with TrendScaleTitle indexed under it. |
| Requires (card warning) | GCSE (9-1) Full Course items only at GCSE (area entries are points-eligible entries); LA and England lines (region in the table). |
| Params | trendStart |
| Rail icon | TrendLineIcon |
| Host | teacher.c1.candidates, trend, rail "Area chart" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Candidates live review Part 5; trends row merge round |
| Rules | R-GEO-APPLIES, R-GEO-POINTS-ELIGIBLE, R-MIN-SCHOOLS, R-KS5-ENGLAND-EXACT, R-INDEX-HEADCOUNTS |
| Used on | GCSE Candidates › Candidates › Trends, Post-16 Candidates › Candidates › Trends |
| Note | Placement mismatch F2: Column 1 declares subjects-in-school only; the seeded Column 1 Trends panel carries an override (LA, region, England). |
| Method | 1. We take your school's points-eligible entries in the subject each year: its entries multiplied by the share of them that carry points, rounded to a whole number.<br>2. We take the same count for every school in your local authority, your region and England, added together (at Post-16 for the same exact qualification).<br>3. We keep only the years that have an area figure, within the span you have chosen.<br>4. Each line is set to 100 in its first year, so the school, its local authority and England can be compared on one scale (110 means 10% more entries).<br>5. The region's line is left off the chart because it runs almost on top of England's.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page); LA, region and England figures: VicData's area totals from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England); Post-16: VicData's area averages (DfE school results added up for the LA, region and England)), 2021/22 to the latest year held<br>Rounding: Points-eligible entries are rounded to whole numbers. Index values are whole numbers. |

### DV-C1-CAND-TR-GEO-TABLE — Change table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | averages |
| Number types | totals, pct_change |
| Date mode | trend |
| View type | table |
| Renderer | RD-GEOGRAPHY-VIEW |
| Title template | [subject]: change against its LA, region and England |
| Title fallback | — |
| Requires (card warning) | GCSE (9-1) Full Course items only at GCSE (area entries are points-eligible entries). |
| Params | changeStart |
| Rail icon | TableIcon |
| Host | teacher.c1.candidates, trend, rail "Change table" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Candidates live review Part 5; trends row merge round |
| Rules | R-GEO-APPLIES, R-GEO-POINTS-ELIGIBLE, R-MIN-SCHOOLS, R-KS5-ENGLAND-EXACT |
| Used on | GCSE Candidates › Candidates › Trends, Post-16 Candidates › Candidates › Trends |
| Note | Placement mismatch F2 (as Area chart). |
| Method | 1. We take your school's points-eligible entries in the subject each year: its entries multiplied by the share of them that carry points, rounded to a whole number.<br>2. We take the same count for every school in your local authority, your region and England, added together (at Post-16 for the same exact qualification).<br>3. We keep only the years that have an area figure, within the span you have chosen.<br>4. Each place is one row with its count in each year.<br>5. The change column shows the percentage change from the first to the last year with a figure, with the change in entries beneath it.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page); LA, region and England figures: VicData's area totals from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England); Post-16: VicData's area averages (DfE school results added up for the LA, region and England)), 2021/22 to the latest year held<br>Rounding: Points-eligible entries are rounded to whole numbers. The percentage change is a whole number. |

### DV-C1-CAND-TR-CHANGELIST — Ranked change

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | pct_change |
| Date mode | trend |
| View type | ranking |
| Renderer | RD-CHANGE-LIST |
| Title template | Entries in [category]: % change since [year], ranked |
| Title fallback | Entries: % change since [year] |
| Requires (card warning) | — |
| Params | changeStart |
| Rail icon | HorizontalBarsIcon |
| Host | teacher.c1.candidates, trend, rail "(none)" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic |
| Status | draft |
| Verified at | not yet |
| Origin | Trend & % change redesign |
| Rules | R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH |
| Used on | not placed |
| Note | Dead branch (audit A §0.5): Column 1's % change half is always the geography view, so CandidatesPanels.tsx:404-417 is unreachable. |
| Method | 1. We take each subject's entries in its category for every published year.<br>2. Each subject's change is its percentage change from its first to its last year with a figure.<br>3. Subjects are ranked by that change, biggest rise first.<br>4. The category average (the plain average of the subjects' entries each year, your subject included) is drawn as a dashed reference line.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page)<br>Rounding: The percentage change is a whole number. |

### DV-C1-CAND-TR-CHANGETABLE — Change table (category)

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, pct_change |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | Entries in [category]: [year] against the latest year, with the change |
| Title fallback | Entries by year, since [year] |
| Requires (card warning) | — |
| Params | changeStart |
| Rail icon | TableIcon |
| Host | teacher.c1.candidates, trend, rail "(none)" (src/components/teacher/CandidatesPanels.tsx) |
| Audience | subject-level, academic |
| Status | draft |
| Verified at | not yet |
| Origin | Trend & % change redesign |
| Rules | R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH |
| Used on | not placed |
| Note | Dead branch (audit A §0.5): CandidatesPanels.tsx:393-403 is unreachable. |
| Method | 1. We take each subject's entries in its category for every published year.<br>2. Each subject's change is its percentage change from its first to its last year with a figure.<br>3. Each subject is one row with its first and latest year's entries and the change between them.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Post-16 page)<br>Rounding: The percentage change is a whole number. |

### DV-C1-RES-CUR-TILES — Number tiles

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects, averages |
| Number types | points, rate, rank, change_points, change_pp, totals |
| Date mode | single |
| View type | numerical |
| Renderer | RD-NUMBER-TILES |
| Title template | (none) |
| Title fallback | None: the wrapper title is suppressed for tiles (SubjectPanels.tsx:1042). |
| Requires (card warning) | England average and gap tiles only with a same-year England figure: points (and bands, from grade geography); threshold shows the rank tile only. |
| Params | band:range |
| Rail icon | TilesIcon |
| Host | teacher.c1.results, current, rail "Number tiles" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 6; grade bands frontend round (bands variant) |
| Rules | R-SAME-YEAR-BENCH, R-NO-GRADE-RATE-GEO, R-BANDS-ENGLAND-BENCH, R-NON-GRADES-EXCL, R-RANK-TIES, R-KS5-ENGLAND-EXACT |
| Used on | GCSE Results › Results › Current, Post-16 Results › Results › Current |
| Note | One dataview for the audit's two rows (plain and bands variant): on bands the tiles are met count 'of {n} graded entries at {range}', rate and England gap (placement mismatch M3/M5). |
| Method | 1. The main figure is your subject's result in the latest year: average points per entry, the share of graded entries at grade 4 or above (A*–E at Post-16), or the share inside your chosen grade band.<br>2. Average points at GCSE come from GCSE (9-1) Full Course entries, and a GCSE Double Award from its own grades (two entries, each the average of its two grades); at Post-16 from the one qualification you chose, on DfE's points table.<br>3. On Average points and Grade 4+: your subject's rank among the subjects in its category at the school, highest first (ties share a place).<br>4. On Average points: England's average for the same subject (Post-16: same subject and qualification) in the same year, and the gap between yours and England's.<br>5. On Grade bands: how many of your graded entries fall in the band, England's share in the band for the same subject and qualification that year, and the gap.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E and Grade bands); England figure: VicData's national total from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England) per subject; Post-16: VicData's area averages (DfE school results added up for the LA, region and England) per subject and exact qualification) (Average points); England grade shares: VicData's national grade totals from the same DfE files (VicData's area averages (DfE school results added up for the LA, region and England)) (Grade bands, focused subject only)<br>Rounding: Average points to 1 decimal place. Rates and shares as whole percentages; gaps on rates in whole percentage points. A gap that rounds to nothing reads 'level with England'. |

### DV-C1-RES-CUR-GRADES — Grade distribution

| Field | Content |
| --- | --- |
| Measures | M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | averages |
| Number types | rate |
| Date mode | single |
| View type | graph |
| Renderer | RD-GRADE-DISTRIBUTION |
| Title template | (none) |
| Title fallback | None (wrapper suppressed). The picked band is shaded; with no range picked, nothing is shaded. |
| Requires (card warning) | School grades are published from 2021/22 (4 years; 0.6.2). |
| Params | band:range |
| Rail icon | GradesIcon |
| Host | teacher.c1.results, current, rail "Grade distribution" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Grade bands frontend round; 0.6.1 S5 (D3: the range is picked in the top bar, no longer by clicking two grades here) |
| Rules | R-NON-GRADES-EXCL, R-GRADE-SCALE-MATCH, R-BANDS-ENGLAND-BENCH, R-MIN-SCHOOLS |
| Used on | GCSE Results › Results › Current, Post-16 Results › Results › Current |
| Note | England share ticks per grade (placement mismatch M5). Was 'Grades (pick a range)': since 0.6.1 S5 a read-only grade distribution with the top bar's band shaded. |
| Method | 1. We take your school's number of entries at each grade in the subject and qualification for the latest year.<br>2. Each grade's bar is its count as a share of all graded entries.<br>3. Beside each grade, a tick shows England's share of its graded entries at that grade, for the same subject and qualification in the same year.<br>4. The grade band you picked in the top bar is shaded.<br>Sources: DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held; England grade shares: VicData's national grade totals from the same DfE files (VicData's area averages (DfE school results added up for the LA, region and England))<br>Rounding: Shares as whole percentages; counts as whole numbers. |

### DV-C1-RES-CUR-BAR — Bar chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects, averages |
| Number types | points, rate |
| Date mode | single |
| View type | ranking |
| Renderer | RD-VIEW-CHART |
| Title template | Results in [category] |
| Title fallback | None when the category has one subject (plain p, not ViewTitle). |
| Requires (card warning) | National average marker only where a same-year England figure exists (not on Grade 4+ / A*-E). |
| Params | band:range |
| Rail icon | HorizontalBarsIcon |
| Host | teacher.c1.results, current, rail "Bar chart" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 6 |
| Rules | R-SAME-YEAR-BENCH, R-NO-GRADE-RATE-GEO, R-KS5-ENGLAND-EXACT, R-QUAL-FAMILY-MATCH, R-KS5-ASAEA-EXCL, R-KS4-SUBJECT-DEDUP |
| Used on | GCSE Results › Results › Current, Post-16 Results › Results › Current |
| Note | — |
| Method | 1. We take each subject's result in the latest year: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. Subjects are drawn largest first, with your subject highlighted.<br>3. On Average points each subject carries a marker for England's average in the same subject (Post-16: same qualification) for the same year.<br>4. On Grade bands only your subject carries England's share in the band; on Grade 4+ / A*–E there is no England marker.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E and Grade bands); England figure: VicData's national total from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England) per subject; Post-16: VicData's area averages (DfE school results added up for the LA, region and England) per subject and exact qualification) (Average points); England grade shares: VicData's national grade totals from the same DfE files (VicData's area averages (DfE school results added up for the LA, region and England)) (Grade bands, focused subject only)<br>Rounding: Average points to 1 decimal place. Rates and shares as whole percentages. |

### DV-C1-RES-CUR-TABLE — Sortable table

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects, averages |
| Number types | points, rate, change_points, change_pp |
| Date mode | single |
| View type | table |
| Renderer | RD-SORT-TABLE |
| Title template | Results in [category] |
| Title fallback | None when the category has one subject. |
| Requires (card warning) | Delta column is 'vs National' with an England figure, else 'vs last year'. |
| Params | sort, band:range |
| Rail icon | RankListIcon |
| Host | teacher.c1.results, current, rail "Sortable table" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 6 |
| Rules | R-PREV-YEAR-FALLBACK, R-SAME-YEAR-BENCH, R-NO-GRADE-RATE-GEO, R-KS5-ENGLAND-EXACT, R-QUAL-FAMILY-MATCH |
| Used on | GCSE Results › Results › Current, Post-16 Results › Results › Current |
| Note | — |
| Method | 1. We take each subject's result in the latest year.<br>2. On Average points the third column is each subject's result minus England's for the same subject in the same year ('vs National').<br>3. On Grade bands the same column compares your subject only with England's share in the band; other subjects show a dash.<br>4. On Grade 4+ / A*–E there is no England figure, so the column is the change from the subject's own previous published year ('vs last year').<br>5. The table opens sorted by that difference, largest first; any column can be sorted.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E and Grade bands); England figure: VicData's national total from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England) per subject; Post-16: VicData's area averages (DfE school results added up for the LA, region and England) per subject and exact qualification) (Average points); England grade shares: VicData's national grade totals from the same DfE files (VicData's area averages (DfE school results added up for the LA, region and England)) (Grade bands, focused subject only)<br>Rounding: Average points and differences to 1 decimal place. Rates as whole percentages; differences in whole percentage points. |

### DV-C1-RES-TR-CHART — Chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | points, rate, change_points, change_pp |
| Date mode | trend |
| View type | graph |
| Renderer | RD-MULTI-TREND |
| Title template | Results in [category]: each subject's line |
| Title fallback | [subject], each year |
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. Grade 4+ / A*-E and bands have 4 school years from 2021/22 (0.6.2); a subject with grades in fewer years shows the pp change list. |
| Params | trendStart, showFit, legendHidden, band:range |
| Rail icon | TrendLineIcon |
| Host | teacher.c1.results, trend, rail "Chart" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign; trends row merge round |
| Rules | R-TREND-LINE-4YR, R-PERIOD-TRIM, R-THRESHOLD-PERIODS, R-INDEX-HEADCOUNTS, R-QUAL-FAMILY-MATCH, R-KS5-ASAEA-EXCL |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | Never indexed (a mean measure). Below 4 years the change list is in the measure's own units (pp / points). |
| Method | 1. We take each subject's result for every published year (average points from 2021/22; grade rates and bands from the years the subject has grades, 2021/22 on).<br>2. Each subject is a line at its real level (results are never indexed).<br>3. A line needs 4 or more years; with fewer, each subject's change from 2022/23 to the latest year is shown as ranked bars, in points or percentage points.<br>4. 2021/22 is drawn, but the trend sentence, the 'broadly stable' word and the optional fitted line are measured from 2022/23.<br>5. The trend sentence gives your subject's change in points or percentage points; within 4% either way (relative) it reads 'broadly stable'.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held<br>Rounding: Average points to 1 decimal place; changes in points to 1 decimal place. Rates as whole percentages; changes in whole percentage points. |

### DV-C1-RES-TR-TABLE — Trend table

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | points, rate, change_points, change_pp |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | Results in [category], year by year |
| Title fallback | [subject], year by year |
| Requires (card warning) | — |
| Params | trendStart, band:range |
| Rail icon | TableIcon |
| Host | teacher.c1.results, trend, rail "Trend table" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign; trends row merge round |
| Rules | R-PERIOD-TRIM, R-THRESHOLD-PERIODS, R-QUAL-FAMILY-MATCH |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | — |
| Method | 1. Each subject is one row with its result in each year.<br>2. The change column is the difference between the subject's first figure from 2022/23 on and its latest, in points or percentage points (never a percentage).<br>3. Rows are listed by the latest year's result, highest first; you can re-sort.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held<br>Rounding: Average points and changes to 1 decimal place. Rates as whole percentages; changes in whole percentage points. |

### DV-C1-RES-TR-MAP — Map

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | schools |
| Number types | points |
| Date mode | single |
| View type | map |
| Renderer | RD-RANKINGS-MAP |
| Title template | Change in [subject] [measure] since [year], by school |
| Title fallback | — |
| Requires (card warning) | Needs a focus subject with a map chip and the school's location; falls back to Chart when the focus loses its chip. |
| Params | mapRank |
| Rail icon | MapPinIcon |
| Host | teacher.c1.results, trend, rail "Map" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 7 (map in Trends) |
| Rules | R-IGCSE-EXCL, R-POINTS-SAME-QUAL, R-MAP-ENCODING |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | Placement mismatch M4: sits in Column 1 Trends but compares a school set. Declared as schools / single, so the seeded Column 1 Trends panel does not match it. 0.6.3 S2: no own toggle any more; each school's change in Results' selected measure over the panel's span, diverging (R-MAP-ENCODING). |
| Method | 1. For each school in the set we take its result in your subject: average points (GCSE: GCSE (9-1) Full Course; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification, in the same way as your school's.<br>2. For each school we work out the change from its first figure from 2022/23 on to its latest, in points or percentage points.<br>3. Each dot is coloured by that change on one scale centred on zero: green for the biggest rise in the set, red for the biggest fall, pale amber for little change.<br>4. Dot size is the school's entries in the subject in the last year (graded entries on a grade rate).<br>5. Your school wears a thick ring.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held; The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; School locations (easting and northing) from VicData's schools table<br>Rounding: Changes in points to 1 decimal place; in whole percentage points on rates. |

### DV-C1-RES-TR-GEO-CHART — Area chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points) |
| Data | academic.results |
| Results sub-measures | points |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | averages |
| Number types | points |
| Date mode | trend |
| View type | graph |
| Renderer | RD-GEOGRAPHY-VIEW |
| Title template | [subject] against its LA and England, year by year |
| Title fallback | Plain heading; no TrendScaleTitle (not indexed). |
| Requires (card warning) | Average points only; at GCSE, GCSE (9-1) Full Course items only. |
| Params | trendStart |
| Rail icon | TrendLineIcon |
| Host | teacher.c1.results, trend, rail "Area chart" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Candidates live review Part 5; Post-16 Part C |
| Rules | R-NO-GRADE-RATE-GEO, R-KS4-POINTS-GCSE-FULL, R-KS5-ENGLAND-EXACT, R-MIN-SCHOOLS, R-GEO-APPLIES |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | Placement mismatch F2. On threshold or bands the host shows the not-applicable note, so the view supports points only. |
| Method | 1. We take your subject's average points per entry each year (GCSE: GCSE (9-1) Full Course; Post-16: the same exact qualification).<br>2. For your local authority and England we take the average points per entry across all their schools in the same subject, weighted by entries (at Post-16 by size), for the same years.<br>3. Each is drawn as a line at its real level, so the gaps between them can be read directly.<br>4. The region's line is left off the chart because it runs almost on top of England's.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); LA, region and England figures: VicData's area totals from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England); Post-16: VicData's area averages (DfE school results added up for the LA, region and England)), 2021/22 to the latest year held<br>Rounding: Average points to 1 decimal place. |

### DV-C1-RES-TR-GEO-TABLE — Change table

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points) |
| Data | academic.results |
| Results sub-measures | points |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | averages |
| Number types | points, change_points |
| Date mode | trend |
| View type | table |
| Renderer | RD-GEOGRAPHY-VIEW |
| Title template | [subject]: change against its LA, region and England |
| Title fallback | — |
| Requires (card warning) | Average points only; at GCSE, GCSE (9-1) Full Course items only. |
| Params | changeStart |
| Rail icon | TableIcon |
| Host | teacher.c1.results, trend, rail "Change table" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Candidates live review Part 5; Post-16 Part C |
| Rules | R-NO-GRADE-RATE-GEO, R-KS4-POINTS-GCSE-FULL, R-KS5-ENGLAND-EXACT, R-MIN-SCHOOLS, R-GEO-APPLIES |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | Placement mismatch F2 (as Area chart). S3b: the Change column shows the change in points alone, not a % (R-NUMBER-TYPE-HONESTY). |
| Method | 1. We take your subject's average points per entry each year, and the entry-weighted average for your local authority, region and England in the same subject.<br>2. Each place is one row with its figure in each year.<br>3. The change column is the difference in points between the first figure from 2022/23 on and the latest (never a percentage).<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (GCSE page); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Post-16 page); LA, region and England figures: VicData's area totals from the same DfE files (GCSE: VicData's area averages (DfE school results added up for the LA, region and England); Post-16: VicData's area averages (DfE school results added up for the LA, region and England)), 2021/22 to the latest year held<br>Rounding: Average points and changes to 1 decimal place. |

### DV-C1-CNT-CUR-DIST — Grade distribution

| Field | Content |
| --- | --- |
| Measures | M-KS4-COUNTS (GCSE grade counts), M-KS5-COUNTS (Post-16 grade counts) |
| Data | academic.results |
| Results sub-measures | counts |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | averages |
| Number types | totals, rate |
| Date mode | single |
| View type | graph |
| Renderer | RD-GRADE-DISTRIBUTION |
| Title template | (none) |
| Title fallback | None; the tag reads 'Grade counts [year]' (not 'Current', no 'Data [year]'). |
| Requires (card warning) | School grades are published from 2021/22 (4 years; 0.6.2). |
| Params | bandPending, span |
| Rail icon | GradesIcon |
| Host | teacher.c1.counts, current, rail "(none)" (src/components/teacher/GradeCountsPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Grade bands frontend round (Grade counts) |
| Rules | R-NON-GRADES-EXCL, R-MIN-SCHOOLS, R-THRESHOLD-PERIODS |
| Used on | GCSE Results › Results › Current, Post-16 Results › Results › Current |
| Note | Railless. England share ticks (placement mismatch M5). The tag is inconsistent with every other Current tag (audit §4). |
| Method | 1. We take your school's entries at each grade in the subject and qualification for the latest year.<br>2. Each bar shows the count and its share of all graded entries.<br>3. A tick beside each grade shows England's share at that grade for the same subject and qualification in the same year.<br>4. Clicking grades selects one grade or a range; the line underneath then gives the share of your graded entries in that range, and England's share where England publishes every grade shown.<br>Sources: DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held; England grade shares: VicData's national grade totals from the same DfE files (VicData's area averages (DfE school results added up for the LA, region and England))<br>Rounding: Counts as whole numbers; shares as whole percentages. |

### DV-C1-CNT-TR-SPREAD — Spread by year

| Field | Content |
| --- | --- |
| Measures | M-KS4-COUNTS (GCSE grade counts), M-KS5-COUNTS (Post-16 grade counts) |
| Data | academic.results |
| Results sub-measures | counts |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | none |
| Number types | totals, rate |
| Date mode | trend |
| View type | graph |
| Renderer | RD-GRADE-DISTRIBUTION |
| Title template | [subject]'s spread of grades: [year] against [compare year], grade by grade |
| Title fallback | — |
| Requires (card warning) | School grades are published from 2021/22 (4 years; 0.6.2). A second year is needed to compare. |
| Params | compareFrom |
| Rail icon | GradesIcon |
| Host | teacher.c1.counts, trend, rail "Spread by year" (src/components/teacher/GradeCountsPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Grade bands frontend round (Grade counts) |
| Rules | R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | — |
| Method | 1. We take your school's entries at each grade in the latest year and in the earlier year.<br>2. Each year's bars are shown as shares of that year's own graded entries, so years with different cohort sizes can be compared.<br>3. There are no England ticks here: the school is compared with itself.<br>4. With only one year of grades, the view says a second year is needed.<br>Sources: DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held<br>Rounding: Shares as whole percentages; counts as whole numbers. |

### DV-C1-CNT-TR-CHANGETABLE — Change table

| Field | Content |
| --- | --- |
| Measures | M-KS4-COUNTS (GCSE grade counts), M-KS5-COUNTS (Post-16 grade counts) |
| Data | academic.results |
| Results sub-measures | counts |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | [subject]'s entries at each grade, change since [change year]: [change year] against [year] |
| Title fallback | — |
| Requires (card warning) | School grades are published from 2021/22 (4 years; 0.6.2). A second year is needed to measure a change. |
| Params | changeFrom |
| Rail icon | TableIcon |
| Host | teacher.c1.counts, trend, rail "Change table" (src/components/teacher/GradeCountsPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Grade bands frontend round (Grade counts) |
| Rules | R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | — |
| Method | 1. We take your school's entries at each grade for each year with grades.<br>2. Each grade is one row, in grade order, with its count in each year.<br>3. The change column is the change in entries at that grade from the change year (2022/23 or later) to the latest year, with the percentage change beneath.<br>4. It starts later than Candidates (which runs from the first year with entries, 2020/21) because these are grades: grade changes are measured from 2022/23, as 2021/22's grades were awarded more generously.<br>Sources: DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held<br>Rounding: Counts as whole numbers; percentage change as a whole number. |

### DV-C2-CUR-DONUT — Share (donut)

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | market_share |
| Date mode | single |
| View type | donut |
| Renderer | RD-SHARE-DONUT |
| Title template | Entries in [subject] as a proportion of [comparison-group] |
| Title fallback | Bands: 'Entries at [range] as a proportion of graded entries in [comparison-group]'. [comparison-group] = category label \| 'your selected subjects' \| 'all subjects' (fallback 'its subject category'). |
| Requires (card warning) | Results: Grade bands with a range picked (R-DONUT-COUNTS-ONLY). |
| Params | yearIdx, against:context, chosen:context |
| Rail icon | DonutIcon |
| Host | teacher.c2.context, current, rail "Share (donut)" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 6 §4.2; Post-16 Part D (group totals) |
| Rules | R-DONUT-COUNTS-ONLY, R-SELF-INCLUSIVE-GROUP, R-KS5-ASAEA-EXCL, R-QUAL-FAMILY-MATCH, R-FOCUS-NEVER-FILTERED |
| Used on | GCSE Candidates › Context › Current, GCSE Results › Context › Current, Post-16 Candidates › Context › Current, Post-16 Results › Context › Current |
| Note | On points and rates the host keeps the button disabled ('Share is only meaningful for candidate numbers'), so the view supports results: bands only. |
| Method | 1. On Candidates we take your subject's entries in the year (GCSE: all qualifications in the subject; Post-16: the one qualification).<br>2. We add up the entries of every subject in the comparison group, your subject included (at Post-16 every qualification except AS and AEA).<br>3. Your subject's share is its entries divided by the group's total.<br>4. On Grade bands the donut is the whole group instead: graded entries inside your chosen range as a share of all the group's graded entries, counting only qualifications on the range's grade scale.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: The share as a whole percentage; entries as whole numbers. |

### DV-C2-CUR-BARS — Bar chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, points, rate |
| Date mode | single |
| View type | ranking |
| Renderer | RD-VERTICAL-BARS |
| Title template | [Entries\|Results] by subject in [comparison-group] |
| Title fallback | None on Results without a compare-against label. Provisional wording (SubjectPanels.tsx:489-491). |
| Requires (card warning) | — |
| Params | yearIdx, against:context, chosen:context |
| Rail icon | VerticalBarsIcon |
| Host | teacher.c2.context, current, rail "Bar chart" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Current panel rework round 1 (Column 1's VerticalBars moved to Context) |
| Rules | R-QUAL-FAMILY-MATCH, R-KS5-ASAEA-EXCL, R-POINTS-SAME-QUAL, R-POINTS-WEIGHTED, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Context › Current, GCSE Results › Context › Current, Post-16 Candidates › Context › Current, Post-16 Results › Context › Current |
| Note | Default Context Current view. On Grade bands without a range the host shows points (R-MEASURE-FALLBACK, mismatch M6); on Grade counts it follows the selected grade or prompts for one (R-COUNTS-SELECTION). |
| Method | 1. Each subject's figure is its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are those in your chosen comparison group (its subject category by default), plus your subject.<br>3. The figures are for the latest year with a figure, or the year you pick (grade rates and bands from 2023/24 on).<br>4. Each subject is an upright bar, largest first, with your subject highlighted.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Entries as whole numbers; average points to 1 decimal place; rates as whole percentages. |

### DV-C2-CUR-LIST — Ranked list

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, points, rate, rank |
| Date mode | single |
| View type | ranking |
| Renderer | RD-RANKED-LIST |
| Title template | [Entries\|Results] by subject in [comparison-group] |
| Title fallback | Provisional wording (SubjectPanels.tsx:489-491). |
| Requires (card warning) | — |
| Params | yearIdx, against:context, chosen:context |
| Rail icon | RankListIcon |
| Host | teacher.c2.context, current, rail "Ranked list" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Current panel rework round 1 (moved from Column 1) |
| Rules | R-QUAL-FAMILY-MATCH, R-KS5-ASAEA-EXCL, R-POINTS-SAME-QUAL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Context › Current, GCSE Results › Context › Current, Post-16 Candidates › Context › Current, Post-16 Results › Context › Current |
| Note | — |
| Method | 1. Each subject's figure is its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are those in your chosen comparison group (its subject category by default), plus your subject.<br>3. The figures are for the latest year with a figure, or the year you pick (grade rates and bands from 2023/24 on).<br>4. Subjects are listed from highest to lowest, each with its figure and place; your subject is highlighted.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Entries as whole numbers; average points to 1 decimal place; rates as whole percentages. Ties share a place. |

### DV-C2-CUR-TABLE — Sortable table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | rank, totals, change_points, change_pp |
| Date mode | single |
| View type | table |
| Renderer | RD-SORT-TABLE |
| Title template | [Entries\|Results] by subject in [comparison-group] |
| Title fallback | Provisional wording (SubjectPanels.tsx:489-491). |
| Requires (card warning) | — |
| Params | yearIdx, sort, against:context, chosen:context |
| Rail icon | TableIcon |
| Host | teacher.c2.context, current, rail "Sortable table" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 6 |
| Rules | R-SELF-INCLUSIVE-GROUP, R-QUAL-FAMILY-MATCH, R-KS5-ASAEA-EXCL, R-MEASURE-FALLBACK, R-RANK-TIES |
| Used on | GCSE Candidates › Context › Current, GCSE Results › Context › Current, Post-16 Candidates › Context › Current, Post-16 Results › Context › Current |
| Note | Delta 'vs average' (the group average); leading rank, no value column. |
| Method | 1. Each subject's figure is its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are those in your chosen comparison group (its subject category by default), plus your subject.<br>3. The figures are for the latest year with a figure, or the year you pick (grade rates and bands from 2023/24 on).<br>4. The group average is the plain average of the member subjects' figures (your subject included). For a subject's own figure in the group: entries add up all its qualifications; at Post-16 its points are weighted by points-eligible entries across its qualifications in your subject's family; its grade rate is worked out per qualification and then averaged.<br>5. Each subject's 'vs average' is its figure minus the group average for the same year.<br>6. Subjects are ranked by their figure, highest first (ties share a place); the table shows the rank and the difference, not the figure itself.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Differences in entries as whole numbers; in points to 1 decimal place; in whole percentage points on rates. Ties share a rank. |

### DV-C2-TR-INDEXED — Indexed

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-MULTI-TREND |
| Title template | Entries in [comparison-group] |
| Title fallback | TrendScaleTitle (indexed) under the scope; none without a group. |
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. |
| Params | trendStart, showFit, legendHidden, against:context |
| Rail icon | IndexedLineIcon |
| Host | teacher.c2.context, trend, rail "Indexed" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign; trends row merge round |
| Rules | R-TREND-LINE-4YR, R-INDEX-HEADCOUNTS, R-PERIOD-TRIM, R-KS5-ASAEA-EXCL |
| Used on | GCSE Candidates › Context › Trends, Post-16 Candidates › Context › Trends |
| Note | On 'All subjects' the card is focus vs group average (page.tsx:1922, SubjectPanels.tsx:726-738). |
| Method | 1. We take each subject's figure for every published year: its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are your chosen comparison group plus your subject. Years with no figure for any subject at the start or end are dropped; the 'From' menu can start later.<br>3. Each subject's line is set to 100 in its own first year with entries (110 means 10% more entries).<br>4. On 'All subjects' the card shows just your subject against the group's average; full screen shows every subject.<br>5. A line needs 4 or more years; with fewer, each subject's change in entries is shown as ranked bars.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16)<br>Rounding: Index values are whole numbers. Within ±4% the trend reads 'Broadly stable'. |

### DV-C2-TR-CHART — Chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | points, rate, change_points, change_pp |
| Date mode | trend |
| View type | graph |
| Renderer | RD-MULTI-TREND |
| Title template | Results in [comparison-group]: each subject's line |
| Title fallback | [subject], each year |
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. |
| Params | trendStart, showFit, legendHidden, against:context |
| Rail icon | TrendLineIcon |
| Host | teacher.c2.context, trend, rail "Chart" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign; trends row merge round |
| Rules | R-TREND-LINE-4YR, R-PERIOD-TRIM, R-THRESHOLD-PERIODS, R-POINTS-SAME-QUAL, R-MEASURE-FALLBACK |
| Used on | GCSE Results › Context › Trends, Post-16 Results › Context › Trends |
| Note | — |
| Method | 1. We take each subject's figure for every published year: its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are your chosen comparison group plus your subject. Years with no figure for any subject at the start or end are dropped; the 'From' menu can start later.<br>3. Each subject is a line at its real level (results are never indexed). On 'All subjects' the card shows your subject against the group average; full screen shows every subject.<br>4. A line needs 4 or more years; with fewer, each subject's change from 2022/23 is shown as ranked bars.<br>5. 2021/22 is drawn, but the trend sentence and the fitted line are measured from 2022/23. The group average is the plain average of the member subjects' figures (your subject included). For a subject's own figure in the group: entries add up all its qualifications; at Post-16 its points are weighted by points-eligible entries across its qualifications in your subject's family; its grade rate is worked out per qualification and then averaged.<br>Sources: DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Average points to 1 decimal place; rates as whole percentages; changes in points (1 decimal place) or whole percentage points. |

### DV-C2-TR-ACTUAL — Actual

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates) |
| Data | academic.candidates |
| Results sub-measures | — |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-MULTI-TREND |
| Title template | Entries in [comparison-group] |
| Title fallback | TrendScaleTitle (actual) under the scope. |
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. Disabled with no line. |
| Params | trendStart, showFit, legendHidden, against:context |
| Rail icon | TrendLineIcon |
| Host | teacher.c2.context, trend, rail "Actual" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Column 1 qualification match / trend actual numbers round |
| Rules | R-TREND-LINE-4YR, R-PERIOD-TRIM, R-KS5-ASAEA-EXCL |
| Used on | GCSE Candidates › Context › Trends, Post-16 Candidates › Context › Trends |
| Note | — |
| Method | 1. We take each subject's figure for every published year: its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are your chosen comparison group plus your subject. Years with no figure for any subject at the start or end are dropped; the 'From' menu can start later.<br>3. Each subject is drawn at its real number of entries, all on one scale.<br>4. Offered only with 4 or more years of entries; with fewer the button is off.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16)<br>Rounding: Entries as whole numbers. |

### DV-C2-TR-TABLE — Trend table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, points, rate |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | [Entries\|Results] in [comparison-group], year by year |
| Title fallback | [subject], year by year |
| Requires (card warning) | — |
| Params | trendStart, legendHidden, against:context |
| Rail icon | TableIcon |
| Host | teacher.c2.context, trend, rail "Trend table" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign; trends row merge round |
| Rules | R-PERIOD-TRIM, R-KS5-ASAEA-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Context › Trends, GCSE Results › Context › Trends, Post-16 Candidates › Context › Trends, Post-16 Results › Context › Trends |
| Note | — |
| Method | 1. We take each subject's figure for every published year: its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are your chosen comparison group plus your subject. Years with no figure for any subject at the start or end are dropped; the 'From' menu can start later.<br>3. Each subject is one row with its figure in each year.<br>4. The change column is first to latest: a percentage on entries (with the change in entries); on results the difference in points or percentage points from 2022/23.<br>5. Rows are listed by the latest figure, highest first; you can re-sort.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Entries as whole numbers; points to 1 decimal place; rates and changes in whole percentages or percentage points. |

### DV-C2-TR-CHANGELIST — Ranked change

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | pct_change, change_points, change_pp |
| Date mode | trend |
| View type | ranking |
| Renderer | RD-CHANGE-LIST |
| Title template | [Entries\|Results] in [comparison-group]: [change-word] since [year], ranked |
| Title fallback | [Entries\|Results]: [% change\|change in points\|change in percentage points] since [year] |
| Requires (card warning) | — |
| Params | changeStart, against:context |
| Rail icon | HorizontalBarsIcon |
| Host | teacher.c2.context, trend, rail "Ranked change" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend & % change redesign (option H) |
| Rules | R-NUMBER-TYPE-HONESTY, R-KS5-ASAEA-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Context › Trends, GCSE Results › Context › Trends, Post-16 Candidates › Context › Trends, Post-16 Results › Context › Trends |
| Note | S3b: % change on entries; change in points on average point score; change in percentage points on rates (R-NUMBER-TYPE-HONESTY). |
| Method | 1. We take each subject's figure for every published year: its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are your chosen comparison group plus your subject. Years with no figure for any subject at the start or end are dropped; the 'From' menu can start later.<br>3. Each subject's change is from its first to its latest figure in the span: a percentage on entries; the difference in points or percentage points on results, from 2022/23.<br>4. Subjects are ranked by that change, biggest rise first, with your subject highlighted.<br>5. A dashed line marks the change in the group average (the plain average of the member subjects each year), worked out the same way.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Percentage change as a whole number; points to 1 decimal place; whole percentage points. |

### DV-C2-TR-CHANGETABLE — Change table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | subjects |
| Number types | totals, points, rate, pct_change, change_points, change_pp |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | [Entries\|Results] in [comparison-group]: [year] against the latest year, ranked by change |
| Title fallback | [Entries\|Results] by year, since [year] |
| Requires (card warning) | — |
| Params | changeStart, against:context |
| Rail icon | TableIcon |
| Host | teacher.c2.context, trend, rail "Change table" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic |
| Status | live |
| Verified at | not yet |
| Origin | Trend & % change redesign |
| Rules | R-NUMBER-TYPE-HONESTY, R-KS5-ASAEA-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Context › Trends, GCSE Results › Context › Trends, Post-16 Candidates › Context › Trends, Post-16 Results › Context › Trends |
| Note | — |
| Method | 1. We take each subject's figure for every published year: its entries (Candidates) or its result on the Results measure: average points per entry, the Grade 4+ / A*–E rate, or the share in your chosen grade band.<br>2. The subjects are your chosen comparison group plus your subject. Years with no figure for any subject at the start or end are dropped; the 'From' menu can start later.<br>3. Each subject is one row with its first and latest figures (full screen: every year).<br>4. The change is a percentage on entries; on results the difference in points or percentage points from 2022/23.<br>5. Rows are ranked by that change, biggest rise first, with a bare rank number.<br>Sources: DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held (Candidates, GCSE); DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (Candidates, Post-16); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held (Results, GCSE); DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (Results, Post-16); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection)<br>Rounding: Percentage change as a whole number; points to 1 decimal place; whole percentage points. Ties share a rank. |

### DV-C3-CUR-TILES — Number tiles

| Field | Content |
| --- | --- |
| Measures | M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands, counts |
| Phases | ks4, ks5 |
| Focus | school |
| Compare | schools |
| Number types | points, rank |
| Date mode | single |
| View type | numerical |
| Renderer | RD-NUMBER-TILES |
| Title template | [school]'s rank in the [set]: [measure] |
| Title fallback | Provisional wording (ComparisonsPanels.tsx:312). |
| Requires (card warning) | Ranking sets only (the default there); always the whole-school headline. |
| Params | set:rankings, chooser:rankings |
| Rail icon | TilesIcon |
| Host | teacher.c3.comparisons, current, rail "Number tiles" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Snagging round 1 Part 4 (ranking sets) |
| Rules | R-RANKING-SAMPLE, R-RANKING-MEASURE, R-RANK-TIES, R-IGCSE-EXCL |
| Used on | GCSE Candidates › Comparisons › Current, GCSE Results › Comparisons › Current, Post-16 Candidates › Comparisons › Current, Post-16 Results › Comparisons › Current |
| Note | Offered on Candidates and Results columns alike because it shows the whole-school headline (Attainment 8 / A-level points per entry) in both modes; the ranking's own measure, never the column's. 0.6.6: with a subject in focus, the subject's rank on the measure in view across the whole population, its average, and the whole-school rank as a second tile (R-RANKING-MEASURE). |
| Method | 1. We take every school of this phase in England or the region that matches the ranking's filters.<br>2. With no subject in focus: each school's latest published Attainment 8 (GCSE) or A-level average points per entry (Post-16); we rank them highest first and give the school's place and the plain average of every school's latest figure.<br>3. With a subject in focus: each school's figure in that subject on the measure in view (entries, average points, Grade 4+ / A*–E, a band or a selected grade) in one year; schools below 5 entries are left out; we rank them highest first and give the place, the plain average across the ranking's schools, and the whole-school headline rank as a second tile.<br>4. The main tile is the school's own figure in that year.<br>Sources: A national or regional ranking: every school of the phase in England or the region (DfE school census and GIAS details), narrowed by the chooser's filters; DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (with a subject in focus, on a rate)<br>Rounding: Attainment 8 and points to 1 decimal place; rates as whole percentages; entries as whole numbers. |

### DV-C3-CUR-MAP — Map

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | points, totals |
| Date mode | single |
| View type | map |
| Renderer | RD-RANKINGS-MAP |
| Title template | [subject] [measure] by school, on the map |
| Title fallback | [headline] by school, on the map (no subject chip). Provisional wording. |
| Requires (card warning) | Not for ranking sets; needs the school's location. |
| Params | set:rankings, chooser:rankings, mapCaption, mapRank |
| Rail icon | MapPinIcon |
| Host | teacher.c3.comparisons, current, rail "Map" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 7 (Comparisons map) |
| Rules | R-IGCSE-EXCL, R-RANKING-SAMPLE, R-POINTS-SAME-QUAL, R-MEASURE-FALLBACK, R-MAP-ENCODING, R-COUNTS-SELECTION |
| Used on | GCSE Candidates › Comparisons › Current, GCSE Results › Comparisons › Current, Post-16 Candidates › Comparisons › Current, Post-16 Results › Comparisons › Current |
| Note | Default Comparisons Current view. With no subject chip on Results the focus switches to the school's headline (mismatch M7). 0.6.3 S2: on Candidates, size = entries and no colour; on Results, colour = the selected measure (points, Grade 4+ / A*–E, a band or a Grade counts selection) by rank in the set (R-MAP-ENCODING), the panel's rank on the same figure. |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. On Candidates every dot is one neutral colour and its size is the school's entries.<br>3. On Results each dot is coloured by its rank in the set on the measure in view: deepest purple for the highest, palest blue for the lowest. Size is entries (graded entries on a rate).<br>4. A school with no figure, or too few entries, is a hollow grey dot.<br>5. The 'N of M' beside the map is your school's rank among the plotted schools with a figure (ties share a place).<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus); School locations from VicData's schools table<br>Rounding: Attainment 8 and points to 1 decimal place; rates as whole percentages; entries as whole numbers. |

### DV-C3-CUR-BAR — Bar chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | points, rate, totals |
| Date mode | single |
| View type | ranking |
| Renderer | RD-VIEW-CHART |
| Title template | [Entries\|Results] by school in the [set] |
| Title fallback | Ranking measure: '[measure]: [school] against the [set]'s average'. Provisional wording. |
| Requires (card warning) | — |
| Params | set:rankings, chooser:rankings |
| Rail icon | HorizontalBarsIcon |
| Host | teacher.c3.comparisons, current, rail "Bar chart" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 7 |
| Rules | R-COMPARATOR-NO-FIGURE, R-COMPARATOR-RATE-PER-QUAL, R-IGCSE-EXCL, R-RANKING-SAMPLE, R-FOCUS-NEVER-FILTERED, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Current, GCSE Results › Comparisons › Current, Post-16 Candidates › Comparisons › Current, Post-16 Results › Comparisons › Current |
| Note | — |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. Each school's figure in the latest year is a bar, largest first, with your school highlighted.<br>3. For a national or regional ranking on its headline measure, the chart is just your school against the whole population's average.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus)<br>Rounding: Attainment 8 and points to 1 decimal place; rates as whole percentages; entries as whole numbers. |

### DV-C3-CUR-RANKING — Ranking

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | points, rate, totals, rank |
| Date mode | single |
| View type | table |
| Renderer | RD-SCHOOL-RANKING-TABLE |
| Title template | Schools ranked by [subject] [measure] in the [set] |
| Title fallback | Schools ranked by [headline] in the [set]. Provisional wording. |
| Requires (card warning) | — |
| Params | set:rankings, chooser:rankings |
| Rail icon | RankListIcon |
| Host | teacher.c3.comparisons, current, rail "Ranking" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 7 §9 |
| Rules | R-COMPARATOR-NO-FIGURE, R-RANK-TIES, R-IGCSE-EXCL, R-COMPARATOR-RATE-PER-QUAL, R-FOCUS-NEVER-FILTERED, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Current, GCSE Results › Comparisons › Current, Post-16 Candidates › Comparisons › Current, Post-16 Results › Comparisons › Current |
| Note | — |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. Schools are ranked on the latest year, highest first; schools with the same figure share a place and the next place is skipped.<br>3. Each row shows the place, the school, its sector, its figure and its distance from your school.<br>4. On a subject ranking across a whole population, the rows are a window at real places: the top, the schools around yours and the bottom.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus)<br>Rounding: Attainment 8 and points to 1 decimal place; rates as whole percentages; entries as whole numbers; distance to 0.1 km. Ties share a place. |

### DV-C3-TR-CHART — Chart

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | points, rate, totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-TREND-CHART |
| Title template | This school's [measure] against [versus], year by year |
| Title fallback | [versus] = a school's name \| 'average across this set ([n] schools)' \| 'average of the schools shown' \| 'average across [set]'. |
| Requires (card warning) | Below 4 real years the Chart button is hidden and the panel shows the table only. |
| Params | versusChoice, trendStart, showFit, set:rankings |
| Rail icon | TrendLineIcon |
| Host | teacher.c3.comparisons, trend, rail "Chart" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 7; trends row merge round |
| Rules | R-TREND-LINE-4YR, R-RANKING-SAMPLE, R-PERIOD-TRIM, R-IGCSE-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | Compares with the set's average or one named school (vs: pill); mismatch M8 (set implies its own average). |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. Your school's figure each year is one line.<br>3. The other line is, by default, the plain average of the other schools in the set that have a figure that year (your school not included), or one school you pick with 'vs:'. For a ranking on its headline measure it is the whole population's average.<br>4. A line needs 4 or more years; with fewer the panel shows the table only.<br>5. On points and rates 2021/22 is drawn, but the trend sentence, the 'vs' clause and the fitted line are measured from 2022/23.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus)<br>Rounding: Attainment 8 and points to 1 decimal place; rates as whole percentages; entries as whole numbers. |

### DV-C3-TR-TABLE — Trend table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | totals, points, rate |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | Every school in the [set]: [measure], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | trendStart, set:rankings |
| Rail icon | TableIcon |
| Host | teacher.c3.comparisons, trend, rail "Trend table" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Trend redesign; trends row merge round |
| Rules | R-PERIOD-TRIM, R-COMPARATOR-NO-FIGURE, R-IGCSE-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | — |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. Every school in the set is one row with its figure in each year.<br>3. The change column is first to latest: a percentage on entries; the difference in points or percentage points on results, from 2022/23.<br>4. Rows are listed by the latest year's figure, highest first; you can re-sort.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus)<br>Rounding: Attainment 8 and points to 1 decimal place; rates and changes in whole percentages or percentage points; entries as whole numbers. |

### DV-C3-TR-MAP — Trend map

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | change_points, change_pp, totals |
| Date mode | trend |
| View type | map |
| Renderer | RD-RANKINGS-MAP |
| Title template | Change in [measure] since [year], coloured by school |
| Title fallback | [year] falls back to 'the first year'. |
| Requires (card warning) | Not for ranking sets; needs the school's location and 2 or more years. |
| Params | trendStart, set:rankings |
| Rail icon | MapPinIcon |
| Host | teacher.c3.comparisons, trend, rail "Trend map" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Trends row merge round (Trend map / Change map labels) |
| Rules | R-RANKING-SAMPLE, R-IGCSE-EXCL, R-MEASURE-FALLBACK, R-MAP-ENCODING |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | — |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. For each school we take the plain difference from its first figure in the span to its latest (in entries, points or percentage points).<br>3. Each dot is coloured on one scale centred on zero: green for the biggest rise in the set, red for the biggest fall.<br>4. Dot size is the school's entries in the last year.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus); School locations from VicData's schools table<br>Rounding: Changes in entries as whole numbers; points to 1 decimal place; whole percentage points. |

### DV-C3-TR-CHANGELIST — Ranked bars

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | pct_change, change_points, change_pp |
| Date mode | trend |
| View type | ranking |
| Renderer | RD-CHANGE-LIST |
| Title template | [change-of-measure] since [year], ranked against the [set] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | changeStart, set:rankings |
| Rail icon | HorizontalBarsIcon |
| Host | teacher.c3.comparisons, trend, rail "Ranked bars" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Trend & % change redesign (option H) |
| Rules | R-NUMBER-TYPE-HONESTY, R-COMPARATOR-NO-FIGURE, R-IGCSE-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | S3b: % change on entries; change in points on average point score; change in percentage points on rates (R-NUMBER-TYPE-HONESTY). |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. For each school we work out the change over the span: a percentage change on entries; on results the difference in points or percentage points, from 2022/23.<br>3. Schools are ranked by that change, biggest rise first, with your school highlighted.<br>4. The dashed line is the change in the set's average: the plain average of the other schools' figures each year (your school not included), then the change in that yearly average (not the average of the schools' own changes). On a subject ranking it is the average of every ranked school's change.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus)<br>Rounding: Percentage change as a whole number; points to 1 decimal place; whole percentage points. |

### DV-C3-TR-CHANGETABLE — Change table

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | totals, points, rate, pct_change, change_points, change_pp |
| Date mode | trend |
| View type | table |
| Renderer | RD-YEAR-TABLE |
| Title template | Every school in the [set]: [year] against the latest year, ranked by change |
| Title fallback | — |
| Requires (card warning) | — |
| Params | changeStart, set:rankings |
| Rail icon | TableIcon |
| Host | teacher.c3.comparisons, trend, rail "Change table" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Trend & % change redesign |
| Rules | R-NUMBER-TYPE-HONESTY, R-COMPARATOR-NO-FIGURE, R-IGCSE-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | — |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. For each school we work out the change over the span: a percentage change on entries; on results the difference in points or percentage points, from 2022/23.<br>3. Each school is one row with its first and latest figures (full screen: every year) and its change.<br>4. Rows are ranked by change, biggest rise first, with a bare rank number. On a subject ranking, the rows are a window of the whole population's change list at real places.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus)<br>Rounding: Percentage change as a whole number; points to 1 decimal place; whole percentage points. Ties share a rank. |

### DV-C3-TR-CHANGEMAP — Change map

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-THRESHOLD (GCSE Grade 4+ rate), M-KS5-THRESHOLD (Post-16 A*-E rate), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
| Data | academic.candidates, academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject, school |
| Compare | schools |
| Number types | pct_change, change_points, change_pp |
| Date mode | trend |
| View type | map |
| Renderer | RD-RANKINGS-MAP |
| Title template | [change-of-measure] since [year], coloured by school |
| Title fallback | — |
| Requires (card warning) | Not for ranking sets; needs the school's location and 2 or more years. |
| Params | changeStart, set:rankings |
| Rail icon | MapPinIcon |
| Host | teacher.c3.comparisons, trend, rail "Change map" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Comparisons change map colour scale round |
| Rules | R-NUMBER-TYPE-HONESTY, R-RANKING-SAMPLE, R-IGCSE-EXCL, R-MEASURE-FALLBACK, R-MAP-ENCODING |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | S3b: a count keeps the fixed ±% scale (forcedColourMode trend); points and rates colour by the absolute change on the set's own range (trend_absolute), keyed 'Change' (R-NUMBER-TYPE-HONESTY). |
| Method | 1. Each school's figure is: with a subject in focus, its entries in the subject (Candidates) or its result in the subject — average points (GCSE: GCSE (9-1) Full Course points; Post-16: the same exact qualification), or a grade rate scored from that school's own grade counts for the same subject and qualification; with no subject, Attainment 8 (GCSE) or A-level average points per entry (Post-16), or the number of pupils at the end of Key stage 4 / 16 to 18 students.<br>2. For each school we work out the change over the span: a percentage change on entries; on results the difference in points or percentage points, from 2022/23.<br>3. Each dot is coloured by that change on one scale centred on zero: green for the biggest rise in the set, red for the biggest fall, pale amber for little change.<br>4. Dot size is the school's entries in the last year.<br>Sources: The comparison set: by default VicData's '10 nearest schools' (school locations, sector, phase and gender from VicData's schools table, GIAS; schools with pupils of this age from the DfE school census), or a saved set or a chosen list; DfE Key stage 4 performance: subject entries by school, every qualification type (the 'Total' row), summed per subject per year in VicData's subject rollup (DfE KS4 and KS5 subject tables), 2020/21 to the latest year held / DfE A level and other 16 to 18 results: subject entries by school and exact qualification (A level, AS, each BTEC size, IB, T Level), incl. the historic file and DfE T Level results, 2020/21 to the latest year held (with a subject in focus, Candidates); DfE Key stage 4 performance: subject points by school (GCSE (9-1) Full Course entries, DfE 9-1 points table; GCSE Double Award scored from its grades as two entries), via VicData's subject rollup, 2021/22 to the latest year held / DfE A level and other 16 to 18 results: average points per entry by school, subject and exact qualification (DfE points table, size-weighted), 2021/22 to the latest year held (with a subject in focus, Average points); DfE grade counts by school, subject and qualification (KS4 subject entries / KS5 subject results, modern and historic files), 2021/22 to the latest year held (Grade 4+ / A*–E, bands, a counts selection); DfE Key stage 4 performance: school headline, Attainment 8 average and number of pupils at the end of Key stage 4 (dfe_ks4_headline and historic), 2021/22 to the latest year held / DfE A level and other 16 to 18 results: school headline, A-level average points per entry and number of 16 to 18 students (dfe_ks5_headline and historic), 2021/22 to the latest year held (no subject in focus); School locations from VicData's schools table<br>Rounding: Percentage change as a whole number; points to 1 decimal place; whole percentage points. |

### DV-ADM-P-NOW — Entry point now

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | none |
| Number types | totals, pct_change |
| Date mode | single |
| View type | numerical |
| Renderer | RD-ADM-TILES |
| Title template | Your [entry] entry point now |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TilesIcon |
| Host | admissions.pipelines, current, rail "Entry point now" (src/components/admissions/panels/EntryNow.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-NOW, R-ADM-SHAPE-NOT-RANKED |
| Used on | Admissions Pipelines › Entry point › Now |
| Note | — |
| Method | 1. Take your pupils at the entry age in the January 2026 census (2025/26). From age 4 only full-time pupils count; at ages 2-3, full-time and part-time.<br>2. Take the same count from the January 2020 census (2019/20) and give the change as a percentage of the 2019/20 figure.<br>3. Split this year's entry-age pupils into girls and boys, each as a percentage of the whole cohort.<br>4. Day pupils: your whole roll (every age, full- and part-time) in the 2025/26 census minus the boarders recorded in that census.<br>5. Size by phase: add up your pupils in each phase band (Early Years 0-4, Primary 5-10, Secondary 11-15, Sixth Form 16-18) and place each against national fifths of schools teaching that phase: XS bottom fifth, then S, M, L, XL top fifth.<br>6. Shape: the shared classifier names the shape of your year groups (ages 5-17) and the line says since which year it has held.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 and 2025/26; DfE school census (January) 2025/26: boarders, whole school; GIAS (Get Information about Schools): boarding status; Age-band roll distributions (DfE school census, rolls by phase band), 2025/26: national fifths (p20-p80) and the LA mean; VicData's shape descriptions on the school's census age profile<br>Rounding: Pupil counts to whole numbers. Change since 2019/20 and the girls/boys split to the whole per cent. |

### DV-ADM-P-PIPELINE — Pipeline

| Field | Content |
| --- | --- |
| Measures | M-ADM-POOL (Pipeline (the pool)) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, pct_change |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-PIPELINE |
| Title template | Children who will reach [entry-year] entry, by September |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmPipelineIcon |
| Host | admissions.pipelines, current, rail "Pipeline" (src/components/admissions/views/PipelineChart.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-PIPELINE, R-ADM-LADDER, R-ADM-POOL-NOT-INTAKE, R-ADM-FLAG-FEEDER |
| Used on | Admissions Pipelines › Pipeline › Now |
| Note | — |
| Method | 1. Choose the schools that hold these children now: the lead's lists, or by default the nearest 15 state primaries (at 16+, the nearest 10 state secondaries, 11-16 schools first, plus your own Year 11, with the primaries below).<br>2. Past years: for each September from 2020 to 2026, add up these schools' pupils one year below the entry age in the January census before it (for example Year 6 in January 2026 for September 2026 at 11+).<br>3. Counted years: for each September from 2027, find the age those children are now (entry age minus years to go) and add up these schools' pupils at that age in the January 2026 census. That count is the line. At 16+, the move from the primaries to the secondaries is scaled by the average ratio seen between them in past years.<br>4. Range for counted years: take every year-on-year change in these schools' year groups since 2019/20 (same schools in both years), keep the middle 80% (10th to 90th percentile), and apply the low and high ends once for each year still to go, so the range widens.<br>5. Years beyond the youngest counted age, from births: blend each LA's births by its weight (a weighted average). A school year is 8/12 of calendar year X plus 4/12 of year X-1. Scale this to your schools by the average ratio of their Reception pupils to those births in past years, then follow it forward as in step 4; the range also uses the low and high Reception ratios. For girls or boys, births are taken as 49% or 51%.<br>6. At 4+ (and younger entry ages) the blended births are the pool itself, not scaled to the schools; the range is the spread of the Reception-to-births ratio around its average.<br>7. Headline: the change from the September 2026 pool to the pool three years after the first forward year (or the last year shown, if sooner).<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; ONS births by local authority, calendar years (shire counties as the sum of their districts); ONS subnational population projections, age 10, by upper-tier LA (11+ only; off unless switched on); GIAS (Get Information about Schools): nearest schools, sector, age range, LA<br>Rounding: Pools and ranges shown to whole pupils (hover text). Headline change to the whole per cent. Percentiles interpolated between values (numpy's default method). |

### DV-ADM-P-FUNNEL — Why did our intake change?

| Field | Content |
| --- | --- |
| Measures | M-ADM-CATCHMENT (Children in the catchment), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | none |
| Number types | totals, pct_change |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-FUNNEL |
| Title template | Why did our intake change? |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmFunnelIcon |
| Host | admissions.pipelines, current, rail "Why did our intake change?" (src/components/admissions/views/Funnel.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-INTAKE-CHANGE, R-ADM-CATCHMENT-RULE |
| Used on | Admissions Pipelines › Pipeline › Now |
| Note | No funnel at 4+ (0.7 r3, F7). |
| Method | 1. Take the area: the LSOAs within the radius.<br>2. as shown<br>3. The area's as shown: children living in the area at the age a year below entry, in the mid-year before entry (Year 6 = aged 10 for September 11+ entry; Year 11 = aged 15 at 16+).<br>4. Your as shown: your own pupils at the entry age in the January census (full-time from age 4).<br>5. Your as shown is births × (area as shown ÷ births) × (your as shown ÷ area as shown). The three are the cohort's size, families moving (more or fewer of the area's children at that age than were born there), and your share of the area's children.<br>6. Split the change from the first year held to as shown into those three parts by the log-mean (LMDI) split: each part is L × ln(that factor now ÷ that factor then), where L = (your as shown now − then) ÷ (ln now − ln then). The three parts add up to the whole change exactly, whatever order they are taken in.<br>7. Where your intake is under 30 at either end, each end is a 3-year average (the base year and the two after it; the latest and the two before it), every figure alike.<br>8. Draw a waterfall: your as shown in the first year held, each part from the running total (up in the accent, down in orange), your as shown in as shown. The bars start a little below the lowest running total, and say so.<br>Sources: ONS small-area population estimates (LSOAs, 2021 boundaries), single year of age, mid-2011 to the latest mid-year held; DfE school census (January), your own pupils by single age, 2019/20 to 2025/26; GIAS (Get Information about Schools): nearest schools, for a state school's radius<br>Rounding: Your intake at each end to whole pupils; the parts to whole pupils by largest remainders, so they still add up to the change. Ratios in the labels to 2 decimal places; shares to 1 (or 2 under 0.1%). |

### DV-ADM-P-BIRTHS — Local births

| Field | Content |
| --- | --- |
| Measures | M-ADM-CATCHMENT (Children in the catchment) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-BIRTHS |
| Title template | Births in your catchment, against the region and England |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmPopulationIcon |
| Host | admissions.pipelines, current, rail "Local births" (src/components/admissions/views/Funnel.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-LOCAL-BIRTHS, R-ADM-CATCHMENT-RULE |
| Used on | Admissions Pipelines › Pipeline › Now |
| Note | — |
| Method | 1. Births in the catchment: the children aged 0 living in the LSOAs within the radius, each mid-year (ONS's small-area estimates).<br>2. The region and England: ONS's LA estimates aged 0, added up over every LA in the school's region, and over every English LA.<br>3. Index each line to the first year held = 100.<br>4. The second axis label is the September entry each birth year reaches: a child aged 0 in mid-year X starts Year 7 in September X + 11 (Year 12 in X + 16), the as shown-year gap.<br>Sources: ONS small-area population estimates (LSOAs, 2021 boundaries), aged 0, mid-as shown to mid-as shown; ONS mid-year population estimates by LA, aged 0 (the region's LAs and England's, summed)<br>Rounding: Index to whole numbers (hover: the count of children aged 0). |

### DV-ADM-P-MAP — Map of feeders

| Field | Content |
| --- | --- |
| Measures | M-ADM-POOL (Pipeline (the pool)), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, pct_change |
| Date mode | single |
| View type | map |
| Renderer | RD-ADM-MAP |
| Title template | Your feeders, sized by pupils aged [feeder-age], coloured by trend |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | MapPinIcon |
| Host | admissions.pipelines, current, rail "Map of feeders" (src/components/admissions/views/AdmissionsMap.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-FEEDERS, R-ADM-FLAG-FEEDER |
| Used on | Admissions Pipelines › Pipeline › Now |
| Note | — |
| Method | 1. Take the feeder set's schools that hold children one year below the entry age (Reception at 4+; at 16+ the secondaries' Year 11), leaving out your own school.<br>2. For each school, count its pupils at that age in the January 2026 census (2025/26) and two years earlier (2023/24), and work out the change as a percentage.<br>3. Add the same counts across the whole set (schools with both years) to get the set's own change: this is 'the area'.<br>4. Flag: red ('falling faster than the area') when a school fell and its change is more than 5 percentage points below the area's; focus ('rising' above +2%, 'stable' from -2% to +2%) when its change is -2% or better; otherwise no flag. No flag when the school had fewer pupils two years ago than the minimum cohort (the national threshold's minimum for the phase, else 10).<br>5. Draw each school as a dot sized by its 2025/26 count and coloured green (focus), red (red flag) or grey (neither). In the 'value' look, dots are coloured by thirds of the set by pupils instead.<br>6. Your own school is a solid Admissions-blue dot, drawn on top, sized by your entry cohort now (your Year 7 at 11+) on the same scale as the feeders' dots, so your intake reads against theirs.<br>Sources: DfE school census (January), pupils by single age and sex, 2023/24 and 2025/26; GIAS (Get Information about Schools): school locations (easting/northing); National flag thresholds (VicData's national flag thresholds): the minimum cohort only<br>Rounding: Pupils to whole numbers; the two-year change in the hover to the whole per cent. |

### DV-ADM-P-TABLE — Feeder table

| Field | Content |
| --- | --- |
| Measures | M-ADM-POOL (Pipeline (the pool)), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, pct_change |
| Date mode | single |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Your feeders: pupils aged [feeder-age], trend and flags |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TableIcon |
| Host | admissions.pipelines, current, rail "Feeder table" (src/components/admissions/views/Tables.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-FEEDERS, R-ADM-FLAG-FEEDER |
| Used on | Admissions Pipelines › Pipeline › Now |
| Note | — |
| Method | 1. Take the feeder set's schools that hold children one year below the entry age (Reception at 4+; at 16+ the secondaries' Year 11), leaving out your own school.<br>2. For each school, count its pupils at that age in the January 2026 census (2025/26) and two years earlier (2023/24), and work out the change as a percentage.<br>3. Add the same counts across the whole set (schools with both years) to get the set's own change: this is 'the area'.<br>4. Flag: red ('falling faster than the area') when a school fell and its change is more than 5 percentage points below the area's; focus ('rising' above +2%, 'stable' from -2% to +2%) when its change is -2% or better; otherwise no flag. No flag when the school had fewer pupils two years ago than the minimum cohort (the national threshold's minimum for the phase, else 10).<br>5. Add distance (straight line between school locations, in km), sector, gender, and size: each school's roll in the primary band (top age 11 or under) or secondary band, against national fifths (XS-XL). Sorted nearest first by default.<br>Sources: DfE school census (January), pupils by single age and sex, 2023/24 and 2025/26; GIAS (Get Information about Schools): location, sector, gender, LA; National flag thresholds (minimum cohort); Age-band roll distributions 2025/26 (national fifths) for XS-XL<br>Rounding: Pupils to whole numbers. Each school's trend to the whole per cent; the whole set's to 1 decimal place. Distance to 1 decimal place (km). |

### DV-ADM-P-SHAPE — Shape and size

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-ADM-SHAPES |
| Title template | Shape and size: your school, the local shape, and rivals' shapes |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmShapeIcon |
| Host | admissions.pipelines, current, rail "Shape and size" (src/components/admissions/views/ShapeAndSize.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-SHAPES, R-ADM-SHAPE-NOT-RANKED |
| Used on | Admissions Pipelines › Pipeline › Now |
| Note | — |
| Method | 1. Local shape: add up the age profiles of every school in the youngest feeder set (the schools holding Reception) and run the shared classifier on the total. Ages 4 to a year below entry are drawn. At 16+ the caption names the set counted (the nearest primaries, unless a list is saved) and the ages it holds.<br>2. Your feeders: the schools of the current feeder set at the age a year below entry (the lead's list, else the nearest state schools), your own school left out, in the set's own order.<br>3. For each feeder: its shape, its size in its phase band against national fifths (XS to XL), and a small outline with a row per age over the local shape's ages, the age a year below entry highlighted. Never ranked.<br>Sources: DfE school census (January), pupils by single age and sex (full- and part-time), each school's latest year with pupils; VicData's shape descriptions; Age-band roll distributions 2025/26 (national fifths)<br>Rounding: Counts to whole numbers (hover). |

### DV-ADM-P-ENTRY-LINE — Your cohort

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | Your [entry-year] cohort, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TrendLineIcon |
| Host | admissions.pipelines, trend, rail "Your cohort" (src/components/admissions/views/Lines.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS, R-ADM-POOL-NOT-INTAKE |
| Used on | Admissions Pipelines › Entry point › Trends |
| Note | — |
| Method | 1. For each January census from 2019/20 to 2025/26, take your own pupils at the entry age (full-time only from age 4; full- and part-time at ages 2-3).<br>2. Draw one point per census year, joined as a line.<br>3. A year with no census for your school is left as a gap; an earlier year can come from your school's predecessor (for example before an academy conversion).<br>4. At least two years with figures are needed to draw it.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Whole numbers. |

### DV-ADM-P-ENTRY-BARS — Your cohort, bars

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-BARS |
| Title template | Your [entry-year] cohort, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | VerticalBarsIcon |
| Host | admissions.pipelines, trend, rail "Your cohort, bars" (src/components/admissions/views/Bars.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS |
| Used on | Admissions Pipelines › Entry point › Trends |
| Note | — |
| Method | 1. For each January census from 2019/20 to 2025/26, take your own pupils at the entry age (full-time only from age 4; full- and part-time at ages 2-3).<br>2. Draw one bar per census year; the hover splits it into girls and boys.<br>3. A year with no census for your school is left as a gap; an earlier year can come from your school's predecessor (for example before an academy conversion).<br>4. At least two years with figures are needed to draw it.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Whole numbers. |

### DV-ADM-P-ENTRY-TABLE — Your cohort, table

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Your [entry-year] cohort, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TableIcon |
| Host | admissions.pipelines, trend, rail "Your cohort, table" (src/components/admissions/views/Tables.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS |
| Used on | Admissions Pipelines › Entry point › Trends |
| Note | — |
| Method | 1. For each January census from 2019/20 to 2025/26, take your own pupils at the entry age (full-time only from age 4; full- and part-time at ages 2-3).<br>2. List one row per census year with the total, girls and boys.<br>3. A year with no census for your school is left as a gap; an earlier year can come from your school's predecessor (for example before an academy conversion).<br>4. At least two years with figures are needed to draw it.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Whole numbers. |

### DV-ADM-P-ENTRY-SEX — Your cohort, girls and boys

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | Your [entry-year] cohort: girls and boys |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | IndexedLineIcon |
| Host | admissions.pipelines, trend, rail "Your cohort, girls and boys" (src/components/admissions/views/Lines.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS, R-ADM-ENTRY-SEX |
| Used on | Admissions Pipelines › Entry point › Trends |
| Note | — |
| Method | 1. For each January census from 2019/20 to 2025/26, take your own girls and boys at the entry age (full-time only from age 4).<br>2. Draw a line for each: girls in the accent, boys dashed.<br>3. Under it, the girls' share of the cohort each year (girls ÷ girls and boys), against 50%, and the change from the first year to the latest in words.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Counts to whole numbers; the girls' share to the whole per cent (1 decimal place on hover). |

### DV-ADM-P-POOL-INDEXED — Pool trends

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools, averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | [feeder-age]-year-olds: your feeders, [la] and England |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | IndexedLineIcon |
| Host | admissions.pipelines, trend, rail "Pool trends" (src/components/admissions/views/Lines.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS |
| Used on | Admissions Pipelines › Pipeline › Trends |
| Note | — |
| Method | 1. Feeders: the Pipeline's past pools: your feeder set's pupils one year below the entry age in each January census (2019/20 to 2024/25 or 2025/26, the census a year before each September's entry).<br>2. LA: every pupil of that age in all schools in your school's LA (DfE school census, summed by area, LA row), for each census year those figures hold.<br>3. England: the same age added up across the nine regions; a year without all nine is left blank.<br>4. Find the first year all three lines have a figure and set each line to 100 there; every other year is its figure divided by that year's, times 100. If no year is shared, each line starts at 100 in its own first year.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26 (feeder schools); DfE school census via DfE school census, summed by area: pupils by single age per LA and per region, each year held<br>Rounding: Index values to whole numbers on the axis; counts in the hover to whole numbers. |

### DV-ADM-P-POOL-TABLE — Pool trends, table

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools, averages |
| Number types | totals, index100 |
| Date mode | trend |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | [feeder-age]-year-olds: your feeders, [la] and England |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TableIcon |
| Host | admissions.pipelines, trend, rail "Pool trends, table" (src/components/admissions/views/Tables.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS |
| Used on | Admissions Pipelines › Pipeline › Trends |
| Note | — |
| Method | 1. Feeders: the Pipeline's past pools: your feeder set's pupils one year below the entry age in each January census (2019/20 to 2024/25 or 2025/26, the census a year before each September's entry).<br>2. LA: every pupil of that age in all schools in your school's LA (DfE school census, summed by area, LA row), for each census year those figures hold.<br>3. England: the same age added up across the nine regions; a year without all nine is left blank.<br>4. List one row per year with the three counts as they are (not indexed); a missing figure shows a dash.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26 (feeder schools); DfE school census via DfE school census, summed by area: pupils by single age per LA and per region<br>Rounding: Whole numbers. |

### DV-ADM-P-AREA-POP — Area population

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | averages |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-ADM-BARS |
| Title template | Population trends in the area (ages 5-15) |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmPopulationIcon |
| Host | admissions.pipelines, trend, rail "Area population" (src/components/admissions/views/Lines.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS |
| Used on | Admissions Pipelines › Pipeline › Trends |
| Note | The school page's Population trends in the area, as it draws them. |
| Method | 1. From the 2025/26 census, take the pupils at each age from 5 to 15 in all schools in your school's LA, and the same for its region.<br>2. Draw each age as a bar, from 15 down to 5.<br>3. Compare the youngest with the oldest: (pupils aged 15 minus pupils aged 5) divided by pupils aged 15. It is shown with the sign turned round, so fewer 5-year-olds than 15-year-olds reads as a fall.<br>4. Name it: Growing (more 5-year-olds than 15-year-olds), Stable (up to 2% fewer), Decline (up to 15% fewer), Steep Decline (up to 25% fewer), Severe Decline (more than 25% fewer).<br>Sources: DfE school census 2025/26 via DfE school census, summed by area: pupils by single age in all schools in the LA and in the region<br>Rounding: The percentage to 1 decimal place. Counts in the hover to whole numbers. |

### DV-ADM-P-HOLD-LINE — Share needed

| Field | Content |
| --- | --- |
| Measures | M-ADM-POOL (Pipeline (the pool)) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | market_share |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | Share needed to hold numbers steady |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TrendLineIcon |
| Host | admissions.pipelines, trend, rail "Share needed" (src/components/admissions/views/Lines.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-HOLD-SHARE, R-ADM-VIEW-TRENDS |
| Used on | Admissions Pipelines › Forward › Trends |
| Note | — |
| Method | 1. Take your own pupils at the entry age in the January 2026 census (2025/26). With the girls/boys filter on, girls or boys only.<br>2. Now: divide that number by the September 2025 pool (the feeder set's pupils a year below entry in the 2024/25 census) to give your share now.<br>3. For each September from 2027, divide the same number by that year's pool from the Pipeline (counted, then from births). This is the share you would need to take the same number again.<br>4. Range: divide by the top of the pool's range for the low end, and by the bottom of the range for the high end.<br>5. Years with no pool are left out; September 2026 is not shown (it is already past).<br>6. The sentence quotes the share for the year the Pipeline's headline uses (three years after the first forward year), else the fourth year shown; the line is solid for counted years and dashed for years from births, against a dashed line at your share now.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; ONS births by local authority (for the later years of the pool)<br>Rounding: Shares to 1 decimal place. |

### DV-ADM-P-HOLD-TABLE — Share needed, table

| Field | Content |
| --- | --- |
| Measures | M-ADM-POOL (Pipeline (the pool)) |
| Data | admissions.pipeline |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | market_share, totals |
| Date mode | trend |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Share needed to hold numbers steady |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TableIcon |
| Host | admissions.pipelines, trend, rail "Share needed, table" (src/components/admissions/views/Tables.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-HOLD-SHARE |
| Used on | Admissions Pipelines › Forward › Trends |
| Note | — |
| Method | 1. Take your own pupils at the entry age in the January 2026 census (2025/26). With the girls/boys filter on, girls or boys only.<br>2. Now: divide that number by the September 2025 pool (the feeder set's pupils a year below entry in the 2024/25 census) to give your share now.<br>3. For each September from 2027, divide the same number by that year's pool from the Pipeline (counted, then from births). This is the share you would need to take the same number again.<br>4. Range: divide by the top of the pool's range for the low end, and by the bottom of the range for the high end.<br>5. Years with no pool are left out; September 2026 is not shown (it is already past).<br>6. List a row for now (marked counted, no range) and a row for each later September with the share needed, its range and its source (counted or births).<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; ONS births by local authority (for the later years of the pool)<br>Rounding: Shares and ranges to 1 decimal place. |

### DV-ADM-M-NOW — Your place now

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | rank, market_share, change_pp |
| Date mode | single |
| View type | numerical |
| Renderer | RD-ADM-TILES |
| Title template | Your place among the [rivals], at [entry] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TilesIcon |
| Host | admissions.market, current, rail "Your place now" (src/components/admissions/panels/MarketNow.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-GROUP-SHARE |
| Used on | Admissions Market share › Entry point › Now |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. Rank: order the schools by their latest count, largest first; ties share a place. 'Of' is the number of schools with a figure that year.<br>4. Market share: your count divided by the group's total that year.<br>5. Since 2019/20: your share now minus your share in the first year, in percentage points.<br>6. Whole school: your rank by total roll (every age; girls or boys only with the filter on) among the group in 2025/26.<br>7. This group: the total at the entry age, the number of rivals, and how many schools are independent, state and boarding (your school included in those three counts).<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; GIAS (Get Information about Schools): nearest schools, sector, boarding, gender, location<br>Rounding: Share to 1 decimal place; change in share to 1 decimal place (points). |

### DV-ADM-M-DONUT — Share (donut)

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | market_share |
| Date mode | single |
| View type | donut |
| Renderer | RD-ADM-DONUT |
| Title template | Your share of [entry-age]-year-olds across this group |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | DonutIcon |
| Host | admissions.market, current, rail "Share (donut)" (src/components/admissions/views/Bars.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-GROUP-SHARE |
| Used on | Admissions Market share › Rivals › Now |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. Add the counts for the group total in the latest year.<br>4. Your share is your count divided by that total; the donut fills that share.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; GIAS (Get Information about Schools): nearest schools, sector, boarding, gender, location<br>Rounding: Share to 1 decimal place; total to whole pupils. |

### DV-ADM-M-BARS — Ranked bars

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share), M-ADM-RIVAL-RESULTS (Rivals' results) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, market_share, rank |
| Date mode | single |
| View type | ranking |
| Renderer | RD-ADM-BARS |
| Title template | [entry-age]-year-olds by school, ranked, with where each sits in regional and national results rankings |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | HorizontalBarsIcon |
| Host | admissions.market, current, rail "Ranked bars" (src/components/admissions/views/Bars.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-RIVAL-RANKS |
| Used on | Admissions Market share › Rivals › Now |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. Rank the schools by their latest count (ties share) and draw each as a bar; share = count divided by the group's total.<br>4. Trend arrow: the change in each school's count from the year before; up or down only if it moved more than 2%, otherwise level.<br>5. Results: each school's place in England and in its own region on the whole-school headline for the entry point's stage (4+: KS2 reading, writing and maths at the expected standard; 11+: GCSE Attainment 8; 16+: A-level points per entry) in the latest results year, among every school with a figure, highest first, ties sharing. An IGCSE-heavy independent school at 11+ shows 'IGCSE', is not ranked, and is left out of every school's national and regional population; a school with no published results shows 'none'.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; GIAS (Get Information about Schools): nearest schools, sector, boarding, gender, location; DfE performance tables: KS2 , KS4 and KS5 headlines, latest results year<br>Rounding: Share to the whole per cent. Trend hover to 1 decimal place. |

### DV-ADM-M-MAP — Map of rivals

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, market_share |
| Date mode | single |
| View type | map |
| Renderer | RD-ADM-MAP |
| Title template | Your rivals, sized by pupils aged [entry-age] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | MapPinIcon |
| Host | admissions.market, current, rail "Map of rivals" (src/components/admissions/views/AdmissionsMap.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET |
| Used on | Admissions Market share › Rivals › Now |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. Size each school's dot by its pupils at the entry age in the 2025/26 census (all pupils).<br>3. Colour by sector (state or independent), your school ringed. In the 'change' look, colour by the change since last year instead (more than 2% up or down).<br>4. The hover gives the count and the share of the group (count divided by the group's total), which follow the girls/boys filter.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; GIAS (Get Information about Schools): nearest schools, sector, boarding, gender, location<br>Rounding: Share to 1 decimal place. |

### DV-ADM-M-TABLE — Rivals table

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share), M-ADM-RIVAL-RESULTS (Rivals' results) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, market_share, rank |
| Date mode | single |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Your rivals at [entry] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TableIcon |
| Host | admissions.market, current, rail "Rivals table" (src/components/admissions/views/Tables.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-RIVAL-RANKS |
| Used on | Admissions Market share › Rivals › Now |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. For each school in the latest year: rank by count (ties share), count, share of the group's total, and whole-school roll (every age, full- and part-time; girls or boys only with the filter on).<br>4. Size: the school's roll in the entry point's phase band against national fifths (XS-XL).<br>5. Distance: straight line from your school, in km.<br>6. Results: the school's place in England on the stage's headline (see the ranked bars).<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; GIAS (Get Information about Schools): nearest schools, sector, boarding, gender, location; DfE performance tables (latest results year); Age-band roll distributions 2025/26 (national fifths)<br>Rounding: Share to 1 decimal place; distance to 1 decimal place. |

### DV-ADM-M-MOMENTUM — Rivals' momentum

| Field | Content |
| --- | --- |
| Measures | M-ADM-RIVAL-RESULTS (Rivals' results), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.rivals |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | pct_change, change_points |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-SCATTER |
| Title template | Who is gaining pupils, and whose results are rising? |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmScatterIcon |
| Host | admissions.market, current, rail "Rivals' momentum" (src/components/admissions/views/Momentum.tsx) |
| Audience | academic, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MOMENTUM, R-ADM-FLAG-MOMENTUM |
| Used on | Admissions Market share › Rivals › Now |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. Across: each school's change in pupils at the entry age over three census years, to 2025/26, as a percentage of the figure three years before. Growing or shrinking compares this year's roll with three years ago. A school with fewer than four census years is measured from its first.<br>3. Up: each school's change in its whole-school headline (KS2 expected standard %, GCSE Attainment 8, or A-level points per entry) from 2022/23 to the latest results year, in points.<br>4. Plot each school in one of four corners: growing or shrinking, improving or slipping. Dots with a gaining or rising flag are amber, a losing or shrinking flag red.<br>5. Flags use two-year changes against national thresholds for the phase (the top or bottom fifth of all schools' changes); with no thresholds loaded, no threshold flag is shown.<br>6. Results rising fast: the headline rose by at least the national top-fifth threshold over two results years, and the school has at least the minimum cohort at the entry age. Gaining pupils: the whole roll rose by at least the top-fifth threshold over two census years (2023/24 to 2025/26). Year 7 (or Reception, Year 12) shrinking: the entry-age count fell by at least the bottom-fifth threshold over the same two years. Losing pupils three years running: the whole roll fell in each of the last three years (2022/23 to 2025/26). New sixth form (11+ and 16+ only): pupils aged 16 now, at least the minimum cohort, and none in any year up to two years ago. Shape changed: the same shape in the last two censuses, different from three years before (this one needs no threshold).<br>Sources: DfE school census (January), pupils by single age and sex, the census three years before 2025/26 to 2025/26; DfE performance tables: the whole-school headline, 2022/23 to the latest results year; National flag thresholds (VicData's national flag thresholds)<br>Rounding: Changes in hovers to 1 decimal place; pupil changes in the list to the whole per cent; results changes to 1 decimal place. |

### DV-ADM-M-STRENGTHS — Strengths and weaknesses

| Field | Content |
| --- | --- |
| Measures | M-ADM-RIVAL-RESULTS (Rivals' results) |
| Data | admissions.rivals |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | points, change_points, rank |
| Date mode | single |
| View type | graph |
| Renderer | RD-ADM-STRENGTHS |
| Title template | Where you lead and trail your rivals, by subject area |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmStrengthsIcon |
| Host | admissions.market, current, rail "Strengths and weaknesses" (src/components/admissions/views/Strengths.tsx) |
| Audience | academic, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-STRENGTHS, R-ADM-FLAG-STRENGTHS |
| Used on | Admissions Market share › Rivals › Now |
| Note | KS2 has no subject areas: not on 4+ (a custom age below 11 shows the reason). |
| Method | 1. For each subject area you have (at least 10 entries), take your average points in the latest results year.<br>2. Take the same for each rival with that area (at least 10 entries; IGCSE-heavy rivals left out) and average them.<br>3. Your rank: 1 plus the number of rivals above you, out of those rivals plus you. Gap: your figure minus the rivals' average.<br>4. Direction since 2022/23: today's gap minus the 2022/23 gap (rising or falling if it moved more than 0.05 points).<br>5. Flags (only with at least two rivals): Strength = ahead of the average and in the top third; Strength growing = also the gap widened since 2022/23 and your own two-year change is in the national top fifth. Weakness and Weakness widening are the same at the bottom.<br>6. Sorted by gap, biggest lead first.<br>Sources: DfE KS4 or KS5 subject-family results (average points and entries), 2022/23 to the latest results year; National flag thresholds (subject-area)<br>Rounding: Points and gaps to 2 decimal places (hover). |

### DV-ADM-M-SHAPE — Rivals' shapes

| Field | Content |
| --- | --- |
| Measures | M-ADM-PUPILS (Pupils by age) |
| Data | admissions.pupils |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-ADM-SHAPES |
| Title template | Shape and size: your school and rivals' shapes |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmShapeIcon |
| Host | admissions.market, current, rail "Rivals' shapes" (src/components/admissions/views/ShapeAndSize.tsx) |
| Audience | rolls, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-SHAPES, R-ADM-SHAPE-NOT-RANKED |
| Used on | Admissions Market share › Rivals › Now |
| Note | — |
| Method | 1. Your school: pupils by age and sex (full- and part-time) from your latest census with pupils, drawn up to age 17, with the entry age (and 16, if you have a sixth form) highlighted.<br>2. Shape: the shared classifier names the shape of your year groups from ages 5 to 17, with the year it last changed.<br>3. Size: your roll in each phase band against national fifths of schools teaching that phase (XS to XL).<br>4. Rivals: each rival's shape, its size in the entry point's phase band against national fifths, and a small outline of its year groups with a row per age over your own school's ages (an age it doesn't teach is an empty row, so the rows line up with yours), each scaled to its own largest year group, in the rival list's own order. Never ranked.<br>Sources: DfE school census (January), pupils by single age and sex (full- and part-time), each school's latest year with pupils; VicData's shape descriptions; Age-band roll distributions 2025/26 (national fifths)<br>Rounding: Counts to whole numbers (hover). |

### DV-ADM-M-FLAGS — Flags

| Field | Content |
| --- | --- |
| Measures | M-ADM-RIVAL-RESULTS (Rivals' results), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.rivals |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | pct_change, change_points |
| Date mode | trend |
| View type | table |
| Renderer | RD-ADM-FLAGS |
| Title template | Rivals' flags: large and lasting changes |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | FlagIcon |
| Host | admissions.market, current, rail "Flags" (src/components/admissions/views/Momentum.tsx) |
| Audience | academic, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-FLAGS, R-ADM-FLAG-MOMENTUM |
| Used on | not placed |
| Note | In the editor's catalogue; the published dashboard shows the flags inside Rivals' momentum. |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. Flags use two-year changes against national thresholds for the phase (the top or bottom fifth of all schools' changes); with no thresholds loaded, no threshold flag is shown.<br>3. Results rising fast: the headline rose by at least the national top-fifth threshold over two results years, and the school has at least the minimum cohort at the entry age. Gaining pupils: the whole roll rose by at least the top-fifth threshold over two census years (2023/24 to 2025/26). Year 7 (or Reception, Year 12) shrinking: the entry-age count fell by at least the bottom-fifth threshold over the same two years.<br>4. Losing pupils three years running: the whole roll fell in each of the last three years (2022/23 to 2025/26). New sixth form (11+ and 16+ only): pupils aged 16 now, at least the minimum cohort, and none in any year up to two years ago. Shape changed: the same shape in the last two censuses, different from three years before (this one needs no threshold).<br>5. List the flagged rivals, most flags first, with each one's pupil change at the entry age since 2022/23 and its headline change in points since 2022/23.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26; DfE performance tables (whole-school headline); National flag thresholds<br>Rounding: Pupil change to the whole per cent; results change to 1 decimal place; figures in hovers to 2 decimal places. |

### DV-ADM-M-VS-LINE — You and the rivals

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | Your [entry-year] against the [rivals] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | IndexedLineIcon |
| Host | admissions.market, trend, rail "You and the rivals" (src/components/admissions/views/Lines.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS, R-ADM-VIEW-MARKET |
| Used on | Admissions Market share › Entry point › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. Rivals' average: the mean of the rivals' counts that year (rivals with a figure only; your school not included).<br>4. Set both lines to 100 in the first year they both have a figure; every other year is its figure divided by that year's, times 100.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Index to whole numbers on the axis. |

### DV-ADM-M-VS-BARS — You and the rivals, bars

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-BARS |
| Title template | Your [entry-year] against the [rivals] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | VerticalBarsIcon |
| Host | admissions.market, trend, rail "You and the rivals, bars" (src/components/admissions/views/Bars.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-TRENDS |
| Used on | Admissions Market share › Entry point › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. Rivals' average: the mean of the rivals' counts that year (rivals with a figure only; your school not included).<br>4. Draw your count and the rivals' average side by side for each year (actual numbers, not indexed).<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Whole numbers in the hover. |

### DV-ADM-M-ACAD-RANK — Academic ranking

| Field | Content |
| --- | --- |
| Measures | M-ADM-RIVAL-RESULTS (Rivals' results) |
| Data | admissions.rivals |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | rank, change_points |
| Date mode | single |
| View type | ranking |
| Renderer | RD-ADM-STRENGTHS |
| Title template | Academic: your rank among the rivals |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | RankListIcon |
| Host | admissions.market, trend, rail "Academic ranking" (src/components/admissions/panels/Academic.tsx) |
| Audience | academic, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-ACADEMIC, R-ADM-RIVAL-RANKS |
| Used on | Admissions Market share › Rivals › Trends |
| Note | — |
| Method | 1. Pick the stage from the entry point: 4+ (ages up to 10) KS2 reading, writing and maths at the expected standard; 11+ GCSE Attainment 8; 16+ A-level points per entry.<br>2. Your rank: 1 plus the number of ranked rivals with a higher headline, out of you and the rivals that have a ranked figure.<br>3. Your place in England: among every school with a figure that year (at 11+ leaving out IGCSE-heavy schools), highest first, ties sharing.<br>4. Change: your headline now minus 2022/23, in points.<br>5. Where you lead and trail: the three subject areas with the biggest lead and the two with the biggest gap behind (as in Strengths and weaknesses; not at KS2).<br>Sources: DfE performance tables: KS2 , KS4 and KS5 whole-school headlines and subject-family results, 2022/23 to the latest results year<br>Rounding: Change to 1 decimal place; gaps to 2 decimal places. |

### DV-ADM-M-ACAD-NUM — Academic numbers

| Field | Content |
| --- | --- |
| Measures | M-ADM-RIVAL-RESULTS (Rivals' results) |
| Data | admissions.rivals |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | points, rank |
| Date mode | single |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Academic: the rivals' headline figures |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmNumbersIcon |
| Host | admissions.market, trend, rail "Academic numbers" (src/components/admissions/panels/Academic.tsx) |
| Audience | academic, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-ACADEMIC |
| Used on | Admissions Market share › Rivals › Trends |
| Note | — |
| Method | 1. Pick the stage's headline from the entry point (KS2 expected standard %, GCSE Attainment 8, or A-level points per entry).<br>2. List each school's figure in the latest results year, highest first.<br>3. Beside it, its place in England among every school with a figure (at 11+ leaving out IGCSE-heavy schools), ties sharing.<br>Sources: DfE performance tables: KS2 , KS4 and KS5 whole-school headlines and subject-family results, 2022/23 to the latest results year<br>Rounding: Figures to 1 decimal place. |

### DV-ADM-M-ACAD-CHANGE — Academic change

| Field | Content |
| --- | --- |
| Measures | M-ADM-RIVAL-RESULTS (Rivals' results) |
| Data | admissions.rivals |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | change_points |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-BARS |
| Title template | Academic: change since 2022/23 |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | ChangeArrowIcon |
| Host | admissions.market, trend, rail "Academic change" (src/components/admissions/panels/Academic.tsx) |
| Audience | academic, market |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-ACADEMIC |
| Used on | Admissions Market share › Rivals › Trends |
| Note | — |
| Method | 1. Pick the stage's headline from the entry point.<br>2. For each school, take its headline in the latest results year minus its headline in 2022/23, in points.<br>3. Draw the changes as bars either side of zero, biggest rise first.<br>Sources: DfE performance tables: KS2 , KS4 and KS5 whole-school headlines and subject-family results, 2022/23 to the latest results year<br>Rounding: Changes to 1 decimal place. |

### DV-ADM-M-SHARE-LINE — Market share

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | market_share |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | Your market share at [entry], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TrendLineIcon |
| Host | admissions.market, trend, rail "Market share" (src/components/admissions/views/Lines.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-GROUP-SHARE |
| Used on | Admissions Market share › Trends › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. For each year, add up the group's total and divide your count by it for your share; rank the schools by count (ties share).<br>4. Draw your share year by year (needs at least two years).<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Share to 1 decimal place. |

### DV-ADM-M-SHARE-NUM — Market share numbers

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | totals, market_share |
| Date mode | trend |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Your market share at [entry], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmNumbersIcon |
| Host | admissions.market, trend, rail "Market share numbers" (src/components/admissions/views/Tables.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET |
| Used on | Admissions Market share › Trends › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. For each year, add up the group's total and divide your count by it for your share; rank the schools by count (ties share).<br>4. List a row per year: your count, the group's total and your share.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Counts to whole numbers; share to 1 decimal place. |

### DV-ADM-M-SHARE-RANKS — Market share ranks

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | rank |
| Date mode | trend |
| View type | table |
| Renderer | RD-ADM-TABLE |
| Title template | Your rank at [entry], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | HorizontalBarsIcon |
| Host | admissions.market, trend, rail "Market share ranks" (src/components/admissions/views/Tables.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET |
| Used on | Admissions Market share › Trends › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. For each year, add up the group's total and divide your count by it for your share; rank the schools by count (ties share).<br>4. List a row per year: your count, the group's total and your rank 'of' the schools with a figure that year.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Whole numbers. |

### DV-ADM-M-SHARE-CHANGE — Change in share

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | pct_change, change_pp |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-BARS |
| Title template | Change in share at [entry] since 2019/20 |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | ChangeArrowIcon |
| Host | admissions.market, trend, rail "Change in share" (src/components/admissions/views/Bars.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET |
| Used on | Admissions Market share › Trends › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals (the lead's saved rivals list, else the 10 nearest schools of any sector that teach the entry year and the year after), narrowed by the sector and boarding filters.<br>2. For each school, count pupils at the entry age in each January census (full-time only from age 4). A school with no census that year has no figure and adds nothing to the total. With the girls/boys filter on, girls or boys only.<br>3. For each year, add up the group's total and divide your count by it for your share; rank the schools by count (ties share).<br>4. For each school, take its share in the latest year minus its share in the first year, in percentage points.<br>5. Draw the changes as bars either side of zero, biggest gain first.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 and 2025/26<br>Rounding: Change to 1 decimal place (points). |

### DV-ADM-M-ROLL-LINE — Entry age band roll

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share), M-ADM-PUPILS (Pupils by age) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | [entry age band] roll, indexed: you and the [rivals] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | AdmRollIcon |
| Host | admissions.market, trend, rail "Entry age band roll" (src/components/admissions/views/Lines.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-ROLL-INDEXED |
| Used on | Admissions Market share › Trends › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals, narrowed by the sector and boarding filters.<br>2. Set the age band from the entry age to the end of its phase: 4+ ages 4-10, 11+ ages 11-15, 16+ ages 16-18.<br>3. For each school and census year, add up its pupils across those ages (full-time from age 4). With the girls/boys filter on, girls or boys only.<br>4. The rivals' average: the mean of the rivals' band rolls, each year, over the rivals with a figure in every year.<br>5. Index your line and the average to the first year both have (= 100). In full screen each rival is indexed to the same year, or to its own first year where it has none then, in its own colour with a key.<br>6. In the panel: you against the rivals' average. In full screen: you and each rival.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Index to whole numbers (hover: the pupils behind it). |

### DV-ADM-M-SHARE-BAND — Share of Years 7–11

| Field | Content |
| --- | --- |
| Measures | M-ADM-MARKET (Market share) |
| Data | admissions.market |
| Results sub-measures | — |
| Phases | — |
| Focus | entry_point |
| Compare | schools |
| Number types | market_share |
| Date mode | trend |
| View type | graph |
| Renderer | RD-ADM-LINE |
| Title template | Your share of [entry age band], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | entryPoint, filters |
| Rail icon | TrendLineIcon |
| Host | admissions.market, trend, rail "Share of Years 7–11" (src/components/admissions/views/Lines.tsx) |
| Audience | market, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md) |
| Rules | R-ADM-VIEW-MARKET, R-ADM-GROUP-SHARE, R-ADM-BAND-SHARE |
| Used on | Admissions Market share › Trends › Trends |
| Note | — |
| Method | 1. Take the group: your school plus the rivals, narrowed by the sector and boarding filters.<br>2. For each school and census year, add up its pupils across as shown (11+: ages 11-15; 16+: 16-18; 4+: 4-10), full-time from age 4. With the girls/boys filter on, girls or boys only.<br>3. Each year, your total divided by the group's total is your share of as shown.<br>4. Draw one point per year, joined as a line.<br>Sources: DfE school census (January), pupils by single age and sex, 2019/20 to 2025/26<br>Rounding: Share to 1 decimal place. |

### DV-SMT-O-NOW — The school now

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-SMT-RESULTS (Headline results and ranks), M-SMT-VA (Value added) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools, averages |
| Number types | totals, pct_change, rank |
| Date mode | single |
| View type | numerical |
| Renderer | RD-SMT-NOW |
| Title template | The school now |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TilesIcon |
| Host | smt.overview, current, rail "The school now" (src/components/smt/views/Now.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-NOW, R-SMT-P8-REASON, R-SMT-BOARDING-ONLY |
| Used on | SMT Overview › The school now › Now |
| Note | — |
| Method | 1. We take the school's roll from its latest January census, after the Pupils or Day and boarding filter if one is set, and compare it with the 2019/20 census as a percentage change.<br>2. Girls and boys are each shown as a share of girls plus boys; a boarding school shows day pupils and boarders instead.<br>3. For each phase the school teaches we show its headline result for the latest year (Attainment 8, A-level points per entry, or KS2 reading, writing and maths) and its rank among every school in England with that result (at GCSE leaving out IGCSE schools), highest first, ties sharing a place.<br>4. A-level value added and Progress 8 are shown as DfE published them; where Progress 8 is missing, the reason that applies is given instead.<br>5. Size by phase counts the school's pupils in each age band (Primary 5-10, Senior 11-15, 16+ 16-18, and Early Years and 19+ where held) and places them in national fifths for that band, XS (smallest fifth) to XL (largest).<br>Sources: DfE school census (January), the school's own rows from 2019/20; DfE school census, rolls by phase band (national fifths and LA mean roll per phase band); DfE KS4 and KS5 performance tables (Attainment 8, A-level points per entry, A-level value added, Progress 8); DfE KS2 performance tables (reading, writing and maths at the expected standard)<br>Rounding: Roll and pupil counts to whole pupils Change since 2019/20 to a whole per cent Girls and boys to whole per cent Attainment 8 to 1 dp; A-level points per entry to 2 dp; KS2 per cent to 1 dp Value added and Progress 8 signed, to 2 dp |

### DV-SMT-O-SCORECARD — Scorecard

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks), M-SMT-SCHOOL (The school: roll, phases and size), M-SMT-VA (Value added) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools, averages |
| Number types | points, rank, change_points |
| Date mode | single |
| View type | table |
| Renderer | RD-SMT-SCORECARD |
| Title template | How [school] compares, headline by headline |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.overview, current, rail "Scorecard" (src/components/smt/views/Scorecard.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-SCORECARD, R-SMT-SET-RANKS, R-SMT-IGCSE-WORDING, R-TREND-FROM-2223 |
| Used on | SMT Overview › Scorecard › Now |
| Note | — |
| Method | 1. Each row is one headline: roll (and boarders at a boarding school), Attainment 8 and grade 5+ in English and maths (GCSE), A-level points per entry and A-level value added (Post-16), KS2 reading, writing and maths (Primary), and market share at 11+.<br>2. 'You' is the school's figure for the latest year.<br>3. The set column ranks the school among the set's schools that have that result, the school counted too: highest first, ties share a place, and the count shows how many were ranked.<br>4. The region and England columns rank the school among every school with that result in its region and in England (at GCSE leaving out IGCSE schools). For the roll, schools are ranked by whole roll among schools that teach the school's main phase.<br>5. 'Since' is the change from 2022/23 to the latest year (points, or percentage points for grade 5+); for the roll and boarders it is the percentage change since 2019/20.<br>6. Under the table, the flags line lists any flags from the Flags view.<br>Sources: DfE school census (January); DfE KS4 and KS5 performance tables (KS4, KS5); DfE KS2 performance tables; Admissions' saved 11+ rivals and the census (market share row)<br>Rounding: Ranks are whole numbers Roll to whole pupils; roll change to a whole per cent Attainment 8 to 1 dp; A-level points per entry to 2 dp; per cents to 1 dp; value added to 2 dp Points and percentage-point changes to 1 dp |

### DV-SMT-O-MAP — Map

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | totals |
| Date mode | single |
| View type | map |
| Renderer | RD-SMT-MAP |
| Title template | [school] and [set] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | MapPinIcon |
| Host | smt.overview, current, rail "Map" (src/components/smt/views/SetMap.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-MAP |
| Used on | SMT Overview › Scorecard › Now |
| Note | — |
| Method | 1. We take the school and every school in the chosen comparison set.<br>2. Each school with a recorded location is placed on the map; the school is ringed in the accent colour, the others in grey.<br>3. No figures are drawn; the key gives the number of schools in the set.<br>Sources: School locations (easting and northing) from the schools table<br>Rounding: None |

### DV-SMT-O-FLAGS — Flags

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-SMT-RESULTS (Headline results and ranks) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | pct_change, change_points |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-FLAGS |
| Title template | Flags: large and lasting changes at [school] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | FlagIcon |
| Host | smt.overview, current, rail "Flags" (src/components/smt/views/Flags.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-FLAGS |
| Used on | SMT Overview › Scorecard › Now |
| Note | — |
| Method | 1. Roll falling: the whole roll fell in each of the last three year-on-year moves (four consecutive censuses), starting from at least 50 pupils.<br>2. Entry cohort shrinking: the school's pupils at its entry age (11 for a school with a GCSE phase starting at 11 or younger, else Reception age for a primary, else 16) changed over two years by as much as or more than the national bottom-fifth threshold for that phase's entry cohorts.<br>3. Results faster than the set: we take the school's change in its headline (Attainment 8, or A-level points per entry) over two years, and the middle (median) change of the set's schools with both years.<br>4. The results flag shows when the school's change differs from the set's middle by at least 2 Attainment 8 points or 3 A-level points, and at least 4 set schools have both years.<br>5. Each flag shows the figures behind it.<br>Sources: DfE school census (January); DfE KS4 and KS5 performance tables (Attainment 8, A-level points per entry); Admissions' national flag thresholds<br>Rounding: Results change and set middle to 2 dp in the flag's figures |

### DV-SMT-O-ROLL-LINE — Roll, indexed

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Roll, indexed (the first year every line shares = 100) |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | IndexedLineIcon |
| Host | smt.overview, trend, rail "Roll, indexed" (src/components/smt/views/Lines.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS |
| Used on | SMT Overview › The school now › Trends |
| Note | — |
| Method | 1. We take the school's roll in each January census from 2019/20 (after any Pupils or Day and boarding filter). A boarding school with no boarding filter shows a day line and a boarding line instead.<br>2. For the local authority and England we add up pupils aged 5 to 15 in the census aggregates each year (England is the nine regions added together).<br>3. We find the first year every line has a figure and set each line to 100 in that year.<br>4. Each later year is that year's figure divided by the base year's, times 100.<br>5. Growing or shrinking compares this year's roll with three years ago. The word is 'Growing' or 'Shrinking' when the change rounds to at least 1%, otherwise 'Steady'. A school with fewer than four census years is measured from its first.<br>Sources: DfE school census (January), the school's own; DfE school census, summed by area (census pupils by age, per LA and per region)<br>Rounding: Index values to whole numbers |

### DV-SMT-O-ROLL-TABLE — Roll, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals, index100 |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | Roll, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.overview, trend, rail "Roll, table" (src/components/smt/views/Tables.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS |
| Used on | SMT Overview › The school now › Trends |
| Note | — |
| Method | 1. The table shows the figures behind the Roll, indexed chart, one row per census year.<br>2. Each line (the school, or day and boarding, then the LA and England) has two columns: its pupils, and its index, set to 100 in the first year all lines share.<br>3. The LA and England columns are pupils aged 5 to 15 in the census aggregates, not total rolls.<br>Sources: DfE school census (January), the school's own; DfE school census, summed by area (census pupils by age, per LA and per region)<br>Rounding: Pupils and index values to whole numbers |

### DV-SMT-O-RESULTS-LINE — Results trend

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | points |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Headline results against [set] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TrendLineIcon |
| Host | smt.overview, trend, rail "Results trend" (src/components/smt/views/Lines.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS, R-TREND-FROM-2223, R-IGCSE-EXCL |
| Used on | SMT Overview › Scorecard › Trends |
| Note | — |
| Method | 1. For GCSE we use Attainment 8 and for Post-16 A-level points per entry; where the school has both, chips switch between them. This view is whole-school and does not follow the level.<br>2. The line is the school's figure each year from 2021/22.<br>3. For each year we take the set's other schools with a figure (leaving out IGCSE schools at GCSE) and find the 25th and 75th percentiles; the shaded band runs between them.<br>4. 2021/22 is shaded because grades that year were more generous.<br>5. The word under the chart compares the school's 2022/23 figure with its latest: more than 0.5 points up is 'Rising', more than 0.5 down 'Falling', otherwise 'Steady'. With fewer than 4 years, the points are drawn but not called a trend.<br>Sources: DfE KS4 and KS5 performance tables (Attainment 8; A-level points per entry)<br>Rounding: Attainment 8 to 1 dp; A-level points per entry to 2 dp |

### DV-SMT-O-RESULTS-TABLE — Results, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | points |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | Headline results against [set], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.overview, trend, rail "Results, table" (src/components/smt/views/Tables.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS, R-TREND-FROM-2223 |
| Used on | SMT Overview › Scorecard › Trends |
| Note | — |
| Method | 1. One row per year from 2021/22, for Attainment 8 (GCSE) or A-level points per entry (Post-16).<br>2. 'You' is the school's figure that year.<br>3. The middle half is the 25th to 75th percentile of the set's other schools with a figure that year.<br>4. 'Schools' is how many set schools had a figure that year.<br>Sources: DfE KS4 and KS5 performance tables (Attainment 8; A-level points per entry)<br>Rounding: Attainment 8 to 1 dp; A-level points per entry to 2 dp |

### DV-SMT-O-MARKET-LINE — Market share

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-ADM-MARKET (Market share) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | market_share |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Market share at 11+, against your rivals |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TrendLineIcon |
| Host | smt.overview, trend, rail "Market share" (src/components/smt/views/Lines.tsx) |
| Audience | market, whole-school |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS, R-ADM-GROUP-SHARE |
| Used on | SMT Overview › From Admissions › Trends |
| Note | Admissions' figures, read-only: an empty state with the reason where the school has no Admissions rivals at 11+. |
| Method | 1. We take the school's pupils aged 11 in each January census.<br>2. We add up pupils aged 11 across the school and its saved 11+ rivals.<br>3. The school's share is its pupils divided by that total, as a percentage.<br>4. The grey line is the rival with the largest share in the latest year.<br>5. The word under the chart compares 2022/23 with the latest year: more than 0.5 points up is 'Gaining share', down 'Losing share'.<br>Sources: DfE school census (January), age 11 pupils; Admissions' saved 11+ rival lists<br>Rounding: Shares to 1 dp per cent |

### DV-SMT-O-MARKET-TABLE — Market share, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-ADM-MARKET (Market share) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | market_share |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | Market share at 11+, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.overview, trend, rail "Market share, table" (src/components/smt/views/Tables.tsx) |
| Audience | market, whole-school |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS, R-ADM-GROUP-SHARE |
| Used on | SMT Overview › From Admissions › Trends |
| Note | — |
| Method | 1. One row per census year.<br>2. 'You' is the school's pupils aged 11 as a share of all pupils aged 11 across the school and its saved rivals.<br>3. The second column is the same share for the rival with the largest share in the latest year.<br>Sources: DfE school census (January), age 11 pupils; Admissions' saved 11+ rival lists<br>Rounding: Shares to 1 dp per cent |

### DV-SMT-A-NOW — The level now

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks), M-SMT-VA (Value added), M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | totals, points, rank |
| Date mode | single |
| View type | numerical |
| Renderer | RD-SMT-NOW |
| Title template | [level] now |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TilesIcon |
| Host | smt.academic, current, rail "The level now" (src/components/smt/views/AcademicNow.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-ACADEMIC-NOW, R-SMT-P8-REASON, R-SMT-VA-HONEST |
| Used on | SMT Academic › The level now › Now |
| Note | — |
| Method | 1. The level chip picks what is shown: Whole school shows each phase the school has, Primary shows KS2, GCSE or Post-16 shows that phase, and a subject area narrows it further.<br>2. Entries are the school's subject entries in the latest year (with an area chosen, the area's entries and their share of all the phase's entries).<br>3. The headline is Attainment 8 and grade 5+ in English and maths (GCSE), or A-level points per entry and A-level value added (Post-16), or reading, writing and maths at the expected standard (KS2). Each shows its rank in the set among schools with that result; if there is no set rank, its England rank.<br>4. With a subject area chosen, the average grade (GCSE) or points per entry (Post-16) for the area's subjects is shown, and its rank among the set's schools with 10 or more entries in that area is its own tile, shown only when the school and at least 2 set schools have that many.<br>5. The top-grades tile is the share of graded entries in the main qualification at grade 7 and above (GCSE) or A*-A (A level).<br>6. Value added and a small grade profile bar follow, with Progress 8's reason where it isn't published.<br>Sources: DfE KS4 and KS5 performance tables; DfE KS2 performance tables; DfE KS4 and KS5 subject tables (subject area averages); the school's subject and grade rows<br>Rounding: Entries to whole numbers; area share of entries to a whole per cent Attainment 8 to 1 dp; A-level points per entry to 2 dp; average grade to 2 dp Per cents to 1 dp Value added signed, 2 dp Ranks whole numbers |

### DV-SMT-A-AREAS — Subject areas

| Field | Content |
| --- | --- |
| Measures | M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.subjects |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | points, change_points, rank |
| Date mode | single |
| View type | graph |
| Renderer | RD-SMT-AREAS |
| Title template | Where [school] leads and trails [set], by subject area |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | AdmStrengthsIcon |
| Host | smt.academic, current, rail "Subject areas" (src/components/smt/views/Areas.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-AREAS, R-ADM-FLAG-STRENGTHS, R-SMT-SET-RANKS |
| Used on | SMT Academic › Subjects › Now |
| Note | — |
| Method | 1. For each subject area the school entered, we take its average points per entry in the latest year, counted only where it has at least 10 entries; set schools likewise.<br>2. The gap is the school's average minus the average of the set's schools with a figure (IGCSE schools left out at GCSE).<br>3. The rank is the school's place among those schools and itself, highest first, ties sharing a place.<br>4. 'Since 2022/23' shows whether the gap has widened or narrowed since 2022/23.<br>5. A strength is a positive gap in the top third of the set; a weakness a negative gap in the bottom third. 'Growing' or 'widening' is added when the gap has moved further since 2022/23 and the school's own two-year change passes the national threshold. Flags need at least two set schools.<br>6. The overall line ranks the school in the set on Attainment 8 or A-level points per entry.<br>Sources: DfE KS4 and KS5 subject tables (each school's average points and entries per subject area); Admissions' national subject-area thresholds<br>Rounding: Gap and averages to 2 dp in the hover Direction word steady within 0.05 points |

### DV-SMT-A-SUBJECTS — Subjects

| Field | Content |
| --- | --- |
| Measures | M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.subjects |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | totals, points, rank, change_points |
| Date mode | single |
| View type | table |
| Renderer | RD-SMT-SUBJECTS |
| Title template | Each subject, its rank, and where it's heading |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.academic, current, rail "Subjects" (src/components/smt/views/Subjects.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-SUBJECTS, R-SMT-SMALL-ENTRIES, R-TREND-FROM-2223 |
| Used on | SMT Academic › Subjects › Now |
| Note | — |
| Method | 1. We list the school's subjects in the latest year (in the chosen area, if any), most entries first, up to 16.<br>2. A subject with fewer than 5 entries is listed but not ranked.<br>3. For the rest we take the average points for that subject (and qualification) at the school and at each set school, counting only schools with at least 5 entries.<br>4. The set rank is the school's place among those schools, highest first, ties sharing a place; the England rank is the same across every school in England with that subject (at GCSE leaving out IGCSE schools).<br>5. 'Since 2022/23' is the change in the school's average from 2022/23 to the latest year.<br>Sources: DfE KS4 and KS5 subject tables (GCSE subject average points); DfE KS4 and KS5 subject tables (Post-16 per qualification type); the subject grade rollup (GCSE double award)<br>Rounding: GCSE average grade to 2 dp; Post-16 points to 1 dp Change to 2 dp, steady within 0.05 Ranks whole numbers |

### DV-SMT-A-VA — Value added

| Field | Content |
| --- | --- |
| Measures | M-SMT-VA (Value added) |
| Data | smt.value_added |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | points |
| Date mode | single |
| View type | table |
| Renderer | RD-SMT-VA |
| Title template | Value added |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | AdmNumbersIcon |
| Host | smt.academic, current, rail "Value added" (src/components/smt/views/ValueAdded.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VA-HONEST, R-SMT-P8-REASON |
| Used on | SMT Academic › Subjects › Now |
| Note | — |
| Method | 1. Progress 8 (GCSE) is shown as DfE published it, with its year and 95% range; where it isn't published, the reason that applies is shown instead.<br>2. A-level value added is shown for each qualification type DfE publishes, for the latest two years, with DfE's 95% range and banding.<br>3. Each figure is drawn as a dot on a line where 0 is the national average; the dot is coloured only when the whole range is above or below 0.<br>4. Subject value added is shown for the latest year, largest entries first, up to 14 subjects.<br>Sources: DfE KS4 and KS5 performance tables (Progress 8 and its 95% interval; A-level, Academic, Applied general, Tech level value added with interval and banding); DfE KS5 value added by subject (subject value added)<br>Rounding: Value added signed, to 2 dp Chart axis runs from -1.2 to +1.2; values beyond are drawn at the edge |

### DV-SMT-A-GRADES — Grade profile

| Field | Content |
| --- | --- |
| Measures | M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.subjects |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-SMT-GRADES |
| Title template | Grade profile |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | HorizontalBarsIcon |
| Host | smt.academic, current, rail "Grade profile" (src/components/smt/views/Grades.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-GRADES |
| Used on | SMT Academic › Subjects › Now |
| Note | — |
| Method | 1. We take the school's entries in the main qualification for the latest year: GCSE (9-1) full course, or GCE A level, in the chosen area if any.<br>2. We group the graded entries into bands: GCSE 9-7, 6-5, 4, and 3-1 (with U); A level A*-A, B, C, and D-U (D, E and U).<br>3. Each band is its entries as a share of all graded entries in those bands.<br>Sources: The school's grade rows<br>Rounding: Shares to 1 dp per cent Entries to whole numbers |

### DV-SMT-A-TREND-LINE — Results trend

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks), M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | points |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | [level] results against [set] |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TrendLineIcon |
| Host | smt.academic, trend, rail "Results trend" (src/components/smt/views/Lines.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS, R-TREND-FROM-2223 |
| Used on | SMT Academic › The level now › Trends |
| Note | — |
| Method | 1. At Whole school, GCSE or Post-16 (all areas) the line is Attainment 8 or A-level points per entry each year from 2021/22; at Whole school, chips switch between phases.<br>2. With a subject area chosen, the line is the area's average grade (GCSE) or points per entry (Post-16).<br>3. For each year the band runs from the 25th to the 75th percentile of the set's other schools with a figure (IGCSE schools left out at GCSE).<br>4. 2021/22 is shaded because grades that year were more generous.<br>5. The word under the chart compares 2022/23 with the latest year: a move of more than 0.5 points (0.05 for an area's average) is 'Rising' or 'Falling', otherwise 'Steady'.<br>Sources: DfE KS4 and KS5 performance tables (Attainment 8, A-level points per entry); DfE KS4 and KS5 subject tables (an area's average points)<br>Rounding: Attainment 8 to 1 dp; A-level points per entry to 2 dp; average grade to 2 dp |

### DV-SMT-A-TREND-TABLE — Results, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks), M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | points |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | [level] results against [set], year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.academic, trend, rail "Results, table" (src/components/smt/views/Tables.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS, R-TREND-FROM-2223 |
| Used on | SMT Academic › The level now › Trends |
| Note | — |
| Method | 1. One row per year from 2021/22, for the headline (or the chosen area's average).<br>2. 'You' is the school's figure that year.<br>3. The middle half is the 25th to 75th percentile of the set's other schools with a figure that year.<br>4. 'Schools' is how many set schools had a figure.<br>Sources: DfE KS4 and KS5 performance tables; DfE KS4 and KS5 subject tables<br>Rounding: Attainment 8 to 1 dp; A-level points per entry to 2 dp; average grade to 2 dp |

### DV-SMT-A-BANDS — Results by band

| Field | Content |
| --- | --- |
| Measures | M-SMT-RESULTS (Headline results and ranks) |
| Data | smt.results |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | points |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-RESERVED |
| Title template | Top 25%, middle 50%, bottom 25% |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TrendLineIcon |
| Host | smt.academic, trend, rail "Results by band" (src/components/smt/views/Reserved.tsx) |
| Audience | whole-school, academic |
| Status | draft |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-RESERVED |
| Used on | SMT Academic › Subjects › Trends |
| Note | Reserved: arrives with the results-by-band round (roadmap step 4). The slot exists; the data doesn't yet. |
| Method | 1. This panel is reserved: the slot exists but no data is drawn yet.<br>2. It will show results for the top 25%, middle 50% and bottom 25% of entries when that round arrives.<br>3. Until then, the panel shows only this note and no figure.<br>Sources: None yet (reserved panel)<br>Rounding: None |

### DV-SMT-A-MIX — Entries mix

| Field | Content |
| --- | --- |
| Measures | M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.subjects |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-MIX |
| Title template | Entries mix, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | VerticalBarsIcon |
| Host | smt.academic, trend, rail "Entries mix" (src/components/smt/views/Mix.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-MIX |
| Used on | SMT Academic › Entries › Trends |
| Note | — |
| Method | 1. We take the school's entries for each subject each year from 2021/22.<br>2. At All areas we group them by subject area; with an area chosen, by subject within it.<br>3. The six groups with the most entries over all the years are shown by name; everything else is 'The rest'.<br>4. Each column is one year: each group's entries as a share of that year's total.<br>Sources: The school's subject headline rollup<br>Rounding: Shares to 1 dp per cent (in hovers) |

### DV-SMT-A-MIX-TABLE — Entries mix, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-SUBJECTS (Subject areas and subjects) |
| Data | smt.subjects |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | Entries mix, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.academic, trend, rail "Entries mix, table" (src/components/smt/views/Tables.tsx) |
| Audience | whole-school, academic |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-MIX |
| Used on | SMT Academic › Entries › Trends |
| Note | — |
| Method | 1. One row per year from 2021/22.<br>2. Each column is a subject area (or a subject, with an area chosen): its share of that year's entries. The six largest are named; the rest are combined.<br>3. The last column is the year's total entries.<br>Sources: The school's subject headline rollup<br>Rounding: Shares to 1 dp per cent Entries to whole numbers |

### DV-SMT-P-NOW — Your pupils now

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals, pct_change |
| Date mode | single |
| View type | numerical |
| Renderer | RD-SMT-NOW |
| Title template | Your pupils now |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TilesIcon |
| Host | smt.pupils, current, rail "Your pupils now" (src/components/smt/views/Pupils.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-PUPILS-NOW, R-SMT-BOARDING-ONLY, R-SMT-PUPILS-LEVEL, R-SMT-Y12-AGAINST-Y11 |
| Used on | SMT Pupils › Your pupils now › Now |
| Note | — |
| Method | 1. The roll is the school's latest January census (after any Pupils or Day and boarding filter), with its percentage change since 2019/20.<br>2. Girls and boys (mixed schools) are each a share of girls plus boys; boarding schools also show day pupils and boarders.<br>3. Year 12 against Year 11 is this year's pupils aged 16 divided by last year's pupils aged 15 at the school: below 100% when more leave than join at 16, above when more join.<br>4. Size by phase places the school's pupils in each age band in national fifths, XS to XL.<br>5. The context line gives the main phase's badge and compares the school with the LA's and England's average roll for that phase.<br>Sources: DfE school census (January), the school's own; DfE school census, rolls by phase band<br>Rounding: Roll to whole pupils Change to a whole per cent Girls and boys to whole per cent Year 12 against Year 11 to a whole per cent |

### DV-SMT-P-SHAPE — Shape and size

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-SMT-SHAPE |
| Title template | Pupils in each year group |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | AdmShapeIcon |
| Host | smt.pupils, current, rail "Shape and size" (src/components/smt/views/Pupils.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-SHAPE, R-ADM-SHAPE-NOT-RANKED, R-SMT-PUPILS-LEVEL, R-SMT-Y12-AGAINST-Y11 |
| Used on | SMT Pupils › Shape and size › Now |
| Note | — |
| Method | 1. Bars show the school's pupils at each age from Reception (age 4) to Year 13 (age 17) in the latest census; the level's ages are highlighted: GCSE Years 7 to 11 (ages 11 to 15), Post-16 Years 12 and 13 (16 and 17), Primary Reception to Year 6 (4 to 10).<br>2. The shape is the shared classifier's label for the school's pupils by age; 'since' is the year after the last census when it was different.<br>3. For the LA we take nearby schools in the same LA with exactly the same age range and show the most common shape and how many had it.<br>4. For the set we count how many schools have each shape, never ranking them.<br>5. The set's Year 12 against Year 11 is the middle (median) of that figure across set schools whose top age is 17 or more.<br>Sources: DfE school census (January): the school, nearby schools, the comparison set's schools; VicData's shape descriptions<br>Rounding: Year 12 against Year 11 to a whole per cent |

### DV-SMT-P-ENTRIES — Entry points

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-ADM-POOL (Pipeline (the pool)) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | single |
| View type | table |
| Renderer | RD-SMT-ENTRIES |
| Title template | Entry points at a glance |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | AdmFunnelIcon |
| Host | smt.pupils, current, rail "Entry points" (src/components/smt/views/Pupils.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-ADMISSIONS-READ-ONLY, R-ADM-POOL-NOT-INTAKE |
| Used on | SMT Pupils › Shape and size › Now |
| Note | — |
| Method | 1. We read the entry points the school's Admissions lead has saved.<br>2. 'Cohort now' is the school's own pupils at that entry point now, as Admissions' pipeline counts them.<br>3. 'The pool, next entry' is the first future rung of Admissions' ladder: children counted in the feeder schools now, followed forward, or, further ahead, estimated from births.<br>4. Nothing is edited here; each row links to Admissions.<br>Sources: Admissions' saved entry points and feeder lists; Admissions' pipeline (census counts, then ONS births by LA)<br>Rounding: Whole pupils |

### DV-SMT-P-LEAVING — Leaving at 16

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals, pct_change |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-LEAVING |
| Title template | Leaving at 16 |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | ChangeArrowIcon |
| Host | smt.pupils, current, rail "Leaving at 16" (src/components/smt/views/Pupils.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-LEAVING, R-ADM-JOINERS-ESTIMATE, R-SMT-Y12-AGAINST-Y11 |
| Used on | SMT Pupils › Shape and size › Now |
| Note | — |
| Method | 1. For each year, we take the school's pupils aged 16 (Year 12) and its pupils aged 15 (Year 11) in the census the year before.<br>2. Year 12 against Year 11 is Year 12 divided by last year's Year 11.<br>3. Net leavers is last year's Year 11 minus this year's Year 12; if Year 12 is larger, it shows how many more joined.<br>Sources: DfE school census (January), the school's own<br>Rounding: Per cent to a whole number Pupils to whole numbers |

### DV-SMT-P-MARKET — Market share

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-ADM-MARKET (Market share) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | schools |
| Number types | market_share |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Market share at 11+, against your rivals |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | DonutIcon |
| Host | smt.pupils, current, rail "Market share" (src/components/smt/views/Lines.tsx) |
| Audience | market, whole-school |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-ADMISSIONS-READ-ONLY, R-ADM-GROUP-SHARE |
| Used on | SMT Pupils › Shape and size › Now |
| Note | — |
| Method | 1. We take the school's pupils aged 11 in each January census.<br>2. We add up pupils aged 11 across the school and its saved 11+ rivals.<br>3. The school's share is its pupils divided by that total, as a percentage.<br>4. The grey line is the rival with the largest share in the latest year.<br>Sources: DfE school census (January), age 11 pupils; Admissions' saved 11+ rival lists<br>Rounding: Shares to 1 dp per cent |

### DV-SMT-P-PHASES — Roll by phase

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Roll by phase, indexed (the first year every line shares = 100) |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | IndexedLineIcon |
| Host | smt.pupils, trend, rail "Roll by phase" (src/components/smt/views/Lines.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS |
| Used on | SMT Pupils › Your pupils now › Trends |
| Note | — |
| Method | 1. For each phase the school has, we add up its pupils in that age band each year: Primary 5-10, Senior 11-15, 16+ 16-18 (girls or boys only if that filter is on).<br>2. England is pupils aged 5 to 15 in the census aggregates, the nine regions added together.<br>3. We set every line to 100 in the first year all lines have a figure, and show each year against it.<br>4. Growing or shrinking compares this year's roll with three years ago. The word is 'Growing' or 'Shrinking' when the change rounds to at least 1%, otherwise 'Steady'. A school with fewer than four census years is measured from its first.<br>Sources: DfE school census (January), the school's own; DfE school census, summed by area (regions)<br>Rounding: Index values to whole numbers |

### DV-SMT-P-PHASES-TABLE — Roll by phase, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | Roll by phase, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.pupils, trend, rail "Roll by phase, table" (src/components/smt/views/Tables.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS |
| Used on | SMT Pupils › Your pupils now › Trends |
| Note | — |
| Method | 1. One row per census year.<br>2. Each phase (and England) has two columns: its pupils, and its index, set to 100 in the first year all lines have a figure.<br>3. England's columns are pupils aged 5 to 15 in the census aggregates, the nine regions added together.<br>Sources: DfE school census (January), the school's own; DfE school census, summed by area (regions)<br>Rounding: Pupils and index values to whole numbers |

### DV-SMT-P-POOL — The pool

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size), M-ADM-POOL (Pipeline (the pool)) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | The pool for your main entry point |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | AdmPipelineIcon |
| Host | smt.pupils, trend, rail "The pool" (src/components/smt/views/Lines.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-ADMISSIONS-READ-ONLY, R-ADM-POOL-NOT-INTAKE, R-ADM-LADDER |
| Used on | SMT Pupils › Shape and size › Trends |
| Note | — |
| Method | 1. The main entry point is 11+ for a school with a GCSE phase starting at 11 or younger, else 4+ for a primary, else 16+.<br>2. We use the feeder lists the Admissions lead saved, or Admissions' nearby defaults where they can't be read.<br>3. The solid line is the pool counted in the feeder schools' census, year by entry year.<br>4. The dashed line continues from births: the area's births scaled to these schools, starting from the last counted year so the two join.<br>5. The word under the chart compares the last counted year with the end of the line: more than 2% up is 'Pool rising', down 'Pool falling'.<br>Sources: Admissions' pipeline: census counts in feeder schools, then ONS births by LA; Admissions' saved feeder lists, else its nearby defaults<br>Rounding: Whole pupils |

### DV-SMT-P-AREA — School-age population

| Field | Content |
| --- | --- |
| Measures | M-SMT-SCHOOL (The school: roll, phases and size) |
| Data | smt.school |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | The area's school-age population |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | AdmPopulationIcon |
| Host | smt.pupils, trend, rail "School-age population" (src/components/smt/views/Lines.tsx) |
| Audience | whole-school, rolls |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-TRENDS |
| Used on | SMT Pupils › Area › Trends |
| Note | — |
| Method | 1. We take the LA's residents by single year of age from ONS's mid-year estimates; a shire county is its districts added together.<br>2. At Whole school we add ages 5 to 15; at a level, its ages (GCSE 11-15, Post-16 16-17, Primary 4-10).<br>3. The solid line runs from mid-2019 to the latest estimate.<br>4. Where held, a dashed line continues with the LA's projection of children living there (not a forecast for the school); years whose ages include children not yet born are drawn lighter.<br>Sources: ONS mid-year population estimates by single year of age; the children-in-an-area projection for the LA<br>Rounding: Whole children |

### DV-SMT-C-NOW — The area now

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals, pct_change |
| Date mode | single |
| View type | numerical |
| Renderer | RD-SMT-NOW |
| Title template | The area now |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TilesIcon |
| Host | smt.context, current, rail "The area now" (src/components/smt/views/Context.tsx) |
| Audience | geography, whole-school |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-CONTEXT-NOW, R-SMT-CONTEXT-PLACE, R-SMT-CONTEXT-RESIDENTS, R-SMT-CONTEXT-DEPRIVATION, R-SMT-CONTEXT-FSM, R-SMT-CONTEXT-WORDING |
| Used on | SMT Context › The area now › Now |
| Note | — |
| Method | 1. The level picks the ages: GCSE 11-15, Post-16 16-17, Primary 4-10, Whole school the school's own age range.<br>2. Children: we add up residents of those ages in the counted neighbourhoods (or the LA) in the latest year, and compare with the first year held. Under it, the authority mix shows which councils those children live in.<br>3. Pupils nearby: we count pupils of those ages in the latest January census at the school and every school within the radius that teaches those ages, in any sector. This is shown beside the residents, never divided by them.<br>4. Births are the LA's births last calendar year, with the change since 2012.<br>5. The projection tile is the change in children of those ages living in the area from the latest count to five years on, with its range; it is a projection, not a forecast for the school.<br>6. Schools nearby counts other schools of the same phase within the radius (or every school in the LA).<br>7. Social context gives the IMD and IDACI deciles of the school's own neighbourhood, the share of children aged 0-15 within the radius living in each IDACI decile (deciles 1-2 against England's 20%), and the school's FSM % with its LA and England the same year. Deprivation describes the area, not the school's pupils.<br>Sources: ONS mid-year population estimates for neighbourhoods (LSOA 2021) (ONS LSOA residents by age, IDACI mix, authority mix, the school's own IMD and IDACI deciles); ONS mid-year population estimates by single year of age (LA residents); the children-in-an-area projection; ONS births by LA; DfE school census (pupils at nearby schools; DfE school census, summed by area for the latest year); DfE free school meals (Schools, pupils and their characteristics)<br>Rounding: Children, births and pupils to whole numbers Children and births change to a whole per cent Projection change and range to 1 dp per cent Authority mix to whole per cents Deprived 20% to a whole per cent FSM to 1 dp; FSM change to 1 dp points |

### DV-SMT-C-MAP — Map

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals |
| Date mode | single |
| View type | map |
| Renderer | RD-SMT-AREA-MAP |
| Title template | Where the school-age children live |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | MapPinIcon |
| Host | smt.context, current, rail "Map" (src/components/smt/views/Context.tsx) |
| Audience | geography, whole-school |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-CONTEXT-GEOGRAPHY, R-SMT-CONTEXT-WORDING |
| Used on | SMT Context › Map › Now |
| Note | — |
| Method | 1. We draw every neighbourhood whose boundary is within the radius plus 2 km; those whose population-weighted centre is inside the radius are the ones counted, and the circle marks the radius.<br>2. 'Children' shading: residents of the level's ages divided by the neighbourhood's area in hectares, split into five equal-sized groups of the neighbourhoods drawn.<br>3. 'IMD' or 'IDACI' shading: each neighbourhood's decile, 1 the most deprived 10% in England; this describes the area, not pupils.<br>4. 'Free school meals' shades schools, not areas: each school's latest FSM %, in bands under 10%, 10-20, 20-30, 30-40, 40% or more; independent schools are hollow because no figure is published.<br>5. With more than 2,500 neighbourhoods, each is drawn as a dot at its centre. Before neighbourhood boundaries are loaded, or with the Area pill on the LA, the region's local authorities are shaded by census pupils of those ages in their schools.<br>Sources: ONS neighbourhood estimates with IoD2025 deciles (residents by age, IMD and IDACI deciles, population-weighted centres); ONS LSOA (December 2021) boundaries (shapes and areas); DfE free school meals (Schools, pupils and their characteristics) (school FSM); DfE school census, summed by area and LA boundaries (district fallback)<br>Rounding: Density legend to 2, 1 or 0 dp depending on size FSM in hovers to 1 dp |

### DV-SMT-C-BYAGE — Population by age

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-SMT-AGES |
| Title template | Children by single year of age |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | VerticalBarsIcon |
| Host | smt.context, current, rail "Population by age" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-CONTEXT-GEOGRAPHY |
| Used on | SMT Context › Map › Now |
| Note | — |
| Method | 1. We take residents at each single age from 0 to 18 in the latest mid-year estimate, within the radius (or in the LA).<br>2. Each bar is one age; the level's ages are highlighted.<br>3. These are children living in the area, not pupils at its schools.<br>Sources: ONS mid-year population estimates for neighbourhoods (LSOA 2021) (LSOA residents by age); ONS mid-year population estimates by single year of age (LA residents)<br>Rounding: Whole children |

### DV-SMT-C-BIRTHS — Births and projections

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Births and projections |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TrendLineIcon |
| Host | smt.context, current, rail "Births and projections" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-BIRTHS |
| Used on | SMT Context › Map › Now |
| Note | — |
| Method | 1. The solid line is the LA's births each calendar year from 2012 (ONS).<br>2. The dashed line is the projection's middle line for children of the level's ages living in the area, from the latest count to the horizon.<br>3. The two lines are different counts in different areas, shown on one chart; the projection is not a forecast for the school.<br>Sources: ONS births by LA; the children-in-an-area projection (middle line)<br>Rounding: Whole births and children |

### DV-SMT-C-NEARBY — Children nearby over time

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-NEARBY |
| Title template | Children nearby over time |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | IndexedLineIcon |
| Host | smt.context, current, rail "Children nearby over time" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-CONTEXT-RESIDENTS, R-SMT-CONTEXT-WORDING |
| Used on | SMT Context › Map › Now |
| Note | — |
| Method | 1. We add up residents of the level's ages each year within the radius, in the LA (a shire county is its districts), and in England.<br>2. We find the first year all three have a figure and set each line to 100 then.<br>3. Each later year is that year's figure divided by the base year's, times 100.<br>4. These are children living in the area, not pupils.<br>Sources: ONS mid-year population estimates for neighbourhoods (LSOA 2021) (LSOA residents by age); ONS mid-year population estimates by single year of age (LA, and England as every English district and unitary added up)<br>Rounding: Index values to whole numbers; hovers give whole children |

### DV-SMT-C-BIRTHS-INDEXED — Births, indexed

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | index100 |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | Births, indexed |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | IndexedLineIcon |
| Host | smt.context, trend, rail "Births, indexed" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-BIRTHS |
| Used on | SMT Context › The area now › Trends |
| Note | — |
| Method | 1. We take the LA's births and England's births each calendar year from 2012.<br>2. We set both to 100 in the first year both have a figure (normally 2012).<br>3. Each later year is that year's births divided by the base year's, times 100.<br>4. The word under the chart compares the LA's first and latest years: more than 2% up is 'Rising', more than 2% down 'Falling'.<br>Sources: ONS births by LA<br>Rounding: Index values to whole numbers |

### DV-SMT-C-BIRTHS-TABLE — Births, table

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | averages |
| Number types | totals, index100 |
| Date mode | trend |
| View type | table |
| Renderer | RD-SMT-TABLE |
| Title template | Births, year by year |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TableIcon |
| Host | smt.context, trend, rail "Births, table" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-BIRTHS |
| Used on | SMT Context › The area now › Trends |
| Note | — |
| Method | 1. One row per calendar year from 2012.<br>2. The LA and England (the sum of every English district and unitary) each have two columns: actual births, and the index the chart draws, set to 100 in the first year both have a figure.<br>Sources: ONS births by LA<br>Rounding: Whole births; index values to whole numbers |

### DV-SMT-C-PROJECTION — Projection

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | trend |
| View type | graph |
| Renderer | RD-SMT-LINE |
| Title template | School-age population, projected |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | TrendLineIcon |
| Host | smt.context, trend, rail "Projection" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-VIEW-BIRTHS, R-SMT-FORWARD, R-SMT-NOT-A-FORECAST |
| Used on | SMT Context › Map › Trends |
| Note | — |
| Method | 1. For each age, we measure how each authority's children changed in number from one year to the next as they got a year older: families moving in and out, and very rarely deaths.<br>2. We leave out the exceptional years and average the others, giving the most recent years double weight.<br>3. We age today's children forward a year at a time, at those rates.<br>4. The band shows the lowest and highest results from using any single year's rates.<br>5. Children not yet born start from the latest count of babies, moved by ONS's projected change in births. They are drawn lighter.<br>Sources: ONS mid-year population estimates by single year of age, for local authorities and for neighbourhoods (LSOA 2021); births not yet counted: ONS 2022-based subnational projections, percentage change only; the projection's stored settings<br>Rounding: Whole children. A projection of children living in the area, not a forecast for the school. |

### DV-SMT-C-AGES — By single year of age

| Field | Content |
| --- | --- |
| Measures | M-SMT-AREA (The area around the school) |
| Data | smt.area |
| Results sub-measures | — |
| Phases | — |
| Focus | level |
| Compare | none |
| Number types | totals |
| Date mode | single |
| View type | graph |
| Renderer | RD-SMT-AGES |
| Title template | Population by single year of age |
| Title fallback | — |
| Requires (card warning) | — |
| Params | level, set, filters |
| Rail icon | VerticalBarsIcon |
| Host | smt.context, trend, rail "By single year of age" (src/components/smt/views/Context.tsx) |
| Audience | geography |
| Status | live |
| Verified at | not yet |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Rules | R-SMT-CONTEXT-GEOGRAPHY |
| Used on | SMT Context › Area › Trends |
| Note | — |
| Method | 1. We take residents at each single age from 0 to 18 in the latest mid-year estimate, within the radius (or in the LA).<br>2. Each bar is one age; the level's ages are highlighted.<br>3. These are children living in the area, not pupils.<br>Sources: ONS mid-year population estimates for neighbourhoods (LSOA 2021) (LSOA residents by age); ONS mid-year population estimates by single year of age (LA residents)<br>Rounding: Whole children |
