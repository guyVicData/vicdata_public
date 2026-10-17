<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->

# Rules

What a number is allowed to be. 145 rules: 141 active, 4 superseded; 22 must lift (enforced only in UI code before 0.6).

## Summary

| ID | Status | Statement | Must lift | Test | Open issue |
| --- | --- | --- | --- | --- | --- |
| R-ENTRIES-NOT-POINTS | active | Entries count every qualification; points come only from qualifications with a real challenge table, and a row with no points of its own shows none rather than borrowing another's. | lifted | manual | — |
| R-POINTS-SAME-QUAL | active | A points figure is only comparable within one qualification type (KS4: qualification type; KS5: the exact qualification). Post-16 Context on points keeps to the focused item's qualification family on every group, All subjects included; a figure that could only be a blend is not shown. Since 0.6.5 (S3), Post-16 Comparisons and the maps (Column 3 Current and Trends, Column 1's Trend map) read every school's figure for the focus's EXACT qualification -- A level, AS level, each BTEC size, IB Higher or Standard level -- never the bucket's blend, so Column 1, Comparisons and the maps show one figure for the school and one rank; where no other school in the set has the qualification (or publishes its points), Comparisons says so. | lifted | auto: pointsSameQual | — |
| R-KS4-POINTS-GCSE-FULL | active | KS4 points come only from GCSE (9-1) Full Course entries with a clean single grade, and from a GCSE Double Award scored from its own grades as two entries, each the average of its two grades (R-DOUBLE-AWARD-POINTS; Column 1 too since 0.8 audit fixes, 2). | lifted | manual | — |
| R-KS5-ASAEA-EXCL | active | AS level and AEA are left out of comparison lists, group totals and averages at Post-16, never out of the focused item's own figure -- and a focused AS/AEA item counts itself into its own group. | lifted | auto: asAeaGroupTotal | — |
| R-KS5-ENGLAND-EXACT | active | The Post-16 England figure is the exact subject × qualification figure or nothing; there is no bucket fallback. | no | auto: englandExact | — |
| R-MIN-SCHOOLS | active | An LA or region benchmark row is suppressed below 5 schools. England is exempt (minimum 1) for points and entries geography and the England anchor, but not for grade-grain geography, where every grade row needs 5 schools. | no | auto: minSchools | — |
| R-SINGLE-BUCKET-100 | active | The unfiltered (Type = All) category view shows points only when the category's scoreable entries are 100% one scored bucket, and the comparator side agrees on the bucket. No tolerance band. | yes, not yet lifted | none yet | — |
| R-IB-NONSUBJECT | active | Baccalaureate (Diploma total, Combined Certificate) and IB Core rows are excluded from subject entries; IB Core components are included in IB bucket points; the Diploma total is never scored. | no | auto: ibNonSubject | — |
| R-FOCUS-NEVER-FILTERED | active | The focused item (a subject, or the school itself in Comparisons) is never filtered out of its own figures, only out of comparison lists. | lifted | manual | — |
| R-TREND-3YR | superseded by R-TREND-LINE-4YR | Trend views need 3+ years; below that, show the table only. | no | none yet | — |
| R-ZERO-CANDIDATE | active | A school with a stage row but no real candidate count and no real headline measure is not 'present' for that stage; special schools are matched only with special schools (and vice versa) in nearest and comparator pools. | no | manual | yes |
| R-POINTS-WEIGHTED | active | A subject's points across several qualifications in one family are weighted by points-eligible entries, not flat-averaged. | lifted | auto: pointsWeighted | — |
| R-TREND-LINE-4YR | active | A trend is drawn as a line only with 4 or more real years; below that: per-year bars (TrendChart), a ranked change-in-units list (MultiTrend), or the table alone (Comparisons Trend); the Actual and Trend-line toggles disable. | no | auto: trendLine | — |
| R-MEETINGS-TREND-4YR | active | A meeting's trend follows R-TREND-LINE-4YR, as every other view does: a line only with 4 or more real years. The live slide picker (the S4 chooser) offers each view's 'Over time' form and the slide draws it through the host's own panels, so a 3-year series draws as per-year bars, never a line. (The round-5 axis catalogue and its 'N-year trend' gate, which no page called, were deleted in the year rules leftovers.) | no | auto: meetingsTrend4yr | — |
| R-DONUT-COUNTS-ONLY | active | Share (donut) only for counts (entries), and for grade bands once a range is picked; never for averages or rates. | lifted | manual | — |
| R-NO-GRADE-RATE-GEO | active | No LA, region or England benchmark for the Grade 4+ / A*-E rate; the geography comparison is points-only on Results (entries on Candidates). | lifted | manual | yes |
| R-BANDS-ENGLAND-BENCH | active | On Grade bands the focused subject's benchmark is England's rate on the same span, from grade geography; peers carry none. | lifted | auto: bandsEnglandBench | — |
| R-GRADE-SCALE-MATCH | active | A rate is computed only on the scale it was defined on (threshold: GCSE 9-1 / Double Award at KS4, A-level A*-E at KS5; bands: the scale the range was picked on). Vocational, IB and Pre-U rows get no figure. | no | manual | — |
| R-POST16-BAND-DEFAULT | active | Grade bands opens on a default range on every Post-16 scale, as GCSE opens on 7-9: A level and EPQ A* to A; AS and Core Maths A to B; IB subject 7 to 6; vocational single Distinction* to Distinction, double D*D* to DD, triple D*D*D* to DDD; T Level Distinction* to Merit. The scale is the focus's own (scaleForQualification). A saved range wins while both its ends are on the focus's scale; otherwise the scale's default (never a stale or blank range). The Post-16 defaults are Post-16 only; Pre-U and the KS4 vocational scales stay custom-range only. The Grades menu offers the default plus Custom. | no | auto: post16BandDefault | — |
| R-POST16-DEFAULT-SET | active | On the Post-16 page the default comparison set is the 10 nearest schools and colleges with Post-16 provision, named '10 nearest with a sixth form or 16+ provision' in the chooser (the column's pill keeps '10 nearest schools', so Column 3's content and the grid's widths don't change): GCSE's matching rules (the same distance order, sector, phase and gender rules and the same widen-the-net backfill) plus one filter -- KS5 results in either of the latest two published years. An FE college's default (the nearest FE colleges) and a boarding recipe (its schools with KS5 results) follow the same rule. GCSE keeps its own nearest 10; saved sets are never altered; the Data View's default-lists, expand-nearest and boarding-quintile-list calls are unchanged (only the Teacher chooser on its Post-16 page asks with post16=1). | no | auto: post16DefaultSet | — |
| R-NON-GRADES-EXCL | active | Suppressed, No result, X, Covid impacted and other non-grades (2021/22-2022/23 KS5 too: COVID result, Supp) are excluded from both sides of every grade rate and distribution. | no | none yet | — |
| R-THRESHOLD-PERIODS | active | Grade-based measures cover 2021/22 on at school level (0.6.2; 2023/24 on before); the axis is shortened to the years a subject has grades, never padded. | lifted | auto: thresholdPeriods | — |
| R-HISTORIC-GRADE-LABELS | active | 2021/22-2022/23 KS5 grade labels are read in their 2023/24 words: vocational short codes (* D M P HM HP, ** *D DD DM MM MP PP, *** **D *DD DDD DDM DMM MMM MMP MPP PPP) become Distinction* ... Pass-Pass-Pass on BTEC, OCR Cambridge Technical, Other General Qualification and AEA, and on a VRQ set only where it carries a code no A-level-type scale has; never on A level, AS, EPQ, Core Maths, FSMQ, IB or Pre-U. COVID result and Supp are non-grades (R-NON-GRADES-EXCL). KS4's historic labels already match. | no | auto: historicGradeLabels | — |
| R-QUAL-FAMILY-MATCH | active | Column 1's category and Context's Selected set contain only the focus's qualification family (KS5 display bucket). 'All subjects' crosses families, except on Post-16 points, where it keeps to the focus's family too (R-POINTS-SAME-QUAL). | lifted | manual | — |
| R-KS4-SUBJECT-DEDUP | active | At GCSE, one category row per subject (headline rows are per subject); at Post-16, none. | lifted | none yet | — |
| R-SELF-INCLUSIVE-GROUP | active | Group totals and averages include the focused subject. | lifted | manual | — |
| R-SAME-YEAR-BENCH | active | A benchmark is read for the same year as the figure, or not at all. | lifted | none yet | — |
| R-PREV-YEAR-FALLBACK | active | With no benchmark, the delta is against the subject's own previous published year ('vs last year'). | lifted | manual | — |
| R-MEASURE-FALLBACK | active | Context falls back to points when Results is on Grade bands without a range (or on Grade counts with no focused subject); Comparisons falls back to points (with a subject chip) or the headline (without). Since 0.6.3, Grade counts with a focused subject never falls back: it follows the selected grade, or prompts for one (R-COUNTS-SELECTION). | lifted | manual | — |
| R-COUNTS-SELECTION | active | On Grade counts, a click on a grade in Column 1's Current selects it; a click on a second grade widens to the range between them; a third click starts a new selection; Clear, or a click on the single selected grade, removes it. The selection IS the band:range setting (the top bar's Grades ▾, same key and format). Context and Comparisons follow it as that range's share of graded entries (bandRate, comparator grade rows), titled 'Share at grade 9, by subject / by school (set)' with a 'Grade 9 · from your highlight' chip back to Column 1. Before any selection both columns show a prompt, not average points. | no | auto: countsSelection | — |
| R-RANGE-ENDS-GRADED | active | U, Fail and Unclassified (and non-grades, '*' and grades off the subject's scale) can't start or end a range: clicking them in Grade counts does nothing, and their tooltip says why. Both phases. | no | none yet | — |
| R-ENGLAND-GRADED-ONLY | active | England's share inside a grade selection is over graded, non-suppressed rows only. Where England suppresses a grade, or doesn't publish one the school's spread draws, the figure is partial and is not shown. | no | none yet | — |
| R-MIN-ENTRIES | active | A selection's share at one subject (Context) or one school (Comparisons) needs at least MINIMUM_SUBJECT_N (5) graded entries, the Data View's small-entries rule; below it the subject or school reads 'too few entries', not a %. | no | none yet | — |
| R-MAP-ENCODING | active | Teacher view maps: dot size = entries (the subject's, with a subject in focus). Candidates Current has no colour (one neutral fill, hover entries only). Results Current is coloured by the selected measure, by rank within the set (pale blue -> deep purple, deepest = top), and the panel's 'rank N of M' is on the same figure. Every Trends map is coloured by the change in the selected measure over the panel's own span (statements from 2022/23), diverging around zero on one symmetric scale (dark red -> pale amber -> deep green). The hover gives the coloured figure first, then entries. No figure, or below the small-entries rule: a hollow grey dot saying which. The school itself: a thick white ring (dark grey on the light theme). A labelled key on every map, card included. | no | none yet | — |
| R-ALEVEL-STAR | active | At Post-16 a grade stored as '*' on an A-level-type qualification (2021/22-2023/24) is A*, in every score, share and range, for the school, its comparators and England. | no | auto: aLevelStar | — |
| R-SCALE-FROM-QUAL | active | The focused subject's grade scale comes from its qualification type first (a T Level is on the T Level scale), its grades only after; a comparator or area row is scored on that scale when the scale is among the best fits for its grades (a T Level / vocational tie no longer reads as no figure). | no | auto: ibSevenAndSixSeven | — |
| R-HISTORIC-GRADE-LABELS-AREA | active | England's, a region's and an LA's KS5 grade rows take the same historic label mapping as the school's own (R-HISTORIC-GRADE-LABELS), then '*' as A*. | no | auto: btecDistinctionStar | — |
| R-GEO-APPLIES | active | The geography comparison is shown only where the area figure counts the same thing: at KS4 for GCSE (9-1) Full Course items only; on Results for points only. | lifted | manual | — |
| R-GEO-POINTS-ELIGIBLE | active | The school's own row beside area entries is its points-eligible entries (entries × coverage), not its Candidates count. | lifted | none yet | — |
| R-IGCSE-EXCL | active | At GCSE a comparator flagged by igcseExclusionLikely is dropped from every set; the target is kept but flagged and its results history withheld. | no | manual | — |
| R-IGCSE-EVERYWHERE | active | One IGCSE rule in every product: a school igcseExclusionLikely flags (loaded for many schools only by lib/igcse) is left out of every ranking population on a WHOLE-SCHOOL GCSE measure (Attainment 8, English and maths 4+/5+/7+, EBacc, Progress 8, average points across all GCSEs) -- national, regional, LA, set, '10 nearest', Teacher's headline ranking, Admissions' places and SMT's ranks -- and out of a subject group's (family's) ranking across schools only where that group is incomplete at it (it took one of the group's subjects as IGCSE; igcseFamilyIncomplete). Single subjects are R-IGCSE-SUBJECT's: ranked like any other school. It is never silently dropped from a list: where a list would have shown it, a line says '{n} schools not ranked at GCSE (mostly IGCSE)'. The school itself shows 'not ranked at GCSE (IGCSE)', with no rank, 'out of' or gap. '10 nearest' at GCSE fills to 10 with the next nearest eligible schools and says how far it reached. | no | auto: igcseEverywhere | — |
| R-IGCSE-GROUP-LABEL | active | Teacher's Column 1 keeps an IGCSE school's own GCSE subject figures (its rank among its own subjects, its gap to England): only ranks against other schools follow R-IGCSE-EVERYWHERE and R-IGCSE-SUBJECT. Where the focused subject's category at the school lacks the subjects it takes as IGCSE (English and maths, the subjects the IGCSE rule rests on), the category is named in a short form everywhere it appears for that school (tiles, tables, chips, Context, 'Add an average', SMT's area chips): 'Sciences & Maths · no maths (IGCSE)' (or '· no Mathematics (IGCSE)' when Statistics or Additional Maths is held), 'Languages & Literature · no English (IGCSE)' or '· no English Language (IGCSE)', judged on the subjects with entries in the school's latest GCSE year. The full sentence -- 'Sciences & Maths (sciences only: maths taken as IGCSE)' -- is in the view's (i). The rank tile stays within two lines. Every other school, every other category, and England's lines keep the plain name. | no | auto: igcseGroupLabel | — |
| R-IGCSE-SUBJECT | active | An IGCSE school (igcseExclusionLikely) is ranked like any other school in a single GCSE subject it entered as GCSE 9-1 -- Teacher's subject rankings, Comparisons, maps, sets and '10 nearest', SMT's subject rows, Admissions' subject places -- since DfE's subject figures are GCSE entries only. '10 nearest' for a subject is the 10 nearest by the same rules with IGCSE schools in; population counts say what's included ('of 3,443 schools with GCSE Biology results'). What a school took as IGCSE is inferred in one function (igcseTakenAsIgcse): English Language and maths, which every school teaches, where an IGCSE school has no GCSE entries in one that year; never any other subject (a subject it simply doesn't offer isn't 'taken as IGCSE'). A subject group is incomplete where it lacks one of those, or a subject the group requires (no group has required subjects). | no | auto: igcseSubject | — |
| R-COMPARATOR-NO-FIGURE | active | A comparator with no figure for the measure (or none in the latest year) is not listed and never ranked last. Not applied while loading. | lifted | manual | — |
| R-COMPARATOR-RATE-PER-QUAL | active | Comparator rates are scored per subject and exact qualification, with the page's own rate function. | lifted | none yet | — |
| R-COMPARATOR-GRADE-SHARE | active | Grade counts across schools (Column 1's grade spread, 'Add an average' across the 10 nearest / a saved set) is each grade's share of a school's graded entries, averaged (mean or median) over the set's other schools with graded entries that year, for the focused subject and exact qualification; drawn as ticks in place of England's, at the school's own scale in counts mode. Never a raw count, never weighted by entries. | no | none yet | — |
| R-2122-GRADING-NOTE | superseded by R-TREND-FROM-2223 | A grade or points view over time whose years include 2021/22 carried a note that 2021/22 was graded more generously, so some fall from it reflects grading. Superseded by R-TREND-FROM-2223 (Guy, 6 Oct 2026): trends are now measured from 2022/23, and the note says so. | no | none yet | — |
| R-TREND-FROM-2223 | active | On a grade or points measure (Average points, Grade 4+ / A*-E, Grade bands, Grade counts, Comparisons' headline; never Candidates, never KS2), 2021/22 stays on the Trends' graphs and tables, but every trend statement is measured from 2022/23 (TREND_BASE_PERIOD): the direction word (R-TREND-FLAT-4PCT) and the trend sentence ('… since 2022/23'), the group / 'vs:' clause, every year table's Change column (Trend and % change tables, Results' area change table: the card's two year columns are then 2022/23 and the latest, with a '+N more years' cue since 0.6.4; years down and fullscreen show every year, R-TREND-TABLE-YEARS), a fitted Trend line, a short span's ranked change bars, ranked change lists, change and Trend maps, the % change half's summary and collapsed figure, and a slope from the span's first year. Grade counts' change table measures from 2022/23 at the earliest, its 'From' menu from there (since 0.6.4 it lists every year from 2021/22 in years down and fullscreen, the card's two columns still the change's ends); its spread may still be compared with 2021/22. Line charts (Trend, Results' area chart) draw 2021/22 as a normal point. A 'From' year of 2022/23 or later is unchanged. A view whose drawn years include 2021/22 carries TREND_BASE_NOTE after its source: in the panel's 'i', and printed as text in fullscreen and in 'Print this graph'. Never on a latest-year view, on Candidates or at KS2. Indexed lines are entries only (R-INDEX-HEADCOUNTS), so unaffected. | no | auto: trendFrom2223 | — |
| R-DV-TREND-FROM-2223 | active | The Data View follows R-TREND-FROM-2223 at GCSE and Post-16 (DATA_VIEW_TREND_BASELINE = TREND_BASE_PERIOD; KS2 from its first year, 2022/23): every 'since' figure on points or Attainment 8 is measured from 2022/23 -- Graphs' Growth / decline bars, the subject area's sentence and its 'Results, % change since 2022/23' (school, set average, one comparator), the subject deep dive's results change, the large-set chart's index (100 at 2022/23), Rankings' Trend tile, growth ranking and 'Position over time', and the Map's trend colours and popup. The graphs and the rank table still draw 2021/22, and every points trend that draws it carries TREND_BASE_NOTE beneath it. Candidates' changes are measured from the first year with data. | no | auto: dataViewTrendFrom2223 | — |
| R-TREND-TABLE-YEARS | active | A trend table shows the same years as its trend chart: 2021/22 onward on a grade measure (Grade 4+ / A*-E, Grade bands, a single grade, a Grade counts selection), at GCSE and Post-16, on Results, Context and Comparisons, card and fullscreen, both drawing paths. Years down and fullscreen show every year; a card with years across may show the change's two ends (2022/23 and the latest, R-TREND-FROM-2223) with a '+N more years' cue naming the rest, which swaps to years down. Grade counts' change table lists every graded year from 2021/22 (or the member's 'From' year) the same way, its change from 2022/23. R-CURRENT-GRADES-FROM-2324 never applies to a Trends view. | no | auto: trendTableYears | — |
| R-CURRENT-GRADES-FROM-2324 | active | A latest-year view on a grade measure (Grade 4+ / A*-E, Grade bands, Grade counts; Results, Context and Comparisons' rate) reads the school's grade rows from 2023/24 on only: its subject (or school) list, its year menu, its 'vs last year' and an explicit earlier-year spread are exactly as before the rows reached back to 2021/22. A subject with grades only in 2021/22-2022/23 appears on the Trends alone. Never a Trends view, chart or table (R-TREND-TABLE-YEARS). | no | auto: currentGradesFrom2324 | — |
| R-RANKING-SAMPLE | active | A national or regional ranking set is a sample: no map or change maps; rank and average come from the whole population on the ranking's own (headline) measure -- or, with a subject in focus (0.6.6), on the measure in view (R-RANKING-MEASURE). | lifted | none yet | — |
| R-RANKING-MEASURE | active | With a subject in focus, a national or regional ranking ranks EVERY school in the filtered population on the measure in view: the focused subject (the exact qualification at Post-16; at GCSE a rate is the focus's qualification), on entries, average points, Grade 4+ / A*–E, a band or a Grade counts selection, in the panel's year (a rate's latest from 2023/24). A school needs 5 entries (graded entries on a rate) to be ranked (R-MIN-ENTRIES; entries rank from 1); ties share a rank (R-RANK-TIES); a school its own filters exclude is placed against the population and says so. The table draws a window at real ranks -- the card the top 3 and 5 either side (one block when the school is in the top 8), full screen the top 10, 10 either side and the bottom 3; the change list is the whole population's in the same window: points and rates from 2022/23, entries from the first year with data (R-RANKING-ENTRIES-CHANGE). No subject in focus: the headline ranking, unchanged. | no | auto: rankingOnMeasure | — |
| R-RANKING-ENTRIES-CHANGE | active | The subject ranking measures its change in entries from the first year with data (the earliest year any school in the ranking has a figure), in %; never from 2022/23. Points and rates keep 2022/23 (R-TREND-FROM-2223). The database function takes one start year, so for entries the app reads the years in its answer and asks again from the first; the app-side fallback applies the same rule (changeFrom). | no | auto: rankingEntriesChange | — |
| R-ENTRIES-FIRST-YEAR | active | Every view that draws or measures entries (Candidates) starts at the first year with entries in the data, per phase and measure, read through one helper (years.ts entriesFirstPeriod / changeStartFor): 2020/21 for GCSE subjects, the teacher-assessed year (entry totals, no grades). Teacher's Candidates panels, the subject ranking's entries change, the Data View's 'Candidates, % change' (category and subject mode, and the set's average) and the SMT entries mix all start there. Grades and points keep R-TREND-FROM-2223 (change from 2022/23, drawn from 2021/22 with the note). Area comparisons (LA, region, England) start where the area entry totals do (2021/22). | no | auto: entriesFirstYear | — |
| R-ROLL-WORDS-3YR | active | Every roll or headcount direction word ('Growing', 'Shrinking', 'Steady') and every arrow or colour that words one compares the latest census year with 3 years earlier (years.ts ROLL_DIRECTION_SPAN, rollDirection); a school with fewer than 4 census years uses the longest span it has, and the (i) says so. Steady is R-FLAT-BAND: the change rounds to 0%. The (i) states the rule: 'Growing or shrinking compares this year's roll with three years ago.' The 'since' figures don't change (from the first census year), and an arrow on one follows its own figure. | no | auto: rollWords3yr | — |
| R-SET-CHANGE-AVERAGE | active | A comparison set's '% change' is the change in the set's yearly average (each year, the average over the schools with a figure that year), from its start year to its latest: entries from the first year with entries (changeStartFor), points from the baseline year. One helper, src/lib/set-change.ts setAverageChange, in both modes of the Data View's subject area section, and for the KS2 domains' set. | no | auto: setChangeAverage | — |
| R-MINUS-SIGN | active | No figure prints a hyphen-minus as its sign: every negative change or value prints '−' (U+2212), through src/lib/signed-delta.ts (signedDelta, signedValue). The Data View and the SMT, Admissions and group tooltips that printed '-3%' print '−3%'. | no | auto: minusSign | — |
| R-FLAT-BAND | active | An arrowed change whose size rounds to 0 at the precision shown (under 0.5% for whole percents, under 0.05 for one decimal place) is steady: no ▲ or ▼, a '–', the zero in that view's own style, and a neutral colour. One helper beside signedDelta (flatBand, arrowed, ARROW); a view may keep a wider steady band of its own, never a narrower one. Roll direction words follow the same band. | no | auto: flatBand | — |
| R-NO-NEGATIVE-ZERO | active | A change that rounds to zero prints as an exact zero prints in that view, never '−0' or '-0' ('0%', '+0%' or '±0.0', each view's own). Every signed figure goes through the one formatter, src/lib/signed-delta.ts signedDelta, in its view's style (Teacher's '+0'; an unsigned zero where a view has always printed one; the minus is always '−': R-MINUS-SIGN). | no | auto: noNegativeZero | — |
| R-ADM-LADDER | active | An entry point's pool for a future September is traced back through the schools holding those children now: counted from the census (full-time pupils from age 4; full- plus part-time at nursery ages) at the rung age E - (Y - P), births below age 4, ONS age-10 projections for 11+ only and off by default. Past pools (2020 to next September) are the age E-1 rung in the census a year before. Horizons: 10 years for 11+ and 16+; Reception to its last birth year (two more only with projections we don't hold). | no | auto: admLadder | — |
| R-ADM-BIRTH-SPLIT | active | A school year runs September to August, so a pool from calendar-year births is 8/12 of year X plus 4/12 of year X-1 (X = entry year - entry age), in the LA blend; births have no sex split, so a girls' or boys' pool from births is 49% / 51% of it, labelled an estimate. | no | auto: admBirthSplit | — |
| R-ADM-DRIFT-RANGE | active | Beyond the counted rung a pool is a range, never a single point: the set's observed year-on-year cohort ratios 2019/20-2025/26 (schools with a census in both years only; within one kind of school; handovers between kinds measured on their own), their 10th-90th percentile applied for each year still to go, so the range widens with distance. | no | auto: admDriftRange | — |
| R-ADM-HOLD-SHARE | active | The share needed to hold numbers steady is the school's entry-age cohort now divided by each future pool (its range from the pool's range); the current share is the latest year's. Worded as a requirement, not a forecast. | no | auto: admHoldShare | — |
| R-ADM-GROUP-SHARE | active | Market share is the school's pupils at the entry age (or across its age band) as a share of the same ages across the rivals plus the school, per census year 2019/20-2025/26, with ranks within the set (ties share a rank). A share of this group, not of the local market. | no | auto: admGroupShare | — |
| R-ADM-JOINERS-ESTIMATE | active | Following a cohort across census years per school: joiners at age a = max(0, cohort(a, t) - cohort(a-1, t-1)) and the leaving share at 16 = (cohort(15, t-1) - cohort(16, t)) / cohort(15, t-1), with at least 10 at 15. Both are estimates of NET movement and say so. The derived table school_cohort_flow (ingest) holds the same figures. | no | auto: admJoiners | — |
| R-ADM-SHAPE-NOT-RANKED | active | Size uses the school page's XS-XL badges by phase band (sizeBadgeForValue), never new words; shape is the shared classifier on the page's age-gender counts, and a set's local shape is the classifier on its summed profile. Shapes are described, never ranked. | no | auto: admShape | — |
| R-ADM-POOL-NOT-INTAKE | active | Every admissions figure about the future is a pool (children who will reach the entry point), never an intake: no field, label or sentence claims who will come. The wording lives in ADMISSIONS_NOTES. | no | auto: admPoolNotIntake | — |
| R-ADM-RIVAL-RANKS | active | Each rival (and the school) carries its national rank and its rank in its own region, on the whole-school headline for the entry point's stage (4+ KS2, 11+ GCSE Attainment 8, 16+ A-level points per entry), on each subject area (family average points, at least 10 entries), on a subject in view (0.6.6 subjectRanking) and on size (roll in the entry point's age band, with the school page's XS-XL badge). Every school with a figure that year, ties share. A school with no published results for the stage says so; at 11+ an IGCSE-heavy independent school is listed but not ranked. | no | auto: admRivalRanks | — |
| R-ADM-FLAG-MOMENTUM | active | Rivals' momentum flags, each from a two-year change (pupils in %, results in points) against the NATIONAL thresholds for the phase (top / bottom fifth; admissions_flag_thresholds), never from one small cohort, with the figures behind it: results rising fast (headline), gaining pupils (roll), losing pupils three years running (three falls in a row), the entry year shrinking (Year 7 at 11+), a new sixth form (no pupils at 16 until two years ago), shape changed (the same new shape two years running). Until the thresholds are applied the threshold flags don't fire (none guessed). | no | auto: admMomentum | — |
| R-ADM-FLAG-STRENGTHS | active | By subject area, the school's rank among the rivals that have that area (at least 10 entries), the gap to their average and its change since 2022/23: Strength (top third, above the average), Strength growing (and the school's own two-year change in the national top fifth), Weakness (bottom third, below), Weakness widening (and in the national bottom fifth). Never against fewer than two rivals. | no | auto: admStrengths | — |
| R-ADM-SEX-FILTER | active | Every Admissions panel either applies the girls/boys filter fully -- every pupil figure it draws is girls' or boys' -- or, while the filter is on, says 'Not split by sex'. Never part of a panel: Pool trends hides its LA and England lines (never split) and says so; momentum and flags, which set pupils against results, stay whole and say so. ADM_SEX_FILTER lists every view. | no | auto: admSexFilter | — |
| R-ADM-FLAG-FEEDER | active | A feeder whose pupils at one age -- the age below entry (Year 6 at 11+; Reception's schools at 4+) -- fell more than the area's (the whole feeder set, at that age) by at least 5 points over two years is a red flag; rising or stable numbers (no worse than -2%) mark a school to focus on. Never from a cohort under the minimum. (Guy's call, 0.8 audit fixes 8, A6: one age; the feeder table, the map and the pipeline chart's flags all read that age, on the set without the school.) | no | auto: admFeeders | — |
| R-PERIOD-TRIM | active | Leading and trailing periods with no published value are trimmed (2020/21 points are null nationally). | no | manual | — |
| R-INDEX-HEADCOUNTS | active | Only sum measures (entries) are indexed to 100; points and rates are drawn at real levels. | no | none yet | — |
| R-YEARS-ROLLOVER | active | A rule whose expected value moves with the latest results year reads that year from src/catalogue/years.ts (filled from academic_current_periods) and its value from scripts/rule-year-fixtures.ts, one row per year; or asserts a relationship with the year instead. When a new year arrives with no row, the rule fails saying 'no expected value for 2026/27', never with a wrong number; a release adds a row. | no | auto: yearsRollover | — |
| R-RANK-TIES | active | Ties share a rank; the next rank skips; a null is unranked. A ranking's place reads '=3rd' where the school shares it (headline and subject rankings, and the whole-school tile). | no | auto: rankTies | — |
| R-TREND-FLAT-4PCT | active | A trend is 'Broadly stable' within ±4%. | no | none yet | — |
| R-NUMBER-TYPE-HONESTY | active | A measure is shown only in its honest number types (catalogue §3): counts as totals, % change, share or index; averages as points and change in points; rates as rate and change in percentage points. | no | none yet | — |
| R-ROLLS-HEADCOUNT | active | Rolls are census headcounts, not FTE; part-time pupils count as one. | no | none yet | — |
| R-ROLLS-MAINSTREAM-AGG | active | LA, region and England roll aggregates count mainstream schools only. | no | none yet | yes |
| R-BIRTHS-FULL-WINDOW | active | The births trend is shown only when all five years (2021-2025) exist for the area; otherwise nothing. | no | none yet | — |
| R-BIRTHS-SHIRE-SUM | active | A shire county's births are the sum of its districts' births. | no | none yet | — |
| R-ADM-FAMILY-PUPILS | active | Pupils by age is the census count at one age (full-time from 4, plus part-time at 2-3), per school and census year, and the entry point now reads the school's own count at the entry age, split by sex, against 2019/20. | no | auto: admFamilyPupils | — |
| R-ADM-FAMILY-PIPELINE | active | The Pipeline family is round 1's pipeline unchanged: with no filter, the screens' answer carries exactly buildPipeline's ladder, share needed, sets and blend; the screens only add what they draw. | no | auto: admFamilyPipeline | — |
| R-ADM-FAMILY-MARKET | active | The Market share family is round 1's group share unchanged: with no filter the screens' answer carries buildMarketShare's rows and totals; the extras (whole roll and its rank, change since 2022/23) are the census's own figures. | no | auto: admFamilyMarket | — |
| R-ADM-FAMILY-RIVALS | active | Rivals' results is round 1's rivals unchanged, plus each school's whole-school headline change since 2022/23 in points, from the same headline population the flags read; an IGCSE school, listed but not ranked, has none. | no | auto: admFamilyRivals | — |
| R-ADM-VIEW-NOW | active | The entry point now shows the school's own entry cohort, its change since 2019/20, girls and boys at the entry age, and day and boarding for the whole school (the census has no boarders by age; a day school's tile reads Day only, 0.7 r3 F2); size is the school page's Roll by phase (XS-XL), never new words. | no | auto: admViewNow | — |
| R-ADM-VIEW-PIPELINE | active | The pipeline chart draws past pools, then counted years solid, births dashed with their range band, and projection only on request (11+), with every label from ADMISSIONS_NOTES. The styling and wording have no look option. | no | auto: admViewPipeline | — |
| R-ADM-VIEW-FUNNEL | active | The funnel follows this September's entrants back, like with like: the area's births for their school year (8/12 + 4/12), every pupil a year below the entry age in every mainstream school in the SAME area a year before (age_profile_aggregates), then the school's own entry cohort. Each bar leads with a bold label, then its area and year in plain words (ADMISSIONS_NOTES); the panel's note says it is not a flow of the same children. No funnel at 4+ (0.7 r3, F7). | no | auto: admViewFunnel | — |
| R-ADM-VIEW-FEEDERS | active | The feeder table and map list the nearest rung's schools with their pupils at that age now and two years ago, each flagged by R-ADM-FLAG-FEEDER against the whole set, with distance, sector, gender and XS-XL; the school itself is not a feeder. | no | auto: admViewFeeders | — |
| R-ADM-VIEW-SHAPES | active | Shape and size shows the school's profile by gender, the feeders' local shape and the rivals' shapes as small multiples in the rival set's own order, with no rank, score or sort by shape. | no | auto: admViewShapes | — |
| R-ADM-VIEW-TRENDS | active | Pool trends index the feeders' past pools and the same age across the LA and England (age_profile_aggregates: LA rows, England the sum of the nine regions) to their first common year; a year the aggregates don't hold is a gap, never filled. | no | auto: admViewTrends | — |
| R-ADM-VIEW-MARKET | active | Market views are shares of this group: each school's pupils at the entry age over the group's total, summing to 100% in a year; ranks within the set; the whole-school rank is by total roll. | no | auto: admViewMarket | — |
| R-ADM-VIEW-MOMENTUM | active | The momentum scatter plots each rival's change at the entry age (census, %, over 3 census years: R-ROLL-WORDS-3YR) against its whole-school headline change (points, since 2022/23); flags come only from the national thresholds, and with none loaded the view says flags are not available yet. | no | auto: admViewMomentum | — |
| R-ADM-VIEW-STRENGTHS | active | Strengths and weaknesses rank the school only among rivals with that subject area (and at least the minimum entries), show the gap to their average and its move since 2022/23, and flag Strength / Weakness by the top or bottom third (R-ADM-FLAG-STRENGTHS). | no | auto: admViewStrengths | — |
| R-ADM-VIEW-FLAGS | active | A flag list shows each rival's momentum flags with the figures behind each one on hover, never a flag without its figures. | no | auto: admViewFlags | — |
| R-ADM-VIEW-ACADEMIC | active | The academic panel follows the entry point: 4+ reads KS2, 11+ GCSE, 16+ Post-16; a rival with no published results or an IGCSE-heavy one is listed and not ranked, with the reason. | no | auto: admViewAcademic | — |
| R-ADM-FE-SOURCE | active | An FE college's own figures come from FE participation data (ILR, learners under 19 over the year), labelled as that source, and are never divided into a census group's total, ranked against schools or shown as a Year 12 count. | no | auto: admFeSource | — |
| R-ADM-FILTERS | active | The top bar's filters (Day + boarding, State + independent, boarding rivals) narrow the sets on the server before round 1's maths runs; unfiltered, every answer is round 1's. A filter that leaves a list empty says so; another list never stands in for it. Day + boarding is a boarding school's filter only: for a day school it is never drawn and the server ignores it (R-ADM-BOARDING-ONLY-WHERE-BOARDERS). | no | auto: admFilters | — |
| R-ADM-BOARDING-ONLY-WHERE-BOARDERS | active | A boarding school is one GIAS lists with boarding provision (schools.boarders_name = "Boarding school"; "No boarders" and "Not applicable" are day schools). A day school never has to think about boarders: no tile, filter, chip, column, legend, empty state, note, setup question or step, or editor compare option mentions boarding (column 1's day/boarding tile stays, reading Day only), its saved boarding lists are kept but not used, and the server ignores a boarding filter for it. Its rivals' own figures may still say they board. A boarding school sees every boarding surface: setup's day-and-boarding question and step 3, the filter, the tile's day and boarding, the boarding feeder list and its fuzzy set. | no | auto: admBoardingOnly | — |
| R-ADM-FUNNEL-SAME-AREA | active | The funnel's births and its pool bar cover the same area with the same weights: the school's own LA, or the lead's LA blend when one is set. The pool is every pupil a year below the entry age (Year 6 = age 10, Year 11 = age 15, at 31 August, the census a year before entry -- the ladder's own age mapping) in every mainstream school in that area: academies, LA-maintained, free and independent (age_profile_aggregates, scope la). The feeder set's pool is not a funnel bar; it stays in the Pipeline. | no | auto: admFunnelSameArea | — |
| R-ADM-EDITOR-LOOKS-KEEP-NOTES | active | An Admissions view's look options and compare chips change how it draws, never what it must say: under every look and compare an editor can choose (src/catalogue/admissions-editor.ts), each view still renders every R-ADM wording from ADMISSIONS_NOTES that its preset renders (a pool, not an intake; a share of this group; the estimates; the requirement; the flags' rules; the undercount), and its rule-held styling and thresholds don't move. Options left at their defaults draw exactly the preset. A day school's view never draws a boarding feeder set, whatever its spec asks. | no | auto: admEditorLooks | — |
| R-DOUBLE-AWARD-POINTS | active | A GCSE Double Award (grades published as pairs, "98" ... "11") is scored on DfE's convention: two entries, each worth the average of its two grades (98 -> 8.5, U -> 0). The subject's average points and its ranks (in a set and in England) come from its own grade rows wherever the subject rollup holds no average for it; a scale that mixes pairs with anything else is never scored. Other qualifications on their own scale (an FSMQ's A-E, a BTEC's Distinction-Pass) get no GCSE points and say "different grading scale, not ranked". | no | auto: doubleAwardPoints | — |
| R-SMT-PUPILS-LEVEL | active | Pupils follows the level chips by the ages it highlights: GCSE Years 7 to 11 (ages 11-15), Post-16 Years 12 and 13 (16-17), Primary Reception to Year 6 (4-10), first and last age inclusive; Whole school highlights nothing. The figures don't change with the level; the year groups in focus do. | no | auto: smtPupilsLevel | — |
| R-SMT-VIEW-PUPILS-NOW | active | Your pupils now shows the census's roll and its change since 2019/20, girls and boys (mixed schools only), day and boarding (boarding schools only), Year 12 against Year 11 (Year 12 now against Year 11 a year before, where the school has both), the school page's XS-XL by phase and the LA context line. | no | auto: smtPupilsNow | — |
| R-SMT-Y12-AGAINST-Y11 | active | The Year 11 to Year 12 figure is called "Year 12 against Year 11" wherever it appears (Your pupils now, the set's figure in Shape and size, the Leaving at 16 table), never "staying on", with SMT_NOTES.y12AgainstY11 as its caption; it compares the same cohort, Year 11 in year t-1 with Year 12 in year t. | no | auto: smtY12AgainstY11 | — |
| R-SMT-VIEW-SHAPE | active | Shape and size draws pupils in each year group, the shape and since when, and the shapes around (the LA's schools of the same age range, the comparison set's shapes, Year 12 against Year 11 in the set's sixth forms) -- described, never ranked. | no | auto: smtShape | — |
| R-SMT-ADMISSIONS-READ-ONLY | active | Views from Admissions (entry points at a glance, the pool, market share) are read-only in SMT: no setup, no list editing, each with Open in Admissions; where Admissions has no entry points or no saved rivals, an empty state says why. | no | auto: smtAdmissionsReadOnly | — |
| R-SMT-VIEW-LEAVING | active | Leaving at 16 follows Year 11 to Year 12 at the school year by year (the census a year apart): Year 12 against Year 11 and the net leavers, worded as Admissions' estimate (ADMISSIONS_NOTES.leaving16). | no | auto: smtLeaving | — |
| R-SMT-CONTEXT-PLACE | active | Context's place line (town · LA · region) drops any part that names the same place as the part before it, compared case-insensitively and ignoring "City of" / "Borough of" (prefix, or GIAS's ", City of" suffix). | no | auto: smtContextPlace | — |
| R-SMT-CONTEXT-PROJECTION-JOIN | superseded by R-SMT-FORWARD | Context's school-age population draws both sources as published: ONS mid-year estimates, then ONS's projection from its own figure for the latest estimate year. Where the two differ there by more than SMT_PROJECTION_JOIN_GAP_PCT (2%) of the estimate, the panel's source (i) adds SMT_NOTES.projectionJoin ("The projection starts from ONS's {base} base, not the latest estimate, so the two lines may not meet."); otherwise it says nothing. | no | manual | — |
| R-SMT-CONTEXT-RESIDENTS | active | Context's children within the school's catchment radius are ONS residents (area_context: LSOAs whose population-weighted centroid is within the radius, the latest mid-year held; at 5 miles exactly school_context_lookup's figures), summed over the level's single ages (GCSE 11-15, Post-16 16-17, Primary 4-10, Whole school the school's range), with the change since the first year held; the census's pupils at schools within the radius sit beside them, labelled, and neither is divided by the other. | no | auto: smtContextResidents | — |
| R-SMT-CONTEXT-DEPRIVATION | active | Context shows the IMD and IDACI deciles of the school's own LSOA, each "decile n of 10", and the IDACI mix of the children within 5 miles as one bar, decile 1 to 10, with the share in deciles 1-2 against England's 20% (by construction, said in the (i)). A school whose postcode places it in no English LSOA says so. Deprivation always describes the area, never the pupils. | no | auto: smtContextDeprivation | — |
| R-SMT-CONTEXT-FSM | active | A state school shows its latest FSM % (fsm_eligible_percent) with its LA (through la_gss_crosswalk) and England the same year, to 1 dp, and the change since the first year held. An independent school (GIAS's independent schools less CTCs, and independent special schools) shows "Free school meals are not published for independent schools." and "Independent schools often draw pupils from well beyond 5 miles." -- never a number, never 0%, never a bare dash. | no | auto: smtContextFsm | — |
| R-SMT-CONTEXT-WORDING | active | Context's six wording rules come from SMT_NOTES, word for word: deprivation is "the area around the school, not its pupils"; independent schools' FSM; residents are not pupils; deciles (1 = the most deprived 10%); "A projection, not a forecast for the school", by local authority; the sources and editions in the source (i), their years read from the data. No "pupils" next to a deprivation figure. | no | auto: smtContextWording | — |
| R-SMT-CONTEXT-GEOGRAPHY | active | Context's map shades neighbourhoods (ONS LSOAs 2021, joined through postcodes): those the ingest counts within 5 miles (population-weighted centroid) plus a one-mile ring, with the 5-mile circle drawn; the count within 5 miles equals school_context_lookup's. Until lsoa_boundaries has rows (before K0's migration and load), and for the Area pill's LA, the map draws round 2's LA shading and says "shading by district". "Shade by" lists only what exists. | no | auto: smtContextGeography | — |
| R-SMT-DATA-GAP | superseded by R-SMT-CONTEXT-DEPRIVATION | Retired in SMT round 3: Context showed the data gap ("Deprivation and free school meals: not yet in VicData") where the figures would be. The ingest has loaded both; the dashed block is gone, and the figures are R-SMT-CONTEXT-DEPRIVATION's and R-SMT-CONTEXT-FSM's. | no | none yet | — |
| R-SMT-VIEW-CONTEXT-NOW | active | The area now shows children of the level's ages living within the catchment radius (or in the LA) with the change since the first year held, the authority mix under it (0.8 SMT r4), the census's pupils at schools within the radius beside them, births last year and since 2012, the projection tile (the area's children of the ages, latest count to five years on, with its range: area_projection, or la_projection_lookup for the LA), the schools nearby of the same phase (all sectors), the place line (town · LA · region), and the Social context block. | no | auto: smtContextNow | — |
| R-SMT-VIEW-BIRTHS | active | Births are drawn by LA against England (every English district and unitary summed), indexed to 2012 = 100, said to be by LA. The school-age population (0.8 SMT r4) is the area's children of the level's ages, within the radius or in the LA: estimates to the latest count, then the projection from that count to the settings' horizon (latest + horizon_years). | no | auto: smtBirths | — |
| R-SMT-RADIUS | active | Context draws at one radius, in whole km: this view's own (?km=), else the school's saved catchment (school_catchment, app DB), else the default by type (5 km state, 15 km independent); never past the cap by type (15 km a state school without a sixth form, 30 km otherwise; a saved catchment over it draws at the cap and says so). The whole board follows it -- the map circle and ring, children now, the deprivation mix, population by age, children nearby over time, the forward view, schools nearby and the census line -- and no caption names another radius. The school's own School-Admin (or account holder) saves it; its approved members read it; nobody else does. | no | auto: smtRadius | — |
| R-SMT-FORWARD | active | The forward view is the ingest's children-in-an-area projection (docs/v0.8/vicdata_area_projection_method_v1.md): area_projection at the radius, or la_projection_lookup for the LA (a county's districts summed), for the level's ages. Estimates, solid, to the latest count, then the middle line from that count to the horizon, its band (the lowest and highest of whole single-year projections, taken over the ages' sum) shaded, the years whose ages include children not yet born drawn lighter and labelled at the change. ONS's 2022-based projection (its change, applied by authority around the school) and the scenario are faint lines, off by default. | no | auto: smtForward | — |
| R-SMT-NOT-A-FORECAST | active | The projection's wording is the method note's, from SMT_NOTES: "A projection of children living in the area, not a forecast for the school." on every view that draws it, and what it is and isn't (SMT_NOTES.whatItIs). Never "forecast" except as "not a forecast", never "your roll", never a school-level number from it. | no | auto: smtNotAForecast | — |
| R-METHOD-PRESENT | active | Every catalogue view (Teacher, Admissions, SMT; groups' views are SMT's) has a method (src/catalogue/methods.ts): the sources with their editions, read from the data where it carries them; the area; the years used and any left out, with the reason; the calculation as numbered plain-English steps; and any rounding or suppression. The footer's source (i) shows it, the steps under a collapsible "How it is calculated", scrolling, never cut off, on the phone too. Where the code does something the (i) didn't say (a rounding, a filter, an exclusion, double award as two entries, a small-number rule), the method says it. | no | auto: methodPresent | — |
| R-METHOD-SETTINGS | active | A view whose numbers come from stored settings has its method generated from them, never typed: the forward view's (projectionMethod) is built from area_projection's settings in the method note's (i) shape, so every setting value appears in the text and changing a setting changes it. | no | auto: methodSettings | — |
| R-SMT-LEVEL-CHIPS | active | The level chips are Whole school (the default) then only the phases the school has, from the census as the school page's Roll by phase decides them (Primary, GCSE, Post-16); an IGCSE school's GCSE chip is shown, marked, with the reason in its tooltip. Subject areas sit under GCSE or Post-16 only, as a second row with All areas first; Whole school and Primary have none. The level is held in the address (?level=, &area=) and remembered for the user; a level the school can't show falls back, never errors. | no | auto: smtLevelChips | — |
| R-SMT-SET-RANKS | active | One comparison set drives the whole SMT dashboard: Teacher's sets (10 nearest, the LA, saved sets, the school's sets, rankings), resolved by Teacher's own route. Every rank among the set is level-aware: only the set's schools with that result are ranked (IGCSE schools left out at GCSE), the school counted too, highest first, ties sharing a place, and the count says so ("2 of 11 with GCSE results"). Regional and England ranks are 0.6.6's whole-population ranks. | no | auto: smtSetRanks | — |
| R-SMT-IGCSE-WORDING | active | An IGCSE school (R-IGCSE-EXCL) is never shown a whole-school GCSE zero or rank: its GCSE rows read "IGCSE · not ranked", its column-1 tile "IGCSE school, no comparable GCSE results", every whole-school GCSE view (value added; the results trend with no area chosen) says why in its own space (SMT_NOTES.igcseView), and its set is chosen in Post-16. Post-16 is compared as usual. Its GCSE subjects, complete subject areas, grade profile and entries mix are drawn and ranked as any school's (R-IGCSE-SUBJECT; 0.8 IGCSE subjects). | no | auto: smtIgcse | — |
| R-SMT-P8-REASON | active | Progress 8 shows only where DfE published it (state schools, to 2023/24), with its year and interval; otherwise the view says which reason applies, from SMT_NOTES: not published for independent schools; not published for 2024/25 or 2025/26 (no KS2 baseline); no GCSE results. Never a blank, never a zero. | no | auto: smtP8 | — |
| R-SMT-VA-HONEST | active | Value added is shown as DfE publishes it -- A-level value added by qualification type and by subject, with DfE's 95% interval and banding -- and worded from SMT_NOTES: 0 is the national average; a range crossing 0 isn't clearly different from average; GCSE value added by subject has never been published. | no | auto: smtVa | — |
| R-SMT-YEARS | active | Every SMT year comes from the data or years.ts, never the code: each key stage's latest from academic_current_periods (with "(provisional)" where the ingest says so), change measured from TREND_BASE_PERIOD, the census from CENSUS_FIRST_PERIOD; Context's small-area, LA, projection and FSM years from what the lookups return. When GCSE's latest moves on and Post-16's doesn't, each view labels its own year; when ONS adds an LSOA year, Context moves to it. | no | auto: smtYears | — |
| R-SMT-BOARDING-ONLY | active | SMT's filters are pills, only where they apply: Gender for a mixed school, Day + boarding for a boarding school (isBoardingSchool). A day school's request for boarding figures is ignored on the server; results aren't split by either, and the views say so. | no | auto: smtBoardingOnly | — |
| R-SMT-FLAGS | active | Flags on the school appear only for large and lasting changes, with the figures behind them: the roll falling three years running (Admissions' losingPupils), the entry cohort shrinking past the national threshold (entryYearShrinking), and results moving faster than the set's middle by at least SMT_FLAG_RULES.resultsGap over two years, with at least SMT_FLAG_RULES.resultsMinSchools set schools. The thresholds live in src/lib/smt/flags-rules.ts only. | no | auto: smtFlags | — |
| R-SMT-NOTES | active | SMT's honesty wording comes from one file, SMT_NOTES (src/catalogue/notes.ts), behind each panel's caption button or in the view's own space; no SMT component words a caveat of its own. | no | auto: smtNotes | — |
| R-SMT-SMALL-ENTRIES | active | A subject with fewer than MIN_SUBJECT_ENTRIES (5) entries isn't ranked and says so; ranks come from Teacher's subjectRanking, so a subject's figures match the subject explorer's. | no | auto: smtSubjects | — |
| R-SMT-VIEW-NOW | active | The school now shows the census's roll and its change since 2019/20, girls and boys (day and boarding at a boarding school), each phase's headline with its national rank, A-level value added, Progress 8 or its reason, and the school page's XS-XL by phase -- never new words for size. | no | auto: smtViewNow | — |
| R-SMT-VIEW-SCORECARD | active | The scorecard lists each headline with the school's figure, its rank in the set (with the count), in the region and in England, and its change since 2022/23 (roll since 2019/20); IGCSE rows say not ranked; the flags line follows. | no | auto: smtSetRanks | — |
| R-SMT-VIEW-MAP | active | The map draws the school and every located school in the comparison set; the school ringed. | no | auto: smtViewMap | — |
| R-SMT-VIEW-TRENDS | active | Trends draw indexed rolls against the LA and England (pupils aged 5-15, said so), results against the set's middle half with 2021/22 shaded and the trend note, and market share from Admissions read-only (an empty state with the reason where the school has no 11+ rivals). | no | auto: smtViewTrends | — |
| R-SMT-VIEW-ACADEMIC-NOW | active | The level now shows the level's headlines (both phases at Whole school), value added in its own block with its reason, and the grade profile. With a subject area chosen the tiles are four, as the Academic board draws them: entries, the average, the top grades, and the rank in the set as its own tile. | no | auto: smtAcademicNow | — |
| R-SMT-VIEW-AREAS | active | Subject areas are Admissions' strengths and weaknesses (buildRivals), against the comparison set instead of the rivals. | no | auto: smtAreas | — |
| R-SMT-VIEW-SUBJECTS | active | Subjects list the area's subjects with entries, average, rank in the set and England, since 2022/23, and the subject explorer link carrying ?set=. | no | auto: smtSubjects | — |
| R-SMT-VIEW-GRADES | active | The grade profile bands the main qualification's latest graded entries (GCSE 9-7, 6-5, 4, 3-1; A level A*-A, B, C, D-U); the bands add up to all of them. | no | auto: smtGrades | — |
| R-SMT-VIEW-MIX | active | The entries mix shows each area's (or subject's) share of the entries for every year the data has, from the subject rollup's first year with entries (R-ENTRIES-FIRST-YEAR: 2020/21 at GCSE, a year before the results trend beside it); entries count from the first year (not graded, so no 2021/22 note). | no | auto: smtMix | — |
| R-SMT-VIEW-RESERVED | active | Results by band is a reserved panel: the slot exists, with SMT_NOTES.bandReserved as its caption and body -- "the top 25%, middle 50% and bottom 25% of entries" (the bands are of entries, not pupils) -- and no figure. | no | auto: smtReserved | — |

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
| Statement | A points figure is only comparable within one qualification type (KS4: qualification type; KS5: the exact qualification). Post-16 Context on points keeps to the focused item's qualification family on every group, All subjects included; a figure that could only be a blend is not shown. Since 0.6.5 (S3), Post-16 Comparisons and the maps (Column 3 Current and Trends, Column 1's Trend map) read every school's figure for the focus's EXACT qualification -- A level, AS level, each BTEC size, IB Higher or Standard level -- never the bucket's blend, so Column 1, Comparisons and the maps show one figure for the school and one rank; where no other school in the set has the qualification (or publishes its points), Comparisons says so. |
| Why | A-level, BTEC and IB points sit on different challenge tables; one bar chart or average across them compares unlike scales. |
| Applies to | M-KS4-POINTS, M-KS5-POINTS; map chips, Column 1 category, Context |
| Enforced in | - src/lib/teacher-view-catalogue.ts:comparabilityKey (124-127)<br>- src/app/api/teacher/dashboard/route.ts:englandAverages (56-72, exact qualification)<br>- src/app/teacher/[phase]/page.tsx:candidateItems (1063-1099, via R-QUAL-FAMILY-MATCH)<br>- src/lib/teacher-view-measures.ts:contextKeepsToFamily, onFocusPointsScale, contextGroupValue (Post-16 points rows in the focus's family only)<br>- src/lib/teacher-view-populations.ts:contextItemsOf (keepToFamily: All subjects on Post-16 points)<br>- src/app/api/teacher/comparator-qualifications/route.ts; src/lib/teacher-view-comparator-quals.ts (0.6.5 S3)<br>- src/components/dashboard-config/TeacherDashboard.tsx:exactQuals, comparatorSubjectSeries, mapChips (exact at Post-16), exactQualsNote |
| Tagged at | - src/app/api/teacher/comparator-qualifications/route.ts<br>- src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/comparator-quals.test.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/teacher-view-catalogue.ts<br>- src/lib/teacher-view-comparator-quals.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/teacher-view-populations.ts<br>- src/lib/teacher-view-theme.ts |
| Test case | Croydon College (130432), ks5, Business Studies, 2024/25: Context on Average point score: Business Studies (A level + five BTEC sizes) has one group value per family -- the A-level family's is the A-level row's own 26.36, the BTEC family's is the BTEC rows' weighted mean; no focus = no value. With A-level Computer Science focused, All subjects draws 20 A-level subjects (was 55 across every family) and its average is 25.6 (was a 24.7 blend). Comparisons on A level Maths 2024/25: Croydon's own figure is its exact A level row (24.00), not the A-level bucket's 21.45, and every comparator's comes from the same exact-qualification rows. [runner: pointsSameQual] |
| Origin | Academic Results phase; Post-16 Part C and Part D |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:groupValueFor (1207-1216), contextItems (1361-1369) → src/lib/teacher-view-measures.ts:subjectPointsAt, latestOwnPoints; POINTS_BEARING_QUALIFICATION -> src/lib/dfe-qualification-buckets.ts (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | - S3b (Guy's decision 3, 3 Oct 2026): Post-16 Context on points no longer blends A level, BTEC and IB. contextGroupValue keeps each member's rows to the focused item's qualification family (display bucket), and contextItemsOf keeps All subjects' peers to it too (contextKeepsToFamily = Post-16 points; entries still add up across families). A row with no qualification type is never counted (suppressed, not blended); none occurred in the real data checked. The Context note says 'Points are on a different scale for each qualification type, so only <family> subjects are compared.' Before/after for 130432, 117037, 100369 and 130448 in the commit message. |

### R-KS4-POINTS-GCSE-FULL

| Field | Content |
| --- | --- |
| Statement | KS4 points come only from GCSE (9-1) Full Course entries with a clean single grade, and from a GCSE Double Award scored from its own grades as two entries, each the average of its two grades (R-DOUBLE-AWARD-POINTS; Column 1 too since 0.8 audit fixes, 2). |
| Why | Short courses and vocational qualifications have no place on the 9-1 points table; scoring them would invent figures. A Double Award's pairs ("98") map onto it two grades at a time, as DfE scores it. |
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
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/teacher-view-comparator-series.ts<br>- src/lib/teacher-view-comparisons.ts<br>- src/lib/teacher-view-panels.ts<br>- src/lib/teacher-view-populations.ts |
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
| Why | Superseded: the live threshold for a line is 4 real years (R-TREND-LINE-4YR). Retired in the year rules follow-ups (Guy, 13 Oct 2026): the meetings slide picker, the last view on 3, follows R-TREND-LINE-4YR too (R-MEETINGS-TREND-4YR). |
| Applies to | Trend views |
| Enforced in | — |
| Tagged at | — |
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
| Tagged at | - src/lib/teacher-view-panels.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/comparisons.ts<br>- src/lib/view-series/series.ts<br>- src/lib/view-series/subjects.ts<br>- src/lib/year-rules.test.ts |
| Test case | Acland Burghley School (100053), ks4, Mathematics: Average points and Grade 4+ each have the latest year's expected count of real years (rule-year-fixtures: 5 in 2025/26, 2021/22-2025/26; 4 in 2024/25) -> line (Grade 4+ had 2, 2023/24-2024/25 -> bars / change list, before 0.6.2). [runner: trendLine] |
| Origin | Teacher view round 7 §4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-MEETINGS-TREND-4YR

| Field | Content |
| --- | --- |
| Statement | A meeting's trend follows R-TREND-LINE-4YR, as every other view does: a line only with 4 or more real years. The live slide picker (the S4 chooser) offers each view's 'Over time' form and the slide draws it through the host's own panels, so a 3-year series draws as per-year bars, never a line. (The round-5 axis catalogue and its 'N-year trend' gate, which no page called, were deleted in the year rules leftovers.) |
| Why | Guy, 13 Oct 2026 (year rules follow-ups, Y4 5): the round-5 picker was the last place still on R-TREND-3YR's 3 years. |
| Applies to | /teacher/meetings: trend slides |
| Enforced in | - src/lib/teacher-view-panels.ts:TREND_LINE_MIN_YEARS, trendChartKind (the slide's drawing) |
| Tagged at | — |
| Test case | King's Worcester (117037), ks4, Computer Science: Computer Science (3 real years of points) draws as bars; a subject with 4 or more real years draws as a line. [runner: meetingsTrend4yr] |
| Origin | Year rules follow-ups (16 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
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
| Enforced in | - src/lib/subject-grades.ts:thresholdRate<br>- src/lib/subject-grades.ts:bandRate<br>- src/lib/subject-grades.ts:BAND_PRESETS |
| Tagged at | - src/lib/subject-grades.ts<br>- src/lib/teacher-view-comparator-grades.ts<br>- src/lib/teacher-view-measures.ts |
| Test case | The Chase (137625), ks4: Asked for GCSE 7-9, a BTEC returns no figure (not 0%); an IB 7-1 row at KS5 is not scored against grade 4. [manual] |
| Origin | Teacher view round 6 §6.5; grade bands round |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-POST16-BAND-DEFAULT

| Field | Content |
| --- | --- |
| Statement | Grade bands opens on a default range on every Post-16 scale, as GCSE opens on 7-9: A level and EPQ A* to A; AS and Core Maths A to B; IB subject 7 to 6; vocational single Distinction* to Distinction, double D*D* to DD, triple D*D*D* to DDD; T Level Distinction* to Merit. The scale is the focus's own (scaleForQualification). A saved range wins while both its ends are on the focus's scale; otherwise the scale's default (never a stale or blank range). The Post-16 defaults are Post-16 only; Pre-U and the KS4 vocational scales stay custom-range only. The Grades menu offers the default plus Custom. |
| Why | Guy, 7 Oct 2026 (the 0.6.4 audit's change 1): with no range, Post-16 Grade bands opened on 'Pick a grade range' and Context and Comparisons fell back to points, where GCSE opens on a real band. |
| Applies to | M-KS5-BANDS; the top bar's Grades control |
| Enforced in | - src/lib/subject-grades.ts:BAND_PRESETS, presetsFor, defaultPresetFor<br>- src/lib/teacher-view-measures.ts:bandRangeFor<br>- src/components/dashboard-config/TeacherDashboard.tsx:bandPresetContext<br>- src/components/teacher/ResultsControl.tsx:BandMenu |
| Tagged at | — |
| Test case | King's Worcester (and Croydon College 130432, Sevenoaks 118952, Christ The King 130416) (117037), ks5, 2024/25: From each school's own grade rows: A level Maths opens on A* to A, a BTEC Extended Diploma on D*D*D* to DDD, IB HL Mathematical Studies on 7 to 6, T Level Health on Distinction* to Merit, each with a real band figure; a saved off-scale range falls back to the default. [runner: post16BandDefault] |
| Origin | 0.6.5 S1 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-POST16-DEFAULT-SET

| Field | Content |
| --- | --- |
| Statement | On the Post-16 page the default comparison set is the 10 nearest schools and colleges with Post-16 provision, named '10 nearest with a sixth form or 16+ provision' in the chooser (the column's pill keeps '10 nearest schools', so Column 3's content and the grid's widths don't change): GCSE's matching rules (the same distance order, sector, phase and gender rules and the same widen-the-net backfill) plus one filter -- KS5 results in either of the latest two published years. An FE college's default (the nearest FE colleges) and a boarding recipe (its schools with KS5 results) follow the same rule. GCSE keeps its own nearest 10; saved sets are never altered; the Data View's default-lists, expand-nearest and boarding-quintile-list calls are unchanged (only the Teacher chooser on its Post-16 page asks with post16=1). |
| Why | Guy, 7 Oct 2026 (the 0.6.4 audit's change 6): the GCSE nearest 10 left few comparators sharing a Post-16 qualification (3 for King's Worcester's A level Maths). |
| Applies to | The Comparisons column's default set at Post-16; the comparator chooser's 10 nearest on the Post-16 page |
| Enforced in | - src/lib/default-comparator-lists.ts:buildDefaultComparatorLists (post16), withKs5Results, keepWithKs5Results<br>- src/lib/chooser-sets.ts:resolveDefaultNearest<br>- src/app/api/data-view/default-lists, expand-nearest, boarding-quintile-list (post16=1, opt-in)<br>- src/components/teacher/ComparatorSetChooser.tsx:nearestName; src/components/dashboard-config/TeacherDashboard.tsx:DEFAULT_CHOICE_LABEL_POST16 |
| Tagged at | — |
| Test case | King's Worcester (and The Chase 137625) (117037), ks5, Mathematics, 2024/25: The Post-16 default has 10 schools, each with KS5 results, and more of them offer A level Maths than the GCSE nearest 10 does (3 before); the GCSE nearest 10 (no option) is unchanged. [runner: post16DefaultSet] |
| Origin | 0.6.5 S4 |
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
| Test case | Acland Burghley School (100053), ks4: The school's grade rows run from HISTORIC_GRADE_FROM (2021/22) to the latest year (years.ts), every year (2025/26: five), and the Data View read from MODERN_GRADE_FROM (2023/24). [runner: thresholdPeriods] |
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
| Tagged at | - src/app/api/teacher/comparator-grades/route.ts<br>- src/app/api/teacher/subject-grade-geography/route.ts<br>- src/lib/academic-data-view.ts<br>- src/lib/grade-rows.test.ts<br>- src/lib/grade-rows.ts<br>- src/lib/post16-safeguards.test.ts<br>- src/lib/subject-grades.ts<br>- src/lib/subject-ranking.ts |
| Test case | Croydon College (130432), ks5, Business Studies (BTEC Extended Certificate), 2021/22: 2021/22 reads Distinction* 2, Distinction 9, Merit 31, Pass 9 on the vocational scale (no '*' or 'D' rows, COVID result 44 a non-grade); King's Worcester (117037) A-level Maths 2021/22 keeps its '*' rows on the A-level scale -- read as A* (20) since 0.6.3, R-ALEVEL-STAR -- A*-E 100% of 45. [runner: historicGradeLabels] |
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
| Statement | Context falls back to points when Results is on Grade bands without a range (or on Grade counts with no focused subject); Comparisons falls back to points (with a subject chip) or the headline (without). Since 0.6.3, Grade counts with a focused subject never falls back: it follows the selected grade, or prompts for one (R-COUNTS-SELECTION). |
| Why | Grade bands has no single figure to compare subjects or schools on until a range is picked. |
| Applies to | Context, Comparisons on Results |
| Enforced in | - src/app/teacher/[phase]/page.tsx:1174-1175, 1436-1443 |
| Tagged at | - src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts |
| Test case | Acland Burghley School (100053), ks4: Results -> Grade bands with no range saved: Context shows Average points with the note 'Pick a grade range from Grades ▾…'. Results -> Grade counts with nothing selected: Context and Comparisons show the prompt 'Click a grade in Results to compare it…', never points. [manual] |
| Origin | Grade bands frontend round |
| Status | active |
| Must lift | src/app/teacher/[phase]/page.tsx:1174-1175, 1436-1443 → src/lib/teacher-view-measures.ts:contextFallsBackFor, contextMeasureFor, comparisonsMeasureFor (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-COUNTS-SELECTION

| Field | Content |
| --- | --- |
| Statement | On Grade counts, a click on a grade in Column 1's Current selects it; a click on a second grade widens to the range between them; a third click starts a new selection; Clear, or a click on the single selected grade, removes it. The selection IS the band:range setting (the top bar's Grades ▾, same key and format). Context and Comparisons follow it as that range's share of graded entries (bandRate, comparator grade rows), titled 'Share at grade 9, by subject / by school (set)' with a 'Grade 9 · from your highlight' chip back to Column 1. Before any selection both columns show a prompt, not average points. |
| Why | Grade counts has no single figure to compare on, and a silent switch to points answered a different question from the one on screen. |
| Applies to | DV-C1-RES-CUR (Grade counts), Context and Comparisons on Grade counts, the top bar's Grades ▾ |
| Enforced in | - src/lib/grade-selection.ts:nextSelection, savedSelection, answerLine, selectionChipLabel<br>- src/components/teacher/GradeCountsPanels.tsx (selection, answer line)<br>- src/components/dashboard-config/TeacherDashboard.tsx:countsRange, countsSelectionMeasure, selectionRateOf, countsPrompt<br>- src/components/teacher/SelectionBits.tsx; SubjectPanels.tsx / ComparisonsPanels.tsx (prompt, chip, titleLead); src/lib/view-series/frames.ts:comparisonsLeadTitle |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/components/teacher/GradeCountsPanels.tsx<br>- src/components/teacher/SelectionBits.tsx<br>- src/components/teacher/SubjectPanels.tsx<br>- src/lib/grade-selection.test.ts<br>- src/lib/grade-selection.ts<br>- src/lib/teacher-view-measures.ts<br>- src/lib/view-editor.test.ts<br>- src/lib/view-series/frames.ts |
| Test case | The Chase (137625), ks4, History, 2024/25: Grade counts, click 9: the answer line reads 'Grade 9: N% of entries (n) · England E%' from the school's and England's own grade rows; click 7: 'Grades 7–9: 34% … · England 27%', the same figures as Grade bands 7–9 (R-BANDS-ENGLAND-BENCH). [runner: countsSelection] |
| Origin | 0.6.3 grade counts, maps, tables round (S1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-RANGE-ENDS-GRADED

| Field | Content |
| --- | --- |
| Statement | U, Fail and Unclassified (and non-grades, '*' and grades off the subject's scale) can't start or end a range: clicking them in Grade counts does nothing, and their tooltip says why. Both phases. |
| Why | A range runs between graded results; the top bar's picker already hides these (pickableGrades). |
| Applies to | DV-C1-RES-CUR (Grade counts) |
| Enforced in | - src/lib/grade-selection.ts:rangeEndGrade, notRangeEndReason<br>- src/components/teacher/GradeDistribution.tsx (clickable, clickTitle) |
| Tagged at | - src/components/teacher/GradeCountsPanels.tsx<br>- src/lib/grade-selection.test.ts<br>- src/lib/grade-selection.ts |
| Test case | — |
| Origin | 0.6.3 grade counts, maps, tables round (S1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ENGLAND-GRADED-ONLY

| Field | Content |
| --- | --- |
| Statement | England's share inside a grade selection is over graded, non-suppressed rows only. Where England suppresses a grade, or doesn't publish one the school's spread draws, the figure is partial and is not shown. |
| Why | A share of a smaller total than the school's would overstate or understate England beside the school's own share. |
| Applies to | DV-C1-RES-CUR (Grade counts answer line) |
| Enforced in | - src/lib/grade-selection.ts:englandShare, answerLine |
| Tagged at | - src/components/teacher/GradeCountsPanels.tsx<br>- src/lib/grade-selection.test.ts<br>- src/lib/grade-selection.ts<br>- src/lib/grade-spread.ts |
| Test case | — |
| Origin | 0.6.3 grade counts, maps, tables round (S1, S3) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-MIN-ENTRIES

| Field | Content |
| --- | --- |
| Statement | A selection's share at one subject (Context) or one school (Comparisons) needs at least MINIMUM_SUBJECT_N (5) graded entries, the Data View's small-entries rule; below it the subject or school reads 'too few entries', not a %. |
| Why | A share of one or two entries swings by tens of points and ranks noise. |
| Applies to | Context and Comparisons on a Grade counts selection |
| Enforced in | - src/lib/academic-data-view.ts:MINIMUM_SUBJECT_N<br>- src/components/dashboard-config/TeacherDashboard.tsx:selectionRateOf<br>- src/components/teacher/ComparisonsPanels.tsx:tooFewUrns; src/lib/view-series/ranking.ts:schoolRanking (tooFew) |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/lib/subject-ranking.test.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/view-series/frames.ts<br>- src/lib/view-series/ranking.ts |
| Test case | — |
| Origin | 0.6.3 grade counts, maps, tables round (S1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-MAP-ENCODING

| Field | Content |
| --- | --- |
| Statement | Teacher view maps: dot size = entries (the subject's, with a subject in focus). Candidates Current has no colour (one neutral fill, hover entries only). Results Current is coloured by the selected measure, by rank within the set (pale blue -> deep purple, deepest = top), and the panel's 'rank N of M' is on the same figure. Every Trends map is coloured by the change in the selected measure over the panel's own span (statements from 2022/23), diverging around zero on one symmetric scale (dark red -> pale amber -> deep green). The hover gives the coloured figure first, then entries. No figure, or below the small-entries rule: a hollow grey dot saying which. The school itself: a thick white ring (dark grey on the light theme). A labelled key on every map, card included. |
| Why | A dot's colour must say what is selected, and the same colour must mean the same thing on every map; the rank scale has its own hues so it can't be read as change. |
| Applies to | DV-C3-CUR-MAP, DV-C3-TR-MAP, DV-C3-TR-CHANGEMAP, DV-C1-RES-TR-MAP (cards and fullscreen) |
| Enforced in | - src/lib/teacher-map.ts:RANK_SEQ_STOPS, RAG_DIVERGING_STOPS, teacherMapSpec, teacherMapFills, currentMapFrom, changeMapFrom, mapResultOf<br>- src/components/data-view/AcademicMapView.tsx (optional teacherMap prop; the Data View never passes it)<br>- src/components/teacher/ComparisonsPanels.tsx, SubjectPanels.tsx; src/lib/view-series/map.ts |
| Tagged at | - src/lib/teacher-map.test.ts |
| Test case | — |
| Origin | 0.6.3 grade counts, maps, tables round (S2); the rank palette's hues per Guy, 6 Oct 2026 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ALEVEL-STAR

| Field | Content |
| --- | --- |
| Statement | At Post-16 a grade stored as '*' on an A-level-type qualification (2021/22-2023/24) is A*, in every score, share and range, for the school, its comparators and England. |
| Why | Read raw, every A* before 2024/25 fell out of an A* range: a false fall (King's Worcester's Maths A* went from 20 to 8). |
| Applies to | Post-16 grade rows: Grade counts, Grade bands, a counts selection, A*-E, comparator rates, England's grade rows |
| Enforced in | - src/lib/grade-rows.ts:starIsAStar (gradeRowsFromFacts at KS5), normaliseKs5AreaRows (/api/teacher/subject-grade-geography) |
| Tagged at | - src/app/api/teacher/subject-grade-geography/route.ts<br>- src/lib/grade-rows.ts<br>- src/lib/grade-selection.ts<br>- src/lib/post16-safeguards.test.ts<br>- src/lib/subject-ranking.ts |
| Test case | King's Worcester (117037), ks5, Mathematics, 2021/22-2024/25: A* has entries in every year (20, 14, 22, 8) and England has an A* share in every year; no '*' row remains. [runner: aLevelStar] |
| Origin | 0.6.3 grade counts, maps, tables round (S3) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SCALE-FROM-QUAL

| Field | Content |
| --- | --- |
| Statement | The focused subject's grade scale comes from its qualification type first (a T Level is on the T Level scale), its grades only after; a comparator or area row is scored on that scale when the scale is among the best fits for its grades (a T Level / vocational tie no longer reads as no figure). |
| Why | T Level and the vocational single award share Distinction*-Pass, so the grades alone tie, and bestScale's pick turned T Level comparators into false grey dots. |
| Applies to | Grade bands, a Grade counts selection, comparator rates and maps at Post-16 |
| Enforced in | - src/lib/subject-grades.ts:scaleForQualification, scaleFits, bandRate<br>- src/components/dashboard-config/TeacherDashboard.tsx:focusScale |
| Tagged at | - src/lib/post16-safeguards.test.ts<br>- src/lib/subject-grades.ts |
| Test case | Sevenoaks School (118952), ks5, Biology (IB Higher level), 2021/22-2024/25: Grade 7 and grades 6-7 are scored on the IB 7-1 scale in every year, 6-7 >= 7. [runner: ibSevenAndSixSeven] |
| Origin | 0.6.3 grade counts, maps, tables round (S3) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-HISTORIC-GRADE-LABELS-AREA

| Field | Content |
| --- | --- |
| Statement | England's, a region's and an LA's KS5 grade rows take the same historic label mapping as the school's own (R-HISTORIC-GRADE-LABELS), then '*' as A*. |
| Why | Otherwise a BTEC's 2021/22-2022/23 England rows read '*', 'D', 'M', 'P' and gave no England figure beside the school's Distinction*. |
| Applies to | /api/teacher/subject-grade-geography at Post-16 |
| Enforced in | - src/lib/grade-rows.ts:normaliseKs5AreaRows<br>- src/app/api/teacher/subject-grade-geography/route.ts |
| Tagged at | - src/lib/post16-safeguards.test.ts |
| Test case | Croydon College (130432), ks5, Business Studies (BTEC National Extended Certificate), 2021/22-2024/25: The focus scale is the vocational one; England has a Distinction* share in every year. [runner: btecDistinctionStar] |
| Origin | 0.6.3 grade counts, maps, tables round (S3) |
| Status | active |
| Must lift | — |
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
| Tagged at | - src/components/admissions/views/Bars.tsx<br>- src/components/smt/views/Scorecard.tsx<br>- src/components/teacher/RankingsMap.tsx<br>- src/lib/igcse.ts<br>- src/lib/smt/levels.ts<br>- src/lib/smt/school.ts<br>- src/lib/teacher-view-comparator-series.ts |
| Test case | The King's School Worcester (117037), ks4: Malvern College / Malvern St James absent from the set (unconfirmed, content round report :152). [manual] |
| Origin | Commit 514e285; content round S4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-IGCSE-EVERYWHERE

| Field | Content |
| --- | --- |
| Statement | One IGCSE rule in every product: a school igcseExclusionLikely flags (loaded for many schools only by lib/igcse) is left out of every ranking population on a WHOLE-SCHOOL GCSE measure (Attainment 8, English and maths 4+/5+/7+, EBacc, Progress 8, average points across all GCSEs) -- national, regional, LA, set, '10 nearest', Teacher's headline ranking, Admissions' places and SMT's ranks -- and out of a subject group's (family's) ranking across schools only where that group is incomplete at it (it took one of the group's subjects as IGCSE; igcseFamilyIncomplete). Single subjects are R-IGCSE-SUBJECT's: ranked like any other school. It is never silently dropped from a list: where a list would have shown it, a line says '{n} schools not ranked at GCSE (mostly IGCSE)'. The school itself shows 'not ranked at GCSE (IGCSE)', with no rank, 'out of' or gap. '10 nearest' at GCSE fills to 10 with the next nearest eligible schools and says how far it reached. |
| Why | The audit (0.8 SMT r4, T1, T4, T6, S4) found the national and regional populations kept IGCSE schools while the sample dropped them, the map's own check never fired, and '10 nearest' fell short. One rule, everywhere (Guy, 15 Oct 2026; Leighton Park is an IGCSE school). Narrowed on 16 Oct 2026 (0.8 IGCSE subjects): leaving IGCSE schools out of every GCSE ranking was too broad; the problem is only with measures missing the subjects a school takes as IGCSE. |
| Applies to | Every GCSE rank, 'out of' and population in Teacher, Admissions and SMT; Teacher's '10 nearest' at GCSE; the comparator maps |
| Enforced in | - src/lib/igcse.ts:igcseEngland, igcseAmong, igcseFamiliesOut, igcseFamilyOut<br>- src/lib/igcse-words.ts:igcseFamilyIncomplete<br>- src/lib/academic-data-view.ts:igcseExclusionLikely (ks4IgcseExcluded), igcseOutFor<br>- src/lib/chooser-sets.ts:resolveRankingSet, resolveDefaultNearest<br>- src/lib/default-comparator-lists.ts:buildDefaultComparatorLists (gcse)<br>- src/lib/admissions/ranks.ts:placesOf, familyPlaces<br>- src/lib/admissions/rivals.ts<br>- src/lib/smt/overview.ts:igcseExcluded<br>- src/lib/smt/academic.ts:stagePart<br>- src/lib/teacher-comparator-profiles.ts |
| Tagged at | - src/components/teacher/RankingsMap.tsx<br>- src/lib/admissions/ranks.ts<br>- src/lib/admissions/rivals.ts<br>- src/lib/chooser-sets.ts<br>- src/lib/default-comparator-lists.ts<br>- src/lib/igcse-words.ts<br>- src/lib/igcse.ts<br>- src/lib/smt/overview.ts<br>- src/lib/smt/school.ts<br>- src/lib/subject-ranking.ts |
| Test case | Leighton Park; The Chase 137625; The King's School Worcester 117037 (also IGCSE) (110110), ks4: Leighton Park: no rank on a whole-school GCSE measure (Teacher's headline ranking, Admissions, SMT), 'not ranked at GCSE (IGCSE)'; no IGCSE school in any whole-school national or regional population or listed sample; 'out of' counts that population less the IGCSE schools; out of the Sciences & Maths family ranking (no GCSE maths) where The Chase is in; 10 nearest at GCSE (whole-school) has 10 with none IGCSE, and names its reach where it filled. [runner: igcseEverywhere] |
| Origin | 0.8 audit fixes, item 1 (docs/v0.8/vicdata_0_8_audit_fixes_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-IGCSE-GROUP-LABEL

| Field | Content |
| --- | --- |
| Statement | Teacher's Column 1 keeps an IGCSE school's own GCSE subject figures (its rank among its own subjects, its gap to England): only ranks against other schools follow R-IGCSE-EVERYWHERE and R-IGCSE-SUBJECT. Where the focused subject's category at the school lacks the subjects it takes as IGCSE (English and maths, the subjects the IGCSE rule rests on), the category is named in a short form everywhere it appears for that school (tiles, tables, chips, Context, 'Add an average', SMT's area chips): 'Sciences & Maths · no maths (IGCSE)' (or '· no Mathematics (IGCSE)' when Statistics or Additional Maths is held), 'Languages & Literature · no English (IGCSE)' or '· no English Language (IGCSE)', judged on the subjects with entries in the school's latest GCSE year. The full sentence -- 'Sciences & Maths (sciences only: maths taken as IGCSE)' -- is in the view's (i). The rank tile stays within two lines. Every other school, every other category, and England's lines keep the plain name. |
| Why | Leighton Park's Biology reads '2nd of 4 in Sciences & Maths', a category with no maths at the school; the name must say so (Guy, 16 Oct 2026: only ranks against other schools count). The first label wrapped the rank tile to seven lines, so it is shortened (0.8 IGCSE subjects, follow-up 1). |
| Applies to | Teacher Column 1 (Results and Candidates) at GCSE: the category rank tile and the 'Results / Entries in {category}' headings |
| Enforced in | - src/lib/igcse-words.ts:igcseGroupLabel, igcseGroupNote, igcseGroupLabelFor, igcseGroupNoteFor<br>- src/app/api/teacher/dashboard/route.ts (igcseExcluded)<br>- src/components/dashboard-config/TeacherDashboard.tsx:focusCategoryLabel, focusCategoryNote, categorySource<br>- src/lib/smt/school.ts:igcseLabelledAreas |
| Tagged at | - src/app/api/teacher/dashboard/route.ts<br>- src/components/dashboard-config/TeacherDashboard.tsx<br>- src/lib/igcse-words.test.ts<br>- src/lib/igcse-words.ts |
| Test case | Leighton Park; The Chase 137625 (110110), ks4: Leighton Park is IGCSE-excluded and has no Mathematics or English entries in its latest GCSE year: Biology's category reads 'Sciences & Maths · no maths (IGCSE)', Latin's 'Languages & Literature · no English (IGCSE)', and Biology's (i) says 'sciences only: maths taken as IGCSE'. The Chase's Biology reads 'Sciences & Maths', with no such sentence. [runner: igcseGroupLabel] |
| Origin | 0.8 audit fixes, Guy's decision on the Leighton Park stop (16 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-IGCSE-SUBJECT

| Field | Content |
| --- | --- |
| Statement | An IGCSE school (igcseExclusionLikely) is ranked like any other school in a single GCSE subject it entered as GCSE 9-1 -- Teacher's subject rankings, Comparisons, maps, sets and '10 nearest', SMT's subject rows, Admissions' subject places -- since DfE's subject figures are GCSE entries only. '10 nearest' for a subject is the 10 nearest by the same rules with IGCSE schools in; population counts say what's included ('of 3,443 schools with GCSE Biology results'). What a school took as IGCSE is inferred in one function (igcseTakenAsIgcse): English Language and maths, which every school teaches, where an IGCSE school has no GCSE entries in one that year; never any other subject (a subject it simply doesn't offer isn't 'taken as IGCSE'). A subject group is incomplete where it lacks one of those, or a subject the group requires (no group has required subjects). |
| Why | Guy, 16 Oct 2026: the audit fixes left IGCSE schools out of every GCSE ranking, which was too broad. The problem is only with measures missing the subjects a school takes as IGCSE: Leighton Park's GCSE Biology is a GCSE Biology figure like any other. |
| Applies to | Every single-subject GCSE ranking and comparison in Teacher, SMT and Admissions; Teacher's sets for subject views (subjectRows); the comparator maps on a subject |
| Enforced in | - src/lib/igcse-words.ts:igcseTakenAsIgcse, igcseFamilyIncomplete, FAMILY_REQUIRED_SUBJECTS<br>- src/lib/subject-ranking.ts:rankedWithIgcse<br>- src/lib/teacher-view-comparator-series.ts:rankFixedSets (subjectRanked)<br>- src/lib/chooser-sets.ts:resolveFixedSet, resolveDefaultNearest (subjectRows)<br>- src/app/api/teacher/saved-comparator-sets/route.ts (subjectRows)<br>- src/components/dashboard-config/TeacherDashboard.tsx:subjectComparatorSets, subjectSets<br>- src/lib/academic-data-view.ts:igcseOutFor<br>- src/components/teacher/RankingsMap.tsx<br>- src/lib/smt/academic.ts:stagePart<br>- src/components/smt/SmtDashboard.tsx:academicWhyNot |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/components/smt/SmtDashboard.tsx<br>- src/components/teacher/RankingsMap.tsx<br>- src/lib/academic-data-view.ts<br>- src/lib/admissions/rivals.ts<br>- src/lib/chooser-sets.ts<br>- src/lib/igcse-words.ts<br>- src/lib/igcse.ts<br>- src/lib/smt/academic.ts<br>- src/lib/smt/school.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/teacher-view-comparator-series.ts<br>- src/lib/teacher-view-saved-sets.ts |
| Test case | Leighton Park; The King's School Worcester 117037; The Chase 137625 (110110), ks4: Leighton Park is ranked in GCSE Biology, Chemistry, Physics, Art and Design and Combined Science, and not in Attainment 8, English and maths, Sciences & Maths or English (Languages & Literature); its Sciences & Maths (i) says 'sciences only: maths taken as IGCSE'. King's Worcester is ranked in Art and Design, History and Geography and in its Humanities family, not in Sciences & Maths or Languages & Literature; it has no GCSE Biology, so no Biology rank, and Biology isn't inferred as IGCSE. Leighton Park's 10 nearest for a subject includes IGCSE schools; its whole-school ten doesn't. [runner: igcseSubject] |
| Origin | 0.8 IGCSE subjects (docs/v0.8/vicdata_0_8_igcse_subject_rankings_claude_code_prompt_v1.md) |
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
| Tagged at | - src/lib/rank.ts<br>- src/lib/teacher-view-comparisons.ts<br>- src/lib/teacher-view-panels.ts |
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
| Why | Pooling a comparator's qualifications mixes grade scales (Mathematics moved +5pp when fixed). |
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
| Statement | A grade or points view over time whose years include 2021/22 carried a note that 2021/22 was graded more generously, so some fall from it reflects grading. Superseded by R-TREND-FROM-2223 (Guy, 6 Oct 2026): trends are now measured from 2022/23, and the note says so. |
| Why | 2021/22 (summer 2022) was Ofqual's transition year: grading set roughly midway between 2021 and 2019. |
| Applies to | M-*-POINTS, M-*-THRESHOLD, M-*-BANDS, M-*-COUNTS, Comparisons' headline: over-time views |
| Enforced in | — |
| Tagged at | - src/lib/grading-note.test.ts<br>- src/lib/trend-base.test.ts |
| Test case | — |
| Origin | 0.6.2 S4 (prompt: 'wherever a grade or points trend includes 2021/22, put a short footnote on the view') |
| Status | superseded by R-TREND-FROM-2223 |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-TREND-FROM-2223

| Field | Content |
| --- | --- |
| Statement | On a grade or points measure (Average points, Grade 4+ / A*-E, Grade bands, Grade counts, Comparisons' headline; never Candidates, never KS2), 2021/22 stays on the Trends' graphs and tables, but every trend statement is measured from 2022/23 (TREND_BASE_PERIOD): the direction word (R-TREND-FLAT-4PCT) and the trend sentence ('… since 2022/23'), the group / 'vs:' clause, every year table's Change column (Trend and % change tables, Results' area change table: the card's two year columns are then 2022/23 and the latest, with a '+N more years' cue since 0.6.4; years down and fullscreen show every year, R-TREND-TABLE-YEARS), a fitted Trend line, a short span's ranked change bars, ranked change lists, change and Trend maps, the % change half's summary and collapsed figure, and a slope from the span's first year. Grade counts' change table measures from 2022/23 at the earliest, its 'From' menu from there (since 0.6.4 it lists every year from 2021/22 in years down and fullscreen, the card's two columns still the change's ends); its spread may still be compared with 2021/22. Line charts (Trend, Results' area chart) draw 2021/22 as a normal point. A 'From' year of 2022/23 or later is unchanged. A view whose drawn years include 2021/22 carries TREND_BASE_NOTE after its source: in the panel's 'i', and printed as text in fullscreen and in 'Print this graph'. Never on a latest-year view, on Candidates or at KS2. Indexed lines are entries only (R-INDEX-HEADCOUNTS), so unaffected. |
| Why | 2021/22 (summer 2022) was the first year back to exams after the pandemic: Ofqual set grading roughly midway between 2021 and 2019, so a trend measured from it would make most schools look as if results had fallen. |
| Applies to | M-*-POINTS, M-*-THRESHOLD, M-*-BANDS, M-*-COUNTS, Comparisons' headline (Attainment 8, A level points per entry): over-time views |
| Enforced in | - src/catalogue/notes.ts:TREND_BASE_PERIOD, TREND_BASE_NOTE, trendBaseApplies, trendBaseFor, trendNoteFor, specYears<br>- src/lib/teacher-view-panels.ts:PanelData.statementFrom, withTrendBase, statementSpan, countedValues<br>- src/components/teacher/SeriesViews.tsx:MultiTrend (short span), YearTable (Change column, card columns)<br>- src/components/teacher/TrendChart.tsx:fit<br>- src/components/teacher/ColumnPanels.tsx:withTrendNote (PanelRender.gradingYears)<br>- src/components/teacher/SubjectPanels.tsx:trendFull, trendSpan, changeFull, changeSpan<br>- src/components/teacher/ComparisonsPanels.tsx:full, trendSpan, changeSpanData, changeTableSpan, trendMapSpan<br>- src/components/teacher/GeographyComparison.tsx:GeographyView statementFrom<br>- src/components/teacher/GradeCountsPanels.tsx:changeEarlier<br>- src/lib/grade-spread.ts:gradeCounts (changeEarlier)<br>- src/lib/view-series/subjects.ts:trendData, changeData<br>- src/lib/view-series/comparisons.ts:series, changeDrawn, changeSpan<br>- src/lib/view-series/geography.ts:buildGeography (table statementFrom)<br>- src/lib/view-series/map.ts:changeMap<br>- src/lib/view-series/slope.ts:slopeYears |
| Tagged at | - src/components/data-view/AcademicGraphsView.tsx<br>- src/components/data-view/AcademicRankingsView.tsx<br>- src/components/data-view/AggregateTrendChart.tsx<br>- src/components/data-view/SubjectAreaSection.tsx<br>- src/components/data-view/TrendBaseNote.tsx<br>- src/components/smt/views/Lines.tsx<br>- src/components/teacher/ColumnPanels.tsx<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/components/teacher/GeographyComparison.tsx<br>- src/components/teacher/GradeCountsPanels.tsx<br>- src/components/teacher/SeriesViews.tsx<br>- src/components/teacher/SubjectPanels.tsx<br>- src/components/teacher/TrendChart.tsx<br>- src/components/teacher/tableLayout.ts<br>- src/lib/grade-spread.ts<br>- src/lib/grading-note.test.ts<br>- src/lib/subject-ranking.test.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/teacher-view-panels.ts<br>- src/lib/trend-base.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/comparisons.ts<br>- src/lib/view-series/map.ts<br>- src/lib/view-series/slope.ts<br>- src/lib/view-series/subjects.ts<br>- src/lib/year-rules.test.ts |
| Test case | The Chase (137625), ks4, History, 2021/22-2024/25: Grade bands and Average points Trends draw 2021/22-2024/25 and carry the note; their sentence and direction word are measured 2022/23-2024/25 ('since 2022/23'); a Trend from 2023/24 and the latest year are unchanged; Candidates and KS2 never (src/lib/trend-base.test.ts and src/lib/grading-note.test.ts, on the real hosts). [runner: trendFrom2223] |
| Origin | 0.6.2 S4b (Guy's decision B, 6 Oct 2026), replacing S4's R-2122-GRADING-NOTE |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-DV-TREND-FROM-2223

| Field | Content |
| --- | --- |
| Statement | The Data View follows R-TREND-FROM-2223 at GCSE and Post-16 (DATA_VIEW_TREND_BASELINE = TREND_BASE_PERIOD; KS2 from its first year, 2022/23): every 'since' figure on points or Attainment 8 is measured from 2022/23 -- Graphs' Growth / decline bars, the subject area's sentence and its 'Results, % change since 2022/23' (school, set average, one comparator), the subject deep dive's results change, the large-set chart's index (100 at 2022/23), Rankings' Trend tile, growth ranking and 'Position over time', and the Map's trend colours and popup. The graphs and the rank table still draw 2021/22, and every points trend that draws it carries TREND_BASE_NOTE beneath it. Candidates' changes are measured from the first year with data. |
| Why | Guy, 13 Oct 2026 (year rules follow-ups, Y4 4): the Data View measured change from 2021/22 while Teacher measured from 2022/23, so the two disagreed on the same school. |
| Applies to | Data View, academic Graphs, Rankings and Map (GCSE and Post-16) |
| Enforced in | - src/catalogue/years.ts:DATA_VIEW_TREND_BASELINE<br>- src/lib/academic-data-view.ts:TREND_BASELINE_PERIOD<br>- src/components/data-view/AcademicGraphsView.tsx:growthPoints, allPeriods, familyFirstScore, aggregateDrawnYears<br>- src/components/data-view/AggregateTrendChart.tsx:indexFrom<br>- src/components/data-view/SubjectAreaSection.tsx:pointsChangeSince, aggregateFamilyTrend (from), resultsTrendComparisonItems<br>- src/components/data-view/SubjectDeepDiveDrawer.tsx:Results % change, TrendBaseNote<br>- src/components/data-view/AcademicRankingsView.tsx:allPeriods, realRanks, growthEntries<br>- src/components/data-view/AcademicMapView.tsx:rowDataByUrn (anchor)<br>- src/components/data-view/TrendBaseNote.tsx |
| Tagged at | — |
| Test case | The Chase (137625), ks4: The Data View's GCSE and Post-16 since-year is 2022/23 (KS2 2022/23); a subject area's Results change equals its points from 2022/23 to the latest year, its Candidates change runs from the first year with data; the drawn years still start at 2021/22 and carry the note. [runner: dataViewTrendFrom2223] |
| Origin | Year rules follow-ups (16 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-TREND-TABLE-YEARS

| Field | Content |
| --- | --- |
| Statement | A trend table shows the same years as its trend chart: 2021/22 onward on a grade measure (Grade 4+ / A*-E, Grade bands, a single grade, a Grade counts selection), at GCSE and Post-16, on Results, Context and Comparisons, card and fullscreen, both drawing paths. Years down and fullscreen show every year; a card with years across may show the change's two ends (2022/23 and the latest, R-TREND-FROM-2223) with a '+N more years' cue naming the rest, which swaps to years down. Grade counts' change table lists every graded year from 2021/22 (or the member's 'From' year) the same way, its change from 2022/23. R-CURRENT-GRADES-FROM-2324 never applies to a Trends view. |
| Why | Guy, 7 Oct 2026: GCSE History's grade-band trend table seemed to start later than its graph. The data was there; the card's years-across table showed only its change's two ends and said nothing about the years it left out. |
| Applies to | DV-C1-RES-TR-TABLE, DV-C2-TR-TABLE, DV-C2-TR-CHANGETABLE, DV-C3-TR-TABLE, DV-C3-TR-CHANGETABLE, DV-C1-CNT-TR-CHANGETABLE on grade measures |
| Enforced in | - src/components/teacher/tableLayout.ts:yearColumnsShown<br>- src/components/teacher/SeriesViews.tsx:YearTable (the '+N more years' cue)<br>- src/lib/grade-spread.ts:gradeCounts (changeData)<br>- src/components/teacher/GradeCountsPanels.tsx:changeHalf gradingYears |
| Tagged at | - src/components/teacher/SeriesViews.tsx<br>- src/components/teacher/tableLayout.ts<br>- src/lib/grade-spread.ts<br>- src/lib/trend-base.test.ts |
| Test case | The Chase (and King's Worcester 117037 at Post-16) (137625), ks4, History (A level Mathematics), 2021/22 to the stage's latest: For every trend table preset on Grade 4+ / A*-E, bands 9-4 / 9-7 / 9 (A*-A / A*) and Grade counts, built from real grade rows: the table's years equal its chart's (2021/22 to the stage's latest year, years.ts); years down and fullscreen show them all; the card across shows 2022/23 and the latest and names the rest as hidden. [runner: trendTableYears] |
| Origin | 0.6.4 A (Guy's review, 7 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-CURRENT-GRADES-FROM-2324

| Field | Content |
| --- | --- |
| Statement | A latest-year view on a grade measure (Grade 4+ / A*-E, Grade bands, Grade counts; Results, Context and Comparisons' rate) reads the school's grade rows from 2023/24 on only: its subject (or school) list, its year menu, its 'vs last year' and an explicit earlier-year spread are exactly as before the rows reached back to 2021/22. A subject with grades only in 2021/22-2022/23 appears on the Trends alone. Never a Trends view, chart or table (R-TREND-TABLE-YEARS). |
| Why | The grade rows' two older years are for the trends. Read by a latest-year view, they listed subjects with no current figure ('no published figure' rows) and let 'vs last year' reach back past a missing 2023/24 to 2022/23 -- latest-year figures this round must not change (S5). |
| Applies to | M-*-THRESHOLD, M-*-BANDS, M-*-COUNTS: latest-year views |
| Enforced in | - src/lib/teacher-view-panels.ts:latestYearFrom, latestYearSeries<br>- src/components/teacher/SubjectPanels.tsx:currentSubjects, currentFrame<br>- src/components/teacher/ComparisonsPanels.tsx:currentFrom, currentFrame<br>- src/lib/grade-spread.ts:gradeCounts (latest)<br>- src/lib/view-series/grades.ts:earlierCounts, buildGrades<br>- src/components/dashboard-config/TeacherDashboard.tsx:focusScale (the band scale, since S2) |
| Tagged at | - src/components/teacher/ComparisonsPanels.tsx<br>- src/components/teacher/SubjectPanels.tsx<br>- src/lib/grade-spread.ts<br>- src/lib/subject-ranking.test.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/teacher-view-panels.ts<br>- src/lib/trend-base.test.ts<br>- src/lib/view-series/grades.ts |
| Test case | Acland Burghley School (100053), ks4: On Grade 4+ the Current subject lists match the 2023/24-on rows (no Turkish 'no figure' row), and Latin's 'vs last year' is the latest year's expected value (rule-year-fixtures): '—' in 2024/25 (no 2023/24; never 2024/25 against 2022/23), -5.68 in 2025/26 (81.82% against 87.50%). [runner: currentGradesFrom2324] |
| Origin | 0.6.2 S4b (Guy's decision A, 6 Oct 2026), after S5's first parity run |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-RANKING-SAMPLE

| Field | Content |
| --- | --- |
| Statement | A national or regional ranking set is a sample: no map or change maps; rank and average come from the whole population on the ranking's own (headline) measure -- or, with a subject in focus (0.6.6), on the measure in view (R-RANKING-MEASURE). |
| Why | A map of a sample of schools across England is not a local picture, and a rank within the sample is not the school's real rank. |
| Applies to | Comparisons with a ranking set |
| Enforced in | - src/components/teacher/ComparisonsPanels.tsx:213, 287-297, 494-506, 615, 713<br>- src/lib/chooser-sets.ts:46-61 |
| Tagged at | - src/components/dashboard-config/TeacherDashboard.tsx<br>- src/components/dashboard-config/runtime.ts<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/lib/chooser-sets.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/teacher-view-comparisons.ts<br>- src/lib/variants.test.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/frames.ts<br>- src/lib/view-series/map.ts<br>- src/lib/view-series/tiles.ts |
| Test case | — |
| Origin | Snagging round 1 Part 4 |
| Status | active |
| Must lift | src/components/teacher/ComparisonsPanels.tsx:213, 287-297, 494-506, 615, 713 → src/lib/teacher-view-comparisons.ts:comparisonsCurrentView, onRankingMeasure, sampleAllowsMap (lifted). S2 lift, verbatim; 30,888 scenarios equal before and after (docs/v0.6/audit_scripts/lift_equality) |
| Open issue | — |
| Fixed | — |

### R-RANKING-MEASURE

| Field | Content |
| --- | --- |
| Statement | With a subject in focus, a national or regional ranking ranks EVERY school in the filtered population on the measure in view: the focused subject (the exact qualification at Post-16; at GCSE a rate is the focus's qualification), on entries, average points, Grade 4+ / A*–E, a band or a Grade counts selection, in the panel's year (a rate's latest from 2023/24). A school needs 5 entries (graded entries on a rate) to be ranked (R-MIN-ENTRIES; entries rank from 1); ties share a rank (R-RANK-TIES); a school its own filters exclude is placed against the population and says so. The table draws a window at real ranks -- the card the top 3 and 5 either side (one block when the school is in the top 8), full screen the top 10, 10 either side and the bottom 3; the change list is the whole population's in the same window: points and rates from 2022/23, entries from the first year with data (R-RANKING-ENTRIES-CHANGE). No subject in focus: the headline ranking, unchanged. |
| Why | A ranking within a sample of 25 schools on a subject is not the school's real rank in the country, and 'not ranked' on a subject the school teaches says nothing. |
| Applies to | Comparisons with a ranking set and a subject in focus |
| Enforced in | - src/lib/subject-ranking.ts:rankFigures (the definition), fallbackFigures, subjectRanking<br>- vicdata ingest repo supabase/migrations/20261007200000_academic_subject_rank_lookup.sql (the same definition, one query)<br>- src/app/api/teacher/subject-ranking/route.ts<br>- src/lib/subject-ranking-view.ts:windowCut, subjectRankRows, subjectChangeRows, subjectTileDetails, subjectRankingNote<br>- src/components/teacher/ComparisonsPanels.tsx (subjectRanking)<br>- src/lib/view-series/ranking.ts:schoolRanking, comparisons.ts:subjectChangeBars, tiles.ts:rankingTiles |
| Tagged at | - src/lib/admissions/ranks.ts<br>- src/lib/subject-ranking-view.test.ts<br>- src/lib/subject-ranking.test.ts |
| Test case | The Chase (137625), ks4: GCSE History Grade 4+ nationally: The Chase's figure in the ranking equals Column 1's (its own grade rows, thresholdRate); the ranking counts thousands of schools, its window carries the school at its real rank, and ranks are shared on ties. King's Worcester 117037 A level Mathematics points: 41.71, as Column 1. [runner: rankingOnMeasure] |
| Origin | 0.6.6 (docs/v0.6/vicdata_0_6_rankings_then_speed_claude_code_prompt_v1.md, Part 1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-RANKING-ENTRIES-CHANGE

| Field | Content |
| --- | --- |
| Statement | The subject ranking measures its change in entries from the first year with data (the earliest year any school in the ranking has a figure), in %; never from 2022/23. Points and rates keep 2022/23 (R-TREND-FROM-2223). The database function takes one start year, so for entries the app reads the years in its answer and asks again from the first; the app-side fallback applies the same rule (changeFrom). |
| Why | Guy, 13 Oct 2026 (year rules follow-ups, Y4 6): the 2022/23 start exists because 2021/22's grading was generous, which doesn't touch entry numbers; R-TREND-FROM-2223 never applies to Candidates. |
| Applies to | Comparisons' subject ranking on Candidates (entries): its change list, tiles and bars |
| Enforced in | - src/catalogue/years.ts:changeStartFor (R-ENTRIES-FIRST-YEAR)<br>- src/lib/subject-ranking.ts:changeFrom, rankFigures, rankByFunction, rankRpcArgs |
| Tagged at | - src/lib/subject-ranking.test.ts |
| Test case | The Chase (137625), ks4, History: GCSE History entries, national: the change list starts at the first year with data (before 2022/23), the same from the database function and the app's fallback; Average points' starts at 2022/23. [runner: rankingEntriesChange] |
| Origin | Year rules follow-ups (16 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ENTRIES-FIRST-YEAR

| Field | Content |
| --- | --- |
| Statement | Every view that draws or measures entries (Candidates) starts at the first year with entries in the data, per phase and measure, read through one helper (years.ts entriesFirstPeriod / changeStartFor): 2020/21 for GCSE subjects, the teacher-assessed year (entry totals, no grades). Teacher's Candidates panels, the subject ranking's entries change, the Data View's 'Candidates, % change' (category and subject mode, and the set's average) and the SMT entries mix all start there. Grades and points keep R-TREND-FROM-2223 (change from 2022/23, drawn from 2021/22 with the note). Area comparisons (LA, region, England) start where the area entry totals do (2021/22). |
| Why | Guy, 16 Oct 2026 (year rules leftovers, item 1): keep 2020/21 and extend every entries view to it, so every entries figure starts at the same year. |
| Applies to | Teacher Candidates (year table, trend, % change, rankings); the Data View's Candidates figures; SMT's entries mix |
| Enforced in | - src/catalogue/years.ts:entriesFirstPeriod, changeStartFor<br>- src/lib/subject-ranking.ts:changeFrom<br>- src/components/data-view/SubjectAreaSection.tsx:entriesChange, buildCategoryRows, buildSubjectRows<br>- src/lib/smt/academic.ts:mix<br>- src/lib/teacher-view-panels.ts:trimToData (Teacher's Candidates: every year the headline holds, trimmed to the data) |
| Tagged at | - src/components/data-view/SubjectAreaSection.tsx<br>- src/lib/signed-delta.test.ts<br>- src/lib/smt/academic.ts<br>- src/lib/subject-ranking.ts |
| Test case | The Chase (137625), ks4, History: GCSE History: entries from 2020/21 (results from 2021/22); Teacher's Candidates draws 2020/21; the Data View's subject-mode change and the ranked list agree (+29% since 2020/21). [runner: entriesFirstYear] |
| Origin | Year rules leftovers (16 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ROLL-WORDS-3YR

| Field | Content |
| --- | --- |
| Statement | Every roll or headcount direction word ('Growing', 'Shrinking', 'Steady') and every arrow or colour that words one compares the latest census year with 3 years earlier (years.ts ROLL_DIRECTION_SPAN, rollDirection); a school with fewer than 4 census years uses the longest span it has, and the (i) says so. Steady is R-FLAT-BAND: the change rounds to 0%. The (i) states the rule: 'Growing or shrinking compares this year's roll with three years ago.' The 'since' figures don't change (from the first census year), and an arrow on one follows its own figure. |
| Why | Guy, 17 Oct 2026 (consistency, 1): SMT's words used 2022/23 (the results rule) on an index with a ±2-point band, Admissions' Momentum 2022/23, the groups 1, 3 or 5 years. |
| Applies to | SMT's roll and phases words; Admissions' Momentum (x and its (i)); the groups' roll flag, map colours, schools-table trend, Growing/Shrinking counts and the group home line |
| Enforced in | - src/catalogue/years.ts:ROLL_DIRECTION_SPAN, rollDirection, rollDirectionOfPct<br>- src/components/smt/views/Lines.tsx:RollDirectionWord<br>- src/lib/admissions/screens.ts:rivalExtras (entryBasePeriod)<br>- src/lib/groups/dash.ts:GROWING_SPAN<br>- src/components/groups/dash/GroupDashboard.tsx:flagOf<br>- src/components/groups/dash/views.tsx:map, SchoolRow<br>- src/app/api/group/home/route.ts, src/lib/groups/access-rules.ts:rollSummary |
| Tagged at | - src/app/api/group/home/route.ts<br>- src/components/admissions/AdmissionsDashboard.tsx<br>- src/components/admissions/views/Momentum.tsx<br>- src/components/groups/dash/GroupDashboard.tsx<br>- src/components/groups/dash/views.tsx<br>- src/components/smt/views/Lines.tsx<br>- src/lib/admissions/screens.ts<br>- src/lib/groups/access-rules.ts<br>- src/lib/groups/dash.ts |
| Test case | Wolverley CofE Secondary School; Pershore High (136925); The Bewdley School (135035); Chilmington Green School (149840) (135061), ks4: SMT's roll word: Wolverley 'Growing', Pershore 'Shrinking', Bewdley 'Steady' (−0.3% over 2022/23-2025/26), Chilmington Green (three census years) 'Growing' over its 2-year span; The Chase's Momentum base is 3 years before the latest census; the groups' span is 3; every roll (i) carries the sentence. [runner: rollWords3yr] |
| Origin | Consistency (17 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SET-CHANGE-AVERAGE

| Field | Content |
| --- | --- |
| Statement | A comparison set's '% change' is the change in the set's yearly average (each year, the average over the schools with a figure that year), from its start year to its latest: entries from the first year with entries (changeStartFor), points from the baseline year. One helper, src/lib/set-change.ts setAverageChange, in both modes of the Data View's subject area section, and for the KS2 domains' set. |
| Why | Guy, 17 Oct 2026 (consistency, 2), matching his audit-fix call ('change in the yearly average'): category mode had used the set's summed entries, subject mode the average of each comparator's own change. |
| Applies to | The Data View: 'Candidates, % change' and 'Results, % change' (the set's side, both modes); KS2 domains' 'Average across' |
| Enforced in | - src/lib/set-change.ts:setAverageChange<br>- src/components/data-view/SubjectAreaSection.tsx:aggregateFamilyTrend, subjectSeriesFor<br>- src/components/data-view/Ks2DomainSection.tsx:comparisonTrend |
| Tagged at | - src/components/data-view/Ks2DomainSection.tsx<br>- src/components/data-view/SubjectAreaSection.tsx<br>- src/lib/set-change.ts |
| Test case | The Chase (137625), ks4, History: The Chase and its 10 nearest: subject mode (History entries) and category mode (Humanities entries) each equal a plain change in the yearly mean from the first year with entries. [runner: setChangeAverage] |
| Origin | Consistency (17 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-MINUS-SIGN

| Field | Content |
| --- | --- |
| Statement | No figure prints a hyphen-minus as its sign: every negative change or value prints '−' (U+2212), through src/lib/signed-delta.ts (signedDelta, signedValue). The Data View and the SMT, Admissions and group tooltips that printed '-3%' print '−3%'. |
| Why | Guy, 17 Oct 2026 (consistency, 3). |
| Applies to | Every signed figure |
| Enforced in | - src/lib/signed-delta.ts:MINUS, signedDelta, signedValue<br>- src/components/smt/ui.tsx:fmt<br>- src/components/admissions/ui.tsx:fmtPct |
| Tagged at | - src/components/smt/ui.tsx<br>- src/lib/signed-delta.test.ts<br>- src/lib/signed-delta.ts |
| Test case | (formatters) (), ks4: −3% prints '−3%' in every style; the Data View's bars (rendered), SMT's and Admissions' percents and the flag figures print '−'; no hyphen style or hand-rolled hyphen sign is left in src. [runner: minusSign] |
| Origin | Consistency (17 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-FLAT-BAND

| Field | Content |
| --- | --- |
| Statement | An arrowed change whose size rounds to 0 at the precision shown (under 0.5% for whole percents, under 0.05 for one decimal place) is steady: no ▲ or ▼, a '–', the zero in that view's own style, and a neutral colour. One helper beside signedDelta (flatBand, arrowed, ARROW); a view may keep a wider steady band of its own, never a narrower one. Roll direction words follow the same band. |
| Why | Guy, 17 Oct 2026 (consistency, 4): '▼ 0%' read as a fall; SMT's Scorecard arrow and its colour used different bands. |
| Applies to | SMT's Now, Pupils, SchoolTile, Context, Scorecard, Subjects, Areas; Admissions' entry, market, pool, academic and bars arrows; the groups' arrows and home line; the Data View's trend pill |
| Enforced in | - src/lib/signed-delta.ts:flatBand, arrowed, ARROW<br>- src/components/smt/ui.tsx:dirClass, arrowOf, fmtChange<br>- src/components/admissions/ui.tsx:arrow |
| Tagged at | - src/components/admissions/ui.tsx<br>- src/components/groups/dash/GroupDashboard.tsx<br>- src/components/groups/dash/views.tsx<br>- src/components/smt/ui.tsx<br>- src/components/smt/views/Lines.tsx<br>- src/lib/groups/access-rules.ts<br>- src/lib/signed-delta.test.ts<br>- src/lib/signed-delta.ts |
| Test case | (formatters) (), ks4: −0.4% prints '– 0%' (SMT tile, the helper), −0.6% '▼ 1%'; the colour is neutral; the group home reads 'roll – 0.0%'; a +0.3% school isn't counted as growing; no old steady-bar glyph or unbanded ▲/▼ is left in src. [runner: flatBand] |
| Origin | Consistency (17 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-NO-NEGATIVE-ZERO

| Field | Content |
| --- | --- |
| Statement | A change that rounds to zero prints as an exact zero prints in that view, never '−0' or '-0' ('0%', '+0%' or '±0.0', each view's own). Every signed figure goes through the one formatter, src/lib/signed-delta.ts signedDelta, in its view's style (Teacher's '+0'; an unsigned zero where a view has always printed one; the minus is always '−': R-MINUS-SIGN). |
| Why | Guy, 16 Oct 2026 (year rules leftovers, item 2): '−0%' reads as a fall that didn't happen. Teacher's 0.8 fix (signedDelta) hadn't reached the Data View or the other dashboards. |
| Applies to | Every signed change or gap: Teacher, the Data View, SMT, Admissions, the group dashboards, the narrative |
| Enforced in | - src/lib/signed-delta.ts:signedDelta, UNSIGNED_ZERO, VALUE_SIGN<br>- src/lib/teacher-view-panels.ts:formatChange, formatDelta |
| Tagged at | - src/lib/signed-delta.test.ts<br>- src/lib/signed-delta.ts |
| Test case | (formatters) (), ks4: −0.3% prints '+0%' (Teacher), '0%' (the Data View's bars, rendered), '±0.0 pp' (SMT), '±0.0%' (Admissions); −3% stays '-3%'; no hand-rolled sign-then-toFixed is left in src. [runner: noNegativeZero] |
| Origin | Year rules leftovers (16 Oct 2026) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-LADDER

| Field | Content |
| --- | --- |
| Statement | An entry point's pool for a future September is traced back through the schools holding those children now: counted from the census (full-time pupils from age 4; full- plus part-time at nursery ages) at the rung age E - (Y - P), births below age 4, ONS age-10 projections for 11+ only and off by default. Past pools (2020 to next September) are the age E-1 rung in the census a year before. Horizons: 10 years for 11+ and 16+; Reception to its last birth year (two more only with projections we don't hold). |
| Why | One mechanism for every entry point, honest about where each year's figure comes from. |
| Applies to | Admissions Pipelines |
| Enforced in | - src/lib/admissions/ladder.ts:buildLadder<br>- src/lib/admissions/pipeline.ts<br>- src/catalogue/notes.ts:ADMISSIONS_NOTES |
| Tagged at | - src/components/admissions/views/PipelineChart.tsx<br>- src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/blend.ts<br>- src/lib/admissions/entry-points.ts |
| Test case | The Chase (137625), ks4: 11+: the 2026 pool equals the 15 nearest state primaries' age-10 pupils in the 2025/26 census, recomputed from raw census rows; 2027 is the age-9 rung, counted; births take over at 2033; ten years in all. [runner: admLadder] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-BIRTH-SPLIT

| Field | Content |
| --- | --- |
| Statement | A school year runs September to August, so a pool from calendar-year births is 8/12 of year X plus 4/12 of year X-1 (X = entry year - entry age), in the LA blend; births have no sex split, so a girls' or boys' pool from births is 49% / 51% of it, labelled an estimate. |
| Why | Calendar births straddle two school cohorts. |
| Applies to | Admissions Pipelines (births rungs) |
| Enforced in | - src/lib/admissions/ladder.ts:academicBirths, birthsPoint |
| Tagged at | - src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/ladder.ts<br>- src/lib/admissions/screens.ts |
| Test case | Great Malvern Primary School (136984): 4+: the 2027 pool equals 8/12 of 2023's plus 4/12 of 2022's births in the blend, recomputed from raw ONS births. [runner: admBirthSplit] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-DRIFT-RANGE

| Field | Content |
| --- | --- |
| Statement | Beyond the counted rung a pool is a range, never a single point: the set's observed year-on-year cohort ratios 2019/20-2025/26 (schools with a census in both years only; within one kind of school; handovers between kinds measured on their own), their 10th-90th percentile applied for each year still to go, so the range widens with distance. |
| Why | Families move; the spread of what actually happened is the honest uncertainty. |
| Applies to | Admissions Pipelines |
| Enforced in | - src/lib/admissions/ladder.ts:driftFor, handoverFor, carry |
| Tagged at | - src/components/admissions/views/PipelineChart.tsx<br>- src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/ladder.ts |
| Test case | The Chase (137625), ks4: 16+: every future year has a low and a high, the relative width never narrows with distance, the drift is measured over 2019-2025 and the primary-to-secondary handover is scaled by its own observed ratio. [runner: admDriftRange] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-HOLD-SHARE

| Field | Content |
| --- | --- |
| Statement | The share needed to hold numbers steady is the school's entry-age cohort now divided by each future pool (its range from the pool's range); the current share is the latest year's. Worded as a requirement, not a forecast. |
| Why | A decision-useful figure that predicts nothing. |
| Applies to | Admissions Pipelines and Market share |
| Enforced in | - src/lib/admissions/shares.ts:holdShare<br>- src/catalogue/notes.ts:ADMISSIONS_NOTES.holdShare |
| Tagged at | - src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/shares.ts |
| Test case | The Chase (137625), ks4: 11+: the current share is The Chase's age-11 pupils in 2025/26 over the 2025 entry pool (the set's age-10 pupils in 2024/25), from raw rows; each future share is that cohort over the year's pool. [runner: admHoldShare] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-GROUP-SHARE

| Field | Content |
| --- | --- |
| Statement | Market share is the school's pupils at the entry age (or across its age band) as a share of the same ages across the rivals plus the school, per census year 2019/20-2025/26, with ranks within the set (ties share a rank). A share of this group, not of the local market. |
| Why | Matches the Data View's group share; says what it is a share of. |
| Applies to | Admissions Market share |
| Enforced in | - src/lib/admissions/shares.ts:groupShare<br>- src/lib/admissions/market.ts |
| Tagged at | - src/app/api/admissions/market-share/route.ts<br>- src/components/admissions/panels/MarketNow.tsx<br>- src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/market.ts<br>- src/lib/admissions/shares.ts |
| Test case | King's School, Worcester (117037), ks4: 11+: the shares across the 11 schools sum to 100% each year, and King's share equals its age-11 pupils over the group's, from raw rows. [runner: admGroupShare] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-JOINERS-ESTIMATE

| Field | Content |
| --- | --- |
| Statement | Following a cohort across census years per school: joiners at age a = max(0, cohort(a, t) - cohort(a-1, t-1)) and the leaving share at 16 = (cohort(15, t-1) - cohort(16, t)) / cohort(15, t-1), with at least 10 at 15. Both are estimates of NET movement and say so. The derived table school_cohort_flow (ingest) holds the same figures. |
| Why | The census counts cohorts, not joiners. |
| Applies to | Admissions (pipeline, fuzzy sets) |
| Enforced in | - src/lib/admissions/flow.ts:cohortFlow<br>- ingest: school_cohort_flow |
| Tagged at | - src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/flow.ts |
| Test case | The Chase (137625), ks4: The 2025/26 leaving share at 16 and joiners at 11 equal the same arithmetic on raw census rows. [runner: admJoiners] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-SHAPE-NOT-RANKED

| Field | Content |
| --- | --- |
| Statement | Size uses the school page's XS-XL badges by phase band (sizeBadgeForValue), never new words; shape is the shared classifier on the page's age-gender counts, and a set's local shape is the classifier on its summed profile. Shapes are described, never ranked. |
| Why | A shape is not better or worse. |
| Applies to | Admissions (shape and size) |
| Enforced in | - src/lib/admissions/shape.ts |
| Tagged at | - src/app/api/admissions/shape/route.ts<br>- src/components/admissions/views/ShapeAndSize.tsx<br>- src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/shape.ts<br>- src/lib/admissions/views-api.ts<br>- src/lib/smt/pupils.ts |
| Test case | The Chase (137625), ks4: The Chase's shape from the admissions code equals the school page's classification on the same counts. [runner: admShape] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-POOL-NOT-INTAKE

| Field | Content |
| --- | --- |
| Statement | Every admissions figure about the future is a pool (children who will reach the entry point), never an intake: no field, label or sentence claims who will come. The wording lives in ADMISSIONS_NOTES. |
| Why | Admissions can't know who will choose them; the pool is what the data can say. |
| Applies to | Admissions Pipelines |
| Enforced in | - src/catalogue/notes.ts:ADMISSIONS_NOTES.pool<br>- src/lib/admissions/ladder.ts |
| Tagged at | - src/lib/admissions-ladder.test.ts<br>- src/lib/admissions/ladder.ts |
| Test case | The Chase (137625), ks4: The pipeline's points carry a source (counted / births / projection) and no 'intake' field; the pool note says 'pool, not an intake'. [runner: admPoolNotIntake] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A1) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-RIVAL-RANKS

| Field | Content |
| --- | --- |
| Statement | Each rival (and the school) carries its national rank and its rank in its own region, on the whole-school headline for the entry point's stage (4+ KS2, 11+ GCSE Attainment 8, 16+ A-level points per entry), on each subject area (family average points, at least 10 entries), on a subject in view (0.6.6 subjectRanking) and on size (roll in the entry point's age band, with the school page's XS-XL badge). Every school with a figure that year, ties share. A school with no published results for the stage says so; at 11+ an IGCSE-heavy independent school is listed but not ranked. |
| Why | Where local schools sit regionally and nationally (Guy, 7 Oct 19:35). |
| Applies to | Admissions rivals |
| Enforced in | - src/lib/admissions/ranks.ts<br>- src/lib/admissions/rivals.ts |
| Tagged at | - src/components/admissions/views/Bars.tsx |
| Test case | The Chase (137625), ks4: The Chase's national and regional Attainment 8 ranks equal a count over the whole population's raw 2024 headline rows; the preps have no published results; Malvern St James (IGCSE) is listed but not ranked. [runner: admRivalRanks] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A4) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FLAG-MOMENTUM

| Field | Content |
| --- | --- |
| Statement | Rivals' momentum flags, each from a two-year change (pupils in %, results in points) against the NATIONAL thresholds for the phase (top / bottom fifth; admissions_flag_thresholds), never from one small cohort, with the figures behind it: results rising fast (headline), gaining pupils (roll), losing pupils three years running (three falls in a row), the entry year shrinking (Year 7 at 11+), a new sixth form (no pupils at 16 until two years ago), shape changed (the same new shape two years running). Until the thresholds are applied the threshold flags don't fire (none guessed). |
| Why | A change that is large and lasting, set nationally and tuned later (Guy, 7 Oct 19:40). |
| Applies to | Admissions rivals |
| Enforced in | - src/lib/admissions/flags.ts<br>- src/lib/admissions/rivals.ts<br>- src/lib/admissions/thresholds.ts<br>- ingest: admissions_flag_thresholds |
| Tagged at | - src/components/admissions/views/Momentum.tsx<br>- src/lib/admissions-flags.test.ts |
| Test case | The Chase (137625), ks4: Each flag fires exactly when its figures cross the national threshold: recomputed from raw rows for The Chase's rivals. [runner: admMomentum] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A4) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FLAG-STRENGTHS

| Field | Content |
| --- | --- |
| Statement | By subject area, the school's rank among the rivals that have that area (at least 10 entries), the gap to their average and its change since 2022/23: Strength (top third, above the average), Strength growing (and the school's own two-year change in the national top fifth), Weakness (bottom third, below), Weakness widening (and in the national bottom fifth). Never against fewer than two rivals. |
| Why | Strengths and weaknesses against rivals (Guy, 7 Oct 19:32). |
| Applies to | Admissions rivals |
| Enforced in | - src/lib/admissions/flags.ts<br>- src/lib/admissions/rivals.ts<br>- src/lib/admissions/thresholds.ts<br>- ingest: admissions_flag_thresholds |
| Tagged at | - src/components/admissions/panels/Academic.tsx<br>- src/components/admissions/views/Strengths.tsx<br>- src/components/smt/views/Areas.tsx<br>- src/lib/admissions-flags.test.ts |
| Test case | The Chase (137625), ks4: Each area's rank and gap equal the raw family rows' arithmetic for The Chase and its rivals; flags follow the rule. [runner: admStrengths] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A4) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-SEX-FILTER

| Field | Content |
| --- | --- |
| Statement | Every Admissions panel either applies the girls/boys filter fully -- every pupil figure it draws is girls' or boys' -- or, while the filter is on, says 'Not split by sex'. Never part of a panel: Pool trends hides its LA and England lines (never split) and says so; momentum and flags, which set pupils against results, stay whole and say so. ADM_SEX_FILTER lists every view. |
| Why | The audit (0.8 SMT r4, A9) found the filter applied to some figures on a panel and not others, unsaid. |
| Applies to | Every DV-ADM view |
| Enforced in | - src/catalogue/admissions.ts:ADM_SEX_FILTER<br>- src/components/admissions/AdmissionsDashboard.tsx:withSexNote<br>- src/lib/admissions/screens.ts:entryNow, feederTable, rivalExtras, rollOf<br>- src/lib/admissions/feeders.ts:feederFlags<br>- src/lib/admissions/views-api.ts |
| Tagged at | - src/components/admissions/AdmissionsDashboard.tsx |
| Test case | The Chase (137625), ks4: Every DV-ADM view is in ADM_SEX_FILTER; with girls chosen the entry tiles' cohort equals the girls figure and the roll is girls only, the entry trend is girls each year, the feeder pupils and the rivals' rolls are girls only; momentum's change is the same either way; the not-split note and Pool trends' hidden lines are wired. [runner: admSexFilter] |
| Origin | 0.8 audit fixes, item 6 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FLAG-FEEDER

| Field | Content |
| --- | --- |
| Statement | A feeder whose pupils at one age -- the age below entry (Year 6 at 11+; Reception's schools at 4+) -- fell more than the area's (the whole feeder set, at that age) by at least 5 points over two years is a red flag; rising or stable numbers (no worse than -2%) mark a school to focus on. Never from a cohort under the minimum. (Guy's call, 0.8 audit fixes 8, A6: one age; the feeder table, the map and the pipeline chart's flags all read that age, on the set without the school.) |
| Why | Pipeline schools to watch and to court. |
| Applies to | Admissions Pipelines |
| Enforced in | - src/lib/admissions/feeders.ts<br>- src/lib/admissions/flags.ts:feederFlag |
| Tagged at | - src/components/admissions/views/Tables.tsx<br>- src/lib/admissions-flags.test.ts<br>- src/lib/admissions/feeders.ts<br>- src/lib/admissions/screens.ts<br>- src/lib/admissions/views-api.ts |
| Test case | The Chase (137625), ks4: The Chase's 11+ feeders' flags equal the rule applied to their raw census counts. [runner: admFeeders] |
| Origin | 0.7 admissions r1 (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_claude_code_prompt_v1.md, A4) |
| Status | active |
| Must lift | — |
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

### R-YEARS-ROLLOVER

| Field | Content |
| --- | --- |
| Statement | A rule whose expected value moves with the latest results year reads that year from src/catalogue/years.ts (filled from academic_current_periods) and its value from scripts/rule-year-fixtures.ts, one row per year; or asserts a relationship with the year instead. When a new year arrives with no row, the rule fails saying 'no expected value for 2026/27', never with a wrong number; a release adds a row. |
| Why | GCSE 2025/26's promote broke five rules whose expected values were written for 2024/25 (0.8 audit fixes, 10). |
| Applies to | R-TREND-LINE-4YR, R-THRESHOLD-PERIODS, R-TREND-TABLE-YEARS, R-CURRENT-GRADES-FROM-2324, R-SMT-FLAGS |
| Enforced in | - scripts/rule-year-fixtures.ts<br>- scripts/catalogue-rule-tests.ts:latestYearOf |
| Tagged at | — |
| Test case | The Chase; Acland Burghley 100053 (137625), ks4: With the latest KS4 year moved to 2026/27 (the data unchanged), each of the five rules passes or fails with 'no expected value for 2026/27'; none fails on a number. [runner: yearsRollover] |
| Origin | 0.8 audit fixes, item 10 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-RANK-TIES

| Field | Content |
| --- | --- |
| Statement | Ties share a rank; the next rank skips; a null is unranked. A ranking's place reads '=3rd' where the school shares it (headline and subject rankings, and the whole-school tile). |
| Why | Standard competition ranking; a missing figure is not a position. 0.8 audit fixes (8, T2): headline rankings numbered by position, so tied schools didn't share a place. |
| Applies to | Every rank |
| Enforced in | - src/lib/teacher-view-panels.ts:rankByValue<br>- src/lib/chooser-sets.ts:resolveRankingSet<br>- src/lib/subject-ranking.ts:subjectRanking (targetTied)<br>- src/lib/view-series/tiles.ts:placeWord |
| Tagged at | - src/lib/admissions/ranks.ts<br>- src/lib/admissions/stats.ts<br>- src/lib/rank.test.ts<br>- src/lib/rank.ts<br>- src/lib/teacher-view-panels.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/tiles.ts |
| Test case | The Chase (137625), ks4: Nationally on Attainment 8 (one decimal, so ties are common) the place is 1 + the schools above, shared with every school on the same figure, and reads '=Nth' when shared; placeWord(3, true) is '=3rd'. [runner: rankTies] |
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
| Tagged at | - src/lib/teacher-view-panels.ts<br>- src/lib/trend-base.test.ts |
| Test case | — |
| Origin | Teacher view wireframe |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | - 0.6.2 S4b: on a grade or points measure the word is measured from 2022/23 (R-TREND-FROM-2223), where the chart draws 2021/22. |

### R-NUMBER-TYPE-HONESTY

| Field | Content |
| --- | --- |
| Statement | A measure is shown only in its honest number types (catalogue §3): counts as totals, % change, share or index; averages as points and change in points; rates as rate and change in percentage points. |
| Why | A % change of an average or a rate misleads: 60% -> 66% is +6pp, not +10%. |
| Applies to | Every view on M-*-POINTS, M-*-THRESHOLD, M-*-BANDS, M-*-HEADLINE |
| Enforced in | - src/catalogue/measures.ts (numberTypes)<br>- src/catalogue/matching.ts (offer filter, via dataview supports.numberType)<br>- src/lib/teacher-view-panels.ts:ChangeKind, Measure.changeKind, changeOf, formatChange, changeMagnitude, changeTitle, changeInTitle, trendSentence<br>- src/components/teacher/SeriesViews.tsx:YearTable (Change column, ranked by the honest change)<br>- src/components/teacher/ChangeChart.tsx (format, axis units)<br>- src/components/teacher/SubjectPanels.tsx:change half (ChangeList, titles, summary, headline)<br>- src/components/teacher/ComparisonsPanels.tsx:change half (ChangeList, change map trend vs trend_absolute, titles, summary, headline) |
| Tagged at | - src/components/teacher/ChangeChart.tsx<br>- src/components/teacher/ComparisonsPanels.tsx<br>- src/components/teacher/SeriesViews.tsx<br>- src/components/teacher/SubjectPanels.tsx<br>- src/lib/subject-ranking.test.ts<br>- src/lib/subject-ranking.ts<br>- src/lib/teacher-map.ts<br>- src/lib/teacher-view-panels.ts<br>- src/lib/view-series.test.ts<br>- src/lib/view-series/map.ts<br>- src/lib/view-series/ranking.ts |
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

### R-ADM-FAMILY-PUPILS

| Field | Content |
| --- | --- |
| Statement | Pupils by age is the census count at one age (full-time from 4, plus part-time at 2-3), per school and census year, and the entry point now reads the school's own count at the entry age, split by sex, against 2019/20. |
| Why | One definition of a cohort across every Admissions view. |
| Applies to | Admissions family: Pupils by age (M-ADM-PUPILS) |
| Enforced in | - src/lib/admissions/screens.ts:entryNow<br>- src/lib/admissions/cohort.ts:cohortAt |
| Tagged at | — |
| Test case | The Chase (137625), ks4: Year 7 now = the raw census's full-time 11-year-olds (124 girls + 112 boys = 236); since 2019/20 from 208. [runner: admFamilyPupils] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FAMILY-PIPELINE

| Field | Content |
| --- | --- |
| Statement | The Pipeline family is round 1's pipeline unchanged: with no filter, the screens' answer carries exactly buildPipeline's ladder, share needed, sets and blend; the screens only add what they draw. |
| Why | Round 2 draws round 1's figures; it never recomputes them. |
| Applies to | Admissions family: Pipeline (M-ADM-POOL) |
| Enforced in | - src/lib/admissions/views-api.ts:pipelineView |
| Tagged at | — |
| Test case | The Chase (137625), ks4: pipelineView's ladder, hold, change, sets and blend equal buildPipeline's for 11+. [runner: admFamilyPipeline] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FAMILY-MARKET

| Field | Content |
| --- | --- |
| Statement | The Market share family is round 1's group share unchanged: with no filter the screens' answer carries buildMarketShare's rows and totals; the extras (whole roll and its rank, change since 2022/23) are the census's own figures. |
| Why | A share of this group, computed once. |
| Applies to | Admissions family: Market share (M-ADM-MARKET) |
| Enforced in | - src/lib/admissions/views-api.ts:marketView<br>- src/lib/admissions/screens.ts:rivalExtras |
| Tagged at | — |
| Test case | King's Worcester (117037), ks4: marketView's entry-age rows equal buildMarketShare's; King's 2025/26 share 6.60% of 1,531. [runner: admFamilyMarket] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FAMILY-RIVALS

| Field | Content |
| --- | --- |
| Statement | Rivals' results is round 1's rivals unchanged, plus each school's whole-school headline change since 2022/23 in points, from the same headline population the flags read; an IGCSE school, listed but not ranked, has none. |
| Why | The momentum scatter's y must be the figure the flags were judged on. |
| Applies to | Admissions family: Rivals' results (M-ADM-RIVAL-RESULTS) |
| Enforced in | - src/lib/admissions/views-api.ts:rivalsView |
| Tagged at | — |
| Test case | The Chase (137625), ks4: The Chase's results change = its 2024 Attainment 8 minus its 2022 (raw headline rows); IGCSE rivals null. [runner: admFamilyRivals] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-NOW

| Field | Content |
| --- | --- |
| Statement | The entry point now shows the school's own entry cohort, its change since 2019/20, girls and boys at the entry age, and day and boarding for the whole school (the census has no boarders by age; a day school's tile reads Day only, 0.7 r3 F2); size is the school page's Roll by phase (XS-XL), never new words. |
| Why | Tiles a reader can check against the census. |
| Applies to | DV-ADM-P-NOW, DV-ADM-M-NOW |
| Enforced in | - src/components/admissions/panels/EntryNow.tsx<br>- src/lib/admissions/screens.ts:entryNow |
| Tagged at | - src/components/admissions/panels/EntryNow.tsx |
| Test case | The Chase (137625), ks4: girls + boys = cohort; boarders = the census's boarders_total; day = roll - boarders. [runner: admViewNow] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-PIPELINE

| Field | Content |
| --- | --- |
| Statement | The pipeline chart draws past pools, then counted years solid, births dashed with their range band, and projection only on request (11+), with every label from ADMISSIONS_NOTES. The styling and wording have no look option. |
| Why | Certainty must be visible and can't be edited away. |
| Applies to | DV-ADM-P-PIPELINE |
| Enforced in | - src/components/admissions/views/PipelineChart.tsx<br>- src/catalogue/admissions.ts:PipelineLook |
| Tagged at | - src/components/admissions/views/PipelineChart.tsx |
| Test case | The Chase (137625), ks4: Every future year's source is counted, births or projection; no projection unless asked; the chart reads its labels from ADMISSIONS_NOTES. [runner: admViewPipeline] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-FUNNEL

| Field | Content |
| --- | --- |
| Statement | The funnel follows this September's entrants back, like with like: the area's births for their school year (8/12 + 4/12), every pupil a year below the entry age in every mainstream school in the SAME area a year before (age_profile_aggregates), then the school's own entry cohort. Each bar leads with a bold label, then its area and year in plain words (ADMISSIONS_NOTES); the panel's note says it is not a flow of the same children. No funnel at 4+ (0.7 r3, F7). |
| Why | Births, pools and an entry cohort are different counts. |
| Applies to | DV-ADM-P-FUNNEL |
| Enforced in | - src/lib/admissions/screens.ts:funnel<br>- src/components/admissions/views/Funnel.tsx |
| Tagged at | - src/components/admissions/views/Funnel.tsx<br>- src/lib/admissions/screens.ts |
| Test case | The Chase (137625), ks4: Births = 8/12 of 2014 + 4/12 of 2013 in Worcestershire; Year 6 = Worcestershire's age-10 pupils in 2024/25 (age_profile_aggregates); entry = 236; three bars, labelled Births / Year 6 / Your Year 7; 4+ has none. [runner: admViewFunnel] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-FEEDERS

| Field | Content |
| --- | --- |
| Statement | The feeder table and map list the nearest rung's schools with their pupils at that age now and two years ago, each flagged by R-ADM-FLAG-FEEDER against the whole set, with distance, sector, gender and XS-XL; the school itself is not a feeder. |
| Why | The same flag everywhere a feeder appears. |
| Applies to | DV-ADM-P-TABLE, DV-ADM-P-MAP, setup's lists |
| Enforced in | - src/lib/admissions/screens.ts:feederTable<br>- src/app/api/admissions/candidates/route.ts |
| Tagged at | - src/components/admissions/views/Tables.tsx |
| Test case | The Chase (137625), ks4: Each row's flag equals feederFlags on the raw census at age 10; the area change = (382 - 363) / 363. [runner: admViewFeeders] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-SHAPES

| Field | Content |
| --- | --- |
| Statement | Shape and size shows the school's profile by gender, the feeders' local shape and the rivals' shapes as small multiples in the rival set's own order, with no rank, score or sort by shape. |
| Why | Shapes are described, never ranked. |
| Applies to | DV-ADM-P-SHAPE, DV-ADM-M-SHAPE |
| Enforced in | - src/lib/admissions/views-api.ts:shapeView<br>- src/components/admissions/views/ShapeAndSize.tsx |
| Tagged at | - src/components/admissions/views/ShapeAndSize.tsx |
| Test case | The Chase (137625), ks4: The rivals come back in the rival set's order and carry no rank field. [runner: admViewShapes] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-TRENDS

| Field | Content |
| --- | --- |
| Statement | Pool trends index the feeders' past pools and the same age across the LA and England (age_profile_aggregates: LA rows, England the sum of the nine regions) to their first common year; a year the aggregates don't hold is a gap, never filled. |
| Why | An index needs the same years on every line. |
| Applies to | DV-ADM-P-POOL-INDEXED, DV-ADM-P-POOL-TABLE, DV-ADM-P-ENTRY-*, DV-ADM-M-VS-* |
| Enforced in | - src/lib/admissions/screens.ts:poolTrends<br>- src/components/admissions/views/Lines.tsx |
| Tagged at | - src/components/admissions/views/Lines.tsx |
| Test case | The Chase (137625), ks4: Feeders = the ladder's counted past pools; the LA's 2025 value = age_profile_aggregates Worcestershire age 10; past area years are flagged for the undercount note, and England in the first of them is the sum of the nine regions. [runner: admViewTrends] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-MARKET

| Field | Content |
| --- | --- |
| Statement | Market views are shares of this group: each school's pupils at the entry age over the group's total, summing to 100% in a year; ranks within the set; the whole-school rank is by total roll. |
| Why | Not a share of the local market. |
| Applies to | DV-ADM-M-* |
| Enforced in | - src/lib/admissions/views-api.ts:marketView |
| Tagged at | - src/components/admissions/panels/MarketNow.tsx |
| Test case | King's Worcester (117037), ks4: The latest year's shares sum to 100%; King's whole-school rank equals its place by roll among the 11. [runner: admViewMarket] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-MOMENTUM

| Field | Content |
| --- | --- |
| Statement | The momentum scatter plots each rival's change at the entry age (census, %, over 3 census years: R-ROLL-WORDS-3YR) against its whole-school headline change (points, since 2022/23); flags come only from the national thresholds, and with none loaded the view says flags are not available yet. |
| Why | Never a guessed flag. |
| Applies to | DV-ADM-M-MOMENTUM |
| Enforced in | - src/components/admissions/views/Momentum.tsx<br>- src/lib/admissions/views-api.ts:rivalsView |
| Tagged at | - src/components/admissions/views/Momentum.tsx |
| Test case | The Chase (137625), ks4: Each rival's x and y equal the raw census and headline changes; with thresholds absent no momentum flag is returned. [runner: admViewMomentum] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-STRENGTHS

| Field | Content |
| --- | --- |
| Statement | Strengths and weaknesses rank the school only among rivals with that subject area (and at least the minimum entries), show the gap to their average and its move since 2022/23, and flag Strength / Weakness by the top or bottom third (R-ADM-FLAG-STRENGTHS). |
| Why | Only like-for-like comparisons. |
| Applies to | DV-ADM-M-STRENGTHS, DV-ADM-M-ACAD-* |
| Enforced in | - src/lib/admissions/rivals.ts:buildRivals<br>- src/components/admissions/views/Strengths.tsx |
| Tagged at | - src/components/admissions/views/Strengths.tsx |
| Test case | The Chase (137625), ks4: Every Strength has a positive gap and a rank in the top third; every Weakness the opposite. [runner: admViewStrengths] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-FLAGS

| Field | Content |
| --- | --- |
| Statement | A flag list shows each rival's momentum flags with the figures behind each one on hover, never a flag without its figures. |
| Why | Every flag must be checkable. |
| Applies to | DV-ADM-M-FLAGS, DV-ADM-M-MOMENTUM |
| Enforced in | - src/components/admissions/views/Momentum.tsx |
| Tagged at | - src/components/admissions/ui.tsx<br>- src/components/admissions/views/Momentum.tsx |
| Test case | King's Worcester (117037), ks4: Every flag returned has an id from FLAG ids and non-empty figures. [runner: admViewFlags] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-VIEW-ACADEMIC

| Field | Content |
| --- | --- |
| Statement | The academic panel follows the entry point: 4+ reads KS2, 11+ GCSE, 16+ Post-16; a rival with no published results or an IGCSE-heavy one is listed and not ranked, with the reason. |
| Why | Rivals at 4+ are mostly preps that don't sit SATs: say so. |
| Applies to | DV-ADM-M-ACAD-* |
| Enforced in | - src/lib/admissions/rivals.ts:stageForEntry<br>- src/components/admissions/panels/Academic.tsx |
| Tagged at | - src/components/admissions/panels/Academic.tsx |
| Test case | King's Worcester (117037), ks5: stageForEntry(4, 11, 16) = ks2, ks4, ks5; King's 16+ rivals read Post-16. [runner: admViewAcademic] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FE-SOURCE

| Field | Content |
| --- | --- |
| Statement | An FE college's own figures come from FE participation data (ILR, learners under 19 over the year), labelled as that source, and are never divided into a census group's total, ranked against schools or shown as a Year 12 count. |
| Why | Two sources measuring different things must not be blended. |
| Applies to | Admissions for FE colleges (decision 6) |
| Enforced in | - src/lib/admissions/screens.ts:feParticipation |
| Tagged at | — |
| Test case | Croydon College (130432), ks5: Croydon's market view has an ILR series labelled FE participation data, and no census count or share of its own. [runner: admFeSource] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FILTERS

| Field | Content |
| --- | --- |
| Statement | The top bar's filters (Day + boarding, State + independent, boarding rivals) narrow the sets on the server before round 1's maths runs; unfiltered, every answer is round 1's. A filter that leaves a list empty says so; another list never stands in for it. Day + boarding is a boarding school's filter only: for a day school it is never drawn and the server ignores it (R-ADM-BOARDING-ONLY-WHERE-BOARDERS). |
| Why | The figures change only by the schools they count. |
| Applies to | Admissions top bar |
| Enforced in | - src/lib/admissions/traits.ts:narrow<br>- src/lib/admissions/rival-set.ts:rivalSet<br>- src/lib/admissions/views-api.ts:pipelineView |
| Tagged at | — |
| Test case | The Chase (137625), ks4: sector=independent leaves only independent schools (and the school's own Year 11 at 16+); for a boarding school (Beaudesert Park 115786) boarding-only with no boarding list returns the empty state; for The Chase (a day school) it is ignored. [runner: admFilters] |
| Origin | 0.7 admissions r2 (docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md, D7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-BOARDING-ONLY-WHERE-BOARDERS

| Field | Content |
| --- | --- |
| Statement | A boarding school is one GIAS lists with boarding provision (schools.boarders_name = "Boarding school"; "No boarders" and "Not applicable" are day schools). A day school never has to think about boarders: no tile, filter, chip, column, legend, empty state, note, setup question or step, or editor compare option mentions boarding (column 1's day/boarding tile stays, reading Day only), its saved boarding lists are kept but not used, and the server ignores a boarding filter for it. Its rivals' own figures may still say they board. A boarding school sees every boarding surface: setup's day-and-boarding question and step 3, the filter, the tile's day and boarding, the boarding feeder list and its fuzzy set. |
| Why | "Non-boarding schools must not have to think about boarders, but boarding schools must" (Guy, 12 Oct 2026). |
| Applies to | Admissions: every view, the top bar, setup, the editor's compare options |
| Enforced in | - src/lib/admissions/boarding.ts:isBoardingSchool<br>- src/lib/admissions/views-api.ts:pipelineView<br>- src/components/admissions/AdmissionsDashboard.tsx<br>- src/components/admissions/setup/Setup.tsx<br>- src/components/view-editor/AdmissionsSteps.tsx |
| Tagged at | - src/components/admissions/AdmissionsDashboard.tsx<br>- src/lib/admissions/boarding.ts |
| Test case | The Chase, Nunnery Wood High (137051), Beaudesert Park (115786) (137625), ks4: Every Pipelines view, column 1, the top bar's filters and every setup step rendered on real data: no boarding text or control for The Chase (11+, 16+) or Nunnery Wood (11+); every boarding surface present for Beaudesert Park (4+, 11+), whose boarding feeder search returns preps with boarders that make a non-empty boarding-only pool. The editor's 1 · Data for every feeder view offers the feeder set (Boarding feeders) for Beaudesert Park only (0.7 editor s2); a day school's previews ignore a boarding feeder spec (R-ADM-EDITOR-LOOKS-KEEP-NOTES). [runner: admBoardingOnly] |
| Origin | 0.7 admissions r3 (docs/v0.7/vicdata_0_7_admissions_round3_teacher_parity_claude_code_prompt_v1.md, F2) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-FUNNEL-SAME-AREA

| Field | Content |
| --- | --- |
| Statement | The funnel's births and its pool bar cover the same area with the same weights: the school's own LA, or the lead's LA blend when one is set. The pool is every pupil a year below the entry age (Year 6 = age 10, Year 11 = age 15, at 31 August, the census a year before entry -- the ladder's own age mapping) in every mainstream school in that area: academies, LA-maintained, free and independent (age_profile_aggregates, scope la). The feeder set's pool is not a funnel bar; it stays in the Pipeline. |
| Why | "This is great but needs like with like" (Guy, 12 Oct 2026): births in one area against a hand-picked set's pupils compared two different areas. |
| Applies to | DV-ADM-P-FUNNEL |
| Enforced in | - src/lib/admissions/screens.ts:funnel, funnelArea<br>- src/components/admissions/views/Funnel.tsx |
| Tagged at | - src/components/admissions/views/Funnel.tsx<br>- src/lib/admissions/screens.ts |
| Test case | The Chase (11+, 16+), King's Worcester 117037 (11+) (137625), ks4: The births and pool bars carry the same LA set and weights (the school's own LA); births recomputed from raw ONS births, the pool from raw age_profile_aggregates rows at age 10 (or 15) in 2024/25. [runner: admFunnelSameArea] |
| Origin | 0.7 admissions r3 (docs/v0.7/vicdata_0_7_admissions_round3_teacher_parity_claude_code_prompt_v1.md, F7) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-ADM-EDITOR-LOOKS-KEEP-NOTES

| Field | Content |
| --- | --- |
| Statement | An Admissions view's look options and compare chips change how it draws, never what it must say: under every look and compare an editor can choose (src/catalogue/admissions-editor.ts), each view still renders every R-ADM wording from ADMISSIONS_NOTES that its preset renders (a pool, not an intake; a share of this group; the estimates; the requirement; the flags' rules; the undercount), and its rule-held styling and thresholds don't move. Options left at their defaults draw exactly the preset. A day school's view never draws a boarding feeder set, whatever its spec asks. |
| Why | The editor may change a view's look, not its honesty (ADMISSIONS_FIXED; Guy's decision on the editor plan, 12 Oct 2026: a look option must never switch a note off). |
| Applies to | Every Admissions view, through the editor's looks and compare chips |
| Enforced in | - src/catalogue/admissions-editor.ts:ADMISSIONS_LOOKS, ADMISSIONS_VIEW_COMPARE<br>- src/components/admissions/AdmissionsDashboard.tsx:viewBody, InstanceBody |
| Tagged at | - src/components/admissions/AdmissionsDashboard.tsx<br>- src/components/admissions/views/charts.tsx |
| Test case | The Chase (11+, 16+), King's Worcester 117037 (11+), Beaudesert Park 115786 (11+) (137625), ks4: Every view of both dashboards and the flag list, rendered on real data under each look and compare value in turn: the ADMISSIONS_NOTES wording the preset renders is all still there; with every option at its default the render is the preset's, byte for byte; a day school asked for boarding feeders draws its preset, with no boarding words. [runner: admEditorLooks] |
| Origin | 0.7 admissions editor stages 1-2 (docs/v0.7/vicdata_0_7_admissions_editor_stages1_2_claude_code_prompt_v1.md, S2.6) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-DOUBLE-AWARD-POINTS

| Field | Content |
| --- | --- |
| Statement | A GCSE Double Award (grades published as pairs, "98" ... "11") is scored on DfE's convention: two entries, each worth the average of its two grades (98 -> 8.5, U -> 0). The subject's average points and its ranks (in a set and in England) come from its own grade rows wherever the subject rollup holds no average for it; a scale that mixes pairs with anything else is never scored. Other qualifications on their own scale (an FSMQ's A-E, a BTEC's Distinction-Pass) get no GCSE points and say "different grading scale, not ranked". |
| Why | The subject rollup scores single GCSE grades only, so Combined Science -- often a school's largest science entry -- read no average and was never ranked, in Teacher and SMT alike (SMT round 1 snag). |
| Applies to | Teacher's subject points and rankings at GCSE, Column 1 included (0.8 audit fixes, 2); SMT's Subjects (DV-SMT-A-SUBJECTS) |
| Enforced in | - src/lib/subject-grades.ts:doubleAwardPoints<br>- src/lib/academic-data-view.ts:fillDoubleAwardPoints<br>- src/lib/subject-ranking.ts:subjectRanking, figuresFor, rankByFunction<br>- src/lib/teacher-view-measures.ts:carriesOwnPoints |
| Tagged at | - src/lib/smt/smt.test.ts |
| Test case | The Chase; Acland Burghley 100053; Nunnery Wood 137051 (137625), ks4, Combined Science: Each school's Combined Science 2024/25 average equals the mean of its pair grades recomputed from the raw grade rows (each pair's two digits averaged, weighted by entries); the subject is ranked in its set and in England; Teacher's Column 1 shows the same latest and yearly average for the Double Award item, and a BTEC in the subject borrows none. [runner: doubleAwardPoints] |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-PUPILS-LEVEL

| Field | Content |
| --- | --- |
| Statement | Pupils follows the level chips by the ages it highlights: GCSE Years 7 to 11 (ages 11-15), Post-16 Years 12 and 13 (16-17), Primary Reception to Year 6 (4-10), first and last age inclusive; Whole school highlights nothing. The figures don't change with the level; the year groups in focus do. |
| Why | The level is the dashboard's focus, as the subject is Teacher's (spec §2.2). |
| Applies to | DV-SMT-P-SHAPE, DV-SMT-P-NOW |
| Enforced in | - src/lib/smt/pupils.ts:LEVEL_AGES<br>- src/components/smt/views/Pupils.tsx:ShapeAndSize |
| Tagged at | - src/components/smt/views/Pupils.tsx<br>- src/lib/smt/levels.ts<br>- src/lib/smt/pupils.ts |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: The Chase at GCSE: exactly Y7-Y11 highlighted (ages 11-15), not Y6 or Y12; at Post-16 exactly Y12-Y13; Whole school none. [runner: smtPupilsLevel] |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-PUPILS-NOW

| Field | Content |
| --- | --- |
| Statement | Your pupils now shows the census's roll and its change since 2019/20, girls and boys (mixed schools only), day and boarding (boarding schools only), Year 12 against Year 11 (Year 12 now against Year 11 a year before, where the school has both), the school page's XS-XL by phase and the LA context line. |
| Why | Tiles a reader can check against the census; the boarding-only and mixed-only rule as everywhere else. |
| Applies to | DV-SMT-P-NOW |
| Enforced in | - src/lib/smt/pupils.ts:buildPupils, stayingOnAt<br>- src/components/smt/views/Pupils.tsx:PupilsNow |
| Tagged at | - src/components/smt/views/Pupils.tsx |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: The Chase: roll and Year 12 against Year 11 recomputed from the census (Year 12 2025/26 against Year 11 2024/25); no boarding tile. Leighton Park: the boarding tile. [runner: smtPupilsNow] |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-Y12-AGAINST-Y11

| Field | Content |
| --- | --- |
| Statement | The Year 11 to Year 12 figure is called "Year 12 against Year 11" wherever it appears (Your pupils now, the set's figure in Shape and size, the Leaving at 16 table), never "staying on", with SMT_NOTES.y12AgainstY11 as its caption; it compares the same cohort, Year 11 in year t-1 with Year 12 in year t. |
| Why | A sixth form that recruits shows more than 100% (Leighton Park 103%), which "staying on" can't mean (0.8 groups r1, G0). |
| Applies to | DV-SMT-P-NOW, DV-SMT-P-SHAPE, DV-SMT-P-LEAVING |
| Enforced in | - src/catalogue/notes.ts:SMT_NOTES.y12Label, y12AgainstY11<br>- src/lib/smt/pupils.ts:stayingOnAt<br>- src/components/smt/views/Pupils.tsx |
| Tagged at | — |
| Test case | Leighton Park; The Chase 137625 (110110), ks4: Each of the three views shows SMT_NOTES.y12Label and none says "staying on"; the tile's caption is SMT_NOTES.y12AgainstY11; Leighton Park's figure is above 100% and equals census age 16 in P over age 15 in P-1. [runner: smtY12AgainstY11] |
| Origin | 0.8 groups round 1, G0 (docs/v0.8/vicdata_0_8_groups_round1_accounts_access_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-SHAPE

| Field | Content |
| --- | --- |
| Statement | Shape and size draws pupils in each year group, the shape and since when, and the shapes around (the LA's schools of the same age range, the comparison set's shapes, Year 12 against Year 11 in the set's sixth forms) -- described, never ranked. |
| Why | R-ADM-SHAPE-NOT-RANKED: shapes are neither better nor worse. |
| Applies to | DV-SMT-P-SHAPE |
| Enforced in | - src/lib/smt/pupils.ts:buildPupils<br>- src/components/smt/views/Pupils.tsx:ShapeAndSize |
| Tagged at | - src/components/smt/views/Pupils.tsx |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: The Chase: year groups equal the census by age; the shape is the shared classifier's; no rank appears in the view. [runner: smtShape] |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-ADMISSIONS-READ-ONLY

| Field | Content |
| --- | --- |
| Statement | Views from Admissions (entry points at a glance, the pool, market share) are read-only in SMT: no setup, no list editing, each with Open in Admissions; where Admissions has no entry points or no saved rivals, an empty state says why. |
| Why | Admissions owns its lists; SMT reads them (spec §2.4). |
| Applies to | DV-SMT-P-ENTRIES, DV-SMT-P-POOL, DV-SMT-P-MARKET, DV-SMT-O-MARKET-* |
| Enforced in | - src/lib/smt/pupils.ts:buildPupils<br>- src/lib/smt/overview.ts:marketAt11<br>- src/components/smt/views/Pupils.tsx:EntryPoints |
| Tagged at | - src/components/smt/views/Pupils.tsx |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: With no entry points readable, Entry points says SMT_NOTES.entryPointsNone and links to Admissions; no edit control is drawn; the pool is Admissions' own ladder. [runner: smtAdmissionsReadOnly] |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-LEAVING

| Field | Content |
| --- | --- |
| Statement | Leaving at 16 follows Year 11 to Year 12 at the school year by year (the census a year apart): Year 12 against Year 11 and the net leavers, worded as Admissions' estimate (ADMISSIONS_NOTES.leaving16). |
| Why | An estimate of net leavers, not a count of who left. |
| Applies to | DV-SMT-P-LEAVING |
| Enforced in | - src/lib/smt/pupils.ts:buildPupils |
| Tagged at | - src/components/smt/views/Pupils.tsx |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: The Chase: each year's Year 11 and Year 12 equal the census at ages 15 and 16 a year apart. [runner: smtLeaving] |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-CONTEXT-PLACE

| Field | Content |
| --- | --- |
| Statement | Context's place line (town · LA · region) drops any part that names the same place as the part before it, compared case-insensitively and ignoring "City of" / "Borough of" (prefix, or GIAS's ", City of" suffix). |
| Why | Leighton Park read "Reading · Reading · South East" (SMT r3 snags, fix 1). |
| Applies to | DV-SMT-C-NOW |
| Enforced in | - src/lib/place-line.ts:placeLine<br>- src/components/smt/views/Context.tsx:ContextNow |
| Tagged at | - src/lib/smt/smt.test.ts |
| Test case | Leighton Park; The Chase 137625; Acland Burghley 100053 (110110), ks4: Leighton Park shows "Reading · South East"; The Chase "Malvern · Worcestershire · West Midlands" and Acland Burghley "London · Camden · London", unchanged. [runner: smtContextPlace] |
| Origin | 0.8 SMT r3 snags (2026-10-15) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-CONTEXT-PROJECTION-JOIN

| Field | Content |
| --- | --- |
| Statement | Context's school-age population draws both sources as published: ONS mid-year estimates, then ONS's projection from its own figure for the latest estimate year. Where the two differ there by more than SMT_PROJECTION_JOIN_GAP_PCT (2%) of the estimate, the panel's source (i) adds SMT_NOTES.projectionJoin ("The projection starts from ONS's {base} base, not the latest estimate, so the two lines may not meet."); otherwise it says nothing. |
| Why | Camden and Wandsworth at 11-18 show a visible step (SMT r3 snags, fix 3). |
| Applies to | DV-SMT-C-PROJECTION |
| Enforced in | - src/lib/smt/context.ts:buildContext (population.join)<br>- src/components/smt/SmtDashboard.tsx:sourceOf<br>- src/catalogue/years.ts:SMT_PROJECTION_JOIN_GAP_PCT |
| Tagged at | - src/components/smt/SmtDashboard.tsx |
| Test case | Acland Burghley (Camden); The Chase 137625 (Worcestershire) (100053), ks4: Ages 11-18: Camden's gap, recomputed from ons_population_age and ons_snpp, is over 2% and the note shows; Worcestershire's gap is recomputed the same way and the note shows exactly when it is over 2%. [manual] |
| Origin | 0.8 SMT r3 snags (2026-10-15) |
| Status | superseded by R-SMT-FORWARD |
| Must lift | — |
| Open issue | — |
| Fixed | - 0.8 SMT r4 (F2): the forward view's projection starts from the latest count, so estimates and line always meet; ONS's projection is a faint comparison line. The note (SMT_NOTES.projectionJoin) and SMT_PROJECTION_JOIN_GAP_PCT are removed. |

### R-SMT-CONTEXT-RESIDENTS

| Field | Content |
| --- | --- |
| Statement | Context's children within the school's catchment radius are ONS residents (area_context: LSOAs whose population-weighted centroid is within the radius, the latest mid-year held; at 5 miles exactly school_context_lookup's figures), summed over the level's single ages (GCSE 11-15, Post-16 16-17, Primary 4-10, Whole school the school's range), with the change since the first year held; the census's pupils at schools within the radius sit beside them, labelled, and neither is divided by the other. |
| Why | Residents and pupils are different counts (wording rule 3): where children live, not where they are taught. |
| Applies to | DV-SMT-C-NOW, DV-SMT-C-BYAGE, DV-SMT-C-AGES, DV-SMT-C-NEARBY |
| Enforced in | - src/lib/smt/context.ts:buildContext<br>- src/lib/smt/area-data.ts:areaContext<br>- src/lib/smt/levels.ts:levelAges<br>- src/components/smt/views/Context.tsx:ContextNow |
| Tagged at | - src/components/smt/views/Context.tsx |
| Test case | The Chase (137625), ks4: At GCSE and exactly 5 miles, children aged 11-15 (read through area_context) equal school_context_lookup's sum of ages 11-15 for its latest year (3,354 for mid-2024); the census line is shown beside it, both labelled with the radius, and no figure is a ratio of the two. [runner: smtContextResidents] |
| Origin | 0.8 SMT round 3 (docs/v0.8/vicdata_0_8_smt_round3_context_data_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-CONTEXT-DEPRIVATION

| Field | Content |
| --- | --- |
| Statement | Context shows the IMD and IDACI deciles of the school's own LSOA, each "decile n of 10", and the IDACI mix of the children within 5 miles as one bar, decile 1 to 10, with the share in deciles 1-2 against England's 20% (by construction, said in the (i)). A school whose postcode places it in no English LSOA says so. Deprivation always describes the area, never the pupils. |
| Why | IoD2025 is published by neighbourhood; the school's figure is its area's (wording rules 1 and 4). |
| Applies to | DV-SMT-C-NOW, DV-SMT-C-MAP |
| Enforced in | - src/lib/smt/area-data.ts:schoolContext<br>- src/lib/smt/context.ts:buildContext<br>- src/components/smt/views/Context.tsx:SocialContext |
| Tagged at | — |
| Test case | The Chase; Leighton Park 110110; Acland Burghley 100053 (137625), ks4: The Chase IMD 8, IDACI 3; Leighton Park 6, 5; Acland Burghley 4, 5. Each IDACI mix sums to 100% (within rounding). [runner: smtContextDeprivation] |
| Origin | 0.8 SMT round 3 (docs/v0.8/vicdata_0_8_smt_round3_context_data_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-CONTEXT-FSM

| Field | Content |
| --- | --- |
| Statement | A state school shows its latest FSM % (fsm_eligible_percent) with its LA (through la_gss_crosswalk) and England the same year, to 1 dp, and the change since the first year held. An independent school (GIAS's independent schools less CTCs, and independent special schools) shows "Free school meals are not published for independent schools." and "Independent schools often draw pupils from well beyond 5 miles." -- never a number, never 0%, never a bare dash. |
| Why | DfE publishes no FSM for independent schools; the ingest leaves them no row (wording rule 2). Leighton Park reads this on 27 Nov. |
| Applies to | DV-SMT-C-NOW, DV-SMT-C-MAP |
| Enforced in | - src/lib/smt/area-data.ts:schoolFsm, areaFsm, fsmNotPublishedFor<br>- src/lib/smt/context.ts:buildContext<br>- src/components/smt/views/Context.tsx:Fsm |
| Tagged at | — |
| Test case | The Chase; Acland Burghley 100053; Leighton Park 110110 (137625), ks4: The Chase 17.7% against Worcestershire 20.8% and England 26.5% (2025/26); Acland Burghley 34.0% against Camden 46.1%; Leighton Park shows wording rule 2 and no percentage. [runner: smtContextFsm] |
| Origin | 0.8 SMT round 3 (docs/v0.8/vicdata_0_8_smt_round3_context_data_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-CONTEXT-WORDING

| Field | Content |
| --- | --- |
| Statement | Context's six wording rules come from SMT_NOTES, word for word: deprivation is "the area around the school, not its pupils"; independent schools' FSM; residents are not pupils; deciles (1 = the most deprived 10%); "A projection, not a forecast for the school", by local authority; the sources and editions in the source (i), their years read from the data. No "pupils" next to a deprivation figure. |
| Why | The board Leighton Park and every SMT reads must never describe a school's pupils by its area. |
| Applies to | DV-SMT-C-* |
| Enforced in | - src/catalogue/notes.ts:SMT_NOTES (wDeprivation, wIndependentFsm, wIndependentDraw, wResidents, wDeciles, wProjection, wSources)<br>- src/components/smt/views/Context.tsx<br>- src/components/smt/SmtDashboard.tsx:captionOf, sourceOf |
| Tagged at | - src/components/smt/views/Context.tsx |
| Test case | Leighton Park; The Chase 137625 (110110), ks4: The rendered Context views carry each rule verbatim from SMT_NOTES; no deprivation figure has "pupils" beside it except in the rule's own "not its pupils". [runner: smtContextWording] |
| Origin | 0.8 SMT round 3 (docs/v0.8/vicdata_0_8_smt_round3_context_data_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-CONTEXT-GEOGRAPHY

| Field | Content |
| --- | --- |
| Statement | Context's map shades neighbourhoods (ONS LSOAs 2021, joined through postcodes): those the ingest counts within 5 miles (population-weighted centroid) plus a one-mile ring, with the 5-mile circle drawn; the count within 5 miles equals school_context_lookup's. Until lsoa_boundaries has rows (before K0's migration and load), and for the Area pill's LA, the map draws round 2's LA shading and says "shading by district". "Shade by" lists only what exists. |
| Why | LSOA is the finest geography the data holds; the app must work before the migration and the load. |
| Applies to | DV-SMT-C-MAP |
| Enforced in | - src/lib/smt/context-map.ts:buildContextMap<br>- src/lib/smt/area-data.ts:lsoasNear<br>- src/components/smt/views/Context.tsx:AreaMap, shadeOptions |
| Tagged at | — |
| Test case | The Chase; Acland Burghley 100053 (137625), ks4: Without boundaries (the boundary RPCs answering as before K0's migration): the map falls back to the LA shading with the district note, and Shade by offers only children and FSM. With boundaries (production, loaded): the LSOAs counted within 5 miles equal school_context_lookup's lsoa_count (34 for The Chase), every one has a boundary, and Shade by adds IMD and IDACI. [runner: smtContextGeography] |
| Origin | 0.8 SMT round 2; round 3 (docs/v0.8/vicdata_0_8_smt_round3_context_data_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-DATA-GAP

| Field | Content |
| --- | --- |
| Statement | Retired in SMT round 3: Context showed the data gap ("Deprivation and free school meals: not yet in VicData") where the figures would be. The ingest has loaded both; the dashed block is gone, and the figures are R-SMT-CONTEXT-DEPRIVATION's and R-SMT-CONTEXT-FSM's. |
| Why | Superseded: the data arrived (docs/vicdata_context_data_ingest_report_v1.md). |
| Applies to | DV-SMT-C-NOW, DV-SMT-C-MAP (round 2) |
| Enforced in | — |
| Tagged at | - src/lib/smt/smt.test.ts |
| Test case | — |
| Origin | 0.8 SMT round 2 (docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md) |
| Status | superseded by R-SMT-CONTEXT-DEPRIVATION |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-CONTEXT-NOW

| Field | Content |
| --- | --- |
| Statement | The area now shows children of the level's ages living within the catchment radius (or in the LA) with the change since the first year held, the authority mix under it (0.8 SMT r4), the census's pupils at schools within the radius beside them, births last year and since 2012, the projection tile (the area's children of the ages, latest count to five years on, with its range: area_projection, or la_projection_lookup for the LA), the schools nearby of the same phase (all sectors), the place line (town · LA · region), and the Social context block. |
| Why | Each tile names its source and its area. |
| Applies to | DV-SMT-C-NOW |
| Enforced in | - src/lib/smt/context.ts:buildContext<br>- src/components/smt/views/Context.tsx:ContextNow |
| Tagged at | - src/components/smt/views/Context.tsx |
| Test case | The Chase (137625), ks4: Births last year equal ONS births for Worcestershire's districts; schools nearby are those within the radius teaching at least three of the ages; the projection tile's change equals area_projection's own 11-15 rows, latest count to five years on (5 miles). [runner: smtContextNow] |
| Origin | 0.8 SMT round 2; round 3; round 4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-BIRTHS

| Field | Content |
| --- | --- |
| Statement | Births are drawn by LA against England (every English district and unitary summed), indexed to 2012 = 100, said to be by LA. The school-age population (0.8 SMT r4) is the area's children of the level's ages, within the radius or in the LA: estimates to the latest count, then the projection from that count to the settings' horizon (latest + horizon_years). |
| Why | Two sources, two areas: each line says which. |
| Applies to | DV-SMT-C-BIRTHS*, DV-SMT-C-PROJECTION |
| Enforced in | - src/lib/smt/context.ts:buildContext<br>- src/components/smt/views/Context.tsx:PopulationProjected, BirthsAndProjections |
| Tagged at | - src/components/smt/views/Context.tsx |
| Test case | The Chase (137625), ks4: Both births lines are 100 in 2012; the projection runs from the latest count to the horizon, latest + the settings' horizon_years (11). [runner: smtBirths] |
| Origin | 0.8 SMT round 2; round 3; round 4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-RADIUS

| Field | Content |
| --- | --- |
| Statement | Context draws at one radius, in whole km: this view's own (?km=), else the school's saved catchment (school_catchment, app DB), else the default by type (5 km state, 15 km independent); never past the cap by type (15 km a state school without a sixth form, 30 km otherwise; a saved catchment over it draws at the cap and says so). The whole board follows it -- the map circle and ring, children now, the deprivation mix, population by age, children nearby over time, the forward view, schools nearby and the census line -- and no caption names another radius. The school's own School-Admin (or account holder) saves it; its approved members read it; nobody else does. |
| Why | One area per board, the same for every view; the school chooses its usual catchment (Guy, 15 Oct 2026: km, caps by type, Admissions' pools left nearest-N). |
| Applies to | Every SMT Context view; /api/smt/catchment; Admissions' list editor radius |
| Enforced in | - src/lib/smt/catchment.ts:resolveCatchment, catchmentCapKm, catchmentDefaultKm<br>- src/lib/smt/catchment-server.ts<br>- src/app/api/smt/catchment/route.ts<br>- src/app/api/smt/context/route.ts<br>- src/lib/smt/context.ts:buildContext<br>- src/lib/smt/context-map.ts:buildContextMap<br>- src/components/smt/Catchment.tsx:AreaPill<br>- supabase/migrations/20261113090000_v08_smt_r4_catchment.sql |
| Tagged at | - src/components/smt/Catchment.tsx<br>- src/components/smt/views/Context.tsx<br>- src/lib/smt/catchment.test.ts<br>- src/lib/smt/catchment.ts |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: Defaults 5 km (The Chase) and 15 km (Leighton Park); a saved 8 km draws 8 km, a view's 3 km beats it; a state 11-16 school is capped at 15 km and a saved 20 km draws 15 km, capped; at 3 km every Context caption says 3 km and none another radius; RLS (v08_smt_r4_catchment_pglite.mjs, 28 checks): School-Admin and holder write, members read, pending members, another school and anon neither. [runner: smtRadius] |
| Origin | 0.8 SMT round 4 (docs/v0.8/vicdata_0_8_smt_round4_area_projection_radius_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-FORWARD

| Field | Content |
| --- | --- |
| Statement | The forward view is the ingest's children-in-an-area projection (docs/v0.8/vicdata_area_projection_method_v1.md): area_projection at the radius, or la_projection_lookup for the LA (a county's districts summed), for the level's ages. Estimates, solid, to the latest count, then the middle line from that count to the horizon, its band (the lowest and highest of whole single-year projections, taken over the ages' sum) shaded, the years whose ages include children not yet born drawn lighter and labelled at the change. ONS's 2022-based projection (its change, applied by authority around the school) and the scenario are faint lines, off by default. |
| Why | Almost every child of school age in the next ten years is already born: the line starts from them, and ONS's own projection has drifted (Camden 11-15 +17% by 2025). |
| Applies to | DV-SMT-C-PROJECTION, DV-SMT-C-NOW (the tile), DV-SMT-C-BIRTHS, DV-SMT-P-AREA |
| Enforced in | - src/lib/smt/area-data.ts:areaProjection, laAreaProjection<br>- src/lib/smt/context.ts:buildContext, forwardFrom, mixLine<br>- src/components/smt/views/Context.tsx:PopulationProjected<br>- src/lib/smt/pupils.ts:buildPupils<br>- src/components/smt/views/Lines.tsx:PlainLine |
| Tagged at | - src/components/smt/views/Context.tsx<br>- src/lib/smt/catchment.test.ts |
| Test case | Leighton Park; The Chase 137625; Acland Burghley 100053 (110110), ks4: Ages 11-15 at 3, 5 and 10 miles, mid-2025, 2030 and 2035 (middle, low, high): equal to the ingest report's P5 spot checks, nine of nine; the estimates meet the line at the latest count; the band contains the line; at Primary the years from latest + 5 are flagged and labelled; Leighton Park's mix names Reading and Wokingham. [runner: smtForward] |
| Origin | 0.8 SMT round 4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-NOT-A-FORECAST

| Field | Content |
| --- | --- |
| Statement | The projection's wording is the method note's, from SMT_NOTES: "A projection of children living in the area, not a forecast for the school." on every view that draws it, and what it is and isn't (SMT_NOTES.whatItIs). Never "forecast" except as "not a forecast", never "your roll", never a school-level number from it. |
| Why | It is the children living in the area, not the school's intake; school roll projection is Victoria Consultancy's work, not the platform's. |
| Applies to | Every view that draws the projection |
| Enforced in | - src/catalogue/notes.ts:SMT_NOTES (wProjection, whatItIs, projectionTile)<br>- src/components/smt/views/Context.tsx<br>- src/components/smt/SmtDashboard.tsx |
| Tagged at | - src/components/smt/views/Context.tsx |
| Test case | Leighton Park (110110), ks4: No "forecast" but "not a forecast" and no "your roll" in SMT_NOTES or the drawn views (Context's now, forward, births; Pupils' area line); the two sentences are SMT_NOTES' word for word and on the views. [runner: smtNotAForecast] |
| Origin | 0.8 SMT round 4 |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-METHOD-PRESENT

| Field | Content |
| --- | --- |
| Statement | Every catalogue view (Teacher, Admissions, SMT; groups' views are SMT's) has a method (src/catalogue/methods.ts): the sources with their editions, read from the data where it carries them; the area; the years used and any left out, with the reason; the calculation as numbered plain-English steps; and any rounding or suppression. The footer's source (i) shows it, the steps under a collapsible "How it is calculated", scrolling, never cut off, on the phone too. Where the code does something the (i) didn't say (a rounding, a filter, an exclusion, double award as two entries, a small-number rule), the method says it. |
| Why | A standing rule from 0.8 SMT r4: every chart says exactly how it was calculated. |
| Applies to | Every dataview |
| Enforced in | - src/catalogue/methods.ts, methods-teacher.ts, methods-admissions.ts, methods-smt.ts<br>- src/components/shell/MethodNote.tsx<br>- src/components/shell/PanelFooter.tsx:SourceNote<br>- src/components/teacher/ColumnPanels.tsx:withMethod<br>- src/components/admissions/AdmissionsDashboard.tsx:sourceOf<br>- src/components/smt/SmtDashboard.tsx:sourceOf |
| Tagged at | - src/lib/groups/methods.test.ts |
| Test case | (the catalogue) (137625): Every DATAVIEWS id has a method with at least one source, an area, years and at least one numbered step, and none is left with a bare {placeholder}; no method names a view the catalogue doesn't hold. [runner: methodPresent] |
| Origin | 0.8 SMT round 4 (stage I) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-METHOD-SETTINGS

| Field | Content |
| --- | --- |
| Statement | A view whose numbers come from stored settings has its method generated from them, never typed: the forward view's (projectionMethod) is built from area_projection's settings in the method note's (i) shape, so every setting value appears in the text and changing a setting changes it. |
| Why | The text can't drift from the maths. |
| Applies to | DV-SMT-C-PROJECTION |
| Enforced in | - src/catalogue/methods.ts:projectionMethod<br>- src/components/smt/SmtDashboard.tsx:sourceOf |
| Tagged at | - src/components/shell/MethodNote.tsx |
| Test case | (a fixture) (110110): Every setting of version 2 (exceptional years and reason, first rate year, the five pre years at weight 1, 2025 at weight 2, the band years, the scenario years and label, the horizon, the version) appears in the text; one more exceptional year, weight 3, an 8-year horizon and a normal-years band change it to match. [runner: methodSettings] |
| Origin | 0.8 SMT round 4 (stage I) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-LEVEL-CHIPS

| Field | Content |
| --- | --- |
| Statement | The level chips are Whole school (the default) then only the phases the school has, from the census as the school page's Roll by phase decides them (Primary, GCSE, Post-16); an IGCSE school's GCSE chip is shown, marked, with the reason in its tooltip. Subject areas sit under GCSE or Post-16 only, as a second row with All areas first; Whole school and Primary have none. The level is held in the address (?level=, &area=) and remembered for the user; a level the school can't show falls back, never errors. |
| Why | SMT reads top-down (Guy, 3 Oct; spec §2.2, confirmed 13 Oct): the same chips, in the same place, as Teacher's subjects and Admissions' entry points. |
| Applies to | The SMT control bar; every SMT view |
| Enforced in | - src/lib/smt/levels.ts:levelChips, parseLevel<br>- src/lib/smt/school.ts:smtSchool<br>- src/components/smt/SmtDashboard.tsx:Dashboard |
| Tagged at | - src/lib/smt/smt.test.ts |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: The Chase: Whole school, GCSE, Post-16 (no Primary); its GCSE areas are the areas it entered. Leighton Park: GCSE shown, marked IGCSE; its GCSE areas offered, the incomplete ones as 'Sciences & Maths · no maths (IGCSE)' and 'Languages & Literature · no English (IGCSE)' (0.8 IGCSE subjects). ?level=primary at The Chase falls back to Whole school. [runner: smtLevelChips] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-SET-RANKS

| Field | Content |
| --- | --- |
| Statement | One comparison set drives the whole SMT dashboard: Teacher's sets (10 nearest, the LA, saved sets, the school's sets, rankings), resolved by Teacher's own route. Every rank among the set is level-aware: only the set's schools with that result are ranked (IGCSE schools left out at GCSE), the school counted too, highest first, ties sharing a place, and the count says so ("2 of 11 with GCSE results"). Regional and England ranks are 0.6.6's whole-population ranks. |
| Why | A rank is only honest with its count, and a set's preps don't count in a GCSE ranking (spec §2.2, §3.5). |
| Applies to | DV-SMT-O-SCORECARD, DV-SMT-A-NOW, DV-SMT-A-AREAS, DV-SMT-A-SUBJECTS |
| Enforced in | - src/lib/smt/population.ts:setPlace, placesOn<br>- src/lib/smt/overview.ts:buildOverview<br>- src/lib/smt/academic.ts:stagePart |
| Tagged at | - src/components/smt/views/Scorecard.tsx<br>- src/lib/smt/smt.test.ts |
| Test case | The Chase (137625), ks4: Attainment 8's set rank and count recomputed from the raw headline rows of the set's schools with a GCSE figure (IGCSE schools out) equal the scorecard's; England's equals the whole-population rank. [runner: smtSetRanks] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-IGCSE-WORDING

| Field | Content |
| --- | --- |
| Statement | An IGCSE school (R-IGCSE-EXCL) is never shown a whole-school GCSE zero or rank: its GCSE rows read "IGCSE · not ranked", its column-1 tile "IGCSE school, no comparable GCSE results", every whole-school GCSE view (value added; the results trend with no area chosen) says why in its own space (SMT_NOTES.igcseView), and its set is chosen in Post-16. Post-16 is compared as usual. Its GCSE subjects, complete subject areas, grade profile and entries mix are drawn and ranked as any school's (R-IGCSE-SUBJECT; 0.8 IGCSE subjects). |
| Why | Leighton Park and Sevenoaks sit IGCSEs: DfE's tables would read them as near zero. |
| Applies to | Every SMT view at GCSE or Whole school |
| Enforced in | - src/lib/smt/overview.ts:buildOverview<br>- src/lib/smt/academic.ts:stagePart<br>- src/components/smt/views/Scorecard.tsx<br>- src/components/smt/views/Now.tsx |
| Tagged at | — |
| Test case | Leighton Park (110110), ks4: Its Attainment 8 and grade 5+ rows have no value or rank and note igcse; its A-level rows are ranked; its set phase is Post-16; the whole-school GCSE views (value added) carry SMT_NOTES.igcseView. [runner: smtIgcse] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-P8-REASON

| Field | Content |
| --- | --- |
| Statement | Progress 8 shows only where DfE published it (state schools, to 2023/24), with its year and interval; otherwise the view says which reason applies, from SMT_NOTES: not published for independent schools; not published for 2024/25 or 2025/26 (no KS2 baseline); no GCSE results. Never a blank, never a zero. |
| Why | Two different absences -- a school type and two lost cohorts -- read the same as a missing figure unless said. |
| Applies to | DV-SMT-O-NOW, DV-SMT-A-NOW, DV-SMT-A-VA |
| Enforced in | - src/lib/smt/overview.ts:p8Of<br>- src/components/smt/views/Now.tsx<br>- src/components/smt/views/ValueAdded.tsx |
| Tagged at | - src/components/smt/views/AcademicNow.tsx<br>- src/components/smt/views/Now.tsx<br>- src/components/smt/views/ValueAdded.tsx<br>- src/lib/smt/overview.ts<br>- src/lib/smt/smt.test.ts |
| Test case | The Chase; Leighton Park 110110 (137625), ks4: The Chase: published, 2023/24, +0.08, the text naming 2024/25 as not published; Leighton Park: the independent reason. [runner: smtP8] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VA-HONEST

| Field | Content |
| --- | --- |
| Statement | Value added is shown as DfE publishes it -- A-level value added by qualification type and by subject, with DfE's 95% interval and banding -- and worded from SMT_NOTES: 0 is the national average; a range crossing 0 isn't clearly different from average; GCSE value added by subject has never been published. |
| Why | A value-added figure without its interval overstates what it can tell. |
| Applies to | DV-SMT-A-VA, DV-SMT-A-NOW, DV-SMT-O-NOW |
| Enforced in | - src/lib/smt/academic.ts:buildAcademic<br>- src/components/smt/views/ValueAdded.tsx |
| Tagged at | - src/components/smt/views/AcademicNow.tsx<br>- src/components/smt/views/ValueAdded.tsx |
| Test case | The Chase (137625), ks4: A-level value added 2024/25 equals the headline snapshot's A level::value_added (0.1, interval -0.03 to 0.24) and its banding. [runner: smtVa] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-YEARS

| Field | Content |
| --- | --- |
| Statement | Every SMT year comes from the data or years.ts, never the code: each key stage's latest from academic_current_periods (with "(provisional)" where the ingest says so), change measured from TREND_BASE_PERIOD, the census from CENSUS_FIRST_PERIOD; Context's small-area, LA, projection and FSM years from what the lookups return. When GCSE's latest moves on and Post-16's doesn't, each view labels its own year; when ONS adds an LSOA year, Context moves to it. |
| Why | GCSE 2025/26 lands on Thursday; nothing in SMT may hard-code a year (prompt, Read first). |
| Applies to | Every SMT view |
| Enforced in | - src/lib/smt/school.ts:latestYears<br>- src/lib/smt/overview.ts<br>- src/lib/smt/academic.ts<br>- src/lib/smt/context.ts:buildContext<br>- src/catalogue/years.ts:SMT_PROJECTION_TILE_AHEAD, SMT_PROJECTION_CHART_AHEAD |
| Tagged at | — |
| Test case | The Chase (137625), ks4: Today: the GCSE rows read 2024/25. With a synthetic GCSE 2025/26 (scripts/year-rehearsal, provisional), the Attainment 8 row reads 2025, Post-16's stays 2024, and no SMT source line holds a year literal. With a synthetic extra LSOA year (install-lsoa-next.ts), Context's children, population by age and sources read the new year. [runner: smtYears] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-BOARDING-ONLY

| Field | Content |
| --- | --- |
| Statement | SMT's filters are pills, only where they apply: Gender for a mixed school, Day + boarding for a boarding school (isBoardingSchool). A day school's request for boarding figures is ignored on the server; results aren't split by either, and the views say so. |
| Why | 0.7 r3 F2's rule, carried to SMT (spec §2.2). |
| Applies to | The SMT control bar; DV-SMT-O-NOW, DV-SMT-O-SCORECARD, DV-SMT-O-ROLL-* |
| Enforced in | - src/lib/smt/levels.ts:pillsFor<br>- src/lib/smt/overview.ts:buildOverview |
| Tagged at | - src/lib/smt/levels.ts<br>- src/lib/smt/smt.test.ts |
| Test case | The Chase (day); Leighton Park 110110 (boarding) (137625), ks4: The Chase: Gender only; a boarding filter is ignored (no boarders row, filters all). Leighton Park: both pills, a boarders row, day and boarding roll lines. [runner: smtBoardingOnly] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-FLAGS

| Field | Content |
| --- | --- |
| Statement | Flags on the school appear only for large and lasting changes, with the figures behind them: the roll falling three years running (Admissions' losingPupils), the entry cohort shrinking past the national threshold (entryYearShrinking), and results moving faster than the set's middle by at least SMT_FLAG_RULES.resultsGap over two years, with at least SMT_FLAG_RULES.resultsMinSchools set schools. The thresholds live in src/lib/smt/flags-rules.ts only. |
| Why | Admissions' rule: a flag is never one small cohort or a hunch. |
| Applies to | DV-SMT-O-FLAGS, DV-SMT-O-SCORECARD |
| Enforced in | - src/lib/smt/flags.ts<br>- src/lib/smt/flags-rules.ts:SMT_FLAG_RULES<br>- src/lib/smt/overview.ts:buildOverview |
| Tagged at | - src/components/smt/views/Flags.tsx<br>- src/lib/smt/flags-rules.ts<br>- src/lib/smt/flags.ts<br>- src/lib/smt/smt.test.ts |
| Test case | The Chase (137625), ks4: The Chase's two-year Attainment 8 change against the set's median change, recomputed from raw rows, flags exactly as the app does and as the latest year's fixture says: flagged in 2024/25; in 2025/26 +1.0 against -0.6, a gap of 1.6 under the 2-point threshold, not flagged. No roll-falling flag (its roll rose). [runner: smtFlags] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-NOTES

| Field | Content |
| --- | --- |
| Statement | SMT's honesty wording comes from one file, SMT_NOTES (src/catalogue/notes.ts), behind each panel's caption button or in the view's own space; no SMT component words a caveat of its own. |
| Why | One place to read and edit what SMT says about its figures, as ADMISSIONS_NOTES is for Admissions. |
| Applies to | Every SMT view |
| Enforced in | - src/catalogue/notes.ts:SMT_NOTES, smtNote<br>- src/components/smt/SmtDashboard.tsx:captionOf |
| Tagged at | - src/components/smt/SmtDashboard.tsx |
| Test case | Leighton Park (110110), ks4: The rendered views carry SMT_NOTES' Progress 8 and IGCSE lines; the SMT components hold no copy of a SMT_NOTES sentence. [runner: smtNotes] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-SMALL-ENTRIES

| Field | Content |
| --- | --- |
| Statement | A subject with fewer than MIN_SUBJECT_ENTRIES (5) entries isn't ranked and says so; ranks come from Teacher's subjectRanking, so a subject's figures match the subject explorer's. |
| Why | One or two pupils would decide a rank. |
| Applies to | DV-SMT-A-SUBJECTS |
| Enforced in | - src/lib/smt/academic.ts:stagePart<br>- src/components/smt/views/Subjects.tsx |
| Tagged at | - src/lib/smt/academic.ts |
| Test case | The Chase, GCSE Sciences & Maths (137625), ks4: Every subject under 5 entries is unranked; Biology's set and England ranks equal subjectRanking's own. [runner: smtSubjects] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-NOW

| Field | Content |
| --- | --- |
| Statement | The school now shows the census's roll and its change since 2019/20, girls and boys (day and boarding at a boarding school), each phase's headline with its national rank, A-level value added, Progress 8 or its reason, and the school page's XS-XL by phase -- never new words for size. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-O-NOW |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Now.tsx |
| Test case | The Chase (137625), ks4: Roll and girls + boys equal the census; the bands are the school page's. [runner: smtViewNow] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-SCORECARD

| Field | Content |
| --- | --- |
| Statement | The scorecard lists each headline with the school's figure, its rank in the set (with the count), in the region and in England, and its change since 2022/23 (roll since 2019/20); IGCSE rows say not ranked; the flags line follows. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-O-SCORECARD |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Scorecard.tsx |
| Test case | The Chase (137625), ks4: As R-SMT-SET-RANKS. [runner: smtSetRanks] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-MAP

| Field | Content |
| --- | --- |
| Statement | The map draws the school and every located school in the comparison set; the school ringed. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-O-MAP |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/SetMap.tsx |
| Test case | The Chase (137625), ks4: Every set school with coordinates is a marker. [runner: smtViewMap] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-TRENDS

| Field | Content |
| --- | --- |
| Statement | Trends draw indexed rolls against the LA and England (pupils aged 5-15, said so), results against the set's middle half with 2021/22 shaded and the trend note, and market share from Admissions read-only (an empty state with the reason where the school has no 11+ rivals). |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-O-*-LINE, DV-SMT-O-*-TABLE, DV-SMT-A-TREND-* |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Lines.tsx<br>- src/components/smt/views/Tables.tsx |
| Test case | The Chase (137625), ks4: The roll lines are 100 in the base year; each band's quartiles are the set's own, recomputed. [runner: smtViewTrends] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-ACADEMIC-NOW

| Field | Content |
| --- | --- |
| Statement | The level now shows the level's headlines (both phases at Whole school), value added in its own block with its reason, and the grade profile. With a subject area chosen the tiles are four, as the Academic board draws them: entries, the average, the top grades, and the rank in the set as its own tile. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-A-NOW |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/AcademicNow.tsx |
| Test case | The Chase (137625), ks4: The GCSE Sciences & Maths entries equal the area's family entries; the area's average equals the family's average points. [runner: smtAcademicNow] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-AREAS

| Field | Content |
| --- | --- |
| Statement | Subject areas are Admissions' strengths and weaknesses (buildRivals), against the comparison set instead of the rivals. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-A-AREAS |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Areas.tsx |
| Test case | The Chase (137625), ks4: The areas equal buildRivals' for the set. [runner: smtAreas] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-SUBJECTS

| Field | Content |
| --- | --- |
| Statement | Subjects list the area's subjects with entries, average, rank in the set and England, since 2022/23, and the subject explorer link carrying ?set=. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-A-SUBJECTS |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Subjects.tsx |
| Test case | The Chase (137625), ks4: As R-SMT-SMALL-ENTRIES. [runner: smtSubjects] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-GRADES

| Field | Content |
| --- | --- |
| Statement | The grade profile bands the main qualification's latest graded entries (GCSE 9-7, 6-5, 4, 3-1; A level A*-A, B, C, D-U); the bands add up to all of them. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-A-GRADES |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Grades.tsx |
| Test case | The Chase (137625), ks4: The bands' entries add up to the graded entries and their shares to 100%. [runner: smtGrades] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-MIX

| Field | Content |
| --- | --- |
| Statement | The entries mix shows each area's (or subject's) share of the entries for every year the data has, from the subject rollup's first year with entries (R-ENTRIES-FIRST-YEAR: 2020/21 at GCSE, a year before the results trend beside it); entries count from the first year (not graded, so no 2021/22 note). |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-A-MIX, DV-SMT-A-MIX-TABLE |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Mix.tsx<br>- src/components/smt/views/Tables.tsx<br>- src/lib/smt/academic.ts |
| Test case | The Chase (137625), ks4: The GCSE mix runs from the rollup's first year with entries (2020/21) to the latest year, a year before the results trend's 2021/22; each year's shares add up to 100%. [runner: smtMix] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |

### R-SMT-VIEW-RESERVED

| Field | Content |
| --- | --- |
| Statement | Results by band is a reserved panel: the slot exists, with SMT_NOTES.bandReserved as its caption and body -- "the top 25%, middle 50% and bottom 25% of entries" (the bands are of entries, not pupils) -- and no figure. |
| Why | A view says what it shows and why, as Admissions' views do. |
| Applies to | DV-SMT-A-BANDS |
| Enforced in | - src/components/smt/SmtDashboard.tsx:ViewBody<br>- src/components/smt/views |
| Tagged at | - src/components/smt/views/Reserved.tsx |
| Test case | The Chase (137625), ks4: The panel draws SMT_NOTES.bandReserved and no number. [runner: smtReserved] |
| Origin | 0.8 SMT round 1 (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md) |
| Status | active |
| Must lift | — |
| Open issue | — |
| Fixed | — |
