# VicData 0.6, snagging round 3: the tiles view's small numbers, "Make this the default view", the Results pill in the editor

Claude Code build prompt. Three fixes from Guy editing the live GCSE dashboards.

**This round goes all the way through to live, as Guy asked:**
1. Make a branch `v0.6-snag3` from `main`, one commit per item (01, 02, 03), with tsc, eslint, `next build` and all tests clean on each.
2. When all three pass the checks below, **merge into `main` and push**. Render deploys from `main`, and there are no members yet.
3. If anything would need a database migration, **stop before merging** and leave it for Guy to apply, as before. None should be needed: everything here is config JSON and code.

Ground rules as in 0.6:
- **Pixel-perfect:** reuse the existing components and tokens.
- **Both themes.**
- **Log judgement calls** under "2026-10-04 — 0.6 snagging round 3" in `docs/OPEN_QUESTIONS.md`, and carry on.
- **Members' pages must not change** apart from what an item says. Run the parity harness (16/16 with the renderer on, and the published versions identical to the built-in copy) before merging.

**The renderer setting is now on in production:** `NEXT_PUBLIC_DASHBOARD_RENDERER=config` is set in Render. The Teacher page is drawn from the published config for everyone, so parity means "identical to before this round".

---

## 01 — Number tiles: the small figures can be edited, as the large one can

**Guy:** *"In the numerical view, the large number is editable. At the moment there's no way to edit the small numbers beneath."*

The view is `NumberTiles` (`src/components/teacher/NumberTiles.tsx`):
- **Column 1 Current:** `DV-C1-CAND-CUR-TILES`, `DV-C1-RES-CUR-TILES`.
- **Column 3:** `DV-C3-CUR-TILES`.

There's one main figure, then a row of small tiles: rank, England average, gap, change and so on.

**First find what "editable" means for the main figure today** in the editor and the chooser's Customise for these views: what can be changed, where it's stored in the view instance, and how it's drawn. Report it in one paragraph.

**Then give each small tile the same, and a little more:**
- **Choose its figure:** from the figures the host can produce for that view (the same list it builds today). Only offer figures that are honest for the measure (catalogue rules, e.g. no % change on points).
- **Edit its label:** the scope line underneath. Allow the existing title placeholder chips where they apply (subject, category, school, year).
- **Show or hide it.**
- **Reorder it**, by drag or by up/down.
- **Add** one of the figures not yet shown, or **remove** one.

**Where you do it:**
- **Customise** (Edit this view…, opened from the rail icon menu) gets a "Figures" box for these views. It sits beside Numbers / Years / Look and uses the same filter-box pattern: the main figure first, then the small tiles as a list.
- If the main figure is also edited in place on the panel, small tiles are edited in place the same way. One interaction pattern for both.

**Storage:** the choices are saved on the **view instance** in the dashboard config, so they publish to every school. When nothing is set, the tiles are exactly as today.

**Every school, every subject:** a tile whose figure doesn't exist for a school or subject is dropped, as today (e.g. the rank tile needs more than 1 subject in the category). Customise says so in a one-line note.

**Checks:**
- Unit tests:
  - a tile config round-trips;
  - a hidden tile is not drawn;
  - reordering;
  - unset gives today's tiles exactly.
- Screenshots of the Figures box, and of the panel before and after hiding one tile and relabelling another.

---

## 02 — "Make this the default view" in the rail icon menu

**Guy:** *"Editing a data view (from its rail icon) needs a 'make default view' option."*

It exists as "Make this the opening view", but it's **hidden when the view already opens first**, and the wording doesn't say "default".

- **Rename the row** to **Make this the default view**.
- **Always show it:**
  - when this view already is the default, it shows **ticked and disabled** as **Default view ✓**;
  - the "Opens first" tag in the heading becomes **Default**.
- **With item 03**, the default is per Results measure on Results dashboards, so the row reads **Make this the default for Grade counts** (with the current pill's label), and the tick and tag follow the current pill.
- **Rail marker:** the rail icon of the default view gets a small marker visible in edit mode only: a 4 px amber dot, bottom-right, using `EC.amber`. That way Guy can see the default without opening the menu.

**Checks:** a unit test that it sets `defaultView`, and screenshots of the menu on a default view and on a non-default view.

---

## 03 — The editor follows the Results pill, so each measure's views can be edited separately

**Guy:** *"When I edit a panel in GCSE Results it shows every data view in the panel, not the set for the current grade view. I need it to filter, so I can edit the data views for Grade counts separately from Average points."*

**The problem today:**
- The Results dashboards list every view of all four Results measures in one panel (`src/catalogue/dashboards/teacher.ts`, e.g. `c1.results` holds the TILES/GRADES/BAR/TABLE views *and* `DV-C1-CNT-*`).
- The host decides from the pill which views a member actually sees. The pill offers `points` | `threshold` | `bands` | `counts`: Average points, Grade 4+ / A*–E rate, Grade bands, Grade counts.
- The editor doesn't know about the pill, so it shows the lot.

### Model: which Results measures a view is for

- **Default, on each dataview:** a dataview in `src/catalogue/dataviews.ts` gets an optional `resultsMeasures?: ResultsMeasure[]`, saying which pill states it's offered on. It's absent for "all", and absent on non-Results views.
  - **Derive the values from what the host does today**, so nothing a member sees changes. Read the host code (`SubjectPanels`, `GradeCountsPanels`, `ComparisonsPanels`, the rail-subset code) rather than guessing.
  - Log the full table: dataview → measures.
  - Where the host shows a view but **disabled** on some measures (e.g. the Context donut on points and rates, R-DONUT-COUNTS-ONLY), keep that as host behaviour. It's a rule, not a tag.
- **Override, on the view instance:** an optional `resultsMeasures` on the instance overrides its dataview's default. This lets Guy show a view on more or fewer measures, though never on a measure the dataview can't draw.
- **Default view per measure:** the panel gets an optional `defaultViewByResults?: Partial<Record<ResultsMeasure, instanceId>>`. When a measure has no entry, it falls back to today's behaviour.
- **The host obeys the config:** on Results dashboards, the rail shows the instances whose effective measures include the current pill, in config order. It opens on that measure's default. Host rules (gating, honest number types, R-DONUT-COUNTS-ONLY) still apply on top.
- **No data migration:** configs without the new fields behave exactly as now, because the defaults come from the catalogue. Bump `schema_version` only if the loader needs it, and keep reading older versions.

### The editor

- **A Results pill on Results dashboards:** it sits in the edit bar's context area, beside the live-preview school. It's the **same `PillMenu` component and labels as the page's Results pill**: *Results: Average points ▾*.
- **It opens on the page's current pill** when the editor is opened in place (round 2's switch), or on Average points otherwise.
- **Rails filter by the pill:** with *Grade counts* picked, every panel's rail shows only the Grade counts views, and the live previews draw Grade counts. Switching the pill re-filters at once. Undo history is kept.
- **Dimmed views:** a "Show all views" toggle beside the pill (off by default) shows every instance in the rail. Views not on the current measure are **dimmed to 40% opacity** and their menu still works, so Guy can see the whole set when he wants to.
- **Adding a view** while on *Grade counts* tags the new instance `["counts"]`, unless its dataview's default already covers it. The chooser's Pick list ranks views that draw Grade counts first.
- **The rail icon menu** (round 1) gets one more row on Results dashboards: **Show on…**. It opens a small checklist of the four measures, ticked for this view's effective measures, and writes the instance override. Measures the dataview can't draw are dotted and can't be picked. Unticking the current pill's measure makes the view leave the filtered rail; it says so in a one-line toast with **Undo**.
- **Move, copy and swap** keep the instance's measures. A copy to a non-Results dashboard drops them.
- **History compare** (the change summary) mentions measure changes in plain words: "Grade counts: added Trend table to Column 1 Trends".

### Checks

- **Unit tests:**
  - effective measures (dataview default vs instance override);
  - the filtered rail order;
  - the default per measure, with fallback;
  - adding under a pill tags the new instance;
  - a config without the new fields gives today's rails.
- **Parity:** for each of the four pill states, at Acland Burghley (100053) GCSE and The King's School Worcester (117037) Post-16, the members' rails, opening views and panels are identical to before this round. That's 16 combinations, at 1280, in both themes.
- **Editor walk-through (headless):**
  1. In GCSE Results with the pill on *Grade counts*, remove a view from Column 1 Trends and make another the default, then switch to *Average points*: that rail is unchanged.
  2. Publish, and on the Teacher page *Grade counts* shows the change while *Average points* doesn't.
  3. Restore the original version afterwards.
- **Screenshots:**
  - the editor with the pill on *Average points* and on *Grade counts*;
  - "Show all views" with the dimmed icons;
  - the Show on… checklist.

---

## Finish

1. Write `docs/v0.6/snag3_report_v1.md`, with:
   - item 01's finding;
   - the dataview → Results measures table;
   - what changed per item;
   - screenshots in `docs/v0.6/snag3_screenshots/`;
   - logged calls;
   - the parity result;
   - a short click-through for Guy on live.
2. Merge and push:
   ```
   git checkout main && git pull && git merge --no-ff v0.6-snag3 -m "0.6 snagging round 3" && npm run build && git push
   ```
3. Tell Guy it's on its way to live, and that he should wait for Render's "Deploy live" before testing.
