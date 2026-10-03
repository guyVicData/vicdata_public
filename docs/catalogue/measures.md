<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Measures

What is counted, at what grain, where, with which honest number types. 14 measures.

## Summary

| ID | Name | Data | Phase | Years | School | Subject area | Set | LA | Region | England | Number types |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-KS4-ENTRIES | GCSE candidates | academic.candidates | ks4 | 2020/21–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, market_share, index100, rank |
| M-KS4-POINTS | GCSE average points | academic.results (points) | ks4 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS4-HEADLINE | Attainment 8 | academic.results (points) | ks4 | 2021/22–2024/25 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS4-THRESHOLD | GCSE Grade 4+ rate | academic.results (threshold) | ks4 | 2023/24–2024/25 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | rate, change_pp, rank |
| M-KS4-BANDS | GCSE grade bands | academic.results (bands) | ks4 | 2023/24–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | rate, change_pp, totals, market_share, rank |
| M-KS4-COUNTS | GCSE grade counts | academic.results (counts) | ks4 | 2023/24–2024/25 | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | totals, rate |
| M-KS5-ENTRIES | Post-16 candidates | academic.candidates | ks5 | 2020/21–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, market_share, index100, rank |
| M-KS5-POINTS | Post-16 average points | academic.results (points) | ks5 | 2021/22–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS5-HEADLINE | A-level points per entry | academic.results (points) | ks5 | 2021/22–2024/25 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | points, change_points, rank |
| M-KS5-THRESHOLD | Post-16 A*-E rate | academic.results (threshold) | ks5 | 2023/24–2024/25 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | rate, change_pp, rank |
| M-KS5-BANDS | Post-16 grade bands | academic.results (bands) | ks5 | 2023/24–2024/25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | rate, change_pp, totals, market_share, rank |
| M-KS5-COUNTS | Post-16 grade counts | academic.results (counts) | ks5 | 2023/24–2024/25 | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | totals, rate |
| M-ROLLS | Rolls | rolls | — | 2019–2025 | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | totals, pct_change, market_share, index100 |
| M-BIRTHS | Live births | social.births | — | 2021–2025 | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | totals, pct_change, index100 |

## Cards

### M-KS4-ENTRIES — GCSE candidates

| Field | Content |
| --- | --- |
| Definition | Exam entries per subject, every qualification type (the DfE 'Total' row), per school and year. |
| Data | academic.candidates |
| Grain | Raw: school × subject × qualification type × year. Rollup: school × subject × year, qualifications summed. |
| Sources | dfe_ks4_subject_entries, dfe_ks4_subject_entries_historic |
| Keying | urn |
| Years | 2020/21 → 2024/25. Rollup entries 5 years. The subject list comes from raw facts, latest year only (page.tsx:buildSubjectItems). Area (points-eligible) entries 2021/22-2024/25. |
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
| Known gaps | - Rename 'Average point score' -> 'Average points' decided (C3), not yet done (teacher-view-panels.ts:113).<br>- Code offers '% change in average point score' (teacher-view-panels.ts:112-121): R-NUMBER-TYPE-HONESTY. |
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
| Sources | dfe_ks4_subject_entries |
| Keying | urn |
| Years | 2023/24 → 2024/25. School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for 4,864 KS4 schools but the app never reads it. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side over the category (page.tsx:1227-1237) |
| Set | ✓ comparator-grades, scored per subject and exact qualification (R-COMPARATOR-RATE-PER-QUAL) |
| LA | ✗ Not wired: no area threshold benchmark in the UI (R-NO-GRADE-RATE-GEO), though grade geography would give it |
| Region | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| England | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| Honest number types | rate, change_pp, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-NO-GRADE-RATE-GEO, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY, R-TREND-LINE-4YR |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools)<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - School years (2) are shorter than area years (4): the grade rollup is not read.<br>- comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).<br>- Code labels the change '% change in grade 4+ rate' (teacher-view-panels.ts:125) though formatDelta prints pp; change lists show % change (R-NUMBER-TYPE-HONESTY).<br>- No area benchmark is wired although the grade geography would give one. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-BANDS — GCSE grade bands

| Field | Content |
| --- | --- |
| Definition | Share of a subject's graded entries inside a chosen contiguous range on the subject's own scale (subject-grades.ts:bandRate). Presets 4-9 and 7-9 on GCSE 9-1; default 7-9. |
| Data | academic.results · bands |
| Grain | School × subject × qualification type × grade × year |
| Sources | dfe_ks4_subject_entries |
| Keying | urn |
| Years | 2023/24 → 2024/25. School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for 4,864 KS4 schools but the app never reads it. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side |
| Set | ✓ comparator-grades |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Only the focused subject carries a benchmark (R-BANDS-ENGLAND-BENCH). |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | rate, change_pp, totals, market_share, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-BANDS-ENGLAND-BENCH, R-DONUT-COUNTS-ONLY, R-MIN-SCHOOLS, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools)<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - School years (2) are shorter than area years (4): the grade rollup is not read.<br>- comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).<br>- Trend of bands: Results Trends draws it, but only over the 2 school years. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo) |
| Citation | DfE Key stage 4 performance |

### M-KS4-COUNTS — GCSE grade counts

| Field | Content |
| --- | --- |
| Definition | Entries at each grade for one subject × qualification, and each grade's share of graded entries. |
| Data | academic.results · counts |
| Grain | School × subject × qualification type × grade × year |
| Sources | dfe_ks4_subject_entries |
| Keying | urn |
| Years | 2023/24 → 2024/25. School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for 4,864 KS4 schools but the app never reads it. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✗ Grade counts are per subject; a category has no single grade scale |
| Set | ✗ No comparator grade-count view; Comparisons falls back to points (R-MEASURE-FALLBACK) |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Shown as England share ticks. |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | totals, rate |
| Rules | R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-MIN-SCHOOLS, R-MEASURE-FALLBACK, R-FOCUS-NEVER-FILTERED |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools)<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - School years (2) are shorter than area years (4): the grade rollup is not read.<br>- comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).<br>- Context and Comparisons have no grade-count view; they fall back to points (R-MEASURE-FALLBACK). |
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
| Known gaps | - The IB Diploma total ('Diploma total points', 0-45) is a separate figure (academic-data-view.ts:ibDiplomaHeadline).<br>- Context 'All subjects' blends qualifications (R-POINTS-SAME-QUAL open issue).<br>- Same '% change' label issue as GCSE (teacher-view-panels.ts:114). |
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
| Sources | dfe_ks5_subject_results, dfe_tlevel_results |
| Keying | urn |
| Years | 2023/24 → 2024/25. School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for 2,893 KS5 schools but the app never reads it. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side over the category (page.tsx:1227-1237) |
| Set | ✓ comparator-grades, scored per subject and exact qualification (R-COMPARATOR-RATE-PER-QUAL) |
| LA | ✗ Not wired: no area threshold benchmark in the UI (R-NO-GRADE-RATE-GEO), though grade geography would give it |
| Region | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| England | ✗ Not wired (R-NO-GRADE-RATE-GEO) |
| Honest number types | rate, change_pp, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-NO-GRADE-RATE-GEO, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY, R-TREND-LINE-4YR, R-KS5-ASAEA-EXCL |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools)<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - School years (2) are shorter than area years (4): the grade rollup is not read.<br>- comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).<br>- Code labels the change '% change in A*-E rate' (teacher-view-panels.ts:125) though formatDelta prints pp; change lists show % change (R-NUMBER-TYPE-HONESTY).<br>- No area benchmark is wired although the grade geography would give one. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-BANDS — Post-16 grade bands

| Field | Content |
| --- | --- |
| Definition | Share of a subject's graded entries inside a chosen contiguous range on the subject's own scale (subject-grades.ts:bandRate). No presets: custom range only. |
| Data | academic.results · bands |
| Grain | School × subject × qualification type × size × grade × year |
| Sources | dfe_ks5_subject_results, dfe_tlevel_results |
| Keying | urn |
| Years | 2023/24 → 2024/25. School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for 2,893 KS5 schools but the app never reads it. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✓ computed client-side |
| Set | ✓ comparator-grades |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Only the focused subject carries a benchmark (R-BANDS-ENGLAND-BENCH). |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | rate, change_pp, totals, market_share, rank |
| Rules | R-GRADE-SCALE-MATCH, R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-BANDS-ENGLAND-BENCH, R-DONUT-COUNTS-ONLY, R-MIN-SCHOOLS, R-FOCUS-NEVER-FILTERED, R-COMPARATOR-RATE-PER-QUAL, R-NUMBER-TYPE-HONESTY, R-KS5-ASAEA-EXCL |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools)<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - School years (2) are shorter than area years (4): the grade rollup is not read.<br>- comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).<br>- Trend of bands: Results Trends draws it, but only over the 2 school years. |
| Briefing | /Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo) |
| Citation | DfE A level and other 16 to 18 results |

### M-KS5-COUNTS — Post-16 grade counts

| Field | Content |
| --- | --- |
| Definition | Entries at each grade for one subject × qualification, and each grade's share of graded entries. |
| Data | academic.results · counts |
| Grain | School × subject × qualification type × size × grade × year |
| Sources | dfe_ks5_subject_results, dfe_tlevel_results |
| Keying | urn |
| Years | 2023/24 → 2024/25. School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for 2,893 KS5 schools but the app never reads it. Area grade figures 2021/22-2024/25. |
| School | ✓ |
| Subject area | ✗ Grade counts are per subject; a category has no single grade scale |
| Set | ✗ No comparator grade-count view; Comparisons falls back to points (R-MEASURE-FALLBACK) |
| LA | ✓ academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). Shown as England share ticks. |
| Region | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row |
| England | ✓ academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain) |
| Honest number types | totals, rate |
| Rules | R-NON-GRADES-EXCL, R-THRESHOLD-PERIODS, R-MIN-SCHOOLS, R-MEASURE-FALLBACK, R-FOCUS-NEVER-FILTERED |
| Fetched by | - src/app/api/teacher/dashboard/route.ts (subjectData.gradeDistribution via src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools)<br>- src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)<br>- src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts) |
| Known gaps | - School years (2) are shorter than area years (4): the grade rollup is not read.<br>- comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).<br>- Context and Comparisons have no grade-count view; they fall back to points (R-MEASURE-FALLBACK). |
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
