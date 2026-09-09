-- Region/Nation set payload cleanup round -- real row-count finding, measured directly
-- against production: region_nation_set() never filtered on schools.status at all, so
-- Nation scope (England) returned 49,426 rows, of which 24,215 (nearly half) are
-- status = 'closed' -- schools that no longer exist. Only 25,112 are genuinely 'open'
-- (plus 40 'proposed_opening', 59 'proposed_closure', both left in deliberately --
-- neither is closed, and excluding them isn't part of this round's scope).
--
-- This is an established convention this function simply never picked up --
-- nearest_schools() (20260809103000_nearest_schools_mainstream_filter.sql) already
-- filters `s.status <> 'closed'`. Brings region_nation_set() in line.
--
-- Deliberately NOT doing in this migration (a real product decision, deferred to a
-- future round): establishment_type_group filtering, PRU/AP substring exclusion, or
-- sector-matching. Special schools/FE colleges distort a mainstream comparison set at
-- this scale, but that's its own follow-up (special schools excluded from mainstream
-- sets; FE colleges scoped to a future 16+-specific view) -- this migration is the
-- closed-school status filter only.
create or replace function public.region_nation_set(
    p_region_code text,
    p_nation text,
    p_exclude_urn text
)
returns jsonb
language sql
stable
set statement_timeout = '10s'
as $$
    select coalesce(
        jsonb_agg(jsonb_build_array(
            s.urn,
            s.current_name,
            s.easting,
            s.northing,
            s.establishment_type_group,
            s.establishment_type,
            s.statutory_low_age,
            s.statutory_high_age,
            scs.current_period,
            scs.total_roll,
            scs.female_total,
            scs.age_gender_counts,
            case when scs.boarding is null then null
                 else jsonb_build_array((scs.boarding->>'boarders')::int, (scs.boarding->>'day')::int, (scs.boarding->>'total')::int) end,
            case when scs.boarders_gender_split is null then null
                 else jsonb_build_array((scs.boarders_gender_split->>'male')::int, (scs.boarders_gender_split->>'female')::int) end,
            scs.anchor_period,
            null::jsonb
        )),
        '[]'::jsonb
    )
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    left join public.school_current_snapshot scs on scs.urn = s.urn
    where srn.urn <> p_exclude_urn
      and s.status <> 'closed'
      and (
          (p_region_code is not null and srn.region_code = p_region_code)
          or (p_region_code is null and srn.nation = p_nation)
      );
$$;
