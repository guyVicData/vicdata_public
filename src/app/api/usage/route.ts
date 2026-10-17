// VicData 0.8 shell + SMT r1, B7: a member's page view or full-screen open, logged (src/lib/usage.ts).
// The caller is the session's member at the school (never a platform admin's View as: 0.8 View as); the
// browser says only what was shown. Always 204: logging never fails a page.
import { NextResponse, type NextRequest } from "next/server";
import { parseUsageReport, writeUsageEvent } from "@/lib/usage";
import { resolveCaller } from "@/lib/view-as-server";

const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const report = parseUsageReport(await request.json().catch(() => null));
  if (!auth || !report) return done();
  try {
    // 0.8 View as: the one caller helper. Only a member's own view counts as the school's usage: a
    // platform admin's View as, a peek and head office are never logged (before this round a platform
    // admin's View as wrote a "platform_admin" row against the school).
    const c = await resolveCaller(request, report.urn, { refusal: "" });
    if (c instanceof NextResponse || c.access !== "member") return done();
    // The role the page is for, where the member holds it; else their first.
    const roles = c.roles;
    const role = (report.product === "smt" || report.product === "groups") && roles.includes("smt") ? "smt" : report.product === "admissions" && roles.includes("admissions") ? "admissions" : roles.includes("teacher") && report.product === "teacher" ? "teacher" : c.isAdmin ? "school_admin" : (roles[0] ?? null);
    await writeUsageEvent(report, { membershipId: c.membershipId, role });
  } catch {
    // Not logged.
  }
  return done();
}
