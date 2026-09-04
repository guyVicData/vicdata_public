# Map viewport tightening, independent/FE distance cutoff, collapsible boxes

2026-10-02. `src/components/SchoolMap.tsx`, `src/components/MapFilterPanel.tsx`,
`src/components/MapColourKey.tsx`, `src/components/MapBoxCollapseToggle.tsx` (new),
`src/app/api/schools-in-bounds/route.ts`.

## 1. Initial state-school viewport too wide on load

Root cause was **not** the `MIN_INITIAL_ZOOM=14` cap the task description suspected
— confirmed live (Playwright, headless Chromium, real dense case: Acland Burghley
School, Camden, 1280×560 container) that at the old `DISTANCE_RING_KM_STATE=5`, the
ring's own natural zoom for a 5km ring never approached the 14 ceiling at all. The
real driver is the init effect's own aspect-ratio stretch (`halfWidthM = ringM *
aspect`): the real initial viewport measured **24.3km × 11.1km**, nearly 2.5× the
nominal 5km ring's own diameter. That box held **696 real state schools** (live DB
query), comfortably tripping `STATE_CAP` even after item 2's raise — the real,
confirmed cause of "state schools don't show on load" in a dense area.

Fix: `DISTANCE_RING_KM_STATE` 5 → **2**. Re-measured live: same Acland Burghley
container now shows **118 real state schools**, comfortably under the new cap.
Sanity-checked against a genuine rural case (John Kyrle High School, Herefordshire):
**6 real state schools**, still a real non-empty view, not tightened into blankness.
`MIN_INITIAL_ZOOM` left untouched — not the binding constraint at this ring size.

## 2. STATE_CAP raised 150 → 250

A cap raise alone would not have fixed item 1 (696 vastly exceeds even a generously
raised cap) — the two fixes are complementary, not alternatives, and the code
comment now says so explicitly. Combined worst case (`STATE_CAP + INDEPENDENT_CAP =
250 + 250 = 500`) matches the old pre-split shared cap exactly, not a new high-water
mark. The original split-cap rationale comment (2026-08-28) is kept alongside the new
paragraph rather than overwritten.

## 3. Independent/FE hard 10km distance cutoff

`INDEPENDENT_CAP`/`FE_CAP` unchanged. Both queries previously had **no** distance
filter at all — pure viewport bounding boxes; `DISTANCE_RING_KM_INDEPENDENT` was only
ever a decorative reference ring, never a query constraint, and never applied to FE.

Real fix, anchored to the **viewed school's own position** (not the pan/zoom
center — a fixed circle, so panning directly onto a school 11km away never surfaces
it): the viewed school's easting/northing is now resolved server-side from
`viewedUrn` (`lookupViewedSchoolCoords`, a new small anon-client lookup run in
parallel with the existing `checkMembership` call) — never trusted from the client.

PostgREST's fluent query builder can't express `sqrt(dx²+dy²) <= 10000` as a WHERE
clause without a dedicated RPC, so the real filter is two-stage: (1) SQL-level, the
independent/FE queries' bounding box is intersected with a square
(viewedEasting/Northing ± 10km on each axis) — the circle is inscribed inside that
square, so every genuine within-10km candidate is guaranteed to survive; (2) JS-level,
an exact `Math.sqrt(dx*dx + dy*dy) <= 10000` filter on the returned rows discards the
square's own corner cases. Over-cap detection runs on the **post-refine** count, not
the pre-refine SQL result, so a corner-heavy square never under- or over-counts a
sector's real over-cap state. No `.limit()` on the SQL stage for these two buckets —
the square is a fixed ≤400km² area regardless of viewport, structurally far below
PostgREST's own 1000-row default cap for any real UK location. Falls back cleanly to
the old viewport-only query (with its original `CAP+1` limit trick) when
`viewedCoords` can't be resolved.

### Verified live

Real dense case: Glendower Preparatory School, Kensington (URN 100508). Real
viewport captured live: 48.5km × 22.1km (Independent's own ring, untouched by item
1's state-only fix — expected).

- Live DB check: 358 real independent schools existed in that raw viewport bounding
  box; **133 of them are beyond 10km** (up to 26km away) — real candidates that would
  have shown before this fix.
- Live route response: **225 independent schools returned, max real distance
  9.98km** — exactly matching the live DB's own "within 10km" count (225). **55 FE
  schools returned, max real distance 9.43km.** Zero returned candidates beyond
  10km in either sector.
- Rural sanity check (John Kyrle, Herefordshire): 0 independent/FE schools nearby —
  handled gracefully, no error, no crash, cap flags all `false`.

## 4. Independent minimise/expand for Filters / Colour by / Size

New shared component, `MapBoxCollapseToggle.tsx` — one chevron button (top-right,
rotates from pointing-down/expanded to pointing-right/collapsed), used identically
by all three boxes so their button style/position can't drift apart. Each box keeps
its own local `useState` — collapsing one never affects the others. Collapsed state
shows title + arrow only; expanded is byte-identical to the pre-existing markup.

Verified live (Playwright): all three boxes' collapse buttons found and clickable;
collapsing one confirmed to leave the other two untouched (independence check); each
box's own re-expand restores its exact prior content.

## 5. Persistent focus-card tooltip collapse

Same visual language as item 4, but implemented as raw DOM/CSS rather than React —
the `.vd-focus-card` is a Leaflet tooltip HTML string (`buildPopupHtml`), not a
React-rendered component. `buildPopupHtml` gained a `collapsible` parameter
(default `false`, so every ordinary neighbour hover popup is byte-identical to
before); when `true` (only the viewed-school's own persistent tooltip), the name
sits in its own header row next to a collapse button, and everything else (roll,
caveat, member-detail rows) is wrapped in one `.vd-popup-detail` div that CSS hides
as a whole when a `.vd-focus-collapsed` class is present on the tooltip's own root.

Two real bugs caught live during verification, both fixed before calling this done:

- **Unclickable button**: Leaflet tooltips default to `pointer-events: none`
  (`leaflet.css`'s own `.leaflet-tooltip` rule) — a real Playwright click attempt
  timed out, the map underneath intercepted every pointer event even though the
  button was visible and "actionable" by every other check. Fixed by adding
  `interactive: true` to this one tooltip's own `bindTooltip` options (Leaflet's own
  mechanism for exactly this, applies the `.leaflet-interactive` class that flips
  pointer-events back to `auto`) — scoped to only the focus-card tooltip; ordinary
  neighbour popups stay non-interactive, unchanged.
- **Collapse state resetting on pan**: the focus card is rebuilt from scratch on
  every `draw()` call (colourMode/filter/viewport changes all trigger a redraw), so
  a plain per-render boolean would silently re-expand on the next pan. Fixed with a
  `useRef` (`focusCardCollapsedRef`) that survives redraws within the page load
  (matching every other collapse state on this page: local, not persisted across an
  actual reload) — re-verified live via a real mouse-drag pan after collapsing:
  state held.

### Verified live

Glendower Preparatory School page: expanded text `"Glendower Preparatory School
(London)\nTotal roll: 292"`; after clicking the collapse button, text is exactly
`"Glendower Preparatory School (London)"` (name only, `.vd-focus-collapsed` class
present); after a real drag-pan (triggering a live redraw), still collapsed,
still name-only; re-expand restores the exact original text.

## Checks

`tsc --noEmit` and `eslint` clean on every touched file (one pre-existing,
unrelated `isFullscreen` unused-var warning, not introduced by this round). All
five items verified against real, live data/interaction — no item called done on
assumption alone. Scratch scripts (`_scratch_measure_map.mjs`,
`_scratch_check_density.ts`, and this round's item-3/4/5 verification scripts)
deleted after use, per convention.
