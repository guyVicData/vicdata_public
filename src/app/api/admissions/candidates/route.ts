import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { candidatesView } from "@/lib/admissions/views-api";

// VicData 0.7 admissions r2 (D5): the schools setup offers to tick, with the figures beside each
// (views-api.ts candidatesView). Read-only public data; the caller must be allowed into
// Admissions (admissionsCaller). Saving goes through /api/admissions/lists.
//   GET ?urn&entry&kind=day|boarding|rivals
//       &mode=nearest[&n=15] | radius&km=5 | la&las=885,884 | region | urns&urns=1,2,3
//       [&sector=state|independent][&gender=same][&boarding=1][&ages=11,13] (boarding preps' top age)
//       [&sizes=S,M,L] [&age=N] (the age that matters, for a 16+ rung's own list)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  try {
    return NextResponse.json(await candidatesView(caller.urn, ep, sp));
  } catch (err) {
    console.error("[admissions/candidates] failed:", err);
    return NextResponse.json({ error: "Could not list the schools." }, { status: 502 });
  }
}
