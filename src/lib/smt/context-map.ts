// VicData 0.8 SMT round 3 (K3): the map's neighbourhoods, "Where the school-age children live".
// Server-only. Kept apart from buildContext so the board's own payload stays small: the map asks for
// this only when it is drawn, and a missing table (before K0's migration) or an empty one (before the
// load) answers { state: "fallback" }, when the map draws round 2's LA shading instead.
//
// Which neighbourhoods: those the ingest counts within 5 miles -- its rule, an LSOA whose
// population-weighted centroid is within the radius (lsoa_context_lookup's x_bng/y_bng) -- plus a
// ring, every LSOA whose boundary comes within RING_MILES beyond that, so the shading has no hard edge
// at the circle (logged). The count within 5 miles is checked against school_context_lookup's.
import { cachedReference } from "../server-cache";
import { fetchSchoolInfo } from "../admissions/data";
import type { SmtSchool } from "./school";
import { AROUND_MILES_UI, levelAges, type SmtPhase } from "./levels";
import { fsmNotPublishedFor, lsoaBoundaries, lsoaFigures, lsoasNear, schoolContext, schoolFsm } from "./area-data";

export const RING_MILES = 1;
const MILE = 1609.344;

export type MapLsoa = {
  code: string;
  name: string;
  geometry: GeoJSON.MultiPolygon;
  areaHa: number;
  children: number; // residents of the level's ages, the latest year
  imd: number | null;
  idaci: number | null;
  within: boolean; // counted within 5 miles (population-weighted centroid)
};
export type MapSchool = { urn: string; name: string; easting: number; northing: number; isSchool: boolean; fsm: { period: number; value: number } | null; fsmNotPublished: boolean };
export type ContextMap =
  | {
      state: "lsoa";
      urn: string;
      ages: [number, number];
      year: number;
      centre: { easting: number; northing: number };
      radiusMiles: number;
      ringMiles: number;
      lsoas: MapLsoa[];
      counted: { here: number; lookup: number | null };
      schools: MapSchool[];
      fsmYear: number | null;
      edition: string | null;
    }
  | { state: "fallback"; reason: string };

/** The neighbourhoods around the school with their figures, and the schools nearby with their FSM.
 * `nearby` is buildContext's schools (the school and those of its phase within 5 miles). */
export async function buildContextMap(school: SmtSchool, level: SmtPhase, nearby: { urn: string; name: string; easting: number; northing: number; isSchool: boolean }[]): Promise<ContextMap> {
  const ages = levelAges(level, school.low, school.high);
  const me = (await fetchSchoolInfo([school.urn])).get(school.urn);
  if (!me || me.easting === null || me.northing === null) return { state: "fallback", reason: "the school has no coordinates" };
  const sc = await schoolContext(school.urn);
  if (!sc || !sc.years.length) return { state: "fallback", reason: "no small-area figures for this school (school_context_lookup)" };
  const year = sc.years[sc.years.length - 1].year;
  const radius = sc.radiusMiles || AROUND_MILES_UI;
  const near = await cachedReference(`smt:lsoa-near:${school.urn}`, () => lsoasNear(me.easting!, me.northing!, (radius + RING_MILES) * MILE));
  if (near.state === "none") return { state: "fallback", reason: near.reason };

  const [figs, shapes] = await Promise.all([cachedReference(`smt:lsoa-figs:${school.urn}:${year}`, () => lsoaFigures(near.codes, year)), cachedReference(`smt:lsoa-geo:${school.urn}`, () => lsoaBoundaries(near.codes))]);
  const r2 = (radius * MILE) ** 2;
  const lsoas: MapLsoa[] = [];
  for (const b of shapes) {
    const f = figs.get(b.code);
    if (!f) continue;
    let kids = 0;
    for (let a = ages[0]; a <= ages[1]; a++) kids += f.children[a] ?? 0;
    lsoas.push({ code: b.code, name: b.name, geometry: b.geometry, areaHa: b.areaHa, children: kids, imd: f.imd, idaci: f.idaci, within: (f.x - me.easting) ** 2 + (f.y - me.northing) ** 2 <= r2 });
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
    radiusMiles: radius,
    ringMiles: RING_MILES,
    lsoas,
    counted: { here: lsoas.filter((l) => l.within).length, lookup: sc.years[sc.years.length - 1].lsoaCount ?? null },
    schools,
    fsmYear: fsmYears.length ? Math.max(...fsmYears) : null,
    edition: sc.edition,
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
