// VicData 0.6 snagging round 4: "View as" -- a platform admin (Guy) seeing and editing
// VicData as one role at one school, exactly as a real single-membership member of that
// school and role would. Framework-free (no React): the data routes import it too.
//
// The one rule (item B): in View as, the page and every data route get the SAME inputs a
// real member gets -- the real URN, the same default comparator lists, the same phase
// gating, the same role offers and home. Only two things differ:
//   * where personal state goes: Guy's own rows under the state key "{urn}~trial~{role}"
//     (the round 2 trial key; tables and columns keep the trial_contexts / trial_key names);
//   * nothing school-wide is written (People, Teams, school dashboards, shared sets,
//     sign-in events, counts).
//
// The View as itself is a session cookie (VIEW_AS_COOKIE), so it lasts across tabs and
// every same-origin request carries it; a route honours it only after confirming the caller
// is a platform admin (viewAsForRequest).
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

// True only when the signed-in caller is a platform admin; any error reads as "no".
export async function confirmPlatformAdmin(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_platform_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

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
