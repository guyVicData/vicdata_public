// VicData 0.8 SMT Academic by qualification: the reads Academic's views are drawn from. Server-only.
// Every figure comes through an existing read (prompt §7); each is cached (server-cache.ts) per school,
// set or qualification, never scanned per request:
//   subject x qualification rows   academic_subject_qualification_headline (the rollup: entries and points,
//                                   by subject and qualification, every year): subjects, groups, entries
//   subject value added            dfe_ks5_subject_value_added, for the school and its set only
//   England's subject value added  the same source, one qualification's "All subjects" row, read once an
//                                   hour (NEW: England places for EPQ, Core Maths, AS and IB value added)
//   headline figures               population.ts (DfE's headline snapshot, read once an hour)
import { cachedReference } from "../server-cache";
import { callReferenceRpc, lookupAcademicSubjectHeadline, lookupAcademicSubjectQualificationHeadline, lookupReferenceData } from "../vicdata-reference";
import { schoolSyncStamp } from "../school-sync-stamp";
import { latestSubjectName } from "../subject-latest-names";
import { VA_SUBJECT_MATCHES } from "./va-subject-matches";

export type QualRow = { urn: string; qualification: string; subject: string; familyId: string | null; period: number; entries: number; avg: number | null };
export type VaFact = { urn: string; qualification: string; subject: string; size: string; period: number; value: number | null; lo: number | null; hi: number | null; entries: number | null };

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const key = (urns: string[]) => Array.from(new Set(urns)).sort().join(",");

/** Every subject x qualification row for these schools at a key stage, from `from` on. */
export async function qualRows(urns: string[], stage: "ks4" | "ks5", from: number): Promise<QualRow[]> {
  if (!urns.length) return [];
  const sync = await schoolSyncStamp();
  return cachedReference(`smt:qrows:${stage}:${from}:${key(urns)}:sync:${sync}`, async () => {
    if (stage === "ks4") {
      // GCSE: the subject rollup (the qualification rollup is Post-16 only). GCSE is almost all one
      // qualification, DfE's GCSE (9-1) full course, which the rollup's subjects are.
      const rows = await lookupAcademicSubjectHeadline({ entityIds: Array.from(new Set(urns)), ksStage: "ks4", periodMin: from, bucket: "all" });
      return rows
        .map((r) => ({ urn: r.entity_id, qualification: "GCSE", subject: r.subject, familyId: r.family_id ?? null, period: Number(r.period), entries: n(r.entries_total) ?? 0, avg: n(r.avg_point_score) }))
        .filter((r) => r.entries > 0);
    }
    const rows = await lookupAcademicSubjectQualificationHeadline({ entityIds: Array.from(new Set(urns)), ksStage: stage, periodMin: from });
    return rows
      .map((r) => ({ urn: r.entity_id, qualification: r.qualification_type, subject: r.subject, familyId: r.family_id ?? null, period: Number(r.period), entries: n(r.entries_total) ?? 0, avg: n(r.avg_point_score) }))
      .filter((r) => r.entries > 0);
  });
}

// "{qualification}::{subject}::{size}::{measure}"
function parseVa(facts: { entity_id: string; period: number; breakdown: string; value_numeric: number | null }[]): VaFact[] {
  const by = new Map<string, VaFact>();
  for (const f of facts) {
    const [qualification, subject, size, measure] = f.breakdown.split("::");
    if (!measure) continue;
    const k = `${f.entity_id}|${f.period}|${qualification}|${subject}|${size}`;
    const row = by.get(k) ?? by.set(k, { urn: f.entity_id, qualification, subject, size, period: Number(f.period), value: null, lo: null, hi: null, entries: null }).get(k)!;
    const v = n(f.value_numeric);
    if (measure === "value_added") row.value = v;
    else if (measure === "value_added_lower_ci") row.lo = v;
    else if (measure === "value_added_upper_ci") row.hi = v;
    else if (measure === "entries_count") row.entries = v;
  }
  return Array.from(by.values()).filter((r) => r.value !== null);
}

/** Subject value added (every qualification, every subject, the "All subjects" rows too) for these schools. */
export async function subjectVa(urns: string[]): Promise<VaFact[]> {
  if (!urns.length) return [];
  return cachedReference(`smt:subject-va:${key(urns)}`, async () => parseVa(await lookupReferenceData({ sourceId: "dfe_ks5_subject_value_added", entityIds: Array.from(new Set(urns)) })));
}

/** England: every school's value added for one qualification's "All subjects" row in one year (the
 * breakdown, size included, as a school's own row spells it). Once an hour per qualification and year. */
export async function englandQualVa(breakdownPrefix: string, period: number): Promise<VaFact[]> {
  return cachedReference(`smt:england-va:${breakdownPrefix}:${period}`, async () =>
    parseVa(await lookupReferenceData({ sourceId: "dfe_ks5_subject_value_added", periodMin: period, periodMax: period, breakdowns: ["value_added", "value_added_lower_ci", "value_added_upper_ci", "entries_count"].map((m) => `${breakdownPrefix}::${m}`) })),
  );
}

// ------------------------------------------------------------------------------- value-added subject names

export type VaMatch = { subject: string; familyId: string | null; vicdata: boolean; outside: boolean };
export type VaMatcher = { match: (qualification: string, subject: string) => VaMatch; source: "database" | "file" };

// The EPQ and the IB's whole-diploma and core rows sit outside the subject areas.
const isOutside = (qualification: string, subject: string) =>
  /^Extended Project/.test(qualification) || (qualification === "International Baccalaureate" && subject === "Baccalaureate") || qualification === "IBO Diploma Programme Core";

type LabelRow = { ks_stage: string; stored_label: string; qualification: string; latest_label: string };

/** The KS5 rows of the shared crosswalk (academic_subject_label_map_lookup), read once an hour. */
export function ks5LabelMap(): Promise<LabelRow[]> {
  return cachedReference("smt:label-map", async () => ((await callReferenceRpc("academic_subject_label_map_lookup", {})) as LabelRow[]).filter((r) => r.ks_stage === "ks5"));
}

/** A value-added row's subject as the results file names it, and its area (R-VA-SUBJECT-MATCH). Round 2
 * (A1, approved 8 Nov 2026): from the database's crosswalk once the ingest carries the value-added names
 * (subject_label_map rows for their qualification); until then from va-subject-matches.ts, the same list.
 * A qualification row is VicData's match; a row for every qualification is DfE's own rename. */
export async function vaMatcher(familyOf: (s: string) => string | null): Promise<VaMatcher> {
  let rows: LabelRow[] = [];
  try {
    rows = await ks5LabelMap();
  } catch {
    rows = [];
  }
  const byQual = new Map(rows.filter((r) => r.qualification).map((r) => [`${r.qualification}::${r.stored_label}`, r.latest_label]));
  const every = new Map(rows.filter((r) => !r.qualification).map((r) => [r.stored_label, r.latest_label]));
  // The database carries the value-added names once any qualification row is a value-added one (the one
  // older qualification row, VRQ Construction, is KS4's latest-names rule).
  const fromDb = Array.from(byQual.keys()).some((k) => VA_SUBJECT_MATCHES[k] !== undefined);
  if (!fromDb) return { source: "file", match: (q, s) => fileMatch(q, s, familyOf) };
  return {
    source: "database",
    match: (q, s) => {
      const own = byQual.get(`${q}::${s}`);
      const name = own ?? every.get(s) ?? latestSubjectName(s);
      const outside = isOutside(q, s);
      return { subject: name, familyId: outside ? null : familyOf(name), vicdata: own !== undefined, outside };
    },
  };
}

function fileMatch(qualification: string, subject: string, familyOf: (s: string) => string | null): VaMatch {
  const m = VA_SUBJECT_MATCHES[`${qualification}::${subject}`];
  if (m) return { subject: m.results ?? latestSubjectName(subject), familyId: m.area, vicdata: m.vicdata, outside: m.outside };
  const s = latestSubjectName(subject);
  return { subject: s, familyId: familyOf(s), vicdata: false, outside: isOutside(qualification, subject) };
}
