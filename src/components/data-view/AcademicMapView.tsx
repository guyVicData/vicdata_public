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
import {
  HEADLINE_MEASURE,
  HEADLINE_LABEL,
  HEADLINE_AGE,
  GRADE_BAND_MEASURE,
  GRADE_BAND_LABEL,
  TREND_BASELINE_PERIOD,
  headlineValueAt,
  latestYear,
  stageYears,
  populationAtAge,
  familyYearsFor,
  latestFamilyYear,
  type AcademicSchoolProfile,
  type KsStage,
} from "@/lib/academic-data-view";

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

type ColourMode = "trend" | "grade_band";

export default function AcademicMapView({
  targetProfile,
  tickedProfiles,
  stage,
  familyId = null,
  familyLabel = null,
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
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [colourMode, setColourMode] = useState<ColourMode>("trend");
  // Grade-band was never a real option at family level -- computed, not synced via an
  // effect, so selecting a family while "grade_band" was active from headline level
  // just silently reads as "trend" rather than needing a state-reset round-trip.
  const effectiveColourMode: ColourMode = familyId ? "trend" : colourMode;

  const group = tickedProfiles.some((p) => p.urn === targetProfile.urn) ? tickedProfiles : [targetProfile, ...tickedProfiles];
  const withCoords = group.filter((p) => p.easting !== null && p.northing !== null);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current || targetProfile.easting === null || targetProfile.northing === null) return;
    let cancelled = false;
    import("leaflet").then(async (mod) => {
      if (cancelled || !mapElRef.current) return;
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const [lat, lng] = bngToLatLng(targetProfile.easting!, targetProfile.northing!);
      const map = L.map(mapElRef.current, { center: [lat, lng], zoom: 11, zoomControl: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetProfile.urn]);

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const group2 = layerGroupRef.current!;
      group2.clearLayers();

      const measureKey = HEADLINE_MEASURE[stage];
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

      for (const p of withCoords) {
        const [lat, lng] = bngToLatLng(p.easting!, p.northing!);
        const isTarget = p.urn === targetProfile.urn;
        const size = sizeValue(p);
        const radius = size !== null && size > 0 ? radiusFor(size, minSize, maxSize) : UNTICKED_RADIUS;

        let colour = UNTICKED_COLOUR;
        if (familyId) {
          // Trend in avgPointScore since baseline, for this one family.
          const years = familyYearsFor(p, stage, familyId);
          const current = years.find((y) => y.period === (latestFamilyYear(p, stage, familyId)?.period ?? -1))?.avgPointScore ?? null;
          const anchor = years.find((y) => y.period === baseline)?.avgPointScore ?? null;
          const badge = trendBadge(current, anchor);
          if (badge) colour = trendColour(badge.pctChange);
        } else {
          const years = stageYears(p, stage);
          if (effectiveColourMode === "trend") {
            const current = headlineValueAt(years, latestYear(years)?.period ?? -1, measureKey);
            const anchor = headlineValueAt(years, baseline, measureKey);
            const badge = trendBadge(current, anchor);
            if (badge) colour = trendColour(badge.pctChange);
          } else {
            const y = latestYear(years);
            const gradeValue = y ? headlineValueAt(years, y.period, gradeKey) : null;
            if (gradeValue !== null) colour = trendColour(gradeValue - 50); // reuses the same diverging scale, centred on 50%
          }
        }

        L.circleMarker([lat, lng], {
          radius,
          fillColor: colour,
          fillOpacity: 0.75,
          color: isTarget ? "#dc2626" : "#ffffff",
          weight: isTarget ? 2.5 : 1,
        })
          .bindTooltip(`${p.name}${isTarget ? " (this school)" : ""}`)
          .addTo(group2);
      }
    });
  }, [withCoords, effectiveColourMode, familyId, stage, targetProfile.urn]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapElRef} className="h-full w-full" />
      {!familyId && (
        <div className="absolute left-2 top-2 z-[1000] flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
      <div className="absolute bottom-2 left-2 z-[1000] max-w-xs rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <p>
          {familyId
            ? `Circle size shows the number of exam entries in ${familyLabel ?? "this category"}, not pupils — a pupil taking more than one subject in this group is counted once per entry.`
            : `Circle size shows the number of ${HEADLINE_AGE[stage]}-year-olds at each school, not the number who sat exams.`}
        </p>
        <p className="mt-1">
          {familyId
            ? `Colour shows change in average point score in ${familyLabel ?? "this category"} since ${TREND_BASELINE_PERIOD[stage]}.`
            : effectiveColourMode === "trend"
              ? `Colour shows change in ${HEADLINE_LABEL[stage]} since ${TREND_BASELINE_PERIOD[stage]}.`
              : `Colour shows ${GRADE_BAND_LABEL[stage]}, most recent year.`}
        </p>
        <div className="mt-1 flex gap-0.5">
          {TREND_LEGEND_STOPS.map((s) => (
            <span key={s.pct} className="h-2 flex-1" style={{ backgroundColor: s.hex }} />
          ))}
        </div>
      </div>
    </div>
  );
}
