-- VicData 0.8 sets round 1 (A1-A5): one storage model for every set of schools, replacing
-- saved_sets / saved_set_members (Teacher, SMT, the Data View) and admissions_lists (Admissions).
-- docs/v0.8/vicdata_0_8_sets_round1_claude_code_prompt_v2.md, section A.
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v08_sets_r1_pglite.mjs), NOT APPLIED. Apply commands:
-- docs/v0.8/sets_round1_report_v1.md, step 1. Safe to run twice: every create is "if not exists" or
-- "or replace", every policy is dropped first, and the conversion skips rows it has already made.
--
-- Additive. The old tables stay in place, read by nothing new; a later round drops them.
--
--   1. sets: one row per stored set.
--        kind            compared_against | feeders
--        entry_point     Admissions ('4+', '11+', '16+', 'age:N'), or
--        phase           Teacher ('ks4' GCSE, 'ks5' Post-16), or neither (whole school)
--        focus_urn       the school the set is about (staff sets have one; parents' shortlists won't)
--        owner_scope     school (curated, read by every approved member) | personal (its owner only)
--        creator_kind    who made it: admissions | smt | school_admin (school sets) or me (personal).
--                        Default, group and Victoria Consultancy sets are never stored: they are
--                        computed when shown (default-comparator-lists.ts, groups/school-sets.ts,
--                        vc_comparator_sets) and become a stored set only when saved as someone's own.
--        audience        feeders only: day | boarding (the old day_feeders / boarding_feeders)
--        rung_age        feeders only: the 16+ ladder rung the set stands for (the old kind 'rung')
--        is_default      the school's own choice for its page (one per school, kind, entry point or
--                        phase, audience and rung), set by a curator
--        pinned, folder, tags, archived, rule (the old fuzzy definition), source_recipe (the default
--        set it started from), la_blend (the Admissions lead's LA birth blend), config (Teacher's
--        extras, e.g. startedFrom and the ranking filters)
--   2. set_members: urn, position (the set's order), tier (feeders: main | regular | occasional, or
--      null = untiered, which counts as regular).
--   3. set_user_state: per user and per set (a stored set's id, or a computed set's key such as
--      'adm:nearest-sector'), when they last used it and the folder they keep it in.
--   4. RLS:
--        read    a personal set: its owner only. A school set: every approved member of its school,
--                and platform admins (View as reads with the service role once resolveCaller has
--                confirmed it, as before).
--        write   a personal set: its owner. A school set is lead-only (Guy, 7 Nov), by kind:
--                compared_against by the Admissions lead, SMT and the School-Admin (is_admin or the
--                account holder); feeders by the Admissions lead and the School-Admin. Everyone else
--                -- other Admissions members, teachers, HoDs -- keeps personal sets only.
--        audit   a School-Admin's change to a school set (one only their School-Admin standing allows:
--                not the lead's, not SMT's on a compared-against set) is written to platform_audit_log
--                as admissions_lists_override, as 0.7 r2b audited the lists.
--        cap     up to 8 ACTIVE personal sets per person (archiving frees a slot); a trigger, so
--                the database is the backstop, not the page.
--        stamp   updated_by / updated_at (and created_by on insert) are set by the database.
--   5. The conversion: every admissions_lists row and every saved_sets row becomes a set, keeping
--      its members (in order), the fuzzy rule (as `rule`), the LA blend and the entry point.
--      legacy_list_id / legacy_saved_set_id (unique) make a second run change nothing.
--
-- Claims are read through auth.uid(); a session without JWT claims (supabase db query, this
-- migration's conversion) stamps no user, so the converted rows keep the old rows' updated_by.

-- 0. Helpers ---------------------------------------------------------------------------------

-- Does the caller hold this role, approved, at this school?
create or replace function public.has_school_role(p_school_account_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.school_memberships m
        where m.school_account_id = p_school_account_id and m.profile_id = auth.uid()
          and m.status = 'approved' and p_role = any(m.roles));
$$;

-- May the caller curate (create, change, archive, delete) this school's sets of this kind? Lead-only
-- (Guy, 7 Nov):
--   compared_against: the Admissions lead, SMT, the School-Admin (is_admin) or the account holder
--   feeders:          the Admissions lead, the School-Admin or the account holder
-- An Admissions member who isn't the lead curates neither.
create or replace function public.can_curate_sets(p_school_account_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case p_kind
        when 'compared_against' then
            public.is_admissions_lead_of(p_school_account_id)
            or public.has_school_role(p_school_account_id, 'smt')
            or public.is_admin_of_school_account(p_school_account_id)
            or public.is_account_holder_of_school_account(p_school_account_id)
        when 'feeders' then
            public.is_admissions_lead_of(p_school_account_id)
            or public.is_admin_of_school_account(p_school_account_id)
            or public.is_account_holder_of_school_account(p_school_account_id)
        else false
    end;
$$;

-- Is a write to this school set the School-Admin's override, to be audited -- allowed only by the
-- writer's School-Admin (or account holder) standing, not as the lead, nor as SMT on a
-- compared-against set? No user (the service role, the conversion): never.
create or replace function public.is_set_override(p_school_account_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() is not null
       and not public.is_admissions_lead_of(p_school_account_id)
       and not (p_kind = 'compared_against' and public.has_school_role(p_school_account_id, 'smt'));
$$;
revoke execute on function public.is_set_override(uuid, text) from public, anon, authenticated;

-- 1. sets -------------------------------------------------------------------------------------

create table if not exists public.sets (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 120),
    description text check (description is null or length(description) <= 1000),
    kind text not null check (kind in ('compared_against', 'feeders')),
    entry_point text check (entry_point is null or entry_point ~ '^(4\+|11\+|16\+|age:([2-9]|1[0-7]))$'),
    phase text check (phase is null or phase in ('ks4', 'ks5')),
    focus_urn text check (focus_urn is null or focus_urn ~ '^\d{5,7}$'),
    owner_scope text not null check (owner_scope in ('school', 'personal')),
    school_account_id uuid references public.school_accounts (id) on delete cascade,
    owner_profile_id uuid references public.profiles (id) on delete cascade,
    creator_kind text not null check (creator_kind in ('admissions', 'smt', 'school_admin', 'me')),
    audience text check (audience is null or audience in ('day', 'boarding')),
    rung_age int check (rung_age is null or rung_age between 2 and 17),
    is_default boolean not null default false,
    pinned boolean not null default false,
    folder text check (folder is null or length(folder) <= 80),
    tags text[] not null default '{}'::text[] check (cardinality(tags) <= 20),
    archived boolean not null default false,
    rule jsonb check (rule is null or jsonb_typeof(rule) = 'object'),
    source_recipe text check (source_recipe is null or length(source_recipe) <= 120),
    la_blend jsonb check (la_blend is null or jsonb_typeof(la_blend) = 'object'),
    config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
    legacy_list_id uuid unique,
    legacy_saved_set_id uuid unique,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now(),
    -- an entry point (Admissions) or a phase (Teacher), never both
    check (entry_point is null or phase is null),
    -- a school set belongs to a school and has no owner; a personal set has an owner and says 'me'
    check ((owner_scope = 'school' and school_account_id is not null and owner_profile_id is null and creator_kind <> 'me')
        or (owner_scope = 'personal' and owner_profile_id is not null and creator_kind = 'me')),
    -- audience and rung are for feeder sets only
    check (kind = 'feeders' or (audience is null and rung_age is null)),
    -- the school's own choice is a school set
    check (not is_default or owner_scope = 'school')
);
create index if not exists sets_school_idx on public.sets (school_account_id, kind);
create index if not exists sets_owner_idx on public.sets (owner_profile_id);
-- One school default per page.
create unique index if not exists sets_one_default_idx on public.sets (
    school_account_id, kind, coalesce(entry_point, ''), coalesce(phase, ''), coalesce(audience, ''), coalesce(rung_age, -1))
    where is_default and owner_scope = 'school' and not archived;

-- 2. set_members ------------------------------------------------------------------------------

create table if not exists public.set_members (
    set_id uuid not null references public.sets (id) on delete cascade,
    urn text not null check (urn ~ '^\d{5,7}$'),
    position int not null default 0,
    tier text check (tier is null or tier in ('main', 'regular', 'occasional')),
    added_at timestamptz not null default now(),
    primary key (set_id, urn)
);
create index if not exists set_members_urn_idx on public.set_members (urn);

-- 3. set_user_state ---------------------------------------------------------------------------

create table if not exists public.set_user_state (
    profile_id uuid not null references public.profiles (id) on delete cascade,
    set_key text not null check (length(set_key) between 1 and 160),
    last_used_at timestamptz,
    folder text check (folder is null or length(folder) <= 80),
    primary key (profile_id, set_key)
);

-- 4. Who reads and writes ---------------------------------------------------------------------

create or replace function public.can_read_set(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.sets s
        where s.id = p_set_id and (
            (s.owner_scope = 'personal' and s.owner_profile_id = auth.uid())
            or (s.owner_scope = 'school' and (public.is_member_of_school_account(s.school_account_id) or public.is_platform_admin()))));
$$;

create or replace function public.can_write_set(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.sets s
        where s.id = p_set_id and (
            (s.owner_scope = 'personal' and s.owner_profile_id = auth.uid())
            or (s.owner_scope = 'school' and public.can_curate_sets(s.school_account_id, s.kind))));
$$;

alter table public.sets enable row level security;
alter table public.set_members enable row level security;
alter table public.set_user_state enable row level security;

drop policy if exists sets_select on public.sets;
create policy sets_select on public.sets for select using (
    (owner_scope = 'personal' and owner_profile_id = auth.uid())
    or (owner_scope = 'school' and (public.is_member_of_school_account(school_account_id) or public.is_platform_admin())));

-- A personal set is its owner's, and if it names a school, the owner is an approved member there.
-- A school set is written by the kind's curators; the WITH CHECK also stops a set being moved to
-- another school, made personal, or given to someone else.
drop policy if exists sets_insert on public.sets;
create policy sets_insert on public.sets for insert with check (
    (owner_scope = 'personal' and owner_profile_id = auth.uid()
        and (school_account_id is null or public.is_member_of_school_account(school_account_id)))
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind)));

drop policy if exists sets_update on public.sets;
create policy sets_update on public.sets for update using (
    (owner_scope = 'personal' and owner_profile_id = auth.uid())
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind)))
    with check (
    (owner_scope = 'personal' and owner_profile_id = auth.uid()
        and (school_account_id is null or public.is_member_of_school_account(school_account_id)))
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind)));

drop policy if exists sets_delete on public.sets;
create policy sets_delete on public.sets for delete using (
    (owner_scope = 'personal' and owner_profile_id = auth.uid())
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind)));

drop policy if exists set_members_select on public.set_members;
create policy set_members_select on public.set_members for select using (public.can_read_set(set_id));
drop policy if exists set_members_insert on public.set_members;
create policy set_members_insert on public.set_members for insert with check (public.can_write_set(set_id));
drop policy if exists set_members_update on public.set_members;
create policy set_members_update on public.set_members for update using (public.can_write_set(set_id)) with check (public.can_write_set(set_id));
drop policy if exists set_members_delete on public.set_members;
create policy set_members_delete on public.set_members for delete using (public.can_write_set(set_id));

drop policy if exists set_user_state_own on public.set_user_state;
create policy set_user_state_own on public.set_user_state for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- The creator is who the writer is: 'me' for a personal set; for a school set, 'admissions' for the
-- Admissions lead, 'smt' for SMT, or 'school_admin' for the School-Admin or the account holder. A
-- write with no user (the service role, this migration) is trusted as given.
create or replace function public.check_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then return new; end if;
    if tg_op = 'UPDATE' and new.creator_kind = old.creator_kind then return new; end if;
    if new.owner_scope = 'school' and not (
        (new.creator_kind = 'admissions' and public.is_admissions_lead_of(new.school_account_id))
        or (new.creator_kind = 'smt' and public.has_school_role(new.school_account_id, 'smt'))
        or (new.creator_kind = 'school_admin' and (public.is_admin_of_school_account(new.school_account_id) or public.is_account_holder_of_school_account(new.school_account_id)))) then
        raise exception 'a school set''s creator must be a role the writer holds at that school' using errcode = '42501';
    end if;
    return new;
end;
$$;
drop trigger if exists sets_creator_check on public.sets;
create trigger sets_creator_check before insert or update on public.sets
    for each row execute function public.check_set_creator();

-- Up to 8 active personal sets per person; archived ones don't count.
create or replace function public.enforce_personal_set_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_active int;
begin
    if new.owner_scope <> 'personal' or new.archived then return new; end if;
    if tg_op = 'UPDATE' and old.owner_scope = 'personal' and not old.archived and old.owner_profile_id = new.owner_profile_id then return new; end if;
    select count(*) into v_active from public.sets
        where owner_scope = 'personal' and owner_profile_id = new.owner_profile_id and not archived and id <> new.id;
    if v_active >= 8 then
        raise exception 'personal set cap (8 active) reached; archive one to free a slot' using errcode = 'P0001';
    end if;
    return new;
end;
$$;
drop trigger if exists sets_personal_cap on public.sets;
create trigger sets_personal_cap before insert or update on public.sets
    for each row execute function public.enforce_personal_set_cap();

-- Who last changed it, and when: set by the database, never trusted from the client. With no user
-- (the service role, the conversion) the given values stand.
create or replace function public.stamp_set_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null then
        new.updated_by := auth.uid();
        new.updated_at := now();
        if tg_op = 'INSERT' then
            new.created_by := auth.uid();
            new.created_at := now();
        end if;
    end if;
    if tg_op = 'UPDATE' then
        new.created_by := old.created_by;
        new.created_at := old.created_at;
        new.legacy_list_id := old.legacy_list_id;
        new.legacy_saved_set_id := old.legacy_saved_set_id;
    end if;
    return new;
end;
$$;
drop trigger if exists sets_stamp on public.sets;
create trigger sets_stamp before insert or update on public.sets
    for each row execute function public.stamp_set_change();

-- A change to a set's schools is a change to the set ("last changed by").
create or replace function public.touch_set_from_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null then
        update public.sets set updated_at = now() where id = coalesce(new.set_id, old.set_id);
    end if;
    return null;
end;
$$;
drop trigger if exists set_members_touch on public.set_members;
create trigger set_members_touch after insert or update or delete on public.set_members
    for each row execute function public.touch_set_from_members();

-- Save a set and its schools in one call (create when p_id is null, else change it), so a set is
-- never left half-written. SECURITY INVOKER: every statement runs under the caller's own RLS, so
-- this grants nothing the policies above don't. p_set holds the columns a writer may set; p_members
-- is [{ "urn": "...", "tier": "main" | "regular" | "occasional" | null }, ...] in the set's order.
-- Returns the set's id.
create or replace function public.save_set(p_id uuid, p_set jsonb, p_members jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id uuid := p_id;
begin
    if jsonb_typeof(coalesce(p_members, '[]'::jsonb)) <> 'array' then
        raise exception 'p_members must be an array' using errcode = '22023';
    end if;
    if v_id is null then
        insert into public.sets (name, description, kind, entry_point, phase, focus_urn, owner_scope, school_account_id,
                                 owner_profile_id, creator_kind, audience, rung_age, is_default, pinned, folder, tags,
                                 archived, rule, source_recipe, la_blend, config)
        values (p_set ->> 'name', p_set ->> 'description', p_set ->> 'kind', p_set ->> 'entry_point', p_set ->> 'phase',
                p_set ->> 'focus_urn', p_set ->> 'owner_scope', (p_set ->> 'school_account_id')::uuid,
                (p_set ->> 'owner_profile_id')::uuid, p_set ->> 'creator_kind', p_set ->> 'audience',
                (p_set ->> 'rung_age')::int, coalesce((p_set ->> 'is_default')::boolean, false),
                coalesce((p_set ->> 'pinned')::boolean, false), p_set ->> 'folder',
                coalesce(array(select jsonb_array_elements_text(p_set -> 'tags')), '{}'::text[]),
                coalesce((p_set ->> 'archived')::boolean, false), p_set -> 'rule', p_set ->> 'source_recipe',
                p_set -> 'la_blend', coalesce(p_set -> 'config', '{}'::jsonb))
        returning id into v_id;
    else
        update public.sets set
            name = coalesce(p_set ->> 'name', name),
            description = case when p_set ? 'description' then p_set ->> 'description' else description end,
            focus_urn = case when p_set ? 'focus_urn' then p_set ->> 'focus_urn' else focus_urn end,
            audience = case when p_set ? 'audience' then p_set ->> 'audience' else audience end,
            is_default = coalesce((p_set ->> 'is_default')::boolean, is_default),
            pinned = coalesce((p_set ->> 'pinned')::boolean, pinned),
            folder = case when p_set ? 'folder' then p_set ->> 'folder' else folder end,
            tags = case when p_set ? 'tags' then coalesce(array(select jsonb_array_elements_text(p_set -> 'tags')), '{}'::text[]) else tags end,
            archived = coalesce((p_set ->> 'archived')::boolean, archived),
            rule = case when p_set ? 'rule' then p_set -> 'rule' else rule end,
            source_recipe = case when p_set ? 'source_recipe' then p_set ->> 'source_recipe' else source_recipe end,
            la_blend = case when p_set ? 'la_blend' then p_set -> 'la_blend' else la_blend end,
            config = coalesce(p_set -> 'config', config)
        where id = v_id;
        if not found then
            raise exception 'no set you can change has that id' using errcode = '42501';
        end if;
    end if;
    if p_members is not null then
        -- Only what changed: the schools that leave, the ones that join, and new places or tiers --
        -- so the override audit records a real difference.
        delete from public.set_members m
        where m.set_id = v_id
          and not exists (select 1 from jsonb_array_elements(p_members) e where e ->> 'urn' = m.urn);
        insert into public.set_members (set_id, urn, position, tier)
        select v_id, x.urn, x.position, x.tier
        from (
            select distinct on (e ->> 'urn') e ->> 'urn' as urn, (o - 1)::int as position, nullif(e ->> 'tier', '') as tier
            from jsonb_array_elements(p_members) with ordinality as y(e, o)
            order by e ->> 'urn', o
        ) x
        on conflict (set_id, urn) do update set position = excluded.position, tier = excluded.tier
            where (set_members.position, set_members.tier) is distinct from (excluded.position, excluded.tier);
    end if;
    return v_id;
end;
$$;
revoke execute on function public.save_set(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_set(uuid, jsonb, jsonb) to authenticated;

-- The School-Admin's override, audited as 0.7 r2b audited the lists (admissions_lists_override in
-- platform_audit_log, People -> Admissions history). The detail keeps r2b's fields (op, entry_point,
-- kind in the old list kinds, rung, added, removed, changed) and adds the set's id and name.
create or replace function public.set_audit_detail(p_set public.sets, p_op text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object('op', p_op, 'set_id', p_set.id, 'name', p_set.name, 'entry_point', p_set.entry_point,
        'kind', case when p_set.kind = 'compared_against' then 'rivals' when p_set.rung_age is not null then 'rung'
                     when p_set.audience = 'boarding' then 'boarding_feeders' when p_set.audience = 'day' then 'day_feeders' else p_set.kind end,
        'rung', case when p_set.rung_age is not null then 'age:' || p_set.rung_age else null end);
$$;
revoke execute on function public.set_audit_detail(public.sets, text) from public, anon, authenticated;

create or replace function public.audit_set_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.sets;
    v_changed text[];
    v_detail jsonb;
begin
    if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
    if v_row.owner_scope <> 'school' or not public.is_set_override(v_row.school_account_id, v_row.kind) then
        return null;
    end if;
    v_detail := public.set_audit_detail(v_row, lower(tg_op));
    if tg_op = 'UPDATE' then
        select coalesce(array_agg(f order by f), '{}') into v_changed
        from unnest(array['name', 'description', 'rule', 'la_blend', 'pinned', 'archived', 'is_default', 'folder', 'tags', 'source_recipe', 'audience']) f
        where (to_jsonb(new) -> f) is distinct from (to_jsonb(old) -> f);
        -- A change to its schools touches updated_at: the members' own audit records that.
        if cardinality(v_changed) = 0 then
            return null;
        end if;
        v_detail := v_detail || jsonb_build_object('changed', v_changed);
    end if;
    perform public.log_admissions_action('admissions_lists_override', v_row.school_account_id, v_detail);
    return null;
end;
$$;
drop trigger if exists sets_audit_override on public.sets;
create trigger sets_audit_override after insert or update or delete on public.sets
    for each row execute function public.audit_set_override();

-- A set's schools, one audit row per set per statement: who joined, who left, whose tier changed.
-- Each statement's transition tables arrive as jsonb ([{set_id, urn, tier}]); save_set writes only the
-- difference, so the row says what really changed.
create or replace function public.audit_set_members_apply(p_old jsonb, p_new jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_set public.sets;
    r record;
begin
    if auth.uid() is null then return; end if;
    for r in
        with o as (select (x ->> 'set_id')::uuid set_id, x ->> 'urn' urn, x ->> 'tier' tier from jsonb_array_elements(coalesce(p_old, '[]')) x),
             n as (select (x ->> 'set_id')::uuid set_id, x ->> 'urn' urn, x ->> 'tier' tier from jsonb_array_elements(coalesce(p_new, '[]')) x)
        select coalesce(n.set_id, o.set_id) as set_id,
               coalesce(jsonb_agg(n.urn order by n.urn) filter (where o.urn is null), '[]') as added,
               coalesce(jsonb_agg(o.urn order by o.urn) filter (where n.urn is null), '[]') as removed,
               coalesce(jsonb_agg(n.urn order by n.urn) filter (where o.urn is not null and n.urn is not null and o.tier is distinct from n.tier), '[]') as retiered
        from o full join n on o.set_id = n.set_id and o.urn = n.urn
        group by coalesce(n.set_id, o.set_id)
    loop
        select * into v_set from public.sets where id = r.set_id;
        if not found or v_set.owner_scope <> 'school' or not public.is_set_override(v_set.school_account_id, v_set.kind) then
            continue;
        end if;
        if jsonb_array_length(r.added) + jsonb_array_length(r.removed) + jsonb_array_length(r.retiered) = 0 then
            continue;
        end if;
        perform public.log_admissions_action('admissions_lists_override', v_set.school_account_id,
            public.set_audit_detail(v_set, 'update') || jsonb_build_object(
                'changed', case when jsonb_array_length(r.retiered) > 0 then jsonb_build_array('members', 'tiers') else jsonb_build_array('members') end,
                'added', r.added, 'removed', r.removed, 'retiered', r.retiered));
    end loop;
end;
$$;
revoke execute on function public.audit_set_members_apply(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.audit_set_members_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
    perform public.audit_set_members_apply(null, (select jsonb_agg(jsonb_build_object('set_id', set_id, 'urn', urn, 'tier', tier)) from new_rows));
    return null;
end; $$;
create or replace function public.audit_set_members_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
    perform public.audit_set_members_apply((select jsonb_agg(jsonb_build_object('set_id', set_id, 'urn', urn, 'tier', tier)) from old_rows), null);
    return null;
end; $$;
create or replace function public.audit_set_members_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
    perform public.audit_set_members_apply((select jsonb_agg(jsonb_build_object('set_id', set_id, 'urn', urn, 'tier', tier)) from old_rows),
                                           (select jsonb_agg(jsonb_build_object('set_id', set_id, 'urn', urn, 'tier', tier)) from new_rows));
    return null;
end; $$;
drop trigger if exists set_members_audit_insert on public.set_members;
create trigger set_members_audit_insert after insert on public.set_members
    referencing new table as new_rows for each statement execute function public.audit_set_members_insert();
drop trigger if exists set_members_audit_delete on public.set_members;
create trigger set_members_audit_delete after delete on public.set_members
    referencing old table as old_rows for each statement execute function public.audit_set_members_delete();
drop trigger if exists set_members_audit_update on public.set_members;
create trigger set_members_audit_update after update on public.set_members
    referencing old table as old_rows new table as new_rows for each statement execute function public.audit_set_members_update();

grant select, insert, update, delete on public.sets, public.set_members, public.set_user_state to authenticated;
revoke all on public.sets, public.set_members, public.set_user_state from anon;
revoke execute on function public.has_school_role(uuid, text) from public, anon;
grant execute on function public.has_school_role(uuid, text) to authenticated;
grant execute on function public.can_curate_sets(uuid, text) to authenticated;

-- 5. The conversion ---------------------------------------------------------------------------
-- admissions_lists -> school sets. A list with no members and no rule held nothing (the views
-- used the nearby defaults for it) and still becomes a set, so nothing is lost.
insert into public.sets (name, kind, entry_point, focus_urn, owner_scope, school_account_id, creator_kind,
                         audience, rung_age, is_default, pinned, rule, la_blend, legacy_list_id,
                         created_by, created_at, updated_by, updated_at)
select case l.kind
           when 'day_feeders' then 'Day feeders'
           when 'boarding_feeders' then 'Boarding feeders'
           when 'rivals' then 'Rivals'
           else 'Feeders for age ' || substring(l.rung from 5)
       end,
       case when l.kind = 'rivals' then 'compared_against' else 'feeders' end,
       l.entry_point,
       sa.school_urn,
       'school',
       l.school_account_id,
       case when l.updated_by_kind = 'school_admin' then 'school_admin' else 'admissions' end,
       case l.kind when 'day_feeders' then 'day' when 'boarding_feeders' then 'boarding' else null end,
       case when l.kind = 'rung' then substring(l.rung from 5)::int else null end,
       true,
       true,
       l.fuzzy,
       l.la_blend,
       l.id,
       l.updated_by, l.updated_at, l.updated_by, l.updated_at
from public.admissions_lists l
join public.school_accounts sa on sa.id = l.school_account_id
where not exists (select 1 from public.sets s where s.legacy_list_id = l.id);

insert into public.set_members (set_id, urn, position)
select s.id, m.urn, (m.ord - 1)::int
from public.sets s
join public.admissions_lists l on l.id = s.legacy_list_id
cross join lateral unnest(l.members) with ordinality as m(urn, ord)
where m.urn ~ '^\d{5,7}$'
on conflict (set_id, urn) do nothing;

-- saved_sets -> sets (empty on 6 Nov; converted so nothing is lost if one is made before this is
-- applied). A shared set (no owner) becomes a school set made by the School-Admin, as only the
-- School-Admin or the account holder could make one; a personal one stays its owner's. An
-- 'excluded' member was out of the set and stays out.
insert into public.sets (name, kind, entry_point, focus_urn, owner_scope, school_account_id, owner_profile_id, creator_kind,
                         source_recipe, config, legacy_saved_set_id, created_at, updated_at)
select ss.name,
       case when ss.set_type = 'feeder' then 'feeders' else 'compared_against' end,
       ss.entry_point,
       sa.school_urn,
       case when ss.owner_membership_id is null then 'school' else 'personal' end,
       ss.school_account_id,
       m.profile_id,
       case when ss.owner_membership_id is null then 'school_admin' else 'me' end,
       nullif(ss.config ->> 'startedFrom', ''),
       ss.config,
       ss.id,
       ss.created_at, ss.updated_at
from public.saved_sets ss
join public.school_accounts sa on sa.id = ss.school_account_id
left join public.school_memberships m on m.id = ss.owner_membership_id
where not exists (select 1 from public.sets s where s.legacy_saved_set_id = ss.id)
  and (ss.owner_membership_id is null or m.profile_id is not null)
  -- an entry point the new model can't hold is left behind (the old row stays)
  and (ss.entry_point is null or ss.entry_point ~ '^(4\+|11\+|16\+|age:([2-9]|1[0-7]))$');

insert into public.set_members (set_id, urn, position)
select s.id, mm.school_urn, (row_number() over (partition by s.id order by mm.added_at, mm.school_urn) - 1)::int
from public.sets s
join public.saved_set_members mm on mm.saved_set_id = s.legacy_saved_set_id
where mm.member_status <> 'excluded' and mm.school_urn ~ '^\d{5,7}$'
on conflict (set_id, urn) do nothing;
