"use client";

// 0.6 S1: School-Admin "Teams" (docs/wireframes/v0.6/Teams.dc.html), at /teacher/teams.
//
// Teams are a sharing target only in 0.6. The three automatic teams (All staff, SMT,
// Admissions) are real rows -- so a share can point at them -- but their membership is
// derived from roles at read time, never stored; RLS refuses writes to them. Named teams
// are the School-Admin's own: create, rename inline, delete (with an inline confirm step),
// add and remove people. One named team is open at a time.
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { DELTA_NEGATIVE, accentText } from "@/lib/teacher-view-theme";
import { visibleRolesOf } from "@/lib/roles";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import { TickList } from "@/components/teacher/TickList";
import {
  AdminBody, AdminHeader, AdminState, AdminTitle, Avatar, Footnote, PRIMARY_BUTTON, SectionLabel,
  VIEW_AS_READ_ONLY, displayNameOf, loadViewAsPeople, useAdminSchool, type AdminSchool,
} from "./AdminChrome";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";

type MemberRow = {
  id: string;
  role: string | null;
  roles: string[] | null;
  job_title: string | null;
  is_admin: boolean;
  profiles: { email: string | null; full_name: string | null } | null;
};

export type TeamRow = {
  id: string;
  name: string;
  auto_key: "all_staff" | "smt" | "admissions" | null;
  created_at: string;
  team_members: { membership_id: string }[];
  // TODO(0.6 S2+): what this team has been given -- dashboards and meeting assignments.
  // Neither table exists yet, so nothing fills it and the "Shared with this team" line
  // stays hidden until something does.
  sharedWith?: string[];
};

const AUTO_ORDER = ["all_staff", "smt", "admissions"] as const;

const CARD = "rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3.5 py-3";

const ICON_BTN = "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border-none bg-transparent text-[var(--muted)] hover:text-[var(--fg)]";

const TRASH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
  </svg>
);
const CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function TeamsScreen() {
  const [theme] = useTeacherTheme();
  const state = useAdminSchool();
  return (
    <main id="teacher-root" data-theme={theme} className="leading-[1.2] w-full flex-grow bg-[var(--bg)] text-[var(--fg)]">
      {/* 0.6 snag 4: View as shows Teams read-only to a School-Admin View as. */}
      <ViewAsBanner className="mx-4 mt-3" />
      <AdminHeader active="teams" />
      {state.status === "loading" && <AdminBody><AdminState>Loading…</AdminState></AdminBody>}
      {state.status === "signed-out" && <AdminBody><AdminState>Sign in to manage your school&rsquo;s teams.</AdminState></AdminBody>}
      {(state.status === "no-school" || (state.status === "ready" && !state.school.canManage)) && (
        <AdminBody><AdminState>Only your School-Admin can manage teams.</AdminState></AdminBody>
      )}
      {state.status === "ready" && state.school.canManage && <Teams school={state.school} />}
    </main>
  );
}

export function Teams({ school }: { school: AdminSchool }) {
  const supabase = createBrowserSupabaseClient();
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The team just made: its name field takes focus so typing renames it straight away.
  const [focusId, setFocusId] = useState<string | null>(null);

  const readOnly = !!school.readOnly;
  const load = useCallback(async () => {
    if (school.readOnly) {
      const got = await loadViewAsPeople(school);
      if (!got) setError("Could not load your school's teams. Try again.");
      setTeams((got?.teams as TeamRow[]) ?? []);
      setMembers(((got?.members ?? []) as (MemberRow & { status: string })[]).filter((m) => m.status === "approved"));
      return;
    }
    const [t, m] = await Promise.all([
      supabase
        .from("teams")
        .select("id, name, auto_key, created_at, team_members(membership_id)")
        .eq("school_account_id", school.schoolAccountId)
        .order("created_at"),
      supabase
        .from("school_memberships")
        .select("id, role, roles, job_title, is_admin, profiles(email, full_name)")
        .eq("school_account_id", school.schoolAccountId)
        .eq("status", "approved"),
    ]);
    if (t.error || m.error) setError("Could not load your school's teams. Try again.");
    setTeams((t.data as unknown as TeamRow[]) ?? []);
    setMembers((m.data as unknown as MemberRow[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.schoolAccountId]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    // View as never writes the school's teams (the query is never sent: it runs on await).
    if (readOnly) {
      setError(`${VIEW_AS_READ_ONLY}: nothing here is saved.`);
      return;
    }
    setError(null);
    const { error: e } = await p;
    if (e) setError(e.message);
    await load();
  }

  const all = teams ?? [];
  const named = all.filter((t) => t.auto_key === null);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const autoCount = (key: "all_staff" | "smt" | "admissions") =>
    key === "all_staff"
      ? members.length
      : members.filter((m) => visibleRolesOf({ ...m, isAccountHolder: m.id === school.accountHolderMembershipId }).includes(key)).length;
  const autoSubtitle = (key: "all_staff" | "smt" | "admissions") => {
    const n = autoCount(key);
    const who = key === "all_staff" ? `Everyone at ${school.schoolName}` : `Everyone with the ${key === "smt" ? "SMT" : "Admissions"} role`;
    return `${who} · ${n} ${n === 1 ? "person" : "people"}`;
  };

  async function createTeam() {
    if (readOnly) return;
    setCreating(true);
    setError(null);
    const taken = new Set(named.map((t) => t.name));
    let name = "New team";
    for (let i = 2; taken.has(name); i++) name = `New team ${i}`;
    const { data, error: e } = await supabase
      .from("teams")
      .insert({ school_account_id: school.schoolAccountId, name, created_by: school.userId })
      .select("id")
      .single<{ id: string }>();
    setCreating(false);
    if (e) setError(e.message);
    await load();
    if (data) {
      setOpenId(data.id);
      setFocusId(data.id);
    }
  }

  return (
    <AdminBody>
      <AdminTitle
        title="Teams"
        subtitle={readOnly ? `Who you can share dashboards and meetings with · ${VIEW_AS_READ_ONLY}: nothing here is saved` : "Who you can share dashboards and meetings with"}
        action={
          <button type="button" onClick={createTeam} disabled={creating || readOnly} title={readOnly ? VIEW_AS_READ_ONLY : undefined} className={PRIMARY_BUTTON}>
            + New team
          </button>
        }
      />

      {error && <p role="alert" className="text-[12px]" style={{ color: accentText(DELTA_NEGATIVE) }}>{error}</p>}
      {teams === null && <AdminState>Loading…</AdminState>}

      {teams !== null && (
        <>
          <SectionLabel>Automatic &mdash; from roles</SectionLabel>
          {AUTO_ORDER.map((key) => {
            const t = all.find((x) => x.auto_key === key);
            return (
              <div key={key} className={`${CARD} flex items-center gap-2.5`}>
                <div className="min-w-0 flex-grow">
                  <div className="text-[14px] font-bold">{t?.name ?? (key === "all_staff" ? "All staff" : key === "smt" ? "SMT" : "Admissions")}</div>
                  <div className="text-[12px] text-[var(--muted)]">{autoSubtitle(key)}</div>
                </div>
                <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--muted)]">Auto</span>
              </div>
            );
          })}

          <SectionLabel className="mt-1">Made by you</SectionLabel>
          {named.length === 0 && (
            <div className="text-[12px] text-[var(--muted)]">No teams yet. &ldquo;+ New team&rdquo; makes one.</div>
          )}
          {named.map((t) =>
            t.id === openId ? (
              <OpenTeam
                key={t.id}
                readOnly={readOnly}
                team={t}
                members={members}
                memberById={memberById}
                autoFocus={focusId === t.id}
                onRename={(name) => run(supabase.from("teams").update({ name, updated_at: new Date().toISOString() }).eq("id", t.id))}
                onDelete={async () => {
                  await run(supabase.from("teams").delete().eq("id", t.id));
                  setOpenId(null);
                }}
                onAdd={(membershipId) => run(supabase.from("team_members").insert({ team_id: t.id, membership_id: membershipId, added_by: school.userId }))}
                onRemove={(membershipId) => run(supabase.from("team_members").delete().eq("team_id", t.id).eq("membership_id", membershipId))}
              />
            ) : (
              <button
                key={t.id}
                type="button"
                onClick={() => { setOpenId(t.id); setFocusId(null); }}
                aria-expanded={false}
                className={`${CARD} flex w-full items-center gap-2.5 text-left`}
              >
                <div className="min-w-0 flex-grow">
                  <div className="truncate text-[14px] font-bold">{t.name}</div>
                  <StackedAvatars ids={t.team_members.map((tm) => tm.membership_id)} memberById={memberById} />
                </div>
                <span className="shrink-0 text-[var(--muted3)]">{CHEVRON}</span>
              </button>
            ),
          )}
        </>
      )}

      <Footnote>People can be in any number of teams. Teams only control sharing in 0.6; HOD rosters come later.</Footnote>
    </AdminBody>
  );
}

const STACK_MAX = 6;

function StackedAvatars({ ids, memberById }: { ids: string[]; memberById: Map<string, MemberRow> }) {
  const people = ids.map((id) => memberById.get(id)).filter((m): m is MemberRow => Boolean(m));
  if (people.length === 0) return <div className="mt-[5px] text-[12px] text-[var(--muted)]">No one yet</div>;
  const extra = people.length - STACK_MAX;
  return (
    <div className="mt-[5px] flex items-center pl-1.5" aria-label={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
      {people.slice(0, STACK_MAX).map((m) => (
        <Avatar key={m.id} fullName={m.profiles?.full_name} email={m.profiles?.email} size={24} ring className="-ml-1.5" />
      ))}
      {extra > 0 && <span className="ml-1.5 text-[11px] font-semibold text-[var(--muted)]">+{extra}</span>}
    </div>
  );
}

function OpenTeam({
  readOnly = false,
  team,
  members,
  memberById,
  autoFocus,
  onRename,
  onDelete,
  onAdd,
  onRemove,
}: {
  readOnly?: boolean;
  team: TeamRow;
  members: MemberRow[];
  memberById: Map<string, MemberRow>;
  autoFocus: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAdd: (membershipId: string) => void;
  onRemove: (membershipId: string) => void;
}) {
  const [draft, setDraft] = useState(team.name);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickerRef = useDismiss(picking, () => setPicking(false));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.select();
  }, [autoFocus]);

  const inTeam = new Set(team.team_members.map((tm) => tm.membership_id));
  const rows = team.team_members
    .map((tm) => memberById.get(tm.membership_id))
    .filter((m): m is MemberRow => Boolean(m))
    .sort((a, b) => displayNameOf(a.profiles?.full_name, a.profiles?.email).localeCompare(displayNameOf(b.profiles?.full_name, b.profiles?.email)));

  const commitName = () => {
    const next = draft.trim().slice(0, 80);
    if (!next) { setDraft(team.name); return; }
    if (next !== team.name) onRename(next);
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--edge-strong)] bg-[var(--panel-bg)] px-3.5 py-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={80}
          aria-label="Team name"
          readOnly={readOnly}
          title={readOnly ? VIEW_AS_READ_ONLY : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(team.name);
          }}
          className="min-w-0 flex-grow border-0 border-b border-dashed border-[var(--edge-strong)] bg-transparent py-0.5 text-[14px] font-bold text-[var(--fg)] outline-none"
        />
        <button type="button" onClick={() => setConfirming(true)} disabled={readOnly} aria-label="Delete team" title={readOnly ? VIEW_AS_READ_ONLY : "Delete team"} className={`${ICON_BTN} disabled:opacity-50`} style={{ color: DELTA_NEGATIVE }}>
          {TRASH}
        </button>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="flex-grow">Delete {team.name}? People stay at the school.</span>
          <button type="button" onClick={onDelete} className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: DELTA_NEGATIVE }}>
            Delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-[var(--edge-strong)] px-3 py-1 text-[12px] font-semibold text-[var(--chip-fg)]">
            Cancel
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((m) => {
            const name = displayNameOf(m.profiles?.full_name, m.profiles?.email);
            return (
              <div key={m.id} className="flex items-center gap-2 text-[13px]">
                <Avatar fullName={m.profiles?.full_name} email={m.profiles?.email} size={24} />
                <span className="min-w-0 flex-grow truncate">{name}{m.job_title ? <> &middot; {m.job_title}</> : null}</span>
                <button type="button" onClick={() => onRemove(m.id)} disabled={readOnly} aria-label={`Remove ${name} from team`} title={readOnly ? VIEW_AS_READ_ONLY : "Remove from team"} className={`${ICON_BTN} disabled:opacity-50`}>
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setPicking(!picking)}
          disabled={readOnly}
          title={readOnly ? VIEW_AS_READ_ONLY : undefined}
          aria-expanded={picking}
          aria-haspopup="menu"
          className="w-full rounded-lg border border-dashed border-[var(--edge-strong)] bg-transparent p-[7px] text-[12.5px] font-semibold text-[var(--chip-fg)] disabled:opacity-60"
        >
          {readOnly ? <>+ Add people &middot; {VIEW_AS_READ_ONLY}</> : "+ Add people"}
        </button>
        {picking && (
          <PanelMenu label="Add people" width={320}>
            <TickList
              items={members
                .slice()
                .sort((a, b) => displayNameOf(a.profiles?.full_name, a.profiles?.email).localeCompare(displayNameOf(b.profiles?.full_name, b.profiles?.email)))
                .map((m) => ({ key: m.id, label: displayNameOf(m.profiles?.full_name, m.profiles?.email), sublabel: m.job_title ?? undefined }))}
              checked={(id) => inTeam.has(id)}
              onToggle={(id) => (inTeam.has(id) ? onRemove(id) : onAdd(id))}
              accent="var(--fg)"
              empty="No approved people at this school yet."
            />
          </PanelMenu>
        )}
      </div>

      {team.sharedWith && team.sharedWith.length > 0 && (
        <div className="text-[11.5px] text-[var(--muted3)]">Shared with this team: {team.sharedWith.join(", ")}</div>
      )}
    </div>
  );
}
