"use client";

// VicData 0.8 SMT round 1 (B1-B5): the SMT dashboards -- Overview and Academic -- drawn entirely from
// the shared shell (src/components/shell): Teacher's nav, ControlBar (the "S" badge, the switch, the
// level chips in the subject chips' slot, the set selector -- no girls/boys or day/boarding pills since
// 0.8 SMT Academic, R-SMT-NO-PILLS), the rows, RailPanel (CardBox: the icon row,
// the notes, full screen as a focus mode), the phone's tabs, the footer's Edit (View as from the account menu, 0.8) and Copy
// this view…. Every view is a catalogue entry (src/catalogue/smt.ts) plus a component (./views).
//
// Wireframes: docs/wireframes/smt (Main, Academic, LeightonLight, Phone).
import { useEditorReturnReload } from "@/lib/sets/editor-return";
import { indexBaseWords, indexedLabel } from "@/lib/index-base";
import { signedDelta } from "@/lib/signed-delta";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme, type Theme } from "@/components/shell/TeacherChrome";
import { ControlBar, type FocusSubject } from "@/components/shell/ControlBar";
import { GroupSwitcher } from "@/components/shell/GroupSwitcher";
import { MenuChip } from "@/components/shell/FilterPills";
import { RailPanel, Tabs, type RailItem } from "@/components/shell/RailPanel";
import { PhoneStack, ShellPage, ShellRow } from "@/components/shell/Rows";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { HeadOfficeBanner } from "@/components/groups/HeadOfficeBanner";
import { ViewAsWrongRole } from "@/components/view-as/ViewAs";
import { AdmissionsTeacherNav, Divider } from "@/components/admissions/controls";
import { Empty, EntryChip, FChip, Skeleton } from "@/components/admissions/ui";
import { useWidth } from "@/components/admissions/views/charts";
import { CopyViewDialog } from "@/components/copy-view/CopyViewDialog";
import type { ChooserChoice } from "@/components/teacher/ComparatorSetChooser";
import { dataviewById } from "@/catalogue/dataviews";
import { contextFromPanel } from "@/catalogue/pick";
import { SMT_DASHBOARDS, SMT_ACADEMIC_ID, SMT_CONTEXT_ID, SMT_OVERVIEW_ID, SMT_PUPILS_ID } from "@/catalogue/dashboards/smt";
import { ADMISSIONS_NOTES, SMT_NOTES, TREND_BASE_NOTE, smtNote } from "@/catalogue/notes";
import { CENSUS_FIRST_PERIOD, HISTORIC_GRADE_FROM, periodLabel, setLatestYears } from "@/catalogue/years";
import type { DashboardConfig, DataviewInstance, PanelConfig } from "@/catalogue/types";
import { loadDraftVicData, loadPublishedVicData } from "@/lib/published-vicdata";
import { ViewSurfaceProvider } from "@/components/feedback/ViewSurface";
import { schoolSurface } from "@/components/feedback/surface";
import { editorWritesSettled, useEditSwitch, isPlatformAdminCached, setEditOn, useInPlaceEdit } from "@/lib/edit-mode";
import { ALL_AREAS_LABEL, LEVEL_LABEL, levelChips, levelLabel, levelQuery, parseLevel, setPhaseOf, type SmtLevel, type SmtPhase } from "@/lib/smt/levels";
import { SMT_ONLY_MESSAGE } from "@/lib/smt/auth-rules";
import { UsageScopeContext, useUsagePageView, type UsageScope } from "@/lib/usage-client";
import { useSmt, type Academic, type Load, type Overview, type SmtSchool, type SmtSetChoice } from "./api";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context, ContextArea } from "@/lib/smt/context";
import type { ContextMap } from "@/lib/smt/context-map";
import { AreaPill, type CatchmentInfo } from "./Catchment";
import { MethodNote } from "@/components/shell/MethodNote";
import { freshToken } from "@/components/admissions/member";
import { loadSmtMember, type SmtMember, type SmtMemberState } from "./member";
import { DEFAULT_SET_LABEL, useSmtSet } from "./useSmtSet";
import { SetSelector, setHeaderWords } from "@/components/sets/SetSelector";
import { NEAREST_KEY, rankingKey, takeUseSet, teacherEditorHref, teacherMenuRows } from "@/components/sets/teacherMenu";
import { arrowOf, dirClass, smtVars, yearOf } from "./ui";
import { SchoolNow } from "./views/Now";
import { smtHasContent } from "./content";
import { activeWithContent, visibleRail } from "@/lib/rail-content";
import { Scorecard } from "./views/Scorecard";
import { SetMap } from "./views/SetMap";
import { SchoolFlags } from "./views/Flags";
import { Direction, IndexedLines, MarketLine, PlainLine, PoolLine, ResultsBand, RollDirectionWord, RollIndexed } from "./views/Lines";
import { BandTable, MarketTable, RollTable } from "./views/Tables";
import { AcademicMap, AcademicNow, Against, AppliedSwitch, AreasView, EveryLine, GradesView, MixBars, MixTableView, Moves, RankChart, RankTable, TrendBand, TrendTable, acVars } from "./views/Academic";
import { useAcademicAsk, type AcademicAsk } from "./useAcademicState";
import { ACADEMIC_PHASE_LABEL, GROUP_LABEL, MODES, MODE_LABEL, groupChips, type AcademicMode, type AppliedType, type QualGroup } from "@/lib/smt/qual-groups";
import { DayAndBoarding, EntryPoints, GirlsAndBoys, LeavingAt16, PupilsNow, ShapeAndSize } from "./views/Pupils";
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
      <main id={editing ? undefined : "teacher-root"} hidden={editing} data-theme={theme} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={dash === "academic" ? { ...smtVars(theme), ...acVars(theme) } : smtVars(theme)}>
        {state.status === "ready" && state.member.access !== "none" ? (
          <Dashboard member={state.member} dash={dash} theme={theme} onTheme={setTheme} reloadTick={inPlace.reloadTick} />
        ) : (
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-7 py-5">
            {/* 0.8 View as: the wrong-role message keeps the banner's Change and Back to me (nothing for anyone else). */}
            <ViewAsBanner className="" />
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
              ) : state.status === "ready" && state.member.viewAs ? (
                // 0.8 View as: a platform admin viewing the school as a role SMT isn't for.
                <ViewAsWrongRole viewAs={state.member.viewAs} forWhom="SMT dashboards are for SMT and the School-Admin." to={{ role: "smt", label: "SMT" }} />
              ) : platformAdmin ? (
                // 0.8 View as: it starts from the account menu (no button here any more).
                <>To see a school&rsquo;s SMT dashboards, use View as in your account menu.</>
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
  // 0.8 SMT Academic by qualification: what the page asks for, and a change to it.
  ask: AcademicAsk;
  onAsk: (patch: Partial<AcademicAsk>) => void;
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
  // 0.8 sets round 1 (D20): back from the set editor's Save, use the set it saved (re-reading the sets).
  useEditorReturnReload();
  useEffect(() => {
    const id = takeUseSet();
    if (!id) return;
    void sets.reloadSaved().then(() => sets.choose({ kind: "saved", id }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [chooser, setChooser] = useState<{ editing: NonNullable<typeof sets.savedSets>["sets"][number] | null } | null>(null);

  // The published configs (the store's, else the code copy), re-read after editing.
  const previewDraft = useEditSwitch(useMemo(() => createBrowserSupabaseClient(), [])).previewDraft;
  const [configs, setConfigs] = useState<Record<SmtDash, DashboardConfig>>({ overview: SMT_DASHBOARDS[0], academic: SMT_DASHBOARDS[1], pupils: SMT_DASHBOARDS[2], context: SMT_DASHBOARDS[3] });
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      if (reloadTick > 0) await editorWritesSettled();
      // 0.8 View as: the banner's "Preview draft" draws the editor's draft here too, as on Teacher.
      const load = previewDraft ? loadDraftVicData : loadPublishedVicData;
      const [o, a, p, c] = await Promise.all(SMT_DASHBOARDS.map((d) => load(supabase, d.id, d)));
      setConfigs({ overview: o.config, academic: a.config, pupils: p.config, context: c.config });
    })();
  }, [reloadTick, previewDraft]);

  const set = sets.set;
  const body = set ? { urn: member.schoolUrn, set } : null;
  const overview = useSmt<Overview>(s && body && dash === "overview" ? "/api/smt/overview" : null, body);
  const [ask, setAsk] = useAcademicAsk(member.schoolUrn);
  const academic = useSmt<Academic>(s && body && dash === "academic" ? "/api/smt/academic" : null, body ? { ...body, level: ask.level ?? level.phase, mode: ask.mode, group: ask.group, applied: ask.applied, area: ask.area } : null);
  // The last answer, so the chips stay while the next state loads.
  const [lastAcademic, setLastAcademic] = useState<Academic | null>(null);
  if (academic.status === "ready" && academic.data !== lastAcademic) setLastAcademic(academic.data);
  const pupils = useSmt<Pupils>(s && body && dash === "pupils" ? "/api/smt/pupils" : null, body ? { ...body, level: level.phase } : null);
  // Context: the area pill (around the school, or the LA), held in the address (?area=la).
  const [area, setArea] = useState<ContextArea>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("near") === "la" ? "la" : "around"));
  // 0.8 SMT r4 (R): this view's own radius (?km=), else the school's usual catchment, else the default
  // (the routes resolve it, within the school's cap). `catchTick` re-reads both after a save.
  const [viewKm, setViewKm] = useState<number | null>(() => {
    const k = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("km") : null;
    return k && /^\d{1,2}$/.test(k) ? Number(k) : null;
  });
  const [catchTick, setCatchTick] = useState(0);
  const kmQ = `${viewKm !== null ? `&km=${viewKm}` : ""}&c=${catchTick}`;
  const catchInfo = useSmt<CatchmentInfo>(s && dash === "context" ? `/api/smt/catchment?urn=${member.schoolUrn}&c=${catchTick}` : null, null);
  // 0.8 SMT r3: the level picks the ages; the map's neighbourhoods are read only around the school.
  const context = useSmt<Context>(s && dash === "context" ? `/api/smt/context?urn=${member.schoolUrn}&area=${area}&level=${level.phase}${kmQ}` : null, null);
  const contextMap = useSmt<ContextMap>(s && dash === "context" && area === "around" ? `/api/smt/context/map?urn=${member.schoolUrn}&level=${level.phase}${kmQ}` : null, null);
  const [shade, setShade] = useState<ShadeBy>("children");

  // B7: a page view, once per school, dashboard, level and set kind.
  const acUsage = dash === "academic" && academic.status === "ready" ? `${academic.data.state.phase}/${academic.data.state.mode}/${academic.data.state.phase === "post16" ? academic.data.state.group : (academic.data.state.area ?? "all")}` : null;
  const usage: UsageScope | null = useMemo(() => (s ? { product: "smt", urn: member.schoolUrn, dashboard: DASH_ID[dash], level: acUsage ?? (level.area ? `${level.phase}/${level.area}` : level.phase), setKind: set?.kind ?? null, resolved: !!set } : null), [s, member.schoolUrn, dash, level.phase, level.area, set, acUsage]);
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

  // 0.8 SMT Academic: GCSE and Post-16 only (no Whole school); the other dashboards keep their chips.
  const ac = academic.status === "ready" ? academic.data : lastAcademic;
  const chips: FocusSubject[] = s
    ? levelChips(s.phases)
        .filter((p) => dash !== "academic" || p === "gcse" || p === "post16")
        .map((p) => ({ key: p, label: LEVEL_LABEL[p], ...(p === "gcse" && s.phases.igcse ? { marked: { reason: SMT_NOTES.igcseChip } } : {}) }))
    : [];
  const levelNow: string = dash === "academic" ? (ac?.state.phase ?? (ask.level === "gcse" || ask.level === "post16" ? ask.level : level.phase)) : level.phase;
  // 0.8 IGCSE subjects: an IGCSE school's GCSE areas are offered too (an incomplete one under its short label).
  const areas = s && (level.phase === "gcse" || level.phase === "post16") ? s.areas[level.phase] : [];
  void areas;
  const modeNow: AcademicMode = ac?.state.mode ?? ask.mode;
  const modeSwitch = (
    <span role="group" aria-label="Results, entries or value added" className="inline-flex gap-[2px] rounded-[8px] border border-[var(--panel-border2)] bg-[var(--bg)] p-[2px]" data-ac-modes="">
      {MODES.map((m) => (
        <button key={m} type="button" aria-pressed={m === modeNow} onClick={() => setAsk({ mode: m })} className={`rounded-full border px-2.5 py-[3px] text-xs font-semibold ${m === modeNow ? "border-[var(--accent)] bg-[rgba(var(--accent-rgb),0.12)] text-[var(--fg)]" : "border-transparent text-[var(--muted2)] hover:text-[var(--fg)]"}`}>
          {MODE_LABEL[m]}
        </button>
      ))}
    </span>
  );
  const gcseAreas = s ? s.areas.gcse : [];
  const subRow =
    dash !== "academic"
      ? undefined
      : levelNow === "post16"
        ? { label: "Qualification", chipsLabel: "Qualification", lead: modeSwitch, chips: (ac ? groupChips(ac.offer.groups) : []).map((g) => ({ key: g, label: GROUP_LABEL[g] })), focusKey: ac?.state.group ?? ask.group ?? "", onFocus: (k: string) => setAsk({ group: k as QualGroup }) }
        : modeNow === "va"
          ? { label: "Subject area", lead: modeSwitch, chips: [], focusKey: "", onFocus: () => undefined, note: SMT_NOTES.acNoGcseVaSubjects }
          : { label: "Subject area", lead: modeSwitch, chips: gcseAreas.length ? [{ key: "", label: ALL_AREAS_LABEL }, ...gcseAreas.map((a) => ({ key: a.id, label: a.label }))] : [], focusKey: ac?.state.area ?? ask.area ?? "", onFocus: (k: string) => setAsk({ area: k || null }) };
  const onLevel = (k: string) => {
    if (dash === "academic") setAsk({ level: k, area: null });
    setLevel({ phase: k as SmtPhase, area: null });
  };
  const focusBar = chips.length > 1 ? (
    <span role="group" aria-label="Level" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <EntryChip key={c.key} label={c.label} active={c.key === levelNow} onClick={() => onLevel(c.key)} />
      ))}
    </span>
  ) : undefined;

  // 0.8 sets round 1 (B6, B7, R-SET-PILL): the one set selector -- Default, School sets, My sets --
  // from Teacher's chooser payload (src/components/sets/teacherMenu.ts). Picking a row changes the set
  // in place; Edit this set… and New set… open Teacher's chooser (the builder, until the set editor);
  // its other default sets (the LA, the rankings) are built there.
  const savedId = sets.choice.kind === "saved" ? sets.choice.id : null;
  const savedNow = savedId ? (sets.savedSets?.sets.find((x) => x.id === savedId) ?? null) : null;
  const menu = teacherMenuRows(sets.savedSets, { nearestLabel: DEFAULT_SET_LABEL, nearestCount: sets.choice.kind === "nearest" && set ? set.urns.length : 10 });
  const selectedKey = sets.choice.kind === "nearest" ? NEAREST_KEY : sets.choice.kind === "saved" ? `saved:${sets.choice.id}` : sets.choice.kind === "ranking" && sets.choice.rankingId ? rankingKey(sets.choice.rankingId) : null;
  // C17, D20: Edit this set… and New set… open the set editor (a copy where the set isn't yours to change).
  const editHref = member.viewAs ? null : teacherEditorHref({ urn: member.schoolUrn, phase, product: "smt", current: set ? { savedId: savedNow?.id ?? null, name: set.label, urns: set.urns } : null, fresh: false });
  const newHref = member.viewAs ? null : teacherEditorHref({ urn: member.schoolUrn, phase, product: "smt", current: null, fresh: true });
  const setPill = (
    <SetSelector
      label="Compared against"
      kind="compared_against"
      current={dash === "academic" && ac && sets.choice.kind === "nearest" ? { name: ac.set.pill, count: ac.set.size } : set ? { name: set.label, count: set.urns.length } : null}
      loading={!set}
      rows={menu.rows}
      mine={menu.mine}
      selectedKey={selectedKey}
      onPick={(r) => {
        if (r.key === NEAREST_KEY) sets.choose({ kind: "nearest" });
        else if (r.key.startsWith("saved:")) sets.choose({ kind: "saved", id: r.key.slice(6) });
        else if (r.key.startsWith("ranking:")) {
          const rk = sets.savedSets?.rankings?.find((x) => rankingKey(x.id) === r.key);
          if (rk) sets.choose({ kind: "ranking", label: rk.name, filters: rk.filters, rankingId: rk.id });
        }
      }}
      onEdit={editHref ? { label: "Edit this set…", onClick: () => (window.location.href = editHref), title: savedNow?.editable ? undefined : "Opens a copy to save as your own" } : null}
      onNew={newHref ? { label: "New set…", onClick: () => (window.location.href = newHref) } : { label: "New set…", onClick: () => setChooser({ editing: null }) }}
      extraDefault={[{ label: "Schools in the LA, regional and national rankings…", onClick: () => setChooser({ editing: null }) }]}
      manageHref="/sets?kind=compared_against"
      manageUrn={member.schoolUrn}
      phone={phone}
    />
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
  const setKm = (km: number | null) => {
    setViewKm(km);
    const sp = new URLSearchParams(window.location.search);
    if (km === null) sp.delete("km");
    else sp.set("km", String(km));
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  };
  const saveKm = async (km: number | null): Promise<string | null> => {
    const token = await freshToken();
    if (!token) return "Sign in again.";
    const res = await fetch(`/api/smt/catchment?urn=${member.schoolUrn}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ km }) });
    if (!res.ok) return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not save.";
    setKm(null);
    setCatchTick((t) => t + 1);
    return null;
  };
  const areaPill = (
    <AreaPill
        area={area}
        laName={s?.laName ?? null}
        catchment={context.status === "ready" ? context.data.catchment : null}
        info={catchInfo.status === "ready" ? catchInfo.data : null}
        independent={!!s?.independent}
        onArea={setArea2}
        onKm={setKm}
        onSave={saveKm}
    />
  );
  const contextPills = (
    <>
      <Divider />
      {areaPill}
      <FChip title="Context compares the area with England">Compared against: England</FChip>
    </>
  );
  const pills = dash === "context" ? contextPills : (
    <>
      <Divider />
      {setPill}
    </>
  );

  const config = configs[dash];
  const ctx: Ctx | null = s && set ? { member, school: s, dash, level, set, overview, academic, pupils, context, contextMap, shade, onShade: setShade, onArea: (st, id) => setLevel({ phase: st === "ks4" ? "gcse" : "post16", area: id }), focusBar, phone, ask, onAsk: setAsk } : null;
  const switcher = <GroupSwitcher dashboards={DASHES.map((d) => configs[d])} activeId={config.id} onSwitch={(d) => go(DASHES.find((x) => configs[x].id === d.id) ?? "overview")} />;

  // 0.8 notes and feedback: each view's private note and feedback icon, with what the page is showing.
  const surface = schoolSurface({
    product: "smt",
    dashboard: { id: config.id, name: config.name },
    urn: member.schoolUrn,
    name: member.schoolName,
    role: member.headOffice ? "head_office" : "smt",
    state: { level: dash === "academic" ? levelNow : level.phase, area: dash === "academic" ? (ac?.state.area ?? null) : (level.area ?? null), ...(dash === "academic" ? { mode: modeNow, group: ac?.state.phase === "post16" ? ac.state.group : null, applied: ac?.state.group === "applied" ? ac.state.applied : null } : {}), set: set?.label ?? null, setKind: set?.kind ?? null, ...(dash === "context" ? { near: area, km: viewKm ?? null } : {}) },
  });

  return (
    <UsageScopeContext.Provider value={quiet ? null : usage}>
      <ViewSurfaceProvider surface={surface} config={config}>
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
                <EntryChip key={c.key} label={c.label} active={c.key === levelNow} onClick={() => onLevel(c.key)} />
              ))}
            </div>
            {dash === "academic" && subRow && (
              <div className="flex flex-col gap-[6px]">
                <div>{subRow.lead}</div>
                {subRow.chips.length > 0 ? (
                  <div className="flex flex-wrap gap-[6px]">
                    {subRow.chips.map((c) => (
                      <EntryChip key={c.key} label={c.label} active={c.key === subRow.focusKey} onClick={() => subRow.onFocus(c.key)} />
                    ))}
                  </div>
                ) : subRow.note ? (
                  <span className="text-[11.5px] text-[var(--muted2)]">{subRow.note}</span>
                ) : null}
              </div>
            )}
            {/* 0.8 SMT r4 (R1): the radius on the phone too, on Context only (the other pills stay desktop). */}
            {dash === "context" && <div className="flex flex-wrap gap-[6px]">{areaPill}</div>}
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
              focusKey={levelNow}
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
      </ViewSurfaceProvider>
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
    // 0.8 SMT feedback round 2: the trends compare with the selected set. Sets round 1 (B10): with its count.
    return setHeaderWords("compared_against", { name: c.set.label, count: c.set.urns.length });
  }
  if (c.dash === "pupils") {
    if (row === "now") return census !== null ? `January ${census + 1} census` : "";
    return `${periodLabel(CENSUS_FIRST_PERIOD)} to ${census !== null ? periodLabel(census) : ""}`;
  }
  if (c.dash === "context") {
    const to = c.context.status === "ready" ? (c.context.data.forward?.horizonEnd ?? null) : null;
    if (row === "now") return `ONS mid-year estimates and births${to !== null ? `, projected to ${to}` : ""}`;
    return "indexed to 100, against England";
  }
  // 0.8 SMT Academic: "Post-16 · A level · 2024/25", "A level, 2023/24 to 2024/25".
  if (c.academic.status !== "ready") return "";
  const a = c.academic.data;
  const what = academicWhat(a);
  if (row === "now") return [ACADEMIC_PHASE_LABEL[a.state.phase], what, a.state.mode === "entries" ? "entries" : null, a.period !== null ? yearOf(a.period, a.state.phase === "gcse" ? "ks4" : "ks5") : null].filter(Boolean).join(" · ");
  const pts = a.trends.school.length ? a.trends.school : a.trends.band.map((b) => ({ year: b.year, value: null }));
  return `${a.state.mode === "entries" ? `${what ? `${what}, ` : ""}entries` : (what ?? ACADEMIC_PHASE_LABEL[a.state.phase])}, ${pts.length ? `${periodLabel(pts[0].year)} to ${periodLabel(pts.at(-1)!.year)}` : ""}`;
}

export function DesktopGrid({ config, c }: { config: DashboardConfig; c: Ctx }) {
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
const allRailOf = (panel: PanelConfig): RailItem[] =>
  panel.dataviews.filter((v): v is Extract<DataviewInstance, { kind: "view" }> => v.kind === "view").map((v) => ({ id: v.id, label: dataviewById(v.dataview)?.label ?? v.dataview, icon: dataviewById(v.dataview)?.railIcon ?? "TilesIcon" }));
// F-6 (R-RAIL-HIDES-EMPTY): a view with nothing to show has no rail icon.
const hasOf = (panel: PanelConfig, c: Ctx) => (id: string) => smtHasContent(dvOf(panel, id), c);
const railOf = (panel: PanelConfig, c: Ctx): RailItem[] => visibleRail(allRailOf(panel), hasOf(panel, c));

// The large view opens on Subjects when an area is chosen (the wireframe's Academic board), else on
// the panel's default.
function defaultOf(panel: PanelConfig, c: Ctx): string {
  // 0.8 SMT Academic: "All" (and a GCSE area) opens the subject-areas view; Entries opens row 2 on the
  // biggest moves; Value added row 2's third panel on the set's schools.
  if (c.dash === "academic") {
    const a = c.academic.status === "ready" ? c.academic.data : null;
    const find = (dv: string) => panel.dataviews.find((v) => v.kind === "view" && v.dataview === dv)?.id;
    const want = a
      ? panel.span && panel.span.cols >= 2
        ? (a.state.phase === "post16" && a.state.group === "all") || (a.state.phase === "gcse" && a.state.area) ? "DV-SMT-A-AREAS" : null
        : a.state.mode === "entries" ? (panel.column === "c2" ? "DV-SMT-A-MOVES" : null) : a.state.mode === "va" && panel.column === "c3" ? "DV-SMT-A-SETMOVES" : null
      : null;
    const hit = want ? find(want) : undefined;
    if (hit) return hit;
  }
  return panel.defaultView ?? panel.dataviews[0]?.id ?? "";
}

function useActive(panel: PanelConfig, c: Ctx): [string, (id: string) => void] {
  const def = defaultOf(panel, c);
  const [picked, setPicked] = useState<{ for: string; id: string } | null>(null);
  // F-6: a panel that would open on an empty view opens on the next one instead.
  const active = activeWithContent(allRailOf(panel), picked && picked.for === def ? picked.id : def, hasOf(panel, c));
  return [active, (id) => setPicked({ for: def, id })];
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
        rail={railOf(panel, c)}
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
        view={{ panelId: panel.id, panelName: panel.name ?? null, instanceId: active, dataview: dv || null }}
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
            pinned: { schoolUrn: c.member.schoolUrn, schoolName: c.member.schoolName, params: { level: c.dash === "academic" && c.academic.status === "ready" ? c.academic.data.state.phase : c.level.phase, area: c.dash === "academic" && c.academic.status === "ready" ? c.academic.data.state.area : c.level.area, ...(c.dash === "academic" && c.academic.status === "ready" ? { mode: c.academic.data.state.mode, group: c.academic.data.state.group, applied: c.academic.data.state.applied } : {}), set: { kind: c.set.kind, label: c.set.label, urns: c.set.urns }, ...(c.context.status === "ready" ? { near: c.context.data.area, ...(dv === "DV-SMT-C-MAP" ? { shade: c.shade } : {}) } : {}) }, keepLive: true },
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
  // 0.8 sets round 1 (B10, R-PANEL-NAMES-SET): every header names the set and its number of schools.
  const set = `${c.set.label} · ${c.set.urns.length}`;
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
      return { tag: "Trends", context: c.overview.status === "ready" ? indexedLabel(c.overview.data.trends.roll.base) : "indexed" };
    case "DV-SMT-O-RESULTS-LINE":
    case "DV-SMT-O-RESULTS-TABLE": {
      const latest = c.school.latest.ks4?.period ?? c.school.latest.ks5?.period;
      return { tag: "Trends", context: `${periodLabel(HISTORIC_GRADE_FROM)} to ${latest !== undefined ? periodLabel(latest) : ""}` };
    }
    case "DV-SMT-O-MARKET-LINE":
    case "DV-SMT-O-MARKET-TABLE":
      // F-7: the tag says when the rivals are Admissions' default.
      // F-9: the rivals are the selected set; the tag names it.
      return { tag: "From Admissions", context: `read-only · against ${c.set.label}` };
    case "DV-SMT-A-NOW":
      return { tag: "Current", context: c.academic.status === "ready" ? `${ACADEMIC_PHASE_LABEL[c.academic.data.state.phase]}${c.academic.data.state.mode === "entries" ? " · entries" : ""}` : "" };
    case "DV-SMT-A-CHART":
    case "DV-SMT-A-TABLE":
    case "DV-SMT-A-MAP":
      return { tag: c.academic.status === "ready" ? MODE_LABEL[c.academic.data.state.mode] : "Results", context: c.academic.status === "ready" ? c.academic.data.board.title : "" };
    case "DV-SMT-A-AREAS":
      return { tag: "Subject areas", context: c.academic.status === "ready" ? `${c.academic.data.state.phase === "post16" ? "by qualification" : (c.academic.data.areaLabel ?? "all areas")}, against ${c.academic.data.set.chosen ? set : c.academic.data.set.pill.replace(/^\d+ /, "the ")}` : `against ${set}` };
    case "DV-SMT-A-GRADES":
      return { tag: "Grade profile", context: c.academic.status === "ready" ? (academicWhat(c.academic.data) ?? ACADEMIC_PHASE_LABEL[c.academic.data.state.phase]) : "" };
    case "DV-SMT-A-TREND-LINE":
    case "DV-SMT-A-TREND-TABLE":
      return { tag: "Trends", context: c.academic.status === "ready" ? c.academic.data.trends.label : "" };
    case "DV-SMT-A-LINES":
      return { tag: "Trends", context: "every line" };
    case "DV-SMT-A-MOVES":
    case "DV-SMT-A-SETMOVES":
      return { tag: "Trends", context: dv === "DV-SMT-A-MOVES" ? "moves" : "the set's schools" };
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
      return { tag: "Trends", context: "entries mix" };
    case "DV-SMT-A-AGAINST":
      return { tag: "Trends", context: "against the set" };
    // 0.8 SMT round 2: Pupils
    case "DV-SMT-P-NOW":
      return { tag: "Current", context: c.school.census.at(-1) ? `Data ${periodLabel(c.school.census.at(-1)!.period)}` : "" };
    case "DV-SMT-P-SHAPE":
      return { tag: "Shape and size", context: `pupils by age, against the local shape and ${set}` };
    case "DV-SMT-P-GIRLS-BOYS":
      return { tag: "Girls and boys", context: `girls' share by year group, against ${set}` };
    case "DV-SMT-P-DAY-BOARDING":
      return { tag: "Day and boarding", context: `boarders' share, against ${set}'s boarding schools` };
    case "DV-SMT-P-ENTRIES":
      return { tag: "Entry points", context: "from Admissions, read-only" };
    case "DV-SMT-P-LEAVING":
      return { tag: "Leaving at 16", context: "Year 11 to Year 12" };
    case "DV-SMT-P-MARKET":
      return { tag: "Market share", context: c.pupils.status === "ready" && c.pupils.data.market.status === "ready" && c.pupils.data.market.defaultRivals ? `from Admissions, read-only · ${SMT_NOTES.marketDefaultTag}` : "from Admissions, read-only" };
    case "DV-SMT-P-PHASES":
    case "DV-SMT-P-PHASES-TABLE":
      return { tag: "Trends", context: c.pupils.status === "ready" ? indexedLabel(c.pupils.data.trends.base) : "indexed" };
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
      return { tag: "Population by age", context: c.context.status === "ready" && c.context.data.byAge.scope === "around" ? `within ${c.context.data.radius}` : (c.school.laName ?? "") };
    case "DV-SMT-C-NEARBY":
      return { tag: "Children nearby", context: "residents, indexed" };
    case "DV-SMT-C-BIRTHS":
      return { tag: "Births and projections", context: c.school.laName ?? "" };
    case "DV-SMT-C-BIRTHS-INDEXED":
      return { tag: "Trends", context: c.context.status === "ready" ? `births, ${indexedLabel(c.context.data.births.base, "calendar")}` : "births, indexed" };
    case "DV-SMT-C-BIRTHS-TABLE":
      return { tag: "Trends", context: "births, and indexed" };
    case "DV-SMT-C-PROJECTION":
      return { tag: "Forward", context: c.context.status === "ready" && c.context.data.forward ? `${c.context.data.forward.where}, to ${c.context.data.forward.horizonEnd}` : "" };
    case "DV-SMT-C-AGES":
      return { tag: "Area", context: "population by age" };
  }
  return { tag: panel.name ?? "", context: null };
}


// 0.8 SMT r4 (stage I): what the methods' {placeholders} read on SMT (src/catalogue/methods-smt.ts).
function methodVars(c: Ctx): Record<string, string | number | null> {
  const x = c.context.status === "ready" ? c.context.data : null;
  const stage = c.level.phase === "gcse" ? "ks4" : c.level.phase === "post16" ? "ks5" : c.level.phase === "primary" ? "ks2" : null;
  const latest = stage ? c.school.latest[stage]?.period : undefined;
  return {
    setLabel: c.set.label,
    la: c.school.laName,
    radius: x?.radius ?? null,
    ages: x?.agesWord ?? null,
    year: latest !== undefined ? periodLabel(latest) : null,
    census: c.school.census.at(-1) ? periodLabel(c.school.census.at(-1)!.period) : null,
    lsoaYear: x?.sources.lsoaYear ?? null,
    laYear: x?.sources.laYear ?? null,
    iodYear: x?.sources.iodYear ?? null,
    fsmYear: x?.sources.fsmYear !== null && x?.sources.fsmYear !== undefined ? periodLabel(x.sources.fsmYear) : null,
    // 0.8 Sets r1 (F24): a day school's (i) drops its boarding sentences (method-conditions.ts).
    boarding: c.school.boarding ? 1 : 0,
    // 0.8 SMT Academic: the mode's own steps only.
    ...(c.dash === "academic" && c.academic.status === "ready"
      ? { post16: c.academic.data.state.phase === "post16" ? 1 : 0, results: c.academic.data.state.mode === "results" ? 1 : 0, entries: c.academic.data.state.mode === "entries" ? 1 : 0, va: c.academic.data.state.mode === "va" ? 1 : 0, indep: c.academic.data.state.phase === "gcse" && (c.school.independent || !!c.school.phases.igcse) ? 1 : 0 }
      : {}),
  };
}

/** The source behind each panel's "i": the view's title and its measures' citations; Context's names
 * its sources and editions, the years read from the data (wording rule 6). */
function sourceOf(dv: string, c?: Ctx): ReactNode {
  const d = dataviewById(dv);
  if (!d) return null;
  if (dv.startsWith("DV-SMT-C-") && c && c.context.status === "ready") {
    // 0.8 SMT r4 (F2): the projection starts from the latest count, so the two lines always meet: round
    // 3's join note (R-SMT-CONTEXT-PROJECTION-JOIN) is retired.
    const x = c.context.data;
    const f = x.forward;
    return (
      <>
        {d.titleTemplate.replace(/\[[^\]]+\]/g, "…")}. {x.notes.sources} <span className="opacity-70">({d.measures.join(", ")})</span>
        {dv === "DV-SMT-C-PROJECTION" && f ? (
          <MethodNote projection={{ scope: f.scope, radius: x.area === "around" ? x.radius : null, laName: c.school.laName, ages: x.agesWord, lsoaCount: f.lsoaCount, mixLine: x.now.mix?.line ?? null, latestYear: f.latestYear, horizonEnd: f.horizonEnd, bandMissing: f.bandMissing, settingsVersion: f.settingsVersion, settings: f.settings, yearsUsed: f.yearsUsed, sources: f.sources }} />
        ) : (
          <MethodNote id={dv} vars={methodVars(c)} />
        )}
      </>
    );
  }
  // 0.8 SMT r4 (the (i) audit): Pupils' area line is ONS residents and the projection, not the census its
  // measure (M-SMT-SCHOOL) would cite.
  if (dv === "DV-SMT-P-AREA")
    return (
      <>
        {d.titleTemplate.replace(/\[[^\]]+\]/g, "…")}. ONS mid-year population estimates by single year of age, by local authority; the children-in-an-area projection. <span className="opacity-70">({d.measures.join(", ")})</span>
        {c && <MethodNote id={dv} vars={methodVars(c)} />}
      </>
    );
  const cites: Record<string, string> = { "M-SMT-SCHOOL": "DfE school census (January)", "M-SMT-RESULTS": "DfE KS2, KS4 and KS5 performance tables", "M-SMT-VA": "DfE performance tables (value added)", "M-SMT-SUBJECTS": "DfE KS4 and KS5 subject tables", "M-ADM-MARKET": "DfE school census, Admissions' rivals" };
  return (
    <>
      {d.titleTemplate.replace(/\[[^\]]+\]/g, "…")}. {Array.from(new Set(d.measures.map((m) => cites[m]).filter(Boolean))).join("; ")}. <span className="opacity-70">({d.measures.join(", ")})</span>
      {c && <MethodNote id={dv} vars={methodVars(c)} />}
    </>
  );
}

/** The honesty note: each view's "What this shows" line, at the top of its (i) -- SMT_NOTES only
 * (R-SMT-NOTES). 0.8 notes and feedback: where it only repeated the (i) (the source and the method),
 * it is dropped -- O-FLAGS, A-BANDS, C-PROJECTION, and the not-ready / district states of P-AREA,
 * C-MAP and C-BIRTHS (docs/v0.8/notes_feedback_report_v1.md lists each). */
function captionOf(dv: string, c: Ctx): ReactNode {
  const set = c.set.label;
  const igcse = c.school.phases.igcse ? ` ${smtNote("igcseView", { school: c.school.name })}` : "";
  // 0.8 IGCSE subjects (follow-up 1): an incomplete area chosen at GCSE carries its full sentence.
  const areaNote = c.level.phase === "gcse" && c.level.area ? c.school.areas.gcse.find((a) => a.id === c.level.area)?.igcseNote : undefined;
  const withArea = (text: string) => (areaNote ? `${text} ${areaNote}` : text);
  switch (dv) {
    case "DV-SMT-O-NOW": {
      // F-8: an independent school's entry tiles carry their arithmetic here; Progress 8's reason stays.
      const o = c.overview.status === "ready" ? c.overview.data : null;
      const census = o?.now.census !== null && o?.now.census !== undefined ? periodLabel(o.now.census) : "";
      const entry = o?.now.entry?.length
        ? ` ${o.now.entry.map((t) => smtNote(t.key === "join11" ? "join11Info" : t.key === "net11" ? "net11Info" : "net16Info", { census, now: t.now.toLocaleString("en-GB"), before: (t.before ?? 0).toLocaleString("en-GB"), leaving: signedDelta(-t.value, (x) => Math.abs(x).toLocaleString("en-GB"), { zero: "" }) })).join(" ")} ${smtNote("entrySinceInfo", { base: periodLabel(CENSUS_FIRST_PERIOD) })}`
        : "";
      // F-10: size by phase is against the selected set.
      return `${smtNote("setSize", { set })} ${o ? o.p8.text : ""}${entry}`;
    }
    case "DV-SMT-O-SCORECARD":
      // F-3, F-4: the set's full name (its column wears the short one), why the trends' years differ,
      // and, at a boarding school, who the boarders are ranked among.
      return `${smtNote("setFullName", { setLabel: set })} ${SMT_NOTES.ranks} ${c.overview.status === "ready" ? c.overview.data.notes.trendYears : ""}${c.school.boarding ? ` ${smtNote("boardersRank", { region: c.school.regionName ?? "the region" })}` : ""}${igcse}`;
    case "DV-SMT-O-FLAGS":
      // The method's steps give every clause of the rule.
      return null;
    case "DV-SMT-O-ROLL-LINE":
    case "DV-SMT-O-ROLL-TABLE":
      return c.overview.status === "ready" ? c.overview.data.notes.rollIndexed : null;
    case "DV-SMT-O-RESULTS-LINE":
    case "DV-SMT-O-RESULTS-TABLE":
      return withArea(`${smtNote("middleHalf", { setLabel: set })} ${TREND_BASE_NOTE}${igcse}`);
    case "DV-SMT-O-MARKET-LINE":
    case "DV-SMT-O-MARKET-TABLE":
      return smtNote("marketSet", { set });
    case "DV-SMT-A-NOW":
    case "DV-SMT-A-CHART":
    case "DV-SMT-A-TABLE":
    case "DV-SMT-A-MAP":
    case "DV-SMT-A-AREAS":
    case "DV-SMT-A-GRADES":
    case "DV-SMT-A-TREND-LINE":
    case "DV-SMT-A-TREND-TABLE":
    case "DV-SMT-A-LINES":
    case "DV-SMT-A-MOVES":
    case "DV-SMT-A-SETMOVES":
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
    case "DV-SMT-A-AGAINST":
      return c.academic.status === "ready" ? academicCaption(dv, c.academic.data) : null;
    case "DV-SMT-P-NOW":
    case "DV-SMT-P-SHAPE":
      return `${SMT_NOTES.size} ${SMT_NOTES.shapesAround} ${SMT_NOTES.levelAges}`;
    case "DV-SMT-P-GIRLS-BOYS": {
      // 0.8 SMT Academic (R-SMT-NO-PILLS): who the set's figure is over, and the left-out single-sex schools.
      const g = c.pupils.status === "ready" ? c.pupils.data.girlsBoys : null;
      const out = g && g.leftOut > 0 ? ` ${smtNote("girlsBoysLeftOut", { n: g.leftOut, of: c.pupils.status === "ready" ? c.pupils.data.set.size : 0, set })}` : "";
      return `${SMT_NOTES.girlsBoys}${out} ${SMT_NOTES.girlsBoysShifts} ${SMT_NOTES.levelAges}`;
    }
    case "DV-SMT-P-DAY-BOARDING": {
      const d = c.pupils.status === "ready" ? c.pupils.data.dayBoarding : null;
      return `${SMT_NOTES.dayBoarding}${d ? ` ${smtNote("dayBoardingSet", { n: d.set.boardingSchools, of: d.set.of })}` : ""}`;
    }
    case "DV-SMT-P-ENTRIES":
    case "DV-SMT-P-POOL":
      return SMT_NOTES.pool;
    case "DV-SMT-P-LEAVING": {
      // 0.8 SMT feedback round 2: the same fact as Overview's Net change at 16 (independent schools), signs opposite.
      const last = c.pupils.status === "ready" ? c.pupils.data.leaving.at(-1) : null;
      return c.school.independent && last && last.leaving !== null ? `${ADMISSIONS_NOTES.leaving16} ${smtNote("leavingVsNet", { leaving: signedDelta(last.leaving, (x) => Math.abs(x).toLocaleString("en-GB"), { zero: "" }), net: signedDelta(-last.leaving, (x) => Math.abs(x).toLocaleString("en-GB"), { zero: "" }) })}` : ADMISSIONS_NOTES.leaving16;
    }
    case "DV-SMT-P-MARKET":
      return c.pupils.status === "ready" && c.pupils.data.market.status === "ready" && c.pupils.data.market.defaultRivals ? SMT_NOTES.marketDefault : SMT_NOTES.marketShort;
    case "DV-SMT-P-PHASES":
    case "DV-SMT-P-PHASES-TABLE":
      return smtNote("rollByPhase", { base: c.pupils.status === "ready" ? indexBaseWords(c.pupils.data.trends.base) : "the first year every line shares" });
    case "DV-SMT-P-AREA":
      return c.pupils.status === "ready" ? smtNote("areaResidents", { la: c.school.laName ?? "The LA", ages: c.pupils.data.trends.area.agesWord }) : null;
    case "DV-SMT-C-NOW":
      return c.context.status === "ready" ? `${c.context.data.notes.children} ${c.context.data.notes.births} ${c.context.data.notes.projection} ${SMT_NOTES.wDeciles} ${smtNote("mixInfo", { radius: c.context.data.radius })} ${SMT_NOTES.fsmInfo}` : null;
    case "DV-SMT-C-MAP":
      return c.contextMap.status === "ready" && c.contextMap.data.state === "lsoa" && c.context.status === "ready" && c.context.data.area === "around" ? `${SMT_NOTES.mapNeighbourhoods}. ${smtNote("mapRing", { radius: c.contextMap.data.radius, ring: `${c.contextMap.data.ringKm} km` })} ${SMT_NOTES.wDeciles}` : null;
    case "DV-SMT-C-BYAGE":
    case "DV-SMT-C-AGES":
      return c.context.status === "ready" ? `${c.context.data.notes.popByAge} ${smtNote("wResidents", { radius: c.context.data.radius })}` : null;
    case "DV-SMT-C-NEARBY":
      return c.context.status === "ready" ? `${c.context.data.notes.nearby} ${smtNote("wResidents", { radius: c.context.data.radius })}` : null;
    case "DV-SMT-C-BIRTHS":
    case "DV-SMT-C-BIRTHS-INDEXED":
    case "DV-SMT-C-BIRTHS-TABLE":
      return c.context.status === "ready" ? `${c.context.data.notes.births} ${c.context.data.notes.projection}` : null;
    case "DV-SMT-C-PROJECTION":
      // Its generated method (projectionMethod) says both lines.
      return null;
  }
  return null;
}

/** The direction word at a trend panel's foot (the wireframes' "▲ Growing", "– Steady"). */
function flagOf(dv: string, c: Ctx): ReactNode {
  if (c.dash === "overview" && c.overview.status === "ready") {
    const o = c.overview.data;
    if (dv === "DV-SMT-O-ROLL-LINE") {
      const l = o.trends.roll.lines[0];
      return l ? <RollDirectionWord pts={l.pts} /> : null;
    }
    if (dv === "DV-SMT-O-RESULTS-LINE") {
      const t = o.trends.results[0];
      return t ? <Direction pts={t.school} flat={0.5} /> : null;
    }
    if (dv === "DV-SMT-O-MARKET-LINE" && o.trends.market.status === "ready") return <Direction pts={o.trends.market.school} flat={0.5} up="Gaining share" down="Losing share" />;
  }
  if (c.dash === "pupils" && c.pupils.status === "ready") {
    const p = c.pupils.data;
    if (dv === "DV-SMT-P-PHASES" && p.trends.phases[0]) return <RollDirectionWord pts={p.trends.phases[0].pts} />;
    if (dv === "DV-SMT-P-POOL" && p.trends.pool.status === "ready") {
      const all = [...p.trends.pool.counted, ...p.trends.pool.births];
      const now = p.trends.pool.counted.at(-1)?.value ?? null;
      const end = all.at(-1)?.value ?? null;
      if (now && end !== null) {
        const pct = ((end - now) / now) * 100;
        return <span className={`text-[12px] font-bold ${dirClass(pct, 2, 0)}`}>{arrowOf(pct, 2, 0)} {pct > 2 ? "Pool rising" : pct < -2 ? "Pool falling" : "Pool steady"}</span>;
      }
    }
  }
  if (dv === "DV-SMT-C-BIRTHS-INDEXED" && c.context.status === "ready") {
    const l = c.context.data.births.la;
    const a = l.find((x) => x.value !== null)?.value ?? null;
    const b = [...l].reverse().find((x) => x.value !== null)?.value ?? null;
    if (a && b !== null) {
      const pct = ((b - a) / a) * 100;
      return <span className={`text-[12px] font-bold ${dirClass(pct, 2, 0)}`}>{arrowOf(pct, 2, 0)} {pct > 2 ? "Rising" : pct < -2 ? "Falling" : "Steady"}</span>;
    }
  }
  if (dv === "DV-SMT-A-CHART" && c.academic.status === "ready" && c.academic.data.state.mode === "va") {
    const me = c.academic.data.board.rows.find((r) => r.you);
    return me?.band ? <span className="text-[12px] font-bold text-[var(--muted2)]">{me.band.replace(/ average$/, "")}</span> : null;
  }
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
          return <SchoolFlags o={o} phases={c.school.phases} />;
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
        case "DV-SMT-P-GIRLS-BOYS":
          return <GirlsAndBoys p={p} school={c.school} height={fullscreen && room ? Math.max(180, room - 320) : 150} fullscreen={fullscreen} />;
        case "DV-SMT-P-DAY-BOARDING":
          return <DayAndBoarding p={p} school={c.school} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-P-ENTRIES":
          return <EntryPoints p={p} />;
        case "DV-SMT-P-LEAVING":
          return <LeavingAt16 p={p} school={c.school} />;
        case "DV-SMT-P-MARKET":
          return <MarketLine market={p.market} schoolName={c.school.name} fullscreen={fullscreen} room={room} />;
        case "DV-SMT-P-PHASES":
          return <IndexedLines title="Roll by phase, indexed" lines={p.trends.phases} fullscreen={fullscreen} room={room} caption={smtNote("rollByPhase", { base: periodLabel(p.trends.base ?? CENSUS_FIRST_PERIOD) })} />;
        case "DV-SMT-P-PHASES-TABLE":
          return <RollTable title="Roll by phase" o={{ trends: { roll: { lines: p.trends.phases, base: p.trends.base, laName: c.school.laName } } } as never} />;
        case "DV-SMT-P-POOL":
          return <PoolLine pool={p.trends.pool} fullscreen={fullscreen} room={room} caption={SMT_NOTES.pool} />;
        case "DV-SMT-P-AREA":
          return (
            <PlainLine
              title="The area's school-age population"
              label={`${c.school.laName ?? "The LA"}, residents aged ${p.trends.area.agesWord}`}
              pts={p.trends.area.pts}
              fullscreen={fullscreen}
              room={room}
              caption={p.trends.area.forward ? `${SMT_NOTES.areaResidentsCaption}, then projected. ${SMT_NOTES.wProjection}` : SMT_NOTES.areaResidentsCaption}
              xLabel={(y) => `mid-${y}`}
              forward={p.trends.area.forward ? { ...p.trends.area.forward, label: "Projection", marker: SMT_NOTES.includesUnborn } : null}
            />
          );
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
  return ready(c.academic, (a) => {
    const applied = <AppliedSwitch a={a} onApplied={(t: AppliedType) => c.onAsk({ applied: t })} />;
    switch (dv) {
      case "DV-SMT-A-NOW":
        return <AcademicNow a={a} />;
      case "DV-SMT-A-CHART":
        return (
          <>
            {applied}
            <RankChart a={a} fullscreen={fullscreen} room={room} />
          </>
        );
      case "DV-SMT-A-TABLE":
        return (
          <>
            {applied}
            <RankTable a={a} />
          </>
        );
      case "DV-SMT-A-MAP":
        return (
          <>
            {applied}
            <AcademicMap a={a} fullscreen={fullscreen} room={room} />
          </>
        );
      case "DV-SMT-A-AREAS":
        return <AreasView a={a} />;
      case "DV-SMT-A-GRADES":
        return <GradesView a={a} />;
      case "DV-SMT-A-TREND-LINE":
        return <TrendBand a={a} fullscreen={fullscreen} room={room} />;
      case "DV-SMT-A-TREND-TABLE":
        return <TrendTable a={a} />;
      case "DV-SMT-A-LINES":
        return <EveryLine a={a} />;
      case "DV-SMT-A-MOVES":
      case "DV-SMT-A-SETMOVES":
        return <Moves a={a} />;
      case "DV-SMT-A-MIX":
        return <MixBars a={a} fullscreen={fullscreen} room={room} />;
      case "DV-SMT-A-MIX-TABLE":
        return <MixTableView a={a} />;
      case "DV-SMT-A-AGAINST":
        return <Against a={a} />;
    }
    return <Empty>This view isn&rsquo;t drawn here yet.</Empty>;
  });
}

/** What the Academic view is about: "A level", "Applied general", "All qualifications", a GCSE area. */
function academicWhat(a: Academic): string | null {
  if (a.state.phase === "gcse") return a.state.mode === "va" ? "Progress 8" : a.areaLabel;
  if (a.state.group === "all") return "all qualifications";
  if (a.state.group === "applied" && a.state.mode !== "entries") return a.board.title.split(",")[0];
  return GROUP_LABEL[a.state.group];
}

/** Each Academic view's caption: SMT_NOTES only (R-SMT-NOTES), the mode's own. */
function academicCaption(dv: string, a: Academic): string {
  const n = a.notes;
  const va = a.state.mode === "va";
  const post16 = a.state.phase === "post16";
  switch (dv) {
    case "DV-SMT-A-NOW":
      return [va ? (post16 ? n.vaPost16 : n.bandsP8) : a.state.mode === "entries" ? n.entries : n.points, va && post16 ? n.bandsDfe : null, post16 && a.offer.groups.includes("applied") ? n.applied : null, post16 ? n.eachLine : null, va && post16 ? n.vaGap : null, va && !post16 ? n.p8Gap : null].filter(Boolean).join(" ");
    case "DV-SMT-A-CHART":
    case "DV-SMT-A-TABLE":
    case "DV-SMT-A-MAP":
      return [va ? (post16 ? n.vaPost16 : n.bandsP8) : n.quarters, va && post16 ? n.bandsDfe : null, a.set.chosen ? n.setHolds : null, va && !post16 ? n.p8Gap : null].filter(Boolean).join(" ");
    case "DV-SMT-A-AREAS":
      return [n.subjectsByQual, a.state.mode === "entries" ? `${n.share} ${n.size}` : null, va ? `${n.bandsDfe} ${n.vicdataMatch}` : null, post16 ? n.outsideAreas : null, a.state.mode === "results" ? n.smallEntries : null].filter(Boolean).join(" ");
    case "DV-SMT-A-TREND-LINE":
    case "DV-SMT-A-TREND-TABLE":
      return `${n.middleHalf} ${a.trends.note}`.trim();
    case "DV-SMT-A-LINES":
      return n.lines;
    case "DV-SMT-A-MOVES":
      return n.moves;
    case "DV-SMT-A-SETMOVES":
      return n.setMoves;
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
      return n.mix;
    case "DV-SMT-A-AGAINST":
      return n.against;
  }
  return "";
}

// ------------------------------------------------------------------------------- phone

// Phone (Phone.dc.html): column 1, then the large view with its views as tabs, then row 2's panels
// as tabs of one panel -- each the same RailPanel as on the desktop, sized to its content.
export function PhoneBody({ config, c }: { config: DashboardConfig; c: Ctx }) {
  const now = config.panels.find((p) => p.row === "now" && p.column === "c1");
  const large = config.panels.find((p) => p.row === "now" && (p.span?.cols ?? 1) >= 2);
  const trends = config.panels.filter((p) => p.row === "trends");
  const [largeTab, setLargeTab] = useState("");
  const [trendTab, setTrendTab] = useState(trends[0]?.id ?? "");
  const largeActive = large ? activeWithContent(allRailOf(large), largeTab || defaultOf(large, c), hasOf(large, c)) : "";
  const largeDv = large ? dvOf(large, largeActive) || dvOf(large, large.defaultView ?? "") : "";
  const trendPanel = trends.find((t) => t.id === trendTab) ?? trends[0];
  const trendDv = trendPanel ? dvOf(trendPanel, trendPanel.defaultView ?? "") : "";
  const nowDv = now ? dvOf(now, now.defaultView ?? "") : "";
  const TABS: Record<SmtDash, Record<string, string>> = { overview: { c1: "Roll", c2: "Results", c3: "Market share" }, academic: { c1: "Trend", c2: "Every line", c3: "Entries" }, pupils: { c1: "Roll", c2: "Pool", c3: "Area" }, context: { c1: "Births", c2: "Projection", c3: "By age" } };
  const tabLabel = (t: PanelConfig) => TABS[c.dash][t.column] ?? t.name ?? t.column;
  const title = c.dash === "overview" || c.dash === "pupils" ? `${c.school.name.replace(/ School$/, "")} now · ${yearOf(c.school.census.at(-1)?.period ?? null)}` : c.dash === "context" ? "The area now" : c.academic.status === "ready" ? c.academic.data.col1.title : "";
  return (
    <>
      {now && (
        <RailPanel tag={title} title={title} height="auto" source={sourceOf(nowDv, c)} caption={captionOf(nowDv, c)} focusBar={c.focusBar} view={{ panelId: now.id, panelName: now.name ?? null, instanceId: now.defaultView ?? "", dataview: nowDv || null }}>
          {({ fullscreen }) => <ViewBody dv={nowDv} c={c} fullscreen={fullscreen} />}
        </RailPanel>
      )}
      {large && (
        <RailPanel tag={dataviewById(largeDv)?.label ?? ""} title={dataviewById(largeDv)?.label ?? ""} height="auto" source={sourceOf(largeDv, c)} caption={captionOf(largeDv, c)} chips={chipsOf(largeDv, c)} controls={<Tabs items={railOf(large, c)} active={largeActive} onPick={setLargeTab} />} focusBar={c.focusBar} view={{ panelId: large.id, panelName: large.name ?? null, instanceId: largeActive, dataview: largeDv || null }}>
          {({ fullscreen, height }) => (
            <div className="flex min-h-[200px] flex-col gap-2">
              <ViewBody dv={largeDv} c={c} fullscreen={fullscreen} room={height} />
            </div>
          )}
        </RailPanel>
      )}
      {trendPanel && (
        <RailPanel tag={tabLabel(trendPanel)} title={tabLabel(trendPanel)} height="auto" source={sourceOf(trendDv, c)} caption={captionOf(trendDv, c)} controls={<Tabs items={trends.map((t) => ({ id: t.id, label: tabLabel(t), icon: "" }))} active={trendTab} onPick={setTrendTab} />} focusBar={c.focusBar} flag={flagOf(trendDv, c)} view={{ panelId: trendPanel.id, panelName: trendPanel.name ?? null, instanceId: trendPanel.defaultView ?? "", dataview: trendDv || null }}>
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
  const overview = useSmt<Overview>(s && body && dash === "overview" ? "/api/smt/overview" : null, body);
  const ask: AcademicAsk = { level: (params?.level as string) ?? null, mode: (["results", "entries", "va"] as const).find((m) => m === params?.mode) ?? "results", group: (params?.group as QualGroup) ?? null, applied: params?.applied === "tl" ? "tl" : params?.applied === "ag" ? "ag" : null, area: (params?.area as string) ?? null };
  const academic = useSmt<Academic>(s && body && dash === "academic" ? "/api/smt/academic" : null, body ? { ...body, ...ask } : null);
  const pupils = useSmt<Pupils>(s && body && dash === "pupils" ? "/api/smt/pupils" : null, body ? { ...body, level: level.phase } : null);
  const near = params?.near === "la" ? "la" : "around";
  const context = useSmt<Context>(s && dash === "context" ? `/api/smt/context?urn=${urn}&area=${near}&level=${level.phase}` : null, null);
  const contextMap = useSmt<ContextMap>(s && dash === "context" && near === "around" && dataview === "DV-SMT-C-MAP" ? `/api/smt/context/map?urn=${urn}&level=${level.phase}` : null, null);
  const shade: ShadeBy = (["children", "imd", "idaci", "fsm"] as const).find((k) => k === params?.shade) ?? "children";
  const member = { userId: "", token: "", membershipId: null, schoolAccountId: "", schoolUrn: urn, schoolName, roles: [], isAdmin: false, isAccountHolder: false, access: "member", readOnly: true, viewAs: null } as SmtMember;
  return (
    <div data-smt-preview={dataview} className="flex min-h-0 flex-col gap-2 overflow-hidden text-[var(--fg)]" style={{ ...smtVars(theme), height }}>
      {s && set ? <ViewBody dv={dataview} c={{ member, school: s, dash, level, set, overview, academic, pupils, context, contextMap, shade, onShade: () => undefined, onArea: () => undefined, focusBar: null, phone: false, ask, onAsk: () => undefined }} fullscreen={false} /> : school.status === "error" ? <Empty>{school.message}</Empty> : <Skeleton />}
    </div>
  );
}
