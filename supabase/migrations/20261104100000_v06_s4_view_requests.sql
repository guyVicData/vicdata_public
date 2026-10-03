-- VicData 0.6 night 2, S4: "Ask for this view" requests (combinations doc §4.3, scope brief
-- §4.6a). When the chooser's Pick list is empty, anyone signed in can ask for the view;
-- the exact context they were in (data, phase, measure, focus, compare, time, where the
-- panel is) is saved as JSON so the request reads in catalogue terms. Only platform admins
-- read them; S5's "Export planned views" lists them beside the dashboard's placeholders.
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v06_s4_view_requests_pglite.mjs), NOT APPLIED.
-- Depends on 20261103090000_v06_s1_roles_teams_platform.sql (is_platform_admin). Apply:
--   supabase db query --linked -f supabase/migrations/20261104100000_v06_s4_view_requests.sql
--   supabase migration repair --status applied 20261104100000 --linked
--
-- RLS:
--   insert  any signed-in user, only as themselves, only as a new ('open') request;
--   select  platform admins only (not even the asker reads them back: there is no screen);
--   update  platform admins only (status as the backlog moves);
--   delete  nobody through PostgREST.

create table if not exists public.view_requests (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    description text not null default '' check (char_length(description) <= 2000),
    -- The chooser's PickPanelContext (src/catalogue/pick.ts), verbatim.
    context jsonb not null check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 32768),
    -- Where it was asked from, for grouping (null outside a dashboard, e.g. a meeting).
    dashboard_slug text check (dashboard_slug is null or char_length(dashboard_slug) <= 200),
    panel_id text check (panel_id is null or char_length(panel_id) <= 300),
    status text not null default 'open' check (status in ('open', 'planned', 'built', 'declined')),
    created_at timestamptz not null default now()
);

create index if not exists view_requests_created_idx on public.view_requests (created_at desc);

alter table public.view_requests enable row level security;

drop policy if exists view_requests_insert_own on public.view_requests;
create policy view_requests_insert_own on public.view_requests
    for insert to authenticated
    with check (profile_id = auth.uid() and status = 'open');

drop policy if exists view_requests_select_platform on public.view_requests;
create policy view_requests_select_platform on public.view_requests
    for select to authenticated
    using (public.is_platform_admin());

drop policy if exists view_requests_update_platform on public.view_requests;
create policy view_requests_update_platform on public.view_requests
    for update to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

revoke all on public.view_requests from anon;
revoke all on public.view_requests from authenticated;
grant insert, select, update on public.view_requests to authenticated;
