# Teacher view — Rankings map, round 4: subject-aware headline, non-cropping hover, colour scale back — build report

Covers `vicdata_phase3_teacher_view_rankings_map_round4_headline_hover_colourscale_brief_v1.md`, all three fixes. Three files changed: `AcademicMapView.tsx`, `RankingsMap.tsx`, `[phase]/page.tsx`.

## 1. "N of M" follows the active subject

- **`AcademicMapView`** gains an optional `onTargetRank?: (info: { rank; total } | null) => void`. It is fired from an effect keyed on the target's rank, the total and the target URN. The rank is not recomputed: the existing `rankDescendingWithTies(...)` memo already returns `targetRank` (which the component was discarding) and `total`. It ranks `rowDataByUrn`'s `avgValue`, which is the subject's own score in subject mode, over schools that have a figure. The callback is held in a ref, so a caller's fresh function doesn't re-fire it.
- **`RankingsMap`** threads the prop through.
- **Page:** new state `mapRank`, and `onTargetRank={setMapRank}` on the card's map.
- **The "N of M" block:** when a chip is active and the map is drawn, it shows `mapRank` ("5 of 9") with "among the nearest schools with data, on {chip legend} avg. point score" (the map's own subject-tooltip wording). While the map is still loading it reads "Loading the map…"; if the school has no score in that subject, "No {subject} points score for this school to rank."
- **With no chip active** (or no neighbours, so no map), the block is exactly as before: `position`, `headlineLabel`, same text.

## 2. Hover info in a fixed bar at card size

In dense mode the markers no longer `bindTooltip`. Instead, `mouseover`/`mouseout` send the **same** content (the school's name, "(this school)" for the target, and the tooltip's own `lines` with their bold figures and years) to a bar pinned across the top of the map. That space is free because the dense map hides the toggle. The bar is styled like the bottom caption (10px, translucent rounded background), stops short of the colour strip, and appears only while a dot is hovered. Fullscreen keeps the floating tooltip unchanged.

**A real bug found and fixed in verification:** the first version kept the hover state in `AcademicMapView` itself. A state change there re-renders the component, and because `withCoords` is rebuilt every render, that re-runs the marker-drawing effect: every dot was redrawn and the hover wiped the instant it appeared. Typecheck and lint were clean; the headless probe caught it, because the hovered dot came back detached from the page. The hover state now lives in a small `DenseHoverBar` child that owns it. The markers call its setter through a ref, so hovering re-renders only the bar, never the map. This is deliberately not fixed by memoising `withCoords`, which would have changed the Data View's render path.

## 3. Compact colour scale on the right

Where dense mode had `null`, it now renders a slim vertical strip: `absolute right-2 top-2 bottom-[84px]`, 7px wide, rounded, with no title and no labels, stopping above Leaflet's zoom control. The gradient is built exactly as `GradeBandColourKey` builds it, from the same stops (`familyId ? gradeBandLegendStopsForFamily(familyId) : GRADE_BAND_LEGEND_STOPS`), reversed so the highest value is at the top. So the strip, the dots and the fullscreen key cannot disagree. It is grade band only, since dense has no Trends toggle. The fullscreen `GradeBandColourKey` / `TrendColourKey` are untouched.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on all three files; `next build` passes.

**Real map, real data.** A temporary local harness (deleted, not committed) rendered the real `RankingsMap` for Acland Burghley's real Nearest 10, with dense and fullscreen side by side. It printed each map's reported rank next to an independent rank computed directly from the profiles' subject scores. Headless Chrome was driven over the DevTools protocol.

**Rank:**

| Subject | Reported (dense and full) | Independent |
|---|---|---|
| GCSE Biology | 4 of 9 | 4 of 9 |
| GCSE History | 5 of 9 | 5 of 9 |
| Post-16 Geography | 7 of 7 | 7 of 7 |

With no subject, the reported rank is simply unused and the whole-school sentence is unchanged.

**Hover:** the topmost and the rightmost dot were hovered on each map, by dispatching the DOM `mouseover`/`mouseout` events Leaflet listens for. Synthetic mouse moves didn't reach Leaflet in headless Chrome, for fullscreen's untouched tooltip too, so that was a test-harness limit.
- **Dense:** the bar showed exactly the tooltip content, e.g. "St Aloysius' College · 15 entries in Biology (2024/25) · 8.1 avg. point score (2024/25)", and at the edge "Lift Beacon High · 21 entries in Biology (2023/24) · 4.8 avg. point score (2023/24)". It sat fully inside the map, with no floating tooltip, and cleared on mouse-out. The dot stayed attached (no redraw).
- **Full:** the floating tooltip showed the same text; there was no bar.
- The same held for GCSE History (light) and Post-16 Geography (dark).

**Strip:** present only on the dense map. It was Sciences & Maths blue for Biology (from `#1d4ed8`), Humanities amber for History and Geography (from `#b45309`), and the plain blue ramp with no subject (`#1e3a8a` → `#bfdbfe`). The fullscreen map had no strip and kept its full titled key with three numeric stops.

**Data View unaffected:** it passes neither `dense` nor `onTargetRank`. Its non-dense markers still `bindTooltip` exactly as before, the dense-only bar and strip never render there, and the rank memo's output is unchanged (it merely also exposes `targetRank`).

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, both phases, both themes:
1. "N of M" names and ranks the ticked subject, and is unchanged with none ticked;
2. hovering dots near the card's edges shows the top bar, never clipped;
3. the right-edge strip takes the category colour;
4. fullscreen has its floating tooltip and full key.
