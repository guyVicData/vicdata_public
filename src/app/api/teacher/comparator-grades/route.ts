import { isPlatformAdmin } from "@/lib/view-as";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSchoolGradeRows, type KsStage, type SubjectGradeCount } from "@/lib/academic-data-view";

// Teacher view, Comparisons on a grade threshold (Grade 4+ / A*-E rate): each comparator
// school's per-grade entry counts for ONE subject, so the page can score every school's
// rate exactly as it scores its own (thresholdRate over the same parsed rows).
//
// Source (0.6.2 S3): fetchSchoolGradeRows, 2021/22-2024/25 for the one subject -- the same
// four-year grade rows the dashboard route gives the school itself. At GCSE the rollup
// RPC (academic_subject_grade_rollup_lookup) filtered to the subject in the database once
// it is applied, else the modern + historic facts (S1: equal on every key); at Post-16 the
// modern + historic facts (R-HISTORIC-GRADE-LABELS). The facts are read in chunks of 25
// schools, so a big saved set no longer loses schools at the 50-page cap. Only the
// requested subject's rows go back. Years already shown (2023/24-2024/25) are identical to
// the pre-0.6.2 read (docs/v0.6/audit_scripts/grade_rollup/s3_timing.out).
//
// Gate: approved staff of `anchorUrn` (the school being viewed), as academic-schools;
// the comparator schools need no membership of their own.
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const urnsParam = request.nextUrl.searchParams.get("urns");
  const stage = request.nextUrl.searchParams.get("stage") as KsStage | null;
  const subject = request.nextUrl.searchParams.get("subject");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !urnsParam || !stage || !subject || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, urns, stage, subject and Authorization are required" }, { status: 400 });
  }
  if (stage !== "ks4" && stage !== "ks5") return NextResponse.json({ error: "stage must be ks4 or ks5" }, { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", anchorUrn)
    // Any approved row at this school proves membership: RLS shows colleagues only to members.
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error("[teacher/comparator-grades] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!membership && !(await isPlatformAdmin(supabase))) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter(Boolean)));
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);

  const { byUrn } = await fetchSchoolGradeRows(urns, stage, subject);
  const gradeRowsByUrn: Record<string, SubjectGradeCount[]> = {};
  for (const [urn, rows] of byUrn) gradeRowsByUrn[urn] = rows;
  return NextResponse.json({ gradeRowsByUrn });
}
