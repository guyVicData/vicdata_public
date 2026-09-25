import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { KsStage } from "@/lib/academic-data-view";
import { isIndependent, type PoolSchool } from "@/lib/teacher-view-rankings";
import { neighbourPool, rankFixedSets, type NeighbourRow } from "@/lib/teacher-view-comparator-series";
import { PERSONAL_COMPARATOR_CAP } from "@/lib/teacher-view-saved-sets";

// Teacher view, accordion round Part 3: the saved comparator sets a teacher can compare
// against, ranked exactly like the four algorithmic ones, plus what the chooser needs to
// build a new one.
//
// Reads the real, already-shipped saved_sets / saved_set_members tables -- the same rows
// the Data View's comparator sets and the /sets pages use, so a set made here shows up
// there and vice versa. Like /api/comparator-set-peers, it passes the caller's own token
// through rather than re-implementing visibility: RLS already shows shared sets to every
// approved member and personal sets only to their owner. Writes are made from the client
// under the same RLS, which also enforces "shared sets: account holder / admin only".

// How many nearby schools the chooser offers as candidates alongside the ticked set --
// the agreed scope, "ticked set plus nearby candidates", not the whole pool.
const CANDIDATE_COUNT = 30;

type SetRow = {
  id: string;
  name: string;
  owner_membership_id: string | null;
  config: Record<string, unknown> | null;
  saved_set_members: {
    school_urn: string;
    member_status: string;
    schools: { current_name: string; la_name: string | null; establishment_type_group: string | null } | null;
  }[];
};

export async function GET(request: NextRequest) {
  const urn = request.nextUrl.searchParams.get("urn");
  const phase = request.nextUrl.searchParams.get("phase") as KsStage | null;
  const authHeader = request.headers.get("authorization");
  if (!urn || !phase || !authHeader) {
    return NextResponse.json({ error: "urn, phase and Authorization are required" }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  const userId = userData.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  // The caller's OWN approved membership of this school -- the owner of any personal set
  // they make, and whether they may create or edit the school's shared sets.
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id, is_admin, school_account_id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id)")
    .eq("status", "approved")
    .eq("profile_id", userId)
    .eq("school_accounts.school_urn", urn)
    .maybeSingle<{
      id: string;
      is_admin: boolean | null;
      school_account_id: string;
      school_accounts: { school_urn: string; account_holder_membership_id: string | null };
    }>();
  if (!membership) {
    return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });
  }
  const canEditShared = !!membership.is_admin || membership.school_accounts.account_holder_membership_id === membership.id;

  const { data: setRows } = await supabase
    .from("saved_sets")
    .select("id, name, owner_membership_id, config, saved_set_members(school_urn, member_status, schools(current_name, la_name, establishment_type_group))")
    .eq("school_account_id", membership.school_account_id)
    .eq("set_type", "comparator")
    .order("created_at", { ascending: true });
  const rows = (setRows ?? []) as unknown as SetRow[];

  const sets = rows.map((r) => {
    const members = r.saved_set_members
      .filter((m) => m.member_status === "confirmed" && m.school_urn !== urn)
      .map((m) => ({
        urn: m.school_urn,
        name: m.schools?.current_name ?? m.school_urn,
        laName: m.schools?.la_name ?? null,
        independent: isIndependent(m.schools?.establishment_type_group ?? null),
      }));
    const shared = r.owner_membership_id === null;
    const mine = r.owner_membership_id === membership.id;
    return { id: r.id, name: r.name, shared, mine, editable: mine || (shared && canEditShared), config: r.config ?? {}, members };
  });

  const { ranked, seriesByUrn, excludedUrns } = await rankFixedSets(
    urn,
    sets.map((s) => ({ id: s.id, urns: s.members.map((m) => m.urn) })),
    phase,
  );

  const { data: neighbourRows } = await supabase
    .from("school_nearest_neighbours")
    .select("rank, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status, establishment_type_group, statutory_low_age, statutory_high_age, la_name)")
    .eq("urn", urn)
    .eq("pool", "general")
    .order("rank", { ascending: true })
    .limit(100);
  const candidates: PoolSchool[] = neighbourPool((neighbourRows ?? []) as unknown as NeighbourRow[], phase).slice(0, CANDIDATE_COUNT);

  const { data: target } = await supabase.from("schools").select("la_name, establishment_type_group").eq("urn", urn).maybeSingle();

  return NextResponse.json({
    me: { membershipId: membership.id, schoolAccountId: membership.school_account_id, canEditShared },
    cap: PERSONAL_COMPARATOR_CAP,
    personalCount: sets.filter((s) => s.mine).length,
    sets: sets.map((s) => ({ ...s, rows: ranked[s.id] ?? [] })),
    seriesByUrn,
    // GCSE schools left out of comparison entirely (igcseExclusionLikely) -- the chooser
    // can say so beside a ticked school rather than let it silently vanish.
    excludedUrns,
    candidates,
    target: {
      laName: (target as { la_name: string | null } | null)?.la_name ?? null,
      independent: isIndependent((target as { establishment_type_group: string | null } | null)?.establishment_type_group ?? null),
    },
  });
}
