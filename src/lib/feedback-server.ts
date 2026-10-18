// VicData 0.8 notes and feedback (decision 4): the server side of feedback -- checking what an item
// may carry before it reaches the database, whose RLS decides who may send it (feedback_allowed():
// the audience setting) and who may read and triage it (the author; platform admins).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FEEDBACK_APPLIES,
  FEEDBACK_IMPORTANCE,
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SCOPE,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  FEEDBACK_WHERE,
  type ViewProduct,
} from "./view-ref";

const PRODUCTS: ViewProduct[] = ["teacher", "smt", "admissions", "group", "meeting", "custom"];

/** Postgres / PostgREST's "the table or function isn't there": the migration isn't applied. */
export function feedbackMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  // By code, or PostgREST's wording for a relation or function it doesn't know -- never by the table's
  // name alone: an RLS refusal names the table too.
  return error.code === "42P01" || error.code === "42883" || error.code === "PGRST202" || error.code === "PGRST205" || /(relation|function) .* does not exist|in the schema cache/i.test(error.message ?? "");
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);
const picks = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x)))) : []);
const ids = <T extends { id: string }>(xs: readonly T[]) => xs.map((x) => x.id);

/** The row to insert from what the page sent, or why not. The author, the status and every triage
 * field are the database's (feedback_items_on_insert); the app version is the server's. */
export function feedbackRow(input: unknown, appVersion: string | null): { row: Record<string, unknown> } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Nothing to send." };
  const b = input as Record<string, unknown>;
  const product = pick(b.product, PRODUCTS);
  const dashboardId = str(b.dashboard_id, 200);
  const viewKey = str(b.view_key, 600);
  if (!product || !dashboardId || !viewKey) return { error: "Which view is this about? (product, dashboard and view are required)" };
  const schoolUrn = str(b.school_urn, 40);
  const groupId = str(b.group_id, 80);
  if (!schoolUrn && !groupId) return { error: "Which school or group is this about?" };
  const kinds = picks(b.kinds, ids(FEEDBACK_KINDS));
  const looksGood = b.looks_good === true || kinds.includes("looks_good");
  const body = typeof b.body === "string" ? b.body.slice(0, 8000) : "";
  if (!body.trim() && !looksGood) return { error: "Write something, or choose Looks good." };
  const state = b.state && typeof b.state === "object" && !Array.isArray(b.state) ? b.state : {};
  if (JSON.stringify(state).length > 8000) return { error: "The page's state is too large to record." };
  const width = typeof b.viewport_width === "number" && Number.isFinite(b.viewport_width) ? Math.max(0, Math.min(100000, Math.round(b.viewport_width))) : null;
  return {
    row: {
      product,
      view_as: b.view_as === true,
      role: str(b.role, 40),
      school_urn: schoolUrn,
      school_name: str(b.school_name, 200),
      group_id: groupId,
      group_ref: str(b.group_ref, 120),
      group_name: str(b.group_name, 200),
      dashboard_id: dashboardId,
      dashboard_name: str(b.dashboard_name, 200),
      dashboard_version_id: str(b.dashboard_version_id, 80),
      panel_id: str(b.panel_id, 200),
      panel_name: str(b.panel_name, 200),
      view_instance_id: str(b.view_instance_id, 200),
      dataview_id: str(b.dataview_id, 120),
      view_label: str(b.view_label, 300),
      view_key: viewKey,
      state,
      page_path: str(b.page_path, 500),
      page_query: typeof b.page_query === "string" ? b.page_query.slice(0, 2000) : null,
      app_version: appVersion,
      device: pick(b.device, ["phone", "desktop"] as const),
      viewport_width: width,
      theme: pick(b.theme, ["light", "dark"] as const),
      body,
      looks_good: looksGood,
      kinds,
      importance: pick(b.importance, ids(FEEDBACK_IMPORTANCE)),
      scope: pick(b.scope, ids(FEEDBACK_SCOPE)),
      applies_to: pick(b.applies_to, ids(FEEDBACK_APPLIES)),
      saw: kinds.includes("wrong_figure") ? str(b.saw, 500) : null,
      expected: kinds.includes("wrong_figure") ? str(b.expected, 500) : null,
      where_in_view: picks(b.where_in_view, ids(FEEDBACK_WHERE)),
    },
  };
}

/** The triage fields a platform admin may change, from what the inbox sent. */
export function triagePatch(input: unknown): { patch: Record<string, unknown> } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Nothing to change." };
  const b = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (k in b) patch[k] = v;
  };
  set("type", b.type === null ? null : pick(b.type, FEEDBACK_TYPES));
  set("priority", b.priority === null ? null : pick(b.priority, FEEDBACK_PRIORITIES));
  if ("status" in b) {
    const s = pick(b.status, FEEDBACK_STATUSES);
    if (!s) return { error: "Unknown status." };
    patch.status = s;
  }
  set("planned_version", b.planned_version === null ? null : str(b.planned_version, 20));
  set("resolved_commit", b.resolved_commit === null ? null : str(b.resolved_commit, 64));
  set("wont_do_reason", b.wont_do_reason === null ? null : str(b.wont_do_reason, 2000));
  set("triage_note", b.triage_note === null ? null : str(b.triage_note, 4000));
  if ("resolved_at" in b) {
    const d = typeof b.resolved_at === "string" ? new Date(b.resolved_at) : null;
    patch.resolved_at = d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }
  if ("duplicate_of" in b) patch.duplicate_of = typeof b.duplicate_of === "string" && /^[0-9a-f-]{36}$/i.test(b.duplicate_of) ? b.duplicate_of : null;
  if (patch.status === "planned" && "planned_version" in patch && !patch.planned_version) return { error: "Planned needs a version, e.g. 0.85." };
  if (patch.status === "wont_do" && "wont_do_reason" in patch && !patch.wont_do_reason) return { error: "Won't do needs a reason." };
  if (!Object.keys(patch).length) return { error: "Nothing to change." };
  return { patch };
}

/** The deployed commit, from Render's own variable; "dev" elsewhere. */
export function appVersion(): string {
  return (process.env.RENDER_GIT_COMMIT ?? "").slice(0, 12) || "dev";
}

/** May the caller give feedback (the audience setting, decided by the database)? */
export async function feedbackAllowed(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("feedback_allowed");
  if (error) return false;
  return data === true;
}
