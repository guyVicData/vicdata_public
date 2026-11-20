import { NOINDEX_METADATA } from "@/lib/noindex";

// R-NOINDEX-SCHOOLS: never indexed, whatever ALLOW_INDEXING says (src/lib/noindex.ts, next.config.ts).
export const metadata = NOINDEX_METADATA;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
