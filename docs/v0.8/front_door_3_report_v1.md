# VicData 0.8 front door, part 3: sign-in, the beta gate and account security (report v1)

Built 21 Nov 2026 on branch **`v0.8-front-door-3`** (from `main`, rebased onto `7c8082cc`), from
`docs/v0.8/vicdata_0_8_front_door_part3_signin_gate_security_claude_code_prompt_v1.md` and Guy's answers of 21 Nov:
Q1 cookie sessions first; Q2 `/join/<urn>` stays open signed out; Q3 "Forgot password?" is built on its own branch
(its routes are let through here); Q4 count signed-in views of `/schools/...`; Q5 device codes behind
`DEVICE_CODES=off`; A3 was already on `main` (837a3cf) and is kept, with its tests and rule added. Every call made
without asking is logged under "2026-11-13: front door, part 3" in `docs/OPEN_QUESTIONS.md` (M1-1 … M3-15).

**Nothing here is live, and nothing was written to the database.** The migration is written and tested in PGlite;
Guy applies it (step 1 below), and it **must be applied before the deploy** (M3-2).

## How far it got

| Milestone | Commit | State |
|---|---|---|
| 1. Cookie sessions (Q1) | `fbcce008` | done |
| 2. Beta access: the gate, the landing page, noindex (A1-A3), preview access on the new gate | `d6dc2d81` | done |
| 3. Account security (E24, E25) and the admin's Sign-ins page (F27) | `f40dd91f` | done (device codes behind the flag) |
| 4. Phone layouts (G) and this report | the commit after `f40dd91f` | done |

Left open (details under "Open"): device codes have never sent a real email (no provider, Q5); the
forgot-password branch needs one change when it meets this one; the 50-odd API routes still read `Authorization`
(the proxy fills it from the cookie), a later tidy-up.

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

- `/auth/callback` is built (a PKCE `?code=` exchanged onto the cookie session). `/auth/confirm` and the reset pages
  are allowed but not built here (Q3's branch).
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
| Landing | `landing_{desktop,phone}_{dark,light}.png` |
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

- `npx next typegen && npx tsc --noEmit -p .`: clean. `npm run build`: clean. ESLint on every changed file: clean.
- **Unit tests** (`find src -name "*.test.ts" -o -name "*.test.tsx" | xargs node --env-file=.env --env-file=.env.local
  --import tsx --test`): **900 pass, 1 fail** (after the rebase onto `7c8082cc`). The failure is R-GROUP-WALKS-LOAD, already failing on `main`. Run with
  `--test-force-exit`: without it, `view-as-pages.test.ts` never exits (its header says so), and it hangs the same way on
  `main` (checked on a clean `origin/main` worktree).
- **Rule tests:** the nine above pass, plus R-MEMBERSHIP and R-FEEDBACK-PROMOTE (with PGlite installed).
- **PGlite:** every suite passes, the new one at 37/37. Three need a `PGLITE_DIR` data folder (LA crosswalk, LSOA
  boundaries, catchment) and weren't run; they don't touch auth or memberships.
- **Parity harnesses:** not run. No figure code changed: the round touches sign-in, the gate, the account and admin
  pages, People's join requests and the nav. The R-ADMIN-BADGE live read shows Leighton Park's real rows unchanged.

### Checked by hand (local production build)

- **Sign-in / preview:** the preview route leaves a cookie session and no localStorage token. `/teacher` and its API
  calls load; cookie-only API calls answer 200; a call with no cookie gets 400 before the gate and 401 after it.
- **Signed out:** `/`, `/login`, `/join/110110` and `/robots.txt` are 200. `/schools/100053`, `/sets`, `/teacher`,
  `/member` and `/sources` go to `/`. API calls are 401; health and version 200; preview with a wrong token 404. The
  landing page sends `X-Robots-Tag: noindex, nofollow` and has no third-party script.
- **Peek:** the SMT peek at Leighton Park loads with no API errors, under milestones 1, 2 and 3.
- **Sign out:** from the account menu, back to the landing page with no session cookie left.
- **warm-demo.mjs:** signs in through the preview route and warms all seven pages, with no API errors, under
  milestones 2 and 3.

**Milestone 3, against the stand-in tables (above):**
- **Code:** a Leighton Park test account's new browser goes to the code screen, and the API is 401 until the code. A
  wrong code says "That isn't the code we sent. 4 tries left."; the right one goes home, trusted for 60 days.
- **Cap:** a 4th browser signs out the oldest and shows the notice. The capped browser's next page is
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

- **Forgot password (Q3), when it lands:** `@supabase/ssr` uses PKCE, so the recovery link comes back as
  `/reset-password?code=…` (exchanged by the browser that asked), and a bad link as `?error=…` in the query, not the
  fragment that branch parses. After the new password, the page should call `POST /api/auth/device` (or go to
  `/login?step=device`) before going home. Its routes already pass the gate. The two branches both edit
  `src/app/login/page.tsx`: keep this branch's frame and device step, and add its "Forgot password?" link and form
  under the password field (M1-7).
- **Supabase Auth's Site URL** reads `http://localhost:3000` (found 20 Nov). Set it to `https://vicdata.co.uk`, and add
  `https://vicdata.co.uk/auth/callback` (and Q3's `/reset-password`) to the redirect URLs, so email links land.
- **The API routes still read `Authorization`.** The proxy fills it from the cookie. Moving each route to the cookie
  itself is a behaviour-free tidy-up for later.
- **Cloudflare's "Add visitor location headers"** (a managed transform) gives the city. Without it, places are
  countries, and the alert counts countries.
- **The account menu's badge read** now includes the sign-in counts: one more round trip, in parallel (M3-14).

## Guy's commands

The branch `v0.8-front-door-3` is local, not pushed: the worktree at `~/.t3/worktrees/vicdata_public/t3-df302cf6`
shares the repository with `~/dev/vicdata_public`, so it is there already. The live site is
**`https://vicdata.co.uk`**. This goes live **after the Leighton Park demo**. Everyone signs in once more after it.

**1. Migrations** — apply `20261126090000_v08_front_door_r3_signins` **before** merging. The new gate checks
`account_devices` on every request and fails closed without it. The apply file is the migration plus its
`schema_migrations` row, in one transaction (writes: the project-ref check first). Then verify.

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-front-door-3:supabase/ops/front_door_r3/apply_front_door_r3.sql > /tmp/apply_front_door_r3.sql && supabase db query --remote --yes -f /tmp/apply_front_door_r3.sql && supabase db query --remote --read-only "select version, name from supabase_migrations.schema_migrations where version = '20261126090000'"
```

Expect one row: `20261126090000 | v08_front_door_r3_signins`. Then the read-only checks:

```
cd ~/dev/vicdata_public && git show v0.8-front-door-3:supabase/ops/front_door_r3/verify_front_door_r3.sql > /tmp/verify_front_door_r3.sql && supabase db query --remote --read-only -f /tmp/verify_front_door_r3.sql
```

Expect:
- the four tables, all `rls = true`;
- the five policies;
- the three `school_memberships` columns;
- both triggers;
- `revoke_auth_session` executable by `service_role` only;
- each school's domains (Leighton Park's `(none)`);
- `off_domain_memberships = 0`.

The rollback, if ever needed, is `supabase/ops/front_door_r3/rollback_front_door_r3.sql`. Run it after rolling back
the app, or with `DEVICE_SESSIONS=off` set.

Before the merge, on Render (Environment), **delete** `ACCESS_GATE_ENABLED`, `ACCESS_GATE_USER`,
`ACCESS_GATE_PASSWORD`. Add `DEVICE_CODE_SECRET` (a random 32+ characters) if you want codes keyed apart from the
service role key. Leave `DEVICE_CODES` and `DEVICE_SESSIONS` unset. Keep all four `PREVIEW_ACCESS_*`. In Supabase Auth
(URL configuration), set the Site URL to `https://vicdata.co.uk` and add `https://vicdata.co.uk/auth/callback` to the
redirect URLs.

**2. Merge and push** — from `~/dev/vicdata_public` on a clean `main`, merge, build, push:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-front-door-3 -m "0.8 front door part 3: cookie sessions; the private-beta gate and landing page in place of Basic Auth; new-device codes (off), the device cap, Where you're signed in; joining on the school's email domain; the School-Admin's Sign-ins and devices" && npm install && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

(`npm install`: the round adds `@supabase/ssr`.)

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge commit.**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** none this round. No published dashboard changed.

**6. Set fixed:** none this round (no feedback items).

**7. Live check** — on vicdata.co.uk, in a private window, Dark and Light, and once at phone width:

- **A signed-out visitor:** any school URL (`/schools/110110`, `/sets`, `/teacher/smt`) lands on the landing page:
  the wordmark, "Private beta", Sign in, nothing else. `curl -sI https://vicdata.co.uk/ | grep -i x-robots` reads
  `noindex, nofollow`; `curl -s -o /dev/null -w "%{http_code}" https://vicdata.co.uk/api/teacher/phases` reads 401.
  No browser password prompt anywhere.
- **An invited teacher** (a test address on a school that has members): the school's join link `/join/<urn>` opens
  signed out → Work email, Password, Full name → Join → "Request sent" → **See your account** (the request is
  pending; this browser is already the account's first device). The School-Admin approves it on People (an
  off-domain address shows as an **Exception**: **Approve as an exception**). The teacher's next visit to `/teacher`
  opens the welcome. (A first member verified on the school's website is approved at once: **Continue to VicData**
  goes straight to the welcome.) Decline or remove the test account afterwards.
- **A known user on a new device:** sign in on Leighton Park's test teacher in a new private window → straight in
  (codes are off). Open `/account` → **Where you're signed in** lists this browser as "This device", with a place.
  Sign in on three more browsers: the 4th says "…so we signed you out on …", and the first, reloaded, lands on
  sign-in saying why. (With codes on: the password, then "Check your email", the code, then in. A second sign-in on
  that browser asks no code.)
- **A School-Admin** (Leighton Park's test admin): the account menu → **School account** → the **Sign-ins and devices**
  row ("n devices") → the page lists the staff with their devices; **Sign out** a test member's devices and confirm
  their browser is signed out on its next page. Then **People** → **Who can join**: add `leightonpark.com`. A waiting
  request from outside it shows **Exception** and **Approve as an exception**; approve or decline it.
- **Preview and warm-up:** `node scripts/warm-demo.mjs 110110` signs in and warms every page as before. The peek
  `https://vicdata.co.uk/teacher/smt?lookAs=110110&as=smt&peek=1` loads as a platform admin.
- **Platform:** `/platform` shows **Sign-in flags** ("None." unless an account was used from more than 4 places in a
  day).
