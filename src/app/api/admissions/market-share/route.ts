import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
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
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  const sex = sp.get("sex") === "male" || sp.get("sex") === "female" ? (sp.get("sex") as "male" | "female") : "all";
  try {
    const lists = await savedLists(caller.supabase, caller.urn, ep.id);
    return NextResponse.json(await marketView(caller.urn, ep, lists, { filters: filtersFrom(sp), sex }));
  } catch (err) {
    console.error("[admissions/market-share] failed:", err);
    return NextResponse.json({ error: "Could not build market share." }, { status: 502 });
  }
}
