// VicData 0.8 sets round 1 (C13-C15, C17; R-SET-EDITOR-TICK): the set editor's list, pure.
//   - A tick means "in the set", nothing else. Unticking greys a school ("unticked, leaves on save");
//     ticking again restores it -- so there is no separate undo, no minus buttons, no bulk bar.
//   - Feeder tiers are a per-row choice (Main / Regular / Occasional, or untiered); the list sorts by
//     tier, and a big feeder set is grouped by tier (or borough, or sector) with Occasional and
//     Untiered collapsed to start with.
//   - Save keeps the ticked schools, in the list's order, with their tiers; unticked ones leave.
//   - A set you can't change (a default set, or a school set you don't curate) opens as a copy that
//     can only be saved as your own.
import { TIER_ORDER, type Tier } from "./model";

export type EditorItem = { urn: string; tier: Tier | null; ticked: boolean };

export const initItems = (members: { urn: string; tier?: Tier | null }[]): EditorItem[] => {
  const seen = new Set<string>();
  return members.filter((m) => !seen.has(m.urn) && (seen.add(m.urn), true)).map((m) => ({ urn: m.urn, tier: m.tier ?? null, ticked: true }));
};

export const toggle = (items: EditorItem[], urn: string): EditorItem[] => items.map((x) => (x.urn === urn ? { ...x, ticked: !x.ticked } : x));

/** Add a school (by name or from the suggestions); one already listed is ticked again. */
export const add = (items: EditorItem[], urn: string, tier: Tier | null = null): EditorItem[] =>
  items.some((x) => x.urn === urn) ? items.map((x) => (x.urn === urn ? { ...x, ticked: true } : x)) : [...items, { urn, tier, ticked: true }];

export const setTier = (items: EditorItem[], urn: string, tier: Tier | null): EditorItem[] => items.map((x) => (x.urn === urn ? { ...x, tier } : x));

/** What Save writes: the ticked schools, in order, with their tiers. */
export const toSave = (items: EditorItem[]): { urn: string; tier: Tier | null }[] => items.filter((x) => x.ticked).map((x) => ({ urn: x.urn, tier: x.tier }));

export const changed = (items: EditorItem[], original: { urn: string; tier?: Tier | null }[]) => JSON.stringify(toSave(items)) !== JSON.stringify(original.map((m) => ({ urn: m.urn, tier: m.tier ?? null })));

/** Tier order for the list: Main, Regular, Occasional, then untiered (a stable sort, so within a tier
 * the list keeps its own order -- distance, or whatever the caller sorted by). */
export const tierRank = (t: Tier | null) => (t === null ? 3 : TIER_ORDER[t]);
export const sortByTier = <T extends { tier: Tier | null }>(items: T[]): T[] => items.map((x, i) => ({ x, i })).sort((a, b) => tierRank(a.x.tier) - tierRank(b.x.tier) || a.i - b.i).map((o) => o.x);

export type GroupBy = "tier" | "borough" | "sector";
export type Group<T> = { key: string; label: string; items: T[]; collapsedAtStart: boolean };
const TIER_LABEL: Record<string, string> = { main: "Main", regular: "Regular", occasional: "Occasional", none: "Untiered" };

/** The groups a big feeder set is shown in, with their counts (the items' length). */
export function groupItems<T extends { urn: string; tier: Tier | null }>(items: T[], by: GroupBy, info: (urn: string) => { laName: string | null; sector: "state" | "independent" } | undefined): Group<T>[] {
  const keyOf = (x: T) => (by === "tier" ? (x.tier ?? "none") : by === "borough" ? (info(x.urn)?.laName ?? "Unknown") : (info(x.urn)?.sector ?? "state"));
  const order = by === "tier" ? ["main", "regular", "occasional", "none"] : null;
  const groups = new Map<string, T[]>();
  for (const x of items) {
    const k = keyOf(x);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(x);
  }
  const keys = order ? order.filter((k) => groups.has(k)) : Array.from(groups.keys()).sort();
  return keys.map((k) => ({ key: k, label: by === "tier" ? TIER_LABEL[k] : by === "sector" ? (k === "independent" ? "Independent" : "State") : k, items: groups.get(k)!, collapsedAtStart: by === "tier" && (k === "occasional" || k === "none") }));
}

/** London's LA codes (DfE): the City (201), inner (202-213) and outer (301-320) boroughs. */
export const isLondonLa = (code: string | null | undefined) => {
  const n = Number(code);
  return Number.isInteger(n) && (n === 201 || (n >= 202 && n <= 213) || (n >= 301 && n <= 320));
};

/** A big feeder set (C15): 25 schools or more, or 20 for a London state school. */
export const isBigFeederSet = (n: number, focus: { sector: "state" | "independent"; laCode: string | null } | null) => n >= 25 || (!!focus && focus.sector === "state" && isLondonLa(focus.laCode) && n >= 20);

/** "28 schools · 6 main · 2 main feeders falling" (C15). */
export function feederSummary(items: EditorItem[], trend: (urn: string) => "falling" | "rising" | null): string {
  const on = items.filter((x) => x.ticked);
  const main = on.filter((x) => x.tier === "main");
  const falling = main.filter((x) => trend(x.urn) === "falling").length;
  return `${on.length} school${on.length === 1 ? "" : "s"} · ${main.length} main${falling ? ` · ${falling} main feeder${falling === 1 ? "" : "s"} falling` : ""}`;
}

/** C17: how the editor saves. `save` changes the set itself; `copy` can only be saved as your own. */
export type SaveMode = "save" | "copy" | "new";
export function saveModeOf(set: { ownerScope: "school" | "personal"; ownerProfileId: string | null } | null, o: { profileId: string | null; canCurate: boolean; isDefault?: boolean }): SaveMode {
  if (!set) return o.isDefault ? "copy" : "new";
  if (set.ownerScope === "personal") return set.ownerProfileId && set.ownerProfileId === o.profileId ? "save" : "copy";
  return o.canCurate ? "save" : "copy";
}
