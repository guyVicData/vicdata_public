import { NextRequest, NextResponse } from "next/server";
import { resolveCaller } from "@/lib/view-as-server";
import { readAccountSummary } from "@/lib/school-admin/account-server";
import { accountRows, membershipView, phasesWords, waitingCount } from "@/lib/school-admin/membership";

// VicData 0.8 front door, part 2 (F26, F28; R-ADMIN-BADGE, R-MEMBERSHIP): the School-Admin's account page,
// its membership page and the account menu's badge, for one school.
//   GET ?urn=            the rows (Join requests, People and roles, Teams, School sets, Head office sharing,
//                        Membership) with their summaries and badges, the membership page's view, and
//                        `waiting` (the badge's number)
//   GET ?urn=&waiting=1  only `waiting` and `isSchoolAdmin` (the account menu, on every page)
// For the school's School-Admin or account holder, or a platform admin's View as / peek of a School-Admin
// (read-only). Everyone else: { isSchoolAdmin: false, waiting: 0 } for the menu, 403 for the page.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const urn = sp.get("urn");
  const menu = sp.get("waiting") === "1";
  const c = await resolveCaller(request, urn, { allowed: (r) => r.isAdmin || r.isAccountHolder, refusal: "The school account page is for the School-Admin." });
  if (c instanceof NextResponse) return menu && c.status === 403 ? NextResponse.json({ isSchoolAdmin: false, waiting: 0 }) : c;
  if (!c.isAdmin && !c.isAccountHolder) return menu ? NextResponse.json({ isSchoolAdmin: false, waiting: 0 }) : NextResponse.json({ error: "The school account page is for the School-Admin." }, { status: 403 });
  const today = new Date().toISOString().slice(0, 10);
  try {
    const s = await readAccountSummary(c.reader, { urn: c.urn, today });
    const rows = accountRows(s, today);
    const waiting = waitingCount(rows);
    if (menu) return NextResponse.json({ isSchoolAdmin: true, waiting });
    const phases = phasesWords(s.ages.low, s.ages.high);
    return NextResponse.json({
      school: s.school,
      readOnly: c.readOnly,
      rows,
      waiting,
      who: { people: s.people, activeThisMonth: s.activeThisMonth, roles: s.roles },
      membership: s.membership ? membershipView(s.membership, { phases, today }) : null,
      membershipNotSetUp: s.membershipNotSetUp,
    });
  } catch (err) {
    console.error("[school-admin/account] failed:", err);
    return NextResponse.json({ error: "Could not read the school's account." }, { status: 502 });
  }
}
