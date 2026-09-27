# Teacher view dashboard: Column 1 Trend panel — interactive legend, side-rail reorder, and a new map view — Claude Code prompt (v1)

Brief: `vicdata_phase3_teacher_view_trend_map_legend_round_build_brief_v1.md`. Build in this order, one commit per part.

Everything below was checked against real code at `vicdata_public` HEAD `dff9ec0` — the same commit the comparator-chooser build report left `main` at. (`vicdata`'s separate migrations repo was checked at its own `3a37efb`; a different repository with its own history, mentioned only so the two hashes aren't confused with each other.) Re-read every file before editing — line numbers are pointers to help you find the right place fast, not guarantees; they will have shifted since this was written.

Context you don't have from a conversation: this round's wireframe work happened on a Claude Artifact canvas (`Fullscreen.dc.html` / `FullscreenTable.dc.html` / `FullscreenMap.dc.html`), not in this repo. The wireframe's own investigation found that most of what it depicts is already shipped — the multi-subject Trend chart, the table's sort arrows, the fullscreen `TrendLineToggle` footer control, and the fullscreen side rail (flag + private note) all already exist and needed no code, only an accurate mockup. What follows is the genuinely new part: four small, additive changes, all built on that already-real foundation.

## Part 1 — per-subject show/hide toggle on Trend's legend

**Where:** `src/components/teacher/SubjectPanels.tsx`, the `trend: PanelRender` block (currently starts around line 476). Its `body` (around line 512-535) currently renders `MultiTrend`/`YearTable` against `trendData.series` unfiltered.

**What to add:**

1. New state, alongside `trendView`/`showFit`: `const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())`. Reset it (or leave it — your call, flag which) when `focusedKey`/`changeScope` changes, since a hidden set from a different subject's peer list wouldn't mean anything once the peer list changes.
2. Before `trendData.series` reaches `MultiTrend` or `YearTable` in `body`, filter it: `trendData.series.filter((s) => s.key === focusedKey || !hiddenKeys.has(s.key))` — the focused subject (History) is never hideable, matching the wireframe's own note that it should always render ticked and disabled. Do this filtering in one place `body` can reach, not inside `MultiTrend`/`YearTable` themselves — those stay generic.
3. A new `legend` element on the `trend` object (see Part 2 for the type/plumbing this needs): one row per series in `trendData.series` (unfiltered — the full peer list, so a hidden line's checkbox is still there to re-tick), each row a single combined element per the wireframe (`Fullscreen.dc.html`'s `.legend-check`): the series' own real colour (`trendColours.get(s.key)`, from the existing `redesigned`-mode colouring already in this file) filling a checkbox-shaped control, ticked/filled when the line is shown, hollow/unticked when hidden. History's row is `checked`, `disabled`, with a small "always on" label matching the wireframe. Clicking any other row toggles that key in `hiddenKeys`.
4. `TrendChart`'s own legend (`TrendChart.tsx:329`) is the OLD position — the wireframe design moves the legend into the CardBox rail (Part 2), so it no longer belongs under the chart in this `redesigned` path. Either suppress `TrendChart`'s own legend render when the caller is providing its own rail legend (a prop, or check whether `redesigned` already implies it — your call, whichever is the smaller diff), or confirm it was never reached from this path in the first place (the non-`redesigned` path may still want it, for panels other than Column 1's individual-subject Trend — check before removing anything that another column depends on).

## Part 2 — a `legend` slot on the fullscreen rail, above flag/note, divided

**Where:** `src/components/teacher/ColumnPanels.tsx` (the `PanelRender` type, starting `line 34`, and the `<CardBox>` invocation, `lines 96-142`) and `src/components/teacher/CardBox.tsx` (the props list, `line 172` area, and the fullscreen `<aside>` block, `lines 363-386`).

**What to add:**

1. `PanelRender` (`ColumnPanels.tsx:34`): add `legend?: ReactNode;` near `footerLead`/`flag` (currently declared around line 57-59), with a comment matching the style of the others — this round's own addition, for Trend's per-subject show/hide row.
2. `ColumnPanels.tsx`'s `<CardBox>` call (currently `flag={panel.flag}` at `~line 102`): add `legend={panel.legend}` alongside it.
3. `CardBox.tsx`'s props (currently `flag?: ReactNode;` around line 172): add `legend?: ReactNode;` with a comment noting it is a rail-only slot — never rendered on the compact card, only in the fullscreen modal (unlike `flag`, which the footer row also reads on the card; check whether the current footer row or headline treatment reads `flag` outside fullscreen before assuming `legend` needs the same dual path — it likely doesn't, since Guy's own instruction was specifically "put legend at top of column" inside the fullscreen rail, with no card-view equivalent asked for).
4. `CardBox.tsx`'s fullscreen `<aside>` (currently gated `{(flag || note) && (` at `~line 364`, containing a `Flag` `<section>` then a `Your note · private` `<section>`): change the gate to `{(legend || flag || note) && (`, and add a new `legend` `<section>` (heading "Subjects shown", matching the wireframe's own copy) as the FIRST child of the `<aside>`, above the existing two sections, followed by a divider (an `<hr>` or a `border-t` on the next section — match whichever the rest of this file's own convention for that is, there may already be one for the flag/note split you're adding a boundary above) before the flag/note group. Guy's own instruction: "put flag and text and note at bottom of column so we get clear separation between legend selector and other content" — the divider is the point of this change, not decoration.
5. Mobile/stacking: the wireframe's note "put legend at top of column so it appears under the graph in mobile view" describes the SAME rail, just confirming that on a narrow viewport the rail already stacks under the main content (it does — `CardBox.tsx`'s grid is `lg:grid-cols-[...]`, single column below `lg`) and the legend, being first in the rail, is the first thing to appear there. No separate mobile-specific work follows from this — it's a consequence of ordering, already covered by 4 above.

## Part 3 — a Map view on Column 1's Trend panel, reusing the real `RankingsMap`

**Where:** `src/components/teacher/SubjectPanels.tsx` (the `trend.actions`, currently `lines 495-506`, and `trend.body`, `lines 512-535`), `src/components/teacher/RankingsMap.tsx` (read, do not change, unless a prop it needs is missing), and `src/app/teacher/[phase]/page.tsx` (`mapProfiles`, fetched once around `line 182`/`332`, passed to `ComparisonsPanels` at `~line 309` today).

**What to add:**

1. Thread `mapProfiles` (and whatever else `RankingsMap` needs beyond `profiles` — check its full prop list, `RankingsMap.tsx:13-40`, e.g. `targetUrn`, `stage`) from `page.tsx` into `SubjectPanels`'s own props, the same way it already reaches `ComparisonsPanels`. This is a prop-threading change, not a new fetch — the data is already loaded page-wide.
2. Add a third `IconButton` to `trend.actions` (after the existing Chart/Table pair, whichever branch of the `indexedTrend ? (...) : (...)` conditional at `~line 495` applies to History/GCSE): `<IconButton label="Map" active={trendView === "map"} onClick={() => setTrendView("map")}>{MapIcon}</IconButton>` — check whether a `MapIcon` already exists in this file's icon imports (it may, from another panel) before adding a new one.
3. Add a `trendView === "map"` branch to `trend.body` (`~line 512`), rendering `<RankingsMap profiles={mapProfiles} targetUrn={...} stage="ks4" subject={focusedKey} subjectLabel={focusLabel} subjectBucket={...} familyId={...} dense={false} .../>` — pull `subjectBucket`/`familyId` from whatever this file already has for the focused subject (it computes category/family info elsewhere for Trend's own peer-line colouring; reuse that, don't refetch it). `RankingsMap`'s own props (`subject`, `subjectLabel`, `subjectBucket`, `familyId`) exist precisely so a caller can scope it to one named subject rather than the whole school — this is that exact use, just from a new caller.
4. `suggestFullscreen`: `CardBox`'s own prop list already documents this as "for views that read far better with room (Comparisons' map)" — Trend's map is the same shape of problem at card size, so pass it through on the `trend` panel object the same way Comparisons does, unless you judge Trend's existing card-size behaviour doesn't need it (flag whichever you choose).
5. The map's own on-screen chrome (mode buttons, colour scale, size legend, tooltip) is `AcademicMapView`'s own real rendering — nothing to build there; it already does everything the wireframe shows once it's mounted with the right props. The wireframe's few deliberate layout deviations from `AcademicMapView`'s own defaults (colour bar positioned between the zoom control and the mode buttons rather than the real per-corner stack; the dot-size box with no title) are Guy's own explicit instructions for THIS board — if `AcademicMapView` doesn't already support moving these independently of its own defaults, you may need small new layout props on it (or a wrapper) rather than forking the component; check what's cheapest before choosing.

## Part 4 — nothing to build

Confirmed real and already correct, no code follows:

- Trend's multi-subject line chart (`changeScope="individual"`, `SubjectPanels.tsx:192`, wired from `page.tsx:1562`).
- The table's sort arrows and current-sort indicator (`SeriesViews.tsx`'s `head()`, `lines 316-329`).
- The fullscreen footer's `TrendLineToggle` (`SubjectPanels.tsx:488-495`, `PanelFooter.tsx:234`).

If, once you're in the real files, any of these three turn out NOT to already do what this prompt and the brief describe, stop and say so in the build report rather than building a fix that wasn't asked for — the brief's own grounding may be stale relative to whatever's landed on `main` since `dff9ec0`.

## Verification

Same bar as every previous round: `tsc --noEmit`, `eslint`, `next build` clean on every commit. Part 3 mounts a second real Leaflet instance (Column 1's map, alongside Column 3's existing one) — sanity-check that `RankingsMap`/`AcademicMapView` are safe to mount twice on the same page at once (the component's own comments already note it must tolerate two live copies in fullscreen — confirm that extends to two different columns simultaneously, not just two copies of the same column's map).

## Open decisions to flag in the build report

- Part 1: whether `hiddenKeys` resets when the focused subject/scope changes, and why.
- Part 2: whether `legend` needs a card-view (non-fullscreen) path or is fullscreen-only, and what divider convention you used between the legend section and the flag/note group.
- Part 3: how you scoped `subjectBucket`/`familyId` for the map call, and whether `suggestFullscreen` was set for Trend's map the same way Comparisons' is.
- The mockup's mode-button styling (bare pills) versus the real `AcademicMapView`'s own bordered pill-group (`AcademicMapView.tsx:1213-1229`) — which you built, and why.
