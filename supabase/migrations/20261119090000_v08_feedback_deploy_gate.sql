-- VicData 0.8 feedback deploy gate (docs/v0.8/vicdata_0_8_feedback_deploy_gate_claude_code_prompt_v1.md):
-- feedback closes on the live site, not on merge. Written and tested in PGlite
-- (supabase/tests/v08_feedback_deploy_gate_pglite.mjs); Guy applies it. Safe to run twice.
--
--   * statuses: new -> triaged -> planned -> fixed -> deployed -> done, or won't do.
--       fixed     merged to main, with resolved_commit (the report's "set fixed" step);
--       deployed  the live build contains resolved_commit -- set by the server only (record_app_build),
--                 stamped deployed_at and deployed_build;
--       done      checked on the live site: a platform admin's "Looks good" on the same view and school
--                 after deployed_at (automatic), or the inbox's "Checked live" (checked_live_at).
--   * follows_up: a follow-up raised when a triage covers less than the author asked ("Not covered:").
--   * app_builds: one row per build the server has run as (commit, its commit list); platform admins read,
--     nobody writes from the client. record_app_build() is the service role's only.
--   * feedback_for_triage gains deployed_at, deployed_build, checked_live_at, follows_up and
--     follows_up_ref, appended, so its existing columns are untouched.
--   * feedback_deploy_gaps: items that claim more than the live build has.
--   * backfill: F-12 to F-21 (planned, "deploy 6bddb6d") to fixed at 6bddb6d; F-22 and F-23/F-26 become
--     the follow-ups of F-17 and F-15, whose triage notes gain their "Not covered:" lines.

-- ------------------------------------------------------------------------------- the columns

alter table public.feedback_items add column if not exists deployed_at timestamptz;
alter table public.feedback_items add column if not exists deployed_build text check (length(deployed_build) <= 64);
alter table public.feedback_items add column if not exists checked_live_at timestamptz;
alter table public.feedback_items add column if not exists follows_up uuid references public.feedback_items (id) on delete set null;

alter table public.feedback_items drop constraint if exists feedback_items_status_check;
alter table public.feedback_items add constraint feedback_items_status_check
  check (status in ('new', 'triaged', 'planned', 'fixed', 'deployed', 'done', 'wont_do'));

alter table public.feedback_items drop constraint if exists feedback_items_not_own_follow_up;
alter table public.feedback_items add constraint feedback_items_not_own_follow_up check (follows_up is null or follows_up <> id);

create index if not exists feedback_items_fixed_idx on public.feedback_items (resolved_commit) where status = 'fixed';
create index if not exists feedback_items_deployed_idx on public.feedback_items (view_key, deployed_at) where status = 'deployed';

-- The triage fields: the only ones that change after an item is sent (now with the deploy and the follow-up).
create or replace function public.feedback_items_triage_columns()
returns text[]
language sql
immutable
as $$ select array['type', 'priority', 'status', 'planned_version', 'resolved_commit', 'resolved_at', 'wont_do_reason', 'duplicate_of', 'triage_note', 'triaged_by', 'triaged_at', 'updated_at',
                   'deployed_at', 'deployed_build', 'checked_live_at', 'follows_up'] $$;

-- On insert: as before, and the new triage fields start empty too.
create or replace function public.feedback_items_on_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  new.status := 'new';
  new.type := null; new.priority := null; new.planned_version := null; new.resolved_commit := null;
  new.resolved_at := null; new.wont_do_reason := null; new.duplicate_of := null; new.triage_note := null;
  new.triaged_by := null; new.triaged_at := null;
  new.deployed_at := null; new.deployed_build := null; new.checked_live_at := null; new.follows_up := null;
  new.created_at := now(); new.updated_at := now();
  new.looks_good := new.looks_good or 'looks_good' = any (new.kinds);
  return new;
end;
$$;

-- On update: platform admins only, triage fields only. The server's own moves (deployed, and done by a
-- live "Looks good") set vicdata.feedback_auto, so they don't count as someone's triage.
create or replace function public.feedback_items_on_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_fixed text[] := public.feedback_items_triage_columns();
  v_auto boolean := coalesce(current_setting('vicdata.feedback_auto', true), '') = 'on';
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'feedback: only a platform admin can triage an item' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_fixed) is distinct from (to_jsonb(old) - v_fixed) then
    raise exception 'feedback: an item can''t be changed once sent; only its triage fields' using errcode = '42501';
  end if;
  -- Only the server marks an item deployed: it is a fact about the live build, not a choice.
  if new.status = 'deployed' and old.status <> 'deployed' and not v_auto then
    raise exception 'feedback: "deployed" is set by the live build (record_app_build), not by hand' using errcode = '42501';
  end if;
  new.updated_at := now();
  if not v_auto and (new.type, new.priority, new.status, new.planned_version, new.resolved_commit, new.wont_do_reason, new.duplicate_of, new.triage_note, new.follows_up)
     is distinct from (old.type, old.priority, old.status, old.planned_version, old.resolved_commit, old.wont_do_reason, old.duplicate_of, old.triage_note, old.follows_up) then
    new.triaged_by := coalesce(auth.uid(), new.triaged_by);
    new.triaged_at := now();
  end if;
  -- fixed: the date it was merged, if none is given. done: checked live, stamped.
  if new.status = 'fixed' and old.status <> 'fixed' and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  if new.status = 'done' and old.status <> 'done' then
    if new.resolved_at is null then new.resolved_at := now(); end if;
    if new.checked_live_at is null then new.checked_live_at := now(); end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------------------- the builds

create table if not exists public.app_builds (
  commit text primary key check (length(commit) between 7 and 64),
  first_seen_at timestamptz not null default now(),
  -- When a server last started as this build: the newest row is the live build (a rollback included).
  last_seen_at timestamptz not null default now(),
  built_at timestamptz,
  -- The build's own history, 12-character shas, newest first; null when the build had none to list.
  commits text[]
);
alter table public.app_builds enable row level security;
drop policy if exists app_builds_select_admin on public.app_builds;
create policy app_builds_select_admin on public.app_builds for select to authenticated using (public.is_platform_admin());
revoke all on public.app_builds from anon;
revoke insert, update, delete, truncate on public.app_builds from authenticated;
grant select on public.app_builds to authenticated;

-- Does a build's history hold a commit? Either may be short (resolved_commit is often 7 characters, the
-- list 12): a prefix match either way, never under 7 characters.
create or replace function public.build_has_commit(p_commit text, p_build_commit text, p_commits text[])
returns boolean
language sql
immutable
as $$
  select length(coalesce(p_commit, '')) >= 7 and (
    p_build_commit like p_commit || '%' or p_commit like p_build_commit || '%'
    or exists (select 1 from unnest(coalesce(p_commits, '{}'::text[])) c where c like p_commit || '%' or p_commit like c || '%')
  );
$$;

-- The server records the build it runs as (once per process, src/lib/app-build-server.ts) and promotes
-- every fixed item whose commit that build holds to deployed. Idempotent; returns how many moved.
-- The service role's only: a member's session can't claim a build.
create or replace function public.record_app_build(p_commit text, p_commits text[] default null, p_built_at timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commit text := lower(btrim(coalesce(p_commit, '')));
  v_commits text[];
  v_moved int;
begin
  if length(v_commit) < 7 or v_commit !~ '^[0-9a-f]+$' then
    raise exception 'record_app_build: % is not a commit', p_commit using errcode = '22023';
  end if;
  v_commits := (select array_agg(lower(c)) from unnest(p_commits) c where c ~* '^[0-9a-f]{7,64}$');
  insert into public.app_builds (commit, commits, built_at) values (v_commit, v_commits, p_built_at)
  on conflict (commit) do update set last_seen_at = now(),
    commits = coalesce(excluded.commits, public.app_builds.commits),
    built_at = coalesce(excluded.built_at, public.app_builds.built_at);
  perform set_config('vicdata.feedback_auto', 'on', true);
  update public.feedback_items f set status = 'deployed', deployed_at = now(), deployed_build = v_commit
  where f.status = 'fixed' and public.build_has_commit(f.resolved_commit, v_commit, v_commits);
  get diagnostics v_moved = row_count;
  perform set_config('vicdata.feedback_auto', '', true);
  raise log 'record_app_build %: % fixed item(s) moved to deployed', v_commit, v_moved;
  return v_moved;
end;
$$;
revoke execute on function public.record_app_build(text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.record_app_build(text, text[], timestamptz) to service_role;

-- ------------------------------------------------------------------------------- done, live

-- A platform admin's "Looks good" on a view at a school closes every deployed item on that view and school
-- deployed before it (R-FEEDBACK-LIVE-CHECK). Security definer: it moves other items, by rule.
create or replace function public.feedback_items_live_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.looks_good or new.author_id is null or not exists (select 1 from public.platform_admins where profile_id = new.author_id) then
    return null;
  end if;
  perform set_config('vicdata.feedback_auto', 'on', true);
  update public.feedback_items f set status = 'done', checked_live_at = new.created_at
  where f.status = 'deployed' and f.id <> new.id and f.view_key = new.view_key
    and coalesce(f.school_urn, f.group_id) = coalesce(new.school_urn, new.group_id)
    and f.deployed_at <= new.created_at;
  perform set_config('vicdata.feedback_auto', '', true);
  return null;
end;
$$;
revoke execute on function public.feedback_items_live_check() from public, anon, authenticated;
drop trigger if exists feedback_items_live_check on public.feedback_items;
create trigger feedback_items_live_check after insert on public.feedback_items for each row execute function public.feedback_items_live_check();

-- ------------------------------------------------------------------------------- the views

create or replace view public.feedback_for_triage with (security_invoker = true) as
select
  'F-' || f.number as ref,
  f.number,
  f.id,
  to_char(f.created_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') as created_london,
  f.created_at,
  coalesce(public.feedback_author_name(f.author_id), '(deleted)') as author_name,
  f.author_id,
  f.view_as,
  f.role,
  f.product,
  coalesce(f.school_name, f.group_name) as school_or_group,
  f.school_urn,
  f.school_name,
  f.group_id,
  f.group_ref,
  f.group_name,
  f.dashboard_id,
  f.dashboard_name,
  f.dashboard_version_id,
  f.panel_id,
  f.panel_name,
  f.view_instance_id,
  f.dataview_id,
  f.view_label,
  f.view_key,
  f.state,
  f.page_path,
  f.page_query,
  f.app_version,
  f.device,
  f.viewport_width,
  f.theme,
  f.body,
  f.looks_good,
  f.kinds,
  f.importance,
  f.scope,
  f.applies_to,
  f.saw,
  f.expected,
  f.where_in_view,
  f.type,
  f.priority,
  f.status,
  f.planned_version,
  f.resolved_commit,
  f.resolved_at,
  f.wont_do_reason,
  case when d.number is not null then 'F-' || d.number end as duplicate_of_ref,
  f.duplicate_of,
  f.triage_note,
  f.triaged_at,
  f.updated_at,
  -- Open until done (fixed and deployed are still open: the author's icon stays yellow until it is checked).
  (f.status not in ('done', 'wont_do') and (btrim(f.body) <> '' or not f.looks_good or exists (select 1 from unnest(f.kinds) k where k <> 'looks_good'))) as is_open,
  f.area,
  (f.panel_id is null) as is_page,
  -- The deploy gate.
  f.deployed_at,
  f.deployed_build,
  f.checked_live_at,
  f.follows_up,
  case when u.number is not null then 'F-' || u.number end as follows_up_ref
from public.feedback_items f
left join public.feedback_items d on d.id = f.duplicate_of
left join public.feedback_items u on u.id = f.follows_up;

-- Items that claim more than the live build (the newest app_builds row) has: deployed or done at a commit
-- the live build doesn't hold, or fixed for more than 48 hours and not yet deployed.
create or replace view public.feedback_deploy_gaps with (security_invoker = true) as
with live as (
  select b.commit, b.commits, b.last_seen_at from public.app_builds b order by b.last_seen_at desc, b.first_seen_at desc limit 1
)
select
  t.ref,
  t.number,
  t.id,
  t.status,
  t.resolved_commit,
  t.resolved_at,
  t.deployed_build,
  live.commit as live_build,
  case when t.status = 'fixed' then 'fixed, not deployed after 48 hours' else 'not in the live build' end as gap,
  t.dashboard_name,
  t.view_label,
  t.school_or_group
from public.feedback_for_triage t
cross join live
where (t.status in ('deployed', 'done') and t.resolved_commit is not null
       and not public.build_has_commit(t.resolved_commit, live.commit, live.commits))
   or (t.status = 'fixed' and coalesce(t.resolved_at, t.triaged_at, t.updated_at) < now() - interval '48 hours');

revoke all on public.feedback_for_triage from anon;
revoke all on public.feedback_deploy_gaps from anon;
grant select on public.feedback_for_triage to authenticated;
grant select on public.feedback_deploy_gaps to authenticated;

-- ------------------------------------------------------------------------------- backfill

-- F-12 to F-21: reopened on 6 Nov as planned "deploy 6bddb6d"; merged in 6bddb6d on 30 Oct. Now fixed
-- (the first build that records itself with 6bddb6d in its history moves them to deployed). Only those
-- still planned under that marker, so a second run, or an item closed meanwhile (F-15), is left alone.
update public.feedback_items
set status = 'fixed', resolved_commit = '6bddb6d', resolved_at = coalesce(resolved_at, '2026-10-30T09:11:59Z')
where number between 12 and 21 and status = 'planned' and planned_version = 'deploy 6bddb6d';

-- The scope rule, applied backwards once. F-17 asked for "all table views"; round 1 left out SMT, the Data
-- View, the public page, Teacher KS2 and the groups' member tables (OPEN_QUESTIONS 22 to 26, round 1).
-- F-15 was built for 11+; at 16+ the local shape still drew the primaries. F-22 and F-23 (with F-26, the
-- same request) asked again, so they are the follow-ups: no new items are raised.
update public.feedback_items
set triage_note = coalesce(triage_note || E'\n', '') || 'Not covered: SMT tables, the Data View (Rankings, Graphs'' tables, the deep dive), the public school page, Teacher KS2, the groups'' per-member tables (round 1, OPEN_QUESTIONS 22-26). Follow-up: F-22.'
where number = 17 and coalesce(triage_note, '') not like '%Not covered:%';
update public.feedback_items
set triage_note = coalesce(triage_note || E'\n', '') || 'Not covered: the 16+ intake (the local shape and feeder cards still the primaries, ages 4-10). Follow-up: F-23 (with F-26).'
where number = 15 and coalesce(triage_note, '') not like '%Not covered:%';

update public.feedback_items f
set follows_up = p.id,
    status = case when f.status = 'new' then 'triaged' else f.status end,
    triage_note = case when coalesce(f.triage_note, '') like '%Follows up F-17%' then f.triage_note
                       else coalesce(f.triage_note || E'\n', '') || 'Follows up F-17 (not covered there: SMT, the Data View, the public page, Teacher KS2, group member tables). Prompt: vicdata_0_8_feedback_deploy_gate item 6.' end
from public.feedback_items p
where f.number = 22 and p.number = 17 and f.follows_up is null;
update public.feedback_items f
set follows_up = p.id,
    triage_note = case when coalesce(f.triage_note, '') like '%Follows up F-15%' then f.triage_note
                       else coalesce(f.triage_note || E'\n', '') || 'Follows up F-15 (not covered there: the 16+ intake).' end
from public.feedback_items p
where f.number in (23, 26) and p.number = 15 and f.follows_up is null;
