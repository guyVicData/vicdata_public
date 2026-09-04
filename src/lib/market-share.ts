// Market share, public-data version (rolls spec §3: "DfE census entries ÷ ONS birth
// pool"; MIS-based version stays consulting-only, out of scope here). Server-only.

import { lookupReferenceData } from "./vicdata-reference";
import { estimateIntake, type EntryPoint, type IntakeEstimate } from "./intake-estimate";
import { createServerAnonSupabaseClient } from "./supabase";
import { cleanLaNameForDisplay } from "./la-name-display";

// Same age-to-entry-point convention as intake-estimate.ts. A birth cohort's age-11
// (or age-16) census count is approximated as born entry_age years before the census
// period -- a calendar/academic-year-boundary approximation (DfE census is a January
// snapshot; ons_births is calendar-year), not exact to the day. Documented, not hidden.
const ENTRY_POINT_AGE: Record<EntryPoint, number> = { y7: 11, sixth_form: 16 };

export type MarketShareEstimate = {
  entryPoint: EntryPoint;
  intake: IntakeEstimate;
  birthYear: number | null;
  laBirths: number | null;
  laName: string | null;
  shareLow: number | null;
  shareHigh: number | null;
};

export async function estimateMarketShare(
  urn: string,
  entryPoint: EntryPoint,
): Promise<MarketShareEstimate> {
  const supabase = createServerAnonSupabaseClient();

  const [{ data: school }, censusFacts] = await Promise.all([
    supabase
      .from("schools")
      .select("la_code")
      .eq("urn", urn)
      .maybeSingle(),
    lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] }),
  ]);

  const intake = estimateIntake(censusFacts, entryPoint);
  const empty: MarketShareEstimate = {
    entryPoint,
    intake,
    birthYear: null,
    laBirths: null,
    laName: null,
    shareLow: null,
    shareHigh: null,
  };

  if (!school?.la_code || intake.yearlyEstimates.length === 0) return empty;

  const { data: crosswalk } = await supabase
    .from("la_gss_crosswalk")
    .select("gss_code, la_name")
    .eq("dfe_code", school.la_code)
    .maybeSingle();
  if (!crosswalk) return empty;

  // Use the most recent transition's census period to pick one birth year -- the
  // range (shareLow/shareHigh) still reflects the full spread of intake estimates
  // against that one fixed denominator, not a range of denominators too (a birth
  // cohort for a given entry year is one fixed, known number, unlike intake itself).
  const mostRecentPeriod = intake.yearlyEstimates[intake.yearlyEstimates.length - 1].toPeriod;
  const birthYear = mostRecentPeriod - ENTRY_POINT_AGE[entryPoint];

  const birthFacts = await lookupReferenceData({
    sourceId: "ons_births",
    entityIds: [crosswalk.gss_code],
    periodMin: birthYear,
    periodMax: birthYear,
  });
  const laBirths = birthFacts.find((f) => f.breakdown === "total")?.value_numeric ?? null;

  // 2026-09-29: cleaned for DISPLAY only (PaidTrendsSection's own "an estimated X% of
  // {laName} births" prose) -- the real ons_births lookup just above already ran
  // against crosswalk.gss_code, never crosswalk.la_name; nothing downstream of this
  // return value queries by name again.
  if (!laBirths || laBirths === 0) {
    return { ...empty, laName: cleanLaNameForDisplay(crosswalk.la_name), birthYear };
  }

  return {
    entryPoint,
    intake,
    birthYear,
    laBirths,
    laName: cleanLaNameForDisplay(crosswalk.la_name),
    shareLow: (intake.rangeLow / laBirths) * 100,
    shareHigh: (intake.rangeHigh / laBirths) * 100,
  };
}
