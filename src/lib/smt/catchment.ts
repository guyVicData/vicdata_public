// VicData 0.8 SMT round 4 (R): the school's catchment radius, in kilometres. Pure; the routes, the
// page and the tests all read this. Guy's decisions of 15 Oct 2026 (docs/OPEN_QUESTIONS.md,
// "2026-10-15 -- 0.8 SMT r4"), replacing the prompt's miles:
//
//   - one radius per school, in whole km, saved by its School-Admin (school_catchment, app DB);
//   - the default until one is saved: 5 km for a state school, 15 km for an independent school;
//   - the cap, by the school's type and never by the level, so every view on the board is the same
//     area: 15 km for a state school without a sixth form, 30 km for an independent school or any
//     school with a sixth form;
//   - presets 2, 3, 5, 8, 10, 15, then 20 and 30 where the cap allows; a slider from 2 km to the cap.
//
// The ingest's lookups (area_projection, area_context) take miles, 1 to 25; the app converts.
// R-SMT-RADIUS.
//
// 0.8 Admissions feedback round 1 (Guy, 29 Oct): a state school's default is its DENSITY radius -- the
// smallest whole-km radius holding its DENSITY_SCHOOLS nearest same-phase state schools -- so a school
// in a city and one in the country each get an area with the same number of schools in it. Independent
// schools keep 15 km. Still editable (saved or ?km=), still capped. One rule for SMT Context, the group
// projections and Admissions' funnel and local births, so all of them draw one area. Where the nearest
// schools can't be read, 5 km, said. R-ADM-CATCHMENT-RULE.
export const KM_PER_MILE = 1.609344;
export const CATCHMENT_MIN_KM = 2;
export const CATCHMENT_PRESETS_KM = [2, 3, 5, 8, 10, 15, 20, 30] as const;
export const CATCHMENT_DEFAULT_STATE_KM = 5;
export const CATCHMENT_DEFAULT_INDEPENDENT_KM = 15;
export const CATCHMENT_CAP_STATE_KM = 15;
export const CATCHMENT_CAP_WIDE_KM = 30;
export const DENSITY_SCHOOLS = 5;

/** What the rules read about a school (SmtSchool has all of it). `densityKm`: the distance to its
 * DENSITY_SCHOOLS-th nearest same-phase state school (densityKmOf), where read; unrounded. */
export type CatchmentSchool = { independent: boolean; high: number | null; phases: { post16: boolean }; densityKm?: number | null };

// ------------------------------------------------------------------- the density radius

/** The phase the density rule compares a school with, from its statutory ages: secondary (it teaches
 * 11 and 15, all-through schools included), primary (any of Reception to Year 6, ending by 11), or
 * 16+ (it starts at 16). Null for anything else (a middle school's odd range: the 5 km fallback). */
export type DensityPhase = "primary" | "secondary" | "post16";
export function densityPhase(low: number | null, high: number | null): DensityPhase | null {
  if (low === null || high === null) return null;
  if (low <= 11 && high >= 15) return "secondary";
  if (low >= 16) return "post16";
  if (low <= 10 && high <= 11) return "primary";
  return null;
}

/** A nearby school as nearest_schools gives it. */
export type NearSchool = { urn: string; establishment_type_group: string | null; statutory_low_age: number; statutory_high_age: number; distance_metres: number };
// State schools only: nearest_schools gives academies, free schools, LA-maintained and independent
// schools (no special schools or colleges).
const isStateNear = (c: NearSchool) => c.establishment_type_group !== "Independent schools";

/** The distance (km, unrounded) to the DENSITY_SCHOOLS-th nearest state school of the same phase, the
 * school itself left out; null when fewer are within the candidates. */
export function densityKmOf(urn: string, phase: DensityPhase | null, near: NearSchool[]): number | null {
  if (!phase) return null;
  const same = near.filter((c) => c.urn !== urn && isStateNear(c) && densityPhase(c.statutory_low_age, c.statutory_high_age) === phase).sort((a, b) => a.distance_metres - b.distance_metres);
  const nth = same[DENSITY_SCHOOLS - 1];
  return nth ? nth.distance_metres / 1000 : null;
}

/** How the default was set: by type (independent), by density, or the 5 km fallback. */
export type CatchmentRule = "independent" | "density" | "fallback";
export const catchmentRule = (s: CatchmentSchool): CatchmentRule => (s.independent ? "independent" : s.densityKm !== null && s.densityKm !== undefined && Number.isFinite(s.densityKm) ? "density" : "fallback");

/** A sixth form: the school teaches to 18, or has Post-16 results. */
export const hasSixthForm = (s: CatchmentSchool) => s.phases.post16 || (s.high ?? 0) >= 18;

/** The widest radius the school may use: 30 km for an independent school or any school with a
 * sixth form, 15 km otherwise. */
export const catchmentCapKm = (s: CatchmentSchool) => (s.independent || hasSixthForm(s) ? CATCHMENT_CAP_WIDE_KM : CATCHMENT_CAP_STATE_KM);

/** The radius until the School-Admin saves one: 15 km for an independent school; a state school's
 * density radius (the next whole km, from 2 to its cap); 5 km where that couldn't be read. */
export function catchmentDefaultKm(s: CatchmentSchool): number {
  const rule = catchmentRule(s);
  if (rule === "independent") return CATCHMENT_DEFAULT_INDEPENDENT_KM;
  if (rule === "fallback") return CATCHMENT_DEFAULT_STATE_KM;
  return Math.min(catchmentCapKm(s), Math.max(CATCHMENT_MIN_KM, Math.ceil(s.densityKm! - 1e-9)));
}

/** The presets the school is offered: the fixed list, up to its cap. */
export const catchmentPresets = (s: CatchmentSchool) => CATCHMENT_PRESETS_KM.filter((k) => k <= catchmentCapKm(s));

/** A radius held to whole km between the minimum and the school's cap; anything that isn't a
 * number is null. */
export function clampKm(km: unknown, s: CatchmentSchool): number | null {
  const n = typeof km === "string" ? Number(km) : km;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(catchmentCapKm(s), Math.max(CATCHMENT_MIN_KM, Math.round(n)));
}

export type Catchment = {
  km: number; // what the board draws
  savedKm: number | null; // the school's saved catchment, if any (before the cap)
  defaultKm: number; // the school's default by type
  capKm: number;
  // Where `km` came from: this view's own choice, the school's saved catchment, or the default.
  from: "view" | "saved" | "default";
  // The saved catchment was wider than the cap (a school's type changed since): drawn at the cap.
  capped: boolean;
  // How the default was set (the (i) says so), and the density distance behind it.
  rule?: CatchmentRule;
  densityKm?: number | null;
};

/** The radius a board draws: the view's own (?km=), else the school's saved catchment, else the
 * default; always within the school's cap. */
export function resolveCatchment(s: CatchmentSchool, viewKm: unknown, savedKm: number | null): Catchment {
  const capKm = catchmentCapKm(s);
  const defaultKm = catchmentDefaultKm(s);
  const view = viewKm === null || viewKm === undefined || viewKm === "" ? null : clampKm(viewKm, s);
  // Only where the density was asked for: the round-4 shape otherwise, field for field.
  const how = s.densityKm === undefined ? {} : { rule: catchmentRule(s), densityKm: s.densityKm };
  if (view !== null) return { km: view, savedKm, defaultKm, capKm, from: "view", capped: false, ...how };
  if (savedKm !== null) {
    const km = clampKm(savedKm, s) ?? defaultKm;
    return { km, savedKm, defaultKm, capKm, from: "saved", capped: savedKm > capKm, ...how };
  }
  return { km: defaultKm, savedKm, defaultKm, capKm, from: "default", capped: false, ...how };
}

const PHASE_WORD: Record<DensityPhase, string> = { primary: "state primaries", secondary: "state secondaries", post16: "state sixth-form schools" };

/** One sentence for the (i): how this radius was set. */
export function catchmentHowWords(c: Catchment, phase: DensityPhase | null = null): string {
  if (c.from === "view") return `${c.km} km: chosen for this view (the school's usual is ${c.savedKm ?? c.defaultKm} km).`;
  if (c.from === "saved") return `${c.km} km: the school's saved catchment${c.capped ? `, held at its ${c.capKm} km cap` : ""}.`;
  if (c.rule === "density") return `${c.km} km: the smallest radius holding the school's ${DENSITY_SCHOOLS} nearest ${phase ? PHASE_WORD[phase] : "state schools of its phase"} (the ${DENSITY_SCHOOLS}th is ${(c.densityKm ?? 0).toFixed(1)} km away). The School-Admin can change it.`;
  if (c.rule === "fallback") return `${c.km} km: the default for a state school (its nearest schools couldn't be read). The School-Admin can change it.`;
  return `${c.km} km: the usual radius for an independent school. The School-Admin can change it.`;
}

/** km -> the miles the ingest's lookups take (they accept 1 to 25 miles: 1.61 to 40.2 km). */
export const kmToMiles = (km: number) => km / KM_PER_MILE;
export const milesToKm = (miles: number) => miles * KM_PER_MILE;

/** "5 km" */
export const kmWord = (km: number) => `${km} km`;

// 0.8 audit fixes (9): who reads and who saves the school's catchment. Its members read it with their own
// token (RLS decides); head office reading a member school's SMT reads it too, read-only, through the
// server once smtCaller has checked its access (as Admissions' shared reads do). Only the school's
// School-Admin or account holder saves it; head office never does, though it may change the radius
// for its own view (?km=).
// 0.8 View as: a platform admin's View as (or peek) reads it the same way, through the server, and never
// saves it (read-only).
export type CatchmentCaller = { headOffice: unknown | null; readOnly?: boolean };
export const catchmentRights = (c: CatchmentCaller): { read: "own-token" | "server"; mayTrySave: boolean } =>
  c.headOffice || c.readOnly ? { read: "server", mayTrySave: false } : { read: "own-token", mayTrySave: true };
