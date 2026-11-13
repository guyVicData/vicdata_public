// VicData 0.8 group sets (M4, M5): reading a head office's sets for the group pages. Server-only.
//   head office    its own session: RLS (sets_select) returns the group's sets and the caller's own
//                  personal sets made for this group, nothing else (R-GROUP-SETS-RLS);
//   a member school's SMT, View as, a peek   the service role, AFTER dashViewer has checked the caller
//                  (the school's live grant; a confirmed platform admin), and the group's own sets only:
//                  never anyone's personal sets (D2: Default and the group's sets, read-only).
// Writes never come through here: the editor and the library save with the member's own session
// (save_set, share_set_with_group), so the database decides. Before the M2 migration is applied every
// read answers "not set up" and the pages offer the Default block alone.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../supabase";
import type { DashViewer } from "./dash-access";
import type { HeadOffice } from "./access-rules";
import { GROUP_SET_KINDS, isUuid, type GroupSetKind, type GroupSetRow } from "./group-sets";

const COLUMNS = "id, name, description, kind, owner_scope, owner_profile_id, is_default, pinned, archived, updated_at, set_group_members(group_id, position), set_members(urn, position)";

type Row = {
  id: string;
  name: string;
  description: string | null;
  kind: GroupSetKind;
  owner_scope: "group" | "personal";
  owner_profile_id: string | null;
  is_default: boolean;
  pinned: boolean;
  archived: boolean;
  updated_at: string;
  set_group_members?: { group_id: string; position: number }[] | null;
  set_members?: { urn: string; position: number }[] | null;
};

export function fromGroupSetRow(r: Row): GroupSetRow {
  const byPos = <T extends { position: number }>(xs: T[] | null | undefined) => [...(xs ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    kind: r.kind,
    scope: r.owner_scope,
    isDefault: !!r.is_default,
    pinned: !!r.pinned,
    archived: !!r.archived,
    ownerProfileId: r.owner_profile_id ?? null,
    members: r.kind === "group_peers" ? byPos(r.set_group_members).map((m) => m.group_id) : byPos(r.set_members).map((m) => m.urn),
    updatedAt: r.updated_at,
  };
}

/** May this viewer write the group's sets (an admin of an active head office, never View as)? */
export const isGroupAdmin = (v: DashViewer) => v.as === "head_office" && (v.account as HeadOffice).role === "head_office_admin";
/** May this viewer keep sets at all (head office, either role; never View as, a peek or a school)? */
export const canKeepSets = (v: DashViewer) => v.as === "head_office";

export type GroupSetsRead = { sets: GroupSetRow[]; notSetUp: boolean; personalActive: number };

/** The sets this viewer may use on the group's pages (both kinds), archived ones on request. */
export async function readGroupSets(who: { viewer: DashViewer; userId: string; supabase: SupabaseClient }, o: { includeArchived?: boolean } = {}): Promise<GroupSetsRead> {
  const { viewer } = who;
  // A group with no group account (View as by production id) has no sets.
  if (!isUuid(viewer.account.id)) return { sets: [], notSetUp: false, personalActive: 0 };
  const own = canKeepSets(viewer);
  const client: Pick<SupabaseClient, "from"> = own ? who.supabase : createServiceRoleSupabaseClient();
  try {
    let q = client.from("sets").select(COLUMNS).eq("group_account_id", viewer.account.id).in("kind", [...GROUP_SET_KINDS]);
    if (!own) q = q.eq("owner_scope", "group");
    if (!o.includeArchived) q = q.eq("archived", false);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) {
      console.warn("[group sets] read:", error.message);
      return { sets: [], notSetUp: true, personalActive: 0 };
    }
    // Belt and braces: a personal set is only ever its owner's, whatever the client.
    const sets = ((data ?? []) as unknown as Row[]).map(fromGroupSetRow).filter((s) => s.scope === "group" || (own && s.ownerProfileId === who.userId));
    let personalActive = 0;
    if (own) {
      // The cap of 8 counts every active personal set (school and group kinds alike: enforce_personal_set_cap).
      const { count } = await who.supabase.from("sets").select("id", { count: "exact", head: true }).eq("owner_scope", "personal").eq("owner_profile_id", who.userId).eq("archived", false);
      personalActive = count ?? 0;
    }
    return { sets, notSetUp: false, personalActive };
  } catch (err) {
    console.warn("[group sets] read failed:", err);
    return { sets: [], notSetUp: true, personalActive: 0 };
  }
}

/** What the pages are told about the viewer's sets. */
export type GroupSetsInfo = {
  sets: GroupSetRow[];
  notSetUp: boolean;
  personalActive: number;
  cap: number;
  admin: boolean;
  canKeep: boolean;
  defaults: { group_peers: string | null; group_schools: string | null };
};
