"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import proj4 from "proj4";
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

const MIN_RADIUS = 6;
const MAX_RADIUS = 20;
// A single amber accent for every dot -- this map never compares sector/phase/gender
// (every dot is, by construction, a constituent of the SAME group), so there's no
// colour-mode question to answer, just "is this one bigger than that one."
const MARKER_COLOUR = "#b45309";

function rollRadius(roll: number | null, minRoll: number, maxRoll: number): number {
  if (roll === null || !(maxRoll > minRoll)) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (Math.sqrt(roll) - Math.sqrt(minRoll)) / (Math.sqrt(maxRoll) - Math.sqrt(minRoll));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
}

export type ConsortiumMapMember = {
  urn: string;
  name: string;
  easting: number;
  northing: number;
  roll: number | null;
};

export default function ConsortiumMap({ members }: { members: ConsortiumMapMember[] }) {
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

      const group: LayerGroup = L.layerGroup().addTo(map);
      const rolls = members.map((m) => m.roll).filter((r): r is number => r !== null);
      const minRoll = rolls.length ? Math.min(...rolls) : 0;
      const maxRoll = rolls.length ? Math.max(...rolls) : 0;

      const latLngs: [number, number][] = [];
      for (const m of members) {
        const [lat, lng] = bngToLatLng(m.easting, m.northing);
        latLngs.push([lat, lng]);
        const marker = L.circleMarker([lat, lng], {
          radius: rollRadius(m.roll, minRoll, maxRoll),
          color: MARKER_COLOUR,
          fillColor: MARKER_COLOUR,
          fillOpacity: 0.55,
          weight: 1.5,
        });
        marker.bindTooltip(`${m.name}${m.roll !== null ? ` — ${m.roll.toLocaleString()} pupils` : ""}`, {
          direction: "top",
          offset: [0, -4],
        });
        marker.on("click", () => router.push(`/schools/${m.urn}`));
        (marker.getElement?.() as SVGElement | undefined)?.style.setProperty("cursor", "pointer");
        marker.addTo(group);
      }

      // fitBounds needs >=2 distinct points to mean anything; a lone member just
      // centres on it at a sensible close-in zoom instead.
      if (latLngs.length === 1) {
        map.setView(latLngs[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  if (members.length === 0) return null;

  return (
    <div
      ref={mapElRef}
      className="h-[320px] w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800"
    />
  );
}
