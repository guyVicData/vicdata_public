import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookupAcademicSubjectGeography } from "@/lib/vicdata-reference";
import { NATIONAL_GROUPING_KEY } from "@/lib/academic-aggregate-trends";
import { resolveTargetRegionNation } from "@/lib/region-nation-comparator";
import type { GeographyPayload } from "@/lib/teacher-view-geography";

// Teacher view, Candidates live review Part 5: one GCSE subject's entries in the school's
// own LA, its region and England, per year -- what the % Change TABLE compares the focused
// subject against ("us vs. the wider system").
//
// Source: academic_subject_geography_lookup (lookupAcademicSubjectGeography), GCSE only.
// Its entries_total is POINTS-ELIGIBLE entries (GCSE full course), not every entry --
// the backend's own convention -- so a subject whose entries are outside GCSE points (an
// FSMQ, a vocational qualification) has no real figure here. The caller decides whether
// the comparison applies; this route just returns what exists. LA and region resolve
// the way the existing code does: schools.la_name, and resolveTargetRegionNation().

export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const subject = request.nextUrl.searchParams.get("subject");
  const authHeader = request.headers.get("authorization");
  if (!urn || !subject || !authHeader) {
    return NextResponse.json({ error: "urn, subject and Authorization are required" }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  // Same gate as the dashboard route: approved staff of this school only.
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  const { data: school } = await supabase.from("schools").select("la_name").eq("urn", urn).maybeSingle<{ la_name: string | null }>();
  const regionName = (await resolveTargetRegionNation(urn))?.regionName ?? null;

  // One lookup per grouping, in series: these reference lookups contend, and the dashboard
  // route serialises its own for the same reason.
  const fetchRows = async (groupingType: "la" | "region" | "national", key: string | null) => {
    if (!key) return null;
    const rows = await lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType, groupingKeys: [key], subject });
    const out = rows
      .map((r) => ({ period: r.period, entries: r.entries_total === null ? null : Number(r.entries_total), schoolCount: r.school_count }))
      .sort((a, b) => a.period - b.period);
    return out.length ? { name: key, rows: out } : null;
  };
  const payload: GeographyPayload = {
    la: await fetchRows("la", school?.la_name ?? null),
    region: await fetchRows("region", regionName),
    national: await fetchRows("national", NATIONAL_GROUPING_KEY),
  };
  return NextResponse.json(payload);
}
