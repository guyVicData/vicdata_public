-- Sibling bug to the one just fixed in vicdata's academic_region_nation_rank()
-- (2026-09-14, target found live-missing from a real 31-school tied block). This
-- RPC's own `neighbours` window has the identical root cause, flagged but
-- deliberately not fixed at the time (20260914153100_academic_region_nation_rank_
-- target_always_included.sql, vicdata repo, says so explicitly): `order by
-- abs(rnk - target_rnk) limit 11` has no tiebreaker, so when many real schools
-- share the target's own rank (rank() gives every tied row the identical number,
-- so abs(rnk - target_rnk) is 0 for the whole tied group at once), Postgres has
-- no defined order among them and can silently return 11 rows that do not include
-- the target's own row. This is Rolls' live production Rankings large-set view --
-- affects all three metrics this RPC serves (roll, girlsPct, boardingPct) whenever
-- a target lands in a large tied block (the boarding_pct=0% day-school block this
-- RPC's own header comment already flags as the realistic case is exactly such a
-- block, plausibly thousands of schools at Nation scale).
--
-- Fix: same deterministic secondary sort as the Academic fix -- the target's own
-- row always sorts first among rows tied at the same rank distance
-- (`urn <> p_target_urn` is false/0 for the target, true/1 for everyone else, so
-- it always wins ties), then urn ascending for a stable, reproducible rest of the
-- window. Applied identically to all three metric blocks (roll/girlsPct/
-- boardingPct). Same urn-ascending tiebreaker added to each top15 for
-- reproducibility across repeated calls when many schools tie at the very top.
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
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk, urn)
                            from (select * from roll_ranked order by rnk, urn limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk, urn)
                                 from (
                                     select * from roll_ranked
                                     order by abs(rnk - (select rnk from roll_ranked where urn = p_target_urn)), (urn <> p_target_urn), urn
                                     limit 11
                                 ) n), '[]'::jsonb)
    ) as block
),
girls_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from girls_ranked limit 1), 0),
        'targetRank', (select rnk from girls_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk, urn)
                            from (select * from girls_ranked order by rnk, urn limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk, urn)
                                 from (
                                     select * from girls_ranked
                                     order by abs(rnk - (select rnk from girls_ranked where urn = p_target_urn)), (urn <> p_target_urn), urn
                                     limit 11
                                 ) n), '[]'::jsonb)
    ) as block
),
boarding_block as (
    select jsonb_build_object(
        'total', coalesce((select tot from boarding_ranked limit 1), 0),
        'targetRank', (select rnk from boarding_ranked where urn = p_target_urn),
        'top15', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk, urn)
                            from (select * from boarding_ranked order by rnk, urn limit 15) t), '[]'::jsonb),
        'neighbours', coalesce((select jsonb_agg(jsonb_build_object('urn', urn, 'name', name, 'value', value, 'rank', rnk) order by rnk, urn)
                                 from (
                                     select * from boarding_ranked
                                     order by abs(rnk - (select rnk from boarding_ranked where urn = p_target_urn)), (urn <> p_target_urn), urn
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

comment on function public.region_nation_rank(text, text, text, text[], text, text) is
    'Region/Nation-scale ranking for Rolls'' own roll/girlsPct/boardingPct metrics, bounded to an 11-row neighbours window regardless of tied-block size (rank() ties share one rank number; see 20261010097000_region_nation_rank_bounded_neighbours.sql). All three neighbours windows and top15 lists now carry a deterministic secondary sort (target-first, then urn) so a large real tied block at the target's own rank can never silently exclude the target's own row (sibling bug to the one found and fixed live in vicdata's academic_region_nation_rank(), 2026-09-14; same root cause, same fix, applied here to close it out).';
