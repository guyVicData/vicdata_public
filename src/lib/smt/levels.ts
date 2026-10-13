// VicData 0.8 SMT round 1 (spec §2.2): the level chips. Pure; the page, the routes and the tests
// all read this.
//
// Row 1: Whole school (the default) · Primary · GCSE · Post-16, only the phases the school has.
// Row 2, under GCSE or Post-16 only: "All areas" (the default) then the subject areas the school
// enters at that phase. Held in the URL (?level=gcse&area=sciences_maths) and remembered per user.
export type SmtPhase = "whole" | "primary" | "gcse" | "post16";
export type SmtLevel = { phase: SmtPhase; area: string | null };

export const LEVEL_LABEL: Record<SmtPhase, string> = { whole: "Whole school", primary: "Primary", gcse: "GCSE", post16: "Post-16" };
export const ALL_AREAS_LABEL = "All areas";

// The key stage a phase's results are (whole school has two or more).
export const STAGE_OF: Record<Exclude<SmtPhase, "whole">, "ks2" | "ks4" | "ks5"> = { primary: "ks2", gcse: "ks4", post16: "ks5" };

// `igcse`: the school sits IGCSEs (R-IGCSE-EXCL): its GCSE chip is shown, marked, never ranked.
export type SchoolPhases = { primary: boolean; gcse: boolean; post16: boolean; igcse?: boolean };

/** The row-1 chips a school sees, in order: Whole school, then only the phases it has. */
export function levelChips(p: SchoolPhases): SmtPhase[] {
  return ["whole", ...(["primary", "gcse", "post16"] as const).filter((k) => p[k])];
}

const PHASES = new Set<SmtPhase>(["whole", "primary", "gcse", "post16"]);
const AREA = /^[a-z_]{2,60}$/;

/** The level in an address, checked against the school's chips and areas: anything it can't
 * show falls back to Whole school (a phase it lacks) or All areas (an area it doesn't enter). */
export function parseLevel(search: URLSearchParams, phases: SchoolPhases | null, areas: Partial<Record<"gcse" | "post16", string[]>> | null): SmtLevel {
  const raw = search.get("level") as SmtPhase | null;
  let phase: SmtPhase = raw && PHASES.has(raw) ? raw : "whole";
  if (phases && phase !== "whole" && !phases[phase]) phase = "whole";
  const a = search.get("area");
  const area = (phase === "gcse" || phase === "post16") && a && AREA.test(a) && (!areas || (areas[phase] ?? []).includes(a)) ? a : null;
  return { phase, area };
}

/** The address's query for a level (the default writes nothing). */
export function levelQuery(l: SmtLevel): Record<string, string> {
  const q: Record<string, string> = {};
  if (l.phase !== "whole") q.level = l.phase;
  if (l.area && (l.phase === "gcse" || l.phase === "post16")) q.area = l.area;
  return q;
}

/** "GCSE · Sciences & Maths", "Whole school". */
export function levelLabel(l: SmtLevel, areaLabel?: string | null): string {
  return l.area && areaLabel ? `${LEVEL_LABEL[l.phase]} · ${areaLabel}` : LEVEL_LABEL[l.phase];
}

// The comparison set's phase. Teacher's chooser and saved sets are per phase; SMT has ONE set for
// the whole dashboard (spec §2.4), so it is chosen in the school's main exam phase -- GCSE where it
// has a ranked one (an IGCSE school's is Post-16), then Post-16, then KS2 -- and kept whatever the level. A level then ranks only the set's
// schools with results at that level, and says how many ("7th of 10 with GCSE results").
export function setPhaseOf(p: SchoolPhases): "ks2" | "ks4" | "ks5" {
  return p.gcse && !(p.igcse && p.post16) ? "ks4" : p.post16 ? "ks5" : p.gcse ? "ks4" : "ks2";
}

// The minimum entries for a subject to be ranked (academic.ts MIN_SUBJECT_ENTRIES), for the page's words.
export const MIN_SUBJECT_ENTRIES_UI = 5;

// R-SMT-BOARDING-ONLY (spec §2.2): the filter pills a school gets -- Gender for a mixed school only,
// Day + boarding for a boarding school only (isBoardingSchool, 0.7 r3 F2). Phase is a chip, never a pill.
export function pillsFor(s: { mixed: boolean; boarding: boolean }): ("gender" | "boarding")[] {
  return [...(s.mixed ? (["gender"] as const) : []), ...(s.boarding ? (["boarding"] as const) : [])];
}

// Context's "around the school" radius, for the page's words (context.ts AROUND_MILES).
export const AROUND_MILES_UI = 5;
