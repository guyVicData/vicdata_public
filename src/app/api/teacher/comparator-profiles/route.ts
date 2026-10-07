import { isPlatformAdmin } from "@/lib/view-as";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serializeAcademicProfile } from "@/lib/academic-data-view";
import { fetchTeacherComparatorProfiles } from "@/lib/teacher-comparator-profiles";

// VicData 0.6.7 B1: the Teacher page's comparator school details, lean and for one phase
// (src/lib/teacher-comparator-profiles.ts) -- for the schools of every set the page holds
// (saved and custom sets) when the chooser-set answer doesn't already carry them. The Data
// View keeps /api/data-view/academic-schools, unchanged. Same gate as academic-schools: an
// approved membership at anchorUrn (or a platform admin); school-level data only.
const MAX_URNS = 400;

export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const urnsParam = request.nextUrl.searchParams.get("urns");
  const phase = request.nextUrl.searchParams.get("phase");
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !urnsParam || !authHeader || (phase !== "ks4" && phase !== "ks5")) {
    return NextResponse.json({ error: "anchorUrn, urns, phase and Authorization are required" }, { status: 400 });
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
  if (membershipError) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  if (!membership && !(await isPlatformAdmin(supabase))) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  // As academic-schools: the requested schools, the anchor added when missing.
  const urns = Array.from(new Set(urnsParam.split(",").map((u) => u.trim()).filter((u) => /^\d{5,7}$/.test(u)))).slice(0, MAX_URNS);
  if (!urns.includes(anchorUrn)) urns.push(anchorUrn);
  try {
    const profiles = await fetchTeacherComparatorProfiles(urns, phase);
    return NextResponse.json({ profiles: profiles.map(serializeAcademicProfile) });
  } catch (err) {
    console.error("[teacher/comparator-profiles] failed:", err);
    return NextResponse.json({ error: "Could not load these schools." }, { status: 502 });
  }
}
