// VicData 0.7 admissions (A1): Market share, assembled. Server-only.
// The school's pupils at the entry age (and across a whole age band) as a share of the same
// ages across the rivals plus the school, every census year (R-ADM-GROUP-SHARE): a share of
// THIS GROUP, not of the local market. Ranks within the set; the change since the first year.
import { fetchCensus, fetchSchoolInfo } from "./data";
import type { CohortTable, Sex } from "./cohort";
import { groupShare, type GroupShareRow } from "./shares";
import { defaultRivals, nearbyCandidates } from "./rungs";
import type { EntryPoint } from "./entry-points";

export type MarketShare = {
  urn: string;
  entry: EntryPoint;
  rivals: string[];
  band: { from: number; to: number };
  entryAge: { periods: number[]; rows: GroupShareRow[]; totals: Record<number, number> };
  ageBand: { periods: number[]; rows: GroupShareRow[]; totals: Record<number, number> };
  schools: Record<string, { name: string }>;
};

/** The school's age band for an entry point: the entry age up to the band's top (11+ -> 11-15,
 * 16+ -> 16-18, 4+ -> 4-10; a custom age -> to the end of its phase). */
export function entryBand(ep: EntryPoint): { from: number; to: number } {
  const to = ep.age <= 10 ? 10 : ep.age <= 15 ? 15 : 18;
  return { from: ep.age, to };
}

export async function buildMarketShare(urn: string, entry: EntryPoint, opts: { rivals?: string[]; sex?: Sex } = {}): Promise<MarketShare> {
  const rivals = (opts.rivals ?? defaultRivals(entry, await nearbyCandidates(urn))).filter((u) => u !== urn);
  const urns = [urn, ...rivals];
  const [census, info] = await Promise.all([fetchCensus(urns), fetchSchoolInfo(urns)]);
  const tables = new Map<string, CohortTable>(urns.map((u) => [u, census.get(u)?.table ?? new Map()]));
  const band = entryBand(entry);
  const ages = Array.from({ length: band.to - band.from + 1 }, (_, i) => band.from + i);
  const one = groupShare(tables, [entry.age], opts.sex);
  const all = groupShare(tables, ages, opts.sex);
  return {
    urn,
    entry,
    rivals,
    band,
    entryAge: { periods: one.periods, rows: one.rows, totals: Object.fromEntries(one.totals) },
    ageBand: { periods: all.periods, rows: all.rows, totals: Object.fromEntries(all.totals) },
    schools: Object.fromEntries(Array.from(info, ([u, i]) => [u, { name: i.name }])),
  };
}
