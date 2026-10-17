"use client";

// VicData 0.8 SMT round 1 (spec §2.4): who is looking at SMT, at which school, and what they may do.
// Resolved the way Admissions resolves its member (pickMembership; View as re-confirmed by
// resolveViewAs); the routes check the same again on the server (src/lib/smt/auth.ts).
//
//   member       SMT (governors hold the SMT role): everything; edits the comparison sets as in Teacher
//   schoolAdmin  is_admin / the account holder: the same
//   viewAs       a platform admin through View as: everything, read-only
//   headOffice   groups r1 (G2): a member school's group head office, read-only, never logged; reached by
//                ?headOffice=URN from the group home and confirmed by the server (/api/group/school-access)
//   none         anyone else (a Teacher): the page says who SMT is for
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchViewedSchool, pickMembership, resolvePeek, resolveViewAs, viewAsMembership, type ViewAs } from "@/lib/view-as";
import { canSeeSmt } from "@/lib/smt/auth-rules";

export type SmtAccess = "member" | "schoolAdmin" | "viewAs" | "headOffice" | "none";
export type SmtMember = {
  userId: string;
  token: string;
  membershipId: string | null;
  schoolAccountId: string;
  schoolUrn: string;
  schoolName: string;
  roles: string[];
  isAdmin: boolean;
  isAccountHolder: boolean;
  access: SmtAccess;
  readOnly: boolean;
  viewAs: ViewAs | null;
  headOffice?: { groupName: string; accountId: string; note: string; admissions: "shared" | "private" } | null;
};
export type SmtMemberState = { status: "loading" } | { status: "signed-out" } | { status: "no-school" } | { status: "not-found" } | { status: "ready"; member: SmtMember };

// The member school head office opened from the group home, for this tab (SMT's own links don't carry
// the address's ?headOffice=).
const HEAD_OFFICE_KEY = "vicdata.smt.headOffice";

async function headOfficeMember(urn: string, session: { user: { id: string }; access_token: string }): Promise<SmtMemberState> {
  const res = await fetch(`/api/group/school-access?urn=${encodeURIComponent(urn)}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
  if (!res || !res.ok) return { status: "not-found" };
  const b = (await res.json()) as { urn: string; schoolName: string; accountId: string; groupName: string; note: string; admissions: "shared" | "private" };
  try {
    window.sessionStorage.setItem(HEAD_OFFICE_KEY, urn);
  } catch {
    // This page only.
  }
  return {
    status: "ready",
    member: { userId: session.user.id, token: session.access_token, membershipId: null, schoolAccountId: "", schoolUrn: b.urn, schoolName: b.schoolName, roles: [], isAdmin: false, isAccountHolder: false, access: "headOffice", readOnly: true, viewAs: null, headOffice: { groupName: b.groupName, accountId: b.accountId, note: b.note, admissions: b.admissions } },
  };
}

type Row = { id: string; roles: string[] | null; is_admin: boolean; approved_at: string | null; school_account_id: string; school_accounts: { id: string; school_urn: string; account_holder_membership_id: string | null; schools: { current_name: string } | null } | null };
const SELECT = "id, roles, is_admin, approved_at, school_account_id, school_accounts!school_memberships_school_account_id_fkey(id, school_urn, account_holder_membership_id, schools(current_name))";

export function smtAccessOf(m: { roles: string[]; isAdmin: boolean; isAccountHolder: boolean }): SmtAccess {
  if (m.roles.includes("smt")) return "member";
  if (canSeeSmt(m)) return "schoolAdmin";
  return "none";
}

export async function loadSmtMember(): Promise<SmtMemberState> {
  const supabase = createBrowserSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return { status: "signed-out" };
  // 0.8 View as: a View as, or the scripted read-only peek (?lookAs=&as=&peek=1), platform admins only.
  const viewAs = (await resolveViewAs(supabase)) ?? (await resolvePeek(supabase));
  if (viewAs) {
    // 0.8 View as: the viewed school's account comes from the server (the one caller helper reads it
    // with the service role once it has confirmed a platform admin): the admin's own RLS shows nothing
    // at a school they aren't a member of, which left SMT and Admissions saying "use View as" (17 Oct).
    // Any school: one with no school account (or no members) still draws, with no saved state.
    const viewed = await fetchViewedSchool(supabase, viewAs.urn);
    const account = { id: viewed?.accountId ?? "" };
    const vm = viewAsMembership(viewAs.role);
    const base = { roles: vm.roles, isAdmin: vm.is_admin, isAccountHolder: false };
    const access = smtAccessOf(base);
    return { status: "ready", member: { userId: session.user.id, token: session.access_token, membershipId: null, schoolAccountId: account.id, schoolUrn: viewAs.urn, schoolName: viewed?.name || viewAs.schoolName, ...base, access: access === "none" ? "none" : "viewAs", readOnly: true, viewAs } };
  }
  const asked = new URLSearchParams(window.location.search).get("headOffice");
  if (asked && /^\d{5,7}$/.test(asked)) return headOfficeMember(asked, session);
  const { data } = await supabase.from("school_memberships").select(SELECT).eq("profile_id", session.user.id).eq("status", "approved");
  const row = pickMembership(((data ?? []) as unknown as Row[]));
  const account = row?.school_accounts;
  if (!row || !account) {
    // Head office (no school of its own) moving between a member school's SMT dashboards.
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(HEAD_OFFICE_KEY);
    } catch {
      stored = null;
    }
    return stored ? headOfficeMember(stored, session) : { status: "no-school" };
  }
  const base = { roles: row.roles ?? [], isAdmin: row.is_admin, isAccountHolder: account.account_holder_membership_id === row.id };
  const access = smtAccessOf(base);
  return { status: "ready", member: { userId: session.user.id, token: session.access_token, membershipId: row.id, schoolAccountId: account.id, schoolUrn: account.school_urn, schoolName: account.schools?.current_name ?? account.school_urn, ...base, access, readOnly: false, viewAs: null } };
}
