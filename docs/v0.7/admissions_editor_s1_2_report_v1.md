# VicData 0.7 — Admissions in the editor, stages 1–2: report

Built 12 Oct 2026 from `docs/v0.7/vicdata_0_7_admissions_editor_stages1_2_claude_code_prompt_v1.md`, on the plan `docs/v0.7/admissions_editor_plan_v1.md`. Guy's ten decisions are now in the plan's §5.3, under "Decided (Guy, 12 Oct)".

Branch `v0.7-admissions-editor-s1-2`, two commits:

- **Stage 1** (`6761c3c`): the editor is honest, and full screen is a focus mode.
- **Stage 2**: the views draw their options. This report and the logged calls are committed with it.

There's no database change.

**Results at a glance:**

| Check | Result |
|---|---|
| Admissions parity, stage 1 vs stage 2 | **328 / 328 pairs identical**, pixels and DOM, covering 592 panel-views |
| Admissions parity, main vs stage 1 | 328 / 328 identical |
| Teacher parity | 2,874 / 2,875 identical; the 1 was map timing, identical on a rerun (§3) |
| Teacher editor tests and unit tests | 390 / 390 pass, the editor tests unchanged |
| Rule tests | 52 / 52 pass, including the new R-ADM-EDITOR-LOOKS-KEEP-NOTES |
| RLS test | 111 / 111 |
| tsc, eslint, build | clean (eslint: 0 errors, the 2 existing warnings) |

---

## 1. What was built

### Stage 1: make today's editor honest

| Item | What it does now | Where |
|---|---|---|
| **S1.1 The preview** (gap 7) | Draws at the edit bar's Entry point pill, at the panel's real size on the Admissions page, scaled to fit the dialogue (see below). A spanning panel previews in a wider 560 px column. Custom age previews at 11+ and says so. | `AdmissionsSteps.tsx` (`AdmissionsScaledPreview`, `previewEntry`); `admissionsBodySize` in `AdmissionsDashboard.tsx`; `DashboardEditor.tsx` (the env carries the entry, span, row and rail); `charts.tsx` (`MeasureScale`) |
| **S1.2 Copy out** (gap 8) | From an Admissions dashboard, Copy to… offers meetings only. | `EditorScreen.tsx` |
| **S1.3 Defaults per entry point** (gap 6) | The page opens each panel on its `defaultViewByState` for the entry point, on the desktop and the phone. | `useActive` in `AdmissionsDashboard.tsx` |
| **S1.4 Hidden controls** (gap 1, decision 1) | Step 1's compare chips and Step 2's look boxes come from one registry, `src/catalogue/admissions-editor.ts`. It was empty in stage 1, so nothing showed. Stage 2 filled it as each option was wired. | `admissions-editor.ts`, `AdmissionsSteps.tsx` |
| **S1.5 Focus mode** (decision 3) | Full screen on every Admissions panel, described below. | `CardBox.tsx` (optional `focus`, never passed by Teacher), `TeacherModal.tsx` (a `focus` size), `ui.tsx` (`FocusFill`, `fillHeight`) |
| **S1.6 The move warning** (decision 2) | A two-column view moving into a one-unit panel shows "This view needs two columns; at one it crushes its columns", in the move dialog and on the Preview step. Moving, copying or moving a panel to another row is blocked with "Move between rows comes in the next editor round". Within a row, moves are allowed. | `Dialogs.tsx` (`SlotMapDialog`'s optional `checkTarget`), `admissionsSlotCheck` in `DashboardEditor.tsx` |

**The preview's real size.** At 1440, an Admissions column is 445 px and the large view is 915 px. Less CardBox's padding and the rail, the body is:

- 374 × 450 for row 1 at one unit;
- 844 × 450 for the large view;
- 374 × 260 for row 2.

**The focus mode** keeps everything a member needs to move around without leaving it:

- **On screen:** the rail, the panel's header chips, an "Entry point" bar with the school's entry-point chips, the ⋯ menu, and the notes behind their icons. On a phone, the tabs.
- **Size:** it fills the window 12 px clear of its edges. Esc or the icon closes it.
- **Charts take the room:** the pipeline, the funnel, both maps, momentum, and the row-2 line and bar charts. Tables and lists scroll.
- **On paper:** the caption and source print in full.

### Stage 2: the renderer reads the instance

| Item | What it does now |
|---|---|
| **S2.1 `viewBody` reads the instance** | The dataview still picks the component. The spec's looks (`looksOf`) and compare (`compareState`) become its props. Every default is the preset's value, so the published configs draw byte-identically (§2). `InstanceBody` fetches a view's own feeder set when it isn't the page's. The page, the phone, the editor's preview and the editor's canvas all draw through it. |
| **S2.2 Compare chips** | A feeder view's set is one choice: Follow the page, Day feeders, Boarding feeders or Both. It is offered to a **boarding school only**; a day school's view ignores a boarding spec. Pool trends (chart and table) can drop the LA or the England line, and Area population the LA or the region; at least one always stays. R-ADM-BOARDING-ONLY-WHERE-BOARDERS now also renders the editor's 1 · Data for every feeder view. |
| **S2.3 The funnel** | No compare chips. Step 1 says it draws one area, the LA or the lead's blend (decision 9). |
| **S2.4 The flag list** | Its own component, `FlagsView` in `Momentum.tsx`, for a row-2 panel or a one-unit slide cell. Flagged rivals or every rival (decision 8). |
| **S2.5 Step 2's look boxes** | Every view with options shows them (§4), each brought back as it was wired. |
| **S2.6 Locked by rule** | `ADMISSIONS_FIXED` names its rule ids, and Step 2 shows them. The new **R-ADM-EDITOR-LOOKS-KEEP-NOTES** renders every view of both dashboards, plus the flag list, on real data for The Chase (11+, 16+), King's Worcester (11+) and Beaudesert Park (11+), under each look and compare value in turn (442 renders). It checks four things, described below. |

**What R-ADM-EDITOR-LOOKS-KEEP-NOTES checks:**

- **Notes:** no ADMISSIONS_NOTES line the preset renders goes missing.
- **Defaults:** a spec at its defaults renders the preset byte for byte.
- **Boarding:** a day school asked for boarding feeders draws its preset, with no boarding words.
- **Effect:** every option changes the drawing in at least one case. Of 34 option values, none was idle. The map colours draw in the browser only, so they were checked in the preview harness (`screenshots/looks/`).

Its negative control works: a planted look that hid the undercount note failed the rule.

**Also fixed on the way:**

- **The editor's chips never showed as selected.** They used a `.chip.on` style that doesn't exist; it's now the house `.chip.active`. That applies to the family chips and the new compare chips alike.
- **The editor's Admissions previews drew grey.** The editor didn't set the page's Admissions colours; they're set now.
- **The editor rebuilds a view on save.** An Admissions view keeps its own dataview while only its looks or compare change (`buildAdmissions`). Without this, a Pool trends table with a dropped line would have been saved as Your cohort's table.

---

## 2. The Admissions parity pass

The harness is `docs/v0.7/audit_scripts/admissions_preview/par.mjs.txt` and `parcmp.py.txt`. It was built before any stage 2 change, as the prompt asked.

**What it covers:**

| Dimension | Values |
|---|---|
| Schools | The Chase 137625 (11+, 16+), King's Worcester 117037 (11+, 16+), Beaudesert Park 115786 (4+, 11+; it has no 16+) |
| Themes | dark, light |
| Widths | 1440, 390 |
| Dashboards | Pipelines, Market share |
| Steps | each panel's default, then every rail view in turn (the phone's tabs at 390) |

**How a pair is judged:**

- Each step is a full-page PNG plus `#teacher-root`'s DOM, and a pair counts as identical only when both match exactly.
- The data is fixtures from the routes' own functions, captured once and shared by both trees.
- Map tiles are blocked, so a map draws its markers alone, the same each time.
- The config is the code copy. The live published v1 configs match it spec for spec; their jsonb hashes were checked. The one exception is the Funnel's stored spec, which predates r3's "not at 4+" limit (logged).

| Pass | Pairs | Identical | Panel-views drawn |
|---|---|---|---|
| main vs stage 1 | 328 | **328** | 592 |
| stage 1 vs stage 2, first run | 328 | 300 | 592 |
| stage 1 vs stage 2, final | 328 | **328** | 592 |

**The first stage-2 run caught something real.**

- 28 pairs differed in pixels while their DOM matched. All were the Pool trends title.
- My edit had split "your feeders, Worcestershire and England" into different text runs. The text was the same, but Chrome shaped it a fraction differently.
- With its defaults on, the title now has exactly its original runs, and so does the feeder map's. The rerun was 328 / 328.

That doubles as the pass's negative control: a sub-pixel text change on one view was caught.

## 3. Teacher parity and the editor tests

- **The Teacher harness** ran unmasked, with its negative control (caught), on the final tree against `main` at `2a317ea`. Of 2,875 pairs, **2,874 were identical** and 1 was flagged: `rk-137625-nat-pending`, column 1's Trends map.
  - **The flagged pair:** the same markers and words, the map panned a few pixels. It's Leaflet's fit timing, and the pair's geometry digest is identical.
  - **Rerun of that case set (rkb):** the map pair was identical. 228 of 229 identical, 0 unexpected, 1 "noise": column 3's "Ranking will be available shortly" spinner, caught mid-turn.
  - **Conclusion:** both differences are capture timing, not Teacher changes.
  - **The other checks:** the Data View and the public page import none of the changed files, and the public page SSR is byte-identical for 137625 and 117037.
- **The editor tests:**
  - `src/lib/editor-ops.test.ts`, `src/lib/view-editor.test.ts` and `scripts/catalogue-unit-tests.ts` pass **unchanged**: 390 / 390 with the other unit tests, at stage 1 and at stage 2.
  - No Teacher test was edited. `ADMISSIONS_FIXED` became `{ text, rules }[]`, but its length test (4) still holds.
- **Teacher files touched,** all optional and absent on every Teacher call:
  - `CardBox.tsx`: `focus`;
  - `TeacherModal.tsx`: the `focus` size;
  - `Dialogs.tsx`: `checkTarget`;
  - `DashboardEditor.tsx`: the Admissions env and move check, behind `isAdmissionsData` and `isAdmissionsHost`;
  - `EditorScreen.tsx`: `meetingOnly` for an Admissions host only;
  - `model.ts`: the env type only.

## 4. The look options now live

Every default is today's drawing. "—" means no option, for the reason given.

| View | Dataview | Looks (default first) | Compare chips |
|---|---|---|---|
| Pipeline ladder | `DV-ADM-P-PIPELINE` | Projection (11+): members can turn it on / off · Past pools before now ✓ · Rung labels under the axis ✓ | Feeder set* |
| Funnel | `DV-ADM-P-FUNNEL` | — (nothing worth editing) | — (one area: decision 9) |
| Feeder map | `DV-ADM-P-MAP` | Colour: by trend (the feeder flags) / by pupils (thirds) | Feeder set* |
| Feeder table | `DV-ADM-P-TABLE` | Order: as listed / most pupils first / biggest rise first · Distance ✓ · Sector ✓ · Gender ✓ · Size ✓ (the flag column always shows) | Feeder set* |
| Shape and size | `DV-ADM-P-SHAPE`, `DV-ADM-M-SHAPE` | Rivals' shapes in 2 / 1 / 3 columns (full screen: one more, up to 3) | — (see calls) |
| Donut | `DV-ADM-M-DONUT` | — | — |
| Ranked bars | `DV-ADM-M-BARS` | Show: every school / the top 5 and you / around you · With the donut ✓ | — (one rivals set) |
| Rivals map | `DV-ADM-M-MAP` | Colour: by sector / by trend since last year | — |
| Rivals table | `DV-ADM-M-TABLE` | Order: by pupils (the rank) / nearest first | — |
| Momentum scatter | `DV-ADM-M-MOMENTUM` | Name each school ✓ · Name the quadrants ✓ | — |
| Flag list | `DV-ADM-M-FLAGS` | Show: flagged rivals / every rival | — |
| Strengths | `DV-ADM-M-STRENGTHS` | Order: by the gap / A to Z · Show the flags column ✓ | — |
| Pool trends | `DV-ADM-P-POOL-INDEXED` | Name each line at its end (off) | Feeder set* · Area: LA ✓ · Area: England ✓ |
| Pool trends, table | `DV-ADM-P-POOL-TABLE` | — | Feeder set* · Area: LA ✓ · Area: England ✓ |
| Area population | `DV-ADM-P-AREA-POP` | — | Area: LA ✓ · Area: region ✓ |
| Share needed (line, table) | `DV-ADM-P-HOLD-*` | — | Feeder set* |
| Your cohort, table | `DV-ADM-P-ENTRY-TABLE` | Years: down / across | — |
| Market share numbers, ranks | `DV-ADM-M-SHARE-NUM`, `-SHARE-RANKS` | Years: down / across | — |
| Academic ranking | `DV-ADM-M-ACAD-RANK` | — (not wired: see calls) | — |
| Every other row-2 view, column 1's tiles | | — | — |

\* The feeder set is Follow the page · Day feeders · Boarding feeders · Both, for a boarding school only.

## 5. Screenshots

Everything is in `docs/v0.7/admissions_editor_s1_2_screenshots/`. They come from the preview harness on real-data fixtures, with the stage 2 code.

**Focus mode** (`focus/`). The Pipelines large view, The Chase at 11+, in both themes at each size:

| Size | Dark | Light |
|---|---|---|
| 1440 × 900 | `large_pipelines_dark_1440x900.png` | `large_pipelines_light_1440x900.png` |
| 1920 × 1080 | `large_pipelines_dark_1920x1080.png` | `large_pipelines_light_1920x1080.png` |
| 1280 × 720, a 16:9 projector | `large_pipelines_dark_1280x720.png` | `large_pipelines_light_1280x720.png` |

The other focus shots:

- `large_market_dark_1440x900.png`: Market share's large view;
- `row2_pool_dark_1440x900.png`: a row-2 panel;
- `col1_now_light_1440x900.png`: column 1;
- `phone_large_dark_390x844.png`: the phone, with its tabs.

**Editor** (`editor/`):

- `pipeline_3_preview.png`: Beaudesert's Pipeline at its real 844 px width, scaled to fit, at the pill's entry point;
- `pipeline_2_view.png`: the look box and the fixed rules with their ids;
- `pipeline_1_data_boarding.png`: a boarding school's feeder set;
- `pipeline_1_data_dayschool_light.png`: a day school, with no feeder choice;
- `pooltrends_1_data_boarding.png`: England dropped, the preview and title following;
- `move_feeder_table.png`: the row block and the two-column warning.

**Looks** (`looks/`): both maps' colour options, default against changed.

## 6. Logged calls

These are in `docs/OPEN_QUESTIONS.md` under "2026-10-12 — 0.7 admissions editor s1–2". In short:

- **The preview's real size** is the Admissions page's (above), scaled to fit. Custom age previews at 11+ until stage 4.
- **A member's pick** stays across entry points unless the new entry point has its own default.
- **The row block** covers copying and moving a whole panel too: the same remapping applies.
- **Two looks are named for what they draw.** The Rivals map's preset colours by **sector**, so its options are "by sector" and "by trend since last year"; the plan had "by share". The feeder map's "by pupils" colours in thirds.
- **Academic ranking's show all / top 5 isn't wired.** Its preset says `show: "all"` but draws three leading and two trailing areas, so either option would move the published drawing. It needs a preset correction first, in stage 3.
- **Shape and size keeps its local shape.** Hiding it would take its ADMISSIONS_NOTES line with it.
- **Market share and Rivals' results views have no chips:** they draw one rivals set.
- **On a phone,** the large view at rest draws the page's feeder set; its full screen draws the view's own.
- **The live Funnel spec** predates r3's "not at 4+" limit. A republish of Pipelines carries the fix.

## 7. Click-through for Guy

Try these once Render shows "Deploy live" for the merge.

1. **Teacher → Admissions as a platform admin, View as a boarding school** (e.g. Beaudesert Park).
   - Click any panel's full-screen icon, then the large view's.
   - It should fill the window with the rail, the Entry point chips, the panel's chips, ⋯, and the "i" and caption icons at the bottom left.
   - Switch views on the rail and entry points on the chips without leaving, then press Esc.
   - Try it at 1920 and on the projector.
2. **The same on a phone width:** full screen keeps the tabs and the entry chips.
3. **Edit (footer) → the Pipeline panel's rail menu → Edit view…**
   - The preview should be the real large view, scaled, at the edit bar's Entry point. Set the pill to 16+ and reopen.
   - 2 · View: untick "Past pools before now" and watch the preview drop them, then Cancel.
4. **Edit view on Pool trends → 1 · Data.**
   - For a boarding school, the feeder set shows and the LA and England chips are lit. Untick England and the preview's line and title follow.
   - For a day school (The Chase), no feeder set is offered.
5. **The Feeder table's rail menu → Move or copy to another panel…**
   - Row 2's cells are greyed: "Move between rows comes in the next editor round".
   - Picking Current shows the two-column warning.
6. **Copy to a dashboard or meeting…** on an Admissions view offers meetings only.
7. **Make default** on a row-2 view with the Entry point pill at 16+, then Publish. The page at 16+ opens on it, and at 11+ on the panel's usual default.
8. **The published page** should look exactly as before, apart from the focus mode, which you only see in full screen.
