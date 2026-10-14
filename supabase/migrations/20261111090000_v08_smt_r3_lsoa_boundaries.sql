-- VicData 0.8 SMT round 3 (K0): neighbourhood (LSOA 2021) boundaries for SMT Context's map, "Where the
-- school-age children live". Follows la_boundaries exactly (20261012090000, 20261012091000,
-- 20261012092000): a stored copy of ONS's static geography, loaded once by a script
-- (scripts/ingest-lsoa-boundaries.ts), never fetched from ONS at render time.
--
-- The data: ONS "Lower layer Super Output Areas (December 2021) Boundaries EW BGC (V5)" -- the
-- generalised (20 m) version, England only (E01..., 33,755). The super-generalised (BSC, 200 m)
-- version is a quarter of the size, but at the 5-mile zoom an inner-London LSOA is a few hundred
-- metres across and BSC draws it as a rough polygon of about 8 points (report, K0).
--
-- What it holds is public geography, so anyone may read it, as with la_boundaries. The figures the
-- map shades by come from the ingest's own lookups (lsoa_context_lookup); nothing here is a figure.
create extension if not exists postgis;

create table public.lsoa_boundaries (
    gss_code text primary key,
    name text not null,
    geom geometry(MultiPolygon, 4326) not null,
    source_dataset text not null default 'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5',
    fetched_at timestamptz not null default now()
);

create index lsoa_boundaries_geom_gist_idx on public.lsoa_boundaries using gist (geom);

alter table public.lsoa_boundaries enable row level security;

create policy lsoa_boundaries_select_anyone on public.lsoa_boundaries
    for select using (true);

comment on table public.lsoa_boundaries is 'ONS LSOA (December 2021) boundaries, England, generalised (BGC V5), WGS84. Loaded once by scripts/ingest-lsoa-boundaries.ts (static geography; re-run only when ONS changes the boundaries). Keyed by gss_code (E01...), the code the ingest''s lsoa_context_lookup and school_context_lookup use.';

-- The load script's write path, as ingest_la_boundary: PostgREST can't build a geometry from GeoJSON
-- text, so the construction happens here. Service role only.
create function public.ingest_lsoa_boundary(
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
    if p_gss_code !~ '^E01[0-9]{6}$' then
        raise exception 'not an English LSOA (2021) code: %', p_gss_code;
    end if;
    insert into public.lsoa_boundaries (gss_code, name, geom, source_dataset, fetched_at)
    values (p_gss_code, p_name, ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(p_geom_geojson)), 4326), p_source_dataset, now())
    on conflict (gss_code) do update set
        name = excluded.name,
        geom = excluded.geom,
        source_dataset = excluded.source_dataset,
        fetched_at = excluded.fetched_at;
end;
$$;

revoke all on function public.ingest_lsoa_boundary(text, text, text, text) from public;
grant execute on function public.ingest_lsoa_boundary(text, text, text, text) to service_role;

-- The map's read: only the LSOAs asked for, as GeoJSON (5 decimal places, about a metre), with each
-- one's area in hectares (the map shades children per hectare: LSOAs differ in size).
create function public.lsoa_boundaries_geojson(p_gss_codes text[])
returns table (
    gss_code text,
    name text,
    geojson text,
    area_ha double precision
)
language sql
stable
set search_path = public
as $$
    select
        b.gss_code,
        b.name,
        ST_AsGeoJSON(b.geom, 5) as geojson,
        ST_Area(b.geom::geography) / 10000.0 as area_ha
    from public.lsoa_boundaries b
    where b.gss_code = any(p_gss_codes)
      and cardinality(p_gss_codes) <= 5000;
$$;

grant execute on function public.lsoa_boundaries_geojson(text[]) to anon, authenticated;

-- Which LSOAs to ask for: those whose boundary comes within p_metres of a point given in British
-- National Grid metres (the schools table's easting/northing). The ingest's school_context_lookup
-- returns how many LSOAs it counts within 5 miles but not which; the app finds them here, then
-- reads their figures (and population-weighted centroids) from lsoa_context_lookup. Capped at
-- 20 km so no call can ask for the whole country.
create function public.lsoa_boundaries_near(p_easting double precision, p_northing double precision, p_metres double precision)
returns table (gss_code text)
language sql
stable
set search_path = public
as $$
    with pt as (
        select ST_SetSRID(ST_MakePoint(p_easting, p_northing), 27700) as bng
    )
    select b.gss_code
    from public.lsoa_boundaries b, pt
    where p_metres > 0 and p_metres <= 20000
      and b.geom && ST_Transform(ST_Expand(pt.bng, p_metres), 4326)
      and ST_DWithin(ST_Transform(b.geom, 27700), pt.bng, p_metres);
$$;

grant execute on function public.lsoa_boundaries_near(double precision, double precision, double precision) to anon, authenticated;
