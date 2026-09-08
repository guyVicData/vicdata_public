-- Large-set design v1, item 2 -- companion to the previous migration (school_current_
-- snapshot now stores age_gender_counts/anchor_age_gender_counts already in the
-- compact array-of-triples wire shape). region_nation_set() no longer needs the two
-- LATERAL jsonb_each(...) unnests at all -- the real cause of the Nation-scale
-- statement timeout found live -- it just reads the columns straight through.
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
            scs.age_gender_counts,
            case when scs.boarding is null then null
                 else jsonb_build_array((scs.boarding->>'boarders')::int, (scs.boarding->>'day')::int, (scs.boarding->>'total')::int) end,
            case when scs.boarders_gender_split is null then null
                 else jsonb_build_array((scs.boarders_gender_split->>'male')::int, (scs.boarders_gender_split->>'female')::int) end,
            scs.anchor_period,
            scs.anchor_age_gender_counts
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
