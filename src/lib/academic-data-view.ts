// Academic Results front end (docs/vicdata_phase3_academic_results_frontend_build_brief_v1.md):
// the data layer behind both the free "Academic snapshot" card and the paid Data View
// Academic tab. Fetches from vicdata via the three RPCs built in the RPC bridge round
// (academic_headline_lookup/academic_subject_family_lookup, both ks4/ks5 only) plus the
// pre-existing generic reference_data_lookup RPC for KS2 (dfe_ks2_attainment) -- KS2 has
// no precomputed headline/family table at all (ks_stage is a ks4/ks5-only check
// constraint on every one of the three new aggregate tables, confirmed directly against
// the real migrations), so KS2 support here is deliberately degraded: raw per-year facts,
// no LA/region/national context, no trend badge beyond a plain since-2022/23 comparison,
// no family/subject taxonomy (KS2 has no "subjects," just Reading/Writing/Maths/GPS/
// Science domains). Flagged throughout rather than silently built as if KS2 had the same
// shape as KS4/KS5.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupAcademicHeadline, lookupAcademicSubjectFamily, lookupAcademicKs5QualificationFlags, lookupReferenceData, type KsStage as AcademicRpcKsStage, type ReferenceFact } from "./vicdata-reference";
import { fetchCensusFactsBatched, CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS } from "./data-view-profiles";
import { singleAgeGenderCountsForPeriod, type AgeGenderCounts } from "./roll-data";
import { trendBadge } from "./data-view-cards";
import { TREND_LABELS, PP_TREND_LABELS, classifyPpTrend } from "./trend-labels";

export type KsStage = "ks2" | "ks4" | "ks5";

export type Ks5QualTypes = { ib: boolean; preU: boolean };

export type AcademicHeadlineYear = {
  period: number;
  measures: Record<string, number | string>;
};

export type AcademicFamilyYear = {
  familyId: string;
  familyLabel: string;
  period: number;
  entriesTotal: number;
  entriesSharePercent: number | null;
  avgPointScore: number | null;
  pointsCoveragePercent: number | null;
};

export type AcademicSchoolProfile = {
  urn: string;
  name: string;
  town: string | null;
  easting: number | null;
  northing: number | null;
  // GCSE exclusion round: real column already on `public.schools` (confirmed
  // directly against its own migration and `search_schools`'s own return columns),
  // one more column on the existing query, not a new fetch. Used by
  // igcseExclusionLikely to restrict the exclusion gate to independent schools --
  // see that function's own comment for why.
  establishmentTypeGroup: string | null;
  // KS5 qualification-type-awareness round: real, ground-truth flags from
  // dfe_ks5_subject_results' own qualification_detailed field (see
  // academic_ks5_qualification_flags_lookup's own migration comment for the exact
  // real qualification names each flag matches). Defaults to {ib:false, preU:false}
  // for a school with no real dfe_ks5_subject_results rows at all -- same "absence
  // means false" convention the RPC itself uses.
  ks5QualTypes: Ks5QualTypes;
  ks2: AcademicHeadlineYear[]; // ascending by period; degraded (raw facts, see module comment)
  ks4: AcademicHeadlineYear[];
  ks5: AcademicHeadlineYear[];
  ks4Families: AcademicFamilyYear[];
  ks5Families: AcademicFamilyYear[];
  // Current-snapshot per-age census population (dfe_school_census) -- the map's
  // headline-level circle size (spec §3a: population, not candidates/entries, since
  // the academic ingest itself has no cohort headcount field at all, confirmed
  // against the real ingested columns). Deliberately the SAME real source Rolls' own
  // map already uses, fetched independently here rather than threaded through from
  // DataViewShell's own Rolls-specific profilesByUrn -- keeps this module's own data
  // fetching self-contained rather than depending on another topic's fetch timing.
  ageGenderCounts: AgeGenderCounts;
};

export function populationAtAge(profile: AcademicSchoolProfile, age: number): number | null {
  const counts = profile.ageGenderCounts.get(age);
  return counts ? counts.male + counts.female : null;
}

export function stageYears(profile: AcademicSchoolProfile, stage: KsStage): AcademicHeadlineYear[] {
  return stage === "ks2" ? profile.ks2 : stage === "ks4" ? profile.ks4 : profile.ks5;
}

export function stageFamilies(profile: AcademicSchoolProfile, stage: KsStage): AcademicFamilyYear[] {
  return stage === "ks4" ? profile.ks4Families : stage === "ks5" ? profile.ks5Families : [];
}

// Round 2, Part B: one school's own real years for a single family, ascending by
// period -- the family-level analogue of stageYears/headlineValueAt above. KS2 never
// has any (stageFamilies already returns [] for it), so callers naturally get an empty
// array rather than needing their own ks2 guard.
export function familyYearsFor(profile: AcademicSchoolProfile, stage: KsStage, familyId: string): AcademicFamilyYear[] {
  return stageFamilies(profile, stage)
    .filter((f) => f.familyId === familyId)
    .sort((a, b) => a.period - b.period);
}

export function latestFamilyYear(profile: AcademicSchoolProfile, stage: KsStage, familyId: string): AcademicFamilyYear | null {
  const years = familyYearsFor(profile, stage, familyId);
  return years.length ? years[years.length - 1] : null;
}

// The real, distinct (familyId, familyLabel) pairs actually present across a group of
// profiles at one stage -- union across the whole visible set (target + ticked), not
// just the target's own, so a family only some ticked schools report still appears as
// a real, selectable category. Sorted by label for a stable, alphabetical menu.
export function availableFamilies(profiles: AcademicSchoolProfile[], stage: KsStage): { familyId: string; familyLabel: string }[] {
  const byId = new Map<string, string>();
  for (const p of profiles) {
    for (const f of stageFamilies(p, stage)) {
      if (!byId.has(f.familyId)) byId.set(f.familyId, f.familyLabel);
    }
  }
  return Array.from(byId.entries())
    .map(([familyId, familyLabel]) => ({ familyId, familyLabel }))
    .sort((a, b) => a.familyLabel.localeCompare(b.familyLabel));
}

export function stagesPresent(profile: AcademicSchoolProfile): KsStage[] {
  return (["ks2", "ks4", "ks5"] as KsStage[]).filter((s) => stageYears(profile, s).length > 0);
}

// KS2's real, live period range is 2022-2024 (dfe_ks2_attainment, confirmed against
// canonical_facts_current) -- genuinely doesn't reach back to 2021/22 the way the
// modern KS4/KS5 headline series does, so its trend baseline is honestly its own
// earliest real year, not a fabricated match to the other two stages.
export const TREND_BASELINE_PERIOD: Record<KsStage, number> = { ks2: 2022, ks4: 2021, ks5: 2021 };

// The single population age this stage's headline figure is about -- spec §3's own
// "circle size shows the number of N-year-olds" framing.
export const HEADLINE_AGE: Record<KsStage, number> = { ks2: 10, ks4: 15, ks5: 17 };

// Stage 2 UX review, item 1: "A-level" is genuinely inaccurate now that this stage
// covers Applied General/Tech Level/Technical Certificate/Academic(IB) too -- DfE's
// own publication for this whole dataset is literally titled "A level and other 16 to
// 18 results". One-line label change only; nothing downstream reads the string for
// logic (confirmed directly before changing it).
export const STAGE_LABEL: Record<KsStage, string> = { ks2: "KS2", ks4: "GCSE", ks5: "Post-16" };

// Headline measure key per stage -- real, ingested field names (confirmed directly
// against academic_headline_snapshot.measures / dfe_ks2_attainment breakdowns, not
// guessed). KS5 measures are cohort-prefixed ("A level::aps_per_entry" etc, per the RPC
// bridge round's own cohort-dropping bug fix) -- "A level" specifically, matching the
// summary-wordings doc's own "A-level students achieved..." framing, not blended across
// Academic/Applied general/Tech level/Technical certificate cohorts.
export const HEADLINE_MEASURE: Record<KsStage, string> = {
  ks2: "Reading, writing and maths::expected_standard_pupil_percent",
  ks4: "attainment8_average",
  ks5: "A level::aps_per_entry",
};

export const HEADLINE_LABEL: Record<KsStage, string> = {
  ks2: "meeting the expected standard in reading, writing and maths",
  ks4: "Attainment 8 average score",
  ks5: "average points per A-level entry",
};

export const HEADLINE_UNIT: Record<KsStage, "percent" | "points"> = { ks2: "percent", ks4: "points", ks5: "points" };

// Round 3 (Academic Map edit 2), A1: real per-school candidate/entries figures,
// decided directly with Guy -- GCSE and Post-16 now use real DfE entries counts for
// the map's circle size and popup label (dfe_ks4_headline.py's own new pupil_count,
// dfe_ks5_headline.py's own new end1618_student_count/aps_per_entry_student_count);
// KS2 has no equivalent DfE figure at all (confirmed via that data set's own /meta
// response -- no cohort-size/pupil-count indicator exists there), so it stays on
// real roll population (populationAtAge), completely unchanged.
const ENTRIES_MEASURE_KS4 = "pupil_count";
// Whole-institution Post-16 figure -- identical across every real exam_cohort row for
// a school/period, landed WITHOUT a cohort prefix in the ingest (see
// dfe_ks5_headline.py's own _WHOLE_INSTITUTION_COLUMNS comment) -- the real value
// used whenever no specific cohort is selected (the map's own round-2 default,
// per-school-own-cohort state).
const ENTRIES_MEASURE_KS5_WHOLE_INSTITUTION = "end1618_student_count";

// Real per-(school, period) entries/candidate count. `ks5Cohort`: null means the
// whole-institution total (the default, no-cohort-selected state); a SPECIFIC cohort
// means that cohort's own real entries count (aps_per_entry_student_count) instead of
// the whole-institution total -- a cohort-specific view showing the whole-institution
// figure would overstate that one cohort's own real size, per this round's own
// explicit instruction. null for KS2 (no real DfE figure exists) or for a genuinely
// missing/suppressed real value -- same honest-absence convention as every other
// headlineValueAt call in this module, never a fabricated fallback.
export function entriesCountAt(profile: AcademicSchoolProfile, stage: KsStage, period: number, ks5Cohort: Ks5Cohort | null): number | null {
  if (stage === "ks4") return headlineValueAt(profile.ks4, period, ENTRIES_MEASURE_KS4);
  if (stage === "ks5") {
    const key = ks5Cohort ? `${ks5Cohort}::aps_per_entry_student_count` : ENTRIES_MEASURE_KS5_WHOLE_INSTITUTION;
    return headlineValueAt(profile.ks5, period, key);
  }
  return null;
}

// A4's own real requirement: "a real date on every quoted figure -- the latest real
// ingest year... don't hardcode a global 'latest year'." Guy's own KS4 worked example
// shows entries at 2025/6 but the headline figure at 2024/5 -- the two stats' own
// real latest years genuinely differ (DfE's own real publishing cadence: a school's
// entries/candidate count for the newest year can land before that year's full
// results do), so "latest" must be resolved PER MEASURE, walking backward from the
// most recent year row to the first one that actually has a real value for THAT
// specific key -- not just `latestYear(years)`, which only finds the most recent row
// at all, regardless of which measures within it are actually populated.
export function latestMeasureAt(years: AcademicHeadlineYear[], key: string): { period: number; value: number } | null {
  for (let i = years.length - 1; i >= 0; i--) {
    const value = headlineValueAt(years, years[i].period, key);
    if (value !== null) return { period: years[i].period, value };
  }
  return null;
}

// Convenience wrapper over latestMeasureAt for the entries/candidate count
// specifically -- the map/popup's own "this school's own real latest entries figure,
// with its own real year" (A4), not a second, independently-derived lookup.
export function latestEntriesCount(profile: AcademicSchoolProfile, stage: KsStage, ks5Cohort: Ks5Cohort | null): { period: number; value: number } | null {
  if (stage === "ks4") return latestMeasureAt(profile.ks4, ENTRIES_MEASURE_KS4);
  if (stage === "ks5") {
    const key = ks5Cohort ? `${ks5Cohort}::aps_per_entry_student_count` : ENTRIES_MEASURE_KS5_WHOLE_INSTITUTION;
    return latestMeasureAt(profile.ks5, key);
  }
  return null;
}

// Real per-school entries series, ascending by period -- Part B, Section 1's own
// "candidate numbers since the start of the real series" trend line. GCSE/Post-16
// only: KS2 has no equivalent multi-year series on this profile shape at all
// (`ageGenderCounts` is a single CURRENT-period snapshot, not a per-year history --
// see fetchAcademicProfiles' own comment) -- Section 1's own KS2 panel uses the
// single real current populationAtAge figure instead, not a second, new multi-year
// population fetch, per that section's own explicit "same source the map now uses,
// not a second computation" instruction.
export function entriesSeries(profile: AcademicSchoolProfile, stage: KsStage, ks5Cohort: Ks5Cohort | null): { period: number; value: number }[] {
  if (stage === "ks2") return [];
  return stageYears(profile, stage)
    .map((y) => ({ period: y.period, value: entriesCountAt(profile, stage, y.period, ks5Cohort) }))
    .filter((r): r is { period: number; value: number } => r.value !== null);
}

// A4/Part C's own shared SHORT trend descriptor, per stage -- both the Map's own
// trend popup and Rankings' new Trend tile use this exact wording (A4's own KS2
// worked example, "Decline -25pp in % pupils meeting expected KS2 since 2022/3", is
// quoted verbatim as Part C's own Trend-tile example too), so it lives here once
// rather than as a Map-only local copy Rankings would otherwise have to duplicate.
// Deliberately SHORTER/more natural than the existing HEADLINE_LABEL/ks5HeadlineLabel
// wording used elsewhere (Rankings' own "Latest results" tile and Graphs' captions
// still use those, unchanged, per Part C's own "Latest results" example) -- this is
// the trend-sentence's own real copy, not a global rename.
export const TREND_STAT_LABEL: Record<KsStage, string> = {
  ks2: "% pupils meeting expected KS2",
  ks4: "Attainment 8",
  ks5: "average UCAS points",
};

// A4/Part C's own shared "trend magnitude" rule, named explicitly: percent-UNIT
// measures (KS2 only, HEADLINE_UNIT.ks2 === "percent") show a raw percentage-POINT
// difference ("pp") -- current minus anchor, not a relative change, matching Guy's
// own worked example ("Decline -25pp in % pupils meeting expected KS2 since 2022/3").
// points-unit measures (GCSE Attainment 8, Post-16 UCAS points) show the EXISTING
// relative percentage change trendBadge() already computes everywhere else in this
// codebase ("Decline -15% change in Attainment 8 since 2021/2") -- a genuinely
// different real quantity from a raw point difference, not the same number relabelled.
// One shared function so the Map's popups (A4) and Rankings' Trend tile (Part C) can
// never silently disagree about which of the two a given stage gets.
export function trendMagnitudeFor(stage: KsStage, current: number | null, anchor: number | null): { value: number; unit: "pp" | "%" } | null {
  if (current === null || anchor === null) return null;
  if (HEADLINE_UNIT[stage] === "percent") return { value: current - anchor, unit: "pp" };
  if (anchor === 0) return null;
  return { value: ((current - anchor) / anchor) * 100, unit: "%" };
}

// Map colour bug round, item 4: the ONE shared place that decides which wording
// system applies AND computes it -- the Map's own trend popup and Rankings' Trend
// tile both call this rather than each re-deciding pp-vs-ratio for itself, so they
// can't drift. `trendMagnitudeFor`'s own unit is the real signal: "pp" (percent-unit
// stages only, KS2's headline trend today) reads off the new absolute 7-tier scheme
// (trend-labels.ts's classifyPpTrend/PP_TREND_LABELS) keyed on the SAME magnitude
// value being displayed, so the word and the number can never disagree again; "%"
// (points-unit stages, GCSE/Post-16) is untouched -- still trendBadge()'s own
// ratio-based direction/TREND_LABELS noun, confirmed the right call for those (no
// natural "point" unit exists for a points-scale measure the way there is for a
// percent one). Returns null when there's no real comparison to make (either
// function's own honest-absence rule), same as before.
export function trendWordingFor(stage: KsStage, current: number | null, anchor: number | null): { label: string; magnitude: { value: number; unit: "pp" | "%" } } | null {
  const magnitude = trendMagnitudeFor(stage, current, anchor);
  if (!magnitude) return null;
  if (magnitude.unit === "pp") {
    return { label: PP_TREND_LABELS[classifyPpTrend(magnitude.value)], magnitude };
  }
  const badge = trendBadge(current, anchor);
  if (!badge) return null;
  return { label: TREND_LABELS[badge.direction].noun, magnitude };
}

// KS5 qualification-type-awareness round: the real exam_cohort names DfE publishes at
// KS5 headline level, confirmed directly against dfe_ks5_headline.py's own docstring
// and real ingested data -- deliberately excludes "E/M measures" (confirmed directly:
// 0 real rows anywhere in this project's own local data ever carry a real
// aps_per_entry_student_count for it -- it's a maths/English-progress pupil-
// characteristic indicator, not a genuine qualification-type cohort with its own
// entries, so it's never a real candidate for "which cohort has the most entries").
export const KS5_COHORTS = ["Academic", "A level", "Applied general", "Tech level", "Technical certificate"] as const;
export type Ks5Cohort = (typeof KS5_COHORTS)[number];

// Display casing for each real DfE cohort string -- DfE's own raw values are
// inconsistently cased ("Applied general", not "Applied General"); these match the
// brief's own real examples ("Capital City College's Applied General students...").
export const KS5_COHORT_DISPLAY_LABEL: Record<Ks5Cohort, string> = {
  "Academic": "Academic",
  "A level": "A-level",
  "Applied general": "Applied General",
  "Tech level": "Tech Level",
  "Technical certificate": "Technical Certificate",
};

export function ks5HeadlineMeasureKey(cohort: Ks5Cohort): string {
  return `${cohort}::aps_per_entry`;
}

// `hasIb` only matters for the "Academic" cohort -- every other cohort's real DfE
// name is already honest and unambiguous on its own. Callers comparing a GROUP on
// "Academic" (Part 4's selector) can always pass true: Part 2's real IB flag already
// restricts that comparison to confirmed-IB schools only, so "Academic" selected as a
// group measure is definitionally IB-style. Callers describing one TARGET school's
// own real dominant cohort (Part 3) must pass that school's own real flag instead --
// a school can genuinely have Academic as its dominant cohort without any confirmed
// IB entries (Pre-U/EPQ/Core-Maths, or an Academic count that simply matches its own
// A-level count).
export function ks5HeadlineLabel(cohort: Ks5Cohort, hasIb: boolean = true): string {
  if (cohort !== "Academic") return `average points per ${KS5_COHORT_DISPLAY_LABEL[cohort]} entry`;
  return hasIb ? "average points per A-level and International Baccalaureate entry" : "average points per A-level and other academic entry";
}

// Part 3: for a SINGLE school with no group comparison involved (free card, paid
// Overview's own headline number), auto-detect which real cohort actually has the
// most entries for this school's latest KS5 year -- the real fix for the reported bug
// (Capital City College showing only its A-level figure, 842 entries, when its real
// dominant cohort by entries is Applied General at 1,083). Returns null if the school
// has no real per-cohort entries-count data at all (pre-ingest gap years, or genuinely
// no KS5 provision).
export function dominantKs5Cohort(profile: AcademicSchoolProfile): Ks5Cohort | null {
  const y = latestYear(profile.ks5);
  if (!y) return null;
  let best: Ks5Cohort | null = null;
  let bestCount = -Infinity;
  for (const cohort of KS5_COHORTS) {
    const count = headlineValueAt(profile.ks5, y.period, `${cohort}::aps_per_entry_student_count`);
    if (count !== null && count > bestCount) {
      bestCount = count;
      best = cohort;
    }
  }
  return best;
}

// Part 4: does this school have real, usable data in the given cohort for a GROUP
// comparison -- "Academic" specifically also requires Part 2's real, ground-truth IB
// flag (the brief's own explicit restriction: a school whose Academic entries are
// genuinely all Pre-U/EPQ/Core-Maths, or whose Academic count simply matches its own
// A-level count, should not be silently included in an "IB-style" comparison as if it
// were a real IB provider).
export function ks5HasCohortEntries(profile: AcademicSchoolProfile, cohort: Ks5Cohort): boolean {
  const y = latestYear(profile.ks5);
  if (!y) return false;
  if (cohort === "Academic" && !profile.ks5QualTypes.ib) return false;
  return headlineValueAt(profile.ks5, y.period, ks5HeadlineMeasureKey(cohort)) !== null;
}

// Stage 2 UX review, item 10: real bug found via Acland Burghley (dominant cohort
// "Academic" at 111 entries vs A-level's 102, but has_ib false) -- auto-defaulting
// the group-comparison selector to a target's own dominant cohort made the UI read
// as "IB selected by default" for a school running no real IB at all (KS5_COHORT_
// OPTIONS' "Academic" pill is unconditionally labelled "Academic (IB)"). Fix is
// removing the forced default entirely, not a smarter label: with nothing
// explicitly clicked (`selected === null`), every school in the comparator set is
// measured on ITS OWN real dominant cohort rather than one shared axis -- this
// helper is the single place that resolves "selected cohort, or this profile's own
// real default" for every caller (Rankings/spread/growth/trend/Map all need it).
export function ks5MeasureFor(profile: AcademicSchoolProfile, selected: Ks5Cohort | null): { cohort: Ks5Cohort; measureKey: string } {
  const cohort = selected ?? dominantKs5Cohort(profile) ?? "A level";
  return { cohort, measureKey: ks5HeadlineMeasureKey(cohort) };
}

// The qualification-type selector's real options (Part 4) -- no separate Pre-U option
// (only 4 real schools nationally, not a viable comparator population, per the
// brief's own "what NOT to build" section). "Academic" here always means the
// IB-restricted version -- the brief presents it as one single option for an
// "IB-style" comparison, not a separate unrestricted "raw Academic" mode.
export const KS5_COHORT_OPTIONS: { cohort: Ks5Cohort; pillLabel: string; description: string }[] = [
  { cohort: "A level", pillLabel: "A-level", description: "The default view -- today's A-level-only comparison, unchanged." },
  {
    cohort: "Academic",
    pillLabel: "Academic (IB)",
    description:
      "Academic — A-level plus International Baccalaureate (DfE's own combined reporting category; restricted here to schools with confirmed IB entries).",
  },
  { cohort: "Applied general", pillLabel: "Applied General", description: "BTEC-type qualifications, DfE's own \"Applied general\" cohort." },
  { cohort: "Tech level", pillLabel: "Tech Level", description: "DfE's own \"Tech level\" cohort." },
  { cohort: "Technical certificate", pillLabel: "Technical Certificate", description: "DfE's own \"Technical certificate\" cohort." },
];

// Grade-band ("higher bar") threshold field per stage, for the map's grade-band colour
// mode (spec §3, §9). KS4 judgement call: two real baskets exist in the ingested data
// (English & Maths 9-4/9-5, and EBacc 9-4/9-5) -- English & Maths is picked as the
// default here because it's the more universally-cited "5 in English and maths" GCSE
// headline figure in DfE's own performance-tables press framing, not because EBacc is
// wrong; see the build report for the full reasoning. Not exposed as a third UI
// dimension this round (spec §9's own open question) -- flagged, not built, given how
// much else this round already covers.
export const GRADE_BAND_MEASURE: Record<KsStage, string> = {
  ks2: "Reading, writing and maths::higher_standard_pupil_percent",
  ks4: "engmath_94_percent",
  ks5: "A level::aab_percent",
};

export const GRADE_BAND_LABEL: Record<KsStage, string> = {
  ks2: "the higher standard",
  ks4: "grade 9–5 in English and maths",
  ks5: "AAB or higher",
};

// Round 2, Part C judgement call: minimum-N threshold for the subject-level table's
// small-cohort caveat (topic spec §6/§9, open since the very first brief). Grounded in
// the REAL national distribution of subject-level entry counts (checked directly, not
// picked as a round number) -- one real school/period/subject row per data point,
// "Total exam entries"/"Total" rows only, "All subjects" pseudo-rows excluded, most
// recent real period per source:
//   dfe_ks4_subject_entries (n=102,948 real rows): 17.6% have fewer than 5 entries,
//     24.4% fewer than 10, median 27.
//   dfe_ks5_subject_results (n=79,621 real rows): 32.0% have fewer than 5 entries,
//     54.9% fewer than 10 -- A-level cohorts are genuinely much smaller than GCSE ones;
//     a threshold of 10 would suppress the MAJORITY of real KS5 subject rows, which
//     stops being a "small-cohort caveat" and becomes "hide most A-level subjects."
// 5 is picked because: it only flags a real minority even at KS5 (32%, not 55%+),
// it matches the well-established convention already used throughout UK education
// statistics for "too few pupils to be statistically meaningful" (distinct from DfE's
// own separate disclosure-risk suppression, which already runs on the raw published
// figures before they ever reach this ingest -- this bar is about noise, not privacy),
// and it's concretely below every real example this topic's own summary-wordings doc
// cites as obviously too few ("[3] students took this subject").
export const MINIMUM_SUBJECT_N = 5;

function numericMeasure(year: AcademicHeadlineYear | undefined, key: string): number | null {
  const v = year?.measures[key];
  return typeof v === "number" ? v : null;
}

export function headlineValueAt(years: AcademicHeadlineYear[], period: number, key: string): number | null {
  return numericMeasure(years.find((y) => y.period === period), key);
}

export function latestYear(years: AcademicHeadlineYear[]): AcademicHeadlineYear | null {
  return years.length ? years[years.length - 1] : null;
}

// GCSE exclusion round -- simplified from the stage-1 review's own original trigger
// after Guy asked directly whether "just Eng+Maths" would work as the gate. Checked
// against real data for six real independent schools before answering: Crosfields
// (URN 110155) has real, substantial engmath_94_percent (95.8-100%) and a normal
// Attainment 8 (60-70) -- genuinely comparable GCSE data. Leighton Park, Wellington
// College, Sevenoaks, Charterhouse, and King's College School Wimbledon all show
// engmath_94_percent at exactly 0% every year. The ebacc_94_percent check from the
// original trigger is dropped -- EBacc's own definition requires English+Maths among
// its components, so ebacc_94_percent is 0 in every real case where engmath_94_percent
// is 0 anyway; checking both was redundant. None of the six have Progress 8 published
// at all (confirmed directly), so Progress 8 presence/absence isn't a usable signal
// here either way.
//
// The establishment_type_group === "Independent schools" restriction was NOT in
// Guy's own original framing -- flagged to him directly and confirmed, since a real
// state comprehensive hitting exactly 0% on Eng+Maths in a given year would mean
// genuinely disastrous results, not an IGCSE curriculum, and shouldn't silently
// vanish from GCSE rankings as if its data weren't real.
export function igcseExclusionLikely(profile: AcademicSchoolProfile): boolean {
  if (profile.establishmentTypeGroup !== "Independent schools") return false;
  const y = latestYear(profile.ks4);
  if (!y) return false;
  const engmath94 = headlineValueAt(profile.ks4, y.period, "engmath_94_percent");
  const attainment8 = headlineValueAt(profile.ks4, y.period, "attainment8_average");
  return engmath94 === 0 && attainment8 !== null && attainment8 > 5;
}

// GCSE exclusion round, Part 2 -- the three real note shapes from vicdata's own
// summary-wordings doc §11, copied verbatim (not redrafted, per the brief's own
// instruction). Kept as functions rather than flat constants since each shape takes a
// real school name/list, not a placeholder.

// The school being viewed is itself excluded -- free snapshot card's GCSE line, Data
// View Overview (in place of the headline number), Rankings (in place of a rank).
// `seeResultsBelow` is true only where an A-level line/section genuinely renders
// further down the SAME view (the free card, when this school also has real KS5
// data) -- everywhere else (Overview/Rankings, a stage tab switch rather than a
// scroll) reads "instead", not "below".
export function ks4ExclusionTargetSentence(schoolName: string, seeResultsBelow: boolean): string {
  return `${schoolName}'s GCSE figures aren't comparable to other schools' — DfE's performance tables exclude IGCSEs, which many independent schools use instead of reformed GCSEs. See its A-level results ${seeResultsBelow ? "below" : "instead"}.`;
}

// One or more ticked (non-target) comparator-set schools are excluded -- singular vs.
// plural wording exactly as drafted in §11. Returns null when nothing is excluded so
// callers can render conditionally without a separate length check.
export function ks4ExclusionGroupNote(excludedNames: string[]): string | null {
  if (excludedNames.length === 0) return null;
  if (excludedNames.length === 1) {
    const name = excludedNames[0];
    return `${name} isn't shown in this GCSE comparison — DfE's performance tables exclude IGCSEs, which ${name} uses instead of reformed GCSEs.`;
  }
  return `${excludedNames.length} schools aren't shown in this GCSE comparison — ${excludedNames.join(", ")}: DfE's performance tables exclude IGCSEs, which these schools use instead of reformed GCSEs.`;
}

// The whole comparator group ends up excluded (a set made up entirely of IGCSE-heavy
// independents) -- avoids rendering an empty/broken group-comparison chart.
export function ks4ExclusionWholeGroupSentence(setLabel: string): string {
  return `None of the schools in ${setLabel} have comparable GCSE figures to show here — try A-level, or a different comparator set.`;
}

// KS5 qualification-type-awareness round, Part 4 -- same real "leave incomparable
// schools out, with a visible note" pattern as the GCSE exclusion round (§11's own
// list-and-reason shape, generalised here to any selected cohort rather than
// hardcoded to IGCSE/GCSE). The IB case gets its own real wording from summary-
// wordings doc §13 (matches what the brief itself quotes verbatim); every other
// cohort uses the generic "no real entries" phrasing -- also drafted for §13, since
// the brief only gave exact text for the IB case and the whole-group-empty case.
export function ks5CohortExclusionNote(excludedNames: string[], cohort: Ks5Cohort): string | null {
  if (excludedNames.length === 0) return null;
  const comparisonLabel = cohort === "Academic" ? "International Baccalaureate" : KS5_COHORT_DISPLAY_LABEL[cohort];
  const entriesLabel = cohort === "Academic" ? "confirmed IB entries" : `real ${KS5_COHORT_DISPLAY_LABEL[cohort]} entries`;
  if (excludedNames.length === 1) {
    return `${excludedNames[0]} isn't shown in this ${comparisonLabel} comparison — it has no ${entriesLabel} recorded.`;
  }
  return `${excludedNames.length} schools aren't shown in this ${comparisonLabel} comparison — ${excludedNames.join(", ")}: none have ${entriesLabel} recorded.`;
}

export function ks5CohortWholeGroupSentence(setLabel: string, cohort: Ks5Cohort): string {
  const comparisonLabel = cohort === "Academic" ? "International Baccalaureate" : KS5_COHORT_DISPLAY_LABEL[cohort];
  return `None of the schools in ${setLabel} have entries in ${comparisonLabel} to show here — try a different qualification type.`;
}

// Part 3's single-school headline sentence -- cohort-aware, replacing the old
// hardcoded "A-level students achieved..." for every school regardless of its real
// dominant cohort. The Academic-dominant case needs real judgement, not mechanical
// substitution (flagged directly in the brief): when Part 2's real IB flag confirms
// genuine IB entries, name it specifically; when the dominant cohort is Academic but
// the school has NO confirmed IB entries (its extra entries beyond A-level are real,
// but are Pre-U/Extended Project/Core Maths, not IB, or its Academic/A-level counts
// simply match), naming "International Baccalaureate" would be a real, false claim --
// worded generically instead ("A-level and other academic students"), never claiming
// a specific qualification the data doesn't confirm.
export function ks5HeadlineSentence(schoolName: string, cohort: Ks5Cohort, hasIb: boolean, value: number, period: number): string {
  const subject =
    cohort !== "Academic"
      ? `${KS5_COHORT_DISPLAY_LABEL[cohort]} students`
      : hasIb
        ? "A-level and International Baccalaureate students"
        : "A-level and other academic students";
  // Same "YYYY/YY" academic-year formatting every caller of this module's own
  // headline sentences already uses (AcademicSnapshotCard's own academicYear, this
  // repo's TrendPill.tsx academicYearLabel) -- a small, self-contained duplicate
  // rather than importing a component-layer helper into this data-layer module.
  const yearLabel = `${period}/${String(period + 1).slice(2)}`;
  return `${schoolName}'s ${subject} achieved an average of ${value.toFixed(1)} points per entry in ${yearLabel}.`;
}

// dfe_ks2_attainment raw facts -> the same {period, measures} shape modern KS4/KS5
// headline rows already have, so every downstream helper above works identically
// across all three stages rather than branching on KS2 specifically everywhere it's
// used. Suppressed/non-numeric cells (value_numeric null) are simply omitted, same
// "absence isn't a real zero" convention the rest of this codebase already uses.
function groupKs2Facts(
  facts: { entity_id: string; period: number; breakdown: string; value_numeric: number | null }[],
): Map<string, AcademicHeadlineYear[]> {
  const byUrn = new Map<string, Map<number, Record<string, number | string>>>();
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    let periods = byUrn.get(f.entity_id);
    if (!periods) {
      periods = new Map();
      byUrn.set(f.entity_id, periods);
    }
    let measures = periods.get(f.period);
    if (!measures) {
      measures = {};
      periods.set(f.period, measures);
    }
    measures[f.breakdown] = f.value_numeric;
  }
  const result = new Map<string, AcademicHeadlineYear[]>();
  for (const [urn, periods] of byUrn) {
    result.set(
      urn,
      Array.from(periods.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([period, measures]) => ({ period, measures })),
    );
  }
  return result;
}

function groupHeadlineRows(rows: { entity_id: string; period: number; measures: Record<string, number | string> }[]): Map<string, AcademicHeadlineYear[]> {
  const byUrn = new Map<string, AcademicHeadlineYear[]>();
  for (const r of rows) {
    const existing = byUrn.get(r.entity_id);
    const year = { period: r.period, measures: r.measures };
    if (existing) existing.push(year);
    else byUrn.set(r.entity_id, [year]);
  }
  for (const years of byUrn.values()) years.sort((a, b) => a.period - b.period);
  return byUrn;
}

function groupFamilyRows(
  rows: { entity_id: string; family_id: string; family_label: string; period: number; entries_total: number; entries_share_percent: number | null; avg_point_score: number | null; points_coverage_percent: number | null }[],
): Map<string, AcademicFamilyYear[]> {
  const byUrn = new Map<string, AcademicFamilyYear[]>();
  for (const r of rows) {
    const year: AcademicFamilyYear = {
      familyId: r.family_id,
      familyLabel: r.family_label,
      period: r.period,
      entriesTotal: r.entries_total,
      entriesSharePercent: r.entries_share_percent,
      avgPointScore: r.avg_point_score,
      pointsCoveragePercent: r.points_coverage_percent,
    };
    const existing = byUrn.get(r.entity_id);
    if (existing) existing.push(year);
    else byUrn.set(r.entity_id, [year]);
  }
  return byUrn;
}

type SchoolRow = { urn: string; current_name: string; town: string | null; easting: number | null; northing: number | null; establishment_type_group: string | null };

// Builds one profile per URN, server-side only (calls vicdata's RPCs with the anon
// key, plus a local `schools` lookup for name/coordinates) -- same shape as
// fetchDataViewProfiles in data-view-profiles.ts, parallel rather than reused since
// the underlying data (academic vs roll/gender/shape) is entirely different. Returns
// profiles in the same order as the input where possible; a URN with no real `schools`
// row is omitted (same "fewer than requested is honest" convention as that function).
//
// Round 2, Part A: `includePopulation` (default true, so the Data View's own call
// sites are unchanged) -- real, confirmed inefficiency from round 1's own review: the
// free "Academic snapshot" card (this module's other real caller, page.tsx) never
// reads `ageGenderCounts` at all (it derives its own separate age-gender breakdown
// straight from the census facts it already fetches for Roll/Shape elsewhere on that
// page -- confirmed by reading page.tsx directly, not assumed), so the free page --
// the highest-traffic page on the site -- was paying for a second real network
// round-trip to vicdata (fetchCensusFactsBatched) for a field nothing on that page
// path ever consumes. `false` skips that fetch entirely and returns an empty Map.
export async function fetchAcademicProfiles(urns: string[], options?: { includePopulation?: boolean }): Promise<AcademicSchoolProfile[]> {
  if (urns.length === 0) return [];
  const includePopulation = options?.includePopulation ?? true;
  const supabase = createServerAnonSupabaseClient();

  const [{ data: rows }, ks4Rows, ks5Rows, ks4FamilyRows, ks5FamilyRows, ks2Facts, censusFacts, ks5QualFlagRows] = await Promise.all([
    supabase.from("schools").select("urn, current_name, town, easting, northing, establishment_type_group").in("urn", urns),
    lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4" as AcademicRpcKsStage }),
    lookupAcademicHeadline({ entityIds: urns, ksStage: "ks5" as AcademicRpcKsStage }),
    lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks4" as AcademicRpcKsStage }),
    lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks5" as AcademicRpcKsStage }),
    lookupReferenceData({ sourceId: "dfe_ks2_attainment", entityIds: urns }),
    includePopulation ? fetchCensusFactsBatched(urns, { breakdowns: CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS }) : Promise.resolve([]),
    lookupAcademicKs5QualificationFlags({ entityIds: urns }),
  ]);

  const ks5QualTypesByUrn = new Map<string, Ks5QualTypes>(
    ks5QualFlagRows.map((r) => [r.entity_id, { ib: r.has_ib, preU: r.has_pre_u }]),
  );

  const censusFactsByUrn = new Map<string, typeof censusFacts>();
  for (const f of censusFacts) {
    const existing = censusFactsByUrn.get(f.entity_id);
    if (existing) existing.push(f);
    else censusFactsByUrn.set(f.entity_id, [f]);
  }
  function currentAgeGenderCounts(urn: string): AgeGenderCounts {
    if (!includePopulation) return new Map();
    const facts = censusFactsByUrn.get(urn) ?? [];
    const latestPeriod = facts.reduce((max, f) => Math.max(max, f.period), -Infinity);
    return Number.isFinite(latestPeriod) ? singleAgeGenderCountsForPeriod(facts, latestPeriod) : new Map();
  }

  const schoolRows = (rows ?? []) as SchoolRow[];
  const ks4ByUrn = groupHeadlineRows(ks4Rows);
  const ks5ByUrn = groupHeadlineRows(ks5Rows);
  const ks4FamilyByUrn = groupFamilyRows(ks4FamilyRows.map((r) => ({ entity_id: r.entity_id, family_id: r.family_id, family_label: r.family_label, period: r.period, entries_total: r.entries_total, entries_share_percent: r.entries_share_percent, avg_point_score: r.avg_point_score, points_coverage_percent: r.points_coverage_percent })));
  const ks5FamilyByUrn = groupFamilyRows(ks5FamilyRows.map((r) => ({ entity_id: r.entity_id, family_id: r.family_id, family_label: r.family_label, period: r.period, entries_total: r.entries_total, entries_share_percent: r.entries_share_percent, avg_point_score: r.avg_point_score, points_coverage_percent: r.points_coverage_percent })));
  const ks2ByUrn = groupKs2Facts(ks2Facts);

  return schoolRows.map((row) => ({
    urn: row.urn,
    name: row.current_name,
    town: row.town,
    easting: row.easting,
    northing: row.northing,
    establishmentTypeGroup: row.establishment_type_group,
    ks5QualTypes: ks5QualTypesByUrn.get(row.urn) ?? { ib: false, preU: false },
    ks2: ks2ByUrn.get(row.urn) ?? [],
    ks4: ks4ByUrn.get(row.urn) ?? [],
    ks5: ks5ByUrn.get(row.urn) ?? [],
    ks4Families: ks4FamilyByUrn.get(row.urn) ?? [],
    ks5Families: ks5FamilyByUrn.get(row.urn) ?? [],
    ageGenderCounts: currentAgeGenderCounts(row.urn),
  }));
}

// Wire shape for the /api/data-view/academic-schools route -- real bug caught by
// testing (2026-09-13): a plain `NextResponse.json({ profiles })` silently serialises
// a `Map` field to `{}` (JSON.stringify has no Map support at all), which would have
// made every real population count disappear over the API boundary with no error --
// the map would have drawn every circle at the same fallback radius. Same pattern
// data-view-serialize.ts already established for DataViewSchoolProfile's own Map
// fields (ageGenderCountsByPeriod etc) -- convert to a plain array of tuples for the
// wire, reconstruct the Map on the client.
export type WireAcademicSchoolProfile = Omit<AcademicSchoolProfile, "ageGenderCounts"> & {
  ageGenderCounts: [number, { male: number; female: number }][];
};

export function serializeAcademicProfile(profile: AcademicSchoolProfile): WireAcademicSchoolProfile {
  return { ...profile, ageGenderCounts: Array.from(profile.ageGenderCounts.entries()) };
}

export function deserializeAcademicProfile(wire: WireAcademicSchoolProfile): AcademicSchoolProfile {
  return { ...wire, ageGenderCounts: new Map(wire.ageGenderCounts) };
}

// Round 2, Part C: subject-level depth, one school at a time (spec §6's own table is
// a single-school view inside Overview, not a ticked-set comparison the way family
// level is) -- deliberately fetched separately from fetchAcademicProfiles/the main
// batch above, not folded into it, so this genuinely heavier per-subject data is only
// ever pulled for the one school whose table is actually showing, never for every
// ticked/added school in the comparator set.
//
// Real breakdown-string shapes, checked directly against the live ingested data before
// writing any of this (not assumed to match academic_subject_family_rollup's own
// "subject" shape, which is a single flat string):
//   dfe_ks4_subject_entries        "{qualification}::{subject}::{grade-or-total-label}"
//   dfe_ks5_subject_results        "{qualification}::{subject}::{size-weight}::{grade-or-total-label}"
//   dfe_ks5_subject_value_added    "{qualification}::{subject}::{size-weight}::{measure}"
// "Total"/"Total exam entries" never both appear for the same real (entity, period,
// qualification::subject[::size-weight]) row -- confirmed directly (zero rows with
// both labels for the same prefix) -- so either one, whichever is present, is safely
// the real entries count, not a source of double-counting. Scoped to MODERN sources
// only (2023/24 on) -- the _historic siblings use a genuinely different, additionally
// ambiguous label set ("Total number entered" also appears there) not investigated
// this round; see the round 2 report for why historic subject-level isn't built.
//
// NOT built here, a real and substantial gap, not an oversight: average grade/point
// score per subject. These raw sources give per-GRADE entry counts (e.g. "Level 2
// distinction": 14, "Merit": 9, "U": 2), not a pre-computed average -- turning that
// into a single average point-score figure needs the same GCSE_POINTS/ALEVEL_POINTS
// conversion tables and weighted-averaging logic vicdata's own
// ingest/academic_aggregates.py already built for the FAMILY rollup, which lives only
// in that repo's ingest pipeline, not exposed via any RPC this round's own brief asks
// for. Porting or re-deriving that conversion table inside vicdata_public would be a
// genuinely new piece of scoring logic with no real backend precedent to lean on here
// -- flagged rather than improvised.
const SUBJECT_TOTAL_LABELS = new Set(["Total exam entries", "Total"]);
const ALL_SUBJECTS_PSEUDO_ROW = "All subjects";

export type SubjectEntry = {
  qualificationType: string;
  subject: string;
  period: number;
  entries: number;
};

export type SubjectValueAdded = {
  qualificationType: string;
  subject: string;
  sizeWeight: string;
  period: number;
  entriesCount: number | null;
  valueAdded: number | null;
  valueAddedLowerCi: number | null;
  valueAddedUpperCi: number | null;
};

function parseSubjectEntries(facts: ReferenceFact[]): SubjectEntry[] {
  const rows: SubjectEntry[] = [];
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    const parts = f.breakdown.split("::");
    const label = parts[parts.length - 1];
    if (!SUBJECT_TOTAL_LABELS.has(label)) continue;
    const [qualificationType, subject] = parts;
    if (subject === ALL_SUBJECTS_PSEUDO_ROW) continue;
    rows.push({ qualificationType, subject, period: f.period, entries: f.value_numeric });
  }
  return rows;
}

function parseSubjectValueAdded(facts: ReferenceFact[]): SubjectValueAdded[] {
  const byKey = new Map<string, SubjectValueAdded>();
  for (const f of facts) {
    const parts = f.breakdown.split("::");
    if (parts.length !== 4) continue;
    const [qualificationType, subject, sizeWeight, measure] = parts;
    if (subject === ALL_SUBJECTS_PSEUDO_ROW) continue;
    const key = `${qualificationType}::${subject}::${sizeWeight}::${f.period}`;
    let row = byKey.get(key);
    if (!row) {
      row = { qualificationType, subject, sizeWeight, period: f.period, entriesCount: null, valueAdded: null, valueAddedLowerCi: null, valueAddedUpperCi: null };
      byKey.set(key, row);
    }
    if (f.value_numeric === null) continue;
    if (measure === "entries_count") row.entriesCount = f.value_numeric;
    else if (measure === "value_added") row.valueAdded = f.value_numeric;
    else if (measure === "value_added_lower_ci") row.valueAddedLowerCi = f.value_numeric;
    else if (measure === "value_added_upper_ci") row.valueAddedUpperCi = f.value_numeric;
  }
  return Array.from(byKey.values());
}

export async function fetchSubjectLevelData(urn: string, stage: KsStage): Promise<{ entries: SubjectEntry[]; valueAdded: SubjectValueAdded[] }> {
  if (stage === "ks2") return { entries: [], valueAdded: [] };
  const sourceId = stage === "ks4" ? "dfe_ks4_subject_entries" : "dfe_ks5_subject_results";
  const [rawFacts, vaFacts] = await Promise.all([
    lookupReferenceData({ sourceId, entityIds: [urn] }),
    stage === "ks5" ? lookupReferenceData({ sourceId: "dfe_ks5_subject_value_added", entityIds: [urn] }) : Promise.resolve([]),
  ]);
  return { entries: parseSubjectEntries(rawFacts), valueAdded: parseSubjectValueAdded(vaFacts) };
}
