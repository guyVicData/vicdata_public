-- Bug fix (Task 3 review / "Public View rebuild"): nearest_schools was missing the
-- same mainstream-K-12-only filter comparator_candidates and feeder_candidates
-- already got (20260807105000/106000) -- restricted to
-- Academies/Local authority maintained schools/Independent schools/Free Schools, the
-- same establishment_type_group inclusion list, for the same reason: an unfiltered
-- call surfaces tiny specialist/international study centres and Colleges/
-- Universities/Online providers ahead of genuinely comparable schools. Replaces the
-- weaker `<> 'Special schools'` exclusion (which let Colleges/Universities/Online
-- provider/PRU-adjacent "Other types" groups through) while keeping the existing
-- alternative-provision/referral substring exclusion -- PRU/AP entries are scattered
-- across the mainstream groups themselves (confirmed in the original migration's own
-- comment), so the inclusion list alone doesn't catch them.
create or replace function public.nearest_schools(p_urn text, p_limit int default 30)
returns table (
    urn text,
    current_name text,
    town text,
    postcode text,
    establishment_type_group text,
    establishment_type text,
    statutory_low_age integer,
    statutory_high_age integer,
    distance_metres double precision
)
language sql
stable
as $$
    with target as (
        select easting, northing, establishment_type_group, statutory_low_age, statutory_high_age
        from public.schools where urn = p_urn
    )
    select s.urn, s.current_name, s.town, s.postcode, s.establishment_type_group, s.establishment_type,
           s.statutory_low_age, s.statutory_high_age,
           sqrt(power(s.easting - target.easting, 2) + power(s.northing - target.northing, 2)) as distance_metres
    from public.schools s, target
    where s.urn <> p_urn
      and s.status <> 'closed'
      and s.easting is not null and s.northing is not null
      and target.easting is not null and target.northing is not null
      and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
      and s.establishment_type not ilike '%alternative provision%'
      and s.establishment_type not ilike '%referral%'
      and (target.establishment_type_group = 'Independent schools') = (s.establishment_type_group = 'Independent schools')
      and s.statutory_low_age is not null and s.statutory_high_age is not null
      and target.statutory_low_age is not null and target.statutory_high_age is not null
      and s.statutory_low_age <= target.statutory_high_age
      and s.statutory_high_age >= target.statutory_low_age
    order by distance_metres asc
    limit p_limit;
$$;

grant execute on function public.nearest_schools(text, int) to anon, authenticated;
