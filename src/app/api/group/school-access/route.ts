import { NextRequest, NextResponse } from "next/server";
import { headOfficeAccess, NOT_FOUND, userFrom } from "@/lib/groups/server";
import { groupNote } from "@/catalogue/notes";

// VicData 0.8 groups r1 (G2): may the signed-in head office open this school's SMT, read-only? Only a
// current member school of one of their active group accounts, with its own VicData membership.
// Anything else is "not found". GET ?urn=.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  if (!urn || !/^\d{5,7}$/.test(urn)) return NextResponse.json({ error: "urn is required" }, { status: 400 });
  try {
    const u = await userFrom(request);
    if (u instanceof NextResponse) return u;
    const r = await headOfficeAccess(u.supabase, u.userId, urn);
    if (!r.ok) return NOT_FOUND();
    return NextResponse.json({ urn, schoolName: r.schoolName, accountId: r.office.id, groupName: r.office.name, likely: r.likely, admissions: r.shared ? "shared" : "private", note: groupNote("headOfficeReadOnly", { group: r.office.name }) });
  } catch (err) {
    console.error("[group/school-access] failed:", err);
    return NextResponse.json({ error: "Could not check access." }, { status: 502 });
  }
}
