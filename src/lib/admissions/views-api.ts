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
import { fetchSchoolTraits, isDefaultFilters, narrow, schoolsInLas, type AdmissionsFilters, type SchoolTraits } from "./traits";
import { distanceKm, entryNow, feParticipation, feederTable, funnel, funnelArea, indexTo, poolTrends, profileOf, rivalExtras } from "./screens";
import { buildMarketShare } from "./market";
import { rivalSet } from "./rival-set";
import { buildRivals, stageForEntry, subjectPlaces } from "./rivals";
import { englandSchools, headlinePopulation, sizePlaces } from "./ranks";
import { pctChange, pointsChange } from "./flags";
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
export async function pipelineView(urn: string, ep: EntryPoint, saved: SavedList[], o: { filters?: AdmissionsFilters; sex?: Sex; projection?: boolean; today?: Date } = {}) {
  // 0.7 r3 (F2): a day school never thinks about boarders. Its boarding lists (if any were saved
  // before) are kept but not used, and the Day + boarding filter doesn't apply to it.
  const boardingSchool = (await fetchSchoolTraits([urn])).get(urn)?.boarding ?? false;
  const all = boardingSchool ? saved : saved.filter((l) => l.kind !== "boarding_feeders");
  const asked = o.filters ?? DEFAULT_FILTERS;
  const filters = boardingSchool ? asked : { ...asked, lists: "both" as const };
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
    entryNow(urn, ep, own, sex),
    feederTable(urn, ep, p.sets, traits, minCohort, { day: listMembers("day_feeders"), boarding: listMembers("boarding_feeders") }, sex),
    funnelArea(p.blend, p.blendSource === "override", me).then((area) => funnel(urn, ep, area, own?.table ?? new Map(), sex)),
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
    // "Pool ▼ x% by 2030 against 2026": the year round 1's poolChange measured to.
    changeYear: p.change ? Math.min(p.ladder.future[p.ladder.future.length - 1]?.entryYear ?? CURRENT_CENSUS_PERIOD, (p.ladder.future[0]?.entryYear ?? CURRENT_CENSUS_PERIOD) + 3) : null,
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
  // The headline tiles, worked out here so the page draws them as they come.
  const latest = Math.max(...m.entryAge.periods);
  const first = Math.min(...m.entryAge.periods);
  const mine = (y: number) => m.entryAge.rows.find((r) => r.urn === urn && r.period === y) ?? null;
  const extras = rivalExtras(urn, urns, census, traits, ep, o.sex ?? "all");
  const summary = {
    latest,
    first,
    rank: mine(latest)?.rank ?? null,
    of: m.entryAge.rows.filter((r) => r.period === latest && r.count !== null).length,
    share: mine(latest)?.share ?? null,
    shareFirst: mine(first)?.share ?? null,
    changePts: mine(latest)?.share != null && mine(first)?.share != null ? mine(latest)!.share! - mine(first)!.share! : null,
    total: m.entryAge.totals[latest] ?? null,
    rivals: m.rivals.length,
    independent: extras.filter((e) => e.traits?.sector === "independent").length,
    state: extras.filter((e) => e.traits?.sector === "state").length,
    boarding: extras.filter((e) => e.traits?.boarding).length,
    rollRank: extras.find((e) => e.urn === urn)?.rollRank ?? null,
    rollOf: extras.filter((e) => e.roll !== null).length,
    // Each school's entry-age trend over the last year (the ranked bars' arrow), in %.
    trend: Object.fromEntries(urns.map((u) => {
      const a = m.entryAge.rows.find((r) => r.urn === u && r.period === latest - 1)?.count ?? null;
      const b2 = m.entryAge.rows.find((r) => r.urn === u && r.period === latest)?.count ?? null;
      return [u, a === null || b2 === null || a === 0 ? null : ((b2 - a) / a) * 100];
    })) as Record<string, number | null>,
    // Each school's change in share since the first year, in percentage points (the change bars).
    shareChange: Object.fromEntries(urns.map((u) => {
      const a = m.entryAge.rows.find((r) => r.urn === u && r.period === first)?.share ?? null;
      const b2 = m.entryAge.rows.find((r) => r.urn === u && r.period === latest)?.share ?? null;
      return [u, a === null || b2 === null ? null : b2 - a];
    })) as Record<string, number | null>,
    // The rivals' average at the entry age each year (the "against rivals" line), and the school's.
    rivalsAverage: m.entryAge.periods.map((y) => {
      const vals = m.entryAge.rows.filter((r) => r.period === y && r.urn !== urn && r.count !== null).map((r) => r.count!);
      return { year: y, value: vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null };
    }),
  };
  const minePts = m.entryAge.periods.map((y) => ({ year: y, value: mine(y)?.count ?? null }));
  const vs = indexTo([minePts, summary.rivalsAverage]);
  return {
    ...m,
    summary: { ...summary, vsIndexed: { base: vs.base, mine: vs.out[0], rivals: vs.out[1] } },
    note: ADMISSIONS_NOTES.groupShare,
    filters,
    rivalsSource: saved ? ("saved" as const) : ("nearest" as const),
    extras,
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
  // "Overall: 2nd of 8 rivals on Attainment 8 · 897th of 4,736 in England": the school's place among
  // the rivals with a ranked headline (not IGCSE, not unpublished), and its national place.
  const me = r.rows.find((x) => x.isSchool);
  const ranked = r.rows.filter((x) => x.results.value !== null && x.results.note === null);
  const overall = me && me.results.value !== null && me.results.note === null
    ? { rank: 1 + ranked.filter((x) => x.results.value! > me.results.value!).length, of: ranked.length, measure: stage === "ks4" ? "Attainment 8" : stage === "ks5" ? "A-level points per entry" : "the KS2 expected standard", national: me.results.national, change: resultsChange[urn]?.points ?? null, unranked: r.rows.filter((x) => x.results.note !== null).map((x) => ({ urn: x.urn, name: x.name, note: x.results.note })) }
    : null;
  return { ...r, subjects, resultsChange, areaLabels, overall };
}
export type RivalsView = Awaited<ReturnType<typeof rivalsView>>;

// ------------------------------------------------------------------------------ Shape, size
const bandForEntry = (age: number): AgeBandKey => (age <= 4 ? "early_years" : age <= 10 ? "primary" : age <= 15 ? "secondary" : "sixth_form");

export async function shapeView(urn: string, ep: EntryPoint, lists: SavedList[], o: { filters?: AdmissionsFilters } = {}) {
  const candidates = await nearbyCandidates(urn);
  const defaults = defaultRungSets(urn, ep, candidates);
  const sets = rungSetsFromLists(ep, lists, defaults);
  const youngest = Math.min(...sets.keys());
  const feeders = Array.from(new Set(sets.get(youngest) ?? []));
  // 0.8 audit fixes (5, A8): which set the local shape counts -- a saved list, or the defaults (at 16+
  // the youngest rung's defaults are primaries) -- so the caption can name it.
  const localFromSaved = sets.get(youngest) !== defaults.get(youngest);
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
    localShape: { schools: feeders.length, shape: localShape(feederCounts), saved: localFromSaved },
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

// ------------------------------------------------------------------------------ Setup's lists
// The schools setup offers to tick, with the figures beside each (pupils at the age that matters,
// their two-year trend and flag against the schools shown -- R-ADM-FLAG-FEEDER, the same function
// as the pipeline's -- km, sector, gender, boarding, XS-XL). `sp` is the route's query.
const CAP = 150;
const holdsAge = (t: { low: number | null; high: number | null }, age: number) => (t.low ?? 99) <= age && (t.high ?? -1) >= age;
const bandOfAge = (age: number): AgeBandKey => (age <= 4 ? "early_years" : age <= 10 ? "primary" : age <= 15 ? "secondary" : "sixth_form");

export async function candidatesView(urn: string, ep: EntryPoint, sp: URLSearchParams) {
  const kind = sp.get("kind") === "rivals" ? "rivals" : sp.get("kind") === "boarding" ? "boarding" : "day";
  const mode = sp.get("mode") ?? "nearest";
  // The age that matters: a feeder's pupils a year before entry (Reception's at 4+); a rival's at
  // entry. &age=N (a rung's own age, 16+'s "Edit list") overrides it.
  const asked = Number(sp.get("age"));
  const age = Number.isInteger(asked) && asked >= 4 && asked <= 17 ? asked : kind === "rivals" ? ep.age : Math.max(4, ep.age - 1);
  const me = (await fetchSchoolTraits([urn])).get(urn);
  let pool: SchoolTraits[] = [];
  if (mode === "urns") {
    const urns = (sp.get("urns") ?? "").split(",").filter((u) => /^\d{5,7}$/.test(u)).slice(0, 500);
    pool = Array.from((await fetchSchoolTraits(urns)).values());
  } else if (mode === "la" || (kind === "boarding" && sp.get("las"))) {
    const las = (sp.get("las") ?? "").split(",").filter((x) => /^\d{3}$/.test(x)).slice(0, 12);
    pool = las.length ? await schoolsInLas(las) : [];
  } else if (mode === "region") {
    const england = await englandSchools();
    const region = england.get(urn)?.regionCode;
    const urns = region ? Array.from(england, ([u, s]) => ({ u, s })).filter(({ s }) => s.regionCode === region && (s.low ?? 99) <= age && (s.high ?? -1) >= age).map(({ u }) => u) : [];
    pool = Array.from((await fetchSchoolTraits(urns)).values());
  } else {
    const near = await nearbyCandidates(urn);
    pool = Array.from((await fetchSchoolTraits(near.map((c) => c.urn))).values());
  }
  const sector = sp.get("sector");
  const tops = (sp.get("ages") ?? "").split(",").map(Number).filter((n) => n >= 5 && n <= 19);
  let list = pool
    .filter((t) => t.urn !== urn)
    .filter((t) => holdsAge(t, age) && (kind !== "rivals" || holdsAge(t, age + 1)))
    .filter((t) => (sector === "state" || sector === "independent" ? t.sector === sector : true))
    .filter((t) => (kind === "boarding" ? t.sector === "independent" && t.boarding : true))
    .filter((t) => (sp.get("boarding") === "1" ? t.boarding : true))
    .filter((t) => (sp.get("gender") === "same" && me ? t.gender === me.gender : true))
    .filter((t) => (tops.length ? tops.includes(t.high ?? -1) : true))
    .map((t) => ({ t, km: distanceKm(me, t) }))
    .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
  if (mode === "radius") list = list.filter((x) => x.km !== null && x.km <= Math.min(80, Number(sp.get("km") ?? 5)));
  if (mode === "nearest") list = list.slice(0, Math.min(60, Math.max(1, Number(sp.get("n") ?? (kind === "rivals" ? 10 : 15)))));
  list = list.slice(0, CAP);
  const urns = list.map((x) => x.t.urn);
  const thresholds = await loadThresholds();
  const [census, sizes] = await Promise.all([cachedCensus(urns), sizePlaces(bandOfAge(age), urns, me?.laName ?? null)]);
  const sizeFilter = (sp.get("sizes") ?? "").split(",").filter(Boolean);
  const flags = feederFlags(new Map(urns.map((u) => [u, census.get(u)?.table ?? new Map()])), [age], CURRENT_CENSUS_PERIOD, thresholds?.get(phaseForEntryAge(ep.age), "entry_cohort")?.minCohort ?? 10);
  const rows = list
    .map(({ t, km }) => {
      const f = flags.find((x) => x.urn === t.urn)!;
      return {
        urn: t.urn, name: t.name, sector: t.sector, gender: t.gender, boarding: t.boarding, laCode: t.laCode, laName: t.laName, town: t.town,
        high: t.high, distanceKm: km, pupils: f.to, before: f.from, changePct: pctChange(f.from, f.to), flag: kind === "rivals" ? null : f.flag,
        size: sizes.get(t.urn)?.badge ?? null, easting: t.easting, northing: t.northing,
      };
    })
    .filter((r) => (sizeFilter.length ? !!r.size && sizeFilter.includes(r.size) : true));
  return { kind, mode, age, period: CURRENT_CENSUS_PERIOD, school: me ? { urn: me.urn, name: me.name, easting: me.easting, northing: me.northing, laCode: me.laCode, laName: me.laName, gender: me.gender } : null, rows };
}
export type CandidatesView = Awaited<ReturnType<typeof candidatesView>>;
