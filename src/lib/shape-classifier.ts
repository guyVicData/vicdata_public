// Shape typology classifier (rolls spec §4). Status: provisional throughout, same
// discipline as breakdown_taxonomy_versions elsewhere in the schema -- documented,
// versioned, expected to move once run against real school profiles, not fixed in
// advance of real data. This is a first, defensible implementation of the
// bucket-transition method (classify by the sequence of increase/decrease/stationary
// moves between points in the input sequence), not a final calibration.
//
// As of the "Public View rebuild" design review, every caller feeds this single
// individual ages, both sexes combined (roll-data.ts's shapeClassifierInput()), not
// the 5 age bands this module originally shipped with. The function itself is
// unchanged and still generic over any ordered { key, total }[] sequence; only what
// callers pass in changed.
//
// 2026-08-29: window narrowed from a fixed ages-5-17 array to each school's own
// observed non-zero data span, clamped to that range (roll-data.ts's
// shapeClassifierInput()/observedAgeSpan() -- see that file's comments). Age 18 no
// longer needs a standalone carve-out -- the clamp already excludes it.
//
// 2026-08-29, taxonomy split: "pyramid_funnel" replaced with six shapes --
// tube/pyramid/top_step/funnel/mushroom/wineglass/irregular. Real data (junior-school
// "leaves at 11, real population continues to 13" schools; senior-school "sixth form
// collapses to near-nothing" schools; Queen Anne's School's genuine smooth widening
// vs St Bernard's Grammar/Winchmore/St Mary Redcliffe's single sixth-form join-point
// jump) showed the old combined pyramid_funnel bucket was hiding at least three
// structurally different real patterns: a genuine gradual multi-transition taper
// (Pyramid), a single deliberate step with a real surviving population past it (Top
// Step), and -- via the old "any up + zero down = wineglass" shortcut -- both genuine
// smooth widening (which needed its own Funnel bucket) and genuine staged-join
// concentration (correctly Wineglass) were landing in the same label as pure noise
// artifacts. See classifyShape's body below for the decision tree and the two
// empirically-calibrated share thresholds (DOMINANT_TRANSITION_SHARE,
// CONCENTRATED_SHARE) this split runs on.
//
// Single-year snapshot only (this module). Multi-year stability trajectory is a
// separate, paid-tier concern (rolls spec §3/§4) -- sequencing multiple calls to this
// function across years, not built here.

export type ShapeLabel =
  | "tube"
  | "pyramid"
  | "top_step"
  | "funnel"
  | "mushroom"
  | "wineglass"
  | "irregular";

type Move = "up" | "down" | "flat";

// Relative-change threshold for "stationary" vs a real move. Provisional -- no
// empirical basis yet, same as the shape names themselves.
const STATIONARY_THRESHOLD = 0.15;

// 2026-08-29: absolute-pupil-count floor, added alongside the relative threshold
// above -- a move only counts as "up"/"down" if it clears BOTH. The relative
// threshold alone flips small cohorts on a swing of 1-2 pupils (Bethany School:
// 6→9→6→10→7→5→9→9→9→8→7 across ~90 pupils/12 ages was reading as "irregular" purely
// from ±30-80% swings on single-digit counts). Calibrated against that real case plus
// Queensway Primary (3→6→2→3→5→8, 35 pupils/6 ages): floor=4 is the smallest value
// that fully flattens both to "tube" (the honest read -- stable small schools, not a
// real shape). floor=3 partially flattens them but lands on different wrong labels
// (Bethany -> "wineglass", Queensway -> "pyramid_funnel") via this function's own
// bucket-transition quirks, rather than the correct "tube". floor=5/6 give the same
// result as 4 for these two cases, so 4 is kept as the tightest floor that clears the
// known noise without swallowing more real signal than necessary. Verified this does
// NOT rescue every small-roll school -- Turvey Primary (10→15→8→17→10→11→1, 81
// pupils) and Weston-on-Trent CofE Primary (28→20→27→12→28→20, 147 pupils) stay
// "irregular" even at floor=6, because their swings are large in absolute terms too,
// not just relative -- that's real volatility, not noise, and floor=4 correctly
// leaves it alone.
//
// Also reused one level down, in classifyShape's point-anchoring step below -- same
// value, different job. classifyMove's use above gates the SIZE of a transition; it
// doesn't help when one endpoint of the transition is itself a negligible count next
// to the sequence's own dominant scale (Harris Westminster Sixth Form: 1 pupil at age
// 15 against a core of 304/296 at 16/17 -- the transition 1→304 has an abs change of
// 303, nowhere near this floor, so classifyMove correctly calls it "up," but that
// spurious "up" was the only thing making the genuinely flat 304→296 pair read as
// "wineglass" rather than "tube," via this function's own up-then-no-down rule below).
const STATIONARY_ABS_FLOOR = 4;

// 2026-08-29: relative-threshold fix. The floor above is unchanged and correctly
// suppresses small-N noise -- confirmed again this round (Bethany/Queensway/Turvey/
// Weston-on-Trent all still classify exactly as before). The problem is the OTHER
// side of classifyMove: a fixed 15% relative bar scales wrong with school size --
// Charterhouse/Wellington/Rugby/Marlborough College (all real ~150-260-pupil boarding
// schools, real per-age census data) each have 2-3 genuine admissions-scale swings of
// 8-23 pupils that never clear 15% of a 150-260 base, leaving only their single
// sixth-form jump visible and making it look artificially "dominant" -- an algorithm
// artifact, not the real shape.
//
// This threshold is the second half of an OR: a move counts as up/down if it clears
// the (unchanged) 15% relative bar OR this absolute one, once past the floor. Checked
// the real distribution of currently-masked transitions in every school with a
// 100+-pupil peak (8,292 of them) looking for a natural gap the way
// DOMINANT_TRANSITION_SHARE had one -- there isn't one; it's a smooth, continuous
// curve from 5 pupils up into the 60s, so any fixed value here is a real choice, not a
// discovered boundary, and is reported as such rather than dressed up as more precise
// than it is. Set to 2x the floor (8) -- the smallest clean, auditable relationship to
// the already-validated floor. First tried 2x the floor (8) -- the smallest clean,
// auditable relationship to the already-validated floor -- but that produced an exact
// numeric collision against the other named canary in this same validation round:
// Wellington College's real 16→17 transition (256→264, +8) needed to register as real,
// while Harris Westminster Sixth Form's real 16→17 transition (304→296, -8) needed to
// stay flat (it's already correctly "tube" and was explicitly named as the case to
// protect, precisely because it produced a nonsensical result under an earlier,
// unrelated bug in a previous round's analysis). classifyMove only ever sees the two
// raw numbers, not which school they came from, so both +8 and -8 must get the same
// treatment -- no value of this threshold can honour both requirements at once at 8.
// Raised to 9 to resolve the collision in Harris Westminster's favour (the more
// explicitly-flagged case): Charterhouse's and Rugby's named transitions all clear 9
// with room to spare (smallest is Charterhouse's +9, still included), so this costs
// only Wellington's two ±8 transitions (an honest, reported boundary miss, alongside
// Marlborough's already-reported +5/+2.7% miss) and Malvern's real 16→17 (+10, still
// clears) is unaffected either way. Wellington's own larger transition (+22) still
// clears on relative-adjacent absolute size regardless, which is enough on its own to
// break the false single-dominant-transition reading this fix targets. Checked the
// real distribution of currently-masked transitions in every school with a
// 100+-pupil peak (8,292 of them) looking for a natural gap the way
// DOMINANT_TRANSITION_SHARE had one -- there isn't one; it's a smooth, continuous
// curve from 5 pupils up into the 60s, so this value is a real choice constrained by
// two exact named collisions, not a discovered boundary, and is reported as such
// rather than dressed up as more precise than it is.
const STATIONARY_ABS_ALT = 9;

function classifyMove(prev: number, next: number): Move {
  if (prev === 0) return next === 0 ? "flat" : "up";
  const diff = next - prev;
  if (Math.abs(diff) <= STATIONARY_ABS_FLOOR) return "flat";
  const relativeChange = diff / prev;
  if (relativeChange > STATIONARY_THRESHOLD || diff >= STATIONARY_ABS_ALT) return "up";
  if (relativeChange < -STATIONARY_THRESHOLD || diff <= -STATIONARY_ABS_ALT) return "down";
  return "flat";
}

// A move is "dominant" once its own magnitude clears this share of the total
// magnitude across all non-flat moves -- the operational stand-in for the plain-
// language "one non-flat move with every other transition flat," which turned out too
// literal: nearly every real top-step school (Cumnor House, North Bridge House
// Senior, St John's College School) has a second, smaller real wobble (a partial
// rebound, a minor earlier dip) alongside its real step, so a strict "exactly one
// non-flat move" count excluded 9 of 10 real named top-step examples. Calibrated on
// the full named validation set: every real top-step/mushroom candidate's dominant
// move clears 0.38+ share; the highest share among real GRADUAL multi-transition
// examples (Queen Anne's School, a genuine smooth Funnel: three roughly-equal up
// moves at 0.30/0.33/0.37) sits at 0.37. 0.375 is the value in that gap -- real, but
// thin (0.01 of headroom on the Queen Anne's side), flagged here as a calibration to
// revisit with more data rather than a robust separation.
const DOMINANT_TRANSITION_SHARE = 0.375;

// Within a same-direction multi-move sequence that did NOT clear the dominant-
// transition bar above (domShare < DOMINANT_TRANSITION_SHARE, by construction --
// anything higher was already claimed by the single-dominant path), this decides
// gradual (Pyramid/Funnel) vs concentrated (Wineglass, or Pyramid's own
// concentrated-multi-down fallback -- see below): the single biggest non-flat move
// still carrying a clear share of the total magnitude (no move-count cap -- see
// CONCENTRATED_MAX_MOVES below).
//
// MUST stay below DOMINANT_TRANSITION_SHARE, or this branch is unreachable dead code
// -- caught exactly that way on first implementation (an earlier value of 0.50 here,
// above the 0.375 dominant bar, meant nothing with domShare > 0.375 could ever reach
// this check, and everything below 0.375 failed it too since nothing that low is
// ">0.50" -- wineglass came back 0% nationally on the first population run, a bug,
// not a finding). Queen Anne's School -- the one real named gradual (Funnel) example,
// 3 real up-moves at roughly 0.30/0.33/0.37 -- must stay on the gradual side, which
// pins this value inside a genuinely thin real gap: 0.370 (Queen Anne's own share) <
// this value < 0.375 (the dominant bar). No named example requires anything to
// actually land as concentrated-via-this-path, so this is a real but narrow value,
// not a robustly separated one -- the national scan below reports how rarely (if at
// all) real schools fall inside a gap this thin, which is itself the honest finding.
const CONCENTRATED_SHARE = 0.373;
// 2026-08-29: dropped. A cap of 3 excluded genuine multi-join schools from the
// concentration check before their share was ever evaluated -- Ampleforth College
// (real Common Entry + Sixth Form growth, 5 real moves) was the named case that
// exposed this, but checking the real national population of same-direction
// multi-move schools (the only ones this cap could ever apply to) shows it's not an
// outlier: of 51 such schools nationally, the real nonFlatCount distribution is
// {3: 17, 4: 15, 5: 9, 6: 9, 8: 1} -- a smooth, continuous spread with no natural
// break anywhere near 3, let alone one that would justify excluding the 34 schools
// (67%) with more than 3 real moves. Removing the cap doesn't make concentration
// fire more often on its own -- CONCENTRATED_SHARE still gates it -- it just stops
// pre-judging a school as ineligible purely because it has several real moves.
const CONCENTRATED_MAX_MOVES = Infinity;

// Top Step's "real surviving population past the step" bar -- both must clear.
// Calibrated on the real junior-school sample: Hallfield's post-step average (11
// pupils, 18.3% of its 60-pupil peak) is the closest real example to this boundary on
// the "include" side. Three named schools (Cumnor House: 7 pupils, just under the
// 10-pupil floor; Thomas More Catholic School 8.6%, South Wirral High School 8.9%,
// both just under the 10% floor) fall just short and land in Pyramid instead --
// reported, not force-included.
const TOP_STEP_MIN_SHARE_OF_PEAK = 0.1;
const TOP_STEP_MIN_ABSOLUTE = 10;

// Thornton-pattern net-change mechanism (named for Thornton College: 13→12→10→11→8,
// every individual step ≤ the floor, but a real ~38.5% cumulative decline across the
// run). Fires only when the standard per-transition analysis finds zero real moves
// (would otherwise resolve tube) -- a school with any real per-step signal already
// gets classified correctly by the logic below and never reaches this (Solihull
// School: a real +38% single step already makes it Irregular via genuine multi-
// reversal complexity, without needing this mechanism at all).
//
// netChange is the plain first-to-last change across the whole cropped span, ignoring
// every per-step gate. consistency is how one-directional the real (ignoring the
// floor) step-by-step movement is: concordant magnitude (diffs whose sign matches
// netChange's) over total magnitude. Checked against the full real population of
// zero-real-move schools with |netChange| > 25%: minimum observed consistency was
// 0.542, median 0.800 -- there is no real school in this population with genuinely
// balanced (low-consistency) movement, so 0.50 (bare majority) is a real margin, not a
// tight fit calibrated to force a specific case through.
const THORNTON_NET_CHANGE_THRESHOLD = 0.25;
const THORNTON_CONSISTENCY_THRESHOLD = 0.5;

// Minimum whole-school peak (the largest single real per-age count anywhere in the
// cropped span, before any floor-drop) required for the Thornton mechanism to fire.
// Added after Queensway Primary School (peak 8 pupils) surfaced as a real regression:
// its anchor-dropped survivor sequence (age 6:6, age 9:5, age 10:8 -- ages 5, 7, 8
// dropped as sub-floor noise) has a real 33.3% net change and 0.69 consistency,
// clearing both Thornton thresholds even though the underlying school (roll 3-8 per
// age) is exactly the kind of small-N noise the floor exists to protect against.
// Checked whether reading the full pre-drop span instead of the anchored survivor
// would fix this -- it doesn't: Queensway's full span (3,6,2,3,5,8) has an even more
// extreme apparent net change (+166.7%) and still clears consistency, because the
// underlying problem isn't which sequence gets read, it's that a peak-8 school's
// ordinary year-to-year bounce clears both thresholds under either representation.
// 156 of 630 real Thornton-driven schools nationally have peak roll under 10; this
// gate removes them from the mechanism entirely (they revert to tube, the same
// "genuinely too small to call a shape" read the floor already gives everywhere
// else), without touching the 474 schools with a real, substantial peak roll.
const THORNTON_MIN_PEAK_ROLL = 10;

// 2026-08-30: magnitude-based Wineglass, additive to the domShare-based tree above
// (DOMINANT_TRANSITION_SHARE/CONCENTRATED_SHARE/CONCENTRATED_MAX_MOVES are closed --
// not touched here). Targets exactly the population that tree structurally can't
// reach: schools with one numerically dominant move (Charterhouse/Rugby/Marlborough-
// style) or a mixed-direction sequence with no dominant move at all, which the
// existing tree correctly routes to Irregular because "one dominant transition, rest
// flat" (Top Step/Mushroom) and "every move the same direction" (the closed gradual/
// concentrated check) both require properties these schools don't have. Checked only
// at the two points classifyShape would otherwise return Irregular -- see the two
// call sites below.
//
// Ratio = anchored last value / anchored first value (the same basis Guy's own named
// ratios use -- confirmed by exact match: Malvern 160/40=4.00, Ampleforth 94/13=7.23,
// Charterhouse 221/173=1.28, Rugby 202/144=1.40, Marlborough 208/185=1.12, Wellington
// 264/202=1.31). Checked the real national distribution (Funnel + Group A's irregular
// subset, ~2,800 schools) for a natural break the way DOMINANT_TRANSITION_SHARE had
// one -- there isn't one, it's smooth from 1.0x into double digits, so 2.0x ("the
// roll has genuinely doubled from where the cropped span starts") is a real, chosen
// value, not a discovered boundary. It sits centred in the wide, unforced gap between
// the named low-ratio schools (Charterhouse 1.28x, Wellington 1.31x, Rugby 1.40x,
// Marlborough 1.12x -- none of which are meant to qualify) and the named high-ratio
// ones (Malvern 4.00x, Ampleforth 7.23x, both already correctly resolving via other
// paths) -- every value in roughly [1.5, 3.9] satisfies the same named examples
// equally, so 2.0x is chosen for being a clean, explainable concept rather than for
// being pinned by any one boundary case.
const WINEGLASS_MAGNITUDE_RATIO = 2.0;

// Reversal gate: at most this many direction changes among the real (non-flat) moves.
// Rugby School (up, down, up, down -- 3 reversals) and Marlborough College (down, up,
// down -- 2 reversals) are genuine zigzags, not "broadens from a narrower base," and
// must not qualify regardless of their ratio (both are well under 2.0x anyway, but
// the gate is real and independently necessary): checked the national population and
// found 146 real schools with ratio >= 2.0x AND >= 2 reversals -- including major,
// well-known day schools (Alleyn's School 4.78x/2 reversals, Highgate School 3.47x/2,
// Hampton School 7.86x/3, Latymer Upper 4.55x/3, James Allen's Girls' School 2.97x/2,
// City of London School 3.41x/2), all showing a real "junior department, senior
// department, genuine sixth-form wobble" pattern that a magnitude-only rule would
// misfile. Charterhouse (1 reversal) needs to pass this gate; the threshold is set at
// 1 specifically to keep it in while excluding every real >=2-reversal case checked.
const WINEGLASS_MAX_REVERSALS = 1;

type Diagnostic =
  | "single_down_below_top_step_threshold"
  | "single_up_not_at_top"
  | "down_concentrated_multi_transition";

// Only called from the two points classifyShape would otherwise return Irregular.
// Returns "wineglass" if the whole-span ratio clears WINEGLASS_MAGNITUDE_RATIO, the
// real growth isn't confined to just the final 1-2 transitions (the Mushroom
// exclusion -- that pattern already has its own, correct home), and the real moves
// don't reverse direction more than WINEGLASS_MAX_REVERSALS times. Returns null
// (stay Irregular) otherwise.
function checkMagnitudeWineglass(
  anchored: { key: string; total: number }[],
  moves: Move[],
  nonFlatIdxs: number[],
): ShapeLabel | null {
  const first = anchored[0].total;
  const last = anchored[anchored.length - 1].total;
  if (first <= 0) return null;
  const ratio = last / first;
  if (ratio < WINEGLASS_MAGNITUDE_RATIO) return null;

  // Mushroom exclusion: every real move confined to the final 1-2 transitions means
  // there's no growth before that point at all -- not "broadens from a base."
  if (nonFlatIdxs.every((i) => i >= moves.length - 2)) return null;

  const nonFlatMoves = nonFlatIdxs.map((i) => moves[i]);
  let reversals = 0;
  for (let i = 1; i < nonFlatMoves.length; i++) {
    if (nonFlatMoves[i] !== nonFlatMoves[i - 1]) reversals++;
  }
  if (reversals > WINEGLASS_MAX_REVERSALS) return null;

  return "wineglass";
}

export function classifyShape(
  bandTotals: { key: string; total: number }[],
): { label: ShapeLabel; moves: Move[]; flag?: Diagnostic } | null {
  // Only bands with any real presence count toward the sequence -- an all-zero band
  // (e.g. no sixth form at a primary school) isn't a "move," it's absence.
  const present = bandTotals.filter((b) => b.total > 0);
  if (present.length < 2) return null; // insufficient data for any move at all

  // Drop points that sit at or below the noise floor while ≥2 points remain
  // afterwards -- a count that small can't anchor a real inflection next to whatever
  // dominant scale the rest of the sequence has (see STATIONARY_ABS_FLOOR's comment
  // above). Smallest-first, one at a time, never below 2: if a school's ENTIRE real
  // signal is two small points (e.g. a maths free school's actual Year 12/13
  // headcount, both under the floor), that's real data to classify from, not noise to
  // erase -- Aston University Mathematics School (61 pupils at 16, 3 at 17) is a
  // genuine decline on the numbers as they stand, not a case for this step to blank
  // out into "insufficient data."
  const anchored = [...present];
  for (;;) {
    if (anchored.length <= 2) break;
    let dropIdx = -1;
    let dropTotal = Infinity;
    for (let i = 0; i < anchored.length; i++) {
      if (anchored[i].total <= STATIONARY_ABS_FLOOR && anchored[i].total < dropTotal) {
        dropTotal = anchored[i].total;
        dropIdx = i;
      }
    }
    if (dropIdx === -1) break; // nothing left below the floor
    anchored.splice(dropIdx, 1);
  }

  const moves: Move[] = [];
  for (let i = 1; i < anchored.length; i++) {
    moves.push(classifyMove(anchored[i - 1].total, anchored[i].total));
  }

  const nonFlatIdxs = moves.reduce<number[]>((acc, m, i) => {
    if (m !== "flat") acc.push(i);
    return acc;
  }, []);

  if (nonFlatIdxs.length === 0) {
    // At least 3 points (2 diffs) -- a single masked step reread as a "trend" off a
    // tiny base (e.g. 2 -> 3 pupils, +50% but floor-flat) isn't the pattern this
    // targets; Thornton's own case is real cumulative movement across MULTIPLE small
    // steps, not one.
    if (anchored.length >= 3) {
      const first = anchored[0].total;
      const last = anchored[anchored.length - 1].total;
      if (first > 0) {
        const netChange = (last - first) / first;
        let concordant = 0;
        let discordant = 0;
        for (let i = 1; i < anchored.length; i++) {
          const diff = anchored[i].total - anchored[i - 1].total;
          if (diff === 0) continue;
          if (Math.sign(diff) === Math.sign(netChange)) concordant += Math.abs(diff);
          else discordant += Math.abs(diff);
        }
        const totalDiffMagnitude = concordant + discordant;
        const consistency = totalDiffMagnitude > 0 ? concordant / totalDiffMagnitude : 1;
        const peakRoll = Math.max(...present.map((p) => p.total));
        if (
          Math.abs(netChange) > THORNTON_NET_CHANGE_THRESHOLD &&
          consistency >= THORNTON_CONSISTENCY_THRESHOLD &&
          peakRoll >= THORNTON_MIN_PEAK_ROLL
        ) {
          return { label: netChange < 0 ? "pyramid" : "funnel", moves };
        }
      }
    }
    return { label: "tube", moves };
  }

  const magnitudes = new Map<number, number>(
    nonFlatIdxs.map((i) => [i, Math.abs(anchored[i + 1].total - anchored[i].total)]),
  );
  const totalMagnitude = Array.from(magnitudes.values()).reduce((a, b) => a + b, 0);
  const domIdx = nonFlatIdxs.reduce((best, i) =>
    magnitudes.get(i)! > magnitudes.get(best)! ? i : best,
  );
  const domShare = magnitudes.get(domIdx)! / totalMagnitude;

  // One transition dominates the whole sequence -- Top Step (down) or Mushroom (up,
  // at the very top of the range).
  if (domShare >= DOMINANT_TRANSITION_SHARE) {
    const direction = moves[domIdx];
    if (direction === "down") {
      const prePeak = Math.max(...anchored.slice(0, domIdx + 1).map((p) => p.total));
      const postPoints = anchored.slice(domIdx + 1);
      const postAvg = postPoints.reduce((a, p) => a + p.total, 0) / postPoints.length;
      if (postAvg >= TOP_STEP_MIN_ABSOLUTE && postAvg >= TOP_STEP_MIN_SHARE_OF_PEAK * prePeak) {
        return { label: "top_step", moves };
      }
      // A real dominant drop, but too small a surviving population to call it a real
      // post-step cohort (Aston University Mathematics School: 61 -> 3, no third
      // point to average). This should already have been span-cropped away if it
      // were genuinely near-zero noise -- reaching here with real, non-croppable data
      // means it's a real (if severe) narrowing with no separate "step" to report;
      // falls back to Pyramid rather than inventing a zero-survivor label.
      return { label: "pyramid", moves, flag: "single_down_below_top_step_threshold" };
    }
    // direction === "up"
    //
    // "At the top" means no REAL transition follows the dominant one -- not literally
    // the last array index. The literal-index version missed real named cases: Harrow
    // School, Eton College, and Canford School (real dominant rise at the sixth-form
    // join, then a genuinely flat trailing transition, not the array's last position)
    // were reading as Irregular purely because a non-informative flat move happened to
    // sit after them.
    //
    // Scoped to INTERIOR dominant transitions only (domIdx > 0, when there's more than
    // one move in the sequence) -- checked the domIdx === 0 population specifically
    // (the dominant move is the school's very first real transition) before applying
    // this everywhere. Real examples there (Seaton Sluice Middle School: 65→83→84→82;
    // Blackhall Primary School: 27→36→41→44→40→42) are a small starting cohort jumping
    // up to a stable, LARGER plateau that persists through most of the rest of the
    // range -- structurally the opposite of Mushroom (a bulge concentrated at the OLD
    // end, small elsewhere): here the "big" part is nearly the whole school, not a peak
    // at the top. Calling these Mushroom would be wrong. 1,189 real schools would have
    // flipped under an unscoped version of this fix; they're deliberately left as
    // "single_up_not_at_top" -> Irregular, unchanged.
    //
    // That guard must NOT catch the genuinely two-point case (moves.length === 1,
    // domIdx necessarily 0) -- caught this exactly that way in validation: 360 real
    // schools (all real 2-point sequences, e.g. Malvern Way Infant School: 59 -> 72)
    // flipped from the already-correct Mushroom to Irregular, because a bare
    // `domIdx > 0` check excludes them too. With only two data points there's no
    // "before" and no "plateau" to distinguish from Mushroom in the first place --
    // the domIdx===0 concern only applies when there's a real multi-point structure
    // after the jump to actually look like a stable larger plateau.
    const hasRealMoveAfterDominant = nonFlatIdxs.some((i) => i > domIdx);
    const isEdgeCase = domIdx === 0 && moves.length > 1;
    if (!isEdgeCase && !hasRealMoveAfterDominant) return { label: "mushroom", moves };
    const magnitudeLabel = checkMagnitudeWineglass(anchored, moves, nonFlatIdxs);
    if (magnitudeLabel) return { label: magnitudeLabel, moves };
    return { label: "irregular", moves, flag: "single_up_not_at_top" };
  }

  // No single transition dominates -- gradual (Pyramid/Funnel) vs concentrated
  // (Wineglass) only applies when every non-flat move points the same way; a genuine
  // mix of ups and downs with no dominant move is Irregular, unchanged.
  const directions = new Set(nonFlatIdxs.map((i) => moves[i]));
  if (directions.size === 1) {
    const direction = directions.values().next().value as "up" | "down";
    const concentrated = nonFlatIdxs.length <= CONCENTRATED_MAX_MOVES && domShare > CONCENTRATED_SHARE;
    if (concentrated) {
      if (direction === "up") return { label: "wineglass", moves };
      // Concentrated narrowing across 2-3 real steps rather than one dominant one, or
      // spread gradually -- the taxonomy only names a concentrated shape for the "up"
      // case (staged joins). No real named example forced a decision here; falls back
      // to Pyramid (still a real net narrowing) and is flagged for review.
      return { label: "pyramid", moves, flag: "down_concentrated_multi_transition" };
    }
    return { label: direction === "down" ? "pyramid" : "funnel", moves };
  }

  const magnitudeLabel = checkMagnitudeWineglass(anchored, moves, nonFlatIdxs);
  if (magnitudeLabel) return { label: magnitudeLabel, moves };
  return { label: "irregular", moves };
}
