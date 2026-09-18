"use client";

// Academic Results Map, headline level only (frontend build brief §3a). Same real
// primitives Rolls' own MapView.tsx uses (bngToLatLng, trendColour/TREND_LEGEND_STOPS,
// Leaflet) but a much simpler component -- no clustering (this round's scope is
// ticked-comparator-set scale only, never Region/Nation, per Part C), no choropleth.
// Family-level (§3b) and subject-level (§3c) depth are NOT built this round -- flagged
// in the build report as a real, separate follow-up (they need a category/subject
// drill-down filter and their own entries-based sizing, not built this round).
//
// Map round 2 (live feedback after Stage 2 UX shipped, commit a9b5ce3): items 2-6
// brought this map's chrome into real parity with Rolls' own MapView.tsx -- the
// distance ring, the colour legend's position/content, and a real dot-size scale box.
// Item 1 fixed a real intermittent "map blank until you toggle colour mode" bug (the
// mapReady state below).
//
// Round 3 (Map edit 2), live feedback on round 2: A1 switches GCSE/Post-16 circle
// size + popup entries figure from roll population to real DfE entries counts (KS2
// stays on population -- no equivalent DfE figure exists for it); A2 replaces grade
// band's borrowed trend-scale colour with a real, separate, value-based sequential
// scale, normalised to the CURRENT set's own real min-max range (not rank, not a
// fixed universal scale); A3 reorders/repositions the colour-mode toggle; A4 rewrites
// the popup copy (bold figures, one stat per line, real per-stat dates, a real rank);
// A5 fixes Post-16's grade band being silently unavailable outside the "A level"
// cohort -- see that section below for the real root cause found.
//
// LA/Region choropleth (new feature, round 1 of 2): a standalone "View by area"
// toggle, independent of the ticked/comparator set entirely -- switches from
// individual school circles to a real LA-level (zoomed in) or Region-level (zoomed
// out) choropleth of the CURRENT stage's own real HEADLINE_MEASURE, connecting two
// real, already-existing, previously-unconnected pieces (Rolls' own choropleth
// geometry, Academic's own academic_geography_aggregate data -- see
// academic-geography-choropleth.ts for the real join/data-layer detail). Reuses
// gradeBandColour/GRADE_BAND_LEGEND_STOPS for the choropleth's own fill -- the SAME
// real colour language the point map's own Grade band mode uses, not a third scale.
// KS2 is not supported (academic_geography_aggregate has no real KS2 data at all,
// confirmed at that table's own creation) -- the toggle is hidden for KS2 and
// whenever a Category (familyId) is selected (this round's own real scope: whole-
// school only, no family-level geography data wired in yet).

import { useEffect, useMemo, useRef, useState } from "react";
import { bngToLatLng } from "@/lib/bng";
import { trendColour, gradeBandColour, GRADE_BAND_LEGEND_STOPS, TREND_LEGEND_STOPS } from "@/lib/trend-colours";
import { gradeBandColourForFamily, gradeBandLegendStopsForFamily } from "@/lib/subject-family-colours";
import { trendBadge, rankDescendingWithTies } from "@/lib/data-view-cards";
import type { ViewKey } from "@/lib/data-view-types";
import type { AcademicGeographyChoroplethEntry } from "@/lib/academic-geography-choropleth";
import { resolveRegionNation } from "@/lib/region-crosswalk";
import ViewSwitcher from "./ViewSwitcher";
import PdfExportButton from "./PdfExportButton";
import LoadingSpinnerCard from "./LoadingSpinnerCard";
import {
  HEADLINE_MEASURE,
  HEADLINE_UNIT,
  HEADLINE_AGE,
  TREND_BASELINE_PERIOD,
  ks4ExclusionGroupNote,
  ks4ExclusionWholeGroupSentence,
  ks5BucketMeasureKey,
  KS5_BUCKET_LABEL,
  ks5BucketExclusionNote,
  ks5BucketWholeGroupSentence,
  ks5BucketMeasureFor,
  headlineValueAt,
  latestMeasureAt,
  latestEntriesCount,
  trendWordingFor,
  TREND_STAT_LABEL,
  stageYears,
  populationAtAge,
  familyYearsFor,
  latestFamilyYear,
  type AcademicSchoolProfile,
  type KsStage,
  type Ks5Bucket,
} from "@/lib/academic-data-view";

const EMPTY_EXCLUDED_SET: Set<string> = new Set();

const MIN_RADIUS = 5;
const MAX_RADIUS = 20;
const UNTICKED_RADIUS = 3.5;
const UNTICKED_COLOUR = "#9ca3af";

// Map round 2, item 2: same real fixed, sector-aware distance-ring radii Rolls' own
// MapView.tsx falls back to whenever there's no real per-school distance to compute a
// dynamic ring from (that component's own dynamicRingKm comment). AcademicSchoolProfile
// has no equivalent per-school distanceKm field at all (confirmed directly -- it isn't
// fetched anywhere in this module's own profile shape, unlike Rolls' DefaultListEntry),
// so this map always uses the fixed radius -- the correct behaviour given what data is
// actually available, not a shortcut around porting the dynamic version.
const DISTANCE_RING_KM_STATE = 2;
const DISTANCE_RING_KM_INDEPENDENT = 10;

const TILE_URL = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function radiusFor(value: number, min: number, max: number): number {
  if (!(max > min)) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (Math.sqrt(value) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
}

function formatHeadlineValue(stage: KsStage, value: number): string {
  return HEADLINE_UNIT[stage] === "percent" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

// Same small, self-contained escape MapView.tsx's own tooltip HTML already uses --
// duplicated here rather than imported (module-private there), matching this file's
// existing "small self-contained copy" discipline for shared visual patterns.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Same academic-year-label convention MapView.tsx/GraphsView.tsx each already keep
// their own local copy of -- A4's own worked examples ("2024/5") read as informal
// shorthand in Guy's own note, not a deliberate third, different date format; using
// the site's one existing convention here rather than inventing a second one, flagged
// explicitly in the build report in case the shorter form was actually intended.
function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

// Stage 2 UX review, item 9: same real percentile-trim MapView.tsx's own
// trimmedBoundsFor uses (a single wrongly-geocoded outlier shouldn't wreck the
// auto-fit zoom), duplicated here rather than imported (module-private there,
// same "small self-contained copy" discipline as escapeHtml above) -- a genuine
// no-op at Academic's own comparator-set scale (well under 50 points), kept for
// consistency and in case that scale grows (item 11 widens the comparator set).
const BOUNDS_TRIM_PERCENTILE = 0.02;
function trimmedBoundsFor(points: [number, number][]): [number, number][] {
  if (points.length < 50) return points;
  const lats = points.map((p) => p[0]).sort((a, b) => a - b);
  const lngs = points.map((p) => p[1]).sort((a, b) => a - b);
  const cut = Math.floor(points.length * BOUNDS_TRIM_PERCENTILE);
  const [latLo, latHi] = [lats[cut], lats[lats.length - 1 - cut]];
  const [lngLo, lngHi] = [lngs[cut], lngs[lngs.length - 1 - cut]];
  const trimmed = points.filter(([lat, lng]) => lat >= latLo && lat <= latHi && lng >= lngLo && lng <= lngHi);
  return trimmed.length > 1 ? trimmed : points;
}

// LA/Region choropleth: the SAME real, already-justified zoom threshold Rolls' own
// MapView.tsx uses for its Nation-scope region<->LA drill (that component's own
// NATION_REGION_TIER_ZOOM_THRESHOLD comment has the real geometry math this was
// grounded in -- a typical viewport fits a single region at zoom ~8, a single LA at
// zoom ~10) -- reused directly, not re-derived, since this map draws the exact same
// real boundary geometry at the exact same real scale.
const CHOROPLETH_REGION_LA_ZOOM_THRESHOLD = 8;

// Same real label-visibility-by-actual-on-screen-pixel-size sweep as MapView.tsx's
// own sweepChoroplethLabelVisibility -- duplicated here (module-private there), same
// "small self-contained copy" discipline this file already applies to escapeHtml/
// trimmedBoundsFor, same real MIN_LABEL_WIDTH_PX/MIN_LABEL_HEIGHT_PX values (not
// re-derived, this map renders the identical real polygon geometry at the identical
// real scale).
const MIN_LABEL_WIDTH_PX = 40;
const MIN_LABEL_HEIGHT_PX = 22;
function sweepChoroplethLabelVisibility(
  map: import("leaflet").Map,
  labelLayers: { marker: import("leaflet").Marker; bounds: import("leaflet").LatLngBounds }[],
) {
  for (const { marker, bounds } of labelLayers) {
    const nw = map.latLngToContainerPoint(bounds.getNorthWest());
    const se = map.latLngToContainerPoint(bounds.getSouthEast());
    const widthPx = Math.abs(se.x - nw.x);
    const heightPx = Math.abs(se.y - nw.y);
    marker.setOpacity(widthPx >= MIN_LABEL_WIDTH_PX && heightPx >= MIN_LABEL_HEIGHT_PX ? 1 : 0);
  }
}

// A4's own popup wording, per stage -- deliberately SHORT, natural-language
// descriptors distinct from the existing, more verbose HEADLINE_LABEL/ks5HeadlineLabel
// strings used elsewhere (Rankings' "Latest results" tile, Graphs captions) --
// scoped to this popup specifically, matching Guy's own worked examples verbatim
// ("pupils entered for KS2 tests", "met expected standard", "Attainment 8 average",
// "average UCAS points"). Rankings' own "Latest results" tile deliberately reuses the
// EXISTING (verbose) labels unchanged, per that tile's own worked example -- these
// two are NOT a global rename, just this popup's own real copy. TREND_STAT_LABEL is
// DIFFERENT: Part C's own Trend-tile example quotes A4's short wording verbatim, so
// that one lives in academic-data-view.ts, shared by both this popup and Rankings.
const ENTRIES_NOUN: Record<KsStage, string> = {
  ks2: "pupils entered for KS2 tests",
  ks4: "pupils entered for GCSEs",
  ks5: "pupils entered for Post-16 exams",
};
const HEADLINE_STAT_LABEL: Record<KsStage, string> = {
  ks2: "met expected standard",
  ks4: "Attainment 8 average",
  ks5: "average UCAS points",
};

// Map round 2, item 3: same measured-gap title-carve-out convention as MapView.tsx's
// own TrendColourKey -- see this file's own trendKeyBox measurement effect for the box
// this height is subtracted from.
const TREND_KEY_TITLE_HEIGHT = 16;

function TrendColourKey({ box, title }: { box: { top: number; height: number } | null; title: string }) {
  if (!box) return null;
  const stops = TREND_LEGEND_STOPS; // ascending by pct: -30 (red) ... 0 (amber) ... +30 (green)
  const min = stops[0].pct;
  const max = stops[stops.length - 1].pct;
  const gradient = [...stops].reverse().map((s) => s.hex).join(",");
  const barHeight = Math.max(0, box.height - TREND_KEY_TITLE_HEIGHT);
  return (
    <div className="absolute right-[10px] z-[1000] w-[52px]" style={{ top: box.top }}>
      <p className="mb-0.5 text-right text-[9px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" style={{ height: TREND_KEY_TITLE_HEIGHT }}>
        {title}
      </p>
      <div className="relative ml-auto w-[26px] rounded-sm shadow-sm" style={{ height: barHeight, background: `linear-gradient(to bottom, ${gradient})` }}>
        {stops.map((s) => {
          const t = (max - s.pct) / (max - min);
          return (
            <div key={s.pct} className="absolute inset-x-0" style={{ top: `${t * 100}%` }}>
              <div className="h-px w-full bg-white/80" />
              <span className="absolute right-full top-1/2 mr-1 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[9px] text-neutral-600 shadow-sm dark:bg-neutral-950/90 dark:text-neutral-300">
                {s.pct > 0 ? `+${s.pct}%` : `${s.pct}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A2: grade band's own real, separate, VALUE-based key -- real min/mid/max VALUES of
// the CURRENT comparison set (not the old fixed 20/40/50/60/80% scale, which only
// ever meant anything for a 0-100 percentage centred on 50). Uses the new sequential
// blue palette (trend-colours.ts's gradeBandColour/GRADE_BAND_LEGEND_STOPS), a
// genuinely different scale from Trend's diverging red-green one, not a relabelling
// of it.
//
// Map round 4, per Guy's direct instruction (2026-09-14): Grade band at
// subject-category scope now colours "to match the subject category," not the
// generic whole-school blue -- `stops` is optional so this SAME legend component
// (position/shape/label logic all unchanged) can render either ramp, just fed a
// different 5-stop gradient (subject-family-colours.ts's own
// gradeBandLegendStopsForFamily, same shape as GRADE_BAND_LEGEND_STOPS) rather than
// forking a second copy of this component.
function GradeBandColourKey({ box, min, max, stage, stops = GRADE_BAND_LEGEND_STOPS }: { box: { top: number; height: number } | null; min: number; max: number; stage: KsStage; stops?: { t: number; hex: string }[] }) {
  if (!box) return null;
  const gradient = [...stops].reverse().map((s) => s.hex).join(",");
  const barHeight = Math.max(0, box.height - TREND_KEY_TITLE_HEIGHT);
  const mid = min + (max - min) / 2;
  const labelStops = [
    { t: 0, value: max },
    { t: 0.5, value: mid },
    { t: 1, value: min },
  ];
  return (
    // Colour bug round, item 3: confirmed by measuring the real rendered title --
    // "GRADE BAND" (uppercase + tracking-wide adds real letter-spacing) at 9px in
    // the old 56px-wide box genuinely doesn't fit on one line, wraps, and the title
    // `<p>`'s own FIXED height (TREND_KEY_TITLE_HEIGHT, shared with Trend's own
    // single-word key) doesn't clip the overflow -- the second line pushes straight
    // down into the gradient bar, exactly as reported. Fixed both ways at once
    // (belt and braces, not either/or): `whitespace-nowrap` makes a second line
    // structurally impossible rather than just reserving more room for one, and the
    // box is widened further (56px -> 68px) so the single line has real room next
    // to Trend's own narrower key, not just barely fitting.
    <div className="absolute right-[10px] z-[1000] w-[68px]" style={{ top: box.top }}>
      <p className="mb-0.5 whitespace-nowrap text-right text-[9px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" style={{ height: TREND_KEY_TITLE_HEIGHT }}>
        Grade band
      </p>
      <div className="relative ml-auto w-[26px] rounded-sm shadow-sm" style={{ height: barHeight, background: `linear-gradient(to bottom, ${gradient})` }}>
        {labelStops.map((s) => (
          <div key={s.t} className="absolute inset-x-0" style={{ top: `${s.t * 100}%` }}>
            <div className="h-px w-full bg-white/80" />
            <span className="absolute right-full top-1/2 mr-1 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[9px] text-neutral-600 shadow-sm dark:bg-neutral-950/90 dark:text-neutral-300">
              {formatHeadlineValue(stage, s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Map round 2, item 4: same real three-representative-sizes scale box as MapView.tsx's
// own SizeLegend, reusing radiusFor's own min/max (hoisted to render time below, shared
// with the drawing effect, not recomputed separately).
function SizeLegend({ minSize, maxSize, familyId, familyLabel, sizeCaption }: { minSize: number; maxSize: number; familyId: string | null; familyLabel: string | null; sizeCaption: string }) {
  const hasRange = maxSize > minSize;
  const steps = hasRange
    ? [minSize, Math.round((minSize + maxSize) / 2), maxSize].map((v) => ({ v, r: radiusFor(v, minSize, maxSize) }))
    : [{ v: maxSize, r: (MIN_RADIUS + MAX_RADIUS) / 2 }];
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dot size</h3>
      <div className="flex items-end gap-3">
        {steps.map((s) => (
          <div key={s.v} className="flex flex-col items-center gap-1">
            <span className="rounded-full bg-neutral-400" style={{ width: s.r * 2, height: s.r * 2 }} />
            <span className="text-xs text-neutral-500">{s.v.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">{familyId ? `Entries in ${familyLabel ?? "this category"}` : sizeCaption}</p>
    </div>
  );
}

type ColourMode = "trend" | "grade_band";

// Real per-profile figures, computed ONCE per render (useMemo below) and shared by
// the rank computation, the min-max normalisation (size AND grade band), the SizeLegend/
// GradeBandColourKey, and the marker-drawing effect itself -- "computed once, shared,
// not recomputed twice," same discipline round 2's own minSize/maxSize hoisting
// established, now extended to every other per-marker figure this round adds.
type RowData = {
  avgValue: number | null;
  avgPeriod: number | null;
  anchorValue: number | null;
  entriesValue: number | null;
  entriesPeriod: number | null;
  size: number | null;
};

export default function AcademicMapView({
  targetProfile,
  tickedProfiles,
  stage,
  familyId = null,
  familyLabel = null,
  activeSetLabel = null,
  ks4ExcludedUrns = EMPTY_EXCLUDED_SET,
  ks5Bucket = null,
  ks5ExcludedUrns = EMPTY_EXCLUDED_SET,
  activeView,
  onChangeView,
  authToken = null,
  isRegionOrNationScope = false,
  activeRegionName = null,
}: {
  targetProfile: AcademicSchoolProfile;
  tickedProfiles: AcademicSchoolProfile[];
  stage: KsStage;
  // Round 2, Part B: family-level depth (spec §3b) -- circle size becomes real
  // entries_total for this family, colour becomes trend in avgPointScore since
  // baseline. Grade-band colour mode stays headline-only (the original brief's own
  // explicit deferral -- a real, separate aggregation this round doesn't add), so it's
  // simply not offered at all once a family is selected, rather than silently
  // rendering nothing useful.
  familyId?: string | null;
  familyLabel?: string | null;
  activeSetLabel?: string | null;
  // GCSE exclusion round, Part 2 -- see AcademicGraphsView's own header comment for
  // the same prop. An excluded school (target or ticked) gets no circle at all, KS4
  // only -- empty whenever stage !== "ks4".
  ks4ExcludedUrns?: Set<string>;
  // KS5 qualification-type-awareness round, Part 4: which real cohort the map's
  // headline-level colour/tooltip (and exclusion) is keyed on -- ignored entirely at
  // family level (family colour is always avgPointScore trend, per Round 2 Part B
  // above) and whenever stage !== "ks5". Item 10: null is the real default now --
  // each circle then uses ITS OWN dominant real cohort (ks5MeasureFor), not one
  // shared measure across a mixed group.
  ks5Bucket?: Ks5Bucket | null;
  ks5ExcludedUrns?: Set<string>;
  // Stage 2 UX review, item 6: this map now renders its own ViewSwitcher/
  // PdfExportButton overlays (matching Rolls' MapView.tsx exactly), since
  // AcademicDataView's own in-flow header row skips them for Map -- needs the same
  // controlled active/onChange pair that row already threads through.
  activeView: ViewKey;
  onChangeView: (v: ViewKey) => void;
  // LA/Region choropleth: the real bearer token the new academic-region-choropleth/
  // academic-la-choropleth routes need (same membership-gated pattern every other
  // Academic fetch already uses) -- this component didn't previously do any fetching
  // of its own at all (every other real figure arrives as already-fetched props), so
  // this is a genuinely new requirement, not an existing prop repurposed.
  authToken?: string | null;
  // Region/Nation comparator round 2: mirrors Rolls' own MapView.tsx exactly (see that
  // component's own isRegionOrNationScope prop) -- true once the active comparator set
  // is a real Region/Nation-scale recipe AND past DataViewShell's own
  // LARGE_SET_PROFILE_THRESHOLD. Forces "View by area" on (round 1's own manual toggle)
  // and hides the toggle entirely while forced, the same real "no manual escape back to
  // individual markers at this scale" behaviour Rolls' own map already has -- there was
  // simply no toggle to hide there (Rolls' point map and choropleth are two branches of
  // one component, not a user-facing control), so hiding it here is the real Academic-
  // side equivalent, not a literal copy of a UI element that doesn't exist on the other
  // side.
  isRegionOrNationScope?: boolean;
  // Real bug found live (Guy, 2026-09-14): "region map should load at region level
  // showing local authorities in that region only (currently opens at national view
  // and needs to zoom in)". Region/Nation-scale sets are always anchored to the
  // target school's own region (same real convention region-la-choropleth's own
  // server-side resolveTargetRegionNation(urn) already establishes for Rolls) -- the
  // exact real region NAME (academic_region_nation_rank's own resolved regionName,
  // threaded down from AcademicDataView), null for Nation scope or when not yet
  // resolved. Filters the LA tier to just this region's own LAs and defaults the
  // initial choropleth view straight to that filtered LA tier, instead of the
  // national 9-region overview a Region-scale member never actually wants first.
  activeRegionName?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const topRightStackRef = useRef<HTMLDivElement | null>(null);
  // LA/Region choropleth: a SEPARATE layer group from the point map's own
  // layerGroupRef (ring + circleMarkers) -- only one of the two is ever attached to
  // the map at a time (swapped in the drawing effects below), same "separate group,
  // swap which is attached" pattern Rolls' own MapView.tsx already established for
  // its clustered-vs-unclustered schools groups.
  const choroplethGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const choroplethLabelLayersRef = useRef<{ marker: import("leaflet").Marker; bounds: import("leaflet").LatLngBounds }[]>([]);
  // Fit-to-bounds happens once per "View by area" session (turning the toggle on, or
  // a real stage change while it's on), never on every zoom/pan -- an auto-fit there
  // would fight the member's own manual zoom gesture, same reasoning as Rolls' own
  // nationChoroplethEverFitRef.
  const choroplethEverFitRef = useRef(false);
  // Map round 2, item 1: real root cause of "map blank in Trend mode until you toggle
  // Grade band and back" -- see the mount effect below. A real React state (not just a
  // ref) so setting it forces a guaranteed extra render/effect-run once the map
  // finishes its own async init, ported directly from Rolls' own MapView.tsx.
  const [mapReady, setMapReady] = useState(false);
  const [trendKeyBox, setTrendKeyBox] = useState<{ top: number; height: number } | null>(null);
  // A3: default stays Grade band (round 2, item 6 already made this the default;
  // unchanged this round). A5's own fix (below) means this default now genuinely
  // WORKS for Post-16 too, not just KS2/GCSE.
  const [colourMode, setColourMode] = useState<ColourMode>("grade_band");
  // A5's real fix: grade band is available whenever there's a real headline/family
  // series to colour by at all -- i.e. always, except at family level (which has its
  // own separate, single, always-available trend-only colour concept, Round 2 Part B
  // above -- a real, distinct scope decision, not touched this round). The OLD gate
  // (`stage !== "ks5" || ks5Bucket === "A level"`) forced Post-16 into Trend-only
  // for its own real default state (ks5Bucket === null) and every cohort except
  // "A level" -- see this file's own header comment and the build report for the
  // real root cause and why it's fixed this way, not by loosening the gate a little.
  //
  // Map round 4, per Guy's direct live feedback (2026-09-14): "when the subject
  // category is selected... we need... grade band view as per whole school view...
  // and trends view as whole school view." Grade band used to be force-disabled at
  // family level (the toggle itself was hidden, not just defaulted away) -- the
  // real data it needs (data.avgValue, rowDataByUrn below) was ALREADY being
  // populated from the family series in that case, so there was no real data gap
  // forcing this, just a UI gate left over from before family-level colouring
  // existed. Grade band is now available at every scope; only its COLOUR ramp
  // differs by scope (gradeBandColourForFamily below), not its availability.
  const gradeBandAvailable = true;
  const effectiveColourMode: ColourMode = colourMode;

  // LA/Region choropleth: independent of ticked schools entirely. Only ever available
  // whole-school (no familyId -- this round's own real scope, see this file's own
  // header comment) and never at KS2 (academic_geography_aggregate has no real KS2
  // data at all, confirmed at that table's own creation -- the RPC wrapper's own
  // KsStage type already only accepts ks4/ks5, so this gate matches a real,
  // structural constraint, not an arbitrary one).
  //
  // Live feedback (Guy, 2026-09-14): "this should not need a button -- we only view
  // choropleths for region and country maps which are triggered by the buttons in
  // the left column." Round 1's own standalone manual toggle is removed -- it was
  // always a deliberate stopgap for the one thing round 2 explicitly built afterward
  // (that round's own brief: "Rolls' choropleth only ever appears because a
  // Region/Nation-scale comparator SET is active -- that mechanism doesn't exist for
  // Academic this round," i.e. round 1). Now that it does, viewByArea is a plain
  // derived value, exactly mirroring Rolls' own MapView.tsx (no manual toggle there
  // either, no separate state to keep in sync with the real trigger) -- no button, no
  // state, no auto-on/auto-off effects to keep synchronised with each other.
  const viewByAreaAvailable = !familyId && stage !== "ks2";
  const viewByArea = isRegionOrNationScope && viewByAreaAvailable;
  // Real bug found live (Guy, 2026-09-14): see activeRegionName's own comment above.
  // Tracks whether this session has already defaulted the tier to "la" for a Region-
  // scale set, so the zoom-driven tier switch (below) stays free to move the member
  // between tiers afterward without this effect fighting it back to "la" on every
  // render.
  const tierDefaultedForSessionRef = useRef(false);
  // Zoom-driven, same real mechanism as Rolls' own Nation-scope region<->LA switch --
  // starts at the region tier (the real national overview), drills to LA detail once
  // the member zooms in near a specific region.
  const [choroplethTier, setChoroplethTier] = useState<"region" | "la">("region");
  const [choroplethData, setChoroplethData] = useState<{ region: AcademicGeographyChoroplethEntry[]; la: AcademicGeographyChoroplethEntry[] } | null>(null);
  const [choroplethLoading, setChoroplethLoading] = useState(false);

  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  // The map has no separate "this school" callout the way Overview/Rankings do, so an
  // excluded target's own circle is dropped the same way an excluded ticked school's
  // is -- both named together in the one legend note below.
  const excludedForMap = group.filter((p) => ks4ExcludedUrns.has(p.urn));
  const mapWholeGroupExcluded = stage === "ks4" && group.length > 0 && excludedForMap.length === group.length;
  // KS5 qualification-type-awareness round, Part 4: same real "leave incomparable
  // schools out, with a visible note" pattern, keyed on the selected cohort instead
  // of GCSE/IGCSE. Both exclusion sets are computed by the parent gated to their own
  // stage, so only one is ever non-empty for a given render.
  const ks5ExcludedForMap = group.filter((p) => ks5ExcludedUrns.has(p.urn));
  const mapKs5WholeGroupExcluded = stage === "ks5" && group.length > 0 && ks5ExcludedForMap.length === group.length;
  const withCoords = group.filter(
    (p) => p.easting !== null && p.northing !== null && !ks4ExcludedUrns.has(p.urn) && !ks5ExcludedUrns.has(p.urn),
  );
  const setLabel = activeSetLabel ?? "the ticked comparator set";

  // Round 3: every per-profile real figure this map needs, computed once per real
  // profile -- shared by the rank computation (A4), the min-max normalisation for
  // size AND grade band (A1/A2), the two legends, and the marker-drawing effect
  // itself, rather than each recomputing its own copy.
  const rowDataByUrn = useMemo(() => {
    const age = HEADLINE_AGE[stage];
    const baseline = TREND_BASELINE_PERIOD[stage];
    const measureKey = stage === "ks5" && ks5Bucket ? ks5BucketMeasureKey(ks5Bucket) : HEADLINE_MEASURE[stage];
    const map = new Map<string, RowData>();
    for (const p of withCoords) {
      if (familyId) {
        const fy = latestFamilyYear(p, stage, familyId);
        const years = familyYearsFor(p, stage, familyId);
        const anchor = years.find((y) => y.period === baseline)?.avgPointScore ?? null;
        map.set(p.urn, {
          avgValue: fy?.avgPointScore ?? null,
          avgPeriod: fy?.period ?? null,
          anchorValue: anchor,
          entriesValue: fy?.entriesTotal ?? null,
          entriesPeriod: fy?.period ?? null,
          size: fy?.entriesTotal ?? null,
        });
        continue;
      }
      const rowKs5 = stage === "ks5" ? ks5BucketMeasureFor(p, ks5Bucket) : null;
      const rowMeasureKey = rowKs5 ? rowKs5.measureKey : measureKey;
      const years = stageYears(p, stage);
      const headline = latestMeasureAt(years, rowMeasureKey);
      const anchor = headlineValueAt(years, baseline, rowMeasureKey);
      const entries = stage === "ks2" ? null : latestEntriesCount(p, stage, ks5Bucket);
      const size = stage === "ks2" ? populationAtAge(p, age) : (entries?.value ?? null);

      // Map colour bug round, items 1-2's real fix: grade band's colour source is
      // now the SAME real value the popup/Rankings/Overview already show
      // (`headline`, resolved via rowMeasureKey exactly as A5's own per-cohort
      // fallback already did) -- there is no separate `gradeValue` any more. This
      // drops the standalone `GRADE_BAND_MEASURE` "higher bar" threshold idea from
      // the map's colour mode entirely (a real, deliberate product change -- see
      // this round's own build report for the before/after and why: it was a
      // genuinely different real DfE measure per stage from what's displayed,
      // which is exactly why the colour never tracked the number next to it, and
      // for KS4/KS5 also carried a second, compounding "%" unit-formatting bug
      // that goes away with it since colour and popup now share one real number
      // AND one real unit, everywhere).
      map.set(p.urn, {
        avgValue: headline?.value ?? null,
        avgPeriod: headline?.period ?? null,
        anchorValue: anchor,
        entriesValue: entries?.value ?? null,
        entriesPeriod: entries?.period ?? null,
        size,
      });
    }
    return map;
  }, [withCoords, familyId, stage, ks5Bucket]);

  // Map round 2, item 4 / round 3 A2: hoisted so both legends and the drawing effect
  // share the SAME real min/max, never recomputed twice. Colour bug round, items
  // 1-2: grade band's own min/max is now over the SAME `avgValue` the popup shows
  // (there is no separate grade-band value any more), so the legend's own real
  // scale labels and the circle colours can never disagree about which number
  // they're both scaled against.
  const { minSize, maxSize, minGrade, maxGrade } = useMemo(() => {
    const sizes: number[] = [];
    const grades: number[] = [];
    for (const d of rowDataByUrn.values()) {
      if (d.size !== null && d.size > 0) sizes.push(d.size);
      if (d.avgValue !== null) grades.push(d.avgValue);
    }
    return {
      minSize: sizes.length > 0 ? Math.min(...sizes) : 1,
      maxSize: sizes.length > 0 ? Math.max(...sizes) : 1,
      minGrade: grades.length > 0 ? Math.min(...grades) : 0,
      maxGrade: grades.length > 0 ? Math.max(...grades) : 0,
    };
  }, [rowDataByUrn]);

  // A4: real rank, recomputed against whichever comparison set is currently active
  // (same "recompute against the live set" discipline round 2's own comparator
  // widening established) -- based on the same real headline value already driving
  // the circle's own label, never a cached figure.
  const { ranked: rankedRows, total: rankTotal } = useMemo(
    () =>
      rankDescendingWithTies(
        withCoords.map((p) => ({ urn: p.urn, name: p.name, isTarget: p.urn === targetProfile.urn, value: rowDataByUrn.get(p.urn)?.avgValue ?? null })),
      ),
    [withCoords, rowDataByUrn, targetProfile.urn],
  );
  const rankByUrn = useMemo(() => new Map(rankedRows.map((r) => [r.urn, r.rank])), [rankedRows]);

  // LA/Region choropleth: real fetch, region + LA tiers together (both are cheap --
  // 9 real region rows, ~153 real LA rows nationally -- so both are fetched once
  // when the toggle turns on, or the stage changes while it's on, rather than
  // re-fetching LA detail per region zoomed into the way Rolls' own live per-school
  // rollup has to). The zoom-driven tier switch below is then a pure client-side
  // redraw of already-fetched data, not a second round trip.
  useEffect(() => {
    let cancelled = false;
    // react-hooks/set-state-in-effect: every setState call below (including the
    // early "reset to null" branch) lives inside this one async callback, same real
    // fix round 3's own widening effect already established for this exact rule.
    (async () => {
      if (!viewByArea || !viewByAreaAvailable || !authToken) {
        setChoroplethData(null);
        choroplethEverFitRef.current = false;
        tierDefaultedForSessionRef.current = false;
        return;
      }
      setChoroplethLoading(true);
      choroplethEverFitRef.current = false;
      tierDefaultedForSessionRef.current = false;
      try {
        const headers = { Authorization: `Bearer ${authToken}` };
        const [regionRes, laRes] = await Promise.all([
          fetch(`/api/data-view/academic-region-choropleth?urn=${targetProfile.urn}&ksStage=${stage}`, { headers }),
          fetch(`/api/data-view/academic-la-choropleth?urn=${targetProfile.urn}&ksStage=${stage}`, { headers }),
        ]);
        if (cancelled || !regionRes.ok || !laRes.ok) return;
        const [regionBody, laBody] = await Promise.all([
          regionRes.json() as Promise<{ entries: AcademicGeographyChoroplethEntry[] }>,
          laRes.json() as Promise<{ entries: AcademicGeographyChoroplethEntry[] }>,
        ]);
        if (cancelled) return;
        setChoroplethData({ region: regionBody.entries, la: laBody.entries });
      } catch {
        // Non-fatal -- the choropleth just stays empty/loading, same discipline as
        // every other real fetch in this codebase.
      } finally {
        if (!cancelled) setChoroplethLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewByArea, viewByAreaAvailable, authToken, targetProfile.urn, stage]);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current || targetProfile.easting === null || targetProfile.northing === null) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    import("leaflet").then(async (mod) => {
      if (cancelled || !mapElRef.current) return;
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const [lat, lng] = bngToLatLng(targetProfile.easting!, targetProfile.northing!);
      const map = L.map(mapElRef.current, { center: [lat, lng], zoom: 11, zoomControl: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      // LA/Region choropleth: created but NOT added to the map yet -- only attached
      // once "View by area" is actually on (the drawing effects below swap which of
      // this and layerGroupRef is attached), same "two groups, only one ever on the
      // map" pattern Rolls' own MapView.tsx already established for its own
      // choropleth-vs-dots swap.
      choroplethGroupRef.current = L.layerGroup();
      mapRef.current = map;
      // Map round 2, item 1's real fix: this is what's actually missing before that
      // round. Real bug, reproduced against Yerbury Primary School (URN 100429) --
      // NOT a data-shape throw (checked directly against real data before this fix:
      // every school in Yerbury's own real comparator group computed cleanly). The
      // real mechanism: `L.map()`/the layer group are created asynchronously, inside
      // this `import("leaflet").then()` callback -- before this fix, the ONLY
      // readiness signal was `mapRef.current`/`layerGroupRef.current`, plain refs
      // that don't trigger a re-render when set. The marker-drawing effect below
      // guards on those same refs and returns early if they're still null -- if that
      // effect's FIRST invocation (at mount) loses the race against this async init,
      // NOTHING forced a retry once the refs finally became non-null. `mapReady`
      // closes this gap exactly the way Rolls' own MapView.tsx already does: setting
      // it here is itself a real state update, guaranteeing the drawing effect gets
      // at least one more genuine run once the map is truly ready.
      setMapReady(true);

      // Real bug, stage 1 review: this component is fully unmounted and remounted
      // every time DataViewErrorBoundary's own key changes (activeView/effectiveStage/
      // familyId -- Map <-> Graphs/Rankings, or picking a Category), the same way
      // Rolls' own MapView.tsx is keyed on activeView alone. Leaflet measures its
      // container once at L.map() call time and never re-measures itself -- without
      // this, a remount into a container whose real on-screen size hasn't fully
      // settled yet renders with stale internal tile dimensions (blank/cut-off tiles).
      // Same real fix as MapView.tsx's own 2026-09-05 comment, copied verbatim rather
      // than re-derived.
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(mapElRef.current);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetProfile.urn]);

  // Map round 2, item 3: same real measured-gap technique as MapView.tsx's own
  // trendKeyBox effect -- centred in the actual vertical gap between the top-right
  // control stack and Leaflet's own zoom control, occupying 70% of that gap's height.
  // A3: the control stack now includes the colour-mode toggle again (moved back under
  // PdfExportButton), so its own height genuinely varies with gradeBandAvailable --
  // re-measured on that too, not just effectiveColourMode.
  useEffect(() => {
    if (!mapReady || !mapElRef.current) return;
    const containerEl = mapElRef.current;

    function measure() {
      const zoomEl = containerEl.querySelector<HTMLElement>(".leaflet-control-zoom");
      const stackEl = topRightStackRef.current;
      if (!zoomEl || !stackEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      const stackRect = stackEl.getBoundingClientRect();
      const zoomRect = zoomEl.getBoundingClientRect();
      const availableTop = stackRect.bottom - containerRect.top;
      const availableBottom = zoomRect.top - containerRect.top;
      const availableHeight = availableBottom - availableTop;
      if (availableHeight <= 0) {
        setTrendKeyBox(null);
        return;
      }
      const height = availableHeight * 0.7;
      setTrendKeyBox({ top: availableTop + (availableHeight - height) / 2, height });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerEl);
    if (topRightStackRef.current) ro.observe(topRightStackRef.current);
    return () => ro.disconnect();
  }, [mapReady, effectiveColourMode, gradeBandAvailable]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !layerGroupRef.current || !rootRef.current) return;
    // LA/Region choropleth: the point map (ring + circles) is completely skipped
    // while "View by area" is on -- the choropleth's own drawing effect below owns
    // the map at that point, same "never gets to the individual school level" swap
    // Rolls' own MapView.tsx already applies for Region/Nation scope.
    if (viewByArea) {
      if (mapRef.current.hasLayer(layerGroupRef.current)) mapRef.current.removeLayer(layerGroupRef.current);
      return;
    }
    if (!mapRef.current.hasLayer(layerGroupRef.current)) mapRef.current.addLayer(layerGroupRef.current);
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const group2 = layerGroupRef.current!;
      group2.clearLayers();
      const cs = getComputedStyle(rootRef.current!);

      // Map round 2, item 2: the same real dashed distance ring MapView.tsx draws
      // around the target, in this same always-on layer group. Drawn first so every
      // school marker sits on top of it, same ordering as the reference.
      if (targetProfile.easting !== null && targetProfile.northing !== null) {
        const [targetLat, targetLng] = bngToLatLng(targetProfile.easting, targetProfile.northing);
        const ringKm = targetProfile.establishmentTypeGroup === "Independent schools" ? DISTANCE_RING_KM_INDEPENDENT : DISTANCE_RING_KM_STATE;
        const ringColour = cs.getPropertyValue("--distance-ring").trim() || "#9ca3af";
        L.circle([targetLat, targetLng], {
          radius: ringKm * 1000,
          color: ringColour,
          weight: 1.25,
          dashArray: "4 5",
          fill: false,
          interactive: false,
        }).addTo(group2);
        const [ringLabelLat, ringLabelLng] = bngToLatLng(targetProfile.easting, targetProfile.northing + ringKm * 1000);
        L.marker([ringLabelLat, ringLabelLng], {
          icon: L.divIcon({
            className: "vd-academic-ring-label",
            html: `${ringKm} km`,
            iconSize: [40, 16],
            iconAnchor: [20, 8],
          }),
          interactive: false,
        }).addTo(group2);
      }

      // Item 9: fitBounds to the current visible set, re-run on every comparator-set/
      // exclusion change via this effect's own dependency array.
      const bounds: [number, number][] = [];

      for (const p of withCoords) {
        const data = rowDataByUrn.get(p.urn);
        if (!data) continue;
        const [lat, lng] = bngToLatLng(p.easting!, p.northing!);
        bounds.push([lat, lng]);
        const isTarget = p.urn === targetProfile.urn;
        const radius = data.size !== null && data.size > 0 ? radiusFor(data.size, minSize, maxSize) : UNTICKED_RADIUS;

        let colour = UNTICKED_COLOUR;
        if (effectiveColourMode === "trend") {
          const badge = trendBadge(data.avgValue, data.anchorValue);
          if (badge) colour = trendColour(badge.pctChange);
        } else if (data.avgValue !== null) {
          // Map round 4: family scope now colours "to match the subject category"
          // (subject-family-colours.ts's own ramp, anchored on that category's site-
          // wide colour) instead of the generic whole-school blue -- same real
          // min-max normalisation either way, gradeBandColour/gradeBandColourForFamily
          // just differ in which hue they interpolate through.
          colour = familyId ? gradeBandColourForFamily(data.avgValue, minGrade, maxGrade, familyId) : gradeBandColour(data.avgValue, minGrade, maxGrade);
        }

        // A4: real popup rewrite -- bold key numbers, one stat per line, a real date
        // on every quoted figure (each stat's own real latest year, independently --
        // see latestMeasureAt/latestEntriesCount's own comment for why these can
        // genuinely differ), a real rank on the grade-band popup, and the shared
        // noun-form growth/decline wording (trend-labels.ts) on the trend popup.
        const lines: string[] = [];
        if (familyId) {
          if (data.entriesValue !== null) lines.push(`<strong>${data.entriesValue.toLocaleString()}</strong> entries in ${escapeHtml(familyLabel ?? "this category")}${data.entriesPeriod !== null ? ` (${academicYearLabel(data.entriesPeriod)})` : ""}`);
          if (data.avgValue !== null) lines.push(`<strong>${data.avgValue.toFixed(1)}</strong> avg. point score${data.avgPeriod !== null ? ` (${academicYearLabel(data.avgPeriod)})` : ""}`);
        } else if (effectiveColourMode === "grade_band") {
          if (data.entriesValue !== null) {
            lines.push(`<strong>${Math.round(data.entriesValue).toLocaleString()}</strong> ${ENTRIES_NOUN[stage]}${data.entriesPeriod !== null ? ` (${academicYearLabel(data.entriesPeriod)})` : ""}`);
          }
          if (data.avgValue !== null) {
            const rank = rankByUrn.get(p.urn);
            const rankText = rank !== undefined ? `, #${rank} of ${rankTotal} compared schools` : "";
            lines.push(`<strong>${formatHeadlineValue(stage, data.avgValue)}</strong> ${HEADLINE_STAT_LABEL[stage]}${data.avgPeriod !== null ? ` (${academicYearLabel(data.avgPeriod)})` : ""}${rankText}`);
          }
        } else {
          // Map colour bug round, item 4: one shared computation (trendWordingFor,
          // academic-data-view.ts) decides pp-vs-ratio wording and computes it --
          // no local direction/magnitude split here any more, so this popup and
          // Rankings' Trend tile can't disagree about which word goes with which
          // number.
          const wording = trendWordingFor(stage, data.avgValue, data.anchorValue);
          if (wording) {
            const sign = wording.magnitude.value > 0 ? "+" : "";
            lines.push(`${wording.label} <strong>${sign}${wording.magnitude.value.toFixed(0)}${wording.magnitude.unit}</strong> in ${TREND_STAT_LABEL[stage]} since ${academicYearLabel(TREND_BASELINE_PERIOD[stage])}`);
          } else {
            lines.push(`No real ${academicYearLabel(TREND_BASELINE_PERIOD[stage])} comparison`);
          }
        }
        const tooltipHtml = `<div style="font-size:12px"><strong>${escapeHtml(p.name)}${isTarget ? " (this school)" : ""}</strong>${
          lines.length > 0 ? `<br/>${lines.join("<br/>")}` : ""
        }</div>`;

        L.circleMarker([lat, lng], {
          radius,
          fillColor: colour,
          fillOpacity: 0.75,
          color: isTarget ? "#dc2626" : "#ffffff",
          weight: isTarget ? 2.5 : 1,
        })
          .bindTooltip(tooltipHtml, { direction: "top", offset: [0, -4] })
          .addTo(group2);
      }

      if (bounds.length > 1) {
        mapRef.current!.fitBounds(trimmedBoundsFor(bounds), { padding: [40, 40], maxZoom: 13 });
      }
    });
  }, [mapReady, viewByArea, withCoords, rowDataByUrn, minSize, maxSize, minGrade, maxGrade, rankByUrn, rankTotal, effectiveColourMode, familyId, familyLabel, stage, targetProfile.urn, targetProfile.easting, targetProfile.northing, targetProfile.establishmentTypeGroup]);

  // LA/Region choropleth: real min/max over the CURRENTLY SHOWN tier's own real
  // values -- same "computed once, shared" discipline as minGrade/maxGrade above,
  // recomputed whenever the tier or the underlying fetched data changes.
  // Real bug found live (Guy, 2026-09-14): while a Region-scale set is active, the LA
  // tier shows ONLY that region's own LAs -- filtered client-side (resolveRegionNation,
  // already a real, proven, client-safe pure lookup -- confirmed no server-only
  // imports before reusing it here) against the already-fetched national LA data,
  // rather than a second, region-scoped server round-trip. Nation-scale sets
  // (activeRegionName null) keep showing every real LA at this tier, unchanged.
  const choroplethEntries = useMemo(() => {
    const raw = choroplethTier === "region" ? (choroplethData?.region ?? []) : (choroplethData?.la ?? []);
    if (choroplethTier === "la" && activeRegionName) {
      return raw.filter((e) => resolveRegionNation(e.name).regionName === activeRegionName);
    }
    return raw;
  }, [choroplethTier, choroplethData, activeRegionName]);
  const { choroplethMin, choroplethMax } = useMemo(() => {
    const values = choroplethEntries.map((e) => e.avgValue).filter((v): v is number => v !== null);
    return { choroplethMin: values.length > 0 ? Math.min(...values) : 0, choroplethMax: values.length > 0 ? Math.max(...values) : 0 };
  }, [choroplethEntries]);

  // LA/Region choropleth: zoom-driven tier switch, same real threshold/mechanism as
  // Rolls' own Nation-scope region<->LA drill -- re-registered only when the toggle
  // itself changes (rare), reads the live Leaflet map's own current zoom directly on
  // every call, no stale-closure risk.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !viewByArea) return;
    const map = mapRef.current;
    function handleZoomOrMove() {
      setChoroplethTier(map.getZoom() >= CHOROPLETH_REGION_LA_ZOOM_THRESHOLD ? "la" : "region");
    }
    handleZoomOrMove();
    map.on("zoomend moveend", handleZoomOrMove);
    return () => {
      map.off("zoomend moveend", handleZoomOrMove);
    };
  }, [mapReady, viewByArea]);

  // Real bug found live (Guy, 2026-09-14): defaults straight to the LA tier, once,
  // the moment a Region-scale set's own region name resolves -- without this, the
  // zoom-driven effect just above always starts a fresh "View by area" session at
  // the region tier (the real national 9-region overview), which is the wrong
  // starting point for "I've already picked South East, show me South East" -- the
  // member had to manually zoom in every time. Guarded by tierDefaultedForSessionRef
  // so it only fires once per session, leaving the zoom-driven switch free to move
  // the member between tiers afterward.
  useEffect(() => {
    if (viewByArea && activeRegionName && !tierDefaultedForSessionRef.current) {
      setChoroplethTier("la");
      tierDefaultedForSessionRef.current = true;
    }
  }, [viewByArea, activeRegionName]);

  // LA/Region choropleth: re-sweeps real label visibility on every zoom/pan -- reads
  // choroplethLabelLayersRef live, same real mechanism as MapView.tsx's own
  // equivalent effect.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !viewByArea) return;
    const map = mapRef.current;
    function handleZoomOrMove() {
      sweepChoroplethLabelVisibility(map, choroplethLabelLayersRef.current);
    }
    map.on("zoomend moveend", handleZoomOrMove);
    return () => {
      map.off("zoomend moveend", handleZoomOrMove);
    };
  }, [mapReady, viewByArea]);

  // LA/Region choropleth: the actual real drawing pass -- geoJSON polygons, coloured
  // by gradeBandColour (SAME real colour language the point map's own Grade band
  // mode uses, real min-max normalised to whichever tier is currently shown, not a
  // third scale), with the SAME real permanent name-label convention
  // (vd-choropleth-label) and label-visibility sweep MapView.tsx's own choropleth
  // already established.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !choroplethGroupRef.current || !rootRef.current) return;
    const map = mapRef.current;
    const group = choroplethGroupRef.current;
    if (!viewByArea) {
      if (map.hasLayer(group)) map.removeLayer(group);
      group.clearLayers();
      choroplethLabelLayersRef.current = [];
      return;
    }
    if (!choroplethData) return; // still loading -- nothing real to draw yet

    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      group.clearLayers();
      if (!map.hasLayer(group)) map.addLayer(group);
      choroplethLabelLayersRef.current = [];

      const boundPoints: [number, number][] = [];
      for (const entry of choroplethEntries) {
        if (!entry.geometry) continue;
        const hasData = entry.avgValue !== null;
        const fillColour = hasData ? gradeBandColour(entry.avgValue!, choroplethMin, choroplethMax) : "#9ca3af";

        const statLabel = hasData
          ? `${formatHeadlineValue(stage, entry.avgValue!)} ${HEADLINE_STAT_LABEL[stage]} — ${entry.schoolCount} real schools${entry.period !== null ? `, ${academicYearLabel(entry.period)}` : ""}`
          : "No real data for this area yet";
        const clickHint = choroplethTier === "region" ? "<br/><em>click to zoom in</em>" : "";
        const tooltipHtml = `<div style="font-size:12px"><strong>${escapeHtml(entry.name)}</strong><br/>${statLabel}${clickHint}</div>`;

        const layer = L.geoJSON(entry.geometry, {
          style: {
            color: hasData ? "#ffffff" : "#9ca3af",
            weight: 1,
            fillColor: fillColour,
            fillOpacity: hasData ? 0.75 : 0.35,
            dashArray: hasData ? undefined : "3 3",
          },
        });
        layer.bindTooltip(tooltipHtml, { sticky: true });
        if (choroplethTier === "region") {
          // Region click zooms in on that region -- the natural way to reach LA
          // detail for it, since this round has no per-region comparator SET to
          // click-through to (that's round 2's own scope, not built here). Crossing
          // CHOROPLETH_REGION_LA_ZOOM_THRESHOLD this way flips the tier automatically
          // via the zoom-driven effect above, no special-casing needed here.
          const b = layer.getBounds();
          layer.on("click", () => {
            if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
          });
          layer.eachLayer((l) => {
            (l as unknown as { getElement?: () => SVGElement | null }).getElement?.()?.style.setProperty("cursor", "pointer");
          });
        }
        layer.addTo(group);

        const b = layer.getBounds();
        if (b.isValid()) {
          boundPoints.push([b.getSouthWest().lat, b.getSouthWest().lng], [b.getNorthEast().lat, b.getNorthEast().lng]);
          const labelMarker = L.marker(b.getCenter(), {
            icon: L.divIcon({
              className: "vd-choropleth-label-icon",
              html: `<div class="vd-choropleth-label">${escapeHtml(entry.name)}</div>`,
              iconSize: [0, 0],
            }),
            interactive: false,
            opacity: 0,
          });
          labelMarker.addTo(group);
          choroplethLabelLayersRef.current.push({ marker: labelMarker, bounds: b });
        }
      }

      // Fit once per real "View by area" session (turning the toggle on, or a real
      // stage change while it's on -- reset by the fetch effect above), never on
      // every zoom/tier-switch, which would fight the member's own zoom gesture.
      if (!choroplethEverFitRef.current && boundPoints.length > 1) {
        map.fitBounds(boundPoints, { padding: [40, 40] });
        choroplethEverFitRef.current = true;
      }
      sweepChoroplethLabelVisibility(map, choroplethLabelLayersRef.current);
    });
  }, [mapReady, viewByArea, choroplethData, choroplethTier, choroplethEntries, choroplethMin, choroplethMax, stage]);

  const sizeCaption = stage === "ks2" ? `${HEADLINE_AGE.ks2}-year-olds` : stage === "ks4" ? "pupils entered for GCSEs" : ks5Bucket ? `${KS5_BUCKET_LABEL[ks5Bucket]} entries` : "pupils entered for Post-16 exams";

  return (
    <div ref={rootRef} className="vd-academic-map relative h-full w-full">
      <style>{`
        .vd-academic-map { --distance-ring: #9ca3af; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-academic-map { --distance-ring: #6b7280; }
        }
        :root[data-theme="dark"] .vd-academic-map { --distance-ring: #6b7280; }
        .vd-academic-ring-label {
          font-size: 10px; font-weight: 600; color: var(--distance-ring);
          text-align: center; white-space: nowrap; background: transparent;
        }
        /* LA/Region choropleth: same real "always visible, not hover-only" polygon
           name-label convention as MapView.tsx's own .vd-choropleth-label -- same
           class name, deliberately, so this reads as the same real component family
           rather than a lookalike with its own styling. */
        .vd-academic-map { --label-bg: #fff; --label-fg: #171717; --choropleth-label-bg: rgba(255,255,255,0.88); }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-academic-map { --label-bg: #171717; --label-fg: #fafafa; --choropleth-label-bg: rgba(23,23,23,0.85); }
        }
        :root[data-theme="dark"] .vd-academic-map { --label-bg: #171717; --label-fg: #fafafa; --choropleth-label-bg: rgba(23,23,23,0.85); }
        .vd-choropleth-label {
          /* Live bug fix, same real root cause as MapView.tsx's own identical class
             (found live, "strange 1-character white-on-black label, no function") --
             see that file's own comment for the full explanation: without
             display: inline-block, this block div's width collapsed to its 0x0
             icon container's own width instead of its real text content.
          */
          display: inline-block;
          font-size: 10px; font-weight: 600; color: var(--label-fg); background: var(--choropleth-label-bg);
          border-radius: 3px; padding: 0px 4px; max-width: 90px; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; pointer-events: none;
          transform: translate(-50%, -50%);
        }
      `}</style>
      <div ref={mapElRef} className="h-full w-full" />

      {/* A3: colour-mode toggle moved back to the RIGHT overlay, under
          PdfExportButton -- Rolls' own real Trend/Sector toggle position
          (topRightStackRef, MapView.tsx). Round 2 had moved it to the left
          overlay; that turned out not to match Rolls' actual layout once seen
          live, so this supersedes it. Order reversed too: Grade band first,
          then "Trends" (plural, matching the noun form used everywhere else). */}
      <div className="absolute left-3 top-3 z-[1000] rounded-md bg-white shadow-sm dark:bg-neutral-950">
        <ViewSwitcher active={activeView} onChange={onChangeView} />
      </div>

      <div ref={topRightStackRef} className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        <div className="rounded-md bg-white shadow-sm dark:bg-neutral-950">
          <PdfExportButton />
        </div>
        {/* Live feedback (Guy, 2026-09-14): the standalone "View by area" toggle is
            removed entirely -- the choropleth now only ever appears the same way
            Rolls' own map's does, via a real Region/Nation-scale set picked from the
            left-column comparator sidebar (isRegionOrNationScope, viewByArea's own
            derivation above), never a manual button. */}
        {/* Grade band/Trends only means anything for individual school circles --
            hidden while the choropleth (always value-coloured, no separate trend
            concept fetched this round) has taken over the map. */}
        {!viewByArea && gradeBandAvailable && (
          <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <button
              type="button"
              onClick={() => setColourMode("grade_band")}
              className={colourMode === "grade_band" ? "rounded bg-neutral-900 px-2 py-1 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900" : "rounded px-2 py-1 text-neutral-600 dark:text-neutral-400"}
            >
              Grade band
            </button>
            <button
              type="button"
              onClick={() => setColourMode("trend")}
              className={colourMode === "trend" ? "rounded bg-neutral-900 px-2 py-1 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900" : "rounded px-2 py-1 text-neutral-600 dark:text-neutral-400"}
            >
              Trends
            </button>
          </div>
        )}
      </div>

      {/* Item 3 (round 2) / A2 (round 3): colour legend at the same right-of-map,
          measured-gap position Rolls' own map uses, with real scale labels -- no
          explanatory paragraph. LA/Region choropleth: reuses the SAME GradeBandColourKey
          component while active, just scaled to the current tier's own real min-max --
          the same real colour language throughout, never a third scale. */}
      {viewByArea ? (
        <GradeBandColourKey box={trendKeyBox} min={choroplethMin} max={choroplethMax} stage={stage} />
      ) : effectiveColourMode === "trend" ? (
        <TrendColourKey box={trendKeyBox} title="Growth" />
      ) : (
        <GradeBandColourKey box={trendKeyBox} min={minGrade} max={maxGrade} stage={stage} stops={familyId ? gradeBandLegendStopsForFamily(familyId) : undefined} />
      )}

      {/* Real bug found live (Guy, 2026-09-14): the choropleth's own fetch (region +
          LA aggregates, plus every real polygon boundary) can genuinely take a
          while, and the only loading affordance was a small, easy-to-miss corner
          caption while the map underneath sat visibly blank -- felt broken/stuck
          rather than "working on it." Same real full-cover spinner MapView.tsx/
          DataViewShell.tsx already use for their own loading states (LoadingSpinnerCard),
          reused directly rather than a third loading pattern. Speeding up the fetch
          itself is a separate, later piece of work -- this only makes the wait legible. */}
      {viewByArea && choroplethLoading && !choroplethData && (
        <LoadingSpinnerCard label={`Loading real ${choroplethTier === "region" ? "region" : "local authority"} data…`} />
      )}

      {viewByArea ? (
        // LA/Region choropleth: a real caption instead of the point map's own
        // Dot-size/exclusion-note stack (neither applies to polygons) -- which real
        // tier is showing, how many real areas have data, and a real loading state
        // rather than a silently-blank map while the fetch is in flight.
        <div className="absolute bottom-3 left-3 z-[1000] max-w-xs rounded-md border border-neutral-200 bg-white p-3 text-[11px] text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {choroplethLoading && !choroplethData ? (
            <p>Loading real {choroplethTier === "region" ? "region" : "LA"} data…</p>
          ) : (
            <>
              <p className="font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {choroplethTier === "region" ? "Region" : "Local authority"} view
              </p>
              <p className="mt-1">
                {choroplethEntries.filter((e) => e.avgValue !== null).length} of {choroplethEntries.length} real{" "}
                {choroplethTier === "region" ? "regions" : "local authorities"} have real {HEADLINE_STAT_LABEL[stage]} data.
              </p>
              {choroplethTier === "region" && <p className="mt-1 text-neutral-400">Zoom in, or click a region, for local authority detail.</p>}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Item 4 (round 2): real dot-size scale, bottom-left. The exclusion note
              (GCSE/KS5-cohort round) has no Rolls precedent -- kept as its own stacked
              box directly below the size scale, in the same corner. */}
          <div className="absolute bottom-3 left-3 z-[1000] flex max-w-xs flex-col gap-2">
            <SizeLegend minSize={minSize} maxSize={maxSize} familyId={familyId} familyLabel={familyLabel} sizeCaption={sizeCaption} />
            {stage === "ks4" && (mapWholeGroupExcluded ? (
              <p className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-amber-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-amber-400">
                {ks4ExclusionWholeGroupSentence(setLabel)}
              </p>
            ) : excludedForMap.length > 0 ? (
              <p className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-amber-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-amber-400">
                {ks4ExclusionGroupNote(excludedForMap.map((p) => p.name))}
              </p>
            ) : null)}
            {/* ks5ExcludedUrns (and so this whole branch) is only ever non-empty when the
                parent has a specific ks5Bucket selected -- the default per-school state
                does no qualification-type matching at all (item 11) -- so the `?? "A
                level"` fallback below is a type-safety-only no-op, never a real path. */}
            {stage === "ks5" && (mapKs5WholeGroupExcluded ? (
              <p className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-amber-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-amber-400">
                {ks5BucketWholeGroupSentence(setLabel, ks5Bucket ?? "alevel")}
              </p>
            ) : ks5ExcludedForMap.length > 0 ? (
              <p className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-amber-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-amber-400">
                {ks5BucketExclusionNote(ks5ExcludedForMap.map((p) => p.name), ks5Bucket ?? "alevel")}
              </p>
            ) : null)}
          </div>
        </>
      )}
    </div>
  );
}
