import { NextRequest, NextResponse } from "next/server";
import { smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { traced } from "@/lib/build-trace";
import { cachedSmtSchool } from "@/lib/cached-views";

// VicData 0.8 SMT r1: the school as SMT's chips need it -- phases, IGCSE, mixed, boarding, the
// subject areas at GCSE and Post-16, the latest years. GET ?urn. Public data behind the SMT gate.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  // 20 Nov (speed): the school's public data is read alongside the caller check rather than after it (it is
  // the same for every caller, and cached an hour in memory), and is sent only once the check has passed. Only
  // then does the shared results cache (cached-views.ts, keyed on the URN alone) see it -- a refused request
  // never reads or writes the store -- reusing the read already under way.
  const early = request.headers.get("authorization") && urn && /^\d{5,7}$/.test(urn) ? traced(() => smtSchool(urn)) : null;
  early?.promise.catch(() => {}); // a refused caller never awaits it
  const caller = await smtCaller(request, urn);
  if (caller instanceof NextResponse) return caller;
  const got = await cachedSmtSchool(caller.urn, early ?? undefined).then((school) => ({ school }), (err: unknown) => ({ err }));
  if ("err" in got) {
    console.error("[smt/school] failed:", got.err);
    return NextResponse.json({ error: "Could not load the school." }, { status: 502 });
  }
  if (!got.school) return NextResponse.json({ error: "No such school." }, { status: 404 });
  return NextResponse.json(got.school);
}
