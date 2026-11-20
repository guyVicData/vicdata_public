import type { MetadataRoute } from "next";

// Exists per brief (can exist, submission to Search Console is a separate manual
// step — never auto-submitted). R-NOINDEX-SCHOOLS: never lists a school page, set page, join
// page or anything carrying a URN -- those are never indexed (next.config.ts NOINDEX_SOURCES,
// src/lib/noindex.ts). Only the landing page could ever be listed here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
