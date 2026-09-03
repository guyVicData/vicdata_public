import type { ShapeLabel } from "@/lib/shape-classifier";
import { TAG_COLOURS, contrastingTextColour } from "@/lib/tag-colours";

// One icon per shape-classifier.ts label, built to actually depict what each
// classification means (shape-classifier.ts's own comments), not decorative
// glyphs -- reused everywhere a shape label renders (this school's own Shape card,
// the peer-matched aggregate box).
//
// Ages run oldest-at-top / youngest-at-bottom, same axis as ShapeChart.tsx's own
// pyramid chart -- every icon below is drawn on that same convention.
//  - tube: net trajectory close to flat -- constant width top to bottom.
//  - pyramid: bottom-heavy remainder -- wide at the young (bottom) end, narrows
//    toward the old (top) end.
//  - top_step: one dominant down-step with a real surviving population past it --
//    full width for most of the range, one sudden narrowing near the top, not a
//    gradual taper.
//  - funnel: top-heavy remainder below the wineglass magnitude ratio -- the mirror
//    of Pyramid, narrow at the young end, gradually widening toward the old end.
//  - mushroom: one dominant up-step, capped at a 2-year-or-less flat top -- narrow
//    stem at the young end, a wide cap forming near the old end and staying wide
//    at the very top (a literal mushroom silhouette doubles as an accurate
//    contour here, not a coincidence).
//  - wineglass: top-heavy remainder at or past the magnitude ratio -- narrow at the
//    young end, flaring into a wide bowl at the old end. 2026-09-08 fix: this used
//    to be a symmetric hourglass (wide at BOTH ends, narrow waist in the middle) --
//    wrong for current Wineglass semantics, which is a top-heavy ratio read, not a
//    "narrows then widens back to the same width" shape; nothing in the classifier
//    requires the young end to be as wide as the old one, and a real Wineglass
//    school's young end is often just "not the narrowest point," not a wide bulb
//    matching the top. A real goblet silhouette -- narrow stem at the bottom,
//    curved flare to a wide bowl at the top -- reads correctly instead.
//  - irregular: never returned by classifyShape any more (shape-classifier.ts's own
//    redesign comment) -- dead code, kept only because this file's exhaustive
//    switch and SHAPE_LABELS' Record already handle it harmlessly. No glyph
//    redesign here, on purpose: not worth designing a silhouette for a label that
//    can't occur.
//
// 2026-09-08, gold circle treatment: every icon now sits on a filled circle (fill
// from TAG_COLOURS.Focus -- the same gold already running on PhaseBreakdownCard's
// size badges, here properly theme-aware via TAG_COLOURS' own light/dark pair
// rather than that badge's single hardcoded hex). Baked directly into each icon's
// own <svg> (no wrapper component), so every existing call site picks it up for
// free. Glyph stroke switches from currentColor to whatever contrastingTextColour()
// (tag-colours.ts) returns against the circle's fill -- reused, not hardcoded to
// white, since a plain white stroke would be the wrong call against this
// particular gold (both the light and dark Focus fg colours contrast better with
// near-black than near-white, confirmed via the real function output, not assumed).
// No wrapping <style> element with its own scoping concerns needed for the theme
// switch: TAG_COLOURS' own light/dark values differ, but contrastingTextColour
// resolves to the SAME near-black stroke for both here, so the stroke itself is one
// static value -- only the circle's own fill needs a light/dark pair, handled the
// same way ShapeChart.tsx already themes its own SVG (a scoped <style> block
// defining CSS custom properties, declared inside the <svg> itself so this stays a
// single self-contained element, still no wrapper).
//
// Existing glyph coordinates were rescaled/repositioned to sit with comfortable
// padding inside the circle (r=11 in the 24x24 viewBox) rather than touching its
// edge -- Pyramid/Funnel's outer corners previously reached ~11.3 units from
// centre, past a naive inscribed boundary; every glyph below now maxes out around
// 7-9 units from centre, leaving visible padding at both call-site sizes (22 and
// 14 -- the two real ones, ShapeCard.tsx).
const CIRCLE_FILL_LIGHT = TAG_COLOURS.Focus.light[1];
const CIRCLE_FILL_DARK = TAG_COLOURS.Focus.dark[1];
const GLYPH_STROKE_LIGHT = contrastingTextColour(CIRCLE_FILL_LIGHT);
const GLYPH_STROKE_DARK = contrastingTextColour(CIRCLE_FILL_DARK);

function CircleTheme() {
  return (
    <style>{`
      .shape-icon-circle { fill: ${CIRCLE_FILL_LIGHT}; }
      .shape-icon-glyph { stroke: ${GLYPH_STROKE_LIGHT}; }
      @media (prefers-color-scheme: dark) {
        :root:where(:not([data-theme="light"])) .shape-icon-circle { fill: ${CIRCLE_FILL_DARK}; }
        :root:where(:not([data-theme="light"])) .shape-icon-glyph { stroke: ${GLYPH_STROKE_DARK}; }
      }
      :root[data-theme="dark"] .shape-icon-circle { fill: ${CIRCLE_FILL_DARK}; }
      :root[data-theme="dark"] .shape-icon-glyph { stroke: ${GLYPH_STROKE_DARK}; }
    `}</style>
  );
}

export function ShapeIcon({ shape, size = 22 }: { shape: ShapeLabel; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const circle = <circle className="shape-icon-circle" cx="12" cy="12" r="11" />;
  switch (shape) {
    case "tube":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <rect className="shape-icon-glyph" fill="none" x="8.5" y="6" width="7" height="12" rx="1" />
        </svg>
      );
    case "pyramid":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <path className="shape-icon-glyph" fill="none" d="M6 18 L12 6 L18 18 Z" />
        </svg>
      );
    case "top_step":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <rect className="shape-icon-glyph" fill="none" x="7" y="12" width="10" height="7" rx="1" />
          <rect className="shape-icon-glyph" fill="none" x="9.5" y="6" width="5" height="6" rx="1" />
        </svg>
      );
    case "funnel":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <path className="shape-icon-glyph" fill="none" d="M6 6 L18 6 L12 18 Z" />
        </svg>
      );
    case "mushroom":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <path className="shape-icon-glyph" fill="none" d="M7 13 C7 9 9.5 6 12 6 C14.5 6 17 9 17 13 L17 14 L7 14 Z" />
          <path className="shape-icon-glyph" fill="none" d="M10.5 14 L10.5 19 M13.5 14 L13.5 19" />
        </svg>
      );
    case "wineglass":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <path className="shape-icon-glyph" fill="none" d="M11 14 C11 11 8 10 8 6 L16 6 C16 10 13 11 13 14 Z" />
          <path className="shape-icon-glyph" fill="none" d="M11 14 L11 19 M13 14 L13 19" />
        </svg>
      );
    case "irregular":
      return (
        <svg {...common} fill="none">
          <CircleTheme />
          {circle}
          <path className="shape-icon-glyph" fill="none" d="M4 7 L9 15 L13 9 L16 19 L20 11" />
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
