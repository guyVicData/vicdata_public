// Shape typology classifier (rolls spec §4). Status: provisional throughout, same
// discipline as breakdown_taxonomy_versions elsewhere in the schema -- documented,
// versioned, expected to move once run against real school profiles, not fixed in
// advance of real data. This is a first, defensible implementation of the
// bucket-transition method (classify by the sequence of increase/decrease/stationary
// moves between points in the input sequence), not a final calibration.
//
// As of the "Public View rebuild" design review, every caller feeds this single
// individual ages 5-17 (roll-data.ts's shapeClassifierInput()), not the 5 age bands
// this module originally shipped with -- ages 4/18 are structurally incomplete
// cohorts at census date and were producing a false "rise" that biased almost every
// school toward "Mushroom." The function itself is unchanged and still generic over
// any ordered { key, total }[] sequence; only what callers pass in changed.
//
// Single-year snapshot only (this module). Multi-year stability trajectory is a
// separate, paid-tier concern (rolls spec §3/§4) -- sequencing multiple calls to this
// function across years, not built here.

export type ShapeLabel = "tube" | "pyramid_funnel" | "mushroom" | "wineglass" | "irregular";

type Move = "up" | "down" | "flat";

// Relative-change threshold for "stationary" vs a real move. Provisional -- no
// empirical basis yet, same as the shape names themselves.
const STATIONARY_THRESHOLD = 0.15;

function classifyMove(prev: number, next: number): Move {
  if (prev === 0) return next === 0 ? "flat" : "up";
  const relativeChange = (next - prev) / prev;
  if (relativeChange > STATIONARY_THRESHOLD) return "up";
  if (relativeChange < -STATIONARY_THRESHOLD) return "down";
  return "flat";
}

export function classifyShape(
  bandTotals: { key: string; total: number }[],
): { label: ShapeLabel; moves: Move[] } | null {
  // Only bands with any real presence count toward the sequence -- an all-zero band
  // (e.g. no sixth form at a primary school) isn't a "move," it's absence.
  const present = bandTotals.filter((b) => b.total > 0);
  if (present.length < 2) return null; // insufficient data for any move at all

  const moves: Move[] = [];
  for (let i = 1; i < present.length; i++) {
    moves.push(classifyMove(present[i - 1].total, present[i].total));
  }

  const allFlat = moves.every((m) => m === "flat");
  const allDown = moves.every((m) => m !== "up");
  const allUp = moves.every((m) => m !== "down");

  if (allFlat) return { label: "tube", moves };
  if (allDown) return { label: "pyramid_funnel", moves };

  // Single peak (rises then falls) -- a bulge, "mushroom."
  const firstDownIdx = moves.findIndex((m) => m === "down");
  const risesThenFalls =
    !allUp &&
    firstDownIdx > -1 &&
    moves.slice(0, firstDownIdx).every((m) => m !== "down") &&
    moves.slice(firstDownIdx).every((m) => m !== "up");
  if (risesThenFalls) return { label: "mushroom", moves };

  // Single dip (falls then rises) -- narrow waist, "wineglass" (organisational design's
  // "hourglass," structurally identical per rolls spec §4).
  const firstUpIdx = moves.findIndex((m) => m === "up");
  const fallsThenRises =
    !allDown &&
    firstUpIdx > -1 &&
    moves.slice(0, firstUpIdx).every((m) => m !== "up") &&
    moves.slice(firstUpIdx).every((m) => m !== "down");
  if (fallsThenRises) return { label: "wineglass", moves };

  return { label: "irregular", moves };
}
