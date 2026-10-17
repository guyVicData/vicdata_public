"use client";

// VicData 0.7 admissions r2 (D2, D6): who is looking at Admissions, at which school, and what
// they may do there. Resolved the way every Teacher page resolves its member (pickMembership,
// View as re-confirmed by resolveViewAs); the routes check the same again on the server
// (src/lib/admissions/auth.ts), so this only decides what the page offers.
//
//   lead         the Admissions lead (admissions_lead): builds and edits lists, runs setup
//   member       Admissions without the flag, SMT: sees everything, edits nothing
//   schoolAdmin  is_admin / account holder: sees everything; edits setup and the lists as an
//                override once 0.7 r2b's migration lets it (admissions_can_edit_lists), every
//                change audited; before that, read-only (round 1's RLS: the lead only)
//   viewAs       a platform admin through View as: everything, read-only (decision 4)
//   listOnly     anyone a list is shared with who isn't one of the above: the list's school
//                names only, never the computed views (decision 5)
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchViewedSchool, pickMembership, resolvePeek, resolveViewAs, viewAsMembership, type ViewAs } from "@/lib/view-as";

export type AdmissionsAccess = "lead" | "member" | "schoolAdmin" | "viewAs" | "listOnly" | "none";

export type AdmissionsMember = {
  userId: string;
  token: string;
  membershipId: string | null;
  schoolAccountId: string;
  schoolUrn: string;
  schoolName: string;
  roles: string[];
  isAdmin: boolean;
  isAccountHolder: boolean;
  lead: boolean;
  access: AdmissionsAccess;
  // What the page may change: setup and lists (the lead, or the School-Admin's override), sharing
  // (lead and SMT), My team (lead).
  canEditLists: boolean;
  // A School-Admin (without the lead flag) editing setup and the lists: the 0.7 r2b override.
  override: boolean;
  canShare: boolean;
  canManageTeam: boolean;
  readOnly: boolean;
  viewAs: ViewAs | null;
  // Is the lead flag in the database yet (the 0.7 r1 migration)? Before it, no one is lead.
  leadColumn: boolean;
};

export type MemberState = { status: "loading" } | { status: "signed-out" } | { status: "no-school" } | { status: "ready"; member: AdmissionsMember };

type Row = {
  id: string;
  roles: string[] | null;
  is_admin: boolean;
  admissions_lead?: boolean | null;
  approved_at: string | null;
  school_account_id: string;
  school_accounts: { id: string; school_urn: string; account_holder_membership_id: string | null; schools: { current_name: string } | null } | null;
};

const SELECT = "id, roles, is_admin, admissions_lead, approved_at, school_account_id, school_accounts!school_memberships_school_account_id_fkey(id, school_urn, account_holder_membership_id, schools(current_name))";

export function accessOf(m: { roles: string[]; isAdmin: boolean; isAccountHolder: boolean; lead: boolean }, sharedWith: boolean): AdmissionsAccess {
  if (m.lead && m.roles.includes("admissions")) return "lead";
  if (m.roles.includes("admissions") || m.roles.includes("smt")) return "member";
  if (m.isAdmin || m.isAccountHolder) return "schoolAdmin";
  return sharedWith ? "listOnly" : "none";
}

export async function loadAdmissionsMember(): Promise<MemberState> {
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
    const base = { roles: vm.roles, isAdmin: vm.is_admin, isAccountHolder: false, lead: false };
    const access = accessOf(base, false);
    return {
      status: "ready",
      member: {
        userId: session.user.id,
        token: session.access_token,
        membershipId: null,
        schoolAccountId: account.id,
        schoolUrn: viewAs.urn,
        schoolName: viewed?.name || viewAs.schoolName,
        ...base,
        // A platform admin reads everything through View as, read-only (decision 4); a View as
        // a Teacher sees what a Teacher sees (nothing, unless a list is shared with them).
        access: access === "none" ? "none" : "viewAs",
        canEditLists: false,
        override: false,
        canShare: false,
        canManageTeam: false,
        readOnly: true,
        viewAs,
        leadColumn: true,
      },
    };
  }
  let leadColumn = true;
  const read = (select: string) => supabase.from("school_memberships").select(select).eq("profile_id", session.user.id).eq("status", "approved");
  let res = await read(SELECT);
  if (res.error && /admissions_lead/.test(res.error.message)) {
    leadColumn = false;
    res = await read(SELECT.replace("admissions_lead, ", ""));
  }
  const rows = res.data as unknown as Row[] | null;
  const row = pickMembership((rows ?? []) as unknown as Row[]);
  const account = row?.school_accounts;
  if (!row || !account) return { status: "no-school" };
  const roles = row.roles ?? [];
  const isAccountHolder = account.account_holder_membership_id === row.id;
  const base = { roles, isAdmin: row.is_admin, isAccountHolder, lead: !!row.admissions_lead };
  let access = accessOf(base, false);
  if (access === "none") {
    // Decision 5: a list shared with them gives the list only. RLS returns the shares that
    // reach this person (user, role or team); none, or no table yet, means no Admissions.
    const { data: shares } = await supabase.from("admissions_list_shares").select("id").eq("school_account_id", account.id).limit(1);
    access = accessOf(base, (shares ?? []).length > 0);
  }
  // 0.7 r2b (E1): the School-Admin's override, if the database allows it yet. Before the r2b
  // migration the function doesn't exist: an error, so no override (round 1's rules).
  let override = false;
  if (access !== "lead" && (row.is_admin || isAccountHolder)) {
    const { data: ok, error } = await supabase.rpc("admissions_can_edit_lists", { p_school_account_id: account.id });
    override = !error && ok === true;
  }
  return {
    status: "ready",
    member: {
      userId: session.user.id,
      token: session.access_token,
      membershipId: row.id,
      schoolAccountId: account.id,
      schoolUrn: account.school_urn,
      schoolName: account.schools?.current_name ?? account.school_urn,
      ...base,
      access,
      canEditLists: access === "lead" || override,
      override,
      canShare: access === "lead" || roles.includes("smt"),
      canManageTeam: access === "lead",
      readOnly: access !== "lead" && !override,
      viewAs: null,
      leadColumn,
    },
  };
}

/** A fresh token for each call (sessions refresh while a page stays open). */
export async function freshToken(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}
