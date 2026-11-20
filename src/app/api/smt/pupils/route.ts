import { NextRequest, NextResponse } from "next/server";
import { setFrom, smtCaller } from "@/lib/smt/auth";
import { cachedPupils, cachedSmtSchool } from "@/lib/cached-views";
import { parseLevel } from "@/lib/smt/levels";

// VicData 0.8 SMT r2: Pupils -- the roll now, shape and size, Admissions' entry points, leaving at 16
// and market share (read-only), and row 2's trends. POST { urn, set, level }.
// 0.8 SMT Academic (R-SMT-NO-PILLS): no filters; girls and boys, and day and boarding, are views.
// Speed plan §4.2 item 2: through the shared results cache, keyed on the school's saved Admissions
// entry points and lists as this caller reads them (src/lib/cached-views.ts).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { urn?: string; level?: string } | null;
  const caller = await smtCaller(request, body?.urn ?? null);
  if (caller instanceof NextResponse) return caller;
  const set = setFrom(body);
  if (!set) return NextResponse.json({ error: "set is required" }, { status: 400 });
  try {
    const school = await cachedSmtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    const level = parseLevel(new URLSearchParams(body?.level ? { level: body.level } : {}), school.phases, null);
    return NextResponse.json(await cachedPupils(school, set, level, caller.admissions));
  } catch (err) {
    console.error("[smt/pupils] failed:", err);
    return NextResponse.json({ error: "Could not build the pupils view." }, { status: 502 });
  }
}
