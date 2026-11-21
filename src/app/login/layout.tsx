import { NOINDEX_METADATA } from "@/lib/noindex";

// R-LANDING-MINIMAL (A2): sign-in is never indexed (and sends X-Robots-Tag, next.config.ts FRONT_DOOR_NOINDEX).
export const metadata = { ...NOINDEX_METADATA, title: { absolute: "Sign in · VicData" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
