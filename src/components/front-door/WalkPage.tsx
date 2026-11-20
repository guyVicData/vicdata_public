"use client";

// VicData 0.8 front door (B11-B14): the walk, full screen. One rhythm for every walk -- this year, in
// context, over time, wider -- one screen at a time, each the dashboard's own view enlarged:
//
//   header   close, the walk's icon and question, step dots, the subject·phase chip, "Step n of N"
//   screen   the screen's question large, a one-line written answer from the data; the mini-map (the
//            dashboard's 3x2 grid, this panel lit, "Show me")
//   panel    a 3px accent bar; the column's icon, name and question; the pill that sets it; the row tag;
//            the walk's rail: the walk's own views, names written out, in its order (lit = this screen; a click
//            steps the walk there; "As a table" switches in place; "More on the dashboard" at its foot:
//            0.8 feedback B2, D4); the chart titled with the view's dashboard title; the note (i)
//   footer   Back; Next previews the next question; the last screen ends on "Here's what you found", which
//            answers the walk's question with a data view and offers the way home (0.8 feedback B1, B2)
//
// Mid (C18): the root draws Light (the plates are white) and the header is a dark band of its own; the
// screen sits on the part's colour. Dark and Light draw the theme's own.
import Link from "next/link";
import { PHASE_TONES } from "@/components/smt/ui";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { backFrom, HOME_SECTION, withBack } from "@/lib/front-door/back";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { pickMembership, resolveViewAs, resolvePeek } from "@/lib/view-as";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import { PHASE_LABELS } from "@/lib/teacher-view-phases";
import { fillTemplate, screenMeta, teacherModeOf, walkById, walkRailLabels, type Walk } from "@/lib/front-door/walks";
import type { TeacherModel } from "@/lib/front-door/teacher-model";
import { teacherAnswerStep, teacherScreens, type Screen } from "@/lib/front-door/teacher-screens";
import { palette, WalkChart } from "./charts";
import { RailGlyph, WalkGlyph } from "./home";
import { RoleWalk } from "./role-walks";
import { LoadingGraphic } from "@/components/shell/LoadingGraphic";

const CLOSE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
);
const ARROW_R = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const ARROW_L = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
const INFO = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);

/** The accent for focus lines on a light plate (the phase accents are pale on white: C16). */
const LIGHT_FOCUS: Record<string, string> = { gcse: "#12a05c", post16: "#7c5ce6", smt: "#c2410c", smt_primary: "#c2410c", admissions: "#0b7bb8", group: "#8a5a2b" };
/** SMT's, Admissions' and head office's accent in a walk (the panel bar, the lit rail view): the role
 * colour on Dark, its contrast-checked deeper tone on a light plate (Mid, Light). */
const ROLE_WALK_ACCENT: Record<string, { dark: { hex: string; rgb: string }; light: { hex: string; rgb: string } }> = {
  smt: { dark: { hex: "#fb923c", rgb: "251,146,60" }, light: { hex: "#c2410c", rgb: "194,65,12" } },
  smt_primary: { dark: { hex: "#fb923c", rgb: "251,146,60" }, light: { hex: "#c2410c", rgb: "194,65,12" } },
  admissions: { dark: { hex: "#22d3ee", rgb: "34,211,238" }, light: { hex: "#0b6fa6", rgb: "11,111,166" } },
  group: { dark: { hex: "#a8743f", rgb: "168,116,63" }, light: { hex: "#8a5a2b", rgb: "138,90,43" } },
};
const FIELD: Record<string, "gcse" | "post16" | "top" | "group" | "admissions"> = { gcse: "gcse", post16: "post16", smt: "top", smt_primary: "top", admissions: "admissions", group: "group" };

/** Leighton Park prep (20 Nov): an SMT walk opened from the home's GCSE or Post-16 tab (?level=) keeps that tab's
 * colour and field, not SMT orange. Null for any other walk (Overview is the whole school at any level). */
export function useWalkTab(walk: Pick<Walk, "product" | "id">): "gcse" | "post16" | null {
  const sp = useSearchParams();
  if (walk.product !== "smt" || walk.id.endsWith("-overview")) return null;
  const l = sp.get("level");
  return l === "gcse" || l === "post16" ? l : null;
}

// ------------------------------------------------------------------------------------------------ the frame

export function WalkFrame({ walk, step, steps, chip, ctx, children }: { walk: Walk; step: number; steps: number; chip: string | null; ctx?: { subject?: string | null; category?: string | null; entry?: string | null }; children: ReactNode }) {
  const [pref] = useThemePref();
  const theme = effectiveTheme(pref);
  const mid = pref === "mid";
  const tab = useWalkTab(walk);
  const home = useWalkHome(walk);
  const accent = walk.product === "gcse" || walk.product === "post16" ? PHASE_ACCENT[walk.product === "gcse" ? "ks4" : "ks5"]! : tab ? PHASE_TONES[tab][mid || theme === "light" ? "light" : "dark"] : (ROLE_WALK_ACCENT[walk.product]?.[mid || theme === "light" ? "light" : "dark"] ?? null);
  const style = (accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) as CSSProperties;
  return (
    <WalkHomeContext.Provider value={home}>
    <main id="teacher-root" data-theme={mid ? "light" : theme} data-pref={pref} data-walk={walk.id} className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]" style={style}>
      <WalkHeader walk={walk} step={step} steps={steps} chip={chip} ctx={ctx} band={mid || theme === "dark" ? "dark" : "light"} part={tab ?? FIELD[walk.product]} />
      <section data-field={tab ?? FIELD[walk.product]} className="flex-grow px-4 py-8 sm:px-10">
        {/* Crosscheck (14 Nov): the boards' walk column is 1060 px (the homes keep 1160). */}
        <div className="mx-auto flex max-w-[1060px] flex-col gap-6">{children}</div>
      </section>
    </main>
    </WalkHomeContext.Provider>
  );
}

/**
 * The walk's header band: close, the walk's icon and question, step dots, the subject·phase chip, "Step n
 * of N". Its colours are its own tokens (globals.css, [data-walk-head]), set on the band itself, so in Mid
 * -- a dark band over a Light page -- nothing inherits the page's dark text (Guy, 13 Nov: dark grey on
 * black). Every pair is in the contrast table (R-THEME-CONTRAST).
 */
export function WalkHeader({ walk, step, steps, chip, ctx, band, part }: { walk: Walk; step: number; steps: number; chip: string | null; ctx?: { subject?: string | null; category?: string | null; entry?: string | null }; band: "dark" | "light"; part?: string }) {
  const back = useWalkBack();
  return (
    <header data-walk-head={band} data-part={part ?? FIELD[walk.product]} data-theme={band === "dark" ? "dark" : undefined} className="border-b border-[var(--wh-border)] bg-[var(--wh-bg)] text-[var(--wh-fg)]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <ViewAsBanner />
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        {/* Crosscheck (14 Nov, walk_*.png): the step dots sit centred, the walk on the left, chip and step right. */}
        <span className="flex w-full min-w-0 items-center gap-x-4 sm:w-auto sm:flex-1">
          <Link href={back.href} aria-label={`Close the walk: ${back.label.toLowerCase()}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--wh-muted)] hover:text-[var(--wh-fg)] sm:h-8 sm:w-8">{CLOSE}</Link>
          <span data-walk-head-icon="" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--wh-tint)] text-[var(--wh-accent)]">
            <WalkGlyph icon={walk.icon} size={17} />
          </span>
          <span className="min-w-0 text-[15px] font-medium text-[var(--wh-fg)]">{fillTemplate(walk.question, ctx ?? { subject: chip?.split(" · ")[0] ?? null })}</span>
        </span>
        <ol className="hidden items-center gap-1.5 sm:flex" aria-label="Steps">
          {Array.from({ length: steps }, (_, i) => (
            <li key={i} aria-current={i === step ? "step" : undefined} className={`h-1.5 rounded-full ${i === step ? "w-6 bg-[var(--wh-accent)]" : "w-1.5 bg-[var(--wh-dot)]"}`} />
          ))}
        </ol>
        <span className="flex items-center gap-x-4 sm:flex-1 sm:justify-end">
          {chip && <span data-walk-head-chip="" className="rounded-full border border-[var(--wh-accent)] px-3 py-1 text-[13px] font-medium text-[var(--wh-accent)]">{chip}</span>}
          <span className="text-[13px] text-[var(--wh-muted)]">{step < steps ? `Step ${step + 1} of ${steps}` : "Done"}</span>
        </span>
      </div>
    </header>
  );
}

/** A walk's natural parent: its role's own section of the home (HomeSection's id), or the group's home. */
export function homeOf(walk: Pick<Walk, "product">): string {
  if (walk.product === "group") return HOME_SECTION.group;
  if (walk.product === "smt" || walk.product === "smt_primary") return HOME_SECTION.smt;
  if (walk.product === "admissions") return HOME_SECTION.admissions;
  return walk.product === "gcse" ? HOME_SECTION.gcse : HOME_SECTION.post16;
}

/** Guy, 20 Nov (navigation): where a walk goes back to -- the ?back= it was opened with (lib/front-door/back.ts),
 * else its natural parent -- for its close, its first Back, its last window and the dashboards it opens. */
export function useWalkHome(walk: Pick<Walk, "product">): { href: string; label: string } {
  const sp = useSearchParams();
  const b = backFrom(sp, homeOf(walk));
  return { href: b.href, label: b.label };
}
const WalkHomeContext = createContext<{ href: string; label: string }>({ href: "/teacher", label: "Back to your home" });
/** The way back, inside a walk's frame (WalkFrame provides it). */
export const useWalkBack = () => useContext(WalkHomeContext);

/** The mini-map: the dashboard's 3x2 grid, column icons above, this panel lit; Show me opens the dashboard. */
export function MiniMap({ cols, spot, name, href: to }: { cols: string[]; spot: { col: number; row: number; span?: number; panel?: string }; name: string; href: string }) {
  // The dashboard it opens goes back where the walk began, not into the walk.
  const href = withBack(to, useWalkBack().href);
  return (
    <aside data-mini-map="" className="fd-tile w-full shrink-0 rounded-[12px] p-3 sm:max-w-[220px]">
      <div className="flex items-center justify-between text-[11.5px] text-[var(--muted)]">
        On the dashboard
        <Link href={href} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--tile-accent-text,var(--fg))] sm:min-h-0">Show me &#8599;</Link>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-[var(--fg)]">{name}</p>
      <div className="mt-2 grid grid-cols-[3.2rem_repeat(3,1fr)] items-center gap-1 text-[10.5px] text-[var(--muted)]">
        <span />
        {cols.map((c, i) => (
          <span key={i} className="flex justify-center"><WalkGlyph icon={c} size={12} /></span>
        ))}
        {["Current", "Trends"].map((r, ri) => (
          <RowCells key={r} label={r} lit={spot.row === ri ? spot.col : -1} span={spot.span ?? 1} />
        ))}
      </div>
    </aside>
  );
}
function RowCells({ label, lit, span }: { label: string; lit: number; span: number }) {
  // Review fixes (14 Nov, M1): a panel spanning two columns lights both.
  const on = (c: number) => lit >= 0 && c >= lit && c < lit + span;
  return (
    <>
      <span>{label}</span>
      {[0, 1, 2].map((c) => (
        <span key={c} data-lit={on(c) ? "" : undefined} className={`h-4 rounded-[4px] ${on(c) ? "bg-[var(--tile-accent,var(--accent))]" : "bg-[var(--box-bg)] ring-1 ring-[var(--panel-border)]"}`} />
      ))}
    </>
  );
}

/** The panel: the dashboard's own panel, enlarged. */
/** C13: the walk's window -- a hairline edge, a large radius and a soft two-layer shadow (a close contact
 * shadow and a wide, faint lift), the same in Light, Mid and Dark. */
export const WALK_WINDOW = "overflow-hidden rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_18px_40px_-24px_rgba(15,23,42,0.35)]";

export function WalkPanel({ icon, name, question, pills, tag, rail, title, note, controls, children }: { icon: string; name: string; question: string; pills: string[]; tag: string; rail: ReactNode; title: string; note: string; controls?: ReactNode; children: ReactNode }) {
  return (
    // 0.8 feedback C (C13, Admissions 11): the window without the 3 px accent stripe, which the rounded corners
    // clipped into what read as a clumsy shadow along its top edge. The section's colour is now a faint tint
    // on the header, the edge a hairline, and the shadow two soft layers (WALK_WINDOW), the same in every theme.
    <div data-walk-panel="" className={WALK_WINDOW}>
      <div data-walk-panel-head="" className="flex flex-wrap items-center gap-2.5 border-b border-[var(--panel-border)] bg-[rgba(var(--accent-rgb,138,138,144),0.06)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[rgba(var(--accent-rgb,138,138,144),0.16)] text-[var(--accent,var(--fg))]"><WalkGlyph icon={icon} size={17} /></span>
        <p className="min-w-0 flex-grow text-[15px]"><strong>{name}</strong> <span className="text-[var(--muted)]">— {question}</span></p>
        {pills.map((p) => {
          // "Compared against: Subject category" draws as the dashboard's pill: the label, then the setting.
          const [label, value] = p.includes(": ") ? p.split(": ") : [null, p];
          return (
            <span key={p} data-walk-pill="" title="Set on the dashboard" className="rounded-full border border-[var(--panel-border2)] px-2.5 py-0.5 text-[12px] text-[var(--muted2)]">
              {label && <>{label} </>}<strong className="font-medium text-[var(--fg)]">{value}</strong>
            </span>
          );
        })}
        {controls && <span data-walk-controls="" className="flex flex-wrap items-center gap-2">{controls}</span>}
        <span className="rounded-[6px] bg-[var(--box-bg)] px-2 py-0.5 text-[12px] text-[var(--muted2)]">{tag}</span>
      </div>
      <div className="grid md:grid-cols-[200px_minmax(0,1fr)]">
        {/* G (phone): the rail is a horizontal scroll of named chips above the chart; a column from md up. */}
        <nav aria-label="Views" className="flex min-w-0 flex-col gap-1 border-b border-[var(--panel-border)] p-3 md:border-b-0 md:border-r">
          <p className="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] md:block">Views</p>
          {rail}
        </nav>
        <div className="min-w-0 p-4 sm:p-5">
          {/* Review fixes (14 Nov, M2): SMT's, Admissions' and head office's views carry their own title (the
              dashboard's), so the walk passes none and the view's title shows once. */}
          {title && <h3 className="mb-3 text-[14px] font-semibold">{title}</h3>}
          <div data-plate="" className="rounded-[10px] bg-[var(--box-bg)] p-3 sm:p-4">{children}</div>
        </div>
      </div>
      {note && (
        <p className="flex items-start gap-2 border-t border-[var(--panel-border)] px-4 py-2.5 text-[12.5px] text-[var(--muted)]">
          <span className="mt-0.5 shrink-0">{INFO}</span>
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * 0.8 feedback B2 (D4, Admissions 2; R-WALK-RAIL): the walk's rail -- the walk's own views, in its order, named
 * as the dashboard names them (walkRailLabels). The lit one is this screen; a click steps the walk to that
 * screen, never off to the dashboard. "As a table" (where the walk can draw one) switches this screen in place;
 * "More on the dashboard" at the foot opens the full dashboard.
 */
export function WalkRail({ walk, step, onStep, dashboard, asTable, onTable }: { walk: Walk; step: number; onStep: (i: number) => void; dashboard: string; asTable?: boolean; onTable?: (on: boolean) => void }) {
  const back = useWalkBack();
  const labels = walkRailLabels(walk);
  const lit = (on: boolean) => (on ? "bg-[rgba(var(--accent-rgb,138,138,144),0.16)] font-semibold text-[var(--fg)]" : "text-[var(--muted2)] hover:text-[var(--fg)]");
  const glyph = (on: boolean, icon: string) => <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] ${on ? "bg-[var(--accent,var(--fg))] text-[var(--bg)]" : ""}`}><RailGlyph name={icon} size={13} /></span>;
  return (
    <ul className={RAIL_LIST} data-walk-rail="">
      {walk.screens.map((sc, i) => {
        const on = i === step && !asTable;
        return (
          <li key={i}>
            <button type="button" data-walk-rail-step={i + 1} className="w-full text-left" aria-current={i === step ? "step" : undefined} onClick={() => (onTable?.(false), onStep(i))}>
              <span className={`${RAIL_ROW} ${lit(on)}`}>{glyph(on, screenMeta(sc.view)?.icon ?? "TilesIcon")}<span className="min-w-0 flex-1">{labels[i]}</span></span>
            </button>
          </li>
        );
      })}
      {onTable && (
        <li>
          <button type="button" className="w-full text-left" onClick={() => onTable(!asTable)} aria-pressed={!!asTable}>
            <span className={`${RAIL_ROW} ${lit(!!asTable)}`}>{glyph(!!asTable, "TableIcon")}As a table</span>
          </button>
        </li>
      )}
      <li className="md:mt-3 md:border-t md:border-[var(--panel-border)] md:pt-2">
        <Link href={withBack(dashboard, back.href)} data-walk-rail-more="" className={`${RAIL_ROW} text-[var(--muted2)] hover:text-[var(--fg)]`}>More on the dashboard <span aria-hidden="true">&rarr;</span></Link>
      </li>
    </ul>
  );
}

/** Back, and Next previewing the next question (or "Here's what you found"). */
export function WalkFooter({ onBack, onNext, backLabel, next, finish = false }: { onBack: () => void; onNext: () => void; backLabel: string; next: string; finish?: boolean }) {
  return (
    // G (phone): Back and Next in a sticky bottom bar; from sm up, the row under the panel.
    <div data-walk-footer="" className="sticky bottom-0 z-30 -mx-4 flex flex-nowrap items-center justify-between gap-3 border-t border-[var(--panel-border)] bg-[var(--bg)] px-4 py-2.5 sm:static sm:mx-0 sm:flex-wrap sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-2">
      {/* Crosscheck (14 Nov, walk_*.png): Back is an outlined button beside the solid Next. */}
      <button type="button" onClick={onBack} className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[12px] border border-[var(--panel-border2)] px-4 py-3 text-[15px] text-[var(--fg)] hover:bg-[var(--box-bg)]">{ARROW_L} {backLabel}</button>
      <button type="button" onClick={onNext} data-walk-next="" className="flex min-h-[44px] min-w-0 max-w-full flex-1 items-center gap-4 rounded-[14px] bg-[var(--tile-accent,var(--accent))] px-5 py-3 text-left text-[var(--tile-on-accent,#0a0a0b)] sm:flex-none">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">{finish ? "Finish" : "Next"}</span>
          <span className="block truncate text-[15.5px] font-semibold sm:whitespace-normal">{finish ? "See what you found" : next}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/10">{ARROW_R}</span>
      </button>
    </div>
  );
}

/** G: one screen's layout -- the question and answer, the panel, the mini-map. On a phone they stack in that
 * order (the mini-map under the chart); from sm up the mini-map sits beside the question, as before. */
export function WalkScreen({ head, map, panel }: { head: ReactNode; map: ReactNode; panel: ReactNode }) {
  return (
    <div data-walk-screen="" className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-x-4">
      <div className="flex min-w-0 flex-col gap-2 sm:col-start-1 sm:row-start-1">{head}</div>
      <div className="min-w-0 sm:col-span-2 sm:row-start-2">{panel}</div>
      <div className="min-w-0 sm:col-start-2 sm:row-start-1">{map}</div>
    </div>
  );
}

/** The rail's list and row: chips in a horizontal scroll on a phone, the panel's column from md up. */
export const RAIL_LIST = "-mx-3 flex flex-row gap-1.5 overflow-x-auto px-3 pb-0.5 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0";
export const RAIL_ROW = "flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-[var(--panel-border2)] px-3 py-1.5 text-[13px] md:min-h-0 md:whitespace-normal md:rounded-[8px] md:border-0 md:px-2";

/** The step, kept in the address (?step=) so a refresh or a shared link opens the same screen. */
export function useStep(n: number): [number, (s: number) => void] {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const s = Number(new URLSearchParams(window.location.search).get("step"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number.isFinite(s) && s > 0) setStep(Math.min(s - 1, n));
  }, [n]);
  const set = (s: number) => {
    setStep(s);
    const q = new URLSearchParams(window.location.search);
    q.set("step", String(s + 1));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
    window.scrollTo(0, 0);
  };
  return [step, set];
}

// ------------------------------------------------------------------------------------------------ Teacher

const modeOf = teacherModeOf;
const COLUMN_NAME: Record<string, string> = { candidates: "Candidates", results: "Results", context: "Context", rankings: "Comparisons" };

function columnOf(view: string): string {
  if (view.startsWith("DV-C1-RES") || view.startsWith("DV-C1-CNT")) return "results";
  if (view.startsWith("DV-C1")) return "candidates";
  if (view.startsWith("DV-C2")) return "context";
  return "rankings";
}

async function schoolUrn(): Promise<string | null> {
  const supabase = createBrowserSupabaseClient();
  const v = (await resolveViewAs(supabase)) ?? (await resolvePeek(supabase));
  if (v) return v.urn;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const { data } = await supabase.from("school_memberships").select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn)").eq("profile_id", s.session.user.id).eq("status", "approved");
  return pickMembership((data ?? []) as unknown as { id: string; school_accounts: { school_urn: string } | null }[])?.school_accounts?.school_urn ?? null;
}

function TeacherWalk({ walk }: { walk: Walk }) {
  const teacherHome = useWalkHome(walk);
  const phase = walk.product === "gcse" ? "ks4" : "ks5";
  const [model, setModel] = useState<TeacherModel | null | "error">(null);
  const [step, setStep] = useStep(walk.screens.length);
  const [asTable, setAsTable] = useState(false);
  const [pref] = useThemePref();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const urn = await schoolUrn();
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      if (!urn || !data.session) return setModel("error");
      const subject = new URLSearchParams(window.location.search).get("subject");
      const res = await fetch(`/api/front-door/teacher?urn=${urn}&phase=${phase}&full=1${subject ? `&focus=${encodeURIComponent(subject)}` : ""}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } }).catch(() => null);
      setModel(res?.ok ? ((await res.json()) as TeacherModel) : "error");
    })();
  }, [phase]);
  const screens: Screen[] = useMemo(() => (model && model !== "error" ? teacherScreens(model, walk) : []), [model, walk]);
  const chip = model && model !== "error" && model.focus ? `${model.focus.subject} · ${model.focus.qualLabel === "A-level" ? "A level" : model.focus.qualLabel}` : null;
  const dark = effectiveTheme(pref) === "dark" && pref !== "mid";
  const pal = palette({ dark, accent: { hex: PHASE_ACCENT[phase]!.hex, light: LIGHT_FOCUS[walk.product] }, categoryId: model && model !== "error" ? model.category.id : null });
  const n = walk.screens.length;
  if (model === null) return <WalkFrame walk={walk} step={0} steps={n} chip={null}><div className="fd-tile flex min-h-[220px] rounded-[14px]"><LoadingGraphic /></div></WalkFrame>;
  if (model === "error") return <WalkFrame walk={walk} step={0} steps={n} chip={null}><p className="text-[15px] text-[var(--field-ink)]">This walk couldn&rsquo;t load your school&rsquo;s figures. <Link className="underline" href="/teacher">Back to your home</Link>.</p></WalkFrame>;
  const params = { subject: model.focus?.key ?? null };
  if (step >= n) {
    // R-WALK-ENDS-ON-ANSWER: the answer screen's chart, drawn again on the last window with its sentence.
    const ai = teacherAnswerStep(walk, screens);
    const answer = ai >= 0 ? { sentence: screens[ai].answer, title: screens[ai].title, body: <WalkChart chart={screens[ai].chart} p={pal} asTable={false} /> } : null;
    return <WalkFrame walk={walk} step={n} steps={n} chip={chip}><Found walk={walk} screens={screens} params={params} ctx={{ subject: model.focus?.subject ?? null, category: model.category.label }} onBack={() => setStep(n - 1)} answer={answer} /></WalkFrame>;
  }
  const s = walk.screens[step];
  const sc = screens[step];
  const col = columnOf(s.view);
  // Crosscheck (14 Nov): a screen lives on GCSE Candidates or GCSE Results (the boards' mini-map names the
  // dashboard, never a column). 0.8 feedback B2: its rail is the walk's own (WalkRail).
  const mode = modeOf(s);
  const pills = [
    ...(s.options?.against === "category" && col === "context" ? ["Compared against: Subject category"] : []),
    ...(s.options?.against === "whole" ? ["Compared against: Whole school"] : []),
    ...(s.options?.measure === "points" ? ["Results measure: Average points"] : []),
  ];
  const colQuestion: Record<string, string> = {
    // The column questions of the one vocabulary (vocabulary.png §1).
    candidates: `How many ${phase === "ks5" ? "students" : "pupils"} take ${model.focus?.subject ?? "your subject"}?`,
    results: `How well do ${phase === "ks5" ? "students" : "pupils"} do in ${model.focus?.subject ?? "your subject"}?`,
    context: `How does ${model.focus?.subject ?? "your subject"} sit alongside the rest of the school?`,
    rankings: `How does ${model.focus?.subject ?? "your subject"} compare with other ${phase === "ks5" ? "sixth forms" : "schools"}?`,
  };
  const next = step + 1 < n ? screens[step + 1].question : "Here's what you found";
  return (
    <WalkFrame walk={walk} step={step} steps={n} chip={chip}>
      <WalkScreen
        head={
          <>
            <h1 data-walk-question="" className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[var(--field-ink)] sm:text-[36px]">{sc.question}</h1>
            <p data-walk-answer="" className="text-[17px] leading-relaxed text-[var(--field-ink)] sm:text-[19px]">{sc.answer}</p>
          </>
        }
        map={<MiniMap cols={[mode, "context", "rankings"]} spot={s.spot} name={`${PHASE_LABELS[phase]} ${mode === "results" ? "Results" : "Candidates"}`} href={s.options?.against === "whole" && col === "context" ? `${walk.dashboard}?against=whole` : walk.dashboard} />}
        panel={
          <WalkPanel icon={col} name={COLUMN_NAME[col]} question={colQuestion[col]} pills={pills} tag={sc.tag} title={sc.title} note={sc.note} rail={<WalkRail walk={walk} step={step} onStep={setStep} dashboard={walk.dashboard} asTable={asTable} onTable={setAsTable} />}>
            <WalkChart chart={sc.chart} p={pal} asTable={asTable} />
          </WalkPanel>
        }
      />
      <WalkFooter onBack={() => (step === 0 ? router.push(teacherHome.href) : (setAsTable(false), setStep(step - 1)))} backLabel={step === 0 ? "Questions" : "Back"} onNext={() => { setAsTable(false); setStep(step + 1); }} next={next} finish={step + 1 >= n} />
    </WalkFrame>
  );
}

/** The data view that answers a walk's question, for its last window (R-WALK-ENDS-ON-ANSWER). */
export type FoundAnswer = { sentence: string; title?: string; body: ReactNode };

/**
 * "Here's what you found". 0.8 feedback B1 (G1): it opens on the answer to the walk's own question -- the walk's
 * answer view (a ranking, chart or table, walks.ts `answer`), large, with its sentence -- then how you got
 * there, screen by screen, then the way on: back to your home (B2, Admissions 12), the other questions and the
 * full dashboard.
 */
export function Found({ walk, screens, ctx, onBack, answer }: { walk: Walk; screens: { question: string; answer: string }[]; params: Record<string, string | null>; ctx: { subject?: string | null; category?: string | null; entry?: string | null }; onBack: () => void; answer: FoundAnswer | null }) {
  // Guy, 20 Nov: a walk ends by going back where it began (up one level) -- no list of other walks, no dashboard.
  const home = useWalkBack();
  return (
    <div className="flex flex-col gap-6" data-walk-found="">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[30px] font-semibold leading-tight text-[var(--field-ink)] sm:text-[38px]">Here&rsquo;s what you found</h1>
        <Link href={home} data-walk-home="" className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-4 py-2.5 text-[14.5px] font-semibold text-[var(--fg)]">{ARROW_L} {home.label}</Link>
      </div>
      {answer && (
        <section data-walk-found-answer={walk.answer?.kind ?? ""} className={WALK_WINDOW}>
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="text-[20px] font-semibold leading-snug text-[var(--fg)] sm:text-[24px]">{fillTemplate(walk.question, ctx)}</h2>
            <p className="text-[15.5px] leading-relaxed text-[var(--fg)]">{answer.sentence}</p>
            {answer.title && <h3 className="text-[14px] font-semibold text-[var(--fg)]">{answer.title}</h3>}
            <div data-plate="" className="min-w-0 overflow-x-auto rounded-[10px] bg-[var(--box-bg)] p-3 sm:p-4">{answer.body}</div>
          </div>
        </section>
      )}
      <h2 className="text-[17px] font-semibold text-[var(--field-ink)]">How you got there</h2>
      <ol className="-mt-3 flex flex-col gap-3">
        {walk.screens.map((s, i) => {
          const meta = screenMeta(s.view);
          return (
            <li key={i} className="fd-tile flex items-start gap-3 rounded-[14px] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tile-tint)] text-[var(--tile-accent-text)]"><RailGlyph name={meta?.icon ?? "TilesIcon"} /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[var(--fg)]">{screens[i]?.question}</span>
                <span className="mt-0.5 block text-[14px] text-[var(--muted2)]">{screens[i]?.answer}</span>
                <span className="mt-1 block text-[12px] text-[var(--muted)]">On the dashboard: {meta?.label ?? s.view}, {spotWords(s.spot)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[var(--panel-border2)] px-4 py-3 text-[15px] text-[var(--fg)] hover:bg-[var(--box-bg)]">{ARROW_L} Back</button>
        <Link href={home} className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[var(--panel-border2)] px-4 py-3 text-[15px] text-[var(--fg)] hover:bg-[var(--box-bg)]">{home.label}</Link>
      </div>
    </div>
  );
}

/** Where a view lives, in words: "Trends row, column 2 (Pipeline)" -- from the spot the config gives. */
export function spotWords(spot: { col: number; row: number; span?: number; panel?: string }): string {
  const cols = (spot.span ?? 1) === 2 ? `columns ${spot.col + 1}–${spot.col + 2}` : `column ${spot.col + 1}`;
  const row = spot.row === 0 ? "Current" : "Trends";
  return `${row} row, ${cols}${spot.panel && spot.panel !== row ? ` (${spot.panel})` : ""}`;
}

// ------------------------------------------------------------------------------------------------ entry

export function WalkPage({ walkId }: { walkId: string }) {
  const walk = walkById(walkId);
  if (!walk) return <main className="mx-auto max-w-3xl p-6 text-sm">There&rsquo;s no walk called &ldquo;{walkId}&rdquo;. <Link href="/teacher" className="underline">Back to your home</Link>.</main>;
  if (walk.product === "gcse" || walk.product === "post16") return <TeacherWalk walk={walk} />;
  return <RoleWalk walk={walk} />;
}
