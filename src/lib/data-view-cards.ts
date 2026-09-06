// Member Data View: pure presentation-derivation functions shared by Dashboard,
// Rankings and the PDF export (brief §5/§7/§9) -- no data fetching here, only turning
// already-fetched DataViewSchoolProfile figures into the specific numbers each card/
// row needs. Kept separate from data-view-profiles.ts (fetching) and
// data-view-filters.ts (which NUMBER a filter state selects) -- this module answers
// "given that number for everyone in the set, what does the card actually say."

import type { ShapeLabel } from "./shape-classifier";

export type TrendDirection = "up" | "down" | "flat";

// "Real ▲/▼ trend badge since 2019" (brief §5, Current Roll/Gender split/Boarding
// split cards all need one). Flat band mirrors shape-classifier.ts's own
// STATIONARY_THRESHOLD (15%) rather than inventing a second "what counts as no real
// change" number -- the same relative-change discipline already governing the shape
// taxonomy applies here for consistency, not because the two are the same
// computation.
const FLAT_THRESHOLD_PCT = 15;

export type TrendBadge = { direction: TrendDirection; pctChange: number } | null;

export function trendBadge(current: number | null, anchor2019: number | null): TrendBadge {
  if (current === null || anchor2019 === null || anchor2019 === 0) return null;
  const pctChange = ((current - anchor2019) / anchor2019) * 100;
  const direction: TrendDirection = Math.abs(pctChange) < FLAT_THRESHOLD_PCT ? "flat" : pctChange > 0 ? "up" : "down";
  return { direction, pctChange };
}

// Dot-strip / spread data (Current Roll, Gender split, Boarding split cards): every
// real value in the ticked group, plus which one is the target -- rendering itself
// (SVG positions) belongs to the component, this just gives it clean, sorted numbers.
export type SpreadPoint = { urn: string; name: string; value: number; isTarget: boolean };

export function spreadData(points: { urn: string; name: string; value: number | null; isTarget: boolean }[]): {
  min: number;
  max: number;
  points: SpreadPoint[];
} | null {
  const real = points.filter((p): p is SpreadPoint & { value: number } => p.value !== null) as (SpreadPoint & { value: number })[];
  if (real.length === 0) return null;
  const values = real.map((p) => p.value);
  return { min: Math.min(...values), max: Math.max(...values), points: real };
}

// Market share (brief §5): target's roll as a % of the TICKED GROUP's own combined
// roll -- deliberately NOT the rolls-spec's ONS-birth-pool definition (that's a
// "market share vs the total local child population," a different, No-ONS-dependency-
// free question this card explicitly isn't asking). groupTotal includes the target's
// own figure (it's a segment of the same bar, not compared against the rest alone).
export function memberSetMarketShare(targetValue: number, groupTotalIncludingTarget: number): number | null {
  if (groupTotalIncludingTarget <= 0) return null;
  return (targetValue / groupTotalIncludingTarget) * 100;
}

// Ranking with shared-rank ties (brief §7: "standard sports-table convention -- two
// schools both #3, next is #5"). Sort direction is fixed per metric (bigger roll/
// higher growth/higher boarding % all descending, brief's own instruction) -- this
// function always ranks descending by the value given; callers negate the value first
// for an ascending metric rather than this function carrying a direction flag nobody
// asked for this round.
export type RankedEntry = { urn: string; name: string; value: number; rank: number; isTarget: boolean };

export function rankDescendingWithTies(
  entries: { urn: string; name: string; value: number | null; isTarget: boolean }[],
): { ranked: RankedEntry[]; targetRank: number | null; total: number } {
  const real = entries.filter((e): e is { urn: string; name: string; value: number; isTarget: boolean } => e.value !== null);
  const sorted = [...real].sort((a, b) => b.value - a.value);
  const ranked: RankedEntry[] = [];
  let rank = 0;
  let previousValue: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (previousValue === null || sorted[i].value !== previousValue) rank = i + 1;
    ranked.push({ ...sorted[i], rank });
    previousValue = sorted[i].value;
  }
  const targetEntry = ranked.find((r) => r.isTarget);
  return { ranked, targetRank: targetEntry?.rank ?? null, total: ranked.length };
}

// Large-set threshold (brief §7): "regional/national scale... switch the headline
// from raw rank to percentile... show a window of neighbours." No default list this
// round is genuinely unbounded, but a self-curated set can be -- this is purely
// defensive, sized against the largest default list (List 2's own LIST2_CAP=30) so
// nothing this build actually produces trips it, while still doing something sane if
// a member's own saved set ever does.
export const LARGE_SET_THRESHOLD = 40;
export const NEIGHBOUR_WINDOW = 5; // schools shown either side of the target's own rank, large-set mode

export function percentile(rank: number, total: number): number {
  if (total <= 1) return 100;
  return Math.round(((total - rank) / (total - 1)) * 100);
}

// Shape inline fact (brief §5: "a single inline fact... never explanatory copy").
// Deliberately plain -- no attempt at the "why" a shape-change narrative would need
// (narrative.ts's own numericShapeDefinition machinery is a different, heavier
// mechanism built for a different template with different discourse goals; brief
// explicitly allows shipping a plain factual line here and logging the gap rather
// than inventing marketing copy for a shape-change event).
const SHAPE_LABELS: Record<ShapeLabel, string> = {
  tube: "Tube",
  pyramid: "Pyramid",
  top_step: "Top-step",
  funnel: "Funnel",
  mushroom: "Mushroom",
  wineglass: "Wineglass",
  irregular: "Irregular",
};

// 2026-09-06, UX refinements round 1, A2: `startYearLabel` replaces the hardcoded
// "2019" text -- the caller passes whatever the date-range control's own academic-
// year label for filters.startPeriod is, so this stays correct however the anchor
// shape (whether it's still the true 2019 one or a different real period) was
// actually computed.
export function shapeInlineFact(anchorShape: ShapeLabel | null, shapeCurrent: ShapeLabel | null, startYearLabel: string): string | null {
  if (!shapeCurrent) return null;
  if (!anchorShape || anchorShape === shapeCurrent) {
    return `${SHAPE_LABELS[shapeCurrent]}-shaped (unchanged since ${startYearLabel})`;
  }
  return `${SHAPE_LABELS[anchorShape]} → ${SHAPE_LABELS[shapeCurrent]} since ${startYearLabel}`;
}

// Through-school size-band label (brief §5: "Large overall · Medium as a Senior
// school"). Bands are simple tertiles over the group's own combined range -- this
// build's own choice (not specified further in the brief), same "chosen-not-
// discovered default, easy to widen/narrow" discipline as several other provisional
// thresholds already in this codebase (narrative-config.ts's TOPIC3_SIZE_BAND_THRESHOLD,
// typology.ts's boarding ratio thresholds).
export type SizeBand = "Small" | "Medium" | "Large";

export function sizeBand(value: number, min: number, max: number): SizeBand {
  if (max <= min) return "Medium";
  const t = (value - min) / (max - min);
  if (t < 1 / 3) return "Small";
  if (t < 2 / 3) return "Medium";
  return "Large";
}
