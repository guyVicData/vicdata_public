"use client";

// VicData 0.8 groups r2 (B, C, D): the group dashboards -- Overview and Schools (round 3 adds Academic
// and Pupils) -- drawn entirely from the shared shell (src/components/shell): Teacher's nav, ControlBar
// (the "G" badge, the switch, the focus chips in the subject chips' slot, the pills), the rows, RailPanel
// (the icon row, the notes, full screen as a focus mode), the phone's tabs. Group accent: orange.
//
// Wireframes: docs/wireframes/groups (Main, Schools, Phone). Who sees it is the server's decision
// (/api/group/dash, src/lib/groups/dash-access.ts); the page draws what it is given.
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTeacherTheme, type Theme } from "@/components/shell/TeacherChrome";
import { ControlBar, type FocusSubject } from "@/components/shell/ControlBar";
import { PillMenu } from "@/components/shell/PillMenu";
import { MenuDivider, MenuRow } from "@/components/shell/PanelMenu";
import { MenuChip } from "@/components/shell/FilterPills";
import { RailPanel, Tabs, type RailItem } from "@/components/shell/RailPanel";
import { PhoneStack, ShellPage, ShellRow } from "@/components/shell/Rows";
import { MethodNote } from "@/components/shell/MethodNote";
import { AdmissionsTeacherNav, Divider } from "@/components/admissions/controls";
import { Empty, EntryChip, Skeleton, admissionsVars } from "@/components/admissions/ui";
import { useWidth } from "@/components/admissions/views/charts";
import { GroupViewAsBanner } from "@/components/groups/GroupViewAsBanner";
import { groupVars } from "@/components/groups/ui";
import { useSmt } from "@/components/smt/api";
import { GROUP_NOTES, groupNote } from "@/catalogue/notes";
import { groupMethodOf } from "@/catalogue/methods-groups";
import { periodLabel } from "@/catalogue/years";
import { indexTo, indexBaseWords } from "@/lib/index-base";
import { UsageScopeContext, useUsagePageView, type UsageScope } from "@/lib/usage-client";
import { FOCI, FOCUS_LABEL, MEASURE_LABEL, parseCompare, type CompareKey, type Focus, type GroupOverview, type GroupSchools } from "@/lib/groups/dash";
import type { Reading } from "@/lib/groups/aggregates";
import { AcademicNow, BandsReserved, EntryCohorts, GroupShape, GrowingShrinking, ImprovingDeclining, LeavingAt16, MarketShare, ProjectionPerSchool, PupilsNow, SchoolsRanked, SubjectAreasAcross, ValueAddedPanel, type ProjectionRow } from "./views-r3";
import type { GroupAcademic, GroupPupils } from "@/lib/groups/dash-r3";
import { AgainstOthers, dateText, MAIN_ROWS, GroupMap, GroupNow, JoinedLeft, ResultsTrend, RollTrend, SchoolsNow, SchoolsTable, ShareOfPlaces, Shapes, SizeAndResults, WhoIsGrowing, shareFlag, sourcesWord, type MapSchool, type MembershipRow } from "./views";

export type GroupDash = "overview" | "schools" | "academic" | "pupils";
export const GROUP_DASHES: { key: GroupDash; label: string; live: boolean }[] = [
  { key: "overview", label: "Overview", live: true },
  { key: "schools", label: "Schools", live: true },
  { key: "academic", label: "Academic", live: true },
  { key: "pupils", label: "Pupils", live: true },
];
const PATH: Record<GroupDash, string> = { overview: "/teacher/group/overview", schools: "/teacher/group/schools", academic: "/teacher/group/academic", pupils: "/teacher/group/pupils" };
const DASH_ID: Record<GroupDash, string> = { overview: "vicdata.groups.overview", schools: "vicdata.groups.schools", academic: "vicdata.groups.academic", pupils: "vicdata.groups.pupils" };
const PHONE = 768;
const ROW_NOW = 530;
const ROW_TRENDS = 340;
export const GROUP_BADGE = <span className="text-[19px] font-extrabold leading-none">G</span>;

type Viewer = { as: "head_office" | "view_as" | "school"; accountId: string; groupId: string; name: string; urn: string | null };
export type DashResponse = { viewer: Viewer; source: "production" | "fixtures"; membership: MembershipRow[]; overview?: GroupOverview; map?: MapSchool[]; schools?: GroupSchools; now?: GroupOverview; candidates?: { id: string; label: string; schools: number }[]; academic?: GroupAcademic; pupils?: GroupPupils };

/** The page root's variables: Admissions' semantic colours, the group accent (orange). */
export function groupDashVars(theme: Theme): CSSProperties {
  const dark = theme === "dark";
  return {
    ...admissionsVars(theme),
    ...groupVars(theme),
    "--adm-tint": `rgba(251,146,60,${dark ? 0.12 : 0.14})`,
    "--adm-accent-text": dark ? "#fb923c" : "#c2410c",
    "--adm-on-accent": "#1f0f04",
    "--adm-range-edge": dark ? "#4a2c14" : "#fdba74",
  } as CSSProperties;
}

// ------------------------------------------------------------------------------- the address

type Params = { account: string | null; reading: Reading; compare: CompareKey; focus: Focus; school: string | null };
function readParams(): Params {
  const sp = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  return {
    account: sp.get("account"),
    reading: sp.get("reading") === "listed_now" ? "listed_now" : "at_time",
    compare: parseCompare(sp.get("compare")),
    focus: FOCI.includes(sp.get("focus") as Focus) ? (sp.get("focus") as Focus) : "all",
    school: sp.get("school"),
  };
}
function writeParams(p: Params) {
  const sp = new URLSearchParams(window.location.search);
  const set = (k: string, v: string | null, def: string | null) => (v === null || v === def ? sp.delete(k) : sp.set(k, v));
  set("account", p.account, null);
  set("reading", p.reading, "at_time");
  set("compare", p.compare, "peer_band");
  set("focus", p.focus, "all");
  set("school", p.school, null);
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
}

// ------------------------------------------------------------------------------------- page

export function GroupDashboard({ dash }: { dash: GroupDash }) {
  const [theme, setTheme] = useTeacherTheme();
  const [params, setParamsState] = useState<Params>(readParams);
  const setParams = (p: Partial<Params>) => {
    const next = { ...params, ...p };
    setParamsState(next);
    writeParams(next);
  };
  const q = new URLSearchParams({ dash, reading: params.reading, compare: params.compare, focus: params.focus });
  if (params.account) q.set("account", params.account);
  const load = useSmt<DashResponse>(`/api/group/dash?${q.toString()}`, null);
  return (
    <main id="teacher-root" data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupDashVars(theme)}>
      {load.status === "ready" ? (
        <Dashboard d={load.data} dash={dash} params={params} setParams={setParams} theme={theme} onTheme={setTheme} />
      ) : (
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-7 py-5">
          <GroupViewAsBanner />
          <AdmissionsTeacherNav schoolUrn={null} theme={theme} onTheme={setTheme} />
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-[13px] text-[var(--muted2)]">
            {load.status === "loading" ? (
              "Loading the group…"
            ) : load.code === 401 ? (
              <>
                <Link href={`/login?next=${PATH[dash]}`} className="font-bold text-[var(--group-accent-text)]">
                  Sign in
                </Link>{" "}
                to see the group dashboards.
              </>
            ) : load.code === 404 ? (
              "Not found."
            ) : (
              load.message
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------------- dashboard

type Ctx = { d: DashResponse; o: GroupOverview; s: GroupSchools | null; dash: GroupDash; params: Params; average: boolean; phone: boolean; focusBar: ReactNode; highlight: (urn: string | null) => void; setNamed: (ids: string[]) => void; projection: ProjectionRow[] | null };

function Dashboard({ d, dash, params, setParams, theme, onTheme }: { d: DashResponse; dash: GroupDash; params: Params; setParams: (p: Partial<Params>) => void; theme: Theme; onTheme: (t: Theme) => void }) {
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < PHONE;
  const router = useRouter();
  const [average, setAverage] = useState(false);
  const o = (dash === "schools" ? d.now : d.overview)!;
  // Pupils' projection: one area projection per member school, read apart (slower).
  const projQ = new URLSearchParams(params.account ? { account: params.account } : {});
  const proj = useSmt<{ rows: ProjectionRow[] }>(dash === "pupils" ? `/api/group/projection?${projQ.toString()}` : null, null);
  const s = d.schools ?? null;
  const quiet = d.viewer.as === "view_as";
  const usage: UsageScope | null = useMemo(
    () => (d.viewer.urn ? { product: "groups", urn: d.viewer.urn, dashboard: DASH_ID[dash], level: `${params.focus}/${params.reading}`, setKind: params.compare.split(":")[0], resolved: true } : null),
    [d.viewer.urn, dash, params.focus, params.reading, params.compare],
  );
  useUsagePageView(quiet ? null : usage);

  const phasesPresent = FOCI.filter((f) => f === "all" || (o.now.byPhase as Record<string, number>)[f] > 0);
  const chips: FocusSubject[] = phasesPresent.map((f) => ({ key: f, label: FOCUS_LABEL[f] }));
  const onFocus = (k: string) => setParams({ focus: k as Focus });
  const focusBar = (
    <span role="group" aria-label="Phase" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <EntryChip key={c.key} label={c.label} active={c.key === params.focus} onClick={() => onFocus(c.key)} />
      ))}
    </span>
  );
  const go = (k: GroupDash) => {
    if (k !== dash) router.push(`${PATH[k]}${window.location.search}`);
  };
  const switcher = (
    <div className="inline-flex shrink-0 rounded-full border border-[var(--panel-border2)] bg-[var(--box-bg)] p-[3px] print:hidden" role="group" aria-label="Dashboard">
      {GROUP_DASHES.map((x) => {
        const on = x.key === dash;
        return (
          <button
            key={x.key}
            type="button"
            aria-pressed={on}
            disabled={!x.live}
            title={x.live ? undefined : GROUP_NOTES.coming}
            onClick={() => go(x.key)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${on ? "bg-[var(--accent)] text-[#1f0f04]" : x.live ? "text-[var(--muted)] hover:text-[var(--fg)]" : "cursor-default text-[var(--muted2)] opacity-60"}`}
          >
            {x.label}
          </button>
        );
      })}
    </div>
  );

  const schoolsList = (s?.rows ?? d.map?.map((m) => ({ urn: m.urn, name: m.name })) ?? []).map((x) => ({ urn: x.urn, name: x.name })).sort((a, b) => a.name.localeCompare(b.name));
  const picked = schoolsList.find((x) => x.urn === params.school) ?? null;
  const highlightPill = (
    <PillMenu label="Highlight a school" value={picked ? picked.name : "pick one"} menuLabel="Highlight a school" width={300} align="right">
      {(close) => (
        <div className="max-h-[320px] overflow-y-auto">
          {picked && (
            <>
              <MenuRow label="× Clear" onClick={() => { setParams({ school: null }); close(); }} />
              <MenuDivider />
            </>
          )}
          {schoolsList.map((x) => (
            <MenuRow key={x.urn} label={x.name} selected={x.urn === params.school} onClick={() => { setParams({ school: x.urn }); close(); }} />
          ))}
        </div>
      )}
    </PillMenu>
  );
  const cmp = o.compare;
  const comparePill = (
    <PillMenu label="Compared against" value={cmp.label} menuLabel="Compared against" width={340} align="right" title={`${cmp.label}${cmp.n !== null ? `: ${cmp.n.toLocaleString("en-GB")} schools` : ""}`}>
      {(close) => (
        <>
          {cmp.options.filter((x) => !x.key.startsWith("peer_named:")).map((x) => (
            <MenuRow key={x.key} label={`${x.label}${x.n !== null ? ` · ${x.n.toLocaleString("en-GB")} schools` : ""}`} title={x.info} selected={x.key === cmp.key} onClick={() => { setParams({ compare: x.key }); close(); }} />
          ))}
          {(d.candidates?.length ?? 0) > 0 && (
            <>
              <MenuDivider />
              <div className="px-3 pb-1 pt-1 text-[11px] font-bold text-[var(--muted2)]">Named groups (up to 3)</div>
              {d.candidates!.map((g) => {
                const ids = cmp.key.startsWith("peer_named:") ? cmp.key.slice(11).split(",") : [];
                const on = ids.includes(g.id);
                return (
                  <MenuRow
                    key={g.id}
                    label={`${g.label} · ${g.schools} schools`}
                    selected={on}
                    onClick={() => {
                      const next = on ? ids.filter((x) => x !== g.id) : [...ids, g.id].slice(-3);
                      setParams({ compare: next.length ? (`peer_named:${next.join(",")}` as CompareKey) : "peer_band" });
                      close();
                    }}
                  />
                );
              })}
            </>
          )}
          <div className="px-3 pb-2 pt-1 text-[11px] leading-snug text-[var(--muted2)]">{GROUP_NOTES.comparesOnly}</div>
        </>
      )}
    </PillMenu>
  );
  const undated = !o.group.sources.includes("gias_groups") && !o.group.sources.includes("gias");
  const readingPill = (
    <MenuChip
      label="Reading"
      value={params.reading}
      onPick={(reading) => setParams({ reading })}
      menuWidth={320}
      options={[
        { id: "at_time", label: GROUP_NOTES.readingAtTime, title: undated ? groupNote("combinedUndated", { source: sourcesWord(o.group.sources) }) : GROUP_NOTES.readingAtTimeWhy },
        { id: "listed_now", label: GROUP_NOTES.readingListed, title: GROUP_NOTES.readingListedWhy },
      ]}
    />
  );
  const pills = (
    <>
      <Divider />
      {highlightPill}
      {comparePill}
      {readingPill}
    </>
  );

  const ctx: Ctx = { d, o, s, dash, params, average, phone, focusBar, highlight: (urn) => setParams({ school: urn }), setNamed: (ids) => setParams({ compare: ids.length ? (`peer_named:${ids.join(",")}` as CompareKey) : "peer_band" }), projection: proj.status === "ready" ? proj.data.rows : proj.status === "error" ? [] : null };
  const layout = LAYOUT[dash];
  const [open, setOpen] = useState<Record<string, boolean>>({ now: true, trends: true });
  const census = o.years.census;
  const rowContext = (row: "now" | "trends") =>
    row === "now"
      ? `January ${census + 1} census · ${groupNote("membershipAsOf", { date: dateText(o.group.asOf), source: sourcesWord(o.group.sources) }).replace(/\.$/, "")} · ${params.reading === "at_time" ? GROUP_NOTES.readingAtTime.toLowerCase() : GROUP_NOTES.readingListed.toLowerCase()}`
      : dash === "schools" || dash === "pupils"
        ? `${periodLabel(o.years.first)} to ${periodLabel(census)}${dash === "pupils" ? `, against ${cmp.label}` : ""}`
        : dash === "academic"
          ? `pupil-weighted, by phase, against ${cmp.label}`
          : `indexed, like for like, against ${cmp.label}`;

  return (
    <UsageScopeContext.Provider value={quiet ? null : usage}>
      <ShellPage phone={phone} rootRef={rootRef}>
        <GroupViewAsBanner />
        <div className={phone ? "px-4 pt-4" : undefined}>
          <AdmissionsTeacherNav schoolUrn={d.viewer.urn} theme={theme} onTheme={onTheme} />
        </div>
        {d.source === "fixtures" && <div className="mx-auto mt-2 rounded-[8px] border border-dashed border-[var(--group-chip-border)] px-3 py-1 text-[11.5px] text-[var(--group-chip-fg)]">Fixture data: the ingest&rsquo;s dry run, not yet promoted.</div>}
        {phone ? (
          <PhoneStack>
            <div className="text-[16px] font-bold">{o.group.name}</div>
            <div className="self-start">{switcher}</div>
            <div className="flex flex-wrap gap-[6px]">
              {chips.map((c) => (
                <EntryChip key={c.key} label={c.key === "all" ? "All" : c.label} active={c.key === params.focus} onClick={() => onFocus(c.key)} />
              ))}
            </div>
            <PhoneBody c={ctx} layout={layout} />
          </PhoneStack>
        ) : (
          <>
            <ControlBar
              phase="ks4"
              phaseLabel={o.group.name}
              schoolName={`${o.group.typeLabel} · ${o.group.confirmed + o.group.likely} schools`}
              measure="candidates"
              onMeasure={() => undefined}
              badge={GROUP_BADGE}
              switcher={switcher}
              subjectsLabel="Phase"
              subjects={chips}
              focusKey={params.focus}
              onFocus={onFocus}
              onEditSubjects={() => undefined}
              noEdit
              chrome={pills}
            />
            {(["now", "trends"] as const).map((row) => (
              <ShellRow key={row} title={row === "now" ? "Now" : "Trends"} context={rowContext(row)} open={open[row] !== false} onToggle={() => setOpen((x) => ({ ...x, [row]: x[row] === false }))}>
                {layout[row].map((cell) => (
                  <Cell key={cell.id} cell={cell} c={ctx} height={row === "now" ? ROW_NOW : ROW_TRENDS} onAverage={setAverage} />
                ))}
              </ShellRow>
            ))}
          </>
        )}
      </ShellPage>
    </UsageScopeContext.Provider>
  );
}

// -------------------------------------------------------------------------------- the layout

type ViewId =
  | "GRP-O-NOW" | "GRP-O-AGAINST" | "GRP-O-MAP" | "GRP-O-JOINED" | "GRP-O-ROLL" | "GRP-O-RESULTS" | "GRP-O-SHARE"
  | "GRP-S-NOW" | "GRP-S-TABLE" | "GRP-S-GROWING" | "GRP-S-SCATTER" | "GRP-S-SHAPES"
  | "GRP-A-NOW" | "GRP-A-RANKED" | "GRP-A-AREAS" | "GRP-A-VA" | "GRP-A-TREND" | "GRP-A-POST16" | "GRP-A-IMPROVING" | "GRP-A-BANDS"
  | "GRP-P-NOW" | "GRP-P-SHAPE" | "GRP-P-ENTRIES" | "GRP-P-LEAVING" | "GRP-P-MARKET" | "GRP-P-ROLL" | "GRP-P-PROJECTION" | "GRP-P-GROWING";
type CellDef = { id: string; span: 1 | 2; views: { id: ViewId; label: string; icon: string }[] };
export const GROUP_VIEWS: Record<ViewId, { label: string; icon: string }> = {
  "GRP-O-NOW": { label: "The group now", icon: "TilesIcon" },
  "GRP-O-AGAINST": { label: "Against others", icon: "TableIcon" },
  "GRP-O-MAP": { label: "Map", icon: "MapPinIcon" },
  "GRP-O-JOINED": { label: "Joined and left", icon: "RankListIcon" },
  "GRP-O-ROLL": { label: "Combined roll, indexed", icon: "IndexedLineIcon" },
  "GRP-O-RESULTS": { label: "Results by phase", icon: "TrendLineIcon" },
  "GRP-O-SHARE": { label: "Share of places", icon: "HorizontalBarsIcon" },
  "GRP-S-NOW": { label: "The group now", icon: "TilesIcon" },
  "GRP-S-TABLE": { label: "Schools", icon: "TableIcon" },
  "GRP-S-GROWING": { label: "Who is growing", icon: "TrendLineIcon" },
  "GRP-S-SCATTER": { label: "Size and results", icon: "AdmScatterIcon" },
  "GRP-S-SHAPES": { label: "Shapes", icon: "AdmShapeIcon" },
  "GRP-A-NOW": { label: "Results now", icon: "TilesIcon" },
  "GRP-A-RANKED": { label: "Schools ranked", icon: "RankListIcon" },
  "GRP-A-AREAS": { label: "Subject areas", icon: "AdmStrengthsIcon" },
  "GRP-A-VA": { label: "Value added", icon: "ChangeArrowIcon" },
  "GRP-A-TREND": { label: "Results trend", icon: "TrendLineIcon" },
  "GRP-A-POST16": { label: "Post-16 trend", icon: "TrendLineIcon" },
  "GRP-A-IMPROVING": { label: "Improving and declining", icon: "VerticalBarsIcon" },
  "GRP-A-BANDS": { label: "Results by band", icon: "GradesIcon" },
  "GRP-P-NOW": { label: "Pupils now", icon: "TilesIcon" },
  "GRP-P-SHAPE": { label: "The group's shape", icon: "AdmShapeIcon" },
  "GRP-P-ENTRIES": { label: "Entry cohorts", icon: "AdmPipelineIcon" },
  "GRP-P-LEAVING": { label: "Leaving at 16", icon: "TableIcon" },
  "GRP-P-MARKET": { label: "Market share", icon: "HorizontalBarsIcon" },
  "GRP-P-ROLL": { label: "Roll, indexed", icon: "IndexedLineIcon" },
  "GRP-P-PROJECTION": { label: "Children around the schools", icon: "AdmPopulationIcon" },
  "GRP-P-GROWING": { label: "Growing and shrinking", icon: "VerticalBarsIcon" },
};
const v = (id: ViewId) => ({ id, ...GROUP_VIEWS[id] });
const LAYOUT: Record<GroupDash, { now: CellDef[]; trends: CellDef[] }> = {
  academic: {
    now: [
      { id: "a-now", span: 1, views: [v("GRP-A-NOW")] },
      { id: "a-large", span: 2, views: [v("GRP-A-RANKED"), v("GRP-A-AREAS"), v("GRP-A-VA")] },
    ],
    trends: [
      { id: "a-trend", span: 1, views: [v("GRP-A-TREND")] },
      { id: "a-post16", span: 1, views: [v("GRP-A-POST16")] },
      { id: "a-improving", span: 1, views: [v("GRP-A-IMPROVING"), v("GRP-A-BANDS")] },
    ],
  },
  pupils: {
    now: [
      { id: "p-now", span: 1, views: [v("GRP-P-NOW")] },
      { id: "p-large", span: 2, views: [v("GRP-P-SHAPE"), v("GRP-P-ENTRIES"), v("GRP-P-LEAVING"), v("GRP-P-MARKET")] },
    ],
    trends: [
      { id: "p-roll", span: 1, views: [v("GRP-P-ROLL")] },
      { id: "p-projection", span: 1, views: [v("GRP-P-PROJECTION")] },
      { id: "p-growing", span: 1, views: [v("GRP-P-GROWING")] },
    ],
  },
  overview: {
    now: [
      { id: "o-now", span: 1, views: [v("GRP-O-NOW")] },
      { id: "o-large", span: 2, views: [v("GRP-O-AGAINST"), v("GRP-O-MAP"), v("GRP-O-JOINED")] },
    ],
    trends: [
      { id: "o-roll", span: 1, views: [v("GRP-O-ROLL")] },
      { id: "o-results", span: 1, views: [v("GRP-O-RESULTS")] },
      { id: "o-share", span: 1, views: [v("GRP-O-SHARE")] },
    ],
  },
  schools: {
    now: [
      { id: "s-now", span: 1, views: [v("GRP-S-NOW")] },
      { id: "s-large", span: 2, views: [v("GRP-S-TABLE"), v("GRP-O-MAP")] },
    ],
    trends: [
      { id: "s-growing", span: 1, views: [v("GRP-S-GROWING")] },
      { id: "s-scatter", span: 1, views: [v("GRP-S-SCATTER")] },
      { id: "s-shapes", span: 1, views: [v("GRP-S-SHAPES")] },
    ],
  },
};

function Cell({ cell, c, height, onAverage }: { cell: CellDef; c: Ctx; height: number; onAverage: (a: boolean) => void }) {
  const [active, setActive] = useState(cell.views[0].id);
  const rail: RailItem[] = cell.views.map((x) => ({ id: x.id, label: x.label, icon: x.icon }));
  const h = headerOf(active, c);
  const weighting =
    active === "GRP-O-AGAINST" || active === "GRP-O-RESULTS" || active === "GRP-A-NOW" || active === "GRP-A-TREND" || active === "GRP-A-POST16" ? (
      <MenuChip label="Weighting" value={c.average ? "average" : "pupil"} onPick={(x) => onAverage(x === "average")} options={[{ id: "pupil", label: "Pupil-weighted" }, { id: "average", label: "Average school" }]} />
    ) : null;
  return (
    <RailPanel
      id={cell.id}
      tag={h.tag}
      context={h.context}
      chips={weighting}
      rail={rail}
      railActive={active}
      onRail={(id) => setActive(id as ViewId)}
      source={sourceOf(active, c)}
      caption={captionOf(active, c)}
      height={height}
      span={cell.span}
      title={GROUP_VIEWS[active].label}
      focusBar={c.focusBar}
      flag={flagOf(active, c)}
    >
      {({ fullscreen, height: room }) => <ViewBody id={active} c={c} fullscreen={fullscreen} room={room} />}
    </RailPanel>
  );
}

function headerOf(id: ViewId, c: Ctx): { tag: string; context: ReactNode } {
  const f = FOCUS_LABEL[c.params.focus].toLowerCase();
  switch (id) {
    case "GRP-O-NOW":
    case "GRP-S-NOW":
      return { tag: "Current", context: f };
    case "GRP-O-AGAINST":
      return { tag: "Against others", context: "the group, its peers, non-group schools, its areas and England" };
    case "GRP-O-MAP":
      return { tag: "Map", context: "member schools, sized by roll" };
    case "GRP-O-JOINED":
      return { tag: "Joined and left", context: "as the source dates it" };
    case "GRP-O-ROLL": {
      const { base } = indexTo(c.o.trends.roll.lines.map((l) => l.pts));
      return { tag: "Trends", context: `${indexBaseWords(base)} = 100` };
    }
    case "GRP-O-RESULTS":
      return { tag: "Trends", context: "by phase" };
    case "GRP-O-SHARE":
      return { tag: "Share", context: "of places in its areas" };
    case "GRP-S-TABLE":
      return { tag: "Schools", context: "every member school · sortable" };
    case "GRP-S-GROWING":
      return { tag: "Trends", context: "each school's roll, indexed" };
    case "GRP-S-SCATTER":
      return { tag: "Size and results", context: FOCUS_LABEL[c.params.focus] };
    case "GRP-S-SHAPES":
      return { tag: "Shapes", context: "each school by age" };
    case "GRP-A-NOW":
      return { tag: "Current", context: f };
    case "GRP-A-RANKED":
      return { tag: "Schools ranked", context: `each school against the group, ${c.o.compare.label} and England` };
    case "GRP-A-AREAS":
      return { tag: "Subject areas", context: "gap to England" };
    case "GRP-A-VA":
      return { tag: "Value added", context: "DfE, where published" };
    case "GRP-A-TREND":
      return { tag: "Trends", context: "pupil-weighted, by phase" };
    case "GRP-A-POST16":
      return { tag: "Trends", context: "Post-16" };
    case "GRP-A-IMPROVING":
      return { tag: "Change by school", context: `since ${periodLabel(c.d.academic?.improving.from ?? 2022)}` };
    case "GRP-A-BANDS":
      return { tag: "Trends", context: "results by band" };
    case "GRP-P-NOW":
      return { tag: "Current", context: f };
    case "GRP-P-SHAPE":
      return { tag: "Shape", context: "the group's pupils by age" };
    case "GRP-P-ENTRIES":
      return { tag: "Entry cohorts", context: "each school, read-only" };
    case "GRP-P-LEAVING":
      return { tag: "Leaving at 16", context: "Year 11 to Year 12" };
    case "GRP-P-MARKET":
      return { tag: "Market share", context: "each school in its own area" };
    case "GRP-P-ROLL": {
      const { base } = indexTo(c.o.trends.roll.lines.map((l) => l.pts));
      return { tag: "Trends", context: `${indexBaseWords(base)} = 100` };
    }
    case "GRP-P-PROJECTION":
      return { tag: "Forward", context: "each school's area, not a forecast" };
    case "GRP-P-GROWING":
      return { tag: "Trends", context: "schools growing and shrinking" };
  }
}

function methodVars(c: Ctx): Record<string, string | number | null> {
  const r = c.o.years.results;
  const latest = Object.values(r).filter((x): x is number => x !== null);
  const { base } = indexTo(c.o.trends.roll.lines.map((l) => l.pts));
  return {
    membershipSources: sourcesWord(c.o.group.sources),
    asOf: c.o.group.asOf,
    census: periodLabel(c.o.years.census),
    resultsYear: latest.length ? periodLabel(Math.max(...latest)) : null,
    setLabel: `${c.o.compare.label}${c.o.compare.n !== null ? ` (${c.o.compare.n.toLocaleString("en-GB")} schools)` : ""}`,
    reading: c.params.reading === "at_time" ? GROUP_NOTES.readingAtTime : GROUP_NOTES.readingListed,
    from: periodLabel(c.o.years.first),
    base: indexBaseWords(base),
  };
}

function sourceOf(id: ViewId, c: Ctx): ReactNode {
  return (
    <>
      {GROUP_VIEWS[id].label}. {sourcesWord(c.o.group.sources)} membership; DfE school census and performance tables, through VicData&rsquo;s group figures.
      <MethodNote id={id} method={groupMethodOf(id, methodVars(c))} />
    </>
  );
}

function captionOf(id: ViewId, c: Ctx): ReactNode {
  const undated = !c.o.group.sources.includes("gias_groups") && !c.o.group.sources.includes("gias");
  const reading = c.params.reading === "at_time" ? (undated ? groupNote("combinedUndated", { source: sourcesWord(c.o.group.sources) }) : GROUP_NOTES.combinedAtTime) : GROUP_NOTES.combined;
  switch (id) {
    case "GRP-O-AGAINST":
      return `${GROUP_NOTES.comparesOnly} ${GROUP_NOTES.missingListed}${c.params.compare === "mix_matched" ? ` ${groupNote("mixMatched", { group: c.o.group.name })}` : ""}`;
    case "GRP-S-TABLE":
      return GROUP_NOTES.missingListed;
    case "GRP-O-ROLL":
    case "GRP-S-GROWING":
      return `${reading} ${GROUP_NOTES.likeForLike}`;
    default:
      return reading;
  }
}

function flagOf(id: ViewId, c: Ctx): ReactNode {
  if (id === "GRP-O-SHARE") return shareFlag(c.o.trends.share.series);
  if (id === "GRP-O-ROLL" || id === "GRP-O-AGAINST") {
    const g = c.o.against.rows[0]?.roll.pct;
    const peer = c.o.against.rows.find((r) => r.key === "peer_band:band")?.roll.pct;
    if (g === null || g === undefined) return null;
    if (id === "GRP-O-AGAINST" && peer !== null && peer !== undefined) {
      const dd = g - peer;
      return <span className={`text-[12px] font-bold ${dd > 0.5 ? "text-[var(--adm-up-fg)]" : dd < -0.5 ? "text-[var(--adm-down-fg)]" : "text-[var(--muted2)]"}`}>{dd > 0.5 ? "▲ Growing faster than peers" : dd < -0.5 ? "▼ Growing slower than peers" : "▬ In line with peers"}</span>;
    }
    return <span className={`text-[12px] font-bold ${g > 1 ? "text-[var(--adm-up-fg)]" : g < -1 ? "text-[var(--adm-down-fg)]" : "text-[var(--muted2)]"}`}>{g > 1 ? "▲ Growing" : g < -1 ? "▼ Shrinking" : "▬ Steady"}</span>;
  }
  if (id === "GRP-S-GROWING") {
    const ch = c.o.now.change["1"];
    return <span className="text-[12px] font-bold text-[var(--muted2)]">▲ {ch.growing} of {ch.of} growing</span>;
  }
  return null;
}

function ViewBody({ id, c, fullscreen, room }: { id: ViewId; c: Ctx; fullscreen: boolean; room?: number }) {
  const hl = c.params.school;
  switch (id) {
    case "GRP-O-NOW":
      return <GroupNow o={c.o} compact={c.phone && !fullscreen} />;
    case "GRP-O-AGAINST":
      return <AgainstOthers o={c.o} average={c.average} candidates={c.d.candidates} onNamed={c.setNamed} />;
    case "GRP-O-MAP":
      return c.d.map ? <GroupMap name={c.o.group.name} schools={c.d.map} highlight={hl} fullscreen={fullscreen} room={room} /> : <Empty>The map is on Overview.</Empty>;
    case "GRP-O-JOINED":
      return <JoinedLeft membership={c.d.membership} />;
    case "GRP-O-ROLL":
      return <RollTrend o={c.o} fullscreen={fullscreen} room={room} />;
    case "GRP-O-RESULTS":
      return <ResultsTrend o={c.o} average={c.average} fullscreen={fullscreen} room={room} />;
    case "GRP-O-SHARE":
      return <ShareOfPlaces o={c.o} fullscreen={fullscreen} />;
    case "GRP-S-NOW":
      return c.s ? <SchoolsNow o={c.o} membership={c.d.membership} schools={c.s} /> : <Skeleton />;
    case "GRP-S-TABLE":
      return c.s ? <SchoolsTable s={c.s} highlight={hl} onHighlight={(u) => c.highlight(u === hl ? null : u)} /> : <Skeleton />;
    case "GRP-S-GROWING":
      return c.s ? <WhoIsGrowing s={c.s} o={c.o} highlight={hl} fullscreen={fullscreen} room={room} /> : <Skeleton />;
    case "GRP-S-SCATTER":
      return c.s ? <SizeAndResults s={c.s} highlight={hl} fullscreen={fullscreen} room={room} /> : <Skeleton />;
    case "GRP-S-SHAPES":
      return c.s ? <Shapes s={c.s} highlight={hl} fullscreen={fullscreen} /> : <Skeleton />;
  }
  const a = c.d.academic;
  const p = c.d.pupils;
  switch (id) {
    case "GRP-A-NOW":
      return a ? <AcademicNow a={a} average={c.average} /> : <Skeleton />;
    case "GRP-A-RANKED":
      return a ? <SchoolsRanked a={a} highlight={hl} fullscreen={fullscreen} /> : <Skeleton />;
    case "GRP-A-AREAS":
      return a ? <SubjectAreasAcross a={a} /> : <Skeleton />;
    case "GRP-A-VA":
      return a ? <ValueAddedPanel a={a} fullscreen={fullscreen} /> : <Skeleton />;
    case "GRP-A-TREND":
      return <ResultsTrend o={c.o} average={c.average} fullscreen={fullscreen} room={room} />;
    case "GRP-A-POST16":
      return a && a.post16 ? <ResultsTrend o={{ ...c.o, trends: { ...c.o.trends, results: a.post16 } }} average={c.average} fullscreen={fullscreen} room={room} /> : <Empty>No sixth-form results in the group.</Empty>;
    case "GRP-A-IMPROVING":
      return a ? <ImprovingDeclining a={a} /> : <Skeleton />;
    case "GRP-A-BANDS":
      return <BandsReserved />;
    case "GRP-P-NOW":
      return p ? <PupilsNow p={p} compact={c.phone && !fullscreen} /> : <Skeleton />;
    case "GRP-P-SHAPE":
      return p ? <GroupShape p={p} fullscreen={fullscreen} room={room} /> : <Skeleton />;
    case "GRP-P-ENTRIES":
      return p ? <EntryCohorts p={p} highlight={hl} fullscreen={fullscreen} room={room} /> : <Skeleton />;
    case "GRP-P-LEAVING":
      return p ? <LeavingAt16 p={p} fullscreen={fullscreen} /> : <Skeleton />;
    case "GRP-P-MARKET":
      return p ? <MarketShare p={p} fullscreen={fullscreen} /> : <Skeleton />;
    case "GRP-P-ROLL":
      return <RollTrend o={c.o} fullscreen={fullscreen} room={room} />;
    case "GRP-P-PROJECTION":
      return <ProjectionPerSchool rows={c.projection} fullscreen={fullscreen} />;
    case "GRP-P-GROWING":
      return p ? <GrowingShrinking p={p} /> : <Skeleton />;
  }
  return null;
}

// -------------------------------------------------------------------------------------- phone

function PhoneBody({ c, layout }: { c: Ctx; layout: { now: CellDef[]; trends: CellDef[] } }) {
  const now = layout.now[0].views[0].id;
  const large = layout.now[1];
  const [tab, setTab] = useState<ViewId>(large.views[0].id);
  const [trendTab, setTrendTab] = useState<ViewId>(layout.trends[0].views[0].id);
  const SHORT: Partial<Record<ViewId, string>> = { "GRP-O-ROLL": "Roll", "GRP-O-RESULTS": "Results", "GRP-O-SHARE": "Share", "GRP-S-GROWING": "Growing", "GRP-S-SCATTER": "Size and results", "GRP-S-SHAPES": "Shapes", "GRP-A-TREND": "Results", "GRP-A-POST16": "Post-16", "GRP-A-IMPROVING": "By school", "GRP-P-ROLL": "Roll", "GRP-P-PROJECTION": "Forward", "GRP-P-GROWING": "Growing" };
  const trendItems: RailItem[] = layout.trends.map((t) => ({ id: t.views[0].id, label: SHORT[t.views[0].id] ?? t.views[0].label, icon: "" }));
  return (
    <>
      <RailPanel tag={`The group now · ${periodLabel(c.o.years.census)}`} title="The group now" height="auto" source={sourceOf(now, c)} caption={captionOf(now, c)} focusBar={c.focusBar}>
        {({ fullscreen }) => <ViewBody id={now} c={c} fullscreen={fullscreen} />}
      </RailPanel>
      <RailPanel tag={GROUP_VIEWS[tab].label} title={GROUP_VIEWS[tab].label} height="auto" source={sourceOf(tab, c)} caption={captionOf(tab, c)} controls={<Tabs items={large.views.map((x) => ({ id: x.id, label: x.id === "GRP-O-JOINED" ? "Joined" : x.label, icon: x.icon }))} active={tab} onPick={(x) => setTab(x as ViewId)} />} focusBar={c.focusBar} flag={flagOf(tab, c)}>
        {({ fullscreen, height }) => (
          <div className="flex min-h-[200px] flex-col gap-2">
            {tab === "GRP-O-AGAINST" && !fullscreen ? <PhoneAgainst o={c.o} /> : <ViewBody id={tab} c={c} fullscreen={fullscreen} room={height} />}
          </div>
        )}
      </RailPanel>
      <RailPanel tag={GROUP_VIEWS[trendTab].label} title={GROUP_VIEWS[trendTab].label} height="auto" source={sourceOf(trendTab, c)} caption={captionOf(trendTab, c)} controls={<Tabs items={trendItems} active={trendTab} onPick={(x) => setTrendTab(x as ViewId)} />} focusBar={c.focusBar} flag={flagOf(trendTab, c)}>
        {({ fullscreen, height }) => (
          <div className="flex min-h-[160px] flex-col gap-2">
            <ViewBody id={trendTab} c={c} fullscreen={fullscreen} room={height} />
          </div>
        )}
      </RailPanel>
    </>
  );
}

/** The phone's Against others: one line per set, the roll and the phase's headline (Phone.dc.html). */
function PhoneAgainst({ o }: { o: GroupOverview }) {
  const m = o.against.columns[0];
  return (
    <div className="flex flex-col text-[12.5px]">
      {o.against.rows.filter((r) => MAIN_ROWS.includes(r.key) || r.kind === "peer_named").map((r, i) => (
        <div key={r.key} className="flex items-baseline justify-between gap-2 border-b border-[var(--panel-border)] py-1.5 last:border-0">
          <span className={i === 0 ? "font-bold text-[var(--adm-accent-text)]" : ""}>{r.label}</span>
          <span className={i === 0 ? "font-bold" : ""}>
            {r.roll.pct === null ? "—" : `${r.roll.pct > 0.5 ? "▲" : r.roll.pct < -0.5 ? "▼" : "▬"} ${Math.abs(r.roll.pct).toFixed(1)}%`} · {m ? `${MEASURE_LABEL[m] === "Attainment 8" ? "A8" : MEASURE_LABEL[m]} ${r.cells[m]?.value?.toFixed(1) ?? "—"}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
