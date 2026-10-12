# VicData 0.7 — Admissions in the view editor: a plan (F6)

Written 12 Oct 2026 for Guy, as item F6 of `docs/v0.7/vicdata_0_7_admissions_round3_teacher_parity_claude_code_prompt_v1.md`. **A plan only. Nothing here is built.**

Guy's ask: *"Should be able to edit the new 2 column views with the same editing interface. This will need some planning, as we have a number of great new graphs/views."*

Every claim about the code below was checked against `v0.7-admissions-r3` at `b1fa35f`. F1 is being built in the working tree as this is written, so `AdmissionsDashboard.tsx` and `admissions/ui.tsx` are cited by function name, not line. Other files are cited as path:line at `b1fa35f`.

**This plan depends on three round 3 items, and assumes they land first:**

- **F1:** every panel, Teacher and Admissions, gets one shared header icon row: the ⋯ export menu, full screen and the collapse slot, in one fixed order. The editor's previews should then draw that row too, so the plan doesn't add any panel chrome of its own.
- **F2:** the boarding compare options (*Boarding feeders*, *Both*) stay in the catalogue, but are hidden when the preview school is a day school.
- **F7:** the funnel uses the same area for births and for the Year 6 / Year 11 pool (all schools in the LA or the blend, from `age_profile_aggregates`), not the feeder set's pool. That changes the funnel's compare options (§3).

---

## 1. What exists now

### 1.1 What round 2's D7 added to the editor

D7 used the existing Data → View → Preview dialogue, with no new dialogue. The Admissions parts are:

| Piece | Where | What it does |
|---|---|---|
| Four families | `src/catalogue/admissions.ts:269` (`ADMISSIONS_FAMILIES`), `src/catalogue/types.ts:24` | Pupils by age, Pipeline, Market share, Rivals' results. Step 1 shows them as chips. A family greys out when no view of it sits in that half of the dashboard (`AdmissionsSteps.tsx:54`). |
| Entry point as the focus | `src/catalogue/types.ts:38`, `src/catalogue/variants.ts:31` | `EntryPointState` = 4+ / 11+ / 16+ / custom. It is a page axis, appended last so Teacher's state keys don't change. Step 1 says "Follows the dashboard's entry point". |
| Compare options | `src/catalogue/honest.ts:388` (`ADMISSIONS_COMPARE`), `src/catalogue/viewspec.ts:82` | Day feeders, Boarding feeders, Both, Rivals, Area: LA / region / England. Each is tied to the families it fits. |
| Five new view kinds | `src/catalogue/viewspec.ts:111` | `pipeline`, `scatter`, `strengths`, `shapes`, `flags`. Each has look-only options (`viewspec.ts:197–201`). |
| Kinds per family | `src/catalogue/honest.ts:370` (`ADMISSIONS_KINDS`) | Which kinds each family can honestly draw. `admissionsViewHonest` greys the others out, with the reason. |
| The fixed box | `src/catalogue/honest.ts:400` (`ADMISSIONS_FIXED`) | Step 2 lists four things that can't be edited: certainty styling, honesty wording, flag thresholds, and "shapes are described, never ranked". |
| Steps for an Admissions column | `src/components/view-editor/AdmissionsSteps.tsx` | `AdmissionsDataStep`, `AdmissionsViewStep`, `AdmissionsPreviewStep`. They are chosen when `env.admissions` is set (`DashboardEditor.tsx:394`, `ViewEditor.tsx:283`). |
| Shows for: entry points | `AdmissionsSteps.tsx:190–215`, `ViewEditor.tsx:104–110` | The ticks are written as the instance's `variants.entryPoint`. Strengths can't be ticked at 4+ (`entryPoints: ["11+","16+","custom"]` on `DV-ADM-M-STRENGTHS`). |
| The edit bar's Entry point pill | `DashboardEditor.tsx:182, 706–724` | It sets the state the canvas previews and rails follow. |
| Live canvas previews | `src/components/editor/LivePanelPreview.tsx:31` | An Admissions panel draws `AdmissionsViewPreview` from the Admissions routes, at the pill's entry point (custom → 11+). |
| Rules | `src/catalogue/rules.ts:920–1050, 1167–1343` | 29 R-ADM rules (§3), each with a real-data test in `scripts/catalogue-rule-tests.ts` (49 pass). |
| Presets | `src/catalogue/admissions.ts:232` (`ADMISSIONS_BODIES`), `src/components/view-editor/model.ts:86` | One ViewSpec per Admissions dataview. A new view starts from Pipeline (row 1) or Your cohort / Market share (row 2). |

### 1.2 What the editor can do with Admissions today

The dashboard editor (`/dashboards/vicdata.admissions.pipelines/edit`, platform admins only, `EditorScreen.tsx`) treats the Admissions configs like any other config:

- **The spanning panel:** the large view is an ordinary panel with `span: { cols: 2 }` (`src/catalogue/dashboards/admissions.ts:61`).
  - The canvas draws it across two tracks (`EditorCanvas.tsx:145–172`).
  - The right-edge handle drags its span (`EditorPanel.tsx:313–342`, `editor-ops.ts:610 setSpan`). A panel with views in the way refuses the span.
- **The rail inside the large view:** the rail is just the panel's `dataviews` list. The existing rail already does what the large view needs:
  - drag to reorder;
  - **+** to Add a view;
  - each icon's view menu: Shows for, Edit view…, make default, Move up / down, Move or copy to another panel…, Copy to a dashboard or meeting…, Remove (`EditorPanel.tsx:13–15, 486–513`).
- **The column-1 panel:** `DV-ADM-P-NOW` and `DV-ADM-M-NOW` are one-view panels of kind `numbers`. They can be swapped or have views added like any panel.
- **The Admissions page reads the published config** (the `Dashboard` component, `loadPublishedVicData`). The code copy is the fallback. So a published edit to the rail order, rail membership, Shows for or the panel's default view reaches members.

### 1.3 What it can't do (gaps found in the code)

These are the things to fix before the editor can honestly be said to edit the large views.

1. **Look and compare options are saved but never drawn.**
   - `viewBody` (`AdmissionsDashboard.tsx`) switches on the dataview id alone. No Admissions component reads `instance.spec.view.look` or `spec.compare`.
   - So *Name the quadrants*, *Columns 1/2/3*, *Order by the gap*, *Show the flags column*, the projection toggle, and every compare chip change nothing on the page.
   - The editor effectively only picks among presets.
2. **Most kinds have no look options at all in Step 2.**
   - Only the five new kinds have a look box (`AdmissionsSteps.tsx:113–144`). Map, table, ranking, bar, line, donut and numbers say "Nothing more to set".
   - That's true even though their Teacher looks (`MapLook.colour`, `RankingLook.show`, `TableLook.sort`) are already in the presets.
3. **Moving a view between rows changes it.**
   - Presets are split by the panel's half: row 1 is `current`, row 2 is `trend` (`model.ts:89 presetsOf`).
   - `buildInstance` re-picks the dataview from the target half (`model.ts:328 hostPresetFor`). If you move the Funnel into a row-2 panel and then edit it, it is remapped to a row-2 preset. By the scoring, that is *Share needed*.
   - *Move or copy to another panel* itself doesn't check this (`editor-ops.ts:831 moveView`).
4. **The page lays out by row id, not by config.**
   - Row heights are chosen by `row.id === "now"` (`DesktopGrid`, `ROW_NOW` / `ROW_TRENDS`: 470 / 330 px at `b1fa35f`, 530 / 340 after F1).
   - Headers depend on `panel.row === "now"` (`headerOf`).
   - Phone labels are keyed by column (`phoneTrendLabel`).
   - At `b1fa35f`, full screen was offered only when `span >= 2` (`ConfigPanel`). F1 fixes that one.
5. **The phone shows only each row-2 panel's default view.**
   - `PhoneBody` takes `trendPanel.defaultView`, so a row-2 rail is invisible at 390.
   - The large view's rail becomes tabs, with two special phone renderings, Pipeline and Ranked bars (`phoneView`).
6. **Default per entry point isn't honoured on the page.**
   - The editor's *make default* writes `defaultViewByState` when the Entry point pill is set (`DashboardEditor.tsx:430`, `editor-ops.ts:706`).
   - The page's `useActive` (`AdmissionsDashboard.tsx`) reads only `panel.defaultView`.
7. **The preview ignores the Entry point pill and the span.**
   - The view editor's previews hard-code `entry="11+"` (`ViewEditor.tsx:151`, `AdmissionsSteps.tsx:186–188`).
   - They draw at one panel unit, `BODY` 327 px (`ViewEditor.tsx:65, 371`), even for the two-column large view.
8. **Copy out offers Teacher dashboards.**
   - The editor opens `CopyViewDialog` without `meetingOnly` (`EditorScreen.tsx:152`).
   - So an Admissions view can be offered to a custom dashboard, which draws Teacher hosts only (`embed.ts:219`). The page's own copy does pass `meetingOnly` (`ConfigPanel`).
9. **The flag list isn't its own view.**
   - `DV-ADM-M-FLAGS` draws the whole Momentum component (one `case` in `viewBody`), so its `show: flagged | all` look can't apply.
10. **The funnel could be ticked for 4+.** It had no `entryPoints` limit (`admissions.ts:185`), but F7 says 4+ has no funnel. *Done in round 3 (F7): `DV-ADM-P-FUNNEL` now carries `entryPoints: ["11+", "16+", "custom"]`.*

**Screenshots** (Data → View → Preview on the Admissions Pipeline panel, produced separately): `docs/v0.7/admissions_r3_screenshots/editor/step1_data.png`, `docs/v0.7/admissions_r3_screenshots/editor/step2_view.png`, `docs/v0.7/admissions_r3_screenshots/editor/step3_preview.png`.

---

## 2. The model

### 2.1 A large view with a rail is one panel holding several views

No new object is needed. The config already says it all:

- **The large view** = a `PanelConfig` in row 1 with `span.cols = 2`.
- **Its rail** = `panel.dataviews`, in order. The first is drawn first unless `defaultView` (or `defaultViewByState[entry]`) says otherwise.
- **The editor's rail is already a list the editor orders, adds to and removes from.** Drag reorders (`editor-ops.ts:694`). + opens Add a view (`addView`, `:654`). Remove takes a view out (`:685`). Make default sets the opening view (`:706`).
- **Shows for** per view = `variants.entryPoint`. The page's rail already drops a view not shown on the current entry point (`railOf`, `AdmissionsDashboard.tsx`).

So the work is not a new editor. It is to make **the Admissions page draw exactly what the config says**, and to make the editor's steps honest about Admissions.

### 2.2 The renderer reads the instance, not just its id

`viewBody(dv, c, o)` becomes `viewBody(instance, c, o)`:

- **The dataview id** still picks the component.
- **`instance.spec.view.look`** is passed to it as props. Today's presets are the defaults, so a preset draws exactly as it does now.
- **`instance.spec.compare`** narrows which sets a view draws, where the view has more than one, e.g. pool trends: feeders, LA, England. `"follows-page"` keeps today's behaviour.
- **`instance.title`** is used where set (the rail already does this, in `railOf`).

Any look option that isn't wired into its component leaves Step 2. **Step 2 shows only options that change the drawing.**

### 2.3 Moving a view between the large view and a row-2 panel

- **Use the existing menu:** *Move or copy to another panel…* (`EditorPanel.tsx:502`). No new control.
- **Admissions presets become side-free.** For an Admissions host, `presetsOf` lists both halves, and `buildInstance` keeps the instance's own dataview when the spec still matches it. The dataview, not the row, decides what a view is. Teacher keeps its halves (guarded by `env.admissions`).
- **Each dataview gets a fit,** a new catalogue field: `fit: "unit" | "span"`. It comes from the round 2 D8 check:
  - **Readable at one unit:** pipeline, funnel, map, donut.
  - **Need the span:** feeder table, rivals table, momentum, strengths, shape.
  - The row-2 views are all unit-sized already.
- **Moving a span view into a one-unit panel is allowed, with a warning** in the move dialog and on the Preview step: "This view needs two columns; at one it crushes its columns." See Question 2.
- **The page follows the config.** Row height comes from the row's position (the first row is the tall one) or a row setting, not from `row.id`. The header and footer come from the dataview, not `panel.row`. The phone's labels come from each panel's name.

### 2.4 How the span is set

- **The existing span handle,** on the panel's right edge, in whole columns (`EditorPanel.tsx:313`). `setSpan` already clears empty cells it grows over and refuses filled ones.
- **Admissions limits** (to agree, Question 3):
  - span 1 or 2;
  - column 1 stays a one-unit panel, the "entry point now";
  - at most one spanning panel per row.
- **The span question** (`spanQuestion`, `editor-ops.ts:590`) asks which column to follow when the spanned columns differ in `data`, `focus` or `compare`.
  - Columns 2 and 3 match on both Admissions dashboards (`dashboards/admissions.ts:84–85`), so the large view raises no question today.
  - Spanning from column 1 would ask: its data (Pipelines: Pupils by age) and compare (none) differ. Since column 1 stays one unit (below), that doesn't arise.
  - Admissions views carry their own family in their spec, so the answer changes no view; only the panel's override badge.
- **On the phone,** the large view is the first spanning panel in the first row (`PhoneBody`). That stays. A dashboard with none simply has no large view.

### 2.5 The same three steps, no new dialogue

| Step | Today | After |
|---|---|---|
| 1 · Data | Family chips; "Entry point: follows the dashboard's"; compare chips | The same boxes. The compare chips draw (2.2). *Boarding feeders* and *Both* are hidden for a day-school preview (F2). The funnel offers the area only (F7). |
| 2 · View | Kind tiles; looks for 5 kinds; the fixed box | The same tiles. A look box for every kind whose component takes options (§3). The fixed box names the rule ids. A kind the dataview can't draw stays greyed with its reason. |
| 3 · Preview | One-unit preview at 11+; Shows for; icon; title | The preview follows the Entry point pill, at the panel's real width, with a size switch inside the preview header: Panel · Phone · Slide (§4). Shows for as now. |

---

## 3. The catalogue of new views

The legend for the "Locked" column:

- **Certainty:** counted solid, births dashed with their range, projection on request only (R-ADM-LADDER, R-ADM-DRIFT-RANGE, R-ADM-BIRTH-SPLIT).
- **Honesty wording:** `ADMISSIONS_NOTES` (`src/catalogue/notes.ts`; R-ADM-POOL-NOT-INTAKE, R-ADM-GROUP-SHARE, R-ADM-HOLD-SHARE, R-ADM-JOINERS-ESTIMATE).
- **Flag thresholds:** national and fixed (R-ADM-FLAG-FEEDER, R-ADM-FLAG-MOMENTUM, R-ADM-FLAG-STRENGTHS).
- **Shapes:** R-ADM-SHAPE-NOT-RANKED.

Every view also carries its family rule (R-ADM-FAMILY-*) and its view rule (R-ADM-VIEW-*). The R-ADM-FILTERS rule covers the top-bar filters.

"Looks now" is what the preset holds or Step 2 offers. "Looks proposed" is what stage 2 would wire. Nothing is proposed that the component can't honestly vary.

| View | Dataview(s) | Family · kind | Compare options | Looks now → proposed | Locked by rules | Fit |
|---|---|---|---|---|---|---|
| Pipeline ladder | `DV-ADM-P-PIPELINE` | Pipeline · pipeline | Day feeders, Boarding feeders*, Both* | Projection toggle (11+), past pools, rung labels → wire all three | Certainty; pool not intake; feeder flags (R-ADM-FLAG-FEEDER); projection 11+ only; R-ADM-VIEW-PIPELINE | unit (special phone draw) |
| Funnel | `DV-ADM-P-FUNNEL` | Pipeline · bar | Today: feeders. **After F7: area only** (the LA, or the lead's blend) | Values → none worth editing; keep fixed | R-ADM-BIRTH-SPLIT; F7's R-ADM-FUNNEL-SAME-AREA; "not a flow of the same children"; no 4+; R-ADM-VIEW-FUNNEL | unit |
| Feeder map | `DV-ADM-P-MAP` | Pipeline · map | Day, Boarding*, Both | Colour by change → colour by change or by pupils | Feeder flags; R-ADM-VIEW-FEEDERS | unit |
| Feeder table | `DV-ADM-P-TABLE` | Pipeline · table | Day, Boarding*, Both | (none offered) → sort (listed / pupils / trend), show or hide km, sector, gender, size | Feeder flags; the boarding column hidden for a day school (F2) | **span** |
| Shape small multiples | `DV-ADM-P-SHAPE`, `DV-ADM-M-SHAPE` | Pupils by age · shapes | Rivals (P also: the feeders' area) | Columns 1/2/3 → wire | R-ADM-SHAPE-NOT-RANKED (never sorted by shape); age 18 left out (F3); R-ADM-VIEW-SHAPES | **span** |
| Donut | `DV-ADM-M-DONUT` | Market share · donut | Rivals | none → none | "A share of this group" (R-ADM-GROUP-SHARE) | unit |
| Ranked bars | `DV-ADM-M-BARS` | Market share · ranking | Rivals | Columns, show all, always self → show all / top 5 / around you; with or without the donut | R-ADM-RIVAL-RANKS (unranked schools say "IGCSE" or "none"; R-IGCSE-EXCL); group share | unit (phone drops columns) |
| Rivals map | `DV-ADM-M-MAP` | Market share · map | Rivals | Colour by value → by share or by change | Group share | unit |
| Rivals table (not in Guy's list, but on the rail) | `DV-ADM-M-TABLE` | Market share · table | Rivals | (none offered) → sort | R-ADM-RIVAL-RANKS | **span** |
| Momentum scatter | `DV-ADM-M-MOMENTUM` | Rivals' results · scatter | Rivals | Name schools, name quadrants → wire | R-ADM-FLAG-MOMENTUM (national top / bottom fifth, two years); "flags not available yet", never guessed; the axes since 2022/23 | **span** |
| Flag list | `DV-ADM-M-FLAGS` | Rivals' results · flags | Rivals | Flagged / every rival → wire, once the list is its own component (gap 9) | R-ADM-FLAG-MOMENTUM; R-ADM-VIEW-FLAGS | unit |
| Strengths bars | `DV-ADM-M-STRENGTHS` | Rivals' results · strengths | Rivals | Order (gap / A–Z), flags column → wire | R-ADM-FLAG-STRENGTHS (top / bottom third, at least 10 entries); not at 4+ (KS2 has no subject areas) | **span** |
| Pool trends | `DV-ADM-P-POOL-INDEXED`, `-POOL-TABLE`, `-AREA-POP` | Pupils by age · line / table / bar | Day, Boarding*, Both; Area: LA, region, England | (none offered) → which lines (the compare chips), end labels | Indexed 2019/20 = 100; the undercount note on past area years (`areaUndercount`, r2b E3); R-ADM-VIEW-TRENDS | unit |
| Hold-share | `DV-ADM-P-HOLD-LINE`, `-HOLD-TABLE` | Pipeline · line / table | Day, Boarding*, Both | none → none | "A requirement, not a forecast" (R-ADM-HOLD-SHARE); range from the pool's range | unit |
| Entry trends | `DV-ADM-P-ENTRY-LINE`, `-ENTRY-BARS`, `-ENTRY-TABLE` | Pupils by age · line / bar / table | none | none → table years across or down | "Cohort size, not new joiners" (R-ADM-JOINERS-ESTIMATE); R-ADM-POOL-NOT-INTAKE | unit |
| Academic panel | `DV-ADM-M-ACAD-RANK`, `-ACAD-NUM`, `-ACAD-CHANGE` | Rivals' results · ranking / table / bar | Rivals | none → show all / top 5 | R-ADM-RIVAL-RANKS; R-IGCSE-EXCL; the stage by entry point (4+ KS2, 11+ GCSE, 16+ Post-16); R-ADM-VIEW-ACADEMIC | unit |
| Roll and share trends | `DV-ADM-M-SHARE-LINE`, `-SHARE-NUM`, `-SHARE-RANKS`, `-SHARE-CHANGE`, `-ROLL-LINE`, `-VS-LINE`, `-VS-BARS` | Market share · line / table / bar | Rivals | none → table years across or down | Group share; ranks within the set, ties shared; FE colleges unshared (R-ADM-FE-SOURCE) | unit |
| Column 1 tiles | `DV-ADM-P-NOW`, `DV-ADM-M-NOW` | Pupils / Market · numbers | none | none → none (Question 4) | Size words from the school page (R-ADM-SHAPE-NOT-RANKED); "Share of this group only" | unit |

\* Hidden when previewing a day school (F2); kept in the catalogue.

### 3.1 Could these go on Teacher or SMT dashboards?

No Admissions view can today. Admissions dataviews have no Teacher phase or family, so `matching.ts` never offers them (`admissions.ts:5–8`). A unit test asserts this. `embed.ts:219` says an Admissions host is never drawn through `TeacherDashboard`. Custom dashboards draw Teacher hosts only, and their **Rolls** and **Social context** columns are still placeholders (`CustomDashboardScreen.tsx` header; `editor-ops.ts:1113`).

| View | On an SMT (custom) dashboard | On a Teacher dashboard |
|---|---|---|
| Pool trends, entry trends, area population | **Strong fit.** They are whole-school numbers, and they fill the empty "Rolls" column. | Not useful to a subject teacher. |
| Rivals' momentum, flag list | **Good fit** for SMT. | No. Teachers can't reach the routes (below). |
| Pipeline ladder, hold-share, funnel | Good for SMT, with the entry point pinned. | No. |
| Market share trends, donut, ranked bars | Good for SMT. | No. |
| Strengths bars | SMT, yes. | The one view a Head of Department would value. But it overlaps Teacher's Comparisons, which can now open on the rivals (r2b E2 `?set=`). The link is enough. |
| Shape, maps, tables | Possible, but they need the span. Custom dashboards ignore spans (Teacher draws column by column). | No. |

What putting an Admissions view on a non-Admissions dashboard needs:

1. **A host that draws it,** a branch in `TeacherDashboard`'s embed path and `CustomDashboardScreen`, the way `liveSlotRenderer.tsx:68` already does for slides: `AdmissionsViewPreview` at the slot's size.
2. **A pinned entry point per view.** A Teacher-style page has no entry-point chips, so Step 1's "Entry point" becomes a choice (4+ / 11+ / 16+) instead of "follows". This is the same `params.entry` that slides pin.
3. **Access.** `/api/admissions/*` allows the Admissions or SMT role, the School-Admin and platform admins only (`src/lib/admissions/auth.ts`). Anyone else gets an empty state saying why. The Assign dialog warns when a dashboard holding Admissions views is assigned to Teacher. This is a route matter, not an RLS change.
4. **The catalogue.** `matching.ts` offers Admissions views on non-Admissions dashboards only when the dashboard is assigned to Admissions or SMT. The "no Teacher context offers them" unit test changes on purpose.
5. **Copy out.** The editor's Copy to a dashboard (gap 8) is then allowed only to such dashboards.

---

## 4. The Preview step

### 4.1 "Shows for" lists entry points

- **As now:**
  - a chip per entry point (4+, 11+, 16+, Custom age);
  - greyed with the dataview's note where it can't draw, e.g. Strengths at 4+;
  - the last tick can't be removed (`AdmissionsSteps.tsx:194–213`);
  - the rail menu's Shows for uses the same axis (`src/lib/rail-menu.ts`).
- **Changes:**
  - **The Funnel has `entryPoints: ["11+", "16+", "custom"]`** (no 4+; done in F7).
  - **Mini previews per entry point,** as Teacher's Show this view for draws a mini per measure (`ViewEditor.tsx:235`, `MiniBox`). This shows at a glance where a view is thin, e.g. KS2 for preps.
  - **Custom age** previews at the custom age the preview school has set, else says "no custom age at this school". Today custom silently previews as 11+ (`LivePanelPreview.tsx:32`).
  - **For a day school, Shows for is unchanged.** Boarding isn't an entry point. F2 only hides the compare options in Step 1.

### 4.2 How a large view previews at 1440, at 390 and on a 16:9 slide

A **size switch** sits in the existing preview header, beside the school ▾ (EditWide's pattern). It is not a new dialogue.

| Size | What it draws | Source of the size |
|---|---|---|
| **Panel (1440)** | The view at the panel's real width: one unit 327 × 300, or the span `spanWidth(2) − 24` = 750 px wide × the row's height. It draws through F1's header row and the real `Panel` chrome. | `src/catalogue/config.ts:23 spanWidth`; row heights from 2.3 |
| **Phone (390)** | What `PhoneBody` draws: a large view's rail as tabs; Pipeline and Ranked bars through `phoneView`; row 2 as tabs (with gap 5 fixed, each panel's rail too) | `PhoneBody` and `phoneView` in `AdmissionsDashboard.tsx`, exported as one phone renderer |
| **Slide (16:9)** | The view in the cell it would take: the **2 × 2 span** (750 × 696) of the `2x2+1` layout, or **one unit** (327 × 300) | `src/lib/meeting-layout.ts:90`, `liveSlotRenderer.tsx:68` |

**Round 2 D8's record** (`admissions_r2_report_v1.md` §1 D8, `admissions_r2_screenshots/slides/`):

- every large view fits the 2 × 2 span;
- at one unit, the pipeline, funnel, map and donut are readable;
- **the feeder table, rivals table, momentum, strengths and shape need the 2 × 2 span.**

The `fit` field (2.3) holds this record. The Slide preview opens on the 2 × 2 span for a `span` view, and shows "Needs the 2 × 2 span on a slide" when switched to one unit. Today the meeting layout only prefers the span for the first view (`meeting-layout.ts:144 rank`). Reading `fit` there is a small follow-on (Question 5).

Today's preview shows neither size nor entry point (gap 7). Fixing that is stage 1.

---

## 5. Stages and risks

### 5.1 Build order (small first)

**Teacher parity** below means the 2,875 Teacher pairs in the harness (`docs/v0.7/audit_scripts/parity_harness/`), plus the Data View and public page byte checks. The editor is not in the pair harness. Its Teacher behaviour is held by `src/lib/editor-ops.test.ts`, `src/lib/view-editor.test.ts` and `scripts/catalogue-unit-tests.ts`, which must pass unchanged except where a test is Admissions-only.

**Stage 0: prerequisites.** F1 (one panel header), F2 (boarding hidden for day schools, with the editor's compare options hidden in preview) and F7 (the funnel's area) merged. Nothing else.

**Stage 1: make today's editor honest (small).**

- **What it does:**
  - the preview follows the Entry point pill and draws at the panel's real width (gap 7);
  - Admissions copy-out is meeting-only (gap 8);
  - the page honours `defaultViewByState` (gap 6);
  - **look and compare controls that don't draw are hidden** until stage 2 (gap 1; Question 1).
- **Touches:** `src/components/view-editor/ViewEditor.tsx`, `AdmissionsSteps.tsx`, `src/components/editor/EditorScreen.tsx`, `src/catalogue/admissions.ts`, `src/components/admissions/AdmissionsDashboard.tsx` (`useActive`).
- **Teacher parity risk: low.** Every change sits behind `env.admissions`, `dv.host.id.startsWith("admissions.")` or an Admissions file. The EditorScreen change is guarded by the host.

**Stage 2: the renderer reads the instance.**

- **What it does:**
  - `viewBody(instance, …)`; each look in §3's "proposed" column is wired as props, defaulting to today's preset;
  - the compare chips narrow the drawn sets;
  - the flag list becomes its own component (gap 9);
  - Step 2 gets look boxes for every kind that has options.
- **Touches:** `AdmissionsDashboard.tsx`, `src/components/admissions/views/*.tsx`, `panels/*.tsx`, `AdmissionsSteps.tsx`, `src/catalogue/honest.ts` (`ADMISSIONS_FIXED` names the rule ids).
- **Teacher parity risk: none in code paths.** Teacher doesn't import these files, apart from the Teacher home and People through the tile. The real risk is **Admissions' own parity**: the published config must draw byte-identically before and after. Add an Admissions pass to the harness (every view × 11+/16+ × both themes × 1440/390 for The Chase and King's Worcester) and run it first.

**Stage 3: views move freely; the page follows the config.**

- **What it does:**
  - side-free Admissions presets, and `buildInstance` keeps an instance's own dataview (gap 3);
  - a `fit` field on each Admissions dataview, with the move warning;
  - row heights, headers and phone labels from the config, not row ids (gaps 4, 5);
  - the span rules for Admissions (2.4).
- **Touches:** `src/components/view-editor/model.ts`, `src/catalogue/types.ts` (an optional `fit` on `Dataview`), `src/catalogue/admissions.ts`, `src/lib/editor-ops.ts` (the Admissions span limits, and a host check in `moveView`), `AdmissionsDashboard.tsx`.
- **Teacher parity risk: medium.** `model.ts` and `editor-ops.ts` are Teacher's too. Every change is guarded by `env.admissions` or an Admissions host, and the editor tests must pass unchanged. `fit` is optional and absent on every Teacher dataview, so Teacher's catalogue output is unchanged.

**Stage 4: preview sizes.**

- **What it does:**
  - Panel · Phone · Slide in the Preview step;
  - mini previews per entry point;
  - the phone renderer exported from the Admissions page;
  - optionally, the meeting layout reads `fit`.
- **Touches:** `ViewEditor.tsx`, `AdmissionsSteps.tsx`, `AdmissionsDashboard.tsx`, optionally `src/lib/meeting-layout.ts`.
- **Teacher parity risk: low if Admissions-only, medium if Teacher gets the size switch too** (Question 5). The meeting-layout change would alter how Teacher slides are placed only if Teacher dataviews carry `fit`. They wouldn't.

**Stage 5 (optional): Admissions views on SMT dashboards.**

- **What it does:** §3.1's five steps.
- **Touches:** `src/components/dashboard-config/TeacherDashboard.tsx`, `embed.ts`, `CustomDashboardScreen.tsx`, `src/catalogue/matching.ts`, `src/components/copy-view/CopyViewDialog.tsx`, `src/components/editor/AssignDialog.tsx`, `AdmissionsSteps.tsx` (the pinned entry point), `scripts/catalogue-unit-tests.ts`.
- **Teacher parity risk: highest.** It touches Teacher's renderer. Every Teacher pair must stay identical, because the new branch is hit only by an Admissions host, which no Teacher config holds. A deliberate unit-test change ("no Teacher context offers them" becomes "only Admissions or SMT dashboards offer them") is listed in that round's report.

### 5.2 Risks across stages

- **Silent remapping (gap 3)** is the one that can corrupt a published dashboard: a funnel edited in row 2 becomes *Share needed*. Until stage 3, Guy should only move views between panels in the same row.
- **Boarding (F2):** stage 2's compare chips must not bring *Boarding feeders* back for a day school. Run R-ADM-BOARDING-ONLY-WHERE-BOARDERS against the editor's preview too.
- **Honesty wording drift:** a look option must never toggle a note from `ADMISSIONS_NOTES`. Stage 2 adds a rule test that every Admissions view with any look combination still renders its R-ADM wording.
- **Speed:** side-free presets and per-entry minis mean more route calls in the editor. The Admissions routes are cached for the visit by URL (`cachedFetchJson`, `src/components/admissions/api.ts`), so 4 minis × 4 routes is the ceiling. That's fine on a warm server (146–277 ms per round 2's timing).

### 5.3 Questions for Guy

1. **Look and compare options that don't yet draw.**
   - *Evidence:* the page draws by dataview id only (`viewBody`). The Step 2 looks and Step 1 compare chips are saved but change nothing (gap 1).
   - *Options:* (a) hide them in stage 1 and bring each back as stage 2 wires it; (b) leave them visible until stage 2.
   - *Recommendation:* (a). An editor control that does nothing is the kind of thing that erodes trust.
2. **Can any view go in any panel?**
   - *Evidence:* D8 found the feeder table, rivals table, momentum, strengths and shape crush at one unit.
   - *Options:* (a) allow it, with a warning on move and in Preview; (b) block span views from one-unit panels.
   - *Recommendation:* (a). Guy may want, say, strengths alone in a row-2 panel for a projector. The warning keeps it honest.
3. **Span limits on Admissions.**
   - *Evidence:* the phone logic takes the first spanning panel in row 1 as the large view (`PhoneBody`). The config validator allows spans up to the last column.
   - *Options:* (a) span 1–2, column 1 fixed at one unit, at most one spanning panel per row; (b) allow a full-width span 3 too.
   - *Recommendation:* (a) for now. It's Guy's principle that column 1 is a panel and columns 2–3 are one large view.
4. **The column-1 tiles.**
   - *Evidence:* `DV-ADM-P-NOW` and `DV-ADM-M-NOW` are `numbers` with no look. Their tiles are fixed in `EntryNow.tsx` and `MarketNow.tsx`.
   - *Options:* (a) keep the tiles fixed, but let column 1 hold a rail (e.g. add the donut beside "Your place now"); (b) make the tiles choosable, as Teacher's NumberTiles params are.
   - *Recommendation:* (a). (b) is a later round, once F2's Day-only tile has settled.
5. **Preview sizes for Teacher too?**
   - *Evidence:* the size switch is generic. Teacher's preview is also one unit only.
   - *Options:* (a) Admissions only in stage 4; (b) both products, with Teacher's change listed as on purpose.
   - *Recommendation:* (a) first, then (b) in its own small round. That keeps each round's Teacher difference to one thing.
6. **Admissions views on other dashboards.**
   - *Evidence:* the routes allow Admissions, SMT, the School-Admin and platform admins only (`src/lib/admissions/auth.ts`). Custom dashboards' Rolls column is a placeholder.
   - *Options:* (a) none yet; (b) SMT and Admissions custom dashboards only, starting with pool trends, entry trends and rivals' momentum; (c) Teacher dashboards too, which needs an access decision for teachers.
   - *Recommendation:* (b), as stage 5, after stages 1–4 have been live for a while. Not (c): a teacher's need is met by Strengths' link into the subject explorer (r2b E2).
7. **The entry point on a non-Admissions dashboard.**
   - *Options:* (a) pinned per view, chosen in Step 1, as slides pin it; (b) an entry-point pill added to that dashboard's top bar.
   - *Recommendation:* (a). It adds no chrome to SMT pages and matches slides.
8. **The flag list as a view of its own.**
   - *Evidence:* `DV-ADM-M-FLAGS` draws the whole momentum view (`viewBody`). It is in the catalogue but not on the published rail.
   - *Options:* (a) split the list into its own component in stage 2; (b) take `DV-ADM-M-FLAGS` out of the editor's catalogue.
   - *Recommendation:* (a). It is small, and a flag list fits a row-2 panel and a one-unit slide cell.
9. **The funnel's compare options after F7.**
   - *Evidence:* F7 takes the feeder-set pool out of the funnel. Births and the pool both use the LA or the lead's blend.
   - *Options:* (a) the funnel offers no compare chips; the area follows the lead's blend; (b) offer "Area: LA only / the blend" as a chip.
   - *Recommendation:* (a). The blend is the lead's setup choice, not a per-view one, and two areas on one dashboard would confuse.
10. **Who edits the Admissions dashboards.**
    - *Evidence:* the editor is platform-admin only (`EditorScreen.tsx`, `usePlatformAdmin`). F4 puts Teacher's Edit bar on Admissions for platform admins only.
    - *Options:* (a) platform admins edit the published Admissions dashboards; schools don't; (b) the Admissions lead gets their own copy to edit, as custom dashboards work.
    - *Recommendation:* (a) for 0.7. (b) needs its own plan: per-school configs and how a published upgrade reaches a lead's copy.

#### Decided (Guy, 12 Oct)

All ten recommendations are accepted. Question 3 has one addition. Stages 1 and 2 are built on these (`docs/v0.7/admissions_editor_s1_2_report_v1.md`).

1. Look and compare options that don't draw are **hidden** until they do (a).
2. Any view can go in any panel, **with a warning** when a view that needs two columns goes into one (a).
3. Admissions spans: (a), column 1 one unit, columns 2–3 one large view, no full-width span.
   - **Guy adds:** the large 2–3 view's **full screen** must be a proper focus mode: the rail, the entry-point chips, the notes icon and the ⋯ menu, filling the window, closed with Esc or the icon, on every panel; on a phone the existing tab layout, full screen.
4. Column-1 tiles stay fixed. Column 1 may hold a rail (a). Choosable tiles come later.
5. The preview size switch is Admissions only first (a). Teacher follows in its own small round.
6. Admissions views on other dashboards come later (stage 5), and only on SMT and Admissions dashboards (b).
7. On another dashboard, the entry point is pinned per view (a).
8. The flag list becomes its own view (a), in stage 2.
9. The funnel offers no compare chips. Its area follows the lead's blend (a).
10. Only platform admins edit the published Admissions dashboards in 0.7 (a).
