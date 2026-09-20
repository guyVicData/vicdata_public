## The bug, confirmed live against the deployed site, not guessed at

`src/app/api/testing/preview-session/route.ts` builds the magic-link `redirectTo` from `request.nextUrl.origin`. On `localhost` in dev that's harmless, which is why your own testing never caught it. On the real deployment (Render, behind Cloudflare), it resolves to an internal address instead of `https://vicdata.co.uk`.

Confirmed with a direct request against production:

```
GET https://vicdata.co.uk/api/testing/preview-session?token=<real token>

HTTP/2 302
location: https://lnhulykjlxmoneappnsp.supabase.co/auth/v1/verify?token=...&type=magiclink&redirect_to=http://localhost:3000
set-cookie: vicdata_preview_gate=... (correct — the hashed gate cookie per Q24)
```

The gate cookie is set correctly and the magic link itself is real and valid. But `redirect_to=http://localhost:3000` is an address that only exists inside Render's own container — Supabase verifies the one-time token fine, then tries to bounce the browser to an address nobody outside Render can reach. That's the entire failure: not the Supabase redirect allow-list (Q23, already handled), not the gate, not the sign-in mechanism (Q22) — just this one URL being wrong in production.

## The fix

Don't derive the redirect origin from the incoming request at all — nothing else in this codebase builds an absolute server-side URL, which is exactly why this problem had nowhere to hide until now, and why trusting the request's own idea of its origin isn't safe to do here.

Add a new required env var for this route specifically (naming your call — `PREVIEW_ACCESS_SITE_URL` is a reasonable name, e.g. set to `https://vicdata.co.uk`), and use it in place of `request.nextUrl.origin` when building `redirectTo`. Same fail-closed posture as the other three: if it's missing, the route doesn't exist (404), exactly like today.

Don't solve this by trusting `x-forwarded-host`/`x-forwarded-proto` headers instead — Supabase's own redirect allow-list (Q23) would still block a bad value, but this feature's whole design principle so far has been "nothing here trusts anything the caller or the platform hands it that it doesn't have to," and an explicit env var costs nothing extra to set alongside the three that already exist.

Update the build report / open-questions log with the new env var name so Guy knows to set it in Render alongside the other three.

## Verification — this is the part last round's testing structurally couldn't do

Local/dev testing cannot catch this bug, because `localhost` origin is correct in dev. This has to be verified against the real deployed site, live:

1. With the new env var set in Render (ask Guy to set it if you can't set Render env vars yourself, the same way he set the other three), hit the real route and confirm the `location` header's `redirect_to` now reads `https://vicdata.co.uk/teacher` (or whatever path), not `http://localhost:3000` or any other internal address.
2. Follow the full chain for real: route → Supabase `/auth/v1/verify` → final redirect back to `https://vicdata.co.uk/teacher#access_token=...`. Confirm that token resolves to `preview-agent@vicdata.co.uk` and the page actually renders signed in.
3. Confirm the gate cookie still works and the school-switcher still works from that real session, same as last round — this fix shouldn't touch either.

Don't declare this done from reading the code. Last round's report was accurate about everything it actually tested live, and wrong about nothing it checked this way — the gap was purely that this one thing couldn't be tested from localhost. Close that gap with a real request against the real deployed URL this time.

## Scope

Single narrow fix: the redirect origin, plus documenting the new env var. Don't touch anything else in this feature — the gate, the cookie, the sign-in mechanism, and the membership logic are all already correct and verified.

Commit and push once verified against the live site.
