-- Member Data View large-set design v1, item 3: Rankings at Region/Nation scale.
-- RankingsView.tsx already has the right DISPLAY pattern for this (LARGE_SET_THRESHOLD
-- switches "ranks #N of M" to a percentile + NEIGHBOUR_WINDOW=5 window either side of
-- the target) -- it just currently computes over a client-side array
-- (`tickedProfiles`) that structurally can never hold a 49,000-school set. This RPC
-- computes the same ranking server-side, over school_current_snapshot, and adds the
-- design doc's own "top 15" requirement on top of the existing neighbour-window
-- pattern.
--
-- Same three metrics RankingsView.tsx's own METRICS constant already defines (current
-- roll, %girls, %boarding) -- market_share is deliberately NOT included: it's a "% of
-- THIS comparator set," which only means something for a bounded, member-curated
-- group, not a 49,000-school region (every school's share would round to 0%).
--
-- Deliberate, logged scope limit (docs/vicdata_data_view_open_questions.md has the
-- full reasoning): this reads WHOLE-SCHOOL current totals off school_current_snapshot
-- (total_roll/female_total/boarding), honouring the SECTOR (membership) and
-- BOARDING-STATUS filters exactly, and the GENDER filter for the roll/%girls metrics
-- -- but does NOT replicate data-view-filters.ts's phase/age-band SLICING
-- (ageRangeForBand/phaseTagAgeRange), and does not cross-slice gender within an active
-- boarding filter (filteredCount()'s own boarding_with_gender branch). Both are real,
-- non-trivial pieces of TS business logic tied to a school's own statutory age range;
-- reimplementing them a second time in SQL risks exactly the "quietly drift" failure
-- mode this codebase's own comments repeatedly warn against, for a scale-specific
-- ranking view where an approximate-but-honest whole-school figure is a reasonable
-- trade-off. %boarding is unaffected by this limit (RankingsView's own existing
-- boarding_pct metric already ignores every filter, small-set or large).
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
    and (p_sectors is null or array_length(p_sectors, 1) is null or scs.sector = any(p_sectors))
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
            -- Boarding-active case deliberately returns no real %girls figure here
            -- (matches filteredCount()'s own "neither/both gender selected, or no
            -- real split" branch, which is what this simplified model always hits
            -- since gender isn't cross-sliced within an active boarding filter --
            -- see this function's own header comment).
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

grant execute on function public.region_nation_rank(text, text, text, text[], text, text) to anon, authenticated;
