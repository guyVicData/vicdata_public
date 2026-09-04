-- Same real special-school leak as nearest_schools had (fixed in
-- 20260930120000_nearest_schools_special_and_through_school.sql; see
-- docs/reports/2026-09-30-nearest-schools-special-through-schools.md, which flagged
-- this RPC as having the identical hole, not fixed at the time). Confirmed live: an
-- unfiltered comparator_candidates call for a real special-school target (Cambridge
-- School) returned zero special-school candidates -- ordinary mainstream primary
-- schools nationally, matched purely on closeness of number_of_pupils, with no
-- special-school relevance and no age/phase relevance at all (this RPC has no
-- age-overlap filter the way nearest_schools does).
--
-- Same symmetric is_special check as the nearest_schools fix -- computed once in a
-- new target CTE (this function previously only pulled target_pupils via an inline
-- subquery), reused for both branches: a mainstream target excludes the three real
-- leak types (Academy special converter, Academy special sponsor led, Free schools
-- special) on top of the existing mainstream-group inclusion list; a special-school
-- target matches only real special-school candidates (the dedicated 'Special schools'
-- group OR those same three leak types). Also adds the alternative-provision/referral
-- substring exclusion nearest_schools already has, which this function never had at
-- all -- same class of gap, confirmed in the same report.
--
-- No parameter or return-column change, so CREATE OR REPLACE is safe here (unlike the
-- nearest_schools fix, which added a new parameter and needed DROP FUNCTION first).
create or replace function public.comparator_candidates(
    p_school_urn text,
    p_sector text default null,       -- 'independent' | 'state' | null (either)
    p_boarding text default null,     -- 'boarding' | 'day' | null (either)
    p_size_band text default null,    -- 'small' (<300) | 'medium' (300-800) | 'large' (800+) | null
    p_la_name text default null,      -- "local rivals" geography-primary filter
    p_limit int default 50
)
returns table (
    urn text,
    current_name text,
    town text,
    postcode text,
    la_name text,
    establishment_type_group text,
    number_of_pupils integer,
    boarding_establishment text
)
language sql
stable
as $$
    with target as (
        select
            number_of_pupils as target_pupils,
            (
                establishment_type_group = 'Special schools'
                or establishment_type in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
            ) as is_special
        from public.schools where urn = p_school_urn
    )
    select s.urn, s.current_name, s.town, s.postcode, s.la_name, s.establishment_type_group,
           s.number_of_pupils, s.boarding_establishment
    from public.schools s, target
    where s.urn <> p_school_urn
      and s.status <> 'closed'
      and s.establishment_type not ilike '%alternative provision%'
      and s.establishment_type not ilike '%referral%'
      and (
          (
              not target.is_special
              and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
              and s.establishment_type not in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
          )
          or (
              target.is_special
              and (
                  s.establishment_type_group = 'Special schools'
                  or s.establishment_type in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
              )
          )
      )
      and (
          p_sector is null
          or (p_sector = 'independent') = (s.establishment_type_group = 'Independent schools')
      )
      and (
          p_boarding is null
          or (p_boarding = 'boarding') = (s.boarding_establishment = 'Has boarders')
      )
      and (
          p_size_band is null
          or (p_size_band = 'small' and s.number_of_pupils < 300)
          or (p_size_band = 'medium' and s.number_of_pupils between 300 and 800)
          or (p_size_band = 'large' and s.number_of_pupils > 800)
      )
      and (p_la_name is null or s.la_name = p_la_name)
    order by s.number_of_pupils is null, abs(coalesce(s.number_of_pupils, 0) - coalesce(target.target_pupils, 0)) asc
    limit p_limit;
$$;

grant execute on function public.comparator_candidates(text, text, text, text, text, int) to authenticated;
