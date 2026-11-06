-- VicData 0.8 Admissions feedback round 2, items 3 and 4
-- (docs/v0.8/vicdata_0_8_admissions_feedback_round2_claude_code_prompt_v1.md). Written and tested in PGlite
-- (supabase/tests/v08_feedback_resolved_views_pglite.mjs); Guy applies it. Safe to run twice. Needs
-- 20261119090000_v08_feedback_deploy_gate first.
--
--   * resolved_views text[]: the view keys a fix added or changed, beside the item's own (F-16 and F-21 were
--     fixed by new views, so their "Looks good" went on views the auto-close didn't look at). A triage field:
--     platform admins only, under the existing update rules; set by scripts/feedback-set-fixed.sh --view
--     and by the inbox. A new item starts with none.
--   * feedback_items_live_check: a platform admin's "Looks good" closes a deployed item when it is on the
--     item's own view OR on any of its resolved_views, at the same school, at or after deployed_at.
--   * feedback_for_triage gains resolved_views, appended (create or replace keeps the columns' order).
--   * the insert check (item 3, F-31): an item whose state and page_query disagree on the dashboard, the
--     entry point or the level is refused, with a message the feedback window shows.

-- ------------------------------------------------------------------------------- the column

alter table public.feedback_items add column if not exists resolved_views text[] not null default '{}';
alter table public.feedback_items drop constraint if exists feedback_items_resolved_views_check;
alter table public.feedback_items add constraint feedback_items_resolved_views_check
  check (cardinality(resolved_views) <= 50 and array_position(resolved_views, null) is null);

-- The triage fields, now with resolved_views.
create or replace function public.feedback_items_triage_columns()
returns text[]
language sql
immutable
set search_path = public
as $$ select array['type', 'priority', 'status', 'planned_version', 'resolved_commit', 'resolved_at', 'wont_do_reason', 'duplicate_of', 'triage_note', 'triaged_by', 'triaged_at', 'updated_at',
                   'deployed_at', 'deployed_build', 'checked_live_at', 'follows_up', 'resolved_views'] $$;

-- ------------------------------------------------------------------------------- the insert check

-- One parameter of a recorded address (URLSearchParams' encoding: '+' is a space, %XX a byte), or null.
create or replace function public.feedback_url_decode(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  s text := replace(p, '+', ' ');
  out bytea := ''::bytea;
  i int := 1;
  n int;
begin
  if p is null then return null; end if;
  n := length(s);
  while i <= n loop
    if substr(s, i, 1) = '%' and substr(s, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      out := out || decode(substr(s, i + 1, 2), 'hex');
      i := i + 3;
    else
      out := out || convert_to(substr(s, i, 1), 'UTF8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(out, 'UTF8');
exception when others then
  return s;
end;
$$;

create or replace function public.feedback_query_param(p_query text, p_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  part text;
begin
  if p_query is null or p_query = '' then return null; end if;
  foreach part in array string_to_array(ltrim(p_query, '?'), '&') loop
    if public.feedback_url_decode(split_part(part, '=', 1)) = p_name then
      return public.feedback_url_decode(substr(part, length(split_part(part, '=', 1)) + 2));
    end if;
  end loop;
  return null;
end;
$$;

-- Why an item's state and its address disagree, or null when they don't. Only where both say: the state's
-- dashboard against ?view= (Admissions), its entry against ?entry= (Admissions), its level against ?level=
-- (SMT). An address without the parameter (a default, or SMT's remembered level) says nothing. The same
-- pairs and wording as stateMismatch in src/lib/view-ref.ts.
create or replace function public.feedback_state_mismatch(p_state jsonb, p_query text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  pair text[];
  v_state text;
  v_query text;
begin
  foreach pair slice 1 in array array[array['dashboard', 'view', 'dashboard'], array['entry', 'entry', 'entry point'], array['level', 'level', 'level']] loop
    v_state := case when jsonb_typeof(p_state -> pair[1]) in ('string', 'number', 'boolean') then p_state ->> pair[1] end;
    v_query := public.feedback_query_param(p_query, pair[2]);
    -- A bare '+' typed into an address reads as a space; "16+" against "16 " is the same entry.
    if v_state is not null and v_state <> '' and v_query is not null and v_query <> '' and v_state <> v_query and replace(v_state, '+', ' ') <> v_query then
      return format('This item''s settings don''t match its address: %s %s is recorded, but the address says %s. Nothing was sent. Move the window to the view on screen and send again.', pair[3], v_state, v_query);
    end if;
  end loop;
  return null;
end;
$$;

-- On insert: as the deploy gate's, resolved_views starts empty too, and a contradictory item is refused.
create or replace function public.feedback_items_on_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_why text := public.feedback_state_mismatch(new.state, new.page_query);
begin
  if v_why is not null then
    raise exception '%', v_why using errcode = '22023', hint = 'feedback_state_mismatch';
  end if;
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  new.status := 'new';
  new.type := null; new.priority := null; new.planned_version := null; new.resolved_commit := null;
  new.resolved_at := null; new.wont_do_reason := null; new.duplicate_of := null; new.triage_note := null;
  new.triaged_by := null; new.triaged_at := null;
  new.deployed_at := null; new.deployed_build := null; new.checked_live_at := null; new.follows_up := null;
  new.resolved_views := '{}';
  new.created_at := now(); new.updated_at := now();
  new.looks_good := new.looks_good or 'looks_good' = any (new.kinds);
  return new;
end;
$$;

-- On update: the deploy gate's rules, unchanged, with resolved_views a triage field (tidied: trimmed,
-- no blanks, no repeats, never the item's own view).
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
  if new.status = 'deployed' and old.status <> 'deployed' and (not v_auto or current_user in ('anon', 'authenticated')) then
    raise exception 'feedback: "deployed" is set by the live build (record_app_build), not by hand' using errcode = '42501';
  end if;
  if new.resolved_views is distinct from old.resolved_views then
    new.resolved_views := coalesce((
      select array_agg(v order by first)
      from (select btrim(x) v, min(o) first from unnest(new.resolved_views) with ordinality u (x, o)
            where btrim(coalesce(x, '')) <> '' and btrim(x) <> new.view_key group by btrim(x)) t
    ), '{}');
  end if;
  new.updated_at := now();
  if not v_auto and (new.type, new.priority, new.status, new.planned_version, new.resolved_commit, new.wont_do_reason, new.duplicate_of, new.triage_note, new.follows_up, new.resolved_views)
     is distinct from (old.type, old.priority, old.status, old.planned_version, old.resolved_commit, old.wont_do_reason, old.duplicate_of, old.triage_note, old.follows_up, old.resolved_views) then
    new.triaged_by := coalesce(auth.uid(), new.triaged_by);
    new.triaged_at := now();
  end if;
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

-- ------------------------------------------------------------------------------- done, live

-- A platform admin's "Looks good" on a view at a school closes every deployed item on that view, or naming
-- it in resolved_views, at that school, deployed before it (R-FEEDBACK-LIVE-CHECK, R-FEEDBACK-RESOLVED-VIEWS).
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
  where f.status = 'deployed' and f.id <> new.id
    and (f.view_key = new.view_key or new.view_key = any (f.resolved_views))
    and coalesce(f.school_urn, f.group_id) = coalesce(new.school_urn, new.group_id)
    and f.deployed_at <= new.created_at;
  perform set_config('vicdata.feedback_auto', '', true);
  return null;
end;
$$;
revoke execute on function public.feedback_items_live_check() from public, anon, authenticated;
drop trigger if exists feedback_items_live_check on public.feedback_items;
create trigger feedback_items_live_check after insert on public.feedback_items for each row execute function public.feedback_items_live_check();

create index if not exists feedback_items_resolved_views_idx on public.feedback_items using gin (resolved_views) where status = 'deployed';

-- ------------------------------------------------------------------------------- the view

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
  (f.status not in ('done', 'wont_do') and (btrim(f.body) <> '' or not f.looks_good or exists (select 1 from unnest(f.kinds) k where k <> 'looks_good'))) as is_open,
  f.area,
  (f.panel_id is null) as is_page,
  f.deployed_at,
  f.deployed_build,
  f.checked_live_at,
  f.follows_up,
  case when u.number is not null then 'F-' || u.number end as follows_up_ref,
  -- Admissions feedback round 2.
  f.resolved_views
from public.feedback_items f
left join public.feedback_items d on d.id = f.duplicate_of
left join public.feedback_items u on u.id = f.follows_up;

revoke all on public.feedback_for_triage from anon;
grant select on public.feedback_for_triage to authenticated;

-- The helpers are pure. The insert trigger isn't security definer, so it calls them as the inserting role:
-- authenticated keeps execute; anon has none (it can't insert an item anyway).
revoke execute on function public.feedback_url_decode(text) from public, anon;
revoke execute on function public.feedback_query_param(text, text) from public, anon;
revoke execute on function public.feedback_state_mismatch(jsonb, text) from public, anon;
grant execute on function public.feedback_url_decode(text) to authenticated, service_role;
grant execute on function public.feedback_query_param(text, text) to authenticated, service_role;
grant execute on function public.feedback_state_mismatch(jsonb, text) to authenticated, service_role;
