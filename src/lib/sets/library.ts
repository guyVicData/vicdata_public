// VicData 0.8 sets round 1 (D18): the library's data for one school and one person. Server-only.
//   default   the school's default sets for each of its entry points and both kinds (computed now:
//             ./recipes.ts), never stored
//   stored    the school's sets and the person's own, archived ones included (RLS: the caller's reader)
//   lastUsed  per set, for "recently used" (the person's own set_user_state)
//   names     the schools in every set, for "search by a school in it"
import type { SupabaseClient } from "@supabase/supabase-js";
import { entryPoint } from "../admissions/entry-points";
import { fetchSchoolTraits } from "../admissions/traits";
import { admissionsRecipes, type RecipeSet } from "./recipes";
import { readSets, readUserState, schoolNames } from "./store";
import { activePersonalCount, canCurate, creatorFor, PERSONAL_SET_CAP, type StoredSet } from "./model";

export type LibraryData = {
  school: { urn: string; name: string; boarding: boolean };
  entries: string[];
  defaults: (Pick<RecipeSet, "key" | "name" | "kind" | "entryPoint" | "urns" | "how"> & { count: number })[];
  stored: StoredSet[];
  lastUsed: Record<string, string | null>;
  folders: Record<string, string | null>;
  names: Record<string, string>;
  curates: { compared_against: boolean; feeders: boolean };
  /** The creator a school set made here is saved under (a role the person holds), by kind. */
  creators: { compared_against: "admissions" | "smt" | "school_admin" | null; feeders: "admissions" | "smt" | "school_admin" | null };
  profileId: string | null;
  personalActive: number;
  cap: number;
};

/** The entry points a school's sets are for: its saved ones (Admissions), else the ones its age range takes. */
export function entriesFor(saved: string[], low: number | null, high: number | null): string[] {
  if (saved.length) return saved;
  const out: string[] = [];
  if ((low ?? 99) <= 4 && (high ?? 0) >= 5) out.push("4+");
  if ((low ?? 99) <= 11 && (high ?? 0) >= 12) out.push("11+");
  if ((low ?? 99) <= 16 && (high ?? 0) >= 17) out.push("16+");
  return out.length ? out : ["11+"];
}

export async function libraryData(c: { reader: SupabaseClient; supabase: SupabaseClient; urn: string; userId: string; roles: string[]; isAdmin: boolean; isAccountHolder: boolean; viewAs: boolean }): Promise<LibraryData> {
  const profileId = c.viewAs ? null : c.userId;
  const { data: acc } = await c.reader.from("school_accounts").select("id").eq("school_urn", c.urn).maybeSingle<{ id: string }>();
  const [traits, eps] = await Promise.all([fetchSchoolTraits([c.urn]), acc ? c.reader.from("admissions_entry_points").select("entry_point").eq("school_account_id", acc.id).order("sort_order") : Promise.resolve({ data: [] })]);
  const me = traits.get(c.urn);
  const entries = entriesFor(((eps.data ?? []) as { entry_point: string }[]).map((e) => e.entry_point), me?.low ?? null, me?.high ?? null);
  const read = await readSets(c.reader, { schoolAccountId: acc?.id ?? null, profileId, includeArchived: true });
  const defaults: LibraryData["defaults"] = [];
  for (const e of entries) {
    const ep = entryPoint(e);
    if (!ep) continue;
    for (const kind of ["compared_against", "feeders"] as const) {
      const rec = await admissionsRecipes(c.urn, ep, kind).catch(() => [] as RecipeSet[]);
      for (const r of rec) defaults.push({ key: r.key, name: r.name, kind: r.kind, entryPoint: r.entryPoint, urns: r.urns, how: r.how, count: r.urns.length });
    }
  }
  const state = profileId ? await readUserState(c.supabase, profileId).catch(() => new Map()) : new Map<string, { lastUsedAt: string | null; folder: string | null }>();
  const lastUsed: Record<string, string | null> = {};
  const folders: Record<string, string | null> = {};
  for (const [k, v] of state) {
    lastUsed[k] = v.lastUsedAt;
    folders[k] = v.folder;
  }
  const names = Object.fromEntries(await schoolNames(c.reader, read.sets.flatMap((s) => s.members.map((m) => m.urn))));
  const curator = { roles: c.roles, isAdmin: c.isAdmin, isAccountHolder: c.isAccountHolder };
  return {
    school: { urn: c.urn, name: me?.name ?? c.urn, boarding: me?.boarding ?? false },
    entries,
    defaults,
    stored: read.sets,
    lastUsed,
    folders,
    names,
    curates: { compared_against: !c.viewAs && canCurate(curator, "compared_against"), feeders: !c.viewAs && canCurate(curator, "feeders") },
    creators: { compared_against: c.viewAs ? null : creatorFor(curator, "compared_against", "smt"), feeders: c.viewAs ? null : creatorFor(curator, "feeders") },
    profileId,
    personalActive: activePersonalCount(read.sets, profileId),
    cap: PERSONAL_SET_CAP,
  };
}
