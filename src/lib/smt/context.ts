// VicData 0.8 SMT: Context, the area around the school (spec §2.3; wireframe Context). Server-only.
//
// Round 2 built it on stand-ins (census pupils, whole LAs on the map, 10-year-olds only). Round 3
// reads the real data the ingest loaded (docs/vicdata_context_data_ingest_report_v1.md, "What the
// app can read"), only through its anon lookups (area-data.ts):
//   - residents by single year of age, within 5 miles (school_context_lookup) and per LA
//     (ons_population_age; a shire county is the sum of its districts);
//   - ONS projections by single year of age per LA (ons_snpp);
//   - the school's neighbourhood deprivation and the IDACI mix within 5 miles (school_context_lookup);
//   - free school meals for the school (dfe_school_fsm), its LA and England (dfe_fsm_geography).
// The census still gives "pupils at schools within 5 miles", said beside the residents, never
// divided by them (SMT_NOTES.wResidents). The map's neighbourhoods are context-map.ts.
import { smtNote } from "@/catalogue/notes";
import { SMT_PROJECTION_CHART_AHEAD, SMT_PROJECTION_TILE_AHEAD, periodLabel } from "@/catalogue/years";
import { cachedReference } from "../server-cache";
import { lookupReferenceData } from "../vicdata-reference";
import { fetchLaChoropleth } from "../la-choropleth";
import { cachedCensus, fetchBirthsByLa, fetchSchoolInfo } from "../admissions/data";
import { areaByAge, indexTo } from "../admissions/screens";
import { englandSchools } from "../admissions/ranks";
import { nearbyCandidates } from "../admissions/rungs";
import type { SmtSchool } from "./school";
import { AROUND_MILES_UI, agesWordOf, levelAges, type SmtPhase } from "./levels";
import type { Pt } from "./overview";
import { areaFsm, englandPopulation, fsmNotPublishedFor, laCodes, laPopulation, laProjection, schoolContext, schoolFsm } from "./area-data";

// "Around the school": every school within this distance of it, all sectors; the ingest's children
// within 5 miles use the same radius (school_context_lookup's radius_miles).
export const AROUND_MILES = AROUND_MILES_UI;
const AROUND_METRES = AROUND_MILES * 1609.344;
// ONS births by LA, from the first year the births series is compared (round 2).
export const BIRTHS_FROM = 2012;

export type ContextArea = "around" | "la";

export type FsmContext =
  | { status: "published"; period: number; value: number; first: { period: number; value: number } | null; la: { name: string | null; value: number | null }; england: number | null }
  | { status: "independent" }
  | { status: "none" };

export type Context = {
  urn: string;
  area: ContextArea;
  level: SmtPhase;
  ages: [number, number];
  agesWord: string;
  place: { town: string | null; la: string | null; region: string | null };
  now: {
    // Residents (ONS): within 5 miles (around) or in the LA.
    children: { value: number | null; year: number | null; scope: string; since: { from: number; changePct: number } | null };
    // Pupils (census) at schools within 5 miles: said beside the residents, never divided by them.
    pupilsNearby: { value: number; period: number | null } | null;
    births: { year: number; value: number; since: { from: number; changePct: number } | null } | null;
    projection: { agesWord: string; from: number; to: number; changePct: number; area: string } | null;
    schools: { count: number; scope: string; phaseWord: string };
  };
  social: {
    lsoa: string | null;
    imd: number | null;
    idaci: number | null;
    edition: string | null;
    // Children 0-15 within 5 miles, % in each IDACI decile 1..10, and the share in deciles 1-2.
    mix: number[] | null;
    deprived20: number | null;
    fsm: FsmContext;
  };
  // Round 2's LA map: the region's LAs shaded by census pupils of the ages (the fallback before the
  // neighbourhood boundaries are loaded, and the Area pill's LA).
  map: {
    las: { gss: string; name: string; value: number | null; geometry: GeoJSON.MultiPolygon | null; isSchoolLa: boolean }[];
    schools: { urn: string; name: string; easting: number; northing: number; isSchool: boolean }[];
    shade: string;
    period: number | null;
  };
  // Residents by single year of age 0-18: within 5 miles, or the LA's.
  byAge: { period: number | null; ages: { age: number; value: number }[]; scope: "around" | "la"; laName: string | null };
  births: { la: Pt[]; england: Pt[]; indexed: { la: Pt[]; england: Pt[] }; base: number | null; laName: string | null };
  // The LA's residents of the school's ages: estimates to the latest year, then the ONS projection.
  population: { estimates: Pt[]; projection: Pt[]; latestEstimate: number | null; base: number | null; area: string | null; to: number | null };
  // Children of the ages within 5 miles over time, against the LA and England, indexed.
  nearby: { school: Pt[]; la: Pt[]; england: Pt[]; indexed: { school: Pt[]; la: Pt[]; england: Pt[] }; base: number | null };
  sources: { lsoaYear: number | null; snppBase: number | null; iodYear: string | null; fsmYear: number | null };
  notes: { aroundSchool: string; children: string; births: string; projection: string; popByAge: string; shade: string; nearby: string; population: string; sources: string };
};

const sumAges = (row: number[] | undefined, [lo, hi]: [number, number]): number | null => {
  if (!row) return null;
  let t = 0;
  for (let a = lo; a <= hi; a++) t += row[a] ?? 0;
  return t;
};
const pct = (from: number | null | undefined, to: number | null | undefined) => (from && to !== null && to !== undefined ? ((to - from) / from) * 100 : null);

/** England's births by year: the sum of every English district and unitary authority (ONS). */
function englandBirths(): Promise<Map<number, number>> {
  return cachedReference("smt:england-births", async () => {
    const facts = await lookupReferenceData({ sourceId: "ons_births", breakdowns: ["total"], periodMin: BIRTHS_FROM });
    const out = new Map<number, number>();
    for (const f of facts) if (/^E0[6-9]/.test(f.entity_id) && f.value_numeric !== null) out.set(f.period, (out.get(f.period) ?? 0) + f.value_numeric);
    return out;
  });
}

/** "IoD2025 (MHCLG, 30 Oct 2025)" -> "2025". */
export const iodYearOf = (edition: string | null) => (edition ? (/(\d{4})/.exec(edition)?.[1] ?? null) : null);

export async function buildContext(school: SmtSchool, area: ContextArea, level: SmtPhase = "whole"): Promise<Context> {
  const urn = school.urn;
  const ages = levelAges(level, school.low, school.high);
  const agesWord = agesWordOf(ages);
  const phaseWord = ages[1] <= 10 ? "primary" : ages[0] >= 16 ? "sixth-form" : "secondary";
  const [aggs, england, near, sc, laPop, laProj, engPop, la] = await Promise.all([areaByAge(), englandSchools(), nearbyCandidates(urn), schoolContext(urn), laPopulation(school.laCode), laProjection(school.laCode), englandPopulation(), laCodes(school.laCode)]);
  const census = aggs.filter((r) => r.scope === "la").map((r) => r.period);
  const latestCensus = census.length ? Math.max(...census) : null;

  // ------------------------------------------------------------ residents (ONS)
  const scYears = sc?.years ?? [];
  const scLast = scYears.at(-1) ?? null;
  const scFirst = scYears[0] ?? null;
  const laYears = Array.from(laPop.keys()).sort((a, b) => a - b);
  const laLatest = laYears.at(-1) ?? null;
  const laFirst = laYears[0] ?? null;
  const children =
    area === "around"
      ? { value: scLast ? sumAges(scLast.children, ages) : null, year: scLast?.year ?? null, scope: scLast ? smtNote("childrenLiving", { miles: AROUND_MILES, year: scLast.year }) : `within ${AROUND_MILES} miles`, since: scFirst && scLast && scFirst.year !== scLast.year ? { from: scFirst.year, changePct: pct(sumAges(scFirst.children, ages), sumAges(scLast.children, ages)) ?? 0 } : null }
      : { value: laLatest !== null ? sumAges(laPop.get(laLatest), ages) : null, year: laLatest, scope: laLatest !== null ? smtNote("childrenLivingLa", { la: school.laName ?? "the LA", year: laLatest }) : `in ${school.laName ?? "the LA"}`, since: laFirst !== null && laLatest !== null && laFirst !== laLatest ? { from: laFirst, changePct: pct(sumAges(laPop.get(laFirst), ages), sumAges(laPop.get(laLatest), ages)) ?? 0 } : null };

  // ------------------------------------------------------------ pupils at schools within 5 miles (census)
  const around = near.filter((c) => c.urn !== urn && c.distance_metres <= AROUND_METRES);
  // A school of the same phase: it teaches at least three of the ages (a primary that runs to 11
  // isn't a secondary school); for a two-year range, both.
  const need = Math.min(3, ages[1] - ages[0] + 1);
  const holds = (low: number | null, high: number | null) => Math.min(high ?? -1, ages[1]) - Math.max(low ?? 99, ages[0]) + 1 >= need;
  const nearbyPhase = around.filter((c) => holds(c.statutory_low_age, c.statutory_high_age));
  const censusOf = await cachedCensus([urn, ...nearbyPhase.map((c) => c.urn)]);
  let pupilsNearby = 0;
  for (const c of [urn, ...nearbyPhase.map((x) => x.urn)]) {
    const ag = censusOf.get(c)?.ageGender;
    if (!ag) continue;
    for (const [age, v] of ag) if (age >= ages[0] && age <= ages[1]) pupilsNearby += v.male + v.female;
  }

  // ------------------------------------------------------------ the region's LAs (round 2's map)
  const region = england.get(urn);
  const choropleth = region ? await cachedReference(`smt:la-geom:${region.regionCode}`, () => fetchLaChoropleth(region.regionCode, null, null, null, null)) : [];
  const censusAges = (byAge: Record<string, number>) => {
    let t = 0;
    for (let a = ages[0]; a <= ages[1]; a++) t += byAge[String(a)] ?? 0;
    return t;
  };
  const las = choropleth.map((e) => {
    const r = aggs.find((x) => x.scope === "la" && x.key === e.laName && x.period === latestCensus);
    return { gss: e.gssCode, name: e.laName, value: r ? censusAges(r.byAge) : null, geometry: e.geometry, isSchoolLa: e.laName === school.laName };
  });
  const laSchoolCount = choropleth.find((e) => e.laName === school.laName)?.schoolCount ?? null;
  const info = await fetchSchoolInfo([urn, ...nearbyPhase.map((c) => c.urn)]);
  const points = [urn, ...nearbyPhase.map((c) => c.urn)]
    .map((u) => ({ urn: u, name: info.get(u)?.name ?? u, easting: info.get(u)?.easting ?? null, northing: info.get(u)?.northing ?? null, isSchool: u === urn }))
    .filter((s): s is { urn: string; name: string; easting: number; northing: number; isSchool: boolean } => s.easting !== null && s.northing !== null);

  // ------------------------------------------------------------ births (LA and England)
  const laCode = school.laCode;
  const [birthsBy, eng] = await Promise.all([laCode ? fetchBirthsByLa([laCode]) : Promise.resolve(new Map<string, Map<number, number>>()), englandBirths()]);
  const laBirths = laCode ? birthsBy.get(laCode) : undefined;
  const years = Array.from(new Set([...(laBirths?.keys() ?? []), ...eng.keys()])).filter((y) => y >= BIRTHS_FROM).sort((a, b) => a - b);
  const laPts = years.map((y) => ({ year: y, value: laBirths?.get(y) ?? null }));
  const engPts = years.map((y) => ({ year: y, value: eng.get(y) ?? null }));
  const ix = indexTo([laPts, engPts]);
  const lastBirth = [...laPts].reverse().find((p) => p.value !== null) ?? null;
  const firstBirth = laPts.find((p) => p.year === BIRTHS_FROM && p.value !== null) ?? null;

  // ------------------------------------------------------------ projections (ONS, the LA, the ages)
  const projYears = Array.from(laProj.keys()).sort((a, b) => a - b);
  const snppBase = projYears[0] ?? null;
  const chartTo = laLatest !== null ? laLatest + SMT_PROJECTION_CHART_AHEAD : null;
  const tileTo = laLatest !== null ? laLatest + SMT_PROJECTION_TILE_AHEAD : null;
  const projAt = (y: number) => sumAges(laProj.get(y), ages);
  const tileFrom = laLatest !== null && laProj.has(laLatest) ? laLatest : null;
  const tileEnd = tileTo !== null ? (projYears.filter((y) => y <= tileTo).at(-1) ?? null) : null;
  const projection = tileFrom !== null && tileEnd !== null && tileEnd > tileFrom ? { agesWord, from: tileFrom, to: tileEnd, changePct: pct(projAt(tileFrom), projAt(tileEnd)) ?? 0, area: school.laName ?? "" } : null;
  const estimates = laYears.map((y) => ({ year: y, value: sumAges(laPop.get(y), ages) }));
  const projected = projYears.filter((y) => (laLatest === null || y >= laLatest) && (chartTo === null || y <= chartTo)).map((y) => ({ year: y, value: projAt(y) }));

  // ------------------------------------------------------------ children nearby over time (indexed)
  const nearbySchool = scYears.map((y) => ({ year: y.year, value: sumAges(y.children, ages) }));
  const nearbyLa = laYears.map((y) => ({ year: y, value: sumAges(laPop.get(y), ages) }));
  const nearbyEng = Array.from(engPop.keys()).sort((a, b) => a - b).map((y) => ({ year: y, value: sumAges(engPop.get(y), ages) }));
  const nix = indexTo([nearbySchool, nearbyLa, nearbyEng]);

  // ------------------------------------------------------------ social context
  const mix = sc?.idaciMix ?? null;
  const notPublished = fsmNotPublishedFor(school.typeGroup, school.establishmentType);
  let fsm: FsmContext = { status: notPublished ? "independent" : "none" };
  let fsmYear: number | null = null;
  if (!notPublished) {
    const [own, areaF] = await Promise.all([schoolFsm([urn]), areaFsm(la.gss)]);
    const rows = own.get(urn) ?? [];
    const last = rows.at(-1);
    fsmYear = last?.period ?? Math.max(...areaF.england.keys());
    if (last) {
      const first = rows[0] && rows[0].period !== last.period ? rows[0] : null;
      fsm = { status: "published", period: last.period, value: last.value, first, la: { name: school.laName, value: areaF.la.get(last.period) ?? null }, england: areaF.england.get(last.period) ?? null };
    }
  } else {
    const areaF = await areaFsm(null);
    fsmYear = areaF.england.size ? Math.max(...areaF.england.keys()) : null;
  }

  const byAgeAround = area === "around" && scLast;
  const iodYear = iodYearOf(sc?.edition ?? null);
  const sources = { lsoaYear: scLast?.year ?? null, snppBase, iodYear, fsmYear: Number.isFinite(fsmYear) ? fsmYear : null };
  return {
    urn,
    area,
    level,
    ages,
    agesWord,
    place: { town: school.town, la: school.laName, region: school.regionName },
    now: {
      children,
      pupilsNearby: area === "around" ? { value: pupilsNearby, period: latestCensus } : null,
      births: lastBirth && lastBirth.value !== null ? { year: lastBirth.year, value: lastBirth.value, since: firstBirth && firstBirth.value ? { from: BIRTHS_FROM, changePct: pct(firstBirth.value, lastBirth.value) ?? 0 } : null } : null,
      projection,
      schools: area === "around" ? { count: nearbyPhase.length, scope: `within ${AROUND_MILES} miles`, phaseWord } : { count: laSchoolCount ?? 0, scope: `in ${school.laName ?? "the LA"}`, phaseWord: "all" },
    },
    social: { lsoa: sc?.lsoa ?? null, imd: sc?.imd ?? null, idaci: sc?.idaci ?? null, edition: sc?.edition ?? null, mix, deprived20: mix ? mix[0] + mix[1] : null, fsm },
    map: { las, schools: points, shade: `pupils aged ${agesWord}`, period: latestCensus },
    byAge: byAgeAround
      ? { period: scLast.year, ages: scLast.children.map((v, age) => ({ age, value: v })), scope: "around", laName: school.laName }
      : { period: laLatest, ages: laLatest !== null ? (laPop.get(laLatest) ?? []).map((v, age) => ({ age, value: v })) : [], scope: "la", laName: school.laName },
    births: { la: laPts, england: engPts, indexed: { la: ix.out[0], england: ix.out[1] }, base: ix.base, laName: school.laName },
    population: { estimates, projection: projected, latestEstimate: laLatest, base: snppBase, area: school.laName, to: chartTo },
    nearby: { school: nearbySchool, la: nearbyLa, england: nearbyEng, indexed: { school: nix.out[0], la: nix.out[1], england: nix.out[2] }, base: nix.base },
    sources,
    notes: {
      aroundSchool: smtNote("aroundSchool", { miles: AROUND_MILES }),
      children: `${smtNote("childrenAround", { ages: agesWord, miles: AROUND_MILES })} ${smtNote("wResidents")}`,
      births: smtNote("births"),
      projection: smtNote("projection", { base: snppBase ?? "", ages: agesWord, area: school.laName ?? "the LA" }),
      popByAge: byAgeAround ? smtNote("popByAgeAround", { miles: AROUND_MILES, year: scLast.year }) : smtNote("popByAgeLa", { la: school.laName ?? "The LA", year: laLatest ?? "" }),
      shade: smtNote("shadeByDistrict"),
      nearby: smtNote("nearbyOverTime", { ages: agesWord, miles: AROUND_MILES, la: school.laName ?? "the LA", base: nix.base ?? "" }),
      population: smtNote("populationProjected", { la: school.laName ?? "The LA", ages: agesWord, year: laLatest ?? "", base: snppBase ?? "" }),
      sources: smtNote("wSources", { lsoaYear: sources.lsoaYear ?? "", snppBase: snppBase ?? "", iodYear: iodYear ?? "", fsmYear: sources.fsmYear !== null ? periodLabel(sources.fsmYear) : "" }),
    },
  };
}
