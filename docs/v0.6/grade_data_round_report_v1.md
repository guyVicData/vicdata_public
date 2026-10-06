# VicData 0.6.2, grade data round: report

Branch `v0.6.2-grades`, from `main` (e109b98). Pushed, **not merged**. **Members' figures change on purpose** in this round: grade trends gain 2021/22–2022/23, and every grade and points trend statement is now measured from 2022/23. Every latest-year figure is unchanged (checked pixel by pixel, below).

**Checks on every commit:** `tsc --noEmit`, eslint on the changed files and `next build` clean; unit tests 325/325 at the end (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`); real-data rule tests `PASS=12, FAIL=0, ERROR=0` (MANUAL 15, NONE 16, SUPERSEDED 2). No migration was applied, no database was written, and no server key went into client code or a browser bundle.

Read with `docs/OPEN_QUESTIONS.md`, "2026-10-05 — 0.6.2 grade data round" (S1–S5, and "6 Oct: Guy's decisions"), and `docs/v0.6/grade_rollup_reconciliation_v1.md` (S1).

## What Guy needs to do

1. **Apply the grade rollup read path** (optional for correctness, needed for speed). `docs/v0.6/proposed_sql/vicdata_academic_subject_grade_rollup_lookup.sql` is for the **vicdata production data database** (`hrqrbvrrhlidpoybezhs`, the ingest repo), not this repo's project, so it isn't in `supabase/migrations/` here. Per its header:
   ```
   TS=$(date -u +%Y%m%d%H%M%S)
   cp /Users/guy/dev/vicdata_public/docs/v0.6/proposed_sql/vicdata_academic_subject_grade_rollup_lookup.sql \
      /Users/guy/dev/vicdata/supabase/migrations/${TS}_academic_subject_grade_rollup_lookup.sql
   cd /Users/guy/dev/vicdata          # linked to hrqrbvrrhlidpoybezhs
   supabase db query --linked -f supabase/migrations/${TS}_academic_subject_grade_rollup_lookup.sql
   supabase migration repair --status applied ${TS} --linked
   ```
   - It creates one `security definer` function and grants `execute` to `anon`. It changes no table, no RLS and no data. Tested on PGlite: `node supabase/tests/v062_s1_grade_rollup_lookup_pglite.mjs` (8/8).
   - Then **restart / redeploy vicdata_public**. The server remembers "RPC absent" once per process, so a running server keeps using the facts until it restarts.
   - Until then, GCSE grades come from the modern + historic facts, which S1 proved equal to the rollup on every key. Nothing is wrong; it's just slower (timings below).
2. **Review the deliberate changes**, below, and the calls in "Calls made".
3. **Merge** when you're happy with the changes (the branch is pushed).

## Stages and commits

| Commit | What |
|---|---|
| `4f706c8` | S1: reconcile the grade rollup (no app change) |
| `52c7e71` | S2: four years of school grades |
| `9c470ff` | S3: comparator grades from the rollup |
| `31b5121` | S4: the 2021/22 grading note |
| `50968c0` | S4b: trends measured from 2022/23, latest-year rows from 2023/24 on (Guy's decisions A, B, C) |
| `b5185e5` | S5: parity and before/after |
| (this) | S6: report |

## Reconciliation decision, per phase (S1)

| Phase | Source for 2021/22–2024/25 | Why |
|---|---|---|
| GCSE (KS4) | **The rollup**, through the new lookup RPC once applied; until then the modern + historic facts (identical on every key) | The rollup equals the facts in all four years, nationally (4,950,392 / 5,073,301 / 5,201,165 / 5,120,856 entries) and per grade (The Chase History 95, 91, 121, 132). It's the only source that can be filtered to one subject in the database. |
| Post-16 (KS5) | **The historic facts**, read with the same parser | The rollup's numbers match, but it has no zero-entry grade rows, which the app draws (127 of 155 sampled subjects). The "−0.9%" in historic KS5 is the IB non-subject rows. 2021/22–2022/23 vocational short codes are mapped by qualification (R-HISTORIC-GRADE-LABELS). |

## What changed

- **Four years of school grades** (S2): Grade 4+ / A*–E, Grade bands and Grade counts read 2021/22–2024/25 (`subjectData.gradeDistribution`). Two-year bars become four-year lines (R-TREND-LINE-4YR). The Data View's deep-dive drawer is unchanged (still 2023/24–2024/25).
- **Comparator grades** (S3): `/api/teacher/comparator-grades` serves one subject, four years. "Across schools" grade lines are no longer greyed: Grade 4+ / bands from each school's own grade counts; Grade counts as each grade's average share (R-COMPARATOR-GRADE-SHARE).
- **Guy's decision B, trends measured from 2022/23** (S4b, R-TREND-FROM-2223, replacing S4's R-2122-GRADING-NOTE): 2021/22 stays on every graph and table, but every statement is measured from 2022/23. **This applies to points as well as grades, so points trends change on live.** Statements that change, for points and grades alike:
  - the Trend sentence ("… since 2022/23") and its direction word (Growing / Broadly stable / Declining), on the card's flag, the collapsed panel and in fullscreen: Results, Context, and Comparisons' headline (Attainment 8, A level points per entry) and subject points;
  - the group clause ("against … over the same years") and Comparisons' "vs:" clause;
  - every year table's Change column: Trend tables, % change tables, Results' area change table (LA / region / England), Comparisons' change table. On the card the two year columns are now 2022/23 and the latest; fullscreen still shows every year;
  - ranked change lists (Results, Context, Comparisons' ranked bars), their reference line, the % change summary ("X has grown the most … since 2022/23") and the collapsed change figure;
  - Comparisons' change map and Trend map;
  - a fitted Trend line (fitted on 2022/23 on, drawn from 2022/23);
  - a short span's ranked change bars; a slope view from the span's first year;
  - Grade counts' change table (from 2022/23; its "From" menu starts there).
  - **Not changed:** Candidates (entries) anywhere, KS2, indexed lines (entries only), line charts (2021/22 is still a normal point), and a Trend whose "From" year is 2022/23 or later.
- **Guy's decision A, latest-year views from 2023/24** (S4b, R-CURRENT-GRADES-FROM-2324): Current's subject list, year menu and "vs last year" on a grade measure read the 2023/24-on rows, as before the round. Subjects with grades only in 2021/22–2022/23 appear on the Trends only.
- **Guy's decision C, the note** (`TREND_BASE_NOTE`, one place: `src/catalogue/notes.ts`):
  > Trends are measured from 2022/23. 2021/22 is still shown, but its grades were awarded more generously (Ofqual's transition year after the pandemic), so measuring from it would make most schools look as if results had fallen.

  It sits where S4's did: after the source in the panel's "i", and as text in fullscreen and "Print this graph". Only on views whose drawn years include 2021/22; never on a latest-year view, on Candidates or at KS2. Points trends carry it too.
- **Wording that changed on live** (old copy became untrue): the Results / Context notes lose "… published per grade only from 2023/24, so this covers fewer years …"; Grade counts' one-year note now reads "This subject has published grades for one year only; …".
- **A fullscreen fix** (S5, `CardBox`): on a phone, the long note squeezed a line chart over its own caption. Below lg the fullscreen area now never shrinks below its content and the modal scrolls. Views without the note are pixel-identical to main.

## Parity (S5)

On the 0.6.1 harness (the members' Teacher page on captured real data; scripts and outputs in `docs/v0.6/audit_scripts/grade_rollup/s5/`). The matrix: 137625 GCSE History, 100053 GCSE, 117037 Post-16 Maths and 130432 Post-16 BTEC; Candidates and all four Results measures; a saved band range; Grade bands 9–4 (new this run, both GCSE schools); Compared against category, all and selected; 1280 and 390; both themes; every panel and every rail view.

- **The first run stopped** on 136 latest-year diffs (Turkish / Latin rows on Current, Latin's "vs last year" reaching back to 2022/23, a 3 px column and 146 map pixels). That led to Guy's decisions A–C.
- **The final run, on the committed S4b tree: 4,000 pairs, 0 unexpected.**

| Kind | Pairs | What |
|---|---|---|
| IDENTICAL | 1,356 | Every Candidates view; every points Current view |
| NOTE-ONLY | 844 | Same pixels and words; the "i" only loses S2's retired "per grade only from 2023/24" clause. No Current view gained a note |
| EXP-YEARS | 1,352 | Grade Trends gaining 2021/22–2022/23: bars → lines, statements from 2022/23, the note |
| EXP-STATEMENT | 432 | Points Trends (and Context / Comparisons on Grade counts' points fallback): statements since 2022/23, the note |
| EXP-PICKER | 16 | Grade counts' "From" menu gains its chevron |
| UNEXPECTED | **0** | |

- **Every latest-year view is main's:** 1,672 Current pairs, 0 word diffs, 0 pixel diffs. The map's 146 pixels and Column 1's 3 px are gone. Both appeared only in the six shots whose Context Current gained the Turkish row (100053, 1280, category, the three grade states), so they were layout knock-ons of that row.
- 7,212 Trend-table rows checked: every latest-year value equals main's. No graded Trend on the branch says "since 2021/22".
- 44 views exist only on the branch: Comparisons' Trends "Chart" on grade measures, now that there are four years (R-TREND-LINE-4YR).
- **Not covered by parity:** the editor's step 1 / step 3 ticks for across-schools grade lines (covered by unit tests on `compareHonest`, `src/lib/view-editor.test.ts`, not by pixels); fullscreen and print (except the screenshots); saved comparator sets (the harness stubs none); KS2; meeting slots.

## Before/after, named schools

Each tree's own functions on its own captured real data (`s5/ba2.mts.txt`, `ba2_main.json` / `ba2_br.json`). "Change" is the panel's honest change (pp on rates); "vs last year" is Current's column.

| School | Subject | Figure | Before (main) | After (branch) |
|---|---|---|---|---|
| The Chase (137625) | History (GCSE (9-1) Full Course) | Grade 4+ / A*–E by year | 2023/24 74% · 2024/25 76% | 2021/22 82% · 2022/23 71% · 2023/24 74% · 2024/25 76% |
| The Chase (137625) | History (GCSE (9-1) Full Course) | …direction word; change since first year | Broadly stable; +2pp since 2023/24 | Growing; +4pp since 2022/23 |
| The Chase (137625) | History (GCSE (9-1) Full Course) | …latest year; vs last year (Current) | 76%; +2pp | 76%; +2pp |
| The Chase (137625) | History (GCSE (9-1) Full Course) | Grade bands 4–9 by year | 2023/24 74% · 2024/25 76% | 2021/22 82% · 2022/23 71% · 2023/24 74% · 2024/25 76% |
| The Chase (137625) | History (GCSE (9-1) Full Course) | …direction word; change | Broadly stable; +2pp since 2023/24 | Growing; +4pp since 2022/23 |
| The Chase (137625) | History (GCSE (9-1) Full Course) | Grade bands 7–9 by year | 2023/24 35% · 2024/25 34% | 2021/22 52% · 2022/23 40% · 2023/24 35% · 2024/25 34% |
| The Chase (137625) | History (GCSE (9-1) Full Course) | …direction word; change | Broadly stable; −1pp since 2023/24 | Declining; −5pp since 2022/23 |
| The Chase (137625) | History (GCSE (9-1) Full Course) | Grade counts: years; change table from | 2023/24 2024/25; 2023/24 | 2021/22 2022/23 2023/24 2024/25; 2022/23 |
| The Chase (137625) | History (GCSE (9-1) Full Course) | …top grades, change table | 9: 15 → 11; 8: 15 → 14; 7: 12 → 20 | 9: 9 → 11; 8: 18 → 14; 7: 9 → 20 |
| The Chase (137625) | History (GCSE (9-1) Full Course) | Comparisons, 10 nearest, Grade 4+ / A*–E line (schools) | 2023/24 63% (10) · 2024/25 61% (10) | 2021/22 71% (10) · 2022/23 64% (10) · 2023/24 63% (10) · 2024/25 61% (10) |
| The Chase (137625) | History (GCSE (9-1) Full Course) | …direction word; change | Broadly stable; −2pp since 2023/24 | Declining; −3pp since 2022/23 |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | Grade 4+ / A*–E by year | 2023/24 76% · 2024/25 74% | 2021/22 74% · 2022/23 67% · 2023/24 76% · 2024/25 74% |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | …direction word; change since first year | Broadly stable; −3pp since 2023/24 | Growing; +7pp since 2022/23 |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | …latest year; vs last year (Current) | 74%; −3pp | 74%; −3pp |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | Grade bands 4–9 by year | 2023/24 76% · 2024/25 74% | 2021/22 74% · 2022/23 67% · 2023/24 76% · 2024/25 74% |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | …direction word; change | Broadly stable; −3pp since 2023/24 | Growing; +7pp since 2022/23 |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | Grade bands 7–9 by year | 2023/24 49% · 2024/25 41% | 2021/22 43% · 2022/23 31% · 2023/24 49% · 2024/25 41% |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | …direction word; change | Declining; −7pp since 2023/24 | Growing; +10pp since 2022/23 |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | Grade counts: years; change table from | 2023/24 2024/25; 2023/24 | 2021/22 2022/23 2023/24 2024/25; 2022/23 |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | …top grades, change table | 9: 21 → 25; 8: 21 → 13; 7: 18 → 12 | 9: 10 → 25; 8: 21 → 13; 7: 9 → 12 |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | Comparisons, 10 nearest, Grade 4+ / A*–E line (schools) | 2023/24 78% (10) · 2024/25 71% (10) | 2021/22 73% (10) · 2022/23 70% (10) · 2023/24 78% (10) · 2024/25 71% (10) |
| Acland Burghley School (100053) | History (GCSE (9-1) Full Course) | …direction word; change | Declining; −7pp since 2023/24 | Broadly stable; 0pp since 2022/23 |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | Grade 4+ / A*–E by year | 2024/25 88% | 2022/23 100% · 2024/25 88% |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | …direction word; change since first year | —; — | Declining; −12pp since 2022/23 |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | …latest year; vs last year (Current) | 88%; — | 88%; — |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | Grade bands 4–9 by year | 2024/25 88% | 2022/23 100% · 2024/25 88% |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | …direction word; change | —; — | Declining; −12pp since 2022/23 |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | Grade bands 7–9 by year | 2024/25 50% | 2022/23 57% · 2024/25 50% |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | …direction word; change | —; — | Declining; −7pp since 2022/23 |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | Grade counts: years; change table from | 2024/25; — | 2022/23 2024/25; 2022/23 |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | …top grades, change table | 9: ; 8: ; 6:  | 9: 2 → 3; 8: 5 → 1; 7: 1 → 0 |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | Comparisons, 10 nearest, Grade 4+ / A*–E line (schools) | 2024/25 100% (1) | 2022/23 100% (1) · 2024/25 100% (1) |
| Acland Burghley School (100053) | Latin (GCSE (9-1) Full Course) | …direction word; change | —; — | Broadly stable; 0pp since 2022/23 |
| The King's School Worcester (117037) | Mathematics (GCE A level) | Grade 4+ / A*–E by year | 2023/24 100% · 2024/25 100% | 2021/22 100% · 2022/23 100% · 2023/24 100% · 2024/25 100% |
| The King's School Worcester (117037) | Mathematics (GCE A level) | …direction word; change since first year | Broadly stable; 0pp since 2023/24 | Broadly stable; 0pp since 2022/23 |
| The King's School Worcester (117037) | Mathematics (GCE A level) | …latest year; vs last year (Current) | 100%; 0pp | 100%; 0pp |
| The King's School Worcester (117037) | Mathematics (GCE A level) | Grade bands A* to B by year | 2023/24 88% · 2024/25 69% | 2021/22 84% · 2022/23 80% · 2023/24 88% · 2024/25 69% |
| The King's School Worcester (117037) | Mathematics (GCE A level) | …direction word; change | Declining; −19pp since 2023/24 | Declining; −12pp since 2022/23 |
| The King's School Worcester (117037) | Mathematics (GCE A level) | Grade bands A* to A by year | 2023/24 61% · 2024/25 40% | 2021/22 71% · 2022/23 57% · 2023/24 61% · 2024/25 40% |
| The King's School Worcester (117037) | Mathematics (GCE A level) | …direction word; change | Declining; −21pp since 2023/24 | Declining; −17pp since 2022/23 |
| The King's School Worcester (117037) | Mathematics (GCE A level) | Grade counts: years; change table from | 2023/24 2024/25; 2023/24 | 2021/22 2022/23 2023/24 2024/25; 2022/23 |
| The King's School Worcester (117037) | Mathematics (GCE A level) | …top grades, change table | A*: 0 → 8; *: 22 → 0; A: 12 → 6 | A*: 0 → 8; *: 14 → 0; A: 18 → 6 |
| The King's School Worcester (117037) | Mathematics (GCE A level) | Comparisons, 10 nearest, Grade 4+ / A*–E line (schools) | 2023/24 100% (2) · 2024/25 100% (2) | 2021/22 97% (2) · 2022/23 100% (2) · 2023/24 100% (2) · 2024/25 100% (2) |
| The King's School Worcester (117037) | Mathematics (GCE A level) | …direction word; change | Broadly stable; 0pp since 2023/24 | Broadly stable; 0pp since 2022/23 |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | Grade 4+ / A*–E by year | 2023/24 — · 2024/25 — | 2021/22 — · 2022/23 — · 2023/24 — · 2024/25 — |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | …direction word; change since first year | —; — | —; — |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | …latest year; vs last year (Current) | —; — | —; — |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | Grade bands Distinction* to Merit by year | 2023/24 51% · 2024/25 62% | 2021/22 82% · 2022/23 23% · 2023/24 51% · 2024/25 62% |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | …direction word; change | Growing; +11pp since 2023/24 | Growing; +39pp since 2022/23 |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | Grade bands Distinction* to Distinction by year | 2023/24 12% · 2024/25 8% | 2021/22 22% · 2022/23 4% · 2023/24 12% · 2024/25 8% |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | …direction word; change | Declining; −5pp since 2023/24 | Growing; +3pp since 2022/23 |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | Grade counts: years; change table from | 2023/24 2024/25; 2023/24 | 2021/22 2022/23 2023/24 2024/25; 2022/23 |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | …top grades, change table | Distinction*: 0 → 0; Distinction: 7 → 5; Merit: 22 → 35 | Distinction*: 1 → 0; Distinction: 2 → 5; Merit: 13 → 35 |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | Comparisons, 10 nearest, Grade 4+ / A*–E line (schools) | 2023/24 — · 2024/25 — | 2021/22 — · 2022/23 — · 2023/24 — · 2024/25 — |
| Croydon College (130432) | Business Studies (BTEC National Extended Certificate L3 - Band F - P-D*) | …direction word; change | —; — | —; — |

**Points trend statements** (the same figures; only the span they're measured over changes):

| School | Trend | Before (main) | After (branch) |
|---|---|---|---|
| The Chase (137625) | History average points | History's average points has fallen from 6.0 to 5.3; a fall of 0.7 points since 2021/22. (Declining) | History's average points has stayed roughly level from 5.5 to 5.3; a change of 0.2 points since 2022/23. (Broadly stable) |
| The Chase (137625) | Attainment 8 | Your school's Attainment 8 has stayed roughly level from 53.6 to 51.9; a change of 1.7 points since 2021/22. (Broadly stable) | Your school's Attainment 8 has grown from 49.4 to 51.9; a rise of 2.5 points since 2022/23. (Growing) |
| The Chase (137625) | 10 nearest schools' average Attainment 8 | the 10 nearest schools' average has fallen from 50.4 to 46.4; a fall of 4.1 points since 2021/22. (Declining) | the 10 nearest schools' average has stayed roughly level from 47.0 to 46.4; a change of 0.6 points since 2022/23. (Broadly stable) |
| The King's School Worcester (117037) | Mathematics average points | Mathematics's average points has fallen from 49.1 to 41.7; a fall of 7.4 points since 2021/22. (Declining) | Mathematics's average points has fallen from 45.2 to 41.7; a fall of 3.5 points since 2022/23. (Declining) |
| The King's School Worcester (117037) | A level points per entry | Your school's A level points per entry has fallen from 45.4 to 42.6; a fall of 2.8 points since 2021/22. (Declining) | Your school's A level points per entry has stayed roughly level from 43.3 to 42.6; a change of 0.6 points since 2022/23. (Broadly stable) |
| The King's School Worcester (117037) | 10 nearest schools' average A level points per entry | the 10 nearest schools' average has grown from 42.6 to 45.5; a rise of 2.9 points since 2021/22. (Growing) | the 10 nearest schools' average has grown from 42.4 to 45.5; a rise of 3.2 points since 2022/23. (Growing) |

Observations, not changed:
- King's Maths A-level Grade counts lists a "*" grade in 2023/24 (22 entries) beside "A*" in 2024/25. It's the same on main: the 2023/24 modern file's own label.
- Acland Latin's Grade 4+ sentence says "a fall of 13 percentage points" where the change column says "−12pp" (100% → 87.5%). Two roundings of 12.5 that already disagree on main.

## Timings (comparator grades, S3)

Read-only against production, medians of 3. Before = the old route's read (modern facts, every subject); after = what runs today (the facts fallback, because the RPC isn't applied).

| Set | Before | After (facts, 4 years) | After the RPC is applied (estimate) |
|---|---|---|---|
| The Chase + 10, GCSE History | 484 ms (220 rows) | 618 ms (435 rows) | ≈ 70–110 ms |
| Acland Burghley + 10, GCSE Maths | 156 ms | 218 ms | (GCSE: same path) |
| King's Worcester + 10, A-level Maths | 187 ms | 185 ms | Post-16 stays on the facts |
| Croydon College + 10, Business Studies | 255 ms | 267 ms | Post-16 stays on the facts |

The estimate: the RPC's body, run read-only as SQL for The Chase + 10 History, takes 62 ms cold and 21–22 ms warm, plus the ≈ 50 ms HTTP floor S1 measured. It is not a measured HTTP call, because the RPC isn't applied.

## Migrations

- **One, proposed, not applied:** `docs/v0.6/proposed_sql/vicdata_academic_subject_grade_rollup_lookup.sql`, for the vicdata data database (apply steps above). No index: every read is entity-led and served by the primary key and `entity_idx`.
- Nothing for this repo's database.

## Held back (for Guy)

- **Band scale (`bestScale`) and the IB 7–1 scale:** the scale is still chosen from the 2023/24-on rows. On four years, 13 of 711 sampled small GCSE cohorts with no 8 or 9 since 2023/24 (e.g. 150127 Art & Design) would read as GCSE rather than IB 7–1. That fixes a latent bug (they get no Grade bands figure today), but it would change a latest-year figure. Suggest a follow-up: pick the scale with a GCSE tie-break, not by length.
- **The Data View's deep-dive drawer** is unchanged (modern years only); giving it four years would change a figure outside this round.
- **"Saved set…" stays greyed outside Comparisons**, as for every measure (an existing rule).
- **The note sits in the "i" popover** on the card (S11 moved every caveat there), and as text in fullscreen and print. Say if it should be visible on the card itself.
- **Found, not fixed** (pre-existing): `lookupReferenceData`'s 50-page cap (it now warns; the new grade reads chunk by 25 schools); a year table's points change that rounds to nothing prints "−0.0"; Context's change summary can read "X has grown the most (−0.1)" when every subject fell.

## Calls made (logged in OPEN_QUESTIONS.md)

- S1: KS4 on the rollup (RPC, facts until applied), KS5 on the historic facts; per-era lineage fallback in the RPC.
- S2: R-HISTORIC-GRADE-LABELS (KS5 vocational codes by qualification; "COVID result" and "Supp" are non-grades); KS4 historic labels left raw; the Data View drawer unchanged.
- S3: Grade counts across schools is each grade's average share (R-COMPARATOR-GRADE-SHARE), drawn as ticks in place of England's; "Weighted" greyed on counts.
- S4b, under Guy's decision B:
  - year tables show 2022/23 and the latest on the card, every year in fullscreen;
  - the % change half keeps 2021/22 drawn (Results' area chart stays a four-year line; a first version that started the half at 2022/23 turned it into three-year bars, so it was reverted), so both "From" menus still say "From 2021/22" while titles and sentences say "since 2022/23" (the note explains);
  - a slope from the first year starts at 2022/23, but an editor's fixed 2021/22 is honoured;
  - Grade counts' spread may still be compared with 2021/22 (a picture, with the note);
  - KS2 is outside the rule; indexed lines are entries only, so unaffected.
- S4b, under Guy's decision A: Current hands its views a frame of its own (2023/24-on values); Comparisons' latest year on a rate from 2023/24; Grade counts' latest year from 2023/24 (a subject whose grades stop in 2022/23 shows none, as before).
- S5: the fullscreen layout fix in CardBox (below lg only).

## Screenshots

`docs/v0.6/grade_data_round_screenshots/s5-*` (S4's `s4-*` removed: they showed the old wording), on the S5 harness, 1280 and 390, light and dark:
- `s5-chase-history-grade-bands-trend-card-*` and `-fullscreen-*`: The Chase GCSE History, Grade bands 9–4, Trends: four-year lines, "↑ Growing", the note in the "i" and in fullscreen, "since 2022/23".
- `s5-comparisons-grade4-nearest-line-card-*`: Comparisons, Grade 4+, History against the average across the 10 nearest, four years, the "i" open.
- `s5-latest-year-unchanged-card-*`: Acland Burghley Grade 4+ Current table, 2024/25. Latin's "vs last year" is "—", as on main; no Turkish row.

## Click-through for Guy

1. **The Chase (137625), GCSE, focus History → Results → Grade bands** (e.g. 9–4) → open Trends. The line runs 2021/22–2024/25; the flag and sentence are measured from 2022/23 ("↑ Growing … since 2022/23"); the "i" has the note; Full screen prints it under the source. For the school-only line: the view editor's "History, this school only" on Grade bands draws a single four-year line with the same note.
2. **Comparisons, Grade 4+** (same page, Results → Grade 4+) → Trends → Chart. This school against the average across the 10 nearest, four years. The note is in the "i", and the sentence and flag say "since 2022/23".
3. **A Post-16 subject: King's Worcester (117037), focus Mathematics (A level) → Results → A*–E or Grade bands A*–B** → Trends. Four years; "fallen … since 2022/23". Then Average points: "Mathematics's average points has fallen from 45.2 to 41.7 … since 2022/23" (it said "from 49.1 … since 2021/22").
4. **A latest-year view, unchanged: Acland Burghley (100053), GCSE, Results → Grade 4+ → Current → Sortable table.** French 93%, Spanish 91%, English Language 69%, English Literature 70%, Latin 88% with "—" vs last year, and no Turkish row: exactly as on main.
