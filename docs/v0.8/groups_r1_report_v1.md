# VicData 0.8 — Groups round 1: report

Branch `v0.8-groups-r1`, 14 Oct 2026. Prompt: `docs/v0.8/vicdata_0_8_groups_round1_accounts_access_claude_code_prompt_v1.md`.

**Who can see what is built; the group dashboards come in rounds 2 and 3.**
- Head-office accounts, their members and invitations, and the group-view grants are in the database (one migration, written and tested, **not applied**).
- Every access path has a test; an independent reviewer found no remaining way to read or change another group's or another school's data.
- The head-office home, the Access page, the school's own group card and the Platform page's group accounts are built.

## Checks

| Check | Result |
|---|---|
| tsc, eslint, build | Clean (eslint: the 2 warnings already on `main`) |
| Unit tests | **346 / 346** (330 before; 16 new. Round 2 reported 407 counted another way: logged) |
| Rule tests | **82 pass, 0 fail; 1 error** (R-ADM-BOARDING-ONLY-WHERE-BOARDERS: production's statement timeout on a large reference lookup, three times; it errors identically on `main`, and round 1 saw the same; 1 new rule, R-SMT-Y12-AGAINST-Y11, passes) |
| RLS (existing) | **111 / 111** |
| RLS (new, `supabase/tests/v08_groups_r1_pglite.mjs`) | **102 / 102** |
| Usage-log test | **19 / 19** |
| Teacher parity | **2,875 / 2,875 identical** (full run: 2,874 + the harness's known map flake in the ranking set; that set rerun: 228 + 1 render noise elsewhere, then 229 / 229 identical). Fixtures 10/10 byte-identical; negative control caught |
| Admissions parity | **328 / 328 identical**, pixels and DOM, 592 panel-views (a first run had no harness server up and drew nothing; rerun with the server checked) |
| Public page | Identical (137625, 117037) |
| Server keys in client bundles | None (checked against the service key's own signature) |
| Security review | Three rounds; **no cross-group or cross-school read or write remains** (below) |

## G0 — the two SMT round 2 fixes

1. **"Year 12 against Year 11".**
   - **Where it changed:** the Pupils tile, the set's figure in Shapes around you, and the Leaving at 16 table's column. The tile now shows the ratio, with `SMT_NOTES.y12AgainstY11` as its caption.
   - **Same cohort?** Round 2 already compared it: Year 11 in year *t−1* with Year 12 in year *t*. Leighton Park reads 103.4%, which recomputes to 103.4% from the census (Year 12 2025/26 ÷ Year 11 2024/25).
   - **Locked by rule R-SMT-Y12-AGAINST-Y11:**
     - all three views say "Year 12 against Year 11", and none says "staying on";
     - the caption is the note;
     - Leighton Park is above 100% and equals the recomputation.
2. **One page view per load.**
   - **Cause:** Admissions logged on its first render with the entry point unknown, then again once it was known.
   - **Fix:** a page now marks its usage scope `resolved` only once its level and set are read:
     - Admissions: its lists and the school's ages;
     - Teacher: its subjects and saved set;
     - SMT: its set.
   - **The gate** (`src/lib/usage-gate.ts`) logs the first resolved scope. After that it logs only when the dashboard, level or set kind changes; re-renders and re-reads don't count.
   - **Test:** `src/lib/usage-gate.test.ts`, including the Admissions null-then-11+ load, which now logs once.

## G1 — the data model

Migration `supabase/migrations/20261110090000_v08_groups_r1_accounts.sql`. It is additive: five new tables, and no existing table, policy or function changes. The app works before the apply, because every group read treats the missing tables as "no group accounts".

| Table | What it holds |
|---|---|
| `group_accounts` | One per paying group: the production `group_id` (unique), display name, status (active/suspended), who made it. `preview` / `preview_of` mark the testing route's accounts, whose id is always `preview:<id>`. |
| `group_memberships` | A person's head-office role on an account: `head_office_admin` (manages access and members) or `head_office` (reads). Made only by accepting an invitation; the invitation is the approval (`approved_by` = the inviter). |
| `group_invitations` | Address, role, and a hash of the one-time link's token; accepted, cancelled. |
| `group_view_grants` | Which school's SMT has the group view: who granted it and when, who revoked it and when, and whether the school was a likely member. **History is kept:** a trigger refuses deletes and any change other than a revoke, even from the service role. |
| `group_admissions_shares` | A school's School-Admin's choice to share its Admissions panels with a group's head office. Default (no row): off. |

**Current membership** (production, `left_date` null) is checked by the app's server:
- **when a grant is made:** in `/api/group/access`;
- **at every read:** `liveGrant`, `headOfficeSchoolAccess` and `schoolSide` in `src/lib/groups/access-rules.ts`.

A grant or share made before the school's current `joined_date` doesn't count, so a school that leaves loses the group view without anyone revoking it, and doesn't get it back by rejoining. Schools that left show under "Left the group".

## G2 — every policy and check, in plain words

**In the database (RLS and functions):**
- **Reading.** Head office reads its own account, its members and its grants, and nothing of any other account. Only head-office admins read invitations, which carry addresses. Platform admins read everything.
- **Suspension.** All of this holds only while the account is active; a suspended account's head office reads nothing.
- **Shares.** A school's members read their own school's share setting; head office reads only what is shared with it.
- **No direct writes.** Neither anon nor signed-in users have any write privilege on these tables; every write goes through a function that checks its caller.
- **Platform admins** create accounts and suspend or reactivate them. Both are audited in `platform_audit_log`.
- **Invitations.** A platform admin or the account's head-office admin invites (also audited for platform admins), and gets the link once. Accepting (`group_accept_invitation`) needs three things together:
  - the link's token;
  - the invited address on the accepting account;
  - an active account.

  Any failure gives one refusal message, so nothing can be learnt from it. Inviting the same address again kills the old link.
- **Managing head office.** A head-office admin changes members' roles and removes members, but never their own: that is another admin's job, so an account can't lose its last admin.
- **Grants** are written only by the service role (`group_set_view_grant`). The server calls it after checking the caller is the account's head-office admin and the school is a current member. The function re-checks the admin and the active account.
- **Sharing Admissions.** `school_set_group_admissions_share` is for the School-Admin of that school only, and never with a preview account.

**In the app's server (`src/lib/groups/`, the routes):**
- **`/api/group/home` and `/api/group/access`** serve only the caller's own accounts. Any other account id is "not found". The Access page is for head-office admins; plain head office sees only the home's count.
- **POST `/api/group/access`:**
  - head-office admin of an active account only, never in View as;
  - granting only for current members that hold their own VicData account;
  - revoking for any school, so one that left can be tidied away.
- **`/api/group/school`.** A school's SMT and School-Admin learn which of their groups hold an account, whether their SMT has the group view, and their own share setting. Nothing else about the group account.
- **Head office on a member school's SMT** (`/api/group/school-access`; `smtCaller`; the chooser-set route), read-only. All of these must hold:
  - the school is a current member of one of the caller's active accounts;
  - the school holds its own VicData account.

  Members' paths are unchanged: this check runs only after theirs fails. Admissions panels read "Private to {school}" unless that school's School-Admin shares with that group; then they read the school's lists with the service role, exactly what its SMT sees. Never logged.
- **View as head office** (a platform admin): its own cookie, honoured only after `is_platform_admin`, read-only, never logged. In SMT it shows exactly what head office sees (no fallback to platform access).

## The RLS and route test matrix

`supabase/tests/v08_groups_r1_pglite.mjs`: **102 / 102**. `src/lib/groups/access-rules.test.ts`: **12 / 12**.

| Case | Database | Server rules |
|---|---|---|
| Own group: head office reads its account, members, grants | ✓ | ✓ (seeing count, table) |
| **Another group's head office** | reads nothing; can't invite, cancel, change members or be granted | "not a member"; another account id is not found |
| **A non-member school** | — | can't be granted; head office can't open it |
| **A revoked grant** | kept as history; a new grant opens a new row; can't be undone | doesn't count |
| **A school that left the group** | — | its grant stops counting; listed under "Left the group"; doesn't come back on rejoin; can be re-granted |
| **A likely member** | the grant is labelled | can be granted, labelled; opens for head office, labelled |
| **View as** | platform admin reads all | read-only, never manages, never logged; SMT as head office sees it |
| A school without VicData | — | no switch, no grant, no SMT for head office ("invite to VicData") |
| Suspended account | head office reads and changes nothing; no grant, invite or accept | opens nothing |
| A member school's SMT, School-Admin and teacher | read no account, membership or grant row | told only their own school's grant and share |
| Direct writes by anyone | refused (no privilege) on all five tables | — |
| The grant writer | anon, members, head office and platform admins can't call it | — |
| Invitations | takeover with a link in hand, wrong token, another group's link, reuse, unconfirmed address, re-invite kills the old link, cancelled: all refused | — |
| The Admissions share | only the school's School-Admin; never another school's or head office's; never with a preview account | stale after a rejoin |
| Preview accounts | can't hold a real group id; platform admins can't make one | invisible to every school |
| anon | can't read any table or call any function | — |

## The reviewer agent's findings

A separate agent that hadn't seen the build reviewed the migration, the policies and the server checks (read-only, three rounds).

**Round 1. One way in:**
- **High: invitation takeover.** Acceptance matched the signed-in address, and the project's sign-up auto-confirms email. So anyone could register an invited address before its owner did, and `/api/group/me` took the invitation up automatically. Example: an attacker becomes Harris's head-office admin.
  - **Fixed:** one-time link tokens (stored hashed); accepting needs the token AND the address; an explicit click on `/teacher/group/join`; nothing accepted automatically.
- **Medium: the preview route could add the preview user to a real group's account.** Fixed (and see round 2).
- **Low: suspended accounts could still read their data.** Fixed: a full lockout.
- **Low: grants and shares outlived a leave and rejoin.** Fixed: the join-date rule; schools that left can be revoked.
- **Low: `?group=constructor` passed the preview check.** Fixed: `Object.hasOwn`.
- **Note: View as fell back to platform access in SMT.** Fixed.
- **Notes, left as they are:**
  - likely members open for head office (as the prompt asks);
  - a School-Admin can share with any group account (it exposes nothing until the school is a current member).

**Round 2. One more path, the preview account:**
- **Medium: real schools saw the preview account as their head office.** It held the real group's id, so a real Harris School-Admin could have shared Admissions with whoever holds the preview token. It also blocked the real account.
  - **Fixed:** preview accounts are `preview:<id>` and borrow the member list. No school matches one, and none can share with one.
- **Low: a rejoined school couldn't be switched back on.** Fixed.
- **Low: the school's card ignored the join-date rule.** Fixed.
- **Note: the invitation token sat in the address bar.** Fixed: the join page takes it out.

**Round 3 (final): "Does any cross-group or cross-school read or write remain? No."** Its notes:
- **The preview token's holder** can open real Harris and Dukes schools' SMT read-only (public data; Admissions private) and see counts on the Access page.
- **Club ISS memberships** have no join dates, so a leave and rejoin can't be detected for them.

## G3–G5 — the pages

- **`/teacher/group`, the head-office home (`Home.dc.html`):**
  - name, and "{Group} · head office";
  - **The group** card: Overview, Schools, Academic and Pupils as dashed "coming" chips, and the summary line from the lookups and the census:
    - Harris: "59 schools · roll ▲ 0.1% · 29 growing";
    - Dukes: "26 schools · roll ▼ 8.9% · 2 growing" (see the logged call: worth a look);
  - **Our schools:** the member list. A school with VicData opens its SMT read-only; one without opens its public page;
  - **Access:** "{n} of {m}", linking to the Access page for the admin;
  - **My dashboards** and **Meetings**.

  Head office with no school of its own lands here from `/teacher`.
- **`/teacher/group/access`, the Access page (`Access.dc.html`):**
  - the title, and the comparison-set line ("Every member school already sees **All Dukes schools**…");
  - the table: school, SMT members, the switch, since, and "Opened, last 30 days";
  - "Give all schools access" and "Remove all", each confirmed in the shell's modal;
  - likely members (labelled), then "Left the group" (history, with Remove where a grant is still open);
  - the membership note (`GROUP_NOTES.membership`);
  - head office's own people (invite, which shows the link once; make admin or head office; remove; cancel).
- **A member school's home** (SMT, or School-Admin): its group's card says whether its SMT has the group dashboards. The School-Admin's switch reads "Share our Admissions panels with {group} head office", default off.
- **The Platform page, "Group accounts":**
  - search production's groups by name or id (type, source, school count);
  - create an account;
  - invite the first head-office admin (the link is shown once);
  - members and grant counts;
  - active or suspended;
  - "View as head office".

**Differences from the wireframes:**
- The home's wireframe is phone-only; at 1440 it follows the Teacher role home (centred, 768px).
- "Our schools" opens a list under its card rather than a page.
- The Access page adds the Likely, Left and Head office sections the prompt asks for.
- The "coming" chips are dashed.

## G6 — the test accounts

Behind `/api/testing/preview-session` only:
- **`?group=harris` or `?group=dukes`** makes the preview account `preview:3320` or `preview:club_iss:dukes-education`. Each borrows the real group's member list and is named "(preview)".
- **Each has its own preview head-office admin:** the preview address, plus-tagged `+group-harris` or `+group-dukes`, with no school membership.
- **It signs that admin in** to `/teacher/group`.

No invitation is ever created. The seeder refuses any account that isn't a preview account.

## Screenshots (`docs/v0.8/groups_r1_screenshots/`)

**Where the figures come from:**
- Member lists, names, rolls and VicData accounts are real (production lookups, the census, the app's school accounts).
- **Real state today:** Harris has 2 member schools with their own VicData account (0 SMT members); Dukes has none. The `*_real_*` shots show this.
- **Every other shot uses a labelled demo overlay**, because there are no grants until the migration is applied:
  - some schools are given accounts, SMT counts, grants and usage;
  - one school is shown as a likely member;
  - for Harris, one school is shown as having left.

**The shots:**
- `home_{harris,dukes}_{dark,light}_{1440,390}`, `access_{harris,dukes}_{dark,light}_{1440,390}`
- `home_*_real_dark_1440`, `access_*_real_dark_1440`
- `home_harris_schools_open_*`, `home_harris_plain_head_office_*` (no Access link)
- `viewas_head_office_{home,access}_dukes_*` (read-only banner; switches disabled)
- `school_smt_home_group_grant_{dark_1440,light_390}`: Harris Academy Battersea's SMT home with its group card and the share switch
- `head_office_smt_{overview,pupils_entries}_private_*`: head office on that school's SMT, with "Private to Harris Academy Battersea" in the Admissions panels
- `platform_group_accounts_{dark,light}_1440`: the Platform section, searching "harris"
- `negative_other_group_access_not_found_*`, `negative_other_group_smt_not_found_*`, `negative_plain_head_office_access_not_found_*`: "Not found."
- `join_invitation_*`

## Apply (not done by me)

App database. The app works before and after. Run it once:

```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261110090000_v08_groups_r1_accounts.sql && supabase migration repair --status applied 20261110090000 --linked
```

**Then:**
- In Platform → Group accounts, search for the group, create its account, and invite its first admin.
- Send them the link shown.

**Not applied from round 1:** the usage-log migration. Its command is in the round 1 report. Apply it before group-view usage counts can mean anything.

## Decisions for Guy, and follow-ups

Also logged in `docs/OPEN_QUESTIONS.md` ("2026-10-14 — 0.8 groups r1").

1. **Admissions sharing defaults to off;** the School-Admin turns it on per group.
2. **Likely members** can be granted (labelled), but "Give all" skips them; head office can open their SMT read-only.
3. **The membership model's wording** is in `GROUP_NOTES.membership`.
4. **The accent is orange.**
5. **Invitations are links you send yourself;** VicData sends no email. If an emailer is wanted, it can send the same link.
6. **Ingest follow-ups:**
   - a group search lookup by name (to replace the 3,734-group index the Platform page builds);
   - `first_seen` in `group_schools_lookup` (for Club ISS rejoin dates);
   - the Dukes roll fall.
7. **Round 2 adds `groups` to the usage log's products,** so "Opened, last 30 days" can count.
