-- Map round (2026-09-12), Part 2 Stage B (Nation scope's region tier + zoom-drill).
-- Real, stored ONS region boundary geometry -- same pattern as la_boundaries
-- (20261012090000_la_boundaries.sql), same reasoning for why it's stored here rather
-- than fetched live (a real speed barrier at this call frequency) or built in the
-- vicdata ingest repo (that repo's database still has no schools/la_gss_crosswalk-
-- equivalent -- the architecture deviation logged in la_boundaries's own migration
-- comment applies identically here, not relitigated).
--
-- Real endpoint, confirmed live before writing this (not assumed, per the handoff's
-- own explicit instruction): SAME ONS Open Geography host la_boundaries's own ingest
-- already uses (services1.arcgis.com/ESMARspQHYMw9BZ9), service
-- "Regions_December_2023_Boundaries_EN_BFC", layer 0. Real field list, queried
-- directly: FID, RGN23CD, RGN23NM, BNG_E, BNG_N, LONG, LAT, Shape__Area,
-- Shape__Length, GlobalID -- confirmed geometryType esriGeometryPolygon,
-- maxRecordCount 2000 (comfortably above the real 9-feature English-region total, no
-- pagination needed).
--
-- Real join key, confirmed live rather than guessed: RGN23CD values are the EXACT
-- same ONS region GSS codes (E12000001-E12000009) already used throughout this
-- codebase as school_region_nation.region_code (the same column region_nation_set()/
-- region_nation_rank()/region_nation_la_rollup() already take as p_region_code) --
-- confirmed by fetching all 9 real rows and diffing against this session's own
-- earlier-confirmed region_code list. A real GSS CODE join, not a name-string one
-- (region names DO also match exactly -- RGN23NM "South East" etc. -- but the code
-- join is what this table is actually keyed by, same discipline la_boundaries uses
-- gss_code, not name, as its own primary key). This is genuinely simpler than the LA
-- case: la_gss_crosswalk.region only ever held region NAMES (the one real case-only
-- LA-name mismatch Stage A found and resolved), but school_region_nation.region_code
-- was ALREADY a real GSS code before this round -- no name-matching step needed here
-- at all. Note this dataset is English-only (9 features, no Welsh entry) -- Wales has
-- no ONS "region" subdivision to draw; Stage B's own Nation-scope logic accounts for
-- this (Wales nation scope reuses the LA tier directly, no region tier for it -- see
-- DataViewShell.tsx's own comment).
create table public.region_boundaries (
    gss_code text primary key,
    name text not null,
    geom geometry(MultiPolygon, 4326) not null,
    source_dataset text not null default 'Regions_December_2023_Boundaries_EN_BFC',
    fetched_at timestamptz not null default now()
);

create index region_boundaries_geom_gist_idx on public.region_boundaries using gist (geom);

alter table public.region_boundaries enable row level security;

create policy region_boundaries_select_anyone on public.region_boundaries
    for select using (true);

comment on table public.region_boundaries is 'Real, stored ONS region boundary polygons -- ONS Open Geography Portal, Regions_December_2023_Boundaries_EN_BFC, WGS84, keyed by the real region GSS code (matches school_region_nation.region_code exactly). Populated by a one-off scripts/ingest-region-boundaries.ts run (static government geography, re-run only on a real ONS boundary-change year), same registry classification as la_boundaries. Never fetched live from ONS at render time.';

-- Same write RPC shape as ingest_la_boundary() (20261012091000_ingest_la_boundary_
-- rpc.sql) -- PostgREST's plain client upsert has no ST_GeomFromGeoJSON affordance,
-- so geometry construction happens server-side here too. security definer,
-- service_role only -- this table is write-once-a-year, run only by the one-off
-- ingest script.
create function public.ingest_region_boundary(
    p_gss_code text,
    p_name text,
    p_geom_geojson text,
    p_source_dataset text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.region_boundaries (gss_code, name, geom, source_dataset, fetched_at)
    values (
        p_gss_code,
        p_name,
        ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(p_geom_geojson)), 4326),
        p_source_dataset,
        now()
    )
    on conflict (gss_code) do update set
        name = excluded.name,
        geom = excluded.geom,
        source_dataset = excluded.source_dataset,
        fetched_at = excluded.fetched_at;
end;
$$;

revoke all on function public.ingest_region_boundary(text, text, text, text) from public;
grant execute on function public.ingest_region_boundary(text, text, text, text) to service_role;

-- Same read RPC shape as la_boundaries_geojson() (20261012092000_la_boundaries_
-- geojson_rpc.sql) -- the real function the region-tier render layer calls to get
-- region polygons for Leaflet's GeoJSON layer, and the tool used to spot-check the
-- ingest below.
create function public.region_boundaries_geojson(p_gss_codes text[] default null)
returns table (
    gss_code text,
    name text,
    geojson text,
    npoints integer
)
language sql
stable
as $$
    select
        b.gss_code,
        b.name,
        ST_AsGeoJSON(b.geom) as geojson,
        ST_NPoints(b.geom) as npoints
    from public.region_boundaries b
    where p_gss_codes is null or b.gss_code = any(p_gss_codes);
$$;

grant execute on function public.region_boundaries_geojson(text[]) to anon, authenticated;
