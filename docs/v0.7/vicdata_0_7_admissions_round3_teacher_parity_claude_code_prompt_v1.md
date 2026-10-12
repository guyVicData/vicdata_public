# VicData 0.7 — Admissions round 3: match Teacher, boarding only where it applies, one edit bar, the funnel like with like, editor plan for the large views

Claude Code build prompt, written 12 Oct 2026. It comes from Guy's first live click-through of round 2 / 2b. Read `docs/v0.7/admissions_r2_report_v1.md` and `docs/v0.7/admissions_r2b_report_v1.md` first.

**Guy's principle:** Admissions' core UI must be **identical to Teacher**. Only the column arrangement differs: column 1 is a panel, and columns 2–3 are one large view. Wherever Admissions built its own version of something Teacher already has, replace it with Teacher's.

## Ground rules

- **Branch `v0.7-admissions-r3` from `main`.** Commit per stage, with tsc, eslint, build, unit tests, rule tests, the RLS test (111) and the parity harness all clean.
- **Never put a server key in client code.** Stage files by name; never `git commit -a`. Leave Guy's untracked or modified files alone. Use timeouts and progress logs.
- **No database changes are expected.** If one turns out to be needed, write it and test it, but don't apply it. Give the apply command as an `&&` chain with the project-ref check (`lnhulykjlxmoneappnsp`) and **no `exit`**.
- **Parity:**
  - The Data View and the public page must stay byte-identical.
  - **Teacher changes on purpose in F1 only** (the panel icon row). Every other Teacher pair must stay identical. List every Teacher pair that differs and say why. Any difference outside F1 is a bug.
- **Log calls** under "2026-10-12 — 0.7 admissions r3" in `docs/OPEN_QUESTIONS.md`.
- **Merge and push if clean,** with F6 delivered as a plan only. **Stop before merging** if a Teacher difference goes beyond F1, or if anything needs an RLS change. If a push fails, give Guy the command (he pushes over HTTPS).

## F1 — One panel chrome for Teacher and Admissions

Every panel and large view in both products uses **one shared panel-header component**, with the same icons in the same positions, always:

- **(a) A full-screen icon on every panel,** Admissions included. Teacher's full-screen behaviour is the reference.
- **(b) Notes and flags:** the notes ("i") and the honesty or flag notes open the way Teacher's notes do: the same icon, position and popover. The Admissions-only note styles go.
  - Guy's note on this item was cut off ("notes, flags as …"). Read it as "exactly as Teacher" and log it.
- **(c) Export:** Admissions' three-dot export menu stays. **Teacher moves to the same three-dot menu,** with the same items in the same order (export image, export data, copy to meeting slides, and whatever else Teacher's export offers now). Nothing Teacher can do now may be lost.
- **(d) Fixed order:** the icons sit in one fixed order and position, right-aligned, identical in both products. When an icon doesn't apply to a panel, its slot stays reserved so the others don't move. Write the order in the component and in the report.

Teacher's parity differences must be **only** this icon row. Show before and after screenshots for one Teacher panel and one Admissions panel, in both themes, at 1440 and 390.

## F2 — Boarding only for boarding schools

- **What counts as a boarding school:** GIAS boarders (the existing field the public page uses), when the school has any boarding provision. Log the rule.
- **Setup:**
  - for a school without boarders, step 1 doesn't offer "day and boarding";
  - **step 3 (Boarding feeders) is skipped,** and the step count reads 1–3.
- **The filters stay where they are now.** Don't move them. *Day + boarding* sits next to *All pupils / girls / boys* and *State + independent* (and in column 1's "whole school numbers" panel menu, if those filters are there too) **only for a boarding school**. For a day school it isn't shown, and the other filters close up.
- **Everywhere else:**
  - **Column 1:** the day / boarding tile is one tile. **For a boarding school** it shows day and boarding as now. **For a day school** it stays, but shows **Day only**: the day count with no boarding half, no "0 boarders", and no boarding label or split bar. Same tile, same position, so the column's layout doesn't change between school types;
  - for a day school, every other day/boarding tile, list kind (`boarding_feeders`) and label is hidden;
  - existing boarding lists aren't deleted, only hidden.
- **A thorough boarding audit.** Guy: *"Non-boarding schools must not have to think about boarders, but boarding schools must."* Check it in both directions, every surface, and don't rely on spot checks:
  1. **Find every mention.** Grep the Admissions code, the routes, `ADMISSIONS_NOTES`, the catalogue entries (D7), the seed rows and the setup steps for every mention of boarding / boarders / day (`boarding`, `boarder`, `day_only`, `Day +`, `boarding_feeders`, the ISC note). List each one in the report as a table:
     - surface;
     - what a **day school** sees (it must be nothing: no tile, filter, chip, column, legend, empty state, note, setup question, editor option or export field mentioning boarding);
     - what a **boarding school** sees (it must be there and working).
  2. **Watch the subtle places:**
     - the setup step count and "day only" wording;
     - the Pipeline header chips and feeder kinds;
     - feeder table columns;
     - funnel and ladder captions;
     - the boarding entry-point fuzzy set;
     - the market-share filters;
     - the rivals' table (a day school's rivals can include boarding schools; show their figures, but don't ask the day school to make any boarding choice);
     - the editor's compare options (*Boarding feeders*, *Both*): hidden when previewing a day school, kept in the catalogue;
     - export / meeting-slide text;
     - the phone tabs;
     - the "lead hasn't set up yet" defaults.
  3. **For a boarding school,** check that every boarding surface is present:
     - setup offers day and boarding, and step 3 runs;
     - the filter and the column-1 tile show;
     - the boarding feeders list and fuzzy set work end to end.
  4. **Add a rule, R-ADM-BOARDING-ONLY-WHERE-BOARDERS,** with a real-data test that renders every Admissions view and the setup flow for:
     - a day school (The Chase 137625, plus an 11–16 state school);
     - a boarding school (King's Worcester 117037, if GIAS lists boarders; otherwise an independent prep with boarders).
     
     The test asserts no boarding text or control for the day schools, and every boarding surface present for the boarding schools.
  5. **Screenshots** of column 1, setup and the Pipeline header for one day school and one boarding school, in both themes.

## F3 — School shape leaves out age 18

- In Admissions' shape and profile views (column 1's mini profile, the Shape and size large view, rivals' and the local shape), **leave out age 18.** Those pupils are Year 14 and always tiny.
- **Check whether excluding 18 changes the shape classifier's result for any school.**
  - Admissions and the public school page share the classifier, and the public page must stay identical.
  - If excluding 18 only changes the drawing, apply it to the drawing in Admissions.
  - If it changes the classifier's answer for any school, **don't change the public page.** Report how many schools change and which ones, so Guy can decide whether the public page follows.

## F4 — One edit bar across all views

- **The problem:** Admissions has its own top bar (`src/components/admissions/Chrome.tsx`) with no Edit button. That confuses Guy.
- **The fix:** Admissions uses **Teacher's nav and edit bar** (`TeacherNav`, edit mode from `src/lib/edit-mode.ts`), the same component, position, buttons and behaviour.
  - The platform admin's editing bar is seen only by platform admins, as on Teacher.
  - Its Edit opens the existing view editor on the Admissions dashboard in view, as Teacher's does.
- **Keep what Admissions needs** (the Pipelines | Market share switch, the entry-point chips) in the slots where Teacher keeps the GCSE Candidates | Results switch and the subject chips.
- **Remove `admissions/Chrome.tsx`** if nothing else uses it.

## F5 — The "Viewing as: you" pill, and the admin's empty state

- **The pill:** it's the platform admin's View as control, by design (0.6 snag round 4) and **only for platform admins**. Members never see it.
  - Confirm that in the report with a member screenshot (Teacher and Admissions).
  - **Change:** the pill shows only while the platform admin is actually viewing as someone else. At rest, View as opens from the edit bar (F4) and the account page, so there's no "Viewing as: you" in the main nav.
- **The empty state:** a platform admin who opens Admissions with no Admissions role at their own school currently sees "Admissions is for members of a school on VicData. Join your school from your account page." For a platform admin, it should read: **"To see a school's Admissions, use View as."** with a button that opens View as. Members keep the existing text.
- **Tier:** Admissions access is by role only (part of the whole-school package). Confirm the route doesn't gate on `school_accounts.tier`. The Chase's account is `individual`, and its preview-agent membership now has `admissions` and lead. View as that membership should open The Chase's Admissions read-only. Screenshot it.

## F6 — Editing the large two-column views: plan only, don't build

Guy: *"Should be able to edit the new 2 column views with the same editing interface. This will need some planning, as we have a number of great new graphs/views."*

Write `docs/v0.7/admissions_editor_plan_v1.md`, a plan for Guy to review. **Don't build it.** It should cover:

1. **What exists now:**
   - what round 2's D7 added to the editor (families, compare options, view kinds, rules);
   - what the editor can and can't do with Admissions today (the spanning panel, the rail of views inside a large view, the column-1 panel);
   - one screenshot per step (Data → View → Preview) on an Admissions panel.
2. **The model:**
   - how a **large view with a rail** fits the editor: one panel holding several views, with the rail as a list the editor orders, adds to and removes from;
   - how a view moves between the large view and a row-2 panel;
   - how the span is set;
   - the same Data → View → Preview steps, with **no new dialogue**.
3. **The catalogue of new views:** every Admissions view (pipeline ladder, funnel, feeder map, feeder table, shape small multiples, donut, ranked bars, rivals map, momentum scatter, flag list, strengths bars, pool trends, hold-share, entry trends, academic panel, roll and share trends). For each:
   - its family and compare options;
   - its look-only options;
   - what's locked by catalogue rules (certainty styling, honesty wording, flag thresholds, "shapes not ranked");
   - **whether the view could also go on Teacher or SMT dashboards** (for example, pool trends or rivals' momentum on an SMT page).
4. **The Preview step:** how "Shows for" lists entry points, and how a large view previews at 1440, at 390 and on a 16:9 slide.
5. **Stages and risks:** a staged build order (small first), what each stage touches, its parity risk to Teacher, and the questions for Guy.

## F7 — The funnel ("From births to your Year 7"): like with like, labelled clearly

**Guy:** *"This is great but needs like with like."*

**Now** (`src/components/admissions/views/Funnel.tsx`):

- the births bar is ONS births in the **LA blend**;
- the Year 6 (or Year 11) bar is the **feeder set's** pool, a hand-picked subset;
- so the first two bars cover different areas.

**Change:**

- **Same area.** Births and the Year 6 / Year 11 bar use **the same geography**:
  - by default, the school's own LA;
  - when the lead has set an LA blend, the same blend, weighted the same way, for both.
- **The pool bar** counts **all** pupils at that age in **all** mainstream schools in that area: academies, LA-maintained, free and independent. Use `age_profile_aggregates` (scope `la`), which already holds those groups and is backfilled 2019–2025. Confirm the age mapping (Year 6 = age 10 at 31 August of the census year) against the ladder's.
- **The feeder-set pool leaves the funnel.** It stays in the Pipeline view.
- **Labels:** each bar leads with a bold bracket-style label, then the area and the year, in plain words, from `ADMISSIONS_NOTES`. For The Chase at 11+:
  - **Births** in Worcestershire · born Sept 2013 – Aug 2014 · worked out from calendar-year births
  - **Year 6** in all Worcestershire schools, state and independent · 2024/25
  - **Your Year 7** entry cohort · 2025/26
  
  With a blend, the area reads "Worcestershire 70% · Herefordshire 30%".
- **Wording:**
  - Drop "an estimate for the area". The births split *is* the estimate, so say what it is. The hover keeps the method note.
  - Keep "not a flow of the same children" as the panel's note (F1's notes icon).
- **The same for 16+:** Year 11 in all schools in the area, then your Year 12. **4+ has no funnel** (no Reception projections yet).
- **A rule:** R-ADM-FUNNEL-SAME-AREA, with a real-data test. It checks that the births and pool bars use the same LA set and weights, for The Chase (11+, 16+) and King's Worcester.

## Report

Write `docs/v0.7/admissions_r3_report_v1.md`, with:

- F1–F5 and F7 as built, with screenshots (F7: The Chase at 11+ and 16+, before and after);
- the Teacher parity differences, which must be F1's icon row only;
- F3's classifier check;
- the F6 plan's path and a short summary;
- logged calls;
- a short click-through for Guy.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.7-admissions-r3 -m "0.7 Admissions 3: Teacher panel chrome, boarding only where it applies, one edit bar, shape without 18" && npm run build && git push
```
