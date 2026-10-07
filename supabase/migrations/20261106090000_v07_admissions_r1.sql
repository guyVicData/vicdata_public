-- VicData 0.7 admissions round 1, A3: the Admissions lead, delegated granting, and the
-- school's shared admissions lists (docs/v0.7/vicdata_0_7_admissions_round1_data_layer_
-- claude_code_prompt_v1.md A3; data plan "Who builds and who sees").
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v07_admissions_rls_pglite.mjs), NOT APPLIED.
-- Apply commands: docs/v0.7/admissions_r1_report_v1.md. Re-runnable.
--
-- Additive. No existing policy is changed or dropped; one policy is ADDED to
-- platform_audit_log (School-Admins read their own school's admissions_* rows only).
--
--   1. school_memberships.admissions_lead: a FLAG on the admissions role, not a new role
--      value -- a lead is still `admissions` everywhere roles are read (auto team, shares,
--      has_role_anywhere). Only the School-Admin (is_admin) or the account holder can set
--      it; it clears itself when `admissions` is removed.
--   2. admissions_grants: who granted each `admissions` role -- 'school_admin' (any grant
--      not made through the lead's function, including every grant before this
--      migration: no row = the School-Admin's) or 'lead'. A lead can remove only 'lead'
--      grants.
--   3. admissions_set_member(): the lead grants or removes `admissions` -- and nothing
--      else -- for approved members of the lead's own school, never on a lead, never on
--      themselves. Every grant and removal, by the lead or the School-Admin, and every
--      lead made or ended, is written to platform_audit_log.
--   4. admissions_entry_points, admissions_lists: school-level, shared. Read: approved
--      members with `admissions` or `smt`, the School-Admin, platform admins, and roles /
--      teams / people the school shares them with (admissions_list_shares, the same
--      role / team / user targets as dashboard_assignments). Write: the Admissions lead
--      of that school only.
--
-- Claims are read as nullif(current_setting('request.jwt.claims', true), '') so a session
-- without JWT claims (supabase db query) doesn't fail on the cast; such a session is not
-- the service role. To make the first lead from the CLI, see the report's runbook.

-- 1. The lead flag ----------------------------------------------------------------

alter table public.school_memberships
    add column if not exists admissions_lead boolean not null default false;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'school_memberships_admissions_lead_has_role') then
        alter table public.school_memberships
            add constraint school_memberships_admissions_lead_has_role
                check (not admissions_lead or 'admissions' = any(roles));
    end if;
end $$;

-- Is the caller the School-Admin (is_admin) or the account holder of this school?
create or replace function public.is_school_admin_or_holder(p_school_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admin_of_school_account(p_school_account_id)
        or public.is_account_holder_of_school_account(p_school_account_id);
$$;

create or replace function public.is_admissions_lead_of(p_school_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.school_memberships
        where school_account_id = p_school_account_id and profile_id = auth.uid() and status = 'approved'
          and admissions_lead and 'admissions' = any(roles));
$$;

create or replace function public.jwt_is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

-- Runs after school_memberships_sync_roles (triggers fire in name order), so it sees the
-- normalised role set. The service role (scripts, the preview route) is trusted, as the
-- roles trigger trusts it.
create or replace function public.guard_admissions_lead()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    -- No admissions role, no lead flag (the School-Admin removing `admissions` ends the lead).
    if not ('admissions' = any(new.roles)) then
        new.admissions_lead := false;
    end if;
    if public.jwt_is_service_role() then
        return new;
    end if;
    if tg_op = 'INSERT' then
        new.admissions_lead := false;
    elsif new.admissions_lead is distinct from old.admissions_lead
          -- The one change that isn't a decision: the flag clearing with the role itself
          -- (and only the School-Admin can remove a lead's role, by RLS and the lead's function).
          and not (old.admissions_lead and not ('admissions' = any(new.roles)))
          and not public.is_school_admin_or_holder(new.school_account_id) then
        raise exception 'only the School-Admin can make or unmake an Admissions lead';
    end if;
    return new;
end;
$$;

drop trigger if exists school_memberships_zz_admissions_lead_guard on public.school_memberships;
create trigger school_memberships_zz_admissions_lead_guard
    before insert or update on public.school_memberships
    for each row execute function public.guard_admissions_lead();

-- 2. Who granted each admissions role ---------------------------------------------

create table if not exists public.admissions_grants (
    membership_id uuid primary key references public.school_memberships (id) on delete cascade,
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    granted_by_kind text not null check (granted_by_kind in ('school_admin', 'lead')),
    granted_by_profile_id uuid references public.profiles (id) on delete set null,
    granted_at timestamptz not null default now()
);
alter table public.admissions_grants enable row level security;
-- Readable by the school's members (People can show "added by the Admissions lead");
-- written only by the trigger (security definer), never the API: no write policy.
drop policy if exists admissions_grants_select_member on public.admissions_grants;
create policy admissions_grants_select_member on public.admissions_grants
    for select using (public.is_member_of_school_account(school_account_id));

-- One audit row, scoped to the school (People reads these: see the policy in 3).
create or replace function public.log_admissions_action(p_action text, p_school_account_id uuid, p_detail jsonb)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.platform_audit_log (actor_profile_id, action, school_urn, detail)
    select auth.uid(), p_action, sa.school_urn, coalesce(p_detail, '{}'::jsonb)
    from public.school_accounts sa
    where sa.id = p_school_account_id and auth.uid() is not null;
$$;
revoke execute on function public.log_admissions_action(text, uuid, jsonb) from public, anon, authenticated;

-- Records provenance whenever `admissions` is gained or lost -- on ANY update, since a
-- legacy write to `role` changes `roles` through school_memberships_sync_roles. A grant is
-- the lead's only when the lead's function marked the transaction AND the caller really
-- is this school's lead; anything else is the School-Admin's (or the service role's),
-- and a School-Admin's grant or removal is audited here (the lead's function audits its own).
create or replace function public.track_admissions_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_had boolean := tg_op = 'UPDATE' and 'admissions' = any(old.roles);
    v_has boolean := 'admissions' = any(new.roles);
    v_by_lead boolean := coalesce(current_setting('vicdata.admissions_grant_by_lead', true), '') = 'on'
                         and public.is_admissions_lead_of(new.school_account_id);
begin
    if v_has and not v_had then
        insert into public.admissions_grants (membership_id, school_account_id, granted_by_kind, granted_by_profile_id)
        values (new.id, new.school_account_id, case when v_by_lead then 'lead' else 'school_admin' end, auth.uid())
        on conflict (membership_id) do update
            set granted_by_kind = excluded.granted_by_kind,
                granted_by_profile_id = excluded.granted_by_profile_id,
                granted_at = now();
        if not v_by_lead then
            perform public.log_admissions_action('admissions_admin_grant', new.school_account_id,
                jsonb_build_object('membership_id', new.id, 'profile_id', new.profile_id));
        end if;
    elsif v_had and not v_has then
        delete from public.admissions_grants where membership_id = new.id;
        if not v_by_lead then
            perform public.log_admissions_action('admissions_admin_remove', new.school_account_id,
                jsonb_build_object('membership_id', new.id, 'profile_id', new.profile_id));
        end if;
    end if;
    return null;
end;
$$;

drop trigger if exists school_memberships_track_admissions_grant on public.school_memberships;
create trigger school_memberships_track_admissions_grant
    after insert or update on public.school_memberships
    for each row execute function public.track_admissions_grant();

-- 3. The lead grants or removes `admissions` ----------------------------------------

-- School-Admins read their own school's admissions_* audit rows (People's history and
-- override). Platform admins keep reading everything (the existing policy).
drop policy if exists platform_audit_log_select_school_admissions on public.platform_audit_log;
create policy platform_audit_log_select_school_admissions on public.platform_audit_log
    for select using (
        action like 'admissions\_%'
        and school_urn is not null
        and exists (
            select 1 from public.school_accounts sa
            where sa.school_urn = platform_audit_log.school_urn
              and public.is_school_admin_or_holder(sa.id)));

create or replace function public.admissions_set_member(p_membership_id uuid, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller public.school_memberships%rowtype;
    v_target public.school_memberships%rowtype;
    v_kind text;
    -- One message for "no such membership" and "not your school": no oracle.
    v_denied constant text := 'only the Admissions lead of this school can add or remove Admissions staff';
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;
    if p_grant is null then
        raise exception 'p_grant must be true (grant) or false (remove)';
    end if;
    select * into v_target from public.school_memberships where id = p_membership_id for update;
    if not found then
        raise exception '%', v_denied;
    end if;
    -- The caller must be an approved Admissions lead AT THE TARGET'S SCHOOL.
    select * into v_caller from public.school_memberships
    where profile_id = auth.uid() and school_account_id = v_target.school_account_id and status = 'approved'
      and admissions_lead and 'admissions' = any(roles);
    if not found then
        raise exception '%', v_denied;
    end if;
    if v_target.status <> 'approved' then
        raise exception 'only approved members of the school can be given Admissions';
    end if;
    if v_target.id = v_caller.id or v_target.admissions_lead then
        raise exception 'an Admissions lead''s own role is the School-Admin''s to change';
    end if;

    if p_grant then
        if 'admissions' = any(v_target.roles) then
            return; -- already Admissions: nothing to do, nothing to log
        end if;
    else
        if not ('admissions' = any(v_target.roles)) then
            return;
        end if;
        select granted_by_kind into v_kind from public.admissions_grants where membership_id = v_target.id;
        if coalesce(v_kind, 'school_admin') <> 'lead' then
            raise exception 'this Admissions role was granted by the School-Admin; only they can remove it';
        end if;
    end if;

    perform set_config('vicdata.admissions_grant_by_lead', 'on', true);
    if p_grant then
        update public.school_memberships set roles = v_target.roles || array['admissions']::text[] where id = v_target.id;
    else
        update public.school_memberships
        set roles = coalesce(nullif(array_remove(v_target.roles, 'admissions'), '{}'::text[]), array['teacher']::text[])
        where id = v_target.id;
    end if;
    perform set_config('vicdata.admissions_grant_by_lead', '', true);

    perform public.log_admissions_action(case when p_grant then 'admissions_lead_grant' else 'admissions_lead_remove' end,
        v_target.school_account_id,
        jsonb_build_object('membership_id', v_target.id, 'profile_id', v_target.profile_id, 'by_membership_id', v_caller.id));
end;
$$;
revoke execute on function public.admissions_set_member(uuid, boolean) from public, anon;
grant execute on function public.admissions_set_member(uuid, boolean) to authenticated;

-- A lead made or ended -- by the School-Admin, or by removing a lead's admissions role
-- (the guard clears the flag), so on any update.
create or replace function public.log_admissions_lead_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.admissions_lead is distinct from old.admissions_lead then
        perform public.log_admissions_action(case when new.admissions_lead then 'admissions_lead_made' else 'admissions_lead_unmade' end,
            new.school_account_id, jsonb_build_object('membership_id', new.id, 'profile_id', new.profile_id));
    end if;
    return null;
end;
$$;
drop trigger if exists school_memberships_log_admissions_lead on public.school_memberships;
create trigger school_memberships_log_admissions_lead
    after update on public.school_memberships
    for each row execute function public.log_admissions_lead_change();

-- 4. Entry points and shared lists --------------------------------------------------

create table if not exists public.admissions_entry_points (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    -- '4+', '11+', '16+', or a custom age 'age:2' .. 'age:17'
    entry_point text not null check (entry_point ~ '^(4\+|11\+|16\+|age:([2-9]|1[0-7]))$'),
    sort_order int not null default 0,
    updated_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now(),
    unique (school_account_id, entry_point)
);

create table if not exists public.admissions_lists (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    entry_point text not null check (entry_point ~ '^(4\+|11\+|16\+|age:([2-9]|1[0-7]))$'),
    kind text not null check (kind in ('day_feeders', 'boarding_feeders', 'rivals', 'rung')),
    -- For kind 'rung': which rung of the 16+ ladder ('age:14', ...); '' otherwise.
    rung text not null default '' check ((kind = 'rung') = (rung <> '')),
    members text[] not null default '{}'::text[] check (cardinality(members) <= 500),
    -- A fuzzy definition instead of (or as well as) a list: sector, gender, boarding, las,
    -- age range, big_leaving_16 -- the ranking population's filters.
    fuzzy jsonb check (fuzzy is null or jsonb_typeof(fuzzy) = 'object'),
    -- The lead's LA birth-blend override: { "<LA name>": weight, ... }; null = automatic.
    la_blend jsonb check (la_blend is null or jsonb_typeof(la_blend) = 'object'),
    confirmed boolean not null default false, -- "nearby schools" until the lead confirms
    updated_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now(),
    unique (school_account_id, entry_point, kind, rung)
);
create index if not exists admissions_lists_school_idx on public.admissions_lists (school_account_id, entry_point);

-- Who else reads them: the same targets as dashboard_assignments (role / team / user),
-- at this school. Created by the School-Admin, SMT or the Admissions lead; SMT changes or
-- removes only its own.
create table if not exists public.admissions_list_shares (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    target_kind text not null check (target_kind in ('role', 'team', 'user')),
    role text check (role in ('teacher', 'smt', 'admissions', 'school_admin', 'hod', 'finance')),
    team_id uuid references public.teams (id) on delete cascade,
    profile_id uuid references public.profiles (id) on delete cascade,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    check ((target_kind = 'role' and role is not null and team_id is null and profile_id is null)
        or (target_kind = 'team' and team_id is not null and role is null and profile_id is null)
        or (target_kind = 'user' and profile_id is not null and role is null and team_id is null))
);
create index if not exists admissions_list_shares_school_idx on public.admissions_list_shares (school_account_id);

create or replace function public.can_read_admissions_lists(p_school_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_platform_admin() or exists (
        select 1 from public.school_memberships m
        where m.school_account_id = p_school_account_id and m.profile_id = auth.uid() and m.status = 'approved'
          and (m.is_admin
               or 'admissions' = any(m.roles)
               or 'smt' = any(m.roles)
               or public.is_account_holder_of_school_account(p_school_account_id)
               or exists (
                   select 1 from public.admissions_list_shares s
                   where s.school_account_id = p_school_account_id and (
                       (s.target_kind = 'user' and s.profile_id = auth.uid())
                       or (s.target_kind = 'role' and ((s.role = 'school_admin' and m.is_admin) or s.role = any(m.roles)))
                       or (s.target_kind = 'team' and public.is_in_team(s.team_id))))));
$$;

create or replace function public.is_smt_of(p_school_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.school_memberships m
        where m.school_account_id = p_school_account_id and m.profile_id = auth.uid()
          and m.status = 'approved' and 'smt' = any(m.roles));
$$;

alter table public.admissions_entry_points enable row level security;
alter table public.admissions_lists enable row level security;
alter table public.admissions_list_shares enable row level security;

drop policy if exists admissions_entry_points_select on public.admissions_entry_points;
create policy admissions_entry_points_select on public.admissions_entry_points
    for select using (public.can_read_admissions_lists(school_account_id));
-- The write conditions are inline in each policy (INSERT ... RETURNING then passes). The
-- WITH CHECK also stops a row being moved to another school.
drop policy if exists admissions_entry_points_write on public.admissions_entry_points;
create policy admissions_entry_points_write on public.admissions_entry_points
    for all using (public.is_admissions_lead_of(school_account_id))
    with check (public.is_admissions_lead_of(school_account_id));

drop policy if exists admissions_lists_select on public.admissions_lists;
create policy admissions_lists_select on public.admissions_lists
    for select using (public.can_read_admissions_lists(school_account_id));
drop policy if exists admissions_lists_write on public.admissions_lists;
create policy admissions_lists_write on public.admissions_lists
    for all using (public.is_admissions_lead_of(school_account_id))
    with check (public.is_admissions_lead_of(school_account_id));

drop policy if exists admissions_list_shares_select on public.admissions_list_shares;
create policy admissions_list_shares_select on public.admissions_list_shares
    for select using (public.can_read_admissions_lists(school_account_id));
drop policy if exists admissions_list_shares_write on public.admissions_list_shares;
drop policy if exists admissions_list_shares_insert on public.admissions_list_shares;
create policy admissions_list_shares_insert on public.admissions_list_shares
    for insert with check (
        (public.is_school_admin_or_holder(school_account_id)
         or public.is_admissions_lead_of(school_account_id)
         or public.is_smt_of(school_account_id))
        and (team_id is null or exists (select 1 from public.teams t where t.id = team_id and t.school_account_id = admissions_list_shares.school_account_id))
        and (profile_id is null or exists (select 1 from public.school_memberships m
                                           where m.profile_id = admissions_list_shares.profile_id
                                             and m.school_account_id = admissions_list_shares.school_account_id)));
-- The School-Admin and the lead change or remove any share; SMT only its own.
drop policy if exists admissions_list_shares_update on public.admissions_list_shares;
create policy admissions_list_shares_update on public.admissions_list_shares
    for update using (
        public.is_school_admin_or_holder(school_account_id)
        or public.is_admissions_lead_of(school_account_id)
        or (public.is_smt_of(school_account_id) and created_by = auth.uid()))
    with check (
        (public.is_school_admin_or_holder(school_account_id)
         or public.is_admissions_lead_of(school_account_id)
         or (public.is_smt_of(school_account_id) and created_by = auth.uid()))
        and (team_id is null or exists (select 1 from public.teams t where t.id = team_id and t.school_account_id = admissions_list_shares.school_account_id))
        and (profile_id is null or exists (select 1 from public.school_memberships m
                                           where m.profile_id = admissions_list_shares.profile_id
                                             and m.school_account_id = admissions_list_shares.school_account_id)));
drop policy if exists admissions_list_shares_delete on public.admissions_list_shares;
create policy admissions_list_shares_delete on public.admissions_list_shares
    for delete using (
        public.is_school_admin_or_holder(school_account_id)
        or public.is_admissions_lead_of(school_account_id)
        or (public.is_smt_of(school_account_id) and created_by = auth.uid()));

-- Who last changed it, and when: set by the database, never trusted from the client.
create or replace function public.stamp_admissions_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
end;
$$;
drop trigger if exists admissions_entry_points_stamp on public.admissions_entry_points;
create trigger admissions_entry_points_stamp before insert or update on public.admissions_entry_points
    for each row execute function public.stamp_admissions_change();
drop trigger if exists admissions_lists_stamp on public.admissions_lists;
create trigger admissions_lists_stamp before insert or update on public.admissions_lists
    for each row execute function public.stamp_admissions_change();

-- Who shared, and when: set on insert, never changed after.
create or replace function public.stamp_admissions_share()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        new.created_by := auth.uid();
        new.created_at := now();
    else
        new.created_by := old.created_by;
        new.created_at := old.created_at;
    end if;
    return new;
end;
$$;
drop trigger if exists admissions_list_shares_stamp on public.admissions_list_shares;
create trigger admissions_list_shares_stamp before insert or update on public.admissions_list_shares
    for each row execute function public.stamp_admissions_share();

grant select, insert, update, delete on public.admissions_entry_points, public.admissions_lists, public.admissions_list_shares to authenticated;
grant select on public.admissions_grants to authenticated;
revoke insert, update, delete on public.admissions_grants from authenticated, anon;
