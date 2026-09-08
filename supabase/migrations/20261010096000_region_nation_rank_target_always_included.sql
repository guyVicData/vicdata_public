-- Large-set design v1, item 3 -- real bug found in self-review before shipping: the
-- sector filter (p_sectors) applied to EVERY row including the target's own, so a
-- member viewing an Independent school with an active "State" sector filter would
-- have their OWN target school silently excluded from the ranked pool entirely
-- (targetRank null on every metric, "No real data available" shown for a school that
-- very much has real data). This contradicts an established, repeated convention
-- throughout this codebase (SchoolMap.tsx's own comment, restated in MapView.tsx/
-- GraphsView.tsx/RankingsView.tsx's small-set path): "the viewed school is always a
-- real reference point, never excluded" -- sector is a MEMBERSHIP filter for every
-- OTHER school (matchesSectorFilter, data-view-filters.ts), but the target itself is
-- exempt from it everywhere else in this app. RankingsView.tsx's own small-set `group`
-- construction already always prepends targetProfile regardless of the active sector
-- filter; this RPC needs the same carve-out to stay consistent with that.
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
                                 from roll_ranked
                                 where rnk between (select rnk from roll_ranked where urn = p_target_urn) - 5
                                                and (select rnk from roll_ranked where urn = p_target_urn) + 5), '[]'::jsonb)
    ) as block
),
girls_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from girls_ranked limit 1), 0),
        'targetRank', (select rnk from girls_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                            from (select * from girls_ranked order by rnk limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                                 from girls_ranked
                                 where rnk between (select rnk from girls_ranked where urn = p_target_urn) - 5
                                                and (select rnk from girls_ranked where urn = p_target_urn) + 5), '[]'::jsonb)
    ) as block
),
boarding_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from boarding_ranked limit 1), 0),
        'targetRank', (select rnk from boarding_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                            from (select * from boarding_ranked order by rnk limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk)
                                 from boarding_ranked
                                 where rnk between (select rnk from boarding_ranked where urn = p_target_urn) - 5
                                                and (select rnk from boarding_ranked where urn = p_target_urn) + 5), '[]'::jsonb)
    ) as block
)
select jsonb_build_object(
    'roll', (select block from roll_block),
    'girlsPct', (select block from girls_block),
    'boardingPct', (select block from boarding_block)
);
$$;
