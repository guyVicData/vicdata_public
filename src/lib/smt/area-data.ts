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
import { kmToMiles } from "./catchment";

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

// ------------------------------------------------------------------- 0.8 SMT r4: any radius, projected

// The ingest's area-projection lookups (docs/vicdata_area_projection_report_v1.md, "What the app can
// call"; the method: docs/v0.8/vicdata_area_projection_method_v1.md). They take miles; the board's
// catchment is in km (catchment.ts), converted here. Every figure is whole children; a single
// neighbourhood's figures below 5 come back null.

export type AreaRow = { year: number; ageFrom: number; ageTo: number; middle: number | null; low: number | null; high: number | null; scenario: number | null; includesUnborn: boolean };
// "0-3", "4-10", "11-15", "16-17", "16-18", "0-18" -> % of the area's children of those ages in this authority.
export type AreaMix = { lad: string; name: string; share: Record<string, number | null> };
// The settings row the results were made with (area_projection_settings.settings), as stored.
export type ProjectionSettings = {
  version: number;
  exceptional_years: number[];
  exceptional_reason: string;
  first_rate_year: number;
  middle_pre_years: number;
  weight_pre: number;
  weight_post: number;
  band_includes_exceptional?: boolean;
  scenario_years: number[];
  scenario_label: string;
  horizon_years: number;
  births: string;
};
export type ProjectionYearsUsed = { normal: number[]; middle_weights: Record<string, number>; band: number[]; scenario: number[]; births_middle?: string };
export type ProjectionSource = { source_id: string; edition: string; first?: number; latest?: number; loaded?: string; use?: string; editions_by_year?: Record<string, string> };
export type AreaProjection = {
  scope: "around" | "la";
  lsoaCount: number | null; // around the school only
  latestYear: number;
  lsoaYear: number | null;
  horizonEnd: number;
  settingsVersion: number;
  settings: ProjectionSettings;
  yearsUsed: ProjectionYearsUsed;
  sources: Record<string, ProjectionSource>;
  mix: AreaMix[]; // around the school only, the latest year, largest first
  rows: AreaRow[];
  // The caller's own age range was asked for but the ingest's lookups don't take one yet (before
  // migration 20261016120000): its middle and scenario are summed from the single ages (exact), its band
  // is left out (summing single ages' lows would overstate it).
  rangeBandMissing: boolean;
};

type RawRow = { year: number; age_from: number; age_to: number; middle: number | null; low: number | null; high: number | null; scenario: number | null; includes_unborn: boolean };
type RawProjection = {
  lsoa_count?: number; latest_year: number; lsoa_year?: number; horizon_end: number; settings_version: number; settings: ProjectionSettings;
  years_used: ProjectionYearsUsed; sources: Record<string, ProjectionSource>; authority_mix?: { lad_code: string; lad_name: string; share: Record<string, number | null> }[]; rows: RawRow[];
};

const isMissingSignature = (e: unknown) => /PGRST202|Could not find the function/i.test(String((e as Error)?.message ?? e));
const rowOf = (r: RawRow): AreaRow => ({ year: r.year, ageFrom: r.age_from, ageTo: r.age_to, middle: r.middle, low: r.low, high: r.high, scenario: r.scenario, includesUnborn: r.includes_unborn });

/** A range's rows summed from the single ages: middle and scenario exactly; no band (see rangeBandMissing). */
function summedRange(rows: AreaRow[], [lo, hi]: [number, number], latestYear: number): AreaRow[] {
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b);
  return years.map((y) => {
    const singles = rows.filter((r) => r.year === y && r.ageFrom === r.ageTo && r.ageFrom >= lo && r.ageFrom <= hi);
    const sum = (k: "middle" | "scenario") => (singles.some((r) => r[k] === null) ? null : singles.reduce((t, r) => t + (r[k] ?? 0), 0));
    return { year: y, ageFrom: lo, ageTo: hi, middle: sum("middle"), low: null, high: null, scenario: sum("scenario"), includesUnborn: lo < y - latestYear };
  });
}

function toProjection(raw: RawProjection, scope: "around" | "la", ages: [number, number] | null, rangeBandMissing: boolean): AreaProjection {
  let rows = raw.rows.map(rowOf);
  if (ages && rangeBandMissing && !rows.some((r) => r.ageFrom === ages[0] && r.ageTo === ages[1])) rows = [...rows, ...summedRange(rows, ages, raw.latest_year)];
  return {
    scope,
    lsoaCount: raw.lsoa_count ?? null,
    latestYear: raw.latest_year,
    lsoaYear: raw.lsoa_year ?? null,
    horizonEnd: raw.horizon_end,
    settingsVersion: raw.settings_version,
    settings: raw.settings,
    yearsUsed: raw.years_used,
    sources: raw.sources,
    mix: (raw.authority_mix ?? []).map((m) => ({ lad: m.lad_code, name: m.lad_name, share: m.share })),
    rows,
    rangeBandMissing: rangeBandMissing && !!ages && !(raw.rows ?? []).some((r) => r.age_from === ages[0] && r.age_to === ages[1]),
  };
}

/** area_projection for a school at a radius (km), with the school's own age range as one more row set. */
export function areaProjection(urn: string, km: number, ages: [number, number] | null = null): Promise<AreaProjection | null> {
  return cachedReference(`smt:area-projection:${urn}:${km}:${ages?.join("-") ?? ""}`, async () => {
    const base = { p_urn: urn, p_radius_miles: kmToMiles(km) };
    try {
      const raw = (await callReferenceRpc("area_projection", ages ? { ...base, p_age_from: ages[0], p_age_to: ages[1] } : base)) as unknown as RawProjection | null;
      return raw ? toProjection(raw, "around", ages, false) : null;
    } catch (e) {
      if (!ages || !isMissingSignature(e)) throw e;
      const raw = (await callReferenceRpc("area_projection", base)) as unknown as RawProjection | null;
      return raw ? toProjection(raw, "around", ages, true) : null;
    }
  });
}

/** The authority view (la_projection_lookup): one LA, or a shire county's districts summed. */
export function laAreaProjection(dfeCode: string | null, ages: [number, number] | null = null): Promise<AreaProjection | null> {
  return cachedReference(`smt:la-area-projection:${dfeCode}:${ages?.join("-") ?? ""}`, async () => {
    const districts = (await laCodes(dfeCode)).districts;
    if (!districts.length) return null;
    const base = { p_lad_codes: districts };
    try {
      const raw = (await callReferenceRpc("la_projection_lookup", ages ? { ...base, p_age_from: ages[0], p_age_to: ages[1] } : base)) as unknown as RawProjection | null;
      return raw ? toProjection(raw, "la", ages, false) : null;
    } catch (e) {
      if (!ages || !isMissingSignature(e)) throw e;
      const raw = (await callReferenceRpc("la_projection_lookup", base)) as unknown as RawProjection | null;
      return raw ? toProjection(raw, "la", ages, true) : null;
    }
  });
}

export type AreaContextData = {
  urn: string;
  km: number;
  lsoaCount: number;
  lsoaYear: number | null;
  own: { lsoa: string | null; imd: number | null; idaci: number | null } | null;
  edition: string | null;
  idaciMix: number[] | null; // children 0-15, % in each IDACI decile 1..10
  mix: AreaMix[]; // the latest LSOA year
  years: SchoolContextYear[]; // oldest first; ages 0-18 (a single neighbourhood's figures below 5 are null -> 0 here, flagged)
  suppressed: boolean; // one neighbourhood: some figures below 5 were withheld
};
type RawContext = {
  lsoa_count: number; lsoa_year: number | null; own: { lsoa21_code: string | null; imd_decile: number | null; idaci_decile: number | null } | null; deprivation_edition: string | null;
  idaci_mix: number[] | null; authority_mix: { lad_code: string; lad_name: string; share: Record<string, number | null> }[]; years: { year: number; children: (number | null)[] }[];
};

/** area_context: what school_context_lookup gave at 5 miles, at any radius (km). */
export function areaContext(urn: string, km: number): Promise<AreaContextData | null> {
  return cachedReference(`smt:area-context:${urn}:${km}`, async () => {
    const raw = (await callReferenceRpc("area_context", { p_urn: urn, p_radius_miles: kmToMiles(km) })) as unknown as RawContext | null;
    if (!raw) return null;
    const suppressed = raw.years.some((y) => y.children.some((c) => c === null));
    return {
      urn,
      km,
      lsoaCount: raw.lsoa_count,
      lsoaYear: raw.lsoa_year,
      own: raw.own ? { lsoa: raw.own.lsoa21_code, imd: raw.own.imd_decile, idaci: raw.own.idaci_decile } : null,
      edition: raw.deprivation_edition,
      idaciMix: raw.idaci_mix ? raw.idaci_mix.map(Number) : null,
      mix: (raw.authority_mix ?? []).map((m) => ({ lad: m.lad_code, name: m.lad_name, share: m.share })),
      years: raw.years.map((y) => ({ year: y.year, children: y.children.map((c) => (c === null ? 0 : Number(c))), lsoaCount: raw.lsoa_count })),
      suppressed,
    };
  });
}
