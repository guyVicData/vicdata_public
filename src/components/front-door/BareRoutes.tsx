"use client";

import { usePathname } from "next/navigation";

// 0.8 front door part 3: the signed-out screens (the landing page, sign-in, the password-reset pages) carry
// only their own frame (src/components/auth/AuthShell.tsx): no site nav, no footer.
// 0.8 nav consistency (R-NAV-ONE): the auth hand-offs too (they redirect at once, but draw nothing meanwhile).
// The same list as nav-routes.ts's "bare" routes; the nav test holds the two equal.
export const BARE_PATHS = /^\/(login|reset-password|forgot-password|auth\/confirm|auth\/callback)?\/?$/;

export function isBarePath(pathname: string | null): boolean {
  return !!pathname && BARE_PATHS.test(pathname);
}

/** Renders its children everywhere except on the bare signed-out screens. */
export function HideOnBareRoutes({ children }: { children: React.ReactNode }) {
  return isBarePath(usePathname()) ? null : <>{children}</>;
}
