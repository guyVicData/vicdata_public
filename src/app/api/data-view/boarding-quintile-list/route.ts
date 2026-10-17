import { resolveCaller } from "@/lib/view-as-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildBoardingQuintileList, keepWithKs5Results } from "@/lib/default-comparator-lists";

// Member Data View (brief §6.1): List 3's boarding-quintile recipe, split into its
// own lazy endpoint -- real, measured at ~41s even after parallelising the batched
// census fetch (see default-comparator-lists.ts's own comment) -- the sidebar's
// initial load (/api/data-view/default-lists) never blocks on this; it's only called
// once a member actually selects the boarding-quintile option.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const authHeader = request.headers.get("authorization");
  if (!urn || !authHeader) {
    return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  }
  // 2026-09-08, Compared-with panel round 4: optional ?count, for the Boarding
  // schools button's own "+5 more" control -- defaults to the original 10 when
  // absent, so every existing caller is unaffected.
  const countParam = request.nextUrl.searchParams.get("count");
  const count = countParam ? Math.max(10, parseInt(countParam, 10) || 10) : 10;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // 0.8 View as: the one caller helper (src/lib/view-as-server.ts) -- a member of this school (the
  // query this route always made), a platform admin's View as or peek, read-only.
  const caller = await resolveCaller(request, urn, { visibleRow: true, supabase, refusal: "The Data View is available to verified school staff." });
  if (caller instanceof NextResponse) return caller;

  // 0.6.5 S4: post16=1 (the Teacher chooser's Post-16 stepper only): its schools with KS5
  // results. The Data View never sends it.
  const built = await buildBoardingQuintileList(urn, count);
  const list3 = built && request.nextUrl.searchParams.get("post16") === "1" ? await keepWithKs5Results(built) : built;
  return NextResponse.json({ list3 });
}
