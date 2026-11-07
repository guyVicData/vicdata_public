// VicData 0.8 sets round 1 (A3, B8): Admissions' default sets -- recipes, computed when shown and
// never stored (a default set becomes a stored set only when someone saves it as their own).
// Server-only (public GIAS reference reads, cached).
//
// Compared against (Market share's rivals), each teaching the entry year and the year after it:
//   1. "10 nearest | [same sector]"       the nearest ten of the school's own sector
//   2. "10 nearest | boarding"            the nearest ten with boarders -- a boarding school only
//   3. "Schools in [LA] | all sectors"    every school in its LA teaching the entry year (4+, 11+)
//      "All post-16 in [LA]"              ... at 16+
// Which is the default follows Teacher's boarding rule (default-comparator-lists.ts): the top two
// fifths by boarders default to the boarding set; others to the same-sector set.
//
// Feeder schools (Pipelines), named by what they hold, each teaching the age a year below entry:
//   "Day | all sectors", "Day | state", "Day | independent", and for a boarding school the same
//   three as "Boarding | ...". A boarding set suggests independent preps day or boarding, not
//   boarding-only schools (B8). Their size grows with density: the schools within the school's
//   catchment radius (the SMT catchment's density rule, catchment.ts: a state school's density
//   radius, 15 km for an independent one; a boarding set reaches to the school's cap, 15 or 30 km),
//   nearest first, at least FEEDER_RECIPE_MIN and at most FEEDER_RECIPE_MAX.
import type { EntryPoint } from "../admissions/entry-points";
import { nearbyCandidates } from "../admissions/rungs";
import { fetchSchoolTraits, schoolsInLas, type SchoolTraits } from "../admissions/traits";
import { resolveBoardingQuintileBand } from "../default-comparator-lists";
import { catchmentCapKm, catchmentDefaultKm } from "../smt/catchment";
import { withDensity } from "../smt/catchment-density";
import type { SetKind } from "./model";

export const RIVAL_RECIPE_SIZE = 10;
export const FEEDER_RECIPE_MIN = 10;
export const FEEDER_RECIPE_MAX = 40;

export type RecipeKey =
  | "adm:nearest-sector"
  | "adm:nearest-boarding"
  | "adm:la"
  | `adm:feeders:${"day" | "boarding"}:${"all" | "state" | "independent"}`;

export type RecipeSet = {
  key: RecipeKey;
  name: string;
  kind: SetKind;
  entryPoint: string;
  urns: string[];
  /** This page's default when the school hasn't chosen a set of its own. */
  isDefaultChoice: boolean;
  /** One line on how it was made, for the menu's hover and the editor's header. */
  how: string;
  audience?: "day" | "boarding";
};

const holds = (t: { low: number | null; high: number | null }, age: number) => (t.low ?? 99) <= age && (t.high ?? -1) >= age;
const km = (a: SchoolTraits | undefined, b: SchoolTraits) => (a?.easting == null || a.northing == null || b.easting == null || b.northing == null ? null : Math.hypot(a.easting - b.easting, a.northing - b.northing) / 1000);
const SECTOR_WORD = { state: "state", independent: "independent" } as const;

/** The pure part: rival recipes from a school's traits and its candidates. Exported for tests. */
export function rivalRecipes(me: SchoolTraits, ep: EntryPoint, near: SchoolTraits[], la: SchoolTraits[], boardingBand: "top_two" | "bottom_three" | null): RecipeSet[] {
  const teaching = (t: SchoolTraits) => t.urn !== me.urn && holds(t, ep.age) && holds(t, ep.age + 1);
  const byDistance = (xs: SchoolTraits[]) => xs.map((t) => ({ t, d: km(me, t) })).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)).map((x) => x.t);
  const pool = byDistance(near.filter(teaching));
  const sameSector = pool.filter((t) => t.sector === me.sector).slice(0, RIVAL_RECIPE_SIZE);
  const out: RecipeSet[] = [
    { key: "adm:nearest-sector", name: `${RIVAL_RECIPE_SIZE} nearest | ${SECTOR_WORD[me.sector]}`, kind: "compared_against", entryPoint: ep.id, urns: sameSector.map((t) => t.urn), isDefaultChoice: false, how: `The ${RIVAL_RECIPE_SIZE} nearest ${SECTOR_WORD[me.sector]} schools teaching ${ep.label}.` },
  ];
  if (me.boarding) {
    const boarders = pool.filter((t) => t.boarding).slice(0, RIVAL_RECIPE_SIZE);
    out.push({ key: "adm:nearest-boarding", name: `${RIVAL_RECIPE_SIZE} nearest | boarding`, kind: "compared_against", entryPoint: ep.id, urns: boarders.map((t) => t.urn), isDefaultChoice: false, how: `The ${RIVAL_RECIPE_SIZE} nearest schools with boarders teaching ${ep.label}.` });
  }
  if (me.laName) {
    const inLa = byDistance(la.filter((t) => teaching(t) && t.laCode === me.laCode));
    const post16 = ep.age >= 16;
    out.push({ key: "adm:la", name: post16 ? `All post-16 in ${me.laName}` : `Schools in ${me.laName} | all sectors`, kind: "compared_against", entryPoint: ep.id, urns: inLa.map((t) => t.urn), isDefaultChoice: false, how: post16 ? `Every school in ${me.laName} teaching 16 and 17.` : `Every school in ${me.laName} teaching ${ep.label}, state and independent.` });
  }
  // Teacher's boarding rule: the top two fifths by boarders default to the boarding set.
  const def = boardingBand === "top_two" && me.boarding ? "adm:nearest-boarding" : "adm:nearest-sector";
  for (const r of out) r.isDefaultChoice = r.key === def;
  return out;
}

/** The pure part: feeder recipes from a school's traits, its candidates and its radii. */
export function feederRecipes(me: SchoolTraits, ep: EntryPoint, near: SchoolTraits[], radiusKm: { day: number; boarding: number }): RecipeSet[] {
  const age = Math.max(4, ep.age - 1);
  const out: RecipeSet[] = [];
  const audiences: ("day" | "boarding")[] = me.boarding ? ["day", "boarding"] : ["day"];
  for (const audience of audiences) {
    const reach = radiusKm[audience];
    for (const sector of ["all", "state", "independent"] as const) {
      const fits = near
        .filter((t) => t.urn !== me.urn && holds(t, age) && (sector === "all" || t.sector === sector))
        .map((t) => ({ t, d: km(me, t) }))
        .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));
      const within = fits.filter((x) => x.d !== null && x.d <= reach);
      const chosen = (within.length >= FEEDER_RECIPE_MIN ? within : fits.slice(0, FEEDER_RECIPE_MIN)).slice(0, FEEDER_RECIPE_MAX);
      const word = sector === "all" ? "all sectors" : sector;
      out.push({
        key: `adm:feeders:${audience}:${sector}`,
        name: `${audience === "day" ? "Day" : "Boarding"} | ${word}`,
        kind: "feeders",
        entryPoint: ep.id,
        urns: chosen.map((x) => x.t.urn),
        isDefaultChoice: audience === "day" && sector === "all",
        audience,
        how: `${sector === "all" ? "State and independent schools" : sector === "state" ? "State schools" : "Independent schools"} teaching ${age}-year-olds within ${reach} km${audience === "boarding" ? " (independent preps day or boarding, as well as day schools)" : ""}, nearest first, ${FEEDER_RECIPE_MIN} to ${FEEDER_RECIPE_MAX}.`,
      });
    }
  }
  return out;
}

/** Every default set for a page, computed now. */
export async function admissionsRecipes(urn: string, ep: EntryPoint, kind: SetKind): Promise<RecipeSet[]> {
  const near = await nearbyCandidates(urn);
  const traits = await fetchSchoolTraits([urn, ...near.map((c) => c.urn)]);
  const me = traits.get(urn);
  if (!me) return [];
  const pool = Array.from(traits.values()).filter((t) => t.urn !== urn);
  if (kind === "compared_against") {
    const [la, band] = await Promise.all([me.laCode ? schoolsInLas([me.laCode]) : Promise.resolve([] as SchoolTraits[]), me.boarding ? resolveBoardingQuintileBand(urn).catch(() => null) : Promise.resolve(null)]);
    return rivalRecipes(me, ep, pool, la, band);
  }
  const s = await withDensity(urn, { independent: me.sector === "independent", high: me.high, low: me.low, phases: { post16: (me.high ?? 0) >= 18 } });
  return feederRecipes(me, ep, pool, { day: catchmentDefaultKm(s), boarding: catchmentCapKm(s) });
}
