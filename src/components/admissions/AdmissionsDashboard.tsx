"use client";

// VicData 0.7 admissions r2 (D2-D5): the Admissions page -- two published dashboards in the config
// system, vicdata.admissions.pipelines and vicdata.admissions.market-share, linked by the
// Pipelines | Market share switch. The layout is the config's (src/catalogue/dashboards/
// admissions.ts): row "now" = column 1's panel and ONE large view spanning columns 2-3; row
// "trends" = three panels. Each panel's rail is its config's views (labels and icons from the
// catalogue). On a phone the large view stacks under the entry point and its views become tabs.
//
// The entry point plays the subject's part: the chips (the school's admissions_entry_points, else
// the defaults its age range gives) choose what every view follows. The top bar's filters pass
// through to the routes. Every figure comes from /api/admissions/* (the browser recomputes none).
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import { dataviewById } from "@/catalogue/dataviews";
import { ADMISSIONS_DASHBOARDS } from "@/catalogue/dashboards/admissions";
import type { DashboardConfig, DataviewId, PanelConfig } from "@/catalogue/types";
import type { ViewSpec } from "@/catalogue/viewspec";
import { ADMISSIONS_VIEW_COMPARE, compareState, looksOf } from "@/catalogue/admissions-editor";
import { loadPublishedVicData } from "@/lib/published-vicdata";
import { entryPoint } from "@/lib/admissions/entry-points";
import { isBoardingSchool } from "@/lib/admissions/boarding";
import { cleanLaNameForDisplay } from "@/lib/la-name-display";
import { showsOnState, stateDefault } from "@/catalogue/variants";
import type { EntryPointState } from "@/catalogue/types";
import { DEFAULT_FILTERS, getJson, query, useRoute, type Filters, type ListsAnswer, type Load, type MarketView, type PipelineOk, type PipelineView, type RivalsView, type ShapeView } from "./api";
import { loadAdmissionsMember, type AdmissionsMember, type MemberState } from "./member";
import { ADMISSIONS_BADGE, AdmissionsTeacherNav, DASH_ID, DashSwitch, Divider, FilterChips, PhoneHeader, RowHead, type DashKey } from "./controls";
import { ControlBar } from "@/components/teacher/ControlBar";
import { editorWritesSettled, setEditOn, useInPlaceEdit } from "@/lib/edit-mode";
import { isPlatformAdminCached } from "@/lib/edit-mode";
import { openViewAs } from "@/components/view-as/ViewAs";
import { ROLE_ACCENT } from "@/lib/teacher-view-theme";
import { Empty, EntryChip, FChip, Panel, Skeleton, Tabs, admissionsVars, cx, fillHeight, fmtN, yearLabel, type PanelMenuAction, type RailItem } from "./ui";
import { useWidth } from "./views/charts";
import { EntryNow, laContext } from "./panels/EntryNow";
import { MarketNow } from "./panels/MarketNow";
import { PipelineChart } from "./views/PipelineChart";
import { Funnel, areaWords } from "./views/Funnel";
import { FeederMap, RivalsMap } from "./views/AdmissionsMap";
import { EntryTable, FeederTable, RivalsTable, ShareTable, type FeederTableLook } from "./views/Tables";
import { ShapeAndSize, SHAPES_NOTE } from "./views/ShapeAndSize";
import { AreaPopulation, EntryTrend, PoolTable, PoolTrends, RollTrend, ShareNeeded, ShareTrend, VsRivals } from "./views/Lines";
import { DonutView, RankedBars, ShareChange } from "./views/Bars";
import { FlagsView, Momentum, momentumChips } from "./views/Momentum";
import { Strengths } from "./views/Strengths";
import { AcademicChange, AcademicFooter, AcademicNumbers, AcademicRanking, STAGE_WORD } from "./panels/Academic";
import { Setup, type SetupStep } from "./setup/Setup";
import { ShareDialog, SharedListsOnly } from "./sharing/SharedLists";
import { copySource } from "./export";
import { useBoardingSchool } from "./useBoardingSchool";
import { CopyViewDialog } from "@/components/copy-view/CopyViewDialog";
import { contextFromPanel } from "@/catalogue/pick";

const PHONE = 768;
// The entry-point chips' colour in Teacher's subject-chip slot: the Admissions accent.
const ENTRY_COLOUR = ROLE_ACCENT.admissions!.hex;
// The rows' panel heights. 0.7 r3 (F1): +60 and +10 on round 2's 470 / 330 -- the panels are now
// Teacher's CardBox, whose header line is a little taller and whose visible caption (the LA
// context) sits inside the body rather than in the footer.
const ROW_NOW = 530;
const ROW_TRENDS = 340;

// 0.7 admissions editor s1 (gap 7): a panel's body as the page draws it at 1440 -- the page's
// 1440 cap less its 28px padding, three columns with 24px gaps; inside a panel, CardBox's 12px
// padding each side and, where there is one, the rail (26px icons, 10 + 10 padding, 1px rule);
// down the panel, the header (24), its gap (8), the top padding (12) and the footer's 36.
const PAGE = { width: 1440, pad: 28, gap: 24, inset: 24, rail: 47, chrome: 80 } as const;
export function admissionsBodySize(span: number, firstRow: boolean, railed: boolean): { width: number; height: number } {
  const col = (PAGE.width - 2 * PAGE.pad - 2 * PAGE.gap) / 3;
  const s = Math.max(1, Math.min(3, span));
  return { width: Math.round(s * col + (s - 1) * PAGE.gap - PAGE.inset - (railed ? PAGE.rail : 0)), height: (firstRow ? ROW_NOW : ROW_TRENDS) - PAGE.chrome };
}

// The school's own entry points when the lead hasn't chosen any: the ones its age range takes.
export function defaultEntries(low: number | null, high: number | null): string[] {
  if (low === null || high === null) return ["11+"];
  const out: string[] = [];
  if (low <= 4 && high >= 4) out.push("4+");
  if (low <= 11 && high >= 12) out.push("11+");
  if (low <= 16 && high >= 17) out.push("16+");
  return out.length ? out : [`age:${Math.max(2, Math.min(17, low))}`];
}
const chipLabel = (id: string) => entryPoint(id)?.label.replace(/ \(.*\)$/, "") ?? id;

type UrlState = { dash: DashKey; entry: string | null; setup: SetupStep | null };
function readUrl(): UrlState {
  if (typeof window === "undefined") return { dash: "pipelines", entry: null, setup: null };
  const sp = new URLSearchParams(window.location.search);
  const step = sp.get("setup");
  const setup = step && (["entry", "day", "boarding", "rivals", "blend"].includes(step) || /^rung:\d+-\d+$/.test(step)) ? (step as SetupStep) : null;
  return { dash: sp.get("view") === "market-share" ? "market-share" : "pipelines", entry: sp.get("entry"), setup };
}
function writeUrl(s: UrlState) {
  const sp = new URLSearchParams(window.location.search);
  sp.set("view", s.dash);
  if (s.entry) sp.set("entry", s.entry);
  else sp.delete("entry");
  if (s.setup) sp.set("setup", s.setup);
  else sp.delete("setup");
  window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
}

// 0.7 r3 (F4): the editor, drawn in place of the page while the platform admin's Edit is on -- the
// same in-place editor Teacher's dashboards open (TeacherDashboard's InPlaceEditor), on the
// Admissions dashboard in view, with this school as its live preview.
const EditorScreen = lazy(() => import("@/components/editor/EditorScreen").then((m) => ({ default: m.EditorScreen })));

export function AdmissionsDashboard() {
  const [theme, setTheme] = useTheme();
  const [state, setState] = useState<MemberState>({ status: "loading" });
  useEffect(() => {
    loadAdmissionsMember().then(setState);
  }, []);
  // F5: a platform admin with no Admissions here is pointed at View as, not at joining a school.
  const [platformAdmin, setPlatformAdmin] = useState(false);
  useEffect(() => {
    if (state.status === "no-school" || (state.status === "ready" && state.member.access === "none")) isPlatformAdminCached(createBrowserSupabaseClient()).then(setPlatformAdmin);
  }, [state]);
  // F4: Teacher's edit bar. The page registers the Admissions dashboard in view (the footer's and
  // the View as banner's Edit, platform admins only, as on Teacher); with Edit on the editor is
  // drawn in its place and the page waits hidden underneath, as Teacher's does.
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [dash, setDash] = useState<DashKey>(() => readUrl().dash);
  const showsDashboard = state.status === "ready" && state.member.access !== "none" && state.member.access !== "listOnly";
  const inPlace = useInPlaceEdit(supabase, showsDashboard ? DASH_ID[dash] : null);
  const editing = inPlace.editing && state.status === "ready";
  return (
    <>
      {editing && state.status === "ready" && (
        <Suspense fallback={<p className="p-6 text-sm text-[var(--muted)]">Opening the editor…</p>}>
          <AdmissionsEditor slug={DASH_ID[dash]} school={{ urn: state.member.schoolUrn, name: state.member.schoolName }} />
        </Suspense>
      )}
      <main id={editing ? undefined : "teacher-root"} hidden={editing} data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={admissionsVars(theme)}>
        {state.status === "ready" ? (
          <Gate member={state.member} theme={theme} onTheme={setTheme} platformAdmin={platformAdmin} onDash={setDash} reloadTick={inPlace.reloadTick} />
        ) : (
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-7 py-5">
            <AdmissionsTeacherNav schoolUrn={null} theme={theme} onTheme={setTheme} />
            <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-[13px] text-[var(--muted2)]">
              {state.status === "loading" ? (
                "Loading Admissions…"
              ) : state.status === "signed-out" ? (
                <>
                  <Link href="/login?next=/teacher/admissions" className="font-bold text-[var(--adm-accent-text)]">
                    Sign in
                  </Link>{" "}
                  to see Admissions.
                </>
              ) : platformAdmin ? (
                <UseViewAs />
              ) : (
                "Admissions is for members of a school on VicData. Join your school from your account page."
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

/** F5: a platform admin's empty state -- View as, not "join your school". */
function UseViewAs() {
  return (
    <span className="flex flex-wrap items-center gap-3">
      To see a school&rsquo;s Admissions, use View as.
      <button type="button" onClick={() => openViewAs()} className="rounded-full border border-[var(--panel-border2)] px-3 py-1 text-[12px] font-bold text-[var(--fg)] hover:border-[var(--fg)]">
        View as&hellip;
      </button>
    </span>
  );
}

function AdmissionsEditor({ slug: pageSlug, school }: { slug: string; school: { urn: string; name: string } }) {
  const [slug, setSlug] = useState(pageSlug);
  const pin = useMemo(() => ({ urn: school.urn, name: school.name }), [school.urn, school.name]);
  return <EditorScreen id={slug} host={{ school: pin, top: <ViewAsBanner className="" />, onExit: () => setEditOn(false), onSwitch: setSlug }} />;
}

function useTheme(): [ReturnType<typeof useTeacherTheme>[0], (t: ReturnType<typeof useTeacherTheme>[0]) => void] {
  return useTeacherTheme();
}

function Gate({ member, theme, onTheme, platformAdmin, onDash, reloadTick }: { member: AdmissionsMember; theme: "dark" | "light"; onTheme: (t: "dark" | "light") => void; platformAdmin: boolean; onDash: (d: DashKey) => void; reloadTick: number }) {
  if (member.access === "listOnly") return <SharedListsOnly member={member} theme={theme} onTheme={onTheme} />;
  if (member.access === "none")
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-7 py-5">
        <AdmissionsTeacherNav schoolUrn={member.schoolUrn} theme={theme} onTheme={onTheme} />
        <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-[13px] leading-relaxed text-[var(--muted2)]">
          {platformAdmin && !member.viewAs ? <UseViewAs /> : <>Admissions is for the school&rsquo;s Admissions and SMT staff and its School-Admin. Ask your School-Admin if you need it; a list shared with you appears here.</>}
        </div>
      </div>
    );
  return <Dashboard member={member} theme={theme} onTheme={onTheme} onDash={onDash} reloadTick={reloadTick} />;
}

// ---------------------------------------------------------------------------------------------
function Dashboard({ member, theme, onTheme, onDash, reloadTick }: { member: AdmissionsMember; theme: "dark" | "light"; onTheme: (t: "dark" | "light") => void; onDash: (d: DashKey) => void; reloadTick: number }) {
  // Read once on mount: this component only mounts in the browser, after the member has loaded.
  const [url, setUrl] = useState<UrlState>(readUrl);
  const update = useCallback((next: Partial<UrlState>) => {
    setUrl((u) => {
      const s = { ...u, ...next };
      writeUrl(s);
      return s;
    });
  }, []);
  useEffect(() => onDash(url.dash), [url.dash, onDash]);
  const [filterState, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [projection, setProjection] = useState(false);
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < PHONE;

  // The published configs (the store's, else the code copy).
  const [configs, setConfigs] = useState<Record<DashKey, DashboardConfig>>({ pipelines: ADMISSIONS_DASHBOARDS[0], "market-share": ADMISSIONS_DASHBOARDS[1] });
  // After editing (reloadTick goes up), re-read them, once the editor's last write has landed.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      if (reloadTick > 0) await editorWritesSettled();
      const [p, m] = await Promise.all(ADMISSIONS_DASHBOARDS.map((d) => loadPublishedVicData(supabase, d.id, d)));
      setConfigs({ pipelines: p.config, "market-share": m.config });
    })();
  }, [reloadTick]);

  // The school's entry points and lists (the lists route; 503 before the r1 migration is applied).
  const [listsKey, setListsKey] = useState(0);
  const lists = useRoute<ListsAnswer>(`/api/admissions/lists?urn=${member.schoolUrn}&k=${listsKey}`);
  const [ages, setAges] = useState<{ low: number | null; high: number | null; boarding: boolean } | null>(null);
  useEffect(() => {
    createBrowserSupabaseClient()
      .from("schools")
      .select("statutory_low_age, statutory_high_age, boarders_name")
      .eq("urn", member.schoolUrn)
      .maybeSingle<{ statutory_low_age: number | null; statutory_high_age: number | null; boarders_name: string | null }>()
      .then(({ data }) => setAges({ low: data?.statutory_low_age ?? null, high: data?.statutory_high_age ?? null, boarding: isBoardingSchool(data?.boarders_name) }));
  }, [member.schoolUrn]);
  // 0.7 r3 (F2): boarding only where there are boarders (GIAS, isBoardingSchool). Until the
  // school's row is read, nothing about boarding is drawn.
  const boardingSchool = ages?.boarding ?? false;
  const savedKey = lists.status === "ready" ? lists.data.entryPoints.map((e) => e.entry_point).join(",") : "";
  const notSetUp = lists.status === "ready" && savedKey === "";
  const listsMissing = lists.status === "error" && lists.code === 503;
  const entries = useMemo(() => (savedKey ? savedKey.split(",") : ages ? defaultEntries(ages.low, ages.high) : []), [savedKey, ages]);
  const entry = url.entry && entries.includes(url.entry) ? url.entry : (entries[0] ?? null);

  // D5: a lead with no entry points is taken into setup on the first visit (once per visit:
  // "Skip for now" holds for the session).
  const firstVisitSetup = member.access === "lead" && notSetUp && !url.setup && typeof window !== "undefined" && !window.sessionStorage.getItem("adm.setup.skipped");
  if (firstVisitSetup) {
    window.sessionStorage.setItem("adm.setup.skipped", "1");
    update({ setup: "entry" });
  }

  const dash = url.dash;
  // A day school's filters never carry a boarding choice (the chips aren't drawn for it).
  const filters: Filters = boardingSchool ? filterState : { ...filterState, lists: "both", boardingOnly: false };
  const q = (extra: Record<string, string> = {}) => (entry ? query(member.schoolUrn, entry, filters, extra) : null);
  const pipeline = useRoute<PipelineView>(entry && (dash === "pipelines" || phone) ? `/api/admissions/pipeline?${q(projection ? { projection: "1" } : {})}` : null);
  const market = useRoute<MarketView>(entry && dash === "market-share" ? `/api/admissions/market-share?${q()}` : null);
  const rivals = useRoute<RivalsView>(entry && dash === "market-share" ? `/api/admissions/rivals?${q()}` : null);
  const shape = useRoute<ShapeView>(entry ? `/api/admissions/shape?${q()}` : null);
  // Warm the other dashboard while this one is read (the switch then draws from the cache).
  useEffect(() => {
    if (!entry) return;
    const t = window.setTimeout(() => {
      if (dash === "pipelines") {
        void getJson(`/api/admissions/market-share?${q()}`);
        void getJson(`/api/admissions/rivals?${q()}`);
      } else void getJson(`/api/admissions/pipeline?${q()}`);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [dash, entry, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  if (url.setup && member.access !== "viewAs")
    return (
      <Setup
        member={member}
        step={url.setup}
        entry={entry}
        lists={lists.status === "ready" ? lists.data : null}
        ages={ages}
        theme={theme}
        onStep={(setup) => update({ setup })}
        onDone={(firstEntry) => {
          setListsKey((k) => k + 1);
          update({ setup: null, entry: firstEntry ?? entry });
        }}
        onSkip={() => {
          window.sessionStorage.setItem("adm.setup.skipped", "1");
          update({ setup: null });
        }}
      />
    );

  const config = configs[dash];
  const setLabel = market.status === "ready" ? (market.data.rivalsSource === "saved" ? `${market.data.rivals.length} rivals on your list` : `${market.data.rivals.length} nearest`) : "10 nearest";
  const focusBar =
    entries.length > 1 ? (
      <span role="group" aria-label="Entry point" className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Entry point</span>
        {entries.map((id) => (
          <EntryChip key={id} label={chipLabel(id)} active={id === entry} onClick={() => update({ entry: id })} />
        ))}
      </span>
    ) : undefined;
  const ctx: Ctx = { boardingSchool, member, dash, entry, filters, projection, setProjection, pipeline, market, rivals, shape, setLabel, edit: (s) => update({ setup: s }), lists: lists.status === "ready" ? lists.data : null, focusBar };
  const editEntries = member.canEditLists ? () => update({ setup: "entry" }) : null;
  const editTitle = member.canEditLists ? "Choose entry points" : member.access === "viewAs" ? "View as: read-only" : "The Admissions lead chooses the entry points";
  const rivalsChip =
    dash === "market-share" ? (
      <FChip onClick={member.canEditLists ? () => update({ setup: "rivals" }) : undefined} title={member.canEditLists ? "Choose rivals" : "The Admissions lead chooses the rivals"}>
        Rivals: {setLabel}
      </FChip>
    ) : undefined;

  return (
    <div ref={rootRef} className={cx("mx-auto flex w-full max-w-[1440px] flex-col", phone ? "gap-0" : "gap-[14px] px-7 py-5")}>
      <ViewAsBanner />
      {/* F4: Teacher's nav, then Teacher's control bar -- the same components and places. */}
      <div className={phone ? "px-4 pt-4" : undefined}>
        <AdmissionsTeacherNav schoolUrn={member.schoolUrn} theme={theme} onTheme={onTheme} />
      </div>
      {phone ? (
        <div className="flex flex-col gap-[10px] px-4 py-3">
          <PhoneHeader dash={dash} onDash={(d) => update({ dash: d })} entries={entries.map((id) => ({ id, label: chipLabel(id) }))} entry={entry ?? ""} onEntry={(e) => update({ entry: e })} onEditEntries={editEntries} />
          <Notes member={member} notSetUp={notSetUp} listsMissing={listsMissing} />
          {entry && <PhoneBody config={config} ctx={ctx} />}
        </div>
      ) : (
        <>
          <ControlBar
            phase="ks4"
            phaseLabel="Admissions"
            schoolName={member.schoolName}
            measure="candidates"
            onMeasure={() => undefined}
            badge={ADMISSIONS_BADGE}
            switcher={<DashSwitch active={dash} onSwitch={(d) => update({ dash: d })} configs={configs} />}
            subjectsLabel="Entry point"
            subjects={entries.map((id) => ({ key: id, label: chipLabel(id), colour: ENTRY_COLOUR }))}
            focusKey={entry}
            onFocus={(e) => update({ entry: e })}
            onEditSubjects={editEntries ?? (() => undefined)}
            editSubjects={{ label: "Choose entry points", title: editTitle, disabled: !editEntries }}
            chrome={
              <>
                <Divider />
                <FilterChips dash={dash} filters={filters} onFilters={setFilters} rivalsChip={rivalsChip} boardingSchool={boardingSchool} />
              </>
            }
          />
          <Notes member={member} notSetUp={notSetUp} listsMissing={listsMissing} />
          {entry ? <DesktopGrid config={config} c={ctx} actions={<Actions member={member} onSetup={() => update({ setup: "entry" })} />} /> : <Empty>Choose an entry point to see its pipeline.</Empty>}
        </>
      )}
    </div>
  );
}

/** The lead's and SMT's tools: setup and My team (the lead), sharing the lists (lead and SMT). */
function Actions({ member, onSetup }: { member: AdmissionsMember; onSetup: () => void }) {
  const [share, setShare] = useState(false);
  if (!member.canEditLists && !member.canShare && !member.canManageTeam) return null;
  const B = "rounded-full border border-[var(--panel-border2)] px-[10px] py-[3px] text-[11px] font-semibold text-[var(--chip-fg)] hover:text-[var(--fg)]";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted2)]">
      <span>{member.access === "lead" ? "Admissions lead" : "SMT"}</span>
      {member.canEditLists && (
        <button type="button" className={B} onClick={onSetup}>
          Setup
        </button>
      )}
      {member.canManageTeam && (
        <Link href="/teacher/admissions/team" className={B}>
          My team
        </Link>
      )}
      {member.canShare && (
        <button type="button" className={B} onClick={() => setShare(true)}>
          Share the lists
        </button>
      )}
      {share && <ShareDialog member={member} onClose={() => setShare(false)} />}
    </div>
  );
}

function Notes({ member, notSetUp, listsMissing }: { member: AdmissionsMember; notSetUp: boolean; listsMissing: boolean }) {
  const lines: ReactNode[] = [];
  if (listsMissing) lines.push("Admissions lists aren't set up on this database yet: the views use nearby schools.");
  else if (notSetUp && !member.canEditLists) lines.push("The Admissions lead hasn't set these up yet: these are the defaults (nearby schools, and the entry points the school's age range takes).");
  if (member.override) lines.push("You're seeing Admissions as the School-Admin. You can change setup and the lists as an override: each change shows as yours and is recorded in People's history.");
  else if (member.access === "schoolAdmin") lines.push("You're seeing Admissions as the School-Admin. The lists are the Admissions lead's to change; make a lead in People.");
  if (!lines.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-3 py-2 text-[12px] text-[var(--chip-fg)]">
      {lines.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
      {(member.access === "schoolAdmin" || member.override) && (
        <Link href="/teacher/people" className="text-[12px] font-bold text-[var(--adm-accent-text)]">
          People &rarr;
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The panels, by the config.

type Ctx = {
  // 0.7 r3 (F2): GIAS says the school has boarding provision.
  boardingSchool: boolean;
  member: AdmissionsMember;
  dash: DashKey;
  entry: string | null;
  filters: Filters;
  projection: boolean;
  setProjection: (on: boolean) => void;
  pipeline: Load<PipelineView>;
  market: Load<MarketView>;
  rivals: Load<RivalsView>;
  shape: Load<ShapeView>;
  setLabel: string;
  edit: (s: SetupStep) => void;
  lists: ListsAnswer | null;
  // 0.7 admissions editor s1 (Guy, decision 3): the entry-point chips, in every panel's focus mode.
  focusBar?: ReactNode;
};

// The entry point as the page axis it is in the config (variants.ts): a view not offered on this
// entry point (Strengths at 4+: KS2 has no subject areas) leaves the rail.
export const entryState = (entry: string | null): EntryPointState => (entry === "4+" || entry === "11+" || entry === "16+" ? entry : "custom");
const railOf = (panel: PanelConfig, entry: string | null = null): RailItem[] =>
  panel.dataviews.filter((v) => v.kind === "view" && (entry === null || showsOnState(v, { entryPoint: entryState(entry) }))).map((v) => {
    const dv = v.kind === "view" ? dataviewById(v.dataview) : undefined;
    return { id: v.id, label: (v.kind === "view" ? v.title : undefined) ?? dv?.label ?? v.id, icon: (v.kind === "view" ? v.spec.icon : null) ?? dv?.railIcon ?? "TilesIcon" };
  });
const specOf = (panel: PanelConfig | undefined, instanceId: string): ViewSpec | undefined => {
  const v = panel?.dataviews.find((x) => x.id === instanceId);
  return v?.kind === "view" ? v.spec : undefined;
};
const dataviewOf = (panel: PanelConfig, instanceId: string) => {
  const v = panel.dataviews.find((x) => x.id === instanceId);
  return v?.kind === "view" ? v.dataview : null;
};

// The view a panel shows: the member's pick, else the panel's default for this entry point.
// 0.7 admissions editor s1 (gap 6): the editor's "make default" on an entry point writes
// defaultViewByState; it is honoured here. A pick made on one entry point gives way to another
// entry point's own default when that entry point has one; otherwise it stays, as before.
const NO_PANEL: PanelConfig = { id: "", row: "", column: "", dataviews: [] };
function useActive(panel: PanelConfig, entry: string | null): [string, (id: string) => void] {
  const state = { entryPoint: entryState(entry) };
  const shown = panel.dataviews.filter((v) => showsOnState(v, state));
  const own = stateDefault(panel, state);
  const [pick, setPick] = useState<{ id: string; entry: string | null } | null>(null);
  const fallback = own ?? (shown.some((v) => v.id === panel.defaultView) ? panel.defaultView! : (shown[0]?.id ?? ""));
  const kept = pick && (pick.entry === entry || !own) && shown.some((v) => v.id === pick.id) ? pick.id : null;
  return [kept ?? fallback, (id: string) => setPick({ id, entry })];
}

function ready<T>(l: Load<T>, render: (d: T) => ReactNode): ReactNode {
  if (l.status === "loading") return <Skeleton />;
  if (l.status === "error") return <Empty>{l.message}</Empty>;
  return render(l.data);
}
const pipeOk = (l: Load<PipelineView>): Load<PipelineOk> | { status: "empty" } => (l.status === "ready" && "empty" in l.data ? { status: "empty" } : (l as Load<PipelineOk>));
function readyPipe(l: Load<PipelineView>, render: (p: PipelineOk) => ReactNode): ReactNode {
  const p = pipeOk(l);
  if (p.status === "empty") return <Empty>No boarding feeder list yet: the boarding pool is the lead&rsquo;s list of preps that send boarders (setup, step 3). Day only and Day + boarding still draw.</Empty>;
  return ready(p as Load<PipelineOk>, render);
}

// 0.7 r2b (E2): the subject explorer (Teacher's GCSE or Post-16 dashboard) with these rivals --
// `set` the rivals' URNs (Teacher reads at most 30; src/lib/teacher-view-linked-set.ts), and
// `subject` the subject area when a row was clicked. The school itself isn't in the set.
function explorerHref(c: Ctx, subject?: string): string | null {
  const ep = c.entry ? entryPoint(c.entry) : null;
  if (!ep || ep.age <= 10) return null;
  const path = ep.age >= 16 ? "/teacher/ks5" : "/teacher/ks4";
  const rivals = c.rivals.status === "ready" ? c.rivals.data.rows.filter((x) => !x.isSchool).map((x) => x.urn).slice(0, 30) : [];
  if (!rivals.length) return path;
  const q = new URLSearchParams({ set: rivals.join(",") });
  if (subject) q.set("subject", subject);
  return `${path}?${q.toString().replace(/%2C/g, ",")}`;
}

// 0.7 admissions editor s2 (plan §2.2): a view draws its instance, not just its id -- the dataview
// picks the component, the spec's looks (ADMISSIONS_LOOKS, defaulting to the preset's: today's
// drawing) and its compare (ADMISSIONS_VIEW_COMPARE: the feeder set, the lines) are its props.
type ViewOpts = { fullscreen: boolean; height?: number; onRail?: (dvId: string) => void; spec?: ViewSpec };

/** One view of a panel: its own feeder set fetched when it isn't the page's (a boarding school's
 * choice only, F2), then drawn by viewBody. */
function InstanceBody({ dv, c, o }: { dv: string; c: Ctx; o: ViewOpts }) {
  const st = compareState(o.spec?.compare ?? "follows-page", ADMISSIONS_VIEW_COMPARE[dv as DataviewId]);
  const lists = c.boardingSchool && st.feeders !== "page" && st.feeders !== c.filters.lists ? st.feeders : null;
  const own = useRoute<PipelineView>(lists && c.entry ? `/api/admissions/pipeline?${query(c.member.schoolUrn, c.entry, { ...c.filters, lists }, c.projection ? { projection: "1" } : {})}` : null);
  return <>{viewBody(dv, lists ? { ...c, pipeline: own, filters: { ...c.filters, lists } } : c, o)}</>;
}

/** What one view draws, by its dataview id, with its instance's looks and lines. */
function viewBody(dv: string, c: Ctx, o: ViewOpts): ReactNode {
  const fs = o.fullscreen;
  const L = looksOf(dv, o.spec?.view.look);
  const lines = compareState(o.spec?.compare ?? "follows-page", ADMISSIONS_VIEW_COMPARE[dv as DataviewId]).lines;
  switch (dv) {
    case "DV-ADM-P-NOW":
      return readyPipe(c.pipeline, (p) => <EntryNow p={p} shape={c.shape.status === "ready" ? c.shape.data : null} />);
    case "DV-ADM-P-PIPELINE":
      return readyPipe(c.pipeline, (p) => (
        <>
          {/* 16+ (Pipeline16.dc.html): a ladder through more than one kind of school shows its rung
              cards under a shorter chart; the feeder flags stay in the feeder table. */}
          <PipelineChart p={p} projection={c.projection} onProjection={c.setProjection} pastPools={L.pastPools as boolean} rungLabels={L.rungLabels as boolean} projectionMode={L.projection as "member" | "off"} onFeederTable={o.onRail ? () => o.onRail!("DV-ADM-P-TABLE") : undefined} height={fs ? fillHeight(o.height, p.rungSets.length > 1 ? 260 : 170, 380) : p.rungSets.length > 1 ? 120 : 225} flags={p.rungSets.length < 2 || fs} />
          <RungCards p={p} c={c} />
        </>
      ));
    case "DV-ADM-P-FUNNEL":
      return readyPipe(c.pipeline, (p) => <Funnel p={p} fullscreen={fs} room={o.height} />);
    case "DV-ADM-P-MAP":
      return readyPipe(c.pipeline, (p) => <FeederMap p={p} fullscreen={fs} room={o.height} colour={L.colour as "change" | "value"} />);
    case "DV-ADM-P-TABLE":
      return readyPipe(c.pipeline, (p) => <FeederTable p={p} fullscreen={fs} look={L as FeederTableLook} />);
    case "DV-ADM-P-SHAPE":
    case "DV-ADM-M-SHAPE":
      return ready(c.shape, (s) => <ShapeAndSize s={s} entryAge={entryPoint(c.entry!)!.age} showLocal={dv === "DV-ADM-P-SHAPE"} fullscreen={fs} columns={L.columns as 1 | 2 | 3} />);
    case "DV-ADM-P-ENTRY-LINE":
      return readyPipe(c.pipeline, (p) => <EntryTrend p={p} as="line" fullscreen={fs} room={o.height} />);
    case "DV-ADM-P-ENTRY-BARS":
      return readyPipe(c.pipeline, (p) => <EntryTrend p={p} as="bars" fullscreen={fs} room={o.height} />);
    case "DV-ADM-P-ENTRY-TABLE":
      return readyPipe(c.pipeline, (p) => <EntryTable p={p} years={L.years as "down" | "across"} />);
    case "DV-ADM-P-POOL-INDEXED":
      return readyPipe(c.pipeline, (p) => <PoolTrends p={p} fullscreen={fs} room={o.height} la={lines.has("la")} england={lines.has("england")} endLabels={L.endLabels as boolean} />);
    case "DV-ADM-P-POOL-TABLE":
      return readyPipe(c.pipeline, (p) => <PoolTable p={p} la={lines.has("la")} england={lines.has("england")} />);
    case "DV-ADM-P-AREA-POP":
      return readyPipe(c.pipeline, (p) => <AreaPopulation p={p} la={lines.has("la")} region={lines.has("region")} />);
    case "DV-ADM-P-HOLD-LINE":
      return readyPipe(c.pipeline, (p) => <ShareNeeded p={p} fullscreen={fs} room={o.height} />);
    case "DV-ADM-P-HOLD-TABLE":
      return readyPipe(c.pipeline, (p) => <ShareNeeded p={p} fullscreen={fs} room={o.height} table />);
    case "DV-ADM-M-NOW":
      return ready(c.market, (m) => <MarketNow m={m} setLabel={c.setLabel} />);
    case "DV-ADM-M-DONUT":
      return ready(c.market, (m) => <DonutView m={m} />);
    case "DV-ADM-M-BARS":
      return ready(c.market, (m) => <RankedBars m={m} rivals={c.rivals} fullscreen={fs} show={L.show as "all" | "top5" | "around"} withDonut={L.withDonut as boolean} />);
    case "DV-ADM-M-MAP":
      return ready(c.market, (m) => <RivalsMap m={m} fullscreen={fs} room={o.height} colour={L.colour as "value" | "change"} />);
    case "DV-ADM-M-TABLE":
      return ready(c.market, (m) => <RivalsTable m={m} rivals={c.rivals} fullscreen={fs} sort={L.sort as "latest" | "listed"} />);
    case "DV-ADM-M-MOMENTUM":
      return ready(c.market, (m) => ready(c.rivals, (r) => <Momentum m={m} r={r} fullscreen={fs} room={o.height} labels={L.labels as boolean} quadrantNames={L.quadrantNames as boolean} />));
    // Guy's decision 8: the flag list is a view of its own.
    case "DV-ADM-M-FLAGS":
      return ready(c.market, (m) => ready(c.rivals, (r) => <FlagsView m={m} r={r} show={L.show as "flagged" | "all"} />));
    case "DV-ADM-M-STRENGTHS":
      return ready(c.rivals, (r) => <Strengths r={r} explorerHref={(subject) => explorerHref(c, subject)} fullscreen={fs} order={L.order as "gap" | "az"} showFlags={L.showFlags as boolean} />);
    case "DV-ADM-M-VS-LINE":
      return ready(c.market, (m) => <VsRivals m={m} setLabel={c.setLabel} as="line" fullscreen={fs} room={o.height} />);
    case "DV-ADM-M-VS-BARS":
      return ready(c.market, (m) => <VsRivals m={m} setLabel={c.setLabel} as="bars" fullscreen={fs} room={o.height} />);
    case "DV-ADM-M-ACAD-RANK":
      return ready(c.rivals, (r) => <AcademicRanking r={r} />);
    case "DV-ADM-M-ACAD-NUM":
      return ready(c.rivals, (r) => <AcademicNumbers r={r} />);
    case "DV-ADM-M-ACAD-CHANGE":
      return ready(c.rivals, (r) => <AcademicChange r={r} />);
    case "DV-ADM-M-SHARE-LINE":
      return ready(c.market, (m) => <ShareTrend m={m} fullscreen={fs} room={o.height} />);
    case "DV-ADM-M-SHARE-NUM":
      return ready(c.market, (m) => <ShareTable m={m} years={L.years as "down" | "across"} />);
    case "DV-ADM-M-SHARE-RANKS":
      return ready(c.market, (m) => <ShareTable m={m} ranks years={L.years as "down" | "across"} />);
    case "DV-ADM-M-SHARE-CHANGE":
      return ready(c.market, (m) => <ShareChange m={m} />);
    case "DV-ADM-M-ROLL-LINE":
      return ready(c.market, (m) => <RollTrend m={m} fullscreen={fs} room={o.height} />);
    default:
      return <Empty>This view isn&rsquo;t drawn here yet.</Empty>;
  }
}

/** Each panel's header line: its tag and context, as the boards write them. */
function headerOf(panel: PanelConfig, dv: string, c: Ctx): { tag: string; context: ReactNode } {
  const ep = c.entry ? entryPoint(c.entry) : null;
  const p = c.pipeline.status === "ready" && !("empty" in c.pipeline.data) ? c.pipeline.data : null;
  const census = p?.censusPeriod ?? 2025;
  const r = c.rivals.status === "ready" ? c.rivals.data : null;
  if (panel.row === "now" && panel.column === "c1") return { tag: "Current", context: `Data ${yearLabel(census)}` };
  if (dv.startsWith("DV-ADM-P-") && panel.row === "now") {
    if (dv === "DV-ADM-P-SHAPE") return { tag: "Shape and size", context: `Data ${yearLabel(census)} · pupils by age` };
    const years = p ? `entry years ${p.ladder.past[0]?.entryYear ?? ""}–${p.ladder.future[p.ladder.future.length - 1]?.entryYear ?? ""}` : "";
    return { tag: dv === "DV-ADM-P-PIPELINE" ? "Pipeline" : (dataviewById(dv)?.label ?? "Pipeline"), context: ep && ep.age >= 16 ? `16+ · ${years}` : years };
  }
  if (dv === "DV-ADM-M-MOMENTUM" || dv === "DV-ADM-M-FLAGS") return { tag: "Rivals’ momentum", context: "change since 2022/23" };
  if (dv === "DV-ADM-M-STRENGTHS") return { tag: "Strengths and weaknesses", context: r ? `${STAGE_WORD[r.stage]} ${r.resultsPeriod ? yearLabel(r.resultsPeriod) : ""} · average points` : "" };
  if (dv === "DV-ADM-M-SHAPE") return { tag: "Shape and size", context: `Data ${yearLabel(census)} · pupils by age` };
  if (panel.row === "now") return { tag: "Rivals", context: `Data ${yearLabel(census)} · pupils aged ${ep?.age ?? ""}` };
  if (dv.startsWith("DV-ADM-P-HOLD")) return { tag: "Forward", context: p ? `${p.ladder.future[0]?.entryYear}–${p.ladder.future[p.ladder.future.length - 1]?.entryYear}` : "" };
  if (dv === "DV-ADM-P-POOL-INDEXED" || dv === "DV-ADM-M-VS-LINE") return { tag: "Trends", context: "indexed, 2019/20 = 100" };
  if (dv.startsWith("DV-ADM-M-ACAD")) return { tag: "Academic", context: r && ep ? `${ep.label.replace(/ \(.*\)$/, "")} → ${STAGE_WORD[r.stage]} · ${r.resultsPeriod ? yearLabel(r.resultsPeriod) : ""}` : "" };
  return { tag: "Trends", context: "from 2019/20" };
}

/** Each panel's notes, from ADMISSIONS_NOTES. 0.7 r3 (F1): the honesty wording opens the way
 * Teacher's notes do -- the caption button beside the source "i", its popover, and printed in full
 * screen -- rather than as a line of its own. What a panel shows without a click (the LA context,
 * the subject-explorer link) is CardBox's visible caption, as on Teacher. */
function notesOf(dv: string, c: Ctx): { caption?: ReactNode; visible?: ReactNode } {
  if (dv === "DV-ADM-P-NOW") return { visible: laContext(c.shape.status === "ready" ? c.shape.data : null) ?? undefined };
  if (dv === "DV-ADM-M-NOW") return { caption: ADMISSIONS_NOTES.groupShort };
  if (dv === "DV-ADM-P-FUNNEL") return { caption: ADMISSIONS_NOTES.funnelNote };
  if (dv === "DV-ADM-P-PIPELINE" || dv === "DV-ADM-P-MAP" || dv === "DV-ADM-P-TABLE") return { caption: ADMISSIONS_NOTES.poolShort };
  if (dv.endsWith("-SHAPE")) return { caption: SHAPES_NOTE };
  if (dv.startsWith("DV-ADM-P-ENTRY")) return { caption: ADMISSIONS_NOTES.cohortShort };
  if (dv.startsWith("DV-ADM-P-POOL") || dv === "DV-ADM-P-AREA-POP") return { caption: <>Also: the school page&rsquo;s area population trend (ages 5&ndash;15)</> };
  if (dv.startsWith("DV-ADM-P-HOLD")) return { caption: ADMISSIONS_NOTES.requirement };
  if (dv.startsWith("DV-ADM-M-ACAD")) return { visible: <AcademicFooter explorerHref={explorerHref(c)} /> };
  if (dv === "DV-ADM-M-BARS" || dv === "DV-ADM-M-TABLE" || dv === "DV-ADM-M-DONUT" || dv === "DV-ADM-M-MAP")
    return { caption: "Cohort sizes from the census; shares are of this group; results ranks on the whole-school headline among all schools" };
  if (dv.startsWith("DV-ADM-M-SHARE") || dv === "DV-ADM-M-ROLL-LINE") return { caption: "Roll trends sit on the same rail" };
  return {};
}

/** The source note behind each panel's "i". */
function sourceOf(dv: string): ReactNode {
  const d = dataviewById(dv);
  const m = d?.measures.join(", ");
  return (
    <>
      {d?.titleTemplate.replace(/\[[^\]]+\]/g, "…")}. {dv.startsWith("DV-ADM-P") ? ADMISSIONS_NOTES.pool : ADMISSIONS_NOTES.groupShare} <span className="opacity-70">({m})</span>
    </>
  );
}

function chipsOf(dv: string, c: Ctx): ReactNode {
  const p = c.pipeline.status === "ready" && !("empty" in c.pipeline.data) ? c.pipeline.data : null;
  const lead = c.member.canEditLists;
  const ro = c.member.access === "viewAs" ? "View as: read-only" : "Read-only: the Admissions lead changes this";
  // F7: the funnel draws one area (the school's LA, or the lead's blend), not the feeder set: its
  // chip names that area; the feeders chip stays with the views that draw the feeders.
  if (dv === "DV-ADM-P-FUNNEL" && p) {
    const area = p.funnel[0]?.area ?? [];
    return (
      <FChip onClick={lead ? () => c.edit("blend") : undefined} chevron={false} title={lead ? "Adjust the LA blend (births and the pool follow it)" : ro}>
        Area: {areaWords(area)}
        {lead ? " · Adjust" : ""}
      </FChip>
    );
  }
  if (["DV-ADM-P-PIPELINE", "DV-ADM-P-MAP", "DV-ADM-P-TABLE"].includes(dv) && p) {
    const day = c.lists?.lists.find((l) => l.kind === "day_feeders" && l.entry_point === p.entry.id)?.members?.length ?? 0;
    const boarding = c.boardingSchool ? (c.lists?.lists.find((l) => l.kind === "boarding_feeders" && l.entry_point === p.entry.id)?.members?.length ?? 0) : 0;
    const feeders = day || boarding ? `Feeders: ${c.boardingSchool ? "Day list" : "your list"} (${day})${boarding ? ` + Boarding list (${boarding})` : ""}` : `Feeders: nearby schools (${p.feederTable.rows.length})`;
    return (
      <>
        <FChip onClick={lead ? () => c.edit("day") : undefined} title={lead ? "Edit the feeder lists" : ro}>
          {feeders}
        </FChip>
        <FChip onClick={lead ? () => c.edit("blend") : undefined} chevron={false} title={lead ? "Adjust the LA birth blend" : ro}>
          Births: {p.blend.slice(0, 3).map((b) => `${b.laName ? cleanLaNameForDisplay(b.laName) : b.laCode} ${Math.round(b.weight * 100)}%`).join(" · ")}
          {p.blend.length > 3 ? ` · +${p.blend.length - 3}` : ""}
          {lead ? " · Adjust" : ""}
        </FChip>
      </>
    );
  }
  if (dv === "DV-ADM-P-SHAPE" || dv === "DV-ADM-M-SHAPE") {
    const s = c.shape.status === "ready" ? c.shape.data : null;
    const own = s?.profile.filter((x) => x.female + x.male > 0) ?? [];
    return (
      <>
        {own.length > 0 && <FChip chevron={false}>Ages {own[0].age}&ndash;{own[own.length - 1].age}</FChip>}
        <FChip chevron={false}>Compare: {dv === "DV-ADM-P-SHAPE" ? "feeders’ area · rivals" : "rivals"}</FChip>
      </>
    );
  }
  if (dv === "DV-ADM-M-BARS" || dv === "DV-ADM-M-TABLE") {
    const ep = c.entry ? entryPoint(c.entry) : null;
    return <FChip chevron={false}>Measure: entry age ({ep?.age})</FChip>;
  }
  if (dv === "DV-ADM-M-MOMENTUM" && c.market.status === "ready") {
    const chips = momentumChips(c.market.data, c.rivals.status === "ready" ? c.rivals.data : null);
    return (
      <>
        <FChip chevron={false}>{chips.pupils}</FChip>
        <FChip chevron={false}>{chips.results}</FChip>
      </>
    );
  }
  if (dv === "DV-ADM-M-STRENGTHS")
    return (
      <>
        <FChip chevron={false}>Subject areas</FChip>
        <FChip chevron={false}>Rivals: {c.setLabel}</FChip>
      </>
    );
  return null;
}

function menuOf(dv: string, c: Ctx, title: string): PanelMenuAction[] {
  void title;
  const out: PanelMenuAction[] = [];
  if (c.member.canEditLists) {
    if (dv.startsWith("DV-ADM-P")) out.push({ label: "Edit the feeder lists", onClick: () => c.edit("day") });
    if (dv.startsWith("DV-ADM-M")) out.push({ label: "Edit the rivals", onClick: () => c.edit("rivals") });
  }
  return out;
}

const secondaryLine = (r: PipelineOk["rungSets"][number], urn: string) => {
  const own = r.schools.some((s) => s.urn === urn);
  const eleven = r.schools.filter((s) => s.elevenToSixteen && s.urn !== urn).length;
  const other = r.schools.length - eleven - (own ? 1 : 0);
  return `11–16 schools with no sixth form (${eleven})${other ? `, other secondaries (${other})` : ""}${own ? ", plus your own Year 11" : ""}`;
};

/** 16+ (Pipeline16.dc.html): each stage of the ladder, with "Edit list" for the lead. */
function RungCards({ p, c }: { p: PipelineOk; c: Ctx }) {
  if (p.rungSets.length < 2) return null;
  const lead = c.member.canEditLists;
  const cards = [...p.rungSets].sort((a, b) => Math.max(...b.ages) - Math.max(...a.ages));
  return (
    <div className="grid grid-cols-3 gap-[10px]">
      {cards.map((r, i) => {
        const top = Math.max(...r.ages);
        const secondary = top >= 11;
        return (
          <div key={i} className="flex flex-col gap-[3px] rounded-[9px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-[10px] py-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">
              Rung {i + 1} &middot; {secondary ? "secondaries" : "primaries"}
            </span>
            <span className="line-clamp-2 text-[12px] font-semibold text-[var(--fg)]">{secondary ? secondaryLine(r, p.urn) : `Primaries in the same area as rung 1 (${r.schools.length})`}</span>
            <span className="text-[11px] text-[var(--muted2)]">{secondary ? "Their pupils must move at 16" : r.saved ? "The lead's list" : "Default: the nearest; adjustable"}</span>
            {lead && (
              <button type="button" className="self-start text-[11px] font-bold text-[var(--adm-accent-text)]" onClick={() => c.edit(`rung:${Math.min(...r.ages)}-${Math.max(...r.ages)}` as SetupStep)}>
                Edit list
              </button>
            )}
          </div>
        );
      })}
      <div className="flex flex-col gap-[3px] rounded-[9px] border border-[var(--panel-border)] bg-[var(--box-bg)] px-[10px] py-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">Rung {p.rungSets.length + 1} &middot; births</span>
        <span className="line-clamp-2 text-[12px] font-semibold text-[var(--fg)]" title={p.blend.map((b) => `${b.laName ? cleanLaNameForDisplay(b.laName) : b.laCode} ${Math.round(b.weight * 100)}%`).join(" · ")}>
          {p.blend.slice(0, 3).map((b) => `${b.laName ? cleanLaNameForDisplay(b.laName) : b.laCode} ${Math.round(b.weight * 100)}%`).join(" · ")}
          {p.blend.length > 3 ? ` · +${p.blend.length - 3} more` : ""}
        </span>
        <span className="text-[11px] text-[var(--muted2)]">{p.blendSource === "override" ? "The lead's blend" : "Blended automatically; adjust the weights"}</span>
        {lead && (
          <button type="button" className="self-start text-[11px] font-bold text-[var(--adm-accent-text)]" onClick={() => c.edit("blend")}>
            Adjust
          </button>
        )}
      </div>
    </div>
  );
}

function ConfigPanel({ panel, c, height, config }: { panel: PanelConfig; c: Ctx; height: number | "auto"; config: DashboardConfig }) {
  const [active, setActive] = useActive(panel, c.entry);
  const [copying, setCopying] = useState(false);
  const instance = panel.dataviews.find((v) => v.id === active);
  const rail = railOf(panel, c.entry);
  const dv = dataviewOf(panel, active) ?? "";
  const h = headerOf(panel, dv, c);
  const title = dataviewById(dv)?.label ?? h.tag;
  const notes = notesOf(dv, c);
  const onRailDv = (dvId: string) => {
    const inst = panel.dataviews.find((v) => v.kind === "view" && v.dataview === dvId);
    if (inst) setActive(inst.id);
  };
  return (
    <>
    <Panel id={panel.id} onCopy={c.member.viewAs || !instance || instance.kind !== "view" ? undefined : () => setCopying(true)} tag={h.tag} context={h.context} chips={chipsOf(dv, c)} menu={menuOf(dv, c, title)} rail={rail} railActive={active} onRail={setActive} source={sourceOf(dv)} caption={notes.caption} visibleCaption={notes.visible} height={height} span={(panel.span?.cols ?? 1) >= 2 ? 2 : 1} title={title} focusBar={c.focusBar}>
      {({ fullscreen, height }) => <InstanceBody dv={dv} c={c} o={{ fullscreen, height, onRail: onRailDv, spec: instance?.kind === "view" ? instance.spec : undefined }} />}
    </Panel>
    {copying && instance?.kind === "view" && (
      <CopyViewDialog open meetingOnly onClose={() => setCopying(false)} source={copySource(instance, c, title, contextFromPanel(config, panel.id, { school: c.member.schoolName }))} />
    )}
    </>
  );
}

function DesktopGrid({ config, c, actions }: { config: DashboardConfig; c: Ctx; actions?: ReactNode }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ now: true, trends: true });
  const ep = c.entry ? entryPoint(c.entry) : null;
  const census = c.pipeline.status === "ready" && !("empty" in c.pipeline.data) ? c.pipeline.data.censusPeriod : 2025;
  const ctx: Record<string, string> = {
    now: `January ${census + 1} census · ${c.dash === "pipelines" ? `${ep?.label.replace(/ \(.*\)$/, "")} entry` : `pupils aged ${ep?.age}`}`,
    trends: c.dash === "pipelines" ? `${yearLabel(2019)} to ${yearLabel(census)}, and forward` : `${yearLabel(2019)} to ${yearLabel(census)}`,
  };
  return (
    <>
      {config.rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-[14px]">
          <div className="flex items-center gap-3">
            <RowHead title={row.name} context={ctx[row.id] ?? ""} open={open[row.id] !== false} onToggle={() => setOpen((o) => ({ ...o, [row.id]: o[row.id] === false }))} />
            <span className="grow" />
            {row.id === config.rows[0]?.id && actions}
          </div>
          {open[row.id] !== false && (
            <div className="grid grid-cols-3 gap-6">
              {config.panels
                .filter((p) => p.row === row.id)
                .sort((a, b) => config.columns.findIndex((x) => x.id === a.column) - config.columns.findIndex((x) => x.id === b.column))
                .map((p) => (
                  <ConfigPanel key={p.id} panel={p} c={c} config={config} height={row.id === "now" ? ROW_NOW : ROW_TRENDS} />
                ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// Phone (Phone.dc.html): the entry point now; the large view full width with its views as tabs;
// row 2's panels as tabs of one panel.
function PhoneBody({ config, ctx: c }: { config: DashboardConfig; ctx: Ctx }) {
  const now = config.panels.find((p) => p.row === "now" && p.column === "c1");
  const large = config.panels.find((p) => p.row === "now" && (p.span?.cols ?? 1) >= 2);
  const trends = config.panels.filter((p) => p.row === "trends");
  // 0.7 admissions editor s1 (gap 6): the large view opens on its default for this entry point.
  const [largeTab, setLargeTab] = useActive(large ?? NO_PANEL, c.entry);
  const [trendTab, setTrendTab] = useState(trends[0]?.id ?? "");
  const largeRail = large ? railOf(large, c.entry).map((r) => ({ ...r, label: shortTab(r.label) })) : [];
  const largeDv = large ? (dataviewOf(large, largeTab) ?? dataviewOf(large, large.defaultView ?? "") ?? "") : "";
  const trendPanel = trends.find((t) => t.id === trendTab) ?? trends[0];
  const trendDv = trendPanel ? (dataviewOf(trendPanel, stateDefault(trendPanel, { entryPoint: entryState(c.entry) }) ?? trendPanel.defaultView ?? "") ?? "") : "";
  // 0.7 r3 (F1): each phone block is the same panel as on the desktop (CardBox: the icon row,
  // the notes, full screen), sized to its content, with the views as tabs under the header.
  const nowDv = now ? (c.dash === "pipelines" ? "DV-ADM-P-NOW" : "DV-ADM-M-NOW") : "";
  const largeTitle = dataviewById(largeDv)?.label ?? "Pipeline";
  const trendTitle = trendPanel ? phoneTrendLabel(trendPanel, c) : "";
  return (
    <>
      {now && (
        <Panel tag="Current" title={dataviewById(nowDv)?.label ?? "Current"} height="auto" source={sourceOf(nowDv)} caption={notesOf(nowDv, c).caption} focusBar={c.focusBar}>
          {() =>
            c.dash === "pipelines"
              ? readyPipe(c.pipeline, (p) => <EntryNow p={p} shape={c.shape.status === "ready" ? c.shape.data : null} compact />)
              : ready(c.market, (m) => <MarketNow m={m} setLabel={c.setLabel} compact />)
          }
        </Panel>
      )}
      {large && (
        <Panel tag={largeTitle} title={largeTitle} height="auto" source={sourceOf(largeDv)} caption={notesOf(largeDv, c).caption} controls={<Tabs items={largeRail} active={largeTab || large.defaultView || ""} onPick={setLargeTab} />} focusBar={c.focusBar}>
          {({ fullscreen, height }) => <div className="flex min-h-[220px] flex-col gap-2">{fullscreen ? <InstanceBody dv={largeDv} c={c} o={{ fullscreen, height, spec: specOf(large, largeTab) }} /> : phoneView(largeDv, c, specOf(large, largeTab))}</div>}
        </Panel>
      )}
      {trends.length > 0 && (
        <Panel tag={trendTitle} title={trendTitle} height="auto" source={sourceOf(trendDv)} caption={notesOf(trendDv, c).caption} controls={<Tabs items={trends.map((t) => ({ id: t.id, label: phoneTrendLabel(t, c), icon: "" }))} active={trendTab} onPick={setTrendTab} />} focusBar={c.focusBar}>
          {({ fullscreen, height }) => <div className="flex min-h-[160px] flex-col gap-2"><InstanceBody dv={trendDv} c={c} o={{ fullscreen, height, spec: specOf(trendPanel, stateDefault(trendPanel, { entryPoint: entryState(c.entry) }) ?? trendPanel.defaultView ?? "") }} /></div>}
        </Panel>
      )}
    </>
  );
}
const shortTab = (l: string) => ({ "Map of feeders": "Map", "Feeder table": "Table", "Shape and size": "Shape", "Rivals' shapes": "Shape", "Ranked bars": "Bars", "Share (donut)": "Donut", "Map of rivals": "Map", "Rivals table": "Table", "Rivals' momentum": "Momentum", "Strengths and weaknesses": "Strengths" })[l] ?? l;
const phoneTrendLabel = (t: PanelConfig, c: Ctx) => (c.dash === "pipelines" ? ({ c1: "Your trend", c2: "Pool trends", c3: "Share needed" } as Record<string, string>)[t.column] : ({ c1: "You and rivals", c2: "Academic", c3: "Share" } as Record<string, string>)[t.column]) ?? t.name ?? t.column;

function phoneView(dv: string, c: Ctx, spec?: ViewSpec): ReactNode {
  if (dv === "DV-ADM-P-PIPELINE")
    return readyPipe(c.pipeline, (p) => (
      <>
        <PipelineChart p={p} projection={false} height={150} compact pastPools={looksOf(dv, spec?.view.look).pastPools as boolean} rungLabels={looksOf(dv, spec?.view.look).rungLabels as boolean} />
        <div className="text-[11px] text-[var(--muted2)]">
          {p.change && p.changeYear ? `Pool ${p.change.pct < 0 ? "▼" : "▲"} ${Math.abs(p.change.pct).toFixed(0)}% by ${p.changeYear}. ` : ""}The pool, not who will join.
        </div>
      </>
    ));
  if (dv === "DV-ADM-M-BARS") return ready(c.market, (m) => <RankedBars m={m} rivals={c.rivals} withDonut={false} fullscreen={false} phone show={looksOf(dv, spec?.view.look).show as "all" | "top5" | "around"} />);
  return <InstanceBody dv={dv} c={c} o={{ fullscreen: false, spec }} />;
}

export { fmtN };

// ---------------------------------------------------------------------------------------------
// D7: one Admissions view for the editor (Data → View → Preview, and its canvas): drawn by the same
// components from the same routes, for the editor's school and entry point, read-only.
export function AdmissionsViewPreview({ dataview, spec, urn, schoolName, entry, height = 330 }: { dataview: string; spec?: ViewSpec; urn: string; schoolName: string; entry: string; height?: number }) {
  // 0.7 admissions editor s2: the instance's own looks and lines, and boarding only for a boarding
  // school (F2: a day school's preview draws no boarding feeder set, whatever the spec says).
  const boardingSchool = useBoardingSchool(urn) === true;
  const member: AdmissionsMember = useMemo(
    () => ({ userId: "", token: "", membershipId: null, schoolAccountId: "", schoolUrn: urn, schoolName, roles: [], isAdmin: false, isAccountHolder: false, lead: false, access: "viewAs", canEditLists: false, override: false, canShare: false, canManageTeam: false, readOnly: true, viewAs: null, leadColumn: true }),
    [urn, schoolName],
  );
  const filters = DEFAULT_FILTERS;
  const ep = entryPoint(entry)?.id ?? "11+";
  const qs = query(urn, ep, filters);
  const market = dataview.startsWith("DV-ADM-M") && !dataview.endsWith("-SHAPE");
  const pipeline = useRoute<PipelineView>(dataview.startsWith("DV-ADM-P") ? `/api/admissions/pipeline?${qs}` : null);
  const marketL = useRoute<MarketView>(market ? `/api/admissions/market-share?${qs}` : null);
  const rivals = useRoute<RivalsView>(market ? `/api/admissions/rivals?${qs}` : null);
  const shape = useRoute<ShapeView>(`/api/admissions/shape?${qs}`);
  const c: Ctx = { boardingSchool, member, dash: market ? "market-share" : "pipelines", entry: ep, filters, projection: false, setProjection: () => undefined, pipeline, market: marketL, rivals, shape, setLabel: "rivals", edit: () => undefined, lists: null };
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-hidden" style={{ height }}>
      <InstanceBody dv={dataview} c={c} o={{ fullscreen: false, spec }} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 0.7 r3 (F2): every view of both dashboards at once, from answers already in hand, each as its
// panel draws it (chips, notes, source) -- what R-ADM-BOARDING-ONLY-WHERE-BOARDERS renders on the
// server, on real data, to check that a day school sees no boarding and a boarding school sees it
// all. Rendered under CardBox's OpenInFullscreen, the notes and sources print in full.
export function AdmissionsEveryView({ member, boardingSchool, entry, pipeline, market, rivals, shape, lists }: { member: AdmissionsMember; boardingSchool: boolean; entry: string; pipeline: PipelineView; market: MarketView; rivals: RivalsView; shape: ShapeView; lists: ListsAnswer | null }) {
  const out: ReactNode[] = [];
  ADMISSIONS_DASHBOARDS.forEach((config, i) => {
    const dash: DashKey = i === 0 ? "pipelines" : "market-share";
    const c: Ctx = { boardingSchool, member, dash, entry, filters: DEFAULT_FILTERS, projection: false, setProjection: () => undefined, pipeline: { status: "ready", data: pipeline }, market: { status: "ready", data: market }, rivals: { status: "ready", data: rivals }, shape: { status: "ready", data: shape }, setLabel: "rivals", edit: () => undefined, lists };
    out.push(
      <div key={`f-${dash}`} data-adm-filters={dash}>
        <FilterChips dash={dash} filters={DEFAULT_FILTERS} onFilters={() => undefined} boardingSchool={boardingSchool} />
      </div>,
    );
    for (const panel of config.panels)
      for (const r of railOf(panel, entry)) {
        const dv = dataviewOf(panel, r.id) ?? "";
        const h = headerOf(panel, dv, c);
        const n = notesOf(dv, c);
        out.push(
          <div key={`${panel.id}/${r.id}`} data-adm-dash={dash} data-adm-dv={dv}>
            <Panel tag={h.tag} context={h.context} chips={chipsOf(dv, c)} menu={menuOf(dv, c, h.tag)} title={dataviewById(dv)?.label ?? h.tag} source={sourceOf(dv)} caption={n.caption} visibleCaption={n.visible} height="auto">
              {({ fullscreen }) => <InstanceBody dv={dv} c={c} o={{ fullscreen, spec: specOf(panel, r.id) }} />}
            </Panel>
          </div>,
        );
      }
  });
  return <>{out}</>;
}

// 0.7 admissions editor s2: one view as its panel draws it, with a given spec -- what
// R-ADM-EDITOR-LOOKS-KEEP-NOTES renders on the server under each look and compare value.
export function AdmissionsOneView({ member, boardingSchool, entry, pipeline, market, rivals, shape, dv, spec }: { member: AdmissionsMember; boardingSchool: boolean; entry: string; pipeline: PipelineView; market: MarketView; rivals: RivalsView; shape: ShapeView; dv: string; spec?: ViewSpec }) {
  const dash: DashKey = dv.startsWith("DV-ADM-M") ? "market-share" : "pipelines";
  const c: Ctx = { boardingSchool, member, dash, entry, filters: DEFAULT_FILTERS, projection: false, setProjection: () => undefined, pipeline: { status: "ready", data: pipeline }, market: { status: "ready", data: market }, rivals: { status: "ready", data: rivals }, shape: { status: "ready", data: shape }, setLabel: "rivals", edit: () => undefined, lists: null };
  const panel = ADMISSIONS_DASHBOARDS.flatMap((d) => d.panels).find((p) => p.dataviews.some((v) => v.kind === "view" && v.dataview === dv)) ?? ADMISSIONS_DASHBOARDS[1].panels[1];
  const h = headerOf(panel, dv, c);
  const n = notesOf(dv, c);
  return (
    <Panel tag={h.tag} context={h.context} chips={chipsOf(dv, c)} menu={menuOf(dv, c, h.tag)} title={dataviewById(dv)?.label ?? h.tag} source={sourceOf(dv)} caption={n.caption} visibleCaption={n.visible} height="auto">
      {({ fullscreen }) => <InstanceBody dv={dv} c={c} o={{ fullscreen, spec }} />}
    </Panel>
  );
}
