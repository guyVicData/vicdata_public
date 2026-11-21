// 0.8 front door part 3: VicData's logo, PROVISIONAL. Swap the mark here and every signed-out screen follows
// (the landing page draws it large; sign-in, the code screen and the reset page small, through AuthShell's Wordmark).
// The mark is the shell's own: a rounded tile with a "V", inverting with the theme.
export function Logo({ size = "small" }: { size?: "small" | "large" }) {
  const large = size === "large";
  return (
    <span className={`inline-flex items-center ${large ? "gap-4 sm:gap-5" : "gap-3"}`}>
      <span
        aria-hidden
        className={`inline-flex items-center justify-center bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900 ${large ? "h-16 w-16 rounded-2xl text-4xl sm:h-24 sm:w-24 sm:rounded-[1.75rem] sm:text-6xl" : "h-8 w-8 rounded-lg text-base"}`}
      >
        V
      </span>
      <span className={`font-semibold tracking-tight text-neutral-900 dark:text-white ${large ? "text-5xl sm:text-7xl" : "text-lg"}`}>VicData</span>
    </span>
  );
}
