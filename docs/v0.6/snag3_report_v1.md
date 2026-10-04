# VicData 0.6, snagging round 3: report

Branch `v0.6-snag3`, from `main` (102d426), **merged into `main` and pushed**. No database migration was needed: everything is config JSON and code.

| Commit | Item |
|---|---|
| `3f37f27` | 01: the number tiles' small figures are editable |
| `0506be8` | 02: "Make this the default view" in the rail icon menu, always shown |
| `e0587ee` | 03: the editor follows the Results pill, so each measure's views are edited separately |

**Checks on the final branch:** tsc, eslint (every changed file) and `next build` are clean, and all 171 tests pass.

## Members' pages: parity

These were measured with the renderer on, as production now runs it, against `main` at 102d426, with the stub serving the seeded published versions. Each pair was pixel-identical:
- **after 01:** 100053 GCSE and 117037 Post-16, Candidates and Results, light and dark: 8 pairs;
- **after 03:** the same two schools in all **four** Results pill states, light and dark: 16 combinations. Each was shot with the Current panels open and again with every Trends panel open (32 pairs), with rail labels, active views and disabled buttons compared. Switching the pill live on the page gives the same rails as `main`.

Charts that measured themselves before layout settled were re-shot and matched, as in earlier rounds.

## 01 — the number tiles' small figures

**What I found about the "editable" big number:** nothing could be edited on the panel itself.
- **Customise saved but nobody read it.** It saved Numbers / Years / Look / Title choices on the view instance, but no panel host read them when drawing.
- **So the big number only looked editable:** its Numbers chip changed the Customise sketch, never the tile on the page or the editor's live preview.
- **That's why the new controls live in Customise** (Edit this view…). There was no in-place pattern to match.

**Now:**
- **A Figures box in Customise** for the three tiles views (DV-C1-CAND-CUR-TILES, DV-C1-RES-CUR-TILES, DV-C3-CUR-TILES). It shows the main figure first (its label can be edited), then each small tile:
  - choose its figure, from the honest ones the host already builds;
  - edit its label, with placeholder chips (subject, category, school, year, plus `[total]`, `[from-year]`, `[range]`, `[direction]`);
  - show or hide it, move it up or down, or drag it;
  - remove it, or add it back.

  A one-line note says a figure that doesn't exist for a school or subject is left out, as today.
- **Storage:** the settings are kept on the view instance (`params.tiles`, `params.mainLabel`), so they publish to every school. When nothing is set, the tiles are exactly today's.
- **The panel hosts now apply the settings,** and the editor's live preview shows them.
- **Tests:** 9 (round trip, hidden not drawn, reorder, relabel, unset gives today's tiles exactly, and more).

## 02 — "Make this the default view"

- **The row** is renamed **Make this the default view** and is always shown. On the default view it's ticked and disabled as **Default view ✓**.
- **The heading tag** reads **Default**.
- **The rail marker:** the default view's rail icon carries a 4 px amber dot (`EC.amber`), in edit mode only.
- **On Results dashboards** the row reads **Make this the default for {pill}**, and the tick, tag and dot follow the current pill (item 03).

## 03 — the editor follows the Results pill

**Which measures each view is for**, derived from main's live rails at each pill state:

| Dataview | Results measures |
|---|---|
| DV-C1-RES-CUR-TILES, -CUR-BAR, -CUR-TABLE, -TR-CHART, -TR-TABLE, -TR-MAP, -TR-GEO-CHART, -TR-GEO-TABLE | Average points, Grade 4+ / A*–E, Grade bands |
| DV-C1-RES-CUR-GRADES | Grade bands |
| DV-C1-CNT-CUR-DIST, -TR-SPREAD, -TR-CHANGETABLE | Grade counts |
| Every Context (C2) and Comparisons (C3) view, every Candidates view | All four (left unset) |

These stay host rules on top: the Context donut is disabled except on bands with a range (R-DONUT-COUNTS-ONLY); Comparisons' Chart appears only when the data allows; and Grades needs the bands range.

**What it adds:**
- **Model:**
  - optional `resultsMeasures` on dataviews (the defaults above), plus a per-instance override;
  - per-measure defaults (`defaultViewByResults`).
  The page obeys them. `schema_version` stays 1, and configs without the new fields behave exactly as before.
- **Editor:**
  - a **Results pill** (the page's own pill component and labels), opening on the page's current pill;
  - rails and live previews filter by it;
  - **Show all views** dims off-measure views to 40%, and their menus still work;
  - adding a view under a pill tags it, and Pick ranks that measure's views first;
  - **Show on…** in the rail icon menu, a checklist of the four measures. Measures a view can't draw are dotted ("Can't draw"). Unticking the current pill's measure removes the view from the rail, with an Undo toast;
  - move, copy and swap keep the measures, and a copy to another dashboard or meeting drops them;
  - History's change summary names the measure ("Grade counts: removed Spread by year from Results · Trends").
- **The walk-through** (headless, 100053 GCSE Results):
  1. The editor opened on Grade counts.
  2. In Column 1 Trends, Change table was made the default and Spread by year removed.
  3. Average points' rail was unchanged.
  4. After publishing, the Teacher page showed the change on Grade counts only.
  5. Restoring version 1 put everything back.
- **Tests:** 8 new (02's, plus 7 for effective measures, filtered rail order, per-measure defaults with fallback, tagging under a pill, old configs giving today's rails, keeping measures on move/copy/swap, and the summary wording).

## Screenshots (`docs/v0.6/snag3_screenshots/`, light and dark)

- **01:**
  - `01-figures-box-default`, `01-figures-box-hidden-relabelled`;
  - `01-panel-candidates-before/after`, `01-panel-results-before/after`: one tile hidden, another relabelled.
- **02:** `02-menu-default`, `02-menu-nondefault`.
- **03:**
  - `03-editor-points`, `03-editor-counts`;
  - `03-show-all`, `03-show-all-c1` (dimmed icons);
  - `03-menu-counts`, `03-show-on-c1`, `03-show-on-c2`;
  - `03-toast-undo`.

## Logged

`docs/OPEN_QUESTIONS.md`, "2026-10-04 — 0.6 snagging round 3":
- **01:** the "editable" finding; the main figure stays fixed, with only its label editable; the extra placeholders; one Results list across measures; editing forks to a custom view.
- **03:**
  - "Show on…" can't add a measure the view can't draw;
  - adding under a pill tags that measure only;
  - where the pill sits;
  - per-measure defaults leave `defaultView` alone, and fall back to it;
  - "Show on…" can't untick the last measure;
  - the page keeps your view choice across pills when no per-measure default is set;
  - the summary wording.

## Click-through for Guy on live

Wait for Render's **"Deploy live"** first.

1. **`/teacher/ks4`, footer Edit switch on, Results:**
   - the editor's **Results** pill opens on the page's pill;
   - switch it to **Grade counts**: each rail shows only the Grade counts views;
   - try **Show all views** (dimmed icons).
2. **On a rail icon's `···` menu:**
   - **Make this the default for Grade counts**: an amber dot appears on that icon;
   - **Show on…**: untick a measure and see the Undo toast.
3. **Edit this view…** on Column 1's number tiles (Current):
   - in **Figures**, hide one small tile and relabel another;
   - check the live preview, then Publish, then turn Edit off: the page shows it.
4. **Restore the original version from History** and publish again, to put the live dashboard back.
