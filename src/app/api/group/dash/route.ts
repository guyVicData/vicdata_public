import { NextRequest, NextResponse } from "next/server";
import { dashViewer, vicdataSchools } from "@/lib/groups/dash-server";
import { groupAggregate, groupComparisons, groupDataSource, groupSchoolsYear, namedCandidates, type Reading } from "@/lib/groups/aggregates";
import { buildOverview, buildSchools, FOCI, kindsFor, parseCompare, type Focus } from "@/lib/groups/dash";
import { buildAcademic, buildPupils } from "@/lib/groups/dash-r3";
import { groupMembers } from "@/lib/groups/production";

// VicData 0.8 groups r2 (A, C, D), r3 (A, P): one group dashboard's data. GET ?account=&dash=overview|schools|academic|pupils
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
    const dash = (["schools", "academic", "pupils"] as const).find((d) => d === q.get("dash")) ?? "overview";
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
    const mapOf = (census: number, schools: Awaited<ReturnType<typeof groupSchoolsYear>>) =>
      schools
      .filter((s) => s.role === "member" && s.years.some((y) => y.listed_now))
      .map((s) => {
        const f = s.years.find((y) => y.period === census)?.figures ?? null;
        return { urn: s.urn, name: s.name ?? s.urn, easting: s.easting, northing: s.northing, roll: f?.roll ?? null, trend: f?.trend["1"] ?? null, outside: s.outside_england, likely: s.confidence === "likely", phases: f?.phases ?? [] };
      });
    if (dash === "schools") {
      const schools = await groupSchoolsYear(viewer.groupId);
      const headOffice = viewer.as !== "school";
      const vicdata = headOffice ? await vicdataSchools(schools.filter((s) => s.role === "member").map((s) => s.urn)) : new Set<string>();
      // The group-now figures as Overview counts them (no comparison needed here).
      const now = buildOverview({ agg, comps: [], compare: "peer_band", focus });
      return NextResponse.json({ ...base, now, map: mapOf(now.years.census, schools), schools: buildSchools({ agg, schools, focus, members, vicdata, headOffice }) });
    }
    if (dash === "academic" || dash === "pupils") {
      const [comps, schools, candidates] = await Promise.all([groupComparisons(viewer.groupId, kindsFor(compare)), groupSchoolsYear(viewer.groupId), namedCandidates(agg.group.group_id, agg.group.type, 0)]);
      const input = { agg, comps, schools, compare, focus, namedLabels: Object.fromEntries(candidates.map((c) => [c.id, c.label])) };
      const page = dash === "academic" ? { academic: buildAcademic(input) } : { pupils: buildPupils(input) };
      const overview = (page.academic ?? page.pupils)!.overview;
      return NextResponse.json({ ...base, ...page, now: overview, overview, map: mapOf(overview.years.census, schools), candidates });
    }
    const [comps, schools, candidates] = await Promise.all([groupComparisons(viewer.groupId, kindsFor(compare)), groupSchoolsYear(viewer.groupId), namedCandidates(agg.group.group_id, agg.group.type, agg.rows.find((r) => r.phase === "all")?.figures.n_schools ?? 0)]);
    const overview = buildOverview({ agg, comps, compare, focus, namedLabels: Object.fromEntries(candidates.map((c) => [c.id, c.label])) });
    // The map: member schools sized by roll, coloured by trend; outside England listed beside it.
    return NextResponse.json({ ...base, overview, map: mapOf(overview.years.census, schools), candidates });
  } catch (err) {
    console.error("[group/dash] failed:", err);
    return NextResponse.json({ error: "Could not build the group dashboard." }, { status: 502 });
  }
}
