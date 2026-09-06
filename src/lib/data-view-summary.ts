// Member Data View (UX refinements round 1, A3): "A text line below the filter row,
// stating in plain language what the current filter/comparator combination means for
// what's shown on Map/Dashboard/Rankings... a real sentence-template system driven by
// whichever filters/comparator set are actually active, not hardcoded strings."
//
// Genuinely driven by real state, not a lookup table of Guy's own five illustrative
// examples -- those examples describe the SHAPE of sentence wanted, not five literal
// strings to special-case. Two of them happen to be exactly reproducible from real
// data already in this build (see the recipe-clause comments below for which, and
// why); the rest compose the same way from whatever's actually active.
//
// Deliberately has no server-only imports (same discipline as data-view-filters.ts/
// data-view-serialize.ts) so it can run in the client alongside the filter state it
// describes, recomputed on every render rather than fetched.

import type { DataViewFilterState, PhaseBandKey } from "./data-view-filters";
import type { DataViewSchoolProfile } from "./data-view-profiles";
import type { SetOption } from "./data-view-types";

const CURRENT_CENSUS_PERIOD_LABEL_YEAR = 2025; // roll-data.ts's own CURRENT_CENSUS_PERIOD, duplicated as a literal -- see data-view-filters.ts's own DEFAULT_START_PERIOD comment for why this file avoids importing that server-only-adjacent module by value.

function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

// "Sixth form" is the plain-language word for the U19/Post-16 age slice in running
// prose (Guy's own examples 1 and 3 both use ordinary school vocabulary -- "state
// senior schools," "sixth form roll" -- not the filter pill's own internal label).
const PHASE_BAND_PROSE: Record<PhaseBandKey, string> = {
  "Early Years": "early years",
  Junior: "junior",
  Prep: "prep",
  Senior: "senior",
  "Post 16": "sixth form",
  Adult: "adult",
};

function metricPhrase(filters: DataViewFilterState, target: DataViewSchoolProfile): string {
  let base: string;
  if (filters.boarding.size === 1) {
    base = filters.boarding.has("Boarders") ? "Boarding population" : "Day population";
  } else if (filters.phaseBands.size === 1 && filters.ages.size === 1) {
    // "11 year old roll" (example 4) -- the one-age drill-down, nested under a single
    // selected phase band (data-view-filters.ts's own `ages` field comment).
    const age = [...filters.ages][0];
    base = `${age} year old roll`;
  } else if (target.feParticipation && filters.phaseBands.has("Adult") && !filters.phaseBands.has("Post 16")) {
    base = "Adult roll";
  } else if (filters.phaseBands.has("Post 16")) {
    base = target.feParticipation ? "U19 roll" : "Sixth form roll";
  } else if (filters.phaseBands.size >= 1) {
    base = `${[...filters.phaseBands].map((b) => PHASE_BAND_PROSE[b]).join("/")} roll`;
    base = base.charAt(0).toUpperCase() + base.slice(1);
  } else {
    base = "Total roll";
  }

  const gender = filters.gender.size === 1 ? [...filters.gender][0] : null;
  if (!gender) return base;
  if (base === "Total roll") return `${gender} roll`;
  return `${gender} ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

// The one real school-type word for a target's own sector -- reused here rather than
// re-derived, matching the exact vocabulary the rest of the Data View already uses
// (typology.ts's SectorTag).
function sectorProse(sector: DataViewSchoolProfile["sector"]): string {
  if (sector === "Independent") return "independent";
  if (sector === "State") return "state";
  if (sector === "Special Schools") return "special";
  if (sector === "FE") return "FE";
  return "";
}

// The "In X, Y, Z (all sectors)" label buildLaComparatorSet (default-comparator-
// lists.ts) already produces carries the real LA names inline -- parsed back out
// here rather than re-plumbing them as a separate field, since the label is the one
// place they're guaranteed to already be correct and current.
function laNamesFromLabel(label: string): string | null {
  const match = /^In (.+) \(all sectors\)$/.exec(label);
  if (!match) return null;
  // "Camden, Islington and Haringey" -- natural-prose joining (the label itself
  // stays plain comma-separated for the dropdown option text; this is purely the
  // sentence's own phrasing).
  const names = match[1].split(", ");
  if (names.length <= 1) return names[0] ?? null;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function comparedWithPhrase(activeSet: SetOption | null, target: DataViewSchoolProfile): string {
  if (!activeSet) return "no comparator set selected";
  if (activeSet.kind === "saved") return `your saved set "${activeSet.label}"`;

  const count = activeSet.schools.length;
  const sector = sectorProse(target.sector);
  // Genuinely reproduces example 1 verbatim for a real state senior school's own
  // Nearest-10 set: nearest_schools' own RPC (surrounding-schools.ts's header
  // comment) restricts candidates to the target's own sector AND phase by
  // construction, so "N nearest {sector} {phase} schools" is always literally
  // true of this recipe's real membership, not a guess.
  if (activeSet.key === "nearest_10") {
    const phase = target.phase.length === 1 ? PHASE_BAND_PROSE[target.phase[0] as PhaseBandKey] ?? target.phase[0].toLowerCase() : "";
    return `${count} nearest ${[sector, phase].filter(Boolean).join(" ")} schools`.replace(/\s+/g, " ").trim();
  }
  if (activeSet.key === "fe_nearest_10") {
    return `${count} nearest FE colleges`;
  }
  if (activeSet.key === "in_la" || activeSet.key === "multi_la") {
    const las = laNamesFromLabel(activeSet.label) ?? "this area";
    const phase = target.phase.length === 1 ? `${PHASE_BAND_PROSE[target.phase[0] as PhaseBandKey] ?? target.phase[0].toLowerCase()} ` : "";
    return `all ${phase}schools in ${las}`;
  }
  if (activeSet.key === "boarding_quintile") {
    return `nearest ${count} similar-sized boarding schools`;
  }
  if (activeSet.key === "fe_local_16plus") {
    const las = laNamesFromLabel(activeSet.label);
    return las ? `16+ provision in ${las}` : "16+ provision in this area";
  }
  // 2026-09-08, bug fix (B1): the new mainstream-target "schools and FE colleges"
  // recipe (default-comparator-lists.ts's own local16Plus field) -- this is the
  // one real recipe this build can produce that genuinely reproduces the brief's
  // own example 3 verbatim ("...compared with schools and FE colleges in Camden,
  // Islington and Haringey"), now that it actually exists as a real candidate
  // list rather than only being reachable by manually searching for an FE
  // college. Parses the LA name back out of the label's own "...in {LA}" suffix
  // (own format, not the "In X (all sectors)" shape laNamesFromLabel expects).
  if (activeSet.key === "local_16plus") {
    const match = /in (.+)$/.exec(activeSet.label);
    return match ? `schools and FE colleges in ${match[1]}` : "schools and FE colleges in this area";
  }
  // Honest fallback for a recipe/shape this function doesn't have a specific
  // template for yet -- the set's own real label, not a fabricated description.
  return activeSet.label;
}

// The one function DataViewShell calls to render A3's summary line. Recomputed
// fresh from the actual live filters/activeSet/target every render -- never cached
// or memoised against stale state, so it can never drift from what Map/Dashboard/
// Rankings are actually showing.
export function describeActiveViewSentence(
  filters: DataViewFilterState,
  activeSet: SetOption | null,
  target: DataViewSchoolProfile,
): string {
  const metric = metricPhrase(filters, target);
  const dateRange = `${academicYearLabel(filters.startPeriod)} to ${academicYearLabel(CURRENT_CENSUS_PERIOD_LABEL_YEAR)}`;
  const comparedWith = comparedWithPhrase(activeSet, target);
  return `${metric} ${dateRange} compared with ${comparedWith}`;
}
