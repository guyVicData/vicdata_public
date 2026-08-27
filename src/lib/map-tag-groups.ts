import type { SectorTag, PhaseTag, GenderTag } from "@/lib/typology";

// The map's tag-group taxonomy (2026-08-25 design/polish round) -- both what can be
// FILTERED (MapFilterPanel.tsx) and what can drive dot COLOUR (MapColourKey.tsx) are
// read from this single config list, so adding a new group later (a future topic's
// own tag category -- e.g. academic results) is one entry here, not a change to
// either component's own layout or structure. Previously MapFilterPanel.tsx had
// Sector/Phase/Gender hardcoded as three separate props/types -- refactored here
// specifically because Guy flagged that as the wrong shape for "more filter groups
// arriving over time."
//
// Phase options are the real shipped taxonomy (typology.ts's phaseTags()) --
// Junior/Prep/Senior/Sixth. An earlier build brief described this category as
// "junior/senior/through," which doesn't match what's actually implemented (no
// "Through" tag exists in code) -- built against the real tags, flagged rather than
// silently reconciled (carried over from the 2026-08-24 report).
//
// No Boarding group -- consistent with typology.ts's own rule (boardingTag is
// display-only, not a matching filter, Guy's own call, logged in
// docs/OPEN_QUESTIONS.md). This config doesn't relitigate that.
export type FilterableSchool = {
  sector: SectorTag | null;
  phase: PhaseTag[];
  gender: GenderTag | null;
  // Optional: only needed for the "Through School" roll-aware check below (see
  // isGenuineThroughSchool's own comment) -- every other tag group ignores it.
  rollByPhase?: Partial<Record<PhaseTag, number>> | null;
};

export type TagGroupConfig = {
  key: string;
  title: string;
  options: string[];
  getValues: (school: FilterableSchool) => string[];
};

// 2026-08-28, per Guy's direct instruction: a school carrying BOTH Junior and Senior
// tags (whatever else it also carries -- Prep/Sixth don't change this) is a genuine
// through-school, not just "some phase tag or other happened to win priority." Scoped
// deliberately to exactly Junior+Senior, not any 2+-tag combination -- Guy named this
// pairing specifically; Senior+Sixth (a completely ordinary GCSE-plus-sixth-form
// school) and Junior+Prep stay under the existing single-tag priority logic unless a
// later round says otherwise.
//
// rollByPhase, added same day: real bug caught immediately after shipping the tag-only
// version -- Woldingham (the exact school this whole round started with) carries a
// Junior TAG now (typology.ts's high-age-19 extension) but has ZERO real Junior-age
// pupils, so tag-only through-school detection reclassified it from the correct
// "Senior" (its real, roll-aware colour) to "Through School" -- same underlying
// mistake as the original bug, just one label further along. Requires a genuine,
// non-zero entry in rollByPhase for BOTH Junior and Senior, not just the nominal
// statutory age range. Falls back to tag-only when rollByPhase isn't available at all
// (rather than always returning false) so this degrades gracefully, not silently.
export function isGenuineThroughSchool(
  schoolPhases: PhaseTag[],
  rollByPhase?: Partial<Record<PhaseTag, number>> | null,
): boolean {
  if (!schoolPhases.includes("Junior") || !schoolPhases.includes("Senior")) return false;
  if (!rollByPhase) return true;
  return rollByPhase.Junior !== undefined && rollByPhase.Senior !== undefined;
}

export const TAG_GROUPS: TagGroupConfig[] = [
  {
    key: "sector",
    title: "Sector",
    options: ["Independent", "State"],
    getValues: (s) => (s.sector ? [s.sector] : []),
  },
  {
    key: "phase",
    title: "Phase",
    options: ["Junior", "Prep", "Senior", "Sixth", "Through School"],
    // A through-school still carries its own real Junior/Senior/(Prep/Sixth) tags
    // alongside "Through School" -- filtering by "Junior" should still catch it (it
    // does have a Junior offering), "Through School" narrows to exactly this
    // population, both filters genuinely true at once, same stackable-tag semantics
    // every other multi-value phase combination already has.
    getValues: (s) =>
      isGenuineThroughSchool(s.phase, s.rollByPhase) ? [...s.phase, "Through School"] : s.phase,
  },
  {
    key: "gender",
    title: "Gender",
    options: ["Boys", "Girls", "Co-ed"],
    getValues: (s) => (s.gender ? [s.gender] : []),
  },
];

// Which groups currently have real colour logic wired (SchoolMap.tsx's own colour
// function + CSS custom properties) -- deliberately a subset, not "every filter group
// is automatically a colour mode." A future group needs its own colour function and
// swatch mapping added before it belongs here, so this list doesn't grow for free
// just by adding a filter group above.
//
// 2026-08-25: expanded from sector-only to all three -- Guy's live review expected a
// working Phase/Gender option in the mode selector, not just Sector. Gender is a
// single value per school (or null), no ambiguity. Phase is stackable (0-3 tags per
// school, e.g. a through school can be Junior+Senior+Sixth at once) -- there's still
// no "master tag" decision (the taxonomy investigation flagged this as open, Guy
// still thinking it through), so phase-mode colour picks the FIRST tag in this
// canonical order as a simple, deterministic placeholder -- not a real resolution of
// that open question, just enough to make the mode selectable without guessing at
// something nobody's decided yet.
export const COLOUR_MODE_KEYS = ["sector", "phase", "gender"];

export const PHASE_COLOUR_PRIORITY: string[] = ["Junior", "Prep", "Senior", "Sixth"];

// 2026-08-26, map phase-band roll sizing: which of a through-school's own phase tags
// is "the one this dot is currently about" -- drives BOTH colour and radius when
// colour-by is Phase, since a dot's size should always match what its colour claims.
// Prefers whichever of the school's tags the ACTIVE PHASE FILTER selected, not just
// the fixed priority order -- if you've filtered down to "Senior," a Junior+Senior+
// Sixth school showing up because of that filter should be sized/coloured by ITS
// Senior figure, not silently defaulted to Junior. Falls back to the same
// PHASE_COLOUR_PRIORITY order when no phase filter is active (or, defensively, if
// none of the selected values end up matching -- passesFilters should already have
// excluded that school, but this never throws either way).
//
// rollByPhase, 2026-08-28: optional, and when given, a tag only counts as a real
// candidate if it has a genuine non-zero entry there. Real bug caught extending
// phaseTags() to cover high age 19 (typology.ts) -- Woldingham's own
// statutory_low_age (10) is a nominal registration floor, not real enrolment (its
// actual youngest pupils are 11), so it now carries a "Junior" tag with ZERO real
// Junior pupils. Without this check it would show as a Junior-coloured dot sized by
// its FULL total roll (effectiveRoll's rollByPhase?.[tag] ?? totalRoll fallback,
// triggered by Junior simply being absent from rollByPhase) -- confidently wrong, a
// worse result than the plain grey dot this was meant to fix. Falls back to the
// roll-blind priority order when rollByPhase is omitted (single-tag schools skip this
// function entirely, per effectiveRoll's own early return) or when NONE of a school's
// tags have real roll data (nothing to prefer either way).
export function relevantPhaseTag(
  schoolPhases: PhaseTag[],
  phaseFilterSelection: Set<string>,
  rollByPhase?: Partial<Record<PhaseTag, number>> | null,
): PhaseTag | null {
  const hasRealRoll = (p: string) => !rollByPhase || rollByPhase[p as PhaseTag] !== undefined;

  if (phaseFilterSelection.size > 0) {
    const matching = PHASE_COLOUR_PRIORITY.filter(
      (p) => schoolPhases.includes(p as PhaseTag) && phaseFilterSelection.has(p),
    );
    const matchingWithRoll = matching.filter(hasRealRoll);
    if (matchingWithRoll.length > 0) return matchingWithRoll[0] as PhaseTag;
    if (matching.length > 0) return matching[0] as PhaseTag;
  }
  const present = PHASE_COLOUR_PRIORITY.filter((p) => schoolPhases.includes(p as PhaseTag));
  const presentWithRoll = present.filter(hasRealRoll);
  if (presentWithRoll.length > 0) return presentWithRoll[0] as PhaseTag;
  return (present[0] as PhaseTag | undefined) ?? null;
}

export type FilterState = Record<string, Set<string>>;

export function emptyFilterState(groups: TagGroupConfig[] = TAG_GROUPS): FilterState {
  const state: FilterState = {};
  for (const g of groups) state[g.key] = new Set();
  return state;
}

// Empty set for a group = no restriction from that group. Non-empty = only schools
// whose own tag value(s) intersect the selection pass. getValues always returns an
// array (even for single-value categories like sector/gender) so stackable
// categories like phase (0-3 tags per school) and single-value ones share the same
// "shares at least one selected value" semantics -- the same rule
// surrounding-schools.ts already uses for its own phase matching.
export function passesFilters(
  school: FilterableSchool,
  filters: FilterState,
  groups: TagGroupConfig[] = TAG_GROUPS,
): boolean {
  for (const g of groups) {
    const selected = filters[g.key];
    if (!selected || selected.size === 0) continue;
    const values = g.getValues(school);
    if (!values.some((v) => selected.has(v))) return false;
  }
  return true;
}
