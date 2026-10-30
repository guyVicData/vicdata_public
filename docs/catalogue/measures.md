<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Measures

What is counted, at what grain, where, with which honest number types. 24 measures.

## Summary

| ID | Name | Data | Phase | Years | School | Subject area | Set | LA | Region | England | Number types |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-KS4-ENTRIES | GCSE candidates | academic.candidates | ks4 | 2020/21–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, market_share, index100, rank |
| M-KS4-POINTS | GCSE average points | academic.results (points) | ks4 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS4-HEADLINE | Attainment 8 | academic.results (points) | ks4 | 2021/22–2024/25 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS4-THRESHOLD | GCSE Grade 4+ rate | academic.results (threshold) | ks4 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | rate, change_pp, rank |
| M-KS4-BANDS | GCSE grade bands | academic.results (bands) | ks4 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | rate, change_pp, totals, market_share, rank |
| M-KS4-COUNTS | GCSE grade counts | academic.results (counts) | ks4 | 2021/22–2024/25 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | totals, rate |
| M-KS5-ENTRIES | Post-16 candidates | academic.candidates | ks5 | 2020/21–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, market_share, index100, rank |
| M-KS5-POINTS | Post-16 average points | academic.results (points) | ks5 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS5-HEADLINE | A-level points per entry | academic.results (points) | ks5 | 2021/22–2024/25 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS5-THRESHOLD | Post-16 A*-E rate | academic.results (threshold) | ks5 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | rate, change_pp, rank |
| M-KS5-BANDS | Post-16 grade bands | academic.results (bands) | ks5 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | rate, change_pp, totals, market_share, rank |
| M-KS5-COUNTS | Post-16 grade counts | academic.results (counts) | ks5 | 2021/22–2024/25 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | totals, rate |
| M-ROLLS | Rolls | rolls | — | 2019–2025 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, market_share, index100 |
| M-BIRTHS | Live births | social.births | — | 2021–2025 | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | totals, pct_change, index100 |
| M-ADM-PUPILS | Pupils by age | admissions.pupils | — | 2019–2025 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, index100, rank |
| M-ADM-POOL | Pipeline (the pool) | admissions.pipeline | — | 2020–2036 | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | totals, pct_change, index100, market_share |
| M-ADM-MARKET | Market share | admissions.market | — | 2019–2025 | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | totals, market_share, pct_change, change_pp, index100, rank |
| M-ADM-CATCHMENT | Children in the catchment | admissions.pipeline | — | 2011–2024 | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | totals, index100 |
| M-ADM-RIVAL-RESULTS | Rivals' results | admissions.rivals | — | 2022–2024 | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | points, change_points, rank |
| M-SMT-SCHOOL | The school: roll, phases and size | smt.school | — | 2019–2025 | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | totals, pct_change, index100, rank |
| M-SMT-RESULTS | Headline results and ranks | smt.results | — | 2021–2024 | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | points, rate, change_points, change_pp, rank |
| M-SMT-VA | Value added | smt.value_added | — | 2021–2024 | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | points, rank |
| M-SMT-SUBJECTS | Subject areas and subjects | smt.subjects | — | 2021–2024 | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | totals, points, change_points, rank |
| M-SMT-AREA | The area around the school | smt.area | — | 2011–2025 | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | totals, pct_change, index100 |

## Cards

### M-KS4-ENTRIES — GCSE candidates

| Field | Content |
| --- | --- |
| Definition | Exam entries per subject, every qualification type (the DfE 'Total' row), per school and year. |
| Data | academic.candidates |
| Grain | Raw: school × subject × qualification type × year. Rollup: school × subject × year, qualifications summed. |
| Sources | dfe_ks4_subject_entries, dfe_ks4_subject_entries_historic |
| Keying | urn |
| Years | 2020/21 → 2024/25. Rollup entries 5 years. The subject list comes from raw facts, latest year only, without the IB Diploma total and IB Core rows (teacher-view-populations.ts:subjectItemsOf, R-IB-NONSUBJECT). Area (points-eligible) entries 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ academic_subject_family_rollup 2020-2024; share-of-family fields on headline rows |
| Set | ✓ fetchAcademicProfiles(..., {includeSubjects}) -> ks4Subjects.entriesTotal |
| LA | ✓ Partial: points-eligible (GCSE 9-1 Full Course) entries only, academic_subject_geography_aggregate, min 5 schools (R-GEO-POINTS-ELIGIBLE). All-qualification area entries: none. |
| Region | ✓ Partial: points-eligible entries only, min 5 schools |
| England | ✓ Partial: points-eligible entries only, min school count 1 |
| Honest number types | totals, pct_change, market_share, index100, rank |
| Rules | R-ENTRIES-NOT-POINTS, R-FOCUS-NEVER-FILTERED, R-KS4-SUBJECT-DEDUP, R-QUAL-FAMILY-MATCH, R-SELF-INCLUSIVE-GROUP, R-GEO-APPLIES, R-GEO-POINTS-ELIGIBLE, R-MIN-SCHOOLS, R-IGCSE-EXCL, R-COMPARATOR-NO-FIGURE, R-TREND-LINE-4YR, R-INDEX-HEADCOUNTS, R-PERIOD-TRIM, R-DONUT-COUNTS-ONLY |
| Fetched by | - src/app/api/teacher/dashboard/route.ts -> src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools (route.ts:169), src/lib/academic-data-view.ts:fetchSubjectHeadlineForSchools (route.ts:172)<br>- src/app/api/data-view/academic-schools/route.ts -> src/lib/academic-data-view.ts:fetchAcademicProfiles<br>- src/app/api/teacher/subject-geography/route.ts<br>- seriesByUrn.candidates from academic-data-view.ts:entriesSeries (headline pupil_count) in dashboard, chooser-set and saved-sets |
| Known gaps | - The item list (raw facts, latest year) and the trend (rollup) come from different tables.<br>- No all-qualification area benchmark. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-POINTS — GCSE average points

| Field | Content |
| --- | --- |
| Definition | Points per points-eligible entry, GCSE (9-1) Full Course only, on the 9-1 table (vicdata:ingest/academic_aggregates.py:93,139-140). |
| Data | academic.results · points |
| Grain | School × subject × year (points_weighted_sum / points_eligible_entries) |
| Sources | dfe_ks4_subject_entries, dfe_ks4_subject_entries_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. 2020/21 rollup rows have 0 points-eligible entries (teacher-assessed year). |
| School | ✓ |
| Subject area | ✓ |
| Set | ✓ profiles ks4Subjects.avgPointScore |
| LA | ✓ academic_subject_geography_aggregate 2021-2024, min 5 schools |
| Region | ✓ academic_subject_geography_aggregate, min 5 schools |
| England | ✓ academic_subject_geography_aggregate, min school count 1 (dashboard/route.ts:72) |
| Honest number types | points, change_points, rank |
| Rules | R-ENTRIES-NOT-POINTS, R-KS4-POINTS-GCSE-FULL, R-POINTS-SAME-QUAL, R-MIN-SCHOOLS, R-SAME-YEAR-BENCH, R-GEO-APPLIES, R-FOCUS-NEVER-FILTERED, R-KS4-SUBJECT-DEDUP, R-QUAL-FAMILY-MATCH, R-IGCSE-EXCL, R-COMPARATOR-NO-FIGURE, R-TREND-LINE-4YR, R-PERIOD-TRIM, R-NUMBER-TYPE-HONESTY |
| Fetched by | - src/app/api/teacher/dashboard/route.ts -> src/lib/academic-data-view.ts:fetchSubjectHeadlineForSchools (route.ts:172); England via englandAverages (route.ts:46-74)<br>- src/app/api/teacher/subject-geography/route.ts<br>- src/app/api/data-view/academic-schools/route.ts -> src/lib/academic-data-view.ts:fetchAcademicProfiles |
| Known gaps | - Rename 'Average point score' -> 'Average points' (C3) done in 0.6 night 2 (teacher-view-panels.ts measuresFor); the Post-16 whole-school headline keeps DfE's own name.<br>- Change is shown in points everywhere (S3b, R-NUMBER-TYPE-HONESTY: teacher-view-panels.ts changeKind "points", changeOf, formatChange). |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-HEADLINE — Attainment 8

| Field | Content |
| --- | --- |
| Definition | The DfE Attainment 8 average for the whole school (HEADLINE_MEASURE.ks4 = attainment8_average). Comparisons' measure with no subject chip. |
| Data | academic.results · points |
| Grain | School × year |
| Sources | dfe_ks4_headline, dfe_ks4_headline_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25 |
| School | ✓ |
| Subject area | ✗ A whole-school measure |
| Set | ✓ rankSets / rankFixedSets |
| LA | ✓ academic_geography_aggregate (attainment8_average 2021-2024); not used by the Teacher view |
| Region | ✓ academic_geography_aggregate; not used by the Teacher view |
| England | ✓ academic_geography_aggregate; not used by the Teacher view |
| Honest number types | points, change_points, rank |
| Rules | R-IGCSE-EXCL, R-COMPARATOR-NO-FIGURE, R-RANKING-SAMPLE, R-MEASURE-FALLBACK, R-RANK-TIES, R-NUMBER-TYPE-HONESTY, R-TREND-LINE-4YR |
| Fetched by | - src/lib/vicdata-reference.ts:lookupAcademicHeadline inside fetchAcademicProfiles / fetchLatestCohortSizes / chooser-sets.ts:resolveRankingSet |
| Known gaps | - Progress 8 stops at 2023/24 (no 2024/25 rows). |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-THRESHOLD — GCSE Grade 4+ rate

| Field | Content |
| --- | --- |
| Definition | Share of a subject's graded entries at grades 9-4 (Double Award: both digits 4 or above), on the GCSE scale only (subject-grades.ts:thresholdRate). |
| Data | academic.results · threshold |
| Grain | School × subject × qualification type × grade × year |
| Sources | academic_subject_grade_rollup (via academic_subject_grade_rollup_lookup, once applied), dfe_ks4_subject_entries, dfe_ks4_subject_entries_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. School grade rows 2021/22-2024/25 (0.6.2): academic_subject_grade_rollup through its lookup RPC when that is applied, else the modern + historic facts (src/lib/grade-rows.ts), which S1 proved equal on every key. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side over the category (page.tsx:1227-1237) |
| Set | ✓ comparator-grades, scored per subject and exact qualification (R-COMPARATOR-RATE-PER-QUAL) |
| LA | ✗ Not wired: no area threshold benchmark in the UI (R-NO-GRADE-RATE-GEO), though grade geography would give it |
| Region | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| England | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| Honest number types | rate, change_pp, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-NO-GRADE-RATE-GEO, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY, R-TREND-LINE-4YR |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools, gradeYears "four")<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - Until the rollup lookup RPC is applied, comparator-grades reads every subject's facts for the set and filters to one subject (audit B §2); with it, one subject is read in the database.<br>- Change is shown in percentage points everywhere (S3b, R-NUMBER-TYPE-HONESTY: teacher-view-panels.ts changeKind "pp", changeOf, formatChange).<br>- No area benchmark is wired although the grade geography would give one. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-BANDS — GCSE grade bands

| Field | Content |
| --- | --- |
| Definition | Share of a subject's graded entries inside a chosen contiguous range on the subject's own scale (subject-grades.ts:bandRate). Presets 4-9 and 7-9 on GCSE 9-1; default 7-9. |
| Data | academic.results · bands |
| Grain | School × subject × qualification type × grade × year |
| Sources | academic_subject_grade_rollup (via academic_subject_grade_rollup_lookup, once applied), dfe_ks4_subject_entries, dfe_ks4_subject_entries_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. School grade rows 2021/22-2024/25 (0.6.2): academic_subject_grade_rollup through its lookup RPC when that is applied, else the modern + historic facts (src/lib/grade-rows.ts), which S1 proved equal on every key. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side |
| Set | ✓ comparator-grades |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Only the focused subject carries a benchmark (R-BANDS-ENGLAND-BENCH). |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | rate, change_pp, totals, market_share, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-BANDS-ENGLAND-BENCH, R-DONUT-COUNTS-ONLY, R-MIN-SCHOOLS, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools, gradeYears "four")<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - Until the rollup lookup RPC is applied, comparator-grades reads every subject's facts for the set and filters to one subject (audit B §2); with it, one subject is read in the database. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-COUNTS — GCSE grade counts

| Field | Content |
| --- | --- |
| Definition | Entries at each grade for one subject × qualification, and each grade's share of graded entries. |
| Data | academic.results · counts |
| Grain | School × subject × qualification type × grade × year |
| Sources | academic_subject_grade_rollup (via academic_subject_grade_rollup_lookup, once applied), dfe_ks4_subject_entries, dfe_ks4_subject_entries_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. School grade rows 2021/22-2024/25 (0.6.2): academic_subject_grade_rollup through its lookup RPC when that is applied, else the modern + historic facts (src/lib/grade-rows.ts), which S1 proved equal on every key. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✗ Grade counts are per subject; a category has no single grade scale |
| Set | ✓ 0.6.2 S3: Column 1's grade spread draws the set's average share at each grade (comparator-grades; a share, not a count: R-COMPARATOR-GRADE-SHARE). Comparisons and Context still fall back to points (R-MEASURE-FALLBACK) |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Shown as England share ticks. |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | totals, rate |
| Rules | R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-MIN-SCHOOLS, R-MEASURE-FALLBACK, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-GRADE-SHARE |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools, gradeYears "four")<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - Until the rollup lookup RPC is applied, comparator-grades reads every subject's facts for the set and filters to one subject (audit B §2); with it, one subject is read in the database.<br>- Context and Comparisons have no grade-count view; they fall back to points (R-MEASURE-FALLBACK).<br>- The set's share ticks cover the grades this school's spread draws; a grade only other schools have isn't drawn. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS5-ENTRIES — Post-16 candidates

| Field | Content |
| --- | --- |
| Definition | Entries per subject × exact qualification type (A level, AS, IB HL/SL, BTEC, T Level…), per school and year. |
| Data | academic.candidates |
| Grain | School × subject × qualification type × year (academic_subject_qualification_rollup, 3,001 schools); bucket rollup for categories |
| Sources | dfe_ks5_subject_results, dfe_ks5_subject_results_historic, dfe_tlevel_results |
| Keying | urn |
| Years | 2020/21 → 2024/25. Rollups 5 years; the item list is raw facts, latest year only. |
| School | ✓ |
| Subject area | ✓ bucket / family rows |
| Set | ✓ profiles ks5Subjects / ks5SubjectsByBucket |
| LA | ✓ Partial: scored qualifications only, per subject × exact qualification (academic_subject_qualification_geography_aggregate 2021-2024); VRQ/AEA/Other have none |
| Region | ✓ Partial: scored qualifications only |
| England | ✓ Partial: scored qualifications only, exact qualification (R-KS5-ENGLAND-EXACT) |
| Honest number types | totals, pct_change, market_share, index100, rank |
| Rules | R-ENTRIES-NOT-POINTS, R-KS5-ASAEA-EXCL, R-IB-NONSUBJECT, R-FOCUS-NEVER-FILTERED, R-QUAL-FAMILY-MATCH, R-SELF-INCLUSIVE-GROUP, R-GEO-APPLIES, R-GEO-POINTS-ELIGIBLE, R-KS5-ENGLAND-EXACT, R-MIN-SCHOOLS, R-COMPARATOR-NO-FIGURE, R-TREND-LINE-4YR, R-INDEX-HEADCOUNTS, R-PERIOD-TRIM, R-DONUT-COUNTS-ONLY |
| Fetched by | - src/app/api/teacher/dashboard/route.ts -> src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools (route.ts:169), src/lib/academic-data-view.ts:fetchSubjectHeadlineForSchools (route.ts:172), src/lib/academic-data-view.ts:fetchSubjectQualificationHeadlineForSchools (route.ts:176)<br>- src/app/api/data-view/academic-schools/route.ts -> src/lib/academic-data-view.ts:fetchAcademicProfiles<br>- src/app/api/teacher/subject-geography/route.ts?phase=ks5&qualificationType= |
| Known gaps | - No IB non-subject filter on the raw-facts item list (R-IB-NONSUBJECT): fragile, and live at Sevenoaks 118952.<br>- No KS5 rows in academic_subject_geography_aggregate: subject-only area figures are GCSE-only.<br>- AS/AEA self-inclusion follow-up still open (R-KS5-ASAEA-EXCL). |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-POINTS — Post-16 average points

| Field | Content |
| --- | --- |
| Definition | Points per entry on the qualification's own challenge table (A level A*=56 … E=16), size-weighted (points_size_units). |
| Data | academic.results · points |
| Grain | School × subject × exact qualification × year |
| Sources | dfe_ks5_subject_results, dfe_ks5_subject_results_historic, dfe_tlevel_results |
| Keying | urn |
| Years | 2021/22 → 2024/25 |
| School | ✓ |
| Subject area | ✓ per bucket, never across buckets |
| Set | ✓ |
| LA | ✓ per subject × exact qualification, scored qualifications only, min 5 schools |
| Region | ✓ per subject × exact qualification, min 5 schools |
| England | ✓ exact qualification or none (R-KS5-ENGLAND-EXACT), min school count 1 |
| Honest number types | points, change_points, rank |
| Rules | R-ENTRIES-NOT-POINTS, R-POINTS-SAME-QUAL, R-KS5-ENGLAND-EXACT, R-KS5-ASAEA-EXCL, R-SINGLE-BUCKET-100, R-POINTS-WEIGHTED, R-IB-NONSUBJECT, R-MIN-SCHOOLS, R-SAME-YEAR-BENCH, R-GEO-APPLIES, R-FOCUS-NEVER-FILTERED, R-QUAL-FAMILY-MATCH, R-COMPARATOR-NO-FIGURE, R-TREND-LINE-4YR, R-PERIOD-TRIM, R-NUMBER-TYPE-HONESTY |
| Fetched by | - src/app/api/teacher/dashboard/route.ts -> src/lib/academic-data-view.ts:fetchSubjectQualificationHeadlineForSchools (route.ts:176); England via englandAverages (route.ts:46-63)<br>- src/app/api/teacher/subject-geography/route.ts<br>- src/app/api/data-view/academic-schools/route.ts -> src/lib/academic-data-view.ts:fetchAcademicProfiles |
| Known gaps | - The IB Diploma total ('Diploma total points', 0-45) is a separate figure (academic-data-view.ts:ibDiplomaHeadline).<br>- Change is shown in points everywhere, as at GCSE (S3b, R-NUMBER-TYPE-HONESTY). |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-HEADLINE — A-level points per entry

| Field | Content |
| --- | --- |
| Definition | The school's A-level average points per entry (A level::aps_per_entry). Comparisons' measure with no subject chip. |
| Data | academic.results · points |
| Grain | School × year |
| Sources | dfe_ks5_headline, dfe_ks5_headline_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25 |
| School | ✓ |
| Subject area | ✗ A whole-school measure |
| Set | ✓ |
| LA | ✓ academic_geography_aggregate (also per cohort and bucket); not used by the Teacher view |
| Region | ✓ academic_geography_aggregate; not used by the Teacher view |
| England | ✓ academic_geography_aggregate; not used by the Teacher view |
| Honest number types | points, change_points, rank |
| Rules | R-COMPARATOR-NO-FIGURE, R-RANKING-SAMPLE, R-MEASURE-FALLBACK, R-RANK-TIES, R-NUMBER-TYPE-HONESTY, R-TREND-LINE-4YR |
| Fetched by | - src/lib/vicdata-reference.ts:lookupAcademicHeadline inside fetchAcademicProfiles / fetchLatestCohortSizes / chooser-sets.ts:resolveRankingSet |
| Known gaps | — |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-THRESHOLD — Post-16 A*-E rate

| Field | Content |
| --- | --- |
| Definition | Share of a subject's graded entries at A*-E, on the A-level scale only; IB, vocational and Pre-U rows get no figure (subject-grades.ts:thresholdRate). |
| Data | academic.results · threshold |
| Grain | School × subject × qualification type × size × grade × year |
| Sources | dfe_ks5_subject_results, dfe_tlevel_results, dfe_ks5_subject_results_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. School grade rows 2021/22-2024/25 (0.6.2): the modern + historic facts, parsed with R-HISTORIC-GRADE-LABELS (src/lib/grade-rows.ts); the rollup is not used at Post-16 (it has no zero-entry grade rows). Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side over the category (page.tsx:1227-1237) |
| Set | ✓ comparator-grades, scored per subject and exact qualification (R-COMPARATOR-RATE-PER-QUAL) |
| LA | ✗ Not wired: no area threshold benchmark in the UI (R-NO-GRADE-RATE-GEO), though grade geography would give it |
| Region | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| England | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| Honest number types | rate, change_pp, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-NO-GRADE-RATE-GEO, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY, R-TREND-LINE-4YR, R-KS5-ASAEA-EXCL, R-HISTORIC-GRADE-LABELS |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools, gradeYears "four")<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - comparator-grades reads every subject's facts for the set (modern + historic), then filters to one subject: the rollup can't serve Post-16 (no zero-entry grade rows).<br>- Change is shown in percentage points everywhere (S3b, R-NUMBER-TYPE-HONESTY: teacher-view-panels.ts changeKind "pp", changeOf, formatChange).<br>- No area benchmark is wired although the grade geography would give one. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-BANDS — Post-16 grade bands

| Field | Content |
| --- | --- |
| Definition | Share of a subject's graded entries inside a chosen contiguous range on the subject's own scale (subject-grades.ts:bandRate). One preset per scale, its default (0.6.5 S1, R-POST16-BAND-DEFAULT): A level and EPQ A*-A; AS and Core Maths A-B; IB 7-6; vocational Distinction*-Distinction, D*D*-DD, D*D*D*-DDD; T Level Distinction*-Merit; Pre-U custom range only. |
| Data | academic.results · bands |
| Grain | School × subject × qualification type × size × grade × year |
| Sources | dfe_ks5_subject_results, dfe_tlevel_results, dfe_ks5_subject_results_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. School grade rows 2021/22-2024/25 (0.6.2): the modern + historic facts, parsed with R-HISTORIC-GRADE-LABELS (src/lib/grade-rows.ts); the rollup is not used at Post-16 (it has no zero-entry grade rows). Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side |
| Set | ✓ comparator-grades |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Only the focused subject carries a benchmark (R-BANDS-ENGLAND-BENCH). |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | rate, change_pp, totals, market_share, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-BANDS-ENGLAND-BENCH, R-DONUT-COUNTS-ONLY, R-MIN-SCHOOLS, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY, R-KS5-ASAEA-EXCL, R-HISTORIC-GRADE-LABELS |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools, gradeYears "four")<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - comparator-grades reads every subject's facts for the set (modern + historic), then filters to one subject: the rollup can't serve Post-16 (no zero-entry grade rows). |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-COUNTS — Post-16 grade counts

| Field | Content |
| --- | --- |
| Definition | Entries at each grade for one subject × qualification, and each grade's share of graded entries. |
| Data | academic.results · counts |
| Grain | School × subject × qualification type × size × grade × year |
| Sources | dfe_ks5_subject_results, dfe_tlevel_results, dfe_ks5_subject_results_historic |
| Keying | urn |
| Years | 2021/22 → 2024/25. School grade rows 2021/22-2024/25 (0.6.2): the modern + historic facts, parsed with R-HISTORIC-GRADE-LABELS (src/lib/grade-rows.ts); the rollup is not used at Post-16 (it has no zero-entry grade rows). Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✗ Grade counts are per subject; a category has no single grade scale |
| Set | ✓ 0.6.2 S3: Column 1's grade spread draws the set's average share at each grade (comparator-grades; a share, not a count: R-COMPARATOR-GRADE-SHARE). Comparisons and Context still fall back to points (R-MEASURE-FALLBACK) |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Shown as England share ticks. |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | totals, rate |
| Rules | R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-MIN-SCHOOLS, R-MEASURE-FALLBACK, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-GRADE-SHARE, R-HISTORIC-GRADE-LABELS |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools, gradeYears "four")<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - comparator-grades reads every subject's facts for the set (modern + historic), then filters to one subject: the rollup can't serve Post-16 (no zero-entry grade rows).<br>- Context and Comparisons have no grade-count view; they fall back to points (R-MEASURE-FALLBACK).<br>- The set's share ticks cover the grades this school's spread draws; a grade only other schools have isn't drawn. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-ROLLS — Rolls

| Field | Content |
| --- | --- |
| Definition | Census headcount by single age × sex × full/part-time, plus boarders (src/lib/roll-data.ts:1-3, 33). |
| Data | rolls |
| Grain | School × age × sex × attendance × census year |
| Sources | dfe_school_census |
| Keying | urn |
| Years | 2019 → 2025. January census; 7 years. LA aggregates (roll_aggregates scope 'regional') are 2025 only. |
| School | ✓ reference_data_lookup |
| Subject area | ✗ Not a subject measure |
| Set | ✓ Data View /api/data-view/schools -> data-view-profiles.ts:fetchDataViewProfiles -> fetchCensusFactsBatched |
| LA | ✓ roll_aggregates scope 'regional' (which means LA; 2025 only) and region_nation_la_rollup over school_current_snapshot (current + anchor years) |
| Region | ✓ roll_aggregates scope ons_region, 2019-2025 |
| England | ✓ roll_aggregates scope national, 2019-2025 |
| Honest number types | totals, pct_change, market_share, index100 |
| Rules | R-ROLLS-HEADCOUNT, R-ROLLS-MAINSTREAM-AGG, R-TREND-LINE-4YR |
| Fetched by | - src/lib/data-view-profiles.ts:126<br>- src/app/schools/[urn]/page.tsx:271<br>- src/lib/surrounding-schools.ts:150, 354<br>- src/app/api/comparator-set-peers/route.ts:60<br>- src/app/api/paid-trends/route.ts:46<br>- src/lib/market-share.ts:37<br>- src/lib/aggregate-trends.ts<br>- src/lib/la-choropleth.ts |
| Known gaps | - No LA roll trend: LA rolls exist for the current year only in roll_aggregates.<br>- 'regional' scope means LA: a naming trap.<br>- KS2's 'Year 6 cohort' (rollAtAge10, dashboard/route.ts:149-151) is the only Teacher view use.<br>- No single fetch function; no views registered yet (combinations A10). |
| Briefing | none |
| Citation | DfE school census |

### M-BIRTHS — Live births

| Field | Content |
| --- | --- |
| Definition | ONS live births (breakdown = 'total') for an area. Area data: a school's 'own' figure is its LA's. |
| Data | social.births |
| Grain | LA / district GSS code (E06/E07/E08/E09; 296 codes in 2024) × calendar year |
| Sources | ons_births |
| Keying | geography |
| Years | 2021 → 2025. 1992-2025 in the database; the app reads 2021-2025 only and returns nothing unless all 5 exist (R-BIRTHS-FULL-WINDOW). |
| School | ✗ Area data: 'school' can only mean the school's LA (combinations F7: focus 'around school') |
| Subject area | ✗ Not a subject measure |
| Set | ✗ Area data: a set of schools has no births of its own |
| LA | ✓ Shire counties summed from districts (R-BIRTHS-SHIRE-SUM) |
| Region | ✗ No rows: would have to be summed from LAs |
| England | ✗ No rows: would have to be summed from LAs |
| Honest number types | totals, pct_change, index100 |
| Rules | R-BIRTHS-FULL-WINDOW, R-BIRTHS-SHIRE-SUM, R-TREND-LINE-4YR |
| Fetched by | - src/lib/population-trend-lookup.ts:lookupBirthsTrend (92), used by src/app/schools/[urn]/page.tsx:538 -> PopulationTrendSection -> BirthsChart<br>- src/lib/market-share.ts:68 (single birth-year read) |
| Known gaps | - Not in the Data View or Teacher view at all today.<br>- No region or England rows.<br>- No share: capture rate (intake ÷ births) is a future measure, not a share.<br>- No single fetch function; no views registered yet (combinations A10). |
| Briefing | none |
| Citation | ONS live births |

### M-ADM-PUPILS — Pupils by age

| Field | Content |
| --- | --- |
| Definition | Pupils at one age (the entry age, or a rung age) in the January census: full-time from age 4, plus part-time at 2-3 (src/lib/admissions/cohort.ts). |
| Data | admissions.pupils |
| Grain | School × single age × sex × census year |
| Sources | dfe_school_census |
| Keying | urn |
| Years | 2019 → 2025. January census, ages at 31 August. |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✓ age_profile_aggregates (ages 5-15; years as synced) |
| Region | ✓ age_profile_aggregates |
| England | ✓ the sum of the nine regions |
| Honest number types | totals, pct_change, index100, rank |
| Rules | R-ADM-FAMILY-PUPILS, R-ADM-JOINERS-ESTIMATE |
| Fetched by | - src/lib/admissions/data.ts:cachedCensus<br>- src/app/api/admissions/pipeline/route.ts<br>- src/app/api/admissions/market-share/route.ts |
| Known gaps | - No boarders by age (whole school only).<br>- LA and England by single age only for the years age_profile_aggregates holds. |
| Briefing | none |
| Citation | DfE school census (January), pupils by age |

### M-ADM-POOL — Pipeline (the pool)

| Field | Content |
| --- | --- |
| Definition | The children who will reach the entry point each September: counted in the rung schools now, then from births in the LA blend, ranges from observed drift (src/lib/admissions/ladder.ts). A pool, never an intake. |
| Data | admissions.pipeline |
| Grain | School's sets × entry year |
| Sources | dfe_school_census, ons_births, ons_population_projections |
| Keying | urn |
| Years | 2020 → 2036. Past pools 2020-2026; forward 10 years (Reception to the last birth year). |
| School | ✗ Not held |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✓ births by LA |
| Region | ✗ Not held |
| England | ✗ Not held |
| Honest number types | totals, pct_change, index100, market_share |
| Rules | R-ADM-FAMILY-PIPELINE, R-ADM-LADDER, R-ADM-BIRTH-SPLIT, R-ADM-DRIFT-RANGE, R-ADM-POOL-NOT-INTAKE, R-ADM-HOLD-SHARE |
| Fetched by | - src/lib/admissions/pipeline.ts:buildPipeline<br>- src/app/api/admissions/pipeline/route.ts |
| Known gaps | - No catchment births (LA only).<br>- No Reception projections beyond the last birth year.<br>- Feeder relationships are not in the data: lists are the lead's, defaults are nearby schools. |
| Briefing | none |
| Citation | DfE school census (January); ONS births by LA; ONS projections (age 10) |

### M-ADM-MARKET — Market share

| Field | Content |
| --- | --- |
| Definition | The school's pupils at the entry age (and its age band) as a share of the same ages across the rivals plus the school, each census year (src/lib/admissions/shares.ts). A share of this group, not the local market. |
| Data | admissions.market |
| Grain | Rival set × census year |
| Sources | dfe_school_census |
| Keying | urn |
| Years | 2019 → 2025 |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✗ Not held |
| Region | ✗ Not held |
| England | ✗ Not held |
| Honest number types | totals, market_share, pct_change, change_pp, index100, rank |
| Rules | R-ADM-FAMILY-MARKET, R-ADM-GROUP-SHARE |
| Fetched by | - src/lib/admissions/market.ts:buildMarketShare<br>- src/app/api/admissions/market-share/route.ts |
| Known gaps | - FE colleges have no census: their own figures come from ILR participation, labelled, never shared into the group. |
| Briefing | none |
| Citation | DfE school census (January), pupils by age |

### M-ADM-CATCHMENT — Children in the catchment

| Field | Content |
| --- | --- |
| Definition | ONS small-area population (LSOAs whose population-weighted centre is within the school's catchment radius: the ingest's area_context) by single age 0-18, per mid-year: births (age 0), and the age a year below entry (src/lib/admissions/intake.ts). The radius is SMT's (src/lib/smt/catchment.ts). |
| Data | admissions.pipeline |
| Grain | School's catchment × single age × mid-year |
| Sources | ons_lsoa_population, ons_population_age |
| Keying | urn |
| Years | 2011 → 2024. LSOA mid-year estimates; the region and England from ONS's LA estimates (2012 on). |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✗ Not held |
| LA | ✗ Not held |
| Region | ✓ the LAs in the school's region, summed |
| England | ✓ England's LAs, summed |
| Honest number types | totals, index100 |
| Rules | R-ADM-VIEW-INTAKE-CHANGE, R-ADM-VIEW-LOCAL-BIRTHS, R-ADM-CATCHMENT-RULE |
| Fetched by | - src/lib/admissions/intake.ts:intakeChange, localBirths<br>- src/lib/smt/area-data.ts:areaContext<br>- src/app/api/admissions/pipeline/route.ts |
| Known gaps | - LSOA single ages from mid-2011 only: older cohorts' births are counted at the youngest age held.<br>- Not split by sex.<br>- A boarding school draws from beyond any radius. |
| Briefing | none |
| Citation | ONS small-area population estimates (LSOA), single year of age |

### M-ADM-RIVAL-RESULTS — Rivals' results

| Field | Content |
| --- | --- |
| Definition | Each rival's (and the school's) whole-school headline and subject-area figures, with regional and national ranks on 0.6.6's ranking (src/lib/admissions/rivals.ts, ranks.ts). 4+ → KS2, 11+ → GCSE, 16+ → Post-16. |
| Data | admissions.rivals |
| Grain | School × results year |
| Sources | dfe_ks2_attainment, academic_headline, academic_subject_family |
| Keying | urn |
| Years | 2022 → 2024. The latest results year and the two before (changes since 2022/23). |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✗ Not held |
| Region | ✓ school_region_nation |
| England | ✓ every school with a figure |
| Honest number types | points, change_points, rank |
| Rules | R-ADM-FAMILY-RIVALS, R-ADM-RIVAL-RANKS, R-ADM-FLAG-MOMENTUM, R-ADM-FLAG-STRENGTHS, R-IGCSE-EXCL |
| Fetched by | - src/lib/admissions/rivals.ts:buildRivals<br>- src/app/api/admissions/rivals/route.ts |
| Known gaps | - KS2 is thin for independent preps (most don't sit SATs): 'no published results'.<br>- IGCSE-heavy schools are listed but not ranked at 11+. |
| Briefing | none |
| Citation | DfE KS2, KS4 and KS5 performance tables |

### M-SMT-SCHOOL — The school: roll, phases and size

| Field | Content |
| --- | --- |
| Definition | The January census: the whole roll, girls and boys, day and boarding (boarding schools), the phases with pupils, and the school page's XS-XL by phase (src/lib/smt/school.ts, overview.ts). |
| Data | smt.school |
| Grain | School × census year |
| Sources | dfe_school_census, age_band_pupil_distributions, age_profile_aggregates |
| Keying | urn |
| Years | 2019 → 2025. Change since 2019/20; the LA and England lines are pupils aged 5-15. |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✗ No LA ranks for results (0.6.6 ranks nationally and by region) |
| Region | ✓ school_region_nation |
| England | ✓ every school with a figure |
| Honest number types | totals, pct_change, index100, rank |
| Rules | R-SMT-SET-RANKS, R-SMT-BOARDING-ONLY, R-SMT-NOTES |
| Fetched by | - src/lib/smt/school.ts:smtSchool<br>- src/lib/smt/overview.ts:buildOverview<br>- src/app/api/smt/overview/route.ts |
| Known gaps | - The LA and England roll lines count pupils aged 5-15 only (the per-year area aggregates).<br>- No boarders by age; boarders aren't ranked. |
| Briefing | none |
| Citation | DfE school census (January) |

### M-SMT-RESULTS — Headline results and ranks

| Field | Content |
| --- | --- |
| Definition | Attainment 8 and grade 5+ in English and maths (GCSE), A-level points per entry (Post-16), reading, writing and maths at the expected standard (KS2): the school's, its rank among the comparison set's schools with that result, in its region and in England (0.6.6's whole-population ranking), and its change since 2022/23 (src/lib/smt/population.ts). |
| Data | smt.results |
| Grain | School × results year |
| Sources | academic_headline_snapshot, dfe_ks2_attainment |
| Keying | urn |
| Years | 2021 → 2024. Change measured from 2022/23 (R-TREND-FROM-2223); each key stage's latest from the data. |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✗ No LA ranks for results (0.6.6 ranks nationally and by region) |
| Region | ✓ school_region_nation |
| England | ✓ every school with a figure |
| Honest number types | points, rate, change_points, change_pp, rank |
| Rules | R-SMT-SET-RANKS, R-IGCSE-EXCL, R-SMT-IGCSE-WORDING, R-TREND-FROM-2223, R-SMT-YEARS |
| Fetched by | - src/lib/smt/population.ts:population<br>- src/lib/smt/overview.ts:buildOverview<br>- src/lib/smt/academic.ts:buildAcademic |
| Known gaps | - No LA rank for results.<br>- IGCSE schools are listed but not ranked at GCSE.<br>- KS2 is thin for independent preps (most don't sit SATs). |
| Briefing | none |
| Citation | DfE KS2, KS4 and KS5 performance tables |

### M-SMT-VA — Value added

| Field | Content |
| --- | --- |
| Definition | A-level value added by qualification type (A level, Academic, Applied general, Tech level) with DfE's 95% confidence interval and banding; subject A-level value added; Progress 8 where DfE published it (state schools, to 2023/24). |
| Data | smt.value_added |
| Grain | School × qualification type (or subject) × year |
| Sources | academic_headline_snapshot, dfe_ks5_subject_value_added |
| Keying | urn |
| Years | 2021 → 2024. Progress 8 2021/22-2023/24 (none for 2024/25 or 2025/26: no KS2 baseline); A-level value added 2023/24 and 2024/25. |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✗ No LA ranks for results (0.6.6 ranks nationally and by region) |
| Region | ✓ school_region_nation |
| England | ✓ every school with a figure |
| Honest number types | points, rank |
| Rules | R-SMT-P8-REASON, R-SMT-VA-HONEST |
| Fetched by | - src/lib/smt/overview.ts:p8Of<br>- src/lib/smt/academic.ts:buildAcademic |
| Known gaps | - Progress 8 is never published for independent schools.<br>- DfE has never published GCSE value added by subject. |
| Briefing | none |
| Citation | DfE KS4 and KS5 performance tables (value added) |

### M-SMT-SUBJECTS — Subject areas and subjects

| Field | Content |
| --- | --- |
| Definition | Each subject area's average points against the comparison set (Admissions' strengths and weaknesses, buildRivals), and each subject's average points with its rank in the set and in England (Teacher's subjectRanking), its entries, grade profile and entries mix. |
| Data | smt.subjects |
| Grain | School × subject (or subject area) × year |
| Sources | academic_subject_family, dfe_ks4_subject_entries, dfe_ks5_subject_results |
| Keying | urn |
| Years | 2021 → 2024 |
| School | ✓ |
| Subject area | ✗ Not a subject measure |
| Set | ✓ |
| LA | ✗ No LA ranks for results (0.6.6 ranks nationally and by region) |
| Region | ✗ Not held |
| England | ✓ every school with a figure |
| Honest number types | totals, points, change_points, rank |
| Rules | R-SMT-SET-RANKS, R-SMT-SMALL-ENTRIES, R-ADM-FLAG-STRENGTHS, R-TREND-FROM-2223 |
| Fetched by | - src/lib/smt/academic.ts:buildAcademic<br>- src/app/api/smt/academic/route.ts |
| Known gaps | - The subject areas are the data's own families (8), not the spec's illustrative list.<br>- Entries before 2023/24 come from the historic sources; the mix draws every year the subject rollup holds entries for, from its first (R-ENTRIES-FIRST-YEAR: 2020/21 at GCSE, entries only). |
| Briefing | none |
| Citation | DfE KS4 and KS5 subject tables |

### M-SMT-AREA — The area around the school

| Field | Content |
| --- | --- |
| Definition | Residents by single year of age 0-18 within 5 miles of the school (ONS LSOA estimates, school_context_lookup) and per LA (ons_population_age; a shire county is its districts), ONS 2022-based projections by single year of age (ons_snpp), the school's neighbourhood deprivation and the IDACI mix of the children within 5 miles (IoD2025), free school meals for the school, its LA and England (dfe_school_fsm, dfe_fsm_geography), births by LA (ONS), census pupils at schools within 5 miles, and the LSOA and LA boundaries for the map (src/lib/smt/context.ts, context-map.ts). |
| Data | smt.area |
| Grain | LSOA, the 5-mile area or the LA × year |
| Sources | school_context_lookup, lsoa_context_lookup, ons_population_age, ons_snpp, dfe_school_fsm, dfe_fsm_geography, ons_births, lsoa_boundaries, la_boundaries, la_gss_crosswalk, age_profile_aggregates, dfe_school_census |
| Keying | geography |
| Years | 2011 → 2025. Small-area residents from mid-2011 to the latest mid-year held; LA residents from mid-2012; births from 2012; FSM from 2019/20; projections 11 years past the latest LA estimate. Every latest year is read from the data. |
| School | ✗ An area measure |
| Subject area | ✗ Not a subject measure |
| Set | ✗ An area measure |
| LA | ✓ age_profile_aggregates, ons_births |
| Region | ✓ the region's LAs on the map |
| England | ✓ births: the sum of every English LA |
| Honest number types | totals, pct_change, index100 |
| Rules | R-SMT-CONTEXT-RESIDENTS, R-SMT-CONTEXT-DEPRIVATION, R-SMT-CONTEXT-FSM, R-SMT-CONTEXT-WORDING, R-SMT-CONTEXT-GEOGRAPHY, R-SMT-YEARS |
| Fetched by | - src/lib/smt/context.ts:buildContext<br>- src/lib/smt/context-map.ts:buildContextMap<br>- src/lib/smt/area-data.ts<br>- src/app/api/smt/context/route.ts<br>- src/app/api/smt/context/map/route.ts |
| Known gaps | - The map shades local authorities until the LSOA boundaries are loaded (K0).<br>- No district for a school: no anon lookup returns postcode_geography.lad_code, so the place line is town · LA · region.<br>- Projections are by local authority only.<br>- FSM is not published for independent schools; “FSM ever 6” isn't in this source. |
| Briefing | none |
| Citation | ONS mid-year estimates (LSOA and LA); ONS subnational population projections; English Indices of Deprivation (MHCLG); DfE Schools, pupils and their characteristics; ONS births; DfE school census (January) |
