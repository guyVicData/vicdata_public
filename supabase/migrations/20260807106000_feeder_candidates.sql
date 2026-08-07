-- Feeder Set candidate generation (rolls spec §5): adaptive target-count search, run
-- separately per sector then unioned. "Radius expands until a target number of
-- candidates is found" is implemented directly as nearest-N-by-distance per sector
-- (ORDER BY distance LIMIT N is mathematically the smallest radius containing exactly N
-- points -- no separate iterative-expansion loop needed to get the same result).
--
-- Scope note, logged in docs/OPEN_QUESTIONS.md: target count here is a flat default
-- (p_target_count_per_sector), not yet scaled by the receiving school's own intake size
-- at that entry point -- the cohort-progression intake-size estimator (rolls spec §7)
-- is real, separate, not-yet-built engineering ("not yet built or validated," per the
-- spec's own words), not something to fake here.
create or replace function public.feeder_candidates(
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
               sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2)) as distance_metres,
               row_number() over (
                   partition by (s.establishment_type_group = 'Independent schools')
                   order by sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2))
               ) as sector_rank
        from public.schools s, target
        where s.urn <> p_receiving_urn
          and s.status <> 'closed'
          -- A university or FE college is never a genuine feeder-relationship source
          -- (confirmed for real while testing -- University of Reading surfaced as a
          -- top-10 candidate with no filter at all). Restricted to mainstream K-12
          -- groups, same list comparator_candidates uses.
          and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
          and s.easting is not null and s.northing is not null
          and target.easting is not null and target.northing is not null
          and sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2)) <= p_max_radius_metres
    )
    select urn, current_name, town, postcode, establishment_type_group, distance_metres
    from ranked
    where sector_rank <= p_target_count_per_sector
    order by distance_metres;
$$;

grant execute on function public.feeder_candidates(text, int, numeric) to authenticated;
