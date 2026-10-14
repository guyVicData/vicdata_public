-- VicData 0.8 groups round 1 (G1, G2): head-office accounts, their members, and which member
-- schools' SMT get the group view (docs/v0.8/vicdata_0_8_groups_round1_accounts_access_claude_code_prompt_v1.md;
-- spec docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md §3.2).
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v08_groups_r1_pglite.mjs), NOT APPLIED. Additive only:
-- five new tables and their functions; no existing table, policy or function changes. The app works
-- before it is applied (every group read treats a missing table as "no group accounts").
--
-- The groups themselves live in production (hrqrbvrrhlidpoybezhs), read only through its
-- school_groups_lookup / group_schools_lookup. This database cannot see them, so the one rule that
-- needs them -- a grant counts only while the school is a CURRENT member of the group -- is checked
-- by the app's server at grant time AND at every read (src/lib/groups/). That is why grants are
-- written only by the service role: no signed-in user can write a grant row at all, so none can be
-- written for a school the server hasn't checked.
--
-- Who can do what (RLS + functions):
--   head office (head_office, head_office_admin): read their own account, its members and grants;
--     nothing of any other account.
--   head-office admin: invite and remove head-office members, change their role; grant and revoke
--     the group view (through the app's server, which checks membership in production).
--   a school's SMT / School-Admin: nothing here directly. The app's server tells them whether their
--     school holds a grant (service role, after checking their membership). Their School-Admin sets
--     whether head office may see the school's Admissions panels (school_set_group_admissions_share).
--   platform admins: read everything; create accounts, invite the first admin, suspend (audited).

-- 1. Group accounts: one per paying group ------------------------------------------------------

create table public.group_accounts (
    id uuid primary key default gen_random_uuid(),
    -- The production groups.group_id: '3320' (GIAS), 'club_iss:dukes-education', 'ch:01234567'.
    group_id text not null unique check (group_id ~ '^[A-Za-z0-9_:.-]{1,80}$'),
    display_name text not null check (length(btrim(display_name)) between 1 and 160),
    status text not null default 'active' check (status in ('active', 'suspended')),
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    status_changed_at timestamptz,
    status_changed_by uuid references public.profiles (id) on delete set null
);

-- 2. Head-office members -----------------------------------------------------------------------
-- A membership exists only once approved: it is made when an invited person accepts, and the
-- invitation (from a platform admin or the account's head-office admin) is the approval.

create table public.group_memberships (
    id uuid primary key default gen_random_uuid(),
    group_account_id uuid not null references public.group_accounts (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    role text not null check (role in ('head_office_admin', 'head_office')),
    approved_by uuid references public.profiles (id) on delete set null,
    approved_at timestamptz not null default now(),
    unique (group_account_id, profile_id)
);
create index group_memberships_profile_idx on public.group_memberships (profile_id);

create table public.group_invitations (
    id uuid primary key default gen_random_uuid(),
    group_account_id uuid not null references public.group_accounts (id) on delete cascade,
    email text not null check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email) <= 254),
    role text not null check (role in ('head_office_admin', 'head_office')),
    invited_by uuid references public.profiles (id) on delete set null,
    invited_at timestamptz not null default now(),
    accepted_at timestamptz,
    accepted_profile_id uuid references public.profiles (id) on delete set null,
    cancelled_at timestamptz,
    cancelled_by uuid references public.profiles (id) on delete set null,
    check (accepted_at is null or cancelled_at is null)
);
create unique index group_invitations_one_open on public.group_invitations (group_account_id, email)
    where accepted_at is null and cancelled_at is null;

-- 3. The group view, school by school ----------------------------------------------------------
-- History is kept: a revoke sets revoked_at; a row is never deleted or rewritten.

create table public.group_view_grants (
    id uuid primary key default gen_random_uuid(),
    group_account_id uuid not null references public.group_accounts (id),
    school_urn text not null check (school_urn ~ '^[0-9]{5,7}$'),
    -- The membership's confidence when granted (production: 'likely' = Companies House, unconfirmed).
    likely_member boolean not null default false,
    granted_by uuid references public.profiles (id) on delete set null,
    granted_at timestamptz not null default now(),
    revoked_at timestamptz,
    revoked_by uuid references public.profiles (id) on delete set null,
    check (revoked_by is null or revoked_at is not null)
);
create unique index group_view_grants_one_open on public.group_view_grants (group_account_id, school_urn)
    where revoked_at is null;
create index group_view_grants_school_idx on public.group_view_grants (school_urn);

create or replace function public.group_view_grants_keep_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        raise exception 'group view grants are history: revoke, never delete';
    end if;
    -- The one change allowed: an open grant is revoked.
    if old.revoked_at is not null
       or new.revoked_at is null
       or (new.id, new.group_account_id, new.school_urn, new.likely_member, new.granted_by, new.granted_at)
          is distinct from (old.id, old.group_account_id, old.school_urn, old.likely_member, old.granted_by, old.granted_at) then
        raise exception 'a group view grant can only be revoked';
    end if;
    return new;
end;
$$;
create trigger group_view_grants_keep_history
    before update or delete on public.group_view_grants
    for each row execute function public.group_view_grants_keep_history();

-- 4. Does head office see the school's Admissions panels? Default off; the School-Admin decides.

create table public.group_admissions_shares (
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    group_account_id uuid not null references public.group_accounts (id) on delete cascade,
    shared boolean not null default false,
    set_by uuid references public.profiles (id) on delete set null,
    set_at timestamptz not null default now(),
    primary key (school_account_id, group_account_id)
);

-- 5. Who is the caller? ------------------------------------------------------------------------

create or replace function public.is_group_member(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.group_memberships where group_account_id = p_account and profile_id = auth.uid());
$$;

create or replace function public.is_group_admin(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.group_memberships
                   where group_account_id = p_account and profile_id = auth.uid() and role = 'head_office_admin');
$$;

-- 6. RLS: reads only; every write is a function below ------------------------------------------

alter table public.group_accounts enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_invitations enable row level security;
alter table public.group_view_grants enable row level security;
alter table public.group_admissions_shares enable row level security;

create policy group_accounts_select on public.group_accounts
    for select using (public.is_group_member(id) or public.is_platform_admin());
create policy group_memberships_select on public.group_memberships
    for select using (profile_id = auth.uid() or public.is_group_member(group_account_id) or public.is_platform_admin());
-- Invitations carry email addresses: the account's admins and platform admins only.
create policy group_invitations_select on public.group_invitations
    for select using (public.is_group_admin(group_account_id) or public.is_platform_admin());
create policy group_view_grants_select on public.group_view_grants
    for select using (public.is_group_member(group_account_id) or public.is_platform_admin());
-- A school's own members see their school's setting; head office sees what is shared with it.
create policy group_admissions_shares_select on public.group_admissions_shares
    for select using (public.is_member_of_school_account(school_account_id) or public.is_group_member(group_account_id) or public.is_platform_admin());

-- No write policies; and no write privilege either, so a missing policy can't be the only guard.
revoke all on public.group_accounts, public.group_memberships, public.group_invitations, public.group_view_grants, public.group_admissions_shares from anon, authenticated;
grant select on public.group_accounts, public.group_memberships, public.group_invitations, public.group_view_grants, public.group_admissions_shares to authenticated;

-- 7. Platform admins: accounts, the first admin, suspend (audited) ------------------------------

create or replace function public.platform_create_group_account(p_group_id text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if not public.is_platform_admin() then
        raise exception 'platform admin only';
    end if;
    if exists (select 1 from public.group_accounts where group_id = p_group_id) then
        raise exception 'this group already has an account';
    end if;
    insert into public.group_accounts (group_id, display_name, created_by)
    values (p_group_id, btrim(p_display_name), auth.uid())
    returning id into v_id;
    perform public.log_platform_action('group_account_created', null, jsonb_build_object('group_account_id', v_id, 'group_id', p_group_id));
    return v_id;
end;
$$;

create or replace function public.platform_set_group_account_status(p_account uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_platform_admin() then
        raise exception 'platform admin only';
    end if;
    if p_status not in ('active', 'suspended') then
        raise exception 'status must be active or suspended';
    end if;
    update public.group_accounts
    set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
    where id = p_account and status <> p_status;
    if found then
        perform public.log_platform_action('group_account_' || p_status, null, jsonb_build_object('group_account_id', p_account));
    end if;
end;
$$;

-- One function for platform admins and head-office admins: who may invite is checked inside.
create or replace function public.group_invite_member(p_account uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_platform boolean := public.is_platform_admin();
    v_id uuid;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;
    if not (v_platform or public.is_group_admin(p_account)) then
        raise exception 'only the group''s head-office admin can invite head-office members';
    end if;
    if p_role not in ('head_office_admin', 'head_office') then
        raise exception 'role must be head_office_admin or head_office';
    end if;
    if not exists (select 1 from public.group_accounts where id = p_account and status = 'active') then
        raise exception 'this group account is suspended';
    end if;
    if exists (select 1 from public.group_memberships gm join auth.users u on u.id = gm.profile_id
               where gm.group_account_id = p_account and lower(u.email) = v_email) then
        raise exception 'already a head-office member';
    end if;
    insert into public.group_invitations (group_account_id, email, role, invited_by)
    values (p_account, v_email, p_role, auth.uid())
    on conflict (group_account_id, email) where accepted_at is null and cancelled_at is null
    do update set role = excluded.role, invited_by = excluded.invited_by, invited_at = now()
    returning id into v_id;
    if v_platform then
        perform public.log_platform_action('group_member_invited', null, jsonb_build_object('group_account_id', p_account, 'role', p_role));
    end if;
    return v_id;
end;
$$;

create or replace function public.group_cancel_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account uuid;
begin
    select group_account_id into v_account from public.group_invitations
    where id = p_invitation and accepted_at is null and cancelled_at is null;
    if v_account is null or not (public.is_platform_admin() or public.is_group_admin(v_account)) then
        raise exception 'no such open invitation';
    end if;
    update public.group_invitations set cancelled_at = now(), cancelled_by = auth.uid() where id = p_invitation;
end;
$$;

-- The signed-in person takes up every open invitation to their own, confirmed email address (from
-- auth.users, never from anything the caller sends). Returns how many it took up.
create or replace function public.group_accept_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text;
    v_n integer := 0;
    r record;
begin
    select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
    if v_email is null then
        return 0;
    end if;
    for r in
        select i.* from public.group_invitations i join public.group_accounts a on a.id = i.group_account_id
        where i.email = v_email and i.accepted_at is null and i.cancelled_at is null and a.status = 'active'
        for update of i
    loop
        insert into public.group_memberships (group_account_id, profile_id, role, approved_by)
        values (r.group_account_id, auth.uid(), r.role, r.invited_by)
        on conflict (group_account_id, profile_id) do nothing;
        update public.group_invitations set accepted_at = now(), accepted_profile_id = auth.uid() where id = r.id;
        v_n := v_n + 1;
    end loop;
    return v_n;
end;
$$;

-- Head-office admins manage their own account's members. An admin's own membership is another
-- admin's (or a platform admin's) to change, so an account never loses its last admin by accident.
create or replace function public.group_set_member_role(p_membership uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v public.group_memberships%rowtype;
begin
    select * into v from public.group_memberships where id = p_membership;
    if not found or not (public.is_platform_admin() or public.is_group_admin(v.group_account_id)) then
        raise exception 'only the group''s head-office admin can change head-office members';
    end if;
    if p_role not in ('head_office_admin', 'head_office') then
        raise exception 'role must be head_office_admin or head_office';
    end if;
    if v.profile_id = auth.uid() then
        raise exception 'your own role is another admin''s to change';
    end if;
    update public.group_memberships set role = p_role where id = p_membership;
end;
$$;

create or replace function public.group_remove_member(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v public.group_memberships%rowtype;
begin
    select * into v from public.group_memberships where id = p_membership;
    if not found or not (public.is_platform_admin() or public.is_group_admin(v.group_account_id)) then
        raise exception 'only the group''s head-office admin can remove head-office members';
    end if;
    if v.profile_id = auth.uid() then
        raise exception 'your own membership is another admin''s to remove';
    end if;
    delete from public.group_memberships where id = p_membership;
end;
$$;

-- 8. Grants: the service role only, called by the app's server after it has checked, in
-- production, that the school is a current member of the group. p_actor is the signed-in
-- head-office admin the server verified from their own token.
create or replace function public.group_set_view_grant(p_actor uuid, p_account uuid, p_urn text, p_on boolean, p_likely boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_open uuid;
begin
    if not exists (select 1 from public.group_memberships
                   where group_account_id = p_account and profile_id = p_actor and role = 'head_office_admin') then
        raise exception 'only the group''s head-office admin can change access';
    end if;
    if not exists (select 1 from public.group_accounts where id = p_account and status = 'active') then
        raise exception 'this group account is suspended';
    end if;
    select id into v_open from public.group_view_grants
    where group_account_id = p_account and school_urn = p_urn and revoked_at is null
    for update;
    if p_on then
        if v_open is not null then
            return 'unchanged';
        end if;
        insert into public.group_view_grants (group_account_id, school_urn, likely_member, granted_by)
        values (p_account, p_urn, coalesce(p_likely, false), p_actor);
        return 'granted';
    end if;
    if v_open is null then
        return 'unchanged';
    end if;
    update public.group_view_grants set revoked_at = now(), revoked_by = p_actor where id = v_open;
    return 'revoked';
end;
$$;

-- 9. The school's side: its School-Admin decides whether head office sees its Admissions panels.
create or replace function public.school_set_group_admissions_share(p_urn text, p_account uuid, p_shared boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_school uuid;
begin
    select id into v_school from public.school_accounts where school_urn = p_urn;
    if v_school is null
       or not (public.is_admin_of_school_account(v_school) or public.is_account_holder_of_school_account(v_school)) then
        raise exception 'only the school''s School-Admin can change what head office sees';
    end if;
    if not exists (select 1 from public.group_accounts where id = p_account) then
        raise exception 'no such group account';
    end if;
    insert into public.group_admissions_shares (school_account_id, group_account_id, shared, set_by)
    values (v_school, p_account, coalesce(p_shared, false), auth.uid())
    on conflict (school_account_id, group_account_id)
    do update set shared = excluded.shared, set_by = excluded.set_by, set_at = now();
end;
$$;

-- 10. The Platform page's list ---------------------------------------------------------------

create or replace function public.platform_group_accounts_overview()
returns table (
    id uuid,
    group_id text,
    display_name text,
    status text,
    created_at timestamptz,
    admins integer,
    members integer,
    open_invitations integer,
    open_grants integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.is_platform_admin() then
        raise exception 'platform admin only';
    end if;
    return query
    select a.id, a.group_id, a.display_name, a.status, a.created_at,
           (select count(*)::int from public.group_memberships m where m.group_account_id = a.id and m.role = 'head_office_admin'),
           (select count(*)::int from public.group_memberships m where m.group_account_id = a.id),
           (select count(*)::int from public.group_invitations i where i.group_account_id = a.id and i.accepted_at is null and i.cancelled_at is null),
           (select count(*)::int from public.group_view_grants g where g.group_account_id = a.id and g.revoked_at is null)
    from public.group_accounts a
    order by a.display_name;
end;
$$;

-- 11. Execute rights: nothing for anon; the grant writer for the service role only ---------------

revoke all on function public.is_group_member(uuid), public.is_group_admin(uuid),
    public.platform_create_group_account(text, text), public.platform_set_group_account_status(uuid, text),
    public.group_invite_member(uuid, text, text), public.group_cancel_invitation(uuid), public.group_accept_invitations(),
    public.group_set_member_role(uuid, text), public.group_remove_member(uuid),
    public.group_set_view_grant(uuid, uuid, text, boolean, boolean),
    public.school_set_group_admissions_share(text, uuid, boolean), public.platform_group_accounts_overview(),
    public.group_view_grants_keep_history()
    from public, anon, authenticated;
grant execute on function public.is_group_member(uuid), public.is_group_admin(uuid),
    public.platform_create_group_account(text, text), public.platform_set_group_account_status(uuid, text),
    public.group_invite_member(uuid, text, text), public.group_cancel_invitation(uuid), public.group_accept_invitations(),
    public.group_set_member_role(uuid, text), public.group_remove_member(uuid),
    public.school_set_group_admissions_share(text, uuid, boolean), public.platform_group_accounts_overview()
    to authenticated;
grant execute on function public.group_set_view_grant(uuid, uuid, text, boolean, boolean) to service_role;
grant select, insert, update on public.group_accounts, public.group_memberships, public.group_invitations, public.group_view_grants, public.group_admissions_shares to service_role;
