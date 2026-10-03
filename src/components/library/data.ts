// VicData 0.6 S6: what the library (/dashboards), the role homes and Copy this view read.
// Everything goes through src/lib/dashboards-store.ts's table names and RLS; the batched
// reads here (configs, assignments) are the ones the store has no call for yet.
//
// Before the S2 migration is applied, listDashboards answers from the configs seeded in
// code with `available: false`, and so does everything here.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardConfig } from "@/catalogue/types";
import { DASHBOARDS } from "@/catalogue/dashboards";
import { isMissingTable, listDashboards, type AssignmentRow, type DashboardRow } from "@/lib/dashboards-store";
import { shapeLine, type Me } from "@/lib/copy-view";
import { canEditRow } from "@/lib/copy-view";
import { visibleRolesOf, VISIBLE_ROLE_LABELS, type VisibleRoleId } from "@/lib/roles";

export type MyMembership = {
  id: string;
  school_account_id: string;
  is_admin: boolean;
  roles: string[] | null;
  role: string | null;
  school_accounts: { school_urn: string; account_holder_membership_id: string | null; schools: { current_name: string } | null } | null;
};

export type Viewer = Me & {
  // The signed-in person's school (their approved membership), if any.
  school: { urn: string; name: string; accountId: string } | null;
  roles: VisibleRoleId[];
};

export async function loadViewer(supabase: SupabaseClient): Promise<Viewer> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id ?? null;
  if (!uid) return { uid: null, superAdmin: false, adminAccountIds: [], school: null, roles: [] };
  const [{ data: admin }, { data: ms }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase
      .from("school_memberships")
      .select("id, school_account_id, is_admin, roles, role, school_accounts!school_memberships_school_account_id_fkey(school_urn, account_holder_membership_id, schools(current_name))")
      .eq("profile_id", uid)
      .eq("status", "approved"),
  ]);
  const mine = (ms ?? []) as unknown as MyMembership[];
  const first = mine[0];
  const holder = (m: MyMembership) => m.school_accounts?.account_holder_membership_id === m.id;
  return {
    uid,
    superAdmin: admin === true,
    adminAccountIds: mine.filter((m) => m.is_admin || holder(m)).map((m) => m.school_account_id),
    school: first?.school_accounts ? { urn: first.school_accounts.school_urn, name: first.school_accounts.schools?.current_name ?? first.school_accounts.school_urn, accountId: first.school_account_id } : null,
    roles: first ? visibleRolesOf({ roles: first.roles, role: first.role, is_admin: first.is_admin, isAccountHolder: holder(first) }) : [],
  };
}

// The config each row shows: the published version, else the draft (editors only, by RLS),
// else the seed of the same slug.
export async function configsFor(supabase: SupabaseClient, rows: DashboardRow[]): Promise<Map<string, DashboardConfig>> {
  const out = new Map<string, DashboardConfig>();
  if (!rows.length) return out;
  const versionIds = rows.map((r) => r.published_version_id).filter((v): v is string => !!v);
  const [versions, drafts] = await Promise.all([
    versionIds.length ? supabase.from("dashboard_versions").select("dashboard_id, config").in("id", versionIds) : Promise.resolve({ data: [] }),
    supabase.from("dashboard_drafts").select("dashboard_id, config").in("dashboard_id", rows.map((r) => r.id)),
  ]);
  for (const d of (drafts.data ?? []) as { dashboard_id: string; config: DashboardConfig }[]) out.set(d.dashboard_id, d.config);
  for (const v of (versions.data ?? []) as { dashboard_id: string; config: DashboardConfig }[]) out.set(v.dashboard_id, v.config);
  for (const r of rows) {
    if (out.has(r.id)) continue;
    const seed = r.slug ? DASHBOARDS.find((d) => d.id === r.slug) : undefined;
    if (seed) out.set(r.id, seed);
  }
  return out;
}

export async function assignmentsFor(supabase: SupabaseClient, ids: string[]): Promise<AssignmentRow[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("dashboard_assignments").select("*").in("dashboard_id", ids);
  if (error) return [];
  return (data ?? []) as AssignmentRow[];
}

// /dashboards/[id] takes the slug when there is one ("vicdata.ks4.candidates").
export function dashboardHref(row: Pick<DashboardRow, "id" | "slug">): string {
  return `/dashboards/${encodeURIComponent(row.slug ?? row.id)}`;
}

export type Owner = "vicdata" | "school" | "mine";

export type LibraryEntry = {
  row: DashboardRow;
  config: DashboardConfig;
  owner: Owner;
  // The card's top-right label: "VicData", the school's name, "Mine" (or "Shared").
  ownerLabel: string;
  // The card's second line: "Linked: Results", "Shared with SMT", "2 columns · 1 row".
  sub: string;
  href: string;
  editable: boolean;
};

const roleWords = (roles: string[]) =>
  roles.map((r) => VISIBLE_ROLE_LABELS[r as VisibleRoleId] ?? r).filter((v, i, a) => a.indexOf(v) === i);

function subLine(row: DashboardRow, config: DashboardConfig, all: { row: DashboardRow; config: DashboardConfig }[], assigned: AssignmentRow[]): string {
  if (config.group) {
    const others = all
      .filter((x) => x.row.id !== row.id && x.config.group?.id === config.group!.id)
      .map((x) => x.config.name.replace(new RegExp(`^${config.group!.label}\\s+`), ""));
    if (others.length) return `Linked: ${others.join(", ")}`;
  }
  if (row.owner_scope === "user") return shapeLine(config);
  const roles = roleWords(assigned.filter((a) => a.target_kind === "role" && a.role).map((a) => a.role!));
  const teams = assigned.filter((a) => a.target_kind === "team").length;
  const parts = [...roles, ...(teams ? [`${teams} team${teams === 1 ? "" : "s"}`] : [])];
  return parts.length ? `Shared with ${parts.join(", ")}` : row.owner_scope === "school" ? "Not shared yet" : shapeLine(config);
}

export async function loadLibrary(supabase: SupabaseClient, viewer: Viewer): Promise<{ available: boolean; entries: LibraryEntry[] }> {
  const { available, rows: all } = await listDashboards(supabase, { kind: "dashboard" });
  // Super-admin's RLS returns every school's and every person's dashboards; the library
  // shows them VicData's, their own school's and their own (Main.dc.html's three owners).
  const rows = viewer.superAdmin
    ? all.filter((r) => r.owner_scope === "vicdata" || (r.owner_scope === "user" && r.owner_profile_id === viewer.uid) || (r.owner_scope === "school" && r.school_account_id === viewer.school?.accountId))
    : all;
  const configs = available ? await configsFor(supabase, rows) : new Map(rows.map((r) => [r.id, DASHBOARDS.find((d) => d.id === r.id)!] as const));
  const assignments = available ? await assignmentsFor(supabase, rows.map((r) => r.id)) : [];
  const withConfig = rows.filter((r) => configs.get(r.id)).map((row) => ({ row, config: configs.get(row.id)! }));
  const entries = withConfig.map(({ row, config }) => {
    const owner: Owner = row.owner_scope === "vicdata" ? "vicdata" : row.owner_scope === "school" ? "school" : "mine";
    const mine = row.owner_scope === "user" && row.owner_profile_id === viewer.uid;
    return {
      row,
      config,
      owner,
      ownerLabel: owner === "vicdata" ? "VicData" : owner === "school" ? (viewer.school?.accountId === row.school_account_id ? viewer.school.name : "School") : mine ? "Mine" : "Shared",
      sub: subLine(row, config, withConfig, assignments.filter((a) => a.dashboard_id === row.id)),
      href: dashboardHref(row),
      editable: available && canEditRow(row, viewer),
    };
  });
  const order: Record<Owner, number> = { vicdata: 0, school: 1, mine: 2 };
  // Owner, then linked dashboards together in their switcher order (GCSE Candidates, GCSE
  // Results, Post-16 Candidates...), then by name.
  const groupKey = (e: LibraryEntry) => e.config.group?.label ?? e.config.name;
  entries.sort(
    (a, b) =>
      order[a.owner] - order[b.owner] ||
      groupKey(a).localeCompare(groupKey(b)) ||
      (a.config.group?.order ?? 0) - (b.config.group?.order ?? 0) ||
      a.config.name.localeCompare(b.config.name),
  );
  return { available, entries };
}

// The key dashboards of one role (scope brief §4.10): VicData dashboards assigned to that
// role with "Key VicData dashboard" on. RLS returns only what this person may read.
export async function loadKeyDashboards(supabase: SupabaseClient, role: VisibleRoleId): Promise<{ available: boolean; entries: { row: DashboardRow; config: DashboardConfig; href: string }[] }> {
  const { data, error } = await supabase
    .from("dashboard_assignments")
    .select("dashboard_id, role, is_key, target_kind")
    .eq("target_kind", "role")
    .eq("role", role)
    .eq("is_key", true);
  if (isMissingTable(error)) return { available: false, entries: [] };
  if (error) return { available: true, entries: [] };
  const ids = [...new Set(((data ?? []) as { dashboard_id: string }[]).map((a) => a.dashboard_id))];
  if (!ids.length) return { available: true, entries: [] };
  const { data: rows } = await supabase
    .from("dashboards")
    .select("id, slug, kind, owner_scope, school_account_id, owner_profile_id, name, group_id, group_order, meeting_date, published_version_id, created_at, updated_at")
    .in("id", ids)
    .eq("owner_scope", "vicdata");
  const list = ((rows ?? []) as DashboardRow[]).sort((a, b) => a.name.localeCompare(b.name));
  const configs = await configsFor(supabase, list);
  return { available: true, entries: list.filter((r) => configs.has(r.id)).map((row) => ({ row, config: configs.get(row.id)!, href: dashboardHref(row) })) };
}
