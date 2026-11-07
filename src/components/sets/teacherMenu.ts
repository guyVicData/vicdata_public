// VicData 0.8 sets round 1 (B7, B9): Teacher's and SMT's set menu rows, from the chooser's payload
// (/api/teacher/saved-comparator-sets). One adapter, so both draw the same three blocks:
//   Default     the 10 nearest (the page's own default; Post-16's has Post-16 provision); the other
//               default sets (schools in the LA, the regional and national rankings) open the
//               chooser, which builds them (extraDefault)
//   School sets the school's own sets (SMT, Admissions -- 11+ on GCSE pages, 16+ on Post-16 -- the
//               School-Admin), the school's group under its own name, Victoria Consultancy, and the
//               school's saved rankings
//   My sets     the person's own sets and saved rankings, "n of 8"
// Keys: "nearest", "saved:<id>" (savedSetKey), "ranking:<id>".
import type { SavedComparatorSet, SavedRanking, SavedSetsPayload } from "@/lib/teacher-view-saved-sets";
import type { CreatorKind } from "@/lib/sets/model";
import type { SetMenuRow } from "./SetSelector";

export const NEAREST_KEY = "nearest";
export const rankingKey = (id: string) => `ranking:${id}`;

const creatorOfSet = (s: SavedComparatorSet): CreatorKind => (s.vc ? "victoria_consultancy" : s.group ? "group" : s.mine ? "me" : (s.creator ?? "school_admin"));

export function teacherMenuRows(payload: SavedSetsPayload | null, o: { nearestLabel: string; nearestCount: number | null; rankings?: SavedRanking[] }): { rows: { default: SetMenuRow[]; school: SetMenuRow[]; mine: SetMenuRow[] }; mine: { active: number; cap: number } | null } {
  const sets = payload?.sets ?? [];
  const rankings = o.rankings ?? payload?.rankings ?? [];
  const row = (s: SavedComparatorSet): SetMenuRow => ({ key: `saved:${s.id}`, name: s.name, count: s.members.length, creator: creatorOfSet(s), creatorLabel: s.group ? (s.creatorLabel ?? s.group.sourceLabel) : undefined, pinned: s.vc || !!s.group ? false : s.shared });
  const rrow = (r: SavedRanking): SetMenuRow => ({ key: rankingKey(r.id), name: r.name, count: null, creator: r.mine ? "me" : "school_admin", title: `${r.name}: a ranking` });
  return {
    rows: {
      default: [{ key: NEAREST_KEY, name: o.nearestLabel, count: o.nearestCount, creator: "default" }],
      school: [...sets.filter((s) => !s.mine).map(row), ...rankings.filter((r) => r.shared && !r.mine).map(rrow)],
      mine: [...sets.filter((s) => s.mine).map(row), ...rankings.filter((r) => r.mine).map(rrow)],
    },
    mine: payload ? { active: payload.personalCount, cap: payload.cap } : null,
  };
}

/** The set editor's address from Teacher or SMT (C17, D20): a saved set opens as itself (a copy where
 * this person can't change it); anything else -- the 10 nearest, a linked or chooser set -- as a copy of
 * its schools; New set… empty. Save comes back with useSet=<id>. Null where the editor doesn't apply
 * (a KS2 page: sets there are whole-school and built in the chooser). */
export function teacherEditorHref(o: { urn: string; phase: string | null; product: "smt" | "teacher"; current: { savedId: string | null; name: string; urns: string[] } | null; fresh: boolean }): string | null {
  if (o.phase !== "ks4" && o.phase !== "ks5") return null;
  const back = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  const q = new URLSearchParams({ urn: o.urn, kind: "compared_against", phase: o.phase, product: o.product, back });
  if (!o.fresh && o.current) {
    if (o.current.savedId) q.set("set", o.current.savedId);
    else {
      q.set("from", "teacher:current");
      q.set("name", o.current.name);
      if (o.current.urns.length) q.set("urns", o.current.urns.join(","));
    }
  }
  return `/sets/edit?${q.toString()}`;
}

/** Back from the editor's Save: the id it saved (and the address without it), or null. */
export function takeUseSet(): string | null {
  if (typeof window === "undefined") return null;
  const u = new URL(window.location.href);
  const id = u.searchParams.get("useSet");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  u.searchParams.delete("useSet");
  window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  return id;
}
