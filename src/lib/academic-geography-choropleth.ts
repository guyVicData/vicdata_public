// Academic Results LA/Region choropleth (new feature, round 1 of 2). Connects two
// real, already-existing, previously-unconnected pieces: Rolls' own choropleth
// geometry (la_boundaries_geojson/region_boundaries_geojson RPCs, vicdata_public's
// own project) and Academic's own real, already-populated LA/region/national
// aggregate (academic_geography_aggregate/academic_geography_lookup(), vicdata's
// project -- built in an earlier round, never wired to any UI until now).
//
// The two pieces live in TWO DIFFERENT Postgres databases (vicdata vs vicdata_public)
// -- there is no single SQL JOIN that can connect them. The real join (LA name ->
// gss_code) happens here, in application code, not in SQL.
//
// KS2 is NOT supported -- academic_geography_aggregate's own ks_stage column has a
// real check constraint, ks4/ks5 only (confirmed directly against that table's own
// migration) -- DfE's KS2 data set has no LA/region/national precedent this table was
// ever built from. Reflected in this module's own KsStage type (imported from
// vicdata-reference.ts, already ks4|ks5 only) -- not a runtime guard bolted on top.
import { lookupAcademicGeography, type KsStage } from "./vicdata-reference";
import { createServerAnonSupabaseClient } from "./supabase";
import { HEADLINE_MEASURE } from "./academic-data-view";

export type AcademicGeographyChoroplethEntry = {
  gssCode: string;
  name: string;
  schoolCount: number;
  avgValue: number | null;
  period: number | null;
  geometry: GeoJSON.MultiPolygon | null;
};

// Real per-key "latest year" pick -- academic_geography_lookup can return more than
// one real period per grouping_key (the full real history, not just the newest), and
// different LAs/regions can genuinely have a different real latest year available
// (same "don't assume a single global latest year" discipline entriesCountAt/
// latestMeasureAt already established for Academic's own per-school figures).
function latestPerKey(rows: { grouping_key: string; period: number; avg_value: number | null; school_count: number }[]) {
  const byKey = new Map<string, { grouping_key: string; period: number; avg_value: number | null; school_count: number }>();
  for (const r of rows) {
    const existing = byKey.get(r.grouping_key);
    if (!existing || r.period > existing.period) byKey.set(r.grouping_key, r);
  }
  return byKey;
}

// LA tier: real join path confirmed directly against hosted before treating this as
// done (not just trusted from documentation) -- academic_geography_aggregate's own
// grouping_key for LA rows is the real LA NAME (e.g. "Slough"), matched against
// la_gss_crosswalk.la_name with a plain exact string match, same convention Rolls'
// own region_nation_la_rollup() RPC already established (that function's own
// migration comment: `join la_gss_crosswalk lgc on lgc.la_name = s.la_name`, no
// normalisation). Checked EVERY real distinct LA name this table returns, not a
// spot-check sample: 153/153 exact matches, zero unexplained gaps (see this round's
// own build report for the real numbers). All 153 English LAs the aggregate has data
// for get a real gss_code; there is no non-English LA in this table at all (Wales is
// out of scope for the whole academic_geography_aggregate table, confirmed at that
// table's own creation).
//
// Deliberately NOT scoped to one region at a time, unlike Rolls' own region-la-
// choropleth route: Academic has no per-region comparator SET to scope by (this
// round's own standalone toggle, not a Region/Nation-scale set), and the WHOLE real
// LA-level data set is only ~153 rows nationally -- genuinely cheap to fetch in full,
// not a large-set-architecture problem the way a live per-school rollup would be.
export async function fetchAcademicLaChoropleth(ksStage: KsStage): Promise<AcademicGeographyChoroplethEntry[]> {
  const measure = HEADLINE_MEASURE[ksStage];
  const rows = await lookupAcademicGeography({ ksStage, measure, groupingType: "la", familyId: "whole_school" });
  const latestByLaName = latestPerKey(rows);

  const supabase = createServerAnonSupabaseClient();
  const { data: crosswalkData, error: crosswalkError } = await supabase.from("la_gss_crosswalk").select("la_name, gss_code");
  if (crosswalkError) throw crosswalkError;
  const gssByLaName = new Map(((crosswalkData ?? []) as { la_name: string; gss_code: string }[]).map((c) => [c.la_name, c.gss_code]));

  // Scoped to exactly the grouping_keys the aggregate actually returned, per this
  // round's own brief -- an LA with genuinely no real academic data at all (there are
  // none among the 153, confirmed, but a future backfill gap is a real possibility)
  // gets no polygon at all, not a fabricated hollow one, matching
  // academic_geography_aggregate's own "no row means no real contributing schools"
  // convention rather than inventing a second "zero vs missing" distinction this
  // table doesn't itself draw.
  const withGss = Array.from(latestByLaName.values())
    .map((r) => {
      const gssCode = gssByLaName.get(r.grouping_key);
      return gssCode ? { gssCode, name: r.grouping_key, schoolCount: r.school_count, avgValue: r.avg_value, period: r.period } : null;
    })
    .filter((e): e is { gssCode: string; name: string; schoolCount: number; avgValue: number | null; period: number } => e !== null);

  if (withGss.length === 0) return [];
  const { data: geoData, error: geoError } = await supabase.rpc("la_boundaries_geojson", { p_gss_codes: withGss.map((e) => e.gssCode) });
  if (geoError) throw geoError;
  const geoByGss = new Map(
    ((geoData ?? []) as { gss_code: string; geojson: string }[]).map((g) => [g.gss_code, JSON.parse(g.geojson) as GeoJSON.MultiPolygon]),
  );
  return withGss.map((e) => ({ ...e, geometry: geoByGss.get(e.gssCode) ?? null }));
}

// Region tier: academic_geography_aggregate's own region-level grouping_key is
// already the real region NAME (e.g. "Yorkshire and The Humber"), confirmed to match
// region_boundaries_geojson's own `name` column character-for-character for all 9
// real English regions -- no crosswalk needed at this tier at all (unlike Rolls' own
// fetchNationRegionChoropleth, which has to fold ~175 live LA rows into 9 region
// sums; academic_geography_aggregate already has a real, separately-computed region-
// level row for each of the 9, so this reads it directly rather than re-deriving a
// region total from the LA tier's own rows).
export async function fetchAcademicRegionChoropleth(ksStage: KsStage): Promise<AcademicGeographyChoroplethEntry[]> {
  const measure = HEADLINE_MEASURE[ksStage];
  const rows = await lookupAcademicGeography({ ksStage, measure, groupingType: "region", familyId: "whole_school" });
  const latestByRegionName = latestPerKey(rows);

  const supabase = createServerAnonSupabaseClient();
  const { data: geoData, error: geoError } = await supabase.rpc("region_boundaries_geojson", { p_gss_codes: null });
  if (geoError) throw geoError;
  const geoByName = new Map(
    ((geoData ?? []) as { gss_code: string; name: string; geojson: string }[]).map((g) => [g.name, { gssCode: g.gss_code, geometry: JSON.parse(g.geojson) as GeoJSON.MultiPolygon }]),
  );

  return Array.from(latestByRegionName.values()).map((r) => {
    const geo = geoByName.get(r.grouping_key);
    return {
      gssCode: geo?.gssCode ?? r.grouping_key,
      name: r.grouping_key,
      schoolCount: r.school_count,
      avgValue: r.avg_value,
      period: r.period,
      geometry: geo?.geometry ?? null,
    };
  });
}
