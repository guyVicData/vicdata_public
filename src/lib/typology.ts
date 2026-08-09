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
