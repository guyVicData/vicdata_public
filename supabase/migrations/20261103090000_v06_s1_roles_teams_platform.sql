-- VicData 0.6, S1: roles as a set, platform admin, teams, sign-in events.
-- (docs/v0.6/vicdata_0_6_scope_brief_v1.md §2, §7a G13; night 1 prompt S1; audit
-- docs/v0.6/audit_v1.md §8.)
--
-- Additive only. Nothing here changes who can see or edit any EXISTING row:
--   * school_memberships gains `roles` (backfilled from `role`) and `job_title`. Every
--     existing policy reads status / is_admin / the account holder, never `role`, and
--     those stay the School-Admin source of truth (School-Admin is `is_admin`, not a
--     member of `roles`). `role` is kept and synced from `roles` for the transition.
--   * platform_admins / is_platform_admin() are new. Platform powers go through
--     SECURITY DEFINER RPCs that check is_platform_admin() and write an audit row; no
--     existing table gains a policy.
--   * teams, team_members and sign_in_events are new tables.
--   * join_school stops trusting the client's role (Teacher is the self-select default;
--     every other role is School-Admin granted) and gets a fixed search_path.
--
-- NOT here, deliberately: the school_memberships INSERT policy hole the audit found
-- (any signed-in user can insert an approved admin membership). Tightening it is an RLS
-- change on memberships, a stop condition, so the fix is written up for Guy in
-- docs/v0.6/proposed_sql/membership_insert_hardening.sql and is not applied.

-- 1. Roles as a set ---------------------------------------------------------------

alter table public.school_memberships
    add column if not exists roles text[] not null default array['teacher']::text[],
    add column if not exists job_title text;

update public.school_memberships set roles = array[coalesce(role, 'teacher')];

alter table public.school_memberships
    add constraint school_memberships_roles_vocabulary
        check (roles <@ array['teacher', 'hod', 'smt', 'finance', 'admissions']::text[]),
    add constraint school_memberships_job_title_length
        check (job_title is null or length(job_title) <= 120);

-- Keeps the single `role` column (still read by /account) equal to the most senior role in
-- the set, and makes a joiner's role set Teacher unless the service role is writing:
-- SMT, Admissions, HOD and Finance are School-Admin granted (roles.ts ADMIN_GRANTED_ROLES).
create or replace function public.sync_membership_roles()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_is_service boolean := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role';
begin
    if tg_op = 'INSERT' and not v_is_service then
        new.roles := array['teacher']::text[];
    elsif tg_op = 'UPDATE' and new.roles is not distinct from old.roles
          and new.role is distinct from old.role then
        -- An old writer (the /account page, scripts) changed `role` alone.
        new.roles := array[coalesce(new.role, 'teacher')];
    end if;
    -- Duplicates out, a stable order.
    new.roles := array(select distinct r from unnest(new.roles) r order by r);
    new.role := case
        when 'smt' = any(new.roles) then 'smt'
        when 'admissions' = any(new.roles) then 'admissions'
        when 'hod' = any(new.roles) then 'hod'
        when 'finance' = any(new.roles) then 'finance'
        else 'teacher'
    end;
    return new;
end;
$$;

create trigger school_memberships_sync_roles
    before insert or update on public.school_memberships
    for each row execute function public.sync_membership_roles();

-- 2. Platform admin ---------------------------------------------------------------

create table public.platform_admins (
    profile_id uuid primary key references public.profiles (id) on delete cascade,
    granted_at timestamptz not null default now(),
    note text
);
alter table public.platform_admins enable row level security;
-- You can see whether YOU are one; nobody can write through the API.
create policy platform_admins_select_self on public.platform_admins
    for select using (profile_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.platform_admins where profile_id = auth.uid());
$$;

create table public.platform_audit_log (
    id bigint generated always as identity primary key,
    actor_profile_id uuid not null references public.profiles (id),
    action text not null,
    school_urn text,
    detail jsonb not null default '{}'::jsonb,
    at timestamptz not null default now()
);
alter table public.platform_audit_log enable row level security;
create policy platform_audit_log_select_platform on public.platform_audit_log
    for select using (public.is_platform_admin());

create or replace function public.log_platform_action(p_action text, p_school_urn text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_platform_admin() then
        raise exception 'platform admin only';
    end if;
    insert into public.platform_audit_log (actor_profile_id, action, school_urn, detail)
    values (auth.uid(), p_action, p_school_urn, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- Guy, the one super-admin (scope brief §2). Identified by profile id, never by email
-- matching; the preview user is a separate profile and is not granted.
insert into public.platform_admins (profile_id, note)
select id, 'Guy (super-admin), seeded by 0.6 S1' from public.profiles
where id = '52a08818-9132-48a0-8665-8362361eff11'
on conflict do nothing;

-- The Platform screen's VC Sets switch: every VC set on or off for one school. Replaces
-- `scripts/vc-sets.ts show|hide` as the in-app path; the script keeps working.
create or replace function public.platform_set_vc_visibility(p_school_urn text, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account uuid;
begin
    if not public.is_platform_admin() then
        raise exception 'platform admin only';
    end if;
    select id into v_account from public.school_accounts where school_urn = p_school_urn;
    if v_account is null then
        raise exception 'no school account for %', p_school_urn;
    end if;
    if p_visible then
        insert into public.vc_set_school_visibility (school_account_id, vc_set_id)
        select v_account, s.id from public.vc_comparator_sets s
        on conflict do nothing;
    else
        delete from public.vc_set_school_visibility where school_account_id = v_account;
    end if;
    perform public.log_platform_action('vc_sets_visible', p_school_urn, jsonb_build_object('visible', p_visible));
end;
$$;

-- 3. Teams ------------------------------------------------------------------------
-- Many-to-many, per school, School-Admin managed. Three automatic teams per school are
-- rows too (so a share can point at them) but their membership is derived from roles,
-- never stored. A sharing target only in 0.6.

create table public.teams (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    name text not null check (length(btrim(name)) between 1 and 80),
    auto_key text check (auto_key in ('all_staff', 'smt', 'admissions')),
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_account_id, auto_key)
);
create index teams_school_idx on public.teams (school_account_id);

create table public.team_members (
    team_id uuid not null references public.teams (id) on delete cascade,
    membership_id uuid not null references public.school_memberships (id) on delete cascade,
    added_by uuid references public.profiles (id) on delete set null,
    added_at timestamptz not null default now(),
    primary key (team_id, membership_id)
);
create index team_members_membership_idx on public.team_members (membership_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy teams_select_member on public.teams
    for select using (public.is_member_of_school_account(school_account_id));
-- Only named teams are written through the API; the automatic ones are seeded below.
create policy teams_insert_admin on public.teams
    for insert with check (auto_key is null and public.is_admin_of_school_account(school_account_id));
create policy teams_update_admin on public.teams
    for update using (auto_key is null and public.is_admin_of_school_account(school_account_id))
    with check (auto_key is null and public.is_admin_of_school_account(school_account_id));
create policy teams_delete_admin on public.teams
    for delete using (auto_key is null and public.is_admin_of_school_account(school_account_id));

create policy team_members_select_member on public.team_members
    for select using (exists (
        select 1 from public.teams t where t.id = team_id and public.is_member_of_school_account(t.school_account_id)));
create policy team_members_write_admin on public.team_members
    for all using (exists (
        select 1 from public.teams t where t.id = team_id and t.auto_key is null
          and public.is_admin_of_school_account(t.school_account_id)))
    with check (exists (
        select 1 from public.teams t
        join public.school_memberships m on m.id = membership_id and m.school_account_id = t.school_account_id
        where t.id = team_id and t.auto_key is null
          and public.is_admin_of_school_account(t.school_account_id)));

create or replace function public.seed_auto_teams(p_account uuid)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.teams (school_account_id, name, auto_key) values
        (p_account, 'All staff', 'all_staff'),
        (p_account, 'SMT', 'smt'),
        (p_account, 'Admissions', 'admissions')
    on conflict (school_account_id, auto_key) do nothing;
$$;
revoke execute on function public.seed_auto_teams(uuid) from public, anon, authenticated;

select public.seed_auto_teams(id) from public.school_accounts;

create or replace function public.school_accounts_seed_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.seed_auto_teams(new.id);
    return new;
end;
$$;
create trigger school_accounts_seed_teams
    after insert on public.school_accounts
    for each row execute function public.school_accounts_seed_teams();

-- Is the caller in this team? Automatic teams resolve from roles at read time.
create or replace function public.is_in_team(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.teams t
        join public.school_memberships m
          on m.school_account_id = t.school_account_id and m.profile_id = auth.uid() and m.status = 'approved'
        where t.id = p_team and (
            t.auto_key = 'all_staff'
            or (t.auto_key = 'smt' and 'smt' = any(m.roles))
            or (t.auto_key = 'admissions' and 'admissions' = any(m.roles))
            or (t.auto_key is null and exists (
                select 1 from public.team_members tm where tm.team_id = t.id and tm.membership_id = m.id))
        )
    );
$$;

-- 4. Sign-in events (G13): storage only, no UI, no read policy -------------------
-- One row per approved membership per sign-in. Only employment memberships exist today;
-- when a parent context arrives it must never be recorded here (the hard wall).
-- No SELECT policy at all: no school-admin query path, service role only.

create table public.sign_in_events (
    id bigint generated always as identity primary key,
    membership_id uuid not null references public.school_memberships (id) on delete cascade,
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    signed_in_at timestamptz not null default now()
);
create index sign_in_events_school_idx on public.sign_in_events (school_account_id, signed_in_at desc);
alter table public.sign_in_events enable row level security;

create or replace function public.record_sign_in()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        return;
    end if;
    insert into public.sign_in_events (membership_id, school_account_id)
    select m.id, m.school_account_id from public.school_memberships m
    where m.profile_id = auth.uid() and m.status = 'approved';
    -- Kept 12 months. There is no pg_cron here, so the write path prunes.
    delete from public.sign_in_events where signed_in_at < now() - interval '12 months';
end;
$$;
revoke execute on function public.record_sign_in() from public, anon;
grant execute on function public.record_sign_in() to authenticated;

-- 5. The Platform screen's school list ---------------------------------------------

create or replace function public.platform_school_overview()
returns table (
    school_urn text,
    school_name text,
    establishment_type_group text,
    establishment_type text,
    members int,
    roles_in_use text[],
    has_admins boolean,
    vc_sets_visible int,
    vc_sets_total int,
    school_admin_name text,
    last_active timestamptz
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
    select
        sa.school_urn,
        s.current_name::text,
        s.establishment_type_group::text,
        s.establishment_type::text,
        (select count(*)::int from public.school_memberships m where m.school_account_id = sa.id and m.status = 'approved'),
        (select array(select distinct r from public.school_memberships m, unnest(m.roles) r
                      where m.school_account_id = sa.id and m.status = 'approved' order by r)),
        exists (select 1 from public.school_memberships m where m.school_account_id = sa.id and m.status = 'approved' and m.is_admin),
        (select count(*)::int from public.vc_set_school_visibility v where v.school_account_id = sa.id),
        (select count(*)::int from public.vc_comparator_sets),
        (select p.full_name from public.school_memberships m join public.profiles p on p.id = m.profile_id
          where m.id = sa.account_holder_membership_id),
        (select max(e.signed_in_at) from public.sign_in_events e where e.school_account_id = sa.id)
    from public.school_accounts sa
    left join public.schools s on s.urn = sa.school_urn
    order by s.current_name;
end;
$$;

-- 6. join_school: Teacher on join, whatever the client sends; fixed search_path ------
-- p_role is kept in the signature so the deployed join page keeps calling it.

CREATE OR REPLACE FUNCTION public.join_school(p_urn text, p_role text)
 RETURNS TABLE(branch text, membership_status text, upsell boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_profile_id uuid := auth.uid();
    v_email text := auth.jwt() ->> 'email';
    v_account_id uuid;
    v_approved_count int;
    v_website text;
    v_email_domain text;
    v_website_domain text;
    v_membership_id uuid;
    v_status text;
    v_branch text;
    v_tier text;
    v_total_count int;
begin
    if v_profile_id is null then
        raise exception 'not authenticated';
    end if;

    -- Find or create the school_account (school_accounts_insert_authenticated already
    -- permits this for any authenticated user at the RLS layer; this function's own
    -- SECURITY DEFINER context does the same thing more simply).
    select id, tier into v_account_id, v_tier from public.school_accounts where school_urn = p_urn;
    if v_account_id is null then
        insert into public.school_accounts (school_urn) values (p_urn)
        returning id, tier into v_account_id, v_tier;
    end if;

    select count(*) into v_approved_count
    from public.school_memberships
    where school_account_id = v_account_id and status = 'approved';

    if v_approved_count = 0 then
        v_branch := 'first_member';

        select website into v_website from public.schools where urn = p_urn;

        v_email_domain := lower(split_part(v_email, '@', 2));
        -- Normalise a website value like "https://www.leightonpark.com/" down to
        -- "leightonpark.com" for comparison -- strip scheme, leading www., path/query.
        v_website_domain := lower(v_website);
        v_website_domain := regexp_replace(v_website_domain, '^https?://', '');
        v_website_domain := regexp_replace(v_website_domain, '^www\.', '');
        v_website_domain := split_part(v_website_domain, '/', 1);

        if v_website_domain is not null and v_website_domain <> '' and v_website_domain = v_email_domain then
            v_status := 'approved';
        else
            -- Manual fallback (membership spec §4) -- no website on record, or it
            -- doesn't match this signup's email domain.
            v_status := 'pending_verification';
        end if;

        insert into public.school_memberships (school_account_id, profile_id, status, role, approved_at)
        values (v_account_id, v_profile_id, v_status, 'teacher', case when v_status = 'approved' then now() else null end)
        returning id into v_membership_id;

        if v_status = 'approved' then
            update public.school_accounts set account_holder_membership_id = v_membership_id, updated_at = now()
            where id = v_account_id;
        end if;
    else
        v_branch := 'request_to_join';
        v_status := 'pending_approval';
        insert into public.school_memberships (school_account_id, profile_id, status, role)
        values (v_account_id, v_profile_id, v_status, 'teacher')
        returning id into v_membership_id;
    end if;

    -- 2nd-individual-member upsell (membership spec §5): a sharp, quantifiable trigger,
    -- not a soft nudge -- fires exactly when an individual-tier school reaches its
    -- second member (any status; joining itself is the trigger, not just approval).
    select count(*) into v_total_count
    from public.school_memberships
    where school_account_id = v_account_id;

    return query select v_branch, v_status, (v_tier = 'individual' and v_total_count = 2);
end;
$function$;
