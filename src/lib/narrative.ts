// "Current state of the school" narrative generator, v2 restructure (2026-08-31,
// tightened from Guy's hand-edits of the shipped v1 output for Malvern College/The
// King's School/Leighton Park School). Four merged paragraphs instead of v1's eight
// separate topic-sentences -- see docs/vicdata_phase3_state_of_school_current_state_
// narrative_spec_v2_draft.md for the full spec this implements. Every PROVISIONAL
// choice lives in narrative-config.ts, imported here, never inlined -- the next
// hand-edit round should only need to touch that one file for most changes.
//
// Still pure, rules-based templating -- no LLM call, no network calls in this module
// (narrative-lookup.ts does the async DB work and calls back into the pure helpers
// here for formatting).

import type { RollSnapshot, AgeGenderCounts } from "./roll-data";
import type { ShapeLabel } from "./shape-classifier";
import type { SchoolTypology, PhaseTag } from "./typology";
import { phaseTagAgeRange } from "./typology";
import { phaseWord } from "./surrounding-summary";
import type { LaSectorComposition } from "./la-sector-composition";
import type { PopulationTrend, PopulationTrendTier } from "./population-trend";
import { POPULATION_TREND_LABELS } from "./population-trend";
import {
  EARLY_YEARS_PROXY_AGE_THRESHOLD,
  TOPIC3_SIZE_BAND_THRESHOLD,
  TOPIC5_FOLD_INTO_SHAPE_SENTENCE,
  GENDER_ALWAYS_ON_HEDGE,
  SHAPE_SENTENCE_INCLUDE_SCOPE_NOTE,
  GENDER_LABEL_HEDGE_WIDTH_PP,
  YEAR_GROUP_MAX,
  MAJORITY_BOARDING_THRESHOLD,
} from "./narrative-config";
import { displayPopulationTrendPct } from "./population-trend";

// ---------------------------------------------------------------------------
// Cross-cutting: word-form numerals for "one of X" framing only (spec §1) --
// unchanged from v1.
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
  return String(n);
}

// "One of X" framing specifically: word-form up to and including twenty, numeral
// above. Round 5 fix -- the original reasoning (a digit in this position reads as a
// ranking) holds for small numbers but stops being true at three digits; Bewdley
// School's real "one of two hundred and thirty-nine state schools" surfaced this.
// Scoped to the "one of X" position only -- every other number in these templates
// (percentages, roll counts, ages, Topic 5's move count) stays on numberToWords'
// own general behaviour, unchanged.
export function oneOfCountLabel(n: number): string {
  return n <= 20 ? numberToWords(n) : String(n);
}

// ---------------------------------------------------------------------------
// Data-reliability principle (spec §6, Priority 0): does a school have real
// early-years/nursery provision? See narrative-config.ts's EARLY_YEARS_SOURCE for
// the full investigation -- GIAS's own NurseryProvision (name) field is the real,
// well-populated answer (98.9% meaningfully filled for independent schools) but is
// NOT YET ingested into this table. Until it is, this uses StatutoryLowAge (itself
// real and authoritative, not census-derived) as a proxy, cross-checked at 86.9%
// accuracy against the real field -- see narrative-config.ts for the full error
// breakdown. Never infers this from patchy age 1-4 census headcounts directly --
// that inference is exactly the trap both v1's crop-it and Guy's own first-pass
// "ages 1 to 17" assert-it edit fell into.
// ---------------------------------------------------------------------------
export function hasEarlyYearsProvision(statutoryLowAge: number | null): boolean {
  if (statutoryLowAge === null) return false;
  return statutoryLowAge < EARLY_YEARS_PROXY_AGE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Gender composition (shared by Paragraph 1 and 4b) -- same suppression band and
// balanced-band logic as v1, restructured to also carry the dominant share/gender
// directly (Paragraph 1's template states the percentage inline, not just a category
// label).
// ---------------------------------------------------------------------------
const SINGLE_SEX_SUPPRESSION_BAND = 0.02;
const BALANCED_BAND_HIGH = 0.55;

export type GenderComposition = {
  kind: "single_sex" | "balanced" | "mostly";
  dominantGender: "girls" | "boys";
  dominantSharePct: number; // 0-100
};

export function classifyGenderComposition(female: number, male: number): GenderComposition | null {
  const total = female + male;
  if (total === 0) return null;
  const femaleShare = female / total;
  const maleShare = male / total;
  const dominantGender: "girls" | "boys" = femaleShare >= maleShare ? "girls" : "boys";
  const dominantSharePct = Math.max(femaleShare, maleShare) * 100;
  const nonDominantShare = Math.min(femaleShare, maleShare);
  if (nonDominantShare <= SINGLE_SEX_SUPPRESSION_BAND) {
    return { kind: "single_sex", dominantGender, dominantSharePct };
  }
  if (dominantSharePct <= BALANCED_BAND_HIGH * 100) return { kind: "balanced", dominantGender, dominantSharePct };
  return { kind: "mostly", dominantGender, dominantSharePct };
}

// ---------------------------------------------------------------------------
// Real observed span scoped to a specific phase (unchanged from v1) -- still needed
// for both forks of the age-range clause: the numeric fork uses both ends, the
// early-years fork uses only the (always-reliable) top end.
// ---------------------------------------------------------------------------
export function observedSpanForPhase(
  ageGenderCounts: AgeGenderCounts,
  tag: PhaseTag,
  lowAge: number,
  highAge: number,
  allTags: PhaseTag[],
): { minAge: number; maxAge: number } | null {
  // Round 10 fix: a Junior+Prep tag pair is ONE continuous real population, not two
  // departments -- confirmed against real data on both sides (state middle schools,
  // e.g. Robert Bloomfield Academy/Alameda Middle School, ages ~9-13; and ordinary
  // independent prep schools, e.g. Devonshire House Preparatory School/The Hall
  // School, ages ~2-13, share this exact tag pairing). phaseTagAgeRange's own
  // hardcoded Prep floor (11) was built for a narrower assumption and crops the
  // real younger population here specifically -- Alameda rendered "Year 7 to Year
  // 9" for a real 9-13 span, losing ages 9-10 entirely. Search the FULL statutory
  // range instead of either tag's own narrow sub-range whenever both are present.
  const juniorPrepPair = allTags.includes("Junior") && allTags.includes("Prep");
  const [lo, hi] = juniorPrepPair
    ? [lowAge, highAge]
    : allTags.length > 1
      ? phaseTagAgeRange(tag, lowAge, highAge)
      : [lowAge, highAge];
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

// Which phase to render as the single "primary" one when a school has more than one
// real effective tag but isn't rendered as "through" (top age only, still needed to
// scope observedSpanForPhase to the most senior real phase).
const PHASE_PRIORITY: PhaseTag[] = ["Senior", "Post 16", "Prep", "Junior"];
export function primaryPhaseTag(effectiveTags: PhaseTag[]): PhaseTag | null {
  for (const tag of PHASE_PRIORITY) if (effectiveTags.includes(tag)) return tag;
  return null;
}

// Single-age -> year-group label (spec §2, round 6): age <4 -> "Early Years" (no
// number -- ages 1-3 are too patchy in the DfE census to assert a specific year,
// same principle as §6); age 4 -> "Reception"; age 5-17 -> "Year {{age-4}}"; age >=18
// -> capped at "Year 13" (schools don't have a Year 14 -- an 18-year-old at school is
// a Year 13 pupil, not evidence of a further year group). Replaces the round-2 fork
// (early-years-or-not, numeric otherwise) with one consistent age-to-label mapping
// that also resolves the old "(ages 5 to 17)" scope-note question: a reader never
// sees a raw age boundary that could clash with a chart showing a real 18-year-old,
// since "Year 13" doesn't carry the implied ceiling a literal "17" would.
export function yearGroupSingleLabel(age: number): string {
  if (age < 4) return "Early Years";
  if (age === 4) return "Reception";
  return `Year ${Math.min(YEAR_GROUP_MAX, age - 4)}`;
}

// ---------------------------------------------------------------------------
// Paragraph 1 -- Phase, age range, gender (spec §2, was Topic 2, now leads).
// ---------------------------------------------------------------------------
export function paragraph1PhaseGender(
  schoolName: string,
  effectiveTags: PhaseTag[],
  hasEarlyYears: boolean,
  observedSpan: { minAge: number; maxAge: number } | null,
  female: number,
  male: number,
): string | null {
  if (!observedSpan) return null;
  // Round 10 fix: "Junior" is the only tag covering infant-only, junior-only, and
  // full-primary schools alike -- phaseWord() has no separate word for any of
  // them, so an infant-only school (Thomas A Becket Infant School, real ages 4-7)
  // was rendering as "a junior school", which a reader would reasonably read as
  // wrong (Years 3-6, not Reception-Year 2). Junior-only itself (ages ~7-11) keeps
  // rendering as "junior" -- that's the one real sub-case the word already
  // describes correctly, per Guy's explicit instruction not to touch it. Detected
  // from the real observed span, not a new tag: a single "Junior" tag whose real
  // population never reaches Year 3 (age 8) is infant-only.
  const INFANT_MAX_AGE = 7; // Year 2's top age (Reception=4 .. Year 1=6 .. Year 2=7)
  const isInfantOnly = effectiveTags.length === 1 && effectiveTags[0] === "Junior" && observedSpan.maxAge <= INFANT_MAX_AGE;
  const phase = effectiveTags.length > 1 ? "through" : isInfantOnly ? "infant" : phaseWord(effectiveTags);
  if (!phase) return null;
  // "infant" is the only phase word starting with a vowel sound -- "an infant
  // school", not "a infant school".
  const article = /^[aeiou]/i.test(phase) ? "an" : "a";
  const comp = classifyGenderComposition(female, male);
  if (!comp) return null;

  // Round 6, §2: year groups throughout, not raw ages -- the young end still forks
  // on hasEarlyYears (the real GIAS-backed signal, §6, not inferred from patchy
  // age 1-3 census presence), but both ends now render as a year-group label,
  // including the Year-13 cap on the old end (age 18 never renders as a raw "18").
  const youngLabel = hasEarlyYears ? "Early Years" : yearGroupSingleLabel(observedSpan.minAge);
  const oldLabel = yearGroupSingleLabel(observedSpan.maxAge);
  const ageRangeClause = `with pupils from ${youngLabel} to ${oldLabel}`;

  if (comp.kind === "single_sex") {
    return `${schoolName} is ${article} ${phase} school, ${ageRangeClause}. It is single-sex (${comp.dominantGender}). ${GENDER_ALWAYS_ON_HEDGE}`;
  }

  // Hedge zone (spec §7 item 8, unresolved -- see narrative-config.ts's own comment):
  // just past the balanced-band edge, state the percentage but drop the qualitative
  // "mostly X" label. Leighton Park's real edit (55.1% male) is the one worked
  // example of this -- everything else in the draft sits clearly inside or outside
  // the band.
  const inHedgeZone = comp.kind === "mostly" && comp.dominantSharePct < BALANCED_BAND_HIGH * 100 + GENDER_LABEL_HEDGE_WIDTH_PP * 100;
  const qualifier = comp.kind === "balanced" ? ", roughly balanced" : inHedgeZone ? "" : `, mostly ${comp.dominantGender}`;

  return (
    `${schoolName} is ${article} ${phase} school, ${ageRangeClause}. It is co-educational${qualifier}, ` +
    `with ${comp.dominantGender} making up ${comp.dominantSharePct.toFixed(0)}% of all pupils. ${GENDER_ALWAYS_ON_HEDGE}`
  );
}

// ---------------------------------------------------------------------------
// Paragraph 2 -- Sector context and size (spec §3, Topics 1 + 3 merged, Topic 3
// rebuilt as an LA-average comparison -- see narrative-lookup.ts for the async
// LA-average computation; this module only formats the result).
// ---------------------------------------------------------------------------
export type SizeBand = "small" | "medium" | "large";

// Threshold from narrative-config.ts (§7 item 1) -- not characterized against real
// data this round, a chosen-not-discovered default, easy to widen/narrow.
export function sizeWordFromRatio(targetValue: number, laAverage: number): SizeBand {
  if (laAverage <= 0) return "medium";
  const ratio = targetValue / laAverage;
  if (ratio >= 1 + TOPIC3_SIZE_BAND_THRESHOLD) return "large";
  if (ratio <= 1 - TOPIC3_SIZE_BAND_THRESHOLD) return "small";
  return "medium";
}

// UK school-year-group convention: Year 1 starts at age 5 (Reception is age 4-5,
// treated as Year 0 here since none of this project's phase ranges need to render
// Reception specifically as its own labelled year). Only used for Topic 3's
// "(Years X-Y)" clause -- ages remain the basis everywhere else in this module.
//
// Capped at YEAR_GROUP_MAX (13) -- bug fix, round 3: English schools have no Year
// 14. A real age-18 pupil in the roll (repeated year, late birthday, whatever the
// reason -- the same real post-17 cohort the shape classifier's own [5,17] clamp
// already has to account for) is still in Year 13, not some year beyond it. The
// naive age-minus-4 formula produced "Years 12-14" for Malvern's real sixth form
// (age 13-18) in the round-2 build -- confirmed wrong, neither the build nor Guy's
// own edit of it caught it at the time.
export function yearGroupLabel(minAge: number, maxAge: number): string {
  const toYear = (age: number) => Math.min(YEAR_GROUP_MAX, Math.max(0, age - 4));
  const lo = toYear(minAge);
  const hi = toYear(maxAge);
  return lo === hi ? `Year ${lo}` : `Years ${lo}–${hi}`;
}

export type PhaseSizeClause = {
  phaseTag: PhaseTag;
  phaseLabel: string; // "sixth form" / "senior phase" etc
  yearRangeLabel: string;
  band: SizeBand;
  ratio: number; // target / LA average
};

const PHASE_SIZE_LABELS: Record<PhaseTag, string> = {
  Senior: "senior phase",
  "Post 16": "sixth form",
  Prep: "prep phase",
  Junior: "junior phase",
};

export function phaseSizeLabel(tag: PhaseTag): string {
  return PHASE_SIZE_LABELS[tag];
}

// Assembles Paragraph 2's size half from already-computed per-phase LA-average
// ratios (narrative-lookup.ts does the DB work; this is pure formatting). Per-phase
// clauses when phases disagree on size band, one blanket clause when every phase
// (excluding early years, which is never quantitatively compared -- spec §6) agrees.
export function formatSizeSentence(
  overallBand: SizeBand,
  clauses: PhaseSizeClause[],
  hasEarlyYears: boolean,
  laName: string,
): string | null {
  if (clauses.length === 0) {
    return hasEarlyYears ? `The school is ${overallBand} — it has early-years provision.` : null;
  }

  const bands = new Set(clauses.map((c) => c.band));
  const earlyYearsClause = hasEarlyYears ? "it has early-years provision, and " : "";

  if (bands.size === 1 && clauses.length > 1) {
    const comparisonWord = clauses[0].band === "large" ? "larger than" : clauses[0].band === "small" ? "smaller than" : "about the same as";
    const youngest = hasEarlyYears ? "early years" : clauses[0].phaseLabel;
    const oldest = clauses[clauses.length - 1].phaseLabel;

    // Round 3, §3: "from X to Y" implies a range with more than two named points --
    // awkward for exactly two phases, confirmed by Guy's own edit (Leighton Park:
    // "both phases, secondary and sixth form, are larger..."). Two phases (plus an
    // early-years mention, which never counts toward this since it's never
    // quantitatively compared) get the "both... are" form; three or more keep the
    // "each phase from... is..." form, which reads fine there (King's real edit).
    if (clauses.length === 2) {
      // Round 5 fix: no "phase" on the first item -- "both phases, secondary and
      // sixth form, are..." matches Guy's own wording exactly, not "...secondary
      // phase and sixth form...". Only strips the word from `youngest`; "sixth
      // form" (the usual `oldest` here) was never suffixed with it anyway.
      const youngestBare = youngest.replace(/ phase$/, "");
      return (
        `The school is ${overallBand} — ${earlyYearsClause}both phases, ${youngestBare} and ${oldest}, are ` +
        `${comparisonWord} the ${laName} average.`
      );
    }
    return (
      `The school is ${overallBand} — ${earlyYearsClause}each phase from ${youngest} to ${oldest} is ` +
      `${comparisonWord} the ${laName} average.`
    );
  }

  const perPhase = clauses
    .map((c) => {
      const comparisonWord = c.band === "large" ? "larger than" : c.band === "small" ? "smaller than" : "about the same size as";
      return `the ${c.phaseLabel} (${c.yearRangeLabel}) is ${c.band}, ${comparisonWord} the ${laName} average`;
    })
    .join(", and ");

  // Round 8: a single Senior clause with no sixth-form sibling only ever comes from
  // the secondary/sixth-form split's own fallback path (the split always produces
  // two clauses when it fires -- see reliableSeniorHeadcounts's caller in
  // narrative-lookup.ts) -- i.e. a genuine 11-16-style secondary with no real
  // post-16 presence. That's exactly the one case a reader might plausibly expect a
  // sixth form and not find one, so it gets a caveat. A single Junior/Prep clause
  // (a primary-only or prep-only school) is the ordinary, unremarkable
  // configuration and does NOT get this -- nobody expects a sixth form there.
  const noSixthFormCaveat =
    clauses.length === 1 && clauses[0].phaseTag === "Senior" ? " The school does not have a sixth form." : "";

  return `The school is ${overallBand} — ${earlyYearsClause}${perPhase}.${noSixthFormCaveat}`;
}

export function paragraph2SectorSize(
  schoolName: string,
  laComposition: LaSectorComposition | null,
  sizeSentence: string | null,
): string | null {
  if (!laComposition || !laComposition.thisSchoolSector) return null;
  const { thisSchoolSector, thisSchoolSectorSchoolCount, thisSchoolPupilShareOfSector, laName } = laComposition;
  if (thisSchoolSectorSchoolCount === 0 || thisSchoolPupilShareOfSector === null) return null;
  const sectorWord = thisSchoolSector === "FE" ? "FE" : thisSchoolSector.toLowerCase();

  // Round 3, §3: prepositional "in this local authority" (lowercase), not the
  // round-2 build's possessive "of the Local Authority's..." -- confirmed 3/3 across
  // round 3's real edits. Keeps the article ("of THE independent-sector pupils") --
  // King's own round-3 edit dropped it, but 2 of 3 (Malvern, Leighton Park) kept it
  // and it reads more naturally; not treated as a genuine 3-way disagreement.
  const sectorSentence =
    `One of ${oneOfCountLabel(thisSchoolSectorSchoolCount)} ${sectorWord} schools in ${laName}, ${schoolName}'s pupils make up ` +
    `${thisSchoolPupilShareOfSector.toFixed(1)}% of the ${sectorWord}-sector pupils in this local authority.`;

  return sizeSentence ? `${sectorSentence} ${sizeSentence}` : sectorSentence;
}

// ---------------------------------------------------------------------------
// Paragraph 3 -- Shape (spec §4, Topics 4a + 5 merged). The "N genuine changes"
// count is dropped as a separate sentence per Priority 3 -- its substance folds
// into the shape sentence's own wording instead (config-gated, in case a future
// round wants it back).
// ---------------------------------------------------------------------------
const SHAPE_EXPLANATIONS: Partial<Record<ShapeLabel, string>> = {
  tube: "year groups are broadly similar in size all the way through the school",
  pyramid: "year groups gradually narrow from the youngest ages to the oldest, typical of a school where pupils leave gradually across several year groups rather than all at once",
  top_step: "year groups stay a similar size until one point, where the roll steps down and then holds steady, typical of a school where a group of pupils leaves together at one specific transition",
  funnel: "year groups gradually widen from the youngest ages to the oldest, typical of a school that gains pupils gradually across several year groups rather than all at once",
  mushroom: "year groups stay a similar size until the oldest ages, where the roll grows sharply, typical of a school with a large sixth-form-style intake",
  wineglass: "the top of the school is much larger than the bottom, and students join at multiple entry points",
};

export function paragraph3Shape(schoolName: string, shapeLabel: ShapeLabel | null, realMoveCount: number): string {
  const scopeNote = SHAPE_SENTENCE_INCLUDE_SCOPE_NOTE ? " (ages 5 to 17)" : "";

  if (!shapeLabel) return `There isn't enough current census data to classify ${schoolName}'s roll shape.`;

  if (shapeLabel === "irregular") {
    if (TOPIC5_FOLD_INTO_SHAPE_SENTENCE) {
      return (
        `VicData defines ${schoolName}'s current roll as having an Irregular shape${scopeNote} — its year groups vary in size ` +
        `in a way that doesn't fit one of the platform's standard shapes.`
      );
    }
    const plural = realMoveCount === 1 ? "change" : "changes";
    return (
      `${schoolName}'s year groups fluctuate in size, so VicData defines its current roll shape as Irregular${scopeNote} — ` +
      `${numberToWords(realMoveCount)} genuine ${plural} beyond normal variation, more than ordinary year-to-year noise.`
    );
  }

  const explanation = SHAPE_EXPLANATIONS[shapeLabel];
  const label = shapeLabel.charAt(0).toUpperCase() + shapeLabel.slice(1).replace("_", " ");
  return `VicData defines ${schoolName}'s current roll as having a ${label} shape${scopeNote}${explanation ? `, meaning that ${explanation}.` : "."}`;
}

// ---------------------------------------------------------------------------
// 4b -- Gender-variation clause (spec §5b/v1, unchanged this round: still fires on
// its own terms, additional to Paragraph 1's always-on hedge, not a replacement).
// ---------------------------------------------------------------------------
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
// Paragraph 4 -- Boarding / day, and Local context (spec §5, Topics 6 + 7 + 8
// merged into one closing paragraph). Boarding stays a standalone factual sentence
// (no causal framing, per Priority 3) but sits inside this same paragraph, matching
// The King's School's real edit structure rather than Leighton Park's separate one
// (Priority 1 explicitly calls for a single merged closing paragraph).
// ---------------------------------------------------------------------------
const BOARDING_PHRASE: Record<SchoolTypology["boarding"] & string, string> = {
  Boarding: "boarding",
  Day: "day",
  "Boarding & day": "boarding and day",
};

export function boardingSentence(
  schoolName: string,
  boardingTag: SchoolTypology["boarding"],
  boarding: RollSnapshot["boarding"],
): string | null {
  if (!boardingTag) return null;
  const phrase = BOARDING_PHRASE[boardingTag];
  if (boardingTag === "Day" || !boarding || boarding.total === 0) {
    return `${schoolName} is a ${phrase} school.`;
  }
  const pct = (boarding.boarders / boarding.total) * 100;
  return `${schoolName} is a ${phrase} school, with ${pct.toFixed(1)}% of pupils boarding.`;
}

// ---------------------------------------------------------------------------
// Boarding-catchment clause (round 4, §5) -- a sector x boarding matrix, not
// boarding percentage alone. Each of the four branches has exactly one real worked
// example behind it so far (state day school has none -- see the build report for
// where a real one was found); NOT characterized against a larger sample this
// round, per Priority 3's own instruction -- treat as a placeholder pattern, not a
// finding.
// ---------------------------------------------------------------------------
export type BoardingCatchmentBranch = "state_day" | "independent_day" | "majority_boarding" | "majority_day_some_boarding";

export function boardingCatchmentClause(
  schoolName: string,
  sector: SchoolTypology["sector"],
  boardingTag: SchoolTypology["boarding"],
  boarding: RollSnapshot["boarding"],
): { text: string; branch: BoardingCatchmentBranch } | null {
  if (!boardingTag) return null;

  if (boardingTag === "Day") {
    if (sector === "State") {
      return {
        text: `${schoolName} is a state day school, meaning that population trends in the locality really matter.`,
        branch: "state_day",
      };
    }
    return {
      text: `${schoolName} is a day school, meaning that population trends in the locality matter.`,
      branch: "independent_day",
    };
  }

  // Real boarding exists (Boarding or Boarding & day tag) -- split on the RAW
  // percentage crossing 50%, confirmed against the two real named examples
  // (Malvern 72.5% -> majority-boarding; Leighton Park 23.4% -> majority-day), NOT
  // the existing 80%/5% typology.boardingTag thresholds (a different, purely
  // descriptive calibration -- Malvern's 72.5% sits below that 80% cutoff and would
  // otherwise land in "Boarding & day", the wrong branch here). See
  // MAJORITY_BOARDING_THRESHOLD's own comment in narrative-config.ts.
  const boardingPct = boarding && boarding.total > 0 ? (boarding.boarders / boarding.total) * 100 : null;
  if (boardingPct !== null) {
    if (boardingPct / 100 >= MAJORITY_BOARDING_THRESHOLD) {
      // Round 5 fix: no "With {{pct}}%..." lead-in here -- the fact sentence just
      // ahead of this clause (boardingSentence()) already states the same number
      // ("...with 72.5% of pupils boarding."). The other three branches don't have
      // this problem, since none of them restate a number the fact sentence gave.
      return {
        text: `The school is not reliant on the local catchment.`,
        branch: "majority_boarding",
      };
    }
    return {
      text: `With the majority of pupils day students, trends in the local market matter.`,
      branch: "majority_day_some_boarding",
    };
  }
  // GIAS's own boardingTag says there IS boarding provision, but no real census
  // boarding figure exists to compute a percentage from -- trust the categorical
  // signal rather than fabricate a number. Not demonstrated by any of this round's
  // real test schools; a defensive fallback, not a characterized branch.
  if (boardingTag === "Boarding") {
    return { text: `As a boarding school, ${schoolName} is not reliant on the local catchment.`, branch: "majority_boarding" };
  }
  return { text: `With a mix of day and boarding pupils, trends in the local market matter.`, branch: "majority_day_some_boarding" };
}

function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}`;
}

// General comparative form (round 4, §5/§7 item 9) -- built out for every real
// LA/region tier relationship, not just "LA declining faster than region" (the one
// direction Guy's own example showed). Same-tier gets the short "as is the region"
// form (Leighton Park's real, unedited example: LA and region both "Decline" but at
// different raw percentages -- Guy's wording doesn't quantitatively compare within
// the tier, just states the region shares it).
function regionComparisonClause(
  laTier: PopulationTrendTier,
  regionTier: PopulationTrendTier,
  regionName: string,
  regionDisplayPct: number,
): string {
  const regionTierLabel = POPULATION_TREND_LABELS[regionTier];
  if (laTier === regionTier) {
    return `, as is the ${regionName} region (${formatSignedPct(regionDisplayPct)}%)`;
  }
  if (laTier === "growing") {
    return `, growing, unlike the ${regionName} region, which is in ${regionTierLabel} (${formatSignedPct(regionDisplayPct)}%)`;
  }
  if (regionTier === "growing") {
    return `, while the ${regionName} region is growing (${formatSignedPct(regionDisplayPct)}%)`;
  }
  const order: PopulationTrendTier[] = ["growing", "stable", "decline", "steep_decline", "severe_decline"];
  const laMoreSevere = order.indexOf(laTier) > order.indexOf(regionTier);
  const comparative = laMoreSevere ? "shrinking even more than" : "shrinking less than";
  return `, ${comparative} the ${regionName} region, which is in ${regionTierLabel} (${formatSignedPct(regionDisplayPct)}%)`;
}

// Paragraph 4 -- returns the four visually distinct chunks confirmed 3/3 in round 3
// (heading alone; boarding-and-catchment sentence; LA/region stats sentence;
// disclaimer-and-CTA sentence), NOT one dense block. Caller splices these directly
// into the page's paragraph array. The region-comparison clause renders for every
// boarding-catchment branch except majority-boarding (round 4, §5) -- tied to which
// branch fired, not an independent flag.
export function paragraph4LocalContext(
  schoolName: string,
  sector: SchoolTypology["sector"],
  boardingTag: SchoolTypology["boarding"],
  boarding: RollSnapshot["boarding"],
  laTrend: PopulationTrend | null,
  laName: string | null,
  regionName: string | null,
  regionTrend: PopulationTrend | null,
  schoolShapeLabel: ShapeLabel | null,
): string[] {
  const heading = "Local context:";

  const catchment = boardingCatchmentClause(schoolName, sector, boardingTag, boarding);
  // The two "day school" branches' own catchment text already opens with "{{school}}
  // is a [state] day school..." -- it subsumes the plain fact sentence rather than
  // following it (confirmed against Guy's real King's edit: one sentence, not two).
  // Only the boarding branches (which state a percentage, not a school-type label)
  // need the plain fact sentence ahead of them.
  const factSentence = catchment?.branch === "state_day" || catchment?.branch === "independent_day"
    ? null
    : boardingSentence(schoolName, boardingTag, boarding);
  const boardingParagraph = [factSentence, catchment?.text ?? null].filter(Boolean).join(" ") || null;

  let laParagraph: string | null = null;
  if (laTrend && laName) {
    const laTierLabel = POPULATION_TREND_LABELS[laTrend.tier];
    const laDisplayPct = displayPopulationTrendPct(laTrend.pct);
    let regionClause = "";
    if (regionTrend && regionName) {
      const regionDisplayPct = displayPopulationTrendPct(regionTrend.pct);
      regionClause =
        catchment?.branch === "majority_boarding"
          ? `, and the ${regionName} region is in ${POPULATION_TREND_LABELS[regionTrend.tier]} (${formatSignedPct(regionDisplayPct)}%)`
          : regionComparisonClause(laTrend.tier, regionTrend.tier, regionName, regionDisplayPct);
    }
    laParagraph = `${laName}'s school-age population (ages 5 to 15) is currently in ${laTierLabel} (${formatSignedPct(laDisplayPct)}%)${regionClause}.`;
  }

  const shapePhrase = schoolShapeLabel
    ? `${schoolShapeLabel.charAt(0).toUpperCase()}${schoolShapeLabel.slice(1).replace("_", " ")}`
    : "shape";
  // Round 5 fix: CTA sentence removed entirely, not reworded -- the call-to-action
  // is built separately and visually elsewhere on the page; Guy doesn't want
  // marketing language mixed into this content block. The paragraph now ends at the
  // disclaimer. This also resolves the redundancy flagged last round between this
  // sentence and the boarding-catchment clause two sentences earlier -- one less
  // thing saying an adjacent version of the same point.
  const disclaimer = `${schoolName}'s ${shapePhrase} shape does not itself indicate whether the school has been subject to these local population declines.`;

  return [heading, boardingParagraph, laParagraph, disclaimer].filter((p): p is string => p !== null);
}
