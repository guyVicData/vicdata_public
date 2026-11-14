import { NextRequest, NextResponse } from "next/server";
import { dashViewer, vicdataSchools } from "@/lib/groups/dash-server";
import { groupAggregate, groupComparisons, groupDataSource, groupLibraryIndex, groupSchoolsYear, type Reading } from "@/lib/groups/aggregates";
import { FOCI, type Focus } from "@/lib/groups/dash";
import { dashPayload } from "@/lib/groups/dash-payload";
import { groupMembers } from "@/lib/groups/production";
import { canKeepSets, isGroupAdmin, readGroupSets } from "@/lib/groups/group-sets-server";

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
    const [members, index, read] = await Promise.all([groupMembers(viewer.groupId).catch(() => []), groupLibraryIndex().catch(() => ({ build: null, groups: [], non_mainstream: [] })), readGroupSets(who)]);
    // The sets this viewer may use (the reads stay here, after access); the page's answer is dashPayload's.
    return NextResponse.json(
      await dashPayload({
        dash,
        reading,
        focus,
        compareRaw: q.get("compare"),
        viewer,
        agg,
        members,
        index,
        read,
        admin: isGroupAdmin(viewer),
        canKeep: canKeepSets(viewer),
        source: groupDataSource(),
        comparisons: (kinds) => groupComparisons(viewer.groupId, kinds),
        schoolsYear: () => groupSchoolsYear(viewer.groupId),
        vicdataSchools,
      }),
    );
  } catch (err) {
    console.error("[group/dash] failed:", err);
    return NextResponse.json({ error: "Could not build the group dashboard." }, { status: 502 });
  }
}
