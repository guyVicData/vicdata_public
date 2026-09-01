// Server-side data-fetching glue for the narrative generator's Paragraph 2 (sector +
// size). Kept separate from narrative.ts (pure classification/templating, no network
// calls) the same way population-trend-lookup.ts is kept separate from
// population-trend.ts.
//
// v2 rebuild (2026-08-31, Priority 2): the nearest-10-peers/dynamic-geography
// mechanism shipped last round is gone. Replaced with a genuine Local-Authority-
// average computation -- for each of the target school's real phases, average that
// same phase's headcount across every other same-sector school in the same LA, using
// server-side-aggregated DfE census data (lookupAgeGenderTotals), not a client-side
// sum of raw breakdown rows. Ages below EARLY_YEARS_PROXY_AGE_THRESHOLD are excluded
// from every quantitative total here -- both the target's own headcount and every
// peer's -- so an early-years phase is never compared to a peer average built on the
// same patchy census coverage (spec §6): the phase can still be *named* (Paragraph 1,
// Paragraph 2's own early-years clause) without ever being *measured*.

import { createServerAnonSupabaseClient } from "./supabase";
import { effectivePhaseTags, phaseTagAgeRange, type PhaseTag } from "./typology";
import { lookupAgeGenderTotals } from "./vicdata-reference";
import type { AgeGenderCounts } from "./roll-data";
import {
  hasEarlyYearsProvision,
  sizeWordFromRatio,
  yearGroupLabel,
  phaseSizeLabel,
  formatSizeSentence,
  type PhaseSizeClause,
} from "./narrative";
import { EARLY_YEARS_PROXY_AGE_THRESHOLD } from "./narrative-config";

// Reliable-range headcount for one phase tag: sums real per-age counts within the
// tag's own nominal age range, floored at EARLY_YEARS_PROXY_AGE_THRESHOLD regardless
// of the tag's own lower bound -- the "never quantify early years" rule applied
// uniformly, not just for a literal early-years tag (Junior is the only tag this
// actually changes anything for, since Senior/Post16/Prep never dip below 11 anyway).
//
// Returns the REAL observed [minAge,maxAge] actually summed over, not the nominal
// tag range -- confirmed necessary against real data in this same build pass: a
// single-effective-tag school's nominal range falls back to raw statutory_low_age/
// high_age directly (Woldingham: nominal 19, real max 17/18; Malvern: nominal 19,
// real max 18 -- its known real Upper Sixth-beyond-clamp case from v1's own §0). Any
// caller quoting a year range for this phase (Topic 3's Year-group label) must use
// the real span this function returns, not the tag's own nominal bound -- the exact
// "statutory field vs real data" mismatch class of bug the age-range fix targeted
// last round, now caught here in the new mechanism before it shipped.
function reliablePhaseHeadcount(
  tag: PhaseTag,
  lowAge: number | null,
  highAge: number | null,
  ageGenderCounts: AgeGenderCounts,
  effectiveTags: PhaseTag[],
): { total: number; minAge: number; maxAge: number } | null {
  if (lowAge === null || highAge === null) return null;
  if (!effectiveTags.includes(tag)) return null;
  const range = effectiveTags.length > 1 ? phaseTagAgeRange(tag, lowAge, highAge) : [lowAge, highAge];
  const lo = Math.max(range[0], EARLY_YEARS_PROXY_AGE_THRESHOLD);
  let total = 0;
  let minAge: number | null = null;
  let maxAge: number | null = null;
  for (const [age, c] of ageGenderCounts) {
    if (age < lo || age > range[1]) continue;
    const count = c.male + c.female;
    if (count <= 0) continue;
    total += count;
    if (minAge === null || age < minAge) minAge = age;
    if (maxAge === null || age > maxAge) maxAge = age;
  }
  if (minAge === null || maxAge === null) return null;
  return { total, minAge, maxAge };
}

// Generic real-span headcount over an explicit [lo,hi] age bound (already floored by
// the caller if needed) -- the sixth-form/secondary split below needs this at a
// finer grain than reliablePhaseHeadcount's own per-tag bound.
function reliableRangeHeadcount(
  lo: number,
  hi: number,
  ageGenderCounts: AgeGenderCounts,
): { total: number; minAge: number; maxAge: number } | null {
  let total = 0;
  let minAge: number | null = null;
  let maxAge: number | null = null;
  for (const [age, c] of ageGenderCounts) {
    if (age < lo || age > hi) continue;
    const count = c.male + c.female;
    if (count <= 0) continue;
    total += count;
    if (minAge === null || age < minAge) minAge = age;
    if (maxAge === null || age > maxAge) maxAge = age;
  }
  if (minAge === null || maxAge === null) return null;
  return { total, minAge, maxAge };
}

// Sixth-form/secondary split within an ordinary "Senior" tag -- confirmed necessary
// against real data: all three of Guy's real hand-edits (Malvern, The King's School,
// Leighton Park) independently split what phaseTags() treats as one undifferentiated
// "Senior" phase into two separately-compared sub-phases at the sixth-form boundary
// ("the secondary years (Years 9-11)... the sixth form..."), not a one-off. Reuses
// the SAME age-16 boundary roll-data.ts's own AGE_BANDS already uses for
// secondary/sixth_form (not a new number invented for this). Only splits when a
// school has real presence on both sides of the boundary within its Senior range --
// a standalone school whose real data never dips below 16 (already effectively a
// sixth-form-only cohort) or never reaches 16 stays a single clause.
const SIXTH_FORM_SPLIT_AGE = 16;

function reliableSeniorHeadcounts(
  lowAge: number,
  highAge: number,
  effectiveTags: PhaseTag[],
  ageGenderCounts: AgeGenderCounts,
): { secondary: { total: number; minAge: number; maxAge: number } | null; sixthForm: { total: number; minAge: number; maxAge: number } | null } {
  const range = effectiveTags.length > 1 ? phaseTagAgeRange("Senior", lowAge, highAge) : [lowAge, highAge];
  const lo = Math.max(range[0], EARLY_YEARS_PROXY_AGE_THRESHOLD);
  const secondary = lo < SIXTH_FORM_SPLIT_AGE ? reliableRangeHeadcount(lo, SIXTH_FORM_SPLIT_AGE - 1, ageGenderCounts) : null;
  const sixthForm = range[1] >= SIXTH_FORM_SPLIT_AGE ? reliableRangeHeadcount(SIXTH_FORM_SPLIT_AGE, range[1], ageGenderCounts) : null;
  return { secondary, sixthForm };
}

function reliableWholeRoll(ageGenderCounts: AgeGenderCounts): number {
  let total = 0;
  for (const [age, c] of ageGenderCounts) {
    if (age < EARLY_YEARS_PROXY_AGE_THRESHOLD) continue;
    total += c.male + c.female;
  }
  return total;
}

export async function computeTopic3SizeSentence(
  schoolUrn: string,
  schoolLowAge: number | null,
  schoolHighAge: number | null,
  ageGenderCounts: AgeGenderCounts,
  sectorGroup: string | null, // raw establishment_type_group, e.g. "Independent schools"
  laName: string | null,
  targetPeriod: number,
): Promise<string | null> {
  if (!sectorGroup || !laName) return null;
  const effectiveTags = effectivePhaseTags(schoolLowAge, schoolHighAge, ageGenderCounts);
  if (effectiveTags.length === 0) return null;
  const hasEarlyYears = hasEarlyYearsProvision(schoolLowAge);

  const supabase = createServerAnonSupabaseClient();
  const { data: peerRows } = await supabase
    .from("schools")
    .select("urn, statutory_low_age, statutory_high_age")
    .eq("la_name", laName)
    .eq("establishment_type_group", sectorGroup)
    .neq("status", "closed")
    .neq("urn", schoolUrn)
    .range(0, 1999); // an LA-sized pool, same defensive cap as la-sector-composition.ts

  const peers = (peerRows ?? []) as { urn: string; statutory_low_age: number | null; statutory_high_age: number | null }[];
  if (peers.length === 0) return null;

  const peerUrns = peers.map((p) => p.urn);
  const totals = await lookupAgeGenderTotals({ sourceId: "dfe_school_census", entityIds: peerUrns, period: targetPeriod });

  const peerCounts = new Map<string, AgeGenderCounts>();
  for (const row of totals) {
    if (!peerCounts.has(row.entity_id)) peerCounts.set(row.entity_id, new Map());
    peerCounts.get(row.entity_id)!.set(row.age, { male: row.male_total, female: row.female_total });
  }

  // Overall whole-roll comparison, all same-sector LA peers regardless of phase tag.
  let peerRollSum = 0;
  let peerRollCount = 0;
  for (const p of peers) {
    const counts = peerCounts.get(p.urn);
    if (!counts || counts.size === 0) continue;
    const roll = reliableWholeRoll(counts);
    if (roll === 0) continue;
    peerRollSum += roll;
    peerRollCount++;
  }
  const targetRoll = reliableWholeRoll(ageGenderCounts);
  if (peerRollCount === 0 || targetRoll === 0) return null;
  const overallBand = sizeWordFromRatio(targetRoll, peerRollSum / peerRollCount);

  // Per-phase comparison. "Senior" gets special-cased into a secondary/sixth-form
  // split (see reliableSeniorHeadcounts's own comment) -- every other tag gets one
  // clause.
  const clauses: PhaseSizeClause[] = [];
  for (const tag of effectiveTags) {
    if (tag === "Senior" && schoolLowAge !== null && schoolHighAge !== null) {
      const { secondary, sixthForm } = reliableSeniorHeadcounts(schoolLowAge, schoolHighAge, effectiveTags, ageGenderCounts);
      if (secondary && sixthForm) {
        for (const [label, target] of [
          ["secondary phase", secondary],
          ["sixth form", sixthForm],
        ] as const) {
          let sum = 0;
          let count = 0;
          for (const p of peers) {
            const counts = peerCounts.get(p.urn);
            if (!counts || p.statutory_low_age === null || p.statutory_high_age === null) continue;
            const peerTags = effectivePhaseTags(p.statutory_low_age, p.statutory_high_age, counts);
            if (!peerTags.includes("Senior")) continue;
            const peerSplit = reliableSeniorHeadcounts(p.statutory_low_age, p.statutory_high_age, peerTags, counts);
            const v = label === "secondary phase" ? peerSplit.secondary : peerSplit.sixthForm;
            if (!v || v.total === 0) continue;
            sum += v.total;
            count++;
          }
          if (count === 0) continue;
          const laAverage = sum / count;
          clauses.push({
            phaseTag: tag,
            phaseLabel: label,
            yearRangeLabel: yearGroupLabel(target.minAge, target.maxAge),
            band: sizeWordFromRatio(target.total, laAverage),
            ratio: target.total / laAverage,
          });
        }
        continue;
      }
      // Falls through to the single-clause path below when only one side of the
      // sixth-form boundary has real data (e.g. a standalone sixth-form-only cohort).
    }

    const target = reliablePhaseHeadcount(tag, schoolLowAge, schoolHighAge, ageGenderCounts, effectiveTags);
    if (target === null || target.total === 0) continue;

    let sum = 0;
    let count = 0;
    for (const p of peers) {
      const counts = peerCounts.get(p.urn);
      if (!counts) continue;
      const peerTags = effectivePhaseTags(p.statutory_low_age, p.statutory_high_age, counts);
      const v = reliablePhaseHeadcount(tag, p.statutory_low_age, p.statutory_high_age, counts, peerTags);
      if (v === null || v.total === 0) continue;
      sum += v.total;
      count++;
    }
    if (count === 0) continue;
    const laAverage = sum / count;
    const band = sizeWordFromRatio(target.total, laAverage);

    clauses.push({
      phaseTag: tag,
      phaseLabel: phaseSizeLabel(tag),
      yearRangeLabel: yearGroupLabel(target.minAge, target.maxAge),
      band,
      ratio: target.total / laAverage,
    });
  }

  return formatSizeSentence(overallBand, clauses, hasEarlyYears, laName);
}
