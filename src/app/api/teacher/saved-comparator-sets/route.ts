import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { KsStage } from "@/lib/academic-data-view";
import { isIndependent, type PoolSchool } from "@/lib/teacher-view-rankings";
import { neighbourPool, rankFixedSets, type NeighbourRow } from "@/lib/teacher-view-comparator-series";
import { PERSONAL_COMPARATOR_CAP, readViewAsStore, type SavedComparatorSet, type SavedRanking } from "@/lib/teacher-view-saved-sets";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { viewAsForRequest, viewAsMembership, ViewAsUnconfirmed } from "@/lib/view-as";
import { schoolGroupSets } from "@/lib/groups/school-sets";
import { readSets } from "@/lib/sets/store";
import { activePersonalCount, canCurate, creatorFor, setFitsPage, type StoredSet } from "@/lib/sets/model";

// Teacher view, accordion round Part 3: the saved comparator sets a teacher can compare
// against, ranked exactly like the four algorithmic ones, plus what the chooser needs to
// build a new one.
//
// Reads the one sets model (public.sets / set_members, 0.8 sets round 1) -- the same rows
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
  // 0.8 sets round 1: who owns it -- the school (shared), or a person (personal; mine if theirs).
  shared: boolean;
  mine: boolean;
  // 0.8 sets round 1 (B7): who made it, for the menu's creator tag.
  creator: StoredSet["creatorKind"];
  config: Record<string, unknown> | null;
  created_at: string;
  members: { urn: string; schools: { current_name: string; la_name: string | null; establishment_type_group: string | null } | null }[];
};

// The compared-against sets that fit a Teacher page (0.8 sets round 1, B9): whole-school sets, any made
// for this phase, and Admissions' sets of the matching entry point (11+ on GCSE pages, 16+ on Post-16
// pages); feeder sets never.
const forTeacherPage = (s: StoredSet, phase: string) => (phase === "ks4" || phase === "ks5") && setFitsPage(s, { kind: "compared_against", phase });

async function withSchools(client: { from: ReturnType<typeof createClient>["from"] }, sets: StoredSet[], profileId: string | null): Promise<SetRow[]> {
  const urns = Array.from(new Set(sets.flatMap((s) => s.members.map((m) => m.urn))));
  const by = new Map<string, { current_name: string; la_name: string | null; establishment_type_group: string | null }>();
  for (let i = 0; i < urns.length; i += 200) {
    const { data } = await client.from("schools").select("urn, current_name, la_name, establishment_type_group").in("urn", urns.slice(i, i + 200));
    for (const r of (data ?? []) as { urn: string; current_name: string; la_name: string | null; establishment_type_group: string | null }[]) by.set(r.urn, r);
  }
  return sets.map((s) => ({
    id: s.id,
    name: s.name,
    shared: s.ownerScope === "school",
    mine: s.ownerScope === "personal" && !!profileId && s.ownerProfileId === profileId,
    creator: s.creatorKind,
    config: s.config,
    created_at: s.createdAt,
    members: s.members.map((m) => ({ urn: m.urn, schools: by.get(m.urn) ?? null })),
  }));
}

type VcRow = {
  vc_comparator_sets: {
    id: string;
    name: string;
    vc_comparator_set_members: { school_urn: string; schools: { current_name: string; la_name: string | null; establishment_type_group: string | null } | null }[];
  } | null;
};
const VC_SELECT = "vc_comparator_sets(id, name, vc_comparator_set_members(school_urn, schools(current_name, la_name, establishment_type_group)))";

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

  // 0.6 snag 4 (B): View as (a confirmed platform admin, the View as cookie naming this
  // school) gets exactly what a real single-membership member of the viewed role gets: the
  // school's shared and Victoria Consultancy sets, plus the View as's OWN personal sets
  // (Guy's teacher_view_notes rows under the View as key, src/lib/view-as.ts) -- never
  // Guy's own personal sets, even at a school where he is a member. canEditShared is the
  // viewed member's (a School-Admin's is true), so the page draws exactly as theirs; the
  // chooser then refuses any save that would write a shared set (no school-wide writes in
  // View as). A member's path below is unchanged.
  let viewAs: Awaited<ReturnType<typeof viewAsForRequest>>;
  try {
    viewAs = await viewAsForRequest(supabase, request, urn);
  } catch (e) {
    if (e instanceof ViewAsUnconfirmed) return NextResponse.json({ error: e.message }, { status: 502 });
    throw e;
  }
  let ctx: { membershipId: string; profileId: string | null; schoolAccountId: string; canEditShared: boolean; creatorKind: ReturnType<typeof creatorFor>; personalCount: number; rows: SetRow[]; vcRows: VcRow[]; rankings?: SavedRanking[] };
  if (viewAs) {
    const svc = createServiceRoleSupabaseClient();
    const { data: account } = await svc.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>();
    const accountId = account?.id ?? "";
    const own = await readViewAsStore(supabase, userId, viewAs.stateKey);
    const [{ data: shared }, { data: vc }, { data: sharedRankings }, { data: ownSchools }] = await Promise.all([
      accountId
        ? readSets(svc, { schoolAccountId: accountId, kind: "compared_against" }).then(async (r) => ({ data: await withSchools(svc, r.sets.filter((x) => x.ownerScope === "school" && forTeacherPage(x, phase)), null) }))
        : Promise.resolve({ data: [] as SetRow[] }),
      accountId ? svc.from("vc_set_school_visibility").select(VC_SELECT).eq("school_account_id", accountId) : Promise.resolve({ data: [] }),
      accountId
        ? svc.from("saved_rankings").select("id, name, phase, filters").eq("school_account_id", accountId).is("owner_membership_id", null).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      own.sets.length
        ? supabase.from("schools").select("urn, current_name, la_name, establishment_type_group").in("urn", [...new Set(own.sets.flatMap((x) => x.urns))])
        : Promise.resolve({ data: [] }),
    ]);
    const schoolBy = new Map(((ownSchools ?? []) as { urn: string; current_name: string; la_name: string | null; establishment_type_group: string | null }[]).map((x) => [x.urn, x]));
    const ownRows: SetRow[] = own.sets.map((x) => ({
      id: x.id,
      name: x.name,
      shared: false,
      mine: true,
      creator: "me" as const,
      config: x.config,
      created_at: x.createdAt,
      members: x.urns.map((u) => ({ urn: u, schools: schoolBy.get(u) ?? null })),
    }));
    // As the member's own query orders them: by when each was made.
    const rows = [...((shared ?? []) as SetRow[]), ...ownRows].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    const rankings: SavedRanking[] = [
      ...((sharedRankings ?? []) as { id: string; name: string; phase: "ks4" | "ks5"; filters: SavedRanking["filters"] }[]).map((r) => ({ id: r.id, name: r.name, shared: true, mine: false, editable: viewAsMembership(viewAs.role).is_admin, phase: r.phase, filters: r.filters })),
      ...own.rankings.map((r) => ({ id: r.id, name: r.name, shared: false, mine: true, editable: true, phase: r.phase, filters: r.filters })),
    ];
    if (request.nextUrl.searchParams.get("only") === "rankings") return NextResponse.json({ rankings });
    // The viewed member's standing: may they curate the school's compared-against sets?
    const viewed = viewAsMembership(viewAs.role);
    // View as "admissions" is the lead (as the Admissions page treats it); View as is read-only anyway.
    const curator = { roles: viewed.roles, isAdmin: !!viewed.is_admin, isAccountHolder: viewed.isAccountHolder, lead: viewAs.role === "admissions" };
    const canEditShared = canCurate(curator, "compared_against");
    ctx = { membershipId: "", profileId: null, schoolAccountId: accountId, canEditShared, creatorKind: creatorFor(curator, "compared_against", "smt"), personalCount: own.sets.length, rows, vcRows: (vc ?? []) as unknown as VcRow[], rankings };
  } else {
    // The caller's OWN approved membership of this school -- the owner of any personal set
    // they make, and whether they may create or edit the school's shared sets.
    const { data: membership } = await supabase
      .from("school_memberships")
      .select("id, is_admin, roles, admissions_lead, school_account_id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id)")
      .eq("status", "approved")
      .eq("profile_id", userId)
      .eq("school_accounts.school_urn", urn)
      // Any approved row at this school proves membership: RLS shows colleagues only to members.
      .limit(1)
      .maybeSingle<{
        id: string;
        is_admin: boolean | null;
        roles: string[] | null;
        admissions_lead: boolean | null;
        school_account_id: string;
        school_accounts: { school_urn: string; account_holder_membership_id: string | null };
      }>();
    if (!membership) {
      return NextResponse.json({ error: "Teacher view is available to verified school staff." }, { status: 403 });
    }
    // 0.8 sets round 1 (A2, lead-only, Guy 7 Nov): the Admissions lead, SMT and the School-Admin (or the
    // account holder) curate the school's compared-against sets (can_curate_sets); everyone else uses them.
    const curator = { roles: membership.roles ?? [], isAdmin: !!membership.is_admin, isAccountHolder: membership.school_accounts.account_holder_membership_id === membership.id, lead: !!membership.admissions_lead };
    const canEditShared = canCurate(curator, "compared_against");

    const read = await readSets(supabase, { schoolAccountId: membership.school_account_id, profileId: userId });
    const setRows = await withSchools(supabase, read.sets.filter((x) => forTeacherPage(x, phase) && (x.ownerScope === "school" || x.ownerProfileId === userId)), userId);

    // Victoria Consultancy Sets (20261102100000): the VC-authored sets switched on for this
    // school. Read under the caller's own token, so RLS returns exactly those -- none at all
    // until VC switches one on -- and never anything writable. Ranked and charted like any
    // saved set; flagged `vc` so the chooser shows them in their own row.
    const { data: vcRows } = await supabase
      .from("vc_set_school_visibility")
      .select(VC_SELECT)
      .eq("school_account_id", membership.school_account_id);
    // 0.8 sets round 1 (B9): saved rankings follow their owner in the set menu -- the school's in
    // School sets, the member's own in My sets. Read under the member's own token (RLS), as the
    // chooser reads them.
    const { data: rankingRows } = await supabase
      .from("saved_rankings")
      .select("id, name, phase, filters, owner_membership_id")
      .eq("school_account_id", membership.school_account_id)
      .order("created_at", { ascending: true });
    const memberRankings: SavedRanking[] = ((rankingRows ?? []) as { id: string; name: string; phase: "ks4" | "ks5"; filters: SavedRanking["filters"]; owner_membership_id: string | null }[])
      .filter((r) => r.phase === phase)
      .map((r) => ({ id: r.id, name: r.name, shared: r.owner_membership_id === null, mine: r.owner_membership_id === membership.id, editable: r.owner_membership_id === membership.id || (r.owner_membership_id === null && canEditShared), phase: r.phase, filters: r.filters }));
    ctx = {
      membershipId: membership.id,
      profileId: userId,
      rankings: memberRankings,
      schoolAccountId: membership.school_account_id,
      canEditShared,
      creatorKind: creatorFor(curator, "compared_against", "smt"),
      // The cap counts every active personal set of theirs, of any kind or page.
      personalCount: activePersonalCount(read.sets, userId),
      rows: setRows,
      vcRows: (vcRows ?? []) as unknown as VcRow[],
    };
  }
  const membership = { id: ctx.membershipId, school_account_id: ctx.schoolAccountId };
  const canEditShared = ctx.canEditShared;
  const rows = ctx.rows;

  const sets = rows.map((r) => {
    const members = r.members
      .filter((m) => m.urn !== urn)
      .map((m) => ({
        urn: m.urn,
        name: m.schools?.current_name ?? m.urn,
        laName: m.schools?.la_name ?? null,
        independent: isIndependent(m.schools?.establishment_type_group ?? null),
      }));
    const { shared, mine } = r;
    return { id: r.id, name: r.name, shared, mine, creator: r.creator as SavedComparatorSet["creator"], editable: mine || (shared && canEditShared), config: r.config ?? {}, members, vc: false };
  });


  for (const v of ctx.vcRows) {
    const vc = v.vc_comparator_sets;
    if (!vc) continue;
    sets.push({
      id: vc.id,
      name: vc.name,
      shared: true,
      mine: false,
      creator: "victoria_consultancy" as const,
      editable: false,
      config: {},
      vc: true,
      members: vc.vc_comparator_set_members
        .filter((m) => m.school_urn !== urn)
        .map((m) => ({ urn: m.school_urn, name: m.schools?.current_name ?? m.school_urn, laName: m.schools?.la_name ?? null, independent: isIndependent(m.schools?.establishment_type_group ?? null) })),
    });
  }

  // 0.8 groups r3 (S): the school's own groups, each a read-only set (src/lib/groups/school-sets.ts).
  // A school in no group gets none, and the payload is exactly as before.
  const groupSets = await schoolGroupSets(urn, supabase);

  const { ranked, subjectRanked, seriesByUrn, excludedUrns } = await rankFixedSets(
    urn,
    [...sets, ...groupSets].map((s) => ({ id: s.id, urns: s.members.map((m) => m.urn) })),
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
    me: { membershipId: membership.id, schoolAccountId: membership.school_account_id, canEditShared, creatorKind: ctx.creatorKind, ...(viewAs ? { viewAs: { urn, stateKey: viewAs.stateKey } } : {}) },
    ...(ctx.rankings ? { rankings: ctx.rankings } : {}),
    cap: PERSONAL_COMPARATOR_CAP,
    personalCount: ctx.personalCount,
    // 0.8 IGCSE subjects: at GCSE a set with IGCSE members also carries them for subject views (subjectRows).
    sets: [...sets, ...groupSets].map((s) => ({ ...s, rows: ranked[s.id] ?? [], ...(subjectRanked[s.id] ? { subjectRows: subjectRanked[s.id] } : {}) })),
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
