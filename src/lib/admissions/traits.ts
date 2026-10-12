// VicData 0.7 admissions r2: what the screens say about each school in a set -- sector, gender,
// boarding, age range, LA, location -- and the top bar's filters over those sets. Server-only
// (anon key; public GIAS, the one-hour reference cache). The figures themselves stay with the
// round 1 libraries; this only describes and filters the schools they are computed over.
import { createServerAnonSupabaseClient } from "../supabase";
import { cachedReference } from "../server-cache";

export type SchoolTraits = {
  urn: string;
  name: string;
  sector: "state" | "independent";
  gender: "mixed" | "girls" | "boys";
  boarding: boolean;
  low: number | null;
  high: number | null;
  laCode: string | null;
  laName: string | null;
  town: string | null;
  easting: number | null;
  northing: number | null;
  typeGroup: string | null;
};

type Row = { urn: string; current_name: string; establishment_type_group: string | null; gender: string | null; boarders_name: string | null; statutory_low_age: number | null; statutory_high_age: number | null; la_code: string | null; la_name: string | null; town: string | null; easting: number | null; northing: number | null };

const genderOf = (g: string | null): SchoolTraits["gender"] => (/^girls/i.test(g ?? "") ? "girls" : /^boys/i.test(g ?? "") ? "boys" : "mixed");
// GIAS boarders_name, read as the boarding default list reads it (default-comparator-lists.ts):
// any value but null and "No boarders" is a school with boarders.
export const hasBoarders = (b: string | null): boolean => !!b && b !== "No boarders";

export function fetchSchoolTraits(urns: string[]): Promise<Map<string, SchoolTraits>> {
  const key = Array.from(new Set(urns)).sort();
  return cachedReference(`adm:traits:${key.join(",")}`, () => readTraits(key));
}

async function readTraits(urns: string[]): Promise<Map<string, SchoolTraits>> {
  const supabase = createServerAnonSupabaseClient();
  const out = new Map<string, SchoolTraits>();
  for (let i = 0; i < urns.length; i += 300) {
    const { data, error } = await supabase
      .from("schools")
      .select("urn, current_name, establishment_type_group, gender, boarders_name, statutory_low_age, statutory_high_age, la_code, la_name, town, easting, northing")
      .in("urn", urns.slice(i, i + 300));
    if (error) throw error;
    for (const r of (data ?? []) as Row[])
      out.set(r.urn, {
        urn: r.urn,
        name: r.current_name,
        sector: r.establishment_type_group === "Independent schools" ? "independent" : "state",
        gender: genderOf(r.gender),
        boarding: hasBoarders(r.boarders_name),
        low: r.statutory_low_age,
        high: r.statutory_high_age,
        laCode: r.la_code,
        laName: r.la_name,
        town: r.town,
        easting: r.easting,
        northing: r.northing,
        typeGroup: r.establishment_type_group,
      });
  }
  return out;
}

// The top bar (Main.dc.html / MarketShare.dc.html): Day + boarding, All pupils / girls / boys,
// State + independent. Sex goes to the round 1 maths as it always did; the other two choose and
// narrow the sets the maths runs over.
export type Lists = "both" | "day" | "boarding"; // Pipelines: which feeder lists make the pool
export type Sector = "all" | "state" | "independent";
export type AdmissionsFilters = { lists: Lists; sector: Sector; boardingOnly: boolean };

export function filtersFrom(sp: URLSearchParams): AdmissionsFilters {
  const lists = sp.get("lists");
  const sector = sp.get("sector");
  return {
    lists: lists === "day" || lists === "boarding" ? lists : "both",
    sector: sector === "state" || sector === "independent" ? sector : "all",
    boardingOnly: sp.get("boarding") === "1",
  };
}

/** A set narrowed by sector (and, for rivals, to schools with boarders). The school itself, when
 * in the set (its own Year 11 at 16+), always stays. An empty result is honest: nothing matches. */
export function narrow(urns: string[], traits: Map<string, SchoolTraits>, f: Pick<AdmissionsFilters, "sector" | "boardingOnly">, keep?: string): string[] {
  if (f.sector === "all" && !f.boardingOnly) return urns;
  return urns.filter((u) => {
    if (u === keep) return true;
    const t = traits.get(u);
    if (!t) return false;
    if (f.sector !== "all" && t.sector !== f.sector) return false;
    if (f.boardingOnly && !t.boarding) return false;
    return true;
  });
}

export const isDefaultFilters = (f: AdmissionsFilters) => f.lists === "both" && f.sector === "all" && !f.boardingOnly;

/** Public GIAS reference: every open school's traits in some LAs (setup's "By LA" and the
 * boarding-prep search). Capped; nearest first is the caller's job. */
export function schoolsInLas(laCodes: string[]): Promise<SchoolTraits[]> {
  const key = Array.from(new Set(laCodes)).sort();
  return cachedReference(`adm:la-schools:${key.join(",")}`, async () => {
    const supabase = createServerAnonSupabaseClient();
    const { data, error } = await supabase
      .from("schools")
      .select("urn, current_name, establishment_type_group, gender, boarders_name, statutory_low_age, statutory_high_age, la_code, la_name, town, easting, northing")
      .in("la_code", key)
      .eq("status", "open")
      .limit(3000);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => ({
      urn: r.urn, name: r.current_name, sector: r.establishment_type_group === "Independent schools" ? "independent" : "state", gender: genderOf(r.gender), boarding: hasBoarders(r.boarders_name),
      low: r.statutory_low_age, high: r.statutory_high_age, laCode: r.la_code, laName: r.la_name, town: r.town, easting: r.easting, northing: r.northing, typeGroup: r.establishment_type_group,
    }));
  });
}
