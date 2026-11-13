// VicData 0.8 front door (B8, B9, B12): the Teacher home's figures and the walks' data, for one school,
// phase and focus subject. Pure: built from the same rows and the same helpers the dashboard reads
// (subjectItemsOf, categoryItemsOf, schoolSubjectsOf, ownHeadlineRows, subjectEntriesAt, subjectPointsAt,
// englandValueAt), so a figure on a home tile or a walk screen is the dashboard's figure. The loader
// (teacher-data.ts) fetches the rows; this shapes them. No database here.
import type { AcademicSubjectHeadlineEntry, SubjectEntry } from "@/lib/academic-data-view";
import type { SubjectGradeCount } from "@/lib/grade-rows";
import { familyFor } from "@/lib/teacher-view-catalogue";
import { englandIndexOf, englandValueAt, ownHeadlineRows, subjectEntriesAt, subjectPointsAt, type EnglandAverages } from "@/lib/teacher-view-measures";
import { candidateItemsOf, categoryItemsOf, focusQualificationFamily, schoolSubjectsOf, subjectItemsOf, type SubjectItem } from "@/lib/teacher-view-populations";
import { qualificationShortLabel } from "@/lib/teacher-view-theme";

export type TeacherPhaseId = "ks4" | "ks5";
type Series = (number | null)[];

export type SubjectRow = { key: string; label: string; subject: string; qualificationType: string; focus: boolean; entries: Series; points: Series };
export type SchoolRow = { urn: string; name: string; distanceKm: number | null; isTarget: boolean; entries: Series; points: Series };
export type AreaLine = { name: string; entries: Series; points: Series } | null;

export type TeacherModel = {
  phase: TeacherPhaseId;
  school: { urn: string; name: string };
  /** Every subject the school runs (the switcher), by entries. */
  subjects: { key: string; label: string; qualLabel: string }[];
  focus: { key: string; subject: string; qualificationType: string; label: string; qualLabel: string } | null;
  periods: number[];
  latest: number | null;
  /** The focus's subject category (the taxonomy family the dashboard's Context uses) and its subjects, focus first. */
  category: { label: string | null; rows: SubjectRow[] };
  /** Every comparable subject in the school, focus first. */
  whole: { rows: SubjectRow[] };
  /** England's figure for the focus, per period (points only: R-NO-GRADE-RATE-GEO). */
  england: { points: Series };
  /** The focus subject in the school's LA, region and England (entries and points), per period. */
  area: { la: AreaLine; region: AreaLine; england: AreaLine };
  /** The school, then the 10 nearest (the dashboard's default set), their focus-subject figures per period. */
  nearest: SchoolRow[];
  nearestNote: string | null;
  /** The focus's grades in the latest year with grades: count per grade, best first. */
  grades: { period: number; rows: { grade: string; count: number }[]; englandShare: Record<string, number> | null } | null;
};

export type TeacherModelInput = {
  phase: TeacherPhaseId;
  school: { urn: string; name: string };
  entries: SubjectEntry[];
  gradeRows: SubjectGradeCount[];
  headline: AcademicSubjectHeadlineEntry[];
  qualificationHeadline: AcademicSubjectHeadlineEntry[];
  england: EnglandAverages | null;
  area: { la: AreaRows | null; region: AreaRows | null; england: AreaRows | null };
  nearest: { urn: string; name: string; distanceKm: number | null; headline: AcademicSubjectHeadlineEntry[]; qualificationHeadline: AcademicSubjectHeadlineEntry[] }[];
  nearestNote: string | null;
  englandGradeShare?: Record<string, number> | null;
};
export type AreaRows = { name: string; rows: { period: number; entries: number | null; avgPointScore: number | null }[] };

/** The best subject to open on: the person's first ticked subject the school still runs, else the largest. */
export function pickFocus(items: { key: string }[], ticked: string[], wanted: string | null): string | null {
  if (wanted && items.some((i) => i.key === wanted)) return wanted;
  return ticked.find((k) => items.some((i) => i.key === k)) ?? items[0]?.key ?? null;
}

export function buildTeacherModel(input: TeacherModelInput, focusKey: string | null, ticked: string[] = []): TeacherModel {
  const { phase } = input;
  const items: SubjectItem[] = subjectItemsOf(input.entries);
  const key = pickFocus(items, ticked, focusKey);
  const focusItem = items.find((i) => i.key === key) ?? null;
  const periods = Array.from(new Set([...input.headline, ...input.qualificationHeadline].map((h) => h.period))).sort((a, b) => a - b);
  const latest = periods.length ? periods[periods.length - 1] : null;

  const rowsAt = (rows: AcademicSubjectHeadlineEntry[], p: number) => rows.filter((h) => h.period === p);
  const seriesFor = (item: { subject: string; qualificationType: string }, headline: AcademicSubjectHeadlineEntry[], qh: AcademicSubjectHeadlineEntry[]) => {
    const own = ownHeadlineRows(phase, item, headline, qh);
    return {
      entries: periods.map((p) => subjectEntriesAt(rowsAt(own, p))),
      points: periods.map((p) => subjectPointsAt(phase, item, rowsAt(own, p))),
    };
  };
  const rowOf = (i: SubjectItem): SubjectRow => ({ key: i.key, label: i.label, subject: i.subject, qualificationType: i.qualificationType, focus: i.key === key, ...seriesFor(i, input.headline, input.qualificationHeadline) });

  const { inFocusQualFamily } = focusQualificationFamily(phase, focusItem);
  const categoryItems = candidateItemsOf(categoryItemsOf(focusItem, items, input.headline, inFocusQualFamily), phase);
  const wholeItems = schoolSubjectsOf(items, focusItem, key, phase);
  const englandIndex = englandIndexOf(input.england);

  const areaLine = (a: AreaRows | null): AreaLine =>
    a ? { name: a.name, entries: periods.map((p) => a.rows.find((r) => r.period === p)?.entries ?? null), points: periods.map((p) => a.rows.find((r) => r.period === p)?.avgPointScore ?? null) } : null;

  const nearest: SchoolRow[] = focusItem
    ? [
        { urn: input.school.urn, name: input.school.name, distanceKm: 0, isTarget: true, ...seriesFor(focusItem, input.headline, input.qualificationHeadline) },
        ...input.nearest.map((n) => ({ urn: n.urn, name: n.name, distanceKm: n.distanceKm, isTarget: false, ...seriesFor(focusItem, n.headline, n.qualificationHeadline) })),
      ]
    : [];

  let grades: TeacherModel["grades"] = null;
  if (focusItem) {
    const own = input.gradeRows.filter((g) => g.subject === focusItem.subject && g.qualificationType === focusItem.qualificationType);
    const gp = own.length ? Math.max(...own.map((g) => g.period)) : null;
    if (gp !== null) {
      const byGrade = new Map<string, number>();
      for (const g of own.filter((x) => x.period === gp)) byGrade.set(g.grade, (byGrade.get(g.grade) ?? 0) + g.entries);
      grades = { period: gp, rows: Array.from(byGrade, ([grade, count]) => ({ grade, count })).sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade)), englandShare: input.englandGradeShare ?? null };
    }
  }

  return {
    phase,
    school: input.school,
    subjects: items.map((i) => ({ key: i.key, label: i.label, qualLabel: qualificationShortLabel(phase, i.qualificationType) })),
    focus: focusItem ? { key: focusItem.key, subject: focusItem.subject, qualificationType: focusItem.qualificationType, label: focusItem.label, qualLabel: qualificationShortLabel(phase, focusItem.qualificationType) } : null,
    periods,
    latest,
    category: { label: focusItem ? familyFor(input.headline, focusItem.subject)?.label ?? null : null, rows: categoryItems.map(rowOf) },
    whole: { rows: wholeItems.map(rowOf) },
    england: { points: focusItem ? periods.map((p) => englandValueAt(input.england, englandIndex, phase, focusItem, p)) : [] },
    area: { la: areaLine(input.area.la), region: areaLine(input.area.region), england: areaLine(input.area.england) },
    nearest,
    nearestNote: input.nearestNote,
    grades,
  };
}

// Best grade first: 9..1 at GCSE, A*..E at A level, then the rest (U, X) last.
const GRADE_RANK = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "A*", "A", "B", "C", "D", "E", "D*", "D", "M", "P", "U"];
function gradeOrder(g: string): number {
  const i = GRADE_RANK.indexOf(g.trim());
  return i < 0 ? 999 : i;
}

// ------------------------------------------------------------------------------------------- figures

export const lastOf = (s: Series): number | null => (s.length ? s[s.length - 1] : null);
export const prevOf = (s: Series): number | null => (s.length > 1 ? s[s.length - 2] : null);
/** The first real value and its index. */
export function firstReal(s: Series): { i: number; v: number } | null {
  const i = s.findIndex((v) => v !== null);
  return i < 0 ? null : { i, v: s[i] as number };
}

/** Rank by value, largest first; ties share a place (the dashboards' rankByValue rule). */
export function rankOf(rows: { key: string; value: number | null }[], key: string): { rank: number; of: number } | null {
  const real = rows.filter((r) => r.value !== null) as { key: string; value: number }[];
  const me = real.find((r) => r.key === key);
  if (!me) return null;
  return { rank: 1 + real.filter((r) => r.value > me.value).length, of: real.length };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The three Teacher home tiles' figures (B9): real or none, never a placeholder. */
export function teacherTileFigures(m: TeacherModel): { many: TileFigure | null; well: TileFigure | null; nearby: TileFigure | null } {
  const f = m.whole.rows.find((r) => r.focus) ?? m.category.rows.find((r) => r.focus);
  const p16 = m.phase === "ks5";
  const entries = f ? lastOf(f.entries) : null;
  const points = f ? lastOf(f.points) : null;
  const rank = m.latest !== null && m.nearest.length > 1 ? rankOf(m.nearest.map((n) => ({ key: n.urn, value: lastOf(n.points) })), m.school.urn) : null;
  return {
    many: entries !== null ? { figure: entries.toLocaleString("en-GB"), unit: p16 ? "students this year" : "pupils this year" } : null,
    well: points !== null ? { figure: points.toFixed(p16 ? 1 : 1), unit: "average points" } : null,
    nearby: rank ? { figure: ordinal(rank.rank), unit: `of ${rank.of}: us and the ${rank.of - 1} nearest` } : null,
  };
}
export type TileFigure = { figure: string; unit: string };
