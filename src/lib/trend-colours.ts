// Member Data View build (2026-10-03), brief §8: the Map's "Trends" colour-by mode
// (default) needs a diverging scale, wired into project-level colour tokens rather
// than hardcoded per-component -- so a later design pass can retune it, matching this
// repo's existing tag-colours.ts pattern (TAG_COLOURS/cssVarNameForTag) rather than
// inventing a new per-component palette.
//
// Genuinely a NEW palette, not an extension of TAG_COLOURS -- that file's own values
// are categorical (a fixed set of named tags, each with a light/dark pair); a trend
// scale is CONTINUOUS (a percentage change mapped to a colour along a gradient), a
// different shape of problem that doesn't fit TAG_COLOURS' Record<string, ...> shape
// at all. Kept in its own file for that reason, same way narrative-config.ts's
// provisional constants live apart from narrative.ts's logic.
//
// 2026-09-11, per direct instruction: swapped from the original colourblind-safe
// reversed-RdBu ramp (red/grey/blue, a real ColorBrewer diverging scale, pending a
// validator check that never happened) to red/orange/amber/green -- a CONSCIOUS
// trade-off, not an oversight or a lapsed TODO. Guy's own call: this reads as more
// visually arresting and the five stops are more distinct from each other than the
// old grey/blue pairing was, and that's worth more here than the diverging-scale
// colourblind convention the original ramp was chosen for. The real red-green
// colourblind trade-off this accepts is logged, not silently re-litigated, in
// docs/vicdata_data_view_open_questions.md.
//
// Status: still provisional, same discipline as every other first-pass colour choice
// in this codebase (tag-colours.ts's own header comment) -- these exact hex values
// are a starting proposal, not locked in; expect a live-review pass to retune
// contrast/legibility the same way every other colour judgement call in this build
// has gone.

// Five stops, symmetric around a genuine amber/gold neutral midpoint (0% change) --
// red for decline, green for growth. Hand-picked (not a named ColorBrewer ramp this
// time -- see the header comment above for why that trade-off was made consciously).
// +30/strong-growth reuses tag-colours.ts's own State green (#15803d) for one shared
// green reference point across the app, rather than a second, subtly-different green.
const TREND_STOPS: { pct: number; hex: string }[] = [
  { pct: -30, hex: "#c0392b" }, // strong decline -- red
  { pct: -10, hex: "#e67e22" }, // moderate decline -- orange
  { pct: 0, hex: "#f1c40f" }, // neutral -- amber/gold, deliberately not grey
  { pct: 10, hex: "#7cb342" }, // moderate growth -- mid green
  { pct: 30, hex: "#15803d" }, // strong growth -- green (tag-colours.ts's own State green)
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
