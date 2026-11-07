// VicData 0.8 sets round 1 (A5): Admissions' saved lists, read from the one sets model. Pure.
// The old admissions_lists rows (one per school x entry point x kind) are now school sets
// (20261121090000_v08_sets_r1.sql converts them). The views still think in the old list kinds,
// so their figures can't change for the same schools:
//   compared_against                -> 'rivals'
//   feeders, audience day           -> 'day_feeders'
//   feeders, audience boarding      -> 'boarding_feeders'
//   feeders with a rung age         -> 'rung', rung 'age:N' (the 16+ ladder)
// Only the school's own choice for the page (is_default) stands for the old list; other school and
// personal sets are offered by the selector (sets round 1, B).
import type { SavedList } from "../admissions/lists";
import type { StoredSet } from "./model";

export type LegacyListKind = "day_feeders" | "boarding_feeders" | "rivals" | "rung";

export function legacyKindOf(s: Pick<StoredSet, "kind" | "audience" | "rungAge">): LegacyListKind | null {
  if (s.kind === "compared_against") return "rivals";
  if (s.rungAge != null) return "rung";
  if (s.audience === "boarding") return "boarding_feeders";
  if (s.audience === "day") return "day_feeders";
  return null;
}

/** The set a legacy list kind lives in: the school's default set for that entry point and kind. */
export const isListSet = (s: StoredSet, entryPoint: string) => s.ownerScope === "school" && s.isDefault && !s.archived && s.entryPoint === entryPoint && legacyKindOf(s) !== null;

/** The lists the Admissions views read, for one entry point. */
export function savedListsFromSets(sets: StoredSet[], entryPoint: string): SavedList[] {
  return sets
    .filter((s) => isListSet(s, entryPoint))
    .map((s) => ({
      kind: legacyKindOf(s)!,
      rung: s.rungAge != null ? `age:${s.rungAge}` : null,
      members: s.members.map((m) => m.urn),
      la_blend: s.laBlend,
      confirmed: true,
    }));
}

/** The lists API's row, as Setup and the people pages read it (src/components/admissions/api.ts
 * ListRow), from a list set. `updated_by_kind` says whether the last writer was the School-Admin. */
export type LegacyListRow = {
  id: string;
  entry_point: string;
  kind: LegacyListKind;
  rung: string;
  members: string[];
  fuzzy: Record<string, unknown> | null;
  la_blend: Record<string, number> | null;
  confirmed: boolean;
  updated_by: string | null;
  updated_at: string;
  updated_by_kind: "lead" | "school_admin" | null;
};

export function listRowsFromSets(sets: StoredSet[]): LegacyListRow[] {
  return sets
    .filter((s) => s.entryPoint && isListSet(s, s.entryPoint))
    .map((s) => ({
      id: s.id,
      entry_point: s.entryPoint!,
      kind: legacyKindOf(s)!,
      rung: s.rungAge != null ? `age:${s.rungAge}` : "",
      members: s.members.map((m) => m.urn),
      fuzzy: s.rule,
      la_blend: s.laBlend,
      confirmed: true,
      updated_by: s.updatedBy,
      updated_at: s.updatedAt,
      updated_by_kind: s.creatorKind === "school_admin" ? "school_admin" : s.creatorKind === "admissions" ? "lead" : null,
    }));
}

/** What a legacy list write becomes as a set: its kind, audience and rung, and its default name. */
export function setShapeOfList(kind: LegacyListKind, rung: string | null | undefined): { kind: StoredSet["kind"]; audience: StoredSet["audience"]; rungAge: number | null; name: string } {
  if (kind === "rivals") return { kind: "compared_against", audience: null, rungAge: null, name: "Rivals" };
  if (kind === "rung") {
    const age = Number(String(rung ?? "").replace(/^age:/, ""));
    return { kind: "feeders", audience: null, rungAge: age, name: `Feeders for age ${age}` };
  }
  return kind === "day_feeders" ? { kind: "feeders", audience: "day", rungAge: null, name: "Day feeders" } : { kind: "feeders", audience: "boarding", rungAge: null, name: "Boarding feeders" };
}
