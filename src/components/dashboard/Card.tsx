// Dashboard card-grid primitives (State of the School page rebuild, 2026-08-28).
// Design reference: the "VicData State of School Dashboard" design canvas (warm
// cream ground, Newsreader serif headings, IBM Plex Sans body) -- ported as Tailwind
// utility classes (stone palette, the closest built-in match to the mockup's warm
// neutrals) with light/dark variants, the SAME `dark:` utility-class convention used
// everywhere else in this codebase (SchoolMap.tsx, page.tsx's existing Section),
// rather than the mockup's own parallel CSS-custom-property system -- keeps this
// rebuild consistent with the rest of the app instead of introducing a second theming
// mechanism. Tag pill colours are DELIBERATELY NOT part of this file -- they keep
// using the existing TAG_COLOURS (tag-colours.ts) so a tag reads the same colour on
// this page as it does on the map/filters, not the mockup's own separate pill
// palette (a real choice, confirmed directly rather than assumed).
//
// Each card is a genuinely self-contained unit (own size, own heading, own content) --
// not a shared layout shell threading props down -- because member users are meant to
// eventually rearrange/resize their own dashboard (per the build brief); a card
// component that only works wired into one fixed grid position would have to be
// rebuilt for that, not just re-parented.

export type CardSize = "small" | "medium" | "wide" | "full";

// col-span-12 on mobile (stacked), half at sm, real size at lg -- same three-tier
// responsive discipline the rest of this app already uses (e.g. MapFilterPanel's own
// sm:/lg: breakpoints). grid-auto-flow: dense (set on the grid container, not here)
// lets a "small" card slot into a gap next to a taller neighbour rather than forcing
// a rigid row-by-row layout -- the "not hard-coded absolute positions" requirement.
const SIZE_CLASSES: Record<CardSize, string> = {
  small: "col-span-12 sm:col-span-6 lg:col-span-4",
  medium: "col-span-12 sm:col-span-6 lg:col-span-6",
  wide: "col-span-12 lg:col-span-8",
  full: "col-span-12",
};

export function DashboardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-5" style={{ gridAutoFlow: "dense" }}>
      {children}
    </div>
  );
}

export function Card({
  size,
  ghost,
  className,
  children,
}: {
  size: CardSize;
  // Ghost = the dashed-border, low-emphasis treatment for an absent/stub card
  // (Boarding when there's no boarding split, the three Coming Soon sections) --
  // matches the mockup's own .card-ghost, distinct from a real card so an empty
  // state never looks like a loading glitch.
  ghost?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const base = ghost
    ? "border border-dashed border-stone-300 dark:border-stone-700"
    : "border border-stone-200 bg-white shadow-[0_1px_2px_rgba(40,30,10,0.04)] dark:border-stone-800 dark:bg-stone-900 dark:shadow-none";
  return (
    <div className={`${SIZE_CLASSES[size]} rounded-2xl p-6 ${base} ${className ?? ""}`}>{children}</div>
  );
}

// Compact uppercase label -- the simple cards (Surrounding schools, Regional &
// national, Roll history, Boarding, the Coming Soon stubs) use this alone, no h2.
export function Eyebrow({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className={`mb-2.5 text-[11px] font-semibold uppercase tracking-wide ${
        muted ? "text-stone-400 dark:text-stone-600" : "text-stone-500 dark:text-stone-400"
      }`}
    >
      {children}
    </div>
  );
}

// Richer cards (Roll, Phase breakdown, Shape, Gender split) use a real Newsreader
// heading + caption instead of a bare eyebrow -- matches the mockup's own h2+caption
// pattern for content-dense cards.
export function CardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-[family-name:var(--font-newsreader)] text-[19px] font-medium text-stone-900 dark:text-stone-100">
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400">{subtitle}</p>}
    </div>
  );
}

// Sub-heading inside a card (Shape card's "This school"/"Peer-matched"/"Population
// trend in the area").
export function CardSubheading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="font-[family-name:var(--font-newsreader)] text-[15px] font-medium text-stone-900 dark:text-stone-100">
        {title}
      </h3>
      {subtitle && <p className="mt-0.5 text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400">{subtitle}</p>}
    </div>
  );
}

export function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400 ${className ?? ""}`}>{children}</p>;
}

export function StatNumber({ children, size = "lg" }: { children: React.ReactNode; size?: "lg" | "md" }) {
  return (
    <span
      className={`font-[family-name:var(--font-newsreader)] font-semibold leading-none text-stone-900 dark:text-stone-100 ${
        size === "lg" ? "text-[40px]" : "text-[26px]"
      }`}
    >
      {children}
    </span>
  );
}

export function CardDivider() {
  return <div className="my-4 h-px bg-stone-100 dark:bg-stone-800" />;
}
