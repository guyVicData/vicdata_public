"use client";

// 0.6 snagging round 2, item A: the thin banner every Teacher page shows while Guy is
// trying VicData as a member (src/lib/trial.ts). The old look-as line's style (it lived
// in TeacherDashboard), moved here so every page draws the same one:
//
//   Trying VicData as SMT at Croydon College · Change · Start fresh · Exit
//
// Rendered as the first child inside the page's #teacher-root, so it takes that page's
// tokens and theme. Renders nothing outside a confirmed trial.
//
// Room for item B: `actions` go before Change (its "Edit" and "Preview draft"), and
// `headline` replaces the opening words (its "Editing the VicData dashboard for all
// schools · previewing as SMT at …").
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { VISIBLE_ROLE_LABELS } from "@/lib/roles";
import { exitTrial, startTrial, useTrial, type Trial } from "@/lib/trial";

export const trialRoleLabel = (t: Pick<Trial, "role">) => VISIBLE_ROLE_LABELS[t.role];

const ACTION = "font-semibold text-[var(--fg)] underline-offset-2 hover:underline disabled:opacity-50";

export function TrialBanner({ actions, headline, className = "mb-3" }: { actions?: ReactNode[]; headline?: (t: Trial) => ReactNode; className?: string }) {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const { trial } = useTrial(supabase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!trial) return null;

  async function startFresh(t: Trial) {
    setBusy(true);
    setError(null);
    const r = await startTrial(supabase, { urn: t.urn, role: t.role, fresh: true, schoolName: t.schoolName, via: "banner" });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  function exit() {
    exitTrial();
    router.push("/teacher");
  }

  const items: ReactNode[] = [
    ...(actions ?? []),
    <Link key="change" href="/account#try" className={ACTION}>Change</Link>,
    <button key="fresh" type="button" onClick={() => startFresh(trial)} disabled={busy} className={ACTION}>
      {busy ? "Starting fresh…" : "Start fresh"}
    </button>,
    <button key="exit" type="button" onClick={exit} className={ACTION}>Exit</button>,
  ];
  return (
    <div
      role="status"
      data-trial-banner=""
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-2 text-sm text-[var(--muted2)] print:hidden ${className}`}
    >
      <span className="font-semibold text-[var(--fg)]">
        {headline ? headline(trial) : <>Trying VicData as {trialRoleLabel(trial)} at {trial.schoolName}</>}
      </span>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span aria-hidden="true">·</span>
          {item}
        </Fragment>
      ))}
      {error && <span role="alert" className="basis-full text-[12px]">{error}</span>}
    </div>
  );
}
