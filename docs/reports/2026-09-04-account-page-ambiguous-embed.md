# /account and /sets silently empty for every real member — ambiguous PostgREST embed

2026-09-04. `src/app/account/page.tsx`, `src/app/sets/page.tsx`.

## Symptom

Guy's own test account (`guybeckett@mac.com`, approved + account-holder in
`school_memberships`/`school_accounts` — see the prior round's DB fix) showed
"No memberships yet" on `/account` despite the confirmed-correct DB state.

## Investigation — ruling out the suspected causes

- **Profile/auth identity mismatch**: ruled out. Exactly one `profiles` row and one
  `auth.users` row for `guybeckett@mac.com`, both `52a08818-9132-…`, both equal to
  the `school_memberships.profile_id` on the fixed row — confirmed via a real query,
  not the schema comment's claimed guarantee.
- **RLS blocking the outer `school_memberships` row, or the nested `school_accounts`/
  `schools` embed**: ruled out. Reproduced a genuine authenticated session for Guy's
  real account (`auth.admin.generateLink` + `verifyOtp` — a real access token bound to
  his actual `uid`, no password needed or seen) and confirmed
  `is_member_of_school_account(...)` evaluates `true` for him. The query never gets
  far enough for either RLS policy to matter.

## Real cause

A PostgREST schema-ambiguity error, `PGRST201`: *"Could not embed because more than
one relationship was found for 'school_memberships' and 'school_accounts'."*
Reproduces identically under the **service-role** client too — confirmed unrelated
to auth/RLS entirely.

`20260807102000_account_holder_handoff.sql` added a second FK from `school_accounts`
back to `school_memberships` (`pending_account_holder_membership_id`), alongside the
original `account_holder_membership_id` FK and the ordinary
`school_memberships.school_account_id → school_accounts.id` FK. Three relationship
paths now exist between the two tables, so an unqualified `school_accounts(...)`
embed is genuinely ambiguous — PostgREST refuses to guess and errors out
(`data: null`).

Both `account/page.tsx`'s `load()` and `sets/page.tsx`'s loader discarded the query
error entirely (`const { data } = await supabase...`), so `null ?? []` silently
rendered as "No memberships yet" / "no schools" instead of surfacing any failure —
a real, compounding bug in its own right, now also fixed (both now `console.error`
on a query failure).

**Broader impact**: `sets/page.tsx` made the identical unqualified embed and
discarded its error the same way — every approved member's `/sets` page has likely
shown "no schools" since the handoff migration landed, not just Guy's.

## Fix

Qualified both embeds with the FK PostgREST itself names as correct:
`school_accounts!school_memberships_school_account_id_fkey(...)`.

## Verified live

Real authenticated session for `guybeckett@mac.com` (same generateLink/verifyOtp
technique as the investigation), driven through an actual headless-browser page load
(Playwright, session injected into `localStorage` under the real
`sb-<project-ref>-auth-token` key, matching exactly how the browser client persists
a session):

- `/account`: renders **"Acland Burghley School — Approved — Head / Governor ·
  Account holder"**, with the Members/Tier management panel visible (confirms
  `canManage`/`isAccountHolder` both correctly derived from the fixed embed). Zero
  console errors.
- `/sets`: renders **"Acland Burghley School"** with both "Build Comparator Set" /
  "Build Feeder Set" links, instead of the "join your school" empty state.

Also verified directly at the query level (both fixed query strings, run under the
same real session) before the browser pass, confirming `error: null` and the full
expected nested shape for both.

## Checks

`tsc --noEmit` clean. `eslint` clean on the actual diff — two `react-hooks/set-
state-in-effect` errors do fire on `account/page.tsx`, confirmed pre-existing on
`HEAD` (unrelated `useEffect` call sites this round never touched), not introduced
by this fix.
