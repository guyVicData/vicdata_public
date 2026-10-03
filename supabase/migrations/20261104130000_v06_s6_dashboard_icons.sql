-- VicData 0.6 night 2, S6: uploaded dashboard icons (scope brief §4.9, decision D8;
-- board docs/wireframes/v0.6/Icon.dc.html). A dashboard's or meeting's icon comes from a
-- view, the icon set, or -- super-admin only in 0.6 -- an uploaded square PNG or SVG.
-- Uploads live in a public Storage bucket, `dashboard-icons`; the config stores the
-- object's path (config.icon = { source: 'upload', ref: '<dashboard>/<name>.png' }) and
-- src/lib/dashboard-icons.ts turns it into the public URL.
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v06_s6_dashboard_icons_pglite.mjs, with the
-- storage schema stubbed: PGlite has no Supabase Storage), NOT APPLIED. Depends on
-- 20261103090000_v06_s1_roles_teams_platform.sql (is_platform_admin). Apply:
--   supabase db query --linked -f supabase/migrations/20261104130000_v06_s6_dashboard_icons.sql
--   supabase migration repair --status applied 20261104130000 --linked
-- Then check in the dashboard (Storage) that the bucket shows as public with the two
-- MIME types and the 512 KB limit.
--
-- Access:
--   read    everyone (a public bucket; the select policy also lets the API list them);
--   insert  platform admins only;
--   update  platform admins only;
--   delete  platform admins only.
-- storage.objects already has RLS on in every Supabase project; this file only adds
-- policies for this bucket and touches no other bucket's.
--
-- SVG note: an SVG can carry script, but icons are only ever drawn through <img>, where
-- script doesn't run, and only a platform admin can upload one.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dashboard-icons', 'dashboard-icons', true, 524288, array['image/png', 'image/svg+xml'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dashboard_icons_read on storage.objects;
create policy dashboard_icons_read on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'dashboard-icons');

drop policy if exists dashboard_icons_insert on storage.objects;
create policy dashboard_icons_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'dashboard-icons' and public.is_platform_admin());

drop policy if exists dashboard_icons_update on storage.objects;
create policy dashboard_icons_update on storage.objects
    for update to authenticated
    using (bucket_id = 'dashboard-icons' and public.is_platform_admin())
    with check (bucket_id = 'dashboard-icons' and public.is_platform_admin());

drop policy if exists dashboard_icons_delete on storage.objects;
create policy dashboard_icons_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'dashboard-icons' and public.is_platform_admin());
