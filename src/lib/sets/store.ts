// VicData 0.8 sets round 1 (A1, A5): reading and writing stored sets. Works under any Supabase client
// -- a member's own (RLS decides what they see and may change), or the service role once a platform
// admin's View as has been confirmed (view-as-server.ts). Never decides permissions itself: the
// database does (sets_* policies, can_curate_sets, the cap trigger, save_set).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SetKind, SetMember, StoredSet, Tier } from "./model";

type Client = Pick<SupabaseClient, "from" | "rpc">;

export const SET_COLUMNS =
  "id, name, description, kind, entry_point, phase, focus_urn, owner_scope, school_account_id, owner_profile_id, creator_kind, audience, rung_age, is_default, pinned, folder, tags, archived, rule, source_recipe, la_blend, config, created_by, created_at, updated_by, updated_at, set_members(urn, position, tier)";

export type SetRow = {
  id: string;
  name: string;
  description: string | null;
  kind: SetKind;
  entry_point: string | null;
  phase: "ks4" | "ks5" | null;
  focus_urn: string | null;
  owner_scope: "school" | "personal";
  school_account_id: string | null;
  owner_profile_id: string | null;
  creator_kind: StoredSet["creatorKind"];
  audience: "day" | "boarding" | null;
  rung_age: number | null;
  is_default: boolean;
  pinned: boolean;
  folder: string | null;
  tags: string[] | null;
  archived: boolean;
  rule: Record<string, unknown> | null;
  source_recipe: string | null;
  la_blend: Record<string, number> | null;
  config: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  set_members?: { urn: string; position: number; tier: Tier | null }[] | null;
};

export function fromRow(r: SetRow): StoredSet {
  const members: SetMember[] = [...(r.set_members ?? [])].sort((a, b) => a.position - b.position || a.urn.localeCompare(b.urn)).map((m) => ({ urn: m.urn, position: m.position, tier: m.tier ?? null }));
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    kind: r.kind,
    entryPoint: r.entry_point ?? null,
    phase: r.phase ?? null,
    focusUrn: r.focus_urn ?? null,
    ownerScope: r.owner_scope,
    schoolAccountId: r.school_account_id ?? null,
    ownerProfileId: r.owner_profile_id ?? null,
    creatorKind: r.creator_kind,
    audience: r.audience ?? null,
    rungAge: r.rung_age ?? null,
    isDefault: !!r.is_default,
    pinned: !!r.pinned,
    folder: r.folder ?? null,
    tags: r.tags ?? [],
    archived: !!r.archived,
    rule: r.rule ?? null,
    sourceRecipe: r.source_recipe ?? null,
    laBlend: r.la_blend ?? null,
    config: r.config ?? {},
    members,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedBy: r.updated_by ?? null,
    updatedAt: r.updated_at,
  };
}

/** Before the migration is applied, every read says so instead of failing the page. */
export const setsNotSetUp = (msg: string | undefined) => /relation .*sets.* does not exist|public\.sets|set_members|schema cache|save_set/i.test(msg ?? "");

export type SetsRead = { sets: StoredSet[]; error: string | null; notSetUp: boolean };

/** One school's school sets, and (with `profileId`) that person's own personal sets, optionally
 * narrowed to a kind. RLS returns only what the client may read. */
export async function readSets(client: Client, o: { schoolAccountId: string | null; profileId?: string | null; kind?: SetKind; includeArchived?: boolean }): Promise<SetsRead> {
  const read = async (scope: "school" | "personal") => {
    let qb = client.from("sets").select(SET_COLUMNS).eq("owner_scope", scope);
    qb = scope === "school" ? qb.eq("school_account_id", o.schoolAccountId ?? "00000000-0000-0000-0000-000000000000") : qb.eq("owner_profile_id", o.profileId ?? "00000000-0000-0000-0000-000000000000");
    if (o.kind) qb = qb.eq("kind", o.kind);
    if (!o.includeArchived) qb = qb.eq("archived", false);
    return qb.order("created_at", { ascending: true });
  };
  const [school, personal] = await Promise.all([o.schoolAccountId ? read("school") : Promise.resolve({ data: [], error: null }), o.profileId ? read("personal") : Promise.resolve({ data: [], error: null })]);
  const err = school.error ?? personal.error;
  if (err) return { sets: [], error: err.message, notSetUp: setsNotSetUp(err.message) };
  return { sets: [...((school.data ?? []) as unknown as SetRow[]), ...((personal.data ?? []) as unknown as SetRow[])].map(fromRow), error: null, notSetUp: false };
}

/** The school sets of the school with this URN (joined through school_accounts), for an entry
 * point. Used by Admissions' views, which know the school by URN. */
export async function readSchoolSetsByUrn(client: Client, urn: string, o: { entryPoint?: string; kind?: SetKind } = {}): Promise<SetsRead> {
  let qb = client.from("sets").select(`${SET_COLUMNS}, school_accounts!inner(school_urn)`).eq("owner_scope", "school").eq("archived", false).eq("school_accounts.school_urn", urn);
  if (o.entryPoint) qb = qb.eq("entry_point", o.entryPoint);
  if (o.kind) qb = qb.eq("kind", o.kind);
  const { data, error } = await qb.order("created_at", { ascending: true });
  if (error) return { sets: [], error: error.message, notSetUp: setsNotSetUp(error.message) };
  return { sets: ((data ?? []) as unknown as SetRow[]).map(fromRow), error: null, notSetUp: false };
}

export async function readSet(client: Client, id: string): Promise<StoredSet | null> {
  const { data } = await client.from("sets").select(SET_COLUMNS).eq("id", id).maybeSingle();
  return data ? fromRow(data as unknown as SetRow) : null;
}

/** What a writer may set on a set. Columns the database stamps (who and when) aren't here. */
export type SetWrite = {
  name?: string;
  description?: string | null;
  kind?: SetKind;
  entry_point?: string | null;
  phase?: "ks4" | "ks5" | null;
  focus_urn?: string | null;
  owner_scope?: "school" | "personal";
  school_account_id?: string | null;
  owner_profile_id?: string | null;
  creator_kind?: StoredSet["creatorKind"];
  audience?: "day" | "boarding" | null;
  rung_age?: number | null;
  is_default?: boolean;
  pinned?: boolean;
  folder?: string | null;
  tags?: string[];
  archived?: boolean;
  rule?: Record<string, unknown> | null;
  source_recipe?: string | null;
  la_blend?: Record<string, number> | null;
  config?: Record<string, unknown>;
};

export type MemberWrite = { urn: string; tier?: Tier | null };

/** Create (id null) or change a set and, unless `members` is null, replace its schools -- in one
 * call (save_set), so a set is never half-written. Returns the id, or the database's refusal. */
export async function saveSet(client: Client, id: string | null, set: SetWrite, members: MemberWrite[] | null): Promise<{ id: string } | { error: string; code?: string }> {
  const seen = new Set<string>();
  const list = members === null ? null : members.filter((m) => /^\d{5,7}$/.test(m.urn) && !seen.has(m.urn) && (seen.add(m.urn), true)).slice(0, 500).map((m) => ({ urn: m.urn, tier: m.tier ?? null }));
  const { data, error } = await client.rpc("save_set", { p_id: id, p_set: set, p_members: list });
  if (error) return { error: friendly(error.message), code: error.code };
  return { id: String(data) };
}

export async function deleteSet(client: Client, id: string): Promise<string | null> {
  const { data, error } = await client.from("sets").delete().eq("id", id).select("id");
  if (error) return friendly(error.message);
  return (data ?? []).length ? null : "You can't remove this set.";
}

/** Record that this person used a set (a stored set's id, or a computed set's key), for "recently
 * used" in the menu and the library. Best effort: a failure never stops the page. */
export async function markUsed(client: Client, profileId: string, setKey: string): Promise<void> {
  await client.from("set_user_state").upsert({ profile_id: profileId, set_key: setKey, last_used_at: new Date().toISOString() }, { onConflict: "profile_id,set_key" });
}

export async function readUserState(client: Client, profileId: string): Promise<Map<string, { lastUsedAt: string | null; folder: string | null }>> {
  const { data } = await client.from("set_user_state").select("set_key, last_used_at, folder").eq("profile_id", profileId);
  return new Map(((data ?? []) as { set_key: string; last_used_at: string | null; folder: string | null }[]).map((r) => [r.set_key, { lastUsedAt: r.last_used_at, folder: r.folder }]));
}

function friendly(msg: string): string {
  if (/personal set cap/i.test(msg)) return "You have 8 active sets of your own. Archive one to free a slot.";
  if (/row-level security|42501|can change has that id|creator must be/i.test(msg)) return "You can't change this set. Save it as your own instead.";
  return msg;
}

/** Every set of this kind the client may read (RLS: its own school sets and its own personal sets),
 * newest last. The Data View reads its comparator sets this way, as it read saved_sets before. */
export async function readVisibleSets(client: Client, kind: SetKind): Promise<SetsRead> {
  const { data, error } = await client.from("sets").select(SET_COLUMNS).eq("kind", kind).eq("archived", false).order("created_at", { ascending: true });
  if (error) return { sets: [], error: error.message, notSetUp: setsNotSetUp(error.message) };
  return { sets: ((data ?? []) as unknown as SetRow[]).map(fromRow), error: null, notSetUp: false };
}

/** School names for URNs (GIAS current_name), in batches. */
export async function schoolNames(client: Client, urns: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = Array.from(new Set(urns));
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await client.from("schools").select("urn, current_name").in("urn", uniq.slice(i, i + 200));
    for (const r of (data ?? []) as { urn: string; current_name: string }[]) out.set(r.urn, r.current_name);
  }
  return out;
}
