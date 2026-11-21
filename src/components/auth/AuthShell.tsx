import Link from "next/link";

// 0.8 front door part 3: the frame the signed-out screens share -- the landing page, sign-in, the
// new-device code. The wordmark as the shell draws it (a white "V" tile and "VicData"), one column, the
// card 358 px at most so a phone (360-430 px) shows it edge to edge with a 16 px gutter (G). Light and
// Dark follow the system, as the rest of the signed-out site does.
export const AUTH_INPUT =
  "block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none sm:text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
export const AUTH_BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";
export const AUTH_LINK = "inline-flex min-h-11 items-center text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400";

export function Wordmark({ href }: { href?: string }) {
  const mark = (
    <span className="inline-flex items-center gap-3">
      <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-base font-semibold text-white dark:bg-white dark:text-neutral-900">
        V
      </span>
      <span className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">VicData</span>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex min-h-11 items-center">
      {mark}
    </Link>
  ) : (
    mark
  );
}

export function AuthShell({ children, wordmarkHref }: { children: React.ReactNode; wordmarkHref?: string }) {
  return (
    <main data-auth-shell className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="w-full max-w-[358px]">
        <Wordmark href={wordmarkHref} />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
