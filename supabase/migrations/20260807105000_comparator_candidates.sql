-- Comparator Set candidate generation (rolls spec §6): attribute-filter-first --
-- sector, phase (proxied by statutory age-range overlap, same reasoning as
-- nearest_schools), boarding status, size band -- geography usually optional, primary
-- only for the "local rivals" configuration (simplified here to an LA-name filter, not
-- the full adaptive target-count radius search Feeder Set uses -- Comparator Set's own
-- geography axis is explicitly "usually optional narrowing filter," not the mechanism
-- that needs adaptive-radius precision).
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
    -- Restricted to mainstream K-12 groups: an unfiltered call otherwise surfaces tiny
    -- specialist/international study centres (4, 10, 13 pupils, confirmed for real
    -- while testing) ahead of genuinely comparable schools -- same "exclude special
    -- schools" spirit nearest_schools already applies, extended here to also drop
    -- Colleges/Universities/Online provider, which are never meaningful whole-school
    -- comparators. Ordered by closeness to the target school's own size, not raw
    -- ascending -- ascending order has the same tiny-outlier problem even after this
    -- filter (a 4-pupil independent school is still technically "independent").
    select s.urn, s.current_name, s.town, s.postcode, s.la_name, s.establishment_type_group,
           s.number_of_pupils, s.boarding_establishment
    from public.schools s, (select number_of_pupils as target_pupils from public.schools where urn = p_school_urn) t
    where s.urn <> p_school_urn
      and s.status <> 'closed'
      and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
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
    order by s.number_of_pupils is null, abs(coalesce(s.number_of_pupils, 0) - coalesce(t.target_pupils, 0)) asc
    limit p_limit;
$$;

grant execute on function public.comparator_candidates(text, text, text, text, text, int) to authenticated;
