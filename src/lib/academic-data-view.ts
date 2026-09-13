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
import { lookupAcademicHeadline, lookupAcademicSubjectFamily, lookupReferenceData, type KsStage as AcademicRpcKsStage } from "./vicdata-reference";
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
export async function fetchAcademicProfiles(urns: string[]): Promise<AcademicSchoolProfile[]> {
  if (urns.length === 0) return [];
  const supabase = createServerAnonSupabaseClient();

  const [{ data: rows }, ks4Rows, ks5Rows, ks4FamilyRows, ks5FamilyRows, ks2Facts, censusFacts] = await Promise.all([
    supabase.from("schools").select("urn, current_name, town, easting, northing").in("urn", urns),
    lookupAcademicHeadline({ entityIds: urns, ksStage: "ks4" as AcademicRpcKsStage }),
    lookupAcademicHeadline({ entityIds: urns, ksStage: "ks5" as AcademicRpcKsStage }),
    lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks4" as AcademicRpcKsStage }),
    lookupAcademicSubjectFamily({ entityIds: urns, ksStage: "ks5" as AcademicRpcKsStage }),
    lookupReferenceData({ sourceId: "dfe_ks2_attainment", entityIds: urns }),
    fetchCensusFactsBatched(urns, { breakdowns: CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS }),
  ]);

  const censusFactsByUrn = new Map<string, typeof censusFacts>();
  for (const f of censusFacts) {
    const existing = censusFactsByUrn.get(f.entity_id);
    if (existing) existing.push(f);
    else censusFactsByUrn.set(f.entity_id, [f]);
  }
  function currentAgeGenderCounts(urn: string): AgeGenderCounts {
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
