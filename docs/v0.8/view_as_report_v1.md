# 0.8 View as: report

Branch `v0.8-view-as`, from `main` at `824e2fb`. Prompt: `docs/v0.8/vicdata_0_8_view_as_claude_code_prompt_v1.md`. The round ran unattended; every call is logged under "2026-10-17 — View as" in `docs/OPEN_QUESTIONS.md`. **No migration. No database writes.**

## The bug (17 Oct), fixed

On /account, "View as SMT at Leighton Park" left the SMT dashboards saying "To see a school's SMT dashboards, use View as", with no dashboard and no edit bar.

- **Cause:** the SMT and Admissions member loaders read the viewed school's `school_accounts` row with the admin's own client. RLS showed them nothing at a school they aren't a member of.
- **Fix:** the loaders now ask the server, `GET /api/view-as/caller`. The server reads the account (and the saved catchment) with the service role, but only after it has confirmed a platform admin.
- **Same fix applied to** the four other places with the same pattern:
  - `viewAsSchool` (library and meetings);
  - `loadAdminSchool` (People, Teams, the account menu);
  - the catchment read (`catchment-client`, `catchment-server`);
  - SMT Pupils' entry points (`smtCaller` now gives View as a server reader).
  
  The Admissions lists route reads with the caller's reader too.
- **Any school works:** at a school with no members or no school account, the page still draws, with nothing saved. Test: R-VIEW-AS-ANY-SCHOOL.

## The one caller helper

`resolveCaller(request, urn, { allowed, refusal, headOffice?, visibleRow? })` lives in `src/lib/view-as-server.ts` (server-only). It returns `{ urn, roles, access: member | viewAs | headOffice | peek, readOnly, supabase, reader, … }`. The decision itself is `decideCaller` in `src/lib/view-as.ts`, which is pure and tested.

- **`supabase`** is the caller's own token. Every write goes through it.
- **`reader`** is the caller's own client for a member. For View as, peek and head office it is the service role, used only after the checks.
- **A member without a View as cookie** is decided by their membership alone: no extra call (tested).
- **No `school_accounts` policy:** a policy would widen what the admin's browser client reads everywhere.

Routes moved to it:

| Before | Now |
|---|---|
| `smtCaller` (SMT's 7 routes) | `resolveCaller` with `canSeeSmt` and head office |
| `admissionsCaller` (Admissions' 6 routes) | `resolveCaller` with `canSeeAdmissions`; reads with `reader`; `PUT /lists` refused when read-only |
| `isPlatformAdmin` fallback in Teacher's 11 routes and the Data View's 6 | `resolveCaller({ visibleRow: true })`: the same membership query as before |
| `/api/usage` | `resolveCaller`: only `access: member` is logged |
| new `/api/view-as/caller` | what a View as page needs about the viewed school |
| groups' `groupCaller` | stays in `groups/server.ts`, because it decides a group, not a school. It reads the head-office View as from the one cookie, and the peek, through `view-as.ts` |

`viewAsForRequest` (saved comparator sets, School-Admin's People route) was already in `view-as.ts` and is unchanged.

## Entry points

| Entry point | Now |
|---|---|
| /account View as card | **Kept**, the same panel |
| Account menu → "View as…" | **New**: the one place to start it (platform admins only, in View as too) |
| Nav pill | **Kept**, only while viewing ("SMT · Leighton Park School", "Head office · Harris Federation") |
| Banner | "Viewing as SMT · Leighton Park School · (Edit · Preview draft) · Change · Back to me". Start fresh moved into the switcher |
| Footer "View as…" | **Removed** |
| Platform "Look at it as…" | Now "View as…": opens the switcher pre-filled |
| Group accounts "View as head office" | Opens the switcher pre-filled with the group |
| SMT / Admissions "View as…" buttons | **Removed**. A platform admin not in View as reads "…use View as in your account menu." |
| Wrong role | "You're viewing Leighton Park School as Teacher. SMT dashboards are for SMT and the School-Admin." plus **Switch to SMT** (Admissions: Switch to Admissions), which changes the role in place |
| Head-office View as (own cookie) | **Folded in**: head office is a role in the one switcher and cookie. groups r1's cookie is ignored and cleared |
| `?lookAs=&as=&peek=1` | **Kept, now for every product**: SMT, Admissions and head office (`as=head_office`). The page's API calls carry it in a header; the server honours it for platform admins only, read-only. Documented in `AGENTS.md` with an example per product |
| Testing switcher (`testing-membership.ts`) | **Retired**. Its route and UI had gone in 0.6 S3b. The search found one user, the preview-session sign-in's starter school, which is now an add-only grant in the route |

**Members (part B):**
- **The role switch** is in the nav (`NavRoleSwitch`), only for a member holding 2+ of Teacher, SMT and Admissions at the shown school. It was lifted from the /teacher home.
- **The school picker** is in the account menu, only with memberships at 2+ schools.
- **Neither ever draws in View as or a peek.**

## Tests

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors. 2 warnings, both in files this round doesn't touch (`PeerTrendChart.tsx`, `SchoolMap.tsx`), as on `main` |
| `next build` | clean (on the final tip) |
| Unit (`find src -name '*.test.ts'`, group fixtures env, `--test-force-exit`) | **486 / 486** (59 files) |
| Catalogue unit | 77 / 77 |
| Rules (`scripts/catalogue-rule-tests.ts`) | **107 pass, 0 fail** (15 manual, 19 without a check, 4 superseded) |
| PGlite / RLS (all 19 suites in `supabase/tests`) | **all pass**: v06 RLS, v07 Admissions RLS, groups r1 (102), usage log, catchment 31/31, the editing suite 44/44, … |
| Parity | below |

The round's own tests:

| Test | File | Result |
|---|---|---|
| R-VIEW-AS-ANY-SCHOOL (SMT, Admissions, School-Admin at Leighton Park, at a school with no members, at one with no account; saves refused) | `src/lib/view-as-round.test.ts` | pass |
| R-VIEW-AS-HEAD-OFFICE (Dukes, then Harris, one cookie; the old cookie means nothing) | same | pass |
| R-VIEW-AS-ADMIN-ONLY (planted cookie and peek ignored for a non-admin; member path makes no admin call; View as elements only in the admin-gated components) | same | pass |
| R-ROLE-SWITCH (Teacher + Admissions gets it; single role and School-Admin don't; none in View as) | same | pass |
| R-VIEW-AS-LOGGING (no usage in View as or peek; one audit row per start or change; nobody else can start one) | same | pass |
| The peek, every product | same | pass |
| R-EDIT-FOOTER-EVERYWHERE: SMT and Admissions loaders reach the dashboard in View as SMT at Leighton Park; every config page registers | `src/lib/view-as-pages.test.ts` | pass |

Run: `npx -y tsx --test --test-force-exit src/lib/view-as-round.test.ts src/lib/view-as-pages.test.ts src/lib/view-as.test.ts` gives **23 / 23**. They run the real route handlers against a stand-in Supabase (`src/lib/view-as-testkit.ts`).

## Editing

Details, commands and results are in `docs/v0.8/view_as_editing_notes.md`.

**Every Edit-switch page:**

| Page | Registers (`useInPlaceEdit`) | Test |
|---|---|---|
| `/teacher/ks4`, `/teacher/ks5` (Candidates · Results) | yes | pinned by the Teacher test; page-registration check |
| `/dashboards/[id]` when VicData's | yes | registration check |
| SMT's four | yes, now also in View as at any school | R-EDIT-FOOTER-EVERYWHERE |
| Admissions' two | yes, now also in View as at any school | R-EDIT-FOOTER-EVERYWHERE |
| Meetings | no: no VicData-owned meeting template exists | — |
| Group dashboards | no: not config-driven (guarantee 8) | — |

- **Who can edit:** every platform admin. No check names Guy. To add a second admin, a database step for Guy (see below).
- **What a publish changes:** the VicData definition, for every school. No per-school copy. Members fall back to the copy in code only when the store can't serve a version.

**Publish-to-all proof (R-EDIT-PUBLISH-ALL, PGlite):**
1. A second platform admin, with no membership, in View as SMT at Leighton Park, publishes SMT Overview as n+1. `created_by` is that admin, and `published_version_id` moves.
2. An SMT member at Acland Burghley then loads n+1.
3. Members can't publish or write drafts.

**The eight guarantees:**

| # | Guarantee | Result | Fix |
|---|---|---|---|
| 1 | Round trip, no change, on all 10 real configs | pass (byte-identical) | none needed |
| 2 | Nothing dropped by any op | pass | `copyRow` now carries unknown keys |
| 3 | 2-wide panels stay valid | pass | `removeColumn` refuses rather than shrinking a 2-wide panel |
| 4 | Only that family's views | pass | `validateConfig` refuses another family's view |
| 5 | Preview draws what members see | pass at panel size; blocked publish names the view | `previewGaps` / `publishBlockers`. **Gap:** the editor has no large (fullscreen) preview |
| 6 | Change summary before publish | pass | publish refuses a blank summary |
| 7 | Restore is a new, byte-identical version | pass (SMT Context) | — |
| 8 | Groups not editable | confirmed | logged: make them config-driven |

- **Differences from Teacher's pattern, removed:**
  - SMT and Admissions registered only after a member lookup that failed in View as. This was the bug, now fixed.
  - SMT and Admissions ignored "Preview draft". They now draw the draft, as Teacher does.
- **Left as is (logged):** the editor host for SMT and Admissions gets the school but not the page's pills.
- **Composite views:**
  - DV-ADM-P-SHAPE and DV-ADM-M-SHAPE;
  - DV-ADM-M-BARS, DV-ADM-M-MOMENTUM, DV-ADM-P-PIPELINE, DV-ADM-P-AREA-POP;
  - DV-SMT-A-GRADES, DV-SMT-A-AREAS, DV-SMT-A-VA;
  - borderline: DV-SMT-P-SHAPE and DV-SMT-C-MAP.
  
  No preview-beside-live screenshots were taken. They are a check by eye (below).

## Screenshots

In `docs/v0.8/view_as_screenshots/` (README there). They were drawn from the branch's built components in headless Chrome, on fixtures with a stand-in Supabase:

- `01`, `01b`: View as SMT at Leighton Park, banner and footer Edit.
- `02`: View as Admissions, banner and Edit. **The Chase**: there's no Leighton Park Admissions fixture.
- `03a`: head office of Harris. `03b`: head office of Dukes.
- `04`: the wrong-role message with Switch to SMT.
- `05`: the members' role switch.
- `06a`, `06b`: a non-admin member's nav, footer and account menu, with no View as.
- `07a`, `07b`: the admin's account menu with "View as…", and the panel with Head office.

## Parity

Full detail is in `docs/v0.8/view_as_parity.md`. Base is `824e2fb`. Fixtures came from each tree's own code and were byte-identical in every pair.

| Harness | Pairs | Result |
|---|---|---|
| Teacher walker (all 7 case sets) | 2,875 | 2,874 identical, 1 render noise, 0 unexpected (3 error files: the README's known flake, on both trees) |
| Teacher import graph: Data View, public page | — | 0 changed files in either graph |
| Public page SSR (137625, 117037) | 2 | identical |
| Teacher nav, account menu, footer (added check) | 16 | identical |
| Admissions | 328 | identical |
| SMT pages | 312 files | DOM all identical; 26 PNGs at 1–15/255, cleared on recheck |
| SMT homes | 20 | 12 identical; 8 differ **only by the allowed role switch** moving from the /teacher home into the nav (the harness's `multi` member) |
| SMT builders, field by field | 32,956 fields | identical |
| Groups dashboards | 192 files | 191 identical; 1 PNG differs by 2 px, identical on 2 rechecks |

- **Not exercised by any harness:**
  - the platform-admin messages (no harness signs in as a platform admin);
  - the multi-school account-menu rows (no stub member has two schools).
- **Committed after the parity run:** the wrong-role screens now draw the View as banner too.
  - Only a platform admin's View as sees it: the banner draws nothing without the cookie.
  - The screenshots' review found it missing: `04` was shot before the fix.

## Migration

None. The one database step is optional: adding a second platform admin. The person must have signed in once.

```sql
insert into public.platform_admins (profile_id, note)
select id, 'Platform admin, added by Guy' from public.profiles
where email = 'their.email@example.com'
on conflict (profile_id) do nothing;
```

## Checks by eye for Guy (live, after the Render deploy)

1. View as SMT at Leighton Park from the account menu: the dashboards draw, with Edit in the footer and the banner.
2. View as Admissions at Leighton Park: the same.
3. View as head office of Harris, then Dukes: the group home and dashboards. Back to me.
4. View as Teacher on /teacher/smt, then Switch to SMT.
5. Each composite view in the editor's preview beside the live page, and fullscreen on the live page (the editor has no fullscreen preview).
6. A member with two roles: the nav's role switch.
