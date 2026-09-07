// Member Data View build (2026-10-03), brief §6: default comparator-list generation.
// Every school gets List 1 (nearest 10, crosses LA) via findSurroundingSchools()
// (post-§2 fixes) with the relaxed gender rule; most get List 2 (in-LA, all sectors,
// same phase) via a fresh LA-scoped query (nearest_schools' own RPC is a national
// distance search with an exact-sector gate, the wrong tool for an LA-bounded,
// sector-OPEN search); boarding schools additionally get List 3, the real §6.1
// boarding-population-quintile recipe.
//
// Deliberately distinct from Comparator Set (rolls spec §6) and Feeder Set (§5) --
// this module never writes to saved_sets/saved_set_members, it only computes a
// candidate list to present as a selectable "VicData recipe" set in the Data View's
// sidebar (see docs/vicdata_data_view_open_questions.md's §6.2 decision for why that
// doesn't need a schema change).

import { createServerAnonSupabaseClient } from "./supabase";
import { findSurroundingSchools, genderMatches, type MatchedSchool } from "./surrounding-schools";
import { findNearestFeColleges, findLocal16PlusProvision, type NamedFeCollege, type Local16PlusProvision } from "./surrounding-fe-colleges";
import { fetchCensusFactsBatched } from "./data-view-profiles";
import { singleAgeGenderCountsForPeriod, CURRENT_CENSUS_PERIOD } from "./roll-data";
import { effectivePhaseTags, phaseTags, genderTag, boardingRatio, FE_PARTICIPATION_ESTABLISHMENT_TYPES, type GenderTag, type PhaseTag } from "./typology";

export type SchoolTypeCategory =
  | "state"
  | "independent_day"
  | "independent_boarding_senior"
  | "independent_boarding_prep"
  | "state_boarding"
  | "fe_college"
  | "special"; // brief §6's table has no row for Special Schools -- see this module's own classify function comment

export type DefaultListEntry = { urn: string; name: string; distanceKm: number | null };
export type DefaultList = { key: string; label: string; schools: DefaultListEntry[]; note?: string };

export type DefaultComparatorLists = {
  schoolTypeCategory: SchoolTypeCategory | null;
  list1: DefaultList | null;
  list2: DefaultList | null;
  list3: DefaultList | null;
  // 2026-09-08, bug fix: "FE colleges aren't appearing anywhere when starting
  // from a mainstream school and looking at Post-16." Root cause, confirmed by
  // reading this module directly rather than guessing: findLocal16PlusProvision
  // (surrounding-fe-colleges.ts) already does exactly the right real-data query
  // (FE colleges + genuine sixth-form schools in the target's own LA) and was
  // already wired up -- but only ever CALLED for an `fe_college` target (as that
  // branch's own list2, "16+ provision in {LA}"). A mainstream target with a real
  // sixth form (Acland Burghley, 11-18) had no candidate list offering FE
  // colleges AT ALL -- the Post-16 summary sentence's own "compared with schools
  // and FE colleges in..." could only ever become true if a member manually
  // searched for and added an FE college themselves, never from a real recipe.
  // Added here as its own field (not folded into list1/list2, which mainstream
  // targets already use for their existing Nearest-10/In-LA recipes) so it's
  // purely additive -- null for an fe_college target (that branch's own list2
  // already covers this) and for any target with no real Post-16 provision.
  local16Plus: DefaultList | null;
};

type TargetRow = {
  urn: string;
  current_name: string;
  la_name: string | null;
  easting: number | null;
  northing: number | null;
  establishment_type_group: string | null;
  establishment_type: string | null;
  boarders_name: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
  gender: string | null;
};

function distanceKm(a: { easting: number; northing: number }, b: { easting: number; northing: number }): number {
  return Math.sqrt((a.easting - b.easting) ** 2 + (a.northing - b.northing) ** 2) / 1000;
}

function toEntry(m: MatchedSchool, target: { easting: number; northing: number }): DefaultListEntry {
  return {
    urn: m.urn,
    name: m.currentName,
    distanceKm: m.easting !== null && m.northing !== null ? distanceKm(target, { easting: m.easting, northing: m.northing }) : null,
  };
}

// Classification into brief §6's table rows. Sector/boarding/phase all read from the
// target's own real, already-fixed typology (post-§2) -- "boarding" means a real,
// non-zero current boarders figure, not just GIAS's binary flag (the same ratio-based
// discipline typology.ts's boardingTag() already applies, reused via boardingRatio()
// rather than re-deriving a second boarding-detection rule).
//
// Special Schools has no row in the brief's own §6 table at all -- closed out
// properly (UX refinements round 1, B2) rather than left as an implicit fallback: a
// Special School target gets List 1 (nearest_schools' own RPC already has real
// special-school-aware matching, target.is_special, 2026-09-30, that
// findSurroundingSchools benefits from unmodified) + List 2 (in-LA all sectors,
// which now genuinely includes special schools as real candidates -- see
// buildLaComparatorSet's own comment), no List 3 offer (no boarding-quintile recipe
// exists for this sector, same as independent_day/state). Matches the public map's
// own treatment of Special Schools as a real fourth sector, not a State clone.
export function classifySchoolTypeCategory(
  sector: "Independent" | "State" | "FE" | "Special Schools" | null,
  phase: PhaseTag[],
  boarding: { boarders: number; total: number } | null,
): SchoolTypeCategory | null {
  if (sector === "FE") return "fe_college";
  if (sector === "Special Schools") return "special";
  const boards = boarding !== null && boarding.total > 0 && boardingRatio(boarding) > 0;
  if (sector === "State") return boards ? "state_boarding" : "state";
  if (sector === "Independent") {
    if (!boards) return "independent_day";
    // Senior takes priority when a through-school carries both real tags (Senior is
    // the dominant, defining phase for a boarding through-school in practice --
    // Charterhouse/Wellington-shaped institutions, not Prep-shaped ones); Prep/Junior
    // alone (no Senior) is the genuine Prep-boarding case the brief's own row targets.
    if (phase.includes("Senior")) return "independent_boarding_senior";
    if (phase.includes("Prep") || phase.includes("Junior")) return "independent_boarding_prep";
    return "independent_boarding_senior"; // e.g. a standalone boarding Post-16 college -- no real case found, defensive fallback
  }
  return null;
}

async function fetchTarget(urn: string): Promise<TargetRow | null> {
  const supabase = createServerAnonSupabaseClient();
  const { data } = await supabase
    .from("schools")
    .select(
      "urn, current_name, la_name, easting, northing, establishment_type_group, establishment_type, boarders_name, statutory_low_age, statutory_high_age, gender",
    )
    .eq("urn", urn)
    .maybeSingle();
  return data as TargetRow | null;
}

function genderMatchesRelaxed(target: GenderTag | null, candidate: GenderTag | null): boolean {
  if (!target) return true;
  if (target === "Co-ed") return true;
  return candidate === target || candidate === "Co-ed";
}

// List 2 for a mainstream target: in-LA, ALL SECTORS (state+independent+special, not
// FE -- FE has its own genuinely different List 1/List 2 shape below), same
// effective phase, relaxed gender. nearest_schools' own RPC can't do this -- it's a
// national distance search with an exact-sector equality gate, the opposite of what
// "all sectors, LA-bounded" needs -- so this queries `schools` directly instead. No
// explicit count given in the brief for this list (only List 1 says "nearest 10") --
// capped at 30 as a reasonable tick-list size, logged as a decision rather than left
// as an unstated assumption.
//
// 2026-09-06, UX refinements round 1, B2: "Special schools" added to the allow-list
// -- previously excluded here even though the public map (schools-in-bounds/
// route.ts) already treats Special Schools as a genuine fourth sector, fetched and
// shown alongside State/Independent/FE by default, not hidden. This module's own
// classifySchoolTypeCategory has recognised "special" as its own SchoolTypeCategory
// since it was written, but nothing downstream ever actually included special
// schools as real candidates -- the "falls back to the same shape as State" comment
// that used to sit on classifySchoolTypeCategory was true only in the sense that
// NEITHER got a special-cased list-building branch, not because special schools were
// genuinely being treated the same as state ones; they were being silently dropped
// from this specific list's candidate pool entirely. Closed out properly now: a
// Special School target's own List 2 can include other special schools (and vice
// versa -- a mainstream target's List 2 can now include a nearby special school),
// matching the public map's own non-discriminating behaviour instead of leaving this
// as an implicit, undocumented gap.
const LIST2_CAP = 30;

// 2026-09-06, UX refinements round 1, B3: generalised from a single `target.la_name`
// to an array so the same real filtering logic (phase/gender/roll-data-exists) backs
// both the original single-LA default List 2 AND the new "Compared with" multi-LA
// picker ("allow adding additional/adjacent Local Authorities as choices") -- one
// real implementation, not two. Exported for the new /api/data-view/la-set route.
export async function buildLaComparatorSet(
  target: { urn: string; easting: number | null; northing: number | null },
  laNames: string[],
  targetPhase: PhaseTag[],
  targetGender: GenderTag | null,
): Promise<DefaultList | null> {
  if (laNames.length === 0 || target.easting === null || target.northing === null) return null;
  const label = laNames.length === 1 ? `In ${laNames[0]} (all sectors)` : `In ${laNames.join(", ")} (all sectors)`;
  const supabase = createServerAnonSupabaseClient();
  const { data } = await supabase
    .from("schools")
    .select("urn, current_name, easting, northing, establishment_type_group, establishment_type, statutory_low_age, statutory_high_age, gender")
    .in("la_name", laNames)
    .in("establishment_type_group", ["Academies", "Local authority maintained schools", "Independent schools", "Free Schools", "Special schools"])
    .neq("status", "closed")
    .neq("urn", target.urn);
  type Row = {
    urn: string;
    current_name: string;
    easting: number | null;
    northing: number | null;
    establishment_type_group: string | null;
    establishment_type: string | null;
    statutory_low_age: number | null;
    statutory_high_age: number | null;
    gender: string | null;
  };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { key: "in_la", label, schools: [] };

  const phaseFiltered = rows.filter((r) => {
    if (targetPhase.length === 0) return true;
    const candidatePhase = phaseTags(r.statutory_low_age, r.statutory_high_age, r.establishment_type);
    const sharesTag = candidatePhase.some((p) => targetPhase.includes(p));
    if (!sharesTag) return false;
    if (targetPhase.length > 1) return candidatePhase.length > 1;
    return true;
  });
  const genderFiltered = phaseFiltered.filter((r) => genderMatchesRelaxed(targetGender, genderTag(r.gender)));
  if (genderFiltered.length === 0) return { key: "in_la", label, schools: [] };

  const byDistance = genderFiltered
    .filter((r) => r.easting !== null && r.northing !== null)
    .map((r) => ({ ...r, distanceKm: distanceKm({ easting: target.easting!, northing: target.northing! }, { easting: r.easting!, northing: r.northing! }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Skip-and-backfill past real roll-data gaps, same discipline as List 1 -- batched
  // (chunks of 40) even though an LA-bounded pool is rarely anywhere near that size,
  // for the same defensive reason data-view-profiles.ts's fetch is always batched.
  const facts = await fetchCensusFactsBatched(byDistance.map((r) => r.urn));
  const schools: DefaultListEntry[] = [];
  for (const r of byDistance) {
    if (schools.length >= LIST2_CAP) break;
    const counts = singleAgeGenderCountsForPeriod(facts.filter((f) => f.entity_id === r.urn), CURRENT_CENSUS_PERIOD);
    let total = 0;
    for (const c of counts.values()) total += c.male + c.female;
    if (total === 0) continue;
    schools.push({ urn: r.urn, name: r.current_name, distanceKm: r.distanceKm });
  }
  return { key: "in_la", label, schools };
}

// §6.1 -- the Charterhouse-tested boarding-population-quintile recipe, reused exactly
// as specified rather than re-derived. Parameterised over sector (Independent vs
// State -- brief's own confirmed real state-boarding population, ≈60 schools, see
// docs/vicdata_data_view_open_questions.md) and quintile basis (real boarding
// headcount for Senior, real % boarders ratio for Prep -- "prep-scale boarding
// numbers are too small for absolute quintiling to differentiate").
// 2026-09-08, Compared-with panel round 4 (real behaviour change): bottom-3-quintile
// schools no longer match by quintile membership at all. Confirmed against the code
// (not assumed) which end is "bottom": quintileOf() indexes 0-4 ascending by the sort
// key (sortKey(a) - sortKey(b), smallest first), so index 0 is the SMALLEST real
// boarding population/ratio and index 4 the LARGEST -- "top 2" (already this
// function's own pre-existing label) is index 3-4, "bottom 3" is index 0-2. That
// bottom-3 pool was already flagged thin in the original brief (§6.1: "a genuinely
// thinner population at this scale"), and combining it into one national pool +
// 30km cap didn't fix that -- it just moved the sparseness into a different shape.
// Per direct instruction, bottom-3 schools now get the 10 NEAREST real boarding
// schools nationally (gender-matched via the same relaxed rule
// findSurroundingSchools/default-comparator-lists' own "Nearest 10" already uses),
// dropping the quintile-membership restriction and the 30km cap entirely -- a
// nearby top-quintile school legitimately shows up here now, which is expected, not
// a bug. Top 2 quintiles are genuinely unaffected: same-quintile, unbounded
// catchment, unchanged.
async function boardingQuintileList(
  target: TargetRow,
  sectorGroups: string[],
  requirePhase: "Senior" | "Prep",
  quintileBasis: "headcount" | "ratio",
  targetCount = 10,
): Promise<DefaultList | null> {
  if (target.easting === null || target.northing === null) return null;
  const supabase = createServerAnonSupabaseClient();

  // Step 1: candidate pool -- real boarding establishments in the target sector(s).
  // gender added (2026-09-08) so the new bottom-3 nearest-based match can apply the
  // same relaxed gender rule every other default list uses.
  const { data } = await supabase
    .from("schools")
    .select("urn, current_name, easting, northing, establishment_type, statutory_low_age, statutory_high_age, boarders_name, gender")
    .in("establishment_type_group", sectorGroups)
    .neq("status", "closed")
    .not("boarders_name", "is", null)
    .neq("boarders_name", "No boarders")
    .neq("urn", target.urn);
  type Row = {
    urn: string;
    current_name: string;
    easting: number | null;
    northing: number | null;
    establishment_type: string | null;
    statutory_low_age: number | null;
    statutory_high_age: number | null;
    boarders_name: string | null;
    gender: string | null;
  };
  const candidatePool = (data ?? []) as Row[];
  if (candidatePool.length === 0) return null;

  // Step 2: nominal same-phase pre-filter before the expensive census fetch (brief
  // §6.1 step 2 -- cuts ≈403 to ≈264 for the real Independent-Senior case).
  const nominalFiltered = candidatePool.filter((c) => {
    const tags = phaseTags(c.statutory_low_age, c.statutory_high_age, c.establishment_type);
    return tags.includes(requirePhase);
  });
  if (nominalFiltered.length === 0) return null;

  // Step 3: batched census fetch (chunks of 40, brief §6.1 step 3 -- the
  // already-diagnosed statement-timeout limit).
  const facts = await fetchCensusFactsBatched(nominalFiltered.map((c) => c.urn));

  // Step 4: genuinely phase-specific (effective tags) with a real non-zero boarding
  // population.
  type QuintileCandidate = { urn: string; name: string; easting: number; northing: number; boardersTotal: number; ratio: number; gender: GenderTag | null };
  const withBoarding: QuintileCandidate[] = [];
  for (const c of nominalFiltered) {
    if (c.easting === null || c.northing === null) continue;
    const schoolFacts = facts.filter((f) => f.entity_id === c.urn);
    const counts = singleAgeGenderCountsForPeriod(schoolFacts, CURRENT_CENSUS_PERIOD);
    if (counts.size === 0) continue;
    const effectiveTags = effectivePhaseTags(c.statutory_low_age, c.statutory_high_age, c.establishment_type, counts);
    if (!effectiveTags.includes(requirePhase)) continue;
    const boardersTotal = schoolFacts.find((f) => f.period === CURRENT_CENSUS_PERIOD && f.breakdown === "boarders_total")?.value_numeric ?? null;
    if (boardersTotal === null || boardersTotal <= 0) continue;
    let total = 0;
    for (const v of counts.values()) total += v.male + v.female;
    if (total === 0) continue;
    withBoarding.push({
      urn: c.urn,
      name: c.current_name,
      easting: c.easting,
      northing: c.northing,
      boardersTotal,
      ratio: boardingRatio({ boarders: boardersTotal, total }),
      gender: genderTag(c.gender),
    });
  }
  if (withBoarding.length === 0) return null;

  // Step 5: quintile by the chosen basis (real boarding headcount for Senior, real
  // ratio for Prep).
  const sortKey = quintileBasis === "headcount" ? (c: QuintileCandidate) => c.boardersTotal : (c: QuintileCandidate) => c.ratio;
  const sorted = [...withBoarding].sort((a, b) => sortKey(a) - sortKey(b));
  const quintileSize = Math.ceil(sorted.length / 5);
  const quintileOf = (c: QuintileCandidate) => Math.min(4, Math.floor(sorted.indexOf(c) / quintileSize));

  // Target's own value needs to be measured on the SAME basis to find its quintile --
  // fetch its own current census facts if not already in scope (it's excluded from
  // candidatePool by `.neq("urn", target.urn)` above).
  const targetFacts = await fetchCensusFactsBatched([target.urn]);
  const targetCounts = singleAgeGenderCountsForPeriod(targetFacts, CURRENT_CENSUS_PERIOD);
  const targetBoardersTotal = targetFacts.find((f) => f.period === CURRENT_CENSUS_PERIOD && f.breakdown === "boarders_total")?.value_numeric ?? null;
  let targetRoll = 0;
  for (const v of targetCounts.values()) targetRoll += v.male + v.female;
  if (targetBoardersTotal === null || targetRoll === 0) return null;
  const targetValue =
    quintileBasis === "headcount" ? targetBoardersTotal : boardingRatio({ boarders: targetBoardersTotal, total: targetRoll });

  // Insert target into the sorted array to find where it WOULD land, without
  // mutating the real candidate list used for quintileOf's own indexOf lookups above.
  let targetQuintile = 4;
  for (let i = 0; i < sorted.length; i++) {
    if (targetValue <= sortKey(sorted[i])) {
      targetQuintile = Math.min(4, Math.floor(i / quintileSize));
      break;
    }
  }

  const isTopTwo = targetQuintile >= 3;
  const targetGenderTag = genderTag(target.gender);

  // Step 6: top 2 quintiles (index 3-4, biggest boarding populations) -- unaffected,
  // same-quintile matching, unbounded catchment. Bottom 3 (index 0-2) -- nearest
  // targetCount real boarding schools NATIONALLY (no quintile restriction, no
  // distance cap), gender-matched via the same relaxed rule as Nearest 10.
  const pool = isTopTwo ? sorted.filter((c) => quintileOf(c) === targetQuintile) : sorted;
  const genderFiltered = isTopTwo || !targetGenderTag ? pool : pool.filter((c) => genderMatches(targetGenderTag, c.gender, "relaxed"));
  const withDistance = genderFiltered
    .map((c) => ({ ...c, distanceKm: distanceKm({ easting: target.easting!, northing: target.northing! }, { easting: c.easting, northing: c.northing }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, targetCount);

  const basisLabel = quintileBasis === "headcount" ? "boarding population" : "% boarders";
  return {
    key: "boarding_quintile",
    label: isTopTwo ? `National boarding quintile (by ${basisLabel})` : "Nearest boarding schools (by age/gender)",
    schools: withDistance.map((c) => ({ urn: c.urn, name: c.name, distanceKm: c.distanceKm })),
    note: isTopTwo
      ? "Top 2 quintiles by real boarding population -- unbounded catchment."
      : "Bottom 3 quintiles are too thin to match by quintile alone -- matched by nearest real boarding schools (age/gender) instead, nationally. A nearby top-quintile school can legitimately appear here.",
  };
}

// Real, measured performance finding (docs/vicdata_data_view_open_questions.md):
// List 3's boarding-quintile recipe takes ~41s even after parallelising the batched
// census fetch (71.6s sequential) -- the ≈264-403-candidate national scan is
// genuinely heavy, not a bug to fix further this round (see that recipe's own
// comment; a precomputed table is real, separate engineering, brief §10). Split out
// of the main list-building call so a Woldingham-shaped school's INITIAL sidebar load
// (List 1 + List 2, both sub-3s) never blocks on it -- List 3 is fetched lazily, only
// once a member actually selects/expands that option in the UI (see the Data View
// shell's own set-picker), via its own separate API route
// (/api/data-view/boarding-quintile-list).
export type SchoolTypeResolution = {
  schoolTypeCategory: SchoolTypeCategory | null;
  target: TargetRow;
  targetPhase: PhaseTag[];
};

// Exported (2026-09-06, UX refinements round 1, B3) so the new multi-LA/nearest-N-
// expansion API routes can reuse the exact same target+phase resolution this
// module's own default-list building already does, rather than a second, possibly-
// diverging copy of "what phase/gender does this target school match on."
export async function resolveSchoolTypeCategory(urn: string): Promise<SchoolTypeResolution | null> {
  const target = await fetchTarget(urn);
  if (!target) return null;
  // 2026-09-06, UX refinements round 1, B1's flagged-but-unclear exclusion note: this
  // used to be a wider, ad-hoc inline list that also caught "Miscellaneous",
  // "Higher education institutions" and "Welsh establishment" -- a real inconsistency
  // with typology.ts's own canonical FE_PARTICIPATION_ESTABLISHMENT_TYPES (which
  // deliberately EXCLUDES exactly those three, "never in that crosswalk... an ILR
  // lookup for them would always return nothing"). Classifying one of them as
  // "fe_college" promised a real FE-participation-backed default list that could
  // never actually materialise -- every list-building call for such a target would
  // silently come back empty, a plausible match for the "HE etc." fragment of Guy's
  // own note. Aligned to the one real, already-verified establishment-type list
  // rather than guessing further at what else the note meant -- logged here rather
  // than silently narrowed.
  if (target.establishment_type && FE_PARTICIPATION_ESTABLISHMENT_TYPES.includes(target.establishment_type)) {
    return { schoolTypeCategory: "fe_college", target, targetPhase: [] };
  }
  const targetFacts = await fetchCensusFactsBatched([urn]);
  const targetCounts = singleAgeGenderCountsForPeriod(targetFacts, CURRENT_CENSUS_PERIOD);
  const targetPhase = effectivePhaseTags(target.statutory_low_age, target.statutory_high_age, target.establishment_type, targetCounts);
  const targetBoardersTotal = targetFacts.find((f) => f.period === CURRENT_CENSUS_PERIOD && f.breakdown === "boarders_total")?.value_numeric ?? null;
  let targetRoll = 0;
  for (const v of targetCounts.values()) targetRoll += v.male + v.female;
  const sector =
    target.establishment_type_group === "Independent schools"
      ? ("Independent" as const)
      : target.establishment_type_group === "Special schools"
        ? ("Special Schools" as const)
        : ("State" as const);
  const schoolTypeCategory = classifySchoolTypeCategory(
    sector,
    targetPhase,
    targetBoardersTotal !== null ? { boarders: targetBoardersTotal, total: targetRoll } : null,
  );
  return { schoolTypeCategory, target, targetPhase };
}

// The slow List 3 recipe, callable independently and lazily (see comment above).
// targetCount (2026-09-08, Compared-with panel round 4): the Boarding schools
// button's own "+5 more" control re-runs this with a larger count -- genuinely a
// real, ~41s-ish re-fetch each time (this recipe's own known cost, per the comment
// above), not a cheap client-side slice, since the expensive census fetch depends on
// nothing this function caches between calls. Deliberately accepted rather than
// building a separate caching layer for this one control -- the shared map loading
// indicator (Compared-with panel round 3) is what makes that wait legible now,
// rather than a silent, confusing pause.
export async function buildBoardingQuintileList(urn: string, targetCount = 10): Promise<DefaultList | null> {
  const resolved = await resolveSchoolTypeCategory(urn);
  if (!resolved) return null;
  const { schoolTypeCategory, target } = resolved;
  if (schoolTypeCategory === "independent_boarding_senior") {
    return boardingQuintileList(target, ["Independent schools"], "Senior", "headcount", targetCount);
  }
  if (schoolTypeCategory === "independent_boarding_prep") {
    return boardingQuintileList(target, ["Independent schools"], "Prep", "ratio", targetCount);
  }
  if (schoolTypeCategory === "state_boarding") {
    return boardingQuintileList(target, ["Academies", "Local authority maintained schools", "Free Schools"], "Senior", "headcount", targetCount);
  }
  return null;
}

export async function buildDefaultComparatorLists(urn: string): Promise<DefaultComparatorLists> {
  const resolved = await resolveSchoolTypeCategory(urn);
  if (!resolved) return { schoolTypeCategory: null, list1: null, list2: null, list3: null, local16Plus: null };
  const { schoolTypeCategory, target, targetPhase } = resolved;

  if (schoolTypeCategory === "fe_college") {
    const [nearestFe, local16Plus] = await Promise.all([
      findNearestFeColleges(urn),
      target.la_name ? findLocal16PlusProvision(urn, target.la_name) : Promise.resolve<Local16PlusProvision[]>([]),
    ]);
    const list1: DefaultList = {
      key: "fe_nearest_10",
      label: "Nearest 10 FE colleges",
      schools: (nearestFe as NamedFeCollege[]).map((c) => ({ urn: c.urn, name: c.name, distanceKm: c.distanceKm })),
    };
    const list2: DefaultList | null = target.la_name
      ? {
          key: "fe_local_16plus",
          label: `16+ provision in ${target.la_name}`,
          schools: local16Plus.map((c) => ({ urn: c.urn, name: c.name, distanceKm: c.distanceKm })),
        }
      : null;
    return { schoolTypeCategory: "fe_college", list1, list2, list3: null, local16Plus: null };
  }

  const targetGender = genderTag(target.gender);
  // Bug fix (2026-09-08): same real Post-16 relevance test relevantAgeBandsFor()
  // (data-view-filters.ts) already uses for the filter pill itself -- a mainstream
  // school's own real statutoryHighAge reaching 16, not the categorical phase tag
  // (which, per typology.ts's own phaseTags() history, never separately says
  // "Post 16" for an ordinary through-school).
  const hasPost16Provision = target.statutory_high_age !== null && target.statutory_high_age >= 16;

  const [matched, list2, local16PlusCandidates] = await Promise.all([
    findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { genderMode: "relaxed" }),
    target.la_name ? buildLaComparatorSet(target, [target.la_name], targetPhase, targetGender) : Promise.resolve(null),
    target.la_name && hasPost16Provision ? findLocal16PlusProvision(urn, target.la_name) : Promise.resolve<Local16PlusProvision[]>([]),
  ]);
  const list1: DefaultList = {
    key: "nearest_10",
    label: "Nearest 10 (any LA)",
    schools:
      target.easting !== null && target.northing !== null
        ? matched.map((m) => toEntry(m, { easting: target.easting!, northing: target.northing! }))
        : matched.map((m) => ({ urn: m.urn, name: m.currentName, distanceKm: null })),
  };
  const local16Plus: DefaultList | null =
    target.la_name && hasPost16Provision
      ? {
          key: "local_16plus",
          label: `Schools and FE colleges, 16+, in ${target.la_name}`,
          schools: local16PlusCandidates.map((c) => ({ urn: c.urn, name: c.name, distanceKm: c.distanceKm })),
        }
      : null;

  // List 3 (boarding quintile) is deliberately NOT computed here -- see
  // buildBoardingQuintileList's own comment above (~41s even after parallelising the
  // batched fetch, real and measured, not something this initial load should block
  // on). `schoolTypeCategory` alone tells the UI whether to OFFER that option at all
  // (independent_boarding_senior/independent_boarding_prep/state_boarding); the
  // sidebar calls buildBoardingQuintileList itself, lazily, only once a member
  // actually selects it.
  return { schoolTypeCategory, list1, list2, list3: null, local16Plus };
}
