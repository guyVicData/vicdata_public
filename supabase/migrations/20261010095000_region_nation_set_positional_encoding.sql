-- Large-set design v1, item 2 -- SECOND real regression found live verifying against
-- production (2026-10-10), same session as the previous migration's compact
-- age-breakdown fix. That fix alone made NO measurable difference (10,903,310 bytes,
-- byte-for-byte identical, before and after) -- because school_current_snapshot had
-- no real rows yet at measurement time (Part 3 of scripts/recompute-census-derived.ts
-- was still mid-run), so the compact-array transform had nothing to compact; every
-- new field was simply `null`.
--
-- That "all null" measurement is itself the real finding: it isolates the cost of
-- this round's OWN schema change, independent of real data volume. 10.9MB / 49,425
-- rows = ~221 bytes of pure overhead PER SCHOOL, for 10 new fields that are all
-- `null` -- almost entirely the cost of repeating 16 JSON OBJECT KEY NAMES (urn,
-- name, easting, northing, establishmentTypeGroup, establishmentType,
-- statutoryLowAge, statutoryHighAge, currentPeriod, totalRoll, femaleTotal,
-- ageGenderCounts, boarding, boardersGenderSplit, anchorPeriod,
-- anchorAgeGenderCounts -- average ~15 characters each) on EVERY ONE of ~49,000 rows.
-- A keyed `"establishmentTypeGroup":null,` costs ~28 bytes; a positional `null,`
-- costs 5. That gap, times 16 keys times 49,000 rows, is the whole regression --
-- real per-school data (once school_current_snapshot populates) adds ON TOP of this,
-- it isn't the dominant cost by itself.
--
-- Fix: region_nation_set() now returns an array of positional ARRAYS (tuples), not
-- objects -- one well-known, DOCUMENTED field order shared between this function and
-- region-nation-comparator.ts's own decode (that file's own comment carries the same
-- order, kept in sync by hand since Postgres has no way to enforce a TS tuple type at
-- the SQL end). Same principle already applied one level down for age_gender_counts
-- in the previous migration (a compact array instead of a keyed object) -- this
-- migration applies it at the TOP level too, which is where the actual measured cost
-- was concentrated. `boarding`/`boardersGenderSplit` are ALSO flattened to positional
-- arrays for the same reason (fewer schools have real boarding data than have a real
-- current_period at all, so this is a smaller win than the top level, but free to
-- take at the same time).
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
            cur.compact,
            case when scs.boarding is null then null
                 else jsonb_build_array((scs.boarding->>'boarders')::int, (scs.boarding->>'day')::int, (scs.boarding->>'total')::int) end,
            case when scs.boarders_gender_split is null then null
                 else jsonb_build_array((scs.boarders_gender_split->>'male')::int, (scs.boarders_gender_split->>'female')::int) end,
            scs.anchor_period,
            anc.compact
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
