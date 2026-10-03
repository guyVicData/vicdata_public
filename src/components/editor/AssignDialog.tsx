"use client";

// VicData 0.6 S5: Assign (docs/wireframes/v0.6/Assign.dc.html; scope brief §4.7, §4.10).
//   VicData dashboard  roles at every school (super-admin), live or a copy, and the
//                      "Key VicData dashboard" toggle (Home tile + the 4-step tour);
//   school dashboard   that school's teams, always live (School-Admin);
//   personal           nobody else: "Save to my dashboards" only.
// Writes through dashboards-store setAssignments; until the S2 tables exist it keeps the
// choice in memory and says so.
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PrimaryButton } from "@/components/teacher/chooser/ui";
import type { AssignmentRow, DashboardRow } from "@/lib/dashboards-store";
import { Check } from "@/components/teacher/chooser/ui";
import { DLabel, Dialog, ErrorLine, Note, Segmented, SwitchRow } from "./bits";

export type AssignDraft = Omit<AssignmentRow, "id" | "dashboard_id">[];

export const ROLE_ROWS: { role: string; label: string; sub?: string }[] = [
  { role: "teacher", label: "Teacher", sub: "Phases the school has data for" },
  { role: "smt", label: "SMT" },
  { role: "admissions", label: "Admissions" },
  { role: "school_admin", label: "School-Admin", sub: "Only as a role they hold — admin itself is powers, not a view" },
];

export const ROLE_LABEL: Record<string, string> = { teacher: "Teacher", smt: "SMT", admissions: "Admissions", school_admin: "School-Admin", hod: "HOD", finance: "Finance" };

// "Teacher, SMT" for the status line.
export function assignedTo(rows: AssignDraft, teams: Record<string, string> = {}): string {
  const names = rows.map((a) => (a.target_kind === "role" ? ROLE_LABEL[a.role ?? ""] ?? a.role : a.target_kind === "team" ? (teams[a.team_id ?? ""] ?? "a team") : "a person"));
  return names.join(", ");
}

function TickRow({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${on ? "var(--cc-blue)" : "var(--cc-border)"}`, borderRadius: 10, padding: "11px 14px", background: on ? "var(--cc-blue-tint)" : "var(--cc-panel)", textAlign: "left", width: "100%", boxSizing: "border-box", cursor: "pointer", flex: "0 0 auto" }}
    >
      <Check on={on} />
      <span style={{ flex: "1 1 auto" }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--cc-ink)" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--cc-sub)", marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

export function AssignDialog({
  supabase,
  row,
  name,
  initial,
  available,
  onSave,
  onClose,
}: {
  supabase: SupabaseClient;
  row: DashboardRow;
  name: string;
  initial: AssignDraft;
  available: boolean;
  onSave: (next: AssignDraft) => Promise<void>;
  onClose: () => void;
}) {
  const scope = row.owner_scope;
  const [rows, setRows] = useState<AssignDraft>(initial);
  const [teams, setTeams] = useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = rows[0]?.mode ?? "live";
  const key = rows.some((r) => r.is_key);

  useEffect(() => {
    if (scope !== "school" || !row.school_account_id) return;
    supabase
      .from("teams")
      .select("id, name")
      .eq("school_account_id", row.school_account_id)
      .order("name")
      .then(({ data }) => setTeams((data ?? []) as { id: string; name: string }[]));
  }, [scope, row.school_account_id, supabase]);

  const hasRole = (role: string) => rows.some((r) => r.target_kind === "role" && r.role === role);
  const toggleRole = (role: string) =>
    setRows(hasRole(role) ? rows.filter((r) => !(r.target_kind === "role" && r.role === role)) : [...rows, { target_kind: "role", role, team_id: null, profile_id: null, mode, is_key: key }]);
  const hasTeam = (id: string) => rows.some((r) => r.target_kind === "team" && r.team_id === id);
  const toggleTeam = (id: string) =>
    setRows(hasTeam(id) ? rows.filter((r) => !(r.target_kind === "team" && r.team_id === id)) : [...rows, { target_kind: "team", role: null, team_id: id, profile_id: null, mode: "live", is_key: false }]);

  const roleCount = rows.filter((r) => r.target_kind === "role").length;
  const teamCount = rows.filter((r) => r.target_kind === "team").length;
  const footerLine =
    scope === "vicdata" ? `${roleCount} role${roleCount === 1 ? "" : "s"} · ${mode === "live" ? "live" : "a copy"}` : scope === "school" ? `${teamCount} team${teamCount === 1 ? "" : "s"} · live` : "Only you";

  const done = async () => {
    if (scope === "user") return onClose();
    setBusy(true);
    setError(null);
    try {
      await onSave(rows);
      onClose();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "That didn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      label="Assign dashboard"
      title="Assign dashboard"
      sub={`${name} · ${scope === "vicdata" ? "VicData" : scope === "school" ? "School" : "Mine"}`}
      onClose={onClose}
      footer={
        <>
          <div style={{ fontSize: 12.5, color: "var(--cc-label)" }}>{footerLine}</div>
          <PrimaryButton disabled={busy} onClick={done}>
            {busy ? "Saving…" : "Done"}
          </PrimaryButton>
        </>
      }
    >
      {scope === "vicdata" && (
        <>
          <DLabel>Who gets it &mdash; roles, every school</DLabel>
          {ROLE_ROWS.map((r) => (
            <TickRow key={r.role} on={hasRole(r.role)} title={r.label} sub={r.sub} onClick={() => toggleRole(r.role)} />
          ))}
          <DLabel top={6}>How it reaches them</DLabel>
          <Segmented
            label="How it reaches them"
            value={mode}
            pad="8px 10px"
            fontSize={12}
            onChange={(m) => setRows(rows.map((r) => ({ ...r, mode: m })))}
            options={[
              { id: "live", label: "Live — they see edits" },
              { id: "copy", label: "A copy" },
            ]}
          />
          <div style={{ fontSize: 11.5, color: "var(--cc-label)", lineHeight: 1.45 }}>Live is the default. Anyone who wants to change it uses Save as, which makes their own copy.</div>
          <DLabel top={6}>On Home</DLabel>
          <SwitchRow on={key} onChange={(v) => setRows(rows.map((r) => ({ ...r, is_key: r.target_kind === "role" ? v : r.is_key })))} title="Key VicData dashboard" sub="Gets a Home tile and the 4-step tour" />
          {key && !roleCount && <Note>Tick a role: the key tile shows on that role&apos;s Home.</Note>}
        </>
      )}
      {scope === "school" && (
        <>
          <DLabel>Share with teams</DLabel>
          {teams === null && <Note>Loading teams…</Note>}
          {teams?.length === 0 && <Note>This school has no teams yet. Make them on Teams.</Note>}
          {teams?.map((t) => (
            <TickRow key={t.id} on={hasTeam(t.id)} title={t.name} onClick={() => toggleTeam(t.id)} />
          ))}
          <Note>Always live: teams see your edits once you publish.</Note>
        </>
      )}
      {scope === "user" && <div style={{ fontSize: 12.5, color: "var(--cc-ink)", lineHeight: 1.45 }}>This is one of your own dashboards: it&apos;s saved to your dashboards only. To share it, Save as a school or VicData dashboard.</div>}
      {!available && <ErrorLine>Saving needs the database update. The choice is kept while you edit.</ErrorLine>}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Dialog>
  );
}
