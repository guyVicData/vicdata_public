<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Rules

What a number is allowed to be. 43 rules: 42 active, 1 superseded; 22 must lift (enforced only in UI code before 0.6).

## Summary

| ID | Status | Statement | Must lift | Test | Open issue |
| --- | --- | --- | --- | --- | --- |
| R-ENTRIES-NOT-POINTS | active | Entries count every qualification; points come only from qualifications with a real challenge table, and a row with no points of its own shows none rather than borrowing another's. | lifted | manual | — |
| R-POINTS-SAME-QUAL | active | A points figure is only comparable within one qualification type (KS4: qualification type; KS5: bucket or exact qualification). Post-16 Context on points keeps to the focused item's qualification family on every group, All subjects included; a figure that could only be a blend is not shown. | lifted | auto: pointsSameQual | — |
| R-KS4-POINTS-GCSE-FULL | active | KS4 points come only from GCSE (9-1) Full Course entries with a clean single grade. | lifted | manual | — |
| R-KS5-ASAEA-EXCL | active | AS level and AEA are left out of comparison lists, group totals and averages at Post-16, never out of the focused item's own figure -- and a focused AS/AEA item counts itself into its own group. | lifted | auto: asAeaGroupTotal | — |
| R-KS5-ENGLAND-EXACT | active | The Post-16 England figure is the exact subject × qualification figure or nothing; there is no bucket fallback. | no | auto: englandExact | — |
| R-MIN-SCHOOLS | active | An LA or region benchmark row is suppressed below 5 schools. England is exempt (minimum 1) for points and entries geography and the England anchor, but not for grade-grain geography, where every grade row needs 5 schools. | no | auto: minSchools | — |
| R-SINGLE-BUCKET-100 | active | The unfiltered (Type = All) category view shows points only when the category's scoreable entries are 100% one scored bucket, and the comparator side agrees on the bucket. No tolerance band. | yes, not yet lifted | none yet | — |
| R-IB-NONSUBJECT | active | Baccalaureate (Diploma total, Combined Certificate) and IB Core rows are excluded from subject entries; IB Core components are included in IB bucket points; the Diploma total is never scored. | no | auto: ibNonSubject | — |
| R-FOCUS-NEVER-FILTERED | active | The focused item (a subject, or the school itself in Comparisons) is never filtered out of its own figures, only out of comparison lists. | lifted | manual | — |
| R-TREND-3YR | superseded by R-TREND-LINE-4YR | Trend views need 3+ years; below that, show the table only. | no | none yet | — |
| R-ZERO-CANDIDATE | active | A school with a stage row but no real candidate count and no real headline measure is not 'present' for that stage; special schools are matched only with special schools (and vice versa) in nearest and comparator pools. | no | manual | yes |
| R-POINTS-WEIGHTED | active | A subject's points across several qualifications in one family are weighted by points-eligible entries, not flat-averaged. | lifted | auto: pointsWeighted | — |
| R-TREND-LINE-4YR | active | A trend is drawn as a line only with 4 or more real years; below that: per-year bars (TrendChart), a ranked change-in-units list (MultiTrend), or the table alone (Comparisons Trend); the Actual and Trend-line toggles disable. | no | auto: trendLine | yes |
| R-DONUT-COUNTS-ONLY | active | Share (donut) only for counts (entries), and for grade bands once a range is picked; never for averages or rates. | lifted | manual | — |
| R-NO-GRADE-RATE-GEO | active | No LA, region or England benchmark for the Grade 4+ / A*-E rate; the geography comparison is points-only on Results (entries on Candidates). | lifted | manual | yes |
| R-BANDS-ENGLAND-BENCH | active | On Grade bands the focused subject's benchmark is England's rate on the same span, from grade geography; peers carry none. | lifted | auto: bandsEnglandBench | — |
| R-GRADE-SCALE-MATCH | active | A rate is computed only on the scale it was defined on (threshold: GCSE 9-1 / Double Award at KS4, A-level A*-E at KS5; bands: the scale the range was picked on). Vocational, IB and Pre-U rows get no figure. | no | manual | — |
| R-NON-GRADES-EXCL | active | Suppressed, No result, X, Covid impacted and other non-grades (2021/22-2022/23 KS5 too: COVID result, Supp) are excluded from both sides of every grade rate and distribution. | no | none yet | — |
| R-THRESHOLD-PERIODS | active | Grade-based measures cover 2021/22 on at school level (0.6.2; 2023/24 on before); the axis is shortened to the years a subject has grades, never padded. | lifted | auto: thresholdPeriods | — |
| R-HISTORIC-GRADE-LABELS | active | 2021/22-2022/23 KS5 grade labels are read in their 2023/24 words: vocational short codes (* D M P HM HP, ** *D DD DM MM MP PP, *** **D *DD DDD DDM DMM MMM MMP MPP PPP) become Distinction* ... Pass-Pass-Pass on BTEC, OCR Cambridge Technical, Other General Qualification and AEA, and on a VRQ set only where it carries a code no A-level-type scale has; never on A level, AS, EPQ, Core Maths, FSMQ, IB or Pre-U. COVID result and Supp are non-grades (R-NON-GRADES-EXCL). KS4's historic labels already match. | no | auto: historicGradeLabels | — |
| R-QUAL-FAMILY-MATCH | active | Column 1's category and Context's Selected set contain only the focus's qualification family (KS5 display bucket). 'All subjects' crosses families, except on Post-16 points, where it keeps to the focus's family too (R-POINTS-SAME-QUAL). | lifted | manual | — |
| R-KS4-SUBJECT-DEDUP | active | At GCSE, one category row per subject (headline rows are per subject); at Post-16, none. | lifted | none yet | — |
| R-SELF-INCLUSIVE-GROUP | active | Group totals and averages include the focused subject. | lifted | manual | — |
| R-SAME-YEAR-BENCH | active | A benchmark is read for the same year as the figure, or not at all. | lifted | none yet | — |
| R-PREV-YEAR-FALLBACK | active | With no benchmark, the delta is against the subject's own previous published year ('vs last year'). | lifted | manual | — |
| R-MEASURE-FALLBACK | active | Context falls back to points when Results is on Grade counts or on bands without a range; Comparisons falls back to points (with a subject chip) or the headline (without). | lifted | manual | — |
| R-GEO-APPLIES | active | The geography comparison is shown only where the area figure counts the same thing: at KS4 for GCSE (9-1) Full Course items only; on Results for points only. | lifted | manual | — |
| R-GEO-POINTS-ELIGIBLE | active | The school's own row beside area entries is its points-eligible entries (entries × coverage), not its Candidates count. | lifted | none yet | — |
| R-IGCSE-EXCL | active | At GCSE a comparator flagged by igcseExclusionLikely is dropped from every set; the target is kept but flagged and its results history withheld. | no | manual | — |
| R-COMPARATOR-NO-FIGURE | active | A comparator with no figure for the measure (or none in the latest year) is not listed and never ranked last. Not applied while loading. | lifted | manual | — |
| R-COMPARATOR-RATE-PER-QUAL | active | Comparator rates are scored per subject and exact qualification, with the page's own rate function. | lifted | none yet | — |
| R-COMPARATOR-GRADE-SHARE | active | Grade counts across schools (Column 1's grade spread, 'Add an average' across the 10 nearest / a saved set) is each grade's share of a school's graded entries, averaged (mean or median) over the set's other schools with graded entries that year, for the focused subject and exact qualification; drawn as ticks in place of England's, at the school's own scale in counts mode. Never a raw count, never weighted by entries. | no | none yet | — |
| R-2122-GRADING-NOTE | active | A grade or points view over time (Trends: line, table, ranked change, change table, slope, Grade counts' spread against an earlier year, a change map) whose years include 2021/22 carries the note GRADING_2122_NOTE after its source: in the panel's 'i', and printed as text in fullscreen and in 'Print this graph'. Never on a latest-year view (Current, Results' Trend map), on Candidates (entries), at KS2, or on a trend whose years start after 2021/22 (a 'From' year of 2022/23 or later). | no | auto: gradingNote2122 | — |
| R-RANKING-SAMPLE | active | A national or regional ranking set is a sample: no map or change maps; rank and average come from the whole population on the ranking's own (headline) measure. | lifted | none yet | — |
| R-PERIOD-TRIM | active | Leading and trailing periods with no published value are trimmed (2020/21 points are null nationally). | no | manual | — |
| R-INDEX-HEADCOUNTS | active | Only sum measures (entries) are indexed to 100; points and rates are drawn at real levels. | no | none yet | — |
| R-RANK-TIES | active | Ties share a rank; the next rank skips; a null is unranked. | no | none yet | — |
| R-TREND-FLAT-4PCT | active | A trend is 'Broadly stable' within ±4%. | no | none yet | — |
| R-NUMBER-TYPE-HONESTY | active | A measure is shown only in its honest number types (catalogue §3): counts as totals, % change, share or index; averages as points and change in points; rates as rate and change in percentage points. | no | none yet | — |
| R-ROLLS-HEADCOUNT | active | Rolls are census headcounts, not FTE; part-time pupils count as one. | no | none yet | — |
| R-ROLLS-MAINSTREAM-AGG | active | LA, region and England roll aggregates count mainstream schools only. | no | none yet | yes |
| R-BIRTHS-FULL-WINDOW | active | The births trend is shown only when all five years (2021-2025) exist for the area; otherwise nothing. | no | none yet | — |
| R-BIRTHS-SHIRE-SUM | active | A shire county's births are the sum of its districts' births. | no | none yet | — |

## Cards

### R-ENTRIES-NOT-POINTS

| Field | Content |
| --- | --- |
| Statement | Entries count every qualification; points come only from qualifications with a real challenge table, and a row with no points of its own shows none rather than borrowing another's. |
| Why | At GCSE, headline rows are per subject, so a BTEC or OCR item in the same subject showed the GCSE score as its own. |
| Applies to | M-KS4-ENTRIES, M-KS4-POINTS, M-KS5-ENTRIES, M-KS5-POINTS; every column |
| Enforced in | - vicdata:ingest/academic_aggregates.py:139-142,283-288 (entries_total from every TOTAL row; points only when qualification == points_qual)<br>- vicdata:supabase/migrations/20260915100000_academic_subject_rollup.sql:31,64-65 (avg_point_score, points_coverage_percent)<br>- src/app/teacher/[phase]/page.tsx:pointsAt (936)<br>- src/app/teacher/[phase]/page.tsx:resultsFor (499) |
| Tagged at | - src/lib/dfe-qualification-buckets.ts<br>- src/lib/teacher-view-measures.ts |
| Test case | The Chase (137625), ks4: A BTEC or Cambridge National item in a subject that also has GCSE shows no Results figure (no specific item recorded yet). [manual] |
| Origin | Academic Results phase build report; page gate from Teacher view round 6 (comment page.tsx:478-482) |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:pointsAt, resultsFor → src/lib/teacher-view-measures.ts:ownHeadlineRows, carriesOwnPoints, subjectPointsAt, subjectEntriesAt (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-POINTS-SAME-QUAL

| Field | Content |
| --- | --- |
| Statement | A points figure is only comparable within one qualification type (KS4: qualification type; KS5: bucket or exact qualification). Post-16 Context on points keeps to the focused item's qualification family on every group, All subjects included; a figure that could only be a blend is not shown. |
| Why | A-level, BTEC and IB points sit on different challenge tables; one bar chart or average across them compares unlike scales. |
| Applies to | M-KS4-POINTS, M-KS5-POINTS; map chips, Column 1 category, Context |
| Enforced in | - src/lib/teacher-view-catalogue.ts:comparabilityKey (124-127)<br>- src/app/api/teacher/dashboard/route.ts:englandAverages (56-72, exact qualification)<br>- src/app/teacher/[phase]/page.tsx:candidateItems (1063-1099, via R-QUAL-FAMILY-MATCH)<br>- src/lib/teacher-view-measures.ts:contextKeepsToFamily, onFocusPointsScale, contextGroupValue (Post-16 points rows in the focus's family only)<br>- src/lib/teacher-view-populations.ts:contextItemsOf (keepToFamily: All subjects on Post-16 points) |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/teacher-view-catalogue.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/teacher-view-populations.ts |
| Test case | Croydon College (130432), ks5, Business Studies, 2024/25: Context on Average point score: Business Studies (A level + five BTEC sizes) has one group value per family -- the A-level family's is the A-level row's own 26.36, the BTEC family's is the BTEC rows' weighted mean; no focus = no value. With A-level Computer Science focused, All subjects draws 20 A-level subjects (was 55 across every family) and its average is 25.6 (was a 24.7 blend). [runner: pointsSameQual] |
| Origin | Academic Results phase; Post-16 Part C and Part D |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:groupValueFor (1207-1216), contextItems (1361-1369) → src/lib/teacher-view-measures.ts:subjectPointsAt, latestOwnPoints; POINTS_BEARING_QUALIFICATION -> src/lib/dfe-qualification-buckets.ts (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - S3b (Guy's decision 3, 3 Oct 2026): Post-16 Context on points no longer blends A level, BTEC and IB. contextGroupValue keeps each member's rows to the focused item's qualification family (display bucket), and contextItemsOf keeps All subjects' peers to it too (contextKeepsToFamily = Post-16 points; entries still add up across families). A row with no qualification type is never counted (suppressed, not blended); none occurred in the real data checked. The Context note says 'Points are on a different scale for each qualification type, so only <family> subjects are compared.' Before/after for 130432, 117037, 100369 and 130448 in the commit message. |

### R-KS4-POINTS-GCSE-FULL

| Field | Content |
| --- | --- |
| Statement | KS4 points come only from GCSE (9-1) Full Course entries with a clean single grade. |
| Why | Short courses, Double Award and vocational qualifications have no place on the 9-1 points table; scoring them would invent figures. |
| Applies to | M-KS4-POINTS; Column 1 geography (applicability) |
| Enforced in | - vicdata:ingest/academic_aggregates.py:139-140,285 (grade in points_table = single grades only)<br>- src/components/data-view/SubjectAreaSection.tsx:POINTS_BEARING_QUALIFICATION (151-155), imported by page.tsx:34<br>- src/app/teacher/[phase]/page.tsx:pointsAt (936), resultsFor (499)<br>- src/app/teacher/[phase]/page.tsx:geography applies (1729, 1857) |
| Tagged at | - src/components/data-view/SubjectAreaSection.tsx<br>- src/lib/dfe-qualification-buckets.ts<br>- src/lib/teacher-view-geography.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-series/compare-lines.ts<br>- src/lib/view-series/geography.ts |
| Test case | The Chase (137625), ks4: A subject offered as both GCSE and Cambridge National: only the GCSE item carries a points figure (item TBD). [manual] |
| Origin | Academic Results phase (GCSE points); Teacher view round 6 |
| Status | active |
| Must lift | src/components/data-view/SubjectAreaSection.tsx:POINTS_BEARING_QUALIFICATION; page.tsx gates → src/lib/teacher-view-measures.ts:carriesOwnPoints (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-KS5-ASAEA-EXCL

| Field | Content |
| --- | --- |
| Statement | AS level and AEA are left out of comparison lists, group totals and averages at Post-16, never out of the focused item's own figure -- and a focused AS/AEA item counts itself into its own group. |
| Why | AS entries double-counted beside A level and inflated group totals: 102239's 'All subjects' total was 2,480 against 591 real non-AS entries. |
| Applies to | M-KS5-ENTRIES, M-KS5-POINTS, M-KS5-THRESHOLD, M-KS5-BANDS; Column 1 category, Context |
| Enforced in | - src/lib/dfe-qualification-buckets.ts:isAsLevelOrAea (138-141)<br>- src/app/teacher/[phase]/page.tsx:comparablePeer (1055)<br>- src/app/teacher/[phase]/page.tsx:candidateItems (1075)<br>- src/app/teacher/[phase]/page.tsx:groupRows, inGroup (1190-1191)<br>- src/app/teacher/[phase]/page.tsx:threshold group (1228), asOrAeaOnly (1249-1253), selected (1265,1277,1282), band share (1331), contextItems (1367), schoolSubjects (1837) |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/dfe-qualification-buckets.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/teacher-view-populations.ts<br>- src/lib/view-editor.test.ts |
| Test case | Whitmore High School (102239), ks5, 2024/25: Context 'All subjects' entries group total 591 (was 2,480 with AS/AEA and the doubled bucket rows). [runner: asAeaGroupTotal] |
| Origin | Post-16 Part C1 (..._post16_category_context_exclude_as_aea_build_report_v1.md); Part D |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx (the population filters listed under enforcedIn) → src/lib/teacher-view-populations.ts:isComparablePeer, contextGroupRows; src/lib/teacher-view-measures.ts:contextGroupValue (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - S3b (Guy's decision 3, Part D decision 1): a focused AS or AEA item counts itself into its own Context group. contextGroupRows and inContextGroup keep the focused item's own exact-qualification rows (headline and grade), and asOrAeaOnlySubjects no longer holds the focus's subject, so an AS-only focus is a member of All subjects and Selected, and its share and benchmark are of a group it is in. Every other AS/AEA row stays out. Applied to any AS/AEA focus, not only AS-only subjects (an AS Psychology focus beside A-level Psychology now adds its own AS entries too). Before/after (130432 Law and Economics AS, 130448 Further Maths AS, 100053 Psychology AS) in the commit message. |

### R-KS5-ENGLAND-EXACT

| Field | Content |
| --- | --- |
| Statement | The Post-16 England figure is the exact subject × qualification figure or nothing; there is no bucket fallback. |
| Why | A bucket average drawn beside an IB HL or VRQ bar compared the item with a figure for different qualifications. |
| Applies to | M-KS5-POINTS, M-KS5-ENTRIES (geography); Column 1 Results markers and geography views |
| Enforced in | - src/app/api/teacher/dashboard/route.ts:englandAverages (56-72)<br>- src/app/teacher/[phase]/page.tsx:englandValue keying (521-538)<br>- src/app/api/teacher/subject-geography/route.ts:61-64 (exact qualification at ks5) |
| Tagged at | - src/app/api/teacher/dashboard/route.ts<br>- src/app/api/teacher/subject-geography/route.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series/geography.ts |
| Test case | The Godolphin and Latymer School (100369), ks5, Chemistry, 2024/25: Own IB HL 58.29; England exact: IB HL 43.13, IB SL 37.84 (Part D report :65). [runner: englandExact] |
| Origin | Post-16 Part C, Part D |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-MIN-SCHOOLS

| Field | Content |
| --- | --- |
| Statement | An LA or region benchmark row is suppressed below 5 schools. England is exempt (minimum 1) for points and entries geography and the England anchor, but not for grade-grain geography, where every grade row needs 5 schools. |
| Why | A figure from one or two schools identifies them and swings wildly; it is not a benchmark. |
| Applies to | Every LA / region / England figure |
| Enforced in | - vicdata:supabase/migrations/20260926140000_subject_geography_lookup_min_school_count.sql:35,66,90,123<br>- vicdata:supabase/migrations/20260927121000_academic_subject_grade_geography_aggregate.sql:50,82<br>- src/app/api/teacher/subject-geography/route.ts:59 (national passes 1)<br>- src/app/api/teacher/dashboard/route.ts:66,74 (national passes 1)<br>- src/lib/vicdata-reference.ts:lookupAcademicSubjectGradeGeography (633, passes null) |
| Tagged at | - src/app/api/teacher/dashboard/route.ts<br>- src/app/api/teacher/subject-geography/route.ts<br>- src/lib/teacher-view-grade-geography.ts<br>- src/lib/vicdata-reference.ts<br>- src/lib/view-series/geography.ts |
| Test case | Acland Burghley School (100053), ks4, all years: Camden (the school's LA) GCSE points geography: every row returned by default has school_count >= 5, and asking for minimum 1 returns more rows. [runner: minSchools] |
| Origin | Subject geography rounds (min school count migration) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SINGLE-BUCKET-100

| Field | Content |
| --- | --- |
| Statement | The unfiltered (Type = All) category view shows points only when the category's scoreable entries are 100% one scored bucket, and the comparator side agrees on the bucket. No tolerance band. |
| Why | A category mixing A level and BTEC has no single points scale; borrowing one bucket's points would misdescribe the rest. |
| Applies to | Data View category measures (not the Teacher view) |
| Enforced in | - src/components/data-view/SubjectAreaSection.tsx:singleScoredBucketFor, agreedScoredBucketFor (68-100) |
| Tagged at | - src/components/data-view/SubjectAreaSection.tsx |
| Test case | — |
| Origin | Data View subject area round |
| Status | active |
| Must lift | src/components/data-view/SubjectAreaSection.tsx:singleScoredBucketFor, agreedScoredBucketFor → src/lib/academic-data-view.ts (not yet lifted). Deferred: needed only when Data View category measures are registered. No Teacher view path uses it. |
| Open issue | — |
| Fixed | — |

### R-IB-NONSUBJECT

| Field | Content |
| --- | --- |
| Statement | Baccalaureate (Diploma total, Combined Certificate) and IB Core rows are excluded from subject entries; IB Core components are included in IB bucket points; the Diploma total is never scored. |
| Why | Including the Diploma total pushed 100369's IB average to 60.2, above the HL maximum of 60. |
| Applies to | M-KS5-ENTRIES, M-KS5-POINTS |
| Enforced in | - vicdata:ingest/academic_aggregates.py:_NON_SUBJECT_ROWS (103-135), skip (270), points kept (446-455)<br>- vicdata:supabase/migrations/20260918160000_remove_ib_non_subject_rows.sql<br>- src/lib/dfe-qualification-buckets.ts:challengeFor (246-262, the TS twin)<br>- src/lib/dfe-qualification-buckets.ts:NON_SUBJECT_ROWS, isNonSubjectRow (the port of _NON_SUBJECT_ROWS, S3b)<br>- src/lib/teacher-view-populations.ts:subjectItemsOf (the Teacher subject list, S3b) |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/dfe-qualification-buckets.ts<br>- src/lib/teacher-view-populations.ts |
| Test case | Sevenoaks School (118952), ks5, 2024/25: The exact-qualification rollup has no Baccalaureate / IB Core subject rows, and the Teacher view's subject list (subjectItemsOf over the raw facts) carries none either: 29 items in 2024/25, not 32. The raw facts themselves still carry Baccalaureate, Learning Skills and Study Skills (244 each). [runner: ibNonSubject] |
| Origin | IB ingest round (vicdata), Post-16 points |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | - S3b (Guy's decision 4, 3 Oct 2026): the Teacher subject list leaves them out. page.tsx:buildSubjectItems moved to src/lib/teacher-view-populations.ts:subjectItemsOf, which drops every raw-facts row isNonSubjectRow matches; NON_SUBJECT_ROWS is an exact port of vicdata ingest/academic_aggregates.py:_NON_SUBJECT_ROWS (one list, pointing at its source). Before the fix the picker DID show them at Sevenoaks (118952): 'Learning Skills', 'Study Skills' and 'Baccalaureate', 244 entries each, top of the IB tab and of the list (Learning Skills and Baccalaureate under 'Other subjects', Study Skills under 'Enterprise & Applied Studies'); also at Godolphin and Latymer (100369), 26 each. Before/after in the commit message. |

### R-FOCUS-NEVER-FILTERED

| Field | Content |
| --- | --- |
| Statement | The focused item (a subject, or the school itself in Comparisons) is never filtered out of its own figures, only out of comparison lists. |
| Why | Exclusion rules written for comparison populations would otherwise blank the very subject a teacher picked (e.g. an AS Psychology focus). |
| Applies to | Every measure; Column 1, Context, Comparisons |
| Enforced in | - src/app/teacher/[phase]/page.tsx:candidateItems (1068-1070, focus first)<br>- src/app/teacher/[phase]/page.tsx:1141, 1362, 1381 (r.key === focusKey \|\|), 1837<br>- src/components/teacher/ComparisonsPanels.tsx:254, 276 (s.isTarget \|\|)<br>- src/lib/teacher-view-populations.ts:contextGroupRows, inContextGroup, asOrAeaOnlySubjects (the focused AS/AEA item's own rows count into its group, S3b)<br>- src/lib/teacher-view-comparator-series.ts:143 (target never dropped), 186 (target kept in fixed sets, flagged igcseExcluded) |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/teacher-view-comparator-series.ts<br>- src/lib/teacher-view-comparisons.ts<br>- src/lib/teacher-view-populations.ts |
| Test case | Whitmore High School (102239), ks5, Psychology (AS): Focus an AS item (AS Psychology in the AS/AEA report :19,38, which named no school; 102239 is a heavy-AS school): its own Column 1 panels still render with its own figures. [manual] |
| Origin | Post-16 Part C1 (AS/AEA); content round S4 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx (focus-first population code); src/components/teacher/ComparisonsPanels.tsx:254,276 → src/lib/teacher-view-populations.ts:keepFocusOrFigured; src/lib/teacher-view-comparisons.ts:comparisonSchools (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - S3b (Guy's decision 3, Part D decision 1): a focused AS or AEA item counts itself into its own Context group. contextGroupRows and inContextGroup keep the focused item's own exact-qualification rows (headline and grade), and asOrAeaOnlySubjects no longer holds the focus's subject, so an AS-only focus is a member of All subjects and Selected, and its share and benchmark are of a group it is in. Every other AS/AEA row stays out. Applied to any AS/AEA focus, not only AS-only subjects (an AS Psychology focus beside A-level Psychology now adds its own AS entries too). Before/after (130432 Law and Economics AS, 130448 Further Maths AS, 100053 Psychology AS) in the commit message. |

### R-TREND-3YR

| Field | Content |
| --- | --- |
| Statement | Trend views need 3+ years; below that, show the table only. |
| Why | Superseded: the live threshold for a line is 4 real years (R-TREND-LINE-4YR). TREND_MIN_YEARS = 3 survives only in the round-5 axis catalogue used by /teacher/meetings. |
| Applies to | Trend views |
| Enforced in | - src/lib/teacher-view-catalogue.ts:TREND_MIN_YEARS (24), used by src/app/teacher/meetings/page.tsx:25,69,76,153 |
| Tagged at | - src/lib/teacher-view-catalogue.ts |
| Test case | — |
| Origin | Teacher view round 5 (axis catalogue) |
| Status | superseded by R-TREND-LINE-4YR |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ZERO-CANDIDATE

| Field | Content |
| --- | --- |
| Statement | A school with a stage row but no real candidate count and no real headline measure is not 'present' for that stage; special schools are matched only with special schools (and vice versa) in nearest and comparator pools. |
| Why | Ark Soane (candidates = 0) appeared in every Data View list; Haverstock was matched with special schools. |
| Applies to | Comparator populations (Data View, dashboard card, nearest / comparator RPCs) |
| Enforced in | - src/lib/academic-data-view.ts:stagesPresent (174-190) -- Data View and dashboard card<br>- supabase/migrations/20260930120000_nearest_schools_special_and_through_school.sql<br>- supabase/migrations/20261001120000_comparator_candidates_special_schools.sql:50-67 |
| Tagged at | - src/lib/academic-data-view.ts |
| Test case | Acland Burghley School (100053), ks4: Ark Soane (candidates = 0) drops out of every Data View list; Harmood (special) gets 29/30 special comparators, Haverstock 0/30 (special_schools_zero_candidate report :24,34-35). [manual] |
| Origin | Special schools / zero-candidate filtering round |
| Status | active |
| Must lift | — |
| Open issue | Not applied to Teacher view comparator sets (rankFixedSets): a zero-candidate comparator with a 0-valued entries point is not excluded in Comparisons. Consider applying stagesPresent there. |
| Fixed | — |

### R-POINTS-WEIGHTED

| Field | Content |
| --- | --- |
| Statement | A subject's points across several qualifications in one family are weighted by points-eligible entries, not flat-averaged. |
| Why | A flat mean of the 'all' row and each bucket row let one IB entry count as much as forty A-level ones. |
| Applies to | M-KS5-POINTS (Context group values); rollups |
| Enforced in | - src/app/teacher/[phase]/page.tsx:groupValueFor (1207-1216)<br>- vicdata:ingest/academic_aggregates.py:285-288 |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/teacher-view-measures.ts |
| Test case | Croydon College (130432), ks5, Computer Science, 2024/25: On the A-level family's scale: Computer Science 7.0 (was 13.1), Chemistry 24.3 (was 29.7) (Part D report :57). Both are A-level-only in 2024/25 (Chemistry's AS row is excluded), so S3b's family filter leaves them unchanged. [runner: pointsWeighted] |
| Origin | Post-16 Part D |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:groupValueFor → src/lib/teacher-view-measures.ts:contextGroupValue (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-TREND-LINE-4YR

| Field | Content |
| --- | --- |
| Statement | A trend is drawn as a line only with 4 or more real years; below that: per-year bars (TrendChart), a ranked change-in-units list (MultiTrend), or the table alone (Comparisons Trend); the Actual and Trend-line toggles disable. |
| Why | Two or three points drawn as a line read as a trend that isn't there. |
| Applies to | Every over-time view |
| Enforced in | - src/lib/teacher-view-panels.ts:TREND_LINE_MIN_YEARS, trendChartKind (311-315)<br>- src/components/teacher/SeriesViews.tsx:multiTrendHasLine (48-49), MultiTrend fallback (76-90)<br>- src/components/teacher/TrendChart.tsx:185<br>- src/components/teacher/ComparisonsPanels.tsx:614-616, 649 (table only)<br>- src/components/teacher/CandidatesPanels.tsx:284, 292<br>- src/components/teacher/SubjectPanels.tsx:789, 798 |
| Tagged at | - src/lib/teacher-view-catalogue.ts<br>- src/lib/teacher-view-panels.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/comparisons.ts<br>- src/lib/view-series/series.ts<br>- src/lib/view-series/subjects.ts |
| Test case | Acland Burghley School (100053), ks4, Maths (General): Average points has 4 real years (2021/22-2024/25) -> line; Grade 4+ has 4 too since 0.6.2 (2021/22-2024/25) -> line (it had 2, 2023/24-2024/25 -> bars / change list, before). [runner: trendLine] |
| Origin | Teacher view round 7 §4 |
| Status | active |
| Must lift | — |
| Open issue | Legacy TREND_MIN_YEARS = 3 (teacher-view-catalogue.ts:24) is still read by /teacher/meetings: retire it or document it. |
| Fixed | — |

### R-DONUT-COUNTS-ONLY

| Field | Content |
| --- | --- |
| Statement | Share (donut) only for counts (entries), and for grade bands once a range is picked; never for averages or rates. |
| Why | A share of an average point score is not a meaningful percentage. |
| Applies to | DV-C2-CUR-DONUT; M-*-ENTRIES, M-*-BANDS |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1956<br>- src/components/teacher/SubjectPanels.tsx:297 (fallback to bar), 525-534 (button disabled)<br>- src/components/teacher/ShareDonut.tsx:10 (comment) |
| Tagged at | - src/components/teacher/SubjectPanels.tsx<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/donut.ts |
| Test case | Acland Burghley School (100053), ks4: Context on Results, Average points: the Share (donut) button is disabled ('Share is only meaningful for candidate numbers'). [manual] |
| Origin | Teacher view round 6 §4.2 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1956; src/components/teacher/SubjectPanels.tsx:297, 525-534 → src/lib/teacher-view-measures.ts:shareApplies (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-NO-GRADE-RATE-GEO

| Field | Content |
| --- | --- |
| Statement | No LA, region or England benchmark for the Grade 4+ / A*-E rate; the geography comparison is points-only on Results (entries on Candidates). |
| Why | No area threshold figure is wired up; drawing one from another measure would compare unlike things. |
| Applies to | M-KS4-THRESHOLD, M-KS5-THRESHOLD; Column 1 Results markers and geography views |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1136 (no benchmark on rates)<br>- src/app/teacher/[phase]/page.tsx:1153 (no England category line)<br>- src/app/teacher/[phase]/page.tsx:1727-1734 (applies)<br>- src/app/teacher/[phase]/page.tsx:1786 (benchmarkLabel undefined) |
| Tagged at | - src/components/dashboard-config/embed.ts<br>- src/lib/teacher-view-geography.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/geography.ts |
| Test case | Acland Burghley School (100053), ks4: Results -> Grade 4+ -> Area chart shows 'LA, regional and national figures are published for average point score only…'. [manual] |
| Origin | Comparisons / Grade 4 wiring round |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1136, 1153, 1727-1734, 1786 → src/lib/teacher-view-measures.ts:hasEnglandPointsBenchmark (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | Audit B: the grade geography (academic_subject_grade_geography_aggregate, 2021-2024) would give an England Grade 4+ rate (the 9-4 band), so the gap is wiring, not data. |
| Fixed | — |

### R-BANDS-ENGLAND-BENCH

| Field | Content |
| --- | --- |
| Statement | On Grade bands the focused subject's benchmark is England's rate on the same span, from grade geography; peers carry none. |
| Why | A band rate is only comparable with the same band computed the same way on England's own grade rows. |
| Applies to | M-KS4-BANDS, M-KS5-BANDS; Column 1 Results tiles and Grades view |
| Enforced in | - src/components/teacher/SubjectPanels.tsx:282-292 |
| Tagged at | - src/components/teacher/SubjectPanels.tsx<br>- src/lib/teacher-view-grade-geography.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/compare-lines.ts<br>- src/lib/view-series/grades.ts |
| Test case | The Chase (137625), ks4, History, 2024/25: Grades 7-9: 34.1% (45 of 132) vs England 26.6% (76,171 of 286,338); grades 4-9: 75.8% vs 64.6% (grade bands report :60). [runner: bandsEnglandBench] |
| Origin | Grade bands frontend round |
| Status | active |
| Must lift | src/components/teacher/SubjectPanels.tsx:282-292 → src/lib/teacher-view-grade-geography.ts:withEnglandBandBenchmark (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-GRADE-SCALE-MATCH

| Field | Content |
| --- | --- |
| Statement | A rate is computed only on the scale it was defined on (threshold: GCSE 9-1 / Double Award at KS4, A-level A*-E at KS5; bands: the scale the range was picked on). Vocational, IB and Pre-U rows get no figure. |
| Why | An IB 7-1 row read as GCSE numerics would be scored against a grade 4 it was never on. |
| Applies to | M-*-THRESHOLD, M-*-BANDS |
| Enforced in | - src/lib/subject-grades.ts:thresholdRate (155-180)<br>- src/lib/subject-grades.ts:bandRate (232-241)<br>- src/lib/subject-grades.ts:BAND_PRESETS (201-205) |
| Tagged at | - src/lib/subject-grades.ts<br>- src/lib/teacher-view-comparator-grades.ts<br>- src/lib/teacher-view-measures.ts |
| Test case | The Chase (137625), ks4: Asked for GCSE 7-9, a BTEC returns no figure (not 0%); an IB 7-1 row at KS5 is not scored against grade 4. [manual] |
| Origin | Teacher view round 6 §6.5; grade bands round |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-NON-GRADES-EXCL

| Field | Content |
| --- | --- |
| Statement | Suppressed, No result, X, Covid impacted and other non-grades (2021/22-2022/23 KS5 too: COVID result, Supp) are excluded from both sides of every grade rate and distribution. |
| Why | Counting them in the denominator depresses a real rate by however much DfE chose not to publish. |
| Applies to | M-*-THRESHOLD, M-*-BANDS, M-*-COUNTS |
| Enforced in | - src/lib/subject-grades.ts:NON_GRADE_VALUES (88), thresholdRate (160), bandRate (248)<br>- src/components/teacher/GradeCountsPanels.tsx:56, 86<br>- src/components/teacher/SubjectPanels.tsx:456-457 |
| Tagged at | - src/lib/grade-rows.test.ts<br>- src/lib/subject-grades.ts |
| Test case | — |
| Origin | Teacher view round 6 §6.5 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-THRESHOLD-PERIODS

| Field | Content |
| --- | --- |
| Statement | Grade-based measures cover 2021/22 on at school level (0.6.2; 2023/24 on before); the axis is shortened to the years a subject has grades, never padded. |
| Why | School grade rows begin in 2021/22 (the rollup or the historic facts; 2020/21 has no grades); padding earlier years would draw empty or borrowed values. |
| Applies to | M-*-THRESHOLD, M-*-BANDS, M-*-COUNTS |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1112-1116, 1315-1320 |
| Tagged at | - src/lib/teacher-view-measures.ts |
| Test case | Acland Burghley School (100053), ks4: The school's grade rows cover exactly 2021/22-2024/25 (0.6.2; 2023/24 and 2024/25 before), so Results on Grade 4+ shows 4 years. [runner: thresholdPeriods] |
| Origin | Teacher view round 6 §6.5 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1112-1116, 1315-1320 → src/lib/teacher-view-measures.ts:periodsForMeasure (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - 0.6.2 S2: school grade rows read 2021/22-2024/25 (src/lib/grade-rows.ts; academic-data-view.ts:fetchSubjectLevelDataForSchools gradeYears "four"): the rollup at KS4 through academic_subject_grade_rollup_lookup once applied, else the modern + historic facts; the facts at KS5. Grade measures gain 2021/22-2022/23 (docs/v0.6/grade_rollup_reconciliation_v1.md). |

### R-HISTORIC-GRADE-LABELS

| Field | Content |
| --- | --- |
| Statement | 2021/22-2022/23 KS5 grade labels are read in their 2023/24 words: vocational short codes (* D M P HM HP, ** *D DD DM MM MP PP, *** **D *DD DDD DDM DMM MMM MMP MPP PPP) become Distinction* ... Pass-Pass-Pass on BTEC, OCR Cambridge Technical, Other General Qualification and AEA, and on a VRQ set only where it carries a code no A-level-type scale has; never on A level, AS, EPQ, Core Maths, FSMQ, IB or Pre-U. COVID result and Supp are non-grades (R-NON-GRADES-EXCL). KS4's historic labels already match. |
| Why | '*' and 'D' are A-level grades too: read raw, a 2021/22 BTEC lands on the A-level scale, its bands give no figure and Grade counts shows letters; an unmapped COVID result left about 9% of 2021/22 A-level sets with no A*-E figure. |
| Applies to | M-KS5-THRESHOLD, M-KS5-BANDS, M-KS5-COUNTS (2021/22-2022/23) |
| Enforced in | - src/lib/grade-rows.ts:mapHistoricKs5Grade, parseSubjectGradeDistribution<br>- src/lib/subject-grades.ts:NON_GRADE_VALUES (88) |
| Tagged at | - src/app/api/teacher/comparator-grades/route.ts<br>- src/lib/academic-data-view.ts<br>- src/lib/grade-rows.test.ts<br>- src/lib/grade-rows.ts<br>- src/lib/subject-grades.ts |
| Test case | Croydon College (130432), ks5, Business Studies (BTEC Extended Certificate), 2021/22: 2021/22 reads Distinction* 2, Distinction 9, Merit 31, Pass 9 on the vocational scale (no '*' or 'D' rows, COVID result 44 a non-grade); King's Worcester (117037) A-level Maths 2021/22 keeps its '*' rows on the A-level scale, A*-E 100% of 45. [runner: historicGradeLabels] |
| Origin | 0.6.2 S1 §4 (docs/v0.6/grade_rollup_reconciliation_v1.md); S2 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-QUAL-FAMILY-MATCH

| Field | Content |
| --- | --- |
| Statement | Column 1's category and Context's Selected set contain only the focus's qualification family (KS5 display bucket). 'All subjects' crosses families, except on Post-16 points, where it keeps to the focus's family too (R-POINTS-SAME-QUAL). |
| Why | Core Maths beside A-level Maths in one category compared unlike qualifications. |
| Applies to | Column 1 category, Context Selected |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1063-1065, 1076, 1261-1263, 1272, 1277, 1282 |
| Tagged at | - src/lib/teacher-view-populations.ts<br>- src/lib/view-editor.test.ts |
| Test case | The Chase (137625), ks5, Mathematics (A level): A-level Maths focus: 5 bars, Core Maths absent (qualification-match report :29). [manual] |
| Origin | Column 1 qualification match round; combined round §4c |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1063-1065, 1076, 1261-1283 → src/lib/teacher-view-populations.ts:focusQualificationFamily, categoryItemsOf, contextMembersOf (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - S3b: on Post-16 points 'All subjects' keeps to the focus's qualification family (R-POINTS-SAME-QUAL). On entries and rates it still crosses families: counts add up, and rates are scored only on their own grade scale. |

### R-KS4-SUBJECT-DEDUP

| Field | Content |
| --- | --- |
| Statement | At GCSE, one category row per subject (headline rows are per subject); at Post-16, none. |
| Why | GCSE headline rows are per subject, so two qualification items in one subject would repeat the same figure. |
| Applies to | M-KS4-*; Column 1 category |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1096-1099, 1839 |
| Tagged at | - src/lib/teacher-view-populations.ts |
| Test case | — |
| Origin | Trend redesign step 1 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1096-1099, 1839 → src/lib/teacher-view-populations.ts:candidateItemsOf (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-SELF-INCLUSIVE-GROUP

| Field | Content |
| --- | --- |
| Statement | Group totals and averages include the focused subject. |
| Why | Before the fix a share could pass 100% (snagging round 1 Part 1). |
| Applies to | Context group, Column 1 category |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1152, 1270-1285 (esp. 1277)<br>- src/components/teacher/CandidatesPanels.tsx:157-160 |
| Tagged at | - src/lib/teacher-view-measures.ts<br>- src/lib/teacher-view-populations.ts |
| Test case | Acland Burghley School (100053), ks4: No Context donut share exceeds 100%. [manual] |
| Origin | Teacher view round 6 §4.2; snagging round 1 Part 1 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1152, 1270-1285; src/components/teacher/CandidatesPanels.tsx:157-160 → src/lib/teacher-view-populations.ts:contextMembersOf, inContextGroup (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - S3b (Guy's decision 3, Part D decision 1): a focused AS or AEA item counts itself into its own Context group. contextGroupRows and inContextGroup keep the focused item's own exact-qualification rows (headline and grade), and asOrAeaOnlySubjects no longer holds the focus's subject, so an AS-only focus is a member of All subjects and Selected, and its share and benchmark are of a group it is in. Every other AS/AEA row stays out. Applied to any AS/AEA focus, not only AS-only subjects (an AS Psychology focus beside A-level Psychology now adds its own AS entries too). Before/after (130432 Law and Economics AS, 130448 Further Maths AS, 100053 Psychology AS) in the commit message. |

### R-SAME-YEAR-BENCH

| Field | Content |
| --- | --- |
| Statement | A benchmark is read for the same year as the figure, or not at all. |
| Why | A latest-year figure beside an older England figure reads as a gap that is partly just time. |
| Applies to | Every benchmark marker and gap tile |
| Enforced in | - src/app/teacher/[phase]/page.tsx:531-538, 963<br>- src/components/teacher/SubjectPanels.tsx:342 |
| Tagged at | - src/lib/teacher-view-grade-geography.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/teacher-view-panels.ts |
| Test case | — |
| Origin | Teacher view design brief §6, §14 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:531-538, 963; src/components/teacher/SubjectPanels.tsx:342 → src/lib/teacher-view-measures.ts:englandIndexOf, englandValueAt (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-PREV-YEAR-FALLBACK

| Field | Content |
| --- | --- |
| Statement | With no benchmark, the delta is against the subject's own previous published year ('vs last year'). |
| Why | A delta column with nothing to compare against would be blank for every rate. |
| Applies to | DV-C1-RES-CUR-TABLE |
| Enforced in | - src/components/teacher/SubjectPanels.tsx:326-345, 643 |
| Tagged at | - src/components/teacher/SubjectPanels.tsx<br>- src/lib/teacher-view-panels.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/compare.ts<br>- src/lib/view-series/subjects.ts |
| Test case | Acland Burghley School (100053), ks4: Results on Grade 4+, Sortable table: the delta column is headed 'vs last year'. [manual] |
| Origin | Teacher view round 6 |
| Status | active |
| Must lift | src/components/teacher/SubjectPanels.tsx:326-345 → src/lib/teacher-view-panels.ts:currentRowsWithDelta (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-MEASURE-FALLBACK

| Field | Content |
| --- | --- |
| Statement | Context falls back to points when Results is on Grade counts or on bands without a range; Comparisons falls back to points (with a subject chip) or the headline (without). |
| Why | Grade counts has no single figure to compare subjects or schools on. |
| Applies to | Context, Comparisons on Results |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1174-1175, 1436-1443 |
| Tagged at | - src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts |
| Test case | Acland Burghley School (100053), ks4: Results -> Grade counts: Context shows Average points with the note 'Grade counts has no single figure to compare subjects on…'. [manual] |
| Origin | Grade bands frontend round |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1174-1175, 1436-1443 → src/lib/teacher-view-measures.ts:contextFallsBackFor, contextMeasureFor, comparisonsMeasureFor (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-GEO-APPLIES

| Field | Content |
| --- | --- |
| Statement | The geography comparison is shown only where the area figure counts the same thing: at KS4 for GCSE (9-1) Full Course items only; on Results for points only. |
| Why | Area entries count points-eligible GCSE entries only; set beside a BTEC item they would compare different things. |
| Applies to | DV-C1-*-TR-GEO-* |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1727-1734, 1857 |
| Tagged at | - src/lib/teacher-view-geography.ts |
| Test case | The Chase (137625), ks4: A GCSE BTEC focus shows the not-applicable note on Area chart. [manual] |
| Origin | Candidates live review Part 5; Post-16 Part C |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1727-1734, 1857 → src/lib/teacher-view-geography.ts:candidatesGeographyApplies, resultsGeographyApplies (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-GEO-POINTS-ELIGIBLE

| Field | Content |
| --- | --- |
| Statement | The school's own row beside area entries is its points-eligible entries (entries × coverage), not its Candidates count. |
| Why | Area entries are points-eligible entries; the school's full count beside them would overstate its share. |
| Applies to | DV-C1-CAND-TR-GEO-* |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1859-1862<br>- src/components/teacher/CandidatesPanels.tsx:370-371 (caveat) |
| Tagged at | - src/lib/teacher-view-geography.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/candidates.ts<br>- src/lib/view-series/compare-lines.ts<br>- src/lib/view-series/frames.ts<br>- src/lib/view-series/geography.ts |
| Test case | — |
| Origin | Candidates live review Part 5 |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1859-1862 → src/lib/teacher-view-geography.ts:pointsEligibleEntriesByPeriod (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-IGCSE-EXCL

| Field | Content |
| --- | --- |
| Statement | At GCSE a comparator flagged by igcseExclusionLikely is dropped from every set; the target is kept but flagged and its results history withheld. |
| Why | Schools sitting IGCSEs show artificially low DfE GCSE figures; ranking them against GCSE schools misleads. |
| Applies to | Comparisons (all GCSE measures); comparator maps |
| Enforced in | - src/lib/teacher-view-comparator-series.ts:130, 143, 159, 175, 186, 199<br>- src/components/teacher/RankingsMap.tsx:90<br>- src/lib/academic-data-view.ts:igcseExclusionLikely (679) |
| Tagged at | - src/components/teacher/RankingsMap.tsx<br>- src/lib/teacher-view-comparator-series.ts |
| Test case | The King's School Worcester (117037), ks4: Malvern College / Malvern St James absent from the set (unconfirmed, content round report :152). [manual] |
| Origin | Commit 514e285; content round S4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-COMPARATOR-NO-FIGURE

| Field | Content |
| --- | --- |
| Statement | A comparator with no figure for the measure (or none in the latest year) is not listed and never ranked last. Not applied while loading. |
| Why | 'No data' placed last would let a school with nothing published appear to beat a genuinely low one, or look like a bottom score. |
| Applies to | Comparisons |
| Enforced in | - src/components/teacher/ComparisonsPanels.tsx:254, 274-277<br>- src/lib/teacher-view-panels.ts:rankByValue (325-333) |
| Tagged at | - src/lib/teacher-view-comparisons.ts<br>- src/lib/teacher-view-panels.ts |
| Test case | Acland Burghley School (100053), ks5: A school not offering the focus subject disappears from the set's bar chart and ranking (content round S4). [manual] |
| Origin | Content round S4; round 7 §9 |
| Status | active |
| Must lift | src/components/teacher/ComparisonsPanels.tsx:254, 274-277 → src/lib/teacher-view-comparisons.ts:comparisonSchools, rankedComparisons (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-COMPARATOR-RATE-PER-QUAL

| Field | Content |
| --- | --- |
| Statement | Comparator rates are scored per subject and exact qualification, with the page's own rate function. |
| Why | Pooling a comparator's qualifications mixes grade scales (Maths (General) moved +5pp when fixed). |
| Applies to | Comparisons on Grade 4+ / A*-E / bands; since 0.6.2 S3 also a subject column's 'Add an average' across schools on them |
| Enforced in | - src/components/teacher/ComparisonsPanels.tsx:199-207<br>- src/app/teacher/[phase]/page.tsx:2043-2053<br>- src/components/dashboard-config/TeacherDashboard.tsx:setGradeRowsFor, schoolSetGradesOn |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/teacher-view-comparator-grades.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series.test.ts |
| Test case | — |
| Origin | Comparisons / Grade 4 wiring |
| Status | active |
| Must lift | src/components/teacher/ComparisonsPanels.tsx:199-207; src/app/teacher/[phase]/page.tsx:2043-2053 → src/lib/teacher-view-comparator-grades.ts:rateSeriesByUrn (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-COMPARATOR-GRADE-SHARE

| Field | Content |
| --- | --- |
| Statement | Grade counts across schools (Column 1's grade spread, 'Add an average' across the 10 nearest / a saved set) is each grade's share of a school's graded entries, averaged (mean or median) over the set's other schools with graded entries that year, for the focused subject and exact qualification; drawn as ticks in place of England's, at the school's own scale in counts mode. Never a raw count, never weighted by entries. |
| Why | Schools differ in size: an average of raw counts would draw a big school's spread, not the set's. |
| Applies to | M-*-COUNTS (set) |
| Enforced in | - src/catalogue/honest.ts:compareHonest (set)<br>- src/lib/grade-spread.ts:setShares<br>- src/lib/view-series/grades.ts:compareOf, buildGrades, buildBandSpread |
| Tagged at | - src/lib/grade-spread.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series-grades.test.ts<br>- src/lib/view-series/frames.ts<br>- src/lib/view-series/grades.ts |
| Test case | — |
| Origin | 0.6.2 S3 (prompt: 'Grade counts across schools should show a share (%), not raw counts') |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-2122-GRADING-NOTE

| Field | Content |
| --- | --- |
| Statement | A grade or points view over time (Trends: line, table, ranked change, change table, slope, Grade counts' spread against an earlier year, a change map) whose years include 2021/22 carries the note GRADING_2122_NOTE after its source: in the panel's 'i', and printed as text in fullscreen and in 'Print this graph'. Never on a latest-year view (Current, Results' Trend map), on Candidates (entries), at KS2, or on a trend whose years start after 2021/22 (a 'From' year of 2022/23 or later). |
| Why | 2021/22 (summer 2022) was the first year back to exams after the pandemic: Ofqual set grading roughly midway between 2021 and 2019, so a trend starting there often shows a fall that is partly grading, not results. |
| Applies to | M-*-POINTS, M-*-THRESHOLD, M-*-BANDS, M-*-COUNTS, Comparisons' headline (Attainment 8, A level points per entry): over-time views |
| Enforced in | - src/catalogue/notes.ts:GRADING_2122_NOTE, gradingNoteEligible, gradingNoteFor, specYears<br>- src/components/teacher/ColumnPanels.tsx:withGradingNote (PanelRender.gradingYears)<br>- src/components/teacher/SubjectPanels.tsx:graded, trendHalf/changeHalf gradingYears<br>- src/components/teacher/GradeCountsPanels.tsx:trendHalf/changeHalf gradingYears<br>- src/components/teacher/ComparisonsPanels.tsx:graded, trendHalf/changeHalf gradingYears |
| Tagged at | - src/components/teacher/ColumnPanels.tsx<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/components/teacher/GradeCountsPanels.tsx<br>- src/components/teacher/SubjectPanels.tsx<br>- src/lib/grading-note.test.ts |
| Test case | The Chase (137625), ks4, History, 2021/22-2024/25: Grade bands and Average points Trends over 2021/22-2024/25 print the note in fullscreen; Current, Candidates and a Trend from 2022/23 don't (src/lib/grading-note.test.ts, on the real hosts). [runner: gradingNote2122] |
| Origin | 0.6.2 S4 (prompt: 'wherever a grade or points trend includes 2021/22, put a short footnote on the view') |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-RANKING-SAMPLE

| Field | Content |
| --- | --- |
| Statement | A national or regional ranking set is a sample: no map or change maps; rank and average come from the whole population on the ranking's own (headline) measure. |
| Why | A map of a sample of schools across England is not a local picture, and a rank within the sample is not the school's real rank. |
| Applies to | Comparisons with a ranking set |
| Enforced in | - src/components/teacher/ComparisonsPanels.tsx:213, 287-297, 494-506, 615, 713<br>- src/lib/chooser-sets.ts:46-61 |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/components/dashboard-config/runtime.ts<br>- src/lib/chooser-sets.ts<br>- src/lib/teacher-view-comparisons.ts<br>- src/lib/variants.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/frames.ts<br>- src/lib/view-series/map.ts<br>- src/lib/view-series/tiles.ts |
| Test case | — |
| Origin | Snagging round 1 Part 4 |
| Status | active |
| Must lift | src/components/teacher/ComparisonsPanels.tsx:213, 287-297, 494-506, 615, 713 → src/lib/teacher-view-comparisons.ts:comparisonsCurrentView, onRankingMeasure, sampleAllowsMap (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-PERIOD-TRIM

| Field | Content |
| --- | --- |
| Statement | Leading and trailing periods with no published value are trimmed (2020/21 points are null nationally). |
| Why | An empty first year would start every Results trend on a gap. |
| Applies to | Every over-time view |
| Enforced in | - src/lib/teacher-view-panels.ts:trimToData (269-278)<br>- src/components/teacher/CandidatesPanels.tsx:165 |
| Tagged at | - src/lib/teacher-view-panels.ts |
| Test case | Acland Burghley School (100053), ks4: Any Results trend starts 2021/22. [manual] |
| Origin | Teacher view round 7 §7 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-INDEX-HEADCOUNTS

| Field | Content |
| --- | --- |
| Statement | Only sum measures (entries) are indexed to 100; points and rates are drawn at real levels. |
| Why | An index of an average reads as a % change of an average, which misleads (catalogue §3). |
| Applies to | Indexed trend views |
| Enforced in | - src/lib/teacher-view-trend-styles.ts:shouldIndex (102-104)<br>- src/components/teacher/SeriesViews.tsx:92<br>- src/components/teacher/GeographyComparison.tsx:159 |
| Tagged at | - src/lib/teacher-view-trend-styles.ts<br>- src/lib/view-editor.test.ts |
| Test case | — |
| Origin | Trend redesign |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-RANK-TIES

| Field | Content |
| --- | --- |
| Statement | Ties share a rank; the next rank skips; a null is unranked. |
| Why | Standard competition ranking; a missing figure is not a position. |
| Applies to | Every rank |
| Enforced in | - src/lib/teacher-view-panels.ts:rankByValue (325-333) |
| Tagged at | - src/lib/teacher-view-panels.ts |
| Test case | — |
| Origin | Teacher view round 7 §9 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-TREND-FLAT-4PCT

| Field | Content |
| --- | --- |
| Statement | A trend is 'Broadly stable' within ±4%. |
| Why | Small year-to-year noise should not be called growth or decline. |
| Applies to | Trend summaries and direction flags |
| Enforced in | - src/lib/teacher-view-panels.ts:classifyChange (353-360) |
| Tagged at | - src/lib/teacher-view-panels.ts |
| Test case | — |
| Origin | Teacher view wireframe |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-NUMBER-TYPE-HONESTY

| Field | Content |
| --- | --- |
| Statement | A measure is shown only in its honest number types (catalogue §3): counts as totals, % change, share or index; averages as points and change in points; rates as rate and change in percentage points. |
| Why | A % change of an average or a rate misleads: 60% -> 66% is +6pp, not +10%. |
| Applies to | Every view on M-*-POINTS, M-*-THRESHOLD, M-*-BANDS, M-*-HEADLINE |
| Enforced in | - src/catalogue/measures.ts (numberTypes)<br>- src/catalogue/matching.ts (offer filter, via dataview supports.numberType)<br>- src/lib/teacher-view-panels.ts:ChangeKind, Measure.changeKind, changeOf, formatChange, changeMagnitude, changeTitle, changeInTitle, trendSentence<br>- src/components/teacher/SeriesViews.tsx:YearTable (Change column, ranked by the honest change)<br>- src/components/teacher/ChangeChart.tsx (format, axis units)<br>- src/components/teacher/SubjectPanels.tsx:change half (ChangeList, titles, summary, headline)<br>- src/components/teacher/ComparisonsPanels.tsx:change half (ChangeList, change map trend vs trend_absolute, titles, summary, headline) |
| Tagged at | - src/components/teacher/ChangeChart.tsx<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/components/teacher/SeriesViews.tsx<br>- src/components/teacher/SubjectPanels.tsx<br>- src/lib/teacher-view-panels.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/map.ts<br>- src/lib/view-series/ranking.ts |
| Test case | — |
| Origin | Catalogue doc §3; decision C3 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | - S3b (Guy's decision 3, 3 Oct 2026): % change is no longer offered on points or rates in the Teacher view. Measure.changeKind ('percent' for entries and grade counts, 'points' for average point score and the GCSE/Post-16 headline, 'pp' for Grade 4+ / A*-E, grade bands and KS2's expected standard) drives every change view through changeOf / formatChange: Context's and Comparisons' ranked change lists and change tables (YearTable ranks and sorts by the honest change and drops the % beneath on points and rates; the Results geography table shows the change in points alone), the classic ChangeChart, Comparisons' change map (points and rates colour by absolute change, trend_absolute, keyed 'Change', instead of the ±% scale), every title ('Change in points' / 'Change in percentage points', changeInTitle), the summaries ('risen 0.4 points', 'fallen 3 percentage points'), the collapsed headline figure and trendSentence's tail. Counts keep % change. Direction words (Growing / Broadly stable / Declining) still use R-TREND-FLAT-4PCT's ±4% relative band: only the number printed changed. Not changed: the Data View's own map 'Trends' toggle (AcademicMapView, growth %) that Column 1 Results' Trend map shows, which is shared with the Data View. |

### R-ROLLS-HEADCOUNT

| Field | Content |
| --- | --- |
| Statement | Rolls are census headcounts, not FTE; part-time pupils count as one. |
| Why | Mixing headcount and FTE across schools or years changes a roll without any pupil moving. |
| Applies to | M-ROLLS |
| Enforced in | - src/lib/roll-data.ts:1-3, 33 |
| Tagged at | — |
| Test case | — |
| Origin | Rolls build (Data View) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ROLLS-MAINSTREAM-AGG

| Field | Content |
| --- | --- |
| Statement | LA, region and England roll aggregates count mainstream schools only. |
| Why | A school's share of an area should be of the comparable (mainstream) roll. |
| Applies to | M-ROLLS (area geographies) |
| Enforced in | - src/components/dashboard/RollCard.tsx:86 (note)<br>- supabase/migrations/20260807112000_roll_aggregates.sql |
| Tagged at | — |
| Test case | — |
| Origin | Rolls aggregates build |
| Status | active |
| Must lift | — |
| Open issue | roll_aggregates scope 'regional' means LA (a naming trap), and LA rolls exist for 2025 only, so there is no LA roll trend table (audit B). |
| Fixed | — |

### R-BIRTHS-FULL-WINDOW

| Field | Content |
| --- | --- |
| Statement | The births trend is shown only when all five years (2021-2025) exist for the area; otherwise nothing. |
| Why | A partial births window would draw a trend from a gap. |
| Applies to | M-BIRTHS |
| Enforced in | - src/lib/population-trend-lookup.ts:BIRTHS_EARLIEST_YEAR, BIRTHS_LATEST_YEAR (89-90), lookupBirthsTrend (117) |
| Tagged at | — |
| Test case | — |
| Origin | Population trend section (public school page) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-BIRTHS-SHIRE-SUM

| Field | Content |
| --- | --- |
| Statement | A shire county's births are the sum of its districts' births. |
| Why | ONS publishes births at district level (E07) for two-tier areas; the county the school's LA is has no row of its own. |
| Applies to | M-BIRTHS (LA) |
| Enforced in | - src/lib/population-trend-lookup.ts:SHIRE_COUNTY_DISTRICT_GSS_CODES (99) |
| Tagged at | — |
| Test case | — |
| Origin | Population trend section (public school page) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |
