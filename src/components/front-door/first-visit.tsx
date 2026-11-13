"use client";

// VicData 0.8 front door (A5-A7): the first visit -- the welcome (once per person), the one-screen setup
// ("Which subjects do you teach?", every phase the school has on one screen, the live entry count kept),
// the "New since your last visit" strip and the short changelog page it links to.
//
// These lead into the homes, so they draw in Mid like the homes (listed in MID_PAGES).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { TeacherNav } from "@/components/shell/TeacherNav";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { completeOnboarding, fetchOnboardedPhases, fetchPreferences, savePreferences } from "@/lib/teacher-view-data";
import { PHASE_LABELS, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT, QUALIFICATION_FAMILIES } from "@/lib/teacher-view-theme";
import { pickMembership, resolveViewAs } from "@/lib/view-as";
import { lensesOf } from "@/components/library/RoleHome";
import type { TeacherModel } from "@/lib/front-door/teacher-model";
import { afterWelcome, changelogForMe, loadFrontDoorState, markWelcomeSeen, recordVisit, shouldShowWelcome, whatsNew, type ChangelogEntry } from "@/lib/front-door/visit";
import { setupPhases, setupTotals } from "@/lib/front-door/setup";
import type { MidField } from "@/lib/front-door/contrast";

/** A first-visit page: the dark root (Mid's header), then one field. */
export function FirstVisitFrame({ field, children }: { field: MidField; children: ReactNode }) {
  const [pref] = useThemePref();
  const theme = effectiveTheme(pref);
  return (
    <main id="teacher-root" data-theme={theme} data-pref={pref} className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto w-full max-w-[1240px] px-4 pt-4 sm:px-6">
        <ViewAsBanner />
        <TeacherNav phase={null} phases={[]} labelsOn={false} onLabelsOn={() => {}} theme={theme} onTheme={() => {}} />
      </div>
      <section data-field={field} className="mt-6 flex-grow px-4 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto flex max-w-[860px] flex-col gap-7">{children}</div>
      </section>
    </main>
  );
}

const point = "fd-tile flex items-start gap-4 rounded-[16px] p-5";
const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

async function session() {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return { supabase, user: data.session?.user ?? null, token: data.session?.access_token ?? null };
}

/** Does this person have subjects to choose (a Teacher role at a school with GCSE or Post-16)? */
async function needsSetup(): Promise<boolean> {
  const { supabase, user, token } = await session();
  if (!user || !token) return false;
  const { data } = await supabase.from("school_memberships").select("id, roles, role, is_admin, school_accounts!school_memberships_school_account_id_fkey(school_urn, account_holder_membership_id)").eq("profile_id", user.id).eq("status", "approved");
  type Row = { id: string; roles: string[] | null; role: string | null; is_admin: boolean | null; school_accounts: { school_urn: string; account_holder_membership_id: string | null } | null };
  const m = pickMembership((data ?? []) as unknown as Row[]);
  if (!m?.school_accounts) return false;
  if (!lensesOf({ roles: m.roles, role: m.role, is_admin: m.is_admin, isAccountHolder: m.school_accounts.account_holder_membership_id === m.id }).includes("teacher")) return false;
  const res = await fetch(`/api/teacher/phases?urn=${m.school_accounts.school_urn}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  const phases = res?.ok ? ((await res.json()) as { phases: TeacherPhase[] }).phases : [];
  return phases.some((p) => p === "ks4" || p === "ks5");
}

// ------------------------------------------------------------------------------------------------ welcome

export function WelcomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const { supabase, user } = await session();
    const viewingAs = !!(await resolveViewAs(supabase));
    // Shown once per person (R-WELCOME-ONCE): marked seen as they leave it (never in View as).
    if (user && !viewingAs) await markWelcomeSeen(supabase, user.id);
    router.replace(afterWelcome({ needsSetup: !viewingAs && (await needsSetup()) }));
  };
  return (
    <FirstVisitFrame field="top">
      <WelcomeContent busy={busy} onGo={go} />
    </FirstVisitFrame>
  );
}

export function WelcomeContent({ busy, onGo }: { busy: boolean; onGo: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--field-ink)]">Welcome</p>
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--field-ink)] sm:text-[48px]">VicData helps you see how your school is doing</h1>
        <p className="max-w-[720px] text-[17px] leading-relaxed text-[var(--field-ink)] sm:text-[19px]">Who takes your subjects, how well they do, and how you compare with schools nearby, from the published figures, in plain questions.</p>
      </div>
      <ul className="flex flex-col gap-3">
        <li className={point}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
            <svg {...ICON}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </span>
          <span>
            <span className="block text-[16px] font-semibold text-[var(--fg)]">Start with a question</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--muted2)]">Your home is a few questions. Each walks you through a few screens, one thing at a time, and shows you where it lives on the full dashboard.</span>
          </span>
        </li>
        <li className={point}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
            <svg {...ICON}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>
          </span>
          <span>
            <span className="block text-[16px] font-semibold text-[var(--fg)]">This is a private beta</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--muted2)]">A few schools are using VicData before anyone else. What you tell us shapes what it becomes: when your feedback leads to a change, we&rsquo;ll say so.</span>
          </span>
        </li>
        <li className={point}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
            <svg {...ICON}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </span>
          <span>
            <span className="block text-[16px] font-semibold text-[var(--fg)]">Where to tell us</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--muted2)]">Every chart has a speech-bubble button in its bottom corner, for feedback on that chart. &ldquo;Feedback on this page&rdquo;, at the foot of every page, is for anything else.</span>
          </span>
        </li>
      </ul>
      <button type="button" onClick={onGo} disabled={busy} data-welcome-continue="" className="w-fit rounded-[12px] bg-[var(--tile-accent)] px-6 py-3.5 text-[16px] font-semibold text-[var(--tile-on-accent)] disabled:opacity-60">
        {busy ? "One moment…" : "Let's start"}
      </button>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ setup

type PhaseList = { phase: "ks4" | "ks5"; subjects: TeacherModel["subjects"]; ticked: string[] };

export function SetupPage() {
  const router = useRouter();
  const [state, setState] = useState<{ status: "loading" } | { status: "skip" } | { status: "ready"; urn: string; lists: PhaseList[] }>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      const { supabase, user, token } = await session();
      if (!user || !token || (await resolveViewAs(supabase))) return setState({ status: "skip" });
      const { data } = await supabase.from("school_memberships").select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn)").eq("profile_id", user.id).eq("status", "approved");
      const m = pickMembership((data ?? []) as unknown as { id: string; school_accounts: { school_urn: string } | null }[]);
      const urn = m?.school_accounts?.school_urn;
      if (!urn) return setState({ status: "skip" });
      const res = await fetch(`/api/teacher/phases?urn=${urn}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      const phases = setupPhases(res?.ok ? ((await res.json()) as { phases: TeacherPhase[] }).phases : []);
      if (!phases.length) return setState({ status: "skip" });
      const lists = await Promise.all(
        phases.map(async (phase) => {
          const [r, prefs] = await Promise.all([fetch(`/api/front-door/teacher?urn=${urn}&phase=${phase}&lite=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null), fetchPreferences(supabase, urn, phase)]);
          const model = r?.ok ? ((await r.json()) as TeacherModel) : null;
          const subjects = model?.subjects ?? [];
          return { phase, subjects, ticked: prefs.subjects.filter((k) => subjects.some((s) => s.key === k)) };
        }),
      );
      setState({ status: "ready", urn, lists: lists.filter((l) => l.subjects.length) });
    })();
  }, []);
  useEffect(() => {
    if (state.status === "skip") router.replace("/teacher");
  }, [state.status, router]);

  const toggle = (phase: string, key: string) =>
    setState((s) => (s.status !== "ready" ? s : { ...s, lists: s.lists.map((l) => (l.phase !== phase ? l : { ...l, ticked: l.ticked.includes(key) ? l.ticked.filter((k) => k !== key) : [...l.ticked, key] })) }));

  const save = async () => {
    if (state.status !== "ready") return;
    setSaving(true);
    const { supabase } = await session();
    const done = await fetchOnboardedPhases(supabase, state.urn);
    for (const l of state.lists) {
      const prefs = await fetchPreferences(supabase, state.urn, l.phase);
      await savePreferences(supabase, state.urn, l.phase, { ...prefs, subjects: l.ticked });
      if (!done.includes(l.phase)) await completeOnboarding(supabase, state.urn, l.phase);
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/teacher") ? next : "/teacher");
  };

  if (state.status !== "ready") return <FirstVisitFrame field="gcse"><p className="text-[15px] text-[var(--field-ink)]">Loading your school&rsquo;s subjects…</p></FirstVisitFrame>;
  const anyTicked = state.lists.some((l) => l.ticked.length);
  return (
    <FirstVisitFrame field={state.lists[0]?.phase === "ks5" ? "post16" : "gcse"}>
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--field-ink)] sm:text-[44px]">Which subjects do you teach?</h1>
        <p className="text-[16px] leading-relaxed text-[var(--field-ink)]">Tick each one. Your home opens on them; you can change this any time.</p>
      </div>
      {state.lists.map((l) => (
        <PhasePicker key={l.phase} list={l} onToggle={(k) => toggle(l.phase, k)} />
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={saving || !anyTicked} data-setup-save="" className="rounded-[12px] bg-[var(--tile-accent)] px-6 py-3.5 text-[16px] font-semibold text-[var(--tile-on-accent)] disabled:opacity-50">
          {saving ? "Saving…" : "Take me to my home"}
        </button>
        {!anyTicked && <span className="text-[14px] text-[var(--field-ink)]">Tick at least one subject.</span>}
      </div>
    </FirstVisitFrame>
  );
}

export function PhasePicker({ list, onToggle }: { list: PhaseList; onToggle: (key: string) => void }) {
  const accent = PHASE_ACCENT[list.phase]!;
  const totals = setupTotals(list.subjects, list.ticked);
  const families = QUALIFICATION_FAMILIES[list.phase].filter((f) => list.subjects.some((s) => s.family === f.id));
  return (
    <section data-setup-phase={list.phase} className="fd-tile flex flex-col gap-4 rounded-[18px] p-5 sm:p-6" style={{ "--accent": accent.hex, "--accent-rgb": accent.rgb } as React.CSSProperties}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-semibold text-[var(--fg)]">{PHASE_LABELS[list.phase]}</h2>
        {/* The live entry count (A6, kept from the old step 2): ticking a subject moves a real number at once. */}
        <p data-live-count={totals.entries} className="text-[14px] text-[var(--muted2)]">
          <span className="text-[22px] font-bold tabular-nums text-[var(--fg)]">{totals.entries.toLocaleString("en-GB")}</span> {totals.entries === 1 ? "entry" : "entries"} across {totals.subjects} subject{totals.subjects === 1 ? "" : "s"} ticked
        </p>
      </div>
      {families.map((f) => (
        <div key={f.id} className="flex flex-col gap-2">
          {/* Qualifications as headings within the list, not a separate step (A6). */}
          <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{f.label}</h3>
          {/* G (phone): full-width rows with 44 px hit areas; chips from sm up. */}
          <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
            {list.subjects
              .filter((s) => s.family === f.id)
              .map((s) => {
                const on = list.ticked.includes(s.key);
                return (
                  <li key={s.key}>
                    <button type="button" aria-pressed={on} data-setup-subject={s.key} onClick={() => onToggle(s.key)} className={`flex min-h-[44px] w-full items-center gap-2 rounded-[12px] border px-3.5 py-2 text-left text-[14px] sm:inline-flex sm:min-h-0 sm:w-auto sm:rounded-full ${on ? "border-[var(--tile-accent)] bg-[var(--tile-tint)] font-semibold text-[var(--fg)]" : "border-[var(--panel-border2)] text-[var(--fg)]"}`}>
                      <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${on ? "border-[var(--tile-accent)] bg-[var(--tile-accent)] text-[var(--tile-on-accent)]" : "border-[var(--muted3)]"}`}>
                        {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>}
                      </span>
                      <span className="min-w-0 flex-1 sm:flex-none">{s.label}</span>
                      <span className="tabular-nums text-[12.5px] text-[var(--muted2)]">{s.entries}</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ what's new

/** The slim strip at the top of home (A7): one line naming what's new, linking to the changelog. */
export function WhatsNewStrip({ entries }: { entries: ChangelogEntry[] }) {
  if (!entries.length) return null;
  const first = entries[0];
  return (
    <div className="px-4 pt-4 sm:px-10" data-whats-new={entries.length}>
      <p className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-4 py-2.5 text-[14px]">
        <span className="rounded-full bg-[var(--fg)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--bg)]">New since your last visit</span>
        <span className="min-w-0 font-medium">{first.title}{entries.length > 1 ? `, and ${entries.length - 1} more` : ""}</span>
        {first.credit_text && <span className="text-[var(--muted)]">{first.credit_text}</span>}
        <Link href="/teacher/whats-new" className="ml-auto inline-flex min-h-[44px] items-center font-semibold underline decoration-from-font underline-offset-2 sm:min-h-0">What&rsquo;s new</Link>
      </p>
    </div>
  );
}

export function WhatsNewPage() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  useEffect(() => {
    (async () => {
      const { supabase } = await session();
      setEntries(await changelogForMe(supabase));
    })();
  }, []);
  const fmt = useMemo(() => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }), []);
  return (
    <FirstVisitFrame field="top">
      <div className="flex flex-col gap-2">
        <Link href="/teacher" className="inline-flex min-h-[44px] w-fit items-center text-[14px] text-[var(--field-ink)] underline decoration-from-font underline-offset-2 sm:min-h-0">&larr; Home</Link>
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--field-ink)] sm:text-[44px]">What&rsquo;s new</h1>
        <p className="text-[16px] text-[var(--field-ink)]">What has changed in VicData, newest first.</p>
      </div>
      {entries === null ? (
        <p className="text-[15px] text-[var(--field-ink)]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="fd-tile rounded-[16px] p-5 text-[15px] text-[var(--muted2)]">Nothing here yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((e) => (
            <li key={e.id} className="fd-tile rounded-[16px] p-5" data-changelog-entry="">
              <p className="text-[12.5px] text-[var(--muted)]">{fmt.format(new Date(e.published_at))}</p>
              <h2 className="mt-1 text-[18px] font-semibold text-[var(--fg)]">{e.title}</h2>
              {e.body && <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--muted2)]">{e.body}</p>}
              {e.credit_text && <p className="mt-2 text-[14px] font-medium text-[var(--tile-accent-text)]">{e.credit_text}</p>}
              {e.link && (
                <Link href={e.link} className="mt-2 inline-block text-[14px] font-semibold underline decoration-from-font underline-offset-2">
                  Take a look
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </FirstVisitFrame>
  );
}

/**
 * On a home: send a first-time person to the welcome (once, R-WELCOME-ONCE), else return what's new since
 * their last visit and record this visit (the strip, once shown, goes: R-WHATS-NEW). `viewingAs`: View as
 * or a peek -- read-only, so neither happens. `ready`: wait until the page knows.
 */
export function useFirstVisit(ready: boolean, viewingAs: boolean): ChangelogEntry[] {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  useEffect(() => {
    if (!ready || viewingAs) return;
    let live = true;
    (async () => {
      const { supabase, user } = await session();
      if (!user) return;
      const load = await loadFrontDoorState(supabase, user.id);
      if (shouldShowWelcome(load, { viewingAs })) {
        window.location.replace("/teacher/welcome");
        return;
      }
      const shown = whatsNew(load.status === "ready" ? await changelogForMe(supabase) : [], load, { viewingAs });
      if (live) setEntries(shown);
      if (load.status === "ready" && load.state) await recordVisit(supabase, user.id);
    })();
    return () => {
      live = false;
    };
  }, [ready, viewingAs]);
  return entries;
}
