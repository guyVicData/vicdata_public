import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { filtersFrom } from "@/lib/admissions/traits";
import { pipelineView } from "@/lib/admissions/views-api";
import { savedCatchmentKm } from "@/lib/smt/catchment-server";

// VicData 0.7 admissions r1 (A5): Pipelines for one entry point -- the pool by entry year (past
// and forward, by source, with ranges), the share needed to hold numbers steady, the sets used,
// the LA blend, and the feeder flags. GET ?urn&entry=11+|4+|16+|age:N[&sex=male|female][&projection=1].
// The school's saved lists when it has them (RLS: the caller's own token), else nearby schools.
//
// 0.7 r2 (additive): the top bar's filters -- &lists=day|boarding (which feeder lists make the
// pool; both by default) and &sector=state|independent (narrows every set; the school's own Year
// 11 stays) -- and what the screens draw, built on the server so the browser recomputes nothing
// (views-api.ts pipelineView). Unfiltered, the round 1 fields are exactly as before.
// 0.8 Admissions fb1: &km= (the funnel's radius), and the school's saved catchment read with the caller's
// token (catchment-server.ts; View as reads it through the server).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  const sex = sp.get("sex") === "male" || sp.get("sex") === "female" ? (sp.get("sex") as "male" | "female") : "all";
  try {
    const [lists, savedKm] = await Promise.all([savedLists(caller.reader, caller.urn, ep.id), savedCatchmentKm({ supabase: caller.reader, headOffice: null, readOnly: caller.readOnly }, caller.urn).catch(() => null)]);
    // 0.8 Admissions fb1 (F-13): &km= is the funnel's and local births' own radius; else the school's catchment.
    return NextResponse.json(await pipelineView(caller.urn, ep, lists, { filters: filtersFrom(sp), sex, projection: sp.get("projection") === "1", catchment: { km: sp.get("km"), savedKm } }));
  } catch (err) {
    console.error("[admissions/pipeline] failed:", err);
    return NextResponse.json({ error: "Could not build the pipeline." }, { status: 502 });
  }
}
