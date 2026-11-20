// VicData speed plan §4.2 item 1: each school's SMT Academic figures, worked out once per school and year.
// Server-only. Pure: no reads here.
//
// SMT Academic compares the school with every school in its set. Everything it needs of a set's school
// is that school's own figures -- its entries, each qualification group's entries and points, its value
// added on each line, its entries and average grade in each GCSE subject area -- plus, in its latest
// year, its subject rows (for the subject-by-subject comparisons, which match subjects by the viewing
// school's titles). `yearFigures` works those out from the school's own rows; the Academic builder
// (academic.ts) reads every set school through `Members`, which is either
//   - membersFromRaw: today's reads (every set school's rows, value added and area rows), each school
//     and year worked out by yearFigures on first use; or
//   - membersFromStore (smt-figures-store.ts): the same yearFigures output, built ahead by
//     scripts/build-smt-figures.ts into smt_school_figures, with the subject rows of one year.
// One implementation of every per-school figure, so the two can't disagree (the parity rule).
import type { AcademicSubjectFamilyRow } from "../vicdata-reference";
import type { QualRow, VaFact } from "./academic-data";
import { groupOfQualification, type RealGroup } from "./qual-groups";

/** The subject value-added file's qualification for each line's "All subjects" row (A level: DfE's
 * headline is the figure, this row only its entries). */
export const VA_LINE_QUAL = { alevel: /^GCE A level$/, epq: /^Extended Project/, coremaths: /^Core Maths/, as: /^GCE AS level \(All\)/, ib: /^International Baccalaureate$/ } as const;
export type VaLine = keyof typeof VA_LINE_QUAL;
const VA_LINES = Object.keys(VA_LINE_QUAL) as VaLine[];

type VaLite = Omit<VaFact, "urn" | "period">;
export type FamLite = Pick<AcademicSubjectFamilyRow, "avg_point_score" | "entries_total">;

/** One school's figures in one year at one key stage. Short keys: it is stored once per school and year. */
export type YearFigures = {
  /** every entry at the level (the page's one total, R-SMT-ENTRIES-ONE-TOTAL) */
  e: number;
  /** Post-16: each qualification group with rows -- [entries, points per entry over the rows with points] */
  g?: Partial<Record<RealGroup, [number, number | null]>>;
  /** Post-16: each line's "All subjects" value-added row, the first the file has */
  v?: Partial<Record<VaLine, VaLite>>;
  /** GCSE: entries by subject area (the rows' own family) */
  a?: Record<string, number>;
  /** GCSE: each subject area's rollup row (bucket "all"), the first the rollup has */
  f?: Record<string, FamLite>;
};
export const NO_FIGURES: YearFigures = { e: 0 };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** A school's figures in one year, from that school's rows that year (in the reads' own order). */
export function yearFigures(stage: "ks4" | "ks5", rows: readonly QualRow[], va: readonly VaFact[], fam: readonly AcademicSubjectFamilyRow[]): YearFigures {
  const out: YearFigures = { e: sum(rows.map((r) => r.entries)) };
  if (stage === "ks5") {
    const groups = new Set(rows.map((r) => groupOfQualification(r.qualification)).filter((g): g is RealGroup => g !== null));
    if (groups.size) {
      out.g = {};
      for (const g of groups) {
        const all = rows.filter((r) => groupOfQualification(r.qualification) === g);
        const rs = all.filter((r) => r.avg !== null);
        const e = sum(rs.map((r) => r.entries));
        out.g[g] = [sum(all.map((r) => r.entries)), e ? sum(rs.map((r) => r.avg! * r.entries)) / e : null];
      }
    }
    for (const k of VA_LINES) {
      const r = va.find((x) => VA_LINE_QUAL[k].test(x.qualification) && x.subject === "All subjects");
      if (r) (out.v ??= {})[k] = { qualification: r.qualification, subject: r.subject, size: r.size, value: r.value, lo: r.lo, hi: r.hi, entries: r.entries };
    }
  } else {
    for (const r of rows) if (r.familyId !== null) (out.a ??= {})[r.familyId] = (out.a[r.familyId] ?? 0) + r.entries;
    for (const r of fam) {
      if ((r.bucket ?? "all") !== "all") continue;
      if (!out.f?.[r.family_id]) (out.f ??= {})[r.family_id] = { avg_point_score: r.avg_point_score, entries_total: r.entries_total };
    }
  }
  return out;
}

/** Every set school as Academic reads it. */
export type Members = {
  year(u: string, y: number): YearFigures;
  /** The school's subject rows that year (the reads' order). The store holds them for one year only. */
  subjectRows(u: string, y: number): readonly QualRow[];
  /** The school's value-added rows that year (Post-16; the reads' order). The store: one year only. */
  vaRows(u: string, y: number): readonly VaFact[];
};

export const levelEntries = (m: Members, u: string, y: number) => m.year(u, y).e;
export const groupEntries = (m: Members, u: string, y: number, g: RealGroup) => m.year(u, y).g?.[g]?.[0] ?? 0;
export const groupPoints = (m: Members, u: string, y: number, g: RealGroup) => m.year(u, y).g?.[g]?.[1] ?? null;
export const areaEntries = (m: Members, u: string, y: number, area: string) => m.year(u, y).a?.[area] ?? 0;
export const areaRow = (m: Members, u: string, y: number, area: string): FamLite | undefined => m.year(u, y).f?.[area];
export function vaLine(m: Members, u: string, y: number, line: VaLine): VaFact | null {
  const r = m.year(u, y).v?.[line];
  return r ? { urn: u, period: y, ...r } : null;
}

/** Rows grouped by a key, each group in the rows' own order. */
export function indexBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return m;
}
const NONE: never[] = [];

/** Today's reads as Members: each school and year worked out on first use. */
export function membersFromRaw(stage: "ks4" | "ks5", rows: readonly QualRow[], va: readonly VaFact[], fam: readonly AcademicSubjectFamilyRow[]): Members {
  const rowsIx = indexBy(rows, (r) => `${r.urn}|${r.period}`);
  const vaIx = indexBy(va, (r) => `${r.urn}|${r.period}`);
  const famIx = indexBy(fam, (r) => `${r.entity_id}|${Number(r.period)}`);
  const memo = new Map<string, YearFigures>();
  return {
    year(u, y) {
      const k = `${u}|${y}`;
      let f = memo.get(k);
      if (!f) memo.set(k, (f = yearFigures(stage, rowsIx.get(k) ?? NONE, vaIx.get(k) ?? NONE, famIx.get(k) ?? NONE)));
      return f;
    },
    subjectRows: (u, y) => rowsIx.get(`${u}|${y}`) ?? NONE,
    vaRows: (u, y) => vaIx.get(`${u}|${y}`) ?? NONE,
  };
}
