// VicData 0.7 admissions (A4): the national flag thresholds (Guy, 7 Oct: set nationally for now,
// tuned later). Computed in the ingest repo (admissions_flag_thresholds, the constants in
// ingest/admissions_constants.py) and read through its anon lookup. Until that migration is
// applied the lookup is absent and every flag reads "thresholds not loaded" -- no flag is ever
// guessed. Server-only; public data, cached an hour.
import { callReferenceRpc } from "../vicdata-reference";
import { cachedReference } from "../server-cache";

export type FlagPhase = "primary" | "secondary" | "post16";
export type FlagMeasure = "entry_cohort" | "roll" | "headline" | "subject_area";
export type Threshold = { phase: FlagPhase; measure: FlagMeasure; changeKind: "percent" | "difference"; low: number; high: number; lowPct: number; highPct: number; minCohort: number; nSchools: number; from: number; to: number };
export type Thresholds = { rows: Threshold[]; get: (phase: FlagPhase, measure: FlagMeasure) => Threshold | null } | null;

type Row = { phase: string; measure: string; change_kind: string; p_low: number; p_high: number; low_pct: number; high_pct: number; min_cohort: number; n_schools: number; period_from: number; period_to: number };

export function loadThresholds(): Promise<Thresholds> {
  return cachedReference("adm:flag-thresholds", async () => {
    let rows: Row[];
    try {
      rows = (await callReferenceRpc("admissions_flag_thresholds_lookup", {})) as Row[];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/HTTP 404\b/.test(msg) || msg.includes("PGRST202")) return null;
      throw e;
    }
    const list: Threshold[] = rows.map((r) => ({ phase: r.phase as FlagPhase, measure: r.measure as FlagMeasure, changeKind: r.change_kind === "difference" ? "difference" : "percent", low: Number(r.p_low), high: Number(r.p_high), lowPct: r.low_pct, highPct: r.high_pct, minCohort: r.min_cohort, nSchools: r.n_schools, from: r.period_from, to: r.period_to }));
    return list.length ? { rows: list, get: (phase, measure) => list.find((t) => t.phase === phase && t.measure === measure) ?? null } : null;
  });
}

/** Thresholds from rows (the lookup's, or a dry run's file). */
export function thresholdsFrom(list: Threshold[]): Thresholds {
  return list.length ? { rows: list, get: (phase, measure) => list.find((t) => t.phase === phase && t.measure === measure) ?? null } : null;
}

export const phaseForEntryAge = (age: number): FlagPhase => (age <= 10 ? "primary" : age <= 15 ? "secondary" : "post16");
