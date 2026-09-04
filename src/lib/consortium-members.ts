// Live lookups against consortium_members (see that table's own migration comment for
// what it holds and why). Deliberately thin, two directions only -- the group-page
// template needs "which real schools sit behind this group URN," the constituent
// school's own page needs the reverse, "which group (if any) is this URN a member
// of." Both read live by URN, no caching, matching this project's "don't duplicate
// what schools already carries" discipline the table's own migration comment states.

import { createServerAnonSupabaseClient } from "@/lib/supabase";

export type ConsortiumMemberLink = { memberUrn: string; syncedAt: string };

export async function lookupConsortiumMembers(groupUrn: string): Promise<ConsortiumMemberLink[]> {
  const supabase = createServerAnonSupabaseClient();
  const { data } = await supabase
    .from("consortium_members")
    .select("member_urn, synced_at")
    .eq("group_urn", groupUrn);
  return ((data ?? []) as { member_urn: string; synced_at: string }[]).map((r) => ({
    memberUrn: r.member_urn,
    syncedAt: r.synced_at,
  }));
}

// A member URN is expected to belong to at most one group in practice (every real
// case checked this round did), but this returns every match rather than assuming
// that -- a school genuinely linked to two groups should get two notes, not have one
// silently dropped.
export async function lookupConsortiumGroupsFor(memberUrn: string): Promise<string[]> {
  const supabase = createServerAnonSupabaseClient();
  const { data } = await supabase
    .from("consortium_members")
    .select("group_urn")
    .eq("member_urn", memberUrn);
  return ((data ?? []) as { group_urn: string }[]).map((r) => r.group_urn);
}
