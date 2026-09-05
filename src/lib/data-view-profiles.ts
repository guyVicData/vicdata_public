// Member Data View: the shared per-school data fetch used by Dashboard, Rankings and
// Map alike (brief §4's "one state, three consumers" applies just as much to the
// underlying data as to the filter state itself -- all three views render the exact
// same fetched profiles, never three independently-fetched versions that could
// silently disagree).

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData, type ReferenceFact } from "./vicdata-reference";
import {
  buildRollSnapshot,
  buildRollTrend,
  singleAgeGenderCountsForPeriod,
  shapeClassifierInput,
  type RollSnapshot,
  type AgeGenderCounts,
} from "./roll-data";
import { classifyShape, type ShapeLabel } from "./shape-classifier";
import { under19Totals, adultTotals, UNDER_19_TOTAL_BREAKDOWN, ADULT_TOTAL_BREAKDOWN } from "./fe-participation-roll";
import {
  sectorTag,
  boardingTag,
  genderTag,
  effectivePhaseTags,
  FE_PARTICIPATION_ESTABLISHMENT_TYPES,
  STATE_ESTABLISHMENT_GROUPS,
  type SectorTag,
  type BoardingTag,
  type GenderTag,
  type PhaseTag,
} from "./typology";
import type { FilterableSchoolData } from "./data-view-filters";

// Real, already-diagnosed limit (brief §6.1): a live, unbatched lookupReferenceData
// call against ~264 entity IDs hits a genuine Postgres statement timeout -- confirmed
// pre-existing, not rediscovered here. lookupReferenceData itself paginates by ROWS
// RETURNED (1000/page), not by how many entityIds go INTO one request, so a large
// entityIds array is still one huge underlying query regardless of that pagination --
// chunking has to happen at this level. Chunks of 40 is the proven-working size
// (brief's own words), reused verbatim rather than re-derived.
const CENSUS_FETCH_CHUNK = 40;

// Chunks fetched with bounded concurrency, not strictly sequentially -- measured live
// against the real §6.1 Senior-boarding recipe (≈264 candidates, 7 chunks of 40):
// sequential chunking took 71.6s end to end, dominated by per-chunk network
// round-trip latency to the remote vicdata reference API, not database load (the
// brief's own concern was a single OVERSIZED request timing out server-side, not
// concurrent moderate-sized ones contending with each other) -- genuinely too slow
// for an interactive "open this default list" click. A small concurrency cap (4)
// keeps every individual request at the exact proven-safe chunk size while letting
// several round-trips overlap, without firing all 7 at once against a remote API
// this repo doesn't own the capacity planning for.
const CENSUS_FETCH_CONCURRENCY = 4;

export async function fetchCensusFactsBatched(entityIds: string[]): Promise<ReferenceFact[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < entityIds.length; i += CENSUS_FETCH_CHUNK) {
    chunks.push(entityIds.slice(i, i + CENSUS_FETCH_CHUNK));
  }
  const all: ReferenceFact[] = [];
  for (let i = 0; i < chunks.length; i += CENSUS_FETCH_CONCURRENCY) {
    const batch = chunks.slice(i, i + CENSUS_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk) => lookupReferenceData({ sourceId: "dfe_school_census", entityIds: chunk })),
    );
    for (const facts of results) all.push(...facts);
  }
  return all;
}

// Year the "since 2019" trend badges (brief §5: Current Roll/Gender/Boarding cards)
// all anchor to -- real 2019 census data is the earliest year this codebase treats as
// a stable trend start (population-trend.ts's own LA/region trend series uses the
// same anchor). Not necessarily every school's own earliest real data point -- a
// school opened after 2019 simply has no real "since 2019" comparison, handled as a
// null trend rather than a fabricated one.
export const TREND_ANCHOR_PERIOD = 2019;

export type DataViewSchoolProfile = {
  urn: string;
  name: string;
  town: string | null;
  easting: number | null;
  northing: number | null;
  sector: SectorTag | null;
  boarding: BoardingTag | null;
  gender: GenderTag | null;
  phase: PhaseTag[]; // effective (enrollment-aware), current snapshot
  establishmentType: string | null;
  establishmentTypeGroup: string | null;
  statutoryLowAge: number | null;
  statutoryHighAge: number | null;
  current: RollSnapshot | null;
  anchor2019: RollSnapshot | null; // null if the school has no real 2019 data (e.g. opened since)
  trend: RollSnapshot[]; // full real history, ascending by period
  ageGenderCounts: AgeGenderCounts; // current snapshot's period only -- filter slicing input
  // Same per-age breakdown, but AT the 2019 trend anchor -- lets a filtered "since
  // 2019" trend badge (Dashboard's Current Roll/Gender split cards) recompute the
  // 2019 comparison figure through the exact same phase/age/gender slice as the
  // current figure, rather than comparing a filtered current value against an
  // unfiltered historical one (which would silently misstate the trend for any
  // school whose phase mix has changed shape since 2019).
  ageGenderCounts2019: AgeGenderCounts;
  boardersGenderSplit: { female: number; male: number } | null;
  shapeCurrent: ShapeLabel | null;
  shape2019: ShapeLabel | null;
  // FE colleges mostly have zero real DfE census facts at all (rolls topic spec §10:
  // "502 FE-corporation institutions have zero census facts, a real and permanent
  // gap"), so `current`/`trend`/`shapeCurrent` above are honestly null for them --
  // never blended with a different-basis source, same discipline
  // ilr-participation-data.ts/fe-participation-roll.ts already establish. This is a
  // deliberately separate, last-resort fallback: a single ILR-sourced "roll" NUMBER
  // (whole-year participants, not a census single-day headcount) so an FE college's
  // Current Roll card can show something real rather than a blank, always rendered
  // with an explicit ILR caveat (see data-view lib's ILR_ROLL_CAVEAT), never treated
  // as interchangeable with a census RollSnapshot. Genuinely out of scope this round:
  // FE colleges' own multi-year trend/gender/boarding/shape (a separate ILR-based
  // pipeline the public FE college page already has via FeCollegeCards.tsx/
  // fe-participation-roll.ts, not ported into this shared multi-school framework --
  // logged as a real follow-up in docs/vicdata_data_view_open_questions.md).
  ilrFallbackRoll: { total: number; period: number; basis: "under_19" | "adult" } | null;
};

export function profileToFilterableData(p: DataViewSchoolProfile): FilterableSchoolData {
  return {
    statutoryLowAge: p.statutoryLowAge,
    statutoryHighAge: p.statutoryHighAge,
    ageGenderCounts: p.ageGenderCounts,
    boarding: p.current?.boarding ?? null,
    boardersGenderSplit: p.boardersGenderSplit,
  };
}

// Same slice, at the 2019 trend anchor -- see ageGenderCounts2019's own comment for
// why a filtered trend badge needs this rather than comparing a filtered current
// value against an unfiltered historical one. Boarding gender split at 2019 isn't
// separately tracked (a real, minor simplification, logged in
// docs/vicdata_data_view_open_questions.md) -- a boarding+gender filter combination
// at the 2019 anchor specifically falls back to the whole-boarding-population figure
// rather than a gendered slice, still correct for every other filter combination.
export function profileToFilterableData2019(p: DataViewSchoolProfile): FilterableSchoolData {
  return {
    statutoryLowAge: p.statutoryLowAge,
    statutoryHighAge: p.statutoryHighAge,
    ageGenderCounts: p.ageGenderCounts2019,
    boarding: p.anchor2019?.boarding ?? null,
    boardersGenderSplit: null,
  };
}

type SchoolRow = {
  urn: string;
  current_name: string;
  town: string | null;
  easting: number | null;
  northing: number | null;
  establishment_type_group: string | null;
  establishment_type: string | null;
  boarders_name: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
  gender: string | null;
};

function boardersGenderSplitFromFacts(facts: ReferenceFact[], period: number): { female: number; male: number } | null {
  const female = facts.find((f) => f.period === period && f.breakdown === "boarders_female")?.value_numeric ?? null;
  const male = facts.find((f) => f.period === period && f.breakdown === "boarders_male")?.value_numeric ?? null;
  if (female === null || male === null) return null;
  return { female, male };
}

// Builds one real, richly-typed profile per URN -- typology fields from `schools`,
// every real DfE census fact (all periods, not just current) via the batched fetch
// above. Returns profiles in the SAME order as the input urns array; a URN with no
// real schools row at all is simply omitted (never a null placeholder in the array --
// callers already handle "fewer schools than requested" honestly elsewhere in this
// codebase, e.g. findSurroundingSchools' own skip-and-backfill).
export async function fetchDataViewProfiles(urns: string[]): Promise<DataViewSchoolProfile[]> {
  if (urns.length === 0) return [];
  const supabase = createServerAnonSupabaseClient();

  const [{ data: rows }, facts] = await Promise.all([
    supabase
      .from("schools")
      .select(
        "urn, current_name, town, easting, northing, establishment_type_group, establishment_type, boarders_name, statutory_low_age, statutory_high_age, gender",
      )
      .in("urn", urns),
    fetchCensusFactsBatched(urns),
  ]);

  const schoolRows = (rows ?? []) as SchoolRow[];
  const rowByUrn = new Map(schoolRows.map((r) => [r.urn, r]));

  // ILR fallback for census-misses (fe-participation-roll.ts, same two-branch split
  // schools-in-bounds/route.ts's own map fallback already uses): genuine FE-
  // corporation/sixth-form-centre/special-post-16 types go through dfe_fe_participation
  // (falling back to the adult source), academy/free-school-converted 16-19
  // institutions go through dfe_fe_participation_academy. Gated on the ESTABLISHMENT
  // TYPE/GROUP, not sectorTag() -- an academy-converted sixth-form college resolves to
  // sector "State" in this codebase's typology, not "FE", but still needs this same
  // fallback whenever its own census coverage is stale/absent (rolls spec §10 item 7).
  const censusMisses = schoolRows.filter((r) => {
    const facts0 = facts.filter((f) => f.entity_id === r.urn);
    return buildRollSnapshot(facts0, r.urn) === null;
  });
  const ilrCandidates = censusMisses
    .filter((r) => FE_PARTICIPATION_ESTABLISHMENT_TYPES.includes(r.establishment_type ?? ""))
    .map((r) => r.urn);
  const academyCandidates = censusMisses
    .filter((r) => r.establishment_type_group && STATE_ESTABLISHMENT_GROUPS.includes(r.establishment_type_group))
    .map((r) => r.urn);
  const ilrFallbackByUrn = new Map<string, { total: number; period: number; basis: "under_19" | "adult" }>();
  if (ilrCandidates.length > 0) {
    const feFacts = await lookupReferenceData({
      sourceId: "dfe_fe_participation",
      entityIds: ilrCandidates,
      breakdowns: [UNDER_19_TOTAL_BREAKDOWN],
    });
    for (const [urn, t] of under19Totals(feFacts)) ilrFallbackByUrn.set(urn, { ...t, basis: "under_19" });
    const stillMissing = ilrCandidates.filter((u) => !ilrFallbackByUrn.has(u));
    if (stillMissing.length > 0) {
      const adultFacts = await lookupReferenceData({
        sourceId: "dfe_fe_participation_adult",
        entityIds: stillMissing,
        breakdowns: [ADULT_TOTAL_BREAKDOWN],
      });
      for (const [urn, t] of adultTotals(adultFacts)) ilrFallbackByUrn.set(urn, { ...t, basis: "adult" });
    }
  }
  if (academyCandidates.length > 0) {
    const academyFacts = await lookupReferenceData({
      sourceId: "dfe_fe_participation_academy",
      entityIds: academyCandidates,
      breakdowns: [UNDER_19_TOTAL_BREAKDOWN],
    });
    for (const [urn, t] of under19Totals(academyFacts)) ilrFallbackByUrn.set(urn, { ...t, basis: "under_19" });
  }

  const profiles: DataViewSchoolProfile[] = [];
  for (const urn of urns) {
    const row = rowByUrn.get(urn);
    if (!row) continue;

    const schoolFacts = facts.filter((f) => f.entity_id === urn);
    const current = buildRollSnapshot(schoolFacts, urn);
    const trend = buildRollTrend(schoolFacts, urn);
    const anchor2019 = trend.find((t) => t.period === TREND_ANCHOR_PERIOD) ?? null;

    const ageGenderCounts: AgeGenderCounts = current
      ? singleAgeGenderCountsForPeriod(schoolFacts, current.period)
      : new Map();
    const ageGenderCounts2019 = singleAgeGenderCountsForPeriod(schoolFacts, TREND_ANCHOR_PERIOD);

    const phase = effectivePhaseTags(row.statutory_low_age, row.statutory_high_age, row.establishment_type, ageGenderCounts);

    const shapeCurrentResult = classifyShape(shapeClassifierInput(ageGenderCounts));
    const shape2019Result = classifyShape(shapeClassifierInput(ageGenderCounts2019));

    profiles.push({
      urn,
      name: row.current_name,
      town: row.town,
      easting: row.easting,
      northing: row.northing,
      sector: sectorTag(row.establishment_type_group, row.establishment_type),
      boarding: boardingTag(row.boarders_name, current?.boarding ?? null),
      gender: genderTag(row.gender),
      phase,
      establishmentType: row.establishment_type,
      establishmentTypeGroup: row.establishment_type_group,
      statutoryLowAge: row.statutory_low_age,
      statutoryHighAge: row.statutory_high_age,
      current,
      anchor2019,
      trend,
      ageGenderCounts,
      ageGenderCounts2019,
      boardersGenderSplit: current ? boardersGenderSplitFromFacts(schoolFacts, current.period) : null,
      shapeCurrent: shapeCurrentResult?.label ?? null,
      shape2019: shape2019Result?.label ?? null,
      ilrFallbackRoll: current ? null : (ilrFallbackByUrn.get(urn) ?? null),
    });
  }

  return profiles;
}
