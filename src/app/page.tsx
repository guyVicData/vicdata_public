import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, AUTH_BUTTON } from "@/components/auth/AuthShell";

// 0.8 front door part 3 (A2, R-LANDING-MINIMAL): the private-beta landing page, the only page a visitor who
// isn't signed in sees (src/proxy.ts sends every other page here). The logo, "Private beta", Sign in.
// Nothing else: no school search or school names, no description, no "request access", no Open Graph or
// Twitter metadata, no analytics or third-party scripts, a plain <title>, and noindex (here and as
// X-Robots-Tag, next.config.ts). A signed-in visitor never sees it: the proxy sends them home.
export const metadata: Metadata = {
  title: { absolute: "VicData" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Landing() {
  return (
    <AuthShell>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Private beta</p>
      <Link href="/login" className={`${AUTH_BUTTON} mt-6`}>
        Sign in
      </Link>
    </AuthShell>
  );
}
