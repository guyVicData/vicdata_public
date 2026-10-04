// VicData 0.6 snagging round 4: "View as" -- a platform admin (Guy) seeing and editing
// VicData as one role at one school, exactly as a real single-membership member of that
// school and role would. THE one module for it (item C: built from round 2's trial.ts and
// 0.6's look-as.ts, which are gone), answering three questions:
//   1. Which school and role is this page for?  getActiveViewAs / resolveViewAs (View as),
//      pickMembership (a member's own school shown), readPeek (the Catalogue's frames).
//   2. Where does personal state go?             stateUrn / viewAsStateKey / viewAsSetsKey,
//      and trial_key on personal dashboards, meetings and jobs.
//   3. Is this caller allowed?                    confirmPlatformAdmin (pages, on every
//      load), viewAsForRequest / isPlatformAdmin (routes, server side).
//
// The one rule (item B): in View as, the page and every data route get the SAME inputs a
// real member gets -- the real URN, the same default comparator lists, the same phase
// gating, the same role offers and home. Only two things differ:
//   * where personal state goes: Guy's own rows under the state key "{urn}~trial~{role}";
//   * nothing school-wide is written (People, Teams, school dashboards, shared sets,
//     sign-in events, counts).
//
// Naming gap (kept on purpose, no migration): the database still says "trial" --
// trial_contexts, the trial_key columns, reset_trial(), and the "~trial~" in state keys --
// because renaming them would be a migration for a rename alone. Audit rows written before
// this round say try_as; new ones say view_as.
//
// The View as itself is a session cookie (VIEW_AS_COOKIE): it lasts across tabs, every
// same-origin request carries it, and it is honoured only after the caller is confirmed a
// platform admin (pages on every load, routes on every request). Framework-free (no
// React): the data routes import this too; the hooks live in components/view-as/ViewAs.tsx.
import type { SupabaseClient } from "@supabase/supabase-js";

// The note every save View as refuses carries (People, Teams, shared sets).
export const VIEW_AS_READ_ONLY = "View as: read-only";

export type ViewAsRole = "teacher" | "smt" | "admissions" | "school_admin";
export const VIEW_AS_ROLES: ViewAsRole[] = ["teacher", "smt", "admissions", "school_admin"];

export const VIEW_AS_COOKIE = "vicdata_view_as";

// Where View as keeps personal state: Guy's own rows, keyed by this instead of the URN.
export const viewAsStateKey = (urn: string, role: string) => `${urn}~trial~${role}`;

// Where a View as's own comparator sets and rankings live: Guy's own teacher_view_notes
// rows under this key (one row per set, chart_key "set:{id}" / "ranking:{id}", the body
// its JSON). No page reads notes under it, and nobody else can read Guy's notes.
export const viewAsSetsKey = (stateKey: string) => `${stateKey}~sets`;

export type ViewAsCookie = { urn: string; role: ViewAsRole; schoolName: string };
export type ViewAs = ViewAsCookie & { stateKey: string };

// The View as pair in a Cookie header (or document.cookie), or null.
export function parseViewAsCookie(cookieHeader: string | null | undefined): ViewAsCookie | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== VIEW_AS_COOKIE) continue;
    try {
      const s = JSON.parse(decodeURIComponent(part.slice(i + 1).trim())) as { u?: unknown; r?: unknown; n?: unknown };
      if (typeof s.u !== "string" || !/^[A-Za-z0-9-]{1,20}$/.test(s.u)) return null;
      if (typeof s.r !== "string" || !(VIEW_AS_ROLES as string[]).includes(s.r)) return null;
      return { urn: s.u, role: s.r as ViewAsRole, schoolName: typeof s.n === "string" && s.n ? s.n : s.u };
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeViewAsCookie(v: ViewAsCookie): string {
  return encodeURIComponent(JSON.stringify({ u: v.urn, r: v.role, n: v.schoolName }));
}

// The membership a real single-membership member of `role` holds: Teacher, SMT and
// Admissions hold that one role; a School-Admin holds Teacher (memberships default to it)
// plus is_admin. What the pages' role offers and home are worked out from.
export function viewAsMembership(role: ViewAsRole): { roles: string[]; role: string; is_admin: boolean; isAccountHolder: boolean } {
  return role === "school_admin" ? { roles: ["teacher"], role: "teacher", is_admin: true, isAccountHolder: false } : { roles: [role], role, is_admin: false, isAccountHolder: false };
}

// True only when the signed-in caller is a platform admin; any error reads as "no". Pages
// ask before honouring View as; routes ask after their member check (isPlatformAdmin), so
// a member's path is unchanged.
export async function confirmPlatformAdmin(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_platform_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}
export const isPlatformAdmin = confirmPlatformAdmin;

// Server side: is this request in View as for `urn`? Only when the cookie names this school
// AND the caller (the request's own token) is a platform admin. Anyone else's cookie is
// ignored, so they get exactly what they got without it.
export async function viewAsForRequest(
  supabase: SupabaseClient,
  request: Request,
  urn: string,
): Promise<{ urn: string; role: ViewAsRole; stateKey: string } | null> {
  const v = parseViewAsCookie(request.headers.get("cookie"));
  if (!v || v.urn !== urn) return null;
  if (!(await confirmPlatformAdmin(supabase))) return null;
  return { urn: v.urn, role: v.role, stateKey: viewAsStateKey(v.urn, v.role) };
}

// ------------------------------------------------------------------ which school is shown

// A member with more than one approved membership sees ONE school at a time, never "the
// first row": the school named by `?school=URN` (remembered in this browser), else the one
// last chosen, else the earliest approved. Every page resolves its membership with this.
export const SHOWN_SCHOOL_KEY = "vicdata.school";

export type MembershipLike = { approved_at?: string | null; school_accounts: { school_urn: string } | null };

export function shownSchoolUrn(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("school");
  if (fromUrl && /^[A-Za-z0-9-]{1,20}$/.test(fromUrl)) return fromUrl;
  try {
    return window.localStorage.getItem(SHOWN_SCHOOL_KEY);
  } catch {
    return null;
  }
}

export function pickMembership<M extends MembershipLike>(rows: M[] | null | undefined, wanted: string | null = shownSchoolUrn()): M | null {
  const list = (rows ?? []).filter((m) => m.school_accounts?.school_urn);
  if (!list.length) return null;
  const chosen = (wanted && list.find((m) => m.school_accounts!.school_urn === wanted)) || null;
  if (chosen && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("school") === wanted) {
    try {
      window.localStorage.setItem(SHOWN_SCHOOL_KEY, wanted!);
    } catch {
      // Remembered for this page only.
    }
  }
  if (chosen) return chosen;
  return [...list].sort((a, b) => (a.approved_at ?? "").localeCompare(b.approved_at ?? "") || a.school_accounts!.school_urn.localeCompare(b.school_accounts!.school_urn))[0];
}

// ------------------------------------------------------------------ the Catalogue's peek

// `?lookAs={urn}&as={role}&peek=1`: the Catalogue's side-by-side parity frames, read-only,
// never View as (they compare the two renderers and share this browser's cookies). Only
// with peek=1 -- the pair alone no longer means anything -- and only once the page has
// confirmed a platform admin. Never offered in the UI.
export type Peek = { urn: string; role: ViewAsRole };

export function readPeek(params: URLSearchParams): Peek | null {
  if (params.get("peek") !== "1") return null;
  const urn = params.get("lookAs")?.trim();
  const role = params.get("as")?.trim();
  if (!urn || !role || !/^[A-Za-z0-9-]{1,20}$/.test(urn) || !(VIEW_AS_ROLES as string[]).includes(role)) return null;
  return { urn, role: role as ViewAsRole };
}

export function peekHref(urn: string, phase: string, role: ViewAsRole = "teacher"): string {
  return `/teacher/${phase}?lookAs=${encodeURIComponent(urn)}&as=${role}&peek=1`;
}

// ------------------------------------------------------------------ this page's View as (client)

// Fired on window whenever this tab starts or ends View as.
export const VIEW_AS_EVENT = "vicdata:view-as";

function readCookie(): ViewAsCookie | null {
  try {
    return parseViewAsCookie(document.cookie);
  } catch {
    return null;
  }
}

function writeCookie(v: ViewAsCookie | null) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = v
      ? `${VIEW_AS_COOKIE}=${serializeViewAsCookie(v)}; Path=/; SameSite=Lax${secure}`
      : `${VIEW_AS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // Not in a browser.
  }
}

// The View as THIS PAGE is in, fixed when the page first asks. Another tab starting or
// ending View as changes the cookie, never this page's state: a page drawn as a member
// keeps saving as that member (and a page drawn as Guy as Guy) until it reloads --
// followViewAsAcrossTabs reloads it when the tab is next looked at. Peek frames never are.
let pinned: { value: ViewAsCookie | null } | null = null;

// The cookie as this page holds it (a stable object until it changes): what the banner and
// the pill draw from straight away, before the platform-admin check comes back.
export function viewAsSnapshot(): ViewAsCookie | null {
  if (typeof window === "undefined") return null;
  if (!pinned) pinned = { value: new URLSearchParams(window.location.search).get("peek") === "1" ? null : readCookie() };
  return pinned.value;
}

function setViewAs(v: ViewAsCookie | null) {
  writeCookie(v);
  pinned = { value: v };
  resolved = null;
  try {
    window.dispatchEvent(new Event(VIEW_AS_EVENT));
  } catch {
    // Not in a browser.
  }
}

export const toViewAs = (v: ViewAsCookie): ViewAs => ({ ...v, stateKey: viewAsStateKey(v.urn, v.role) });
const same = (a: ViewAsCookie | null, b: ViewAsCookie | null) => (a?.urn ?? "") === (b?.urn ?? "") && (a?.role ?? "") === (b?.role ?? "");

// Cross-tab: when this tab comes back into view and View as changed in another tab (a new
// school or role, or Back to me), reload, so no page ever shows one state under the other's
// banner (or none). Returns the unsubscribe.
export function followViewAsAcrossTabs(): () => void {
  const check = () => {
    if (document.visibilityState === "hidden") return;
    if (!same(viewAsSnapshot(), readCookie())) window.location.reload();
  };
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  return () => {
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", check);
  };
}

// 1. This page's View as, or null. Synchronous, for the persistence helpers; pages decide
// with resolveViewAs(), which re-confirms platform admin.
export function getActiveViewAs(): ViewAs | null {
  const v = viewAsSnapshot();
  return v ? toViewAs(v) : null;
}

// Re-confirmed on every page load: anyone not a platform admin loses it here (and the
// banner and pill, which drew from the cookie, go with it). Shared per page load.
let resolved: Promise<ViewAs | null> | null = null;
export function resolveViewAs(supabase: SupabaseClient): Promise<ViewAs | null> {
  if (resolved) return resolved;
  resolved = (async () => {
    const v = viewAsSnapshot();
    if (!v) return null;
    if (!(await confirmPlatformAdmin(supabase))) {
      setViewAs(null);
      return null;
    }
    return toViewAs(v);
  })();
  return resolved;
}

// 2. The school_urn to write per-user state under: the state key while viewing this school
// as someone, else the school's own URN.
export function stateUrn(urn: string): string {
  const v = getActiveViewAs();
  return v && v.urn === urn ? v.stateKey : urn;
}

// Postgres "undefined_column" / PostgREST's wording for it: the trial_key migration
// (20261105090000_v06_snag2_trials) isn't applied.
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .*trial_key.* does not exist|trial_key/i.test(error.message ?? "");
}

export const VIEW_AS_NEEDS_UPDATE = "Saving this in View as needs the database update (20261105090000_v06_snag2_trials).";

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42883" || /does not exist|schema cache|could not find the function/i.test(error.message ?? "");
}

// Start fresh: clears this school + role's walkthrough and saved state. reset_trial does it
// in one call; without it the same deletes go straight to the tables (RLS limits them to
// the caller's own rows, the state key to this View as). Its own comparator sets (under
// viewAsSetsKey) are things made, and are kept -- as its dashboards, meetings and jobs are.
export async function resetViewAsState(supabase: SupabaseClient, urn: string, role: ViewAsRole): Promise<void> {
  const { error } = await supabase.rpc("reset_trial", { p_urn: urn, p_role: role });
  if (!error) return;
  if (!isMissingRelation(error)) throw error;
  const key = viewAsStateKey(urn, role);
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return;
  for (const table of ["teacher_view_preferences", "teacher_view_notes", "teacher_view_onboarding", "dashboard_user_state"]) {
    const { error: e } = await supabase.from(table).delete().eq("profile_id", uid).eq("school_urn", key);
    if (e && !isMissingRelation(e)) throw e;
  }
}

async function schoolNameOf(supabase: SupabaseClient, urn: string): Promise<string> {
  const { data } = await supabase.from("schools").select("current_name").eq("urn", urn).maybeSingle<{ current_name: string }>();
  return data?.current_name ?? urn;
}

// Start (or restart) View as: confirm platform admin, log view_as {role, fresh}, optionally
// Start fresh, record it in "Recently viewed as", and make it this browser's View as.
export async function startViewAs(
  supabase: SupabaseClient,
  input: { urn: string; role: ViewAsRole; fresh: boolean; schoolName?: string },
): Promise<{ ok: true; viewAs: ViewAs } | { ok: false; error: string }> {
  if (!(await confirmPlatformAdmin(supabase))) return { ok: false, error: "Only platform admins can view VicData as a member." };
  const { error: logError } = await supabase.rpc("log_platform_action", {
    p_action: "view_as",
    p_school_urn: input.urn,
    p_detail: { role: input.role, fresh: input.fresh },
  });
  if (logError) return { ok: false, error: `Could not start View as: ${logError.message}` };
  try {
    if (input.fresh) await resetViewAsState(supabase, input.urn, input.role);
  } catch (e) {
    return { ok: false, error: `Could not start fresh: ${(e as Error).message}` };
  }
  await touchRecent(supabase, input.urn, input.role);
  const schoolName = input.schoolName ?? (await schoolNameOf(supabase, input.urn));
  const v = { urn: input.urn, role: input.role, schoolName };
  setViewAs(v);
  return { ok: true, viewAs: toViewAs(v) };
}

// Back to me.
export function exitViewAs(): void {
  setViewAs(null);
}

// The viewed school as the member pages need it: its name, and its school account if it
// has one (read only: which school dashboards and sets a member of it would see).
export async function viewAsSchool(supabase: SupabaseClient, v: ViewAs): Promise<{ urn: string; name: string; accountId: string }> {
  const { data } = await supabase.from("school_accounts").select("id").eq("school_urn", v.urn).maybeSingle<{ id: string }>();
  return { urn: v.urn, name: v.schoolName, accountId: data?.id ?? "" };
}

// ------------------------------------------------------------------ Recently viewed as

export type RecentViewAs = { urn: string; role: ViewAsRole; schoolName: string; lastUsedAt: string };

const LOCAL_RECENT = "vicdata.trial.recent";

async function touchRecent(supabase: SupabaseClient, urn: string, role: ViewAsRole) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return;
  const { error } = await supabase.from("trial_contexts").upsert({ profile_id: uid, school_urn: urn, role, last_used_at: new Date().toISOString() }, { onConflict: "profile_id,school_urn,role" });
  if (error && !isMissingRelation(error)) console.error("trial_contexts:", error.message);
  rememberLocally(urn, role);
}

// Without trial_contexts, "Recently viewed as" and the Start-fresh default fall back to
// this browser's own list.
function rememberLocally(urn: string, role: ViewAsRole) {
  try {
    const list = JSON.parse(window.localStorage.getItem(LOCAL_RECENT) ?? "[]") as { urn: string; role: ViewAsRole; at: string }[];
    const next = [{ urn, role, at: new Date().toISOString() }, ...list.filter((x) => !(x.urn === urn && x.role === role))].slice(0, 20);
    window.localStorage.setItem(LOCAL_RECENT, JSON.stringify(next));
  } catch {
    // A convenience only.
  }
}

function localRecent(): { urn: string; role: ViewAsRole; at: string }[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(LOCAL_RECENT) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.urn === "string" && (VIEW_AS_ROLES as string[]).includes(x.role)) : [];
  } catch {
    return [];
  }
}

export async function listRecentViewAs(supabase: SupabaseClient, limit = 5): Promise<RecentViewAs[]> {
  const { data, error } = await supabase.from("trial_contexts").select("school_urn, role, last_used_at").order("last_used_at", { ascending: false }).limit(limit);
  const rows: { urn: string; role: ViewAsRole; at: string }[] = error
    ? localRecent().slice(0, limit)
    : ((data ?? []) as { school_urn: string; role: ViewAsRole; last_used_at: string }[]).map((r) => ({ urn: r.school_urn, role: r.role, at: r.last_used_at }));
  if (!rows.length) return [];
  const { data: schools } = await supabase.from("schools").select("urn, current_name").in("urn", [...new Set(rows.map((r) => r.urn))]);
  const names = new Map(((schools ?? []) as { urn: string; current_name: string }[]).map((x) => [x.urn, x.current_name]));
  return rows.map((r) => ({ urn: r.urn, role: r.role, schoolName: names.get(r.urn) ?? r.urn, lastUsedAt: r.at }));
}

// Has Guy viewed this school as this role before? (Start fresh is ticked when not.)
export async function hasViewedAs(supabase: SupabaseClient, urn: string, role: ViewAsRole): Promise<boolean> {
  const { data, error } = await supabase.from("trial_contexts").select("role").eq("school_urn", urn).eq("role", role).maybeSingle();
  if (error) return localRecent().some((x) => x.urn === urn && x.role === role);
  return !!data;
}
