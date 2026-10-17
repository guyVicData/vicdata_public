# VicData 0.8: database load

Report for `docs/v0.8/vicdata_0_8_db_performance_claude_code_prompt_v1.md`, 17 Oct 2026. Branches: app `v0.8-db-performance` (from `824e2fb`), ingest `feat/db-performance` (from `f08af75`). Worktrees `~/dev/vicdata_public_dbperf`, `~/dev/vicdata_dbperf`. **Production was read-only throughout:** read-only transactions, `EXPLAIN ANALYZE` only inside them, no DDL.

**In one line:**
- Reference reads become one call each, where today they re-run the whole query for every 1,000 rows. The national KS2 read drops from 47 executions (about 19 s) to one (about 0.5 s).
- The app caches each read until its source is next promoted.
- The rank lookup ranks from precomputed per-school figures instead of rebuilding them on every call.
- Our own tools go through a throttling, caching proxy.

**Nothing is live until you apply the ingest steps (§7).** The app branch falls back to today's reads until then, and is merged only after a check against the new functions on production.

| Check | Result |
|---|---|
| App: tsc, eslint, `next build` | clean (eslint: 0 errors, the 2 existing warnings) |
| App unit tests | **448 / 448** (including the new cache tests); catalogue **77 / 77** |
| App PGlite (RLS, usage log, every `supabase/tests/*.mjs`) | **17 / 17** |
| Rule tests (production, read-only, through the cached proxy) | **107 pass, 0 fail, 0 errors** (MANUAL 15, NONE 19, SUPERSEDED 4) |
| Ingest Python unit tests | **134 / 134** |
| Ingest PGlite: reference reads | the one-call reads return exactly the paged functions' rows, in order, over 8 cases (3 pages; lineage fallback; national); the stamps are right; anon reads no table |
| Ingest PGlite: rank figures | **258 / 258 cases identical** to today's function (§3), migration applied twice; anon can only call the lookup |
| Parity (both trees through one fresh proxy session per harness, back to back) | Teacher 2,875 / 2,875; public page SSR identical; Admissions 328 / 328; Data View 60 / 60; groups 175 / 176 (one PNG at 1 / 255); SMT HTML identical everywhere (PNG noise on the tab pill's edge, as last round). **No app figure changed.** |

## 1. The callers found

Every production read goes through `src/lib/vicdata-reference.ts`, using the anon key on the server: no retry, no timeout, `PAGE_SIZE` 1000, `MAX_PAGES` 50. Before this round its only cache was `cachedReference` (one hour, in process).

**`reference_data_lookup`:**
- **National (no entities):**
  - KS2 headline, Admissions (`admissions/ranks.ts` `headlinePopulation`) and SMT (`smt/population.ts`): 47 pages; cached 1 h.
  - England births (`smt/context.ts`), cached 1 h.
  - England population by year, in parallel (`smt/area-data.ts`), cached 1 h.
- **Large sets:**
  - The census (80 age breakdowns, every year) in chunks of 40: `fetchDataViewProfiles` (uncached), `fetchAcademicProfiles` (uncached), Admissions' `cachedCensus` (per URN, 1 h), and the default comparator lists (uncached).
  - Subject entries, all periods, unchunked (`fetchSubjectLevelDataForSchools`; SMT's copy cached).
  - The surrounding schools, FE colleges and LA composition (uncached).
  - SMT FSM, LA ages and the projection by district; births by LA.
- **Single school:** the school page makes about 6–10 uncached reads per view; `paid-trends`, `feeder-target-count`, `surrounding-schools-list`, `comparator-set-peers`; SMT's and Admissions' are cached for 1 h.
- **Scripts:** the sync scripts page with their own loops.

**`reference_data_age_gender_totals`:**
- `schools-in-bounds`: up to about 750 URNs on **every map pan or zoom**, uncached. Today it pages, and the third page often times out (§2).

**`academic_subject_rank_lookup`:**
- Teacher's subject ranking: national or regional. Cached 1 h, keyed on the sync stamp.
- SMT: per subject, the set and national. Cached.
- Admissions' `subjectPlaces`: for each rival, national plus regional, one after another, with **no outer cache**.

## 2. Plans and timings (before)

**`pg_stat_statements` since 24 Jul, top ten by total time (PostgREST calls):**

| Function | Calls | Mean | Max | Total |
|---|---|---|---|---|
| reference_data_lookup | 505,941 | 231 ms | 3,000 ms | 1,947 min |
| academic_subject_headline_lookup | 89,704 | 660 ms | 2,949 ms | 987 min |
| academic_subject_grade_rollup_lookup | 34,678 | 379 ms | 2,924 ms | 219 min |
| academic_subject_qualification_headline_lookup | 24,599 | 381 ms | 2,880 ms | 156 min |
| academic_subject_rank_lookup | 6,289 | 1,080 ms | 2,996 ms | 113 min |
| academic_subject_family_lookup | 51,272 | 130 ms | 1,854 ms | 111 min |
| academic_headline_lookup | 56,375 | 86 ms | 2,946 ms | 80 min |
| reference_data_age_gender_totals | 1,355 | 676 ms | 2,954 ms | 15 min |
| area_projection | 1,295 | 496 ms | 2,900 ms | 11 min |
| area_context | 215 | 968 ms | 2,991 ms | 3.5 min |

**Plans (`EXPLAIN (ANALYZE, BUFFERS)`, read-only, on the functions' exact SQL):**
- **Census, 40 schools, every year, 80 breakdowns:** `canonical_facts_current_pk_idx` on `entity_id = any(...)`; 2,075 rows. 13 ms warm, 120 ms cold (164 blocks from disk). Three pages, each re-running the query.
- **National KS2 headline:**
  - The scan uses `canonical_facts_current_source_period_idx` on `(source_id, period)`, then filters the breakdown. It reads **11,829 blocks** for 46,859 rows.
  - The first page took 690 ms cold; later pages 470 ms, each **sorting every row on disk** (`external merge`, 4.6 MB) to keep 1,000.
  - That's 47 pages per read.
- **Age-gender, 750 schools (a map view):**
  - The scan uses the pk index, with 33,034 rows removed by filter; 17,671 buffers. 1.1 s per execution, warm.
  - Three pages, about 3.3 s together. The third crosses anon's 3 s limit.

**Timings on the anon path** (`scripts/db-timings.ts`; the app's own calls over HTTP; 3 runs; no app cache; 17 Oct, about 12:30 BST):

| Call | Before (ms) |
|---|---|
| reference_data_lookup: census, 40 schools, every age and year | 569 / 323 / 190 |
| reference_data_lookup: KS2 headline, every school in England | **20,310 / 18,866 / 18,944** |
| reference_data_age_gender_totals: 750 schools | 3,088 / 4,981 / 3,626, **failed (57014)** |
| academic_subject_headline_lookup: 20 schools | 60 / 49 / 143 |
| academic_subject_grade_rollup_lookup: one school, GCSE | 128 / 124 / 102 |
| academic_subject_qualification_headline_lookup: one school, Post-16 | 91 / 43 / 46 |
| academic_subject_rank_lookup: The Chase GCSE History points, national (6,159) | 640 / 338 / 359 |
| academic_subject_family_lookup: 150 schools | 522 / 333 / 308 |
| academic_headline_lookup: every school in England, GCSE | 5,247 / 5,117 / 5,810 |
| area_projection: The Chase | 229 / 118 / 119 |
| area_context: The Chase | 1,121 / 180 / 135 |

The national rank lookup timed by measure was 0.8–2.5 s cold and 0.24–0.75 s warm (GCSE History points, entries and Grade 4+; Biology; A-level Maths).

**After:** taken once you've applied §7, with `npx -y tsx --env-file=.env scripts/db-timings.ts after.json` (and `--paged` for today's reads on the same day). Expected from the plans:
- the KS2 read becomes one execution, about 0.5 s instead of about 19 s;
- the 750-school read becomes one execution of about 1.1 s, under the limit;
- the census read becomes one execution;
- the rank lookup, on PGlite, takes 41% of today's time over the 258 cases (11.0 s against 27.0 s).

Every repeat read is then served from the app's cache until the source's next promote.

## 3. What changes

### A. Reference reads (ingest 20261017120000; app `vicdata-reference.ts`, `reference-cache.ts`)

**Ingest:**
- `reference_data_lookup_all` and `reference_data_age_gender_totals_all` return the same rows, in the same order, as one `json` value. They use `json`, not `jsonb`, so keys and numbers come back exactly as PostgREST writes the set today. The lineage fallback is copied verbatim, and the paged functions stay.
- `reference_source_stamps()` gives each source's latest promote or retraction. All three are security definer, anon-callable, and read no table directly.

**App:**
- `lookupReferenceData` and `lookupAgeGenderTotals` use the one-call functions when they exist. Otherwise they page as today, rechecked every 10 minutes (your call).
- Every read goes through one per-process cache, keyed on its arguments and the source's stamp:
  - stamps are read at most once a minute, and the last ones are kept if a read fails;
  - with no stamp, the old one-hour TTL applies;
  - nothing is kept past a day;
  - callers get copies;
  - answers over 50,000 rows aren't kept;
  - an abort stops only its own wait.
- No index added: with one call per read and the cache, a `(source_id, breakdown, entity_id, period)` index (2–3 GB on 36 million rows) would save little. That's a logged call.

### B. Subject ranks (ingest 20261017130000; no app change)

**Your call (17 Oct): precompute figures, not national ranks.** The national population is the app's own URN list, and the function only sees URNs. So only per-school figures keep national, regional and custom sets identical.

- **The tables:**
  - `academic_subject_rank_figure_sets` has one row per case: stage, subject group (`subject_label_variants`), family filter, qualification, measure, and a fingerprint of the rate parameters.
  - `academic_subject_rank_figures` holds that case's rows: `ord`, urn, period, value, n.
  - RLS is on, nothing is granted to anon, and there's an index on `(set_id, urn)` covering the rest.
- **Built by** `academic_subject_rank_figures_rebuild(non_grades, modern_from)` for every school in the rollups plus every lineage successor, about 20,000 URNs. It uses `academic_subject_rank_figures_compute`, which is the function's own figure chain (`members` .. `fig`) **copied by a script from the current definition** (`tests/rank_figures/gen_migration.py`), never retyped.
- **The cases built:**
  - GCSE points and entries per subject (no family filter, and the subject's family);
  - Post-16 points and entries per subject and qualification;
  - rates per subject, for every qualification and for each one.
  
  That's about 4,500 cases on production. Bands, and calls with other parameters, compute per call, as today.
- **The lookup** finds the case (`academic_subject_rank_figure_set`) and reads its rows for the schools given, in `ord` order; otherwise it computes them. Ranking, ties, windows, the change list and the JSON are untouched. Today's function stays as `academic_subject_rank_lookup_v1`, service role only, for the proof.
- **Kept current:**
  - **After a subject promote:** the promote hook clears the figures in one savepoint and rebuilds them in another, after the subject rollups. If the rebuild fails, the lookup computes per call (correct, as before), never serving stale figures.
  - **On a `gias_links` promote:** the figures are cleared (`school_lineage` drives the predecessor fallback).
  - **Manual rebuilds:** `rebuild_ks4.py` rebuilds them, and `rebuild_rank_figures.py` is the build on its own.
  
  Rebuild after any migration that changes `subject_label_map` or `subject_families`.

**The proof (PGlite, real production rows exported read-only, 258 cases):**
- **Coverage:** GCSE and Post-16; national, regional and the 10 nearest; points, entries, Grade 4+ / A*–E, and bands (computed path); IGCSE schools (Leighton Park, King's); 223 with ties in the window.
- **Leighton Park GCSE Biology points, national:** =851st of 3,433 on both.
- **Every field identical** in all 258: places, ranks, ties, windows, every figure, the change list, counts, the target and its series.
- **225 cases byte-identical.** In the other 33, only the set averages (`average[].value`, `averageLatest`, `change.average`) differ, by at most 2.2e-15 relative, in the last one to three digits.
  - These are float sums, and their last digits depend on the order rows arrive.
  - **Today's function itself does this:** the same case on the same data, with only the join plan changed (`enable_hashjoin = off`), gives other last digits (e.g. Computer Science Grade 4+ `averageLatest` 69.64435717293986 against 69.64435717294).
  - Two PGlite runs of the same data gave 219 and then 225 byte-identical.
  - The figures are stored in the chain's own order (`ord`), which is why most cases match exactly. The proof compares those three fields to 1e-12 and everything else exactly.
  - The app shows averages rounded, and parity found no difference.
- **Speed (PGlite):** 252 of the 258 were served from the table, at 41% of today's time.
- **The build (PGlite):** 449 cases and 1.9 million rows for 11 subjects in 2.3–2.5 minutes. On production I estimate 30–60 minutes for about 4,500 cases (a logged call: it lengthens a subject promote by that much).

### C. The harnesses (app `scripts/rpc-proxy.mjs`)

The proxy sits between our tools and production:
- **Concurrency:** at most 4 requests in flight (`--max`).
- **Retries:** a 5xx, a timeout (57014) or a network error is retried after 1, 2, 4 and 8 s.
- **Caching:** within a run, each `(path, arguments)` answer is read once, with key order normalised. Both trees then get the same answer, which also makes the fixtures consistent.
- **Counts:** per function, written to a stats file.
- **Use:** any tool runs through it with `VICDATA_API_URL=http://127.0.0.1:8790` set in the shell.
- **Rule tests:** their `.env` loading now keys on the anon key, so they work behind it.

**RPC counts per harness run (both trees):**

| Harness | Before (no cache) | After: received | After: sent to production | Cache hits |
|---|---|---|---|---|
| Teacher (captures, ranking fixtures, SSR) | 2,319 | 2,318 | 1,002 | 1,316 |
| SMT (with group set and Subjects) | 4,474 | 4,433 | 1,893 | 2,572 |
| Admissions | 1,986 | 1,978 | 649 | 1,329 |
| Groups | 170 | 170 | 85 | 85 |
| Data View (subject inputs) | 28 | 28 | 23 | 5 |
| Rule tests | (≈2,393; not rerun, to spare production) | 2,393 | 1,667 | 730 |

- **About 60% fewer calls overall.** In that run, reference reads barely shared between the trees (13 of 517 hits in SMT), because the branch's paged fallback sends the same arguments in another key order. The proxy now normalises key order, so the next run shares them too.
- **Proxy failures** were the expected 404 probes of the not-yet-applied functions, plus 8 SMT rank calls that timed out after all retries. Those fell back to the app's own ranking, and the fixtures were still identical.
- **Busiest functions in the cached runs:**
  - SMT: `academic_subject_grade_rollup_lookup`, `academic_subject_family_lookup`.
  - Admissions: `academic_subject_family_lookup`.
  - Teacher: `reference_data_lookup`, `academic_subject_headline_lookup`.

### D. Housekeeping (ingest; commands for you, §7)

**Vacuum:**
- `vacuum_reference.py` runs `VACUUM (ANALYZE)` on each table one at a time (autocommit, no timeout, printing times).
- Plain VACUUM keeps reads and writes going, so **it can run while the site is up**. Reads are slower while it runs, and a promote of the same table waits for it.
- **Estimates on this compute:**
  - `canonical_facts_current` (7.2 GB plus 7.4 GB of indexes, 1.65 million dead rows, last autovacuumed 14 Oct): 15–40 minutes.
  - `canonical_facts` (9.3 GB plus 6.5 GB, 223,000 dead, last autovacuumed **6 Aug**): 15–40 minutes.
  - The academic rollups (3.1 GB at most, no dead rows): seconds to a few minutes each.

**`canonical_facts_current_snapshot_id_idx` (464 MB, used 12 times since 24 Jul):**
- A promote never reads it. `sync_canonical_facts_current` filters on `canonical_facts.snapshot_id` and only writes the current table's, so the index is extra write work on every promote.
- Only a retraction reads it (`remove_from_canonical_facts_current`, an update and a delete by snapshot_id).
- The drop is a separate, optional migration (20261017140000). Without the index, a retraction scans the 7 GB table twice (a few minutes).

**The app database, for the record (no change):** `recompute_nearest_neighbours_general_batch` (4.6 s average) is a backfill job; `region_nation_set` (1.6 s average, 14 s max) is behind the 6-hour ranking-population cache.

**Compute:** on 17 Oct `shared_buffers` reads 1 GB and `max_connections` 120, against the diagnosis's 256 MB and 60, so the upgrade looks done. The heap cache hit rate since 24 Jul is 92.5%.

## 4. Parity

Both trees' fixtures came from the same proxy session per harness, captured back to back. In the cached run they were byte-identical between `main` and the branch. This round changes speed, not numbers.
- **Teacher:** 2,875 / 2,875 identical; public page SSR identical (137625, 117037).
- **Admissions:** 328 / 328 identical, pixels and DOM.
- **Data View:** 60 / 60.
- **Groups:** 175 / 176 identical; one PNG at 1 / 255.
- **SMT:**
  - **HTML:** identical in every view.
  - **Main walk:** PNGs that differed did so only on the page-tab pill's edge (y=103–106). A rerun gave a different, smaller set, so it's the known rendering artefact.
  - **Group-set walk:** one page drew a different shell, a load glitch; on a rerun it was identical within 2 / 255.
  - **Subjects:** 0 cells differ.

**After you apply §7,** I rerun every harness with the one-call functions and the precomputed ranks live, and take the timings after. Only then do I merge the app branch.

## 5. Rules and tests added

**App:**
- `src/lib/reference-cache.test.ts`: the stamp keying, the TTL fallback, failures not kept, copies, abort, and the stamp-read fallback.
- `scripts/rank-figures-cases.ts`, which generates the proof cases.
- `scripts/db-timings.ts`.
- `scripts/rpc-proxy.mjs`.

**Ingest:**
- `tests/reference_data_all/run_pglite.mjs`.
- `tests/rank_figures/{export_rows.py, run_pglite.mjs, gen_migration.py, migration_template.sql, cases.json.gz}`.
- `verify_rank_figures.py`, `rebuild_rank_figures.py`, `vacuum_reference.py`, `run_sql_autocommit.py`.

No catalogue rule changes: no figure changes.

## 6. Logged calls

Logged under "2026-10-17 — database load" in both repos' `docs/OPEN_QUESTIONS.md`.

**Ingest:**
1. Figures, not national ranks (your call).
2. "Identical" means everything except the set averages' last digits, which today's function varies itself.
3. The build takes 30–60 min inside a subject promote; it could move out of the hook.
4. A `gias_links` promote clears the figures. Add `rebuild_rank_figures.py` to the GIAS runbook.
5. No new index.
6. The optional snapshot-index drop makes a retraction slower.
7. The rate parameters are copied into `academic_aggregates.py`. If the app changes them, the lookup computes per call: slower, never wrong.
8. `_v1` stays for the proof; drop it later.
9. The compute already looks upgraded.
10. The paged functions stay.

**App:**
1. The fallback until you apply.
2. The cache's behaviour, including the abort.
3. No app change for the ranks.
4. The proxy.
5. Not changed:
   - `academic_subject_headline_lookup` (second by total time);
   - the 5 s national `academic_headline_lookup`;
   - Admissions' uncached `subjectPlaces`.
   
   **Suggest:** the same treatment next round.
6. The merge waits for §7.

## 7. Your commands, in order

Each is one chain with the project-ref check. The ingest branch is merged to `main`, so these run from `~/dev/vicdata`.

**1. The ingest migrations.** Reference reads and stamps, then the rank figures. Both are quick.
```
cd ~/dev/vicdata && git checkout main && git pull https://github.com/guyVicData/vicdata.git main && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && supabase db query --linked -f supabase/migrations/20261017120000_reference_data_lookup_all.sql && supabase migration repair --status applied 20261017120000 --linked && supabase db query --linked -f supabase/migrations/20261017130000_academic_subject_rank_figures.sql && supabase migration repair --status applied 20261017130000 --linked && supabase db query --linked "select count(*) as cases_built from academic_subject_rank_figure_sets"
```
`cases_built` is 0 until step 2. Until then the lookup computes every call, exactly as today.

**2. The rank figures build** (one transaction; estimated 30–60 minutes).
```
cd ~/dev/vicdata && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && caffeinate -dims .venv/bin/python rebuild_rank_figures.py
```

**3. Verify** (read-only). The 258 cases, new lookup against `_v1`, then the stamps.
```
cd ~/dev/vicdata && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && caffeinate -dims .venv/bin/python verify_rank_figures.py tests/rank_figures/cases.json.gz && supabase db query --linked "select source_id, stamp from reference_source_stamps() order by stamp desc limit 5"
```
Expect "… byte-identical; … more identical but for the last digits of a set average", exit 0, and Leighton Park Biology at rank 851 of 3433.

**4. The vacuums** (the site can stay up; about 30–80 minutes in all). Dry run first.
```
cd ~/dev/vicdata && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && .venv/bin/python vacuum_reference.py --dry-run && caffeinate -dims .venv/bin/python vacuum_reference.py
```

**Optional, your call: drop the snapshot index** (retractions get slower, §3 D).
```
cd ~/dev/vicdata && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && .venv/bin/python run_sql_autocommit.py supabase/migrations/20261017140000_drop_canonical_facts_current_snapshot_id_idx.sql && supabase migration repair --status applied 20261017140000 --linked
```

Then tell me. I rerun every parity harness against the live functions, take the timings after, and merge the app branch. **The app change goes live with a Render deploy after that merge.**
