-- VicData 0.6 night 2, S7: today's meetings move onto presentation dashboards
-- (scope brief §7.5; audit C §7.3 mapping).
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v06_s7_meetings_pglite.mjs), NOT APPLIED.
-- Needs the S2 migration (20261103100000_v06_s2_dashboards.sql) applied first. Apply:
--   supabase db query --linked -f supabase/migrations/20261104110000_v06_s7_meetings_migration.sql
--   supabase migration repair --status applied 20261104110000 --linked
-- Check:
--   supabase db query --linked "select d.name, d.meeting_date, jsonb_array_length(v.config->'presentation'->'slides') slides from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug like 'legacy-meeting:%'"
--
-- What it does, per row of the old `meetings` table:
--   * one `dashboards` row: kind 'presentation', owner scope 'user' (the meeting's owner),
--     name, meeting_date (a null date takes created_at's date), created_at; slug
--     'legacy-meeting:<old id>' marks it as migrated, so a second run skips it;
--   * school_account_id from the owner's approved membership when there is exactly one
--     (the old table never stored a school, audit C §7.1); null otherwise;
--   * version 1 of its config: one slide per old slide in `position` order (gaps
--     renumbered), one slot each. Slot views keep LIVE data (keepLive true, no year
--     pinned): old decks re-read live data by design, so pinning a year now would change
--     what they show. The old delete_by goes into the config's `legacy` block, for audit;
--   * an old slide key "{phase}::{round-5 view id}" maps to a registry dataview where one
--     exists (the table below). A key that won't parse, a KS2 key, or a view with no
--     registry equivalent becomes a TEXT slot keeping its caption, plus a line saying
--     the view is no longer available. The one live slide ("ks4:results:Biology", no
--     "::") is this case.
--
-- Additive and idempotent: the old tables are not dropped or altered, existing
-- dashboards are not touched, and re-running inserts nothing new. The personal-cap
-- trigger is suspended inside this transaction only: a migrated meeting must never be
-- refused for the owner's number of upcoming meetings.
--
-- Round-5 view id: "{column}|{axis}|{subjectKey or -}|{now|trend}", subjectKey
-- "{subject}::{qualification type}" (src/lib/teacher-view-catalogue.ts viewId). Mapping
-- (registry ids from src/catalogue/dataviews.ts):
--   candidates | vs_* (4 subject axes) | now   -> DV-C2-CUR-BARS    (entries by subject in the group)
--   candidates | vs_*                  | trend -> DV-C2-TR-INDEXED  (entries in the group, indexed)
--   context    | vs_*                  | now   -> DV-C2-CUR-DONUT   (entries as a share of the group)
--   context    | vs_*                  | trend -> DV-C2-TR-INDEXED
--   results    | vs_*                  | now   -> DV-C2-CUR-BARS    (points by subject in the group)
--   results    | vs_*                  | trend -> DV-C2-TR-CHART
--   rankings   | rank_list / rank_same_sector / rank_local_rivals / rank_similar_size
--                                              -> DV-C3-CUR-RANKING (schools ranked in that set)
--   category_vs_categories, share_of_cohort, anything at KS2 -> text slot (no registry view)
-- vs_* compare names: vs_school_avg "the school average in this qualification",
-- vs_category "its subject category", vs_all_subjects "all subjects", vs_chosen "your
-- selected subjects".

begin;

create or replace function public.v06_s7_legacy_slot(p_key text, p_caption text, p_slide uuid, p_school_urn text)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_pos int := strpos(p_key, '::');
    v_phase text;
    v_parts text[];
    v_column text;
    v_axis text;
    v_subject_key text;
    v_time text;
    v_subject text;
    v_qual text;
    v_dv text;
    v_data text;
    v_compare jsonb;
    v_label text;
    v_question text;
begin
    if v_pos > 0 then
        v_phase := left(p_key, v_pos - 1);
        v_parts := string_to_array(substr(p_key, v_pos + 2), '|');
    end if;
    if v_pos > 0 and v_phase in ('ks4', 'ks5') and array_length(v_parts, 1) = 4 and v_parts[4] in ('now', 'trend') then
        v_column := v_parts[1];
        v_axis := v_parts[2];
        v_subject_key := nullif(v_parts[3], '-');
        v_time := v_parts[4];
        if v_subject_key is not null then
            v_subject := split_part(v_subject_key, '::', 1);
            v_qual := nullif(substr(v_subject_key, length(v_subject) + 3), '');
        end if;

        if v_column = 'rankings' and v_time = 'now' and v_axis in ('rank_list', 'rank_same_sector', 'rank_local_rivals', 'rank_similar_size') then
            v_dv := 'DV-C3-CUR-RANKING';
            v_data := 'academic.results';
            v_label := case v_axis
                when 'rank_list' then 'Nearest 10'
                when 'rank_same_sector' then 'Nearest 10, same sector'
                when 'rank_local_rivals' then 'Local rivals'
                else case v_phase when 'ks5' then 'Similar-sized sixth forms' else 'Similar-sized schools' end
            end;
            v_compare := jsonb_build_object('kind', 'schools', 'name', v_label);
            v_question := case v_axis
                when 'rank_list' then 'How do we rank against the ten nearest schools, one by one?'
                when 'rank_same_sector' then 'How do we rank against the nearest schools in our own sector?'
                when 'rank_local_rivals' then 'How do we rank against the local schools families weigh us against?'
                else case v_phase when 'ks5' then 'How do we rank against nearby sixth forms of a similar size?'
                                  else 'How do we rank against nearby schools with a similar-sized GCSE year?' end
            end;
        elsif v_column in ('candidates', 'context', 'results') and v_subject is not null
              and v_axis in ('vs_school_avg', 'vs_category', 'vs_all_subjects', 'vs_chosen') then
            v_dv := case
                when v_column = 'candidates' and v_time = 'now' then 'DV-C2-CUR-BARS'
                when v_column = 'context' and v_time = 'now' then 'DV-C2-CUR-DONUT'
                when v_column = 'results' and v_time = 'now' then 'DV-C2-CUR-BARS'
                when v_column = 'results' then 'DV-C2-TR-CHART'
                else 'DV-C2-TR-INDEXED'
            end;
            v_data := case v_column when 'results' then 'academic.results' else 'academic.candidates' end;
            v_compare := jsonb_build_object('kind', 'subjects', 'name', case v_axis
                when 'vs_school_avg' then 'the school average in this qualification'
                when 'vs_category' then 'its subject category'
                when 'vs_all_subjects' then 'all subjects'
                else 'your selected subjects' end);
            -- The round-5 question (teacher-view-catalogue.ts AXES), so the slide keeps
            -- the title it had.
            v_question := case v_axis
                when 'vs_school_avg' then format('How is %s doing against the school average in this qualification?', v_subject)
                when 'vs_category' then format('How is %s doing against the other subjects in its category?', v_subject)
                when 'vs_all_subjects' then format('How is %s doing against every other subject here?', v_subject)
                else format('How is %s doing against subjects I pick myself?', v_subject)
            end;
            if v_time = 'trend' then
                v_question := regexp_replace(v_question, '\?$', '') || ', year on year?';
            end if;
        end if;
    end if;

    if v_dv is null then
        return jsonb_build_object(
            'title', coalesce(p_caption, ''),
            'slot', jsonb_build_object(
                'id', 'slot-' || p_slide,
                'text', concat_ws(E'\n\n', nullif(btrim(coalesce(p_caption, '')), ''),
                    format('This view is no longer available (it was "%s" on the old Meetings page).', p_key))));
    end if;

    return jsonb_build_object(
        'title', coalesce(p_caption, v_question, ''),
        'slot', jsonb_build_object(
            'id', 'slot-' || p_slide,
            'view', jsonb_strip_nulls(jsonb_build_object(
                'id', 'view-' || p_slide,
                'kind', 'view',
                'dataview', v_dv,
                'keepLive', true,
                'pinned', jsonb_strip_nulls(jsonb_build_object(
                    'schoolUrn', p_school_urn,
                    'phase', v_phase,
                    'data', v_data,
                    'results', case when v_data = 'academic.results' then 'points' end,
                    'subject', v_subject,
                    'subjectLabel', v_subject,
                    'qualificationType', v_qual,
                    'compare', v_compare,
                    'legacy', jsonb_build_object('chartKey', p_key, 'column', v_column, 'axis', v_axis, 'time', v_time)))))));
end;
$$;

alter table public.dashboards disable trigger dashboards_personal_cap;

-- The meetings not yet migrated, each with its new dashboard id and the owner's school
-- (when they have exactly one approved membership).
create temporary table v06_s7_todo on commit drop as
with owners as (
    select m.profile_id,
           case when count(*) = 1 then min(m.school_account_id::text)::uuid end as school_account_id,
           case when count(*) = 1 then min(a.school_urn) end as school_urn
    from public.school_memberships m
    join public.school_accounts a on a.id = m.school_account_id
    where m.status = 'approved'
    group by m.profile_id
)
select mt.id, mt.profile_id, mt.name, mt.meeting_date, mt.delete_by, mt.created_at,
       o.school_account_id, o.school_urn, gen_random_uuid() as new_id
from public.meetings mt
left join owners o on o.profile_id = mt.profile_id
where not exists (select 1 from public.dashboards d where d.slug = 'legacy-meeting:' || mt.id);

insert into public.dashboards (id, slug, kind, owner_scope, owner_profile_id, school_account_id, name, meeting_date, created_by, created_at, updated_at)
select t.new_id, 'legacy-meeting:' || t.id, 'presentation', 'user', t.profile_id, t.school_account_id,
       left(t.name, 120), coalesce(t.meeting_date, t.created_at::date), t.profile_id, t.created_at, now()
from v06_s7_todo t;

with slides as (
    select t.id as meeting_id,
           jsonb_agg(
               jsonb_build_object(
                   'id', 'slide-' || s.id,
                   'title', l.r ->> 'title',
                   'notes', '',
                   'layout', 'auto',
                   'slots', jsonb_build_array(l.r -> 'slot'))
               order by s.position, s.id) as slides
    from v06_s7_todo t
    join public.meeting_slides s on s.meeting_id = t.id
    cross join lateral (select public.v06_s7_legacy_slot(s.chart_key, s.caption, s.id, t.school_urn) as r) l
    group by t.id
)
insert into public.dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary, created_by)
select t.new_id, 1, 1,
       jsonb_build_object(
           'schema_version', 1,
           'id', t.new_id,
           'name', left(t.name, 120),
           'kind', 'presentation',
           'owner', 'user',
           'colour', jsonb_build_object('key', 'neutral'),
           'layout', jsonb_build_object('preset', '1', 'tracks', '[]'::jsonb, 'accordion', 'independent'),
           'columns', '[]'::jsonb,
           'rows', '[]'::jsonb,
           'panels', '[]'::jsonb,
           'presentation', jsonb_build_object(
               'meetingDate', coalesce(t.meeting_date, t.created_at::date),
               'slides', coalesce(sl.slides, jsonb_build_array(jsonb_build_object('id', 'slide-' || t.id, 'title', '', 'notes', '', 'layout', 'auto', 'slots', '[]'::jsonb)))),
           'legacy', jsonb_build_object('meetingId', t.id, 'deleteBy', t.delete_by, 'meetingDateWasNull', t.meeting_date is null, 'migratedBy', '20261104110000_v06_s7_meetings_migration')),
       'Migrated from the old Meetings page',
       format('%s slide%s, from the old Meetings page', coalesce(jsonb_array_length(sl.slides), 0), case when coalesce(jsonb_array_length(sl.slides), 0) = 1 then '' else 's' end),
       t.profile_id
from v06_s7_todo t
left join slides sl on sl.meeting_id = t.id;

update public.dashboards d set published_version_id = v.id
from v06_s7_todo t
join public.dashboard_versions v on v.dashboard_id = t.new_id and v.version = 1
where d.id = t.new_id;

alter table public.dashboards enable trigger dashboards_personal_cap;

drop function public.v06_s7_legacy_slot(text, text, uuid, text);

commit;
