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
import { lookupAcademicHeadline, lookupAcademicSubjectFamily, lookupReferenceData, type KsStage as AcademicRpcKsStage, type ReferenceFact } from "./vicdata-reference";
import { fetchCensusFactsBatched, CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS } from "./data-view-profiles";
import { singleAgeGenderCountsForPeriod, type AgeGenderCounts } from "./roll-data";

export type KsStage = "ks2" | "ks4" | "ks5";

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

export const STAGE_LABEL: Record<KsStage, string> = { ks2: "KS2", ks4: "GCSE", ks5: "A-level" };

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

type SchoolRow = { urn: string; current_name: string; town: string | null; easting: number | null; northing: number | null };

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

  const [{ data: rows }, ks4Rows, ks5Rows, ks4FamilyRows, ks5FamilyRows, ks2Facts, censusFacts] = await Promise.all([
    supabase.from("schools").select("urn, current_name, town, easting, northing").in("urn", urns),
    lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4" as AcademicRpcKsStage }),
    lookupAcademicHeadline({ entityIds: urns, ksStage: "ks5" as AcademicRpcKsStage }),
    lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks4" as AcademicRpcKsStage }),
    lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks5" as AcademicRpcKsStage }),
    lookupReferenceData({ sourceId: "dfe_ks2_attainment", entityIds: urns }),
    includePopulation ? fetchCensusFactsBatched(urns, { breakdowns: CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS }) : Promise.resolve([]),
  ]);

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
