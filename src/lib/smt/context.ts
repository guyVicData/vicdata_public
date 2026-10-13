// VicData 0.8 SMT round 2: Context, the area around the school (spec §2.3; wireframe Context).
// Server-only. Population only, as the spec allows until deprivation and free-school-meals data are
// ingested (the data gap is shown, from SMT_NOTES).
//
// The geography audit (logged): VicData holds no population by single year of age for
// neighbourhoods (LSOA, MSOA) or districts. It holds, per local authority, pupils by single age
// 5-15 in mainstream schools (age_profile_aggregates, the school census), births (ONS, by district
// and unitary, summed to county), and ONS projections of 10-year-olds (county or unitary). Its area
// boundaries are counties and unitary authorities (la_boundaries). So the map shades by district
// in the only sense the data allows -- whole local authorities -- and says so.
import { smtNote } from "@/catalogue/notes";
import { cachedReference } from "../server-cache";
import { lookupReferenceData } from "../vicdata-reference";
import { fetchLaChoropleth } from "../la-choropleth";
import { cachedCensus, fetchAge10Projections, fetchBirthsByLa, fetchSchoolInfo } from "../admissions/data";
import { areaByAge, indexTo } from "../admissions/screens";
import { englandSchools } from "../admissions/ranks";
import { nearbyCandidates } from "../admissions/rungs";
import type { SmtSchool } from "./school";
import { AROUND_MILES_UI } from "./levels";
import type { Pt } from "./overview";

// "Around the school": every school within this distance of it, all sectors (logged: no radius
// existed -- the public page and Admissions both use nearest-N lists).
export const AROUND_MILES = AROUND_MILES_UI;
const AROUND_METRES = AROUND_MILES * 1609.344;
export const BIRTHS_FROM = 2012;

export type ContextArea = "around" | "la";

export type Context = {
  urn: string;
  area: ContextArea;
  ages: [number, number];
  agesWord: string;
  place: { town: string | null; la: string | null; region: string | null };
  now: {
    children: { value: number | null; scope: string };
    births: { year: number; value: number; since: { from: number; changePct: number } | null } | null;
    projection: { age: number; from: number; to: number; changePct: number; area: string } | null;
    schools: { count: number; scope: string; phaseWord: string };
  };
  map: {
    las: { gss: string; name: string; value: number | null; geometry: GeoJSON.MultiPolygon | null; isSchoolLa: boolean }[];
    schools: { urn: string; name: string; easting: number; northing: number; isSchool: boolean }[];
    shade: string;
    period: number | null;
  };
  byAge: { period: number | null; ages: { age: number; value: number }[]; laName: string | null };
  births: { la: Pt[]; england: Pt[]; indexed: { la: Pt[]; england: Pt[] }; base: number | null; laName: string | null };
  projection: { pts: Pt[]; age: number; area: string | null; baseYear: number | null };
  notes: { aroundSchool: string; children: string; births: string; projection: string; popByAge: string; shade: string };
};

/** The ages the school's main phase covers, in the census's single ages (5-15 held by area). */
export function mainAges(school: Pick<SmtSchool, "phases" | "low">): [number, number] {
  if (school.phases.gcse) return [11, 15];
  if (school.phases.primary) return [Math.max(5, school.low ?? 5), 10];
  return [11, 15];
}

const sumAges = (byAge: Record<string, number>, [lo, hi]: [number, number]) => {
  let t = 0;
  for (let a = lo; a <= hi; a++) t += byAge[String(a)] ?? 0;
  return t;
};

/** England's births by year: the sum of every English district and unitary authority (ONS). */
function englandBirths(): Promise<Map<number, number>> {
  return cachedReference("smt:england-births", async () => {
    const facts = await lookupReferenceData({ sourceId: "ons_births", breakdowns: ["total"], periodMin: BIRTHS_FROM });
    const out = new Map<number, number>();
    for (const f of facts) if (/^E0[6-9]/.test(f.entity_id) && f.value_numeric !== null) out.set(f.period, (out.get(f.period) ?? 0) + f.value_numeric);
    return out;
  });
}

export async function buildContext(school: SmtSchool, area: ContextArea): Promise<Context> {
  const urn = school.urn;
  const ages = mainAges(school);
  const agesWord = `${ages[0]}–${ages[1]}`;
  const phaseWord = school.phases.gcse ? "secondary" : school.phases.primary ? "primary" : "secondary";
  const [aggs, england, near] = await Promise.all([areaByAge(), englandSchools(), nearbyCandidates(urn)]);
  const latest = Math.max(...aggs.filter((r) => r.scope === "la").map((r) => r.period));
  const laRow = aggs.find((r) => r.scope === "la" && r.key === school.laName && r.period === latest);

  // ------------------------------------------------------------ around the school
  const around = near.filter((c) => c.urn !== urn && c.distance_metres <= AROUND_METRES);
  const census = await cachedCensus(around.map((c) => c.urn));
  // A school of the same phase: it teaches at least three of the main ages (a primary that runs to
  // 11 isn't a secondary school).
  const holds = (low: number | null, high: number | null) => Math.min(high ?? -1, ages[1]) - Math.max(low ?? 99, ages[0]) >= 2;
  const nearbyPhase = around.filter((c) => holds(c.statutory_low_age, c.statutory_high_age));
  let aroundChildren = 0;
  for (const c of [urn, ...nearbyPhase.map((x) => x.urn)]) {
    const ag = (c === urn ? (await cachedCensus([urn])).get(urn) : census.get(c))?.ageGender;
    if (!ag) continue;
    for (const [age, v] of ag) if (age >= ages[0] && age <= ages[1]) aroundChildren += v.male + v.female;
  }

  // ------------------------------------------------------------ the LA and its region (the map)
  const region = england.get(urn);
  const choropleth = region ? await cachedReference(`smt:la-geom:${region.regionCode}`, () => fetchLaChoropleth(region.regionCode, null, null, null, null)) : [];
  const las = choropleth.map((e) => {
    const r = aggs.find((x) => x.scope === "la" && x.key === e.laName && x.period === latest);
    return { gss: e.gssCode, name: e.laName, value: r ? sumAges(r.byAge, ages) : null, geometry: e.geometry, isSchoolLa: e.laName === school.laName };
  });
  const laSchoolCount = choropleth.find((e) => e.laName === school.laName)?.schoolCount ?? null;
  const info = await fetchSchoolInfo([urn, ...nearbyPhase.map((c) => c.urn)]);
  const points = [urn, ...nearbyPhase.map((c) => c.urn)]
    .map((u) => ({ urn: u, name: info.get(u)?.name ?? u, easting: info.get(u)?.easting ?? null, northing: info.get(u)?.northing ?? null, isSchool: u === urn }))
    .filter((s): s is { urn: string; name: string; easting: number; northing: number; isSchool: boolean } => s.easting !== null && s.northing !== null);

  // ------------------------------------------------------------ births (LA and England) and projections
  const laCode = school.laCode;
  const [birthsBy, eng, proj] = await Promise.all([laCode ? fetchBirthsByLa([laCode]) : Promise.resolve(new Map()), englandBirths(), school.laName ? fetchAge10Projections([school.laName]) : Promise.resolve(new Map())]);
  const laBirths = laCode ? (birthsBy.get(laCode) as Map<number, number> | undefined) : undefined;
  const years = Array.from(new Set([...(laBirths?.keys() ?? []), ...eng.keys()])).filter((y) => y >= BIRTHS_FROM).sort((a, b) => a - b);
  const laPts = years.map((y) => ({ year: y, value: laBirths?.get(y) ?? null }));
  const engPts = years.map((y) => ({ year: y, value: eng.get(y) ?? null }));
  const ix = indexTo([laPts, engPts]);
  const lastBirth = [...laPts].reverse().find((p) => p.value !== null) ?? null;
  const firstBirth = laPts.find((p) => p.year === BIRTHS_FROM && p.value !== null) ?? null;
  const projMap = (school.laName ? (proj.get(school.laName) as Map<number, number> | undefined) : undefined) ?? new Map<number, number>();
  const projPts = Array.from(projMap).sort((a, b) => a[0] - b[0]).filter(([y]) => y <= 2036).map(([year, value]) => ({ year, value }));
  const nowYear = new Date().getFullYear();
  const projFrom = projPts.filter((p) => p.year <= nowYear).at(-1) ?? projPts[0];
  const projTo = projPts.filter((p) => p.year > (projFrom?.year ?? 0)).find((p) => p.year >= nowYear + 5) ?? projPts.at(-1);

  return {
    urn,
    area,
    ages,
    agesWord,
    place: { town: school.town, la: school.laName, region: school.regionName },
    now: {
      children: area === "around" ? { value: aroundChildren, scope: `within ${AROUND_MILES} miles` } : { value: laRow ? sumAges(laRow.byAge, ages) : null, scope: `in ${school.laName ?? "the LA"}'s schools` },
      births: lastBirth && lastBirth.value !== null ? { year: lastBirth.year, value: lastBirth.value, since: firstBirth && firstBirth.value ? { from: BIRTHS_FROM, changePct: ((lastBirth.value - firstBirth.value) / firstBirth.value) * 100 } : null } : null,
      projection: projFrom && projTo && projFrom.value && projTo.value !== null && projTo.year !== projFrom.year ? { age: 10, from: projFrom.year, to: projTo.year, changePct: ((projTo.value - projFrom.value) / projFrom.value) * 100, area: school.laName ?? "" } : null,
      schools: area === "around" ? { count: nearbyPhase.length, scope: `within ${AROUND_MILES} miles`, phaseWord } : { count: laSchoolCount ?? 0, scope: `in ${school.laName ?? "the LA"}`, phaseWord: "all" },
    },
    map: { las, schools: points, shade: `pupils aged ${agesWord}`, period: Number.isFinite(latest) ? latest : null },
    byAge: { period: Number.isFinite(latest) ? latest : null, ages: laRow ? Array.from({ length: 11 }, (_, i) => ({ age: 5 + i, value: laRow.byAge[String(5 + i)] ?? 0 })) : [], laName: school.laName },
    births: { la: laPts, england: engPts, indexed: { la: ix.out[0], england: ix.out[1] }, base: ix.base, laName: school.laName },
    projection: { pts: projPts, age: 10, area: school.laName, baseYear: projPts[0]?.year ?? null },
    notes: {
      aroundSchool: smtNote("aroundSchool", { miles: AROUND_MILES }),
      children: smtNote("childrenAround", { ages: agesWord, miles: AROUND_MILES }),
      births: smtNote("births"),
      projection: smtNote("projection", { age: 10, area: school.laName ?? "the LA" }),
      popByAge: smtNote("popByAge", { la: school.laName ?? "the LA" }),
      shade: smtNote("shadeByDistrict"),
    },
  };
}
