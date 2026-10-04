# VicData 0.6, snagging round 1: Export menu, Compare-against wording, a menu for each view in the editor

Claude Code build prompt. Three small changes from Guy's first live test of 0.6. Make a branch `v0.6-snag1` from `main`, commit once per item (01, 02, 03), with tsc, eslint and `next build` clean on each. Push the branch. **Don't merge.** Guy merges after looking.

Ground rules as in 0.6:
- **Pixel-perfect:** reuse the existing components and tokens named below, and introduce no new colours.
- **Both themes.**
- **Log judgement calls** in `docs/OPEN_QUESTIONS.md` under a new "2026-10-04 — 0.6 snagging round 1" entry, and carry on.
- **The live (unflagged) dashboards may change only where an item says so.**

Guy's note on the editor: *"Editing the panel is very hard to understand at the moment. It just needs careful simplifying. Let's tackle one change at a time."* So item 03 is **one** change. Don't restyle or reorganise anything else in the editor this round, however tempting.

---

## 01 — Export menu is cropped by the panel edge

**What Guy sees:** the panel's Export menu (footer, `PanelExport` in `src/components/teacher/PanelFooter.tsx`) is clipped by the panel's edge. It should float above the button, as the Notes popover does.

**Likely cause** (confirm it, don't assume):
- Both popovers use the same `absolute bottom-6 left-0` anchor.
- Export sits at the right-hand end of the footer, so a 212 px menu anchored `left-0` runs past the panel's right edge.
- `CardBox` with `fixedHeight` is `overflow-hidden` (line ≈304), and that clips it.
- Notes sits on the left, so it fits.

**Fix:**
- The Export menu opens **above** the button and **aligned to the button's right edge** (`right-0`), so it grows inward over the panel.
- It is never clipped, in every place `PanelExport` is used:
  - `ColumnPanels` (live dashboards, flag on and off);
  - `/dashboards/[id]`;
  - the editor;
  - `meetings/SlideCanvas` (inside a scaled slide).
- If any of those still clips it (the scaled slide is the likely one), render the menu in a portal positioned from the button's rect, using whatever pattern the codebase already has for this. Don't add a library.

**Checks:**
- Same look as the Notes popover: border, radius, shadow, `PanelMenu` contents unchanged.
- Dismisses on outside click or Esc via `useDismiss`, as now.
- No clipping at 1280 and 390 wide, in both themes, on a Column 3 panel (rightmost) and in a meeting slot.

**Live site:** this changes the live dashboards. That's intended.

---

## 02 — Context's "Compare against" option 1 names the category

In Column 2 (Context), `ContextPills` (`src/components/teacher/ContextPills.tsx`) currently offers "Subject category". Change it to name the focused subject's actual category.

**Menu row label:**
- Before: `Subject category`
- After: `[category] subjects`, e.g. **`Arts, Media & Design subjects`**

**Pill value** (the closed pill reads `Compare against: …`):
- Use the same string, so the closed pill reads **`Compare against: Arts, Media & Design subjects`**.

**Details:**
- **Source:** `focusCategory`, already a prop. Use the category name exactly as the subject picker shows it. Don't re-case it or abbreviate it.
- **No focused subject or no category:** fall back to today's `Subject category`.
- **Long names:** `PillMenu` must stay on one line at 264 px menu width and at the pill's real width. If a long category overflows the pill, truncate it with an ellipsis and give the pill a `title` holding the full text. Leave the menu row's text whole.
- **Unchanged:** "All subjects", "Selected subjects", the "Edit selection" row, the ids (`category` / `whole` / `selected`) and saved preferences.
- **Other strings:** search for every other place that says "Subject category" for this same option (panel titles, change-list titles, trend summaries, chooser copy). Change any that label this option to match, and log the list. Don't change "Subject category" where it means something else (a column heading, the catalogue's focus kind).

**Live site:** this changes the live dashboards. That's intended.

---

## 03 — Editor: a menu for each view, on its rail icon

**What Guy wants, in his words:**
- *"The navigation in the rail works well in edit mode. When you click an icon the data view shows, which is good."*
- *"But I need a simple interface to edit, delete, move, or copy that data view to another panel."*
- *"The three dots in the top right of the panel edit the panel. I need something similar for the data view. Rolling over the icon in the rail, maybe?"*
- *"Also, maybe the icon turns yellow when rolled over, to show that edit options are being selected?"*

**Files:**
- `src/components/editor/EditorPanel.tsx`: `RailButton` and the panel's `···` menu;
- `src/components/editor/DashboardEditor.tsx`: the action handler and the slot dialog;
- `src/lib/editor-ops.ts`: `removeView`, `moveView`, `copyView` already exist.

This is a UI change. The operations already exist.

### The interaction

1. **Click a rail icon:** it shows that view, as now. Don't change this.
2. **Hover a rail icon** (edit mode only, not read-only or preview):
   - the icon turns **amber**: glyph colour `EC.amberText`, border `1px solid EC.amber`, the same 5 px radius and size as now. This is the editor's existing "you're editing" colour (the dashed panel outlines and the "+ Add a view" pill), so it adds no new colour;
   - a small **`···` tab** appears on the icon's right edge, half overlapping the rail divider:
     - 14 × 14, amber background (`EC.amber`), `EC.amberInk` dots, radius 4;
     - it has the tooltip "View options".
3. **Click the `···` tab** (or right-click the icon, or focus the icon and press Enter on the tab with the keyboard): the **view menu** opens.
   - It's a `PanelMenu`, anchored to the icon, opening to the right over the panel body.
   - While it's open, the icon stays amber and becomes the active view, so the person can see which view they're acting on.
4. **Keyboard:** Tab reaches each rail icon, and then its `···` tab. Esc closes the menu. Give it a sensible `aria-label` ("Options for [view title]").
5. **Touch or no hover:** the `···` tab shows on the **active** icon all the time.

### The view menu

It starts with a `MenuHeading` holding the view's resolved title, truncated with an ellipsis.

| Row | Action |
|---|---|
| **Edit this view…** | Opens the S4 chooser on **Customise** for this instance, pre-filled with its current choices. Saving replaces the instance in place: same position in the rail, and keep its instance id where you can, so per-user state survives (G1). For a placeholder, opens the placeholder's edit form instead. |
| **Swap for another view…** | Opens the chooser on **Pick**, pre-filled from this panel. The pick replaces this instance in place. |
| **Move to another panel…** | The existing slot dialog, `mode: "move-view"`. |
| **Copy to another panel…** | The existing slot dialog, `mode: "copy-view"`, on this dashboard. |
| **Copy to another dashboard or meeting…** | The existing `CopyViewDialog`. It's disabled, with today's reason as its tag, for placeholders. |
| **Make this the opening view** | Sets the panel's `defaultView` to this instance. It's hidden when this view already is the opening view, which shows a small "Opens first" tag in the heading instead. |
| **Move up** / **Move down** | Reorder in the rail; dragging stays as now. Hide whichever doesn't apply. |
| *(divider)* | |
| **Remove this view** | `EC.danger`, as "Delete panel" is styled. If it's the panel's last view, the panel becomes the empty "+ Add a view" state; the panel is never deleted. |

Every row goes through the existing `apply()`, so undo and redo and draft autosave work unchanged.

### Panel `···` menu becomes panel-only

Take the view rows out of the panel menu, so each menu is about one thing:
- **Removed from the panel menu:** "Move this view to another panel…", "Copy this view to a dashboard…" and "Remove this view".
- **Left:** Rename panel, Change data / compared to…, Move panel, then a divider and Delete panel.

### Not this round

- No other editor changes: the edit bar, row bands, headers, spans and dialogs stay as they are.
- Don't rename anything else.

Guy will review this one change live, and then the next simplification gets its own round.

### Checks

- **Screenshots** (headless, 1280, both themes) of:
  - a rail icon at rest;
  - a hovered icon (amber, with the `···` tab);
  - the menu open;
  - the panel menu after the change.

  Put them in `docs/v0.6/snag1_screenshots/`.
- **Unit tests** in `editor-ops.test.ts` for:
  - edit-in-place keeping the rail position (and the instance id where it's kept);
  - make-opening-view;
  - move up and down;
  - removing the last view leaving an empty panel.
- **The live dashboards don't change:** run the flag-off parity harness. Item 03 is editor-only, so the only expected differences are 01's and 02's.

---

## Finish

Write a short report, `docs/v0.6/snag1_report_v1.md`, with:
- what changed per item;
- the "Subject category" strings changed and left alone (item 02);
- the screenshots;
- anything logged;
- **a click-through for Guy on the live site after he merges:**
  1. a Column 3 panel's Export menu, and one in a meeting slot;
  2. Context's Compare against pill for a subject in a long-named category;
  3. in `/dashboards/vicdata.ks4.candidates/edit`: hover a rail icon, open its menu, try each row, then undo.

Then tell Guy the merge commands:

```
git checkout main && git pull && git merge --no-ff v0.6-snag1 -m "0.6 snagging round 1" && npm run build && git push
```

Render deploys from `main`.
