# VicData 0.8: Group sets, M4 to M6. Comparison sets of groups, subsets of our schools, rules and the report

A Claude Code prompt for the app repo, on branch **`feat/group-sets-academic`** in the worktree **`~/dev/vicdata_public_group`**, and the app database (`lnhulykjlxmoneappnsp`). Written 13 Nov 2026. **The spec is the brief, `docs/v0.8/vicdata_0_8_group_sets_brief_v2.md`** (Guy's decisions D1–D8, 8 Nov, are in its §9). This prompt says where the build stands, what's left and how to finish it. Where this prompt and the brief differ, this prompt wins.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each one ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

**Why now:** Group sets is finished and merged before the 0.8 front door build starts. The front door's Part 2 restyles the sets library and adds a guided sets editor, so it has to build on the finished group-mode `SetSelector`, `SetEditor` and `/sets`, not race them.

## Where the build stands

| Milestone | State | Commits |
|---|---|---|
| M1, production (`~/dev/vicdata`) | Done and promoted. `group_sets_m1_report_v1.md`; like-for-like pools `group_sets_pools_like_for_like_v2.md` (LF1–LF4, E1–E3, N1–N2) | `72fa74e`, `b28f4c4`, `1c27097`, `ca1ce7b`, `5f8f85a` |
| M2, storage | Written and PGlite-tested (47/47), **not applied**. `supabase/migrations/20261121100000_v08_group_sets.sql`; apply, verify, rollback in `supabase/ops/group_sets/`. A set's groups are in their own table, `set_group_members` (OPEN_QUESTIONS, 8 Nov, accepted) | `459e26a`, `abc2981`, `e7689d6` |
| M3, the library | Done (group tests 61/61): the browse page, a group's page, filters in the address, groups like us, phone bottom sheet, head office only. **"Add to set…" waits for M4.** | `ebcf76f` |
| M4, comparison sets | To do | |
| M5, subsets | To do | |
| M6, rules, screenshots, report | To do | |

**The migration goes live with the merge, not before** (Guy, 13 Nov). The M3 report said M4 "needs M2 applied first": it doesn't any more. Build and test everything against PGlite (the set picker's and editor's server paths, `save_set` with groups, RLS) and the fixtures. Write nothing to the live database.

**The thread this came from:** "Group Pages: Sets and SMT Results" (8 Nov). Besides the brief's D1–D8, Guy decided there (all built in M1 and the like-for-like round, production `feat/group-pools-like-for-like`):
- **LF1, LF2, LF4:** special, AP, PRU and nursery schools are members (listed, on the map, in Joined and left) but out of every figure, the groups' own and every pool's: "54 of 55 schools; 1 alternative provision not counted", and the Schools-table tag ("AP · not in group figures").
- **D9:** R-MIN-SCHOOLS (5 schools) on every group pool: "Too few schools (n)", no figure.
- **E1, E2:** England by sector: "England, mainstream state-funded" for state groups, "England, independent mainstream" for independent ones, with their (i)s. **The Default block's England row follows the group's sector, as non-group does.** City technology colleges count as state-funded.
- **N1:** the roll (i) says it counts pupils of all ages.
- **LF3, N2: non-mainstream groups** (more than half special, AP, PRU or nursery; 190 now) are held out of the size bands and the library. **Their own comparison is a later milestone, not this round:** don't build it; keep them out of the picker, the editor's "Add groups" and "Nearest in size".
- **E3:** England aligned across Teacher, SMT and Admissions is for the 0.85 review: don't touch those pages.

M4 and M5 keep every one of these: a set's side-by-side rows, its median and the Default block use the same counted-schools rule, R-MIN-SCHOOLS and England-by-sector labels as the pages do today. A subset may include a not-counted school: it shows with its tag and never enters a figure.

## Before M4

1. **Bring the branch up to date.** Merge current `main` into the branch (fetched over HTTPS), resolve any conflicts and commit the merge. Don't rebase: the branch is on GitHub. `main` has moved since 8 Nov: Teacher full screen, F-46, and the front door prompts and design files under `docs/v0.8/` (docs only; leave them as they are).
2. **Re-check the brief's §2, "What's real today"** against the code after the merge. It was checked on 8 Nov, and line numbers in particular will have moved (`GroupDashboard.tsx` Compared-against `PillMenu`, `src/lib/groups/dash.ts` compare keys, `views.tsx` named-group chips, `api/group/dash/route.ts` the Schools tab and the sort bug, `src/lib/sets/return-to.ts` `RETURN_PREFIXES`, `ReturnContext`). Log every difference under OPEN_QUESTIONS and build against what's there.
3. **Check production's branch.** `feat/group-pools-like-for-like` (the like-for-like rules, promoted 8 Nov as aggregates build 6) was merged into `main` in `~/dev/vicdata` on 13 Nov (`437a211`; group tests 63/63), so a promote from `main` keeps them. Read-only: `git -C ~/dev/vicdata fetch` and check `origin/main` still contains `b190b91`; if it doesn't, put it first in the report.
4. **Check the live row counts** the brief relies on, read-only: `group_accounts` and `group_memberships` (0 rows on 8 Nov); `sets` (6 rows, Leighton Park's). If a group now uses the site, say so at the top of the report. The migration and every change must then be safe with that group's rows present.

## M4, comparison sets of groups (brief §5, §10)

- **`SetSelector` on Overview, Academic and Pupils** (§5.1): "Compared against", the button with the set name and "n groups"; three blocks, Default, Group sets ("Head office", its own colour) and My sets ("n of 8"); Edit this set…, New set…, Manage sets. Hidden for a peek, View as and a school's SMT; a school's SMT gets Default and the group's sets, read-only (D2). It replaces the Compared-against `PillMenu`, the named-group chips and the Mix-matched toggle. Schools gets the subset selector in M5 instead.
- **The Default block** (§5.2), computed and never stored, from production's set ids (`peer:<type>:<band>`, `peer:<type>:all` incl. `ft:all` (D4), `non_group:*` as redefined in M1, `sat:all`, `areas:la`, `england:all`, `peer_named:<5 ids>`). **Make default** for admins and its fallback to the size band (D8).
- **The editor and `/sets` in group mode** (§5.4): `/sets/edit?account=…&kind=group_peers&returnTo=…`; rows are groups (type, size, regions, headline); "Add groups" opens the M3 library as a sheet, filtered to groups like us; 8 is the cap (`GROUP_SET_CAP`, one setting); Cancel and Save go back the same way (R-SETS-WAY-BACK): add `/teacher/group` to `RETURN_PREFIXES` and `product: "group"`. Manage sets opens `/sets?account=`. Group sets offer Duplicate to every head-office member.
- **Wire the library's "Add to set…"** (left from M3) to the same save path. **The library cards keep the regions tile map as artwork** (Guy, 13 Nov), not a map of the group's schools.
- **How a set is shown** (§5.3): side-by-side tables (ours first and highlighted, each group, then the set's median, "n of m groups"); type and size on every row; mixed types allowed ("mixed types" on the median, "not published" for a measure a type lacks); rankings stay same-type; the Weighting and Reading switches apply per row.
- **Trends** (D3): the panel (ours solid, the median, the middle-half band, no band under 4 groups with the (i) saying why, no hover or pinning) and the large view (every group's line thin and muted, ours on top, a list beside the chart to bring a line forward or pin it, the median and band toggle).
- **Old `?compare=` links keep working**, mapped to the new keys; `peer_named:a,b` opens as an unsaved set of those groups.
- **Fix the named-candidates sort** (Academic and Pupils sort from the smallest group up).
- **School sets don't change.** Every change to `SetSelector`, `SetEditor`, `SetView`, `SetsLibrary` and the sets server library is additive: a school's sets pages, picker and editor render and behave exactly as today (parity proves it).

## M5, subsets of our own schools (brief §6)

- The **"Showing"** selector on Group pages: "All 59 schools" (the default), the group's subsets, My subsets.
- A subset is a set of the group's own schools (kind `group_schools`), made in the same editor: current members only, likely members offered and labelled.
- It **filters** the Schools table, the map, Joined and left, and every per-school list. **Group-level figures stay whole-group**, with the one line "Showing 18 of 59 schools · group figures are for all 59". No subset sums.
- A school that has left the group drops out of the filter, and the set view says so.
- **Share with the group** (admins) **moves** a personal set, of groups or of schools, to the group and frees the slot (D6). **Duplicate** on any group set gives a private copy.

## M6, rules, screenshots and the report

- **Rules** (add to the rules catalogue; regenerate `docs/catalogue/*.md`): R-GROUP-LIBRARY, R-GROUP-SET-PICKER, R-GROUP-SET-SIDE-BY-SIDE, R-GROUP-SET-TRENDS, R-GROUP-SET-DEFAULT, R-GROUP-SUBSET-FILTER, R-GROUP-SETS-RLS, R-GROUP-NON-GROUP (each school in exactly one of a listed group, the single-academy-trust pool or non-group), R-GROUP-RANK-SAME-TYPE. Any of these M3 already added: extend it, don't duplicate. Update any existing rule that names the Compared-against `PillMenu`, the named-group chips or Mix-matched; log every rule rewritten or retired, with why.
- **Screenshots** at 1440 and 390, Dark and Light, with the headless harness (SSR, the built CSS, headless Chrome) on the Harris (`3320`) and Dukes fixtures: the picker open; the side-by-side table with the median; the trend panel and the large view; the group-mode editor; `/sets?account=`; the Showing selector with a subset applied and its line; Share with the group. Every figure in them comes from the fixtures.

## Ground rules

- **Work in `~/dev/vicdata_public_group` on `feat/group-sets-academic`.** Don't switch branches in any other checkout (`~/dev/vicdata_public` is shared with other sessions).
- **These must be clean at every milestone:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; the group tests; every PGlite suite (run as their headers say; `view-as-pages.test.ts` with `--test-force-exit`); every parity harness.
- **Allowed differences in parity:** the Group pages (Overview, Academic, Pupils, Schools), the groups library and group pages, `/sets` and the editor in group mode. **School pages, school sets and every figure stay the same.**
- **Storage.** If M4 or M5 needs more storage, change the unapplied M2 migration (`20261121100000_v08_group_sets.sql`), not a new one, and update its apply, verify and rollback scripts and its PGlite test with it. Log each change. It must stay additive and safe with the live `sets` rows.
- **No database writes.** Read-only checks only (the row counts above).
- **Never put a server key in client code.** Stage files by name. Commit; don't push or merge.
- **Log every call** under "2026-11-13: group sets M4–M6" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/group_sets_report_v1.md`, the round's report covering M1 to M6 (link the M1 report rather than repeat it). Include:
- how far you got, milestone by milestone, and anything left;
- what the §2 re-check found;
- the storage as built, any change to the M2 migration since 8 Nov, and its RLS;
- the screenshots;
- every rule added, rewritten or retired; tests and parity;
- what the front door build (`docs/v0.8/vicdata_0_8_front_door_part2_sets_admin_phone_claude_code_prompt_v1.md` on `main`) needs to know about the group-mode sets code it will restyle;
- **Guy's commands, in the template's order** (`docs/FEEDBACK.md`, "Guy's commands"; R-REPORT-COMMANDS-ORDER):
  - **step 1, Migrations:** the project-ref check; apply and verify from `~/dev/vicdata_public_group` with the CLI as installed (the form M2 used: `supabase db query --remote --yes -f supabase/ops/group_sets/apply_group_sets.sql`, then `supabase db query --remote --read-only -f supabase/ops/group_sets/verify_group_sets.sql`), and show what verify should return; record `20261121100000` in `schema_migrations` if the apply script doesn't; the rollback (`rollback_group_sets.sql`) if verify fails. The migration goes live **before** the merged code deploys. Say where these differ from the template's `--linked` form;
  - step 2 the merge from `main`, then steps 3 to 7 as the template has them (none of steps 5 and 6 unless the round touched them; say "none this round");
  - ending with a walk-through as head office for Harris (`/teacher/group?lookAs=<Harris group account id>&as=head_office&peek=1` once a group account exists; otherwise View as): library → add three groups to a new set → Overview side by side → Academic trends large view → Make default → a subset on Schools; and a member school's SMT seeing Default and the group's sets read-only.
