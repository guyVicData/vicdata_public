# VicData 0.6.6 — Speed: precomputed Post-16 neighbours, Teacher-only school details

Claude Code build prompt. Guy asked on 7 Oct 2026 for the two speed options proposed in 0.6.4 (C3) and 0.6.5. **Neither may change any figure, name, order or pixel.** This is purely speed.

**Read first:**
- `docs/v0.6/v064_report_v1.md`: C1 measurements, C3 options, the route replay harness `audit_scripts/v064_perf/`.
- `docs/v0.6/v065_report_v1.md`: S4's Post-16 set and its 1.8 s first build at The Chase.

## Two repos, two branches

| Part | Repo | Branch | Ends with |
|---|---|---|---|
| **A** | ingest, `~/dev/vicdata` (vicdata-production `hrqrbvrrhlidpoybezhs`) | `feat/post16-neighbours` | **stop:** migration and backfill written and tested, not applied. Guy applies. |
| **B** | app, `~/dev/vicdata_public` | `v0.6.6` | **merge** if parity is identical, and only once it works with A both absent and present |

Do B's Teacher-only school details first, because it needs no database change. Then A. Then B's use of A's table.

## Ground rules

- **The usual checks:** tsc, eslint, build, unit tests (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`), rule tests, and the 0.6.5 parity harness. Run them all, commit per stage.
- **The Data View must stay pixel-identical, and its routes unchanged.** `academic-schools` and the default-lists route keep exactly their current behaviour for every caller that isn't the Teacher page.
- **Never put a server key in client code.** The app reads the new table only through a security-definer RPC granted to anon, as `academic_subject_grade_rollup_lookup` does, or through an existing server route. No service key in vicdata_public.
- **Database changes** are written as migrations in the ingest repo and tested on a local or branch database if one is available. **Never applied to production by you.** Guy applies them, and the apply commands start with the project-ref check (`supabase/.temp/project-ref` = `hrqrbvrrhlidpoybezhs`), written as `&&` chains with **no `exit`** (Guy pastes them into an interactive shell).
- **Leave Guy's untracked or modified files alone,** in both repos (e.g. the round-8 brief in vicdata_public, `scripts/` in vicdata). **Stage files by name; never `git commit -a`.**
- **Log calls** under "2026-10-07 — 0.6.6" in `docs/OPEN_QUESTIONS.md` (vicdata_public). Ingest calls go in the ingest report.
- **Pushing:** if `git push` fails, say so and give Guy the command. Don't retry in a loop.

---

## B1 — Teacher-only school details (app, no database change)

**Today:** Column 3 makes two heavy calls one after the other, on every load and every phase switch:
1. `chooser-set` (the default 10);
2. then `academic-schools` for those 10: about 1 MB, both phases, census pages, shared with the Data View. About 0.8–1.1 s.

**Build:**
1. **List exactly which fields** of `academic-schools`' response the Teacher page reads: maps, Comparisons, ranking, chooser, tooltips, any profile line. Cover both drawing paths. Write the list into the report.
2. **Serve only those fields, for this phase only, without census pages.** Choose one, and log why:
   - **(a)** `chooser-set` returns those profiles with the set, in one call (preferred if it keeps the 0.6.4 cache and prefetch behaviour), **or**
   - **(b)** a new Teacher-only route, `/api/teacher/comparator-profiles`, called in parallel where possible.
3. **Saved sets and custom sets** (the comparator chooser) must use the same lean path.
4. **The Data View keeps calling `academic-schools` unchanged.** Prove it with the 0.6.4 method: the changed files are not in the Data View's module graph, or the shared function is called on its unchanged path.
5. **Parity: identical.**
   - Every Teacher view, at both phases, the 0.6.5 matrix, both themes, 1280 and 390.
   - Also a JSON diff of the fields the Teacher page reads, old vs new, for the 9 parity schools plus every saved-set fixture: **0 differences**.
6. **Timing:** with the route replay, report before/after Column 3's critical path for cold load and phase switch, and the payload bytes, at 137625, 117037, 118952, 130432 and 100053.

## A — Precomputed Post-16 nearest 10 (ingest repo)

**Today:** the Post-16 default set (0.6.5 S4) is built per request by:

```
buildDefaultComparatorLists(urn, { only: "nearest", post16: true })
  → findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { genderMode: "relaxed", extraFilterUrns: withKs5Results, filterBeforeFacts: true })
```

(`vicdata_public/src/lib/default-comparator-lists.ts` ~686–790), cached for an hour. At schools with few sixth-form neighbours it takes about 1.8 s cold.

**Build:**

1. **A table** on vicdata-production, e.g. `teacher_default_neighbours`:
   - **columns:** `entity_id`, `list_kind` (`'post16_nearest_10'` now, so a GCSE list can be added later), `rank`, `neighbour_id`, `distance_km`, `computed_at`, plus whatever inputs stamp makes staleness detectable (e.g. the census period and the latest KS5 period it was built from);
   - a primary key;
   - RLS on, with no anon table access;
   - **a security-definer lookup function granted to anon** returning one school's list, in the same style and with the same safeguards as `academic_subject_grade_rollup_lookup` (single school per call; returns nothing rather than erroring for an unknown URN).
2. **The computation must give exactly what the app gives today**: same schools, same order, same distances to the stored precision.
   - That means the same:
     - candidate pool and open/closed rule;
     - gender mode ("relaxed");
     - census period;
     - KS5-results test (KS5 headline rows in the latest two published periods);
     - distance (easting/northing);
     - tie-breaking;
     - handling of a school with no location.
   - Read the app's code path to the bottom (`findSurroundingSchools` and its helpers) and reproduce it.
   - **If exact parity in Python isn't achievable** (e.g. it depends on data only the app sees), say so. Instead, propose a script in vicdata_public that runs the app's own function for every school and writes the table, run by Guy with the service key **locally, never deployed**. Build whichever of the two gives exact parity, and log the choice.
3. **Which schools:** every non-FE school whose Teacher page can show a Post-16 phase. Use the same test the app uses to offer Post-16. FE colleges keep their own nearest-FE list, which is unchanged and not precomputed (say if it's slow too).
4. **Refresh:**
   - Recompute on promote of every source that feeds it (GIAS / school entities, census, KS5 headline), via `on_academic_source_promoted` or the equivalent hook, in the same transactional style as the BTEC rebuild.
   - Add a standalone `backfill_teacher_default_neighbours.py`.
5. **Parity test** (read-only, before anything is applied): compute the table in memory, then compare it with the app's live function. Ideally every eligible school; at least 1,000 random ones plus 137625, 117037, 118952, 100053, 130416, and a school with no sixth-form neighbours nearby. **Report mismatches; the target is 0.** Explain any that remain, and don't ship until they're 0 or Guy agrees.
6. **Tests** in `tests/` (the repo's unittest style, as `tests/test_dfe_points.py`).
7. **Stop.** Commit and push the branch; **don't merge.** In the ingest report (`docs/vicdata_teacher_default_neighbours_build_report_v1.md`), give:
   - the migration;
   - the apply and backfill commands, as safe `&&` chains;
   - a verify query (row counts; The Chase's list);
   - expected run time.

## B2 — The app reads the precomputed list (app)

1. **Post-16 nearest 10:** call the new lookup first.
   - **Use it only if** it returns a list whose stamp matches the current census and KS5 periods the app would use.
   - **Otherwise fall back silently to today's computation:** the function is missing (migration not yet applied), the list is empty or stale, or the call errors. Log once per instance on the server, never to the user.
2. **Keep** the 0.6.4 / 0.6.5 hour cache and the idle prefetch on top.
3. **The Data View is not changed.**
4. **Prove both states:**
   - **Function absent** (as on production today): behaviour and parity are identical to main.
   - **Function present:** run against a local or branch database with the migration and backfill applied, or a stub that returns the table's computed rows. The page is identical to main, and the route is faster: report the timings, especially The Chase's cold Post-16 set (about 1.8 s today).
5. **Merge B to `main` and push** if parity is identical in both states:
   ```
   git checkout main && git pull && git merge --no-ff v0.6.6 -m "0.6.6 speed: Teacher-only school details; precomputed Post-16 neighbours (reader)" && npm run build && git push
   ```
   Because of the fallback, the app is safe to deploy before Guy applies A.

## Report

Write `docs/v0.6/v066_report_v1.md` (vicdata_public), covering:

- B1's field list, the design choice, timings and bytes;
- A's approach (Python or app-script) and its parity result, with a link to the ingest report;
- B2's fallback rules and both-state proof;
- a before/after timing table for cold load and phase switch at the five schools;
- parity;
- logged calls;
- **for Guy, in order:**
  1. push, if needed;
  2. wait for Render's "Deploy live";
  3. apply A's migration and backfill (commands in the ingest report);
  4. the check: The Chase, switch GCSE → Post-16 in a fresh browser, and time it in DevTools Network.

Then tell Guy what's left for him.
