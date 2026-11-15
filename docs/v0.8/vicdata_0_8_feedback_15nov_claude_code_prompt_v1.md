# VicData 0.8: Guy's live feedback of 15 Nov. Build A (bugs), Build B (walks and homes), Build C (charts)

A Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 15 Nov 2026 from Guy's live walk-through that day. His notes and screenshots are in `docs/v0.8/feedback_15nov/` (`notes.md`, `screens/`). Each note is numbered by section: **Adm** (Admissions), **SMT**, **T** (Teacher), **P** (Platform / View as), **HO** (head office), **G** (general). Guy: "do builds A–C in order in one pass, with progress updates at each stage."

**You run ONE build per task**: the task names which one, A, B or C. Each runs straight through, unattended. Work through its milestones in order; each ends in a commit with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on. **Read every note and screenshot your build covers before starting.** Each note's own text is the spec; this prompt adds the decisions and the order.

## Decisions (15 Nov; where Guy didn't answer, the recommendation stands; log each as a call)

- **D2. Subject matching:** a subject is matched across schools through an equivalence, never the exact published name. The DfE subject code is used where it identifies the same subject. The A level Art and Design titles (Art and Design, Fine Art, Photography, Textiles, Graphic Communication, 3D Design, and any other "Art and Design: …" title the data holds) are grouped as **"Art and Design (all titles)"** for comparisons, with each school's own title still shown in tables. Qualification labels are normalised across years ("A level" in 2020/21 = "GCE A level" later). **List every other title family the data holds** (e.g. Design and Technology variants, Mathematics vs Further, English Language and Literature) in the report for Guy to confirm. Group only Art and Design now, unless a family is unambiguous (log each).
- **D3. Independent schools at 11+ (Adm 9–10):** where a school has no ranked GCSE headline (IGCSE), the rivals' ranking and the academic ranking use Post-16 (A level points per entry), as the rivals momentum table already does, and the view says so. Guy's note 10 was cut off; take this reading.
- **D4. The walk rail (Adm 2, every role):** clicking a rail view steps along the walk to that screen. The rail lists only the walk's own views, with "More on the dashboard →" at its foot.
- **D5. SMT flags (SMT 5):** keep the ±3 threshold. With no flags, show the figures closest to one ("Results +0.8 against the set's +0.3; a flag needs ±3").
- **D6. Entry points (SMT 9):** cut from the SMT walk only; keep it on the SMT dashboard.
- **D7. Roll by phase (SMT 11):** compare each phase with Reading's (the school's LA's) school-age population at that phase's ages. Use the existing ONS mid-year reads, one line each, labelled with the ages.
- **D8. The palette:** re-pick Languages & Literature (too close to Sciences in Light, and to the Post-16 violet in Dark) and Health & Care (too close to the GCSE accent). Keep the other six. Re-draw the palette board.

## Build A: bugs (branch `v0.8-feedback-a`)

**A1. Subject matching (T3, T5, T6, T7, T8; D2).** The nearby sixth forms publish "Fine Art" where The Chase publishes "Art and Design", so every comparison finds nothing: "1st of 1 schools", empty charts, two screens drawing the same lines, all 10 nearest "no figure". Fix it where subjects are matched: the walks (`src/lib/front-door/teacher-*.ts`), **the dashboards, set comparisons and rankings**. Grep every place that keys on subject name or `subject::qualification`. Also fix T3's empty "nearby and nationally" chart: index on the school's first year with a figure; draw the comparators that have it, and name those left out; show the empty state only when the school has fewer than two years. Tests on The Chase (137625), Post-16 Art and Design, against its 10 nearest: Hanley Castle, Cleeve and Tewkesbury now have figures.

**A2. Head office walks under View as (HO1, HO2, HO3).** Every head office walk shows "This walk couldn't load the group's figures" under View as, for Harris as well as Nexus. Rebuilt locally against live production, `dashPayload` builds for every dash with and without `compare=nearest`. So the failure is in the live request or the access: a 401 token, a 502 throw, a 503 no-figures, or a 502 "Could not confirm View as". Compare the walk's request, step by step, with the group dashboard's (`GroupDashboard.tsx` against `GroupWalk` in `role-walks.tsx`: the `account` param, `compare`, how the home links into the walk, cookies and headers). Run the route handler itself in a harness with a View as cookie, for both a group with an account and one without. Find the cause and fix it.

Then:
- the walk's error says what failed (its code and the route's message) and always offers a way back to the home;
- every group walk loads for a mainstream group (Harris), a special trust (Nexus), a nursery federation, and a group with no account (a rule);
- HO3: the home's "Our schools" cards open each school's SMT dashboard (`/teacher/smt?headOffice={urn}…`) for a head office and for a platform admin in View as, not the old public page. Decide the no-account case and log it. Check the SMT pages for a special school.

**A3. Duplicate groups in View as (P1).** "nexus" lists four rows: two trusts, each twice (title case and capitals). Find where the duplicates come from and fix at the source if they're true duplicates; otherwise dedupe the search by group id. Show the group id on each row. Note which Nexus the fixtures use (16125).

**A4. Moving between walks stalls (Adm 3).** Going from walk 1 to walk 2 hangs on loading. Find out why (no shared cache, a waterfall, a hook keyed wrongly) and fix it, so the next walk opens as fast as the first.

**A5. Guards.** A rank needs at least 3 schools with a figure, otherwise give counts and never "1st of 1". Rank over time doesn't draw a 1-school line. No two screens in a walk draw the same series (a test over every walk on the fixtures). "Not published" labels give the reason where it's known ("3 entries, too few to publish", T4).

**A6. Report** `docs/v0.8/feedback_a_report_v1.md`, with Guy's commands in seven steps.

## Build B: walks and homes (branch `v0.8-feedback-b`, from main after A is merged)

**B1. Every walk ends on its answer (G1, SMT 7).** The final screen answers the walk's question with a data view: a ranking, chart or table, never a summary alone. SMT Academic's last screen ranks the subjects strongest to weakest, with those needing attention marked. Check this on every walk, in every role.

**B2. The rail and the way home (D4, Adm 2, Adm 12).** The rail steps along the walk. "Here's what you found" has a clear way back to the role's home.

**B3. No build notes in the page (Adm 6, Adm 7, SMT 4).** Sweep every walk and dashboard for text written for the builders, not the user. Examples: "The same views, in the same order, as this panel's rail on the dashboard.", "Past pools (same method, earlier censuses)", "an empty state with the reason where…", "Positions on the national grid; no base map in the walk". Rewrite them for a teacher, or remove them. Add a rule: no rule IDs, file names, "empty state", "harness", "R-…" or "dashboard's rail" in user text.

**B4. Admissions (Adm 1, 4, 5, 8).**
- The home's top task is the sets editors (who feeds us, who are our rivals), since they drive the walks.
- "Open the full Admissions dashboard" uses a tint of the Admissions blue.
- Dashboards in Mid get a tinted background, not white, so they sit back.
- The Pipeline walk starts with the school ("Your Year 7 cohort, year by year" second), then moves outwards.

**B5. SMT home (SMT 1, 2, 14, 15).**
- A loading graphic wherever SMT waits on data.
- The GCSE and Post-16 pills switch the home's tiles and walks to that phase, as the dashboard does.
- **"Our subjects"**, built like head office's "Our schools": a card per subject by phase, each opening that subject's Teacher walks and dashboard read-only as SMT.
- D6: Entry points come off the SMT walk.

**B6. Teacher home (T1).** With no subject set, the home asks for one (a picker on the home) and the walks run. Never "Coming" for a missing subject. Find out what "Coming" means there and fix the cause.

**B7. Report** `docs/v0.8/feedback_b_report_v1.md`, with Guy's commands.

## Build C: charts (branch `v0.8-feedback-c`, from main after B is merged)

- **C1. Value axes.** Trend charts in SMT, Admissions and Group get a value axis with values, and indexed charts mark and label 100 (SMT 4, 11, 12, 13; review item #11). Open the y scale up where a chart is squashed (SMT 4).
- **C2. SMT Overview market share (SMT 4).** Draw the 10 nearest the title names (their middle, or their band), or change the title to match what's drawn.
- **C3. SMT Academic, "Last year to this, every line" (SMT 6).** The dots are stretched into ovals: fix the distortion. Redraw as last year → this year per line, with values, entries and zero marked.
- **C4. Shapes (SMT 8).** Replace the "Shapes around you" text with two small year-group charts drawn like the main one: the nearest rival, then the 10 nearest. Add values to the main chart. Show what a shape name means.
- **C5. Leaving at 16 (SMT 10).** A ± bar chart per year (joined up, left down), with the 10 nearest's middle as a reference. Keep the table as "As a table", and give it one signed column.
- **C6. Roll by phase (SMT 11, D7).** Reading's school-age population, Senior and Post-16 ages, one line each.
- **C7. Births and children nearby (SMT 12, 13).** Tell it as one story: counted 11–18s solid running on into the projection dashed, births on their own scale or indexed, and a line on the 11-year lag ("the children born since births peaked in 2012 reach 11 from 2023"). Check for a missing births year. Within 15 km must reach the same last year as Reading and England.
- **C8. Size by phase (SMT 3).** Close up the gap between the figure and its rank.
- **C9. The flags (SMT 5, D5).**
- **C10. The whole-school entries dumbbell on SMT (T2).** Add it to SMT Academic, per phase. Fix its key: the focus subject isn't a ninth family; draw the "School average" line or drop it from the key; drop "(GCE A level)" where every row is A level; spell out "○ first year → ● latest".
- **C11. Teacher Results chart (T4).** Show small cohorts on the chart. For a year with no published figure, leave a gap rather than a dotted bridge, with its reason.
- **C12. Independent schools at 11+ (Adm 9, Adm 10, D3).**
- **C13. The walk window (Adm 11).** Refine the white window: the clumsy shadow along its top edge, and its overall look, in all three themes.
- **C14. The palette (D8).**
- **C15. Report** `docs/v0.8/feedback_c_report_v1.md`, with Guy's commands. Step 5 republishes any dashboard whose config changed; name the slugs and dry-run them.

## Tests (every build; add to the rules catalogue and regenerate `docs/catalogue/*.md`)

New rules as the work needs them, at least:
- R-SUBJECT-MATCH (A1);
- R-GROUP-WALKS-LOAD (A2);
- R-RANK-MIN (A5);
- R-WALK-NO-REPEAT (A5);
- R-WALK-ENDS-ON-ANSWER (B1);
- R-NO-BUILD-NOTES (B3);
- R-CHART-AXES (C1).

Extend the existing rules where touched. Every existing rule still passes; log each rule you rewrite, and why.

## Ground rules

- **Each build branches from current `main`,** fetched over HTTPS, in its own worktree. Never switch branches in `~/dev/vicdata_public` or any other checkout.
- **Clean at every milestone:**
  - tsc, eslint and build;
  - the unit, rule, catalogue, RLS and usage-log tests;
  - every PGlite suite;
  - every parity harness.

  Unit tests run one file per process (`npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit <file>`; group files also need `VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures`). Rule tests need `--env-file=.env --env-file=.env.local`.
- **Figures don't change** except where a fix intends it (A1 above all). List every changed figure, before and after.
- **Harness:**
  - Playwright's headless Chromium in a scratch dir (the installed Chrome crashes);
  - Pillow in a scratch venv (`python -I`);
  - copy `node_modules` (`cp -cR`), since Turbopack rejects a symlink;
  - screenshots from the real components only, never a stand-in;
  - read every picture as an image.

  The review-fixes harness is in `docs/v0.8/audit_scripts/review_fixes_preview`.
- **Screenshots** of each changed screen at 1440 and 390, in Mid plus one of Dark or Light. Put them in `docs/v0.8/feedback_{a,b,c}_screenshots/`, each beside Guy's screenshot where he sent one.
- **Never add `next/font/google`.** No database writes. If a migration is needed, write it, PGlite-test it, and give Guy its steps. Never put a server key in client code. Stage files by name. Commit; don't push or merge.
- **Log every call** under "2026-11-15: feedback build {A,B,C}" in `docs/OPEN_QUESTIONS.md`.
- **Report:** per note (by its number), fixed, not a bug (with why), or left (with why). Then tests and parity. Then Guy's commands in the seven-step order (`docs/FEEDBACK.md`), with step 7 named "Live check".

## Build D (added 15 Nov; runs after A–C are merged and live; scope to be written up as its own prompt then)

Guy's notes D-a, D-b and D-c in `docs/v0.8/feedback_15nov/notes.md`:
- D-a: subject homes reached from the SMT home;
- D-b: school homes reached from head office's "Our schools";
- D-c: head office subject comparisons, inside the group and against other groups, the region and England.

## Build C additions (15 Nov, after B)

- **C16. Admissions 5, as Guy meant it:** in Mid, the dashboard pages sit on a tinted background (the section's own tint) instead of white, so they are less prominent. Build B read this as the home's button (done there too). This is the pages themselves, for every dashboard that follows Mid. Contrast stays AA; extend R-THEME-CONTRAST.
- **C17. SMT 4's chart:** Build B fixed only the words. C2 covers the chart.
