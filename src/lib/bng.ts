// British National Grid (EPSG:27700) <-> WGS84 conversion, shared by every Leaflet
// map in this repo. Extracted from SchoolMap.tsx (2026-10-03, Member Data View build)
// so the new data-view map doesn't duplicate the same proj4 setup -- a single source
// of truth for the one non-trivial piece of geography math this project has, per
// "check how similar things are already done before inventing a new pattern."

import proj4 from "proj4";

// EPSG:27700 (OSGB36 / British National Grid), the standard published definition.
const BNG_PROJ = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";
const WGS84_PROJ = "+proj=longlat +datum=WGS84 +no_defs";

export function bngToLatLng(easting: number, northing: number): [number, number] {
  const [lng, lat] = proj4(BNG_PROJ, WGS84_PROJ, [easting, northing]);
  return [lat, lng];
}

export function latLngToBng(lat: number, lng: number): [number, number] {
  return proj4(WGS84_PROJ, BNG_PROJ, [lng, lat]);
}
