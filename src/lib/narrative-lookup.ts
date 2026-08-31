// Server-side data-fetching glue for the narrative generator's Topic 3 (phase size).
// Kept separate from narrative.ts (pure classification/templating, no network calls)
// the same way population-trend-lookup.ts is kept separate from population-trend.ts
// -- this module does the Supabase round-trips, narrative.ts stays trivially
// unit-testable on its own.

import { createServerAnonSupabaseClient } from "./supabase";
import { effectivePhaseTags, phaseTagAgeRange, type PhaseTag } from "./typology";
import type { MatchedSchool } from "./surrounding-schools";
import type { AgeGenderCounts } from "./roll-data";
import { phaseWord } from "./surrounding-summary";
import { primaryPhaseTag, topic3PhaseSize, tightestComparatorGeography } from "./narrative";

function phaseHeadcount(
  tag: PhaseTag,
  lowAge: number | null,
  highAge: number | null,
  ageGenderCounts: Map<number, { male: number; female: number }>,
): number | null {
  if (lowAge === null || highAge === null) return null;
  const tags = effectivePhaseTags(lowAge, highAge, ageGenderCounts);
  if (!tags.includes(tag)) return null;
  const range = tags.length > 1 ? phaseTagAgeRange(tag, lowAge, highAge) : [lowAge, highAge];
  let total = 0;
  for (const [age, c] of ageGenderCounts) {
    if (age >= range[0] && age <= range[1]) total += c.male + c.female;
  }
  return total;
}

export async function computeTopic3(
  schoolLowAge: number | null,
  schoolHighAge: number | null,
  ageGenderCounts: Map<number, { male: number; female: number }>,
  sectorWord: string | null,
  laName: string | null,
  laCode: string | null,
  matchedPeers: MatchedSchool[],
): Promise<string | null> {
  if (!sectorWord) return null;
  const effectiveTags = effectivePhaseTags(schoolLowAge, schoolHighAge, ageGenderCounts);
  const tag = primaryPhaseTag(effectiveTags);
  if (!tag) return null;
  const word = phaseWord([tag]);
  if (!word) return null;

  const targetHeadcount = phaseHeadcount(tag, schoolLowAge, schoolHighAge, ageGenderCounts);
  if (targetHeadcount === null || targetHeadcount === 0) return null;

  const supabase = createServerAnonSupabaseClient();
  const region = laCode
    ? (await supabase.from("la_gss_crosswalk").select("region").eq("dfe_code", laCode).maybeSingle()).data?.region ?? null
    : null;

  const peerUrns = matchedPeers.map((p) => p.urn);
  const { data: peerRows } = peerUrns.length
    ? await supabase.from("schools").select("urn, la_name, la_code").in("urn", peerUrns)
    : { data: [] as { urn: string; la_name: string | null; la_code: string | null }[] };
  const peerLaByUrn = new Map((peerRows ?? []).map((r) => [r.urn, r]));

  const peerRegionCache = new Map<string, string | null>();
  async function regionFor(laCodeVal: string | null): Promise<string | null> {
    if (!laCodeVal) return null;
    if (peerRegionCache.has(laCodeVal)) return peerRegionCache.get(laCodeVal)!;
    const r = (await supabase.from("la_gss_crosswalk").select("region").eq("dfe_code", laCodeVal).maybeSingle()).data?.region ?? null;
    peerRegionCache.set(laCodeVal, r);
    return r;
  }

  const peerRolls: number[] = [];
  const geographyPeers: { laName: string | null; region: string | null }[] = [];
  for (const p of matchedPeers) {
    const v = phaseHeadcount(tag, p.statutoryLowAge, p.statutoryHighAge, p.ageGenderCounts as AgeGenderCounts);
    if (v === null || v === 0) continue;
    peerRolls.push(v);
    const peerLa = peerLaByUrn.get(p.urn);
    geographyPeers.push({ laName: peerLa?.la_name ?? null, region: await regionFor(peerLa?.la_code ?? null) });
  }
  if (peerRolls.length === 0) return null;

  const geography = tightestComparatorGeography(laName, region, geographyPeers);

  return topic3PhaseSize(word, sectorWord, targetHeadcount, peerRolls, laName, region, geography, region);
}
