// VicData 0.8 shell + SMT r1, B7: a member's page view or full-screen open, logged (src/lib/usage.ts).
// The caller is the session's member at the school, or a platform admin there through View as; the
// browser says only what was shown. Always 204: logging never fails a page.
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { parseUsageReport, writeUsageEvent } from "@/lib/usage";
import { isPlatformAdmin } from "@/lib/view-as";

const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const report = parseUsageReport(await request.json().catch(() => null));
  if (!auth || !report) return done();
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: user } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const userId = user.user?.id;
    if (!userId) return done();
    const { data } = await supabase
      .from("school_memberships")
      .select("id, roles, is_admin, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
      .eq("profile_id", userId)
      .eq("status", "approved")
      .eq("school_accounts.school_urn", report.urn)
      .limit(1)
      .maybeSingle<{ id: string; roles: string[] | null; is_admin: boolean | null }>();
    if (data) {
      // The role the page is for, where the member holds it; else their first.
      const roles = data.roles ?? [];
      const role = report.product === "smt" && roles.includes("smt") ? "smt" : report.product === "admissions" && roles.includes("admissions") ? "admissions" : roles.includes("teacher") && report.product === "teacher" ? "teacher" : data.is_admin ? "school_admin" : (roles[0] ?? null);
      await writeUsageEvent(report, { membershipId: data.id, role });
    } else if (await isPlatformAdmin(supabase)) {
      await writeUsageEvent(report, { membershipId: null, role: "platform_admin" });
    }
  } catch {
    // Not logged.
  }
  return done();
}
