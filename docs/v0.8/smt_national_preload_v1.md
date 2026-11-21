# The national loads, preloaded at boot

Status: **(A), the boot preload, is built and tested locally (a built `next start` against the live reference data). It is off until `NATIONAL_PRELOAD=on` is set in Render.** (B), a durable snapshot, is measured and designed here but not built.

After every deploy or restart, the first SMT or Admissions view paid for the "national loads": England-wide values that are the same for every school, built once per process and kept 12 h (`server-cache.ts` `NATIONAL_TTL_MS`). With the preload, the server builds them itself a few seconds after it starts, one at a time, so the first visitor finds them in memory.

## What the national loads are (measured 21 Nov)

Each load ran in a fresh process, locally against the live data (`scripts/national-loads-measure.ts`). Heap is measured after a GC, before and after the load (it includes the raw reads kept beneath it). "Est." is the cache's own estimate, the one its 400 MB budget counts.

| Key | Cold | JSON | Heap | Est. | Who waits on it first |
|---|---|---|---|---|---|
| `adm:england-schools:2025` | 2.9–3.0 s | 20.5 MB | 58 MB | 61 MB | `/api/smt/school`, `/api/admissions/pipeline`, every Overview and ranking |
| `smt:population:ks4` | 1.1–1.6 s | 2.9 MB | 7 MB | 3.7 MB | `/api/smt/school`, Overview, Academic |
| `smt:population:ks5` | 0.9–1.0 s | 6.0 MB | 11 MB | 4.5 MB | `/api/smt/school`, Overview, Academic |
| `smt:england-ages` | 0.8–1.3 s | <0.1 MB | 11 MB | <0.1 MB | `/api/admissions/pipeline` (local births), SMT Context |
| `igcse:england` | 0.4–0.6 s | <0.1 MB | 2 MB | <0.1 MB | `/api/smt/school`, Overview |
| `igcse:families-out` | 4.2–4.9 s (incl. `igcse:england`) | 0.1 MB | 3 MB | 0.3 MB | IGCSE rankings (Academic, Admissions rivals, Teacher) |
| `adm:region-age0:{region}` × 9 | 0.35–0.45 s each | <0.1 MB | 3 MB each | <0.1 MB | `/api/admissions/pipeline` (the school's region) |
| `adm:age-profile-aggregates` | 0.15–0.2 s | 0.2 MB | 1.6 MB | 0.4 MB | `/api/admissions/pipeline`, SMT Context |
| `adm:flag-thresholds` | 0.1 s | <0.1 MB | 1 MB | <0.1 MB | `/api/admissions/pipeline`, Overview |
| `smt:boarders:2025` | 0.3 s | <0.1 MB | 2 MB | <0.1 MB | Overview |
| `smt:family-map:ks4`, `:ks5` | 0.1 s each | <0.1 MB | 1 MB | <0.1 MB | Academic, the SMT figures' version |
| `smt:england-births` | 0.2 s | <0.1 MB | 2 MB | <0.1 MB | SMT Context |
| `years:latest`, `phases:current-periods` | 0.1 s each | <0.1 MB | 1 MB | <0.1 MB | everything / the chooser sets |
| `dashboard:england:ks4`, `:ks5` | 0.1–0.2 s | 0.1 MB | 1.5 MB | 0.2 MB | Teacher dashboards |
| `smt:population:ks2` | 1.0 s | 3.7 MB | 16 MB | 5.3 MB | a primary school's SMT only |
| **All 26, one after another, one process** | **13–17 s** | 35 MB | **+96 MB** | **~76 MB** | |

**What made up the 8.7 s.** `/api/smt/school` waits on `adm:england-schools` (2.9 s), the two populations (1.1–1.9 s each) and `igcse:england` (0.4 s), all in parallel. Locally that is 2.0–3.4 s cold against 0.26–0.34 s warm. Live, on Render's 1 CPU in Frankfurt, it was about 9 s. The Overview then adds `smt:boarders` and `adm:flag-thresholds`.

**The Admissions pipeline's cold 8.1 s (Teacher home, Leighton Park, as SMT).** Locally, as the first call after a restart, `/api/admissions/pipeline` (11+) took 4.4 s cold:

- **National: about 3.7 s of the critical path.** `adm:england-schools` 2.8 s and `smt:england-ages` 0.8 s, which run side by side with `adm:region-age0:South East` 0.4–0.5 s, `adm:age-profile-aggregates` 0.15 s and `adm:flag-thresholds` 0.03 s.
- **The school's own: about 0.7 s.** `smt:area-context` 0.2–0.3 s, `adm:area-pop` 0.1 s, the school's boarders, its traits and info, and the region's LA crosswalk rows (`smt:la-gss:*`, 20 of them at about 0.1 s each, mostly in parallel).
- The pipeline's own feeder sets, read just before it (`listsForRoute`), took 0.4–0.7 s and read nothing national.
- With the preload: 0.7–0.85 s. Warm (second call): about 0.5 s locally (live 1.4 s).

## (A) The boot preload

| Piece | Path |
|---|---|
| The list: every national load, as the call the pages make | `src/lib/national-loads.ts` (`NATIONAL_LOADS`) |
| The preload: one at a time, every error caught, one log line | `src/lib/national-preload.ts` |
| The hook | `src/instrumentation.ts` `register()` |
| One store per process | `src/lib/server-cache.ts` (state on `globalThis`) |
| Measurement | `scripts/national-loads-measure.ts` (`--all` for one process) |
| Cold timings, with and without | `scripts/national-cold-timings.ts [--preload] [--pipeline-first] [--keys]` |

How it works:

- `register()` runs once when the server starts, and Next serves nothing until it returns. Checked against 16.4.6's docs: unchanged from 16.3. On the Node.js runtime with `NATIONAL_PRELOAD=on`, it only sets a timer for `NATIONAL_PRELOAD_DELAY_MS` (default 3000).
- When the timer fires, it imports the preload module, so nothing extra loads at boot. It then runs each entry of `NATIONAL_LOADS` in turn, with 100 ms between them.
- Each entry **is the call a page makes** (`population("ks4")`, `englandSchools()`, …): the same `cachedReference` key and the same loader. Nothing is copied.
- **No fan-out of its own.** Each load's internal reads are as narrow as they are for a page (`limited.ts`): `englandSchools` 3 + 3, `igcseEngland` 4, each region's LA crosswalk as `regionBirths` reads it.
- A visitor who arrives while a load is running shares its promise. Measured: `smtSchool` 2 s into the preload took 3.0 s, against 3.96 s cold, with no second read.
- A load that fails is dropped, as `cachedReference` always does, and left for the first page to build. The run carries on. At the end it prints one log line, e.g.:
  `[national-preload] 26/26 loaded in 17.1 s; cache 186 entries ~76 MB; heap 137 MB, rss 269 MB`. Any failures are named there.
- **Admissions added (21 Nov):** each region's births at age 0 (`adm:region-age0:*`, all nine), the age-profile aggregates and the flag thresholds. They are now kept 12 h like the other national values (`NATIONAL_PREFIXES`). Otherwise the preload's copies would expire after the hour.
  - Like the rest, they follow the data: when the results cache sees the data version move, it drops every in-process value (`results-cache.ts` `noteVersion`).

**The bug it uncovered: two caches.** Next builds `instrumentation.ts` as its own bundle, so it had its own copy of `server-cache.ts`. A first `next start` filled 15 entries (~75 MB) that no route could see: the route's copy held 0.

- The fix keeps the cache's state (the Map, the byte total, the counters, the caps) on `globalThis.__vicdataServerCache`. Every copy of the module shares one store, one LRU order and one 400 MB budget.
- A new test loads a second instance of the module and checks exactly that. It fails on main's `server-cache.ts` and passes with the change.
- The raw reads beneath the values (`reference-cache.ts`) stay per bundle. The preload clears its own copy when it finishes, so they aren't held twice.

## Timings, fresh process

**In-process, local against the live data** (`scripts/national-cold-timings.ts`, results cache off):

| Order | Step | Without | With the preload |
|---|---|---|---|
| Teacher home first | `/api/admissions/pipeline` (11+) | 4.4 s | 0.8 s |
| | then `/api/smt/school` | 1.9 s | 0.26 s |
| | then the Overview (10 nearest) | 0.54 s | 0.41 s |
| SMT home first | `/api/smt/school` | 3.4 s | 0.34 s |
| | then the Overview (10 nearest) | 0.63 s | 0.47 s |
| | then `/api/admissions/pipeline` | 1.6 s | 0.71 s |
| | **all views, from the first visitor** | 6.2–7.8 s | **2.1–2.3 s** |

**Built server (`next start`, 16.4.6), a temporary local-only route timing `smtSchool(110110)`** (removed before commit):

| | Without (`NATIONAL_PRELOAD` unset) | With (`=on`) |
|---|---|---|
| National keys held at boot / 5 s after | 0 / 0 | 0 / all 26 after 15–17 s |
| First `smtSchool` | **3.96 s** (second: 0.05 s) | **0.36 s** |
| A visitor 2 s into the preload | | 3.0 s (it shares the loads already under way) |
| `/api/health` during the preload (37 calls, every 0.5 s) | | all 200; median 1.6 ms, p95 8.8 ms, max 9.1 ms |
| Memory at boot | heap 41 MB, rss 83 MB | heap 41 MB, rss 82 MB (the preload starts after 3 s) |
| Memory after the preload | (after a cold `smtSchool`: heap 181 MB) | heap 137–140 MB, rss 269–275 MB; cache ~76 MB of the 400 MB budget |

Live will be slower (1 CPU, Frankfurt): expect the preload to take 20–40 s, so a visitor in that window still waits, but less.

## Checks

- `npx next typegen && npx tsc --noEmit -p .`: clean. `npm run build` on 16.4.6: clean.
- Unit tests (every `*.test.ts(x)` plus `catalogue-unit-tests.ts`, `--env-file=.env --env-file=.env.local`): 937 pass, 1 fail. The failure is `R-GROUP-WALKS-LOAD`, already failing on main.
- `scripts/catalogue-rule-tests.ts`: PASS 191, FAIL 17, the same 17 as on origin/main (run side by side).
- `server-cache.test.ts`: 12/12, including the new one-store-per-process test.

## Switching it on (Guy)

1. Merge, deploy, then set `NATIONAL_PRELOAD=on` in Render's environment. Optional: `NATIONAL_PRELOAD_DELAY_MS` (default 3000).
2. After the deploy, look for the `[national-preload] …` line in the log, about 20–40 s after "Ready". It should say 26/26, with heap well under the limit.
3. To turn it off: unset it, or set it to anything else, and restart.

`scripts/warm-demo.mjs` is still useful for the school's own values (1 h) and the big sets. The national ones no longer need it.

## (B) A durable snapshot: measured, not built

- **It would beat rebuilding.** All 26 values come to 35 MB of JSON, 2.7 MB gzipped. Gunzip and parse take 0.9 s locally; `adm:england-schools` alone is 21.4 MB, 1.65 MB gzipped, 0.68 s. That compares with 13–17 s to rebuild.
- **It doesn't fit `results_cache`.** `adm:england-schools` is four times its 5 MB cap, and the values are Maps and Sets, which plain JSON doesn't keep. So it would be its own small table, e.g. `national_snapshot(key, data_version, code_version, gz bytea, bytes, built_at)`, service role only. It would be built by a `--stage national` in `scripts/build-smt-figures.ts` (the nightly `--stage all`), versioned like the results cache (`liveVersions`: source stamps + school sync + `server_code`), and never stored from a degraded build (`traced` + `isDegraded`). It would need a parity script that rebuilds every key and compares the snapshot's JSON byte for byte.
- **What it would still add after (A):** the window of 20–40 s after each deploy, during which a visitor waits on the preload, would shrink to about 2 s. And a deploy would no longer re-read the 26 national loads from the reference database.
- Recommendation: it is worth doing after the demo. (A) already removes the cost for every visitor who arrives once the preload has finished.
