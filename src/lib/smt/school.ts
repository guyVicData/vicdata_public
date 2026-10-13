// VicData 0.8 SMT round 1: what the SMT dashboards need to know about the school before drawing
// anything -- its phases (the level chips), whether it is mixed (the Gender pill) and a boarding
// school (the Day + boarding pill), whether it sits IGCSEs (the marked GCSE chip), and the subject
// areas it enters at GCSE and Post-16 (the second row). Server-only; public data, cached an hour.
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";
import { lookupAcademicHeadline, lookupAcademicLatestYears, lookupAcademicSubjectFamily, lookupReferenceData } from "../vicdata-reference";
import { igcseExclusionLikely, type AcademicSchoolProfile } from "../academic-data-view";
import { buildRollTrend, type RollSnapshot } from "../roll-data";
import { isBoardingSchool } from "../admissions/boarding";
import { englandSchools } from "../admissions/ranks";
import type { SchoolPhases } from "./levels";
import { figure, population, SMT_MEASURES, type Population } from "./population";

export type SmtArea = { id: string; label: string; entries: number };
export type LatestYears = Partial<Record<"ks2" | "ks4" | "ks5", { period: number; provisional: boolean }>>;

export type SmtSchool = {
  urn: string;
  name: string;
  laCode: string | null;
  laName: string | null;
  // GIAS's town (the place line; VicData holds no district for a school).
  town: string | null;
  regionName: string | null;
  independent: boolean;
  typeGroup: string | null;
  // GIAS gender of entry ("Mixed", "Girls", "Boys"): the Gender pill is for mixed schools only.
  gender: string | null;
  mixed: boolean;
  // GIAS "Boarding school" only (isBoardingSchool, 0.7 r3 F2).
  boarding: boolean;
  low: number | null;
  high: number | null;
  phases: SchoolPhases;
  // Which key stages have published results for the school (latest year).
  results: { ks2: boolean; ks4: boolean; ks5: boolean };
  areas: { gcse: SmtArea[]; post16: SmtArea[] };
  latest: LatestYears;
  census: RollSnapshot[];
};

type SchoolRow = { current_name: string | null; town: string | null; la_name: string | null; la_code: string | null; gender: string | null; boarders_name: string | null; establishment_type_group: string | null; statutory_low_age: number | null; statutory_high_age: number | null };

export function latestYears(): Promise<LatestYears> {
  return cachedReference("years:latest", () => lookupAcademicLatestYears()) as Promise<LatestYears>;
}

/** The school's census by year (every year from 2019/20): roll, bands, gender, boarding. */
export function schoolCensus(urn: string): Promise<RollSnapshot[]> {
  return cachedReference(`smt:census:${urn}`, async () => buildRollTrend(await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] }), urn));
}

/** R-IGCSE-EXCL on the school's own GCSE rows (the same test Teacher and Admissions run). */
export async function sitsIgcse(urn: string, typeGroup: string | null): Promise<boolean> {
  const rows = await cachedReference(`smt:ks4-headline:${urn}`, () => lookupAcademicHeadline({ entityIds: [urn], ksStage: "ks4" }));
  const ks4 = rows.map((r) => ({ period: r.period, measures: r.measures })).sort((a, b) => a.period - b.period);
  return igcseExclusionLikely({ establishmentTypeGroup: typeGroup, ks4 } as unknown as AcademicSchoolProfile);
}

/** The subject areas the school entered in a year, largest first, as the family lookup names them. */
export async function schoolAreas(urn: string, stage: "ks4" | "ks5", period: number | null): Promise<SmtArea[]> {
  if (period === null) return [];
  const rows = await cachedReference(`smt:areas:${urn}:${stage}:${period}`, () => lookupAcademicSubjectFamily({ entityIds: [urn], ksStage: stage, periodMin: period, periodMax: period }));
  return rows
    .filter((r) => r.family_id && Number(r.entries_total) > 0)
    .map((r) => ({ id: r.family_id, label: r.family_label ?? r.family_id, entries: Number(r.entries_total) }))
    .sort((a, b) => b.entries - a.entries);
}

export async function smtSchool(urn: string): Promise<SmtSchool | null> {
  const { data } = await createServerAnonSupabaseClient()
    .from("schools")
    .select("current_name, town, la_name, la_code, gender, boarders_name, establishment_type_group, statutory_low_age, statutory_high_age")
    .eq("urn", urn)
    .maybeSingle<SchoolRow>();
  if (!data) return null;
  // KS2: the school's own rows only (the national KS2 read is large; Overview reads it only for a
  // school with a primary phase).
  const [census, latest, england, ownKs2, ks4, ks5] = await Promise.all([schoolCensus(urn), latestYears(), englandSchools(), cachedReference(`smt:ks2-own:${urn}`, () => lookupReferenceData({ sourceId: "dfe_ks2_attainment", entityIds: [urn], breakdowns: [SMT_MEASURES.ks2.rwm] })), population("ks4"), population("ks5")]);
  const ks2: Population = new Map([[urn, new Map(ownKs2.filter((f) => f.value_numeric !== null).map((f) => [f.period, { [SMT_MEASURES.ks2.rwm]: f.value_numeric as number }]))]]);
  const now = census.at(-1) ?? null;
  const band = (k: string) => (now?.byAgeBand.find((b) => b.key === k)?.total ?? 0) > 0;
  const has = (pop: typeof ks4, stage: "ks2" | "ks4" | "ks5", key: string) => {
    const p = latest[stage]?.period;
    return p !== undefined && (figure(pop, urn, p, key) !== null || figure(pop, urn, p - 1, key) !== null);
  };
  const results = { ks2: has(ks2, "ks2", SMT_MEASURES.ks2.rwm), ks4: has(ks4, "ks4", SMT_MEASURES.ks4.a8), ks5: has(ks5, "ks5", SMT_MEASURES.ks5.aps) };
  const igcse = band("secondary") || results.ks4 ? await sitsIgcse(urn, data.establishment_type_group) : false;
  // The phases the school has: the school page's Roll by phase (a band with pupils in the latest
  // census); a school without a census (a college) by its published results.
  const phases: SchoolPhases = {
    primary: now ? band("primary") : results.ks2,
    gcse: now ? band("secondary") : results.ks4,
    post16: now ? band("sixth_form") : results.ks5,
    ...(igcse ? { igcse: true } : {}),
  };
  const [gcse, post16] = await Promise.all([phases.gcse && !igcse ? schoolAreas(urn, "ks4", latest.ks4?.period ?? null) : Promise.resolve([]), phases.post16 ? schoolAreas(urn, "ks5", latest.ks5?.period ?? null) : Promise.resolve([])]);
  const typeGroup = data.establishment_type_group;
  return {
    urn,
    name: data.current_name ?? urn,
    laCode: data.la_code,
    laName: data.la_name,
    town: data.town,
    regionName: england.get(urn)?.regionName ?? null,
    independent: typeGroup === "Independent schools",
    typeGroup,
    gender: data.gender,
    mixed: data.gender === "Mixed",
    boarding: isBoardingSchool(data.boarders_name),
    low: data.statutory_low_age,
    high: data.statutory_high_age,
    phases,
    results,
    areas: { gcse, post16 },
    latest,
    census,
  };
}
