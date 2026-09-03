// Shape qualifiers (rolls spec §4, qualifier build round, 2026-09-04). Layered on top
// of classifyShape()'s six-shape primary output, never feeding back into it -- every
// function here CONSUMES classifyShape()'s output (label/moves/dominantTransition/
// metrics) plus the raw per-age/sex counts, and reuses classifyShape() itself for the
// gender-split check below. No classification logic is duplicated: every threshold
// this file reuses from shape-classifier.ts is imported, not re-typed.
//
// Reported and eventually surfaced, per Guy's own brief -- never gatekeeping the
// primary shape the way the old reversal-based "irregular" fallback used to. A school
// can be Wineglass AND erratic AND borderline all at once; none of that changes its
// label.
//
// Every threshold below marked "placeholder" is exactly that -- a first, defensible
// value to build and validate the mechanism against, not a discovered boundary. Real
// national distributions for each are in this round's own report, same discipline as
// every other threshold in this project: reported, not silently treated as final.

import {
  classifyShape,
  type ShapeLabel,
  type ShapeMetrics,
  MUSHROOM_TOP_STEP_SHARE_THRESHOLD,
  FLAT_RATIO_HIGH,
  FLAT_RATIO_LOW,
  WINEGLASS_MAGNITUDE_RATIO,
  THORNTON_NET_CHANGE_THRESHOLD,
} from "./shape-classifier";
import {
  shapeClassifierInputByGender,
  classificationAgeSpan,
  genderShareByAge,
  type AgeGenderCounts,
} from "./roll-data";
import { SINGLE_SEX_SUPPRESSION_BAND } from "./narrative";

type Move = "up" | "down" | "flat";
type ClassifyResult = NonNullable<ReturnType<typeof classifyShape>>;

// ---------------------------------------------------------------------------
// Erratic/volatile -- reversalCount >= 2, sign changes among consecutive REAL
// (non-flat) moves. Marlborough College (down, up, down -- moves=[flat,down,up,down])
// is the working anchor: 2 reversals, confirmed by hand and by the national
// distribution report this round.
// ---------------------------------------------------------------------------
export const ERRATIC_REVERSAL_THRESHOLD = 2;

export function computeReversalCount(moves: Move[]): number {
  const nonFlat = moves.filter((m) => m !== "flat");
  let reversals = 0;
  for (let i = 1; i < nonFlat.length; i++) {
    if (nonFlat[i] !== nonFlat[i - 1]) reversals++;
  }
  return reversals;
}

export function isErratic(reversals: number): boolean {
  return reversals >= ERRATIC_REVERSAL_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Single-age anomaly -- exactly one non-flat entry in moves[], but resolved via the
// net-trajectory path, not the step path. Pure boolean, no threshold: a school whose
// ENTIRE real signal is one age's move, and where that one move didn't even end up
// deciding a step-shaped label (Top Step's own survival gate failed it, or Mushroom's
// tail-width cap excluded it -- Aston University Mathematics School and Seaton
// Sluice Middle School/Blackhall Primary School are real examples of each), had its
// whole net-trajectory read hinge on that single age -- worth flagging regardless of
// which label it landed on.
// ---------------------------------------------------------------------------
export function isSingleAgeAnomaly(moves: Move[], label: ShapeLabel): boolean {
  const nonFlatCount = moves.filter((m) => m !== "flat").length;
  return nonFlatCount === 1 && label !== "mushroom" && label !== "top_step";
}

// ---------------------------------------------------------------------------
// Broad direction family -- a static three-way grouping on top of ShapeLabel, for the
// gender-shape-divergence materiality rule below. top_heavy = grows toward the old
// end (Funnel/Wineglass/Mushroom); bottom_heavy = shrinks toward the old end
// (Pyramid/Top Step); flat = Tube. "irregular" is dead (never returned by
// classifyShape, see shape-classifier.ts) but handled defensively as flat rather than
// left to throw.
// ---------------------------------------------------------------------------
export type BroadDirection = "top_heavy" | "bottom_heavy" | "flat";

const TOP_HEAVY_LABELS = new Set<ShapeLabel>(["funnel", "wineglass", "mushroom"]);
const BOTTOM_HEAVY_LABELS = new Set<ShapeLabel>(["pyramid", "top_step"]);

export function broadDirection(label: ShapeLabel): BroadDirection {
  if (TOP_HEAVY_LABELS.has(label)) return "top_heavy";
  if (BOTTOM_HEAVY_LABELS.has(label)) return "bottom_heavy";
  return "flat";
}

// ---------------------------------------------------------------------------
// Gender-shape divergence -- classifyShape() run independently on the male-only and
// female-only sequences (same span as the combined classification, so ages line up).
// Suppressed entirely below SINGLE_SEX_SUPPRESSION_BAND (reused from narrative.ts,
// not reinvented) -- a single-sex-in-practice school's "other" gender sequence is
// noise, not a real second shape to compare against.
//
// 2026-09-05, materiality gate (round 8 follow-up): a bare label mismatch fires at
// 65.95% nationally, confirmed too loose -- independently classifying two similar-
// but-not-identical sequences through a several-threshold categorical system
// disagrees often even on real, modest differences (Charterhouse's own honest
// framing: "male ratio 1.16, female ratio 1.14" would read as Funnel vs Tube, a
// label difference with no real substance behind it). First fix: compare the
// CONTINUOUS value that actually decided each gender's own label -- metrics.ratio
// when net trajectory decided, metrics.stepShare when a step did -- directly, gated
// on a real minimum gap. That alone wasn't enough: "mixed" pairs (one gender step-
// decided, the other net-trajectory-decided) turned out to be the MAJORITY of raw
// fires (54.2%), not a rare edge case, and no numeric gap cutoff on the other two
// kinds could touch them.
//
// 2026-09-05, direction-family fix (round 11): the real signal was never really "does
// a number clear a bar," it's "do the two genders disagree about the school's basic
// shape story." broadDirection() above answers that directly and works identically
// across all three mechanism kinds:
//  - Opposite broad direction (top_heavy vs bottom_heavy, or either vs flat) is
//    material regardless of mechanism or magnitude -- Charterhouse (male Mushroom =
//    top_heavy, female Top Step = bottom_heavy) fires here now, correctly, without
//    needing its step-share gap (0.1245) to clear any cutoff at all.
//  - Same broad direction (e.g. Funnel vs Wineglass, both top_heavy) falls back to
//    the numeric gap gate ONLY when both genders resolved the same way (both ratio,
//    or both step) -- unchanged from the materiality-gate round, still parameterised
//    rather than hard-locked (GENDER_SHAPE_RATIO_GAP_CUTOFF/GENDER_SHAPE_STEP_SHARE_
//    GAP_CUTOFF below are reasonable defaults, not the final word).
//  - Same broad direction + mixed kind (e.g. male Mushroom vs female Funnel -- both
//    top_heavy, but one step-decided and one ratio-decided) has no shared numeric
//    scale AND no direction disagreement to fall back on -- reported as its own
//    "same_direction_mixed" bucket, a softer signal, never folded into the primary
//    material boolean.
// ---------------------------------------------------------------------------
export type GenderShapeDivergenceKind = "ratio" | "step_share" | "mixed";
export type GenderShapeDivergenceMateriality = "opposite_direction" | "same_direction_gap" | "same_direction_mixed";

export type GenderShapeDivergence = {
  maleLabel: ShapeLabel;
  femaleLabel: ShapeLabel;
  maleDirection: BroadDirection;
  femaleDirection: BroadDirection;
  kind: GenderShapeDivergenceKind;
  // Absolute gap in whichever unit `kind` indicates -- null for "mixed" (no shared
  // scale to subtract on).
  gap: number | null;
  materiality: GenderShapeDivergenceMateriality;
};

export function genderShapeDivergence(ageGenderCounts: AgeGenderCounts): GenderShapeDivergence | null {
  const span = classificationAgeSpan(ageGenderCounts);
  if (!span) return null;

  let totalMale = 0;
  let totalFemale = 0;
  for (let age = span.minAge; age <= span.maxAge; age++) {
    const c = ageGenderCounts.get(age);
    if (!c) continue;
    totalMale += c.male;
    totalFemale += c.female;
  }
  const total = totalMale + totalFemale;
  if (total === 0) return null;
  if (Math.min(totalMale, totalFemale) / total <= SINGLE_SEX_SUPPRESSION_BAND) return null;

  const maleResult = classifyShape(shapeClassifierInputByGender(ageGenderCounts, span, "male"));
  const femaleResult = classifyShape(shapeClassifierInputByGender(ageGenderCounts, span, "female"));
  if (!maleResult || !femaleResult) return null;
  if (maleResult.label === femaleResult.label) return null;

  const maleDirection = broadDirection(maleResult.label);
  const femaleDirection = broadDirection(femaleResult.label);

  const maleMetrics = maleResult.metrics;
  const femaleMetrics = femaleResult.metrics;
  let kind: GenderShapeDivergenceKind;
  let gap: number | null;
  if (maleMetrics.ratio !== null && femaleMetrics.ratio !== null) {
    kind = "ratio";
    gap = Math.abs(femaleMetrics.ratio - maleMetrics.ratio);
  } else if (maleMetrics.stepShare !== null && femaleMetrics.stepShare !== null) {
    kind = "step_share";
    gap = Math.abs(femaleMetrics.stepShare - maleMetrics.stepShare);
  } else {
    kind = "mixed";
    gap = null;
  }

  const materiality: GenderShapeDivergenceMateriality =
    maleDirection !== femaleDirection ? "opposite_direction" : kind === "mixed" ? "same_direction_mixed" : "same_direction_gap";

  return { maleLabel: maleResult.label, femaleLabel: femaleResult.label, maleDirection, femaleDirection, kind, gap, materiality };
}

// Reasonable defaults for the same-direction-same-kind numeric gate -- the
// "already validated" part of the materiality gate, unchanged in mechanism from the
// materiality-gate round, just no longer carrying the whole qualifier's weight now
// that opposite-direction is split out. This population is much smaller than before
// (most of what used to need gap-gating was actually opposite-direction), so the
// exact cutoff value matters less than it used to -- still not treated as final.
export const GENDER_SHAPE_RATIO_GAP_CUTOFF = 0.2;
export const GENDER_SHAPE_STEP_SHARE_GAP_CUTOFF = 0.1;

// Materiality gate: opposite direction is always material, regardless of mechanism or
// magnitude. Same direction + mixed kind is never material via THIS boolean -- it's
// the separate, softer "same_direction_mixed" signal (still visible on the raw
// GenderShapeDivergence result via its own `materiality` field, just not counted
// here). Same direction + same kind falls back to the numeric gap gate.
export function isGenderShapeDivergenceMaterial(
  d: GenderShapeDivergence,
  ratioGapCutoff: number = GENDER_SHAPE_RATIO_GAP_CUTOFF,
  shareGapCutoff: number = GENDER_SHAPE_STEP_SHARE_GAP_CUTOFF,
): boolean {
  if (d.materiality === "opposite_direction") return true;
  if (d.materiality === "same_direction_mixed") return false;
  if (d.gap === null) return false;
  return d.kind === "ratio" ? d.gap >= ratioGapCutoff : d.gap >= shareGapCutoff;
}

// ---------------------------------------------------------------------------
// Gender-mix % variation -- female share per age (genderShareByAge, roll-data.ts),
// range = max-min share across the classification span, plus a drift-vs-erratic read
// on the share DELTAS themselves (same concordant/discordant consistency calc the
// Thornton mechanism already uses, applied here to a different sequence -- share
// deltas rather than roll deltas).
//
// 2026-09-05, threshold LOCKED (round 11): range > 20pp alone fired on 46.6% of
// schools nationally -- checked a peak-roll floor instead of (or alongside) a bigger
// range, since a small school's own per-age female share is inherently noisy (one or
// two pupils moves it a lot) even when its range technically clears 20pp. range>20pp
// AND peakRoll>=100 together get to 2.5% nationally -- confirmed against live data
// this round -- a genuinely selective rate, and far more effective than raising the
// range bar alone (range>30pp alone was still 21.0%).
// ---------------------------------------------------------------------------
export const GENDER_MIX_MIN_RANGE_PP = 0.2;
export const GENDER_MIX_MIN_PEAK_ROLL = 100;

export type GenderMixVariation = {
  rangePp: number;
  consistency: number;
  peakRoll: number;
  notable: boolean;
  // 2026-09-11, round 19, item 7: min/max female share across the classified span --
  // additive alongside rangePp (their difference), needed to restore the qualifier's
  // rendered text ("girls making up between X% and Y% of their year group") which
  // rangePp alone can't reconstruct (a width doesn't recover its own endpoints).
  minSharePct: number;
  maxSharePct: number;
};

export function genderMixVariation(ageGenderCounts: AgeGenderCounts): GenderMixVariation | null {
  const span = classificationAgeSpan(ageGenderCounts);
  if (!span) return null;
  const shares = genderShareByAge(ageGenderCounts, span);
  const ages = Array.from(shares.keys()).sort((a, b) => a - b);
  if (ages.length < 2) return null;

  const values = ages.map((a) => shares.get(a)!);
  const range = Math.max(...values) - Math.min(...values);
  const netChange = values[values.length - 1] - values[0];

  let concordant = 0;
  let discordant = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff === 0) continue;
    if (Math.sign(diff) === Math.sign(netChange)) concordant += Math.abs(diff);
    else discordant += Math.abs(diff);
  }
  const totalMagnitude = concordant + discordant;
  const consistency = totalMagnitude > 0 ? concordant / totalMagnitude : 1;

  let peakRoll = 0;
  for (let age = span.minAge; age <= span.maxAge; age++) {
    const c = ageGenderCounts.get(age);
    if (c) peakRoll = Math.max(peakRoll, c.male + c.female);
  }

  const notable = range > GENDER_MIX_MIN_RANGE_PP && peakRoll >= GENDER_MIX_MIN_PEAK_ROLL;
  return {
    rangePp: range,
    consistency,
    peakRoll,
    notable,
    minSharePct: Math.min(...values) * 100,
    maxSharePct: Math.max(...values) * 100,
  };
}

// ---------------------------------------------------------------------------
// Borderline -- margin between whatever value actually decided the shape and its own
// threshold. Reads metrics.stepShare (vs MUSHROOM_TOP_STEP_SHARE_THRESHOLD) when a
// step won, or metrics.ratio (vs the flat floor or the wineglass ratio) when net
// trajectory decided -- never both, matching how classifyShape itself only ever
// populates one of the two (see ShapeMetrics's own comment). Placeholder margins:
// +-0.05 on share, +-0.05 applied directly to the flat-floor ratio boundaries
// (1.15/0.87), +-0.2 (10% of 2.0) on the wineglass ratio -- reported at a couple of
// candidate margins this round, not locked.
// ---------------------------------------------------------------------------
export const STEP_SHARE_MARGIN = 0.05;
export const FLAT_FLOOR_MARGIN = 0.05;
export const WINEGLASS_RATIO_MARGIN = 0.2;

export type Borderline = { kind: "step_share" | "flat_floor" | "wineglass_ratio"; margin: number };

export function borderline(metrics: ShapeMetrics): Borderline | null {
  if (metrics.stepShare !== null) {
    const margin = metrics.stepShare - MUSHROOM_TOP_STEP_SHARE_THRESHOLD;
    return Math.abs(margin) <= STEP_SHARE_MARGIN ? { kind: "step_share", margin } : null;
  }
  if (metrics.ratio !== null) {
    const marginHigh = metrics.ratio - FLAT_RATIO_HIGH;
    if (Math.abs(marginHigh) <= FLAT_FLOOR_MARGIN) return { kind: "flat_floor", margin: marginHigh };
    const marginLow = metrics.ratio - FLAT_RATIO_LOW;
    if (Math.abs(marginLow) <= FLAT_FLOOR_MARGIN) return { kind: "flat_floor", margin: marginLow };
    const marginWine = metrics.ratio - WINEGLASS_MAGNITUDE_RATIO;
    if (Math.abs(marginWine) <= WINEGLASS_RATIO_MARGIN) return { kind: "wineglass_ratio", margin: marginWine };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Still drifting -- Mushroom/Top Step only. The winning step's own tail netChange
// (metrics.tailNetChange, only ever non-null for a Top Step result with a >=3-point
// tail -- Mushroom's tail is capped at 2 points, see shape-classifier.ts) sits below
// the Thornton reclassification bar (THORNTON_NET_CHANGE_THRESHOLD, reused) but isn't
// flat either. Placeholder band: netChange 10-25%.
// ---------------------------------------------------------------------------
export const STILL_DRIFTING_LOW = 0.1;

export function isStillDrifting(label: ShapeLabel, metrics: ShapeMetrics): boolean {
  if (label !== "mushroom" && label !== "top_step") return false;
  if (metrics.tailNetChange === null) return false;
  const abs = Math.abs(metrics.tailNetChange);
  return abs >= STILL_DRIFTING_LOW && abs < THORNTON_NET_CHANGE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Multiple distinct steps (lower priority, self-contained) -- groups moves[] into
// maximal runs of real (non-flat) movement separated by at least one flat move, and
// reports each cluster's own share of total real movement. Deliberately NOT reusing
// findBestStepCandidate's own tail/cap machinery (that's specific to deciding
// Mushroom/Top Step, a different question from "does this sequence have two separate
// real episodes of movement") -- a light, independent read over the same anchored
// sequence/moves classifyShape already returned via metrics.
// ---------------------------------------------------------------------------
export type MultipleSteps = { clusterCount: number; shares: number[] };

export function multipleDistinctSteps(
  anchored: { key: string; total: number }[],
  moves: Move[],
): MultipleSteps | null {
  const clusters: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < moves.length; i++) {
    if (moves[i] === "flat") {
      if (current.length > 0) {
        clusters.push(current);
        current = [];
      }
    } else {
      current.push(i);
    }
  }
  if (current.length > 0) clusters.push(current);
  if (clusters.length < 2) return null;

  const magnitudes = clusters.map((c) =>
    c.reduce((sum, i) => sum + Math.abs(anchored[i + 1].total - anchored[i].total), 0),
  );
  const total = magnitudes.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return { clusterCount: clusters.length, shares: magnitudes.map((m) => m / total) };
}

// ---------------------------------------------------------------------------
// All qualifiers for one school, computed from classifyShape()'s own result plus the
// raw counts. Never re-derives label/moves/dominantTransition/metrics itself.
// ---------------------------------------------------------------------------
export type ShapeQualifiers = {
  reversalCount: number;
  erratic: boolean;
  singleAgeAnomaly: boolean;
  // Raw finding -- populated for ANY real label mismatch between the two genders,
  // regardless of materiality bucket (its own `materiality` field distinguishes
  // opposite_direction / same_direction_gap / same_direction_mixed).
  genderShapeDivergence: GenderShapeDivergence | null;
  // Derived primary boolean -- isGenderShapeDivergenceMaterial() at its default
  // cutoffs. false for same_direction_mixed even when genderShapeDivergence is
  // non-null (that's the separate, softer signal -- read it off the raw field above).
  genderShapeDivergenceMaterial: boolean;
  genderMix: GenderMixVariation | null;
  borderline: Borderline | null;
  stillDrifting: boolean;
  multipleSteps: MultipleSteps | null;
};

export function computeShapeQualifiers(
  shapeResult: ClassifyResult,
  ageGenderCounts: AgeGenderCounts,
): ShapeQualifiers {
  const reversals = computeReversalCount(shapeResult.moves);
  const divergence = genderShapeDivergence(ageGenderCounts);
  return {
    reversalCount: reversals,
    erratic: isErratic(reversals),
    singleAgeAnomaly: isSingleAgeAnomaly(shapeResult.moves, shapeResult.label),
    genderShapeDivergence: divergence,
    genderShapeDivergenceMaterial: divergence !== null && isGenderShapeDivergenceMaterial(divergence),
    genderMix: genderMixVariation(ageGenderCounts),
    borderline: borderline(shapeResult.metrics),
    stillDrifting: isStillDrifting(shapeResult.label, shapeResult.metrics),
    multipleSteps: multipleDistinctSteps(shapeResult.metrics.anchored, shapeResult.moves),
  };
}
