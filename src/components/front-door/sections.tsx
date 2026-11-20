"use client";

// VicData 0.8 front door (B8, B9): each role's section of the home -- Teacher (one per phase), SMT (and a
// primary school's SMT), Admissions. Every figure is real (the dashboards' own rows and routes) or absent;
// never a placeholder number. Head office's home is GroupHome.tsx.
import { getJson as admissionsGet } from "@/components/admissions/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchPreferences } from "@/lib/teacher-view-data";
import { PHASE_ACCENT, ROLE_ACCENT, ROLE_ACCENT_LIGHT } from "@/lib/teacher-view-theme";
import { PHASE_LABELS, type TeacherPhase } from "@/lib/teacher-view-phases";
import { teacherTileFigures, type TeacherModel } from "@/lib/front-door/teacher-model";
import { fillTemplate, walksFor, type Walk } from "@/lib/front-door/walks";
import { useSmt, type Overview, type SmtSchool } from "@/components/smt/api";
import { loadSmtMember, type SmtMember } from "@/components/smt/member";
import { useSmtSet } from "@/components/smt/useSmtSet";
import { LEVEL_LABEL, setPhaseOf, smtLevelKey } from "@/lib/smt/levels";
import type { Pupils } from "@/lib/smt/pupils";
import { Spinner } from "@/components/shell/LoadingGraphic";
import { periodLabel } from "@/catalogue/years";
import { entryPoint } from "@/lib/admissions/entry-points";
import { setFitsPage, type SetKind, type StoredSet } from "@/lib/sets/model";
import { guidedHref } from "@/lib/sets/guided";
import { HomeHeading, HomeSection, NoWalkTile, QuestionTile, walkHref, type TileFigure } from "./home";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { SmtSetsPanel } from "./smt-sets-panel";
import { SchoolGroupTile } from "@/components/groups/SchoolGroupTile";
import { smtContextFigure, smtContextUrl } from "@/lib/front-door/tile-figures";
import type { Context } from "@/lib/smt/context";
import { useLateTileFigure } from "./late-figure";
import { schoolEntries } from "./entry-default";

async function token(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const t = await token();
  if (!t) return null;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
  return res && res.ok ? ((await res.json()) as T) : null;
}

const pick = (on: boolean, cls: string) => (on ? cls : "");

// ------------------------------------------------------------------------------------------------ Teacher

/** A subject switcher on a field: a white pill, as the boards draw "Subject Geography ⌄". */
function SubjectSwitch({ subjects, value, onChange }: { subjects: { key: string; label: string }[]; value: string | null; onChange: (k: string) => void }) {
  const current = subjects.find((s) => s.key === value);
  if (subjects.length <= 1)
    return current ? (
      <span className="rounded-full bg-[var(--field-chip-bg)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)]">
        Subject <strong className="font-semibold">{current.label}</strong>
      </span>
    ) : null;
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full bg-[var(--field-chip-bg)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)]">
      Subject
      <select data-subject-switch="" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="min-h-[44px] max-w-[16rem] bg-transparent font-semibold text-[var(--field-chip-fg)] outline-none sm:min-h-0">
        {subjects.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Where the home remembers the subject picked on it, per school and phase (this browser only). */
const HOME_SUBJECT_KEY = (urn: string, phase: string) => `vicdata.teacher.homeSubject:${urn}:${phase}`;

/**
 * 0.8 feedback B6 (Teacher 1). The tiles said "Coming" whenever the home's figures hadn't arrived -- while
 * they loaded, and for good when the request failed -- and the home never asked for a subject when none was
 * set (it silently took the school's first). Now:
 *   - every tile starts its walk at once (the walk loads its own figures), never "Coming";
 *   - with no subject set (no ticked subjects, nothing picked here), the home asks: "Which subject do you
 *     teach?", a picker over the school's subjects; the pick is remembered in this browser;
 *   - a failed load says so, with its code and a Try again, and the questions still open.
 */
export function TeacherPhaseSection({ urn, phase, heading }: { urn: string; phase: "ks4" | "ks5"; heading?: React.ReactNode }) {
  const [ticked, setTicked] = useState<string[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [picked, setPicked] = useState<boolean>(false);
  const [tries, setTries] = useState(0);
  const [model, setModel] = useState<{ key: string; m: TeacherModel | null; code: number } | null>(null);
  useEffect(() => {
    let live = true;
    try {
      const saved = window.localStorage.getItem(HOME_SUBJECT_KEY(urn, phase));
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFocus(saved);
        setPicked(true);
      }
    } catch {
      // Blocked storage: nothing remembered.
    }
    void fetchPreferences(createBrowserSupabaseClient(), urn, phase)
      .then((p) => live && setTicked(p.subjects))
      .catch(() => live && setTicked([]));
    return () => {
      live = false;
    };
  }, [urn, phase]);
  const ask = ticked === null ? null : `/api/front-door/teacher?urn=${urn}&phase=${phase}&ticked=${encodeURIComponent(ticked.join("|"))}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`;
  useEffect(() => {
    if (!ask) return;
    let live = true;
    (async () => {
      const t = await token();
      const res = t ? await fetch(ask, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null) : null;
      const m = res && res.ok ? ((await res.json()) as TeacherModel) : null;
      if (!m) console.error(`[home] teacher ${phase}: ${res ? `HTTP ${res.status}` : "no answer"}`);
      if (live) setModel({ key: `${ask}#${tries}`, m, code: res?.status ?? 0 });
    })();
    return () => {
      live = false;
    };
  }, [ask, tries, phase]);
  const current = model?.key === `${ask}#${tries}` ? model : null;
  const m = current?.m ?? null;
  const failed = !!current && !current.m;
  const loading = !current;
  const walks = walksFor(phase === "ks4" ? "gcse" : "post16");
  const figures = m ? teacherTileFigures(m) : { many: null, well: null, nearby: null };
  // The switcher lists the subjects the teacher teaches (their ticked ones); with none ticked, every subject.
  const subjects = useMemo(() => {
    const all = m?.subjects ?? [];
    const mine = all.filter((s) => (ticked ?? []).includes(s.key));
    return mine.length ? mine : all;
  }, [m, ticked]);
  const noneSet = ticked !== null && ticked.length === 0 && !picked;
  const choose = (k: string) => {
    setFocus(k);
    setPicked(true);
    try {
      window.localStorage.setItem(HOME_SUBJECT_KEY(urn, phase), k);
    } catch {
      // Blocked storage: the pick holds for this visit.
    }
  };
  const ctx = { subject: m?.focus?.subject ?? null, category: m?.category.label ?? null };
  const fig: Record<string, TileFigure> = { [`${phase === "ks4" ? "gcse" : "post16"}-many`]: figures.many, [`${phase === "ks4" ? "gcse" : "post16"}-well`]: figures.well, [`${phase === "ks4" ? "gcse" : "post16"}-nearby`]: figures.nearby };
  // The walk opens on the subject shown here; with none yet, the walk picks the school's first itself.
  const params = { subject: m?.focus?.key ?? focus };
  const label = PHASE_LABELS[phase];
  const ph = phase === "ks5" ? "students" : "pupils";
  const picker =
    noneSet && m && m.subjects.length > 0 ? (
      <div data-subject-ask="" className="fd-tile flex flex-wrap items-center gap-3 rounded-[14px] px-5 py-4 text-[var(--fg)]">
        <span className="min-w-0 flex-grow basis-[240px]">
          <span className="block text-[15.5px] font-semibold">Which subject do you teach?</span>
          <span className="block text-[13px] text-[var(--muted2)]">The questions below follow it. Showing {m.focus?.subject ?? "the school's first subject"} until you pick.</span>
        </span>
        <select data-subject-pick="" aria-label="Your subject" value="" onChange={(e) => e.target.value && choose(e.target.value)} className="min-h-[44px] max-w-full rounded-[10px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 text-[14px] font-semibold text-[var(--fg)]">
          <option value="">Pick a subject…</option>
          {[...m.subjects].sort((a, b) => a.label.localeCompare(b.label)).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <Link href={`/teacher/setup?phase=${phase}`} className="inline-flex min-h-[44px] items-center px-1 text-[13px] text-[var(--muted2)] hover:text-[var(--fg)]">Set your subjects for good &rarr;</Link>
      </div>
    ) : null;
  return (
    <HomeSection
      field={phase === "ks4" ? "gcse" : "post16"}
      accent={PHASE_ACCENT[phase]}
      chip={label}
      heading={heading}
      controls={
        loading ? (
          <span data-subject-loading="" className="inline-flex items-center gap-2 rounded-full bg-[var(--field-chip-bg)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)]"><Spinner size={14} /> Loading your subjects…</span>
        ) : noneSet ? null : (
          <SubjectSwitch subjects={subjects} value={m?.focus?.key ?? null} onChange={choose} />
        )
      }
      dashboard={{ label: `Open the full ${label} dashboard`, href: `/teacher/${phase}` }}
      cols={3}
      lead={picker}
      links={walks.map((w) => ({ label: fillTemplate(w.question, ctx), href: walkHref(w, params) }))}
      tiles={walks.map((w) => (
        <QuestionTile key={w.id} walk={w} figure={fig[w.id] ?? null} ctx={ctx} href={walkHref(w, params)} loading={loading} />
      ))}
      note={
        failed ? (
          <span data-home-failed={current?.code ?? 0} className="flex flex-wrap items-center gap-2">
            Your {label} figures didn&rsquo;t load{current?.code ? ` (error ${current.code})` : ""}. The questions still open: each walk loads its own.
            <button type="button" onClick={() => setTries((n) => n + 1)} className="min-h-[44px] font-semibold underline sm:min-h-0">Try again</button>
          </span>
        ) : m && !m.focus ? (
          `No subject results are published for this school at this phase yet. The ${ph}' figures appear here once DfE publishes them.`
        ) : null
      }
    />
  );
}

/** KS2: the teacher view's own dashboard, with no walks yet (logged). */
export function TeacherKs2Section() {
  return (
    <HomeSection field="top" accent={null} chip={PHASE_LABELS.ks2} dashboard={{ label: "Open the full Key stage 2 dashboard", href: "/teacher/ks2" }} cols={3} links={[]} tiles={[]} note="Walkthroughs for Key stage 2 come in a later round." />
  );
}

// ------------------------------------------------------------------------------------------------ sets

type LibraryLite = { stored: Pick<StoredSet, "kind" | "entryPoint" | "phase" | "ownerScope" | "isDefault" | "archived" | "members">[]; defaults: unknown[] };

/** The school set a guided question opens on (the default set of the kind for the page, else its first). */
function schoolSetFor(lib: LibraryLite, kind: SetKind, page: { entryPoint?: string | null; phase?: "ks4" | "ks5" | null }) {
  const fit = lib.stored.filter((s) => s.ownerScope === "school" && !s.archived && setFitsPage(s, { kind, ...page }));
  return fit.find((s) => s.isDefault) ?? fit[0] ?? null;
}

/**
 * D21: the sets card on the SMT and Admissions homes -- the school's sets with their real counts (the sets
 * library route's own answer), opening the guided editor (0.8 front door part 2): Admissions "18 feeders ·
 * 9 rivals at 11+ — Who feeds us, and who do we compete with?", one button per question; SMT "4 comparison
 * sets — Who do we measure ourselves against?". "All sets" keeps the round-1 library for power users.
 */
export function SetsCard({ urn, role = "admissions", entry = null }: { urn: string; role?: "admissions" | "smt"; entry?: string | null }) {
  const [lib, setLib] = useState<LibraryLite | null | "none">(null);
  useEffect(() => {
    let live = true;
    void getJson<LibraryLite>(`/api/sets/library?urn=${urn}`).then((d) => live && setLib(d ?? "none"));
    return () => {
      live = false;
    };
  }, [urn]);
  if (lib === "none") return null;
  const e = entry ?? "11+";
  const pill = "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--panel-border2)] px-4 text-[13.5px] font-semibold text-[var(--fg)] hover:border-[var(--tile-accent-text,var(--accent))]";
  const icon = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="3" /><circle cx="17" cy="7" r="3" /><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" /></svg>
    </span>
  );
  let figure: string;
  let question: string;
  let buttons: { label: string; href: string }[];
  if (role === "smt") {
    const n = lib ? lib.stored.filter((s) => s.kind === "compared_against" && !s.archived && s.ownerScope === "school").length : null;
    figure = n === null ? "Comparison sets" : `${n} comparison ${n === 1 ? "set" : "sets"}`;
    question = "Who do we measure ourselves against?";
    buttons = [{ label: "Choose our comparison schools", href: guidedHref({ urn, kind: "compared_against", product: "smt", phase: "ks4", fromHome: true }) }];
  } else {
    const feeders = lib ? schoolSetFor(lib, "feeders", { entryPoint: e }) : null;
    const rivals = lib ? schoolSetFor(lib, "compared_against", { entryPoint: e }) : null;
    figure = lib ? `${feeders?.members.length ?? 0} feeders · ${rivals?.members.length ?? 0} rivals at ${e}` : `Feeders and rivals at ${e}`;
    question = "Who feeds us, and who do we compete with?";
    buttons = [
      { label: "Who feeds us?", href: guidedHref({ urn, kind: "feeders", product: "admissions", entry: e, fromHome: true }) },
      { label: "Who do we compete with?", href: guidedHref({ urn, kind: "compared_against", product: "admissions", entry: e, fromHome: true }) },
    ];
  }
  return (
    <div data-sets-card={role} className="fd-tile flex flex-wrap items-center gap-4 rounded-[14px] px-5 py-4 text-[var(--fg)]">
      {icon}
      <span className="min-w-0 flex-grow basis-[220px]">
        <span className="block text-[15.5px] font-semibold">{figure}</span>
        <span className="block text-[13px] text-[var(--muted2)]">{question}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {buttons.map((b) => (
          <Link key={b.href} href={b.href} className={pill}>
            {b.label} <span aria-hidden="true">&rarr;</span>
          </Link>
        ))}
        <Link href="/sets" className="inline-flex min-h-[44px] items-center px-2 text-[13px] text-[var(--muted2)] hover:text-[var(--fg)]">
          All sets
        </Link>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ SMT

/** 0.8 feedback B5 (SMT 2, SMT 14): the phase the SMT home's pills pick -- the dashboards' level, one choice
 * for both (smtLevelKey); a primary school has none. */
export type SmtHomeLevel = "whole" | "gcse" | "post16";

/** The tiles' figures at a level. Overview is the whole school at any level, as on the dashboard; Academic
 * takes the level's headline; Pupils the level's roll (its phase line), from the Pupils answer. */
export function smtFigures(o: Overview | null, primary: boolean, level: SmtHomeLevel = "whole", p: Pupils | null = null): Record<string, TileFigure> {
  if (!o) return {};
  const out: Record<string, TileFigure> = {};
  const pre = primary ? "smt_primary" : "smt";
  if (o.now.roll !== null) {
    const ch = o.now.changePct;
    const dir = ch === null ? "" : Math.abs(ch) < 0.5 ? ", level" : `, ${ch > 0 ? "up" : "down"} ${Math.abs(ch).toFixed(0)}% since ${periodLabel(o.now.base.period)}`;
    out[`${pre}-overview`] = { figure: o.now.roll.toLocaleString("en-GB"), unit: `pupils${dir}` };
  }
  const want = level === "gcse" ? ["ks4"] : level === "post16" ? ["ks5"] : ["ks4", "ks5"];
  const head = want.map((st) => o.rows.find((r) => r.stage === st && r.unit === "points" && r.value !== null)).find(Boolean);
  if (!primary && head?.value != null) out[`${pre}-academic`] = { figure: head.value.toFixed(1), unit: head.label };
  const line = level === "whole" ? o.trends.roll.lines[0] : (p?.trends.phases ?? []).find((l) => (level === "gcse" ? /secondary|senior/i : /sixth/i).test(`${l.key} ${l.label}`));
  const act = ((line as { actual?: { value: number | null }[] } | undefined)?.actual ?? []).filter((x) => x.value !== null);
  if (act.length >= 2) {
    const d = (act[act.length - 1].value as number) - (act[act.length - 2].value as number);
    out[`${pre}-pupils`] = { figure: `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(Math.round(d)).toLocaleString("en-GB")}`, unit: level === "whole" ? "pupils on last year" : `${LEVEL_LABEL[level]} pupils on last year` };
  }
  return out;
}

/** The walk's address at a level: Overview is the whole school; the others carry the level. */
export function smtWalkHref(w: Walk, level: SmtHomeLevel): string {
  return walkHref(w, level !== "whole" && !w.id.endsWith("-overview") ? { level } : {});
}

/** Leighton Park prep (20 Nov): the SMT home's tabs -- Whole school, Admissions, GCSE, Post-16. Admissions is
 * the home's own tab, not a dashboard level, so it is remembered apart from the level (smtLevelKey). */
export type SmtHomeTab = SmtHomeLevel | "admissions";
const SMT_HOME_TAB_KEY = (urn: string) => `vicdata.smt.homeTab:${urn}`;

function readHomeTab(urn: string): SmtHomeTab {
  try {
    if (window.localStorage.getItem(SMT_HOME_TAB_KEY(urn)) === "admissions") return "admissions";
  } catch {
    // Blocked storage: the level below.
  }
  return readHomeLevel(urn);
}

function readHomeLevel(urn: string): SmtHomeLevel {
  try {
    const l = new URLSearchParams(window.localStorage.getItem(smtLevelKey(urn)) ?? "").get("level");
    return l === "gcse" || l === "post16" ? l : "whole";
  } catch {
    return "whole";
  }
}

/** The line under a primary school's SMT heading (the board's wording). */
export const PRIMARY_SMT_SUBLINE = "How the school is doing, who is joining, and how many young children live nearby. Each question walks you through a few screens.";

function SmtInner({ member, heading }: { member: SmtMember; heading?: React.ReactNode }) {
  const [pref] = useThemePref();
  const school = useSmt<SmtSchool>(`/api/smt/school?urn=${member.schoolUrn}`, null);
  const s = school.status === "ready" ? school.data : null;
  const sets = useSmtSet(member.schoolUrn, s ? setPhaseOf(s.phases) : null);
  const o = useSmt<Overview>(s && sets.set ? "/api/smt/overview" : null, sets.set ? { urn: member.schoolUrn, set: sets.set } : null);
  const primary = !!s && s.phases.primary && !s.phases.gcse && !s.phases.post16;
  // B5 (SMT 2, 14): the pills switch the home's phase -- the tiles' figures and the walks -- as the
  // dashboards' level does, and remember it for them (smtLevelKey).
  const [picked, setPicked] = useState<SmtHomeTab | null>(null);
  useEffect(() => {
    // After the first draw (the server draws the whole school), the tab remembered for this school.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked((x) => x ?? readHomeTab(member.schoolUrn));
  }, [member.schoolUrn]);
  const want = picked ?? "whole";
  const tab: SmtHomeTab = !s || primary || (want === "gcse" && !s.phases.gcse) || (want === "post16" && !s.phases.post16) ? "whole" : want;
  // The SMT questions' level: the Admissions tab leaves it as the dashboards last had it (whole school here).
  const level: SmtHomeLevel = tab === "admissions" ? "whole" : tab;
  const pickLevel = (l: SmtHomeTab) => {
    setPicked(l);
    try {
      window.localStorage.setItem(SMT_HOME_TAB_KEY(member.schoolUrn), l === "admissions" ? "admissions" : "");
      if (l !== "admissions") window.localStorage.setItem(smtLevelKey(member.schoolUrn), l === "whole" ? "" : new URLSearchParams({ level: l }).toString());
    } catch {
      // Blocked storage: the pick holds for this visit.
    }
  };
  const p = useSmt<Pupils>(s && sets.set && level !== "whole" ? "/api/smt/pupils" : null, sets.set ? { urn: member.schoolUrn, set: sets.set, level: "whole" } : null);
  const walks = walksFor(primary ? "smt_primary" : "smt");
  const figures = smtFigures(o.status === "ready" ? o.data : null, primary, level, p.status === "ready" ? p.data : null);
  const loading = o.status === "loading" || (level !== "whole" && p.status === "loading");
  // Front door 2b (M1): Context's figure, fetched late through its walk's own read (the area read), once the
  // home's own reads have settled; cached for the session. No figure until it arrives, and none on an error.
  const contextId = `${primary ? "smt_primary" : "smt"}-context`;
  const contextFigure = useLateTileFigure<Context>(s ? smtContextUrl(member.schoolUrn, level) : null, !!s && !loading, smtContextFigure);
  // Each tab in its own colour: SMT orange, Admissions blue, the GCSE and Post-16 phase colours.
  const accent = tab === "admissions" ? ROLE_ACCENT.admissions : tab === "gcse" ? PHASE_ACCENT.ks4 : tab === "post16" ? PHASE_ACCENT.ks5 : pref === "light" ? ROLE_ACCENT_LIGHT.smt : ROLE_ACCENT.smt;
  const field = tab === "admissions" ? "admissions" : tab === "gcse" ? "gcse" : tab === "post16" ? "post16" : "top";
  const chips: { key: SmtHomeTab | "ks2"; label: string }[] = s ? (primary ? [{ key: "ks2", label: "Key stage 2" }] : [{ key: "whole", label: "Whole school" }, { key: "admissions", label: "Admissions" }, ...(s.phases.gcse ? [{ key: "gcse" as const, label: "GCSE" }] : []), ...(s.phases.post16 ? [{ key: "post16" as const, label: "Post-16" }] : [])]) : [];
  const levelPill = "rounded-full border border-[var(--field-chip-border)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)]";
  const tabs =
    chips.length > 1 ? (
      <span role="group" aria-label="Phase" className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.key} type="button" data-smt-level={c.key} aria-pressed={tab === c.key} onClick={() => pickLevel(c.key as SmtHomeTab)} className={`min-h-[44px] sm:min-h-0 ${levelPill} ${pick(tab === c.key, "bg-[var(--field-chip-bg)] font-semibold")} hover:bg-[var(--field-chip-bg)]`}>
            {c.label}
          </button>
        ))}
      </span>
    ) : (
      chips.map((c) => (
        <span key={c.key} className={`${levelPill} bg-[var(--field-chip-bg)] font-semibold`}>
          {c.label}
        </span>
      ))
    );
  // The Admissions tab: the Admissions home's questions (pool, market share) and its sets, under the SMT chip.
  if (tab === "admissions") return <AdmissionsSection urn={member.schoolUrn} heading={heading} chip="SMT" tabs={tabs} />;
  return (
    <HomeSection
      field={field}
      accent={accent}
      chip="SMT"
      // Crosscheck (14 Nov, home_primary_smt.png): a primary school's SMT home has its own line under the heading.
      heading={heading && primary ? <HomeHeading sub={PRIMARY_SMT_SUBLINE} onField /> : heading}
      controls={tabs}
      dashboard={{ label: "Open the full SMT dashboards", href: `/teacher/smt${level !== "whole" ? `?level=${level}` : ""}` }}
      cols={2}
      links={walks.map((w) => ({ label: w.question, href: w.screens.length ? smtWalkHref(w, level) : null }))}
      tiles={walks.map((w) =>
        w.screens.length ? (
          w.id === contextId ? (
            <QuestionTile key={w.id} walk={w} figure={contextFigure} ctx={{}} href={smtWalkHref(w, level)} late />
          ) : (
            <QuestionTile key={w.id} walk={w} figure={figures[w.id] ?? null} ctx={{}} href={smtWalkHref(w, level)} loading={loading} />
          )
        ) : (
          <NoWalkTile key={w.id} walk={w} why="Key stage 2 results by subject aren't in SMT Academic yet. The full SMT dashboards show what there is." />
        ),
      )}
      note={primary ? "KS2 tests did not run in 2019/20 or 2020/21, so those years show as gaps." : null}
    >
      {/* B5 (SMT 15): every subject the phase teaches, each opening its Teacher walks and dashboard -- on the GCSE
          and Post-16 tabs only (Leighton Park prep, 20 Nov: not on the whole school). */}
      {s && !primary && level !== "whole" && <OurSubjects urn={member.schoolUrn} phases={level === "gcse" ? ["ks4"] : ["ks5"]} />}
      {/* Leighton Park prep (20 Nov): the comparison set -- what it is for, the choices (the one in use ticked),
          who is in it, and the builder; then (0.8 groups r1) the school's group where its head office holds a group account. */}
      <SmtSetsPanel urn={member.schoolUrn} schoolName={s?.name ?? member.schoolName} school={s} phase={s ? setPhaseOf(s.phases) : null} sets={sets} o={o.status === "ready" ? o.data : null} readOnly={member.readOnly || !!member.viewAs} theme={pref === "mid" ? "light" : effectiveTheme(pref)} />
      <SchoolGroupTile urn={member.schoolUrn} />
    </HomeSection>
  );
}

type SubjectsLite = { subjects: TeacherModel["subjects"] };

/**
 * 0.8 feedback B5 (SMT 15): "Our subjects", built like head office's "Our schools": a card per subject the
 * school teaches, by phase (largest entries first), each opening that subject's three Teacher walks
 * (Candidates, Results, Comparisons) and its Teacher dashboard. The walks only read; the dashboard opens on
 * the subject for this visit (shown, not saved: ?subject=…&from=smt).
 */
export function OurSubjects({ urn, phases }: { urn: string; phases: ("ks4" | "ks5")[] }) {
  const [by, setBy] = useState<Partial<Record<"ks4" | "ks5", SubjectsLite | "error">>>({});
  const [all, setAll] = useState<Partial<Record<"ks4" | "ks5", boolean>>>({});
  useEffect(() => {
    let live = true;
    for (const ph of phases)
      void getJson<SubjectsLite>(`/api/front-door/teacher?urn=${urn}&phase=${ph}&lite=1`).then((m) => live && setBy((b) => ({ ...b, [ph]: m ?? "error" })));
    return () => {
      live = false;
    };
  }, [urn, phases.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!phases.length) return null;
  const SHOW = 9;
  return (
    <div data-our-subjects="" className="flex flex-col gap-3">
      <h2 className="text-[19px] font-semibold text-[var(--field-ink)]">
        Our subjects <span className="text-[14px] font-normal">Walk through any subject as its teachers see it.</span>
      </h2>
      {phases.map((ph) => {
        const d = by[ph];
        const product = ph === "ks4" ? "gcse" : "post16";
        const walks = walksFor(product);
        const subjects = d && d !== "error" ? [...d.subjects].sort((a, b) => b.entries - a.entries) : [];
        return (
          <div key={ph} className="flex flex-col gap-2" data-our-subjects-phase={ph}>
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--field-ink)]">{PHASE_LABELS[ph]}</p>
            {!d ? (
              <p className="flex items-center gap-2 text-[13px] text-[var(--field-ink)]"><Spinner size={16} /> Loading the subjects…</p>
            ) : d === "error" ? (
              <p className="text-[13px] text-[var(--field-ink)]">The subjects didn&rsquo;t load. The {PHASE_LABELS[ph]} dashboard lists them.</p>
            ) : !subjects.length ? (
              <p className="text-[13px] text-[var(--field-ink)]">No {PHASE_LABELS[ph]} subject results are published for this school yet.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" aria-label={`Our ${PHASE_LABELS[ph]} subjects`}>
                {subjects.slice(0, all[ph] ? undefined : SHOW).map((sub) => (
                  <li key={sub.key} data-our-subject={sub.key} className="fd-tile flex flex-col gap-2 rounded-[12px] px-3.5 py-3 text-[var(--fg)]">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{sub.subject}</span>
                      <span className="block text-[12.5px] text-[var(--muted2)]">{sub.qualLabel} · {sub.entries.toLocaleString("en-GB")} {sub.entries === 1 ? "entry" : "entries"}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {walks.map((w) => (
                        <Link key={w.id} href={walkHref(w, { subject: sub.key })} className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--tile-tint)] px-3 text-[12.5px] font-semibold text-[var(--tile-accent-text)] sm:min-h-[30px]">
                          {w.label.replace(" · Context", "")}
                        </Link>
                      ))}
                      <Link href={`/teacher/${ph}?subject=${encodeURIComponent(sub.key)}&from=smt`} className="inline-flex min-h-[44px] items-center rounded-full px-2 text-[12.5px] text-[var(--muted2)] hover:text-[var(--fg)] sm:min-h-[30px]">
                        Dashboard &rarr;
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {subjects.length > SHOW && (
              <button type="button" onClick={() => setAll((a) => ({ ...a, [ph]: !a[ph] }))} className="w-fit min-h-[44px] text-[13px] font-semibold text-[var(--field-ink)] underline sm:min-h-0">
                {all[ph] ? "Show fewer" : `Show all ${subjects.length}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SmtSection({ heading }: { heading?: React.ReactNode }) {
  const [member, setMember] = useState<SmtMember | null | "none">(null);
  useEffect(() => {
    loadSmtMember().then((m) => setMember(m.status === "ready" && m.member.access !== "none" ? m.member : "none"));
  }, []);
  if (member === "none") return null;
  if (!member) return <HomeSection field="top" accent={ROLE_ACCENT.smt} chip="SMT" heading={heading} dashboard={{ label: "Open the full SMT dashboards", href: "/teacher/smt" }} cols={2} links={[]} tiles={[]} />;
  return <SmtInner member={member} heading={heading} />;
}

// ------------------------------------------------------------------------------------------------ Admissions

type MarketLite = { summary?: { share: number | null; latest: number | null } };
type PipelineLite = { ladder?: { past: { entryYear: number; pool: number | null }[] }; now?: { cohort: number | null } };

/** The Admissions home's section. `chip` and `tabs`: the SMT home draws it as its Admissions tab (Leighton Park
 * prep, 20 Nov), under the SMT chip with the SMT tabs before the entry point. */
export function AdmissionsSection({ urn, heading, chip = "Admissions", tabs = null }: { urn: string; heading?: React.ReactNode; chip?: string; tabs?: React.ReactNode }) {
  const [entries, setEntries] = useState<string[] | null>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [fig, setFig] = useState<{ entry: string; pool: TileFigure; share: TileFigure } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const es = await schoolEntries(urn);
      if (live) setEntries(es);
    })();
    return () => {
      live = false;
    };
  }, [urn]);
  const current = entry ?? entries?.[0] ?? null;
  useEffect(() => {
    if (!current) return;
    let live = true;
    (async () => {
      const q = new URLSearchParams({ urn, entry: current }).toString();
      // 0.8 feedback A4: through the Admissions client cache (the same URLs), so both walks and the dashboard
      // open on these answers; and the market walk's rivals warmed (~15 s on a cold server cache).
      const viaCache = async <T,>(u: string): Promise<T | null> => {
        const l = await admissionsGet<T>(u);
        return l.status === "ready" ? l.data : null;
      };
      const [p, m] = await Promise.all([viaCache<PipelineLite>(`/api/admissions/pipeline?${q}`), viaCache<MarketLite>(`/api/admissions/market-share?${q}`)]);
      void admissionsGet(`/api/admissions/rivals?${q}`);
      const past = (p?.ladder?.past ?? []).filter((x) => x.pool !== null);
      const pool = past.length ? (past[past.length - 1].pool as number) : null;
      const label = entryPoint(current)?.label ?? current;
      if (live)
        setFig({
          entry: current,
          pool: pool !== null ? { figure: Math.round(pool).toLocaleString("en-GB"), unit: `children in the ${label} pool` } : null,
          share: m?.summary?.share != null ? { figure: `${m.summary.share.toFixed(1)}%`, unit: "of the intake: you and your rivals" } : null,
        });
    })();
    return () => {
      live = false;
    };
  }, [urn, current]);
  const walks = walksFor("admissions");
  const label = current ? entryPoint(current)?.label ?? current : null;
  const f = fig?.entry === current ? fig : null;
  const params = { entry: current };
  return (
    <HomeSection
      field="admissions"
      accent={ROLE_ACCENT.admissions}
      chip={chip}
      heading={heading}
      controls={
        <>
          {tabs}
          {entries && entries.length > 0 ? (
          <label className="inline-flex items-center gap-1.5 rounded-full bg-[var(--field-chip-bg)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)]">
            Entry point
            <select data-entry-switch="" value={current ?? ""} onChange={(e) => setEntry(e.target.value)} className="min-h-[44px] bg-transparent font-semibold text-[var(--field-chip-fg)] outline-none sm:min-h-0">
              {entries.map((e) => (
                <option key={e} value={e}>
                  {entryPoint(e)?.label ?? e}
                </option>
              ))}
            </select>
          </label>
          ) : null}
        </>
      }
      dashboard={{ label: "Open the full Admissions dashboards", href: `/teacher/admissions${current ? `?entry=${encodeURIComponent(current)}` : ""}` }}
      cols={2}
      links={walks.map((w) => ({ label: fillTemplate(w.question, { entry: label }), href: walkHref(w, params) }))}
      // 0.8 feedback B4 (Admissions 1): the sets (who feeds us, who are our rivals) drive the walks, so they
      // are the home's top task, above the questions.
      lead={<SetsCard urn={urn} role="admissions" entry={current} />}
      tiles={walks.map((w, i) => (
        <QuestionTile key={w.id} walk={w} figure={(i === 0 ? f?.pool : f?.share) ?? null} ctx={{ entry: label }} href={walkHref(w, params)} loading={!f} />
      ))}
    />
  );
}

export type { Walk };
export type { TeacherPhase };
