// Teacher view, Phase 2: which dataset phases a school genuinely has, and therefore
// which tiles its home screen shows (design brief v2 §5).
//
// §5: "A school's home screen shows a real, clickable tile for every phase it has genuine
// current data for -- not just historically, but in the most recent available year (this
// reuses the zero-candidate/real-data-quality logic already shipped)."
//
// Two rules, and they are different:
//   1. USABLE -- the shipped zero-candidate rule (stageHasUsableData): having a row is not
//      enough, since newly-opened schools carry a key-stage row with a zero candidate
//      count and no results. Reused here rather than reimplemented.
//   2. CURRENT -- the data must exist in the phase's most recent available year. This is
//      the stricter part §5 adds, and it is load-bearing: checked against production,
//      385 KS4 schools and 187 KS5 schools have data but nothing current, so without this
//      they would each get a tile with nothing behind it.
//
// Deliberately generic across three phases, per §5's "nothing here should hardcode two
// phases" -- Destinations, or any fourth phase, drops in by extending TEACHER_PHASES and
// the measure map, with no change to the tile logic or the dashboard that hangs off it.
import { stageHasUsableData, type AcademicSchoolProfile, type KsStage } from "./academic-data-view";

export const TEACHER_PHASES = ["ks2", "ks4", "ks5"] as const;
export type TeacherPhase = (typeof TEACHER_PHASES)[number];

// §5's table: every phase asks the same four questions, pointed at a different real axis.
// The headings are the questions themselves, per §14's "natural-language questions as
// headings ... a fundamental, load-bearing principle, not one bullet among several".
export const PHASE_LABELS: Record<TeacherPhase, string> = {
  ks2: "Key Stage 2",
  ks4: "GCSE",
  ks5: "Post-16",
};

// The Teacher view home's card descriptions (Home.dc.html), addressed to the teacher --
// "your subjects", and pupils at GCSE but students at Post-16. Deliberately separate from
// PHASE_QUESTIONS, whose first-person wording ("my subjects") heads the dashboard itself:
// the two say different things to different moments and are expected to diverge further.
// KS2 is not in the mockups; its line is the existing KS2 question, addressed the same way.
export const PHASE_HOME_CARD_DESCRIPTION: Record<TeacherPhase, string> = {
  ks2: "How well do your pupils do in each area?",
  ks4: "How well do pupils do in each of your subjects?",
  ks5: "How well do students do in each of your subjects?",
};

export const PHASE_QUESTIONS: Record<TeacherPhase, { howMany: string; howWell: string; nearMe: string; wider: string }> = {
  ks4: {
    howMany: "How many pupils take each of my subjects?",
    howWell: "How well do they do in each of my subjects?",
    nearMe: "How do my subjects sit alongside the rest of the school?",
    wider: "How does my school compare with other schools?",
  },
  ks5: {
    howMany: "How many students take each of my subjects?",
    howWell: "How well do they do in each of my subjects?",
    nearMe: "How do my subjects sit alongside the rest of the school?",
    wider: "How does my school compare with other schools?",
  },
  // §5: KS2 has no entries concept and no within-school subject-share concept, so Roll and
  // nearest-10-primaries stand in rather than KS2 simply lacking two of the four cards.
  ks2: {
    howMany: "How big is my Year 6 cohort?",
    howWell: "How well do our pupils do in each area?",
    nearMe: "How do we compare with the primaries nearest us?",
    wider: "How do we compare across the local authority, region and nationally?",
  },
};

// The period each phase's data is currently published up to. Passed in rather than
// derived per school: a school with only historical data would otherwise look "current"
// against its own latest year, which is exactly the case §5 excludes.
export type CurrentPhasePeriods = Partial<Record<TeacherPhase, number | null>>;

function phaseYears(profile: AcademicSchoolProfile, phase: TeacherPhase) {
  return phase === "ks2" ? profile.ks2 : phase === "ks4" ? profile.ks4 : profile.ks5;
}

// Is this phase genuinely available to this school right now?
export function hasCurrentPhaseData(
  profile: AcademicSchoolProfile,
  phase: TeacherPhase,
  currentPeriods: CurrentPhasePeriods,
): boolean {
  const current = currentPeriods[phase];
  if (current === null || current === undefined) return false;
  const years = phaseYears(profile, phase);
  if (!years.some((y) => y.period === current)) return false;
  // Reuses the shipped zero-candidate exclusion rather than a second, drifting copy.
  return stageHasUsableData(profile, phase as KsStage);
}

export function availableTeacherPhases(
  profile: AcademicSchoolProfile,
  currentPeriods: CurrentPhasePeriods,
): TeacherPhase[] {
  return TEACHER_PHASES.filter((p) => hasCurrentPhaseData(profile, p, currentPeriods));
}

// §5: onboarding is per dataset, and completing a phase's walkthrough is literally what
// unlocks that phase's dashboard -- permanently, per person, per phase. There is no third
// "locked/teaser" state: a phase the school has data for but this person has not onboarded
// into is still a visible, clickable tile that starts the walkthrough.
export type PhaseTileState = "start-walkthrough" | "open-dashboard";

export function phaseTileState(phase: TeacherPhase, onboardedPhases: readonly string[]): PhaseTileState {
  return onboardedPhases.includes(phase) ? "open-dashboard" : "start-walkthrough";
}

export type PhaseTile = { phase: TeacherPhase; label: string; state: PhaseTileState };

export function phaseTilesFor(
  profile: AcademicSchoolProfile,
  currentPeriods: CurrentPhasePeriods,
  onboardedPhases: readonly string[],
): PhaseTile[] {
  return availableTeacherPhases(profile, currentPeriods).map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    state: phaseTileState(phase, onboardedPhases),
  }));
}
