import { NextRequest, NextResponse } from "next/server";
import { dashViewer } from "@/lib/groups/dash-server";
import { groupAggregate, groupDataSource, groupLibraryIndex, groupSchoolsYear } from "@/lib/groups/aggregates";
import { libraryGroupPage } from "@/lib/groups/library-page";

// VicData 0.8 group sets, M3: one group's page in the library -- its card, its schools as the tracklist,
// its map, and its same-type rank (R-GROUP-RANK-SAME-TYPE). GET ?account=&id=<group id>
// Head office only, as the library. Only listed groups (the index's cards) open: a sponsor record, a
// single-academy trust, a self-declared or a non-mainstream group reads "not found".
export async function GET(request: NextRequest) {
  try {
    const who = await dashViewer(request);
    if (who instanceof NextResponse) return who;
    if (who.viewer.as === "school") return NextResponse.json({ error: "Not found." }, { status: 404 });
    const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
    if (!/^[\w:.-]{1,80}$/.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const index = await groupLibraryIndex();
    const card = index.groups.find((c) => c.group_id === id);
    if (!card) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const [agg, schools] = await Promise.all([groupAggregate(id, "at_time"), groupSchoolsYear(id)]);
    return NextResponse.json({ source: groupDataSource(), viewer: { as: who.viewer.as, accountId: who.viewer.account.id }, ...libraryGroupPage(card, agg, schools, index.groups.find((c) => c.group_id === who.viewer.groupId) ?? null) });
  } catch (err) {
    console.error("[group/library/group] failed:", err);
    return NextResponse.json({ error: "Could not read the group." }, { status: 502 });
  }
}
