import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { grantApprovedMembership } from "@/lib/testing-membership";

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

  // The membership work -- including the four-foreign-key cleanup documented above, found
  // by live testing rather than code review -- now lives in one place, shared with
  // /api/testing/preview-session, which needs exactly the same thing. It was extracted
  // from here unchanged rather than reimplemented there.
  const admin = createServiceRoleSupabaseClient();
  const result = await grantApprovedMembership(admin, profileId, urn);
  if (!result.ok) {
    const status = result.error === "Unknown school" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ urn });
}
