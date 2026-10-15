-- Subject latest names round (vicdata docs/vicdata_subject_latest_names_report_v1.md, 2026-10-15):
-- saved choices hold GCSE subjects under the names DfE used before its 2025/26 release; this
-- rewrites them to the latest names the app now shows ("Maths (General)" -> "Mathematics").
--
-- The app already reads every saved choice through the same map (src/lib/subject-latest-names.ts:
-- teacher-view-data.ts, dashboards-store.ts, viewspec.ts upgradeConfig, published-vicdata.ts), so
-- nothing breaks before or without this. It makes the stored copies agree, so a later save, an
-- export or a query sees one name.
--
-- What it rewrites, with the same rule as the app (latestNamesInKey / latestNamesInSaved): a
-- string that IS an old name, or a segment of a key between "|" and "::" that is one; object keys
-- as well as values. Free text with an old name inside it ("Maths (General) dipped") is left alone.
--   teacher_view_preferences.subjects   ticked subjects, "{subject}::{qualificationType}"
--                                       (deduplicated, order kept)
--   teacher_view_preferences.columns    pinned view ids, chosen:{column} lists
--   dashboard_drafts.config             meeting slots, column focus subjects, view params
--   dashboard_user_state.state          keyed by view ids
--   recruitment_jobs.subject            free text: an exact old name only
-- Not rewritten:
--   dashboard_versions                  published versions are immutable (dashboard_versions_immutable
--                                       trigger); they are read through the map
--   meetings, meeting_slides            legacy, read-only; read through the map
--   usage_events                        analytics: what was looked at, under the name of the time
--
-- The map is inlined (the app database cannot read the ingest's subject_label_map): its rows for
-- every qualification. The ingest's one qualification-specific row (VRQ Construction) needs a
-- qualification a saved choice does not carry, so a saved "Construction and the Built Environment"
-- stays the BTEC subject's name, as in the app.
--
-- Idempotent: a latest name is never an old one, so a second run changes nothing. updated_at is
-- left as it is (nobody edited these).
--
-- Target: the app database (lnhulykjlxmoneappnsp). NOT APPLIED by the build: Guy applies it, after
-- the app release.

begin;

-- Temporary: the map and the two functions live only for this session.
create temporary table subject_latest_names (old_name text primary key, latest_name text not null);

insert into subject_latest_names values
    ('Additional Maths (FSMQ)', 'Mathematics (Additional)'),
    ('Art & Design', 'Art and Design'),
    ('Business/Finance', 'Business / Finance'),
    ('Chemistry (General)', 'Chemistry'),
    ('Computer Appreciation / Introduction', 'Computer Appreciation (Introduction)'),
    ('Computer Appreciation/Introduction', 'Computer Appreciation (Introduction)'),
    ('Construction and the Built Environment (Construction)', 'Construction and the Built Environment'),
    ('D & T', 'Design and Technology'),
    ('D & T Product Design', 'Design and Technology (Product Design)'),
    ('Dance: General', 'Dance'),
    ('Electronics (Physics)', 'Electronics'),
    ('Food Science/Technology', 'Food Science / Technology'),
    ('French Language', 'French'),
    ('Government / Politics Studies', 'Government and Politics'),
    ('Government/Politics Studies', 'Government and Politics'),
    ('Greek', 'Modern Greek'),
    ('Greek (Classic)', 'Classical Greek'),
    ('Hebrew Language', 'Modern Hebrew'),
    ('Hospitality / Catering Studies', 'Hospitality and Catering'),
    ('Hospitality/Catering Studies', 'Hospitality and Catering'),
    ('Japanese Language', 'Japanese'),
    ('Land based Studies', 'Land Based Studies'),
    ('Maths (General)', 'Mathematics'),
    ('Music Performance: Group', 'Music Performance (Group)'),
    ('Music Studies (General)', 'Music Studies'),
    ('Persian Language', 'Persian'),
    ('Physics (General)', 'Physics'),
    ('Psychology (General)', 'Psychology'),
    ('Science Double Award', 'Combined Science'),
    ('Speech & Drama', 'Speech and Drama'),
    ('Tourism', 'Travel and Tourism');

-- latestNamesInKey: the whole string, else each segment between "|" and "::".
create function pg_temp.latest_names_in_key(k text) returns text
language sql stable as $$
    select coalesce(
        (select m.latest_name from subject_latest_names m where m.old_name = k),
        case when position('|' in k) = 0 and position('::' in k) = 0 then k else (
            select string_agg(
                (select string_agg(coalesce(m.latest_name, seg.s), '::' order by seg.n)
                 from unnest(string_to_array(part.p, '::')) with ordinality seg(s, n)
                 left join subject_latest_names m on m.old_name = seg.s),
                '|' order by part.n)
            from unnest(string_to_array(k, '|')) with ordinality part(p, n)
        ) end)
$$;

-- latestNamesInSaved: every string value and object key, walked.
create function pg_temp.latest_names_in_saved(j jsonb) returns jsonb
language plpgsql stable as $$
declare
    walked jsonb;
begin
    case jsonb_typeof(j)
        when 'string' then
            return to_jsonb(pg_temp.latest_names_in_key(j #>> '{}'));
        when 'array' then
            select coalesce(jsonb_agg(pg_temp.latest_names_in_saved(e) order by n), '[]'::jsonb) into walked
            from jsonb_array_elements(j) with ordinality t(e, n);
            return walked;
        when 'object' then
            select coalesce(jsonb_object_agg(pg_temp.latest_names_in_key(k), pg_temp.latest_names_in_saved(v)), '{}'::jsonb) into walked
            from jsonb_each(j) t(k, v);
            return walked;
        else
            return j;
    end case;
end
$$;

-- Ticked subjects: rewritten, then deduplicated keeping the first of each.
update public.teacher_view_preferences p
set subjects = (
    select coalesce(jsonb_agg(to_jsonb(x.s) order by x.n), '[]'::jsonb)
    from (
        select s, min(n) as n
        from (
            select pg_temp.latest_names_in_key(e #>> '{}') as s, n
            from jsonb_array_elements(p.subjects) with ordinality t(e, n)
            where jsonb_typeof(e) = 'string'
        ) r
        group by s
    ) x
)
where jsonb_typeof(p.subjects) = 'array'
  and exists (
      select 1 from jsonb_array_elements_text(p.subjects) e
      where pg_temp.latest_names_in_key(e) <> e
  );

update public.teacher_view_preferences
set columns = pg_temp.latest_names_in_saved(columns)
where pg_temp.latest_names_in_saved(columns) <> columns;

update public.dashboard_drafts
set config = pg_temp.latest_names_in_saved(config)
where pg_temp.latest_names_in_saved(config) <> config;

update public.dashboard_user_state
set state = pg_temp.latest_names_in_saved(state)
where pg_temp.latest_names_in_saved(state) <> state;

update public.recruitment_jobs j
set subject = m.latest_name
from subject_latest_names m
where j.subject = m.old_name;

drop function pg_temp.latest_names_in_saved(jsonb);
drop function pg_temp.latest_names_in_key(text);
drop table subject_latest_names;

commit;
