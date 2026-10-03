-- VicData 0.6 night 2, S3b fix 1: close the membership INSERT hole (audit C §8.7.3;
-- approved by Guy, OPEN_QUESTIONS 2026-10-03 "Guy's decisions after night 1" item 1).
--
-- WRITTEN AND TESTED LOCALLY, NOT APPLIED. Apply:
--   supabase db query --linked -f supabase/migrations/20261104090000_v06_membership_insert_hardening.sql
--   supabase migration repair --status applied 20261104090000 --linked
--
-- Before: `school_memberships_insert_own` checked only profile_id = auth.uid(), so anyone
-- signed in could POST an approved, is_admin membership into any school, bypassing
-- join_school. `school_accounts_insert_authenticated` likewise let anyone create an account
-- with its holder fields set.
-- After: a direct insert can only be the caller's own PENDING, non-admin request. Every
-- legitimate path is unaffected: join_school is SECURITY DEFINER (owner, not bound by these
-- policies), and the preview route uses the service role. Existing rows are untouched.

drop policy if exists school_memberships_insert_own on public.school_memberships;
create policy school_memberships_insert_own on public.school_memberships
    for insert with check (
        profile_id = auth.uid()
        and status in ('pending_verification', 'pending_approval')
        and is_admin = false
        and approved_at is null
        and approved_by is null
    );

drop policy if exists school_accounts_insert_authenticated on public.school_accounts;
create policy school_accounts_insert_authenticated on public.school_accounts
    for insert with check (
        auth.uid() is not null
        and account_holder_membership_id is null
        and pending_account_holder_membership_id is null
    );

-- The remaining SECURITY DEFINER functions without a fixed search_path (whatever their
-- argument lists).
do $$
declare
    f regprocedure;
begin
    for f in
        select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and p.proname in ('check_school_has_member', 'initiate_account_holder_handoff', 'accept_account_holder_handoff')
    loop
        execute format('alter function %s set search_path = public', f);
    end loop;
end $$;
