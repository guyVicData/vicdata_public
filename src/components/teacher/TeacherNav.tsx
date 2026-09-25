"use client";

// Teacher view, top-nav round: the phase dashboard's own nav bar (Redesign.dc.html).
//
// Left to right: wordmark, Home, divider, phase switcher, label toggle, divider, Account,
// theme toggle. The theme toggle is the one thing that MOVED here (out of the control
// bar); everything else is new to this page.
//
// Colours are the Teacher view tokens, not the wireframe's literal hexes: the wireframe
// was drawn dark-only, and #7a7a7a / #1c1c1c / #262626 are its eyeballed stand-ins for
// --muted / --panel-bg / --panel-border2, which also have light-theme values.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { PHASE_LABELS, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import { PhaseGlyph } from "./HomeCard";
import { PanelMenu, useDismiss } from "./PanelMenu";
import { ThemeToggle, type Theme } from "./TeacherChrome";

const ICON = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const HOME_ICON = (
  <svg {...ICON}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const LINES_ICON = (
  <svg {...ICON}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const ACCOUNT_ICON = (
  <svg {...ICON}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 16 0v1" />
  </svg>
);

const Divider = () => <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--panel-border2)]" />;

// PhaseGlyph draws at a fixed 20px for the home tiles; the nav wants the wireframe's
// smaller glyph, so the wrapper scales it rather than forking the icon.
const GLYPH_WRAP = "flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4";

// One row shape for every phase item, tab or plain context, so the two cannot drift apart.
const ROW = "inline-flex h-[34px] shrink-0 items-center gap-2 rounded-full px-3 text-xs font-bold";

export function TeacherNav({
  phase,
  phases,
  labelsOn,
  onLabelsOn,
  theme,
  onTheme,
}: {
  phase: TeacherPhase;
  // Every phase this school has onboarded (the current one always included).
  phases: TeacherPhase[];
  labelsOn: boolean;
  onLabelsOn: (on: boolean) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  return (
    // One row in the wireframe's order, left-packed -- the brief lists Account and the
    // theme toggle straight after the second divider, not pushed to the far edge.
    <nav aria-label="Teacher view" className="flex flex-wrap items-center gap-3.5 print:hidden">
      <Link href="/" className="text-[15px] font-extrabold tracking-tight">VicData</Link>
      <Link
        href="/teacher"
        aria-label={labelsOn ? undefined : "Home"}
        title="Home"
        className="inline-flex h-[34px] shrink-0 items-center gap-2 pr-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]"
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--panel-bg)]">{HOME_ICON}</span>
        {labelsOn && <span>Home</span>}
      </Link>
      <Divider />
      <div className="flex flex-wrap items-center gap-2.5">
        <PhaseSwitcher phase={phase} phases={phases} labelsOn={labelsOn} />
        <button
          type="button"
          onClick={() => onLabelsOn(!labelsOn)}
          aria-pressed={labelsOn}
          aria-label={labelsOn ? "Hide labels" : "Show labels"}
          title={labelsOn ? "Hide labels" : "Show labels"}
          className="flex h-[34px] w-[26px] shrink-0 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)]"
        >
          {LINES_ICON}
        </button>
      </div>
      <Divider />
      <div className="flex items-center gap-2.5">
        <AccountMenu />
        <ThemeToggle theme={theme} onTheme={onTheme} variant="icon" />
      </div>
    </nav>
  );
}

function PhaseSwitcher({ phase, phases, labelsOn }: { phase: TeacherPhase; phases: TeacherPhase[]; labelsOn: boolean }) {
  const item = (p: TeacherPhase) => {
    const accent = PHASE_ACCENT[p];
    const active = p === phase;
    // Same derivation as ControlBar's qualification badge: the accent at 0.14, so the tab
    // and the badge below it are visibly the same tint rather than two hand-picked ones.
    const style = active
      ? { background: accent ? `rgba(${accent.rgb},0.14)` : "var(--panel-bg)", color: accent?.hex ?? "var(--fg)" }
      : undefined;
    return { active, style, body: (
      <>
        <span className={GLYPH_WRAP}><PhaseGlyph phase={p} /></span>
        {labelsOn && <span>{PHASE_LABELS[p]}</span>}
      </>
    ) };
  };

  // One onboarded phase: plain context, not a one-tab switcher -- a tab that looks
  // clickable but can only lead back to the page you are on is a control that does
  // nothing. It keeps the active styling so the nav reads the same at either count.
  if (phases.length <= 1) {
    const { style, body } = item(phase);
    return <span className={ROW} style={style} title={PHASE_LABELS[phase]}>{body}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5" aria-label="Phase">
      {phases.map((p) => {
        const { active, style, body } = item(p);
        return (
          <Link
            key={p}
            href={`/teacher/${p}`}
            aria-current={active ? "page" : undefined}
            aria-label={labelsOn ? undefined : PHASE_LABELS[p]}
            title={PHASE_LABELS[p]}
            className={`${ROW} ${active ? "" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
            style={style}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}

function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  // The same call account/page.tsx's own "Log out" makes, then the same destination.
  async function logOut() {
    setLoggingOut(true);
    await createBrowserSupabaseClient().auth.signOut();
    router.push("/");
  }

  const rowClass = "w-full rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium hover:bg-[var(--box-bg)] disabled:opacity-50";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account"
        title="Account"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--panel-bg)] text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {ACCOUNT_ICON}
      </button>
      {open && (
        <PanelMenu label="Account" align="right" width={180}>
          <Link href="/account" className={rowClass} onClick={() => setOpen(false)}>Your Account</Link>
          <button type="button" onClick={logOut} disabled={loggingOut} className={rowClass}>
            {loggingOut ? "Logging out…" : "Log Out"}
          </button>
        </PanelMenu>
      )}
    </div>
  );
}
