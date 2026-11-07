import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { menuForRoute } from "@/lib/sets/admissions-route";

// VicData 0.8 sets round 1 (B7): the set menu for one Admissions page.
//   GET ?urn&entry&kind=feeders|compared_against[&key=<the current choice>]
// Default (the recipes), the school's sets, and the caller's own ("n of 8"), only those that fit the
// page; the current set ticked. Read with the caller's reader (RLS; View as through the server, with
// no personal sets).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  const kind = sp.get("kind");
  if (!ep || (kind !== "feeders" && kind !== "compared_against")) return NextResponse.json({ error: "entry and kind (feeders | compared_against) are required" }, { status: 400 });
  try {
    return NextResponse.json(await menuForRoute(caller, ep, kind, sp.get("key")));
  } catch (err) {
    console.error("[admissions/sets] failed:", err);
    return NextResponse.json({ error: "Could not list the sets." }, { status: 502 });
  }
}
