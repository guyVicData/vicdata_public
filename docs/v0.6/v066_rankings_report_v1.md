# 0.6.6 — Rankings on the whole population, on the measure in view

Prompt: [`vicdata_0_6_rankings_then_speed_claude_code_prompt_v1.md`](vicdata_0_6_rankings_then_speed_claude_code_prompt_v1.md), Part 1. Branch `v0.6.6` (app); the database function is on the ingest repo's branch `feat/subject-rank-lookup` and is **not applied** — §6 has the commands. Calls are logged in [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) under "2026-10-07 — 0.6.6". New rule: **R-RANKING-MEASURE**.

## 1. What changes for a teacher

With a national or regional ranking chosen in "Compared against" **and a subject in focus**, Comparisons now ranks **every school in the filtered population on the measure in view**, not the 25-school headline sample:

| | Before (0.6.5) | After (0.6.6) |
|---|---|---|
| Tiles | the whole-school headline only (A8 / A-level points per entry) | the subject's figure, "988th — of 3,565 schools with GCSE History results, 2024/25", the population's average, and the whole-school rank as a second tile ("894th — whole school: of 4,793 on Attainment 8 average score") |
| Bar chart | the 25 sampled schools | the school against the population's average |
| Ranking table | the sample re-ranked 1..25 | the population window at **real, shared ranks**: card = top 3 · ⋯ · 5 either side (one block in the top 8); full screen = top 10 · ⋯ · 10 either side · ⋯ · bottom 3 |
| Trends | the school against the sample's mean | the school against the population's average per year |
| % change list and table | the sample, ranked 1..N | the **whole population's** change from 2022/23, in the same window at real change ranks (e.g. The Chase 1,206th of 3,476 on Grade 4+) |
| Map | not offered for a ranking | unchanged (not offered) |
| Note under the pill | the headline ranking's note | "The Chase ranks 988th of 3,565 schools with GCSE History results in 2024/25. 6,139 schools are in this ranking; 2,574 have no figure that year. …" |

- **The measure in view:** Candidates (entries); Results average points, Grade 4+ / A*–E, a band or single grade, or a Grade counts selection. At Post-16 it is the exact qualification. The year is the latest with a figure, and for a rate the latest from 2023/24.
- **Rules:**
  - R-MIN-ENTRIES: 5 entries, graded entries on a rate; entries rank from 1.
  - Ties share a rank.
  - A school excluded by its own filters is placed against the population and says so.
  - Predecessors follow the lookups' rules.
- **No subject in focus:** the headline ranking, unchanged. The parity walk has two such cases; both are identical to main.
- **While it loads:** Comparisons shows the site's loading ring and "Ranking every school on History Grade 4+ rate…". If the server isn't ready after 8 s, it shows **"Ranking will be available shortly"** and asks again every 4 s. The calls are logged.

Screenshots (branch, real data): [`v066_screenshots/`](v066_screenshots/) — tiles, bar, ranking card, trend, change list, change table (The Chase GCSE History Grade 4+ national), King's A level Maths points / A*–A, Croydon BTEC Extended Diploma Business (London), the excluded case, the pending state, and phone light.

## 2. How it is computed

- **The definition:** `src/lib/subject-ranking.ts` `rankFigures`.
- **The real path:** the database function `academic_subject_rank_lookup`. It runs one query per request, mirrors `rankFigures` step for step, and is given the app's own scale tables and band grades as arguments. It lives in the ingest repo: `supabase/migrations/20261007200000_academic_subject_rank_lookup.sql`. It is security definer, granted to anon, with a pinned search path and `plan_cache_mode = force_custom_plan`.
- **Until it is applied:** `subjectRanking()` falls back silently. It makes chunked reads of the one subject's rows for the population, through the lookups the app already uses.
  - The figures are kept an hour per (population, subject, qualification, measure) and shared by every school.
  - The route keeps each answer an hour per key.
  - "Function absent" (PostgREST 404 / PGRST202) is re-checked every 10 minutes, so the switch needs no restart.
- **The route:** `/api/teacher/subject-ranking` (POST, membership-gated like chooser-set; anon key only, server-side).

## 3. Both paths identical

- **App script:** `scripts/subject-ranking-cases.ts` covers 24 cases. Before the migration it times the fallback and says "function not applied yet". Once it's applied, it compares the function's answer with the fallback's field by field (numbers to 1e-9).
- **Ingest test** (`tests/subject_rank_lookup/`): `export_rows.py` (read-only), then `run_pglite.mjs` loads those production rows into PGlite, applies the **real migration file**, and calls the function as `anon`. Result: **24 / 24 IDENTICAL** to the app's answer, including:
  - The Chase GCSE History points, Grade 4+, 9–7, grade 9, counts 6–5 and entries, national and West Midlands;
  - King's A level Maths points, A*–A and A*–E;
  - Croydon BTEC Extended Diploma Business points and D*D*D*–DDD, national and London;
  - The Chase placed against independent schools;
  - GCSE English Language and Maths nationally;
  - a VRQ with historic short codes.
- **Unit tests:** `src/lib/subject-ranking.test.ts` and `subject-ranking-view.test.ts` cover ties, minimum entries, exclusion, the default year, the change list, the window, the card and fullscreen cuts, the words and the change table's rows.
- **Rule test:** R-RANKING-MEASURE passes on real data. The Chase's figure in the ranking (75.76) equals Column 1's; King's 41.71 equals Column 1's; ranks are shared on ties (988th at position 989).

## 4. Timings

**The database function** (target: well under 1 s; the anon role's limit is 3 s):

| Case | PGlite, with the migration's indexes | Production today, **without** the indexes (read-only, warm) |
|---|---|---|
| The Chase GCSE History points (national) | 0.19 s | 0.27 s |
| … Grade 4+ / 9–7 / grade 9 | 0.13 / 0.23 / 0.22 s | 2.7 / 1.5 / 1.5 s |
| GCSE English Language Grade 4+ (national) | 0.15 s | 2.7 s |
| GCSE Maths 9–7 (national) | 0.25 s | 2.9 s |
| King's A level Maths points / A*–A | 0.05 / 0.10 s | 0.18 / 0.69 s |
| Croydon BTEC Ext. Dip. Business points | 0.14 s | 0.15 s |
| Regional cases | 0.02–0.19 s | 0.1–2.3 s |

- **Why production can't be measured with the indexes:** I can't create indexes on production.
- **The calibration:** I ran the same pure-CPU queries on both, and production's CPU is about 2.8× slower than PGlite on this laptop. Scaling the PGlite times gives **about 0.06–0.7 s on production with the indexes**. The 0.7 s worst case is a national GCSE band.
- **Without the indexes:** the grade-rate cases spend 1.7–2.0 s seq-scanning the 409 MB grade rollup, and three national GCSE rate cases sit at 2.7–2.9 s, right at the 3 s limit. That is why the migration adds them.
- **The indexes:** three subject-led covering indexes, about 550 MB on a 31 GB database. They are read index-only, because the rollups are all-visible after a rebuild.
- **How it got there:** the first version of the function was correct but took 15–60 s. The SQL was restructured so each subject's national rows are read once and the grade tests run in one hashed pass per school-year. The full history is in the ingest commit.

**The app fallback, cold** (the temporary path):

| Case | Time |
|---|---|
| GCSE History (national) | 4–7 s |
| GCSE English Language / Maths (national), the largest | 7–8 s |
| King's A level Maths (national) | 1.5–7.5 s |
| Croydon BTEC (national) | 0.9–8.3 s |
| Regional | 0.3–1.6 s |

- **Pending:** every case finished under 10 s. The route answers "pending" only past 8 s, so the largest subjects can occasionally show "Ranking will be available shortly" for a few seconds on their first request of the hour.
- **Sharing:** later schools reuse the population's figures (an hour).

## 5. Parity

The 0.6.5 harness ran on fresh real-data fixtures; both trees got the same fixtures, because this round changes no data fetcher.

| Set | Pairs | Result |
|---|---|---|
| The 0.6.5 cases (every panel and rail view; GCSE and Post-16; 1280 and 390; dark and light) | 2,306 | **2,306 identical** |
| 24 ranking cases (national and regional): The Chase History (points, Grade 4+, 9–7, grade 9, counts selection, Candidates), King's A level Maths (points, A*–A), Croydon BTEC Ext. Dip. Business (points), one school excluded by its filters, pending, two no-subject cases, two phone-light cases | 399 | Columns 1 and 2 identical; the no-subject cases identical everywhere; every difference is in Comparisons with a subject in focus (51 expected pairs, plus views present in only one tree, because main drew a single note there and the branch draws the views) |
| Leaflet timing | 1 | Column 1's Trends map in the pending case is 1 px off: Leaflet's SVG left mid-animation. A DOM probe shows both trees identical (OPEN_QUESTIONS "Parity notes") |

- **Not touched:** the Data View (no file under `src/components/data-view`, and none of its routes).
- **Every check passes:** tsc, eslint, build, 362 unit tests, and the rule test.

## 6. For Guy: apply the database function

**1. Push the ingest branch** (my push failed with an SSH access error):

```
cd ~/dev/vicdata && git push -u origin feat/subject-rank-lookup
```

**2. Apply** (production, vicdata-production). The indexes take about a minute each and block ingest writes, not reads, while they build. Don't use `db push`:

```
cd ~/dev/vicdata && git checkout feat/subject-rank-lookup && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && supabase db query --linked -f supabase/migrations/20261007200000_academic_subject_rank_lookup.sql && supabase migration repair --status applied 20261007200000 --linked
```

**3. Verify:**

```
cd ~/dev/vicdata && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && supabase db query --linked "select indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) from pg_indexes where indexname like 'academic_subject_%_subject_idx' order by 1" && supabase db query --linked "select has_function_privilege('anon', 'public.academic_subject_rank_lookup(text[], text, text, text, text, text, text, int, text[], text[], jsonb, text[], text[], int, int, int, int, int, int)', 'execute') as anon_can_call"
```

Expect three indexes and `anon_can_call = true`. Then check that the function matches the app on all 24 cases, with timings:

```
cd ~/dev/vicdata_public && npx -y tsx --env-file=.env scripts/subject-ranking-cases.ts
```

Expect "function N ms; IDENTICAL" on every line, with N well under 1,000. The Chase GCSE History Grade 4+ national should be 988th of 3,565.

The app needs no deploy for the switch. Within 10 minutes of the apply, Render's server re-checks and uses the function; until then it uses the fallback, with the same answers.

## 7. Live checks (localhost is gated, so these are for you)

1. **The Chase, GCSE, History in focus, "Compared against" National ranking:**
   - **Tiles:** 76% Grade 4+, "988th of 3,565 schools with GCSE History results, 2024/25", 65% average, "whole school: of … on Attainment 8 average score".
   - **Ranking:** the top 3, ⋯, then 982–993 around The Chase (shared ranks 985 and 988). Full screen: the top 10, ⋯, ±10, ⋯, the bottom 3.
2. **Same school, Trends:** the change list and the change table both at real ranks around 1,206th of 3,476.
3. **King's Worcester, Post-16, A level Maths, West Midlands ranking:** 40th of 242 on points; the whole-school tile reads "on average points per A-level entry".
4. **Any school with no subjects ticked:** the ranking tiles are the headline ones, as before.
5. **First load before the function is applied** (a cold subject such as GCSE English Language nationally): the ring, then the ranking within a few seconds; the Render log shows `[subject-ranking] … via the fallback, N ms`.

## 8. Files

- **New:**
  - `src/lib/subject-ranking.ts`, `src/lib/subject-ranking-view.ts` (and their tests);
  - `src/app/api/teacher/subject-ranking/route.ts`;
  - `src/components/teacher/RankingPending.tsx`;
  - `scripts/subject-ranking-cases.ts`;
  - `docs/v0.6/v066_screenshots/`.
- **Changed:**
  - `ComparisonsPanels.tsx`, `TeacherDashboard.tsx`;
  - `SchoolRankingTable.tsx`, `SeriesViews.tsx` (ChangeList, YearTable), `SeriesView.tsx`;
  - `view-series/{frames,series,ranking,comparisons,tiles}.ts`, `tile-figures.ts`, `teacher-view-panels.ts` (an optional `rank` / `pos` on a series);
  - `vicdata-reference.ts` (`callReferenceRpc`);
  - the catalogue (R-RANKING-MEASURE; R-RANKING-SAMPLE's wording);
  - `scripts/catalogue-rule-tests.ts`.
- **Ingest** (`feat/subject-rank-lookup`): the migration, plus `tests/subject_rank_lookup/{export_rows.py,run_pglite.mjs}`.
