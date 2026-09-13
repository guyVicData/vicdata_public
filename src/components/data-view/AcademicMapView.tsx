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

import { useEffect, useRef, useState } from "react";
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
  GRADE_BAND_LABEL,
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
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [colourMode, setColourMode] = useState<ColourMode>("trend");
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

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const group2 = layerGroupRef.current!;
      group2.clearLayers();

      // KS5 qualification-type-awareness round: at KS5, the comparison metric follows
      // the selected cohort. Item 10: with no cohort selected (ks5Cohort === null, the
      // new default), there IS no one shared measure -- each circle resolves its own
      // real dominant cohort via ks5MeasureFor inside the loop below instead.
      const measureKey = stage === "ks5" && ks5Cohort ? ks5HeadlineMeasureKey(ks5Cohort) : HEADLINE_MEASURE[stage];
      const baseline = TREND_BASELINE_PERIOD[stage];
      const gradeKey = GRADE_BAND_MEASURE[stage];
      const age = HEADLINE_AGE[stage];

      // Round 2, Part B: family-level sizing is real entries_total for the selected
      // family (not population) -- a genuinely different quantity, per spec §3b.
      const sizeValue = (p: AcademicSchoolProfile): number | null =>
        familyId ? (latestFamilyYear(p, stage, familyId)?.entriesTotal ?? null) : populationAtAge(p, age);

      const sizeValues = withCoords.map(sizeValue).filter((v): v is number => v !== null && v > 0);
      const minSize = sizeValues.length > 0 ? Math.min(...sizeValues) : 1;
      const maxSize = sizeValues.length > 0 ? Math.max(...sizeValues) : 1;

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
  }, [withCoords, effectiveColourMode, familyId, stage, targetProfile.urn, ks5Cohort]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapElRef} className="h-full w-full" />

      {/* Item 6: same overlay-on-canvas treatment as Rolls' own MapView.tsx --
          exact same positions/z-index (left-3/right-3 top-3, z-[1000]) and box
          treatment (rounded-md bg-white shadow-sm dark:bg-neutral-950). This
          in-flow header row is now skipped for Map (AcademicDataView's own gate). */}
      <div className="absolute left-3 top-3 z-[1000] rounded-md bg-white shadow-sm dark:bg-neutral-950">
        <ViewSwitcher active={activeView} onChange={onChangeView} />
      </div>
      <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        <div className="rounded-md bg-white shadow-sm dark:bg-neutral-950">
          <PdfExportButton />
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

      {/* Item 7: matches Rolls' own legend position (bottom-3 left-3) and general
          box treatment (bg-white/dark:bg-neutral-950, p-3, shadow-sm) exactly --
          this used to sit at bottom-2 left-2 as a smaller, differently-styled box,
          with the gradient strip in-flow rather than inside this overlay. */}
      <div className="absolute bottom-3 left-3 z-[1000] max-w-xs rounded-md border border-neutral-200 bg-white p-3 text-[11px] text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        <p>
          {familyId
            ? `Circle size shows the number of exam entries in ${familyLabel ?? "this category"}, not pupils — a pupil taking more than one subject in this group is counted once per entry.`
            : `Circle size shows the number of ${HEADLINE_AGE[stage]}-year-olds at each school, not the number who sat exams.`}
        </p>
        <p className="mt-1">
          {familyId
            ? `Colour shows change in average point score in ${familyLabel ?? "this category"} since ${TREND_BASELINE_PERIOD[stage]}.`
            : effectiveColourMode === "trend"
              ? stage === "ks5"
                ? // Item 10: no single shared measure exists in the default (null) state --
                  // a generic caption rather than naming one cohort that isn't really what
                  // every circle is showing (each circle's own tooltip carries the specific
                  // label instead, see rowKs5 above).
                  ks5Cohort
                  ? `Colour shows change in ${ks5HeadlineLabel(ks5Cohort)} since ${TREND_BASELINE_PERIOD[stage]}.`
                  : `Colour shows change in each school's own qualification-type headline measure since ${TREND_BASELINE_PERIOD[stage]} (see each circle's tooltip).`
                : `Colour shows change in ${HEADLINE_LABEL[stage]} since ${TREND_BASELINE_PERIOD[stage]}.`
              : `Colour shows ${GRADE_BAND_LABEL[stage]}, most recent year.`}
        </p>
        <div className="mt-1 flex gap-0.5">
          {TREND_LEGEND_STOPS.map((s) => (
            <span key={s.pct} className="h-2 flex-1" style={{ backgroundColor: s.hex }} />
          ))}
        </div>
        {stage === "ks4" && (mapWholeGroupExcluded ? (
          <p className="mt-1 text-amber-700 dark:text-amber-400">{ks4ExclusionWholeGroupSentence(setLabel)}</p>
        ) : excludedForMap.length > 0 ? (
          <p className="mt-1 text-amber-700 dark:text-amber-400">{ks4ExclusionGroupNote(excludedForMap.map((p) => p.name))}</p>
        ) : null)}
        {/* ks5ExcludedUrns (and so this whole branch) is only ever non-empty when the
            parent has a specific ks5Cohort selected -- the default per-school state
            does no qualification-type matching at all (item 11) -- so the `?? "A
            level"` fallback below is a type-safety-only no-op, never a real path. */}
        {stage === "ks5" && (mapKs5WholeGroupExcluded ? (
          <p className="mt-1 text-amber-700 dark:text-amber-400">{ks5CohortWholeGroupSentence(setLabel, ks5Cohort ?? "A level")}</p>
        ) : ks5ExcludedForMap.length > 0 ? (
          <p className="mt-1 text-amber-700 dark:text-amber-400">{ks5CohortExclusionNote(ks5ExcludedForMap.map((p) => p.name), ks5Cohort ?? "A level")}</p>
        ) : null)}
      </div>
    </div>
  );
}
