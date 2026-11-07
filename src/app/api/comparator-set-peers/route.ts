import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lookupReferenceData, type ReferenceFact } from "@/lib/vicdata-reference";
import { buildRollSnapshot, buildRollTrend } from "@/lib/roll-data";
import { readSet } from "@/lib/sets/store";

// Roll-size ranks + peer group trend overlays (rolls spec §6: Comparator Set
// consumers). RLS on sets/set_members (0.8 sets round 1) already scopes which sets a caller
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

  // 0.8 sets round 1 (A5): the one sets model (public.sets). RLS shows a school set to every approved
  // member of its school and a personal set to its owner only.
  const set = await readSet(supabase, setId);
  if (!set || set.kind !== "compared_against") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // The school the set is about: its focus school, else its school's own.
  let anchorUrn = set.focusUrn;
  if (!anchorUrn && set.schoolAccountId) {
    const { data: acc } = await supabase.from("school_accounts").select("school_urn").eq("id", set.schoolAccountId).maybeSingle();
    anchorUrn = (acc as { school_urn: string } | null)?.school_urn ?? null;
  }
  if (!anchorUrn) return NextResponse.json({ error: "not found" }, { status: 404 });
  const memberUrns = set.members.map((m) => m.urn);
  const { data: memberSchools } = memberUrns.length ? await supabase.from("schools").select("urn, current_name").in("urn", memberUrns) : { data: [] };
  const nameBy = new Map(((memberSchools ?? []) as { urn: string; current_name: string }[]).map((r) => [r.urn, r.current_name]));

  const { data: anchorSchool } = await supabase
    .from("schools")
    .select("current_name")
    .eq("urn", anchorUrn)
    .maybeSingle();

  const memberRows = memberUrns.map((u) => ({ school_urn: u, schools: nameBy.has(u) ? { current_name: nameBy.get(u)! } : null }));

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
