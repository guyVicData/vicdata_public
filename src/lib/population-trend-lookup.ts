// Server-side fetch for the population-trend card -- kept separate from
// population-trend.ts (pure classification logic, no Supabase import) so the
// classification rule stays trivially unit-testable/readable on its own.

import { createServerAnonSupabaseClient } from "./supabase";
import { computePopulationTrend, ageProfileSeries, type PopulationTrend, type AgeProfileSeries } from "./population-trend";

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
