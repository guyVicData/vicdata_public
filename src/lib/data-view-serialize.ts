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

export type WireDataViewSchoolProfile = Omit<DataViewSchoolProfile, "ageGenderCounts"> & {
  ageGenderCounts: [number, { male: number; female: number }][];
};

export function serializeProfile(p: DataViewSchoolProfile): WireDataViewSchoolProfile {
  return { ...p, ageGenderCounts: Array.from(p.ageGenderCounts.entries()) };
}

export function deserializeProfile(p: WireDataViewSchoolProfile): DataViewSchoolProfile {
  return { ...p, ageGenderCounts: new Map(p.ageGenderCounts) as AgeGenderCounts };
}
