"use client";

// VicData 0.8 front door (B8, B9): each role's section of the home -- Teacher (one per phase), SMT (and a
// primary school's SMT), Admissions. Every figure is real (the dashboards' own rows and routes) or absent;
// never a placeholder number. Head office's home is GroupHome.tsx.
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
import { setPhaseOf } from "@/lib/smt/levels";
import { periodLabel } from "@/catalogue/years";
import { entryPoint } from "@/lib/admissions/entry-points";
import { HomeSection, NoWalkTile, QuestionTile, walkHref, type TileFigure } from "./home";
import { useThemePref } from "@/components/shell/TeacherChrome";
import { SchoolGroupTile } from "@/components/groups/SchoolGroupTile";

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
      <select data-subject-switch="" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="max-w-[16rem] bg-transparent font-semibold text-[var(--field-chip-fg)] outline-none">
        {subjects.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TeacherPhaseSection({ urn, phase, heading }: { urn: string; phase: "ks4" | "ks5"; heading?: React.ReactNode }) {
  const [ticked, setTicked] = useState<string[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [model, setModel] = useState<{ key: string; m: TeacherModel | null } | null>(null);
  useEffect(() => {
    let live = true;
    void fetchPreferences(createBrowserSupabaseClient(), urn, phase).then((p) => live && setTicked(p.subjects));
    return () => {
      live = false;
    };
  }, [urn, phase]);
  const ask = ticked === null ? null : `/api/front-door/teacher?urn=${urn}&phase=${phase}&ticked=${encodeURIComponent(ticked.join("|"))}${focus ? `&focus=${encodeURIComponent(focus)}` : ""}`;
  useEffect(() => {
    if (!ask) return;
    let live = true;
    void getJson<TeacherModel>(ask).then((m) => live && setModel({ key: ask, m }));
    return () => {
      live = false;
    };
  }, [ask]);
  const m = model?.key === ask ? model.m : null;
  const loading = !m && model?.key !== ask;
  const walks = walksFor(phase === "ks4" ? "gcse" : "post16");
  const figures = m ? teacherTileFigures(m) : { many: null, well: null, nearby: null };
  // The switcher lists the subjects the teacher teaches (their ticked ones); with none ticked, every subject.
  const subjects = useMemo(() => {
    const all = m?.subjects ?? [];
    const mine = all.filter((s) => (ticked ?? []).includes(s.key));
    return mine.length ? mine : all;
  }, [m, ticked]);
  const ctx = { subject: m?.focus?.subject ?? null, category: m?.category.label ?? null };
  const fig: Record<string, TileFigure> = { [`${phase === "ks4" ? "gcse" : "post16"}-many`]: figures.many, [`${phase === "ks4" ? "gcse" : "post16"}-well`]: figures.well, [`${phase === "ks4" ? "gcse" : "post16"}-nearby`]: figures.nearby };
  const params = { subject: m?.focus?.key ?? null };
  const label = PHASE_LABELS[phase];
  return (
    <HomeSection
      field={phase === "ks4" ? "gcse" : "post16"}
      accent={PHASE_ACCENT[phase]}
      chip={label}
      heading={heading}
      controls={<SubjectSwitch subjects={subjects} value={m?.focus?.key ?? null} onChange={setFocus} />}
      dashboard={{ label: `Open the full ${label} dashboard`, href: `/teacher/${phase}` }}
      cols={3}
      links={walks.map((w) => ({ label: fillTemplate(w.question, ctx), href: m?.focus ? walkHref(w, params) : null }))}
      tiles={walks.map((w) => (
        <QuestionTile key={w.id} walk={w} figure={fig[w.id] ?? null} ctx={ctx} href={m?.focus ? walkHref(w, params) : null} loading={loading} />
      ))}
      note={m && !m.focus ? "No subject results are published for this school at this phase yet." : null}
    />
  );
}

/** KS2: the teacher view's own dashboard, with no walks yet (logged). */
export function TeacherKs2Section() {
  return (
    <HomeSection field="top" accent={null} chip={PHASE_LABELS.ks2} dashboard={{ label: "Open the full Key stage 2 dashboard", href: "/teacher/ks2" }} cols={3} links={[]} tiles={[]} note="Walkthroughs for Key stage 2 come in a later round." />
  );
}

// ------------------------------------------------------------------------------------------------ SMT

function smtFigures(o: Overview | null, primary: boolean): Record<string, TileFigure> {
  if (!o) return {};
  const out: Record<string, TileFigure> = {};
  const p = primary ? "smt_primary" : "smt";
  if (o.now.roll !== null) {
    const ch = o.now.changePct;
    const dir = ch === null ? "" : Math.abs(ch) < 0.5 ? ", level" : `, ${ch > 0 ? "up" : "down"} ${Math.abs(ch).toFixed(0)}% since ${periodLabel(o.now.base.period)}`;
    out[`${p}-overview`] = { figure: o.now.roll.toLocaleString("en-GB"), unit: `pupils${dir}` };
  }
  const head = o.rows.find((r) => r.stage === "ks4" && r.unit === "points" && r.value !== null) ?? o.rows.find((r) => r.stage === "ks5" && r.unit === "points" && r.value !== null);
  if (!primary && head?.value != null) out[`${p}-academic`] = { figure: head.value.toFixed(1), unit: head.label.toLowerCase() };
  const whole = o.trends.roll.lines[0];
  const act = (whole?.actual ?? []).filter((x) => x.value !== null);
  if (act.length >= 2) {
    const d = (act[act.length - 1].value as number) - (act[act.length - 2].value as number);
    out[`${p}-pupils`] = { figure: `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(Math.round(d)).toLocaleString("en-GB")}`, unit: "pupils on last year" };
  }
  return out;
}

function SmtInner({ member, heading }: { member: SmtMember; heading?: React.ReactNode }) {
  const [pref] = useThemePref();
  const school = useSmt<SmtSchool>(`/api/smt/school?urn=${member.schoolUrn}`, null);
  const s = school.status === "ready" ? school.data : null;
  const sets = useSmtSet(member.schoolUrn, s ? setPhaseOf(s.phases) : null);
  const o = useSmt<Overview>(s && sets.set ? "/api/smt/overview" : null, sets.set ? { urn: member.schoolUrn, set: sets.set } : null);
  const primary = !!s && s.phases.primary && !s.phases.gcse && !s.phases.post16;
  const walks = walksFor(primary ? "smt_primary" : "smt");
  const figures = smtFigures(o.status === "ready" ? o.data : null, primary);
  const loading = o.status === "loading";
  const accent = pref === "light" ? ROLE_ACCENT_LIGHT.smt : ROLE_ACCENT.smt;
  const chips = s ? (primary ? ["Key stage 2"] : ["Whole school", ...(s.phases.gcse ? ["GCSE"] : []), ...(s.phases.post16 ? ["Post-16"] : [])]) : [];
  return (
    <HomeSection
      field="top"
      accent={accent}
      chip="SMT"
      heading={heading}
      controls={chips.map((c, i) => (
        <span key={c} className={`rounded-full px-3.5 py-1.5 text-[14px] ${pick(i === 0, "bg-[var(--field-chip-bg)] font-semibold")} border border-[var(--field-chip-border)] text-[var(--field-chip-fg)]`}>
          {c}
        </span>
      ))}
      dashboard={{ label: "Open the full SMT dashboards", href: "/teacher/smt" }}
      cols={2}
      links={walks.map((w) => ({ label: w.question, href: w.screens.length ? walkHref(w) : null }))}
      tiles={walks.map((w) =>
        w.screens.length ? (
          <QuestionTile key={w.id} walk={w} figure={figures[w.id] ?? null} ctx={{}} href={walkHref(w)} loading={loading} />
        ) : (
          <NoWalkTile key={w.id} walk={w} why="Key stage 2 results by subject aren't in SMT Academic yet. The full SMT dashboards show what there is." />
        ),
      )}
      note={primary ? "KS2 tests did not run in 2019/20 or 2020/21, so those years show as gaps." : null}
    >
      {/* 0.8 groups r1: the school's group, where its head office holds a group account (kept from the old home). */}
      <SchoolGroupTile urn={member.schoolUrn} />
    </HomeSection>
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

type ListsAnswer = { entryPoints: { entry_point: string }[] };
type MarketLite = { share: number | null; latest: number | null };
type PipelineLite = { ladder?: { past: { entryYear: number; pool: number | null }[] }; now?: { cohort: number | null } };

function defaultEntries(low: number | null, high: number | null): string[] {
  // As AdmissionsDashboard's defaultEntries (the school's ages when no entry points are saved).
  if (low === null || high === null) return ["11+"];
  const out: string[] = [];
  if (low <= 4 && high >= 4) out.push("4+");
  if (low <= 11 && high >= 12) out.push("11+");
  if (low <= 16 && high >= 17) out.push("16+");
  return out.length ? out : [`age:${Math.max(2, Math.min(17, low))}`];
}

export function AdmissionsSection({ urn, heading }: { urn: string; heading?: React.ReactNode }) {
  const [entries, setEntries] = useState<string[] | null>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [fig, setFig] = useState<{ entry: string; pool: TileFigure; share: TileFigure } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const [lists, row] = await Promise.all([
        getJson<ListsAnswer>(`/api/admissions/lists?urn=${urn}`),
        createBrowserSupabaseClient().from("schools").select("statutory_low_age, statutory_high_age").eq("urn", urn).maybeSingle<{ statutory_low_age: number | null; statutory_high_age: number | null }>(),
      ]);
      const saved = (lists?.entryPoints ?? []).map((e) => e.entry_point);
      const es = saved.length ? saved : defaultEntries(row.data?.statutory_low_age ?? null, row.data?.statutory_high_age ?? null);
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
      const [p, m] = await Promise.all([getJson<PipelineLite>(`/api/admissions/pipeline?${q}`), getJson<MarketLite>(`/api/admissions/market-share?${q}`)]);
      const past = (p?.ladder?.past ?? []).filter((x) => x.pool !== null);
      const pool = past.length ? (past[past.length - 1].pool as number) : null;
      const label = entryPoint(current)?.label ?? current;
      if (live)
        setFig({
          entry: current,
          pool: pool !== null ? { figure: Math.round(pool).toLocaleString("en-GB"), unit: `children in the ${label} pool` } : null,
          share: m?.share != null ? { figure: `${m.share.toFixed(1)}%`, unit: "of the pool joined us" } : null,
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
      chip="Admissions"
      heading={heading}
      controls={
        entries && entries.length > 0 ? (
          <label className="inline-flex items-center gap-1.5 rounded-full bg-[var(--field-chip-bg)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)]">
            Entry point
            <select data-entry-switch="" value={current ?? ""} onChange={(e) => setEntry(e.target.value)} className="bg-transparent font-semibold text-[var(--field-chip-fg)] outline-none">
              {entries.map((e) => (
                <option key={e} value={e}>
                  {entryPoint(e)?.label ?? e}
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
      dashboard={{ label: "Open the full Admissions dashboards", href: `/teacher/admissions${current ? `?entry=${encodeURIComponent(current)}` : ""}` }}
      cols={2}
      links={walks.map((w) => ({ label: fillTemplate(w.question, { entry: label }), href: walkHref(w, params) }))}
      tiles={walks.map((w, i) => (
        <QuestionTile key={w.id} walk={w} figure={(i === 0 ? f?.pool : f?.share) ?? null} ctx={{ entry: label }} href={walkHref(w, params)} loading={!f} />
      ))}
    />
  );
}

export type { Walk };
export type { TeacherPhase };
