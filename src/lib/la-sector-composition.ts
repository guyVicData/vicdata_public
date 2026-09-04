// LA sector-composition donut + "1 of N" line (dashboard rebuild, Roll card).
// Deliberately a single live query, not a new precomputed aggregate like
// roll_aggregates/age_band_pupil_distributions -- a per-LA scan of the `schools`
// table (typically a few hundred rows) is cheap; this is NOT the same "thousands of
// schools' phase-sliced census data through a paginated remote RPC" problem those
// aggregates exist to avoid (see docs/OPEN_QUESTIONS.md, 2026-08-28 investigation).
//
// Real, deliberate scope note: pupil counts here are GIAS's own `number_of_pupils`
// snapshot field (ingest/sources/gias.py), NOT the same DfE census figure the rest of
// this page uses -- a genuinely different source/provenance, same "flag it, don't
// blend it silently" discipline as the map's ILR-vs-census marker distinction.
// Schools with a null number_of_pupils are excluded from every percentage/count here
// (not treated as zero), so a sparse LA doesn't silently under-report. The viewed
// school's own share is computed from ITS OWN number_of_pupils too (not the census
// totalRoll shown elsewhere on the page) -- mixing the two sources for one ratio would
// be the exact silent-blend this project avoids everywhere else.
//
// 2026-09-12, FE-sector build step 3: number_of_pupils' real fill rate for FE-sector
// rows is 0.0% (confirmed live, all 6 FE_ESTABLISHMENT_TYPES, 2,156 open schools) --
// the ~89% figure this comment used to cite was a whole-table average dominated by
// mainstream schools (Academies alone sample at 94.1%), not representative of FE at
// all. This is the entire cause of FE's silent 0% in this donut. Fixed with the same
// under-19 ILR fallback the map's own batch route already uses (schools-in-bounds/
// route.ts's ilrCandidates block is the direct template) -- under-19 total ONLY, never
// the adult/19+ figure, since this donut compares school-age footprint across sectors
// and pulling in adult FE participants would inflate FE's slice in a way that isn't
// like-for-like with State/Independent's own child-only counts. A row with neither
// number_of_pupils nor under-19 ILR data stays excluded, same honest-gap behaviour as
// before -- no number is fabricated for it.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData } from "./vicdata-reference";
import { sectorTag, type SectorTag, FE_PARTICIPATION_ESTABLISHMENT_TYPES } from "./typology";
import { under19Totals, UNDER_19_TOTAL_BREAKDOWN } from "./fe-participation-roll";
import { cleanLaNameForDisplay } from "./la-name-display";

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
  // 2026-09-12, FE-sector build step 3: how many of bySector.FE's schools were sized
  // from ILR data (dfe_fe_participation's under-19 total) rather than GIAS's
  // number_of_pupils -- a count, not a per-school breakdown, so the donut's caption can
  // say "N of these were sized from a different source" without a third data source
  // silently blending into the figure. Always 0 when bySector.FE.schools itself is 0.
  feIlrFallbackSchoolCount: number;
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
    .select("urn, establishment_type_group, establishment_type, number_of_pupils")
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

  const rows = data as {
    urn: string;
    establishment_type_group: string | null;
    establishment_type: string | null;
    number_of_pupils: number | null;
  }[];

  // FE rows with no GIAS figure at all -- collected during the first pass, resolved
  // via a single batched ILR lookup below (never one round-trip per school). Pre-
  // filtered to FE_PARTICIPATION_ESTABLISHMENT_TYPES (the actual dfe_fe_participation
  // UKPRN<->URN crosswalk scope) so HE institutions/Miscellaneous/Welsh establishment
  // -- never in that crosswalk -- don't spend a lookup that's guaranteed to return
  // nothing, same reasoning fe-participation-roll.ts's own comment already gives.
  const feIlrCandidateUrns: string[] = [];

  for (const row of rows) {
    const sector = asTrackedSector(sectorTag(row.establishment_type_group, row.establishment_type));
    if (!sector) continue;
    if (row.number_of_pupils !== null) {
      bySector[sector].schools += 1;
      bySector[sector].pupils += row.number_of_pupils;
      continue;
    }
    if (sector === "FE" && FE_PARTICIPATION_ESTABLISHMENT_TYPES.includes(row.establishment_type ?? "")) {
      feIlrCandidateUrns.push(row.urn);
    }
    // else: genuinely excluded, no number_of_pupils and no possible ILR fallback --
    // same honest-gap behaviour as before this fix.
  }

  let feIlrFallbackSchoolCount = 0;
  if (feIlrCandidateUrns.length > 0) {
    const feFacts = await lookupReferenceData({
      sourceId: "dfe_fe_participation",
      entityIds: feIlrCandidateUrns,
      breakdowns: [UNDER_19_TOTAL_BREAKDOWN],
    });
    const totals = under19Totals(feFacts);
    for (const urn of feIlrCandidateUrns) {
      const t = totals.get(urn);
      if (!t) continue; // no real ILR data either -- stays excluded, not fabricated
      bySector.FE.schools += 1;
      bySector.FE.pupils += t.total;
      feIlrFallbackSchoolCount += 1;
    }
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
    // 2026-09-29: cleaned for DISPLAY only -- the real query above (.eq("la_name",
    // laName)) already ran against the raw value; every consumer of this returned
    // laName (RollCard, narrative.ts's paragraph2SectorSize/FE-college sentences) only
    // ever interpolates it into prose, never queries with it again.
    laName: cleanLaNameForDisplay(laName),
    bySector,
    totalPupils,
    thisSchoolSector: trackedThisSchoolSector,
    thisSchoolSectorSchoolCount,
    thisSchoolPupilShareOfSector,
    feIlrFallbackSchoolCount,
  };
}
