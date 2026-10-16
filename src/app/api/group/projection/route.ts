import { NextRequest, NextResponse } from "next/server";
import { dashViewer } from "@/lib/groups/dash-server";
import { groupSchoolsYear } from "@/lib/groups/aggregates";
import { schoolProjections } from "@/lib/groups/projections";

// VicData 0.8 groups r3 (P): the children around each member school, projected -- each school at its own
// saved catchment, else its default (round 4's rules), from the ingest's area_projection. Shown per school:
// the existing functions give each area's total, so a sum would count a neighbourhood near two schools
// twice (logged: an ingest function over several schools' catchments would count each once). Same access
// as the dashboards. GET ?account=
export async function GET(request: NextRequest) {
  try {
    const who = await dashViewer(request);
    if (who instanceof NextResponse) return who;
    const schools = await groupSchoolsYear(who.viewer.groupId);
    return NextResponse.json({ rows: await schoolProjections(schools) });
  } catch (err) {
    console.error("[group/projection] failed:", err);
    return NextResponse.json({ error: "Could not read the projections." }, { status: 502 });
  }
}
