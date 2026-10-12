// VicData 0.7 admissions r2: subject-area (family) names for the strengths view, as the subject
// family lookup itself names them (subject_families, ingest repo). Server-only; public, cached an hour.
import { cachedReference } from "../server-cache";
import { lookupAcademicSubjectFamily } from "../vicdata-reference";

export function familyLabels(urn: string, stage: "ks4" | "ks5", period: number): Promise<Record<string, string>> {
  return cachedReference(`adm:family-labels:${urn}:${stage}:${period}`, async () => {
    const rows = await lookupAcademicSubjectFamily({ entityIds: [urn], ksStage: stage, periodMin: period - 2, periodMax: period });
    const out: Record<string, string> = {};
    for (const r of rows) if (r.family_id && r.family_label) out[r.family_id] = r.family_label;
    return out;
  });
}
