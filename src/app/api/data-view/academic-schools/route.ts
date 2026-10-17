import { resolveCaller } from "@/lib/view-as-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAcademicProfiles, serializeAcademicProfile } from "@/lib/academic-data-view";
import { withIgcseFamilies } from "@/lib/igcse";
import { cachedReference } from "@/lib/server-cache";
import { lookupAcademicLatestYears } from "@/lib/vicdata-reference";

// Academic Results Data View tab (frontend build brief, Part B): the batched
// per-school data fetch behind AcademicMapView/AcademicGraphsView/AcademicRankingsView
// -- same shape and same membership gate as /api/data-view/schools (an approved
// membership at `anchorUrn`, the school being VIEWED -- comparator-set schools don't
// need their own separate membership, same convention that route's own comment
// documents).
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const urnsParam = request.nextUrl.searchParams.get("urns");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !urnsParam || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, urns and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // 0.8 View as: the one caller helper (src/lib/view-as-server.ts) -- a member of this school (the
  // query this route always made), a platform admin's View as or peek, read-only.
  const caller = await resolveCaller(request, anchorUrn, { visibleRow: true, supabase, refusal: "The Data View is available to verified school staff." });
  if (caller instanceof NextResponse) return caller;

  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter(Boolean)));
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);
  if (urns.length === 0) {
    return NextResponse.json({ error: "no urns requested" }, { status: 400 });
  }

  // Subject-grain rows are opt-in per request. This route serves both the Data View's own
  // Academic map, which never reads them, and Teacher view's Rankings map, which asks with
  // includeSubjects=1 -- so the Data View keeps making exactly the fetch it always made.
  const includeSubjects = request.nextUrl.searchParams.get("includeSubjects") === "1";
  const profiles = await fetchAcademicProfiles(urns, { includeSubjects });
  // 0.7 year rules: the latest year per key stage with DfE's provisional flag
  // (src/catalogue/years.ts), for the "(provisional)" after a year label.
  const latestYears = await cachedReference("years:latest", () => lookupAcademicLatestYears()).catch(() => null);
  // 0.8 IGCSE subjects: IGCSE schools carry their incomplete families, for the family views' exclusion.
  return NextResponse.json({ profiles: (await withIgcseFamilies(profiles)).map(serializeAcademicProfile), latestYears });
}
