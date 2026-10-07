// VicData 0.7 admissions (A1): the reads the admissions maths stands on. Server-only (anon key).
//
//   census      dfe_school_census single-age rows (the 80 `{full|part}_time_{sex}_aged_{0-19}`
//               breakdowns only), batched as the Data View reads them (fetchCensusFactsBatched)
//   schools     GIAS: name, LA (DfE code and name), location
//   births      ons_births by LA (GSS code via la_gss_crosswalk; shire counties as the sum of
//               their districts, as the school page's births chart does), every year held
//   projections ons_population_projections, breakdown age_10, keyed by upper-tier LA NAME
// A school's earlier years come from its single predecessor where it has no rows of its own
// (fetchCensus). Public data only. A route may keep these in the one-hour reference cache (server-cache.ts);
// nothing here is per user or per school account.
import { fetchCensusFactsBatched } from "../data-view-profiles";
import { lookupReferenceData, type ReferenceFact } from "../vicdata-reference";
import { createServerAnonSupabaseClient } from "../supabase";
import { SHIRE_COUNTY_DISTRICT_GSS_CODES } from "../shire-county-districts";
import { singleAgeGenderCountsForPeriod, type AgeGenderCounts } from "../roll-data";
import { cohortTable, type CohortTable } from "./cohort";

export const CENSUS_AGE_BREAKDOWNS: string[] = (["full_time", "part_time"] as const).flatMap((m) =>
  (["female", "male"] as const).flatMap((s) => Array.from({ length: 20 }, (_, a) => `${m}_${s}_aged_${a}`)),
);

export type SchoolCensus = { urn: string; table: CohortTable; latestPeriod: number | null; ageGender: AgeGenderCounts };

/** Each school's cohort table, and its latest year's age-gender counts (the page's shape input). */
export const CENSUS_FIRST_PERIOD = 2019;

export async function fetchCensus(urns: string[]): Promise<Map<string, SchoolCensus>> {
  const facts = urns.length ? await fetchCensusFactsBatched(urns, { breakdowns: CENSUS_AGE_BREAKDOWNS }) : [];
  const byUrn = new Map<string, ReferenceFact[]>();
  for (const f of facts) (byUrn.get(f.entity_id) ?? byUrn.set(f.entity_id, []).get(f.entity_id)!).push(f);
  // A school whose own rows start after 2019/20 (most often an academy conversion's new URN):
  // the years before its first are asked for again, on their own -- the reference lookup then
  // reads its single predecessor's rows for them (the lookups' lineage rule), so its history
  // and the set's year-on-year ratios don't break at the conversion.
  const byFirst = new Map<number, string[]>();
  for (const urn of urns) {
    const own = byUrn.get(urn) ?? [];
    if (!own.length) continue;
    const first = Math.min(...own.map((f) => f.period));
    if (first > CENSUS_FIRST_PERIOD) (byFirst.get(first) ?? byFirst.set(first, []).get(first)!).push(urn);
  }
  for (const [first, list] of byFirst) {
    const earlier = await fetchCensusFactsBatched(list, { breakdowns: CENSUS_AGE_BREAKDOWNS, periodMin: CENSUS_FIRST_PERIOD, periodMax: first - 1 });
    for (const f of earlier) if (f.period < first) byUrn.get(f.entity_id)?.push(f);
  }
  const out = new Map<string, SchoolCensus>();
  for (const urn of urns) {
    const mine = byUrn.get(urn) ?? [];
    // The latest year with any pupils (the Reigate quirk: an all-zero latest year is skipped).
    const periods = Array.from(new Set(mine.map((f) => f.period))).sort((a, b) => b - a);
    const latest = periods.find((p) => mine.some((f) => f.period === p && (f.value_numeric ?? 0) > 0)) ?? null;
    out.set(urn, { urn, table: cohortTable(mine), latestPeriod: latest, ageGender: latest === null ? new Map() : singleAgeGenderCountsForPeriod(mine, latest) });
  }
  return out;
}

export type SchoolInfo = { urn: string; name: string; laCode: string | null; laName: string | null; easting: number | null; northing: number | null };

export async function fetchSchoolInfo(urns: string[]): Promise<Map<string, SchoolInfo>> {
  const supabase = createServerAnonSupabaseClient();
  const out = new Map<string, SchoolInfo>();
  for (let i = 0; i < urns.length; i += 300) {
    const { data, error } = await supabase.from("schools").select("urn, current_name, la_code, la_name, easting, northing").in("urn", urns.slice(i, i + 300));
    if (error) throw error;
    for (const r of (data ?? []) as { urn: string; current_name: string; la_code: string | null; la_name: string | null; easting: number | null; northing: number | null }[])
      out.set(r.urn, { urn: r.urn, name: r.current_name, laCode: r.la_code, laName: r.la_name, easting: r.easting, northing: r.northing });
  }
  return out;
}

/** Calendar-year births per DfE LA code, every year held. */
export async function fetchBirthsByLa(laCodes: string[]): Promise<Map<string, Map<number, number>>> {
  const out = new Map<string, Map<number, number>>();
  if (!laCodes.length) return out;
  const supabase = createServerAnonSupabaseClient();
  const { data: xw, error } = await supabase.from("la_gss_crosswalk").select("dfe_code, gss_code").in("dfe_code", laCodes);
  if (error) throw error;
  const gssFor = new Map<string, string[]>();
  for (const r of (xw ?? []) as { dfe_code: string; gss_code: string | null }[]) {
    if (!r.gss_code) continue;
    gssFor.set(r.dfe_code, SHIRE_COUNTY_DISTRICT_GSS_CODES[r.dfe_code] ?? [r.gss_code]);
  }
  const allGss = Array.from(new Set(Array.from(gssFor.values()).flat()));
  const facts = allGss.length ? await lookupReferenceData({ sourceId: "ons_births", entityIds: allGss, breakdowns: ["total"] }) : [];
  const byGss = new Map<string, Map<number, number>>();
  for (const f of facts) {
    if (f.breakdown !== "total" || f.value_numeric === null) continue;
    (byGss.get(f.entity_id) ?? byGss.set(f.entity_id, new Map()).get(f.entity_id)!).set(f.period, f.value_numeric);
  }
  for (const [la, codes] of gssFor) {
    const years = new Map<number, number>();
    const yearSets = codes.map((c) => byGss.get(c));
    if (yearSets.some((y) => !y)) continue;
    for (const y of yearSets[0]!.keys()) {
      if (yearSets.every((s) => s!.has(y))) years.set(y, yearSets.reduce((a, s) => a + s!.get(y)!, 0));
    }
    out.set(la, years);
  }
  return out;
}

/** ONS age-10 projections per upper-tier LA name, by year. */
export async function fetchAge10Projections(laNames: string[]): Promise<Map<string, Map<number, number>>> {
  const out = new Map<string, Map<number, number>>();
  if (!laNames.length) return out;
  const facts = await lookupReferenceData({ sourceId: "ons_population_projections", entityIds: laNames, breakdowns: ["age_10"] });
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    (out.get(f.entity_id) ?? out.set(f.entity_id, new Map()).get(f.entity_id)!).set(f.period, f.value_numeric);
  }
  return out;
}
