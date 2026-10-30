import { NextRequest, NextResponse } from "next/server";
import { smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { buildContext } from "@/lib/smt/context";
import { parseLevel } from "@/lib/smt/levels";
import { resolveCatchment } from "@/lib/smt/catchment";
import { savedCatchmentKm } from "@/lib/smt/catchment-server";
import { withDensity } from "@/lib/smt/catchment-density";

// VicData 0.8 SMT r2: Context -- the area around the school: children, births, projections, schools
// nearby, the map, population by age. GET ?urn&area=around|la&level=. Public data behind the SMT gate.
// 0.8 SMT r3: the level picks the ages (levelAges); one the school lacks falls back to Whole school.
// 0.8 SMT r4 (R): &km= is this view's own radius; without it, the school's saved catchment, else the
// default by its type; always within its cap (catchment.ts).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await smtCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  try {
    const school = await smtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    const level = parseLevel(sp, school.phases, null).phase;
    // 0.8 Admissions fb1: a state school's default is its density radius (catchment.ts).
    const catchment = resolveCatchment(await withDensity(caller.urn, school), sp.get("km"), await savedCatchmentKm(caller, caller.urn));
    return NextResponse.json(await buildContext(school, sp.get("area") === "la" ? "la" : "around", level, catchment));
  } catch (err) {
    console.error("[smt/context] failed:", err);
    return NextResponse.json({ error: "Could not build the context view." }, { status: 502 });
  }
}
