// Map round (2026-09-12), Part 2 Stage A: the Region choropleth's "Current Rolls"
// colour-by mode -- a genuinely NEW sequential (light-to-dark by magnitude) scale,
// visually distinct from Trends' own red/orange/amber/green DIVERGING scale
// (trend-colours.ts) on purpose: sequential vs diverging is the real signal that
// these two modes answer different questions ("how big is this LA's roll right now"
// vs "is it growing or shrinking"), not just a different hue choice. Structured as a
// light/dark PAIR the way tag-colours.ts's TAG_COLOURS shapes every entry (light[1]
// is a real theme-aware light-mode dark-mode variant story) -- but, like
// trend-colours.ts's own TREND_STOPS, genuinely a new palette kept in its own file
// rather than squeezed into TAG_COLOURS' categorical Record<string, ...> shape, which
// has no continuous-scale concept at all.
//
// Blue, the one hue family neither TAG_COLOURS nor TREND_STOPS currently anchors a
// sequential meaning to (Independent's orange/State's green/FE's fuchsia/Special
// Schools' red are all categorical identity colours; Trends' own green endpoint means
// "growth," which a blue "high roll" scale can't be confused with sitting next to it
// on the same legend). One fixed ramp regardless of app theme -- same precedent
// trend-colours.ts's own TREND_STOPS already sets (no light/dark branching there
// either): the polygons sit on the same light CARTO basemap either way, unlike
// TAG_COLOURS' dot fills, which theme-switch to match the rest of the UI chrome, not
// the map tile itself.
const CURRENT_ROLLS_LOW = "#dbeafe"; // pale blue
const CURRENT_ROLLS_HIGH = "#1e3a8a"; // deep blue

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// t: 0 (lowest real value in the current filtered set) .. 1 (highest) -- same
// min-max-of-the-current-view normalisation MapView's own dot radiusFor already
// applies, not a fixed national scale (a single LA's roll is meaningless compared
// against a hardcoded ceiling; what matters is standing out within THIS region).
export function currentRollsColour(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [lr, lg, lb] = hexToRgb(CURRENT_ROLLS_LOW);
  const [hr, hg, hb] = hexToRgb(CURRENT_ROLLS_HIGH);
  return rgbToHex(lr + (hr - lr) * clamped, lg + (hg - lg) * clamped, lb + (hb - lb) * clamped);
}

export const CURRENT_ROLLS_LEGEND_ENDPOINTS = { low: CURRENT_ROLLS_LOW, high: CURRENT_ROLLS_HIGH };
