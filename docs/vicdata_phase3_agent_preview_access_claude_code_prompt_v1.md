## Step 0 — Confirm the brief is in the repo before starting

`docs/vicdata_phase3_agent_preview_access_brief_v1.md` and this prompt should already be committed alongside this round (they're being added directly this time, not left as chat-only documents — that gap caused real problems in the previous round, where three referenced briefs never made it into the repo). If for any reason either file is missing when you start, stop and say so rather than working from the pasted text alone — read the brief from `docs/` once it's confirmed present.

Read `docs/vicdata_phase3_agent_preview_access_brief_v1.md` in full before starting. It explains why this exists: Claude (running this project's Cowork sessions) has a hard rule against ever typing a password or credential into a field, however low-stakes or explicitly authorised — so the site's Basic Auth gate and normal Supabase sign-in are both structurally unreachable to it as they stand. This isn't a permissions problem to argue around; the fix is a URL an agent can navigate to directly, the same category as a password-reset or magic-sign-in link, so no credential-entry step exists at all.

## What to build

One combined, testing-only route: hitting it with the right token makes the browser both gate-authenticated and signed in as a dedicated preview profile, in one step.

1. **Read the real gate and sign-in code first.** `src/proxy.ts` for the Basic Auth gate (note its `timingSafeEqual` helper — factor it out to a shared location and reuse it here rather than duplicating it), and whatever the app's actual sign-in flow is (magic link / OTP / other) — adapt to what's actually there, don't invent a parallel auth mechanism.

2. **New env vars**, unset by default, whole feature fails closed if any are missing — same posture as `ACCESS_GATE_*`:
   - `PREVIEW_ACCESS_ENABLED` (`"true"` to enable at all)
   - `PREVIEW_ACCESS_TOKEN` (a long random secret — **Guy generates and sets this himself** directly in the deployment's env vars; never invent, generate, log, or commit a value for this, in code, migrations, or the build report)
   - `PREVIEW_ACCESS_EMAIL` (the dedicated preview profile's email — distinct from Guy's own account)

3. **New route**, `src/app/api/testing/preview-session/route.ts`, GET, `?token=...`:
   - 404 immediately if `PREVIEW_ACCESS_ENABLED` isn't `"true"`, or if `PREVIEW_ACCESS_TOKEN`/`PREVIEW_ACCESS_EMAIL` aren't set.
   - Timing-safe compare `token` against `PREVIEW_ACCESS_TOKEN`.
   - On match: set an httpOnly, secure cookie that `proxy.ts` will accept as an alternative to a valid Basic Auth header (in addition to the existing check, not replacing it), **and** sign the browser in as `PREVIEW_ACCESS_EMAIL` through the app's real sign-in mechanism — if it's magic-link/OTP based, generate a real sign-in link server-side via the Supabase Admin (service-role) API and redirect into the app's existing callback handler, so the result is a completely normal, real session.
   - Redirect to `/teacher`, or a `?redirect=` target if one's given.
   - On a token mismatch, fail exactly the way the route fails when disabled — don't leak which check failed.

4. **`src/proxy.ts`**: exclude this route's path from the gate's matcher (same treatment `api/health` already gets — it has to be reachable before the gate is satisfied, since it's what satisfies the gate), and accept the new bypass cookie as an alternative to a valid Basic Auth header everywhere else the gate applies.

5. **Create the preview profile** via the service-role Admin API if straightforward, and give it a real approved membership at one real starter school — reuse the logic already in `/api/testing/switch-school` rather than duplicating it, so `/teacher` has something to show immediately. Once signed in this way, the existing testing school-switcher works completely unmodified for hopping between schools afterwards.

## Safety posture — match `/api/testing/switch-school`, don't lower the bar

That route's own comments are the standard: server-side only, never bundled into client JS, fails closed when unconfigured, scoped to exactly what it needs. This feature is a bigger trust boundary (it grants sign-in, not just a school change), so hold it to at least the same rigor:
- The real secret is generated and stored by Guy, never by you.
- A distinct preview identity — never Guy's own profile.
- No UI entry point anywhere — this is a URL navigated to directly, never a button.
- Not enabled by default in any environment.

## Verification

You cannot fully round-trip this yourself, since `PREVIEW_ACCESS_TOKEN` is a real secret only Guy holds and sets in the deployment. Verify what you can:
- Confirm the route 404s when `PREVIEW_ACCESS_ENABLED` is unset or `"false"`, and when the token/email envs are missing.
- Confirm the route fails the same way on a wrong token as on being disabled (no distinguishing signal).
- If you can set these env vars in a local/dev environment with a real Supabase test profile, do a real round trip there: hit the route with the correct token, confirm the gate cookie is set, confirm the browser ends up genuinely signed in as `PREVIEW_ACCESS_EMAIL` with a working `/teacher` session, confirm the existing school-switcher still works normally from that session.
- Do not set or guess a value for `PREVIEW_ACCESS_TOKEN` in the deployed/production environment — that's Guy's step.

In the build report, spell out exactly:
- The final route path and query param name.
- The three env var names, verbatim, and a one-line description of what each holds (not values).
- What was created for the preview profile — email, profile id, starter school.
- The exact URL shape Guy will need to construct once he's set the env vars (e.g. `https://vicdata.co.uk/api/testing/preview-session?token=<PREVIEW_ACCESS_TOKEN>`), since that full URL — token included — is what gets pasted into a Claude chat for the agent to navigate to. That's the intended handoff: Guy sets the secret, builds the URL once, and shares that URL directly in chat; nothing is ever typed into a credential field.

## Scope

This is a testing-only access mechanism, nothing else. Don't touch the real sign-in flow's own behaviour for real users, don't change `ACCESS_GATE_*`'s existing behaviour for anyone not holding the new bypass cookie, and don't build any UI for this. If something related comes up that isn't covered here, log it in `docs/vicdata_phase3_teacher_view_open_questions_v1.md` (continue the Q-numbering) rather than expanding scope.

Commit and push once verified, including `docs/vicdata_phase3_agent_preview_access_brief_v1.md` and this prompt if either isn't already in the repo.
