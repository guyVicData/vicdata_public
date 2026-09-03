// LA sector-composition donut + "1 of N" line (dashboard rebuild, Roll card).
// Deliberately a single live query, not a new precomputed aggregate like
// roll_aggregates/age_band_pupil_distributions -- a per-LA scan of the `schools`
// table (typically a few hundred rows) is cheap; this is NOT the same "thousands of
// schools' phase-sliced census data through a paginated remote RPC" problem those
// aggregates exist to avoid (see docs/OPEN_QUESTIONS.md, 2026-08-28 investigation).
//
// Real, deliberate scope note: pupil counts here are GIAS's own `number_of_pupils`
// snapshot field (ingest/sources/gias.py, ~89% filled), NOT the same DfE census
// figure the rest of this page uses -- a genuinely different source/provenance, same
// "flag it, don't blend it silently" discipline as the map's ILR-vs-census marker
// distinction. Schools with a null number_of_pupils are excluded from every
// percentage/count here (not treated as zero), so a sparse LA doesn't silently
// under-report. The viewed school's own share is computed from ITS OWN
// number_of_pupils too (not the census totalRoll shown elsewhere on the page) --
// mixing the two sources for one ratio would be the exact silent-blend this project
// avoids everywhere else.

import { createServerAnonSupabaseClient } from "./supabase";
import { sectorTag, type SectorTag } from "./typology";

// This donut's own deliberate scope -- three sectors, unaffected by the map's 2026-09-03
// Special Schools addition (typology.ts's sectorTag() now returns a real fourth value
// instead of null for that population, but this feature was never asked to track it).
type TrackedSector = "State" | "Independent" | "FE";
const SECTORS: TrackedSector[] = ["State", "Independent", "FE"];

export type LaSectorComposition = {
  laName: string;
  bySector: Record<TrackedSector, { schools: number; pupils: number }>;
  totalPupils: number;
  // The viewed school's own sector -- null if it doesn't resolve to one of the three
  // tracked here (e.g. Special Schools, or anything else sectorTag() can't place at
  // all), in which case the caller shouldn't render the "1 of N" line at all.
  thisSchoolSector: TrackedSector | null;
  thisSchoolSectorSchoolCount: number;
  // This school's own number_of_pupils as a % of its sector's LA total -- null when
  // thisSchoolSector is null, or when this school's own number_of_pupils is null (no
  // GIAS figure to compute a share from).
  thisSchoolPupilShareOfSector: number | null;
};

function asTrackedSector(sector: SectorTag | null): TrackedSector | null {
  return sector && (SECTORS as SectorTag[]).includes(sector) ? (sector as TrackedSector) : null;
}

export async function computeLaSectorComposition(
  laName: string,
  thisSchoolSector: SectorTag | null,
  thisSchoolNumberOfPupils: number | null,
): Promise<LaSectorComposition | null> {
  if (!laName) return null;
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("schools")
    .select("establishment_type_group, establishment_type, number_of_pupils")
    .eq("la_name", laName)
    .neq("status", "closed")
    // Defensive upper bound -- real LAs run to a few hundred schools, well under
    // PostgREST's 1000-row cap; if this ever legitimately needs more than 2000 in one
    // LA, that's worth a real look, not a silent truncation.
    .range(0, 1999);
  if (error || !data) return null;

  const bySector: LaSectorComposition["bySector"] = {
    State: { schools: 0, pupils: 0 },
    Independent: { schools: 0, pupils: 0 },
    FE: { schools: 0, pupils: 0 },
  };

  for (const row of data as {
    establishment_type_group: string | null;
    establishment_type: string | null;
    number_of_pupils: number | null;
  }[]) {
    const sector = asTrackedSector(sectorTag(row.establishment_type_group, row.establishment_type));
    if (!sector) continue;
    if (row.number_of_pupils === null) continue;
    bySector[sector].schools += 1;
    bySector[sector].pupils += row.number_of_pupils;
  }

  const totalPupils = SECTORS.reduce((sum, s) => sum + bySector[s].pupils, 0);
  const trackedThisSchoolSector = asTrackedSector(thisSchoolSector);
  const thisSchoolSectorSchoolCount = trackedThisSchoolSector ? bySector[trackedThisSchoolSector].schools : 0;
  const sectorPupils = trackedThisSchoolSector ? bySector[trackedThisSchoolSector].pupils : 0;
  const thisSchoolPupilShareOfSector =
    trackedThisSchoolSector && thisSchoolNumberOfPupils !== null && sectorPupils > 0
      ? (thisSchoolNumberOfPupils / sectorPupils) * 100
      : null;

  return {
    laName,
    bySector,
    totalPupils,
    thisSchoolSector: trackedThisSchoolSector,
    thisSchoolSectorSchoolCount,
    thisSchoolPupilShareOfSector,
  };
}
