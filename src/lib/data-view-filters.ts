// Member Data View (build brief v1, §4): the shared phase/age + gender + boarding-
// status filter state that sits above Map/Dashboard/Rankings, one state consumed by
// all three -- never reset or diverged when switching views. Distinct from
// map-tag-groups.ts's FilterState (the PUBLIC map's sector/phase/gender MEMBERSHIP
// filter, which hides/shows dots) -- most of these filters never change which
// schools are in the ticked comparator set (the tick-list is the only comparison
// mechanism, brief §4); they change what NUMBER is being compared for the schools
// already ticked, the same "through-school collapses to its relevant department"
// mechanic the brief's §5 describes for phase, generalised to all three axes here.
//
// 2026-09-07, UX refinements round 2, P3 item 7: `sector` is the one deliberate
// exception to that rule, added this round -- a school's own sector isn't a
// per-pupil number with a slice to narrow (unlike phase/gender), it's a whole-
// school category, so the only honest thing an active sector filter can do is
// MEMBERSHIP filtering, same as the public map's own sector filter already does
// (hide/exclude non-matching schools entirely from Map/Dashboard/Rankings) --
// deliberately reusing that established convention rather than inventing a
// different one for this one field. See matchesSectorFilter's own comment below.
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

import type { GenderTag, SectorTag } from "./typology";
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
// 2026-09-06, UX refinements round 1, A2/B1: "Adult" added as a sixth band -- the FE
// participation source's 19+ bucket has no school-side analogue at all (unlike
// "Post 16", which already means the real ages-16-18 range for a school AND doubles
// as the "U19" label an FE college's under-19 ILR figure slots into -- see
// relevantAgeBandsFor's own comment for why that's a relabelling, not a new band).
// Always legal to select for consistency (this Set has no per-target legality
// enforcement, only per-target UI relevance -- see relevantAgeBandsFor), but only
// ever produces a non-zero figure for an institution with real FE participation data.
export type PhaseBandKey = "Early Years" | "Junior" | "Prep" | "Senior" | "Post 16" | "Adult";

export const PHASE_BANDS: PhaseBandKey[] = ["Early Years", "Junior", "Prep", "Senior", "Post 16", "Adult"];

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
  // 2026-09-06, UX refinements round 1, A2: "change the date range examined... end
  // date fixed at the latest available year, start date selectable." The END date is
  // deliberately NOT a field here -- it's always CURRENT_CENSUS_PERIOD (roll-data.ts),
  // never stored/selectable, matching the brief's own "can't be changed." This is the
  // one field on this type that ISN'T itself a UI-facing "narrow the count" filter --
  // it instead picks WHICH historical period every "since X" trend/anchor comparison
  // (trend badges, the Roll Trend chart, A3's summary sentence) measures from. Kept on
  // this same shared state rather than a separate piece of state since it's still
  // "one state, fed to whichever view is active" exactly like every other field here.
  startPeriod: number;
  // 2026-09-07, UX refinements round 2, P3 item 7: membership filter, not a slice
  // -- see this module's own header comment for why sector can't work the way
  // phase/gender/boarding do. Empty = no restriction (every sector passes).
  sector: Set<SectorTag>;
};

// TREND_ANCHOR_PERIOD (data-view-profiles.ts) duplicated as a literal default here
// rather than imported -- that module is server-only (createServerAnonSupabaseClient),
// and this one deliberately has no server-only imports so client components can use
// it directly (same discipline data-view-serialize.ts's own header comment documents).
const DEFAULT_START_PERIOD = 2019;

export function emptyDataViewFilterState(): DataViewFilterState {
  return { phaseBands: new Set(), ages: new Set(), gender: new Set(), boarding: new Set(), startPeriod: DEFAULT_START_PERIOD, sector: new Set() };
}

// 2026-09-07, UX refinements round 2, P3 item 7: the one real predicate every
// membership-filtering call site (MapView's marker loop, DataViewShell's own
// tickedProfiles derivation feeding Dashboard/Rankings) shares, so "does this
// school pass the active sector filter" can't drift between the three views the
// way a hand-copied check in each would risk.
export function matchesSectorFilter(sector: SectorTag | null, filterSet: Set<SectorTag>): boolean {
  if (filterSet.size === 0) return true;
  return sector !== null && filterSet.has(sector);
}

// Wire-safe (de)serialisation for saving/recalling a filter combination alongside a
// comparator set (UX refinements round 1, A2 + B3: "share one underlying save
// mechanism," never two). Every field here is a Set, which -- same lesson as
// data-view-serialize.ts's own AgeGenderCounts history -- doesn't survive
// JSON.stringify/a jsonb column at all; converted to/from plain arrays explicitly
// rather than assumed safe.
export type WireDataViewFilterState = {
  phaseBands: PhaseBandKey[];
  ages: number[];
  gender: GenderTag[];
  boarding: BoardingFilterValue[];
  startPeriod: number;
  sector: SectorTag[];
};

export function serializeFilterState(f: DataViewFilterState): WireDataViewFilterState {
  return {
    phaseBands: [...f.phaseBands],
    ages: [...f.ages],
    gender: [...f.gender],
    boarding: [...f.boarding],
    startPeriod: f.startPeriod,
    sector: [...f.sector],
  };
}

export function deserializeFilterState(w: WireDataViewFilterState): DataViewFilterState {
  return {
    phaseBands: new Set(w.phaseBands ?? []),
    ages: new Set(w.ages ?? []),
    gender: new Set(w.gender ?? []),
    boarding: new Set(w.boarding ?? []),
    startPeriod: w.startPeriod ?? DEFAULT_START_PERIOD,
    sector: new Set(w.sector ?? []),
  };
}

export type AgeBandOption = { key: PhaseBandKey; label: string };

// 2026-09-06, UX refinements round 1, A2: "show only the filters relevant to the
// school/college being viewed... e.g. for Acland Burghley: Phase (Senior/Post-16),
// Gender, not every possible filter for every phase/sector." Two real cases:
//
// 1. An ordinary school/through-school: the phase bands it actually, really spans --
//    reusing the TARGET's own effective phase tags (DataViewSchoolProfile's `phase`,
//    already enrollment-aware via effectivePhaseTags) for Junior/Prep/Senior, PLUS
//    "Post 16" whenever the school's real statutoryHighAge reaches 16, checked
//    SEPARATELY from `phase` rather than folded into that same loop.
//
//    This split is deliberate, caught by checking Acland Burghley's own real data
//    (11-18, phase = ["Senior"] only) against the request's own example, which
//    explicitly expects BOTH Senior and Post-16 to show for it: typology.ts's
//    phaseTags() deliberately never puts "Senior" and "Post 16" in the same tag set
//    for one school (a considered, real-data-verified decision, not an oversight --
//    ages 16-18 are folded INTO "Senior" for an ordinary through-school, its own
//    history comment explains why) -- but the underlying age SLICE `[16, highAge]`
//    (phaseTagAgeRange's own "Post 16" branch) is still just as real and still worth
//    isolating for a member who wants "sixth form roll" specifically, exactly as A3's
//    own example sentences assume. Gating strictly on `phase.includes("Post 16")`
//    would mean this pill could never appear for any ordinary through-school at
//    all -- only for a standalone Post-16-only institution, which isn't what the
//    request's own example describes.
//
//    Early Years is its own proxy check (hasEarlyYearsProvision's exact threshold
//    test, narrative.ts -- re-implemented as one line here rather than importing
//    that module, which pulls in heavier narrative-generation dependencies this
//    file has no other reason to depend on).
// 2. An FE-participation institution (feParticipation non-null on the PROFILE, i.e.
//    genuinely has no real census phase data at all): Junior/Prep/Senior/Early Years
//    are hidden outright (real zeros with no meaningful "this doesn't apply" story),
//    and "Post 16" is relabelled "U19" in this one context -- the underlying filter
//    value is unchanged (still literally "Post 16" in DataViewFilterState, see that
//    band's own module comment for why), only the LABEL shown to the member differs,
//    since "Post 16" reads as nonsensical terminology for an institution that has no
//    other phases to be "post" relative to. "Adult" is always offered for such a
//    target (whether or not it has real adult data this round -- e.g. a genuinely
//    under-19-only college would still legitimately offer it, honestly returning 0).
export function relevantAgeBandsFor(school: {
  phase: PhaseTag[];
  statutoryLowAge: number | null;
  statutoryHighAge: number | null;
  feParticipation: unknown;
}): AgeBandOption[] {
  if (school.feParticipation) {
    return [
      { key: "Post 16", label: "U19" },
      { key: "Adult", label: "Adult" },
    ];
  }
  const bands: AgeBandOption[] = [];
  if (school.statutoryLowAge !== null && school.statutoryLowAge < EARLY_YEARS_PROXY_AGE_THRESHOLD) {
    bands.push({ key: "Early Years", label: "Early Years" });
  }
  for (const tag of ["Junior", "Prep", "Senior"] as const) {
    if (school.phase.includes(tag)) bands.push({ key: tag, label: tag });
  }
  if (school.statutoryHighAge !== null && school.statutoryHighAge >= 16) {
    bands.push({ key: "Post 16", label: "Post 16" });
  }
  return bands;
}

// 2026-09-07, UX refinements round 2, P1 item 3: "Acland Burghley shows a
// 'Boarding' filter despite having zero boarders -- the 'show only relevant
// filters' logic covered Phase/Post-16 but missed Boarding." Same real check
// DashboardView.tsx's own targetIsDaySchool already used inline (a day school has
// either no real boarding figure at all, or a real one that's genuinely zero) --
// extracted here so FilterBar.tsx's relevance gate and Dashboard's own card can't
// silently drift apart on what "this school doesn't board" means.
export function hasRealBoardingProvision(boarding: { boarders: number; day: number; total: number } | null): boolean {
  return boarding !== null && boarding.boarders > 0;
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
  // 2026-09-06, UX refinements round 1, B1: an FE-participation institution's ONLY
  // real figures -- always null for a school with real census ageGenderCounts (never
  // blended, same discipline data-view-profiles.ts's own feParticipation field
  // documents). Present here, not bolted on as a special case elsewhere, so
  // filteredCount stays the one function every view calls regardless of which kind
  // of institution it's asking about.
  feParticipation: {
    under19: { total: number; male: number | null; female: number | null } | null;
    adult: { total: number; male: number | null; female: number | null } | null;
  } | null;
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
  // "Adult" has no real census-age analogue for a mainstream school -- an empty range
  // (rather than e.g. [19, highAge]) so sumAgeGender honestly returns 0 for every
  // ordinary school rather than picking up a same-shaped but wrong "19+ pupils"
  // figure that doesn't actually exist in this source. Real Adult figures only ever
  // come from feParticipation (see filteredCount's own branch), never this path.
  if (band === "Adult") return [Infinity, -Infinity];
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
  // Defensive guard, added 2026-09-05 after a real live crash: a Map that round-trips
  // through JSON.stringify (e.g. a WireDataViewSchoolProfile field a future change
  // forgets to convert back, the exact mistake data-view-serialize.ts's own history
  // comment documents) silently becomes a plain, non-iterable object at runtime --
  // TypeScript's static types can't catch this, since the object is still typed as
  // AgeGenderCounts. `for...of` on a non-iterable throws "counts is not iterable",
  // which took down MapView's entire marker-drawing effect for every real school with
  // real 2019 data. Degrading to "no real data for this slice" is honest and correct
  // here regardless of cause -- never worth crashing a whole view over one school's
  // malformed figure.
  if (counts instanceof Map) {
    for (const [age, c] of counts) {
      if (age < lo || age > hi) continue;
      female += c.female;
      male += c.male;
    }
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
  basis: "whole_school" | "phase_slice" | "boarding_whole_school" | "boarding_with_gender" | "fe_participation";
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

  // 2026-09-06, UX refinements round 1, B1: the real fix -- an FE-participation
  // institution (feParticipation set, meaning it has real ILR data because its
  // ageGenderCounts is genuinely empty -- see data-view-profiles.ts's own field
  // comment) is counted from THIS branch, never from sumAgeGender against an empty
  // Map (which is what every view was silently doing before, always landing on 0).
  // "Post 16" doubles as the U19 label for an FE college (see relevantAgeBandsFor's
  // own comment in FilterBar.tsx for the UI-label side of this); "Adult" is the 19+
  // segment. Selecting BOTH sums them -- a deliberate, explicit union, the same
  // "multiple selected bands add together" rule the ordinary phase-slice branch
  // below already applies, not the silent "whichever happens to be non-zero" the old
  // ilrFallbackRoll logic did. Selecting neither (a Junior/Senior/Early Years band,
  // or no phase filter at all -- see the true default case below) with no real
  // FE-participation analogue honestly returns 0, not a guessed fallback.
  if (school.feParticipation) {
    const wantU19 = filters.phaseBands.has("Post 16");
    const wantAdult = filters.phaseBands.has("Adult");
    // No phase filter at all: default to the under-19 figure as the closest FE
    // analogue to "current roll" (matching the old ilrFallbackRoll field's original
    // intent), never an unrequested sum of two genuinely different populations.
    const useU19 = wantU19 || (!wantAdult && filters.phaseBands.size === 0);
    if (!useU19 && !wantAdult) {
      return { total: 0, female: 0, male: 0, basis: "fe_participation" };
    }
    let total = 0;
    let female = 0;
    let male = 0;
    if (useU19 && school.feParticipation.under19) {
      total += school.feParticipation.under19.total;
      female += school.feParticipation.under19.female ?? 0;
      male += school.feParticipation.under19.male ?? 0;
    }
    if (wantAdult && school.feParticipation.adult) {
      total += school.feParticipation.adult.total;
      female += school.feParticipation.adult.female ?? 0;
      male += school.feParticipation.adult.male ?? 0;
    }
    const wantGirls = filters.gender.has("Girls");
    const wantBoys = filters.gender.has("Boys");
    if (wantGirls && !wantBoys) return { total: female, female, male: 0, basis: "fe_participation" };
    if (wantBoys && !wantGirls) return { total: male, female: 0, male: 0, basis: "fe_participation" };
    return { total, female, male, basis: "fe_participation" };
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
