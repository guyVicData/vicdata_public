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
import { FLAT_RATIO_HIGH, FLAT_RATIO_LOW, type ShapeLabel, type ShapeMetrics } from "./shape-classifier";
import type { SchoolTypology, PhaseTag } from "./typology";
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
import type { SixthFormSectorTotals } from "./sixth-form-sector-aggregates";
import type { FeParticipationDistribution } from "./fe-participation-distributions";
import { sizeBadgeForValue } from "./age-band-distributions";

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
// Exported 2026-09-04 (qualifier build round) -- shape-qualifiers.ts's gender-shape-
// divergence check reuses this exact value rather than a second copy.
export const SINGLE_SEX_SUPPRESSION_BAND = 0.02;
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
  lowAge: number,
  highAge: number,
): { minAge: number; maxAge: number } | null {
  // Round 10 fix, generalized round 13: a multi-tag school is ONE continuous real
  // population, not separate departments, regardless of which pair of tags it is --
  // confirmed directly against phaseTags() (typology.ts): it can only ever produce
  // two multi-tag combinations, ["Junior","Prep"] or ["Junior","Senior"] (every other
  // branch returns a single tag or none; Prep never appears without Junior). Round 10
  // only fixed the Junior+Prep pairing by name (Alameda Middle School, ages ~9-13,
  // was rendering "Year 7 to Year 9" -- phaseTagAgeRange's hardcoded Prep floor of 11
  // cropped the real younger population), which left Junior+Senior schools falling
  // through to Senior's own narrow phaseTagAgeRange and silently dropping real
  // younger years the same way (Withington Girls' School, urn 105595, real ages
  // 7-18, rendered "Year 7 to Year 13" instead of "Year 3 to Year 13"). Since
  // phaseTagAgeRange's narrow per-tag sub-range is never actually wanted for either
  // real multi-tag case, and a single-tag school's own statutory range already IS
  // that one phase's range, this always searches the full statutory range -- no
  // per-tag narrowing left to do here at all.
  let minAge: number | null = null;
  let maxAge: number | null = null;
  for (const [age, c] of ageGenderCounts) {
    if (age < lowAge || age > highAge) continue;
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
    // 2026-09-07 fix (round 13, found via live-page review): GENDER_ALWAYS_ON_HEDGE
    // ("The gender balance varies from year to year") was firing here unconditionally
    // -- wrong for a school at >=98% one gender (classifyGenderComposition's own
    // SINGLE_SEX_SUPPRESSION_BAND), where there IS no balance to vary. The hedge stays
    // on the balanced/mostly branches below, where it's actually true.
    return `${schoolName} is ${article} ${phase} school, ${ageRangeClause}. It is single-sex (${comp.dominantGender}).`;
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

  // Round 3, §3: prepositional "in this Local Authority", not the round-2 build's
  // possessive "of the Local Authority's...". Keeps the article ("of THE
  // independent-sector pupils") -- King's own round-3 edit dropped it, but 2 of 3
  // (Malvern, Leighton Park) kept it and it reads more naturally; not treated as a
  // genuine 3-way disagreement.
  //
  // 2026-09-11, round 19: schoolName-first ("{schoolName} is one of...") and
  // capitalised "Local Authority", not the previous "One of N... schools in LA,
  // {schoolName}'s pupils make up..." order -- confirmed twice now (this exact
  // wording was given again this round, unchanged, after being flagged as a real
  // discrepancy from the function's own prior output last round) -- this is now the
  // one shared sentence RollCard and the main narrative paragraph both use, not two
  // descriptions of the same fact.
  const sectorSentence =
    `${schoolName} is one of ${oneOfCountLabel(thisSchoolSectorSchoolCount)} ${sectorWord} schools in ${laName}, and its ` +
    `pupils make up ${thisSchoolPupilShareOfSector.toFixed(1)}% of the ${sectorWord}-sector pupils in this Local Authority.`;

  return sizeSentence ? `${sectorSentence} ${sizeSentence}` : sectorSentence;
}

// ---------------------------------------------------------------------------
// FE-college local-context sentences. Started as FE-only (Prompt A, item 1's first
// pass, laComposition.bySector.FE -- the same real, under-19-only ILR figures already
// feeding the mainstream RollCard's own FE sentence and this LA's pie-chart FE
// slice); the paired State+Independent sixth-form half below needed the new
// sixth_form_sector_aggregates table (a genuinely new precomputed aggregate,
// characterized separately before being built) -- no new query needed for the FE
// side even now, only the sixth-form side is new.
// ---------------------------------------------------------------------------

// Shared with RollCard.tsx's own "There are N schools..." FE half-sentence -- same
// three rules (0/1/plural), one function instead of two copies of the same
// conditional.
export function renderFeCollegeCountSentence(feSchools: number, fePupils: number): string | null {
  if (feSchools === 0) return null;
  if (feSchools === 1) return `There is 1 FE college, with ${fePupils.toLocaleString()} under-19 students.`;
  return `There are ${feSchools.toLocaleString()} FE colleges, with ${fePupils.toLocaleString()} under-19 students between them.`;
}

// Combined local-provision sentence (this build): the mainstream sixth-form-school
// half (a NEW figure, sixth_form_sector_aggregates' state+independent totals SUMMED
// together for this one sentence -- the pie chart alongside it carries the 3-way
// sector split visually, this sentence doesn't need to) alongside the existing FE
// half. Either half can be absent (a real, not hypothetical, case -- only 152/183 real
// LAs have any mainstream sixth-form data at all) and the sentence degrades to
// whichever half is real, never a fabricated "0 schools" clause; both absent renders
// nothing. The LA name is stated once, in whichever clause leads.
export function renderLocalSixthFormProvisionSentence(
  laName: string,
  sixthFormSchoolCount: number,
  sixthFormPupilTotal: number,
  feCollegeCount: number,
  feUnder19Total: number,
): string | null {
  const hasSchools = sixthFormSchoolCount > 0;
  const hasFe = feCollegeCount > 0;
  if (!hasSchools && !hasFe) return null;

  const schoolsClause = (leading: boolean) => {
    const n = sixthFormSchoolCount.toLocaleString();
    if (sixthFormSchoolCount === 1) {
      return leading
        ? `There is 1 school with a sixth form in ${laName}, with ${sixthFormPupilTotal.toLocaleString()} pupils`
        : `1 school with a sixth form, with ${sixthFormPupilTotal.toLocaleString()} pupils`;
    }
    return leading
      ? `There are ${n} schools with sixth forms in ${laName}, with ${sixthFormPupilTotal.toLocaleString()} pupils between them`
      : `${n} schools with sixth forms, with ${sixthFormPupilTotal.toLocaleString()} pupils between them`;
  };
  const feClause = (leading: boolean) => {
    const n = feCollegeCount.toLocaleString();
    if (feCollegeCount === 1) {
      return leading
        ? `There is 1 FE college in ${laName}, with ${feUnder19Total.toLocaleString()} under-19 students`
        : `1 FE college, with ${feUnder19Total.toLocaleString()} under-19 students`;
    }
    return leading
      ? `There are ${n} FE colleges in ${laName}, with ${feUnder19Total.toLocaleString()} under-19 students between them`
      : `${n} FE colleges, with ${feUnder19Total.toLocaleString()} under-19 students between them`;
  };

  if (hasSchools && hasFe) return `${schoolsClause(true)}, and ${feClause(false)}.`;
  if (hasSchools) return `${schoolsClause(true)}.`;
  return `${feClause(true)}.`;
}

// This college's own share of the LA's FE-college under-19 population -- same
// pattern as paragraph2SectorSize above, but the numerator is this college's own
// real ILR under-19 total (feUnder19Snapshot.total, page.tsx), not a GIAS
// number_of_pupils figure (structurally always null for FE, confirmed last round) --
// and the wording says "FE college students", not "{sector}-sector pupils", per the
// exact wording given for this sentence.
export function paragraphFeCollegeLocalShare(
  collegeName: string,
  laComposition: LaSectorComposition | null,
  ownUnder19Total: number | null,
): string | null {
  if (!laComposition || ownUnder19Total === null) return null;
  const { schools, pupils } = laComposition.bySector.FE;
  if (schools === 0 || pupils <= 0) return null;
  const pct = (ownUnder19Total / pupils) * 100;
  // 2026-09-15 fix: oneOfCountLabel(1) renders the bare cardinal "one", which reads
  // as "is one of one FE colleges" at schools===1 -- grammatically wrong, and common
  // for FE (most LAs have 0-1 real FE colleges; Hammersmith and Fulham, a real
  // verification anchor, has exactly 1). paragraph2SectorSize has the same latent
  // issue for a schools===1 mainstream sector, just rarer in practice -- not touched
  // here, out of this change's scope, but the same fix would apply there too.
  const opening =
    schools === 1
      ? `${collegeName} is the only FE college in ${laComposition.laName}`
      : `${collegeName} is one of ${oneOfCountLabel(schools)} FE colleges in ${laComposition.laName}`;
  return `${opening}, and its pupils make up ${pct.toFixed(1)}% of the FE college students in this Local Authority.`;
}

// ---------------------------------------------------------------------------
// "Current state of the college" narrative -- item 7 from the original spec, built,
// then revised 2026-09-19 from Guy's own before/after review of Truro and Penwith
// College (urn 130629). Same discipline as paragraph1PhaseGender/paragraph2SectorSize/
// paragraph4LocalContext above: deterministic sentences from real computed values,
// each paragraph independently nullable (a college with no adult data, or no
// resolvable region, simply omits that paragraph), no fabrication. Four paragraphs
// from the four real data groups already computed in page.tsx for this branch, not
// forced into paragraph-for-paragraph parity with the mainstream page's own
// four-paragraph structure (the underlying data genuinely doesn't support the same
// shape -- no shape/gender-variation/boarding topics exist for an FE college).
// Paragraph 3 deliberately DIVERGES from FeCollegeLocalContextCard's own two
// sentences (renderLocalSixthFormProvisionSentence/paragraphFeCollegeLocalShare,
// both untouched, still exactly as they were) rather than reusing them -- its own
// comment explains why.
// ---------------------------------------------------------------------------

// Paragraph 1: this college's own participation figures (under-19 + adult, kept as
// two clauses -- never summed into one number, same discipline as the cards
// themselves).
export function feParagraphParticipation(
  collegeName: string,
  under19: { total: number; female: number | null; male: number | null } | null,
  adult: { total: number } | null,
): string | null {
  if (!under19 && !adult) return null;
  const clauses: string[] = [];
  if (under19) {
    let sentence = `${collegeName} reports ${under19.total.toLocaleString()} under-19 learners in further education courses this academic year`;
    if (under19.female !== null && under19.male !== null) {
      const genderTotal = under19.female + under19.male;
      if (genderTotal > 0) sentence += `, ${Math.round((under19.female / genderTotal) * 100)}% of them female`;
    }
    clauses.push(`${sentence}.`);
  }
  if (adult) {
    // 2026-09-19 trim (Guy's own before/after review, Truro and Penwith College):
    // dropped the trailing "-- a different population, not combined into the figure
    // above" clause -- the "never blend under-19 and adult" discipline still holds
    // (this stays its own sentence, never summed with the under-19 figure above), it
    // just doesn't need restating in every paragraph that already keeps them apart.
    clauses.push(`Alongside this, ${adult.total.toLocaleString()} adult (19+) learners are recorded separately.`);
  }
  return clauses.join(" ");
}

// Shared by feParagraphNationalStanding's two clauses -- same threshold ratios
// FeParticipationSizeCard's own nationalComparisonCaption uses, not a new comparison
// rule invented for this paragraph.
function feSizeDirectionWord(value: number, mean: number): string {
  return value > mean * 1.1 ? "larger than" : value < mean * 0.9 ? "smaller than" : "about the same size as";
}

// Paragraph 2: national size standing, same badge/comparison logic
// FeParticipationSizeCard already renders (its own nationalComparisonCaption), just
// in prose form here rather than a badge row. 2026-09-19: extended with the adult
// clause (was under-19 only) -- same badge/direction logic, second independent half,
// each half can fire alone (a college with only adult data, e.g. City Lit, still gets
// a real sentence). "the average real FE college" -> "the average FE college" per
// Guy's own edit -- "real" read as implying the comparison population might otherwise
// be fake, not the intended meaning (a genuine national average, not a padded one).
export function feParagraphNationalStanding(
  collegeName: string,
  under19Total: number | null,
  under19Distribution: FeParticipationDistribution | null,
  adultTotal: number | null,
  adultDistribution: FeParticipationDistribution | null,
): string | null {
  const clauses: string[] = [];
  if (under19Total !== null && under19Distribution) {
    const badge = sizeBadgeForValue(under19Total, under19Distribution.quintiles);
    const mean = Math.round(under19Distribution.meanTotal);
    const direction = feSizeDirectionWord(under19Total, under19Distribution.meanTotal);
    clauses.push(`in the ${badge} size band for under-19 FE participation — ${direction} the average FE college (${mean.toLocaleString()} students)`);
  }
  if (adultTotal !== null && adultDistribution) {
    const badge = sizeBadgeForValue(adultTotal, adultDistribution.quintiles);
    const mean = Math.round(adultDistribution.meanTotal);
    const direction = feSizeDirectionWord(adultTotal, adultDistribution.meanTotal);
    clauses.push(
      `in the ${badge} size band for adult participation — ${direction} the national FE college average of ${mean.toLocaleString()} adult students`,
    );
  }
  if (clauses.length === 0) return null;
  return `Nationally, this places ${collegeName} ${clauses.join(", and ")}.`;
}

// Local counts sentence for paragraph 3 -- deliberately NOT
// renderLocalSixthFormProvisionSentence (FeCollegeLocalContextCard's own sentence,
// untouched -- see feParagraphLocalContext's own comment for why this paragraph
// needs its own composition instead of reusing it). Same "return null when there's
// nothing real to say" discipline that function already has, reimplemented here for
// this paragraph's own different wording (bare school/college counts, no pupil
// totals inline -- those move to their own sentence in feParagraphLocalContext).
function feLocalCountsSentence(laName: string, sixthFormSchoolCount: number, feSchools: number): string | null {
  const hasSchools = sixthFormSchoolCount > 0;
  const hasFe = feSchools > 0;
  if (!hasSchools && !hasFe) return null;

  const schoolsPhrase =
    sixthFormSchoolCount === 1 ? "1 school with a sixth form" : `${sixthFormSchoolCount.toLocaleString()} schools with sixth forms`;
  const fePhrase = feSchools === 1 ? "1 FE college" : `${feSchools.toLocaleString()} FE colleges`;

  if (hasSchools && hasFe) {
    const verb = sixthFormSchoolCount === 1 ? "is" : "are";
    return `There ${verb} ${schoolsPhrase} in ${laName} and ${fePhrase}.`;
  }
  if (hasSchools) {
    const verb = sixthFormSchoolCount === 1 ? "is" : "are";
    return `There ${verb} ${schoolsPhrase} in ${laName}.`;
  }
  const verb = feSchools === 1 ? "is" : "are";
  return `There ${verb} ${fePhrase} in ${laName}.`;
}

// Paragraph 3: local context. 2026-09-19 restructure (Guy's own before/after review,
// Truro and Penwith College) -- deliberately DIVERGES from
// renderLocalSixthFormProvisionSentence/paragraphFeCollegeLocalShare
// (FeCollegeLocalContextCard's own two sentences, both untouched, still exactly as
// they were): the narrative now states a combined "total 16+ population"
// (sixth-form pupils + FE under-19 students, a figure the card deliberately never
// blends into one number) and this college's own share of BOTH the FE-only total and
// that combined total -- a real, deliberate choice for this paragraph specifically,
// not a precedent for the card to follow too.
export function feParagraphLocalContext(
  collegeName: string,
  laComposition: LaSectorComposition | null,
  sixthFormLa: { state: { total: number; schoolCount: number } | null; independent: { total: number; schoolCount: number } | null },
  ownUnder19Total: number | null,
): string | null {
  const laName = laComposition?.laName ?? null;
  if (!laName) return null;

  const feSchools = laComposition?.bySector.FE.schools ?? 0;
  const fePupils = laComposition?.bySector.FE.pupils ?? 0;
  const sixthFormSchoolCount = (sixthFormLa.state?.schoolCount ?? 0) + (sixthFormLa.independent?.schoolCount ?? 0);
  const sixthFormPupilTotal = (sixthFormLa.state?.total ?? 0) + (sixthFormLa.independent?.total ?? 0);
  const combinedTotal = sixthFormPupilTotal + fePupils;

  const countsSentence = feLocalCountsSentence(laName, sixthFormSchoolCount, feSchools);
  if (!countsSentence) return null; // nothing real to say at all -- same discipline as the card's own degrade

  const sentences = [countsSentence];
  if (combinedTotal > 0) sentences.push(`The total 16+ population is ${combinedTotal.toLocaleString()}.`);

  if (ownUnder19Total !== null && fePupils > 0 && combinedTotal > 0) {
    const feSharePct = (ownUnder19Total / fePupils) * 100;
    const combinedSharePct = (ownUnder19Total / combinedTotal) * 100;
    sentences.push(
      `${collegeName} students make up ${feSharePct.toFixed(1)}% of the FE college students, and ` +
        `${combinedSharePct.toFixed(1)}% of all 16+ students in ${laName}.`,
    );
  }

  return sentences.join(" ");
}

// 2026-09-19: England's 9 GOR regions take "the" except London (a real English-usage
// rule, not a stylistic choice) -- "Across the South West"/"Across the North East",
// but "Across London". Yorkshire and The Humber is a special case: it doesn't take a
// LEADING "the" (no "the Yorkshire and the Humber"), but the DB's own stored
// capitalisation ("...The Humber") needs lowercasing to read correctly mid-sentence
// ("Yorkshire and the Humber"). A short lookup, not a blanket prepend -- a blanket
// "the {region}" would produce "the London", which is wrong.
const REGION_WITH_ARTICLE: Record<string, string> = {
  London: "London",
  "Yorkshire and The Humber": "Yorkshire and the Humber",
};

function regionWithArticle(region: string): string {
  return REGION_WITH_ARTICLE[region] ?? `the ${region}`;
}

// Paragraph 4: regional standing -- this college's own region's FE-college share of
// England's total, same real totals RegionalSixthFormCard's own pies read.
export function feParagraphRegionalStanding(
  ownRegion: string | null,
  ownRegionTotals: SixthFormSectorTotals | null,
  nationalTotals: SixthFormSectorTotals | null,
): string | null {
  if (!ownRegion || !ownRegionTotals || !nationalTotals) return null;
  const regionFe = ownRegionTotals.fe?.total ?? 0;
  const nationalFe = nationalTotals.fe?.total ?? 0;
  if (regionFe <= 0 || nationalFe <= 0) return null;
  const pct = (regionFe / nationalFe) * 100;
  return `Across ${regionWithArticle(ownRegion)}, FE colleges report ${regionFe.toLocaleString()} under-19 students between them — ${pct.toFixed(1)}% of England's total.`;
}

// ---------------------------------------------------------------------------
// Paragraph 3 -- Shape (spec §4, Topics 4a + 5 merged). The "N genuine changes"
// count is dropped as a separate sentence per Priority 3 -- its substance folds
// into the shape sentence's own wording instead (config-gated, in case a future
// round wants it back).
// ---------------------------------------------------------------------------
export function paragraph3Shape(
  schoolName: string,
  shapeLabel: ShapeLabel | null,
  realMoveCount: number,
  metrics: ShapeMetrics | null,
  dominantTransition: { fromAge: string; toAge: string } | null,
): string {
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

  const explanation = metrics ? numericShapeDefinition(shapeLabel, metrics, dominantTransition) : null;
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
// Numeric shape definitions (Round 10's agreed direction, replacing the old static
// SHAPE_EXPLANATIONS prose above -- deleted, not just unused, since nothing else read
// it). One sentence per shape, built from the real numbers behind the classification
// (metrics/dominantTransition) rather than written in advance -- fixes Wineglass's
// own stale "students join at multiple entry points" line along the way, which was
// never true under the current ratio-based Wineglass definition, just carried over
// from an earlier taxonomy round that never got corrected when the definition
// changed under it.
//
// Returns a lowercase, no-trailing-period fragment: paragraph3Shape's own "meaning
// that {fragment}." wrapper below supplies capitalisation and the period; ShapeCard's
// own standalone rendering (dashboard/ShapeCard.tsx) capitalises it separately as its
// own sentence, same source either way.
// ---------------------------------------------------------------------------
export function numericShapeDefinition(
  shapeLabel: ShapeLabel,
  metrics: ShapeMetrics,
  dominantTransition: { fromAge: string; toAge: string } | null,
): string | null {
  const anchored = metrics.anchored;
  if (anchored.length === 0) return null;
  const first = anchored[0];
  const last = anchored[anchored.length - 1];

  if (shapeLabel === "mushroom" || shapeLabel === "top_step") {
    if (!dominantTransition || metrics.stepPostVsPrePct === null) return null;
    const toAge = Number(dominantTransition.toAge);
    const postPoints = anchored.filter((p) => Number(p.key) >= toAge);
    if (postPoints.length === 0) return null;
    const z = Math.round(Math.abs(metrics.stepPostVsPrePct) * 100);
    const direction = shapeLabel === "mushroom" ? "larger" : "smaller";
    if (postPoints.length === 1) {
      return `the last year group (${yearGroupSingleLabel(Number(postPoints[0].key))}) is ${z}% ${direction} than the years below`;
    }
    // "(Years X-Y)" -- one shared "Years" prefix, so a plain "Year N" label drops its
    // own redundant "Year " (kept in full for "Reception"/"Early Years", which don't
    // read as a bare number).
    const compact = (age: number) => {
      const label = yearGroupSingleLabel(age);
      return label.startsWith("Year ") ? label.slice("Year ".length) : label;
    };
    const x = compact(Number(postPoints[0].key));
    const y = compact(Number(postPoints[postPoints.length - 1].key));
    return `the last ${numberToWords(postPoints.length)} year groups (Years ${x}–${y}) are ${z}% ${direction} than the years below`;
  }

  if (shapeLabel === "funnel" || shapeLabel === "pyramid") {
    if (metrics.ratio === null) return null;
    const x = yearGroupSingleLabel(Number(first.key));
    const y = yearGroupSingleLabel(Number(last.key));
    const z = Math.round(Math.abs(metrics.ratio - 1) * 100);
    const verb = shapeLabel === "funnel" ? "grow" : "shrink";
    const direction = shapeLabel === "funnel" ? "larger" : "smaller";
    return `year groups ${verb} steadily from ${x} to ${y}, ending ${z}% ${direction} than they start`;
  }

  if (shapeLabel === "wineglass") {
    if (metrics.ratio === null) return null;
    const x = yearGroupSingleLabel(Number(first.key));
    const y = yearGroupSingleLabel(Number(last.key));
    const z = Math.round((metrics.ratio - 1) * 100);
    return `${y} is ${z}% larger than ${x}`;
  }

  if (shapeLabel === "tube") {
    if (metrics.ratio === null) return null;
    const x = yearGroupSingleLabel(Number(first.key));
    const y = yearGroupSingleLabel(Number(last.key));
    const z = Math.round(Math.abs(metrics.ratio - 1) * 100);
    return `year groups stay within ${z}% of each other, ${x} to ${y}`;
  }

  return null; // irregular -- dead code, classifyShape() never returns it
}

// 2026-09-09, ShapeCard's own standalone rendering: the same fragment above, as its
// own capitalised, period-terminated sentence rather than folded into paragraph3Shape's
// "meaning that..." wrapper.
export function renderNumericShapeDefinition(
  shapeLabel: ShapeLabel,
  metrics: ShapeMetrics,
  dominantTransition: { fromAge: string; toAge: string } | null,
): string | null {
  const fragment = numericShapeDefinition(shapeLabel, metrics, dominantTransition);
  if (!fragment) return null;
  return `${fragment.charAt(0).toUpperCase()}${fragment.slice(1)}.`;
}

// ---------------------------------------------------------------------------
// Phase-split sentence (round 19, item 7) -- a second sentence for the shape
// definition block, through-schools only (typology.phase.length > 1). The senior
// roll (secondary + sixth_form age bands, Years 7-13) against the roll below it
// (early_years + primary, Early Years-Year 6) -- a fixed split by construction of
// roll-data.ts's own AGE_BANDS boundaries, not tied to which specific phase tags a
// given through-school happens to carry, so the labels below are correct for any
// through-school, not just a Junior+Senior one. "About the same" reuses the
// classifier's own FLAT_RATIO_LOW/HIGH band (already the platform's answer to "how
// close counts as flat") rather than inventing a second threshold for the same idea.
// This is a real, true, but CORRELATED fact (bigger senior roll often co-occurs with
// certain shapes) -- never the stated reason for the classification, which stays tied
// to the actual decisive mechanism (numericShapeDefinition's ratio/step maths above).
// No "now"/"currently" wording -- single-year census snapshot, not a trend.
// ---------------------------------------------------------------------------
export type PhaseSplitComparison = "bigger" | "smaller" | "about_the_same" | null;

export function computePhaseSplitComparison(seniorRoll: number, belowRoll: number): PhaseSplitComparison {
  if (seniorRoll <= 0 || belowRoll <= 0) return null;
  const ratio = seniorRoll / belowRoll;
  if (ratio >= FLAT_RATIO_LOW && ratio <= FLAT_RATIO_HIGH) return "about_the_same";
  return ratio > 1 ? "bigger" : "smaller";
}

const PHASE_SPLIT_PHRASE: Record<Exclude<PhaseSplitComparison, null>, string> = {
  bigger: "is bigger than",
  smaller: "is smaller than",
  about_the_same: "is about the same size as",
};

export function renderPhaseSplitSentence(comparison: PhaseSplitComparison): string | null {
  if (!comparison) return null;
  return (
    `The senior-school roll (Years 7–13) ${PHASE_SPLIT_PHRASE[comparison]} the roll below it ` +
    "(Early Years–Year 6)."
  );
}

// ---------------------------------------------------------------------------
// Shape qualifier sentences (qualifier build round, extended round 15 with exact
// agreed wording, joining fixed round 16) -- same compute/render split as
// topic4bGenderVariation/renderTopic4b above. Borderline and multipleSteps get no
// end-user wording this round -- stay internal/reported data only
// (shape-qualifiers.ts). compute functions take the already-computed
// shape-qualifiers.ts result, never re-derive it; render functions are pure
// formatting, no decision logic.
//
// 2026-09-10 fix (round 16): each render function returns a LOWERCASE, no-trailing-
// period fragment, not a standalone capitalised sentence -- round 15's "each addendum
// is its own sentence" produced real sentence fragments for the "though"-led clauses
// (erratic, stillDrifting), which are grammatically subordinate and need a main
// clause, not a full stop of their own. joinShapeQualifierAddenda below assembles all
// firing fragments into ONE sentence (comma-joined, one capital letter, one final
// stop) -- see its own comment for the one exception (a lone "though" clause).
// ---------------------------------------------------------------------------
export function computeErraticQualifier(erratic: boolean): boolean {
  return erratic;
}

export function renderErraticQualifier(erratic: boolean): string | null {
  if (!erratic) return null;
  return "though it moves up and down from year to year rather than following one clear trend";
}

export type SingleAgeAnomalyQualifier = { yearLabel: string } | null;

export function computeSingleAgeAnomalyQualifier(
  isSingleAgeAnomaly: boolean,
  moves: ("up" | "down" | "flat")[],
  anchored: { key: string; total: number }[],
): SingleAgeAnomalyQualifier {
  if (!isSingleAgeAnomaly) return null;
  const idx = moves.findIndex((m) => m !== "flat");
  if (idx === -1 || !anchored[idx + 1]) return null;
  return { yearLabel: yearGroupSingleLabel(Number(anchored[idx + 1].key)) };
}

export function renderSingleAgeAnomalyQualifier(result: SingleAgeAnomalyQualifier): string | null {
  if (!result) return null;
  return `with one clear exception: numbers jump noticeably in ${result.yearLabel}`;
}

// broadDirection's own three values, duck-typed rather than imported from
// shape-qualifiers.ts -- that module already imports SINGLE_SEX_SUPPRESSION_BAND
// FROM this file, so importing back would be circular. The caller (ShapeCard.tsx)
// already has the real computed direction on the qualifier result; this just needs
// its shape, not the function that produced it.
type GenderDirection = "top_heavy" | "bottom_heavy" | "flat";
const GENDER_DIRECTION_PHRASE: Record<GenderDirection, string> = {
  top_heavy: "grow through the school",
  bottom_heavy: "narrow through the school",
  flat: "stay a similar size throughout",
};

export type GenderShapeDivergenceQualifier = {
  maleDirection: GenderDirection;
  femaleDirection: GenderDirection;
} | null;

export function computeGenderShapeDivergenceQualifier(
  divergence: { maleDirection: GenderDirection; femaleDirection: GenderDirection } | null,
): GenderShapeDivergenceQualifier {
  return divergence;
}

export function renderGenderShapeDivergenceQualifier(result: GenderShapeDivergenceQualifier): string | null {
  if (!result) return null;
  return (
    `boys and girls don't follow the same pattern here — boys ${GENDER_DIRECTION_PHRASE[result.maleDirection]}, ` +
    `girls ${GENDER_DIRECTION_PHRASE[result.femaleDirection]}`
  );
}

// 2026-09-11, round 19, item 7: restores the % range into the rendered text -- it was
// chart-only before (bare "(see chart)"). Takes the whole shape-qualifiers.ts
// GenderMixVariation-shaped object rather than just `notable` alone, since the min/max
// share values live there, not on a derived boolean.
export type GenderMixQualifier = { minSharePct: number; maxSharePct: number } | null;

export function computeGenderMixQualifier(
  genderMix: { notable: boolean; minSharePct: number; maxSharePct: number } | null,
): GenderMixQualifier {
  if (!genderMix || !genderMix.notable) return null;
  return { minSharePct: genderMix.minSharePct, maxSharePct: genderMix.maxSharePct };
}

export function renderGenderMixQualifier(result: GenderMixQualifier): string | null {
  if (!result) return null;
  return (
    "and the balance between boys and girls shifts noticeably across the years, with girls making up between " +
    `${Math.round(result.minSharePct)}% and ${Math.round(result.maxSharePct)}% of their year group`
  );
}

export function computeStillDriftingQualifier(stillDrifting: boolean): boolean {
  return stillDrifting;
}

export function renderStillDriftingQualifier(stillDrifting: boolean): string | null {
  if (!stillDrifting) return null;
  // 2026-09-11 fix (round 19): "it" is referentially ambiguous once this clause
  // trails a gender-specific clause (could read as the gender balance, not the roll)
  // -- "the tail" names what's actually still moving, unconditionally, not just when
  // a gender clause happens to precede it.
  return "though the tail continues to ease down slightly in the years after";
}

// 2026-09-11, round 19: which of the five qualifiers a fragment came from -- needed by
// joinShapeQualifierAddenda below to decide "though" vs semicolon, not carried on the
// render functions themselves (they stay plain string producers, unchanged).
export type ShapeQualifierKind = "erratic" | "singleAgeAnomaly" | "genderShapeDivergence" | "genderMix" | "stillDrifting";
export type ShapeQualifierFragment = { kind: ShapeQualifierKind; text: string } | null;

// Only these two clauses' own raw text starts with "though " -- everything below is
// about deciding, per adjacency, whether that "though" is kept (a genuine
// qualification of its neighbour) or dropped (an unrelated fact, wrongly implying a
// causal/contrastive link "though X, Y" always carries).
const THOUGH_CAPABLE = new Set<ShapeQualifierKind>(["erratic", "stillDrifting"]);

// Confirmed pairs, not guessed: erratic+genderShapeDivergence keeps "though"
// (Marlborough, round 16's own original worked example, never flagged as wrong) --
// a real link, since an erratic COMBINED trend is often exactly what you get once two
// genuinely different per-gender shapes are added together. erratic+genderMix drops
// it (this round's own illustrative example -- a % split shifting is too surface-
// level a fact to be "explained by" or "qualify" an erratic combined trend).
// genderShapeDivergence+stillDrifting drops it (Good Shepherd, flagged from the
// round 16 review artifact -- the tail's own drift is a fact about the AGGREGATE
// shape's mechanism, unconnected to the genders having different underlying shapes).
// erratic+stillDrifting is the one pair with no named example either way -- kept
// here as genuinely related (both describe the same shape's own trajectory
// behaviour, nothing about gender diluting the connection) but flagged as a real
// extrapolation, not a given fact, in case that judgment call is wrong.
const THOUGH_RELATED: [ShapeQualifierKind, ShapeQualifierKind][] = [
  ["erratic", "genderShapeDivergence"],
  ["erratic", "stillDrifting"],
];

function thoughRelated(a: ShapeQualifierKind, b: ShapeQualifierKind): boolean {
  return THOUGH_RELATED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// Joins the firing fragments into one sentence: one capital letter at the very
// start, one final stop, per-pair connector decided as follows --
//  - Neither side of the pair is a "though"-capable clause: plain ", " (unaffected
//    by any of this -- e.g. genderShapeDivergence next to genderMix).
//  - One side IS "though"-capable and the pair is a confirmed-related one
//    (THOUGH_RELATED): ", ", and that clause's own leading "though" is kept.
//  - Otherwise (a "though"-capable clause adjacent to something it doesn't
//    genuinely qualify, on EITHER side, including standing completely alone): "; ",
//    and the leading "though" is stripped -- the clause becomes its own independent
//    clause rather than falsely implying a contrast/qualification that isn't there.
//    A lone "though" clause (round 16's original edge case) falls out of this same
//    rule for free: no neighbour on either side means no related neighbour, so it
//    strips and stands alone.
//
// One more wrinkle, caught in testing rather than given: erratic and stillDrifting
// are BOTH though-capable and (per THOUGH_RELATED) related to each other, so a naive
// "keep though if related to EITHER neighbour" rule doubles up -- "though it moves
// up and down..., though the tail continues..." repeats the subordinating word.
// Fixed by only ever introducing "though" at the START of a related run: a
// though-capable clause that's continuing a run its own PRECEDING neighbour already
// started (prevRelated) drops its own "though" rather than repeating it: the
// preceding clause's "though" already covers the whole run.
export function joinShapeQualifierAddenda(fragments: ShapeQualifierFragment[]): string | null {
  const real = fragments.filter((f): f is { kind: ShapeQualifierKind; text: string } => f !== null && f.text.length > 0);
  if (real.length === 0) return null;

  const texts = real.map((f, i) => {
    if (!THOUGH_CAPABLE.has(f.kind)) return f.text;
    const prev = real[i - 1];
    const prevRelated = prev !== undefined && thoughRelated(prev.kind, f.kind);
    if (prevRelated) return f.text.slice("though ".length); // continues a run already introduced
    const next = real[i + 1];
    const keepThough = next !== undefined && thoughRelated(f.kind, next.kind);
    return keepThough ? f.text : f.text.slice("though ".length);
  });

  let joined = texts[0];
  for (let i = 1; i < texts.length; i++) {
    const a = real[i - 1].kind;
    const b = real[i].kind;
    const involvesThoughClause = THOUGH_CAPABLE.has(a) || THOUGH_CAPABLE.has(b);
    const connector = !involvesThoughClause || thoughRelated(a, b) ? ", " : "; ";
    joined += connector + texts[i];
  }
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
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
