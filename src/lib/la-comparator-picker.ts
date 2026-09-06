// Member Data View (UX refinements round 1, B3): "allow adding additional/adjacent
// Local Authorities as choices, not limited to a single LA at a time" -- support
// functions for the new multi-LA "Compared with" picker.
//
// "Adjacent" is interpreted here as "LAs a member would naturally want to add,"
// derived from REAL geography (the target's own nearest schools' actual LAs) rather
// than a computed geographic-boundary adjacency, since this repo has no real LA-
// boundary/neighbour dataset at all (checked directly -- grepped the whole codebase
// for "adjacent"/"neighbour"/"bordering" before writing this, found nothing that
// means geographic LA adjacency). A genuine, geographically-verified adjacency table
// (ONS boundary data, say) is real, separate infrastructure work -- logged in
// docs/vicdata_data_view_open_questions.md rather than approximated with a fabricated
// distance-threshold guess. This approach is still real and grounded: the target's
// own nearest real schools are, almost by construction, mostly in genuinely nearby
// LAs, so their real la_name values are a reasonable, honestly-sourced proxy for
// "LAs worth adding," ordered by how soon they appear in the real nearest-first list
// (not alphabetically or by raw frequency).

import { findSurroundingSchools } from "./surrounding-schools";
import { CURRENT_CENSUS_PERIOD } from "./roll-data";

export type AdjacentLaCandidate = { name: string };

// Looks at a wider nearest-N pool than the default List 1 (60, not 10) purely to
// surface enough DISTINCT neighbouring LA names to make "Select all" worth having --
// the default Nearest 10 list alone often only touches 2-3 LAs in a dense urban area.
const CANDIDATE_POOL_SIZE = 60;
const MAX_ADJACENT_LAS = 8;

export async function adjacentLaCandidates(urn: string, ownLaName: string | null): Promise<AdjacentLaCandidate[]> {
  const matched = await findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { targetCount: CANDIDATE_POOL_SIZE, genderMode: "relaxed" });
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of matched) {
    if (!m.laName || m.laName === ownLaName || seen.has(m.laName)) continue;
    seen.add(m.laName);
    ordered.push(m.laName);
    if (ordered.length >= MAX_ADJACENT_LAS) break;
  }
  return ordered.map((name) => ({ name }));
}
