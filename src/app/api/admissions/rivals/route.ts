import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { filtersFrom } from "@/lib/admissions/traits";
import { rivalsView } from "@/lib/admissions/views-api";
import { latestSubjectNameOrNull } from "@/lib/subject-latest-names";

// VicData 0.7 admissions r1 (A5): the rivals -- ranks (headline, subject area; subject when one is
// asked for), size, shape, momentum flags, and the school's strengths and weaknesses by area.
// GET ?urn&entry[&subject&family&qual&measure=points|entries|threshold] (subject: GCSE / Post-16).
//
// 0.7 r2 (additive): the same rival set as Market share (&sector, &boarding: rival-set.ts);
// `resultsChange` per school (the momentum scatter's y) and `areaLabels` (views-api.ts rivalsView).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  try {
    const lists = await savedLists(caller.reader, caller.urn, ep.id);
    return NextResponse.json(await rivalsView(caller.urn, ep, lists, { filters: filtersFrom(sp), subject: latestSubjectNameOrNull(sp.get("subject")), family: sp.get("family"), qual: sp.get("qual"), measure: sp.get("measure") }));
  } catch (err) {
    console.error("[admissions/rivals] failed:", err);
    return NextResponse.json({ error: "Could not build the rivals." }, { status: 502 });
  }
}
