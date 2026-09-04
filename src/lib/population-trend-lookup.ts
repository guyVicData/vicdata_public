// Server-side fetch for the population-trend card -- kept separate from
// population-trend.ts (pure classification logic, no Supabase import) so the
// classification rule stays trivially unit-testable/readable on its own.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData } from "./vicdata-reference";
import { computePopulationTrend, ageProfileSeries, computeBirthsTrend, type PopulationTrend, type AgeProfileSeries, type BirthsTrend } from "./population-trend";
import { SHIRE_COUNTY_DISTRICT_GSS_CODES } from "./shire-county-districts";

export type PopulationTrendResult = {
  laName: string;
  laTrend: PopulationTrend | null;
  laSeries: AgeProfileSeries | null;
  region: string | null;
  regionTrend: PopulationTrend | null;
  regionSeries: AgeProfileSeries | null;
};

export async function lookupPopulationTrend(
  laName: string | null,
  laCode: string | null,
  period: number,
): Promise<PopulationTrendResult | null> {
  if (!laName) return null;
  const supabase = createServerAnonSupabaseClient();

  const region = laCode
    ? (
        await supabase
          .from("la_gss_crosswalk")
          .select("region")
          .eq("dfe_code", laCode)
          .maybeSingle()
      ).data?.region ?? null
    : null;

  const scopeKeys = region ? [laName, region] : [laName];
  const { data, error } = await supabase
    .from("age_profile_aggregates")
    .select("scope, scope_key, by_age")
    .eq("period", period)
    .in("scope_key", scopeKeys);
  if (error || !data) return null;

  const laRow = (data as { scope: string; scope_key: string; by_age: Record<string, number> }[]).find(
    (r) => r.scope === "la" && r.scope_key === laName,
  );
  const regionRow = region
    ? (data as { scope: string; scope_key: string; by_age: Record<string, number> }[]).find(
        (r) => r.scope === "region" && r.scope_key === region,
      )
    : undefined;

  return {
    laName,
    laTrend: laRow ? computePopulationTrend(laRow.by_age) : null,
    laSeries: laRow ? ageProfileSeries(laRow.by_age) : null,
    region,
    regionTrend: regionRow ? computePopulationTrend(regionRow.by_age) : null,
    regionSeries: regionRow ? ageProfileSeries(regionRow.by_age) : null,
  };
}

// Births chart (population-trends-panel build, 2026-09-27): real ONS births,
// source_id "ons_births", entity_id = ONS GSS code (breakdown "total" for the yearly
// figure) -- confirmed live against market-share.ts's own existing real usage of this
// same source. LA-only (no region series -- not asked for). Last 5 real years,
// confirmed live that every real LA in this database has all 5 (2021-2025) before
// committing to this fixed window; a partial window (fewer than 5 real years) is
// treated as no data at all, same "show nothing rather than something wrong/partial"
// discipline as the rest of this page, not a degraded partial chart.
//
// The shire-county gotcha: ons_births publishes at district level only (confirmed
// live, zero E10/county-level rows exist at all) -- a shire county's own
// la_gss_crosswalk.gss_code never has real data of its own, so its real districts
// (SHIRE_COUNTY_DISTRICT_GSS_CODES) are summed instead. Every other real LA
// (unitary/London/metropolitan) resolves directly at its own crosswalk code.
export type BirthsTrendResult = {
  laBirthsTrend: BirthsTrend | null;
  laBirthsSeries: { year: number; count: number }[] | null;
};

const BIRTHS_EARLIEST_YEAR = 2021;
const BIRTHS_LATEST_YEAR = 2025;

export async function lookupBirthsTrend(laCode: string | null): Promise<BirthsTrendResult> {
  const empty: BirthsTrendResult = { laBirthsTrend: null, laBirthsSeries: null };
  if (!laCode) return empty;
  const supabase = createServerAnonSupabaseClient();
  const { data: crosswalk } = await supabase.from("la_gss_crosswalk").select("gss_code").eq("dfe_code", laCode).maybeSingle();
  if (!crosswalk?.gss_code) return empty;

  const entityIds = SHIRE_COUNTY_DISTRICT_GSS_CODES[laCode] ?? [crosswalk.gss_code];
  const facts = await lookupReferenceData({
    sourceId: "ons_births",
    entityIds,
    periodMin: BIRTHS_EARLIEST_YEAR,
    periodMax: BIRTHS_LATEST_YEAR,
  });

  const byYear = new Map<number, number>();
  for (const f of facts) {
    if (f.breakdown !== "total" || f.value_numeric === null) continue;
    byYear.set(f.period, (byYear.get(f.period) ?? 0) + f.value_numeric);
  }

  const series: { year: number; count: number }[] = [];
  for (let y = BIRTHS_EARLIEST_YEAR; y <= BIRTHS_LATEST_YEAR; y++) {
    const count = byYear.get(y);
    if (count !== undefined) series.push({ year: y, count });
  }
  if (series.length < BIRTHS_LATEST_YEAR - BIRTHS_EARLIEST_YEAR + 1) return empty;

  const trend = computeBirthsTrend(BIRTHS_EARLIEST_YEAR, BIRTHS_LATEST_YEAR, series[0].count, series[series.length - 1].count);
  return { laBirthsTrend: trend, laBirthsSeries: series };
}
