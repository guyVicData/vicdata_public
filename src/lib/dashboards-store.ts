// VicData 0.6: the one client-side way into the S2 dashboard tables (dashboards,
// dashboard_versions, dashboard_drafts, dashboard_groups, dashboard_assignments,
// dashboard_user_state). The editor (S5), library and Copy this view (S6) and meetings
// (S7) all go through here, so access rules live in RLS and the call shapes live in one
// file.
//
// Until Guy applies 20261103100000_v06_s2_dashboards.sql the tables don't exist. Every
// read then falls back to the configs seeded in code (src/catalogue/dashboards) and
// reports `available: false`, so the screens can say "not saved yet" rather than break.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardConfig } from "@/catalogue/types";
import { DASHBOARDS } from "@/catalogue/dashboards";
import { getActiveTrial, isMissingColumn, stateUrn, TRIAL_NEEDS_UPDATE } from "./trial";

export type OwnerScope = "vicdata" | "school" | "user";

export type DashboardRow = {
  id: string;
  slug: string | null;
  kind: "dashboard" | "presentation";
  owner_scope: OwnerScope;
  school_account_id: string | null;
  owner_profile_id: string | null;
  name: string;
  group_id: string | null;
  group_order: number;
  meeting_date: string | null;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VersionRow = {
  id: string;
  dashboard_id: string;
  version: number;
  schema_version: number;
  config: DashboardConfig;
  label: string | null;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
};

export type AssignmentRow = {
  id: string;
  dashboard_id: string;
  target_kind: "role" | "team" | "user";
  role: string | null;
  team_id: string | null;
  profile_id: string | null;
  mode: "live" | "copy";
  is_key: boolean;
};

export type Loaded = { row: DashboardRow; config: DashboardConfig; version: VersionRow | null; draft: DashboardConfig | null };

const ROW_COLUMNS = "id, slug, kind, owner_scope, school_account_id, owner_profile_id, name, group_id, group_order, meeting_date, published_version_id, created_at, updated_at";

// "relation does not exist" (Postgres) or PostgREST's "not in the schema cache".
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

function seededRow(config: DashboardConfig): DashboardRow {
  return {
    id: config.id,
    slug: config.id,
    kind: config.kind,
    owner_scope: config.owner,
    school_account_id: null,
    owner_profile_id: null,
    name: config.name,
    group_id: config.group?.id ?? null,
    group_order: config.group?.order ?? 0,
    meeting_date: config.presentation?.meetingDate ?? null,
    published_version_id: null,
    created_at: "",
    updated_at: "",
  };
}

// 0.6 snag 2: personal rows made in a "Try VicData as…" trial carry trial_key (the trial's
// state key, src/lib/trial.ts). Normally they are left out (trial_key is null); in a
// trial, the person's personal rows are only that trial's, while VicData and school rows
// (never trial-keyed) list as usual. Before the trials migration is applied the column
// doesn't exist: outside a trial the list is read unfiltered, inside one without
// personal rows (none of them can be the trial's).
export async function listDashboards(
  supabase: SupabaseClient,
  opts: { kind?: "dashboard" | "presentation" } = {},
): Promise<{ available: boolean; rows: DashboardRow[] }> {
  const trial = getActiveTrial();
  const base = () => {
    let q = supabase.from("dashboards").select(ROW_COLUMNS).order("group_order").order("name");
    if (opts.kind) q = q.eq("kind", opts.kind);
    return q;
  };
  // A platform admin's RLS returns every person's rows, so a trial's own are also pinned to
  // the signed-in person.
  const uid = trial ? (await supabase.auth.getSession()).data.session?.user.id ?? "" : "";
  let { data, error } = await (trial
    ? base().or(`owner_scope.neq.user,and(trial_key.eq."${trial.stateKey}",owner_profile_id.eq.${uid})`)
    : base().is("trial_key", null));
  if (error && isMissingColumn(error)) {
    ({ data, error } = await base());
    if (!error && trial) data = ((data ?? []) as DashboardRow[]).filter((r) => r.owner_scope !== "user");
  }
  if (isMissingTable(error)) {
    return { available: false, rows: DASHBOARDS.filter((d) => !opts.kind || d.kind === opts.kind).map(seededRow) };
  }
  if (error) throw error;
  return { available: true, rows: (data ?? []) as DashboardRow[] };
}

// By uuid or by slug ("vicdata.ks4.candidates"). `withDraft` also reads the editor's draft
// (RLS returns it only to editors).
export async function loadDashboard(supabase: SupabaseClient, idOrSlug: string, withDraft = false): Promise<(Loaded & { available: boolean }) | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data: row, error } = await supabase.from("dashboards").select(ROW_COLUMNS).eq(isUuid ? "id" : "slug", idOrSlug).maybeSingle<DashboardRow>();
  if (isMissingTable(error)) {
    const seed = DASHBOARDS.find((d) => d.id === idOrSlug);
    return seed ? { available: false, row: seededRow(seed), config: seed, version: null, draft: null } : null;
  }
  if (error) throw error;
  if (!row) return null;
  let version: VersionRow | null = null;
  if (row.published_version_id) {
    const { data } = await supabase.from("dashboard_versions").select("*").eq("id", row.published_version_id).maybeSingle<VersionRow>();
    version = data ?? null;
  }
  let draft: DashboardConfig | null = null;
  if (withDraft) {
    const { data } = await supabase.from("dashboard_drafts").select("config").eq("dashboard_id", row.id).maybeSingle<{ config: DashboardConfig }>();
    draft = data?.config ?? null;
  }
  const seed = row.slug ? DASHBOARDS.find((d) => d.id === row.slug) : undefined;
  const config = version?.config ?? draft ?? seed;
  if (!config) return null;
  return { available: true, row, config, version, draft };
}

export async function createDashboard(
  supabase: SupabaseClient,
  input: {
    kind: "dashboard" | "presentation";
    owner_scope: OwnerScope;
    name: string;
    owner_profile_id?: string | null;
    school_account_id?: string | null;
    meeting_date?: string | null;
    config: DashboardConfig;
  },
): Promise<DashboardRow> {
  const { config, ...cols } = input;
  // In a trial a personal dashboard or meeting is the trial's (trial_key), never attached to
  // the school's account; a school dashboard can't be made from a trial at all.
  const trial = getActiveTrial();
  if (trial && cols.owner_scope === "school") throw new Error("A trial can't create school dashboards.");
  const row = trial && cols.owner_scope === "user" ? { ...cols, school_account_id: null, trial_key: trial.stateKey } : cols;
  const { data, error } = await supabase.from("dashboards").insert(row).select(ROW_COLUMNS).single<DashboardRow>();
  if (error && trial && isMissingColumn(error)) throw new Error(TRIAL_NEEDS_UPDATE);
  if (error) throw error;
  // A new dashboard starts as a draft whose config carries its row id.
  await saveDraft(supabase, data.id, { ...config, id: data.id });
  return data;
}

export async function saveDraft(supabase: SupabaseClient, dashboardId: string, config: DashboardConfig, baseVersionId?: string | null): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const { error } = await supabase.from("dashboard_drafts").upsert({
    dashboard_id: dashboardId,
    config,
    base_version_id: baseVersionId ?? null,
    updated_by: session.session?.user.id ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function discardDraft(supabase: SupabaseClient, dashboardId: string): Promise<void> {
  const { error } = await supabase.from("dashboard_drafts").delete().eq("dashboard_id", dashboardId);
  if (error) throw error;
}

export async function publish(supabase: SupabaseClient, dashboardId: string, config: DashboardConfig, label?: string, summary?: string): Promise<string> {
  const { data, error } = await supabase.rpc("publish_dashboard", {
    p_dashboard: dashboardId,
    p_config: config,
    p_label: label ?? null,
    p_summary: summary ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listVersions(supabase: SupabaseClient, dashboardId: string): Promise<VersionRow[]> {
  const { data, error } = await supabase.from("dashboard_versions").select("*").eq("dashboard_id", dashboardId).order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VersionRow[];
}

export async function updateDashboardRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<DashboardRow, "name" | "group_id" | "group_order" | "meeting_date">>,
): Promise<void> {
  const { error } = await supabase.from("dashboards").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteDashboard(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("dashboards").delete().eq("id", id);
  if (error) throw error;
}

export async function listAssignments(supabase: SupabaseClient, dashboardId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase.from("dashboard_assignments").select("*").eq("dashboard_id", dashboardId);
  if (error) throw error;
  return (data ?? []) as AssignmentRow[];
}

export async function setAssignments(
  supabase: SupabaseClient,
  dashboardId: string,
  next: Omit<AssignmentRow, "id" | "dashboard_id">[],
): Promise<void> {
  const { error: delError } = await supabase.from("dashboard_assignments").delete().eq("dashboard_id", dashboardId);
  if (delError) throw delError;
  if (!next.length) return;
  const { error } = await supabase.from("dashboard_assignments").insert(next.map((a) => ({ ...a, dashboard_id: dashboardId })));
  if (error) throw error;
}

// The per-user state layer (G1): keyed by dashboard, school and stable panel/view ids. In a
// trial the school is the trial's state key, and the school-less "" key (UpdatedNotice's
// seen version) becomes it too, so the trial has its own "what's changed" state.
function userStateUrn(schoolUrn: string): string {
  const trial = getActiveTrial();
  return schoolUrn === "" ? trial?.stateKey ?? "" : stateUrn(schoolUrn);
}

export async function loadUserState(supabase: SupabaseClient, dashboardId: string, schoolUrn: string) {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("dashboard_user_state")
    .select("seen_version, state")
    .eq("profile_id", uid)
    .eq("dashboard_id", dashboardId)
    .eq("school_urn", userStateUrn(schoolUrn))
    .maybeSingle<{ seen_version: number | null; state: Record<string, unknown> }>();
  if (isMissingTable(error)) return null;
  if (error) throw error;
  return data;
}

export async function saveUserState(supabase: SupabaseClient, dashboardId: string, schoolUrn: string, patch: { seen_version?: number; state?: Record<string, unknown> }) {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;
  const { error } = await supabase
    .from("dashboard_user_state")
    .upsert({ profile_id: uid, dashboard_id: dashboardId, school_urn: userStateUrn(schoolUrn), ...patch, updated_at: new Date().toISOString() });
  if (error && !isMissingTable(error)) throw error;
}
