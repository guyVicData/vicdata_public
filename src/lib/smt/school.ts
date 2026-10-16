// VicData 0.8 SMT round 1: what the SMT dashboards need to know about the school before drawing
// anything -- its phases (the level chips), whether it is mixed (the Gender pill) and a boarding
// school (the Day + boarding pill), whether it sits IGCSEs (the marked GCSE chip), and the subject
// areas it enters at GCSE and Post-16 (the second row). Server-only; public data, cached an hour.
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";
import { lookupAcademicLatestYears, lookupAcademicSubjectFamily, lookupAcademicSubjectHeadline, lookupReferenceData } from "../vicdata-reference";
import { igcseGroupLabel, igcseGroupNote } from "../igcse-words";
import { igcseEngland, INDEPENDENT_GROUP } from "../igcse";
import { buildRollTrend, type RollSnapshot } from "../roll-data";
import { isBoardingSchool } from "../admissions/boarding";
import { englandSchools } from "../admissions/ranks";
import type { SchoolPhases } from "./levels";
import { figure, population, SMT_MEASURES, type Population } from "./population";

// 0.8 IGCSE subjects: at an IGCSE school, an area lacking a subject it takes as IGCSE carries the short label
// ("Sciences & Maths · no maths (IGCSE)") and its (i) sentence, and isn't ranked against other schools.
export type SmtArea = { id: string; label: string; entries: number; igcseNote?: string };
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
  // GIAS establishment type (0.8 SMT r3: DfE publishes no FSM for "Other independent special school"s,
  // which GIAS groups under "Special schools", nor for independent schools other than CTCs).
  establishmentType: string | null;
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

type SchoolRow = { current_name: string | null; town: string | null; la_name: string | null; la_code: string | null; gender: string | null; boarders_name: string | null; establishment_type_group: string | null; establishment_type: string | null; statutory_low_age: number | null; statutory_high_age: number | null };

export function latestYears(): Promise<LatestYears> {
  return cachedReference("years:latest", () => lookupAcademicLatestYears()) as Promise<LatestYears>;
}

/** The school's census by year (every year from 2019/20): roll, bands, gender, boarding. */
export function schoolCensus(urn: string): Promise<RollSnapshot[]> {
  return cachedReference(`smt:census:${urn}`, async () => buildRollTrend(await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] }), urn));
}

/** R-IGCSE-EXCL on the school's own GCSE rows: the one test, through lib/igcse (R-IGCSE-EVERYWHERE). */
export async function sitsIgcse(urn: string, typeGroup: string | null): Promise<boolean> {
  return typeGroup === INDEPENDENT_GROUP && (await igcseEngland()).has(urn);
}

/** An IGCSE school's GCSE areas, each incomplete one under its short label with its (i) sentence. */
async function igcseLabelledAreas(urn: string, areas: SmtArea[], period: number | null): Promise<SmtArea[]> {
  if (period === null || !areas.length) return areas;
  const rows = await cachedReference(`smt:igcse-subjects:${urn}:${period}`, () => lookupAcademicSubjectHeadline({ entityIds: [urn], ksStage: "ks4", periodMin: period, periodMax: period, bucket: "all" }));
  const subjects = rows.filter((r) => r.entries_total > 0).map((r) => r.subject);
  return areas.map((a) => {
    const note = igcseGroupNote(a.id, a.label, subjects, true);
    return note ? { ...a, label: igcseGroupLabel(a.id, a.label, subjects, true), igcseNote: note } : a;
  });
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
    .select("current_name, town, la_name, la_code, gender, boarders_name, establishment_type_group, establishment_type, statutory_low_age, statutory_high_age")
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
  const [gcseAll, post16] = await Promise.all([phases.gcse ? schoolAreas(urn, "ks4", latest.ks4?.period ?? null) : Promise.resolve([]), phases.post16 ? schoolAreas(urn, "ks5", latest.ks5?.period ?? null) : Promise.resolve([])]);
  // 0.8 IGCSE subjects (R-IGCSE-SUBJECT): an IGCSE school's GCSE areas are offered too; an incomplete one
  // is labelled (the school's own subjects with GCSE entries in the latest year decide).
  const gcse = igcse ? await igcseLabelledAreas(urn, gcseAll, latest.ks4?.period ?? null) : gcseAll;
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
    establishmentType: data.establishment_type,
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
