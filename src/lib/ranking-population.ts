// Teacher view comparator chooser: the population a ranking is built from. Server-only
// (region_nation_set via the anon server client). See /api/teacher/ranking-population
// for what each field is and where it comes from.
import { createServerAnonSupabaseClient } from "./supabase";
import type { RegionNationRow } from "./region-nation-comparator";
import { ageGenderCountsFromCompact } from "./data-view-serialize";
import { boardingRatio, genderTag, phaseTags, sectorTag } from "./typology";
import { AGE_BANDS, CURRENT_CENSUS_PERIOD, type AgeBandKey } from "./roll-data";
import { lookupAgeBandDistributions, sizeBadgeForValue } from "./age-band-distributions";
import type { PopulationRow } from "./comparator-chooser";

export type RankingPhase = "ks4" | "ks5";
const BAND: Record<RankingPhase, AgeBandKey> = { ks5: "sixth_form", ks4: "secondary" };
const GENDER_CHUNK = 300;

// `laName` is the target school's own LA: lookupAgeBandDistributions is called exactly as
// the public school page calls it, with a real LA, because with a null one it filters on
// scope_key in ("") and returns nothing (logged in docs/OPEN_QUESTIONS.md, 2026-09-27).
// Only the national quintiles are used; the LA only makes the lookup work.
export async function buildRankingPopulation(
  scope: { regionCode: string | null; nation: "england" | null },
  phase: RankingPhase,
  laName: string | null,
): Promise<PopulationRow[]> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase.rpc("region_nation_set", {
    p_region_code: scope.regionCode,
    p_nation: scope.regionCode ? null : scope.nation,
    p_exclude_urn: "",
  });
  if (error) throw error;
  const band = AGE_BANDS.find((b) => b.key === BAND[phase])!;

  const kept: { row: RegionNationRow; sector: NonNullable<ReturnType<typeof sectorTag>>; bandRoll: number }[] = [];
  for (const r of (data ?? []) as RegionNationRow[]) {
    const sector = sectorTag(r[4], r[5]);
    if (!sector) continue;
    const counts = ageGenderCountsFromCompact(r[11]);
    let bandRoll = 0;
    for (const [age, c] of counts) if (age >= band.minAge && age <= band.maxAge) bandRoll += c.male + c.female;
    const samePhase = phase === "ks5" ? bandRoll > 0 || sector === "FE" : phaseTags(r[6], r[7], r[5]).includes("Senior");
    if (samePhase) kept.push({ row: r, sector, bandRoll });
  }

  // The real GIAS gender field, batched.
  const gender = new Map<string, string | null>();
  const urns = kept.map((k) => k.row[0]);
  for (let i = 0; i < urns.length; i += GENDER_CHUNK) {
    const { data: g } = await supabase.from("schools").select("urn, gender").in("urn", urns.slice(i, i + GENDER_CHUNK));
    for (const s of (g ?? []) as { urn: string; gender: string | null }[]) gender.set(s.urn, s.gender);
  }

  const distributions = await lookupAgeBandDistributions(laName, CURRENT_CENSUS_PERIOD);
  const quintiles = distributions.get(BAND[phase])?.quintiles ?? null;

  return kept.map(({ row, sector, bandRoll }) => {
    const boarding = row[12];
    return [
      row[0],
      row[1],
      sector,
      genderTag(gender.get(row[0]) ?? null),
      boarding ? Math.round(boardingRatio({ boarders: boarding[0], total: boarding[2] }) * 100) : null,
      quintiles && bandRoll > 0 ? sizeBadgeForValue(bandRoll, quintiles) : null,
    ];
  });
}

