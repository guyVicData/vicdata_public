-- Map round (2026-09-12), Part 2 Stage A (2b). LA-level rollup for the Region
-- choropleth: per public.la_boundaries.gss_code, the SAME filtered current-period and
-- anchor-period roll figure filteredCount() (data-view-filters.ts) already computes
-- per school on the client, summed across every real matching school in that LA --
-- computed server-side, at LA scale (~150 rows out), not per-school (~7,400 rows in,
-- for a single region), matching this whole architecture's established "aggregate in
-- Postgres, don't ship per-school data for a summary view" discipline.
--
-- Real join path, confirmed directly against live data before writing this (not
-- assumed): schools.la_name -> la_gss_crosswalk.la_name -> gss_code. Checked every
-- distinct la_name among all ~change25k open schools (paginated, not the first-1000-
-- rows trap) against la_gss_crosswalk: every non-matching value (30 of 183) is a
-- genuine non-English la_name (22 real Welsh LAs, plus GIAS's own BFPO/Guernsey/
-- Gibraltar/Isle of Man/Jersey/Scotland/"Does not apply" sentinels) -- the same
-- non-standard-LA population region-crosswalk.ts's own NON_STANDARD_LA_NAMES already
-- excludes elsewhere in this codebase. Zero real unexplained English mismatches.
-- Separately confirmed la_gss_crosswalk.la_name vs the ONS boundary dataset's own
-- name (la_boundaries.name): 152 of 153 exact matches, one case-only difference
-- ("Isles Of Scilly" vs "Isles of Scilly"). Resolved per the handoff's own "fix on
-- whichever side is easiest" instruction by simply never displaying la_boundaries.name
-- at all -- this function (and the render layer built on it) uses la_gss_crosswalk.
-- la_name as the one real LA display name throughout, matching schools.la_name
-- exactly, which is also the exact string buildLaComparatorSet's own `.in("la_name",
-- laNames)` query needs for click-through re-scoping (default-comparator-lists.ts) --
-- one real name, not two that can drift.
--
-- Predicate parity with the client's own filteredCount()/matchesSectorFilter(), by
-- design, not by accident:
--   - sector: `scs.sector = any(p_sectors)`, empty/null p_sectors = no restriction --
--     matchesSectorFilter's exact "empty set = no restriction" semantics, not a
--     different convention invented for this one RPC.
--   - phase/age-range: mirrors ageRangeForBand's per-band ranges and filteredCount's
--     own union-of-selected-bands loop (lo = min of every selected band's own lo, hi =
--     max of every selected band's own hi -- ONE merged range across all ticked
--     bands, not a per-band OR of separate ranges, replicated faithfully even though
--     it can span a gap between two non-adjacent bands, since that's the client's own
--     real, established behaviour, not a bug this function should silently fix).
--     Deliberately NOT replicated: the client's further single-band "ages" drill-down
--     (individual ages ticked within one phase band) -- an LA-level choropleth is
--     inherently a coarser view than a per-school table; the drill-down stays a
--     per-school-table-only feature. "Adult" contributes no real census age range
--     here (data-view-filters.ts's own ageRangeForBand returns an impossible
--     [Infinity,-Infinity] range for it too -- only ever produces a non-zero figure
--     via feParticipation, which school_current_snapshot does not carry). A known,
--     real, honestly-scoped gap, not silently wrong: an FE college's Post-16/Adult
--     headcount is invisible to this rollup (its real ILR participation figures live
--     nowhere in school_current_snapshot), so FE-sector LAs will under-report
--     against this function specifically -- logged here plainly, not fixed this round.
--   - gender: p_gender ('Girls'|'Boys'|null) reuses region_nation_rank()'s own
--     established real precedent (20261010103000_region_nation_rank_drop_closed_
--     schools.sql) for headcount-SLICING gender semantics (girls-only/boys-only
--     sub-total, both/neither = combined) -- NOT genderMatches()/genderMatchesRelaxed
--     ()'s SCHOOL-MEMBERSHIP matching rule the handoff's own text pointed at, which
--     has no natural analogue here (that rule relaxes a CANDIDATE's gender against
--     one TARGET school's gender when building a comparator set; an LA rollup sums
--     across many schools with no single target to relax against at all). Logged here
--     as a deliberate reading of an ambiguous instruction, not a silent substitution:
--     data-view-filters.ts's own header comment is explicit that gender is a
--     RESLICE-the-number filter, not a membership one (sector is the one deliberate
--     membership exception) -- the sibling region_nation_rank() RPC already made
--     the identical call for the identical filter field, so this follows that
--     established precedent rather than inventing a second reading.
--   - boarding: p_boarding_mode ('boarders'|'day'|'whole'|null) REPLACES the
--     phase-sliced figure entirely when active, current period only, gendered via
--     boarders_gender_split when a real split exists and exactly one gender is
--     selected -- mirrors filteredCount()'s own boarding branch exactly (module
--     comment: boarding and phase/age can't honestly combine, DfE boarding facts
--     are whole-school only). No anchor-period boarding figure exists in this
--     source, so Trend mode has no real comparison while boarding is active --
--     anchorTotal is returned null in that case, the render layer's job to show
--     honestly (same "genuinely no anchor data" discipline the Region/Nation dot
--     map's own Trend mode already applies elsewhere).
--   - status <> 'closed': same convention as nearest_schools()/region_nation_set().
--
-- schoolCount is returned alongside each LA's totals specifically so the render layer
-- can tell a genuine zero (a row present, schoolCount > 0, currentTotal = 0 -- e.g. a
-- real but tiny FE-only filter slice) from genuine no-data (no row at all -- an LA
-- with ZERO schools matching the active sector/filter combination, the common case
-- for a niche sector like "FE" in most LAs). An LA never appears in this function's
-- output at all unless at least one real matching school exists in it -- honoured by
-- construction (an inner join, not a coalesce-to-zero), not a post-hoc check.
create function public.region_nation_la_rollup(
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
with scoped as (
    select
        s.urn,
        lgc.gss_code,
        lgc.la_name,
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
      and srn.region_code = p_region_code
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
)
select coalesce(jsonb_agg(jsonb_build_object(
    'gssCode', gss_code,
    'laName', la_name,
    'schoolCount', school_count,
    'currentTotal', current_total,
    'anchorTotal', anchor_total,
    'currentPeriod', current_period,
    'anchorPeriod', anchor_period
)), '[]'::jsonb)
from (
    select
        gss_code,
        la_name,
        count(*) as school_count,
        sum(coalesce(boarding_value, current_census_value)) as current_total,
        case when p_boarding_mode is not null then null else sum(anchor_census_value) end as anchor_total,
        max(current_period) as current_period,
        max(anchor_period) as anchor_period
    from summed
    group by gss_code, la_name
) per_la;
$$;

grant execute on function public.region_nation_la_rollup(text, text[], text[], text, text) to anon, authenticated;
