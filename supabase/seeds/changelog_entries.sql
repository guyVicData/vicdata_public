-- VicData 0.8 front door (A7): the changelog's entries, written by Guy. Run once the migration
-- 20261123090000_v08_front_door_r1.sql is applied (it writes: the project-ref check first; see
-- docs/v0.8/front_door_1_report_v1.md, Guy's commands). Re-running adds nothing twice (keyed on title).
--
-- One entry per change people would notice. `published_at` in the future holds an entry back until then.
-- To credit feedback, name the people whose feedback led to it (their profile ids) and the line they see:
--   credit_text = 'Your feedback on the GCSE dashboard led to this.',
--   credit_profile_ids = array['<profile uuid>']::uuid[]
-- `link` is a path in the app ('/teacher'), or null.

insert into public.changelog_entries (title, body, published_at, link)
select v.title, v.body, v.published_at::timestamptz, v.link
from (values
    ('A new home, and walkthroughs',
     'Your home is now a few plain questions. Each one walks you through a few screens, one thing at a time, and shows you where it lives on the full dashboard. Prefer the dashboards? "Show fewer questions" keeps them one click away.',
     '2026-12-01 08:00:00+00', '/teacher'),
    ('A mid-tone theme, and clearer panels',
     'Dark · Mid · Light: Mid gives the homes and walkthroughs their own colour. On every dashboard, a closed panel now looks like a button you can open.',
     '2026-12-01 08:00:00+00', null)
) as v (title, body, published_at, link)
where not exists (select 1 from public.changelog_entries e where e.title = v.title);
