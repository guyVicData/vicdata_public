"use client";

// 0.6 S1: School-Admin "People" (docs/wireframes/v0.6/People.dc.html), at /teacher/people.
//
// Roles are a set per person (school_memberships.roles); School-Admin is is_admin, which
// only the account holder may change (a trigger enforces it, so the chip is disabled for
// everyone else rather than failing on click). Approve and Decline make exactly the calls
// /account's member panel makes. Job title is free text, display only.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ATTENTION_ACCENT, ATTENTION_INK, DELTA_NEGATIVE, accentOver, accentText } from "@/lib/teacher-view-theme";
import { VISIBLE_ROLES, VISIBLE_ROLE_LABELS, normaliseRole, visibleRolesOf, type VisibleRoleId } from "@/lib/roles";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import {
  AdminBody, AdminHeader, AdminState, AdminTitle, Avatar, Footnote, PRIMARY_BUTTON, RoleChip, RolePill,
  SearchBox, SectionLabel, displayNameOf, useAdminSchool, type AdminSchool,
} from "./AdminChrome";

type MemberRow = {
  id: string;
  status: string;
  role: string | null;
  roles: string[] | null;
  job_title: string | null;
  is_admin: boolean;
  profiles: { email: string | null; full_name: string | null } | null;
};

type TeamRow = { id: string; name: string; auto_key: string | null; team_members: { membership_id: string }[] };

type Filter = "all" | VisibleRoleId | "waiting";

const WAITING_STATUSES = new Set(["pending_approval", "pending_verification"]);

// "leightonpark.com" from "https://www.leightonpark.com/" -- the same normalisation
// join_school uses to verify a first member, so "school email matched" means what it does
// there.
function websiteDomain(website: string | null): string | null {
  if (!website) return null;
  const d = website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return d || null;
}

export function PeopleScreen() {
  const [theme] = useTeacherTheme();
  const state = useAdminSchool();
  return (
    <main id="teacher-root" data-theme={theme} className="leading-[1.2] w-full flex-grow bg-[var(--bg)] text-[var(--fg)]">
      <AdminHeader active="people" />
      {state.status === "loading" && <AdminBody><AdminState>Loading…</AdminState></AdminBody>}
      {state.status === "signed-out" && <AdminBody><AdminState>Sign in to manage your school&rsquo;s people.</AdminState></AdminBody>}
      {state.status === "no-school" && <AdminBody><AdminState>Only your School-Admin can manage people.</AdminState></AdminBody>}
      {state.status === "ready" && !state.school.canManage && <AdminBody><AdminState>Only your School-Admin can manage people.</AdminState></AdminBody>}
      {state.status === "ready" && state.school.canManage && <People school={state.school} />}
    </main>
  );
}

export function People({ school }: { school: AdminSchool }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [domain, setDomain] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, t] = await Promise.all([
      supabase
        .from("school_memberships")
        .select("id, status, role, roles, job_title, is_admin, profiles(email, full_name)")
        .eq("school_account_id", school.schoolAccountId),
      supabase.from("teams").select("id, name, auto_key, team_members(membership_id)").eq("school_account_id", school.schoolAccountId),
    ]);
    if (m.error) setError("Could not load your school's people. Try again.");
    setMembers((m.data as unknown as MemberRow[]) ?? []);
    setTeams((t.data as unknown as TeamRow[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.schoolAccountId]);

  useEffect(() => {
    (async () => {
      await load();
      const { data } = await supabase.from("schools").select("website").eq("urn", school.schoolUrn).maybeSingle<{ website: string | null }>();
      setDomain(websiteDomain(data?.website ?? null));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const rolesOf = useCallback(
    (m: MemberRow) => visibleRolesOf({ ...m, isAccountHolder: m.id === school.accountHolderMembershipId }),
    [school.accountHolderMembershipId],
  );

  const all = useMemo(() => members ?? [], [members]);
  const waiting = all.filter((m) => WAITING_STATUSES.has(m.status));
  const approved = all.filter((m) => m.status === "approved");

  const q = query.trim().toLowerCase();
  const matches = (m: MemberRow) =>
    !q ||
    [m.profiles?.full_name, m.profiles?.email, m.job_title].some((v) => v?.toLowerCase().includes(q));
  const byName = (a: MemberRow, b: MemberRow) =>
    displayNameOf(a.profiles?.full_name, a.profiles?.email).localeCompare(displayNameOf(b.profiles?.full_name, b.profiles?.email));

  const shownWaiting = filter === "all" || filter === "waiting" ? waiting.filter(matches).sort(byName) : [];
  const shownApproved =
    filter === "waiting" ? [] : approved.filter((m) => matches(m) && (filter === "all" || rolesOf(m).includes(filter))).sort(byName);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error: e } = await p;
    if (e) setError(e.message);
    await load();
  }

  const approve = (id: string) =>
    run(
      supabase
        .from("school_memberships")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: school.membershipId, roles: ["teacher"] })
        .eq("id", id),
    );
  const decline = (id: string) => run(supabase.from("school_memberships").delete().eq("id", id));

  function toggleRole(m: MemberRow, role: VisibleRoleId) {
    const isHolder = m.id === school.accountHolderMembershipId;
    if (role === "school_admin") {
      if (!school.isAccountHolder || isHolder) return;
      void run(supabase.from("school_memberships").update({ is_admin: !m.is_admin }).eq("id", m.id));
      return;
    }
    // The stored set, legacy values folded; any hidden role (HOD, Finance) is kept.
    const stored = Array.from(new Set((m.roles && m.roles.length ? m.roles : [m.role]).map(normaliseRole)));
    const next = stored.includes(role) ? stored.filter((r) => r !== role) : [...stored, role];
    const keepsARole = next.some((r) => r === "teacher" || r === "smt" || r === "admissions");
    if (!keepsARole && !(m.is_admin || isHolder)) {
      setError("Everyone keeps at least one role. Switch another on first.");
      return;
    }
    void run(supabase.from("school_memberships").update({ roles: next }).eq("id", m.id));
  }

  const saveJobTitle = (m: MemberRow, value: string) => {
    const next = value.trim().slice(0, 120) || null;
    if (next === (m.job_title ?? null)) return;
    void run(supabase.from("school_memberships").update({ job_title: next }).eq("id", m.id));
  };

  // No invite email exists yet: Invite copies the school's join link.
  async function invite() {
    const link = `${window.location.origin}/join/${school.schoolUrn}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copy this link to invite someone: ${link}`);
    }
  }

  const teamsLine = (m: MemberRow) => {
    const roles = rolesOf(m);
    const names: string[] = [];
    if (roles.includes("smt")) names.push("SMT (automatic)");
    if (roles.includes("admissions")) names.push("Admissions (automatic)");
    for (const t of teams) {
      if (t.auto_key === null && t.team_members.some((tm) => tm.membership_id === m.id)) names.push(t.name);
    }
    return names.length ? names.join(", ") : "All staff (automatic)";
  };

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    ...VISIBLE_ROLES.map((r) => ({ id: r as Filter, label: VISIBLE_ROLE_LABELS[r] })),
  ];

  return (
    <AdminBody>
      <AdminTitle
        title={`People at ${school.schoolName}`}
        subtitle="School-Admin: you set roles and teams"
        action={
          <button type="button" onClick={invite} className={PRIMARY_BUTTON} title="Copy your school's join link">
            {copied ? "Link copied" : "Invite"}
          </button>
        }
      />

      <SearchBox value={query} onChange={setQuery} placeholder="Search people" />

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <FilterChip key={c.id} on={filter === c.id} onClick={() => setFilter(c.id)}>{c.label}</FilterChip>
        ))}
        {waiting.length > 0 && (
          <FilterChip on={filter === "waiting"} onClick={() => setFilter("waiting")} amber>
            Waiting &middot; {waiting.length}
          </FilterChip>
        )}
      </div>

      {error && <p role="alert" className="text-[12px]" style={{ color: accentText(DELTA_NEGATIVE) }}>{error}</p>}
      {members === null && <AdminState>Loading…</AdminState>}

      {shownWaiting.map((m) => {
        const email = m.profiles?.email ?? null;
        const matched = Boolean(domain && email && email.toLowerCase().split("@")[1] === domain);
        return (
          <div
            key={m.id}
            className="flex flex-col gap-2 rounded-xl border px-3.5 py-3"
            style={{ borderColor: accentOver(ATTENTION_ACCENT.hex, 27), background: accentOver(ATTENTION_ACCENT.hex, 6) }}
          >
            <div className="flex items-center gap-2.5">
              <Avatar fullName={m.profiles?.full_name} email={email} />
              <div className="min-w-0 flex-grow">
                <div className="truncate text-[14px] font-bold">{displayNameOf(m.profiles?.full_name, email)}</div>
                <div className="truncate text-[12px] text-[var(--muted)]">
                  Asked to join &middot; {matched ? "school email matched" : email ?? "no email"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => approve(m.id)}
                className="rounded-full border-none px-3.5 py-1.5 text-[12px] font-bold"
                style={{ background: ATTENTION_ACCENT.hex, color: ATTENTION_INK }}
              >
                Approve as Teacher
              </button>
              <button
                type="button"
                onClick={() => decline(m.id)}
                className="rounded-full border border-[var(--edge-strong)] bg-transparent px-3.5 py-1.5 text-[12px] font-semibold text-[var(--chip-fg)]"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}

      {shownApproved.map((m) => {
        const roles = rolesOf(m);
        const editing = editingId === m.id;
        const isHolder = m.id === school.accountHolderMembershipId;
        const email = m.profiles?.email ?? null;
        const sub = m.job_title || email || "";
        return (
          <div
            key={m.id}
            className="flex flex-col gap-2 rounded-xl border bg-[var(--panel-bg)] px-3.5 py-3"
            style={{ borderColor: editing ? "var(--edge-strong)" : "var(--panel-border)" }}
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setEditingId(editing ? null : m.id)}
                aria-expanded={editing}
                aria-label={`${editing ? "Close" : "Edit"} ${displayNameOf(m.profiles?.full_name, email)}`}
                className="shrink-0 rounded-full"
              >
                <Avatar fullName={m.profiles?.full_name} email={email} />
              </button>
              <div className="min-w-0 flex-grow">
                <button type="button" onClick={() => setEditingId(editing ? null : m.id)} className="block max-w-full truncate text-left text-[14px] font-bold">
                  {displayNameOf(m.profiles?.full_name, email)}
                </button>
                {editing ? (
                  <JobTitleInput key={m.job_title ?? ""} value={m.job_title ?? ""} onSave={(v) => saveJobTitle(m, v)} />
                ) : (
                  sub && <div className="truncate text-[12px] text-[var(--muted)]">{sub}</div>
                )}
              </div>
              {editing ? (
                <button type="button" onClick={() => setEditingId(null)} className="shrink-0 text-[11px] text-[var(--muted)]">Editing</button>
              ) : (
                <RolePills roles={roles} onClick={() => setEditingId(m.id)} />
              )}
            </div>
            {editing && (
              <>
                <SectionLabel>Roles &mdash; tap to switch on or off</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {VISIBLE_ROLES.map((r) => {
                    const adminChip = r === "school_admin";
                    const disabled = adminChip && (!school.isAccountHolder || isHolder);
                    const title = !adminChip
                      ? undefined
                      : isHolder
                        ? "The account holder is always School-Admin"
                        : !school.isAccountHolder
                          ? "Only the account holder can change School-Admin"
                          : undefined;
                    return (
                      <RoleChip key={r} role={r} on={roles.includes(r)} disabled={disabled} title={title} onToggle={() => toggleRole(m, r)} />
                    );
                  })}
                </div>
                <div className="text-[11.5px] text-[var(--muted3)]">Teams: {teamsLine(m)}</div>
              </>
            )}
          </div>
        );
      })}

      {members !== null && shownWaiting.length + shownApproved.length === 0 && (
        <AdminState>{q ? "No one matches that search." : "No one here yet."}</AdminState>
      )}

      <Footnote>
        Job title is free text and only for display. Roles decide what people see. HOD and Finance stay in the system but are hidden for now.
      </Footnote>
    </AdminBody>
  );
}

// The board puts School-Admin first on a collapsed card ("School-Admin", "SMT").
function RolePills({ roles, onClick }: { roles: VisibleRoleId[]; onClick: () => void }) {
  const ordered = [...roles].sort((a, b) => (a === "school_admin" ? -1 : b === "school_admin" ? 1 : 0));
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 flex-wrap justify-end gap-2" aria-label="Edit roles">
      {ordered.map((r) => <RolePill key={r} role={r} />)}
    </button>
  );
}

function FilterChip({ on, amber = false, onClick, children }: { on: boolean; amber?: boolean; onClick: () => void; children: ReactNode }) {
  const style = on
    ? amber
      ? { borderColor: ATTENTION_ACCENT.hex, background: ATTENTION_ACCENT.hex, color: ATTENTION_INK }
      : { borderColor: "var(--fg)", background: "var(--fg)", color: "var(--bg)" }
    : amber
      ? { borderColor: ATTENTION_ACCENT.hex, color: accentText(ATTENTION_ACCENT.hex) }
      : undefined;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="rounded-full border border-[var(--panel-border2)] bg-transparent px-2.5 py-1 text-[11.5px] font-semibold text-[var(--chip-fg)]"
      style={style}
    >
      {children}
    </button>
  );
}

// Inline, in the editing card: the subtitle line becomes a dashed-underline input (the
// same treatment as Teams' rename). Saved on Enter or on leaving the field.
function JobTitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      type="text"
      value={draft}
      maxLength={120}
      placeholder="Job title"
      aria-label="Job title"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className="mt-px block w-full border-0 border-b border-dashed border-[var(--edge-strong)] bg-transparent py-px text-[12px] text-[var(--muted)] outline-none placeholder:text-[var(--muted3)] focus:text-[var(--fg)]"
    />
  );
}
