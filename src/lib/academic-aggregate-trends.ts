// Academic Results round 2: Graphs at Region/Nation scale. Real prior art reused
// directly, not invented -- same "one real precomputed source, no new precompute"
// principle as vicdata_public's own aggregate-trends.ts, but the source itself
// differs: Rolls reads roll_aggregates (a Rolls-only table); Academic reads
// academic_geography_aggregate -- round 1's own choropleth source, already real,
// already precomputed, and already spans multiple real periods per grouping
// (confirmed directly via AcademicGeographyRow's own `period` field before reusing it
// here, not assumed).
//
// No 'sector' line, unlike Rolls' own three-line national/region/sector shape:
// academic_geography_aggregate's own grouping_type is la/region/national only -- no
// sector dimension exists in that table at all (confirmed against its schema/ingest,
// ingest/academic_aggregates.py, before deciding to drop the third line rather than
// fake one).
//
// Headline measure (avg_value) only, not entries -- a real finding checked directly
// against both the real ingest code and a live fetch before assuming otherwise:
// academic_geography_aggregate's own entries_total column is NEVER populated for
// family_id='whole_school' rows (ingest/academic_aggregates.py's own accumulator only
// sums entries for a real, specific subject family, from academic_subject_family_rollup
// -- the whole-school headline branch sums avg_value alone). So there is no real
// national/region "candidate numbers" series this round's whole-school scope can offer
// -- AcademicGraphsView's own Section 1 (Entries) large-set branch withholds that
// comparison honestly rather than fabricate it from an always-null field.
import { lookupAcademicGeography, type KsStage } from "./vicdata-reference";
import { resolveTargetRegionNation } from "./region-nation-comparator";
import { HEADLINE_MEASURE } from "./academic-data-view";

export type AcademicAggregateTrendPoint = { period: number; value: number };
export type AcademicAggregateTrendSeries = { label: string; points: AcademicAggregateTrendPoint[] };
export type AcademicAggregateTrends = { national: AcademicAggregateTrendSeries | null; region: AcademicAggregateTrendSeries | null };

function toSeries(rows: { grouping_key: string; period: number; avg_value: number | null }[], label: string): AcademicAggregateTrendSeries | null {
  const real = rows.filter((r) => r.avg_value !== null).sort((a, b) => a.period - b.period);
  if (real.length === 0) return null;
  return { label, points: real.map((r) => ({ period: r.period, value: r.avg_value as number })) };
}

// England-only 'national' grouping -- academic_geography_aggregate's own real
// grouping_key for grouping_type='national' (confirmed directly against
// ingest/academic_aggregates.py: zero Wales schools ever contribute to it).
export const NATIONAL_GROUPING_KEY = "England";

export async function fetchAcademicAggregateTrends(targetUrn: string, ksStage: KsStage, periodMin: number): Promise<AcademicAggregateTrends> {
  const measure = HEADLINE_MEASURE[ksStage];
  const [targetRegionNation, nationalRows] = await Promise.all([
    resolveTargetRegionNation(targetUrn),
    lookupAcademicGeography({ ksStage, measure, groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY], familyId: "whole_school", periodMin }),
  ]);
  const regionRows = targetRegionNation?.regionName
    ? await lookupAcademicGeography({ ksStage, measure, groupingType: "region", groupingKeys: [targetRegionNation.regionName], familyId: "whole_school", periodMin })
    : [];
  return {
    national: toSeries(nationalRows, NATIONAL_GROUPING_KEY),
    region: targetRegionNation?.regionName ? toSeries(regionRows, targetRegionNation.regionName) : null,
  };
}
