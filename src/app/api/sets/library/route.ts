import { NextRequest, NextResponse } from "next/server";
import { resolveCaller } from "@/lib/view-as-server";
import { libraryData } from "@/lib/sets/library";

// VicData 0.8 sets round 1 (D18): the library's sets for one school -- its default sets (computed), its
// school sets and the caller's own (RLS: the caller's reader; a confirmed View as through the server,
// with no personal sets), when each was last used, and the schools' names for search.
//   GET ?urn
export async function GET(request: NextRequest) {
  if (!request.headers.get("authorization")) return NextResponse.json({ error: "Authorization is required" }, { status: 400 });
  const c = await resolveCaller(request, request.nextUrl.searchParams.get("urn"), { refusal: "Sets are for the school's own staff." });
  if (c instanceof NextResponse) return c;
  try {
    return NextResponse.json(await libraryData({ reader: c.reader, supabase: c.supabase, urn: c.urn, userId: c.userId, roles: c.roles, isAdmin: c.isAdmin, isAccountHolder: c.isAccountHolder, viewAs: !!c.viewAsRole }));
  } catch (err) {
    console.error("[sets/library] failed:", err);
    return NextResponse.json({ error: "Could not read the sets." }, { status: 502 });
  }
}
