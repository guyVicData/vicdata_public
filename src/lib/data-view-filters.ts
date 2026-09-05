// Member Data View (build brief v1, §4): the shared phase/age + gender + boarding-
// status filter state that sits above Map/Dashboard/Rankings, one state consumed by
// all three -- never reset or diverged when switching views. Distinct from
// map-tag-groups.ts's FilterState (the PUBLIC map's sector/phase/gender MEMBERSHIP
// filter, which hides/shows dots) -- these filters never change which schools are in
// the ticked comparator set (the tick-list is the only comparison mechanism, brief
// §4); they change what NUMBER is being compared for the schools already ticked, the
// same "through-school collapses to its relevant department" mechanic the brief's §5
// describes for phase, generalised to all three axes here.
//
// Real data constraint, decided deliberately rather than glossed over: DfE census
// boarding facts (boarders_total/boarders_male/boarders_female) are whole-school
// figures only -- there is no boarders-by-age-band or boarders-by-phase breakdown
// anywhere in the source (confirmed directly against real facts while investigating
// brief §2 item 4's boarding-ratio anomaly). So the boarding-status filter and the
// phase/age filter cannot be honestly combined into one sliced number the way phase
// and gender can (gender DOES have a per-age breakdown, via the same age_gender
// facts the roll chart already uses). Resolution, logged as a decision in
// docs/vicdata_data_view_open_questions.md: boarding-status, when active, replaces
// the displayed count with the whole-school boarders/day figure and ignores any
// active phase/age narrowing (ages/gender still apply where the data supports them --
// boarders_male/boarders_female are real, so boarding+gender DOES combine); a caption
// in the consuming UI says so explicitly rather than silently showing a number that
// looks phase-scoped but isn't.

import type { GenderTag } from "./typology";
import { phaseTagAgeRange, type PhaseTag } from "./typology";
import type { AgeGenderCounts } from "./roll-data";
import { EARLY_YEARS_PROXY_AGE_THRESHOLD } from "./narrative-config";

// Member Data View build (2026-10-03), brief §4: "Early Years" is named explicitly
// alongside the real PhaseTag taxonomy (Junior/Senior/16+) as one of the four phase
// bands a member filters by -- not a typology.ts PhaseTag itself (early years pupils
// are already counted inside a school's real Junior tag, per hasEarlyYearsProvision's
// own age-proxy reasoning in narrative.ts), but a real, separately-selectable AGE
// SLICE (ages below EARLY_YEARS_PROXY_AGE_THRESHOLD) worth its own filter pill since a
// member comparing nurseries/preps specifically wants to isolate it. "16+" in the
// brief's own prose maps directly to the existing "Post 16" PhaseTag -- same
// taxonomy, not a new one; kept as "Post 16" here so this module stays in the one
// real vocabulary typology.ts already defines, per the brief's own "reuses the
// existing phase mechanism" instruction.
export type PhaseBandKey = "Early Years" | "Junior" | "Prep" | "Senior" | "Post 16";

export const PHASE_BANDS: PhaseBandKey[] = ["Early Years", "Junior", "Prep", "Senior", "Post 16"];

// Boarding-status filter options -- the two REAL numbers DfE census actually reports
// (boarders_total, and day = totalRoll - boarders_total), not typology.ts's 3-way
// BoardingTag display category (Boarding/Day/Boarding & day, a school-level
// classification, not a headcount to slice by). See module comment for why this
// can't be a straight reuse of BoardingTag.
export type BoardingFilterValue = "Boarders" | "Day pupils";

export type DataViewFilterState = {
  phaseBands: Set<PhaseBandKey>;
  // Only meaningful (and only ever shown in the UI) when exactly one phaseBands entry
  // is selected -- the age drill-down nested under that one band, brief §4's own
  // wording ("individual ages as an expandable drill-down nested under a selected
  // phase band"). Empty set with a band selected means "the whole band," not "no
  // ages" -- ages only narrow FURTHER once at least one is explicitly ticked.
  ages: Set<number>;
  gender: Set<GenderTag>;
  boarding: Set<BoardingFilterValue>;
};

export function emptyDataViewFilterState(): DataViewFilterState {
  return { phaseBands: new Set(), ages: new Set(), gender: new Set(), boarding: new Set() };
}

// One school's full real per-age/per-sex breakdown for the currently-relevant period,
// plus the whole-school boarding split -- the minimal shape every filter-recompute
// function below needs. Deliberately narrow (not the full DataViewSchoolProfile from
// data-view-profiles.ts) so this module has no dependency on how that richer type is
// fetched/assembled.
export type FilterableSchoolData = {
  statutoryLowAge: number | null;
  statutoryHighAge: number | null;
  ageGenderCounts: AgeGenderCounts;
  boarding: { boarders: number; day: number; total: number } | null;
  // Real DfE census fields (boarders_male/boarders_female) -- null whenever the
  // source only gave a total (same "total exists, gender split doesn't" case
  // roll-data.ts's own finishSnapshot already tolerates for the school's whole-roll
  // boarding figure).
  boardersGenderSplit: { female: number; male: number } | null;
};

// The real [lo,hi] age range a phase band covers for THIS school -- Early Years is a
// fixed age cap (below the reliable-census threshold), every other band reuses
// typology.ts's own phaseTagAgeRange so this module never invents a second copy of
// those boundaries.
export function ageRangeForBand(
  band: PhaseBandKey,
  lowAge: number,
  highAge: number,
): [number, number] {
  if (band === "Early Years") return [Math.min(lowAge, 0), EARLY_YEARS_PROXY_AGE_THRESHOLD - 1];
  return phaseTagAgeRange(band as PhaseTag, lowAge, highAge);
}

function sumAgeGender(
  counts: AgeGenderCounts,
  lo: number,
  hi: number,
  genderFilter: Set<GenderTag>,
): { total: number; female: number; male: number } {
  let female = 0;
  let male = 0;
  for (const [age, c] of counts) {
    if (age < lo || age > hi) continue;
    female += c.female;
    male += c.male;
  }
  // Gender filter slices the SAME already-narrowed age range down to one sex's real
  // count -- "Girls" -> female only, "Boys" -> male only, both/neither -> combined.
  // "Co-ed" is never a filter value here (it isn't a headcount to slice by, unlike
  // the school-level Co-ed TAG elsewhere in this codebase) -- only Girls/Boys narrow.
  const wantGirls = genderFilter.has("Girls");
  const wantBoys = genderFilter.has("Boys");
  if (wantGirls && !wantBoys) return { total: female, female, male: 0 };
  if (wantBoys && !wantGirls) return { total: male, female: 0, male };
  return { total: female + male, female, male };
}

// The one function every consuming view (Dashboard/Rankings/Map) calls to get "the
// number this filter state says to show for this school" -- phase/age slice, then
// gender slice within it, UNLESS boarding is active, in which case boarding wins
// outright (see module comment for why the two can't honestly combine with a phase
// slice). Returns both the raw count and a short machine-readable reason so the UI
// can render an honest caption ("boarding count is whole-school...") without
// re-deriving the same logic.
export type FilteredCount = {
  total: number;
  female: number | null; // null when boarding-mode makes a gender split unavailable
  male: number | null;
  basis: "whole_school" | "phase_slice" | "boarding_whole_school" | "boarding_with_gender";
};

export function filteredCount(school: FilterableSchoolData, filters: DataViewFilterState): FilteredCount {
  if (filters.boarding.size > 0) {
    // Both options ticked reads as "whole school" -- Boarders + Day pupils together
    // are exhaustive, same as neither restricting.
    const mode: "boarders" | "day" | "whole" =
      filters.boarding.size === 2 ? "whole" : filters.boarding.has("Boarders") ? "boarders" : "day";
    const b = school.boarding;
    if (!b) return { total: 0, female: null, male: null, basis: "boarding_whole_school" };
    const wholeCount = mode === "boarders" ? b.boarders : mode === "day" ? b.day : b.total;

    // Gender combines honestly with boarding (boarders_male/boarders_female are real
    // DfE census fields, unlike a phase/age slice, which the source never
    // cross-tabulates against boarding status at all -- see module comment).
    const wantGirls = filters.gender.has("Girls");
    const wantBoys = filters.gender.has("Boys");
    if ((wantGirls === wantBoys) || !school.boardersGenderSplit) {
      // Neither or both genders selected, or no real gender split to slice by.
      return { total: wholeCount, female: null, male: null, basis: "boarding_whole_school" };
    }
    const { female: wholeFemale, male: wholeMale } = sumAgeGender(school.ageGenderCounts, -Infinity, Infinity, new Set());
    const dayFemale = Math.max(wholeFemale - school.boardersGenderSplit.female, 0);
    const dayMale = Math.max(wholeMale - school.boardersGenderSplit.male, 0);
    const genderedCount =
      mode === "day"
        ? wantGirls ? dayFemale : dayMale
        : mode === "boarders"
          ? wantGirls ? school.boardersGenderSplit.female : school.boardersGenderSplit.male
          : wantGirls ? wholeFemale : wholeMale;
    return {
      total: genderedCount,
      female: wantGirls ? genderedCount : 0,
      male: wantGirls ? 0 : genderedCount,
      basis: "boarding_with_gender",
    };
  }

  if (filters.phaseBands.size === 0 || school.statutoryLowAge === null || school.statutoryHighAge === null) {
    const r = sumAgeGender(school.ageGenderCounts, -Infinity, Infinity, filters.gender);
    return { total: r.total, female: r.female, male: r.male, basis: "whole_school" };
  }

  // Union of every selected band's own real range for this school, then (if exactly
  // one band is active) further narrowed to the ticked individual ages within it.
  let lo = Infinity;
  let hi = -Infinity;
  for (const band of filters.phaseBands) {
    const [bLo, bHi] = ageRangeForBand(band, school.statutoryLowAge, school.statutoryHighAge);
    lo = Math.min(lo, bLo);
    hi = Math.max(hi, bHi);
  }
  if (filters.phaseBands.size === 1 && filters.ages.size > 0) {
    const selected = [...filters.ages];
    lo = Math.min(...selected);
    hi = Math.max(...selected);
  }
  const r = sumAgeGender(school.ageGenderCounts, lo, hi, filters.gender);
  return { total: r.total, female: r.female, male: r.male, basis: "phase_slice" };
}

// A compact human-readable label for the CURRENTLY active filter combination --
// consumed by the sidebar's own "sorted by / filtered by" summary line and the PDF
// export's "what produced this" print line (brief §9).
export function describeFilters(filters: DataViewFilterState): string | null {
  const parts: string[] = [];
  if (filters.boarding.size > 0) {
    parts.push([...filters.boarding].join(" & "));
    if (filters.phaseBands.size > 0) {
      parts.push("(phase filter not applied -- boarding figures are whole-school only)");
    }
  } else if (filters.phaseBands.size > 0) {
    const bands = [...filters.phaseBands].join(" + ");
    if (filters.phaseBands.size === 1 && filters.ages.size > 0) {
      const ages = [...filters.ages].sort((a, b) => a - b);
      parts.push(`${bands} (ages ${ages[0]}-${ages[ages.length - 1]})`);
    } else {
      parts.push(bands);
    }
  }
  if (filters.gender.size > 0 && filters.gender.size < 2) {
    parts.push([...filters.gender][0]);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}
