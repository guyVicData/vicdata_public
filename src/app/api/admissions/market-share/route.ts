import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller } from "@/lib/admissions/auth";
import { listsForRoute, setsInUse } from "@/lib/sets/admissions-route";
import { entryPoint } from "@/lib/admissions/entry-points";
import { filtersFrom } from "@/lib/admissions/traits";
import { marketView } from "@/lib/admissions/views-api";

// VicData 0.7 admissions r1 (A5): Market share -- the school's share of the entry age (and its
// age band) across the rivals plus the school, 2019/20-2025/26, with ranks (R-ADM-GROUP-SHARE).
// GET ?urn&entry[&sex]. Rivals: the saved rivals list, else the nearest schools teaching the entry year.
//
// 0.7 r2 (additive): &sector=state|independent and &boarding=1 narrow the rivals (rival-set.ts, the
// same set the rivals' ranks use); `extras` per school and `fe` (an FE college's own ILR series,
// never divided into the group) for the screens (views-api.ts marketView).
// 0.8 sets round 1 (B6-B11): &fset= / &rset= choose the Feeder schools / Compared against set
// (src/lib/sets/admissions-route.ts); the answer names the sets in use (`setChoices`, beside the
// pipeline's own `sets`, its rung sets), for the headers.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  const sex = sp.get("sex") === "male" || sp.get("sex") === "female" ? (sp.get("sex") as "male" | "female") : "all";
  try {
    const chosen = await listsForRoute(caller, ep, sp, ["compared_against"]);
    return NextResponse.json({ ...(await marketView(caller.urn, ep, chosen.lists, { filters: filtersFrom(sp), sex })), setChoices: setsInUse(chosen) });
  } catch (err) {
    console.error("[admissions/market-share] failed:", err);
    return NextResponse.json({ error: "Could not build market share." }, { status: 502 });
  }
}
