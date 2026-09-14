New feature: Academic Results LA/Region choropleth map, round 1 of 2. Full
detail in docs/vicdata_phase3_academic_results_choropleth_brief_v1.md — read
it in full before starting, including its own real live-data confirmation
(28,626 real rows already in academic_geography_aggregate, sample LA values
given) and its real join-detail warning (LA name vs gss_code).

This connects two pieces that both already exist, independently, unconnected:
Rolls' own real choropleth geometry (`la_boundaries_geojson()`/
`region_boundaries_geojson()` RPCs, `src/lib/la-choropleth.ts`, rendered
today in `MapView.tsx`) and Academic's own real, already-populated LA/
region/national aggregate data (`academic_geography_aggregate` table,
`academic_geography_lookup()` RPC) — built in an earlier round specifically
for this, never wired to any UI. Neither piece needs building from scratch;
this is genuinely an integration task.

What IS new: Rolls' choropleth only triggers when a Region/Nation-scale
comparator SET is active — that mechanism doesn't exist for Academic this
round (deliberately deferred, see "Out of scope" in the brief). So build a
standalone trigger instead — a new toggle on `AcademicMapView`, independent
of ticked schools, that switches between the point map and an LA/Region
choropleth of the current stage's own headline measure. Reuse
`gradeBandColour`/`GRADE_BAND_STOPS` for the choropleth's own colour scale
(same real colour language as the point map, don't invent a new one), and
follow Rolls' own two-zoom-tier API route pattern
(`nation-region-choropleth`/`region-la-choropleth`) for the new Academic
equivalents rather than a single flat endpoint.

Real Region/Nation-scale RANKABLE comparator sets for Academic (a genuine
rank/position against a whole region, not just a colour) are explicitly OUT
of scope — that needs Academic's own large-set performance architecture,
separate work, round 2.

Local build/test only, no commit/push. Confirm the LA-name→gss_code join
really works for a couple of real LAs before calling it done, not just by
inspection. Full build report naming every real design call made.
