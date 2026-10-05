// VicData 0.6 S7: meetings through the S2 dashboard tables. A meeting is a dashboards row
// of kind "presentation", owner scope "user" (meetings are personal today), with
// meeting_date set; its config is a DashboardConfig whose `presentation` holds the slides.
//
// Everything goes through src/lib/dashboards-store.ts except one batched read (the
// library's slide counts), which the store has no call for yet -- proposed for it in the
// night-2 report.
//
// Drafts and versions (scope brief §4.8, "applies to meetings too"): edits autosave to the
// draft; a version is published when a meeting is made, and at the natural checkpoints
// (Present, Grid view, Export PDF, leaving the editor) when the draft has changed.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardConfig, SlideConfig } from "@/catalogue/types";
import { upgradeConfig } from "@/catalogue/viewspec";
import {
  createDashboard,
  isMissingTable,
  listDashboards,
  loadDashboard,
  publish,
  saveDraft,
  updateDashboardRow,
  type DashboardRow,
  type VersionRow,
} from "./dashboards-store";
import { changeSummary, isArchived, localToday, newMeetingConfig, reuseSlides } from "./meeting-ops";
import { dataAsOf } from "./meeting-views";
import { getActiveViewAs, viewAsSchool } from "./view-as";
import { pickMembership } from "./view-as";

export type MeetingSummary = {
  id: string;
  name: string;
  meetingDate: string | null;
  slideCount: number;
  dataAsOf: string | null;
  archived: boolean;
  config: DashboardConfig | null;
};

// The plain line the pages show while the S2 tables aren't there.
export const NOT_APPLIED_LINE = "Meetings move to the new format once the database update is applied.";

// The cap trigger's error ("personal meeting limit reached (5)") and the rest, as one
// friendly line.
export function friendlyMeetingError(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const m = /personal meeting limit reached \((\d+)\)/i.exec(err?.message ?? "");
  if (m) return `You already have ${m[1]} upcoming meetings, the most your account allows. A meeting moves to the Archive the day after its date, and archived meetings don't count.`;
  if (err && isMissingTable(err)) return NOT_APPLIED_LINE;
  if (/not allowed|permission|row-level security/i.test(err?.message ?? "")) return "You can't change this meeting.";
  return "That didn't save. Check your connection and try again.";
}

export function slidesOf(config: DashboardConfig | null | undefined): SlideConfig[] {
  return config?.presentation?.slides ?? [];
}

export async function listMeetings(supabase: SupabaseClient, today = localToday()): Promise<{ available: boolean; meetings: MeetingSummary[] }> {
  const { available, rows } = await listDashboards(supabase, { kind: "presentation" });
  if (!available) return { available: false, meetings: [] };
  const configs = await configsFor(supabase, rows);
  const meetings = rows.map((row) => {
    const config = configs.get(row.id) ?? null;
    const slides = slidesOf(config);
    return {
      id: row.id,
      name: row.name,
      meetingDate: row.meeting_date,
      slideCount: slides.length,
      dataAsOf: dataAsOf(slides),
      archived: isArchived(row.meeting_date, today),
      config,
    };
  });
  // Upcoming soonest first; the archive most recent first.
  meetings.sort((a, b) => {
    const c = (a.meetingDate ?? "").localeCompare(b.meetingDate ?? "");
    return a.archived && b.archived ? -c : c;
  });
  return { available: true, meetings };
}

// Draft (the owner's working copy) wins over the published version for the editor.
async function configsFor(supabase: SupabaseClient, rows: DashboardRow[]): Promise<Map<string, DashboardConfig>> {
  const out = new Map<string, DashboardConfig>();
  if (!rows.length) return out;
  const versionIds = rows.map((r) => r.published_version_id).filter((v): v is string => !!v);
  const [versions, drafts] = await Promise.all([
    versionIds.length
      ? supabase.from("dashboard_versions").select("dashboard_id, config").in("id", versionIds)
      : Promise.resolve({ data: [] as { dashboard_id: string; config: DashboardConfig }[] }),
    supabase.from("dashboard_drafts").select("dashboard_id, config").in("dashboard_id", rows.map((r) => r.id)),
  ]);
  // 0.6.1 S2: a v1 meeting (text slots and all) is converted on read (upgradeConfig).
  for (const v of (versions.data ?? []) as { dashboard_id: string; config: DashboardConfig }[]) out.set(v.dashboard_id, upgradeConfig(v.config));
  for (const d of (drafts.data ?? []) as { dashboard_id: string; config: DashboardConfig }[]) out.set(d.dashboard_id, upgradeConfig(d.config));
  return out;
}

export type LoadedMeeting = {
  available: boolean;
  row: DashboardRow;
  config: DashboardConfig;
  version: VersionRow | null;
  // The published config, for "has the draft changed since?" and the change summary.
  published: DashboardConfig | null;
  // Who owns it: only the owner edits (and only before the meeting date passes).
  isOwner: boolean;
};

export async function loadMeeting(supabase: SupabaseClient, id: string): Promise<LoadedMeeting | null> {
  const loaded = await loadDashboard(supabase, id, true);
  if (!loaded) return null;
  if (loaded.row.kind !== "presentation") return null;
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id ?? null;
  const config = withRow(loaded.draft ?? loaded.version?.config ?? loaded.config, loaded.row);
  return {
    available: loaded.available,
    row: loaded.row,
    config,
    version: loaded.version,
    published: loaded.version?.config ?? null,
    isOwner: !!uid && loaded.row.owner_profile_id === uid,
  };
}

// The row is the source of truth for name and date; keep the config's copies in step.
function withRow(config: DashboardConfig, row: DashboardRow): DashboardConfig {
  return {
    ...config,
    id: row.id,
    name: row.name,
    kind: "presentation",
    presentation: { ...(config.presentation ?? { slides: [] }), meetingDate: row.meeting_date ?? config.presentation?.meetingDate },
  };
}

export async function createMeeting(
  supabase: SupabaseClient,
  input: { name: string; meetingDate: string; slides?: SlideConfig[]; schoolAccountId?: string | null; label?: string },
): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("not signed in");
  const config = newMeetingConfig({ name: input.name, meetingDate: input.meetingDate, slides: input.slides });
  const row = await createDashboard(supabase, {
    kind: "presentation",
    owner_scope: "user",
    owner_profile_id: uid,
    school_account_id: input.schoolAccountId ?? null,
    name: input.name,
    meeting_date: input.meetingDate,
    config,
  });
  await publish(supabase, row.id, { ...config, id: row.id }, input.label ?? "Created", changeSummary(null, slidesOf(config)));
  return row.id;
}

export async function saveMeeting(supabase: SupabaseClient, id: string, config: DashboardConfig, baseVersionId?: string | null): Promise<void> {
  await saveDraft(supabase, id, config, baseVersionId ?? null);
}

export async function publishMeeting(supabase: SupabaseClient, id: string, config: DashboardConfig, previous: DashboardConfig | null, label?: string): Promise<string> {
  return publish(supabase, id, config, label, changeSummary(previous ? slidesOf(previous) : null, slidesOf(config)));
}

export async function updateMeetingDetails(supabase: SupabaseClient, id: string, patch: { name?: string; meetingDate?: string }): Promise<void> {
  await updateDashboardRow(supabase, id, {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.meetingDate !== undefined ? { meeting_date: patch.meetingDate } : {}),
  });
}

// "Reuse for next meeting" (MeetingsArchive.dc.html): a new meeting with a new date and
// the same slides, optionally with every pinned view moved on to the latest data.
export async function reuseMeeting(
  supabase: SupabaseClient,
  source: { name: string; config: DashboardConfig | null },
  opts: { meetingDate: string; rollForward: boolean },
): Promise<string> {
  const slides = reuseSlides(slidesOf(source.config), opts.rollForward);
  return createMeeting(supabase, {
    name: source.name,
    meetingDate: opts.meetingDate,
    slides: slides.length ? slides : undefined,
    label: opts.rollForward ? "Reused, moved on to the latest data" : "Reused",
  });
}

// G9: how many upcoming meetings this person may hold. null = unlimited (super-admin).
export async function meetingCap(supabase: SupabaseClient): Promise<number | null> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return 5;
  // View as: the cap of the member being viewed (School-Admin 20, everyone else 5), not
  // Guy's own (none).
  const viewAs = getActiveViewAs();
  if (viewAs) return viewAs.role === "school_admin" ? 20 : 5;
  const { data: admin } = await supabase.rpc("is_platform_admin");
  if (admin === true) return null;
  // 0.6 snag 4: at the school shown (pickMembership), not any school.
  const { data } = await supabase
    .from("school_memberships")
    .select("is_admin, approved_at, school_accounts!school_memberships_school_account_id_fkey(school_urn)")
    .eq("profile_id", uid)
    .eq("status", "approved");
  return pickMembership((data ?? []) as unknown as { is_admin: boolean; approved_at: string | null; school_accounts: { school_urn: string } | null }[])?.is_admin ? 20 : 5;
}

// The signed-in person's school (for pinning new views and keeping slot notes), from
// their own approved membership -- or, in View as, the viewed school.
export async function mySchool(supabase: SupabaseClient): Promise<{ urn: string; name: string; accountId: string } | null> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return null;
  const trial = getActiveViewAs();
  if (trial) return viewAsSchool(supabase, trial);
  // 0.6 snag 4: the school shown (pickMembership), never "the first row".
  const { data: rows } = await supabase
    .from("school_memberships")
    .select("school_account_id, approved_at, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
    .eq("profile_id", uid)
    .eq("status", "approved");
  const data = pickMembership((rows ?? []) as unknown as { school_account_id: string; approved_at: string | null; school_accounts: { school_urn: string; schools: { current_name: string } | null } | null }[]);
  const a = data?.school_accounts;
  return a ? { urn: a.school_urn, name: a.schools?.current_name ?? a.school_urn, accountId: data!.school_account_id } : null;
}
