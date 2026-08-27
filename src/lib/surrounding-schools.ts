// "Surrounding schools" matching for the State of the School page (rolls spec §4/§10,
// expanded by the "Public View rebuild" design review): nearest-10 candidates
// (nearest_schools RPC), matched on Sector + Phase + Gender combined (not Boarding --
// deliberately deferred to subscription-tier percentage-based filtering, Guy's own
// call, logged in docs/OPEN_QUESTIONS.md). Free tier is summary/aggregate only
// (computeSurroundingSchoolsStat), never a named list -- the named, tagged version
// (getSurroundingSchoolsList) is member-area only, gated by its own API route, not by
// anything in this module -- this module has no auth awareness of its own.
//
// "Phase" matching started out reusing nearest_schools' existing statutory age-range
// overlap prefilter, but real-data verification against Acland Burghley (11-18,
// Senior only as of the 2026-08-28 Post 16 narrowing -- Senior+Sixth at the time this
// was found) surfaced a genuine bug in that approach: the overlap test only requires
// ranges to touch at a single boundary age, so an 11-and-under primary school (low
// 3/high 11) counts as "overlapping" an 11-18 secondary purely because both include
// age 11 -- which was dragging small primary schools into a "nearest senior schools"
// pool and producing a nonsensical "288% above average" stat. Fixed here by narrowing
// the RPC's broad overlap prefilter with a genuine phase-TAG-set intersection in
// application code (shares at least one of Junior/Prep/Senior/Post 16) -- a
// Junior-only school shares no tag with a Senior school and is correctly excluded,
// while genuinely phase-adjacent schools still match on their shared tag. "Gender" is
// the other new axis this round: exact match (Boys<->Boys, Girls<->Girls, Co-ed<->
// Co-ed), also applied in application code.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData } from "./vicdata-reference";
import {
  singleAgeGenderCountsForPeriod,
  shapeClassifierInput,
  type AgeGenderCounts,
} from "./roll-data";
import { classifyShape, type ShapeLabel } from "./shape-classifier";
import { genderTag, phaseTags, type GenderTag } from "./typology";

const TARGET_COUNT = 10; // reduced from 20, chart palette doc's "Public View rebuild"
const CANDIDATE_BUFFER = 40; // skip-and-backfill past both no-roll-data AND gender-mismatched candidates

export type MatchedSchool = {
  urn: string;
  currentName: string;
  town: string | null;
  postcode: string | null;
  establishmentTypeGroup: string | null;
  statutoryLowAge: number | null;
  statutoryHighAge: number | null;
  gender: string | null;
  boardersName: string | null;
  boarding: { boarders: number; day: number; total: number } | null;
  totalRoll: number;
  ageGenderCounts: AgeGenderCounts;
  easting: number | null;
  northing: number | null;
};

// The shared matching pipeline: nearest_schools RPC (distance + sector + broad age
// overlap) -> phase-tag intersection -> gender exact match -> has-roll-data
// skip-and-backfill -> first TARGET_COUNT. Both the free-tier aggregate and the
// member-tier named list are built from this same list, so they can never disagree
// about which schools are "the 10."
export async function findSurroundingSchools(urn: string, targetPeriod: number): Promise<MatchedSchool[]> {
  const supabase = createServerAnonSupabaseClient();

  const { data: targetRows } = await supabase
    .from("schools")
    .select("gender, statutory_low_age, statutory_high_age")
    .eq("urn", urn)
    .maybeSingle();
  const target = targetRows as
    | { gender: string | null; statutory_low_age: number | null; statutory_high_age: number | null }
    | null;
  const targetGender = genderTag(target?.gender ?? null);
  const targetPhase = phaseTags(target?.statutory_low_age ?? null, target?.statutory_high_age ?? null);

  const { data: candidates, error } = await supabase.rpc("nearest_schools", {
    p_urn: urn,
    p_limit: CANDIDATE_BUFFER,
  });

  if (error || !candidates || candidates.length === 0) return [];

  type Candidate = {
    urn: string;
    current_name: string;
    town: string | null;
    postcode: string | null;
    establishment_type_group: string | null;
    statutory_low_age: number | null;
    statutory_high_age: number | null;
  };
  const candidateList = candidates as Candidate[];

  // Phase match: does the candidate's stacked phase-tag set share at least one tag
  // with the target's? If the target itself falls through every phase-tag branch
  // (e.g. Woldingham, low 10/high 19), there's nothing to intersect against, so no
  // phase filter is applied -- same "can't match on the unknown" handling as gender.
  const phaseFiltered =
    targetPhase.length === 0
      ? candidateList
      : candidateList.filter((c) => {
          const candidatePhase = phaseTags(c.statutory_low_age, c.statutory_high_age);
          return candidatePhase.some((p) => targetPhase.includes(p));
        });

  if (phaseFiltered.length === 0) return [];

  const phaseFilteredUrns = phaseFiltered.map((c) => c.urn);

  const genderByUrn = new Map<string, GenderTag | null>();
  const rawGenderByUrn = new Map<string, string | null>();
  const boardersNameByUrn = new Map<string, string | null>();
  const positionByUrn = new Map<string, { easting: number | null; northing: number | null }>();
  const { data: attrRows } = await supabase
    .from("schools")
    .select("urn, gender, boarders_name, easting, northing")
    .in("urn", phaseFilteredUrns);
  for (const r of (attrRows as {
    urn: string;
    gender: string | null;
    boarders_name: string | null;
    easting: number | null;
    northing: number | null;
  }[]) ?? []) {
    genderByUrn.set(r.urn, genderTag(r.gender));
    rawGenderByUrn.set(r.urn, r.gender);
    boardersNameByUrn.set(r.urn, r.boarders_name);
    positionByUrn.set(r.urn, { easting: r.easting, northing: r.northing });
  }

  const genderFiltered = targetGender
    ? phaseFiltered.filter((c) => genderByUrn.get(c.urn) === targetGender)
    : phaseFiltered;

  if (genderFiltered.length === 0) return [];

  const genderFilteredUrns = genderFiltered.map((c) => c.urn);

  const facts = await lookupReferenceData({
    sourceId: "dfe_school_census",
    entityIds: genderFilteredUrns,
    periodMin: targetPeriod,
    periodMax: targetPeriod,
  });

  const results: MatchedSchool[] = [];
  // Skip-and-backfill (rolls spec §4, resolved here): candidates are already ordered
  // nearest-first by the RPC; walk them in order and keep the first 10 that actually
  // have DfE census roll data, skipping standalone 6th-form/FE colleges (and any
  // other gap) rather than erroring or silently misrepresenting. If the buffer runs
  // out before 10 are found, callers honestly report fewer than 10.
  for (const c of genderFiltered) {
    if (results.length >= TARGET_COUNT) break;
    const candidateFacts = facts.filter((f) => f.entity_id === c.urn);
    const counts = singleAgeGenderCountsForPeriod(candidateFacts, targetPeriod);
    if (counts.size === 0) continue;
    let total = 0;
    for (const v of counts.values()) total += v.male + v.female;
    if (total === 0) continue;

    // Same boarders_total/boarders_male/boarders_female breakdown roll-data.ts's
    // finishSnapshot reads for the target's own boarding figure -- pulled from the
    // same already-fetched census facts, so the member-list boarding tag gets the
    // same ratio-based Boarding/Day/Boarding & day refinement the viewed school's own
    // header does, not just the raw GIAS flag.
    const boardersTotal = candidateFacts.find((f) => f.breakdown === "boarders_total")?.value_numeric ?? null;
    const boarding = boardersTotal !== null ? { boarders: boardersTotal, day: Math.max(total - boardersTotal, 0), total } : null;

    results.push({
      urn: c.urn,
      currentName: c.current_name,
      town: c.town,
      postcode: c.postcode,
      establishmentTypeGroup: c.establishment_type_group,
      statutoryLowAge: c.statutory_low_age,
      statutoryHighAge: c.statutory_high_age,
      gender: rawGenderByUrn.get(c.urn) ?? null,
      boardersName: boardersNameByUrn.get(c.urn) ?? null,
      boarding,
      totalRoll: total,
      ageGenderCounts: counts,
      easting: positionByUrn.get(c.urn)?.easting ?? null,
      northing: positionByUrn.get(c.urn)?.northing ?? null,
    });
  }

  return results;
}

export type SurroundingSchoolsStat = {
  requested: number;
  found: number; // per rolls spec §4: may be fewer than 10 if the combined-filter pool is genuinely thin
  averageRoll: number | null;
  aggregateShape: ShapeLabel | null;
  aggregateAgeCounts: Map<number, number> | null; // ages 4-18, both sexes combined -- the free-tier "no-gender" grey chart
};

// Pure aggregator over an already-fetched match list -- lets a caller that also
// needs the raw MatchedSchool[] (e.g. the map component's marker positions) call
// findSurroundingSchools once and derive both from it, rather than hitting the RPC
// and DfE census lookup twice for the same page view.
export function aggregateSurroundingStat(matched: MatchedSchool[]): SurroundingSchoolsStat {
  if (matched.length === 0) {
    return { requested: TARGET_COUNT, found: 0, averageRoll: null, aggregateShape: null, aggregateAgeCounts: null };
  }

  const totalRoll = matched.reduce((sum, m) => sum + m.totalRoll, 0);
  const averageRoll = totalRoll / matched.length;

  const aggregateAgeCounts = new Map<number, number>();
  for (let age = 4; age <= 18; age++) {
    let sum = 0;
    for (const m of matched) {
      const c = m.ageGenderCounts.get(age);
      if (c) sum += c.male + c.female;
    }
    aggregateAgeCounts.set(age, sum);
  }

  const aggregateAgeGenderCounts: AgeGenderCounts = new Map();
  for (const m of matched) {
    for (const [age, c] of m.ageGenderCounts) {
      const existing = aggregateAgeGenderCounts.get(age) ?? { male: 0, female: 0 };
      aggregateAgeGenderCounts.set(age, { male: existing.male + c.male, female: existing.female + c.female });
    }
  }
  const aggregateShape = classifyShape(shapeClassifierInput(aggregateAgeGenderCounts))?.label ?? null;

  return {
    requested: TARGET_COUNT,
    found: matched.length,
    averageRoll,
    aggregateShape,
    aggregateAgeCounts,
  };
}

export async function computeSurroundingSchoolsStat(
  urn: string,
  targetPeriod: number,
): Promise<SurroundingSchoolsStat> {
  return aggregateSurroundingStat(await findSurroundingSchools(urn, targetPeriod));
}
