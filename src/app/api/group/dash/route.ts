import { NextRequest, NextResponse } from "next/server";
import { dashViewer, vicdataSchools } from "@/lib/groups/dash-server";
import { groupAggregate, groupComparisons, groupDataSource, groupSchoolsYear, type Reading } from "@/lib/groups/aggregates";
import { buildOverview, buildSchools, FOCI, kindsFor, parseCompare, type Focus } from "@/lib/groups/dash";
import { groupMembers } from "@/lib/groups/production";

// VicData 0.8 groups r2 (A, C, D): one group dashboard's data. GET ?account=&dash=overview|schools
// &reading=at_time|listed_now&compare=<kind | peer_named:a,b>&focus=all|primary|secondary|post16.
// Access first (dash-access.ts): head office of the group, a member school's SMT with a live grant,
// or a platform admin in View as; anyone else reads "not found". The figures are the group lookups'
// (aggregates.ts), worded by the pure builders (dash.ts).
export async function GET(request: NextRequest) {
  try {
    const who = await dashViewer(request);
    if (who instanceof NextResponse) return who;
    const { viewer } = who;
    const q = request.nextUrl.searchParams;
    const dash = q.get("dash") === "schools" ? "schools" : "overview";
    const reading: Reading = q.get("reading") === "listed_now" ? "listed_now" : "at_time";
    const focus: Focus = FOCI.includes(q.get("focus") as Focus) ? (q.get("focus") as Focus) : "all";
    const compare = parseCompare(q.get("compare"));
    const agg = await groupAggregate(viewer.groupId, reading);
    if (!agg) return NextResponse.json({ error: "The group figures aren't available yet.", code: "no-figures" }, { status: 503 });
    const members = await groupMembers(viewer.groupId).catch(() => []);
    const base = {
      viewer: { as: viewer.as, accountId: viewer.account.id, groupId: viewer.groupId, name: viewer.account.name, urn: viewer.as === "school" ? viewer.urn : null },
      source: groupDataSource(),
      membership: members.map((m) => ({ urn: m.urn, name: m.name, confidence: m.confidence, joined: m.joined, lastSeen: m.lastSeen, source: m.source })),
    };
    if (dash === "schools") {
      const schools = await groupSchoolsYear(viewer.groupId);
      const headOffice = viewer.as !== "school";
      const vicdata = headOffice ? await vicdataSchools(schools.filter((s) => s.role === "member").map((s) => s.urn)) : new Set<string>();
      return NextResponse.json({ ...base, schools: buildSchools({ agg, schools, focus, members, vicdata, headOffice }) });
    }
    const [comps, schools] = await Promise.all([groupComparisons(viewer.groupId, kindsFor(compare)), groupSchoolsYear(viewer.groupId)]);
    const overview = buildOverview({ agg, comps, compare, focus });
    // The map: member schools sized by roll, coloured by trend; outside England listed beside it.
    const census = overview.years.census;
    const map = schools
      .filter((s) => s.role === "member" && s.years.some((y) => y.listed_now))
      .map((s) => {
        const f = s.years.find((y) => y.period === census)?.figures ?? null;
        return { urn: s.urn, name: s.name ?? s.urn, easting: s.easting, northing: s.northing, roll: f?.roll ?? null, trend: f?.trend["1"] ?? null, outside: s.outside_england, likely: s.confidence === "likely", phases: f?.phases ?? [] };
      });
    return NextResponse.json({ ...base, overview, map });
  } catch (err) {
    console.error("[group/dash] failed:", err);
    return NextResponse.json({ error: "Could not build the group dashboard." }, { status: 502 });
  }
}
