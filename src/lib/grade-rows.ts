// VicData 0.6.2: a school's per-grade rows over four years (2021/22-2024/25), from either of
// the two sources the S1 reconciliation proved equal (docs/v0.6/grade_rollup_reconciliation_v1.md):
//
//   the raw DfE facts  modern (dfe_ks4_subject_entries; dfe_ks5_subject_results +
//                      dfe_tlevel_results, 2023/24 on) and historic (the _historic siblings,
//                      2021/22-2022/23), parsed here
//   the rollup         academic_subject_grade_rollup through the proposed anon RPC
//                      academic_subject_grade_rollup_lookup (KS4 only: at KS5 it has no
//                      zero-entry grade rows, which the app draws)
//
// Pure (no fetch), so the parsing, the historic label mapping (R-HISTORIC-GRADE-LABELS) and
// the agreement of the two KS4 paths are pinned by src/lib/grade-rows.test.ts. The fetching
// is academic-data-view.ts's (fetchSchoolGradeRows), server routes only.
import type { ReferenceFact } from "./vicdata-reference";

// Mirrors academic-data-view.ts's SubjectGradeCount (that module re-exports this one).
export type SubjectGradeCount = {
  qualificationType: string;
  subject: string;
  period: number;
  grade: string;
  entries: number;
  // DfE's own "size" (A-level-equivalent size) for this row, from the third breakdown
  // segment at KS5. Kept because points are size x challenge and the AVERAGE is over
  // size-weighted entries, so a grade row without its size cannot be scored at all.
  // null at KS4, whose breakdowns genuinely carry no size segment (and on rollup rows,
  // which sum over size).
  sizeWeight: number | null;
};

// The DfE total rows, which are not grades. "Total exam entries" / "Total" are the modern
// labels (and KS5 historic's); "Total number entered" is KS4 historic's own, which read raw
// would become a "grade" of the whole entry (S1 §3).
export const SUBJECT_TOTAL_LABELS = new Set(["Total exam entries", "Total"]);
export const HISTORIC_TOTAL_LABELS = new Set([...SUBJECT_TOTAL_LABELS, "Total number entered"]);
export const ALL_SUBJECTS_PSEUDO_ROW = "All subjects";

// The academic years each source covers (period P = P/(P+1)). The historic sources also
// hold 2020/21, but as totals only (no grades: the teacher-assessed year).
export const MODERN_GRADE_FROM = 2023;
export const HISTORIC_GRADE_FROM = 2021;
export const HISTORIC_GRADE_TO = 2022;

export const HISTORIC_GRADE_SOURCE = {
  ks4: "dfe_ks4_subject_entries_historic",
  ks5: "dfe_ks5_subject_results_historic",
} as const;

// ------------------------------------------------------------ R-HISTORIC-GRADE-LABELS
//
// DfE's 2021/22-2022/23 KS5 files write vocational grades as short codes ("*", "D", "M",
// "P", "DD", "*DD" ...) where 2023/24 on writes them out ("Distinction*", "Distinction",
// "Distinction-Distinction" ...). "*" and "D" are also A-level grades, so read raw a BTEC
// would land on the A-level scale (bestScale), its bands would give no figure and Grade
// counts would show letters. So the codes are mapped to the modern words, by qualification:
//
//   always      BTEC, OCR Cambridge Technical, Other General Qualification, Advanced
//               Extension Award (Distinction / Merit): vocational scales only
//   VRQ         only in a set (subject x qualification x size x year) carrying a code no
//               A-level-type scale has (M, P, HM, HP, or a double/triple award code): VRQ
//               Level 3 mixes A*-E sets with Distinction-Pass ones, and its "*" and "D"
//               mean A* and D in the former
//   never       A level, AS, EPQ, Core Maths, FSMQ, IB, Pre-U: "*" (A*) and "D" are theirs
//
// KS4's historic labels need no mapping: they use the same encodings 2023/24 still does
// ("*2", "D1", "M2" ...), and "No result" / "Covid impacted" were already non-grades. KS5's
// "COVID result" and "Supp" are non-grades too (NON_GRADE_VALUES, subject-grades.ts).
export const VOCATIONAL_SHORT_CODES: Record<string, string> = {
  "*": "Distinction*",
  D: "Distinction",
  HM: "High merit",
  M: "Merit",
  HP: "High pass",
  P: "Pass",
  "**": "Distinction*-Distinction*",
  "*D": "Distinction*-Distinction",
  DD: "Distinction-Distinction",
  DM: "Distinction-Merit",
  MM: "Merit-Merit",
  MP: "Merit-Pass",
  PP: "Pass-Pass",
  "***": "Distinction*-Distinction*-Distinction*",
  "**D": "Distinction*-Distinction*-Distinction",
  "*DD": "Distinction*-Distinction-Distinction",
  DDD: "Distinction-Distinction-Distinction",
  DDM: "Distinction-Distinction-Merit",
  DMM: "Distinction-Merit-Merit",
  MMM: "Merit-Merit-Merit",
  MMP: "Merit-Merit-Pass",
  MPP: "Merit-Pass-Pass",
  PPP: "Pass-Pass-Pass",
};
// The codes no A-level-type scale has: their presence marks a VRQ set as vocational.
const VOCATIONAL_ONLY = new Set(Object.keys(VOCATIONAL_SHORT_CODES).filter((c) => c !== "*" && c !== "D"));

const ALWAYS_VOCATIONAL = /^(BTEC|OCR Cambridge Technical|Other General Qualification|Advanced Extension Award)/;

export type HistoricLabelPolicy = "always" | "if-set-vocational" | "never";

export function historicLabelPolicy(qualificationType: string): HistoricLabelPolicy {
  if (ALWAYS_VOCATIONAL.test(qualificationType)) return "always";
  if (/^VRQ/.test(qualificationType)) return "if-set-vocational";
  return "never";
}

// One historic KS5 grade label, in its modern words. `setLabels`: every grade label of the
// set this row belongs to (zero-entry rows included), for VRQ's per-set decision.
export function mapHistoricKs5Grade(qualificationType: string, grade: string, setLabels: ReadonlySet<string>): string {
  const modern = VOCATIONAL_SHORT_CODES[grade];
  if (!modern) return grade;
  const policy = historicLabelPolicy(qualificationType);
  if (policy === "always") return modern;
  if (policy === "if-set-vocational" && [...setLabels].some((l) => VOCATIONAL_ONLY.has(l))) return modern;
  return grade;
}

// --------------------------------------------------------------------------- parsing

// The per-grade rows of raw subject facts (not the Total rows). `historic`: the facts are a
// _historic source's -- its own total label is dropped too, only 2021/22-2022/23 is kept
// (2020/21 is totals only), and at KS5 the vocational short codes take their modern words.
export function parseSubjectGradeDistribution(facts: ReferenceFact[], historic?: "ks4" | "ks5"): SubjectGradeCount[] {
  const totals = historic ? HISTORIC_TOTAL_LABELS : SUBJECT_TOTAL_LABELS;
  const rows: SubjectGradeCount[] = [];
  const setKey = (f: ReferenceFact, parts: string[]) => `${f.entity_id}|${f.period}|${parts.slice(0, -1).join("::")}`;
  // KS5 historic: every label in each set first, for VRQ's per-set decision.
  const setLabels = new Map<string, Set<string>>();
  if (historic === "ks5") {
    for (const f of facts) {
      const parts = f.breakdown.split("::");
      const k = setKey(f, parts);
      const s = setLabels.get(k) ?? new Set<string>();
      s.add(parts[parts.length - 1]);
      setLabels.set(k, s);
    }
  }
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    if (historic && (f.period < HISTORIC_GRADE_FROM || f.period > HISTORIC_GRADE_TO)) continue;
    const parts = f.breakdown.split("::");
    let grade = parts[parts.length - 1];
    if (totals.has(grade)) continue;
    const [qualificationType, subject] = parts;
    if (subject === ALL_SUBJECTS_PSEUDO_ROW) continue;
    // KS5 breakdowns are qualification::subject::size::grade; KS4's carry no size.
    const rawSize = parts.length >= 4 ? Number.parseFloat(parts[2]) : Number.NaN;
    const sizeWeight = Number.isFinite(rawSize) ? rawSize : null;
    if (historic === "ks5") grade = mapHistoricKs5Grade(qualificationType, grade, setLabels.get(setKey(f, parts)) ?? new Set());
    rows.push({ qualificationType, subject, period: f.period, grade, entries: f.value_numeric, sizeWeight });
  }
  return rows;
}

// One row of academic_subject_grade_rollup_lookup (docs/v0.6/proposed_sql/).
export type GradeRollupRow = {
  entity_id: string;
  ks_stage: string;
  subject: string;
  qualification_type: string;
  grade: string;
  period: number;
  entries: number | string;
};

export function gradeRowsFromRollup(rows: GradeRollupRow[]): Map<string, SubjectGradeCount[]> {
  const byUrn = new Map<string, SubjectGradeCount[]>();
  for (const r of rows) {
    const row: SubjectGradeCount = { qualificationType: r.qualification_type, subject: r.subject, period: r.period, grade: r.grade, entries: Number(r.entries), sizeWeight: null };
    const list = byUrn.get(r.entity_id);
    if (list) list.push(row);
    else byUrn.set(r.entity_id, [row]);
  }
  return byUrn;
}

// The facts path's rows for each school: modern + historic, parsed, optionally one subject.
export function gradeRowsFromFacts(stage: "ks4" | "ks5", modern: ReferenceFact[], historic: ReferenceFact[], subject?: string | null): Map<string, SubjectGradeCount[]> {
  const byUrn = new Map<string, SubjectGradeCount[]>();
  const add = (facts: ReferenceFact[], hist: boolean) => {
    const groups = new Map<string, ReferenceFact[]>();
    for (const f of facts) {
      const g = groups.get(f.entity_id);
      if (g) g.push(f);
      else groups.set(f.entity_id, [f]);
    }
    for (const [urn, fs] of groups) {
      let rows = parseSubjectGradeDistribution(fs, hist ? stage : undefined);
      if (!hist) rows = rows.filter((r) => r.period >= MODERN_GRADE_FROM);
      if (subject) rows = rows.filter((r) => r.subject === subject);
      const list = byUrn.get(urn);
      if (list) list.push(...rows);
      else byUrn.set(urn, rows);
    }
  };
  add(historic, true);
  add(modern, false);
  return byUrn;
}

// A row's identity for comparing the two paths (sizes summed: the rollup sums over size).
export function gradeRowKey(r: Pick<SubjectGradeCount, "qualificationType" | "subject" | "period" | "grade">): string {
  return `${r.qualificationType}::${r.subject}::${r.period}::${r.grade}`;
}
