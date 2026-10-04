import { isPlatformAdmin } from "@/lib/view-as";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookupAcademicSubjectGradeGeography } from "@/lib/vicdata-reference";
import { NATIONAL_GROUPING_KEY } from "@/lib/academic-aggregate-trends";
import { resolveTargetRegionNation } from "@/lib/region-nation-comparator";
import type { GradeGeographyPayload, GradeGeographyRow } from "@/lib/teacher-view-grade-geography";

// Grade bands frontend round: one subject's entries per EXACT grade in the school's own LA,
// its region and England, per year -- the benchmark every Grade bands rate and Grade counts
// distribution is read against. The grade-grain sibling of /api/teacher/subject-geography,
// with the same gate, the same LA/region resolution (schools.la_name,
// resolveTargetRegionNation) and the same one-lookup-per-grouping, in series.
//
// Source: academic_subject_grade_geography_lookup (vicdata), per subject AND exact
// qualification at both phases -- the grade rows carry the qualification type at GCSE too,
// so GCSE History and a Cambridge National in History are separate distributions. Every
// grade's own row is returned (p_grade null); nothing is summed here.
//
// Unlike subject-geography, England is NOT asked for thin rows: every grouping keeps the
// RPC's own 5-school minimum, so a grade backed by fewer schools is simply absent and the
// panel says the area figure is not shown, rather than a figure from one or two schools.
export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const subject = request.nextUrl.searchParams.get("subject");
  const qualificationType = request.nextUrl.searchParams.get("qualificationType");
  const phase = request.nextUrl.searchParams.get("phase") === "ks5" ? "ks5" : "ks4";
  const authHeader = request.headers.get("authorization");
  if (!urn || !subject || !qualificationType || !authHeader) {
    return NextResponse.json({ error: "urn, subject, qualificationType and Authorization are required" }, { status: 400 });
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
    // Any approved row at this school proves membership: RLS shows colleagues only to members.
    .limit(1)
    .maybeSingle();
  if (!membership && !(await isPlatformAdmin(supabase))) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  const { data: school } = await supabase.from("schools").select("la_name").eq("urn", urn).maybeSingle<{ la_name: string | null }>();
  const regionName = (await resolveTargetRegionNation(urn))?.regionName ?? null;

  const fetchRows = async (groupingType: "la" | "region" | "national", key: string | null) => {
    if (!key) return null;
    const rows = await lookupAcademicSubjectGradeGeography({ ksStage: phase, groupingType, groupingKeys: [key], subject, qualificationType });
    const out: GradeGeographyRow[] = rows
      .map((r) => ({ period: r.period, grade: r.grade, entries: Number(r.entries_total), schoolCount: r.school_count }))
      .sort((a, b) => a.period - b.period);
    return out.length ? { name: key, rows: out } : null;
  };
  try {
    const payload: GradeGeographyPayload = {
      la: await fetchRows("la", school?.la_name ?? null),
      region: await fetchRows("region", regionName),
      national: await fetchRows("national", NATIONAL_GROUPING_KEY),
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[teacher/subject-grade-geography] failed:", err);
    return NextResponse.json({ error: "Could not load the area figures." }, { status: 502 });
  }
}
