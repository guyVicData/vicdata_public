"use client";

// Member Data View Map (brief §8): bivariate encoding -- marker SIZE is the current
// count of whatever's filtered, rescaled to the FILTERED SET's own range (not a
// national scale); marker COLOUR is the trend (2019->present) in that same filtered
// count. Two colour-by modes (Trends, default; Sector) -- no third "shape as icon"
// mode, per the brief's explicit de-emphasis of shape. Two required legends. Target
// gets a ring independent of fill colour.
//
// 2026-09-05 layout fix (real bug reported live): the phase/gender/boarding filter
// bar used to float inside this component as its own small top-left overlay box,
// independent of how Dashboard/Rankings positioned theirs -- its position visibly
// shifted every time a member switched views, which read as "does the filter still
// apply here?" when it's meant to be the opposite signal (one filter, applied
// globally). Filtering now lives ONE place, in DataViewShell's own shared bar above
// the sidebar+main split, identical for all three views -- this component only ever
// RECEIVES `filters`, it doesn't render or collapse a copy of the control itself.
// The colour-by mode selector and the two legends stay here (they're Map-specific,
// not shared with Dashboard/Rankings, so DataViewShell has no business owning them).
//
// Deliberately a NEW component, not a variant of SchoolMap.tsx -- that component's
// whole architecture is a live moveend-triggered viewport query against a national
// candidate pool (schools-in-bounds route); this map renders a FIXED, already-fetched
// comparator set, a genuinely different shape of problem. Reuses what's actually
// shared: BNG conversion (src/lib/bng.ts, extracted for this), the tile URL/
// attribution constants (duplicated as literals here rather than importing from
// SchoolMap.tsx, which doesn't export them -- three lines, not worth a shared-export
// refactor of a component this different), and TAG_COLOURS for Sector mode.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, LayerGroup, MarkerClusterGroup } from "leaflet";
import { bngToLatLng } from "@/lib/bng";
import { TAG_COLOURS, cssVarNameForTag } from "@/lib/tag-colours";
import { trendColour, TREND_LEGEND_STOPS } from "@/lib/trend-colours";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import type { RollSnapshot, AgeGenderCounts } from "@/lib/roll-data";
import { profileToFilterableData, profileToFilterableDataForPeriod, ageGenderCountsFromCompact } from "@/lib/data-view-serialize";
import { filteredCount, matchesSectorFilter, type DataViewFilterState } from "@/lib/data-view-filters";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import type { RegionNationPoint } from "@/lib/region-nation-comparator";
import { sectorTag } from "@/lib/typology";
import type { ViewKey } from "@/lib/data-view-types";
import ViewSwitcher from "./ViewSwitcher";
import PdfExportButton from "./PdfExportButton";
import LoadingSpinnerCard from "./LoadingSpinnerCard";

const TILE_URL = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MIN_RADIUS = 5;
const MAX_RADIUS = 20;
const TARGET_RING_RADIUS = MAX_RADIUS + 4;
// 2026-09-06, UX refinements round 1, B4: a school not yet added to the "Compared
// with" set gets a small, flat, neutral dot -- deliberately smaller than MIN_RADIUS
// (the smallest a real DATA-driven dot can be) so it reads as "not sized by real
// data at all," not just "the smallest real value happens to be here."
const UNTICKED_RADIUS = 3.5;
const UNTICKED_COLOUR = "#9ca3af";

// 2026-09-08, per direct request: "add a dotted circle with the same diameter as
// the public map" -- same fixed, sector-aware radii as the public site's own
// distance ring (SchoolMap.tsx's own DISTANCE_RING_KM_STATE/INDEPENDENT, duplicated
// here rather than imported since that module isn't shared/exported for this).
// Genuinely fixed, not computed from pupil data -- see that module's own comment for
// why (independent schools draw from a much wider area; both values were tuned down
// from larger figures purely to keep an initial viewport's school count reasonable).
const DISTANCE_RING_KM_STATE = 2;
const DISTANCE_RING_KM_INDEPENDENT = 10;

// Member Data View performance architecture (2026-09-08): Region/Nation comparator
// sets can run to several hundred or (at full data build) tens of thousands of
// schools -- past a certain count, individual circleMarkers on one flat LayerGroup
// stop being readable (an undifferentiated blob) and stop being fast (thousands of
// live SVG elements). 200 is chosen as comfortably below Region's realistic minimum
// size (a member's home region is very unlikely to have under ~200 schools) so
// Region/Nation always cluster without needing to special-case them by identity,
// while staying comfortably above every existing small set (Nearest-10 even fully
// expanded, LA-only, Boarding even fully expanded) so none of those regress into
// clustering by accident. Logged per the session brief's own "use your judgement on
// the exact threshold... and log it."
const CLUSTER_THRESHOLD = 200;

// 2026-10-09, per direct request: clustering should give way to real individual
// markers once a member zooms in far enough that they clearly want to see actual
// schools, not a region-level overview -- leaflet.markercluster's own default
// behaviour already progressively splits clusters as you zoom (fewer, smaller
// clusters at each step), but never guarantees a clean "every marker is now
// individual" state at any particular zoom without this option. Zoom 14 is roughly
// "a single town/neighbourhood" scale on this map's own tile set -- the same rough
// scale the initial single-school view already opens at (zoom 11) plus a few zoom-in
// steps, chosen as the point where "which exact schools are here" becomes the natural
// question over "how many schools are in this area." Logged per the same "use your
// judgement and log it" convention CLUSTER_THRESHOLD above was set under.
const CLUSTER_DISABLE_ZOOM = 14;

// Real bug found live (2026-10-09): a single wrongly-geocoded school (NHS Choices
// College, URN 144813 -- already a known, documented bad GIAS coordinate from an
// earlier round, ~400km north of where its own la_name says it should be; that fix
// was scoped narrowly to one LA-adjacency function, never to map auto-fit) dragged
// the WHOLE map's fitBounds out to include it, zooming a London-region view out to
// show most of England. This isn't really specific to that one row -- ANY real-world
// dataset this size can have an occasional wrongly-geocoded outlier, and a single bad
// point should never be able to single-handedly wreck the auto-fit zoom for
// thousands of correctly-placed schools around it. Trims the most extreme ~2% of
// points on each axis (a light percentile trim, not a hardcoded per-school exclusion)
// before computing the fit -- generous enough that Nation's own genuine
// England-spanning extent (Cornwall to Newcastle) still fits correctly, since that's
// a real, gradually-distributed spread, not a handful of isolated outliers. The
// excluded points still render as real markers on the map (this only affects the
// auto-fit CAMERA, never which schools are shown) -- "nothing silently capped or
// sampled" still holds.
const BOUNDS_TRIM_PERCENTILE = 0.02;

function trimmedBoundsFor(points: [number, number][]): [number, number][] {
  if (points.length < 50) return points; // too few for a percentile trim to mean anything
  const lats = points.map((p) => p[0]).sort((a, b) => a - b);
  const lngs = points.map((p) => p[1]).sort((a, b) => a - b);
  const cut = Math.floor(points.length * BOUNDS_TRIM_PERCENTILE);
  const [latLo, latHi] = [lats[cut], lats[lats.length - 1 - cut]];
  const [lngLo, lngHi] = [lngs[cut], lngs[lngs.length - 1 - cut]];
  const trimmed = points.filter(([lat, lng]) => lat >= latLo && lat <= latHi && lng >= lngLo && lng <= lngHi);
  return trimmed.length > 1 ? trimmed : points;
}

function radiusFor(value: number, min: number, max: number): number {
  if (!(max > min)) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (Math.sqrt(value) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
}

// Large-set design v1's own anchor period, duplicated as a literal (same discipline
// data-view-filters.ts's DEFAULT_START_PERIOD/data-view-serialize.ts's
// TREND_ANCHOR_PERIOD_FALLBACK already apply) rather than a value-imported from
// data-view-profiles.ts -- that module is server-only (createServerAnonSupabaseClient)
// and this is a client component.
const LARGE_SET_ANCHOR_PERIOD = 2019;

// 2026-10-09, real bug found live ("London/England schools don't load"): a Region/
// Nation-scale comparator set deliberately never gets a full multi-year
// DataViewSchoolProfile per school (DataViewShell's own LARGE_SET_PROFILE_THRESHOLD
// guard -- fetching one per school at that scale is the exact fetch-and-compute-at-
// scale failure this whole performance-architecture round exists to remove), but
// every marker this component draws comes from `withProfile`, which used to require
// one.
//
// Large-set design v1, item 2: now builds a REAL (not honestly-empty) profile
// whenever region_nation_set()'s extended join found a school_current_snapshot row --
// real position, real sector, AND real current-period age/gender/boarding data, so
// `filteredCount` (data-view-filters.ts) returns a real filtered value under an active
// phase/gender/boarding filter instead of always computing 0 -- this is the actual fix
// for the "filter blanks the map" bug the design doc confirmed live (`filterActive &&
// current === 0` in the drawing loop below skips a marker whose filtered value is
// genuinely zero; a stub profile made that ALWAYS true under any active filter,
// regardless of the school's real data). Only ONE anchor period is available (not the
// full multi-year ageGenderCountsByPeriod a full profile carries) -- trend/"since X"
// figures are only real when filters.startPeriod is exactly LARGE_SET_ANCHOR_PERIOD
// (2019, the default); a member who picks a different custom start year gets an
// honest "no comparison" for these schools rather than a fabricated one, same as a
// school that's simply too new to have real data that far back already gets elsewhere
// in this codebase.
//
// A school with NO real school_current_snapshot row (no real current-period census
// data at all, or the recompute simply hasn't run yet) still falls back to the
// original all-null stub -- real position/sector, small flat dot, hidden under an
// active filter -- exactly the pre-this-round behaviour, never a fabricated figure.
function buildLightweightProfile(urn: string, name: string, point: RegionNationPoint | undefined): DataViewSchoolProfile | null {
  // (0, 0) BNG sentinel values are excluded at withProfile's own shared filter below
  // (protects every consumer, not just this lightweight path) -- this function only
  // needs its own null check.
  if (!point || point.easting === null || point.northing === null) return null;

  const ageGenderCounts = ageGenderCountsFromCompact(point.ageGenderCounts);
  const anchorAgeGenderCounts = ageGenderCountsFromCompact(point.anchorAgeGenderCounts);
  const ageGenderCountsByPeriod = new Map<number, AgeGenderCounts>();
  if (point.currentPeriod !== null) ageGenderCountsByPeriod.set(point.currentPeriod, ageGenderCounts);
  if (point.anchorPeriod !== null) ageGenderCountsByPeriod.set(point.anchorPeriod, anchorAgeGenderCounts);

  const snapshotFor = (period: number | null, totalRoll: number | null, femaleTotal: number | null): RollSnapshot | null =>
    period !== null && totalRoll !== null
      ? {
          period,
          totalRoll,
          byAgeBand: [],
          gender: { male: totalRoll - (femaleTotal ?? 0), female: femaleTotal ?? 0, total: totalRoll, sumMatchesTotal: true },
          boarding: point.boarding,
        }
      : null;
  const current = snapshotFor(point.currentPeriod, point.totalRoll, point.femaleTotal);
  const anchor2019 = point.anchorPeriod === LARGE_SET_ANCHOR_PERIOD ? snapshotFor(point.anchorPeriod, null, null) : null;
  const trend = [current, point.anchorPeriod !== null ? snapshotFor(point.anchorPeriod, null, null) : null].filter(
    (t): t is RollSnapshot => t !== null,
  );

  return {
    urn,
    name,
    town: null,
    laName: null,
    easting: point.easting,
    northing: point.northing,
    sector: sectorTag(point.establishmentTypeGroup, point.establishmentType),
    boarding: null,
    gender: null,
    phase: [],
    establishmentType: point.establishmentType,
    establishmentTypeGroup: point.establishmentTypeGroup,
    statutoryLowAge: point.statutoryLowAge,
    statutoryHighAge: point.statutoryHighAge,
    current,
    anchor2019,
    trend,
    ageGenderCounts,
    ageGenderCounts2019: point.anchorPeriod === LARGE_SET_ANCHOR_PERIOD ? anchorAgeGenderCounts : new Map(),
    ageGenderCountsByPeriod,
    boardersGenderSplit: point.boardersGenderSplit,
    shapeCurrent: null,
    shape2019: null,
    feParticipation: null,
  };
}

// Same academic-year-label convention as FilterBar.tsx's own academicYearLabel
// (RollCard.tsx/FeCollegeCards.tsx/SmallCards.tsx's established shape) -- duplicated
// rather than shared since it's a single one-line pure function.
function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

type ColourMode = "trend" | "sector";

export default function MapView({
  target,
  targetProfile,
  members,
  tickedUrns,
  comparedHidden,
  onToggleTick,
  profilesByUrn,
  largeSetPoints,
  loading,
  loadingLabel,
  filters,
  activeView,
  onChangeView,
}: {
  target: { urn: string; name: string; easting: number | null; northing: number | null };
  targetProfile: DataViewSchoolProfile;
  members: DefaultListEntry[];
  tickedUrns: Set<string>;
  // 2026-09-08: the loading spinner needs to show whenever schools are being added
  // to the map (a new/widened comparator set means new profiles are being fetched
  // for the map to draw) or whenever ANY named-set control is still working out
  // what the new set even is (Local Authorities, Nearest/Boarding "+5 more", the
  // Boarding lazy load) -- not just the very first paint (DataViewShell's own outer
  // gate only covers that; nothing to show at all yet there). This map keeps
  // rendering its current dots underneath and layers the SAME spinner
  // (LoadingSpinnerCard) on top while more load in, matching the public map's own
  // established "spinner overlays the still-visible map" pattern (SchoolMap.tsx's
  // boundsLoading) rather than blanking the whole view. `loading`/`loadingLabel` are
  // DataViewShell's own combined signal (see its mapLoading/mapLoadingLabel comment)
  // -- this component doesn't need to know WHICH source is currently active.
  loading: boolean;
  loadingLabel: string;
  // 2026-09-07, UX refinements round 2, P3 item 8: temporary display-only hide,
  // never touches tickedUrns itself (DataViewShell's own comment on the state).
  comparedHidden: boolean;
  onToggleTick: (urn: string) => void;
  profilesByUrn: Map<string, DataViewSchoolProfile>;
  // 2026-10-09, real bug found live ("London/England schools don't load"): a
  // Region/Nation-scale comparator set deliberately never gets a full profile per
  // school (DataViewShell's own LARGE_SET_PROFILE_THRESHOLD guard), but this map's
  // whole drawing pipeline only ever plotted a school WITH one -- see
  // buildLightweightProfile below for how these fill that gap.
  largeSetPoints: Map<string, RegionNationPoint>;
  filters: DataViewFilterState;
  activeView: ViewKey;
  onChangeView: (v: ViewKey) => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // Holds the distance ring + label only -- always on the map, never clustered.
  const layerGroupRef = useRef<LayerGroup | null>(null);
  // Holds every school marker when the active comparator set is small (<=
  // CLUSTER_THRESHOLD) -- unclustered, exactly as before this change.
  const schoolsGroupRef = useRef<LayerGroup | null>(null);
  // Holds the SAME school markers instead, clustered, once the set is large. Two
  // separate groups (rather than one group whose clustering is toggled) because
  // MarkerClusterGroup's own clustering behaviour is fixed at construction -- only
  // one of the two is ever added to the map at a time, see the drawing effect below.
  const schoolsClusterGroupRef = useRef<MarkerClusterGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const topRightStackRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [colourMode, setColourMode] = useState<ColourMode>("trend");
  const [trendKeyBox, setTrendKeyBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current || target.easting === null || target.northing === null) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    import("leaflet").then(async (mod) => {
      if (cancelled || !mapElRef.current) return;
      // Real bug found live (2026-10-08): a bare `import("leaflet")` module namespace
      // object is a JS spec-mandated non-extensible exotic object -- fine for every
      // OTHER call in this file (L.map(...), L.tileLayer(...), reading existing
      // properties never needed extensibility), but leaflet.markercluster's own
      // side-effect script does `L.MarkerClusterGroup = ...`, ADDING a brand new
      // top-level property, which throws "Cannot add property MarkerClusterGroup,
      // object is not extensible" against the frozen namespace -- reproduced live,
      // the map failed to initialise at all. Next.js/webpack's CJS-interop namespace
      // carries the ORIGINAL, genuinely mutable CJS `module.exports` object under its
      // own `.default` key; unwrapping to that (falling back to the namespace itself
      // if a future build ever ships a true native-ESM Leaflet with no `.default`)
      // gives every subsequent call in this effect -- including leaflet.markercluster's
      // own attach -- the SAME mutable object to read from and write to.
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      leafletRef.current = L;
      // 2026-09-07, UX refinements round 2, P2 item 6: leaflet-gesture-handling is
      // an old-style Leaflet plugin (L.Map.addInitHook against a bare global `L`,
      // confirmed by reading its own source -- it never imports/requires leaflet
      // itself, "deps: none" per its own package metadata) -- it needs `window.L`
      // to already be the SAME Leaflet module this component uses before its own
      // side-effect import runs, which a bundler's scoped ES module import doesn't
      // provide for free. Set once here, harmless afterward (nothing else in this
      // app reads a global L).
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet-gesture-handling");
      // leaflet.markercluster is the same vintage of plugin as leaflet-gesture-
      // handling above (attaches L.MarkerClusterGroup to the bare global L rather
      // than importing leaflet itself) -- needs window.L set first, same reason.
      await import("leaflet.markercluster");
      if (cancelled || !mapElRef.current) return;
      const [lat, lng] = bngToLatLng(target.easting!, target.northing!);
      // gestureHandling: Guy's own explicit request -- "too easy to accidentally
      // zoom/pan while scrolling the page... use Cmd/Ctrl+scroll-to-zoom... same
      // pattern Google Maps embeds use, including the brief 'use Ctrl+scroll to
      // zoom' hint on a bare scroll attempt." Not in Leaflet's own MapOptions
      // type (a third-party plugin option, picked up via its own addInitHook
      // rather than a typed API) -- cast rather than widening the whole options
      // object's type.
      const map = L.map(mapElRef.current, {
        center: [lat, lng],
        zoom: 11,
        zoomControl: false,
        gestureHandling: true,
      } as L.MapOptions & { gestureHandling: boolean });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      schoolsGroupRef.current = L.layerGroup().addTo(map);
      // Not added to the map yet -- only attached once a comparator set actually
      // crosses CLUSTER_THRESHOLD (drawing effect below). Cluster bubbles styled as
      // a plain neutral-dark circle with a count, matching this app's existing
      // monochrome "selected" button treatment rather than the plugin's default
      // green/yellow/orange scheme, which would clash with the map's own trend/
      // sector colour encoding.
      schoolsClusterGroupRef.current = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: CLUSTER_DISABLE_ZOOM,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const size = count >= 1000 ? 44 : count >= 100 ? 38 : 32;
          return L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:#1f2937;color:#fff;font-size:12px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${count.toLocaleString()}</div>`,
            className: "vd-cluster-icon",
            iconSize: [size, size],
          });
        },
      });
      mapRef.current = map;
      setMapReady(true);

      // 2026-09-05: now that the map's container is sized by the flex layout
      // (full-bleed v1) rather than a fixed height class, its real on-screen size
      // can settle AFTER Leaflet's own initial measurement at creation time --
      // Leaflet doesn't re-measure on its own, so without this a map mounted into
      // a container that grows/shrinks post-mount renders with stale internal
      // tile dimensions (blank/cut-off tiles). Found live at a narrow viewport
      // width during this exact change, not a hypothetical.
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
  }, [target.urn]);

  // 2026-09-05, per direct feedback: the trend colour key was sitting too close
  // to the zoom control (a fixed `bottom-[70px]` guess). Now measured for real --
  // centred in the actual vertical gap between the top-right control stack
  // (export + colour-by) and Leaflet's own zoom control, occupying 70% of that
  // gap's height, rather than a hand-tuned constant that only happened to look
  // right at one box's content height.
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
  }, [mapReady, colourMode]);

  // Lifted out of the marker-drawing effect below (it used to be computed there
  // and thrown away every run) so the size-legend overlay can render the SAME
  // min/max range the markers themselves are scaled against, rather than a second,
  // possibly-divergent calculation.
  const withProfile = useMemo(() => {
    const allUrns = [target.urn, ...members.map((m) => m.urn)];
    const allNames = new Map([[target.urn, target.name], ...members.map((m): [string, string] => [m.urn, m.name])]);
    return allUrns
      .map((urn) => ({ urn, name: allNames.get(urn) ?? urn, profile: profilesByUrn.get(urn) ?? buildLightweightProfile(urn, allNames.get(urn) ?? urn, largeSetPoints.get(urn)) }))
      .filter((s): s is { urn: string; name: string; profile: DataViewSchoolProfile } => s.profile !== null)
      .map((s) => ({ ...s, easting: s.profile.easting, northing: s.profile.northing }))
      // Real bug found live (2026-10-09): a genuine (0, 0) BNG sentinel (Hugh
      // Myddelton Infant School, URN 100410 -- same bad-data class already found and
      // fixed elsewhere in this codebase for a different school) isn't caught by a
      // plain null check and previously wasn't excluded here EITHER, for any
      // comparator set, not just Region/Nation -- it just took a set genuinely large
      // enough to include it, and a working map to actually draw it, to surface: the
      // BNG grid's own origin point converts to a real-looking but wrong lat/lng,
      // which dragged the whole map's fitBounds out to sea. Excluded at this shared
      // filter point so every consumer of `withProfile` is protected, not just the
      // new lightweight-profile path.
      .filter((s): s is typeof s & { easting: number; northing: number } => s.easting !== null && s.northing !== null && !(s.easting === 0 && s.northing === 0));
  }, [target.urn, target.name, members, profilesByUrn, largeSetPoints]);

  // Compared-with panel round (2026-09-11), item 4: real bug -- the ring used to be a
  // flat, sector-only-dependent radius (DISTANCE_RING_KM_STATE/INDEPENDENT),
  // completely disconnected from which schools are actually in the comparator set
  // (Harrow's own top-quintile matches, unbounded catchment, sit well outside its old
  // fixed 10km ring). Computed live from the CURRENTLY TICKED members that carry a
  // real per-school distanceKm (same "tick-list is the only comparison mechanism"
  // convention the numbers block already uses) -- every recipe with real distance
  // data (ordinary Nearest-10, both boarding-quintile recipes, LA-scoped sets, all
  // populate this real field) as the smallest radius that encompasses at least 90% of
  // them: sort ticked distances ascending, take the ceil(0.9*N)-th nearest -- with 10
  // schools that's the 9th, dropping the single furthest as an outlier. Recomputes
  // automatically whenever the ticked set changes (the stepper, Add/Subtract window,
  // or a filter-driven recipe switch), since all of those already flow through
  // tickedUrns/members, both real dependencies here.
  //
  // null (not a fallback value itself) whenever there's no real distance data to
  // compute from at all -- Region/Nation sets never carry per-school distanceKm at
  // this scale (last round's own payload-cleanup fix deliberately dropped it), so
  // this naturally stays null for them without needing to special-case by recipe
  // key; the drawing effect below falls back to the OLD fixed sector-aware radius
  // only in that case, which is what keeps Region/Nation's own ring completely
  // untouched, per direct instruction not to touch that code path at all.
  const dynamicRingKm = useMemo(() => {
    const distances = members
      .filter((m) => tickedUrns.has(m.urn) && m.distanceKm !== null)
      .map((m) => m.distanceKm as number)
      .sort((a, b) => a - b);
    if (distances.length === 0) return null;
    const idx = Math.min(distances.length - 1, Math.ceil(distances.length * 0.9) - 1);
    return distances[idx];
  }, [members, tickedUrns]);

  const values = useMemo(
    () => withProfile.map((s) => filteredCount(profileToFilterableData(s.profile), filters).total),
    [withProfile, filters],
  );
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 0;

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !leafletRef.current ||
      !layerGroupRef.current ||
      !schoolsGroupRef.current ||
      !schoolsClusterGroupRef.current ||
      !rootRef.current
    )
      return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    const schoolsGroup = schoolsGroupRef.current;
    const clusterGroup = schoolsClusterGroupRef.current;
    const cs = getComputedStyle(rootRef.current);
    const tagColour = (tag: string) => cs.getPropertyValue(cssVarNameForTag(tag)).trim() || "#9ca3af";

    group.clearLayers();
    schoolsGroup.clearLayers();
    clusterGroup.clearLayers();

    // Region/Nation-scale sets cluster; everything else renders as plain individual
    // markers exactly as before this change (CLUSTER_THRESHOLD's own comment).
    const useCluster = withProfile.length > CLUSTER_THRESHOLD;
    const schoolsTarget = useCluster ? clusterGroup : schoolsGroup;
    if (useCluster) {
      if (map.hasLayer(schoolsGroup)) map.removeLayer(schoolsGroup);
      if (!map.hasLayer(clusterGroup)) map.addLayer(clusterGroup);
    } else {
      if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
      if (!map.hasLayer(schoolsGroup)) map.addLayer(schoolsGroup);
    }

    // Distance ring -- drawn first so every school marker sits on top of it (same
    // ordering/reasoning as the public site's own ring, SchoolMap.tsx). Compared-with
    // panel round (2026-09-11), item 4: real radius now, from dynamicRingKm (see its
    // own comment above) whenever the active comparator set has real per-school
    // distance to compute one from; the old flat, sector-only-dependent radius is
    // now only a fallback for the genuine "no real distance data" case (Region/
    // Nation, a saved set, or before the first tick) -- unchanged for those, per
    // direct instruction not to touch that code path.
    if (target.easting !== null && target.northing !== null) {
      const [targetLat, targetLng] = bngToLatLng(target.easting, target.northing);
      const isDynamicRing = dynamicRingKm !== null;
      const ringKm = dynamicRingKm ?? (targetProfile.sector === "Independent" ? DISTANCE_RING_KM_INDEPENDENT : DISTANCE_RING_KM_STATE);
      const ringLabel = isDynamicRing ? `${ringKm.toFixed(1)} km` : `${ringKm} km`;
      const ringColour = cs.getPropertyValue("--distance-ring").trim() || "#9ca3af";
      L.circle([targetLat, targetLng], {
        radius: ringKm * 1000,
        color: ringColour,
        weight: 1.25,
        dashArray: "4 5",
        fill: false,
        interactive: false,
      }).addTo(group);
      const [ringLabelLat, ringLabelLng] = bngToLatLng(target.easting, target.northing + ringKm * 1000);
      L.marker([ringLabelLat, ringLabelLng], {
        icon: L.divIcon({
          className: "vd-ring-label",
          html: ringLabel,
          iconSize: [40, 16],
          iconAnchor: [20, 8],
        }),
        interactive: false,
      }).addTo(group);
    }

    const bounds: [number, number][] = [];
    // 2026-09-06, UX refinements round 1, B4: "turning off a filter/selector must
    // hide the corresponding dots... confirm this isn't already silently broken."
    // Checked directly: it was -- a school with genuinely zero real pupils in the
    // active phase/gender/boarding slice (an all-boys school under a "Girls"
    // filter, say) still rendered a same-shaped dot as everyone else, which reads
    // as "this school has some of what I'm filtering for" when it honestly has
    // none. Any real narrowing filter now hides that school's dot outright rather
    // than drawing a misleading not-quite-zero-looking circle -- the target is the
    // one exception (never hidden, same "the viewed school is always a real
    // reference point" rule this build applies everywhere else).
    const filterActive = filters.phaseBands.size > 0 || filters.gender.size > 0 || filters.boarding.size > 0;

    for (const s of withProfile) {
      // 2026-09-05, defence in depth after a real live crash (see data-view-
      // serialize.ts's own comment for the root cause that actually caused this):
      // one school's malformed/unexpected profile shape should never take down the
      // WHOLE map -- skip that one marker, log it, keep drawing the rest. The root
      // cause is fixed at its source now, but this loop has no business trusting
      // every profile is perfectly well-formed just because TypeScript says so (the
      // exact lesson that bug taught: a JSON round-trip can produce a shape the
      // static types don't actually guarantee at runtime).
      try {
        const [lat, lng] = bngToLatLng(s.easting, s.northing);
        const isTarget = s.urn === target.urn;
        // comparedHidden (P3 item 8): every ticked school reverts to the bare,
        // no-data dot treatment without actually leaving tickedUrns -- the
        // target is still always shown with real data, same "always a real
        // reference point" exception as everywhere else.
        const ticked = isTarget || (!comparedHidden && tickedUrns.has(s.urn));

        // 2026-09-07, UX refinements round 2, P3 item 7: sector is a real
        // membership filter (matchesSectorFilter's own comment), not a slice --
        // a non-matching school is excluded from the map entirely, same as it is
        // from Dashboard/Rankings (DataViewShell's own tickedProfiles derivation),
        // not just dimmed.
        if (!isTarget && !matchesSectorFilter(s.profile.sector, filters.sector)) continue;

        const current = filteredCount(profileToFilterableData(s.profile), filters).total;

        if (!isTarget && filterActive && current === 0) continue;

        // 2026-09-07, UX refinements round 2, P2 item 6: "auto-fit the map's
        // pan+zoom to the bounding box of whichever schools are currently
        // ticked, recalculated on every set change." Previously included every
        // real position regardless of tick state (a holdover from before
        // per-school hide/show existed) -- narrowed to just what's actually
        // ticked (+ the target, always) so the fit genuinely reflects "what am I
        // comparing right now," not the full candidate pool.
        if (ticked) bounds.push([lat, lng]);

        // 2026-09-06, UX refinements round 1, B4: "schools render as small dots,
        // name shown only on hover, and NO DATA AT ALL until added to the set --
        // remove the current 'faded but partially visible' state." A school not yet
        // ticked no longer shows its real size/colour/trend at all (that WAS real
        // data, just dimmed -- exactly the state being removed) -- it's a small,
        // flat, neutral dot until the member actually adds it, at which point it
        // gets the full real-data treatment identically to an always-shown ticked
        // school. Only the tooltip content and marker radius/colour depend on
        // `ticked` now; the fillOpacity/opacity dimming this replaced is gone.
        let colour = UNTICKED_COLOUR;
        let radius = UNTICKED_RADIUS;
        let tooltipHtml = `<div style="font-size:12px"><strong>${escapeHtml(s.name)}</strong><br/><em>click to add to comparison</em></div>`;

        if (ticked) {
          const hasAnchor = s.profile.ageGenderCountsByPeriod.has(filters.startPeriod) || s.profile.trend.some((t) => t.period === filters.startPeriod);
          const anchor = hasAnchor ? filteredCount(profileToFilterableDataForPeriod(s.profile, filters.startPeriod), filters).total : null;
          const pctChange = anchor && anchor > 0 ? ((current - anchor) / anchor) * 100 : 0;
          colour = colourMode === "trend" ? trendColour(pctChange) : s.profile.sector ? tagColour(s.profile.sector) : "#9ca3af";
          radius = radiusFor(current, minV, maxV);
          tooltipHtml = `<div style="font-size:12px"><strong>${escapeHtml(s.name)}</strong><br/>${current.toLocaleString()}${
            anchor !== null ? ` (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}% since ${academicYearLabel(filters.startPeriod)})` : ""
          }</div>`;
        }

        const marker = L.circleMarker([lat, lng], {
          radius,
          color: colour,
          fillColor: colour,
          weight: 1.5,
          fillOpacity: ticked ? 0.75 : 0.6,
          opacity: 1,
        });
        marker.bindTooltip(tooltipHtml, { direction: "top", offset: [0, -4] });
        marker.on("click", () => {
          if (isTarget) router.push(`/schools/${s.urn}`);
          else onToggleTick(s.urn);
        });
        (marker.getElement?.() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
        // The target school is always a real, individually-visible reference point
        // (same principle the filter logic above already applies) -- never swept
        // into a cluster bubble even when the rest of a large set is clustered.
        marker.addTo(isTarget ? group : schoolsTarget);

        if (isTarget) {
          L.circleMarker([lat, lng], { radius: TARGET_RING_RADIUS, color: "#dc2626", weight: 2.5, fill: false }).addTo(group);
        }
      } catch (e) {
        console.error(`[MapView] failed to draw marker for ${s.urn} (${s.name}):`, e);
      }
    }

    if (bounds.length > 1) {
      mapRef.current!.fitBounds(trimmedBoundsFor(bounds), { padding: [40, 40], maxZoom: 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, withProfile, values, minV, maxV, tickedUrns, comparedHidden, filters, colourMode, target, dynamicRingKm, targetProfile.sector]);

  const sectorsPresent = Array.from(
    new Set([targetProfile.sector, ...members.map((m) => profilesByUrn.get(m.urn)?.sector ?? null)].filter((s): s is NonNullable<typeof s> => !!s)),
  );

  // 2026-09-05, v1 of the "map as full canvas, controls as floating overlays"
  // layout (per direct request -- explicitly a first pass to be iterated on from
  // here, not a final design). The map fills its whole box edge to edge; every
  // control that used to be in-flow (view switcher, export button) or its own
  // in-flow-adjacent box (colour-by, the two legends, the dot caption) is now an
  // absolutely-positioned overlay layered on top of the Leaflet canvas.
  // absolute inset-0, not `relative h-full w-full`: the immediate parent
  // (DataViewShell's map-content wrapper) gets its own box height from
  // `min-height` + flex-grow, not a literal `height` -- and a percentage-height
  // child (`h-full`) doesn't reliably resolve against a min-height-only
  // containing block (a real, observed Chromium behaviour, not a hypothetical:
  // computed height came back 0px against a parent measuring 560px). Absolute
  // positioning sidesteps that resolution rule entirely, the same way this
  // element's own children already do.
  return (
    <div className="absolute inset-0">
      <style>{`
        .vd-dataview-map { --dot: #9ca3af; --distance-ring: #9ca3af; ${Object.entries(TAG_COLOURS)
          .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.light[1]};`)
          .join(" ")} }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-dataview-map { --distance-ring: #6b7280; ${Object.entries(TAG_COLOURS)
            .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.dark[1]};`)
            .join(" ")} }
        }
        :root[data-theme="dark"] .vd-dataview-map { --distance-ring: #6b7280; ${Object.entries(TAG_COLOURS)
          .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.dark[1]};`)
          .join(" ")} }
        .vd-ring-label {
          font-size: 10px; font-weight: 600; color: var(--distance-ring);
          text-align: center; white-space: nowrap; background: transparent;
        }
      `}</style>
      {/* 2026-09-06, UX refinements round 1, B2: rootRef moved onto THIS element
          (the one that actually carries the --tag-* custom properties via
          .vd-dataview-map) rather than its parent -- getComputedStyle on the old
          parent ref could never see a descendant's own custom properties (CSS
          variables cascade down, not up), so tagColour() always silently fell back
          to grey. A real, pre-existing bug (predates this task, not introduced by
          it), found while confirming Special Schools render with a real distinct
          colour on this map the way they already do on the public one. */}
      <div ref={rootRef} className="vd-dataview-map absolute inset-0">
        <div ref={mapElRef} className="absolute inset-0" />

        {loading && <LoadingSpinnerCard label={loadingLabel} />}

        {/* Top-left: view switcher. Moved here from DataViewShell's shared subheader
            row, which is now skipped entirely for Map -- see DataViewShell's own
            comment on this. Dashboard/Rankings keep rendering it in-flow, untouched. */}
        <div className="absolute left-3 top-3 z-[1000] rounded-md bg-white shadow-sm dark:bg-neutral-950">
          <ViewSwitcher active={activeView} onChange={onChangeView} />
        </div>

        {/* Top-right, stacked: export button above the colour-by mode toggle. */}
        <div ref={topRightStackRef} className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
          <div className="rounded-md bg-white shadow-sm dark:bg-neutral-950">
            <PdfExportButton />
          </div>
          <div className="rounded-md border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setColourMode("trend")}
                className={colourMode === "trend" ? "rounded bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900" : "rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"}
              >
                Trends
              </button>
              <button
                type="button"
                onClick={() => setColourMode("sector")}
                className={colourMode === "sector" ? "rounded bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900" : "rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"}
              >
                Sector
              </button>
            </div>
          </div>
        </div>

        {/* Right side, between the top-right control stack and the zoom control:
            whatever the active colour-by mode means. Trend mode gets the
            requested narrow vertical graduated bar, width-matched to Leaflet's
            own zoom control (26px, confirmed from leaflet.css's own .leaflet-bar
            a rule rather than guessed), centred in the real measured gap between
            the two (see the measurement effect above). Sector mode's swatch list
            has no such width/position constraint in the request, so it keeps a
            normal legend-box width in the same general slot -- logged as a
            judgement call, not literally specified, in
            docs/vicdata_data_view_open_questions.md. */}
        {colourMode === "trend" ? <TrendColourKey box={trendKeyBox} /> : <SectorColourKey sectors={sectorsPresent} />}

        {/* Bottom-left: size legend, now its own box (previously folded into the
            colour-by box) with a real scale -- three representative dot sizes at
            the min/mid/max of the CURRENT filtered range, rendered at their real
            on-map radii. */}
        <SizeLegend minV={minV} maxV={maxV} />

        {/* Bottom-centre: the dot-legend caption, floated over the map. No exact
            spot specified -- bottom seemed reasonable and this keeps clear of both
            bottom-corner boxes; easy to move once seen live. */}
        <div className="absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-md bg-white/90 px-3 py-1.5 text-xs text-neutral-500 shadow-sm dark:bg-neutral-950/90 dark:text-neutral-400">
          Small grey dots aren&rsquo;t added to &ldquo;Compared with&rdquo; yet — click a dot to add or remove it. Red ring: this school.
        </div>
      </div>
    </div>
  );
}

function TrendColourKey({ box }: { box: { top: number; height: number } | null }) {
  // Nothing rendered until the real gap is measured (see MapView's own
  // measurement effect) -- rendering at some guessed fallback position first and
  // then jumping to the real one would be worse than a one-frame delay.
  if (!box) return null;
  const stops = TREND_LEGEND_STOPS; // ascending by pct: -30 (red) ... +30 (blue)
  const min = stops[0].pct;
  const max = stops[stops.length - 1].pct;
  // Top of the bar = growing (matches "up is positive"); gradient runs top-to-
  // bottom from the highest stop to the lowest, so reverse the ascending list.
  const gradient = [...stops].reverse().map((s) => s.hex).join(",");
  return (
    <div
      className="absolute right-[10px] z-[1000] w-[26px] rounded-sm shadow-sm"
      style={{ top: box.top, height: box.height, background: `linear-gradient(to bottom, ${gradient})` }}
    >
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
  );
}

function SectorColourKey({ sectors }: { sectors: string[] }) {
  if (sectors.length === 0) return null;
  return (
    <div className="absolute bottom-[70px] right-3 z-[1000] w-44 rounded-md border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Sector</h3>
      <ul className="space-y-1">
        {sectors.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(${cssVarNameForTag(s)})` }} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SizeLegend({ minV, maxV }: { minV: number; maxV: number }) {
  const hasRange = maxV > minV;
  const steps = hasRange
    ? [minV, Math.round((minV + maxV) / 2), maxV].map((v) => ({ v, r: radiusFor(v, minV, maxV) }))
    : [{ v: maxV, r: (MIN_RADIUS + MAX_RADIUS) / 2 }];
  return (
    <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dot size</h3>
      <div className="flex items-end gap-3">
        {steps.map((s) => (
          <div key={s.v} className="flex flex-col items-center gap-1">
            <span className="rounded-full bg-neutral-400" style={{ width: s.r * 2, height: s.r * 2 }} />
            <span className="text-xs text-neutral-500">{s.v.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">Current filtered count</p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
