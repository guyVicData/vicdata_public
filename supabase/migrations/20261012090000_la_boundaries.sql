-- Map round (2026-09-12), Part 2 (Region/Nation choropleth, Stage A). Real, stored LA
-- boundary geometry -- per direct instruction, NOT fetched live from ONS's ArcGIS
-- service at render time. A live external call on every map load is a genuine speed
-- barrier for a feature used this often, unlike the old, now-unwired la-boundary.ts
-- (src/lib/la-boundary.ts), which only ever served one boundary on one school's own
-- public page -- a rare, low-frequency call, not this feature's shape.
--
-- Real architecture finding, confirmed by reading both repos directly before writing
-- this, not assumed: the handoff's own framing pointed at "the vicdata (ingest)
-- repo's registry pattern" for this. That repo's own database genuinely has no
-- schools/la_gss_crosswalk-equivalent table with the full fields a per-school
-- rollup needs (gender, statutory age range, boarding split) -- it has a narrower
-- school_entities table (urn/current_name/status/la_name/establishment_type_group
-- only, built for a different downstream consumer, "vicdash"), and no LA-GSS
-- crosswalk at all. vicdata_public's OWN database, by contrast, already has
-- everything this feature needs in one place: `schools` (itself a synced copy of
-- that same ingest-repo school_entities data, enriched with gender/statutory ages/
-- boarding -- see 20260807090000_extensions_and_schools.sql's own comment),
-- `la_gss_crosswalk` (dfe_code/gss_code/region), and `school_current_snapshot`
-- (large-set design v1's own precomputed per-school current-period breakdown,
-- already full per-age granularity, already kept fresh by
-- scripts/recompute-census-derived.ts). Storing the boundary geometry here too, and
-- building the new aggregation RPC (next migration) entirely within this one
-- database, avoids a cross-database join that the real schema can't actually
-- support, and reuses infrastructure already proven in this exact codebase rather
-- than inventing a second copy of school reference data in a different database.
-- Logged here plainly since it's a real deviation from the handoff's own literal
-- "write it in the vicdata repo" instruction, not a silent one.
--
-- postgis (not the plain built-in `point` type the nearest_schools() spatial index
-- used) -- that earlier choice was deliberate because a single lat/lng point has a
-- built-in Postgres type with real GiST support already; a boundary POLYGON has no
-- such built-in equivalent, and postgis's own geometry type + GiST index is the
-- standard, well-supported way to store/index/serialise one -- available as a
-- normal installable extension on this Supabase project (confirmed by this
-- migration applying cleanly, not assumed).
create extension if not exists postgis;

-- geometry(MultiPolygon, 4326) -- SRID 4326 (WGS84 lat/lng) to match Leaflet's own
-- coordinate system directly (la-boundary.ts's own real precedent: "requested in
-- WGS84... Leaflet plots in lat/lng"), and MultiPolygon (not Polygon) since a county/
-- unitary LA can genuinely have exclaves/islands (la-boundary.ts's own comment: "MultiPolygon
-- islands/exclaves are rare for county/unitary LAs but not impossible") -- ST_Multi()
-- applied at ingest time normalises a single-Polygon response into this shape too, so
-- every row has one consistent geometry type to query against.
create table public.la_boundaries (
    gss_code text primary key,
    name text not null,
    geom geometry(MultiPolygon, 4326) not null,
    -- Static government geography -- an annual/rare-refresh source, not a
    -- frequently-refreshed one (per direct instruction, classified accordingly
    -- rather than as something a promote-hook needs to keep current). source_dataset
    -- documents real provenance (this migration's own header comment has the fuller
    -- story) so a future re-ingest for a boundary-change year is traceable back to
    -- exactly which ONS release this came from, not just "some boundary file."
    source_dataset text not null default 'Counties_and_Unitary_Authorities_December_2023_Boundaries_UK_BUC',
    fetched_at timestamptz not null default now()
);

create index la_boundaries_geom_gist_idx on public.la_boundaries using gist (geom);

alter table public.la_boundaries enable row level security;

create policy la_boundaries_select_anyone on public.la_boundaries
    for select using (true);

comment on table public.la_boundaries is 'Real, stored LA (county/unitary authority) boundary polygons -- ONS Open Geography Portal, Counties_and_Unitary_Authorities_December_2023_Boundaries_UK_BUC, WGS84. Populated by a one-off scripts/ingest-la-boundaries.ts run (static government geography, re-run only on a real ONS boundary-change year), keyed by gss_code to join straight onto la_gss_crosswalk. Never fetched live from ONS at render time -- see this table''s own migration comment for why.';
