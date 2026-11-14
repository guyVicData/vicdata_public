"use client";

// VicData 0.8 groups r2 (B, C, D): the group dashboards -- Overview and Schools (round 3 adds Academic
// and Pupils) -- drawn entirely from the shared shell (src/components/shell): Teacher's nav, ControlBar
// (the "G" badge, the switch, the focus chips in the subject chips' slot, the pills), the rows, RailPanel
// (the icon row, the notes, full screen as a focus mode), the phone's tabs. Group accent: orange.
//
// Wireframes: docs/wireframes/groups (Main, Schools, Phone). Who sees it is the server's decision
// (/api/group/dash, src/lib/groups/dash-access.ts); the page draws what it is given.
import { GROUP_BRONZE } from "@/lib/teacher-view-theme";
import { activeWithContent, visibleRail } from "@/lib/rail-content";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboardTheme, useTeacherTheme, type Theme } from "@/components/shell/TeacherChrome";
import { MidBand, MidDashProvider, midRootProps, useMidPart } from "@/components/shell/MidDash";
import { ControlBar, type FocusSubject } from "@/components/shell/ControlBar";
import { PillMenu } from "@/components/shell/PillMenu";
import { MenuDivider, MenuRow } from "@/components/shell/PanelMenu";
import { MenuChip } from "@/components/shell/FilterPills";
import { ViewSurfaceProvider } from "@/components/feedback/ViewSurface";
import { groupSurface } from "@/components/feedback/surface";
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
import { periodLabel, ROLL_WORD, rollDirectionOfPct } from "@/catalogue/years";
import { indexTo, indexBaseWords } from "@/lib/index-base";
import { UsageScopeContext, useUsagePageView, type UsageScope } from "@/lib/usage-client";
import { englandWords, FOCI, FOCUS_LABEL, GROWING_SPAN, MEASURE_LABEL, type Focus, type GroupOverview, type GroupSchools } from "@/lib/groups/dash";
import { bandWords } from "@/lib/groups/group-sets";
import type { GroupSetsInfo } from "@/lib/groups/group-sets-server";
import { savedSetFromEditor, useEditorReturnReload } from "@/lib/sets/editor-return";
import { GroupSetPicker, GroupShowingPicker } from "./GroupSetPicker";
import { filterDash, subsetOf } from "@/lib/groups/subset-view";
import { normaliseShowing } from "@/lib/groups/group-sets";
import type { Reading } from "@/lib/groups/aggregates";
import { AcademicNow, BandsReserved, EntryCohorts, GroupShape, GrowingShrinking, ImprovingDeclining, LeavingAt16, MarketShare, ProjectionPerSchool, PupilsNow, SchoolsRanked, SubjectAreasAcross, ValueAddedPanel, type ProjectionRow } from "./views-r3";
import type { GroupAcademic, GroupPupils } from "@/lib/groups/dash-r3";
import { AgainstOthers, dateText, MAIN_ROWS, GroupMap, GroupNow, JoinedLeft, ResultsTrend, RollTrend, SchoolsNow, SchoolsTable, ShareOfPlaces, Shapes, SizeAndResults, WhoIsGrowing, shareFlag, sourcesWord, type MapSchool, type MembershipRow } from "./views";
import { arrowOf, dirClass } from "@/components/smt/ui";
import { NmAgainst, NmFsmTrend, NmLine, NmNoResults, NmNow } from "./views-nm";
import { ARROW, arrowed } from "@/lib/signed-delta";

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
export type DashResponse = { viewer: Viewer; source: "production" | "fixtures"; membership: MembershipRow[]; overview?: GroupOverview; map?: MapSchool[]; schools?: GroupSchools; now?: GroupOverview; academic?: GroupAcademic; pupils?: GroupPupils; sets?: GroupSetsInfo; nearest?: { id: string; label: string; type: string; schools: number }[] };

/** The page root's variables: Admissions' semantic colours, the group accent (head office bronze). */
export function groupDashVars(theme: Theme): CSSProperties {
  const dark = theme === "dark";
  return {
    ...admissionsVars(theme),
    ...groupVars(theme),
    // 0.8 front door part 2 (FD5): head office bronze (orange before).
    "--adm-tint": `rgba(${GROUP_BRONZE[dark ? "dark" : "light"].tintRgb},${dark ? 0.12 : 0.14})`,
    "--adm-accent-text": GROUP_BRONZE[dark ? "dark" : "light"].accentText,
    "--adm-on-accent": "#1f0f04",
    "--adm-range-edge": GROUP_BRONZE[dark ? "dark" : "light"].rangeEdge,
  } as CSSProperties;
}

// ------------------------------------------------------------------------------- the address

// 0.8 group sets (M4): ?compare= is the set picker's key (src/lib/groups/group-sets.ts), absent for the
// page's default (the group's default set, else the size band); the server reads it, old keys included.
// M5: ?showing=set:<uuid> is a subset of the group's own schools (absent: all of them).
type Params = { account: string | null; reading: Reading; compare: string | null; focus: Focus; school: string | null; showing: string | null };
function readParams(): Params {
  const sp = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  return {
    account: sp.get("account"),
    reading: sp.get("reading") === "listed_now" ? "listed_now" : "at_time",
    compare: sp.get("compare")?.slice(0, 1200) || null,
    focus: FOCI.includes(sp.get("focus") as Focus) ? (sp.get("focus") as Focus) : "all",
    school: sp.get("school"),
    showing: normaliseShowing(sp.get("showing")),
  };
}
function writeParams(p: Params) {
  const sp = new URLSearchParams(window.location.search);
  const set = (k: string, v: string | null, def: string | null) => (v === null || v === def ? sp.delete(k) : sp.set(k, v));
  set("account", p.account, null);
  set("reading", p.reading, "at_time");
  set("compare", p.compare, null);
  set("focus", p.focus, "all");
  set("school", p.school, null);
  set("showing", p.showing, null);
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
}

// ------------------------------------------------------------------------------------- page

export function GroupDashboard({ dash }: { dash: GroupDash }) {
  // 0.8 front door 2b (M3): the Group pages follow Mid (the orange field with head office's bronze;
  // MidDash.tsx) once the group has loaded; loading and errors draw Dark under Mid, as before.
  const [plainTheme, setTheme] = useTeacherTheme();
  const dashTheme = useDashboardTheme();
  const [params, setParamsState] = useState<Params>(readParams);
  const setParams = (p: Partial<Params>) => {
    const next = { ...params, ...p };
    setParamsState(next);
    writeParams(next);
  };
  // A change to the sets (Make default) reads the page afresh: `v` keeps the answer out of the visit's cache.
  const [version, setVersion] = useState(0);
  const q = new URLSearchParams({ dash, reading: params.reading, focus: params.focus });
  if (params.compare) q.set("compare", params.compare);
  if (params.account) q.set("account", params.account);
  if (version) q.set("v", String(version));
  const load = useSmt<DashResponse>(`/api/group/dash?${q.toString()}`, null);
  // Back from the set editor: the saved set is used here (useSet in the address, or the handover).
  useEditorReturnReload();
  const [handed] = useState(() => savedSetFromEditor());
  const [applied, setApplied] = useState(false);
  if (!applied && handed && load.status === "ready") {
    setApplied(true);
    const s = load.data.sets?.sets.find((x) => x.id === handed);
    if (s && s.kind === "group_peers" && params.compare !== `set:${s.id}`) setParams({ compare: `set:${s.id}` });
    if (s && s.kind === "group_schools" && params.showing !== `set:${s.id}`) setParams({ showing: `set:${s.id}` });
  }
  const mid = dashTheme.mid && load.status === "ready";
  const theme: Theme = mid ? dashTheme.theme : plainTheme;
  return (
    <MidDashProvider mid={mid} part="group" theme={theme}>
    <main id="teacher-root" data-theme={theme} {...midRootProps(mid, "group")} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={groupDashVars(theme)}>
      {load.status === "ready" ? (
        <Dashboard d={load.data} dash={dash} params={params} setParams={setParams} theme={theme} onTheme={setTheme} onSetsChanged={() => setVersion((n) => n + 1)} />
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
    </MidDashProvider>
  );
}

// ---------------------------------------------------------------------------------- dashboard

type Ctx = { d: DashResponse; o: GroupOverview; s: GroupSchools | null; dash: GroupDash; params: Params; average: boolean; phone: boolean; focusBar: ReactNode; highlight: (urn: string | null) => void; projection: ProjectionRow[] | null };

function Dashboard({ d: whole, dash, params, setParams, theme, onTheme, onSetsChanged }: { d: DashResponse; dash: GroupDash; params: Params; setParams: (p: Partial<Params>) => void; theme: Theme; onTheme: (t: Theme) => void; onSetsChanged: () => void }) {
  // 0.8 front door 2b (M3): the nav draws in the header's own theme (Dark in Mid's band).
  const navTheme: Theme = useMidPart() ? "dark" : theme;
  // 0.8 group sets (M5): a subset filters every list of schools on the page; the group's figures stay whole.
  const subsetSet = params.showing ? (whole.sets?.sets.find((x) => x.kind === "group_schools" && `set:${x.id}` === params.showing) ?? null) : null;
  const total = (whole.now ?? whole.overview)!.group.confirmed + (whole.now ?? whole.overview)!.group.likely;
  const subset = useMemo(() => subsetOf(subsetSet, (whole.map ?? []).map((m) => m.urn), total), [subsetSet, whole.map, total]);
  const d = useMemo(() => (subset ? filterDash(whole, subset.kept) : whole), [whole, subset]);
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
    () => (d.viewer.urn ? { product: "groups", urn: d.viewer.urn, dashboard: DASH_ID[dash], level: `${params.focus}/${params.reading}`, setKind: o.picker.key.split(":")[0], resolved: true } : null),
    [d.viewer.urn, dash, params.focus, params.reading, o.picker.key],
  );
  useUsagePageView(quiet ? null : usage);

  // 0.8 non-mainstream groups: pools and FSM are whole-school, so a special, AP or nursery group's pages
  // show all phases only.
  const phasesPresent = FOCI.filter((f) => f === "all" || (!o.nm && (o.now.byPhase as Record<string, number>)[f] > 0));
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
      {/* 0.8 group sets (M3): the groups library, for head office (a member school's SMT doesn't see it, D2). */}
      {d.viewer.as !== "school" && (
        <Link href={`/teacher/group/groups${window.location.search}`} className="rounded-full px-4 py-1.5 text-[13px] font-bold text-[var(--group-accent-text)] hover:text-[var(--fg)]" data-library-link="">
          Groups library
        </Link>
      )}
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
  // 0.8 group sets (M4): the one set picker replaces the Compared-against pill, the named-group chips and
  // the Mix-matched toggle. Schools has no comparison: its selector is Showing (M5).
  const comparePill =
    dash === "schools" ? null : (
      <GroupSetPicker
        picker={o.picker}
        sets={d.sets ?? { sets: [], notSetUp: true, personalActive: 0, cap: 8, admin: false, canKeep: false, defaults: { group_peers: null, group_schools: null } }}
        account={d.viewer.accountId}
        phone={phone}
        onPick={(key) => setParams({ compare: key })}
        onChanged={onSetsChanged}
      />
    );
  const showingPill = (
    <GroupShowingPicker
      showing={subsetSet}
      total={total}
      sets={d.sets ?? { sets: [], notSetUp: true, personalActive: 0, cap: 8, admin: false, canKeep: false, defaults: { group_peers: null, group_schools: null } }}
      account={d.viewer.accountId}
      phone={phone}
      onPick={(key) => setParams({ showing: key, school: null })}
    />
  );
  // "Showing 18 of 59 schools · group figures are for all 59" (and leavers dropping out), under the bar.
  const subsetLine = subset ? (
    <div data-subset-line="" className={`text-[12.5px] font-semibold text-[var(--group-accent-text)] ${phone ? "" : "mx-auto max-w-[1440px] px-1"}`}>
      {subset.line}
      {subset.leftLine && <span className="ml-1 font-normal text-[var(--muted)]">· {subset.leftLine}</span>}
    </div>
  ) : null;
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
      {showingPill}
      {highlightPill}
      {comparePill}
      {readingPill}
    </>
  );

  const ctx: Ctx = { d, o, s, dash, params, average, phone, focusBar, highlight: (urn) => setParams({ school: urn }), projection: proj.status === "ready" ? (subset ? proj.data.rows.filter((r) => subset.kept.has(r.urn)) : proj.data.rows) : proj.status === "error" ? [] : null };
  const layout = o.nm ? NM_LAYOUT[dash] : LAYOUT[dash];
  const [open, setOpen] = useState<Record<string, boolean>>({ now: true, trends: true });
  const census = o.years.census;
  const rowContext = (row: "now" | "trends") =>
    row === "now"
      ? `January ${census + 1} census · ${groupNote("membershipAsOf", { date: dateText(o.group.asOf), source: sourcesWord(o.group.sources) }).replace(/\.$/, "")} · ${params.reading === "at_time" ? GROUP_NOTES.readingAtTime.toLowerCase() : GROUP_NOTES.readingListed.toLowerCase()}`
      : dash === "schools" || dash === "pupils"
        ? `${periodLabel(o.years.first)} to ${periodLabel(census)}${dash === "pupils" ? `, against ${cmp.label}` : ""}`
        : dash === "academic"
          ? `pupil-weighted, by phase, against ${cmp.label}`
          : o.nm
            ? `like for like, against ${cmp.label}`
            : `indexed, like for like, against ${cmp.label}`;

  // 0.8 notes and feedback: each view's private note and feedback icon, with what the page is showing.
  const surface = groupSurface({
    dashboard: { id: DASH_ID[dash], name: `${GROUP_DASHES.find((x) => x.key === dash)?.label ?? dash} (groups)` },
    groupId: d.viewer.groupId,
    ref: d.viewer.accountId,
    name: o.group.name,
    role: d.viewer.as === "school" ? "school" : "head_office",
    state: { focus: params.focus, reading: params.reading, compare: o.picker.key, school: params.school, weighting: average ? "average" : "pupil" },
  });

  return (
    <UsageScopeContext.Provider value={quiet ? null : usage}>
      <ViewSurfaceProvider surface={surface}>
      <ShellPage phone={phone} rootRef={rootRef}>
        {/* 0.8 front door 2b (M3): in Mid the header -- the banner, the nav, the control bar -- is a dark band
            and the rows below sit on the orange field. A fragment in Dark and Light (the same elements, in order). */}
        <MidBand bleed={!phone} className={phone ? "pb-3" : "flex flex-col gap-[14px]"} style={groupDashVars("dark")}>
        <GroupViewAsBanner />
        <div className={phone ? "px-4 pt-4" : undefined}>
          <AdmissionsTeacherNav schoolUrn={d.viewer.urn} theme={navTheme} onTheme={onTheme} />
        </div>
        {d.source === "fixtures" && <div className="mx-auto mt-2 rounded-[8px] border border-dashed border-[var(--group-chip-border)] px-3 py-1 text-[11.5px] text-[var(--group-chip-fg)]">Fixture data: the ingest&rsquo;s dry run, not yet promoted.</div>}
        {!phone && (
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
        )}
        </MidBand>
        {phone ? (
          <PhoneStack>
            <div className="text-[16px] font-bold">{o.group.name}</div>
            {/* 0.8 group sets: on a phone the switcher (with Groups library) scrolls sideways, never the page. */}
            <div className="max-w-full self-start overflow-x-auto">{switcher}</div>
            <div className="flex flex-wrap gap-[6px]">
              {chips.map((c) => (
                <EntryChip key={c.key} label={c.key === "all" ? "All" : c.label} active={c.key === params.focus} onClick={() => onFocus(c.key)} />
              ))}
            </div>
            {/* 0.8 group sets: the two selectors on a phone (full width, bottom sheets). */}
            {comparePill}
            {showingPill}
            {subsetLine}
            <PhoneBody c={ctx} layout={layout} />
          </PhoneStack>
        ) : (
          <>
            {subsetLine}
            {(["now", "trends"] as const).filter((row) => layout[row].length > 0).map((row) => (
              <ShellRow key={row} title={row === "now" ? "Now" : "Trends"} context={rowContext(row)} open={open[row] !== false} onToggle={() => setOpen((x) => ({ ...x, [row]: x[row] === false }))}>
                {layout[row].map((cell) => (
                  <Cell key={cell.id} cell={cell} c={ctx} height={row === "now" ? ROW_NOW : ROW_TRENDS} onAverage={setAverage} />
                ))}
              </ShellRow>
            ))}
          </>
        )}
      </ShellPage>
      </ViewSurfaceProvider>
    </UsageScopeContext.Provider>
  );
}

// -------------------------------------------------------------------------------- the layout

export type ViewId =
  | "GRP-O-NOW" | "GRP-O-AGAINST" | "GRP-O-MAP" | "GRP-O-JOINED" | "GRP-O-ROLL" | "GRP-O-RESULTS" | "GRP-O-SHARE"
  | "GRP-S-NOW" | "GRP-S-TABLE" | "GRP-S-GROWING" | "GRP-S-SCATTER" | "GRP-S-SHAPES"
  | "GRP-A-NOW" | "GRP-A-RANKED" | "GRP-A-AREAS" | "GRP-A-VA" | "GRP-A-TREND" | "GRP-A-POST16" | "GRP-A-IMPROVING" | "GRP-A-BANDS"
  | "GRP-P-NOW" | "GRP-P-SHAPE" | "GRP-P-ENTRIES" | "GRP-P-LEAVING" | "GRP-P-MARKET" | "GRP-P-ROLL" | "GRP-P-PROJECTION" | "GRP-P-GROWING"
  // 0.8 non-mainstream groups: a special and AP trust's or nursery federation's own views.
  | "GRP-N-NOW" | "GRP-N-AGAINST" | "GRP-N-LINE" | "GRP-N-FSM" | "GRP-N-RESULTS";
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
  "GRP-N-NOW": { label: "The group now", icon: "TilesIcon" },
  "GRP-N-AGAINST": { label: "Against others", icon: "TableIcon" },
  "GRP-N-LINE": { label: "Mainstream line", icon: "RankListIcon" },
  "GRP-N-FSM": { label: "FSM over time", icon: "TrendLineIcon" },
  "GRP-N-RESULTS": { label: "Results", icon: "GradesIcon" },
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

// 0.8 non-mainstream groups (M6): a special and AP trust's or nursery federation's pages. Roll, its
// same-schools change and FSM against its peer set and its kinds' pools; its mainstream line where it has
// one; no results anywhere, the reason in their place (R-NM-NO-RESULTS). Pupils keeps its own views (none
// is a result); Schools drops Size and results.
const NM_LAYOUT: Record<GroupDash, { now: CellDef[]; trends: CellDef[] }> = {
  overview: {
    now: [
      { id: "o-now", span: 1, views: [v("GRP-N-NOW")] },
      { id: "o-large", span: 2, views: [v("GRP-N-AGAINST"), v("GRP-N-LINE"), v("GRP-O-MAP"), v("GRP-O-JOINED")] },
    ],
    trends: [
      { id: "o-roll", span: 1, views: [v("GRP-O-ROLL")] },
      { id: "o-fsm", span: 1, views: [v("GRP-N-FSM")] },
      { id: "o-results", span: 1, views: [v("GRP-N-RESULTS"), v("GRP-O-SHARE")] },
    ],
  },
  academic: {
    now: [
      { id: "a-now", span: 1, views: [v("GRP-N-RESULTS")] },
      { id: "a-large", span: 2, views: [v("GRP-N-AGAINST"), v("GRP-N-LINE")] },
    ],
    trends: [],
  },
  pupils: LAYOUT.pupils,
  schools: {
    now: LAYOUT.schools.now,
    trends: [
      { id: "s-growing", span: 1, views: [v("GRP-S-GROWING")] },
      { id: "s-shapes", span: 2, views: [v("GRP-S-SHAPES")] },
    ],
  },
};

// 0.8 SMT feedback round 1 (F-6, R-RAIL-HIDES-EMPTY): which group views have something to show. Data
// still loading has content; the reserved bands and "the map is on Overview" say something, and stay.
function groupHasContent(id: string, c: Ctx): boolean {
  const a = c.d.academic;
  const p = c.d.pupils;
  switch (id) {
    case "GRP-O-MAP":
      return !c.d.map || c.d.map.some((s) => !s.outside && s.easting !== null && s.northing !== null);
    case "GRP-O-JOINED":
      return c.d.membership.length > 0;
    case "GRP-N-LINE":
      return !!c.o.nm?.line;
    case "GRP-A-RANKED":
      return !a || a.ranked.rows.length > 0;
    case "GRP-A-AREAS":
      return !a || !a.areas.stage || a.areas.rows.length > 0;
    case "GRP-A-IMPROVING":
      return !a || !!a.improving.of;
    case "GRP-P-SHAPE":
      return !p || p.shape.ages.some((n) => n > 0);
    case "GRP-P-ENTRIES":
      return !p || p.entries.some((e) => e.pts.filter((x) => x.value).length >= 2);
    case "GRP-P-LEAVING":
      return !p || p.leaving.length > 0;
    case "GRP-P-MARKET":
      return !p || p.market.rows.length > 0;
  }
  return true;
}

function Cell({ cell, c, height, onAverage }: { cell: CellDef; c: Ctx; height: number; onAverage: (a: boolean) => void }) {
  const [picked, setActive] = useState(cell.views[0].id);
  const all: RailItem[] = cell.views.map((x) => ({ id: x.id, label: x.label, icon: x.icon }));
  const has = (id: string) => groupHasContent(id, c);
  const rail = visibleRail(all, has);
  // F-6: a cell that would open on an empty view opens on the next one instead.
  const active = activeWithContent(all, picked, has) as ViewId;
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
      view={{ panelId: cell.id, panelName: null, instanceId: active, dataview: active }}
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
      return { tag: "Against others", context: c.o.sideBySide ? `side by side with ${c.o.picker.name}` : "the group, its peers, non-group schools, its areas and England" };
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
    case "GRP-N-NOW":
      return { tag: "Current", context: c.o.nm ? c.o.nm.byKind : f };
    case "GRP-N-AGAINST":
      return { tag: "Against others", context: c.o.sideBySide ? `side by side with ${c.o.picker.name}` : `its peers and ${c.o.nm?.family === "nursery" ? "state-funded nursery schools" : "state-funded schools of its kinds"}` };
    case "GRP-N-LINE":
      return { tag: "Mainstream line", context: "its mainstream schools, against mainstream schools" };
    case "GRP-N-FSM":
      return { tag: "Trends", context: "free school meals, pupil-weighted" };
    case "GRP-N-RESULTS":
      return { tag: "Results", context: "not compared" };
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
    setLabel: `${c.o.compare.label}${c.o.picker.countText ? ` (${c.o.picker.countText})` : c.o.compare.n !== null ? ` (${c.o.compare.n.toLocaleString("en-GB")} schools)` : ""}`,
    reading: c.params.reading === "at_time" ? GROUP_NOTES.readingAtTime : GROUP_NOTES.readingListed,
    from: periodLabel(c.o.years.first),
    base: indexBaseWords(base),
    // E1, E2: England follows the group's sector.
    england: englandWords(c.o.group.type.startsWith("independent") ? "independent" : "state").label,
    englandNote: englandWords(c.o.group.type.startsWith("independent") ? "independent" : "state").info,
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

// 0.8 notes and feedback: each view's "What this shows" line, at the top of its (i). Where it only
// repeated the (i) it is dropped: the reading sentence on the views whose method has the READING step,
// and Schools' table's "missing are listed" -- but an undated source's reading is kept, since the (i)
// doesn't say this group's source is undated.
const READING_IN_METHOD: ViewId[] = ["GRP-O-NOW", "GRP-S-NOW", "GRP-A-NOW", "GRP-P-NOW", "GRP-P-SHAPE", "GRP-O-ROLL", "GRP-O-RESULTS", "GRP-A-TREND", "GRP-A-POST16", "GRP-P-ROLL"];
function captionOf(id: ViewId, c: Ctx): ReactNode {
  const undated = !c.o.group.sources.includes("gias_groups") && !c.o.group.sources.includes("gias");
  const reading = c.params.reading === "at_time" ? (undated ? groupNote("combinedUndated", { source: sourcesWord(c.o.group.sources) }) : GROUP_NOTES.combinedAtTime) : GROUP_NOTES.combined;
  if (READING_IN_METHOD.includes(id)) return c.params.reading === "at_time" && undated ? reading : null;
  switch (id) {
    case "GRP-O-AGAINST":
      return c.o.sideBySide ? "Each row is a group's own figures; the median is one vote per group with a figure. A set may mix types; each group's rank stays within its own type." : `${GROUP_NOTES.comparesOnly} ${GROUP_NOTES.missingListed} ${groupNote("mixMatched", { group: c.o.group.name })}`;
    case "GRP-S-TABLE":
      // Its method says the missing schools are listed.
      return null;
    case "GRP-O-ROLL":
      return `${reading} ${GROUP_NOTES.likeForLike} ${groupNote("comparedAgainst", { set: c.o.compare.label })}${c.o.sideBySide ? ` ${bandWords(c.o.sideBySide.rows.length - 1)}` : ""}`;
    case "GRP-S-GROWING":
      return `${reading} ${GROUP_NOTES.likeForLike}`;
    // 0.8 IGCSE subjects (follow-up 5): the trends' legends truncate a long set name; the (i) has it in full.
    case "GRP-O-RESULTS":
    case "GRP-A-TREND":
    case "GRP-A-POST16":
    case "GRP-P-ROLL":
      return `${reading} ${groupNote("comparedAgainst", { set: c.o.compare.label })}${c.o.sideBySide ? ` ${bandWords(c.o.sideBySide.rows.length - 1)}` : ""}`;
    default:
      return reading;
  }
}

function flagOf(id: ViewId, c: Ctx): ReactNode {
  if (id === "GRP-O-SHARE") return shareFlag(c.o.trends.share.series);
  if (id === "GRP-O-ROLL" || id === "GRP-O-AGAINST") {
    const g = c.o.against.rows[0]?.roll.pct;
    // 0.8 group sets (M4): against a set of groups, the set's median stands in for the peers.
    const peer = c.o.sideBySide ? c.o.sideBySide.median.roll : c.o.against.rows.find((r) => r.key === "peer_band:band")?.roll.pct;
    const who = c.o.sideBySide ? "the set" : "peers";
    if (g === null || g === undefined) return null;
    if (id === "GRP-O-AGAINST" && peer !== null && peer !== undefined) {
      const dd = g - peer;
      return <span className={`text-[12px] font-bold ${dirClass(dd, 0.5, 1)}`}>{arrowOf(dd, 0.5, 1)} {dd > 0.5 ? `Growing faster than ${who}` : dd < -0.5 ? `Growing slower than ${who}` : `In line with ${who}`}</span>;
    }
    // R-ROLL-WORDS-3YR: the group's roll word is its like-for-like change over 3 census years, steady
    // when it rounds to 0% (R-FLAT-BAND). (It was the 5-year change with a ±1% band.)
    const g3 = c.o.now.change[GROWING_SPAN].sameSchools;
    if (g3 === null || g3 === undefined) return null;
    const d = rollDirectionOfPct(g3, 0);
    return <span className={`text-[12px] font-bold ${dirClass(g3, 0, 0)}`}>{ARROW[d]} {ROLL_WORD[d]}</span>;
  }
  if (id === "GRP-N-AGAINST" && c.o.nm) {
    // Its roll against its peer set (or the set's median), like for like over 1 year.
    const g = c.o.nm.against[0]?.change1;
    const peer = c.o.sideBySide ? (c.o.sideBySide.median.nm?.change1 ?? null) : (c.o.nm.against.find((r) => r.kind === "peer_band")?.change1 ?? null);
    const who = c.o.sideBySide ? "the set" : "peers";
    if (g === null || g === undefined || peer === null) return null;
    const dd = g - peer;
    return <span className={`text-[12px] font-bold ${dirClass(dd, 0.5, 1)}`}>{arrowOf(dd, 0.5, 1)} {dd > 0.5 ? `Growing faster than ${who}` : dd < -0.5 ? `Growing slower than ${who}` : `In line with ${who}`}</span>;
  }
  if (id === "GRP-S-GROWING") {
    const ch = c.o.now.change[GROWING_SPAN];
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
      return <AgainstOthers o={c.o} average={c.average} />;
    case "GRP-O-MAP":
      return c.d.map ? <GroupMap name={c.o.group.name} schools={c.d.map} highlight={hl} fullscreen={fullscreen} room={room} /> : <Empty>The map is on Overview.</Empty>;
    case "GRP-O-JOINED":
      return <JoinedLeft membership={c.d.membership} highlight={hl} />;
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
    case "GRP-N-NOW":
      return <NmNow o={c.o} compact={c.phone && !fullscreen} />;
    case "GRP-N-AGAINST":
      return <NmAgainst o={c.o} compact={c.phone && !fullscreen} />;
    case "GRP-N-LINE":
      return <NmLine o={c.o} compact={c.phone && !fullscreen} />;
    case "GRP-N-FSM":
      return <NmFsmTrend o={c.o} fullscreen={fullscreen} room={room} />;
    case "GRP-N-RESULTS":
      return <NmNoResults o={c.o} />;
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
      return a ? <ValueAddedPanel a={a} fullscreen={fullscreen} highlight={hl} /> : <Skeleton />;
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
      return p ? <LeavingAt16 p={p} fullscreen={fullscreen} highlight={hl} /> : <Skeleton />;
    case "GRP-P-MARKET":
      return p ? <MarketShare p={p} fullscreen={fullscreen} highlight={hl} /> : <Skeleton />;
    case "GRP-P-ROLL":
      return <RollTrend o={c.o} fullscreen={fullscreen} room={room} />;
    case "GRP-P-PROJECTION":
      return <ProjectionPerSchool rows={c.projection} fullscreen={fullscreen} highlight={hl} />;
    case "GRP-P-GROWING":
      return p ? <GrowingShrinking p={p} /> : <Skeleton />;
  }
  return null;
}

// ------------------------------------------------------------------------------ a walk's screen

/**
 * 0.8 front door (B12; Guy, 13 Nov): one group view for a walk's screen, drawn exactly as this dashboard
 * draws it -- the same ViewBody, header words, caption and flag -- from the dashboard route's own answer.
 * The rail is the view's own cell, in the dashboard's order, empty views hidden as the dashboard hides them.
 * The walk has no phone layout of its own (Part 2) and no highlight; Weighting is pupil-weighted, the
 * dashboard's default.
 */
export function groupWalkView(d: DashResponse, dash: GroupDash, id: ViewId, projection: ProjectionRow[] | null, room = 360) {
  const params: Params = { account: d.viewer.accountId, reading: "at_time", compare: null, focus: "all", school: null, showing: null };
  const o = (dash === "schools" ? d.now : d.overview)!;
  const c: Ctx = { d, o, s: d.schools ?? null, dash, params, average: false, phone: false, focusBar: null, highlight: () => {}, projection };
  const L = o.nm ? NM_LAYOUT[dash] : LAYOUT[dash];
  const cell = [...L.now, ...L.trends].find((x) => x.views.some((y) => y.id === id)) ?? null;
  const rail = cell ? visibleRail(cell.views.map((x) => ({ id: x.id, label: x.label, icon: x.icon })), (x) => groupHasContent(x, c)) : [];
  return {
    header: headerOf(id, c),
    caption: captionOf(id, c),
    flag: flagOf(id, c),
    rail,
    has: groupHasContent(id, c),
    body: <ViewBody id={id} c={c} fullscreen={false} room={room} />,
  };
}

// -------------------------------------------------------------------------------------- phone

function PhoneBody({ c, layout }: { c: Ctx; layout: { now: CellDef[]; trends: CellDef[] } }) {
  const now = layout.now[0].views[0].id;
  const large = layout.now[1];
  const [tabPicked, setTab] = useState<ViewId>(large.views[0].id);
  const tab = activeWithContent(large.views, tabPicked, (id) => groupHasContent(id, c)) as ViewId;
  const [trendTab, setTrendTab] = useState<ViewId>((layout.trends[0] ?? layout.now[0]).views[0].id);
  const SHORT: Partial<Record<ViewId, string>> = { "GRP-N-FSM": "FSM", "GRP-N-RESULTS": "Results", "GRP-O-ROLL": "Roll", "GRP-O-RESULTS": "Results", "GRP-O-SHARE": "Share", "GRP-S-GROWING": "Growing", "GRP-S-SCATTER": "Size and results", "GRP-S-SHAPES": "Shapes", "GRP-A-TREND": "Results", "GRP-A-POST16": "Post-16", "GRP-A-IMPROVING": "By school", "GRP-P-ROLL": "Roll", "GRP-P-PROJECTION": "Forward", "GRP-P-GROWING": "Growing" };
  const trendItems: RailItem[] = layout.trends.map((t) => ({ id: t.views[0].id, label: SHORT[t.views[0].id] ?? t.views[0].label, icon: "" }));
  return (
    <>
      <RailPanel tag={`The group now · ${periodLabel(c.o.years.census)}`} title="The group now" height="auto" source={sourceOf(now, c)} caption={captionOf(now, c)} focusBar={c.focusBar} view={{ panelId: layout.now[0].id, panelName: null, instanceId: now, dataview: now }}>
        {({ fullscreen }) => <ViewBody id={now} c={c} fullscreen={fullscreen} />}
      </RailPanel>
      <RailPanel tag={GROUP_VIEWS[tab].label} title={GROUP_VIEWS[tab].label} height="auto" source={sourceOf(tab, c)} caption={captionOf(tab, c)} controls={<Tabs items={visibleRail(large.views, (id) => groupHasContent(id, c)).map((x) => ({ id: x.id, label: x.id === "GRP-O-JOINED" ? "Joined" : x.label, icon: x.icon }))} active={tab} onPick={(x) => setTab(x as ViewId)} />} focusBar={c.focusBar} flag={flagOf(tab, c)} view={{ panelId: large.id, panelName: null, instanceId: tab, dataview: tab }}>
        {({ fullscreen, height }) => (
          <div className="flex min-h-[200px] flex-col gap-2">
            {tab === "GRP-O-AGAINST" && !fullscreen ? <PhoneAgainst o={c.o} /> : <ViewBody id={tab} c={c} fullscreen={fullscreen} room={height} />}
          </div>
        )}
      </RailPanel>
      {trendItems.length > 0 && <RailPanel tag={GROUP_VIEWS[trendTab].label} title={GROUP_VIEWS[trendTab].label} height="auto" source={sourceOf(trendTab, c)} caption={captionOf(trendTab, c)} controls={<Tabs items={trendItems} active={trendTab} onPick={(x) => setTrendTab(x as ViewId)} />} focusBar={c.focusBar} flag={flagOf(trendTab, c)} view={{ panelId: layout.trends.find((t) => t.views[0].id === trendTab)?.id ?? trendTab, panelName: null, instanceId: trendTab, dataview: trendTab }}>
        {({ fullscreen, height }) => (
          <div className="flex min-h-[160px] flex-col gap-2">
            <ViewBody id={trendTab} c={c} fullscreen={fullscreen} room={height} />
          </div>
        )}
      </RailPanel>}
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
            {r.roll.pct === null ? "—" : arrowed(r.roll.pct, (x) => `${x.toFixed(1)}%`, 1, 0.5)} · {m ? `${MEASURE_LABEL[m] === "Attainment 8" ? "A8" : MEASURE_LABEL[m]} ${r.cells[m]?.value?.toFixed(1) ?? "—"}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
