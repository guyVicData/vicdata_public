# Handoff: VicData 0.8 Sets round 1

Written 7 Nov 2026, at branch `v0.8-sets-r1` `c59bf9b` (from `main` 8eb2fc9). The branch is pushed to GitHub and **not merged**. **Nothing has been written to the app database** (`lnhulykjlxmoneappnsp`): the migration is written and tested in PGlite but not applied.

The detail is in two places:
- **The report:** `docs/v0.8/sets_round1_report_v1.md`.
- **Every call made:** `docs/OPEN_QUESTIONS.md`, under "2026-11-06: sets round 1".

## What we're doing

There is now one engine for sets of schools across the site. It replaces two systems that shared nothing:
- `admissions_lists`: Admissions' feeder and rival lists;
- `saved_sets` / `saved_set_members`: Teacher's, SMT's and the Data View's comparator sets.

It holds three kinds of set:
- school sets, curated by the school;
- personal sets, up to 8 active per person;
- default (recipe) sets, computed when shown and never stored.

Sets are chosen from one menu, edited in one editor and managed in one library. Admissions goes first; Teacher and SMT use the same engine.

The brief is `docs/v0.8/vicdata_0_8_sets_round1_claude_code_prompt_v2.md`, and the designs are in `docs/v0.8/sets_design/`.

## What's done

| Milestone | Commit |
|---|---|
| Prompt and design files, moved out of `.sets_design_inbox` | `aaac88b` |
| **M1 storage:** `sets` / `set_members` / `set_user_state`, RLS, the cap of 8 active, `save_set`, the conversion of the old tables, every old reader moved | `4400490` |
| **M5 small fixes:** F23 (the rivals' average in the F-36 and F-20 full screens), F24 (boarding sentences only for boarding schools), F25 / F-40 / F-41 (Rivals' momentum at 11+ switches to post-16 when over 40% have no GCSE) | `97f164d` to `dd6a725`, merged in `5f929d2` |
| **M2 the selector**, on Admissions, SMT and Teacher; B8's default sets; panel headers name the set | `da00c2b` |
| **M3 the editor** (`/sets/edit`) and **M4 the library and set view** (`/sets`, `/sets/<id>`), with phone layouts | `4bb0b15` |
| Phone and layout fixes from the 390 px measurements; 32 screenshots | `439c6e5` |
| **School sets are lead-only** (Guy's decision, 7 Nov), the School-Admin's audit, and two parity fixes | `a49d8fe` |
| The report | `2b6bbd4` |
| G30: phone panel headers name the set | `c59bf9b` |

**Checks at `c59bf9b`:**
- tsc, eslint (0 errors) and the build pass.
- 585 unit tests and 77 catalogue unit tests pass.
- All 147 rule tests pass.
- All 25 PGlite suites pass, including `v08_sets_r1_pglite.mjs` at 77 of 77.

**Parity** ran four times against the base `aaac88b`, across Teacher, Admissions, SMT, Groups and the Data View. It found 0 unexpected differences after the fixes, and figures never change for the same set of schools. For Leighton Park, every view of Pipelines and Market share draws at 11+ and 16+, at 1440 and 390 px.

## Decisions made

All are in OPEN_QUESTIONS; these are the ones that change behaviour.

- **School sets are lead-only** (Guy, 7 Nov):
  - **Feeder sets:** the Admissions lead, plus the School-Admin as the audited override.
  - **Compared-against sets:** the lead, SMT and the School-Admin (audited).
  - **Everyone else:** personal sets only. "Propose as school set" stays disabled, saying "Ask your Admissions lead", until there's a request flow.
  - **The audit:** a School-Admin's change writes `admissions_lists_override` to `platform_audit_log`, as 0.7 r2b did.
- **Any approved member reads school sets.** The Admissions views stay role-gated.
- **Leighton Park's 6 lists convert exactly.**
  - The 18, 27, 10, 16, 18 and 10 schools come across in order, with both rivals' rules, as default, pinned school sets.
  - Its Pipelines draws the day and boarding feeders together ("Day + boarding feeders"), exactly as before.
- **A school with no saved sets now draws B8's defaults:** "Day | all sectors", and "10 nearest | [its sector]" (or "boarding" in the top two fifths). These replace round 1's nearby defaults, so that school's figures change: the same maths on different schools.
- **Teacher:**
  - Its chooser still builds the LA set and the rankings; New set… and Edit go to the editor.
  - Its panels rely on the column's set selector to name the set, because a line in each fixed-height card cost the last bar.
- **The old builders** (`/sets/comparator/new`, `/sets/feeder/new`) redirect to `/sets`. The old set page is now the set view.
- **The old tables stay in place.** Nothing reads or writes them; a later round drops them.
- **M6, "Add to set…" (the stretch goal), was not built.**

## What's left

1. **Guy runs the report's 7 commands, in order** (`docs/v0.8/sets_round1_report_v1.md`, "Guy's commands"):
   1. Apply the migration `supabase/migrations/20261121090000_v08_sets_r1.sql` and record it in `schema_migrations`, then check that the six converted sets are there.
   2. Merge `v0.8-sets-r1` into `main` and push. **Only after step 1.**
   3. Render deploys main on its own.
   4. Wait until `/api/version` shows the merge.
   5. No republish: no published dashboard changed.
   6. Set F-40 and F-41 fixed (`scripts/feedback-set-fixed.sh "$C" F-40 F-41`; no `--view`, since both were filed on Rivals' momentum itself).
   7. The live check: Leighton Park at 11+ and 16+, a day school (The Chase 137625) and a state school (Maiden Erlegh 136637), then "Looks good" on Rivals' momentum to close F-40 and F-41.
2. **Between step 1 and step 4, don't edit Admissions' lists on the live site.** The old code still writes `admissions_lists`, and a change made after the conversion wouldn't reach the sets.
3. **Later rounds:**
   - drop the old tables once this round has been seen live;
   - a request flow for "Propose as school set";
   - retire Teacher's chooser once rankings live in the library;
   - M6, "Add to set…";
   - the Admissions phone header's own chips are 29–32 px tall, older than this round (G31 asks for 44).

## Commands and migrations still to run

Only the report's steps 1 to 7. Steps 1 and 2 are below as Guy will run them; take steps 3 to 7 from the report.

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-sets-r1:supabase/migrations/20261121090000_v08_sets_r1.sql > /tmp/sets_r1.sql && supabase db query --linked -f /tmp/sets_r1.sql && supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('20261121090000', 'v08_sets_r1') on conflict (version) do nothing" && supabase db query --linked "select version, name from supabase_migrations.schema_migrations where version = '20261121090000'"
```

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-sets-r1 -m "0.8 Sets round 1: one sets model (Leighton Park's lists converted), one set selector on Teacher, SMT and Admissions, the set editor, the library and set view, tiers, F-36/F-20 averages, boarding-only (i)s, F-40/F-41 Rivals' momentum on post-16" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**Where things are:**
- **The working checkout:** `~/dev/vicdata_public-sets-r1`, a worktree on `v0.8-sets-r1`. The shared checkout `~/dev/vicdata_public` stays on `main`.
- **The harnesses:** the parity harnesses and the screenshot harness are in the session scratchpad (`sets_par/`, `sets_shots/`). Their READMEs are copied to `sets_par/harness_copies/README.txt`.
