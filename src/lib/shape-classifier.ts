// Shape typology classifier (rolls spec §4). Status: provisional throughout, same
// discipline as breakdown_taxonomy_versions elsewhere in the schema -- documented,
// versioned, expected to move once run against real school profiles, not fixed in
// advance of real data.
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
// 2026-09-03, taxonomy REDESIGN (rolls spec §4 characterization pass, promoted this
// round): the six-shape split (2026-08-29) stays, but the whole decision tree is
// rebuilt around net trajectory ALONE, with no reversal-based disqualification
// anywhere. The previous tree treated "genuine multi-reversal complexity" as
// grounds to fall back to a seventh "irregular" bucket (a real, if genuine, dead end
// for ~146+ well-known day schools -- Alleyn's, Highgate, Hampton, Latymer Upper,
// James Allen's, City of London School among them -- whose real shape, net of the
// reversal, was Wineglass all along). "Irregular" is no longer a classifyShape()
// output at all -- every school now resolves to one of the six real shapes. A
// reversal-aware QUALIFIER, layered on top of the primary shape rather than
// gatekeeping it, is next round's work, not built here -- classifyShape() still
// returns moves and dominantTransition (unchanged shape) specifically so that round
// has real, already-computed material to build from, not so this round's callers
// need them.
//
// The decision tree, in order:
//  1. Mushroom (up) / Top Step (down): is there a single, disproportionately large
//     step whose own tail (points after it) is genuinely flat -- checked
//     independently of what the sequence does BEFORE the step (a trending or
//     reversing base doesn't disqualify a real step; Rugby School's real
//     up-then-immediate-comparable-down never even reaches this stage, since its own
//     candidate step fails the tail check on its own terms, not via any reversal
//     rule). See findBestStepCandidate below for the full test (share, per-step
//     tail flatness, cumulative tail-drift, and Mushroom's own top-width cap).
//  2. Otherwise: net trajectory only. First-vs-last ratio of the cropped+anchored
//     span decides top-heavy/bottom-heavy/flat (Tube), then, for the top-heavy
//     remainder, magnitude ratio decides Funnel vs Wineglass. Bottom-heavy remainder
//     is Pyramid throughout -- no second bottom-heavy bucket yet (Guy's own explicit
//     scope call this round).
//
// Full named regression set (both this round and the original six-shape-split
// audit) reverified against this tree before promotion: Harrow/Eton/Canford/
// Wellington/St Mary Redcliffe and Temple (Mushroom), Newland House/Hallfield (Top
// Step), Malvern College/Ampleforth/Alleyn's/Highgate/Hampton/Latymer Upper/James
// Allen's/City of London School/Solihull School/Cottesmore School/The Pilgrims
// School (Wineglass), Charterhouse/Thornton College (Funnel), Weston-on-Trent CofE
// Primary/Aston University Mathematics School (Pyramid), Marlborough College/
// Turvey Primary/Winchmore School/Bethany School/Queensway Primary/Harris
// Westminster Sixth Form (Tube), Malvern Way Infant School (Mushroom, the genuine
// two-point edge case), Seaton Sluice Middle School/Blackhall Primary School (must
// NOT be Mushroom -- a small cohort stepping up to a stable LARGER plateau, the
// structural opposite of a bulge at the old end).
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
  | "irregular"; // 2026-09-03: never returned by classifyShape any more (see the
// redesign comment above) -- kept in the type only because two real downstream
// consumers (ShapeIcon.tsx's exhaustive switch, SHAPE_LABELS' Record) already handle
// it correctly and harmlessly as dead code; removing it from the type is a separate,
// unrequested cleanup, not part of this round.

type Move = "up" | "down" | "flat";

// Relative-change threshold for "stationary" vs a real move. Provisional -- no
// empirical basis yet, same as the shape names themselves.
const STATIONARY_THRESHOLD = 0.15;

// Absolute-pupil-count floor, alongside the relative threshold above -- a move only
// counts as "up"/"down" if it clears BOTH. Calibrated against Bethany School
// (6->9->6->10->7->5->9->9->9->8->7 across ~90 pupils/12 ages, reading as false
// "irregular"/noise purely from +-30-80% swings on single-digit counts) and Queensway
// Primary (3->6->2->3->5->8, 35 pupils/6 ages): floor=4 is the smallest value that
// fully flattens both to the honest "no real per-step move" read. Verified this does
// NOT rescue every small-roll school -- Turvey Primary (10->15->8->17->10->11->1, 81
// pupils) and Weston-on-Trent CofE Primary (28->20->27->12->28->20, 147 pupils) still
// have real per-step signal even at this floor, because their swings are large in
// absolute terms too, not just relative -- that's real volatility, not noise, and the
// floor correctly leaves it alone (both now resolve via net trajectory: Turvey's real
// zigzag nets out close to flat -> Tube; Weston-on-Trent's nets out a real -28.6% ->
// Pyramid -- see the redesign comment above for why a reversal-heavy school landing in
// either of those is the intended behaviour now, not a bug).
const STATIONARY_ABS_FLOOR = 4;

// Second half of an OR alongside the relative threshold: a move counts as up/down if
// it clears the 15% relative bar OR this absolute one, once past the floor. Fixes a
// real bias the relative-only rule has toward large schools (Charterhouse/Wellington/
// Rugby/Marlborough College all have genuine 150-260-pupil-scale admissions swings of
// 8-23 pupils that never clear 15% of their own base). Set to 9 -- the smallest value
// that resolves an exact real-data collision between two named canaries at the
// original candidate value of 8: Wellington College's real 16->17 transition
// (256->264, +8) needed to register as real, Harris Westminster Sixth Form's real
// 16->17 transition (304->296, -8) needed to stay flat. No value of this threshold can
// honour both at 8; 9 resolves it in Harris Westminster's favour without losing any
// other named transition.
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

// A candidate step's own share of ALL real (non-flat) movement in the sequence must
// clear this before it can be considered "disproportionate" at all. Calibrated
// against the full named Mushroom/Top Step set (both this round and the original
// audit): the tightest real "must be" case is Wellington College at 0.645 (two real
// admissions-scale rises, the larger one dominant) and Hallfield School at 0.506; the
// highest real "must NOT be" case, once the tail checks below are applied on top, is
// 0.176 (Charterhouse -- its own real dominant rise is immediately followed by a real
// decline, failing the tail-flatness test before share is even compared against this
// bar). 0.4 sits centred in that wide, genuinely gap-free range -- reported as the
// real choice it is, same discipline as every other threshold in this file, not a
// discovered natural break (checked the national step-share distribution for one;
// there isn't one, it's smooth from 0 to 1.0).
const MUSHROOM_TOP_STEP_SHARE_THRESHOLD = 0.4;

// Mushroom's own top-width cap: even a genuinely flat plateau doesn't count as
// Mushroom if it spans 3+ years after the step -- that's sustained widening
// (Wineglass's territory), not a short overhang. Concretely, the step's landing year
// must be within the last two years of the cropped span (the landing year itself,
// plus at most one more). Checked against the full named Mushroom set first: every
// real anchor's own top is comfortably at or under this cap (Wellington College sits
// exactly at the boundary, 2 real years after its step -- the tightest real case, not
// a coincidence the cap was set here rather than 1). Checked nationally: this cap
// alone (independent of the tail-drift check below) drops Mushroom from 6,467 to
// 2,755 schools -- by far the larger of this round's two Mushroom-narrowing changes,
// confirming a wide flat top was genuinely common under the old, width-blind rule.
// Deliberately NOT applied to Top Step's own tail -- no equivalent fixed-length
// structural reason exists on the declining side (a "step down then several years of
// real survivors" reads as a genuine, different pattern, not sustained widening) --
// left as an explicit open question: 22.4% of Top Step schools nationally do have a
// 3+-year tail, a real but proportionally much smaller population than Mushroom's,
// evidence for a future round rather than a decision made here.
const MUSHROOM_MAX_TAIL_POINTS = 2;

// Top Step's "real surviving population past the step" bar -- both must clear.
// Calibrated on the real junior-school sample: Hallfield's post-step average (11
// pupils, 18.3% of its 62-pupil peak) is the closest real example to this boundary on
// the "include" side.
const TOP_STEP_MIN_SHARE_OF_PEAK = 0.1;
const TOP_STEP_MIN_ABSOLUTE = 10;

// Thornton-pattern net-change mechanism (named for Thornton College's own real
// historical data at the time this was calibrated: several individually sub-floor
// steps whose CUMULATIVE movement was real). Used in two places this round: (a) the
// zero-real-per-step-move population's own flat/not-flat decision (see classifyShape
// below -- the general 15% flat floor is too tight for a population with no
// classifyMove-confirmed real signal at all to anchor a smaller threshold on; this
// wider, three-part gate is deliberately reused rather than re-derived, since it's
// already validated against exactly this population), and (b) the tail-drift check
// inside findBestStepCandidate, extended this round to catch a Mushroom/Top Step
// candidate whose tail LOOKS flat one step at a time (every individual post-step move
// under the abs-alt floor) but is real, sustained movement in aggregate (Cottesmore
// School: tail steps of +0/+6/+6, each individually flat, cumulative +48% -- The
// Pilgrims School: +6/+5/+1, cumulative +40% -- both real prep schools with genuine
// continued growth through Common Entrance age, now correctly Wineglass rather than
// Mushroom).
//
// netChange is the plain first-to-last change across whichever span is being tested
// (the whole cropped span for (a), just the tail for (b)), ignoring every per-step
// gate. consistency is how one-directional the real (ignoring the floor) step-by-step
// movement is: concordant magnitude (diffs whose sign matches netChange's) over total
// magnitude.
const THORNTON_NET_CHANGE_THRESHOLD = 0.25;
const THORNTON_CONSISTENCY_THRESHOLD = 0.5;

// Minimum whole-school peak (the largest single real per-age count anywhere in the
// cropped span, before any floor-drop) required for the zero-real-moves Thornton gate
// to fire. Added after Queensway Primary School (peak 8 pupils) surfaced as a real
// regression: its anchored survivor sequence (age 6:6, age 9:5, age 10:8) has a real
// 33.3% net change and 75% consistency, clearing both Thornton thresholds even though
// the underlying school (roll 2-8 per age) is exactly the kind of small-N noise the
// floor above exists to protect against everywhere else in this file.
const THORNTON_MIN_PEAK_ROLL = 10;

// Ratio = anchored last value / anchored first value. This round's own top-heavy/
// bottom-heavy/flat split (replacing the old domShare-based gradual/concentrated
// tree entirely for the remainder population -- see classifyShape below): checked the
// real national ratio distribution near 1.0x for a natural "flat enough" break; there
// isn't one (smooth from 0.8 into 1.3, same as every other threshold in this file
// without a discovered boundary), so +-15% (matching STATIONARY_THRESHOLD -- reused
// rather than invented, same value, different job, same pattern the abs-floor already
// uses one section up) is the real, chosen floor. Checked by hand against Marlborough
// College (ratio 1.124, a real down/up/down zigzag) -- it lands inside this band, and
// under this round's design that's the correct, honest read: net trajectory alone
// says "flat," and Marlborough's real internal reversal becomes reported qualifier
// data (2 reversals) rather than something that changes its primary shape.
const FLAT_RATIO_HIGH = 1.15;
const FLAT_RATIO_LOW = 1 / FLAT_RATIO_HIGH;

// Magnitude ratio deciding Wineglass (>=) vs Funnel (<) within the top-heavy
// remainder -- the old WINEGLASS_MAGNITUDE_RATIO candidate, re-derived this round
// against the real distribution now that the reversal gate and the old "must
// otherwise be irregular" scoping are both gone (nothing in the old checkMagnitude
// Wineglass mechanism survives this round -- the whole remainder population, not just
// two Irregular-bound call sites, now goes through this same ratio check). Checked
// the real national distribution for a natural break; none found (smooth from 1.0x
// into double digits, same as when this candidate was first chosen), so 2.0x is kept
// as the same real, chosen value, now doing more work than before. Named regression:
// Malvern College 4.00x and Ampleforth College 7.23x both clear it (Wineglass, the
// latter resolving an explicitly open question from the previous round); Charterhouse
// 1.28x and Rugby School 1.40x both fall short (Funnel); Queen Anne's School 9.17x
// clears it too, landing Wineglass rather than the Funnel its old, domShare-based
// "genuine gradual widening" characterisation suggested -- flagged here as a real,
// reported change in that one school's own label, not silently absorbed.
const WINEGLASS_MAGNITUDE_RATIO = 2.0;

type DominantTransition = { fromAge: string; toAge: string };

// Best available Mushroom/Top Step candidate: the highest-share real (non-flat) move
// whose own tail (every point after it) is genuinely flat -- checked entirely on the
// tail's own terms, never on what precedes the step. Two independent tail tests, both
// must pass, plus Mushroom's own extra cap:
//  1. Per-step: every adjacent pair within the tail must have |diff| < the abs-alt
//     floor (STATIONARY_ABS_ALT) -- deliberately NOT the local-relative-% clause
//     classifyMove itself uses, which over-triggers on a small surviving population
//     (Newland House's real top-step tail, 20->13, is a genuine -35% swing on its own
//     tiny base but is noise in absolute terms against the school's real ~63-pupil
//     scale elsewhere).
//  2. Cumulative: the tail's own net change, run through the Thornton mechanism
//     above -- catches the case (1) can't reach, several individually-sub-floor tail
//     steps that are real, sustained movement in aggregate (see the Thornton
//     constant's own comment for the Cottesmore/Pilgrims worked examples).
// Mushroom (direction "up") candidates additionally require a tail of at most
// MUSHROOM_MAX_TAIL_POINTS points -- see that constant's own comment.
function findBestStepCandidate(
  anchored: { key: string; total: number }[],
  moves: Move[],
  nonFlatIdxs: number[],
): { idx: number; share: number; direction: "up" | "down" } | null {
  if (nonFlatIdxs.length === 0) return null;
  const magnitudes = new Map<number, number>(
    nonFlatIdxs.map((i) => [i, Math.abs(anchored[i + 1].total - anchored[i].total)]),
  );
  const totalMagnitude = Array.from(magnitudes.values()).reduce((a, b) => a + b, 0);

  let best: { idx: number; share: number; direction: "up" | "down" } | null = null;
  for (const i of nonFlatIdxs) {
    const direction = moves[i] as "up" | "down";
    const tail = anchored.slice(i + 1);

    let tailFlatPerStep = true;
    for (let j = i + 1; j < anchored.length - 1; j++) {
      if (Math.abs(anchored[j + 1].total - anchored[j].total) >= STATIONARY_ABS_ALT) {
        tailFlatPerStep = false;
        break;
      }
    }
    if (!tailFlatPerStep) continue;

    if (tail.length >= 3) {
      const tailStart = tail[0].total;
      const tailEnd = tail[tail.length - 1].total;
      if (tailStart > 0) {
        const netChange = (tailEnd - tailStart) / tailStart;
        let concordant = 0;
        let discordant = 0;
        for (let k = 1; k < tail.length; k++) {
          const diff = tail[k].total - tail[k - 1].total;
          if (diff === 0) continue;
          if (Math.sign(diff) === Math.sign(netChange)) concordant += Math.abs(diff);
          else discordant += Math.abs(diff);
        }
        const totalTailMagnitude = concordant + discordant;
        const consistency = totalTailMagnitude > 0 ? concordant / totalTailMagnitude : 1;
        const tailHasRealDrift =
          Math.abs(netChange) > THORNTON_NET_CHANGE_THRESHOLD && consistency >= THORNTON_CONSISTENCY_THRESHOLD;
        if (tailHasRealDrift) continue;
      }
    }

    if (direction === "up" && tail.length > MUSHROOM_MAX_TAIL_POINTS) continue;

    const share = magnitudes.get(i)! / totalMagnitude;
    if (!best || share > best.share) best = { idx: i, share, direction };
  }
  return best;
}

export function classifyShape(
  bandTotals: { key: string; total: number }[],
): { label: ShapeLabel; moves: Move[]; dominantTransition: DominantTransition | null } | null {
  // Only bands with any real presence count toward the sequence -- an all-zero band
  // (e.g. no sixth form at a primary school) isn't a "move," it's absence.
  const present = bandTotals.filter((b) => b.total > 0);
  if (present.length < 2) return null; // insufficient data for any move at all

  // Drop points that sit at or below the noise floor while ≥2 points remain
  // afterwards -- a count that small can't anchor a real inflection next to whatever
  // dominant scale the rest of the sequence has. Smallest-first, one at a time, never
  // below 2: if a school's ENTIRE real signal is two small points, that's real data
  // to classify from, not noise to erase (Aston University Mathematics School: 61
  // pupils at 16, 3 at 17, a genuine decline on the numbers as they stand).
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

  const best = findBestStepCandidate(anchored, moves, nonFlatIdxs);
  if (best && best.share >= MUSHROOM_TOP_STEP_SHARE_THRESHOLD) {
    const dominantTransition: DominantTransition = {
      fromAge: anchored[best.idx].key,
      toAge: anchored[best.idx + 1].key,
    };
    if (best.direction === "up") {
      return { label: "mushroom", moves, dominantTransition };
    }
    const prePeak = Math.max(...anchored.slice(0, best.idx + 1).map((p) => p.total));
    const postPoints = anchored.slice(best.idx + 1);
    const postAvg = postPoints.reduce((a, p) => a + p.total, 0) / postPoints.length;
    if (postAvg >= TOP_STEP_MIN_ABSOLUTE && postAvg >= TOP_STEP_MIN_SHARE_OF_PEAK * prePeak) {
      return { label: "top_step", moves, dominantTransition };
    }
    // A real dominant drop, but too small a surviving population to call it a real
    // post-step cohort -- falls through to the net-trajectory read below rather than
    // inventing a zero-survivor label.
  }

  // Net trajectory only, from here down. dominantTransition still reported for the
  // narrative's gender-variation clause (topic4bGenderVariation) wherever there's a
  // real transition to point to -- the domIdx move itself when one exists, or the
  // whole span's own endpoints when every per-step move was flat -- but null for
  // Tube, whichever path reaches it: a school described as "broadly similar in size
  // all the way through" has no single transition to point a gender-variation clause
  // at.
  const first = anchored[0].total;
  const last = anchored[anchored.length - 1].total;
  if (first <= 0) return { label: "tube", moves, dominantTransition: null };
  const ratio = last / first;

  const domIdx = nonFlatIdxs.length > 0
    ? nonFlatIdxs.reduce((biggest, i) => {
        const mag = Math.abs(anchored[i + 1].total - anchored[i].total);
        const biggestMag = Math.abs(anchored[biggest + 1].total - anchored[biggest].total);
        return mag > biggestMag ? i : biggest;
      })
    : null;

  if (nonFlatIdxs.length === 0) {
    // No real per-step move anywhere. The general +-15% flat floor below is too tight
    // for this population (see FLAT_RATIO_HIGH's own comment and THORNTON_NET_CHANGE_
    // THRESHOLD's) -- reuse the wider, already-validated Thornton mechanism instead.
    let concordant = 0;
    let discordant = 0;
    for (let i = 1; i < anchored.length; i++) {
      const diff = anchored[i].total - anchored[i - 1].total;
      if (diff === 0) continue;
      if (Math.sign(diff) === Math.sign(ratio - 1)) concordant += Math.abs(diff);
      else discordant += Math.abs(diff);
    }
    const totalMagnitude = concordant + discordant;
    const consistency = totalMagnitude > 0 ? concordant / totalMagnitude : 1;
    const netChange = ratio - 1;
    const peakRoll = Math.max(...present.map((p) => p.total));
    const realDrift =
      Math.abs(netChange) > THORNTON_NET_CHANGE_THRESHOLD &&
      consistency >= THORNTON_CONSISTENCY_THRESHOLD &&
      peakRoll >= THORNTON_MIN_PEAK_ROLL;
    if (!realDrift) return { label: "tube", moves, dominantTransition: null };
    const dominantTransition: DominantTransition = { fromAge: anchored[0].key, toAge: anchored[anchored.length - 1].key };
    return {
      label: ratio > 1 ? (ratio >= WINEGLASS_MAGNITUDE_RATIO ? "wineglass" : "funnel") : "pyramid",
      moves,
      dominantTransition,
    };
  }

  const dominantTransition: DominantTransition = {
    fromAge: anchored[domIdx!].key,
    toAge: anchored[domIdx! + 1].key,
  };

  if (ratio >= FLAT_RATIO_LOW && ratio <= FLAT_RATIO_HIGH) {
    return { label: "tube", moves, dominantTransition: null };
  }
  if (ratio > 1) {
    return {
      label: ratio >= WINEGLASS_MAGNITUDE_RATIO ? "wineglass" : "funnel",
      moves,
      dominantTransition,
    };
  }
  return { label: "pyramid", moves, dominantTransition };
}
