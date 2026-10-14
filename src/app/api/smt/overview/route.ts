import { NextRequest, NextResponse } from "next/server";
import { setFrom, smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { buildOverview, DEFAULT_SMT_FILTERS, type SmtFilters } from "@/lib/smt/overview";

// VicData 0.8 SMT r1: Overview -- the school now, the scorecard against the set, the region and
// England, the flags, and row 2's trends. POST { urn, set: { kind, label, urns }, filters? }: a set
// is the request, not a key (as /api/teacher/chooser-set).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { urn?: string; filters?: Partial<SmtFilters> } | null;
  const caller = await smtCaller(request, body?.urn ?? null);
  if (caller instanceof NextResponse) return caller;
  const set = setFrom(body);
  if (!set) return NextResponse.json({ error: "set is required" }, { status: 400 });
  const f = body?.filters ?? {};
  const filters: SmtFilters = {
    sex: f.sex === "female" || f.sex === "male" ? f.sex : DEFAULT_SMT_FILTERS.sex,
    boarding: f.boarding === "day" || f.boarding === "boarding" ? f.boarding : DEFAULT_SMT_FILTERS.boarding,
  };
  try {
    const school = await smtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    return NextResponse.json(await buildOverview(school, set, filters, caller.admissions));
  } catch (err) {
    console.error("[smt/overview] failed:", err);
    return NextResponse.json({ error: "Could not build the overview." }, { status: 502 });
  }
}
