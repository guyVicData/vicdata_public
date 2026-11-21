# Results cache: one code version per view

Branch `t3/per-view-code-version` (21 Nov). It goes with speed plan §4.2 item 2 (`docs/v0.8/speed_plan_v1.md`).

## The problem

Every answer in `public.results_cache` was stored under one code version, `server_code`. That is a hash of every file the API routes import, plus `package-lock.json`. So any server deploy threw away every stored answer for every school, even a one-line fix to an unrelated route. The first visitor to each page then paid the full build again: 5–8 s on SMT and Admissions.

## The design

**One module per view.** `src/lib/cached-views.ts` is split into `src/lib/cached-views/`, one module per stored view, and listed in `src/lib/cached-views/views.json` (view name → module). Each view's `resultKey` and `cachedResult` are called in its own module and nowhere else. The Teacher dashboard's `cachedResult` used to sit in its route; it has moved to `teacher-dashboard.ts`. The keys, the builders and their output are unchanged; the parity check below shows the answers are byte for byte the same.

The 17 views are: `smt/school`, `smt/overview`, `smt/academic`, `smt/pupils`, `smt/context`, `smt/context/map`, `admissions/pipeline`, `admissions/market-share`, `admissions/rivals`, `admissions/shape`, `front-door/teacher`, `chooser/nearest`, `chooser/urns`, `chooser/ranking`, `chooser/ranking-full`, `teacher/saved-set-ranks` and `teacher/dashboard`.

**Each view's files** (`scripts/write-build-info.mjs`, `view_code`):

1. everything the view's module imports, followed import by import;
2. every file that imports the module, and the files that import those, up to the routes, with everything each of them imports. These are the files that work out the view's inputs: the caller check, the set, the school and the catchment. This is how SMT's `smt/school`, which the SMT views take but key only on its URN, ends up in each SMT view's files;
3. ALWAYS: `results-cache.ts`, `build-trace.ts`, `server-cache.ts`, `reference-cache.ts`, `build-info.ts`, `supabase.ts`, `scripts/write-build-info.mjs`, `tsconfig.json`, `next.config.ts`, `package.json` and `package-lock.json`.

Test files are left out. The version is sha256 (16 hex) over `"view-code v1"`, the view's name, and each file's path and text. It can never equal a `server_code`, so a row stored under the single version never matches; no epoch bump is needed.

**The walker** reads every import form the server code uses:

- `import … from`, including imports split over several lines;
- `import type` and `export type … from`. These are followed: they run nothing, so following them can only add files;
- `import * as`, `export { } from`, `export * from` and a bare `import "x"`;
- dynamic `import("x")`, `require("x")` and JSON imports.

It follows imports written in comments too, which again only adds files. For the per-view walk it is strict: an `@/` or relative import that names no file stops the walk, and the build falls back to `server_code`.

Nothing a view reaches reads files at run time except `groups/aggregates.ts`, whose fixtures are read only behind the test switch (`fixture-switch.ts`). Packages are covered by `package-lock.json`.

**The checks happen at build time.** A view list that doesn't match the code fails `npm run build` with exit 1. That happens when:

- a `resultKey` view isn't a string literal;
- a view has no entry in `views.json`;
- a key is built outside its view's module;
- a listed module is missing, or doesn't build its view's key;
- `cachedResult` is called outside a listed module.

**Fallback.** If the walk itself fails, `view_code` is null and every view uses `server_code`. That discards more, never less. With no `server_code` at all, the cache stays off, as before.

**At run time** (`results-cache.ts`), a key's view is its first part. Reads, writes, the in-memory (L1) key and the "version moved while building" check all use that view's own version. A view the build has no version for uses `server_code`.

**The prune** compares each row with its own view's version: one delete for another data version, then one delete per view (`key like 'view|%' and code_version <> its version`). The 15-minute grace is unchanged. Rows of a view this build doesn't list expire under the 24-hour age rule.

## The boot preload

`src/instrumentation.ts` (7c8082cc / c9c8db1e, behind `NATIONAL_PRELOAD=on`) fills the same in-process keys the views read. Some of its loaders are written in `national-loads.ts` itself, and no route imports it. So neither a view's files nor today's `server_code` cover it. **That gap already exists on main.**

The build now writes `preload_code`, a hash over everything `instrumentation.ts` reaches. With the preload on, every view's version (and `server_code`) is mixed with it (`codeVersions`), so a change to what the preload runs moves every view. With it off the preload can't change a value, so the versions are left alone. If the preload is on and `preload_code` is unknown (its walk failed), the cache is off.

Putting the preload's files into every view instead would add 9 to 87 files per view and lose most of the gain.

## The proofs

**1. The walker's set holds the true set, and every file in it moves the version** (`src/lib/cached-views/view-code.test.ts`).

The true set is what esbuild's metafile bundles from each view's module and from every route whose bundle reaches it. Routes are bundled one by one, and esbuild resolves `@/` through tsconfig. Type-only imports esbuild drops must still name a real file.

For all 17 views, the walker's set holds the whole esbuild set. For example, `smt/overview` has 79 files in esbuild's set and 97 in the walker's; `teacher/dashboard` has 39 and 48.

Then each of the 199 files in any view's set is changed in turn, in a copy of the repo, and the whole walk is rerun. Every view whose esbuild set holds the file changes its version. In fact exactly the views whose walker set holds it change.

**2. Isolation.** 30 files are in one view's set only, such as each view's route and module. Changing one of those moves only that view. `package-lock.json` moves every view. A page component moves none. A new view, or pointing a view at another module, moves only the views involved.

**3. Parity.** `scripts/results-cache-parity.ts`, read-only against the live data, data version `ba3789162b615dd7`, 66 requests over all 17 views:

- each answer cache-off equals cache-on, byte for byte;
- a fresh process is served from the store (a local PGlite stand-in), byte for byte;
- the 66 cache-off answers on origin/main (the old `cached-views.ts`) and on this branch are **byte-identical**.

A second run used each view's real `view_code`: 65 of 66 were served from the store, and every row was stored under its own view's version. The one rebuilt was `teacher/saved-set-ranks`, whose own `minBuildMs: 100` wins over the script's 0. On main the same view shows up as 2 rebuilt (64 of 66). This is why the script exits 1 on both branches; it isn't a difference in any answer.

The unit tests are `results-cache.test.ts` (per-view hits and misses, L1, the version-moved check, the Postgres prune through a stand-in client, and `codeVersions` with the preload) and `feedback-deploy-gate.test.ts` (build info).

## What a deploy discards

The table counts views discarded out of 17, matching each commit's files against this branch's sets. Today, every one of these discards all 17.

| Commit | What changed | Per-view |
|---|---|---|
| 14014804 saved sets, faster | its route, and the new `cachedFixedSetRanks` | **1** (teacher/saved-set-ranks) |
| e79a9c21 SMT sets up to 750 | `smt/auth.ts` | 6 (the SMT views) |
| d6953f46 Pupils' census reads | `smt/pupils.ts` | 2 (smt/pupils, smt/school) |
| 8449d9e6 Overview census through members | SMT and Admissions code | 10 |
| 07692b79, f5369da9, f5903a73, d4ae3b4b … | shared reference reads (`vicdata-reference`, `limited`, census) | 17 |
| c9c8db1e national preload | `server-cache.ts` (ALWAYS) | 17 |

Changes to the shared readers still discard everything, as they must. Route and view fixes no longer do.

`smt/school` is in every SMT route's files, because each one calls it, so it moves with any SMT route change. That is over-inclusion: it costs a rebuild, never a stale answer.
