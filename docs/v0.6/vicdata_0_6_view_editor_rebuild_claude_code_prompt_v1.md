# VicData 0.6.1 — View editor rebuild: Data → View → Preview (single pass)

Claude Code build prompt. One continuous pass: work through the stages in order, committing after each, and keep going without waiting for Guy. It replaces the 0.6 "Add a view" chooser and Customise with a simpler model and flow, worked out with Guy on 4 Oct 2026 after editing on live showed the old model doesn't work.

The plan was reviewed against the code before writing. The findings are built in below, marked **[review]**.

## Read first

1. `docs/v0.6/vicdata_0_6_editor_review_pinch_points_v1.md`: the pinch points found on live, and the decisions.
2. `docs/wireframes/v0.6/`, the new boards. **They are the spec for anything visual, and the board wins over prose.**
   - **Add a view:** `AddView1` (1 · Data), `AddView2` (2 · View), `AddView3` (3 · Preview);
   - **View variants:** `AddView2Table`, `AddView2Rank`, `AddView2Bar`, `AddView2Spread`;
   - **Edit:** `EditView`, `RailMenu`, `EditWide` (desktop).
3. The current code, especially:
   - `src/components/dashboard-config/` (`rail.tsx`, `plan.ts`, `embed.ts`, `TeacherDashboard.tsx`);
   - the host panels (`SubjectPanels`, `ComparisonsPanels`, `CandidatesPanels`, `GradeCountsPanels`);
   - `src/catalogue/` (`measures.ts` geographies and gaps, `rules.ts`, `dataviews.ts`);
   - `src/lib/published-vicdata.ts`;
   - `src/catalogue/config.ts`.

## The rule everything follows

- **1 · Data decides the numbers:**
  - what is measured;
  - one value per **year / subject / grade / school**;
  - shown as **actual / indexed / change**;
  - which years;
  - what it's **compared with**: lines or markers, and averages of things *not drawn*.
- **2 · View decides only how they're drawn:**
  - the view, from the tiles: Line graph · Bar chart · Table · Ranking · Numbers · Grade spread · Slope · Donut · Map;
  - look-only options, including an average **of what is drawn** (bars, grade spread).
  - **A View choice can never change a figure.**
- **3 · Preview:**
  - a live preview at the real panel unit;
  - **"Show this view for"**: a tick per Results measure, each with a mini preview; any measure it can't honestly draw is greyed, with the reason;
  - rail icon;
  - title with placeholders.
- **Edit is the same three steps as tabs** (`1 · Data | 2 · View | 3 · Preview`), opening on Preview, with Cancel / Save. There's no Remove in Edit: removal lives in the rail menu.
- **The word is "View" everywhere,** never "kind of view".

## Ground rules

- **Branch `v0.6.1-views` from `main`.**
- **Commit per stage,** with tsc, eslint, `next build` and all tests clean on each.
- **Tests:**
  - unit tests: `npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`;
  - rule tests: `npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`;
  - parity: the round-4 headless pixel-pair harness (`docs/v0.6/audit_scripts/`).
- **Log judgement calls** in `docs/OPEN_QUESTIONS.md` under "2026-10-04 — 0.6.1 view editor rebuild", and carry on.
- **Pixel-perfect to the boards:**
  - reuse `PillMenu`, `PanelMenu`, `TeacherModal`, `CardBox`, the real tokens and the **real `PanelIcons` glyphs** on the View tiles (the same icon the view later shows in the rail);
  - both themes, built from the theme variables (the boards are drawn light).
- **The new renderer goes behind a switch until it reaches parity:** `?views=v2` and/or `NEXT_PUBLIC_VIEWS=v2`. With it off, members' pages are exactly as today.
  - **The only deliberate changes to members' pages are D3/D4** (the top bar). They go in their own commit, so parity can be checked on either side of it.
- **Database changes:** write them as migrations, test them on PGlite, and leave them for Guy, with the apply commands in the report.
- **Don't merge.** Push the branch.
- **Stop only for:**
  - an RLS change touching existing data;
  - a destructive migration;
  - a figure changing on a members' page that this prompt doesn't name.

## Decisions (taken, don't re-ask)

- **D1 · Comparison is a setting on the view, not part of what it is.** [review]
  - Today the comparisons are baked into the **host panels**, and config dashboards only filter each host's own rail buttons (`rail.tsx` `dataviewForRail`). That's why a "school only" view can never appear.
  - The leaf charts already take data as props: `TrendChart`, `MultiTrend`, `YearTable`, `ChangeList`, `ViewChart`, `SchoolRankingTable`, `NumberTiles`, the grade distribution.
  - **The job:** build a **config-driven panel renderer**, ViewSpec → series builder → leaf component, beside the hosts, one view type at a time. Then retire `rail.tsx` filtering for v2.
  - The column and panel "compared to" layers stop driving views: a column becomes a heading only, and "inherits column" / "overridden" go from the editor.
- **D1a · `compare: follows-page`.** [review] What drives members' comparisons today is their own settings: Context's Compare-against pill (`againstKey("context")`) and Comparisons' set chooser (`setKey("rankings")`). A ViewSpec can say **follows the page**, so those controls keep working. That's the default for every translated preset.
- **D2 · Four Results measures stay:** Average points, Grade 4+ (A*–E at Post-16), Grade bands, Grade counts.
- **D3 · The grade band choice moves to the dashboard's top bar,** beside the Results switch, for members and the editor alike.
  - **[review] It follows the focused subject's own scale:** at GCSE 9–1 the presets are "4–9" and "7–9", plus Custom; Post-16 and other named scales have no presets, so Custom only (`bandRangeFor`, `subject-grades.ts`).
  - Custom opens an in-place range picker (from grade ▾ to grade ▾).
  - **Keep the saved-setting keys** (`band:range`, `measure:results`), so members' choices carry over.
  - The top-bar control **never shows inside an embed** (meeting slots and previews set these through `embed.ts`).
  - The in-panel band row and the "Grades (pick a range)" view go, mapped to the top bar.
- **D4 · The members' Results switch moves to the top bar** too, so it's visible (pinch point 12).
- **D5 · Rankings stay as today.** One shared ranking component is deferred.
- **D6 · Other schools' data (Comparisons):** step 1 shows **Schools: follows the page ▾ / 10 nearest / saved set / sector…** in place of the lines list, in the style of `AddView1`. Log the layout; there's no board for it.
- **D7 · The honest options come from the catalogue, never from examples.** [review]

  Build the greying from `measures.ts` (`geographies`, `gaps`) and `rules.ts`. The data available today:

  | Measure | Self | Category / all / selected | LA / region / England | 10 nearest / saved set |
  |---|---|---|---|---|
  | Points | yes | yes | yes | yes |
  | Grade 4+ / A*–E | yes | yes | not wired (`R-NO-GRADE-RATE-GEO`), so greyed | yes |
  | Bands | yes | yes | England for the focused subject, latest year (`R-BANDS-ENGLAND-BENCH`); 5-school minimum | yes |
  | Counts | yes | no | England ticks only | none |
  | Entries | yes | yes | points-eligible only; scored qualifications only at Post-16 | yes |

  - At Post-16, `R-KS5-ASAEA-EXCL` applies, and the qualification family gating holds.
  - Donut: entries, and bands with a range (`shareApplies`).
  - Map: needs a school set.
- **D8 · School grade years:** school grade rows cover **2023/24–2024/25 only** (the 4-year `academic_subject_grade_rollup` isn't read). So school-only trends on Grade 4+ / bands draw as **2-year bars** (`R-TREND-LINE-4YR`); points draw as a line. **Don't read the rollup in this pass.** It's the next round once this is approved.
- **D9 · Existing edits can be discarded.** Guy has reset the VicData dashboards to the v1 seed and has no members.
  - **Don't build upgrade-on-read for VicData dashboards.** Bump `schema_version`, and provide a **re-seed** (SQL from `scripts/dashboards-seed-sql.ts`) that publishes the four Teacher dashboards in the new format, for Guy to apply.
  - **Two things must still load:**
    - `published-vicdata.ts` falls back to the code copy for any other version, so make sure the code copy is the new format;
    - Guy's test meeting **"Autumn department meeting" stays as it is**, including its text-box slide. Meetings (`kind: "presentation"`) and custom dashboards must keep loading: convert them on read, or keep reading v1 for them, and log which.
- **D10 · Per-user state survives.** [review]
  - **Keep each instance's id.** Add `preset` (the old dataview id) to each ViewSpec, and build `panelSignature` from the preset, so `carryUserState` doesn't drop members' open rows and chosen views.
  - **Look up params by instance id, not (column, dataview)** (`plan.ts` `usePlanViewParams`), so two views on the same renderer don't share Figures.
  - Notes are keyed per panel and are unaffected.
- **D11 · Out of scope:**
  - scatter;
  - small multiples;
  - merging bands and counts;
  - copying from real dashboards;
  - reading the grade rollup;
  - re-mapping the old meeting slot.

## Stages (in order, one commit or more each, continuing through)

### S1 — Bugs from live

- **Pinch point 1:** "Updated — what's changed" shows raw placeholders and internal view names. Resolve them, and use member-facing names.
- **Pinch point 2:** a removed view keeps drawing.
  - Cause **[review]:** `rail.tsx` `offRailEntry` returns null when the open view isn't in the config at all.
  - Fix: fall back to the panel default, and never draw a view that isn't in the config.
- **Pinch point 2b:** the editor preview refreshes immediately after a removal.
- **Pinch point 3:** make the titles distinct; "History against the wider system" appears twice.
- **Pinch point 4:** the Move/Copy-to-panel map highlights the view's current cell in amber (`EC.amber`).

### S2 — ViewSpec model and presets (no visible change)

```
data:     { source, subject: follows | fixed, per: year|subject|grade|school,
            rows?: follows-page | category|all|selected | <school set>,
            shownAs: actual|indexed|change, years: { latest } | { from, rollOn } }
compare:  "follows-page" | [ { kind: self|category|allSubjects|selectedSubjects|la|region|england|
                                     nearest|savedSet|chosenSchool|otherSubject,
                               colour, average?: mean|median|weighted } ]
view:     { kind: line|bar|table|ranking|numbers|spread|slope|donut|map, look: {…per kind} }
resultsMeasures, icon, title, preset
```

1. **First, write the translation table.** Map every dataview in `dataviews.ts` to a ViewSpec preset, in `docs/v0.6/views_preset_table.md`.
   - **[review] Known awkward cases:**
     - geography views (their own fetch, `useSubjectGeography`);
     - "Grades (pick a range)", which D3 retires;
     - the `DV-C1-CNT-*` grade-count views (fixed to England, with span highlight);
     - the change map and trend map (change plus school set plus colour mode);
     - Context's donut, bars and lists (follow the pill);
     - Comparisons' tiles (ranking set only);
     - Candidates' ranked change, which is still a draft.
   - **If a view needs a field the ViewSpec doesn't have, extend the ViewSpec, log it, and carry on.**
2. **Then:**
   - write the four Teacher dashboards' code copy in the new format;
   - bump `schema_version`;
   - write the re-seed;
   - implement D10.

### S3 — The config-driven renderer (behind `views=v2`)

- **Build the series builder** (ViewSpec → data from the existing routes and fetchers) and the panel renderer, one view type at a time:
  1. line, table, bar;
  2. ranking, numbers (with round 3's Figures), slope;
  3. donut, map, trend map, change map, geography views;
  4. Grade counts and the grade spread, last.
- **Look options:**
  - **Line:** trend line, end labels, axis from zero.
  - **Bar:** order, average line of the bars shown (mean / median / weighted), top 10 with this subject always shown, highlight, values.
  - **Table:** year columns, extra columns (change, rank, n), sort, highlight, colour the change, members re-sort.
  - **Ranking:** columns, show top 5 / all / around this school, always show this school.
  - **Grade spread:** % or counts, average grade marker, shade a band, values.
- **Parity after each view type:** `views=v2` against off, identical for every preset.
  - **Dashboards:** all four Teacher dashboards.
  - **Settings:** every Results measure and Compare-against set.
  - **Schools:** 100053 GCSE and 117037 Post-16.
  - **Widths and themes:** 1280 and 390, both themes.
- **"History, this school only"** must draw: a line on points, 2-year bars on Grade 4+ and bands (D8).

### S4 — The Add a view and Edit view screens

- **Phone width:** `AddView1–3` exactly. On step 1:
  - the lines list with ✕ and colour swatches;
  - **+ Add a place or a school**;
  - **☐ Add an average**, which opens to At this school / Across schools, then mean / median / weighted.
- **Step 2:** the tiles, then that view's look box with the dashed "comes from 1 · Data" note, using the Table / Ranking / Bar / Spread variants.
- **Step 3:** as described in "The rule everything follows".
- **Edit view:** the tabs (`EditView`; the View tab as `AddView2Bar`), opening on Preview.
  - A yellow "N changes · Undo" line.
  - The footer reads "Edits stay in your draft until you Publish", then Cancel / Save.
- **Desktop (`EditWide`):**
  - the preview at the real panel unit on the left, with a school ▾ and a measure ▾;
  - the tabs on the right;
  - no scrolling at 1280 × 800.
- **Placeholders:** only from step 2's quiet "Something else? Plan it" link.
- **Retire** Ch3Pick / Ch3Adjust / Ch3Empty / Steps 1–2 for adding views, and log what's kept for New dashboard.
- **The editor previews always render v2.**

### S5 — The rail menu and the top bar

- **The `RailMenu` board exactly:**
  - "Shows for" ticks;
  - ✓ Default / Make this the default for [measure];
  - Edit view…;
  - Move up / down;
  - Move or copy to another panel…;
  - Copy to a dashboard or meeting…;
  - Take off [measure];
  - **Remove everywhere** (red).
- **Top bar (D3 and D4):** **in its own commit, the deliberate change to members' pages.**
  - Use the same control in the editor; remove the editor's separate pills.
  - Parity: before this commit, identical; after it, only the top bar and the removed in-panel band row differ. Report both.

### S6 — Switch on, check and report

1. **Make v2 the default once parity holds,** keeping `?views=v1` as an escape hatch.
2. **Headless walk-throughs**, the tasks Guy failed on live, at The Chase (137625), GCSE History:
   1. Add "History grade trend, school only" on Grade bands, in Column 1 Trends.
   2. Take the "against the wider system" graph off Grade bands only.
   3. Add a change-in-points bar chart on Average points, with an average line.
   4. Add a grade spread with an average grade marker on Grade counts.
   5. Edit a view's title, publish, and see it with Edit off.
   6. Set a grade band to Custom 9–5 from the top bar.
3. **Screenshots** of every screen against its board, in both themes, in `docs/v0.6/views_rebuild_screenshots/`.
4. **Report:** `docs/v0.6/views_rebuild_report_v1.md`, with:
   - parity per stage;
   - the preset table;
   - what was retired;
   - the re-seed and any migrations, with apply commands;
   - logged calls;
   - a click-through keyed to the board names.

**If time runs out:** stop after a clean stage, push, and say exactly where it stopped. The next run continues from there.
