import type { ShapeLabel } from "@/lib/shape-classifier";

// One icon per shape-classifier.ts label, built to actually depict what each
// classification means (shape-classifier.ts's own comments), not decorative
// glyphs -- reused everywhere a shape label renders (this school's own Shape card,
// the peer-matched aggregate box). Line-art style matches the design reference
// (stroke=currentColor, no fill, 1.6 weight) so it inherits text colour and works in
// both themes without its own light/dark variants.
//
// Ages run oldest-at-top / youngest-at-bottom, same axis as ShapeChart.tsx's own
// pyramid chart -- every icon below is drawn on that same convention.
//  - tube: classifyShape's allFlat case -- constant width top to bottom.
//  - pyramid: gradual, multi-transition taper -- wide at the young (bottom) end,
//    narrows steadily toward the old (top) end.
//  - top_step (2026-08-29, new): a tube with one deliberate step inward -- full width
//    for most of the range, one sudden narrowing near the top, not a gradual taper.
//  - funnel (2026-08-29, split out of the old combined pyramid_funnel): the mirror of
//    Pyramid -- gradual, multi-transition widening, narrow at the young end.
//  - mushroom: rises then falls -- a single bulge, wide in the middle.
//  - wineglass: falls then rises -- narrow waist, wide at both ends (the comment in
//    shape-classifier.ts calls this "structurally identical to an hourglass").
//  - irregular: anything else -- no single clean silhouette fits, so this is the one
//    genuinely non-representational icon (a jagged line), signalling "no clean shape"
//    rather than depicting a specific pattern.
export function ShapeIcon({ shape, size = 22 }: { shape: ShapeLabel; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (shape) {
    case "tube":
      return (
        <svg {...common}>
          <rect x="7" y="3" width="10" height="18" rx="1" />
        </svg>
      );
    case "pyramid":
      return (
        <svg {...common}>
          <path d="M4 20 L12 4 L20 20 Z" />
        </svg>
      );
    case "top_step":
      return (
        <svg {...common}>
          <rect x="6" y="11" width="12" height="10" rx="1" />
          <rect x="9" y="3" width="6" height="8" rx="1" />
        </svg>
      );
    case "funnel":
      return (
        <svg {...common}>
          <path d="M4 4 L20 4 L12 20 Z" />
        </svg>
      );
    case "mushroom":
      return (
        <svg {...common}>
          <path d="M4 10 C4 5 8 3 12 3 C16 3 20 5 20 10 L20 11 L4 11 Z" />
          <path d="M9.5 11 L9.5 20 M14.5 11 L14.5 20" />
        </svg>
      );
    case "wineglass":
      return (
        <svg {...common}>
          <path d="M6 4 L18 4 L12 12 L18 20 L6 20 L12 12 Z" />
        </svg>
      );
    case "irregular":
      return (
        <svg {...common}>
          <path d="M4 7 L9 15 L13 9 L16 19 L20 11" />
        </svg>
      );
  }
}

// Single source of truth -- page.tsx used to define its own copy of this map;
// re-exported from here now so it can't drift from the icon set above.
export const SHAPE_LABELS: Record<ShapeLabel, string> = {
  tube: "Tube",
  pyramid: "Pyramid",
  top_step: "Top Step",
  funnel: "Funnel",
  mushroom: "Mushroom",
  wineglass: "Wineglass",
  irregular: "Irregular",
};
