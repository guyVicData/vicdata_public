// Member Data View: wire-format (de)serialisation for DataViewSchoolProfile, kept in
// its own file with NO server-only imports (data-view-profiles.ts pulls in
// createServerAnonSupabaseClient, which must never reach a "use client" bundle) so
// this one small conversion can be safely shared by both the API route (server) and
// the Data View's own client components.
//
// The only field that needs real conversion is ageGenderCounts (AgeGenderCounts is a
// Map, and Map doesn't survive JSON.stringify/NextResponse.json at all -- it
// serialises to "{}") -- everything else on DataViewSchoolProfile is already plain
// JSON-safe (RollSnapshot, arrays, primitives).

import type { AgeGenderCounts } from "./roll-data";
import type { DataViewSchoolProfile } from "./data-view-profiles";
import type { FilterableSchoolData } from "./data-view-filters";

export type WireDataViewSchoolProfile = Omit<DataViewSchoolProfile, "ageGenderCounts"> & {
  ageGenderCounts: [number, { male: number; female: number }][];
};

export function serializeProfile(p: DataViewSchoolProfile): WireDataViewSchoolProfile {
  return { ...p, ageGenderCounts: Array.from(p.ageGenderCounts.entries()) };
}

export function deserializeProfile(p: WireDataViewSchoolProfile): DataViewSchoolProfile {
  return { ...p, ageGenderCounts: new Map(p.ageGenderCounts) as AgeGenderCounts };
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
  };
}
