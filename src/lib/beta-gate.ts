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

export type GateDecision = "pass" | "landing" | "unauthorized" | "home";

export function gateDecision(pathname: string, signedIn: boolean): GateDecision {
  const api = pathname === "/api" || pathname.startsWith("/api/");
  if (signedIn) return pathname === "/" ? "home" : "pass";
  if (api) return SIGNED_OUT_API.some((r) => r.test(pathname)) ? "pass" : "unauthorized";
  return SIGNED_OUT_PAGES.some((r) => r.test(pathname)) ? "pass" : "landing";
}
