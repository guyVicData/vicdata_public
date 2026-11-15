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
// 0.8 review fixes (14 Nov, M7; Guy: "colour subject groups everywhere"): re-picked so the eight sit well
// apart -- the closest pair CIEDE2000 18.5 in Light and in Dark -- and away from the product accents (GCSE
// green, Post-16 violet, SMT orange, Admissions sky), the fixed lines (England amber, LA blue, the nearest
// schools' pink), the focus school's red and the group bronze: 12.0 or more from each. Each is 4:1 or better
// on its plate (WCAG 1.4.11 asks 3:1 of a graphic). The board: docs/v0.8/review_fixes_screenshots/
// palette_board.png; the pick: docs/v0.8/audit_scripts/review_fixes_preview/palette2.py.txt. [pale, strong]
// per theme; Mid draws on white plates, so its values are Light's (kept as their own entry so a later
// change can part them). R-SUBJECT-COLOUR.
// 0.8 feedback C (C14, D8, 15 Nov): Languages & Literature (indigo: 18.5 from Sciences in Light, 14.9 from the
// Post-16 violet in Dark) and Health & Care (green: 13.4 / 12.9 from the GCSE green) re-picked, the other six
// kept, under this rule's floors (families 15 or more apart, 12 or more from every accent and fixed line): each
// new colour is 29 or more from Sciences, the Post-16 violet and the GCSE green in both themes. Keeping six
// leaves little room: Languages is a khaki gold, Health a cocoa; their closest neighbours are each other (15.3)
// and the group bronze (12.8). The pick: docs/v0.8/audit_scripts/feedback_c_preview/pick8.py.txt; the board:
// docs/v0.8/feedback_c_screenshots/palette_board.png.
export const SUBJECT_FAMILY_COLOURS: Record<string, { light: [string, string]; mid: [string, string]; dark: [string, string] }> = {
  sciences_maths: { light: ["#eceef5", "#3e5698"], mid: ["#eceef5", "#3e5698"], dark: ["#262b38", "#a1b0d9"] }, // slate blue
  humanities_social: { light: ["#f2e9e8", "#811f18"], mid: ["#f2e9e8", "#811f18"], dark: ["#382120", "#e0655c"] }, // brick
  languages_literature: { light: ["#efeee9", "#605024"], mid: ["#efeee9", "#605024"], dark: ["#2c281d", "#c4aa64"] }, // khaki gold (C14)
  arts_media_design: { light: ["#f7e9f5", "#b422a1"], mid: ["#f7e9f5", "#b422a1"], dark: ["#3c2239", "#e05cce"] }, // magenta
  business_law: { light: ["#f0eaed", "#6d2c4a"], mid: ["#f0eaed", "#6d2c4a"], dark: ["#382c33", "#d9a1bb"] }, // plum
  technology_eng_construction: { light: ["#e8f2f1", "#188173"], mid: ["#e8f2f1", "#188173"], dark: ["#21383b", "#76e5d6"] }, // teal
  health_care: { light: ["#edebe9", "#4c3324"], mid: ["#edebe9", "#4c3324"], dark: ["#2c2421", "#c0957c"] }, // cocoa (C14)
  enterprise_applied: { light: ["#f2f2e8", "#818118"], mid: ["#f2f2e8", "#818118"], dark: ["#38381d", "#e0e05c"] }, // olive
};
/** The eight families in sort order (the subject_families table's sort_order 0-7), with their names. */
export const SUBJECT_FAMILY_NAMES: Record<string, string> = {
  sciences_maths: "Sciences & Maths",
  humanities_social: "Humanities & Social Sciences",
  languages_literature: "Languages & Literature",
  arts_media_design: "Arts, Media & Design",
  business_law: "Business & Law",
  technology_eng_construction: "Technology, Engineering & Construction",
  health_care: "Health & Care",
  enterprise_applied: "Enterprise & Applied Studies",
};
/** A family's strong colour as a CSS variable, resolved by the theme (globals.css). */
export const familyColourVar = (familyId: string) => `var(${cssVarNameForSubjectFamily(familyId)}, var(--muted2))`;
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

// Teacher view Comparisons map (Column 3 round, Part 1): the phase's own accent (GCSE
// green, Post-16 purple) as a value ramp -- lighter for a lower figure, darker for a higher
// one, the same min-max normalisation as the two ramps above. Teacher view only.
//
// Both ends are the accent DARKENED (25% and 40% towards black), not lightened: the GCSE
// accent is itself a light green, 1.8:1 against the light panel, so a paler tint would
// all but vanish in the light theme. Measured against the panels (#f7f7f9 light, #0e0e10
// dark): GCSE #279e73 -> #1f7f5c is 3.15-4.62:1 on light and 5.72-3.90:1 on dark; Post-16
// #7d68bc -> #645396 is 4.29-6.10:1 on light and 4.20-2.96:1 on dark.
function darken(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - t), g * (1 - t), b * (1 - t));
}

export function accentBandColour(value: number, min: number, max: number, accentHex: string): string {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  return sequentialColourAt(t, darken(accentHex, 0.25), darken(accentHex, 0.4));
}

export function accentLegendStops(accentHex: string): { t: number; hex: string }[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, hex: sequentialColourAt(t, darken(accentHex, 0.25), darken(accentHex, 0.4)) }));
}
