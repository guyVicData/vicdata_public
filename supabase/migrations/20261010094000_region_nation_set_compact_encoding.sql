-- Large-set design v1, item 2 -- real regression found live verifying against
-- production (2026-10-10), the same "measure against the live deployed site, not a
-- synthetic call" discipline this round was explicitly asked to apply to the Nation
-- comparator RPC anyway: with the previous migration's jsonb-object-per-age encoding,
-- a live curl-timed call to /api/data-view/region-nation-set?scope=nation (real
-- Bearer token, the shared test membership, Charterhouse URN 125340) measured
-- 4.7-6.3s and a 10.9MB response -- BEFORE school_current_snapshot even had real data
-- populated yet (Part 3 of scripts/recompute-census-derived.ts was still mid-run),
-- i.e. this was purely the cost of 8 new (mostly-null) jsonb_build_object keys times
-- ~49,425 rows. Previously-documented Nation timing for this same endpoint (pre-this-
-- round) was ~450-750ms. Real per-school age/gender data will only make this worse
-- once populated -- not acceptable to ship without fixing, not just logged and left.
--
-- Root cause: `age_gender_counts`/`anchor_age_gender_counts` were being returned
-- verbatim as the STORAGE format (a jsonb object keyed by age-as-string, each value
-- `{"male": n, "female": n}`) -- fine for a single school's profile, very wasteful at
-- ~49,000 schools: every one of ~10-15 real ages per school pays for the literal
-- strings "male"/"female" and JSON object punctuation on top of the two real numbers,
-- repeated twice (current + anchor).
--
-- Fix: transform to a compact array-of-triples wire format on READ, via a LATERAL
-- jsonb_each unnest per school -- `[[age, male, female], ...]` -- no repeated key
-- strings at all, roughly a 2.5-3x reduction in the age-breakdown portion of the
-- payload. The STORED format on school_current_snapshot is deliberately unchanged
-- (still the object-keyed shape) -- that table has its own reasons to stay
-- object-keyed (a future SQL consumer summing by jsonb_each, same discipline the
-- ranking RPC's own header comment discusses), this is purely a wire-format change at
-- the one place that pays for it at full scale. src/lib/data-view-serialize.ts's
-- ageGenderCountsFromCompact (renamed from ageGenderCountsFromJson) is the matching
-- client-side decode.
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
            'ageGenderCounts', cur.compact,
            'boarding', scs.boarding,
            'boardersGenderSplit', scs.boarders_gender_split,
            'anchorPeriod', scs.anchor_period,
            'anchorAgeGenderCounts', anc.compact
        )),
        '[]'::jsonb
    )
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    left join public.school_current_snapshot scs on scs.urn = s.urn
    left join lateral (
        select jsonb_agg(jsonb_build_array((kv.key)::int, (kv.value->>'male')::int, (kv.value->>'female')::int)) as compact
        from jsonb_each(coalesce(scs.age_gender_counts, '{}'::jsonb)) as kv
    ) cur on true
    left join lateral (
        select jsonb_agg(jsonb_build_array((kv.key)::int, (kv.value->>'male')::int, (kv.value->>'female')::int)) as compact
        from jsonb_each(coalesce(scs.anchor_age_gender_counts, '{}'::jsonb)) as kv
    ) anc on true
    where srn.urn <> p_exclude_urn
      and (
          (p_region_code is not null and srn.region_code = p_region_code)
          or (p_region_code is null and srn.nation = p_nation)
      );
$$;
