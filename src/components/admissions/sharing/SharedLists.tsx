"use client";

// VicData 0.7 admissions r2 (D6, decisions 2 and 5): sharing the Admissions lists.
//   ShareDialog       the lead and SMT share the school's lists with roles, teams or people
//                     (admissions_list_shares; SMT changes only its own shares: round 1's RLS)
//   SharedListsOnly   what someone a list is shared with sees: the lists only -- each list's
//                     school names, who changed it and when -- never the computed views (the
//                     routes stay role-gated; decision 5)
// Everything is read and written with the member's own session; RLS decides.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { entryPoint } from "@/lib/admissions/entry-points";
import { TeacherModal } from "@/components/teacher/TeacherModal";
import type { Theme } from "@/components/teacher/TeacherChrome";
import { VISIBLE_ROLE_LABELS, type VisibleRoleId } from "@/lib/roles";
import type { AdmissionsMember } from "../member";
import { AdmissionsTeacherNav } from "../controls";
import { cx } from "../ui";

const KIND: Record<string, string> = { day_feeders: "Day feeders", boarding_feeders: "Boarding feeders", rivals: "Rivals", rung: "Ladder rung" };
type ListRow = { id: string; entry_point: string; kind: string; rung: string; members: string[] | null; updated_by: string | null; updated_at: string | null };

export function SharedListsOnly({ member, theme, onTheme }: { member: AdmissionsMember; theme: Theme; onTheme: (t: Theme) => void }) {
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.from("admissions_lists").select("id, entry_point, kind, rung, members, updated_by, updated_at").eq("school_account_id", member.schoolAccountId).order("entry_point");
      const lists = (data ?? []) as ListRow[];
      setRows(lists);
      const urns = Array.from(new Set(lists.flatMap((l) => l.members ?? [])));
      const out: Record<string, string> = {};
      for (let i = 0; i < urns.length; i += 200) {
        const { data: s } = await supabase.from("schools").select("urn, current_name").in("urn", urns.slice(i, i + 200));
        for (const r of (s ?? []) as { urn: string; current_name: string }[]) out[r.urn] = r.current_name;
      }
      setNames(out);
    })();
  }, [member.schoolAccountId]);
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4 px-7 py-5">
      <AdmissionsTeacherNav schoolUrn={member.schoolUrn} theme={theme} onTheme={onTheme} />
      <div>
        <h1 className="text-[18px] font-bold">Admissions lists shared with you &mdash; {member.schoolName}</h1>
        <p className="mt-1 text-[13px] text-[var(--muted2)]">The school&rsquo;s Admissions team shared these lists with you: the schools on each list. The pipelines and market share themselves are for the Admissions and SMT staff.</p>
      </div>
      {rows === null ? (
        <p className="text-[13px] text-[var(--muted2)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-[var(--muted2)]">No lists have been saved yet.</p>
      ) : (
        rows.map((l) => (
          <section key={l.id} className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-bold">
                {entryPoint(l.entry_point)?.label ?? l.entry_point} &middot; {KIND[l.kind] ?? l.kind}
                {l.rung ? ` (${l.rung.replace("age:", "age ")})` : ""}
              </span>
              <span className="grow" />
              {l.updated_at && <span className="text-[11px] text-[var(--muted)]">changed {new Date(l.updated_at).toLocaleDateString("en-GB")}</span>}
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] text-[var(--chip-fg)] sm:grid-cols-2">
              {(l.members ?? []).map((u) => (
                <li key={u}>
                  <Link href={`/schools/${u}`} className="hover:underline">
                    {names[u] ?? u}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
type Share = { id: string; target_kind: "role" | "team" | "user"; role: string | null; team_id: string | null; profile_id: string | null; created_by: string | null; created_at: string };
type Team = { id: string; name: string };
type Person = { profile_id: string; name: string };
const SHARE_ROLES: VisibleRoleId[] = ["teacher", "smt", "admissions", "school_admin"];

export function ShareDialog({ member, onClose }: { member: AdmissionsMember; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<"role" | "team" | "user">("role");
  const [target, setTarget] = useState<string>("teacher");
  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const [s, t, m] = await Promise.all([
      supabase.from("admissions_list_shares").select("id, target_kind, role, team_id, profile_id, created_by, created_at").eq("school_account_id", member.schoolAccountId).order("created_at"),
      supabase.from("teams").select("id, name").eq("school_account_id", member.schoolAccountId),
      supabase.from("school_memberships").select("profile_id, profiles(full_name, email)").eq("school_account_id", member.schoolAccountId).eq("status", "approved"),
    ]);
    if (s.error) setErr(/does not exist|schema cache/i.test(s.error.message) ? "Sharing isn't set up on this database yet." : "Couldn't read the shares.");
    setShares((s.data ?? []) as Share[]);
    setTeams((t.data ?? []) as Team[]);
    setPeople(((m.data ?? []) as unknown as { profile_id: string; profiles: { full_name: string | null; email: string | null } | null }[]).map((r) => ({ profile_id: r.profile_id, name: r.profiles?.full_name || r.profiles?.email || "A member" })));
  }, [member.schoolAccountId]);
  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);
  const nameOf = (s: Share) => (s.target_kind === "role" ? `Everyone with ${VISIBLE_ROLE_LABELS[s.role as VisibleRoleId] ?? s.role}` : s.target_kind === "team" ? `Team: ${teams.find((t) => t.id === s.team_id)?.name ?? "a team"}` : (people.find((p) => p.profile_id === s.profile_id)?.name ?? "A member"));
  const canRemove = (s: Share) => !member.viewAs && (member.access === "lead" || member.isAdmin || s.created_by === member.userId);
  const add = async () => {
    setErr(null);
    const row = { school_account_id: member.schoolAccountId, target_kind: kind, role: kind === "role" ? target : null, team_id: kind === "team" ? target : null, profile_id: kind === "user" ? target : null };
    const { error } = await createBrowserSupabaseClient().from("admissions_list_shares").insert(row);
    if (error) setErr(error.code === "42501" ? "Only the Admissions lead, SMT and the School-Admin can share the lists." : "Couldn't share.");
    await load();
  };
  const remove = async (s: Share) => {
    const { error } = await createBrowserSupabaseClient().from("admissions_list_shares").delete().eq("id", s.id);
    if (error) setErr("Couldn't remove it.");
    await load();
  };
  const options = kind === "role" ? SHARE_ROLES.map((r) => ({ id: r, label: VISIBLE_ROLE_LABELS[r] })) : kind === "team" ? teams.map((t) => ({ id: t.id, label: t.name })) : people.map((p) => ({ id: p.profile_id, label: p.name }));
  return (
    <TeacherModal label="Share the Admissions lists" backdropLabel="Close" onClose={onClose} size="compact">
      <div className="flex w-[440px] max-w-full flex-col gap-3 p-5 text-[var(--fg)]">
        <div className="flex items-center">
          <h2 className="text-[15px] font-bold">Share the Admissions lists</h2>
          <span className="grow" />
          <button type="button" onClick={onClose} className="text-[13px] text-[var(--muted)]">
            Close
          </button>
        </div>
        <p className="text-[12px] leading-snug text-[var(--muted2)]">The people you share with see the lists (the schools on each), not the pipelines or market share. Editing stays with the Admissions lead.</p>
        <div className="flex flex-col gap-1">
          {(shares ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-[8px] border border-[var(--panel-border)] px-3 py-2 text-[12.5px]">
              <span className="grow">{nameOf(s)}</span>
              {canRemove(s) && (
                <button type="button" onClick={() => remove(s)} className="text-[12px] text-[var(--muted)] hover:text-[var(--fg)]">
                  Remove
                </button>
              )}
            </div>
          ))}
          {shares && shares.length === 0 && <span className="text-[12px] text-[var(--muted)]">Not shared with anyone yet.</span>}
        </div>
        {member.canShare && !member.viewAs ? (
          <div className="flex flex-wrap items-center gap-2">
            {(["role", "team", "user"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setKind(k); setTarget(k === "role" ? "teacher" : ""); }} className={cx("rounded-full border px-3 py-1 text-[12px] font-semibold", kind === k ? "border-[var(--accent)] bg-[var(--adm-tint)]" : "border-[var(--panel-border2)] text-[var(--chip-fg)]")}>
                {k === "role" ? "A role" : k === "team" ? "A team" : "A person"}
              </button>
            ))}
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="grow rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-2 py-1 text-[12px]">
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" disabled={!target} onClick={add} className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-bold text-[var(--adm-on-accent)] disabled:opacity-50">
              Share
            </button>
          </div>
        ) : null}
        {err && <div className="text-[12px] text-[var(--adm-down-fg)]">{err}</div>}
      </div>
    </TeacherModal>
  );
}
