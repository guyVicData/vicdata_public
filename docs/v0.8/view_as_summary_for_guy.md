# View as: summary for Guy (17 Oct)

**Not merged yet: ready to merge.** Every check was clean and there's no migration, so by the prompt's rule it should merge. But the final push to `main` was refused by this session's permission guard ("merge without review"). The branch `v0.8-view-as` is pushed. The merge command is under "What you need to do". After that it goes live with a **Render deploy**.

## What's done

- **Your bug:** "View as SMT at Leighton Park" now draws the SMT dashboards, with the edit bar. Admissions works the same way.
  - It works at any school, including one with no members or no school account.
  - The server reads the viewed school's account with the service key, only after it has checked you're a platform admin. No new RLS, no migration.
- **One View as, for staff only:**
  - **Where it starts:** the account menu's "View as…" (or the /account card).
  - **Head office of a group** is now a role in the same switcher, using the same cookie.
  - **The banner:** "Viewing as SMT · Leighton Park School · Edit · Preview draft · Change · Back to me".
  - **Wrong role:** "You're viewing … as Teacher. SMT dashboards are for SMT and the School-Admin." with a Switch to SMT button.
  - **Gone:** the footer's "View as…" and the buttons on the SMT and Admissions messages. Platform and Group accounts now open the switcher pre-filled.
  - **Read-only:** saves are refused.
  - **Logging:** View as never counts as usage, and each start or change writes one audit row.
- **The scripted peek** (`?lookAs=&as=&peek=1`) now works for SMT, Admissions and head office too. It's documented in `AGENTS.md`.
- **One caller helper** (`src/lib/view-as-server.ts`) decides who every SMT, Admissions, Teacher, Data View and usage request is for.
- **The destructive testing switcher is retired.**
- **Members:**
  - The role switch moved into the nav, shown only with two or more roles.
  - A school picker is in the account menu, shown only with two or more schools.
  - No View as UI ever shows for them.
- **Editing:** all eight "never damage a dashboard" guarantees are tested on the 10 real configs, in local test databases, along with the publish-to-all proof. Five editor fixes came out of it, for example:
  - "fewer columns" refuses instead of shrinking a 2-wide panel;
  - a view the preview can't draw blocks Publish.
  
  SMT and Admissions now honour "Preview draft".
- **Checks:**

  | Check | Result |
  |---|---|
  | tsc | clean |
  | eslint | 0 errors |
  | build | clean |
  | Unit | 486 / 486 |
  | Rules | 107 pass, 0 fail |
  | Local database tests (RLS, usage log) | all 19 suites pass |
  | Parity: Teacher, Admissions, SMT, groups, Data View, public page | no regressions; the only difference is the allowed role switch |

- **Report:** `docs/v0.8/view_as_report_v1.md`. **Screenshots:** `docs/v0.8/view_as_screenshots/`.

## Decided unattended (for you to confirm)

All are under "2026-10-17 — View as" in `docs/OPEN_QUESTIONS.md` (items 1–23). The ones most worth a look:

1. **Server helper, not a policy:** the service role reads after the platform-admin check, rather than adding a `school_accounts` RLS policy.
2. **Your own school:** a platform admin who is also a member, in View as of their own school, is the viewed role and read-only.
3. **Wrong role on the server:** View as Teacher at SMT or Admissions is refused by the server, as a Teacher is.
4. **Usage:** a platform admin's View as no longer writes a "platform_admin" usage row.
5. **Start fresh** moved off the banner into the switcher. **Back to me** goes to /teacher, head office's included.
6. **The role switch** is in the desktop nav only, and only with the config renderer, the same gate the home's lenses had.
7. **The peek** reaches the server in an `x-vicdata-peek` header, added by a fetch wrapper on peek pages only.
8. **The editor:**
   - `removeColumn` refuses rather than shrinking a panel;
   - Publish is blocked by config problems and preview gaps;
   - a view from another family is a config problem;
   - Publish needs a summary.
9. **Not built:**
   - the editor's fullscreen preview;
   - passing SMT's and Admissions' pills to the editor;
   - making the group dashboards config-driven (the views they'd need are listed).

## What you need to do

- **Merge** (command below; the push was refused here), then **a Render deploy** to put it live.
- **Optional:** add a second platform admin (SQL in the report, "Migration").
- **Checks by eye on the live site:**
  1. View as SMT at Leighton Park, then Admissions there. The dashboards and Edit should show.
  2. Head office of Harris, then Dukes.
  3. View as Teacher on SMT, then Switch to SMT.
  4. A two-role member's nav switch.
  5. The composite views in the editor's preview beside the live page, and fullscreen on the live page.
  
  The Admissions screenshot shows The Chase, not Leighton Park.

## How to merge

`main` hadn't moved since the branch started (the database load round isn't merged), so nothing needed rebasing. I made the merge in this round's worktree, on `main`'s tip, and `npm run build` passed on it. The push was then refused. To merge it yourself:

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-view-as -m "0.8 View as: any school and role for staff in one place, a role switch for members" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

- Your shared checkout `~/dev/vicdata_public` is on `main`, 17 commits behind origin, with your own uncommitted docs. `git pull` brings it level.
- The branch adds `docs/v0.8/vicdata_0_8_view_as_claude_code_prompt_v1.md`, which is untracked there with the same content. Git will refuse to overwrite an untracked file, so move or delete that copy first.
- If the database load round merges first, rebase onto it and rerun the checks before merging.
