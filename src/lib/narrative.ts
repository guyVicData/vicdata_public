// "Current state of the school" narrative generator (state-of-school narrative spec
// v1, finalized 2026-08-31 after the diagnostic pass against Leighton Park/The King's
// School/Charterhouse/Woldingham). Pure, rules-based templating -- no LLM call, one
// fixed template per topic with slots filled from fields already computed elsewhere
// on the page (roll.ts, typology.ts, shape-classifier.ts, surrounding-schools.ts,
// la-sector-composition.ts, population-trend.ts) or computed here where the spec
// calls for a genuinely new field (gender-composition category, phase-size band,
// gender-variation clause, LA/region geography tier). Every function here is a pure
// mapping from already-fetched data to a string (or null when the topic doesn't
// apply) -- no Supabase/network calls in this module itself, so it stays trivially
// testable the same way shape-classifier.ts is.

import type { RollSnapshot, AgeGenderCounts } from "./roll-data";
import type { ShapeLabel } from "./shape-classifier";
import type { SchoolTypology, PhaseTag } from "./typology";
import { phaseTagAgeRange } from "./typology";
import { phaseWord } from "./surrounding-summary";
import type { LaSectorComposition } from "./la-sector-composition";
import type { PopulationTrend, PopulationTrendTier } from "./population-trend";
import { POPULATION_TREND_LABELS } from "./population-trend";

// ---------------------------------------------------------------------------
// Cross-cutting: word-form numerals for "one of X" framing only (spec §1) --
// every other number in these templates (percentages, roll counts, ages) stays
// numeric. Plain, dependency-free implementation; real values seen in this
// project's own data stay well under 200 (LA school counts, comparator ranks),
// so this only needs to be correct up to a few hundred, not arbitrarily large.
// ---------------------------------------------------------------------------
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberToWords(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const rest = n % 10;
    return rest === 0 ? tens : `${tens}-${ONES[rest]}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return rest === 0 ? `${ONES[hundreds]} hundred` : `${ONES[hundreds]} hundred and ${numberToWords(rest)}`;
  }
  return String(n); // outside any real range this project produces -- fall back honestly rather than guess
}

// ---------------------------------------------------------------------------
// Topic 1 -- Sector, in context (spec §2). Reuses la-sector-composition.ts's
// already-shipped computeLaSectorComposition() directly -- this topic needs no new
// field, only the word-form/template wrapping.
// ---------------------------------------------------------------------------
export function topic1Sector(schoolName: string, laComposition: LaSectorComposition | null): string | null {
  if (!laComposition || !laComposition.thisSchoolSector) return null;
  const { thisSchoolSector, thisSchoolSectorSchoolCount, thisSchoolPupilShareOfSector, laName } = laComposition;
  if (thisSchoolSectorSchoolCount === 0 || thisSchoolPupilShareOfSector === null) return null;
  const sectorWord = thisSchoolSector === "FE" ? "FE" : thisSchoolSector.toLowerCase();
  return (
    `${schoolName} is one of ${numberToWords(thisSchoolSectorSchoolCount)} ${sectorWord} schools in ${laName}, ` +
    `and its pupils are ${thisSchoolPupilShareOfSector.toFixed(1)}% of the county's ${sectorWord}-sector pupils. (GIAS figures)`
  );
}

// ---------------------------------------------------------------------------
// Topic 2 -- Phase / gender (spec §3).
// ---------------------------------------------------------------------------

// Working-hypothesis suppression band, inherited from rolls spec §8 (not
// independently re-characterized by this build pass -- that threshold is a
// separate, still-open item). 2% is the conservative (more-suppressing) end of the
// spec's own stated 1-2% working range, chosen because this is a child-protection
// mechanism: erring toward suppressing a borderline real case costs a sentence,
// erring the other way risks exposing an identifiable small group.
const SINGLE_SEX_SUPPRESSION_BAND = 0.02;

// Provisional, per spec §3's own table -- candidate 45-55%, characterized against a
// real 10,309-school national sample (2026-08-31): no natural break exists near
// either edge (a smooth, roughly bell-shaped curve through 40-60%), and the current
// 45-55% band already captures 69.7% of real co-ed schools as "balanced" -- a
// sensible majority-but-not-overwhelming split, not evidence of miscalibration.
// Recommendation: keep as-is. Only the upper bound is checked below -- in a
// two-category split, dominant <=55% already implies non-dominant >=45%, so a
// separate lower-bound constant would be redundant, not a second real threshold.
const BALANCED_BAND_HIGH = 0.55;

export type GenderComposition =
  | { kind: "single_sex"; gender: "girls" | "boys" }
  | { kind: "balanced" }
  | { kind: "mostly"; gender: "girls" | "boys" };

export function classifyGenderComposition(female: number, male: number): GenderComposition | null {
  const total = female + male;
  if (total === 0) return null;
  const femaleShare = female / total;
  const maleShare = male / total;
  const nonDominantShare = Math.min(femaleShare, maleShare);
  if (nonDominantShare <= SINGLE_SEX_SUPPRESSION_BAND) {
    return { kind: "single_sex", gender: femaleShare >= maleShare ? "girls" : "boys" };
  }
  const dominantShare = Math.max(femaleShare, maleShare);
  if (dominantShare <= BALANCED_BAND_HIGH) return { kind: "balanced" }; // dominant <=55% implies non-dominant >=45%, i.e. within the symmetric band
  return { kind: "mostly", gender: femaleShare >= maleShare ? "girls" : "boys" };
}

function genderCompositionPhrase(comp: GenderComposition): string {
  if (comp.kind === "single_sex") return `single-sex (${comp.gender})`;
  if (comp.kind === "balanced") return "co-educational, roughly balanced";
  return `co-educational, mostly ${comp.gender}`;
}

// age_range MUST read from the real observed non-zero span, not the
// statutory_low_age/high_age fields directly -- fixed per Guy's 2026-08-31
// direction, worked example Woldingham (statutory 10-19, real current enrollment
// 11-17). Scoped to the phase actually being described, not the whole school's
// unclamped span -- confirmed necessary against real data in the same build pass:
// The King's School has a real, non-zero age-1 count (an attached nursery, not part
// of what "senior school" means), which the whole-school observedAgeSpan() would
// have surfaced as "ages 1 to 17". phaseTagAgeRange bounds the search to the
// phase's own nominal range first, then reads the real non-zero span within it, the
// same "real data over nominal field, but scoped to what's being described"
// principle Topic 3's phase-headcount decomposition already applies.
export function observedSpanForPhase(
  ageGenderCounts: AgeGenderCounts,
  tag: PhaseTag,
  lowAge: number,
  highAge: number,
  allTags: PhaseTag[],
): { minAge: number; maxAge: number } | null {
  const [lo, hi] = allTags.length > 1 ? phaseTagAgeRange(tag, lowAge, highAge) : [lowAge, highAge];
  let minAge: number | null = null;
  let maxAge: number | null = null;
  for (const [age, c] of ageGenderCounts) {
    if (age < lo || age > hi) continue;
    if (c.male + c.female <= 0) continue;
    if (minAge === null || age < minAge) minAge = age;
    if (maxAge === null || age > maxAge) maxAge = age;
  }
  if (minAge === null || maxAge === null) return null;
  return { minAge, maxAge };
}
export function topic2PhaseGender(
  schoolName: string,
  phaseTagsForDisplay: SchoolTypology["phase"],
  observedSpan: { minAge: number; maxAge: number } | null,
  female: number,
  male: number,
): string | null {
  const phase = phaseWord(phaseTagsForDisplay);
  if (!phase || !observedSpan) return null;
  const comp = classifyGenderComposition(female, male);
  if (!comp) return null;
  return (
    `${schoolName} is a ${phase} school (ages ${observedSpan.minAge} to ${observedSpan.maxAge}), ` +
    `and is ${genderCompositionPhrase(comp)}.`
  );
}

// ---------------------------------------------------------------------------
// Topic 3 -- Size of phases, contextualized (spec §4, rebuilt 2026-08-31).
// Reuses findSurroundingSchools's real nearest-10(-ish) matched peers (fetched by
// the caller, same list the free-tier SURROUNDING SCHOOLS card already uses) --
// this module only adds the per-phase decomposition, tercile banding, and the new
// tightest-containing-geography wording.
// ---------------------------------------------------------------------------

export type SizeBand = "small" | "medium" | "large";

export function tercileBand(sortedAscTotals: number[], targetIdx: number): SizeBand {
  const n = sortedAscTotals.length;
  const third = n / 3;
  if (targetIdx < third) return "small";
  if (targetIdx < third * 2) return "medium";
  return "large";
}

export type ComparatorGeographyTier = "same_la" | "within_region" | "national";

// Characterized 2026-08-31 against a real 120-school stratified sample (state
// secondary/independent senior/state primary, 40 each). Confirms the "national"
// tier is a real, non-rare case worth its own wording, not just Woldingham's
// extreme: state primary never reached beyond its region (0/40); state secondary
// also never did (0/40), but independent senior schools -- an ordinary, common
// school type, not a thin edge case -- reached beyond their own region for 5/40
// (12.5%), with real examples spanning several adjacent LAs (e.g. a Redbridge
// school matched into Waltham Forest, Essex, and Enfield). Separately, comparator
// pools frequently land below the nominal 10 even within-region: 31/40 state
// secondaries and 22/40 independent seniors had fewer than 10 real matched peers --
// worth flagging on its own, independent of the geography-wording question.
export function comparatorGeographyPhrase(
  tier: ComparatorGeographyTier,
  laName: string | null,
  regionName: string | null,
): string {
  if (tier === "same_la" && laName) return `in ${laName}`;
  if (tier === "within_region" && regionName) return `in the ${regionName} region`;
  return "nationally";
}

export function tightestComparatorGeography(
  targetLaName: string | null,
  targetRegion: string | null,
  peers: { laName: string | null; region: string | null }[],
): ComparatorGeographyTier {
  if (peers.length === 0) return "national";
  const allSameLa = peers.every((p) => p.laName !== null && p.laName === targetLaName);
  if (allSameLa) return "same_la";
  const allSameRegion = peers.every((p) => p.region !== null && p.region === targetRegion);
  if (allSameRegion) return "within_region";
  return "national";
}

// Which phase to render when a school has more than one real (effective) phase tag
// -- a deterministic priority, most senior/headline-worthy first. Every real
// through-school checked in the diagnostic (The King's School: real Junior+Senior
// populations both non-zero) reads most naturally described by its most senior real
// phase, matching how independent through-schools are conventionally described.
const PHASE_PRIORITY: SchoolTypology["phase"] = ["Senior", "Post 16", "Prep", "Junior"];

export function primaryPhaseTag(effectiveTags: SchoolTypology["phase"]): SchoolTypology["phase"][number] | null {
  for (const tag of PHASE_PRIORITY) if (effectiveTags.includes(tag)) return tag;
  return null;
}

export type PhaseSizeResult = {
  phaseLabel: string; // "senior school" etc, singular, for the opening clause
  phaseLabelPlural: string;
  rollCount: number;
  sizeBand: SizeBand;
  tierCount: number; // how many schools (including the target) share the target's size tier
  geography: ComparatorGeographyTier;
  geographyPhrase: string;
};

const PHASE_LABELS: Record<string, { singular: string; plural: string }> = {
  senior: { singular: "senior school", plural: "senior schools" },
  junior: { singular: "junior school", plural: "junior schools" },
  prep: { singular: "prep school", plural: "prep schools" },
  "post-16": { singular: "sixth form", plural: "sixth forms" },
};

export function topic3PhaseSize(
  phaseWordForSize: string, // "senior" etc -- from phaseWord() on the RELEVANT tag
  sector: string, // lowercased, e.g. "independent"
  targetRollForPhase: number,
  peerRollsForPhase: number[], // real, already phase-decomposed, this school excluded
  targetLaName: string | null,
  targetRegion: string | null,
  geography: ComparatorGeographyTier,
  regionName: string | null,
): string | null {
  if (peerRollsForPhase.length === 0) return null;
  const labels = PHASE_LABELS[phaseWordForSize] ?? { singular: `${phaseWordForSize} school`, plural: `${phaseWordForSize} schools` };

  const all = [...peerRollsForPhase, targetRollForPhase].sort((a, b) => a - b);
  const targetIdx = all.lastIndexOf(targetRollForPhase);
  const band = tercileBand(all, targetIdx);
  const third = all.length / 3;
  const tierCount = band === "small" ? Math.ceil(third) : band === "large" ? all.length - Math.floor(third * 2) : Math.floor(third * 2) - Math.ceil(third);

  const geographyPhrase = comparatorGeographyPhrase(geography, targetLaName, regionName);

  return (
    `The ${labels.singular} (${targetRollForPhase.toLocaleString()} pupils) is ${band} — one of the ` +
    `${numberToWords(Math.max(tierCount, 1))} ${band} ${sector} ${labels.plural} compared ${geographyPhrase}. ` +
    `The schools behind this comparison are visible to verified members.`
  );
}

// ---------------------------------------------------------------------------
// Topic 4a -- Shape description (spec §5a), scoped to statutory ages 5-17.
// ---------------------------------------------------------------------------
const SHAPE_TEMPLATES: Record<ShapeLabel, (name: string) => string> = {
  tube: (n) => `${n}'s year groups are broadly similar in size all the way through the school's statutory age range (5 to 17) — a Tube shape.`,
  pyramid: (n) => `${n}'s year groups gradually narrow from the youngest statutory ages to the oldest (5 to 17) — a Pyramid shape, typical of a school where pupils leave gradually across several year groups rather than all at once.`,
  top_step: (n) => `${n}'s year groups stay a similar size until one point, where the roll steps down and then holds steady at the new size, across the statutory age range (5 to 17) — a Top Step shape, typical of a school where a group of pupils leaves together at one specific transition.`,
  funnel: (n) => `${n}'s year groups gradually widen from the youngest statutory ages to the oldest (5 to 17) — a Funnel shape, typical of a school that gains pupils gradually across several year groups rather than all at once.`,
  mushroom: (n) => `${n}'s year groups stay a similar size until the oldest statutory ages, where the roll grows sharply — a Mushroom shape, typical of a school with a large sixth-form-style intake.`,
  wineglass: (n) => `${n}'s roll broadens substantially from its narrowest point to its widest across the statutory age range (5 to 17), without needing to grow in every single year — a Wineglass shape, typical of a school with staged joining points across several year groups.`,
  irregular: (n) => `${n}'s year groups vary in size, across the statutory age range (5 to 17), in a way that doesn't fit one of the platform's standard shapes — genuine movement, not just ordinary year-to-year variation (see below).`,
};

export function topic4aShape(schoolName: string, shapeLabel: ShapeLabel | null): string {
  if (!shapeLabel) return `There isn't enough current census data to classify ${schoolName}'s shape.`;
  return SHAPE_TEMPLATES[shapeLabel](schoolName);
}

// ---------------------------------------------------------------------------
// Topic 4b -- Gender-variation clause (spec §5b, finalized 2026-08-31: cut pinned
// against the real full histogram -- see GENDER_VARIATION_THRESHOLD_PP's own
// comment for the exact percentile and value -- scope extended to every shape with
// a real dominant transition, i.e. anything except tube/null, not just the six
// named resolved shapes).
// ---------------------------------------------------------------------------

// Pinned 2026-08-31 against the full national histogram: 15,851 Mixed-gender schools
// with a real dominant transition (every non-tube, non-null classifyShape() result --
// mushroom 3,878 / irregular 5,542 / top_step 4,857 / pyramid 716 / wineglass 448 /
// funnel 410 -- the finalized broader scope, not just the six resolved shapes). Exact
// p90 = 42.85pp (index 14,265 of 15,851, sorted ascending). Not a natural break -- the
// distribution is smooth and continuous through this region (values run 41.0, 41.0,
// 41.1... at p88 to 45.9, 46.0... at p93, no gap), so this is a chosen percentile cut,
// disclosed as such, not a discovered boundary, same discipline as
// WINEGLASS_MAGNITUDE_RATIO.
export const GENDER_VARIATION_THRESHOLD_PP = 42.85;

export function topic4bGenderVariation(
  dominantTransition: { fromAge: string; toAge: string } | null,
  ageGenderCounts: Map<number, { male: number; female: number }>,
  clampedFemale: number,
  clampedMale: number,
): { ageA: number; ageB: number; gender: "girls" | "boys" } | null {
  if (!dominantTransition) return null;
  const ageA = Number(dominantTransition.fromAge);
  const ageB = Number(dominantTransition.toAge);
  const countsA = ageGenderCounts.get(ageA) ?? { male: 0, female: 0 };
  const countsB = ageGenderCounts.get(ageB) ?? { male: 0, female: 0 };

  // Single-sex suppression (spec §5b step 4): never surface if either gender's count
  // in the relevant age band (the two transition ages themselves) sits inside the
  // suppression zone.
  for (const c of [countsA, countsB]) {
    const total = c.male + c.female;
    if (total === 0) continue;
    const nonDominantShare = Math.min(c.male, c.female) / total;
    if (nonDominantShare <= SINGLE_SEX_SUPPRESSION_BAND) return null;
  }

  const femaleDiff = countsB.female - countsA.female;
  const maleDiff = countsB.male - countsA.male;
  const transitionMagnitude = Math.abs(femaleDiff) + Math.abs(maleDiff);
  if (transitionMagnitude === 0) return null;
  const transitionFemaleShare = Math.abs(femaleDiff) / transitionMagnitude;

  const overallTotal = clampedFemale + clampedMale;
  if (overallTotal === 0) return null;
  const overallFemaleShare = clampedFemale / overallTotal;

  const divergencePp = Math.abs(transitionFemaleShare - overallFemaleShare) * 100;
  if (divergencePp <= GENDER_VARIATION_THRESHOLD_PP) return null;

  const gender: "girls" | "boys" = transitionFemaleShare >= overallFemaleShare ? "girls" : "boys";
  return { ageA, ageB, gender };
}

export function renderTopic4b(result: { ageA: number; ageB: number; gender: "girls" | "boys" } | null): string | null {
  if (!result) return null;
  return `The main change, between ages ${result.ageA} and ${result.ageB}, is concentrated more among ${result.gender} than the school's overall gender balance would suggest.`;
}

// ---------------------------------------------------------------------------
// Topic 5 -- Regularity of year-group sizes (spec §6). No new mechanism -- reads
// classifyShape()'s own `moves` array.
// ---------------------------------------------------------------------------
export function topic5Regularity(moves: ("up" | "down" | "flat")[]): string {
  const realMoveCount = moves.filter((m) => m !== "flat").length;
  if (realMoveCount === 0) {
    return "Year-group sizes are broadly consistent from one age to the next, with no unusual jumps.";
  }
  const plural = realMoveCount === 1 ? "change" : "changes";
  return `Year-group sizes vary more than ordinary year-to-year noise between some ages — ${numberToWords(realMoveCount)} genuine ${plural} beyond normal variation.`;
}

// ---------------------------------------------------------------------------
// Topic 6 -- Boarding / day (spec §7). Percentage form is confirmed live (not
// blocked) -- roll-data.ts's finishSnapshot() already maps boarders_total from the
// DfE census.
// ---------------------------------------------------------------------------
const BOARDING_PHRASE: Record<SchoolTypology["boarding"] & string, string> = {
  Boarding: "boarding",
  Day: "day",
  "Boarding & day": "boarding and day",
};

export function topic6Boarding(
  schoolName: string,
  boardingTag: SchoolTypology["boarding"],
  boarding: RollSnapshot["boarding"],
): string | null {
  if (!boardingTag) return null;
  const phrase = BOARDING_PHRASE[boardingTag];
  // A pure "Day" tag already says everything the percentage would -- stating "0.0%
  // boarding" alongside it is redundant, not informative (confirmed against real
  // data: The King's School, GIAS "No boarders", genuinely zero boarders this
  // period). Only Boarding/Boarding & day get the percentage clause.
  if (boardingTag === "Day" || !boarding || boarding.total === 0) {
    return `${schoolName} is a ${phrase} school.`;
  }
  const pct = (boarding.boarders / boarding.total) * 100;
  return `${schoolName} is a ${phrase} school, with ${pct.toFixed(1)}% of pupils boarding.`;
}

// ---------------------------------------------------------------------------
// Topic 7 -- LA and region context (spec §8, corrected 2026-08-31: this is the
// existing population-trend decline-tier system, NOT the six-shape taxonomy).
// ---------------------------------------------------------------------------
function tierRelation(laTier: PopulationTrendTier, regionTier: PopulationTrendTier): string {
  const order: PopulationTrendTier[] = ["growing", "stable", "decline", "steep_decline", "severe_decline"];
  if (laTier === regionTier) return "matches";
  return order.indexOf(laTier) > order.indexOf(regionTier) ? "a steeper decline than" : "a less steep decline than";
}

export function topic7LaRegion(
  schoolName: string,
  populationTrend: PopulationTrend | null, // laTrend, actually -- caller passes laTrend
  laName: string | null,
  regionName: string | null,
  regionTrend: PopulationTrend | null,
  schoolShapeLabel: ShapeLabel | null,
): string | null {
  if (!populationTrend || !laName) return null;
  const laTierLabel = POPULATION_TREND_LABELS[populationTrend.tier];
  const shapePhrase = schoolShapeLabel
    ? `${schoolShapeLabel.charAt(0).toUpperCase()}${schoolShapeLabel.slice(1).replace("_", " ")} shape`
    : "shape (not enough data to classify)";

  if (!regionTrend || !regionName) {
    return (
      `${laName}'s school-age population (ages 5 to 15) is currently in ${laTierLabel} (${populationTrend.pct.toFixed(1)}%). ` +
      `${schoolName}'s own current ${shapePhrase} (ages 5 to 17) is a separate figure — a different mechanism and age basis, not a translation of one into the other.`
    );
  }

  const regionTierLabel = POPULATION_TREND_LABELS[regionTrend.tier];
  return (
    `${laName}'s school-age population (ages 5 to 15) is currently in ${laTierLabel} (${populationTrend.pct.toFixed(1)}%), and the ${regionName} region is in ` +
    `${regionTierLabel} (${regionTrend.pct.toFixed(1)}%) — ${tierRelation(populationTrend.tier, regionTrend.tier)} the region. ` +
    `${schoolName}'s own current ${shapePhrase} (ages 5 to 17) is a separate figure — a different mechanism and age basis, not a translation of one into the other.`
  );
}

// ---------------------------------------------------------------------------
// Topic 8 -- Questions to explore (spec §9). Static teaser, only the school name
// is a slot.
// ---------------------------------------------------------------------------
export function topic8QuestionsToExplore(schoolName: string): string {
  return (
    `Want to see how this has changed over time? Verified members can explore ${schoolName}'s roll trend, its shape stability over recent years, ` +
    `its gender and boarding trends, and how it compares within a comparator set of schools you choose.`
  );
}
