import { Card, CardHeading, CardSubheading, Caption } from "./Card";
import { ShapeIcon, SHAPE_LABELS } from "./ShapeIcon";
import { PopulationTrendSection } from "./PopulationTrendSection";
import type { ShapeLabel } from "@/lib/shape-classifier";
import type { AgeGenderCounts } from "@/lib/roll-data";
import type { PopulationTrend, AgeProfileSeries } from "@/lib/population-trend";
import ShapeChart from "@/components/ShapeChart";
import AggregateShapeChart from "@/components/AggregateShapeChart";

// Full width -- the key section (design reference). "Population trend in the area"
// (real DfE census school-enrolment, ages 5-15, Growing/Stable/Decline/Steep
// Decline/Severe Decline) was investigated and built 2026-08-28 -- full trail
// (why school census not ONS, the LA->region crosswalk, the metric/band derivation
// across several rounds of real-data checks) logged in docs/OPEN_QUESTIONS.md.
export function ShapeCard({
  ageGenderCounts,
  shape,
  aggregateAgeCounts,
  aggregateShape,
  populationTrend,
}: {
  ageGenderCounts: AgeGenderCounts | null;
  shape: ShapeLabel | null;
  aggregateAgeCounts: Map<number, number> | null;
  aggregateShape: ShapeLabel | null;
  populationTrend: {
    laName: string;
    laTrend: PopulationTrend | null;
    laSeries: AgeProfileSeries | null;
    region: string | null;
    regionTrend: PopulationTrend | null;
    regionSeries: AgeProfileSeries | null;
  } | null;
}) {
  return (
    <Card size="full">
      <CardHeading title="Shape" subtitle="This school's age & gender profile, and how it compares with the peer-matched average" />
      <div className="flex flex-col gap-6 border-b border-stone-100 pb-2 sm:flex-row sm:gap-8 dark:border-stone-800">
        <div className="min-w-0 flex-[1.4]">
          <CardSubheading title="This school" subtitle="Ages 4–18, by gender — the single-year roll profile" />
          {ageGenderCounts && <ShapeChart ageGenderCounts={ageGenderCounts} />}
          {shape ? (
            <div className="mt-3 flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <ShapeIcon shape={shape} />
              <span className="font-[family-name:var(--font-newsreader)] text-[17px] font-medium">{SHAPE_LABELS[shape]}</span>
            </div>
          ) : (
            <Caption className="mt-3">Not enough age 5–17 data to classify a shape this year.</Caption>
          )}
        </div>
        <div className="hidden w-px self-stretch bg-stone-100 sm:block dark:bg-stone-800" />
        <div className="min-w-0 flex-[1.1]">
          <CardSubheading title="Peer-matched" subtitle="Combined age profile of the nearest matched schools" />
          {aggregateAgeCounts && <AggregateShapeChart ageCounts={aggregateAgeCounts} />}
          {aggregateShape && (
            <div className="mt-3 flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <ShapeIcon shape={aggregateShape} size={20} />
              <span className="text-[14px] font-medium">{SHAPE_LABELS[aggregateShape]}</span>
            </div>
          )}
          <Caption className="mt-1">
            Same taxonomy as an individual school&rsquo;s shape, since this is an average of real school-level shapes, not a
            raw population.
          </Caption>
        </div>
      </div>
      {populationTrend && (
        <PopulationTrendSection
          laName={populationTrend.laName}
          laTrend={populationTrend.laTrend}
          laSeries={populationTrend.laSeries}
          region={populationTrend.region}
          regionTrend={populationTrend.regionTrend}
          regionSeries={populationTrend.regionSeries}
        />
      )}
    </Card>
  );
}
