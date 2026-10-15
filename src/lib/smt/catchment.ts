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
export const KM_PER_MILE = 1.609344;
export const CATCHMENT_MIN_KM = 2;
export const CATCHMENT_PRESETS_KM = [2, 3, 5, 8, 10, 15, 20, 30] as const;
export const CATCHMENT_DEFAULT_STATE_KM = 5;
export const CATCHMENT_DEFAULT_INDEPENDENT_KM = 15;
export const CATCHMENT_CAP_STATE_KM = 15;
export const CATCHMENT_CAP_WIDE_KM = 30;

/** What the rules read about a school (SmtSchool has all of it). */
export type CatchmentSchool = { independent: boolean; high: number | null; phases: { post16: boolean } };

/** A sixth form: the school teaches to 18, or has Post-16 results. */
export const hasSixthForm = (s: CatchmentSchool) => s.phases.post16 || (s.high ?? 0) >= 18;

/** The widest radius the school may use: 30 km for an independent school or any school with a
 * sixth form, 15 km otherwise. */
export const catchmentCapKm = (s: CatchmentSchool) => (s.independent || hasSixthForm(s) ? CATCHMENT_CAP_WIDE_KM : CATCHMENT_CAP_STATE_KM);

/** The radius until the School-Admin saves one: 15 km for an independent school, 5 km otherwise. */
export const catchmentDefaultKm = (s: CatchmentSchool) => (s.independent ? CATCHMENT_DEFAULT_INDEPENDENT_KM : CATCHMENT_DEFAULT_STATE_KM);

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
};

/** The radius a board draws: the view's own (?km=), else the school's saved catchment, else the
 * default; always within the school's cap. */
export function resolveCatchment(s: CatchmentSchool, viewKm: unknown, savedKm: number | null): Catchment {
  const capKm = catchmentCapKm(s);
  const defaultKm = catchmentDefaultKm(s);
  const view = viewKm === null || viewKm === undefined || viewKm === "" ? null : clampKm(viewKm, s);
  if (view !== null) return { km: view, savedKm, defaultKm, capKm, from: "view", capped: false };
  if (savedKm !== null) {
    const km = clampKm(savedKm, s) ?? defaultKm;
    return { km, savedKm, defaultKm, capKm, from: "saved", capped: savedKm > capKm };
  }
  return { km: defaultKm, savedKm, defaultKm, capKm, from: "default", capped: false };
}

/** km -> the miles the ingest's lookups take (they accept 1 to 25 miles: 1.61 to 40.2 km). */
export const kmToMiles = (km: number) => km / KM_PER_MILE;
export const milesToKm = (miles: number) => miles * KM_PER_MILE;

/** "5 km" */
export const kmWord = (km: number) => `${km} km`;
