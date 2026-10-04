# VicData 0.6, snagging round 2: report

Branch `v0.6-snag2`, from `main` (934a461), pushed. **Not merged.**

| Commit | Item |
|---|---|
| `ef71f74` | A: "Try VicData as…" on `/account` (trials as a mode of look-as) |
| `596017f` | B: an Edit switch in the footer (and in the trial banner), editing VicData dashboards in place |
| `63e1c96` + this commit | OPEN_QUESTIONS entry, this report |

On each commit, `tsc --noEmit`, eslint (changed files) and `next build` are clean.

**Both items are for platform admins only.** Members never render any of it: a member's `/teacher/ks4` with the flag off is byte-identical before and after item B, in both themes.

## The school search Guy was using

The S3b fix 5 removed the old testing switcher from `/account`. What was left was **Platform's own search box**, which filters `platform_school_overview()`, so it only lists schools that **already have an account**.

The new card uses the site's **`SchoolSearch`** instead (the `search_schools` RPC: every open school), so a school with no account, such as Croydon College, can be tried. `SchoolSearch` gained two optional props: `byUrn` (a 5–7 digit query looks up the URN) and `allowRequest={false}` (no "Can't find your school?" form).

## A — "Try VicData as…"

**The card** sits at the top of `/account` and is for platform admins only:
- a school search;
- role chips (Teacher · SMT · Admissions · School-Admin), single select, Teacher by default, with People's styling;
- **Start fresh**, ticked by default the first time for each school + role;
- **Open their home page**;
- **Recently tried**, the last 5, each with Open and Start fresh.

**One mechanism.** A trial is a mode of 0.6's look-as: the same URL pair, the same `confirmLookAs`, and the same audit log. Each start and each Start fresh logs `try_as` with `{role, fresh, via}`. Platform's "Look at it as…" buttons land in the same mode. A hand-typed URL does nothing for anyone else.

**The member's experience:**
- that role's home page (the config renderer is always on in a trial);
- no role switch;
- the 4-step walkthrough on first entry to GCSE and to Post-16;
- the key dashboards, Meetings and Recruitment as that role is offered them.

A banner shows on every page: *Trying VicData as SMT at Croydon College · Change · Start fresh · Exit*.

**How the trial context is keyed.** The state key is `{urn}~trial~{role}`, e.g. `130432~trial~smt`.

| Where the trial writes | How it's kept apart |
|---|---|
| Preferences (ticked subjects, settings), notes, walkthrough progress, last-seen, per-dashboard state | The existing `school_urn` text column of `teacher_view_preferences`, `_notes`, `_onboarding` and `dashboard_user_state` holds the state key. No schema change, and no existing row or RLS touched. |
| Personal dashboards, meetings, recruitment jobs | A new nullable `trial_key` column on `dashboards` (personal rows only, by CHECK) and on `recruitment_jobs`. Lists show only the matching trial's rows, and Guy's own lists ignore trial rows. |
| The trial itself (Recently tried, the Start-fresh default) | A new table, `trial_contexts`, readable and writable only when `profile_id = auth.uid() and is_platform_admin()`. |

The trial is **invisible to the school:**
- no membership is created, so it never appears in People, Teams, join requests, member counts, caps or tier;
- no sign-in event is recorded while trying;
- the trial never writes the school's shared data (shared saved sets, teams, school dashboards).

**Migration** (written and tested on PGlite, **not applied**): `supabase/migrations/20261105090000_v06_snag2_trials.sql`. It adds `trial_key` to `dashboards` and `recruitment_jobs`, creates `trial_contexts` with its RLS, and adds `reset_trial(p_urn, p_role)` (Start fresh: clears walkthrough and saved state, platform admin only).

```
supabase db query --linked -f supabase/migrations/20261105090000_v06_snag2_trials.sql
supabase migration repair --status applied 20261105090000 --linked
```

**Until it's applied,** trials still work. Recently tried and Start fresh fall back to this browser, and creating a personal dashboard, meeting or job inside a trial says it needs the database update. It never writes to Guy's own.

**Tests:**
- **PGlite**, `supabase/tests/v06_snag2_trials_pglite.mjs`: 30/30. A non-admin can't create or read `trial_contexts` rows or call `reset_trial`, and Guy can. A reset clears only his rows under that key; his own normal rows, his other trials and other users' rows all survive.
- **Headless harness** (real page, stubbed store recording every write): 28/28, with the migration applied and unapplied.
  - At Croydon College (130432) as Teacher with Start fresh: the home page shows, and GCSE runs the walkthrough.
  - A ticked subject survives Exit and re-entry, with no second walkthrough.
  - SMT gets a different home and its own walkthrough state, and Start fresh brings the walkthrough back.
  - No membership, team or sign-in writes are made. Guy's own `/teacher` text and rows are identical before and after.

## B — the Edit switch

- **The switch:** a small **Edit** on/off switch in the footer, after "Sources & methodology", in the same text style. It shows only to platform admins, and only on `/teacher/[phase]` (under the config renderer, after the walkthrough) and on VicData-owned `/dashboards/[id]`. It's off by default and remembered in this browser.
- **On:** the **same editor** as `/dashboards/[id]/edit` opens **in place**, at the same URL, on the same dashboard, with the page's school and subject as the live preview. **Exit** (or the switch) puts the page back exactly where it was: focused subject, open rows, scroll.
- **Off:** no super-admin chrome at all. The old top-bar Edit link and the placeholder panels are gone from the Teacher page; it looks as a member sees it.
- **Inside a trial:**
  - Edit starts off. The banner adds *· Edit · Preview draft ·*, and while editing it reads *Editing the VicData dashboard for all schools · previewing as Teacher at Croydon College*.
  - **Edits are made as Guy.** Drafts and versions are written under his own identity (`created_by` / `updated_by` = his profile) to the VicData dashboard, never with a trial key. The trial's school and role only feed the preview.
  - With Edit off, the trial shows the **published** version. **Preview draft** shows the draft as the member would see it, in this tab only, without publishing.
- **Tests:** 35/35 in the headless harness.
  - A non-admin never gets the switch or the editor, even with it stored on.
  - In a Croydon College Teacher trial:
    - Edit on, rename a Column 1 panel; the draft is saved as Guy;
    - Edit off with nothing published: not shown, and the page is back where it was;
    - Preview draft shows it;
    - after Publish (version `created_by` Guy), the trial shows it;
    - the trial's ticked subject and walkthrough rows are unchanged throughout.

## Screenshots (`docs/v0.6/snag2_screenshots/`, dark and light)

- **A:** `A-card`, `A-banner-walkthrough` (the banner over the GCSE walkthrough), `A-smt-home`.
- **B:**
  - `B-footer-switch-off`, `B-footer-switch-on`, `B-teacher-edit-bar`;
  - `B-trial-banner-edit`, `B-trial-banner-editing`;
  - `B-member-flagoff-before-ef71f74` / `-after`: members unchanged.

## Logged

`docs/OPEN_QUESTIONS.md`, "2026-10-04 — 0.6 snagging round 2". The main calls:
- **A:**
  - `look_as` becomes `try_as`;
  - `&peek=1` keeps read-only look-as for the Catalogue's parity frames only;
  - Start fresh keeps the trial's dashboards, meetings and jobs;
  - a trial has no super-admin chrome;
  - a School-Admin trial can't manage People or Teams or create school dashboards, because that writes the school's data;
  - no comparator-set saving in a trial;
  - the trial lives in this tab only.
- **B:**
  - the editor opens in place rather than on a new page;
  - the Teacher page shows Guy no admin chrome with the switch off;
  - the switch appears only under the config renderer;
  - Preview draft is trial-only;
  - the editor now saves pending edits when it closes;
  - Add a view in the editor still offers every view;
  - the live preview on `/dashboards/[id]` gets the school but not the subject.

## Click-through for Guy on live, after merging

Apply the migration first (commands above). Trials work without it, but Recently tried and Start fresh stay in this browser.

1. **`/account`:** the **Try VicData as…** card is at the top.
   - Search **Croydon College** (or 130432), pick **Teacher**, keep Start fresh ticked, and click **Open their home page**.
   - Teacher's home loads with the banner and no role switch. **GCSE** runs the 4-step walkthrough.
   - Tick a subject, **Exit**, then re-enter from Recently tried: the subject is still ticked and there's no walkthrough.
2. **Change** → **SMT**: a different home page, with its own walkthrough state.
3. **Start fresh** in the banner: the walkthrough runs again.
4. Check that the school's People list (as its School-Admin, or via Platform) doesn't show you.
5. Exit, then check that your own `/teacher` is as it was.
6. **The Edit switch:** on `/teacher/ks4?renderer=config`, turn **Edit** on in the footer.
   - The editor appears in place. Exit, or the switch, brings the page back where you were.
   - Then try it on `/dashboards/vicdata.ks4.candidates`.
7. **Editing from a trial:** in the Croydon College Teacher trial, click the banner's **Edit** and rename a Column 1 panel.
   - With **Preview draft** on, the rename shows. With Edit and Preview draft off, it doesn't.
   - **Publish**: the trial shows it. Then restore the original from History and publish again.
8. **Check by eye:** a Leaflet map reappears correctly after Edit is turned off.

### Merge

```
git checkout main && git pull && git merge --no-ff v0.6-snag2 -m "0.6 snagging round 2" && npm run build && git push
```

Render deploys from `main`.
