-- Extends feeder_candidates' output with number_of_pupils and boarding_establishment
-- so this same function also serves "local rivals" (rolls spec §6): "adaptive
-- target-count search, geography as primary filter... stays exactly as designed
-- [as Feeder Set's mechanism]" -- explicitly the same underlying mechanism reused, not
-- a second implementation. Attribute filters (boarding/size band) for local rivals are
-- applied client-side on top of these results as secondary narrowing, matching
-- geography being the *primary* axis there (rolls spec §6's table: geography usually
-- optional, primary specifically for local rivals; attribute filters otherwise
-- primary, via comparator_candidates, untouched by this migration).
drop function if exists public.feeder_candidates(text, int, numeric);

create function public.feeder_candidates(
    p_receiving_urn text,
    p_target_count_per_sector int default 15,
    p_max_radius_metres numeric default 80000
)
returns table (
    urn text,
    current_name text,
    town text,
    postcode text,
    establishment_type_group text,
    number_of_pupils integer,
    boarding_establishment text,
    distance_metres double precision
)
language sql
stable
as $$
    with target as (
        select easting, northing from public.schools where urn = p_receiving_urn
    ),
    ranked as (
        select s.urn, s.current_name, s.town, s.postcode, s.establishment_type_group,
               s.number_of_pupils, s.boarding_establishment,
               sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2)) as distance_metres,
               row_number() over (
                   partition by (s.establishment_type_group = 'Independent schools')
                   order by sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2))
               ) as sector_rank
        from public.schools s, target
        where s.urn <> p_receiving_urn
          and s.status <> 'closed'
          and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
          and s.easting is not null and s.northing is not null
          and target.easting is not null and target.northing is not null
          and sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2)) <= p_max_radius_metres
    )
    select urn, current_name, town, postcode, establishment_type_group, number_of_pupils,
           boarding_establishment, distance_metres
    from ranked
    where sector_rank <= p_target_count_per_sector
    order by distance_metres;
$$;

grant execute on function public.feeder_candidates(text, int, numeric) to authenticated;
