// 0.8 front door part 3 (A1, R-BETA-GATE): which routes a visitor who isn't signed in may reach. Pure, so the
// rule is tested here and the proxy (src/proxy.ts) only asks it.
//
// Signed out:
//   - the landing page (/), sign-in (/login), the auth callback (/auth/callback, /auth/confirm) and the
//     password-reset pages (/reset-password, /forgot-password: "Forgot password?" is built on its own
//     branch, Q3; its routes are allowed here so it works the day it lands);
//   - /join/<urn> (Q2, 21 Nov): where an invited tester makes their account, so it must open signed out.
//     Always noindex (next.config.ts NOINDEX_SOURCES); it shows only the school's name, as before.
//   - the site's own files: robots.txt and sitemap.xml (a crawler must be able to read them), the icon;
//   - API: health, version and preview access (also outside the proxy's matcher) and nothing else.
// Everything else: a page redirects to the landing page; an API route answers 401.
// Signed in: everything, except that the landing page sends you on to your home (/member).

export const SIGNED_OUT_PAGES: readonly RegExp[] = [
  /^\/$/,
  /^\/login\/?$/,
  /^\/auth\/(callback|confirm)\/?$/,
  /^\/(reset|forgot)-password\/?$/,
  /^\/join\/[A-Za-z0-9-]{1,20}\/?$/,
  /^\/(robots\.txt|sitemap\.xml|favicon\.ico|icon(\.\w+)?|apple-icon(\.\w+)?)$/,
];

export const SIGNED_OUT_API: readonly RegExp[] = [/^\/api\/(health|version)\/?$/, /^\/api\/testing\/preview-session\/?$/];

// Milestone 3 (E24): a verified session is signed in only while its device is. Before that -- no device row yet,
// or a code still to type -- it may reach only the pages that finish signing in (FINISH_PAGES) and the auth API;
// every other page goes to /login to finish, every other API route answers 401. A device signed out elsewhere (by
// its owner, the cap, a School-Admin, VicData) is signed out: its session cookies are cleared and every page but
// those goes to /login, which says why.
export const FINISH_PAGES: readonly RegExp[] = SIGNED_OUT_PAGES.filter((r) => !r.test("/"));
export const FINISH_API: readonly RegExp[] = [/^\/api\/auth\//, ...SIGNED_OUT_API];

export type GateState = "out" | "in" | "unregistered" | "pending" | "revoked";
export type GateDecision = "pass" | "landing" | "unauthorized" | "home" | "finish_sign_in" | "signed_out";

export function gateDecision(pathname: string, signedIn: boolean | GateState): GateDecision {
  const state: GateState = signedIn === true ? "in" : signedIn === false ? "out" : signedIn;
  const api = pathname === "/api" || pathname.startsWith("/api/");
  if (state === "in") return pathname === "/" ? "home" : "pass";
  if (state === "out") {
    if (api) return SIGNED_OUT_API.some((r) => r.test(pathname)) ? "pass" : "unauthorized";
    return SIGNED_OUT_PAGES.some((r) => r.test(pathname)) ? "pass" : "landing";
  }
  if (api) return state !== "revoked" && FINISH_API.some((r) => r.test(pathname)) ? "pass" : SIGNED_OUT_API.some((r) => r.test(pathname)) ? "pass" : "unauthorized";
  if (FINISH_PAGES.some((r) => r.test(pathname))) return "pass";
  return state === "revoked" ? "signed_out" : "finish_sign_in";
}
