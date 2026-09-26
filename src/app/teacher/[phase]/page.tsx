"use client";

// Teacher view phase dashboard (design brief v2 §§5, 6, 7, 14).
//
// §5's four questions, pointed at this phase's axis. §6's four-step walkthrough is what
// unlocks the dashboard, once, per person, per phase. §14: every heading is the real
// question it answers, and the onboarding live-count moment is protected -- ticking a
// subject moves a real count immediately, which is the first thing a new user feels.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { completeOnboarding, fetchOnboardedPhases, fetchPreferences, savePreferences, fetchNotes, saveNote, hasNewData, markPeriodSeen, NAV_LABELS_KEY, saveNavLabels, againstKey, chosenKey, measureKey, panelNoteKey, readList, readSetting, setKey, writeList, writeSetting, type ColumnState } from "@/lib/teacher-view-data";
import { ExportButton, useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { PhoneNav, TeacherNav } from "@/components/teacher/TeacherNav";
import { CardBox } from "@/components/teacher/CardBox";
import { ExpandIcon, MODAL_CLOSE_BUTTON_CLASS, TeacherModal } from "@/components/teacher/TeacherModal";
import { DashboardGrid } from "@/components/teacher/DashboardGrid";
import { DashboardColumn } from "@/components/teacher/DashboardColumn";
import { CandidatesPanels } from "@/components/teacher/CandidatesPanels";
import { SubjectPanels, type SubjectSeries } from "@/components/teacher/SubjectPanels";
import { ComparisonsPanels, type ComparatorSchool, type MapChip, type SchoolSeries, type SetOption } from "@/components/teacher/ComparisonsPanels";
import { ComparatorSetChooser } from "@/components/teacher/ComparatorSetChooser";
import { fetchSavedSets, savedSetKey, type SavedComparatorSet, type SavedSetsPayload } from "@/lib/teacher-view-saved-sets";
import { ControlBar, type FocusSubject, type SharedMeasure } from "@/components/teacher/ControlBar";
import { MeasurePicker } from "@/components/teacher/MeasurePicker";
import { ContextPills, type CompareAgainstId } from "@/components/teacher/ContextPills";
import { ENTRIES_MEASURE, combine, headlineMeasure, measureById, measuresFor, meanOf, panelsFrom, type PanelId } from "@/lib/teacher-view-panels";
import { thresholdRate } from "@/lib/subject-grades";
import { shortSubjectLabels } from "@/lib/subject-short-labels";
import { POINTS_BEARING_QUALIFICATION, shortQualificationLabel } from "@/components/data-view/SubjectAreaSection";
import { PHASE_ACCENT, SOURCE_NAME, academicYearLabel, colourByGroup, qualificationShortLabel, QUALIFICATION_FAMILIES, qualificationFamilyOf } from "@/lib/teacher-view-theme";
import { comparabilityKey, familyFor, familyLabelFor } from "@/lib/teacher-view-catalogue";
import { QualificationFamilyTiles } from "@/components/teacher/QualificationFamilyTiles";
import { CategorySubjectPicker } from "@/components/teacher/CategorySubjectPicker";
import { COLUMN_ICON_PATHS } from "@/components/teacher/DashboardColumn";
import { COLUMN_TITLE, defaultBoxTitle } from "@/lib/teacher-view-catalogue";
import { candidatesMoved, resultsMoved } from "@/lib/teacher-view-this-moved";
import { type RankedSchool, type RankingsSetId } from "@/lib/teacher-view-rankings";
import { PHASE_LABELS, PHASE_QUESTIONS, TEACHER_PHASES, type TeacherPhase } from "@/lib/teacher-view-phases";
import { bucketFor, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";
import { deserializeAcademicProfile, subjectYearsFor, type AcademicSchoolProfile, type AcademicSubjectHeadlineEntry, type SubjectEntry, type SubjectGradeCount } from "@/lib/academic-data-view";

// §3: the picker works at real taught-qualification level, not subject-family level --
// "someone might teach AS Maths but not Statistics". So an item is a (subject,
// qualification) pair, not a subject.
type SubjectItem = { key: string; subject: string; qualificationType: string; label: string; entries: number };

function buildSubjectItems(entries: SubjectEntry[]): SubjectItem[] {
  const latest = entries.length ? Math.max(...entries.map((e) => e.period)) : null;
  if (latest === null) return [];
  const byKey = new Map<string, SubjectItem>();
  for (const e of entries) {
    if (e.period !== latest) continue;
    const key = `${e.subject}::${e.qualificationType}`;
    const existing = byKey.get(key);
    if (existing) existing.entries += e.entries;
    else byKey.set(key, { key, subject: e.subject, qualificationType: e.qualificationType, label: e.subject, entries: e.entries });
  }
  // Only disambiguate where this school really runs the same subject under more than one
  // qualification -- otherwise every row carries a noisy suffix it does not need.
  const qualsPerSubject = new Map<string, Set<string>>();
  for (const it of byKey.values()) {
    const set = qualsPerSubject.get(it.subject) ?? new Set<string>();
    set.add(it.qualificationType);
    qualsPerSubject.set(it.subject, set);
  }
  for (const it of byKey.values()) {
    if ((qualsPerSubject.get(it.subject)?.size ?? 0) > 1) it.label = `${it.subject} (${it.qualificationType})`;
  }
  return Array.from(byKey.values()).sort((a, b) => b.entries - a.entries);
}

// The onboarding steps only ever run for GCSE and Post-16, which always have an accent.
function accentFor(phase: "ks4" | "ks5"): { hex: string; rgb: string } {
  return PHASE_ACCENT[phase] as { hex: string; rgb: string };
}

export default function TeacherPhaseDashboard() {
  const params = useParams<{ phase: string }>();
  const phase = (TEACHER_PHASES as readonly string[]).includes(params.phase) ? (params.phase as TeacherPhase) : null;
  const supabase = createBrowserSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Set by the loader's own session check. The site NavBar is hidden on this route and
  // TeacherNav only renders past the error screen, so a signed-out visitor needs a Login
  // link on the error screen itself or they have no way to sign in from here.
  const [signedOut, setSignedOut] = useState(false);
  const [schoolUrn, setSchoolUrn] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  // Round 6 (§6.5): the real per-grade rows behind the threshold measure. They were
  // already in this route's payload and simply never read -- see subject-grades.ts.
  const [gradeRows, setGradeRows] = useState<SubjectGradeCount[]>([]);
  const [headline, setHeadline] = useState<AcademicSubjectHeadlineEntry[]>([]);
  const [rollAtAge10, setRollAtAge10] = useState<number | null>(null);
  const [neighbours, setNeighbours] = useState<(RankedSchool & { distanceKm: number | null })[]>([]);
  const [headlineLabel, setHeadlineLabel] = useState<string>("");
  // Round 6 (§6.4): the four real comparator sets, and every school in them with its own
  // real per-year history for both measures. All of it already existed in the route's own
  // fetch -- rankSets simply collapsed each school to its latest figure and dropped the
  // rest. No fabricated drift, and no new ingestion.
  const [comparatorSets, setComparatorSets] = useState<Partial<Record<RankingsSetId, ComparatorSchool[]>>>({});
  const [seriesByUrn, setSeriesByUrn] = useState<Record<string, SchoolSeries>>({});
  // Accordion round Part 3: the saved comparator sets (the teacher's own and the school's
  // shared ones), fetched after the main load and again after the chooser saves. Merged
  // into the same comparator-set map as the four presets, keyed "saved:<id>", so the
  // pill, the validity check and the per-subject map fetch all treat them alike.
  const [savedSets, setSavedSets] = useState<SavedSetsPayload | null>(null);
  const [chooser, setChooser] = useState<{ editing: SavedComparatorSet | null; startingFrom: { label: string; urns: string[] } | null } | null>(null);
  const [setInfo, setSetInfo] = useState<{ targetIndependent: boolean; targetCohortSize: number | null } | null>(null);
  // The Results card's anchor -- see englandAverages in the dashboard route for why the
  // basis is the qualification bucket at Post-16 and the subject itself at GCSE.
  const [englandAvg, setEnglandAvg] = useState<{ basis: "bucket" | "subject"; values: { key: string; period: number; value: number }[] } | null>(null);
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
      const { data: membership } = await supabase
        .from("school_memberships")
        .select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
        .eq("status", "approved")
        .maybeSingle<{ school_accounts: { school_urn: string; schools: { current_name: string } | null } | null }>();
      const urn = membership?.school_accounts?.school_urn ?? null;
      setSchoolUrn(urn);
      setSchoolName(membership?.school_accounts?.schools?.current_name ?? null);
      if (!urn) { setError("Teacher view is available to verified school staff."); setLoading(false); return; }

      const res = await fetch(`/api/teacher/dashboard?urn=${encodeURIComponent(urn)}&phase=${phase}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setEntries(body.subjectData?.entries ?? []);
        setGradeRows(body.subjectData?.gradeDistribution ?? []);
        setHeadline(body.headline ?? []);
        loadedHeadline = body.headline ?? [];
        setRollAtAge10(body.rollAtAge10 ?? null);
        setNeighbours(body.neighbours ?? []);
        setHeadlineLabel(body.headlineLabel ?? "");
        setComparatorSets(body.comparatorSets ?? {});
        setSeriesByUrn(body.seriesByUrn ?? {});
        setSetInfo(body.setInfo ?? null);
        setEnglandAvg(body.englandAverages ?? null);
      } else {
        setError("Could not load this school's data. Try again.");
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
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.phase]);

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
  const allComparatorSets = useMemo<Record<string, ComparatorSchool[] | undefined>>(
    () => ({
      ...comparatorSets,
      ...Object.fromEntries((savedSets?.sets ?? []).map((set) => [savedSetKey(set.id), set.rows])),
    }),
    [comparatorSets, savedSets],
  );
  const comparatorUrns = useMemo(
    () => Array.from(new Set(Object.values(allComparatorSets).flatMap((set) => (set ?? []).map((r) => r.urn)))).sort(),
    [allComparatorSets],
  );

  const reloadSavedSets = useCallback(async () => {
    if (!schoolUrn || !phase) return;
    setSavedSets(await fetchSavedSets(supabase, schoolUrn, phase));
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

  useEffect(() => {
    if (!schoolUrn || !onboarded || comparatorUrns.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const urns = comparatorUrns.join(",");
      const res = await fetch(
        // includeSubjects=1: the subject chips need each school's per-subject rows, and
        // since round 7 so do Graph, Ranking, Trend and % change.
        `/api/data-view/academic-schools?anchorUrn=${encodeURIComponent(schoolUrn)}&urns=${encodeURIComponent(urns)}&includeSubjects=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (cancelled) return;
      if (!res.ok) { setMapProfiles([]); return; }
      const body = await res.json();
      if (!cancelled) setMapProfiles((body.profiles ?? []).map(deserializeAcademicProfile));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolUrn, onboarded, comparatorUrns]);

  const items = useMemo(() => buildSubjectItems(entries), [entries]);
  const tickedItems = useMemo(() => items.filter((i) => ticked.includes(i.key)), [items, ticked]);
  // The live count §6 and §14 both single out: ticking a subject moves this immediately.
  const liveCount = useMemo(() => tickedItems.reduce((sum, i) => sum + i.entries, 0), [tickedItems]);

  const persist = useCallback(
    async (next: string[]) => {
      setTicked(next);
      if (schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, subjects: next });
      }
    },
    [schoolUrn, phase, supabase],
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
      if (schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [columns, schoolUrn, phase, supabase],
  );

  // A column's "which data" choice -- the measure its three panels all point at, and in
  // Context the comparison group too. Saved alongside the panels, because coming back to
  // a card showing a DIFFERENT NUMBER from the one you left is disorienting in a way that
  // coming back to the same number drawn differently is not.
  const setColumnSetting = useCallback(
    async (key: string, value: string | null) => {
      const next = writeSetting(columns, key, value);
      setColumns(next);
      if (schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [columns, schoolUrn, phase, supabase],
  );

  // The nav's label toggle, saved through the same path as every column setting. That
  // store is keyed per phase, and a nav toggle that flipped back when you used the nav's
  // own phase switcher would read as a bug -- so it is written to every onboarded phase's
  // row, not just this one. Each row is read-modify-written like setColumnSetting does.
  const setNavLabels = useCallback(
    async (on: boolean) => {
      await setColumnSetting(NAV_LABELS_KEY, on ? null : "off");
      if (!schoolUrn || !phase) return;
      await saveNavLabels(supabase, schoolUrn, onboardedPhases.filter((p) => p !== phase), on);
    },
    [setColumnSetting, onboardedPhases, schoolUrn, phase, supabase],
  );

  // Context's "Selected subjects" tick set, saved the same way its measure is.
  const setColumnList = useCallback(
    async (key: string, values: string[]) => {
      const next = writeList(columns, key, values);
      setColumns(next);
      if (schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [columns, schoolUrn, phase, supabase],
  );

  // A subject's latest real score, with its year so the England anchor can be read for the
  // SAME year. At GCSE only "GCSE (9-1) Full Course" carries points (the Data View's
  // POINTS_BEARING_QUALIFICATION): headline rows are keyed by subject alone there, so
  // without this gate an OCR or BTEC row for the same subject showed the GCSE score as
  // its own.
  const resultsFor = useCallback(
    (item: SubjectItem): { value: number; period: number } | null => {
      if (phase === "ks4" && item.qualificationType !== POINTS_BEARING_QUALIFICATION.ks4) return null;
      const bucket: Ks5Bucket | null = phase === "ks5" ? bucketFor(item.qualificationType) : null;
      const rows = headline
        .filter((h) => h.subject === item.subject && (bucket === null || (h.bucket ?? "all") === bucket) && h.avgPointScore !== null)
        .sort((a, b) => a.period - b.period);
      const last = rows[rows.length - 1];
      return last ? { value: last.avgPointScore as number, period: last.period } : null;
    },
    [headline, phase],
  );

  // §6/§14: never a bare number. The anchor is the England average (it used to be this
  // school's own average across its subjects, which compares a subject with its
  // neighbours down the corridor, not with the country). Same year as the score or no
  // anchor at all: a delta against a different year is a difference nobody measured.
  const englandFor = useCallback(
    (item: SubjectItem, score: { period: number }): number | null => {
      if (!englandAvg || !phase || phase === "ks2") return null;
      // GCSE rows are keyed by subject, spelt as the headline rows spell it.
      const key = englandAvg.basis === "bucket" ? comparabilityKey(phase, item.qualificationType) : item.subject;
      return englandAvg.values.find((v) => v.key === key && v.period === score.period)?.value ?? null;
    },
    [englandAvg, phase],
  );

  if (loading) return <main className="mx-auto max-w-4xl p-6"><p className="text-sm text-neutral-500">Loading…</p></main>;
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
    const names = new Set(tickedItems.map((i) => i.subject));
    const buckets = new Set<string>(
      phase === "ks5" ? tickedItems.map((i) => (bucketFor(i.qualificationType) ?? "other") as string) : [],
    );
    const rows = headline.filter(
      (h) => names.has(h.subject) && h.avgPointScore !== null && (phase !== "ks5" || buckets.has(h.bucket ?? "all")),
    );
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
          ? "Average point score per entry for what you ticked, against the England GCSE average for each subject. Each qualification is shown on its own — never blended into one."
          : "Average point score per entry for what you ticked, against the England average for the same qualification. Each qualification is shown on its own — never blended into one.",
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

  // Round 6: the per-subject series the Results and Context panels plot. One value per
  // ticked subject per published year, read from the SAME `headline` rows the card
  // already used for its latest-year figure -- grouped by period rather than collapsed to
  // the last one. Nothing is derived a second way, so the panels and the old headline
  // figure can never disagree.
  const bucketOf = (i: SubjectItem): string | null => (phase === "ks5" ? comparabilityKey(phase, i.qualificationType) : null);

  const headlineRowsFor = (i: SubjectItem, period: number) => {
    const bucket = bucketOf(i);
    return headline.filter((h) => h.subject === i.subject && (bucket === null || (h.bucket ?? "all") === bucket) && h.period === period);
  };

  // At KS4 only "GCSE (9-1) Full Course" carries points, and headline rows there are keyed
  // by subject alone -- so without this gate an OCR or BTEC row for the same subject shows
  // the GCSE score as its own. The same guard resultsFor already applies.
  const pointsAt = (i: SubjectItem, period: number): number | null => {
    if (phase === "ks4" && i.qualificationType !== POINTS_BEARING_QUALIFICATION.ks4) return null;
    const vals = headlineRowsFor(i, period).map((h) => h.avgPointScore).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const entriesAt = (i: SubjectItem, period: number): number | null => {
    const rows = headlineRowsFor(i, period);
    return rows.length ? rows.reduce((a, h) => a + (h.entriesTotal ?? 0), 0) : null;
  };

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
  const englandAt = (i: SubjectItem, period: number): number | null => {
    if (!englandAvg || phase === "ks2") return null;
    const key = englandAvg.basis === "bucket" ? comparabilityKey(phase, i.qualificationType) : i.subject;
    return englandAvg.values.find((v) => v.key === key && v.period === period)?.value ?? null;
  };

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
  const thresholdAt = (i: SubjectItem, period: number): number | null => {
    const rows = gradeRows.filter(
      (g) => g.subject === i.subject && g.qualificationType === i.qualificationType && g.period === period,
    );
    return thresholdRate(rows, phase)?.rate ?? null;
  };

  // Which measure Results' three panels are pointed at. Persisted per column, so the card
  // comes back showing the figure it was left showing.
  const resultsMeasures = measuresFor(phase);
  const resultsMeasure = measureById(phase, readSetting(columns, measureKey("results")) ?? resultsMeasures[0].id);
  const usingThreshold = resultsMeasure.id === "threshold";

  const valueForResults = (i: SubjectItem, period: number) =>
    usingThreshold ? thresholdAt(i, period) : pointsAt(i, period);

  // ------------------------------------------ Column 1's category (content round S6-S7)
  //
  // Column 1 reads the focused subject against the OTHER subjects this school runs in the
  // same taxonomy category (Maths against the rest of Sciences & Maths), replacing the
  // multi-subject bars S5 removed. The grouping is not new: it is the same familyFor
  // lookup Context's "Other subjects in ..." option used, fixed to the focused subject's
  // category rather than chosen. Members are this school's own (subject, qualification)
  // items, focused subject first, then the rest by entries.
  const focusFamilyId = focusItem ? familyFor(headline, focusItem.subject)?.id ?? null : null;
  const focusFamilyLabel = focusItem ? familyLabelFor(headline, focusItem.subject) ?? "its category" : null;
  const categoryItems: SubjectItem[] = focusItem
    ? [
        focusItem,
        ...items
          .filter((i) => i.key !== focusItem.key && focusFamilyId !== null && familyFor(headline, i.subject)?.id === focusFamilyId)
          .sort((a, b) => b.entries - a.entries),
      ]
    : [];
  // The peers are context, not the teacher's own subjects, so they take one muted colour
  // and the focused subject keeps its qualification colour.
  const PEER_COLOUR = "var(--muted3)";
  // S7: the England category line gets its own colour so it is not a second grey dash.
  const ENGLAND_COLOUR = "#60a5fa";
  const categoryColour = (i: SubjectItem) => (i.key === focusKey ? colourOf(i) : PEER_COLOUR);

  // Trend/% change redesign step 1: Candidates reads entries from `headline` (entriesAt),
  // whose grain is one row per SUBJECT at GCSE -- entries already summed across its
  // qualifications -- and per (subject, bucket) at Post-16. Two items that map to the same
  // row (GCSE and BTEC Art) would otherwise both show Art's whole total, so the category
  // is taken once per headline row here, focused subject first.
  const candidateItems = categoryItems.filter(
    (i, idx) => categoryItems.findIndex((o) => o.subject === i.subject && bucketOf(o) === bucketOf(i)) === idx,
  );
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
  const resultsPeriods = usingThreshold
    ? categoryPeriods.filter((p) => categoryItems.some((i) => thresholdAt(i, p) !== null))
    : categoryPeriods;

  // The threshold measure has no published England figure to sit against -- the national
  // anchor this app holds is points per entry, per subject. So its bars carry no marker
  // and its table's third column falls back to change, rather than a delta against a
  // number nobody published.
  //
  // S7: at GCSE every member carries its own England marker (the per-subject national
  // figure exists for all of them). At Post-16 the national figure is only per
  // qualification BUCKET, not per subject, so only the focused subject keeps the marker it
  // always had and the peers carry none -- the per-subject KS5 backend is a separate,
  // already-logged round.
  const categoryShort = shortLabelsFor(categoryItems);
  const resultsSeries: SubjectSeries[] = categoryItems
    .map((i) => ({
      key: i.key,
      label: i.label,
      shortLabel: categoryShort.get(i.key) ?? i.subject,
      colour: categoryColour(i),
      values: resultsPeriods.map((p) => valueForResults(i, p)),
      benchmark: usingThreshold || (phase !== "ks4" && i.key !== focusKey) ? undefined : resultsPeriods.map((p) => englandAt(i, p)),
    }))
    // A peer with no figure at all on this measure (at GCSE, a BTEC or Cambridge National
    // on points) says nothing about the category, so it is left out rather than drawn
    // as an empty row. The focused subject always stays.
    .filter((r) => r.key === focusKey || r.values.some((v) => v !== null));

  // S6: the category's own per-subject average, self-inclusive (the convention Context's
  // group and the comparator-set averages already use). S7, GCSE and points only: what
  // England scores across the SAME subjects -- the mean of each member's national figure --
  // so "how this category does here" sits beside "how it does nationally".
  const resultsGroups: { label: string; values: (number | null)[]; colour?: string }[] =
    resultsSeries.length < 2
      ? []
      : [
          { label: `${focusFamilyLabel} average`, values: resultsPeriods.map((_, pi) => meanOf(resultsSeries.map((r) => r.values[pi]))) },
          ...(phase === "ks4" && !usingThreshold
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
  const contextMeasure = showingResults ? resultsMeasure : ENTRIES_MEASURE;
  // S8: "area" is no longer an option here (Column 1 owns the category comparison now), so
  // a saved "area" from before reads as the default rather than as a third state.
  const contextAgainst: CompareAgainstId = readSetting(columns, againstKey("context")) === "selected" ? "selected" : "whole";
  const contextSelected = readList(columns, chosenKey("context"));


  // One value per SUBJECT NAME per period, for whichever measure is active. Group members
  // are subjects of the whole school, not just the ticked ones, so they are addressed by
  // name rather than by the ticked list's (subject, qualification) key.
  const groupValueFor = (subject: string, period: number): number | null => {
    const rows = headline.filter((h) => h.subject === subject && h.period === period);
    if (rows.length === 0) return null;
    if (contextMeasure.id === "entries") {
      return rows.reduce((a, h) => a + (h.entriesTotal ?? 0), 0);
    }
    if (contextMeasure.id === "points") {
      const vals = rows.map((h) => h.avgPointScore).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    // Threshold: rate per qualification type, then the mean of the ones that have a bar.
    // Pooling every grade row for a subject would mix scales -- a GCSE 9-1 row beside a
    // vocational Pass -- and score them against a bar only one of them is on.
    const quals = Array.from(
      new Set(gradeRows.filter((g) => g.subject === subject && g.period === period).map((g) => g.qualificationType)),
    );
    const rates = quals
      .map((qt) => thresholdRate(gradeRows.filter((g) => g.subject === subject && g.qualificationType === qt && g.period === period), phase)?.rate)
      .filter((v): v is number => v !== undefined && v !== null);
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  };

  // §4.2: the group is SELF-INCLUSIVE -- it contains the subject being compared, matching
  // the convention the comparator-set averages already use elsewhere.
  const contextMembers: string[] = (() => {
    const every = Array.from(new Set(headline.map((h) => h.subject)));
    if (contextAgainst === "selected") {
      const names = new Set(items.filter((i) => contextSelected.includes(i.key)).map((i) => i.subject));
      // Nothing ticked yet falls back to the subjects this person teaches, which is the
      // most useful "not chosen yet" group and is one click from being narrowed.
      return names.size ? every.filter((n) => names.has(n)) : Array.from(new Set(tickedItems.map((i) => i.subject)));
    }
    return every;
  })();

  const contextGroupLabel = contextAgainst === "selected" ? "Selected subjects" : "Whole school";

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
    return thresholdAt(i, period);
  };

  const contextPeriods =
    contextMeasure.id === "threshold"
      ? subjectPeriods.filter((p) => tickedItems.some((i) => thresholdAt(i, p) !== null))
      : subjectPeriods;
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
  const contextItems = focusItem
    ? [
        focusItem,
        ...items.filter(
          (i) => i.key !== focusItem.key && i.entries > 0 && (contextAgainst !== "selected" || contextMembers.includes(i.subject)),
        ),
      ]
    : [];
  const contextShort = shortLabelsFor(contextItems);
  const contextSeries: SubjectSeries[] = contextItems
    .map((i) => ({
      key: i.key,
      label: i.label,
      shortLabel: contextShort.get(i.key) ?? i.subject,
      colour: i.key === focusKey ? colourOf(i) : PEER_COLOUR,
      values: contextPeriods.map((p) => contextValueFor(i, p)),
      benchmark: atContextPeriod(contextGroupAverage),
    }))
    .filter((r) => r.key === focusKey || r.values.some((v) => v !== null));

  // ------------------------------------------------------------- Comparisons (§4.3)
  //
  // The four real comparator sets become the options in one "Compared against" pill
  // rather than four separate pinnable boxes competing for one of the column's three
  // panel slots (§6.7). Similar-sized is GCSE/Post-16 only -- KS2 publishes no exam-cohort
  // size to match on -- so it is offered only where the route really built it.
  const presetOptions: SetOption[] = (
    [
      { id: "nearest", label: "Nearest 10 schools" },
      { id: "same_sector", label: "Same sector schools" },
      { id: "local_rivals", label: "Local rivals" },
      { id: "similar_size", label: phase === "ks5" ? "Similar-sized sixth forms" : "Similar-sized schools" },
    ] as { id: RankingsSetId; label: string }[]
  )
    .filter((o) => comparatorSets[o.id] !== undefined)
    .map((o) => ({ ...o, group: "preset" as const }));
  // Accordion round Part 3: saved sets join the same list, in the wireframe's groups --
  // the teacher's own, then the school's shared ones.
  const savedOptions: SetOption[] = (savedSets?.sets ?? []).map((set) => ({
    id: savedSetKey(set.id),
    label: set.name,
    group: set.mine ? "mine" : "shared",
    meta: `${set.members.length} school${set.members.length === 1 ? "" : "s"}`,
    editable: set.editable,
  }));
  const comparatorSetOptions: SetOption[] = [...presetOptions, ...savedOptions];

  const savedSet = readSetting(columns, setKey("rankings"));
  const comparisonsSet: string =
    savedSet && allComparatorSets[savedSet] !== undefined ? savedSet : comparatorSetOptions[0]?.id ?? "nearest";
  const activeSavedSet = (savedSets?.sets ?? []).find((set) => savedSetKey(set.id) === comparisonsSet) ?? null;
  const activeSetLabel = comparatorSetOptions.find((o) => o.id === comparisonsSet)?.label ?? "Nearest 10 schools";


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

  // Round 8 §3: driven by the shared toggle, so this column's own measure pill is gone.
  // The figure still follows the focus subject (round 7 §9): with one in focus it is that
  // subject's own points per entry, otherwise the whole-school headline.
  const comparisonsMeasure = showingResults
    ? activeMapChip
      ? measuresFor(phase)[0]
      : headlineMeasure(phase, headlineLabel)
    : ENTRIES_MEASURE;

  // Each set's own caveat, kept from round 5 -- the reason a set is what it is belongs
  // beside the set, not in a tooltip.
  const comparatorSetNote =
    comparisonsSet === "same_sector" && setInfo
      ? setInfo.targetIndependent ? "Independent schools only" : "State schools only"
      : comparisonsSet === "similar_size" && setInfo?.targetCohortSize
        ? `This school: ${Math.round(setInfo.targetCohortSize).toLocaleString()} pupils in the exam cohort`
        : undefined;

  const comparatorEmptyText: string =
    comparisonsSet === "same_sector"
      ? `No nearby ${setInfo?.targetIndependent ? "independent" : "state"} schools of this phase to compare with.`
      : comparisonsSet === "local_rivals"
        ? "No nearby schools of this phase to compare with."
        : comparisonsSet === "similar_size"
          ? setInfo?.targetCohortSize
            ? "No nearby schools with a published cohort size to match."
            : "This school has no published cohort size to match on."
          : "No nearby schools with comparable published data for this phase.";

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

  // S11: each column's heading as one sentence naming the focused subject and what that
  // column reads it against. Falls back to the plain titles and §5 questions when no
  // subject is ticked yet, and at KS2, which has no subjects.
  const subjectHeadings = (() => {
    if (!focusItem || phase === "ks2") return null;
    const subj = focusItem.subject;
    const qual = qualificationShortLabel(phase, focusItem.qualificationType);
    const learners = phase === "ks5" ? "students" : "pupils";
    // A saved set is a name someone chose, so a sentence quotes it rather than lower-casing
    // it: "compares with the schools in "Grammar rivals"".
    const setLabel = activeSavedSet ? `schools in "${activeSavedSet.name}"` : activeSetLabel.toLowerCase();
    // Round 2 §6: every set label already carries its own noun ("Nearest 10 schools",
    // "Similar-sized sixth forms", "Local rivals"), so nothing is appended to it -- the
    // guard only adds "schools" if a future label arrives without one.
    const setNoun = activeSavedSet || /(schools|sixth forms|rivals)$/.test(setLabel) ? setLabel : `${setLabel} schools`;
    return {
      // Round 2 §2-§3: the title already names the subject, so the sentence says "this
      // subject" / "this GCSE" rather than repeating it. Candidates keeps the qualification
      // word -- GCSE vs A level vs BTEC is the useful part there.
      candidates: { title: `${subj} Candidates`, question: `how many ${learners} take this ${qual}.` },
      results: { title: `${subj} Results`, question: `how well ${learners} do in this subject.` },
      // Round 2 §4-§5: Context says something different per measure, and names the school.
      context: (() => {
        const against = contextAgainst === "selected" ? "the subjects you selected" : "the whole school";
        const at = schoolName ?? "your school";
        return {
          results: { title: `${subj} in Context`, question: `this subject's results compared with ${against} at ${at}.` },
          candidates: { title: `${subj} in Context`, question: `entry numbers compared with ${against} at ${at}.` },
        };
      })(),
      rankings: { title: `${subj} Comparisons`, question: `how this subject compares with the ${setNoun}.` },
    };
  })();
  const openSubjectPicker = () => setSubjectPickerOpen(true);

  return (
    // §7: the theme attribute is scoped to Teacher view, never to <html> -- see
    // TeacherChrome.tsx for why, and Q15.
    <main
      id="teacher-root"
      data-theme={theme}
      // The phase accent reaches every card and box as a custom property, so the shared
      // components never carry a phase-specific hex of their own.
      style={accent ? ({ "--accent": accent.hex, "--accent-rgb": accent.rgb } as React.CSSProperties) : undefined}
      // max-w-7xl is 80rem = 1280px, the laptop board's own width.
      className="mx-auto max-w-7xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6"
    >
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
          chrome={<ExportButton />}
        />
      </div>

      {/* §13's banner. States what actually changed and when, rather than just shouting. */}
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
      <DashboardGrid>
        {/* COLUMN 1, round 8 §2: Candidates and Results merged. One column, one Add
            control, one set of three panels, and the shared toggle decides which measure
            they are about. They used to be two columns with two pin sets; they now share
            one column key, so a panel set built in one mode is the same set in the other --
            the toggle changes what the panels are about, not which panels you kept. */}
        <DashboardColumn
          columnId={showingResults ? "results" : "candidates"}
          title={subjectHeadings ? subjectHeadings[showingResults ? "results" : "candidates"].title : showingResults ? COLUMN_TITLE.results : COLUMN_TITLE.candidates}
          question={subjectHeadings ? subjectHeadings[showingResults ? "results" : "candidates"].question : showingResults ? q.howWell : q.howMany}
          accented={!!accent}
          // §13's "NEW pill wherever something's actually changed" -- on the measure the
          // new data actually lands in, so it follows the toggle rather than sitting on a
          // column currently showing candidate counts.
          badge={showingResults && newDataPeriod !== null && (
            <span className="ml-2 rounded-sm bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
          )}
        >
          {phase === "ks2" ? (
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
          ) : showingResults ? (
            <SubjectPanels
              columnId={COL1}
              periods={resultsPeriods}
              // Content round S6: the focused subject and its category peers.
              subjects={resultsSeries}
              focus={focusKey}
              groups={resultsGroups}
              measure={resultsMeasure}
              controls={
                // §3's row-alignment fix: the Results sub-measure pill sits under this
                // column's own heading, the same slot Context's and Comparisons' pills
                // use -- not in the shared bar, where it existed in only one toggle state
                // and pushed the three columns' panels out of line with each other.
                <MeasurePicker
                  measures={resultsMeasures}
                  active={resultsMeasure}
                  onChange={(id) => setColumnSetting(measureKey("results"), id)}
                />
              }
              benchmarkLabel={usingThreshold ? undefined : "National"}
              benchmarkNoun={
                usingThreshold
                  ? undefined
                  : englandAvg?.basis === "subject"
                    ? "the England GCSE average for the subject"
                    : "the England average for the same qualification"
              }
              note={
                usingThreshold
                  ? `${resultsMeasure.label} is published per grade only from 2023/24, so this covers fewer years than average point score. Subjects graded on a vocational scale have no ${phase === "ks5" ? "A*–E" : "grade 4"} bar and show no figure.`
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
              currentLabel={resultsMeasure.id === "points" ? "Av. Points" : COLUMN_TITLE.results}
            />
          ) : (
            <CandidatesPanels
              phase={phase}
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
              groupLabel={`${focusFamilyLabel} average`}
              categoryLabel={focusFamilyLabel ?? undefined}
              panels={panelsOf(COL1)}
              onPanelsChange={(next) => setPanels(COL1, next)}
              question={q.howMany}
              source={panelSource}
              notes={notesFor(COL1)}
              currentLabel={COLUMN_TITLE.candidates}
            />
          )}
          {(showingResults ? movedResults : movedCandidates) && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {(showingResults ? movedResults : movedCandidates)!.sentence}
            </p>
          )}
        </DashboardColumn>

        <DashboardColumn
          columnId="context"
          title={subjectHeadings?.context[showingResults ? "results" : "candidates"].title ?? COLUMN_TITLE.context}
          question={subjectHeadings?.context[showingResults ? "results" : "candidates"].question ?? q.nearMe}
          accented={!!accent}
        >
          {phase === "ks2" ? (
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
              subjects={contextSeries}
              measure={contextMeasure}
              focus={focusKey}
              // Steps 9-10: Selected subjects is a bounded list, drawn like Column 1 ("individual");
              // the whole school is Option K ("curated").
              changeScope={contextAgainst === "selected" ? "individual" : "curated"}
              yearControl
              controls={
                <ContextPills
                  against={contextAgainst}
                  onAgainst={(id) => setColumnSetting(againstKey("context"), id)}
                  // S8: only subjects with real entries at the school in the latest year.
                  allSubjects={items.filter((i) => i.entries > 0).map((i) => ({ key: i.key, label: i.label, colour: colourOf(i) }))}
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
              benchmarkNoun={`the ${contextGroupLabel.toLowerCase()} average`}
              groups={[{ label: `${contextGroupLabel} average`, values: atContextPeriod(contextGroupAverage) }]}
              donut={{
                // §4.2: a share of an average point score is not a meaningful percentage,
                // so the donut is genuinely inert for a Results measure, not just greyed.
                enabled: contextMeasure.id === "entries",
                groupLabel: contextGroupLabel,
                groupTotals: atContextPeriod(contextGroupTotals),
                // Round 2 §3: the sentence names the school. The share is of ENTRIES (a
                // pupil sits several subjects), so it says "student entries" rather than
                // "students" -- see the round 2 build report.
                shareOf:
                  contextAgainst === "selected"
                    ? `entries in the subjects you selected at ${schoolName ?? "your school"}`
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
              note={
                contextMeasure.id === "threshold"
                  ? `${contextMeasure.label} is published per grade only from 2023/24, so this covers fewer years than the other measures.`
                  : undefined
              }
            />
          )}
        </DashboardColumn>

        <DashboardColumn
          columnId="rankings"
          title={subjectHeadings?.rankings.title ?? COLUMN_TITLE.rankings}
          question={subjectHeadings?.rankings.question ?? q.wider}
          accented={!!accent}
        >
          <ComparisonsPanels
            phase={phase}
            panels={panelsOf("rankings")}
            onPanelsChange={(next) => setPanels("rankings", next)}
            notes={notesFor("rankings")}
            question={q.wider}
            source={panelSource}
            headlineLabel={headlineLabel}
            setId={comparisonsSet}
            setOptions={comparatorSetOptions}
            onSetChange={(id) => setColumnSetting(setKey("rankings"), id)}
            setLabel={activeSetLabel}
            setNote={comparatorSetNote}
            schools={allComparatorSets[comparisonsSet] ?? []}
            seriesByUrn={activeMapChip ? comparatorSubjectSeries : { ...seriesByUrn, ...(savedSets?.seriesByUrn ?? {}) }}
            // Part 3: "Choose schools…" / "Edit" open the chooser. A new set starts from
            // whichever set is selected now.
            onManageSet={(id) => {
              if (!savedSets) return;
              const editing = id ? savedSets.sets.find((set) => savedSetKey(set.id) === id) ?? null : null;
              setChooser({
                editing,
                startingFrom: editing
                  ? null
                  : { label: activeSetLabel, urns: (allComparatorSets[comparisonsSet] ?? []).filter((r) => !r.isTarget).map((r) => r.urn) },
              });
            }}
            personalSetsNote={savedSets ? `${savedSets.personalCount} / ${savedSets.cap}` : undefined}
            subjectLabel={activeMapChip?.legend ?? null}
            seriesLoading={!!activeMapChip && mapProfiles === null}
            measure={comparisonsMeasure}
            schoolUrn={schoolUrn}
            mapProfiles={mapProfiles}
            activeMapChip={activeMapChip}
            mapRank={mapRank}
            onMapRank={setMapRank}
            emptyText={comparatorEmptyText}
            targetName={schoolName ?? "This school"}
            currentLabel={
              activeSavedSet
                ? `${showingResults ? "Results" : "Candidates"} against ${activeSavedSet.name}`
                : `${showingResults ? "Results" : "Candidates"} at the ${titleCase(activeSetLabel)}`
            }
          />
        </DashboardColumn>
      </DashboardGrid>

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
          editing={chooser.editing}
          startingFrom={chooser.startingFrom}
          targetUrn={schoolUrn}
          targetName={schoolName ?? "this school"}
          onClose={() => setChooser(null)}
          onSaved={async (id) => {
            setChooser(null);
            await reloadSavedSets();
            // A saved set becomes the one Comparisons reads; a deleted one that was
            // selected falls back to the first preset.
            if (id) await setColumnSetting(setKey("rankings"), savedSetKey(id));
            else if (activeSavedSet && activeSavedSet.id === chooser.editing?.id) await setColumnSetting(setKey("rankings"), null);
          }}
        />
      )}
    </main>
  );
}
