# VicData — Passwordless preview access for automated browser agents (brief v1)

## Why this exists

The deployed site (`vicdata.co.uk`) sits behind two layers: a site-wide Basic Auth gate (`src/proxy.ts`, `ACCESS_GATE_*`) and real Supabase sign-in. Both require typing a credential into a field — which is a hard rule Claude (in Cowork, and potentially other automated agents later) will not do, regardless of how low-stakes the credential is or who authorises it. That isn't a permissions gap to work around; it's a deliberate boundary that stays in place even when explicitly asked to cross it. So "give Claude the password" was never actually going to work, and shouldn't be attempted again.

The fix has to remove the credential-entry step itself, not find a way around Claude's refusal to use one. A URL an agent can simply navigate to — the same category as a password-reset link or a magic sign-in link — does that: it's an ordinary `navigate` action, not credential entry.

## What to build

One combined, testing-only endpoint that a URL can hit to become both gate-authenticated and signed in, as a dedicated, clearly-separate "preview" profile — never as Guy's own real account.

**New environment variables** (unset by default — the whole feature must fail closed exactly like `ACCESS_GATE_*` already does when its own envs are missing):
- `PREVIEW_ACCESS_ENABLED` — `"true"` to turn this on at all.
- `PREVIEW_ACCESS_TOKEN` — a long random secret Guy generates and sets himself directly in the deployment's environment variables. Never invented or committed by the build; never written into a build report, migration, or any file that reaches git.
- `PREVIEW_ACCESS_EMAIL` — the email of a dedicated preview profile, distinct from Guy's real account.

**New route**, e.g. `src/app/api/testing/preview-session/route.ts` (GET, `?token=...`):
1. 404 immediately if `PREVIEW_ACCESS_ENABLED` isn't `"true"`, or if `PREVIEW_ACCESS_TOKEN`/`PREVIEW_ACCESS_EMAIL` aren't set — same fail-closed posture as the gate itself.
2. Timing-safe compare the `token` query param against `PREVIEW_ACCESS_TOKEN` (reuse `proxy.ts`'s existing `timingSafeEqual`, factored out to a shared location rather than duplicated).
3. On a match: set an httpOnly, secure cookie that `proxy.ts` will recognise as satisfying the Basic Auth gate (in addition to, not instead of, the existing check), **and** sign the browser in as the `PREVIEW_ACCESS_EMAIL` profile through whatever real sign-in mechanism the app already uses — read the actual sign-in code first and adapt to it rather than inventing a parallel auth path. If it's magic-link/OTP based, the Supabase Admin (service-role) API can generate a real sign-in link server-side and this route can redirect straight into the app's existing callback handler, so the browser ends up in a completely normal, real session — nothing bespoke to maintain.
4. Redirect to `/teacher` (or a `?redirect=` target).
5. On a token mismatch, fail the same way the route would if disabled — don't leak which check failed.

**`src/proxy.ts`**: exclude the new route's path from the gate's own matcher (same treatment `api/health` already gets — this route must be reachable before the gate is satisfied, since it's what satisfies the gate), and accept the bypass cookie as an alternative to a valid Basic Auth header.

**The preview profile itself**: create it via the service-role Admin API during the build if that's straightforward, and give it a real approved membership at one real starter school (reuse the logic already in `/api/testing/switch-school` rather than duplicating it) so `/teacher` has something to show immediately. Document exactly what was created — email, profile id, starter school — in the build report. Once signed in this way, the existing testing school-switcher works unmodified for hopping between schools; nothing about it needs to change.

## Safety posture — match the existing switcher's own standard, don't lower it

`/api/testing/switch-school`'s own comments are the bar to match: server-side only, never bundled into client JS, fails closed when unconfigured, scoped to exactly what it needs and nothing more. This feature is a materially bigger trust boundary than that one (it grants sign-in, not just a school change), so it deserves at least the same rigor:
- Real secret, generated and stored by Guy, never by the build.
- A distinct preview identity, never Guy's own profile — so its activity is always obviously attributable to agent testing, not accidentally conflated with his own account's real data.
- No UI entry point anywhere — this is a URL Guy or Claude navigates to directly, not a button that could be clicked by mistake.
- Should not be enabled by default in any environment; Guy turns it on deliberately when he wants an agent to be able to browse the deployed site.
