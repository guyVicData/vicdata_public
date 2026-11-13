# VicData 0.8 front door, 2b: the two missing tile figures, the dumbbell on the Trends rail, Mid on the dashboards

A Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 13 Nov 2026 from Guy's decisions that day. **Runs after front door Part 2 is merged**, and before the design cross-check and Part 3.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

Read first: `AGENTS.md`; `docs/v0.8/front_door_1_report_v1.md` and `docs/v0.8/front_door_2_report_v1.md` (what the homes, walks and theme are, and their seams); `docs/v0.8/front_door_design/README.md` (the boards; every figure in them is illustrative).

## M1. The two home tiles without a figure (Guy, 13 Nov: "sort now")

Part 1 left two tiles showing their question alone (its report, "What is left"):

| Tile | Figure | Where it lives |
|---|---|---|
| **SMT Context** | Children nearby, next 5 years (as the board `home_smt.png` draws) | `/api/smt/context` (the area read) |
| **Head office Academic** | The group's results headline against England, for the phase in view (as `home_group.png` draws) | `/api/group/dash`, its academic build |

- **Never slow the home.** Fetch each figure in the browser **after the home has drawn**, through the same route and parameters the tile's walk uses (so the tile and the walk's first screen always agree). The tile shows its question at once; the figure fades in when it arrives; on an error or no data it stays as it is (never a placeholder number).
- **Cache it for the session** (these figures change once a year): a second visit to the home doesn't fetch again. Use the app's existing client cache if there is one; otherwise a small session-scoped one, logged.
- A test proves each tile's figure equals its walk's first screen's figure on real fixtures (The Chase or Leighton Park for SMT; Harris 3320 and Dukes for head office). Extend R-HOME-TILES.

## M2. The dumbbell on the dashboard's Context › Trends rail

Part 1 built "Change (dumbbell)" (`DV-C2-TR-DUMBBELL`) for walk 1 step 5 and held it off the dashboard (a proposal then). **Add it to the GCSE and Post-16 Context › Trends rail** in the rail's order (after Ranked change), with its rail icon, its dashboard-size layout from `dumbbell.png`, and the dashboard's own pills and compare. Republishing the dashboards is Guy's step 5 (`scripts/dashboards-seed-sql.ts --only …`): name the slugs in the report and dry-run the diff (what changes per dashboard). Update R-DUMBBELL and the preset doc (`scripts/views-preset-table.ts --write`, plus its follows-page row).

## M3. Mid on the dashboards (Guy, 13 Nov: confirmed as a build)

Today Mid applies to the homes and walks only; dashboards, sets and admin pages render Dark under Mid (R-THEME-MID-SCOPE). **Dashboards now follow Mid.** Sets and admin pages stay Dark or Light (unchanged). Mid stays a choice in the Dark · Mid · Light switch; Dark stays the default.

- **The look carries over from the homes:** each part's coloured field behind the columns (GCSE green, Post-16 violet, top level orange, Admissions sky, head office orange field with bronze accent: Part 1's gradient tokens); columns and open panels on near-white plates; **shut panels as raised bars, so the ladder still reads** (a clear step from the column, border, soft shadow, solid chevron, lead figure in the accent); the header and the "Also here" band stay dark; charts sit on white plates and keep their fixed reference colours (LA, England, 10 nearest), with the peer-line ambers deepened as in Light.
- **Every dashboard:** Teacher (GCSE, Post-16, KS2 where it exists), SMT (Overview, Academic, Pupils, Context), Admissions (Pipelines, Market share), the Group pages (Overview, Schools, Academic, Pupils, the library), full screen and the phone layouts.
- **Contrast:** every new Mid text/background pair passes AA (4.5:1 small, 3:1 large); add them to R-THEME-CONTRAST's table. Rewrite R-THEME-MID-SCOPE (dashboards follow Mid; sets and admin pages render Dark under Mid) and extend R-PANEL-LADDER to Mid.
- **No figure changes.** Parity in Dark and Light must be identical in pixels (Mid is new); compare Mid by words against Dark.

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

R-HOME-TILES (extended), R-DUMBBELL (extended), R-THEME-MID-SCOPE (rewritten), R-THEME-CONTRAST and R-PANEL-LADDER (extended to Mid on dashboards). The existing rules still pass; log every rule rewritten, with why.

## Ground rules

- **Branch `v0.8-front-door-2b` from current `main`** (after Part 2 is merged), fetched over HTTPS. Work in its own worktree; never switch branches in `~/dev/vicdata_public` or any other checkout.
- **Clean at every milestone:** tsc, eslint and build; the unit, rule, catalogue, RLS and usage-log tests; every PGlite suite (as their headers say); every parity harness. Unit tests run one file per process (`npx tsx --env-file=.env.local --test --test-force-exit <file>`; group test files also need `VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures`); rule tests need both env files (`--env-file=.env --env-file=.env.local`).
- **Harness:** the installed Chrome crashes at start-up; use Playwright's headless Chromium in a scratch dir. Pillow in a scratch venv (`python -I`). Screenshots from the real components only, never a stand-in (Part 1's lesson: a harness stand-in header was mistaken for an app bug). Turbopack rejects a symlinked `node_modules`: copy it (`cp -cR`) into a scratch worktree.
- **Never add `next/font/google`** (fonts are self-hosted, `src/app/fonts.css`; Google broke the Render build).
- **No database writes.** No migration is expected; if one is needed, name it after the latest on `main` and live, write and PGlite-test it, and give Guy its steps.
- Never put a server key in client code. Stage files by name. Commit; don't push or merge.
- **Log every call** under "2026-11-13: front door, 2b" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/front_door_2b_report_v1.md`: milestones and commits; the two tiles' figures and how they load (with a timing note: the home draws before either fetch); the dumbbell's republish dry run; Mid on every dashboard, screenshots at 1440 and 390 for one dashboard per product in Mid, plus Dark and Light of one to show nothing moved; the contrast table; tests and parity; **Guy's commands in the seven-step order** (`docs/FEEDBACK.md`), with step 5 the republish of the dashboards the dumbbell joins (after `/api/version` shows the merge).
