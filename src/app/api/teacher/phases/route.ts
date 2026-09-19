import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAcademicProfiles } from "@/lib/academic-data-view";
import { availableTeacherPhases, TEACHER_PHASES, type CurrentPhasePeriods } from "@/lib/teacher-view-phases";
import { lookupAcademicCurrentPeriods } from "@/lib/vicdata-reference";

// Teacher view, Phase 2: which dataset phases this school genuinely has right now
// (design brief v2 §5). Done server-side rather than in the browser because deciding
// availability needs the school's full academic profile, which is a heavy fetch the home
// screen should not pay for just to draw three tiles.
//
// §5 requires "genuine current data ... not just historically, but in the most recent
// available year", so the current period per phase is resolved here from the real data
// rather than hardcoded -- a new publication year moves this on its own.
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

  const { data: approvedMembership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();

  if (membershipError) {
    console.error("[teacher/phases] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });
  }

  const profiles = await fetchAcademicProfiles([urn], { includePopulation: true });
  const profile = profiles.find((p) => p.urn === urn) ?? null;
  if (!profile) {
    return NextResponse.json({ phases: [], currentPeriods: {} });
  }

  // NATIONAL current year per phase, not this school's own latest row. Deriving it from
  // the school would make a school whose data stops in 2022 look current against itself,
  // which is precisely what §5 excludes -- and 385 KS4 and 187 KS5 schools really are in
  // that position, so the distinction is load-bearing rather than pedantic.
  const national = await lookupAcademicCurrentPeriods();
  const currentPeriods: CurrentPhasePeriods = {};
  for (const phase of TEACHER_PHASES) currentPeriods[phase] = national[phase] ?? null;

  return NextResponse.json({
    phases: availableTeacherPhases(profile, currentPeriods),
    currentPeriods,
  });
}
