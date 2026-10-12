-- VicData 0.7 admissions round 2, D1: guard the 0.6 S1 trigger's claims cast.
--
-- public.sync_membership_roles() (20261103090000_v06_s1_roles_teams_platform.sql) reads
--     current_setting('request.jwt.claims', true)::jsonb
-- In a session where the claims setting has been set and then reset (a transaction-local
-- set_config that has ended, or a pooled connection that served a request before), Postgres
-- returns '' rather than NULL, and ''::jsonb raises "invalid input syntax for type json". Every
-- insert or update on school_memberships in that session then fails. Found in round 1's review
-- (admissions_r1_report_v1.md §4); round 1's own functions already read the setting as
-- nullif(..., '').
--
-- The one change: nullif(current_setting('request.jwt.claims', true), '')::jsonb. Everything else
-- is the S1 function as applied, line for line. The trigger (school_memberships_sync_roles) keeps
-- pointing at the function, so it is not recreated. Safe to re-run.
--
-- Test: supabase/tests/v07_sync_roles_nullif_pglite.mjs (before and after, on PGlite).
create or replace function public.sync_membership_roles()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_is_service boolean := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
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
