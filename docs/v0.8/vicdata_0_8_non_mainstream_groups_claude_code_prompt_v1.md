# VicData 0.8: Non-mainstream groups, first version. Special and AP trusts and nursery federations, compared like for like

A Claude Code prompt for the production data repo (`~/dev/vicdata`, production database `hrqrbvrrhlidpoybezhs`) and the app repo (`~/dev/vicdata_public`, app database `lnhulykjlxmoneappnsp`). Written 13 Nov 2026 from Guy's answers that day (NM1–NM12: "yes to all", the recommendations in `docs/v0.8/non_mainstream_groups_scope_v1.md`). **Runs after front door Part 3.** The scoping report is the evidence; this prompt is what to build.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branches at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## Why

On 8 Nov (LF3, N2) Guy held groups more than half special, AP, PRU or nursery out of the size bands, the groups library and the group set picker, until they get a fair comparison of their own. Today such a group shows **no group figures at all** (none of its schools is counted), and 20 of them have mainstream schools (63) whose figures are compared with nothing. 164 mainstream groups also have their own special, AP or nursery schools (308), listed but not placed against anything.

## Guy's decisions (13 Nov)

1. **The line stays "more than half"** of a group's current schools special (any kind), AP, PRU or nursery. The (i) states it. (Wellspring is out on 17 of 33; 23 groups at exactly half stay mainstream.)
2. **Mainstream schools inside a non-mainstream group** (20 groups, 63 schools): a **separate mainstream line** for those schools, compared against the mainstream pools as today; the group's own figures are over its special/AP/nursery schools.
3. **Two families,** each with its own pools and peer sets: **special and AP trusts** (`special_ap`) and **nursery federations** (`nursery`). The one mixed federation follows its majority kind (log the call).
4. **Peer sets:** special/AP trusts in size bands **2–5, 6–10, 11+** schools (66, 28, 11 groups today); **nursery federations as one set** (34). R-MIN-SCHOOLS on each.
5. **First-version measures: roll, its same-schools change, and FSM** (pupil-weighted, eligible over headcount). **Nursery FSM is compared only with nurseries** (under-5s qualify only on a full-day place: about 10% against about 50% in special schools), with an (i) saying so. Each group also shows its schools by kind and region.
6. **Pools:** England and region for each kind (`england:special`, `england:ap`, `england:nursery`, `region:{kind}:{code}`), plus **LA pools for special schools only** (`la:special:{code}`; 98 of 150 LAs pass R-MIN-SCHOOLS). All state-funded; say "state-funded special schools" on the page.
7. **No results in this version.** The group dashboard says "Results aren't compared for special and AP schools" with the reason (KS2 is 0% at 630 of 652 special schools; AP KS4 isn't published per school; Progress 8 ends 2023/24). Later: Attainment 8 per school within need type, once primary need is in.
8. **New ingests are a later, separate production round,** in this order: SEN in England (EHCP share, SEN support, primary need), then destinations (KS4, 16–18), then Ofsted. **Not in this build.** Add them to the to-do list in the report.
9. **Ofsted comparability** is decided when that ingest is scoped. Not in this build.
10. **Library:** a **separate "Special, AP and nursery groups" section with a filter**; its cards show schools by kind, roll and change, and FSM against the kind's England figure. **Group sets:** a non-mainstream group can only be put in a set with other non-mainstream groups (the picker, the editor's "Add groups" and "Add to set…" all enforce it, with a one-line reason).
11. **Mainstream groups' own special, AP and nursery schools, in this version:** in the Schools table, each such school's roll change and FSM placed against its region's pool of the same kind, in place of the bare "not in group figures" tag; plus a **pooled line where a group has 5 or more of one kind** (7 groups today).
12. **Out of scope:** independent special schools (973), special post-16 institutions (166, no census or FSM), non-maintained special schools (52).

## Milestones

**Production (`~/dev/vicdata`, its own branch and worktree; `feat/non-mainstream-groups`):**
1. **The kind and the counting rule:** store each group's kind (`special_ap` / `nursery` / mainstream) on the group and in the build meta; for non-mainstream groups, count their special/AP/nursery schools in their own figures and their mainstream schools in the separate mainstream line (decision 2). Mainstream groups' figures don't move (prove it: a before/after of every mainstream group's figures, all identical).
2. **FSM into the group aggregates** (a new input in `fetch_inputs`, pupil-weighted share), for every group and pool. Mainstream groups get FSM too, but the app shows it only where this build asks.
3. **The new pools and peer sets** (decisions 4, 6) with R-MIN-SCHOOLS; index rows for non-mainstream groups, flagged with their kind and peer set (today `group_index` drops them).
4. **Dry run, PGlite, before/after report,** then promote only if every mainstream figure is identical (this round's one hard gate). Verify, timings. Production changes are made directly as in group sets M1 (D1: no group uses the site) **only after** that check; otherwise stop and report.

**App (`~/dev/vicdata_public`, branch `v0.8-non-mainstream-groups`, its own worktree):**
5. **Library:** the separate section and filter, its cards, the majority-rule (i). Fixtures: one special trust (Nexus), one nursery federation (Birmingham Federation of Maintained Nursery Schools), one mainstream group with special schools (Shaw), alongside Harris and Dukes.
6. **The group dashboard for a non-mainstream group:** roll, change and FSM against its peer set and the pools; the mainstream line where it has one; the "no results compared" state; the (i)s (majority rule, kinds, state-funded pools, nursery FSM, small groups: "57 of these groups have two schools").
7. **Group sets:** non-mainstream groups only with each other, everywhere a set is made.
8. **Mainstream groups' Schools table** placing (decision 11) and the pooled line for 5+ of a kind.
9. **Rules, screenshots (1440 and 390, both themes, and Mid where the page follows it), the report.**

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- **R-NM-LINE:** a group is non-mainstream exactly when more than half its current schools are special, AP, PRU or nursery; its family follows its majority kind.
- **R-NM-COUNTING:** a non-mainstream group's figures are over its special/AP/nursery schools; its mainstream schools are in their own line; mainstream groups' figures are unchanged (before/after identical).
- **R-NM-POOLS:** each pool and peer set holds only its kind; R-MIN-SCHOOLS applies; LA pools exist for special schools only.
- **R-NM-FSM-NURSERY:** nursery FSM is never compared with school FSM.
- **R-NM-NO-RESULTS:** no results tile or trend for a non-mainstream group; the reason is shown.
- **R-NM-SETS:** a non-mainstream group can't share a set with a mainstream group, by any route.
- **R-NM-OWN-SCHOOLS:** a mainstream group's special/AP/nursery school is placed against its region's pool of its kind; the pooled line appears only at 5 or more of one kind.
- **The existing rules still pass,** R-GROUP-* included; update R-GROUP-NON-GROUP and the library rules where the new section changes them, and log why.

## Ground rules

- **Production:** read `~/.claude` memory notes on ingest Python (Python 3.12 via uv; `fetch` ~13.5 min, `compute --dry-run` ~45 s, `compute --promote` ~19 min) and on applying migrations live (`supabase db query --remote --yes -f …`, never `db push`; record each migration). Promote only past the gate in milestone 4.
- **App:** clean at every milestone: tsc, eslint, build; unit, rule, catalogue, RLS and usage-log tests; every PGlite suite; every parity harness (Group pages for mainstream groups must be identical in words; the library changes by design). Unit tests one file per process (`npx tsx --env-file=.env.local --test --test-force-exit <file>`, group files with `VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures`); rule tests with `--env-file=.env --env-file=.env.local`. Playwright's headless Chromium for screenshots (the installed Chrome crashes); copy `node_modules` into scratch worktrees (Turbopack rejects a symlink). Never add `next/font/google`.
- **App database: no writes** (no app migration is expected; if one is, write it, PGlite-test it, give Guy its steps).
- Never switch branches in `~/dev/vicdata` or `~/dev/vicdata_public` (other sessions use them). Never put a server key in client code. Stage files by name. Commit; don't push or merge.
- **Log every call** under "Non-mainstream groups" with the date in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/non_mainstream_groups_report_v1.md`: milestones and commits in both repos; production's before/after (every mainstream group identical; the non-mainstream groups' new figures, with five named examples); the promote, verify and timings; the pages with screenshots; rules, tests and parity; the to-do list for the later ingests (SEN, destinations, Ofsted) and Ofsted's comparability question; **Guy's commands in the seven-step order** (`docs/FEEDBACK.md`), ending with a walk-through: the library's new section → Nexus's dashboard → a nursery federation → a group set refusing a mainstream group → Shaw's Schools table.
