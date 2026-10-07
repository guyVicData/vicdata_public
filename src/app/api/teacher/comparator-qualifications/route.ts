import { isPlatformAdmin } from "@/lib/view-as";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookupAcademicSubjectQualificationHeadline } from "@/lib/vicdata-reference";
import type { ComparatorQualificationRow } from "@/lib/teacher-view-comparator-quals";

// VicData 0.6.5 S3 (the 0.6.4 audit's change 5, R-POINTS-SAME-QUAL): Comparisons and the maps
// at Post-16, on points and entries, read each comparator school's figure for the focus's
// EXACT qualification -- A-level Maths against other schools' A-level Maths, never the
// "alevel" bucket (A level and AS together), all BTEC sizes together or IB HL with SL.
//
// Source: academic_subject_qualification_headline (vicdata-production), the same rows the
// school's own Column 1 reads through the dashboard route's qualificationHeadline -- so the
// school's dot, its Column 1 figure and its rank are one number. One RPC call, filtered to
// the qualification in the database and to the subject here; only those rows go back.
//
// Gate: approved staff of `anchorUrn` (the school being viewed), as comparator-grades; the
// comparator schools need no membership of their own. Published figures only.
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const urnsParam = request.nextUrl.searchParams.get("urns");
  const subject = request.nextUrl.searchParams.get("subject");
  const qualificationType = request.nextUrl.searchParams.get("qualificationType");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !urnsParam || !subject || !qualificationType || !authHeader) {
    return NextResponse.json({ error: "anchorUrn, urns, subject, qualificationType and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", anchorUrn)
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error("[teacher/comparator-qualifications] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!membership && !(await isPlatformAdmin(supabase))) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter((u) => /^\d{5,7}$/.test(u)))).slice(0, 200);
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);
  try {
    const rows = await lookupAcademicSubjectQualificationHeadline({ entityIds: urns, ksStage: "ks5", qualificationType });
    const rowsByUrn: Record<string, ComparatorQualificationRow[]> = Object.fromEntries(urns.map((u) => [u, []]));
    for (const r of rows) {
      if (r.subject !== subject || r.qualification_type !== qualificationType) continue;
      (rowsByUrn[r.entity_id] ??= []).push({
        period: r.period,
        entries: r.entries_total === null ? null : Number(r.entries_total),
        avgPointScore: r.avg_point_score === null ? null : Number(r.avg_point_score),
      });
    }
    for (const list of Object.values(rowsByUrn)) list.sort((a, b) => a.period - b.period);
    return NextResponse.json({ rowsByUrn });
  } catch (err) {
    console.error("[teacher/comparator-qualifications] failed:", err);
    return NextResponse.json({ error: "Could not load these schools' figures." }, { status: 502 });
  }
}
