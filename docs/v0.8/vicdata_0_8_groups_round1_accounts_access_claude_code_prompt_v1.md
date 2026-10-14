# VicData 0.8 — Groups round 1: head-office accounts, access rules, the Access page and the group home

Claude Code build prompt, written 14 Oct 2026, for the app repo (`~/dev/vicdata_public`, app database `lnhulykjlxmoneappnsp`). This is the first of three group rounds. **It builds who can see what**; the group dashboards themselves (Overview, Schools, Academic, Pupils) come in rounds 2 and 3. Two small fixes from SMT round 2 ride along (G0).

## Read first

- **The spec:** `docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md`, §3 in full, especially **§3.2 (decided 13 Oct)**:
  - the group view comes with a **group membership bought by head office**, not with a school's own membership;
  - **head office decides** which member schools' SMT get the group view;
  - every member school still gets its group **as a comparison set** (round 3);
  - self-declared groups are visible only to the school that made them.
- **The wireframes:** `docs/wireframes/groups/` — `Home.dc.html` (the head-office home), `Access.dc.html` (the Access page), and the dashboards for context. Build Home and Access **pixel-perfect, both themes, from the shell** (`src/components/shell/`). Group accent: **orange** (add `groups` to the accent context; to confirm with Guy, log it).
- **The group data** lives in production (`hrqrbvrrhlidpoybezhs`): `groups`, `group_membership` (with `source`, `confidence` confirmed/likely, `first_seen`, `last_seen`, `left_date`), read through `school_groups_lookup(urns)` and `group_schools_lookup(group_ids)`, which anon can call. The app reads groups **only through those lookups**.
- The roles model (`src/lib/roles.ts`), `school_accounts` / `school_memberships`, View as (`src/lib/view-as.ts`), the Platform page (`src/app/platform/`), and the usage log (`supabase/migrations/20261109090000_v08_usage_log.sql`).

## Ground rules

- **Branch `v0.8-groups-r1` from `main`.** Commit per stage; tsc, eslint, build, unit, rule, RLS (111 plus the new tests), usage-log test, Teacher parity (2,875), Admissions parity (328) and the public page all clean. **SMT is allowed to change only in G0's two fixes.**
- **This round adds RLS.** A **separate reviewer agent** (one that hasn't seen the build) reviews the migration and policies before you merge, as Admissions round 1's A3 was reviewed. Write its findings into the report. **Don't merge** if it finds any way for a user to read or change another group's or another school's data.
- **Database changes are written and tested (PGlite, as before), never applied by you.** Apply commands as `&&` chains with the project-ref check and **no `exit`**. The app must work before and after the apply.
- Never put a server key in client code; stage files by name; leave Guy's untracked files alone; log calls under "2026-10-xx — 0.8 groups r1" in `docs/OPEN_QUESTIONS.md`.

## G0 — Two fixes from SMT round 2 (first commit)

1. **"Staying on at 16" is the wrong name where Year 12 is bigger than Year 11.** Leighton Park shows 103%, because pupils join the sixth form from elsewhere. Rename the tile (Pupils column 1, and anywhere else the figure appears, including "Staying on at 16, 10 nearest" in Shapes around you) to **"Year 12 against Year 11"**, showing the ratio, with the caption from `SMT_NOTES`: "Year 12 this year against Year 11 last year: below 100% when pupils leave at 16, above 100% when more join than leave." Compare Year 11 in year *t−1* with Year 12 in year *t* (the same cohort), if round 2 didn't already; say which it was and fix it if not. Lock the wording with a rule.
2. **One page load is logged twice.** An Admissions page load wrote two `page_view` events a few milliseconds apart: one before the entry point was known (`level` null), then one with `11+`. Log **one** `page_view` per load, after the level and set are resolved, and a new event only when the user changes level, set or dashboard. Apply the same rule to Teacher and SMT. Add a test.

## G1 — The data model (app database; one migration, written and tested, not applied)

- **`group_accounts`:** one per paying group. `group_id` (the production `groups.group_id`, text, e.g. `3320` or `ch:01234567`), display name, status, created by, created at. **One account per group.**
- **`group_memberships`:** a profile's membership of a group account, with role **`head_office_admin`** (manages access and members) or **`head_office`** (reads). Approved by a platform admin or the account's head-office admin, as school memberships are approved.
- **`group_view_grants`:** `group_account_id`, `school_urn`, granted by, granted at, revoked at, revoked by. The grant gives **that school's SMT** (and School-Admin) the group dashboards for that group. History is kept: revoking sets `revoked_at`, never deletes.
- **Membership is checked at grant time and read time:** a grant is valid only while the school is a **current member** of the group in production (`group_schools_lookup`, `left_date` null). A school that leaves the group loses the group view automatically, and the Access page shows it under "Left the group".
- **"Likely" members** (Companies House, not yet confirmed) can be granted, labelled "likely member". Log the choice.

## G2 — Access rules (RLS and the server checks)

- **Head office** (`head_office` and `head_office_admin`) can read their own `group_accounts` row, its memberships and its grants. **Nothing of any other group.**
- **Head-office admin** can create and revoke grants for **their own group's current member schools only**, and approve or remove head-office members.
- **A school's SMT and School-Admin** can read whether their own school holds a grant (to show the group view in their nav and home), and nothing else about the group account.
- **Platform admins** create group accounts and the first head-office admin, from the Platform page, and can View as a head-office user (read-only, never logged).
- **Head office looking at member schools:** head office can open a **current member school's SMT dashboards, read-only**, but **only for schools that hold their own VicData membership** (no school account means no SMT data to show beyond the public page). **Admissions-sourced panels show the school's private lists only if the school allows it:** by default they read "Private to {school}". Add a per-school setting for the school's School-Admin, "Share our Admissions panels with {group} head office", default **off**. Log this as a decision for Guy to confirm.
- **Every path above has an RLS or route test**, positive and negative: another group's head office, a non-member school, a revoked grant, a school that left the group, a likely member, View as.

## G3 — The head-office home (`Home.dc.html`)

At `/group` (or `/teacher/group` if the shell's routing prefers it; log the choice), using the shell's nav and the role home pattern:
- name, "{Group} · head office";
- **The group** card: Overview · Schools · Academic · Pupils as chips, **shown as coming** (dashed) until rounds 2 and 3, with a one-line summary that already works: "{n} schools · roll ▲ x% · {g} growing", from the production lookups and the census (no new aggregate yet);
- **Our schools:** a list of current member schools, each opening that school's SMT read-only (G2), or its public page where the school has no VicData membership;
- **Access:** "{n} of {m} schools see the group view" → the Access page (head-office admin only; plain head office sees the count);
- **My dashboards** and **Meetings:** the existing cards.

## G4 — The Access page (`Access.dc.html`)

- Title "Access to the group view", the group's name and the line that **every member school already sees "All {group} schools" as a comparison set**; this page adds the group dashboards for a school's SMT.
- **The table:** each current member school, its SMT member count (VicData members only), a switch for the group view, since when, and **"Opened, last 30 days"** from the usage log (counts only: "N times by N staff"; fewer than 5 shows "fewer than 5"). Schools without a VicData membership show "not a member" and "invite to VicData", with no switch.
- **"Give all schools access"** and **"Remove all"**, each asking for confirmation.
- **Sections:** current members; likely members (labelled); left the group (read-only history).
- **Membership note:** "A school needs its own VicData membership for its staff to sign in; the group membership covers head office and the group view." Guy hasn't confirmed this model yet, so put the text in `GROUP_NOTES` so it can change without code. Log it.

## G5 — The Platform page: group accounts

A "Group accounts" section for platform admins: create a group account by searching groups (through the production lookups, by name or id, showing type, source and school count), set the first head-office admin by email (an invitation, as school accounts are invited), see each account's members and grant counts, suspend an account.

## G6 — Seeds for testing and the demos

Behind the existing testing route (never in production data paths): create test group accounts for **Harris Federation (GIAS MAT 3320)** and **Dukes Education** (its Club ISS group id), each with a preview head-office user, so the Access page, the head-office home and View as can be clicked through. Never create real invitations.

## Report

`docs/v0.8/groups_r1_report_v1.md`: G0's fixes; the schema and every policy in plain words; the RLS test matrix with results; the **reviewer agent's findings**; screenshots (`docs/v0.8/groups_r1_screenshots/`: head-office home and Access page for Harris and Dukes, both themes, 1440 and 390; the Platform section; a school's SMT home showing the group grant; a negative case, such as another group's head office getting "not found"); the migration and its apply command; logged calls and the decisions for Guy (the Admissions-sharing default; likely members; the membership model; the accent).

**Merge only if** every check is clean and the reviewer finds no cross-group or cross-school leak:

```
git checkout main && git pull && git merge --no-ff v0.8-groups-r1 -m "0.8 Groups round 1: head-office accounts, access rules, the Access page and group home; SMT r2 fixes" && npm run build && git push
```

Otherwise push the branch and stop. If a push fails, give Guy the command (he pushes over HTTPS).
