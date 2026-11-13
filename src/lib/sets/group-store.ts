// VicData 0.8 group sets (M4, M5): writing a head office's sets. Additive beside ./store.ts (school sets
// keep their own path, unchanged). Every call runs under the member's own session, so the database
// decides who may do what (20261121100000_v08_group_sets.sql: sets_* policies, check_set_creator, the
// cap triggers, save_set, share_set_with_group; R-GROUP-SETS-RLS, R-GROUP-SET-DEFAULT). Never used from View as or a peek: those pages offer no
// writes, and the database would refuse them anyway (a platform admin is no head-office admin).
import type { SupabaseClient } from "@supabase/supabase-js";
import { GROUP_SET_CAP, type GroupSetKind } from "../groups/group-sets";

type Client = Pick<SupabaseClient, "from" | "rpc">;

export type GroupSetWrite = {
  name?: string;
  description?: string | null;
  kind?: GroupSetKind;
  owner_scope?: "group" | "personal";
  group_account_id?: string;
  owner_profile_id?: string | null;
  creator_kind?: "head_office" | "me";
  is_default?: boolean;
  pinned?: boolean;
  archived?: boolean;
};

const GROUP_ID = /^[\w:.-]{1,80}$/;
const URN = /^\d{5,7}$/;

/** The members as save_set takes them: groups ({group_id}) for a comparison set, schools ({urn}) for a
 * subset; distinct, in order, a set of groups at most GROUP_SET_CAP. */
export function groupMembersPayload(kind: GroupSetKind, members: string[]): { group_id: string }[] | { urn: string }[] {
  const seen = new Set<string>();
  const ok = members.filter((m) => (kind === "group_peers" ? GROUP_ID : URN).test(m) && !seen.has(m) && (seen.add(m), true));
  return kind === "group_peers" ? ok.slice(0, GROUP_SET_CAP).map((group_id) => ({ group_id })) : ok.slice(0, 500).map((urn) => ({ urn }));
}

function friendly(msg: string): string {
  if (/personal set cap/i.test(msg)) return "You have 8 active sets of your own. Archive one to free a slot.";
  if (/at most 8 groups/i.test(msg)) return `${GROUP_SET_CAP} is the most a set holds.`;
  if (/row-level security|42501|can change has that id|written by its head office|only your own|only the head office/i.test(msg)) return "You can't change this set. Save it as your own instead.";
  if (/sets_one_group_default/i.test(msg)) return "The group already has a default set. Try again.";
  return msg;
}

/** Create (id null) or change a group set and, unless `members` is null, replace its members, in one
 * call (save_set). */
export async function saveGroupSet(client: Client, id: string | null, kind: GroupSetKind, set: GroupSetWrite, members: string[] | null): Promise<{ id: string } | { error: string }> {
  const { data, error } = await client.rpc("save_set", { p_id: id, p_set: { ...set, kind }, p_members: members === null ? null : groupMembersPayload(kind, members) });
  if (error) return { error: friendly(error.message) };
  return { id: String(data) };
}

/** Make default (D8, admins): the group's one default of this kind. The old one is cleared first (one
 * default per head office and kind, the unique index); if the second step fails the page falls back to
 * the size band, never to two defaults. */
export async function makeGroupDefault(client: Client, kind: GroupSetKind, setId: string, previousId: string | null): Promise<string | null> {
  if (previousId && previousId !== setId) {
    const r = await saveGroupSet(client, previousId, kind, { is_default: false }, null);
    if ("error" in r) return r.error;
  }
  const r = await saveGroupSet(client, setId, kind, { is_default: true }, null);
  return "error" in r ? r.error : null;
}

/** Back to the size band: the group's default set is no longer the default. */
export async function clearGroupDefault(client: Client, kind: GroupSetKind, previousId: string): Promise<string | null> {
  const r = await saveGroupSet(client, previousId, kind, { is_default: false }, null);
  return "error" in r ? r.error : null;
}

/** Share with the group (D6, admins): the personal set MOVES to the head office, freeing the slot. */
export async function shareGroupSet(client: Client, setId: string): Promise<string | null> {
  const { error } = await client.rpc("share_set_with_group", { p_set_id: setId });
  return error ? friendly(error.message) : null;
}

export async function archiveGroupSet(client: Client, kind: GroupSetKind, setId: string, archived: boolean): Promise<string | null> {
  const r = await saveGroupSet(client, setId, kind, { archived, ...(archived ? { is_default: false } : {}) }, null);
  return "error" in r ? r.error : null;
}

export async function deleteGroupSet(client: Client, setId: string): Promise<string | null> {
  const { data, error } = await client.from("sets").delete().eq("id", setId).select("id");
  if (error) return friendly(error.message);
  return (data ?? []).length ? null : "You can't remove this set.";
}

/** A new set's ownership: the group's (an admin, creator Head office) or the writer's own (Me). */
export function ownerOf(scope: "group" | "personal", accountId: string, profileId: string): GroupSetWrite {
  return scope === "group" ? { owner_scope: "group", group_account_id: accountId, owner_profile_id: null, creator_kind: "head_office" } : { owner_scope: "personal", group_account_id: accountId, owner_profile_id: profileId, creator_kind: "me" };
}
