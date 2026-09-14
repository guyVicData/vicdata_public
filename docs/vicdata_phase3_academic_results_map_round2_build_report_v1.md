# Build report: Academic Results Map round 2 (live feedback on Stage 2 UX)

Brief: `docs/vicdata_phase3_academic_results_map_round2_brief_v1.md`. Built and
tested locally only; nothing committed or pushed, per instruction. All six items
touch one file, `src/components/data-view/AcademicMapView.tsx`.

**Browser tool check**: checked at the start of this round (`tabs_context_mcp`) —
still "Browser extension is not connected," consistent with every prior round this
session. No pixel-level screenshot of the map was taken. Item 1's root cause was
found and verified by running the actual production functions directly against real
data via a local dev server (detailed below), not by inspection or guessing — the
closest available substitute for a live repro without a browser.

## Item 1 — real bug: markers sometimes don't render in Trend mode

**What was ruled out first, by real execution, not assumed:** the brief's own lead
("does the Trend-mode branch throw for some real KS2 data shape") was checked
directly against Yerbury Primary School (URN 100429) before touching any code. A
script imported and called the actual production functions
(`fetchAcademicProfiles`, `stageYears`, `headlineValueAt`, `trendBadge`,
`trendColour`) and ran the *exact* Trend-mode computation the marker loop performs —
first for Yerbury alone, then for Yerbury's own real default nearest-10 comparator
group (11 schools total, via `findSurroundingSchools`):

```
Trend loop completed fully: 11/11 processed, no throw.
Grade-band loop completed fully: 11/11 processed, no throw.
```

Every school's real KS2 data computes cleanly in both modes — **this is not a
data-shape throw**. That theory is ruled out with real evidence, not just
disbelieved.

**The actual root cause**, found by direct comparison against Rolls' own
`MapView.tsx` (the literal reference this whole round is built against): that
component has a real `mapReady` React **state** flag, set via `setMapReady(true)`
inside its own async Leaflet-init effect, and included in its marker-drawing
effect's dependency array. `AcademicMapView.tsx` had no equivalent — its drawing
effect only ever checked `mapRef.current`/`layerGroupRef.current`, which are plain
refs. Mutating a ref does **not** cause React to re-run effects.

The actual mechanism: `L.map()` and the layer group are created **asynchronously**,
inside `import("leaflet").then(...)`. The marker-drawing effect's guard returns
early if those refs are still null. If that effect's very first invocation (at
mount) happens to run *before* the async Leaflet init resolves — a real, measurable
gap on a cold `"leaflet"` chunk load, shrinking to near-zero once the module is
already warm from an earlier visit in the same browser session — **nothing ever
forces a retry** once the refs finally become non-null, since nothing else
necessarily re-renders this component afterward. The map sits silently blank until
some *unrelated* prop/state change happens to re-render it anyway (masking the bug
most of the time — hence "intermittent"), or until a user manually toggles the
colour mode, which **is** a real state change (`setColourMode`) and therefore
reliably forces a fresh, by-then-definitely-ready run of the drawing effect. There
was never anything Trend-specific about the failure — Trend simply happened to be
whichever mode was active on the losing first pass; the exact same race would show
up in Grade band instead if Grade band were the default at the moment of the losing
race. (This is also why item 6's default-mode change on its own would not have
fixed this — it just relocates which mode the bug is first seen in.)

To confirm the shape of this race concretely rather than asserting it, a small
isolated timing model (not a full React/DOM harness — no browser tool available —
but a faithful model of the exact scheduling pattern) was run:

```
Case 1 (current shape, no later re-render, cold leaflet load): draws = 0  (blank map, matches the bug)
Case 2 (current shape, one later incidental re-render at +80ms): draws = 1  (looks fine — "intermittent")
Case 3 (current shape, warm leaflet module): draws = 1  (looks fine — "usually works")
Case 4 (WITH mapReady state, cold leaflet load): draws = 1  (always eventually draws)
```

**Fix**: added a real `mapReady` state to `AcademicMapView.tsx`, set inside the
mount effect right after `mapRef.current`/`layerGroupRef.current` are assigned —
ported directly from `MapView.tsx`'s own mechanism, not invented fresh. Both the
drawing effect and the new legend-position measurement effect (item 3) now guard on
and depend on `mapReady`, guaranteeing at least one genuine re-run once the map is
truly ready, regardless of anything else happening to re-render the component.

**Known residual gap, shared with the reference, not introduced or fixed this
round**: neither `MapView.tsx` nor this fix resets `mapReady` to `false` if the
*target school itself* changes without a full component remount (the `useState`
initial-value semantics mean a same-value `setMapReady(true)` on a second mount
doesn't force a new render on its own). Flagging this rather than silently
patching past what the reference implementation itself does — worth a look if a
future round ever finds the Map going blank specifically after switching target
schools mid-session, as opposed to this round's actual reported symptom (blank on
first load of a given school).

## Item 2 — distance ring

Added the same real dashed ring `MapView.tsx` draws (`L.circle(..., { dashArray: "4
5", weight: 1.25, fill: false, interactive: false })`, distance label via
`L.divIcon`), drawn into the same always-on layer group, before the school markers,
matching that component's ordering and CSS-variable-based colour
(`--distance-ring`, light/dark). `AcademicSchoolProfile` has no per-school
`distanceKm` field the way Rolls' `DefaultListEntry` does (confirmed directly — not
fetched anywhere in this module), so this always uses the same fixed,
sector-aware radius `MapView.tsx` itself falls back to when it has no real distance
data to compute a dynamic ring from (2km state / 10km independent, keyed off
`establishmentTypeGroup === "Independent schools"`) — the correct behaviour given
what data actually exists, not a shortcut around the dynamic version.

## Item 3 — legend/key box: position, content, real scale labels

Replaced the old bottom-left prose-plus-swatch-strip box with the same
measured-gap, right-of-map positioning `MapView.tsx`'s own `TrendColourKey` uses
(a `trendKeyBox` effect, ported directly, centred in the real gap between the
top-right control stack and Leaflet's zoom control). Two real keys, matching
whichever colour mode is active:
- **Trend mode**: `TrendColourKey`, identical to Rolls' own — same five real
  percentage stops, same gradient, titled "Growth".
- **Grade-band mode** (Academic-only, no Rolls equivalent to copy): a new
  `GradeBandColourKey`, reusing the *same* `trendColour`/`TREND_LEGEND_STOPS`
  diverging scale the marker loop itself already keys grade-band colour off
  (`trendColour(gradeValue - 50)`) — so its stops are the same -30/-10/0/+10/+30
  values re-centred on 50 (20%/40%/50%/60%/80%), not a second, separately-invented
  scale. Titled "Grade band."

The explanatory paragraph is gone entirely, per Guy's own instruction ("we do not
need the explanatory text").

## Item 4 — circle-size scale box

Added a `SizeLegend` component, same design and position (`bottom-3 left-3`) as
`MapView.tsx`'s own: three representative dot sizes (min/median/max of the current
set's real range) drawn at their real on-map radii, each labelled with its real
value. `minSize`/`maxSize` are now computed once at render time via `useMemo`
(previously computed inside the drawing effect and thrown away every run) and
shared by both the legend and the drawing effect, so they can never silently
disagree — same discipline as `MapView.tsx`'s own `values`/`minV`/`maxV`.

The GCSE/KS5-cohort exclusion notes (no Rolls precedent — Academic-specific) needed
a home once the old prose box was removed; kept as their own small stacked boxes
directly below the size legend, same corner, rather than folded back into a
paragraph.

## Item 5 — general parity

Addressed throughout items 1-4 and 6, not separately: the ring, both colour keys,
and the size legend are all copied from `MapView.tsx`'s own real, working code
(exact CSS classes/positions/z-index, the same measured-gap technique, the same
`radiusFor`/`trendColour` functions), not re-derived lookalikes.

## Item 6 — default colour mode + toggle position

`colourMode` state's initial value changed from `"trend"` to `"grade_band"`. The
Trend/Grade-band toggle moved from the top-right stack (previously stacked under
`PdfExportButton`) into the left overlay, alongside `ViewSwitcher`, in its own
box. The top-right stack now holds only `PdfExportButton`.

## Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on `AcademicMapView.tsx`: clean (one stray now-satisfied
  `eslint-disable-next-line react-hooks/exhaustive-deps` comment was found and
  removed along the way).
- `npm run build`: clean, full production build.
- Real execution, not just code inspection, for item 1: both the data-throw
  elimination and the scheduling-race model above were run against real data /
  a faithful timing model, not asserted.
- **Not verified**: the actual visual rendering of any of the six items in a real
  browser (ring position/label, legend position and real scale values on screen,
  size-legend dot sizes, the moved toggle, and — most importantly — that the
  reported "blank map" genuinely no longer happens on a real cold load of Yerbury
  Primary's Map view) — no Claude-in-Chrome connection this session, flagged
  plainly rather than implied. The `mapReady` fix is a direct, verified port of a
  mechanism already proven to work in Rolls' own shipped `MapView.tsx`, and the
  isolated timing model above demonstrates the fix closes the exact race
  identified — but the literal live page has not been watched load.

## Confirmations

- Nothing committed or pushed; nothing written to hosted/production. `git status`
  shows only `AcademicMapView.tsx` modified, no staged changes.
- Local dev server stopped; the temporary verification scripts live only in this
  session's own scratchpad directory, not in the repo.
- Stopping here, as instructed — Guy will check Yerbury Primary's Map view (Trend
  mode, on a fresh load) and the five parity items against Rolls' own map himself.
