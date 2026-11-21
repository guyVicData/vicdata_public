import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { countablePublicView, countPublicPageView, publicPageUrn } from "@/lib/usage-public";
import { sessionToBearer } from "@/lib/auth-cookies";
import { readRequestSession, verifyBearer, type RequestSession } from "@/lib/auth-server";
import { gateDecision } from "@/lib/beta-gate";

// 0.8 front door part 3 (A1, milestone 2): the private-beta gate. It replaces the sitewide Basic Auth
// password (its three env vars are gone; see the part 3 report for the ones to delete on Render). A visitor who isn't signed in reaches only
// the routes in src/lib/beta-gate.ts's SIGNED_OUT_PAGES and SIGNED_OUT_API (the landing page, sign-in, the
// auth callback and password-reset pages, /join/<urn> where invited testers make their account, health,
// version and preview access); every other page redirects to the landing page and every other API
// route answers 401. "Signed in" is a session the server has verified itself (the session cookie,
// milestone 1, or a Bearer token from a script) -- never just the presence of a header.
//
// The matcher skips Next's static files and the three routes that must answer before anyone is signed
// in and do their own checks (health, version, preview access: preview access is what SIGNS the agent
// in, so it can't sit behind the gate it satisfies; it fails closed as a plain 404 when unconfigured).
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/health|api/version|api/testing/preview-session).*)",
};

export async function proxy(request: NextRequest, event?: NextFetchEvent): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const session = await readRequestSession(request);
  // A script's Bearer token (no cookie) counts as signed in once verified here; the route checks it again.
  const signedIn = !!session.claims || (pathname.startsWith("/api/") && (await verifyBearer(request.headers.get("authorization"))));
  const decision = gateDecision(pathname, signedIn);

  if (decision === "unauthorized") return session.apply(NextResponse.json({ error: "Sign in to use VicData." }, { status: 401 }));
  if (decision === "landing") return session.apply(NextResponse.redirect(new URL("/", request.url), 307));
  if (decision === "home") return session.apply(NextResponse.redirect(new URL("/member", request.url), 307));

  const res = forward(request, session);
  // 0.8 shell + SMT r1 (B7), Q4 (21 Nov): a school page's daily count, now of SIGNED-IN views of /schools/<urn>
  // (signed out there is no school page to view). After the response (waitUntil), so the page is never slower.
  // Nothing about the viewer is sent or kept; prefetches and bots aren't counted (src/lib/usage-public.ts).
  const urn = publicPageUrn(pathname);
  if (urn && signedIn && event && countablePublicView(request.method, request.headers)) event.waitUntil(countPublicPageView(urn));
  return res;
}

// Milestone 1: an API request from the site's own pages that carries the session cookie but no Bearer token
// reaches the route with `Authorization: Bearer <access token>`, so every route keeps reading the header it
// reads today; a request that sends Bearer is untouched. Refreshed session cookies go out on the response.
function forward(request: NextRequest, session: RequestSession): NextResponse {
  if (session.accessToken && request.nextUrl.pathname.startsWith("/api/") && sessionToBearer(request.headers)) {
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${session.accessToken}`);
    return session.apply(NextResponse.next({ request: { headers } }));
  }
  return session.apply(NextResponse.next());
}
