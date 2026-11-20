import type { MetadataRoute } from "next";

// Default-deny: disallow-all unless ALLOW_INDEXING is explicitly "true".
// R-NOINDEX-SCHOOLS: when indexing is allowed, never add a Disallow for school pages -- a crawler
// that can't fetch a page never sees its noindex (they send X-Robots-Tag and page-level noindex).
export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.ALLOW_INDEXING === "true";

  if (!allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://vicdata.co.uk/sitemap.xml",
  };
}
