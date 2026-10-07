import { isPlatformAdmin } from "@/lib/view-as";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cachedReference } from "@/lib/server-cache";
import { lookupAcademicSubjectGradeGeography } from "@/lib/vicdata-reference";
import { normaliseKs5AreaRows } from "@/lib/grade-rows";
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

  // 0.6.4 C2: the school's LA and region (public, kept an hour), read together.
  const [laName, regionName] = await Promise.all([
    cachedReference(`school:la:${urn}`, async () => {
      const { data: school, error } = await supabase.from("schools").select("la_name").eq("urn", urn).maybeSingle<{ la_name: string | null }>();
      if (error) throw error;
      return school?.la_name ?? null;
      // A failed read isn't kept (and reads as no LA, as before).
    }).catch(() => null),
    cachedReference(`school:region:${urn}`, async () => (await resolveTargetRegionNation(urn))?.regionName ?? null),
  ]);

  const fetchRows = async (groupingType: "la" | "region" | "national", key: string | null) => {
    if (!key) return null;
    // 0.6.4 C2: published area grade rows, the same for every member -- kept an hour.
    const rows = await cachedReference(`gradegeo:${phase}:${groupingType}:${key}:${subject}:${qualificationType}`, () =>
      lookupAcademicSubjectGradeGeography({ ksStage: phase, groupingType, groupingKeys: [key], subject, qualificationType }),
    );
    const raw: GradeGeographyRow[] = rows.map((r) => ({ period: r.period, grade: r.grade, entries: Number(r.entries_total), schoolCount: r.school_count }));
    // 0.6.3 S3: at KS5, the historic vocational codes in their modern words and "*" as A*,
    // exactly as the school's own rows (R-HISTORIC-GRADE-LABELS, R-ALEVEL-STAR).
    const out = (phase === "ks5" ? normaliseKs5AreaRows(raw, qualificationType) : raw).sort((a, b) => a.period - b.period);
    return out.length ? { name: key, rows: out } : null;
  };
  try {
    // 0.6.4 C2: the three areas together (they were one after another).
    const [la, region, national] = await Promise.all([fetchRows("la", laName), fetchRows("region", regionName), fetchRows("national", NATIONAL_GROUPING_KEY)]);
    const payload: GradeGeographyPayload = { la, region, national };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[teacher/subject-grade-geography] failed:", err);
    return NextResponse.json({ error: "Could not load the area figures." }, { status: 502 });
  }
}
