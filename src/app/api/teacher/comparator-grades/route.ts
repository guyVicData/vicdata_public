import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSubjectLevelDataForSchools, type KsStage, type SubjectGradeCount } from "@/lib/academic-data-view";

// Teacher view, Comparisons on a grade threshold (Grade 4+ / A*-E rate): each comparator
// school's per-grade entry counts for ONE subject, so the page can score every school's
// rate exactly as it scores its own (thresholdRate over the same parsed rows).
//
// Source: fetchSubjectLevelDataForSchools -- the same batched raw-fact lookup the
// dashboard route runs for the school itself with [urn], and the Data View's
// academic-subject-comparison route runs across a whole comparator set. One lookup
// regardless of set size. Only the requested subject's rows go back: every subject for
// every school would be tens of thousands of rows the page never reads.
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
    .maybeSingle();
  if (membershipError) {
    console.error("[teacher/comparator-grades] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!membership) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter(Boolean)));
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);

  const { byUrn } = await fetchSubjectLevelDataForSchools(urns, stage);
  const gradeRowsByUrn: Record<string, SubjectGradeCount[]> = {};
  for (const [urn, data] of byUrn) gradeRowsByUrn[urn] = data.gradeDistribution.filter((g) => g.subject === subject);
  return NextResponse.json({ gradeRowsByUrn });
}
