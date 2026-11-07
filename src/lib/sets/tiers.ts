// VicData 0.8 sets round 1 (E22, R-FEEDER-TIERS): a feeder set's tiers drive the feeder views. Pure.
//   - Main feeders go to the top of the feeder health table (the rest keep their order).
//   - Main feeders are drawn larger on the feeder map (MAIN_DOT_SCALE).
//   - An alert shows when a Main feeder's roll is falling, by the existing trend rule (the feeder flag
//     "Falling faster than the area", flags.ts feederFlag): nothing new is invented for it.
//   - Untiered counts as Regular; Occasional is kept in view and never alerts.
import { tierOf, type Tier } from "./model";

export const MAIN_DOT_SCALE = 1.5;

export type Tiers = Record<string, Tier>;

export const isMain = (tiers: Tiers | null | undefined, urn: string) => tierOf(tiers?.[urn]) === "main" && !!tiers?.[urn];

/** Main feeders first, the rest in their own order (a stable sort). */
export function mainFirst<T extends { urn: string }>(rows: T[], tiers: Tiers | null | undefined): T[] {
  if (!tiers || !Object.values(tiers).some((t) => t === "main")) return rows;
  return rows.map((r, i) => ({ r, i })).sort((a, b) => Number(isMain(tiers, b.r.urn)) - Number(isMain(tiers, a.r.urn)) || a.i - b.i).map((x) => x.r);
}

/** The Main feeders whose roll is falling (the feeder flag's red flag). */
export function mainFalling<T extends { urn: string; name: string; flag: { id: string } | null }>(rows: T[], tiers: Tiers | null | undefined): T[] {
  return rows.filter((r) => isMain(tiers, r.urn) && r.flag?.id === "feeder_red");
}

/** The alert's words, or null: "Main feeder falling: Alfred Sutton Primary School". */
export function mainFallingWords(rows: { name: string }[]): string | null {
  if (!rows.length) return null;
  return `${rows.length === 1 ? "Main feeder" : `${rows.length} main feeders`} falling: ${rows.map((r) => r.name).join(", ")}`;
}
