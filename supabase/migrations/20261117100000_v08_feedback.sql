-- VicData 0.8 notes and feedback (decision 4): the start of a feedback system.
--
-- Guy (later beta testers, then every member) gives feedback on any view as he goes. Each item records
-- enough to find exactly what it is about (what was being looked at, the page's state, the address, the
-- app version); Claude reads the items read-only through feedback_for_triage, proposes a triage, and
-- turns them into the to-do list (docs/FEEDBACK.md). Platform admins triage them in /platform/feedback.
--
--   app_settings            one row per setting; 'feedback_audience' = "admins" | "beta" | "all".
--                           Read by the server (feedback_audience(), feedback_allowed()); changed by SQL.
--   feedback_beta_testers   the named beta testers the "beta" setting lets in (0.14).
--   feedback_items          the items. F-{number} is the short human number.
--   feedback_for_triage     every field, with readable names and London date and time (Claude, the inbox).
--   feedback_coverage       per dashboard x view x school or group: looks good, open or none, with dates.
--
-- Privacy: an item is read by its author and by platform admins only -- never by the author's school
-- or group (no school-scoped policy exists). It is separate from private notes, and never counted as
-- usage. Authors can't edit or delete an item once sent; they add another. Only platform admins change
-- the triage fields, and nobody changes what was recorded.
--
-- Safe to run twice.

-- ------------------------------------------------------------------------------- the setting

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_select_admin on public.app_settings;
create policy app_settings_select_admin on public.app_settings for select to authenticated using (public.is_platform_admin());
revoke all on public.app_settings from anon;
revoke insert, update, delete on public.app_settings from authenticated;
grant select on public.app_settings to authenticated;

insert into public.app_settings (key, value) values ('feedback_audience', '"admins"') on conflict (key) do nothing;

create table if not exists public.feedback_beta_testers (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.feedback_beta_testers enable row level security;
drop policy if exists feedback_beta_testers_select_admin on public.feedback_beta_testers;
create policy feedback_beta_testers_select_admin on public.feedback_beta_testers for select to authenticated using (public.is_platform_admin());
revoke all on public.feedback_beta_testers from anon;
revoke insert, update, delete on public.feedback_beta_testers from authenticated;
grant select on public.feedback_beta_testers to authenticated;

-- The audience, "admins" when the row is missing or not one of the three.
create or replace function public.feedback_audience()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select case when value #>> '{}' in ('admins', 'beta', 'all') then value #>> '{}' end from public.app_settings where key = 'feedback_audience'), 'admins');
$$;

-- May the caller give feedback? admins: platform admins; beta: they and the named testers; all: anyone
-- signed in.
create or replace function public.feedback_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and case public.feedback_audience()
    when 'all' then true
    when 'beta' then public.is_platform_admin() or exists (select 1 from public.feedback_beta_testers where profile_id = auth.uid())
    else public.is_platform_admin()
  end;
$$;
revoke execute on function public.feedback_audience() from public, anon;
revoke execute on function public.feedback_allowed() from public, anon;
grant execute on function public.feedback_audience() to authenticated;
grant execute on function public.feedback_allowed() to authenticated;

-- ------------------------------------------------------------------------------- the items

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity unique,
  created_at timestamptz not null default now(),
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Whether the author was in View as (or a peek), and the role the page was drawn for.
  view_as boolean not null default false,
  role text,
  -- What was being looked at.
  product text not null check (product in ('teacher', 'smt', 'admissions', 'group', 'meeting', 'custom')),
  school_urn text,
  school_name text,
  group_id text,
  group_ref text,
  group_name text,
  dashboard_id text not null,
  dashboard_name text,
  dashboard_version_id text,
  panel_id text,
  panel_name text,
  view_instance_id text,
  dataview_id text,
  view_label text,
  view_key text not null,
  -- The page's state: subject, level, comparison set, year, phase, filters and pills.
  state jsonb not null default '{}'::jsonb,
  page_path text,
  page_query text,
  app_version text,
  device text check (device in ('phone', 'desktop')),
  viewport_width int,
  theme text check (theme in ('light', 'dark')),
  -- What the author said. An item needs text or "Looks good".
  body text not null default '' check (length(body) <= 8000),
  looks_good boolean not null default false,
  kinds text[] not null default '{}' check (kinds <@ array['wrong_figure', 'wording', 'layout', 'missing', 'broken', 'idea', 'question', 'looks_good']::text[]),
  importance text check (importance in ('before_demo', 'should_fix', 'nice_to_have')),
  scope text check (scope in ('this_school', 'every_school', 'not_sure')),
  applies_to text check (applies_to in ('this_view', 'similar_views')),
  saw text check (length(saw) <= 500),
  expected text check (length(expected) <= 500),
  where_in_view text[] not null default '{}' check (where_in_view <@ array['title', 'figure', 'chart', 'table', 'legend', 'info', 'pills']::text[]),
  -- Triage (platform admins only).
  type text check (type in ('fix', 'data_question', 'wording', 'design', 'feature_request', 'praise', 'other')),
  priority text check (priority in ('high', 'normal', 'low')),
  status text not null default 'new' check (status in ('new', 'triaged', 'planned', 'done', 'wont_do')),
  planned_version text check (length(planned_version) <= 20),
  resolved_commit text check (length(resolved_commit) <= 64),
  resolved_at timestamptz,
  wont_do_reason text check (length(wont_do_reason) <= 2000),
  duplicate_of uuid references public.feedback_items (id) on delete set null,
  triage_note text check (length(triage_note) <= 4000),
  triaged_by uuid references public.profiles (id) on delete set null,
  triaged_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint feedback_items_text_or_looks_good check (btrim(body) <> '' or looks_good),
  constraint feedback_items_scope check (school_urn is not null or group_id is not null),
  constraint feedback_items_not_own_duplicate check (duplicate_of is null or duplicate_of <> id)
);
create index if not exists feedback_items_author_idx on public.feedback_items (author_id, view_key);
create index if not exists feedback_items_status_idx on public.feedback_items (status, created_at desc);
create index if not exists feedback_items_view_idx on public.feedback_items (dashboard_id, view_key);

-- The triage fields: the only ones that change after an item is sent.
create or replace function public.feedback_items_triage_columns()
returns text[]
language sql
immutable
as $$ select array['type', 'priority', 'status', 'planned_version', 'resolved_commit', 'resolved_at', 'wont_do_reason', 'duplicate_of', 'triage_note', 'triaged_by', 'triaged_at', 'updated_at'] $$;

-- On insert: the author is the caller, and every triage field starts empty ("new").
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
  new.created_at := now(); new.updated_at := now();
  new.looks_good := new.looks_good or 'looks_good' = any (new.kinds);
  return new;
end;
$$;
drop trigger if exists feedback_items_on_insert on public.feedback_items;
create trigger feedback_items_on_insert before insert on public.feedback_items for each row execute function public.feedback_items_on_insert();

-- On update: platform admins only, triage fields only; who triaged and when are kept.
create or replace function public.feedback_items_on_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_fixed text[] := public.feedback_items_triage_columns();
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'feedback: only a platform admin can triage an item' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_fixed) is distinct from (to_jsonb(old) - v_fixed) then
    raise exception 'feedback: an item can''t be changed once sent; only its triage fields' using errcode = '42501';
  end if;
  new.updated_at := now();
  if (new.type, new.priority, new.status, new.planned_version, new.resolved_commit, new.wont_do_reason, new.duplicate_of, new.triage_note)
     is distinct from (old.type, old.priority, old.status, old.planned_version, old.resolved_commit, old.wont_do_reason, old.duplicate_of, old.triage_note) then
    new.triaged_by := coalesce(auth.uid(), new.triaged_by);
    new.triaged_at := now();
  end if;
  if new.status = 'done' and old.status <> 'done' and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_items_on_update on public.feedback_items;
create trigger feedback_items_on_update before update on public.feedback_items for each row execute function public.feedback_items_on_update();

alter table public.feedback_items enable row level security;
drop policy if exists feedback_items_insert_allowed on public.feedback_items;
create policy feedback_items_insert_allowed on public.feedback_items for insert to authenticated
  with check (author_id = auth.uid() and public.feedback_allowed());
drop policy if exists feedback_items_select_own_or_admin on public.feedback_items;
create policy feedback_items_select_own_or_admin on public.feedback_items for select to authenticated
  using (author_id = auth.uid() or public.is_platform_admin());
drop policy if exists feedback_items_update_admin on public.feedback_items;
create policy feedback_items_update_admin on public.feedback_items for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
-- No delete policy: nobody deletes through the API.
revoke all on public.feedback_items from anon;
revoke delete, truncate on public.feedback_items from authenticated;
grant select, insert, update on public.feedback_items to authenticated;

-- ------------------------------------------------------------------------------- for triage

-- The author's name for the triage view: profiles' RLS shows a member only their school's colleagues,
-- so this answers for the caller's own items and, for a platform admin (or the database's own role),
-- for anyone's -- and nothing else.
create or replace function public.feedback_author_name(p_profile uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_profile is null then '(deleted)'
    when auth.uid() is null or auth.uid() = p_profile or public.is_platform_admin()
      then (select coalesce(nullif(btrim(full_name), ''), email) from public.profiles where id = p_profile)
  end;
$$;
revoke execute on function public.feedback_author_name(uuid) from public, anon;
grant execute on function public.feedback_author_name(uuid) to authenticated;

-- Every field, with readable names. security_invoker: the caller's own RLS applies, so a member reads
-- their own items and a platform admin (and Claude, with the database's own role) all of them.
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
  -- Open: more than a bare "Looks good", not yet done or won't do.
  (f.status not in ('done', 'wont_do') and (btrim(f.body) <> '' or not f.looks_good or exists (select 1 from unnest(f.kinds) k where k <> 'looks_good'))) as is_open
from public.feedback_items f
left join public.feedback_items d on d.id = f.duplicate_of;

-- Per dashboard x view x school (or group): the latest state -- open beats looks good -- with dates.
-- Views nobody has given feedback on aren't rows here; the inbox's coverage tab lists every view of
-- every dashboard from the catalogue and marks those as unseen.
create or replace view public.feedback_coverage with (security_invoker = true) as
select
  t.dashboard_id,
  max(t.dashboard_name) as dashboard_name,
  t.panel_id,
  max(t.panel_name) as panel_name,
  t.view_instance_id,
  max(t.view_label) as view_label,
  t.view_key,
  coalesce(t.school_urn, t.group_id) as scope_id,
  max(t.school_or_group) as scope_name,
  case
    when bool_or(t.is_open) then 'open'
    when bool_or(t.looks_good and t.status <> 'wont_do') then 'looks good'
    else 'none'
  end as state,
  max(t.created_at) filter (where t.looks_good) as last_looks_good_at,
  max(t.created_at) filter (where t.is_open) as last_open_at,
  max(t.created_at) as last_item_at,
  count(*)::int as items,
  count(*) filter (where t.is_open)::int as open_items
from public.feedback_for_triage t
group by t.dashboard_id, t.panel_id, t.view_instance_id, t.view_key, coalesce(t.school_urn, t.group_id);

revoke all on public.feedback_for_triage from anon;
revoke all on public.feedback_coverage from anon;
grant select on public.feedback_for_triage to authenticated;
grant select on public.feedback_coverage to authenticated;
