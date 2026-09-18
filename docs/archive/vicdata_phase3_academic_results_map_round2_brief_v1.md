# Academic Results — Map round 2 (live feedback on Stage 2 UX round)

Six items, gathered live against vicdata.co.uk after the Stage 2 UX round
(commit a9b5ce3) shipped. One real intermittent bug (item 1) and five
design-parity gaps against Rolls' own `MapView.tsx`, which should be the
literal reference for all of them — copy its real, working code rather than
re-deriving a similar-looking version.

## 1. Real bug: markers sometimes don't render (Trend mode)

Reported live: on Yerbury Primary School, Graphs had real data but the Map
was blank in Trend mode. Switching the colour-by toggle from Trend to Grade
band made the markers appear instantly — and they were still there on
switching back to Trend afterward. Not a data-load issue (data loads fast
when it does show).

This is NOT the known "stale container size" bug the Stage 1 review already
fixed (`AcademicMapView.tsx`'s mount effect already has the
`ResizeObserver`/`invalidateSize()` fix, copied from `MapView.tsx`'s own
2026-09-05 fix) — toggling colour mode doesn't resize the container, and the
marker-drawing effect already re-runs on every `effectiveColourMode` change
(it's in that effect's own dependency array), so whatever's happening is
inside that effect's Trend-mode branch specifically, not a mount/sizing
issue.

Please reproduce live against Yerbury Primary specifically (real URN, not a
guess) with the dev server running, and trace the actual mechanism — don't
guess at a fix without seeing it fail first. Worth checking directly: does
the Trend-mode branch (`effectiveColourMode === "trend"` in the marker loop)
throw or return early for some real data shape a primary school's KS2 data
can have, in a way that could abort the `for` loop or the `.then()` callback
partway through for that render pass; and why a second, successful pass
(Grade band) would leave things in a state where a THIRD pass (back to
Trend) then succeeds too. Full real repro steps and the actual root cause
need to be in the build report, not just "fixed."

## 2. No dotted distance ring

Rolls' own `MapView.tsx` draws a dashed distance ring around the target
school (`L.circle(..., { dashArray: "4 5", ... })`, in its own
`layerGroupRef`, always on the map, never clustered) with a distance label.
Academic's map has nothing equivalent. Add the same real ring, copied from
`MapView.tsx`'s own implementation rather than rebuilt from scratch.

## 3. Legend/key box: wrong position, wrong content, no title/scale labels

Academic's current bottom-left box mixes a paragraph of explanatory prose
with a gradient swatch strip and the exclusion note. Rolls' own map has no
explanatory paragraphs at all — it has a compact `TrendColourKey` (real
percentage-stop swatches with labels) or `SectorColourKey`, positioned on
the RIGHT side of the map (vertically centred in the gap between the
top-right control stack and Leaflet's own bottom-right zoom control, not a
fixed position — see `MapView.tsx`'s own measured `trendKeyBox` effect), and
a separate title.

For Academic: move the colour legend to the same right-of-map position
Rolls' own key uses, give it a real title (not a paragraph), add real scale
labels (the actual stops/values, not just colour swatches), and drop the
explanatory text entirely — Guy's own instruction, "we do not need the
explanatory text."

## 4. No circle-size scale box

Rolls' own `MapView.tsx` has a separate `SizeLegend` component (bottom-left,
`bottom-3 left-3`) showing three real representative dot sizes (min/median/
max of the current set's own range) with their real values labelled next to
each — a genuine scale, not prose. Academic's map has no equivalent at all.
Add the same real component/design, reusing `radiusFor`'s own min/max the
same way `MapView.tsx` does (computed once, shared between the drawing
effect and the legend, not recomputed twice).

## 5. General: match Rolls' map as closely as possible

Not a separate item so much as the standard for 2–4 above and anything else
found along the way — Academic's map should read as the same real map
component wearing different data, not a lookalike with its own take on
layout/behaviour. Where `MapView.tsx` has already solved something (ring,
legends, size scale, positioning), copy it; don't re-derive a similar-but-
different version.

## 6. Default colour mode + toggle position

Change the default colour-by mode from Trend to Grade band. Move the
Trend/Grade-band toggle itself to the LEFT overlay (alongside `ViewSwitcher`)
rather than its current position stacked under `PdfExportButton` on the
right.

## Build notes

Same discipline as every prior round: local build/test only, do not commit,
push, or touch hosted/production. Re-verify item 1 with real execution
against Yerbury Primary specifically (not by inspection alone) and name the
actual root cause found, not just the symptom. Full build report in the
usual shape when done.
