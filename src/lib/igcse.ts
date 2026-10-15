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
import { lookupAcademicHeadline, type AcademicHeadlineRow } from "./vicdata-reference";
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
