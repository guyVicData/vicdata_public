"use client";

// VicData 0.8 sets round 1 (D18-D20): the library's and the set pages' frame -- Teacher's theme and the
// school's own sets: the URN in the address, else the person's first approved school.
import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { pickMembership } from "@/lib/view-as";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { useWidth } from "@/components/admissions/views/charts";
import { leaveEditor } from "@/lib/sets/editor-return";
import { dashboardLabel, roleDashboard, safeDashboardReturn, setForPage, setsRole, wayBackHref, type SetsRole } from "@/lib/sets/return-to";

export const SETS_PHONE = 600;

export type SetsMember = { userId: string; urn: string; schoolName: string; token: string; role: SetsRole };

export function useSetsMember(urnParam: string | null): { status: "loading" } | { status: "error"; message: string } | { status: "ready"; member: SetsMember } {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; member: SetsMember }>({ status: "loading" });
  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const [{ data: who }, { data: session }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
      if (!who.user || !session.session) return setState({ status: "error", message: "Sign in to see your sets." });
      let q = supabase
        .from("school_memberships")
        .select("approved_at, roles, admissions_lead, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, schools(current_name))")
        .eq("profile_id", who.user.id)
        .eq("status", "approved");
      if (urnParam) q = q.eq("school_accounts.school_urn", urnParam);
      // With no ?urn=, the school every other page shows (?school=, else the one last chosen, else the
      // earliest approved), never an arbitrary first row.
      const { data: rows } = await q.returns<{ approved_at: string | null; roles: string[] | null; admissions_lead: boolean | null; school_accounts: { school_urn: string; schools: { current_name: string } | null } }[]>();
      const data = pickMembership(rows ?? [], urnParam ?? undefined);
      if (!data) return setState({ status: "error", message: urnParam ? "Sets are for the school's own staff." : "You need to be an approved member at a school to keep sets. Join your school from your account page." });
      setState({ status: "ready", member: { userId: who.user.id, urn: data.school_accounts.school_urn, schoolName: data.school_accounts.schools?.current_name ?? data.school_accounts.school_urn, token: session.session.access_token, role: setsRole({ roles: data.roles, lead: data.admissions_lead }) } });
    })();
  }, [urnParam]);
  return state;
}

export function SetsShell({ children }: { children: (phone: boolean) => ReactNode }) {
  const [theme] = useTeacherTheme();
  const [ref, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < SETS_PHONE;
  return (
    <main id="teacher-root" data-theme={theme} ref={ref} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className={phone ? "" : "mx-auto max-w-[1280px] px-7 py-5"}>{width > 0 ? children(phone) : null}</div>
    </main>
  );
}

/** The way back from the library and a set view: the dashboard that sent the person here (`returnTo`,
 * a dashboard only), else the school's dashboard for their role. */
export function wayBack(raw: string | null, member: { urn: string | null; role: SetsRole } | null): { returnTo: string; fallback: boolean; label: string } {
  const ok = safeDashboardReturn(raw);
  if (ok) return { returnTo: ok, fallback: false, label: dashboardLabel(ok) };
  // Not signed in or not a member yet: Teacher's home, which says what to do.
  const d = roleDashboard(member?.role ?? "teacher", member?.urn ?? null);
  return { returnTo: d.href, fallback: true, label: d.label };
}

/** "‹ Back to <page>", top left, on the library and the set view. A link (a new tab or a middle-click
 * opens the page itself); a plain click leaves the way the editor does (leaveEditor): one step back when
 * the page before is that dashboard, else replacing this entry, so nothing is left behind to trap. The set
 * chosen or saved here goes with it when it is the kind the page uses (setForPage). */
export function SetsWayBack({ back, set, phone }: { back: { returnTo: string; fallback: boolean; label: string }; set?: { id: string | null; kind: string; entry: string | null; phase: string | null } | null; phone?: boolean }) {
  const setId = back.fallback ? null : setForPage(back.returnTo, set ?? null);
  const href = wayBackHref(back.returnTo, setId);
  return (
    <a
      href={href}
      data-sets-way-back={back.fallback ? "fallback" : "returnTo"}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        leaveEditor(back.returnTo, back.fallback, setId);
      }}
      className={`inline-flex max-w-full items-center gap-1.5 self-start rounded-[8px] text-left text-[13px] font-semibold text-[var(--muted2)] hover:text-[var(--fg)] ${phone ? "min-h-[44px] min-w-[44px]" : "min-h-[30px]"}`}
    >
      <span aria-hidden="true">‹</span>
      <span className="truncate">{back.label}</span>
    </a>
  );
}
