import type { MetadataRoute } from "next";

// Exists per brief (can exist, submission to Search Console is a separate manual
// step — never auto-submitted). Empty until search/school pages are built.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
