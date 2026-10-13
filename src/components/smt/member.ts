"use client";

// VicData 0.8 SMT round 1 (spec §2.4): who is looking at SMT, at which school, and what they may do.
// Resolved the way Admissions resolves its member (pickMembership; View as re-confirmed by
// resolveViewAs); the routes check the same again on the server (src/lib/smt/auth.ts).
//
//   member       SMT (governors hold the SMT role): everything; edits the comparison sets as in Teacher
//   schoolAdmin  is_admin / the account holder: the same
//   viewAs       a platform admin through View as: everything, read-only
//   none         anyone else (a Teacher): the page says who SMT is for
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { pickMembership, resolveViewAs, viewAsMembership, type ViewAs } from "@/lib/view-as";
import { canSeeSmt } from "@/lib/smt/auth-rules";

export type SmtAccess = "member" | "schoolAdmin" | "viewAs" | "none";
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
};
export type SmtMemberState = { status: "loading" } | { status: "signed-out" } | { status: "no-school" } | { status: "ready"; member: SmtMember };

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
  const viewAs = await resolveViewAs(supabase);
  if (viewAs) {
    const { data: account } = await supabase.from("school_accounts").select("id").eq("school_urn", viewAs.urn).maybeSingle<{ id: string }>();
    if (!account) return { status: "no-school" };
    const vm = viewAsMembership(viewAs.role);
    const base = { roles: vm.roles, isAdmin: vm.is_admin, isAccountHolder: false };
    const access = smtAccessOf(base);
    return { status: "ready", member: { userId: session.user.id, token: session.access_token, membershipId: null, schoolAccountId: account.id, schoolUrn: viewAs.urn, schoolName: viewAs.schoolName, ...base, access: access === "none" ? "none" : "viewAs", readOnly: true, viewAs } };
  }
  const { data } = await supabase.from("school_memberships").select(SELECT).eq("profile_id", session.user.id).eq("status", "approved");
  const row = pickMembership(((data ?? []) as unknown as Row[]));
  const account = row?.school_accounts;
  if (!row || !account) return { status: "no-school" };
  const base = { roles: row.roles ?? [], isAdmin: row.is_admin, isAccountHolder: account.account_holder_membership_id === row.id };
  const access = smtAccessOf(base);
  return { status: "ready", member: { userId: session.user.id, token: session.access_token, membershipId: row.id, schoolAccountId: account.id, schoolUrn: account.school_urn, schoolName: account.schools?.current_name ?? account.school_urn, ...base, access, readOnly: false, viewAs: null } };
}
