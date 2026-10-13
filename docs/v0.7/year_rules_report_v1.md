# VicData 0.7: year rules review, before GCSE 2025/26

Report for `docs/v0.7/vicdata_0_7_year_rules_review_claude_code_prompt_v1.md`, branch `v0.7-year-rules`, 13 Oct 2026.

**What changed, in one line:** "the latest year" now comes from the data, per key stage; the rule years live in one file with their reasons; and a synthetic GCSE 2025/26 has been run through every view the prompt names. Today's pages are unchanged (§5).

**Results at a glance:**

| Check | Result |
|---|---|
| tsc, eslint, build | clean (eslint: 0 errors, the 2 existing warnings) |
| Unit tests | 395 / 395 (the 390 before, and 5 new in `src/lib/year-rules.test.ts`) |
| Rule tests | 52 / 52 PASS, output identical to main's line for line |
| RLS test | 111 / 111 |
| Teacher parity, today's data | **2,875 / 2,875 identical**, negative control caught; public page SSR byte-identical (137625, 117037) |
| Admissions parity, today's data | **328 / 328 identical**, pixels and DOM, 592 panel-views |
| Data View academic graphs and rankings, public page sentence, today's data | 18 / 18 identical, pixels and HTML (§5) |
| 2025/26 rehearsal | every expected change seen, nothing unexpected (§4) |

---

## 1. Y1: every year in the code

Three read-only sweeps covered `src/` (Teacher and lib; Data View, public page and catalogue; Admissions). About 640 raw matches are change-log dates in comments; what's left is below, grouped. **Rule** = deliberate, stays put. **Assumption** = describes the data, should follow it. **Data** = already found from the data.

### Rules (kept, now in `src/catalogue/years.ts`)

| Rule | Where it was | What it does |
|---|---|---|
| `GRADING_2122_PERIOD = 2021` (R-TREND-FROM-2223, ex R-2122-GRADING-NOTE) | `catalogue/notes.ts:19` | The 2021/22 note on any trend that draws it |
| `TREND_BASE_PERIOD = 2022` (R-TREND-FROM-2223) | `catalogue/notes.ts:23` | Every trend statement measured from 2022/23: applied in `SubjectPanels` (344-345, 722-730, 768, 930, 944-951), `ComparisonsPanels` (706-715, 722, 808, 885), `TrendChart` (232-234), `SeriesViews` (96, 405, 414), `GradeCountsPanels` (195, 202), `GeographyComparison` (107-109), `ColumnPanels` (89-99), `tableLayout` (41-42), `view-series/*`, `grade-spread.ts` (50), `subject-ranking.ts` (155-163, 342), Admissions (rivals, views-api) |
| `TREND_LINE_MIN_YEARS = 4` (R-TREND-LINE-4YR) | `lib/teacher-view-panels.ts:391` | A line only with 4+ real years |
| `MEETING_TREND_MIN_YEARS = 3` (R-TREND-3YR) | `lib/teacher-view-catalogue.ts:25` | The meetings slide picker's "N-year trend" (question 5) |
| `MODERN_GRADE_FROM = 2023`, `HISTORIC_GRADE_FROM/TO = 2021/2022` | `lib/grade-rows.ts:40-42` | Where each grade source starts and ends (R-CURRENT-GRADES-FROM-2324, R-HISTORIC-GRADE-LABELS) |
| `DATA_VIEW_TREND_BASELINE = { ks2: 2022, ks4: 2021, ks5: 2021 }` | `lib/academic-data-view.ts:223` | The Data View's "since" year: **not** the Teacher rule (question 4) |
| `CENSUS_FIRST_PERIOD = 2019` | `lib/admissions/data.ts:27`, and as literals in `data-view-filters.ts:101`, `data-view-profiles.ts:145`, `data-view-serialize.ts:124`, `MapView.tsx:181` | The census series' first year: the Data View's default "since", Admissions' "2019/20 = 100" |
| `PAST_FROM_ENTRY_YEAR = 2020` | `lib/admissions/ladder.ts:27` | Admissions' first past pool |
| The two- and three-year flag windows, "+3 years" pool target, 10-year horizon | `lib/admissions/flags.ts`, `feeders.ts`, `pipeline.ts`, `entry-points.ts` | Relative offsets from the latest year; already follow it |

### Assumptions (now follow the data, or written down where they can't yet)

| Where | What it assumed | Now |
|---|---|---|
| `catalogue/measures.ts` (52-57, 144-147, 197, 241, 269, 319, 365) | Every academic card's latest year is "2024/25"; `pick.ts` `yearsOf`/`latestYear` and `meeting-views.ts` (`latestYearOf`, titles, "move every view on") read it | The card names its family (`years.latest`); `measureYearsTo()` gives the data's latest where known, the card's own year otherwise |
| `lib/admissions/ranks.ts:19-33` and `rivals.ts:134-139`, `views-api.ts:181-189` | Results reads loaded the latest year and the two before, but every "since 2022/23" reads 2022/23: **the change would go blank** once GCSE's latest passed 2024/25 | Reads start at `min(latest − 2, 2022)`; shown in §4 |
| `lib/admissions/rivals.ts:53-61` | KS2's results year found from the census year less one | The national latest-year lookup, like GCSE's and Post-16's |
| `components/admissions/AdmissionsDashboard.tsx:600, 801` | `censusPeriod ?? 2025` | `?? CURRENT_CENSUS_PERIOD` |
| `AdmissionsDashboard.tsx:608, 613, 615, 804`; `panels/Academic.tsx:34, 81`; `views/Strengths.tsx:42, 62`; `views/Momentum.tsx:62, 139`; `catalogue/admissions.ts:88, 122, 123, 214, 218`; `catalogue/notes.ts:16, 84` | "since 2022/23", "2019/20 = 100", "from 2019/20", `yearLabel(2019)`, `yearLabel(2022)` written as text | Built from the constants; the words are unchanged |
| `lib/data-view-summary.ts:21` | A copy of the census year, as a literal | Reads `CURRENT_CENSUS_PERIOD` |
| `lib/subject-ranking.ts:294` | `p_period_min: 2021` | `HISTORIC_GRADE_FROM` |
| `lib/roll-data.ts:16` `CURRENT_CENSUS_PERIOD = 2025`, used in ~20 places (Admissions, surrounding schools, the public page, the sync scripts) | The census year | **Still a constant**, moved to years.ts with why: no national census lookup exists and this round makes no database change (call logged; proposed: a `census` row on `academic_current_periods`) |
| `catalogue/admissions.ts:40, 56, 72, 88` (`to: "2025"`, `"2024"`, `"2036"`) | Admissions' measure cards' spans | Descriptive cards; the views read their own years. Left as they are |
| `population-trend-lookup.ts:89-90` births 2021-2025 (R-BIRTHS-FULL-WINDOW) | ONS births window | Out of scope (not a DfE results year); listed |
| `academic-aggregate-trends/route.ts:45`, `aggregate-trends/route.ts:41` default 2019 | A request default | The census start; harmless for academic data (which starts later) |
| `teacher/recruitment/page.tsx:117` | Prints a trend as "2021–2024" (raw periods) | Listed only: changing it would change today's page |

### Already from the data (no change needed)

The Teacher panels (`SubjectPanels` 368-375, `ComparisonsPanels` 375-380, `CandidatesPanels`, `view-series/*`, `grade-spread.ts`), `latestMeasureAt` and `latestSubjectYear` (`academic-data-view.ts`), the Data View's graphs, rankings and map, `Ks2DomainSection`, the public page's academic sentence (per school and key stage), the Teacher dashboard's "new data in", the phase tiles (`academic_current_periods`), Admissions' market and feeder tables and pipeline labels. Labels like "Results 2024/25", "Data 2024/25", "Candidates — 2021/22 to 2024/25" are built from the periods the view holds; no string holds a year. `embed.ts` (`components/dashboard-config/`) parses any "YYYY/YY".

**Global vs per key stage:** no view used one global latest year across key stages. The national lookup is per key stage; the Teacher dashboard's latest is per phase; the Data View's and the public page's are per school and key stage, and per measure where it matters (`latestMeasureAt`).

## 2. Y2: what became data-driven

- **One registry, filled from the data.** `academic_current_periods` (KS2, KS4, KS5) is read through `lookupAcademicLatestYears()` and carried in payloads the pages already fetch: `/api/teacher/dashboard` (`latestYears`), `/api/data-view/academic-schools` (`latestYears`), the public page on the server, and Admissions' rivals (`resultsProvisional`). Reuse a meeting reads `/api/academic-periods` (new, public, national) before "move every view on".
- **The catalogue follows it:** a card's latest year, its years list, titles' `[year]`, the picker's meta line, "Pinned to …" and meetings' roll-forward. After DfE's GCSE release, GCSE cards read 2025/26 and Post-16 cards 2024/25 (test: `year-rules.test.ts`).
- **The provisional marker.** "(provisional)" after the year, on the year the data marks provisional, on: Teacher's "Data {year}" line (all three columns' Current panels), the Data View's "Candidate numbers, …", "Attainment 8 …, …", "Candidates, …" and "Results, …" cards, the public page's academic sentence, and Admissions' Academic and Strengths headers. It reads an optional `provisional` column on `academic_current_periods`, which doesn't exist yet, so it's **off**: the ingest round that loads GCSE 2025/26 adds it.
- **Admissions' results window** keeps 2022/23 loaded (above).
- **A page showing both key stages labels each with its own year:** shown in §4 (Sevenoaks' card: GCSE excluded, Post-16 "in 2024/25"; The Chase: GCSE "2025/26 (provisional)").

## 3. The constants file

`src/catalogue/years.ts`, with the reason beside each:

| Name | Value | Kind |
|---|---|---|
| `GRADING_2122_PERIOD` | 2021 (2021/22) | Rule |
| `TREND_BASE_PERIOD` | 2022 (2022/23) | Rule (question 1) |
| `TREND_LINE_MIN_YEARS` | 4 | Rule |
| `MEETING_TREND_MIN_YEARS` | 3 | Rule, superseded elsewhere (question 5) |
| `DATA_VIEW_TREND_BASELINE` | KS2 2022, KS4 2021, KS5 2021 | Rule (question 4) |
| `MODERN_GRADE_FROM`, `HISTORIC_GRADE_FROM`, `HISTORIC_GRADE_TO` | 2023; 2021, 2022 | Source facts |
| `CENSUS_FIRST_PERIOD`, `PAST_FROM_ENTRY_YEAR` | 2019; 2020 | Source facts |
| `CURRENT_CENSUS_PERIOD` | 2025 | **Assumption**, with what would replace it |
| `latestPeriodOf()`, `isProvisional()`, `withProvisional()`, `measureYearsTo()` | from the data | — |

Every old name is a re-export, so nothing that imported them changed. The file imports nothing.

## 4. Y3: the 2025/26 rehearsal

**The fixture.** `scripts/year-rehearsal/synthetic-year.ts` wraps fetch so every read of the vicdata reference API answers as if GCSE 2025/26 had been published:
- every KS4 row of 2024/25 is copied into 2025/26, its figures nudged a few per cent (fixed per row, so runs repeat);
- Progress 8 is dropped from the copies (DfE publishes none for 2025/26);
- `academic_current_periods` says GCSE's latest is 2025/26, **provisional**, and Post-16 and KS2 stay at 2024/25.

That covers every school, including The Chase 137625, King's Worcester 117037, Sevenoaks 118952, their 10 nearest, and the LA, region and England aggregates. The app's own server code computes everything from it. The two database-side computations that can't see a synthetic year (the subject rank and grade rollup lookups) answer "not applied", which sends the app to its own fallback reads. It stays in the repo as a test: `install-ks4-2025.ts` is the one-line preload, and next year changes `from`/`to`. How the runs were wired is in `docs/v0.7/audit_scripts/year_rehearsal/README.txt`.

**What was drawn,** each today and with 2025/26, at 1440 and 390:

| Surface | Pairs | Changed | Unchanged |
|---|---|---|---|
| Teacher GCSE (Candidates and Results, all three columns, every rail view; Points, Grade 4+, bands, counts) | 622 | 598 | 24 |
| Data View academic graphs and rankings; public page academic sentence | 18 | 14 | 4 (Sevenoaks' rankings and sentence: excluded, as before) |
| Admissions, both dashboards, every view, 11+/16+/4+ | 328 | 68 (the 11+ Market share pages only) | 260 (every 16+, 4+ and Pipelines page) |

No view errored, nothing asked for an unstubbed route, and nothing unexpected changed. After masking figures, direction words and year labels, every remaining Teacher difference is a table gaining a 2025/26 column or a ranked list reordering on the nudged figures.

**The expected changes, each seen:**

1. **The latest year is 2025/26 on GCSE views only.**
   - Teacher's "Data 2025/26 (provisional)" in every GCSE column.
   - The Data View's "Candidate numbers, 2025/26 (provisional)", "Attainment 8 average score, 2025/26 (provisional)" and "Candidates, 2025/26 (provisional)".
   - The public sentence "The Chase's GCSE pupils achieved an average Attainment 8 score of 52.4 in 2025/26 (provisional)".
   - Admissions "11+ → GCSE · 2025/26 (provisional)".
2. **Post-16 is unchanged.** Every Admissions 16+ page is identical. Sevenoaks' card keeps "A-level and International Baccalaureate students achieved an average of 49.5 points per entry in 2024/25", with no marker, beside the GCSE line. Each key stage carries its own year on one page.
3. **Trends gain a fifth year.** Axes run 2021/22 to 2025/26; sources read "2021/22–2025/26"; the Data View's rank table becomes "Rank, 2021/22–2025/26" with a 2025/26 column. Sevenoaks' Comparisons series reaches four real years, so R-TREND-LINE-4YR now offers it a line (a new "Chart" view, the rule working as written).
4. **Statements are still measured from 2022/23.** "Change in History average points since 2022/23", "change in points since 2022/23, ranked", "▲ 3.0 since 2022/23", "Change since 2022/23 (Attainment 8, points)". Card tables show the statement's two ends (2022/23 and 2025/26) and "+3 more years". The Data View still says "since 2021/22" (its own baseline, question 4).
5. **The 2021/22 note still shows** on every trend that draws 2021/22 ("Trends are measured from 2022/23. 2021/22 is still shown, …").
6. **"Provisional" appears where the flag is set,** and nowhere on Post-16 or KS2.
7. **Sevenoaks is still excluded from GCSE comparison.** The Data View keeps "Sevenoaks School's GCSE figures aren't comparable…" and its GCSE rankings are unchanged; Admissions keeps Malvern St James "not ranked (IGCSE)".
8. **Progress 8** isn't drawn anywhere, so its absence shows no gap and no error.

**The bug the rehearsal was for.** Admissions' "since 2022/23" changes come from results reads that loaded only the latest year and the two before. Run against **main's** code with 2025/26, The Chase at 11+ got `resultsPeriod` 2025/26 and **0 of 11** rivals' changes, no overall change and **0 of 6** subject-area gaps: every "since 2022/23" figure blank under a label still promising one. On the branch: 7 of 11 changes (the other 4 have no ranked GCSE result either way), the overall change (+3.0) and 6 of 6 gaps.

**Five years fit.**
- **Charts:** the axes thin to every other year at 390 (2021/22, 2023/24, 2025/26), and the fitted line counts from 2022/23.
- **Tables:** card tables show the two statement ends; ranked bars, change tables and maps keep their widths.
- **The Data View's rank table** scrolls sideways at 390, as its four-year version already does.

Nothing needed fixing. The one layout touch: "(provisional)" sits after the year as its own word (no doubled space).

**Screenshots** (`docs/v0.7/year_rules_screenshots/`, each today and 2025-26 unless named):
- Teacher: Results Current and trend, Candidates trend (1440); Sevenoaks' Comparisons trend, and its new four-year chart; the 390 Trends sheet.
- Data View: graphs (1440) and rankings (390).
- Public page: sentences for The Chase and Sevenoaks.
- Admissions: 11+ Market share and its Academic change view, at 1440.

## 5. Parity: identical with today's data

With today's data the branch draws exactly what main draws:

- **Teacher:** the parity harness, unmasked, on the final tree against `main` (`bfe7759`): **2,875 / 2,875 pairs identical**, every case set clean, the negative control caught. Fixtures were byte-identical between the trees.
- **Admissions:** both published dashboards, every view, three schools × their entry points × both themes × 1440/390: **328 / 328 identical**, pixels and DOM, 592 panel-views.
- **Data View and public page:** the import graph lists the files this round touched in the Data View's and public page's graphs (the constants now read from `years.ts`, and the provisional label that is off). So they were drawn too:
  - the Data View's academic graphs and rankings and the public page's academic sentence, three schools at 1440 and 390: **18 / 18 identical**, pixels and HTML;
  - the public page SSR: byte-identical for 137625 and 117037.
- **Rule tests:** output identical to main's, line for line, apart from timings.
- **Every payload is unchanged today.** `resultsProvisional` is sent only when true; `latestYears` is a new field no component reads unless it's there.
- **One edit came after the Teacher run:** "(provisional)" became its own span, which draws only when the flag is on. With it off, React renders `false` as nothing, in both forms.

**How the runs were checked:** two earlier runs had used port numbers other sessions' harness servers already held, so they drew those sessions' old bundles. Both runs reported above used free ports, with each server's folder checked first.

## 6. Questions for Guy

The recommendation is the default; nothing below changes a rule.

1. **Statements from 2022/23.** With 2025/26, keep measuring change from 2022/23 (four years of change), or move to "the last three years"? *Default: keep 2022/23.* (One constant: `TREND_BASE_PERIOD`.)
2. **Years drawn.** Draw all five (2021/22–2025/26), with the 2021/22 note? *Default: yes* (it's what the code does; §4).
3. **Provisional marker.** "(provisional)" after the year, until DfE's revised release? *Default: yes.* It needs one column from the ingest: `provisional` on `academic_current_periods`, true for KS4 until the spring revision.
4. **The Data View's baseline.** The Data View measures GCSE and Post-16 change from 2021/22 ("since 2021/22"); Teacher measures from 2022/23. Should the Data View follow R-TREND-FROM-2223? *Default: leave it; your call.*
5. **The meetings slide picker** still offers an "N-year trend" from 3 years (R-TREND-3YR); every other view needs 4 for a line. Align it? *Default: leave it.*
6. **The subject ranking's change list** applies 2022/23 to entries too (`subject-ranking.ts:155-163`); R-TREND-FROM-2223 says never on Candidates. *Default: leave it; your call.*
7. **The census year** stays a constant until a census row is added to `academic_current_periods` (ingest repo). *Default: add it in the next ingest round.*

## 7. Logged calls

Under "2026-10-13 — year rules" in `docs/OPEN_QUESTIONS.md`.
