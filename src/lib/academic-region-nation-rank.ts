// Academic Results round 2 (docs/vicdata_phase3_academic_results_region_nation_
// comparator_brief_v1.md): Rankings at Region/Nation scale for Academic. Real prior
// art reused directly, not invented -- same shape region-nation-comparator.ts's own
// fetchRegionNationRank already establishes for Rolls (one RPC call, keyed-cache
// discipline owned by the caller), just backed by academic_region_nation_rank()
// (vicdata's own database, see that migration's own comment) instead of
// vicdata_public's own region_nation_rank().
//
// Scope resolution is genuinely shared with Rolls, not re-derived: a school's real
// region/nation membership is the same physical fact regardless of which topic tab is
// showing, so this reuses resolveTargetRegionNation()/RegionNationScope from
// region-nation-comparator.ts directly rather than a second Academic-specific lookup.

import { lookupAcademicRegionNationRank, type KsStage } from "./vicdata-reference";
import type { RegionNationScope } from "./region-nation-comparator";
import { HEADLINE_MEASURE } from "./academic-data-view";

export type AcademicRegionNationRankEntry = { urn: string; name: string; value: number; rank: number };
export type AcademicRegionNationRankMetric = { total: number; targetRank: number | null; top15: AcademicRegionNationRankEntry[]; neighbours: AcademicRegionNationRankEntry[] };

export async function fetchAcademicRegionNationRank(targetUrn: string, ksStage: KsStage, scope: RegionNationScope): Promise<AcademicRegionNationRankMetric> {
  const result = await lookupAcademicRegionNationRank({
    ksStage,
    measure: HEADLINE_MEASURE[ksStage],
    regionCode: scope.kind === "region" ? scope.regionCode : null,
    nation: scope.kind === "region" ? null : scope.nation,
    targetUrn,
  });
  return {
    total: result.total,
    targetRank: result.targetRank,
    top15: result.top15,
    neighbours: result.neighbours,
  };
}
