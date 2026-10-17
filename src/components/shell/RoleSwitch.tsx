"use client";

// VicData 0.8 View as, part B: a member's own role switch and school picker -- never View as.
//
//   * NavRoleSwitch: one switch in the app nav, shown only to someone holding more than one of Teacher,
//     SMT and Admissions at the school shown (School-Admin is an admin capability, not a role to switch
//     to). It moves between those roles' homes: the lens switch (LensSwitch) that 0.6 S6 drew on the
//     /teacher home, lifted into the nav and drawn the same on the SMT and Admissions pages. The home a
//     role opens on is remembered as before (LENS_KEY); on /teacher it switches in place.
//   * The school picker (useMemberSchools): for someone with approved memberships at more than one
//     school, in the account menu -- today's ?school=URN, remembered (pickMembership).
//
// Neither ever draws in View as or for a peek: a View as is one role at one school, and the switcher
// for it is the platform admin's own (src/components/view-as/ViewAs.tsx).
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { getActiveViewAs, pickMembership, SHOWN_SCHOOL_KEY, viewAsGroupSnapshot } from "@/lib/view-as";
import { VISIBLE_ROLE_LABELS } from "@/lib/roles";
import { initialLens, lensesOf, readStoredLens, storeLens, type Lens } from "@/components/library/RoleHome";
import { configRendererRequested } from "@/components/dashboard-config/plan";

type Row = { id: string; roles: string[] | null; role: string | null; is_admin: boolean; approved_at: string | null; school_accounts: { school_urn: string; account_holder_membership_id: string | null; schools: { current_name: string } | null } | null };

export type NavMember = { lenses: Lens[]; schools: { urn: string; name: string }[]; shownUrn: string | null };

// The signed-in member's own approved memberships, read once per page load (the nav draws on every
// Teacher, SMT and Admissions page). null in View as, for a peek, or signed out.
let navMember: Promise<NavMember | null> | null = null;

export function loadNavMember(): Promise<NavMember | null> {
  if (navMember) return navMember;
  navMember = (async () => {
    if (typeof window === "undefined") return null;
    const search = new URLSearchParams(window.location.search);
    if (getActiveViewAs() || viewAsGroupSnapshot() || search.get("peek") === "1") return null;
    // The role homes exist only with the config renderer (the /teacher home's own gate for its lenses).
    if (!configRendererRequested(search)) return null;
    const supabase = createBrowserSupabaseClient();
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    const { data } = await supabase
      .from("school_memberships")
      .select("id, roles, role, is_admin, approved_at, school_accounts!school_memberships_school_account_id_fkey(school_urn, account_holder_membership_id, schools(current_name))")
      .eq("profile_id", uid)
      .eq("status", "approved");
    const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.school_accounts?.school_urn);
    const shown = pickMembership(rows);
    if (!shown) return null;
    const lenses = lensesOf({ roles: shown.roles, role: shown.role, is_admin: shown.is_admin, isAccountHolder: shown.school_accounts?.account_holder_membership_id === shown.id });
    const schools = rows
      .map((r) => ({ urn: r.school_accounts!.school_urn, name: r.school_accounts!.schools?.current_name ?? r.school_accounts!.school_urn }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { lenses, schools, shownUrn: shown.school_accounts!.school_urn };
  })().catch(() => null);
  return navMember;
}

function useNavMember(): NavMember | null {
  const [m, setM] = useState<NavMember | null>(null);
  useEffect(() => {
    let live = true;
    loadNavMember().then((v) => { if (live) setM(v); });
    return () => { live = false; };
  }, []);
  return m;
}

// Fired on window when the nav's role switch picks a role on /teacher (the home switches in place).
export const LENS_EVENT = "vicdata:lens";

// The role a page is for: SMT's and Admissions' own pages are theirs; the home and the shared pages
// (Recruitment, Meetings, the library) the one last chosen; the phase dashboards Teacher's.
function lensOfPath(path: string, lenses: Lens[]): Lens {
  if (/^\/teacher\/smt(\/|$)/.test(path)) return "smt";
  if (/^\/teacher\/admissions(\/|$)/.test(path)) return "admissions";
  if (/^\/teacher\/(ks2|ks4|ks5)(\/|$)/.test(path)) return "teacher";
  return initialLens(lenses, readStoredLens());
}

export function NavRoleSwitch() {
  const m = useNavMember();
  const path = usePathname() ?? "";
  const [lens, setLens] = useState<Lens | null>(null);
  useEffect(() => {
    const on = (e: Event) => setLens((e as CustomEvent<Lens>).detail);
    window.addEventListener(LENS_EVENT, on);
    return () => window.removeEventListener(LENS_EVENT, on);
  }, []);
  if (!m || m.lenses.length < 2) return null;
  const active = lens ?? lensOfPath(path, m.lenses);
  function pick(l: Lens) {
    storeLens(l);
    if (path === "/teacher") {
      setLens(l);
      window.dispatchEvent(new CustomEvent<Lens>(LENS_EVENT, { detail: l }));
      return;
    }
    // A full load to that role's home, as View as's own homes are.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/teacher");
  }
  return (
    <div role="tablist" aria-label="Your roles" data-role-switch="" title="Shown because a School-Admin gave you more than one role. Each has its own home." className="flex h-[34px] shrink-0 items-center rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] p-[3px]">
      {m.lenses.map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={l === active}
          onClick={() => pick(l)}
          className={`h-full rounded-full border-0 px-2.5 text-xs font-bold ${l === active ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-transparent text-[var(--muted)] hover:text-[var(--fg)]"}`}
        >
          {VISIBLE_ROLE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

/** The member's schools, for the account menu's school picker: shown only with more than one. */
export function useMemberSchools(): { schools: { urn: string; name: string }[]; shownUrn: string | null } | null {
  const m = useNavMember();
  return m && m.schools.length > 1 ? { schools: m.schools, shownUrn: m.shownUrn } : null;
}

/** Show another of the member's schools: today's ?school=URN, remembered in this browser. */
export function showSchool(urn: string) {
  try {
    window.localStorage.setItem(SHOWN_SCHOOL_KEY, urn);
  } catch {
    // The address carries it for this page.
  }
  const url = new URL(window.location.href);
  url.searchParams.set("school", urn);
  window.location.assign(url.toString());
}
