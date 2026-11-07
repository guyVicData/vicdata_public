// VicData 0.8 sets round 1 (B6-B11): which set an Admissions page uses, and what its menu offers.
// Server-only. A page is one school, one entry point and one kind:
//   Pipelines      kind feeders            ("Feeder schools")
//   Market share   kind compared_against   ("Compared against")
// A choice is a key:
//   set:<uuid>             a stored set (a school set, or the person's own), read under RLS
//   default:<recipe key>   a default set (./recipes.ts), computed now
//   school:day+boarding    a boarding school's day and boarding feeder sets together (what the old
//                          "Day + boarding" dropdown drew; B11 makes it a choice of set)
//   (none)                 the school's own choice for the page (its default school set(s)), else the
//                          default recipe for the page (B8)
// The views still read the old list kinds (./admissions-lists.ts), so a set of the same schools
// draws the same figures (R-SETS-ONE-MODEL).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryPoint } from "../admissions/entry-points";
import type { SavedList } from "../admissions/lists";
import { legacyKindOf } from "./admissions-lists";
import { admissionsRecipes, type RecipeSet } from "./recipes";
import { readSchoolSetsByUrn, readSets } from "./store";
import { PERSONAL_SET_CAP, activePersonalCount, setFitsPage, tierOf, type CreatorKind, type SetBlock, type SetKind, type StoredSet } from "./model";

export const COMBO_KEY = "school:day+boarding";

/** One row of the menu, and the set a page is using. */
export type SetChoice = {
  key: string;
  name: string;
  count: number;
  block: SetBlock;
  creator: CreatorKind;
  /** Feeder sets: how many are Main feeders (for "28 · 6 main"). */
  main?: number;
  /** Who may change it here: the editor opens it, else a copy to save as your own (C17). */
  editable?: boolean;
  pinned?: boolean;
  lastUsedAt?: string | null;
  how?: string;
};

export type AdmissionsMenu = {
  kind: SetKind;
  entry: string;
  label: "Feeder schools" | "Compared against";
  default: SetChoice[];
  school: SetChoice[];
  mine: SetChoice[];
  mineActive: number;
  cap: number;
  current: SetChoice;
};

export const labelOfKind = (kind: SetKind) => (kind === "feeders" ? "Feeder schools" : "Compared against") as AdmissionsMenu["label"];

const choiceOf = (s: StoredSet, canEdit: boolean, lastUsedAt?: string | null): SetChoice => ({
  key: `set:${s.id}`,
  name: s.name,
  count: s.members.length,
  block: s.ownerScope === "personal" ? "mine" : "school",
  creator: s.creatorKind,
  ...(s.kind === "feeders" ? { main: s.members.filter((m) => tierOf(m.tier) === "main").length } : {}),
  editable: canEdit,
  pinned: s.pinned,
  lastUsedAt: lastUsedAt ?? null,
});

const recipeChoice = (r: RecipeSet): SetChoice => ({ key: `default:${r.key}`, name: r.name, count: r.urns.length, block: "default", creator: "default", how: r.how, editable: false, ...(r.kind === "feeders" ? { main: 0 } : {}) });

/** The school's own sets that fit the page (kind and entry point), and the person's own. A feeder
 * page lists the day and boarding sets (not the 16+ rung sets, which the ladder reads by age). */
function fitting(sets: StoredSet[], kind: SetKind, ep: EntryPoint, profileId: string | null) {
  const fits = sets.filter((s) => !s.archived && setFitsPage(s, { kind, entryPoint: ep.id }) && s.rungAge == null);
  return {
    school: fits.filter((s) => s.ownerScope === "school"),
    mine: fits.filter((s) => s.ownerScope === "personal" && (!profileId || s.ownerProfileId === profileId)),
  };
}

export type PageSets = { stored: StoredSet[]; recipes: RecipeSet[]; boardingSchool: boolean };

/** Everything a page's choice is made from: the school's sets (and the person's own), and the
 * default sets. `reader` is the caller's reader (RLS; the service role in a confirmed View as). */
export async function pageSets(reader: SupabaseClient, urn: string, ep: EntryPoint, kind: SetKind, o: { profileId: string | null; boardingSchool: boolean }): Promise<PageSets> {
  const [schoolSets, recipes] = await Promise.all([readSchoolSetsByUrn(reader, urn, { kind }), admissionsRecipes(urn, ep, kind)]);
  let mine: StoredSet[] = [];
  if (o.profileId) mine = (await readSets(reader, { schoolAccountId: null, profileId: o.profileId, kind })).sets;
  return { stored: [...schoolSets.sets, ...mine], recipes, boardingSchool: o.boardingSchool };
}

/** The school's own choice for the page: its default sets. Feeders at a boarding school with both a
 * day and a boarding default draw them together, as the old "Day + boarding" did. */
function schoolChoice(stored: StoredSet[], kind: SetKind, ep: EntryPoint, boardingSchool: boolean): { key: string; sets: StoredSet[] } | null {
  const defs = stored.filter((s) => s.ownerScope === "school" && s.isDefault && !s.archived && s.entryPoint === ep.id && s.kind === kind && s.rungAge == null && legacyKindOf(s) !== null);
  if (kind === "compared_against") return defs[0] ? { key: `set:${defs[0].id}`, sets: [defs[0]] } : null;
  const day = defs.find((s) => s.audience === "day");
  const boarding = boardingSchool ? defs.find((s) => s.audience === "boarding") : undefined;
  if (day && boarding && day.members.length && boarding.members.length) return { key: COMBO_KEY, sets: [day, boarding] };
  const one = (day?.members.length ? day : null) ?? (boarding?.members.length ? boarding : null) ?? day ?? boarding;
  return one ? { key: `set:${one.id}`, sets: [one] } : null;
}

export type ResolvedSet = {
  choice: SetChoice;
  /** The lists the views read for this choice (the old list kinds). */
  lists: SavedList[];
  /** The schools, in the set's order. */
  urns: string[];
  /** Feeder tiers by URN (stored feeder sets only). */
  tiers: Record<string, "main" | "regular" | "occasional">;
};

/** Resolve a page's choice into the lists the views read. `base` is the school's saved lists for the
 * entry point (its rung sets and blend are kept); the choice replaces the kind it is for. A key that
 * no longer resolves (a set that has gone, or one this person can't read) falls back to the page's
 * default, so a stale link never shows another school's set or an empty page. */
export function resolveChoice(ps: PageSets, ep: EntryPoint, kind: SetKind, key: string | null, base: SavedList[], profileId: string | null, canCurate: boolean): ResolvedSet {
  const { stored, recipes, boardingSchool } = ps;
  const forKind = (l: SavedList) => (kind === "compared_against" ? l.kind === "rivals" : l.kind === "day_feeders" || l.kind === "boarding_feeders");
  const keep = base.filter((l) => !forKind(l));
  const blend = base.find((l) => l.la_blend && Object.keys(l.la_blend).length)?.la_blend ?? null;
  const listOf = (urns: string[], laBlend: Record<string, number> | null): SavedList => ({ kind: kind === "compared_against" ? "rivals" : "day_feeders", rung: null, members: urns, la_blend: laBlend, confirmed: true });
  const tiersOf = (sets: StoredSet[]) => Object.fromEntries(sets.flatMap((s) => s.members.map((m) => [m.urn, tierOf(m.tier)] as const)));
  const own = schoolChoice(stored, kind, ep, boardingSchool);
  const fromStored = (sets: StoredSet[], k: string): ResolvedSet => {
    const urns = Array.from(new Set(sets.flatMap((s) => s.members.map((m) => m.urn))));
    const name = k === COMBO_KEY ? "Day + boarding feeders" : sets[0].name;
    const s0 = sets[0];
    const editable = s0.ownerScope === "personal" ? s0.ownerProfileId === profileId : canCurate;
    const choice: SetChoice = k === COMBO_KEY
      ? { key: k, name, count: urns.length, block: "school", creator: s0.creatorKind, main: sets.flatMap((s) => s.members).filter((m) => tierOf(m.tier) === "main").length, editable: false, pinned: true }
      : choiceOf(s0, editable);
    // The school's own default sets are read exactly as the old lists (both kinds, each its own
    // list), so their figures can't change; any other set stands in for the kind as one list.
    const lists = own && own.key === k ? base : [...keep, listOf(urns, s0.laBlend ?? blend)];
    return { choice, lists, urns, tiers: kind === "feeders" ? tiersOf(sets) : {} };
  };
  const fromRecipe = (r: RecipeSet): ResolvedSet => ({ choice: recipeChoice(r), lists: [...keep, listOf(r.urns, blend)], urns: r.urns, tiers: {} });

  if (key === COMBO_KEY && own?.key === COMBO_KEY) return fromStored(own.sets, COMBO_KEY);
  if (key?.startsWith("set:")) {
    const s = stored.find((x) => x.id === key.slice(4) && !x.archived && setFitsPage(x, { kind, entryPoint: ep.id }) && (x.ownerScope === "school" || x.ownerProfileId === profileId));
    if (s && s.members.length) return fromStored([s], key);
  }
  if (key?.startsWith("default:")) {
    const r = recipes.find((x) => `default:${x.key}` === key);
    if (r) return fromRecipe(r);
  }
  if (own && own.sets.some((s) => s.members.length)) return fromStored(own.sets, own.key);
  const def = recipes.find((r) => r.isDefaultChoice) ?? recipes[0];
  if (def) return fromRecipe(def);
  // No school data at all: an empty set (the views say so).
  return { choice: { key: "default:none", name: "No schools", count: 0, block: "default", creator: "default" }, lists: keep, urns: [], tiers: {} };
}

/** The menu (B7): Default, then the school's sets, then the person's own ("n of 8"); the current
 * set ticked by the page. Only sets that fit the page. */
export function buildMenu(ps: PageSets, ep: EntryPoint, kind: SetKind, current: SetChoice, o: { profileId: string | null; canCurate: boolean; lastUsed?: Map<string, string | null>; allPersonal?: StoredSet[] }): AdmissionsMenu {
  const { school, mine } = fitting(ps.stored, kind, ep, o.profileId);
  const schoolRows = school.map((s) => choiceOf(s, o.canCurate, o.lastUsed?.get(s.id)));
  const own = schoolChoice(ps.stored, kind, ep, ps.boardingSchool);
  if (own?.key === COMBO_KEY) {
    const urns = new Set(own.sets.flatMap((s) => s.members.map((m) => m.urn)));
    schoolRows.unshift({ key: COMBO_KEY, name: "Day + boarding feeders", count: urns.size, block: "school", creator: own.sets[0].creatorKind, main: own.sets.flatMap((s) => s.members).filter((m) => tierOf(m.tier) === "main").length, editable: false, pinned: true, how: `Your day feeders (${own.sets[0].members.length}) and boarding feeders (${own.sets[1].members.length}) together.` });
  }
  return {
    kind,
    entry: ep.id,
    label: labelOfKind(kind),
    default: ps.recipes.map(recipeChoice),
    school: schoolRows,
    mine: mine.map((s) => choiceOf(s, true, o.lastUsed?.get(s.id))),
    mineActive: activePersonalCount(o.allPersonal ?? mine, o.profileId),
    cap: PERSONAL_SET_CAP,
    current,
  };
}
