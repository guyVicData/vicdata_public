# VicData — Academic Results, stage 2 (UI/UX) fixes, v1

Guy's own 4-stage review process (1. wiring/functionality, 2. UI/UX, 3. data review,
4. changes/additions) has cleared stage 1 — GCSE exclusion, KS5 qualification-type
awareness, and the boarding-pool fix are all live and independently verified. This
brief covers stage 2: real UI/UX feedback gathered live against vicdata.co.uk,
traced to specific files/lines before being written up here (not guessed at) — build
against the actual root causes named below, not just the symptoms.

Named schools used to develop this brief, real data confirmed directly: **Acland
Burghley** (URN 100053, real state-sector sixth form — dominant KS5 cohort
"Academic" at 111 entries vs A-level's 102, but `has_ib: false` — a real, load-bearing
example of "Academic" NOT meaning IB), **Sevenoaks** (118952, real confirmed IB).

## 1. Rename the KS5 tab

DfE's own official publication for this whole dataset is literally titled "A level
and other 16 to 18 results" (confirmed directly: [Explore Education
Statistics](https://explore-education-statistics.service.gov.uk/find-statistics/a-level-and-other-16-to-18-results/2024-25)).
"A-level" (the current `STAGE_LABEL.ks5` in `src/lib/academic-data-view.ts` line 130)
is now genuinely inaccurate given this feature covers Applied General/Tech
Level/Technical Certificate/Academic(IB) too. Rename to **"Post-16"** (Guy's own
preferred wording was "Post 16 Results" — either is fine; "Post-16" matches the
brevity of the "KS2"/"GCSE" labels either side of it, so use that unless told
otherwise). One-line change, `STAGE_LABEL` only — nothing downstream reads the label
string itself for logic.

## 2. Stage-switcher position

The KS2/GCSE/Post-16 buttons (`KsStageSwitcher`) currently render in their own row
below the top-level "Rolls / Academic / Destinations / Context" tabs
(`TopicTabs` in `DataViewShell.tsx`). They need to move onto that SAME row,
right-aligned. Concretely: either lift `KsStageSwitcher` into `TopicTabs`'s own
render (passing `availableStages`/`effectiveStage`/`onChangeStage` down from
`AcademicDataView` through `DataViewShell`), or restructure `TopicTabs`'s flex row so
`AcademicDataView` can inject the switcher into the same line via a slot/portal.
Whichever is more natural given how `DataViewShell` already lifts `activeView`
above `AcademicDataView` (same pattern, same file) — use that.

## 3. Top-level "Academic" tab: hide when there's no data at all

`DataViewShell.tsx`'s `TOPIC_TABS` renders "Academic" as an always-clickable tab
regardless of whether the target school has any real data in ks2/ks4/ks5 at all — a
standalone independent junior school with no real KS2 results currently still gets a
live "Academic" tab that leads nowhere useful. Gate this: only render "Academic" as
clickable when `stagesPresent(targetProfile).length > 0` for the CURRENT target
(same `stagesPresent()` already in `academic-data-view.ts`) — otherwise render it the
same disabled/greyed treatment `Destinations`/`Context` already get in that same
component, not simply omit it (so the four-topic row shape stays consistent).

## 4. Per-stage button visibility: real exclusion means no button, not a caveat

`stagesPresent()` (`academic-data-view.ts` line 116) only checks whether raw KS4/
KS5/KS2 rows exist — it doesn't know about this morning's IGCSE exclusion
(`igcseExclusionLikely`). Confirmed directly: an IGCSE-heavy independent school
(Rugby-shaped: real KS4 rows exist, but `engmath_94_percent` is 0 and
`igcseExclusionLikely` returns true) currently still gets a live, clickable GCSE
button — clicking into it shows this morning's exclusion sentence instead of a
chart. Per this round's own explicit instruction, **this changes**: a target school
for which `igcseExclusionLikely(profile)` is true should not get a GCSE button at
all, full stop — not the button-plus-caveat-sentence pattern built this morning. This
supersedes that specific part of this morning's design (the caveat sentence itself,
used on Rankings/Graphs/Map for a TICKED comparator school that's excluded, is
unaffected — this is specifically about the TARGET's own top-level stage button).
Concretely: `KsStageSwitcher`'s `stages` prop (currently `availableStages`, i.e.
`stagesPresent(targetProfile)`) needs `ks4` filtered out when
`igcseExclusionLikely(targetProfile)` is true.

## 5. Default stage priority: oldest age group first

`AcademicDataView.tsx` line 245 currently defaults to `ks4` (GCSE) before `ks5`
(Post-16) before `ks2`. Change the priority order to **ks5 → ks4 → ks2** — the
school's oldest available age group first, per this round's own explicit
instruction ("not many schools actually have more than 2 of these" — so this mostly
matters for all-through schools with a genuine sixth form, which should open on
Post-16 by default rather than GCSE).

## 6. Map/Graphs/Rankings switcher: back onto the map, matching Rolls exactly

Confirmed root cause: Rolls' own `MapView.tsx` explicitly documents (its own
2026-09-05 comment) that Map view treats the map as a full canvas, floating
`ViewSwitcher` and `PdfExportButton` as absolutely-positioned overlays INSIDE the
map (`absolute left-3 top-3 z-[1000]` for the switcher, `absolute right-3 top-3
z-[1000]` for the export-button stack) — the in-flow subheader row is explicitly
skipped for Map (`activeView !== "map" &&` gate in `DataViewShell.tsx`).
`AcademicDataView.tsx` never got this treatment: its `ViewSwitcher` always renders
in the in-flow header row regardless of `activeView`, and `AcademicMapView.tsx` has
no internal overlay copy at all. Port Rolls' exact pattern: hide the in-flow
switcher row when `activeView === "map"`, and have `AcademicMapView` render its own
`ViewSwitcher`/`PdfExportButton` overlays at the same positions Rolls uses.

## 7. Map key/legend placement: match Rolls

Same parity gap as #6, same root cause. Rolls' `MapView.tsx` places its
scale/legend box as `absolute bottom-3 left-3 z-[1000]`. `AcademicMapView.tsx`'s
current legend/colour-mode toggle sits at `absolute left-2 top-2` with the
gradient-scale strip elsewhere in-flow beneath the map div, not inside it as an
overlay. Move Academic's legend/scale/exclusion-note block to match Rolls'
`bottom-3 left-3` overlay position and general visual treatment (white/dark
rounded box, `z-[1000]`) exactly.

## 8. Subject-category filter: below the map, only for Map view

`CategoryFilter` (subject-family pills) currently always renders in the same
in-flow header row as `KsStageSwitcher`/`Ks5CohortSwitcher`, above the map
regardless of `activeView`. For Map specifically, move it to render BELOW the map
div instead (Graphs/Rankings keep it where it is, in the header row — this is
Map-specific, since Map is the one view being restructured into the
overlay-on-canvas pattern above).

## 9. Map auto-zoom: fitBounds to the current set

`AcademicMapView.tsx` opens Leaflet with a fixed `zoom: 11` centred on the target
school (`L.map(mapElRef.current, { center: [lat, lng], zoom: 11, ... })`) and never
calls `fitBounds` anywhere — confirmed directly, no `fitBounds` call exists in this
file at all. Rolls' `MapView.tsx` has real, working `fitBounds` logic
(`map.fitBounds(trimmedBoundsFor(bounds), { padding: [40, 40], maxZoom: 13 })`,
re-run on comparator-set changes). Port the same real behaviour: on load and
whenever the visible set (`withCoords`) changes, fit the map's bounds to include
every visible circle, not just the target.

## 10. Qualification-type selector: no forced default, real per-school figures until one is chosen

Confirmed real bug via Acland Burghley: its dominant KS5 cohort is genuinely
"Academic" (111 real entries vs A-level's 102), but its confirmed `has_ib` flag is
**false** — it runs no real IB. `KS5_COHORT_OPTIONS`' "Academic" pill is
unconditionally labelled "Academic (IB)" regardless of which school is being
viewed, so auto-defaulting the selector to the target's own dominant cohort
(today's `effectiveKs5Cohort` logic in `AcademicDataView.tsx`) makes the UI read as
"IB selected by default" for a school with zero real IB entries. Per this round's
explicit instruction, the fix is not a smarter label — it's removing the forced
default entirely:

- **Default state** (nothing explicitly clicked): no pill is shown as active. Every
  school in the comparator set — target and comparators alike — is plotted/labelled
  on ITS OWN real dominant cohort (reusing Part 3's existing `dominantKs5Cohort`
  per-school, exactly as the free-card/Overview headline number already does). This
  is deliberately NOT one shared measure across the group; it mirrors how DfE's own
  tables present each institution under its own real reporting category rather than
  forcing one axis. Rankings/spread/growth/trend/Map all need this per-school-metric
  mode as their real default, replacing today's single-shared-`effectiveKs5Cohort`
  default.
- **A specific type explicitly clicked** (e.g. "Academic (IB)", "Applied General"):
  THIS is when the group genuinely narrows to one shared measure, and #11 below (the
  comparator-set widening) applies.

This will need real design judgement on how a mixed-metric default state actually
charts (a bar chart mixing A-level/Applied-General/Academic points-per-entry values
side by side, sorted purely by value) and reads honestly (e.g. Rankings' own table
should probably show each row's qualification type alongside its figure, so a
reader isn't left assuming they're all the same measure) — flag any real design
call made here in the build report rather than picking silently.

## 11. Comparator set must always be 10 real schools/colleges — reusing Rolls' own logic, not reinventing it

Direct instruction, and it resolves the Acland Burghley "map goes empty when
A-level is selected" symptom (root cause: today's ticked/nearest-set is a fixed
list, and `ks5ExcludedUrns` just removes non-matching schools from it with no
backfill — if most of that fixed set lacks real A-level data, the visible group
collapses).

**Do not invent new selection logic.** `surrounding-schools.ts`'s
`findSurroundingSchools()` already solves exactly this problem for Rolls' own
"Nearest 10" default list — it draws from a deeper precomputed pool (the
`school_nearest_neighbours` 'general' pool, ~100 deep) and applies filters
(sector/phase/gender) while guaranteeing a real 10, per its own documented
principle ("Nearest 10 must always return target+10"). Reuse that same
engine/pool for Academic's comparator set, adding one more filter dimension on
top of Rolls' existing sector/phase/gender logic:

- **Default state** (#10 above, no qualification explicitly selected): the extra
  filter is just "has ANY real KS5 data" (any cohort at all — `stagesPresent`
  includes `ks5`, or more precisely at least one non-null `*::aps_per_entry`
  measure). If Rolls' own nearest-10 already gives 10 real matches on this loose
  test, use it unchanged. If fewer than 10 qualify, widen the geographic net
  (go deeper into the same precomputed pool, and beyond it if genuinely
  necessary) until 10 are found. **No qualification-type matching in this
  state** — a mixed set (A-level next to Applied General next to IB) is
  correct and expected here, matching #10's per-school-metric default.
- **A specific qualification type selected** (e.g. Sevenoaks + "Academic (IB)"):
  the filter narrows to "has real entries for THIS SPECIFIC cohort"
  (`ks5HasCohortEntries`), and the SAME widen-the-net mechanism finds the nearest
  10 real matches for that one type specifically — e.g. selecting IB on Sevenoaks
  should bring in the nearest 10 real IB schools nationally if fewer than 10 are
  geographically close, not just the nearest 10 by plain distance filtered down to
  whichever happen to also run IB.

This is KS5-specific in this brief's scope (it's what the qualification selector
and the Acland Burghley symptom are about) — whether the same "widen to guarantee
10" principle should also replace this morning's KS4 IGCSE-exclusion behaviour
(which currently excludes-and-shows-fewer-with-a-note rather than widening) is a
real, separate design question Guy hasn't settled yet. Do NOT change the KS4
GCSE-exclusion mechanism as part of this item — flag the question back rather than
assuming either way.

**Real verification needed, not just a code read**: re-run Acland Burghley with
"A level" explicitly selected after this lands, and confirm the map genuinely shows
schools now (not just that the code compiles) — same discipline every prior round
has used.

## Build notes

Local build/test only, same discipline as every prior round — do not commit, push,
or touch hosted/production. Write up a full report in the same shape as prior
rounds, naming every real judgement call made (especially #10's chart-design
question and #11's KS4 scope boundary) rather than resolving them silently. Re-run
real-execution checks against Acland Burghley and Sevenoaks specifically, since
both are named, real, load-bearing examples in this brief, not illustrative
placeholders.
