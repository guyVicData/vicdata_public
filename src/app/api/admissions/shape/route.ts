import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller } from "@/lib/admissions/auth";
import { listsForRoute, setsInUse } from "@/lib/sets/admissions-route";
import { entryPoint } from "@/lib/admissions/entry-points";
import { filtersFrom } from "@/lib/admissions/traits";
import { shapeView } from "@/lib/admissions/views-api";

// VicData 0.7 admissions r1 (A5): shape and size -- the school's shape each year since 2019/20 (its
// stability), its roll by phase with the XS-XL badges, the feeder area's local shape, and the
// rivals' shapes (described, never ranked: R-ADM-SHAPE-NOT-RANKED). GET ?urn&entry.
//
// 0.7 r2 (additive): the counts the screens draw (profiles, the local profile, each rival's
// profile and XS-XL) and Market share's rival set (&sector, &boarding) (views-api.ts shapeView).
// 0.8 sets round 1 (B6-B11): &fset= / &rset= choose the Feeder schools / Compared against set
// (src/lib/sets/admissions-route.ts); the answer names the sets in use (`setChoices`, beside the
// pipeline's own `sets`, its rung sets), for the headers.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  try {
    const chosen = await listsForRoute(caller, ep, sp, ["feeders", "compared_against"]);
    return NextResponse.json({ ...(await shapeView(caller.urn, ep, chosen.lists, { filters: filtersFrom(sp) })), setChoices: setsInUse(chosen) });
  } catch (err) {
    console.error("[admissions/shape] failed:", err);
    return NextResponse.json({ error: "Could not build shape and size." }, { status: 502 });
  }
}
