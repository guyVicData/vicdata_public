import type { MetadataRoute } from "next";

// Default-deny: disallow-all unless ALLOW_INDEXING is explicitly "true".
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
