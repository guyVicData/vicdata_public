"use client";

// 0.6 snagging round 2, item A: "Try VicData as…", the first card on /account, for platform
// admins only (everyone else gets nothing rendered). Pick a school (the site's own school
// search, by name or URN) and a role, and open that role's home page exactly as a member
// with only that role at that school lands on it -- a trial (src/lib/trial.ts).
//
// Styled as the account page's own cards (neutral classes, the OS theme), with People's
// role chips (AdminChrome's RoleChip). Those chips draw with the Teacher-view token names,
// which exist only under #teacher-root, so the card maps those names onto the account
// page's own --foreground/--background (TOKENS) -- aliases, no new colours.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import SchoolSearch from "@/components/SchoolSearch";
import { RoleChip } from "@/components/admin/AdminChrome";
import { VISIBLE_ROLE_LABELS } from "@/lib/roles";
import {
  exitTrial,
  hasTried,
  listRecentTrials,
  startTrial,
  trialHref,
  TRIAL_ROLES,
  useTrial,
  type RecentTrial,
  type TrialRole,
} from "@/lib/trial";

const TOKENS = {
  "--fg": "var(--foreground)",
  "--bg": "var(--background)",
  "--muted": "color-mix(in srgb, var(--foreground) 55%, var(--background))",
  "--edge-strong": "color-mix(in srgb, var(--foreground) 30%, var(--background))",
  "--accent-text-mix": "55%",
} as CSSProperties;

const LINK = "text-xs underline disabled:opacity-50";

function when(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function TryAsCard() {
  const supabase = createBrowserSupabaseClient();
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_platform_admin");
        setAdmin(!error && data === true);
      } catch {
        setAdmin(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!admin) return null;
  return <Card />;
}

function Card() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const { trial: current } = useTrial(supabase);
  const [school, setSchool] = useState<{ urn: string; name: string } | null>(null);
  const [role, setRole] = useState<TrialRole>("teacher");
  const [fresh, setFresh] = useState(true);
  const [recent, setRecent] = useState<RecentTrial[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setRecent(await listRecentTrials(supabase, 5).catch(() => []));
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
      const tried = await hasTried(supabase, school.urn, role).catch(() => false);
      if (!cancelled) setFresh(!tried);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?.urn, role]);

  async function open(t: { urn: string; role: TrialRole; name?: string }, startFresh: boolean, key: string) {
    setBusy(key);
    setError(null);
    const r = await startTrial(supabase, { urn: t.urn, role: t.role, fresh: startFresh, schoolName: t.name, via: "account" });
    if (!r.ok) {
      setError(r.error);
      setBusy(null);
      return;
    }
    router.push(trialHref(r.trial));
  }

  return (
    <section id="try" style={TOKENS} className="mb-8 scroll-mt-6 rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Try VicData as&hellip;</h2>
        <span className="text-xs text-neutral-500">Platform admin only</span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        See VicData exactly as a new member with one role at a school sees it. A trial saves as that member, never to your own account or to the
        school, and the school never sees it.
      </p>

      {current && (
        <p className="mt-3 text-sm">
          You&rsquo;re trying VicData as {VISIBLE_ROLE_LABELS[current.role]} at {current.schoolName}.{" "}
          <button type="button" className="underline" onClick={() => router.push(trialHref(current))}>
            Back to it
          </button>{" "}
          &middot;{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              exitTrial();
            }}
          >
            Exit
          </button>
        </p>
      )}

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">School</h3>
      <SchoolSearch byUrn allowRequest={false} placeholder="Search by school name or URN" onSelect={(s) => setSchool({ urn: s.urn, name: s.current_name })} />
      {school && (
        <p className="mt-2 text-sm">
          <span className="font-medium">{school.name}</span> <span className="text-neutral-500">&middot; URN {school.urn}</span>
        </p>
      )}

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Role</h3>
      <div role="group" aria-label="Role" className="flex flex-wrap gap-1.5">
        {TRIAL_ROLES.map((r) => (
          <RoleChip key={r} role={r} on={role === r} onToggle={() => setRole(r)} />
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="mt-0.5" />
        <span>
          Start fresh
          <span className="block text-xs text-neutral-500">Clears this trial&rsquo;s walkthrough and saved state, so the 4-step walkthroughs run again.</span>
        </span>
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!school || busy !== null}
          onClick={() => school && open({ urn: school.urn, role, name: school.name }, fresh, "open")}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy === "open" ? "Opening…" : "Open their home page"}
        </button>
        {!school && <span className="text-xs text-neutral-500">Pick a school first.</span>}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      {recent.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Recently tried</h3>
          <ul className="space-y-2">
            {recent.map((t) => {
              const key = `${t.urn}~${t.role}`;
              return (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    {t.schoolName} <span className="text-neutral-500">&middot; {VISIBLE_ROLE_LABELS[t.role]}</span>
                    {when(t.lastUsedAt) && <span className="ml-2 text-xs text-neutral-500">{when(t.lastUsedAt)}</span>}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className={LINK} disabled={busy !== null} onClick={() => open({ urn: t.urn, role: t.role, name: t.schoolName }, false, `${key}:open`)}>
                      {busy === `${key}:open` ? "Opening…" : "Open"}
                    </button>
                    <button type="button" className={LINK} disabled={busy !== null} onClick={() => open({ urn: t.urn, role: t.role, name: t.schoolName }, true, `${key}:fresh`)}>
                      {busy === `${key}:fresh` ? "Starting…" : "Start fresh"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
