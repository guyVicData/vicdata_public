// Member Data View build (2026-10-03), brief §8: the Map's "Trends" colour-by mode
// (default) needs a colourblind-safe blue<->red diverging scale (blue = growing, grey
// neutral midpoint), wired into project-level colour tokens rather than hardcoded per-
// component -- so a later design pass can retune it, matching this repo's existing
// tag-colours.ts pattern (TAG_COLOURS/cssVarNameForTag) rather than inventing a new
// per-component palette.
//
// Genuinely a NEW palette, not an extension of TAG_COLOURS -- that file's own values
// are categorical (a fixed set of named tags, each with a light/dark pair); a trend
// scale is CONTINUOUS (a percentage change mapped to a colour along a gradient), a
// different shape of problem that doesn't fit TAG_COLOURS' Record<string, ...> shape
// at all. Kept in its own file for that reason, same way narrative-config.ts's
// provisional constants live apart from narrative.ts's logic.
//
// Status: provisional, same discipline as every other first-pass colour choice in
// this codebase (tag-colours.ts's own header comment) -- not yet run through the
// colourblind-safety validator the historical trend charts were checked against
// (chart-palette doc's own standing precedent). Flagged in
// docs/vicdata_data_view_open_questions.md as a decision to revisit, not silently
// treated as final.

// Five stops, symmetric around a genuine grey neutral midpoint (0% change) -- blue
// for growth, red for decline, per the brief's explicit "blue = growing" instruction.
// Endpoints are real, named CSS colours from a standard diverging ColorBrewer-style
// ramp (RdBu, reversed so blue reads as the positive end) -- not invented hex values,
// since a real, well-known diverging ramp is more likely to already be reasonably
// colourblind-tolerant than a hand-picked one, pending the real validator check.
const TREND_STOPS: { pct: number; hex: string }[] = [
  { pct: -30, hex: "#b2182b" }, // strong decline -- red
  { pct: -10, hex: "#ef8a62" }, // moderate decline
  { pct: 0, hex: "#9ca3af" }, // neutral -- same grey as tag-colours.ts's own --dot fallback
  { pct: 10, hex: "#67a9cf" }, // moderate growth
  { pct: 30, hex: "#2166ac" }, // strong growth -- blue
];

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Linear interpolation between the two nearest stops, clamped at the ends -- a school
// growing/shrinking beyond +-30% since 2019 (a real but rare figure, mostly new/
// closing institutions or genuine outliers) reads as the strongest colour available
// rather than an out-of-range value.
export function trendColour(pctChange: number): string {
  const clamped = Math.max(TREND_STOPS[0].pct, Math.min(TREND_STOPS[TREND_STOPS.length - 1].pct, pctChange));
  for (let i = 0; i < TREND_STOPS.length - 1; i++) {
    const a = TREND_STOPS[i];
    const b = TREND_STOPS[i + 1];
    if (clamped >= a.pct && clamped <= b.pct) {
      const t = (clamped - a.pct) / (b.pct - a.pct);
      const [ar, ag, ab] = hexToRgb(a.hex);
      const [br, bg, bb] = hexToRgb(b.hex);
      return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
    }
  }
  return TREND_STOPS[TREND_STOPS.length - 1].hex;
}

// Legend stops for MapColourKey-style rendering -- five discrete swatches spanning
// the same real range the continuous scale above interpolates across, not a separate
// set of numbers.
export const TREND_LEGEND_STOPS = TREND_STOPS.map((s) => ({ pct: s.pct, hex: s.hex }));

export const TREND_NEUTRAL_GREY = TREND_STOPS[2].hex;
