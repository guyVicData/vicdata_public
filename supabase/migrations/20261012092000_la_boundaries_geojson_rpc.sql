-- Map round (2026-09-12), Part 2 (Region/Nation choropleth, Stage A). Read RPC to
-- serve stored LA boundary geometry back out as GeoJSON -- needed for two real
-- purposes, not just one: (1) this is the actual real function the Stage A render
-- layer (2c) will call to get LA polygons for Leaflet's GeoJSON layer, since
-- PostgREST's plain REST interface has no built-in geometry-to-GeoJSON conversion on
-- select; and (2) it doubles as the spot-check tool for verifying the ingest that
-- just ran actually stored real, sane polygons (real ring counts / bounding boxes),
-- not just non-null blobs.
--
-- p_gss_codes text[] default null: null means "all boundaries" (useful for Nation
-- scope later / this round's own verification); a real array scopes to one region's
-- worth of LAs (the shape the render layer will actually call this with in Stage A).
create function public.la_boundaries_geojson(p_gss_codes text[] default null)
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
    from public.la_boundaries b
    where p_gss_codes is null or b.gss_code = any(p_gss_codes);
$$;

grant execute on function public.la_boundaries_geojson(text[]) to anon, authenticated;
