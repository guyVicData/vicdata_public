// VicData 0.8 SMT round 3 (K3): the map's neighbourhoods, "Where the school-age children live".
// Server-only. Kept apart from buildContext so the board's own payload stays small: the map asks for
// this only when it is drawn, and a missing table (before K0's migration) or an empty one (before the
// load) answers { state: "fallback" }, when the map draws round 2's LA shading instead.
//
// Which neighbourhoods: those the ingest counts within the radius -- its rule, an LSOA whose
// population-weighted centroid is within it (lsoa_context_lookup's x_bng/y_bng) -- plus a ring, every
// LSOA whose boundary comes within RING_KM beyond that, so the shading has no hard edge at the circle
// (logged). The count within the radius is checked against area_context's.
//
// 0.8 SMT r4 (R2, R4): the radius is the school's catchment, in km (catchment.ts), up to 30 km. Above
// DOTS_FROM neighbourhoods the map shades each one as a dot at its population-weighted centroid, not
// its boundary (logged: the threshold and the timing at 30 km in London).
import { cachedReference } from "../server-cache";
import { fetchSchoolInfo } from "../admissions/data";
import type { SmtSchool } from "./school";
import { levelAges, type SmtPhase } from "./levels";
import { areaContext, fsmNotPublishedFor, lsoaBoundaries, lsoaFigures, lsoasNear, schoolFsm } from "./area-data";
import { kmWord } from "./catchment";
import { bngToLatLng } from "../bng";

export const RING_KM = 2;
// Above this many neighbourhoods drawn, dots at their centroids instead of boundaries (R4).
export const DOTS_FROM = 2500;
// A dot: a disc this wide round the neighbourhood's population-weighted centroid, drawn in the same
// colour scale as a boundary would be (so the map's legend and shading don't change).
const DOT_RADIUS_M = 180;
function dotOf(x: number, y: number): GeoJSON.MultiPolygon {
  const ring = Array.from({ length: 9 }, (_, i) => {
    const t = ((i % 8) / 8) * 2 * Math.PI;
    const [lat, lng] = bngToLatLng(x + DOT_RADIUS_M * Math.cos(t), y + DOT_RADIUS_M * Math.sin(t));
    return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
  });
  return { type: "MultiPolygon", coordinates: [[ring]] };
}

export type MapLsoa = {
  code: string;
  name: string;
  geometry: GeoJSON.MultiPolygon; // its boundary, or (dots: true) a small disc at its centroid
  x: number; // population-weighted centroid, BNG
  y: number;
  areaHa: number;
  children: number; // residents of the level's ages, the latest year
  imd: number | null;
  idaci: number | null;
  within: boolean; // counted within the radius (population-weighted centroid)
};
export type MapSchool = { urn: string; name: string; easting: number; northing: number; isSchool: boolean; fsm: { period: number; value: number } | null; fsmNotPublished: boolean };
export type ContextMap =
  | {
      state: "lsoa";
      urn: string;
      ages: [number, number];
      year: number;
      centre: { easting: number; northing: number };
      radiusKm: number;
      radius: string; // "5 km"
      ringKm: number;
      dots: boolean; // too many neighbourhoods for boundaries: each drawn as a dot at its centroid
      lsoas: MapLsoa[];
      counted: { here: number; lookup: number | null };
      schools: MapSchool[];
      fsmYear: number | null;
      edition: string | null;
    }
  | { state: "fallback"; reason: string };

/** The neighbourhoods around the school with their figures, and the schools nearby with their FSM.
 * `nearby` is buildContext's schools (the school and those of its phase within the radius). */
export async function buildContextMap(school: SmtSchool, level: SmtPhase, nearby: { urn: string; name: string; easting: number; northing: number; isSchool: boolean }[], km: number): Promise<ContextMap> {
  const ages = levelAges(level, school.low, school.high);
  const me = (await fetchSchoolInfo([school.urn])).get(school.urn);
  if (!me || me.easting === null || me.northing === null) return { state: "fallback", reason: "the school has no coordinates" };
  const ac = await areaContext(school.urn, km);
  if (!ac || ac.lsoaYear === null) return { state: "fallback", reason: "no small-area figures for this school (area_context)" };
  const year = ac.lsoaYear;
  const near = await cachedReference(`smt:lsoa-near:${school.urn}:${km}`, () => lsoasNear(me.easting!, me.northing!, (km + RING_KM) * 1000));
  if (near.state === "none") return { state: "fallback", reason: near.reason };

  const dots = near.codes.length > DOTS_FROM;
  // Dots need no boundaries, only each neighbourhood's area for its density (lsoa_boundaries_geojson
  // returns it with the shape, so the shapes are read either way; only the drawing changes).
  const [figs, shapes] = await Promise.all([cachedReference(`smt:lsoa-figs:${school.urn}:${km}:${year}`, () => lsoaFigures(near.codes, year)), cachedReference(`smt:lsoa-geo:${school.urn}:${km}`, () => lsoaBoundaries(near.codes))]);
  const r2 = (km * 1000) ** 2;
  const lsoas: MapLsoa[] = [];
  for (const b of shapes) {
    const f = figs.get(b.code);
    if (!f) continue;
    let kids = 0;
    for (let a = ages[0]; a <= ages[1]; a++) kids += f.children[a] ?? 0;
    lsoas.push({ code: b.code, name: b.name, geometry: dots ? dotOf(f.x, f.y) : b.geometry, x: f.x, y: f.y, areaHa: b.areaHa, children: kids, imd: f.imd, idaci: f.idaci, within: (f.x - me.easting) ** 2 + (f.y - me.northing) ** 2 <= r2 });
  }

  const urns = nearby.map((s) => s.urn);
  const [fsm, kinds] = await Promise.all([schoolFsm(urns), schoolKinds(urns)]);
  const schools: MapSchool[] = nearby.map((s) => {
    const rows = fsm.get(s.urn) ?? [];
    const k = kinds.get(s.urn);
    return { ...s, fsm: rows.at(-1) ?? null, fsmNotPublished: k ? fsmNotPublishedFor(k.group, k.type) : false };
  });
  const fsmYears = schools.map((s) => s.fsm?.period).filter((p): p is number => p !== undefined);
  return {
    state: "lsoa",
    urn: school.urn,
    ages,
    year,
    centre: { easting: me.easting, northing: me.northing },
    radiusKm: km,
    radius: kmWord(km),
    ringKm: RING_KM,
    dots,
    lsoas,
    counted: { here: lsoas.filter((l) => l.within).length, lookup: ac.lsoaCount },
    schools,
    fsmYear: fsmYears.length ? Math.max(...fsmYears) : null,
    edition: ac.edition,
  };
}

/** GIAS's type group and type, for the FSM rule (which schools DfE publishes none for). */
async function schoolKinds(urns: string[]): Promise<Map<string, { group: string | null; type: string | null }>> {
  const { createServerAnonSupabaseClient } = await import("../supabase");
  const out = new Map<string, { group: string | null; type: string | null }>();
  if (!urns.length) return out;
  const { data } = await createServerAnonSupabaseClient().from("schools").select("urn, establishment_type_group, establishment_type").in("urn", urns);
  for (const r of (data ?? []) as { urn: string; establishment_type_group: string | null; establishment_type: string | null }[]) out.set(r.urn, { group: r.establishment_type_group, type: r.establishment_type });
  return out;
}
