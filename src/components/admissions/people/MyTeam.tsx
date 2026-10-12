"use client";

// VicData 0.7 admissions r2 (D6, decision 1): the Admissions lead's "My team" -- add or remove
// Admissions staff from the school's own members, through admissions_set_member() (round 1: a
// security-definer function that grants only `admissions`, only at the lead's school, and removes
// only the grants a lead made). Nothing else can be granted here. The School-Admin sees every
// change in People and can override it.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { displayNameOf } from "@/components/admin/AdminChrome";
import { loadAdmissionsMember, type MemberState } from "../member";
import { AdmissionsTeacherNav } from "../controls";
import { admissionsVars, cx } from "../ui";
import { LeadBadge } from "./AdmissionsPeople";

type Row = { id: string; roles: string[] | null; admissions_lead?: boolean; profiles: { full_name: string | null; email: string | null } | null };
type Grant = { membership_id: string; granted_by_kind: "school_admin" | "lead" };

export function MyTeam() {
  const [theme, setTheme] = useTeacherTheme();
  const [state, setState] = useState<MemberState>({ status: "loading" });
  const [rows, setRows] = useState<Row[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    loadAdmissionsMember().then(setState);
  }, []);
  const member = state.status === "ready" ? state.member : null;
  const load = useCallback(async () => {
    if (!member) return;
    const supabase = createBrowserSupabaseClient();
    const [m, g] = await Promise.all([
      supabase.from("school_memberships").select("id, roles, admissions_lead, profiles(full_name, email)").eq("school_account_id", member.schoolAccountId).eq("status", "approved"),
      supabase.from("admissions_grants").select("membership_id, granted_by_kind").eq("school_account_id", member.schoolAccountId),
    ]);
    setRows(((m.data ?? []) as unknown as Row[]).sort((a, b) => displayNameOf(a.profiles?.full_name, a.profiles?.email).localeCompare(displayNameOf(b.profiles?.full_name, b.profiles?.email))));
    setGrants((g.data ?? []) as Grant[]);
  }, [member]);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);
  const set = async (r: Row, grant: boolean) => {
    setBusy(r.id);
    setError(null);
    const { error: e } = await createBrowserSupabaseClient().rpc("admissions_set_member", { p_membership_id: r.id, p_grant: grant });
    setBusy(null);
    if (e) setError(e.message);
    await load();
  };
  const B = "rounded-full border px-3 py-1 text-[12px] font-semibold disabled:opacity-50";
  return (
    <main id="teacher-root" data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={admissionsVars(theme)}>
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-5 py-5">
        <AdmissionsTeacherNav schoolUrn={member?.schoolUrn ?? null} theme={theme} onTheme={setTheme} />
        <Link href="/teacher/admissions" className="text-[13px] text-[var(--muted)] hover:text-[var(--fg)]">
          &larr; Admissions
        </Link>
        <div>
          <h1 className="text-[20px] font-bold">My team</h1>
          <p className="mt-1 text-[13px] leading-snug text-[var(--muted2)]">Add people from your school to Admissions, or take them off. You can only give the Admissions role, and only remove the people you added. Your School-Admin sees every change in People.</p>
        </div>
        {state.status === "loading" && <p className="text-[13px] text-[var(--muted2)]">Loading…</p>}
        {member && !member.canManageTeam && <p className="text-[13px] text-[var(--muted2)]">My team is the Admissions lead&rsquo;s. {member.viewAs ? "View as: read-only." : "Ask your School-Admin to make you lead."}</p>}
        {member?.canManageTeam &&
          rows
            .filter((r) => r.id !== member.membershipId)
            .map((r) => {
              const on = (r.roles ?? []).includes("admissions");
              const g = grants.find((x) => x.membership_id === r.id);
              const mine = on && g?.granted_by_kind === "lead";
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-[13px]">
                  <span className="font-semibold">{displayNameOf(r.profiles?.full_name, r.profiles?.email)}</span>
                  {r.admissions_lead && <LeadBadge />}
                  <span className="text-[11.5px] text-[var(--muted)]">{on ? (mine ? "Admissions · added by you" : "Admissions · given by the School-Admin") : ""}</span>
                  <span className="grow" />
                  {!on && (
                    <button type="button" disabled={busy === r.id} onClick={() => set(r, true)} className={cx(B, "border-[var(--accent)] text-[var(--adm-accent-text)]")}>
                      Add to Admissions
                    </button>
                  )}
                  {mine && (
                    <button type="button" disabled={busy === r.id} onClick={() => set(r, false)} className={cx(B, "border-[var(--panel-border2)] text-[var(--chip-fg)]")}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
        {error && <p className="text-[12px] text-[var(--adm-down-fg)]">{error}</p>}
      </div>
    </main>
  );
}
