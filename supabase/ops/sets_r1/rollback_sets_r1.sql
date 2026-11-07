-- ROLLBACK for 20261121090000_v08_sets_r1 (VicData 0.8 sets round 1). PREPARED, NOT RUN.
--
-- Undoes exactly what the migration created, and nothing else:
--   triggers (8), policies (9), functions (16, incl. save_set), tables sets / set_members /
--   set_user_state, and the schema_migrations row.
-- No function is restored: on 7 Nov none of the 16 functions, 8 triggers, 3 tables or a type of
-- those names existed in production (checked read-only, any schema), so nothing was replaced.
--
-- Not touched: admissions_lists, saved_sets, saved_set_members (the migration only read them), and
-- platform_audit_log (any admissions_lists_override rows a School-Admin's edit wrote stay as history).
--
-- DATA LOSS: every row in sets / set_members / set_user_state goes, including any set made or edited
-- on the live site after the deploy. Only the 6 converted lists can be rebuilt (by re-running the
-- migration); anything else would be gone. The notice below prints the counts first.
--
-- One transaction, no CASCADE: if anything unexpected has come to depend on these objects, it
-- fails and changes nothing, instead of quietly dropping more.
--
-- Roll back the app first: the deployed sets code reads these tables, so redeploy the pre-merge
-- main before running this, or the live pages will error.
--
-- Run (after the project-ref check):
--   supabase db query --remote --yes -f supabase/ops/sets_r1/rollback_sets_r1.sql

begin;

do $$
declare n_sets int; n_new int; n_members int; n_state int;
begin
    if to_regclass('public.sets') is null then
        raise notice 'sets does not exist: nothing to roll back for the tables';
        return;
    end if;
    select count(*), count(*) filter (where legacy_list_id is null and legacy_saved_set_id is null) into n_sets, n_new from public.sets;
    select count(*) into n_members from public.set_members;
    select count(*) into n_state from public.set_user_state;
    raise notice 'dropping: % sets (% not from the conversion), % set_members, % set_user_state rows', n_sets, n_new, n_members, n_state;
end $$;

-- 1. Triggers
drop trigger if exists set_members_audit_update on public.set_members;
drop trigger if exists set_members_audit_delete on public.set_members;
drop trigger if exists set_members_audit_insert on public.set_members;
drop trigger if exists set_members_touch on public.set_members;
drop trigger if exists sets_audit_override on public.sets;
drop trigger if exists sets_stamp on public.sets;
drop trigger if exists sets_personal_cap on public.sets;
drop trigger if exists sets_creator_check on public.sets;

-- 2. Policies
drop policy if exists set_user_state_own on public.set_user_state;
drop policy if exists set_members_delete on public.set_members;
drop policy if exists set_members_update on public.set_members;
drop policy if exists set_members_insert on public.set_members;
drop policy if exists set_members_select on public.set_members;
drop policy if exists sets_delete on public.sets;
drop policy if exists sets_update on public.sets;
drop policy if exists sets_insert on public.sets;
drop policy if exists sets_select on public.sets;

-- 3. Functions that use the sets row type or the tables (before the tables: set_audit_detail takes
--    a public.sets argument, so the table can't go while it exists)
drop function if exists public.save_set(uuid, jsonb, jsonb);
drop function if exists public.audit_set_members_insert();
drop function if exists public.audit_set_members_delete();
drop function if exists public.audit_set_members_update();
drop function if exists public.audit_set_members_apply(jsonb, jsonb);
drop function if exists public.audit_set_override();
drop function if exists public.set_audit_detail(public.sets, text);
drop function if exists public.touch_set_from_members();
drop function if exists public.stamp_set_change();
drop function if exists public.enforce_personal_set_cap();
drop function if exists public.check_set_creator();
drop function if exists public.can_write_set(uuid);
drop function if exists public.can_read_set(uuid);

-- 4. Tables (set_members references sets)
drop table if exists public.set_user_state;
drop table if exists public.set_members;
drop table if exists public.sets;

-- 5. Helpers (new in this migration; nothing else in production calls them)
drop function if exists public.is_set_override(uuid, text);
drop function if exists public.can_curate_sets(uuid, text);
drop function if exists public.has_school_role(uuid, text);

-- 6. The migration record
delete from supabase_migrations.schema_migrations where version = '20261121090000';

commit;
