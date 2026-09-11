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
import { buildIlrParticipationSnapshot, AGE_SEGMENT_BREAKDOWNS, type IlrParticipationSnapshot } from "./ilr-participation-data";
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
// sequential chunking took 71.6s end to end. Originally attributed to "per-chunk
// network round-trip latency to the remote vicdata reference API" -- latency round
// (2026-09-15) found the real mechanism is almost certainly the SAME unscoped-
// pagination cost fetchCensusFactsBatched's own comment above now documents (this
// call site, boardingQuintileList's live path, never passed periodMin/periodMax
// either), not genuine per-request remote latency -- logged here as a correction,
// not silently rewritten (docs/vicdata_data_view_la_comparator_latency_diagnosis_v1.
// md). Concurrency 4 is still a real, working mitigation regardless (fewer chunks'
// own internal page loops running at once) -- left as-is, not re-tuned this round.
const CENSUS_FETCH_CONCURRENCY = 4;

// Latency round (2026-09-15), real root cause found by reconciling a direct
// contradiction (Guy's own standalone timing of the remote RPC came back fast,
// mine -- timing the lookupReferenceData() WRAPPER's total, not one round trip --
// came back at ~10s/chunk): with no periodMin/periodMax given, lookupReferenceData
// asks for EVERY year and EVERY breakdown dfe_school_census has ever recorded for
// each entity, not just what the caller actually reads. For a real 40-school chunk
// that's ~994 rows/school (every year, ~129 breakdowns/school/year) -- comfortably
// past PostgREST's 1000-row page cap, forcing lookupReferenceData's own SEQUENTIAL
// pagination loop (vicdata-reference.ts) through up to 40 real round trips per
// chunk, each individually fast (~150-330ms) but summing to the real ~10s.
// Verified directly: the identical real chunk, scoped to just the current period,
// dropped from 10,073ms/39,748 facts to 498ms/5,160 facts -- a ~20x difference from
// passing parameters lookupReferenceData already accepted, not new plumbing to that
// function itself. Full mechanism in
// docs/vicdata_data_view_la_comparator_latency_diagnosis_v1.md.
//
// periodMin/periodMax are optional and default to undefined (today's unscoped
// behaviour) specifically so fetchDataViewProfiles's own call below -- which
// genuinely needs every period on record, for DataViewSchoolProfile's real
// multi-year trend/ageGenderCountsByPeriod fields -- is completely unaffected.
// Only a caller that provably reads one period (buildLaComparatorSet,
// default-comparator-lists.ts) should ever pass these.
export async function fetchCensusFactsBatched(
  entityIds: string[],
  options?: { periodMin?: number; periodMax?: number },
): Promise<ReferenceFact[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < entityIds.length; i += CENSUS_FETCH_CHUNK) {
    chunks.push(entityIds.slice(i, i + CENSUS_FETCH_CHUNK));
  }
  const all: ReferenceFact[] = [];
  for (let i = 0; i < chunks.length; i += CENSUS_FETCH_CONCURRENCY) {
    const batch = chunks.slice(i, i + CENSUS_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk) =>
        lookupReferenceData({
          sourceId: "dfe_school_census",
          entityIds: chunk,
          periodMin: options?.periodMin,
          periodMax: options?.periodMax,
        }),
      ),
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
  // 2026-09-08, Compared-with panel redesign: the new "Add/subtract schools" window's
  // own "group by LA" option needs a real LA name per candidate -- already a real
  // column on `schools` (used server-side throughout default-comparator-lists.ts to
  // BUILD LA-scoped recipes), just never previously plumbed through to the client
  // profile every candidate already gets fetched (see this file's own
  // fetchDataViewProfiles, which fetches every school in the active set, not just
  // ticked ones -- Map already needed this for its own dots). Reusing that same
  // fetch rather than adding a new one.
  laName: string | null;
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
  // 2026-09-06, UX refinements round 1, A2: the general form of ageGenderCounts2019
  // above -- one real per-age/per-sex breakdown for EVERY period in `trend`, not just
  // the fixed 2019 anchor, so the new selectable start-year date-range control can
  // recompute a filtered "since [any real year]" figure the same honest way the
  // fixed-2019 badges always have. `trend`'s own facts already cover every period
  // (this is a zero-extra-fetch derivation, not a new round-trip) -- ageGenderCounts2019
  // itself is kept as its own field rather than removed, both because it's a cheap,
  // explicit default and because dropping it would mean touching every existing
  // caller's field name for a fixed, still-real-and-used default anchor.
  ageGenderCountsByPeriod: Map<number, AgeGenderCounts>;
  boardersGenderSplit: { female: number; male: number } | null;
  shapeCurrent: ShapeLabel | null;
  shape2019: ShapeLabel | null;
  // FE colleges mostly have zero real DfE census facts at all (rolls topic spec §10:
  // "502 FE-corporation institutions have zero census facts, a real and permanent
  // gap"), so `current`/`trend`/`shapeCurrent` above are honestly null for them --
  // never blended with a different-basis source, same discipline
  // ilr-participation-data.ts already establishes. This is a deliberately separate,
  // last-resort fallback, BOTH real age segments (never just "whichever one is
  // non-zero" -- round 1 UX refinements, B1/A2: a member needs to see and filter
  // between U19 and Adult separately, not one collapsed figure), each with its own
  // real male/female split (so gender filtering composes with it honestly). Still
  // never treated as interchangeable with a census RollSnapshot -- always rendered
  // with an explicit ILR caveat (data-view-filters.ts's FE_PARTICIPATION_CAVEAT) and
  // consumed through its own filteredCount() branch, never blended into
  // ageGenderCounts. Genuinely out of scope this round: FE colleges' own multi-year
  // trend/shape (a separate ILR-based pipeline the public FE college page already has
  // via FeCollegeCards.tsx/fe-participation-roll.ts, not ported into this shared
  // multi-school framework -- logged as a real follow-up in
  // docs/vicdata_data_view_open_questions.md).
  feParticipation: { under19: IlrParticipationSnapshot | null; adult: IlrParticipationSnapshot | null } | null;
};

// profileToFilterableData/profileToFilterableData2019 moved to data-view-serialize.ts
// (2026-09-05 fix): every Data View client component needs these two pure functions,
// but this module imports createServerAnonSupabaseClient (supabase.ts's own docstring:
// "Never import the service-role client below into client components" -- the same
// discipline applies to this anon-but-still-server-only client) -- three client
// components (Dashboard/Rankings/MapView) were importing them as real VALUE imports,
// not `import type`, which pulls this whole server-only module's runtime code into
// the client bundle. Not a functional crash (createServerAnonSupabaseClient only
// touches NEXT_PUBLIC_ env vars, and nothing here runs at module-load time), but a
// real violation of this repo's own established server/client boundary, and needless
// client-bundle weight -- fixed by moving these two functions to the file already
// designed to be safe for both sides (data-view-serialize.ts, which holds
// serializeProfile/deserializeProfile for exactly this reason).

type SchoolRow = {
  urn: string;
  current_name: string;
  town: string | null;
  la_name: string | null;
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
        "urn, current_name, town, la_name, easting, northing, establishment_type_group, establishment_type, boarders_name, statutory_low_age, statutory_high_age, gender",
      )
      .in("urn", urns),
    fetchCensusFactsBatched(urns),
  ]);

  const schoolRows = (rows ?? []) as SchoolRow[];
  const rowByUrn = new Map(schoolRows.map((r) => [r.urn, r]));

  // ILR fallback for census-misses: genuine FE-corporation/sixth-form-centre/
  // special-post-16 types go through dfe_fe_participation (under-19) and
  // dfe_fe_participation_adult (19+); academy/free-school-converted 16-19
  // institutions go through dfe_fe_participation_academy for both segments. Gated on
  // the ESTABLISHMENT TYPE/GROUP, not sectorTag() -- an academy-converted sixth-form
  // college resolves to sector "State" in this codebase's typology, not "FE", but
  // still needs this same fallback whenever its own census coverage is stale/absent
  // (rolls spec §10 item 7).
  //
  // 2026-09-06, UX refinements round 1, B1: the real bug behind "every FE college
  // shows zero" -- this fallback was already being computed (whichever ONE of
  // under-19/adult was found first, total only), but the result was never actually
  // wired into filteredCount() or any consuming view; every view only ever read
  // ageGenderCounts (empty for an FE college) to compute what to show. Fetching BOTH
  // segments in full (not "stop at the first non-zero one") and their real male/
  // female splits, not just totals, so the new U19/Adult filter (A2) and gender
  // filtering can both compose with this the same honest way they do with census
  // data -- see data-view-filters.ts's own new feParticipation branch.
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
  const feParticipationByUrn = new Map<string, { under19: IlrParticipationSnapshot | null; adult: IlrParticipationSnapshot | null }>();
  const allBreakdowns = [...AGE_SEGMENT_BREAKDOWNS.under_19, ...AGE_SEGMENT_BREAKDOWNS["19_plus"]];
  if (ilrCandidates.length > 0) {
    const [feFacts, adultFacts] = await Promise.all([
      lookupReferenceData({ sourceId: "dfe_fe_participation", entityIds: ilrCandidates, breakdowns: allBreakdowns }),
      lookupReferenceData({ sourceId: "dfe_fe_participation_adult", entityIds: ilrCandidates, breakdowns: allBreakdowns }),
    ]);
    for (const urn of ilrCandidates) {
      const under19 = buildIlrParticipationSnapshot(feFacts.filter((f) => f.entity_id === urn), "under_19");
      const adult = buildIlrParticipationSnapshot(adultFacts.filter((f) => f.entity_id === urn), "19_plus");
      if (under19 || adult) feParticipationByUrn.set(urn, { under19, adult });
    }
  }
  if (academyCandidates.length > 0) {
    const academyFacts = await lookupReferenceData({
      sourceId: "dfe_fe_participation_academy",
      entityIds: academyCandidates,
      breakdowns: allBreakdowns,
    });
    for (const urn of academyCandidates) {
      const under19 = buildIlrParticipationSnapshot(academyFacts.filter((f) => f.entity_id === urn), "under_19");
      const adult = buildIlrParticipationSnapshot(academyFacts.filter((f) => f.entity_id === urn), "19_plus");
      if (under19 || adult) feParticipationByUrn.set(urn, { under19, adult });
    }
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
    // A handful of periods per school (real history is short -- 2019 to present) --
    // cheap to compute for every one of them from the SAME already-fetched
    // schoolFacts, no extra round-trip, so the date-range control (A2) can pick any
    // real start year, not just the fixed 2019 default.
    const ageGenderCountsByPeriod = new Map<number, AgeGenderCounts>(
      trend.map((t) => [t.period, singleAgeGenderCountsForPeriod(schoolFacts, t.period)]),
    );

    const phase = effectivePhaseTags(row.statutory_low_age, row.statutory_high_age, row.establishment_type, ageGenderCounts);

    const shapeCurrentResult = classifyShape(shapeClassifierInput(ageGenderCounts));
    const shape2019Result = classifyShape(shapeClassifierInput(ageGenderCounts2019));

    profiles.push({
      urn,
      name: row.current_name,
      town: row.town,
      laName: row.la_name,
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
      ageGenderCountsByPeriod,
      boardersGenderSplit: current ? boardersGenderSplitFromFacts(schoolFacts, current.period) : null,
      shapeCurrent: shapeCurrentResult?.label ?? null,
      shape2019: shape2019Result?.label ?? null,
      feParticipation: current ? null : (feParticipationByUrn.get(urn) ?? null),
    });
  }

  return profiles;
}
