import { NextRequest, NextResponse } from "next/server";
import { setFrom, smtCaller } from "@/lib/smt/auth";
import { academicOffer } from "@/lib/smt/academic";
import { cachedAcademic } from "@/lib/cached-views/smt-academic";
import { cachedSmtSchool } from "@/lib/cached-views/smt-school";
import { parseAcademic } from "@/lib/smt/qual-groups";

// VicData 0.8 SMT Academic by qualification: Academic for one state -- the level, the mode (Results ·
// Entries · Value added), the Post-16 qualification group (and DfE's applied type) or the GCSE subject
// area -- against the set. POST { urn, set, level, mode, group, applied, area }. A state the school can't
// show falls back (parseAcademic: an old ?level=whole to the school's main level), never errors. A set of
// kind "nearest" is Default: each qualification group's own nearest 10 offering it.
// Speed plan §4.2 item 2: after the caller check, through the shared results cache (src/lib/cached-views.ts).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { urn?: string; level?: string; mode?: string; group?: string; applied?: string; area?: string } | null;
  const caller = await smtCaller(request, body?.urn ?? null);
  if (caller instanceof NextResponse) return caller;
  const set = setFrom(body);
  if (!set) return NextResponse.json({ error: "set is required" }, { status: 400 });
  try {
    const school = await cachedSmtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    const q = new URLSearchParams();
    for (const k of ["level", "mode", "group", "applied", "area"] as const) if (typeof body?.[k] === "string") q.set(k, body[k]!);
    const state = parseAcademic(q, await academicOffer(school));
    return NextResponse.json(await cachedAcademic(school, state, set));
  } catch (err) {
    console.error("[smt/academic] failed:", err);
    return NextResponse.json({ error: "Could not build the academic view." }, { status: 502 });
  }
}
