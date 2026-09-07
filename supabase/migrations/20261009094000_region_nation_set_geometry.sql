-- Real bug found live (2026-10-09), reported directly: "London schools and England
-- schools don't load" -- the SET itself was selecting correctly (A3's sentence, the
-- button, the Add/subtract count all updated with the real school_count), but the MAP
-- showed zero markers. Root cause: MapView.tsx's whole marker-drawing pipeline
-- (`withProfile`) only ever draws a school that has a full DataViewSchoolProfile in
-- profilesByUrn -- and DataViewShell.tsx's own LARGE_SET_PROFILE_THRESHOLD guard
-- (this same performance-architecture round, §"no longer fetches full per-school
-- profiles... past 200 schools") deliberately never fetches profiles for a Region/
-- Nation-scale set, to avoid the exact fetch-and-compute-at-scale failure this whole
-- round exists to remove. Correct call to skip the EXPENSIVE full profile per school;
-- wrong to leave the map with literally nothing to draw as a result -- a real gap in
-- the original design, not caught until testing the actual rendered page rather than
-- just timing the API response.
--
-- Fix: region_nation_set now also returns each school's easting/northing/sector tag
-- alongside urn/name -- everything MapView actually needs to plot a real, positioned,
-- sector-coloured marker WITHOUT a full multi-year profile (which is what filtered
-- roll-count sizing and trend colouring need, and which large sets still can't afford
-- to fetch per-school). Every school still gets a real marker in the cluster
-- hierarchy -- "nothing silently capped or sampled" -- just a simpler one than the
-- full-profile case for small comparator sets.
create or replace function public.region_nation_set(
    p_region_code text,
    p_nation text,
    p_exclude_urn text
)
returns jsonb
language sql
stable
as $$
    select coalesce(
        jsonb_agg(jsonb_build_object(
            'urn', s.urn,
            'name', s.current_name,
            'easting', s.easting,
            'northing', s.northing,
            'establishmentTypeGroup', s.establishment_type_group,
            'establishmentType', s.establishment_type
        )),
        '[]'::jsonb
    )
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    where srn.urn <> p_exclude_urn
      and (
          (p_region_code is not null and srn.region_code = p_region_code)
          or (p_region_code is null and srn.nation = p_nation)
      );
$$;
