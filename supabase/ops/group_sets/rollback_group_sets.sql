-- ROLLBACK for 20261123090000_v08_group_sets (VicData 0.8 group sets, M2). PREPARED, NOT RUN.
--
-- Undoes exactly what the migration did: the head offices' sets and personal sets for a group (DATA
-- LOSS: every row with a group_account_id, and every set_group_members row), the new table, triggers
-- and functions, the column and constraints; and puts back sets round 1's definitions of
-- can_read_set, can_write_set, check_set_creator, save_set, the four sets policies and the three
-- constraints it replaced. School and personal school sets are untouched. Tested in PGlite
-- (supabase/tests/v08_group_sets_pglite.mjs runs it with ROLLBACK=1).
begin;
delete from public.sets where group_account_id is not null or kind in ('group_peers', 'group_schools');
drop function if exists public.share_set_with_group(uuid);
drop trigger if exists set_group_members_check on public.set_group_members;
drop trigger if exists set_group_members_touch on public.set_group_members;
drop trigger if exists set_members_kind_check on public.set_members;
drop table if exists public.set_group_members;
drop function if exists public.check_set_group_member();
drop function if exists public.check_set_member_kind();
drop index if exists public.sets_one_group_default_idx;
drop index if exists public.sets_group_idx;
-- sets round 1's own definitions, verbatim:
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

alter table public.sets drop constraint if exists sets_group_kind_check;
alter table public.sets drop constraint if exists sets_owner_shape_check;
alter table public.sets drop constraint if exists sets_default_owner_check;
alter table public.sets drop column if exists group_account_id;
alter table public.sets drop constraint if exists sets_owner_scope_check;
alter table public.sets add constraint sets_owner_scope_check check (owner_scope in ('school', 'personal'));
alter table public.sets drop constraint if exists sets_kind_check;
alter table public.sets add constraint sets_kind_check check (kind in ('compared_against', 'feeders'));
alter table public.sets drop constraint if exists sets_creator_kind_check;
alter table public.sets add constraint sets_creator_kind_check check (creator_kind in ('admissions', 'smt', 'school_admin', 'me'));
alter table public.sets add constraint sets_check1 check ((owner_scope = 'school' and school_account_id is not null and owner_profile_id is null and creator_kind <> 'me')
    or (owner_scope = 'personal' and owner_profile_id is not null and creator_kind = 'me'));
alter table public.sets add constraint sets_check3 check (not is_default or owner_scope = 'school');

revoke execute on function public.save_set(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_set(uuid, jsonb, jsonb) to authenticated;
delete from supabase_migrations.schema_migrations where version = '20261123090000';
commit;
