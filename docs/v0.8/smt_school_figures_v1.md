# SMT school figures, built ahead (speed plan §4.2 item 1)

Branch `smt-figures-precompute`. Status: **built and tested locally; not applied, not switched on.** See "Switching it on" for the steps that need Guy.

## What it does

SMT Academic compares a school with every school in its set. For a big set (488 independent schools in England, 3,497 state schools at GCSE), today's path reads every set school's raw rows on each request (62,618 subject rows for the 488) and works each school's figures out again.

Now each school's figures are worked out once per key stage and year, by `scripts/build-smt-figures.ts`, into `smt_school_figures`. A request reads one small row per set school and year, plus the set schools' subject rows for the one year the page compares subjects in. The set's figures (places, medians, middle halves, the board, the subject comparisons) are computed from those exactly as before.

**Parity rule.** There is one implementation of every per-school figure, `src/lib/smt/school-figures.ts` (`yearFigures`). The builder (`academic.ts`) reads every set school through `Members`:

- **Today's reads:** `membersFromRaw` over `qualRows`, `subjectVa` and the area rollup, each school and year worked out by `yearFigures` the first time it's needed.
- **The figures:** `membersFromStore` over the build's stored `yearFigures` output, built from those same reads.

Nothing else in the builder changed. The school's own rows still come whole, in the reads' order.

## The pieces

| Piece | Path |
|---|---|
| Per-school figures (pure) | `src/lib/smt/school-figures.ts` |
| Read path, version, encode/decode | `src/lib/smt/smt-figures-store.ts` |
| Builder wiring | `src/lib/smt/academic.ts` (post16, gcse), `src/lib/smt/academic-sets.ts` (`offering` can take the figures) |
| Migration | `supabase/migrations/20261125090000_v08_smt_school_figures.sql` |
| Ops | `supabase/ops/smt_figures/{apply,verify,rollback}_smt_figures.sql` |
| SQL test (PGlite) | `supabase/tests/v08_smt_figures_pglite.mjs` (`ROLLBACK=1` also runs the rollback) |
| Unit test | `src/lib/smt/school-figures.test.ts` |
| Build script | `scripts/build-smt-figures.ts` (`--pglite DIR` / `--out FILE` / `--live`) |
| Parity harness | `scripts/smt-academic-parity.ts` (`--figures-pglite DIR` reads the figures) |

**Why the app repo, not the ingest.** Parity depends on the build running the app's own TypeScript: `qualRows` with its subject renames and qualification aliases, `parseVa`, and `yearFigures`. The Python ingest can't share that code, and a second copy is exactly what the rule forbids. So the ingest's last step (or a Render cron job) runs `npx tsx scripts/build-smt-figures.ts --live` from this repo.

## Tables

- **`smt_school_figures`:** one row per (stage, data_version, urn, period).
  - `figures` (jsonb): the `yearFigures` output. Keys:
    - `e`: entries
    - `g`: Post-16 group → [entries, points]
    - `v`: Post-16 value-added line rows
    - `a`: GCSE area entries
    - `f`: GCSE area rollup rows
  - `subjects`: that year's subject rows, compact, each carrying its place in the school's read.
  - `va`: Post-16 value-added rows.
  - Period 0 is a marker meaning "this school was built". A set school with no marker isn't built, and that request makes today's reads.
- **`smt_figures_builds`:** (stage, data_version) → status `building` | `complete`, counts and timings. Deleting a build cascades to its rows.
- **`smt_school_figures_read(stage, version, urns, period_min, subject_period, full_urn, drop)`:** one call answers with one JSON value. It returns null unless that version's build is complete.
  - `drop` leaves out figure parts the view doesn't read. For GCSE that's the area entries outside Entries and the area rollup outside an area's Results, which are most of a national set's answer.
  - The app guards a dropped part: reading one throws (and that request falls back to today's reads) rather than reading as zero.
- **Access:** RLS is on with no policies. Only the service role can read or write; anon and authenticated can't touch either table or the function (tested).

## The data version and the switch

- **The switch:** `SMT_FIGURES=on` (Render env). It's off by default. When off, nothing reads the tables.
- **The version** is computed by the app (`figuresVersion`) from:
  - the reference source stamps of the sources the figures come from:
    - ks4: `dfe_ks4_subject_entries` (and `_historic`), `gias`, `gias_links`
    - ks5: `dfe_ks5_subject_results` (and `_historic`), `dfe_ks5_subject_value_added`, `gias`, `gias_links`
  - the last school sync;
  - the app's subject maps (latest names, the VRQ rename, qualification aliases);
  - hashes of the ingest's subject family map and label crosswalk;
  - `FORMAT` and `BUILD_FROM`.
- **After an ingest,** the version moves and every request makes today's reads until a build for the new version is complete. Old and new figures are never mixed: every row read carries the one version.
- **When figures are not used:** the switch is off; there is no complete build for the version; a set school isn't built; the page asks for a year before 2020/21 (a school whose latest Post-16 year is 2021/22 or older); or any error. In each case the request makes today's reads, with one log line.
- **Bump `FORMAT`** (smt-figures-store.ts) whenever what is stored, or how a stored figure is worked out, changes. That covers school-figures.ts, `qualRows`, `parseVa` and `groupOfQualification`.
- **Not covered by the version:** an ingest that rebuilds the subject rollups without promoting a source or changing those maps. Run the build after any rollup rebuild, as for `rebuild_rank_figures.py`.

## Measured (local, against the live reference data, 20 Nov)

- **The build** for both key stages took 55–63 s:
  - ks4: 7,740 schools asked (5,457 with figures), 31,899 rows, 44 MB of JSON.
  - ks5: 7,523 schools asked (2,996 with figures), 18,704 rows, 35 MB of JSON.
- **Cold first view,** each in a fresh process, main → figures (the set's own resolution, timed separately, is unchanged):

| Set | Main | Figures |
|---|---|---|
| Leighton Park Post-16, independent schools in England (488) | 16.6 s | 0.6 s |
| Leighton Park Post-16, all sixth forms in the South East (457) | 12.7 s | 0.4 s |
| George Dixon GCSE, state schools in the West Midlands (416) | 7.4 s | 0.5 s |

- **Warm, all 18 states** (Leighton Park, 488 schools): 18.2 s → 0.75 s.
- **One read's payload** (local PGlite; live adds the network and gzip):
  - 488 independents, Post-16: 2.0 MB of JSON (0.28 MB gzipped).
  - The national state GCSE set was 18 MB (2.0 MB gzipped) before `drop`. The figure after `drop` is in the parity summary.

## Switching it on (Guy)

1. Apply the migration:
   - `supabase db query --remote --yes -f supabase/ops/smt_figures/apply_smt_figures.sql`
   - then `supabase db query --remote --read-only -f supabase/ops/smt_figures/verify_smt_figures.sql`. Expect `recorded 1`, the tables there, `rls_on true`, `policies 0`, both locks true and `server_reads true`.
2. Build: `npx tsx --env-file=.env --env-file=.env.local scripts/build-smt-figures.ts --live`. It takes about a minute and writes about 50,000 rows. Re-run verify: one `complete` build per stage.
3. Set `SMT_FIGURES=on` on Render and redeploy.
   - **Check:** `/teacher/smt/academic?lookAs=110110&as=smt&peek=1` against independent schools in England is fast on its first view. Render's log shows no `[smt figures] … today's reads` line for it.
4. **After every ingest** (KS4/Post-16 subject promote, GIAS refresh, subject map migration), run step 2 again. Until then pages make today's reads. They're slower, but correct.

**Rollback:** unset `SMT_FIGURES`, then optionally run `rollback_smt_figures.sql`. It drops only rebuildable figures.
