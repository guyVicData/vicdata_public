-- nearest_schools: candidate generation for the State of the School page's
-- "surrounding schools" stat and rolls spec §4's local-shape mechanism -- same simple
-- logic feeds both (deliberately simple, no adaptive radius, no member curation,
-- distinct from the member-tier Comparator Set's "local rivals").
--
-- Exclusion filter, per rolls spec §4/§10 (checked against real data before writing
-- this): special schools are a clean single-field filter
-- (establishment_type_group = 'Special schools'). PRU/AP is not clean -- scattered
-- across three top-level groups, confirmed via real establishment_type values:
-- 'Academy alternative provision converter', 'Academy alternative provision sponsor
-- led', 'Free schools alternative provision', 'Pupil referral unit' -- matched here by
-- substring ('%alternative provision%', '%referral%'). Known, deliberately unresolved
-- edge case (per spec, not a bug): 'Secure units' (48 rows, establishment_type_group
-- 'Other types') and 'Academy secure 16 to 19' (1 row) are AP-like but named
-- differently, and slip through this filter as-is.
--
-- "Same phase" is proxied by statutory age-range overlap rather than the phase text
-- column: phase is frequently 'Not applicable' for independent schools (confirmed in
-- real data), so age-range overlap is the more robust cross-sector match.
-- p_limit defaults to 30, not 20 -- a buffer for the caller to skip-and-backfill past
-- 6th-form/FE candidates with no DfE census roll data (rolls spec §4's flagged gap;
-- resolution logged in docs/OPEN_QUESTIONS.md).
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
      and s.establishment_type_group <> 'Special schools'
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
