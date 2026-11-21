import Link from "next/link";
import { Logo } from "./Logo";
import { LandingArt, SpectrumLine } from "./LandingArt";
import { LANDING_VARIANT } from "./landing-variant";

// 0.8 front door part 3: the frame the signed-out screens share -- the landing page, sign-in, the
// new-device code. The wordmark as the shell draws it (a white "V" tile and "VicData"), one column, the
// card 358 px at most so a phone (360-430 px) shows it edge to edge with a 16 px gutter (G). Light and
// Dark follow the system, as the rest of the signed-out site does.
export const AUTH_INPUT = "block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none sm:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
export const AUTH_BUTTON = "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";
export const AUTH_LINK = "inline-flex min-h-11 items-center text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400";

export function Wordmark({ href }: { href?: string }) {
  return href ? (
    <Link href={href} className="inline-flex min-h-11 items-center">
      <Logo />
    </Link>
  ) : (
    <Logo />
  );
}

export function AuthShell({ children, wordmarkHref }: { children: React.ReactNode; wordmarkHref?: string }) {
  return (
    // 22 Nov (Guy): the landing page's branding on every signed-out screen -- its background and the fine
    // five-colour line under the wordmark (src/components/auth/LandingArt.tsx; "bars" would need its reserved strip,
    // so only the variants that sit behind the content are drawn here).
    <main data-auth-shell className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-50 px-4 py-12 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {LANDING_VARIANT !== "bars" && <LandingArt variant={LANDING_VARIANT} />}
      <div className="relative w-full max-w-[358px]">
        <Wordmark href={wordmarkHref} />
        <SpectrumLine className="mt-4 max-w-[160px]" />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
