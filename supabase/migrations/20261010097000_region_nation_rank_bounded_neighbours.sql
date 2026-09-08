-- Large-set design v1, item 3 -- real bug found in self-review before shipping: the
-- neighbour window (`rnk between target_rnk - 5 and target_rnk + 5`) is unbounded in
-- ROW COUNT under `rank()`'s own standard tie behaviour (equal values share one rank
-- number, the next rank jumps by the tied-group size -- the same "sports table"
-- convention `data-view-cards.ts`'s own `rankDescendingWithTies` already documents).
-- `boarding_pct` is the realistic case this bites: every school with a real but zero
-- `boarders_total` (a day school whose census return still reports the field, just as
-- 0 -- distinct from a school with NO boarding field at all, which is excluded from
-- this ranking entirely) ties at 0%, plausibly thousands of schools at Nation scale.
-- A target ranked inside that tied block would previously have pulled potentially
-- thousands of rows into `neighbours` (`rnk between X-5 and X+5` matches every row
-- AT rank X, and every tied rank is the SAME number) -- defeating the whole point of
-- a bounded "window of neighbours" and bloating the response.
--
-- Fix: neighbours are now the (up to) 11 schools whose RANK is numerically closest to
-- the target's own rank (`order by abs(rnk - target_rnk) limit 11`, re-sorted
-- ascending by rank for display) -- always bounded to 11 rows regardless of how many
-- schools happen to tie at any given rank, while still showing "what's immediately
-- around this school" in spirit.
create or replace function public.region_nation_rank(
    p_region_code text,
    p_nation text,
    p_target_urn text,
    p_sectors text[],
    p_boarding_mode text,
    p_gender text
)
returns jsonb
language sql
stable
as $$
with base as (
    select
        s.urn,
        s.current_name as name,
        scs.sector,
        scs.total_roll,
        scs.female_total,
        scs.boarding
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    join public.school_current_snapshot scs on scs.urn = s.urn
    where (
        (p_region_code is not null and srn.region_code = p_region_code)
        or (p_region_code is null and srn.nation = p_nation)
    )
    and (
        p_sectors is null or array_length(p_sectors, 1) is null or scs.sector = any(p_sectors)
        or s.urn = p_target_urn
    )
),
metrics as (
    select
        urn,
        name,
        (case
            when p_boarding_mode is not null then
                case
                    when boarding is null then 0
                    when p_boarding_mode = 'boarders' then (boarding->>'boarders')::numeric
                    when p_boarding_mode = 'day' then (boarding->>'day')::numeric
                    else (boarding->>'total')::numeric
                end
            when p_gender = 'Girls' then female_total
            when p_gender = 'Boys' then total_roll - female_total
            else total_roll
        end) as roll_value,
        (case
            when p_boarding_mode is not null then null
            when p_gender = 'Girls' then (case when female_total > 0 then 100 else null end)
            when p_gender = 'Boys' then (case when (total_roll - female_total) > 0 then 0 else null end)
            when total_roll > 0 then (female_total::numeric / total_roll) * 100
            else null
        end) as girls_pct_value,
        (case
            when boarding is null then null
            when (boarding->>'total')::numeric > 0 then ((boarding->>'boarders')::numeric / (boarding->>'total')::numeric) * 100
            else 0
        end) as boarding_pct_value
    from base
),
roll_ranked as (
    select urn, name, roll_value as value, rank() over (order by roll_value desc) as rnk, count(*) over () as tot
    from metrics
),
girls_ranked as (
    select urn, name, girls_pct_value as value, rank() over (order by girls_pct_value desc) as rnk, count(*) over () as tot
    from metrics
    where girls_pct_value is not null
),
boarding_ranked as (
    select urn, name, boarding_pct_value as value, rank() over (order by boarding_pct_value desc) as rnk, count(*) over () as tot
    from metrics
    where boarding_pct_value is not null
),
roll_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from roll_ranked limit 1), 0),
        'targetRank', (select rnk from roll_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                            from (select * from roll_ranked order by rnk limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                                 from (
                                     select * from roll_ranked
                                     order by abs(rnk - (select rnk from roll_ranked where urn = p_target_urn))
                                     limit 11
                                 ) n), '[]'::jsonb)
    ) as block
),
girls_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from girls_ranked limit 1), 0),
        'targetRank', (select rnk from girls_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                            from (select * from girls_ranked order by rnk limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                                 from (
                                     select * from girls_ranked
                                     order by abs(rnk - (select rnk from girls_ranked where urn = p_target_urn))
                                     limit 11
                                 ) n), '[]'::jsonb)
    ) as block
),
boarding_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from boarding_ranked limit 1), 0),
        'targetRank', (select rnk from boarding_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                            from (select * from boarding_ranked order by rnk limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                                 from (
                                     select * from boarding_ranked
                                     order by abs(rnk - (select rnk from boarding_ranked where urn = p_target_urn))
                                     limit 11
                                 ) n), '[]'::jsonb)
    ) as block
)
select jsonb_build_object(
    'roll', (select block from roll_block),
    'girlsPct', (select block from girls_block),
    'boardingPct', (select block from boarding_block)
);
$$;
