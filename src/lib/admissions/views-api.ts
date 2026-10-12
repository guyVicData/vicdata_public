// VicData 0.7 admissions r2: each /api/admissions/* screen's whole answer, as one function per
// route. The routes check the caller (auth.ts) and read the school's lists with the caller's own
// token; everything after that is here, so the routes, the rule tests (scripts/catalogue-rule-
// tests.ts) and the screenshot fixtures run exactly the same code. Server-only.
import { entryPoint, type EntryPoint } from "./entry-points";
import { buildPipeline } from "./pipeline";
import { defaultRungSets, nearbyCandidates } from "./rungs";
import { blendFromLists, rungSetsFromLists, type SavedList } from "./lists";
import { cachedCensus, fetchSchoolInfo } from "./data";
import { feederFlags } from "./feeders";
import { loadThresholds, phaseForEntryAge } from "./thresholds";
import { fetchSchoolTraits, isDefaultFilters, narrow, type AdmissionsFilters } from "./traits";
import { entryNow, feParticipation, feederTable, funnel, poolTrends, profileOf, rivalExtras } from "./screens";
import { buildMarketShare } from "./market";
import { rivalSet } from "./rival-set";
import { buildRivals, stageForEntry, subjectPlaces } from "./rivals";
import { headlinePopulation, sizePlaces } from "./ranks";
import { pointsChange } from "./flags";
import { familyLabels } from "./family-labels";
import { localShape, shapeOf, sizeByBand, sumAgeGender } from "./shape";
import { lookupAgeBandDistributions } from "../age-band-distributions";
import { lookupPopulationTrend } from "../population-trend-lookup";
import { cachedReference } from "../server-cache";
import { CURRENT_CENSUS_PERIOD, type AgeBandKey } from "../roll-data";
import type { RankMeasure } from "../subject-ranking";
import { ADMISSIONS_NOTES, TREND_BASE_PERIOD } from "@/catalogue/notes";
import type { Sex } from "./cohort";

export type { EntryPoint };
export const DEFAULT_FILTERS: AdmissionsFilters = { lists: "both", sector: "all", boardingOnly: false };

// ------------------------------------------------------------------------------- Pipelines
export async function pipelineView(urn: string, ep: EntryPoint, all: SavedList[], o: { filters?: AdmissionsFilters; sex?: Sex; projection?: boolean; today?: Date } = {}) {
  const filters = o.filters ?? DEFAULT_FILTERS;
  const sex = o.sex ?? "all";
  // Which feeder lists make the pool. Asking for one kind that isn't saved is an honest empty
  // state, never the other kind or the nearby defaults standing in for it.
  const lists = all.filter((l) => (filters.lists === "day" ? l.kind !== "boarding_feeders" : filters.lists === "boarding" ? l.kind !== "day_feeders" : true));
  if (filters.lists === "boarding" && !lists.some((l) => l.kind === "boarding_feeders" && (l.members?.length ?? 0) > 0))
    return { empty: "no_boarding_list" as const, entry: ep, notes: ADMISSIONS_NOTES, filters };
  const defaults = defaultRungSets(urn, ep, await nearbyCandidates(urn));
  let sets = rungSetsFromLists(ep, lists, defaults);
  if (!isDefaultFilters(filters)) {
    const traits = await fetchSchoolTraits(Array.from(new Set(Array.from(sets.values()).flat())));
    sets = new Map(Array.from(sets, ([age, urns]) => [age, narrow(urns, traits, filters, urn)] as [number, string[]]));
    // The same array for every age a set held, as the ladder expects (one set per kind of school).
    const seen = new Map<string, string[]>();
    for (const [age, urns] of sets) {
      const k = urns.join();
      if (seen.has(k)) sets.set(age, seen.get(k)!);
      else seen.set(k, urns);
    }
  }
  const p = await buildPipeline(urn, ep, { sets, laBlend: blendFromLists(lists), sex, includeProjection: !!o.projection, today: o.today });
  // Feeder flags on the youngest counted rung's set, across the ages it holds (round 1, unchanged).
  const thresholds = await loadThresholds();
  const minCohort = thresholds?.get(phaseForEntryAge(ep.age), "entry_cohort")?.minCohort ?? 10;
  const feederAge = p.sets.find((s) => s.age < 11)?.age ?? p.sets[0]?.age;
  const feederSet = p.sets.find((s) => s.age === feederAge)?.urns ?? [];
  const ages = p.sets.filter((s) => s.urns === feederSet || s.urns.join() === feederSet.join()).map((s) => s.age);
  const census = await cachedCensus(feederSet);
  const flags = feederFlags(new Map(feederSet.map((u) => [u, census.get(u)?.table ?? new Map()])), ages, CURRENT_CENSUS_PERIOD, minCohort);

  // r2: the screens.
  const everyone = Array.from(new Set([urn, ...p.sets.flatMap((s) => s.urns)]));
  const [traits, ownCensus] = await Promise.all([fetchSchoolTraits(everyone), cachedCensus([urn])]);
  const own = ownCensus.get(urn);
  const me = traits.get(urn);
  const listMembers = (kind: string) => all.filter((l) => l.kind === kind).flatMap((l) => l.members ?? []);
  const [now, table, stages, trends, area, fe] = await Promise.all([
    entryNow(urn, ep, own),
    feederTable(urn, ep, p.sets, traits, minCohort, { day: listMembers("day_feeders"), boarding: listMembers("boarding_feeders") }),
    funnel(urn, ep, p.sets, p.blend, own?.table ?? new Map(), sex),
    poolTrends(ep, p.ladder, me?.laName ?? null),
    cachedReference(`adm:area-pop:${me?.laCode ?? ""}:${CURRENT_CENSUS_PERIOD}`, () => lookupPopulationTrend(me?.laName ?? null, me?.laCode ?? null, CURRENT_CENSUS_PERIOD)),
    own?.latestPeriod == null ? feParticipation(urn, me?.typeGroup ?? null) : Promise.resolve(null),
  ]);
  const rungSets = Array.from(new Map(p.sets.map((s) => [s.urns.join(), s])).values()).map((s) => ({
    ages: p.sets.filter((x) => x.urns.join() === s.urns.join()).map((x) => x.age),
    schools: s.urns.map((u) => ({ urn: u, name: traits.get(u)?.name ?? u, elevenToSixteen: (traits.get(u)?.high ?? 0) === 16 })),
    saved: all.some((l) => l.kind === "rung" && (l.members?.length ?? 0) > 0 && p.sets.some((x) => x.urns.join() === s.urns.join() && l.rung === `age:${x.age}`)),
  }));
  return {
    ...p,
    feeders: flags,
    listsUsed: lists.filter((l) => (l.members?.length ?? 0) > 0).map((l) => l.kind),
    notes: ADMISSIONS_NOTES,
    filters,
    now,
    feederTable: table,
    funnel: stages,
    poolTrends: trends,
    areaPopulation: area,
    rungSets,
    fe,
    school: { urn, name: me?.name ?? urn, laName: me?.laName ?? null, laCode: me?.laCode ?? null, boarding: me?.boarding ?? false },
  };
}
export type PipelineView = Awaited<ReturnType<typeof pipelineView>>;

// ---------------------------------------------------------------------------- Market share
export async function marketView(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters?: AdmissionsFilters; sex?: Sex } = {}) {
  const filters = o.filters ?? DEFAULT_FILTERS;
  const { rivals, saved, traits } = await rivalSet(urn, ep, lists, filters);
  const m = await buildMarketShare(urn, ep, { rivals, sex: o.sex ?? "all" });
  const urns = [urn, ...m.rivals];
  const census = await cachedCensus(urns);
  const own = traits.get(urn);
  const fe = census.get(urn)?.latestPeriod == null ? await feParticipation(urn, own?.typeGroup ?? null) : null;
  return {
    ...m,
    note: ADMISSIONS_NOTES.groupShare,
    filters,
    rivalsSource: saved ? ("saved" as const) : ("nearest" as const),
    extras: rivalExtras(urn, urns, census, traits, ep),
    fe,
  };
}
export type MarketView = Awaited<ReturnType<typeof marketView>>;

// ---------------------------------------------------------------------------------- Rivals
const MEASURES = new Set(["points", "entries", "threshold"]);
export async function rivalsView(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters?: AdmissionsFilters; subject?: string | null; family?: string | null; qual?: string | null; measure?: string | null } = {}) {
  const { rivals } = await rivalSet(urn, ep, lists, o.filters ?? DEFAULT_FILTERS);
  const r = await buildRivals(urn, ep, { rivals });
  const stage = stageForEntry(ep.age);
  let subjects = null;
  if (o.subject && o.subject.length <= 200 && (stage === "ks4" || stage === "ks5")) {
    const measure = (MEASURES.has(o.measure ?? "") ? { kind: o.measure } : { kind: "points" }) as RankMeasure;
    const places = await subjectPlaces(r.rows.map((x) => x.urn), stage, { subject: o.subject, familyId: o.family ?? null, qualificationType: o.qual ?? null, measure });
    subjects = Object.fromEntries(places);
  }
  const pop = r.resultsPeriod === null ? null : await headlinePopulation(stage, r.resultsPeriod);
  // The momentum scatter's y: the whole-school headline since 2022/23, in points (an IGCSE
  // school, listed but not ranked, has none).
  const resultsChange = Object.fromEntries(
    r.rows.map((x) => {
      const by = pop?.get(x.urn);
      const from = by?.get(TREND_BASE_PERIOD) ?? null;
      const to = r.resultsPeriod === null ? null : (by?.get(r.resultsPeriod) ?? null);
      return [x.urn, { from, to, fromYear: TREND_BASE_PERIOD, toYear: r.resultsPeriod, points: x.results.note === "igcse_not_ranked" ? null : pointsChange(from, to) }];
    }),
  );
  const areaLabels = r.areas.length && r.resultsPeriod !== null && (stage === "ks4" || stage === "ks5") ? await familyLabels(urn, stage, r.resultsPeriod) : {};
  return { ...r, subjects, resultsChange, areaLabels };
}
export type RivalsView = Awaited<ReturnType<typeof rivalsView>>;

// ------------------------------------------------------------------------------ Shape, size
const bandForEntry = (age: number): AgeBandKey => (age <= 4 ? "early_years" : age <= 10 ? "primary" : age <= 15 ? "secondary" : "sixth_form");

export async function shapeView(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters?: AdmissionsFilters } = {}) {
  const candidates = await nearbyCandidates(urn);
  const sets = rungSetsFromLists(ep, lists, defaultRungSets(urn, ep, candidates));
  const feeders = Array.from(new Set(sets.get(Math.min(...sets.keys())) ?? []));
  const { rivals } = await rivalSet(urn, ep, lists, o.filters ?? DEFAULT_FILTERS);
  const all = Array.from(new Set([urn, ...feeders, ...rivals]));
  const [census, info] = await Promise.all([cachedCensus(all), fetchSchoolInfo(all)]);
  const own = census.get(urn);
  const dist = await lookupAgeBandDistributions(info.get(urn)?.laName ?? null, own?.latestPeriod ?? CURRENT_CENSUS_PERIOD);
  const byYear = own ? Array.from(own.ageGenderByPeriod, ([year, counts]) => ({ year, shape: shapeOf(counts) })).sort((a, b) => a.year - b.year) : [];
  const feederCounts = feeders.map((u) => census.get(u)?.ageGender).filter((c): c is NonNullable<typeof c> => !!c);
  const sizes = await sizePlaces(bandForEntry(ep.age), [urn, ...rivals], info.get(urn)?.laName ?? null);
  return {
    urn,
    entry: ep,
    shapeByYear: byYear,
    size: own ? sizeByBand(own.ageGender, dist) : [],
    localShape: { schools: feeders.length, shape: localShape(feederCounts) },
    // Described, not ranked (R-ADM-SHAPE-NOT-RANKED): the rivals in the set's own order.
    rivals: rivals.map((u) => ({ urn: u, name: info.get(u)?.name ?? u, shape: census.get(u) ? shapeOf(census.get(u)!.ageGender) : null, profile: profileOf(census.get(u)?.ageGender), size: sizes.get(u)?.badge ?? null })),
    note: ADMISSIONS_NOTES.shape,
    profile: profileOf(own?.ageGender),
    localProfile: profileOf(sumAgeGender(feederCounts)),
    entrySize: { band: bandForEntry(ep.age), badge: sizes.get(urn)?.badge ?? null },
    laName: info.get(urn)?.laName ?? null,
    // The school page's Roll by phase input: each band's roll and the distribution behind its badge.
    bands: own ? sizeByBand(own.ageGender, dist).map((b) => ({ ...b, distribution: dist.get(b.key) ?? null })) : [],
  };
}
export type ShapeView = Awaited<ReturnType<typeof shapeView>>;

export { entryPoint };
