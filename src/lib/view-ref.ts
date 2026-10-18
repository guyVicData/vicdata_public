// VicData 0.8 notes and feedback (docs/v0.8/vicdata_0_8_notes_feedback_claude_code_prompt_v1.md):
// what one view on one dashboard is, for the two things that attach to it -- a member's private
// note (decision 3) and a feedback item (decision 4). Framework-free: the routes, the inbox and
// the unit tests import it too.
//
// A view is the triple (dashboard, panel, view instance), all three stable ids from the dashboard's
// config (DashboardConfig.id = its slug, PanelConfig.id, DataviewInstance.id). The school is not
// part of the key: notes keep it in teacher_view_notes.school_urn (the state key in View as, as
// every per-user row), feedback in its own school_urn / group_id columns.

/** The product a dashboard belongs to, as feedback records it. */
export type ViewProduct = "teacher" | "smt" | "admissions" | "group" | "meeting" | "custom";

/** Where a view is being looked at: the page's dashboard, school or group, role and state. One
 * per page, provided by the dashboard (ViewSurfaceProvider). */
export type ViewSurface = {
  product: ViewProduct;
  dashboard: { id: string; name: string; versionId: string | null };
  scope: { kind: "school"; urn: string; name: string } | { kind: "group"; id: string; name: string; ref: string };
  // The role the page is drawn for (teacher, smt, admissions, school_admin, head_office).
  role: string;
  // In View as (the cookie) or a peek: the page is a platform admin's look at someone else's.
  viewAs: boolean;
  peek: boolean;
  // The school_urn notes are stored under: the URN, or the View as state key (stateUrn), or a
  // group's own key. null = this page can't keep notes (a peek is read-only).
  noteScope: string | null;
  // The page's own state, for the feedback item: subject, level, set, year, phase, filters, pills.
  state: Record<string, string | number | boolean | null>;
};

/** One view in one panel's rail. */
export type ViewRef = { panelId: string; panelName?: string | null; instanceId: string; dataview: string | null; label: string };

/** The note key (teacher_view_notes.chart_key) for one view. "view:" keeps it apart from the old
 * per-panel keys ("ks4:results:Biology"), the meeting slots' ("meeting:…") and View as' set rows
 * ("set:…", "ranking:…" under a "~sets" school key). */
export const viewNoteKey = (dashboardId: string, panelId: string, instanceId: string) => `view:${dashboardId}:${panelId}:${instanceId}`;

/** The key feedback groups a view's items by (feedback_items.view_key). */
export const viewKey = (dashboardId: string, panelId: string, instanceId: string) => `${dashboardId}:${panelId}:${instanceId}`;

/** The key a group page keeps its notes under (teacher_view_notes.school_urn, free text). */
export const groupNoteScope = (groupId: string, viewAs: boolean) => (viewAs ? `grp:${groupId}~trial~head_office` : `grp:${groupId}`);

// ------------------------------------------------------------------------------------ feedback

export type FeedbackStatus = "new" | "triaged" | "planned" | "done" | "wont_do";
export const FEEDBACK_STATUSES: FeedbackStatus[] = ["new", "triaged", "planned", "done", "wont_do"];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = { new: "New", triaged: "Triaged", planned: "Planned", done: "Done", wont_do: "Won't do" };

export type FeedbackType = "fix" | "data_question" | "wording" | "design" | "feature_request" | "praise" | "other";
export const FEEDBACK_TYPES: FeedbackType[] = ["fix", "data_question", "wording", "design", "feature_request", "praise", "other"];
export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = { fix: "Fix", data_question: "Data question", wording: "Wording", design: "Design", feature_request: "Feature request", praise: "Praise", other: "Other" };

export type FeedbackPriority = "high" | "normal" | "low";
export const FEEDBACK_PRIORITIES: FeedbackPriority[] = ["high", "normal", "low"];

/** Who can give feedback (app_settings 'feedback_audience'): platform admins now, beta testers at
 * 0.14, every signed-in member at launch. */
export type FeedbackAudience = "admins" | "beta" | "all";
export const FEEDBACK_AUDIENCES: FeedbackAudience[] = ["admins", "beta", "all"];

// The author's chips (Guy, 18 Oct). Hints only: the triage fields are set separately.
export const FEEDBACK_KINDS = [
  { id: "wrong_figure", label: "wrong figure" },
  { id: "wording", label: "wording or label" },
  { id: "layout", label: "layout or look" },
  { id: "missing", label: "something missing" },
  { id: "broken", label: "broken or slow" },
  { id: "idea", label: "idea or feature" },
  { id: "question", label: "question" },
  { id: "looks_good", label: "looks good" },
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]["id"];

export const FEEDBACK_IMPORTANCE = [
  { id: "before_demo", label: "before the demo" },
  { id: "should_fix", label: "should fix" },
  { id: "nice_to_have", label: "nice to have" },
] as const;
export const FEEDBACK_SCOPE = [
  { id: "this_school", label: "this school only" },
  { id: "every_school", label: "every school" },
  { id: "not_sure", label: "not sure" },
] as const;
export const FEEDBACK_APPLIES = [
  { id: "this_view", label: "this view only" },
  { id: "similar_views", label: "all similar views" },
] as const;
export const FEEDBACK_WHERE = [
  { id: "title", label: "title" },
  { id: "figure", label: "figure" },
  { id: "chart", label: "chart" },
  { id: "table", label: "table" },
  { id: "legend", label: "legend" },
  { id: "info", label: "(i) text" },
  { id: "pills", label: "pills and chips" },
] as const;

/** The short human number: F-12. */
export const feedbackNumber = (n: number) => `F-${n}`;
export const parseFeedbackNumber = (s: string | null | undefined): number | null => {
  const m = /^F-?(\d{1,9})$/i.exec((s ?? "").trim());
  return m ? Number(m[1]) : null;
};

/** What the viewer's icon needs from each of their own items on a view. */
export type FeedbackMark = { status: FeedbackStatus; looksGood: boolean; hasText: boolean; kinds: string[]; schoolKey: string };

/** Open feedback: anything more than a bare "Looks good", not yet done or won't do. */
export function isOpenFeedback(m: Pick<FeedbackMark, "status" | "looksGood" | "hasText" | "kinds">): boolean {
  if (m.status === "done" || m.status === "wont_do") return false;
  const other = m.kinds.some((k) => k !== "looks_good");
  return m.hasText || other || !m.looksGood;
}

/** The feedback icon's colour on one view (Guy, 18 Oct): yellow with open feedback (on any school),
 * green with a "Looks good" at this school and nothing open, else monochrome. Yellow wins. Like open
 * feedback, a "Looks good" counts until it is done (or won't do): once every item on the view is done,
 * the icon is monochrome (R-FEEDBACK-COLOURS). Coverage still counts a done "Looks good" as checked. */
export function feedbackColour(marks: FeedbackMark[], schoolKey: string): "open" | "good" | "none" {
  if (marks.some(isOpenFeedback)) return "open";
  if (marks.some((m) => m.looksGood && m.schoolKey === schoolKey && m.status !== "done" && m.status !== "wont_do")) return "good";
  return "none";
}

/** The scope key an item's school or group reduces to, for the colour and coverage. */
export const scopeKey = (s: ViewSurface["scope"]) => (s.kind === "school" ? `school:${s.urn}` : `group:${s.id}`);

// -------------------------------------------------------------------------- reopening a view

// The address parameters a page reads to reopen a feedback item's view: the panel and the view in
// it (RailPanel and Teacher's ColumnPanels act on them), and the item (the banner).
export const FB_ITEM_PARAM = "fb";
export const FB_PANEL_PARAM = "fbPanel";
export const FB_VIEW_PARAM = "fbView";
const OWN_PARAMS = [FB_ITEM_PARAM, FB_PANEL_PARAM, FB_VIEW_PARAM, "lookAs", "as", "peek"];

/** What an item needs for its Open link. */
export type OpenableItem = {
  number: number;
  page_path: string | null;
  page_query: string | null;
  school_urn: string | null;
  group_ref: string | null;
  role: string | null;
  panel_id: string | null;
  view_instance_id: string | null;
};

/** The Open link: the recorded page and address, looked at through a peek as the recorded school
 * (or group) and role -- read-only, never the View as cookie, never usage -- with the panel and
 * view to open and the item for the banner. */
export function feedbackOpenHref(item: OpenableItem): string | null {
  if (!item.page_path || !item.page_path.startsWith("/")) return null;
  const sp = new URLSearchParams(item.page_query ?? "");
  for (const k of OWN_PARAMS) sp.delete(k);
  const lookAs = item.group_ref ?? item.school_urn;
  if (lookAs && item.role) {
    sp.set("lookAs", lookAs);
    sp.set("as", item.role);
    sp.set("peek", "1");
  }
  sp.set(FB_ITEM_PARAM, feedbackNumber(item.number));
  if (item.panel_id) sp.set(FB_PANEL_PARAM, item.panel_id);
  if (item.view_instance_id) sp.set(FB_VIEW_PARAM, item.view_instance_id);
  return `${item.page_path}?${sp.toString()}`;
}

/** The address with the page's own reopen parameters taken out, for recording an item. */
export function recordedQuery(search: string): string {
  const sp = new URLSearchParams(search);
  for (const k of OWN_PARAMS) sp.delete(k);
  return sp.toString();
}

/** Which parts of a recorded state the address restores on each product, and which only the
 * banner shows. The report's "What Open restores" table is this. */
export const RESTORED_BY_ADDRESS: Record<ViewProduct, { restores: string[]; bannerOnly: string[] }> = {
  teacher: { restores: ["school and role (peek)", "dashboard (path)", "panel and view", "comparison set (when recorded as ?set=)", "subject (with ?set=)"], bannerOnly: ["subject (otherwise)", "Results pill", "Compare against", "comparison set (a saved or ranking set)", "year"] },
  smt: { restores: ["school and role (peek)", "dashboard (path)", "panel and view", "level and subject area", "Context's area and radius", "comparison set (when recorded as ?set=)"], bannerOnly: ["comparison set (a saved set)", "pills", "year"] },
  admissions: { restores: ["school and role (peek)", "dashboard (view=)", "entry point", "panel and view"], bannerOnly: ["day and boarding, pupils and sector filters", "rivals list", "year"] },
  group: { restores: ["group and role (peek)", "dashboard (path)", "reading, compare, focus and school", "panel and view"], bannerOnly: ["weighting", "year"] },
  meeting: { restores: ["meeting (path)"], bannerOnly: ["slide and view", "pinned settings"] },
  custom: { restores: ["dashboard (path)", "school and role (peek)", "panel and view"], bannerOnly: ["subject", "pills", "year"] },
};
