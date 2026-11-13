"use client";

// VicData 0.8 front door (B11-B14): the walk, full screen. One rhythm for every walk -- this year, in
// context, over time, wider -- one screen at a time, each the dashboard's own view enlarged:
//
//   header   close, the walk's icon and question, step dots, the subject·phase chip, "Step n of N"
//   screen   the screen's question large, a one-line written answer from the data; the mini-map (the
//            dashboard's 3x2 grid, this panel lit, "Show me")
//   panel    a 3px accent bar; the column's icon, name and question; the pill that sets it; the row tag;
//            the panel's own rail, names written out (lit = this view; "As a table" switches in place; any
//            other view opens the dashboard); the chart titled with the view's dashboard title; the note (i)
//   footer   Back; Next previews the next question; the last screen ends on "Here's what you found"
//
// Mid (C18): the root draws Light (the plates are white) and the header is a dark band of its own; the
// screen sits on the part's colour. Dark and Light draw the theme's own.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { pickMembership, resolveViewAs, resolvePeek } from "@/lib/view-as";
import { dataviewById, DATAVIEWS } from "@/catalogue/dataviews";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import { PHASE_LABELS } from "@/lib/teacher-view-phases";
import { fillTemplate, screenMeta, walkById, walksFor, type Walk } from "@/lib/front-door/walks";
import type { TeacherModel } from "@/lib/front-door/teacher-model";
import { teacherScreens, type Screen } from "@/lib/front-door/teacher-screens";
import { palette, WalkChart } from "./charts";
import { RailGlyph, WalkGlyph, walkHref } from "./home";
import { RoleWalk } from "./role-walks";

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

// ------------------------------------------------------------------------------------------------ the frame

export function WalkFrame({ walk, step, steps, chip, children }: { walk: Walk; step: number; steps: number; chip: string | null; children: ReactNode }) {
  const [pref] = useThemePref();
  const theme = effectiveTheme(pref);
  const mid = pref === "mid";
  const accent = walk.product === "gcse" || walk.product === "post16" ? PHASE_ACCENT[walk.product === "gcse" ? "ks4" : "ks5"]! : (ROLE_WALK_ACCENT[walk.product]?.[mid || theme === "light" ? "light" : "dark"] ?? null);
  const style = (accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) as CSSProperties;
  return (
    <main id="teacher-root" data-theme={mid ? "light" : theme} data-pref={pref} data-walk={walk.id} className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]" style={style}>
      <WalkHeader walk={walk} step={step} steps={steps} chip={chip} band={mid || theme === "dark" ? "dark" : "light"} />
      <section data-field={FIELD[walk.product]} className="flex-grow px-4 py-8 sm:px-10">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6">{children}</div>
      </section>
    </main>
  );
}

/**
 * The walk's header band: close, the walk's icon and question, step dots, the subject·phase chip, "Step n
 * of N". Its colours are its own tokens (globals.css, [data-walk-head]), set on the band itself, so in Mid
 * -- a dark band over a Light page -- nothing inherits the page's dark text (Guy, 13 Nov: dark grey on
 * black). Every pair is in the contrast table (R-THEME-CONTRAST).
 */
export function WalkHeader({ walk, step, steps, chip, band }: { walk: Walk; step: number; steps: number; chip: string | null; band: "dark" | "light" }) {
  return (
    <header data-walk-head={band} data-part={FIELD[walk.product]} data-theme={band === "dark" ? "dark" : undefined} className="border-b border-[var(--wh-border)] bg-[var(--wh-bg)] text-[var(--wh-fg)]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <ViewAsBanner />
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href={homeOf(walk)} aria-label="Close the walk" className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wh-muted)] hover:text-[var(--wh-fg)]">{CLOSE}</Link>
        <span data-walk-head-icon="" className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--wh-tint)] text-[var(--wh-accent)]">
          <WalkGlyph icon={walk.icon} size={17} />
        </span>
        <span className="min-w-0 flex-grow text-[15px] font-medium text-[var(--wh-fg)]">{fillTemplate(walk.question, { subject: chip?.split(" · ")[0] ?? null })}</span>
        <ol className="hidden items-center gap-1.5 sm:flex" aria-label="Steps">
          {Array.from({ length: steps }, (_, i) => (
            <li key={i} aria-current={i === step ? "step" : undefined} className={`h-1.5 rounded-full ${i === step ? "w-6 bg-[var(--wh-accent)]" : "w-1.5 bg-[var(--wh-dot)]"}`} />
          ))}
        </ol>
        {chip && <span data-walk-head-chip="" className="rounded-full border border-[var(--wh-accent)] px-3 py-1 text-[13px] font-medium text-[var(--wh-accent)]">{chip}</span>}
        <span className="text-[13px] text-[var(--wh-muted)]">{step < steps ? `Step ${step + 1} of ${steps}` : "Done"}</span>
      </div>
    </header>
  );
}

function homeOf(walk: Walk): string {
  if (walk.product === "group") return "/teacher/group";
  return "/teacher";
}

/** The mini-map: the dashboard's 3x2 grid, column icons above, this panel lit; Show me opens the dashboard. */
export function MiniMap({ cols, spot, name, href }: { cols: string[]; spot: { col: number; row: number }; name: string; href: string }) {
  return (
    <aside data-mini-map="" className="fd-tile w-full max-w-[220px] shrink-0 rounded-[12px] p-3">
      <div className="flex items-center justify-between text-[11.5px] text-[var(--muted)]">
        On the dashboard
        <Link href={href} className="font-semibold text-[var(--tile-accent-text,var(--fg))]">Show me &#8599;</Link>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-[var(--fg)]">{name}</p>
      <div className="mt-2 grid grid-cols-[3.2rem_repeat(3,1fr)] items-center gap-1 text-[10.5px] text-[var(--muted)]">
        <span />
        {cols.map((c, i) => (
          <span key={i} className="flex justify-center"><WalkGlyph icon={c} size={12} /></span>
        ))}
        {["Current", "Trends"].map((r, ri) => (
          <RowCells key={r} label={r} lit={spot.row === ri ? spot.col : -1} />
        ))}
      </div>
    </aside>
  );
}
function RowCells({ label, lit }: { label: string; lit: number }) {
  return (
    <>
      <span>{label}</span>
      {[0, 1, 2].map((c) => (
        <span key={c} data-lit={c === lit ? "" : undefined} className={`h-4 rounded-[4px] ${c === lit ? "bg-[var(--tile-accent,var(--accent))]" : "bg-[var(--box-bg)] ring-1 ring-[var(--panel-border)]"}`} />
      ))}
    </>
  );
}

/** The panel: the dashboard's own panel, enlarged. */
export function WalkPanel({ icon, name, question, pills, tag, rail, title, note, controls, children }: { icon: string; name: string; question: string; pills: string[]; tag: string; rail: ReactNode; title: string; note: string; controls?: ReactNode; children: ReactNode }) {
  return (
    <div data-walk-panel="" className="overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.3)]">
      <div className="h-[3px] bg-[var(--accent,var(--tile-accent))]" />
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--panel-border)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[rgba(var(--accent-rgb,138,138,144),0.16)] text-[var(--accent,var(--fg))]"><WalkGlyph icon={icon} size={17} /></span>
        <p className="min-w-0 flex-grow text-[15px]"><strong>{name}</strong> <span className="text-[var(--muted)]">— {question}</span></p>
        {pills.map((p) => (
          <span key={p} data-walk-pill="" className="rounded-full border border-[var(--panel-border2)] px-2.5 py-0.5 text-[12px] text-[var(--muted2)]">{p}</span>
        ))}
        {controls && <span data-walk-controls="" className="flex flex-wrap items-center gap-2">{controls}</span>}
        <span className="rounded-[6px] bg-[var(--box-bg)] px-2 py-0.5 text-[12px] text-[var(--muted2)]">{tag}</span>
      </div>
      <div className="grid md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Views" className="flex flex-col gap-1 border-b border-[var(--panel-border)] p-3 md:border-b-0 md:border-r">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Views</p>
          {rail}
          <p className="mt-auto hidden px-2 pt-6 text-[11px] text-[var(--muted)] md:block">The same views, in the same order, as this panel&rsquo;s rail on the dashboard.</p>
        </nav>
        <div className="min-w-0 p-4 sm:p-5">
          <h3 className="mb-3 text-[14px] font-semibold">{title}</h3>
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

/** The panel's rail: the views on this panel's rail on the dashboard (lit = this one), then "As a table". */
export function Rail({ view, asTable, onTable, dashboard }: { view: string; asTable: boolean; onTable: (on: boolean) => void; dashboard: string }) {
  const dv = dataviewById(view);
  const views = dv ? DATAVIEWS.filter((d) => d.host.id === dv.host.id && d.host.panel === dv.host.panel && (d.status === "live" || d.id === view) && d.renderer !== "RD-YEAR-TABLE" && d.renderer !== "RD-SORT-TABLE") : [];
  const row = (on: boolean, icon: string, label: string) => (
    <span className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] ${on ? "bg-[rgba(var(--accent-rgb,138,138,144),0.16)] font-semibold text-[var(--fg)]" : "text-[var(--muted2)] hover:text-[var(--fg)]"}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-[6px] ${on ? "bg-[var(--accent,var(--fg))] text-[var(--bg)]" : ""}`}><RailGlyph name={icon} size={13} /></span>
      {label}
    </span>
  );
  return (
    <ul className="flex flex-col gap-0.5" data-walk-rail="">
      {(views.length ? views : dv ? [dv] : []).map((d) =>
        d.id === view ? (
          <li key={d.id}>
            <button type="button" className="w-full text-left" onClick={() => onTable(false)} aria-pressed={!asTable}>{row(!asTable, d.railIcon, d.label)}</button>
          </li>
        ) : (
          <li key={d.id}>
            <Link href={dashboard} title={`Opens the dashboard at this panel: ${d.label}`}>{row(false, d.railIcon, d.label)}</Link>
          </li>
        ),
      )}
      <li>
        <button type="button" className="w-full text-left" onClick={() => onTable(true)} aria-pressed={asTable}>{row(asTable, "TableIcon", "As a table")}</button>
      </li>
    </ul>
  );
}

/** Back, and Next previewing the next question (or "Here's what you found"). */
export function WalkFooter({ onBack, onNext, backLabel, next }: { onBack: () => void; onNext: () => void; backLabel: string; next: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <button type="button" onClick={onBack} className="fd-tile inline-flex items-center gap-2 rounded-[12px] px-4 py-3 text-[15px] text-[var(--fg)]">{ARROW_L} {backLabel}</button>
      <button type="button" onClick={onNext} data-walk-next="" className="flex min-w-0 max-w-full items-center gap-4 rounded-[14px] bg-[var(--tile-accent,var(--accent))] px-5 py-3 text-left text-[var(--tile-on-accent,#0a0a0b)]">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">Next</span>
          <span className="block text-[15.5px] font-semibold">{next}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/10">{ARROW_R}</span>
      </button>
    </div>
  );
}

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

const TEACHER_COLS = (screenView: string) => [screenView.includes("-RES-") ? "results" : "candidates", "context", "rankings"];
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
  if (model === null) return <WalkFrame walk={walk} step={0} steps={n} chip={null}><p className="text-[15px] text-[var(--field-ink)]">Loading…</p></WalkFrame>;
  if (model === "error") return <WalkFrame walk={walk} step={0} steps={n} chip={null}><p className="text-[15px] text-[var(--field-ink)]">This walk couldn&rsquo;t load your school&rsquo;s figures. <Link className="underline" href="/teacher">Back to your home</Link>.</p></WalkFrame>;
  const params = { subject: model.focus?.key ?? null };
  if (step >= n) return <WalkFrame walk={walk} step={n} steps={n} chip={chip}><Found walk={walk} screens={screens} params={params} ctx={{ subject: model.focus?.subject ?? null, category: model.category.label }} onBack={() => setStep(n - 1)} /></WalkFrame>;
  const s = walk.screens[step];
  const sc = screens[step];
  const col = columnOf(s.view);
  const pills = [
    ...(s.options?.against === "category" && col === "context" ? ["Compared against: Subject category"] : []),
    ...(s.options?.against === "whole" ? ["Compared against: Whole school"] : []),
    ...(s.options?.measure === "points" ? ["Results measure: Average points"] : []),
  ];
  const colQuestion: Record<string, string> = {
    candidates: `How many ${phase === "ks5" ? "students" : "pupils"} take ${model.focus?.subject ?? "your subject"}?`,
    results: `How well do they do in ${model.focus?.subject ?? "your subject"}?`,
    context: `How does ${model.focus?.subject ?? "your subject"} sit alongside the rest of the school?`,
    rankings: phase === "ks5" ? "How do we compare with sixth forms nearby?" : "How do we compare with schools nearby?",
  };
  const next = step + 1 < n ? screens[step + 1].question : "Here's what you found";
  return (
    <WalkFrame walk={walk} step={step} steps={n} chip={chip}>
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex flex-col gap-2">
          <h1 data-walk-question="" className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[var(--field-ink)] sm:text-[36px]">{sc.question}</h1>
          <p data-walk-answer="" className="text-[17px] leading-relaxed text-[var(--field-ink)] sm:text-[19px]">{sc.answer}</p>
        </div>
        <MiniMap cols={TEACHER_COLS(s.view)} spot={s.spot} name={`${PHASE_LABELS[phase]} ${COLUMN_NAME[col]}`} href={walk.dashboard} />
      </div>
      <WalkPanel icon={col} name={COLUMN_NAME[col]} question={colQuestion[col]} pills={pills} tag={sc.tag} title={sc.title} note={sc.note} rail={<Rail view={s.view} asTable={asTable} onTable={setAsTable} dashboard={walk.dashboard} />}>
        <WalkChart chart={sc.chart} p={pal} asTable={asTable} />
      </WalkPanel>
      <WalkFooter onBack={() => (step === 0 ? router.push("/teacher") : (setAsTable(false), setStep(step - 1)))} backLabel={step === 0 ? "Questions" : "Back"} onNext={() => { setAsTable(false); setStep(step + 1); }} next={next} />
    </WalkFrame>
  );
}

/** "Here's what you found": every answer with where it lives, then the other questions and the dashboard. */
export function Found({ walk, screens, params, ctx, onBack }: { walk: Walk; screens: { question: string; answer: string }[]; params: Record<string, string | null>; ctx: { subject?: string | null; category?: string | null; entry?: string | null }; onBack: () => void }) {
  const others = walksFor(walk.product).filter((w) => w.id !== walk.id && w.screens.length);
  return (
    <div className="flex flex-col gap-6" data-walk-found="">
      <h1 className="text-[30px] font-semibold leading-tight text-[var(--field-ink)] sm:text-[38px]">Here&rsquo;s what you found</h1>
      <ol className="flex flex-col gap-3">
        {walk.screens.map((s, i) => {
          const meta = screenMeta(s.view);
          return (
            <li key={i} className="fd-tile flex items-start gap-3 rounded-[14px] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tile-tint)] text-[var(--tile-accent-text)]"><RailGlyph name={meta?.icon ?? "TilesIcon"} /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[var(--fg)]">{screens[i]?.question}</span>
                <span className="mt-0.5 block text-[14px] text-[var(--muted2)]">{screens[i]?.answer}</span>
                <span className="mt-1 block text-[12px] text-[var(--muted)]">On the dashboard: {meta?.label ?? s.view}, {s.spot.row === 0 ? "Current" : "Trends"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        {others.map((w) => (
          <Link key={w.id} href={walkHref(w, params)} className="fd-tile inline-flex items-center gap-2 rounded-[12px] px-4 py-3 text-[14.5px] font-medium text-[var(--fg)]">
            <WalkGlyph icon={w.icon} size={16} /> {fillTemplate(w.question, ctx)}
          </Link>
        ))}
        <Link href={walk.dashboard} className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--tile-accent,var(--accent))] px-4 py-3 text-[14.5px] font-semibold text-[var(--tile-on-accent,#0a0a0b)]">Open the full dashboard {ARROW_R}</Link>
      </div>
      <div>
        <button type="button" onClick={onBack} className="fd-tile inline-flex items-center gap-2 rounded-[12px] px-4 py-3 text-[15px] text-[var(--fg)]">{ARROW_L} Back</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ entry

export function WalkPage({ walkId }: { walkId: string }) {
  const walk = walkById(walkId);
  if (!walk) return <main className="mx-auto max-w-3xl p-6 text-sm">There&rsquo;s no walk called &ldquo;{walkId}&rdquo;. <Link href="/teacher" className="underline">Back to your home</Link>.</main>;
  if (walk.product === "gcse" || walk.product === "post16") return <TeacherWalk walk={walk} />;
  return <RoleWalk walk={walk} />;
}
