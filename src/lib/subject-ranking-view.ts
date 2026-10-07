// VicData 0.6.6: what the Teacher view draws from a subject ranking (src/lib/subject-ranking.ts,
// /api/teacher/subject-ranking). Client-safe: types and pure helpers only.
//
// The table's window. The server sends the top RANK_WINDOW, RANK_WINDOW either side of the
// school and the bottom RANK_BOTTOM, each with its real position and rank. The card shows the
// top CARD_TOP, a break, then CARD_AROUND either side of the school -- one continuous block
// when the school is within the top CARD_BLOCK; full screen shows the whole window, a break
// wherever positions jump (R-RANKING-WINDOW).
import type { RankMeasure, SubjectRanking } from "./subject-ranking";
import type { RankingFilters } from "./comparator-chooser";

export type SubjectRankingPayload = SubjectRanking & {
  // Every school the window, the change list or their series names: name and sector.
  names: Record<string, { name: string; independent: boolean | null }>;
};

// loading: asked, no answer yet; pending: the server is still computing ("available shortly",
// asked again); error: it failed; ready: the answer.
export type SubjectRankingState = { status: "loading" } | { status: "pending" } | { status: "error" } | { status: "ready"; data: SubjectRankingPayload };

export type SubjectRankingBody = {
  urn: string;
  phase: "ks4" | "ks5";
  filters: RankingFilters;
  subject: string;
  familyId: string | null;
  qualificationType: string | null;
  measure: RankMeasure;
  period: number | null;
};

export const CARD_TOP = 3;
export const CARD_AROUND = 5;
export const CARD_BLOCK = 8;

/** The rows to draw, in position order, with null where positions jump (a break row). */
export function windowCut<T extends { pos: number; isTarget: boolean }>(rows: T[], fullscreen: boolean): (T | null)[] {
  const ordered = [...rows].sort((a, b) => a.pos - b.pos);
  const target = ordered.find((r) => r.isTarget) ?? null;
  const keep = fullscreen
    ? ordered
    : ordered.filter((r) =>
        target === null
          ? r.pos <= CARD_BLOCK
          : target.pos <= CARD_BLOCK
            ? r.pos <= target.pos + CARD_AROUND
            : r.pos <= CARD_TOP || Math.abs(r.pos - target.pos) <= CARD_AROUND,
      );
  const out: (T | null)[] = [];
  keep.forEach((r, i) => {
    if (i > 0 && r.pos > keep[i - 1].pos + 1) out.push(null);
    out.push(r);
  });
  return out;
}

/** "GCSE History results" / "GCSE History entries": what the ranked schools have. */
export function rankedNoun(subjectLabel: string, measure: RankMeasure): string {
  return `${subjectLabel} ${measure.kind === "entries" ? "entries" : "results"}`;
}

// ------------------------------------------------------- shared by both drawing paths
// ComparisonsPanels (the host) and the config renderer's builders (view-series) draw a subject
// ranking from these, so the two paths can't word or rank it differently.

type Named = { urn: string; name: string; independent?: boolean | null };
type WindowLine = { urn: string; pos: number; rank: number; value: number };

const nth = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n.toLocaleString()}${teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

/** How many schools the school is ranked against (it is counted only where it is one of them). */
export const rankedAgainst = (d: Pick<SubjectRanking, "ranked" | "inRanking" | "target">) => (d.inRanking || !d.target ? d.ranked : d.ranked - 1);

/** "3,565 schools with GCSE History results" */
export const populationPhrase = (d: Pick<SubjectRanking, "ranked" | "inRanking" | "target">, noun: string) => `${rankedAgainst(d).toLocaleString()} schools with ${noun}`;

/** The table's rows: the window, each school at its real position and shared rank. */
export function subjectRankRows(window: WindowLine[], schools: Named[], targetUrn: string | null, targetName: string, format: (v: number) => string) {
  const byUrn = new Map(schools.map((s) => [s.urn, s]));
  return window.map((w) => ({
    key: w.urn,
    name: w.urn === targetUrn ? targetName : byUrn.get(w.urn)?.name ?? w.urn,
    rank: w.rank,
    value: w.value,
    valueLabel: format(w.value),
    distanceKm: null,
    independent: byUrn.get(w.urn)?.independent ?? null,
    isTarget: w.urn === targetUrn,
    pos: w.pos,
  }));
}

/** The change list's rows: the population's change window, the school as "own". */
export function subjectChangeRows(window: WindowLine[], schools: Named[], targetUrn: string | null, targetName: string, colours: { own: string; other: string }) {
  const byUrn = new Map(schools.map((s) => [s.urn, s]));
  return window.map((w) => ({
    key: w.urn === targetUrn ? "own" : w.urn,
    label: w.urn === targetUrn ? targetName : byUrn.get(w.urn)?.name ?? w.urn,
    colour: w.urn === targetUrn ? colours.own : colours.other,
    value: w.value,
    pos: w.pos,
    rank: w.rank,
  }));
}

/** The tiles' scope lines and the whole-school tile (FrameRankingFigures' 0.6.6 fields). */
export function subjectTileDetails(d: SubjectRanking, noun: string, yearLabel: string | null) {
  const year = yearLabel ? `, ${yearLabel}` : "";
  const schoolsThatYear = d.target ? d.average.find((a) => a.period === d.target!.period)?.schools ?? null : null;
  return {
    rankDetail: d.inRanking ? `of ${populationPhrase(d, noun)}${year}` : `placed against ${populationPhrase(d, noun)}${year} (not itself in this ranking)`,
    averageDetail: schoolsThatYear ? `average across these ${schoolsThatYear.toLocaleString()} schools` : "average across these schools",
  };
}

/** The column's note under "Compared against": where the school stands, the population and who is left out. */
export function subjectRankingNote(d: SubjectRanking, targetName: string, noun: string, yearLabel: string | null, minEntries: number): string {
  const inYear = yearLabel ? ` in ${yearLabel}` : "";
  const lead = !d.target || d.targetRank === null
    ? `${targetName} has no ${noun.replace(/ (results|entries)$/, "")} figure${inYear} to rank.`
    : d.inRanking
      ? `${targetName} ranks ${nth(d.targetRank)} of ${populationPhrase(d, noun)}${inYear}.`
      : `${targetName} is not itself in this ranking. Placed against its ${populationPhrase(d, noun)}${inYear}, it would be ${nth(d.targetRank)}.`;
  const left: string[] = [];
  if (d.noFigure) left.push(`${d.noFigure.toLocaleString()} have no figure that year`);
  if (d.belowMin) left.push(`${d.belowMin.toLocaleString()} have fewer than ${minEntries} entries`);
  const tail = ` ${d.matched.toLocaleString()} schools are in this ranking${left.length ? `; ${left.join(" and ")}` : ""}.`;
  return `${lead}${tail} The table shows the top and the schools around ${targetName}.`;
}

/** A ranking comparator's change table: the population change list's window, each school's
 * figures over the table's years, its real change rank and position (YearTable draws the
 * window from them, never 1..N of its rows). */
export function subjectChangeTableSeries(
  window: WindowLine[],
  schools: (Named & { values: (number | null)[] })[],
  schoolPeriods: number[],
  tablePeriods: number[],
  targetUrn: string | null,
  targetName: string,
  colours: { own: string; other: string },
) {
  const byUrn = new Map(schools.map((s) => [s.urn, s]));
  return window.map((w) => {
    const s = byUrn.get(w.urn);
    return {
      key: w.urn === targetUrn ? "own" : w.urn,
      label: w.urn === targetUrn ? targetName : s?.name ?? w.urn,
      colour: w.urn === targetUrn ? colours.own : colours.other,
      values: tablePeriods.map((p) => (s ? s.values[schoolPeriods.indexOf(p)] ?? null : null)),
      rank: w.rank,
      pos: w.pos,
    };
  });
}
