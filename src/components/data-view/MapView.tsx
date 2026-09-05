"use client";

// Member Data View Map (brief §8): bivariate encoding -- marker SIZE is the current
// count of whatever's filtered, rescaled to the FILTERED SET's own range (not a
// national scale); marker COLOUR is the trend (2019->present) in that same filtered
// count. Two colour-by modes (Trends, default; Sector) -- no third "shape as icon"
// mode, per the brief's explicit de-emphasis of shape. Two required legends. Target
// gets a ring independent of fill colour. Filter bar floats over the map, collapsible.
//
// Deliberately a NEW component, not a variant of SchoolMap.tsx -- that component's
// whole architecture is a live moveend-triggered viewport query against a national
// candidate pool (schools-in-bounds route); this map renders a FIXED, already-fetched
// comparator set, a genuinely different shape of problem. Reuses what's actually
// shared: BNG conversion (src/lib/bng.ts, extracted for this), the tile URL/
// attribution constants (duplicated as literals here rather than importing from
// SchoolMap.tsx, which doesn't export them -- three lines, not worth a shared-export
// refactor of a component this different), TAG_COLOURS for Sector mode, and
// MapBoxCollapseToggle for the floating box chrome.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { bngToLatLng } from "@/lib/bng";
import { TAG_COLOURS, cssVarNameForTag } from "@/lib/tag-colours";
import { trendColour, TREND_LEGEND_STOPS } from "@/lib/trend-colours";
import type { DataViewSchoolProfile } from "@/lib/data-view-profiles";
import { profileToFilterableData, profileToFilterableData2019 } from "@/lib/data-view-serialize";
import { filteredCount, type DataViewFilterState } from "@/lib/data-view-filters";
import type { DefaultListEntry } from "@/lib/default-comparator-lists";
import MapBoxCollapseToggle from "@/components/MapBoxCollapseToggle";
import FilterBar from "./FilterBar";

const TILE_URL = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MIN_RADIUS = 5;
const MAX_RADIUS = 20;
const TARGET_RING_RADIUS = MAX_RADIUS + 4;

function radiusFor(value: number, min: number, max: number): number {
  if (!(max > min)) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (Math.sqrt(value) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
}

type ColourMode = "trend" | "sector";

export default function MapView({
  target,
  targetProfile,
  members,
  tickedUrns,
  onToggleTick,
  profilesByUrn,
  filters,
  onFiltersChange,
}: {
  target: { urn: string; name: string; easting: number | null; northing: number | null };
  targetProfile: DataViewSchoolProfile;
  members: DefaultListEntry[];
  tickedUrns: Set<string>;
  onToggleTick: (urn: string) => void;
  profilesByUrn: Map<string, DataViewSchoolProfile>;
  filters: DataViewFilterState;
  onFiltersChange: (f: DataViewFilterState) => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [colourMode, setColourMode] = useState<ColourMode>("trend");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current || target.easting === null || target.northing === null) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapElRef.current) return;
      leafletRef.current = L;
      const [lat, lng] = bngToLatLng(target.easting!, target.northing!);
      const map = L.map(mapElRef.current, { center: [lat, lng], zoom: 11, zoomControl: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.urn]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current || !layerGroupRef.current || !rootRef.current) return;
    const L = leafletRef.current;
    const group = layerGroupRef.current;
    const cs = getComputedStyle(rootRef.current);
    const tagColour = (tag: string) => cs.getPropertyValue(cssVarNameForTag(tag)).trim() || "#9ca3af";

    group.clearLayers();

    const allUrns = [target.urn, ...members.map((m) => m.urn)];
    const allNames = new Map([[target.urn, target.name], ...members.map((m): [string, string] => [m.urn, m.name])]);
    const withProfile = allUrns
      .map((urn) => ({ urn, name: allNames.get(urn) ?? urn, profile: profilesByUrn.get(urn) ?? null }))
      .filter((s): s is { urn: string; name: string; profile: DataViewSchoolProfile } => s.profile !== null)
      .map((s) => ({ ...s, easting: s.profile.easting, northing: s.profile.northing }))
      .filter((s): s is typeof s & { easting: number; northing: number } => s.easting !== null && s.northing !== null);

    const values = withProfile.map((s) => filteredCount(profileToFilterableData(s.profile), filters).total);
    const minV = values.length ? Math.min(...values) : 0;
    const maxV = values.length ? Math.max(...values) : 0;

    const bounds: [number, number][] = [];

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
        bounds.push([lat, lng]);
        const isTarget = s.urn === target.urn;
        const ticked = isTarget || tickedUrns.has(s.urn);

        const current = filteredCount(profileToFilterableData(s.profile), filters).total;
        const anchor2019 = s.profile.anchor2019 ? filteredCount(profileToFilterableData2019(s.profile), filters).total : null;
        const pctChange = anchor2019 && anchor2019 > 0 ? ((current - anchor2019) / anchor2019) * 100 : 0;

        const colour = colourMode === "trend" ? trendColour(pctChange) : s.profile.sector ? tagColour(s.profile.sector) : "#9ca3af";
        const radius = radiusFor(current, minV, maxV);

        const marker = L.circleMarker([lat, lng], {
          radius,
          color: colour,
          fillColor: colour,
          weight: 1.5,
          fillOpacity: ticked ? 0.75 : 0.25,
          opacity: ticked ? 1 : 0.4,
        });
        marker.bindTooltip(
          `<div style="font-size:12px"><strong>${escapeHtml(s.name)}</strong><br/>${current.toLocaleString()}${
            anchor2019 !== null ? ` (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}% since 2019)` : ""
          }${!ticked ? "<br/><em>click to add to comparison</em>" : ""}</div>`,
          { direction: "top", offset: [0, -4] },
        );
        marker.on("click", () => {
          if (isTarget) router.push(`/schools/${s.urn}`);
          else onToggleTick(s.urn);
        });
        (marker.getElement?.() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
        marker.addTo(group);

        if (isTarget) {
          L.circleMarker([lat, lng], { radius: TARGET_RING_RADIUS, color: "#dc2626", weight: 2.5, fill: false }).addTo(group);
        }
      } catch (e) {
        console.error(`[MapView] failed to draw marker for ${s.urn} (${s.name}):`, e);
      }
    }

    if (bounds.length > 1) {
      mapRef.current!.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, members, tickedUrns, profilesByUrn, filters, colourMode, target]);

  const sectorsPresent = Array.from(
    new Set([targetProfile.sector, ...members.map((m) => profilesByUrn.get(m.urn)?.sector ?? null)].filter((s): s is NonNullable<typeof s> => !!s)),
  );

  return (
    <div ref={rootRef} className="relative w-full">
      <style>{`
        .vd-dataview-map { --dot: #9ca3af; ${Object.entries(TAG_COLOURS)
          .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.light[1]};`)
          .join(" ")} }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .vd-dataview-map { ${Object.entries(TAG_COLOURS)
            .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.dark[1]};`)
            .join(" ")} }
        }
        :root[data-theme="dark"] .vd-dataview-map { ${Object.entries(TAG_COLOURS)
          .map(([tag, c]) => `${cssVarNameForTag(tag)}: ${c.dark[1]};`)
          .join(" ")} }
      `}</style>
      <div className="vd-dataview-map relative">
        <div ref={mapElRef} className="h-[480px] w-full rounded-lg sm:h-[560px]" />

        {/* Floating, collapsible filter bar (brief §8/§4) -- Map is the one view with
            the vertical-space constraint the brief calls out; Dashboard/Rankings show
            FilterBar in-flow instead (DataViewShell). */}
        <div className="absolute left-3 top-3 z-[1000] w-64">
          <div className="rounded-md border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className={`flex items-center justify-between gap-2 ${filtersCollapsed ? "" : "mb-2"}`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Filters</h3>
              <MapBoxCollapseToggle collapsed={filtersCollapsed} onToggle={() => setFiltersCollapsed((c) => !c)} label="Filters" />
            </div>
            {!filtersCollapsed && <FilterBar filters={filters} onChange={onFiltersChange} target={targetProfile} />}
          </div>
        </div>

        <div className="absolute right-3 top-3 z-[1000] w-56">
          <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className={`flex items-center justify-between gap-2 ${legendCollapsed ? "" : "mb-2"}`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Colour by</h3>
              <MapBoxCollapseToggle collapsed={legendCollapsed} onToggle={() => setLegendCollapsed((c) => !c)} label="Colour by" />
            </div>
            {!legendCollapsed && (
              <>
                <div className="mb-2 flex gap-1">
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
                {colourMode === "trend" ? (
                  <div>
                    <div className="flex h-2 w-full overflow-hidden rounded" style={{ background: `linear-gradient(to right, ${TREND_LEGEND_STOPS.map((s) => s.hex).join(",")})` }} />
                    <div className="mt-1 flex justify-between text-xs text-neutral-400">
                      <span>declining</span>
                      <span>growing</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">Since 2019, in whatever&rsquo;s currently filtered.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {sectorsPresent.map((s) => (
                      <li key={s} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${cssVarNameForTag(s)})` }} />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Size</p>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <span className="inline-block h-2 w-2 rounded-full bg-neutral-400" />
                    <span className="inline-block h-4 w-4 rounded-full bg-neutral-400" />
                    <span className="text-xs">current filtered count</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        Faded dots aren&rsquo;t ticked for comparison — click a dot to add or remove it. Red ring: this school.
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
