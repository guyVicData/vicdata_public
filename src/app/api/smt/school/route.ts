import { NextRequest, NextResponse } from "next/server";
import { smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";

// VicData 0.8 SMT r1: the school as SMT's chips need it -- phases, IGCSE, mixed, boarding, the
// subject areas at GCSE and Post-16, the latest years. GET ?urn. Public data behind the SMT gate.
export async function GET(request: NextRequest) {
  const caller = await smtCaller(request, request.nextUrl.searchParams.get("urn"));
  if (caller instanceof NextResponse) return caller;
  try {
    const school = await smtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    return NextResponse.json(school);
  } catch (err) {
    console.error("[smt/school] failed:", err);
    return NextResponse.json({ error: "Could not load the school." }, { status: 502 });
  }
}
