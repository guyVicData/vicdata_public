// VicData 0.8 group sets, M4 and M5 (brief v2 §5, §6; Guy's D2, D3, D4, D6, D8): comparison sets of
// groups and subsets of a group's own schools, chosen in the one set picker. Pure and client-safe: the
// address keys and how old links map to them, the Default block (computed, never stored), the page's
// default, "nearest in size", and the set's median and middle-half band. The figures are production's
// (group_comparison_lookup, each group's own); this module only picks and orders them.
//
// Address keys (?compare=):
//   peer:<type>:<band> | peer:<type>:all   our size band, pooled (production's set id; "All foundation
//                                          trusts" for a type with no bands, D4)
//   non_group:state | non_group:independent  non-group schools of our sector (M1's definition)
//   sat:all                                 the single-academy trusts, pooled (state groups only)
//   areas:la                                every school in our LAs, weighted to our spread
//   england:all                             England, our sector's (E1, E2)
//   nearest                                 the 5 groups of our type nearest in size, side by side
//   set:<uuid>                              a stored set of groups (the group's, or one of My sets)
//   peer_named:a,b,…                        an unsaved set of these groups (old links, up to 8)
// Old keys (peer_band, non_group, areas, england, mix_matched) map onto these (normaliseCompare).
// ?showing= (M5): all (the default) or set:<uuid>, a subset of our own schools.
// Rules: R-GROUP-SET-PICKER, R-GROUP-SET-DEFAULT, R-GROUP-SET-SIDE-BY-SIDE, R-GROUP-SET-TRENDS, R-GROUP-SUBSET-FILTER.
import type { IndexCard } from "./library";
import type { CompareKey, GroupSetInput } from "./dash";

/** The most groups a set holds (one setting; the database's trigger is the backstop). */
export const GROUP_SET_CAP = 8;
export const CAP_WORDS = `${GROUP_SET_CAP} is the most a set holds`;
/** "Nearest in size, same type": how many groups. */
export const NEAREST_IN_SIZE = 5;
/** The middle-half band needs at least this many groups (D3); fewer, and the (i) says why. */
export const BAND_MIN_GROUPS = 4;

export type GroupSetKind = "group_peers" | "group_schools";
export const GROUP_SET_KINDS: readonly GroupSetKind[] = ["group_peers", "group_schools"];
export type Sector = "state" | "independent";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | null | undefined): s is string => !!s && UUID.test(s);
const GROUP_ID = /^[\w:.-]{1,80}$/;

/** A stored set as the group pages read it (sets + set_group_members / set_members). */
export type GroupSetRow = {
  id: string;
  name: string;
  description: string | null;
  kind: GroupSetKind;
  scope: "group" | "personal";
  isDefault: boolean;
  pinned: boolean;
  archived: boolean;
  ownerProfileId: string | null;
  /** Group ids (group_peers) or school URNs (group_schools), in order. */
  members: string[];
  updatedAt: string;
};

/** How the editor may save (the school editor's C17 rule, for a head office): your own personal set, or
 * a group set if you're one of its admins, saves in place; anything else -- a group set you can't curate,
 * a copy (nearest in size, an unsaved set, Duplicate) -- saves as a new set. */
export type GroupSaveMode = "save" | "copy" | "new";
export function groupSaveMode(set: Pick<GroupSetRow, "scope" | "ownerProfileId"> | null, o: { userId: string; admin: boolean; copy: boolean }): GroupSaveMode {
  if (!set) return o.copy ? "copy" : "new";
  if (set.scope === "personal") return set.ownerProfileId === o.userId ? "save" : "copy";
  return o.admin ? "save" : "copy";
}

// ------------------------------------------------------------------------------- address keys

/** The address's ?compare= as a key of today (old links mapped), or null for the page's default. */
export function normaliseCompare(raw: string | null | undefined, ctx: { bandKey: string | null; sector: Sector; nm?: boolean }): string | null {
  if (!raw) return null;
  // 0.8 non-mainstream groups: its kinds' pools and the same kinds in its regions; the mainstream pools
  // (non-group, single-academy trusts, its areas, England) are its mainstream line's only, so they open on
  // the peer set. A mainstream group never takes a pool key.
  if (ctx.nm) {
    if (/^pools:(england|region|la):[\w:]{1,40}$/.test(raw) || raw === "kind_areas:region") return raw;
    if (raw === "nearest" || raw.startsWith("set:") || raw.startsWith("peer_named:")) {
      /* below */
    } else return ctx.bandKey ?? null;
  } else if (raw.startsWith("pools:") || raw === "kind_areas:region") return null;
  const band = ctx.bandKey ?? `non_group:${ctx.sector}`;
  const ng = `non_group:${ctx.sector}`;
  switch (raw) {
    case "peer_band":
      return band;
    case "non_group":
    case "mix_matched": // Mix-matched stays a row in Against others; its old link opens on non-group.
    case "non_group:state":
    case "non_group:independent":
      return ng;
    case "areas":
    case "areas:la":
      return "areas:la";
    case "england":
    case "england:all":
      return "england:all";
    case "sat:all":
      return ctx.sector === "state" ? "sat:all" : ng;
    case "nearest":
      return "nearest";
  }
  if (raw.startsWith("peer:")) return band;
  if (raw.startsWith("set:")) return isUuid(raw.slice(4)) ? raw : null;
  if (raw.startsWith("peer_named:")) {
    const ids = namedList(raw.slice(11));
    return ids.length ? `peer_named:${ids.join(",")}` : null;
  }
  return null;
}

/** "a,b,c" as distinct, well-formed group ids, at most GROUP_SET_CAP. */
export function namedList(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => GROUP_ID.test(s) && !seen.has(s) && (seen.add(s), true))
    .slice(0, GROUP_SET_CAP);
}

/** The lookup kind a pooled key reads (dash.ts CompareKey), or null for a set of groups. */
export function pooledKind(key: string): "peer_band" | "non_group" | "sat" | "areas" | "england" | null {
  if (key.startsWith("peer:")) return "peer_band";
  if (key.startsWith("non_group:")) return "non_group";
  if (key === "sat:all") return "sat";
  if (key === "areas:la") return "areas";
  if (key === "england:all") return "england";
  return null;
}

/** The page's default (D8): the group's default set, while it exists; else our size band. */
export function pageDefault(groupDefault: { id: string } | null | undefined, bandKey: string | null, sector: Sector): string {
  if (groupDefault && isUuid(groupDefault.id)) return `set:${groupDefault.id}`;
  return bandKey ?? `non_group:${sector}`;
}

/** The group's one default set of a kind (not archived), if an admin made one. */
export function groupDefaultOf(sets: GroupSetRow[], kind: GroupSetKind): GroupSetRow | null {
  return sets.find((s) => s.scope === "group" && s.kind === kind && s.isDefault && !s.archived) ?? null;
}

/** The address's key resolved for the page (the dash route): a pooled default's lookup kind, or a set of
 * groups (nearest in size, a stored set this viewer may use, an unsaved one). A key that can't be used --
 * a set that has gone, nothing nearest -- falls back to the size band (D8), never to an error. */
export function resolveCompare(raw: string | null | undefined, ctx: {
  bandKey: string | null;
  sector: Sector;
  ourId: string;
  sets: GroupSetRow[];
  defaultId: string | null;
  nearest: GroupSetInput["groups"];
  meta: (id: string) => GroupSetInput["groups"][number];
  /** 0.8 non-mainstream groups: a non-mainstream group's page (its kinds' pools are keys too). */
  nm?: boolean;
  /** R-NM-SETS: may this group sit in a set beside ours? (Another family's group is left out of a stored
   * or unsaved set, and the set says how many were.) Absent: every group may. */
  allowed?: (id: string) => boolean;
  /** "Nearest in size, special and AP trusts" (default "Nearest in size, same type"). */
  nearestName?: string;
}): { key: string; compare: CompareKey; groupSet: GroupSetInput | null } {
  const fallback = pageDefault(null, ctx.bandKey, ctx.sector);
  let key = normaliseCompare(raw, ctx) ?? pageDefault(ctx.defaultId ? { id: ctx.defaultId } : null, ctx.bandKey, ctx.sector);
  let groupSet: GroupSetInput | null = null;
  if (key === "nearest") {
    if (ctx.nearest.length) groupSet = { key, name: ctx.nearestName ?? "Nearest in size, same type", source: "nearest", setId: null, scope: null, groups: ctx.nearest };
    else key = fallback;
  } else if (key.startsWith("set:")) {
    const s = ctx.sets.find((x) => x.kind === "group_peers" && !x.archived && x.id === key.slice(4));
    if (s) {
      const ids = s.members.filter((id) => id !== ctx.ourId);
      const ok = ctx.allowed ? ids.filter(ctx.allowed) : ids;
      groupSet = { key, name: s.name, source: "set", setId: s.id, scope: s.scope, groups: ok.slice(0, GROUP_SET_CAP).map(ctx.meta), ...(ok.length < ids.length ? { refused: ids.length - ok.length } : {}) };
    }
    else key = fallback;
  } else if (key.startsWith("peer_named:")) {
    const all = namedList(key.slice(11)).filter((id) => id !== ctx.ourId);
    const ids = ctx.allowed ? all.filter(ctx.allowed) : all;
    if (ids.length) groupSet = { key: `peer_named:${ids.join(",")}`, name: "Unsaved set", source: "unsaved", setId: null, scope: null, groups: ids.map(ctx.meta), ...(ids.length < all.length ? { refused: all.length - ids.length } : {}) };
    else key = fallback;
  }
  if (groupSet) key = groupSet.key;
  const nmKey: CompareKey | null = ctx.nm && key.startsWith("pools:") ? (key as CompareKey) : ctx.nm && key === "kind_areas:region" ? "kind_areas" : null;
  const compare: CompareKey = groupSet ? (groupSet.groups.length ? (`peer_named:${groupSet.groups.map((g) => g.id).join(",")}` as CompareKey) : "england") : (nmKey ?? pooledKind(key) ?? "peer_band");
  return { key, compare, groupSet };
}

// ------------------------------------------------------------------------------ nearest in size

/** The groups of our type nearest us in size (D4's same type; the index already holds out sponsor
 * records, single-academy trusts, self-declared and non-mainstream groups). Ties: the larger first. */
export function nearestInSize(cards: IndexCard[], us: Pick<IndexCard, "group_id" | "type" | "schools"> | null, n = NEAREST_IN_SIZE, same?: (c: IndexCard) => boolean): IndexCard[] {
  if (!us) return [];
  // 0.8 non-mainstream groups: a special and AP trust's nearest are its own family's, of any type.
  return cards
    .filter((c) => c.group_id !== us.group_id && (same ? same(c) : c.type === us.type))
    .sort((a, b) => Math.abs(a.schools - us.schools) - Math.abs(b.schools - us.schools) || b.schools - a.schools || a.name.localeCompare(b.name))
    .slice(0, n);
}

// ------------------------------------------------------------------------------- median and band

/** Linear-interpolated quantile of sorted values (p in 0..1). */
export function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

/** The set's median: one vote per group with a figure. */
export function medianOf(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  return quantile(v, 0.5);
}

export type Pt = { year: number; value: number | null };
export type SetTrend = { median: Pt[]; band: { x: number; lo: number | null; hi: number | null }[] | null; groups: number; bandNote: string };

/** A set's trend from its groups' lines (ours left out): the median each year, and the middle half
 * (25th to 75th percentile) where at least BAND_MIN_GROUPS groups have a figure that year. With fewer
 * groups in the set, no band at all, and the (i) says why (D3). */
export function setTrend(lines: { pts: Pt[] }[]): SetTrend {
  const years = Array.from(new Set(lines.flatMap((l) => l.pts.map((p) => p.year)))).sort((a, b) => a - b);
  const at = (y: number) => lines.map((l) => l.pts.find((p) => p.year === y)?.value ?? null).filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  const median = years.map((y) => ({ year: y, value: quantile(at(y), 0.5) }));
  const n = lines.length;
  const band = n >= BAND_MIN_GROUPS ? years.map((y) => {
    const v = at(y);
    return v.length >= BAND_MIN_GROUPS ? { x: y, lo: quantile(v, 0.25), hi: quantile(v, 0.75) } : { x: y, lo: null, hi: null };
  }) : null;
  return { median, band, groups: n, bandNote: bandWords(n) };
}

/** The band's (i): "middle half of the 6 groups in this set", or why there is none. */
export function bandWords(n: number): string {
  return n >= BAND_MIN_GROUPS
    ? `The shaded band is the middle half of the ${n} groups in this set (the 25th to the 75th percentile each year); the line through it is their median.`
    : `No middle-half band: it needs at least ${BAND_MIN_GROUPS} groups, and this set has ${n}. The dashed line is the median of the ${n} group${n === 1 ? "" : "s"}.`;
}

/** "n of m groups" under the median. */
export const ofGroupsWords = (n: number, m: number) => `${n} of ${m} group${m === 1 ? "" : "s"}`;
export const groupsWord = (n: number) => `${n} group${n === 1 ? "" : "s"}`;

/** A measure a type never publishes reads "not published" (the row stays): independent schools have no
 * Progress 8 and publish no KS2. Anything else without a figure is a plain dash. */
export function notPublished(type: string, measure: string): boolean {
  return type.startsWith("independent") && (measure === "ks4_p8" || measure === "ks2_rwm");
}

// ------------------------------------------------------------------------------- subsets (M5)

/** A subset applied to the group's current schools: the members still in the group, and the ones that
 * have left since (they drop out of the filter, and the set view says so). */
export function subsetFilter(members: string[], current: Iterable<string>): { kept: string[]; left: string[] } {
  const now = new Set(current);
  const kept: string[] = [];
  const left: string[] = [];
  for (const u of members) (now.has(u) ? kept : left).push(u);
  return { kept, left };
}

/** "Showing 18 of 59 schools · group figures are for all 59". */
export const showingWords = (n: number, total: number) => `Showing ${n} of ${total} school${total === 1 ? "" : "s"} · group figures are for all ${total}`;
export const allSchoolsWords = (total: number) => `All ${total} school${total === 1 ? "" : "s"}`;
export const leftWords = (n: number) => `${n} school${n === 1 ? " has" : "s have"} left the group since this set was made: ${n === 1 ? "it drops" : "they drop"} out of the filter.`;

/** ?showing=: "all" (null) or a stored subset. */
export const normaliseShowing = (raw: string | null | undefined): string | null => (raw && raw.startsWith("set:") && isUuid(raw.slice(4)) ? raw : null);
