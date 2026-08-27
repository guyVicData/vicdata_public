// Typology tags (chart palette doc, "Public View rebuild"): four categories, two
// roles each. Sector, Phase and Gender are both display tags AND surrounding-schools
// matching filters (surrounding-schools.ts). Boarding is display-only this round --
// deliberately not a matching filter, deferred to subscription-tier percentage-based
// filtering (Guy's own call, logged in docs/OPEN_QUESTIONS.md) -- so it lives in this
// module for display consistency but callers must not treat it as filter input.

export type SectorTag = "Independent" | "State" | "FE";
export type BoardingTag = "Boarding" | "Day" | "Boarding & day";
export type PhaseTag = "Junior" | "Prep" | "Senior" | "Post 16";
export type GenderTag = "Boys" | "Girls" | "Co-ed";

// Same mainstream/independent split already established for the roll aggregates job
// (scripts/sync-roll-aggregates.ts's MAINSTREAM_GROUPS) -- "State" here means the
// same three GIAS establishment_type_group values, kept in sync deliberately, not
// coincidentally identical.
const STATE_GROUPS = new Set([
  "Academies",
  "Local authority maintained schools",
  "Free Schools",
]);

// 2026-08-28, per Guy's direct instruction (map investigation): the ~382 real
// institutions previously invisible on the map at all -- genuine FE corporations,
// standalone sixth-form/special-post-16 colleges, plus the small HE/Miscellaneous/
// Welsh tail. Checked against establishment_type_group first and rejected: "Colleges"/
// "Other types"/"Universities"/"Welsh schools" groups also contain hundreds of
// unrelated institutions (British/offshore schools, secure units, service children's
// education, and -- "Welsh schools" -- literally every ordinary school in Wales,
// 1,576 of them) that must NOT get swept in. This is establishment_type (the finer
// GIAS field), an exact 6-value list, not a group.
const FE_ESTABLISHMENT_TYPES = new Set([
  "Further education",
  "Sixth form centres",
  "Special post 16 institution",
  "Miscellaneous",
  "Higher education institutions",
  "Welsh establishment",
]);

export function sectorTag(
  establishmentTypeGroup: string | null,
  establishmentType: string | null,
): SectorTag | null {
  if (establishmentType && FE_ESTABLISHMENT_TYPES.has(establishmentType)) return "FE";
  if (establishmentTypeGroup === "Independent schools") return "Independent";
  if (establishmentTypeGroup && STATE_GROUPS.has(establishmentTypeGroup)) return "State";
  return null; // e.g. special schools -- expected fall-through
}

// Exported for the map's bounds-based schools query (schools-in-bounds route,
// 2026-08-24 map redesign round): restricting to these four groups is what makes
// sectorTag() resolve to Independent/State for every row rather than null, so a
// viewport of "state + independent schools" is the same restriction as this list,
// not a separate filtering decision. Same four groups nearest_schools' own
// mainstream filter uses (20260809103000_nearest_schools_mainstream_filter.sql).
// Deliberately NOT extended to include FE_ESTABLISHMENT_TYPES -- nearest_schools/
// surrounding-schools matching stays mainstream-only (Guy did not ask to extend that),
// only the map's own bounds query gained a separate, third FE query -- see
// schools-in-bounds/route.ts's own FE_ESTABLISHMENT_TYPES usage.
export const MAINSTREAM_ESTABLISHMENT_GROUPS = [...STATE_GROUPS, "Independent schools"];

// Exported for schools-in-bounds' own three-way query -- the array form of the Set
// above, for a Postgrest .in() filter.
export const FE_INSTITUTION_TYPES = [...FE_ESTABLISHMENT_TYPES];

// Of the six FE_ESTABLISHMENT_TYPES, only these three are ever in scope for
// vicdata's dfe_fe_participation/_adult ingest at all (its own UKPRN->URN crosswalk,
// ingest/sources/dfe_fe_participation.py's _TARGET_ESTABLISHMENT_TYPES, is built
// from exactly this list) -- Higher education institutions/Miscellaneous/Welsh
// establishment are never in that crosswalk, so an ILR lookup for them would always
// return nothing. Exported so schools-in-bounds can skip the round-trip for them
// entirely rather than querying and getting an empty result every time.
export const FE_PARTICIPATION_ESTABLISHMENT_TYPES = [
  "Further education",
  "Sixth form centres",
  "Special post 16 institution",
];

// Exported 2026-08-28 for schools-in-bounds' own per-sector split cap (150 state / 250
// independent instead of one shared 500 total, per Guy's direct instruction) -- state
// schools are dense enough that a shared cap was crowding independents out of mixed
// viewports entirely (confirmed against real data: independent schools are 2-5x
// sparser per km² even in populated areas, worse in rural ones), so the query needs
// these two groups split apart, not just the combined MAINSTREAM_ESTABLISHMENT_GROUPS
// list above.
export const STATE_ESTABLISHMENT_GROUPS = [...STATE_GROUPS];

// Boarding threshold: provisional, no empirical basis yet -- same discipline as the
// shape classifier's STATIONARY_THRESHOLD. GIAS's own boarders_name field is only a
// binary "has boarding provision or not," which can't distinguish a Boarding-only
// school from a genuinely mixed one (Leighton Park and Woldingham both show GIAS
// "Boarding school" despite very different day/boarder splits) -- so "mixed" status
// is read off the DfE census boarders/day ratio instead. >=80% boarders -> Boarding;
// <=5% -> Day (GIAS says boarding-capable but ~none actually boarding this year);
// else -> Boarding & day. Verified against Leighton Park (136/581=23%, the design
// doc's own "genuinely mixed" example -> Boarding & day) and Woldingham (243/528=46%
// -> Boarding & day). Logged as provisional in docs/OPEN_QUESTIONS.md.
const BOARDING_HIGH_THRESHOLD = 0.8;
const BOARDING_LOW_THRESHOLD = 0.05;

export function boardingTag(
  boardersName: string | null,
  boarding: { boarders: number; day: number; total: number } | null,
): BoardingTag | null {
  if (!boardersName) return null;
  if (boardersName === "No boarders") return "Day";
  if (!boarding || boarding.total === 0) return "Boarding"; // GIAS flag only, no ratio to refine
  const ratio = boarding.boarders / boarding.total;
  if (ratio >= BOARDING_HIGH_THRESHOLD) return "Boarding";
  if (ratio <= BOARDING_LOW_THRESHOLD) return "Day";
  return "Boarding & day";
}

// Stackable phase tags (chart palette doc's confirmed table) -- StatutoryLowAge/
// StatutoryHighAge, not a single mutually-exclusive band.
//
// 2026-08-28: high age 19 folded into the same bucket as 17/18, per Guy's direct
// decision after a real-data check -- 1,689 schools nationally have
// statutory_high_age exactly 19 (Woldingham among them: low 10/high 19), the large
// majority of everything above 18, and every one was falling through every branch
// here, showing no phase tag/colour on the map at all. Scoped deliberately to exactly
// 19, not "17 and up" -- the same check found real but much smaller and stranger
// populations at 20-35 (33/14/5/7/25/155/1/3/1 schools) plus 235 schools recorded as
// 99, almost certainly a data sentinel (unknown/not-applicable), not a genuine age --
// none of that was part of what Guy actually decided here, so none of it is folded in
// by extension; a real decision, not guessed at, same discipline this function
// already applies to its own boundaries.
//
// 2026-08-28 (same day, second change): renamed Sixth -> Post 16 AND narrowed its
// scope to standalone post-16 institutions only (lowAge >= 16) -- it was previously
// tacked onto any school reaching high age 17-19 regardless of whether Senior was
// also present, which is wrong: Leighton Park (11-18) read as Senior+Sixth and
// Woldingham (10-19) as Junior+Senior+Sixth when both are ordinary through-to-18/19
// schools, not standalone sixth-form/FE institutions. Confirmed against live data
// before narrowing (see docs/OPEN_QUESTIONS.md, 2026-08-28): 7,698 schools nationally
// lose the tag under this rule (2,648 Junior+Senior+Sixth -> Junior+Senior; 5,050
// Senior+Sixth -> Senior), while the 872 genuinely-standalone institutions (King
// Edward VI College, sixth-form/FE colleges -- lowAge >= 16, never combined with
// Senior/Junior) are unaffected beyond the label change. Senior and Post 16 can no
// longer both appear in the same tag set as a result -- callers that used to handle
// that combination (phaseTagAgeRange, surrounding-summary.ts's phaseWord) were
// checked and don't need special-casing for it, since Senior's own upper bound now
// always just extends to the school's real highAge.
export function phaseTags(lowAge: number | null, highAge: number | null): PhaseTag[] {
  if (lowAge === null || highAge === null) return [];

  if (lowAge <= 10) {
    if (highAge <= 11) return ["Junior"];
    if (highAge >= 12 && highAge <= 14) return ["Junior", "Prep"];
    if (highAge >= 15 && highAge <= 19) return ["Junior", "Senior"];
    return [];
  }
  if (lowAge >= 11 && lowAge <= 15) {
    if (highAge >= 16 && highAge <= 19) return ["Senior"];
    return [];
  }
  if (lowAge >= 16) return ["Post 16"];
  return [];
}

// Per-tag age sub-range within a through-school's own (lowAge, highAge) -- 2026-08-26,
// map phase-band roll sizing. Reuses the SAME 11/16 boundaries phaseTags() itself
// already encodes above (11 = Junior/next-phase split, 12-14 = Prep's own highAge
// band, 16 = next-phase/Sixth split) -- not new invented numbers, confirmed with Guy
// directly before building this (see the report that preceded this round).
//
// Only meaningful for a school carrying MORE than one phase tag at once (a genuine
// through-school) -- for a single-tag school the school's whole roll already IS that
// one phase, so callers should use totalRoll directly and never call this (see
// schools-in-bounds/route.ts's own comment for where this is actually used, gated on
// phase.length > 1).
//
// Used to take a 4th allTags parameter -- dropped 2026-08-28 once Senior and Post 16
// narrowed to never co-occur on the same school (phaseTags()'s own comment): Senior's
// upper bound no longer needs to check for Post 16's presence, it always extends to
// the school's real highAge.
export function phaseTagAgeRange(
  tag: PhaseTag,
  lowAge: number,
  highAge: number,
): [number, number] {
  if (tag === "Junior") return [lowAge, Math.min(10, highAge)];
  if (tag === "Prep") return [11, highAge];
  if (tag === "Senior") return [Math.max(lowAge, 11), highAge];
  return [16, highAge]; // Post 16
}

// Direct pass-through of GIAS's own policy-level Gender (name) field -- not derived
// from pupil-count ratios (confirmed against real schools: Camden School for Girls
// records "Girls" despite a genuinely mixed sixth form -- an authoritative
// classification, not a headcount artefact).
export function genderTag(giasGender: string | null): GenderTag | null {
  if (giasGender === "Girls") return "Girls";
  if (giasGender === "Boys") return "Boys";
  if (giasGender === "Mixed") return "Co-ed";
  return null; // "Not applicable", blank, or an unrecognised value
}

export type SchoolTypology = {
  sector: SectorTag | null;
  boarding: BoardingTag | null;
  phase: PhaseTag[];
  gender: GenderTag | null;
};

export function computeTypology(school: {
  establishment_type_group: string | null;
  establishment_type: string | null;
  boarders_name: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
  gender: string | null;
}, boarding: { boarders: number; day: number; total: number } | null): SchoolTypology {
  return {
    sector: sectorTag(school.establishment_type_group, school.establishment_type),
    boarding: boardingTag(school.boarders_name, boarding),
    phase: phaseTags(school.statutory_low_age, school.statutory_high_age),
    gender: genderTag(school.gender),
  };
}
