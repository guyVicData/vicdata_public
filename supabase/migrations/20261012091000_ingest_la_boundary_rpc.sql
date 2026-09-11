-- Map round (2026-09-12), Part 2 (Region/Nation choropleth, Stage A). Small write RPC
-- to support scripts/ingest-la-boundaries.ts: PostgREST's plain client-side upsert
-- has no way to construct a real PostGIS geometry value from GeoJSON text (there is no
-- "insert this column as ST_GeomFromGeoJSON(...)" affordance through the REST API) --
-- so, same pattern as every other write path in this codebase that needs real
-- server-side computation (recompute_nearest_neighbours_boarding_batch above, the
-- census-derived recompute functions), the geometry construction happens in a
-- security-definer function instead of client-side.
--
-- security definer + revoke from anon/authenticated: this table is genuinely
-- write-once-a-year, run only by the one-off ingest script using the service-role
-- key (createServiceRoleSupabaseClient()) -- same posture as the other recompute_*
-- functions in this codebase, none of which are exposed to real members.
create function public.ingest_la_boundary(
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
    insert into public.la_boundaries (gss_code, name, geom, source_dataset, fetched_at)
    values (
        p_gss_code,
        p_name,
        -- ST_Multi() normalises a bare Polygon GeoJSON input into MultiPolygon too,
        -- matching this script's own client-side toMultiPolygonGeoJson() -- belt and
        -- braces, not redundant: ST_GeomFromGeoJSON on a MultiPolygon GeoJSON already
        -- returns a MultiPolygon, so ST_Multi() here is a no-op in the normal case and
        -- only matters if that client-side normalisation is ever skipped.
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

revoke all on function public.ingest_la_boundary(text, text, text, text) from public;
grant execute on function public.ingest_la_boundary(text, text, text, text) to service_role;
