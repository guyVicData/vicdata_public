"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import proj4 from "proj4";
import type { Map as LeafletMap, LayerGroup, LatLng, Point } from "leaflet";
import type { SectorTag, PhaseTag, GenderTag } from "@/lib/typology";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { TAG_COLOURS, cssVarNameForTag } from "@/lib/tag-colours";
import {
  TAG_GROUPS,
  COLOUR_MODE_KEYS,
  relevantPhaseTag,
  isGenuineThroughSchool,
  emptyFilterState,
  passesFilters,
  type FilterState,
} from "@/lib/map-tag-groups";
import MapFilterPanel from "./MapFilterPanel";
import MapColourKey, { type ColourSwatch } from "./MapColourKey";

// Map component (map spec, "Public View rebuild"; redesigned 2026-08-23 -- see
// docs/OPEN_QUESTIONS.md in the vicdata ingest repo for the full precedent
// investigation and the mockup this was reviewed against). Leaflet + CartoDB Positron
// tiles -- a deliberate, AGREED exception to this project's usual "hand-rolled SVG, no
// charting/map library" pattern. Precedent: Club ISS's own parent-distance tool.
//
// 2026-08-24/25 rounds -- see git blame for the full history of each pass (colour as
// primary signal, bounds-fetched pool, the square-map/three-column layout, radius
// widening, etc.). THIS round (2026-08-25, second polish pass) is the big one:
//
//   - Colour-by mode expanded from sector-only to sector/phase/gender
//     (map-tag-groups.ts's COLOUR_MODE_KEYS) -- the mode selector only ever showed
//     "Sector" before because that list was deliberately limited to it, not because
//     of a wiring bug; Guy's live review made clear all three were expected
//     selectable. Phase is stackable (0-3 tags per school) with no "master tag"
//     decision made yet -- phase-mode colour uses the FIRST tag in canonical
//     Junior->Prep->Senior->Sixth order (PHASE_COLOUR_PRIORITY) as a simple,
//     deterministic placeholder, not a resolution of that open question.
//   - CSS custom properties for EVERY tag colour (not just sector) are now generated
//     from TAG_COLOURS programmatically (cssVarNameForTag, tag-colours.ts) rather
//     than hand-listing two variables -- required once colour-by could be phase or
//     gender too.
//   - Gender filter was reported as hiding every dot. Investigated hard (multiple
//     zoom levels, both test schools, real dot counts before/after) and could NOT
//     reproduce -- Boys/Girls/Co-ed all filtered to real, sensible, non-zero counts
//     in every scenario tried, and unions/intersections with other categories were
//     correct too. No code change made for this specifically since no bug was found;
//     flagged honestly rather than "fixed" something that wasn't broken. Re-tested
//     again after every other change in this round, on a clean server restart.
//   - Distance rings are back: a plain, FIXED-radius circle (Leaflet's real
//     geographic L.circle, not a pixel radius) centred on the viewed school,
//     sector-aware (wider default for Independent). Guy's cited precedent
//     ("vicdata_public's own pre-Leaflet SchoolMap.tsx") does NOT actually contain
//     any ring/radius code -- checked git history directly (a single commit exists
//     for this file's whole lifetime; its content is LA-boundary-polygon + dots +
//     viewed-school marker only, no rings). The only ring mechanism found anywhere in
//     this project's history is roll_pipeline's Python catchment-map dashboards,
//     which ARE explicitly pupil-postcode-weighted (their own code: "empirical
//     edge... pupil-weighted p90", a real per-pupil postcode->MSOA lookup) -- the
//     exact thing already ruled out. Flagged as a correction, not silently
//     substituted: what's built here is a new, simple, static reference ring with NO
//     pupil data involved at all, matching the safe behaviour actually being asked
//     for even though the cited precedent was mistaken.
//   - Layout: back to a rectangle map (from last round's square), colour-by and size
//     key boxes floating ON the map (top-right, solid backgrounds), filters in their
//     own column on the left -- unchanged position from before.
//   - Hover labels now show every school's name to every visitor, not just verified
//     members -- an explicit, confirmed reversal of the member-only naming boundary
//     from the 2026-08-24 round, not a default assumed here. Sector text dropped from
//     the tooltip (colour already conveys it); kept to name + roll. Because every dot
//     now carries a name from the bounds fetch itself, the separate member-tier
//     enrichment fetch (surrounding-schools-list) this component used to make is now
//     redundant for the map specifically -- removed. That route/fetch still exists
//     and is still used elsewhere on the page (the "Surrounding schools" stat
//     section's own member-only named list), which is untouched.
//
// Carried over: colour as the map's primary signal (translucent), the bounds-based
// "all schools" fetch (debounced on moveend), and school easting/northing -> WGS84
// via proj4's real Helmert+ellipsoid transform (not an approximated affine).

// EPSG:27700 (OSGB36 / British National Grid), the standard published definition.
const BNG_PROJ = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";
const WGS84_PROJ = "+proj=longlat +datum=WGS84 +no_defs";

function bngToLatLng(easting: number, northing: number): [number, number] {
  const [lng, lat] = proj4(BNG_PROJ, WGS84_PROJ, [easting, northing]);
  return [lat, lng];
}

// Inverse of bngToLatLng, applied to a lat/lng viewport's four corners to get an
// enclosing British National Grid box (see schools-in-bounds/route.ts's own comment
// for why the query wants easting/northing, not lat/lng). Transverse Mercator warps a
// perfect lat/lng rectangle into a very slightly non-rectangular BNG shape at this
// projection, but over a single map viewport's extent that's a negligible, always-
// over-inclusive margin -- never a correctness problem for "which schools are roughly
// in view."
function boundsToBng(map: LeafletMap): { minEasting: number; maxEasting: number; minNorthing: number; maxNorthing: number } {
  const b = map.getBounds();
  const corners: [number, number][] = [
    [b.getSouth(), b.getWest()],
    [b.getSouth(), b.getEast()],
    [b.getNorth(), b.getWest()],
    [b.getNorth(), b.getEast()],
  ];
  const eastings: number[] = [];
  const northings: number[] = [];
  for (const [lat, lng] of corners) {
    const [e, n] = proj4(WGS84_PROJ, BNG_PROJ, [lng, lat]);
    eastings.push(e);
    northings.push(n);
  }
  return {
    minEasting: Math.min(...eastings),
    maxEasting: Math.max(...eastings),
    minNorthing: Math.min(...northings),
    maxNorthing: Math.max(...northings),
  };
}

// 2026-08-28: CARTO's anonymous, no-signup basemap access (confirmed working when this
// map was first built) has been discontinued -- tiles now return 200 with a real PNG,
// but the PNG itself is watermarked "API KEY REQUIRED" across the whole image, not a
// blocked request. Confirmed directly (curl, both this exact path and rastertiles/
// light_all, with and without a key param): the URL path is unchanged and correct, this
// is purely CARTO's own auth gate. Current correct usage (carto.com/basemaps,
// docs.carto.com, checked 2026-08-28) is still genuinely free -- 5M tile requests/month,
// no CARTO account needed -- but does need a key, requested via carto.com/basemaps/apikey
// (a couple of minutes, just an email + domain, still no account/login). Key is read from
// NEXT_PUBLIC_CARTO_API_KEY (same NEXT_PUBLIC_ pattern as the Supabase anon key already
// used in this repo) -- it's fetched directly by the browser as a tile request, so like
// the Supabase anon key it's necessarily public, not a server-side secret. Falls back to
// the unauthenticated (watermarked) URL if the env var isn't set, so this doesn't break
// local dev before the key exists.
const TILE_URL = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Fullscreen control icons (2026-08-28) -- plain inline SVG, matching the rest of this
// file's own hand-rolled Leaflet controls rather than pulling in leaflet.fullscreen or
// similar: two tiny "expand/collapse to corners" glyphs, no external asset or icon font.
const EXPAND_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5V1h4M15 5V1h-4M1 11v4h4M15 11v4h-4"/></svg>';
const COLLAPSE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 1v4H1M11 1v4h4M5 15v-4H1M11 15v-4h4"/></svg>';

// 2026-08-25: widened twice this round (3-9 -> 4-16 -> 4-22) -- both rounds of live
// review flagged the small/large difference as too subtle. Tuned against REAL
// bounds-pool data: Leighton Park's default view spans roll 64-1,841 across 26
// schools, Woldingham's spans 86-1,528 across 11. Still provisional.
const MIN_RADIUS = 4;
const MAX_RADIUS = 22;
// Fixed radius for dots with no roll data available (uniform-size band above the
// bounds route's own roll-lookup threshold) -- equal to MIN_RADIUS so "no roll data"
// reads as "small," not as a visually different marker style.
const UNIFORM_RADIUS = MIN_RADIUS;
// The viewed school's own ring, explicitly bigger than MAX_RADIUS so it stays "this
// one, obviously" even against the largest possible neighbour -- including the
// viewed school's own inner dot, which (2026-08-27) can now itself reach MAX_RADIUS
// when it's the biggest thing in view, still safely inside this ring's +4 margin.
const SCHOOL_MARKER_RING_RADIUS = MAX_RADIUS + 4;

// Distance-ring defaults (2026-08-25, see module comment for the precedent
// correction) -- a plain static reference circle, no pupil data. Sector-aware:
// State schools already show plenty of candidates within a tight radius; Independent
// schools draw from a much wider area (directionally consistent with real day-pupil
// distance patterns Woldingham/Leighton Park's own catchment analysis found --
// roll_pipeline's median day-pupil distance ~6.3km with a long tail -- used here only
// as a sanity check on the ORDER OF MAGNITUDE for a round-number default, not as a
// computed or ported figure). Both provisional, not adjustable in the UI yet.
//
// Independent started at 15km, but fitting the map to show the WHOLE ring on load
// (see the init effect's own comment) pushed the initial viewport well past the
// bounds route's 500-school hard cap in a real, moderately dense area (Leighton
// Park's own real data: a 15km-radius fit trips the cap; verified 10km stays safely
// under it at both test schools, 285 and 273 respectively) -- reduced to 10km for
// that reason, not a design preference. If a wider Independent ring is wanted later,
// the real fix is raising HARD_CAP in schools-in-bounds/route.ts (a considered
// decision, not a default to bump quietly) or not fitting the WHOLE ring on load.
const DISTANCE_RING_KM_STATE = 5;
const DISTANCE_RING_KM_INDEPENDENT = 10;

// fitBounds has a maxZoom option (caps zooming IN too far for a tight cluster) but no
// equivalent for zooming OUT too far -- moot now that the map doesn't fit bounds
// against a precomputed neighbour list at all, but kept as the fixed initial zoom
// regardless -- still the right "open close to the school" default from an earlier
// round.
const MIN_INITIAL_ZOOM = 14;

// Debounce window between Leaflet's moveend firing and the bounds fetch actually
// going out -- avoids hammering the API while a user is still actively dragging.
const BOUNDS_FETCH_DEBOUNCE_MS = 400;

function rollRadius(roll: number, minRoll: number, maxRoll: number): number {
  if (!(maxRoll > minRoll)) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (Math.sqrt(roll) - Math.sqrt(minRoll)) / (Math.sqrt(maxRoll) - Math.sqrt(minRoll));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
}

// Generic-by-design: colourMode is a TAG_GROUPS key (sector/phase/gender today), not
// a fixed union, so a future group is an added branch here, not a rearchitecture.
// phaseFilter (2026-08-26) makes the phase branch prefer whichever of a through-
// school's tags the active phase filter selected, not just the fixed priority order
// -- see relevantPhaseTag's own comment (map-tag-groups.ts) for why.
function colourForSchool(
  s: {
    sector: SectorTag | null;
    phase: PhaseTag[];
    gender: GenderTag | null;
    rollByPhase?: Partial<Record<PhaseTag, number>> | null;
  },
  colourMode: string,
  colours: ReturnType<typeof readThemeColours>,
  phaseFilter: Set<string>,
): string {
  if (colourMode === "sector") return s.sector ? colours.tag(s.sector) : colours.dot;
  if (colourMode === "gender") return s.gender ? colours.tag(s.gender) : colours.dot;
  if (colourMode === "phase") {
    // 2026-08-28: a genuine through-school (Junior+Senior both present) gets its own
    // colour rather than whichever single tag wins fixed priority -- unless a phase
    // filter is actively narrowing to one specific sub-phase, in which case that
    // existing behaviour (colour by the filtered phase) still applies, same as any
    // other multi-tag school.
    if (phaseFilter.size === 0 && isGenuineThroughSchool(s.phase, s.rollByPhase)) {
      return colours.tag("Through School");
    }
    const tag = relevantPhaseTag(s.phase, phaseFilter, s.rollByPhase);
    return tag ? colours.tag(tag) : colours.dot;
  }
  return colours.dot;
}

// 2026-08-27: the viewed school's own dot now uses the SAME roll-scaled radius and
// colour-mode-driven colour logic as every neighbour (per Guy's live review -- "a big
// school should look big even at the centre"), which means it needs the same real
// typology/roll data every neighbour dot already has, not just position/sector. The
// outer red ring stays exactly as before (fixed size, always red) purely for
// identification -- only the inner dot's own sizing/colouring changed.
// 2026-08-27, popup/card redesign: ageBands/genderSplit are the member-tier-only
// breakdown (point d of that round's brief). Applies IDENTICALLY to the viewed
// school's own focus card and every neighbour's hover popup -- total roll only in
// the public view, the full breakdown only once real membership is confirmed
// (SchoolMap.tsx's own memberDetailIncluded state, set from the bounds route's
// response). An earlier version of this round showed the focus school's own
// breakdown unconditionally, reasoning it's already public further down the same
// page -- corrected directly by Guy: the focus card follows the exact same
// public/member split as every other dot, no exception.
type MemberDetail = {
  ageBands: { band1: number; band2: number; band3: number };
  genderSplit: { girls: number; boys: number };
};

type ViewedSchool = {
  name: string;
  town: string | null;
  easting: number;
  northing: number;
  sector: SectorTag | null;
  phase: PhaseTag[];
  gender: GenderTag | null;
  totalRoll: number | null;
  rollByPhase: Partial<Record<PhaseTag, number>> | null;
  ageBands: MemberDetail["ageBands"] | null;
  genderSplit: MemberDetail["genderSplit"] | null;
};

// Bounds-fetched pool (schools-in-bounds route) -- position, sector/phase/gender tags
// and a name, computed/selected server-side; roll data only when the viewport's under
// that route's own roll-lookup threshold. currentName (2026-08-25) is returned to
// every caller now -- see module comment and the route's own for the privacy-boundary
// reversal this reflects. rollByPhase (2026-08-26) is only ever non-null for a
// through-school (more than one phase tag) -- see effectiveRoll below for how it's
// actually used. ageBands/genderSplit (2026-08-27) are only ever non-null when the
// CALLER (this component, via its own bearer token) is a verified member of the
// school being VIEWED -- the server checks that, not this component; see
// schools-in-bounds/route.ts's checkMembership.
type BoundsSchool = {
  urn: string;
  currentName: string;
  easting: number;
  northing: number;
  sector: SectorTag | null;
  phase: PhaseTag[];
  gender: GenderTag | null;
  totalRoll: number | null;
  rollByPhase: Partial<Record<PhaseTag, number>> | null;
  ageBands: MemberDetail["ageBands"] | null;
  genderSplit: MemberDetail["genderSplit"] | null;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Shared popup/card content (2026-08-27) -- used for BOTH the hover popup on
// neighbour schools and the persistent focus-school card, so the two can never drift
// apart in structure. Name + total roll always shown (the established privacy
// boundary from an earlier round); the age-band/gender-split rows only render when a
// caller passes memberDetail -- see MemberDetail's own comment above for who gets one
// and why. "Total roll" is deliberately always the school's real whole-school
// totalRoll here, NOT the phase-sliced effectiveRoll driving a through-school's dot
// radius in Phase mode -- a field explicitly labelled "Total" showing a partial
// figure would read as a factual error, not a deliberate slice. The dot's own size
// still uses the sliced figure; only this label's number doesn't.
function buildPopupHtml(name: string, totalRoll: number | null, memberDetail: MemberDetail | null): string {
  const rollText = totalRoll !== null ? totalRoll.toLocaleString() : "—";
  let html = `<div class="vd-popup-name">${escapeHtml(name)}</div>`;
  html += `<div>Total roll: <strong>${rollText}</strong></div>`;
  if (memberDetail) {
    const { band1, band2, band3 } = memberDetail.ageBands;
    const { girls, boys } = memberDetail.genderSplit;
    html += `<div class="vd-popup-row">Ages &le;11: <strong>${band1.toLocaleString()}</strong>&nbsp;&nbsp; 12&ndash;16: <strong>${band2.toLocaleString()}</strong>&nbsp;&nbsp; 17&ndash;18: <strong>${band3.toLocaleString()}</strong></div>`;
    html += `<div class="vd-popup-row">Girls: <strong>${girls.toLocaleString()}</strong>&nbsp;&nbsp; Boys: <strong>${boys.toLocaleString()}</strong></div>`;
  }
  return html;
}

// 2026-08-26, map phase-band roll sizing, scoped to Phase colour-mode only (Guy's
// explicit decision -- whole-school totalRoll everywhere else). Single-tag schools
// are zero-cost: the school's whole roll already IS that one phase, so there's
// nothing to slice and rollByPhase is never even computed for them server-side.
// Through-schools use whichever tag colourForSchool is ALSO using for this dot (the
// same relevantPhaseTag resolution), so a dot's size always matches what its colour
// claims -- never sized by one phase while coloured by another.
//
// Typed against a narrow structural interface (not BoundsSchool directly) so the
// viewed school -- which has no urn/currentName of its own to fake -- satisfies it
// too (2026-08-27: the viewed school's own dot now goes through this same function).
function effectiveRoll(
  s: { phase: PhaseTag[]; totalRoll: number | null; rollByPhase: Partial<Record<PhaseTag, number>> | null },
  colourMode: string,
  phaseFilter: Set<string>,
): number | null {
  if (colourMode !== "phase" || s.phase.length <= 1) return s.totalRoll;
  // Through-school sizing matches its own colour (2026-08-28): the whole school's
  // roll, not one phase's slice -- see colourForSchool's own comment.
  if (phaseFilter.size === 0 && isGenuineThroughSchool(s.phase, s.rollByPhase)) return s.totalRoll;
  const tag = relevantPhaseTag(s.phase, phaseFilter, s.rollByPhase);
  if (!tag) return s.totalRoll;
  return s.rollByPhase?.[tag] ?? s.totalRoll;
}

function readThemeColours(root: HTMLElement) {
  const cs = getComputedStyle(root);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    dot: v("--dot", "#9ca3af"),
    schoolMarker: v("--school-marker", "#dc2626"),
    ring: v("--distance-ring", "#9ca3af"),
    tag: (label: string) => v(cssVarNameForTag(label), "#9ca3af"),
  };
}

function tagCssVarBlock(variant: "light" | "dark"): string {
  return Object.entries(TAG_COLOURS)
    .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c[variant][1]};`)
    .join("\n              ");
}

export default function SchoolMap({
  school,
  urn,
}: {
  school: ViewedSchool;
  urn: string;
}) {
  const router = useRouter();
  const [boundsSchools, setBoundsSchools] = useState<BoundsSchool[]>([]);
  // 2026-08-28: per-sector, not a single combined flag+number -- schools-in-bounds now
  // caps state and independent schools separately (150/250) so a viewport dense with
  // state schools no longer blanks independent ones out too. Which of the two actually
  // matters right now depends on the active sector filter -- computed below, not here.
  const [boundsOverCap, setBoundsOverCap] = useState({ state: false, independent: false });
  const [boundsCap, setBoundsCap] = useState<{ state: number; independent: number } | null>(null);
  // 2026-08-28, per Guy's live review: the map can genuinely look blank for two
  // different reasons (still fetching the current viewport; genuinely over cap, no
  // markers to show) and needs to say WHICH, clearly -- silence read as broken, not
  // as "working, just empty right now." True from the moment a debounced fetch
  // actually goes out to when it resolves/errors -- NOT from the moment the user
  // starts panning, or continuous panning would flicker it constantly.
  const [boundsLoading, setBoundsLoading] = useState(false);
  // 2026-08-27, corrected mid-round per Guy directly: the focus school's own card
  // shows the SAME public/member split as every other dot -- total roll only in the
  // public view, age bands + gender split only once the server confirms real
  // membership. NOT "always show it since it's public elsewhere on the page" (an
  // earlier, wrong assumption on my part) -- reuses the exact same
  // memberDetailIncluded signal the bounds route already computes for peers, so the
  // focus card can't show more than a peer's popup would for the same viewer.
  const [memberDetailIncluded, setMemberDetailIncluded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [colourMode, setColourMode] = useState<string>("sector");
  const [filters, setFilters] = useState<FilterState>(emptyFilterState());
  // Fullscreen toggle (2026-08-28): the wrapper that already holds the map + colour-key
  // + size-legend (rendered below) is what actually goes fullscreen -- the filter panel
  // column sits outside it, deliberately (fullscreen means "more map," not "more of
  // everything"). isFullscreen only drives the CSS class below; the control button
  // itself is raw DOM (added imperatively in the init effect, matching this file's
  // existing Leaflet-control style), not JSX, so its own icon/label are updated
  // directly in the fullscreenchange handler rather than through React state.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null);
  const fullscreenBtnRef = useRef<HTMLAnchorElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Real bug caught live, 2026-08-28: entering fullscreen made schools disappear --
  // NOT a leftover invalidateSize-timing bug (confirmed via live network capture: the
  // container resizes correctly and fast, invalidateSize fires correctly). The real
  // cause is more basic -- a bigger container at the SAME zoom level shows a WIDER
  // real-world area, and that wider area genuinely has 500+ schools, correctly
  // tripping the existing over-cap "zoom in to see them" state. Technically correct,
  // still a bad experience: fullscreen should show the same content bigger, not
  // surprise you with less.
  //
  // Second real bug, caught fixing the first: naively fitBounds()-ing the OLD bounds
  // into the NEW (differently-shaped) container doesn't work either -- fitBounds
  // preserves the bounding box's OWN aspect ratio only as far as it can; fit into a
  // container with a DIFFERENT aspect ratio, one axis necessarily overflows to fill
  // the container's shape, silently growing the real-world area again (confirmed
  // directly: zoom barely moved, one axis' span came back essentially unchanged). Same
  // family of bug as this file's OWN "shape the fit box to the container's actual
  // aspect ratio" note on the initial ring-fit, just triggered by fullscreen instead
  // of page load.
  //
  // Fixed by computing the zoom delta directly from the pixel-size change instead of
  // re-fitting a bounding box: capture size+zoom+center at the click (not in the
  // fullscreenchange handler -- the container may already be at its new size by the
  // time that event fires), then after the resize settles (the ResizeObserver below),
  // zoom in by log2(the LARGER of the width/height growth ratios). Using the larger
  // ratio (not the smaller, and not their average) is deliberate: it guarantees
  // NEITHER axis ever ends up showing more real-world extent than before, at the cost
  // of the smaller-growth axis showing a bit less (extra blank margin, never a
  // surprise over-cap).
  const preFullscreenViewRef = useRef<{ center: LatLng; zoom: number; size: Point } | null>(null);
  const fullscreenSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const boundsFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsAbortRef = useRef<AbortController | null>(null);
  // 2026-08-27, member-tier popup breakdown: the bearer token (if any), read once on
  // mount -- same lightweight one-shot pattern the old member-tier fetch used before
  // it was removed, not a live auth-state subscription. Read via a ref, not state:
  // scheduleBoundsFetch reads it at fetch time, doesn't need a re-render when it
  // resolves. Known, accepted gap: getSession() is async and the very FIRST bounds
  // fetch (on load) can fire before it resolves, so a genuinely signed-in member
  // might see anonymous-tier popups for one load until their next pan/zoom
  // self-heals it -- not worth the extra init-sequencing complexity to close, given
  // how many real bugs already came out of this exact init sequence.
  const authTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      authTokenRef.current = data.session?.access_token ?? null;
    });
  }, []);

  function scheduleBoundsFetch(map: LeafletMap) {
    if (boundsFetchTimerRef.current) clearTimeout(boundsFetchTimerRef.current);
    boundsFetchTimerRef.current = setTimeout(async () => {
      const { minEasting, maxEasting, minNorthing, maxNorthing } = boundsToBng(map);
      boundsAbortRef.current?.abort();
      const controller = new AbortController();
      boundsAbortRef.current = controller;
      setBoundsLoading(true);
      try {
        const token = authTokenRef.current;
        const res = await fetch(
          `/api/schools-in-bounds?minEasting=${minEasting}&maxEasting=${maxEasting}&minNorthing=${minNorthing}&maxNorthing=${maxNorthing}&urn=${urn}`,
          {
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );
        if (!res.ok) { setBoundsLoading(false); return; }
        const body = await res.json();
        setBoundsOverCap({ state: !!body.overCap?.state, independent: !!body.overCap?.independent });
        setBoundsCap(
          body.cap && typeof body.cap.state === "number" && typeof body.cap.independent === "number"
            ? { state: body.cap.state, independent: body.cap.independent }
            : null,
        );
        setBoundsSchools(body.schools ?? []);
        setMemberDetailIncluded(!!body.memberDetailIncluded);
        setBoundsLoading(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          // Non-critical -- a failed viewport refresh just leaves the previous
          // markers on screen rather than erroring the page.
          setBoundsLoading(false);
        }
        // AbortError: a newer request has already taken over (aborted at the top of
        // THIS same function, for the request this replaced) and owns loading state
        // from here -- touching it here would flicker loading off for one tick before
        // the new request's own setBoundsLoading(true) (already run, synchronously
        // above, before this one's fetch() even rejected) takes effect.
      }
    }, BOUNDS_FETCH_DEBOUNCE_MS);
  }

  // Init map once, centred on the viewed school. Attaches the moveend listener
  // before triggering the first bounds fetch, so panning/zooming from here on
  // refetches automatically.
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapElRef.current) return;
      leafletRef.current = L;

      const schoolLatLng = bngToLatLng(school.easting, school.northing);
      const map = L.map(mapElRef.current, {
        center: schoolLatLng,
        zoom: MIN_INITIAL_ZOOM,
        zoomControl: false,
        attributionControl: true,
        // Third bug in the same chain, caught by re-checking the actual bbox sent
        // rather than trusting the fix above: Leaflet's default zoomSnap (1) rounds
        // fitBounds DOWN to the next whole zoom level to guarantee the target bounds
        // never get cropped -- since each whole zoom level roughly doubles the real-
        // world area shown, this was pushing the ring-fitted view to ~2x more area
        // than the ring (and the aspect-matched box above) actually needed, which
        // was enough to trip the bounds route's hard cap on load. Tried a 0.25
        // fractional snap first -- still rounded down enough to stay over cap (the
        // 0.25-level rounding margin alone is worth ~1.2x per dimension, ~1.4x
        // total area). zoomSnap: 0 disables snapping entirely -- fitBounds lands on
        // its exact computed zoom, no rounding margin at all. zoomDelta stays 1 so
        // the +/- control buttons still move a full level each click.
        zoomSnap: 0,
        zoomDelta: 1,
      });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Fullscreen toggle, 2026-08-28: native browser Fullscreen API on
      // fullscreenTargetRef (the wrapper holding the map + colour-key + size-legend,
      // set up in the JSX below), not a Leaflet plugin -- matches this file's own
      // pattern of hand-rolled controls (MapColourKey, MapFilterPanel) rather than an
      // off-the-shelf plugin for something the platform already does directly. A real
      // L.Control (same mechanism as the zoom control above), not a separately
      // positioned React div, so it sits correctly in Leaflet's own control stacking
      // for free -- avoiding the exact z-index bug already documented on the
      // colour-key box below. Feature-detected: requestFullscreen isn't universal
      // (older Safari needs a webkit-prefixed call this doesn't attempt), so the
      // button simply doesn't render if the API isn't there rather than shipping a
      // control that does nothing.
      if (fullscreenTargetRef.current?.requestFullscreen) {
        const FullscreenControl = L.Control.extend({
          options: { position: "bottomright" },
          onAdd: function () {
            const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
            const link = L.DomUtil.create("a", "vd-fullscreen-btn", container) as HTMLAnchorElement;
            link.href = "#";
            link.title = "Fullscreen";
            link.setAttribute("role", "button");
            link.setAttribute("aria-label", "Enter fullscreen");
            link.innerHTML = EXPAND_ICON;
            fullscreenBtnRef.current = link;
            L.DomEvent.on(link, "click", (e: Event) => {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);
              const target = fullscreenTargetRef.current;
              if (!target) return;
              // Captured here, before either call below -- see preFullscreenViewRef's
              // own comment for why this has to happen at the click, not afterward.
              const m = mapRef.current;
              preFullscreenViewRef.current = m
                ? { center: m.getCenter(), zoom: m.getZoom(), size: m.getSize() }
                : null;
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                target.requestFullscreen();
              }
            });
            return container;
          },
        });
        new FullscreenControl().addTo(map);
      }

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // 2026-08-28: real bug caught live -- entering fullscreen made every marker
      // disappear. Root cause: the fullscreenchange handler below called
      // invalidateSize() on a requestAnimationFrame tick, guessing that was enough
      // time for the transition to finish -- it wasn't. invalidateSize() run against
      // the container's OLD (pre-transition) size recomputes Leaflet's pixel origin
      // wrong, which silently places every existing marker at bogus off-screen
      // coordinates rather than erroring -- looks exactly like "disappeared," not a
      // crash. ResizeObserver fires on the container's ACTUAL size change, whenever
      // that genuinely happens, instead of guessing at transition timing -- covers
      // fullscreen either direction and makes the existing window-resize listener
      // below redundant for this same container (left in place regardless;
      // invalidateSize() is cheap and idempotent, not worth the risk of removing a
      // working, independent safeguard just to deduplicate).
      if (mapElRef.current && typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => {
          const m = mapRef.current;
          if (!m) return;
          m.invalidateSize();
          // Fires on every genuine size change (ordinary window resize included) --
          // only restore the view when a fullscreen toggle actually just happened
          // (preFullscreenViewRef set at the click, see its own comment); an ordinary
          // resize legitimately DOES show more/less real-world area at the same zoom,
          // which is expected and not what this is fixing.
          //
          // Debounced, not applied on the FIRST firing: a fullscreen transition isn't
          // one instant resize -- ResizeObserver can fire more than once as the
          // container grows toward its final size, and computing the restoration
          // against an intermediate, not-yet-final size gets clobbered by the next
          // (correctly-sized) firing anyway. Waiting for 150ms of genuine
          // size-stability means it's always the FINAL settled size being used.
          if (fullscreenSettleTimerRef.current) clearTimeout(fullscreenSettleTimerRef.current);
          fullscreenSettleTimerRef.current = setTimeout(() => {
            const pre = preFullscreenViewRef.current;
            if (pre) {
              const newSize = m.getSize();
              const widthRatio = newSize.x / pre.size.x;
              const heightRatio = newSize.y / pre.size.y;
              const zoomDelta = Math.log2(Math.max(widthRatio, heightRatio));
              m.setView(pre.center, pre.zoom + zoomDelta, { animate: false });
              preFullscreenViewRef.current = null;
            }
          }, 150);
        });
        ro.observe(mapElRef.current);
        resizeObserverRef.current = ro;
      }

      // Real bug caught while verifying the distance ring this round: at the fixed
      // MIN_INITIAL_ZOOM (14, from an earlier "tighter default zoom" round), the
      // Independent 15km ring's own radius is roughly 2,500px -- its label lands
      // ~2,200px above the visible ~560px-tall map, entirely off-screen, and the
      // ring itself is too gentle a curve near the school to read as a circle at
      // all. The ring was rendering at the genuinely correct real-world radius the
      // whole time; the map just wasn't zoomed out far enough to ever show it.
      // fitBounds around the ring's own extent on load resolves this without
      // abandoning the tighter-zoom instruction outright: maxZoom keeps it from ever
      // zooming IN past 14 for a tight 5km State ring, it only zooms OUT as far as
      // the active ring actually needs.
      //
      // Second real bug, caught immediately after fixing the first: a SQUARE bounds
      // box (school +/- ringM on both axes) fed to fitBounds inside a WIDE
      // RECTANGLE container (this round reverted from last round's square map back
      // to a rectangle) forces Leaflet to zoom out far enough for the ring's height
      // to fit the container's shorter dimension, which -- because the container is
      // roughly 2:1 -- drags the WIDTH out to ~100km+ of real distance well beyond
      // what the ring itself needs, tripping the bounds route's own hard cap and
      // loading to an empty "zoom in to see schools" map. Fixed by shaping the fit
      // box to the container's own actual pixel aspect ratio (map.getSize(), read
      // once right after construction) BEFORE fitting -- the ring's true diameter
      // becomes the constraint on the shorter axis, the longer axis extends to match
      // the container's shape rather than forcing an squarer, much-further zoom-out.
      const ringKm = school.sector === "Independent" ? DISTANCE_RING_KM_INDEPENDENT : DISTANCE_RING_KM_STATE;
      const ringM = ringKm * 1000;
      const size = map.getSize();
      const aspect = size.x / size.y;
      const halfHeightM = ringM;
      const halfWidthM = aspect >= 1 ? ringM * aspect : ringM;
      const ringBounds = L.latLngBounds([
        bngToLatLng(school.easting - halfWidthM, school.northing - halfHeightM),
        bngToLatLng(school.easting + halfWidthM, school.northing + halfHeightM),
      ]);

      map.on("moveend", () => scheduleBoundsFetch(map));
      map.fitBounds(ringBounds, { padding: [24, 24], maxZoom: MIN_INITIAL_ZOOM });
      // fitBounds fires moveend itself whenever the view actually changes, which it
      // reliably will here -- but don't depend on that alone for the first fetch;
      // call it directly too so a degenerate case (ring bounds that happen to match
      // the constructor's initial view exactly) still gets real data on load.
      scheduleBoundsFetch(map);

      setMapReady(true);
    });

    // The map's container size can change (responsive width, or a future layout
    // change) -- Leaflet caches its container size at init and after each
    // invalidateSize() call, so a resize without this leaves tiles misaligned.
    const handleResize = () => mapRef.current?.invalidateSize();
    window.addEventListener("resize", handleResize);

    // Fullscreen toggle can also exit via the browser's own UI (Escape key, or a
    // "leave fullscreen" affordance browsers show), not just this control's own
    // button -- fullscreenchange is the one event that fires either way, so it's the
    // only reliable place to keep isFullscreen/the button icon and Leaflet's own
    // cached container size in sync, regardless of how fullscreen was left.
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === fullscreenTargetRef.current;
      setIsFullscreen(active);
      const btn = fullscreenBtnRef.current;
      if (btn) {
        btn.innerHTML = active ? COLLAPSE_ICON : EXPAND_ICON;
        btn.title = active ? "Exit fullscreen" : "Fullscreen";
        btn.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
      }
      // invalidateSize() itself is NOT called here any more -- see the ResizeObserver
      // set up alongside map init above for why a guessed-timing rAF call was the
      // actual bug (markers disappearing on entering fullscreen). This handler now
      // only owns the button icon/aria-label and isFullscreen state.
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      resizeObserverRef.current?.disconnect();
      if (fullscreenSettleTimerRef.current) clearTimeout(fullscreenSettleTimerRef.current);
      if (boundsFetchTimerRef.current) clearTimeout(boundsFetchTimerRef.current);
      boundsAbortRef.current?.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw / redraw markers whenever the underlying data, active filters/colour mode,
  // or the map's readiness changes -- also re-runs on a live OS/theme change (colours
  // are read from resolved CSS custom properties, not hardcoded).
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current || !layerGroupRef.current || !rootRef.current) return;
    const L = leafletRef.current;
    const group = layerGroupRef.current;
    const root = rootRef.current;

    function draw() {
      group.clearLayers();
      const colours = readThemeColours(root);

      const [schoolLat, schoolLng] = bngToLatLng(school.easting, school.northing);

      // Distance ring -- fixed radius, sector-aware, no pupil data (see module
      // comment for the precedent correction). Drawn first so markers sit on top.
      const ringKm = school.sector === "Independent" ? DISTANCE_RING_KM_INDEPENDENT : DISTANCE_RING_KM_STATE;
      L.circle([schoolLat, schoolLng], {
        radius: ringKm * 1000,
        color: colours.ring,
        weight: 1.25,
        dashArray: "4 5",
        fill: false,
        interactive: false,
      }).addTo(group);
      // A fixed label at the ring's true north point -- BNG is a metric grid, so
      // "ringKm north" is just northing + ringKm*1000, no trig needed.
      const [ringLabelLat, ringLabelLng] = bngToLatLng(school.easting, school.northing + ringKm * 1000);
      L.marker([ringLabelLat, ringLabelLng], {
        icon: L.divIcon({
          className: "vd-ring-label",
          html: `${ringKm} km`,
          iconSize: [40, 16],
          iconAnchor: [20, 8],
        }),
        interactive: false,
      }).addTo(group);

      // Real bug caught while rebuilding this round (2026-08-25): the bounds query
      // has no reason to exclude the viewed school itself, so it was showing up
      // twice -- once as its own dedicated red marker, once as an ordinary
      // sector/phase/gender-coloured neighbour dot stacked exactly on top of it.
      // Excluded here by URN, not in the API -- the API's job is "what's in this
      // box," not "what's in this box excluding one specific school."
      const visible = boundsSchools.filter(
        (s) => s.urn !== urn && passesFilters({ sector: s.sector, phase: s.phase, gender: s.gender, rollByPhase: s.rollByPhase }, filters),
      );

      const phaseFilter = filters.phase ?? new Set<string>();
      const viewedRoll = effectiveRoll(school, colourMode, phaseFilter);
      // The viewed school's own roll is a real data point in the same comparison,
      // not just something mapped into a domain built from everyone else -- it can
      // legitimately become the new min or max (2026-08-27, "a big school should
      // look big even at the centre").
      const rolls = visible
        .map((s) => effectiveRoll(s, colourMode, phaseFilter))
        .filter((r): r is number => r !== null);
      if (viewedRoll !== null) rolls.push(viewedRoll);
      const minRoll = rolls.length ? Math.min(...rolls) : 0;
      const maxRoll = rolls.length ? Math.max(...rolls) : 0;

      for (const s of visible) {
        const roll = effectiveRoll(s, colourMode, phaseFilter);
        const radius = roll !== null ? rollRadius(roll, minRoll, maxRoll) : UNIFORM_RADIUS;
        const colour = colourForSchool(s, colourMode, colours, phaseFilter);
        const [lat, lng] = bngToLatLng(s.easting, s.northing);

        const marker = L.circleMarker([lat, lng], {
          radius,
          color: colour,
          weight: 1.5,
          fillColor: colour,
          fillOpacity: 0.65,
        });

        // Name + total roll, shown to every visitor (2026-08-25 -- see module comment
        // for the confirmed privacy-boundary reversal). Age-band/gender-split rows
        // only appear when the SERVER decided this caller is a verified member of the
        // school being viewed (s.ageBands/s.genderSplit both non-null together, or
        // both null -- schools-in-bounds/route.ts's own logic, not re-checked here).
        const memberDetail: MemberDetail | null =
          s.ageBands && s.genderSplit ? { ageBands: s.ageBands, genderSplit: s.genderSplit } : null;
        marker.bindTooltip(buildPopupHtml(s.currentName, s.totalRoll, memberDetail), {
          direction: "top", offset: [0, -4], className: "vd-popup",
        });
        marker.on("click", () => router.push(`/schools/${s.urn}`));
        // circleMarker renders as an SVG <path> -- getElement()'s declared return
        // type is the base DOM Element, which has no .style; SVG elements do.
        (marker.getElement?.() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
        marker.addTo(group);
      }

      // Viewed school: the outer ring is fixed size and always red -- purely an
      // identification mark, "this one, obviously." The INNER dot (2026-08-27) uses
      // the exact same roll-scaled radius and colour-mode-driven colour every
      // neighbour dot uses, including the same domain computed just above, so it's
      // genuinely contextualised among its neighbours rather than a fixed marker
      // floating above the comparison.
      const viewedRadius = viewedRoll !== null ? rollRadius(viewedRoll, minRoll, maxRoll) : UNIFORM_RADIUS;
      const viewedColour = colourForSchool(school, colourMode, colours, phaseFilter);
      L.circleMarker([schoolLat, schoolLng], {
        radius: SCHOOL_MARKER_RING_RADIUS, color: colours.schoolMarker, weight: 2.5, fill: false,
      }).addTo(group);
      // Persistent info card (2026-08-27), replacing the old plain red text label --
      // same shape as a neighbour popup (.vd-focus-card below is literally Leaflet's
      // own default tooltip styling, just with a red border swapped in), always
      // visible (permanent: true), not hover-triggered, since this is the one school
      // always in focus. Same buildPopupHtml content structure as neighbour hover
      // popups, and the SAME public/member split too (corrected per Guy directly --
      // the focus school shows only total roll in the public view, exactly like
      // every other dot; age bands + gender split only once memberDetailIncluded is
      // genuinely true for this viewer).
      const viewedMemberDetail: MemberDetail | null =
        memberDetailIncluded && school.ageBands && school.genderSplit
          ? { ageBands: school.ageBands, genderSplit: school.genderSplit }
          : null;
      L.circleMarker([schoolLat, schoolLng], {
        radius: viewedRadius, color: viewedColour, weight: 1.5,
        fillColor: viewedColour, fillOpacity: 0.65,
      })
        .bindTooltip(
          buildPopupHtml(`${school.name}${school.town ? ` (${school.town})` : ""}`, school.totalRoll, viewedMemberDetail),
          {
            permanent: true, direction: "right", offset: [SCHOOL_MARKER_RING_RADIUS + 2, 0], className: "vd-focus-card",
          },
        )
        .addTo(group);
    }

    draw();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => mq.removeEventListener("change", draw);
  }, [mapReady, boundsSchools, filters, colourMode, school, router, urn, memberDetailIncluded]);

  // Legend domain mirrors the draw effect's own roll-domain computation -- kept as a
  // small, separately-readable duplication rather than threading draw-effect state
  // out, since it's two lines and both need the exact same "visible, filtered,
  // roll-known" set.
  const visibleForLegend = boundsSchools.filter(
    (s) => s.urn !== urn && passesFilters({ sector: s.sector, phase: s.phase, gender: s.gender, rollByPhase: s.rollByPhase }, filters),
  );
  const legendPhaseFilter = filters.phase ?? new Set<string>();
  const legendRolls = visibleForLegend
    .map((s) => effectiveRoll(s, colourMode, legendPhaseFilter))
    .filter((r): r is number => r !== null);
  const legendMinRoll = legendRolls.length ? Math.min(...legendRolls) : null;
  const legendMaxRoll = legendRolls.length ? Math.max(...legendRolls) : null;

  const colourModes = TAG_GROUPS.filter((g) => COLOUR_MODE_KEYS.includes(g.key)).map((g) => ({
    key: g.key,
    label: g.title,
  }));
  const activeGroup = TAG_GROUPS.find((g) => g.key === colourMode);
  const colourSwatches: ColourSwatch[] = activeGroup
    ? activeGroup.options.map((opt) => ({ label: opt, colourVar: cssVarNameForTag(opt) }))
    : [];

  // 2026-08-28: which sector(s) actually matter for the over-cap banner depends on the
  // active sector filter -- e.g. filtered to Independent only, the state cap tripping
  // is irrelevant noise (state schools aren't shown either way), not something worth
  // a banner over. Empty filter = both sectors relevant, same as "no restriction"
  // everywhere else this Set is read.
  const sectorFilter = filters.sector ?? new Set<string>();
  const stateSectorRelevant = sectorFilter.size === 0 || sectorFilter.has("State");
  const independentSectorRelevant = sectorFilter.size === 0 || sectorFilter.has("Independent");
  const relevantOverCapSectors: string[] = [
    ...(stateSectorRelevant && boundsOverCap.state ? ["state"] : []),
    ...(independentSectorRelevant && boundsOverCap.independent ? ["independent"] : []),
  ];
  const showOverCapCard = relevantOverCapSectors.length > 0;
  const overCapMessage = relevantOverCapSectors
    .map((sector) => `${boundsCap?.[sector as "state" | "independent"] ?? "too many"} ${sector}`)
    .join(" and ");

  return (
    <div ref={rootRef} className="map-widget w-full">
      <style>{`
        .map-widget {
          color-scheme: light;
          /* Every tag colour (not just sector) is available as a --tag-* custom
             property, generated from TAG_COLOURS (tag-colours.ts) so the map, the
             colour key box and TypologyTags pills can never drift apart. */
          --dot: #9ca3af;
          --school-marker: #dc2626;
          --distance-ring: #9ca3af;
          ${tagCssVarBlock("light")}
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .map-widget {
            color-scheme: dark;
            --dot: #6b7280;
            --school-marker: #f87171;
            --distance-ring: #6b7280;
            ${tagCssVarBlock("dark")}
          }
        }
        :root[data-theme="dark"] .map-widget {
          color-scheme: dark;
          --dot: #6b7280;
          --school-marker: #f87171;
          --distance-ring: #6b7280;
          ${tagCssVarBlock("dark")}
        }
        /* Neighbour hover popup content (2026-08-27, buildPopupHtml) -- Leaflet's own
           .leaflet-tooltip already supplies a white box/border/shadow by default, not
           themed here; just sizing the new multi-line content sensibly. */
        .vd-popup { font-size: 12px; line-height: 1.6; }
        .vd-popup-name { font-weight: 700; margin-bottom: 2px; }
        .vd-popup-row { margin-top: 2px; white-space: nowrap; }
        /* Persistent focus-school card (2026-08-27, restyled same day per Guy
           directly) -- replaces the old plain red text label. Same shape as the
           neighbour popups: literally Leaflet's own default .leaflet-tooltip values
           (padding 6px, border-radius 3px, white background, #222 text, nowrap,
           the same box-shadow) rather than a bespoke card -- always plain white/black,
           not theme-aware, matching the fact that neighbour popups aren't theme-aware
           either. The ONLY delta from a plain Leaflet tooltip is the red border
           (matching --school-marker, pairing with the ring around this dot) in place
           of Leaflet's own 1px white border -- school name stays default black, not
           red, no other difference. */
        .vd-focus-card {
          background: #ffffff;
          color: #222222;
          border: 2px solid var(--school-marker);
          border-radius: 3px;
          padding: 6px;
          font-size: 12px;
          line-height: 1.6;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .vd-focus-card::before { display: none; }
        .vd-ring-label {
          font-size: 10px; font-weight: 600; color: var(--distance-ring);
          text-align: center; white-space: nowrap; background: transparent;
        }
        /* Fullscreen (2026-08-28): the target div itself gets width/height 100% from
           every browser's UA stylesheet for free once :fullscreen applies -- what it
           does NOT do is stretch to fit CHILDREN with their own fixed sizing.
           .vd-map-el's normal h-[520px]/sm:h-[560px] is exactly that -- a fixed height
           that's correct for its normal in-page box, meaningless once the wrapper
           around it is the whole screen. !important because it's overriding an
           inline-specificity-equivalent Tailwind utility class, not fighting anything
           else -- there's no other rule this could clobber. Background colour matters
           too: fullscreen elements paint against black by default in some browsers
           with no page chrome behind them to show through, unlike their normal in-page
           box which sits on the page's own background. */
        .vd-map-fullscreen-target:fullscreen {
          /* Matches globals.css's own --background exactly (light #ffffff / dark
             #0a0a0a), not a value invented for this rule alone. */
          background: #ffffff;
          display: flex;
          padding: 12px;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-map-fullscreen-target:fullscreen {
            background: #0a0a0a;
          }
        }
        :root[data-theme="dark"] .vd-map-fullscreen-target:fullscreen {
          background: #0a0a0a;
        }
        .vd-map-fullscreen-target:fullscreen .vd-map-el {
          height: 100% !important;
          flex: 1;
        }
        /* Leaflet's own .leaflet-bar a centers TEXT content (the zoom control's own
           +/-) via line-height matching the button's fixed size -- an inline SVG
           doesn't participate in that the same way (baseline-aligns, not
           line-height-centered), so it needs its own flex centering to actually sit in
           the middle of the button rather than sitting low.
           Real bug caught live: this rule was losing to Leaflet's OWN ".leaflet-bar a"
           (confirmed via computed styles -- display stayed "block", never applied),
           because that selector's specificity (element+class) beats a bare class
           selector. !important, not a more specific selector, to match how this file
           already handles every other "must beat Leaflet's/Tailwind's own CSS" case
           (the fullscreen height override just above). */
        .vd-fullscreen-btn { display: flex !important; align-items: center; justify-content: center; }
        /* Loading/over-cap status card (2026-08-28) -- deliberately high-contrast
           (solid border, solid background, bold text) rather than the previous
           discreet pill, per Guy's direct feedback that it needed to be very clear,
           not easy to miss against live map tiles. */
        .vd-status-card { max-width: 320px; }
        .vd-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid var(--dot);
          border-top-color: transparent;
          border-radius: 50%;
          animation: vd-spin 0.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vd-spinner { animation: none; }
        }
        @keyframes vd-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* 2026-08-28, per Guy's live review: filters moved off the side column onto
          the map itself, top-left, matching the colour-by/size-key boxes' own
          top-right float -- one full-width map with all its controls floating over
          it, not a map competing with a column for width. Same responsive shape
          those boxes already use (stacked flow content below the map under 640px,
          absolute-over-the-map at 640px and up) -- verified working at that size
          already, so reusing it here rather than inventing a second pattern. */}
      <div ref={fullscreenTargetRef} className="vd-map-fullscreen-target relative w-full">
        <div ref={mapElRef} className="vd-map-el h-[520px] w-full sm:h-[560px]" />

        {/* 2026-08-28, per Guy's live review: the map can go genuinely blank for two
            different reasons (still fetching the current viewport; genuinely over
            cap, nothing to show) and silence read as broken, not as "working, just
            empty right now" -- the old over-cap message was a small discreet pill
            easy to miss entirely. Same centered card handles both, loading taking
            priority when both are momentarily true (a new, still-resolving fetch
            after an over-cap viewport) so there's never two overlapping messages. */}
        {(boundsLoading || showOverCapCard) && (
          <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center px-4">
            <div
              role="status"
              aria-live="polite"
              className="vd-status-card rounded-lg border-2 border-neutral-900 bg-white px-6 py-5 text-center shadow-lg dark:border-neutral-100 dark:bg-neutral-950"
            >
              {boundsLoading ? (
                <>
                  <div className="vd-spinner mx-auto mb-3" />
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Loading schools…</p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                    More than {overCapMessage} schools here
                  </p>
                  <p className="mt-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Zoom in to see them
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* 2026-08-28, per Guy's live review: filters moved off the side column onto
            the map itself, top-left -- same responsive shape the colour-key/legend
            box below already uses and was already verified working at (stacked flow
            content below the map under 640px, absolute-over-the-map at 640px and up). */}
        <div className="mt-3 sm:absolute sm:left-3 sm:top-3 sm:z-[1000] sm:mt-0 sm:w-64">
          <MapFilterPanel filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Real bug caught while verifying this box was actually visible (not just
            present in the DOM): Leaflet's .leaflet-container has position:relative
            but NO explicit z-index, so it never establishes its own stacking
            context -- its internal panes' z-index values (overlay pane 400, marker
            pane 600, controls 1000) compare directly against THIS box's implicit
            z-index:auto in the shared outer stacking context and win, regardless of
            DOM order. The box was genuinely rendering (confirmed via
            getComputedStyle, elementFromPoint, and pixel-level screenshot
            inspection -- a real map marker was visibly painting through the space
            this box's own bounding rect occupied), just losing every paint battle
            to markers/tiles underneath it. z-[1000] matches Leaflet's own highest
            pane z-index (its zoom control), guaranteeing this box wins.

            Real bug caught live in production, 2026-08-28 (Playwright-verified across
            390/768/1024/1440/1920px, including live resize, not just fresh loads):
            below 640px this box's fixed w-56 (224px) is more than half the viewport,
            so floating it absolutely over the map buried the focus-school popup card
            underneath it -- readable at 768px+ (plenty of map width left over) but a
            real usability break on an actual phone. Stacked flow content below the
            map under sm (640px), absolute-over-the-map at sm and up -- the filter
            panel above reuses this exact same shape, not a second pattern. */}
        <div className="mt-3 flex flex-col gap-3 sm:absolute sm:right-3 sm:top-3 sm:z-[1000] sm:mt-0 sm:w-56">
          <MapColourKey
            modes={colourModes}
            mode={colourMode}
            onModeChange={setColourMode}
            swatches={colourSwatches}
          />

          <div className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Size</h3>
            {legendMinRoll !== null && legendMaxRoll !== null ? (
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <LegendDot radius={MIN_RADIUS} />
                <span>{legendMinRoll.toLocaleString()}</span>
                <LegendDot radius={MAX_RADIUS} />
                <span>{legendMaxRoll.toLocaleString()} pupils</span>
              </div>
            ) : (
              <p className="text-neutral-500 dark:text-neutral-400">Dot size reflects roll where available.</p>
            )}
            {colourMode === "phase" && (
              <p className="mt-1.5 text-xs text-neutral-400">
                Through-schools are sized to pupils in the matched phase only, not their whole roll.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-1 text-xs text-neutral-400">
        Hover or tap a dot for its name and roll. Dashed ring: a {school.sector === "Independent" ? DISTANCE_RING_KM_INDEPENDENT : DISTANCE_RING_KM_STATE}km reference distance, not a real catchment boundary.
      </p>
    </div>
  );
}

function LegendDot({ radius }: { radius: number }) {
  const size = radius * 2;
  return (
    <span
      className="inline-block shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600"
      style={{ width: size, height: size }}
    />
  );
}
