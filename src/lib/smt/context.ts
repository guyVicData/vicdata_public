// VicData 0.8 SMT: Context, the area around the school (spec §2.3; wireframe Context). Server-only.
//
// Round 2 built it on stand-ins (census pupils, whole LAs on the map, 10-year-olds only). Round 3
// read the real data the ingest loaded, at a fixed 5 miles. Round 4 (docs/v0.8/vicdata_0_8_smt_round4_
// area_projection_radius_claude_code_prompt_v1.md) draws the whole board at the school's catchment, in
// km (catchment.ts), and projects forward from children already born (the ingest's method:
// docs/v0.8/vicdata_area_projection_method_v1.md). Everything comes through the ingest's anon lookups
// (area-data.ts):
//   - around the school, at any radius: children by single year of age per year, the IDACI mix, the
//     neighbourhood count and the authority mix (area_context); the projection (area_projection);
//   - the LA: residents by single year of age (ons_population_age; a shire county is the sum of its
//     districts), the projection (la_projection_lookup, districts summed), ONS's 2022-based projection
//     (ons_snpp) as the comparison line;
//   - the school's neighbourhood deprivation (area_context's own); free school meals (dfe_school_fsm,
//     dfe_fsm_geography).
// The census still gives "pupils at schools within the radius", said beside the residents, never
// divided by them (SMT_NOTES.wResidents). The map's neighbourhoods are context-map.ts.
import { indexBaseWords } from "../index-base";
import { smtNote } from "@/catalogue/notes";
import { SMT_PROJECTION_TILE_AHEAD, periodLabel } from "@/catalogue/years";
import { cachedReference } from "../server-cache";
import { createServerAnonSupabaseClient } from "../supabase";
import { lookupReferenceData } from "../vicdata-reference";
import { fetchLaChoropleth } from "../la-choropleth";
import { fetchBirthsByLa, fetchSchoolInfo } from "../admissions/data";
import { fetchCensusFactsBatched } from "../data-view-profiles";
import { areaByAge, indexTo } from "../admissions/screens";
import { englandSchools } from "../admissions/ranks";
import type { SmtSchool } from "./school";
import { agesWordOf, levelAges, type SmtPhase } from "./levels";
import type { Pt } from "./overview";
import { kmWord, type Catchment } from "./catchment";
import {
  areaContext,
  areaFsm,
  areaProjection,
  englandPopulation,
  fsmNotPublishedFor,
  laAreaProjection,
  laCodes,
  laPopulation,
  laProjection,
  schoolFsm,
  type AreaMix,
  type AreaProjection,
  type ProjectionSettings,
  type ProjectionSource,
  type ProjectionYearsUsed,
} from "./area-data";

// ONS births by LA, from the first year the births series is compared (round 2).
export const BIRTHS_FROM = 2012;

export type ContextArea = "around" | "la";

export type FsmContext =
  | { status: "published"; period: number; value: number; first: { period: number; value: number } | null; la: { name: string | null; value: number | null }; england: number | null }
  | { status: "independent" }
  | { status: "none" };

// One year of the forward view: the middle line, its band, the scenario, ONS's comparison line, and
// whether the year's ages include any child not yet born (drawn lighter, labelled at the change).
export type ForwardPoint = { year: number; middle: number | null; low: number | null; high: number | null; scenario: number | null; ons: number | null; includesUnborn: boolean };

export type Forward = {
  scope: ContextArea;
  where: string; // "within 5 km", "in Reading"
  estimates: Pt[]; // solid, to the latest counted year, where the projection starts (the two always meet)
  projection: ForwardPoint[]; // the latest counted year to the horizon
  latestYear: number;
  horizonEnd: number;
  unbornFrom: number | null; // the first year whose ages include children not yet born
  tile: { to: number; changePct: number; lowPct: number | null; highPct: number | null } | null;
  ons: { base: number | null; around: boolean } | null; // around: ONS's change applied to the area's children (ONS projects LAs only)
  scenarioLabel: string;
  settingsVersion: number;
  settings: ProjectionSettings;
  yearsUsed: ProjectionYearsUsed;
  sources: Record<string, ProjectionSource>;
  bandMissing: boolean;
  lsoaCount: number | null;
};

export type Context = {
  urn: string;
  area: ContextArea;
  level: SmtPhase;
  ages: [number, number];
  agesWord: string;
  catchment: Catchment;
  radius: string; // "5 km"
  place: { town: string | null; la: string | null; region: string | null };
  now: {
    // Residents (ONS): within the radius (around) or in the LA.
    children: { value: number | null; year: number | null; scope: string; since: { from: number; changePct: number } | null };
    // "Within 5 km: Reading 47%, Wokingham 46%, West Berkshire 6%, other 1%" (around only).
    mix: { line: string; ages: string } | null;
    // Pupils (census) at schools within the radius: said beside the residents, never divided by them.
    pupilsNearby: { value: number; period: number | null } | null;
    births: { year: number; value: number; since: { from: number; changePct: number } | null } | null;
    projection: { agesWord: string; from: number; to: number; changePct: number; lowPct: number | null; highPct: number | null; caption: string } | null;
    schools: { count: number; scope: string; phaseWord: string };
    oneNeighbourhood: boolean;
  };
  social: {
    lsoa: string | null;
    imd: number | null;
    idaci: number | null;
    edition: string | null;
    // Children 0-15 within the radius, % in each IDACI decile 1..10, and the share in deciles 1-2.
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
  // Residents by single year of age 0-18: within the radius, or the LA's.
  byAge: { period: number | null; ages: { age: number; value: number }[]; scope: "around" | "la"; laName: string | null };
  births: { la: Pt[]; england: Pt[]; indexed: { la: Pt[]; england: Pt[] }; base: number | null; laName: string | null };
  // The forward view (F): the area's (or the LA's) children of the school's ages, counted then projected.
  forward: Forward | null;
  // Children of the ages within the radius over time, against the LA and England, indexed.
  nearby: { school: Pt[]; la: Pt[]; england: Pt[]; indexed: { school: Pt[]; la: Pt[]; england: Pt[] }; base: number | null };
  sources: { lsoaYear: number | null; laYear: number | null; snppBase: number | null; iodYear: string | null; fsmYear: number | null; settingsVersion: number | null };
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

// The schools around a school, every one within the widest radius any school may draw (30 km), all
// sectors, nearest first (the app's nearest_schools; its spatial index makes a long list cheap). Read in
// pages under PostgREST's 1,000-row cap, until a page runs past 30 km. Round 3 read the nearest 400,
// which a 30 km circle in London would overrun.
const NEARBY_PAGE = 1000;
const NEARBY_MAX_M = 30_000;
type Near = { urn: string; establishment_type_group: string | null; statutory_low_age: number; statutory_high_age: number; distance_metres: number };
function schoolsNear(urn: string): Promise<Near[]> {
  return cachedReference(`smt:near-all:${urn}`, async () => {
    const out: Near[] = [];
    for (let from = 0; from < 20 * NEARBY_PAGE; from += NEARBY_PAGE) {
      const { data, error } = await createServerAnonSupabaseClient().rpc("nearest_schools", { p_urn: urn, p_limit: from + NEARBY_PAGE, p_relax_sector: true }).range(from, from + NEARBY_PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as Near[];
      out.push(...page);
      if (page.length < NEARBY_PAGE || (page.at(-1)?.distance_metres ?? 0) > NEARBY_MAX_M) break;
    }
    return out.filter((c) => c.distance_metres <= NEARBY_MAX_M);
  });
}

// Pupils of the ages at a set of schools, in one census year (dfe_school_census, full- and part-time,
// girls and boys): only the ages and the year the line says, so a 30 km circle reads quickly.
function pupilsAt(urns: string[], ages: [number, number], period: number): Promise<Map<string, number>> {
  return cachedReference(`smt:pupils-at:${period}:${ages.join("-")}:${urns.length}:${urns.slice(0, 3).join(",")}:${urns.at(-1)}`, async () => {
    const keys = (["full_time", "part_time"] as const).flatMap((m) => (["female", "male"] as const).flatMap((sx) => Array.from({ length: ages[1] - ages[0] + 1 }, (_, i) => `${m}_${sx}_aged_${ages[0] + i}`)));
    const facts = urns.length ? await fetchCensusFactsBatched(urns, { periodMin: period, periodMax: period, breakdowns: keys }) : [];
    const out = new Map<string, number>();
    for (const f of facts) if (f.value_numeric !== null && f.period === period) out.set(f.entity_id, (out.get(f.entity_id) ?? 0) + f.value_numeric);
    return out;
  });
}

// The fixed bands the lookups' authority mix is given for.
const MIX_BANDS = ["0-3", "4-10", "11-15", "16-17", "16-18", "0-18"] as const;
const MIX_SHOWN = 5;

/** The authority mix for the school's ages: the band itself when it is one of the lookups', or two
 * bands that make it up exactly (11-18 = 11-15 + 16-18), weighted by the area's children in each; else
 * all ages 0-18 (said). Shares under 1% fold into "other". */
export function mixLine(mix: AreaMix[], ages: [number, number], bandTotal: (key: string) => number | null, radius: string): { line: string; ages: string } | null {
  if (!mix.length) return null;
  const key = `${ages[0]}-${ages[1]}`;
  let shares: Map<string, number> | null = null;
  let label = agesWordOf(ages);
  if ((MIX_BANDS as readonly string[]).includes(key)) shares = new Map(mix.map((m) => [m.name, m.share[key] ?? 0]));
  else
    for (const a of MIX_BANDS)
      for (const b of MIX_BANDS) {
        const [a0, a1] = a.split("-").map(Number);
        const [b0, b1] = b.split("-").map(Number);
        if (shares || a0 !== ages[0] || b1 !== ages[1] || b0 !== a1 + 1) continue;
        const ta = bandTotal(a);
        const tb = bandTotal(b);
        if (!ta || !tb) continue;
        shares = new Map(mix.map((m) => [m.name, ((m.share[a] ?? 0) * ta + (m.share[b] ?? 0) * tb) / (ta + tb)]));
      }
  if (!shares) {
    shares = new Map(mix.map((m) => [m.name, m.share["0-18"] ?? 0]));
    label = agesWordOf([0, 18]);
  }
  // Short (R5): at most MIX_SHOWN authorities, each 1% or more; the rest fold into "other".
  const sorted = [...shares].sort((x, y) => y[1] - x[1]);
  const shown = sorted.filter(([, v], i) => v >= 1 && i < MIX_SHOWN);
  const other = sorted.filter((x) => !shown.includes(x)).reduce((t, [, v]) => t + v, 0);
  const parts = shown.map(([n, v]) => `${n} ${Math.round(v)}%`);
  if (other >= 0.5) parts.push(`other ${Math.round(other)}%`);
  return { line: smtNote("areaMix", { radius, mix: parts.join(", ") }), ages: smtNote("areaMixAges", { ages: label }) };
}

/** The forward view from a projection: the rows for the ages, the estimates that meet them, the tile,
 * and ONS's comparison line. */
function forwardFrom(p: AreaProjection, ages: [number, number], estimates: Pt[], ons: Map<number, number | null> | null, onsBase: number | null, where: string): Forward {
  const rows = p.rows.filter((r) => r.ageFrom === ages[0] && r.ageTo === ages[1]).sort((a, b) => a.year - b.year);
  const projection: ForwardPoint[] = rows.map((r) => ({ year: r.year, middle: r.middle, low: r.low, high: r.high, scenario: r.scenario, ons: ons?.get(r.year) ?? null, includesUnborn: r.includesUnborn }));
  const start = projection.find((x) => x.year === p.latestYear) ?? null;
  // The estimates run to the latest counted year: the projection's first row is that count.
  const est = [...estimates.filter((e) => e.year < p.latestYear), ...(start ? [{ year: p.latestYear, value: start.middle }] : [])];
  const toYear = p.latestYear + SMT_PROJECTION_TILE_AHEAD;
  const end = projection.find((x) => x.year === toYear) ?? null;
  const tile = start?.middle && end && end.middle !== null ? { to: toYear, changePct: pct(start.middle, end.middle) ?? 0, lowPct: pct(start.middle, end.low), highPct: pct(start.middle, end.high) } : null;
  return {
    scope: p.scope,
    where,
    estimates: est,
    projection,
    latestYear: p.latestYear,
    horizonEnd: p.horizonEnd,
    unbornFrom: projection.find((x) => x.includesUnborn)?.year ?? null,
    tile,
    ons: ons ? { base: onsBase, around: p.scope === "around" } : null,
    scenarioLabel: p.settings.scenario_label,
    settingsVersion: p.settingsVersion,
    settings: p.settings,
    yearsUsed: p.yearsUsed,
    sources: p.sources,
    bandMissing: p.rangeBandMissing,
    lsoaCount: p.lsoaCount,
  };
}

/** ONS's 2022-based projection for the ages, by year, for a set of authorities (ons_snpp). */
async function onsByLad(lads: string[], ages: [number, number]): Promise<Map<string, Map<number, number>>> {
  const out = new Map<string, Map<number, number>>();
  if (!lads.length) return out;
  const keys = Array.from({ length: ages[1] - ages[0] + 1 }, (_, i) => `age:${ages[0] + i}`);
  const facts = await lookupReferenceData({ sourceId: "ons_snpp", entityIds: lads, breakdowns: keys });
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    const m = out.get(f.entity_id) ?? out.set(f.entity_id, new Map()).get(f.entity_id)!;
    m.set(f.period, (m.get(f.period) ?? 0) + f.value_numeric);
  }
  return out;
}

export async function buildContext(school: SmtSchool, area: ContextArea, level: SmtPhase, catchment: Catchment): Promise<Context> {
  const urn = school.urn;
  const km = catchment.km;
  const radius = kmWord(km);
  const metres = km * 1000;
  const ages = levelAges(level, school.low, school.high);
  const agesWord = agesWordOf(ages);
  const phaseWord = ages[1] <= 10 ? "primary" : ages[0] >= 16 ? "sixth-form" : "secondary";
  const [aggs, england, near, ac, laPop, laProj, engPop, la] = await Promise.all([areaByAge(), englandSchools(), schoolsNear(urn), areaContext(urn, km), laPopulation(school.laCode), laProjection(school.laCode), englandPopulation(), laCodes(school.laCode)]);
  const census = aggs.filter((r) => r.scope === "la").map((r) => r.period);
  const latestCensus = census.length ? Math.max(...census) : null;

  // ------------------------------------------------------------ residents (ONS)
  const acYears = ac?.years ?? [];
  const acLast = acYears.at(-1) ?? null;
  const acFirst = acYears[0] ?? null;
  const laYears = Array.from(laPop.keys()).sort((a, b) => a - b);
  const laLatest = laYears.at(-1) ?? null;
  const laFirst = laYears[0] ?? null;
  const children =
    area === "around"
      ? { value: acLast ? sumAges(acLast.children, ages) : null, year: acLast?.year ?? null, scope: acLast ? smtNote("childrenLiving", { radius, year: acLast.year }) : `within ${radius}`, since: acFirst && acLast && acFirst.year !== acLast.year ? { from: acFirst.year, changePct: pct(sumAges(acFirst.children, ages), sumAges(acLast.children, ages)) ?? 0 } : null }
      : { value: laLatest !== null ? sumAges(laPop.get(laLatest), ages) : null, year: laLatest, scope: laLatest !== null ? smtNote("childrenLivingLa", { la: school.laName ?? "the LA", year: laLatest }) : `in ${school.laName ?? "the LA"}`, since: laFirst !== null && laLatest !== null && laFirst !== laLatest ? { from: laFirst, changePct: pct(sumAges(laPop.get(laFirst), ages), sumAges(laPop.get(laLatest), ages)) ?? 0 } : null };

  // ------------------------------------------------------------ pupils at schools within the radius (census)
  const around = near.filter((c) => c.urn !== urn && c.distance_metres <= metres);
  // A school of the same phase: it teaches at least three of the ages (a primary that runs to 11
  // isn't a secondary school); for a two-year range, both.
  const need = Math.min(3, ages[1] - ages[0] + 1);
  const holds = (low: number | null, high: number | null) => Math.min(high ?? -1, ages[1]) - Math.max(low ?? 99, ages[0]) + 1 >= need;
  const nearbyPhase = around.filter((c) => holds(c.statutory_low_age, c.statutory_high_age));
  // The latest census year (r4: the ages and that year only, read for every school in the circle).
  const counted = area === "around" && latestCensus !== null ? await pupilsAt([urn, ...nearbyPhase.map((c) => c.urn)], ages, latestCensus) : new Map<string, number>();
  let pupilsNearby = 0;
  for (const v of counted.values()) pupilsNearby += v;

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

  // ------------------------------------------------------------ the forward view (F)
  const snppBase = Array.from(laProj.keys()).sort((a, b) => a - b)[0] ?? null;
  const where = area === "around" ? `within ${radius}` : `in ${school.laName ?? "the LA"}`;
  let forward: Forward | null = null;
  let mix: Context["now"]["mix"] = null;
  if (area === "around") {
    const p = await areaProjection(urn, km, ages);
    if (p) {
      const at = (key: string) => {
        const [lo, hi] = key.split("-").map(Number);
        return p.rows.find((r) => r.year === p.latestYear && r.ageFrom === lo && r.ageTo === hi)?.middle ?? null;
      };
      mix = mixLine(p.mix, ages, at, radius);
      // ONS's comparison line around the school: ONS projects authorities only, so each authority's part
      // of the area (its share of the area's children of these ages, the latest year) moves by ONS's
      // own change for that authority.
      const startRow = p.rows.find((r) => r.year === p.latestYear && r.ageFrom === ages[0] && r.ageTo === ages[1]);
      const onsL = await onsByLad(p.mix.map((m) => m.lad), ages);
      const key = `${ages[0]}-${ages[1]}`;
      // Shares are rounded to 0.1%: normalised so the line starts exactly at the area's count.
      const total = p.mix.reduce((t, m) => t + (m.share[key] ?? m.share["0-18"] ?? 0), 0) || 1;
      const weight = (m: AreaMix) => (m.share[key] ?? m.share["0-18"] ?? 0) / total;
      const ons = new Map<number, number | null>();
      if (startRow?.middle)
        for (const r of p.rows.filter((x) => x.ageFrom === ages[0] && x.ageTo === ages[1])) {
          let t = 0;
          let ok = true;
          for (const m of p.mix) {
            const s = onsL.get(m.lad);
            const base = s?.get(p.latestYear);
            const v = s?.get(r.year);
            if (!base || v === undefined) {
              if (weight(m) > 0) ok = false;
              continue;
            }
            t += startRow.middle * weight(m) * (v / base);
          }
          ons.set(r.year, ok ? t : null);
        }
      forward = forwardFrom(p, ages, acYears.map((y) => ({ year: y.year, value: sumAges(y.children, ages) })), ons, snppBase, where);
    }
  } else {
    const p = await laAreaProjection(school.laCode, ages);
    if (p) {
      const ons = new Map<number, number | null>(Array.from(laProj.keys()).map((y) => [y, sumAges(laProj.get(y), ages)]));
      forward = forwardFrom(p, ages, laYears.map((y) => ({ year: y, value: sumAges(laPop.get(y), ages) })), ons, snppBase, where);
    }
  }
  const projection = forward?.tile
    ? { agesWord, from: forward.latestYear, to: forward.tile.to, changePct: forward.tile.changePct, lowPct: forward.tile.lowPct, highPct: forward.tile.highPct, caption: area === "around" ? smtNote("projectionTile", { radius }) : smtNote("projectionTileLa", { la: school.laName ?? "the LA" }) }
    : null;

  // ------------------------------------------------------------ children nearby over time (indexed)
  const nearbySchool = acYears.map((y) => ({ year: y.year, value: sumAges(y.children, ages) }));
  const nearbyLa = laYears.map((y) => ({ year: y, value: sumAges(laPop.get(y), ages) }));
  const nearbyEng = Array.from(engPop.keys()).sort((a, b) => a - b).map((y) => ({ year: y, value: sumAges(engPop.get(y), ages) }));
  const nix = indexTo([nearbySchool, nearbyLa, nearbyEng]);

  // ------------------------------------------------------------ social context
  const idaciMix = ac?.idaciMix ?? null;
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

  const byAgeAround = area === "around" && acLast;
  const iodYear = iodYearOf(ac?.edition ?? null);
  const sources = { lsoaYear: acLast?.year ?? null, laYear: laLatest, snppBase, iodYear, fsmYear: Number.isFinite(fsmYear) ? fsmYear : null, settingsVersion: forward?.settingsVersion ?? null };
  return {
    urn,
    area,
    level,
    ages,
    agesWord,
    catchment,
    radius,
    place: { town: school.town, la: school.laName, region: school.regionName },
    now: {
      children,
      mix: area === "around" ? mix : null,
      pupilsNearby: area === "around" ? { value: pupilsNearby, period: latestCensus } : null,
      births: lastBirth && lastBirth.value !== null ? { year: lastBirth.year, value: lastBirth.value, since: firstBirth && firstBirth.value ? { from: BIRTHS_FROM, changePct: pct(firstBirth.value, lastBirth.value) ?? 0 } : null } : null,
      projection,
      schools: area === "around" ? { count: nearbyPhase.length, scope: `within ${radius}`, phaseWord } : { count: laSchoolCount ?? 0, scope: `in ${school.laName ?? "the LA"}`, phaseWord: "all" },
      oneNeighbourhood: area === "around" && (ac?.lsoaCount ?? 0) === 1,
    },
    social: { lsoa: ac?.own?.lsoa ?? null, imd: ac?.own?.imd ?? null, idaci: ac?.own?.idaci ?? null, edition: ac?.edition ?? null, mix: idaciMix, deprived20: idaciMix ? idaciMix[0] + idaciMix[1] : null, fsm },
    map: { las, schools: points, shade: `pupils aged ${agesWord}`, period: latestCensus },
    byAge: byAgeAround
      ? { period: acLast.year, ages: acLast.children.map((v, age) => ({ age, value: v })), scope: "around", laName: school.laName }
      : { period: laLatest, ages: laLatest !== null ? (laPop.get(laLatest) ?? []).map((v, age) => ({ age, value: v })) : [], scope: "la", laName: school.laName },
    births: { la: laPts, england: engPts, indexed: { la: ix.out[0], england: ix.out[1] }, base: ix.base, laName: school.laName },
    forward,
    nearby: { school: nearbySchool, la: nearbyLa, england: nearbyEng, indexed: { school: nix.out[0], la: nix.out[1], england: nix.out[2] }, base: nix.base },
    sources,
    notes: {
      aroundSchool: smtNote("aroundSchool", { radius }),
      children: `${smtNote("childrenAround", { ages: agesWord, radius })} ${smtNote("wResidents", { radius })}`,
      births: smtNote("births"),
      projection: smtNote("projection", { ages: agesWord, where }),
      popByAge: byAgeAround ? smtNote("popByAgeAround", { radius, year: acLast.year }) : smtNote("popByAgeLa", { la: school.laName ?? "The LA", year: laLatest ?? "" }),
      shade: smtNote("shadeByDistrict"),
      nearby: smtNote("nearbyOverTime", { ages: agesWord, radius, la: school.laName ?? "the LA", base: indexBaseWords(nix.base, "calendar") }),
      population: forward ? smtNote("populationProjected", { ages: agesWord, where, year: forward.latestYear, to: forward.horizonEnd }) : "",
      sources: smtNote("wSources", { lsoaYear: sources.lsoaYear ?? "", laYear: sources.laYear ?? "", settingsVersion: sources.settingsVersion ?? "", snppBase: snppBase ?? "", iodYear: iodYear ?? "", fsmYear: sources.fsmYear !== null ? periodLabel(sources.fsmYear) : "" }),
    },
  };
}
