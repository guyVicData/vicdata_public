// Teacher view, accordion round Part 3: saved comparator sets -- the shared shapes, the cap,
// and the writes. Client-safe (no reference-data calls); the ranked rows and series come
// from /api/teacher/saved-comparator-sets.
//
// Writes go straight to saved_sets / saved_set_members under the caller's own session,
// the same way /sets/comparator/new saves, so RLS -- not this file -- decides who may
// create or edit what: anyone approved can make a personal set; only the account holder
// or an admin can create or edit a shared one.
import type { createBrowserSupabaseClient } from "@/lib/supabase";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// Personal comparator sets per member. Raised from 3 to 8 (the agreed "5-10") by the
// 20260925232857_personal_comparator_cap_8 migration, which the DB trigger enforces; this
// constant is only what the UI shows ("2 / 8") and checks before trying.
export const PERSONAL_COMPARATOR_CAP = 8;

// A saved set's id as the Comparisons column keys it, so it can never collide with the
// four algorithmic ids ("nearest", "same_sector", ...).
export const SAVED_SET_PREFIX = "saved:";
export const savedSetKey = (id: string) => `${SAVED_SET_PREFIX}${id}`;

export type SetMember = { urn: string; name: string; laName: string | null; independent: boolean };

export type SavedComparatorSet = {
  id: string;
  name: string;
  shared: boolean;
  mine: boolean;
  editable: boolean;
  config: { startedFrom?: string } & Record<string, unknown>;
  members: SetMember[];
  rows: { urn: string; name: string; isTarget: boolean; igcseExcluded?: boolean; distanceKm?: number | null; independent?: boolean }[];
};

export type SavedSetsPayload = {
  me: { membershipId: string; schoolAccountId: string; canEditShared: boolean };
  cap: number;
  personalCount: number;
  sets: SavedComparatorSet[];
  seriesByUrn: Record<string, { results: { period: number; value: number }[]; candidates: { period: number; value: number }[] }>;
  excludedUrns: string[];
  candidates: { urn: string; name: string; distanceKm: number | null; independent: boolean; laName?: string | null }[];
  target: { laName: string | null; independent: boolean };
};

export async function fetchSavedSets(supabase: Supa, urn: string, phase: string): Promise<SavedSetsPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(`/api/teacher/saved-comparator-sets?urn=${encodeURIComponent(urn)}&phase=${phase}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok ? ((await res.json()) as SavedSetsPayload) : null;
}

// Create (id null) or update a set, then replace its members. Returns the set's id, or an
// error message -- the DB's own cap exception included, which is the real backstop.
export async function saveComparatorSet(
  supabase: Supa,
  args: {
    id: string | null;
    schoolAccountId: string;
    ownerMembershipId: string | null; // null = shared (account holder / admin only)
    name: string;
    urns: string[];
    config: Record<string, unknown>;
  },
): Promise<{ id: string } | { error: string }> {
  let id = args.id;
  if (id === null) {
    const { data, error } = await supabase
      .from("saved_sets")
      .insert({
        school_account_id: args.schoolAccountId,
        set_type: "comparator",
        name: args.name,
        owner_membership_id: args.ownerMembershipId,
        config: args.config,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not save the set." };
    id = data.id as string;
  } else {
    const { error } = await supabase
      .from("saved_sets")
      .update({ name: args.name, config: args.config, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    const { error: delError } = await supabase.from("saved_set_members").delete().eq("saved_set_id", id);
    if (delError) return { error: delError.message };
  }
  if (args.urns.length) {
    const { error } = await supabase
      .from("saved_set_members")
      .insert(args.urns.map((urn) => ({ saved_set_id: id, school_urn: urn, member_status: "confirmed" })));
    if (error) return { error: error.message };
  }
  return { id: id! };
}

export async function deleteComparatorSet(supabase: Supa, id: string): Promise<string | null> {
  const { error } = await supabase.from("saved_sets").delete().eq("id", id);
  return error ? error.message : null;
}
