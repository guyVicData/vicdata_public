import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookupReferenceData, type ReferenceFact } from "@/lib/vicdata-reference";
import { buildRollSnapshot, buildRollTrend } from "@/lib/roll-data";

// Roll-size ranks + peer group trend overlays (rolls spec §6: Comparator Set
// consumers). RLS on saved_sets/saved_set_members already scopes which sets a caller
// can see (shared sets to any approved member of the school, personal sets to their
// owner) -- this route passes the caller's own token through rather than
// re-implementing that check.
export async function GET(request: NextRequest) {
  const setId = request.nextUrl.searchParams.get("setId");
  const authHeader = request.headers.get("authorization");
  if (!setId || !authHeader) {
    return NextResponse.json({ error: "setId and Authorization are required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  // saved_sets has exactly one FK to school_accounts (school_account_id), unlike
  // school_memberships<->school_accounts which has three and needs an explicit
  // relationship name (see /api/paid-trends) -- no ambiguity here, plain embed is fine.
  const { data: set } = await supabase
    .from("saved_sets")
    .select("id, name, set_type, school_accounts!inner(school_urn)")
    .eq("id", setId)
    .eq("set_type", "comparator")
    .maybeSingle();

  if (!set) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: members } = await supabase
    .from("saved_set_members")
    .select("school_urn, schools(current_name)")
    .eq("saved_set_id", setId)
    .eq("member_status", "confirmed");

  const anchorUrn = (
    set as unknown as { school_accounts: { school_urn: string } }
  ).school_accounts.school_urn;

  const { data: anchorSchool } = await supabase
    .from("schools")
    .select("current_name")
    .eq("urn", anchorUrn)
    .maybeSingle();

  const memberRows = (members ?? []) as unknown as {
    school_urn: string;
    schools: { current_name: string } | null;
  }[];

  const allUrns = Array.from(new Set([anchorUrn, ...memberRows.map((m) => m.school_urn)]));
  const facts = await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: allUrns });

  const factsByUrn = new Map<string, ReferenceFact[]>();
  for (const f of facts) {
    if (!factsByUrn.has(f.entity_id)) factsByUrn.set(f.entity_id, []);
    factsByUrn.get(f.entity_id)!.push(f);
  }

  const names = new Map<string, string>([[anchorUrn, anchorSchool?.current_name ?? anchorUrn]]);
  for (const m of memberRows) names.set(m.school_urn, m.schools?.current_name ?? m.school_urn);

  const schools = allUrns.map((urn) => {
    const schoolFacts = factsByUrn.get(urn) ?? [];
    const snapshot = buildRollSnapshot(schoolFacts, urn);
    const trend = buildRollTrend(schoolFacts, urn);
    return {
      urn,
      name: names.get(urn) ?? urn,
      isAnchor: urn === anchorUrn,
      currentRoll: snapshot?.totalRoll ?? null,
      trend: trend.map((t) => ({ period: t.period, totalRoll: t.totalRoll })),
    };
  });

  return NextResponse.json({ setName: set.name, schools });
}
