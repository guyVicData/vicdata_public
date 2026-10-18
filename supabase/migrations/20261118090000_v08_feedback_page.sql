-- VicData 0.8 SMT feedback round 2, section 6 (docs/v0.8/vicdata_0_8_smt_feedback_round2_claude_code_prompt_v2.md):
-- feedback on a whole page -- its menus, nav, comparison-set bar, level chips and pills, layout, banner, the home
-- page -- in the same feedback system as view feedback. Written and tested in PGlite
-- (supabase/tests/v08_feedback_page_pglite.mjs); Guy applies it. Adds, never removes: no row is changed.
--
--   * feedback_items.area: the page item's "Area" chips (none on a view item);
--   * product: adds 'home' (the role homes and the group home) and 'dataview' (the Data View);
--   * a page item has no panel or view: panel_id, view_instance_id and dataview_id were already nullable,
--     and its view_key is 'page:<dashboard or page id>' (the app writes it; the check below holds it to that
--     shape whenever there is no panel);
--   * feedback_for_triage gains area and is_page (appended, so the view's existing columns are untouched);
--   * feedback_coverage gains kind ('page' or 'view'), so pages count apart from views.

alter table public.feedback_items add column if not exists area text[] not null default '{}';

alter table public.feedback_items drop constraint if exists feedback_items_area_check;
alter table public.feedback_items add constraint feedback_items_area_check
  check (area <@ array['navigation', 'set_bar', 'level_pills', 'layout', 'banner', 'home', 'account', 'other']::text[]);

alter table public.feedback_items drop constraint if exists feedback_items_product_check;
alter table public.feedback_items add constraint feedback_items_product_check
  check (product in ('teacher', 'smt', 'admissions', 'group', 'meeting', 'custom', 'home', 'dataview'));

-- A page item is one with no panel: its key names the page, and only a page item carries areas.
alter table public.feedback_items drop constraint if exists feedback_items_page_shape;
alter table public.feedback_items add constraint feedback_items_page_shape
  check (
    (panel_id is null and view_key like 'page:%')
    or (panel_id is not null and view_key not like 'page:%' and area = '{}')
  );
-- Every live item (F-1 to F-11) has a panel and no area, so the check holds for them as it is added.

-- ---------------------------------------------------------------------------- the two views

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
  -- Section 6: the page item's areas, and whether it is about a whole page.
  f.area,
  (f.panel_id is null) as is_page
from public.feedback_items f
left join public.feedback_items d on d.id = f.duplicate_of;

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
  count(*) filter (where t.is_open)::int as open_items,
  -- Section 6: a page's row stands apart from its views' rows.
  case when bool_or(t.is_page) then 'page' else 'view' end as kind
from public.feedback_for_triage t
group by t.dashboard_id, t.panel_id, t.view_instance_id, t.view_key, coalesce(t.school_urn, t.group_id);

revoke all on public.feedback_for_triage from anon;
revoke all on public.feedback_coverage from anon;
