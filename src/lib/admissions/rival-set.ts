// VicData 0.7 admissions r2: the rival set every Market share call uses -- the lead's saved rivals
// list, else the nearest schools teaching the entry year (round 1's defaultRivals), narrowed by the
// top bar's filters. One function, so Market share, the rivals' ranks and the shapes always talk
// about the same schools. Server-only.
import type { EntryPoint } from "./entry-points";
import { rivalsFromLists, type SavedList } from "./lists";
import { defaultRivals, nearbyCandidates } from "./rungs";
import { fetchSchoolTraits, isDefaultFilters, narrow, type AdmissionsFilters, type SchoolTraits } from "./traits";

export async function rivalSet(urn: string, ep: EntryPoint, lists: SavedList[], filters: AdmissionsFilters): Promise<{ rivals: string[]; saved: boolean; traits: Map<string, SchoolTraits> }> {
  const saved = rivalsFromLists(lists);
  const base = (saved ?? defaultRivals(ep, await nearbyCandidates(urn))).filter((u) => u !== urn);
  const traits = await fetchSchoolTraits([urn, ...base]);
  return { rivals: isDefaultFilters(filters) ? base : narrow(base, traits, filters), saved: !!saved, traits };
}
