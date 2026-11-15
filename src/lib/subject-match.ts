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
// Build A grouped Art and Design only (D2). Build B (Guy's grouping decision, 15 Nov) adds the families in
// SUBJECT_FAMILIES: Religious Studies with Religious Education, the Design and Technology A level titles,
// Drama and Theatre Studies with the IB's Theatre Studies, and GCSE Art and Design with GCSE Photography.
//
// Pure and client-safe.
import { latestSubjectName } from "./subject-latest-names";

/** The group's name wherever it is shown for comparisons. */
export const ART_AND_DESIGN_ALL = "Art and Design (all titles)";

/** The A level Art and Design titles DfE publishes (latest names; the stored "Art and Design (Fine Art)" etc.
 * read as these through subject-latest-names.ts). Every title the data held on 15 Nov 2026. */
export const ART_AND_DESIGN_TITLES: readonly string[] = ["Art and Design", "Fine Art", "Photography", "Graphics", "Textiles", "3D Studies", "Critical Studies"];

type Phase = "ks2" | "ks4" | "ks5" | null | undefined;

/** DfE's IB components (Post-16). A family that spans the IB reads them as the GCE A level. */
const IB_QUALS: readonly string[] = ["IBO Higher level component", "IBO Standard level component"];
const A_LEVEL_QUALS: readonly string[] = ["GCE A level", "GCE AS level"];

/**
 * A family of titles matched as one subject for comparisons. 0.8 feedback B (15 Nov, Guy's grouping decision,
 * logged in OPEN_QUESTIONS): beside Art and Design, Religious Studies with Religious Education, the Design and
 * Technology A level titles, Drama and Theatre Studies with the IB's Theatre Studies, and GCSE Art and Design
 * with GCSE Photography. English, Mathematics, Music, Classics and Computing titles stay separate.
 *   - `phase`: where the family applies (GCSE and Post-16 titles are separate families);
 *   - `quals`: the qualifications (as the latest years spell them) its titles are grouped in; a title in any
 *     other qualification (a BTEC "Art and Design") stays itself. `qualPrefix` gates on a label's start instead;
 *   - `acrossIB`: the IB components count as the GCE A level, so an IB school's "Theatre Studies" is compared
 *     with an A level "Drama and Theatre Studies" (DfE scores both on its one Post-16 points scale).
 */
export type SubjectFamily = { label: string; phase: "ks4" | "ks5"; titles: readonly string[]; quals?: readonly string[]; qualPrefix?: string; acrossIB?: boolean };

export const SUBJECT_FAMILIES: readonly SubjectFamily[] = [
  { label: ART_AND_DESIGN_ALL, phase: "ks5", titles: ART_AND_DESIGN_TITLES, quals: A_LEVEL_QUALS },
  { label: "Religious Studies (all titles)", phase: "ks5", titles: ["Religious Studies", "Religious Education"], quals: [...A_LEVEL_QUALS, ...IB_QUALS], acrossIB: true },
  {
    label: "Design and Technology (all titles)",
    phase: "ks5",
    titles: ["Design and Technology (Product Design)", "Design and Technology (Engineering)", "Design and Technology (Textiles Technology)", "Three Dimensional Design (3D Design)"],
    quals: A_LEVEL_QUALS,
  },
  { label: "Drama and Theatre (all titles)", phase: "ks5", titles: ["Drama and Theatre Studies", "Theatre Studies"], quals: [...A_LEVEL_QUALS, ...IB_QUALS], acrossIB: true },
  { label: "Religious Studies (all titles)", phase: "ks4", titles: ["Religious Studies", "Religious Education"], qualPrefix: "GCSE" },
  { label: "Art and Design (all titles)", phase: "ks4", titles: ["Art and Design", "Photography"], qualPrefix: "GCSE" },
];

/** The family a subject (in a qualification, at a phase) belongs to, or null. A missing qualification is
 * taken as in the family's (a GCSE headline row, a saved choice). */
export function familyOf(phase: Phase, subject: string, qualificationType?: string | null): SubjectFamily | null {
  if (phase !== "ks4" && phase !== "ks5") return null;
  const name = latestSubjectName(subject);
  const q = qualificationType == null ? null : normaliseQualification(qualificationType);
  return (
    SUBJECT_FAMILIES.find(
      (f) => f.phase === phase && f.titles.includes(name) && (q === null || (f.quals ? f.quals.includes(q) : f.qualPrefix ? q.startsWith(f.qualPrefix) : true)),
    ) ?? null
  );
}

/** The qualification two rows are compared in: normalised across years, and an IB component as the GCE A
 * level inside a family that spans the IB. */
export function matchQualification(phase: Phase, subject: string, q: string): string {
  const n = normaliseQualification(q);
  return IB_QUALS.includes(n) && familyOf(phase, subject, n)?.acrossIB ? "GCE A level" : n;
}

/** Every qualification label to read for a subject's comparison in a qualification: the label, its older
 * spelling (2020/21's "A level") and, in a family that spans the IB, the IB components (for the A level). */
export function readQualifications(phase: Phase, subject: string, q: string, opts: { aliases?: boolean } = {}): string[] {
  const withAliases = (x: string) => [x, ...(opts.aliases === false ? [] : qualificationAliases(normaliseQualification(x)))];
  const out = withAliases(q);
  // An IB school's Theatre Studies reads the A level too; an A level reads the IB components.
  if (familyOf(phase, subject, q)?.acrossIB && matchQualification(phase, subject, q) === "GCE A level") for (const x of [...withAliases("GCE A level"), ...IB_QUALS]) if (!out.includes(x)) out.push(x);
  return out;
}

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

/** Whether a subject (in a qualification, at a phase) belongs to a matched group of titles. */
export function isGrouped(phase: Phase, subject: string, qualificationType?: string | null): boolean {
  return familyOf(phase, subject, qualificationType) !== null;
}

/** The key a subject is matched on across schools: the family's name for a grouped title, else the subject
 * under its latest name. */
export function subjectMatchKey(phase: Phase, subject: string, qualificationType?: string | null): string {
  return familyOf(phase, subject, qualificationType)?.label ?? latestSubjectName(subject);
}

/** Every title a subject is matched with (itself alone when it is in no group). */
export function matchedTitles(phase: Phase, subject: string, qualificationType?: string | null): string[] {
  const f = familyOf(phase, subject, qualificationType);
  return f ? [...f.titles] : [subject];
}

/** Whether two (subject, qualification) pairs are the same subject for a comparison. At Post-16 the
 * qualification must match too (normalised across years; an IB component as the A level in a family that
 * spans the IB); at GCSE the subject alone. */
export function sameSubject(phase: Phase, a: { subject: string; qualificationType?: string | null }, b: { subject: string; qualificationType?: string | null }): boolean {
  if (subjectMatchKey(phase, a.subject, a.qualificationType) !== subjectMatchKey(phase, b.subject, b.qualificationType)) return false;
  if (phase !== "ks5" || a.qualificationType == null || b.qualificationType == null) return true;
  return matchQualification(phase, a.subject, a.qualificationType) === matchQualification(phase, b.subject, b.qualificationType);
}

/** The label a comparison names a subject by: "Art and Design (all titles)" for a grouped title. */
export function comparisonLabel(phase: Phase, subject: string, qualificationType?: string | null): string {
  return familyOf(phase, subject, qualificationType)?.label ?? subject;
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
 * England's figure for each family, from England's per-title rows (entries-weighted points), keyed as the
 * dashboard's England index keys a subject: "{family}::{qualification}" at Post-16 (an IB component under the
 * A level in a family that spans the IB), "{family}" at GCSE. Added beside the titles' own values, so a grouped
 * title is compared with England's family (englandValueAt reads it first).
 */
export function groupEnglandValues(rows: { subject: string; qualification_type?: string | null; period: number; avg_value: number | string | null; entries_total: number | string | null }[], phase: "ks4" | "ks5"): { key: string; period: number; value: number }[] {
  const by = new Map<string, { entries: number | null; points: number | null }[]>();
  for (const r of rows) {
    const f = familyOf(phase, r.subject, r.qualification_type);
    if (!f) continue;
    const k = `${phase === "ks5" ? `${f.label}::${matchQualification(phase, r.subject, r.qualification_type ?? "")}` : f.label}@${r.period}`;
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
