"use client";

// VicData 0.6 E: the Teacher view phase dashboard as a reusable component, moved out of
// src/app/teacher/[phase]/page.tsx so a dashboard can be drawn outside that page -- the
// custom dashboards route (/dashboards/[id]), meeting slots (liveSlotRenderer) and the
// chooser's live preview (LiveViewPreview). The data loading, derivation and column hosts
// below are the page's own code, moved, not rewritten; every rule still lives in src/lib.
//
//   mode "page"   exactly the page as it was: nav, control bar, onboarding, look-as, the
//                 ?renderer=config flag, saved preferences read and written.
//   mode "embed"  the dashboard body only: no nav, control bar, onboarding or banners. The
//                 school comes from `school`, the config from `config`, and the settings
//                 (focus subject, Candidates/Results and the Results measure, Context's
//                 compare-against, the Comparisons set, a pinned year) from `pinned` --
//                 or, with settingsFrom "saved", read (never written) from the person's
//                 saved preferences. Nothing is written to preferences or onboarding;
//                 notes still read and write under their own keys.
//
// Teacher view phase dashboard (design brief v2 §§5, 6, 7, 14).
//
// §5's four questions, pointed at this phase's axis. §6's four-step walkthrough is what
// unlocks the dashboard, once, per person, per phase. §14: every heading is the real
// question it answers, and the onboarding live-count moment is protected -- ticking a
// subject moves a real count immediately, which is the first thing a new user feels.
import { loadDraftVicData, loadPublishedVicData } from "@/lib/published-vicdata";
import { editorWritesSettled, setEditOn, useInPlaceEdit } from "@/lib/edit-mode";
import { EditorScreen, type InPlaceHost } from "@/components/editor/EditorScreen";
import type { RankingFigures } from "@/lib/chooser-sets";
import { directionCssVars } from "@/lib/trend-colours";
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { completeOnboarding, fetchOnboardedPhases, fetchPreferences, savePreferences, fetchNotes, saveNote, hasNewData, markPeriodSeen, NAV_LABELS_KEY, saveNavLabels, againstKey, chosenKey, measureKey, panelNoteKey, readList, readSetting, setKey, writeList, writeSetting, type ColumnState } from "@/lib/teacher-view-data";
import { ExportButton, useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { PhoneNav, TeacherNav } from "@/components/teacher/TeacherNav";
import { CardBox } from "@/components/teacher/CardBox";
import { ExpandIcon, MODAL_CLOSE_BUTTON_CLASS, TeacherModal } from "@/components/teacher/TeacherModal";
import { DashboardFrame, GroupSwitcher, PlannedPanel } from "@/components/dashboard-config/ConfigDashboard";
import { buildPlan, configRendererRequested, DashboardPlanContext, type PlanEmbed } from "@/components/dashboard-config/plan";
import { DashboardRuntimeContext, type DashboardRuntime } from "@/components/dashboard-config/runtime";
import { VicDataUpdatesBySlug } from "@/components/editor/DashboardUpdates";
import type { ResultsMeasure as ResultsMeasureId } from "@/catalogue/types";
import { PanelLimitNote } from "@/components/teacher/ColumnPanels";
import { groupOf, teacherDashboardFor } from "@/catalogue/dashboards";
import type { DashboardConfig } from "@/catalogue/types";
import { cachedFetchJson } from "@/lib/fetch-cache";
import type { PinnedSettings } from "@/lib/meeting-views";
import { embedColumns, embedInitialColumns, embedSubjectKey, pinnedSetName, placeholderOnlyNote, savedSetByName, yearPeriodOf } from "./embed";
import { confirmPlatformAdmin, pickMembership, readPeek, resolveViewAs, type Peek } from "@/lib/view-as";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { VISIBLE_ROLE_LABELS, type VisibleRoleId } from "@/lib/roles";
import { DashboardColumn } from "@/components/teacher/DashboardColumn";
import { CandidatesPanels } from "@/components/teacher/CandidatesPanels";
import { SubjectPanels, type SubjectSeries } from "@/components/teacher/SubjectPanels";
import { ComparisonsPanels, type ComparatorSchool, type MapChip, type SchoolSeries, type SetOption } from "@/components/teacher/ComparisonsPanels";
import { fetchComparatorGrades } from "@/lib/teacher-view-comparator-grades";
import { mapResultOf, type MapSeries } from "@/lib/teacher-map";
import { TableLayoutContext, type TableLayoutStore } from "@/components/teacher/tableLayout";
import { isAsLevelOrAea } from "@/lib/dfe-qualification-buckets";
import { ComparatorSetChooser, type ChooserChoice } from "@/components/teacher/ComparatorSetChooser";
import { SAVED_SET_PREFIX, fetchSavedSets, savedSetKey, type SavedComparatorSet, type SavedSetsPayload } from "@/lib/teacher-view-saved-sets";
import { ControlBar, type FocusSubject, type SharedMeasure } from "@/components/teacher/ControlBar";
import { ResultsControl } from "@/components/teacher/ResultsControl";
import { PillRowSpacer } from "@/components/teacher/PillMenu";
import { GradeCountsPanels } from "@/components/teacher/GradeCountsPanels";
import { ContextPills, type CompareAgainstId } from "@/components/teacher/ContextPills";
import { combine, headlineMeasure, measureById, measuresFor, meanOf, panelsFrom, type Measure, type MeasureId, type PanelId } from "@/lib/teacher-view-panels";
import { GRADE_SCALES, NON_GRADE_VALUES, bandRate, inlineRangeLabel, rangeLabel, scaleForQualification, type GradeRange } from "@/lib/subject-grades";
import { savedSelection, selectionChipLabel, type Selection } from "@/lib/grade-selection";
import { showColumn } from "@/components/teacher/showColumn";
import type { FrameSetGrades } from "@/lib/view-series/frames";
import { MODERN_GRADE_FROM } from "@/lib/grade-rows";
import { shortSubjectLabels } from "@/lib/subject-short-labels";
import { shortQualificationLabel } from "@/components/data-view/SubjectAreaSection";
import { PHASE_ACCENT, SOURCE_NAME, academicYearLabel, colourByGroup, qualificationShortLabel, QUALIFICATION_FAMILIES, qualificationFamilyOf } from "@/lib/teacher-view-theme";
import { comparabilityKey, familyFor, familyLabelFor } from "@/lib/teacher-view-catalogue";
import { QualificationFamilyTiles } from "@/components/teacher/QualificationFamilyTiles";
import { CategorySubjectPicker } from "@/components/teacher/CategorySubjectPicker";
import { COLUMN_ICON_PATHS } from "@/components/teacher/DashboardColumn";
import { COLUMN_TITLE, defaultBoxTitle } from "@/lib/teacher-view-catalogue";
import { candidatesMoved, resultsMoved } from "@/lib/teacher-view-this-moved";
import { type RankedSchool } from "@/lib/teacher-view-rankings";
import { PHASE_LABELS, PHASE_QUESTIONS, TEACHER_PHASES, type TeacherPhase } from "@/lib/teacher-view-phases";
// VicData 0.6 S2: the rules that decide each figure and each comparison population live in
// these libs (every enforcement point tagged with its rule ID); this page only calls them.
import { bandRangeFor, comparisonsMeasureFor, contextBandShareAt, contextFallsBackFor, contextGroupValue, contextKeepsToFamily, contextMeasureFor, englandIndexOf, englandValueAt, gradeRateScorer, gradeRowsAt, hasEnglandPointsBenchmark, hasGradesAt, latestOwnPoints, onFocusPointsScale, ownHeadlineRows, periodsForMeasure, shareApplies, subjectBandAt, subjectEntriesAt, subjectPointsAt, subjectThresholdAt } from "@/lib/teacher-view-measures";
import { type SubjectItem as LibSubjectItem, asOrAeaOnlySubjects, candidateItemsOf, categoryItemsOf, contextGroupRows, contextItemsOf, contextMembersOf, contextOfferOf, focusQualificationFamily, inContextGroup, keepFocusOrFigured, memberMeans, schoolSubjectNamesOf, schoolSubjectsOf, subjectItemsOf } from "@/lib/teacher-view-populations";
import { candidatesGeographyApplies, pointsEligibleEntriesByPeriod, resultsGeographyApplies } from "@/lib/teacher-view-geography";
import { MINIMUM_SUBJECT_N, deserializeAcademicProfile, subjectYearsFor, type AcademicSchoolProfile, type AcademicSubjectHeadlineEntry, type SubjectEntry, type SubjectGradeCount } from "@/lib/academic-data-view";

// §3: the picker works at real taught-qualification level, not subject-family level --
// "someone might teach AS Maths but not Statistics". So an item is a (subject,
// qualification) pair, not a subject.
type SubjectItem = LibSubjectItem;

// Comparator chooser round: the Comparisons column's unsaved chooser choice. CHOOSER_KEY
// holds it (JSON) among the column settings; CHOOSER_SET_ID is the id it takes in the
// "Compared against" pill beside the presets and saved sets.
const CHOOSER_KEY = "chooser:rankings";
const CHOOSER_SET_ID = "chooser";
// Comparator dropdown round (option A): with nothing chosen -- or a choice that no longer
// exists, such as a mothballed preset or a deleted saved set -- the column shows the
// chooser's own "10 nearest schools" (resolveDefaultNearest). This is its resolve key.
const DEFAULT_CHOICE_KEY = "default:nearest";
const DEFAULT_CHOICE_LABEL = "10 nearest schools";
// 0.6 E: an embed pinned to a saved set by name holds the pill here while saved sets
// load, so the default nearest ten never fetches first; the set's own key replaces it
// once found (and if no set has that name, it reads as nothing chosen: nearest ten).
const PENDING_SET_ID = "pending-by-name";

// What /api/teacher/dashboard returns, as far as this component reads it.
type DashboardPayload = {
  subjectData?: { entries?: SubjectEntry[]; gradeDistribution?: SubjectGradeCount[] };
  headline?: AcademicSubjectHeadlineEntry[];
  qualificationHeadline?: AcademicSubjectHeadlineEntry[];
  rollAtAge10?: number | null;
  neighbours?: (RankedSchool & { distanceKm: number | null })[];
  headlineLabel?: string;
  seriesByUrn?: Record<string, SchoolSeries>;
  englandAverages?: { basis: "qualification" | "subject"; values: { key: string; period: number; value: number }[] } | null;
};

// Comparator dropdown round: what the Comparisons column is on. A saved set by its key
// ("pending" while saved sets are still loading, so the default never flashes in first);
// otherwise the chooser's own stored choice; otherwise the default nearest ten. A stored
// preset id (mothballed) reads as nothing chosen. `activeChoiceKey` is what
// /api/teacher/chooser-set is asked to resolve: null for a saved set.
function activeComparison(storedSet: string | undefined, chooserRaw: string | undefined, savedSets: SavedSetsPayload | null) {
  const storedSaved: "yes" | "no" | "pending" = storedSet?.startsWith(SAVED_SET_PREFIX)
    ? savedSets
      ? savedSets.sets.some((set) => savedSetKey(set.id) === storedSet) ? "yes" : "no"
      : "pending"
    : "no";
  const stored = storedSet === CHOOSER_SET_ID ? parseChooserChoice(chooserRaw) : null;
  const chooserChoice = storedSaved === "no" && stored && stored.kind !== "saved" ? stored : null;
  const activeChoiceKey: string | null = storedSaved !== "no" ? null : chooserChoice ? chooserRaw! : DEFAULT_CHOICE_KEY;
  return { storedSaved, chooserChoice, activeChoiceKey };
}

function parseChooserChoice(raw: string | undefined): ChooserChoice | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as ChooserChoice;
    if (c.kind === "urns" && Array.isArray(c.urns)) return c;
    if (c.kind === "ranking" && c.filters && typeof c.filters === "object") return c;
    return null;
  } catch {
    return null;
  }
}

// The onboarding steps only ever run for GCSE and Post-16, which always have an accent.
function accentFor(phase: "ks4" | "ks5"): { hex: string; rgb: string } {
  return PHASE_ACCENT[phase] as { hex: string; rgb: string };
}

// The props contract (0.6 E).
export type TeacherDashboardProps = {
  // The route's phase segment in mode "page" (anything else reads as "Unknown phase.");
  // the dashboard's one phase in mode "embed".
  phase: string;
  mode: "page" | "embed";
  // Embed: the config to draw (a stored dashboard, or the one-view config a meeting slot
  // or preview builds). Page: ignored -- the page picks its own under ?renderer=config.
  config?: DashboardConfig | null;
  // Embed: the school, by URN. The caller must be a member (or a platform admin): the
  // data routes check, as they do for the page.
  school?: string | null;
  // Embed: the settings to draw with (a meeting slot's PinnedSettings, or a preview's).
  pinned?: PinnedSettings | null;
  // Embed: "pinned" (default) starts from `pinned` alone; "saved" starts from the
  // person's saved Teacher preferences for this school and phase (ticked subjects, pills),
  // read only -- a custom dashboard shares the person's subject choice.
  settingsFrom?: "pinned" | "saved";
  // Embed, one-panel configs: "card" draws the whole panel; "figure" the figure alone,
  // for a frame that brings its own card (a meeting slot), drawn at `fullscreen`.
  frame?: "card" | "figure";
  fullscreen?: boolean;
  // Embed, 0.6 snag 2 (B): draw as a member sees it (no super-admin placeholders or
  // copy-into-VicData chrome) even for a platform admin -- a VicData dashboard on
  // /dashboards/[id], whose admin surface is the Edit switch's editor.
  memberView?: boolean;
};

export function TeacherDashboard(props: TeacherDashboardProps) {
  const embed = props.mode === "embed";
  // Preferences, onboarding and last-seen writes happen only on the page itself.
  const canWrite = !embed;
  const phase = (TEACHER_PHASES as readonly string[]).includes(props.phase) ? (props.phase as TeacherPhase) : null;
  const supabase = createBrowserSupabaseClient();
  const embedConfig = embed ? props.config ?? null : null;
  const embedPinned = useMemo<PinnedSettings>(() => props.pinned ?? {}, [props.pinned]);
  // The settings an embed was drawn with, as one stable key: the loader re-runs on change.
  const embedKey = embed ? JSON.stringify([props.school, embedConfig?.id, embedConfig?.columns, embedConfig?.panels, embedPinned, props.settingsFrom]) : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Set by the loader's own session check. The site NavBar is hidden on this route and
  // TeacherNav only renders past the error screen, so a signed-out visitor needs a Login
  // link on the error screen itself or they have no way to sign in from here.
  const [signedOut, setSignedOut] = useState(false);
  // VicData 0.6: ?renderer=config draws the dashboard from its config (S2/S3). The
  // Catalogue's parity frames' read-only peek (readPeek) only for a platform admin.
  const [configMode, setConfigMode] = useState(false);
  // Snag 1 item 00: the published VicData configs for this phase's group (Candidates and
  // Results), from the dashboards store, keyed by slug. Null until loaded or when the page
  // isn't under the flag; each falls back to the copy in code (published-vicdata.ts).
  const [storedConfigs, setStoredConfigs] = useState<Record<string, DashboardConfig> | null>(null);
  // 0.6 snag 2 (B), "Preview draft" (Guy, in a trial): the group's drafts, drawn instead of
  // the published versions in this tab only. Null when off or not loaded.
  const [draftConfigs, setDraftConfigs] = useState<Record<string, DashboardConfig> | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [schoolUrn, setSchoolUrn] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  // Round 6 (§6.5): the real per-grade rows behind the threshold measure. They were
  // already in this route's payload and simply never read -- see subject-grades.ts.
  const [gradeRows, setGradeRows] = useState<SubjectGradeCount[]>([]);
  const [headline, setHeadline] = useState<AcademicSubjectHeadlineEntry[]>([]);
  // Post-16 Part C: this school's own figures per (subject, EXACT qualification type), so
  // a ticked AS and A-level Psychology -- or IB Higher and Standard level Biology -- each
  // read their own numbers rather than their bucket's blend. Empty at GCSE. `headline`
  // (bucket grain) still serves the category lookup and Context's whole-subject group.
  const [qualificationHeadline, setQualificationHeadline] = useState<AcademicSubjectHeadlineEntry[]>([]);
  const [rollAtAge10, setRollAtAge10] = useState<number | null>(null);
  const [neighbours, setNeighbours] = useState<(RankedSchool & { distanceKm: number | null })[]>([]);
  const [headlineLabel, setHeadlineLabel] = useState<string>("");
  // Round 6 (§6.4): every comparator school's own real per-year history for both measures.
  // (The route's four preset sets themselves -- comparatorSets, with setInfo -- are
  // mothballed since the comparator dropdown round: still returned, no longer read.)
  const [seriesByUrn, setSeriesByUrn] = useState<Record<string, SchoolSeries>>({});
  // Accordion round Part 3: the saved comparator sets (the teacher's own and the school's
  // shared ones), fetched after the main load and again after the chooser saves. Merged
  // into the same comparator-set map as the four presets, keyed "saved:<id>", so the
  // pill, the validity check and the per-subject map fetch all treat them alike.
  const [savedSets, setSavedSets] = useState<SavedSetsPayload | null>(null);
  const [chooser, setChooser] = useState<{ editing: SavedComparatorSet | null } | null>(null);
  // Comparator chooser round: an unsaved choice made in the chooser (a list of schools, or
  // a ranking), and the rows and series /api/teacher/chooser-set resolved for it. The
  // choice itself is saved as a column setting (CHOOSER_KEY) so it survives a reload; the
  // rows are re-fetched from it rather than stored.
  // Snagging round 1 Part 4: a ranking also brings its rank-in-the-whole-population and
  // population-average figures (RankingFigures), which a list of schools does not have.
  const [chooserSet, setChooserSet] = useState<{ key: string; rows: ComparatorSchool[]; seriesByUrn: Record<string, SchoolSeries>; note: string | null; ranking: RankingFigures | null } | null>(null);
  // The Results card's anchor -- see englandAverages in the dashboard route: the subject
  // itself at GCSE; at Post-16 the subject in its exact qualification, with no fallback.
  const [englandAvg, setEnglandAvg] = useState<{
    basis: "qualification" | "subject";
    values: { key: string; period: number; value: number }[];
  } | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [columns, setColumns] = useState<ColumnState>({});
  const [theme, setTheme] = useTeacherTheme();
  // §13: captured once at load. Marking the period seen immediately afterwards would make
  // the banner vanish on the very next render, so what was new at load stays visible for
  // this visit and simply does not reappear on the next one.
  const [newDataPeriod, setNewDataPeriod] = useState<number | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  // Every phase this school has onboarded -- the nav's switcher offers only these.
  const [onboardedPhases, setOnboardedPhases] = useState<TeacherPhase[]>([]);
  const [step, setStep] = useState(0);
  // Onboarding step 1's ticked qualification families. null = not touched yet, which means
  // "every family the school has entries under" -- the mockup's pre-ticked default, so a
  // teacher with only GCSE and BTEC entries never has to discover and tick GCSE by hand.
  const [qualSelection, setQualSelection] = useState<string[] | null>(null);
  // The dashboard's quick-edit families (the "Which subjects do you teach?" section).
  // null = derive from what is actually ticked, the returning user's real selection;
  // frozen to an explicit list on the first edit, so unticking a family's last subject
  // does not make its tile and tab vanish mid-edit.
  const [quickFamilies, setQuickFamilies] = useState<string[] | null>(null);
  // The map's own rank for this school on the subject it is plotting (reported by
  // AcademicMapView), so the "N of M" line can match the map once a chip is active.
  const [mapRank, setMapRank] = useState<{ rank: number; total: number } | null>(null);
  // The subject picker is a popup opened by the chip header's "±", not a permanent
  // section of the dashboard.
  // Round 8 §3: ONE focus subject for the whole dashboard. Content round S5 killed "All":
  // every column now shows exactly one subject, so this is only ever the teacher's own
  // CHOICE -- what is actually in focus is `focusKey` below, which falls back to the first
  // ticked subject. Kept nullable because "not chosen yet" is real; it is not "All".
  const [chosenFocusKey, setFocusKey] = useState<string | null>(null);
  // Round 8 §6: every private note this person has for this school, keyed by chart_key and
  // fetched once. Nine panels would otherwise be nine round trips on every load.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const subjectPickerCloseRef = useRef<HTMLButtonElement | null>(null);
  // Round 5: the Rankings map's schools, as full academic profiles. Fetched once here and
  // handed to both the card's map and the fullscreen one, so opening fullscreen is not a
  // second round trip. null = not loaded yet; [] = loaded, nothing to draw.
  const [mapProfiles, setMapProfiles] = useState<AcademicSchoolProfile[] | null>(null);

  useEffect(() => {
    // Every setState below lives inside this async callback rather than the effect body,
    // matching React's own guidance and the same fix already applied elsewhere in this
    // codebase -- a synchronous setState here triggers cascading renders.
    (async () => {
      if (!phase) { setError("Unknown phase."); setLoading(false); return; }
      // Read straight from the response rather than from state: setHeadline has not
      // committed by the time the new-data check below runs.
      let loadedHeadline: AcademicSubjectHeadlineEntry[] = [];
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setSignedOut(true); setError("Sign in to see this dashboard."); setLoading(false); return; }
      const search = new URLSearchParams(window.location.search);
      // Embed: no View as or peek and no URL flag -- the school and config are the caller's.
      // View as (src/lib/view-as.ts): that school as a member with that one role -- the
      // same school, data and offers a real member gets -- saving to its own state
      // (teacher-view-data.ts keys it), on the config renderer whatever the flag. Only the
      // Catalogue's frames (readPeek) are the old read-only look.
      const trial = embed ? null : await resolveViewAs(supabase);
      const requestedPeek = embed || trial ? null : readPeek(search);
      const peekOk = requestedPeek ? await confirmPlatformAdmin(supabase) : false;
      // Started here so it runs alongside the school's data; awaited just before the page
      // first paints, so the stored config is drawn from the start (no swap, no flash).
      let publishedLoad: Promise<Record<string, DashboardConfig>> | null = null;
      if (embed ? !!embedConfig : configRendererRequested(search) || !!trial) {
        setConfigMode(true);
        if (!embed && (phase === "ks4" || phase === "ks5")) {
          const group = [teacherDashboardFor(phase, "candidates"), teacherDashboardFor(phase, "results")];
          publishedLoad = Promise.all(group.map((d) => loadPublishedVicData(supabase, d.id, d))).then((loads) =>
            Object.fromEntries(loads.map((l) => [l.config.id, l.config])),
          );
        }
        // Super-admin sees placeholder panels in an embed that has one, or in a whole
        // dashboard (Copy this view lets super-admin copy into VicData's). 0.6 snag 2 (B):
        // the Teacher page itself is always the member's view -- Guy's admin surface there
        // is the Edit switch's editor -- and so is an embed asked for `memberView`.
        if (embed && !props.memberView && ((embedConfig?.panels.length ?? 0) > 1 || embedConfig?.panels.some((p) => p.dataviews.every((v) => v.kind === "placeholder")))) {
          const { data: admin } = await supabase.rpc("is_platform_admin");
          setSuperAdmin(admin === true);
        }
      }
      let urn: string | null;
      if (embed) {
        urn = props.school ?? null;
        setSchoolUrn(urn);
        if (urn) {
          const { data: school } = await supabase.from("schools").select("current_name").eq("urn", urn).maybeSingle<{ current_name: string }>();
          setSchoolName(school?.current_name ?? embedPinned.schoolName ?? null);
        }
      } else if (trial) {
        urn = trial.urn;
        setSchoolUrn(urn);
        setSchoolName(trial.schoolName);
      } else if (peekOk && requestedPeek) {
        setPeek(requestedPeek);
        const { data: school } = await supabase.from("schools").select("current_name").eq("urn", requestedPeek.urn).maybeSingle<{ current_name: string }>();
        urn = requestedPeek.urn;
        setSchoolUrn(urn);
        setSchoolName(school?.current_name ?? null);
      } else {
        const { data: mine } = await supabase
          .from("school_memberships")
          .select("id, approved_at, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
          // The signed-in person's own rows (S3b fix 2): RLS also returns every approved
          // colleague's. 0.6 snag 4: more than one is fine -- the page shows ONE school,
          // picked by pickMembership (never "the first row").
          .eq("profile_id", sessionData.session?.user?.id ?? "")
          .eq("status", "approved");
        const membership = pickMembership((mine ?? []) as unknown as { approved_at: string | null; school_accounts: { school_urn: string; schools: { current_name: string } | null } | null }[]);
        urn = membership?.school_accounts?.school_urn ?? null;
        setSchoolUrn(urn);
        setSchoolName(membership?.school_accounts?.schools?.current_name ?? null);
      }
      if (!urn) { setError(embed ? "No school to draw this view for." : "Teacher view is available to verified school staff."); setLoading(false); return; }

      // Shared for 5 minutes with every other view of this school (fetch-cache.ts).
      const res = await cachedFetchJson<DashboardPayload>(`/api/teacher/dashboard?urn=${encodeURIComponent(urn)}&phase=${phase}`, { token });
      let loadedEntries: SubjectEntry[] = [];
      if (res.ok && res.body) {
        const body = res.body;
        loadedEntries = body.subjectData?.entries ?? [];
        setEntries(body.subjectData?.entries ?? []);
        setGradeRows(body.subjectData?.gradeDistribution ?? []);
        setHeadline(body.headline ?? []);
        setQualificationHeadline(body.qualificationHeadline ?? []);
        loadedHeadline = body.headline ?? [];
        setRollAtAge10(body.rollAtAge10 ?? null);
        setNeighbours(body.neighbours ?? []);
        setHeadlineLabel(body.headlineLabel ?? "");
        setSeriesByUrn(body.seriesByUrn ?? {});
        setEnglandAvg(body.englandAverages ?? null);
      } else {
        setError("Could not load this school's data. Try again.");
      }
      if (embed) {
        // No onboarding gate, no last-seen write, no "new data" banner. Settings come from
        // the pin (or, for a custom dashboard, are read from saved preferences).
        setOnboarded(true);
        const fromSaved = props.settingsFrom === "saved";
        const pinnedKey = embedSubjectKey(subjectItemsOf(loadedEntries), embedPinned);
        const prefs = fromSaved || !pinnedKey ? await fetchPreferences(supabase, urn, phase) : null;
        let nextTicked = prefs?.subjects ?? [];
        if (pinnedKey) {
          nextTicked = fromSaved ? (nextTicked.includes(pinnedKey) ? nextTicked : [...nextTicked, pinnedKey]) : [pinnedKey];
          setFocusKey(pinnedKey);
        }
        setTicked(nextTicked);
        if (embedConfig) {
          const setName = pinnedSetName(embedPinned);
          setColumns(
            embedInitialColumns(embedConfig, embedPinned, fromSaved ? prefs?.columns ?? {} : {}, {
              pendingSetKey: setName ? savedSetKey(PENDING_SET_ID) : null,
              chooserKey: CHOOSER_KEY,
              setKeyName: setKey("rankings"),
            }),
          );
        }
        if (props.frame !== "figure") setNotes(await fetchNotes(supabase, urn));
        setLoading(false);
        return;
      }
      const done = await fetchOnboardedPhases(supabase, urn);
      setOnboarded(done.includes(phase));
      setOnboardedPhases(done);
      const prefs = await fetchPreferences(supabase, urn, phase);
      setTicked(prefs.subjects);
      setColumns(prefs.columns);
      setNotes(await fetchNotes(supabase, urn));

      // §13's "New-data-in", derived rather than pushed -- see hasNewData.
      const periods = (loadedHeadline as AcademicSubjectHeadlineEntry[]).map((h) => h.period);
      const latestPeriod = periods.length ? Math.max(...periods) : null;
      if (hasNewData(latestPeriod, prefs.lastSeenPeriod)) setNewDataPeriod(latestPeriod);
      await markPeriodSeen(supabase, urn, phase, latestPeriod);
      if (publishedLoad) setStoredConfigs(await publishedLoad);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.phase, embedKey]);

  // The comparator profiles come through /api/data-view/academic-schools -- the same
  // membership-gated route the advanced dashboard's map is fed from -- for exactly the
  // schools this card ranks against. A separate effect rather than part of the loader
  // above so the dashboard renders without waiting for this heavier fetch.
  //
  // Round 7 §9: fetched for the UNION of all four comparator sets, not just the nearest
  // ten. These rows are what make Comparisons' Graph and Ranking subject-specific, and
  // they now have to cover whichever set the "Compared against" pill is on. Same call,
  // same route, a longer urn list -- the dashboard route already resolves this same union
  // server-side, so it is a set that is known to be a sane size.
  // The chooser's unsaved choice (see chooserSet) joins as CHOOSER_SET_ID: an empty list
  // while it loads, so the pill stays on it rather than falling back to the first preset.
  const chooserRaw = readSetting(columns, CHOOSER_KEY);
  // Comparator dropdown round: what the column is on, resolved once. A saved set by its
  // key (kept while saved sets are still loading, so the default never flashes in first);
  // otherwise the chooser's own stored choice; otherwise the default nearest ten. The old
  // presets (Nearest 10 / Same sector / Local rivals / Similar-sized) are mothballed: a
  // stored preset id now reads as "nothing chosen".
  const storedSet = readSetting(columns, setKey("rankings"));
  const allComparatorSets = useMemo<Record<string, ComparatorSchool[] | undefined>>(() => {
    const key = activeComparison(storedSet, chooserRaw, savedSets).activeChoiceKey;
    return {
      ...Object.fromEntries((savedSets?.sets ?? []).map((set) => [savedSetKey(set.id), set.rows])),
      ...(key ? { [CHOOSER_SET_ID]: chooserSet?.key === key ? chooserSet.rows : [] } : {}),
    };
  }, [savedSets, storedSet, chooserRaw, chooserSet]);
  const { storedSaved, chooserChoice, activeChoiceKey } = activeComparison(storedSet, chooserRaw, savedSets);
  const comparatorUrns = useMemo(
    () => Array.from(new Set(Object.values(allComparatorSets).flatMap((set) => (set ?? []).map((r) => r.urn)))).sort(),
    [allComparatorSets],
  );

  // Resolve the chooser's unsaved choice whenever it changes (and once on load).
  useEffect(() => {
    if (!activeChoiceKey || !schoolUrn || !phase) return;
    const choice = activeChoiceKey === DEFAULT_CHOICE_KEY ? ({ kind: "nearest" } as const) : parseChooserChoice(activeChoiceKey);
    if (!choice || choice.kind === "saved") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      // Shared for 5 minutes with every other view of this school (fetch-cache.ts).
      const res = await cachedFetchJson<{ rows: ComparatorSchool[]; seriesByUrn: Record<string, SchoolSeries>; note: string | null } & Partial<RankingFigures>>("/api/teacher/chooser-set", {
        token,
        method: "POST",
        body: JSON.stringify({
          urn: schoolUrn,
          phase,
          set: choice.kind === "nearest" ? choice : choice.kind === "urns" ? { kind: "urns", urns: choice.urns } : { kind: "ranking", filters: choice.filters },
        }),
      });
      if (cancelled || !res.ok || !res.body) return;
      const body = res.body;
      const ranking: RankingFigures | null =
        choice.kind === "ranking" && body.ranked !== undefined
          ? {
              matched: body.matched ?? 0,
              ranked: body.ranked,
              targetRank: body.targetRank ?? null,
              target: body.target ?? null,
              targetSeries: body.targetSeries ?? [],
              averageLatest: body.averageLatest ?? null,
              average: body.average ?? [],
            }
          : null;
      if (!cancelled) setChooserSet({ key: activeChoiceKey, rows: body.rows, seriesByUrn: body.seriesByUrn, note: body.note, ranking });
    })();
    return () => { cancelled = true; };
  }, [activeChoiceKey, schoolUrn, phase, supabase]);

  const reloadSavedSets = useCallback(async () => {
    if (!schoolUrn || !phase) return;
    // Straight after the chooser saved: past the fetch cache.
    setSavedSets(await fetchSavedSets(supabase, schoolUrn, phase, { fresh: true }));
  }, [schoolUrn, phase, supabase]);

  useEffect(() => {
    if (!schoolUrn || !onboarded || !phase) return;
    let cancelled = false;
    (async () => {
      const payload = await fetchSavedSets(supabase, schoolUrn, phase);
      if (!cancelled) setSavedSets(payload);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolUrn, onboarded, phase]);

  // 0.6 E: an embed pinned to a saved set by name switches to that set's key once the
  // saved sets have loaded (the name is what a meeting slot stores).
  const pinnedSet = embed ? pinnedSetName(embedPinned) : null;
  useEffect(() => {
    if (!pinnedSet || !savedSets) return;
    const found = savedSetByName(savedSets.sets, pinnedSet);
    if (!found) {
      console.info(`[embed] no saved comparison set called "${pinnedSet}"; showing the 10 nearest schools`);
      return;
    }
    const key = savedSetKey(found.id);
    // Only from the pending marker, so a later choice is never overridden.
    (async () => {
      setColumns((prev) => (readSetting(prev, setKey("rankings")) === savedSetKey(PENDING_SET_ID) ? writeSetting(prev, setKey("rankings"), key) : prev));
    })();
  }, [pinnedSet, savedSets]);

  useEffect(() => {
    if (!schoolUrn || !onboarded || comparatorUrns.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const urns = comparatorUrns.join(",");
      const res = await cachedFetchJson<{ profiles?: Parameters<typeof deserializeAcademicProfile>[0][] }>(
        // includeSubjects=1: the subject chips need each school's per-subject rows, and
        // since round 7 so do Graph, Ranking, Trend and % change.
        `/api/data-view/academic-schools?anchorUrn=${encodeURIComponent(schoolUrn)}&urns=${encodeURIComponent(urns)}&includeSubjects=1`,
        { token },
      );
      if (cancelled) return;
      if (!res.ok || !res.body) { setMapProfiles([]); return; }
      const body = res.body;
      if (!cancelled) setMapProfiles((body.profiles ?? []).map(deserializeAcademicProfile));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolUrn, onboarded, comparatorUrns]);

  // R-IB-NONSUBJECT (S3b): subjectItemsOf leaves the IB Diploma total and IB Core rows out.
  const items = useMemo(() => subjectItemsOf(entries), [entries]);
  const tickedItems = useMemo(() => items.filter((i) => ticked.includes(i.key)), [items, ticked]);
  // The live count §6 and §14 both single out: ticking a subject moves this immediately.
  const liveCount = useMemo(() => tickedItems.reduce((sum, i) => sum + i.entries, 0), [tickedItems]);

  const persist = useCallback(
    async (next: string[]) => {
      setTicked(next);
      if (canWrite && schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, subjects: next });
      }
    },
    [canWrite, schoolUrn, phase, supabase],
  );

  const toggle = useCallback(
    (key: string) => persist(ticked.includes(key) ? ticked.filter((k) => k !== key) : [...ticked, key]),
    [persist, ticked],
  );

  // §7: "Saved state is now a hard requirement, not optional." Every change round-trips
  // immediately -- there is no explicit save, so there is nothing to forget to press.
  //
  // Round 6 stores the column's PANELS here, where round 5 stored its pinned view ids.
  // The default set (Current alone) is modelled as the key being absent, exactly as
  // resetColumn already models "never customised", so the two cannot drift into two
  // states -- see panelsFrom().
  const setPanels = useCallback(
    async (columnId: string, panels: PanelId[]) => {
      const next: ColumnState = { ...columns };
      if (panels.length === 1 && panels[0] === "current") delete next[columnId];
      else next[columnId] = panels;
      setColumns(next);
      if (canWrite && schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [canWrite, columns, schoolUrn, phase, supabase],
  );

  // A column's "which data" choice -- the measure its three panels all point at, and in
  // Context the comparison group too. Saved alongside the panels, because coming back to
  // a card showing a DIFFERENT NUMBER from the one you left is disorienting in a way that
  // coming back to the same number drawn differently is not.
  // Several settings in ONE write: setColumnSetting reads `columns` from its closure, so
  // two calls in a row would lose the first.
  const setColumnSettings = useCallback(
    async (pairs: [string, string | null][]) => {
      const next = pairs.reduce((acc, [k, v]) => writeSetting(acc, k, v), columns);
      setColumns(next);
      if (canWrite && schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [canWrite, columns, schoolUrn, phase, supabase],
  );

  const setColumnSetting = useCallback(
    async (key: string, value: string | null) => {
      const next = writeSetting(columns, key, value);
      setColumns(next);
      if (canWrite && schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [canWrite, columns, schoolUrn, phase, supabase],
);

  // 0.6.3 S4: a year table's layout per view, saved with the member's other page settings.
  const tableLayoutStore = useMemo<TableLayoutStore>(
    () => ({
      get: (key) => {
        const v = readSetting(columns, key);
        return v === "across" || v === "down" ? v : null;
      },
      set: (key, layout) => {
        void setColumnSetting(key, layout);
      },
    }),
    [columns, setColumnSetting],
  );

  // The nav's label toggle, saved through the same path as every column setting. That
  // store is keyed per phase, and a nav toggle that flipped back when you used the nav's
  // own phase switcher would read as a bug -- so it is written to every onboarded phase's
  // row, not just this one. Each row is read-modify-written like setColumnSetting does.
  const setNavLabels = useCallback(
    async (on: boolean) => {
      await setColumnSetting(NAV_LABELS_KEY, on ? null : "off");
      if (!canWrite || !schoolUrn || !phase) return;
      await saveNavLabels(supabase, schoolUrn, onboardedPhases.filter((p) => p !== phase), on);
    },
    [canWrite, setColumnSetting, onboardedPhases, schoolUrn, phase, supabase],
  );

  // Context's "Selected subjects" tick set, saved the same way its measure is.
  const setColumnList = useCallback(
    async (key: string, values: string[]) => {
      const next = writeList(columns, key, values);
      setColumns(next);
      if (canWrite && schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [canWrite, columns, schoolUrn, phase, supabase],
  );

  // A subject's latest real score, with its year so the England anchor can be read for the
  // SAME year. At GCSE only "GCSE (9-1) Full Course" carries points (the Data View's
  // POINTS_BEARING_QUALIFICATION): headline rows are keyed by subject alone there, so
  // without this gate an OCR or BTEC row for the same subject showed the GCSE score as
  // its own.
  //
  // Post-16 Part C: an item's own rows, every period. At Post-16 they are the rows for its
  // exact qualification -- never the bucket's, which blends AS into A level, IB Standard
  // into Higher level and every BTEC size together. The exact rows sum back to the bucket
  // rows, so nothing the bucket had is lost: where a bucket row has no exact row for this
  // item, that row belonged to a sibling qualification. At GCSE, the subject's rows.
  const ownRowsFor = useCallback(
    (item: SubjectItem): AcademicSubjectHeadlineEntry[] => ownHeadlineRows(phase, item, headline, qualificationHeadline),
    [headline, qualificationHeadline, phase],
  );

  const resultsFor = useCallback(
    (item: SubjectItem): { value: number; period: number } | null => latestOwnPoints(phase, item, ownRowsFor(item)),
    [ownRowsFor, phase],
  );

  // The England figures keyed for lookup, "{key}@{period}": key is the subject at GCSE and
  // "{subject}::{qualificationType}" at Post-16.
  const englandIndex = useMemo(() => englandIndexOf(englandAvg), [englandAvg]);

  // One item's England figure for one year. Post-16: the same subject in the same exact
  // qualification, or nothing. Part D: no bucket fallback -- where England has no figure
  // for the qualification (VRQ, AEA, EPQ, a suppressed year) the marker is absent rather
  // than a blend of other qualifications. The real data showed the fallback only ever sat
  // beside an empty bar anyway: the school's own figure was null every time it fired.
  const englandValue = useCallback(
    (item: SubjectItem, period: number): number | null => englandValueAt(englandAvg, englandIndex, phase, item, period),
    [englandAvg, englandIndex, phase],
  );

  // §6/§14: never a bare number. The anchor is the England average (it used to be this
  // school's own average across its subjects, which compares a subject with its
  // neighbours down the corridor, not with the country). Same year as the score or no
  // anchor at all: a delta against a different year is a difference nobody measured.
  const englandFor = useCallback(
    (item: SubjectItem, score: { period: number }): number | null => englandValue(item, score.period),
    [englandValue],
  );

  // 0.6 snag 2 (B): the Edit switch. The page registers the VicData dashboard it draws
  // (config renderer, past the walkthrough) so the footer and the trial banner offer the
  // switch; while it is on, the editor is drawn in place of the page (below), on the same
  // dashboard, with this school and subject as its live preview.
  const vicDataSlug =
    !embed && configMode && !loading && !error && onboarded && (phase === "ks4" || phase === "ks5")
      ? teacherDashboardFor(phase, readSetting(columns, measureKey("shared")) === "results" ? "results" : "candidates").id
      : null;
  const inPlace = useInPlaceEdit(supabase, vicDataSlug);
  const reloadPhase = !embed && configMode && (phase === "ks4" || phase === "ks5") ? phase : null;
  // After editing (a Publish shows straight away), and for Preview draft: re-read the
  // group's published versions / drafts. The first load is the loader's own.
  useEffect(() => {
    if (!reloadPhase || (inPlace.reloadTick === 0 && !inPlace.previewDraft)) return;
    let live = true;
    (async () => {
      await editorWritesSettled();
      const group = [teacherDashboardFor(reloadPhase, "candidates"), teacherDashboardFor(reloadPhase, "results")];
      const byId = (loads: { config: DashboardConfig }[]) => Object.fromEntries(loads.map((l) => [l.config.id, l.config]));
      const published = inPlace.reloadTick > 0 ? byId(await Promise.all(group.map((d) => loadPublishedVicData(supabase, d.id, d)))) : null;
      const drafts = inPlace.previewDraft ? byId(await Promise.all(group.map((d) => loadDraftVicData(supabase, d.id, d)))) : null;
      if (!live) return;
      if (published) setStoredConfigs(published);
      setDraftConfigs(drafts);
    })();
    return () => {
      live = false;
    };
  }, [reloadPhase, inPlace.reloadTick, inPlace.previewDraft, supabase]);

  // 0.6.2 S3: the Compared-against set's grade rows for the focused subject -- what "Add an
  // average" across schools draws on Grade 4+, bands and counts in a subject column. Fetched
  // only once a view asks for it (setGradeRowsFor below queues the ask during render), from
  // the same /api/teacher/comparator-grades request Comparisons makes, so where Comparisons is
  // on the page the two share one fetch (fetch-cache.ts).
  type SetGradesAsk = { key: string; anchorUrn: string; urns: string[]; stage: "ks4" | "ks5"; subject: string };
  const [setGradesAsk, setSetGradesAsk] = useState<SetGradesAsk | null>(null);
  const [setGrades, setSetGrades] = useState<{ key: string; rows: Record<string, SubjectGradeCount[]> | null } | null>(null);
  useEffect(() => {
    if (!setGradesAsk) return;
    let cancelled = false;
    (async () => {
      const rows = await fetchComparatorGrades(supabase, setGradesAsk.anchorUrn, setGradesAsk.urns, setGradesAsk.stage, setGradesAsk.subject);
      if (!cancelled) setSetGrades({ key: setGradesAsk.key, rows });
    })();
    return () => {
      cancelled = true;
    };
  }, [setGradesAsk, supabase]);

  if (loading) return embed ? <EmbedStatus text="Loading…" /> : <main className="mx-auto max-w-4xl p-6"><ViewAsBanner plain /><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (embed && (error || !phase)) return <EmbedStatus text={error ?? "Unknown phase."} />;
  if (error || !phase) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-sm text-amber-700 dark:text-amber-400">{error ?? "Unknown phase."}</p>
        {signedOut && (
          <Link href="/login" className="mr-4 mt-3 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400">Log in</Link>
        )}
        <Link href="/teacher" className="mt-3 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400">Back</Link>
      </main>
    );
  }

  const q = PHASE_QUESTIONS[phase];
  // The subject in focus: the teacher's choice while it is still ticked, otherwise the
  // first ticked subject. null only when nothing is ticked at all -- a real empty state
  // every column already has its own "Pick a subject" text for.
  const focusKey = tickedItems.some((i) => i.key === chosenFocusKey) ? chosenFocusKey : tickedItems[0]?.key ?? null;
  const nearbyOnly = neighbours.filter((n) => !n.isTarget);

  // §13's "this moved": surfaced on the card rather than waiting for someone to notice.
  // Thresholds are measured from real national variation, not invented -- see
  // teacher-view-this-moved.ts for the distributions behind them.
  const candidateSeries = (() => {
    const byPeriod = new Map<number, number>();
    for (const e of entries) byPeriod.set(e.period, (byPeriod.get(e.period) ?? 0) + e.entries);
    const periods = Array.from(byPeriod.keys()).sort((a, b) => a - b);
    return periods.length >= 2
      ? { prev: byPeriod.get(periods[periods.length - 2]) ?? null, latest: byPeriod.get(periods[periods.length - 1]) ?? null, label: String(periods[periods.length - 1]) }
      : null;
  })();
  const movedCandidates = candidateSeries
    ? candidatesMoved(candidateSeries.prev, candidateSeries.latest, candidateSeries.label)
    : null;

  // §13's other half, on the Results card. Measured across the subjects this person
  // actually teaches rather than the whole school: a headline that moved because a
  // department they have nothing to do with moved is not "this moved" for them.
  // Both years must be computed over the SAME subject set, or a subject appearing or
  // disappearing between years reads as a results swing that never happened.
  const movedResults = (() => {
    if (tickedItems.length === 0) return null;
    // Each ticked item's own rows, once each: at GCSE two items in one subject share its
    // single row, so the set keeps it from counting twice.
    const rows = Array.from(new Set(tickedItems.flatMap(ownRowsFor))).filter((h) => h.avgPointScore !== null);
    const periods = Array.from(new Set(rows.map((r) => r.period))).sort((a, b) => a - b);
    if (periods.length < 2) return null;
    const [prevP, lastP] = [periods[periods.length - 2], periods[periods.length - 1]];
    const mean = (p: number) => {
      const vals = rows.filter((r) => r.period === p).map((r) => r.avgPointScore!);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return resultsMoved(mean(prevP), mean(lastP), String(lastP));
  })();


  // One mapping from the school's subject items to the picker's rows, shared by onboarding
  // step 2 and the dashboard's quick edit, so the two can never disagree (the QuickEdit
  // mockup: "kept identical so quick-edit and onboarding never disagree").
  const familyOfItem = (ph: "ks4" | "ks5", i: SubjectItem) => qualificationFamilyOf(ph, i.qualificationType);
  const toPickerItems = (ph: "ks4" | "ks5", list: SubjectItem[]) =>
    list.map((i) => ({
      key: i.key,
      // By subject name, as the mockup lists them -- unless the same subject sits under
      // two qualifications in one tab (a BTEC Diploma and Extended Certificate in Art and
      // Design, say), where the rows would otherwise look like duplicates; those name
      // their qualification too.
      label: items.some((o) => o.key !== i.key && o.subject === i.subject && familyOfItem(ph, o) === familyOfItem(ph, i))
        ? `${i.subject} (${shortQualificationLabel(i.qualificationType)})`
        : i.subject,
      entries: i.entries,
      familyId: familyOfItem(ph, i),
      category: familyFor(headline, i.subject),
    }));

  // KS2 keeps its own walkthrough: every pupil sits the same tests, so there are no
  // qualifications or subjects to pick, and the four-step mockup flow has nothing to show.
  if (!onboarded && phase === "ks2") {
    const headings = [
      phase === "ks2" ? q.howMany : "Which subjects do you teach?",
      q.howWell,
      q.nearMe,
      q.wider,
    ];
    return (
      <main className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{PHASE_LABELS[phase]} · step {step + 1} of 4</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{headings[step]}</h1>

        {step === 0 && (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Every pupil sits the same tests, so there is nothing to pick here. Your Year 6 cohort is{" "}
            <strong className="tabular-nums">{rollAtAge10?.toLocaleString() ?? "not published"}</strong>.
          </p>
        )}
        {step > 0 && (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {step === 1 && "Each subject's headline result, always shown next to something to read it against."}
            {step === 2 && "How the subjects you teach sit alongside everything else the school offers."}
            {step === 3 && "And how your school compares with other schools, not just with itself."}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">Back</button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (step < 3) { setStep(step + 1); return; }
              if (schoolUrn && await completeOnboarding(supabase, schoolUrn, phase)) setOnboarded(true);
            }}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            {step < 3 ? "Next" : "Open my dashboard"}
          </button>
        </div>
      </main>
    );
  }

  // GCSE and Post-16 onboarding: the mockups' four steps (GCSE/Post16-Step1..4.dc.html).
  //   1. which qualification families -- tiles, from real data;
  //   2. which subjects -- tabbed by those families, grouped by real subject category;
  //   3. how they do -- a live preview built from the dashboard's own Results
  //      computation (resultsFor/englandFor above), so the two can never disagree;
  //   4. what you get -- the four views, with the dashboard's own column icons.
  if (!onboarded) {
    const ph = phase as "ks4" | "ks5";
    const accentHex = accentFor(ph).hex;
    const familyOf = (i: SubjectItem) => qualificationFamilyOf(ph, i.qualificationType);
    const present = QUALIFICATION_FAMILIES[ph].filter((f) => items.some((i) => familyOf(i) === f.id));
    const selectedFamilies = qualSelection ?? present.map((f) => f.id);
    const subjectCounts = Object.fromEntries(present.map((f) => [f.id, items.filter((i) => familyOf(i) === f.id).length]));
    const familyById = new Map(QUALIFICATION_FAMILIES[ph].map((f) => [f.id, f]));

    // Unticking a family also unticks its subjects: otherwise they would stay saved,
    // hidden from step 2, and quietly reappear on the dashboard.
    const toggleFamily = (id: string) => {
      if (selectedFamilies.includes(id)) {
        setQualSelection(selectedFamilies.filter((f) => f !== id));
        const drop = new Set(items.filter((i) => familyOf(i) === id).map((i) => i.key));
        if (ticked.some((k) => drop.has(k))) persist(ticked.filter((k) => !drop.has(k)));
      } else {
        setQualSelection([...selectedFamilies, id]);
      }
    };

    const steps = [
      { heading: "Which qualifications do you teach?", intro: "Tick the ones you teach. The next step will only show subjects that exist under these — everything else follows from this.", next: "Next — choose your subjects" },
      { heading: "Which subjects do you teach?", intro: "Grouped by category. Choose a qualification type, then tick what you teach — across as many categories as you like.", next: "Next — see your results" },
      {
        heading: "How well do they do?",
        intro: ph === "ks4"
          ? "Average points per entry for what you ticked, against the England GCSE average for each subject. Each qualification is shown on its own — never blended into one."
          : "Average points per entry for what you ticked, against the England average for the same qualification. Each qualification is shown on its own — never blended into one.",
        next: "Next — the views you'll get",
      },
      { heading: "Here's what you can look at", intro: "For every subject you ticked, four ways to see it.", next: `Done — take me to ${PHASE_LABELS[phase]}` },
    ];
    const current = steps[step];
    // DfE points scales: GCSE grades 9-1; post-16 points per entry top out at 60 (A*).
    const scaleMax = ph === "ks4" ? 9 : 60;

    return (
      <main
        id="teacher-root"
        data-theme={theme}
        style={{ "--accent": accentHex, "--accent-rgb": accentFor(ph).rgb } as React.CSSProperties}
        // w-full: the root layout's <body> is a flex column, where a mx-auto child sizes to
        // its content; this pins onboarding to the screen width instead.
        className="mx-auto flex w-full max-w-2xl flex-col gap-4 bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6"
      >
        <ViewAsBanner className="" />
        {step === 0 ? (
          <Link href="/teacher" className="w-fit text-[12.5px] text-[var(--muted)]">&larr; Back</Link>
        ) : (
          <button type="button" onClick={() => setStep(step - 1)} className="w-fit text-[12.5px] text-[var(--muted)]">&larr; Back</button>
        )}
        <div>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
            {PHASE_LABELS[phase]} &middot; Step {step + 1} of 4
          </p>
          <h1 className="mt-1.5 text-xl font-bold leading-tight">{current.heading}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted2)]">{current.intro}</p>
        </div>

        {step === 0 && (
          present.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No subject entries recorded for this school.</p>
          ) : (
            <QualificationFamilyTiles phase={ph} families={present} selected={selectedFamilies} onToggle={toggleFamily} subjectCounts={subjectCounts} />
          )
        )}

        {step === 1 && (
          <>
            {/* §6/§14's live count: ticking a subject moves a real number immediately. */}
            <p className="text-[13px] text-[var(--muted2)]">
              <span className="text-2xl font-bold tabular-nums text-[var(--fg)]">{liveCount.toLocaleString()}</span>{" "}
              {liveCount === 1 ? "entry" : "entries"} across {tickedItems.length} subject{tickedItems.length === 1 ? "" : "s"} ticked
            </p>
            <CategorySubjectPicker
              families={present.filter((f) => selectedFamilies.includes(f.id))}
              items={toPickerItems(ph, items.filter((i) => selectedFamilies.includes(familyOf(i))))}
              ticked={ticked}
              onToggle={toggle}
              onSetTicked={persist}
              theme={theme}
            />
          </>
        )}

        {step === 2 && (
          tickedItems.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing ticked yet — go back a step to choose your subjects.</p>
          ) : (
            <>
              {/* Legend: a swatch per ticked family, and the England-average tick mark. */}
              <div className="flex flex-wrap items-center gap-3.5 text-[11.5px] text-[var(--muted2)]">
                {Array.from(new Set(tickedItems.map(familyOf))).map((fid) => (
                  <span key={fid} className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-3 rounded-[3px]" style={{ background: familyById.get(fid)?.hex }} />
                    {familyById.get(fid)?.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-0.5 bg-[var(--fg)]" />
                  England average
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {tickedItems.map((i) => {
                  const fam = familyById.get(familyOf(i));
                  const score = resultsFor(i);
                  const england = score ? englandFor(i, score) : null;
                  const delta = score && england !== null ? score.value - england : null;
                  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;
                  return (
                    <div key={i.key} className="flex items-start gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3.5">
                      <span
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                        style={{ background: `rgba(${fam?.rgb},0.14)`, color: fam?.hex }}
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          {COLUMN_ICON_PATHS.results}
                        </svg>
                      </span>
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-baseline justify-between gap-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[14.5px] font-bold">{i.subject}</p>
                            <p className="mt-px text-[11px] text-[var(--muted3)]">{qualificationShortLabel(ph, i.qualificationType)}</p>
                          </div>
                          <p className="shrink-0 text-xl font-extrabold tabular-nums" style={{ color: score ? fam?.hex : "var(--muted3)" }}>
                            {score ? score.value.toFixed(1) : "—"}
                          </p>
                        </div>
                        {score && (
                          <div className="relative mt-2.5 h-1.5 rounded-[3px] bg-[var(--panel-border)]">
                            <div className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: pos(score.value), background: fam?.hex }} />
                            {england !== null && <div className="absolute -top-[3px] h-3 w-0.5 bg-[var(--fg)]" style={{ left: pos(england) }} />}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-[var(--muted2)]">
                          {!score
                            ? "No published points score for this qualification."
                            : delta === null
                              ? "No England average published for the same year."
                              : `${Math.abs(delta).toFixed(1)} points ${delta >= 0 ? "above" : "below"} the England ${ph === "ks4" ? "GCSE average for this subject" : "average for this qualification"}.`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2.5">
            {([
              ["candidates", "Candidates", q.howMany],
              ["results", "Results", q.howWell],
              ["context", "School Context", q.nearMe],
              // §6.2: UI copy only. The ColumnId, the note key and the module all stay
              // "rankings"; only what a person reads changes.
              ["rankings", "Comparisons", q.wider],
            ] as const).map(([id, title, question]) => (
              <div key={id} className="flex items-center gap-3 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--accent-rgb),0.14)] text-[var(--accent)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {COLUMN_ICON_PATHS[id]}
                  </svg>
                </span>
                <div className="min-w-0 flex-grow">
                  <p className="text-[15px] font-bold">{title}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--muted2)]">{question}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={step === 0 && selectedFamilies.length === 0}
          onClick={async () => {
            if (step < 3) { setStep(step + 1); window.scrollTo(0, 0); return; }
            if (schoolUrn && await completeOnboarding(supabase, schoolUrn, phase)) setOnboarded(true);
          }}
          // Mockup: full-width, accent fill, dark text in the accent's own deep tone.
          className="mt-2 rounded-[10px] bg-[var(--accent)] p-[13px] text-center text-[14.5px] font-bold disabled:opacity-40"
          style={{ color: ph === "ks4" ? "#052e1c" : "#1a1030" }}
        >
          {current.next}
        </button>
      </main>
    );
  }

  const formatHeadline = (v: number) => (phase === "ks2" ? `${Math.round(v)}%` : v.toFixed(1));

  // The Rankings map's subject chips, at the grain the data really has:
  //   - KS4: one chip per ticked SUBJECT. A KS4 subject has one row per school and year,
  //     entries and points already merged across its qualification types, so a subject
  //     ticked under GCSE and a Cambridge National is still one series. The qualifications
  //     are named on the chip for the teacher's own context; they select nothing.
  //   - KS5: one chip per ticked (subject, bucket). Each bucket is a real, separate row
  //     there, so A-level and BTEC Geography are two series and two chips.
  // Coloured by qualification family (QUALIFICATION_FAMILIES), as onboarding colours
  // them. KS2 has no subjects, so no chips.
  // familyId: the subject's real category, which colours the map's dots (a Biology map
  // takes Sciences & Maths' ramp, History Humanities' amber). The chip itself keeps its
  // qualification colour.
  const mapChips: MapChip[] = [];
  if (phase !== "ks2") {
    const ph = phase;
    for (const i of tickedItems) {
      const bucket = ph === "ks5" ? comparabilityKey(ph, i.qualificationType) : null;
      const key = `${i.subject}|${bucket ?? "all"}`;
      const qual = qualificationShortLabel(ph, i.qualificationType);
      const existing = mapChips.find((c) => c.key === key);
      if (existing) {
        if (!existing.label.includes(qual)) existing.label += `, ${qual}`;
        continue;
      }
      const fam = QUALIFICATION_FAMILIES[ph].find((f) => f.id === qualificationFamilyOf(ph, i.qualificationType));
      mapChips.push({
        key,
        subject: i.subject,
        bucket,
        label: `${i.subject} · ${qual}`,
        legend: ph === "ks5" ? `${i.subject} (${qual})` : i.subject,
        hex: fam?.hex ?? "var(--muted)",
        familyId: familyFor(headline, i.subject)?.id ?? null,
      });
    }
  }
  // null = compare on the whole-school headline. Round 7 §9 made this one selection for
  // the whole Comparisons column rather than the map alone, so it needs an explicit
  // "no subject" state; without one, picking Whole school fell straight back to the first
  // chip. Defaulting to the first ticked subject is the Map's own existing behaviour,
  // kept so the chips mean the same thing they always did.
  // Round 8 §3: driven by the shared focus subject rather than its own chip state. The
  // two are keyed differently -- chips by subject|bucket, the ticked list by
  // subject::qualification -- so the focus resolves through the subject it names.
  const focusItem = tickedItems.find((i) => i.key === focusKey) ?? null;
  const activeMapChip = focusItem
    ? mapChips.find(
        (c) => c.subject === focusItem.subject && (phase !== "ks5" || c.bucket === comparabilityKey(phase, focusItem.qualificationType)),
      ) ?? null
    : null;

  // Round 6 (card content rebuild): the mockups' visual layer. Colour is per qualification
  // group, shared by the chip header, the Candidates bars, the Results scores and the pie.
  const accent = PHASE_ACCENT[phase];
  const groupColour = colourByGroup(phase, tickedItems);
  const colourOf = (i: SubjectItem) => groupColour.get(comparabilityKey(phase, i.qualificationType)) ?? "var(--muted)";
  const latestPeriod = entries.length ? Math.max(...entries.map((e) => e.period)) : null;

  // The comparability bucket, which the short labels use to tell same-named subjects apart.
  const bucketOf = (i: SubjectItem): string | null => (phase === "ks5" ? comparabilityKey(phase, i.qualificationType) : null);

  // Round 6: the per-subject series the Results and Context panels plot. One value per
  // ticked subject per published year, read from the SAME own rows (ownRowsFor) the card
  // already used for its latest-year figure -- grouped by period rather than collapsed to
  // the last one. Nothing is derived a second way, so the panels and the old headline
  // figure can never disagree.
  const headlineRowsFor = (i: SubjectItem, period: number) => ownRowsFor(i).filter((h) => h.period === period);

  // At KS4 only "GCSE (9-1) Full Course" carries points, and headline rows there are keyed
  // by subject alone -- so without this gate an OCR or BTEC row for the same subject shows
  // the GCSE score as its own. The same guard resultsFor already applies.
  const pointsAt = (i: SubjectItem, period: number): number | null => subjectPointsAt(phase, i, headlineRowsFor(i, period));

  const entriesAt = (i: SubjectItem, period: number): number | null => subjectEntriesAt(headlineRowsFor(i, period));

  // Every period any ticked subject has a headline row for, ascending -- the real range
  // §6.3 requires, not a constant.
  const subjectPeriods = Array.from(
    new Set(headline.filter((h) => tickedItems.some((i) => i.subject === h.subject)).map((h) => h.period)),
  ).sort((a, b) => a - b);

  // Step 8: one shared shortener (curated table, then fallback, then a collision check
  // over everything shown together) replaces the old "first four letters + ." copies.
  const shortLabelsFor = (list: SubjectItem[]) =>
    shortSubjectLabels(
      list.map((i) => ({ key: i.key, subject: i.subject, bucket: bucketOf(i), detail: qualificationShortLabel(phase, i.qualificationType) })),
    );
  // "Nearest 10 schools" -> "Nearest 10 Schools", for the tags that name a set or group.
  const titleCase = (label: string) => label.replace(/\b([a-z])/g, (m) => m.toUpperCase());

  // The England anchor for the same subject and the same year (englandFor's own rule,
  // applied per period rather than only to the latest one).
  const englandAt = (i: SubjectItem, period: number): number | null => englandValue(i, period);

  // Round 8 §3: the one Candidates/Results toggle, driving all three columns. Persisted
  // like every other "which data" choice (round 6's rule: coming back to a card showing a
  // DIFFERENT NUMBER is disorienting in a way a different chart shape is not), under a key
  // that cannot collide with a column id.
  const SHARED_MEASURE_KEY = measureKey("shared");
  const sharedMeasure: SharedMeasure = readSetting(columns, SHARED_MEASURE_KEY) === "results" ? "results" : "candidates";
  const showingResults = sharedMeasure === "results";

  // §6.5: the threshold measure, computed from the real per-grade rows already in the
  // payload. Scoped to this subject AND this qualification type -- the grade rows carry
  // their own qualificationType, so a GCSE and a Cambridge National in the same subject
  // are scored separately rather than pooled into a rate belonging to neither.
  const thresholdAt = (i: SubjectItem, period: number): number | null => subjectThresholdAt(gradeRows, i, period, phase);

  // Which measure Results' three panels are pointed at. Persisted per column, so the card
  // comes back showing the figure it was left showing.
  const resultsMeasures = measuresFor(phase);
  const resultsMeasure = measureById(phase, readSetting(columns, measureKey("results")) ?? resultsMeasures[0].id);
  const usingThreshold = resultsMeasure.id === "threshold";

  // Grade bands frontend round: the share of a subject's graded entries inside a range the
  // teacher picks on the FOCUSED subject's own scale. One range, saved like the measure
  // (BAND_RANGE_KEY), read by Column 1, Comparisons and Context alike. It is kept only
  // while both ends are grades on the focused subject's scale; otherwise the scale's
  // preset (7-9, GCSE 9-1 only) or no range at all -- never an invented default band.
  const usingBands = resultsMeasure.id === "bands";
  const BAND_RANGE_KEY = "band:range";
  const focusGradeRows = focusItem
    ? gradeRows.filter((g) => g.subject === focusItem.subject && g.qualificationType === focusItem.qualificationType)
    : [];
  // 0.6.2 S2: the scale is still read from the 2023/24-on rows only, as before the grade rows
  // reached back to 2021/22, so the range and every latest-year band figure stay as they were.
  // (Four years would read some small GCSE cohorts with no 8 or 9 since 2023/24 as GCSE
  // rather than IB 7-1, and so give them a band figure: a latest-year change, logged for Guy.)
  // 0.6.3 S3: from the focus's qualification type first (a T Level is on the T Level scale).
  const focusScale = scaleForQualification(focusItem?.qualificationType ?? "", focusGradeRows.filter((g) => g.period >= MODERN_GRADE_FROM).map((g) => g.grade));
  // 0.6.1 S5 (D3): the range is chosen in the top bar (ResultsControl: the scale's presets,
  // or Custom's from / to), no longer by clicking two grades in the Grades view.
  const bandRange: GradeRange | null = bandRangeFor(focusScale, null, readSetting(columns, BAND_RANGE_KEY));
  const bandLabel = bandRange ? rangeLabel(bandRange) : null;
  const saveBand = (top: string, bottom: string) => {
    void setColumnSetting(BAND_RANGE_KEY, JSON.stringify({ top, bottom }));
  };
  const bandAt = (i: SubjectItem, period: number): number | null => subjectBandAt(gradeRows, i, period, bandRange);

  // 0.6.3 S1 (R-COUNTS-SELECTION): Grade counts' selection -- click one grade or a range in
  // Column 1's Current -- IS the band:range setting the top bar's Grades control writes: one
  // setting, two ways in, the same saved key and format. On Grade counts it is read without
  // Grade bands' 7-9 preset (savedSelection): nothing is selected until the member picks.
  // Context and Comparisons follow it through the band machinery (bandRate, comparator
  // grades) and show a prompt until there is one, instead of falling back to points.
  const usingCounts = resultsMeasure.id === "counts";
  const countsRange: GradeRange | null = usingCounts && focusItem ? savedSelection(focusScale, readSetting(columns, BAND_RANGE_KEY)) : null;
  const saveSelection = (next: Selection | null) => {
    void setColumnSetting(BAND_RANGE_KEY, next ? JSON.stringify({ top: next.top, bottom: next.bottom }) : null);
  };
  // The range Context and Comparisons are scored on: Grade bands' range, or the counts selection.
  const columnsRange: GradeRange | null = usingCounts ? countsRange : bandRange;
  const columnsRangeLabel = columnsRange ? rangeLabel(columnsRange) : null;
  // Before any selection, Columns 2 and 3 ask for one (no silent points fallback).
  const countsPrompt = showingResults && usingCounts && !!focusItem && !countsRange;
  // R-MIN-ENTRIES: a selection's share at one subject or school needs MINIMUM_SUBJECT_N graded
  // entries (the Data View's small-cohort bar); fewer reads as "too few entries", not a %.
  const selectionRateOf = (rows: SubjectGradeCount[]): number | null => {
    if (!countsRange) return null;
    const out = bandRate(rows, countsRange);
    return out && out.entries >= MINIMUM_SUBJECT_N ? out.rate : null;
  };
  // The measure Context and Comparisons show on a counts selection: Grade bands' share, named
  // for the selection ("Share at grade 9").
  const countsSelectionMeasure: Measure | null = countsRange
    ? { ...measureById(phase, "bands"), label: `Share at ${inlineRangeLabel(rangeLabel(countsRange))}`, noun: `share of entries at ${inlineRangeLabel(rangeLabel(countsRange))}` }
    : null;
  // The chip on Columns 2 and 3's titles, back to Column 1 ("Grade 9 · from your highlight").
  const selectionChip = countsRange
    ? { label: selectionChipLabel(countsRange), onJump: () => showColumn(0, '[data-column-id] [data-panel-id$=".current"]') }
    : null;
  // Grade rows exist from 2021/22 (0.6.2; 2023/24 before); on Grade bands the axis is the years that have them.
  const hasGrades = (i: SubjectItem, period: number) => hasGradesAt(gradeRows, i, period);
  // The measure as Grade bands' panels read it: its noun narrowed to the span.
  const resultsMeasureShown = usingBands && bandLabel ? { ...resultsMeasure, noun: `share of entries at ${inlineRangeLabel(bandLabel)}` } : resultsMeasure;

  const valueForResults = (i: SubjectItem, period: number) =>
    usingThreshold ? thresholdAt(i, period) : usingBands ? bandAt(i, period) : pointsAt(i, period);

  // ------------------------------------------ Column 1's category (content round S6-S7)
  //
  // Column 1 reads the focused subject against the OTHER subjects this school runs in the
  // same taxonomy category (Maths against the rest of Sciences & Maths), replacing the
  // multi-subject bars S5 removed. The grouping is not new: it is the same familyFor
  // lookup Context's "Other subjects in ..." option used, fixed to the focused subject's
  // category rather than chosen. Members are this school's own (subject, qualification)
  // items, focused subject first, then the rest by entries.
  //
  // Post-16 Part C1: AS level and Advanced Extension Award peers are left out here, BEFORE
  // the subject+bucket dedup below, so an AS row can never be the one a same-subject
  // A-level entry is deduped into, never needs a "(GCE AS level)" suffix to tell it from
  // its A level, and never feeds the category's own average line. They stay selectable in
  // the picker, and a teacher who focuses one directly still gets its own panels: the
  // focused item is never filtered. (R-KS5-ASAEA-EXCL, R-FOCUS-NEVER-FILTERED: categoryItemsOf.)
  // Column 1 qualification match: a peer is also in the focused subject's own qualification
  // family (qualificationFamilyOf -- at Post-16 the display bucket, so A level with A level,
  // never with Core Maths, EPQ or Pre-U in Other). The one rule Column 1's category and
  // Context's Selected subjects (§4c) both read, so the two columns cannot disagree about
  // what counts as the same qualification. Before this, Results left Other-bucket peers
  // out only by accident (they have no points figure) while Candidates drew them. KS2 has
  // no qualifications, so everything matches there.
  const { focusQualFamily, inFocusQualFamily } = focusQualificationFamily(phase, focusItem);
  const focusFamilyLabel = focusItem ? familyLabelFor(headline, focusItem.subject) ?? "its category" : null;
  const categoryItems: SubjectItem[] = categoryItemsOf(focusItem, items, headline, inFocusQualFamily);
  // The peers are context, not the teacher's own subjects, so they take one muted colour
  // and the focused subject keeps its qualification colour.
  const PEER_COLOUR = "var(--muted3)";
  // S7: the England category line gets its own colour so it is not a second grey dash.
  const ENGLAND_COLOUR = "#60a5fa";
  const categoryColour = (i: SubjectItem) => (i.key === focusKey ? colourOf(i) : PEER_COLOUR);

  // Trend/% change redesign step 1: Candidates reads entries from the item's own rows
  // (entriesAt), whose grain is one row per SUBJECT at GCSE -- entries already summed
  // across its qualifications. Two GCSE items in one subject (GCSE and BTEC Art) would
  // otherwise both show Art's whole total, so the category is taken once per row here,
  // focused subject first. Post-16 Part C: there every item has its own exact-qualification
  // row, so nothing is merged -- IB Higher and Standard level Biology are two real bars.
  const candidateItems = candidateItemsOf(categoryItems, phase);
  const candidateShort = shortLabelsFor(candidateItems);

  // Every period any category member has a headline row for.
  const categoryPeriods = Array.from(
    new Set(headline.filter((h) => categoryItems.some((i) => i.subject === h.subject)).map((h) => h.period)),
  ).sort((a, b) => a - b);

  // The periods the ACTIVE measure genuinely covers. The threshold rows only go back to
  // 2023/24 (parseSubjectGradeDistribution's own documented limit), so pointing Results at
  // it shortens the axis rather than drawing four empty years -- §6.5's "state that in the
  // UI rather than padding the range". Computed BEFORE the series, so the values and the
  // periods they are indexed against are always the same list.
  const resultsPeriods = periodsForMeasure(resultsMeasure.id, categoryPeriods, categoryItems, thresholdAt, hasGrades);

  // The threshold measure has no published England figure to sit against -- the national
  // anchor this app holds is points per entry, per subject. So its bars carry no marker
  // and its table's third column falls back to change, rather than a delta against a
  // number nobody published.
  //
  // S7: every member carries its own England marker. Post-16 Part C: at Post-16 too, now
  // that England's figure exists per subject and exact qualification -- A-level Chemistry
  // against England's A-level Chemistry. A qualification with no published points (VRQ,
  // AEA, EPQ and the rest of Other) has no row, so its marker is simply absent.
  const categoryShort = shortLabelsFor(categoryItems);
  const resultsSeries: SubjectSeries[] = keepFocusOrFigured(categoryItems
    .map((i) => ({
      key: i.key,
      label: i.label,
      shortLabel: categoryShort.get(i.key) ?? i.subject,
      colour: categoryColour(i),
      values: resultsPeriods.map((p) => valueForResults(i, p)),
      // Grade bands: SubjectPanels sets the focused subject's own England rate on the span.
      benchmark: hasEnglandPointsBenchmark(resultsMeasure.id) ? resultsPeriods.map((p) => englandAt(i, p)) : undefined,
    })),
    // A peer with no figure at all on this measure (at GCSE, a BTEC or Cambridge National
    // on points) says nothing about the category, so it is left out rather than drawn
    // as an empty row. The focused subject always stays.
    focusKey);

  // S6: the category's own per-subject average, self-inclusive (the convention Context's
  // group and the comparator-set averages already use). S7, points only (both phases since
  // Post-16 Part C): what England scores across the SAME subjects -- the mean of each
  // member's national figure -- so "how this category does here" sits beside "how it does
  // nationally". The threshold measure still has no England figure at either phase.
  const resultsGroups: { label: string; values: (number | null)[]; colour?: string }[] =
    resultsSeries.length < 2
      ? []
      : [
          { label: `${focusFamilyLabel} average`, values: memberMeans(resultsPeriods, resultsSeries) },
          ...(hasEnglandPointsBenchmark(resultsMeasure.id)
            ? [{
                label: `England ${focusFamilyLabel} average`,
                colour: ENGLAND_COLOUR,
                values: resultsPeriods.map((_, pi) => meanOf(resultsSeries.map((r) => r.benchmark?.[pi] ?? null))),
              }]
            : []),
        ];

  // ------------------------------------------------------------------ Context (§4.2)
  //
  // Context's measure is now a genuine per-instance choice rather than the catalogue's
  // fixed `COLUMN_MEASURE.context = entries`. That fixed entry still serves the meetings
  // slide picker, which renders axis views; the dashboard column reads this instead.
  // Round 8 §3: Context reads the SHARED toggle. Its own Candidates/Results pill is gone
  // -- one global toggle replaces two independent per-column ones. On Results it follows
  // Column 1's sub-measure too, so "Results" means the same figure in both columns rather
  // than two columns both claiming to show results while showing different ones.
  // Grade bands frontend round: Context reads Grade bands on the same range as Column 1.
  // Grade counts has no single figure to compare subjects on, and Grade bands has none
  // until a range is picked, so both fall back to average point score here (and say so).
  const contextFallsBack = contextFallsBackFor(showingResults, resultsMeasure.id, !!columnsRange);
  // 0.6.3 S1: on a counts selection Context compares the selection's share; with none, it
  // shows the prompt (the measure below is then not drawn).
  const contextMeasure = usingCounts && countsSelectionMeasure ? countsSelectionMeasure : contextMeasureFor(phase, showingResults, contextFallsBack, resultsMeasureShown);
  // Current panel rework round 1: three groups, and "category" (the focused subject's own
  // subject category) is the default -- nothing saved, or a saved "area" from before S8
  // (which was this same comparison), reads as it. An explicit All or Selected choice stays.
  const savedAgainst = readSetting(columns, againstKey("context"));
  const contextAgainst: CompareAgainstId = savedAgainst === "selected" ? "selected" : savedAgainst === "whole" ? "whole" : "category";
  const contextSelected = readList(columns, chosenKey("context"));


  // Post-16 Part D: the rows Context's group is built from. At GCSE, the subject rows (one
  // per subject per year). At Post-16, the exact-qualification rows WITHOUT AS level and
  // Advanced Extension Award -- not the bucket rows, which came in twice per subject (the
  // whole-subject "all" row beside each bucket's row, so every total was doubled) and
  // which had AS baked into the A-level figure. C1 left AS/AEA out of the subject list;
  // this leaves them out of the figures too.
  // S3b (Part D decision 1): a focused AS or AEA item counts itself into its own group.
  const groupRows = contextGroupRows(phase, headline, qualificationHeadline, focusItem);
  // 0.6.3 S3: at Post-16 on bands and a counts selection, each member's rows keep to the
  // focus's family as well (R-KS5-ASAEA-EXCL still applies first).
  const bandsInFamily = phase === "ks5" && contextMeasure.id === "bands";
  const inGroup = (qualificationType: string, subject: string) =>
    inContextGroup(phase, qualificationType, subject, focusItem) && (!bandsInFamily || onFocusPointsScale(focusQualFamily, qualificationType));

  // One value per SUBJECT NAME per period, for whichever measure is active. Group members
  // are subjects of the whole school, not just the ticked ones, so they are addressed by
  // name rather than by the ticked list's (subject, qualification) key.
  // Post-16: weighted by points-eligible entries; threshold/bands: per qualification, then
  // meaned (R-POINTS-WEIGHTED, R-KS5-ASAEA-EXCL -- see contextGroupValue).
  // R-POINTS-SAME-QUAL (S3b): on Post-16 points each member's value keeps to the focused
  // item's qualification family (focusQualFamily), never A level, BTEC and IB blended.
  const groupInputs = { phase, measureId: contextMeasure.id, groupRows, gradeRows, bandRange: columnsRange, inGroup, focusFamily: focusQualFamily };
  const groupValueFor = (subject: string, period: number): number | null => contextGroupValue(groupInputs, subject, period);

  // §4.2: the group is SELF-INCLUSIVE -- it contains the subject being compared, matching
  // the convention the comparator-set averages already use elsewhere.
  //
  // Post-16 Part C1: a subject this school runs ONLY as AS level or Advanced Extension Award
  // is not a member. Part D: at Post-16 that now follows from groupRows, which has no
  // AS/AEA rows; asOrAeaOnly still guards the "nothing selected yet" fallback below, which
  // starts from the ticked items rather than from the rows. S3b (Part D decision 1): the
  // focused item is the exception -- an AS-only focus counts itself into its own group.
  const asOrAeaOnly = asOrAeaOnlySubjects(items, focusItem);
  //
  // Combined round §4c: "Selected subjects" is chosen within the focused subject's own
  // qualification family -- a comparison set is always with the same qualification -- so
  // the picker offers only that family's subjects (contextOffer), and a key ticked earlier
  // under another family (before this rule, or with a different subject focused) is left
  // out of the group rather than counted invisibly. The same rule as Column 1's category
  // (focusQualFamily above).
  const contextFamily = focusQualFamily;
  const contextFamilyLabel = phase === "ks5" ? QUALIFICATION_FAMILIES.ks5.find((f) => f.id === contextFamily)?.label ?? null : null;
  const inContextFamily = inFocusQualFamily;
  const contextOffer = contextOfferOf(items, inContextFamily);
  // Every subject at the school, by name -- Context's All subjects group.
  const schoolSubjectNames = schoolSubjectNamesOf(groupRows, asOrAeaOnly);
  // Snagging round 1 Part 1: the group is self-inclusive in Selected mode too; nothing
  // ticked yet falls back to the subjects this person teaches (contextMembersOf).
  const contextMembers: string[] = contextMembersOf({
    against: contextAgainst,
    schoolSubjectNames,
    candidateItems,
    contextOffer,
    selected: contextSelected,
    focusItem,
    inFamily: inContextFamily,
    asOrAeaOnly,
    tickedItems,
  });

  // Live review Part B: shown as "All subjects" (the id stays "whole"). This one label feeds
  // the panel tag, the Trend/% change sentences, the benchmark and the donut.
  const contextGroupLabel =
    contextAgainst === "category" ? focusFamilyLabel ?? "Subject category" : contextAgainst === "selected" ? "Selected subjects" : "All subjects";
  // Current panel rework round 1: the same group as a title reads it (the brief's own
  // phrases): the category's name, "all subjects" or "your selected subjects".
  const contextGroupPhrase =
    contextAgainst === "category" ? focusFamilyLabel ?? "its subject category" : contextAgainst === "selected" ? "your selected subjects" : "all subjects";

  // Two different group figures, and they are not interchangeable:
  //   - the TOTAL, which the donut's share is a share of;
  //   - the PER-SUBJECT AVERAGE, which is what a single subject is actually comparable
  //     with, and so what the bar marker, the trend's second line and the % change bar
  //     all use. (The wireframe's own caption flags that it faked this by dividing a flat
  //     school-wide figure by an assumed 24 subjects; here it is the real per-subject
  //     figures, so no assumption is needed.)
  const contextGroupTotals = subjectPeriods.map((p) =>
    combine(contextMembers.map((n) => groupValueFor(n, p)), contextMeasure.aggregate),
  );
  const contextGroupAverage = subjectPeriods.map((p) => meanOf(contextMembers.map((n) => groupValueFor(n, p))));

  const contextValueFor = (i: SubjectItem, period: number): number | null => {
    if (contextMeasure.id === "entries") return entriesAt(i, period);
    if (contextMeasure.id === "points") return pointsAt(i, period);
    if (contextMeasure.id === "bands") return usingCounts ? selectionRateOf(gradeRowsAt(gradeRows, i.subject, i.qualificationType, period)) : bandAt(i, period);
    return thresholdAt(i, period);
  };

  const contextPeriods = periodsForMeasure(contextMeasure.id, subjectPeriods, tickedItems, thresholdAt, hasGrades);

  // Grade bands: Context's donut is the group's own entries inside the range, of all its
  // graded entries -- the whole school's (or the selected subjects') "share at grades 7-9"
  // -- per (subject, qualification) through bandRate, so a qualification on another scale
  // adds to neither side. Self-inclusive, as the group always is.
  const contextBandShare = (period: number): { met: number; entries: number } | null =>
    contextBandShareAt(contextMembers, gradeRows, period, columnsRange, inGroup);
  const atContextPeriod = (values: (number | null)[]) =>
    contextPeriods.map((p) => values[subjectPeriods.indexOf(p)] ?? null);

  // Round 2 §5: every subject this school has, not just the focused one, so Current's bar
  // and table views show the whole school with the focused subject picked out (Trend and
  // the donut still follow the focused subject alone). The population is the same one
  // Column 1's category draws from -- this school's own items -- without the category
  // filter. A subject with no figure on the active measure (a BTEC on points at GCSE) is
  // left out, as in Column 1; the focused subject always stays.
  // Trend redesign step 9: with "Selected subjects" chosen, Context's subjects are the
  // selected set (the same contextMembers its group average is built from), plus the
  // focused subject -- a bounded, hand-picked list, drawn like Column 1's category. With
  // "Whole school" they are every subject the school has (round 2 part 5).
  // Current panel rework round 1: with "Subject category" the subjects are exactly the list
  // Column 1 draws -- candidateItems, focused subject first -- not a second derivation.
  // R-POINTS-SAME-QUAL (S3b): on Post-16 points, All subjects keeps to the focus's family too.
  const contextKeepsFamily = contextKeepsToFamily(phase, contextMeasure.id);
  const contextItems = contextItemsOf({
    focusItem,
    against: contextAgainst,
    candidateItems,
    items,
    contextMembers,
    inFamily: inContextFamily,
    keepToFamily: contextKeepsFamily,
  });
  const contextShort = shortLabelsFor(contextItems);
  const contextSeries: SubjectSeries[] = keepFocusOrFigured(contextItems
    .map((i) => ({
      key: i.key,
      label: i.label,
      shortLabel: contextShort.get(i.key) ?? i.subject,
      colour: i.key === focusKey ? colourOf(i) : PEER_COLOUR,
      values: contextPeriods.map((p) => contextValueFor(i, p)),
      benchmark: atContextPeriod(contextGroupAverage),
    })), focusKey);

  // ------------------------------------------------------------- Comparisons (§4.3)
  //
  // Comparator dropdown round: the "Compared against" pill shows ONE thing -- what is
  // selected -- and hands every change to the comparator chooser, as Context's pill does
  // with its picker. The chooser's hub already lists every saved, school and Victoria
  // Consultancy set, so the pill no longer repeats them, and the old presets (the
  // dashboard route's Nearest 10 / Same sector / Local rivals / Similar-sized) are
  // mothballed: still built by the route, offered nowhere.
  const comparisonsSet: string = storedSaved === "no" ? CHOOSER_SET_ID : storedSet!;
  const activeSavedSet = (savedSets?.sets ?? []).find((set) => savedSetKey(set.id) === comparisonsSet) ?? null;
  const activeSetLabel = activeSavedSet ? activeSavedSet.name : storedSaved === "pending" ? "Loading…" : chooserChoice ? chooserChoice.label : DEFAULT_CHOICE_LABEL;
  const activeSetOption: SetOption =
    activeSavedSet
      ? {
          id: comparisonsSet,
          label: activeSavedSet.name,
          group: activeSavedSet.vc ? "vc" : activeSavedSet.mine ? "mine" : "shared",
          meta: `${activeSavedSet.members.length} school${activeSavedSet.members.length === 1 ? "" : "s"}`,
          editable: activeSavedSet.editable,
        }
      : { id: comparisonsSet, label: activeSetLabel };


  // Round 7 §9: when a subject chip is active, every Comparisons view reads that
  // subject's real per-school figures instead of the whole-school headline. The data is
  // the one the Map has been using all along (mapProfiles' own per-subject rows), which
  // is why §6.7's "comparator data is whole-school only" was wrong -- the Map disproved
  // it. Nothing new is fetched here; subjectYearsFor reads the profiles already loaded.
  const comparatorSubjectSeries: Record<string, SchoolSeries> = {};
  if (activeMapChip && mapProfiles) {
    for (const profile of mapProfiles) {
      const rows = subjectYearsFor(profile, phase, activeMapChip.subject, activeMapChip.bucket);
      comparatorSubjectSeries[profile.urn] = {
        results: rows
          .filter((r) => r.avgPointScore !== null)
          .map((r) => ({ period: r.period, value: r.avgPointScore as number })),
        candidates: rows
          .filter((r) => r.entriesTotal !== null && r.entriesTotal !== undefined)
          .map((r) => ({ period: r.period, value: r.entriesTotal })),
      };
    }
  }

  // 0.6.1 S3c: "Add an average" (an average of things not drawn) on a subject column, for a
  // view of its own under views=v2 -- built only when such a view asks, so nothing here runs
  // for a page of presets. At this school: a group of the school's subjects as Context's pill
  // draws it (contextItemsOf: the category, every subject, the selected ones, on Post-16
  // points within the focus's family), each subject's figure on the column's measure, with
  // its entries as the weights. Across schools: the page's Compared against set, from the
  // comparator profiles already loaded (their points and entries; never a ranking's sample,
  // R-RANKING-SAMPLE). Aligned to the column's periods.
  const schoolGroupOn = (measureId: MeasureId, valueAt: (i: SubjectItem, period: number) => number | null, periods: number[]) =>
    (kind: "category" | "allSubjects" | "selectedSubjects") => {
      if (!focusItem) return null;
      const against = kind === "category" ? "category" : kind === "allSubjects" ? "whole" : "selected";
      const members =
        kind === "selectedSubjects" && contextAgainst !== "selected"
          ? contextMembersOf({ against: "selected", schoolSubjectNames, candidateItems, contextOffer, selected: contextSelected, focusItem, inFamily: inContextFamily, asOrAeaOnly, tickedItems })
          : contextMembers;
      const its = contextItemsOf({ focusItem, against, candidateItems, items, contextMembers: members, inFamily: inContextFamily, keepToFamily: contextKeepsToFamily(phase, measureId) });
      return {
        label: kind === "category" ? focusFamilyLabel ?? "Subject category" : kind === "allSubjects" ? "All subjects" : "Selected subjects",
        members: keepFocusOrFigured(its.map((i) => ({ key: i.key, values: periods.map((p) => valueAt(i, p)), counts: periods.map((p) => entriesAt(i, p)) })), focusKey),
      };
    };
  const schoolSetOn = (figure: "results" | "candidates", periods: number[]) => () => {
    if (!activeMapChip || !mapProfiles) return null;
    if (comparisonsSet === CHOOSER_SET_ID && chooserChoice?.kind === "ranking") return null;
    const others = (allComparatorSets[comparisonsSet] ?? []).filter((s) => !s.isTarget && s.urn !== schoolUrn);
    const at = (rows: { period: number; value: number }[] | undefined, p: number) => rows?.find((r) => r.period === p)?.value ?? null;
    return {
      label: activeSetLabel,
      schools: others.map((s) => {
        const series = comparatorSubjectSeries[s.urn];
        return { key: s.urn, values: periods.map((p) => at(series?.[figure], p)), counts: periods.map((p) => at(series?.candidates, p)) };
      }),
    };
  };

  // 0.6.2 S3: "Add an average" across schools on Grade 4+, bands and counts in a subject
  // column -- the Compared-against set's other schools' own grade rows for the focused subject
  // AND qualification (R-COMPARATOR-RATE-PER-QUAL), the same rows Comparisons scores. Asked for
  // only when a view reads it (the ask is queued, not set, during render); null while loading.
  // Not for a national / regional ranking set: its schools are a sample (R-RANKING-SAMPLE).
  const setGradeRowsFor = (): FrameSetGrades | null => {
    if (!focusItem || !schoolUrn || (phase !== "ks4" && phase !== "ks5")) return null;
    if (comparisonsSet === CHOOSER_SET_ID && chooserChoice?.kind === "ranking") return null;
    const all = allComparatorSets[comparisonsSet] ?? [];
    const others = all.filter((s) => !s.isTarget && s.urn !== schoolUrn);
    if (!others.length) return null;
    // Comparisons' own request, to the letter (its gradeUrns), so the two share one fetch.
    const urns = all.map((s) => s.urn).sort();
    const key = `${phase}|${focusItem.subject}|${urns.join(",")}`;
    if (setGrades?.key !== key) {
      const ask = { key, anchorUrn: schoolUrn, urns, stage: phase, subject: focusItem.subject };
      if (setGradesAsk?.key !== key) queueMicrotask(() => setSetGradesAsk((cur) => (cur?.key === key ? cur : ask)));
      return null;
    }
    if (!setGrades.rows) return null;
    const mine = (urn: string) =>
      (setGrades.rows?.[urn] ?? [])
        .filter((g) => g.subject === focusItem.subject && g.qualificationType === focusItem.qualificationType)
        .map((g) => ({ period: g.period, grade: g.grade, entries: g.entries }));
    return { label: activeSetLabel, schools: others.map((s) => ({ urn: s.urn, rows: mine(s.urn) })) };
  };
  // A year line across schools on Grade 4+ / bands: each school's rate per period, scored by
  // the page's own rate function on the page's range, weighted (if asked) by its graded entries.
  const schoolSetGradesOn = (periods: number[], onBands: boolean, range: GradeRange | null = bandRange) => () => {
    const g = setGradeRowsFor();
    if (!g) return null;
    const rateOf = gradeRateScorer(onBands, range, phase);
    const inYear = (rows: FrameSetGrades["schools"][number]["rows"], p: number) => rows.filter((r) => r.period === p);
    return {
      label: g.label,
      schools: g.schools.map((sc) => ({
        key: sc.urn,
        values: periods.map((p) => {
          const rows = inYear(sc.rows, p);
          return rows.length ? rateOf(rows.map((r) => ({ ...r, subject: focusItem!.subject, qualificationType: focusItem!.qualificationType, sizeWeight: null }))) : null;
        }),
        counts: periods.map((p) => inYear(sc.rows, p).filter((r) => !NON_GRADE_VALUES.has(r.grade)).reduce((a, r) => a + r.entries, 0) || null),
      })),
    };
  };

  // 0.6.3 S2: Column 1 Results' Trend map -- the focused subject at each school in the
  // Compared-against set, on Results' selected measure: points from the map profiles' own
  // subject rows (as Comparisons reads them), a rate from each school's grade rows for the
  // subject and qualification (Comparisons' own fetch, setGradeRowsFor), scored by the
  // page's own rate function; the school's own from its own grade rows.
  const column1MapSeries = (): MapSeries | null => {
    if (!focusItem || !schoolUrn || !activeMapChip) return null;
    const set = allComparatorSets[comparisonsSet] ?? [];
    const urns = Array.from(new Set([schoolUrn, ...set.map((sc) => sc.urn)]));
    const onRate = usingThreshold || (usingBands && !!bandRange);
    const measure = resultsMeasureShown;
    const graded = (rows: { grade: string; entries: number }[]) => rows.filter((r) => !NON_GRADE_VALUES.has(r.grade)).reduce((a, r) => a + r.entries, 0) || null;
    let perUrn: Record<string, { period: number; value: number | null; entries: number | null }[]> = {};
    if (onRate) {
      const g = setGradeRowsFor();
      const rateOf = gradeRateScorer(usingBands, bandRange, phase);
      const ownPeriods = Array.from(new Set(gradeRows.filter((r) => r.subject === focusItem.subject && r.qualificationType === focusItem.qualificationType).map((r) => r.period)));
      perUrn[schoolUrn] = ownPeriods.map((p) => {
        const rows = gradeRowsAt(gradeRows, focusItem.subject, focusItem.qualificationType, p);
        return { period: p, value: rateOf(rows), entries: graded(rows) };
      });
      for (const sc of g?.schools ?? []) {
        const ps = Array.from(new Set(sc.rows.map((r) => r.period)));
        perUrn[sc.urn] = ps.map((p) => {
          const rows = sc.rows.filter((r) => r.period === p);
          return { period: p, value: rateOf(rows.map((r) => ({ ...r, subject: focusItem.subject, qualificationType: focusItem.qualificationType, sizeWeight: null }))), entries: graded(rows) };
        });
      }
    } else {
      perUrn = Object.fromEntries(
        urns.map((u) => {
          const series = comparatorSubjectSeries[u];
          const ps = Array.from(new Set([...(series?.results ?? []), ...(series?.candidates ?? [])].map((r) => r.period)));
          const at = (rows: { period: number; value: number }[] | undefined, p: number) => rows?.find((r) => r.period === p)?.value ?? null;
          return [u, ps.map((p) => ({ period: p, value: at(measure.id === "entries" ? series?.candidates : series?.results, p), entries: at(series?.candidates, p) }))];
        }),
      );
    }
    const periods = Array.from(new Set(Object.values(perUrn).flatMap((rows) => rows.map((r) => r.period)))).sort((a, b) => a - b);
    return {
      periods,
      schools: urns.map((u) => ({
        urn: u,
        values: periods.map((p) => perUrn[u]?.find((r) => r.period === p)?.value ?? null),
        entries: periods.map((p) => perUrn[u]?.find((r) => r.period === p)?.entries ?? null),
      })),
      measure,
      result: mapResultOf(measure, usingBands ? bandRange : null, true),
      subjectLabel: activeMapChip.legend,
      theme,
    };
  };

  // 0.6.3 S3: an AS / AEA focus at Post-16 is compared on its own exact qualification
  // (size, share and rank on its graded entries, never the A-level bucket's).
  const exactQualFocus = phase === "ks5" && !!focusItem && isAsLevelOrAea(focusItem.qualificationType);
  // 0.6.3 S3: A*-E at Post-16 scores A-level-scale qualifications only; a BTEC, IB or T
  // Level focus says so on the panels rather than showing grey dots with no reason.
  const aStarToEOff = phase === "ks5" && usingThreshold && !!focusItem && focusScale !== GRADE_SCALES[2];
  const aStarToENote = "A*–E applies to A levels; use a grade or band for this qualification.";
  const gradedEntriesOf = (rows: SubjectGradeCount[]): number | null => rows.filter((r) => !NON_GRADE_VALUES.has(r.grade)).reduce((a, r) => a + r.entries, 0) || null;

  // Round 8 §3: driven by the shared toggle, so this column's own measure pill is gone.
  // The figure still follows the focus subject (round 7 §9): with one in focus it is that
  // subject's own figure on Results' chosen measure -- points per entry, or the Grade 4+ /
  // A*-E rate, which ComparisonsPanels scores per school from each one's grade counts
  // (its `threshold` prop) -- otherwise the whole-school headline.
  // Grade bands frontend round: Grade bands scores every comparator on the same range,
  // through the same per-school grade counts the threshold measure uses (ComparisonsPanels'
  // `threshold` prop, scored by bandRate) -- one ranking mechanism, not a second. Grade
  // counts has no single figure to rank schools by, and Grade bands none until a range is
  // picked: both compare on average point score here.
  // 0.6.3 S1: a Grade counts selection is scored the same way, on the selection.
  const comparisonsOnBands = (usingBands && !!bandRange) || (usingCounts && !!countsRange);
  const comparisonsMeasure = comparisonsMeasureFor(phase, showingResults, !!activeMapChip, usingThreshold, comparisonsOnBands, usingCounts && countsSelectionMeasure ? countsSelectionMeasure : resultsMeasureShown, headlineLabel);

  // Each set's own caveat, kept from round 5 -- the reason a set is what it is belongs
  // beside the set, not in a tooltip.
  const comparatorSetNote =
    comparisonsSet === CHOOSER_SET_ID
      ? chooserSet && chooserSet.key === activeChoiceKey
        ? chooserSet.note ?? undefined
        : "Loading these schools…"
      : storedSaved === "pending"
        ? "Loading these schools…"
        : undefined;

  const comparatorEmptyText = "No schools in this comparison with comparable published data for this phase.";

  // Column 1's persistence key. Both modes share it, because the toggle changes the
  // measure a panel is about, not which panels the person chose to keep -- switching to
  // Results and finding your Trend panel gone would read as a bug.
  const COL1 = "candidates";

  // One note slot per column, keyed per panel. RLS on teacher_view_notes is
  // profile_id = auth.uid(), so a note is only ever readable by the person who wrote it --
  // the privacy bar the original brief §12 set, enforced at the database rather than here.
  const notesFor = (columnId: string) => ({
    bodyFor: (panelId: PanelId) => notes[panelNoteKey(phase, columnId, panelId)] ?? null,
    onSave: async (panelId: PanelId, body: string) => {
      if (!schoolUrn) return;
      const key = panelNoteKey(phase, columnId, panelId);
      await saveNote(supabase, schoolUrn, key, body);
      setNotes((prev) => {
        const next = { ...prev };
        if (body.trim()) next[key] = body;
        else delete next[key];
        return next;
      });
    },
  });

  const panelsOf = (columnId: string): PanelId[] => panelsFrom(columns[columnId]);

  // Every panel's source line. `span` is the real year range that panel is plotting, so a
  // Trend showing 2021/22-2024/25 says so rather than repeating the latest year (§6.3).
  const panelSource = (span?: string) =>
    latestPeriod === null ? null : (
      <>
        Source: {SOURCE_NAME[phase]}, {span ?? academicYearLabel(latestPeriod)} &middot;{" "}
        <Link href="/sources" className="text-[var(--muted)] underline">Sources</Link>
      </>
    );

  // What both nav layouts read -- computed once here so the desktop pair and the phone nav
  // cannot disagree about which phases, subjects or icons there are.
  const navPhases = TEACHER_PHASES.filter((p) => p === phase || onboardedPhases.includes(p));
  // Round 2 §1: the chip is the subject's name alone -- the ControlBar badge already says
  // "GCSE — {school}" once, so "· GCSE" on every chip was noise. The one exception is a
  // subject ticked under two qualifications (GCSE and BTEC Art), where two identical
  // chips could not be told apart; those two keep their qualification.
  const focusSubjects: FocusSubject[] = phase === "ks2" ? [] : tickedItems.map((i) => ({
    key: i.key,
    label: tickedItems.some((o) => o.key !== i.key && o.subject === i.subject)
      ? `${i.subject} · ${qualificationShortLabel(phase, i.qualificationType)}`
      : i.subject,
    colour: colourOf(i),
  }));
  const onSharedMeasure = (next: SharedMeasure) => setColumnSetting(SHARED_MEASURE_KEY, next);
  // S3: under the flag, the dashboard is one of the four VicData configs, picked by the
  // same Candidates/Results state the toggle writes -- so the group switcher and today's
  // toggle read and write one setting, and a flag flip loses nobody's choice.
  // Snag 1 item 00: the published version from the store when there is one, else the copy
  // in code (same structure for every school and role; the hosts still decide per school).
  const codeConfig = configMode && (phase === "ks4" || phase === "ks5") ? teacherDashboardFor(phase, sharedMeasure) : null;
  const dashboardConfig = codeConfig ? ((inPlace.previewDraft ? draftConfigs?.[codeConfig.id] : undefined) ?? storedConfigs?.[codeConfig.id] ?? codeConfig) : null;
  const editing = inPlace.editing && !!dashboardConfig;

  // Each column's question once a subject is focused: a full question naming the subject,
  // its qualification and the school, after the column's plain one-word title (COLUMN_TITLE,
  // the same whether or not a subject is focused). Falls back to the §5 questions when no
  // subject is ticked yet, and at KS2, which has no subjects.
  const subjectHeadings = (() => {
    if (!focusItem || phase === "ks2") return null;
    const subj = focusItem.subject;
    const qual = qualificationShortLabel(phase, focusItem.qualificationType);
    const learners = phase === "ks5" ? "students" : "pupils";
    const at = schoolName ?? "your school";
    return {
      candidates: { question: `How many ${learners} at ${at} are entered for ${subj} ${qual}?` },
      results: { question: `How well do ${learners} at ${at} do in ${subj} ${qual}?` },
      // Context and Comparisons say something different per measure.
      context: {
        results: { question: `How do ${subj} ${qual} results compare with other subjects at ${at}?` },
        candidates: { question: `How do ${subj} ${qual} entries compare with other subjects at ${at}?` },
      },
      rankings: {
        results: { question: `How do ${at}'s ${subj} results compare with other schools?` },
        candidates: { question: `How do ${at}'s ${subj} entry numbers compare with other schools?` },
      },
    };
  })();
  const openSubjectPicker = () => setSubjectPickerOpen(true);

  // The three column hosts, then the page's three columns around them. Kept as values so
  // mode "embed" can draw a host on its own (0.6 E); the page draws exactly the columns it
  // always drew.
  const column1Host =
    phase === "ks2" ? (
      // KS2 keeps its own single box: every pupil sits the same tests, so there are
      // no subjects to plot per year and nothing for the panel mechanism to offer
      // (§6.9). Untouched from round 5.
      <CardBox
        title={defaultBoxTitle(showingResults ? "results" : "candidates", phase)}
        question={showingResults ? q.howWell : q.howMany}
      >
        {({ fullscreen }) =>
          showingResults ? (
            (() => {
              // KS2 has no subject picker, so its result is the school's own
              // headline, read against the nearest primaries (§14: never a bare
              // number).
              const own = neighbours.find((n) => n.isTarget)?.value ?? null;
              const others = neighbours.filter((n) => !n.isTarget && n.value !== null).map((n) => n.value!);
              const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : null;
              return own === null ? (
                <p className="mt-2 text-sm text-[var(--muted)]">No published {headlineLabel} for this school yet.</p>
              ) : (
                <>
                  <p className={`mt-2 font-semibold tabular-nums ${fullscreen ? "text-6xl" : "text-3xl"}`}>{formatHeadline(own)}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {headlineLabel}
                    {avg !== null && ` · nearest primaries average ${formatHeadline(avg)}`}
                  </p>
                </>
              );
            })()
          ) : (
            <p className={`mt-2 font-semibold tabular-nums ${fullscreen ? "text-6xl" : "text-3xl"}`}>
              {rollAtAge10?.toLocaleString() ?? "—"}
            </p>
          )
        }
      </CardBox>
    ) : tickedItems.length === 0 ? (
      <CardBox
        title={defaultBoxTitle(showingResults ? "results" : "candidates", phase)}
        question={showingResults ? q.howWell : q.howMany}
      >
        {() => (
          <p className="text-sm text-[var(--muted)]">
            Pick a subject above to see its {showingResults ? "results" : "entries"}.
          </p>
        )}
      </CardBox>
    ) : showingResults && resultsMeasure.id === "counts" && focusItem ? (
      // Grade bands frontend round: Grade counts is a whole distribution with no single
      // figure, so Column 1 draws it with its own three panels (GradeCountsPanels).
      <GradeCountsPanels
        columnId={COL1}
        subjectLabel={phase === "ks5" ? focusItem.label : focusItem.subject}
        ownRows={focusGradeRows}
        geography={schoolUrn ? { urn: schoolUrn, subject: focusItem.subject, qualificationType: focusItem.qualificationType, phase } : null}
        colour={colourOf(focusItem)}
        panels={panelsOf(COL1)}
        onPanelsChange={(next) => setPanels(COL1, next)}
        notes={notesFor(COL1)}
        question={q.howWell}
        source={panelSource}
        // 0.6.1 S6: no pills of its own since S5; the spacer keeps its panels level with
        // Context's and Comparisons' (side by side only).
        controls={<PillRowSpacer />}
        schoolSetGrades={setGradeRowsFor}
        selection={{ scale: focusScale, range: countsRange, onSelect: saveSelection }}
      />
    ) : showingResults ? (
      <SubjectPanels
        columnId={COL1}
        periods={resultsPeriods}
        // 0.6.1 S3c: a view of its own's averages (views=v2 only; built when asked).
        schoolGroup={schoolGroupOn(resultsMeasure.id, valueForResults, resultsPeriods)}
        schoolSet={
          resultsMeasure.id === "points"
            ? schoolSetOn("results", resultsPeriods)
            : usingThreshold || (usingBands && bandRange)
              ? schoolSetGradesOn(resultsPeriods, usingBands)
              : undefined
        }
        schoolSetGrades={usingBands ? setGradeRowsFor : undefined}
        // Content round S6: the focused subject and its category peers.
        subjects={resultsSeries}
        focus={focusKey}
        groups={resultsGroups}
        // Results joins the redesigned path: its subjects are a bounded category-peer
        // list, like Context's Selected subjects, so every peer is its own line/row --
        // Trend and % change gain chart/table toggles and palette colours, and Current
        // takes the grey-ramp tints Context has. The group lines (category and England
        // category averages) leave the per-subject Trend, as they did for Context.
        changeScope="individual"
        spaciousBars
        categoryLabel={focusFamilyLabel ?? undefined}
        theme={theme}
        // % change: the focused subject's average point score against its LA, region
        // and England (the shared GeographyView), on average point score only -- no
        // area grade-4+ or A*-E rate is published. GCSE: only for the points-bearing
        // GCSE qualification. Post-16 (Part C): the subject in its exact
        // qualification; one with no published points (VRQ, AEA, EPQ) comes back with
        // no area rows and says so. The school's row is its own average point score,
        // from the same series the other panels plot.
        geography={
          focusItem && schoolUrn
            ? {
                urn: schoolUrn,
                subject: focusItem.subject,
                qualificationType: phase === "ks5" ? focusItem.qualificationType : undefined,
                label: phase === "ks5" ? focusItem.label : focusItem.subject,
                applies: resultsGeographyApplies(phase, resultsMeasure.id, focusItem),
                own: resultsSeries.find((r) => r.key === focusItem.key)?.values ?? [],
                notApplicableText:
                  resultsMeasure.id !== "points"
                    ? `LA, regional and national figures are published for average points only, not ${resultsMeasure.label.toLowerCase()}. Switch Results to Average points to compare ${phase === "ks5" ? focusItem.label : focusItem.subject} with the wider system.`
                    : `LA, regional and national figures cover GCSE (full course) average points only, and this school's ${focusItem.subject} entries are in a qualification outside that.`,
              }
            : undefined
        }
        accentHex={accent?.hex ?? null}
        // Snagging round 1 Part 2: the number tiles, Current's default view.
        tiles
        // Trend map/legend round Part 3: Trend's Map view -- the same map profiles and
        // focus-subject chip Comparisons' map uses, so the two maps plot one subject.
        trendMap={
          activeMapChip && schoolUrn
            ? {
                profiles: mapProfiles,
                targetUrn: schoolUrn,
                stage: phase,
                subject: activeMapChip.subject,
                subjectLabel: activeMapChip.legend,
                subjectBucket: activeMapChip.bucket,
                familyId: activeMapChip.familyId,
                accentHex: accent?.hex ?? null,
                series: column1MapSeries(),
              }
            : undefined
        }
        measure={resultsMeasureShown}
        gradeBand={
          usingBands && focusItem
            ? {
                range: bandRange,
                rangeLabel: bandLabel,
                colour: colourOf(focusItem),
                ownRows: focusGradeRows,
                geography: schoolUrn
                  ? { urn: schoolUrn, subject: focusItem.subject, qualificationType: focusItem.qualificationType, phase }
                  : null,
              }
            : undefined
        }
        // 0.6.1 S5 (D4): the Results sub-measure pill moved from under this column's
        // heading to the top bar (ResultsControl), beside the grade band choice, so it is
        // visible (pinch point 12). 0.6.1 S6: an empty pill row in its place, so the
        // three columns' panels stay level where they sit side by side.
        controls={<PillRowSpacer />}
        benchmarkLabel={usingThreshold ? undefined : "National"}
        benchmarkNoun={
          usingThreshold
            ? undefined
            : usingBands
              ? `England's share at ${(bandLabel ? inlineRangeLabel(bandLabel) : "the chosen grades")} for the same subject and qualification`
            : englandAvg?.basis === "subject"
              ? "the England GCSE average for the subject"
              : "the England average for the same subject and qualification"
        }
        limitNote={aStarToEOff ? aStarToENote : undefined}
        note={
          usingThreshold
            ? `Subjects graded on a vocational scale have no ${phase === "ks5" ? "A*–E" : "grade 4"} bar and show no figure.`
            : usingBands
              ? "A subject on a different grade scale from the one the range was picked on shows no figure. England's figure leaves out any grade fewer than 5 schools publish."
              : undefined
        }
        questions={{
          current: q.howWell,
          trend: "How have my subjects' results moved, year on year?",
          change: "Which of my subjects' results have moved most?",
        }}
        source={panelSource}
        panels={panelsOf(COL1)}
        onPanelsChange={(next) => setPanels(COL1, next)}
        notes={notesFor(COL1)}
        emptyText="Pick a subject above to see its results."
        // Content round S3 (Redesign.dc.html v27): on average point score the Current
        // tag says what the figure is -- "Av. Points 2024/25" -- while the column
        // heading stays "Results". The threshold measure keeps its existing tag.
        currentLabel={resultsMeasure.id === "points" ? "Av. Points" : usingBands && bandLabel ? bandLabel : COLUMN_TITLE.results}
      />
    ) : (
      <CandidatesPanels
        phase={phase}
        theme={theme}
        // 0.6.1 S3c: a view of its own's averages (views=v2 only; built when asked).
        schoolGroup={schoolGroupOn("entries", entriesAt, categoryPeriods)}
        schoolSet={schoolSetOn("candidates", categoryPeriods)}
        // Content round S6: the focused subject and its category peers. No England
        // overlay here -- "for candidates the national average is irrelevant".
        subjects={candidateItems.map((i) => ({
          key: i.key,
          subject: i.subject,
          label: phase === "ks4" ? i.subject : i.label,
          shortLabel: candidateShort.get(i.key) ?? i.subject,
          values: categoryPeriods.map((p) => entriesAt(i, p)),
        }))}
        periods={categoryPeriods}
        focus={focusKey}
        // Snagging round 1 Part 2: the "rank in all subjects at school" population --
        // every comparable subject with entries, focused subject first and one entry
        // per subject at GCSE, exactly as candidateItems counts its category.
        schoolSubjects={schoolSubjectsOf(items, focusItem, focusKey, phase)
          .map((i) => ({ key: i.key, values: categoryPeriods.map((p) => entriesAt(i, p)) }))}
        groupLabel={`${focusFamilyLabel} average`}
        categoryLabel={focusFamilyLabel ?? undefined}
        // Live review Part 5: the % Change table compares the focused subject with its
        // LA, region and England. At GCSE only where the focused item is the
        // points-bearing qualification -- the area figures count GCSE points-eligible
        // entries, so a non-GCSE Dance or an FSMQ would be set against a different
        // thing. Post-16 (Part C): the subject in its exact qualification, whose area
        // figures are points-eligible entries of that qualification. Either way the
        // school's own row is its points-eligible entries (entries x points coverage).
        geography={
          focusItem && schoolUrn
            ? {
                urn: schoolUrn,
                subject: focusItem.subject,
                qualificationType: phase === "ks5" ? focusItem.qualificationType : undefined,
                label: phase === "ks5" ? focusItem.label : focusItem.subject,
                applies: candidatesGeographyApplies(phase, focusItem),
                notApplicableText: `LA, regional and national entries figures aren't available for ${focusItem.subject}: they count GCSE (points-eligible) entries only, and this school's ${focusItem.subject} entries are in a qualification outside that.`,
                own: pointsEligibleEntriesByPeriod(categoryPeriods, (p) => headlineRowsFor(focusItem, p)),
              }
            : undefined
        }
        panels={panelsOf(COL1)}
        onPanelsChange={(next) => setPanels(COL1, next)}
        question={q.howMany}
        source={panelSource}
        notes={notesFor(COL1)}
        currentLabel={COLUMN_TITLE.candidates}
      />
    );
  const column1Moved =
    (showingResults ? movedResults : movedCandidates) && (
      <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {(showingResults ? movedResults : movedCandidates)!.sentence}
      </p>
    );
  const contextHost =
    phase === "ks2" ? (
      <CardBox title={defaultBoxTitle("context", phase)} question={q.nearMe}>
        {({ fullscreen }) => (
          <>
            <p className="mt-2 text-sm text-[var(--muted2)]">The {nearbyOnly.length} nearest primaries, by distance.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {nearbyOnly.slice(0, fullscreen ? nearbyOnly.length : 5).map((n) => (
                <li key={n.urn} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{n.name}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {n.distanceKm === null ? "" : `${n.distanceKm.toFixed(1)} km`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBox>
    ) : tickedItems.length === 0 ? (
      <CardBox title={defaultBoxTitle("context", phase)} question={q.nearMe}>
        {() => <p className="text-sm text-[var(--muted)]">Pick a subject above to see how it sits in the school.</p>}
      </CardBox>
    ) : (
      <SubjectPanels
        columnId="context"
        periods={contextPeriods}
        // 0.6.1 S3c: a view of its own's averages (views=v2 only; built when asked).
        schoolGroup={schoolGroupOn(contextMeasure.id, contextValueFor, contextPeriods)}
        schoolSet={
          contextMeasure.id === "points"
            ? schoolSetOn("results", contextPeriods)
            : contextMeasure.id === "entries"
              ? schoolSetOn("candidates", contextPeriods)
              : contextMeasure.id === "threshold" || (contextMeasure.id === "bands" && columnsRange)
                ? schoolSetGradesOn(contextPeriods, contextMeasure.id === "bands", columnsRange)
                : undefined
        }
        subjects={contextSeries}
        measure={contextMeasure}
        focus={focusKey}
        // Steps 9-10: Selected subjects is a bounded list, drawn like Column 1 ("individual").
        // Snagging round 1 Part 3: All subjects is no longer curated -- every subject in the
        // table and in fullscreen, with the rail's show/hide legend -- and its card graph
        // is the focused subject against the All subjects average.
        changeScope="individual"
        // Subject category is a bounded list too, drawn the same way as Selected.
        cardTrend={contextAgainst === "whole" ? "focusVsGroup" : undefined}
        deltaHeading="vs average"
        rankedTable
        rankedViews
        compareAgainstLabel={contextGroupPhrase}
        theme={theme}
        accentHex={accent?.hex ?? null}
        yearControl
        // Embed: a view pinned "as of" a year opens there (meeting slots).
        pinnedYear={embed ? yearPeriodOf(embedPinned.year) : null}
        controls={
          <ContextPills
            against={contextAgainst}
            onAgainst={(id) => setColumnSetting(againstKey("context"), id)}
            // S8: only subjects with real entries at the school in the latest year;
            // §4c: only in the focused subject's qualification family.
            pickerItems={toPickerItems(phase as "ks4" | "ks5", contextOffer)}
            family={QUALIFICATION_FAMILIES[phase as "ks4" | "ks5"].find((f) => f.id === contextFamily) ?? null}
            focusCategory={focusItem ? familyFor(headline, focusItem.subject)?.id ?? null : null}
            focusCategoryLabel={focusItem ? familyFor(headline, focusItem.subject)?.label ?? null : null}
            theme={theme}
            selected={contextSelected}
            onSetSelected={(keys) => setColumnList(chosenKey("context"), keys)}
            onToggleSelected={(key) =>
              setColumnList(
                chosenKey("context"),
                contextSelected.includes(key) ? contextSelected.filter((k) => k !== key) : [...contextSelected, key],
              )
            }
          />
        }
        benchmarkLabel={contextGroupLabel}
        benchmarkNoun={contextAgainst === "category" ? `the ${contextGroupLabel} average` : `the ${contextGroupLabel.toLowerCase()} average`}
        groups={[{ label: `${contextGroupLabel} average`, values: atContextPeriod(contextGroupAverage) }]}
        donut={{
          // §4.2: a share of an average point score is not a meaningful percentage,
          // so the donut is genuinely inert for a Results measure, not just greyed.
          enabled: shareApplies(contextMeasure.id, !!columnsRange),
          share:
            contextMeasure.id === "bands" && columnsRangeLabel
              ? {
                  values: contextPeriods.map((p) => contextBandShare(p)?.met ?? null),
                  totals: contextPeriods.map((p) => contextBandShare(p)?.entries ?? null),
                  label: columnsRangeLabel,
                  otherLabel: "All other grades",
                  format: (v: number) => Math.round(v).toLocaleString(),
                }
              : undefined,
          groupLabel: contextGroupLabel,
          groupTotals: atContextPeriod(contextGroupTotals),
          // Round 2 §3: the sentence names the school. The share is of ENTRIES (a
          // pupil sits several subjects), so it says "student entries" rather than
          // "students" -- see the round 2 build report.
          shareOf:
            contextMeasure.id === "bands"
              ? `graded entries in ${contextAgainst === "category" ? contextGroupLabel : contextAgainst === "selected" ? "the subjects you selected" : "all subjects"} at ${schoolName ?? "your school"}`
              : contextAgainst === "selected"
              ? `entries in the subjects you selected at ${schoolName ?? "your school"}`
              : contextAgainst === "category"
              ? `entries in ${contextGroupLabel} at ${schoolName ?? "your school"}`
              : `all student entries at ${schoolName ?? "your school"}`,
        }}
        questions={{
          current: q.nearMe,
          trend: `How have my subjects moved against ${contextGroupLabel.toLowerCase()}?`,
          change: `Which of my subjects have moved most, against ${contextGroupLabel.toLowerCase()}?`,
        }}
        source={panelSource}
        panels={panelsOf("context")}
        onPanelsChange={(next) => setPanels("context", next)}
        notes={notesFor("context")}
        emptyText="Pick a subject above to see how it sits in the school."
        // S11: the tag names the live comparison group -- "Whole School Context
        // 2024/25" or "Selected Subjects Context 2024/25".
        currentLabel={`${titleCase(contextGroupLabel)} Context`}
        // 0.6.3 S1: on Grade counts, the prompt until a grade is selected; then the chip.
        prompt={countsPrompt ? "Click a grade in Results to compare it across subjects" : undefined}
        selectionChip={selectionChip}
        titleLead={countsSelectionMeasure && usingCounts ? countsSelectionMeasure.label : undefined}
        limitNote={aStarToEOff ? aStarToENote : undefined}
        note={
          contextMeasure.id === "threshold"
            ? undefined
            : contextMeasure.id === "bands"
              ? usingCounts
                ? `Subjects on a different grade scale from the selection's are left out, and a subject with fewer than ${MINIMUM_SUBJECT_N} graded entries shows as too few entries.`
                : "Subjects on a different grade scale from the range's are left out."
              : [
                  contextFallsBack
                    ? resultsMeasure.id === "counts"
                      ? "Grade counts has no single figure to compare subjects on, so Context shows average points."
                      : "Pick a grade range from Grades ▾ in the top bar to compare subjects on it; until then Context shows average points."
                    : null,
                  // R-POINTS-SAME-QUAL (S3b): say why other qualification types are missing.
                  contextKeepsFamily && contextFamilyLabel
                    ? `Points are on a different scale for each qualification type, so only ${contextFamilyLabel} subjects are compared.`
                    : null,
                ].filter(Boolean).join(" ") || undefined
        }
      />
    );
  // Snagging round 1 Part 4: a national/regional ranking is on (R-RANKING-SAMPLE). 0.6 snag
  // 4 / 02: the same test is the page's comparator state (runtime.comparator).
  const onRanking = !!(comparisonsSet === CHOOSER_SET_ID && chooserChoice?.kind === "ranking" && chooserSet && chooserSet.key === activeChoiceKey && chooserSet.ranking);
  const comparisonsHost = (
      <ComparisonsPanels
        phase={phase}
        theme={theme}
        panels={panelsOf("rankings")}
        onPanelsChange={(next) => setPanels("rankings", next)}
        notes={notesFor("rankings")}
        question={q.wider}
        source={panelSource}
        headlineLabel={headlineLabel}
        setId={comparisonsSet}
        activeSet={activeSetOption}
        setLabel={activeSetLabel}
        setNote={comparatorSetNote}
        schools={allComparatorSets[comparisonsSet] ?? []}
        seriesByUrn={activeMapChip ? comparatorSubjectSeries : { ...seriesByUrn, ...(savedSets?.seriesByUrn ?? {}), ...(chooserSet?.seriesByUrn ?? {}) }}
        // Part 3: "Choose schools…" / "Edit" open the chooser. A new set starts from
        // whichever set is selected now.
        // Comparator chooser round: "Choose schools…" opens the chooser's hub; "Edit" beside
        // a set opens it straight at that set's editor.
        // Embed: the set is pinned, and the chooser (which saves) isn't offered.
        onManageSet={embed ? undefined : (id) => {
          if (!savedSets) return;
          const editing = id ? savedSets.sets.find((set) => savedSetKey(set.id) === id) ?? null : null;
          setChooser({ editing });
        }}
        subjectLabel={activeMapChip?.legend ?? null}
        seriesLoading={!!activeMapChip && mapProfiles === null}
        measure={comparisonsMeasure}
        // Results on a grade threshold with a subject in focus: the column fetches every
        // comparator's grade counts for it and scores them as thresholdAt() scores ours.
        threshold={
          // 0.6.3 S3: an AS or AEA focus is compared on its own qualification's rows -- the
          // map profiles only carry the A-level bucket, which adds A levels in. Candidates:
          // each school's graded entries; points: none are published at that grain.
          exactQualFocus && activeMapChip && focusItem && !(showingResults && (usingThreshold || comparisonsOnBands))
            ? {
                subject: focusItem.subject,
                qualificationType: focusItem.qualificationType,
                rateOf: showingResults ? () => null : gradedEntriesOf,
                ...(showingResults ? { unavailable: `Other schools' average points aren't published for ${qualificationShortLabel(phase, focusItem.qualificationType) || focusItem.qualificationType} on its own, only with A levels; use a grade or band to compare it.` } : {}),
              }
            : showingResults && (usingThreshold || comparisonsOnBands) && activeMapChip && focusItem && phase !== "ks2"
            ? {
                subject: focusItem.subject,
                qualificationType: focusItem.qualificationType,
                // Scored every render from the rows already fetched, so a new range
                // re-scores the set without fetching again.
                rateOf: usingCounts ? selectionRateOf : gradeRateScorer(comparisonsOnBands, bandRange, phase),
                // R-MIN-ENTRIES (0.6.3 S1): on a counts selection a school below the minimum shows as too few entries.
                ...(usingCounts ? { minEntries: MINIMUM_SUBJECT_N } : {}),
                ...(aStarToEOff ? { unavailable: aStarToENote } : {}),
              }
            : null
        }
        prompt={countsPrompt ? "Click a grade in Results to compare it across schools" : undefined}
        selectionChip={selectionChip}
        titleLead={countsSelectionMeasure && usingCounts ? countsSelectionMeasure.label : undefined}
        mapRange={comparisonsOnBands ? columnsRange : null}
        schoolUrn={schoolUrn}
        mapProfiles={mapProfiles}
        activeMapChip={activeMapChip}
        mapRank={mapRank}
        onMapRank={setMapRank}
        emptyText={comparatorEmptyText}
        targetName={schoolName ?? "This school"}
        // Snagging round 1 Part 4: a national/regional ranking is on -- no map, a rank-in-set
        // tiles view by default, and its whole population's average in the graphs. The
        // figures are on the ranking's own measure, the phase headline.
        rankingSet={
          onRanking && chooserSet?.ranking
            ? { ...chooserSet.ranking, measure: headlineMeasure(phase, headlineLabel), measureName: headlineLabel || "the headline measure" }
            : null
        }
        currentLabel={
          activeSavedSet
            ? `${showingResults ? "Results" : "Candidates"} against ${activeSavedSet.name}`
            : `${showingResults ? "Results" : "Candidates"} at the ${titleCase(activeSetLabel)}`
        }
      />
  );

  // COLUMN 1, round 8 §2: Candidates and Results merged. One column, one Add
  // control, one set of three panels, and the shared toggle decides which measure
  // they are about. They used to be two columns with two pin sets; they now share
  // one column key, so a panel set built in one mode is the same set in the other --
  // the toggle changes what the panels are about, not which panels you kept.
  const column1 = (
    <DashboardColumn
      columnId={showingResults ? "results" : "candidates"}
      title={COLUMN_TITLE[showingResults ? "results" : "candidates"]}
      question={subjectHeadings ? subjectHeadings[showingResults ? "results" : "candidates"].question : showingResults ? q.howWell : q.howMany}
      accented={!!accent}
      // §13's "NEW pill wherever something's actually changed" -- on the measure the
      // new data actually lands in, so it follows the toggle rather than sitting on a
      // column currently showing candidate counts.
      badge={showingResults && newDataPeriod !== null && (
        <span className="ml-2 rounded-sm bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
      )}
    >
      {column1Host}
      {column1Moved}
    </DashboardColumn>
  );
  const contextColumn = (
    <DashboardColumn
      columnId="context"
      title={COLUMN_TITLE.context}
      question={subjectHeadings?.context[showingResults ? "results" : "candidates"].question ?? q.nearMe}
      accented={!!accent}
    >
      {contextHost}
    </DashboardColumn>
  );
  const comparisonsColumn = (
    <DashboardColumn
      columnId="rankings"
      title={COLUMN_TITLE.rankings}
      question={subjectHeadings?.rankings[showingResults ? "results" : "candidates"].question ?? q.wider}
      accented={!!accent}
    >
      {comparisonsHost}
    </DashboardColumn>
  );

  // VicData 0.6 integration: the runtime state a configured panel needs to say what
  // "Copy this view…" copies (DashboardRuntimeContext). Provided only under a plan.
  const periodsShown = entries.map((e) => e.period);
  const runtime: DashboardRuntime | null =
    phase === "ks4" || phase === "ks5"
      ? {
          phase,
          school: schoolUrn ? { urn: schoolUrn, name: schoolName ?? schoolUrn } : null,
          measure: sharedMeasure,
          results: resultsMeasure.id as ResultsMeasureId,
          focus: focusItem ? { key: focusItem.key, label: phase === "ks5" ? focusItem.label : focusItem.subject } : null,
          focusSubject: focusItem ? { subject: focusItem.subject, qualificationType: focusItem.qualificationType } : null,
          category: focusFamilyLabel,
          contextAgainst,
          contextGroupLabel,
          setId: comparisonsSet ?? null,
          comparator: onRanking ? "ranking" : "schools",
          setLabel: activeSetLabel,
          latestYear: latestPeriod === null ? null : academicYearLabel(latestPeriod),
          firstYear: periodsShown.length ? academicYearLabel(Math.min(...periodsShown)) : null,
          superAdmin,
        }
      : null;
  const withRuntime = (node: React.ReactNode) => (runtime ? <DashboardRuntimeContext.Provider value={runtime}>{node}</DashboardRuntimeContext.Provider> : node);

  // ---------------------------------------------------------------- mode "embed" (0.6 E)
  if (embed) {
    const accentStyle = { ...directionCssVars(theme), ...(accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) } as React.CSSProperties;
    if (!embedConfig) return <EmbedStatus text="No view to draw." />;
    const cols = embedColumns(embedConfig);
    const hostFor = (key: string) => (key === "context" ? contextHost : key === "rankings" ? comparisonsHost : column1Host);
    const columnKeys = Object.fromEntries(cols.map((c) => [c.column.id, c.key]));
    const only = cols.length === 1 && embedConfig.panels.length === 1 && cols[0].host && !cols[0].problem ? cols[0] : null;
    if (only) {
      // One view: the host alone, its one panel, under the plan (rail subset, default view,
      // figure or card frame). No column header, no grid.
      const embedPlan: PlanEmbed = { frame: props.frame ?? "card", fullscreen: !!props.fullscreen };
      const plan = buildPlan(embedConfig, superAdmin, { embed: embedPlan, columnKeys });
      return (
        <div
          data-dashboard-id={embedConfig.id}
          data-renderer="embed"
          style={accentStyle}
          className={props.frame === "figure" ? "flex h-full min-h-0 min-w-0 flex-col text-[var(--fg)]" : "text-[var(--fg)]"}
        >
          <DashboardPlanContext.Provider value={plan}>{withRuntime(hostFor(only.key))}</DashboardPlanContext.Provider>
        </div>
      );
    }
    // A whole dashboard: each config column drawn by its host, in config order, under
    // the config's own title. What 0.6 can't draw yet says so in place (embed.ts).
    const baseColumn = (key: string) => (key === "context" ? contextColumn : key === "rankings" ? comparisonsColumn : column1);
    return (
      <div data-renderer="embed" style={accentStyle} className="text-[var(--fg)]">
        {withRuntime(
        <DashboardFrame config={embedConfig} superAdmin={superAdmin} columnKeys={columnKeys}>
          {cols.map((c) => {
            if (c.host && !c.problem) return cloneElement(baseColumn(c.key), { key: c.column.id, title: c.column.title });
            const panels = embedConfig.panels.filter((p) => p.column === c.column.id);
            return (
              <DashboardColumn key={c.column.id} columnId={c.column.icon} title={c.column.title} question={c.problem ?? placeholderOnlyNote(c.column)} accented={!!accent}>
                {c.problem ? (
                  <PanelLimitNote panelId={`${c.column.id}.note`} text={c.problem} />
                ) : superAdmin ? (
                  panels.map((p) => <PlannedPanel key={p.id} panel={p} />)
                ) : (
                  <PanelLimitNote panelId={`${c.column.id}.note`} text={`${placeholderOnlyNote(c.column)} Its planned panels show to VicData admins.`} />
                )}
              </DashboardColumn>
            );
          })}
        </DashboardFrame>,
        )}
      </div>
    );
  }

  // 0.6.1 S5 (D3 + D4): the Results switch and the grade band choice, in the top bar (and
  // the phone nav), Results mode only. The same saved settings as before (measure:results,
  // band:range), so members' choices carry over. Never in an embed (returned above).
  const topResults = (compact: boolean) =>
    showingResults ? (
      <ResultsControl
        measures={resultsMeasures}
        active={resultsMeasure}
        onMeasure={(id) => setColumnSetting(measureKey("results"), id)}
        band={focusItem ? { scale: focusScale, range: usingCounts ? countsRange : bandRange, onRange: saveBand } : null}
        compact={compact}
      />
    ) : undefined;

  // 0.6 snag 2 (B): with Edit on, the page stays mounted but hidden (its open rows, focused
  // subject, ticked subjects and scroll come back as they were when Edit goes off) and
  // gives up the #teacher-root id to the editor drawn in its place.
  const editorHost: InPlaceHost | null = editing
    ? {
        school: schoolUrn ? { urn: schoolUrn, name: schoolName ?? schoolUrn } : null,
        labels: {
          results: resultsMeasure.id as ResultsMeasureId,
          subject: focusItem ? { label: phase === "ks5" ? focusItem.label : focusItem.subject, key: focusItem.key } : null,
          ...(focusFamilyLabel ? { category: focusFamilyLabel } : {}),
        },
        states: {
          compareAgainst: contextAgainst,
          comparator: onRanking ? "ranking" : "schools",
          selected: contextSelected,
          // 0.6.1 S5: the editor's own Results control opens on the page's band.
          ...(focusItem ? { band: { scale: focusScale, range: bandRange ? { top: bandRange.top, bottom: bandRange.bottom } : null } } : {}),
        },
        top: <ViewAsBanner className="" />,
        onExit: () => setEditOn(false),
      }
    : null;

  return (
    <>
    {editorHost && dashboardConfig && <InPlaceEditor slug={dashboardConfig.id} host={editorHost} />}
    {/* §7: the theme attribute is scoped to Teacher view, never to <html> -- see
        TeacherChrome.tsx for why, and Q15. */}
    {/* 0.6.3 S4: each year table's years across / down, remembered for the member. */}
    <TableLayoutContext.Provider value={tableLayoutStore}>
    <main
      id={editing ? undefined : "teacher-root"}
      hidden={editing}
      data-theme={theme}
      // The phase accent reaches every card and box as a custom property, so the shared
      // components never carry a phase-specific hex of their own. So does the one change
      // palette (--dir-up/--dir-down/--dir-flat, trend-colours.ts), in this theme.
      style={{ ...directionCssVars(theme), ...(accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) } as React.CSSProperties}
      // max-w-7xl is 80rem = 1280px, the laptop board's own width.
      className="mx-auto w-full max-w-7xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6"
    >
      {!embed && <ViewAsBanner />}
      {/* Top-nav completion part 3: below `sm` the phone nav (NavPhone.dc.html) replaces
          TeacherNav + ControlBar. A CSS swap, so there is no viewport check to hydrate
          wrongly -- and both read the same state, so switching phase, subject or measure
          on either lands in exactly the same place. The desktop pair stays in print, where
          the phone nav is hidden. */}
      <PhoneNav
        phase={phase}
        phases={navPhases}
        theme={theme}
        onTheme={setTheme}
        measure={sharedMeasure}
        onMeasure={onSharedMeasure}
        subjects={focusSubjects}
        focusKey={focusKey}
        onFocus={setFocusKey}
        onEditSubjects={openSubjectPicker}
        results={topResults(true)}
        className="sm:hidden"
      />
      <div className="hidden sm:block print:block">
        <TeacherNav
          phase={phase}
          phases={navPhases}
          labelsOn={readSetting(columns, NAV_LABELS_KEY) !== "off"}
          onLabelsOn={setNavLabels}
          theme={theme}
          onTheme={setTheme}
        />

        {/* Round 8 §3: one control bar replaces the old title row, the school line and the
            per-column header rows. Everything measure-specific was deliberately kept OUT of
            it -- see ControlBar's own note on the row-alignment reason. */}
        <ControlBar
          phase={phase}
          phaseLabel={PHASE_LABELS[phase]}
          schoolName={schoolName}
          measure={sharedMeasure}
          onMeasure={onSharedMeasure}
          subjects={focusSubjects}
          focusKey={focusKey}
          onFocus={setFocusKey}
          onEditSubjects={openSubjectPicker}
          // Top-nav round: Export alone. The theme toggle moved up into TeacherNav, and
          // "All dashboards" went with it -- the nav's Home link is the same way back.
          // 0.6 snag 2 (B): no super-admin Edit link here any more -- the footer's Edit
          // switch opens the editor in place, and with it off the page is the member's.
          chrome={<ExportButton />}
          results={topResults(false)}
          switcher={
            dashboardConfig ? (
              <GroupSwitcher
                dashboards={groupOf(teacherDashboardFor(phase as "ks4" | "ks5", sharedMeasure)).map((d) => (inPlace.previewDraft ? draftConfigs?.[d.id] : undefined) ?? storedConfigs?.[d.id] ?? d)}
                activeId={dashboardConfig.id}
                onSwitch={(d) => onSharedMeasure(d.id.endsWith(".results") ? "results" : "candidates")}
              />
            ) : undefined
          }
        />
      </div>

      {/* §13's banner. States what actually changed and when, rather than just shouting. */}
      {peek && (
        <p className="mt-3 rounded-md border border-[var(--panel-border2)] bg-[var(--box-bg)] px-3 py-2 text-sm text-[var(--muted2)] print:hidden">
          Looking at {schoolName ?? peek.urn} as {VISIBLE_ROLE_LABELS[peek.role as VisibleRoleId] ?? peek.role}: the Catalogue&rsquo;s read-only look. School-shared sets and other people&rsquo;s notes aren&rsquo;t shown.
        </p>
      )}
      {/* 0.6 integration, flag on: "Updated — what's changed" once the VicData dashboard
          has a newer published version (renders nothing otherwise). */}
      {dashboardConfig && <VicDataUpdatesBySlug key={inPlace.reloadTick} slug={dashboardConfig.id} schoolUrn={schoolUrn} className="print:hidden [&:not(:empty)]:mt-3" />}
      {newDataPeriod !== null && (
        <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 print:hidden dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <span className="mr-2 rounded-sm bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
          {newDataPeriod} results have been published since you were last here.
        </p>
      )}
      {/* §7: an exported page must say what produced it -- same "show your assumptions"
          rule the Data View's own print summary follows. */}
      <p className="mt-1 hidden text-xs text-neutral-600 print:block">
        {PHASE_LABELS[phase]} · {tickedItems.length} subject{tickedItems.length === 1 ? "" : "s"} selected · exported {new Date().toLocaleDateString("en-GB")}
      </p>

      {/* The laptop board's four-column row, with its dividers -- see DashboardGrid. */}
      {(() => {
        const frame = (
          <DashboardFrame config={dashboardConfig} superAdmin={superAdmin}>
            {column1}
            {contextColumn}
            {comparisonsColumn}
          </DashboardFrame>
        );
        // Flag off (no config): exactly the frame, no runtime context.
        return dashboardConfig ? withRuntime(frame) : frame;
      })()}

      {/* The subject picker, as a popup from "±" rather than a permanent section of the
          page. Same modal shell as a card's fullscreen (TeacherModal: backdrop click,
          Escape, scroll lock). Nothing to save: ticking updates `ticked` immediately, which
          is what every card reads, so the cards behind the backdrop change as you tick. */}
      {phase !== "ks2" && subjectPickerOpen && (
        <TeacherModal
          label="Which subjects do you teach?"
          backdropLabel="Close subject picker"
          onClose={() => setSubjectPickerOpen(false)}
          initialFocusRef={subjectPickerCloseRef}
          // Combined round §4a: a picker, so the compact size, not the chart-sized panel.
          size="compact"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold">Which subjects do you teach?</h2>
              <p className="mt-1 text-xs text-[var(--muted2)]">Personal to you. Changing it updates every card on the dashboard.</p>
            </div>
            <button
              ref={subjectPickerCloseRef}
              type="button"
              onClick={() => setSubjectPickerOpen(false)}
              aria-label="Close subject picker"
              title="Close"
              className={`shrink-0 ${MODAL_CLOSE_BUTTON_CLASS}`}
            >
              <ExpandIcon expanded />
            </button>
          </div>
          {/* The QuickEdit mockup: onboarding's steps 1 and 2 on one screen -- the family
              tiles, then the category picker straight underneath, no Next between them. */}
          {(() => {
            const ph = phase as "ks4" | "ks5";
            const present = QUALIFICATION_FAMILIES[ph].filter((f) => items.some((i) => familyOfItem(ph, i) === f.id));
            // Pre-ticked from the real current selection: every family that holds at least
            // one ticked subject. (Onboarding pre-ticks everything with data instead; that
            // default is for someone who has not chosen yet.)
            const derived = present.filter((f) => tickedItems.some((i) => familyOfItem(ph, i) === f.id)).map((f) => f.id);
            const selected = quickFamilies ?? derived;
            const toggleQuickFamily = (id: string) => {
              if (selected.includes(id)) {
                setQuickFamilies(selected.filter((f) => f !== id));
                // As in onboarding: a family's subjects go with it, rather than staying
                // saved, hidden from the picker, and still on every card above.
                const drop = new Set(items.filter((i) => familyOfItem(ph, i) === id).map((i) => i.key));
                if (ticked.some((k) => drop.has(k))) persist(ticked.filter((k) => !drop.has(k)));
              } else {
                setQuickFamilies([...selected, id]);
              }
            };
            const toggleQuickSubject = (key: string) => {
              if (quickFamilies === null) setQuickFamilies(derived);
              toggle(key);
            };
            const open = present.filter((f) => selected.includes(f.id));
            // A tile is only offered where the school has real entries, so the mockup's
            // "ticked but nothing to pick underneath it" note cannot arise here.
            return present.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">No subject entries recorded for this school.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <QualificationFamilyTiles
                  phase={ph}
                  families={present}
                  selected={selected}
                  onToggle={toggleQuickFamily}
                  subjectCounts={Object.fromEntries(present.map((f) => [f.id, items.filter((i) => familyOfItem(ph, i) === f.id).length]))}
                />
                {open.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-[var(--muted3)]">
                    Tick {present.map((f) => f.label).join(" or ")} above to choose subjects.
                  </p>
                ) : (
                  <CategorySubjectPicker
                    families={open}
                    items={toPickerItems(ph, items.filter((i) => selected.includes(familyOfItem(ph, i))))}
                    ticked={ticked}
                    onToggle={toggleQuickSubject}
                    onSetTicked={(next) => {
                      if (quickFamilies === null) setQuickFamilies(derived);
                      persist(next);
                    }}
                    theme={theme}
                  />
                )}
              </div>
            );
          })()}
        </TeacherModal>
      )}
      {chooser && savedSets && schoolUrn && (
        <ComparatorSetChooser
          payload={savedSets}
          phase={phase}
          theme={theme}
          targetUrn={schoolUrn}
          targetName={schoolName ?? "This school"}
          initialEdit={chooser.editing}
          onClose={() => setChooser(null)}
          onSetsChanged={reloadSavedSets}
          onDone={async (choice) => {
            setChooser(null);
            // A saved set is switched on by its own id; anything else is kept as the
            // chooser's own choice, which the column resolves and shows by name.
            if (choice.kind === "saved") {
              await setColumnSettings([[setKey("rankings"), savedSetKey(choice.id)], [CHOOSER_KEY, null]]);
            } else {
              await setColumnSettings([[CHOOSER_KEY, JSON.stringify(choice)], [setKey("rankings"), CHOOSER_SET_ID]]);
            }
          }}
        />
      )}
    </main>
    </TableLayoutContext.Provider>
    </>
  );
}

// 0.6 snag 2 (B): the editor drawn in place of the Teacher page. The host object is
// rebuilt each render, so the school is held stable here (the editor reloads the school's
// subjects when it changes). The linked-dashboard switcher moves the editor between
// Candidates and Results here, without touching the page's own (saved) choice.
function InPlaceEditor({ slug: pageSlug, host }: { slug: string; host: InPlaceHost }) {
  const [slug, setSlug] = useState(pageSlug);
  const urn = host.school?.urn ?? null;
  const name = host.school?.name ?? null;
  const school = useMemo(() => (urn ? { urn, name: name ?? urn } : null), [urn, name]);
  const labelsKey = JSON.stringify(host.labels ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => host.labels, [labelsKey]);
  return <EditorScreen id={slug} host={{ ...host, school, labels, onSwitch: setSlug }} />;
}

// An embedded view's loading and error states, at whatever size its frame gives it.
function EmbedStatus({ text }: { text: string }) {
  return <div className="flex h-full min-h-[120px] items-center justify-center p-3 text-center text-[12.5px] text-[var(--muted)]">{text}</div>;
}
