import { Card, CardHeading, CardSubheading, Caption, Eyebrow } from "./Card";
import { ShapeIcon, SHAPE_LABELS } from "./ShapeIcon";
import { PopulationTrendSection } from "./PopulationTrendSection";
import type { ShapeLabel, ShapeMetrics } from "@/lib/shape-classifier";
import type { AgeGenderCounts } from "@/lib/roll-data";
import type { PopulationTrend, AgeProfileSeries } from "@/lib/population-trend";
import ShapeChart from "@/components/ShapeChart";
import SurroundingRollBarChart from "@/components/SurroundingRollBarChart";
import SurroundingSchoolsMemberList from "@/components/SurroundingSchoolsMemberList";

// Full width -- the key section (design reference). "Population trend in the area"
// (real DfE census school-enrolment, ages 5-15, Growing/Stable/Decline/Steep
// Decline/Severe Decline) was investigated and built 2026-08-28 -- full trail
// (why school census not ONS, the LA->region crosswalk, the metric/band derivation
// across several rounds of real-data checks) logged in docs/OPEN_QUESTIONS.md.
//
// Layout/graphs spec v1 §11-12, round 5: the right side used to be a small
// "Peer-matched" chart (AggregateShapeChart, a pooled age-profile bar chart) plus a
// one-line shape label. That's replaced here with SurroundingSchoolsCard's whole
// former content (prose summary, "combined shape is X" clause, member-gated caption,
// the real named list behind its own existing auth gate) -- moved in wholesale, not
// duplicated; SurroundingSchoolsCard itself no longer exists as a separate page card
// (see SmallCards.tsx -- its function was removed, not left dead). A new
// SurroundingRollBarChart sits between the summary and the member-gated caption: one
// bar per school in the same nearest-10 set, grey/numbered for peers, named+coloured
// for the focus school -- see that component's own comment for the colour choices.
//
// AggregateShapeChart itself is NOT deleted -- flagged as currently unused rather than
// removed outright (round 5 instruction: may want it again later for a different
// slot). Its own pooled-age-profile data (aggregateAgeCounts) is still computed by
// aggregateSurroundingStat() in surrounding-schools.ts; this card just no longer takes
// it as a prop, since nothing here renders it any more.
export function ShapeCard({
  ageGenderCounts,
  shape,
  shapeMetrics,
  shapeDominantTransition,
  populationTrend,
  urn,
  schoolName,
  schoolRoll,
  peerRolls,
  summary,
  aggregateShape,
  found,
}: {
  ageGenderCounts: AgeGenderCounts | null;
  shape: ShapeLabel | null;
  // 2026-09-06, qualifier build round 12: threaded straight through from
  // classifyShape()'s own result (page.tsx) into ShapeChart's overlay props --
  // ShapeCard doesn't read either itself, just passes them on. Optional/nullable
  // because `shape` itself is (insufficient data for a school this young/small).
  shapeMetrics?: ShapeMetrics;
  shapeDominantTransition?: { fromAge: string; toAge: string } | null;
  populationTrend: {
    laName: string;
    laTrend: PopulationTrend | null;
    laSeries: AgeProfileSeries | null;
    region: string | null;
    regionTrend: PopulationTrend | null;
    regionSeries: AgeProfileSeries | null;
  } | null;
  urn: string;
  schoolName: string;
  schoolRoll: number;
  peerRolls: number[];
  summary: string | null;
  aggregateShape: ShapeLabel | null;
  found: number;
}) {
  return (
    <Card size="full">
      <CardHeading title="Shape" subtitle="This school's age & gender profile, and how it compares with the nearest matched schools" />
      <div className="flex flex-col gap-6 border-b border-stone-100 pb-2 sm:flex-row sm:gap-8 dark:border-stone-800">
        <div className="min-w-0 flex-1">
          <CardSubheading title="This school" subtitle="Ages 4–18, by gender — the single-year roll profile" />
          {ageGenderCounts && (
            <ShapeChart
              ageGenderCounts={ageGenderCounts}
              metrics={shapeMetrics}
              dominantTransition={shapeDominantTransition}
            />
          )}
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
        <div className="min-w-0 flex-1">
          <Eyebrow>Nearest matched schools</Eyebrow>
          {found > 0 && summary ? (
            <>
              <p className="text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-300">
                {summary}
                {aggregateShape && (
                  <>
                    {" "}
                    The combined shape is{" "}
                    <span className="inline-flex items-center gap-1 align-text-bottom font-semibold">
                      <ShapeIcon shape={aggregateShape} size={14} /> {SHAPE_LABELS[aggregateShape]}
                    </span>
                    .
                  </>
                )}
              </p>
              <SurroundingRollBarChart focusName={schoolName} focusRoll={schoolRoll} peerRolls={peerRolls} />
              <Caption className="mt-2.5">The {found} schools behind this comparison are visible to verified members.</Caption>
              <SurroundingSchoolsMemberList urn={urn} />
            </>
          ) : (
            <Caption className="mt-2">Not enough nearby comparable schools with roll data to show this yet.</Caption>
          )}
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
