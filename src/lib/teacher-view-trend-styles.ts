// Teacher view, Trend & % Change redesign (build brief v1, review doc rev 23): the pure
// pieces every redesigned panel shares -- the grey-tint ramp, indexing a series to its own
// first year, the change between two years, and picking out the top movers.
//
// One module so Column 1, Context and Comparisons all draw "each subject (or school)
// individually" the same way. The charts render these; none of them re-derive them.
import { type PanelSeries } from "./teacher-view-panels";

// ------------------------------------------------------------------ grey tints

// The mockup's own ramp, lightest first, so it follows Current's left-to-right order
// (largest first) -- the biggest subject gets the lightest, most visible grey. Endpoints
// only; the steps between are interpolated so a category of 3 or of 12 spans the same
// range rather than running out of named greys.
const GREY_LIGHT = [0xc9, 0xc9, 0xc5];
const GREY_DARK = [0x49, 0x49, 0x46];

export function greyTints(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [rgb(GREY_LIGHT)];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return rgb(GREY_LIGHT.map((c, k) => Math.round(c + (GREY_DARK[k] - c) * t)));
  });
}

function rgb([r, g, b]: number[]): string {
  return `rgb(${r},${g},${b})`;
}

// Colours for a list already in Current's order: the focus gets `focusColour`, everyone
// else a grey in turn. Returns a lookup so Trend, % Change and the tables all agree.
export function tintInOrder(keysInCurrentOrder: string[], focusKey: string | null, focusColour: string): Map<string, string> {
  const others = keysInCurrentOrder.filter((k) => k !== focusKey);
  const greys = greyTints(others.length);
  const out = new Map<string, string>();
  others.forEach((k, i) => out.set(k, greys[i]));
  if (focusKey !== null && keysInCurrentOrder.includes(focusKey)) out.set(focusKey, focusColour);
  return out;
}

// Live review Part 3: a line chart of six-plus overlapping lines needs real hues, not a
// grey ramp -- bars and ranked rows stay legible in greys, lines do not. So Candidates'
// Trend (only) gives its non-focused subjects the site's existing categorical palette
// (school-series-colours.ts, the Data View's multi-school lines), in Current's order, the
// way tintInOrder hands out greys; the focus keeps FOCUS_COLOUR.
//
// Hues within 40 degrees of the phase accent are skipped: the focused line IS the accent
// (GCSE green, hue ~158; Post-16 purple, ~255), and a peer drawn in nearly the same colour
// would read as a second focus. At GCSE that drops the palette's two greens (#1baf7a at 0
// degrees off, #008300 at 38); at Post-16 its purple (#4a3aa7, 9 off) -- its blue, 42 off,
// stays. Past the remaining hues the colours cycle.
export function paletteInOrder(
  keysInCurrentOrder: string[],
  focusKey: string | null,
  focusColour: string,
  palette: string[],
  accentHex: string | null,
): Map<string, string> {
  const accentHue = accentHex ? hueOf(accentHex) : null;
  const usable = palette.filter((c) => accentHue === null || hueDistance(hueOf(c), accentHue) > 40);
  const hues = usable.length ? usable : palette;
  const out = new Map<string, string>();
  keysInCurrentOrder.filter((k) => k !== focusKey).forEach((k, i) => out.set(k, hues[i % hues.length]));
  if (focusKey !== null && keysInCurrentOrder.includes(focusKey)) out.set(focusKey, focusColour);
  return out;
}

function hueOf(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// The accent the focused subject is drawn in, everywhere in this redesign.
export const FOCUS_COLOUR = "var(--accent,var(--fg))";

// ------------------------------------------------------------- indexing (D2)

// Each series rebased to its OWN first real value = 100 (D2). A shared headcount axis pins
// a subject of 8 candidates flat beside one of 230; as an index both subjects' own change
// is visible and comparable. A series whose first real value is 0 cannot be indexed and
// comes back empty rather than as a division by zero.
export function indexTo100(values: (number | null)[]): (number | null)[] {
  const base = values.find((v): v is number => v !== null);
  if (base === undefined || base === 0) return values.map(() => null);
  return values.map((v) => (v === null ? null : (v / base) * 100));
}

// Indexing answers "how much has each moved", which is what a headcount comparison needs.
// A points or rate measure is already on one shared scale -- a GCSE 5.2 and a 6.1 mean the
// same thing in every subject -- so it is drawn as it is and keeps its real levels.
export function shouldIndex(aggregate: "sum" | "mean"): boolean {
  return aggregate === "sum";
}

// ------------------------------------------------------- change first -> last

export type Change = { first: number; last: number; delta: number; percent: number | null };

// Between the first and last REAL values in the span, not the first and last slots.
export function changeOver(values: (number | null)[]): Change | null {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return null;
  const first = real[0];
  const last = real[real.length - 1];
  return { first, last, delta: last - first, percent: first === 0 ? null : ((last - first) / first) * 100 };
}

export type Direction = "up" | "down" | "flat";

export function directionOf(delta: number | null): Direction {
  if (delta === null || delta === 0) return "flat";
  return delta > 0 ? "up" : "down";
}

// The app's own direction tones (SortTable's): teal up, amber down, muted flat.
export const DIRECTION_TEXT: Record<Direction, string> = {
  up: "text-[#0d9488] dark:text-[#2dd4bf]",
  down: "text-[#b45309] dark:text-[#fbbf24]",
  flat: "text-[var(--muted2)]",
};
export const DIRECTION_FILL: Record<Direction, string> = { up: "#14b8a6", down: "#d97706", flat: "var(--muted3)" };

export function signed(n: number, format: (v: number) => string): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${format(Math.abs(n))}`;
}

// ------------------------------------------------------ top movers (Option K)

// Option K: past a handful of series, one chart of every line is noise. The focus plus the
// two that rose most and the two that fell most are drawn as lines; everyone else is one
// min-max band. The table's curated card rows read THIS result, never a subset of their
// own, so chart and table can never pick different "movers".
export const TOP_MOVERS_EACH_WAY = 2;

export type Movers = { focus: PanelSeries | null; standouts: PanelSeries[]; rest: PanelSeries[] };

export function topMovers(series: PanelSeries[], focusKey: string | null): Movers {
  const focus = series.find((s) => s.key === focusKey) ?? null;
  const others = series
    .filter((s) => s.key !== focusKey)
    .map((s) => ({ s, pct: changeOver(s.values)?.percent ?? null }))
    .filter((r) => r.pct !== null)
    .sort((a, b) => b.pct! - a.pct!);
  const risers = others.slice(0, TOP_MOVERS_EACH_WAY).filter((r) => r.pct! > 0);
  const decliners = others
    .slice(-TOP_MOVERS_EACH_WAY)
    .filter((r) => r.pct! < 0 && !risers.includes(r))
    .reverse();
  const standouts = [...risers, ...decliners].map((r) => r.s);
  const rest = series.filter((s) => s.key !== focusKey && !standouts.includes(s));
  return { focus, standouts, rest };
}

// The rest band: per period, the lowest and highest value among `rest`.
export function bandOf(rest: PanelSeries[], periodCount: number): { min: (number | null)[]; max: (number | null)[] } {
  const min: (number | null)[] = [];
  const max: (number | null)[] = [];
  for (let i = 0; i < periodCount; i++) {
    const vals = rest.map((s) => s.values[i]).filter((v): v is number => v !== null);
    min.push(vals.length ? Math.min(...vals) : null);
    max.push(vals.length ? Math.max(...vals) : null);
  }
  return { min, max };
}

// Where the individual-series view hands over to Option K. A named constant rather than a
// hard-coded ~10: today's comparator sets are 5-10 schools, but the comparator-set chooser
// (a separate pass) will change what "large" means.
export const INDIVIDUAL_SERIES_MAX = 10;
