# VicData 0.8: SMT Academic round 2 report (v1)

Built from `docs/v0.8/smt_academic_r2_claude_code_prompt_v1.md`, Guy's review of round 1.

**Branches (neither merged):**
- **App:** `feat/smt-academic-r2`, branched from `feat/smt-academic-modes` because round 1 isn't merged.
- **Ingest:** `feat/va-subject-label-map`, in worktree `~/dev/vicdata_va_label_map`. Its migration is written, dry-run and PGlite-tested, but not applied: Guy's command is below.

## Decisions recorded
- **OPEN_QUESTIONS:** A1–A11 and the pills round's three calls are marked decided, each with Guy's answer of 8 Nov.
  - A1 approved.
  - A7 no change.
  - A4, A5, A6 and A8 accepted.
  - A2, A3, A9 and A10 noted.
  - A11 superseded by fix 1.
  - The pills calls accepted.

## A1: the subject matches, approved and into the shared crosswalk

### App
- **Approved.** `VA_SUBJECT_MATCHES_STATUS = "approved"`. The doc is now `docs/v0.8/va_subject_matches_v1.md` ("APPROVED, Guy 8 Nov 2026"), with the table unchanged; D&T Textiles Technology stays in Arts, Media & Design.
- **Rows for the ingest.** The generator also writes `docs/v0.8/va_subject_matches_v1.json`.
- **The app reads the database** (`src/lib/smt/academic-data.ts:vaMatcher`):
  - It reads the crosswalk through `academic_subject_label_map_lookup`, an existing RPC that anon can call.
  - A qualification row is VicData's match (marked †); a row for every qualification is DfE's own rename.
  - Until the database carries the value-added names it falls back to `src/lib/smt/va-subject-matches.ts`, the same list.
  - **The file stays until the ingest step has landed**, then goes.
- **R-VA-SUBJECT-MATCH now:**
  - reports **approved**;
  - checks every name has an area or an outside mark;
  - once the database carries the names, checks the database and the file agree name by name.

  Today: PASS, `app_reads=file`, "the database not carrying the value-added names yet (20261108120000 pending)".
- **The database path is proven ahead of the apply.** I primed the app's cache with today's live KS5 map (16 rows) plus the migration's 84 rows. The app then took the database path, and all **368 names agree** with the file: subject, area and outside mark (`disagree=0`).

### Ingest (`~/dev/vicdata_va_label_map`, branch `feat/va-subject-label-map`)
- **`va_subject_label_map.py`.** It runs a read-only dry run and writes the migration with `--write-migration` from the approved rows (`docs/va_subject_matches/va_subject_matches_v1.json`).
- **Migration `20261108120000_va_subject_label_map.sql`:**
  - **84 `subject_label_map` rows**: `ks5`, the value-added name, its qualification, the results name, note "value-added name, approved 8 Nov 2026".
  - **0 `subject_family_map` rows**: every approved name has a results equivalent.
  - **Not added:**
    - 256 names already the results name;
    - 23 already led there by DfE's own renames (the existing rows for every qualification);
    - 5 outside the areas (the EPQ and the IB's whole-diploma and core rows).
  - **A guard** refuses if any value-added row's results name lacks a family row.
- **Dry run** (read-only, live; `docs/va_subject_matches/dryrun_2026-11-08.txt`). All four checks pass:
  - **Results rows renamed by the new rows: 0.** No results file stores any of these (qualification, name) pairs, so no rollup changes and **no rebuild is needed**. The rows are qualification-specific, and `subject_label_variants` follows rows for every qualification only, so every subject lookup answers as before.
  - **Chains: 0.**
  - **Results names with a family:** 84 of 84, each in the approved area.
  - **Value-added names in the data:** 368, none missing from the list.
- **PGlite** (`docs/va_subject_matches/pglite_check.*`) on the live KS5 map and family rows:
  - 84 rows added;
  - a second run leaves 84 (idempotent);
  - the guard refuses when a family row is missing.
- **`check_subject_latest_names.py`** now sets the value-added rows aside, so its 32 / 16-row counts and its comparison with the app's latest-names copy still hold.

**Guy's command:** step 1 of "Guy's commands" below (also in `docs/va_subject_matches/commands.md` in the ingest repo). After that, a short follow-up deletes `va-subject-matches.ts` and the file fallback.

## Fix 1: one entry total per page (R-SMT-ENTRIES-ONE-TOTAL)
- **The source** is the **subject-by-qualification rollup** (`academic_subject_qualification_headline`; GCSE, the subject rollup). It drives column 1's total, every group line and share, the entries mix, the subject areas' shares and the board.
- **Why it, not `bucket:*::entries`.** Its yearly sum is **exactly DfE's own "All subjects" total exam entries**. VicData's headline groups undercount. For Plumstead Manor 2024/25:
  - DfE's All-subjects rows add up to **419** (A level 229, BTEC/OCR/VRQ 171, EPQ 16, Core Maths 2, AS 1);
  - the buckets gave **381** (A level 202, BTEC/OCR 163, Other 16).
- **The mix now reads:** Plumstead 418 / 389 / 413 / **419**, against column 1's **419**.
- **Leighton Park's IB** reads the IBO component entries, not the bucket: 91, 89, 62, then none in 2024/25. The sentence still says it stopped.
- **GCSE.** Each area's entries are now the same subject rows' (round 1 read the family rollup), so the areas add up to column 1's total: Acland Burghley 572 + 502 + 334 + 123 + 44 + 9 + 1 = **1,585**.
- **R-SMT-ENTRIES-ONE-TOTAL** (new, PASS): Plumstead's column 1 419 = DfE All-subjects 419 = mix 419 = group lines 419; Acland Burghley GCSE total 1,585 = areas 1,585.
- **R-SMT-VIEW-MIX** is rewritten to the same source; its check compares the IB with the rollup's IBO entries (PASS).

## Fix 2: one scale for the subject areas' share bars
- **One scale.** Every bar and every "set's typical" marker in the view is drawn against one scale: the largest share or typical share shown.
- **Plumstead:** Finance (VRQ) 18.6% now draws more than four times Economics' 4.3%; before, both filled the cell.

## Fix 3: the trend chart (every mode)
- **The cause.** The band was right: the set's 25th–75th percentile year by year (Leighton Park A-level value added: +0.02 to +0.23 in 2023/24, **+0.07 to +0.29 in 2024/25**). The problem was the drawing:
  - the shared chart (`Lines.tsx BandChart`, Overview's) had no y-axis;
  - its axis was cut to the data, so the band filled the plot.
- **The board's +0.07 to +0.36** came from its straight-distance set. Teacher's rule picks The Oratory School where the board had St Joseph's College, so the 75th percentile is +0.29.
- **The new chart** (`views/Academic.tsx:AcTrendChart`) draws:
  - a labelled y-axis on round steps;
  - a line at 0 (England's average) for value added, with 0 always in view;
  - the band year by year;
  - the school's line with its figure on each point;
  - the years under it.
- **All three modes, both levels** use it: points, share of entries, value added, Progress 8 (band only for an independent school). Overview's chart is unchanged (parity).

## Checks
- **Full rule suite on real data:** PASS=153, FAIL=2, ERROR=0, MANUAL=16, NONE=19, SUPERSEDED=8 on the first run. Both fails were this round's, and both are fixed:
  - R-SMT-YEARS caught a year literal ("approved 8 Nov 2026" in `academic.ts`).
  - R-REPORT-COMMANDS-ORDER caught that neither Academic report had the seven-step "Guy's commands".

  Both reruns pass (below). MANUAL includes R-SMT-ENTRIES-SIZE until the size table is applied.
- **Catalogue unit tests:** 77 pass, 0 fail. `src/lib/smt/*.test.ts` and `subject-entry-size.test.ts`: 48 pass, 0 fail.
- **tsc, eslint:** clean (apart from the pre-existing `LayoutProps` before `next typegen`).
- **Parity, as round 1** (server render, `main` 0f512e5 against this branch, same live data):
  - The control bar as Teacher and Admissions draw it: **byte-identical**.
  - Overview, Pupils and Context: **84 of 86 identical**, with the same two expected differences as round 1 (a day school's "Your pupils now" sentence no longer mentions the filter). The two new Pupils views exist on the branch only.
  - Round 2 changed nothing outside Academic.

## Screenshots
`docs/v0.8/smt_academic_r2_screenshots/`, all real data:
- **Before:** `before-AC-PM-Entries-{dark,light}` (fixes 1, 2), `before-Main-{dark,light}` (fix 3, value added), `before-AC-LP-Chart-dark` (fix 3, results).
- **After:**
  - `after-AC-PM-Entries-{dark,light}`: 419 in column 1 and the mix; one-scale bars.
  - `after-AC-PM-Entries-dark-390`: phone.
  - `after-Main-{dark,light}`: the value-added trend with its axis, 0 line and band.
  - `after-AC-LP-Chart-{dark,light}`: the results trend.
  - `after-LP-GCSE-{dark,light}`: Progress 8, band only, for an independent school.

## Guy's commands

These follow the template in `docs/FEEDBACK.md`. **Merge `feat/smt-academic-r2` only:** it carries round 1 (`feat/smt-academic-modes`) and the two branches merged into it. The live site is `https://vicdata.co.uk`.

**1. Migrations** (they write; each checks its project ref first). Two, in two databases.

**(a) Ingest** (vicdata-production): the value-added names into `subject_label_map`. The dry run and PGlite passed; no rebuild is needed.
```sh
cd ~/dev/vicdata && git merge --ff-only feat/va-subject-label-map && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && supabase db query --remote --yes -f supabase/migrations/20261108120000_va_subject_label_map.sql && supabase migration repair --remote --yes --status applied 20261108120000 && supabase db query --remote --read-only "select count(*) from public.subject_label_map where note = 'value-added name, approved 8 Nov 2026'"
```
Expect `84`. Then `cd ~/dev/vicdata && .venv/bin/python check_subject_latest_names.py --app ../vicdata_public`.

**(b) App** (vicdata-public): the XS–XL size table, from round 1's merged branch.
```sh
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show feat/smt-academic-r2:supabase/migrations/20261122090000_v08_subject_entry_size_fifths.sql > /tmp/entry_size.sql && supabase db query --remote --yes -f /tmp/entry_size.sql && supabase db query --remote --yes "insert into supabase_migrations.schema_migrations (version, name) values ('20261122090000', 'v08_subject_entry_size_fifths') on conflict (version) do nothing"
```
After step 2, fill it. The sync needs `SUPABASE_SERVICE_ROLE_KEY` in the shell.
```sh
cd ~/dev/vicdata_public && npx tsx --env-file=.env --env-file=.env.local scripts/sync-subject-entry-size-fifths.ts --dry-run && npx tsx --env-file=.env --env-file=.env.local scripts/sync-subject-entry-size-fifths.ts
```

**2. Merge and push** (the push starts the Render deploy), from a clean `main`:
```sh
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff origin/feat/smt-academic-r2 -m "0.8 SMT Academic by qualification (rounds 1 and 2): Results, Entries, Value added; per-qualification sets; the pills off, Pupils' Girls and boys and Day and boarding; XS-XL against England; one entry total; value-added names in the shared crosswalk" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge commit.**
```sh
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish** the SMT dashboards. Academic's and Pupils' configs changed; Overview's and Context's didn't, so only those two get new versions.
```sh
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/vicdata_seed.sql && supabase db query --remote --yes -f /tmp/vicdata_seed.sql
```

**6. Set fixed**: F-44 and F-45 (it writes), from the same checkout at the merge:
```sh
cd ~/dev/vicdata_public && C="$(git rev-parse --short=12 HEAD)" && SUPABASE_YES=1 scripts/feedback-set-fixed.sh "$C" F-44 F-45
```

**7. Live check** (signed in, peek):
- **Leighton Park** `/teacher/smt/academic?lookAs=110110&as=smt&peek=1`:
  - the value-added trend has its axis, 0 line and band;
  - GCSE → Value added shows the state schools.
- **Plumstead Manor** (`lookAs=100183`), Entries, All:
  - column 1 and the entries mix both read 419;
  - the share bars sit on one scale;
  - XS–XL shows after 1(b).
- **Acland Burghley** (`lookAs=100053`), Value added, All, by subject area: † on Art and Design. After 1(a), `R-VA-SUBJECT-MATCH` reads `app_reads=database`.
- **Pupils** (`/teacher/smt/pupils?lookAs=110110&as=smt&peek=1`): Girls and boys, Day and boarding.
- **Throughout:** no pills; both themes; 1440, 1280 and a phone.
