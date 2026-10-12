import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { buildMarketShare } from "@/lib/admissions/market";
import { rivalsFromLists } from "@/lib/admissions/lists";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";

// VicData 0.7 admissions r1 (A5): Market share -- the school's share of the entry age (and its
// age band) across the rivals plus the school, 2019/20-2025/26, with ranks (R-ADM-GROUP-SHARE).
// GET ?urn&entry[&sex]. Rivals: the saved rivals list, else the nearest schools teaching the entry year.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  const sex = sp.get("sex") === "male" || sp.get("sex") === "female" ? (sp.get("sex") as "male" | "female") : "all";
  try {
    const lists = await savedLists(caller.supabase, caller.urn, ep.id);
    const m = await buildMarketShare(caller.urn, ep, { rivals: rivalsFromLists(lists), sex });
    return NextResponse.json({ ...m, note: ADMISSIONS_NOTES.groupShare });
  } catch (err) {
    console.error("[admissions/market-share] failed:", err);
    return NextResponse.json({ error: "Could not build market share." }, { status: 502 });
  }
}
