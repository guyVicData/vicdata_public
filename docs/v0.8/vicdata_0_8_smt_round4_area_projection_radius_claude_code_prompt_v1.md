# VicData 0.8 — SMT round 4: projections from children already born, a catchment radius the school controls, and full calculation notes on every chart

Claude Code build prompt, written 15 Oct 2026, for the app repo (`~/dev/vicdata_public`, app database `lnhulykjlxmoneappnsp`).

**Run it only after the ingest's area-projection round is promoted** (`~/dev/vicdata`, `docs/vicdata_area_projection_report_v1.md`). If `area_projection` and `area_context` don't answer in production, stop and say so.

## Read first

- **The method:** `docs/v0.8/vicdata_area_projection_method_v1.md`. The same note is in the ingest repo; check they're identical, and stop if they differ.
- **The ingest report:** function signatures, return shapes, the back-test and the spot checks.
- **`docs/v0.8/smt_r3_report_v1.md`** and the SMT r3 snags merge (`3a22bb1`): what Context draws now, including the projection-join note this round replaces.

## Ground rules

As round 3:
- **Branch `v0.8-smt-r4` from `main`.** Commit per stage.
- **Clean before merge:** tsc, eslint, build, unit, rule, RLS, groups r1, usage log, Teacher parity (2,875), Admissions parity (328), the public page.
- **Database changes are written and tested (PGlite), never applied by you.** Give commands as `&&` chains with the project-ref check and **no `exit`**.
- No server key in client code. Stage by name. Leave Guy's files alone.
- **Log calls** under "2026-10-xx — 0.8 SMT r4" in `docs/OPEN_QUESTIONS.md`.
- **Allowed differences:** SMT Context and SMT Pupils, plus the (i) texts changed in stage I (listed pair by pair). Anything else stops the merge.

## R — The catchment radius

1. **The Area pill** becomes "Area: within {N} miles · local authority". The miles part is a control with presets 1, 2, 3, 5, 8, 10, 15, 20 and 25 miles, plus a slider from 1 to 25 in whole miles. The default is the school's saved radius, otherwise 5.
2. **The radius applies to the whole Context board:**
   - the map circle and the shaded ring;
   - children now;
   - the deprivation mix;
   - population by age;
   - children nearby over time;
   - the forward view.

   Read through `area_context` and `area_projection` (no more `school_context_lookup` for the circle). Every caption that says "within 5 miles" takes N. Never mix radii on one board.
3. **Saving a default:** a School-Admin can save the school's catchment radius ("Our usual catchment: N miles").
   - Store it in a new app-DB setting with RLS: the school's own School-Admin writes it, its members read it, nobody else does.
   - Admissions' "around the school" reads the same setting, so the two boards agree. Check Admissions parity still holds at the default of 5, and log it.
   - Changing the radius on the board without saving changes only that view. Copy this view… and Edit keep it.
4. **The map at a wide radius:** at 20–25 miles the map zooms out and the boundaries are drawn more simply. Time Acland Burghley at 25 miles and report it. If it's too slow, shade from centroids (dots) above a threshold, and log the threshold.
5. **The authority mix** sits under the children tile as one line: "Within N miles: Reading 47%, Wokingham 46%, West Berkshire 6%, South Oxfordshire 1%". Keep it short; any authority under 1% folds into "other".

## F — The forward view (the "Forward" panel, the projection tile, the rail's "Births and projections")

1. **The line** is the middle projection from `area_projection` (or the authority's, with the Area pill on local authority), for the school's ages (the level chips choose), up to the horizon. The band is shaded. Years that include children not yet born are drawn lighter and labelled at the change ("includes children not yet born").
2. **Estimates before the line,** solid, from the same source, so the two always meet: the projection starts from the latest count. This replaces the projection-join note from the r3 snags; retire that note and its rule, and say so.
3. **ONS's 2022-based projection** is a faint dashed line that's off by default, with a toggle "Compare with ONS's projection".
4. **The scenario** "If migration returned to 2022–24 levels" is a second faint line, off by default, with its own toggle.
5. **The projection tile** reads "{ages} by {latest+5}: ▲/▼ x% (range y% to z%)", with the caption "children living within N miles, projected; not a forecast for the school".
6. **Pupils row 2** ("the area's school-age population") uses the same middle line for its forward years.
7. **Wording:** the method note's "What it is, and isn't" goes into `SMT_NOTES`, locked with a rule. Never "forecast", never "your roll", never a school-level number.

## I — Every chart says exactly how it was calculated

A standing rule for VicData, starting here:

1. **A `method` on every catalogue view** (Teacher, Admissions, SMT, groups). It holds:
   - the sources with editions, read from the data where the data carries them;
   - the geography;
   - the years used and any left out, with the reason;
   - **the calculation as numbered plain-English steps;**
   - any rounding or suppression.

   The footer's source (i) renders it.
2. **Generated, not typed,** wherever the numbers come from settings. The forward view's (i) is built from the settings returned by `area_projection`, in the method note's shape, so changing a setting changes the text.
3. **Audit every existing view.** List each view, what its (i) says now, and the steps it actually performs (from the code). Write the missing steps.
   - Where the code does something the (i) doesn't say (a rounding, a filter, an exclusion such as independents, double award counted as two entries, a small-number suppression), **the (i) must now say it.**
   - Report every view whose (i) changed, with before and after, so Guy can read them.
4. **A rule test:** every view has a non-empty method with at least one numbered step and every source named. For views with settings, every setting value appears in the rendered text.
5. **The (i) has room:** collapsible "How it is calculated", on the phone too, never truncated.

## T — Tests

- **R-SMT-RADIUS:** the default comes from the saved setting, else 5. The whole board follows N. No caption says 5 when N isn't 5. RLS on the setting: positive and negative, another school, a non-admin.
- **R-SMT-FORWARD:** the line starts at the latest count. The band contains the line. The unborn years are flagged. Leighton Park's authority mix shows Reading and Wokingham. The figures equal the ingest's P5 spot checks exactly. **If they differ, stop and report; don't change the test to match.**
- **R-METHOD-PRESENT:** see stage I.
- **R-METHOD-SETTINGS:** change a setting in a fixture, and the (i) text changes to match.
- **R-SMT-NOT-A-FORECAST:** the wording rule.
- Parity: Teacher and Admissions are identical **except the (i) texts**. Compare the pages with the (i) panel closed, and list the (i) changes separately.

## Report

`docs/v0.8/smt_r4_report_v1.md`:
- R, F and I, with what changed;
- **the (i) audit in full,** before and after, view by view;
- the rules table;
- timings at 1, 5 and 25 miles;
- the apply commands for the radius setting;
- logged calls.

Screenshots go in `docs/v0.8/smt_r4_screenshots/`:
- Leighton Park Context at 3, 5 and 10 miles, both themes, 1440 and 390;
- Leighton Park's forward view with the ONS line and the scenario on;
- Camden (Acland Burghley) forward against ONS;
- three (i) panels opened: the forward view, a Teacher Comparisons view, and an Admissions pool view.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-smt-r4 -m "0.8 SMT round 4: projections from children already born, catchment radius, calculation notes on every chart" && npm run build && git push
```

Stop before merging if anything outside the allowed differences changes, if R-SMT-FORWARD's figures don't match the ingest, or if the 25-mile map is unusable. Push the branch and report instead.
