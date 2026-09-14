# Academic Results — LA/Region choropleth map (new feature, round 1 of 2)

Guy's own framing: Region/Nation comparisons and a choropleth view would both
be powerful for Academic Results, showing real educational disparities. This
brief scopes round 1: the choropleth VIEW only. Round 2 (not started here,
deliberately deferred) is real Region/Nation-scale rankable comparator
SETS for Academic — that needs new large-set performance architecture Rolls
already has and Academic doesn't, a genuinely bigger, separate piece; see
"Out of scope" below for why it isn't bundled in here.

Everything below is grounded directly in the real code and a real live query
against hosted, not proposed blind.

## The two pieces this reuses already exist, independently, unconnected

**Geometry (from Rolls' own choropleth, Map round 2026-09-12):** real GeoJSON
MultiPolygon boundaries for every LA and Region, stored server-side, served
via `la_boundaries_geojson()` and `region_boundaries_geojson()` RPCs
(`src/lib/la-choropleth.ts`), rendered today by `MapView.tsx` (Rolls'
map) whenever a Region/Nation-scale comparator SET is active
(`isRegionOrNationScope`, gated on `activeSet.key === "ons_region"`/`nation`
— confirmed directly). This geometry layer is topic-agnostic — it's just LA/
Region shapes, nothing roll-specific about the polygons themselves.

**Academic geography data (built, never wired up):** `academic_geography_
aggregate` (vicdata's own Supabase migrations) is a real table — LA/region/
national averages of every real headline measure, per key stage, per year —
with a working RPC, `academic_geography_lookup(p_ks_stage, p_measure,
p_grouping_type, p_grouping_keys, p_family_id, p_period_min, p_period_max,
...)`. Confirmed live against hosted just now, not assumed: **28,626 real
rows** (26,806 LA-level, 1,638 region-level, 182 national-level), current as
of today's backfill. Real sample — LA-level Attainment 8 average, 2024/25:
Slough 55.05 (18 schools), Trafford 51.16 (23 schools), Kingston upon Thames
50.83 (15 schools). The table's own comment in vicdata's migrations says
plainly: "no real call site in this codebase needs subject-family or
geography comparisons yet — not wired in here until one does." This is that
call site.

**One real join detail to get right, not assume**: `academic_geography_
aggregate.grouping_key` for LA rows is the LA NAME as text ("Slough",
"Trafford" — confirmed directly above), not a `gss_code`. Rolls' own
`region_nation_la_rollup()` RPC solves exactly this same name→gss_code
mismatch via `la_gss_crosswalk` (its own migration documents the real,
confirmed match rate: 152/153 exact, one case-only difference). Reuse that
same crosswalk rather than re-deriving a new one — don't assume
`grouping_key` lines up directly with `la_boundaries_geojson`'s own
`gss_code` keying.

## What's genuinely new: the trigger, and the data RPC

Rolls' choropleth only ever appears because a Region/Nation-scale
comparator SET is active — that mechanism doesn't exist for Academic this
round (see "Out of scope"). So this needs its own trigger, decoupled from
the ticked-schools/comparator-set machinery entirely, and its own thin RPC
mirroring `region_nation_la_rollup()`'s shape but reading `academic_
geography_lookup` instead of live roll counts.

**Proposed design** (a starting recommendation, not locked in — confirm it
reads right once built, retune if not):

- A new standalone toggle on `AcademicMapView`, alongside the existing
  Grade band/Trends buttons — something like "View by area" — independent
  of which schools are ticked/compared. Turning it on switches the map from
  individual school circles to the LA-level choropleth (zoomed in) or
  Region-level (zoomed out), for the CURRENTLY SELECTED stage and measure
  (reuse `HEADLINE_MEASURE[stage]`, per the earlier map-colour-bug fix, so
  the choropleth and the point map share one real number and one real
  colour language — reuse `gradeBandColour`/`GRADE_BAND_STOPS`, including
  the darker palette from that round, don't invent a third scale).
- Two zoom tiers, same shape as Rolls' own `nation-region-choropleth`/
  `region-la-choropleth` API routes (`src/app/api/data-view/`) — a new
  pair of Academic-specific routes following the same real pattern
  (rollup + boundaries fetched together, scoped to exactly the
  `grouping_key`s returned), not a single flat endpoint.
- Legend and labels reuse the SAME real conventions Rolls' choropleth
  already established (`vd-choropleth-label`, label-visibility sweeping on
  zoom) — this should look like the same real component family, same
  discipline as every prior "match the existing map" round.

## Out of scope (round 2, not this brief)

Real Region/Nation-scale RANKABLE comparator sets for Academic — i.e.
"compare this school against every school in this region," with a genuine
rank/position, not just a colour on a map. That needs Academic's own
equivalent of Rolls' large-set performance architecture (server-side
aggregation instead of per-school profile fetches once a set gets into the
thousands) — real, separate infrastructure work, not built here. Flagged
explicitly so it isn't silently expected as part of this round.

## Build notes

Local build/test only, no commit/push, same discipline as every round.
Confirm the LA-name→gss_code join really works end to end for a couple of
real LAs (not just trust the crosswalk's own documented match rate) before
treating the map as done. Full build report naming every real design call
made, same as every round.
