import { NextRequest, NextResponse } from "next/server";
import { accountGrants, groupCaller, NOT_FOUND, officeFor, schoolAccounts } from "@/lib/groups/server";
import { groupMembers } from "@/lib/groups/production";
import { canManageAccess, membersOf, rollSummary, seeingCount } from "@/lib/groups/access-rules";
import { cachedCensus } from "@/lib/admissions/data";
import { ROLL_DIRECTION_SPAN } from "@/catalogue/years";

// VicData 0.8 groups r1 (G3): the head-office home. The group's one-line summary (from the production
// lookups and the census: no new aggregate yet), its member schools (each opening that school's SMT
// read-only where the school holds VicData, else its public page) and the Access count.
// GET ?account=. Another group's account, or none of the caller's, is "not found".
export async function GET(request: NextRequest) {
  try {
    const caller = await groupCaller(request);
    if (caller instanceof NextResponse) return caller;
    const office = officeFor(caller, request.nextUrl.searchParams.get("account"));
    if (!office) return NOT_FOUND();
    const members = await groupMembers(membersOf(office));
    const urns = members.map((m) => m.urn);
    const [grants, accounts, census] = await Promise.all([accountGrants(office.id), schoolAccounts(urns), cachedCensus(urns)]);
    const P = Math.max(...Array.from(census.values()).map((c) => c.latestPeriod ?? 0));
    const rollIn = (urn: string, p: number) => {
      const ag = census.get(urn)?.ageGenderByPeriod.get(p);
      if (!ag) return null;
      let t = 0;
      for (const v of ag.values()) t += v.male + v.female;
      return t;
    };
    // R-ROLL-WORDS-3YR: the combined roll this census against 3 years before, over the schools with both.
    const summary = rollSummary(urns.map((u) => ({ urn: u, now: rollIn(u, P), before: rollIn(u, P - ROLL_DIRECTION_SPAN) })));
    return NextResponse.json({
      office,
      viewAs: caller.viewAs,
      canManage: canManageAccess(office, caller.viewAs),
      summary: { ...summary, period: Number.isFinite(P) && P > 0 ? P : null },
      access: seeingCount(office, members, grants),
      schools: members.map((m) => ({ urn: m.urn, name: m.name, likely: m.confidence === "likely", vicdata: accounts.has(m.urn) })).sort((a, b) => a.name.localeCompare(b.name)),
      source: members[0]?.source ?? null,
      lastSeen: members.reduce<string | null>((d, m) => (m.lastSeen && (!d || m.lastSeen > d) ? m.lastSeen : d), null),
    });
  } catch (err) {
    console.error("[group/home] failed:", err);
    return NextResponse.json({ error: "Could not build the group's home." }, { status: 502 });
  }
}
