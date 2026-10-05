-- PROPOSED, NOT APPLIED. Target: the vicdata production DATA database (the ingest repo's
-- project, where academic_subject_grade_rollup lives) -- NOT this repo's vicdata-public
-- project, which is why it sits here and not in supabase/migrations/. To apply, copy it
-- into /Users/guy/dev/vicdata/supabase/migrations/ with a fresh timestamp and apply it the
-- way that repo applies its migrations. Tested on PGlite:
--   node supabase/tests/v062_s1_grade_rollup_lookup_pglite.mjs
--
-- 0.6.2 S1 (docs/v0.6/grade_rollup_reconciliation_v1.md): the read path the app needs to
-- read academic_subject_grade_rollup at all. The table is granted to `authenticated` only;
-- vicdata_public holds just the anon key, and neither anon nor service_role can select it
-- (checked live 2026-10-05: HTTP 401 / 403, "permission denied"). Same shape and security
-- definer pattern as academic_subject_grade_geography_lookup and
-- academic_subject_qualification_headline_lookup.
--
-- Lineage. The app reads grades today through reference_data_lookup, which returns a clean
-- single predecessor's facts, relabelled, when the requested URN has no rows of its own in
-- that SOURCE. The KS4 sources split by year (historic = periods up to 2022, modern = 2023
-- on), so the fallback here is decided per ERA in the same way: for each requested URN and
-- era with no rollup rows of its own at this key stage (any subject -- the facts path checks
-- the whole source, never one subject), the single predecessor's rows for that era are
-- returned under the requested URN. Measured 2026-10-05: 82 KS4 URNs get their modern grades
-- only through a predecessor today (a direct read would blank their latest year), and 130
-- KS4 schools gain 2021/22-2022/23 only through one (a new academy whose historic results
-- sit under its old URN). The one known edge: a URN whose own historic facts are 2020 totals
-- only (no grades) falls back here but not in the facts path -- historic years only, never a
-- year the app shows today.
--
-- No index needed: every call is entity-led, which the primary key
-- (entity_id, ks_stage, subject, ...) and academic_subject_grade_rollup_entity_idx
-- (entity_id, ks_stage, period) already serve (11 schools x one subject: 16-42 ms cold).
create or replace function public.academic_subject_grade_rollup_lookup(
    p_entity_ids         text[],
    p_ks_stage           text,
    p_subject            text default null,
    p_qualification_type text default null,
    p_period_min         int  default null,
    p_period_max         int  default null,
    p_limit              int  default null,
    p_offset             int  default 0
)
returns table (
    entity_id          text,
    ks_stage           text,
    subject            text,
    qualification_type text,
    grade              text,
    period             int,
    entries            numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    return query execute
        'with req as (
            select distinct unnest($1::text[]) as requested_urn
        ),
        eras as (
            select ''historic''::text as era union all select ''modern''
        ),
        own_eras as (
            select distinct r.entity_id as urn,
                   case when r.period <= 2022 then ''historic'' else ''modern'' end as era
            from public.academic_subject_grade_rollup r
            where r.entity_id = any($1::text[]) and r.ks_stage = $2
        ),
        single_pred as (
            select sl.urn as requested_urn, sl.link_urn as predecessor_urn
            from public.school_lineage sl
            join req on req.requested_urn = sl.urn
            where sl.link_type = ''Predecessor''
              and not exists (
                  select 1 from public.school_lineage sl2
                  where sl2.urn = sl.urn and sl2.link_type = ''Predecessor''
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
            where r.entity_id = any($1::text[]) and r.ks_stage = $2
              and ($3::text is null or r.subject = $3::text)
              and ($4::text is null or r.qualification_type = $4::text)
              and ($5::int is null or r.period >= $5::int)
              and ($6::int is null or r.period <= $6::int)
        ),
        fallback as (
            select m.requested_urn as entity_id, r.ks_stage, r.subject, r.qualification_type, r.grade, r.period, r.entries
            from missing m
            join public.academic_subject_grade_rollup r
              on r.entity_id = m.predecessor_urn and r.ks_stage = $2
             and (case when r.period <= 2022 then ''historic'' else ''modern'' end) = m.era
            where ($3::text is null or r.subject = $3::text)
              and ($4::text is null or r.qualification_type = $4::text)
              and ($5::int is null or r.period >= $5::int)
              and ($6::int is null or r.period <= $6::int)
        )
        select * from direct
        union all
        select * from fallback
        order by 1, 3, 4, 6, 5
        limit $7 offset $8'
        using p_entity_ids, p_ks_stage, p_subject, p_qualification_type, p_period_min, p_period_max, p_limit, p_offset;
end;
$$;

comment on function public.academic_subject_grade_rollup_lookup(text[], text, text, text, int, int, int, int) is
    'vicdata_public read path for academic_subject_grade_rollup (per school, subject, exact qualification type and exact grade; KS5 summed over size, zero-entry grades absent). Requested URNs only (p_entity_ids required). Single-predecessor lineage fallback decided per era (periods to 2022 / from 2023), matching reference_data_lookup''s per-source fallback over the KS4 subject sources. 0.6.2 S1.';

grant execute on function public.academic_subject_grade_rollup_lookup(text[], text, text, text, int, int, int, int) to anon;
