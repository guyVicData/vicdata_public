-- 0.6.2 S3: the proposed RPC's body, inlined (The Chase + 10 nearest, GCSE History, 2021 on), run 3 times read-only: the 'after RPC' timing.
select count(*) from (with req as (
            select distinct unnest('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) as requested_urn
        ),
        eras as (
            select 'historic'::text as era union all select 'modern'
        ),
        own_eras as (
            select distinct r.entity_id as urn,
                   case when r.period <= 2022 then 'historic' else 'modern' end as era
            from public.academic_subject_grade_rollup r
            where r.entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) and r.ks_stage = 'ks4'
        ),
        single_pred as (
            select sl.urn as requested_urn, sl.link_urn as predecessor_urn
            from public.school_lineage sl
            join req on req.requested_urn = sl.urn
            where sl.link_type = 'Predecessor'
              and not exists (
                  select 1 from public.school_lineage sl2
                  where sl2.urn = sl.urn and sl2.link_type = 'Predecessor'
                    and sl2.link_urn <> sl.link_urn
              )
        ),
        missing as (
            select sp.requested_urn, sp.predecessor_urn, e.era
            from single_pred sp cross join eras e
            where not exists (select 1 from own_eras o where o.urn = sp.requested_urn and o.era = e.era)
        ),
        direct as (
            select r.entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from public.academic_subject_grade_rollup r
            where r.entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) and r.ks_stage = 'ks4'
              and ('History'::text is null or r.subject = 'History'::text)
              and (null::text is null or r.qualification_type = null::text)
              and (2021::int is null or r.period >= 2021::int)
              and (null::int is null or r.period <= null::int)
        ),
        fallback as (
            select m.requested_urn as entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from missing m
            join public.academic_subject_grade_rollup r
              on r.entity_id = m.predecessor_urn and r.ks_stage = 'ks4'
             and (case when r.period <= 2022 then 'historic' else 'modern' end) = m.era
            where ('History'::text is null or r.subject = 'History'::text)
              and (null::text is null or r.qualification_type = null::text)
              and (2021::int is null or r.period >= 2021::int)
              and (null::int is null or r.period <= null::int)
        )
        select * from direct
        union all
        select * from fallback
        order by 1, 3, 4, 6, 5
        limit 1000 offset 0) t;
select count(*) from (with req as (
            select distinct unnest('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) as requested_urn
        ),
        eras as (
            select 'historic'::text as era union all select 'modern'
        ),
        own_eras as (
            select distinct r.entity_id as urn,
                   case when r.period <= 2022 then 'historic' else 'modern' end as era
            from public.academic_subject_grade_rollup r
            where r.entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) and r.ks_stage = 'ks4'
        ),
        single_pred as (
            select sl.urn as requested_urn, sl.link_urn as predecessor_urn
            from public.school_lineage sl
            join req on req.requested_urn = sl.urn
            where sl.link_type = 'Predecessor'
              and not exists (
                  select 1 from public.school_lineage sl2
                  where sl2.urn = sl.urn and sl2.link_type = 'Predecessor'
                    and sl2.link_urn <> sl.link_urn
              )
        ),
        missing as (
            select sp.requested_urn, sp.predecessor_urn, e.era
            from single_pred sp cross join eras e
            where not exists (select 1 from own_eras o where o.urn = sp.requested_urn and o.era = e.era)
        ),
        direct as (
            select r.entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from public.academic_subject_grade_rollup r
            where r.entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) and r.ks_stage = 'ks4'
              and ('History'::text is null or r.subject = 'History'::text)
              and (null::text is null or r.qualification_type = null::text)
              and (2021::int is null or r.period >= 2021::int)
              and (null::int is null or r.period <= null::int)
        ),
        fallback as (
            select m.requested_urn as entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from missing m
            join public.academic_subject_grade_rollup r
              on r.entity_id = m.predecessor_urn and r.ks_stage = 'ks4'
             and (case when r.period <= 2022 then 'historic' else 'modern' end) = m.era
            where ('History'::text is null or r.subject = 'History'::text)
              and (null::text is null or r.qualification_type = null::text)
              and (2021::int is null or r.period >= 2021::int)
              and (null::int is null or r.period <= null::int)
        )
        select * from direct
        union all
        select * from fallback
        order by 1, 3, 4, 6, 5
        limit 1000 offset 0) t;
select count(*) from (with req as (
            select distinct unnest('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) as requested_urn
        ),
        eras as (
            select 'historic'::text as era union all select 'modern'
        ),
        own_eras as (
            select distinct r.entity_id as urn,
                   case when r.period <= 2022 then 'historic' else 'modern' end as era
            from public.academic_subject_grade_rollup r
            where r.entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) and r.ks_stage = 'ks4'
        ),
        single_pred as (
            select sl.urn as requested_urn, sl.link_urn as predecessor_urn
            from public.school_lineage sl
            join req on req.requested_urn = sl.urn
            where sl.link_type = 'Predecessor'
              and not exists (
                  select 1 from public.school_lineage sl2
                  where sl2.urn = sl.urn and sl2.link_type = 'Predecessor'
                    and sl2.link_urn <> sl.link_urn
              )
        ),
        missing as (
            select sp.requested_urn, sp.predecessor_urn, e.era
            from single_pred sp cross join eras e
            where not exists (select 1 from own_eras o where o.urn = sp.requested_urn and o.era = e.era)
        ),
        direct as (
            select r.entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from public.academic_subject_grade_rollup r
            where r.entity_id = any('{137625,137186,137101,136890,136803,116999,137051,138107,135913,136897,136925}'::text[]) and r.ks_stage = 'ks4'
              and ('History'::text is null or r.subject = 'History'::text)
              and (null::text is null or r.qualification_type = null::text)
              and (2021::int is null or r.period >= 2021::int)
              and (null::int is null or r.period <= null::int)
        ),
        fallback as (
            select m.requested_urn as entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from missing m
            join public.academic_subject_grade_rollup r
              on r.entity_id = m.predecessor_urn and r.ks_stage = 'ks4'
             and (case when r.period <= 2022 then 'historic' else 'modern' end) = m.era
            where ('History'::text is null or r.subject = 'History'::text)
              and (null::text is null or r.qualification_type = null::text)
              and (2021::int is null or r.period >= 2021::int)
              and (null::int is null or r.period <= null::int)
        )
        select * from direct
        union all
        select * from fallback
        order by 1, 3, 4, 6, 5
        limit 1000 offset 0) t
