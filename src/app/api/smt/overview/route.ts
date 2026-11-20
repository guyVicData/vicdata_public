import { NextRequest, NextResponse } from "next/server";
import { setFrom, smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { cachedOverview } from "@/lib/cached-views";

// VicData 0.8 SMT r1: Overview -- the school now, the scorecard against the set, the region and
// England, the flags, and row 2's trends. POST { urn, set: { kind, label, urns } }: a set is the
// request, not a key (as /api/teacher/chooser-set). 0.8 SMT Academic (R-SMT-NO-PILLS): no filters.
// Speed plan §4.2 item 2: through the shared results cache, keyed on the school, the set and whether a
// head office may see the school's Admissions (src/lib/cached-views.ts).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { urn?: string } | null;
  const caller = await smtCaller(request, body?.urn ?? null);
  if (caller instanceof NextResponse) return caller;
  const set = setFrom(body);
  if (!set) return NextResponse.json({ error: "set is required" }, { status: 400 });
  try {
    const school = await smtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    return NextResponse.json(await cachedOverview(school, set, caller.admissions));
  } catch (err) {
    console.error("[smt/overview] failed:", err);
    return NextResponse.json({ error: "Could not build the overview." }, { status: 502 });
  }
}
