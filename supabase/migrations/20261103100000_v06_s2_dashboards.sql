-- VicData 0.6, S2: dashboards as data (scope brief §0, §4.7-4.8, §7a G1/G9; night 1 prompt S2).
--
-- WRITTEN, NOT YET APPLIED (night 1): applying DDL to the live project was not available
-- to the build after S1. Apply it the documented way (memory: supabase-migration-apply):
--   supabase db query --linked -f supabase/migrations/20261103100000_v06_s2_dashboards.sql
--   supabase migration repair --status applied 20261103100000 --linked
-- then seed the four VicData Teacher dashboards with
--   npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/seed.sql && supabase db query --linked -f /tmp/seed.sql
-- Until then the flagged renderer uses the configs seeded in code (src/catalogue/dashboards),
-- which are the same JSON.
--
-- Additive only: new tables, functions and policies. No existing table or policy changes.
-- Depends on S1 (is_platform_admin, teams, is_in_team, school_memberships.roles).

-- 1. Groups (linked dashboards; the top-bar switcher) -------------------------------

create table public.dashboard_groups (
    id uuid primary key default gen_random_uuid(),
    slug text unique,
    label text not null,
    owner_scope text not null check (owner_scope in ('vicdata', 'school', 'user')),
    school_account_id uuid references public.school_accounts (id) on delete cascade,
    owner_profile_id uuid references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    check ((owner_scope = 'vicdata' and school_account_id is null and owner_profile_id is null)
        or (owner_scope = 'school' and school_account_id is not null and owner_profile_id is null)
        or (owner_scope = 'user' and owner_profile_id is not null))
);

-- 2. Dashboards ---------------------------------------------------------------------

create table public.dashboards (
    id uuid primary key default gen_random_uuid(),
    -- Stable, human id for VicData dashboards ("vicdata.ks4.candidates"), matching the
    -- config's own `id`, so per-user state and notes key on something that survives a
    -- re-seed.
    slug text unique,
    kind text not null default 'dashboard' check (kind in ('dashboard', 'presentation')),
    owner_scope text not null check (owner_scope in ('vicdata', 'school', 'user')),
    school_account_id uuid references public.school_accounts (id) on delete cascade,
    owner_profile_id uuid references public.profiles (id) on delete cascade,
    name text not null check (length(btrim(name)) between 1 and 120),
    group_id uuid references public.dashboard_groups (id) on delete set null,
    group_order int not null default 0,
    -- Meetings (kind presentation): archived the day after this date (scope brief §7.5).
    meeting_date date,
    published_version_id uuid,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((owner_scope = 'vicdata' and school_account_id is null and owner_profile_id is null)
        or (owner_scope = 'school' and school_account_id is not null and owner_profile_id is null)
        or (owner_scope = 'user' and owner_profile_id is not null)),
    check (kind = 'presentation' or meeting_date is null)
);
create index dashboards_owner_idx on public.dashboards (owner_profile_id) where owner_scope = 'user';
create index dashboards_school_idx on public.dashboards (school_account_id) where owner_scope = 'school';

-- 3. Versions: immutable, every publish is a new row ------------------------------

create table public.dashboard_versions (
    id uuid primary key default gen_random_uuid(),
    dashboard_id uuid not null references public.dashboards (id) on delete cascade,
    version int not null,
    schema_version int not null,
    config jsonb not null,
    label text check (label is null or length(label) <= 80),
    change_summary text,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    unique (dashboard_id, version)
);

alter table public.dashboards
    add constraint dashboards_published_version_fk
    foreign key (published_version_id) references public.dashboard_versions (id) on delete set null;

-- Immutable: no UPDATE ever; DELETE only by the retention prune (personal dashboards keep
-- the last 30) or by the dashboard itself being deleted (cascade).
create or replace function public.dashboard_versions_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'UPDATE' then
        raise exception 'dashboard versions are immutable; publish a new version';
    end if;
    if tg_op = 'DELETE' and coalesce(current_setting('vicdata.allow_version_prune', true), '') <> 'on'
       and exists (select 1 from public.dashboards d where d.id = old.dashboard_id) then
        raise exception 'dashboard versions are immutable';
    end if;
    return old;
end;
$$;
create trigger dashboard_versions_immutable
    before update or delete on public.dashboard_versions
    for each row execute function public.dashboard_versions_immutable();

-- 4. Drafts: the editor's autosaved working copy, separate from what's published ---

create table public.dashboard_drafts (
    dashboard_id uuid primary key references public.dashboards (id) on delete cascade,
    config jsonb not null,
    base_version_id uuid references public.dashboard_versions (id) on delete set null,
    updated_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now()
);

-- 5. Assignments: who sees a dashboard (role / team / user; live or copy; key) -----

create table public.dashboard_assignments (
    id uuid primary key default gen_random_uuid(),
    dashboard_id uuid not null references public.dashboards (id) on delete cascade,
    target_kind text not null check (target_kind in ('role', 'team', 'user')),
    role text check (role in ('teacher', 'smt', 'admissions', 'school_admin', 'hod', 'finance')),
    team_id uuid references public.teams (id) on delete cascade,
    profile_id uuid references public.profiles (id) on delete cascade,
    mode text not null default 'live' check (mode in ('live', 'copy')),
    -- "Key VicData dashboard": shown as a key tile on that role's home (scope brief §4.10).
    is_key boolean not null default false,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    check ((target_kind = 'role' and role is not null and team_id is null and profile_id is null)
        or (target_kind = 'team' and team_id is not null and role is null and profile_id is null)
        or (target_kind = 'user' and profile_id is not null and role is null and team_id is null))
);
create index dashboard_assignments_dashboard_idx on public.dashboard_assignments (dashboard_id);

-- 6. Per-user state, keyed by stable panel and view ids (G1) ------------------------
-- Sibling of teacher_view_preferences, not an extension of it: the hand-coded dashboards
-- keep reading and writing their own rows untouched; for the four Teacher dashboards the
-- flagged renderer writes through the legacy keys (audit §6.3), so this table holds only
-- what has no legacy home (state on new dashboards, the "what's changed" dismissal).

create table public.dashboard_user_state (
    profile_id uuid not null references public.profiles (id) on delete cascade,
    dashboard_id uuid not null references public.dashboards (id) on delete cascade,
    school_urn text not null default '',
    seen_version int,
    state jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (profile_id, dashboard_id, school_urn)
);

-- 7. Access helpers ------------------------------------------------------------------

-- Does the caller hold this role at any school they're an approved member of? School-
-- Admin is `is_admin`, not a member of `roles` (S1).
create or replace function public.has_role_anywhere(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.school_memberships m
        where m.profile_id = auth.uid() and m.status = 'approved'
          and ((p_role = 'school_admin' and m.is_admin) or p_role = any(m.roles)));
$$;

create or replace function public.can_edit_dashboard(p_dashboard uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.dashboards d
        where d.id = p_dashboard and (
            public.is_platform_admin()
            or (d.owner_scope = 'school' and public.is_admin_of_school_account(d.school_account_id))
            or (d.owner_scope = 'user' and d.owner_profile_id = auth.uid())));
$$;

create or replace function public.can_read_dashboard(p_dashboard uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.can_edit_dashboard(p_dashboard) or exists (
        select 1 from public.dashboards d
        join public.dashboard_assignments a on a.dashboard_id = d.id
        where d.id = p_dashboard and (
            (a.target_kind = 'user' and a.profile_id = auth.uid())
            -- VicData dashboards reach a role at every school (scope brief §4.7).
            or (a.target_kind = 'role' and public.has_role_anywhere(a.role)
                and (d.owner_scope = 'vicdata'
                     or (d.owner_scope = 'school' and public.is_member_of_school_account(d.school_account_id))))
            -- School dashboards reach teams at that school.
            or (a.target_kind = 'team' and d.owner_scope = 'school' and public.is_in_team(a.team_id))));
$$;

-- 8. RLS ------------------------------------------------------------------------------

alter table public.dashboard_groups enable row level security;
alter table public.dashboards enable row level security;
alter table public.dashboard_versions enable row level security;
alter table public.dashboard_drafts enable row level security;
alter table public.dashboard_assignments enable row level security;
alter table public.dashboard_user_state enable row level security;

create policy dashboard_groups_select on public.dashboard_groups
    for select using (
        owner_scope = 'vicdata'
        or (owner_scope = 'school' and public.is_member_of_school_account(school_account_id))
        or (owner_scope = 'user' and owner_profile_id = auth.uid())
        or public.is_platform_admin());
create policy dashboard_groups_write on public.dashboard_groups
    for all using (
        (owner_scope = 'vicdata' and public.is_platform_admin())
        or (owner_scope = 'school' and public.is_admin_of_school_account(school_account_id))
        or (owner_scope = 'user' and owner_profile_id = auth.uid()))
    with check (
        (owner_scope = 'vicdata' and public.is_platform_admin())
        or (owner_scope = 'school' and public.is_admin_of_school_account(school_account_id))
        or (owner_scope = 'user' and owner_profile_id = auth.uid()));

-- The editor conditions are inline as well as inside can_read_dashboard: a just-inserted
-- row isn't visible to the helper's own query, so INSERT ... RETURNING needs them here.
create policy dashboards_select on public.dashboards
    for select using (
        public.is_platform_admin()
        or (owner_scope = 'school' and public.is_admin_of_school_account(school_account_id))
        or (owner_scope = 'user' and owner_profile_id = auth.uid())
        or public.can_read_dashboard(id));
-- Creating: VicData by super-admin only; school by its School-Admin; personal by anyone
-- for themselves (the cap trigger below limits how many).
create policy dashboards_insert on public.dashboards
    for insert with check (
        (owner_scope = 'vicdata' and public.is_platform_admin())
        or (owner_scope = 'school' and public.is_admin_of_school_account(school_account_id))
        or (owner_scope = 'user' and owner_profile_id = auth.uid()));
create policy dashboards_update on public.dashboards
    for update using (public.can_edit_dashboard(id)) with check (public.can_edit_dashboard(id));
create policy dashboards_delete on public.dashboards
    for delete using (public.can_edit_dashboard(id));

-- Recipients see only the published version; editors see the whole history.
create policy dashboard_versions_select on public.dashboard_versions
    for select using (
        public.can_edit_dashboard(dashboard_id)
        or (public.can_read_dashboard(dashboard_id)
            and exists (select 1 from public.dashboards d where d.id = dashboard_id and d.published_version_id = dashboard_versions.id)));
create policy dashboard_versions_insert on public.dashboard_versions
    for insert with check (public.can_edit_dashboard(dashboard_id) and created_by = auth.uid());

create policy dashboard_drafts_all on public.dashboard_drafts
    for all using (public.can_edit_dashboard(dashboard_id)) with check (public.can_edit_dashboard(dashboard_id));

create policy dashboard_assignments_select on public.dashboard_assignments
    for select using (public.can_edit_dashboard(dashboard_id) or public.can_read_dashboard(dashboard_id));
-- Super-admin assigns VicData dashboards to roles; School-Admin shares school dashboards
-- with teams (and people); SMT does not share (catalogue C5).
create policy dashboard_assignments_write on public.dashboard_assignments
    for all using (public.can_edit_dashboard(dashboard_id))
    with check (
        public.can_edit_dashboard(dashboard_id)
        and exists (select 1 from public.dashboards d where d.id = dashboard_id and (
            (d.owner_scope = 'vicdata' and target_kind in ('role', 'user'))
            or (d.owner_scope = 'school' and target_kind in ('team', 'user', 'role')
                and (team_id is null or exists (select 1 from public.teams t where t.id = team_id and t.school_account_id = d.school_account_id)))
            or (d.owner_scope = 'user' and false))));

create policy dashboard_user_state_own on public.dashboard_user_state
    for all using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.can_read_dashboard(dashboard_id));

-- 9. Caps (G9) ------------------------------------------------------------------------
-- Personal dashboards: super-admin unlimited, School-Admin 20, everyone else 5. VicData
-- and school dashboards don't count. Meetings: the same caps, upcoming meetings only;
-- archived (meeting_date before today) are unlimited and don't count.

create or replace function public.personal_dashboard_cap(p_profile uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
    select case
        when exists (select 1 from public.platform_admins where profile_id = p_profile) then null
        when exists (select 1 from public.school_memberships m where m.profile_id = p_profile and m.status = 'approved' and m.is_admin) then 20
        else 5
    end;
$$;

create or replace function public.enforce_personal_dashboard_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cap int;
    v_count int;
begin
    if new.owner_scope <> 'user' then
        return new;
    end if;
    -- An archived meeting never counts and is never capped.
    if new.kind = 'presentation' and new.meeting_date is not null and new.meeting_date < current_date then
        return new;
    end if;
    if tg_op = 'UPDATE' and old.owner_scope = 'user' and old.owner_profile_id = new.owner_profile_id
       and old.kind = new.kind
       and not (new.kind = 'presentation' and old.meeting_date < current_date and (new.meeting_date is null or new.meeting_date >= current_date)) then
        return new;
    end if;
    v_cap := public.personal_dashboard_cap(new.owner_profile_id);
    if v_cap is null then
        return new;
    end if;
    select count(*) into v_count from public.dashboards d
    where d.owner_scope = 'user' and d.owner_profile_id = new.owner_profile_id and d.kind = new.kind and d.id <> new.id
      and (d.kind = 'dashboard' or d.meeting_date is null or d.meeting_date >= current_date);
    if v_count >= v_cap then
        raise exception 'personal % limit reached (%)', case when new.kind = 'presentation' then 'meeting' else 'dashboard' end, v_cap
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;
create trigger dashboards_personal_cap
    before insert or update on public.dashboards
    for each row execute function public.enforce_personal_dashboard_cap();

-- 10. Publishing ---------------------------------------------------------------------
-- One call: snapshot the config as the next version, point the dashboard at it, clear
-- the draft, and (personal dashboards) keep the last 30 versions (scope brief §4.8).

create or replace function public.publish_dashboard(p_dashboard uuid, p_config jsonb, p_label text default null, p_summary text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_next int;
    v_id uuid;
    v_scope text;
begin
    if not public.can_edit_dashboard(p_dashboard) then
        raise exception 'not allowed to publish this dashboard';
    end if;
    if (p_config ->> 'schema_version') is null then
        raise exception 'config has no schema_version';
    end if;
    select coalesce(max(version), 0) + 1 into v_next from public.dashboard_versions where dashboard_id = p_dashboard;
    insert into public.dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary, created_by)
    values (p_dashboard, v_next, (p_config ->> 'schema_version')::int, p_config, p_label, p_summary, auth.uid())
    returning id into v_id;
    update public.dashboards set published_version_id = v_id, updated_at = now() where id = p_dashboard
    returning owner_scope into v_scope;
    delete from public.dashboard_drafts where dashboard_id = p_dashboard;
    if v_scope = 'user' then
        perform set_config('vicdata.allow_version_prune', 'on', true);
        delete from public.dashboard_versions
        where dashboard_id = p_dashboard and version <= v_next - 30;
        perform set_config('vicdata.allow_version_prune', 'off', true);
    end if;
    return v_id;
end;
$$;
