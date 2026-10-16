// VicData 0.8 audit fixes (1): one IGCSE rule everywhere. A school whose GCSE figures are excluded as
// IGCSE-heavy (igcseExclusionLikely, R-IGCSE-EXCL: an independent school at exactly 0% English and
// maths grade 4+ with an Attainment 8 over 5, in its own latest GCSE year) is left out of every GCSE
// ranking population -- national, regional, LA, set, "10 nearest", SMT's and Admissions' -- and is
// never silently dropped from a list (R-IGCSE-EVERYWHERE). The test is igcseExclusionLikely, once;
// this module is the one place its inputs are loaded for many schools: every independent school in
// England, read once an hour (server-cache), so each population takes out the same schools.
// Server-only.
import { cachedReference } from "./server-cache";
import { createServerAnonSupabaseClient } from "./supabase";
import { lookupAcademicHeadline, lookupAcademicSubjectHeadline, type AcademicHeadlineRow } from "./vicdata-reference";
import { FAMILY_REQUIRED_SUBJECTS, IGCSE_INFERRED, igcseFamilyIncomplete } from "./igcse-words";
import { igcseExclusionLikely, type AcademicSchoolProfile } from "./academic-data-view";

export const INDEPENDENT_GROUP = "Independent schools";
const CHUNK = 300;

/** The one test on one school's GCSE headline rows (any order) and its establishment type group. */
export function igcseFromHeadline(typeGroup: string | null, rows: Pick<AcademicHeadlineRow, "period" | "measures">[]): boolean {
  const ks4 = rows.map((r) => ({ period: r.period, measures: r.measures })).sort((a, b) => a.period - b.period);
  return igcseExclusionLikely({ establishmentTypeGroup: typeGroup, ks4 } as unknown as AcademicSchoolProfile);
}

async function independentUrns(): Promise<string[]> {
  const supabase = createServerAnonSupabaseClient();
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("schools").select("urn").eq("establishment_type_group", INDEPENDENT_GROUP).order("urn").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as { urn: string }[]).map((r) => r.urn));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Every school in England the IGCSE rule takes out of GCSE rankings (only independent schools can be). */
export function igcseEngland(): Promise<Set<string>> {
  return cachedReference("igcse:england", async () => {
    const urns = await independentUrns();
    const chunks: string[][] = [];
    for (let i = 0; i < urns.length; i += CHUNK) chunks.push(urns.slice(i, i + CHUNK));
    const byUrn = new Map<string, AcademicHeadlineRow[]>();
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < chunks.length) {
        const c = chunks[next++];
        for (const r of await lookupAcademicHeadline({ entityIds: c, ksStage: "ks4" })) (byUrn.get(r.entity_id) ?? byUrn.set(r.entity_id, []).get(r.entity_id)!).push(r);
      }
    }));
    const out = new Set<string>();
    for (const [u, rows] of byUrn) if (igcseFromHeadline(INDEPENDENT_GROUP, rows)) out.add(u);
    return out;
  });
}

/** Which of these schools the IGCSE rule takes out of GCSE rankings. */
export async function igcseAmong(urns: Iterable<string>): Promise<Set<string>> {
  const all = await igcseEngland();
  return new Set(Array.from(urns).filter((u) => all.has(u)));
}

// 0.8 IGCSE subjects (R-IGCSE-SUBJECT): an IGCSE school is ranked in the subjects it entered as GCSE and
// in the families that are complete at it; only whole-school measures and incomplete families leave it
// out. The families each IGCSE school can't be ranked in, by year: the shared inference
// (igcseFamilyIncomplete) on its GCSE subjects with entries that year. Read once an hour, like the flag.
export function igcseFamiliesOut(): Promise<Map<string, Record<string, string[]>>> {
  return cachedReference("igcse:families-out", async () => {
    const urns = Array.from(await igcseEngland());
    const subjects = new Map<string, Map<number, Set<string>>>();
    for (let i = 0; i < urns.length; i += CHUNK) {
      for (const r of await lookupAcademicSubjectHeadline({ entityIds: urns.slice(i, i + CHUNK), ksStage: "ks4", bucket: "all" })) {
        if (!(r.entries_total > 0)) continue;
        const byPeriod = subjects.get(r.entity_id) ?? subjects.set(r.entity_id, new Map()).get(r.entity_id)!;
        (byPeriod.get(r.period) ?? byPeriod.set(r.period, new Set()).get(r.period)!).add(r.subject);
      }
    }
    const out = new Map<string, Record<string, string[]>>();
    for (const u of urns) {
      const byPeriod: Record<string, string[]> = {};
      for (const [period, subs] of subjects.get(u) ?? new Map<number, Set<string>>()) {
        const fams = Object.keys(IGCSE_INFERRED).concat(Object.keys(FAMILY_REQUIRED_SUBJECTS)).filter((f, i, a) => a.indexOf(f) === i && igcseFamilyIncomplete(f, true, subs));
        if (fams.length) byPeriod[String(period)] = fams;
      }
      out.set(u, byPeriod);
    }
    return out;
  });
}

/** The IGCSE schools left out of one family's ranking in one year (its family incomplete that year). */
export async function igcseFamilyOut(familyId: string, period: number | null): Promise<Set<string>> {
  const all = await igcseFamiliesOut();
  const out = new Set<string>();
  for (const [u, byPeriod] of all) {
    const years = Object.keys(byPeriod).map(Number);
    // A ranking of each school's latest figure: the school's latest year with GCSE entries decides.
    const year = period ?? (years.length ? Math.max(...years) : null);
    if (year !== null && (byPeriod[String(year)] ?? []).includes(familyId)) out.add(u);
  }
  return out;
}

/** Attach the incomplete families to IGCSE schools' profiles (ks4IgcseFamiliesOut), for views that judge them in the browser. */
export async function withIgcseFamilies<P extends { urn: string; ks4IgcseFamiliesOut?: Record<string, string[]> }>(profiles: P[]): Promise<P[]> {
  const all = await igcseFamiliesOut();
  return profiles.map((p) => (all.has(p.urn) ? { ...p, ks4IgcseFamiliesOut: all.get(p.urn)! } : p));
}
