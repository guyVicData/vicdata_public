"use client";

// Teacher view, round 5: the Rankings card's map is the advanced dashboard's own
// AcademicMapView, not a lookalike -- same bivariate encoding (dot size = entries, or the
// Year 6 cohort at KS2; colour = grade band or trend), same dashed distance ring, same
// size legend and colour key, same fitBounds to the set.
//
// Scoped to Teacher view's own comparator vocabulary: the set is exactly the Nearest 10
// the card already ranks against (the dashboard route's phase-filtered neighbours), so the
// map and the "N of M" beside it are always about the same schools.
import AcademicMapView from "@/components/data-view/AcademicMapView";
import { igcseExclusionLikely, type AcademicSchoolProfile, type KsStage } from "@/lib/academic-data-view";

export function RankingsMap({
  profiles,
  targetUrn,
  stage,
  heightClass,
  subject = null,
  subjectLabel = null,
  subjectBucket = null,
  dense = false,
}: {
  profiles: AcademicSchoolProfile[] | null;
  targetUrn: string;
  stage: KsStage;
  heightClass: string;
  // The ticked subject the map is currently plotting (the card's chips choose it); null
  // plots the whole-school headline, as before. Passed straight to AcademicMapView's
  // subject mode.
  subject?: string | null;
  subjectLabel?: string | null;
  subjectBucket?: string | null;
  // The card-size map passes true: AcademicMapView's compact overlays (one caption line)
  // instead of the full legend stack the fullscreen map keeps.
  dense?: boolean;
}) {
  const target = profiles?.find((p) => p.urn === targetUrn) ?? null;
  if (!profiles) {
    return <div className={`${heightClass} mt-2 flex items-center justify-center rounded-md bg-neutral-100 text-xs text-neutral-500 dark:bg-neutral-900`}>Loading map…</div>;
  }
  if (!target || target.easting === null || target.northing === null) {
    return <p className="mt-2 text-xs text-neutral-500">No location is recorded for this school, so there is no map to draw.</p>;
  }
  return (
    // `isolate` gives the map its own stacking context, so Leaflet's panes and the map's
    // z-[1000] overlays stay inside the card instead of competing with the rest of the
    // page -- including the fullscreen modal's backdrop.
    <div className={`${heightClass} relative isolate mt-2 overflow-hidden rounded-md`}>
      <AcademicMapView
        targetProfile={target}
        tickedProfiles={profiles.filter((p) => p.urn !== targetUrn)}
        stage={stage}
        activeSetLabel="the 10 nearest schools"
        subject={subject}
        subjectLabel={subjectLabel}
        subjectBucket={subjectBucket}
        dense={dense}
        // Same GCSE exclusion the advanced dashboard's map applies, with its own note.
        ks4ExcludedUrns={stage === "ks4" ? new Set(profiles.filter(igcseExclusionLikely).map((p) => p.urn)) : undefined}
      />
    </div>
  );
}
