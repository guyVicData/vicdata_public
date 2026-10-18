# VicData 0.8 — View as fixes: report

Round: `docs/v0.8/vicdata_0_8_view_as_fixes_claude_code_prompt_v1.md`, branch `v0.8-view-as-fixes` from `main` (cb26ef1). Calls are logged under "2026-10-18 — View as fixes" in `docs/OPEN_QUESTIONS.md`.

**In short:**
- **(a) and (b) had one cause.** After "Open their home page", the nav re-checked whether Guy is a platform admin. The navigation to the new page cancelled that check, the cancelled request read as "not an admin", and that cleared the View as cookie. `/teacher` then drew Guy's own membership, Acland Burghley.
- **Every entry point now lands on the chosen school and role.** That's 9 entry points, all tested in a real browser with realistic latency. A failed check keeps View as and offers Retry.
- **Head office of any group.** Harris and Dukes have no group account, and both open read-only from the group lookups.
- **Back to me:** a platform admin with no membership goes to Platform.
- **The migration that removes Guy's Acland membership is written and tested, not applied.**

## 1. The cause of (a) and (b)

**What the database showed (read-only, 18 Oct):**
- Each of Guy's clicks this morning did start a View as:
  - `platform_audit_log` rows 18–21 (`view_as`, 07:55–08:07 UTC);
  - `trial_contexts` updated.
- He was still left on his own school, and his browsing there was logged as **Acland Burghley usage**. The rows are `usage_events` 24–27, with membership `7dca67ce…`, Admissions pages at 07:55 and 08:07.
- The 201 on `usage_events` that the prompt mentions is one of those.

**Reproduced in a real browser.** I used the local production build against the app database: Playwright, Chromium, the account card, Leighton Park, SMT, Open their home page.

| Run | Admin check after the switch | `/teacher` shows | Cookie on arrival |
|---|---|---|---|
| Stub answering instantly (first run) | answered, mostly in time | Acland Burghley **once**; Leighton Park in 3 reruns | lost that once |
| That one check failing (`neterror`, or a 500) | failed | **Acland Burghley** | **gone** |
| That one check taking **150, 400 or 800 ms**, no failure | cancelled by the navigation | **Acland Burghley** (all three) | **gone** |

A browser in the UK reaching the live database takes a few hundred ms, so on the live site the check loses nearly every time.

**The sequence, as traced:**
1. `startViewAs` confirms the platform admin and writes the cookie. It then calls `window.location.assign("/teacher")`.
2. The cookie change re-renders the nav pill. The pill's effect calls `resolveViewAs`, which asks `is_platform_admin` again.
3. The navigation cancels that request ("Failed to fetch").
4. `confirmPlatformAdmin` read any error as "no". `resolveViewAs` then did `setViewAs(null)`, which deleted the cookie **before the page left**.
5. `/teacher` had no cookie, so it took Guy's own membership, Acland Burghley. The banner and pill were gone too.

**(b), the recent links:** they call the same `open()`, so they fail the same way. (a)'s "doesn't take him into the chosen school" is this too. The button itself works: a school picked in the search is held, and the button is enabled.

**The prompt's suspects:**

| # | Suspect | Finding |
|---|---|---|
| 1 | Cookie path, domain, SameSite, Secure | Ruled out. `Path=/; SameSite=Lax` (`Secure` on https), the same everywhere, then and now. The cookie was written, then deleted by our own code. |
| 2 | The resolved promise cached across the switch | Ruled out. `setViewAs` resets it. |
| 3 | `resolveViewAs` clears the cookie on any falsy check | **The cause**, set off by the navigation in (2) of the sequence. |
| 4 | `/teacher` picks a membership before View as resolves | Not so. It awaits `resolveViewAs`; there was simply no cookie left. |
| 5 | The button disabled until a result is clicked | Works as designed: the school is held in state, and the button is enabled once one is picked. |

## 2. The fixes

**The rule: only a definite "no" ends View as** (`src/lib/view-as.ts`).
- `checkPlatformAdmin` answers yes, no or unknown. An error, a timeout or a cancelled request is unknown, and it is asked again twice (0.4 s, then 0.8 s).
- `resolveViewAs` and `resolveViewAsGroup` clear the cookie only on "no".
- Still unknown after the retries: **View as is kept**, and the page draws the viewed school, never the admin's own. The banner adds "Couldn't confirm View as just now · Retry" (Retry reloads).
- `confirmPlatformAdmin` is true only on a confirmed yes. It is still what *grants* anything: starting View as, or a route's service-role read.

**No second check right after a start.** `startViewAs` and `startViewAsHeadOffice` have just confirmed the admin, so they tell the page View as is resolved. The page being left asks nothing. This removes the race itself, and the rule above covers any other failed check.

**The server says "try again", never "you're someone else":**
- With a View as cookie or a peek present, an unanswered admin check is now **502 "Could not confirm View as. Try again."** This applies to:
  - `resolveCaller` (`view-as-server.ts`), the one caller helper;
  - `groupCaller`;
  - the two `viewAsForRequest` routes (`view-as-people`, `saved-comparator-sets`).
- Before, it decided as the admin's own membership. At Acland Burghley, that meant his own data under the viewed role's banner.
- Without a View as, a member's request is decided exactly as before, with no admin call.

**Every entry point now lands.** They all go through the same start, and each is tested in the browser:
- the account card;
- the nav pill's popover;
- the recent links, both Open and Start fresh;
- the account menu's View as…;
- Platform's pre-fill;
- the banner's Change.

**Usage:**
- The browser no longer reports usage for a head-office View as or a peek. Before, only a school View as was skipped.
- The server already logged members only, and now also refuses when the check can't be answered.
- View as itself wrote no usage rows. The 27 rows at Acland are Guy as a member, including the four from this morning's broken switches; the migration removes them.

## 3. Head office of any group

**What Guy sees:** in the switcher, Head office → "Search groups by name or id". The search covers every group in the groups data: trusts, federations, Club ISS and Companies House. Each result shows its school count and "account" or "no account yet".

**How it works:**
- **Search:** the switcher uses Platform's own search (`/api/platform/groups?q=`, platform admins only, `groupIndex()`). The route now also returns each group's account, if it has one.
- **A group with an account** opens as now (its uuid in the cookie).
- **A group without one** is named `group:{group_id}` in the cookie, where the uuid would go. For example `group:3319` (Harris Federation) or `group:club_iss:dukes-education`. The peek takes the same form (`?lookAs=group:3319&as=head_office&peek=1`).

**What the server does with it (`groupCaller`):**
- Only after the server's own platform-admin check; anyone else's cookie reads nothing, as before.
- It looks for an account by group id first. A group that gets an account later opens as that account.
- Otherwise it builds the group's head office from the group lookups:
  - read-only;
  - `noAccount: true`;
  - only if the group has current members.

**What a group without an account gets:**
- Its home, Overview, Schools, Academic and Pupils dashboards, from the group lookups (`group_schools_lookup` and the aggregates), exactly as an account's head office sees them.
- Its member schools' SMT, read-only, where the school has VicData.
- **No** Access page: the route answers 404, and the page says "No group account yet, so no Access".
- **No** grants, no Admissions shares (each member school's Admissions reads as private), and no meetings or dashboards.
- The home says **"No group account yet."**

Head office's real access, through its own memberships, is unchanged.

## 4. Platform admins without memberships

**Where Back to me goes** (`ownHome`):
- with an approved school membership: their school's home;
- with a head-office membership: head office's home;
- otherwise, for a platform admin: **`/platform`**;
- anyone else: `/teacher`, which explains.

**Other fallbacks:**
- `/teacher` with nothing to show sends a platform admin to `/platform`.
- SMT's and Admissions' "use View as" messages for a platform admin with no school stay as they were. They don't fall back to a school.
- The preview sign-in route's starter school (100053) is now **never granted to a platform admin**. Otherwise, if its preview address were ever Guy's, his membership would come back.

**The membership and what depends on it.** This was read from the live catalogue (every foreign key to `school_memberships`) and the rows, read-only. Guy's only membership is `7dca67ce…` at Acland Burghley: roles admissions and teacher, `is_admin`, approved 21 Sep by the old testing switcher. **He is the only member of that school account.**

| Depends on the membership | Rows | What happens |
|---|---|---|
| `school_accounts` holder / pending holder | 0 | if any: set to null |
| other members' `approved_by` | 0 | if any: set to null, member kept |
| `saved_sets` / `saved_rankings` owned | 0 | if any: the migration **stops** (Guy decides) |
| `team_members` | 0 | cascade |
| `sign_in_events` | 13 | cascade (his own sign-ins) |
| `admissions_grants` | 1 | cascade (his own grant) |
| `usage_events` | 27 | **deleted by the migration**. The foreign key would leave them as anonymous Acland usage. |

**Also removed: the Admissions set-up made while testing.** Guy asked for this on 18 Oct: "they were for testing only and should not be seen by a member of their staff".
- That's 4 admissions lists (11+ and 16+ rivals and day feeders) and 2 entry points (11+, 16+).
- Only rows Guy wrote are removed, and only while nobody else belongs to the school account. With another member, they're kept.

**Kept:**
- **The school account and its 3 teams.** They are the automatic All staff, SMT and Admissions teams, made once when a school account is created and never again. A real member who joins later needs them. They have no members and hold nothing from testing.
- **Guy's own things, which no member of staff sees:**
  - the "school dashboard", which is in fact his personal meeting deck ("Autumn department meeting", `owner_scope` user, tied to the account);
  - his other dashboards, meetings and jobs;
  - his `teacher_view_*` rows under `100053` (no longer reached);
  - his View as state.

**The migration:** `supabase/migrations/20261116090000_v08_view_as_fixes_admin_membership.sql`.
- It acts only for a platform admin, and only on that profile's membership at 100053.
- It is idempotent: a second run finds nothing and does nothing.
- Its test is `supabase/tests/v08_view_as_fixes_pglite.mjs`, against a stub of the live tables with the live delete rules. **20 PASS, 0 FAIL.** It covers:
  - the live case;
  - the test lists and entry points removed, the automatic teams kept;
  - another school's lists untouched;
  - with another member at the school, the lists are kept;
  - nothing else changes;
  - a second run;
  - another member who relies on the membership;
  - owned sets stop it;
  - a non-admin is untouched.
- **Not applied.** After it is applied:
  - Acland Burghley's People list has no members, so it no longer shows Guy;
  - its Admissions has no lists or entry points.

## 5. Tests

**New unit tests** (`src/lib/view-as-fixes.test.ts`, the real module, helpers and routes against the View as round's stand-in Supabase): **8 PASS.**
- **The race:** after a confirmed start, there is no second check, and a cancelled request can't clear the cookie.
- **R-VIEW-AS-TRANSIENT:**
  - an error, and a cancelled request, each keep the cookie and the viewed school, and show Retry;
  - one failure then an answer is confirmed, with no Retry;
  - a definite no still clears;
  - the server returns 502 with a cookie and logs no usage;
  - a member without a cookie is decided as before, with no admin call.
- **R-VIEW-AS-ANY-GROUP:**
  - the cookie and peek forms, with malformed ones refused;
  - Harris and Dukes without accounts: their offices and their home (members from the lookups, no grants, not manageable);
  - Access 404 for both read and write, with nothing written;
  - a non-admin's cookie reads nothing;
  - a group with no members is no office;
  - a group with an account opens as the account.
- **R-PLATFORM-NO-MEMBERSHIP:**
  - `ownHome` gives `/platform` for an admin with no membership, the school for a member, the group for head office, and `/teacher` for anyone else;
  - the fallbacks are wired.
- **Negative control:** the race test and the transient test **fail on main's `view-as.ts`** and pass on the branch.

**Browser** (`docs/v0.8/audit_scripts/view_as_fixes/lands.mjs`): **18 PASS, 0 FAIL.**
- **Setup:**
  - the local production build against the app database, read-only;
  - every admin check from the browser delayed 300 ms, enough to lose the old race.
- **What's real and what's stubbed:**
  - Real: the pages, routes and data.
  - Stubbed, because minting a real session for Guy's account was refused by this session's safety checks:
    - the admin's identity and its admin check (`harness.mjs`, `server-preload.mjs`);
    - every write, which is answered locally and never sent.
- **R-VIEW-AS-LANDS**, all on the chosen school and role (cookie, banner, the page's school):
  - the account card;
  - then the SMT dashboards;
  - the banner's Change (pre-filled);
  - the pill's recent Open;
  - Start fresh;
  - both recent links on the account card;
  - the account menu's View as…;
  - Platform's pre-fill.
- **R-VIEW-AS-TRANSIENT:** a reload with every admin check failing keeps Leighton Park as SMT and shows Retry. Retry clears it once the check answers.
- **R-PLATFORM-NO-MEMBERSHIP:**
  - with no membership, Back to me goes to `/platform`, and so does `/teacher`;
  - with Guy's current membership, Back to me goes to his own home (as a member, no cookie).
- **R-VIEW-AS-ANY-GROUP:** Harris Federation (59 schools) and Dukes Education (25), both "no account yet":
  - the home says so, read-only, with no Access card;
  - each Overview dashboard draws from the real group lookups.

**Reruns of the View as round's tests:**
- unit, including R-VIEW-AS-ANY-SCHOOL, -HEAD-OFFICE, -ADMIN-ONLY, -LOGGING, R-ROLE-SWITCH and R-EDIT-*: all pass, in the 499/499 below;
- PGlite R-EDIT-* (`v08_view_as_editing_pglite.mjs`, run with tsx): 44/44.
- One existing assertion changed. "An error reads as no" (`view-as.test.ts`) encoded the cause. It now asserts that an error is "try again" (`ViewAsUnconfirmed`).

## 6. Screenshots

All in `docs/v0.8/view_as_screenshots_fixes/`, from the browser run.

| File | Shows |
|---|---|
| `01_account_card_leighton_smt.png` | Account card → Leighton Park, SMT: "Viewing as SMT · Leighton Park School", the SMT home |
| `02_smt_dashboards_leighton.png` | then the SMT dashboards, still Leighton Park |
| `03_banner_change_leighton_teacher.png` | the banner's Change → Teacher |
| `04_pill_recent_chase_admissions.png` | the nav pill's recent link → The Chase, Admissions |
| `05_start_fresh_leighton_smt.png` | Start fresh → Leighton Park, SMT |
| `06_account_recent_chase_admissions.png`, `07_account_recent_leighton_smt.png` | the account card's recent links (Guy's (b)) |
| `08_account_menu_chase_school_admin.png` | the account menu's View as… → The Chase, School-Admin |
| `09_platform_prefill_leighton_admissions.png` | Platform's pre-fill → Leighton Park, Admissions |
| `10_transient_error_keeps_view_as.png` | every admin check failing: still Leighton Park, "Couldn't confirm View as just now · Retry" |
| `11_back_to_me_platform.png` | Back to me with no membership → Platform |
| `12_head_office_harris_no_account.png`, `13_head_office_harris_overview.png` | Harris Federation without an account: "No group account yet", then its Overview |
| `14_head_office_dukes_no_account.png`, `15_head_office_dukes_overview.png` | Dukes Education, the same |

The stub's display name ("Platform Admin") is the harness's, not Guy's.

## 7. Checks and parity

On the branch, all clean.

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors (2 old warnings, `PeerTrendChart.tsx`, `SchoolMap.tsx`) |
| `next build` | clean |
| Unit (`src/**/*.test.ts`, `--test-force-exit`) | **499 / 499** (491 before + 8 new) |
| Catalogue unit tests | OK |
| Rule tests (`catalogue-rule-tests.ts`, real data, read-only) | **107 PASS, 0 FAIL** (MANUAL 15, NONE 19, SUPERSEDED 4). The first run had 1 FAIL, R-SMT-CONTEXT-GEOGRAPHY: its with-boundaries read came back empty after 26 s. On the rerun it passed (34 LSOAs within 5 miles). This branch doesn't touch it. |
| PGlite (all 19 suites, RLS and usage log included) | all pass. The new `v08_view_as_fixes_pglite` has 20/20; `v08_view_as_editing` 44/44, `v06_rls` 51/51, `v08_usage_log` 19/19, `v07_admissions_rls` 111/111, `v08_groups_r1` 102/102. |
| Browser (`lands.mjs`) | **18 / 18** |

**Parity against `main` (`cb26ef1`): no member-visible difference.** The branch working tree was compared with the harnesses from the earlier rounds. Members' pages are byte-identical, apart from render noise that matched on a retake.

| Harness | Pairs | Identical | Noise | Unexpected | Failed |
|---|---|---|---|---|---|
| Teacher walker (c5_0–3, rka, rkb, sv) | 2,875 | 2,873 | 2 (a Map PNG that matched on 3 reshoots; a 26×25 px box where main also differs from itself) | 0 | 0 |
| Public page SSR (137625, 117037) | 2 | 2 | 0 | 0 | 0 |
| SMT dashboards and home | 312 files | 309 | 3 (12 px on the Context tab's edge, identical DOM, 14/14 on retake) | 0 | 0 |
| SMT group dashboards | 168 files | 157 | 11 (≤ 2/255, identical DOM) | 0 | 0 |
| SMT subjects | 16 files | 13 | 3 (≤ 2/255, identical DOM) | 0 | 0 |
| Admissions | 328 | 328 | 0 | 0 | 0 |
| Groups dashboards (fixtures) | 170 files | 165 | 5 PNG-only (≤ 2/255) + Harris Overview dark 1440 not drawn in time (14/14 on 3 reshoots) | 0 | 0 |
| Data View | 60 files | 60 | 0 | 0 | 0 |

- **Fixtures:** byte-identical between the two trees in every harness.
- **Teacher errors files:** one per side, on different pages. Both are the known `SchoolMap` unmounted-map race, the same code in both trees.
- **Changed modules in the members' graphs:**
  - Teacher graph: `teacher/page.tsx`, `GroupHome.tsx`, `ViewAs.tsx`, `ViewAsBanner.tsx`, `usage-client.ts`, `view-as.ts`. The walker found no member-visible effect.
  - Data View and public page: none.
- **The first parity pass is discarded.** By mistake it used the old local `main` (`e8f621e`) as its base. Everything was rerun with the base set to `cb26ef1`.
- **Nothing was written to any database.**

## 8. Guy's commands, in order

The branch is merged to `main` and pushed. **It goes live with a Render deploy.**

**1. Deploy on Render** (manual deploy of `main`). Do this before step 2, so that the preview sign-in's new guard is live before the membership goes.

**2. Apply the migration** to the app database. It removes:
- your Acland Burghley membership and its 27 usage rows;
- the school's test admissions lists (4) and entry points (2).

It is idempotent.
```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261116090000_v08_view_as_fixes_admin_membership.sql && supabase migration repair --status applied 20261116090000 --linked && supabase db query --linked "select (select count(*) from school_memberships m join school_accounts a on a.id = m.school_account_id where a.school_urn = '100053' and m.profile_id = '52a08818-9132-48a0-8665-8362361eff11') as guy_at_acland, (select count(*) from school_memberships m join school_accounts a on a.id = m.school_account_id where a.school_urn = '100053') as acland_members, (select count(*) from usage_events where school_urn = '100053') as acland_usage_rows, (select count(*) from admissions_lists l join school_accounts a on a.id = l.school_account_id where a.school_urn = '100053') as acland_lists, (select count(*) from admissions_entry_points e join school_accounts a on a.id = e.school_account_id where a.school_urn = '100053') as acland_entry_points"
```
Expect `0 | 0 | 0 | 0 | 0`. If it stops with "owns saved sets or rankings", nothing was changed. That can't happen today (0 rows); tell me if it does.

**3. Check on the live site.** Do this after signing out and in again, or in a fresh tab:
- `/account` → View as → Leighton Park → SMT → Open their home page.
- Then a Recently viewed as link.
- Then Head office → "Harris".
- Then Back to me, which now goes to Platform.


