"use client";

import { rollRadius } from "@/lib/map-radius";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import proj4 from "proj4";
import type * as L from "leaflet";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

// Group-page map (sixth-form consortium build): deliberately NOT SchoolMap.tsx --
// that component is built entirely around a live viewport-bounds fetch
// (schools-in-bounds), which has no meaning here (the member list is fixed and
// already known in full from consortium_members, not "whatever's currently in
// view"). This is a small, single-purpose map: an explicit list of member points,
// fit-to-bounds once on load, no panning-triggered refetch, no fullscreen, no
// colour-mode/filter panel, no viewed-school ring. Same real BNG->WGS84 proj4
// transform as SchoolMap.tsx (EPSG:27700, OSGB36) -- that part IS shared math, not
// duplicated by coincidence.
const BNG_PROJ =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";
const WGS84_PROJ = "+proj=longlat +datum=WGS84 +no_defs";

function bngToLatLng(easting: number, northing: number): [number, number] {
  const [lng, lat] = proj4(BNG_PROJ, WGS84_PROJ, [easting, northing]);
  return [lat, lng];
}

// Same CARTO tile source/attribution as SchoolMap.tsx (NEXT_PUBLIC_CARTO_API_KEY,
// public by necessity -- see that file's own comment).
const TILE_URL = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// 0.8 SMT feedback round 1 (F-2): the dots' size scale lives in lib/map-radius.ts, shared with SMT's map
// and its size key.
// A single amber accent for every dot -- this map never compares sector/phase/gender
// (every dot is, by construction, a constituent of the SAME group), so there's no
// colour-mode question to answer, just "is this one bigger than that one."
const MARKER_COLOUR = "#b45309";

export type ConsortiumMapMember = {
  urn: string;
  name: string;
  easting: number;
  northing: number;
  roll: number | null;
};

// 0.7 admissions r2: new OPTIONAL props for the Admissions feeder and rival maps -- each one
// absent draws exactly what it drew before (the consortium page passes none):
//   colourOf   a dot's colour (default: the one amber)
//   targetUrn  the school itself: ringed, drawn last (default: none)
//   tooltipOf  a dot's tooltip text (default: name and pupils)
//   heightClass the map's height and frame classes (default: h-[320px], the page's frame)
//   onSelect   what a click does (default: open the school's page)
//   fitPadding the fit-to-bounds padding in px (default: 32)
// 0.8 SMT r2 (Context): one more OPTIONAL prop, absent everywhere before it --
//   areas      polygons drawn under the dots (WGS84 GeoJSON), each with its own fill and tooltip;
//              the map still fits to the dots
// 0.8 SMT r3 (Context's neighbourhoods): four more OPTIONAL props, absent everywhere else --
//   circle      a thin ring of `metres` round a point (BNG), drawn under the dots
//   fitCircle   fit the map to that ring instead of the dots
//   markerOf    a dot's full style (fill, ring, size), for dots coloured by a figure or hollow
//   redrawKey   redraw when it changes (a new "Shade by"), not only when the dots do
// Over 200 areas draw on one canvas layer (a neighbourhood map holds up to ~1,600).
export type ConsortiumMapArea = { id: string; geometry: GeoJSON.MultiPolygon; fill: string; fillOpacity: number; stroke: string; tooltip: string; weight?: number };
export type ConsortiumMapMarker = { color: string; fillColor: string; fillOpacity: number; radius: number; weight: number };
export type ConsortiumMapOptions = {
  areas?: ConsortiumMapArea[];
  circle?: { easting: number; northing: number; metres: number; colour: string };
  fitCircle?: boolean;
  markerOf?: (m: ConsortiumMapMember) => ConsortiumMapMarker | null;
  redrawKey?: string;
  colourOf?: (m: ConsortiumMapMember) => string;
  targetUrn?: string;
  tooltipOf?: (m: ConsortiumMapMember) => string;
  heightClass?: string;
  onSelect?: (urn: string) => void;
  fitPadding?: number;
};

export default function ConsortiumMap({ members, colourOf, targetUrn, tooltipOf, heightClass, onSelect, fitPadding, areas, circle, fitCircle, markerOf, redrawKey }: { members: ConsortiumMapMember[] } & ConsortiumMapOptions) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!mapElRef.current || mapRef.current || members.length === 0) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapElRef.current) return;

      const map = L.map(mapElRef.current, { zoomControl: false, attributionControl: true });
      mapRef.current = map;
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      // The ring's bounds from its centre and radius; fitting to it first gives the map a view before any
      // layer is added (a canvas layer needs one).
      const centre = circle ? bngToLatLng(circle.easting, circle.northing) : null;
      const ringBounds = circle && centre ? L.latLng(centre[0], centre[1]).toBounds(circle.metres * 2) : null;
      if (ringBounds && fitCircle) map.fitBounds(ringBounds, { padding: [fitPadding ?? 8, fitPadding ?? 8] });

      if (areas?.length) {
        const renderer = areas.length > 200 ? L.canvas({ padding: 0.3 }) : undefined;
        for (const a of areas) {
          const layer = L.geoJSON(a.geometry as GeoJSON.GeoJsonObject, { style: { color: a.stroke, weight: a.weight ?? 1, fillColor: a.fill, fillOpacity: a.fillOpacity }, ...(renderer ? { renderer } : {}) } as L.GeoJSONOptions);
          layer.bindTooltip(a.tooltip, { sticky: true });
          layer.addTo(map);
        }
      }
      if (circle && centre) L.circle(centre, { radius: circle.metres, color: circle.colour, weight: 1.5, fill: false, interactive: false, dashArray: "5 4" }).addTo(map);
      const group: LayerGroup = L.layerGroup().addTo(map);
      const rolls = members.map((m) => m.roll).filter((r): r is number => r !== null);
      const minRoll = rolls.length ? Math.min(...rolls) : 0;
      const maxRoll = rolls.length ? Math.max(...rolls) : 0;

      const latLngs: [number, number][] = [];
      // The target (when given) is drawn last, so it sits on top.
      const ordered = targetUrn ? [...members.filter((m) => m.urn !== targetUrn), ...members.filter((m) => m.urn === targetUrn)] : members;
      for (const m of ordered) {
        const [lat, lng] = bngToLatLng(m.easting, m.northing);
        latLngs.push([lat, lng]);
        const isTarget = targetUrn !== undefined && m.urn === targetUrn;
        const colour = colourOf ? colourOf(m) : MARKER_COLOUR;
        const custom = markerOf ? markerOf(m) : null;
        const marker = L.circleMarker(
          [lat, lng],
          custom ?? {
            radius: isTarget ? 8 : rollRadius(m.roll, minRoll, maxRoll),
            color: isTarget ? colour : colour,
            fillColor: isTarget ? "#ffffff" : colour,
            fillOpacity: isTarget ? 1 : 0.55,
            weight: isTarget ? 3 : 1.5,
          },
        );
        marker.bindTooltip(tooltipOf ? tooltipOf(m) : `${m.name}${m.roll !== null ? ` — ${m.roll.toLocaleString()} pupils` : ""}`, {
          direction: "top",
          offset: [0, -4],
        });
        marker.on("click", () => (onSelect ? onSelect(m.urn) : router.push(`/schools/${m.urn}`)));
        (marker.getElement?.() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
        marker.addTo(group);
      }

      // fitBounds needs >=2 distinct points to mean anything; a lone member just
      // centres on it at a sensible close-in zoom instead.
      if (ringBounds && fitCircle) {
        // Fitted above.
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [fitPadding ?? 32, fitPadding ?? 32] });
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, redrawKey]);

  if (members.length === 0) return null;

  return (
    <div
      ref={mapElRef}
      className={heightClass ?? "h-[320px] w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800"}
    />
  );
}
