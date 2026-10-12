"use client";

// VicData 0.7 admissions r2 (D6, decision 1): the School-Admin's People page, Admissions section --
//   the Admissions lead badge and "Make lead" / "Stop being lead" (school_memberships.admissions_lead;
//     the database lets only the School-Admin or account holder change it, round 1);
//   the lead's grants: who the lead added to Admissions, and when (admissions_grants);
//   the admissions history (platform_audit_log admissions_* rows, readable by the School-Admin);
//   the override: remove any Admissions grant, or restore one that was removed (a roles write the
//     School-Admin may make; every one audited by round 1's triggers).
// It reads its own rows, so People's own queries are unchanged and it works before the round 1
// migration is applied (it then says so). In View as everything is shown and nothing is saved.
import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ADMISSIONS_LEAD_LABEL } from "@/lib/roles";
import { ROLE_ACCENT } from "@/lib/teacher-view-theme";
import { SectionLabel, VIEW_AS_READ_ONLY, displayNameOf, type AdminSchool } from "@/components/admin/AdminChrome";

type Member = { id: string; roles: string[] | null; profiles: { email: string | null; full_name: string | null } | null };
type Grant = { membership_id: string; granted_by_kind: "school_admin" | "lead"; granted_by_profile_id: string | null; granted_at: string };
type Audit = { id: number; action: string; at: string; actor_profile_id: string | null; detail: { membership_id?: string; profile_id?: string } | null };

const ACTION: Record<string, string> = {
  admissions_lead_grant: "added to Admissions by the lead",
  admissions_lead_remove: "removed from Admissions by the lead",
  admissions_admin_grant: "given Admissions by the School-Admin",
  admissions_admin_remove: "removed from Admissions by the School-Admin",
  admissions_lead_made: "made Admissions lead",
  admissions_lead_unmade: "stopped being Admissions lead",
};
const A = ROLE_ACCENT.admissions!;
const when = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function LeadBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-bold" style={{ background: `rgba(${A.rgb},0.14)`, color: A.hex }}>
      {ADMISSIONS_LEAD_LABEL}
    </span>
  );
}

export function AdmissionsPeople({ school, members, onChanged }: { school: AdminSchool; members: Member[]; onChanged: () => Promise<void> | void }) {
  const supabase = createBrowserSupabaseClient();
  const [leads, setLeads] = useState<Set<string> | null>(null);
  const [missing, setMissing] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const readOnly = !!school.readOnly;

  const load = useCallback(async () => {
    const ids = members.map((m) => m.id);
    const [l, g, h] = await Promise.all([
      ids.length ? supabase.from("school_memberships").select("id, admissions_lead").in("id", ids) : Promise.resolve({ data: [], error: null }),
      supabase.from("admissions_grants").select("membership_id, granted_by_kind, granted_by_profile_id, granted_at").eq("school_account_id", school.schoolAccountId),
      supabase.from("platform_audit_log").select("id, action, at, actor_profile_id, detail").eq("school_urn", school.schoolUrn).like("action", "admissions\\_%").order("at", { ascending: false }).limit(40),
    ]);
    if (l.error && /admissions_lead/.test(l.error.message)) {
      setMissing(true);
      setLeads(new Set());
      return;
    }
    setLeads(new Set(((l.data ?? []) as { id: string; admissions_lead: boolean }[]).filter((r) => r.admissions_lead).map((r) => r.id)));
    setGrants((g.data ?? []) as Grant[]);
    setHistory((h.data ?? []) as Audit[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, school.schoolAccountId, school.schoolUrn]);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const nameOf = (membershipId?: string, profileId?: string | null) => {
    const m = members.find((x) => x.id === membershipId) ?? members.find((x) => (x as unknown as { profile_id?: string }).profile_id === profileId);
    return m ? displayNameOf(m.profiles?.full_name, m.profiles?.email) : "A member";
  };
  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    if (readOnly) return setError(`${VIEW_AS_READ_ONLY}: nothing here is saved.`);
    setError(null);
    const { error: e } = await p;
    if (e) setError(e.message);
    await onChanged();
    await load();
  }
  const admissions = members.filter((m) => (m.roles ?? []).includes("admissions"));
  const removed = history.filter((h) => /_remove$/.test(h.action) && h.detail?.membership_id && !admissions.some((m) => m.id === h.detail!.membership_id));
  const leadGrants = grants.filter((g) => g.granted_by_kind === "lead");
  const B = "rounded-full border border-[var(--panel-border2)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--chip-fg)] hover:text-[var(--fg)] disabled:opacity-50";

  return (
    <section aria-label="Admissions" className="mt-4 flex flex-col gap-2 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <div className="text-[14px] font-bold">Admissions</div>
      {missing ? (
        <div className="text-[12px] text-[var(--muted)]">The Admissions lead needs the 0.7 database update (round 1); until it is applied there is no lead.</div>
      ) : (
        <>
          <SectionLabel>People with the Admissions role</SectionLabel>
          {admissions.length === 0 && <div className="text-[12px] text-[var(--muted)]">No one has the Admissions role yet. Give it with the role chips above.</div>}
          {admissions.map((m) => {
            const lead = leads?.has(m.id);
            const g = grants.find((x) => x.membership_id === m.id);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13px]">
                <span className="font-semibold">{displayNameOf(m.profiles?.full_name, m.profiles?.email)}</span>
                {lead && <LeadBadge />}
                <span className="text-[11.5px] text-[var(--muted)]">{g ? (g.granted_by_kind === "lead" ? `added by the lead, ${when(g.granted_at)}` : `given by the School-Admin, ${when(g.granted_at)}`) : ""}</span>
                <span className="grow" />
                <button type="button" className={B} disabled={readOnly} title={readOnly ? VIEW_AS_READ_ONLY : undefined} onClick={() => run(supabase.from("school_memberships").update({ admissions_lead: !lead }).eq("id", m.id))}>
                  {lead ? "Stop being lead" : "Make lead"}
                </button>
                <button type="button" className={B} disabled={readOnly} title={readOnly ? VIEW_AS_READ_ONLY : "Override: remove the Admissions role (recorded in the history)"} onClick={() => run(supabase.from("school_memberships").update({ roles: (m.roles ?? []).filter((r) => r !== "admissions").length ? (m.roles ?? []).filter((r) => r !== "admissions") : ["teacher"] }).eq("id", m.id))}>
                  Remove
                </button>
              </div>
            );
          })}
          <SectionLabel>The lead&rsquo;s grants</SectionLabel>
          {leadGrants.length === 0 ? (
            <div className="text-[12px] text-[var(--muted)]">The lead hasn&rsquo;t added anyone yet.</div>
          ) : (
            leadGrants.map((g) => (
              <div key={g.membership_id} className="text-[12.5px] text-[var(--chip-fg)]">
                {nameOf(g.membership_id)} &middot; added {when(g.granted_at)}
              </div>
            ))
          )}
          <SectionLabel>History</SectionLabel>
          {history.length === 0 ? (
            <div className="text-[12px] text-[var(--muted)]">No Admissions changes recorded yet.</div>
          ) : (
            <ul className="flex flex-col gap-1 text-[12.5px] text-[var(--chip-fg)]">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {when(h.at)}: {nameOf(h.detail?.membership_id, h.detail?.profile_id)} {ACTION[h.action] ?? h.action}
                  </span>
                  {removed.includes(h) && (
                    <button
                      type="button"
                      className={B}
                      disabled={readOnly}
                      title={readOnly ? VIEW_AS_READ_ONLY : "Override: give the Admissions role back (recorded)"}
                      onClick={() => {
                        const m = members.find((x) => x.id === h.detail!.membership_id);
                        if (m) void run(supabase.from("school_memberships").update({ roles: Array.from(new Set([...(m.roles ?? []), "admissions"])) }).eq("id", m.id));
                      }}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <div className="text-[12px] text-[#f87171]">{error}</div>}
    </section>
  );
}
