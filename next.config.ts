import type { NextConfig } from "next";

// R-NOINDEX-SCHOOLS (0.8 front door part 3, A3; brought forward 20 Nov 2026): a school page is never
// indexed, whatever ALLOW_INDEXING says -- every route that shows one school or carries a URN sends
// `X-Robots-Tag: noindex, nofollow` (and each has page-level `robots` noindex in its segment layout).
// robots.ts must NOT Disallow these paths: a crawler that can't fetch a page never sees its noindex.
// R-PASSWORD-RESET: /login (with "Forgot password?") and /reset-password are never indexed either.
export const NOINDEX_SOURCES = ["/schools/:path*", "/join/:path*", "/sets", "/sets/:path*", "/teacher", "/teacher/:path*", "/dashboards", "/dashboards/:path*", "/member", "/member/:path*", "/login", "/reset-password"];

// Private beta (Guy, 21 Nov; R-NO-PUBLIC-SCHOOL-LINKS): the public school pages are hidden.
// Every /schools/** request (the page, its Data View, anything added under it later) is a
// temporary redirect to /member, before the filesystem and before the proxy, so no school
// page code runs and the proxy never counts a public-page visit. /member is the hop because
// only the browser knows whether someone is signed in (the Supabase session is in
// localStorage): it sends a signed-in member to /teacher and a signed-out visitor to /.
// The pages themselves stay in src/app/schools for after the beta; drop this entry to bring
// them back. The noindex entries above stay: Next sends no config header on a config
// redirect, but /member (where it lands) carries one, and the pages do again once restored.
export const HIDDEN_SCHOOL_PAGES_SOURCE = "/schools/:path*";
export const HIDDEN_SCHOOL_PAGES_DESTINATION = "/member";

// R-LANDING-MINIMAL (A2): the private-beta landing page and the signed-out screens are never indexed either.
export const FRONT_DOOR_NOINDEX = ["/", "/forgot-password", "/auth/:path*"]; // /login and /reset-password are in NOINDEX_SOURCES

const nextConfig: NextConfig = {
  async headers() {
    return [...NOINDEX_SOURCES, ...FRONT_DOOR_NOINDEX].map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }));
  },
  async redirects() {
    return [{ source: HIDDEN_SCHOOL_PAGES_SOURCE, destination: HIDDEN_SCHOOL_PAGES_DESTINATION, permanent: false }];
  },
};

export default nextConfig;
