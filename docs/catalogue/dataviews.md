<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Dataviews

The registered recipes the chooser offers and dashboards place, in host then rail order. 40 dataviews: 38 live, 2 draft.

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
| DV-C1-RES-CUR-GRADES | live | teacher.c1.results · current · Grades (pick a range) | academic.results (bands) | subject | averages | rate | single | graph | RD-GRADE-DISTRIBUTION |
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
| Title template | [subject] against the wider system |
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
| Title template | [subject] against the wider system |
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

### DV-C1-RES-CUR-GRADES — Grades (pick a range)

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
| Title fallback | None (wrapper suppressed). No range: 'Pick a range to see a rate: open Grades and click one grade, then another.' |
| Requires (card warning) | School grades are published from 2023/24 only (2 years). |
| Params | band:range, bandPending |
| Rail icon | GradesIcon |
| Host | teacher.c1.results, current, rail "Grades (pick a range)" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, geography |
| Status | live |
| Verified at | not yet |
| Origin | Grade bands frontend round |
| Rules | R-NON-GRADES-EXCL, R-GRADE-SCALE-MATCH, R-BANDS-ENGLAND-BENCH, R-MIN-SCHOOLS |
| Used on | GCSE Results › Results › Current, Post-16 Results › Results › Current |
| Note | England share ticks per grade (placement mismatch M5). |

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
| Requires (card warning) | A line needs 4 real years here; with fewer it shows bars or a change list. Grade 4+ / A*-E and bands have 2 school years, so they show the pp change list. |
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

### DV-C1-RES-TR-MAP — Map

| Field | Content |
| --- | --- |
| Measures | M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-BANDS (GCSE grade bands), M-KS5-BANDS (Post-16 grade bands) |
| Data | academic.results |
| Results sub-measures | points, threshold, bands |
| Phases | ks4, ks5 |
| Focus | subject |
| Compare | schools |
| Number types | points |
| Date mode | single |
| View type | map |
| Renderer | RD-RANKINGS-MAP |
| Title template | [subject] at each comparator school, on the map |
| Title fallback | — |
| Requires (card warning) | Needs a focus subject with a map chip and the school's location; falls back to Chart when the focus loses its chip. |
| Params | mapRank |
| Rail icon | MapPinIcon |
| Host | teacher.c1.results, trend, rail "Map" (src/components/teacher/SubjectPanels.tsx) |
| Audience | subject-level, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Teacher view round 7 (map in Trends) |
| Rules | R-IGCSE-EXCL, R-POINTS-SAME-QUAL |
| Used on | GCSE Results › Results › Trends, Post-16 Results › Results › Trends |
| Note | Placement mismatch M4: sits in Column 1 Trends but compares a school set and shows one year (the map's own toggle). Declared honestly as schools / single, so the seeded Column 1 Trends panel does not match it. |

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
| Title template | [subject] against the wider system |
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
| Title template | [subject] against the wider system |
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
| Requires (card warning) | School grades are published from 2023/24 only (2 years). |
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
| Requires (card warning) | School grades are published from 2023/24 only (2 years). A second year is needed to compare. |
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
| Title template | [subject]'s entries at each grade: [change year] against [year], with the change |
| Title fallback | — |
| Requires (card warning) | School grades are published from 2023/24 only (2 years). A second year is needed to measure a change. |
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
| Note | Default Context Current view. On Grade counts / bands without a range the host shows points (R-MEASURE-FALLBACK, mismatch M6). |

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
| Title template | [Entries\|Results] in [comparison-group]: [% change\|change in points\|change in percentage points] since [year], ranked |
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
| Rules | R-RANKING-SAMPLE, R-RANK-TIES, R-IGCSE-EXCL |
| Used on | GCSE Candidates › Comparisons › Current, GCSE Results › Comparisons › Current, Post-16 Candidates › Comparisons › Current, Post-16 Results › Comparisons › Current |
| Note | Offered on Candidates and Results columns alike because it shows the whole-school headline (Attainment 8 / A-level points per entry) in both modes; the ranking's own measure, never the column's. |

### DV-C3-CUR-MAP — Map

| Field | Content |
| --- | --- |
| Measures | M-KS4-ENTRIES (GCSE candidates), M-KS5-ENTRIES (Post-16 candidates), M-KS4-POINTS (GCSE average points), M-KS5-POINTS (Post-16 average points), M-KS4-HEADLINE (Attainment 8), M-KS5-HEADLINE (A-level points per entry) |
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
| Rules | R-IGCSE-EXCL, R-RANKING-SAMPLE, R-POINTS-SAME-QUAL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Current, GCSE Results › Comparisons › Current, Post-16 Candidates › Comparisons › Current, Post-16 Results › Comparisons › Current |
| Note | Default Comparisons Current view. With no subject chip on Results the focus switches to the school's headline (mismatch M7). |

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
| Rules | R-RANKING-SAMPLE, R-IGCSE-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | — |

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
| Title template | [% change in [measure] since [year]\|Change in [measure] since [year], in points\|…, in percentage points], ranked against the [set] |
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
| Title template | [% change in [measure] since [year]\|Change in [measure] since [year], in points\|…, in percentage points], coloured by school |
| Title fallback | — |
| Requires (card warning) | Not for ranking sets; needs the school's location and 2 or more years. |
| Params | changeStart, set:rankings |
| Rail icon | MapPinIcon |
| Host | teacher.c3.comparisons, trend, rail "Change map" (src/components/teacher/ComparisonsPanels.tsx) |
| Audience | subject-level, whole-school, academic, market |
| Status | live |
| Verified at | not yet |
| Origin | Comparisons change map colour scale round |
| Rules | R-NUMBER-TYPE-HONESTY, R-RANKING-SAMPLE, R-IGCSE-EXCL, R-MEASURE-FALLBACK |
| Used on | GCSE Candidates › Comparisons › Trends, GCSE Results › Comparisons › Trends, Post-16 Candidates › Comparisons › Trends, Post-16 Results › Comparisons › Trends |
| Note | S3b: a count keeps the fixed ±% scale (forcedColourMode trend); points and rates colour by the absolute change on the set's own range (trend_absolute), keyed 'Change' (R-NUMBER-TYPE-HONESTY). |
