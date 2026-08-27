// Typology tags (chart palette doc, "Public View rebuild"): four categories, two
// roles each. Sector, Phase and Gender are both display tags AND surrounding-schools
// matching filters (surrounding-schools.ts). Boarding is display-only this round --
// deliberately not a matching filter, deferred to subscription-tier percentage-based
// filtering (Guy's own call, logged in docs/OPEN_QUESTIONS.md) -- so it lives in this
// module for display consistency but callers must not treat it as filter input.

export type SectorTag = "Independent" | "State";
export type BoardingTag = "Boarding" | "Day" | "Boarding & day";
export type PhaseTag = "Junior" | "Prep" | "Senior" | "Sixth";
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

export function sectorTag(establishmentTypeGroup: string | null): SectorTag | null {
  if (establishmentTypeGroup === "Independent schools") return "Independent";
  if (establishmentTypeGroup && STATE_GROUPS.has(establishmentTypeGroup)) return "State";
  return null; // e.g. special schools, colleges, universities -- expected fall-through
}

// Exported for the map's bounds-based schools query (schools-in-bounds route,
// 2026-08-24 map redesign round): restricting to these four groups is what makes
// sectorTag() resolve to Independent/State for every row rather than null, so a
// viewport of "state + independent schools" is the same restriction as this list,
// not a separate filtering decision. Same four groups nearest_schools' own
// mainstream filter uses (20260809103000_nearest_schools_mainstream_filter.sql).
export const MAINSTREAM_ESTABLISHMENT_GROUPS = [...STATE_GROUPS, "Independent schools"];

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
// StatutoryHighAge, not a single mutually-exclusive band. Some real schools fall
// through every branch (Woldingham: low 10/high 19, neither the "starts young" nor
// the "starts 11+" sub-ranges cover high age 19) -- confirmed expected by Guy
// directly ("that is good," not something to over-fit the boundaries to avoid).
export function phaseTags(lowAge: number | null, highAge: number | null): PhaseTag[] {
  if (lowAge === null || highAge === null) return [];

  if (lowAge <= 10) {
    if (highAge <= 11) return ["Junior"];
    if (highAge >= 12 && highAge <= 14) return ["Junior", "Prep"];
    if (highAge >= 15 && highAge <= 16) return ["Junior", "Senior"];
    if (highAge >= 17 && highAge <= 18) return ["Junior", "Senior", "Sixth"];
    return [];
  }
  if (lowAge >= 11 && lowAge <= 15) {
    if (highAge === 16) return ["Senior"];
    if (highAge >= 17 && highAge <= 18) return ["Senior", "Sixth"];
    return [];
  }
  if (lowAge >= 16) return ["Sixth"];
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
// allTags matters for Senior specifically: Senior's own upper bound is 15 when Sixth
// is ALSO present (the 16-cutoff goes to Sixth instead), but extends to the school's
// real highAge when Sixth is absent (Junior+Senior with no Sixth, highAge 15-16).
export function phaseTagAgeRange(
  tag: PhaseTag,
  lowAge: number,
  highAge: number,
  allTags: PhaseTag[],
): [number, number] {
  if (tag === "Junior") return [lowAge, Math.min(10, highAge)];
  if (tag === "Prep") return [11, highAge];
  if (tag === "Senior") {
    const lo = Math.max(lowAge, 11);
    const hi = allTags.includes("Sixth") ? 15 : highAge;
    return [lo, hi];
  }
  return [16, highAge]; // Sixth
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
  boarders_name: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
  gender: string | null;
}, boarding: { boarders: number; day: number; total: number } | null): SchoolTypology {
  return {
    sector: sectorTag(school.establishment_type_group),
    boarding: boardingTag(school.boarders_name, boarding),
    phase: phaseTags(school.statutory_low_age, school.statutory_high_age),
    gender: genderTag(school.gender),
  };
}
