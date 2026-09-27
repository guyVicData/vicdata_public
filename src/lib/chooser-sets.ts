// Teacher view comparator chooser -- what the Comparisons column reads once a teacher
// presses Done. Server-only.
//
//   - A list of schools (10 nearest, schools in an LA, a school added by name) goes
//     through rankFixedSets(), the same path saved sets already take, so an unsaved
//     choice is ranked and charted exactly like a saved one.
//   - A ranking is a POPULATION, not a list: every school of this phase in England or a
//     region, narrowed by the chooser's filterboxes. It is ranked on the dashboard's own
//     headline measure (HEADLINE_MEASURE: A-level APS at Post-16, Attainment 8 at GCSE),
//     and the column is given the top 15 and the ten schools either side of this one --
//     a population of thousands cannot be drawn school by school, and the note says
//     where the school actually stands in the whole of it.
import { lookupAcademicHeadline } from "./vicdata-reference";
import { HEADLINE_MEASURE, type KsStage } from "./academic-data-view";
import { rankFixedSets, type RankedRow, type SchoolSeries } from "./teacher-view-comparator-series";
import { buildRankingPopulation, type RankingPhase } from "./ranking-population";
import { matchesRanking, type PopulationRow, type RankingFilters } from "./comparator-chooser";

// ------------------------------------------------------------------- population cache

// A population changes only when the census snapshot does: kept six hours, shared by the
// population route (the chooser's counts) and the ranking resolver below (Done).
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; rows: PopulationRow[] }>();

export async function cachedRankingPopulation(regionCode: string | null, phase: RankingPhase, laName: string | null): Promise<PopulationRow[]> {
  const key = `${regionCode ?? "england"}|${phase}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const rows = await buildRankingPopulation({ regionCode, nation: regionCode ? null : "england" }, phase, laName);
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

// ------------------------------------------------------------------------- resolvers

export type ChooserSetResult = { rows: RankedRow[]; seriesByUrn: Record<string, SchoolSeries>; note: string | null };

export async function resolveFixedSet(targetUrn: string, phase: KsStage, urns: string[]): Promise<ChooserSetResult> {
  const { ranked, seriesByUrn } = await rankFixedSets(targetUrn, [{ id: "chooser", urns }], phase);
  return { rows: ranked.chooser ?? [], seriesByUrn, note: null };
}

// Snagging round 1 Part 4: what the Comparisons column shows for a ranking in place of a
// map -- the school's rank in the WHOLE population and that population's true average,
// both on the ranking's own measure (HEADLINE_MEASURE). The rows above are a deliberately
// skewed sample (the top and the school's neighbours), so no average is taken from them.
export type RankingFigures = {
  matched: number;
  ranked: number;
  targetRank: number | null;
  // The school's own latest figure, and its figure per year.
  target: { period: number; value: number } | null;
  targetSeries: { period: number; value: number }[];
  // The population's mean over every school in it with a published figure: of each
  // school's latest (the basis the rank is on), and per year (for the graphs).
  averageLatest: number | null;
  average: { period: number; value: number; schools: number }[];
};

const TOP = 15;
const EITHER_SIDE = 5;

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export async function resolveRankingSet(
  targetUrn: string,
  targetName: string,
  phase: RankingPhase,
  filters: RankingFilters,
  laName: string | null,
): Promise<ChooserSetResult & RankingFigures> {
  const population = await cachedRankingPopulation(filters.scope.kind === "region" ? filters.scope.code : null, phase, laName);
  const matched = population.filter((r) => matchesRanking(r, filters));
  const urns = matched.map((r) => r[0]);
  // A ranking can exclude the school itself (a state school looking at independent
  // girls' boarding schools). It is still placed against them -- that is the question
  // being asked -- and the note says it is not one of them.
  const inRanking = urns.includes(targetUrn);
  if (!inRanking) urns.push(targetUrn);

  // Each school's latest published headline figure. Earlier years only as a fallback for a
  // school with no figure in the most recent one, the same "latest real value" rule
  // latestMeasureAt applies to every other set.
  const measure = HEADLINE_MEASURE[phase];
  const headline = await lookupAcademicHeadline({ entityIds: urns, ksStage: phase });
  const latest = new Map<string, { period: number; value: number }>();
  for (const h of headline) {
    const v = Number(h.measures[measure]);
    if (!Number.isFinite(v)) continue;
    const cur = latest.get(h.entity_id);
    if (!cur || h.period > cur.period) latest.set(h.entity_id, { period: h.period, value: v });
  }
  const order = urns
    .filter((u) => latest.has(u))
    .sort((a, b) => latest.get(b)!.value - latest.get(a)!.value || a.localeCompare(b));
  const idx = order.indexOf(targetUrn);
  const shown = new Set(order.slice(0, TOP));
  if (idx >= 0) for (const u of order.slice(Math.max(0, idx - EITHER_SIDE), idx + EITHER_SIDE + 1)) shown.add(u);
  shown.delete(targetUrn);

  const { rows, seriesByUrn } = await resolveFixedSet(targetUrn, phase, Array.from(shown));
  const others = order.length - (idx >= 0 ? 1 : 0);
  const showing = `Showing the top ${TOP} and the ${EITHER_SIDE} either side.`;
  const note =
    idx < 0
      ? `${targetName} has no published figure to rank. Showing the top ${TOP} of ${order.length.toLocaleString()} with one (${matched.length.toLocaleString()} in this ranking).`
      : inRanking
        ? `${targetName} ranks ${ordinal(idx + 1)} of ${order.length.toLocaleString()} with a published figure (${matched.length.toLocaleString()} in this ranking). ${showing}`
        : `${targetName} is not itself in this ranking. Placed against its ${others.toLocaleString()} schools with a published figure, it would be ${ordinal(idx + 1)}. ${showing}`;
  // The set's average -- the ranking's own schools only: the school itself counts where it
  // is in the ranking, and not where it has only been placed against it.
  const members = new Set(inRanking ? urns : urns.filter((u) => u !== targetUrn));
  const memberLatest = order.filter((u) => members.has(u)).map((u) => latest.get(u)!.value);
  const byPeriod = new Map<number, number[]>();
  const targetSeries: { period: number; value: number }[] = [];
  for (const h of headline) {
    const v = Number(h.measures[measure]);
    if (!Number.isFinite(v)) continue;
    if (h.entity_id === targetUrn) targetSeries.push({ period: h.period, value: v });
    if (!members.has(h.entity_id)) continue;
    byPeriod.set(h.period, [...(byPeriod.get(h.period) ?? []), v]);
  }
  const mean = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);
  return {
    rows,
    seriesByUrn,
    note,
    matched: matched.length,
    ranked: order.length,
    targetRank: idx >= 0 ? idx + 1 : null,
    target: latest.get(targetUrn) ?? null,
    targetSeries: targetSeries.sort((a, b) => a.period - b.period),
    averageLatest: mean(memberLatest),
    average: Array.from(byPeriod)
      .sort((a, b) => a[0] - b[0])
      .map(([period, vs]) => ({ period, value: mean(vs)!, schools: vs.length })),
  };
}
