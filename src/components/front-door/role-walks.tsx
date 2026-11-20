"use client";

// VicData 0.8 front door (B12): SMT's, Admissions' and head office's walks. Each screen shows the
// dashboard's own view -- the real component, fed by the dashboard's own route -- enlarged in the walk's
// panel, with the screen's question and a one-line answer from the same data (answers below: honest about
// small numbers and missing years). Head office's screens draw the group dashboard's own views the same
// way (groupWalkView), with group sets' picker where a screen compares.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { useSmt, type Overview, type SmtSchool, type Academic, type Load as SmtLoad } from "@/components/smt/api";
import { loadSmtMember, type SmtMember } from "@/components/smt/member";
import { useSmtSet } from "@/components/smt/useSmtSet";
import { smtVars } from "@/components/smt/ui";
import { LEVEL_LABEL, setPhaseOf } from "@/lib/smt/levels";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context } from "@/lib/smt/context";
import type { ContextMap } from "@/lib/smt/context-map";
import { possessive } from "@/lib/front-door/words";
import { SchoolNow } from "@/components/smt/views/Now";
import { Scorecard } from "@/components/smt/views/Scorecard";
import { SchoolFlags } from "@/components/smt/views/Flags";
import { MarketLine, ResultsBand, RollIndexed, IndexedLines, PlainLine } from "@/components/smt/views/Lines";
import { periodLabel } from "@/catalogue/years";
import { AcademicNow, AreasView, EveryLine, GradesView, RankChart, SubjectsRankedView, TrendBand, acVars } from "@/components/smt/views/Academic";
import { subjectsRanked, subjectsRankedAnswer } from "@/lib/smt/subjects-ranked";
import { EntryPoints, LeavingAt16, PupilsNow, ShapeAndSize } from "@/components/smt/views/Pupils";
import { AgeBars, AreaMap, BirthsAndProjections, ContextNow, NearbyOverTime } from "@/components/smt/views/Context";
import { admissionsVars } from "@/components/admissions/ui";
import { getJson as admissionsGet, type PipelineOk } from "@/components/admissions/api";
import type { MarketView, RivalsView } from "@/lib/admissions/views-api";
import { AdmissionsWalkBody } from "@/components/admissions/AdmissionsDashboard";
import { admissionsAnswer } from "@/lib/front-door/admissions-answers";
import { admissionsTitleFill, fillTitle, smtTitleFill } from "@/lib/front-door/walk-titles";
import { smtAnswer } from "@/lib/front-door/smt-answers";
import { entryPoint } from "@/lib/admissions/entry-points";
import { dataviewById } from "@/catalogue/dataviews";
import { answerStep, fillTemplate, groupWalkDash, screenMeta, SMT_SUBJECTS_RANKED, type Walk } from "@/lib/front-door/walks";
import { Found, homeOf, MiniMap, useStep, WalkFooter, WalkFrame, WalkPanel, WalkRail, WalkScreen, type FoundAnswer } from "./WalkPage";
import { groupDashVars, groupWalkView, type DashResponse, type ViewId } from "@/components/groups/dash/GroupDashboard";
import { GroupSetPicker } from "@/components/groups/dash/GroupSetPicker";
import type { ProjectionRow } from "@/components/groups/dash/views-r3";
import { groupAnswer } from "@/lib/front-door/group-answers";
import { LoadingGraphic } from "@/components/shell/LoadingGraphic";
import { groupWalkCompare, groupWalkDashUrl, smtContextUrl } from "@/lib/front-door/tile-figures";
import { schoolEntries } from "./entry-default";

type Load<T> = { status: "loading" } | { status: "error"; code: number; message: string } | { status: "ready"; data: T };
type Screenish = { question: string; answer: string; title: string; body: ReactNode; note: string; tag?: string; controls?: ReactNode };


/** A screen's title: its catalogue title with every placeholder filled, else the view's label (R-WALK-WORDS). */
function titleOf(view: string, fill: Record<string, string | number | null>): string {
  const dv = dataviewById(view);
  return fillTitle(dv?.titleTemplate ?? "", fill, dv?.label ?? screenMeta(view)?.label ?? view);
}
/** The walk's panel and its chrome, for any role. */
function RoleScreen({ walk, step, screens, cols, colName, colQuestion, onStep }: { walk: Walk; step: number; screens: Screenish[]; cols: string[]; colName: string; colQuestion: string; onStep: (s: number) => void }) {
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
        map={s.from === "admissions" ? <MiniMap cols={["AdmPipelineIcon", "DonutIcon", "TrendLineIcon"]} spot={s.spot} name="Admissions · Pipelines" href="/teacher/admissions" /> : <MiniMap cols={cols} spot={s.spot} name={`${walk.label}`} href={walk.dashboard} />}
        panel={
          <WalkPanel
            icon={walk.icon}
            name={colName}
            question={colQuestion}
            pills={[]}
            controls={sc.controls}
            tag={sc.tag ?? `${s.spot.row === 0 ? "Current" : "Trends"}`}
            title=""
            note={sc.note}
            // 0.8 feedback B2 (D4): the walk's own views; a click steps the walk (the "As a table" these walks
            // offered did nothing, so it is gone).
            rail={<WalkRail walk={walk} step={step} onStep={onStep} dashboard={walk.dashboard} />}
          >
            <div className="min-w-0 overflow-x-auto">{sc.body}</div>
          </WalkPanel>
        }
      />
      <WalkFooter onBack={() => (step === 0 ? router.push(walk.product === "group" ? "/teacher/group" : "/teacher") : onStep(step - 1))} backLabel={step === 0 ? "Questions" : "Back"} onNext={() => onStep(step + 1)} next={next} finish={step + 1 >= walk.screens.length} />
    </>
  );
}

/** 0.8 feedback B1 (R-WALK-ENDS-ON-ANSWER): the answer screen's own view and sentence, for the last window. */
function answerOf(walk: Walk, screens: Screenish[]): FoundAnswer | null {
  const i = answerStep(walk);
  return i >= 0 && screens[i] ? { sentence: screens[i].answer, body: screens[i].body } : null;
}

/** 0.8 feedback A2 (R-GROUP-WALKS-LOAD): a walk that couldn't load says what failed -- the route's own message
 * and its status code -- logs it, and always offers the way back to the role's home; never a dead end. */
function WalkError({ walk, what, code, message, home, ctx }: { walk: Walk; what: string; code: number; message: string; home: string; ctx?: { entry?: string | null } }) {
  useEffect(() => {
    console.error(`[walk] ${walk.id}: HTTP ${code} ${message}`);
  }, [walk.id, code, message]);
  return (
    <WalkFrame walk={walk} step={0} steps={walk.screens.length} chip={null} ctx={ctx}>
      <div data-walk-error={code} className="flex flex-col gap-3">
        <p className="text-[15px] text-[var(--field-ink)]">This walk couldn&rsquo;t load {what}.</p>
        <p className="text-[14px] text-[var(--field-ink)]">
          {message} <span className="tabular-nums opacity-70">(error {code})</span>
        </p>
        <Link href={home} data-walk-home="" className="inline-flex min-h-[44px] w-fit items-center font-semibold underline">Back to your home</Link>
      </div>
    </WalkFrame>
  );
}

/** A walk waiting on its figures: the loading graphic (B5, SMT 1); `still` for a walk that can't start. */
function Loading({ walk, text = "Loading the figures…", ctx, still = false }: { walk: Walk; text?: string; ctx?: { entry?: string | null }; still?: boolean }) {
  return (
    <WalkFrame walk={walk} step={0} steps={walk.screens.length} chip={null} ctx={ctx}>
      {still ? <p className="text-[15px] text-[var(--field-ink)]">{text}</p> : <div className="fd-tile flex min-h-[220px] rounded-[14px]"><LoadingGraphic label={text} /></div>}
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
  // 0.8 feedback B5 (SMT 2, 14): the level the home's pills picked (?level=), as the dashboards read it; the
  // Overview walk is the whole school at any level, as its dashboard is.
  const sp = useSearchParams();
  const asked = sp.get("level");
  const level = s && kind !== "overview" && ((asked === "gcse" && s.phases.gcse) || (asked === "post16" && s.phases.post16)) ? asked : null;
  const o = useSmt<Overview>(s && body && kind === "overview" ? "/api/smt/overview" : null, body);
  const a = useSmt<Academic>(s && body && kind === "academic" && walk.screens.length ? "/api/smt/academic" : null, body ? { ...body, ...(level ? { level } : {}) } : null);
  const p = useSmt<Pupils>(s && body && kind === "pupils" ? "/api/smt/pupils" : null, body ? { ...body, level: level ?? "whole" } : null);
  // The home's Context tile reads this same address (tile-figures.ts, front door 2b), so the two agree.
  const c = useSmt<Context>(s && kind === "context" ? smtContextUrl(member.schoolUrn, level ?? "whole") : null, null);
  const cmap = useSmt<ContextMap>(s && kind === "context" ? `/api/smt/context/map?urn=${member.schoolUrn}&level=${level ?? "whole"}` : null, null);
  // Leighton Park prep (20 Nov): a screen borrowed from Admissions (Pupils ends on Share needed) reads the
  // Pipelines answer at the school's first entry point, as the Admissions home opens on it; that screen waits
  // alone, the rest of the walk doesn't.
  const borrows = walk.screens.some((x) => x.from === "admissions");
  const [adm, setAdm] = useState<{ entry: string; p: PipelineOk | null } | "loading" | "none">("loading");
  useEffect(() => {
    if (!borrows) return;
    let live = true;
    void (async () => {
      const entry = (await schoolEntries(member.schoolUrn).catch(() => ["11+"]))[0] ?? "11+";
      const r = await admissionsGet<PipelineOk & { empty?: string }>(`/api/admissions/pipeline?${new URLSearchParams({ urn: member.schoolUrn, entry }).toString()}`);
      if (!live) return;
      setAdm(r.status === "ready" ? { entry, p: "empty" in r.data && r.data.empty ? null : r.data } : "none");
    })();
    return () => {
      live = false;
    };
  }, [borrows, member.schoolUrn]);
  const [step, setStep] = useStep(walk.screens.length);
  const loads = { overview: o, academic: a, pupils: p, context: c } as Record<string, Load<unknown>>;
  const load = loads[kind ?? ""];
  if (!s || !load || load.status === "loading") return <Loading walk={walk} />;
  if (load.status === "error") return <WalkError walk={walk} what="the school's figures" code={load.code} message={load.message} home={homeOf(walk)} />;
  const screens = smtScreens(walk, s, load.data, kind === "context" ? cmap : null, { adm, theme });
  const n2 = walk.screens.length;
  return (
    // The Academic views' band colours (acVars), as the dashboard sets them on its root.
    <div style={kind === "academic" ? { ...smtVars(theme), ...acVars(theme) } : smtVars(theme)}>
      <WalkFrame walk={walk} step={step} steps={n2} chip={level ? `${s.name} · ${LEVEL_LABEL[level]}` : s.name}>
        {step >= n2 ? (
          <Found walk={walk} screens={screens} params={{}} ctx={{}} onBack={() => setStep(n2 - 1)} answer={walk.answer?.view === SMT_SUBJECTS_RANKED ? smtSubjectsAnswer(load.data as Academic) : answerOf(walk, screens)} />
        ) : (
          <RoleScreen walk={walk} step={step} screens={screens} cols={["TableIcon", "HorizontalBarsIcon", "AdmRollIcon"]} colName={walk.label} colQuestion={walk.question} onStep={setStep} />
        )}
      </WalkFrame>
    </div>
  );
}

/** SMT 7: the Academic walk's answer, every subject ranked against the set (subjects-ranked.ts). */
function smtSubjectsAnswer(a: Academic): FoundAnswer {
  return { sentence: subjectsRankedAnswer(subjectsRanked(a)), body: <SubjectsRankedView a={a} /> };
}

type Borrowed = { adm: { entry: string; p: PipelineOk | null } | "loading" | "none"; theme: "light" | "dark" };

/** A screen from Admissions' Pipelines in an SMT walk: the dashboard's own view and answer, in its colours. */
function admissionsScreen(s: Walk["screens"][number], school: SmtSchool, { adm, theme }: Borrowed): Screenish {
  const dv = dataviewById(s.view);
  if (adm === "loading") return { question: fillTemplate(s.question, {}), title: dv?.label ?? s.view, note: "", answer: "Working out the pool for your entry point…", body: <div className="fd-tile flex min-h-[220px] rounded-[14px]"><LoadingGraphic label="Loading the pool…" /></div> };
  if (adm === "none") return { question: fillTemplate(s.question, {}), title: dv?.label ?? s.view, note: "", answer: "Admissions' pool didn't load for this school.", body: <p className="text-[13px]">The Admissions dashboard shows the share needed for each entry point.</p> };
  const ep = entryPoint(adm.entry);
  const label = ep?.label ?? adm.entry;
  return {
    question: fillTemplate(s.question, { entry: label }),
    title: fillTitle(dv?.titleTemplate ?? "", admissionsTitleFill(adm.entry, adm.p), dv?.label ?? s.view),
    note: dv?.note ?? "",
    tag: "Admissions · Forward",
    answer: admissionsAnswer(s.view, { label, p: adm.p, m: null, r: null }),
    body: (
      <div style={admissionsVars(theme)}>
        <AdmissionsWalkBody dv={s.view} urn={school.urn} schoolName={school.name} entry={ep?.id ?? adm.entry} pipeline={adm.p} market={null} rivals={null} />
      </div>
    ),
  };
}

function smtScreens(walk: Walk, school: SmtSchool, data: unknown, contextMap: SmtLoad<ContextMap> | null, borrowed: Borrowed): Screenish[] {
  const name = school.name;
  return walk.screens.map((s) => {
    if (s.from === "admissions") return admissionsScreen(s, school, borrowed);
    const title = titleOf(s.view, smtTitleFill(name));
    const base = { question: s.question, title, note: dataviewById(s.view)?.note ?? "" };
    // Review fixes (14 Nov): the answers are worked out in smt-answers.ts, from the figures each view draws.
    const answer = smtAnswer(s.view, school, data);
    const o = data as Overview;
    const a = data as Academic;
    const p = data as Pupils;
    const c = data as Context;
    const body = ((): ReactNode => {
      switch (s.view) {
        case "DV-SMT-O-NOW": return <SchoolNow o={o} school={school} />;
        case "DV-SMT-O-SCORECARD": return <Scorecard o={o} school={school} />;
        case "DV-SMT-O-ROLL-LINE": return <RollIndexed o={o} fullscreen={false} room={260} />;
        case "DV-SMT-O-RESULTS-LINE": {
          const t = o.trends.results[0];
          return t ? <ResultsBand trend={t} setLabel={o.set.label} fullscreen={false} room={260} title={t.label} schoolName={name} /> : <p className="text-[13px]">No headline results.</p>;
        }
        case "DV-SMT-O-MARKET-LINE": return <MarketLine o={o} schoolName={name} fullscreen={false} room={300} />;
        case "DV-SMT-O-FLAGS": return <SchoolFlags o={o} phases={school.phases} />;
        case "DV-SMT-A-NOW": return <AcademicNow a={a} />;
        case "DV-SMT-A-CHART": return <RankChart a={a} fullscreen={false} room={280} />;
        case "DV-SMT-A-AREAS": return <AreasView a={a} />;
        case "DV-SMT-A-GRADES": return <GradesView a={a} />;
        case "DV-SMT-A-TREND-LINE": return <TrendBand a={a} fullscreen={false} room={260} />;
        case "DV-SMT-A-LINES": return <EveryLine a={a} />;
        case "DV-SMT-P-NOW": return <PupilsNow p={p} school={school} />;
        case "DV-SMT-P-SHAPE": return <ShapeAndSize p={p} />;
        case "DV-SMT-P-ENTRIES": return <EntryPoints p={p} />;
        case "DV-SMT-P-LEAVING": return <LeavingAt16 p={p} school={school} />;
        case "DV-SMT-P-PHASES": return <IndexedLines title={`Roll by phase against ${school.laName ?? "the LA"}'s children of the same ages, indexed (${p.trends.base !== null ? periodLabel(p.trends.base) : "the first shared year"} = 100)`} lines={p.trends.phases} fullscreen={false} room={320} />;
        case "DV-SMT-P-AREA": {
          const ar = p.trends.area;
          const label = `${possessive(ar.laName ?? "The LA")} residents aged ${ar.agesWord}`;
          return <PlainLine title={label} label={label} pts={ar.pts} fullscreen={false} room={260} caption="ONS mid-year population estimates" forward={ar.forward ? { pts: ar.forward.pts, unbornFrom: ar.forward.unbornFrom, label: "Projected", marker: "projected" } : null} />;
        }
        case "DV-SMT-C-NOW": return <ContextNow c={c} />;
        // Review fixes (14 Nov, M2): the walk draws the dashboard's own map (it showed only a link).
        case "DV-SMT-C-MAP": return contextMap ? <AreaMap c={c} map={contextMap} shade="children" fullscreen={false} room={320} /> : <p className="text-[13px]">Loading the map…</p>;
        case "DV-SMT-C-BYAGE": return <AgeBars c={c} ages={c.ages} />;
        case "DV-SMT-C-BIRTHS": return <BirthsAndProjections c={c} fullscreen={false} room={260} />;
        case "DV-SMT-C-NEARBY": return <NearbyOverTime c={c} fullscreen={false} room={260} />;
      }
      return null;
    })();
    return { ...base, answer, body };
  });
}

// ------------------------------------------------------------------------------------------------ Admissions

// The market walk's screens whose answer reads the rivals' answer; the others open without it (A4).
const NEEDS_RIVALS = new Set(["DV-ADM-M-MOMENTUM", "DV-ADM-M-ACAD-RANK", "DV-ADM-M-ACAD-NUM", "DV-ADM-M-ACAD-CHANGE", "DV-ADM-M-FLAGS", "DV-ADM-M-STRENGTHS"]);

function AdmissionsWalk({ walk, urn, schoolName }: { walk: Walk; urn: string; schoolName: string }) {
  const [pref] = useThemePref();
  const theme = pref === "mid" ? "light" : effectiveTheme(pref);
  const [step, setStep] = useStep(walk.screens.length);
  const entry = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("entry") ?? "11+" : "11+";
  // Leighton Park prep (20 Nov): the feeder and rival sets picked on the home (&fset= / &rset=), which every
  // Admissions route reads; none is the school's own.
  const sp0 = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const fset = sp0.get("fset");
  const rset = sp0.get("rset");
  // 0.8 feedback A4 (Admissions 3): moving from walk 1 to walk 2 stalled because walk 2 waited on the rivals
  // answer (England's results, ~15 s on a cold server cache) before drawing anything, and nothing warmed it.
  // Now: the dashboard's cached fetch (fetch-cache, 10 min, the same URLs), so the home, the other walk and
  // the dashboard share each answer; the walk draws as soon as its own answer is in; rivals loads alongside
  // and only its screens wait; walk 1 warms walk 2's answers.
  const market = walk.id === "admissions-market";
  const [data, setData] = useState<Load<{ p: PipelineOk | null; m: MarketView | null }>>({ status: "loading" });
  const [rivals, setRivals] = useState<Load<RivalsView>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ urn, entry, ...(fset ? { fset } : {}), ...(rset ? { rset } : {}) }).toString();
    (async () => {
      const [p, m] = await Promise.all([market ? null : admissionsGet<PipelineOk & { empty?: string }>(`/api/admissions/pipeline?${q}`), market ? admissionsGet<MarketView>(`/api/admissions/market-share?${q}`) : null]);
      if (!live) return;
      const own = market ? m : p;
      if (own && own.status === "error") return setData(own);
      const pd = p && p.status === "ready" ? p.data : null;
      setData({ status: "ready", data: { p: pd && !("empty" in pd && pd.empty) ? (pd as PipelineOk) : null, m: m && m.status === "ready" ? m.data : null } });
      if (!market) {
        void admissionsGet(`/api/admissions/market-share?${q}`);
        void admissionsGet(`/api/admissions/rivals?${q}`);
      }
    })();
    if (market) void admissionsGet<RivalsView>(`/api/admissions/rivals?${q}`).then((r) => live && setRivals(r));
    return () => {
      live = false;
    };
  }, [urn, entry, market, fset, rset]);
  const label = entryPoint(entry)?.label ?? entry;
  if (data.status === "loading") return <Loading walk={walk} ctx={{ entry: label }} />;
  if (data.status === "error") return <WalkError walk={walk} ctx={{ entry: label }} what="Admissions' figures for this entry point" code={data.code} message={data.message} home={homeOf(walk)} />;
  const { p, m } = data.data;
  const r = rivals.status === "ready" ? rivals.data : null;
  const rivalsLoading = market && rivals.status === "loading";
  const ep = entryPoint(entry);
  // Review fixes (14 Nov, M1): every placeholder the catalogue's titles use, filled from the routes.
  const fill = admissionsTitleFill(entry, p);
  const screens: Screenish[] = walk.screens.map((s) => {
    const q = fillTemplate(s.question, { entry: label });
    const dv = dataviewById(s.view);
    const base = { question: q, title: fillTitle(dv?.titleTemplate ?? "", fill, dv?.label ?? s.view), note: dv?.note ?? "" };
    // The dashboard's own viewBody draws each screen (as the head office walk draws the group dashboard's).
    const pending = rivalsLoading && NEEDS_RIVALS.has(s.view);
    return { ...base, answer: pending ? "Working out your rivals' figures…" : admissionsAnswer(s.view, { label, p, m, r }), body: <AdmissionsWalkBody dv={s.view} urn={urn} schoolName={schoolName} entry={ep?.id ?? entry} pipeline={p} market={m} rivals={r} rivalsLoading={rivalsLoading} /> };
  });
  const n2 = walk.screens.length;
  return (
    <div style={admissionsVars(theme)}>
      <WalkFrame walk={walk} step={step} steps={n2} chip={`Admissions · ${label}`} ctx={{ entry: label }}>
        {step >= n2 ? <Found walk={walk} screens={screens} params={{ entry, ...(fset ? { fset } : {}), ...(rset ? { rset } : {}) }} ctx={{ entry: label }} onBack={() => setStep(n2 - 1)} answer={answerOf(walk, screens)} /> : <RoleScreen walk={walk} step={step} screens={screens} cols={["AdmPipelineIcon", "DonutIcon", "TrendLineIcon"]} colName={walk.label} colQuestion={fillTemplate(walk.question, { entry: label })} onStep={setStep} />}
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
  // 0.8 feedback A2: the address through useSearchParams, not window.location -- on a client navigation from
  // the home the location isn't updated yet when the state initialises, and the walk asked without its account.
  const sp = useSearchParams();
  const account = sp.get("account");
  const [compare, setCompare] = useState<string | null>(() => sp.get("compare") ?? groupWalkCompare(dash));
  // The home's Academic tile reads this same address for its first screen (tile-figures.ts, front door 2b).
  const load = useSmt<DashResponse>(groupWalkDashUrl(dash, account, compare), null);
  const projQ = new URLSearchParams(account ? { account } : {});
  const proj = useSmt<{ rows: ProjectionRow[] }>(walk.screens.some((s) => s.view === "GRP-P-PROJECTION") ? `/api/group/projection?${projQ.toString()}` : null, null);
  const dashHref = account ? `${walk.dashboard}?account=${account}` : walk.dashboard;
  const w = useMemo(() => ({ ...walk, dashboard: dashHref }), [walk, dashHref]);
  if (load.status === "loading") return <Loading walk={w} />;
  if (load.status === "error") return <WalkError walk={w} what="the group's figures" code={load.code} message={load.code === 404 ? "This group wasn't found, or you can't see it." : load.message} home={account ? `/teacher/group?account=${encodeURIComponent(account)}` : "/teacher/group"} />;
  const d = load.data;
  const projection = proj.status === "ready" ? proj.data.rows : null;
  const o = (dash === "schools" ? d.now : d.overview) ?? null;
  const screens: (Screenish & { tag: string; controls: ReactNode })[] = walk.screens.map((s) => {
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
      body: <div style={groupDashVars(theme)} data-group-walk-view={s.view}>{view.body}</div>,
    };
  });
  const n2 = walk.screens.length;
  return (
    <WalkFrame walk={w} step={step} steps={n2} chip={d.viewer.name ?? o?.group.name ?? "Head office"}>
      {step >= n2 ? (
        <Found walk={w} screens={screens} params={{ account }} ctx={{}} onBack={() => setStep(n2 - 1)} answer={answerOf(walk, screens)} />
      ) : (
        <RoleScreen walk={w} step={step} screens={screens} cols={GROUP_COLS[dash]} colName={walk.label} colQuestion={walk.question} onStep={setStep} />
      )}
    </WalkFrame>
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
  if (!walk.screens.length) return <Loading walk={walk} still text="This walk needs views that aren't on the dashboards yet." />;
  if (member === null) return <Loading walk={walk} />;
  if (member === "none") return <Loading walk={walk} still text="Sign in as a member of the school to take this walk." />;
  if (walk.product === "admissions") return <AdmissionsWalk walk={walk} urn={member.schoolUrn} schoolName={member.schoolName ?? ""} />;
  return <SmtWalk walk={walk} member={member} />;
}
