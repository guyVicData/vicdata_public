// Nearest-10 FE-college peer gender split (Prompt A, item 2) -- a genuinely separate
// module from surrounding-schools.ts, not a variant of it. That module's candidate
// generation runs entirely through the nearest_schools RPC, which is deliberately
// mainstream-only (20260809103000_nearest_schools_mainstream_filter.sql restricts to
// Academies/LA-maintained/Independent/Free Schools, and additionally filters candidates
// to the SAME sector as the target via an Independent-schools equality check) -- an FE
// college passed in as the target still only matches non-independent mainstream
// candidates, never other FE colleges. Reusing that RPC for FE-to-FE matching isn't a
// small tweak, it's the wrong tool.
//
// Real population here is small -- confirmed live, 372 FE_PARTICIPATION_ESTABLISHMENT_
// TYPES institutions with real easting/northing nationally, 289 of those with real
// (latest-period, non-suppressed, both sexes >0) under-19 ILR gender data -- so this
// follows la-sector-composition.ts's own precedent (a few hundred rows is cheap, this
// is NOT the "thousands of schools through a paginated RPC" problem precomputed
// aggregates exist to avoid) rather than a two-stage RPC+buffer design: fetch every
// real candidate's distance AND gender facts in two flat queries, sort, walk in
// distance order, keep the first 10 with real data.
//
// Real radii, checked across a spread before this was built (dense urban to genuinely
// rural): Ealing/Hammersmith and West London College (dense, Hammersmith and Fulham) --
// nearest 10 all within 9.1km. Most rural LAs checked (Lincolnshire, North Yorkshire,
// Westmorland and Furness) land 37-78km. Cornwall College is a genuine outlier at
// 154km -- Cornwall's own geography (a peninsula, thin FE-college density) means
// "nearest 10" there spans most of the South West, not a meaningfully local comparison.
// Flagged, not hidden: maxDistanceKm is returned alongside the peer figures so the
// caller can say so in the caption rather than silently presenting a 150km-wide
// "nearest" group as local.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData } from "./vicdata-reference";
import { FE_PARTICIPATION_ESTABLISHMENT_TYPES } from "./typology";

const TARGET_COUNT = 10;
const UNDER_19_MALE_BREAKDOWN = "education_and_training_under_19_male";
const UNDER_19_FEMALE_BREAKDOWN = "education_and_training_under_19_female";

export type FeCollegeGenderPeers = {
  found: number;
  maxDistanceKm: number | null;
  peer: { girls: number; boys: number } | null;
};

// Latest-period, non-suppressed value per URN per sex -- same "skip a genuinely
// absent/suppressed period" discipline as fe-participation-roll.ts's own
// latestNonZeroTotal, but keyed by sex rather than collapsed to one total (this needs
// both sexes independently, not a single figure).
function latestBySex(facts: { entity_id: string; period: number; breakdown: string; value_numeric: number | null }[]) {
  const byUrn = new Map<string, { male?: { period: number; v: number }; female?: { period: number; v: number } }>();
  for (const f of facts) {
    if (f.value_numeric === null || f.value_numeric <= 0) continue;
    const sex = f.breakdown === UNDER_19_MALE_BREAKDOWN ? "male" : f.breakdown === UNDER_19_FEMALE_BREAKDOWN ? "female" : null;
    if (!sex) continue;
    if (!byUrn.has(f.entity_id)) byUrn.set(f.entity_id, {});
    const rec = byUrn.get(f.entity_id)!;
    const cur = rec[sex];
    if (!cur || f.period > cur.period) rec[sex] = { period: f.period, v: f.value_numeric };
  }
  return byUrn;
}

export async function findFeCollegeGenderPeers(urn: string): Promise<FeCollegeGenderPeers> {
  const supabase = createServerAnonSupabaseClient();

  const { data: targetRow } = await supabase
    .from("schools")
    .select("easting, northing")
    .eq("urn", urn)
    .maybeSingle();
  const target = targetRow as { easting: number | null; northing: number | null } | null;
  if (!target?.easting || !target?.northing) return { found: 0, maxDistanceKm: null, peer: null };

  const { data: candidateRows } = await supabase
    .from("schools")
    .select("urn, easting, northing")
    .in("establishment_type", FE_PARTICIPATION_ESTABLISHMENT_TYPES)
    .neq("status", "closed")
    .neq("urn", urn)
    .not("easting", "is", null)
    .not("northing", "is", null);
  const candidates = (candidateRows ?? []) as { urn: string; easting: number; northing: number }[];
  if (candidates.length === 0) return { found: 0, maxDistanceKm: null, peer: null };

  const byDistance = candidates
    .map((c) => ({
      urn: c.urn,
      distanceKm: Math.sqrt((c.easting - target.easting!) ** 2 + (c.northing - target.northing!) ** 2) / 1000,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const facts = await lookupReferenceData({
    sourceId: "dfe_fe_participation",
    entityIds: byDistance.map((c) => c.urn),
    breakdowns: [UNDER_19_MALE_BREAKDOWN, UNDER_19_FEMALE_BREAKDOWN],
  });
  const genderByUrn = latestBySex(facts);

  let girlsSum = 0;
  let boysSum = 0;
  let found = 0;
  let maxDistanceKm = 0;
  for (const c of byDistance) {
    if (found >= TARGET_COUNT) break;
    const rec = genderByUrn.get(c.urn);
    if (!rec?.male || !rec?.female) continue; // suppressed or genuinely no under-19 gender data -- skip, same skip-and-backfill precedent as surrounding-schools.ts
    girlsSum += rec.female.v;
    boysSum += rec.male.v;
    found += 1;
    maxDistanceKm = c.distanceKm;
  }

  if (found === 0) return { found: 0, maxDistanceKm: null, peer: null };
  return { found, maxDistanceKm, peer: { girls: girlsSum, boys: boysSum } };
}
