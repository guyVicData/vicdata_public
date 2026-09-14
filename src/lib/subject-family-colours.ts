// Fixed, site-wide colour identity for the 8 real subject categories (per Guy's
// direct instruction, 2026-09-14 brief: "Each subject category needs a distinct
// colour... apply to all subject category selectors and add to the general
// palette"). Same shape and discipline as tag-colours.ts's own TAG_COLOURS/
// TOPIC_COLOURS -- a fixed Record keyed by the real identifier (here, family_id,
// not a tag string), light/dark hex pairs, reused everywhere the identity needs to
// show rather than each surface inventing its own. Kept in its own file rather than
// merged into TAG_COLOURS/TOPIC_COLOURS: a subject family isn't a school attribute
// (TAG_COLOURS) or an app-section tab (TOPIC_COLOURS), it's a THIRD, genuinely
// different kind of fixed identifier -- same reasoning TOPIC_COLOURS' own header
// comment already gives for not merging into TAG_COLOURS.
//
// The 8 family_id values are fixed and enumerable (vicdata's own
// 20260912510000_subject_family_map_data.sql, subject_families table, sort_order
// 0-7) -- not a config that grows over time the way school tags or filter pills
// might, so 8 hand-picked pastel hues (one clearly distinct family each, spread
// across the wheel) rather than a generated/index-based scheme. Some proximity to
// an existing TAG_COLOURS entry is unavoidable at this point (same real trade-off
// TOPIC_COLOURS' own header comment already accepts) -- Health & Care's green
// deliberately REUSES TAG_COLOURS' exact State green (#15803d) as one shared "this
// green means the same thing everywhere" reference point, same precedent
// trend-colours.ts's own +30 stop already set; the rest are close-but-not-identical
// to existing tags, which is fine since a subject-category pill and a school-tag
// pill never appear in the same legend together.
//
// Provisional like every other first-pass colour choice in this codebase (see
// tag-colours.ts's own header) -- a starting proposal for Guy to react to live.
export const SUBJECT_FAMILY_COLOURS: Record<string, { light: [string, string]; dark: [string, string] }> = {
  sciences_maths: { light: ["#eff6ff", "#1d4ed8"], dark: ["#1e3a5f", "#93c5fd"] }, // blue
  humanities_social: { light: ["#fffbeb", "#b45309"], dark: ["#4d3410", "#fcd34d"] }, // amber
  languages_literature: { light: ["#f5f3ff", "#6d28d9"], dark: ["#332355", "#c4b5fd"] }, // violet
  arts_media_design: { light: ["#fdf2f8", "#be185d"], dark: ["#4a2237", "#f9a8d4"] }, // pink
  business_law: { light: ["#eef2ff", "#4338ca"], dark: ["#312e81", "#a5b4fc"] }, // indigo
  technology_eng_construction: { light: ["#ecfeff", "#0e7490"], dark: ["#173d45", "#67e8f9"] }, // cyan
  health_care: { light: ["#f0fdf4", "#15803d"], dark: ["#14532d", "#4ade80"] }, // green (shared State green, see above)
  enterprise_applied: { light: ["#fff7ed", "#c2410c"], dark: ["#4a2b14", "#fdba74"] }, // orange
};

const FALLBACK_COLOUR: { light: [string, string]; dark: [string, string] } = {
  light: ["#f5f5f5", "#525252"],
  dark: ["#262626", "#d4d4d4"],
};

export function subjectFamilyColour(familyId: string | null | undefined): { light: [string, string]; dark: [string, string] } {
  if (!familyId) return FALLBACK_COLOUR;
  return SUBJECT_FAMILY_COLOURS[familyId] ?? FALLBACK_COLOUR;
}

// Same deterministic CSS-var-name convention as tag-colours.ts's own
// cssVarNameForTag, applied to family_id instead of a tag string -- lets any
// component write/read a theme-resolved --subject-family-* custom property the
// same way SchoolMap.tsx already does for --tag-*, without a hand-maintained
// mapping the two could drift out of sync on.
export function cssVarNameForSubjectFamily(familyId: string): string {
  return `--subject-family-${familyId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Generic two-colour sequential interpolation -- the SAME real interpolation
// trend-colours.ts's own gradeBandColour does across its fixed 5-stop blue ramp,
// generalised to any pale->saturated hex pair so it can be reused for a
// family-tinted ramp without a second hand-copied implementation. `t` clamped to
// [0,1] before interpolating, same "min===max reads as the middle stop" honesty
// gradeBandColour already established (a single school, or a set with no real
// spread, has no real "more/less" to show).
function sequentialColourAt(t: number, paleHex: string, satHex: string): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [pr, pg, pb] = hexToRgb(paleHex);
  const [sr, sg, sb] = hexToRgb(satHex);
  return rgbToHex(pr + (sr - pr) * clamped, pg + (sg - pg) * clamped, pb + (sb - pb) * clamped);
}

// Map round 4, per Guy's direct instruction: Grade band mode at subject-category
// scope should read as "the same real value-based idea as whole school, coloured to
// match the category" -- NOT the generic whole-school blue ramp (trend-colours.ts's
// own gradeBandColour), which would make every category's grade-band map look
// identical and lose the category identity the new palette above exists to carry.
// Same real min-max normalisation, same 5-stop shape as GRADE_BAND_STOPS, just
// anchored on this family's own light/dark pair instead of the fixed blue one --
// one interpolation function (above), not a second hand-copied ramp per category.
export function gradeBandColourForFamily(value: number, min: number, max: number, familyId: string | null | undefined): string {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  const { light } = subjectFamilyColour(familyId);
  return sequentialColourAt(t, light[0], light[1]);
}

// Legend stops for a family-tinted GradeBandColourKey -- same real five-swatch
// shape as trend-colours.ts's own GRADE_BAND_LEGEND_STOPS (t=0/.25/.5/.75/1), so the
// existing legend component can render either ramp from the same shaped data.
export function gradeBandLegendStopsForFamily(familyId: string | null | undefined): { t: number; hex: string }[] {
  const { light } = subjectFamilyColour(familyId);
  return [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, hex: sequentialColourAt(t, light[0], light[1]) }));
}
