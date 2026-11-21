# Panel menu: Save as CSV, and one menu everywhere (v1)

Guy, 21 Nov 2026. Branch `panel-menu-csv`, based on origin/main. Rules: R-PANEL-CSV-FILE, R-PANEL-CSV-ROWS,
R-PANEL-CSV-SUPPRESSED, R-PANEL-MENU-ORDER (docs/catalogue/rules.md).

## 1. The menu, everywhere

Every panel's ··· menu is the one `PanelExport` (src/components/shell/PanelFooter.tsx). Its rows, in this
order, on every panel in every product:

1. **Copy to a dashboard…**
2. **Copy to a meeting…**
3. **Print or save as PDF** (was "Print this graph"; the same print: the panel's full screen, printed alone)
4. **Save as CSV**

Then a divider and the product's own extras (Admissions: "Edit the feeder lists", "Edit the rivals").

A row that can't act on a panel is **left out, never shown disabled**:

| Where | Copy to a dashboard… | Copy to a meeting… | Print or save as PDF | Save as CSV |
|---|---|---|---|---|
| Custom dashboards (/dashboards, the editor), Teacher under a dashboard plan | yes | yes | yes | where the view has rows |
| SMT, Admissions (own sign-in) | no (a custom dashboard draws Teacher's hosts) | yes | yes | where the view has rows |
| An Admissions view on a custom dashboard | no | yes | yes | where the view has rows |
| View as, peek, head office, group dashboards, meeting slides | no | no | yes | where the view has rows |
| Live hand-coded Teacher dashboards with no copy source | no | no | yes | where the view has rows |

**The split.** "Copy this view…" is now two rows. Both open the existing `CopyViewDialog` unchanged, preset to that
tab by a new optional `startOn` prop (`"dashboard" | "meeting"`); the dialog still has its own segmented switch, so
nothing about it is lost. A host that copies to meetings only (SMT, Admissions; `meetingOnly`) gets only "Copy to a
meeting…". The split was low-risk because the dialog already kept its tab in state; only its first value changed.

**Gone:** the two disabled "Coming soon" rows ("Copy to custom dashboard", "Copy to a presentation"), Admissions'
"Print this view" and "Copy to meeting slides…" (`copyActions` in admissions/export.ts was already unused on main;
deleted). The button's label is now "Panel menu: copy, print or save" (was "Export this panel").

The order is one pure function, `panelMenuRows({ dashboard, meeting, csv })`, over one label table, `PANEL_MENU`;
R-PANEL-MENU-ORDER tests it for every host and scans src/components for any other ··· menu, an old label, or a
Coming soon row.

## 2. Save as CSV: the one pattern

**The view registers its rows.** A view calls `usePanelCsv(() => table | null)` (src/components/shell/panel-csv.tsx).
Every panel is a `CardBox`, and CardBox now holds a small registry (`PanelCsvRegistry`); the menu reads it when it
opens and shows "Save as CSV" only when the view on screen has given a non-empty table.

Why the view, not the panel's host: the view is the one place that holds exactly the rows it draws, after the set,
filters, year, level and suppression are applied. Each product's rows are **pure builders** (`src/components/smt/csv*.ts`,
`src/components/admissions/csv.ts`, `src/components/teacher/csv.ts`, `src/components/groups/dash/csv.ts`) that take the
same object the view draws, so the unit tests render the view and its CSV side by side. Where one place picks the
view (SMT's `ViewBody`, Admissions' `InstanceBody`, the group's view switch) it registers centrally; a view that holds
its own state (a chip inside the view) registers itself, and the latest registration wins.

- The builder runs only when the menu opens, and again on the click: a panel pays nothing for it until then.
- Full screen mounts a view twice (card and modal): both register; the modal's wins while it's open.
- A view with nothing tabular, or an empty state, returns null: **no CSV row** on that panel.
- The page names who the figures are for with `PanelCsvScope` (`{ who, set?, year? }`), for the file name and as
  defaults a view doesn't name itself.
- Peek (`?peek=1`) and View as: the CSV is built in the browser from what the page already loaded; no route is
  called, nothing is written or logged. Read-only, as the screen.

## 3. The file

`src/lib/csv.ts` (R-PANEL-CSV-FILE):

- RFC 4180: comma-separated, CRLF, a field quoted when it holds a comma, quote or line break (quotes doubled),
  every row the header's width (a short row is padded, a long one is an error).
- A UTF-8 **BOM**, so Excel opens accents and the en dash correctly.
- A **header row**.
- **Numbers as numbers**, at the precision the panel shows (the builder rounds as the view's own formatter does),
  without thousands separators or exponents. A percentage is a number under a header that says so:
  `Share (%)` over `45.3`, never `45.3%`. Ranks are two numeric columns (`rank`, `schools ranked`), not "3 of 12".
- **Years as the panel writes them** ("2024/25").
- **What the figures rest on: leading columns** `Comparison set` and `Data year`, on every row, only where the view
  rests on one set or one year (a trend table has its own Year column and no `Data year`). Chosen over an "about"
  line above the header because a comment line breaks strict parsers and Excel's filters, and a column stays with
  its row when someone sorts or copies a selection.
- **Withheld stays withheld** (R-PANEL-CSV-SUPPRESSED): where the screen shows words in place of a figure
  ("Too few schools (3)", "too few entries", "n/a"), the CSV writes those words; where it shows a dash, the cell is
  empty. Never the number behind it.
- Text that Excel would read as a formula (`=`, `+`, `@`) is prefixed with an apostrophe.
- File name: `vicdata_<school-or-group>_<panel-title>_<YYYY-MM-DD>.csv`, each part slugged
  (`vicdata_leighton-park-school_scorecard_2026-11-23.csv`).

## 4. Inventory

(Filled in below, per surface: the rows it shows, whether its data is available client-side in tabular form and
where from, and what Save as CSV covers.)
