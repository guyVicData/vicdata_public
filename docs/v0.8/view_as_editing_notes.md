# 0.8 View as: the editing half (notes, 17 Oct)

This covers the editing part of `docs/v0.8/vicdata_0_8_view_as_claude_code_prompt_v1.md`: the edit bar for every platform admin, the eight "Editing must never damage a dashboard" guarantees, and R-EDIT-PUBLISH-ALL. It ran unattended and wrote nothing to any database.

## The real configs (guarantee 1's seed)

- **Source:** one read-only select on the app database (lnhulykjlxmoneappnsp):
  `select d.slug, d.name, d.kind, v.version, v.schema_version, v.config from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.owner_scope = 'vicdata' and d.kind = 'dashboard' order by d.slug`
- **Fixture:** `supabase/tests/fixtures/vicdata_published_configs_2026-10-17.json` (10 rows).
- **Where it ran from:** the worktree isn't linked to the CLI ("Cannot find project ref"), so the select was run from `~/dev/vicdata_public`, which is linked. That checkout's files were not touched.
- **Live versions on 17 Oct:**

  | Product | Dashboard | Version |
  |---|---|---|
  | Teacher | ks4 Candidates | v6 |
  | Teacher | ks4 Results | v16 |
  | Teacher | ks5 Candidates | v2 |
  | Teacher | ks5 Results | v3 |
  | SMT | Overview | v1 |
  | SMT | Academic | v1 |
  | SMT | Pupils | v1 |
  | SMT | Context | v2 |
  | Admissions | Pipelines | v2 |
  | Admissions | Market share | v1 |

  All 10 are schema_version 2, and all pass `validateConfig` with no problems and no empty panels.

## Test commands and results

| Test | Command | Result (verbatim) |
|---|---|---|
| Guarantees 1 and 7, R-EDIT-PUBLISH-ALL (PGlite) | `npm i --no-save @electric-sql/pglite@0.2 && npx -y tsx supabase/tests/v08_view_as_editing_pglite.mjs` (tsx, because it drives the app's own TypeScript store code) | `ALL 44 PASSED` (output saved to `supabase/tests/v08_view_as_editing_pglite.out`) |
| Guarantees 2–6 | `npx -y tsx --test src/lib/editor-guarantees.test.ts` | `ℹ tests 27` `ℹ pass 27` `ℹ fail 0` |
| Teacher pin | `npx -y tsx --test src/lib/edit-mode-teacher-pin.test.ts` | `ℹ tests 2` `ℹ pass 2` `ℹ fail 0` |
| Existing editor and catalogue suites (editor-ops, change-summary, published-vicdata, viewspec, view-editor, copy-view, meeting-ops, variants, plus the two files above) | `npx -y tsx --test` over all of them | `ℹ tests 134` `ℹ pass 134` `ℹ fail 0` |
| Catalogue unit tests | `npx -y tsx scripts/catalogue-unit-tests.ts` | `ℹ tests 77` `ℹ pass 77` `ℹ fail 0` |

**How the PGlite test works:**
- It applies the S1 and S2 migrations over the live-schema stub, as `v06_rls_pglite.mjs` does.
- It seeds the 10 real configs, one `publish_dashboard` each, with role assignments: teacher, smt or admissions.
- It then runs the editor's own calls (`dashboards-store` loadDashboard, saveDraft, publish and listVersions, and `published-vicdata` loadPublishedVicData) through a small PostgREST-shaped client over PGlite.
- Every call runs as `authenticated` with that person's `request.jwt.claim.sub`, so RLS and `publish_dashboard` decide as they do live.

**Mutation check:** the guarantee tests catch the bugs they were written for. With the copyRow and removeColumn fixes reverted, 9 tests fail (`ℹ pass 18` `ℹ fail 9`). With the fixes back, all pass.

**Other checks:**
- `npx tsc --noEmit -p .` has one error, and it isn't from this work: `src/app/layout.tsx(52,50): Cannot find name 'LayoutProps'`. `LayoutProps` is a type that `next build` / `next typegen` generates into `.next/types`, which this fresh worktree doesn't have yet.
- eslint on every file changed here: clean.
- `next build` was not run (the lead runs it once).

## The guarantees

### 1. Round trip, no change: PASS (PGlite, 10 of 10)

- **Test:** `supabase/tests/v08_view_as_editing_pglite.mjs`, lines `G1 round trip <slug>`.
- **What it does, for each dashboard:**
  1. Opens it as the editor does (`loadDashboard(…, withDraft)`).
  2. Saves the untouched draft (`saveDraft`) and re-opens it from the draft.
  3. Publishes what the editor holds, with the summary the dialog shows.
- **What it checks:**
  - The new version is n+1.
  - `config::text` (the canonical jsonb text) is identical to the old version's and to the draft's.
  - The summary is "No changes.", the publish gate is clear, and created_by is Guy.
  - A member of that role at another school then draws the new version through `loadPublishedVicData` (source `store`), with the same config.
- **Fix needed:** none. `upgradeConfig` and `latestNamesInSaved` are identity on all 10 live configs.

### 2. Nothing dropped: PASS after one fix

- **Test:** `src/lib/editor-guarantees.test.ts`, "guarantee 2 (…)", on ks4 Results, SMT Overview and Admissions Pipelines.
- **The fixture:** every panel carries `span` and `name`, plus unknown keys at every level. Panels with two or more views also carry `override`, `legacy`, `defaultView`, `defaultViewByResults`, `defaultViewByState` and the views' `params` and `variants`. The dashboard carries `features`, with an unknown feature added.
- **What it checks:** each op leaves every field it isn't meant to change deep-equal. The ops: rename, set default, reorder, move within panel, remove, add, move view, copy view, move panel (swap), resize, row settings, move row, add row, copy row, delete row, settings (features merge), override, and Show on.
- **Fix (`src/lib/editor-ops.ts`, `copyRow`):** the copied row and its panels now carry every key the op doesn't write itself, through `unknownKeys` with `ROW_KEYS` / `PANEL_KEYS`. Before, a copy kept only the keys it knew, so any newer or unknown key was dropped.
  - `legacy` and `legacyPanelId` are still left off on purpose: a copy's notes are its own, as before.
  - The known keys are written in the same order as before, so Teacher's output is byte-identical (see the pin).
- **Every other op already carried everything:** they work on a `structuredClone` and change only their own fields.

### 3. Large panels: PASS after one fix

- **Test:** "guarantee 3 (…)", on SMT's 4 and Admissions' 2 layouts. Each has one 2-wide panel on row "now", across columns 2–3 of 3.
- **Refused with a message (an EditorError, which the editor shows as a toast):**
  - moving the 2-wide panel off the edge, onto the 1-wide panel, or onto any cell of a full row;
  - moving a 1-wide panel onto the 2-wide one;
  - widening the 2-wide panel to 3, or the 1-wide one to 2;
  - removing column 2 or column 3.
- **Allowed, and each keeps the 2-wide panel 2-wide with no view or panel dropped:**
  - reordering its views;
  - moving rows;
  - swapping two 1-wide panels;
  - adding a [1, 2] row;
  - copying its row;
  - moving the 2-wide panel into an empty 2-wide space.
- **Narrowing it** is only ever the explicit resize (span 1), and every view is kept.
- **Fix (`src/lib/editor-ops.ts`, `removeColumn`):** Settings' "fewer columns" now refuses when a panel with views spans the column being removed, for example "“Scorecard” spans 2 columns, across “…”. Make it narrower or move it first." Before, the panel silently shrank to one column. Settings always removes the last column, so on every SMT and Admissions dashboard that is the column the 2-wide panel spans.
- **Unchanged, on purpose:** Row settings' "Panels in this row" (`setRowStructure`) still re-lays a row to the structure Guy picks, and its dialog already says how many panels go. That is an explicit choice, not a side effect.

### 4. Only views the panel can draw: PASS after one fix

- **The two pickers:** Add a view opens one of two (DashboardEditor `handlers.addView`).
  - Every column on the 10 dashboards has a registered `host`, so Add a view opens the View editor. Its choices are `presetsOf(columnHost, side)`: dataviews whose `host.id` is that column's host.
  - With no host, the catalogue chooser (`pickResults`) matches on data. Data ids are family-prefixed, and no registered dataview supports another family's data (tested).
- **Test:** "guarantee 4 (…)", on all 10 dashboards and both pickers, and not vacuously: the SMT and Admissions panels offer presets.
- **Fix (`src/lib/editor-ops.ts`):** `validateConfig` now says the rule outright, with `familyOfHost`, `columnFamily` and `familyProblems`.
  - A view whose host family (Teacher, SMT or Admissions) isn't its column's is a problem: "DV-… is a Teacher view; this panel draws SMT views".
  - Every op runs through `checked()`, so `addView` refuses such a view.
  - `publishBlockers` refuses to publish it. An unregistered dataview was already a problem ("unknown dataview"), and Publish now refuses it too (see 5).
  - Tested both ways on a Teacher, an SMT and an Admissions dashboard.

### 5. The preview draws what members will see: PASS (static and gate); screenshots not taken

- **Tests:** "guarantee 5 (…)".
  - Every registered SMT and Admissions dataview has a `case` in its family's renderer. Those are SMT's `ViewBody` and Admissions' `viewBody`, the same bodies the member page draws.
  - The editor's `LivePanelPreview` routes by host family to `SmtViewPreview` / `AdmissionsViewPreview`, which render those same bodies.
  - Every view on the 10 dashboards is drawable.
  - A view the preview can't draw blocks Publish, with a message naming it: "The preview can't draw “<title>” in <panel> (<column>): DV-… isn't a registered view." A view of another family gets the same kind of message.
- **Fix:** new `previewGaps` and `publishBlockers` in `src/lib/editor-ops.ts`.
  - `src/components/editor/DashboardEditor.tsx` computes the blockers. Publish refuses while there are any, and the check is repeated inside `doPublish`.
  - `src/components/editor/Dialogs.tsx` `PublishDialog` takes `blockers`, shows each as an error line, and disables Publish while any are there.
  - Teacher's four live dashboards have no blockers (pinned), so Teacher's Publish is unchanged.
- **Gap found, not mine to fix (in `src/components/smt` and `src/components/admissions`):** the editor has no large (fullscreen) preview.
  - `SmtViewPreview` hard-codes `fullscreen={false}`, and `AdmissionsViewPreview` passes `{ fullscreen: false }`. The editor only ever draws views at panel size.
  - So the editor never shows what members get in fullscreen. Examples: DV-ADM-M-BARS drops its donut in fullscreen, and ShapeAndSize adds a column of rival shapes there.
  - Suggested fix: give the panel menu an "Open large" that renders the same preview with `fullscreen` and a `room`.
- **Screenshots:** not taken (the brief allowed skipping them). Listed below as checks by eye for Guy.

**The composite views** (one view whose body draws two or more graphs), from reading the renderers:

| View | Where | What it draws |
|---|---|---|
| DV-ADM-P-SHAPE, DV-ADM-M-SHAPE | Pipelines / Market share, the 2-wide panel | Up to 3 side by side: your school's age bars, the local shape (P only), and a grid of rivals' small shape charts. `columns` look 1–3. (`admissions/views/ShapeAndSize.tsx:61,76,97`) |
| DV-ADM-M-BARS | Market share, 2-wide | Share donut beside a ranked-bars table. The donut is shown when `withDonut` is on and the view isn't fullscreen. (`views/Bars.tsx:62-66`) |
| DV-ADM-M-MOMENTUM | Market share, 2-wide | Quadrant scatter (fixed 470px) beside the rivals' flag list. (`views/Momentum.tsx:107-108,165`) |
| DV-ADM-P-PIPELINE | Pipelines, 2-wide | Pipeline chart with rung cards under it, at 16+ when there are 2 or more rung sets. (`AdmissionsDashboard.tsx:539-540`) |
| DV-ADM-P-AREA-POP | Pipelines, Trends c2 (1-wide) | Two bar charts side by side: LA and region, ages 5–15. (`views/Lines.tsx:130`) |
| DV-SMT-A-GRADES | SMT Academic, 2-wide | Stacked: one card per stage (GCSE, A level), each with its own grade bar. (`smt/views/Grades.tsx:35`) |
| DV-SMT-A-AREAS | SMT Academic, 2-wide | Stacked: GCSE and Post-16 subject-area tables, each with diverging bars. (`smt/views/Areas.tsx:26`) |
| DV-SMT-A-VA | SMT Academic, 2-wide | Stacked: Progress 8 block, A-level value-added table and a by-subject table. (`smt/views/ValueAdded.tsx:34`) |
| DV-SMT-P-SHAPE (borderline) | SMT Pupils, 2-wide | Year-group bars beside a 300px "Shapes around you" column of text and figures. (`smt/views/Pupils.tsx:60,84`) |
| DV-SMT-C-MAP (borderline) | SMT Context, 2-wide | Map beside a 300px legend column. (`smt/views/Context.tsx:275,382`) |

Every other view in SMT and Admissions draws one chart, table, map or set of tiles.

### 6. Before publish: PASS after one fix

- **Tests:** "guarantee 6 (…)".
  - The change summary names an add, a remove, a move, a row rename and a panel name.
  - A publish with no summary, or a blank one, is refused before any call is made.
  - Checked in the source: the editor passes `ops.changeSummary(published.config, config)` to both the dialog and `publish()`. The dialog shows it under "What's changed", and its Publish button (the confirmation) is held back by blockers.
- **What was already in place:** the Publish dialog already showed the change summary and made the click on Publish the confirmation step. That is left exactly as it is: Teacher's dialog didn't gain a checkbox.
- **Fix (`src/lib/dashboards-store.ts`, `publish`):** a publish without a non-blank `change_summary` now throws "A publish needs its change summary." before the RPC. Every call site already passes one: the editor, `meeting-store.ts` (two calls) and Copy this view (two calls). Nothing changes for them.

### 7. Restore: PASS (PGlite, SMT Context)

- **What it does:**
  1. An editor edit is published as v3.
  2. The editor lists v3, v2 and v1, newest first. A member lists only v3.
  3. Restoring v2, as HistoryPanel's `onRestore` does (its config becomes the draft), and publishing gives v4.
- **What it checks:**
  - v4's `config::text` is byte-identical to v2's (and to v1's, the seed).
  - v3 differs from v2.
  - All four versions are kept.

### 8. Groups: not editable (report only)

- Nothing under `src/components/groups` (`GroupDashboard.tsx`, `views.tsx`, `views-r3.tsx`) calls `useInPlaceEdit`, `useRegisterVicDataDashboard` or `EditorScreen`.
- There is no `DV-GRP-*` dataview and no group `dashboards` row.
- So no Edit switch can render there. That is correct this round.
- **For Guy:** "make the group dashboards config-driven". The lead logs it, with the views it would need.

### R-EDIT-PUBLISH-ALL: PASS (PGlite)

**The setup:**
- A **second** platform admin, added with the statement below, in View as SMT at Leighton Park (URN **110110**, not 110127; from `src/catalogue/rules.ts` test cases). That admin is not a member of Leighton Park or any other school.
- The admin renames SMT Overview's 2-wide panel, saves the draft and publishes.

**Results:**
- The draft's `updated_by` is the admin.
- The new version is n+1, its `created_by` is the admin's uid, and `published_version_id` moved to it.
- No school-scoped or trial-keyed row was written.
- An SMT member at **another school** (Acland Burghley) loads n+1 through the member path, with the new name. So does Leighton Park's own SMT member: one definition for all.
- Under RLS a member sees only the new version.
- A Teacher-only member can't read the SMT dashboard, and falls back to the code copy.
- An SMT member can't publish ("not allowed") and can't write a draft.
- Guy's session then publishes n+2: every platform admin can publish, not only one.
- Checked in the source: `saveDraft`, `publish` and `listVersions` never read View as (`getActiveViewAs`, `stateKey`, `trial_key` or `stateUrn`). They take only the session client. View as changes no session: there's no `setSession` or impersonation anywhere in `src`.

### Teacher's pattern, pinned

- **Test:** `src/lib/edit-mode-teacher-pin.test.ts`.
- **The pin:** `supabase/tests/fixtures/teacher-edit-pin.json` holds the script's output on the four live Teacher configs. It was written with `PIN_WRITE=1` from the `editor-ops.ts` as it stood **before** this round's changes. For every step it records:
  - a hash of the output config;
  - its change summary;
  - its refusal message, if it was refused.
- **The script:** up to 23 edits (fewer where a panel has one view), the ones the editor's menus call. Rename, default, reorder, copy, move or remove a view, swap panels, the refused widen, add, rename, move, copy, restructure or delete a row, add or remove a column, and settings.
- **What it checks:** the current code gives byte-identical results, and Teacher's four dashboards get no publish blockers.
- **What it doesn't cover:** `edit-mode.ts` itself (hooks, localStorage). It is DOM-bound and wasn't changed here, so a DOM-free test of it would be hollow.

## The pages that draw a VicData-owned dashboard

| Page | Component | Registers? (`useInPlaceEdit`, which calls `useRegisterVicDataDashboard`) |
|---|---|---|
| `/teacher/[phase]` (ks4, ks5) | `dashboard-config/TeacherDashboard.tsx:801` | Yes, once the page has loaded and the school is onboarded. Candidates and Results switch in place. |
| `/dashboards/[id]` (custom; VicData-owned when `extras.vicData`) | `dashboard-config/CustomDashboardScreen.tsx:97` | Yes, only when the stored dashboard is VicData's. Personal and school dashboards don't register: they are edited through `/dashboards/[id]/edit`. |
| `/teacher/smt`, `/teacher/smt/academic`, `/pupils`, `/context` | `smt/SmtDashboard.tsx:99` | Only when `state.member.access !== "none"`. This is the bug: in View as at a school where the admin has no membership, the member is "no-school", so nothing registers and no Edit switch shows. It is fixed by the lead's member.ts / view-as change, which this work doesn't touch. |
| `/teacher/admissions` (Pipelines and Market share, switched in place) | `admissions/AdmissionsDashboard.tsx:137` | Only when access isn't `none` or `listOnly`. Same cause as SMT. |
| `/teacher/meetings/[id]` | `meetings/MeetingScreenWithChooser` | No. Meetings are personal or school presentations, edited in their own meeting editor; no VicData-owned meeting template exists in code. |
| Group dashboards | `groups/dash/GroupDashboard.tsx` | No, and rightly not: they aren't config-driven (guarantee 8). |

**Where SMT and Admissions still differ from Teacher's pattern.** These are for the lead: they are in `src/components/smt` and `src/components/admissions`, which this work doesn't change.
1. **Registration** is gated on the member lookup (above). Teacher's isn't.
2. **"Preview draft"** isn't read. Teacher's page swaps in `loadDraftVicData` when `inPlace.previewDraft` is on; SMT and Admissions always load `loadPublishedVicData`. So the banner's Preview draft does nothing there.
3. **The editor host** gets the school only. Teacher passes `labels` (the subject in focus and the Results pill) and `states` (Compare against and the comparator kind). SMT's level chips and Admissions' entry point and filters aren't passed, so the editor previews at Whole school and at its own 11+ entry pill. This is acceptable, since those products have their own pills, but it is still a difference.
4. **No large preview** (guarantee 5 gap above).

## Per-school and per-user copies (and how members pick up a publish)

- **The VicData definitions themselves have no per-school copy.**
  - Every member's page draws the published version through `loadPublishedVicData`: one row per slug, owner `vicdata`.
  - A publish reaches everyone on their next page load. The in-place editor's `reloadTick` re-reads straight away for the admin.
  - Members' own state (open rows, the chosen view, notes) is keyed by stable panel and view ids in `dashboard_user_state` / `teacher_view_preferences`. It carries over where a panel survives (`carryUserState`, G1).
- **The copies there are:**
  1. **The copy in code** (`src/catalogue/dashboards`). Members draw it whenever the store can't give a usable published version: tables missing, no row, not readable under RLS, schema_version not 2, or `validateConfig` fails. It does **not** pick up a publish. A dashboard can fall back to it quietly (a console warning only).
  2. **"Save as" and "Copy this view"** make a new dashboard or meeting slot from the config (`copyAsNew`, Copy this view). That is a separate definition, owned by the person or VicData, and later publishes don't reach it, by design.
  3. **`dashboard_assignments.mode = 'copy'`** exists in the schema, but nothing reads it. Every assignment acts as "live".
  4. **View as personal rows** are personal dashboards made in View as (`trial_key`). They are the trial's own and never touch a VicData definition.

## Platform admin: no check tied to Guy

- **Searched:** `src` and `supabase/migrations` (and `scripts`), for UUID literals, Guy's id `52a08818-…`, email literals, "guy" next to a comparison, and admin env flags.
- **No check in `src` names Guy.** No UUID literal outside tests, and no admin email or env gate.
  - The only email literals are placeholders: `admin@group.org` and `name@group.org`.
  - Every gate uses `rpc("is_platform_admin")`: `edit-mode.ts` `isPlatformAdminCached`, `EditorScreen` `usePlatformAdmin`, `TeacherDashboard`, and the RLS / `can_edit_dashboard` / `publish_dashboard` path.
- **The only place Guy's id appears** is the S1 migration's one-time seed (`20261103090000_v06_s1_roles_teams_platform.sql:122-125`): `insert into platform_admins … where id = '52a08818-…'`. That is data, not a check.
- **`is_platform_admin()`** is `exists (select 1 from platform_admins where profile_id = auth.uid())`. `platform_admins` can't be written through the API (its RLS has a select-own policy only).
- **Adding a second platform admin** is one database step. Guy runs it in the Supabase SQL editor, or with `supabase db query --linked "…"`. Replace the email; the person must have signed in once, so they have a profile:

```sql
insert into public.platform_admins (profile_id, note)
select id, 'Platform admin, added by Guy' from public.profiles
where email = 'their.email@example.com'
on conflict (profile_id) do nothing;
```

  The PGlite test adds its second admin with exactly this statement.
- **To remove one:** `delete from public.platform_admins where profile_id = (select id from public.profiles where email = '…');`

## Checks by eye for Guy

- **Each composite view in the table above,** in the editor's panel preview beside the live page, in View as SMT and Admissions at Leighton Park. Do they match? Note DV-ADM-M-BARS's donut, and the stacked SMT Academic views in the 2-wide panel.
- **Fullscreen:** open each composite fullscreen on the live page. The editor has no fullscreen preview to compare with (the gap above).
- **Publish dialog:** on any dashboard, Publish still shows "What's changed" and publishes as before. A blocker line appears only for an unregistered or wrong-family view.
- **Settings:** on an SMT dashboard, Settings, then fewer columns, now shows the "spans 2 columns … Make it narrower or move it first" toast instead of shrinking the Scorecard panel.

## Decided unattended

- decided unattended, for Guy to confirm: `removeColumn` now **refuses** when a panel with views spans the column, instead of shrinking it. Panels in that column that are only one column wide are still removed, as the Settings note says.
- decided unattended, for Guy to confirm: publishing is now held back by any `validateConfig` problem or preview gap, and a view whose host family differs from its column's is now a config problem. No live config is affected: all 10 pass.
- decided unattended, for Guy to confirm: "confirmed" stays the Publish dialog's own Publish click, after the summary is shown. No extra tick box, so Teacher's dialog is unchanged.
- decided unattended, for Guy to confirm: `dashboards-store.publish` refuses a blank `change_summary`. Every caller already sends one.
- decided unattended, for Guy to confirm: copying a row now carries any field a row or panel holds that the op doesn't know about. `legacy` keys are still dropped, as before.
- decided unattended, for Guy to confirm: the composite-view screenshots were not taken (the brief allowed it). They are listed as checks by eye.
- decided unattended, for Guy to confirm: the read-only select ran from `~/dev/vicdata_public`, because the worktree isn't linked to the Supabase CLI.

## Files

**Changed:**
- `src/lib/editor-ops.ts`
- `src/lib/dashboards-store.ts`
- `src/components/editor/DashboardEditor.tsx`
- `src/components/editor/Dialogs.tsx`

**New:**
- `src/lib/editor-guarantees.test.ts`
- `src/lib/edit-mode-teacher-pin.test.ts`
- `supabase/tests/v08_view_as_editing_pglite.mjs` (+ `.out`)
- `supabase/tests/fixtures/vicdata_published_configs_2026-10-17.json`
- `supabase/tests/fixtures/teacher-edit-pin.json`
- this note
