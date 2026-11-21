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

"Before" is main on 21 Nov; "after" is this branch. Every surface's data is already in the browser: each view is
drawn from one route answer the page holds, so every CSV is built client-side from that answer and no new route
was needed.

| Surface | Menu before | Menu after | Where the rows come from | Save as CSV |
|---|---|---|---|---|
| **SMT Overview** (Current, Scorecard, Map, Flags, Roll, Results, Market share; line and table forms) | Print this graph; Copy this view… (meeting only) | Copy to a meeting… (own sign-in), Print or save as PDF, Save as CSV | `/api/smt/overview` answer (`Overview`), `src/components/smt/csv.ts` | every view |
| **SMT Academic** (Now, Chart, Table, Map, Areas, Grades, Trend line/table, Every line, Dumbbell, Moves, Set moves, Mix bars/table, Against) | same | same | `/api/smt/academic` (`Academic`), `csv-academic.ts` | every view |
| **SMT Pupils** (Now, Shape, Girls and boys, Day and boarding, Entries, Leaving at 16, Market, Phases line/table, Pool, Area) | same | same | `/api/smt/pupils` (`Pupils`), `csv-pupils.ts` | every view |
| **SMT Context** (Now, Map, Nearby, By age, Births, Births indexed/table, Projection, Ages) | same | same | `/api/smt/context` and `/context/map`, `csv-context.ts`; Projection registers inside its view (own toggles) | every view |
| **Admissions Pipelines** (the home's panels and the dashboard: Now, Pipeline, Funnel, Births, Map, Feeder table, Shape, Entry views, Pool indexed/table, Area population, Share needed) | Print this graph; Copy this view… (meeting only); extras Edit the feeder lists | Copy to a meeting…, Print or save as PDF, Save as CSV; divider; Edit the feeder lists | pipeline and shape answers, `src/components/admissions/csv.ts` (`admissionsViewCsv`, in `InstanceBody`; phone's three own panels via `ViewCsv`) | every view (38 across both dashboards) |
| **Admissions Market share** (Now, Donut, Bars, Table, Map, Momentum, Flags, Strengths, Academic rank/number/change, You vs rivals, Share line/number/ranks/change/band, Roll line) | same; extras Edit the rivals | same; divider; Edit the rivals | market-share and rivals answers | every view |
| **Teacher GCSE and Post-16** (Results, Candidates, Grade counts; Context; Comparisons -- Current, Trends, % change; tiles, bars, tables, donut, ranked lists, trend charts and tables, dumbbell, maps, rank over time) | Print this graph; two disabled Coming soon rows | Print or save as PDF, Save as CSV (copy rows where a copy source exists, below) | the dashboard and chooser-set answers; the shared primitives (SortTable, RankedList, NumberTiles, YearTable, TrendChart, ShareDonut, VerticalBars, SchoolRankingTable, RankingsMap…) register the rows they're given; `src/components/teacher/csv.ts` | every panel that shows figures; a prompt-only panel ("Click a grade in Results…") has none |
| **Custom dashboards** (/dashboards, the editor) | Print this graph; Copy this view… | Copy to a dashboard…, Copy to a meeting…, Print or save as PDF, Save as CSV | the same Teacher, SMT and Admissions views | as their products |
| **Meeting slides** | Print this graph | Print or save as PDF, Save as CSV | the same views; the slot names the pinned school for the file name | as their products |
| **Group dashboards** (Overview, Schools, Academic, Pupils; Whole group and each phase tab; special/AP trusts and nursery federations) | Print this graph | Print or save as PDF, Save as CSV | the group dash answer, `src/components/groups/dash/csv.ts`; the results trend, Schools table and Entry cohorts register inside their views | 31 of 33 views |
| **Walks** (Teacher, SMT, Admissions, head office) | no ··· menu (the walk window isn't a panel) | unchanged | -- | none: no menu to put it in |
| **Old Data View** (`PdfExportButton`, under the hidden /schools pages) | its own PDF button | unchanged (not shared, hidden) | -- | out of scope |

### Gaps (no "Save as CSV" row, by design)

- **Group: GRP-A-BANDS** (still a placeholder) and **GRP-N-RESULTS** (only the reasons results aren't compared): nothing tabular.
- **Teacher:** the KS2 boxes; the v2 **slope chart** (`src/components/views/SlopeChart`) has no rows registered yet; the v2 map only when it's handed its school figures.
- **Prompt-only panels** (Teacher's "Click a grade in Results to compare it…") and empty states everywhere.
- **Walks:** the walk window has no ··· menu at all. Adding one is a separate change (it would reuse this pattern as is).

### Choices worth knowing

- Lists the card shortens (top 6, "+N more years") save every row, as full screen shows them.
- SMT P-NOW saves every tile even on a phone (which shows four).
- Teacher sets no page-wide comparison set: Results compares with England and Context with the school's own subjects, so
  each panel names its own set (Comparisons) or data year (Current panels).
- Group: the phase tab isn't a column (it's in the file name's panel title only where the title says it); dates are as
  the source gives them (2021-09-01). A later change could let the page scope add leading "Phase" and "Weighting" columns.
- A map's CSV is its dots: school, URN, the figure as a number under its measure and unit, the counts behind it.

## 5. Hand check (local production build, platform-admin peek)

`npm run build`, then `next start` with the access gate off, signed in as the preview agent account (a platform admin).
Supabase no longer redirects to localhost, so the session was minted with the service-role key exactly as
`/api/testing/preview-session` does, and set in the headless browser; nothing was written. Each page was loaded one at a
time; every panel's ··· menu was opened, its rows read, "Save as CSV" clicked, the download saved and parsed back
(BOM present, every row the header's width, no "45%" text cells).

| Page | Panels | Rows in the menu | CSVs downloaded and parsed |
|---|---|---|---|
| SMT Overview, `?lookAs=110110&as=smt&peek=1` | 5 | Print or save as PDF, Save as CSV (peek: no copy) | 5 of 5 |
| SMT Academic, Pupils, Context (peek) | 15 | same | 15 of 15 |
| Admissions Pipelines and Market share, `as=admissions&peek=1` | 10 | same | 10 of 10 |
| Group Overview and Academic, Harris (preview account), `as=head_office&peek=1` | 10 | same | 10 of 10 |
| Teacher GCSE, the preview account's own school (The Chase) | 3 | same | 3 of 3 |
| Teacher Post-16, The Chase (two prompt-only panels) | 2 | Print or save as PDF only | -- (nothing shown, so no row) |
| Custom dashboard `/dashboards/vicdata.ks4.results` | 3 | all four, in order | 3 of 3 |

"Copy to a meeting…" and "Copy to a dashboard…" each opened the dialog on that tab (screenshots).
The Teacher peek at 110110 (`/teacher/ks4?lookAs=110110&as=teacher&peek=1`) goes to /teacher/setup, as on main: the phase
isn't set up for the peek, unrelated to this change, so Teacher was checked on the preview account's own school.

Screenshots: `docs/v0.8/panel_menu_csv_screenshots/`. Sample CSVs (school- and group-level published figures only, no
personal data): `docs/v0.8/panel_menu_csv_samples/`.
