# VicData 0.6, snagging round 1: report

Branch `v0.6-snag1`, from `main` (3f93e52), pushed. **Not merged.**

| Commit | Item |
|---|---|
| `753f353` | 00: the Teacher page draws the published dashboard from the store |
| `30483a7` | 01: the Export menu opens above its button and is never cut off |
| `cdb2b3a` | 02: Compare against names the category |
| `6580750` | 03: editor, a menu for each view on its rail icon |
| `ddbc7fc` + this commit | OPEN_QUESTIONS entry, this report, screenshots |

On the final branch, `next build`, `tsc --noEmit` and eslint (every changed source file) are all clean. 100/100 tests pass: the published-config loader, the editor operations and the catalogue unit tests.

## 00 — published dashboards reach the Teacher page

- **What it draws:** under `?renderer=config` (or the env flag), `/teacher/ks4` and `/teacher/ks5` draw the **published** version of `vicdata.{phase}.{candidates|results}` from the dashboards store, never the draft. One loader does this: `src/lib/published-vicdata.ts`.
- **Fallback:** the copy in code is used, with a `[dashboards] … drawing the copy in code (reason)` console warning, whenever:
  - there's no row or no published version;
  - the `schema_version` is one the renderer can't read;
  - the config fails validation;
  - the tables are missing, or the load errors.
- **No flash:** both group dashboards (Candidates and Results) load once, alongside the school's data. The page waits for them before its first paint, so there's nothing to swap. The group switcher uses both.
- **Only the structure comes from the store.** Gating, the Results pill, the AS/AEA and minimum-count rules and per-school view availability all stay in the hosts and the lib.
- **What carries over:**
  - notes and open panels still resolve through stable IDs and legacy keys;
  - the "Updated — what's changed" line shows on the Teacher page, as on `/dashboards/[id]`;
  - the Edit link opens the same dashboard.
- **Renamed panels:** a panel renamed in the editor now shows its new name on the Teacher page. Before, the host's own tag always won.

**Checks** (headless harness, real data fixtures, stubbed store):
- **Flag-on parity:** with the store serving the **seeded** published versions, flag on is pixel-identical to flag off at 1280, 16/16. Every page read the store and logged no fallback warning.
- **(a) An edit reaches the page:** with Column 1 Current renamed "Renamed by Guy" in the published version, the heading reads "Renamed by Guy". Verification first caught a line that dropped the name; it's fixed and re-checked.
- **(b) Removing the version** makes the page fall back to the code copy, with the warning "vicdata.ks4.candidates: drawing the copy in code (no published version)".
- **(c) Flag off** never reads the store.
- **Unit tests:** 8 in `src/lib/published-vicdata.test.ts`.

## 01 — Export menu no longer cropped

- **The cause wasn't the one assumed.** `PanelMenu` opens *below* its anchor, so the Export menu ran down past the panel's bottom edge, which the fixed-height `CardBox` clips. A scaled meeting slide clipped it too.
- **The fix:** the menu opens **above** the button, drawn in a portal into `#teacher-root` at the button's own position (the pattern `CopyViewDialog` already uses), so nothing can clip it.
  - It's aligned to the button's **left**, like Notes. Export sits in the footer's left cluster, so `right-0` would have run off the panel's left edge. It flips right only near the screen edge.
  - It dismisses on outside click and Esc as before; scrolling closes it.
- **Checked:**
  - Column 1 and Column 3 at 1280 and 390, both themes, flag off and on;
  - inside a fullscreen modal;
  - in meeting slots inside scaled slides (scale 0.76 and 0.68, including the rightmost slot of a 3 × 2 slide).

  The menu was always fully visible and the top element; Esc, outside click and "Print this graph" work. On `main`, the same Column 3 menu is clipped (side by side below).

## 02 — Compare against names the category

- **Menu row and closed pill:** `Subject category` becomes `{category} subjects`, e.g. "Compare against: Languages & Literature subjects". With no focused subject or category it stays `Subject category`.
- **The category name** is the one the subject picker shows (`familyFor().label`). The existing `focusCategory` prop turned out to be the family id.
- **Long names:**
  - the closed pill truncates with an ellipsis on one line and carries the full text as its tooltip;
  - the menu is **320px**, not 264, because the longest real category row ("Technology, Engineering & Construction subjects", e.g. D & T at 117037) needs about 282px and was truncated at 264. 320 is the menu component's own cap.
- **Unchanged:** All subjects, Selected subjects, Edit selection, the ids, and saved preferences.

**"Subject category" strings:**

| Where | Changed? |
|---|---|
| ContextPills: menu row and closed pill | **Changed** to `{category} subjects` |
| Context's group label and phrase (panel tag, Trend and % change sentences, benchmark, donut): already the category name, "Subject category" / "its subject category" only as the no-focus fallback | Left |
| Editor column summary "Compared to: subject category" (`editor-ops.ts`) | Left: item 03 says nothing else in the editor this round |
| Data View copy ("Entries by subject category", map colouring) and code comments | Left: a different meaning |

**Flag-off parity against `main`:** 32 shots (2 schools × 2 phases × Candidates/Results × 1280/390 × 2 themes). The only difference anywhere is the Context pill's new wording. Three chart regions differed on a first run and were identical on rerun (timing).

## 03 — a menu for each view, on its rail icon

Built as specified, and nothing else in the editor changed:
- **Hover:** a rail icon turns amber (`EC.amberText` glyph, 1px `EC.amber` border) and shows a 14 × 14 amber `···` tab on its right edge ("View options").
- **Opening the menu:** click the tab, right-click the icon, or use the keyboard. The menu opens to the right, and the icon stays amber and active while it's open.
- **Touch:** the tab shows on the active icon.
- **The view menu:**
  - a heading with the resolved title, plus "Opens first" on the default;
  - rows: Edit this view…, Swap for another view…, Move to another panel…, Copy to another panel…, Copy to another dashboard or meeting… (disabled for placeholders), Make this the opening view, Move up / Move down;
  - then, after a divider, Remove this view in the danger colour. Removing the last view leaves an empty "+ Add a view" panel.
- **Every row goes through `apply()`,** so undo, redo and autosave are unchanged.
- **The panel `···` menu is now panel-only:** Rename panel, Change data / compared to…, Move panel, then a divider and Delete panel.
- **Tests:** 5 new in `editor-ops.test.ts`: edit in place keeps the position (and the id when the view is the same), the opening view, move up and down, removing the last view leaves an empty panel, and a placeholder edited in place.
- **Live dashboards:** item 03 touches no file they import, and the flag-off parity above shows only item 02's change.

## Screenshots (`docs/v0.6/snag1_screenshots/`)

- **00:** `sbs_4_dark.png` and `sbs_4_light.png`. Left to right: seeded; renamed (before the fix); renamed with the fix; version removed; flag off.
- **01:**
  - `sbs_5_c3_1280_dark.png`: main clipped vs fixed;
  - `5_c3_390_light.png`;
  - `5_fs_c3_1280_light.png` (fullscreen);
  - `5_meeting_s2right_dark.png` (rightmost slot, scaled slide).
- **02:** `sbs_6_1280_dark_open.png` and `sbs_6_390_light_open.png` (long and short category, closed and open).
- **03:**
  - `03-rail-icon-rest`, `03-rail-icon-hover`, `03-view-menu-open`, `03-view-menu-opening-view`, `03-panel-menu-after`, each in `-dark` and `-light`;
  - all at 1280, compared against the spec.

## Logged

`docs/OPEN_QUESTIONS.md`, "2026-10-04 — 0.6 snagging round 1". The main calls:
- **00:** wait rather than swap; the slug is kept as the config id; renamed panels shown. A *row* rename and a column the editor adds without a legacy key don't show on the Teacher page yet; `/dashboards/[id]` shows them.
- **01:** the real cause; left alignment; the portal; PanelMenu's look kept.
- **02:** the category name source; the 320px menu; the strings left alone.
- **03:**
  - ids are kept only for the same view;
  - the placeholder edit form;
  - the "Planned" tag;
  - "Save view" / "Swap in";
  - the 300px view menu, so "Copy to another dashboard or meeting…" fits;
  - the tab's focus and touch rules;
  - the additive chooser props.

## Click-through for Guy on the live site, after merging

0. In `/dashboards/vicdata.ks4.candidates/edit`, rename a panel and Publish. Check that `/teacher/ks4?renderer=config` shows the new name. Then restore the original version from History and Publish. This needs the S2 migration and seed applied.
1. Open a Column 3 panel's Export menu (the download icon in its footer) at desktop width. Then open one in a meeting slot (`/teacher/meetings`). Both should open above the button, uncropped.
2. Look at Context's Compare against pill, first for a subject in a long-named category (e.g. Design & Technology: "Technology, Engineering & Construction subjects"), then a short one. The pill should truncate with a tooltip, and the menu row should show whole.
3. In `/dashboards/vicdata.ks4.candidates/edit`, hover a rail icon (amber plus `···`), open its menu, and try each row, then Undo. Then check the panel `···` menu is panel-only.

### Merge (Guy)

```
git checkout main && git pull && git merge --no-ff v0.6-snag1 -m "0.6 snagging round 1" && npm run build && git push
```

Render deploys from `main`.
