# VicData 0.6.1, view editor rebuild: report

Branch `v0.6.1-views`, from `main` (7c2cbe7), pushed. **Not merged.** All six stages (S1–S6) are done in one pass, and nothing stopped it. No stop condition was hit: no RLS change, no destructive migration, and no unnamed figure change on a members' page.

**Checks on every commit:** tsc, eslint (changed files) and `next build` clean, and the unit tests passing (295/295 at the end). The real-data rule tests read `PASS=9, FAIL=0, ERROR=0`.

## What Guy needs to do

1. **Re-seed** the four VicData Teacher dashboards in the new format (schema version 2). Members' pages draw the code copy until a version-2 config is published, so this is needed before editor changes show for members.
   ```
   npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/seed.sql
   supabase db query --linked -f /tmp/seed.sql
   ```
   - It publishes each dashboard as a new version over the old one; the old versions stay in History.
   - Running it twice publishes nothing.
   - It clears only old-format drafts.
   - Tested on local Postgres (`supabase/tests/v061_s2_reseed_pglite.mjs`, 16/16).
2. **No migrations** this round.
3. **Escape hatch:** v2 is now the default renderer. `?views=v1` (or `NEXT_PUBLIC_VIEWS=v1` on Render) brings back the old drawing.

## Stages and commits

| Commit | What |
|---|---|
| `55b2118` | S1: distinct titles for the two geography views (pinch point 3) |
| `3da512f` | S1: bugs from live — what's changed wording, removed views, editor preview, amber "Here now" |
| `655bb70` | S1: a panel already on its default counts as applied (first rail click no longer bounces) |
| `5995675` | S2: ViewSpec model and presets, schema_version 2, the re-seed, D10 (no visible change) |
| `73052c6` | S3a: the series builder (ViewSpec + frame -> leaf props) and the line / table / bar looks |
| `60686f7` | S3a: the config-driven panel renderer behind ?views=v2 (line, table, bar) |
| `e7827ff` | S4: the Add a view and Edit view screens (Data -> View -> Preview), on honest options from the catalogue |
| `f9415e3` | S4: screenshots of every Add a view / Edit view screen, both themes (s4-*) |
| `7ef54e9` | S3b: ranking, numbers and slope behind ?views=v2 |
| `c3b5aa9` | S3c: donut, map, trend map, change map and the geography views behind ?views=v2, and S4's compare gaps |
| `ba56d9e` | S3d: Grade counts and the grade spread behind ?views=v2, and across-schools greyed on Grade 4+ / bands outside Comparisons |
| `be50452` | S5: rail menu — the RailMenu board in the editor's rail icon menu (Shows for, Take off [measure], Remove everywhere) |
| `f888353` | S5: top bar — the Results switch and the grade band choice move to the dashboard's top bar (D3 + D4), members and editor alike |
| `ab4ea72` | S6: S5's loose ends — Column 1 back in line, Post-16 band words in their own case, no sideways scroll at 390, the preset table's Grades note |
| `9f1bca3` | S6: v2 is the default — every view drawn from its ViewSpec; ?views=v1 (or NEXT_PUBLIC_VIEWS=v1) is the escape hatch |
| `5bdc73f` | S6: walk-throughs at The Chase (137625, GCSE History) — a school-only trend narrowed in the editor draws D8's per-year bars |
| `23b9c4f` | S6: screenshots of every screen against its board, both themes (s6-*) |
| `3bd858a` | S6: polish — D1's badges and column chrome out of the editor, previews on the page's measure, titled rail tooltips, Show for's honest defaults, the spread's marker and band words |
| `3227bd7` | S6: Show this view for greys the wider-system views off Average points |


## Parity, stage by stage

Parity runs used the headless pixel-pair harness: members' pages at 100053 GCSE and 117037 Post-16, every Results measure and Compare-against set, 1280 and 390, both themes, with every rail view clicked.

From S3 part C on, they ran through a **component harness** (the real hosts and panels, on committed real-data fixtures). Rebuilding the live-data harness would have needed the server key in a browser bundle or proxy; the permission system rightly blocked that, and it was never done.

| Stage | Compared | Result |
|---|---|---|
| S1 | flag off vs main | 120 pairs identical, 60 rail dumps identical. The new geography titles are the one intended change (checked in the editor harness) |
| S2 | S1 vs S2 (no visible change) | 8 pairs identical (a short check, after a hung run) |
| S3 part A | `views=v2` vs off; off vs main | 3,552 pairs: 0 diffs on any view v2 draws. Off vs main: only S1's titles, plus S1's first-click fix |
| S3 part B | v2 vs off | 5,376 pairs: 0 real diffs (host-drawn maps, flakes, one 1/255 render artifact) |
| S3 part C | v2 vs off; off vs previous | 2,512 + 2,512 pairs, 0 diffs |
| S3 part D | v2 vs off; off vs previous | 2,664 + 2,664 pairs, 0 diffs |
| S5 rail menu | before vs after | 2,664/2,664 identical (v1 and v2) |
| **S5 top bar (members' change, D3/D4)** | before vs after | 96 of 2,664 differ, all Column 1 Current on Grade bands (band row gone, rail label, no-range note). On full pages, the top bar differs on Results pages only |
| S6 loose ends | before vs after | Differences are Column 1's alignment spacer, the narrower main at 390 (sideways-scroll fix), and "A*–B" casing; the words are otherwise identical |
| **S6 v2 default** | default (v2) vs `?views=v1` | **2,664/2,664 identical**. Full pages 239/240 (one 1/255 artifact) |
| S6 polish | before vs after | 2,664/2,664 identical; 2,664 DOM digests, title attributes included, 0 differ |

## The preset table

`docs/v0.6/views_preset_table.md` holds all 40 dataviews mapped to ViewSpec presets, each `compare: "follows-page"`. It's generated from `src/catalogue/viewspec.ts`, and a test fails if they drift.

## What was retired

- **Add a view and Customise:** the 0.6 screens (Ch3Pick, Ch3Adjust, Ch3Empty, Steps 1–2) are retired for adding and editing views. The new screens are Data → View → Preview.
- **What the 0.6 chooser is still used for:** the placeholder form ("Something else? Plan it"), Swap, columns with no view host (Rolls, Live births), and meetings' Add a view.
- **Steps 1–2** stay for column and panel "compared to", and for New dashboard.
- **Rail filtering** (`rail.tsx` `dataviewForRail`) is retired for v2 and kept for `?views=v1`.
- **The in-panel grade band row, click-two-grades picking and Column 1's MeasurePicker** are retired. The top bar holds the Results switch and the grade band (D3/D4).
- **The "Grades (pick a range)" view** is kept as a read-only "Grade distribution".
- **The editor's own Results pill** is replaced by the top-bar control. Compare against stays in the edit bar.
- **"Inherits column" / "overridden" badges:** removed from the editor, along with the column's "Data · Compared to" line, Edit column and the panel menu's "Change data / compared to…" (D1). The column heading stays.

## Walk-throughs (headless, The Chase 137625, GCSE History)

| # | Task | Result |
|---|---|---|
| 1 | Add "History grade trend, school only" on Grade bands, Column 1 Trends | Pass, after a renderer fix (a single-subject line drew a change list instead of D8's two-year bars) |
| 2 | Take the "against the wider system" graph off Grade bands only | Pass: still on points and Grade 4+ |
| 3 | Add a change-in-points bar chart on Average points, with an average line | Pass: "−0.4 average of the 3 shown" |
| 4 | Add a grade spread with an average grade marker on Grade counts | Pass: "Mean grade 5.3" |
| 5 | Edit a view's title, publish, see it with Edit off | Pass: members see the new title and the "Updated — Retitled …" line |
| 6 | Custom 9–5 from the top bar | Pass: "Grades: Custom 5–9", saved as `band:range`, at 1280 and 390 |

Shots: `docs/v0.6/views_rebuild_screenshots/s6-walk*`.

## Screenshots against the boards

In `docs/v0.6/views_rebuild_screenshots/`, light and dark, with `-vs-board` side-by-sides:
- **Add a view:** AddView1, AddView2, AddView2Table, AddView2Rank, AddView2Bar, AddView2Spread, AddView3.
- **Edit:** EditView, EditWide (the View, Data and Preview tabs, no scrolling at 1280 × 800), RailMenu.
- **The top bar** at 1280 and 390, plus S1's fixes (`s1-*`), S4's screens (`s4-*`), S5's top bar and rail menu (`s5-*`) and the polish (`s6-polish-*`).

## Found along the way

- **The first rail click bounced back:** under the config renderer, the first rail click away from a panel's default view was undone. That's live on main today. Fixed in its own commit, `655bb70`, which can be dropped.
- **Post-16 Grade bands with no range:** a member couldn't reach a range picker. Fixed by the top-bar Custom picker.
- **Phone sideways scroll (407px at 390):** fixed on the Teacher page.

## Logged

`docs/OPEN_QUESTIONS.md`, "2026-10-04 — 0.6.1 view editor rebuild", has every call per stage.

## Click-through for Guy, by board

After the re-seed, open `/teacher/ks4` at The Chase, using View as or your own school, and turn on the footer **Edit** switch.

- **Top bar (D3/D4):**
  - **Results: Grade bands ▾**, then **Grades: 7–9 ▾** → Custom… → 9 to 5 → Show grades 5–9;
  - at Post-16, Custom only.
- **AddView1** (1 · Data): Column 1 Trends → + Add a view.
  - Remove a line (✕), change a colour, + Add a place or a school, ☐ Add an average (At this school / Across schools, then mean / median / weighted).
  - Greyed options say why.
- **AddView2 / AddView2Bar / AddView2Table / AddView2Rank / AddView2Spread** (2 · View): pick each tile, check the look box and its "comes from 1 · Data" note. A View choice never changes a figure.
- **AddView3** (3 · Preview): the "Show this view for" ticks, each with a mini preview (greyed with reasons), the rail icon and the title. Then Add to panel.
- **RailMenu:** the rail icon's ··· menu.
  - Shows for chips, the default for [measure], Edit view…, Move up / down, Move or copy to another panel…, Copy to a dashboard or meeting…
  - **Take off [measure]** removes it from that measure only; **Remove everywhere** removes it entirely.
- **EditView / EditWide:** Edit view… opens on Preview, with the tabs, "N changes · Undo", and Cancel / Save. At 1280 the preview is on the left, with the school ▾ and measure ▾.
- **Publish**, turn Edit off, and check the page; then restore the original from History.
- **Escape hatch:** `?views=v1` shows the old drawing for comparison.
