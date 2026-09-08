-- Large-set design v1, item 2 -- real Nation-scale performance finding, with real
-- data (2026-10-10, after school_current_snapshot's Part 3 finished): the previous
-- (diagnostic-timeout) migration measured region_nation_set(scope=nation) at a real
-- 9.4-15.7s / 15.75MB once the statement timeout was raised enough to let it
-- complete -- confirms this is a genuine data-volume problem, not just a query-plan
-- one (removing the LATERAL jsonb_each unnest, the previous fix, helped but wasn't
-- sufficient on its own). Region (South East, 7,400 real schools) stays comfortably
-- fast (~1.8s/2.4MB) -- this is specifically a Nation-scale (~49,000 schools) problem.
--
-- Real, bounded trade-off shipped here rather than left broken or silently slow:
-- `anchor_age_gender_counts` (the 2019-anchor per-age breakdown -- roughly HALF the
-- per-school payload, since current+anchor arrays are similarly sized) is no longer
-- selected/returned at all. jsonb this large is TOASTed (stored out-of-line) --
-- simply not referencing the column means Postgres never fetches it from TOAST
-- storage for a row that doesn't need it, not just a smaller JSON OUTPUT.
--
-- Functional consequence, confirmed bounded and honest (not silently wrong): MapView's
-- marker SIZE and Sector colour-by mode are UNAFFECTED (neither reads anchor data at
-- all). Trend colour-by mode's "since 2019" comparison, when a phase/age-band filter
-- is ALSO active, degrades from a real filtered comparison to "no comparison
-- available" (flat/neutral colour) for Region/Nation-scale markers specifically --
-- MapView.tsx's own `hasAnchor` check already correctly reads this as "genuinely no
-- anchor data," the same honest branch a newly-opened school with no real 2019 history
-- already hits elsewhere in this codebase, not a new failure mode. `anchorPeriod`
-- itself is still returned (a single cheap integer) so this remains distinguishable
-- from "recompute hasn't run yet" if ever needed.
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
      and (
          (p_region_code is not null and srn.region_code = p_region_code)
          or (p_region_code is null and srn.nation = p_nation)
      );
$$;
