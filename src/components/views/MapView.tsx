"use client";

// VicData 0.6.1 S3c: a built map, in the wrapper its host draws it in -- so a page of presets
// draws exactly as v1 does. The title sits where each host puts it: inside the map's flex
// box on Comparisons' Current and Results' Trend map, above it on the Trend / Change maps.
import type { ViewSeries } from "@/lib/view-series";
import { RankingsMap } from "@/components/teacher/RankingsMap";
import { ViewTitle } from "@/components/teacher/SeriesViews";

export function MapView({ series, fullscreen }: { series: ViewSeries; fullscreen: boolean }) {
  const leaf = series.leaf;
  if (leaf.leaf !== "map") return null;
  const { map, place } = leaf;
  const chip = map.chip;
  const body = (heightClass: string, current: boolean) => (
    <RankingsMap
      profiles={map.profiles}
      targetUrn={leaf.targetUrn}
      stage={map.stage}
      heightClass={heightClass}
      subject={chip?.subject ?? null}
      subjectLabel={chip?.legend ?? null}
      subjectBucket={chip?.bucket ?? null}
      familyId={chip?.familyId ?? null}
      dense={!fullscreen}
      accentHex={map.accentHex}
      {...(current ? { onCaption: fullscreen ? undefined : map.onCaption, onTargetRank: map.onTargetRank } : {})}
      {...(leaf.untitledSizeLegend ? { untitledSizeLegend: true } : {})}
      {...(leaf.forcedColourMode ? { forcedColourMode: leaf.forcedColourMode } : {})}
      {...(leaf.changeValues ? { changeValues: leaf.changeValues } : {})}
      {...(leaf.teacherMap ? { teacherMap: leaf.teacherMap } : {})}
    />
  );
  if (place === "current") {
    return (
      <div className={fullscreen ? "print:hidden" : "flex min-h-0 flex-1 flex-col print:hidden"}>
        <ViewTitle>{series.title}</ViewTitle>
        {body(fullscreen ? "h-[70vh] min-h-[22rem]" : "min-h-[10rem] flex-1", true)}
      </div>
    );
  }
  const height = fullscreen ? "min-h-[22rem] flex-1" : "min-h-[10rem] flex-1";
  if (place === "trend") {
    return (
      <div className="flex min-h-0 flex-1 flex-col print:hidden">
        <ViewTitle>{series.title}</ViewTitle>
        {body(height, false)}
      </div>
    );
  }
  return (
    <>
      <ViewTitle>{series.title}</ViewTitle>
      <div className="flex min-h-0 flex-1 flex-col print:hidden">{body(height, false)}</div>
    </>
  );
}
