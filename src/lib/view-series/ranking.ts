// VicData 0.6.1 S3b: the series builder for a ranking view. D5: rankings stay as today --
// Context's Ranked list (RankedList) over the page's subjects, Comparisons' Ranking
// (SchoolRankingTable) over the set's schools -- built from the same lib calls the hosts make
// (currentRowsWithDelta's order, rankedComparisons, rankByValue).
//
// 2 · View's ranking look, none of which changes a figure:
//   columns     which columns are drawn (rank, sector, value, change, distance, n, bar); the
//               preset's own set draws exactly the host's table / list
//   show        top 5 / all / around this school (or subject): two either side of it
//   alwaysSelf  the school (subject) is kept when "top 5" leaves it out
// Rows a look leaves out keep the others' ranks (a rank is a position in the whole list).
import type { RankingLook, ViewSpec } from "@/catalogue/viewspec";
import { changeOf, ENTRIES_MEASURE, formatChange, rankByValue, type Measure } from "@/lib/teacher-view-panels";
import { rankedComparisons } from "@/lib/teacher-view-comparisons";
import { comparisonsLeadTitle, type CandidatesFrame, type ComparisonsFrame, type SubjectsFrame, type SeriesFrame } from "./frames";
import type { RankColumnKey, RankRowData, SchoolRankRowData, ViewSeries } from "./series";
import { currentHeading, currentRows, currentTitle } from "./subjects";

export const LIST_COLUMNS: RankColumnKey[] = ["rank", "value"];
export const SCHOOL_COLUMNS: RankColumnKey[] = ["rank", "sector", "value", "distance"];

const sameColumns = (a: RankColumnKey[], b: RankColumnKey[]) => a.length === b.length && a.every((c, i) => c === b[i]);

// The rows a look shows, in rank order: every row, the first five (the focused one kept
// where `alwaysSelf`), or the five around the focused one.
export function cutRanked<T extends { key: string }>(ranked: T[], selfKey: string | null, look: RankingLook): T[] {
  const show = look.show ?? "all";
  if (show === "all") return ranked;
  const i = selfKey ? ranked.findIndex((r) => r.key === selfKey) : -1;
  if (show === "around" && i >= 0) {
    const start = Math.max(0, Math.min(i - 2, ranked.length - 5));
    return ranked.slice(start, start + 5);
  }
  const top = ranked.slice(0, 5);
  if (look.alwaysSelf !== false && i >= 5) return [...top, ranked[i]];
  return top;
}

// A row's change from its own previous published year to the shown one, in the measure's
// honest change (R-NUMBER-TYPE-HONESTY).
function changeAt(measure: Measure, values: (number | null)[], idx: number): string | null {
  if (idx < 0 || values[idx] === null) return null;
  let prev: number | null = null;
  for (let i = idx - 1; i >= 0 && prev === null; i--) prev = values[i];
  const c = prev === null ? null : changeOf(measure, [prev, values[idx]]);
  return c === null ? null : formatChange(measure, c);
}

const shareOf = (value: number | null, max: number) => (value === null || max <= 0 ? null : Math.max(0, value) / max);

export function buildRanking(spec: ViewSpec, f: SeriesFrame): ViewSeries | null {
  if (spec.view.kind !== "ranking") return null;
  const look = spec.view.look;
  if (f.kind === "comparisons") return schoolRanking(look, f, !!spec.data.rows);
  return subjectList(look, f, !!spec.data.rows);
}

// The columns a list / table draws: the look's, else the host's (undefined = the host's own).
function columnsOf(look: RankingLook, host: RankColumnKey[]): RankColumnKey[] | undefined {
  return look.columns && !sameColumns(look.columns, host) ? look.columns : undefined;
}

// Context's Ranked list (and the same list over Results' or Candidates' subjects).
function subjectList(look: RankingLook, f: SubjectsFrame | CandidatesFrame, allRows: boolean): ViewSeries | null {
  if (f.subjects.length === 0) return null;
  const columns = columnsOf(look, LIST_COLUMNS);
  const want = (c: RankColumnKey) => !!columns?.includes(c);
  let focusKey: string | null;
  let ordered: { key: string; label: string; value: number | null; values: (number | null)[] }[];
  let measure: Measure;
  let idx: number;
  let heading: ViewSeries["heading"] = null;
  let title: ViewSeries["title"] = null;
  if (f.kind === "subjects") {
    if (f.currentBlocked) return null;
    const c = currentRows(f, !!f.benchmarkLabel);
    focusKey = c.focusedKey;
    ordered = c.barRows.map((r) => ({ key: r.s.key, label: r.s.label, value: r.value, values: r.s.values }));
    measure = f.measure;
    idx = f.state.latestIdx;
    heading = currentHeading(f);
    title = currentTitle(f);
  } else {
    idx = f.periods.length - 1;
    focusKey = (f.subjects.find((s) => s.key === f.focus) ?? f.subjects[0])?.key ?? null;
    ordered = f.subjects
      .map((s) => ({ key: s.key, label: s.label, value: idx >= 0 ? s.values[idx] ?? null : null, values: s.values }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    measure = ENTRIES_MEASURE;
    title = f.categoryLabel && allRows ? `Entries in ${f.categoryLabel}, ranked` : null;
  }
  const own = allRows ? ordered : ordered.filter((r) => r.key === focusKey);
  const cut = cutRanked(own, focusKey, look);
  const max = Math.max(0, ...cut.map((r) => r.value ?? 0));
  const rows: RankRowData[] = cut.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value,
    ...(cut !== own || !allRows ? { rank: ordered.indexOf(r) + 1 } : {}),
    ...(want("change") ? { change: changeAt(measure, r.values, idx) } : {}),
    ...(want("n") && measure.id === "entries" ? { n: r.value } : {}),
    ...(want("bar") ? { share: shareOf(r.value, max) } : {}),
  }));
  return {
    kind: "ranking",
    heading,
    title,
    leaf: { leaf: "rankedList", rows, measure, focusKey, ...(columns ? { columns } : {}), centred: `list:${focusKey}:${own.map((r) => r.key).join(",")}` },
  };
}

// Comparisons' Ranking: the set's schools ranked on the latest year (rankedComparisons).
function schoolRanking(look: RankingLook, f: ComparisonsFrame, allRows: boolean): ViewSeries | null {
  if (f.blocked || f.schools.length === 0) return null;
  const columns = columnsOf(look, SCHOOL_COLUMNS);
  const want = (c: RankColumnKey) => !!columns?.includes(c);
  let latestIdx = -1;
  for (let i = f.periods.length - 1; i >= 0 && latestIdx < 0; i--) if (f.schools.some((s) => s.values[i] !== null)) latestIdx = i;
  const valueAt = (urn: string) => (latestIdx >= 0 ? f.schools.find((s) => s.urn === urn)?.values[latestIdx] ?? null : null);
  const ranked = rankedComparisons(f.schools, valueAt);
  const rankOfUrn = rankByValue(ranked.map((r) => ({ key: r.urn, value: r.value })));
  const own = allRows ? ranked : ranked.filter((r) => r.isTarget);
  const target = ranked.find((r) => r.isTarget);
  const cut = cutRanked(
    own.map((r) => ({ ...r, key: r.urn })),
    target?.urn ?? null,
    look,
  );
  const max = Math.max(0, ...cut.map((r) => r.value ?? 0));
  const rows: SchoolRankRowData[] = cut.map((r) => ({
    key: r.urn,
    name: r.isTarget ? f.targetName : r.name,
    rank: rankOfUrn.get(r.urn) ?? null,
    value: r.value,
    valueLabel: r.value === null ? (r.igcseExcluded ? "not comparable" : "—") : f.measure.format(r.value),
    distanceKm: r.distanceKm ?? null,
    independent: r.independent ?? null,
    isTarget: r.isTarget,
    ...(want("change") ? { change: changeAt(f.measure, r.values, latestIdx) } : {}),
    ...(want("n") ? { n: latestIdx >= 0 ? r.counts?.[latestIdx] ?? null : null } : {}),
    ...(want("bar") ? { share: shareOf(r.value, max) } : {}),
  }));
  // R-MIN-ENTRIES: below the small-entries rule, a school is listed but not placed.
  if (allRows) {
    for (const s of f.tooFew ?? []) {
      rows.push({
        key: s.urn,
        name: s.isTarget ? f.targetName : s.name,
        rank: null,
        value: null,
        valueLabel: "too few entries",
        distanceKm: s.distanceKm ?? null,
        independent: s.independent ?? null,
        isTarget: s.isTarget,
        ...(want("change") ? { change: null } : {}),
        ...(want("n") ? { n: null } : {}),
        ...(want("bar") ? { share: null } : {}),
      });
    }
  }
  return {
    kind: "ranking",
    heading: null,
    title: comparisonsLeadTitle(f) ?? `Schools ranked by ${f.titleOn} in the ${f.setLabel.toLowerCase()}`,
    leaf: {
      leaf: "schoolRanking",
      rows,
      valueHeading: f.measure.id === "entries" ? "Entries" : "Result",
      targetName: f.targetName,
      ...(columns ? { columns } : {}),
      centred: rows.map((r) => r.key).join(","),
    },
  };
}
