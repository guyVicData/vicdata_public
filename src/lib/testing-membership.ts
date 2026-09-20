import type { SupabaseClient } from "@supabase/supabase-js";

// The membership half of /api/testing/switch-school, factored out so the preview-session
// route can reuse it rather than growing a second copy.
//
// The hard-won part of this logic is the FK cleanup, and it is hard-won literally: the
// switcher's own comments record two real bugs found by live end-to-end testing, because
// deleting a school_memberships row can be blocked by four separate foreign keys across
// the schema -- school_accounts.account_holder_membership_id and
// .pending_account_holder_membership_id (neither has an ON DELETE action, so Postgres
// defaults to RESTRICT), school_memberships.approved_by (self-referencing), and
// saved_sets.owner_membership_id. A second copy of this that missed one would fail
// silently, exactly as the first attempt at the switcher did.
//
// Service-role only. This deliberately bypasses the ordinary join-and-wait RLS policies
// (a plain member can only insert their own PENDING row and cannot self-approve), which
// is the entire point of it being a testing shortcut rather than a client-side trick.
export async function grantApprovedMembership(
  admin: SupabaseClient,
  profileId: string,
  urn: string,
): Promise<{ ok: true; membershipId: string } | { ok: false; error: string }> {
  const { data: school } = await admin.from("schools").select("urn").eq("urn", urn).maybeSingle();
  if (!school) return { ok: false, error: "Unknown school" };

  let { data: account } = await admin
    .from("school_accounts")
    .select("id, account_holder_membership_id")
    .eq("school_urn", urn)
    .maybeSingle();
  if (!account) {
    const { data: created, error: createError } = await admin
      .from("school_accounts")
      .insert({ school_urn: urn, tier: "individual" })
      .select("id, account_holder_membership_id")
      .single();
    if (createError || !created) return { ok: false, error: "Could not create a school account for this school" };
    account = created;
  }

  const { data: ownMemberships } = await admin
    .from("school_memberships")
    .select("id, school_account_id")
    .eq("profile_id", profileId);
  const ownMembershipIds = (ownMemberships ?? []).map((m) => m.id);
  const ownAccountIds = (ownMemberships ?? []).map((m) => m.school_account_id);

  if (ownAccountIds.length > 0) {
    await admin
      .from("school_accounts")
      .update({ account_holder_membership_id: null, pending_account_holder_membership_id: null })
      .in("id", ownAccountIds);
  }
  if (ownMembershipIds.length > 0) {
    await admin.from("school_memberships").update({ approved_by: null }).in("approved_by", ownMembershipIds);
    await admin.from("saved_sets").delete().in("owner_membership_id", ownMembershipIds);
  }

  // "Switch", not "add": a testing account always ends with exactly one membership.
  const { error: deleteError } = await admin.from("school_memberships").delete().eq("profile_id", profileId);
  if (deleteError) {
    console.error("[testing-membership] could not delete existing memberships:", deleteError);
    return { ok: false, error: "Could not clear your existing membership" };
  }

  const { data: membership, error: membershipError } = await admin
    .from("school_memberships")
    .insert({
      school_account_id: account.id,
      profile_id: profileId,
      status: "approved",
      is_admin: true,
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (membershipError || !membership) {
    console.error("[testing-membership] could not insert new membership:", membershipError);
    return { ok: false, error: "Could not create a membership for this school" };
  }

  // Unconditional: `account` was read before the cleanup above, so its holder reference
  // can be stale (e.g. re-switching back to a school this account used before, whose old
  // holder was just nulled out). Always leaving a clean holder is right regardless.
  await admin.from("school_accounts").update({ account_holder_membership_id: membership.id }).eq("id", account.id);

  return { ok: true, membershipId: membership.id };
}
