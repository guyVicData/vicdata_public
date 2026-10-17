"use client";

// 0.6 snagging round 4, item A: "View as", the one way Guy (a platform admin, and nobody
// else) sees and edits VicData as any role at any school. Built on round 2's trial; the
// mechanism itself is src/lib/view-as.ts (item C), lasting across tabs.
//
// One component, two places (one source of truth):
//   * ViewAsPill: the compact pill in the top nav, before the account link -- "Teacher · The
//     Chase ▾" in People's role-chip colour while viewing as someone, opening the existing
//     PanelMenu popover with the panel below in it. 0.7 r3 (F5): nothing at rest (it used to
//     read "Viewing as: you");
//   * ViewAsCard: the same panel as a card on /account.
// 0.8 View as: the ONE place to start it is the account menu -- the /account card, and the same
// panel from the account link's menu ("View as…", platform admins only), which opens the pill's
// popover (openViewAs). The footer's "View as…" and the SMT and Admissions messages' buttons are
// gone; Platform's "View as…" and the group accounts' "View as head office" open this switcher
// pre-filled; the banner's Change opens it too. Head office of a group is one of its roles (the same
// cookie, src/lib/view-as.ts).
//
// Styled with neutral classes, which follow #teacher-root's data-theme on Teacher pages and
// the OS theme elsewhere. People's role chips draw with the Teacher-view token names, so
// outside #teacher-root (`site`) the panel maps those names onto the site's own
// --foreground/--background (SITE_TOKENS) -- aliases, no new colours.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import SchoolSearch from "@/components/SchoolSearch";
import { RoleChip, roleTint } from "@/components/admin/AdminChrome";
import { PanelMenu, useDismiss } from "@/components/teacher/PanelMenu";
import { ChevronDown } from "@/components/teacher/PanelIcons";
import { VISIBLE_ROLE_LABELS } from "@/lib/roles";
import { ROLE_ACCENT, accentText } from "@/lib/teacher-view-theme";
import { isPlatformAdminCached } from "@/lib/edit-mode";
import {
  exitViewAs,
  followViewAsAcrossTabs,
  hasViewedAs,
  listRecentViewAs,
  startViewAs,
  startViewAsHeadOffice,
  VIEW_AS_ROLES,
  toViewAs,
  VIEW_AS_EVENT,
  viewAsGroupSnapshot,
  viewAsSnapshot,
  type RecentViewAs,
  type ViewAs,
  type ViewAsGroup,
  type ViewAsRole,
} from "@/lib/view-as";

export const SITE_TOKENS = {
  "--fg": "var(--foreground)",
  "--bg": "var(--background)",
  "--panel-bg": "var(--background)",
  "--panel-border2": "color-mix(in srgb, var(--foreground) 16%, var(--background))",
  "--box-bg": "color-mix(in srgb, var(--foreground) 4%, var(--background))",
  "--muted": "color-mix(in srgb, var(--foreground) 55%, var(--background))",
  "--muted2": "color-mix(in srgb, var(--foreground) 62%, var(--background))",
  "--edge-strong": "color-mix(in srgb, var(--foreground) 30%, var(--background))",
  "--accent-text-mix": "55%",
} as CSSProperties;

// ------------------------------------------------------------------ opening it from elsewhere

export type ViewAsPrefill = { urn: string; name: string; role?: ViewAsRole } | { group: ViewAsGroup & { groupId?: string } };
const OPEN_EVENT = "vicdata:view-as-open";

// Opens the nav pill's popover, optionally with a school and role (or a head office) filled in
// (the account menu's "View as…", Platform's "View as…", the banner's Change).
export function openViewAs(prefill?: ViewAsPrefill) {
  window.dispatchEvent(new CustomEvent<ViewAsPrefill | null>(OPEN_EVENT, { detail: prefill ?? null }));
}

// Where View as lands, and where Back to me goes: the role's home. A full page load, so
// nothing drawn as one person (state, caches) carries into the other.
const HOME = "/teacher";
const GROUP_HOME = "/teacher/group";

export const HEAD_OFFICE_LABEL = "Head office";
export const viewAsLabel = (t: Pick<ViewAs, "role" | "schoolName">) => `${VISIBLE_ROLE_LABELS[t.role]} · ${t.schoolName}`;
export const viewAsGroupLabel = (g: Pick<ViewAsGroup, "name">) => `${HEAD_OFFICE_LABEL} · ${g.name}`;

export function backToMe() {
  exitViewAs();
  // A full load on purpose (see HOME), not a client-side push.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(HOME);
}

// ------------------------------------------------------------------ hooks

// This page's View as as the cookie gives it, before the platform-admin check comes back:
// what the banner and the pill draw from, so a new tab shows the banner straight away.
// null on the server and in the first (hydrating) render; resolveViewAs clears it for
// anyone who isn't a platform admin, which re-renders this to null.
export function useViewAsNow(): ViewAs | null {
  const v = useSyncExternalStore(
    (cb) => {
      window.addEventListener(VIEW_AS_EVENT, cb);
      return () => window.removeEventListener(VIEW_AS_EVENT, cb);
    },
    viewAsSnapshot,
    () => null,
  );
  return useMemo(() => (v ? toViewAs(v) : null), [v]);
}

// The head-office View as this page is in (the same cookie), as useViewAsNow.
export function useViewAsGroupNow(): ViewAsGroup | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(VIEW_AS_EVENT, cb);
      return () => window.removeEventListener(VIEW_AS_EVENT, cb);
    },
    viewAsGroupSnapshot,
    () => null,
  );
}

// ------------------------------------------------------------------ head office's accounts

type GroupAccountRow = { id: string; group_id: string; display_name: string; status: string };

function useGroupAccounts(on: boolean): GroupAccountRow[] | null {
  const [rows, setRows] = useState<GroupAccountRow[] | null>(null);
  useEffect(() => {
    if (!on || rows) return;
    let live = true;
    (async () => {
      const { data, error } = await createBrowserSupabaseClient().rpc("platform_group_accounts_overview");
      if (live) setRows(error ? [] : ((data as GroupAccountRow[] | null) ?? []));
    })();
    return () => { live = false; };
  }, [on, rows]);
  return rows;
}

// ------------------------------------------------------------------ the panel

function when(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The roles the switcher offers: the school roles, then head office of a group.
type PanelRole = ViewAsRole | "head_office";

export function ViewAsPanel({ compact, prefill }: { compact: boolean; prefill?: ViewAsPrefill | null }) {
  const supabase = createBrowserSupabaseClient();
  const current = useViewAsNow();
  const currentGroup = useViewAsGroupNow();
  const schoolPrefill = prefill && "urn" in prefill ? prefill : null;
  const groupPrefill = prefill && "group" in prefill ? prefill.group : null;
  const [school, setSchool] = useState<{ urn: string; name: string } | null>(schoolPrefill ? { urn: schoolPrefill.urn, name: schoolPrefill.name } : null);
  const [role, setRole] = useState<PanelRole>(groupPrefill ? "head_office" : (schoolPrefill?.role ?? "teacher"));
  const [group, setGroup] = useState<(ViewAsGroup & { groupId?: string }) | null>(groupPrefill);
  const [groupQuery, setGroupQuery] = useState("");
  const [fresh, setFresh] = useState(true);
  const [recent, setRecent] = useState<RecentViewAs[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headOffice = role === "head_office";
  const groups = useGroupAccounts(headOffice);

  const loadRecent = useCallback(async () => {
    setRecent(await listRecentViewAs(supabase, 5).catch(() => []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    (async () => { await loadRecent(); })();
  }, [loadRecent]);

  // Start fresh is ticked by default the first time for each school + role.
  useEffect(() => {
    if (!school || role === "head_office") return;
    let cancelled = false;
    (async () => {
      const tried = await hasViewedAs(supabase, school.urn, role).catch(() => false);
      if (!cancelled) setFresh(!tried);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?.urn, role]);

  async function open(t: { urn: string; role: ViewAsRole; name?: string }, startFresh: boolean, key: string) {
    setBusy(key);
    setError(null);
    const r = await startViewAs(supabase, { urn: t.urn, role: t.role, fresh: startFresh, schoolName: t.name });
    if (!r.ok) {
      setError(r.error);
      setBusy(null);
      return;
    }
    // A full load on purpose (see HOME), not a client-side push.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(HOME);
  }

  async function openGroup(g: ViewAsGroup & { groupId?: string }) {
    setBusy("open");
    setError(null);
    const r = await startViewAsHeadOffice(supabase, g);
    if (!r.ok) {
      setError(r.error);
      setBusy(null);
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(GROUP_HOME);
  }

  const heading = compact
    ? "px-1 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-neutral-500"
    : "mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500";
  const text = compact ? "text-[12.5px]" : "text-sm";
  const link = "text-xs underline disabled:opacity-50";
  const q = groupQuery.trim().toLowerCase();
  const groupHits = (groups ?? []).filter((g) => !q || g.display_name.toLowerCase().includes(q) || g.group_id.toLowerCase().includes(q)).slice(0, 8);

  return (
    <div data-view-as-panel="" className={compact ? "flex flex-col gap-1 px-1 pb-1" : ""}>
      {(current || currentGroup) && (
        <p className={`${compact ? "px-1 pt-1" : "mt-3"} ${text}`}>
          {current ? <>You&rsquo;re viewing {current.schoolName} as {VISIBLE_ROLE_LABELS[current.role]}.</> : <>You&rsquo;re viewing {currentGroup!.name} as its head office.</>}{" "}
          <button type="button" className="font-semibold underline" onClick={backToMe}>
            Back to me
          </button>
        </p>
      )}

      <h3 className={heading}>Role</h3>
      <div role="group" aria-label="Role" className={`flex flex-wrap gap-1.5 ${compact ? "px-1" : ""}`}>
        {VIEW_AS_ROLES.map((r) => (
          <RoleChip key={r} role={r} on={role === r} onToggle={() => setRole(r)} />
        ))}
        <button
          type="button"
          aria-pressed={headOffice}
          onClick={() => setRole("head_office")}
          data-view-as-role="head_office"
          className={`rounded-full border px-2.5 py-[3px] text-[12px] font-semibold ${headOffice ? "border-[var(--fg)] text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--muted)]"}`}
        >
          {HEAD_OFFICE_LABEL}
        </button>
      </div>

      {headOffice ? (
        <>
          <h3 className={heading}>Group</h3>
          <input
            type="search"
            value={groupQuery}
            onChange={(e) => setGroupQuery(e.target.value)}
            placeholder="Find a group account"
            aria-label="Find a group account"
            className={`rounded-md border border-[var(--panel-border2)] bg-transparent px-2 py-1.5 ${text}`}
          />
          {groups === null ? (
            <p className={`${compact ? "px-1" : "mt-2"} text-xs text-neutral-500`}>Loading group accounts…</p>
          ) : groups.length === 0 ? (
            <p className={`${compact ? "px-1" : "mt-2"} text-xs text-neutral-500`}>No group accounts yet. Platform makes them.</p>
          ) : (
            <ul className={`${compact ? "px-1" : "mt-2"} space-y-1`}>
              {groupHits.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => setGroup({ accountId: g.id, name: g.display_name, groupId: g.group_id })} className={`${text} ${group?.accountId === g.id ? "font-semibold underline" : "hover:underline"}`}>
                    {g.display_name}
                  </button>
                  {g.status !== "active" && <span className="ml-1.5 text-xs text-neutral-500">({g.status})</span>}
                </li>
              ))}
            </ul>
          )}
          <div className={`${compact ? "mt-2 px-1" : "mt-4"} flex items-center gap-3`}>
            <button
              type="button"
              disabled={!group || busy !== null}
              onClick={() => group && openGroup(group)}
              className={`rounded-md bg-neutral-900 px-3 ${compact ? "py-1.5 text-[12.5px]" : "py-2 text-sm"} text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900`}
            >
              {busy === "open" ? "Opening…" : "Open its head-office home"}
            </button>
            {!group && <span className="text-xs text-neutral-500">Pick a group first.</span>}
          </div>
        </>
      ) : (
        <>
          <h3 className={heading}>School</h3>
          <SchoolSearch byUrn allowRequest={false} placeholder="Search by school name or URN" onSelect={(s) => setSchool({ urn: s.urn, name: s.current_name })} />
          {school && (
            <p className={`${compact ? "px-1 pt-1" : "mt-2"} ${text}`}>
              <span className="font-medium">{school.name}</span> <span className="text-neutral-500">&middot; URN {school.urn}</span>
            </p>
          )}

          <label className={`${compact ? "mt-2 px-1" : "mt-4"} flex items-start gap-2 ${text}`}>
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="mt-0.5" />
            <span>
              Start fresh
              <span className="block text-xs text-neutral-500">Clears this school and role&rsquo;s walkthrough and saved state, so the 4-step walkthroughs run again.</span>
            </span>
          </label>

          <div className={`${compact ? "mt-2 px-1" : "mt-4"} flex items-center gap-3`}>
            <button
              type="button"
              disabled={!school || busy !== null}
              onClick={() => school && open({ urn: school.urn, role, name: school.name }, fresh, "open")}
              className={`rounded-md bg-neutral-900 px-3 ${compact ? "py-1.5 text-[12.5px]" : "py-2 text-sm"} text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900`}
            >
              {busy === "open" ? "Opening…" : "Open their home page"}
            </button>
            {!school && <span className="text-xs text-neutral-500">Pick a school first.</span>}
          </div>
        </>
      )}
      {error && <p role="alert" className={`${compact ? "px-1" : ""} mt-2 ${text} text-red-600`}>{error}</p>}

      {recent.length > 0 && (
        <>
          <h3 className={compact ? `${heading} mt-1` : "mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500"}>Recently viewed as</h3>
          <ul className={compact ? "space-y-1.5 px-1" : "space-y-2"}>
            {recent.map((t) => {
              const key = `${t.urn}~${t.role}`;
              return (
                <li key={key} className={`flex items-center justify-between gap-3 ${text}`}>
                  <span className="min-w-0">
                    {t.schoolName} <span className="text-neutral-500">&middot; {VISIBLE_ROLE_LABELS[t.role]}</span>
                    {!compact && when(t.lastUsedAt) && <span className="ml-2 text-xs text-neutral-500">{when(t.lastUsedAt)}</span>}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className={link} disabled={busy !== null} onClick={() => open({ urn: t.urn, role: t.role, name: t.schoolName }, false, `${key}:open`)}>
                      {busy === `${key}:open` ? "Opening…" : "Open"}
                    </button>
                    <button type="button" className={link} disabled={busy !== null} onClick={() => open({ urn: t.urn, role: t.role, name: t.schoolName }, true, `${key}:fresh`)}>
                      {busy === `${key}:fresh` ? "Starting…" : "Start fresh"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(current || currentGroup) && (
        <div className={compact ? "mt-2 border-t border-neutral-200 px-1 pt-2 dark:border-neutral-800" : "mt-5"}>
          <button type="button" onClick={backToMe} className={`font-semibold underline ${text}`}>
            Back to me
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ is this a platform admin?

// null until known. The pill and the card render nothing for anyone else.
function usePlatformAdmin(): boolean | null {
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    isPlatformAdminCached(createBrowserSupabaseClient()).then(
      (a) => { if (live) setAdmin(a); },
      () => { if (live) setAdmin(false); },
    );
    return () => { live = false; };
  }, []);
  return admin;
}

// ------------------------------------------------------------------ /account

export function ViewAsCard() {
  const admin = usePlatformAdmin();
  if (!admin) return null;
  return (
    <section id="view-as" style={SITE_TOKENS} className="mb-8 scroll-mt-6 rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">View as&hellip;</h2>
        <span className="text-xs text-neutral-500">Platform admin only</span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        See VicData exactly as a member with one role at a school sees it. It saves as that member, never to your own account or to the school, and
        the school never sees it. It lasts across tabs until Back to me. &ldquo;View as…&rdquo; in the account menu opens the same switcher on every page.
      </p>
      <ViewAsPanel compact={false} />
    </section>
  );
}

// ------------------------------------------------------------------ the nav pill

export function ViewAsPill({ tone }: { tone: "teacher" | "site" }) {
  const current = useViewAsNow();
  const currentGroup = useViewAsGroupNow();
  const admin = usePlatformAdmin();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<ViewAsPrefill | null>(null);
  // A new panel each time it opens with a different prefill.
  const [openKey, setOpenKey] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  // The cookie is only ever written for a confirmed platform admin, so a View as already
  // showing needs no wait; at rest the pill waits for the check.
  const shown = !!current || !!currentGroup || admin === true;

  useEffect(() => {
    if (!shown) return;
    const onOpen = (e: Event) => {
      setPrefill((e as CustomEvent<ViewAsPrefill | null>).detail ?? null);
      setOpenKey((k) => k + 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    const unfollow = followViewAsAcrossTabs();
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      unfollow();
    };
  }, [shown]);

  if (!shown) return null;

  // 0.7 admissions r3 (F5): the pill shows only while viewing as someone. At rest there's no
  // "Viewing as: you" in the nav: View as opens from the account menu ("View as…") and the account
  // page (0.8 View as). The popover still opens here, in the nav, from either.
  if (!current && !currentGroup)
    return (
      <div className="relative" ref={ref} data-view-as-pill="">
        {open && (
          <PanelMenu label="View as" align="right" width={320} tall>
            <ViewAsPanel key={openKey} compact prefill={prefill} />
          </PanelMenu>
        )}
      </div>
    );

  const accent = current ? ROLE_ACCENT[current.role] : null;
  const label = current ? viewAsLabel(current) : viewAsGroupLabel(currentGroup!);
  const style: CSSProperties = current && accent
    ? { border: `1px solid ${accent.hex}`, background: roleTint(current.role), color: accentText(accent.hex) }
    : tone === "teacher"
      ? { border: "1px solid transparent", background: "var(--panel-bg)", color: "var(--muted)" }
      : { border: "1px solid var(--panel-border2)", color: "var(--muted)" };
  const shape =
    tone === "teacher"
      ? "inline-flex h-[34px] max-w-[15rem] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
      : "inline-flex max-w-[15rem] shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const text = label;

  return (
    <div className="relative" ref={ref} style={tone === "site" ? SITE_TOKENS : undefined} data-view-as-pill="">
      <button
        type="button"
        onClick={() => {
          if (!open) { setPrefill(null); setOpenKey((k) => k + 1); }
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Viewing as ${label}. Change`}
        title={`Viewing as ${label}`}
        className={shape}
        style={style}
      >
        <span className="min-w-0 truncate">{text}</span>
        <span className="shrink-0">{ChevronDown}</span>
      </button>
      {open && (
        <PanelMenu label="View as" align="right" width={320} tall>
          <ViewAsPanel key={openKey} compact prefill={prefill} />
        </PanelMenu>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the wrong role

// 0.8 View as: SMT's and Admissions' message for a platform admin viewing a school as a role that page
// isn't for -- "You're viewing Leighton Park as Teacher. SMT dashboards are for SMT and the
// School-Admin." -- with a Switch that changes the role in place (logged as any change is).
export function ViewAsWrongRole({ viewAs, forWhom, to }: { viewAs: ViewAs; forWhom: string; to: { role: ViewAsRole; label: string } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change() {
    setBusy(true);
    setError(null);
    const r = await startViewAs(createBrowserSupabaseClient(), { urn: viewAs.urn, role: to.role, fresh: false, schoolName: viewAs.schoolName });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    window.location.reload();
  }
  return (
    <span className="flex flex-wrap items-center gap-3" data-view-as-wrong-role="">
      <span>
        You&rsquo;re viewing {viewAs.schoolName} as {VISIBLE_ROLE_LABELS[viewAs.role]}. {forWhom}
      </span>
      <button type="button" onClick={change} disabled={busy} data-view-as-switch={to.role} className="rounded-full border border-[var(--panel-border2)] px-3 py-1 text-[12px] font-bold text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-50">
        {busy ? "Switching…" : `Switch to ${to.label}`}
      </button>
      {error && <span role="alert" className="basis-full text-[12px]">{error}</span>}
    </span>
  );
}
