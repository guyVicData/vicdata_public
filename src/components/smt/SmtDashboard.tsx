"use client";

// VicData 0.8 SMT round 1 (B1-B5): the SMT dashboards -- Overview and Academic -- drawn entirely from
// the shared shell (src/components/shell): Teacher's nav, ControlBar (the "S" badge, the switch, the
// level chips in the subject chips' slot, the pills), the rows, RailPanel (CardBox: the icon row,
// the notes, full screen as a focus mode), the phone's tabs, the footer's Edit · View as… and Copy
// this view…. Every view is a catalogue entry (src/catalogue/smt.ts) plus a component (./views).
//
// Wireframes: docs/wireframes/smt (Main, Academic, LeightonLight, Phone).
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme, type Theme } from "@/components/shell/TeacherChrome";
import { ControlBar, type FocusSubject } from "@/components/shell/ControlBar";
import { GroupSwitcher } from "@/components/shell/GroupSwitcher";
import { PillMenu } from "@/components/shell/PillMenu";
import { MenuDivider, MenuRow } from "@/components/shell/PanelMenu";
import { MenuChip } from "@/components/shell/FilterPills";
import { RailPanel, Tabs, type RailItem } from "@/components/shell/RailPanel";
import { PhoneStack, ShellPage, ShellRow } from "@/components/shell/Rows";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { HeadOfficeBanner } from "@/components/groups/HeadOfficeBanner";
import { openViewAs } from "@/components/view-as/ViewAs";
import { AdmissionsTeacherNav, Divider } from "@/components/admissions/controls";
import { Empty, EntryChip, FChip, Skeleton } from "@/components/admissions/ui";
import { useWidth } from "@/components/admissions/views/charts";
import { CopyViewDialog } from "@/components/copy-view/CopyViewDialog";
import type { ChooserChoice } from "@/components/teacher/ComparatorSetChooser";
import { dataviewById } from "@/catalogue/dataviews";
import { contextFromPanel } from "@/catalogue/pick";
import { SMT_DASHBOARDS, SMT_ACADEMIC_ID, SMT_CONTEXT_ID, SMT_OVERVIEW_ID, SMT_PUPILS_ID } from "@/catalogue/dashboards/smt";
import { ADMISSIONS_NOTES, SMT_NOTES, TREND_BASE_NOTE, smtNote } from "@/catalogue/notes";
import { CENSUS_FIRST_PERIOD, HISTORIC_GRADE_FROM, TREND_BASE_PERIOD, periodLabel, setLatestYears } from "@/catalogue/years";
import type { DashboardConfig, DataviewInstance, PanelConfig } from "@/catalogue/types";
import { loadPublishedVicData } from "@/lib/published-vicdata";
import { editorWritesSettled, isPlatformAdminCached, setEditOn, useInPlaceEdit } from "@/lib/edit-mode";
import { ALL_AREAS_LABEL, LEVEL_LABEL, levelChips, levelLabel, levelQuery, parseLevel, pillsFor, setPhaseOf, type SmtLevel, type SmtPhase } from "@/lib/smt/levels";
import { SMT_ONLY_MESSAGE } from "@/lib/smt/auth-rules";
import { UsageScopeContext, useUsagePageView, type UsageScope } from "@/lib/usage-client";
import { useSmt, type Academic, type Load, type Overview, type SmtFilters, type SmtSchool, type SmtSetChoice } from "./api";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context, ContextArea } from "@/lib/smt/context";
import type { ContextMap } from "@/lib/smt/context-map";
import { AROUND_MILES_UI } from "@/lib/smt/levels";
import { loadSmtMember, type SmtMember, type SmtMemberState } from "./member";
import { DEFAULT_SET_LABEL, useSmtSet } from "./useSmtSet";
import { smtVars, yearOf } from "./ui";
import { SchoolNow } from "./views/Now";
import { Scorecard } from "./views/Scorecard";
import { SetMap } from "./views/SetMap";
import { SchoolFlags } from "./views/Flags";
import { Direction, IndexedLines, MarketLine, PlainLine, PoolLine, ResultsBand, RollIndexed } from "./views/Lines";
import { BandTable, MarketTable, MixTable, RollTable } from "./views/Tables";
import { AcademicNow } from "./views/AcademicNow";
import { SubjectAreas } from "./views/Areas";
import { Subjects } from "./views/Subjects";
import { ValueAdded } from "./views/ValueAdded";
import { GradeProfile } from "./views/Grades";
import { EntriesMix } from "./views/Mix";
import { ReservedPanel } from "./views/Reserved";
import { EntryPoints, LeavingAt16, PupilsNow, ShapeAndSize } from "./views/Pupils";
import { AgeBars, AreaMap, BirthsAndProjections, BirthsIndexed, BirthsTable, ContextNow, NearbyOverTime, PopulationProjected, shadeOptions, type ShadeBy } from "./views/Context";

const ComparatorSetChooser = lazy(() => import("@/components/teacher/ComparatorSetChooser").then((m) => ({ default: m.ComparatorSetChooser })));
const EditorScreen = lazy(() => import("@/components/editor/EditorScreen").then((m) => ({ default: m.EditorScreen })));

export type SmtDash = "overview" | "academic" | "pupils" | "context";
const DASHES: SmtDash[] = ["overview", "academic", "pupils", "context"];
const DASH_ID: Record<SmtDash, string> = { overview: SMT_OVERVIEW_ID, academic: SMT_ACADEMIC_ID, pupils: SMT_PUPILS_ID, context: SMT_CONTEXT_ID };
const PATH: Record<SmtDash, string> = { overview: "/teacher/smt", academic: "/teacher/smt/academic", pupils: "/teacher/smt/pupils", context: "/teacher/smt/context" };
const PHONE = 768; // Admissions' phone width
const ROW_NOW = 530; // Admissions' rows (0.7 r3 F1)
const ROW_TRENDS = 340;

// The "S" in the bar's badge, where Teacher draws the phase glyph and Admissions its "A".
export const SMT_BADGE = <span className="text-[19px] font-extrabold leading-none">S</span>;

// ------------------------------------------------------------------------------------- page

export function SmtDashboard({ dash }: { dash: SmtDash }) {
  const [theme, setTheme] = useTeacherTheme();
  const [state, setState] = useState<SmtMemberState>({ status: "loading" });
  useEffect(() => {
    loadSmtMember().then(setState);
  }, []);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  useEffect(() => {
    if (state.status === "no-school" || (state.status === "ready" && state.member.access === "none")) isPlatformAdminCached(createBrowserSupabaseClient()).then(setPlatformAdmin);
  }, [state]);
  // B5: the page registers the SMT dashboard in view, so the platform admin's Edit (the footer's and
  // the View as banner's) opens the shared editor in place, with this school as the live preview.
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const shows = state.status === "ready" && state.member.access !== "none";
  const inPlace = useInPlaceEdit(supabase, shows ? DASH_ID[dash] : null);
  const editing = inPlace.editing && state.status === "ready";
  return (
    <>
      {editing && state.status === "ready" && (
        <Suspense fallback={<p className="p-6 text-sm text-[var(--muted)]">Opening the editor…</p>}>
          <SmtEditor slug={DASH_ID[dash]} school={{ urn: state.member.schoolUrn, name: state.member.schoolName }} />
        </Suspense>
      )}
      <main id={editing ? undefined : "teacher-root"} hidden={editing} data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={smtVars(theme)}>
        {state.status === "ready" && state.member.access !== "none" ? (
          <Dashboard member={state.member} dash={dash} theme={theme} onTheme={setTheme} reloadTick={inPlace.reloadTick} />
        ) : (
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-7 py-5">
            <AdmissionsTeacherNav schoolUrn={state.status === "ready" ? state.member.schoolUrn : null} theme={theme} onTheme={setTheme} />
            <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 text-[13px] text-[var(--muted2)]">
              {state.status === "loading" ? (
                "Loading SMT…"
              ) : state.status === "not-found" ? (
                "Not found."
              ) : state.status === "signed-out" ? (
                <>
                  <Link href={`/login?next=${PATH[dash]}`} className="font-bold text-[var(--adm-accent-text)]">
                    Sign in
                  </Link>{" "}
                  to see the SMT dashboards.
                </>
              ) : platformAdmin && !(state.status === "ready" && state.member.viewAs) ? (
                <span className="flex flex-wrap items-center gap-3">
                  To see a school&rsquo;s SMT dashboards, use View as.
                  <button type="button" onClick={() => openViewAs()} className="rounded-full border border-[var(--panel-border2)] px-3 py-1 text-[12px] font-bold text-[var(--fg)] hover:border-[var(--fg)]">
                    View as&hellip;
                  </button>
                </span>
              ) : (
                SMT_ONLY_MESSAGE
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function SmtEditor({ slug: pageSlug, school }: { slug: string; school: { urn: string; name: string } }) {
  const [slug, setSlug] = useState(pageSlug);
  const pin = useMemo(() => ({ urn: school.urn, name: school.name }), [school.urn, school.name]);
  return <EditorScreen id={slug} host={{ school: pin, top: <ViewAsBanner className="" />, onExit: () => setEditOn(false), onSwitch: setSlug }} />;
}

// ------------------------------------------------------------------------------- the level

const LEVEL_KEY = (urn: string) => `vicdata.smt.level:${urn}`;

function useLevel(urn: string, school: SmtSchool | null): [SmtLevel, (l: SmtLevel) => void] {
  const areas = school ? { gcse: school.areas.gcse.map((a) => a.id), post16: school.areas.post16.map((a) => a.id) } : null;
  const [raw, setRaw] = useState<URLSearchParams>(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("level")) return sp;
    // Remembered for the user between visits, as Teacher remembers its subject.
    try {
      const saved = window.localStorage.getItem(LEVEL_KEY(urn));
      if (saved) return new URLSearchParams(saved);
    } catch {
      // Blocked storage: Whole school.
    }
    return sp;
  });
  const level = parseLevel(raw, school?.phases ?? null, areas);
  const set = (l: SmtLevel) => {
    const q = levelQuery(l);
    const sp = new URLSearchParams(window.location.search);
    sp.delete("level");
    sp.delete("area");
    for (const [k, v] of Object.entries(q)) sp.set(k, v);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
    try {
      window.localStorage.setItem(LEVEL_KEY(urn), new URLSearchParams(q).toString());
    } catch {
      // As above.
    }
    setRaw(new URLSearchParams(q));
  };
  return [level, set];
}

// ------------------------------------------------------------------------------- dashboard

export type Ctx = {
  member: SmtMember;
  school: SmtSchool;
  dash: SmtDash;
  level: SmtLevel;
  set: SmtSetChoice;
  filters: SmtFilters;
  overview: Load<Overview>;
  academic: Load<Academic>;
  pupils: Load<Pupils>;
  context: Load<Context>;
  // 0.8 SMT r3: the map's neighbourhoods (a separate read) and its "Shade by".
  contextMap: Load<ContextMap>;
  shade: ShadeBy;
  onShade: (s: ShadeBy) => void;
  onArea: (stage: "ks4" | "ks5", id: string) => void;
  focusBar: ReactNode;
  phone: boolean;
};

function Dashboard({ member, dash, theme, onTheme, reloadTick }: { member: SmtMember; dash: SmtDash; theme: Theme; onTheme: (t: Theme) => void; reloadTick: number }) {
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const phone = width > 0 && width < PHONE;
  const school = useSmt<SmtSchool>(`/api/smt/school?urn=${member.schoolUrn}`, null);
  const s = school.status === "ready" ? school.data : null;
  useEffect(() => {
    if (s) setLatestYears(s.latest);
  }, [s]);
  const [level, setLevel] = useLevel(member.schoolUrn, s);
  const phase = s ? setPhaseOf(s.phases) : null;
  const sets = useSmtSet(member.schoolUrn, phase);
  const [chooser, setChooser] = useState<{ editing: NonNullable<typeof sets.savedSets>["sets"][number] | null } | null>(null);
  const [filters, setFilters] = useState<SmtFilters>({ sex: "all", boarding: "all" });
  const f: SmtFilters = { sex: s?.mixed ? filters.sex : "all", boarding: s?.boarding ? filters.boarding : "all" };

  // The published configs (the store's, else the code copy), re-read after editing.
  const [configs, setConfigs] = useState<Record<SmtDash, DashboardConfig>>({ overview: SMT_DASHBOARDS[0], academic: SMT_DASHBOARDS[1], pupils: SMT_DASHBOARDS[2], context: SMT_DASHBOARDS[3] });
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      if (reloadTick > 0) await editorWritesSettled();
      const [o, a, p, c] = await Promise.all(SMT_DASHBOARDS.map((d) => loadPublishedVicData(supabase, d.id, d)));
      setConfigs({ overview: o.config, academic: a.config, pupils: p.config, context: c.config });
    })();
  }, [reloadTick]);

  const set = sets.set;
  const body = set ? { urn: member.schoolUrn, set } : null;
  const overview = useSmt<Overview>(s && body && dash === "overview" ? "/api/smt/overview" : null, body ? { ...body, filters: f } : null);
  const academic = useSmt<Academic>(s && body && dash === "academic" ? "/api/smt/academic" : null, body ? { ...body, level: level.phase, area: level.area } : null);
  const pupils = useSmt<Pupils>(s && body && dash === "pupils" ? "/api/smt/pupils" : null, body ? { ...body, level: level.phase, filters: f } : null);
  // Context: the area pill (around the school, or the LA), held in the address (?area=la).
  const [area, setArea] = useState<ContextArea>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("near") === "la" ? "la" : "around"));
  // 0.8 SMT r3: the level picks the ages; the map's neighbourhoods are read only around the school.
  const context = useSmt<Context>(s && dash === "context" ? `/api/smt/context?urn=${member.schoolUrn}&area=${area}&level=${level.phase}` : null, null);
  const contextMap = useSmt<ContextMap>(s && dash === "context" && area === "around" ? `/api/smt/context/map?urn=${member.schoolUrn}&level=${level.phase}` : null, null);
  const [shade, setShade] = useState<ShadeBy>("children");

  // B7: a page view, once per school, dashboard, level and set kind.
  const usage: UsageScope | null = useMemo(() => (s ? { product: "smt", urn: member.schoolUrn, dashboard: DASH_ID[dash], level: level.area ? `${level.phase}/${level.area}` : level.phase, setKind: set?.kind ?? null, resolved: !!set } : null), [s, member.schoolUrn, dash, level.phase, level.area, set]);
  // Never logged: a platform admin in View as, or head office reading a member school (groups r1).
  const quiet = !!member.viewAs || member.access === "headOffice";
  useUsagePageView(quiet ? null : usage);

  const router = useRouter();
  const go = (d: SmtDash) => {
    if (d !== dash) router.push(`${PATH[d]}${window.location.search}`);
  };

  if (school.status === "error")
    return (
      <ShellPage phone={phone} rootRef={rootRef}>
        <ViewAsBanner />
        <AdmissionsTeacherNav schoolUrn={member.schoolUrn} theme={theme} onTheme={onTheme} />
        <Empty>{school.code === 403 ? SMT_ONLY_MESSAGE : school.message}</Empty>
      </ShellPage>
    );

  const chips: FocusSubject[] = s
    ? levelChips(s.phases).map((p) => ({ key: p, label: LEVEL_LABEL[p], ...(p === "gcse" && s.phases.igcse ? { marked: { reason: SMT_NOTES.igcseChip } } : {}) }))
    : [];
  const areas = s && (level.phase === "gcse" || level.phase === "post16") && !(level.phase === "gcse" && s.phases.igcse) ? s.areas[level.phase] : [];
  const subRow =
    dash === "academic" && areas.length
      ? { label: "Subject area", chips: [{ key: "", label: ALL_AREAS_LABEL }, ...areas.map((a) => ({ key: a.id, label: a.label }))], focusKey: level.area ?? "", onFocus: (k: string) => setLevel({ phase: level.phase, area: k || null }) }
      : undefined;
  const onLevel = (k: string) => setLevel({ phase: k as SmtPhase, area: null });
  const focusBar = chips.length > 1 ? (
    <span role="group" aria-label="Level" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <EntryChip key={c.key} label={c.label} active={c.key === level.phase} onClick={() => onLevel(c.key)} />
      ))}
    </span>
  ) : undefined;

  const setPill = (
    <PillMenu label="Compared against" value={set ? set.label : sets.choice.kind === "nearest" ? DEFAULT_SET_LABEL : "Loading…"} menuLabel="Compared against" width={300} align="right" title={set ? `${set.label}: ${set.urns.length} schools` : undefined}>
      {(close) => {
        const savedId = sets.choice.kind === "saved" ? sets.choice.id : null;
        const saved = savedId ? sets.savedSets?.sets.find((x) => x.id === savedId) ?? null : null;
        return (
          <>
            <MenuRow label={`${set?.label ?? "…"} · ${set ? set.urns.length : "…"} schools`} selected onClick={close} />
            <MenuRow
              label="Edit this set…"
              title={saved?.editable ? undefined : "Only a saved set you can edit opens here; choose or save one with Change comparison…"}
              onClick={() => {
                close();
                if (saved?.editable) setChooser({ editing: saved });
                else setChooser({ editing: null });
              }}
            />
            <MenuDivider />
            <MenuRow
              label="Change comparison…"
              onClick={() => {
                close();
                setChooser({ editing: null });
              }}
            />
            <div className="px-3 pb-2 pt-1 text-[11px] leading-snug text-[var(--muted2)]">Teacher&rsquo;s chooser: 10 nearest &middot; schools in the LA &middot; my saved sets &middot; the school&rsquo;s sets &middot; regional and national rankings. One set for the whole dashboard; saved sets are shared with Teacher.</div>
          </>
        );
      }}
    </PillMenu>
  );
  // Context (the board): the Area pill and "Compared against: England" (its comparisons are the LA
  // and England); no set, no gender or boarding (the area's figures have neither split).
  const setArea2 = (a: ContextArea) => {
    setArea(a);
    const sp = new URLSearchParams(window.location.search);
    if (a === "la") sp.set("near", "la");
    else sp.delete("near");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  };
  const contextPills = (
    <>
      <Divider />
      <MenuChip
        label="Area"
        value={area}
        onPick={setArea2}
        options={[
          { id: "around", label: "Area: around the school", title: smtNote("aroundSchool", { miles: AROUND_MILES_UI }) },
          { id: "la", label: `Area: ${s?.laName ?? "the LA"}` },
        ]}
      />
      <FChip title="Context compares the area with England">Compared against: England</FChip>
    </>
  );
  const pills = dash === "context" ? contextPills : (
    <>
      <Divider />
      {setPill}
      {s && pillsFor(s).includes("gender") && (
        <MenuChip
          label="Pupils"
          value={f.sex}
          onPick={(sex) => setFilters({ ...filters, sex })}
          options={[
            { id: "all", label: "All pupils" },
            { id: "female", label: "Girls" },
            { id: "male", label: "Boys" },
          ]}
        />
      )}
      {s && pillsFor(s).includes("boarding") && (
        <MenuChip
          label="Day and boarding"
          value={f.boarding}
          onPick={(boarding) => setFilters({ ...filters, boarding })}
          options={[
            { id: "all", label: "Day + boarding" },
            { id: "day", label: "Day only" },
            { id: "boarding", label: "Boarding only" },
          ]}
        />
      )}
    </>
  );

  const config = configs[dash];
  const ctx: Ctx | null = s && set ? { member, school: s, dash, level, set, filters: f, overview, academic, pupils, context, contextMap, shade, onShade: setShade, onArea: (st, id) => setLevel({ phase: st === "ks4" ? "gcse" : "post16", area: id }), focusBar, phone } : null;
  const switcher = <GroupSwitcher dashboards={DASHES.map((d) => configs[d])} activeId={config.id} onSwitch={(d) => go(DASHES.find((x) => configs[x].id === d.id) ?? "overview")} />;

  return (
    <UsageScopeContext.Provider value={quiet ? null : usage}>
      <ShellPage phone={phone} rootRef={rootRef}>
        <ViewAsBanner />
        <div className={phone ? "px-4 pt-4" : undefined}>
          <AdmissionsTeacherNav schoolUrn={member.schoolUrn} theme={theme} onTheme={onTheme} />
        </div>
        {member.headOffice && <HeadOfficeBanner note={member.headOffice.note} className={phone ? "mx-4" : undefined} />}
        {phone ? (
          <PhoneStack>
            <div className="self-start">{switcher}</div>
            <div className="flex flex-wrap gap-[6px]">
              {chips.map((c) => (
                <EntryChip key={c.key} label={c.label} active={c.key === level.phase} onClick={() => onLevel(c.key)} />
              ))}
            </div>
            {ctx ? <PhoneBody config={config} c={ctx} /> : <Skeleton />}
          </PhoneStack>
        ) : (
          <>
            <ControlBar
              phase="ks4"
              phaseLabel="SMT"
              schoolName={member.schoolName}
              measure="candidates"
              onMeasure={() => undefined}
              badge={SMT_BADGE}
              switcher={switcher}
              subjectsLabel="Level"
              subjects={chips}
              focusKey={level.phase}
              onFocus={onLevel}
              onEditSubjects={() => undefined}
              noEdit
              subRow={subRow}
              chrome={pills}
            />
            {ctx ? <DesktopGrid config={config} c={ctx} /> : <div className="grid grid-cols-3 gap-6" style={{ height: ROW_NOW }}><Skeleton /><div className="col-span-2 flex"><Skeleton /></div></div>}
          </>
        )}
        {chooser && sets.savedSets && phase && (
          <Suspense fallback={null}>
            <ComparatorSetChooser
              payload={sets.savedSets}
              phase={phase}
              theme={theme}
              targetUrn={member.schoolUrn}
              targetName={member.schoolName}
              initialEdit={chooser.editing}
              onClose={() => setChooser(null)}
              onSetsChanged={sets.reloadSaved}
              onDone={(choice: ChooserChoice) => {
                setChooser(null);
                sets.choose(choice);
              }}
            />
          </Suspense>
        )}
      </ShellPage>
    </UsageScopeContext.Provider>
  );
}

// ------------------------------------------------------------------------------- the grid

function rowContext(row: string, c: Ctx): string {
  const census = c.school.census.at(-1)?.period ?? null;
  const ks4 = c.school.latest.ks4?.period;
  const ks5 = c.school.latest.ks5?.period;
  if (c.dash === "overview") {
    if (row === "now") {
      const results = c.school.phases.gcse && !c.school.phases.igcse && ks4 !== undefined ? `results ${yearOf(ks4, "ks4")}` : c.school.phases.post16 && ks5 !== undefined ? `Post-16 results ${yearOf(ks5, "ks5")}` : "";
      return [census !== null ? `January ${census + 1} census` : null, results || null].filter(Boolean).join(" · ");
    }
    return `indexed to 100, against ${c.school.laName ?? "the LA"} and England`;
  }
  if (c.dash === "pupils") {
    if (row === "now") return census !== null ? `January ${census + 1} census` : "";
    return `${periodLabel(CENSUS_FIRST_PERIOD)} to ${census !== null ? periodLabel(census) : ""}`;
  }
  if (c.dash === "context") {
    const to = c.context.status === "ready" ? c.context.data.population.to : null;
    if (row === "now") return `ONS mid-year estimates and births${to !== null ? `, projections to ${to}` : ""}`;
    return "indexed to 100, against England";
  }
  const area = c.level.area ? (c.school.areas[c.level.phase === "gcse" ? "gcse" : "post16"].find((a) => a.id === c.level.area)?.label ?? null) : null;
  const stage = c.level.phase === "gcse" ? "ks4" : c.level.phase === "post16" ? "ks5" : c.level.phase === "primary" ? "ks2" : null;
  const latest = stage ? c.school.latest[stage]?.period : (ks4 ?? ks5);
  if (row === "now") return [levelLabel(c.level, area), latest !== undefined ? yearOf(latest, stage ?? "ks4") : null].filter(Boolean).join(" · ");
  return `${levelLabel(c.level, area)}, ${periodLabel(HISTORIC_GRADE_FROM)} to ${latest !== undefined ? periodLabel(latest) : ""}`;
}

function DesktopGrid({ config, c }: { config: DashboardConfig; c: Ctx }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ now: true, trends: true });
  return (
    <>
      {config.rows.map((row) => (
        <ShellRow key={row.id} title={row.name} context={rowContext(row.id, c)} open={open[row.id] !== false} onToggle={() => setOpen((o) => ({ ...o, [row.id]: o[row.id] === false }))}>
          {config.panels
            .filter((p) => p.row === row.id)
            .sort((a, b) => config.columns.findIndex((x) => x.id === a.column) - config.columns.findIndex((x) => x.id === b.column))
            .map((p) => (
              <ConfigPanel key={p.id} panel={p} c={c} config={config} height={row.id === "now" ? ROW_NOW : ROW_TRENDS} />
            ))}
        </ShellRow>
      ))}
    </>
  );
}

const dvOf = (panel: PanelConfig, id: string) => {
  const v = panel.dataviews.find((x) => x.id === id);
  return v && v.kind === "view" ? v.dataview : "";
};
const railOf = (panel: PanelConfig): RailItem[] =>
  panel.dataviews.filter((v): v is Extract<DataviewInstance, { kind: "view" }> => v.kind === "view").map((v) => ({ id: v.id, label: dataviewById(v.dataview)?.label ?? v.dataview, icon: dataviewById(v.dataview)?.railIcon ?? "TilesIcon" }));

// The large view opens on Subjects when an area is chosen (the wireframe's Academic board), else on
// the panel's default.
function defaultOf(panel: PanelConfig, c: Ctx): string {
  if (c.dash === "academic" && c.level.area && panel.span && panel.span.cols >= 2) {
    const subj = panel.dataviews.find((v) => v.kind === "view" && v.dataview === "DV-SMT-A-SUBJECTS");
    if (subj) return subj.id;
  }
  return panel.defaultView ?? panel.dataviews[0]?.id ?? "";
}

function useActive(panel: PanelConfig, c: Ctx): [string, (id: string) => void] {
  const def = defaultOf(panel, c);
  const [picked, setPicked] = useState<{ for: string; id: string } | null>(null);
  return [picked && picked.for === def ? picked.id : def, (id) => setPicked({ for: def, id })];
}

function ConfigPanel({ panel, c, height, config }: { panel: PanelConfig; c: Ctx; height: number; config: DashboardConfig }) {
  const [active, setActive] = useActive(panel, c);
  const [copying, setCopying] = useState(false);
  const instance = panel.dataviews.find((v) => v.id === active);
  const dv = dvOf(panel, active);
  const def = dataviewById(dv);
  const title = def?.label ?? panel.name ?? "";
  const h = headerOf(panel, dv, c);
  return (
    <>
      <RailPanel
        id={panel.id}
        tag={h.tag}
        context={h.context}
        rail={railOf(panel)}
        railActive={active}
        onRail={setActive}
        source={sourceOf(dv, c)}
        caption={captionOf(dv, c)}
        chips={chipsOf(dv, c)}
        height={height}
        span={(panel.span?.cols ?? 1) >= 2 ? 2 : 1}
        title={title}
        focusBar={c.focusBar}
        onCopy={c.member.viewAs || c.member.access === "headOffice" || !instance || instance.kind !== "view" ? undefined : () => setCopying(true)}
        flag={flagOf(dv, c)}
      >
        {({ fullscreen, height: room }) => <ViewBody dv={dv} c={c} fullscreen={fullscreen} room={room} />}
      </RailPanel>
      {copying && instance?.kind === "view" && (
        <CopyViewDialog
          open
          meetingOnly
          onClose={() => setCopying(false)}
          source={{
            instance,
            context: contextFromPanel(config, panel.id, { school: c.member.schoolName }),
            title: `${title} · ${levelLabel(c.level)}`,
            pinned: { schoolUrn: c.member.schoolUrn, schoolName: c.member.schoolName, params: { level: c.level.phase, area: c.level.area, set: { kind: c.set.kind, label: c.set.label, urns: c.set.urns }, ...(c.context.status === "ready" ? { near: c.context.data.area, ...(dv === "DV-SMT-C-MAP" ? { shade: c.shade } : {}) } : {}) }, keepLive: true },
          }}
        />
      )}
    </>
  );
}

// A view's own header pill: Context's map has "Shade by", listing only what exists (K3).
function chipsOf(dv: string, c: Ctx): ReactNode {
  if (dv !== "DV-SMT-C-MAP" || c.context.status !== "ready") return null;
  const map = c.contextMap.status === "ready" ? c.contextMap.data : null;
  const opts = shadeOptions(c.context.data, c.context.data.area === "around" ? map : null);
  const value = opts.some((o) => o.id === c.shade) ? c.shade : "children";
  return <MenuChip label="Shade by" value={value} onPick={c.onShade} options={opts} menuWidth={300} />;
}

// The panel's header line: its tag (the view's own name or the panel's) and the context after it.
function headerOf(panel: PanelConfig, dv: string, c: Ctx): { tag: string; context: ReactNode } {
  const set = c.set.label;
  switch (dv) {
    case "DV-SMT-O-NOW":
      return { tag: "Current", context: "whole school" };
    case "DV-SMT-O-SCORECARD":
      return { tag: "Scorecard", context: `each headline against ${set}, the region and England` };
    case "DV-SMT-O-MAP":
      return { tag: "Map", context: `the school and ${set}` };
    case "DV-SMT-O-FLAGS":
      return { tag: "Flags", context: "on the school itself" };
    case "DV-SMT-O-ROLL-LINE":
    case "DV-SMT-O-ROLL-TABLE":
      return { tag: "Trends", context: `${periodLabel(CENSUS_FIRST_PERIOD)} = 100` };
    case "DV-SMT-O-RESULTS-LINE":
    case "DV-SMT-O-RESULTS-TABLE": {
      const latest = c.school.latest.ks4?.period ?? c.school.latest.ks5?.period;
      return { tag: "Trends", context: `${periodLabel(HISTORIC_GRADE_FROM)} to ${latest !== undefined ? periodLabel(latest) : ""}` };
    }
    case "DV-SMT-O-MARKET-LINE":
    case "DV-SMT-O-MARKET-TABLE":
      return { tag: "From Admissions", context: "read-only" };
    case "DV-SMT-A-NOW":
      return { tag: "Current", context: levelLabel(c.level, areaLabelOf(c)) };
    case "DV-SMT-A-AREAS":
      return { tag: "Subject areas", context: `against ${set}` };
    case "DV-SMT-A-SUBJECTS":
      return { tag: "Subjects", context: `${areaLabelOf(c) ? `in ${areaLabelOf(c)}, ` : ""}against ${set} and England` };
    case "DV-SMT-A-VA":
      return { tag: "Value added", context: "DfE, where published" };
    case "DV-SMT-A-GRADES":
      return { tag: "Grade profile", context: levelLabel(c.level, areaLabelOf(c)) };
    case "DV-SMT-A-TREND-LINE":
    case "DV-SMT-A-TREND-TABLE":
      return { tag: "Trends", context: c.level.area ? "average grade" : "headline" };
    case "DV-SMT-A-BANDS":
      return { tag: "Trends", context: "results by band" };
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
      return { tag: "Trends", context: "entries mix" };
    // 0.8 SMT round 2: Pupils
    case "DV-SMT-P-NOW":
      return { tag: "Current", context: c.school.census.at(-1) ? `Data ${periodLabel(c.school.census.at(-1)!.period)}` : "" };
    case "DV-SMT-P-SHAPE":
      return { tag: "Shape and size", context: `pupils by age, against the local shape and ${set}` };
    case "DV-SMT-P-ENTRIES":
      return { tag: "Entry points", context: "from Admissions, read-only" };
    case "DV-SMT-P-LEAVING":
      return { tag: "Leaving at 16", context: "Year 11 to Year 12" };
    case "DV-SMT-P-MARKET":
      return { tag: "Market share", context: "from Admissions, read-only" };
    case "DV-SMT-P-PHASES":
    case "DV-SMT-P-PHASES-TABLE":
      return { tag: "Trends", context: `${periodLabel(CENSUS_FIRST_PERIOD)} = 100` };
    case "DV-SMT-P-POOL":
      return { tag: "From Admissions", context: `${c.pupils.status === "ready" && c.pupils.data.trends.pool.status === "ready" ? c.pupils.data.trends.pool.entry : "main entry point"}, read-only` };
    case "DV-SMT-P-AREA":
      return { tag: "Area", context: `ONS residents, ages ${c.pupils.status === "ready" ? c.pupils.data.trends.area.agesWord : "5–15"}` };
    // 0.8 SMT round 2: Context
    case "DV-SMT-C-NOW":
      return { tag: "Current", context: c.context.status === "ready" && c.context.data.area === "la" ? (c.school.laName ?? "the LA") : "around the school" };
    case "DV-SMT-C-MAP":
      return { tag: "Map", context: c.context.status === "ready" && c.context.data.area === "la" ? (c.school.regionName ?? c.school.laName ?? "") : "the area around the school" };
    case "DV-SMT-C-BYAGE":
      return { tag: "Population by age", context: c.context.status === "ready" && c.context.data.byAge.scope === "around" ? "within 5 miles" : (c.school.laName ?? "") };
    case "DV-SMT-C-NEARBY":
      return { tag: "Children nearby", context: "residents, indexed" };
    case "DV-SMT-C-BIRTHS":
      return { tag: "Births and projections", context: c.school.laName ?? "" };
    case "DV-SMT-C-BIRTHS-INDEXED":
    case "DV-SMT-C-BIRTHS-TABLE":
      return { tag: "Trends", context: "births, 2012 = 100" };
    case "DV-SMT-C-PROJECTION":
      return { tag: "Forward", context: c.context.status === "ready" && c.context.data.population.to !== null ? `to ${c.context.data.population.to}` : "" };
    case "DV-SMT-C-AGES":
      return { tag: "Area", context: "population by age" };
  }
  return { tag: panel.name ?? "", context: null };
}

const areaLabelOf = (c: Ctx) => (c.level.area ? (c.school.areas[c.level.phase === "gcse" ? "gcse" : "post16"].find((a) => a.id === c.level.area)?.label ?? null) : null);

/** The source behind each panel's "i": the view's title and its measures' citations; Context's names
 * its sources and editions, the years read from the data (wording rule 6). */
function sourceOf(dv: string, c?: Ctx): ReactNode {
  const d = dataviewById(dv);
  if (!d) return null;
  if (dv.startsWith("DV-SMT-C-") && c && c.context.status === "ready")
    return (
      <>
        {d.titleTemplate.replace(/\[[^\]]+\]/g, "…")}. {c.context.data.notes.sources} <span className="opacity-70">({d.measures.join(", ")})</span>
      </>
    );
  const cites: Record<string, string> = { "M-SMT-SCHOOL": "DfE school census (January)", "M-SMT-RESULTS": "DfE KS2, KS4 and KS5 performance tables", "M-SMT-VA": "DfE performance tables (value added)", "M-SMT-SUBJECTS": "DfE KS4 and KS5 subject tables", "M-ADM-MARKET": "DfE school census, Admissions' rivals" };
  return (
    <>
      {d.titleTemplate.replace(/\[[^\]]+\]/g, "…")}. {Array.from(new Set(d.measures.map((m) => cites[m]).filter(Boolean))).join("; ")}. <span className="opacity-70">({d.measures.join(", ")})</span>
    </>
  );
}

/** The honesty note behind each panel's caption button: SMT_NOTES only (R-SMT-NOTES). */
function captionOf(dv: string, c: Ctx): ReactNode {
  const set = c.set.label;
  const igcse = c.school.phases.igcse ? ` ${smtNote("igcseView", { school: c.school.name })}` : "";
  switch (dv) {
    case "DV-SMT-O-NOW":
      return `${SMT_NOTES.size} ${c.overview.status === "ready" ? c.overview.data.p8.text : ""}`;
    case "DV-SMT-O-SCORECARD":
      return `${SMT_NOTES.ranks} ${smtNote("sinceBase", { base: periodLabel(TREND_BASE_PERIOD) })}${igcse}`;
    case "DV-SMT-O-FLAGS":
      return SMT_NOTES.flagsRule.replace("{gap}", "the set's middle by a fixed margin");
    case "DV-SMT-O-ROLL-LINE":
    case "DV-SMT-O-ROLL-TABLE":
      return c.overview.status === "ready" ? `${c.overview.data.notes.rollIndexed} ${SMT_NOTES.rollAreaUndercount}` : null;
    case "DV-SMT-O-RESULTS-LINE":
    case "DV-SMT-O-RESULTS-TABLE":
    case "DV-SMT-A-TREND-LINE":
    case "DV-SMT-A-TREND-TABLE":
      return `${smtNote("middleHalf", { setLabel: set })} ${TREND_BASE_NOTE}${igcse}`;
    case "DV-SMT-O-MARKET-LINE":
    case "DV-SMT-O-MARKET-TABLE":
      return SMT_NOTES.marketShort;
    case "DV-SMT-A-NOW":
    case "DV-SMT-A-AREAS":
      return `${SMT_NOTES.ranks}${igcse}`;
    case "DV-SMT-A-SUBJECTS":
      return `${SMT_NOTES.ranks} ${smtNote("smallEntries", { min: 5 })}`;
    case "DV-SMT-A-VA":
      return SMT_NOTES.alevelVa;
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
      return SMT_NOTES.entriesMix;
    case "DV-SMT-A-BANDS":
      return SMT_NOTES.bandReserved;
    case "DV-SMT-P-NOW":
    case "DV-SMT-P-SHAPE":
      return `${SMT_NOTES.size} ${SMT_NOTES.shapesAround} ${SMT_NOTES.levelAges}`;
    case "DV-SMT-P-ENTRIES":
    case "DV-SMT-P-POOL":
      return SMT_NOTES.pool;
    case "DV-SMT-P-LEAVING":
      return ADMISSIONS_NOTES.leaving16;
    case "DV-SMT-P-MARKET":
      return SMT_NOTES.marketShort;
    case "DV-SMT-P-PHASES":
    case "DV-SMT-P-PHASES-TABLE":
      return smtNote("rollByPhase", { base: periodLabel(CENSUS_FIRST_PERIOD) });
    case "DV-SMT-P-AREA":
      return c.pupils.status === "ready" ? smtNote("areaResidents", { la: c.school.laName ?? "The LA", ages: c.pupils.data.trends.area.agesWord }) : SMT_NOTES.areaResidentsCaption;
    case "DV-SMT-C-NOW":
      return c.context.status === "ready" ? `${c.context.data.notes.children} ${c.context.data.notes.births} ${c.context.data.notes.projection} ${SMT_NOTES.wDeciles} ${smtNote("mixInfo", { miles: AROUND_MILES_UI })} ${SMT_NOTES.fsmInfo}` : null;
    case "DV-SMT-C-MAP":
      return c.contextMap.status === "ready" && c.contextMap.data.state === "lsoa" && c.context.status === "ready" && c.context.data.area === "around" ? `${SMT_NOTES.mapNeighbourhoods}. ${smtNote("mapRing", { miles: c.contextMap.data.radiusMiles })} ${SMT_NOTES.wDeciles}` : SMT_NOTES.shadeByDistrict;
    case "DV-SMT-C-BYAGE":
    case "DV-SMT-C-AGES":
      return c.context.status === "ready" ? `${c.context.data.notes.popByAge} ${SMT_NOTES.wResidents}` : null;
    case "DV-SMT-C-NEARBY":
      return c.context.status === "ready" ? `${c.context.data.notes.nearby} ${SMT_NOTES.wResidents}` : null;
    case "DV-SMT-C-BIRTHS":
    case "DV-SMT-C-BIRTHS-INDEXED":
    case "DV-SMT-C-BIRTHS-TABLE":
      return c.context.status === "ready" ? `${c.context.data.notes.births} ${c.context.data.notes.projection}` : SMT_NOTES.births;
    case "DV-SMT-C-PROJECTION":
      return c.context.status === "ready" ? `${c.context.data.notes.population} ${c.context.data.notes.projection}` : null;
  }
  return null;
}

/** The direction word at a trend panel's foot (the wireframes' "▲ Growing", "▬ Steady"). */
function flagOf(dv: string, c: Ctx): ReactNode {
  if (c.dash === "overview" && c.overview.status === "ready") {
    const o = c.overview.data;
    if (dv === "DV-SMT-O-ROLL-LINE") {
      const l = o.trends.roll.lines[0];
      return l ? <Direction pts={l.pts} flat={2} up="Growing" down="Shrinking" /> : null;
    }
    if (dv === "DV-SMT-O-RESULTS-LINE") {
      const t = o.trends.results[0];
      return t ? <Direction pts={t.school} flat={0.5} /> : null;
    }
    if (dv === "DV-SMT-O-MARKET-LINE" && o.trends.market.status === "ready") return <Direction pts={o.trends.market.school} flat={0.5} up="Gaining share" down="Losing share" />;
  }
  if (c.dash === "pupils" && c.pupils.status === "ready") {
    const p = c.pupils.data;
    if (dv === "DV-SMT-P-PHASES" && p.trends.phases[0]) return <Direction pts={p.trends.phases[0].pts} flat={2} up="Growing" down="Shrinking" />;
    if (dv === "DV-SMT-P-POOL" && p.trends.pool.status === "ready") {
      const all = [...p.trends.pool.counted, ...p.trends.pool.births];
      const now = p.trends.pool.counted.at(-1)?.value ?? null;
      const end = all.at(-1)?.value ?? null;
      if (now && end !== null) {
        const pct = ((end - now) / now) * 100;
        return <span className={`text-[12px] font-bold ${pct > 2 ? "text-[var(--adm-up-fg)]" : pct < -2 ? "text-[var(--adm-down-fg)]" : "text-[var(--muted2)]"}`}>{pct > 2 ? "▲ Pool rising" : pct < -2 ? "▼ Pool falling" : "▬ Pool steady"}</span>;
      }
    }
  }
  if (dv === "DV-SMT-C-BIRTHS-INDEXED" && c.context.status === "ready") {
    const l = c.context.data.births.la;
    const a = l.find((x) => x.value !== null)?.value ?? null;
    const b = [...l].reverse().find((x) => x.value !== null)?.value ?? null;
    if (a && b !== null) {
      const pct = ((b - a) / a) * 100;
      return <span className={`text-[12px] font-bold ${pct > 2 ? "text-[var(--adm-up-fg)]" : pct < -2 ? "text-[var(--adm-down-fg)]" : "text-[var(--muted2)]"}`}>{pct > 2 ? "▲ Rising" : pct < -2 ? "▼ Falling" : "▬ Steady"}</span>;
    }
  }
  if (dv === "DV-SMT-A-TREND-LINE" && c.academic.status === "ready" && c.academic.data.parts[0]) return <Direction pts={c.academic.data.parts[0].trend.school} flat={c.level.area ? 0.05 : 0.5} />;
  return null;
}

// ------------------------------------------------------------------------------- the views

function ready<T>(l: Load<T>, render: (d: T) => ReactNode): ReactNode {
  if (l.status === "loading") return <Skeleton />;
  if (l.status === "error") return <Empty>{l.message}</Empty>;
  return render(l.data);
}

export function ViewBody({ dv, c, fullscreen, room }: { dv: string; c: Ctx; fullscreen: boolean; room?: number }) {
  const [stage, setStage] = useState(0);
  if (dv.startsWith("DV-SMT-O-")) {
    return ready(c.overview, (o) => {
      switch (dv) {
        case "DV-SMT-O-NOW":
          return <SchoolNow o={o} school={c.school} compact={c.phone && !fullscreen} />;
        case "DV-SMT-O-SCORECARD":
          return <Scorecard o={o} school={c.school} phone={c.phone && !fullscreen} />;
        case "DV-SMT-O-MAP":
          return <SetMap o={o} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-O-FLAGS":
          return <SchoolFlags o={o} />;
        case "DV-SMT-O-ROLL-LINE":
          return <RollIndexed o={o} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-O-ROLL-TABLE":
          return <RollTable o={o} />;
        case "DV-SMT-O-RESULTS-LINE":
        case "DV-SMT-O-RESULTS-TABLE": {
          const ts = o.trends.results;
          if (!ts.length) return <Empty>{c.school.phases.igcse && !c.school.phases.post16 ? smtNote("igcseView", { school: c.school.name }) : "No published results to draw."}</Empty>;
          const t = ts[Math.min(stage, ts.length - 1)];
          return (
            <>
              {ts.length > 1 && (
                <div className="flex gap-2">
                  {ts.map((x, i) => (
                    <EntryChip key={x.stage} label={x.stage === "ks4" ? "Attainment 8" : "A-level points"} active={i === Math.min(stage, ts.length - 1)} onClick={() => setStage(i)} />
                  ))}
                </div>
              )}
              {dv.endsWith("TABLE") ? (
                <BandTable title={`${t.label} against ${o.set.label}`} school={t.school} band={t.band} unit="points" setLabel={o.set.label} valueKey={t.stage === "ks5" ? "A level::aps_per_entry" : undefined} />
              ) : (
                <ResultsBand schoolName={c.school.name.replace(/ School$/, "")} trend={t} setLabel={o.set.label} fullscreen={fullscreen} room={room} title={`${t.stage === "ks4" ? "GCSE" : "Post-16"} results against ${o.set.label}`} />
              )}
            </>
          );
        }
        case "DV-SMT-O-MARKET-LINE":
          return <MarketLine o={o} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-O-MARKET-TABLE":
          return <MarketTable o={o} />;
      }
      return <Empty>This view isn&rsquo;t drawn here yet.</Empty>;
    });
  }
  if (dv.startsWith("DV-SMT-P-")) {
    return ready(c.pupils, (p) => {
      switch (dv) {
        case "DV-SMT-P-NOW":
          return <PupilsNow p={p} school={c.school} compact={c.phone && !fullscreen} />;
        case "DV-SMT-P-SHAPE":
          return <ShapeAndSize p={p} height={fullscreen && room ? Math.max(220, room - 160) : 190} />;
        case "DV-SMT-P-ENTRIES":
          return <EntryPoints p={p} />;
        case "DV-SMT-P-LEAVING":
          return <LeavingAt16 p={p} school={c.school} />;
        case "DV-SMT-P-MARKET":
          return <MarketLine market={p.market} schoolName={c.school.name} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-P-PHASES":
          return <IndexedLines title="Roll by phase, indexed" lines={p.trends.phases} fullscreen={fullscreen} room={room} caption={smtNote("rollByPhase", { base: periodLabel(p.trends.base ?? CENSUS_FIRST_PERIOD) })} />;
        case "DV-SMT-P-PHASES-TABLE":
          return <RollTable o={{ trends: { roll: { lines: p.trends.phases, base: p.trends.base, laName: c.school.laName } } } as never} />;
        case "DV-SMT-P-POOL":
          return <PoolLine pool={p.trends.pool} fullscreen={fullscreen} room={room} caption={SMT_NOTES.pool} />;
        case "DV-SMT-P-AREA":
          return <PlainLine title="The area's school-age population" label={`${c.school.laName ?? "The LA"}, residents aged ${p.trends.area.agesWord}`} pts={p.trends.area.pts} fullscreen={fullscreen} room={room} caption={SMT_NOTES.areaResidentsCaption} xLabel={(y) => `mid-${y}`} />;
      }
      return <Empty>This view isn&rsquo;t drawn here yet.</Empty>;
    });
  }
  if (dv.startsWith("DV-SMT-C-")) {
    return ready(c.context, (x) => {
      switch (dv) {
        case "DV-SMT-C-NOW":
          return <ContextNow c={x} compact={c.phone && !fullscreen} />;
        case "DV-SMT-C-MAP":
          return <AreaMap c={x} map={c.contextMap} shade={c.shade} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-C-NEARBY":
          return <NearbyOverTime c={x} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-C-BYAGE":
          return <AgeBars c={x} ages={x.ages} height={fullscreen && room ? Math.max(220, room - 120) : 260} />;
        case "DV-SMT-C-BIRTHS":
          return <BirthsAndProjections c={x} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-C-BIRTHS-INDEXED":
          return <BirthsIndexed c={x} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-C-BIRTHS-TABLE":
          return <BirthsTable c={x} />;
        case "DV-SMT-C-PROJECTION":
          return <PopulationProjected c={x} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-C-AGES":
          return <AgeBars c={x} ages={x.ages} height={fullscreen && room ? Math.max(200, room - 120) : 130} title="Children by single year of age" />;
      }
      return <Empty>This view isn&rsquo;t drawn here yet.</Empty>;
    });
  }
  const whyNot = academicWhyNot(dv, c);
  if (whyNot) return <Empty>{whyNot}</Empty>;
  return ready(c.academic, (a) => {
    const filtered = c.filters.sex !== "all" || c.filters.boarding !== "all";
    const note = filtered ? <div className="text-[11px] text-[var(--muted2)]">Results aren&rsquo;t published for girls and boys or for day and boarding pupils: these are the whole cohort&rsquo;s.</div> : null;
    switch (dv) {
      case "DV-SMT-A-NOW":
        return (
          <>
            <AcademicNow a={a} school={c.school} />
            {note}
          </>
        );
      case "DV-SMT-A-AREAS":
        return <SubjectAreas parts={a.parts} setLabel={a.set.label} area={a.level.area} onArea={c.onArea} />;
      case "DV-SMT-A-SUBJECTS":
        return <Subjects parts={a.parts} setUrns={c.set.urns} setLabel={a.set.label} phase={a.level.phase} />;
      case "DV-SMT-A-VA":
        return <ValueAdded a={a} school={c.school} />;
      case "DV-SMT-A-GRADES":
        return <GradeProfile parts={a.parts} />;
      case "DV-SMT-A-TREND-LINE":
      case "DV-SMT-A-TREND-TABLE": {
        // A phase with nothing to draw (an IGCSE school's GCSE) isn't offered here; it says why in column 1.
        const parts = a.parts.filter((x) => x.trend.school.some((pt) => pt.value !== null));
        const p = parts[Math.min(stage, parts.length - 1)];
        if (!p || !p.trend.school.length) return <Empty>No published results to draw at this level.</Empty>;
        const unit = a.level.area && p.stage === "ks4" ? "grade" : "points";
        const label = `${a.areaLabel ?? (p.stage === "ks4" ? "GCSE" : "Post-16")} results against ${a.set.label}`;
        return (
          <>
            {parts.length > 1 && (
              <div className="flex gap-2">
                {parts.map((x, i) => (
                  <EntryChip key={x.stage} label={x.stage === "ks4" ? "GCSE" : "Post-16"} active={i === Math.min(stage, parts.length - 1)} onClick={() => setStage(i)} />
                ))}
              </div>
            )}
            {dv.endsWith("TABLE") ? <BandTable title={label} school={p.trend.school} band={p.trend.band} unit={unit} setLabel={a.set.label} valueKey={!a.level.area && p.stage === "ks5" ? "A level::aps_per_entry" : undefined} /> : <ResultsBand schoolName={c.school.name.replace(/ School$/, "")} trend={p.trend} setLabel={a.set.label} fullscreen={fullscreen} room={room} title={label} />}
            {note}
          </>
        );
      }
      case "DV-SMT-A-BANDS":
        return <ReservedPanel title="Top 25%, middle 50%, bottom 25%" />;
      case "DV-SMT-A-MIX":
      case "DV-SMT-A-MIX-TABLE": {
        const parts = a.parts.filter((x) => x.mix.years.length > 0);
        const p = parts[Math.min(stage, parts.length - 1)];
        if (!p) return <Empty>{a.igcse && a.level.phase === "gcse" ? smtNote("igcseView", { school: c.school.name }) : "No entries at this level."}</Empty>;
        return (
          <>
            {parts.length > 1 && (
              <div className="flex gap-2">
                {parts.map((x, i) => (
                  <EntryChip key={x.stage} label={x.stage === "ks4" ? "GCSE" : "Post-16"} active={i === Math.min(stage, parts.length - 1)} onClick={() => setStage(i)} />
                ))}
              </div>
            )}
            {dv.endsWith("TABLE") ? <MixTable part={p} /> : <EntriesMix part={p} height={fullscreen && room ? Math.max(200, room - 120) : 170} />}
          </>
        );
      }
    }
    return <Empty>This view isn&rsquo;t drawn here yet.</Empty>;
  });
}

/** A view that can't show the level in focus says so in its own space (B2), never disappears. */
function academicWhyNot(dv: string, c: Ctx): string | null {
  const p = c.level.phase;
  if (p === "primary") {
    if (dv === "DV-SMT-A-VA") return SMT_NOTES.vaNotKs2;
    if (dv === "DV-SMT-A-AREAS" || dv === "DV-SMT-A-SUBJECTS" || dv === "DV-SMT-A-GRADES" || dv.startsWith("DV-SMT-A-MIX")) return "KS2 results have no subject areas or subjects: these views are for GCSE and Post-16.";
    if (dv.startsWith("DV-SMT-A-TREND")) return "KS2's results trend arrives with SMT round 2.";
  }
  if (p === "gcse" && c.school.phases.igcse && dv !== "DV-SMT-A-NOW" && dv !== "DV-SMT-A-BANDS") return smtNote("igcseView", { school: c.school.name });
  return null;
}

// ------------------------------------------------------------------------------- phone

// Phone (Phone.dc.html): column 1, then the large view with its views as tabs, then row 2's panels
// as tabs of one panel -- each the same RailPanel as on the desktop, sized to its content.
function PhoneBody({ config, c }: { config: DashboardConfig; c: Ctx }) {
  const now = config.panels.find((p) => p.row === "now" && p.column === "c1");
  const large = config.panels.find((p) => p.row === "now" && (p.span?.cols ?? 1) >= 2);
  const trends = config.panels.filter((p) => p.row === "trends");
  const [largeTab, setLargeTab] = useState(large?.defaultView ?? "");
  const [trendTab, setTrendTab] = useState(trends[0]?.id ?? "");
  const largeDv = large ? dvOf(large, largeTab) || dvOf(large, large.defaultView ?? "") : "";
  const trendPanel = trends.find((t) => t.id === trendTab) ?? trends[0];
  const trendDv = trendPanel ? dvOf(trendPanel, trendPanel.defaultView ?? "") : "";
  const nowDv = now ? dvOf(now, now.defaultView ?? "") : "";
  const TABS: Record<SmtDash, Record<string, string>> = { overview: { c1: "Roll", c2: "Results", c3: "Market share" }, academic: { c1: "Results", c2: "By band", c3: "Entries" }, pupils: { c1: "Roll", c2: "Pool", c3: "Area" }, context: { c1: "Births", c2: "Projection", c3: "By age" } };
  const tabLabel = (t: PanelConfig) => TABS[c.dash][t.column] ?? t.name ?? t.column;
  const title = c.dash === "overview" || c.dash === "pupils" ? `${c.school.name.replace(/ School$/, "")} now · ${yearOf(c.school.census.at(-1)?.period ?? null)}` : c.dash === "context" ? "The area now" : levelLabel(c.level, areaLabelOf(c));
  return (
    <>
      {now && (
        <RailPanel tag={title} title={title} height="auto" source={sourceOf(nowDv, c)} caption={captionOf(nowDv, c)} focusBar={c.focusBar}>
          {({ fullscreen }) => <ViewBody dv={nowDv} c={c} fullscreen={fullscreen} />}
        </RailPanel>
      )}
      {large && (
        <RailPanel tag={dataviewById(largeDv)?.label ?? ""} title={dataviewById(largeDv)?.label ?? ""} height="auto" source={sourceOf(largeDv, c)} caption={captionOf(largeDv, c)} chips={chipsOf(largeDv, c)} controls={<Tabs items={railOf(large)} active={largeTab || large.defaultView || ""} onPick={setLargeTab} />} focusBar={c.focusBar}>
          {({ fullscreen, height }) => (
            <div className="flex min-h-[200px] flex-col gap-2">
              <ViewBody dv={largeDv} c={c} fullscreen={fullscreen} room={height} />
            </div>
          )}
        </RailPanel>
      )}
      {trendPanel && (
        <RailPanel tag={tabLabel(trendPanel)} title={tabLabel(trendPanel)} height="auto" source={sourceOf(trendDv, c)} caption={captionOf(trendDv, c)} controls={<Tabs items={trends.map((t) => ({ id: t.id, label: tabLabel(t), icon: "" }))} active={trendTab} onPick={setTrendTab} />} focusBar={c.focusBar} flag={flagOf(trendDv, c)}>
          {({ fullscreen, height }) => (
            <div className="flex min-h-[160px] flex-col gap-2">
              <ViewBody dv={trendDv} c={c} fullscreen={fullscreen} room={height} />
            </div>
          )}
        </RailPanel>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------- one view
// One SMT view, drawn alone from the same routes -- for a meeting slide (Copy this view…) and the
// editor's live preview. The level and the set come from the slide's pin (params), else the member's
// remembered set and Whole school. The viewer's own access is checked by the routes, as on the page.
export function SmtViewPreview({ dataview, urn, schoolName, params, height }: { dataview: string; urn: string; schoolName: string; params?: Record<string, unknown>; height: number }) {
  const [theme] = useTeacherTheme();
  const school = useSmt<SmtSchool>(`/api/smt/school?urn=${urn}`, null);
  const s = school.status === "ready" ? school.data : null;
  const pinnedSet = params?.set as SmtSetChoice | undefined;
  const sets = useSmtSet(pinnedSet ? null : urn, s ? setPhaseOf(s.phases) : null);
  const set = pinnedSet && Array.isArray(pinnedSet.urns) ? pinnedSet : sets.set;
  const level: SmtLevel = s ? parseLevel(new URLSearchParams(levelQuery({ phase: (params?.level as SmtPhase) ?? "whole", area: (params?.area as string) ?? null })), s.phases, { gcse: s.areas.gcse.map((a) => a.id), post16: s.areas.post16.map((a) => a.id) }) : { phase: "whole", area: null };
  const dash: SmtDash = dataview.startsWith("DV-SMT-O-") ? "overview" : dataview.startsWith("DV-SMT-P-") ? "pupils" : dataview.startsWith("DV-SMT-C-") ? "context" : "academic";
  const body = set ? { urn, set } : null;
  const overview = useSmt<Overview>(s && body && dash === "overview" ? "/api/smt/overview" : null, body ? { ...body, filters: { sex: "all", boarding: "all" } } : null);
  const academic = useSmt<Academic>(s && body && dash === "academic" ? "/api/smt/academic" : null, body ? { ...body, level: level.phase, area: level.area } : null);
  const pupils = useSmt<Pupils>(s && body && dash === "pupils" ? "/api/smt/pupils" : null, body ? { ...body, level: level.phase, filters: { sex: "all", boarding: "all" } } : null);
  const near = params?.near === "la" ? "la" : "around";
  const context = useSmt<Context>(s && dash === "context" ? `/api/smt/context?urn=${urn}&area=${near}&level=${level.phase}` : null, null);
  const contextMap = useSmt<ContextMap>(s && dash === "context" && near === "around" && dataview === "DV-SMT-C-MAP" ? `/api/smt/context/map?urn=${urn}&level=${level.phase}` : null, null);
  const shade: ShadeBy = (["children", "imd", "idaci", "fsm"] as const).find((k) => k === params?.shade) ?? "children";
  const member = { userId: "", token: "", membershipId: null, schoolAccountId: "", schoolUrn: urn, schoolName, roles: [], isAdmin: false, isAccountHolder: false, access: "member", readOnly: true, viewAs: null } as SmtMember;
  return (
    <div data-smt-preview={dataview} className="flex min-h-0 flex-col gap-2 overflow-hidden text-[var(--fg)]" style={{ ...smtVars(theme), height }}>
      {s && set ? <ViewBody dv={dataview} c={{ member, school: s, dash, level, set, filters: { sex: "all", boarding: "all" }, overview, academic, pupils, context, contextMap, shade, onShade: () => undefined, onArea: () => undefined, focusBar: null, phone: false }} fullscreen={false} /> : school.status === "error" ? <Empty>{school.message}</Empty> : <Skeleton />}
    </div>
  );
}
