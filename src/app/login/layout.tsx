import { NOINDEX_METADATA } from "@/lib/noindex";

// R-PASSWORD-RESET: the sign-in and "Forgot password?" page is never indexed, whatever ALLOW_INDEXING says
// (src/lib/noindex.ts, next.config.ts).
export const metadata = { ...NOINDEX_METADATA, title: "Log in · VicData" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
