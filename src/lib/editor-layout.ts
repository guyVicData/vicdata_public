// VicData 0.6 S5: every size, colour and timing the dashboard editor uses that isn't
// already a shared token, in one place so Guy can iterate on it (night 2 prompt:
// "keep layout and interaction constants in one place").
//
// Sizes are literal from the boards (docs/wireframes/v0.6/Editor, Skeleton, History,
// New1-4); the panel itself is the real panel unit (PANEL_UNIT, 351 x 384), not the
// boards' 230/190/150px-tall sketches, which predate the S0 audit. Colours are the app's
// tokens: the edit amber is ATTENTION_ACCENT (the boards' #fbbf24 is the same hex), the
// "inherits" blue is the comparator chooser's dark --cc-blue, ready-green and danger-red
// are DELTA_POSITIVE / DELTA_NEGATIVE, planned-gold is --cc-gold.
import { PANEL_UNIT } from "@/catalogue/config";
import { ATTENTION_ACCENT, ATTENTION_INK, DELTA_NEGATIVE, DELTA_POSITIVE, FEATURE_ACCENT, PHASE_ACCENT, accentOver, accentText } from "./teacher-view-theme";
import type { DashboardConfig } from "@/catalogue/types";

export const EDITOR = {
  // Page: the board's 20px 24px padding, 12px between bands.
  pagePad: "20px 24px",
  bandGap: 12,
  // Column tracks: whole panel units (PANEL_UNIT): a track of weight w is w units wide,
  // panels sit inside it with the column's 17px each side, tracks 18 + 2 + 18 apart.
  unit: PANEL_UNIT,
  trackInset: (PANEL_UNIT.columnTrack - PANEL_UNIT.width) / 2,
  trackGap: 2 * PANEL_UNIT.columnGap + PANEL_UNIT.divider,
  // Panel (.panel): radius 12, padding 12/14/36, gap 8; header badges 10px; rail icons 20.
  panelRadius: 12,
  panelPad: "12px 14px 36px 14px",
  railIcon: 20,
  railGlyph: 12,
  // Menus: the board's 236px panel menu, the 400px structure picker.
  panelMenuWidth: 236,
  structureMenuWidth: 400,
  // History panel width (History.dc.html).
  historyWidth: 380,
  // Autosave: the draft is written this long after the last edit.
  autosaveMs: 1200,
  // Span handle: the strip on a panel's right edge that drags its span.
  spanHandle: 10,
} as const;

// Width in px of a track of `weight` units, and of a panel covering `units` units.
export const trackWidth = (weight: number) => weight * PANEL_UNIT.columnTrack + (weight - 1) * EDITOR.trackGap;
export const panelWidth = (units: number) => trackWidth(units) - 2 * EDITOR.trackInset;

// The editor's colours, as CSS values (both themes: every one is a token or mixes tokens).
export const EC = {
  amber: ATTENTION_ACCENT.hex,
  amberInk: ATTENTION_INK,
  // The edit bar: #17140c / #4a3b12 on the board = amber 6% / 27% over the page.
  barBg: accentOver(ATTENTION_ACCENT.hex, 6),
  barBorder: accentOver(ATTENTION_ACCENT.hex, 27),
  // + Add row: #120f08 = amber ~4% over the page.
  addRowBg: accentOver(ATTENTION_ACCENT.hex, 4),
  amberText: accentText(ATTENTION_ACCENT.hex),
  // .ovr: amber text on amber ~10% over the panel.
  ovrBg: accentOver(ATTENTION_ACCENT.hex, 12, "var(--panel-bg)"),
  // .inh: #93c5fd on #172033 = the chooser's blue, mixed toward --fg, on a blue tint.
  inhFg: accentText("#60a5fa"),
  inhBg: accentOver("#60a5fa", 14, "var(--panel-bg)"),
  ready: DELTA_POSITIVE,
  readyInk: "#06120c",
  danger: DELTA_NEGATIVE,
  // Planned panels (Skeleton): #a97a1f gold, stripes #141414 / #17150f.
  gold: "#a97a1f",
  plannedStripe: accentOver("#a97a1f", 5, "var(--panel-bg)"),
  // .ebtn: #1a1a1a / #3a3a3a / #e5e5e5 on the board.
  btnBg: "var(--panel-bg)",
  btnBorder: "var(--edge-strong)",
  btnFg: "var(--chip-fg)",
  // .icon-btn.active (#262626) and .mrow.hl.
  hover: "color-mix(in srgb, var(--fg) 10%, var(--panel-bg))",
} as const;

// The dashboard colour choices (New 1, Settings): the real tokens for each meaning. GCSE
// and Post-16 are the phase accents; Rolls and Social context are the chooser's data-family
// hues; Rose and Amber are the home page's feature accents; Grey is "other".
export const DASHBOARD_COLOURS: { id: string; label: string; hex: string; key: DashboardConfig["colour"]["key"] }[] = [
  { id: "ks4", label: "GCSE", hex: PHASE_ACCENT.ks4!.hex, key: "ks4" },
  { id: "ks5", label: "Post-16", hex: PHASE_ACCENT.ks5!.hex, key: "ks5" },
  { id: "rolls", label: "Rolls", hex: "#22d3ee", key: "neutral" },
  { id: "social", label: "Social context", hex: "#fb923c", key: "neutral" },
  { id: "rose", label: "Rose", hex: FEATURE_ACCENT.meetings.hex, key: "neutral" },
  { id: "amber", label: "Amber", hex: FEATURE_ACCENT.recruitment.hex, key: "neutral" },
  { id: "grey", label: "Grey", hex: "#a1a1aa", key: "neutral" },
];

export function colourHex(c: DashboardConfig["colour"]): string {
  if (c.override) return c.override;
  if (c.key === "ks4" || c.key === "ks5") return PHASE_ACCENT[c.key]!.hex;
  return "#a1a1aa";
}

export function colourValue(hex: string): DashboardConfig["colour"] {
  const hit = DASHBOARD_COLOURS.find((c) => c.hex === hex);
  if (hit && hit.key !== "neutral") return { key: hit.key };
  return { key: "neutral", override: hex };
}

export const hexRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

// Text on an accent fill: the accent's own deep tone (New 1's #062a30 on cyan).
export const accentInk = (hex: string) => `color-mix(in srgb, ${hex} 22%, #000)`;

// Accent variables for #teacher-root, as the dashboards set them.
export const accentVars = (hex: string) => ({ "--accent": hex, "--accent-rgb": hexRgb(hex) }) as Record<string, string>;
