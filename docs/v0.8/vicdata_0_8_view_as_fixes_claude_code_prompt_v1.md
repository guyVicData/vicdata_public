# VicData 0.8 — View as fixes: land on the chosen school, any group, platform admins without memberships

Claude Code prompt for the app repo (`~/dev/vicdata_public`), app database `lnhulykjlxmoneappnsp`. Written 18 Oct 2026, after the View as round (merged, deployed: main cb26ef1).

## What Guy sees on the live site (18 Oct, with the new switcher: "Head office" is in the role row)

a) **"Open their home page" doesn't take him into the chosen school.**
b) **The "Recently viewed as" links always land on Acland Burghley,** Guy's own leftover membership.
c) **No way to choose a school group:** the Head office list is empty.
d) **Guy is "approved" as Teacher, Admissions and School-Admin at Acland Burghley.** These are leftovers of the old testing switcher. A platform admin shouldn't need memberships.

## What's known (read-only checks, 18 Oct)

- **The starts do happen.** `platform_audit_log` has `view_as` rows at 07:55 UTC (SMT, 110110) and 07:58 UTC (Admissions, 137625), from Guy's clicks this morning. `is_platform_admin` and `log_platform_action` both answered 200 at that time.
- So the switch is recorded, but **the page he lands on (`/teacher`) shows his own membership instead.** Suspects, to confirm or rule out:
  1. **The cookie isn't visible where it's read:** `writeCookie`'s path, domain, `SameSite` and `Secure`, against what `viewAsSnapshot()` and the server's `parseViewAsCookie` read on Render's domain.
  2. **The resolved promise is cached across the switch** (`resolved` in `view-as.ts`) or the pin is stale.
  3. **`resolveViewAs` clears the cookie on any falsy `confirmPlatformAdmin`,** including a transient error. One slow RPC then silently drops View as. A failed check must never clear it: only a definite "not an admin" may.
  4. **`/teacher` or the home lens picks a membership before View as resolves.**
  5. For (a): **the button stays disabled or does nothing until a search result is clicked.** Check that the chosen school is actually held in state.
- `usage_events` got a 201 during those minutes. Check whether View as wrote a usage row; it mustn't.
- `group_accounts` is **empty**, so the Head office list has nothing in it.

## The work

1. **Reproduce first, in a real browser,** against a local build pointing at the real app database, signed in as a platform admin. Playwright is installed. If the bug only shows on Render's domain, use the live site, read-only. The flow:
   - `/account` → View as → search "Leighton Park" → pick it → SMT → **Open their home page**;
   - expect `/teacher` with the banner "Viewing as SMT · Leighton Park School", and the SMT home;
   - then go to the SMT dashboards, then **Back to me**, then a **Recently viewed as** link (The Chase, Admissions).

   Record what happens at each step (the cookie, the requests, the page), and name the cause.
2. **Fix it so every entry point lands on the chosen school and role, every time:**
   - the account card;
   - the nav pill's popover;
   - the recent links;
   - "Start fresh";
   - Platform's pre-fill;
   - the banner's **Change**.

   A transient error must keep View as and show a retry, never fall back to the admin's own school.
3. **Head office of any group, account or not.** As platform admin, Guy picks from **every group** in the groups data (Harris, Dukes, Club ISS groups, Companies House groups and the rest), searchable by name.
   - Groups with an account behave as now.
   - A group without one opens its dashboards read-only, from the group lookups (keyed by group ID). There's no Access page and no account features, and the page says "No group account yet".
   - Only the server's platform-admin check decides this. Head office's real access is unchanged.
4. **Platform admins without memberships.**
   - **Back to me** and every fallback for a platform admin with no approved membership go to `/platform`, never to a school.
   - Write a migration that **removes Guy's memberships at Acland Burghley (100053)**, after checking what depends on them (saved sets, notes, preferences, dashboards, meetings, admissions lists, usage rows, `account_holder_membership_id`).
     - Keep or reassign anything another member relies on, and list each dependency and what happens to it.
     - It must be safe to run twice.
     - **Don't apply it:** give Guy the command.
   - After it's applied, Acland Burghley's People list no longer shows Guy.
5. **No usage rows from View as** (check it, fix it if any are written).

## Tests

- **R-VIEW-AS-LANDS (Playwright):** every entry point in item 2 lands on the chosen school and role.
- **R-VIEW-AS-TRANSIENT:** an `is_platform_admin` error keeps the cookie and shows a retry.
- **R-VIEW-AS-ANY-GROUP:** head office of a group with no account (Harris and Dukes, given `group_accounts` is empty) opens read-only.
- **R-PLATFORM-NO-MEMBERSHIP:** for a platform admin with no membership, Back to me goes to `/platform`.
- Rerun the View as round's tests (R-VIEW-AS-ANY-SCHOOL, -HEAD-OFFICE, -ADMIN-ONLY, -LOGGING, R-ROLE-SWITCH, R-EDIT-*).

## Ground rules

- **Branch `v0.8-view-as-fixes` from current `main`, fetched over HTTPS.** Commit this prompt first. Use a worktree if the checkout is in use.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - Teacher, SMT, Admissions, groups and public-page parity. Members' pages must be byte-identical.
- **No database writes.** The membership migration is written and tested in PGlite, and Guy applies it.
- **Never put a server key in client code.** Stage files by name. Push over HTTPS.
- **Log calls** under "2026-10-18 — View as fixes" in `docs/OPEN_QUESTIONS.md`.
- **If the push to main is refused,** push the branch, and give Guy the merge command and the migration command, in order.

## Report

Write `docs/v0.8/view_as_fixes_report_v1.md`. Include:
- the cause of (a) and (b), with evidence;
- the fixes;
- the any-group design;
- the membership dependencies and the migration;
- screenshots of each entry point landing correctly, and of Harris head office without an account;
- Guy's commands, in order.
