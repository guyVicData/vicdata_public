// VicData 0.6.7 B2: the Post-16 default comparison set, precomputed. Server-only.
//
// The ingest repo's teacher_default_neighbours table (branch feat/post16-neighbours; filled by
// scripts/compute-teacher-default-neighbours.ts, which runs this app's own build for every
// school) holds each school's Post-16 nearest list. Read through the security-definer lookup
// granted to anon, the way the other reference lookups are.
//
// Used only when it is current: rows exist, the list isn't marked stale (a promote of GIAS,
// the census or the KS5 sources marks every list stale), and its stamp is exactly the periods
// today's build would use -- CURRENT_CENSUS_PERIOD and the latest two published KS5 periods
// (withKs5Results' own read). Otherwise -- the function not applied yet, an unknown school,
// an FE college (not precomputed), a stale list or an error -- the caller builds the list as
// before. Logged once per instance, never shown to the user.
import { callReferenceRpc, lookupAcademicCurrentPeriods } from "./vicdata-reference";
import { cachedReference } from "./server-cache";
import { CURRENT_CENSUS_PERIOD } from "./roll-data";

export const POST16_LIST_KIND = "post16_nearest_10";

type LookupRow = { rank: number; neighbour_id: string; distance_km: number | null; census_period: number; ks5_periods: number[] | null; computed_at: string; stale: boolean };

let logged: string | null = null;
const logOnce = (why: string, detail?: unknown) => {
  if (logged === why) return;
  logged = why;
  console.info(`[post16-default-neighbours] ${why}; building the Post-16 set as before`, detail ?? "");
};
const isMissingFunction = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return /HTTP 404\b/.test(msg) || msg.includes("PGRST202");
};

/** The school's precomputed Post-16 nearest URNs in rank order, or null to build them. */
export async function precomputedPost16Neighbours(urn: string): Promise<string[] | null> {
  let rows: LookupRow[];
  try {
    rows = (await callReferenceRpc("teacher_default_neighbours_lookup", { p_entity_id: urn, p_list_kind: POST16_LIST_KIND })) as LookupRow[];
  } catch (e) {
    logOnce(isMissingFunction(e) ? "teacher_default_neighbours_lookup not applied yet" : "the lookup failed", isMissingFunction(e) ? undefined : e instanceof Error ? e.message : e);
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null; // not precomputed (an FE college, a new school)
  const latest = (await cachedReference("phases:current-periods", () => lookupAcademicCurrentPeriods())).ks5 ?? null;
  const wantKs5 = latest === null ? null : [latest - 1, latest];
  const current = (r: LookupRow) =>
    !r.stale &&
    Number(r.census_period) === CURRENT_CENSUS_PERIOD &&
    wantKs5 !== null &&
    Array.isArray(r.ks5_periods) &&
    r.ks5_periods.length === 2 &&
    [...r.ks5_periods].map(Number).sort((a, b) => a - b).every((p, i) => p === wantKs5[i]);
  if (!rows.every(current)) {
    logOnce("a precomputed list is stale or from other periods");
    return null;
  }
  return [...rows].sort((a, b) => a.rank - b.rank).map((r) => r.neighbour_id);
}
