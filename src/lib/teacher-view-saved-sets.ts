// Teacher view, accordion round Part 3: saved comparator sets -- the shared shapes, the cap,
// and the writes. Client-safe (no reference-data calls); the ranked rows and series come
// from /api/teacher/saved-comparator-sets.
//
// Writes go straight to saved_sets / saved_set_members under the caller's own session,
// the same way /sets/comparator/new saves, so RLS -- not this file -- decides who may
// create or edit what: anyone approved can make a personal set; only the account holder
// or an admin can create or edit a shared one.
import type { createBrowserSupabaseClient } from "@/lib/supabase";
import type { RankingFilters } from "@/lib/comparator-chooser";
import { cachedFetchJson } from "@/lib/fetch-cache";
import { viewAsSetsKey } from "@/lib/view-as";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

// Personal comparator sets per member. Raised from 3 to 8 (the agreed "5-10") by the
// 20260925232857_personal_comparator_cap_8 migration, which the DB trigger enforces; this
// constant is only what the UI shows ("2 / 8") and checks before trying.
export const PERSONAL_COMPARATOR_CAP = 8;

// A saved set's id as the Comparisons column keys it, so it can never collide with the
// four algorithmic ids ("nearest", "same_sector", ...).
export const SAVED_SET_PREFIX = "saved:";
export const savedSetKey = (id: string) => `${SAVED_SET_PREFIX}${id}`;

export type SetMember = { urn: string; name: string; laName: string | null; independent: boolean };

export type SavedComparatorSet = {
  id: string;
  name: string;
  shared: boolean;
  mine: boolean;
  editable: boolean;
  config: { startedFrom?: string } & Record<string, unknown>;
  members: SetMember[];
  // A Victoria Consultancy set switched on for this school (read-only, never mine).
  vc?: boolean;
  rows: { urn: string; name: string; isTarget: boolean; igcseExcluded?: boolean; distanceKm?: number | null; independent?: boolean }[];
};

export type SavedSetsPayload = {
  // 0.6 snag 4 (B): `viewAs` while a platform admin views this school as a member: their
  // own sets and rankings are then the View as's (viewAsStore below), and membershipId is "".
  me: { membershipId: string; schoolAccountId: string; canEditShared: boolean; viewAs?: { urn: string; stateKey: string } };
  // View as only: the school's shared rankings and the View as's own (a member reads
  // saved_rankings straight from the table; Guy's RLS can't, as he isn't a member).
  rankings?: SavedRanking[];
  cap: number;
  personalCount: number;
  sets: SavedComparatorSet[];
  seriesByUrn: Record<string, { results: { period: number; value: number }[]; candidates: { period: number; value: number }[] }>;
  excludedUrns: string[];
  candidates: { urn: string; name: string; distanceKm: number | null; independent: boolean; laName?: string | null }[];
  target: { laName: string | null; independent: boolean };
};

// Shared for 5 minutes (fetch-cache.ts, decision 10); `fresh` re-reads after a write.
export async function fetchSavedSets(supabase: Supa, urn: string, phase: string, opts: { fresh?: boolean } = {}): Promise<SavedSetsPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await cachedFetchJson<SavedSetsPayload>(`/api/teacher/saved-comparator-sets?urn=${encodeURIComponent(urn)}&phase=${phase}`, { token, fresh: opts.fresh });
  return res.ok ? res.body : null;
}

// Create (id null) or update a set, then replace its members. Returns the set's id, or an
// error message -- the DB's own cap exception included, which is the real backstop.
export async function saveComparatorSet(
  supabase: Supa,
  args: {
    id: string | null;
    schoolAccountId: string;
    ownerMembershipId: string | null; // null = shared (account holder / admin only)
    name: string;
    urns: string[];
    config: Record<string, unknown>;
    // View as: saved as the View as's own personal set, never to saved_sets.
    viewAs?: { stateKey: string } | null;
  },
): Promise<{ id: string } | { error: string }> {
  if (args.viewAs) {
    const id = args.id ?? newViewAsId();
    const prev = args.id ? (await readViewAsStoreAsMe(supabase, args.viewAs.stateKey)).sets.find((x) => x.id === args.id) : null;
    const body: ViewAsSetBody = { name: args.name, urns: args.urns, config: args.config, createdAt: prev?.createdAt ?? new Date().toISOString() };
    const err = await writeViewAsRow(supabase, args.viewAs.stateKey, `set:${id}`, body);
    return err ? { error: err } : { id };
  }
  let id = args.id;
  if (id === null) {
    const { data, error } = await supabase
      .from("saved_sets")
      .insert({
        school_account_id: args.schoolAccountId,
        set_type: "comparator",
        name: args.name,
        owner_membership_id: args.ownerMembershipId,
        config: args.config,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not save the set." };
    id = data.id as string;
  } else {
    const { error } = await supabase
      .from("saved_sets")
      .update({ name: args.name, config: args.config, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    const { error: delError } = await supabase.from("saved_set_members").delete().eq("saved_set_id", id);
    if (delError) return { error: delError.message };
  }
  if (args.urns.length) {
    const { error } = await supabase
      .from("saved_set_members")
      .insert(args.urns.map((urn) => ({ saved_set_id: id, school_urn: urn, member_status: "confirmed" })));
    if (error) return { error: error.message };
  }
  return { id: id! };
}

export async function deleteComparatorSet(supabase: Supa, id: string, viewAs?: { stateKey: string } | null): Promise<string | null> {
  if (viewAs) return deleteViewAsRow(supabase, viewAs.stateKey, `set:${id}`);
  const { error } = await supabase.from("saved_sets").delete().eq("id", id);
  return error ? error.message : null;
}

// ------------------------------------------------------------------ saved rankings
//
// Comparator chooser (screens 3a/3b): a saved RANKING is a named population definition,
// kept in its own table (20261102090000_saved_rankings) with saved_sets' ownership rules
// verbatim -- personal to a member, or shared (owner null, account holder / admin only),
// RLS deciding who may do what. Read straight from the table under the caller's session:
// there are no members to rank, so no server step is needed to list them.
export type SavedRanking = {
  id: string;
  name: string;
  shared: boolean;
  mine: boolean;
  editable: boolean;
  phase: "ks4" | "ks5";
  filters: RankingFilters;
};

export const PERSONAL_RANKING_CAP = 8;

export async function fetchSavedRankings(
  supabase: Supa,
  me: SavedSetsPayload["me"],
  phase: "ks4" | "ks5",
): Promise<SavedRanking[]> {
  if (me.viewAs) {
    // The school's shared rankings and the View as's own, through the route (fresh: this is
    // also the read straight after a save).
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return [];
    const res = await cachedFetchJson<{ rankings?: SavedRanking[] }>(`/api/teacher/saved-comparator-sets?urn=${encodeURIComponent(me.viewAs.urn)}&phase=${phase}&only=rankings`, { token, fresh: true });
    return (res.body?.rankings ?? []).filter((r) => r.phase === phase);
  }
  const { data } = await supabase
    .from("saved_rankings")
    .select("id, name, owner_membership_id, phase, filters")
    .eq("school_account_id", me.schoolAccountId)
    .eq("phase", phase)
    .order("created_at", { ascending: true });
  return ((data ?? []) as { id: string; name: string; owner_membership_id: string | null; phase: "ks4" | "ks5"; filters: RankingFilters }[]).map((r) => {
    const shared = r.owner_membership_id === null;
    const mine = r.owner_membership_id === me.membershipId;
    return { id: r.id, name: r.name, shared, mine, editable: mine || (shared && me.canEditShared), phase: r.phase, filters: r.filters };
  });
}

// Create (id null) or update. Save As is this with id null: always a new row.
export async function saveRanking(
  supabase: Supa,
  args: { id: string | null; schoolAccountId: string; ownerMembershipId: string | null; name: string; phase: "ks4" | "ks5"; filters: RankingFilters; viewAs?: { stateKey: string } | null },
): Promise<{ id: string } | { error: string }> {
  if (args.viewAs) {
    const id = args.id ?? newViewAsId();
    const prev = args.id ? (await readViewAsStoreAsMe(supabase, args.viewAs.stateKey)).rankings.find((x) => x.id === args.id) : null;
    const body: ViewAsRankingBody = { name: args.name, phase: args.phase, filters: args.filters, createdAt: prev?.createdAt ?? new Date().toISOString() };
    const err = await writeViewAsRow(supabase, args.viewAs.stateKey, `ranking:${id}`, body);
    return err ? { error: err } : { id };
  }
  if (args.id === null) {
    const { data, error } = await supabase
      .from("saved_rankings")
      .insert({
        school_account_id: args.schoolAccountId,
        owner_membership_id: args.ownerMembershipId,
        name: args.name,
        phase: args.phase,
        filters: args.filters,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not save the ranking." };
    return { id: data.id as string };
  }
  const { error } = await supabase
    .from("saved_rankings")
    .update({ name: args.name, filters: args.filters, updated_at: new Date().toISOString() })
    .eq("id", args.id);
  return error ? { error: error.message } : { id: args.id };
}

export async function deleteRanking(supabase: Supa, id: string, viewAs?: { stateKey: string } | null): Promise<string | null> {
  if (viewAs) return deleteViewAsRow(supabase, viewAs.stateKey, `ranking:${id}`);
  const { error } = await supabase.from("saved_rankings").delete().eq("id", id);
  return error ? error.message : null;
}

// ------------------------------------------------------------------ View as's own sets
//
// 0.6 snag 4 (B): a platform admin viewing a school as a member can save comparator sets
// and rankings of their own, as that member could -- but never into saved_sets /
// saved_rankings, which belong to the school (and need a membership he doesn't have).
// They are Guy's own teacher_view_notes rows under the View as's sets key
// (viewAsSetsKey: "{urn}~trial~{role}~sets"), one per set, chart_key "set:{id}" or
// "ranking:{id}", the body its JSON. RLS on that table is profile_id = auth.uid(), so the
// school never sees them, and no page Guy opens as himself reads notes under that key.
// No migration: teacher_view_preferences would have been the obvious home, but its phase
// CHECK (ks2/ks4/ks5) has no slot for them, and a per-set row keeps edits independent.
type ViewAsSetBody = { name: string; urns: string[]; config: Record<string, unknown>; createdAt: string };
type ViewAsRankingBody = { name: string; phase: "ks4" | "ks5"; filters: RankingFilters; createdAt: string };
export type ViewAsStore = {
  sets: ({ id: string } & ViewAsSetBody)[];
  rankings: ({ id: string } & ViewAsRankingBody)[];
};

const newViewAsId = () => `va-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

// Reads under any client whose caller is `uid` (the route passes its per-request client).
export async function readViewAsStore(supabase: { from: Supa["from"] }, uid: string, stateKey: string): Promise<ViewAsStore> {
  const { data } = await supabase
    .from("teacher_view_notes")
    .select("chart_key, body")
    .eq("profile_id", uid)
    .eq("school_urn", viewAsSetsKey(stateKey));
  const store: ViewAsStore = { sets: [], rankings: [] };
  for (const r of (data ?? []) as { chart_key: string; body: string }[]) {
    try {
      const b = JSON.parse(r.body);
      if (r.chart_key.startsWith("set:") && Array.isArray(b.urns)) store.sets.push({ id: r.chart_key.slice(4), name: String(b.name ?? ""), urns: b.urns.filter((u: unknown) => typeof u === "string"), config: b.config ?? {}, createdAt: String(b.createdAt ?? "") });
      if (r.chart_key.startsWith("ranking:") && b.filters) store.rankings.push({ id: r.chart_key.slice(8), name: String(b.name ?? ""), phase: b.phase === "ks5" ? "ks5" : "ks4", filters: b.filters, createdAt: String(b.createdAt ?? "") });
    } catch {
      // A row that isn't ours to read; skipped.
    }
  }
  const byMade = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
  store.sets.sort(byMade);
  store.rankings.sort(byMade);
  return store;
}

async function readViewAsStoreAsMe(supabase: Supa, stateKey: string): Promise<ViewAsStore> {
  const { data } = await supabase.auth.getUser();
  return data.user ? readViewAsStore(supabase, data.user.id, stateKey) : { sets: [], rankings: [] };
}

async function writeViewAsRow(supabase: Supa, stateKey: string, chartKey: string, body: unknown): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "Sign in to save.";
  const { error } = await supabase.from("teacher_view_notes").upsert(
    { profile_id: data.user.id, school_urn: viewAsSetsKey(stateKey), chart_key: chartKey, body: JSON.stringify(body), updated_at: new Date().toISOString() },
    { onConflict: "profile_id,school_urn,chart_key" },
  );
  return error ? error.message : null;
}

async function deleteViewAsRow(supabase: Supa, stateKey: string, chartKey: string): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "Sign in to save.";
  const { error } = await supabase.from("teacher_view_notes").delete().eq("profile_id", data.user.id).eq("school_urn", viewAsSetsKey(stateKey)).eq("chart_key", chartKey);
  return error ? error.message : null;
}
