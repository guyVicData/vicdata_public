# SMT Overview figures, built ahead (speed plan §4.2 item 1, extended to the Overview)

Status: **built and tested locally against the live reference data; not applied, not switched on.** See "Switching it on".

The design follows SMT Academic's (`smt_school_figures_v1.md`): one per-school implementation used by both today's reads and the build, which is how parity is guaranteed.

## What the Overview reads (`buildOverview`)

| Part | What it reads | Now |
|---|---|---|
| **Per set school** (and the school itself, as one of the map's dots and the market's schools): the set's average day and boarding lines, the map's rolls and roll direction | the school census by year (`schoolCensuses`: every census row of every set school; today read **twice**, once for the lines and once for the map) | **built ahead** (`c`) |
| **Per set school:** the set's size by phase (F-10) | Admissions' age-by-age census, latest year (`cachedCensus` → `sizeByBand` totals) | **built ahead** (`b`) |
| **Per set school:** market share at 11+ against the set (F-9) | Admissions' age-by-age census, every year (`buildMarketShare` → `groupShare` at age 11) | **built ahead** (`k`) |
| Names and coordinates (map, hovers, the market's largest rival) | `fetchSchoolInfo` (the app's `schools`, 300 a query; ~0.2 s for 488) | today's read |
| The school's own census, sizes, entry tiles, entry flag | `school.census`, `cachedCensus([urn])` | today's read (one school) |
| National and area context: the populations (ranks, set places, results bands, P8, VA), England's schools (roll row, region, top age), the IGCSE list, boarders by URN, age-band distributions, flag thresholds | national loads, cached 12 h per process and shared with `/api/smt/school` | today's reads (not per set) |
| Caller | only `admissions.privateNote` (a head office the school doesn't share Admissions with) | unchanged; the results cache keys on it |

Measured cold (Leighton Park, 488 independents, Post-16): the age-by-age census 3.0 s, the census by year 4.1 s, and the same census by year again for the map, about 4 s. That is all of the set's cost. Everything else was already warm from `/api/smt/school`.

## The pieces

| Piece | Path |
|---|---|
| Per-school figures (pure): `overviewFigures`, `OverviewMembers`, `overviewMembersFromRaw` | `src/lib/smt/overview-figures.ts` |
| Read path, version, switch, encode | `src/lib/smt/overview-figures-store.ts` (`overviewInputs`) |
| Group share split in two (no behaviour change) | `src/lib/admissions/shares.ts`: `cohortSeries` + `groupShareOfSeries`; `groupShare` is their composition |
| Builder wiring | `src/lib/smt/overview.ts`: bands, set lines, `mapRolls` and `marketAt11`'s set branch read members |
| Migration | `supabase/migrations/20261125110000_v08_smt_census_figures.sql` |
| Ops | `supabase/ops/smt_census_figures/{apply,verify,rollback}_smt_census_figures.sql` |
| SQL test (PGlite) | `supabase/tests/v08_smt_census_figures_pglite.mjs` (`ROLLBACK=1` also runs the rollback) |
| Unit test | `src/lib/smt/overview-figures.test.ts` |
| Build | `scripts/build-smt-figures.ts --stage census` |
| Parity harness | `scripts/smt-overview-parity.ts` (`--figures-pglite DIR` reads the figures) |

**The parity rule.** The Overview reads every school through `OverviewMembers`:

- **Today's reads:** `overviewMembersFromRaw` over `cachedCensus` and `schoolCensuses`, each school worked out by `overviewFigures`.
- **The figures:** the stored `overviewFigures` output, built from those same two reads.

The market's set branch computes `groupShareOfSeries` over the members' entry cohorts. That is the same function `buildMarketShare` → `groupShare` runs on the same census. Pupils' market (no set) still calls `buildMarketShare`.

## Storage

- **No new table.** `smt_school_figures` takes a third stage, `census`. The migration only widens `smt_figures_builds`' stage check.
- **One row per school**, at period 0. `figures` holds:
  - `c`: each census year, `[period, roll]` or `[period, roll, day, boarders]`
  - `b`: band → pupils, from the latest census with pupils
  - `k`: `[period, Year 7 cohort or null]`
- **Reads:** the existing `smt_school_figures_read('census', version, urns, 0, null, null, null)`: one call per Overview.
- **Access:** RLS, grants and the function are unchanged: service role only, anon and authenticated locked out (re-tested).
- **Version:** `census-…`, a hash of:
  - the reference stamps of `dfe_school_census`, `gias` and `gias_links` (the lookups' lineage)
  - the last school sync
  - `CENSUS_FORMAT`, the age bands, the entry age and `CENSUS_FIRST_PERIOD`
- **After an ingest:** a new census promote, GIAS refresh or school sync moves the version, and the Overview makes today's reads until the next build. Versions are never mixed.

## The switch: `SMT_OVERVIEW_FIGURES=on`

The Overview has its own switch, separate from Academic's `SMT_FIGURES`. Academic's is already on live, so with a shared switch this deploy would start reading census figures before any are built, and couldn't be rolled back without turning Academic off too.

The Overview falls back to today's reads, with one log line, whenever:
- the switch is off;
- there is no complete census build for the current version;
- any school in the request (the school or a set school) wasn't built, e.g. a closed school in a saved list;
- any read fails.

## Measured (local, against the live reference data, 20 Nov)

**The build** (`--stage census`, 3 batches of 40 schools at a time):
- 27,602 schools (every open school plus SMT's national KS4/Post-16 populations), 24,655 with a census.
- 27,602 rows, 7.3 MB of JSON, **544 s**.
- Two batches hit production's statement timeout and passed on their first retry.

**One read:** about 270 bytes of JSON per school, so about 130 KB for a 488-school set.

**Cold Overview, each in a fresh process** (`/api/smt/school`'s national loads warm first, as on the page):

| Set | main | this branch, switch off | figures |
|---|---|---|---|
| Leighton Park Post-16, independent schools in England (488) | 19.5 s | 10.0 s | 0.72 s |
| Leighton Park Post-16, all sixth forms and colleges in the South East (457) | 19.3 s | 9.2 s | 0.74 s |
| Leighton Park GCSE, all schools in the South East (682) | 19.1 s | 14.7 s | 0.87 s |
| George Dixon GCSE, state schools in the West Midlands (416) | 19.8 s | 8.5 s | 0.99 s |

- The figures were read from local PGlite; live adds one RPC round trip.
- With the switch off, the branch is already faster than main because the census by year is read once instead of twice.
- **Warm** (second build, same process): 50–160 ms on every path.
- **The 58-case matrix in one process,** sum of first builds: main 220 s, switch off 129 s, figures 12 s.

## Parity (byte-for-byte JSON)

| Matrix | Cases | Identical | Different |
|---|---|---|---|
| Switch off (today's reads through members, `groupShare` split, census read once) vs `origin/main` | 58 | 58 | 0 |
| Figures (PGlite build) vs `origin/main` | 58 | 58 | 0 |
| Edge cases: the school in its own fixed list; a closed, unbuilt school in the list (falls back); a head office | 3 | 3 | 0 |
| An incomplete census build (every request falls back) | 2 | 2 | 0 |

The 58 cases:
- **Leighton Park (110110):** GCSE and Post-16 sets, each × 10 nearest, independent schools in England, independent schools in the South East, and all schools in the South East.
- **George Dixon (138695):** GCSE and Post-16 × nearest, and state schools in the West Midlands.
- **Ashton (146816) and Barton Peveril (130701):** Post-16 × nearest, and all in the South East (E12000008).
- **A head office the school doesn't share Admissions with (privateNote):** Leighton Park and George Dixon, nearest.
- **10 random schools with sixth forms** (seed 20261120: 100001 150196 139362 137928 102854 138682 126110 110119 136467 141009): GCSE and Post-16 × nearest, and their own sector's region.

## Switching it on (Guy)

1. **Apply the migration:**
   - `supabase db query --remote --yes -f supabase/ops/smt_census_figures/apply_smt_census_figures.sql`
   - then `supabase db query --remote --read-only -f supabase/ops/smt_census_figures/verify_smt_census_figures.sql`. Expect:
     - `recorded 1`
     - `census_allowed true`
     - `rls_on true`
     - `policies 0`
     - `tables_locked true`, `read_locked true` and `server_reads true`
2. **Build:**
   - Run `npx tsx --env-file=.env --env-file=.env.local scripts/build-smt-figures.ts --live --stage census` once nothing else is reading the reference database heavily. It takes about 9 minutes and writes 27,602 rows.
   - Then re-run verify: expect a `complete` census build next to the ks4 and ks5 builds.
3. **Switch on:** set `SMT_OVERVIEW_FIGURES=on` on Render and deploy.
   - **Check:** `/teacher/smt?lookAs=110110&as=smt&peek=1` against independent schools in England is quick on its first view after the deploy.
   - Render's log shows no `[smt figures] census: … today's reads` line for it.
4. **After every school census promote, GIAS refresh or school sync,** run step 2 again. Until then the Overview makes today's reads. They're slower, but correct.

**Rollback:** unset `SMT_OVERVIEW_FIGURES`. Optionally also run `rollback_smt_census_figures.sql`, which deletes only the census builds and leaves Academic's figures.
