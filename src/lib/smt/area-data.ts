// VicData 0.8 SMT round 3: the reads behind Context's real data -- small-area population, deprivation
// and free school meals. Server-only. Everything comes through the ingest's anon lookups
// (school_context_lookup, lsoa_context_lookup, reference_data_lookup) and the app's own
// la_gss_crosswalk and lsoa_boundaries; nothing here reads a table behind them.
//
// Years are the data's: the latest LSOA year is the last school_context_lookup returns, the latest LA
// estimate the last ons_population_age holds, FSM's latest the last dfe_school_fsm holds.
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";
import { callReferenceRpc, lookupReferenceData } from "../vicdata-reference";
import { SHIRE_COUNTY_DISTRICT_GSS_CODES } from "../shire-county-districts";

export const ENGLAND_GSS = "E92000001";
// The ages ONS's small-area figures run to (school_context_lookup's children[19]: 0-18).
export const AREA_AGES = 19;
// PostgREST answers at most 1,000 rows a call: lsoa_context_lookup is asked in chunks below that.
const LSOA_CHUNK = 900;

// ------------------------------------------------------------------- around the school (LSOAs)

export type SchoolContextYear = {
  year: number;
  children: number[]; // ages 0-18, residents in LSOAs whose population-weighted centroid is within the radius
  lsoaCount: number;
};
export type SchoolContext = {
  urn: string;
  lsoa: string | null; // the school's own LSOA (2021), from its postcode
  imd: number | null; // deciles, 1 = the most deprived 10% of neighbourhoods
  idaci: number | null;
  idaciMix: number[] | null; // children 0-15 within the radius, % in each IDACI decile 1..10
  radiusMiles: number;
  edition: string | null; // the deprivation edition, as the ingest names it
  years: SchoolContextYear[]; // oldest first
};

type SchoolContextRow = { urn: string; lsoa21_code: string | null; imd_decile: number | null; idaci_decile: number | null; idaci_mix: (number | string)[] | null; radius_miles: number | string; deprivation_edition: string | null; year: number; children: number[]; lsoa_count: number };

/** school_context_lookup for one school, or null when the ingest holds none (no postcode, outside
 * England, a postcode that isn't one). */
export function schoolContext(urn: string): Promise<SchoolContext | null> {
  return cachedReference(`smt:school-context:${urn}`, async () => {
    const rows = (await callReferenceRpc("school_context_lookup", { p_urns: [urn] })) as SchoolContextRow[];
    const mine = rows.filter((r) => r.urn === urn).sort((a, b) => a.year - b.year);
    if (!mine.length) return null;
    const last = mine[mine.length - 1];
    return {
      urn,
      lsoa: last.lsoa21_code,
      imd: last.imd_decile,
      idaci: last.idaci_decile,
      idaciMix: last.idaci_mix ? last.idaci_mix.map(Number) : null,
      radiusMiles: Number(last.radius_miles),
      edition: last.deprivation_edition,
      years: mine.filter((r) => Array.isArray(r.children)).map((r) => ({ year: r.year, children: r.children.map(Number), lsoaCount: r.lsoa_count })),
    };
  });
}

export type LsoaFigures = { code: string; imd: number | null; idaci: number | null; year: number; children: number[]; total: number; x: number; y: number };
type LsoaRow = { lsoa21_code: string; imd_decile: number | null; idaci_decile: number | null; year: number; children: number[]; total: number; x_bng: number; y_bng: number };

/** lsoa_context_lookup for any number of LSOAs, in chunks under PostgREST's 1,000-row cap. */
export async function lsoaFigures(codes: string[], year: number): Promise<Map<string, LsoaFigures>> {
  const out = new Map<string, LsoaFigures>();
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += LSOA_CHUNK) chunks.push(codes.slice(i, i + LSOA_CHUNK));
  const parts = await Promise.all(chunks.map((c) => callReferenceRpc("lsoa_context_lookup", { p_lsoas: c, p_year: year }) as Promise<LsoaRow[]>));
  for (const r of parts.flat()) out.set(r.lsoa21_code, { code: r.lsoa21_code, imd: r.imd_decile, idaci: r.idaci_decile, year: r.year, children: (r.children ?? []).map(Number), total: Number(r.total), x: Number(r.x_bng), y: Number(r.y_bng) });
  return out;
}

export type LsoaBoundary = { code: string; name: string; geometry: GeoJSON.MultiPolygon; areaHa: number };
export type BoundaryState = { state: "loaded"; codes: string[] } | { state: "none"; reason: string };

/** The LSOAs whose boundary comes within `metres` of a point (lsoa_boundaries_near). "none" before the
 * K0 migration is applied or the boundaries are loaded: the map then falls back to round 2's. */
export async function lsoasNear(easting: number, northing: number, metres: number): Promise<BoundaryState> {
  const { data, error } = await createServerAnonSupabaseClient().rpc("lsoa_boundaries_near", { p_easting: easting, p_northing: northing, p_metres: metres });
  if (error) return { state: "none", reason: `lsoa_boundaries_near: ${error.code ?? error.message}` };
  const codes = ((data ?? []) as { gss_code: string }[]).map((r) => r.gss_code);
  return codes.length ? { state: "loaded", codes } : { state: "none", reason: "no LSOA boundaries loaded near the school" };
}

export async function lsoaBoundaries(codes: string[]): Promise<LsoaBoundary[]> {
  const supabase = createServerAnonSupabaseClient();
  const out: LsoaBoundary[] = [];
  for (let i = 0; i < codes.length; i += LSOA_CHUNK) {
    const { data, error } = await supabase.rpc("lsoa_boundaries_geojson", { p_gss_codes: codes.slice(i, i + LSOA_CHUNK) });
    if (error) throw new Error(`lsoa_boundaries_geojson: ${error.message}`);
    for (const r of (data ?? []) as { gss_code: string; name: string; geojson: string; area_ha: number }[]) out.push({ code: r.gss_code, name: r.name, geometry: JSON.parse(r.geojson) as GeoJSON.MultiPolygon, areaHa: Number(r.area_ha) });
  }
  return out;
}

// ------------------------------------------------------------------- local authorities

/** The school's LA as ONS codes: its own (la_gss_crosswalk), and the districts ONS's population
 * figures are published for (a shire county's districts; otherwise the LA itself). */
export function laCodes(dfeCode: string | null): Promise<{ gss: string | null; districts: string[] }> {
  if (!dfeCode) return Promise.resolve({ gss: null, districts: [] });
  return cachedReference(`smt:la-gss:${dfeCode}`, async () => {
    const { data } = await createServerAnonSupabaseClient().from("la_gss_crosswalk").select("gss_code").eq("dfe_code", dfeCode).maybeSingle<{ gss_code: string | null }>();
    const gss = data?.gss_code ?? null;
    return { gss, districts: SHIRE_COUNTY_DISTRICT_GSS_CODES[dfeCode] ?? (gss ? [gss] : []) };
  });
}

const AGE_KEYS = Array.from({ length: AREA_AGES }, (_, a) => `age:${a}`);

/** ONS figures by single year of age 0-18 for a set of areas, summed, per year: ons_population_age
 * (mid-year estimates) or ons_snpp (projections). A year is kept only where every area has it. */
async function agesSummed(source: "ons_population_age" | "ons_snpp", entities: string[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!entities.length) return out;
  const facts = await lookupReferenceData({ sourceId: source, entityIds: entities, breakdowns: AGE_KEYS });
  const seen = new Map<number, Set<string>>();
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    const age = Number(f.breakdown.slice(4));
    if (!(age >= 0 && age < AREA_AGES)) continue;
    const row = out.get(f.period) ?? out.set(f.period, new Array(AREA_AGES).fill(0)).get(f.period)!;
    row[age] += f.value_numeric;
    (seen.get(f.period) ?? seen.set(f.period, new Set()).get(f.period)!).add(f.entity_id);
  }
  for (const [y, s] of seen) if (s.size < entities.length) out.delete(y);
  return out;
}

/** The LA's residents by single year of age 0-18, per mid-year (ONS estimates). */
export function laPopulation(dfeCode: string | null): Promise<Map<number, number[]>> {
  return cachedReference(`smt:la-ages:${dfeCode}`, async () => agesSummed("ons_population_age", (await laCodes(dfeCode)).districts));
}

/** The LA's ONS projection by single year of age 0-18, per year. */
export function laProjection(dfeCode: string | null): Promise<Map<number, number[]>> {
  return cachedReference(`smt:la-snpp:${dfeCode}`, async () => agesSummed("ons_snpp", (await laCodes(dfeCode)).districts));
}

/** England's residents by single year of age 0-18, per mid-year: the sum of every English area ONS
 * publishes (E06-E09). Read a year at a time (all areas at once is over the lookup's page limit). */
export function englandPopulation(): Promise<Map<number, number[]>> {
  return cachedReference("smt:england-ages", async () => {
    const probe = await lookupReferenceData({ sourceId: "ons_population_age", entityIds: [ENGLAND_PROBE], breakdowns: ["age:0"] });
    const years = Array.from(new Set(probe.map((f) => f.period))).sort((a, b) => a - b);
    const out = new Map<number, number[]>();
    await Promise.all(
      years.map(async (y) => {
        const facts = await lookupReferenceData({ sourceId: "ons_population_age", periodMin: y, periodMax: y, breakdowns: AGE_KEYS });
        const row = new Array(AREA_AGES).fill(0);
        for (const f of facts) if (/^E0[6-9]/.test(f.entity_id) && f.value_numeric !== null) row[Number(f.breakdown.slice(4))] += f.value_numeric;
        out.set(y, row);
      }),
    );
    return out;
  });
}
// Any area ONS publishes every year (Westminster), to learn which years are held.
const ENGLAND_PROBE = "E09000033";

// ------------------------------------------------------------------- free school meals

export type FsmFigure = { period: number; value: number };

/** Each school's FSM % (fsm_eligible_percent) by year. A school with no rows has no figure: the
 * ingest leaves independent schools out entirely, never 0. */
export async function schoolFsm(urns: string[]): Promise<Map<string, FsmFigure[]>> {
  const out = new Map<string, FsmFigure[]>();
  if (!urns.length) return out;
  const facts = await lookupReferenceData({ sourceId: "dfe_school_fsm", entityIds: urns, breakdowns: ["fsm_eligible_percent"] });
  for (const f of facts) if (f.value_numeric !== null) (out.get(f.entity_id) ?? out.set(f.entity_id, []).get(f.entity_id)!).push({ period: f.period, value: f.value_numeric });
  for (const v of out.values()) v.sort((a, b) => a.period - b.period);
  return out;
}

/** LA and England FSM % by year (dfe_fsm_geography, keyed by the LA's current ONS code). */
export function areaFsm(gss: string | null): Promise<{ la: Map<number, number>; england: Map<number, number> }> {
  return cachedReference(`smt:area-fsm:${gss}`, async () => {
    const facts = await lookupReferenceData({ sourceId: "dfe_fsm_geography", entityIds: [ENGLAND_GSS, ...(gss ? [gss] : [])], breakdowns: ["fsm_eligible_percent"] });
    const la = new Map<number, number>();
    const england = new Map<number, number>();
    for (const f of facts) if (f.value_numeric !== null) (f.entity_id === ENGLAND_GSS ? england : la).set(f.period, f.value_numeric);
    return { la, england };
  });
}

/** Whether DfE publishes FSM for this kind of school: never for independent schools (GIAS's
 * "Independent schools", less its state-funded city technology colleges, and independent special
 * schools, which GIAS files under "Special schools") -- the ingest's own rule. */
export function fsmNotPublishedFor(typeGroup: string | null, type: string | null): boolean {
  return (typeGroup === "Independent schools" && type !== "City technology college") || type === "Other independent special school";
}
