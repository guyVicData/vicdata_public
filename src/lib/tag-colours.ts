// Tag pill colours -- chart palette doc's "first pass," deliberately a different
// family from the pupil-count gender chart (this tag means the school's own type,
// not an individual pupil). Six of twelve were named in the doc (Independent/
// Boarding & day/Boarding/Senior/Girls/Co-ed); the rest (State/Day/Junior/Prep/
// Post 16/Boys) are filled in here from the same standard hue families, chosen to stay
// visually distinct from their siblings.
//
// 2026-08-24: moved here from TypologyTags.tsx (which still owns the pill rendering)
// so SchoolMap.tsx can share the exact same colour values for sector-coloured map
// dots -- a single source of truth rather than two files hand-copying the same hex
// literals and drifting apart. Every pill still always carries its own text label,
// never colour alone, so this palette hasn't been run through the colourblind
// validator the way the pupil-count chart colours were -- logged as provisional in
// docs/OPEN_QUESTIONS.md, same as the boarding threshold in typology.ts. Map dots
// (SchoolMap.tsx) are the first use of this palette WITHOUT a persistent text label
// attached -- mitigated there with a hover/click tooltip and a colour-keyed legend,
// not by re-validating the palette itself.
//
// 2026-08-25, design/polish round: Independent is now ISC orange, #F37521 -- Guy's
// own real brand convention, used verbatim (fg only; the pale/dark background tints
// behind it are my own derived tints, not mandated, and can shift freely). This is a
// SHARED value -- changing it here changes every Independent pill site-wide (school
// headers, member lists), not just the map dots, since that's the whole point of this
// file existing as one source of truth. Puts Independent in the same warm-orange
// family as the existing Post 16 tag (#9a3412/#fdba74 dark) -- not identical, but
// visually close; worth knowing since both can appear on the same school (e.g. an
// independent standalone sixth-form college) -- flagged, not resolved here.
//
// State was asked about directly ("was one ever defined?") -- the honest answer is
// the OLD value here was #1e293b (light) / #cbd5e1 (dark), a generic slate chosen as
// "not blue," never a deliberate brand colour. Replaced with a provisional strong
// green (#15803d light / #4ade80 dark) -- picked for contrast against both the pale
// Positron basemap and the new orange, and because no other tag in this palette uses
// a true green family (lime/Junior is yellow-green, not this). Flagged as provisional
// and easy to swap, same as the size-legend radius range -- not a brand colour, just
// a considered placeholder until Guy reacts to it live.
// 2026-08-27: Co-ed was the one tag in this palette still grey (gray 50/800, the
// original "first pass" doc's own choice) -- not a deliberate "co-ed has no colour"
// decision, just an unfilled slot, but it read as a real bug on the map (a translucent
// grey dot looks like "no data"/uniform-radius fallback, not "genuinely co-ed").
// Replaced with indigo -- distinct from Prep's violet and Boys' cyan, and not a hue
// used anywhere else in this palette. Same "provisional pending Guy reacting to it
// live" status as every other colour choice in this file.
//
// 2026-08-28: FE is a genuinely new THIRD sector (typology.ts's sectorTag(), per
// Guy's direct instruction -- "not folded into State or Independent") for the
// previously map-invisible FE-corporation/sixth-form/special-post-16/HE/Welsh
// population. Fuchsia -- the one saturated hue family nothing else in this palette
// uses (Girls' pink and Prep's violet both sit either side of it but read distinctly
// different in practice, checked side by side), and deliberately far from both
// Independent's orange and State's green so a three-way sector legend stays easy to
// tell apart at a glance.
export const TAG_COLOURS: Record<string, { light: [string, string]; dark: [string, string] }> = {
  Independent: { light: ["#fef2e8", "#F37521"], dark: ["#3d2410", "#F37521"] }, // ISC orange (Guy's brand, exact hex)
  State: { light: ["#f0fdf4", "#15803d"], dark: ["#14532d", "#4ade80"] }, // provisional green
  FE: { light: ["#fdf4ff", "#86198f"], dark: ["#451a4d", "#f0abfc"] }, // fuchsia
  Boarding: { light: ["#fff1ee", "#9a3324"], dark: ["#4a241d", "#f4a58f"] }, // coral
  Day: { light: ["#f0f9ff", "#075985"], dark: ["#173a4d", "#7dd3fc"] }, // sky
  "Boarding & day": { light: ["#f0fdfa", "#115e59"], dark: ["#14403c", "#5eead4"] }, // teal
  Junior: { light: ["#f7fee7", "#3f6212"], dark: ["#33400f", "#bef264"] }, // lime
  Prep: { light: ["#f5f3ff", "#5b21b6"], dark: ["#332355", "#c4b5fd"] }, // violet
  Senior: { light: ["#fffbeb", "#92400e"], dark: ["#4d3410", "#fcd34d"] }, // amber
  "Post 16": { light: ["#fff7ed", "#9a3412"], dark: ["#4a2b14", "#fdba74"] }, // orange
  Boys: { light: ["#ecfeff", "#155e75"], dark: ["#173d45", "#67e8f9"] }, // cyan -- flagged in
  // OPEN_QUESTIONS.md 2026-08-27 as a provisional, explicitly non-final gender pairing
  Girls: { light: ["#fdf2f8", "#9d174d"], dark: ["#4a2237", "#f9a8d4"] }, // pink -- see same entry
  "Co-ed": { light: ["#eef2ff", "#4338ca"], dark: ["#312e81", "#a5b4fc"] }, // indigo (was grey)
  // 2026-08-28, per Guy's direct instruction: a genuine through-school (real pupils in
  // both Junior and Senior phases -- City of London Freemen's and the newly-covered
  // high-age-19 population like Woldingham) needs its OWN colour, not the fixed
  // Junior->Prep->Senior->Post 16 priority order picking whichever single tag happens to
  // be first regardless of which phase the school is actually biggest in (Freemen's:
  // Junior 242 pupils, Senior 514 -- picking Junior implied something false). Reuses
  // the exact blue TypologyTags.tsx's own TAG_STYLES used for Independent before that
  // moved to ISC orange -- already vetted for contrast in this palette, just unused
  // since.
  "Through School": { light: ["#eff6ff", "#1e40af"], dark: ["#1e3a5f", "#93c5fd"] },
  // 2026-09-01, layout/graphs spec v1 §14: not a school-typology tag like everything
  // else in this file -- the surrounding-schools bar chart's "this is the one that
  // matters, not the muted grey field around it" highlight (SurroundingRollBarChart.tsx),
  // the same role PhaseBreakdownCard's own local ACTIVE_BG constant already plays for
  // its size badges. Added here as a proper token, not a second hardcoded copy, so a
  // future recolour project reaches this value too. Wiring only -- light[1] is the
  // exact #a97a1f already shipping, unchanged; dark[1] is a genuinely new value (this
  // chart had no dark-mode branching before and still doesn't consume this one yet),
  // constructed the same way every other entry's dark pair is: a brighter tint of the
  // same gold hue for contrast against a dark background, ready for whenever this
  // chart's own dark-mode branching gets built.
  Focus: { light: ["#fdf6e3", "#a97a1f"], dark: ["#4a3712", "#e0b23d"] },
};

// 2026-08-25: filter buttons now fill with the tag's own colour when selected
// (MapFilterPanel.tsx, per Guy's live review -- "reinforces which colour means
// what" instead of a generic grey active state), which means the button's text
// colour can no longer be hardcoded per theme -- it has to react to whichever fill
// it's sitting on. Computed via real WCAG relative luminance, not a brightness
// guess: checked directly against ISC orange and the provisional green, both of
// which land on DIFFERENT sides of the light/dark split (Independent needs dark
// text in BOTH modes -- #F37521 is too bright for white text even at ~7:1 vs black;
// State's light green wants white text but its dark-mode mint variant wants dark --
// a hardcoded "light fg = white text" rule would have gotten both wrong).
function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastingTextColour(fillHex: string): string {
  const lum = relativeLuminance(fillHex);
  const contrastWithWhite = 1.05 / (lum + 0.05);
  const contrastWithBlack = (lum + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#fafafa" : "#171717";
}

// 2026-08-25: the map's colour-by mode expanded from sector-only to
// sector/phase/gender -- every TAG_COLOURS entry (not just Independent/State) now
// needs a CSS custom property so SchoolMap.tsx can read a theme-resolved colour for
// whichever tag is currently driving dot colour. One deterministic name-generator,
// used both when SchoolMap.tsx WRITES the --tag-* declarations and when it READS
// them back via getComputedStyle, so the two can never drift out of sync with each
// other the way a hand-maintained mapping could.
export function cssVarNameForTag(tag: string): string {
  return `--tag-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}
