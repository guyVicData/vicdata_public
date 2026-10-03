// VicData 0.6 S6: a dashboard's (or meeting's) coloured icon (scope brief §4.9, D8; board
// docs/wireframes/v0.6/Icon.dc.html). An icon spec is `config.icon = { source, ref }`:
//
//   source "view"    ref = a DataviewId. Drawn as that view's STANDARD rail glyph
//                    (PanelIcons), data-free -- "a simplified glyph, not a screenshot".
//   source "set"     ref = a key of ICON_SET: the phase glyphs, the column icons, the
//                    feature glyphs and the school mark -- the app's own icons, one per
//                    meaning, never redrawn.
//   source "upload"  ref = an object path in the `dashboard-icons` Storage bucket
//                    (migration 20261104130000_v06_s6_dashboard_icons.sql). Super-admin
//                    only uploads; everyone reads.
//
// The colour is `config.colour`: `key` is the phase (or neutral), `override` one of
// DASHBOARD_COLOURS' keys. Every colour is an existing token (PHASE_ACCENT, FEATURE_ACCENT,
// the chooser's data-family hues); the board's swatch hexes are the same values.
//
// Pure: this module resolves a spec to a tile description (colour, radius, glyph size,
// what to draw). src/components/library/DashboardIcon.tsx turns that into elements, so
// the rules are testable without React.
import type { DashboardConfig, DataviewId } from "@/catalogue/types";
import { dataviewById } from "@/catalogue";
import { DATA_FAMILY } from "@/components/chooser-v06/layout";
import { FEATURE_ACCENT, PHASE_ACCENT } from "./teacher-view-theme";

export type DashboardIconSpec = NonNullable<DashboardConfig["icon"]>;
export type IconSource = DashboardIconSpec["source"];

export const ICON_BUCKET = "dashboard-icons";

// ------------------------------------------------------------------------- colours

export type TileColour = { hex: string; rgb: string };

const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

// The board's six swatches, in its order (GCSE default, then Post-16, Rolls, Social
// context, Rose, Amber), each from the token that already means it.
export const DASHBOARD_COLOURS = [
  { key: "ks4", label: "GCSE", ...PHASE_ACCENT.ks4! },
  { key: "ks5", label: "Post-16", ...PHASE_ACCENT.ks5! },
  { key: "rolls", label: "Rolls", hex: DATA_FAMILY.rolls.dark[1], rgb: rgbOf(DATA_FAMILY.rolls.dark[1]) },
  { key: "social", label: "Social context", hex: DATA_FAMILY.social.dark[1], rgb: rgbOf(DATA_FAMILY.social.dark[1]) },
  { key: "rose", label: "Rose", ...FEATURE_ACCENT.meetings },
  { key: "amber", label: "Amber", ...FEATURE_ACCENT.recruitment },
] as const;

export type ColourKey = (typeof DASHBOARD_COLOURS)[number]["key"];

// A dashboard with no phase (neutral) and no chosen colour: the muted tone HomeCard's
// NEUTRAL_TILE uses, so it reads as "no colour" rather than a borrowed meaning.
export const NEUTRAL_COLOUR: TileColour = { hex: "var(--muted)", rgb: "138,138,144" };

export function colourByKey(key: string | null | undefined): (typeof DASHBOARD_COLOURS)[number] | undefined {
  return DASHBOARD_COLOURS.find((c) => c.key === key);
}

// The key the swatch row shows as picked for a config's colour.
export function colourKeyOf(colour: DashboardConfig["colour"] | undefined): ColourKey | "neutral" {
  const o = colourByKey(colour?.override);
  if (o) return o.key;
  return colour?.key === "ks4" || colour?.key === "ks5" ? colour.key : "neutral";
}

export function colourOf(colour: DashboardConfig["colour"] | undefined): TileColour {
  const k = colourKeyOf(colour);
  const c = k === "neutral" ? undefined : colourByKey(k);
  return c ? { hex: c.hex, rgb: c.rgb } : NEUTRAL_COLOUR;
}

// Writing a pick back: a phase colour is the phase key itself; anything else keeps the
// dashboard's phase key and records the colour as the override.
export function withColour(colour: DashboardConfig["colour"], pick: ColourKey): DashboardConfig["colour"] {
  if (pick === "ks4" || pick === "ks5") return { key: pick };
  return { key: colour.key, override: pick };
}

// ------------------------------------------------------------------------- the set

// The icon set: the app's own glyphs, one per meaning. `glyph` names the drawing in
// DashboardIcon.tsx's GLYPHS.
export const ICON_SET = [
  { ref: "phase.ks4", label: "GCSE" },
  { ref: "phase.ks5", label: "Post-16" },
  { ref: "column.candidates", label: "Candidates" },
  { ref: "column.results", label: "Results" },
  { ref: "column.context", label: "Context" },
  { ref: "column.rankings", label: "Comparisons" },
  { ref: "school", label: "School" },
  { ref: "library", label: "Dashboards" },
  { ref: "feature.recruitment", label: "Recruitment" },
  { ref: "feature.meetings", label: "Meetings" },
] as const;

export type SetRef = (typeof ICON_SET)[number]["ref"];

export function isSetRef(ref: string): ref is SetRef {
  return ICON_SET.some((i) => i.ref === ref);
}

// ------------------------------------------------------------------------- resolving

// What a tile draws: one of the app's glyphs (a rail icon by its PanelIcons name, or a
// set ref), or an uploaded image.
export type IconDrawing = { kind: "rail"; name: string } | { kind: "set"; ref: SetRef } | { kind: "img"; src: string };

// A dashboard with no icon of its own: its first column's icon (Candidates' people,
// Results' bars -- the Main board's VicData cards), else the library grid.
export function defaultIcon(config: Pick<DashboardConfig, "kind" | "columns">): DashboardIconSpec {
  if (config.kind === "presentation") return { source: "set", ref: "feature.meetings" };
  const c = config.columns[0];
  return { source: "set", ref: c ? `column.${c.icon}` : "library" };
}

export function iconOf(config: Pick<DashboardConfig, "kind" | "columns" | "icon">): DashboardIconSpec {
  return config.icon ?? defaultIcon(config);
}

// The public URL of an uploaded icon (the bucket is public-read).
export function uploadUrl(path: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${ICON_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// Where an upload goes: one folder per dashboard, a timestamped name, the extension kept
// (PNG or SVG only, as the board says).
export function uploadPath(dashboardId: string, fileName: string, now = Date.now()): string | null {
  const ext = /\.(png|svg)$/i.exec(fileName)?.[1]?.toLowerCase();
  if (!ext) return null;
  const folder = dashboardId.replace(/[^A-Za-z0-9._-]/g, "_") || "new";
  return `${folder}/${now.toString(36)}.${ext}`;
}

export function resolveIcon(spec: DashboardIconSpec, supabaseUrl?: string): IconDrawing {
  if (spec.source === "upload") return { kind: "img", src: uploadUrl(spec.ref, supabaseUrl) };
  if (spec.source === "view") {
    const dv = dataviewById(spec.ref as DataviewId);
    return dv ? { kind: "rail", name: dv.railIcon } : { kind: "set", ref: "library" };
  }
  return { kind: "set", ref: isSetRef(spec.ref) ? spec.ref : "library" };
}

// ------------------------------------------------------------------------- sizes

// The tile at any size, scaled from the boards' two literal sizes: the library's 38px
// square (radius 10, 20px glyph, tint 14%) and the Icon board's 52px preview (radius 13,
// ~30px glyph, tint 16%).
export function tileMetrics(size: number) {
  return {
    size,
    radius: Math.round(size / 4),
    glyph: Math.round(size * (20 / 38)),
    tint: size >= 48 ? 0.16 : 0.14,
  };
}

// The views on a dashboard, once each, in panel order -- the "From a view" choices.
export function viewsOn(config: Pick<DashboardConfig, "panels">): DataviewId[] {
  const out: DataviewId[] = [];
  for (const p of config.panels) for (const v of p.dataviews) if (v.kind === "view" && !out.includes(v.dataview)) out.push(v.dataview);
  return out;
}

// The library's own colour (HomeSMT.dc.html's Dashboards tile, #22d3ee). No token meant
// "the library" before 0.6, so the board's hex becomes one here; it shares the hue with
// Rolls and the Admissions role, as the board draws it (logged in OPEN_QUESTIONS).
export const LIBRARY_ACCENT: TileColour = { hex: "#22d3ee", rgb: "34,211,238" };
