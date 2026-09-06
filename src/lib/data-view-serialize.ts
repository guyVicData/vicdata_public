// Member Data View: wire-format (de)serialisation for DataViewSchoolProfile, kept in
// its own file with NO server-only imports (data-view-profiles.ts pulls in
// createServerAnonSupabaseClient, which must never reach a "use client" bundle) so
// this one small conversion can be safely shared by both the API route (server) and
// the Data View's own client components.
//
// The fields that need real conversion are ageGenderCounts AND ageGenderCounts2019
// (AgeGenderCounts is a Map, and Map doesn't survive JSON.stringify/NextResponse.json
// at all -- it serialises to "{}", silently, with no error) -- everything else on
// DataViewSchoolProfile is already plain JSON-safe (RollSnapshot, arrays, primitives).
//
// 2026-09-05, real live bug found and fixed: ageGenderCounts2019 was added to
// DataViewSchoolProfile (for filtered "since 2019" trend badges) AFTER this file was
// first written, and never wired into either function below -- it silently round-
// tripped as "{}" on every real profile. Confirmed live: `for (const [age,c] of
// counts)` in data-view-filters.ts's sumAgeGender() throws "counts is not iterable"
// the moment ANY view calls profileToFilterableData2019 on a school with real 2019
// data (i.e. almost every real school) -- MapView.tsx's marker-drawing effect hits
// this immediately since Map is the default landing view, throwing partway through
// building markers and leaving the map stuck. TypeScript couldn't catch this: both
// functions were fully type-correct, the bug was purely "this Map serialises to an
// empty object and nothing here re-converts it back" -- a runtime-shape bug, not a
// type error. No test suite exists in this repo to have caught it either (see
// docs/vicdata_data_view_open_questions.md's own note on that gap) -- reproduced
// directly against a real API response this time, not just inferred.
import type { AgeGenderCounts } from "./roll-data";
import type { DataViewSchoolProfile } from "./data-view-profiles";
import type { FilterableSchoolData } from "./data-view-filters";

type WireAgeGenderCounts = [number, { male: number; female: number }][];
// 2026-09-06, UX refinements round 1, A2: ageGenderCountsByPeriod is a Map OF Maps --
// same non-JSON-safe problem one level deeper. Wire form is [period, WireAgeGenderCounts][].
type WireAgeGenderCountsByPeriod = [number, WireAgeGenderCounts][];

export type WireDataViewSchoolProfile = Omit<DataViewSchoolProfile, "ageGenderCounts" | "ageGenderCounts2019" | "ageGenderCountsByPeriod"> & {
  ageGenderCounts: WireAgeGenderCounts;
  ageGenderCounts2019: WireAgeGenderCounts;
  ageGenderCountsByPeriod: WireAgeGenderCountsByPeriod;
};

export function serializeProfile(p: DataViewSchoolProfile): WireDataViewSchoolProfile {
  return {
    ...p,
    ageGenderCounts: Array.from(p.ageGenderCounts.entries()),
    ageGenderCounts2019: Array.from(p.ageGenderCounts2019.entries()),
    ageGenderCountsByPeriod: Array.from(p.ageGenderCountsByPeriod.entries()).map(([period, counts]) => [period, Array.from(counts.entries())]),
  };
}

export function deserializeProfile(p: WireDataViewSchoolProfile): DataViewSchoolProfile {
  return {
    ...p,
    ageGenderCounts: new Map(p.ageGenderCounts) as AgeGenderCounts,
    ageGenderCounts2019: new Map(p.ageGenderCounts2019) as AgeGenderCounts,
    ageGenderCountsByPeriod: new Map(p.ageGenderCountsByPeriod.map(([period, counts]) => [period, new Map(counts) as AgeGenderCounts])),
  };
}

// 2026-09-05 fix: moved here from data-view-profiles.ts (a server-only module --
// imports createServerAnonSupabaseClient) so client components can import these two
// pure functions as real values without pulling server-only runtime code into the
// client bundle. See data-view-profiles.ts's own comment at the old location.
export function profileToFilterableData(p: DataViewSchoolProfile): FilterableSchoolData {
  return {
    statutoryLowAge: p.statutoryLowAge,
    statutoryHighAge: p.statutoryHighAge,
    ageGenderCounts: p.ageGenderCounts,
    boarding: p.current?.boarding ?? null,
    boardersGenderSplit: p.boardersGenderSplit,
    feParticipation: p.feParticipation,
  };
}

// Same slice, at the 2019 trend anchor -- see ageGenderCounts2019's own comment
// (data-view-profiles.ts) for why a filtered trend badge needs this rather than
// comparing a filtered current value against an unfiltered historical one. Boarding
// gender split at 2019 isn't separately tracked (a real, minor simplification,
// logged in docs/vicdata_data_view_open_questions.md) -- a boarding+gender filter
// combination at the 2019 anchor specifically falls back to the whole-boarding-
// population figure rather than a gendered slice, still correct for every other
// filter combination.
export function profileToFilterableData2019(p: DataViewSchoolProfile): FilterableSchoolData {
  return {
    statutoryLowAge: p.statutoryLowAge,
    statutoryHighAge: p.statutoryHighAge,
    ageGenderCounts: p.ageGenderCounts2019,
    boarding: p.anchor2019?.boarding ?? null,
    boardersGenderSplit: null,
    // No historical FE-participation trend is fetched this round (single latest-
    // period snapshot only, data-view-profiles.ts's own comment) -- honestly null
    // rather than reusing the current snapshot as a fake "2019 figure," which would
    // silently show a 0% trend badge for every FE college instead of "no comparison
    // available."
    feParticipation: null,
  };
}

// TREND_ANCHOR_PERIOD (data-view-profiles.ts) duplicated as a literal here rather
// than imported -- same reasoning as data-view-filters.ts's own DEFAULT_START_PERIOD:
// that module is server-only, and this one deliberately has no server-only imports.
const TREND_ANCHOR_PERIOD_FALLBACK = 2019;

// 2026-09-06, UX refinements round 1, A2: the general form of the function above --
// same slice, at WHICHEVER real period the date-range control's selectable start
// year currently points at, not just the fixed 2019 anchor. Falls back to
// ageGenderCounts2019 (the historical, still-real default) when the requested
// period has no entry in ageGenderCountsByPeriod at all (a school with no real data
// that far back, or the still-common default-period case) -- same map, so this is
// never a behavioural change for the existing 2019-anchor call sites, only additive.
export function profileToFilterableDataForPeriod(p: DataViewSchoolProfile, period: number): FilterableSchoolData {
  const counts = p.ageGenderCountsByPeriod.get(period) ?? (period === TREND_ANCHOR_PERIOD_FALLBACK ? p.ageGenderCounts2019 : new Map());
  const snapshot = p.trend.find((t) => t.period === period) ?? null;
  return {
    statutoryLowAge: p.statutoryLowAge,
    statutoryHighAge: p.statutoryHighAge,
    ageGenderCounts: counts,
    boarding: snapshot?.boarding ?? null,
    boardersGenderSplit: null,
    feParticipation: null,
  };
}
