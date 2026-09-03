#!/usr/bin/env -S npx tsx
// Precomputes two national size distributions for FE-sector colleges (Prompt A, item 3):
// under-19 ILR participation (dfe_fe_participation) and adult/19+ participation
// (dfe_fe_participation_adult), each against the real population of FE colleges with
// that figure -- NOT a phase breakdown (ILR carries no age-band data at all, per item
// 5's own finding), two separate size placements instead. Same precomputation SHAPE as
// sync-age-band-distributions.ts (per-institution values -> mean + quintile
// boundaries), reused as new rows in that SAME table rather than a new one -- the
// schema (scope/scope_key/band_key/period + stats) is already generic, and adding two
// new band_key values ("fe_under_19"/"fe_19_plus", deliberately distinct from the
// census AGE_BANDS keys so they can never collide) is a smaller surface than a second
// table with an identical shape. National only, scope_key "" -- no regional/LA cut for
// this pass, per the original ask (a per-LA FE-college population is usually too thin
// for a meaningful distribution anyway; most LAs have 0-1 real FE colleges).
//
// Usage: npx tsx --env-file=.env scripts/sync-fe-participation-distributions.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { lookupReferenceData } from "../src/lib/vicdata-reference";
import { CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";

// Real institution count per source, confirmed live before this was written: 311
// institutions with a real (latest-period, non-suppressed, non-zero) under-19 total,
// 340 with a real adult/19+ total -- close to Prompt A's own ~312/~352 estimates, not
// exactly matching because "real" here is per-institution latest-non-zero, not a
// single-period count.
const UNDER_19_TOTAL_BREAKDOWN = "education_and_training_under_19_total";
const ADULT_TOTAL_BREAKDOWN = "education_and_training_19_plus_total";

// The stored period is a label for this computed snapshot as a whole (same convention
// roll_aggregates/age_band_pupil_distributions already use), not a hard per-row
// constraint -- each institution's own contributing figure is its own latest real
// (non-suppressed, non-zero) value, which in practice is mostly this period but can be
// an earlier one for an institution whose most recent submission was suppressed.
const SNAPSHOT_PERIOD = CURRENT_CENSUS_PERIOD;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Latest non-zero total per URN -- same discipline as fe-participation-roll.ts's own
// latestNonZeroTotal (not imported: that module returns {period,total} keyed to the
// map-dot use case, this just needs the bare values for a distribution).
function latestNonZeroTotals(
  facts: { entity_id: string; period: number; breakdown: string; value_numeric: number | null }[],
  breakdown: string,
): number[] {
  const byUrn = new Map<string, { period: number; value: number }>();
  for (const f of facts) {
    if (f.breakdown !== breakdown || f.value_numeric === null || f.value_numeric <= 0) continue;
    const cur = byUrn.get(f.entity_id);
    if (!cur || f.period > cur.period) byUrn.set(f.entity_id, { period: f.period, value: f.value_numeric });
  }
  return Array.from(byUrn.values()).map((v) => v.value);
}

function toRow(bandKey: string, values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    scope: "national" as const,
    scope_key: "",
    band_key: bandKey,
    period: SNAPSHOT_PERIOD,
    school_count: sorted.length,
    mean_roll: mean,
    p20: quantile(sorted, 0.2),
    p40: quantile(sorted, 0.4),
    p60: quantile(sorted, 0.6),
    p80: quantile(sorted, 0.8),
    computed_at: new Date().toISOString(),
  };
}

async function main() {
  const supabase = createServiceRoleSupabaseClient();

  console.log("fetching dfe_fe_participation (under-19)...");
  const under19Facts = await lookupReferenceData({
    sourceId: "dfe_fe_participation",
    breakdowns: [UNDER_19_TOTAL_BREAKDOWN],
  });
  const under19Values = latestNonZeroTotals(under19Facts, UNDER_19_TOTAL_BREAKDOWN);
  console.log(`  ${under19Values.length} institutions with a real under-19 total`);

  console.log("fetching dfe_fe_participation_adult (19+)...");
  const adultFacts = await lookupReferenceData({
    sourceId: "dfe_fe_participation_adult",
    breakdowns: [ADULT_TOTAL_BREAKDOWN],
  });
  const adultValues = latestNonZeroTotals(adultFacts, ADULT_TOTAL_BREAKDOWN);
  console.log(`  ${adultValues.length} institutions with a real adult (19+) total`);

  const rows = [toRow("fe_under_19", under19Values), toRow("fe_19_plus", adultValues)];

  console.log(`writing ${rows.length} distribution rows to age_band_pupil_distributions...`);
  const { error } = await supabase
    .from("age_band_pupil_distributions")
    .upsert(rows, { onConflict: "scope,scope_key,band_key,period" });
  if (error) throw error;

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
