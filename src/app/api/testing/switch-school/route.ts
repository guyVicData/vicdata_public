import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

// Testing-only convenience (2026-09-05, per direct request): lets Guy's own account
// jump between schools to exercise the Data View's filters/lists from many different
// school-type angles (independent boarding, state day, FE college, through-school...)
// without a separate real membership per school. NOT a member-facing feature -- see
// this repo's own docs/vicdata_data_view_open_questions.md for the schema-confirmation
// and gating decision this implements.
//
// Real schema, confirmed by reading supabase/migrations/20260807092000_school_accounts_
// and_memberships.sql directly rather than assuming: there is no single "which school"
// field on a profile at all -- the link is a join, `school_memberships.profile_id` ->
// `school_accounts.id` -> `school_accounts.school_urn`, gated by
// `school_memberships.status = 'approved'`. "Switching schools" for a real member would
// mean a whole new join-and-get-approved flow; this route is a shortcut that skips
// straight to the end state (an approved membership, immediately) purely for testing.
//
// Gated behind ENABLE_TESTING_SCHOOL_SWITCHER, unset/false by default in every real
// environment -- checked server-side here (never bundled into client JS) AND the
// client only shows the picker when its own NEXT_PUBLIC_ counterpart is set, so the
// control isn't even visible, let alone callable, unless BOTH are deliberately turned
// on for this specific environment. The route also only ever touches the CALLING
// user's own profile_id (resolved from their own verified token, never client-supplied)
// -- even if this were somehow reachable by someone else, it can't touch another
// profile's data.
//
// "Switch," not "add": deletes every existing school_memberships row for this profile
// before inserting the new one, so a testing account always has exactly one
// membership, matching "I want to switch which school my account is linked to" rather
// than accumulating a membership per school tested. Logged as a decision, not
// obviously the only reasonable reading, but the one the request's own wording points
// to most directly.
export async function POST(request: NextRequest) {
  if (process.env.ENABLE_TESTING_SCHOOL_SWITCHER !== "true") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Authorization is required" }, { status: 400 });
  }
  const { urn } = (await request.json()) as { urn?: string };
  if (!urn) {
    return NextResponse.json({ error: "urn is required" }, { status: 400 });
  }

  const callerClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const profileId = userData.user.id;

  const { data: school } = await callerClient.from("schools").select("urn").eq("urn", urn).maybeSingle();
  if (!school) {
    return NextResponse.json({ error: "Unknown school" }, { status: 404 });
  }

  // Service-role from here -- deliberately bypasses the ordinary join-and-wait RLS
  // policies (school_memberships_insert_own only lets a member insert their own
  // PENDING row; there's no policy letting a plain member self-approve or move an
  // existing row to a school they're not already admin/holder at). That's the whole
  // point of this being a real shortcut, not a client-side trick against RLS.
  const admin = createServiceRoleSupabaseClient();

  let { data: account } = await admin.from("school_accounts").select("id, account_holder_membership_id").eq("school_urn", urn).maybeSingle();
  if (!account) {
    const { data: created, error: createError } = await admin
      .from("school_accounts")
      .insert({ school_urn: urn, tier: "individual" })
      .select("id, account_holder_membership_id")
      .single();
    if (createError || !created) {
      return NextResponse.json({ error: "Could not create a school account for this school" }, { status: 500 });
    }
    account = created;
  }

  // 2026-09-05, two real bugs found and fixed via live end-to-end tests (not just code
  // review) -- deleting a membership row can be blocked by FOUR separate foreign keys
  // across the schema, confirmed by grepping every migration for
  // "references public.school_memberships" rather than guessing: school_accounts'
  // account_holder_membership_id and pending_account_holder_membership_id (neither
  // has an ON DELETE action, so Postgres defaults to RESTRICT), school_memberships'
  // own self-referencing approved_by, and saved_sets' owner_membership_id. The first
  // attempt at this route only cleared the school_accounts columns and didn't check
  // the delete's own error -- it silently failed (a saved_sets row this same testing
  // session had created at the old school blocked it) and the account page ended up
  // showing two schools instead of "switching." All four are cleared/removed here,
  // then the delete's result is actually checked.
  const { data: ownMemberships } = await admin.from("school_memberships").select("id, school_account_id").eq("profile_id", profileId);
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

  const { error: deleteError } = await admin.from("school_memberships").delete().eq("profile_id", profileId);
  if (deleteError) {
    console.error("[switch-school] could not delete existing memberships:", deleteError);
    return NextResponse.json({ error: "Could not clear your existing membership" }, { status: 500 });
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
    console.error("[switch-school] could not insert new membership:", membershipError);
    return NextResponse.json({ error: "Could not create a membership for this school" }, { status: 500 });
  }

  // Unconditional, not "only if not already set" -- `account.account_holder_membership_id`
  // was read before the cleanup above, so it can be stale (e.g. re-switching back to a
  // school this same testing account used before, whose old holder reference was just
  // nulled out a few lines up). Always making the switch leave a clean, unambiguous
  // holder is also just the right behaviour for a testing tool regardless.
  await admin.from("school_accounts").update({ account_holder_membership_id: membership.id }).eq("id", account.id);

  return NextResponse.json({ urn });
}
