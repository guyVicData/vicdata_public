# Data View: global phase-band ages, Senior/Special renames, filter-row rework, fullscreen

Eight items, built on top of the sidebar/Graphs/Rankings restructure and its
three follow-up rounds (`docs/vicdata_data_view_sidebar_graphs_rankings_restructure_v1.md`).
Given its own doc since this round's scope reaches beyond Graphs/Rankings —
`typology.ts`'s shared boundaries, the public map, and narrative generation all
change too. Commit: `4ec370f`.

## 1 — Phase-band ages made global

`phaseTagAgeRange()` (`typology.ts`) is the one shared function behind six real
call sites: the Data View's own filter pills (`data-view-filters.ts`'s
`ageRangeForBand`), the public map's phase-band roll sizing
(`schools-in-bounds/route.ts`), the individual school page's own map dot sizing
(`schools/[urn]/page.tsx`), and narrative generation (`narrative.ts`/
`narrative-lookup.ts`). Redefined once, there, rather than per call site.

New boundaries:
- **Junior**: floor is now a fixed age, `PHASE_BAND_JUNIOR_FLOOR_AGE = 4`
  (reception), not the school's own raw `lowAge` — a through-school's raw
  `lowAge` can be below 4 (nursery provision folded into its registration),
  which used to make Junior's range overlap the Data View's separate "Early
  Years" band at the shared boundary.
- **Prep**: unchanged (`11` to the school's own `highAge`) — already correct,
  only ever relevant when `highAge` is 12–14.
- **Senior**: upper bound now capped at `15`, not the school's own `highAge`.
- **Post 16**: unchanged — `16` to the school's own real `highAge`, deliberately
  **no** hard cap at 18. A real, documented population of schools has statutory
  high age 19; capping at 18 would leave their 19-year-olds with no band.
- **Early Years** (0–3, a Data-View-only `PhaseBandKey`, not a typology.ts
  `PhaseTag` at all): ceiling is now `PHASE_BAND_EARLY_YEARS_CEILING_AGE = 3`
  (`typology.ts`), a **new, separate** constant from
  `EARLY_YEARS_PROXY_AGE_THRESHOLD` (`narrative-config.ts`) — that one is a
  genuinely different concept (a data-reliability proxy, ~86.9% accuracy
  against a real GIAS field, also driving narrative sentences and LA-peer-
  averaging floors) that happened to equal 5 by coincidence, not a phase-band
  boundary. Left completely untouched, still doing its own separate job
  (confirmed: `data-view-filters.ts`'s `relevantAgeBandsFor` still uses it for
  its own, different purpose — UI relevance, not the age range itself).

Without the Junior/Senior changes, a through-school ticking both Senior and
Post 16 independently in the Data View double-counted every pupil aged 16–18
(Senior's old range ran all the way to `highAge`, overlapping Post 16's own
`[16, highAge]`); a school with nursery-age pupils double-counted at the other
end (Junior's old floor was the raw `lowAge`, which could dip into Early
Years' own `[0, 4]` range).

### Two real regressions caught and fixed

Capping Senior's range at 15 would have broken three **other** real consumers
that relied on Senior's *old* range reaching the school's real `highAge` to
find genuine sixth-form pupils — because `phaseTags()` (a separate, unchanged
function) structurally never assigns a school **both** "Senior" and "Post 16"
tags at once (an earlier deliberate decision, documented in `typology.ts`
already). A Junior+Senior through-school's real ages 16–`highAge` would
otherwise have had **no tag to be counted under at all**, not double-counted
anywhere — a silent data-loss bug, not a double-count:

- `narrative-lookup.ts`'s `reliableSeniorHeadcounts` (drives the individual
  school page's own secondary/sixth-form narrative split).
- `schools-in-bounds/route.ts`'s `byPhase` loop (the public map's phase-band
  roll sizing).
- `schools/[urn]/page.tsx`'s identical `byPhase` loop (that page's own map
  centre-dot sizing).

Fixed in all three by keeping Senior's own upper search bound at the school's
real `highAge` specifically in these call sites (they have no competing
"Post 16" tag that could ever double-claim the same pupils), while the shared
`phaseTagAgeRange` function itself stays capped at 15 everywhere else — which
is what the Data View's own independently-tickable Senior/Post-16 pills
actually needed the cap for.

### Verification

Real login, real profile fetch, live local server. A real Junior+Senior
through-school (Children's Hospital School at Gt Ormond Street and UCH, urn
100060, `lowAge=4, highAge=18`) now partitions cleanly across all four bands
(Early Years `[0,3]`, Junior `[4,10]`, Senior `[11,15]`, Post 16 `[16,18]`) —
confirmed by enumerating every age 0–19 and checking no age falls in two
bands' ranges at once. Real per-band pupil counts through the live
`filteredCount` pipeline: Junior=57, Senior=61, Post16=17 (sum 135), against a
real whole-school total of 138 — a small, plausible real gap, not a bug.
Direct `phaseTagAgeRange` checks confirmed `Post16(16,19)` still returns
`[16,19]` (no hard cap at 18) and `Junior(7,10)` returns `[7,10]` unchanged
(the floor only clamps when the school's own `lowAge` is genuinely below 4).

**Not independently verified**: the narrative-lookup.ts fix specifically
(confirmed correct by code-level trace — it now searches up to the real
`highAge` for sixth-form pupils, identical to the pre-change behaviour — but
not re-run against a live narrative sentence, since that page wasn't part of
this round's own verification script).

## 2 — Renamed for display only: Senior → Secondary, Special Schools → Special

Both are display-label swaps, not renames of the underlying identifiers —
`"Senior"` (a `PhaseTag`/`PhaseBandKey` value) and `"Special Schools"` (a
`SectorTag` value) stay exactly as they are everywhere used as data: colour
lookups (`TAG_COLOURS`), sector-matching comparisons, saved filter state,
GIAS-derived tag assignment. `typology.ts`'s own `SPECIAL_SCHOOLS_GROUP`
(`"Special schools"`, lowercase — the real GIAS `establishment_type_group`
database value) is a completely different string, untouched.

New shared `tagDisplayLabel()` (`typology.ts`) — same shape as the existing
`PHASE_BAND_PROSE`/`relevantAgeBandsFor`'s own `{key, label}` precedent, a
label lookup, not a second copy of the type. Routed through every real
rendering site found by grep and manual classification:

- `TypologyTags.tsx` (the individual school page's own tag pills) — colour
  lookup stays keyed by the real value, only the rendered text changes.
- `FilterBar.tsx`'s Phase/Sector pills.
- `MapFilterPanel.tsx` (the public map's own filter panel).
- `SchoolMap.tsx`'s colour-key legend and `MapView.tsx`'s own Data-View map
  sector legend.
- `AddSubtractSchoolsWindow.tsx`'s group headers ("Group by: Sector/Phase")
  and the per-school sector-dot tooltip.

**Deliberately left untouched**: `narrative.ts`/`narrative-lookup.ts`/
`surrounding-summary.ts`'s own prose generation (worked-example sentences
like "Leighton Park School is a large independent boarding & day senior
school"), which already renders its own lowercase, grammatically-integrated
words ("senior", "special school") via a separate, pre-existing convention —
explicitly out of scope per the handoff's own framing (pill labels, chart
titles, map legend, card headings), confirmed by reading each site directly
rather than assumed.

## 3 — Saved Sets moved into "My sets"

`SavedSetsControl` (the recall dropdown + Save-set button/naming flow) moved
out of `FilterBar.tsx`'s own `extra` slot (now removed entirely — the whole
`extra` prop is gone) into `ComparatorSidebar.tsx`'s existing "My sets"
section, right below the per-set recall buttons. Same component, unchanged,
just relocated. `ComparatorSidebar` gained two new props for the save half it
didn't have before (`onSaveSet`/`canSaveSet`, same shape as
`SavedSetsControl`'s own `onSave`/`canSave`), threaded from `DataViewShell`
(the actual `saved_sets` read+write mechanism, unmoved).

Flagged, not solved, per direct instruction: "My sets" now has two ways to
recall a saved set (the per-set button list, and `SavedSetsControl`'s own
dropdown) — left exactly as-is, not rationalised.

## 4 — Top filter row: show everything, darken inactive, caret on Phase

Reverses the "only show filters relevant to this school" behaviour from two
earlier rounds — an explicit experiment, not a settled decision.
`relevantAgeBandsFor`'s gating, `showBoarding`, and `sectorOptions.length > 1`
are all removed from `FilterBar.tsx`; the full `PHASE_BANDS`/
`GENDER_OPTIONS`/`BOARDING_OPTIONS`/`SECTOR_OPTIONS` vocabularies render every
time now, regardless of whether they apply to the current target. An
inapplicable pill still narrows to a real, honest zero when ticked (same
"many schools will show a real, honest zero" note as item 1) — it just isn't
hidden pre-emptively anymore. `relevantAgeBandsFor`/`hasRealBoardingProvision`
themselves are untouched — still used elsewhere (e.g.
`AddSubtractSchoolsWindow.tsx`'s own "Group by phase" grouping).

Inactive pills are now genuinely darkened: a filled dark-neutral background in
both themes (`bg-neutral-800` light / `bg-neutral-950` dark, both with their
own border), not just an outlined, muted-text pill as before. Phase/age pills
get a small `▾` caret glyph (they open a nested "Ages:" drill-down when
selected alone); Gender/Boarding/Sector pills don't, since they have no
nested menu.

## 5 — Y-axis zoom floored

`CombinedRollChart.tsx`/`TargetRollBarChart.tsx` both zoom `minY` to
`Math.max(0, rawMin - pad)`, `pad` being 15% of the real span — for a large
aggregate number moving by a genuinely modest few percent, this could zoom so
tight the chart read as a near-collapse. Floored:
`minY = Math.min(Math.max(0, rawMin - pad), maxY / 2)` — never zooms in past
showing half the real total, even if the actual min/max span would allow a
tighter fit. A genuinely dramatic real swing (span already over half of
`maxY`) is unaffected by the floor and still zooms to show its real shape.

## 6 — Chart axis labels widened

Same root cause in all four axis-based SVG charts (`TargetRollBarChart.tsx`,
`CombinedRollChart.tsx`, `RollTrendsChart.tsx`, `AggregateTrendChart.tsx`,
confirmed identical code in each): Y-axis tick labels are right-anchored 8
units inside a `PAD.left` of 44–52, and X-axis year labels are centre-anchored
inside a `PAD.right` of just 16 — both margins were tight enough that a wide
label (a 5-digit roll, or the full width of "2025/26" at the very right edge)
spilled past the SVG's own clipped boundary. `PAD` widened to
`{ top: 16, right: 32, bottom: 28, left: 64 }` in all four, consistently.

## 7 — DivergingBarChart decline-bar cropping: investigated, not confirmed

Real bug reported, but genuinely couldn't be pinned down from reading
`DivergingBarChart.tsx` alone — its left/width percentage math for a decline
bar (`left: 50 - widthPct`, `width: widthPct`) is mathematically bounded
(`widthPct` can never exceed 50, since `maxAbs` is a `Math.max` over the same
real values `widthPct` itself divides by), so it shouldn't clip in isolation.
The Chrome extension was unreachable throughout this round, so this could not
be confirmed live either — **not fixed blind**, per direct instruction.

Applied two low-risk, defensible changes without claiming they're the
confirmed root cause: widened the fixed value column from `w-12` (48px) to
`w-16` (a longer formatted value like `-45.2pp`, 7 characters, is genuinely
tight to fit at `text-xs`/`tabular-nums` in 48px — a concrete, measurable
issue, unlike the bar-clipping mechanism itself); and added `min-w-0` to the
bar track defensively (a flex item's default `min-width: auto` can prevent it
shrinking below its own content in a genuinely narrow container — plausible
now that Section 02 is side-by-side, though this bar track's own content has
no obvious large intrinsic width, so this may not be the actual mechanism).

**Needs a live check with real decline data next round** before considering
this closed.

## 8 — Fullscreen expand on every chart

New `Card`/`FullscreenChartModal` in `GraphsView.tsx`. Every chart card
(11 call sites, every `<Card>` in the file) gets a small expand icon,
top-right. Clicking it opens that one chart in a fixed fullscreen overlay
(`z-[1500]`).

- **The chart's own legend travels automatically**: the modal re-renders the
  exact same `children` React nodes as the inline card, not a separately
  extracted "just the chart" — since `RollTrendsChart`/`AggregateTrendChart`
  already render their own legends as part of their own output, re-rendering
  the same children brings the legend along by construction, not a second
  mechanism that could drift.
- **The main "Add/subtract schools" window is reachable from fullscreen**: its
  open/closed boolean was lifted from `ComparatorSidebar.tsx` (previously
  local state there) up to `DataViewShell.tsx`, so both `ComparatorSidebar`'s
  own trigger button and the new fullscreen modal's own "Add/subtract
  schools" button control the same state.
  `AddSubtractSchoolsWindow.tsx` itself still renders from inside
  `ComparatorSidebar` unmoved — it's already a `fixed inset-0` overlay at
  `z-[2000]`, so it layers correctly on top of the new fullscreen chart modal
  regardless of which component actually renders it.

**Not independently verified**: a UI-interaction feature with no real-data
component a script can check, and the Chrome extension was unreachable this
round — confirmed only by code review (the z-index layering, the props
threading, the shared-children legend mechanism), not a live click-through.

### Files changed

- `src/lib/typology.ts` (items 1, 2)
- `src/lib/data-view-filters.ts` (item 1)
- `src/lib/narrative-lookup.ts` (item 1's regression fix)
- `src/app/api/schools-in-bounds/route.ts` (item 1's regression fix)
- `src/app/schools/[urn]/page.tsx` (item 1's regression fix)
- `src/components/TypologyTags.tsx`, `src/components/MapFilterPanel.tsx`,
  `src/components/SchoolMap.tsx` (item 2)
- `src/components/data-view/FilterBar.tsx` (items 2, 3, 4)
- `src/components/data-view/AddSubtractSchoolsWindow.tsx` (item 2)
- `src/components/data-view/MapView.tsx` (item 2)
- `src/components/data-view/ComparatorSidebar.tsx`,
  `src/components/data-view/SavedSetsControl.tsx`,
  `src/components/data-view/DataViewShell.tsx` (items 3, 8)
- `src/components/data-view/CombinedRollChart.tsx`,
  `src/components/data-view/TargetRollBarChart.tsx` (items 5, 6)
- `src/components/data-view/RollTrendsChart.tsx`,
  `src/components/data-view/AggregateTrendChart.tsx` (item 6)
- `src/components/data-view/DivergingBarChart.tsx` (item 7)
- `src/components/data-view/GraphsView.tsx` (item 8)

Commit: `4ec370f`.

## Follow-on fix — TargetRollBarChart's first/last bar overlapped the axis margins

Reported against a real live screenshot of "ROLL SINCE 2019/20" on
vicdata.co.uk (commit `09c4726`): item 6's `PAD` widening enlarged the margin
reserved for axis labels but never stopped bars overhanging into it. Root
cause was paint order, not the bounded-values check item 6's own report
already did — bars paint *after* the Y-axis gridlines/tick text, and the old
x-scale centred the first bar exactly at `PAD.left` with no inset, so with
`barWidth` up to 36px the bar's left edge sat 18px inside the label margin;
every bar reaches the chart floor, so any tick label whose height fell within
a bar's reach got painted over (ate the "0" off "960," left "96").

Fixed with a band inset of half the bar width
(`bandInset = barWidth / 2`, `plottableW = innerW - bandInset * 2`), so no
bar edge can cross `PAD.left`/`WIDTH - PAD.right` regardless of data.
`barWidth` now computed before `x` (its own plottable width depends on it).

**Verified numerically**, not visually — the Chrome extension was
unreachable again this session. Using the chart's real constants and a real
dataset (Acland Burghley School, 7 real periods 2019–2025): the old x-scale
put the first bar's left edge at `x=46`, 10px into the Y-tick label's own
text area (which ends at `x=56`) — reproducing the exact reported mechanism.
The new x-scale puts it at `x=64`, flush with the margin, 8px clear of the
label. The same computation also caught an identical, previously-unreported
18px overhang on the *last* bar's right edge past `WIDTH - PAD.right`, now
also resolved. This is a stronger check than item 6's own "values are
bounded" verification, which is exactly the class of check that missed this
bug the first time — computing actual resulting pixel coordinates, not just
confirming a formula can't exceed a range.

**Still not visually confirmed** — recommend a real screenshot of this exact
chart next time the extension is reachable.

Files changed: `src/components/data-view/TargetRollBarChart.tsx`. Commit:
`09c4726`.
