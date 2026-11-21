import { NOINDEX_METADATA } from "@/lib/noindex";

// R-PASSWORD-RESET: never indexed, whatever ALLOW_INDEXING says (src/lib/noindex.ts, next.config.ts).
export const metadata = { ...NOINDEX_METADATA, title: "Reset your password · VicData" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
