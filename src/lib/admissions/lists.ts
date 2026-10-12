// VicData 0.7 admissions (A5): the school's saved lists turned into what the maths reads. Pure.
//   rung 'age:N' (16+)            the set for rung age N
//   day_feeders + boarding_feeders the primary rungs (and, at 16+, the secondary rungs when no rung
//                                  list is saved): both together make the pool
//   rivals                         Market share's and the rivals' set
// A list with no members contributes nothing (the nearby default stands for that rung).
import { holderOf, type EntryPoint } from "./entry-points";
import type { RungSets } from "./rungs";

export type SavedList = { kind: string; rung: string | null; members: string[] | null; la_blend: Record<string, number> | null; confirmed: boolean };

export function rungSetsFromLists(ep: EntryPoint, lists: SavedList[], defaults: RungSets): RungSets {
  const out: RungSets = new Map(defaults);
  const feeders = Array.from(new Set(lists.filter((l) => l.kind === "day_feeders" || l.kind === "boarding_feeders").flatMap((l) => l.members ?? [])));
  for (const age of out.keys()) {
    const rung = lists.find((l) => l.kind === "rung" && l.rung === `age:${age}` && (l.members?.length ?? 0) > 0);
    if (rung) out.set(age, rung.members!);
    else if (feeders.length && (holderOf(age) !== "secondary" || ep.age >= 16)) out.set(age, feeders);
  }
  return out;
}

export const rivalsFromLists = (lists: SavedList[]): string[] | undefined => {
  const r = lists.find((l) => l.kind === "rivals" && (l.members?.length ?? 0) > 0);
  return r ? r.members! : undefined;
};

export const blendFromLists = (lists: SavedList[]): Record<string, number> | null => lists.find((l) => l.la_blend && Object.keys(l.la_blend).length)?.la_blend ?? null;
