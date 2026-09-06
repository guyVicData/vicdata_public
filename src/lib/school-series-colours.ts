// Graphs redesign v1 (docs/vicdata_phase3_member_data_view_graphs_redesign_v1.md),
// main Roll Trends chart: "colour follows the school, not its position in the ticked
// list" -- every other multi-line chart in this codebase (PeerTrendChart.tsx's own
// SLOT_COLORS_LIGHT/DARK) assigns colour by render-index/"slot," which silently
// repaints every line whenever the comparator set's order or membership changes.
// This module instead assigns each URN its colour the FIRST time it's ever seen and
// never reassigns it, so a school keeps its line colour even as the ticked set
// changes shape around it.
//
// Palette values are duplicated from PeerTrendChart.tsx's own SLOT_COLORS_LIGHT/DARK
// (already claimed "validated... dataviz skill" there) rather than imported, so this
// new build carries no coupling to the live /sets/[id] page's own component -- with
// the one reddish entry ("#e34948"/"#e66767") dropped, since #dc2626 is reserved
// below for the focus school's own line (the established target/focus red used
// throughout this codebase: Map's target ring, SpreadStrip's target circle, this
// page's previous RollTrendChart) and a second red-family line in the same legend
// would read as a second "this one matters" signal.
const PALETTE_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
const PALETTE_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];

export const FOCUS_SCHOOL_COLOUR = "#dc2626";

export type SeriesColourMap = Map<string, { light: string; dark: string }>;

// Pure step function: given the previous assignment map and the URNs currently in
// view, returns an updated map with any newly-seen URN assigned the next unused
// palette slot. Existing URNs keep their colour even if they later drop out of the
// set and return. Callers persist the returned map across renders (a useRef), not
// this module -- it has no state of its own.
export function assignSeriesColours(existing: SeriesColourMap, urns: string[], focusUrn: string): SeriesColourMap {
  const next = new Map(existing);
  for (const urn of urns) {
    if (urn === focusUrn || next.has(urn)) continue;
    const idx = next.size % PALETTE_LIGHT.length;
    next.set(urn, { light: PALETTE_LIGHT[idx], dark: PALETTE_DARK[idx] });
  }
  return next;
}

export function seriesColourVar(urn: string, focusUrn: string): string {
  return urn === focusUrn ? "var(--series-focus)" : `var(--series-${urn})`;
}

// CSS custom-property declarations for every assigned URN plus the focus school, for
// a chart's own scoped <style> block -- same light/dark-pair-via-media-query pattern
// PeerTrendChart.tsx already uses for its grid/text colours, just per-series instead
// of per-chrome-element.
export function seriesColourCssVars(map: SeriesColourMap): { light: string; dark: string } {
  const lightDecls = [`--series-focus:${FOCUS_SCHOOL_COLOUR};`];
  const darkDecls = [`--series-focus:${FOCUS_SCHOOL_COLOUR};`];
  for (const [urn, { light, dark }] of map) {
    lightDecls.push(`--series-${urn}:${light};`);
    darkDecls.push(`--series-${urn}:${dark};`);
  }
  return { light: lightDecls.join(""), dark: darkDecls.join("") };
}
