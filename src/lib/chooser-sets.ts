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
import { placeWord } from "./view-series/tiles";
import { igcseEngland } from "./igcse";
import { igcseNotRankedLine, igcseTargetLine } from "./igcse-words";
import { lookupAcademicHeadline } from "./vicdata-reference";
import { HEADLINE_MEASURE, type KsStage } from "./academic-data-view";
import { rankFixedSets, type RankedRow, type SchoolSeries } from "./teacher-view-comparator-series";
import { buildRankingPopulation, type RankingPhase } from "./ranking-population";
import { matchesRanking, type PopulationRow, type RankingFilters } from "./comparator-chooser";
import { buildDefaultComparatorLists } from "./default-comparator-lists";
import { resolveNearestOption } from "./nearest-option";
import { precomputedPost16Neighbours } from "./post16-default-neighbours";
import { makeRankingPopulationCache } from "./ranking-population-cache";
import { schoolSyncStamp } from "./school-sync-stamp";

// ------------------------------------------------------------------- population cache

// Kept six hours or until the next school sync (ranking-population-cache.ts), shared by the
// population route (the chooser's counts) and the ranking resolver below (Done).
export const cachedRankingPopulation: (regionCode: string | null, phase: RankingPhase, laName: string | null) => Promise<PopulationRow[]> = makeRankingPopulationCache(
  (regionCode, phase, laName) => buildRankingPopulation({ regionCode, nation: regionCode ? null : "england" }, phase, laName),
  schoolSyncStamp,
);

// ------------------------------------------------------------------------- resolvers

// 0.8 IGCSE subjects (R-IGCSE-SUBJECT): at GCSE, where the set's whole-school rows leave IGCSE schools
// out, `subjectRows` keeps them for subject views (an IGCSE school is ranked in the subjects it entered
// as GCSE), with `subjectNote` for the set's caption there. Absent when nothing differs.
export type ChooserSetResult = { rows: RankedRow[]; seriesByUrn: Record<string, SchoolSeries>; note: string | null; subjectRows?: RankedRow[]; subjectNote?: string | null };

export async function resolveFixedSet(targetUrn: string, phase: KsStage, urns: string[]): Promise<ChooserSetResult> {
  const { ranked, subjectRanked, seriesByUrn } = await rankFixedSets(targetUrn, [{ id: "chooser", urns }], phase);
  return { rows: ranked.chooser ?? [], seriesByUrn, note: null, ...(subjectRanked.chooser ? { subjectRows: subjectRanked.chooser } : {}) };
}

// Snagging round 1 Part 4: what the Comparisons column shows for a ranking in place of a
// map -- the school's rank in the WHOLE population and that population's true average,
// both on the ranking's own measure (HEADLINE_MEASURE). The rows above are a deliberately
// skewed sample (the top and the school's neighbours), so no average is taken from them.
// R-RANKING-SAMPLE: rank and average from the whole population, never from the sample.
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
  // 0.8 audit fixes (1): at GCSE, the ranking's schools the IGCSE rule took out; the school is one.
  igcseOut?: number;
  targetIgcse?: boolean;
  // 0.8 audit fixes (8): the school shares its place with another ("=3rd").
  targetTied?: boolean;
};

// Comparator dropdown round (option A): what the Comparisons column shows until a teacher
// chooses -- the chooser's own "10 nearest schools", by the chooser's own rule (list1, or
// the boarding-quintile recipe via resolveNearestOption, the Data View's rule too), so the
// pill's default and the chooser hub's first row are one list. It replaces the old
// dashboard-route "Nearest 10 schools" preset (school_nearest_neighbours), a different
// algorithm, as the default.
export async function resolveDefaultNearest(targetUrn: string, phase: KsStage): Promise<ChooserSetResult & { count: number }> {
  // 0.6.7 B2: at Post-16, the precomputed list when it is current (post16-default-neighbours.ts:
  // the same schools in the same order this build gives); otherwise built as below.
  if (phase === "ks5") {
    const precomputed = await precomputedPost16Neighbours(targetUrn);
    if (precomputed) return { ...(await resolveFixedSet(targetUrn, phase, precomputed)), count: precomputed.length };
  }
  // 0.6.5 S4: at Post-16, the 10 nearest with Post-16 provision (same rules, plus that filter).
  const lists = await buildDefaultComparatorLists(targetUrn, { only: "nearest", post16: phase === "ks5", gcse: phase === "ks4" });
  const chosen = resolveNearestOption(lists.list1, lists.boardingBand, lists.boardingRecipe, null);
  const urns = (chosen?.schools ?? []).map((s) => s.urn).filter((u) => u !== targetUrn);
  const set = await resolveFixedSet(targetUrn, phase, urns);
  // 0.8 IGCSE subjects (R-IGCSE-SUBJECT): "10 nearest" for a subject is the 10 nearest by the same rules
  // with IGCSE schools in (they come back in for their GCSE subjects): the same build without the
  // IGCSE filter. Carried only where it differs from the whole-school ten.
  let subject: Pick<ChooserSetResult, "subjectRows" | "subjectNote"> = {};
  if (phase === "ks4" && lists.igcseSkipped && (lists.igcseSkipped.list1.length || lists.igcseSkipped.boardingRecipe.length)) {
    const all = await buildDefaultComparatorLists(targetUrn, { only: "nearest" });
    const chosenAll = resolveNearestOption(all.list1, all.boardingBand, all.boardingRecipe, null);
    const subjectUrns = (chosenAll?.schools ?? []).map((s) => s.urn).filter((u) => u !== targetUrn);
    if (subjectUrns.join(",") !== urns.join(",")) {
      const r = await rankFixedSets(targetUrn, [{ id: "subject", urns: subjectUrns }], phase);
      const igcseIn = subjectUrns.length - ((r.ranked.subject?.length ?? 1) - 1);
      Object.assign(set.seriesByUrn, r.seriesByUrn);
      subject = {
        subjectRows: r.subjectRanked.subject ?? r.ranked.subject ?? [],
        subjectNote: igcseIn
          ? `The ${subjectUrns.length} nearest schools, including ${igcseIn} not ranked at GCSE overall (mostly IGCSE): each is ranked in the subjects it entered as GCSE.`
          : null,
      };
    }
  }
  // 0.8 audit fixes (1, T6): at GCSE the list filled past IGCSE schools; where it did, the caption
  // says how many nearer schools aren't ranked at GCSE and the radius the ten reached.
  const skipped = lists.igcseSkipped ? (chosen === lists.boardingRecipe ? lists.igcseSkipped.boardingRecipe : lists.igcseSkipped.list1) : [];
  const reach = Math.max(0, ...(chosen?.schools ?? []).map((s) => s.distanceKm ?? 0));
  const nearer = skipped.filter((s) => s.urn !== targetUrn && s.distanceKm !== null && s.distanceKm <= reach).length;
  const note = nearer ? `${igcseNotRankedLine(nearer)}; the ${urns.length} nearest eligible reach ${Math.round(reach)} km.` : set.note;
  return { ...set, ...subject, note, count: urns.length };
}

const TOP = 15;
const EITHER_SIDE = 5;


export async function resolveRankingSet(
  targetUrn: string,
  targetName: string,
  phase: RankingPhase,
  filters: RankingFilters,
  laName: string | null,
): Promise<ChooserSetResult & RankingFigures> {
  const population = await cachedRankingPopulation(filters.scope.kind === "region" ? filters.scope.code : null, phase, laName);
  const matched = population.filter((r) => matchesRanking(r, filters));
  // 0.8 audit fixes (1, R-IGCSE-EVERYWHERE): at GCSE the IGCSE rule's schools leave the population
  // (rank, "out of" and average), not only the listed sample; a line says how many.
  const igcse = phase === "ks4" ? await igcseEngland() : new Set<string>();
  const targetIgcse = igcse.has(targetUrn);
  const urns = matched.map((r) => r[0]).filter((u) => !igcse.has(u));
  const igcseOut = matched.length - urns.length;
  // A ranking can exclude the school itself (a state school looking at independent
  // girls' boarding schools). It is still placed against them -- that is the question
  // being asked -- and the note says it is not one of them.
  const inRanking = urns.includes(targetUrn);
  if (!inRanking && !targetIgcse) urns.push(targetUrn);

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
  // 0.8 audit fixes (8, T2): tied schools share a place (standard competition ranking: two at 3rd,
  // then 5th), as subject rankings do; `idx` stays the position, for the schools listed around it.
  const mine = idx >= 0 ? latest.get(targetUrn)!.value : null;
  const place = mine === null ? null : 1 + order.filter((u) => latest.get(u)!.value > mine).length;
  const tied = mine !== null && order.some((u) => u !== targetUrn && latest.get(u)!.value === mine);
  const shown = new Set(order.slice(0, TOP));
  if (idx >= 0) for (const u of order.slice(Math.max(0, idx - EITHER_SIDE), idx + EITHER_SIDE + 1)) shown.add(u);
  shown.delete(targetUrn);

  const { rows, seriesByUrn } = await resolveFixedSet(targetUrn, phase, Array.from(shown));
  const others = order.length - (idx >= 0 ? 1 : 0);
  const showing = `Showing the top ${TOP} and the ${EITHER_SIDE} either side.`;
  const igcseLine = igcseNotRankedLine(igcseOut);
  const note = [
    targetIgcse
      ? `${igcseTargetLine(targetName)} Showing the top ${TOP} of ${order.length.toLocaleString()} with a published figure.`
      : idx < 0
      ? `${targetName} has no published figure to rank. Showing the top ${TOP} of ${order.length.toLocaleString()} with one (${matched.length.toLocaleString()} in this ranking).`
      : inRanking
        ? `${targetName} ranks ${placeWord(place!, tied)} of ${order.length.toLocaleString()} with a published figure (${matched.length.toLocaleString()} in this ranking). ${showing}`
        : `${targetName} is not itself in this ranking. Placed against its ${others.toLocaleString()} schools with a published figure, it would be ${placeWord(place!, tied)}. ${showing}`,
    igcseLine ? `${igcseLine}.` : null,
  ].filter(Boolean).join(" ");
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
    igcseOut,
    targetIgcse,
    targetRank: place,
    targetTied: tied,
    target: latest.get(targetUrn) ?? null,
    targetSeries: targetSeries.sort((a, b) => a.period - b.period),
    averageLatest: mean(memberLatest),
    average: Array.from(byPeriod)
      .sort((a, b) => a[0] - b[0])
      .map(([period, vs]) => ({ period, value: mean(vs)!, schools: vs.length })),
  };
}
