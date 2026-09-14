# Build report: Academic Results — LA/Region choropleth map (round 1 of 2)

Brief: `docs/vicdata_phase3_academic_results_choropleth_brief_v1.md`. Built and
tested locally only; nothing committed or pushed, per this round's own explicit
local-only instruction.

**Browser tool check**: re-checked at the start of this round's finalisation —
`tabs_context_mcp` returns "Browser extension is not connected," consistent with
every prior round. No rendered screenshot was possible; all verification below is
real script execution against real production functions/data, not code inspection
alone, and not a rendered page.

**Local stack check**: re-confirmed no dev server was left running (`ps aux` shows
no `next dev` process) and no local Supabase/Docker stack was running (`supabase
status` fails to reach the Docker daemon — Docker itself isn't running). No ingest
or migration was needed this round, so nothing local was ever started.

## What this round connects

Two pieces that already existed independently and had never been wired together:
Rolls' own choropleth geometry infrastructure (`la_boundaries_geojson`/
`region_boundaries_geojson` RPCs, `la-choropleth.ts`, `MapView.tsx`'s zoom-driven
region↔LA switch, the `.vd-choropleth-label` convention) and Academic's own
`academic_geography_aggregate`/`academic_geography_lookup()` — built in an earlier
round, never previously read by any UI. This round adds a new, standalone "View by
area" toggle to `AcademicMapView`, independent of the ticked-schools/comparator
mechanism (which doesn't exist for Academic yet — that's round 2's scope).

## Real design calls made

**1. The LA-name → gss_code join happens in TypeScript, not SQL.**
`academic_geography_aggregate` lives in vicdata's own Supabase project;
`la_gss_crosswalk`/`la_boundaries_geojson`/`region_boundaries_geojson` live in
vicdata_public's own, genuinely separate Postgres database. A single SQL join
across them is not possible. `fetchAcademicLaChoropleth` therefore fetches
Academic's own LA rows via `lookupAcademicGeography()`, fetches the crosswalk
directly (`la_gss_crosswalk` has `for select using (true)` RLS, so no RPC wrapper
is needed for it, unlike `academic_geography_aggregate` itself which is
`security definer`-gated), and joins the two `Map`s by exact `la_name` string
match in application code.

**2. Exact-string join convention reused, not invented.** `region_nation_la_rollup()`'s
own migration already established and documented this exact convention (`join
public.la_gss_crosswalk lgc on lgc.la_name = s.la_name`, ~152/153 real match rate
documented there). Academic's own join reuses the identical convention rather than
a fuzzy or normalised match.

**3. LA-tier fetch is national, not region-scoped — a deliberate simplification vs
Rolls' own route shape.** Rolls' `region-la-choropleth` route takes a `regionCode`
param because its LA rollup is a live per-school aggregation that would be
expensive to run for every region at once. Academic's `academic_geography_aggregate`
is already precomputed (real: 28,626 rows), so `academic-la-choropleth`'s own new
route fetches all ~153 real LAs nationally in one call, every time, with no
`regionCode` param at all — documented explicitly in the route file's own comment.

**4. This also let the client-side zoom tier-switch be simplified, not mirrored.**
Rolls' own `MapView.tsx` tracks per-region centroids (`nationRegionCentroidsRef`)
to know which region to fetch LA data for on zoom-in. Since Academic's LA tier is
always-already-fetched in full, no centroid tracking is needed — a
`choroplethRegionCentroidsRef` was drafted then deliberately removed once this was
confirmed; the zoom effect is just `map.getZoom() >= CHOROPLETH_REGION_LA_ZOOM_THRESHOLD
(8)` deciding which of the two already-fetched tiers to draw.

**5. Colour scale reused, not reinvented.** The choropleth's fill colour is
`gradeBandColour(avgValue, min, max)` — the exact same function and
`GRADE_BAND_LEGEND_STOPS` 5-stop sequential blue palette the point-based grade-band
mode already uses, scaled to the real min/max of whichever tier (region or LA) is
currently drawn, not a new palette.

**6. Region tier needs no crosswalk at all.** `academic_geography_aggregate`'s
region-level `grouping_key` already matches `region_boundaries_geojson`'s own
`name` column character-for-character for all 9 real English regions — confirmed
directly, not assumed — so `fetchAcademicRegionChoropleth` joins by name with no
intermediate table.

**7. KS2 and family-scoped views are excluded, per the brief and the table's own
schema constraint.** `academic_geography_aggregate` has `ks_stage text not null
check (ks_stage in ('ks4','ks5'))` at the database level — KS2 genuinely has no
geography rows. `viewByAreaAvailable` is `!familyId && stage !== "ks2"`, and an
auto-off effect force-disables `viewByArea` if it's ever true when availability
drops (e.g. user switches to KS2 or picks a subject family while the toggle is on).

**8. Region tier is click-to-zoom, matching Rolls' own interaction.** Clicking a
region polygon calls `map.fitBounds(layer.getBounds())`, zooming the user into
LA tier for that area, rather than requiring the zoom slider.

## Real verification (execution, not inspection)

**LA-name → gss_code join, KS4, run against real hosted data**: 153/153 real LAs
returned by `academic_geography_aggregate` matched a real `gss_code` in
`la_gss_crosswalk` — a 100% match rate on the real Academic LA set (exceeding the
~152/153 rate documented for the unrelated `la_gss_crosswalk` vs `la_boundaries`
join elsewhere). Confirmed again independently for KS5 (same 100% real match).

**Region-name join, KS4**: 9/9 real English regions in `academic_geography_aggregate`
matched a real row in `region_boundaries_geojson` by exact name, with real geometry
attached to every one — no unmatched regions.

**Geometry attachment, both tiers**: every real LA and region row returned by the
two fetch functions carried real, non-null `MultiPolygon` geometry after the join
(`withGeom/las.length` = 153/153 for KS4 LA tier; same for KS5).

**Worked real examples** (`fetchAcademicLaChoropleth("ks4")`, read-only against
hosted):

```
Slough:                55.05% — 18 real schools, period 2024
Trafford:               51.2% — 23 real schools, period 2024
Kingston upon Thames:   50.8% — 15 real schools, period 2024
LOWEST real:  Blackpool  = 25.42%
HIGHEST real: Slough     = 55.05%
```

These match the brief's own sample LA figures exactly, confirming the pipeline
reproduces the same real values the brief was written against.

**Simulated render pass** (same `gradeBandColour()` call and stat-label formatting
the actual drawing effect in `AcademicMapView.tsx` uses, run against real fetched
data, KS4 + KS5, region + LA tier):

```
KS4 region tier — real min=36.56, max=42.17 across 9 real regions
  East Midlands: 39.0% — 385 real schools, 2024 -> #79b3fb
  London:        42.2% — 745 real schools, 2024 -> #1e3a8a (darkest — real max)
  North East:    36.6% — 207 real schools, 2024 -> #eff6ff (lightest — real min)

KS4 LA tier — real min=25.42, max=55.05 across 153 real LAs
  Slough:                 55.0% — 18 schools -> #1e3a8a
  Trafford:               51.2% — 23 schools -> #2250bd
  Kingston upon Thames:   50.8% — 15 schools -> #2251c1
  LOWEST real:  Blackpool = 25.42 -> #eff6ff
  HIGHEST real: Slough    = 55.05 -> #1e3a8a
```

Confirms the colour scale is meaningful across real data end to end: the real
minimum value always resolves to the lightest stop, the real maximum to the
darkest, with sensible interpolation between, for both tiers and both stages.

## Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on every new/touched file (`academic-geography-choropleth.ts`, both
  new route files, `AcademicMapView.tsx`, `AcademicDataView.tsx`): clean. Two
  `react-hooks/set-state-in-effect` violations (the auto-off effect, the
  choropleth data-fetch effect) fixed by wrapping each effect body in a single
  async IIFE, the same pattern established in Round 3. One
  `react-hooks/exhaustive-deps` warning (`choroplethEntries` computed as a plain
  ternary, producing a new array reference every render) fixed by wrapping it in
  `useMemo`.
- `npm run build`: clean, full production build; both new routes
  (`/api/data-view/academic-la-choropleth`, `/api/data-view/academic-region-choropleth`)
  confirmed registered in the build output.
- Real execution throughout: the LA/region joins, geometry attachment, and
  simulated colour-scale render were all run against real hosted data via scripts
  importing and calling the actual production functions (`fetchAcademicLaChoropleth`,
  `fetchAcademicRegionChoropleth`, `gradeBandColour`) — not asserted from the
  crosswalk's documented match rate, and not inspected from code alone.
- **Not verified**: the actual rendered map (polygon fill, tooltips, labels, the
  toggle button itself, the click-to-zoom interaction) — no Claude-in-Chrome
  connection this session. Flagged plainly rather than implied; Guy will need to
  check the live toggle himself before this is considered visually confirmed.
- **Not verified**: the two new API routes end-to-end over real HTTP with a real
  auth token (no stored test credentials available this session) — deprioritised
  in favour of the already-thorough lib-level (real data, real joins, real
  geometry) and build-level (routes registered, types clean) verification, since
  the routes themselves are thin membership-gate wrappers copied from the
  established `academic-schools/route.ts` pattern already proven correct elsewhere.

## Confirmations

- `git status` before writing this report showed only the files this round's own
  work touched: `src/lib/academic-geography-choropleth.ts` (new),
  `src/app/api/data-view/academic-la-choropleth/route.ts` (new),
  `src/app/api/data-view/academic-region-choropleth/route.ts` (new),
  `src/components/data-view/AcademicMapView.tsx`,
  `src/components/data-view/AcademicDataView.tsx` (single-line `authToken` prop
  addition), plus this round's own brief/prompt/report docs. The two unrelated
  docs left modified by a separate, stopped colour-bug/palette prompt remain
  exactly as found — not committed, not discarded, not touched by this round.
- Nothing written to hosted/production — every check this round was a read-only
  query against real, already-ingested data; no ingest, no migration.
- No dev server or local Supabase/Docker stack was running before or after this
  round.
- Nothing committed or pushed, per this round's own explicit local-only
  instruction.
- Round 2 (real Region/Nation-scale RANKABLE comparator sets) is out of scope
  here and untouched — this round is the standalone toggle only.
