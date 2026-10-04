"use client";

// 0.6 snagging round 4, item A: "View as", the one way Guy (a platform admin, and nobody
// else) sees and edits VicData as any role at any school. Built on round 2's trial; the
// mechanism itself is src/lib/view-as.ts (item C), lasting across tabs.
//
// One component, two places (one source of truth):
//   * ViewAsPill: the compact pill in the top nav, before the account link -- "Viewing as:
//     you" at rest, "Teacher · The Chase ▾" in People's role-chip colour while viewing as
//     someone -- opening the existing PanelMenu popover with the panel below in it;
//   * ViewAsCard: the same panel as a card on /account, for anyone who goes there.
// Platform's "Look at it as…" opens the pill's popover with that school and role filled in
// (openViewAs); the banner's Change opens it too.
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
  VIEW_AS_ROLES,
  toViewAs,
  VIEW_AS_EVENT,
  viewAsSnapshot,
  type RecentViewAs,
  type ViewAs,
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

export type ViewAsPrefill = { urn: string; name: string; role?: ViewAsRole };
const OPEN_EVENT = "vicdata:view-as-open";

// Opens the nav pill's popover, optionally with a school and role filled in (Platform's
// "Look at it as…", the banner's Change).
export function openViewAs(prefill?: ViewAsPrefill) {
  window.dispatchEvent(new CustomEvent<ViewAsPrefill | null>(OPEN_EVENT, { detail: prefill ?? null }));
}

// Where View as lands, and where Back to me goes: the role's home. A full page load, so
// nothing drawn as one person (state, caches) carries into the other.
const HOME = "/teacher";

export const viewAsLabel = (t: Pick<ViewAs, "role" | "schoolName">) => `${VISIBLE_ROLE_LABELS[t.role]} · ${t.schoolName}`;

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

// ------------------------------------------------------------------ the panel

function when(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ViewAsPanel({ compact, prefill }: { compact: boolean; prefill?: ViewAsPrefill | null }) {
  const supabase = createBrowserSupabaseClient();
  const current = useViewAsNow();
  const [school, setSchool] = useState<{ urn: string; name: string } | null>(prefill ? { urn: prefill.urn, name: prefill.name } : null);
  const [role, setRole] = useState<ViewAsRole>(prefill?.role ?? "teacher");
  const [fresh, setFresh] = useState(true);
  const [recent, setRecent] = useState<RecentViewAs[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setRecent(await listRecentViewAs(supabase, 5).catch(() => []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    (async () => { await loadRecent(); })();
  }, [loadRecent]);

  // Start fresh is ticked by default the first time for each school + role.
  useEffect(() => {
    if (!school) return;
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

  const heading = compact
    ? "px-1 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-neutral-500"
    : "mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500";
  const text = compact ? "text-[12.5px]" : "text-sm";
  const link = "text-xs underline disabled:opacity-50";

  return (
    <div data-view-as-panel="" className={compact ? "flex flex-col gap-1 px-1 pb-1" : ""}>
      {current && (
        <p className={`${compact ? "px-1 pt-1" : "mt-3"} ${text}`}>
          You&rsquo;re viewing as {VISIBLE_ROLE_LABELS[current.role]} at {current.schoolName}.{" "}
          <button type="button" className="font-semibold underline" onClick={backToMe}>
            Back to me
          </button>
        </p>
      )}

      <h3 className={heading}>School</h3>
      <SchoolSearch byUrn allowRequest={false} placeholder="Search by school name or URN" onSelect={(s) => setSchool({ urn: s.urn, name: s.current_name })} />
      {school && (
        <p className={`${compact ? "px-1 pt-1" : "mt-2"} ${text}`}>
          <span className="font-medium">{school.name}</span> <span className="text-neutral-500">&middot; URN {school.urn}</span>
        </p>
      )}

      <h3 className={heading}>Role</h3>
      <div role="group" aria-label="Role" className={`flex flex-wrap gap-1.5 ${compact ? "px-1" : ""}`}>
        {VIEW_AS_ROLES.map((r) => (
          <RoleChip key={r} role={r} on={role === r} onToggle={() => setRole(r)} />
        ))}
      </div>

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

      {current && (
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
        the school never sees it. It lasts across tabs until Back to me. The View as pill in the top bar does the same from any page.
      </p>
      <ViewAsPanel compact={false} />
    </section>
  );
}

// ------------------------------------------------------------------ the nav pill

export function ViewAsPill({ tone }: { tone: "teacher" | "site" }) {
  const current = useViewAsNow();
  const admin = usePlatformAdmin();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<ViewAsPrefill | null>(null);
  // A new panel each time it opens with a different prefill.
  const [openKey, setOpenKey] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  // The cookie is only ever written for a confirmed platform admin, so a View as already
  // showing needs no wait; at rest the pill waits for the check.
  const shown = !!current || admin === true;

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

  const accent = current ? ROLE_ACCENT[current.role] : null;
  const style: CSSProperties = current && accent
    ? { border: `1px solid ${accent.hex}`, background: roleTint(current.role), color: accentText(accent.hex) }
    : tone === "teacher"
      ? { border: "1px solid transparent", background: "var(--panel-bg)", color: "var(--muted)" }
      : { border: "1px solid var(--panel-border2)", color: "var(--muted)" };
  const shape =
    tone === "teacher"
      ? "inline-flex h-[34px] max-w-[15rem] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
      : "inline-flex max-w-[15rem] shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const text = current ? viewAsLabel(current) : "Viewing as: you";

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
        aria-label={current ? `Viewing as ${VISIBLE_ROLE_LABELS[current.role]} at ${current.schoolName}. Change` : "Viewing as: you. View as someone else"}
        title={current ? `Viewing as ${VISIBLE_ROLE_LABELS[current.role]} at ${current.schoolName}` : "View VicData as a member"}
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
