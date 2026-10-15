# VicData 0.8 audit fixes: IGCSE everywhere, Double Award in Column 1, labels that match the code, rules on 2025/26

Branch `v0.8-audit-fixes` (from `main` at `553ddfe`), 16 Oct 2026. Prompt: `docs/v0.8/vicdata_0_8_audit_fixes_claude_code_prompt_v1.md`. Calls logged under "2026-10-16 — 0.8 audit fixes" in `docs/OPEN_QUESTIONS.md`.

**Not merged.** The prompt's stop condition: Leighton Park still shows a GCSE rank in one place, Teacher's Column 1 ("2nd of 4 in Sciences & Maths", its subject against its own other subjects, and "+0.6 above England average"). That was there on `main` too ("2nd of 3"); this round didn't add it, but it didn't remove it either, and whether Teacher should hide an IGCSE school's own GCSE subject figures is your call (question 1). Everything else is clean and every parity difference is traced to an item. The branch is pushed.

## Commits

| Item | Commit | |
|---|---|---|
| 9 | `7c0dd27` | Head office reads the school's saved catchment, read-only |
| 1 | `500057d`, `048206f` | IGCSE schools out of every GCSE ranking, one rule everywhere; R-ADM-RIVAL-RANKS recounts without them |
| 2 | `ec75513` | Double Award scored in Column 1 |
| 3 | `549d586` | SMT flags caption, highlighted ages, tables that show what their headers say |
| 4 | `7176924`, `77cd723` | Indexed charts name their real base year; an empty chart names none |
| 5 | `eadddda`, `ac240d2` | Admissions notes only where they apply, births wording, titles |
| 6 | `f3f94ad` | The girls/boys filter splits a panel throughout or says it doesn't |
| 7 | `d3e2a2e` | One minimum for subject areas |
| 8 | `b793dc5` | Ties share a place ("=3rd"); set-average and feeder-flag wording |
| 10 | `24e0c42` | The five rules read the latest year and a fixture per year; R-YEARS-ROLLOVER |
| — | `e6e1dd9` | Catalogue docs regenerated |

Each item's commit can be reverted alone, with one exception: item 5's commit also carries item 4's two SMT title rows in the regenerated preset table (`docs/v0.6/views_preset_table.md`).

## Checks

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors; 2 warnings, both in files this round doesn't touch (`PeerTrendChart.tsx`, `SchoolMap.tsx`), as on `main` |
| build | clean; no server key in `.next/static` (searched by the key's signature) |
| Unit | 455 / 455 |
| Rules | **96 pass, 0 fail** (15 manual, 19 without a check, 4 superseded). The full run gave 93 pass: R-ADM-RIVAL-RANKS' own recount needed item 1's rule (fixed, `048206f`), and R-SMT-CONTEXT-PLACE and R-SMT-YEARS hit a statement timeout while the parity runs loaded the database; both pass alone. New: R-IGCSE-EVERYWHERE, R-ADM-SEX-FILTER, R-YEARS-ROLLOVER; R-RANK-TIES now has a check |
| RLS | v06 ALL PASS; v07 Admissions ALL PASS; catchment 31 / 31 (3 new head-office checks) |
| Groups r1 | ALL PASS (102); server access rules in the unit run |
| Usage log | ALL PASS |
| Parity | Teacher, Admissions, SMT and the public page below |

## Parity, item by item

**Every difference below is traced to an item; none is unexplained.**

| Product | Pairs | Identical | Different | Traced to |
|---|---|---|---|---|
| Teacher (c5 sets, with the (i) set aside) | 2,306 | **2,306** | 0 | Two Context bar charts drew short once (a layout flake, as in round 4); identical on rerun |
| Teacher rankings (rka, rkb, fixtures recaptured) | 497 | 394 (+1 render noise) | 103 | 18 with different words: only "=" on a shared place (8) or the IGCSE line (1). 85 pixels only, all GCSE: the ranking's note above the Comparisons column gains "30 schools not ranked at GCSE (mostly IGCSE).", wraps a line and moves the panels below it 16.5 px (1). No Post-16 pair differs |
| Teacher saved views (sv) | 72 | **72** | 0 | (a first run lost one case to a fixture that didn't load on main; identical on rerun) |
| Admissions (3 schools × entries × themes × widths) | 328 | 166 | 162 | 1, 4, 5 (below) |
| SMT (the routes' data, 3 schools) | 127 fields | — | 127 | 1, 3, 7 (below) |
| Public school page SSR (137625, 117037) | 2 | 2 | 0 | — |

How each harness reads the change: Teacher's fixtures are captured per tree from the server code, except the ranking fixtures, which both trees share (so a ranking shows a difference only where the page draws it differently). Admissions' fixtures are now captured per tree (they were shared before). SMT has no page harness: its parity is the routes' own builders run from each tree and compared field by field. Its wording changes (captions, headers, notes) are listed under each item.

### 1 — IGCSE schools, one rule everywhere (T1, T4, T6, S4)

- **One test, one loader.** `igcseExclusionLikely` is unchanged and the only test. `src/lib/igcse.ts` reads every independent school's GCSE headline once an hour and applies it: 411 schools today. The lean Teacher profiles carry its answer (`ks4IgcseExcluded`), so the map's check now fires (T4).
- **Every GCSE ranking population leaves them out:** Teacher's headline and subject rankings (rank, "out of" and average), Admissions' national and regional places (headline and subject areas), SMT's set, region and England ranks.
  - A line says how many: "375 schools not ranked at GCSE (mostly IGCSE)".
  - The school itself reads "Leighton Park School is not ranked at GCSE (IGCSE)."
- **"10 nearest" at GCSE fills to 10** past IGCSE schools, through the same engine. Where it filled, the caption names the reach: Leighton Park's reads "17 schools not ranked at GCSE (mostly IGCSE); the 10 nearest eligible reach 21 km". The Chase's list is unchanged.
- **Pairs it changes:**
  - Admissions: every national and regional results rank at 11+, as in this example. The Chase: England 885th of 4,775 → **877th of 4,383**; West Midlands 66th of 559 → 66th of 526.
  - SMT: GCSE England and region ranks, subject England ranks (The Chase's first subject 993rd of 4,006 → 939th of 3,927), and the Overview scorecard (885 of 4,775 → 877 of 4,383).
  - Teacher: rankings at GCSE (server-side; the shared ranking fixtures draw them the same in both trees), and Leighton Park's map, which no longer draws the school.
- **R-IGCSE-EVERYWHERE** (new) passes.
- **Worth a look:** The King's School Worcester (117037) is an IGCSE school by the rule (0% English and maths grade 4+, Attainment 8 18.4 in 2025/26). It is no longer ranked at GCSE anywhere.

### 2 — Double Award scored everywhere (T5)

Column 1's points gate now lets a GCSE Double Award through and reads the rows `fillDoubleAwardPoints` already scored.

- **Pairs:** Column 1 average points for schools with Double Award entries. The Chase's Combined Science goes from no points → **4.8 (2025/26)**, with a trend from 2021/22.
- **Category ranks:** a school's in-category ranks that count Combined Science gain it. Leighton Park's Biology goes from "2nd of 3" → "2nd of 4 in Sciences & Maths".
- **Methods:** the "Double Award shows no points" sentence sat on 22 Teacher views, including Columns 2 and 3, which already scored it. All 22 now say what the code does.
- **Rules:** R-KS4-POINTS-GCSE-FULL no longer contradicts R-DOUBLE-AWARD-POINTS. R-DOUBLE-AWARD-POINTS now also checks Column 1: "4.8 in 2025, BTEC null".

### 3 — SMT bugs (S1, S2, S3)

- **S1:** the flags caption is filled one way (`flagsRuleText`).
  - Before: "…results moving at least the set's middle by a fixed margin faster than the set's middle…".
  - After: "…results whose two-year change differs from the set's middle change by at least 2 Attainment 8 points at GCSE or 3 A-level points per entry at Post-16 (with at least 4 set schools to compare)…".
  - Five forms are tested: GCSE only, Post-16 only, both, an IGCSE school with a sixth form, and a primary (no results clause).
- **S2:** the highlighted ages now come from `levelAges`, first and last inclusive.
  - GCSE goes from Y7–Y12 → **Y7–Y11**. Primary goes from R–Y7 → **R–Y6**.
  - Both edges are tested. R-SMT-PUPILS-LEVEL's own check expected the wrong ages, so it had passed; it now names the year groups lit.
- **S3:** the indexed charts' tables (roll, roll by phase, births) show each line's pupils (or births) **and** its index, in two labelled columns.
  - Before: index values under a label that reads as pupils, and actual births under "2012 = 100".
- **Pairs:** in SMT's data, the new `actual` figures on roll and phase lines, and the highlight (`[11,16]` → `[11,15]`). In the page, the flags caption, the Pupils bars and the three tables.

### 4 — Index base years say the real year (A7, S3)

- **One helper:** `src/lib/index-base.ts` holds `indexTo` (moved from Admissions, re-exported there) and the words for its base.
- **Labels:** every "= 100" header and caption names the year the lines share. Where they share none, it says "each line's first year". An empty chart says only "indexed".
- **Test:** `src/lib/index-base.test.ts` checks lines that share only a later year, a gap, and no shared year.
- **Pairs:**
  - Admissions' Pool trends header at 4+ ("indexed, 2019/20 = 100" over an empty chart → "indexed").
  - One subpixel run in "Indexed: 2019/20 = 100." on the phone Market share page (same words, the label now one text run). That is 24 pixel-only pairs, all the same 4×8-pixel spot.
  - SMT headers for schools whose lines start later. **Chellaston Academy** (148639): roll "2019/20 = 100" → **"2021/22 = 100"**. St Mark's (116342) roll by phase: **"2022/23 = 100"**.

### 5 — Admissions labels and notes (A1, A2, A8)

- **A1:** the pool and group-share notes are part of each view's method (`notes`), drawn first in its (i).
  - The pool note is on the 8 views that show the pool. It is off Now, Shape, the cohort views and Area population.
  - The group-share note is on the 9 views that show shares of the group. It is off the results, momentum, flags, shapes, You-and-the-rivals and roll views.
- **A2:** your wording, "Births in the local authority blend; the Reception-to-births ratio sets the range.", at 4+. The code scales births at 11+ and 16+ (`ladder.ts`), so those keep an accurate "scaled" note: Admissions' pipeline legend and SMT's pool table hover.
- **A8:**
  - "Market share change" → **"Change in share"**. "Roll trends" → **"Entry age band roll"**.
  - The Entry table keeps its columns (the wireframe has no change column, and the title never said "change"); its `pct_change` number type is dropped.
  - At 16+ the local shape caption names the set. Before: "All pupils aged 4–15 in your 15 feeder schools". After: "All pupils aged 4–11 in **the 15 nearest primaries**".
- **Pairs:**
  - The two renamed labels on every Market share page: rail titles, aria-labels and panel names.
  - The births hover on the 4+ pipeline legend.
  - The 16+ local shape caption: 8 pairs (117037 and 137625 at 16+).

### 6 — The girls/boys filter (A9)

- **`ADM_SEX_FILTER`** lists every Admissions view as either "applies" or "not-split"; R-ADM-SEX-FILTER checks it against the data.
- **Split this round (the census already holds girls and boys):**
  - the entry tiles (cohort, change, roll, boarders, day);
  - the entry trend line, bars and table;
  - the feeder table and map (pupils, change, flag against the set's girls or boys);
  - the rivals' rolls;
  - the pipeline chart's feeder flags.
- **Pool trends** splits the feeders' line and hides the LA and England lines while a sex is chosen, saying so.
- **Not split, and saying "Not split by sex: girls and boys together." while it is on:** both Shape views, Area population, Strengths and weaknesses, the three Academic views, Rivals' momentum and Flags. Momentum and Flags set pupils against results, so their pupils stay whole.
- **Pairs:** none in parity, which runs with all pupils. The screenshot shows the note.

### 7 — One minimum for subject areas (S7)

- **One constant:** `SUBJECT_AREA_MIN = { schools: 2, entries: 10 }`. A row in SMT's Strengths and weaknesses, and the Academic rank tile, need at least 2 set schools with 10+ entries (as the school must have).
- **Wording:** the empty state and the tile's reason are filled from the constant. Tested at each edge.
- **Pairs:** the rank tile's sub-line, "of 11, schools with Sciences & Maths results" → "of 11, schools with **10+** Sciences & Maths entries". No row disappeared for the three schools.

### 8 — Three method decisions (logged for you to confirm)

- **T2, ties shared everywhere.**
  - Teacher's headline rankings now use standard competition ranking; a shared place reads "=3rd" on the ranking's note, its tile and the whole-school tile.
  - The Chase on Attainment 8 nationally: one position among the tied schools (it depended on their URN order) → **"=869th"** (51.9, shared with 11 schools).
  - R-RANK-TIES now has a check. Category tiles already shared ties and show no "=".
- **T7, kept:** the change in the yearly average, with the school out of its own set's average. The change-list method says both plainly.
- **A6, kept as one age:** R-ADM-FLAG-FEEDER now says so.
  - For you: the pipeline chart's own feeder flags still read every age the feeder set holds, so they can differ from the feeder table's for a set that spans ages. A one-line change if you want them to match.

### 9 — Head office sees the school's saved catchment

- **Read:** once `smtCaller` has checked head office's access, the server reads the school's saved catchment with the service key. This is the pattern Admissions' shared reads use, and it avoids a new RLS policy, which couldn't make the production membership check the server makes.
- **Write:** never. The route refuses it, and head office's own token reads and writes nothing (3 new RLS checks).
- **Radius:** head office can still change the radius for its own view (`?km=`).
- **Pairs:** none in parity (no head-office case). `catchment.test.ts` and the RLS test cover both cases.

### 10 — The five rules after GCSE 2025/26

| Rule | 2024/25 | 2025/26 (new) | How it reads the year |
|---|---|---|---|
| R-TREND-LINE-4YR | 4 years points, 4 years Grade 4+ | **5 and 5** (2021/22–2025/26) | fixture row |
| R-THRESHOLD-PERIODS | 2021–2024 / 2023–2024 | **2021–2025 / 2023–2025** | relationship: HISTORIC_GRADE_FROM (or MODERN_GRADE_FROM) to the latest year |
| R-TREND-TABLE-YEARS | card shows 2022/23 + 2024/25, 2 hidden | **2022/23 + 2025/26, 3 hidden** at GCSE (Post-16 still 2024/25) | relationship: TREND_BASE_PERIOD and the stage's latest |
| R-CURRENT-GRADES-FROM-2324 | Latin "vs last year" none | **−5.68** (81.82% against 87.50%) | fixture row |
| R-SMT-FLAGS | The Chase flagged (results rising faster than the set) | **not flagged**: +1.0 against the set's −0.6, a gap of 1.6 under the 2-point threshold | fixture row; the app's flag must equal the rule recomputed from raw rows |

R-SMT-FLAGS' premise changed with the data: The Chase is no longer far enough ahead of its set to be flagged. The rule now checks that the app flags exactly when the rule says, and the fixture says which.

**R-YEARS-ROLLOVER** (new) moves the latest KS4 year to 2026/27 with the data unchanged. All five then fail saying "no expected value for 2026/27"; none fails on a number.

The SQL that found the values (production `hrqrbvrrhlidpoybezhs`, the rollup tables the app's lookups read; read-only):

```sql
-- Acland Burghley (100053): Maths points years, grade years, latest
select string_agg(period::text, ',' order by period) from academic_subject_headline
 where entity_id='100053' and ks_stage='ks4' and subject='Mathematics' and coalesce(bucket,'all')='all' and avg_point_score is not null;
  -- 2021,2022,2023,2024,2025
select string_agg(distinct period::text, ',') from academic_subject_grade_rollup
 where entity_id='100053' and ks_stage='ks4' and subject='Mathematics' and qualification_type='GCSE (9-1) Full Course';
  -- 2021,2022,2023,2024,2025
select latest_period from academic_current_periods() where ks_stage='ks4';   -- 2025 (ks5: 2024)

-- Latin and Turkish at 100053: Grade 4+ = 9-4 over every graded entry (9-1, U)
select subject, period, sum(entries) filter (where grade in ('9','8','7','6','5','4')) g4,
       sum(entries) filter (where grade in ('9','8','7','6','5','4','3','2','1','U')) graded
  from academic_subject_grade_rollup
 where entity_id='100053' and ks_stage='ks4' and subject in ('Latin','Turkish') and qualification_type='GCSE (9-1) Full Course'
 group by 1,2 order by 1,2;
  -- Latin 2022 14/14, 2024 7/8 (87.50%), 2025 9/11 (81.82%); Turkish 2021 only

-- The Chase and its 10 nearest: Attainment 8 2023/24 -> 2025/26
with a8 as (select entity_id, period, (measures->>'attainment8_average')::numeric v from academic_headline_snapshot
             where ks_stage='ks4' and period in (2023,2025) and entity_id in ('137625','137186','137101','136890','136803','116999','137051','138107','135913','136897','136925')),
     ch as (select entity_id, max(v) filter (where period=2025) - max(v) filter (where period=2023) change from a8 group by 1)
select (select change from ch where entity_id='137625'),
       (select percentile_cont(0.5) within group (order by change) from ch where entity_id<>'137625' and change is not null),
       (select count(*) from ch where entity_id<>'137625' and change is not null);
  -- 1.0, -0.6, 10

-- The Chase GCSE History and King's Worcester A level Mathematics: graded years
  -- 137625 History ks4: 2021-2025; 117037 Mathematics ks5: 2021-2024
```

## Leighton Park (110110), before and after

| Where | Before (`main`) | After |
|---|---|---|
| SMT Academic, GCSE | "IGCSE school · no comparable GCSE results"; no rank | the same; set, region and England GCSE ranks of *other* schools now leave all 411 IGCSE schools out |
| SMT Overview, GCSE rows | "not ranked: IGCSE" | the same |
| SMT Post-16 | A level 7th of 10 in the set, 424th of 2,536 in England | **unchanged** (identical in the data diff) |
| Teacher, a GCSE ranking | ranked by position among a population that included IGCSE schools | "Leighton Park School is not ranked at GCSE (IGCSE)." no rank, no "out of" |
| Teacher, a GCSE subject ranking | placed against the population | not placed; the window leaves it out |
| Teacher, 10 nearest at GCSE | the 10 nearest less 5 dropped IGCSE schools (fewer than 10, unsaid) | 10 eligible schools, "17 schools not ranked at GCSE (mostly IGCSE); the 10 nearest eligible reach 21 km" |
| Teacher, Comparisons map | drew the school itself | leaves it out ("1 not shown") |
| Teacher, Column 1 | Biology 6.9, "2nd of 3 in Sciences & Maths", "+0.6 above England average" | the same, "2nd of **4**" (Combined Science now scored, item 2): **still a rank within its own subjects and a gap to England**, question 1 |
| Admissions | listed, "IGCSE", not ranked | the same; other schools' places leave it out |

## Views whose method text changed (65 of 111)

- **Teacher (26).**
  - Double Award, in sources and left out: DV-C1-RES-CUR-TILES (and its steps), DV-C1-RES-CUR-BAR, -CUR-TABLE, -TR-CHART, -TR-TABLE, -TR-MAP, DV-C1-RES-TR-GEO-CHART, -GEO-TABLE, every DV-C2 view, every DV-C3 view.
  - The IGCSE sentence, on those same views.
  - DV-C3-CUR-RANKING: the population caveat.
  - DV-C3-TR-CHANGELIST: T7.
- **Admissions (30).**
  - The notes (A1): P-PIPELINE, P-FUNNEL, P-MAP, P-TABLE, P-POOL-INDEXED, P-POOL-TABLE, P-HOLD-LINE, P-HOLD-TABLE, M-NOW, M-DONUT, M-BARS, M-MAP, M-TABLE, M-SHARE-LINE, -NUM, -RANKS, -CHANGE.
  - The girls/boys filter: P-NOW, P-MAP, P-TABLE, P-ENTRY-LINE, -BARS, -TABLE, P-POOL-INDEXED, -TABLE, P-SHAPE, P-AREA-POP, M-MOMENTUM, M-STRENGTHS, M-SHAPE, M-FLAGS, M-ACAD-RANK, -NUM, -CHANGE, M-NOW, M-TABLE.
  - IGCSE in the population: M-ACAD-RANK, M-ACAD-NUM.
  - P-SHAPE: the 16+ caption.
- **SMT (9).**
  - IGCSE: DV-SMT-O-NOW, -O-SCORECARD, -A-NOW, -A-SUBJECTS.
  - The minimum: -A-AREAS, -A-NOW.
  - The tables: -O-ROLL-TABLE, -P-PHASES-TABLE, -C-BIRTHS-TABLE.
  - The ages: -P-SHAPE.

## Screenshots (`docs/v0.8/audit_fixes_screenshots/`)

- **`teacher_leighton_park_gcse_main.png`, `teacher_leighton_park_gcse_br.png`:** Teacher at GCSE, before and after. After: the 10 nearest line and the map leaving the school out.
- **`smt_academic_leighton_park_gcse.png`:** "IGCSE school", no rank.
- **`teacher_chase_column1_double_award_main.png`, `_br.png`:** The Chase with Combined Science on the bar.
- **`smt_overview_chellaston_roll_indexed_2021.png`:** "2021/22 = 100".
- **`admissions_girls_not_split_by_sex.png`:** Girls chosen; the Academic panel's "Not split by sex".
- **`smt_pupils_chase_gcse.png`, `smt_pupils_st_marks_primary.png`:** Y7–Y11 lit, and R–Y6 lit. St Mark's roll by phase also shows "2022/23 = 100".

## Questions for you

1. **Leighton Park at GCSE in Teacher's Column 1.** It still shows its own GCSE subject figures, with a rank among its own subjects and a gap to England's average. These are real GCSE entries (Biology 6.9), not the headline the IGCSE rule withholds. Should an IGCSE school's own subject figures be hidden at GCSE as well, as SMT does? Or are in-school ranks fine, with "GCSE rank" meaning ranks against other schools? I stopped before merging on this, per the prompt.
2. **A2, one note or two.** At 11+ and 16+ the births *are* scaled, so your wording appears at 4+ only. Keep two notes?
3. **A6:** make the pipeline chart's feeder flags one age too?
4. **T2:** "=" on category ranks as well?
5. **Found, not fixed:** Context's "Population by age" header still says "within 5 miles" whatever the catchment (round 3 leftover).
