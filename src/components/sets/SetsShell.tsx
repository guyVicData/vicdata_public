"use client";

// VicData 0.8 sets round 1 (D18-D20): the library's and the set pages' frame -- Teacher's theme and the
// school's own sets: the URN in the address, else the person's first approved school.
import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { useWidth } from "@/components/admissions/views/charts";

export const SETS_PHONE = 600;

export type SetsMember = { userId: string; urn: string; schoolName: string; token: string };

export function useSetsMember(urnParam: string | null): { status: "loading" } | { status: "error"; message: string } | { status: "ready"; member: SetsMember } {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; member: SetsMember }>({ status: "loading" });
  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const [{ data: who }, { data: session }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
      if (!who.user || !session.session) return setState({ status: "error", message: "Sign in to see your sets." });
      let q = supabase
        .from("school_memberships")
        .select("school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, schools(current_name))")
        .eq("profile_id", who.user.id)
        .eq("status", "approved");
      if (urnParam) q = q.eq("school_accounts.school_urn", urnParam);
      const { data } = await q.limit(1).maybeSingle<{ school_accounts: { school_urn: string; schools: { current_name: string } | null } }>();
      if (!data) return setState({ status: "error", message: urnParam ? "Sets are for the school's own staff." : "You need to be an approved member at a school to keep sets. Join your school from your account page." });
      setState({ status: "ready", member: { userId: who.user.id, urn: data.school_accounts.school_urn, schoolName: data.school_accounts.schools?.current_name ?? data.school_accounts.school_urn, token: session.session.access_token } });
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
