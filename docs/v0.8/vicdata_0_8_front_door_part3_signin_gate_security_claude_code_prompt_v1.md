# VicData 0.8 front door, part 3 of 3: sign-in, the beta gate and account security

> **NOT READY TO RUN.** Guy reviews Parts 1 and 2 first, then settles the open questions below. Then this note and "Open before this runs" are replaced by his answers, and the prompt is committed as v2. Until then, no agent builds from this file.

A Claude Code prompt for the app repo (`~/dev/vicdata_public`) and the app database (`lnhulykjlxmoneappnsp`). Written 13 Nov 2026 from Guy's decisions, 9–13 Nov, made on the design canvas "VicData walkthroughs — GCSE mockup". The decision records are in the project: `claude/vicdata_walkthroughs_decisions_v1.md` and `claude/vicdata_beta_access_and_security_decisions_v1.md`. Where this prompt and those records differ, this prompt wins.

**The 0.8 front door is built in three parts, in this order:** Part 1 theme, homes and walks; Part 2 guided sets, school admin and phone; Part 3 sign-in, the beta gate and account security (written now, run only after Guy has reviewed Parts 1 and 2). They were split on 13 Nov from one prompt (`vicdata_0_8_front_door_claude_code_prompt_v1.md`, now superseded). Decision numbers (A1–F29) are that prompt's, kept so the records still line up; a decision another part owns is named, never built, here.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each one ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## Why

A teacher shown the GCSE dashboards found the information "incredible" but the interface threw him: the multi-panel layout, open/closed rows, the small rail icons. What worked was the onboarding's last screen: simple questions that made sense. He expected each to be a button.

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**. Five pieces, built together:

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**.

**This part:** a private landing page instead of the sitewide password; school pages never indexed; new-device codes, a device cap and "Where you're signed in"; joining on the school's own email domain; the admin's Sign-ins and devices page.

**Design files:** `docs/v0.8/front_door_design/` (moved there from the top-level `walkthroughs_design_inbox/` in Part 1). Its `README.md` maps every screen to a PNG (`png/`) and its source board (`dc/*.dc.html`). They are design references (layout, wording, colour, behaviour), not code to port. **Every figure, school name and date in them is illustrative.** Use real data everywhere.

## Open before this runs (found reviewing the code, 13 Nov)

1. **The server can't see who is signed in.** The browser keeps the Supabase session only in its own storage (`src/lib/supabase.ts`: plain `supabase-js`, no `@supabase/ssr`), so there is no session cookie and `src/proxy.ts` can't tell a signed-in page request from a signed-out one. The gate (A1), the trusted-device cookie, the device cap and "Where you're signed in" (E24) all need cookie sessions first. **Q1:** add a first milestone that moves sign-in to cookie sessions (`@supabase/ssr`: login, `/join/[urn]`, every page and API that reads the session)? *Recommended: yes.*
2. **`/join/[urn]` is where invited testers make their account** (`supabase.auth.signUp`), so A1 and R-BETA-GATE redirecting it to `/` would stop anyone new joining. **Q2:** keep `/join/[urn]` open signed-out (always noindex, showing only the school name it shows today) and change R-BETA-GATE to match? *Recommended: yes.*
3. **There is no auth callback or password-reset route** (A1 lists both as allowed). **Q3:** build "Forgot password?" (an email link, a reset page) in this part, or drop both from the allowed list?
4. **The proxy counts public school page views** (`countPublicPageView`, `src/lib/usage-public.ts`). Once `/schools/...` needs sign-in, there are no public views. **Q4:** retire the public count, or count signed-in views of `/schools/...` instead?
5. **Email for device codes.** No SMTP provider is set up (`supabase/config.toml`), and Supabase's built-in sender only allows a few emails an hour. **Q5:** ship device codes behind `DEVICE_CODES=off` until a provider is set up (and which one)? *Recommended: yes, off.*
6. **Preview access** (`api/testing/preview-session`) satisfies today's gate with its own cookie. Under a signed-in gate it must mint a real session for a fixed test account (same posture: off by default, secret-gated, fails closed). Depends on Q1; no decision needed beyond that.

## The decisions (Guy, 9–13 Nov)

### A. Beta access

1. **A private-beta landing page replaces the sitewide password.** Today `src/proxy.ts` puts Basic Auth in front of every route. Replace it:
   - A visitor who isn't signed in can reach only: the landing page (`/`), `/login`, the auth callback and password-reset routes, `api/health`, `api/version`.
   - Everything else, including `/schools/...`, `/join/...` and `/sets...`, redirects to the landing page (API routes return 401).
   - The preview-access route (`api/testing/preview-session`, `docs/vicdata_phase3_agent_preview_access_*`) keeps working: it must now satisfy the signed-in check instead of the Basic Auth gate, with the same safety posture (off by default, secret-gated, fails closed).
   - Remove the Basic Auth code and its env vars from the gate; log any env var Guy can now delete.
2. **The landing page: logo, "Private beta", Sign in. Nothing else.** No school search, no school names, no description, no "request access", no Open Graph or Twitter metadata, no analytics or tracking scripts, a plain `<title>` ("VicData"), and `X-Robots-Tag: noindex, nofollow`.
3. **School pages are never indexed, whatever `ALLOW_INDEXING` says.** Today `src/app/robots.ts` and `layout.tsx` metadata follow one switch for the whole site.
   - Every school-specific route (`/schools/...`, `/join/...`, set pages, anything carrying a URN) **always** sends `X-Robots-Tag: noindex, nofollow` and page-level `robots: { index: false, follow: false }`, independent of `ALLOW_INDEXING`.
   - `sitemap.ts` never lists them; add a comment saying so and why.
   - **Do not** add `Disallow` rules for them in `robots.ts`: a crawler that can't fetch a page never sees its `noindex`, and the bare URL can still be listed.
4. **Sign-in stays email and password. No public sign-up.** Testers arrive by invitation (existing join and approval flows).

### E. Account security

24. **New-device codes and a device cap, built now** (easy to troubleshoot with a few users; ready before parents arrive later, where password sharing will be endemic).
    - **A device VicData hasn't seen** asks for a 6-digit code sent to the account's email after the password. The device is then trusted for 60 days (a long-lived, httpOnly, signed device cookie). Use Supabase Auth's own email OTP or reauthentication to send the code if it can; if no route exists without a new email provider, build the flow behind a flag (`DEVICE_CODES=off` by default), log exactly what Guy needs to switch it on, and carry on.
    - **A cap on devices signed in at once,** per kind of account (staff: 3, in one config constant per account kind). Signing in on one more signs out the oldest, with a one-line notice on the next page.
    - **"Where you're signed in"** for the user (account page): device, browser, rough place (from IP, city level at most), last active, "Sign out" per device and "Sign out of all devices". The School-Admin sees the same for their staff (decision 27).
    - **A quiet alert to platform admins** (a row in the existing platform-admin area, no email) when one account is used from more than N places in 24 hours (constant, start at 4).
    - New tables with RLS: devices/sessions per profile; codes (hashed, short-lived, attempt-limited). No device binding beyond this.
25. **Joining a school needs an address on the school's own email domain,** with admin-approved exceptions.
    - Each school account holds its email domains (new table). The first School-Admin's domain seeds the list; the admin can add or remove domains (trust schools often use the trust's domain; GIAS gives the website, not the email domain).
    - A join request from an address outside the list is held as an **exception** for the School-Admin to approve or refuse explicitly (governors, consultants, staff on personal addresses), and shows as such in Join requests.
    - Existing members are unaffected.

### F. School admin (the Sign-ins row)

27. **Sign-ins and devices** (from decision 24) for the admin: their staff's devices, last active, "Sign out" per person; flagged accounts first.
   - Add its row to Part 2's account page ("Sign-ins and devices"), with its badge ("1 flag"), and the "exception" badge to Join requests (E25).

## G. Phone

At phone width (the shell's 358 px card, viewports 360–430), the landing page, sign-in, the device-code screen and "Where you're signed in" have designed phone layouts using the shell's existing patterns; single column, 44 px hit areas. **R-FRONT-DOOR-MOBILE** (Part 2) extends to them.

## Milestones (commit at each; stop cleanly where you must)

1. **Cookie sessions** (if Q1 says so).
2. **Beta access** (A1–A4): the gate, the landing page, the noindex rules, preview access on the new gate.
3. **Account security** (E24–E25) and the admin's Sign-ins page (F27).
4. **Phone layouts** (G), then the report.

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- **R-BETA-GATE:** signed out, only the allowed routes respond; `/schools/[urn]`, `/join/[urn]` and `/sets` redirect to `/`; API routes 401; the preview route still works with its secret and fails closed without it; no Basic Auth remains.
- **R-NOINDEX-SCHOOLS:** with `ALLOW_INDEXING=true`, a school page still sends `X-Robots-Tag: noindex, nofollow` and page-level noindex; `sitemap.ts` lists none; `robots.ts` has no Disallow for them.
- **R-LANDING-MINIMAL:** the landing page has no search input, no school names, no OG/Twitter meta, no third-party scripts.
- **R-DEVICE-CODES** (behind the flag if needed), **R-DEVICE-CAP** (the oldest signs out), **R-SIGNINS-RLS** (a user sees their own devices; an admin their school's staff; nobody else).
- **R-JOIN-DOMAIN:** an on-domain request is ordinary; off-domain is an exception needing explicit admin approval; existing members unaffected.
- **The existing rules still pass.** Update any rule that names the Basic Auth gate. Log every rule retired or rewritten, with why.

## Ground rules

- **Branch `v0.8-front-door-3` from current `main`** (after Parts 1 and 2 are merged), fetched over HTTPS.
- **These must be clean at every milestone:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; every PGlite suite (run as their headers say; `view-as-pages.test.ts` with `--test-force-exit`); every parity harness.
- **Allowed differences in parity:** the new routes and pages (landing, device code, sign-ins); the gate. **Figures never change.**
- **No database writes.** Migrations are written and tested in PGlite, and Guy applies them. Give each migration's step with the `schema_migrations` insert, per the template in `docs/FEEDBACK.md`.
- **Name new migrations after the latest one on `main` and in the live history** (today `20261122090000`; the unmerged group-sets branch holds `20261121100000`). Check both before naming.
- **Never put a server key in client code.** Stage files by name. Don't push or merge.
- **Log every call** under "2026-11-13: front door, part 3" in `docs/OPEN_QUESTIONS.md`.
- **Stay inside this part.** Where this part's work meets another part's decision, leave a clean seam (a constant, a prop, a hidden row) and log it; don't build the other part's piece.

## Report

Write `docs/v0.8/front_door_3_report_v1.md`. Include:
- how far you got, milestone by milestone, and anything left;
- the session change (if built) and everything it touched;
- the gate (allowed routes), the noindex rules, the env vars Guy can remove;
- the new tables and RLS (devices, codes, email domains), and the migrations with Guy's apply steps;
- whether device codes are live or behind the flag, and exactly what Guy must do to switch them on;
- screenshots, desktop and phone (390 × 844), Dark and Light: landing; sign-in; the device-code screen; "Where you're signed in"; the admin's Sign-ins page; Join requests with an exception;
- every rule added, rewritten or retired; tests and parity;
- **Guy's commands, in the template's order,** ending with a walk-through for: a signed-out visitor (any school URL → landing), an invited teacher (join link → account → welcome), a known user on a new device (password → code), and a School-Admin (Sign-ins page → sign a device out; approve an off-domain join).
