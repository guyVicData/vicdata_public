import { NextRequest, NextResponse } from "next/server";
import { smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { buildContext } from "@/lib/smt/context";
import { buildContextMap } from "@/lib/smt/context-map";
import { parseLevel } from "@/lib/smt/levels";

// VicData 0.8 SMT r3 (K3): Context's neighbourhood map -- the LSOAs around the school with their
// boundaries and figures, and the schools nearby with their FSM. GET ?urn&level=. Answers
// { state: "fallback" } until the LSOA boundaries are loaded (the map then draws round 2's LAs).
// Public data behind the SMT gate, as /api/smt/context.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await smtCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  try {
    const school = await smtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    const level = parseLevel(sp, school.phases, null).phase;
    const c = await buildContext(school, "around", level);
    return NextResponse.json(await buildContextMap(school, level, c.map.schools));
  } catch (err) {
    console.error("[smt/context/map] failed:", err);
    return NextResponse.json({ error: "Could not build the map." }, { status: 502 });
  }
}
