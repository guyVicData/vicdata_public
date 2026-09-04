-- Two real fixes to nearest_schools (2026-09-30), from the phase-match investigation
-- round (docs/reports/2026-09-29-fe-narrative-la-names-phase-match.md).
--
-- (1) Special schools were never actually excluded for real. The mainstream
-- establishment_type_group inclusion list lets academy/free-school-converted special
-- schools straight through -- their own group is 'Academies'/'Free Schools' like any
-- other academy; only establishment_type ('Academy special converter' etc.) says
-- they're special. Confirmed live, real distinct establishment_type values containing
-- "special" among open schools: 'Other independent special school' (952) and
-- 'Community special school' (419)/'Foundation special school' (75)/
-- 'Non-maintained special school' (52), all already under the dedicated
-- 'Special schools' group and already excluded; 'Special post 16 institution' (154,
-- group 'Other types', a genuinely different FE-sector population, already excluded by
-- the group filter too, not touched by this fix); and the three real leaks --
-- 'Academy special converter' (341, group Academies), 'Academy special sponsor led'
-- (98, group Academies), 'Free schools special' (133, group Free Schools) -- all three
-- pass the group-only filter today.
--
-- Also confirmed live: a special-school TARGET (Cambridge School, Community special
-- school) got a real matched pool of 8, but only 2 of those 8 were genuinely special
-- schools (both via the same leak) -- the other 6 were ordinary mainstream academies,
-- because the dedicated 'Special schools' group is excluded from the candidate list
-- unconditionally, for every target, with no special-schools-only branch to fall back
-- to. Fixed with a real, symmetric "is this school special" check -- computed once for
-- the target (is_special, in the target CTE), reused for both branches: a special
-- target now matches only real special-school candidates (dedicated group OR the three
-- named leak types); a mainstream target now excludes all of them, either direction.
-- Deliberately NOT a blanket `establishment_type ilike '%special%'` -- that would also
-- catch 'Special post 16 institution', a real but different population.
--
-- (2) State through-schools (rare -- Steiner Academy Hereford is the real example)
-- were stuck matching only other state schools, a genuinely thin same-sector pool at
-- LA/regional level. Independent through-schools are common enough that their own
-- same-sector pool is already fine -- not touched by this. New p_relax_sector
-- parameter, default false (every existing call site unaffected unless it opts in),
-- computed and passed from application code (findSurroundingSchools already computes
-- targetPhase there, before calling this RPC) -- when true, the sector-equality gate
-- is skipped entirely for that call. The through-school-only narrowing still comes
-- from findSurroundingSchools' own existing phase-tag-count symmetry check
-- (unchanged, already sector-agnostic -- a candidate must itself carry more than one
-- phase tag when the target does), not from anything new in this function.
drop function if exists public.nearest_schools(text, int);

create function public.nearest_schools(
    p_urn text,
    p_limit int default 30,
    p_relax_sector boolean default false
)
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
        select
            easting, northing, establishment_type_group, establishment_type,
            statutory_low_age, statutory_high_age,
            (
                establishment_type_group = 'Special schools'
                or establishment_type in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
            ) as is_special
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
      and s.establishment_type not ilike '%alternative provision%'
      and s.establishment_type not ilike '%referral%'
      and (
          (
              not target.is_special
              and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
              and s.establishment_type not in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
              and (
                  p_relax_sector
                  or (target.establishment_type_group = 'Independent schools') = (s.establishment_type_group = 'Independent schools')
              )
          )
          or (
              target.is_special
              and (
                  s.establishment_type_group = 'Special schools'
                  or s.establishment_type in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
              )
          )
      )
      and s.statutory_low_age is not null and s.statutory_high_age is not null
      and target.statutory_low_age is not null and target.statutory_high_age is not null
      and s.statutory_low_age <= target.statutory_high_age
      and s.statutory_high_age >= target.statutory_low_age
    order by distance_metres asc
    limit p_limit;
$$;

grant execute on function public.nearest_schools(text, int, boolean) to anon, authenticated;
