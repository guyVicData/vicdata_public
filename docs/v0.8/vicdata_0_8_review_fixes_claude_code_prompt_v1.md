# VicData 0.8: the 14 Nov review fixes. Walk wording, graphs, tables and rankings, dashboard titles, subject-group colour

A Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 14 Nov 2026, after Guy's smoke test and review request that day ("check the walk questions make sense grammatically, the graphs all draw correctly, tables and rankings carry enough information; dashboards include all the walk graphs, graphs titled clearly, clear colour coding of large subject groups, flag repeated tables"). Guy's answer to the review's decisions Q1–Q8: **"Run all the fixes"**, which means the recommendation on each. **Runs now, from current `main` (a648be5 or later), before front door Part 3 (parked).**

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## The evidence

The three reviews are in `docs/v0.8/review_14nov/`:
- `walks.md` (31 sentence findings, 10 graph findings, 6 table findings);
- `dashboards.md` (walk-to-dashboard coverage, titles, subject colours, repeated tables);
- `tables.md` (every dashboard table and ranking).

Each finding gives the exact text, file:line and a proposed fix. **Verify each finding against the code before fixing it.** Reviewers can be wrong. Where one is, log it as "not a bug" with why. Three of the findings were confirmed on 14 Nov: the Admissions walk's charts (`role-walks.tsx` DV-ADM-P-NOW and -PIPELINE), the SMT largest year group sorting on `count` instead of `total`, and the Group Schools table's FSM column showing the % that 45bfe9f withheld under `FSM_MIN_PUPILS`.

## Guy's decisions (14 Nov: "Run all the fixes")

- **Q1:** fix the wrong-figure and wrong-chart bugs.
- **Q2:** fix the wording and the information in tables.
- **Q3:** colour subject groups everywhere: one keyed colour per subject group, on a re-picked palette, and trend lines are no longer coloured by rank.
- **Q4:** chart titles say the measure, phase and comparator.
- **Q5:** drop or merge the repeated tables. The SMT Overview tiles are trimmed, not dropped.
- **Q6:** add the two walk graphs that are missing from the dashboards.
- **Q7:** the dashboard dumbbell opens on the whole school and doesn't start its scale at 0.
- **Q8:** take screenshots of the walks no one has looked at yet.

## Milestones

**M1. Wrong figures and wrong charts (Q1).** Each fix gets a test on a real fixture that fails before the fix and passes after.
- **The Admissions walk:**
  - draws the same components as the dashboard for each view: share the dashboard's `viewBody` the way the Group walk does, if that's clean;
  - `titleOf` fills every placeholder (`feeder-age`, `entry-age`, `la`, `rivals` …) and falls back to the view's label when one is left unfilled; add a test that no walk title, on any walk, keeps a `[` or starts with punctuation;
  - the header uses the chosen entry point;
  - no blank answers or fragments ("…after that. up 3%");
  - the SMT market screen's 11+ follows the school's entry point.
- **SMT:** the largest year group sorts on `total`, with the cast removed so the type checker catches it next time.
- **Teacher walks:**
  - "Has our position changed?" compares against the last year that has a figure, and labels each place with its own year;
  - the entries comparison is right when entries fall, and states each comparator's value, leaving out a comparator that has no figure;
  - in the indexed "nearby and nationally" chart, 100 sits at the year the caption names, and so does the "from 100" sentence.
- **Mini-maps:** the nine "On the dashboard" mini-maps and notes point at the right panel. Work each one's position out from the dashboard config, not by hand, and add a test that covers every walk screen.
- **The Group Schools table:** a non-mainstream school under `FSM_MIN_PUPILS` shows "too few pupils (n)" in its FSM cell. Its `fsm` is null in the data, so it doesn't sort as 0.
- **The phone bar chart:** horizontal bars keep a usable bar width at 390 px; cap the name column. Measure it.

**M2. Screenshots of every walk no one has looked at yet (Q8).** Grab the SMT, Admissions, Post-16 and head office walks, plus Teacher nearby 2–4 at 390 and the empty states. Grab them at 1440 and 390, in Mid (the walks' theme) plus Dark for one walk each. Use the real components with the screenshot harness (see the 2b and cross-check reports). **Never a stand-in.** Read every picture. Fix whatever draws wrong, smallest change first: clipped labels, overlaps, a bar label sitting on the average line, overlapping "not published" labels, labels 3 and 5 colliding on the map, the group table at 390, and the edge cases `walks.md` lists from the code (a single-year line, long end labels, a 110% tick). The SMT Context map screen shows a link and no chart: draw the map, or the dashboard's chart for that view.

**M3. The wording of the walks (Q2).** Fix all 31 sentence findings in `walks.md`, and add the general rules behind them, each with a test on real output:
- every place reads "Nth of N" with what's being ranked;
- plurals and zero ("1 school", "no schools held steady", never "the 1 nearest schools");
- possessives on names ending in s ("Physics' grades" or "the grades in Physics"; pick one and log it);
- Post-16 screens use the app's existing Post-16 word for its learners;
- a small-number note where a figure rests on fewer than the app's small-cohort threshold (use the existing threshold if there is one; log it);
- "highest", not "the most", for averages;
- "has grown since";
- the 2020/21 and 2021/22 grading caveat wherever a results trend measures from those years (reuse the dashboard's existing caveat words);
- one school count per walk, with the phase named where it narrows ("30 secondary schools");
- every screen answers its own question, so no fixed caption stands in for an answer.

Add a test that runs every walk on the fixtures and checks every question ends in "?", and that no answer is empty or has doubled spaces or punctuation.

**M4. Tables and rankings (Q2).** Fix the findings in `tables.md`:
- every rank is "X of N", with its measure and year (Group sets, Admissions Rivals, Group Academic, SMT Scorecard and RankTable, YearTable, the nearby ranking);
- every comparator column says whether it is a rank or a value, and shows the comparator's own value where the review asks;
- Teacher's ranked % change shows entries and doesn't let a tiny base top the list (use a minimum base, logged, or show the count with a small-cohort flag);
- the Group Schools table: no sort across unlike measures under All phases; headers name the measure and year; "Trend" says it is the 3-year roll change; "joined after results" is shown where that applies;
- the school's own row is shaded in `RankedList` (`FEATURED_ROW_BG`), and the cards that cut to the top N use Teacher's `windowCut`, saying "showing x of N";
- Admissions: a distance of 0.0 km prints as 0.0 km;
- the Low items in `tables.md`.

**M5. Chart titles (Q4).** Apply the title list in `dashboards.md`. Every view has a title that names its measure, phase or cohort, and comparator. No two views on one dashboard share a title. One chart has one name on every dashboard. The three untitled Teacher views get titles. The SMT market share title matches what's drawn. Titles come from the dataview catalogue, so walks and dashboards agree. Add a test: no empty titles, no duplicates per dashboard, and no bare "Trends" or "Change" as a title.

**M6. Repeated tables, missing graphs, the dumbbell (Q5–Q7).** These change published dashboard configs:
- **Q5:** drop the Admissions Market share donut panel (the ranked bars can draw a donut). Merge Share numbers and Share ranks. On SMT Overview, trim the Current tiles to the figures the Scorecard doesn't show. Drop the A-level chip from Group Academic's results trend. Fold Entries mix into Current on SMT Academic, and drop the change column that "The set's schools" repeats.
- **Q6:** add "Rank among the nearest schools, year by year" to Comparisons › Trends, and make the walk screen point at it. Add an optional nearest-schools line to the area trend charts (DV-C1-CAND-TR-GEO-CHART, DV-C1-RES-TR-GEO-CHART).
- **Q7:** the dashboard dumbbell opens on the whole school and doesn't start its scale at 0.

Re-take the out-of-date dumbbell screenshot. Update the preset table (`scripts/views-preset-table.ts --write`, plus its follows-page rows) and R-DUMBBELL. **Name every slug that needs republishing and dry-run each diff.**

**M7. Subject-group colour (Q3).**
1. **The palette first.** Re-pick the eight subject-family colours (`subject-family-colours.ts`) so they are well apart from each other (a measured minimum ΔE, logged) and away from the product accents (GCSE green, Post-16 violet, SMT orange, Admissions sky) and the fixed lines (England, LA, the nearest schools, the peer ambers). Each has a Dark, Mid and Light value that passes the contrast rules. **Draw a palette board** (a PNG in the report: each family's swatch in each theme, next to the accents and fixed lines, plus a sample chart) and commit it before applying it. Guy reviews that board live.
2. **Then apply it everywhere a chart shows subjects:** Teacher bars and the dumbbell, keeping the focus in the accent or marked plainly, and coloring the others by family; trend lines coloured by subject family, never by rank (a subject keeps its colour as its rank changes); SMT and Group subject-area views; walks and dashboards alike. Show a key wherever more than one family appears.
3. **Qualification groups** (the SMT entries mix) get their own colours, not the above/below-the-set blue and orange, and they don't repeat after five.

Add R-SUBJECT-COLOUR (one family, one colour, everywhere; keyed; no rank colouring) and extend R-THEME-CONTRAST.

**M8. Rules, screenshots, the report.**

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- New: R-WALK-WORDS (M3's checks), R-WALK-PANEL-LINK (mini-maps from config), R-RANK-OF-N, R-CHART-TITLES, R-SUBJECT-COLOUR.
- Extend: R-DUMBBELL, R-THEME-CONTRAST, R-HOME-TILES where touched.
- Every existing rule still passes. Log each rule rewritten, and why.

## Ground rules

- **Branch `v0.8-review-fixes` from current `main`,** fetched over HTTPS, in its own worktree. Never switch branches in `~/dev/vicdata_public` or any other checkout.
- **Clean at every milestone:**
  - tsc, eslint and build;
  - the unit, rule, catalogue, RLS and usage-log tests;
  - every PGlite suite;
  - every parity harness.

  Unit tests run one file per process: `npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit <file>`. Group files also need `VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures`. Rule tests run with `--env-file=.env --env-file=.env.local`.
- **Parity:** **figures must not change** except where an M1 bug fix intends it; list each one. Words and pixels change by design here, so list them per page, not just in totals.
- **Harness:**
  - Playwright's headless Chromium in a scratch dir (the installed Chrome crashes);
  - Pillow in a scratch venv (`python -I`);
  - copy `node_modules` (`cp -cR`), since Turbopack rejects a symlink;
  - screenshots from the real components only;
  - read every picture as an image.
- **Never add `next/font/google`.** No database writes; no migration is expected. Never put a server key in client code. Stage files by name. Commit; don't push or merge.
- **Log every call** under "2026-11-14: review fixes" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/review_fixes_report_v1.md`. It covers:
- the milestones and commits;
- per finding (by its number in the three reviews), whether it was fixed, not a bug (with why), or left (with why);
- M1's figure changes, before and after;
- M2's screenshots, with the misses each showed and fixed;
- the palette board and the colour screenshots: one dashboard per product, Dark, Mid and Light, 1440 and 390;
- the republish dry runs per slug;
- tests and parity.

End with **Guy's commands in the seven-step order** (`docs/FEEDBACK.md`). Step 5 republishes the slugs M5 and M6 changed, after `/api/version` shows the merge. Step 7, the live walk-through, covers:
- an Admissions walk at 11+;
- an SMT walk;
- the GCSE "nearby" walk;
- the Group Schools table for Nexus;
- Teacher's ranked change;
- Market share;
- the palette on a GCSE dashboard in all three themes.
