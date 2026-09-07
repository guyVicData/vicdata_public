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
import { classifyShape, type ShapeLabel, type ShapeMetrics, type DominantTransition } from "./shape-classifier";
import { genderTag, phaseTags, effectivePhaseTags, type GenderTag } from "./typology";

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
  // 2026-09-06, UX refinements round 1, B3: added for the new "adjacent LA" picker
  // (la-comparator-sets.ts) -- derives its candidate LA list from the REAL LAs the
  // target's own nearest schools actually sit in, rather than a fabricated geographic
  // adjacency table this repo has no real data source for. Pulled from the same
  // already-running `attrRows` query below (one extra column), not a new round-trip.
  laName: string | null;
};

// The shared matching pipeline: nearest_schools RPC (distance + sector + broad age
// overlap) -> phase-tag intersection -> gender exact match -> has-roll-data
// skip-and-backfill -> first TARGET_COUNT. Both the free-tier aggregate and the
// member-tier named list are built from this same list, so they can never disagree
// about which schools are "the 10."
// Member Data View build (2026-10-03), brief §6: the default-comparator-list
// generation (default-comparator-lists.ts) reuses this same matching pipeline
// end-to-end ("Every school gets defaults built on findSurroundingSchools()"), but
// with a genuinely different gender rule -- "coed accepts any gender; single-sex
// accepts its own sex plus coed, never the opposite single-sex" -- not this
// function's own free-tier EXACT match (Boys<->Boys, Girls<->Girls, Co-ed<->Co-ed
// only). New optional parameter, default "exact", so every existing caller (the free
// public surrounding-schools stat/list) is completely unaffected unless it opts in --
// the same "extend via an optional, default-preserving parameter" pattern
// nearest_schools' own p_relax_sector already established.
export type GenderMatchMode = "exact" | "relaxed";

// 2026-09-08, exported for default-comparator-lists.ts's own boarding-quintile
// recipe (Compared-with panel round 4): the bottom-3-quintile boarding match now
// reuses this exact relaxed rule rather than a re-derived copy -- one source of
// truth for "what counts as a gender match when relaxed" across every default list.
export function genderMatches(target: GenderTag, candidate: GenderTag | null, mode: GenderMatchMode): boolean {
  if (mode === "exact") return candidate === target;
  if (target === "Co-ed") return true;
  return candidate === target || candidate === "Co-ed";
}

export async function findSurroundingSchools(
  urn: string,
  targetPeriod: number,
  options: { genderMode?: GenderMatchMode; targetCount?: number } = {},
): Promise<MatchedSchool[]> {
  const genderMode = options.genderMode ?? "exact";
  // 2026-09-06, UX refinements round 1, B3: "for the Nearest 10 default set, add a
  // button to expand it by 5 more schools at a time." Optional, default-preserving
  // (TARGET_COUNT unchanged for every existing caller) -- the RPC's own candidate
  // buffer (CANDIDATE_BUFFER, below) is widened proportionally too, since asking for
  // more real matches needs a bigger raw pool to filter/skip-and-backfill through,
  // not just a higher cutoff on the same-sized buffer.
  const targetCount = options.targetCount ?? TARGET_COUNT;
  const candidateBuffer = Math.max(CANDIDATE_BUFFER, targetCount * 4);
  const supabase = createServerAnonSupabaseClient();

  const { data: targetRows } = await supabase
    .from("schools")
    .select("gender, statutory_low_age, statutory_high_age, establishment_type_group, establishment_type")
    .eq("urn", urn)
    .maybeSingle();
  const target = targetRows as
    | {
        gender: string | null;
        statutory_low_age: number | null;
        statutory_high_age: number | null;
        establishment_type_group: string | null;
        establishment_type: string | null;
      }
    | null;
  const targetGender = genderTag(target?.gender ?? null);

  // Member Data View build (2026-10-03), brief §2 item 1: the TARGET's own phase must
  // be enrollment-aware (effectivePhaseTags), not the nominal phaseTags() the rest of
  // this module still deliberately uses for candidates (see the phase-tag-intersection
  // filter's own comment below for why that half stays raw). Woldingham (statutory low
  // age 10, but zero real pupils below 11) was nominal-tagging as ["Junior","Senior"]
  // here, which incorrectly required every candidate to ALSO carry 2+ phase tags (the
  // through-school symmetry check just below) -- wrongly excluding genuine single-tag
  // Senior peers from what should read as an ordinary Senior school's own nearest-10.
  // Needs the target's own real census facts to do this, which this module didn't
  // otherwise fetch for itself (only ever for candidates, later in this function) --
  // one small extra lookup, scoped to a single entity, not the expensive batched
  // candidate fetch below.
  const targetFacts = await lookupReferenceData({
    sourceId: "dfe_school_census",
    entityIds: [urn],
    periodMin: targetPeriod,
    periodMax: targetPeriod,
  });
  const targetAgeGenderCounts = singleAgeGenderCountsForPeriod(targetFacts, targetPeriod);
  const targetPhase = effectivePhaseTags(
    target?.statutory_low_age ?? null,
    target?.statutory_high_age ?? null,
    target?.establishment_type ?? null,
    targetAgeGenderCounts,
  );

  // 2026-09-30: state through-schools (rare -- Steiner Academy Hereford is the real
  // example) are stuck matching only other state schools under nearest_schools' own
  // sector-equality gate, a genuinely thin same-sector pool at LA/regional level.
  // Independent through-schools are common enough that their own same-sector pool is
  // already fine -- this only widens for the rare state case. Passed to the RPC as
  // p_relax_sector; the through-school-only narrowing still comes from the phase-tag-
  // count symmetry check below (targetPhase.length > 1 requiring candidatePhase.length
  // > 1 too), unchanged and already sector-agnostic -- relaxing the RPC's own sector
  // gate doesn't loosen that.
  const relaxSectorForThroughSchool =
    targetPhase.length > 1 && target?.establishment_type_group !== "Independent schools";

  type Candidate = {
    urn: string;
    current_name: string;
    town: string | null;
    postcode: string | null;
    establishment_type_group: string | null;
    establishment_type: string | null;
    statutory_low_age: number | null;
    statutory_high_age: number | null;
  };

  // Member Data View performance architecture v1 (2026-10-08): read the precomputed
  // school_nearest_neighbours 'general' pool (shared with the member Data View's
  // Nearest-10/LA-any/bottom-3-quintile-boarding recipes) instead of calling the
  // nearest_schools RPC live -- that RPC was never itself the slow part (it's a fast,
  // already-indexed live query), but removing it here means this shared function's
  // ONE candidate-generation step benefits both callers, matching the direct
  // instruction to migrate this page's own findSurroundingSchools() call onto the same
  // precomputed table the member side uses, not build a second copy.
  //
  // The precomputed pool was built with p_relax_sector ALWAYS true (the widest
  // reasonable candidate set: AP/PRU excluded, special-school symmetry already
  // applied, age-range overlap already applied -- see that table's own migration
  // comment) specifically so THIS function's own per-target, ENROLLMENT-aware
  // relaxSectorForThroughSchool decision (which needs live census data and can't be
  // precomputed) can still be applied faithfully, as a cheap local filter over the
  // ~100 precomputed rows, rather than losing that nuance. nearest_schools' own
  // sector-equality gate (verified directly from its real SQL, not assumed) is really
  // just one boolean check -- "is this school Independent?" must match between target
  // and candidate -- for a non-special target when NOT relaxed; a special target's
  // candidates are already fully special-symmetric in the precomputed pool regardless
  // (that branch of nearest_schools has no relax-sector condition at all), so no
  // further local filtering is needed for it.
  const specialLeakTypes = ["Academy special converter", "Academy special sponsor led", "Free schools special"];
  const targetIsSpecial =
    target?.establishment_type_group === "Special schools" || specialLeakTypes.includes(target?.establishment_type ?? "");
  const isIndependent = (group: string | null) => group === "Independent schools";

  const { data: precomputed } = await supabase
    .from("school_nearest_neighbours")
    .select("neighbour_urn, rank")
    .eq("urn", urn)
    .eq("pool", "general")
    .order("rank", { ascending: true })
    .limit(candidateBuffer);

  let candidateList: Candidate[];
  if (precomputed && precomputed.length > 0) {
    const neighbourUrns = precomputed.map((p) => p.neighbour_urn);
    const rankByUrn = new Map(precomputed.map((p) => [p.neighbour_urn, p.rank as number]));
    const { data: attrs } = await supabase
      .from("schools")
      .select("urn, current_name, town, postcode, establishment_type_group, establishment_type, statutory_low_age, statutory_high_age")
      .in("urn", neighbourUrns);
    candidateList = ((attrs ?? []) as Candidate[])
      .filter((a) => targetIsSpecial || relaxSectorForThroughSchool || isIndependent(a.establishment_type_group) === isIndependent(target?.establishment_type_group ?? null))
      .sort((a, b) => (rankByUrn.get(a.urn) ?? 0) - (rankByUrn.get(b.urn) ?? 0));
  } else {
    // Fallback: the precomputed table hasn't been populated for this school yet (e.g.
    // a brand-new school before the next GIAS-affecting recompute) -- fall back to the
    // live RPC rather than returning nothing.
    const { data: candidates, error } = await supabase.rpc("nearest_schools", {
      p_urn: urn,
      p_limit: candidateBuffer,
      p_relax_sector: relaxSectorForThroughSchool,
    });
    if (error || !candidates || candidates.length === 0) return [];
    candidateList = candidates as Candidate[];
  }
  if (candidateList.length === 0) return [];

  // Phase match: does the candidate's stacked phase-tag set share at least one tag
  // with the target's? If the target itself falls through every phase-tag branch
  // (e.g. Woldingham, low 10/high 19), there's nothing to intersect against, so no
  // phase filter is applied -- same "can't match on the unknown" handling as gender.
  //
  // 2026-09-11, round 19, item 5 bug B: a shared-tag-only test lets a single-tag
  // Senior-only school into a genuine through-school's peer pool purely because they
  // both carry "Senior" -- real-data check (Stockport Grammar, Junior/Prep + Senior)
  // confirmed this was happening. When the target itself has more than one phase tag,
  // also require the candidate to have more than one -- keeps this on the same raw,
  // nominal phaseTags() the rest of this module already uses (not effectivePhaseTags,
  // which would need a per-candidate census fetch this module doesn't otherwise do).
  // A genuine consequence: the peer pool for through-schools can legitimately shrink
  // below TARGET_COUNT where few through-school peers exist nearby -- an honest
  // reflection of a thin pool, not a bug to work around.
  //
  // Confirmed still correct after the 2026-10-03 target-side effectivePhaseTags fix
  // above (brief §2 items 1+2, carried forward as a decision, not re-litigated): a
  // through-school target like Stockport Grammar still resolves to real 2+ effective
  // tags (it genuinely has junior-age pupils), so this symmetry check still applies to
  // it correctly; a nominal-only through-school like Woldingham now resolves to a
  // single effective tag (Senior), so this check no longer wrongly narrows its pool to
  // through-school-only candidates -- the two fixes compose correctly together.
  const phaseFiltered =
    targetPhase.length === 0
      ? candidateList
      : candidateList.filter((c) => {
          const candidatePhase = phaseTags(c.statutory_low_age, c.statutory_high_age, c.establishment_type);
          const sharesTag = candidatePhase.some((p) => targetPhase.includes(p));
          if (!sharesTag) return false;
          if (targetPhase.length > 1) return candidatePhase.length > 1;
          return true;
        });

  if (phaseFiltered.length === 0) return [];

  const phaseFilteredUrns = phaseFiltered.map((c) => c.urn);

  const genderByUrn = new Map<string, GenderTag | null>();
  const rawGenderByUrn = new Map<string, string | null>();
  const boardersNameByUrn = new Map<string, string | null>();
  const positionByUrn = new Map<string, { easting: number | null; northing: number | null }>();
  const laNameByUrn = new Map<string, string | null>();
  const { data: attrRows } = await supabase
    .from("schools")
    .select("urn, gender, boarders_name, easting, northing, la_name")
    .in("urn", phaseFilteredUrns);
  for (const r of (attrRows as {
    urn: string;
    gender: string | null;
    boarders_name: string | null;
    easting: number | null;
    northing: number | null;
    la_name: string | null;
  }[]) ?? []) {
    genderByUrn.set(r.urn, genderTag(r.gender));
    rawGenderByUrn.set(r.urn, r.gender);
    boardersNameByUrn.set(r.urn, r.boarders_name);
    positionByUrn.set(r.urn, { easting: r.easting, northing: r.northing });
    laNameByUrn.set(r.urn, r.la_name);
  }

  const genderFiltered = targetGender
    ? phaseFiltered.filter((c) => genderMatches(targetGender, genderByUrn.get(c.urn) ?? null, genderMode))
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
    if (results.length >= targetCount) break;
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
      laName: laNameByUrn.get(c.urn) ?? null,
    });
  }

  return results;
}

export type SurroundingSchoolsStat = {
  requested: number;
  found: number; // per rolls spec §4: may be fewer than 10 if the combined-filter pool is genuinely thin
  averageRoll: number | null;
  aggregateShape: ShapeLabel | null;
  // 2026-09-11, round 19, item 6: additive alongside aggregateShape (previously the
  // only field kept from classifyShape's result -- .label, with .metrics and
  // .dominantTransition discarded). Needed to give the combined-shape block the same
  // full icon+name+numeric-definition treatment (narrative.ts's numericShapeDefinition)
  // the focus school's own shape already gets, rather than a bare label.
  aggregateMetrics: ShapeMetrics | null;
  aggregateDominantTransition: DominantTransition | null;
  aggregateAgeCounts: Map<number, number> | null; // ages 4-18, both sexes combined -- the free-tier "no-gender" grey chart
};

// Pure aggregator over an already-fetched match list -- lets a caller that also
// needs the raw MatchedSchool[] (e.g. the map component's marker positions) call
// findSurroundingSchools once and derive both from it, rather than hitting the RPC
// and DfE census lookup twice for the same page view.
export function aggregateSurroundingStat(matched: MatchedSchool[]): SurroundingSchoolsStat {
  if (matched.length === 0) {
    return {
      requested: TARGET_COUNT,
      found: 0,
      averageRoll: null,
      aggregateShape: null,
      aggregateMetrics: null,
      aggregateDominantTransition: null,
      aggregateAgeCounts: null,
    };
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
  const aggregateResult = classifyShape(shapeClassifierInput(aggregateAgeGenderCounts));

  return {
    requested: TARGET_COUNT,
    found: matched.length,
    averageRoll,
    aggregateShape: aggregateResult?.label ?? null,
    aggregateMetrics: aggregateResult?.metrics ?? null,
    aggregateDominantTransition: aggregateResult?.dominantTransition ?? null,
    aggregateAgeCounts,
  };
}

export async function computeSurroundingSchoolsStat(
  urn: string,
  targetPeriod: number,
): Promise<SurroundingSchoolsStat> {
  return aggregateSurroundingStat(await findSurroundingSchools(urn, targetPeriod));
}

// 2026-08-28, dashboard rebuild's Gender split card: the peer-average side of that
// card needs a girls/boys SPLIT across the matched pool, not just the combined
// headcount aggregateSurroundingStat already exposes (aggregateAgeCounts is
// deliberately both-sexes-combined, the free-tier "no-gender" chart). A separate
// small aggregator over the same already-fetched MatchedSchool[] rather than
// widening SurroundingSchoolsStat's own shape -- every other existing caller of that
// type doesn't need this, and this repeats the same real-pupils-only reasoning
// (summing genuine ageGenderCounts, not a guessed 50/50 split).
export function aggregatePeerGenderSplit(matched: MatchedSchool[]): { girls: number; boys: number } | null {
  let girls = 0;
  let boys = 0;
  for (const m of matched) {
    for (const c of m.ageGenderCounts.values()) {
      girls += c.female;
      boys += c.male;
    }
  }
  return girls + boys > 0 ? { girls, boys } : null;
}
