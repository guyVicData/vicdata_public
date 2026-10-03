// Layer 2: measures -- what is counted, where, with which honest number types (catalogue
// doc §2.2, §3). Seeded from S0 audit B §1.
//
// Every academic, census and births figure lives in vicdata-production and is read over
// HTTP through src/lib/vicdata-reference.ts; no measure has a single fetch function yet
// (audit B §0, §2), so `fetchedBy` lists every route that reaches it. Years are academic
// years (period N = N/N+1) except births (calendar years) and rolls (January census).
import type { Geography, GeographyAvailability, Measure } from "./types";

// SOURCE_NAME from src/lib/teacher-view-theme.ts, copied rather than imported: that module
// pulls in a client component (SubjectAreaSection), and the catalogue must load in plain
// scripts. scripts/catalogue-unit-tests.ts asserts the two agree.
export const ACADEMIC_CITATION = {
  ks4: "DfE Key stage 4 performance",
  ks5: "DfE A level and other 16 to 18 results",
} as const;
const SOURCE_NAME = ACADEMIC_CITATION;

const ok = (reason?: string): GeographyAvailability => (reason ? { ok: true, reason } : { ok: true });
const no = (reason: string): GeographyAvailability => ({ ok: false, reason });

const GCSE_BRIEFING = "/Users/guy/dev/vicdata/docs/vicdata_briefing_gcse_what_is_measured_v2.md (sibling repo)";
const POST16_BRIEFING = "/Users/guy/dev/vicdata/docs/vicdata_briefing_post16_what_is_measured_v2.md (sibling repo)";

const DASHBOARD_ROUTE = "src/app/api/teacher/dashboard/route.ts";
const SUBJECT_LEVEL = "src/lib/academic-data-view.ts:fetchSubjectLevelDataForSchools";
const SUBJECT_HEADLINE = "src/lib/academic-data-view.ts:fetchSubjectHeadlineForSchools";
const SUBJECT_QUAL_HEADLINE = "src/lib/academic-data-view.ts:fetchSubjectQualificationHeadlineForSchools";
const PROFILES = "src/app/api/data-view/academic-schools/route.ts -> src/lib/academic-data-view.ts:fetchAcademicProfiles";
const SUBJECT_GEO = "src/app/api/teacher/subject-geography/route.ts";
const GRADE_GEO = "src/app/api/teacher/subject-grade-geography/route.ts (src/lib/teacher-view-grade-geography.ts)";
const COMPARATOR_GRADES = "src/app/api/teacher/comparator-grades/route.ts (src/lib/teacher-view-comparator-grades.ts)";

function geos(g: Record<Geography, GeographyAvailability>) {
  return g;
}

// The grade-grain measures share one shape per phase: Grade 4+ / A*-E, bands, counts.
function gradeMeasures(phase: "ks4" | "ks5"): Measure[] {
  const ks4 = phase === "ks4";
  const P = ks4 ? "KS4" : "KS5";
  const base = {
    data: "academic.results" as const,
    phase,
    grain: ks4
      ? "School × subject × qualification type × grade × year"
      : "School × subject × qualification type × size × grade × year",
    sources: ks4 ? ["dfe_ks4_subject_entries"] : ["dfe_ks5_subject_results", "dfe_tlevel_results"],
    years: {
      from: "2023/24",
      to: "2024/25",
      note: `School grade rows from raw modern facts only (academic-data-view.ts:parseSubjectGradeDistribution). academic_subject_grade_rollup holds 2021/22-2024/25 for ${ks4 ? "4,864 KS4" : "2,893 KS5"} schools but the app never reads it. Area grade figures 2021/22-2024/25.`,
    },
    keying: "urn" as const,
    fetchedBy: [`${DASHBOARD_ROUTE} (subjectData.gradeDistribution via ${SUBJECT_LEVEL})`, COMPARATOR_GRADES, GRADE_GEO],
    briefing: ks4 ? GCSE_BRIEFING : POST16_BRIEFING,
    citation: SOURCE_NAME[phase],
  };
  const commonGaps = [
    "School years (2) are shorter than area years (4): the grade rollup is not read.",
    "comparator-grades pulls every subject and grade for the whole set, then filters to one subject (audit B §2).",
  ];
  const areaGrades = (what: string) => ({
    la: ok(`academic_subject_grade_geography_aggregate 2021-2024; every grade row needs 5 schools (R-MIN-SCHOOLS). ${what}`),
    region: ok("academic_subject_grade_geography_aggregate; min 5 schools per grade row"),
    england: ok("academic_subject_grade_geography_aggregate; min 5 schools per grade row (England not exempt at grade grain)"),
  });
  return [
    {
      ...base,
      id: `M-${P}-THRESHOLD` as const,
      name: ks4 ? "GCSE Grade 4+ rate" : "Post-16 A*-E rate",
      results: "threshold",
      definition: ks4
        ? "Share of a subject's graded entries at grades 9-4 (Double Award: both digits 4 or above), on the GCSE scale only (subject-grades.ts:thresholdRate)."
        : "Share of a subject's graded entries at A*-E, on the A-level scale only; IB, vocational and Pre-U rows get no figure (subject-grades.ts:thresholdRate).",
      geographies: geos({
        school: ok(),
        subject_area: ok("computed client-side over the category (page.tsx:1227-1237)"),
        set: ok("comparator-grades, scored per subject and exact qualification (R-COMPARATOR-RATE-PER-QUAL)"),
        la: no("Not wired: no area threshold benchmark in the UI (R-NO-GRADE-RATE-GEO), though grade geography would give it"),
        region: no("Not wired (R-NO-GRADE-RATE-GEO)"),
        england: no("Not wired (R-NO-GRADE-RATE-GEO)"),
      }),
      numberTypes: ["rate", "change_pp", "rank"],
      rules: ["R-GRADE-SCALE-MATCH", "R-NON-GRADES-EXCL", "R-THRESHOLD-PERIODS", "R-NO-GRADE-RATE-GEO", "R-FOCUS-NEVER-FILTERED", "R-COMPARATOR-RATE-PER-QUAL", "R-NUMBER-TYPE-HONESTY", "R-TREND-LINE-4YR", ...(ks4 ? [] : (["R-KS5-ASAEA-EXCL"] as const))],
      knownGaps: [
        ...commonGaps,
        `Change is shown in percentage points everywhere (S3b, R-NUMBER-TYPE-HONESTY: teacher-view-panels.ts changeKind "pp", changeOf, formatChange).`,
        "No area benchmark is wired although the grade geography would give one.",
      ],
    },
    {
      ...base,
      id: `M-${P}-BANDS` as const,
      name: ks4 ? "GCSE grade bands" : "Post-16 grade bands",
      results: "bands",
      definition: `Share of a subject's graded entries inside a chosen contiguous range on the subject's own scale (subject-grades.ts:bandRate).${ks4 ? " Presets 4-9 and 7-9 on GCSE 9-1; default 7-9." : " No presets: custom range only."}`,
      geographies: geos({
        school: ok(),
        subject_area: ok("computed client-side"),
        set: ok("comparator-grades"),
        ...areaGrades("Only the focused subject carries a benchmark (R-BANDS-ENGLAND-BENCH)."),
      }),
      numberTypes: ["rate", "change_pp", "totals", "market_share", "rank"],
      rules: ["R-GRADE-SCALE-MATCH", "R-NON-GRADES-EXCL", "R-THRESHOLD-PERIODS", "R-BANDS-ENGLAND-BENCH", "R-DONUT-COUNTS-ONLY", "R-MIN-SCHOOLS", "R-FOCUS-NEVER-FILTERED", "R-COMPARATOR-RATE-PER-QUAL", "R-NUMBER-TYPE-HONESTY", ...(ks4 ? [] : (["R-KS5-ASAEA-EXCL"] as const))],
      knownGaps: [...commonGaps, "Trend of bands: Results Trends draws it, but only over the 2 school years."],
    },
    {
      ...base,
      id: `M-${P}-COUNTS` as const,
      name: ks4 ? "GCSE grade counts" : "Post-16 grade counts",
      results: "counts",
      definition: "Entries at each grade for one subject × qualification, and each grade's share of graded entries.",
      geographies: geos({
        school: ok(),
        subject_area: no("Grade counts are per subject; a category has no single grade scale"),
        set: no("No comparator grade-count view; Comparisons falls back to points (R-MEASURE-FALLBACK)"),
        ...areaGrades("Shown as England share ticks."),
      }),
      numberTypes: ["totals", "rate"],
      rules: ["R-NON-GRADES-EXCL", "R-THRESHOLD-PERIODS", "R-MIN-SCHOOLS", "R-MEASURE-FALLBACK", "R-FOCUS-NEVER-FILTERED"],
      knownGaps: [...commonGaps, "Context and Comparisons have no grade-count view; they fall back to points (R-MEASURE-FALLBACK)."],
    },
  ];
}

export const MEASURES: Measure[] = [
  // ------------------------------------------------------------------ GCSE
  {
    id: "M-KS4-ENTRIES",
    name: "GCSE candidates",
    data: "academic.candidates",
    phase: "ks4",
    definition: "Exam entries per subject, every qualification type (the DfE 'Total' row), per school and year.",
    grain: "Raw: school × subject × qualification type × year. Rollup: school × subject × year, qualifications summed.",
    sources: ["dfe_ks4_subject_entries", "dfe_ks4_subject_entries_historic"],
    years: {
      from: "2020/21",
      to: "2024/25",
      note: "Rollup entries 5 years. The subject list comes from raw facts, latest year only, without the IB Diploma total and IB Core rows (teacher-view-populations.ts:subjectItemsOf, R-IB-NONSUBJECT). Area (points-eligible) entries 2021/22-2024/25.",
    },
    keying: "urn",
    geographies: geos({
      school: ok(),
      subject_area: ok("academic_subject_family_rollup 2020-2024; share-of-family fields on headline rows"),
      set: ok("fetchAcademicProfiles(..., {includeSubjects}) -> ks4Subjects.entriesTotal"),
      la: ok("Partial: points-eligible (GCSE 9-1 Full Course) entries only, academic_subject_geography_aggregate, min 5 schools (R-GEO-POINTS-ELIGIBLE). All-qualification area entries: none."),
      region: ok("Partial: points-eligible entries only, min 5 schools"),
      england: ok("Partial: points-eligible entries only, min school count 1"),
    }),
    numberTypes: ["totals", "pct_change", "market_share", "index100", "rank"],
    rules: [
      "R-ENTRIES-NOT-POINTS",
      "R-FOCUS-NEVER-FILTERED",
      "R-KS4-SUBJECT-DEDUP",
      "R-QUAL-FAMILY-MATCH",
      "R-SELF-INCLUSIVE-GROUP",
      "R-GEO-APPLIES",
      "R-GEO-POINTS-ELIGIBLE",
      "R-MIN-SCHOOLS",
      "R-IGCSE-EXCL",
      "R-COMPARATOR-NO-FIGURE",
      "R-TREND-LINE-4YR",
      "R-INDEX-HEADCOUNTS",
      "R-PERIOD-TRIM",
      "R-DONUT-COUNTS-ONLY",
    ],
    fetchedBy: [
      `${DASHBOARD_ROUTE} -> ${SUBJECT_LEVEL} (route.ts:169), ${SUBJECT_HEADLINE} (route.ts:172)`,
      PROFILES,
      SUBJECT_GEO,
      "seriesByUrn.candidates from academic-data-view.ts:entriesSeries (headline pupil_count) in dashboard, chooser-set and saved-sets",
    ],
    knownGaps: [
      "The item list (raw facts, latest year) and the trend (rollup) come from different tables.",
      "No all-qualification area benchmark.",
    ],
    briefing: GCSE_BRIEFING,
    citation: SOURCE_NAME.ks4,
  },
  {
    id: "M-KS4-POINTS",
    name: "GCSE average points",
    data: "academic.results",
    phase: "ks4",
    results: "points",
    definition: "Points per points-eligible entry, GCSE (9-1) Full Course only, on the 9-1 table (vicdata:ingest/academic_aggregates.py:93,139-140).",
    grain: "School × subject × year (points_weighted_sum / points_eligible_entries)",
    sources: ["dfe_ks4_subject_entries", "dfe_ks4_subject_entries_historic"],
    years: { from: "2021/22", to: "2024/25", note: "2020/21 rollup rows have 0 points-eligible entries (teacher-assessed year)." },
    keying: "urn",
    geographies: geos({
      school: ok(),
      subject_area: ok(),
      set: ok("profiles ks4Subjects.avgPointScore"),
      la: ok("academic_subject_geography_aggregate 2021-2024, min 5 schools"),
      region: ok("academic_subject_geography_aggregate, min 5 schools"),
      england: ok("academic_subject_geography_aggregate, min school count 1 (dashboard/route.ts:72)"),
    }),
    numberTypes: ["points", "change_points", "rank"],
    rules: [
      "R-ENTRIES-NOT-POINTS",
      "R-KS4-POINTS-GCSE-FULL",
      "R-POINTS-SAME-QUAL",
      "R-MIN-SCHOOLS",
      "R-SAME-YEAR-BENCH",
      "R-GEO-APPLIES",
      "R-FOCUS-NEVER-FILTERED",
      "R-KS4-SUBJECT-DEDUP",
      "R-QUAL-FAMILY-MATCH",
      "R-IGCSE-EXCL",
      "R-COMPARATOR-NO-FIGURE",
      "R-TREND-LINE-4YR",
      "R-PERIOD-TRIM",
      "R-NUMBER-TYPE-HONESTY",
    ],
    fetchedBy: [`${DASHBOARD_ROUTE} -> ${SUBJECT_HEADLINE} (route.ts:172); England via englandAverages (route.ts:46-74)`, SUBJECT_GEO, PROFILES],
    knownGaps: [
      "Rename 'Average point score' -> 'Average points' decided (C3), not yet done (teacher-view-panels.ts:113).",
      "Change is shown in points everywhere (S3b, R-NUMBER-TYPE-HONESTY: teacher-view-panels.ts changeKind \"points\", changeOf, formatChange).",
    ],
    briefing: GCSE_BRIEFING,
    citation: SOURCE_NAME.ks4,
  },
  {
    id: "M-KS4-HEADLINE",
    name: "Attainment 8",
    data: "academic.results",
    phase: "ks4",
    results: "points",
    definition: "The DfE Attainment 8 average for the whole school (HEADLINE_MEASURE.ks4 = attainment8_average). Comparisons' measure with no subject chip.",
    grain: "School × year",
    sources: ["dfe_ks4_headline", "dfe_ks4_headline_historic"],
    years: { from: "2021/22", to: "2024/25" },
    keying: "urn",
    geographies: geos({
      school: ok(),
      subject_area: no("A whole-school measure"),
      set: ok("rankSets / rankFixedSets"),
      la: ok("academic_geography_aggregate (attainment8_average 2021-2024); not used by the Teacher view"),
      region: ok("academic_geography_aggregate; not used by the Teacher view"),
      england: ok("academic_geography_aggregate; not used by the Teacher view"),
    }),
    numberTypes: ["points", "change_points", "rank"],
    rules: ["R-IGCSE-EXCL", "R-COMPARATOR-NO-FIGURE", "R-RANKING-SAMPLE", "R-MEASURE-FALLBACK", "R-RANK-TIES", "R-NUMBER-TYPE-HONESTY", "R-TREND-LINE-4YR"],
    fetchedBy: ["src/lib/vicdata-reference.ts:lookupAcademicHeadline inside fetchAcademicProfiles / fetchLatestCohortSizes / chooser-sets.ts:resolveRankingSet"],
    knownGaps: ["Progress 8 stops at 2023/24 (no 2024/25 rows)."],
    briefing: GCSE_BRIEFING,
    citation: SOURCE_NAME.ks4,
  },
  ...gradeMeasures("ks4"),

  // ------------------------------------------------------------------ Post-16
  {
    id: "M-KS5-ENTRIES",
    name: "Post-16 candidates",
    data: "academic.candidates",
    phase: "ks5",
    definition: "Entries per subject × exact qualification type (A level, AS, IB HL/SL, BTEC, T Level…), per school and year.",
    grain: "School × subject × qualification type × year (academic_subject_qualification_rollup, 3,001 schools); bucket rollup for categories",
    sources: ["dfe_ks5_subject_results", "dfe_ks5_subject_results_historic", "dfe_tlevel_results"],
    years: { from: "2020/21", to: "2024/25", note: "Rollups 5 years; the item list is raw facts, latest year only." },
    keying: "urn",
    geographies: geos({
      school: ok(),
      subject_area: ok("bucket / family rows"),
      set: ok("profiles ks5Subjects / ks5SubjectsByBucket"),
      la: ok("Partial: scored qualifications only, per subject × exact qualification (academic_subject_qualification_geography_aggregate 2021-2024); VRQ/AEA/Other have none"),
      region: ok("Partial: scored qualifications only"),
      england: ok("Partial: scored qualifications only, exact qualification (R-KS5-ENGLAND-EXACT)"),
    }),
    numberTypes: ["totals", "pct_change", "market_share", "index100", "rank"],
    rules: [
      "R-ENTRIES-NOT-POINTS",
      "R-KS5-ASAEA-EXCL",
      "R-IB-NONSUBJECT",
      "R-FOCUS-NEVER-FILTERED",
      "R-QUAL-FAMILY-MATCH",
      "R-SELF-INCLUSIVE-GROUP",
      "R-GEO-APPLIES",
      "R-GEO-POINTS-ELIGIBLE",
      "R-KS5-ENGLAND-EXACT",
      "R-MIN-SCHOOLS",
      "R-COMPARATOR-NO-FIGURE",
      "R-TREND-LINE-4YR",
      "R-INDEX-HEADCOUNTS",
      "R-PERIOD-TRIM",
      "R-DONUT-COUNTS-ONLY",
    ],
    fetchedBy: [
      `${DASHBOARD_ROUTE} -> ${SUBJECT_LEVEL} (route.ts:169), ${SUBJECT_HEADLINE} (route.ts:172), ${SUBJECT_QUAL_HEADLINE} (route.ts:176)`,
      PROFILES,
      `${SUBJECT_GEO}?phase=ks5&qualificationType=`,
    ],
    knownGaps: [
      "No IB non-subject filter on the raw-facts item list (R-IB-NONSUBJECT): fragile, and live at Sevenoaks 118952.",
      "No KS5 rows in academic_subject_geography_aggregate: subject-only area figures are GCSE-only.",
      "AS/AEA self-inclusion follow-up still open (R-KS5-ASAEA-EXCL).",
    ],
    briefing: POST16_BRIEFING,
    citation: SOURCE_NAME.ks5,
  },
  {
    id: "M-KS5-POINTS",
    name: "Post-16 average points",
    data: "academic.results",
    phase: "ks5",
    results: "points",
    definition: "Points per entry on the qualification's own challenge table (A level A*=56 … E=16), size-weighted (points_size_units).",
    grain: "School × subject × exact qualification × year",
    sources: ["dfe_ks5_subject_results", "dfe_ks5_subject_results_historic", "dfe_tlevel_results"],
    years: { from: "2021/22", to: "2024/25" },
    keying: "urn",
    geographies: geos({
      school: ok(),
      subject_area: ok("per bucket, never across buckets"),
      set: ok(),
      la: ok("per subject × exact qualification, scored qualifications only, min 5 schools"),
      region: ok("per subject × exact qualification, min 5 schools"),
      england: ok("exact qualification or none (R-KS5-ENGLAND-EXACT), min school count 1"),
    }),
    numberTypes: ["points", "change_points", "rank"],
    rules: [
      "R-ENTRIES-NOT-POINTS",
      "R-POINTS-SAME-QUAL",
      "R-KS5-ENGLAND-EXACT",
      "R-KS5-ASAEA-EXCL",
      "R-SINGLE-BUCKET-100",
      "R-POINTS-WEIGHTED",
      "R-IB-NONSUBJECT",
      "R-MIN-SCHOOLS",
      "R-SAME-YEAR-BENCH",
      "R-GEO-APPLIES",
      "R-FOCUS-NEVER-FILTERED",
      "R-QUAL-FAMILY-MATCH",
      "R-COMPARATOR-NO-FIGURE",
      "R-TREND-LINE-4YR",
      "R-PERIOD-TRIM",
      "R-NUMBER-TYPE-HONESTY",
    ],
    fetchedBy: [`${DASHBOARD_ROUTE} -> ${SUBJECT_QUAL_HEADLINE} (route.ts:176); England via englandAverages (route.ts:46-63)`, SUBJECT_GEO, PROFILES],
    knownGaps: [
      "The IB Diploma total ('Diploma total points', 0-45) is a separate figure (academic-data-view.ts:ibDiplomaHeadline).",
      "Context 'All subjects' blends qualifications (R-POINTS-SAME-QUAL open issue).",
      "Change is shown in points everywhere, as at GCSE (S3b, R-NUMBER-TYPE-HONESTY).",
    ],
    briefing: POST16_BRIEFING,
    citation: SOURCE_NAME.ks5,
  },
  {
    id: "M-KS5-HEADLINE",
    name: "A-level points per entry",
    data: "academic.results",
    phase: "ks5",
    results: "points",
    definition: "The school's A-level average points per entry (A level::aps_per_entry). Comparisons' measure with no subject chip.",
    grain: "School × year",
    sources: ["dfe_ks5_headline", "dfe_ks5_headline_historic"],
    years: { from: "2021/22", to: "2024/25" },
    keying: "urn",
    geographies: geos({
      school: ok(),
      subject_area: no("A whole-school measure"),
      set: ok(),
      la: ok("academic_geography_aggregate (also per cohort and bucket); not used by the Teacher view"),
      region: ok("academic_geography_aggregate; not used by the Teacher view"),
      england: ok("academic_geography_aggregate; not used by the Teacher view"),
    }),
    numberTypes: ["points", "change_points", "rank"],
    rules: ["R-COMPARATOR-NO-FIGURE", "R-RANKING-SAMPLE", "R-MEASURE-FALLBACK", "R-RANK-TIES", "R-NUMBER-TYPE-HONESTY", "R-TREND-LINE-4YR"],
    fetchedBy: ["src/lib/vicdata-reference.ts:lookupAcademicHeadline inside fetchAcademicProfiles / fetchLatestCohortSizes / chooser-sets.ts:resolveRankingSet"],
    knownGaps: [],
    briefing: POST16_BRIEFING,
    citation: SOURCE_NAME.ks5,
  },
  ...gradeMeasures("ks5"),

  // ------------------------------------------------------------------ Rolls and births (no views yet: A10)
  {
    id: "M-ROLLS",
    name: "Rolls",
    data: "rolls",
    definition: "Census headcount by single age × sex × full/part-time, plus boarders (src/lib/roll-data.ts:1-3, 33).",
    grain: "School × age × sex × attendance × census year",
    sources: ["dfe_school_census"],
    years: { from: "2019", to: "2025", note: "January census; 7 years. LA aggregates (roll_aggregates scope 'regional') are 2025 only." },
    keying: "urn",
    geographies: geos({
      school: ok("reference_data_lookup"),
      subject_area: no("Not a subject measure"),
      set: ok("Data View /api/data-view/schools -> data-view-profiles.ts:fetchDataViewProfiles -> fetchCensusFactsBatched"),
      la: ok("roll_aggregates scope 'regional' (which means LA; 2025 only) and region_nation_la_rollup over school_current_snapshot (current + anchor years)"),
      region: ok("roll_aggregates scope ons_region, 2019-2025"),
      england: ok("roll_aggregates scope national, 2019-2025"),
    }),
    numberTypes: ["totals", "pct_change", "market_share", "index100"],
    rules: ["R-ROLLS-HEADCOUNT", "R-ROLLS-MAINSTREAM-AGG", "R-TREND-LINE-4YR"],
    fetchedBy: [
      "src/lib/data-view-profiles.ts:126",
      "src/app/schools/[urn]/page.tsx:271",
      "src/lib/surrounding-schools.ts:150, 354",
      "src/app/api/comparator-set-peers/route.ts:60",
      "src/app/api/paid-trends/route.ts:46",
      "src/lib/market-share.ts:37",
      "src/lib/aggregate-trends.ts",
      "src/lib/la-choropleth.ts",
    ],
    knownGaps: [
      "No LA roll trend: LA rolls exist for the current year only in roll_aggregates.",
      "'regional' scope means LA: a naming trap.",
      "KS2's 'Year 6 cohort' (rollAtAge10, dashboard/route.ts:149-151) is the only Teacher view use.",
      "No single fetch function; no views registered yet (combinations A10).",
    ],
    citation: "DfE school census",
  },
  {
    id: "M-BIRTHS",
    name: "Live births",
    data: "social.births",
    definition: "ONS live births (breakdown = 'total') for an area. Area data: a school's 'own' figure is its LA's.",
    grain: "LA / district GSS code (E06/E07/E08/E09; 296 codes in 2024) × calendar year",
    sources: ["ons_births"],
    years: { from: "2021", to: "2025", note: "1992-2025 in the database; the app reads 2021-2025 only and returns nothing unless all 5 exist (R-BIRTHS-FULL-WINDOW)." },
    keying: "geography",
    geographies: geos({
      school: no("Area data: 'school' can only mean the school's LA (combinations F7: focus 'around school')"),
      subject_area: no("Not a subject measure"),
      set: no("Area data: a set of schools has no births of its own"),
      la: ok("Shire counties summed from districts (R-BIRTHS-SHIRE-SUM)"),
      region: no("No rows: would have to be summed from LAs"),
      england: no("No rows: would have to be summed from LAs"),
    }),
    numberTypes: ["totals", "pct_change", "index100"],
    rules: ["R-BIRTHS-FULL-WINDOW", "R-BIRTHS-SHIRE-SUM", "R-TREND-LINE-4YR"],
    fetchedBy: [
      "src/lib/population-trend-lookup.ts:lookupBirthsTrend (92), used by src/app/schools/[urn]/page.tsx:538 -> PopulationTrendSection -> BirthsChart",
      "src/lib/market-share.ts:68 (single birth-year read)",
    ],
    knownGaps: [
      "Not in the Data View or Teacher view at all today.",
      "No region or England rows.",
      "No share: capture rate (intake ÷ births) is a future measure, not a share.",
      "No single fetch function; no views registered yet (combinations A10).",
    ],
    citation: "ONS live births",
  },
];
