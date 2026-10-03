"use client";

// 0.6 S1: the pieces the School-Admin screens (People.dc.html, Teams.dc.html) and the
// super-admin Platform screen (Platform.dc.html) share, defined once so the two phone
// boards cannot drift a padding value apart: the People/Teams header, avatars, role
// pills and chips, the search box, the switch, and the "who am I at which school" load.
//
// Colours are the Teacher view tokens (globals.css #teacher-root), never the boards'
// literal hexes, which are their dark-only stand-ins: #0a0a0b --bg, #131315 --panel-bg,
// #1e1e22 --panel-border, #2a2a2e --panel-border2, #8a8a90 --muted, #6a6a70 --muted3,
// #5c5c62 --source, #c9c9ce --chip-fg, #3a3a40 --edge-strong.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { DELTA_POSITIVE, ROLE_ACCENT, accentText } from "@/lib/teacher-view-theme";
import { VISIBLE_ROLE_LABELS, type VisibleRoleId } from "@/lib/roles";

// ---------------------------------------------------------------------------------------
// Who is looking, at which school, and may they manage it.

export type AdminSchool = {
  userId: string;
  membershipId: string;
  schoolAccountId: string;
  schoolUrn: string;
  schoolName: string;
  accountHolderMembershipId: string | null;
  isAccountHolder: boolean;
  // School-Admin: an approved member with is_admin, or the account holder.
  canManage: boolean;
};

type MembershipRow = {
  id: string;
  is_admin: boolean;
  school_account_id: string;
  school_accounts: {
    id: string;
    school_urn: string;
    account_holder_membership_id: string | null;
    schools: { current_name: string } | null;
  } | null;
};

export type AdminSchoolState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "no-school" }
  | { status: "ready"; school: AdminSchool };

// One approved membership per user, as every Teacher page assumes (.maybeSingle()).
// Filtered to the caller's own profile: the select policy also returns every colleague's
// approved row, so an unfiltered maybeSingle errors at any school with two members.
export async function loadAdminSchool(): Promise<AdminSchoolState> {
  const supabase = createBrowserSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { status: "signed-out" };
  const { data } = await supabase
    .from("school_memberships")
    .select(
      "id, is_admin, school_account_id, school_accounts!school_memberships_school_account_id_fkey(id, school_urn, account_holder_membership_id, schools(current_name))",
    )
    .eq("profile_id", user.id)
    .eq("status", "approved")
    .maybeSingle<MembershipRow>();
  const account = data?.school_accounts;
  if (!data || !account) return { status: "no-school" };
  const isAccountHolder = account.account_holder_membership_id === data.id;
  return {
    status: "ready",
    school: {
      userId: user.id,
      membershipId: data.id,
      schoolAccountId: account.id,
      schoolUrn: account.school_urn,
      schoolName: account.schools?.current_name ?? account.school_urn,
      accountHolderMembershipId: account.account_holder_membership_id,
      isAccountHolder,
      canManage: data.is_admin || isAccountHolder,
    },
  };
}

export function useAdminSchool(): AdminSchoolState {
  const [state, setState] = useState<AdminSchoolState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadAdminSchool();
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, []);
  return state;
}

// ---------------------------------------------------------------------------------------
// Layout

// The phone boards are 390 wide; on a wider screen the same column sits centred.
export const ADMIN_COLUMN = "mx-auto w-full max-w-[560px]";

export function AdminHeader({ active }: { active: "people" | "teams" }) {
  const seg = "rounded-full px-3 py-[5px] text-[12px] font-bold";
  const on = `${seg} bg-[var(--fg)] text-[var(--bg)]`;
  const off = `${seg} text-[var(--muted)] hover:text-[var(--fg)]`;
  return (
    <div className="border-b border-[var(--border)]">
      <div className={`${ADMIN_COLUMN} flex items-center justify-between px-5 py-[18px]`}>
        {/* To Teacher view home, not the public site: these screens are reached from it. */}
        <Link href="/teacher" className="text-[15px] font-bold tracking-[0.02em]">VicData</Link>
        <nav aria-label="School admin" className="flex gap-1.5 rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] p-[3px]">
          {active === "people" ? <span className={on} aria-current="page">People</span> : <Link href="/teacher/people" className={off}>People</Link>}
          {active === "teams" ? <span className={on} aria-current="page">Teams</span> : <Link href="/teacher/teams" className={off}>Teams</Link>}
        </nav>
      </div>
    </div>
  );
}

// The board's body column: 18px 20px 28px padding, 12px between everything.
export function AdminBody({ children }: { children: ReactNode }) {
  return <div className={`${ADMIN_COLUMN} flex flex-col gap-3 px-5 pb-7 pt-[18px]`}>{children}</div>;
}

export function AdminTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-bold">{title}</h1>
        <div className="mt-[3px] text-[12.5px] text-[var(--muted)]">{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

// The boards' filled white pill ("Invite", "+ New team").
export const PRIMARY_BUTTON = "shrink-0 rounded-full border-none bg-[var(--fg)] px-3.5 py-2 text-[13px] font-bold text-[var(--bg)] disabled:opacity-50";

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)] ${className}`}>{children}</div>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <div className="text-[11.5px] leading-[1.45] text-[var(--source)]">{children}</div>;
}

// A short centred state line in the same column (loading, not allowed, signed out).
export function AdminState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-[13px] text-[var(--muted)]">{children}</p>;
}

export const SEARCH_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export function SearchBox({
  value,
  onChange,
  placeholder,
  className = "rounded-[10px] px-3 py-[9px]",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`flex items-center gap-2 border border-[var(--panel-border2)] bg-[var(--panel-bg)] text-[var(--muted3)] ${className}`}>
      {SEARCH_ICON}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-grow border-none bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--muted3)]"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------------------
// People

export function initialsOf(fullName: string | null | undefined, email: string | null | undefined): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  const e = (email ?? "").trim();
  return e ? e[0].toUpperCase() : "?";
}

export function displayNameOf(fullName: string | null | undefined, email: string | null | undefined): string {
  return fullName?.trim() || email?.trim() || "Member";
}

// People.dc.html .av: 32px, 12px bold initials. Teams' 24px member and stacked avatars use
// the same component at their own size (stacked ones carry a ring in the card colour).
export function Avatar({
  fullName,
  email,
  size = 32,
  ring = false,
  className = "",
}: {
  fullName: string | null | undefined;
  email: string | null | undefined;
  size?: 32 | 24;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--panel-border2)] font-bold text-[var(--chip-fg)] ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size === 32 ? 12 : 9.5,
        border: ring ? "2px solid var(--panel-bg)" : undefined,
        boxSizing: ring ? "content-box" : undefined,
      }}
    >
      {initialsOf(fullName, email)}
    </span>
  );
}

// The board tints SMT at 0.16 and the others at 0.14.
function roleTint(role: VisibleRoleId): string {
  return `rgba(${ROLE_ACCENT[role].rgb},${role === "smt" ? 0.16 : 0.14})`;
}

const ROLE_SHAPE = "rounded-full px-[9px] py-[3px] text-[11px] font-bold";

// A collapsed card's role pill: tint, no border.
export function RolePill({ role }: { role: VisibleRoleId }) {
  return (
    <span className={`${ROLE_SHAPE} shrink-0`} style={{ background: roleTint(role), color: accentText(ROLE_ACCENT[role].hex) }}>
      {VISIBLE_ROLE_LABELS[role]}
    </span>
  );
}

// The editing card's chip: on = solid accent border over the tint with a tick, off =
// dashed neutral border. A disabled chip (School-Admin for anyone but the account holder)
// stays visible with its reason in the tooltip.
export function RoleChip({
  role,
  on,
  disabled = false,
  title,
  onToggle,
}: {
  role: VisibleRoleId;
  on: boolean;
  disabled?: boolean;
  title?: string;
  onToggle: () => void;
}) {
  const accent = ROLE_ACCENT[role];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={() => { if (!disabled) onToggle(); }}
      className={`${ROLE_SHAPE} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      style={
        on
          ? { border: `1px solid ${accent.hex}`, background: roleTint(role), color: accentText(accent.hex) }
          : { border: "1px dashed var(--edge-strong)", background: "transparent", color: "var(--muted)" }
      }
    >
      {VISIBLE_ROLE_LABELS[role]}{on ? " ✓" : ""}
    </button>
  );
}

// ---------------------------------------------------------------------------------------
// Platform.dc.html's switch (.tog): 34×20, a 14px knob 3px in. On is the green the app
// already uses for "on / good" (DELTA_POSITIVE); off is the strong neutral edge.
export function Switch({
  on,
  disabled = false,
  label,
  title,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className="relative inline-block h-5 w-[34px] shrink-0 rounded-full align-middle disabled:cursor-not-allowed disabled:opacity-45"
      style={{ background: on ? DELTA_POSITIVE : "var(--edge-strong)" }}
    >
      <i className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white" style={on ? { right: 3 } : { left: 3 }} />
    </button>
  );
}
