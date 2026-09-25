"use client";

// Teacher view, top-nav rounds: the nav bar on every Teacher view page (Redesign.dc.html)
// -- the phase dashboards, Home, Recruitment and Meetings -- replacing the site NavBar there.
//
// Left to right: wordmark; then, pinned right, Home, divider, phase switcher, label
// toggle, divider, Account, theme toggle. The theme toggle MOVED here from each page's own
// header; everything else is new to these pages.
//
// Colours are the Teacher view tokens, not the wireframe's literal hexes: the wireframe
// was drawn dark-only, and #7a7a7a / #1c1c1c / #262626 are its eyeballed stand-ins for
// --muted / --panel-bg / --panel-border2, which also have light-theme values.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchNavLabels, saveNavLabels } from "@/lib/teacher-view-data";
import { PHASE_LABELS, TEACHER_PHASES, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import { PhaseGlyph } from "./HomeCard";
import { PanelMenu, MenuDivider, useDismiss } from "./PanelMenu";
import { ChevronDown } from "./PanelIcons";
import { MeasureToggle, SubjectIconSquare, type FocusSubject, type SharedMeasure } from "./ControlBar";
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
  // The dashboard's own phase, or null on the pages that have none (Home, Recruitment,
  // Meetings) -- where every switcher item is a plain link and none is active.
  phase: TeacherPhase | null;
  // The phases the switcher offers: every onboarded one on a phase dashboard, Recruitment
  // and Meetings; [] on Home, whose own tile list already IS the phase picker.
  phases: TeacherPhase[];
  labelsOn: boolean;
  onLabelsOn: (on: boolean) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  return (
    // Two groups at opposite edges, as in Redesign.dc.html: the wordmark alone on the
    // left, everything from Home to the theme toggle as one cluster pinned to the right.
    <nav aria-label="Teacher view" className="flex flex-wrap items-center justify-between gap-3.5 print:hidden">
      <Link href="/" className="text-[15px] font-extrabold tracking-tight">VicData</Link>
      <div className="flex flex-wrap items-center gap-3.5">
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
          <ThemeToggle theme={theme} onTheme={onTheme} />
        </div>
      </div>
    </nav>
  );
}

// The active phase's tint -- one rule for the desktop tabs and the phone badge and menu.
// Same derivation as ControlBar's qualification badge: the accent at 0.14, so the tab and
// the badge are visibly the same tint rather than two hand-picked ones.
function activePhaseStyle(p: TeacherPhase, active: boolean): CSSProperties | undefined {
  if (!active) return undefined;
  const accent = PHASE_ACCENT[p];
  return { background: accent ? `rgba(${accent.rgb},0.14)` : "var(--panel-bg)", color: accent?.hex ?? "var(--fg)" };
}

// For the pages without a phase: the label setting is read from, and saved to, every
// onboarded phase's preferences row -- the same store the phase dashboard writes -- so one
// toggle means the same thing everywhere. With nothing onboarded there is no row to hold
// it, and it simply lasts for the visit.
export function useNavLabels(schoolUrn: string | null, phases: TeacherPhase[]): [boolean, (on: boolean) => void] {
  const [labelsOn, setLabelsOn] = useState(true);
  const phaseList = phases.join(",");
  useEffect(() => {
    if (!schoolUrn || !phaseList) return;
    let cancelled = false;
    (async () => {
      const on = await fetchNavLabels(createBrowserSupabaseClient(), schoolUrn, phaseList.split(",") as TeacherPhase[]);
      if (!cancelled) setLabelsOn(on);
    })();
    return () => { cancelled = true; };
  }, [schoolUrn, phaseList]);
  const set = useCallback(
    (on: boolean) => {
      setLabelsOn(on);
      if (schoolUrn && phaseList) void saveNavLabels(createBrowserSupabaseClient(), schoolUrn, phaseList.split(",") as TeacherPhase[], on);
    },
    [schoolUrn, phaseList],
  );
  return [labelsOn, set];
}

function PhaseSwitcher({ phase, phases, labelsOn }: { phase: TeacherPhase | null; phases: TeacherPhase[]; labelsOn: boolean }) {
  if (phases.length === 0) return null;
  const item = (p: TeacherPhase) => {
    const active = p === phase;
    const style = activePhaseStyle(p, active);
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
  if (phase && phases.length <= 1) {
    const { style, body } = item(phase);
    return <span className={ROW} style={style} title={PHASE_LABELS[phase]}>{body}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5" aria-label="Phase">
      {/* TEACHER_PHASES order, whatever order the onboarding rows came back in. */}
      {TEACHER_PHASES.filter((p) => phases.includes(p)).map((p) => {
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
  // TeacherNav replaces the site NavBar on the teacher routes, and that bar was a signed-out
  // visitor's only Log in link -- so the menu offers Log in when there is no session. A
  // local session read (no network), and null until known so neither set of rows flashes.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      setSignedIn(Boolean(data.session));
    })();
  }, []);

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
          {signedIn === false ? (
            <Link href="/login" className={rowClass} onClick={() => setOpen(false)}>Log in</Link>
          ) : (
            <>
              <Link href="/account" className={rowClass} onClick={() => setOpen(false)}>Your Account</Link>
              <button type="button" onClick={logOut} disabled={loggingOut || signedIn === null} className={rowClass}>
                {loggingOut ? "Logging out…" : "Log Out"}
              </button>
            </>
          )}
        </PanelMenu>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Phone width (NavPhone.dc.html), phase dashboards only. The page renders this below `sm`
// and TeacherNav + ControlBar above it -- a rendering fork, not a data fork: every prop is
// the same state the desktop pair reads, and every control is the same component
// (AccountMenu, ThemeToggle, MeasureToggle, SubjectIconSquare, the "±" handler).
//
// Row 1 is identity and settings, icon-only with no label toggle -- icon-only is the phone
// design, not a labels-off state. Row 2 is what you are looking at: the phase badge (its
// own dropdown), the measure toggle, and the focus subject (its own dropdown) at the right
// edge. No whole-page Export here by design; each panel's own export is untouched.
export function PhoneNav({
  phase,
  phases,
  theme,
  onTheme,
  measure,
  onMeasure,
  subjects,
  focusKey,
  onFocus,
  onEditSubjects,
  className = "",
}: {
  phase: TeacherPhase;
  phases: TeacherPhase[];
  theme: Theme;
  onTheme: (t: Theme) => void;
  measure: SharedMeasure;
  onMeasure: (next: SharedMeasure) => void;
  subjects: FocusSubject[];
  focusKey: string | null;
  onFocus: (key: string | null) => void;
  onEditSubjects: () => void;
  // The page's breakpoint class (sm:hidden) -- the swap point is the page's call.
  className?: string;
}) {
  return (
    <div className={`print:hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 pb-3">
        <Link href="/" className="text-[15px] font-extrabold tracking-tight">VicData</Link>
        <div className="flex items-center gap-2.5">
          <Link href="/teacher" aria-label="Home" title="Home" className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--panel-bg)] text-[var(--muted)] hover:text-[var(--fg)]">
            {HOME_ICON}
          </Link>
          <AccountMenu />
          <ThemeToggle theme={theme} onTheme={onTheme} />
        </div>
      </div>
      <div className="h-px bg-[var(--panel-border2)]" />
      <div className="flex items-center gap-2 pt-3">
        <PhaseBadgeMenu phase={phase} phases={phases} />
        <MeasureToggle measure={measure} onMeasure={onMeasure} compact />
        {subjects.length > 0 && (
          <SubjectMenu subjects={subjects} focusKey={focusKey} onFocus={onFocus} onEditSubjects={onEditSubjects} />
        )}
      </div>
    </div>
  );
}

const PHONE_MENU_ROW = "flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[13px] font-semibold hover:bg-[var(--box-bg)]";

function PhaseBadgeMenu({ phase, phases }: { phase: TeacherPhase; phases: TeacherPhase[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const listed = TEACHER_PHASES.filter((p) => p === phase || phases.includes(p));
  const badge = "flex h-[34px] shrink-0 items-center gap-1 rounded-[10px] px-2.5";
  // Same single-phase rule as the desktop switcher: plain context, not a menu of one.
  if (listed.length <= 1) {
    return (
      <span className={badge} style={activePhaseStyle(phase, true)} title={PHASE_LABELS[phase]}>
        <span className={GLYPH_WRAP}><PhaseGlyph phase={phase} /></span>
      </span>
    );
  }
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Phase: ${PHASE_LABELS[phase]}`}
        className={badge}
        style={activePhaseStyle(phase, true)}
      >
        <span className={GLYPH_WRAP}><PhaseGlyph phase={phase} /></span>
        {ChevronDown}
      </button>
      {open && (
        <PanelMenu label="Phase" width={180}>
          {listed.map((p) => (
            <Link
              key={p}
              href={`/teacher/${p}`}
              aria-current={p === phase ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`${PHONE_MENU_ROW} ${p === phase ? "" : "text-[var(--muted2)]"}`}
              style={activePhaseStyle(p, p === phase)}
            >
              <span className={GLYPH_WRAP}><PhaseGlyph phase={p} /></span>
              {PHASE_LABELS[p]}
            </Link>
          ))}
        </PanelMenu>
      )}
    </div>
  );
}

function SubjectMenu({
  subjects,
  focusKey,
  onFocus,
  onEditSubjects,
}: {
  subjects: FocusSubject[];
  focusKey: string | null;
  onFocus: (key: string | null) => void;
  onEditSubjects: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const focused = subjects.find((s) => s.key === focusKey) ?? null;
  const choose = (key: string | null) => { onFocus(key); setOpen(false); };
  return (
    <div className="relative ml-auto min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Focus subject: ${focused?.label ?? "All subjects"}`}
        className="flex h-[30px] max-w-full items-center gap-1.5 rounded-full border py-[5px] pl-[5px] pr-2.5 text-xs font-semibold"
        style={
          focused
            ? { borderColor: focused.colour, background: `${focused.colour}29`, color: focused.colour }
            : { borderColor: "var(--panel-border2)", color: "var(--muted2)" }
        }
      >
        {focused && <SubjectIconSquare icon={focused.icon} colour={focused.colour} on />}
        {/* "All", as the desktop chip row says it: at 375px this chip has ~50px of label. */}
        <span className={`truncate ${focused ? "" : "pl-1.5"}`}>{focused?.label ?? "All"}</span>
        <span className="shrink-0">{ChevronDown}</span>
      </button>
      {open && (
        <PanelMenu label="Focus subject" align="right" width={240}>
          <button type="button" onClick={() => choose(null)} aria-pressed={focusKey === null} className={`${PHONE_MENU_ROW} ${focusKey === null ? "" : "text-[var(--muted2)]"}`}>
            All subjects
          </button>
          {subjects.map((s) => {
            const on = s.key === focusKey;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => choose(s.key)}
                className={PHONE_MENU_ROW}
                style={on ? { color: s.colour } : { color: "var(--muted2)" }}
              >
                <SubjectIconSquare icon={s.icon} colour={s.colour} on={on} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
          <MenuDivider />
          <button type="button" onClick={() => { setOpen(false); onEditSubjects(); }} className={`${PHONE_MENU_ROW} text-[var(--accent,var(--fg))]`}>
            <span className="flex h-4 w-4 items-center justify-center text-[13px] font-extrabold">&plusmn;</span>
            Edit subjects
          </button>
        </PanelMenu>
      )}
    </div>
  );
}
