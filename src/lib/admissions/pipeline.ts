// VicData 0.7 admissions (A1): Pipelines, assembled. Server-only.
// One entry point for one school: the rung sets (the lead's confirmed lists when given, else
// the nearby defaults), the census for every school involved, the LA birth blend (automatic, or
// the lead's override), the ladder, and the share needed to hold numbers steady.
import { CURRENT_CENSUS_PERIOD } from "../roll-data";
import type { CohortTable, Sex } from "./cohort";
import { cachedCensus, fetchAge10Projections, fetchBirthsByLa, fetchSchoolInfo, type SchoolCensus, type SchoolInfo } from "./data";
import { firstEntryYear, type EntryPoint } from "./entry-points";
import { autoBlend, blendBirths, normalise, type BlendWeights } from "./blend";
import { buildLadder, poolChange, type Ladder } from "./ladder";
import { holdShare, type HoldShare } from "./shares";
import { defaultRungSets, nearbyCandidates, type RungSets } from "./rungs";
import { cohortAt } from "./cohort";

export type PipelineOptions = {
  sets?: RungSets; // confirmed lists (admissions_lists), else the nearby defaults
  laBlend?: Record<string, number> | null; // the lead's override, DfE LA code -> weight
  sex?: Sex;
  includeProjection?: boolean;
  today?: Date;
};

export type Pipeline = {
  urn: string;
  entry: EntryPoint;
  censusPeriod: number;
  sets: { age: number; urns: string[] }[];
  ladder: Ladder;
  hold: HoldShare;
  change: ReturnType<typeof poolChange>;
  blend: { laCode: string; laName: string | null; weight: number }[];
  blendSource: "automatic" | "override";
  schools: Record<string, { name: string; laCode: string | null }>;
};

export async function buildPipeline(urn: string, entry: EntryPoint, opts: PipelineOptions = {}): Promise<Pipeline> {
  const sets = opts.sets ?? defaultRungSets(urn, entry, await nearbyCandidates(urn));
  const all = Array.from(new Set([urn, ...Array.from(sets.values()).flat()]));
  const [census, info] = await Promise.all([cachedCensus(all), fetchSchoolInfo(all)]);
  const P = CURRENT_CENSUS_PERIOD;
  // One per-school list per distinct set (the same array object for every age a set holds).
  const byKey = new Map<string, CohortTable[]>();
  const listFor = (urns: string[]) => {
    const key = [...urns].sort().join(",");
    if (!byKey.has(key)) byKey.set(key, urns.map((u) => census.get(u)?.table).filter((t): t is CohortTable => !!t));
    return byKey.get(key)!;
  };
  const lists = new Map<number, CohortTable[]>(Array.from(sets, ([age, urns]) => [age, listFor(urns)]));
  const empty: CohortTable[] = [];
  const rungSchools = (age: number) => lists.get(age) ?? empty;

  // The blend: the LAs of the youngest rung's schools, weighted by their pupils at that age.
  const blendAge = Math.min(4, entry.age);
  const youngest = sets.get(4) ?? sets.get(Math.min(...sets.keys())) ?? [];
  const weights: BlendWeights = opts.laBlend
    ? normalise(new Map(Object.entries(opts.laBlend)))
    : autoBlend(youngest.map((u) => ({ laCode: info.get(u)?.laCode ?? null, pupils: cohortAt(census.get(u)?.table ?? new Map(), Math.max(blendAge, 4), P) })));
  if (weights.size === 0 && info.get(urn)?.laCode) weights.set(info.get(urn)!.laCode!, 1);
  const birthsByLa = await fetchBirthsByLa(Array.from(weights.keys()));
  const births = blendBirths(weights, birthsByLa);

  let projections: Map<number, number> | null = null;
  if (opts.includeProjection && entry.age === 11) {
    const laNames = Array.from(new Set(Array.from(weights.keys()).map((la) => Array.from(info.values()).find((i) => i.laCode === la)?.laName).filter((x): x is string => !!x)));
    const byLa = await fetchAge10Projections(laNames);
    projections = new Map();
    for (const [la, w] of weights) {
      const name = Array.from(info.values()).find((i) => i.laCode === la)?.laName;
      const series = name ? byLa.get(name) : undefined;
      if (!series) { projections = null; break; }
      for (const [y, v] of series) projections.set(y, (projections.get(y) ?? 0) + w * v);
    }
  }

  const ladder = buildLadder({
    entry,
    censusPeriod: P,
    firstEntryYear: firstEntryYear(opts.today ?? new Date()),
    rungSchools,
    birthsByYear: births.size ? births : null,
    projectionsByYear: projections,
    sex: opts.sex,
    includeProjection: opts.includeProjection,
  });
  const own = census.get(urn)?.table ?? new Map();
  const lastFuture = ladder.future[ladder.future.length - 1]?.entryYear;
  return {
    urn,
    entry,
    censusPeriod: P,
    sets: Array.from(sets, ([age, urns]) => ({ age, urns })).sort((a, b) => a.age - b.age),
    ladder,
    hold: holdShare(ladder, own, P, opts.sex),
    change: lastFuture === undefined ? null : poolChange(ladder, Math.min(lastFuture, (ladder.future[0]?.entryYear ?? P) + 3)),
    blend: Array.from(weights, ([laCode, weight]) => ({ laCode, laName: Array.from(info.values()).find((i) => i.laCode === laCode)?.laName ?? null, weight })),
    blendSource: opts.laBlend ? "override" : "automatic",
    schools: Object.fromEntries(Array.from(info, ([u, i]: [string, SchoolInfo]) => [u, { name: i.name, laCode: i.laCode }])),
  };
}

export type { SchoolCensus };
