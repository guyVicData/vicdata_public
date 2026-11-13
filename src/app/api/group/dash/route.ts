import { NextRequest, NextResponse } from "next/server";
import { dashViewer, vicdataSchools } from "@/lib/groups/dash-server";
import { groupAggregate, groupComparisons, groupDataSource, groupLibraryIndex, groupSchoolsYear, type Reading } from "@/lib/groups/aggregates";
import { buildOverview, buildSchools, displayName, FOCI, kindsFor, type Focus } from "@/lib/groups/dash";
import { buildAcademic, buildPupils } from "@/lib/groups/dash-r3";
import { groupMembers } from "@/lib/groups/production";
import { GROUP_SET_CAP, groupDefaultOf, nearestInSize, resolveCompare } from "@/lib/groups/group-sets";
import { canKeepSets, isGroupAdmin, readGroupSets, type GroupSetsInfo } from "@/lib/groups/group-sets-server";

// VicData 0.8 groups r2 (A, C, D), r3 (A, P); group sets M4, M5: one group dashboard's data.
// GET ?account=&dash=overview|schools|academic|pupils&reading=at_time|listed_now&focus=all|primary|secondary|post16
//   &compare=<key>   the set compared against (group-sets.ts): a pooled default (peer:<type>:<band>,
//                    non_group:<sector>, sat:all, areas:la, england:all), nearest, set:<uuid>, or
//                    peer_named:a,b (an unsaved set; old links). Old keys map onto these. Absent: the
//                    group's default set while it exists, else the size band (D8).
// Access first (dash-access.ts): head office of the group, a member school's SMT with a live grant,
// or a platform admin in View as; anyone else reads "not found". The figures are the group lookups'
// (aggregates.ts), worded by the pure builders (dash.ts); the sets are read by group-sets-server.ts.
export async function GET(request: NextRequest) {
  try {
    const who = await dashViewer(request);
    if (who instanceof NextResponse) return who;
    const { viewer } = who;
    const q = request.nextUrl.searchParams;
    const dash = (["schools", "academic", "pupils"] as const).find((d) => d === q.get("dash")) ?? "overview";
    const reading: Reading = q.get("reading") === "listed_now" ? "listed_now" : "at_time";
    const focus: Focus = FOCI.includes(q.get("focus") as Focus) ? (q.get("focus") as Focus) : "all";
    const agg = await groupAggregate(viewer.groupId, reading);
    if (!agg) return NextResponse.json({ error: "The group figures aren't available yet.", code: "no-figures" }, { status: 503 });
    const [members, index, read] = await Promise.all([groupMembers(viewer.groupId).catch(() => []), groupLibraryIndex().catch(() => ({ build: null, groups: [] })), readGroupSets(who)]);

    // The sets this viewer may use, and the group's defaults (D8).
    const live = read.sets.filter((s) => !s.archived);
    const sets: GroupSetsInfo = {
      sets: live,
      notSetUp: read.notSetUp,
      personalActive: read.personalActive,
      cap: GROUP_SET_CAP,
      admin: isGroupAdmin(viewer),
      canKeep: canKeepSets(viewer),
      defaults: { group_peers: groupDefaultOf(live, "group_peers")?.id ?? null, group_schools: groupDefaultOf(live, "group_schools")?.id ?? null },
    };

    // The comparison: the address's key (old ones mapped), else the page's default.
    const sector = agg.group.type.startsWith("independent") ? "independent" : "state";
    const bandKey = agg.peer?.set_id ?? null;
    const size = agg.membership.confirmed + agg.membership.likely;
    const us = index.groups.find((c) => c.group_id === viewer.groupId) ?? { group_id: viewer.groupId, type: agg.group.type, schools: size };
    const card = new Map(index.groups.map((c) => [c.group_id, c]));
    const meta = (id: string) => {
      const c = card.get(id);
      return { id, label: c ? displayName(c.name) : id, type: c?.type ?? "unknown", schools: c?.schools ?? 0 };
    };
    const nearest = nearestInSize(index.groups, us).map((c) => meta(c.group_id));
    const { key, compare, groupSet } = resolveCompare(q.get("compare"), { bandKey, sector, ourId: viewer.groupId, sets: live, defaultId: sets.defaults.group_peers, nearest, meta });
    const pass = { groupSet, addressKey: key, nearest };

    const base = {
      viewer: { as: viewer.as, accountId: viewer.account.id, groupId: viewer.groupId, name: viewer.account.name, urn: viewer.as === "school" ? viewer.urn : null },
      source: groupDataSource(),
      membership: members.map((m) => ({ urn: m.urn, name: m.name, confidence: m.confidence, joined: m.joined, lastSeen: m.lastSeen, source: m.source })),
      sets,
      nearest,
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
      // The group-now figures as Overview counts them (Schools has no comparison: its selector is Showing).
      const now = buildOverview({ agg, comps: [], compare: "peer_band", focus });
      return NextResponse.json({ ...base, now, map: mapOf(now.years.census, schools), schools: buildSchools({ agg, schools, focus, members, vicdata, headOffice }) });
    }
    const [comps, schools] = await Promise.all([groupComparisons(viewer.groupId, kindsFor(compare)), groupSchoolsYear(viewer.groupId)]);
    if (dash === "academic" || dash === "pupils") {
      const input = { agg, comps, schools, compare, focus, ...pass };
      const page = dash === "academic" ? { academic: buildAcademic(input) } : { pupils: buildPupils(input) };
      const overview = (page.academic ?? page.pupils)!.overview;
      return NextResponse.json({ ...base, ...page, now: overview, overview, map: mapOf(overview.years.census, schools) });
    }
    const overview = buildOverview({ agg, comps, compare, focus, ...pass });
    // The map: member schools sized by roll, coloured by trend; outside England listed beside it.
    return NextResponse.json({ ...base, overview, map: mapOf(overview.years.census, schools) });
  } catch (err) {
    console.error("[group/dash] failed:", err);
    return NextResponse.json({ error: "Could not build the group dashboard." }, { status: 502 });
  }
}
