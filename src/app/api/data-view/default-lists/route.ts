import { resolveCaller } from "@/lib/view-as-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDefaultComparatorLists } from "@/lib/default-comparator-lists";

// Member Data View (brief §6): default comparator-list generation for the school
// being viewed. Same gate as /api/data-view/schools and /api/paid-trends -- an
// approved membership at the URN this Data View is FOR.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // 0.8 View as: the one caller helper (src/lib/view-as-server.ts) -- a member of this school (the
  // query this route always made), a platform admin's View as or peek, read-only.
  const caller = await resolveCaller(request, urn, { visibleRow: true, supabase, refusal: "The Data View is available to verified school staff." });
  if (caller instanceof NextResponse) return caller;

  // 0.6.5 S4: the Teacher view's comparator chooser on its Post-16 page asks for the 10
  // nearest with Post-16 provision (post16=1). The Data View never sends it: its call, and
  // its answer, are exactly as before.
  const lists = request.nextUrl.searchParams.get("post16") === "1" ? await buildDefaultComparatorLists(urn, { post16: true }) : await buildDefaultComparatorLists(urn);
  return NextResponse.json(lists);
}
