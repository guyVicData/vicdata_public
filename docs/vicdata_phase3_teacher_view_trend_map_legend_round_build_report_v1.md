# Teacher view Trend: legend, rail and map round: build report (v1)

Brief: `vicdata_phase3_teacher_view_trend_map_legend_round_build_brief_v1.md`. Prompt: `…_claude_code_prompt_v1.md` (both read in full). Built from `dff9ec0`, the HEAD the prompt was checked against. **Committed locally, not pushed.**

| Commit | What |
|---|---|
| `a96d407` | Part 1: the per-subject show/hide legend |
| `5107e00` | Part 2: the `legend` slot at the top of the fullscreen rail, with a divider |
| `020852c` | Part 3: a Map view on Column 1's Trend |
| (this commit) | This report, the round's three docs, and screenshots |

Every commit passed `tsc --noEmit`, `eslint` and `next build`. `eslint src` shows the same 7 problems as before this round, none of them in these files.

**Part 1 needed one line from Part 2 to compile.** The Trend object's new `legend` field is only valid once `PanelRender` declares it. So `a96d407` adds that one type field, and `5107e00` does the rest: the ColumnPanels pass-through and the CardBox rail. At `a96d407` on its own, the legend is built but not yet displayed.

## Part 4: confirmed, nothing built

All three still hold at `dff9ec0`:
- **Multi-subject Trend:** `changeScope="individual"`, passed from `page.tsx`'s Column 1 Results call.
- **Table sort arrows:** `SeriesViews.tsx`'s `head()` draws ▲/▼ and fades the inactive ones (`opacity-0`). The default sort is `rank` or `given`.
- **Fullscreen `TrendLineToggle`:** it's the Trend panel's `footerLead`, rendered in the fullscreen footer (`PanelFooter.tsx`).

## What was built

1. **Legend.** One row per line. Each row is a single control: a box filled in the line's own colour (the same `trendColours` the line uses) when the line is shown, and hollow in that colour when it's hidden. The focused subject's row is ticked, disabled, bold and marked "always on".
   - Filtering happens in one place in `SubjectPanels` (`trendShown`), before the data reaches `MultiTrend` or `YearTable`, which stay generic.
   - The fullscreen chart drops its own per-series legend through a new opt-in `seriesLegend={false}` on `MultiTrend`/`TrendChart`. The band and index-100 reference entries stay, since nothing else explains them.
   - Every other `TrendChart` caller (Candidates, Results "all", KS2) keeps the default and is unchanged.
2. **Rail.** The first section is "Subjects shown". The flag and private note are grouped below a `border-t border-[var(--panel-border)] pt-4` rule, which is the same line the rail already uses to divide itself from the chart. The rail now appears when there's a legend, a flag or a note. Below `lg` it stacks under the chart, so the legend comes first there.
3. **Map.** A Map button (the existing `MapPinIcon`) sits after Chart/Table, or after Indexed/Actual/Table.
   - It renders `RankingsMap` exactly as Comparisons mounts it: dense on the card, the full legend stack in fullscreen, plotting the focused subject.
   - While the map is showing, the rail legend and the Trend-line toggle are off, because neither applies to a map.
   - If the focus moves to a subject with no map chip, the view falls back to the chart.

## The four open decisions

1. **`hiddenKeys` resets when the focus or scope changes.** The state is stamped with `changeScope|focusedKey` and ignored under any other stamp. That's derived during render, not reset in an effect, per the hooks lint rule. The reason: the list is the focused subject's peers, so a set of hidden keys chosen from another subject's list means nothing once the list is different.
2. **The legend is fullscreen-only,** as the prompt expected. The card never had a flag-style dual path for it. The divider is the rail's own `panel-border` top rule on the flag/note group, and it's drawn only when a legend sits above them.
3. **Map scoping.** `subject`, `subjectBucket` and `familyId` come from the page's existing `activeMapChip`, the focus subject's map chip that Comparisons' map already uses. So both maps always plot the same subject with the same category ramp, and the bucket is right at Post-16. Nothing is refetched: `mapProfiles` is threaded from the page. `suggestFullscreen` is set on Trend **only while the Map view is showing**. Comparisons sets it unconditionally, but on Trend's chart it would be noise.
4. **Mode buttons.** I kept `AcademicMapView`'s real bordered pill-group, not the mockup's bare pills. Restyling them would change the Data View's and Comparisons' maps too, and it isn't one of the deviations Guy explicitly asked for on this board. Easy to revisit if the bare pills were meant.

## Other judgement calls to check

- **Hiding filters the fullscreen chart and table only.** The card has no legend control, so a line hidden on the card couldn't be brought back there. The card keeps every line and its own legend under the chart.
- **Hiding also filters the fullscreen table.** The prompt asked for this, but it means the table's rank then counts only the rows shown: hide Geography and History reads "2 of 2" (screenshot `table.png`). If the rank should stay against the full peer list, only the chart should filter.
- **The y-axis rescales to the lines still shown** (`hide.png`), because it scales to its data.
- **Fullscreen map height.** Comparisons' `h-[70vh]` overflowed Trend's chart area and covered the summary line. Trend's fullscreen map fills the chart area instead (`min-h-[22rem] flex-1`). Comparisons is untouched.
- **Size legend.** A new opt-in `untitledSizeLegend` on `AcademicMapView`/`RankingsMap` drops the "Dot size" heading and tightens the box. The "Entries in History" line under the dots still says what size means. Nothing else passes it.
- **Colour key:** no change was needed. `AcademicMapView` already centres it in the gap between the mode buttons and the zoom control, at 70% of the gap's height.
- **Map scope quirk (mirrored, not fixed):** `mapProfiles` is the union of the comparator sets' schools, and `RankingsMap` labels the set "the 10 nearest schools". Trend's map inherits this from Comparisons.
- **The map ignores the Results measure and the From-year menu.** It plots the subject's grade band or trend, as Comparisons' map does.
- **Scope of the Map button.** It's on Column 1 Results only. Context and KS2 (which has no subjects, so no chip) get none, and neither does Column 1 Candidates (`CandidatesPanels`), because the prompt targets `SubjectPanels`.
- **Two maps at once:** safe. Each `AcademicMapView` owns its Leaflet map on its own element. Its one DOM query (`.leaflet-control-zoom`) is scoped to its own container, and there's no mutable state at module level. This is the same property that already lets the card and the fullscreen modal each hold a live copy.

## Checks

- **Headless preview.** The real `SubjectPanels` ran on The Chase's real GCSE Humanities data (History focused, with Geography and Religious Studies, 2021/22–2024/25) and the real map profiles for its 10 nearest schools, with clicks scripted to open fullscreen, switch views and untick Geography.
  - Committed in `docs/screenshots/trend_map_legend_v1/`: `fs`, `hide`, `table`, `fslight`, `mapcard`, `mapfs`.
  - The tiles read "API KEY REQUIRED" because CARTO refuses a localhost origin; that's a preview artifact.
- **Not checked:** the 375px fullscreen rendered shifted in headless Chrome, which I haven't resolved. Please check phone width live.

## For Guy's live look (after a push, hard-reload)

The Chase, GCSE, Results focused on History:
1. **Trend → Full screen.** The rail should read "Subjects shown" (History always on), then a rule, then Flag and Your note. Untick Geography: its line and legend box go hollow, and the chart rescales. Change the focus subject: everything is shown again.
2. **Trend table in fullscreen:** hidden subjects drop out of it too.
3. **Map button on the Trend card:** a dense History map with its caption line, and "Full screen" suggested under it. In fullscreen: bordered mode pills, the colour bar between them and the zoom control, the size key with no heading, and nothing covering the summary. Column 3's map, on its own Map view at the same time, should behave normally.
4. **Phone width:** the rail sits under the chart with the legend first.
