import type { Metadata } from "next";

// R-NOINDEX-SCHOOLS (0.8 front door part 3, A3): the page-level half. Each school-bearing route segment's
// layout exports this, so its pages say noindex in their <meta name="robots"> whatever ALLOW_INDEXING says;
// next.config.ts's NOINDEX_SOURCES sends the matching X-Robots-Tag header.
export const NOINDEX_METADATA: Metadata = { robots: { index: false, follow: false, nocache: true } };
