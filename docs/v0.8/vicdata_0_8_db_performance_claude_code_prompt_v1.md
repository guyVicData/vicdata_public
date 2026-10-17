# VicData 0.8 — Database load: stop the production timeouts

Claude Code prompt, written 17 Oct 2026. It spans both repos:
- app: `~/dev/vicdata_public`, app database `lnhulykjlxmoneappnsp`;
- ingest: `~/dev/vicdata`, production database `hrqrbvrrhlidpoybezhs`.

## What the diagnosis found (17 Oct, read-only)

- **The timeouts are on the production database, not the app database.** Production has logged about 3,200 "canceling statement due to statement timeout" errors since 16 Oct 09:30 UTC, all from PostgREST, and they're still happening (232 in the 07:00 UTC hour on 17 Oct). The app database logged about 100, all on 16 Oct.
- **Why they're cut off:** the app reads production as `anon`, which has `statement_timeout = 3s`. Any read slower than 3 seconds fails. `authenticated` and `authenticator` have 8 s.
- **Which reads:**
  - `reference_data_lookup` with `p_breakdowns`: 75% of the timeouts. It has been called about 506k times since 24 Jul, at 231 ms on average, 32 hours in total. It pages with `p_limit`/`p_offset` through `canonical_facts_current`.
  - `academic_subject_rank_lookup`: 22% of the timeouts. It averages 1.08 s per call and peaks at the 3 s limit, because it ranks the whole national population on every call.
  - The rest (`area_*`, the subject headline and grade lookups) account for about 3%.
- **Why the database is slow:** production is about 37 GB on what looks like the smallest paid compute (60 connections and 256 MB `shared_buffers`, i.e. about 1 GB of RAM).
  - `canonical_facts_current` alone is 7.2 GB of table plus 7.4 GB of indexes, so the data it reads can't stay in memory. That table has done about 153 million disk block reads (about 1.2 TB read from disk).
  - The cache hit rate is 96%; it should be above 99%.
  - `canonical_facts_current` has 1.6 million dead rows. `canonical_facts` was last autovacuumed on 6 Aug.
- **Load from our own tools:** about 47,000 RPC calls reached production between 06:00 and 09:30 UTC on 17 Oct, almost all from the parity harnesses and rule tests. Guy is the only user. The harnesses are the biggest load the database sees.

Guy is upgrading production's compute separately (see the to-do list). This round makes the app's reads cheap enough that they don't depend on it.

## The work

### A. Reference data reads (app and ingest)

1. **Find every caller of `reference_data_lookup`** in the app. For each, record: which source, which breakdowns, how many pages it fetches, and how often it runs per page view. Do the same for `reference_data_age_gender_totals`.
2. **Stop paging with OFFSET.** Either fetch exactly the entities and breakdowns needed in one call (`p_entity_ids` is already supported), or use keyset paging (`entity_id, breakdown, period` after a cursor). No call should scan past rows it then discards.
3. **Cache reference data in the app,** keyed on the source's last promote time. It changes only on a promote. Use the same pattern as the ranking-population cache (`src/lib/ranking-population-cache.ts`): it reads the time at most once a minute, and keeps the last known time if that read fails.
4. **Check the plan** (`EXPLAIN (ANALYZE, BUFFERS)`, read-only, as `postgres`) for the heaviest real call before and after. If the function needs a better index (e.g. `(source_id, breakdown, entity_id, period)`), write it as an ingest migration. **Don't apply it.**

### B. Subject ranks (ingest and app)

1. **Precompute the national subject ranks at promote time** into a table, e.g. `academic_subject_rank`. Store the population, value, rank, tie flag and population count for each subject, qualification, measure, period and ks_stage. It should be rebuilt by the same hook that rebuilds the rollups (`academic_aggregates.on_academic_source_promoted`, and `rebuild_ks4.py`).
2. **`academic_subject_rank_lookup` reads the table** for the national case. It computes on the fly only for cases the table can't hold: custom sets, a region, a band. Its answer must be identical to today's. Prove that on a sample of at least 200 (school, subject, measure) cases across GCSE and Post-16, including ties, IGCSE schools and Leighton Park Biology (=851st of 3,433).
3. **Write the migration and the rebuild step, and test them in PGlite.** Give Guy the commands, in order: apply, build, verify. **No production writes.**

### C. The harnesses

1. **Cap concurrency** for every parity harness and the rule tests that hit production. Use at most 4 requests in flight, configurable, with backoff on 5xx and timeouts.
2. **Cache each harness run's answers per (function, arguments)** within the run, so both trees read the same answer once instead of twice. This also makes the fixtures consistent.
3. **Report the RPC count per harness run,** before and after.

### D. Housekeeping (ingest; commands for Guy, not run)

- `VACUUM (ANALYZE)` on `canonical_facts_current`, `canonical_facts` and the academic rollups, with how long each is likely to take. Say which can run while the site is up.
- Check whether the 464 MB `canonical_facts_current_snapshot_id_idx` (used 12 times) is needed by the promote. If it isn't, propose dropping it in a migration. **Don't apply it.**
- The app database's two heavy items, for the record (no change unless trivial): `recompute_nearest_neighbours_general_batch` (4.6 s average, a backfill job) and `region_nation_set` (1.6 s average, 14 s max).

## Ground rules

- **Branches:** app `v0.8-db-performance`, ingest `feat/db-performance`, each from current `main`, fetched over HTTPS. Commit this prompt as the app branch's first commit. If another session is using a checkout, work in a worktree (`cp` the `.env` without reading it; use free ports).
- **Production: read-only.** `EXPLAIN` without `ANALYZE` is allowed on the anon path; `EXPLAIN ANALYZE` only on the read-only functions; no DDL, no writes. Guy applies the migrations and runs the builds.
- **Every app figure stays byte-identical:**
  - every parity harness;
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests.

  This round changes speed, not numbers. Capture both trees' fixtures from the same data at the same time. Any figure difference stops the merge.
- **Timings:** for the 10 heaviest real calls (taken from `pg_stat_statements` and the harness logs), report the before and after time on the anon path, measured at quiet times.
- **Never put a server key in client code.** Stage files by name. Leave Guy's untracked files alone. Push over HTTPS.
- **Log calls** under "2026-10-xx — database load" in each repo's `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/db_performance_report_v1.md` in the app repo. Include:
- the callers found;
- the before and after plans and timings;
- the rank table and the 200-case proof;
- the harness RPC counts;
- **Guy's commands, in order,** each as one `&&` chain with the project-ref check and no `exit`:
  1. the ingest migration(s);
  2. the rank table build;
  3. verify;
  4. the vacuums.

**Merge the app branch only after Guy has applied the ingest steps,** and the app has been tested against the new function on production:

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-db-performance -m "0.8 Database load: reference data cached, ranks precomputed, harnesses throttled" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

Then remind Guy that the change goes live with a Render deploy.
