import { Card, CardHeading, CardSubheading, Caption } from "./Card";
import { ShapeIcon, SHAPE_LABELS } from "./ShapeIcon";
import type { ShapeLabel, ShapeMetrics } from "@/lib/shape-classifier";
import type { AgeGenderCounts } from "@/lib/roll-data";
import ShapeChart from "@/components/ShapeChart";

// Full width -- the key section (design reference). "Population trend(s) in the area"
// used to render at the bottom of THIS card -- extracted 2026-09-27 into its own
// PopulationTrendSection panel (page.tsx, rendered directly after this one), Guy's
// own call to give it equal visual weight rather than reading as a footnote to
// Shape. See that component's own module comment for the metric/band derivation
// trail (docs/OPEN_QUESTIONS.md, 2026-08-28).
//
// 2026-09-09, round 15: the icon+label moved OUT of the left column entirely -- it's
// now the lead visual of the RIGHT column, paired with the numeric shape definition
// (narrative.ts's numericShapeDefinition, replacing the old static SHAPE_EXPLANATIONS
// prose) and the qualifier addenda (shape-qualifiers.ts -- erratic, single-age
// anomaly, gender-shape divergence, gender-mix, still-drifting, in that deterministic
// order; borderline/multipleSteps stay data-only, no wording yet). The left column
// holds only the chart -- this school's own age/gender profile is the thing a reader
// looks at first, the icon+definition is the thing that tells them what they're
// looking at.
//
// 2026-09-25: "Nearest matched schools" (prose summary, bar chart, member-gated named
// list) moved OUT into its own NearestMatchedSchoolsCard, no longer rendered here --
// Guy's own live layout call, freeing this card up to be just the one school's own
// shape. The "combined shape of these local schools is X" icon+caption block that
// used to sit at the bottom of that section is dropped entirely, not carried over to
// the new card -- Guy's own call: a pooled average across ten different schools'
// shapes doesn't mean anything on its own.
//
// AggregateShapeChart itself is NOT deleted -- flagged as currently unused rather than
// removed outright (round 5 instruction: may want it again later for a different
// slot). Its own pooled-age-profile data (aggregateAgeCounts) is still computed by
// aggregateSurroundingStat() in surrounding-schools.ts; this card just no longer takes
// it as a prop, since nothing here renders it any more.
//
// 2026-09-27, shape icon column: the six real shapes ShapeIcon/classifyShape() can
// actually return, in the same order SHAPE_LABELS/shape-classifier.ts already lists
// them -- "irregular" deliberately excluded, confirmed (not assumed) still genuinely
// dead: shape-classifier.ts's own type comment says "never returned by classifyShape
// any more," and a direct grep of that file found no `return "irregular"` anywhere in
// the real classification logic, only that comment. If classifyShape is ever changed
// to return it again, this list needs updating by hand -- not derived from
// SHAPE_LABELS' own keys, which still includes it for ShapeIcon's own exhaustive
// switch.
const LIVE_SHAPES: ShapeLabel[] = ["tube", "pyramid", "top_step", "funnel", "mushroom", "wineglass"];
// Muted opacity for the five non-active icons -- ShapeIcon's own gold-circle theming
// (CircleTheme, that component's own file) is reused as-is for the active icon
// (full-strength, exactly as every other call site already renders it); the other
// five are dimmed via a plain wrapper opacity rather than a second colour system, so
// there's only ever one "shape icon" visual language on this page, just muted or not.
const MUTED_ICON_OPACITY = 0.3;

export function ShapeCard({
  ageGenderCounts,
  shape,
  shapeMetrics,
  shapeDominantTransition,
  shapeDefinition,
  phaseSplitSentence,
  shapeQualifierAddenda,
}: {
  ageGenderCounts: AgeGenderCounts | null;
  shape: ShapeLabel | null;
  // 2026-09-06, qualifier build round 12: threaded straight through from
  // classifyShape()'s own result (page.tsx) into ShapeChart's overlay props --
  // ShapeCard doesn't read either itself, just passes them on. Optional/nullable
  // because `shape` itself is (insufficient data for a school this young/small).
  shapeMetrics?: ShapeMetrics;
  shapeDominantTransition?: { fromAge: string; toAge: string } | null;
  // 2026-09-09, round 15: both already fully rendered by page.tsx (narrative.ts's
  // numericShapeDefinition/renderNumericShapeDefinition + the qualifier render
  // functions, in shape-qualifiers.ts's own deterministic order) -- ShapeCard is
  // presentational here, same as how it already receives `summary` pre-rendered
  // rather than computing prose itself. Needed shape.moves (only on classifyShape's
  // own result, not on ShapeQualifiers) to locate the single-age-anomaly's own year,
  // which page.tsx already has and this component doesn't.
  shapeDefinition: string | null;
  // 2026-09-11, round 19, item 7: through-schools only (page.tsx gates on
  // typology.phase.length > 1) -- a second sentence in the same block, real/true but
  // correlated (not the classification's own decisive mechanism), so it renders after
  // shapeDefinition, never folded into it or into the qualifier addenda below (those
  // are the shape's own trajectory qualifiers, this is a different, independent fact).
  phaseSplitSentence: string | null;
  shapeQualifierAddenda: string | null;
}) {
  return (
    <Card size="full">
      <CardHeading title="Shape" subtitle="This school's age & gender profile" />
      <div className="flex flex-col gap-6 border-b border-stone-100 pb-2 sm:flex-row sm:gap-8 dark:border-stone-800">
        <div className="min-w-0 flex-1">
          <CardSubheading title="This school" subtitle="Ages 4–18, by gender — the single-year roll profile" />
          {ageGenderCounts ? (
            <ShapeChart
              ageGenderCounts={ageGenderCounts}
              metrics={shapeMetrics}
              dominantTransition={shapeDominantTransition}
            />
          ) : (
            <Caption>No age-by-age roll data to chart.</Caption>
          )}
        </div>
        <div className="hidden w-px self-stretch bg-stone-100 sm:block dark:bg-stone-800" />
        <div className="min-w-0 flex-1">
          {shape ? (
            <div className="mb-5 flex items-start gap-4">
              {/* 2026-09-27: single icon replaced with a column of all six live
                  shapes, this school's own one highlighted -- same idea as
                  PhaseBreakdownCard's XS-XL badges (every category shown, current one
                  distinguished from the muted rest), applied to the shape taxonomy.
                  "For now" placement (Guy's own framing) -- still directly left of
                  the name/definition text block, not a final decision on where this
                  belongs on the page. */}
              <div className="flex shrink-0 flex-col gap-2">
                {LIVE_SHAPES.map((s) => (
                  <div key={s} className="flex items-center gap-2" style={{ opacity: s === shape ? 1 : MUTED_ICON_OPACITY }}>
                    <ShapeIcon shape={s} size={72} />
                    <span className="text-[11.5px] font-medium text-stone-700 dark:text-stone-300">{SHAPE_LABELS[s]}</span>
                  </div>
                ))}
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="font-[family-name:var(--font-newsreader)] text-[24px] font-semibold leading-tight text-stone-900 dark:text-stone-100">
                  {SHAPE_LABELS[shape]}
                </h3>
                {shapeDefinition && (
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-300">{shapeDefinition}</p>
                )}
                {phaseSplitSentence && (
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-300">{phaseSplitSentence}</p>
                )}
                {shapeQualifierAddenda && (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400">
                    {shapeQualifierAddenda}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Caption className="mb-5">Not enough age 5–17 data to classify a shape this year.</Caption>
          )}
        </div>
      </div>
    </Card>
  );
}
