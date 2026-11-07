# VicData 0.8: Sets, round 1. One way to make, choose and manage lists of schools

A Claude Code prompt for the app repo (`~/dev/vicdata_public`) and the app database (`lnhulykjlxmoneappnsp`). Written 6 Nov 2026 from Guy's decisions the same day, made while testing Leighton Park's Admissions lists and on the "VicData set editor" design canvas. **v2 (7 Nov):** adds Guy's 7 Nov feedback (F-40 and F-41) and mobile views for every new screen (section G).

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each one ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## Why

VicData has two list systems that share nothing:
- **`admissions_lists`**: one list per school × entry point × kind (`day_feeders`, `boarding_feeders`, `rivals`, `rung`). Only the Admissions lead edits. It has fuzzy rules, `confirmed`, shares, and is edited in a four-step setup (`components/admissions/setup/Setup.tsx`).
- **`saved_sets` / `saved_set_members`**: comparator or feeder sets, personal (cap 8) or shared (admin only). Teacher, SMT and the Data View read them through `ComparatorSetChooser`, `teacher-view-saved-sets.ts` and the Data View sidebar. The `feeder` type and `/sets/feeder/new` are unused (Guy).

There are four separate editors, which share only `SchoolSearch` and `ConsortiumMap`.

Guy's direction: **one engine for sets across the site.** It holds the schools' curated sets, personal sets and default (recipe) sets, chosen from one menu and managed in one library, like playlists in Apple Music. Admissions goes first. Teachers, SMT and later parents and students use the same engine, each seeing as much of it as they need.

**Live data, 6 Nov:**
- `saved_sets` is empty.
- `admissions_lists` holds **6 rows, all for Leighton Park**: Guy's test, as Admissions lead, until 23 Nov. They are day_feeders, boarding_feeders and rivals at 11+ and 16+ (18, 27, 10, 16, 18 and 10 schools; both rivals lists carry a fuzzy rule).
- `admissions_entry_points` holds 11+ and 16+ for Leighton Park.

**Carry these across without loss.**

**Design files:** four `.dc.html` screens are in `~/dev/vicdata_public/.sets_design_inbox/` (untracked):
- `rivals_editor.dc.html`
- `feeders_editor.dc.html`
- `library.dc.html`
- `set_view.dc.html`

**Move them** (not copy) into `docs/v0.8/sets_design/` on your branch and commit them first, so the main checkout no longer holds them. They are design references (layout, wording, behaviour), not code to port. Their figures in square brackets are placeholders. The school names and distances are Leighton Park's real ones.

## The decisions (Guy, 6 Nov)

### A. The model

1. **One storage model for every set,** replacing both tables. A set has:
   - a **name**, an optional **description** ("why these schools"), and a **kind**: `compared_against` or `feeders`;
   - an **entry point** (Admissions: `4+`, `11+`, `16+`, `age:N`) or a **phase** (Teacher: GCSE or Post-16), or neither;
   - an optional **focus school** (staff sets have one; parents' shortlists later won't);
   - an **owner scope:** `school` (curated) or `personal`;
   - a **creator kind:** `default`, `admissions`, `smt`, `school_admin`, `group`, `victoria_consultancy` or `me`;
   - **pinned**, a **folder** or tags, **archived**, and when it was last used per user;
   - **members:** URN, order, and for feeders a **tier** (`main`, `regular`, `occasional` or null);
   - an optional **rule**, the old fuzzy definition, and an optional **source recipe** (the default set it started from).
2. **Who curates:**
   - **compared-against** school sets: SMT and Admissions (and the School-Admin);
   - **feeder** school sets: Admissions.

   Teachers use school sets and don't build them. Anyone can keep **personal sets: up to 8 active**, where archiving frees a slot. Saved rankings keep their own table and their own cap.
3. **Default sets are computed when shown, never stored,** as today (`default-comparator-lists.ts`, `findSurroundingSchools`, the boarding fifth rule, the Post-16 "with a sixth form" rule, R-POST16-DEFAULT-SET). A default set becomes a stored set only when someone saves it as their own.
4. **Group and Victoria Consultancy sets stay read-only and conditional:**
   - **the group** appears under the group's own name, only for a school in a group (`groups/school-sets.ts`);
   - **Victoria Consultancy** appears under that full name, only for schools Guy has marked as clients (`vc_set_school_visibility`).
5. **The migration:**
   - creates the new tables with RLS, in line with the rules above and today's (a personal set is seen by its owner only; a school set by every approved member; curators edit by kind);
   - converts Leighton Park's 6 `admissions_lists` rows into school sets, keeping members, fuzzy rules as rules, the LA birth blend and entry points;
   - leaves the old tables in place, read by nothing new.

   Every read of the old tables in `src` moves to the new model in this round. Prove the conversion in PGlite against a copy of the 6 rows, and make it safe to run twice. Don't drop the old tables. A later round will, once Guy has seen this one live.

### B. Choosing a set: the selector (one component, Teacher, SMT and Admissions)

6. **The label is plain text, and the button holds only the set:** e.g. "Compared against" then `[10 nearest | independent · 10 ▾]`. On Pipelines the label is **"Feeder schools"**; "Compared against" means nothing there. The set button looks different from filter pills: an accent border, the name in bold, the number of schools beside it.
7. **The menu is always the same three blocks,** visually separated, in this order:
   1. **Default** (no "VicData" heading): the recipe sets.
   2. **School sets:** each row tagged with its creator (Admissions, SMT, [School group name], Victoria Consultancy).
   3. **My sets:** with "n of 8".

   The current set is ticked, and every row shows its number of schools. Below the blocks: Edit this set…, New set…, Manage sets.

   The menu shows only the sets that fit the page (kind, and entry point or phase). Up to about 5 **pinned** school sets show, then "All school sets (n)…". About 5 **recently used** personal sets show, then "All my sets (n)…".
8. **Default sets for Admissions:**
   1. "10 nearest | [same sector]";
   2. "10 nearest | boarding", offered only to a boarding school;
   3. "Schools in [LA] | all sectors" at 4+ and 11+ (the same age group), or "All post-16 in [LA]" at 16+.

   **Which one is the default** follows Teacher's boarding rule: the top two fifths by boarders default to the boarding set; others default to the same-sector set. Leighton Park is in the third fifth (136 boarders, 23%), so its default is 10 nearest | independent.

   **Default feeder sets** are named by what they hold: "Day | all sectors", "Day | state", "Day | independent", plus Boarding versions for a boarding school. Their size **grows with density**, reusing the SMT catchment's density sizing, not a fixed 15.

   A boarding feeder set suggests **independent preps, day or boarding** (not boarding-only). Today `views-api.ts` line 329 and `Setup.tsx` line 340 force `boarding: true`: remove that.
9. **Teacher and SMT:** the regional and national rankings sit in **Default**. Saved rankings follow their owner (personal → My sets, school → School sets). Nothing Teacher does today is lost: the "+5 more" stepper, the Post-16 rule, Victoria Consultancy and group sets.
   - **Teacher's pill** sits in the Comparisons column: give it a **fixed width that truncates long names**, with the full name on hover, so the grid doesn't shift (the Post-16 round's lesson).
   - **Admissions sets in Teacher:** 11+ compared-against sets appear on GCSE pages, 16+ on Post-16 pages, and feeder sets never.
10. **Every panel header names the set in use,** e.g. "against 10 nearest | independent · 10"; on Pipelines with tiers, "Day | all sectors · 28 · 6 main". That applies in Teacher's Comparisons column, SMT and Admissions.
11. **Admissions' top bar:**
    - **remove** the "Day + boarding" dropdown (now a choice of set) and the "Independent only" dropdown (now inside the set);
    - **keep** the Pupils filter, worded **"Girls & Boys / Girls / Boys"**;
    - **remove** the per-panel list pills ("Feeders: Day list (18) + …") that opened the setup steps.

    The four-step setup stays only for a lead's first time through (entry points).

### C. The set editor (`rivals_editor.dc.html`, `feeders_editor.dc.html`)

12. **Laid out like an Apple Music playlist:**
    - **a header:** a map thumbnail as artwork with a kind icon, the name, the description, the creator pill, kind, entry point, totals (schools, and pupils at the entry age) and "last changed by";
    - **actions:** Save, Save as…, Share, and a "···" menu.
13. **A tick means "in the set", nothing else.**
    - Unticking greys a school, marked "unticked, leaves on save". Ticking again restores it, so there's no separate undo.
    - There are no minus buttons and no bulk-select bar.
    - Feeder tiers are a per-row button ("Main ▾"); the list sorts by tier.
14. **Adding schools:**
    - by name (any school);
    - **suggestions** filtered by Independent · State · Both, plus Boarding only for a boarding school's compared-against sets;
    - **10 shown** with **"+5 more"**, counted after the filter.

    For compared-against sets, suggestions sit at the foot of the list. For feeder sets they move to an **"Add schools" side panel,** because feeder sets get big.
15. **Big feeder sets (25+; a London state school 20+):**
    - grouped by tier, with headings and counts; Occasional and Untiered start collapsed;
    - a **Group by** switch: tier, borough or sector;
    - **"Find in this set"** filters the rows;
    - a summary under the title: "28 schools · 6 main · [n] main feeders falling".
16. **"How close is this set to [school]?"** (compared-against sets), updating live as schools change:
    - **Distance:** the range and median.
    - **Results,** with a **GCSE / Post-16 switch.** It starts on whichever covers more of the set, and always says how many schools have each (many independents sit IGCSEs). The same setting drives the rivals' results views on Market share (Rivals' momentum, the rivals table).
    - **Pupil population:** boarding share, size and gender against the focus school.

    Use real figures only. Where the data doesn't support a closeness score, show the counts and say so.
17. **Editing a set you can't change** (a Default set, or a school set you don't curate) opens a copy that can only be saved as your own. New set… starts from this page's kind and entry point, empty or from any set. That replaces Teacher's chooser hub as the place to build.

### D. The library and the set view (`library.dc.html`, `set_view.dc.html`)

18. **The library at `/sets`,** replacing today's `/sets` pages. Retire `/sets/comparator/new` and `/sets/feeder/new`, redirecting to the library.
    - **Sidebar:** All sets, Default, School sets, My sets ("n of 8"), Archived; then folders and + New folder.
    - **Top row:** search (by set, or by a school in it), a kind switch (All · Compared against · Feeder schools), the entry point buttons, and sort (recently used, A–Z, size).
    - **Pinned school sets** as tiles: map artwork, a large kind icon in the creator's colour, a creator stripe.
    - **A table of all sets:** the kind icon in the creator's colour, a creator pill, schools, last used, Open, and "···" (Edit, Duplicate, Pin to menu, Move to folder, Share, Propose as school set, Archive).
19. **The set view:** clicking a set in the library opens it **read-only**: header, numbered list of schools, how close, and where it's used. Its buttons are **Edit** (to the editor), Use on [dashboard], Duplicate and Share.
20. **The route:**
    - set pill → menu;
    - pick → the dashboard updates in place;
    - Edit or New → the editor;
    - Manage sets → the library, filtered to the page;
    - library → set view → Edit → editor;
    - **Save returns you to where you came from,** with the set in use.
21. **Colours and icons:**
    - **Creators:** Default grey, Admissions cyan, SMT violet, [School group] orange, Victoria Consultancy rose, Me an outline. Use the existing `--row-featured-*` and product accents where they exist, in light and dark, with contrast checked.
    - **Kinds:** **bars** for Compared against, **streams joining** for Feeder schools. The icons are in the design files, and take the creator's colour.

### E. Tiers drive the views

22. **Main feeders** go to the top of the feeder health table and are drawn as larger dots on the feeder map. An **alert** shows when a main feeder's roll is falling, using the existing trend rules. Untiered counts as Regular.

### F. Small fixes and the 7 Nov feedback

23. **F-36 and F-20 full screens:** add the rivals' **average** back as one more line, dashed and labelled "Rivals' average", on both "You and the rivals" and "Entry age band roll".
24. **The intake view's (i):** the boarding sentences show **only for a school with boarders**, there and anywhere else they appear.
25. **F-40 and F-41 (Guy, 7 Nov), Rivals' momentum at 11+:** "this data panel needs to [act] when the compare list is largely IGCSE schools, maybe more than 40%"; "the IGCSE issue is only relevant for 11+; 16+ uses post-16 results". Read as follows, and log the reading:
    - **At 11+**, count the set's schools with no GCSE (KS4) results in the latest year, which for independents is mostly IGCSE entry.
    - **If that's over 40%**, the panel uses **post-16 results** instead of GCSE and says so in one line under the title: "Post-16 results: 6 of 10 rivals have no GCSE results (mostly IGCSE)".
    - **At 40% or below**, it stays on GCSE and names the schools it leaves out.
    - **At 16+**, nothing changes: it already uses post-16.

    This is the same rule as the editor's GCSE / Post-16 switch (C16), so the editor and the dashboard agree. Put the 40% threshold in one shared constant. A rule test, **R-ADM-MOMENTUM-IGCSE**, covers Leighton Park's 11+ default set and a state school's set.

### G. Mobile (Guy, 7 Nov): every new screen works on a phone

At phone width (the 358 px card the shell already uses, viewports from 360 to 430), each new surface has a designed phone layout, not a squeezed desktop one. Use the shell's existing phone patterns (tabs, bottom sheets, fullscreen) and the shared components; build no phone-only copies of logic.

26. **The selector:**
    - the label ("Compared against" or "Feeder schools") sits above the set button, which spans the width and truncates with the count kept visible;
    - the menu opens as a **bottom sheet**, with the same three blocks, a drag handle, and the actions pinned at the bottom;
    - the Pupils filter sits beside the entry point buttons.
27. **The editor:**
    - one column: the header (artwork shrinks to 72 px beside the name), then the list, then "how close";
    - **Save and Save as stay in a sticky bar at the bottom;**
    - rows show the name, distance and one secondary figure, with the tick on the left at a 44 px hit area; the other columns move into a row's expand chevron;
    - feeder tiers stay as the per-row button;
    - "Add schools" (feeders) and suggestions (compared-against) open as a **bottom sheet** from an "Add schools" button;
    - group headings stay, with Occasional and Untiered collapsed.
28. **The library:**
    - the sidebar becomes a **segmented control or tabs** (All, Default, School, Mine, Archived), with folders in a sheet;
    - search, then the kind and entry point filters, wrapping;
    - pinned sets as a **horizontal scroll of tiles**;
    - all sets as a **list of cards** (kind icon in the creator's colour, name, creator pill, count, last used), each with a "···" sheet.
29. **The set view:**
    - stacked: header, actions in a row (Edit as primary, the rest under "···"), the list, then "how close" and "where used" as collapsible sections.
30. **Panel headers naming the set** wrap onto a second line on a phone, never truncating the set's name.
31. **Rule test R-SETS-MOBILE:** at 390 px, the selector, menu sheet, editor (with the sticky bar), library and set view render without horizontal scroll. Every control has at least a 44 px hit area. The menu and add sheets open and close (Esc, the handle, and tapping outside).

Screenshots at 390 × 844, light and dark, for each surface, go in the report.

## Milestones (commit at each; stop cleanly where you must)

1. **Storage** (A1–A5): the migration, RLS, the conversion, PGlite tests, and a server library for sets (read, write, recipes resolved, permissions). Every old reader moves to it, with figures unchanged.
2. **The selector** (B6–B11) in Teacher, SMT and Admissions, plus the panel headers, Admissions' top bar simplified, and **its phone layout** (G26, G30).
3. **The editor** (C12–C17), the tiers in the views (E22), and **its phone layout** (G27).
4. **The library and set view** (D18–D21), the old `/sets` pages retired, and **their phone layouts** (G28, G29, G31).
5. **The small fixes and the 7 Nov feedback** (F23–F25).
6. **Stretch, only if all else is clean: "Add to set…"** from any school row in tables, maps and rankings. It shows a small list of your sets, adds the school, and has an "Open set" link.

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- **R-SETS-ONE-MODEL:** no `src` read of `saved_sets` or `admissions_lists` remains. The 6 Leighton Park rows convert exactly (members, rules, blend, entry points), and running the conversion twice changes nothing.
- **R-SETS-RLS:** a personal set is read by its owner only. A school set is read by every approved member at its school. Curators by kind: compared-against by SMT, Admissions and the School-Admin; feeders by Admissions. A teacher can't edit a school set. The cap of 8 counts active sets only.
- **R-SET-PILL:** one component everywhere. The label is outside the button; the menu has three blocks in fixed order, filtered to the page; the button truncates at a fixed width in Teacher's column; Teacher's grid widths are unchanged.
- **R-SET-DEFAULTS-ADMISSIONS:** Leighton Park at 11+ defaults to 10 nearest | independent, with the boarding set offered second. A top-two-fifths boarding school defaults to the boarding set. A day school has no boarding set. At 16+ the LA set is "All post-16 in [LA]".
- **R-SET-EDITOR-TICK:** untick and retick restores; save drops unticked schools; editing a set you can't change saves only as a copy.
- **R-SET-HOW-CLOSE:** the distance range and median are exact for a known set. The results switch starts on the measure with more coverage and says how many schools have each.
- **R-FEEDER-TIERS:** main feeders sort first and get the larger map dot; a falling main feeder raises the alert.
- **R-ADM-MOMENTUM-IGCSE** (F25) and **R-SETS-MOBILE** (G31), as above.
- **R-PANEL-NAMES-SET:** every panel on Admissions, SMT and Teacher Comparisons names its set.
- **The existing rules still pass.** Update R-ADM-VIEW-* and any rule naming `admissions_lists` or the setup steps. Log every rule retired or rewritten, with why.

## Ground rules

- **Branch `v0.8-sets-r1` from current `main`** (`8eb2fc9`), fetched over HTTPS. Commit this prompt and the design files first. Use worktrees for parallel parts if they help.
- **These must be clean at every milestone:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; every PGlite suite (run as their headers say; `view-as-pages.test.ts` with `--test-force-exit`); every parity harness.
- **Allowed differences:**
  - the selector, the panel headers naming sets, Admissions' top bar;
  - Rivals' momentum at 11+ where F25's rule switches it to post-16;
  - the editor, library and set view;
  - the tiers' effects;
  - F23 and F24;
  - Teacher's pill truncation.

  **Figures never change** for the same set of schools.
- **No database writes.** The migration is written and tested in PGlite, and Guy applies it. Give the migration's step 1 with the `schema_migrations` insert, per the template in `docs/FEEDBACK.md`.
- **Never put a server key in client code.** Stage files by name. Don't push or merge.
- **Log every call** under "2026-11-06: sets round 1" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/sets_round1_report_v1.md`. Include:
- how far you got, milestone by milestone, and anything left;
- the model, the RLS, the conversion of the 6 rows (before and after);
- screenshots, light and dark, desktop and phone (390 × 844):
  - the selector in Teacher, SMT and Admissions;
  - the menu;
  - the editor (rivals, and a 25+ feeder set);
  - the library and the set view;
- every rule added, rewritten or retired;
- tests and parity;
- **Guy's commands, in the template's order.** Step 6 sets **F-40 and F-41** fixed (`--view` for Rivals' momentum). Step 7 walks the route for Leighton Park (11+ and 16+) and for one day school and one state school.
