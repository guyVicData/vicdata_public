// Batch ILR-participation roll figures for the map (schools-in-bounds/route.ts,
// 2026-08-28 build, following the same-day investigation into why FE-corporation/
// sixth-form/special-post-16 institutions were entirely invisible on the map). A
// separate, deliberately narrow module from ilr-participation-data.ts (the existing
// per-school "FE participation data (ILR)" card on the school profile page) -- that
// module parses a single school's dfe_fe_participation_academy facts into a display
// snapshot with a male/female split; this one is a raw total-only lookup across a
// BATCH of URNs from any of the three dfe_fe_participation* sources, for map dot
// sizing. Kept separate rather than generalising ilr-participation-data.ts itself --
// that module's own comment already explains why it deliberately doesn't reuse
// roll-data.ts's census-shaped types, and the same "different source, different
// shape, don't blend the code paths either" discipline applies here.
//
// This file NEVER blends an ILR total with a census total for the same figure -- each
// URN's roll comes from exactly one source, and the caller (schools-in-bounds) is
// responsible for recording WHICH one so the map can render it with a visibly
// distinct marker style (per Guy's explicit instruction -- an ILR whole-year
// participant count is not the same measurement as a census single-day headcount,
// same reasoning as the profile page's separate labelled ILR card).

import type { ReferenceFact } from "./vicdata-reference";

// Institutions whose ILR-reported under-19 participation is a real analogue of "on
// roll" -- exactly the 3 establishment types dfe_fe_participation's and
// dfe_fe_participation_adult's own ingest-side UKPRN->URN crosswalks target
// (ingest/sources/dfe_fe_participation.py's _TARGET_ESTABLISHMENT_TYPES, vicdata
// repo -- re-exported here as typology.ts's FE_PARTICIPATION_ESTABLISHMENT_TYPES,
// not duplicated). Higher education institutions/Miscellaneous/Welsh establishment
// are never in that crosswalk at all, so querying ILR for them would always return
// nothing -- callers should skip the round-trip for them entirely.

// Only education_and_training is ever meaningfully populated for this institution
// population (apprenticeships/tailored_learning/community_learning are genuinely
// different provision types, not folded in here -- same reasoning as
// ilr-participation-data.ts's own BREAKDOWN_RE).
export const UNDER_19_TOTAL_BREAKDOWN = "education_and_training_under_19_total";
export const ADULT_TOTAL_BREAKDOWN = "education_and_training_19_plus_total";

export type IlrRollTotal = { period: number; total: number };

function latestNonZeroTotal(facts: ReferenceFact[], breakdown: string): Map<string, IlrRollTotal> {
  const byUrn = new Map<string, IlrRollTotal>();
  // Newest period first per URN, same "skip a genuinely absent/zero period" discipline
  // as roll-data.ts's buildRollSnapshot and ilr-participation-data.ts's own builder --
  // in practice this source never writes a real zero (suppressed values are dropped
  // at ingest, not written as 0), so this is mostly defensive symmetry, not something
  // expected to trigger often.
  const byUrnAll = new Map<string, ReferenceFact[]>();
  for (const f of facts) {
    if (f.breakdown !== breakdown || f.value_numeric === null) continue;
    if (!byUrnAll.has(f.entity_id)) byUrnAll.set(f.entity_id, []);
    byUrnAll.get(f.entity_id)!.push(f);
  }
  for (const [urn, urnFacts] of byUrnAll) {
    const newest = urnFacts.reduce((a, b) => (b.period > a.period ? b : a));
    if (newest.value_numeric && newest.value_numeric > 0) {
      byUrn.set(urn, { period: newest.period, total: newest.value_numeric });
    }
  }
  return byUrn;
}

// Under-19 total (dfe_fe_participation or dfe_fe_participation_academy -- same
// breakdown shape, same parse).
export function under19Totals(facts: ReferenceFact[]): Map<string, IlrRollTotal> {
  return latestNonZeroTotal(facts, UNDER_19_TOTAL_BREAKDOWN);
}

// 19+/adult total (dfe_fe_participation_adult) -- a genuinely different population
// from the under-19 figure above, per that source's own docstring ("keep the adult
// data, it's real and potentially useful, but it does not belong merged with the
// rolls source"). Used here only as a last-resort fallback when an FE-population
// institution has no under-19 figure at all (common for HE-leaning/adult-serving
// institutions among the newly-included types) -- still rendered with the same
// ILR-sourced marker style as an under-19 figure, since the map's distinction is
// ILR-vs-census, not under-19-vs-adult.
export function adultTotals(facts: ReferenceFact[]): Map<string, IlrRollTotal> {
  return latestNonZeroTotal(facts, ADULT_TOTAL_BREAKDOWN);
}
