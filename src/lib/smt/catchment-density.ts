// VicData 0.8 Admissions feedback round 1: a school's density radius read on the server (catchment.ts's
// rule over nearest_schools, the same 400 candidates Admissions' defaults read, one-hour cache).
// Server-only. Returns the school with `densityKm` set, for resolveCatchment and catchmentDefaultKm.
import { cachedReference } from "../server-cache";
import { nearbyCandidates } from "../admissions/rungs";
import { densityKmOf, densityPhase, type CatchmentSchool, type DensityPhase } from "./catchment";

/** The distance to the school's 5th nearest same-phase state school, or null (an independent school
 * isn't asked; a read that fails is null, and the 5 km fallback draws, said). */
export function stateDensityKm(urn: string, low: number | null, high: number | null): Promise<number | null> {
  const phase = densityPhase(low, high);
  if (!phase) return Promise.resolve(null);
  return cachedReference(`catchment:density:${urn}`, async () => densityKmOf(urn, phase, await nearbyCandidates(urn))).catch(() => null);
}

export async function withDensity<T extends CatchmentSchool & { urn?: string; low: number | null }>(urn: string, s: T): Promise<T & { densityKm: number | null; densityPhase: DensityPhase | null }> {
  const phase = densityPhase(s.low, s.high);
  return { ...s, densityKm: s.independent ? null : await stateDensityKm(urn, s.low, s.high), densityPhase: phase };
}
