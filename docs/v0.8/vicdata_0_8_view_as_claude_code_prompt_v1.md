# VicData 0.8 — View as and role switching: fix, then separate the two

Claude Code prompt for the app repo (`~/dev/vicdata_public`), app database `lnhulykjlxmoneappnsp`. Written 17 Oct 2026.

## This round runs unattended (Guy is out)

- **Never stop to ask.** Where a choice is needed, take the option this prompt recommends, or the safest one. Log it under the round's heading in `docs/OPEN_QUESTIONS.md` as "decided unattended, for Guy to confirm", and carry on.
- **Never write to either database.** Prefer designs that need **no migration**. For the `school_accounts` read below, use the server helper with the service role, after the platform-admin check, not a new RLS policy.
  - If a migration is truly unavoidable, write it and test it in PGlite. Then push the branch, **don't merge**, and put Guy's commands at the top of the report.
- **Merge only if every check is clean and no migration is needed.** Otherwise, push the branch and stop, with the report saying what's left.
- **Another session may be running the database load round** (branch `v0.8-db-performance`). Work in your own worktree (`~/dev/vicdata_public_viewas`), use ports from 3200 up (check each is free), and don't edit the harness files that round changes.
  - Before merging, fetch `main` again. If the database round has merged meanwhile, rebase onto it and rerun every check.
- **Long steps:** use `caffeinate -dims` and progress logs, and write the report as you go, so an interrupted run can be resumed from the branch and the report.
- **Finish with** `docs/v0.8/view_as_summary_for_guy.md`, one page:
  - what's done;
  - merged or not (and why);
  - every "decided unattended" item;
  - anything Guy must do: a migration, a Render deploy, a check by eye.

## The bug Guy hit (17 Oct)

Guy, a platform admin, chose "View as SMT at Leighton Park" on /account. The SMT dashboards then showed "To see a school's SMT dashboards, use View as", and no dashboard or edit bar.

**Cause (read from the code):**
1. `src/components/smt/member.ts` (line ~70) and `src/components/admissions/member.ts` (line ~74) look up the viewed school's `school_accounts` row with the signed-in user's client.
2. `school_accounts` has one SELECT policy, `is_member_of_school_account(id)`, so a platform admin who isn't a member of that school gets nothing back.
3. So `loadSmtMember` returns "no-school", and the page falls through to the "use View as" message.

Teacher's View as doesn't need that row, so it works. SMT and Admissions in View as work only at schools where the viewer holds a membership. The same pattern sits in `src/lib/view-as.ts` (~329), `src/lib/smt/catchment-client.ts` and `src/lib/smt/pupils.ts`.

## How switching works now (to replace)

**Staff (platform admins):**
- The View as card on /account;
- the nav pill (only while viewing);
- the footer's "View as…";
- Platform's "Look at it as…";
- the "View as…" buttons on the SMT and Admissions "not for you" messages;
- `?lookAs=&as=&peek=1` (the Catalogue's frames);
- a **separate head-office View as** for groups, with its own cookie (`src/lib/groups/view-as-group.ts`, `GroupViewAsBanner`);
- the **old testing school switcher** (`src/lib/testing-membership.ts`), still destructive: it deletes the caller's memberships and personal saved sets.

**Members:**
- the lens switcher (`LensSwitch` in `RoleHome.tsx`) on the /teacher home, for people holding more than one role;
- `?school=URN` / `pickMembership` for people with memberships at more than one school;
- the group switcher (`GroupSwitcher`) for head office.

**Access checks:** each product has its own. `smtCaller`, Admissions' member, the groups' `caller.viewAs`, and the Data View and Teacher routes' `isPlatformAdmin`. Logging also differs: some write `view_as`, others say View as is never logged.

## The design (Guy, 17 Oct): two separate things

### A. Staff View as: Guy, his team, and Claude Code

- **Who:** platform admins only. The UI must never render for anyone else, and the server re-checks platform admin on every request.
- **What:** any school, any role. The roles are Teacher, SMT, Admissions, School-Admin, and **head office of a group** (fold the groups' head-office View as into the same mechanism, one cookie). It must work at **any** school, whether or not it has members or a school account.
- **One place to start it:** the switcher in the account menu (the /account card, plus the same panel from the account link's menu).
  - While active, the banner shows "Viewing as SMT · Leighton Park", with **Change** and **Back to me**. The nav pill can stay as the active indicator.
  - **Remove** the footer's "View as…", Platform's "Look at it as…" (or make it a link that opens the account switcher pre-filled), and the "View as…" buttons on the SMT and Admissions messages.
  - Those messages, for a platform admin in View as with the wrong role, say: "You're viewing Leighton Park as Teacher. SMT dashboards are for SMT and the School-Admin." Add a **Switch to SMT** button that changes the role in place.
- **The edit bar:** the footer's Edit switch shows for a platform admin on every VicData-owned dashboard, in View as and out of it, exactly as before. It must appear on SMT, Admissions and the group dashboards in View as.
- **The edit bar, from the footer, for every platform admin, whatever is being viewed (Guy, 17 Oct):**
  - **Teacher view's editing is the reference: it works as Guy wants** (0.6 snags 2 and 4: `src/lib/edit-mode.ts`, `useRegisterVicDataDashboard`, `useInPlaceEdit`, `FooterEditSwitch`, the banner's Edit, and drafts and publishing with the admin's own session).
    - Bring SMT, Admissions and every other config-driven VicData dashboard to **exactly that behaviour**, reusing the same pieces. Don't build a new editor path.
    - Where a product departs from Teacher's pattern, make it match and list the difference you removed. Teacher's own editing must behave identically before and after; add a test that pins it.
  - **Where it appears:** the footer's **Edit** switch shows on every page that draws a VicData-owned dashboard. It shows when looking as yourself, in View as at any school and any role (Teacher, SMT, Admissions, School-Admin, head office), and in a peek.
    - The pages: Teacher's phases and custom VicData dashboards, SMT's four, Admissions' two, meeting templates, and any other config-driven VicData dashboard. The group dashboards aren't config-driven yet (see below). List every page, and whether it registers its dashboard (`useRegisterVicDataDashboard`).
    - Any page that should and doesn't gets fixed.
  - **Who:** every platform admin, not just Guy. Search for any check tied to Guy's own user ID or email, and replace it with the platform-admin check. Show how a second platform admin is added; if that's a database step, give Guy the command.
  - **What an edit changes:** the **VicData-owned dashboard definition itself**, so a publish applies to **all users** at every school that sees that dashboard. It doesn't change the viewed school's or role's own copy. The school and role being viewed only feed the editor's live preview.
    - If any dashboard is drawn from a per-school or per-user copy rather than the published VicData definition, list it, and say how members pick up a publish.
  - **Versioned, as now:** saving writes a draft. Publishing writes a new immutable row in `dashboard_versions` via `publish_dashboard` (the version number, `change_summary` and `created_by` = the editor's own user), and points `published_version_id` at it.
    - Check that this still holds when the editor is opened in View as or head-office View as: the writes must use the admin's own session, never the viewed school's.
    - **R-EDIT-PUBLISH-ALL** proves it with a sandbox test in PGlite: an edit made in View as SMT at Leighton Park is published as version n+1 by the admin, and a different school's SMT member then loads n+1.
    - Also confirm that earlier versions can be listed, and that a previous version can be restored as a new version.
  - **Editing must never damage a dashboard (Guy, 17 Oct).** What's known, from the app database's published configs on 17 Oct:
    - **SMT** (Overview v1, Academic v1, Pupils v1, Context v2) and **Admissions** (Pipelines v2, Market share v1) are config-driven. Every view in them is registered, and `DV-ADM-M-FLAGS` is registered but not used.
    - Each has a **2-wide large panel** (`span: {cols: 2, rows: 1}`). Some views draw two graphs side by side inside one view's renderer: they're composites, not two config entries.
    - The SMT and Admissions configs also carry `name` on panels and `features` (`levelChips`, `entryPointChips`, `admissionsFilters`), which Teacher's don't.
    - **The group dashboards aren't in the config system at all.** There's no `DV-GRP-*` registry entry and no `dashboards` row, so the editor can't edit them.

    The guarantees, each with a test:
    1. **Round trip, no change:** for each of the 10 VicData dashboards (Teacher's 4, SMT's 4, Admissions' 2), open it in the editor, save a draft and publish without touching anything, in PGlite seeded with the real published configs. The new version's config must be byte-identical to the old (apart from version metadata).
    2. **Nothing dropped:** every editor operation (add, remove, reorder, move, resize, rename, set default) carries every field it doesn't change. That includes `span`, `name`, `features`, `override`, `legacy`, `defaultViewByResults`, `defaultViewByState`, `params` and `variants`, plus any unknown key. Test each operation with a fixture holding all of them.
    3. **Large panels:** moving, resizing or reordering keeps 2-wide panels valid in their layout. A change that can't fit is refused with a message; it never silently shrinks or drops a panel. Test it on SMT's and Admissions' layouts.
    4. **Only views the panel can draw:** the picker offers only dataviews whose `host` belongs to that dashboard's family. Teacher views go into Teacher panels, SMT into SMT, Admissions into Admissions. `validateConfig` refuses to publish anything else, and anything unregistered.
    5. **The preview draws what members will see:** the editor's live preview renders every SMT and Admissions view, including the side-by-side composites, at panel size and at the large (fullscreen) size, for the school being viewed.
       - List every composite view.
       - Screenshot each one in the editor's preview beside the live page.
       - A view the preview can't draw blocks publishing, with a message saying which.
    6. **Before publish:** the editor shows the change summary (what was added, removed, moved or renamed). Publish needs it confirmed and a `change_summary`.
    7. **Undo:** restoring a previous version creates a new version with that config, byte-identical. Test it on an SMT dashboard.
    8. **Groups:** no Edit switch on the group dashboards this round, because they aren't editable. Log "make the group dashboards config-driven" for Guy, with the views it would need.

    **None of this publishes to production:** every edit and publish test runs in PGlite.
  - **R-EDIT-FOOTER-EVERYWHERE:** for each config-driven VicData dashboard page (Teacher, SMT, Admissions, custom VicData dashboards and meeting templates), as yourself and in View as SMT at Leighton Park, the Edit switch renders and opens the editor with that page's dashboard. For a non-admin, it never renders.
- **Read-only** for the school's own data (shared sets, rankings, People, Teams, catchment, Admissions lists), as now. The viewer's own trial state stays under `~trial~` keys.
- **Logging:** View as is never counted as the school's usage. Each start and change writes one row to `platform_audit_log` (who, school, role, when).
- **Claude Code and harnesses:** keep `?lookAs=&as=&peek=1` as the scripted, read-only way in. Check platform admin on the server too. Document it in `AGENTS.md`, with an example for each product, including SMT and head office.
- **Retire the destructive testing switcher** (`testing-membership.ts`, its route and its hidden UI). Before removing it, confirm with a search that nothing else uses it.

### B. Members with more than one role, or more than one school

- **No View as UI ever.** This is the members' own access, nothing more.
- **Role switch:** one switch, in the app nav, shown only to someone holding more than one of Teacher, SMT and Admissions at the shown school. It moves between those products' homes (today's `LensSwitch`, lifted from the /teacher home into the nav, and the same on SMT and Admissions pages). School-Admin is an admin capability, not a role to switch to.
- **School switch:** for someone with approved memberships at more than one school, one school picker in the account menu (today's `?school=URN`, remembered).
- **Head office:** the group switcher stays as is.
- **Prove the separation:** a test that signs in as a non-admin member with Teacher and Admissions roles, and asserts no View as element appears anywhere, while the role switch does.

### One module, one check

- `src/lib/view-as.ts` is the only place that decides "who is this page for": a member, a View as, head office, or a peek.
- Every route resolves its caller through one server helper. It returns `{ urn, roles, access: member | viewAs | headOffice | peek, readOnly }`, and it reads `school_accounts` with the service role after confirming platform admin.
- Replace the per-product copies with it:
  - `smtCaller`;
  - Admissions' member;
  - the groups' caller;
  - the `isPlatformAdmin` checks in the Teacher and Data View routes.
- Alternatively, add a `school_accounts` SELECT policy for platform admins (`is_platform_admin()`). If you do, write it as a migration, test it in PGlite, and don't apply it. Say which approach you chose, and why.

## Tests

- **R-VIEW-AS-ANY-SCHOOL:** View as SMT, Admissions and School-Admin at Leighton Park (no membership for the viewer), and at a school with no members at all. Each dashboard draws, the Edit switch shows, and saves are refused as read-only.
- **R-VIEW-AS-HEAD-OFFICE:** View as head office of Dukes, then Harris, through the same switcher.
- **R-VIEW-AS-ADMIN-ONLY:** no View as element renders for a non-admin, on every product page; the server refuses the cookie and `?peek` for non-admins.
- **R-ROLE-SWITCH:** a member with Teacher and Admissions sees the role switch in the nav and moves between homes. A single-role member sees none.
- **R-VIEW-AS-LOGGING:** no usage events in View as; one audit row per start or change.

## Ground rules

- **Branch `v0.8-view-as` from current `main`, fetched over HTTPS,** in the worktree above. Commit this prompt as the first commit. If you'd have to edit a harness file the database load round owns, don't: list the conflict, and leave that piece for Guy.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness. Members' pages must be byte-identical. The allowed differences are the removed View as entry points, the new messages and the role switch in the nav.
- **No database writes.** A migration is written and tested, and Guy applies it.
- **Never put a server key in client code.** Stage files by name. Leave Guy's untracked files alone. Push over HTTPS.
- **Log calls** under "2026-10-xx — View as" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/view_as_report_v1.md`. Include:
- every entry point, kept or removed;
- the one caller helper, and which routes moved to it;
- screenshots:
  - View as SMT, Admissions and head office at Leighton Park, Harris and Dukes, with the edit bar;
  - the wrong-role message with Switch to SMT;
  - the members' role switch;
  - a non-admin member's nav, with no View as;
- the parity summary;
- any migration and its command.

Also list:
- every Edit-switch page, with its test result;
- the publish-to-all proof;
- the eight editing guarantees, with each one's test result;
- the composite views, with their preview screenshots.

**Merge if clean and no migration is needed** (otherwise push and stop):

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-view-as -m "0.8 View as: any school and role for staff in one place, a role switch for members" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

Then remind Guy that the change goes live with a Render deploy.
