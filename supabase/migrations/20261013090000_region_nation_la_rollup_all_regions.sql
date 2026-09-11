-- Map round (2026-09-12), Part 2 Stage B (Nation scope's region tier + zoom-drill).
-- Extends region_nation_la_rollup() rather than forking it, per direct instruction
-- ("region numbers should come from re-summing LA totals, not a second copy of the
-- predicate logic") -- the region tier's own numbers are computed by calling this
-- SAME function with p_region_code = null (meaning "every real region, not just
-- one") and folding the ~150-175 returned LA rows into ~10 region totals in
-- la-choropleth.ts, not a second SQL function re-deriving the same sector/phase/
-- gender/boarding predicate a different way.
--
-- Two changes:
--   1. p_region_code = null now means "no region restriction at all" (every LA with
--      a real open school anywhere in England or Wales), rather than being required.
--      Existing Stage A callers (region_nation_la_rollup with a real region_code) are
--      completely unaffected -- this is purely additive to what null already meant
--      nowhere before (the parameter was always required until now).
--   2. Each returned row now also carries its own real regionCode (school_region_
--      nation.region_code -- the same real ONS region GSS code confirmed live this
--      round to match region_boundaries.gss_code exactly, e.g. E12000008/"South
--      East") -- the one new field the region-tier grouping step actually needs;
--      every existing field is unchanged.
create or replace function public.region_nation_la_rollup(
    p_region_code text,
    p_sectors text[],
    p_phase_bands text[],
    p_gender text,
    p_boarding_mode text
)
returns jsonb
language sql
stable
set statement_timeout = '15s'
as $$
with region_las as (
    select distinct lgc.gss_code, lgc.la_name, srn.region_code
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    join public.la_gss_crosswalk lgc on lgc.la_name = s.la_name
    where s.status <> 'closed'
      and srn.region_code is not null
      and (p_region_code is null or srn.region_code = p_region_code)
),
scoped as (
    select
        s.urn,
        lgc.gss_code,
        lgc.la_name,
        srn.region_code,
        scs.current_period,
        scs.anchor_period,
        scs.age_gender_counts,
        scs.anchor_age_gender_counts,
        scs.total_roll,
        scs.female_total,
        scs.boarding,
        scs.boarders_gender_split,
        s.statutory_low_age,
        s.statutory_high_age
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    join public.school_current_snapshot scs on scs.urn = s.urn
    join public.la_gss_crosswalk lgc on lgc.la_name = s.la_name
    where s.status <> 'closed'
      and srn.region_code is not null
      and (p_region_code is null or srn.region_code = p_region_code)
      and (p_sectors is null or array_length(p_sectors, 1) is null or scs.sector = any(p_sectors))
),
ranged as (
    select
        sc.*,
        case
            when p_phase_bands is null or array_length(p_phase_bands, 1) is null then -1000000000
            else coalesce(
                least(
                    case when 'Early Years' = any(p_phase_bands) then least(sc.statutory_low_age, 0) end,
                    case when 'Junior' = any(p_phase_bands) then sc.statutory_low_age end,
                    case when 'Prep' = any(p_phase_bands) then 11 end,
                    case when 'Senior' = any(p_phase_bands) then greatest(sc.statutory_low_age, 11) end,
                    case when 'Post 16' = any(p_phase_bands) then 16 end
                ),
                1000000000
            )
        end as age_lo,
        case
            when p_phase_bands is null or array_length(p_phase_bands, 1) is null then 1000000000
            else coalesce(
                greatest(
                    case when 'Early Years' = any(p_phase_bands) then 4 end,
                    case when 'Junior' = any(p_phase_bands) then least(10, sc.statutory_high_age) end,
                    case when 'Prep' = any(p_phase_bands) then sc.statutory_high_age end,
                    case when 'Senior' = any(p_phase_bands) then sc.statutory_high_age end,
                    case when 'Post 16' = any(p_phase_bands) then sc.statutory_high_age end
                ),
                -1000000000
            )
        end as age_hi
    from scoped sc
),
summed as (
    select
        r.gss_code,
        r.la_name,
        r.region_code,
        r.urn,
        r.current_period,
        r.anchor_period,
        (
            select coalesce(sum(
                case
                    when p_gender = 'Girls' then (elem->>2)::int
                    when p_gender = 'Boys' then (elem->>1)::int
                    else (elem->>1)::int + (elem->>2)::int
                end
            ), 0)
            from jsonb_array_elements(coalesce(r.age_gender_counts, '[]'::jsonb)) elem
            where (elem->>0)::int between r.age_lo and r.age_hi
        ) as current_census_value,
        (
            select coalesce(sum(
                case
                    when p_gender = 'Girls' then (elem->>2)::int
                    when p_gender = 'Boys' then (elem->>1)::int
                    else (elem->>1)::int + (elem->>2)::int
                end
            ), 0)
            from jsonb_array_elements(coalesce(r.anchor_age_gender_counts, '[]'::jsonb)) elem
            where (elem->>0)::int between r.age_lo and r.age_hi
        ) as anchor_census_value,
        case
            when p_boarding_mode is null then null
            when r.boarding is null then 0
            when p_gender is not null and r.boarders_gender_split is not null then
                case p_boarding_mode
                    when 'boarders' then (r.boarders_gender_split ->> (case when p_gender = 'Girls' then 'female' else 'male' end))::int
                    when 'day' then greatest(
                        (case when p_gender = 'Girls' then r.female_total else r.total_roll - r.female_total end)
                        - (r.boarders_gender_split ->> (case when p_gender = 'Girls' then 'female' else 'male' end))::int,
                        0
                    )
                    else (case when p_gender = 'Girls' then r.female_total else r.total_roll - r.female_total end)
                end
            else
                case p_boarding_mode
                    when 'boarders' then (r.boarding ->> 'boarders')::int
                    when 'day' then (r.boarding ->> 'day')::int
                    else (r.boarding ->> 'total')::int
                end
        end as boarding_value
    from ranged r
),
per_la_matched as (
    select
        gss_code,
        la_name,
        region_code,
        count(*) as school_count,
        sum(coalesce(boarding_value, current_census_value)) as current_total,
        case when p_boarding_mode is not null then null else sum(anchor_census_value) end as anchor_total,
        max(current_period) as current_period,
        max(anchor_period) as anchor_period
    from summed
    group by gss_code, la_name, region_code
)
select coalesce(jsonb_agg(jsonb_build_object(
    'gssCode', rl.gss_code,
    'laName', rl.la_name,
    'regionCode', rl.region_code,
    'schoolCount', coalesce(m.school_count, 0),
    'currentTotal', coalesce(m.current_total, 0),
    'anchorTotal', m.anchor_total,
    'currentPeriod', m.current_period,
    'anchorPeriod', m.anchor_period
)), '[]'::jsonb)
from region_las rl
left join per_la_matched m on m.gss_code = rl.gss_code;
$$;

grant execute on function public.region_nation_la_rollup(text, text[], text[], text, text) to anon, authenticated;
