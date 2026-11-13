# VicData 0.8 front door: the design cross-check. Every design board against the built screen, differences resolved

A Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 13 Nov 2026 from Guy's request that day: "as a final stage of this build, a detailed cross-check of the design and build, comparing the PNGs with screen grabs and resolving differences." **Runs after front door Part 2 and 2b are merged**, and before Part 3.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: classify, fix what's clearly a miss, log every call, and list what's genuinely his to decide.

## What to compare

The boards are in `docs/v0.8/front_door_design/` (`README.md` maps each screen to its PNG in `png/` and its source board in `dc/*.dc.html`). **They are design references (layout, wording, colour, behaviour), not pixel targets, and every figure, school name and date in them is illustrative.** Compare everything except the data:

| Board(s) | Built screen |
|---|---|
| `home_teacher.png`, `home_smt.png`, `home_primary_smt.png`, `home_group.png`, `home_admissions.png` | Each role's home, Mid (and Dark and Light where the board implies them) |
| `walk_many_1..6.png`, `walk_well_1..6.png`, `walk_nearby_1..5.png` | The three GCSE walks, every screen |
| `other_roles.png` | The Post-16, Admissions and SMT walks' outlines (SMT drawn violet there: orange now) |
| `vocabulary.png` | Icons, names, colours and labelling rules across homes, walks and dashboards |
| `dumbbell.png` | The dumbbell, walk size and dashboard size |
| `themes_ladder.png` | The panel ladder on dashboards, Dark and Light (its early Mid is superseded; compare Mid on dashboards against the homes' Mid instead) |
| `sets_library.png` | The sets library |
| `sets_editor_feeders.png`, `sets_editor_rivals.png` | The guided editor, feeders and rivals |
| `admin_account.png`, `membership.png` | The School-Admin account page; membership (pilot and active states) |
| `walk_home_prototype.png` | Superseded by the homes: skip |

Also check the screens with no board against the prompts' words: welcome, one-screen setup, the "New since your last visit" strip and changelog page (Part 1, A5–A7), and every phone layout against Part 2's G section.

## M1. The grabs and the side-by-sides

- **Grab every built screen from the real components** with the screenshot harness (SSR + the built CSS + headless browser, real fixtures: The Chase / Leighton Park for Teacher and SMT, an Admissions school from the harness, Harris 3320 and Dukes for head office). **Never a stand-in or replica component**: Part 1 mistook a harness stand-in header for an app bug. If a screen can only be drawn signed in or after a click, script the click in the harness; if it truly can't be drawn, say so and list it for Guy's live check.
- Match the board's frame: same viewport width (read it from the PNG), same theme, the same state (step, pill, open panel, chip filters) and, where the board names a subject or entry point, the same one (Geography, 11+).
- Make a **side-by-side composite per board** (design left, build right, same scale, labelled), plus the phone grab beside it where Part 2 designed one. Save them in `docs/v0.8/front_door_crosscheck/`.

## M2. The differences, classified

For each board, go through it region by region (header, title and answer, tiles or panel, rail, chart, keys and labels, mini-map, footer, spacing and type scale, colours, icons, wording, behaviour on hover/tap) and list every difference in one of four classes:

1. **Miss:** the build doesn't do what the board and the prompt ask (wrong order, missing element, wrong wording, wrong colour token, spacing visibly off, a key missing, a label clipped). **Fix it** in M3.
2. **Decided:** the build differs on purpose, and a decision says so (cite it: the prompt, a report, `docs/OPEN_QUESTIONS.md`, or Guy's 13 Nov answers, e.g. SMT orange not violet, the regions tile map as library artwork, Mid on dashboards, two tiles' figures loaded after the home draws). Keep it; list it.
3. **Data:** the difference is only illustrative data (figures, names, dates, how many schools or subjects). Not a difference; count them, don't list them.
4. **Guy's call:** a real design difference with no decision behind it, where either reading is defensible. Don't change it; list it with both pictures and a recommendation.

Write the table first (all boards), commit it, then fix.

## M3. Resolve the misses

Fix every class-1 difference, smallest change first, through the existing tokens and components (no one-off styles). Re-grab each fixed screen and add the after picture to its composite. Keep figures unchanged: parity in words must match `main` everywhere; pixel changes only where a fix intends them (list them).

## M4. The report

Write `docs/v0.8/front_door_design_crosscheck_v1.md`: per board, the composite (before and after where fixed), the differences by class, and the resolution; the totals (misses found and fixed, decided, Guy's calls); the screens that could only be checked live (for Guy's live check, with where to find each); tests and parity; and **Guy's calls as one numbered block** with a recommendation each. Then Guy's commands in the seven-step order (`docs/FEEDBACK.md`); expect no migration and no republish unless a fix touched a published dashboard config (then name the slugs and dry-run them).

## Ground rules

- **Branch `v0.8-front-door-crosscheck` from current `main`** (after Part 2 and 2b are merged), fetched over HTTPS, in its own worktree; never switch branches in `~/dev/vicdata_public` or any other checkout.
- **Clean at every milestone:** tsc, eslint and build; unit, rule, catalogue, RLS and usage-log tests; every PGlite suite; every parity harness (words against `main`; pixels only where a fix intends a change). Unit tests one file per process (`npx tsx --env-file=.env.local --test --test-force-exit <file>`; group files also `VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures`); rule tests with `--env-file=.env --env-file=.env.local`.
- **Harness:** Playwright's headless Chromium in a scratch dir (the installed Chrome crashes); Pillow in a scratch venv (`python -I`); copy `node_modules` (`cp -cR`) into scratch worktrees, since Turbopack rejects a symlink. Read the composites as images: look at them, don't just measure.
- **Never add `next/font/google`.** No database writes. Never put a server key in client code. Stage files by name. Commit; don't push or merge.
- **Log every call** under "2026-11-13: front door, design cross-check" in `docs/OPEN_QUESTIONS.md`.
