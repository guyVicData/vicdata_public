# VicData 0.6.6 + 0.6.7 — Real national rankings, then speed

Claude Code build prompt. Two rounds, run **in order** in one continuous pass. Asked for by Guy on 7 Oct 2026.

| Round | What | Figures | Ends with |
|---|---|---|---|
| **0.6.6** (Part 1) | Rankings rank the **whole population** on the measure in view | change (expected) | merge if only expected changes; ingest RPC left for Guy |
| **0.6.7** (Part 2) | Speed: Teacher-only school details, precomputed Post-16 neighbours | **none** | merge if identical; ingest table left for Guy |

**Run Part 2 only after Part 1 is merged into `main`.** Part 2's parity baseline is main *with* Part 1, so the corrected rankings aren't counted as Part 2 differences. If Part 1 hits a stop condition, stop there, report, and don't start Part 2.

Part 2 is the old standalone speed prompt (`vicdata_0_6_speed_neighbours_profiles_claude_code_prompt_v1.md`), renumbered from 0.6.6 to 0.6.7. **This file replaces it.**

## Ground rules for both parts

- **The usual checks:** tsc, eslint, build, unit tests (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`), rule tests (`npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`), and the 0.6.5 parity harness. Commit per stage.
- **Change both drawing paths:** the config renderer and the legacy hosts.
- **The Data View must stay pixel-identical, and its routes unchanged.**
- **Never put a server key in client code.**
- **Database changes** are written as migrations in the ingest repo (`~/dev/vicdata`, vicdata-production `hrqrbvrrhlidpoybezhs`) and tested. **Never applied to production by you.**
  - Apply commands start with the project-ref check, and are `&&` chains with **no `exit`**: Guy pastes them into an interactive shell.
  - The app must work, with identical results, **before and after** Guy applies them (a silent server-side fallback).
- **Leave Guy's untracked or modified files alone,** in both repos. **Stage files by name; never `git commit -a`.**
- **Log calls** in `docs/OPEN_QUESTIONS.md` under "2026-10-07 — 0.6.6" and "— 0.6.7".
- **If `git push` fails,** say so and give Guy the command. Don't retry in a loop.
- **Pixel-perfect,** existing components and tokens, both themes, 1280 and 390.

---

# Part 1 — 0.6.6: real national (and regional) rankings

## The problem (diagnosed 7 Oct)

Guy, at The Chase (137625), with History in focus and a national ranking chosen in Comparisons: *"it only lists 25 schools for both GCSE and A level. What we want is to rank the school against ALL nationally, and on the ranking table focus in on the school's position. We had this working."*

**Why it happens:**

- **`src/lib/chooser-sets.ts` `resolveRankingSet()`** ranks the whole population (`cachedRankingPopulation`, after the chooser's filters) on the **whole-school headline only** (`HEADLINE_MEASURE`: Attainment 8 / A-level APS per entry).
  - It then hands Column 3 a **sample**: the top 15 plus the 5 either side of the school (`TOP = 15`, `EITHER_SIDE = 5`), so about 25 schools.
  - The tiles ("843rd of 2,545") and the population average are right, but **only on the headline**.
- **Since 0.6, Comparisons follows the focused subject and Results measure.**
  - `onRankingMeasure()` (`src/lib/teacher-view-comparisons.ts` ~56) is false whenever a subject or threshold is in view.
  - So the page ranks those **25 schools, chosen for their Attainment 8, on History**. It isn't a History ranking, and the table shows 25 rows.
- **"Had this working"** refers to the headline-measure version (snagging round 1 Part 4, `e054dd9`; the centred row, `9d04d9a`), which a subject focus now always overrides.

**The data exists for a real ranking.** Production has school-level subject figures for the whole country: e.g. History points for 3,602 schools at GCSE and 1,887 at Post-16 in 2024. Grade rows are in `academic_subject_grade_rollup` (GCSE) and the historic/modern KS5 facts the app already reads.

## What to build

### 1.1 Rank the whole population on the measure in view

**For a ranking comparator** (national or regional, any chooser filters), rank **every school in the filtered population** on exactly what the panel shows:

- **Subject:** the focused subject. At Post-16, the **exact qualification** (R-POINTS-SAME-QUAL, as 0.6.5 S3).
- **Measure:**
  - Results on Average points, Grade 4+ / A*–E, a Grade band or a single grade (the top-bar band), or a Grade counts selection (0.6.3: share of entries in the selected grade(s));
  - or Candidates (entries).
- **Year:** the panel's year (latest by default; the Current "Data" year menu where it exists). A school with no figure in that year is not ranked; say so in the note's count.
- **No subject in focus** (the whole-school headline): **today's behaviour must be byte-identical.** Same ranking, rank, average and note.

**Rules, all from the existing catalogue (cite each in the code and the rule test):**
- **The minimum entries / count rules** for comparator figures, so tiny cohorts don't top the table. Name the rule you reuse; if none fits, use the one Comparisons already applies to sets, and log it.
- **Ties share a rank.** Higher is better for points, rates, bands and shares; entries rank high to low.
- **R-RANKING-SAMPLE**, extended: rank, total and average come from the **whole population**, never the rows drawn.
- **The school not in the ranking** (filters exclude it): it is placed against the population, as today, with the same wording.
- **Post-16 safeguards** (0.6.3 / 0.6.5) all apply. A*–E is greyed for non-A-level scales; ranking on it doesn't arise.

### 1.2 Where it's computed

1. **A production function** (ingest repo migration), e.g. `academic_subject_rank_lookup`:
   - security definer, granted to anon, in the style and with the safeguards of `academic_subject_grade_rollup_lookup`;
   - **takes:** the population's URNs (an array; thousands), stage, subject, exact qualification (Post-16), measure kind and band/grade selection, period, target URN, and window sizes;
   - **returns:** the target's rank, the number ranked, the population mean, the target's value, and the window rows (each with rank and value);
   - add the indexes it needs, with `explain analyze` evidence.
2. **The app path** (`resolveRankingSet` and the chooser-set route):
   - call the function;
   - **if it's missing or errors, fall back silently** to computing the same thing server-side from the existing lookups, chunked, and cached for an hour per (population key, filters, subject, qualification, measure, band, period).
   - **Both paths must return identical results.** Add a test that runs both on The Chase History (GCSE), King's Worcester 117037 A level Maths, and a grade-band case, and compares them.
3. **Leave the migration for Guy,** with apply commands and a verify query, in `docs/v0.6/v066_rankings_report_v1.md`.

### 1.3 The ranking table focuses on the school's position

For a ranking comparator, Column 3's **Ranking** view (`SchoolRankingTable`) shows:

- **On the card:**
  - the **top 3**;
  - a break row ("⋯ 308 schools ⋯" style, existing tokens);
  - then **5 above, the school, 5 below**, each with its **real rank** in the whole population.
  - The school's row is highlighted in the phase accent, as today. If the school is in the top 8, show one continuous block with no break.
- **Fullscreen:** the top 10, then a break, then 10 either side, then a break, then the bottom 3.
- **Ranks are real** (312, 313…), not 1–25.
- **Bar chart:** the school against the population average.
- **Tiles:**
  - "312th of 3,602 schools with GCSE History results, 2024/25";
  - the school's figure;
  - the population average for the same year.
- **Map:** still not offered for a ranking (`sampleAllowsMap`), unchanged.
- **Trends:** for a ranking comparator, Trends use the population's average per year. Any ranked change list ranks the **whole population** on change from 2022/23 (R-TREND-FROM-2223), shown with the same top / break / around-the-school window.
- **Wording:** keep the existing note style. The window's label says what it is ("Around The Chase"), and the note gives the population and how many were left out (no figure that year, or below the minimum).

### 1.4 Expected changes and parity

**Expected, for ranking comparators only, with a subject in focus:**
- table rows, ranks and figures;
- the tiles' rank and total;
- the population average;
- the note;
- the windowed layout.

**Must be identical:**
- every non-ranking comparator (nearest 10, LA, saved and custom sets);
- the no-subject headline ranking;
- Columns 1 and 2;
- every GCSE / Post-16 view not on a ranking comparator;
- the Data View.

**Parity run:** the 0.6.5 harness, plus ranking-comparator states (national and regional) for:
- The Chase History (Results points, Grade 4+, band 9–7, a single grade 9, Grade counts selection, Candidates);
- King's Worcester A level Maths (points, A*–A band);
- Croydon BTEC Business Extended Diploma (points);
- one school whose filters exclude it from the ranking.

**Report** (in `docs/v0.6/v066_rankings_report_v1.md`):
- before/after screenshots and the rank/total each case gives;
- timings: the function and the fallback, cold and cached;
- the migration and apply commands;
- logged calls.

**Merge if clean:**
```
git checkout main && git pull && git merge --no-ff v0.6.6 -m "0.6.6 rankings on the whole population, measure in view" && npm run build && git push
```
Then start Part 2 from the updated `main`.

---

# Part 2 — 0.6.7: speed (no figure changes)

Guy asked for the two speed options proposed in 0.6.4 (C3) and 0.6.5. **Neither may change any figure, name, order or pixel** compared with `main` after Part 1.

**Read first:**
- `docs/v0.6/v064_report_v1.md`: C1 measurements, C3 options, the route replay harness `audit_scripts/v064_perf/`.
- `docs/v0.6/v065_report_v1.md`: S4's Post-16 set and its 1.8 s first build at The Chase.

**Addition to B1 below:** the lean Teacher-only school details must also serve the rows drawn for a **ranking comparator** (Part 1's window), so rankings get faster too.

### Two repos, two branches

| Part | Repo | Branch | Ends with |
|---|---|---|---|
| **A** | ingest, `~/dev/vicdata` (vicdata-production `hrqrbvrrhlidpoybezhs`) | `feat/post16-neighbours` | **stop:** migration and backfill written and tested, not applied. Guy applies. |
| **B** | app, `~/dev/vicdata_public` | `v0.6.7` | **merge** if parity is identical, and only once it works with A both absent and present |

Do B's Teacher-only school details first, because it needs no database change. Then A. Then B's use of A's table.

### Ground rules (Part 2 specifics; the shared ones above also apply)

- **The usual checks:** tsc, eslint, build, unit tests (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`), rule tests, and the 0.6.5 parity harness. Run them all, commit per stage.
- **The Data View must stay pixel-identical, and its routes unchanged.** `academic-schools` and the default-lists route keep exactly their current behaviour for every caller that isn't the Teacher page.
- **Never put a server key in client code.** The app reads the new table only through a security-definer RPC granted to anon, as `academic_subject_grade_rollup_lookup` does, or through an existing server route. No service key in vicdata_public.
- **Database changes** are written as migrations in the ingest repo and tested on a local or branch database if one is available. **Never applied to production by you.** Guy applies them, and the apply commands start with the project-ref check (`supabase/.temp/project-ref` = `hrqrbvrrhlidpoybezhs`), written as `&&` chains with **no `exit`** (Guy pastes them into an interactive shell).
- **Leave Guy's untracked or modified files alone,** in both repos (e.g. the round-8 brief in vicdata_public, `scripts/` in vicdata). **Stage files by name; never `git commit -a`.**
- **Log calls** under "2026-10-07 — 0.6.7" in `docs/OPEN_QUESTIONS.md` (vicdata_public). Ingest calls go in the ingest report.
- **Pushing:** if `git push` fails, say so and give Guy the command. Don't retry in a loop.

---

### B1 — Teacher-only school details (app, no database change)

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

### A — Precomputed Post-16 nearest 10 (ingest repo)

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

### B2 — The app reads the precomputed list (app)

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
   git checkout main && git pull && git merge --no-ff v0.6.7 -m "0.6.7 speed: Teacher-only school details; precomputed Post-16 neighbours (reader)" && npm run build && git push
   ```
   Because of the fallback, the app is safe to deploy before Guy applies A.

### Report

Write `docs/v0.6/v067_report_v1.md` (vicdata_public), covering:

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


---

## Finish (both parts)

Tell Guy, in order:
1. Push anything that didn't push.
2. Wait for Render's "Deploy live".
3. Apply Part 1's ranking function, then Part 2's neighbours table and backfill. Commands are in the two reports; both are safe to apply after the app is live, thanks to the fallbacks.
4. The checks:
   - The Chase, GCSE History, Comparisons → a national ranking: real rank of N, and the table centred on The Chase;
   - then switch GCSE → Post-16 in a fresh browser, timed.
