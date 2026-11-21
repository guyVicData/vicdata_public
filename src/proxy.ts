import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { countablePublicView, countPublicPageView, publicPageUrn } from "@/lib/usage-public";
import { timingSafeEqual, sha256Hex, PREVIEW_GATE_COOKIE } from "@/lib/timing-safe";
import { sessionToBearer } from "@/lib/auth-cookies";
import { readRequestSession } from "@/lib/auth-server";

// Default-deny: the gate is active unless ACCESS_GATE_ENABLED is explicitly "false".
// Missing credentials with the gate enabled fails closed (blocks everything), it
// never falls open. See docs/vicdata_phase3_full_build_brief_v1.md — "Launch gating".
// api/testing/preview-session joins api/health in being excluded, and for a stronger
// reason than health's: that route is what SATISFIES the gate, so it has to be reachable
// before the gate is satisfied or the whole mechanism deadlocks. It does its own
// fail-closed checks and its own timing-safe token comparison, so being outside the gate
// costs nothing -- when the feature is unconfigured it is a plain 404.
// api/version (0.8 feedback deploy gate) is outside too: the republish script and Guy's commands read the
// live commit from it. It returns the commit and build time only; the repo is public, so neither is a secret.
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/health|api/version|api/testing/preview-session).*)",
};

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="VicData Public", charset="UTF-8"',
    },
  });
}

async function gate(request: NextRequest): Promise<NextResponse> {
  const gateEnabled = process.env.ACCESS_GATE_ENABLED !== "false";
  if (!gateEnabled) {
    return NextResponse.next();
  }

  const expectedUser = process.env.ACCESS_GATE_USER;
  const expectedPassword = process.env.ACCESS_GATE_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return unauthorized();
  }

  // Preview-access bypass (docs/vicdata_phase3_agent_preview_access_brief_v1.md).
  // An ADDITIONAL way to satisfy this gate, never a replacement: it is checked before the
  // Basic Auth paths below and changes nothing for anyone not holding the cookie. The
  // cookie carries a SHA-256 of the preview token rather than the token, so a stolen
  // cookie gets past the gate but cannot mint a session -- and if the feature is
  // unconfigured there is no expected value to match, so the branch cannot fire at all.
  const previewToken = process.env.PREVIEW_ACCESS_TOKEN;
  if (process.env.PREVIEW_ACCESS_ENABLED === "true" && previewToken) {
    const presented = request.cookies.get(PREVIEW_GATE_COOKIE)?.value;
    if (presented && timingSafeEqual(presented, await sha256Hex(previewToken))) {
      return NextResponse.next();
    }
  }

  const authHeader = request.headers.get("authorization");

  // Member Data View build (2026-10-03), real bug found live: every paid API route
  // in this app (paid-trends, comparator-set-peers, and now the data-view routes)
  // sends its own explicit `Authorization: Bearer <supabase-jwt>` header from
  // client-side fetch() calls. A browser that has already answered this gate's Basic
  // Auth prompt caches those credentials and auto-attaches them to ordinary page
  // requests -- but fetch()/XHR calls that set their OWN Authorization header
  // override the browser's cached one for that specific request (confirmed live:
  // curl with only a Bearer header against a running dev server, gate enabled,
  // returns this function's own 401 -- reproduced identically against the
  // already-shipped /api/paid-trends route, not something the Data View introduced).
  // Net effect: with the access gate on (the current default, per .env and the
  // "Active build and private testing" launch phase), EVERY bearer-token API route
  // in this app was silently unreachable from the browser, no matter how genuinely
  // logged-in the caller was.
  //
  // Fix: a syntactically-Bearer Authorization header satisfies THIS gate (whose real
  // job, per the launch-gating doc, is keeping an anonymous stranger out of the site
  // and off search engines) -- it does NOT grant any actual data access on its own.
  // Every one of these routes still independently verifies the token against real
  // Supabase auth/RLS before returning anything (an invalid or garbage bearer value
  // fails that check and gets its own 401/403 from the route itself, same as before
  // this fix) -- this only stops the SITE-WIDE gate from rejecting a request before
  // it ever reaches that real check.
  const isBearerRequest = authHeader?.startsWith("Bearer ") && authHeader.length > "Bearer ".length;
  if (isBearerRequest) {
    return NextResponse.next();
  }

  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(authHeader.slice("Basic ".length));
  } catch {
    return unauthorized();
  }

  const sepIndex = decoded.indexOf(":");
  if (sepIndex === -1) {
    return unauthorized();
  }
  const user = decoded.slice(0, sepIndex);
  const password = decoded.slice(sepIndex + 1);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(password, expectedPassword)) {
    return unauthorized();
  }

  return NextResponse.next();
}

// 0.8 shell + SMT r1 (B7): the public school page's daily count. A request the gate lets through to
// /schools/<urn> adds one to that school's count for the day, after the response (waitUntil), so
// the page is never slower and never changes. No cookie is set; nothing about the visitor is sent
// or kept; prefetches and anything that says it's a bot aren't counted (src/lib/usage.ts).
export async function proxy(request: NextRequest, event?: NextFetchEvent): Promise<NextResponse> {
  const gated = await gate(request);
  if (gated.headers.get("x-middleware-next") !== "1") return gated;
  const res = await withSession(request);
  const urn = publicPageUrn(request.nextUrl.pathname);
  if (urn && event && countablePublicView(request.method, request.headers)) event.waitUntil(countPublicPageView(urn));
  return res;
}

// 0.8 front door part 3, milestone 1: the cookie session. A request carrying the session cookie has it
// verified and, when the access token has expired, refreshed (the new cookies go out on this response).
// An API request from the site's own pages that carries the cookie but no Bearer token is given
// `Authorization: Bearer <access token>` from it, so every route that reads the header (all of them,
// today) works from the cookie alone; a request that already sends Bearer is untouched. The route still
// verifies the token itself, exactly as before.
async function withSession(request: NextRequest): Promise<NextResponse> {
  const session = await readRequestSession(request);
  if (session.accessToken && request.nextUrl.pathname.startsWith("/api/") && sessionToBearer(request.headers)) {
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${session.accessToken}`);
    return session.apply(NextResponse.next({ request: { headers } }));
  }
  return session.apply(NextResponse.next());
}
