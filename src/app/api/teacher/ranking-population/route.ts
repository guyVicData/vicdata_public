import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTargetRegionNation } from "@/lib/region-nation-comparator";
import { cachedRankingPopulation } from "@/lib/chooser-sets";
import type { PopulationRow } from "@/lib/comparator-chooser";

// Teacher view comparator chooser, "Regional & national rankings" (screens 3a/3b): the
// population a ranking is built from, one compact row per school -- its sector, gender,
// boarding share and size band -- which the chooser filters and counts client-side as
// the teacher taps chips, so the running count answers instantly.
//
// Every fact comes from the modules that already own it:
//   - the population itself: region_nation_set(), the same scoped read the Data View's
//     Compared-with panel uses (region-nation-comparator.ts), called with p_exclude_urn ''
//     so the school itself is counted in the population it will be ranked within;
//   - sector: sectorTag(); gender: genderTag() on schools.gender (region_nation_set does
//     not carry it -- one batched read of the real GIAS field, no inference from roll);
//   - boarding: the census boarders/total via boardingRatio();
//   - size: sizeBadgeForValue() against age_band_pupil_distributions' national quintiles
//     for the phase's band (sixth form at Post-16, secondary at GCSE), exactly as the
//     public pages' size badges are made.
// "Same phase": at Post-16, a school with real pupils in the sixth-form band, or an FE
// college; at GCSE, a school whose phaseTags() include Senior.

export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const phase = request.nextUrl.searchParams.get("phase");
  const scopeParam = request.nextUrl.searchParams.get("scope") ?? "nation";
  const authHeader = request.headers.get("authorization");
  if (!urn || (phase !== "ks4" && phase !== "ks5") || !authHeader) {
    return NextResponse.json({ error: "urn, phase (ks4 or ks5) and Authorization are required" }, { status: 400 });
  }
  const regionCode = scopeParam.startsWith("region:") ? scopeParam.slice("region:".length) : null;
  if (scopeParam !== "nation" && !/^E120000\d\d$/.test(regionCode ?? "")) {
    return NextResponse.json({ error: "scope must be nation or region:<ONS code>" }, { status: 400 });
  }

  // Same gate as every Teacher view route: approved staff of this school only.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: membership, error: membershipError } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  if (!membership) return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });

  // The school's own LA, for the size-band lookup (see buildRankingPopulation).
  const { data: target } = await supabase.from("schools").select("la_name").eq("urn", urn).maybeSingle<{ la_name: string | null }>();
  let rows: PopulationRow[];
  try {
    rows = await cachedRankingPopulation(regionCode, phase, target?.la_name ?? null);
  } catch (err) {
    console.error("[teacher/ranking-population] build failed:", err);
    return NextResponse.json({ error: "Could not load this population." }, { status: 502 });
  }

  const own = await resolveTargetRegionNation(urn);
  return NextResponse.json({
    rows,
    ownRegion: own?.regionCode && own.regionName && own.nation === "england" ? { code: own.regionCode, name: own.regionName } : null,
  });
}
