import type { Metadata } from "next";
import Link from "next/link";
import { AUTH_BUTTON } from "@/components/auth/AuthShell";
import { Logo } from "@/components/auth/Logo";
import { BANDS_RESERVE, LandingArt, SpectrumLine } from "@/components/auth/LandingArt";
import { LANDING_VARIANT } from "@/components/auth/landing-variant";

// 0.8 front door part 3 (A2, R-LANDING-MINIMAL): the private-beta landing page, the only page a visitor who
// isn't signed in sees (src/proxy.ts sends every other page here). The logo (large, provisional:
// src/components/auth/Logo.tsx), "Private beta", Sign in. Nothing else: no school search or school names, no
// description, no "request access", no Open Graph or Twitter metadata, no analytics or third-party scripts, a
// plain <title>, and noindex (here and as X-Robots-Tag, next.config.ts). A signed-in visitor never sees it: the
// proxy sends them home.
//
// The background, in VicData's own area and phase colours: one of three designs, chosen by LANDING_VARIANT
// (src/components/auth/landing-variant.ts).

export const metadata: Metadata = {
  title: { absolute: "VicData" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Landing() {
  return (
    <main data-landing={LANDING_VARIANT} className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-50 px-4 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 ${LANDING_VARIANT === "bands" ? BANDS_RESERVE : "pb-16"}`}>
      <LandingArt variant={LANDING_VARIANT} />
      <div className="relative flex w-full max-w-[358px] flex-col items-center text-center sm:max-w-[420px]">
        <Logo size="large" />
        <SpectrumLine className="mt-6 max-w-[220px] sm:mt-8 sm:max-w-[300px]" />
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400 sm:mt-8">Private beta</p>
        <Link href="/login" className={`${AUTH_BUTTON} mt-8 max-w-[280px]`}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
