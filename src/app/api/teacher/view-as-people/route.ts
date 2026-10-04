import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { viewAsForRequest } from "@/lib/view-as";

// 0.6 snag 4 (B): People and Teams, READ-ONLY, for a platform admin viewing a school as its
// School-Admin. A School-Admin reads these straight from the tables under RLS; Guy isn't a
// member of the school, so his RLS shows nothing, and no table gains a policy for him. This
// route reads exactly what the School-Admin's own People and Teams queries read -- after
// confirming a platform admin AND a School-Admin View as of this school -- and writes
// nothing: every save button on those screens is off in View as.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const viewAs = await viewAsForRequest(supabase, request, urn);
  if (!viewAs || viewAs.role !== "school_admin") return NextResponse.json({ error: "Only your School-Admin can manage people." }, { status: 403 });

  const svc = createServiceRoleSupabaseClient();
  const { data: account } = await svc.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>();
  if (!account) return NextResponse.json({ members: [], teams: [] });
  const [m, t] = await Promise.all([
    svc.from("school_memberships").select("id, status, role, roles, job_title, is_admin, profiles(email, full_name)").eq("school_account_id", account.id),
    svc.from("teams").select("id, name, auto_key, created_at, team_members(membership_id)").eq("school_account_id", account.id).order("created_at"),
  ]);
  if (m.error || t.error) return NextResponse.json({ error: "Could not load this school's people." }, { status: 502 });
  return NextResponse.json({ members: m.data ?? [], teams: t.data ?? [] });
}
