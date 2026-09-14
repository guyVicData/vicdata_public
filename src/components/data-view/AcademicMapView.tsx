"use client";

// Academic Results Map, headline level only (frontend build brief §3a). Same real
// primitives Rolls' own MapView.tsx uses (bngToLatLng, trendColour/TREND_LEGEND_STOPS,
// Leaflet) but a much simpler component -- no clustering (this round's scope is
// ticked-comparator-set scale only, never Region/Nation, per Part C), no choropleth.
// Family-level (§3b) and subject-level (§3c) depth are NOT built this round -- flagged
// in the build report as a real, separate follow-up (they need a category/subject
// drill-down filter and their own entries-based sizing, not built this round).
//
// Circle size: population at the stage's single relevant age (10/15/17), read from
// the SAME real dfe_school_census source Rolls' own map uses (spec §3a's own explicit
// reasoning -- the academic ingest has no cohort headcount field at all). Circle
// colour: two modes, trend (change in the headline measure since the stage's trend
// baseline) or grade-band (the stage's real ingested threshold field) -- both real,
// ingested data, no LA/region/national aggregate needed for either (Part A's
// academic_geography_lookup isn't consumed by anything in this round's own spec -- see
// build report).
//
// Map round 2 (live feedback after Stage 2 UX shipped, commit a9b5ce3): items 2-6
// bring this map's chrome into real parity with Rolls' own MapView.tsx -- the distance
// ring, the colour legend's position/content, and a real dot-size scale box, all
// copied from that component's own working code rather than re-derived. Item 1 fixed a
// real intermittent "map blank until you toggle colour mode" bug -- see the mapReady
// state below for the actual root cause.

import { useEffect, useMemo, useRef, useState } from "react";
import { bngToLatLng } from "@/lib/bng";
import { trendColour, TREND_LEGEND_STOPS } from "@/lib/trend-colours";
import { trendBadge } from "@/lib/data-view-cards";
import type { ViewKey } from "@/lib/data-view-types";
import ViewSwitcher from "./ViewSwitcher";
import PdfExportButton from "./PdfExportButton";
import {
  HEADLINE_MEASURE,
  HEADLINE_LABEL,
  HEADLINE_AGE,
  HEADLINE_UNIT,
  GRADE_BAND_MEASURE,
  TREND_BASELINE_PERIOD,
  ks4ExclusionGroupNote,
  ks4ExclusionWholeGroupSentence,
  ks5HeadlineMeasureKey,
  ks5HeadlineLabel,
  ks5CohortExclusionNote,
  ks5CohortWholeGroupSentence,
  ks5MeasureFor,
  headlineValueAt,
  latestYear,
  stageYears,
  populationAtAge,
  familyYearsFor,
  latestFamilyYear,
  type AcademicSchoolProfile,
  type KsStage,
  type Ks5Cohort,
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

// Map round 2, item 3: Grade-band mode's own real scale -- same trendColour()
// diverging function the marker loop itself uses (`trendColour(gradeValue - 50)`), so
// the key's own stops are the SAME TREND_LEGEND_STOPS pct values re-centred on 50 (a
// real percentage-of-cohort figure, not a change-since-baseline one) rather than a
// second, separately-invented scale.
function GradeBandColourKey({ box }: { box: { top: number; height: number } | null }) {
  if (!box) return null;
  const stops = TREND_LEGEND_STOPS;
  const min = stops[0].pct;
  const max = stops[stops.length - 1].pct;
  const gradient = [...stops].reverse().map((s) => s.hex).join(",");
  const barHeight = Math.max(0, box.height - TREND_KEY_TITLE_HEIGHT);
  return (
    <div className="absolute right-[10px] z-[1000] w-[52px]" style={{ top: box.top }}>
      <p className="mb-0.5 text-right text-[9px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400" style={{ height: TREND_KEY_TITLE_HEIGHT }}>
        Grade band
      </p>
      <div className="relative ml-auto w-[26px] rounded-sm shadow-sm" style={{ height: barHeight, background: `linear-gradient(to bottom, ${gradient})` }}>
        {stops.map((s) => {
          const t = (max - s.pct) / (max - min);
          return (
            <div key={s.pct} className="absolute inset-x-0" style={{ top: `${t * 100}%` }}>
              <div className="h-px w-full bg-white/80" />
              <span className="absolute right-full top-1/2 mr-1 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[9px] text-neutral-600 shadow-sm dark:bg-neutral-950/90 dark:text-neutral-300">
                {50 + s.pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Map round 2, item 4: same real three-representative-sizes scale box as MapView.tsx's
// own SizeLegend, reusing radiusFor's own min/max (hoisted to render time below, shared
// with the drawing effect, not recomputed separately).
function SizeLegend({ minSize, maxSize, familyId, familyLabel, age }: { minSize: number; maxSize: number; familyId: string | null; familyLabel: string | null; age: number }) {
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
      <p className="mt-2 text-xs text-neutral-400">{familyId ? `Entries in ${familyLabel ?? "this category"}` : `${age}-year-olds`}</p>
    </div>
  );
}

type ColourMode = "trend" | "grade_band";

export default function AcademicMapView({
  targetProfile,
  tickedProfiles,
  stage,
  familyId = null,
  familyLabel = null,
  activeSetLabel = null,
  ks4ExcludedUrns = EMPTY_EXCLUDED_SET,
  ks5Cohort = null,
  ks5ExcludedUrns = EMPTY_EXCLUDED_SET,
  activeView,
  onChangeView,
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
  ks5Cohort?: Ks5Cohort | null;
  ks5ExcludedUrns?: Set<string>;
  // Stage 2 UX review, item 6: this map now renders its own ViewSwitcher/
  // PdfExportButton overlays (matching Rolls' MapView.tsx exactly), since
  // AcademicDataView's own in-flow header row skips them for Map -- needs the same
  // controlled active/onChange pair that row already threads through.
  activeView: ViewKey;
  onChangeView: (v: ViewKey) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const topRightStackRef = useRef<HTMLDivElement | null>(null);
  // Map round 2, item 1: the actual root cause of "map blank in Trend mode until you
  // toggle Grade band and back" -- see the mount effect below for the full story. Not
  // just a ref: this MUST be real React state so setting it forces a guaranteed extra
  // render/effect-run once the map finishes its own async init, exactly the mechanism
  // Rolls' own MapView.tsx already uses for this (its own `mapReady` state, same name,
  // same purpose) -- ported from there rather than invented fresh.
  const [mapReady, setMapReady] = useState(false);
  const [trendKeyBox, setTrendKeyBox] = useState<{ top: number; height: number } | null>(null);
  const [colourMode, setColourMode] = useState<ColourMode>("grade_band");
  // Grade-band was never a real option at family level -- computed, not synced via an
  // effect, so selecting a family while "grade_band" was active from headline level
  // just silently reads as "trend" rather than needing a state-reset round-trip.
  // KS5 qualification-type-awareness round: grade-band ("AAB or higher") is
  // inherently an A-level grading concept -- DfE has no equivalent threshold field for
  // Applied General/Tech Level/Technical Certificate, and "Academic" blends types too
  // freely for one to mean anything -- so grade-band is only offered when the
  // selector is on its "A level" default, same "not offered at all" treatment as
  // family level rather than silently showing stale/wrong-cohort data.
  const gradeBandAvailable = !familyId && (stage !== "ks5" || ks5Cohort === "A level");
  const effectiveColourMode: ColourMode = gradeBandAvailable ? colourMode : "trend";

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

  // Map round 2, item 4: hoisted out of the drawing effect (it used to be computed
  // there and thrown away every run) so SizeLegend can render the SAME min/max range
  // the markers themselves are scaled against, same "computed once, shared" discipline
  // as MapView.tsx's own values/minV/maxV.
  const { minSize, maxSize } = useMemo(() => {
    const age = HEADLINE_AGE[stage];
    const vals = withCoords
      .map((p) => (familyId ? (latestFamilyYear(p, stage, familyId)?.entriesTotal ?? null) : populationAtAge(p, age)))
      .filter((v): v is number => v !== null && v > 0);
    return { minSize: vals.length > 0 ? Math.min(...vals) : 1, maxSize: vals.length > 0 ? Math.max(...vals) : 1 };
  }, [withCoords, familyId, stage]);

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
      mapRef.current = map;
      // Map round 2, item 1's real fix: this is what's actually missing before this
      // round. Real bug, reproduced against Yerbury Primary School (URN 100429) --
      // NOT a data-shape throw (checked directly: ran the exact Trend-mode branch's
      // value/trendBadge/trendColour computation against Yerbury's real KS2 data AND
      // its full real nearest-10 comparator group, headlessly, via a script that
      // imports and calls the actual production functions -- every one of the 11
      // schools computes cleanly, no throw, see this round's build report). The real
      // mechanism: `L.map()`/the layer group are created asynchronously, inside this
      // `import("leaflet").then()` callback -- before this fix, the ONLY readiness
      // signal was `mapRef.current`/`layerGroupRef.current`, plain refs that don't
      // trigger a re-render when set. The marker-drawing effect below guards on those
      // same refs and returns early if they're still null -- if that effect's FIRST
      // invocation (at mount) loses the race against this async init (a real,
      // measurable gap on a cold "leaflet" chunk load, near-zero once the module is
      // warm from an earlier visit this session -- which is exactly why this read as
      // "intermittent" rather than "always broken"), NOTHING forces a retry once the
      // refs finally become non-null, since mutating a ref doesn't cause React to
      // re-run effects. The map then silently sits blank until some UNRELATED prop/
      // state change happens to re-render this component anyway (any other data
      // finishing loading) -- or until a user manually toggles Grade band/back,
      // which IS a real state change (`setColourMode`) and therefore DOES force a
      // fresh, by-then-definitely-ready run of the drawing effect below, which
      // succeeds regardless of which colour mode it draws (there was never anything
      // Trend-specific about the failure itself -- Trend simply happened to be
      // whichever mode was active on the losing first pass). `mapReady` closes this
      // gap exactly the way Rolls' own MapView.tsx already does: setting it here is
      // itself a real state update, which is what actually guarantees the drawing
      // effect gets at least one more genuine run once the map is truly ready, with
      // no dependency on anything else happening to re-render this component.
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
  // control stack (now just PdfExportButton, item 6 moved the colour toggle out of
  // here) and Leaflet's own zoom control, occupying 70% of that gap's height, rather
  // than a hand-tuned constant.
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
  }, [mapReady, effectiveColourMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !layerGroupRef.current || !rootRef.current) return;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const group2 = layerGroupRef.current!;
      group2.clearLayers();
      const cs = getComputedStyle(rootRef.current!);

      // KS5 qualification-type-awareness round: at KS5, the comparison metric follows
      // the selected cohort. Item 10: with no cohort selected (ks5Cohort === null, the
      // new default), there IS no one shared measure -- each circle resolves its own
      // real dominant cohort via ks5MeasureFor inside the loop below instead.
      const measureKey = stage === "ks5" && ks5Cohort ? ks5HeadlineMeasureKey(ks5Cohort) : HEADLINE_MEASURE[stage];
      const baseline = TREND_BASELINE_PERIOD[stage];
      const gradeKey = GRADE_BAND_MEASURE[stage];
      const age = HEADLINE_AGE[stage];

      const sizeValue = (p: AcademicSchoolProfile): number | null =>
        familyId ? (latestFamilyYear(p, stage, familyId)?.entriesTotal ?? null) : populationAtAge(p, age);

      // Map round 2, item 2: the same real dashed distance ring MapView.tsx draws
      // around the target, in this same always-on layer group (never cleared away by
      // a colour-mode toggle -- it's redrawn fresh on every pass here, same as
      // MapView.tsx's own ring, which lives in that component's equivalent
      // layerGroupRef rather than its clustered schoolsGroup). Drawn first so every
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

      // Item 9: fitBounds to the current visible set, same real behaviour as
      // Rolls' own MapView.tsx (re-run on every comparator-set/exclusion change,
      // via this effect's own dependency array) -- this map used to open at a
      // fixed zoom=11 centred on the target and never auto-fit at all.
      const bounds: [number, number][] = [];

      for (const p of withCoords) {
        const [lat, lng] = bngToLatLng(p.easting!, p.northing!);
        bounds.push([lat, lng]);
        const isTarget = p.urn === targetProfile.urn;
        const size = sizeValue(p);
        const radius = size !== null && size > 0 ? radiusFor(size, minSize, maxSize) : UNTICKED_RADIUS;
        // Item 10: per-marker resolution -- in the default (null) state this is each
        // school's own real dominant cohort, which can genuinely differ circle to
        // circle within the same comparator set; with an explicit cohort selected it
        // just resolves to that cohort for every circle, same as before.
        const rowKs5 = stage === "ks5" ? ks5MeasureFor(p, ks5Cohort) : null;

        let colour = UNTICKED_COLOUR;
        // Real fix, stage 1 review: hoisted out of the colour-mode branches below so
        // the tooltip (built after) can show the same real average the circle's own
        // colour is encoding, whichever mode/level is active -- not a second,
        // possibly-diverging computation.
        let avgValue: number | null = null;
        if (familyId) {
          // Trend in avgPointScore since baseline, for this one family.
          const years = familyYearsFor(p, stage, familyId);
          avgValue = latestFamilyYear(p, stage, familyId)?.avgPointScore ?? null;
          const anchor = years.find((y) => y.period === baseline)?.avgPointScore ?? null;
          const badge = trendBadge(avgValue, anchor);
          if (badge) colour = trendColour(badge.pctChange);
        } else {
          const years = stageYears(p, stage);
          const rowMeasureKey = rowKs5 ? rowKs5.measureKey : measureKey;
          avgValue = headlineValueAt(years, latestYear(years)?.period ?? -1, rowMeasureKey);
          if (effectiveColourMode === "trend") {
            const anchor = headlineValueAt(years, baseline, rowMeasureKey);
            const badge = trendBadge(avgValue, anchor);
            if (badge) colour = trendColour(badge.pctChange);
          } else {
            const y = latestYear(years);
            const gradeValue = y ? headlineValueAt(years, y.period, gradeKey) : null;
            if (gradeValue !== null) colour = trendColour(gradeValue - 50); // reuses the same diverging scale, centred on 50%
          }
        }

        // Real fix, stage 1 review: the tooltip used to be just the school name --
        // Guy's own example ("an A-level map -- label needs to say X 17 year olds, Y
        // average points per A-level entry"). Same real data already driving the
        // circle's own size/colour, not a new fetch -- matches whatever the circle is
        // currently encoding (population vs family entries, headline vs family
        // average), same multi-line HTML tooltip pattern MapView.tsx's own tooltip
        // already uses.
        const sizeLabel = size !== null ? `${size.toLocaleString()} ${familyId ? "entries" : `${HEADLINE_AGE[stage]}-year-olds`}` : null;
        // Item 10: the tooltip shows the SPECIFIC cohort label this circle is actually
        // using -- already per-marker, so a mixed default-state group just reads
        // correctly per school with no extra plumbing (e.g. Acland Burghley's own
        // circle reads "Academic", Sevenoaks' reads "IB" or "A level", side by side).
        const avgLabel =
          avgValue !== null
            ? familyId
              ? `${avgValue.toFixed(1)} avg. point score`
              : `${formatHeadlineValue(stage, avgValue)} ${rowKs5 ? ks5HeadlineLabel(rowKs5.cohort) : HEADLINE_LABEL[stage]}`
            : null;
        const statsLine = [sizeLabel, avgLabel].filter(Boolean).join(", ");
        const tooltipHtml = `<div style="font-size:12px"><strong>${escapeHtml(p.name)}${isTarget ? " (this school)" : ""}</strong>${
          statsLine ? `<br/>${statsLine}` : ""
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
  }, [mapReady, withCoords, minSize, maxSize, effectiveColourMode, familyId, stage, targetProfile.urn, targetProfile.easting, targetProfile.northing, targetProfile.establishmentTypeGroup, ks5Cohort]);

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
      `}</style>
      <div ref={mapElRef} className="h-full w-full" />

      {/* Item 6: default colour-by mode is now Grade band, and the toggle itself moved
          here, alongside ViewSwitcher, off the top-right stack. */}
      <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2">
        <div className="rounded-md bg-white shadow-sm dark:bg-neutral-950">
          <ViewSwitcher active={activeView} onChange={onChangeView} />
        </div>
        {gradeBandAvailable && (
          <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <button
              type="button"
              onClick={() => setColourMode("trend")}
              className={colourMode === "trend" ? "rounded bg-neutral-900 px-2 py-1 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900" : "rounded px-2 py-1 text-neutral-600 dark:text-neutral-400"}
            >
              Trend
            </button>
            <button
              type="button"
              onClick={() => setColourMode("grade_band")}
              className={colourMode === "grade_band" ? "rounded bg-neutral-900 px-2 py-1 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900" : "rounded px-2 py-1 text-neutral-600 dark:text-neutral-400"}
            >
              Grade band
            </button>
          </div>
        )}
      </div>

      <div ref={topRightStackRef} className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        <div className="rounded-md bg-white shadow-sm dark:bg-neutral-950">
          <PdfExportButton />
        </div>
      </div>

      {/* Item 3: colour legend moved to the same right-of-map, measured-gap position
          Rolls' own map uses, with real scale labels -- no explanatory paragraph. */}
      {effectiveColourMode === "trend" ? (
        <TrendColourKey box={trendKeyBox} title="Growth" />
      ) : (
        <GradeBandColourKey box={trendKeyBox} />
      )}

      {/* Item 4: real dot-size scale, bottom-left, same position/box treatment as
          Rolls' own SizeLegend. The exclusion note (GCSE/KS5-cohort round) has no
          Rolls precedent -- kept as its own stacked box directly below the size
          scale, in the same corner, rather than folded back into a paragraph. */}
      <div className="absolute bottom-3 left-3 z-[1000] flex max-w-xs flex-col gap-2">
        <SizeLegend minSize={minSize} maxSize={maxSize} familyId={familyId} familyLabel={familyLabel} age={HEADLINE_AGE[stage]} />
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
            parent has a specific ks5Cohort selected -- the default per-school state
            does no qualification-type matching at all (item 11) -- so the `?? "A
            level"` fallback below is a type-safety-only no-op, never a real path. */}
        {stage === "ks5" && (mapKs5WholeGroupExcluded ? (
          <p className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-amber-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-amber-400">
            {ks5CohortWholeGroupSentence(setLabel, ks5Cohort ?? "A level")}
          </p>
        ) : ks5ExcludedForMap.length > 0 ? (
          <p className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-amber-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-amber-400">
            {ks5CohortExclusionNote(ks5ExcludedForMap.map((p) => p.name), ks5Cohort ?? "A level")}
          </p>
        ) : null)}
      </div>
    </div>
  );
}
