# VicData 0.8 front door, part 3: sign-in, the beta gate and account security (report v1)

Built 21-22 Nov 2026 on branch **`v0.8-front-door-3`**, rebased onto `main` at `f22b8834` (the hidden school pages),
which includes "Forgot password?" (6b7db90a), the per-view results cache (914405c6, 77a674f2) and the boot preload
(7c8082cc). From `docs/v0.8/vicdata_0_8_front_door_part3_signin_gate_security_claude_code_prompt_v1.md` and Guy's
answers of 21 Nov: Q1 cookie sessions first; Q2 `/join/<urn>` stays open signed out; Q3 "Forgot password?" built on
its own branch (now on `main`, merged into this flow here); Q4 count signed-in views of `/schools/...` (moot now:
see below); Q5 device codes behind `DEVICE_CODES=off`; A3 was already on `main` (837a3cf) and is kept, with its
tests and rule added. Every call made without asking is logged under "2026-11-13: front door, part 3" in
`docs/OPEN_QUESTIONS.md` (M1-1 … M4-4).

**Change of plan (22 Nov): this goes live BEFORE the Leighton Park demo** (code freeze Wednesday 25 Nov), merge-ready
for Sunday evening, Monday and Tuesday for live testing. **Nothing here is live, and nothing was written to the
database.** The migration must be applied before the deploy: see the go-live sequence ("Guy's commands", at the end).

## How far it got

| Step | Commit | State |
|---|---|---|
| 1. Cookie sessions (Q1) | `de6c654e` | done |
| 2. Beta access: the gate, the landing page, noindex (A1-A3), preview access on the new gate | `4906a644` | done |
| 3. Account security (E24, E25) and the admin's Sign-ins page (F27) | `ff5f6b4f` | done (device codes behind the flag) |
| 4. Phone layouts (G) and the report | `59361d3e` | done |
| "Forgot password?" under cookie sessions; one sign-in page | `33abd680`, `3ee7d5f9` | done |
| The landing page: the logo large, three backgrounds in VicData's colours | `970b4892` | done |
| Rebased onto the hidden school pages; the cap's notice survives /member's forward | `a6e9d8dc` | done |
| This report's go-live sequence | the last commit | done |

Left open (details under "Open"): device codes have never sent a real email (no provider, Q5); the reset email's
template should link through `/auth/confirm` so a link works on another device; the 50-odd API routes still read
`Authorization` (the proxy fills it from the cookie), a later tidy-up.

## The session change (milestone 1)

The Supabase session moved from the browser's localStorage to a cookie the server can read: `@supabase/ssr`'s
`createBrowserClient` (`sb-<project>-auth-token`, SameSite=Lax, Secure in production, 400 days). What it touched:

- **`src/lib/supabase.ts`** — the browser client; it deletes the old localStorage copy on load (everyone signs in
  once more after the deploy: M1-2). A client component rendered on the server gets a plain anon client, as before.
- **`src/proxy.ts`** — verifies the cookie with `getClaims()` (local: the project signs with ES256, so no call to Auth
  per request), refreshes an expired token and sends the new cookie back, and gives a same-origin API call that carries
  only the cookie `Authorization: Bearer <token>`. Every route keeps reading the header it reads today; a page that
  sends Bearer itself (all of them, still) is untouched. Cross-site requests never get one (M1-3).
- **`src/lib/auth-cookies.ts`, `src/lib/auth-server.ts`** — the cookie's shape and the server's readers.
- **`/login`, `/join/<urn>`, sign-out** — unchanged calls (`signInWithPassword`, `signUp`) now land in the cookie.
  Sign out signs out **this browser only** (`scope: "local"`) and reloads to `/`; it used to sign the person out
  everywhere (M2-7). One helper: `src/lib/sign-out.ts`.
- **Preview access** — redeems a real magic link **on the server** (`verifyOtp`) and leaves the browser holding the
  session cookie for its fixed account. Same posture: four env vars or a byte-identical 404, constant-time token check,
  path-only redirect to `PREVIEW_ACCESS_SITE_URL`. It no longer depends on the Auth redirect allow-list (M1-5). From
  milestone 3 it also registers the browser as a `preview` device (never a code; cap 10).
- **`scripts/warm-demo.mjs`** — waits for the session cookie (or, against an older deploy, the localStorage key).
- **The View as / peek code** — unchanged: it reads the `Authorization` header and the `vicdata_view_as` cookie as
  before. The one test that seeded a localStorage session (`view-as-pages.test.ts`) seeds the cookie instead.
- **The results cache** — untouched: no key includes who is asking (`cached-views.ts`, `results-cache.ts` unchanged).

## The gate, noindex, env vars (milestone 2)

**Signed out, these respond** (`src/lib/beta-gate.ts`): `/` (the landing page), `/login`, `/auth/callback`,
`/auth/confirm`, `/reset-password`, `/forgot-password`, `/join/<urn>` (Q2), `robots.txt`, `sitemap.xml`, the icon; and
`/api/health`, `/api/version`, `/api/testing/preview-session`. **Every other page redirects to `/`; every other API
route answers 401.** Signed in means a session the server verified (the cookie, or a script's Bearer token checked
the same way); signed in, `/` goes to `/member`. From milestone 3 the session's device must be signed in too (below).

- `/auth/callback` (a PKCE `?code=` exchanged onto the cookie session) and `/auth/confirm` (an email's `token_hash`
  redeemed on the server) are built; `/reset-password` is main's, adapted ("Forgot password?" below).
- `/sources` is now behind the gate (not on A1's list).
- **The landing page** (A2): the wordmark, "Private beta", Sign in. No search, school names, description, OG/Twitter
  metadata or scripts; a plain `<title>VicData</title>`; noindex in the page and as `X-Robots-Tag` (with `/login` and
  the reset pages). The site nav and footer aren't drawn on it or on sign-in.
- **Noindex** (A3, kept as built on `main`): every school-bearing route sends `X-Robots-Tag: noindex, nofollow` and
  page-level noindex whatever `ALLOW_INDEXING` says; the sitemap lists none; robots.txt has no Disallow for them. Now
  tested (R-NOINDEX-SCHOOLS).
- **Q4:** the proxy counts signed-in views of `/schools/<urn>` through the same `count_public_page_view`.
- **Env vars Guy can delete on Render:** `ACCESS_GATE_ENABLED`, `ACCESS_GATE_USER`, `ACCESS_GATE_PASSWORD`. Nothing
  reads them; no Basic Auth remains (a test scans `src`).

## Account security (milestone 3)

**Devices and the gate (E24).** Every sign-in meets a row in `account_devices`. The browser holds a random token in an
httpOnly cookie (`vicdata_device`); the table holds its SHA-256 (M3-1). The gate admits a session only while its
device row is signed in: one service-role read per session per 30 s, forgotten at once by every sign-out (M3-2). A
session that hasn't finished (no row, or a code to type) reaches only `/login`, `/join/<urn>`, the auth and reset
pages and `/api/auth/*`; others go to `/login?step=device`. A device signed out elsewhere has its session cookies
cleared and lands on `/login?signedOut=<why>`, which says why. `DEVICE_SESSIONS=off` is an emergency switch back to
milestone 2's gate.

**New-device codes (behind `DEVICE_CODES`, off).** With codes on, a device VicData hasn't seen asks, after the password,
for a 6-digit code emailed to the account. The code is stored only as an HMAC bound to its device. It lasts 10
minutes and allows 5 wrong tries; a new one can be sent after a minute and ends the old one. The right code trusts
the device for 60 days. No code: codes off; a trusted device; a brand-new account's first device (the invited
teacher's join → account → welcome, M3-4); the preview account. Codes on with no mailer: nobody gets in on a new
device (fails closed).

**The cap.** Staff 3, platform admin 5, preview 10 (`DEVICE_CAP`, M3-5). The 4th sign-in signs out the oldest and
ends its Supabase session (`revoke_auth_session`). The new device's next page says, in one line, "You can be signed in
on 3 devices at once, so we signed you out on Chrome on Mac.", and the old device's next page signs it out, saying why.

**Where you're signed in** (on `/account`, the page "Your Account" opens): each signed-in device, rough place (from
Cloudflare's city and country headers, never the IP: M3-6), last active, this device first. "Sign out" on each and
"Sign out of all devices". Only the person's own.

**The quiet alert.** An account used from more than 4 places in 24 hours is flagged. Platform admins see it on the
Platform page ("Sign-in flags", with Sign out everywhere); a School-Admin sees it first on Sign-ins and devices. No
email (M3-13).

**Joining on the school's domain (E25).** `school_email_domains` holds each school account's email domains. It is
seeded from the first School-Admin's (or the account holder's) domain, never a personal one like gmail.com or mac.com
(M3-10). `join_school` marks a request from outside the list `off_domain`; Join requests (People) shows it tagged
**Exception**, approved only with **Approve as an exception**. A database trigger refuses a plain approval of one, and
any signed-in change to the mark (M3-11). The School-Admin edits the list on People, "Who can join" (M3-12). An
on-domain request (or a subdomain) is ordinary. A school with no list holds every request as an exception. Existing
members are unaffected. **Leighton Park's list will start empty** (its admins are Guy's mac.com test accounts): add
`leightonpark.com` on People.

**Sign-ins and devices (F27)**, `/teacher/school-account/sign-ins`: the school's approved staff, each with the
devices they're signed in on now and last active, flagged people first, and "Sign out" per person (every device;
refused in View as). It reads with the admin's own client, so RLS decides. The account page's row reads "6 devices ·
1 flag" with a "1 flag" badge, and the account menu's badge counts it.

**Two holes found by hand and closed** (M3-9): the gate's cache lived in two copies (the proxy and the routes are
separate bundles), so a sign-out took up to 30 s to bite; and a capped browser could re-register with its
still-unexpired token. The cache now lives on `globalThis`, and every sign-out evicts its sessions. A signed-out
session never registers again, and the `/api/auth/*` routes ask Supabase Auth whether the session is still alive.
Both have tests.

### The new tables and RLS

Migration **`supabase/migrations/20261126090000_v08_front_door_r3_signins.sql`** (named after the latest on `main`
and live, `20261125110000`), with `supabase/ops/front_door_r3/{apply,verify,rollback}_front_door_r3.sql`.

| Table | Holds | Who reads | Who writes |
|---|---|---|---|
| `account_devices` | one row per browser a person signed in on: label, browser, OS, form, rough place, the Supabase session now, trusted until, signed in, last active, signed out (when, why) | the person; the School-Admin or account holder of a school where they're approved staff. Never `token_hash` or `session_id` (column grants) | the service role only |
| `device_codes` | codes, HMAC-hashed, with expiry and attempts | nobody but the service role | the service role |
| `account_sign_ins` | each sign-in and change of place (the alert reads it) | as `account_devices` | the service role |
| `school_email_domains` | a school account's domains | its School-Admin or account holder | the same (insert, delete); no personal domains |

Plus `school_memberships.off_domain`, `exception_approved_at`, `exception_approved_by`; the guard and seed triggers;
`join_school` (as `20261103090000`, plus the mark and the seed); `revoke_auth_session` (service role only; deletes the
session from `auth.sessions`); helpers `is_school_admin_of_profile`, `email_on_school_domain`,
`seed_school_email_domain`, `is_personal_email_domain`, `email_domain_of`.

PGlite (`supabase/tests/v08_front_door_r3_signins_pglite.mjs`, 37 checks) covers:
- the migration runs twice;
- the backfill and the seeding;
- who reads and writes each table;
- joining on and off the domain, and approving;
- `revoke_auth_session` ending the session;
- the rollback removing it all and restoring the previous `join_school`, then the ops apply running again.

### Device codes: behind the flag, and what switching them on takes

**Off** (`DEVICE_CODES` unset). To switch them on:

1. **Pick a provider.** The code is written for **Resend** (`src/lib/devices/mailer.ts`, one HTTP call; another
   provider is one function). Create the account, verify the sending domain (`vicdata.co.uk`: the DNS records Resend
   gives, on Cloudflare), and create an API key.
2. **On Render, set** `RESEND_API_KEY=<key>`, `DEVICE_CODE_FROM="VicData <signin@vicdata.co.uk>"`, and (recommended)
   `DEVICE_CODE_SECRET=<a random 32+ character string>`. Without it, codes are keyed by the service role key.
   Then set `DEVICE_CODES=on`.
3. **Optional, same provider:** set it as Supabase's custom SMTP (Auth → SMTP), so "Forgot password?" emails aren't
   held to Supabase's few-an-hour sender.
4. **Check:** sign in on a private window. The code email arrives, and the device is then listed on Where you're
   signed in.

## "Forgot password?" under cookie sessions (main's 6b7db90a, merged here)

Main's reset page read the recovery session from the URL fragment (the old implicit flow). With cookie sessions the
browser client uses PKCE, so:

- **Supabase's own link** (the email template's `{{ .ConfirmationURL }}`, today's) comes back as
  `/reset-password?code=…`; the browser client exchanges it. That works **only in the browser that asked** (it holds
  the code verifier); opened anywhere else it says "That link doesn't work any more" and offers a new one.
- **`/auth/confirm`** (new) redeems the email's `token_hash` on the server and sets the session cookie, so the link
  works **in any browser** (`?recovery=1`). It needs the "Reset password" email template to link there (Guy, in the
  go-live sequence).
- A bad or used link comes back as `?error=…` and says so.
- **After the new password the page runs the device step** (`/api/auth/device`): home on a known device, the code
  screen on a new one (with codes on).
- `/login` is one page: the signed-out frame, the device step and "Forgot password?" in place (the email-a-link form,
  `ForgotPasswordForm`, now drawn with the frame's controls; `/reset-password` too).
- R-PASSWORD-RESET: `parseRecoveryArrival` reads `?code=` and `?recovery=1` as a recovery (it read `?code=` as
  nothing); new `confirmDestination` and `afterResetDestination`; 10 tests (was 8); the statement rewritten.

Checked by hand: a recovery token for a Leighton Park test account (admin API, no email sent) through `/auth/confirm`
shows "Choose a new password" for that account with the session cookie set (the form was not submitted: no password
was changed); the same link again, and an expired link, say "That link doesn't work any more"; "Forgot password?" on
`/login` opens the form.

## The landing page: the logo, and three backgrounds to choose from

The logo is large now (96 px tile and 72 px wordmark on a desktop, 64/48 on a phone) and lives in one file,
`src/components/auth/Logo.tsx`, so the provisional mark is one swap (the small one in the signed-out frame comes from
the same file). Under it, a fine five-colour line, then "Private beta" and Sign in. Nothing else.

The colours are VicData's own, in the school journey's order: **Admissions** sky (`#1596db` Light / `#22d3ee` Dark),
**Primary** blue (`#2563eb` / `#60a5fa`, PHASE_TONES), **GCSE** green (`#12a05c` / `#34d399`), **Post-16** violet
(`#7c5ce6` / `#a78bfa`), and the **whole school's** orange (SMT, `#c2410c` / `#fb923c`, ROLE_ACCENT_LIGHT/ROLE_ACCENT):
each in its Light value on Light and its Dark value on Dark.

One constant picks the background, `LANDING_VARIANT` in `src/components/auth/landing-variant.ts`:

| Variant | What it is | Screenshots |
|---|---|---|
| **`arcs` (the default, recommended)** | five thin translucent concentric arcs from the lower right, one per colour; they draw themselves in once (1.4 s), never under prefers-reduced-motion. Quiet, and the only one with a sense of depth. | `landing_variant_arcs_{desktop,phone}_{dark,light}.png` |
| `spectrum` | only the five-colour line under the logo: the most restrained | `landing_variant_spectrum_…` |
| `bands` | five translucent ribbons fanned across the lower right, like a home's phase tabs laid on their side | `landing_variant_bands_…` |

All three are `aria-hidden`, textless and clipped (390 px wide at phone width; a test checks), and the page still says
only the logo, "Private beta" and Sign in, with no scripts and noindex (R-LANDING-MINIMAL, 14 tests in its file).

## Nav and header changes (for the agent making the top navigation consistent)

Only what Stage 2 needs; all in the shared chrome:

1. **`src/components/NavBar.tsx`**
   - returns nothing on the signed-out screens: `/`, `/login`, `/reset-password`, `/forgot-password`
     (`isBarePath`, `src/components/front-door/BareRoutes.tsx`);
   - returns nothing on `/teacher/school-account/*` (those pages draw their own header, `AdminShell`);
   - signed out, it shows only "Log in" ("Sets" and "Join your school" both led to the landing page);
   - "Sets" moved inside the signed-in branch, unchanged otherwise.
2. **`src/components/Footer.tsx`** — wrapped in `HideOnBareRoutes`: no footer on the signed-out screens.
3. **`src/app/layout.tsx`** — `SignInNotice` (the cap's one-line amber notice) sits above `NavBar`; the root
   metadata lost its description.
4. **`src/components/shell/TeacherNav.tsx` (`AccountMenu`)** — "Log out" calls `signOutHere()` (`src/lib/sign-out.ts`:
   this browser only, then a full load of `/`); `useRouter` is gone from `AccountMenu`.
5. **`src/app/account/page.tsx`** — its Log out uses the same helper; "Where you're signed in" sits under View as.
6. **`src/components/school-admin/SchoolAccount.tsx`** — the account page's Sign-ins row and its padlock icon.

The signed-out screens use their own frame (`src/components/auth/AuthShell.tsx`), not the shared nav. A shared nav
change should keep `isBarePath` (or its own equivalent) so the landing page stays logo, "Private beta" and Sign in.

## Phone (G)

The landing page, sign-in, the device-code screen and Where you're signed in share one signed-out frame
(`src/components/auth/AuthShell.tsx`): one column, at most 358 px, 44 px inputs and buttons, a 16 px gutter. The
School-Admin's Sign-ins page is one column of cards in the account pages' frame; the cap's notice has a 44 px
dismiss.

R-FRONT-DOOR-MOBILE now scans these files too. The scan learned Tailwind's `min-h-11` (44 px) and the frame's shared
class constants (`SHARED_CLASS_FILES`); without them it finds the sign-in page's three controls, so it really checks.
Measured at 390 × 844 in headless Chromium, every screenshot below scrolls to 390 px, no wider. `/account` was 412 px:
its `<main>` sized itself to its longest line. Fixed with `w-full` and a 16 px phone gutter.

Also fixed on the way: the old site nav was drawn above the School-Admin's account pages' own header, Part 2's
included. It's hidden on `/teacher/school-account/*`.

## Screenshots

`docs/v0.8/front_door_3_screenshots/`, desktop (1280) and phone (390 × 844), Dark and Light, from a local production
build. How they were made:

- **Sign-in:** real Supabase Auth, using the preview account and Guy's Leighton Park test School-Admin. Its session
  was made through the admin API's magic link, as a password sign-in would make it. No password was used or seen.
- **Data:** the real project, except the four new tables, which a local stand-in held in memory (the migration isn't
  applied).
- **Made up:** the device rows of the other staff, five places for one of them (the flag), and the two waiting
  requests ("A. Governor (made up)" on gmail.com, the Exception; "New Teacher (made up)" on leightonpark.com).
- **Places:** set as Cloudflare's headers would set them.
- **Masked:** Guy's test addresses and name, on their way to the page (`admin@leightonpark.example`, "Staff member"),
  because the repo is public.

| Screen | Files |
|---|---|
| Landing, three variants (the default first) | `landing_variant_{arcs,spectrum,bands}_{desktop,phone}_{dark,light}.png` (desktop 1440) |
| Sign in | `signin_{desktop,phone}_{dark,light}.png` |
| New-device code | `device_code_{desktop,phone}_{dark,light}.png` |
| Where you're signed in | `where_signed_in_{desktop,phone}_{dark,light}.png` |
| The School-Admin's account page (the new row and badge) | `admin_account_{desktop,phone}_{dark,light}.png` |
| The School-Admin's Sign-ins and devices | `admin_signins_{desktop,phone}_{dark,light}.png` |
| Join requests with an exception (People) | `join_requests_exception_{desktop,phone}_{dark,light}.png` |
| The cap's notice on the new device; the capped device's next page | `cap_notice_desktop.png`, `signed_out_cap_desktop.png` |

## Rules

Added (each with its own named tests; `scripts/catalogue-rule-tests.ts` runs them under check `frontDoor3`):

- **R-COOKIE-SESSION** (milestone 1) — `src/lib/auth-session.test.ts`, 10 tests, against a stand-in Supabase Auth with
  its own ES256 key (`src/lib/auth-testkit.ts`).
- **R-BETA-GATE** — `src/lib/beta-gate.test.ts`, 9 tests. Rewritten from the prompt's for Q2: `/join/<urn>` opens
  signed out.
- **R-LANDING-MINIMAL**, **R-NOINDEX-SCHOOLS** — the same file, 2 tests each.
- **R-DEVICE-CODES**, **R-DEVICE-CAP** — `src/lib/devices/devices.test.ts`, 13 tests (the real routes and proxy over a
  memory store). R-DEVICE-CODES also has a PGlite check.
- **R-SIGNINS-RLS**, **R-JOIN-DOMAIN** — the PGlite suite (13 and 20 checks named for them) and
  `src/lib/school-admin/signins.test.ts`.

Rewritten:
- **R-ADMIN-BADGE** — the account page now has the Sign-ins and devices row. Its live check expected none; it now
  expects the row, with a badge exactly when someone is flagged. Live today it reads "Not set up yet" (no migration).
- **R-FRONT-DOOR-MOBILE** — extends to Part 3's screens.
- **R-FEEDBACK-PROMOTE** — the words only ("the access gate" is now the private-beta gate).

Retired: none. `docs/catalogue/*.md` regenerated.

## Tests and parity

All on the branch as rebased onto `f22b8834`, run 22 Nov:

- `npx next typegen && npx tsc --noEmit -p .`: clean. `npm run build`: clean. ESLint on every changed file: clean.
- **Unit tests** (`find src -name "*.test.ts" -o -name "*.test.tsx" | xargs node --env-file=.env --env-file=.env.local
  --import tsx --test --test-force-exit`, in the foreground): **929 pass, 1 fail**. The failure is R-GROUP-WALKS-LOAD,
  already failing on `main`. `--test-force-exit` because `view-as-pages.test.ts` never exits without it (its header
  says so); it hangs the same way on a clean `main`.
- **Rule tests: 15 pass, 0 fail** -- R-COOKIE-SESSION, R-BETA-GATE, R-LANDING-MINIMAL, R-NOINDEX-SCHOOLS,
  R-DEVICE-CODES, R-DEVICE-CAP, R-SIGNINS-RLS, R-JOIN-DOMAIN, R-ADMIN-BADGE, R-MEMBERSHIP, R-FRONT-DOOR-MOBILE,
  R-PASSWORD-RESET, R-NO-PUBLIC-SCHOOL-LINKS, R-FEEDBACK-PROMOTE, R-REPORT-COMMANDS-ORDER.
- **PGlite:** every suite passes, the new one at 37/37. Three need a `PGLITE_DIR` data folder (LA crosswalk, LSOA
  boundaries, catchment) and weren't run; they don't touch auth or memberships.
- **Parity harnesses:** not run. No figure code changed: the round touches sign-in, the gate, the account and admin
  pages, People's join requests, the landing page and the nav. The results cache is untouched (no route of this round
  calls `cachedResult`; its views list and check pass).

### Checked by hand (local production build, 22 Nov, rebased)

- **Signed out:** `/`, `/login`, `/reset-password`, `/join/110110` and `/api/health` are 200. `/schools/110110` (and
  `/data`) go to `/member` (main's redirect), then `/`; `/teacher` and `/member` go to `/`. API calls are 401; preview
  with a wrong token 404. The landing page sends `X-Robots-Tag: noindex, nofollow` and has no third-party script.
- **Preview:** the route leaves a cookie session and no localStorage token, registers a `preview` device, lands on
  `/teacher`; signed in, `/` goes to `/member` and on to `/teacher`.
- **Peek:** the SMT peek at Leighton Park loads with no API errors.
- **View as:** SMT at Leighton Park, through the `vicdata_view_as` cookie, as the preview platform admin: the banner
  ("Viewing as SMT · Leighton Park School") and the page, with no API errors.
- **Sign out:** from the account menu, back to the landing page with no session cookie left.
- **warm-demo.mjs:** signs in through the preview route and warms all seven pages with no API errors.
- **Reset:** see "Forgot password?" above.

**Milestone 3, against the stand-in tables (above):**
- **Code:** a Leighton Park test account's new browser goes to the code screen, and the API is 401 until the code. A
  wrong code says "That isn't the code we sent. 4 tries left."; the right one goes home (`/teacher/welcome`), trusted for
  60 days.
- **Cap:** a 4th browser signs out the oldest and shows the notice (on the welcome page: found broken after the rebase,
  when sign-in started forwarding through `/member` to `/teacher`, and fixed). The capped browser's next page is
  `/login?signedOut=cap`, its cookies are cleared, and its token can't re-register (401).
- **Where you're signed in:** signs out one device, then all.
- **Sign-ins and devices:** shows "6 devices · 1 flag"; Sign out takes a person off both their devices (reason admin).
- **People:** shows the made-up gmail.com request as an Exception, with "Approve as an exception".

**Not checked by hand:**
- **A real password sign-in:** no password is known here. It is the same `signInWithPassword` call as before. The
  Leighton Park test accounts will sign in with their passwords, once more after the deploy, straight in with codes
  off.
- **A real code email:** no provider.
- **RLS against the live database:** PGlite only, as the migration isn't applied.

## Open

- **The reset email's template.** Supabase's own link works only in the browser that asked. For a link that works on
  a phone too, set the "Reset password" template to link through `/auth/confirm` (go-live step 1).
- **The hidden school pages (main's R-NO-PUBLIC-SCHOOL-LINKS).** `/schools/**` redirects to `/member` in
  `next.config.ts`, before the proxy; the gate then sends a signed-out visitor on to `/`, and `/member` sends a
  signed-in one to `/teacher`. So Q4's count of signed-in `/schools/` views never fires now: harmless, kept for when
  the pages come back. Sending `/schools/**` straight to `/teacher` or `/` in the proxy was possible but not done
  (one hop more, nothing gained, and their rule passes as is).
- **The API routes still read `Authorization`.** The proxy fills it from the cookie. Moving each route to the cookie
  itself is a behaviour-free tidy-up for later.
- **Cloudflare's "Add visitor location headers"** (a managed transform) gives the city. Without it, places are
  countries, and the alert counts countries.
- **The account menu's badge read** now includes the sign-in counts: one more round trip, in parallel (M3-14).
- **The old site nav still shows above `/teacher/welcome`** (and other Teacher pages not in its hide list):
  pre-existing, the nav agent's.

## Guy's commands

The go-live sequence. **Who:** "Guy" is Guy in the Supabase, Render and Cloudflare dashboards; "the parent" is the
agent that merges and applies the migration from `~/dev/vicdata_public`. The live site is **`https://vicdata.co.uk`**.
The order matters at two points: **the migration goes in before the deploy** (the new gate reads `account_devices`
on every signed-in request and refuses everyone without it), and **the old `ACCESS_GATE_*` variables come off Render
only after the new deploy is live and checked** (the old code, if ever rolled back to, needs them, and without them
it locks everyone out).

**Before step 1 (Guy, Supabase and Render; nothing changes for users yet):**

- **Supabase → Authentication → URL Configuration → Redirect URLs:** add `https://vicdata.co.uk/auth/callback`.
  (The Site URL is already `https://vicdata.co.uk`, and `https://vicdata.co.uk/reset-password` is already listed.)
  Verify: both show in the list. Roll back: remove it (nothing uses it until the deploy).
- **Supabase → Authentication → Emails → "Reset password" template (recommended):** make the link
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` in place of
  `{{ .ConfirmationURL }}`, so a reset link opened on another device (a phone's mail app) works. **Do this together
  with step 3, not before**: today's live code has no `/auth/confirm` (a link would 404 until the deploy). Verify:
  after step 4, "Forgot password?" for a test account, open the link on a different browser: "Choose a new password".
  Roll back: put `{{ .ConfirmationURL }}` back (links then work in the asking browser only).
- **Render → the service → Settings → Health Check Path:** check it is `/api/health` (outside the gate; always 200). If
  it is `/` it still works (the landing page is 200); anything else (a `/teacher` path) would now answer 307: change it
  to `/api/health`.
- **Render → Environment:** keep `ACCESS_GATE_ENABLED`, `ACCESS_GATE_USER`, `ACCESS_GATE_PASSWORD` for now (removed at
  step 7). Keep all four `PREVIEW_ACCESS_*`. Optional now: add `DEVICE_CODE_SECRET` (a random 32+ characters; without
  it codes are keyed by the service role key). Leave `DEVICE_CODES` and `DEVICE_SESSIONS` unset. Saving env vars
  redeploys the current (old) code, harmlessly.
- **Cloudflare (optional, any time):** Rules → Transform Rules → Managed Transforms → "Add visitor location headers",
  for city-level places. Also check no Cache Rule caches HTML ("Cache Everything"): sign-in pages and their cookies
  must never be cached (the app sends `Cache-Control: private, no-store` on refreshed sessions).

**1. Migrations** -- the parent, after merging locally (step 2's merge, **not yet pushed**), from the `main` checkout:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --remote --yes -f supabase/ops/front_door_r3/apply_front_door_r3.sql && supabase db query --remote --read-only "select version, name from supabase_migrations.schema_migrations where version = '20261126090000'"
```

Expect one row: `20261126090000 | v08_front_door_r3_signins`. Then the read-only checks:

```
cd ~/dev/vicdata_public && supabase db query --remote --read-only -f supabase/ops/front_door_r3/verify_front_door_r3.sql
```

Expect: the four tables, all `rls = true`; the five policies; the three `school_memberships` columns; both triggers;
`revoke_auth_session` executable by `service_role` only; each school's domains (Leighton Park's `(none)`: its admins
are mac.com test accounts); `off_domain_memberships = 0`.

The old live code keeps working on the new schema (same `join_school` signature; nothing it reads changed). **Roll
back** (only while the old code is still live, or after rolling the app back, step 3):
`supabase db query --remote --yes -f supabase/ops/front_door_r3/rollback_front_door_r3.sql`.

**2. Merge and push** -- the parent, on a clean `main` (the branch is rebased onto `f22b8834`; if `main` has moved,
rebase again first):

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-front-door-3 -m "0.8 front door part 3: cookie sessions; the private-beta gate and landing page in place of Basic Auth; new-device codes (off), the device cap, Where you're signed in; joining on the school's email domain; the School-Admin's Sign-ins and devices; Forgot password under cookie sessions" && npm install && npm run build
```

(`npm install`: the round adds `@supabase/ssr`.) Then step 1 (the migration), then push:

```
cd ~/dev/vicdata_public && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand.
Now (Guy) switch the reset email template, as above. **Roll back the app:** Render → the service → Events → the
previous deploy → "Rollback to this deploy" (the old code; the `ACCESS_GATE_*` variables are still set, so its Basic
Auth gate works), or revert the merge and push. **If only the device check misbehaves** (people stuck at
"Finishing signing in…", or 503 "VicData can't check your sign-in"): set `DEVICE_SESSIONS=off` on Render (milestone
2's gate: signed in = a verified session); remove it once fixed.

**4. Wait until /api/version shows the merge commit.**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

Then, straight away (anyone):

```
curl -s -o /dev/null -w "%{http_code}\n" https://vicdata.co.uk/api/health          # 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://vicdata.co.uk/teacher   # 307 https://vicdata.co.uk/
curl -s -o /dev/null -w "%{http_code}\n" https://vicdata.co.uk/api/teacher/phases   # 401
curl -sI https://vicdata.co.uk/ | grep -i x-robots                                   # noindex, nofollow
```

No browser password prompt anywhere from now on.

**5. Republish:** none this round. No published dashboard changed.

**6. Set fixed:** none this round (no feedback items).

**7. Live check** -- on vicdata.co.uk, in private windows, Dark and Light, and once at phone width. **Everyone is
signed out once by the deploy** (the session moved from localStorage to a cookie): Leighton Park's testers need
their passwords (or "Forgot password?").

- **A signed-out visitor:** `/schools/110110`, `/sets`, `/teacher/smt` all land on the landing page: the large logo,
  the five-colour line and arcs, "Private beta", Sign in, nothing else.
- **Preview and warm-up:** `/api/testing/preview-session?token=…` lands on `/teacher` signed in (now also as a
  `preview` device: up to 10 at once, the oldest signed out beyond that); `node scripts/warm-demo.mjs 110110` (the
  script from `main` after the merge) signs in and warms every page. The peek
  `https://vicdata.co.uk/teacher/smt?lookAs=110110&as=smt&peek=1` loads; View as from the account menu works and
  Back to me returns.
- **A known user on a new device:** sign in on Leighton Park's test teacher in a new private window: straight in
  (codes are off), the welcome or the home. `/account` → **Where you're signed in** lists "This device" with a place.
  Sign in on three more browsers: the 4th says "…so we signed you out on …"; the first, reloaded, lands on sign-in
  saying why.
- **Forgot password:** on a test account, "Forgot password?" → the email → the link → "Choose a new password" → save
  → home. (Supabase's built-in sender allows only a few emails an hour: don't spend them before the demo.)
- **An invited teacher:** `/join/110110` opens signed out → Join with a test address → "Request sent" → **See your
  account**. The School-Admin approves it on People (an address outside the school's domains shows **Exception**:
  **Approve as an exception**). Decline or remove the test account afterwards.
- **A School-Admin** (Leighton Park's test admin): **People → Who can join**: add `leightonpark.com`. The account menu
  → **School account** → **Sign-ins and devices** lists the staff and their devices; **Sign out** a test member and
  confirm their browser is signed out on its next page.
- **Platform:** `/platform` shows **Sign-in flags** ("None.").

**Then (Guy, Render), once Monday's checks pass:** delete `ACCESS_GATE_ENABLED`, `ACCESS_GATE_USER`,
`ACCESS_GATE_PASSWORD` (nothing reads them now; keep them while a rollback to the old code is still possible).

### What can still bite on the live site

- **Everyone is signed out once.** Have the Leighton Park passwords to hand before the demo; "Forgot password?"
  depends on Supabase's built-in sender (a few emails an hour) until an SMTP provider is set up.
- **A Supabase outage now blocks signed-in pages** (the gate's device read fails closed with a 503) where before only
  the data would have failed. `DEVICE_SESSIONS=off` is the switch.
- **Preview access** works as before, but it is now a device: more than 10 preview browsers at once sign out the
  oldest (parallel agents plus warm-demo). It still needs all four `PREVIEW_ACCESS_*`, and the token in the URL.
- **Peek and View as** are unchanged (the admin's own session; the `vicdata_view_as` cookie), checked by hand.
- **scripts/warm-demo.mjs** must be the merged one (it waits for the session cookie; the old one waits for
  localStorage and times out).
- **Render's health check path** must be `/api/health` (or `/`), as above.
- **The reset email template**: until it links through `/auth/confirm`, a reset link works only in the browser that
  asked for it.
- **A platform admin** can be signed in on 5 devices at once; staff on 3. View as and peeks don't count as devices.
- **Leighton Park's email-domain list starts empty**: every new join request there is an Exception until
  `leightonpark.com` is added.
- **Device codes are off**: a stolen password still works on any browser until a mail provider is chosen and
  `DEVICE_CODES=on` (see "Device codes" above).
