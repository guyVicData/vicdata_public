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

// 0.8 View as: head office of a group is a View as role too, in the SAME cookie (groups r1 kept its
// own, vicdata_view_as_group, now retired). A group is not a school, so the cookie names the group
// account instead: {r: "head_office", g: account id, n: name}. parseViewAsCookie reads it as "no
// school View as"; parseViewAsGroup reads it. One cookie, so only one View as is ever active.
export const HEAD_OFFICE_ROLE = "head_office";
export const LEGACY_VIEW_AS_GROUP_COOKIE = "vicdata_view_as_group";
export type ViewAsGroup = { accountId: string; name: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 0.8 View as fixes (item 3): head office of ANY group, account or not. A group with no group account is
// named by its production group id in the account's place: "group:{group_id}" ("group:3320",
// "group:club_iss:dukes-education", "group:ch:01234567"). Only a platform admin's View as or peek ever
// carries one; the server builds that group's read-only head office from the group lookups
// (groups/server.ts, groupCaller), with no Access page and no account features.
export const NO_ACCOUNT_PREFIX = "group:";
const GROUP_REF = /^group:[A-Za-z0-9_:.-]{1,80}$/;
/** An account id, or a group without an account ("group:{group_id}"); null if neither. */
export function viewAsGroupRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (UUID.test(value)) return value.toLowerCase();
  return GROUP_REF.test(value) ? value : null;
}
/** The production group id of a "group:{group_id}" reference, or null for an account id. */
export const noAccountGroupId = (ref: string): string | null => (ref.startsWith(NO_ACCOUNT_PREFIX) ? ref.slice(NO_ACCOUNT_PREFIX.length) : null);

export function parseViewAsGroup(cookieHeader: string | null | undefined): ViewAsGroup | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== VIEW_AS_COOKIE) continue;
    try {
      const s = JSON.parse(decodeURIComponent(part.slice(i + 1).trim())) as { r?: unknown; g?: unknown; n?: unknown };
      const ref = s.r === HEAD_OFFICE_ROLE ? viewAsGroupRef(s.g) : null;
      if (!ref) return null;
      return { accountId: ref, name: typeof s.n === "string" && s.n ? s.n.slice(0, 160) : "the group" };
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeViewAsGroup(g: ViewAsGroup): string {
  return encodeURIComponent(JSON.stringify({ r: HEAD_OFFICE_ROLE, g: g.accountId, n: g.name }));
}

// ------------------------------------------------------------------ who is this request for?

// 0.8 View as: THE decision every route makes about its caller, through the one server helper
// (view-as-server.ts, resolveCaller). Pure, so it is tested on its own.
//
//   member      the caller's own approved membership at this school, with a role the product allows
//   viewAs      a platform admin whose View as names this school: the viewed role's membership,
//               read-only (whether or not they are also a member here)
//   headOffice  head office of a group reading a member school (or a platform admin viewing as that
//               head office), read-only, where the product allows head office
//   peek        a platform admin with no View as for this school (the Catalogue's ?peek=1 frames,
//               scripts and harnesses): read-only
//
// A member's path never changes: without a View as cookie their request is decided by their own
// membership, and the platform-admin check is only asked when there is a cookie or no membership.
export type CallerAccess = "member" | "viewAs" | "headOffice" | "peek";
export type CallerRoles = { roles: string[]; isAdmin: boolean; isAccountHolder: boolean };
export type CallerDecision = CallerRoles & { access: CallerAccess; readOnly: boolean; viewAsRole: ViewAsRole | null };

export function decideCaller(input: {
  urn: string;
  viewAs: ViewAsCookie | null;
  group: ViewAsGroup | null;
  platformAdmin: boolean;
  member: CallerRoles | null;
  // Which roles this product is for (Teacher: any approved member; SMT: SMT or the School-Admin...).
  allowed: (r: CallerRoles) => boolean;
  // Only for products head office reads, and only once it is known: may head office (the caller's own,
  // or the group a platform admin is viewing as) read this school?
  headOffice: boolean | null;
}): CallerDecision | null {
  const { urn, viewAs, group, platformAdmin, member, allowed, headOffice } = input;
  if (platformAdmin && viewAs && viewAs.urn === urn) {
    const m = viewAsMembership(viewAs.role);
    const r = { roles: m.roles, isAdmin: m.is_admin, isAccountHolder: false };
    return allowed(r) ? { ...r, access: "viewAs", readOnly: true, viewAsRole: viewAs.role } : null;
  }
  // Viewing as head office, where the product has head office: exactly what that head office sees.
  if (platformAdmin && group && headOffice !== null) return headOffice ? { roles: [], isAdmin: false, isAccountHolder: false, access: "headOffice", readOnly: true, viewAsRole: null } : null;
  if (member && allowed(member)) return { ...member, access: "member", readOnly: false, viewAsRole: null };
  if (platformAdmin) return { roles: [], isAdmin: false, isAccountHolder: false, access: "peek", readOnly: true, viewAsRole: null };
  if (headOffice) return { roles: [], isAdmin: false, isAccountHolder: false, access: "headOffice", readOnly: true, viewAsRole: null };
  return null;
}

// The membership a real single-membership member of `role` holds: Teacher, SMT and
// Admissions hold that one role; a School-Admin holds Teacher (memberships default to it)
// plus is_admin. What the pages' role offers and home are worked out from.
export function viewAsMembership(role: ViewAsRole): { roles: string[]; role: string; is_admin: boolean; isAccountHolder: boolean } {
  return role === "school_admin" ? { roles: ["teacher"], role: "teacher", is_admin: true, isAccountHolder: false } : { roles: [role], role, is_admin: false, isAccountHolder: false };
}

// 0.8 View as fixes: is the signed-in caller a platform admin? "yes" and "no" are the database's own
// answer; "unknown" is anything else -- an error, a timeout, or a request the browser cancelled because
// the page was being left. The cause of Guy's View as landing on his own school (18 Oct): the nav's
// re-check after "Open their home page" was cancelled by that very navigation, read as "no", and
// cleared the cookie. Only a definite "no" may ever end View as. An unknown answer is asked again
// (`retries`, a short wait between) before it is returned.
export type AdminCheck = "yes" | "no" | "unknown";
export async function checkPlatformAdmin(supabase: SupabaseClient, retries = 0): Promise<AdminCheck> {
  for (let attempt = 0; ; attempt++) {
    let answer: AdminCheck = "unknown";
    try {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (!error && typeof data === "boolean") answer = data ? "yes" : "no";
    } catch {
      answer = "unknown";
    }
    if (answer !== "unknown" || attempt >= retries) return answer;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
}

// True only when the signed-in caller is confirmed a platform admin; "no" and "unknown" both read as
// false. For deciding whether to GRANT something (start View as, a route's admin read); never for
// taking View as away (resolveViewAs uses checkPlatformAdmin). Routes ask after their member check
// (isPlatformAdmin), so a member's path is unchanged.
export async function confirmPlatformAdmin(supabase: SupabaseClient): Promise<boolean> {
  return (await checkPlatformAdmin(supabase)) === "yes";
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
  const check = await checkPlatformAdmin(supabase, 1);
  // 0.8 View as fixes: unanswerable is "try again" (the route answers 502), never the admin's own data.
  if (check === "unknown") throw new ViewAsUnconfirmed();
  if (check === "no") return null;
  return { urn: v.urn, role: v.role, stateKey: viewAsStateKey(v.urn, v.role) };
}

export class ViewAsUnconfirmed extends Error {
  constructor() {
    super("Could not confirm View as. Try again.");
  }
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

// 0.8 View as: the peek is the scripted, read-only way in for every product, not only Teacher's frames
// (AGENTS.md has an example for each): `?lookAs={urn}&as={role}&peek=1` on a Teacher, SMT or Admissions
// page, and `?lookAs={group account id}&as=head_office&peek=1` on the head-office pages. The page's own
// API calls carry it in this header (installPeekHeader), so the server decides the caller from it --
// honoured only for a platform admin, always read-only, never logged. Anyone else's peek does nothing.
export const PEEK_HEADER = "x-vicdata-peek";
export type PeekGroup = { accountId: string };

export function readPeekGroup(params: URLSearchParams): PeekGroup | null {
  if (params.get("peek") !== "1" || params.get("as") !== HEAD_OFFICE_ROLE) return null;
  const ref = viewAsGroupRef(params.get("lookAs")?.trim());
  return ref ? { accountId: ref } : null;
}

/** The peek a request carries (PEEK_HEADER: the page's own query string), or null. */
export function parsePeekHeader(value: string | null | undefined): { school: Peek | null; group: PeekGroup | null } | null {
  if (!value) return null;
  const params = new URLSearchParams(value);
  const school = readPeek(params);
  const group = readPeekGroup(params);
  return school || group ? { school, group } : null;
}

// In a peek, the page's same-origin API calls carry it. Installed once per page, in the browser only,
// and only when the address asks for a peek.
let peekInstalled = false;
export function installPeekHeader(): void {
  if (peekInstalled || typeof window === "undefined" || typeof window.fetch !== "function") return;
  peekInstalled = true;
  const params = new URLSearchParams(window.location.search);
  if (!readPeek(params) && !readPeekGroup(params)) return;
  const value = `peek=1&lookAs=${encodeURIComponent(params.get("lookAs") ?? "")}&as=${encodeURIComponent(params.get("as") ?? "")}`;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const local = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
    if (!local) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(PEEK_HEADER, value);
    return original(input, { ...init, headers });
  };
}
installPeekHeader();

/** This page's peek as the member pages need it (SMT, Admissions): the school and role, read-only,
 * once the page has confirmed a platform admin. Its state key is never written (read-only). */
export async function resolvePeek(supabase: SupabaseClient): Promise<ViewAs | null> {
  if (typeof window === "undefined") return null;
  const p = readPeek(new URLSearchParams(window.location.search));
  if (!p || !(await confirmPlatformAdmin(supabase))) return null;
  return { urn: p.urn, role: p.role, schoolName: p.urn, stateKey: viewAsStateKey(p.urn, p.role) };
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

function readGroupCookie(): ViewAsGroup | null {
  try {
    return parseViewAsGroup(document.cookie);
  } catch {
    return null;
  }
}

function writeCookie(value: string | null) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = value
      ? `${VIEW_AS_COOKIE}=${value}; Path=/; SameSite=Lax${secure}`
      : `${VIEW_AS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    // groups r1's own head-office cookie, retired: cleared whenever View as starts or ends.
    document.cookie = `${LEGACY_VIEW_AS_GROUP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // Not in a browser.
  }
}

// The View as THIS PAGE is in, fixed when the page first asks. Another tab starting or
// ending View as changes the cookie, never this page's state: a page drawn as a member
// keeps saving as that member (and a page drawn as Guy as Guy) until it reloads --
// followViewAsAcrossTabs reloads it when the tab is next looked at. Peek frames never are.
let pinned: { value: ViewAsCookie | null; group: ViewAsGroup | null } | null = null;

function pin() {
  if (!pinned) {
    const peek = new URLSearchParams(window.location.search).get("peek") === "1";
    pinned = { value: peek ? null : readCookie(), group: peek ? null : readGroupCookie() };
  }
  return pinned;
}

// The cookie as this page holds it (a stable object until it changes): what the banner and
// the pill draw from straight away, before the platform-admin check comes back.
export function viewAsSnapshot(): ViewAsCookie | null {
  if (typeof window === "undefined") return null;
  return pin().value;
}

// The head-office View as this page is in (the same cookie, role head_office), or null.
export function viewAsGroupSnapshot(): ViewAsGroup | null {
  if (typeof window === "undefined") return null;
  return pin().group;
}

// `confirmed`: the caller was confirmed a platform admin just now (startViewAs, the switcher's own
// check), so this page needs no second check -- one that the navigation to the new home would cancel.
function setViewAs(v: ViewAsCookie | null, group: ViewAsGroup | null = null, confirmed = false) {
  writeCookie(v ? serializeViewAsCookie(v) : group ? serializeViewAsGroup(group) : null);
  pinned = { value: v, group: v ? null : group };
  resolved = confirmed && v ? Promise.resolve(toViewAs(v)) : null;
  resolvedGroup = confirmed && !v && group ? Promise.resolve(group) : null;
  unconfirmed = false;
  try {
    window.dispatchEvent(new Event(VIEW_AS_EVENT));
  } catch {
    // Not in a browser.
  }
}

export const toViewAs = (v: ViewAsCookie): ViewAs => ({ ...v, stateKey: viewAsStateKey(v.urn, v.role) });
const same = (a: ViewAsCookie | null, b: ViewAsCookie | null) => (a?.urn ?? "") === (b?.urn ?? "") && (a?.role ?? "") === (b?.role ?? "");
const sameGroup = (a: ViewAsGroup | null, b: ViewAsGroup | null) => (a?.accountId ?? "") === (b?.accountId ?? "");

// Cross-tab: when this tab comes back into view and View as changed in another tab (a new
// school or role, or Back to me), reload, so no page ever shows one state under the other's
// banner (or none). Returns the unsubscribe.
export function followViewAsAcrossTabs(): () => void {
  const check = () => {
    if (document.visibilityState === "hidden") return;
    if (new URLSearchParams(window.location.search).get("peek") === "1") return;
    if (!same(viewAsSnapshot(), readCookie()) || !sameGroup(viewAsGroupSnapshot(), readGroupCookie())) window.location.reload();
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

// Re-confirmed on every page load: anyone the database says is NOT a platform admin loses it here
// (and the banner and pill, which drew from the cookie, go with it). Shared per page load.
// 0.8 View as fixes: a check that can't be answered (an error, a timeout, a cancelled request) is
// asked twice more; still unanswered, View as is KEPT -- the page draws the viewed school, never the
// admin's own -- and the banner offers Retry (viewAsUnconfirmed). Nothing is exposed by keeping it:
// every route re-checks platform admin itself and refuses (502, "try again") while it can't.
let resolved: Promise<ViewAs | null> | null = null;
export function resolveViewAs(supabase: SupabaseClient): Promise<ViewAs | null> {
  if (resolved) return resolved;
  resolved = (async () => {
    const v = viewAsSnapshot();
    if (!v) return null;
    const check = await checkPlatformAdmin(supabase, 2);
    if (check === "no") {
      setViewAs(null);
      return null;
    }
    if (check === "unknown") markUnconfirmed();
    return toViewAs(v);
  })();
  return resolved;
}

// The same for head office's View as: anyone the database says is not a platform admin loses the cookie.
let resolvedGroup: Promise<ViewAsGroup | null> | null = null;
export function resolveViewAsGroup(supabase: SupabaseClient): Promise<ViewAsGroup | null> {
  if (resolvedGroup) return resolvedGroup;
  resolvedGroup = (async () => {
    const g = viewAsGroupSnapshot();
    if (!g) return null;
    const check = await checkPlatformAdmin(supabase, 2);
    if (check === "no") {
      setViewAs(null);
      return null;
    }
    if (check === "unknown") markUnconfirmed();
    return g;
  })();
  return resolvedGroup;
}

// This page couldn't confirm its View as (above): the banner says so and offers Retry (a reload).
let unconfirmed = false;
function markUnconfirmed() {
  unconfirmed = true;
  try {
    window.dispatchEvent(new Event(VIEW_AS_EVENT));
  } catch {
    // Not in a browser.
  }
}
export function viewAsUnconfirmed(): boolean {
  return unconfirmed;
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
  setViewAs(v, null, true);
  return { ok: true, viewAs: toViewAs(v) };
}

// View as head office of a group (0.8 View as: the same switcher and cookie as a school's).
// Confirms platform admin and writes one audit row (view_as_group), as groups r1 did.
export async function startViewAsHeadOffice(supabase: SupabaseClient, g: ViewAsGroup & { groupId?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await confirmPlatformAdmin(supabase))) return { ok: false, error: "Only platform admins can view VicData as a head office." };
  const groupId = noAccountGroupId(g.accountId);
  const { error } = await supabase.rpc("log_platform_action", { p_action: "view_as_group", p_school_urn: null, p_detail: { group_account_id: groupId ? null : g.accountId, group_id: groupId ?? g.groupId ?? null } });
  if (error) return { ok: false, error: `Could not start View as: ${error.message}` };
  setViewAs(null, { accountId: g.accountId, name: g.name }, true);
  return { ok: true };
}

// Back to me (a school's View as or head office's: one cookie).
export function exitViewAs(): void {
  setViewAs(null);
}

// 0.8 View as fixes (item 4): where the signed-in person's own VicData is, once View as ends: their
// school's home if they hold an approved school membership, head office's if they hold a group one,
// else Platform for a platform admin (who needs no membership), else /teacher (which explains).
// Their own rows only (RLS). A read that fails sends them to /teacher, which decides for itself.
export async function ownHome(supabase: SupabaseClient): Promise<string> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return "/teacher";
  const [school, group] = await Promise.all([
    supabase.from("school_memberships").select("id").eq("profile_id", uid).eq("status", "approved").limit(1),
    supabase.from("group_memberships").select("id").eq("profile_id", uid).limit(1),
  ]);
  if (school.error || (school.data ?? []).length > 0) return "/teacher";
  if (!group.error && (group.data ?? []).length > 0) return "/teacher/group";
  return (await checkPlatformAdmin(supabase, 1)) === "yes" ? "/platform" : "/teacher";
}

// The caller as the one server helper decides it (GET /api/view-as/caller, resolveCaller): what a
// page in View as needs about the viewed school that the platform admin's own RLS can't read --
// its school account (any school: one with no account, or no members, gets ""), and its saved
// catchment. Read with the service role, only after the server confirms platform admin.
export type ViewedSchool = { urn: string; name: string; accountId: string; catchmentKm: number | null; roles: string[]; access: CallerAccess; readOnly: boolean };

const viewedCache = new Map<string, Promise<ViewedSchool | null>>();

export function fetchViewedSchool(supabase: SupabaseClient, urn: string): Promise<ViewedSchool | null> {
  const hit = viewedCache.get(urn);
  if (hit) return hit;
  const p = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`/api/view-as/caller?urn=${encodeURIComponent(urn)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res || !res.ok) return null;
    return (await res.json()) as ViewedSchool;
  })();
  viewedCache.set(urn, p);
  p.then((v) => { if (!v) viewedCache.delete(urn); }, () => viewedCache.delete(urn));
  return p;
}

// The viewed school as the member pages need it: its name, and its school account if it
// has one (read only: which school dashboards and sets a member of it would see).
export async function viewAsSchool(supabase: SupabaseClient, v: ViewAs): Promise<{ urn: string; name: string; accountId: string }> {
  const s = await fetchViewedSchool(supabase, v.urn);
  return { urn: v.urn, name: s?.name || v.schoolName, accountId: s?.accountId ?? "" };
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
