-- VicData 0.7 admissions round 2b, E1: the School-Admin may override the shared lists.
--
-- Round 1 (20261106090000_v07_admissions_r1.sql) let only the Admissions lead write
-- admissions_lists and admissions_entry_points. Guy approved (round 2 report §8, decision 1)
-- letting the School-Admin (is_admin, or the account holder) write them too, as an override:
--   1. Both write policies gain `or public.is_school_admin_or_holder(school_account_id)`. The
--      lead's rights are unchanged; Admissions members without the flag, SMT (which shares
--      only), teachers and other schools still can't write.
--   2. Each row says whose kind of write it last was: `updated_by_kind` ('lead' or
--      'school_admin'), set by the database in the existing stamp trigger, never by the client.
--      The page reads it for "changed by School-Admin [name], [date]".
--   3. An audit trigger on both tables: a write by anyone but the lead records
--      admissions_lists_override / admissions_entry_points_override in platform_audit_log, with
--      who (actor_profile_id), and what changed (detail). People -> Admissions history lists them.
--      An update that changes nothing (the entry-point save re-upserts every row) isn't recorded.
--   4. admissions_can_edit_lists(school_account_id): the page asks it whether to open setup. Before
--      this migration it doesn't exist and the page falls back to "the lead only", so the app works
--      before and after it is applied.
-- Safe to re-run. Test: supabase/tests/v07_admissions_rls_pglite.mjs (the "2b" section).

-- 1. The write policies -----------------------------------------------------------------
drop policy if exists admissions_entry_points_write on public.admissions_entry_points;
create policy admissions_entry_points_write on public.admissions_entry_points
    for all using (public.is_admissions_lead_of(school_account_id) or public.is_school_admin_or_holder(school_account_id))
    with check (public.is_admissions_lead_of(school_account_id) or public.is_school_admin_or_holder(school_account_id));

drop policy if exists admissions_lists_write on public.admissions_lists;
create policy admissions_lists_write on public.admissions_lists
    for all using (public.is_admissions_lead_of(school_account_id) or public.is_school_admin_or_holder(school_account_id))
    with check (public.is_admissions_lead_of(school_account_id) or public.is_school_admin_or_holder(school_account_id));

-- 2. Whose kind of write it was ------------------------------------------------------------
alter table public.admissions_entry_points add column if not exists updated_by_kind text check (updated_by_kind in ('lead', 'school_admin'));
alter table public.admissions_lists add column if not exists updated_by_kind text check (updated_by_kind in ('lead', 'school_admin'));

-- The writer is the lead (a School-Admin who is also the lead writes as the lead), else the
-- School-Admin; null for a write with no user (the service role, scripts).
create or replace function public.admissions_writer_kind(p_school_account_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when auth.uid() is null then null
        when public.is_admissions_lead_of(p_school_account_id) then 'lead'
        else 'school_admin'
    end;
$$;
revoke execute on function public.admissions_writer_kind(uuid) from public, anon, authenticated;

create or replace function public.stamp_admissions_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_by := auth.uid();
    new.updated_at := now();
    new.updated_by_kind := public.admissions_writer_kind(new.school_account_id);
    return new;
end;
$$;

-- 3. The override audit ---------------------------------------------------------------------
create or replace function public.audit_admissions_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row record;
    v_action text := case when tg_table_name = 'admissions_lists' then 'admissions_lists_override' else 'admissions_entry_points_override' end;
    v_detail jsonb;
    v_changed text[];
begin
    if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
    if auth.uid() is null or public.is_admissions_lead_of(v_row.school_account_id) then
        return null;
    end if;
    v_detail := jsonb_build_object('op', lower(tg_op), 'entry_point', v_row.entry_point);
    if tg_table_name = 'admissions_lists' then
        v_detail := v_detail || jsonb_build_object('list_id', v_row.id, 'kind', v_row.kind, 'rung', v_row.rung);
        if tg_op = 'UPDATE' then
            select coalesce(array_agg(f order by f), '{}') into v_changed from unnest(array['members', 'fuzzy', 'la_blend', 'confirmed']) f
            where (to_jsonb(new) -> f) is distinct from (to_jsonb(old) -> f);
            if cardinality(v_changed) = 0 then
                return null;
            end if;
            v_detail := v_detail || jsonb_build_object('changed', v_changed,
                'added', (select coalesce(jsonb_agg(u order by u), '[]') from unnest(new.members) u where not u = any(old.members)),
                'removed', (select coalesce(jsonb_agg(u order by u), '[]') from unnest(old.members) u where not u = any(new.members)));
        elsif tg_op = 'INSERT' then
            v_detail := v_detail || jsonb_build_object('members', cardinality(new.members));
        end if;
    else
        if tg_op = 'UPDATE' then
            if new.entry_point is not distinct from old.entry_point and new.sort_order is not distinct from old.sort_order then
                return null;
            end if;
            v_detail := v_detail || jsonb_build_object('changed', array['sort_order'], 'from', old.sort_order, 'to', new.sort_order);
        end if;
    end if;
    perform public.log_admissions_action(v_action, v_row.school_account_id, v_detail);
    return null;
end;
$$;

drop trigger if exists admissions_lists_audit_override on public.admissions_lists;
create trigger admissions_lists_audit_override
    after insert or update or delete on public.admissions_lists
    for each row execute function public.audit_admissions_override();
drop trigger if exists admissions_entry_points_audit_override on public.admissions_entry_points;
create trigger admissions_entry_points_audit_override
    after insert or update or delete on public.admissions_entry_points
    for each row execute function public.audit_admissions_override();

-- 4. May the caller edit setup? (the lead, or the School-Admin)
create or replace function public.admissions_can_edit_lists(p_school_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admissions_lead_of(p_school_account_id) or public.is_school_admin_or_holder(p_school_account_id);
$$;
revoke execute on function public.admissions_can_edit_lists(uuid) from public, anon;
grant execute on function public.admissions_can_edit_lists(uuid) to authenticated;
