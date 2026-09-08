-- Member Data View large-set design v1, item 2. Extends region_nation_set() to LEFT
-- JOIN the new school_current_snapshot table (previous migration) and return each
-- school's real current-period age/gender + boarding breakdown, plus its statutory
-- age range (needed client-side by data-view-filters.ts's own ageRangeForBand/
-- filteredCount to honour an active phase/age-band filter -- not previously returned
-- by this RPC at all).
--
-- This is the fix for the real, live bug confirmed directly in MapView.tsx while
-- writing the design doc: `if (!isTarget && filterActive && current === 0) continue;`
-- -- a stub profile (buildLightweightProfile's own all-null placeholder) always
-- computes filteredCount() === 0 under ANY active phase/gender/boarding filter, so
-- turning on a filter while viewing a Region/Nation set silently emptied the map. Once
-- every marker carries a real current-period breakdown, that same skip only hides a
-- school that GENUINELY doesn't match the filter, exactly as it already does for
-- small/medium sets whose full profiles were always fetched.
--
-- LEFT JOIN, not an inner join: a school can legitimately have no
-- school_current_snapshot row (no real current-period census data at all -- FE
-- colleges, a school that's opened since the last recompute, or the recompute simply
-- hasn't run yet) -- these schools still get a real, positioned, sector-coloured
-- marker (via schools' own columns, unaffected), just with every roll/age/gender/
-- boarding field null, the same honest "no data" treatment buildLightweightProfile
-- already established for the pre-this-round stub case.
--
-- Sector is deliberately NOT re-returned from school_current_snapshot here (that table
-- does carry a denormalised `sector` column, for the ranking RPC's own cheap SQL
-- filtering) -- the client already derives it via typology.ts's sectorTag() from
-- establishmentTypeGroup/establishmentType, which this function already returns; a
-- second `sector` value from a different source risks the two silently disagreeing,
-- with no benefit (the client-side derivation is exactly as cheap for one field).
create or replace function public.region_nation_set(
    p_region_code text,
    p_nation text,
    p_exclude_urn text
)
returns jsonb
language sql
stable
as $$
    select coalesce(
        jsonb_agg(jsonb_build_object(
            'urn', s.urn,
            'name', s.current_name,
            'easting', s.easting,
            'northing', s.northing,
            'establishmentTypeGroup', s.establishment_type_group,
            'establishmentType', s.establishment_type,
            'statutoryLowAge', s.statutory_low_age,
            'statutoryHighAge', s.statutory_high_age,
            'currentPeriod', scs.current_period,
            'totalRoll', scs.total_roll,
            'femaleTotal', scs.female_total,
            'ageGenderCounts', scs.age_gender_counts,
            'boarding', scs.boarding,
            'boardersGenderSplit', scs.boarders_gender_split,
            'anchorPeriod', scs.anchor_period,
            'anchorAgeGenderCounts', scs.anchor_age_gender_counts
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
