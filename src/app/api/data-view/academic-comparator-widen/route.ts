import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findSurroundingSchools } from "@/lib/surrounding-schools";
import { CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";
import { fetchAcademicProfiles, ks5HasBucketEntries, stagesPresent, type Ks5Bucket } from "@/lib/academic-data-view";
import { KS5_BUCKETS } from "@/lib/dfe-qualification-buckets";

// Stage 2 UX review, item 11: "comparator set must always be 10 real schools/
// colleges" for the Academic KS5 view, reusing surrounding-schools.ts's own
// findSurroundingSchools() engine (sector/phase/gender/roll-data matching, plus the
// same real widen-the-net escalation for a thin pool) rather than inventing new
// selection logic -- resolves the Acland Burghley "map goes empty when A level is
// selected" symptom directly (root cause: the fixed ticked/nearest set has no
// backfill when most of it lacks real data for whatever's currently selected).
//
// Separate, single-purpose route from /api/data-view/academic-schools (which just
// fetches profiles for a known URN list) -- this one only ever returns URNs to ADD
// on top of whatever's already visible; the client re-uses the existing profiles
// route to actually fetch them, so this stays a thin, focused endpoint.
//
// Same membership gate as /api/data-view/academic-schools -- an approved
// membership at `anchorUrn` (the school being viewed), comparator schools don't
// need their own.
export async function GET(request: NextRequest) {
  const anchorUrn = request.nextUrl.searchParams.get("anchorUrn");
  const countParam = request.nextUrl.searchParams.get("count");
  const bucketParam = request.nextUrl.searchParams.get("bucket");
  const excludeParam = request.nextUrl.searchParams.get("excludeUrns") ?? "";
  const authHeader = request.headers.get("authorization");
  if (!anchorUrn || !authHeader) {
    return NextResponse.json({ error: "anchorUrn and Authorization are required" }, { status: 400 });
  }

  const count = countParam ? parseInt(countParam, 10) : 10;
  if (!Number.isFinite(count) || count <= 0) {
    return NextResponse.json({ error: "count must be a positive integer" }, { status: 400 });
  }

  // Real, checked bucket string only -- an unrecognised value falls back to the
  // default "any real KS5 data at all" filter rather than silently matching nothing.
  const bucket: Ks5Bucket | null = bucketParam && (KS5_BUCKETS as readonly string[]).includes(bucketParam) ? (bucketParam as Ks5Bucket) : null;
  const excludeUrns = new Set(excludeParam.split(",").map((s) => s.trim()).filter(Boolean));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: approvedMembership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", anchorUrn)
    .maybeSingle();

  if (membershipError) {
    console.error("[data-view/academic-comparator-widen] membership check failed:", membershipError);
    return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  }
  if (!approvedMembership) {
    return NextResponse.json({ error: "The Data View is available to verified school staff." }, { status: 403 });
  }

  const matched = await findSurroundingSchools(anchorUrn, CURRENT_CENSUS_PERIOD, {
    // Item 11's own default state (no qualification-type matching) still matches
    // sector/phase EXACT gender -- widening the comparator pool for real KS5 data
    // is a separate concern from Rolls' own gender-match discipline, not a reason
    // to relax it too.
    genderMode: "exact",
    targetCount: count,
    extraFilterUrns: async (candidateUrns) => {
      const relevant = candidateUrns.filter((u) => !excludeUrns.has(u) && u !== anchorUrn);
      if (relevant.length === 0) return new Set();
      const profiles = await fetchAcademicProfiles(relevant, { includePopulation: false });
      const passing = profiles.filter((p) => (bucket ? ks5HasBucketEntries(p, bucket) : stagesPresent(p).includes("ks5")));
      return new Set(passing.map((p) => p.urn));
    },
  });

  return NextResponse.json({ urns: matched.map((m) => m.urn) });
}
