-- VicData 0.6 snagging round 2, item A: "Try VicData as…" (Guy x school x role trials).
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v06_snag2_trials_pglite.mjs), NOT APPLIED. Apply:
--   supabase db query --linked -f supabase/migrations/20261105090000_v06_snag2_trials.sql
--   supabase migration repair --status applied 20261105090000 --linked
--
-- A trial is a platform admin (Guy) trying VicData as one role at one school, with no
-- membership. Everything the trial saves is Guy's own row, keyed by the trial's STATE KEY
-- "<urn>~trial~<role>" (src/lib/trial.ts):
--   * teacher_view_preferences / teacher_view_notes / teacher_view_onboarding and
--     dashboard_user_state already key on school_urn TEXT with no FK (audit Part C §6), so
--     the trial writes the state key there. No schema change for those.
--   * personal dashboards and meetings (dashboards, owner_scope 'user') and recruitment_jobs
--     have no school column, so they get a nullable trial_key: null on every existing and
--     every normal row; the app lists `trial_key is null` normally and `= state key` in a
--     trial.
--
-- Additive only: two nullable columns, one new table, one new function. No existing row,
-- policy or function changes; existing RLS (profile_id = auth.uid(), owner_profile_id =
-- auth.uid()) already confines every trial row to Guy.

-- 1. trial_key on personal dashboards/meetings and recruitment jobs ----------------------

alter table public.dashboards add column if not exists trial_key text;
-- Only a personal row (dashboard or meeting) can belong to a trial; VicData and school rows
-- are never trial state. Every existing row has trial_key null, so this validates as-is.
alter table public.dashboards drop constraint if exists dashboards_trial_key_personal;
alter table public.dashboards add constraint dashboards_trial_key_personal check (trial_key is null or owner_scope = 'user');
create index if not exists dashboards_trial_key_idx on public.dashboards (owner_profile_id, trial_key) where trial_key is not null;

alter table public.recruitment_jobs add column if not exists trial_key text;

-- 2. trial_contexts: which trials Guy has started ("Recently tried", and whether "Start
--    fresh" is ticked by default: it is when there is no row yet) ----------------------

create table if not exists public.trial_contexts (
    profile_id uuid not null references public.profiles (id) on delete cascade,
    school_urn text not null check (school_urn ~ '^[A-Za-z0-9-]{1,20}$'),
    role text not null check (role in ('teacher', 'smt', 'admissions', 'school_admin')),
    state_key text generated always as (school_urn || '~trial~' || role) stored,
    started_at timestamptz not null default now(),
    last_used_at timestamptz not null default now(),
    primary key (profile_id, school_urn, role)
);
create index if not exists trial_contexts_recent_idx on public.trial_contexts (profile_id, last_used_at desc);

alter table public.trial_contexts enable row level security;
drop policy if exists trial_contexts_own_platform on public.trial_contexts;
create policy trial_contexts_own_platform on public.trial_contexts
    for all
    using (profile_id = auth.uid() and public.is_platform_admin())
    with check (profile_id = auth.uid() and public.is_platform_admin());

-- 3. reset_trial: "Start fresh" -- clears the caller's walkthrough and saved state for one
--    trial (its state key), so the 4-step walkthroughs run again. Trial dashboards,
--    meetings and recruitment jobs are kept (they are things made, not state). Touches only
--    the caller's own rows with that exact state key: Guy's normal rows (real URNs) and
--    every other person's rows are out of reach by construction.

create or replace function public.reset_trial(p_urn text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text;
begin
    if not public.is_platform_admin() then
        raise exception 'platform admin only';
    end if;
    if p_urn is null or p_urn !~ '^[A-Za-z0-9-]{1,20}$' or p_role not in ('teacher', 'smt', 'admissions', 'school_admin') then
        raise exception 'unknown trial';
    end if;
    v_key := p_urn || '~trial~' || p_role;
    delete from public.teacher_view_preferences where profile_id = auth.uid() and school_urn = v_key;
    delete from public.teacher_view_notes where profile_id = auth.uid() and school_urn = v_key;
    delete from public.teacher_view_onboarding where profile_id = auth.uid() and school_urn = v_key;
    delete from public.dashboard_user_state where profile_id = auth.uid() and school_urn = v_key;
end;
$$;
revoke execute on function public.reset_trial(text, text) from public, anon;
grant execute on function public.reset_trial(text, text) to authenticated;
