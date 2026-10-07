# 0.6.7 — Speed (no figure changes)

Prompt: [`vicdata_0_6_rankings_then_speed_claude_code_prompt_v1.md`](vicdata_0_6_rankings_then_speed_claude_code_prompt_v1.md), Part 2. App branch `v0.6.7` (B1, B2); ingest branch `feat/post16-neighbours` (A, **not applied**), with its report at `~/dev/vicdata/docs/vicdata_teacher_default_neighbours_build_report_v1.md`. Calls: [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md), "2026-10-07 — 0.6.7".

## 1. B1 — Teacher-only school details

**What the Teacher page reads** from its comparator schools' details:

- **How this was found:** a recording Proxy on every profile, over 140 parity cases (the 0.6.5 matrix plus the ranking cases, both drawing paths, both phases, 1280 and 390, both themes).
- **What it reads:**

| Field | Read by |
|---|---|
| `urn`, `name` | every map (labels, tooltips, matching rows to schools) |
| `easting`, `northing` | the maps (position, the distance ring) |
| `establishmentTypeGroup` | the map's distance ring (independent vs state); the IGCSE gate |
| GCSE: `ks4Subjects[]` → `subject`, `period`, `entriesTotal`, `avgPointScore` | Comparisons' subject series (Graph, Ranking, Trend, % change), the maps' figures |
| Post-16: `ks5SubjectsByBucket[bucket][]` → the same four | the same, by bucket |

- **What it never reads:** the KS2 / GCSE / Post-16 headline, families, the KS5 qualification flags, or the census pages (`ageGenderCounts`, `ageGenderCountsByPeriod`).

**Design: (a), with (b) as the backup:**

- `chooser-set` now returns those fields, for this phase only, with every set it resolves (the nearest set, a list, a ranking's sample). When that set is all the page holds, which is the usual case, the profiles come with it: one request instead of two in a row.
- The 0.6.4 prefetch of the other phase's nearest set now warms its profiles too, so a phase switch makes no profile request at all.
- When the page also holds other sets (saved, custom or VC), it makes one `/api/teacher/comparator-profiles?anchorUrn&urns&phase` request for the whole union, exactly where it used to call `academic-schools`.
- Both reuse `fetchAcademicProfiles`' own `schools` query, so the same schools come back in the same order.
- **KS2 keeps `academic-schools`.**

**The Data View is unchanged.** `academic-schools`, `academic-data-view.ts` and the default-lists route are untouched. The changed files are the Teacher routes `chooser-set` and `comparator-profiles`, `TeacherDashboard.tsx` and the new `teacher-comparator-profiles.ts`. None of them is imported by anything under `src/components/data-view` or `src/app/api/data-view`.

**Fields diff** (`audit_scripts/v067_profiles/fields_diff.ts`): old `fetchAcademicProfiles` (with subjects) against the new lean profiles, projected onto the fields above and their order.

- **Sets covered:** the nearest set and the national-ranking sample at GCSE and Post-16 for 9 schools (36 sets, 594 profiles).
- **Result: 0 differences.**
- **Saved and VC sets:** both tables are empty in production, so there was nothing more to diff. The saved-set path is in the parity walk instead.

**Timings and bytes** (`audit_scripts/v067_profiles/timing.ts`): server work, median of 3.

| School · phase | Column 3 cold, before | Column 3 cold, after | Phase switch: profiles step | Profiles payload |
|---|---|---|---|---|
| 137625 The Chase · GCSE | 2.11 s | 1.00 s | 1.30 s → 0 | 1,056 → 302 KB |
| 137625 · Post-16 | 3.34 s | 2.10 s | 1.75 s → 0 | 1,509 → 313 KB |
| 117037 King's Worcester · GCSE | 2.20 s | 1.37 s | 0.90 s → 0 | 305 → 91 KB |
| 117037 · Post-16 | 2.89 s | 1.98 s | 1.35 s → 0 | 1,013 → 221 KB |
| 118952 Sevenoaks · GCSE | 1.61 s | 1.45 s | 0.20 s → 0 | 75 → 11 KB |
| 118952 · Post-16 | 2.82 s | 1.92 s | 1.44 s → 0 | 1,296 → 324 KB |
| 130432 Croydon · GCSE | 1.09 s | 0.82 s | 0.33 s → 0 | 596 → 8 KB |
| 130432 · Post-16 | 1.06 s | 0.94 s | 0.37 s → 0 | 596 → 187 KB |
| 100053 Acland Burghley · GCSE | 1.88 s | 0.92 s | 1.16 s → 0 | 1,263 → 301 KB |
| 100053 · Post-16 | 1.88 s | 1.10 s | 1.15 s → 0 | 1,443 → 303 KB |

- **Before:** the chooser set's build, then `academic-schools`, two requests in a row.
- **After:** the chooser set with its profiles, one request.
- **What's left:** the chooser set's own build (0.7–1.6 s). At Post-16 that is what B2 removes (§3).

## 2. A — Precomputed Post-16 nearest 10 (ingest repo)

Branch `feat/post16-neighbours`, commit 215df27, **not applied**. The full detail is in the ingest report.

- **Table:** `teacher_default_neighbours`, primary key `(entity_id, list_kind, rank)`, RLS on, no anon table access. It is stamped with `census_period`, `ks5_periods`, `computed_at`, and a stale marker that a promote of GIAS, the census or the KS5 sources sets inside its own transaction.
- **Lookup:** `teacher_default_neighbours_lookup(p_entity_id, p_list_kind)`, security definer, granted to anon, one school per call. An unknown URN returns no rows.
- **Approach: an app script, not Python.**
  - **Why:** the inputs live only in the app's Supabase project, and the rules are the app's TypeScript.
  - **The script:** `scripts/compute-teacher-default-neighbours.ts` runs the app's own `buildDefaultComparatorLists(… post16)` and `resolveNearestOption` for every eligible school, using the app's own `hasCurrentPhaseData`, with FE colleges excluded. It is read-only, with the anon key.
  - **Loading:** `backfill_teacher_default_neighbours.py` loads the CSV with the ingest's credentials, so there's no write key in vicdata_public.
- **Parity:** 2,571 eligible schools were computed (25,520 rows), then recomputed live in a second process. **0 mismatches**, including 137625, 117037, 118952, 100053 and a school with no sixth-form neighbours nearby (137739: 8 neighbours, the farthest 398 km).
- **Run time:** the full compute takes about 9 minutes; the load is under a minute.

## 3. B2 — The app reads the precomputed list

- **Where:** `resolveDefaultNearest` at Post-16 asks the lookup first (`src/lib/post16-default-neighbours.ts`).
- **When the list is used:** rows exist, none is stale, the census period is `CURRENT_CENSUS_PERIOD` (2025), and the KS5 periods are the latest two published (2023, 2024: `withKs5Results`' own read).
- **Otherwise, silently,** today's build runs: the function is absent, there are no rows (FE colleges, a new school), a list is stale, or the call errors. This is logged once per instance, never shown to the user.
- **Unchanged:** the hour cache, the 0.6.4 prefetch, GCSE and the Data View.

**Both states proven** (`audit_scripts/v067_neighbours/both_states.ts`):

- **Function absent:** production as it is today.
- **Function present:** a fetch stub serving A's computed rows for all 2,571 schools.
- **The comparison:** the whole `resolveDefaultNearest` answer (rows, series, count) against main's built path.

| School | Absent | Present | Built (main) | Precomputed |
|---|---|---|---|---|
| 137625 The Chase | identical | identical | 2.56 s | **0.18 s** |
| 117037 King's Worcester | identical | identical | 1.15 s | 0.12 s |
| 118952 Sevenoaks | identical | identical | 1.31 s | 0.13 s |
| 100053 Acland Burghley | identical | identical | 0.85 s | 0.09 s |
| 137739 (no sixth-form neighbours near) | identical | identical | 2.10 s | 0.08 s |
| 130416, 130432 (FE colleges) | identical | identical (falls back) | 0.5–0.6 s | — |

Unit tests (`post16-default-neighbours.test.ts`) cover the rules: a current list is used in rank order; a stale list, other periods, no rows, a missing function and an error all build as before.

## 4. Before / after: Column 3's critical path

| School | Cold load, GCSE | Cold load, Post-16 | Switch GCSE → Post-16 |
|---|---|---|---|
| 137625 The Chase | 2.11 → 1.00 s | 3.34 → 2.10 s; with A, ≈ 0.7 s | 1.75 s → 0 (prefetched set and profiles) |
| 117037 King's Worcester | 2.20 → 1.37 s | 2.89 → 1.98 s; with A, ≈ 0.6 s | 1.35 s → 0 |
| 118952 Sevenoaks | 1.61 → 1.45 s | 2.82 → 1.92 s; with A, ≈ 0.7 s | 1.44 s → 0 |
| 130432 Croydon (FE) | 1.09 → 0.82 s | 1.06 → 0.94 s (not precomputed) | 0.37 s → 0 |
| 100053 Acland Burghley | 1.88 → 0.92 s | 1.88 → 1.10 s; with A, ≈ 0.4 s | 1.15 s → 0 |

- **How the figures were measured:** server work, from §1 and §3.
- **"With A":** the after figure minus the built set plus the precomputed read.
- **Phase switch:** the prefetch has warmed both the set and its profiles, so the new phase's Column 3 needs no request.

## 5. Parity

The 0.6.5 harness, main (with 0.6.6) against the branch.

- **The fixtures:**
  - Main's `academic-schools` stub serves the full profiles, captured with `fetchAcademicProfiles`.
  - The branch's `chooser-set` and `comparator-profiles` stubs serve the lean ones, captured with the branch's own server function.
  - So the comparison is full against lean, on real data.

| Set | Pairs | Result |
|---|---|---|
| The 0.6.5 matrix: every Teacher view, both phases, 1280 and 390, both themes | 2,306 | **identical** |
| The 0.6.6 ranking cases (national and regional, excluded, pending, no subject) | 497 | **identical** |
| Saved-set cases (the `comparator-profiles` path): The Chase GCSE, King's Post-16, Croydon phone light | 72 | **identical** |

- **B2's page parity:** both states give the same `chooser-set` answer, byte for byte (§3), so the page is identical in each.
- **One browser console note, in 1 of 3 runs of one case:** a race in the shared map (OPEN_QUESTIONS). Pixels are identical.
- **Checks:** tsc, eslint, build, 364 unit tests, and the rule tests.

## 6. For Guy, in order

1. **Push the ingest branches.** Both failed with an SSH access error:
   ```
   cd ~/dev/vicdata && git push -u origin feat/subject-rank-lookup && git push -u origin feat/post16-neighbours
   ```
2. **Wait for Render's "Deploy live"** for vicdata_public main (0.6.6 and 0.6.7). Both are safe before any database change, thanks to the fallbacks.
3. **Apply the 0.6.6 ranking function** ([`v066_rankings_report_v1.md`](v066_rankings_report_v1.md) §6). Then **apply A's migration, compute, load and verify**: the `&&` chains are in the ingest report §5. The compute step runs from vicdata_public `main` and takes about 9 minutes.
4. **The checks:**
   - **The Chase, GCSE History, Comparisons → National ranking:** a real rank of N ("988th of 3,565 schools with GCSE History results" on Grade 4+), with the table centred on The Chase.
   - **Then, in a fresh browser, switch GCSE → Post-16 and time it in DevTools → Network:**
     - `chooser-set` (Post-16) should answer in well under a second once A is loaded;
     - there should be no `academic-schools` request at all on the Teacher page;
     - after the switch, Column 3 should draw from the prefetch.
