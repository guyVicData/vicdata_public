-- PROPOSED, NOT APPLIED. For Guy to review (night 1 build report, "Stops and holes").
--
-- The S0 audit (docs/v0.6/audit_v1.md §8.7) found that `school_memberships_insert_own`
-- checks only `profile_id = auth.uid()`. Any signed-in user can therefore POST straight to
-- PostgREST, bypassing join_school, and insert an `approved`, `is_admin = true`
-- membership in ANY school: member reads (shared saved sets, colleagues' emails) and
-- admin writes. `school_accounts_insert_authenticated` similarly lets anyone create an
-- account row with arbitrary holder fields.
--
-- Every legitimate creation path already goes through SECURITY DEFINER functions
-- (join_school) or the service role (testing switcher, preview session), neither of
-- which is bound by these policies. So tightening them removes no legitimate path. It is
-- still an RLS change on memberships, which the night-1 prompt lists as a stop, hence
-- written up rather than applied.
--
-- 0.6 S1 already closes the role half: the sync trigger forces roles = {teacher} on any
-- non-service-role insert. This closes the status / is_admin half.

begin;

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

-- The remaining SECURITY DEFINER functions without a fixed search_path.
alter function public.check_school_has_member(text) set search_path = public;
alter function public.initiate_account_holder_handoff set search_path = public;
alter function public.accept_account_holder_handoff set search_path = public;

commit;
