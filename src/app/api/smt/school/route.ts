import { NextRequest, NextResponse } from "next/server";
import { smtCaller } from "@/lib/smt/auth";
import type { SmtSchool } from "@/lib/smt/school";
import { cachedSmtSchool } from "@/lib/cached-views";

// VicData 0.8 SMT r1: the school as SMT's chips need it -- phases, IGCSE, mixed, boarding, the
// subject areas at GCSE and Post-16, the latest years. GET ?urn. Public data behind the SMT gate.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  // 20 Nov (speed): the school's public data is read alongside the caller check rather than after it (it is
  // the same for every caller, and cached an hour), and is sent only once the check has passed. Through the
  // shared results cache (cached-views.ts), keyed on the URN alone.
  const read: Promise<{ school: SmtSchool | null } | { err: unknown }> | null =
    request.headers.get("authorization") && urn && /^\d{5,7}$/.test(urn) ? cachedSmtSchool(urn).then((school) => ({ school }), (err: unknown) => ({ err })) : null;
  const caller = await smtCaller(request, urn);
  if (caller instanceof NextResponse) return caller;
  const got = await (read ?? cachedSmtSchool(caller.urn).then((school) => ({ school }), (err: unknown) => ({ err })));
  if ("err" in got) {
    console.error("[smt/school] failed:", got.err);
    return NextResponse.json({ error: "Could not load the school." }, { status: 502 });
  }
  if (!got.school) return NextResponse.json({ error: "No such school." }, { status: 404 });
  return NextResponse.json(got.school);
}
