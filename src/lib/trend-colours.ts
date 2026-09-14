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

// Round 3 (Academic Map edit 2), A2: Academic's own grade-band colour mode, decided
// directly with Guy -- VALUE-based, normalised to the real min-max range of whichever
// comparison set is currently on the map (not rank position, not a fixed universal
// scale), computed the same way circle SIZE already is. His own reasoning, verbatim:
// "if it is value based we need to see how much variation there is within sets...
// sometimes the differences will be huge... othertimes very small, but the
// differences do matter" -- real min-max normalisation is what keeps a tightly-
// clustered set reading as mostly similar shades while a widely-spread one uses the
// full range, rather than flattening real differences or manufacturing fake ones.
//
// A genuinely SEPARATE, sequential (single-hue) palette from TREND_STOPS' own
// diverging red-green scale, not a reuse of it -- grade band is a RESULTS indicator
// ("how good"), not a trend indicator ("better/worse than before"), and borrowing
// Trend's own red/green semantics for it was the exact confusion this item exists to
// fix (the old `trendColour(gradeValue - 50)` reuse read as a trend arrow even though
// nothing was actually trending). Light-to-dark blue -- Guy's own working
// recommendation ("reads as more/better without borrowing Trend's own red/green
// semantics") -- five real named hex stops, same shape as TREND_STOPS, not an ad-hoc
// two-colour CSS gradient.
const GRADE_BAND_STOPS: { t: number; hex: string }[] = [
  { t: 0, hex: "#eff6ff" }, // lowest in the current set -- Tailwind blue-50
  { t: 0.25, hex: "#bfdbfe" }, // blue-200
  { t: 0.5, hex: "#60a5fa" }, // blue-400
  { t: 0.75, hex: "#2563eb" }, // blue-600
  { t: 1, hex: "#1e3a8a" }, // highest in the current set -- blue-900
];

function hexToRgbGb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHexGb(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// `value` on the REAL min-max range of whatever comparison set is currently active
// (recomputed every time the set/exclusions/stage change, same as circle size) --
// NOT rank position, and NOT a fixed universal scale, per Guy's own explicit
// instruction above. `min === max` (a single real school, or a set with no real
// variation at all) reads as the middle stop -- there's no real "more/less" to show,
// so neither the flattest nor the richest colour is honest here.
export function gradeBandColour(value: number, min: number, max: number): string {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  for (let i = 0; i < GRADE_BAND_STOPS.length - 1; i++) {
    const a = GRADE_BAND_STOPS[i];
    const b = GRADE_BAND_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const localT = (t - a.t) / (b.t - a.t);
      const [ar, ag, ab] = hexToRgbGb(a.hex);
      const [br, bg, bb] = hexToRgbGb(b.hex);
      return rgbToHexGb(ar + (br - ar) * localT, ag + (bg - ag) * localT, ab + (bb - ab) * localT);
    }
  }
  return GRADE_BAND_STOPS[GRADE_BAND_STOPS.length - 1].hex;
}

// Legend stops for GradeBandColourKey -- same real five-swatch shape as
// TREND_LEGEND_STOPS, `t` is a 0-1 position within the CURRENT set's own min-max
// range (the legend itself labels the real min/median/max values at render time,
// same "real scale labels, not just colour swatches" requirement item A2/item 3 of
// the prior Map round both already established).
export const GRADE_BAND_LEGEND_STOPS = GRADE_BAND_STOPS;
