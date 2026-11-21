// 0.8 front door part 3 (A2): the landing page's background, in the colours VicData already gives its areas and
// phases -- Admissions sky, Primary blue, GCSE green, Post-16 violet, the whole school's orange (SMT) -- each in
// its Light value on Light and its Dark value on Dark (src/lib/teacher-view-theme.ts ROLE_ACCENT /
// ROLE_ACCENT_LIGHT, src/components/smt/ui.tsx PHASE_TONES, the Mid fields' Admissions sky). Decoration only:
// aria-hidden, no text, no pointer events, clipped so it never scrolls sideways. The one movement (the arcs draw
// themselves in, once) is off under prefers-reduced-motion. Pick with LANDING_VARIANT (src/app/page.tsx).
export type LandingVariant = "arcs" | "spectrum" | "bands";

// Order: the school journey -- who joins (Admissions), Primary, GCSE, Post-16, then the whole school around them.
const BANDS = [
  { name: "admissions", cls: "[--c:#1596db] dark:[--c:#22d3ee]" },
  { name: "primary", cls: "[--c:#2563eb] dark:[--c:#60a5fa]" },
  { name: "gcse", cls: "[--c:#12a05c] dark:[--c:#34d399]" },
  { name: "post16", cls: "[--c:#7c5ce6] dark:[--c:#a78bfa]" },
  { name: "whole school", cls: "[--c:#c2410c] dark:[--c:#fb923c]" },
] as const;

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
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Five long translucent ribbons, fanned across the lower right, like the tabs of a home laid on their side. */}
        <div className="absolute -bottom-[30%] -right-[25%] h-[90%] w-[90%] rotate-[-24deg] sm:-right-[10%] sm:w-[70%]">
          {BANDS.map((b, i) => (
            <div key={b.name} className={`absolute left-0 right-0 h-[9%] rounded-full bg-[var(--c)] opacity-[0.16] dark:opacity-[0.2] ${b.cls}`} style={{ top: `${18 + i * 13}%` }} />
          ))}
        </div>
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
