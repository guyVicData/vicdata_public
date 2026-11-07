// VicData 0.8 sets round 1 (D18, G28): the library's list -- which sets show for the sidebar's section
// (or the phone's tab), the search (a set's name, or a school in it), the kind switch and the entry
// point, and the sort (recently used, A-Z, size). Pure.
import type { CreatorKind, SetBlock, SetKind } from "./model";

export type LibraryItem = {
  key: string; // "set:<id>" or "default:<recipe>@<entry>"
  id: string | null;
  name: string;
  description: string | null;
  kind: SetKind;
  entry: string | null;
  phase: "ks4" | "ks5" | null;
  block: SetBlock;
  creator: CreatorKind;
  count: number;
  urns: string[];
  pinned: boolean;
  archived: boolean;
  lastUsedAt: string | null;
  folder: string | null;
  schoolNames: string[];
  /** May this person change it (Edit opens it, not a copy)? */
  canChange: boolean;
};

export type LibrarySection = "all" | "default" | "school" | "mine" | "archived" | `folder:${string}`;
export type LibrarySort = "recent" | "az" | "size";
export type LibraryFilter = { section: LibrarySection; query: string; kind: SetKind | "all"; entry: string | null };

export function filterLibrary(items: LibraryItem[], f: LibraryFilter): LibraryItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((x) => {
    if (f.section === "archived") {
      if (!x.archived) return false;
    } else {
      if (x.archived) return false;
      if (f.section === "default" && x.block !== "default") return false;
      if (f.section === "school" && x.block !== "school") return false;
      if (f.section === "mine" && x.block !== "mine") return false;
      if (f.section.startsWith("folder:") && x.folder !== f.section.slice(7)) return false;
    }
    if (f.kind !== "all" && x.kind !== f.kind) return false;
    if (f.entry && x.entry !== f.entry) return false;
    if (q && !x.name.toLowerCase().includes(q) && !x.schoolNames.some((n) => n.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function sortLibrary(items: LibraryItem[], sort: LibrarySort): LibraryItem[] {
  const by = [...items];
  if (sort === "az") return by.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "size") return by.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return by.sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.name.localeCompare(b.name));
}

/** The sidebar's counts: All (active), Default, School sets, My sets ("n of 8"), Archived. */
export function sectionCounts(items: LibraryItem[]) {
  const active = items.filter((x) => !x.archived);
  return { all: active.length, default: active.filter((x) => x.block === "default").length, school: active.filter((x) => x.block === "school").length, mine: active.filter((x) => x.block === "mine").length, archived: items.filter((x) => x.archived).length };
}

export const foldersOf = (items: LibraryItem[]) => Array.from(new Set(items.map((x) => x.folder).filter((f): f is string => !!f))).sort();

/** "2 days ago", "today", "never". */
export function usedWords(at: string | null, now = new Date()): string {
  if (!at) return "never";
  const days = Math.floor((now.getTime() - new Date(at).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
