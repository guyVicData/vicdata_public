// VicData 0.8 feedback 15 Nov, build A (A1, D2; R-SUBJECT-MATCH): a subject is matched across schools
// through an equivalence, never the exact published name.
//
// The Chase publishes its A level as "Art and Design"; the sixth forms around it publish "Fine Art",
// "Photography", "Graphics" and so on. Matched on the exact name, every comparison found nothing ("1st of 1
// schools", empty charts, all 10 nearest "no figure"). Here:
//   - DfE's subject code would be the natural key, but the app's data has none (the ingest pairs names from
//     the files: subject-latest-names.ts), so the equivalence is a list of titles;
//   - the A level (and AS) Art and Design titles are one subject for comparisons, "Art and Design (all
//     titles)". Each school's own title still shows in its own tables and charts;
//   - qualification labels are normalised across years: DfE's 2020/21 Post-16 rows say "A level" where
//     later years say "GCE A level".
// Only Art and Design is grouped (Guy's decision D2, 15 Nov). The other title families the data holds are
// listed in the build A report for Guy to confirm before any is grouped.
//
// Pure and client-safe.
import { latestSubjectName } from "./subject-latest-names";

/** The group's name wherever it is shown for comparisons. */
export const ART_AND_DESIGN_ALL = "Art and Design (all titles)";

/** The A level Art and Design titles DfE publishes (latest names; the stored "Art and Design (Fine Art)" etc.
 * read as these through subject-latest-names.ts). Every title the data held on 15 Nov 2026. */
export const ART_AND_DESIGN_TITLES: readonly string[] = ["Art and Design", "Fine Art", "Photography", "Graphics", "Textiles", "3D Studies", "Critical Studies"];

/** The qualifications the group applies to: GCE A level and AS (the titles exist only there, but a BTEC
 * "Art and Design" is a different qualification and stays apart). */
const GROUPED_QUALS = new Set(["GCE A level", "GCE AS level"]);

/** DfE's 2020/21 Post-16 labels, as later years spell them. */
const QUAL_ALIASES: Readonly<Record<string, string>> = { "A level": "GCE A level", "AS level": "GCE AS level" };

/** A qualification label as the latest years spell it ("A level" in 2020/21 = "GCE A level"). */
export function normaliseQualification(q: string): string;
export function normaliseQualification(q: string | null | undefined): string | null | undefined;
export function normaliseQualification(q: string | null | undefined): string | null | undefined {
  if (q === null || q === undefined) return q;
  return QUAL_ALIASES[q] ?? q;
}

/** The older labels a qualification was published under (for reads filtered by qualification). */
export function qualificationAliases(q: string): string[] {
  return Object.entries(QUAL_ALIASES).filter(([, v]) => v === q).map(([k]) => k);
}

type Phase = "ks2" | "ks4" | "ks5" | null | undefined;

/** Whether a subject (in a qualification, at a phase) belongs to a matched group of titles. */
export function isGrouped(phase: Phase, subject: string, qualificationType?: string | null): boolean {
  if (phase !== "ks5") return false;
  if (qualificationType != null && !GROUPED_QUALS.has(normaliseQualification(qualificationType))) return false;
  return ART_AND_DESIGN_TITLES.includes(latestSubjectName(subject));
}

/** The key a subject is matched on across schools: the group's name for a grouped title, else the subject
 * under its latest name. */
export function subjectMatchKey(phase: Phase, subject: string, qualificationType?: string | null): string {
  return isGrouped(phase, subject, qualificationType) ? ART_AND_DESIGN_ALL : latestSubjectName(subject);
}

/** Every title a subject is matched with (itself alone when it is in no group). */
export function matchedTitles(phase: Phase, subject: string, qualificationType?: string | null): string[] {
  return isGrouped(phase, subject, qualificationType) ? [...ART_AND_DESIGN_TITLES] : [subject];
}

/** Whether two (subject, qualification) pairs are the same subject for a comparison. At Post-16 the
 * qualification must match too (normalised across years); at GCSE the subject alone. */
export function sameSubject(phase: Phase, a: { subject: string; qualificationType?: string | null }, b: { subject: string; qualificationType?: string | null }): boolean {
  if (subjectMatchKey(phase, a.subject, a.qualificationType) !== subjectMatchKey(phase, b.subject, b.qualificationType)) return false;
  if (phase !== "ks5" || a.qualificationType == null || b.qualificationType == null) return true;
  return normaliseQualification(a.qualificationType) === normaliseQualification(b.qualificationType);
}

/** The label a comparison names a subject by: "Art and Design (all titles)" for a grouped title. */
export function comparisonLabel(phase: Phase, subject: string, qualificationType?: string | null): string {
  return isGrouped(phase, subject, qualificationType) ? ART_AND_DESIGN_ALL : subject;
}

/**
 * Several titles' figures in one year as one: entries summed; average points weighted by each title's
 * entries, over the titles that publish points (a title with too few entries publishes none, so the merged
 * figure covers the published titles only). Null where nothing is published.
 */
export function mergeFigures(rows: { entries: number | null; points: number | null }[]): { entries: number | null; points: number | null } {
  const withE = rows.filter((r) => r.entries !== null);
  const entries = withE.length ? withE.reduce((t, r) => t + (r.entries as number), 0) : null;
  const scored = rows.filter((r) => r.points !== null);
  if (!scored.length) return { entries, points: null };
  const w = scored.reduce((t, r) => t + (r.entries ?? 0), 0);
  const points = w > 0 ? scored.reduce((t, r) => t + (r.points as number) * (r.entries ?? 0), 0) / w : scored.reduce((t, r) => t + (r.points as number), 0) / scored.length;
  return { entries, points };
}

/** Rows of several titles, merged per period (mergeFigures), ascending. `make` builds the output row. */
export function mergeByPeriod<R extends { period: number }, O>(rows: R[], figures: (r: R) => { entries: number | null; points: number | null }, make: (period: number, merged: { entries: number | null; points: number | null }, parts: R[]) => O): O[] {
  const by = new Map<number, R[]>();
  for (const r of rows) (by.get(r.period) ?? by.set(r.period, []).get(r.period)!).push(r);
  return Array.from(by.keys())
    .sort((a, b) => a - b)
    .map((p) => {
      const parts = by.get(p)!;
      return make(p, mergeFigures(parts.map(figures)), parts);
    });
}

/**
 * England's figure for each group, from England's per-title rows (entries-weighted points), keyed as the
 * dashboard's England index keys a Post-16 subject: "{group}::{qualification}". Added beside the titles' own
 * values, so a grouped title is compared with England's group (englandValueAt reads it first).
 */
export function groupEnglandValues(rows: { subject: string; qualification_type?: string | null; period: number; avg_value: number | string | null; entries_total: number | string | null }[], phase: "ks4" | "ks5"): { key: string; period: number; value: number }[] {
  const by = new Map<string, { entries: number | null; points: number | null }[]>();
  for (const r of rows) {
    if (!isGrouped(phase, r.subject, r.qualification_type)) continue;
    const q = normaliseQualification(r.qualification_type ?? "");
    const k = `${phase === "ks5" ? `${ART_AND_DESIGN_ALL}::${q}` : ART_AND_DESIGN_ALL}@${r.period}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push({ entries: r.entries_total === null ? null : Number(r.entries_total), points: r.avg_value === null ? null : Number(r.avg_value) });
  }
  const out: { key: string; period: number; value: number }[] = [];
  for (const [k, parts] of by) {
    const m = mergeFigures(parts);
    const at = k.lastIndexOf("@");
    if (m.points !== null) out.push({ key: k.slice(0, at), period: Number(k.slice(at + 1)), value: m.points });
  }
  return out;
}
