import { NextRequest, NextResponse } from "next/server";
import { dashViewer } from "@/lib/groups/dash-server";
import { groupDataSource, groupLibraryIndex } from "@/lib/groups/aggregates";

// VicData 0.8 group sets, M3 (brief v2 §4): the groups library's cards. GET ?account=
// Head office only (D2): its own office, or a platform admin through View as or a head-office peek; a
// member school's SMT reads "not found" here, as anyone else does. The cards are production's
// (group_index_lookup); our own group is returned apart, as `us`, and never listed.
export async function GET(request: NextRequest) {
  try {
    const who = await dashViewer(request);
    if (who instanceof NextResponse) return who;
    const { viewer } = who;
    if (viewer.as === "school") return NextResponse.json({ error: "Not found." }, { status: 404 });
    const index = await groupLibraryIndex();
    const us = index.groups.find((c) => c.group_id === viewer.groupId) ?? null;
    return NextResponse.json({
      viewer: { as: viewer.as, accountId: viewer.account.id, groupId: viewer.groupId, name: viewer.account.name, admin: viewer.as === "head_office" && (viewer.account as { role?: string }).role === "head_office_admin" },
      source: groupDataSource(),
      build: index.build,
      us,
      cards: index.groups.filter((c) => c.group_id !== viewer.groupId),
    });
  } catch (err) {
    console.error("[group/library] failed:", err);
    return NextResponse.json({ error: "Could not read the groups library." }, { status: 502 });
  }
}
