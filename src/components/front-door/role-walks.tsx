"use client";

// VicData 0.8 front door (B12): SMT's, Admissions' and head office's walks. Each screen shows the
// dashboard's own view -- the real component, fed by the dashboard's own route -- enlarged in the walk's
// panel, with the screen's question and a one-line answer from the same data (answers below: honest about
// small numbers and missing years). Head office's screens draw the group dashboard's own views the same
// way (groupWalkView), with group sets' picker where a screen compares.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { useSmt, type Overview, type SmtSchool, type Academic } from "@/components/smt/api";
import { loadSmtMember, type SmtMember } from "@/components/smt/member";
import { useSmtSet } from "@/components/smt/useSmtSet";
import { smtVars } from "@/components/smt/ui";
import { setPhaseOf } from "@/lib/smt/levels";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context } from "@/lib/smt/context";
import { SchoolNow } from "@/components/smt/views/Now";
import { Scorecard } from "@/components/smt/views/Scorecard";
import { SchoolFlags } from "@/components/smt/views/Flags";
import { MarketLine, ResultsBand, RollIndexed, IndexedLines, PlainLine } from "@/components/smt/views/Lines";
import { AcademicNow, AreasView, EveryLine, GradesView, RankChart, TrendBand } from "@/components/smt/views/Academic";
import { EntryPoints, LeavingAt16, PupilsNow, ShapeAndSize } from "@/components/smt/views/Pupils";
import { AgeBars, BirthsAndProjections, ContextNow, NearbyOverTime } from "@/components/smt/views/Context";
import { admissionsVars } from "@/components/admissions/ui";
import type { PipelineOk } from "@/components/admissions/api";
import type { MarketView, RivalsView } from "@/lib/admissions/views-api";
import { EntryTrend, PoolTrends, ShareTrend } from "@/components/admissions/views/Lines";
import { RankedBars } from "@/components/admissions/views/Bars";
import { FeederMap, RivalsMap } from "@/components/admissions/views/AdmissionsMap";
import { Momentum } from "@/components/admissions/views/Momentum";
import { AcademicRanking } from "@/components/admissions/panels/Academic";
import { MarketNow } from "@/components/admissions/panels/MarketNow";
import { entryPoint } from "@/lib/admissions/entry-points";
import { periodLabel } from "@/catalogue/years";
import { dataviewById } from "@/catalogue/dataviews";
import { fillTemplate, groupWalkDash, screenMeta, type Walk } from "@/lib/front-door/walks";
import { Found, MiniMap, Rail, RAIL_LIST, RAIL_ROW, useStep, WalkFooter, WalkFrame, WalkPanel, WalkScreen } from "./WalkPage";
import { groupDashVars, groupWalkView, type DashResponse, type ViewId } from "@/components/groups/dash/GroupDashboard";
import { GroupSetPicker } from "@/components/groups/dash/GroupSetPicker";
import type { ProjectionRow } from "@/components/groups/dash/views-r3";
import { groupAnswer } from "@/lib/front-door/group-answers";
import { groupWalkCompare, groupWalkDashUrl, smtContextUrl } from "@/lib/front-door/tile-figures";
import { RailGlyph } from "./home";

type Load<T> = { status: "loading" } | { status: "error"; message?: string } | { status: "ready"; data: T };
type Screenish = { question: string; answer: string; title: string; body: ReactNode; note: string; rail?: ReactNode; tag?: string; controls?: ReactNode };

const pct = (v: number | null | undefined, d = 0) => (v == null ? null : `${v > 0 ? "up" : v < 0 ? "down" : "level,"} ${Math.abs(v).toFixed(d)}%`);
const n = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("en-GB"));
const lastPt = <T extends { value: number | null }>(pts: T[]) => [...pts].reverse().find((p) => p.value !== null) ?? null;
const firstPt = <T extends { value: number | null }>(pts: T[]) => pts.find((p) => p.value !== null) ?? null;

function titleOf(view: string, fill: Record<string, string>): string {
  const dv = dataviewById(view);
  let t = dv?.titleTemplate ?? screenMeta(view)?.label ?? view;
  for (const [k, v] of Object.entries(fill)) t = t.replace(new RegExp(`\\[${k}\\]`, "g"), v);
  return t.replace(/\[[^\]]+\]/g, "").replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}

/** The walk's panel and its chrome, for any role. */
function RoleScreen({ walk, step, screens, cols, colName, colQuestion, onStep }: { walk: Walk; step: number; screens: Screenish[]; cols: string[]; colName: string; colQuestion: string; onStep: (s: number) => void }) {
  const [asTable] = useState(false);
  const router = useRouter();
  const s = walk.screens[step];
  const sc = screens[step];
  const next = step + 1 < walk.screens.length ? screens[step + 1].question : "Here's what you found";
  return (
    <>
      <WalkScreen
        head={
          <>
            <h1 data-walk-question="" className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[var(--field-ink)] sm:text-[36px]">{sc.question}</h1>
            <p data-walk-answer="" className="text-[17px] leading-relaxed text-[var(--field-ink)] sm:text-[19px]">{sc.answer}</p>
          </>
        }
        map={<MiniMap cols={cols} spot={s.spot} name={`${walk.label}`} href={walk.dashboard} />}
        panel={
          <WalkPanel
            icon={walk.icon}
            name={colName}
            question={colQuestion}
            pills={[]}
            controls={sc.controls}
            tag={sc.tag ?? `${s.spot.row === 0 ? "Current" : "Trends"}`}
            title={sc.title}
            note={sc.note}
            rail={sc.rail ?? <Rail view={s.view} asTable={asTable} onTable={() => {}} dashboard={walk.dashboard} />}
          >
            <div className="min-w-0 overflow-x-auto">{sc.body}</div>
          </WalkPanel>
        }
      />
      <WalkFooter onBack={() => (step === 0 ? router.push(walk.product === "group" ? "/teacher/group" : "/teacher") : onStep(step - 1))} backLabel={step === 0 ? "Questions" : "Back"} onNext={() => onStep(step + 1)} next={next} finish={step + 1 >= walk.screens.length} />
    </>
  );
}

function Loading({ walk, text = "Loading…" }: { walk: Walk; text?: string }) {
  return (
    <WalkFrame walk={walk} step={0} steps={walk.screens.length} chip={null}>
      <p className="text-[15px] text-[var(--field-ink)]">{text}</p>
    </WalkFrame>
  );
}

// ------------------------------------------------------------------------------------------------ SMT

function SmtWalk({ walk, member }: { walk: Walk; member: SmtMember }) {
  const [pref] = useThemePref();
  const theme = pref === "mid" ? "light" : effectiveTheme(pref);
  const school = useSmt<SmtSchool>(`/api/smt/school?urn=${member.schoolUrn}`, null);
  const s = school.status === "ready" ? school.data : null;
  const sets = useSmtSet(member.schoolUrn, s ? setPhaseOf(s.phases) : null);
  const body = sets.set ? { urn: member.schoolUrn, set: sets.set } : null;
  const kind = walk.id.split("-").pop();
  const o = useSmt<Overview>(s && body && kind === "overview" ? "/api/smt/overview" : null, body);
  const a = useSmt<Academic>(s && body && kind === "academic" && walk.screens.length ? "/api/smt/academic" : null, body);
  const p = useSmt<Pupils>(s && body && kind === "pupils" ? "/api/smt/pupils" : null, body ? { ...body, level: "whole" } : null);
  // The home's Context tile reads this same address (tile-figures.ts, front door 2b), so the two agree.
  const c = useSmt<Context>(s && kind === "context" ? smtContextUrl(member.schoolUrn) : null, null);
  const [step, setStep] = useStep(walk.screens.length);
  const loads = { overview: o, academic: a, pupils: p, context: c } as Record<string, Load<unknown>>;
  const load = loads[kind ?? ""];
  if (!s || !load || load.status === "loading") return <Loading walk={walk} />;
  if (load.status === "error") return <Loading walk={walk} text="This walk couldn't load the school's figures." />;
  const screens = smtScreens(walk, s, load.data);
  const n2 = walk.screens.length;
  return (
    <div style={smtVars(theme)}>
      <WalkFrame walk={walk} step={step} steps={n2} chip={s.name}>
        {step >= n2 ? (
          <Found walk={walk} screens={screens} params={{}} ctx={{}} onBack={() => setStep(n2 - 1)} />
        ) : (
          <RoleScreen walk={walk} step={step} screens={screens} cols={["TableIcon", "HorizontalBarsIcon", "AdmRollIcon"]} colName={walk.label} colQuestion={walk.question} onStep={setStep} />
        )}
      </WalkFrame>
    </div>
  );
}

function smtScreens(walk: Walk, school: SmtSchool, data: unknown): Screenish[] {
  const name = school.name;
  return walk.screens.map((s) => {
    const title = titleOf(s.view, { school: name, set: "the set", level: "the school", group: "Headline results" });
    const q = s.question;
    const base = { question: q, title, note: dataviewById(s.view)?.note ?? "" };
    switch (s.view) {
      case "DV-SMT-O-NOW": {
        const o = data as Overview;
        return { ...base, answer: o.now.roll === null ? "No census roll is published for the school yet." : `${n(o.now.roll)} pupils in the ${o.now.census ? periodLabel(o.now.census) : "latest"} census${o.now.changePct !== null ? `, ${pct(o.now.changePct)} since ${periodLabel(o.now.base.period)}` : ""}.`, body: <SchoolNow o={o} school={school} /> };
      }
      case "DV-SMT-O-SCORECARD": {
        const o = data as Overview;
        const ranked = o.rows.filter((r) => r.set && r.value !== null);
        const best = [...ranked].sort((x, y) => x.set!.rank / x.set!.of - y.set!.rank / y.set!.of)[0];
        return { ...base, answer: best ? `Strongest against ${o.set.label}: ${best.label}, ${best.set!.rank} of ${best.set!.of}. ${ranked.length} headlines are ranked.` : `No headline is ranked against ${o.set.label} yet.`, body: <Scorecard o={o} school={school} /> };
      }
      case "DV-SMT-O-ROLL-LINE": {
        const o = data as Overview;
        const line = o.trends.roll.lines[0];
        const f = line ? firstPt(line.actual) : null, l = line ? lastPt(line.actual) : null;
        return { ...base, answer: f && l && f !== l ? `From ${n(f.value)} in ${periodLabel(f.year)} to ${n(l.value)} in ${periodLabel(l.year)}.` : "Not enough census years to see a trend.", body: <RollIndexed o={o} fullscreen={false} room={260} /> };
      }
      case "DV-SMT-O-RESULTS-LINE": {
        const o = data as Overview;
        const t = o.trends.results[0];
        const f = t ? firstPt(t.school) : null, l = t ? lastPt(t.school) : null;
        return { ...base, answer: t && f && l && f !== l ? `${t.label}: ${f.value} in ${periodLabel(f.year)}, ${l.value} in ${periodLabel(l.year)}.` : "Not enough published years of headline results to see a trend.", body: t ? <ResultsBand trend={t} setLabel={o.set.label} fullscreen={false} room={260} title={t.label} schoolName={name} /> : <p className="text-[13px]">No headline results.</p> };
      }
      case "DV-SMT-O-MARKET-LINE": {
        const o = data as Overview;
        return { ...base, answer: "Your share of the pupils at 11+, against your rivals, year by year (Admissions' own figures).", body: <MarketLine o={o} schoolName={name} fullscreen={false} room={260} /> };
      }
      case "DV-SMT-O-FLAGS": {
        const o = data as Overview;
        return { ...base, answer: o.flags.length ? `${o.flags.length} large and lasting ${o.flags.length === 1 ? "change" : "changes"} flagged: ${o.flags[0] && "label" in o.flags[0] ? String((o.flags[0] as { label: string }).label) : "see the list"}.` : "No large and lasting changes flagged.", body: <SchoolFlags o={o} phases={school.phases} /> };
      }
      case "DV-SMT-A-NOW": {
        const a = data as Academic;
        return { ...base, answer: a.col1.summary.length ? a.col1.summary.slice(0, 3).map((x) => `${x.label} ${x.value}`).join(" · ") : a.col1.note ?? `${a.col1.title}: ${a.col1.sub}`, body: <AcademicNow a={a} /> };
      }
      case "DV-SMT-A-CHART": {
        const a = data as Academic;
        return { ...base, title: `${a.areaLabel ?? "The school"}, against ${a.set.pill}`, answer: `Against ${a.set.pill}: ${a.set.offering} schools offer it.`, body: <RankChart a={a} fullscreen={false} room={280} /> };
      }
      case "DV-SMT-A-AREAS": {
        const a = data as Academic;
        return { ...base, answer: `${a.areas.blocks.length} subject areas, each against the set${a.areas.period ? `, ${periodLabel(a.areas.period)}` : ""}.`, body: <AreasView a={a} /> };
      }
      case "DV-SMT-A-GRADES":
        return { ...base, answer: "The grade profile in bands, latest year.", body: <GradesView a={data as Academic} /> };
      case "DV-SMT-A-TREND-LINE": {
        const a = data as Academic;
        const f = firstPt(a.trends.school), l = lastPt(a.trends.school);
        return { ...base, answer: f && l && f !== l ? `${a.trends.label}: ${f.value} in ${periodLabel(f.year)}, ${l.value} in ${periodLabel(l.year)}, against the set's middle half.` : "Not enough published years to see a trend.", body: <TrendBand a={a} fullscreen={false} room={260} /> };
      }
      case "DV-SMT-A-LINES":
        return { ...base, answer: "Last year to this, every line of the school's results.", body: <EveryLine a={data as Academic} /> };
      case "DV-SMT-P-NOW": {
        const p = data as Pupils;
        return { ...base, answer: p.now.roll === null ? "No census roll yet." : `${n(p.now.roll)} pupils${p.now.changePct !== null ? `, ${pct(p.now.changePct)}` : ""}${p.now.mainBand ? `; the main band is ${p.now.mainBand}` : ""}.`, body: <PupilsNow p={p} school={school} /> };
      }
      case "DV-SMT-P-SHAPE": {
        const p = data as Pupils;
        const big = [...p.shape.yearGroups].sort((x, y) => ((y as { count?: number }).count ?? 0) - ((x as { count?: number }).count ?? 0))[0] as { label?: string } | undefined;
        return { ...base, answer: p.shape.label ? `The school's shape: ${p.shape.label.toLowerCase()}${p.shape.sinceYear ? ` since ${periodLabel(p.shape.sinceYear)}` : ""}.${big?.label ? ` Its largest year group is ${big.label}.` : ""}` : "Pupils in each year group.", body: <ShapeAndSize p={p} /> };
      }
      case "DV-SMT-P-ENTRIES": {
        const p = data as Pupils;
        const rows = p.entries.status === "ready" ? p.entries.rows : [];
        return { ...base, answer: rows.length ? rows.map((r) => `${r.label}: ${n(r.cohort)} now${r.pool !== null ? `, a pool of ${n(r.pool)}` : ""}`).join("; ") + "." : p.entries.status === "empty" ? p.entries.reason : "No entry points.", body: <EntryPoints p={p} /> };
      }
      case "DV-SMT-P-LEAVING": {
        const p = data as Pupils;
        const l = p.leaving[p.leaving.length - 1];
        return { ...base, answer: l && l.stayingPct !== null ? `${Math.round(l.stayingPct)}% stayed on into Year 12 in ${periodLabel(l.year)}${l.leaving !== null ? `; ${n(l.leaving)} left at 16 (net)` : ""}.` : "No Year 11 to Year 12 figures yet.", body: <LeavingAt16 p={p} school={school} /> };
      }
      case "DV-SMT-P-PHASES": {
        const p = data as Pupils;
        const whole = p.trends.phases[0];
        const f = whole ? firstPt(whole.actual) : null, l = whole ? lastPt(whole.actual) : null;
        return { ...base, answer: f && l && f !== l ? `${whole.label}: ${n(f.value)} in ${periodLabel(f.year)}, ${n(l.value)} in ${periodLabel(l.year)}; each phase indexed to 100 in the first year they share.` : "Not enough census years to compare the phases.", body: <IndexedLines title="Roll by phase" lines={p.trends.phases} fullscreen={false} room={260} /> };
      }
      case "DV-SMT-P-AREA": {
        const p = data as Pupils;
        const ar = p.trends.area;
        const f = firstPt(ar.pts), l = lastPt(ar.pts);
        const label = `${ar.laName ?? "The LA"}'s residents aged ${ar.agesWord}`;
        return { ...base, answer: f && l && f !== l ? `${label}: ${n(f.value)} in ${f.year}, ${n(l.value)} in ${l.year}.` : `${label}: not enough years yet.`, body: <PlainLine title={label} label={label} pts={ar.pts} fullscreen={false} room={260} caption="ONS mid-year population estimates" forward={ar.forward ? { pts: ar.forward.pts, unbornFrom: ar.forward.unbornFrom, label: "Projected", marker: "projected" } : null} /> };
      }
      case "DV-SMT-C-NOW": {
        const c = data as Context;
        return { ...base, answer: c.now.children.value !== null ? `${n(c.now.children.value)} children (${c.agesWord}) ${c.now.children.scope}${c.now.children.since ? `, ${pct(c.now.children.since.changePct)} since ${c.now.children.since.from}` : ""}.` : "No residents' figure for the area yet.", body: <ContextNow c={c} /> };
      }
      case "DV-SMT-C-MAP": {
        const c = data as Context;
        return { ...base, answer: c.now.mix ? c.now.mix.line : `${c.now.schools.count} ${c.now.schools.phaseWord} schools ${c.now.schools.scope}.`, body: <p className="text-[14px]">The map of where the children live is on the dashboard: <Link className="underline" href={walk.dashboard}>open it</Link>.</p> };
      }
      case "DV-SMT-C-BYAGE": {
        const c = data as Context;
        return { ...base, answer: `Children by single year of age, ${c.agesWord}.`, body: <AgeBars c={c} ages={c.ages} /> };
      }
      case "DV-SMT-C-BIRTHS": {
        const c = data as Context;
        const b = c.now.births;
        return { ...base, answer: b ? `${n(b.value)} births in ${b.year}${b.since ? `, ${pct(b.since.changePct)} since ${b.since.from}` : ""}.` : "No births figure for the area yet.", body: <BirthsAndProjections c={c} fullscreen={false} room={260} /> };
      }
      case "DV-SMT-C-NEARBY": {
        const c = data as Context;
        const pr = c.now.projection;
        return { ...base, answer: pr ? `${pr.agesWord}: ${pct(pr.changePct)} from ${pr.from} to ${pr.to} (projected).` : "No projection for the area.", body: <NearbyOverTime c={c} fullscreen={false} room={260} /> };
      }
    }
    return { ...base, answer: "", body: null };
  });
}

// ------------------------------------------------------------------------------------------------ Admissions

function AdmissionsWalk({ walk, urn }: { walk: Walk; urn: string }) {
  const [pref] = useThemePref();
  const theme = pref === "mid" ? "light" : effectiveTheme(pref);
  const [step, setStep] = useStep(walk.screens.length);
  const entry = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("entry") ?? "11+" : "11+";
  const [data, setData] = useState<Load<{ p: PipelineOk | null; m: MarketView | null; r: RivalsView | null }>>({ status: "loading" });
  useEffect(() => {
    (async () => {
      const { data: s } = await createBrowserSupabaseClient().auth.getSession();
      const h = { headers: { Authorization: `Bearer ${s.session?.access_token ?? ""}` } };
      const q = new URLSearchParams({ urn, entry }).toString();
      const get = async <T,>(u: string) => {
        const r = await fetch(u, h).catch(() => null);
        return r?.ok ? ((await r.json()) as T) : null;
      };
      const market = walk.id === "admissions-market";
      const [p, m, r] = await Promise.all([market ? null : get<PipelineOk & { empty?: string }>(`/api/admissions/pipeline?${q}`), market ? get<MarketView>(`/api/admissions/market-share?${q}`) : null, market ? get<RivalsView>(`/api/admissions/rivals?${q}`) : null]);
      if (!p && !m) return setData({ status: "error" });
      setData({ status: "ready", data: { p: p && !("empty" in p && p.empty) ? (p as PipelineOk) : null, m, r } });
    })();
  }, [urn, entry, walk.id]);
  const label = entryPoint(entry)?.label ?? entry;
  if (data.status === "loading") return <Loading walk={walk} />;
  if (data.status === "error") return <Loading walk={walk} text="This walk couldn't load Admissions' figures for this entry point." />;
  const { p, m, r } = data.data;
  const screens: Screenish[] = walk.screens.map((s) => {
    const q = fillTemplate(s.question, { entry: label });
    const base = { question: q, title: titleOf(s.view, { entry: label, "entry-year": label, set: "your rivals" }), note: dataviewById(s.view)?.note ?? "" };
    const past = p?.ladder.past.filter((x) => x.pool !== null) ?? [];
    switch (s.view) {
      case "DV-ADM-P-NOW":
        return { ...base, answer: p ? `${n(past[past.length - 1]?.pool ?? null)} children in the ${label} pool for ${past.length ? past[past.length - 1].entryYear : "this year"}; ${n(p.now.cohort)} at the school at ${label} now.` : "No pool for this entry point.", body: p ? <EntryTrend p={p} as="bars" fullscreen={false} room={240} /> : null };
      case "DV-ADM-P-PIPELINE":
        return { ...base, answer: p ? `The pool year by year: counted where the census has them, from births after that.${p.change ? ` ${pct(p.change.pct ?? null) ?? ""}`.trimEnd() : ""}` : "", body: p ? <PoolTrends p={p} fullscreen={false} room={240} /> : null };
      case "DV-ADM-P-MAP":
        return { ...base, answer: p ? `${p.rungSets.reduce((t, x) => t + x.schools.length, 0)} feeder schools make the pool.` : "", body: p ? <FeederMap p={p} fullscreen={false} room={300} /> : null };
      case "DV-ADM-P-POOL-INDEXED":
        return { ...base, answer: "The pool against the LA and England, indexed to 100.", body: p ? <PoolTrends p={p} fullscreen={false} room={240} /> : null };
      case "DV-ADM-P-ENTRY-LINE":
        return { ...base, answer: p ? `${n(p.now.cohort)} at ${label} in ${periodLabel(p.now.period)}${p.now.changePct !== null ? `, ${pct(p.now.changePct)} since ${periodLabel(p.now.base.period)}` : ""}.` : "", body: p ? <EntryTrend p={p} as="line" fullscreen={false} room={240} /> : null };
      case "DV-ADM-M-NOW":
        return { ...base, answer: m?.summary.share != null ? `${m.summary.share.toFixed(1)}% of the market at ${label} joined you in ${periodLabel(m.summary.latest)}; ${m.summary.rank ? `${m.summary.rank} of ${m.summary.of}` : "not ranked"}.` : "No share for this entry point yet.", body: m ? <MarketNow m={m} setLabel="your rivals" /> : null };
      case "DV-ADM-M-BARS":
        return { ...base, answer: m?.summary.rank ? `${m.summary.rank} of ${m.summary.of} schools by share.` : "", body: m ? <RankedBars m={m} rivals={r ? { status: "ready", data: r } : { status: "loading" }} fullscreen={false} /> : null };
      case "DV-ADM-M-MAP":
        return { ...base, answer: "Your rivals, where they are.", body: m ? <RivalsMap m={m} fullscreen={false} room={300} /> : null };
      case "DV-ADM-M-MOMENTUM":
        return { ...base, answer: "Who is gaining share, and who is losing it, against their results.", body: m && r ? <Momentum m={m} r={r} fullscreen={false} room={300} /> : null };
      case "DV-ADM-M-SHARE-LINE":
        return { ...base, answer: m?.summary.changePts != null ? `Your share moved ${m.summary.changePts > 0 ? "up" : m.summary.changePts < 0 ? "down" : "by"} ${Math.abs(m.summary.changePts).toFixed(1)} points since the first year.` : "", body: m ? <ShareTrend m={m} fullscreen={false} room={240} /> : null };
      case "DV-ADM-M-ACAD-RANK":
        return { ...base, answer: "How your results compare with your rivals'.", body: m && r ? <AcademicRanking r={r} /> : null };
    }
    return { ...base, answer: "", body: null };
  });
  const n2 = walk.screens.length;
  return (
    <div style={admissionsVars(theme)}>
      <WalkFrame walk={walk} step={step} steps={n2} chip={`Admissions · ${label}`}>
        {step >= n2 ? <Found walk={walk} screens={screens} params={{ entry }} ctx={{ entry: label }} onBack={() => setStep(n2 - 1)} /> : <RoleScreen walk={walk} step={step} screens={screens} cols={["AdmPipelineIcon", "DonutIcon", "TrendLineIcon"]} colName={walk.label} colQuestion={fillTemplate(walk.question, { entry: label })} onStep={setStep} />}
      </WalkFrame>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ head office

// The group views that read the comparison (the set picker sets it): these screens carry the picker.
const GROUP_COMPARES = new Set(["GRP-O-AGAINST", "GRP-O-ROLL", "GRP-O-RESULTS", "GRP-A-NOW", "GRP-A-RANKED", "GRP-A-TREND", "GRP-P-ROLL"]);
const GROUP_COLS: Record<string, string[]> = { overview: ["TilesIcon", "TableIcon", "TrendLineIcon"], schools: ["TilesIcon", "TableIcon", "AdmShapeIcon"], academic: ["TilesIcon", "RankListIcon", "TrendLineIcon"], pupils: ["TilesIcon", "AdmShapeIcon", "IndexedLineIcon"] };

/**
 * Head office's walks (Guy, 13 Nov: group code allowed now): each screen draws the group dashboard's own
 * view (groupWalkView: the same ViewBody, header words and caption) from the dashboard route's own answer,
 * enlarged in the walk's panel with its own rail and an answer sentence (group-answers.ts). Where a screen
 * compares, the walk opens on the set picker's Default "Nearest in size, same type" -- side by side with the
 * set's median, the trends with its median and middle half -- and the picker (read-only: Default and the
 * group's sets) changes it in place.
 */
function GroupWalk({ walk }: { walk: Walk }) {
  const [pref] = useThemePref();
  const theme = pref === "mid" ? "light" : effectiveTheme(pref);
  const [step, setStep] = useStep(walk.screens.length);
  const dash = groupWalkDash(walk.screens[0]?.view ?? "GRP-O-NOW");
  const [account] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("account") : null));
  const [compare, setCompare] = useState<string | null>(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("compare") : null) ?? groupWalkCompare(dash));
  // The home's Academic tile reads this same address for its first screen (tile-figures.ts, front door 2b).
  const load = useSmt<DashResponse>(groupWalkDashUrl(dash, account, compare), null);
  const projQ = new URLSearchParams(account ? { account } : {});
  const proj = useSmt<{ rows: ProjectionRow[] }>(walk.screens.some((s) => s.view === "GRP-P-PROJECTION") ? `/api/group/projection?${projQ.toString()}` : null, null);
  const dashHref = account ? `${walk.dashboard}?account=${account}` : walk.dashboard;
  const w = useMemo(() => ({ ...walk, dashboard: dashHref }), [walk, dashHref]);
  if (load.status === "loading") return <Loading walk={w} />;
  if (load.status === "error") return <Loading walk={w} text={load.code === 404 ? "Not found." : "This walk couldn't load the group's figures."} />;
  const d = load.data;
  const projection = proj.status === "ready" ? proj.data.rows : null;
  const o = (dash === "schools" ? d.now : d.overview) ?? null;
  const screens: (Screenish & { rail: ReactNode; tag: string; controls: ReactNode })[] = walk.screens.map((s) => {
    const view = groupWalkView(d, dash, s.view as ViewId, projection, s.spot.row === 0 ? 420 : 320);
    const label = screenMeta(s.view)?.label ?? s.view;
    const picker =
      GROUP_COMPARES.has(s.view) && o ? (
        <GroupSetPicker
          picker={o.picker}
          sets={{ ...(d.sets ?? { sets: [], notSetUp: true, personalActive: 0, cap: 8, admin: false, canKeep: false, defaults: { group_peers: null, group_schools: null } }), canKeep: false, admin: false, sets: (d.sets?.sets ?? []).filter((x) => x.scope === "group") }}
          account={d.viewer.accountId}
          phone={false}
          onPick={(key) => setCompare(key)}
          onChanged={() => {}}
        />
      ) : null;
    return {
      question: s.question,
      answer: groupAnswer(s.view, d, projection),
      title: label,
      tag: `${view.header.tag}${typeof view.header.context === "string" && view.header.context ? ` · ${view.header.context}` : ""}`,
      note: typeof view.caption === "string" ? view.caption : "",
      controls: (
        <>
          {picker}
          {view.flag}
        </>
      ),
      rail: <GroupRail rail={view.rail} active={s.view} dashboard={dashHref} />,
      body: <div style={groupDashVars(theme)} data-group-walk-view={s.view}>{view.body}</div>,
    };
  });
  const n2 = walk.screens.length;
  return (
    <WalkFrame walk={w} step={step} steps={n2} chip={d.viewer.name ?? o?.group.name ?? "Head office"}>
      {step >= n2 ? (
        <Found walk={w} screens={screens} params={{ account }} ctx={{}} onBack={() => setStep(n2 - 1)} />
      ) : (
        <RoleScreen walk={w} step={step} screens={screens} cols={GROUP_COLS[dash]} colName={walk.label} colQuestion={walk.question} onStep={setStep} />
      )}
    </WalkFrame>
  );
}

/** The group view's own rail, names written out: lit = this screen's view; any other opens the dashboard. */
function GroupRail({ rail, active, dashboard }: { rail: { id: string; label: string; icon: string }[]; active: string; dashboard: string }) {
  return (
    <ul className={RAIL_LIST} data-walk-rail="">
      {rail.map((r) => {
        const on = r.id === active;
        const row = (
          <span className={`${RAIL_ROW} ${on ? "bg-[rgba(var(--accent-rgb,138,138,144),0.16)] font-semibold text-[var(--fg)]" : "text-[var(--muted2)] hover:text-[var(--fg)]"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-[6px] ${on ? "bg-[var(--accent,var(--fg))] text-[var(--bg)]" : ""}`}>
              <RailGlyph name={r.icon} size={13} />
            </span>
            {r.label}
          </span>
        );
        return <li key={r.id}>{on ? <span aria-current="true">{row}</span> : <Link href={dashboard} title={`Opens the dashboard: ${r.label}`}>{row}</Link>}</li>;
      })}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------------ entry

export function RoleWalk({ walk }: { walk: Walk }) {
  const [member, setMember] = useState<SmtMember | null | "none">(null);
  useEffect(() => {
    if (walk.product === "group") return;
    loadSmtMember().then((m) => setMember(m.status === "ready" ? m.member : "none"));
  }, [walk.product]);
  if (walk.product === "group") return <GroupWalk walk={walk} />;
  if (!walk.screens.length) return <Loading walk={walk} text="This walk needs views that aren't on the dashboards yet." />;
  if (member === null) return <Loading walk={walk} />;
  if (member === "none") return <Loading walk={walk} text="Sign in as a member of the school to take this walk." />;
  if (walk.product === "admissions") return <AdmissionsWalk walk={walk} urn={member.schoolUrn} />;
  return <SmtWalk walk={walk} member={member} />;
}
