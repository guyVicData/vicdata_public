begin;
-- VicData 0.8 group sets, M2 (storage): sets owned by a head office, and sets whose members are groups.
-- docs/v0.8/vicdata_0_8_group_sets_brief_v2.md §7 (Guy's D2, D6, D8, 8 Nov).
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v08_group_sets_pglite.mjs), NOT APPLIED. After
-- 20261110090000_v08_groups_r1_accounts.sql and 20261121090000_v08_sets_r1.sql. Additive: every school
-- and personal set keeps its shape, its policies' meaning and its save path; safe to run twice.
--
--   1. sets.group_account_id: a set owned by a head office (owner_scope 'group', creator 'head_office'),
--      or a head-office member's personal set made for that group (owner_scope 'personal', 'me').
--      Two kinds for groups: 'group_peers' (members are groups: a comparison set) and 'group_schools'
--      (members are the group's own schools: a subset that filters its pages). School kinds
--      (compared_against, feeders) never carry a group; group kinds never carry a school, an entry
--      point, a phase, a focus school, an audience or a rung.
--   2. set_group_members: a group_peers set's groups (production group ids), in order. A separate table
--      so set_members (school URNs, live for Leighton Park) keeps its key and its save path unchanged.
--      At most 8 per set (GROUP_SET_CAP in the app; this trigger is the backstop).
--   3. Who (RLS): a group set is read by every member of its head office (both roles) and platform
--      admins; written only by the head office's admins (is_group_admin). A personal set for a group
--      is its owner's, who must be a member of that head office. A member school's SMT reads group
--      sets through the app's server after it checks the school's live grant (grants depend on
--      production membership, which this database can't see), never through RLS.
--   4. The group's default (Make default, D8): one per head office and kind; deleting it lets the app
--      fall back to the size band.
--   5. share_set_with_group (D6): an admin moves their own personal set to the head office. Duplicate is
--      an ordinary save of a copy as a personal set (no function needed).
--   6. save_set: group_account_id on insert; p_members elements with "group_id" go to set_group_members.

-- 1. sets -------------------------------------------------------------------------------------

alter table public.sets add column if not exists group_account_id uuid references public.group_accounts (id) on delete cascade;
create index if not exists sets_group_idx on public.sets (group_account_id, kind) where group_account_id is not null;

alter table public.sets drop constraint if exists sets_owner_scope_check;
alter table public.sets add constraint sets_owner_scope_check check (owner_scope in ('school', 'personal', 'group'));
alter table public.sets drop constraint if exists sets_kind_check;
alter table public.sets add constraint sets_kind_check check (kind in ('compared_against', 'feeders', 'group_peers', 'group_schools'));
alter table public.sets drop constraint if exists sets_creator_kind_check;
alter table public.sets add constraint sets_creator_kind_check check (creator_kind in ('admissions', 'smt', 'school_admin', 'head_office', 'me'));

-- Who owns it (replaces sets_check1): a school set belongs to a school; a group set to a head office;
-- a personal set to its owner, and says 'me'. Only a group set is 'head_office'.
alter table public.sets drop constraint if exists sets_check1;
alter table public.sets drop constraint if exists sets_owner_shape_check;
alter table public.sets add constraint sets_owner_shape_check check (
    (owner_scope = 'school' and school_account_id is not null and group_account_id is null and owner_profile_id is null
        and creator_kind in ('admissions', 'smt', 'school_admin'))
    or (owner_scope = 'group' and group_account_id is not null and school_account_id is null and owner_profile_id is null
        and creator_kind = 'head_office')
    or (owner_scope = 'personal' and owner_profile_id is not null and creator_kind = 'me'
        and (school_account_id is null or group_account_id is null)));

-- School kinds never carry a group; group kinds carry a group and nothing a school set uses.
alter table public.sets drop constraint if exists sets_group_kind_check;
alter table public.sets add constraint sets_group_kind_check check (
    (kind in ('compared_against', 'feeders') and group_account_id is null)
    or (kind in ('group_peers', 'group_schools') and group_account_id is not null and school_account_id is null
        and entry_point is null and phase is null and focus_urn is null and audience is null and rung_age is null));

-- The default is a school's or a head office's choice (replaces sets_check3).
alter table public.sets drop constraint if exists sets_check3;
alter table public.sets drop constraint if exists sets_default_owner_check;
alter table public.sets add constraint sets_default_owner_check check (not is_default or owner_scope in ('school', 'group'));
create unique index if not exists sets_one_group_default_idx on public.sets (group_account_id, kind)
    where is_default and owner_scope = 'group' and not archived;

-- 2. set_group_members -----------------------------------------------------------------------

create table if not exists public.set_group_members (
    set_id uuid not null references public.sets (id) on delete cascade,
    group_id text not null check (group_id ~ '^[A-Za-z0-9_:.-]{1,80}$'),
    position int not null default 0,
    added_at timestamptz not null default now(),
    primary key (set_id, group_id)
);
create index if not exists set_group_members_group_idx on public.set_group_members (group_id);

-- Groups only in a group_peers set, at most 8; schools never in one.
create or replace function public.check_set_group_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select kind from public.sets where id = new.set_id) is distinct from 'group_peers' then
        raise exception 'only a set of groups (group_peers) holds groups' using errcode = '23514';
    end if;
    if (select count(*) from public.set_group_members where set_id = new.set_id and group_id <> new.group_id) >= 8 then
        raise exception 'a set holds at most 8 groups' using errcode = 'P0001';
    end if;
    return new;
end;
$$;
drop trigger if exists set_group_members_check on public.set_group_members;
create trigger set_group_members_check before insert or update on public.set_group_members
    for each row execute function public.check_set_group_member();

create or replace function public.check_set_member_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select kind from public.sets where id = new.set_id) = 'group_peers' then
        raise exception 'a set of groups holds groups, not schools' using errcode = '23514';
    end if;
    return new;
end;
$$;
drop trigger if exists set_members_kind_check on public.set_members;
create trigger set_members_kind_check before insert or update on public.set_members
    for each row execute function public.check_set_member_kind();

-- A change to a set's groups is a change to the set, as for its schools.
drop trigger if exists set_group_members_touch on public.set_group_members;
create trigger set_group_members_touch after insert or update or delete on public.set_group_members
    for each row execute function public.touch_set_from_members();

-- 3. Who reads and writes ----------------------------------------------------------------------

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
            or (s.owner_scope = 'school' and (public.is_member_of_school_account(s.school_account_id) or public.is_platform_admin()))
            or (s.owner_scope = 'group' and (public.is_group_member(s.group_account_id) or public.is_platform_admin()))));
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
            or (s.owner_scope = 'school' and public.can_curate_sets(s.school_account_id, s.kind))
            or (s.owner_scope = 'group' and public.is_group_admin(s.group_account_id))));
$$;

-- The owner conditions stay inline in each policy (a SELECT policy that only calls a helper reading
-- the same table breaks INSERT ... RETURNING).
drop policy if exists sets_select on public.sets;
create policy sets_select on public.sets for select using (
    (owner_scope = 'personal' and owner_profile_id = auth.uid())
    or (owner_scope = 'school' and (public.is_member_of_school_account(school_account_id) or public.is_platform_admin()))
    or (owner_scope = 'group' and (public.is_group_member(group_account_id) or public.is_platform_admin())));

drop policy if exists sets_insert on public.sets;
create policy sets_insert on public.sets for insert with check (
    (owner_scope = 'personal' and owner_profile_id = auth.uid()
        and (school_account_id is null or public.is_member_of_school_account(school_account_id))
        and (group_account_id is null or public.is_group_member(group_account_id)))
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind))
    or (owner_scope = 'group' and public.is_group_admin(group_account_id)));

drop policy if exists sets_update on public.sets;
create policy sets_update on public.sets for update using (
    (owner_scope = 'personal' and owner_profile_id = auth.uid())
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind))
    or (owner_scope = 'group' and public.is_group_admin(group_account_id)))
    with check (
    (owner_scope = 'personal' and owner_profile_id = auth.uid()
        and (school_account_id is null or public.is_member_of_school_account(school_account_id))
        and (group_account_id is null or public.is_group_member(group_account_id)))
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind))
    or (owner_scope = 'group' and public.is_group_admin(group_account_id)));

drop policy if exists sets_delete on public.sets;
create policy sets_delete on public.sets for delete using (
    (owner_scope = 'personal' and owner_profile_id = auth.uid())
    or (owner_scope = 'school' and public.can_curate_sets(school_account_id, kind))
    or (owner_scope = 'group' and public.is_group_admin(group_account_id)));

alter table public.set_group_members enable row level security;
drop policy if exists set_group_members_select on public.set_group_members;
create policy set_group_members_select on public.set_group_members for select using (public.can_read_set(set_id));
drop policy if exists set_group_members_insert on public.set_group_members;
create policy set_group_members_insert on public.set_group_members for insert with check (public.can_write_set(set_id));
drop policy if exists set_group_members_update on public.set_group_members;
create policy set_group_members_update on public.set_group_members for update using (public.can_write_set(set_id)) with check (public.can_write_set(set_id));
drop policy if exists set_group_members_delete on public.set_group_members;
create policy set_group_members_delete on public.set_group_members for delete using (public.can_write_set(set_id));
grant select, insert, update, delete on public.set_group_members to authenticated;
revoke all on public.set_group_members from anon;

-- The creator is who the writer is; a group set is the head office's, written by its admin.
create or replace function public.check_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then return new; end if;
    if tg_op = 'UPDATE' and new.creator_kind = old.creator_kind and new.owner_scope = old.owner_scope then return new; end if;
    if new.owner_scope = 'school' and not (
        (new.creator_kind = 'admissions' and public.is_admissions_lead_of(new.school_account_id))
        or (new.creator_kind = 'smt' and public.has_school_role(new.school_account_id, 'smt'))
        or (new.creator_kind = 'school_admin' and (public.is_admin_of_school_account(new.school_account_id) or public.is_account_holder_of_school_account(new.school_account_id)))) then
        raise exception 'a school set''s creator must be a role the writer holds at that school' using errcode = '42501';
    end if;
    if new.owner_scope = 'group' and not (new.creator_kind = 'head_office' and public.is_group_admin(new.group_account_id)) then
        raise exception 'a group set is written by its head office''s admins' using errcode = '42501';
    end if;
    return new;
end;
$$;

-- 5. Share with the group (D6): an admin's own personal set for this head office becomes the head
-- office's. It moves (the personal slot is freed); Duplicate makes a private copy instead.
create or replace function public.share_set_with_group(p_set_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v public.sets;
begin
    select * into v from public.sets where id = p_set_id;
    if not found or v.owner_scope <> 'personal' or v.owner_profile_id is distinct from auth.uid() then
        raise exception 'only your own personal set can be shared' using errcode = '42501';
    end if;
    if v.group_account_id is null or v.kind not in ('group_peers', 'group_schools') then
        raise exception 'only a set made for a group can be shared with it' using errcode = '23514';
    end if;
    if not public.is_group_admin(v.group_account_id) then
        raise exception 'only the head office''s admins share sets with the group' using errcode = '42501';
    end if;
    update public.sets set owner_scope = 'group', owner_profile_id = null, creator_kind = 'head_office'
    where id = p_set_id;
    return p_set_id;
end;
$$;
revoke execute on function public.share_set_with_group(uuid) from public, anon;
grant execute on function public.share_set_with_group(uuid) to authenticated;

-- 6. save_set, with groups -----------------------------------------------------------------------
-- As 20261121090000, plus group_account_id on insert and p_members elements { "group_id": "...", } for
-- a set of groups. SECURITY INVOKER as before: every statement runs under the caller's own RLS.
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
                                 group_account_id, owner_profile_id, creator_kind, audience, rung_age, is_default, pinned,
                                 folder, tags, archived, rule, source_recipe, la_blend, config)
        values (p_set ->> 'name', p_set ->> 'description', p_set ->> 'kind', p_set ->> 'entry_point', p_set ->> 'phase',
                p_set ->> 'focus_urn', p_set ->> 'owner_scope', (p_set ->> 'school_account_id')::uuid,
                (p_set ->> 'group_account_id')::uuid, (p_set ->> 'owner_profile_id')::uuid, p_set ->> 'creator_kind',
                p_set ->> 'audience', (p_set ->> 'rung_age')::int, coalesce((p_set ->> 'is_default')::boolean, false),
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
        -- Schools: only what changed (the override audit records a real difference).
        delete from public.set_members m
        where m.set_id = v_id
          and not exists (select 1 from jsonb_array_elements(p_members) e where e ->> 'urn' = m.urn);
        insert into public.set_members (set_id, urn, position, tier)
        select v_id, x.urn, x.position, x.tier
        from (
            select distinct on (e ->> 'urn') e ->> 'urn' as urn, (o - 1)::int as position, nullif(e ->> 'tier', '') as tier
            from jsonb_array_elements(p_members) with ordinality as y(e, o)
            where e ? 'urn'
            order by e ->> 'urn', o
        ) x
        on conflict (set_id, urn) do update set position = excluded.position, tier = excluded.tier
            where (set_members.position, set_members.tier) is distinct from (excluded.position, excluded.tier);
        -- Groups (a set of groups): the same, by group id.
        delete from public.set_group_members g
        where g.set_id = v_id
          and not exists (select 1 from jsonb_array_elements(p_members) e where e ->> 'group_id' = g.group_id);
        insert into public.set_group_members (set_id, group_id, position)
        select v_id, x.group_id, x.position
        from (
            select distinct on (e ->> 'group_id') e ->> 'group_id' as group_id, (o - 1)::int as position
            from jsonb_array_elements(p_members) with ordinality as y(e, o)
            where e ? 'group_id'
            order by e ->> 'group_id', o
        ) x
        on conflict (set_id, group_id) do update set position = excluded.position
            where set_group_members.position is distinct from excluded.position;
    end if;
    return v_id;
end;
$$;
revoke execute on function public.save_set(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_set(uuid, jsonb, jsonb) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20261123090000', 'v08_group_sets') on conflict (version) do nothing;
commit;
