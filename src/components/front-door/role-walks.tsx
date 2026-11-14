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
import { useSmt, type Overview, type SmtSchool, type Academic, type Load as SmtLoad } from "@/components/smt/api";
import { loadSmtMember, type SmtMember } from "@/components/smt/member";
import { useSmtSet } from "@/components/smt/useSmtSet";
import { smtVars } from "@/components/smt/ui";
import { setPhaseOf } from "@/lib/smt/levels";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context } from "@/lib/smt/context";
import type { ContextMap } from "@/lib/smt/context-map";
import { possessive } from "@/lib/front-door/words";
import { SchoolNow } from "@/components/smt/views/Now";
import { Scorecard } from "@/components/smt/views/Scorecard";
import { SchoolFlags } from "@/components/smt/views/Flags";
import { MarketLine, ResultsBand, RollIndexed, IndexedLines, PlainLine } from "@/components/smt/views/Lines";
import { AcademicNow, AreasView, EveryLine, GradesView, RankChart, TrendBand } from "@/components/smt/views/Academic";
import { EntryPoints, LeavingAt16, PupilsNow, ShapeAndSize } from "@/components/smt/views/Pupils";
import { AgeBars, AreaMap, BirthsAndProjections, ContextNow, NearbyOverTime } from "@/components/smt/views/Context";
import { admissionsVars } from "@/components/admissions/ui";
import type { PipelineOk } from "@/components/admissions/api";
import type { MarketView, RivalsView } from "@/lib/admissions/views-api";
import { AdmissionsWalkBody } from "@/components/admissions/AdmissionsDashboard";
import { admissionsAnswer } from "@/lib/front-door/admissions-answers";
import { admissionsTitleFill, fillTitle, smtTitleFill } from "@/lib/front-door/walk-titles";
import { smtAnswer } from "@/lib/front-door/smt-answers";
import { entryPoint } from "@/lib/admissions/entry-points";
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


/** A screen's title: its catalogue title with every placeholder filled, else the view's label (R-WALK-WORDS). */
function titleOf(view: string, fill: Record<string, string | number | null>): string {
  const dv = dataviewById(view);
  return fillTitle(dv?.titleTemplate ?? "", fill, dv?.label ?? screenMeta(view)?.label ?? view);
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
            title=""
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

function Loading({ walk, text = "Loading…", ctx }: { walk: Walk; text?: string; ctx?: { entry?: string | null } }) {
  return (
    <WalkFrame walk={walk} step={0} steps={walk.screens.length} chip={null} ctx={ctx}>
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
  const cmap = useSmt<ContextMap>(s && kind === "context" ? `/api/smt/context/map?urn=${member.schoolUrn}&level=whole` : null, null);
  const [step, setStep] = useStep(walk.screens.length);
  const loads = { overview: o, academic: a, pupils: p, context: c } as Record<string, Load<unknown>>;
  const load = loads[kind ?? ""];
  if (!s || !load || load.status === "loading") return <Loading walk={walk} />;
  if (load.status === "error") return <Loading walk={walk} text="This walk couldn't load the school's figures." />;
  const screens = smtScreens(walk, s, load.data, kind === "context" ? cmap : null);
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

function smtScreens(walk: Walk, school: SmtSchool, data: unknown, contextMap: SmtLoad<ContextMap> | null): Screenish[] {
  const name = school.name;
  return walk.screens.map((s) => {
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
        case "DV-SMT-O-MARKET-LINE": return <MarketLine o={o} schoolName={name} fullscreen={false} room={260} />;
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
        case "DV-SMT-P-PHASES": return <IndexedLines title="Roll by phase" lines={p.trends.phases} fullscreen={false} room={260} />;
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

function AdmissionsWalk({ walk, urn, schoolName }: { walk: Walk; urn: string; schoolName: string }) {
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
  if (data.status === "loading") return <Loading walk={walk} ctx={{ entry: label }} />;
  if (data.status === "error") return <Loading walk={walk} ctx={{ entry: label }} text="This walk couldn't load Admissions' figures for this entry point." />;
  const { p, m, r } = data.data;
  const ep = entryPoint(entry);
  // Review fixes (14 Nov, M1): every placeholder the catalogue's titles use, filled from the routes.
  const fill = admissionsTitleFill(entry, p);
  const screens: Screenish[] = walk.screens.map((s) => {
    const q = fillTemplate(s.question, { entry: label });
    const dv = dataviewById(s.view);
    const base = { question: q, title: fillTitle(dv?.titleTemplate ?? "", fill, dv?.label ?? s.view), note: dv?.note ?? "" };
    // The dashboard's own viewBody draws each screen (as the head office walk draws the group dashboard's).
    return { ...base, answer: admissionsAnswer(s.view, { label, p, m, r }), body: <AdmissionsWalkBody dv={s.view} urn={urn} schoolName={schoolName} entry={ep?.id ?? entry} pipeline={p} market={m} rivals={r} /> };
  });
  const n2 = walk.screens.length;
  return (
    <div style={admissionsVars(theme)}>
      <WalkFrame walk={walk} step={step} steps={n2} chip={`Admissions · ${label}`} ctx={{ entry: label }}>
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
  if (walk.product === "admissions") return <AdmissionsWalk walk={walk} urn={member.schoolUrn} schoolName={member.schoolName ?? ""} />;
  return <SmtWalk walk={walk} member={member} />;
}
