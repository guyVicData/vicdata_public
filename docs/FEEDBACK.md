# Feedback: how items become the to-do list

VicData's feedback system (0.8, `docs/v0.8/notes_feedback_report_v1.md`) lets Guy, and later beta testers and then every member, give feedback on any view as they use it. Each item records exactly what was on screen. Claude reads the items, proposes a triage, and turns them into the to-do list. Items close when the fix is deployed.

## Who can give feedback

One setting, read by the database (`app_settings`, key `feedback_audience`):

| Value | Who | When |
|---|---|---|
| `admins` | platform admins only | **now** |
| `beta` | platform admins plus the people in `feedback_beta_testers` | 0.14 |
| `all` | every signed-in member | launch |

Guy changes it in SQL, for example `update app_settings set value = '"beta"' where key = 'feedback_audience';`. Nobody else sees the feedback icon until the setting lets them in.

## What an item holds

Every item has a short number, **F-12**.

**Recorded automatically:**
- the time;
- the author, and whether they were in View as (or a peek);
- the role the page was drawn for;
- the school or group;
- the product;
- the dashboard (id, name, published version);
- the panel, and the view (instance id, dataview id, label);
- the page's state: subject, level, comparison set, year, phase, filters and pills;
- the address;
- the app version (Render's commit; "unknown" if it is missing, "dev" only on a local dev server);
- phone or desktop;
- light or dark theme.

**Given by the author:**
- the text;
- chips, which are hints only: what kind ("wrong figure" adds "I see…" and "I expected…"), how much it matters, scope, applies to, and where in the view;
- "Looks good" on its own, with no text, is a valid item. It records the view as checked at that school.

**Triage fields (platform admins only):**
- `type`: fix, data question, wording, design, feature request, praise, other;
- `priority`: high, normal, low;
- `status`: new, then triaged, then planned (with `planned_version`), then done (with `resolved_commit` and `resolved_at`), or won't do (with `wont_do_reason`);
- `duplicate_of` another item;
- a `triage_note`.

Authors can't edit or delete an item once sent; they add another. Nobody changes what was recorded: the database allows changes to the triage fields only. Members' items are read by platform admins only, never by their school or group. Feedback is never counted as usage.

## Page items (feedback on a whole page)

Since 0.8 SMT feedback round 2 (section 6; migration `20261118090000_v08_feedback_page`), an item can be about a whole page rather than one view: its menus and nav, the comparison-set bar, the level chips and pills, the layout, the banner, a home page. It goes into the same system and the same inbox.

- **Where:** "Feedback on this page", in the site footer next to Edit. It is shown on every page that has views (Teacher, SMT, Admissions, the group dashboards), and on the Data View, the role homes and the group home. Only people the feedback setting lets in see it.
- **Its colour** follows the view icon's rules: yellow while you have open page feedback, green once you've marked the page "Looks good", monochrome otherwise.
- **What it records:** the same context as a view item, with no panel or view. `panel_id`, `view_instance_id` and `dataview_id` are empty, and `view_key` is `page:<dashboard or page id>` (for example `page:vicdata.smt.overview`, `page:home:smt`, `page:dataview`). The role homes and the group home record the product `home`; the Data View records `dataview`.
- **The Area chip** (tick any): navigation and menus · comparison-set bar · level chips and pills · layout · banner · home page · account · other. It is stored in `area`. The other chips work as for a view, except that "Applies to: all similar" means every dashboard of this kind.
- **In the inbox:** a page item reads "Page". The Items filter picks pages or views, and Open goes to the page with its address and state.
- **In the two views:** `feedback_for_triage` has `area` and `is_page`, and `feedback_coverage` has `kind` (`page` or `view`), so a page counts apart from its views.

```sql
-- Open page items, newest first
select ref, created_london, dashboard_name, school_or_group, area, kinds, body, state, page_path, page_query
from feedback_for_triage
where is_page and is_open
order by created_at desc;
```

## Reading the items (Claude, read-only)

Check the project ref first (`lnhulykjlxmoneappnsp`, the app database). Then read through the two views. Never write with SQL; triage goes through the inbox.

```sql
-- New and open items, newest first, with readable names
select ref, created_london, author_name, view_as, role, product, dashboard_name, panel_name, view_label,
       dataview_id, school_or_group, state, page_path, page_query, app_version, device, theme,
       kinds, importance, scope, applies_to, where_in_view, saw, expected, body,
       type, priority, status, planned_version, duplicate_of_ref, triage_note
from feedback_for_triage
where status in ('new', 'triaged', 'planned') and is_open
order by created_at desc;

-- Coverage: which views at which schools are checked, open, or (absent here) unseen
select dashboard_name, view_label, scope_name, state, last_looks_good_at, last_open_at, items, open_items
from feedback_coverage
order by dashboard_id, panel_id, view_instance_id, scope_name;
```

With the CLI: `supabase db query --linked "<one of the above>"`. Run it from a checkout whose `supabase/.temp/project-ref` reads `lnhulykjlxmoneappnsp`.

## Proposing a triage

For each new item, Claude proposes:
- **type** and **priority**. The author's chips are hints: "wrong figure" plus "before the demo" usually means a fix at high priority. Weigh it against the evidence first.
- **duplicate_of**, when another item names the same view and problem, at any school.
- **whether it reproduces**: open the item's Open link (the inbox's "Open the view as it was") or rebuild it from `page_path`, `page_query` and the peek (`?lookAs={school}&as={role}&peek=1`), then check the figure against the data.
- **a planned version** for anything accepted, for example 0.85.
- **a one-line triage note**: what is wrong, and where in the code it probably lives.

Guy confirms. The confirmed fields are set in the inbox (`/platform/feedback`: open the item, then Save triage, or tick several and apply a status). The author's own chips stay as they were. Both are kept.

## Linking items to the to-do list

- Each to-do entry names its items by F-number: `Fix Art and Design's share at Leighton Park (F-12, F-15)`.
- "Copy as Markdown" in the inbox copies the ticked items, or all shown, ready to paste into a round's prompt or the to-do list. Each item carries its Open link.
- One item can feed several to-dos, and one to-do several items. The F-number is the link both ways.

## Closing an item

When the fix is deployed (merged to `main`, Render deployed):
1. Set the item to **done**, with the **commit** that fixed it. The date is stamped if none is given. In the inbox: tick the items, then "Set ticked to: Done" with the commit.
2. The author's icon on that view goes back to monochrome, unless they have other open items there (or a "Looks good" there not yet done). Coverage still counts a done "Looks good" as checked.
3. A **won't do** needs a reason. The author sees the status in their list on that view; the reason stays in the inbox.

## Keeping and deleting items

- **How long:** items are kept while open, and deleted 2 years after they are closed (done or won't do) (Guy, 18 Oct). If an account is deleted, its items stay without the author's name (`author_id` set to null).
- **Nobody deletes through the app:** there is no delete policy or grant. A deletion is a migration in the next build, applied by Guy.
- **Guy's own requests** ("delete F-12"): Claude writes the migration into the next build, and Guy confirms it there. That's all the process they need.
- **Anyone else's request** goes into triage like any item: the request is logged as an item (type "other", with a triage note naming the items it asks to delete). Once agreed, the deletion goes into the next build the same way, and the request is marked done with that commit.
- **The 2-year clear-out** is a periodic migration: `delete from feedback_items where status in ('done', 'wont_do') and coalesce(resolved_at, triaged_at, updated_at) < now() - interval '2 years'`. It runs under the database's own role, which RLS doesn't restrict.

**Proofing:** the inbox's Coverage tab shows every view of every VicData dashboard. For a chosen school or group it marks each view checked ("Looks good"), open, or unseen. Group dashboards, custom dashboards and meetings appear there once they have feedback.
