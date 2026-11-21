// 0.8 front door part 3 (A2): the landing page's background, in the colours VicData already gives its areas and
// phases -- Admissions sky, Primary blue, GCSE green, Post-16 violet, the whole school's orange (SMT) -- each in
// its Light value on Light and its Dark value on Dark (src/lib/teacher-view-theme.ts ROLE_ACCENT /
// ROLE_ACCENT_LIGHT, src/components/smt/ui.tsx PHASE_TONES, the Mid fields' Admissions sky). Decoration only:
// aria-hidden, no text, no pointer events, clipped so it never scrolls sideways. The one movement (the arcs draw
// themselves in, once) is off under prefers-reduced-motion. Pick with LANDING_VARIANT (src/app/page.tsx).
export type LandingVariant = "bands" | "bands-long" | "bars" | "arcs" | "spectrum";

// Order: the school journey -- who joins (Admissions), Primary, GCSE, Post-16, then the whole school around them.
const BANDS = [
  { name: "admissions", cls: "[--c:#1596db] dark:[--c:#22d3ee]" },
  { name: "primary", cls: "[--c:#2563eb] dark:[--c:#60a5fa]" },
  { name: "gcse", cls: "[--c:#12a05c] dark:[--c:#34d399]" },
  { name: "post16", cls: "[--c:#7c5ce6] dark:[--c:#a78bfa]" },
  { name: "whole school", cls: "[--c:#c2410c] dark:[--c:#fb923c]" },
] as const;

/** The bars' lengths (share of the page's width), in BANDS' order: a gentle rise with one dip at Post-16. */
const BAR_LENGTHS = ["46%", "61%", "78%", "69%", "92%"] as const;

/** bands v3 ("bands-long"): the same five lengths' idea on v1's diagonal, longer, as % of the frame. */
const BAND_LENGTHS = ["52%", "66%", "83%", "74%", "97%"] as const;

/** The strip the "bars" variant draws in, reserved below the page's content (the same heights as the strip). */
export const BANDS_RESERVE = "pb-[188px] sm:pb-[292px]";

/** Under the logo in every variant: a fine line in the five colours (the "spectrum" variant's whole idea). */
export function SpectrumLine({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`flex h-1 w-full overflow-hidden rounded-full ${className}`}>
      {BANDS.map((b) => (
        <span key={b.name} className={`h-full flex-1 bg-[var(--c)] ${b.cls}`} />
      ))}
    </span>
  );
}

export function LandingArt({ variant }: { variant: LandingVariant }) {
  if (variant === "spectrum") return null;
  if (variant === "bands")
    // bands v1, the default (Guy, 22 Nov: "looked better"), exactly as first committed (970b4892): five long
    // translucent ribbons of one length, fanned across the lower right, like the tabs of a home laid on their side.
    // No movement. Restored after v2 ("bars") and v3 ("bands-long"), which stay as variants.
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-[30%] -right-[25%] h-[90%] w-[90%] rotate-[-24deg] sm:-right-[10%] sm:w-[70%]">
          {BANDS.map((b, i) => (
            <div key={b.name} className={`absolute left-0 right-0 h-[9%] rounded-full bg-[var(--c)] opacity-[0.16] dark:opacity-[0.2] ${b.cls}`} style={{ top: `${18 + i * 13}%` }} />
          ))}
        </div>
      </div>
    );
  if (variant === "bands-long")
    // bands v3 (Guy, 22 Nov: "diagonal, as in v1", and they may pass under the logo and button). Five bars of
    // different lengths on one diagonal baseline -- still a hint of a chart -- in a frame twice the page's width,
    // turned like v1's ribbons, so they cross from beyond the lower left well into the upper right. They pass behind
    // the content with no fade or box: the content's own colours clear the bands (src/app/page.tsx; worst-spot contrasts
    // measured in the report) (contrast measured: the
    // report). They grow to their lengths once (.landing-bar), never under prefers-reduced-motion.
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[54%] flex w-[190vw] -translate-x-1/2 -translate-y-1/2 rotate-[-24deg] flex-col gap-3 sm:top-[60%] sm:w-[200vw] sm:gap-5">
          {BANDS.map((b, i) => (
            <div
              key={b.name}
              className={`landing-bar h-7 shrink-0 rounded-r-full bg-[var(--c)] opacity-[0.2] sm:h-14 dark:opacity-[0.28] ${b.cls}`}
              style={{ width: BAND_LENGTHS[i], animationDelay: `${i * 110}ms` }}
            />
          ))}
        </div>
      </div>
    );
  if (variant === "bars")
    // bands v2 (Guy, 22 Nov): "take them further across the screen and make them different lengths so it gives a sense of a
    // graph". Five near-horizontal bars from beyond the left edge -- a bar chart on one baseline -- in the strip the
    // page reserves below its content (BANDS_RESERVE, src/app/page.tsx), so no bar ever sits under the logo, the
    // words or Sign in, at any height or width. Lengths rise gently with one dip, like a real chart. They grow to
    // their lengths once on load (.landing-bar), never under prefers-reduced-motion.
    return (
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[188px] flex-col justify-center gap-2.5 overflow-hidden pb-6 sm:h-[292px] sm:gap-3.5 sm:pb-10">
        {BANDS.map((b, i) => (
          <div
            key={b.name}
            className={`landing-bar h-6 shrink-0 rounded-r-full bg-[var(--c)] opacity-[0.22] sm:h-10 dark:opacity-[0.3] ${b.cls}`}
            style={{ width: BAR_LENGTHS[i], animationDelay: `${i * 110}ms` }}
          />
        ))}
      </div>
    );
  // "arcs": concentric quarter-arcs from the lower right, each a phase's colour; they draw themselves in once.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute -bottom-40 -right-40 h-[30rem] w-[30rem] sm:-bottom-48 sm:-right-48 sm:h-[60rem] sm:w-[60rem]" viewBox="0 0 1000 1000" fill="none">
        {BANDS.map((b, i) => {
          const r = 920 - i * 120;
          return (
            <path
              key={b.name}
              d={`M ${1000 - r} 1000 A ${r} ${r} 0 0 1 1000 ${1000 - r}`}
              pathLength={1}
              className={`landing-arc stroke-[var(--c)] opacity-30 dark:opacity-40 ${b.cls}`}
              strokeWidth={16}
              strokeLinecap="round"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          );
        })}
      </svg>
    </div>
  );
}
