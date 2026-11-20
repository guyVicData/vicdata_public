import type { NextConfig } from "next";

// R-NOINDEX-SCHOOLS (0.8 front door part 3, A3; brought forward 20 Nov 2026): a school page is never
// indexed, whatever ALLOW_INDEXING says -- every route that shows one school or carries a URN sends
// `X-Robots-Tag: noindex, nofollow` (and each has page-level `robots` noindex in its segment layout).
// robots.ts must NOT Disallow these paths: a crawler that can't fetch a page never sees its noindex.
export const NOINDEX_SOURCES = ["/schools/:path*", "/join/:path*", "/sets", "/sets/:path*", "/teacher", "/teacher/:path*", "/dashboards", "/dashboards/:path*", "/member", "/member/:path*"];

const nextConfig: NextConfig = {
  async headers() {
    return NOINDEX_SOURCES.map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }));
  },
};

export default nextConfig;
