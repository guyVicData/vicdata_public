"use client";

// Teacher view phase dashboard (design brief v2 §§5, 6, 7, 14).
//
// §5's four questions, pointed at this phase's axis. §6's four-step walkthrough is what
// unlocks the dashboard, once, per person, per phase. §14: every heading is the real
// question it answers, and the onboarding live-count moment is protected -- ticking a
// subject moves a real count immediately, which is the first thing a new user feels.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { completeOnboarding, fetchOnboardedPhases, fetchPreferences, savePreferences, fetchNote, saveNote, hasNewData, markPeriodSeen, chosenKey, dropChosenForUnpinned, type ColumnState } from "@/lib/teacher-view-data";
import { ColumnBuilder } from "@/components/teacher/ColumnBuilder";
import { TeacherChrome, useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { CardBox } from "@/components/teacher/CardBox";
import { DashboardGrid } from "@/components/teacher/DashboardGrid";
import { DashboardColumn } from "@/components/teacher/DashboardColumn";
import { SharePie, type PieSlice } from "@/components/teacher/SharePie";
import { POINTS_BEARING_QUALIFICATION, shortQualificationLabel } from "@/components/data-view/SubjectAreaSection";
import { PHASE_ACCENT, DELTA_POSITIVE, DELTA_NEGATIVE, SOURCE_NAME, academicYearLabel, colourByGroup, qualificationShortLabel, QUALIFICATION_FAMILIES, qualificationFamilyOf } from "@/lib/teacher-view-theme";
import { comparabilityKey, familyFor } from "@/lib/teacher-view-catalogue";
import { QualificationFamilyTiles } from "@/components/teacher/QualificationFamilyTiles";
import { CategorySubjectPicker } from "@/components/teacher/CategorySubjectPicker";
import { COLUMN_ICON_PATHS } from "@/components/teacher/DashboardColumn";
import { RankingsMap } from "@/components/teacher/RankingsMap";
import { RankedSet, type RankedSetRow } from "@/components/teacher/RankedSet";
import { ViewChart } from "@/components/teacher/ViewChart";
import { defaultBoxTitle, type ColumnId, type SubjectRef, type ViewDef } from "@/lib/teacher-view-catalogue";
import { candidatesMoved, resultsMoved } from "@/lib/teacher-view-this-moved";
import { rankOf, type RankedSchool, type RankingsSetId } from "@/lib/teacher-view-rankings";
import { PHASE_LABELS, PHASE_QUESTIONS, TEACHER_PHASES, type TeacherPhase } from "@/lib/teacher-view-phases";
import { bucketFor, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";
import { deserializeAcademicProfile, type AcademicSchoolProfile, type AcademicSubjectHeadlineEntry, type SubjectEntry } from "@/lib/academic-data-view";

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

// §12: a personal, private note against a specific chart, visible only to its author.
// RLS enforces that at the database, so this component carries no ownership logic of its
// own -- it simply trusts the policy, which is the only place it can be enforced anyway.
function NoteBox({ schoolUrn, chartKey }: { schoolUrn: string | null; chartKey: string }) {
  const supabase = createBrowserSupabaseClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!schoolUrn) return;
      const existing = await fetchNote(supabase, schoolUrn, chartKey);
      setBody(existing ?? "");
      setSaved(existing);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolUrn, chartKey]);

  // A note is meaningless without a school to attach it to, and writing one scoped to an
  // empty urn would make it visible at every school. The dashboard already errors out
  // before rendering any card when there is no membership, so this is belt-and-braces.
  if (!schoolUrn) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        {saved ? "Your note" : "Add a private note"}
      </button>
    );
  }
  return (
    <div className="mt-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Only you can see this."
        className="w-full rounded-md border border-neutral-300 bg-transparent p-2 text-xs dark:border-neutral-700"
      />
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={async () => { if (!schoolUrn) return; await saveNote(supabase, schoolUrn, chartKey, body); setSaved(body.trim() || null); setOpen(false); }}
          className="rounded-md bg-blue-700 px-2 py-1 text-xs font-medium text-white"
        >
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500">Cancel</button>
      </div>
    </div>
  );
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
  const [schoolUrn, setSchoolUrn] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  const [headline, setHeadline] = useState<AcademicSubjectHeadlineEntry[]>([]);
  const [rollAtAge10, setRollAtAge10] = useState<number | null>(null);
  const [neighbours, setNeighbours] = useState<(RankedSchool & { distanceKm: number | null })[]>([]);
  const [headlineLabel, setHeadlineLabel] = useState<string>("");
  // Round 5: the Rankings card's other comparator sets, each already ranked by the
  // dashboard route, and the whole-cohort series Candidates' "% of year group" divides by.
  const [comparatorSets, setComparatorSets] = useState<Partial<Record<RankingsSetId, RankedSetRow[]>>>({});
  const [setInfo, setSetInfo] = useState<{ targetIndependent: boolean; targetCohortSize: number | null } | null>(null);
  const [cohortSeries, setCohortSeries] = useState<{ period: number; value: number }[]>([]);
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
  // Which subject chip the Rankings map is plotting (null = the first chip).
  const [mapChip, setMapChip] = useState<string | null>(null);
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
      if (!token) { setError("Sign in to see this dashboard."); setLoading(false); return; }
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
        setHeadline(body.headline ?? []);
        loadedHeadline = body.headline ?? [];
        setRollAtAge10(body.rollAtAge10 ?? null);
        setNeighbours(body.neighbours ?? []);
        setHeadlineLabel(body.headlineLabel ?? "");
        setComparatorSets(body.comparatorSets ?? {});
        setSetInfo(body.setInfo ?? null);
        setCohortSeries(body.cohortSeries ?? []);
        setEnglandAvg(body.englandAverages ?? null);
      } else {
        setError("Could not load this school's data. Try again.");
      }
      const done = await fetchOnboardedPhases(supabase, urn);
      setOnboarded(done.includes(phase));
      const prefs = await fetchPreferences(supabase, urn, phase);
      setTicked(prefs.subjects);
      setColumns(prefs.columns);

      // §13's "New-data-in", derived rather than pushed -- see hasNewData.
      const periods = (loadedHeadline as AcademicSubjectHeadlineEntry[]).map((h) => h.period);
      const latestPeriod = periods.length ? Math.max(...periods) : null;
      if (hasNewData(latestPeriod, prefs.lastSeenPeriod)) setNewDataPeriod(latestPeriod);
      await markPeriodSeen(supabase, urn, phase, latestPeriod);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.phase]);

  // The map's profiles come through /api/data-view/academic-schools -- the same membership-
  // gated route the advanced dashboard's map is fed from -- for exactly the schools this
  // card already ranks against. A separate effect rather than part of the loader above so
  // the dashboard renders without waiting for the map's heavier fetch.
  useEffect(() => {
    if (!schoolUrn || !onboarded || neighbours.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const urns = neighbours.map((n) => n.urn).join(",");
      const res = await fetch(
        // includeSubjects=1: the map's subject chips need each school's per-subject rows.
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
  }, [schoolUrn, onboarded, neighbours]);

  const items = useMemo(() => buildSubjectItems(entries), [entries]);
  const tickedItems = useMemo(() => items.filter((i) => ticked.includes(i.key)), [items, ticked]);
  // The live count §6 and §14 both single out: ticking a subject moves this immediately.
  const liveCount = useMemo(() => tickedItems.reduce((sum, i) => sum + i.entries, 0), [tickedItems]);
  const schoolTotal = useMemo(() => items.reduce((sum, i) => sum + i.entries, 0), [items]);

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

  // §7: "Saved state is now a hard requirement, not optional." Every tick round-trips
  // immediately -- there is no explicit save, so there is nothing to forget to press.
  // An empty pin list uses resetColumn's own shape (key removed) so "never customised"
  // and "reset" stay the same state rather than drifting into two.
  const setColumn = useCallback(
    async (columnId: string, pinned: string[]) => {
      const next: ColumnState = dropChosenForUnpinned(columns, columnId, pinned);
      if (pinned.length === 0) delete next[columnId];
      else next[columnId] = pinned;
      setColumns(next);
      if (schoolUrn && phase) {
        const prefs = await fetchPreferences(supabase, schoolUrn, phase);
        await savePreferences(supabase, schoolUrn, phase, { ...prefs, columns: next });
      }
    },
    [columns, schoolUrn, phase, supabase],
  );

  // The subjects a pinned "Vs. your comparison set" box compares against, saved with the
  // pins so the choice survives a reload (see chosenKey).
  const setChosen = useCallback(
    async (viewId: string, keys: string[]) => {
      const next: ColumnState = { ...columns };
      if (keys.length === 0) delete next[chosenKey(viewId)];
      else next[chosenKey(viewId)] = keys;
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

  // SubjectItem carries an entries count the catalogue has no use for; SubjectRef is the
  // narrower shape it actually needs.
  const asRefs = (list: SubjectItem[]): SubjectRef[] =>
    list.map((i) => ({ key: i.key, subject: i.subject, qualificationType: i.qualificationType, label: i.label }));

  if (loading) return <main className="mx-auto max-w-4xl p-6"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (error || !phase) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-sm text-amber-700 dark:text-amber-400">{error ?? "Unknown phase."}</p>
        <Link href="/teacher" className="mt-3 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400">Back</Link>
      </main>
    );
  }

  const q = PHASE_QUESTIONS[phase];
  const nearbyOnly = neighbours.filter((n) => !n.isTarget);
  const position = rankOf(neighbours, schoolUrn ?? "");

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
              ["rankings", "Rankings", q.wider],
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
  type MapChip = { key: string; subject: string; bucket: string | null; label: string; legend: string; hex: string };
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
      });
    }
  }
  const activeMapChip = mapChips.find((c) => c.key === mapChip) ?? mapChips[0] ?? null;

  // Round 6 (card content rebuild): the mockups' visual layer. Colour is per qualification
  // group, shared by the chip header, the Candidates bars, the Results scores and the pie.
  const accent = PHASE_ACCENT[phase];
  const groupColour = colourByGroup(phase, tickedItems);
  const colourOf = (i: SubjectItem) => groupColour.get(comparabilityKey(phase, i.qualificationType)) ?? "var(--muted)";
  const latestPeriod = entries.length ? Math.max(...entries.map((e) => e.period)) : null;
  const sourceLine = (extra = "") =>
    latestPeriod === null ? null : (
      <>
        Source: {SOURCE_NAME[phase]}, {academicYearLabel(latestPeriod)}
        {extra} &middot;{" "}
        <Link href="/sources" className="text-[var(--muted)] underline">Sources</Link>
      </>
    );
  // The pie's slices: one per qualification group, as the mockups draw it.
  const pieSlices: PieSlice[] = Array.from(groupColour.entries()).map(([key, color]) => {
    const inGroup = tickedItems.filter((i) => comparabilityKey(phase, i.qualificationType) === key);
    return {
      label: `${inGroup.map((i) => i.subject).join(" & ")} (${qualificationShortLabel(phase, inGroup[0].qualificationType)})`,
      value: inGroup.reduce((a, i) => a + i.entries, 0),
      color,
    };
  });

  // Round 5's non-axis views. Everything here reads data the dashboard already loaded.
  const renderSpecial = (v: ViewDef, fullscreen: boolean) => {
    if (v.axis === "share_of_cohort") {
      // Entries come from the latest year the subject rows cover, so the cohort must be
      // that same year's -- dividing this year's entries by last year's cohort would be
      // a figure about no real year group.
      const latest = entries.length ? Math.max(...entries.map((e) => e.period)) : null;
      const cohort = cohortSeries.find((c) => c.period === latest)?.value ?? null;
      if (tickedItems.length === 0) return <p className="mt-2 text-xs text-neutral-500">Tick a subject to see its share of the year group.</p>;
      if (!cohort) return <p className="mt-2 text-xs text-neutral-500">No published cohort size for {latest ?? "the latest year"}, so there is nothing to divide by.</p>;
      return (
        <>
          <p className="mt-1 text-[11px] text-neutral-500">
            Year group: {Math.round(cohort).toLocaleString()} pupils ({latest})
          </p>
          <ViewChart
            computed={{
              rows: tickedItems
                .map((i) => ({ label: i.label, value: (i.entries / cohort) * 100, isSubject: true }))
                .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
            }}
            unit="percent"
            scaleMax={100}
          />
          {fullscreen && (
            <p className="mt-3 text-xs text-neutral-500">
              Each pupil takes several subjects, so these shares are not meant to add up to 100%.
            </p>
          )}
        </>
      );
    }
    const setFor: Record<string, RankingsSetId> = {
      rank_list: "nearest",
      rank_same_sector: "same_sector",
      rank_local_rivals: "local_rivals",
      rank_similar_size: "similar_size",
    };
    const setId = setFor[v.axis];
    if (!setId) return null;
    const empty: Record<RankingsSetId, string> = {
      nearest: "No nearby schools with comparable published data for this phase.",
      same_sector: `No nearby ${setInfo?.targetIndependent ? "independent" : "state"} schools of this phase to compare with.`,
      local_rivals: "No nearby schools of this phase to compare with.",
      similar_size: setInfo?.targetCohortSize ? "No nearby schools with a published cohort size to match." : "This school has no published cohort size to match on.",
    };
    return (
      <>
        {setId === "same_sector" && setInfo && (
          <p className="mt-1 text-[11px] text-neutral-500">{setInfo.targetIndependent ? "Independent schools only" : "State schools only"}</p>
        )}
        {setId === "similar_size" && setInfo?.targetCohortSize && (
          <p className="mt-1 text-[11px] text-neutral-500">This school: {Math.round(setInfo.targetCohortSize).toLocaleString()} pupils in the exam cohort</p>
        )}
        <RankedSet
          rows={comparatorSets[setId]}
          headlineLabel={headlineLabel}
          formatValue={formatHeadline}
          showCohort={setId === "similar_size"}
          fullscreen={fullscreen}
          emptyText={empty[setId]}
        />
      </>
    );
  };

  const builderProps = {
    phase,
    ticked: asRefs(tickedItems),
    allSubjects: asRefs(items),
    headline,
    chosenFor: (viewId: string) => columns[chosenKey(viewId)] ?? [],
    onChosenChange: setChosen,
    renderSpecial,
  };

  return (
    // §7: the theme attribute is scoped to Teacher view, never to <html> -- see
    // TeacherChrome for why, and Q15.
    <main
      id="teacher-root"
      data-theme={theme}
      // The phase accent reaches every card and box as a custom property, so the shared
      // components never carry a phase-specific hex of their own.
      style={accent ? ({ "--accent": accent.hex, "--accent-rgb": accent.rgb } as React.CSSProperties) : undefined}
      // max-w-7xl is 80rem = 1280px, the laptop board's own width.
      className="mx-auto max-w-7xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{PHASE_LABELS[phase]}</h1>
        <div className="flex items-center gap-3">
          <TeacherChrome theme={theme} onTheme={setTheme} />
          <Link href="/teacher" className="text-sm text-blue-700 hover:underline print:hidden dark:text-blue-400">All dashboards</Link>
        </div>
      </div>
      {schoolName && <p className="mt-1 text-sm text-[var(--muted)]">{schoolName}</p>}

      {/* The mockups' subject header: one chip per ticked subject/qualification in its
          group colour, then "±" to change them. Changing subjects lives in the picker at
          the foot of this page, so that is where "±" goes. */}
      {phase !== "ks2" && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {tickedItems.map((i) => {
            const c = colourOf(i);
            return (
              <span
                key={i.key}
                className="rounded-full border px-2.5 py-[5px] text-xs font-semibold"
                style={{ background: `${c}1F`, color: c, borderColor: `${c}59` }}
              >
                {i.subject} &middot; {qualificationShortLabel(phase, i.qualificationType)}
              </span>
            );
          })}
          <a
            href="#subjects"
            aria-label="Change subjects"
            title="Change subjects"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--accent)] text-[13px] font-extrabold text-[var(--accent)] print:hidden"
          >
            &plusmn;
          </a>
        </div>
      )}

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
        <DashboardColumn columnId="candidates" question={q.howMany} accented={!!accent}>
          {/* Round 5: the column's default content is a box like any pinned view, titled
              from the catalogue rather than hardcoded here. */}
          <CardBox
            title={defaultBoxTitle("candidates", phase)}
            question={q.howMany}
            caption={phase === "ks2" ? undefined : "Entries this year, by qualification type — never blended into one number."}
            source={phase === "ks2" ? undefined : sourceLine()}
          >
            {({ fullscreen }) => (
              <>
                {phase === "ks2" ? (
                  <p className={`mt-2 font-semibold tabular-nums ${fullscreen ? "text-6xl" : "text-3xl"}`}>{rollAtAge10?.toLocaleString() ?? "—"}</p>
                ) : tickedItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Pick a subject below to see its entries.</p>
                ) : (
                  // One bar row per ticked subject/qualification -- never summed, so a
                  // GCSE and a vocational course in the same subject stay two rows.
                  <ViewChart
                    layout="labelled"
                    unit="entries"
                    computed={{
                      rows: tickedItems.map((i) => ({
                        label: i.subject,
                        sublabel: qualificationShortLabel(phase, i.qualificationType),
                        value: i.entries,
                        isSubject: true,
                        color: colourOf(i),
                      })),
                    }}
                  />
                )}
                {movedCandidates && (
                  <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    {movedCandidates.sentence}
                  </p>
                )}
              </>
            )}
          </CardBox>
          <ColumnBuilder columnId={"candidates" as ColumnId} {...builderProps} pinned={columns["candidates"] ?? []} onChange={(n) => setColumn("candidates", n)} />
          <NoteBox schoolUrn={schoolUrn} chartKey={`${phase}:candidates`} />
        </DashboardColumn>

        <DashboardColumn
          columnId="results"
          question={q.howWell}
          accented={!!accent}
          // §13's "NEW pill wherever something's actually changed" -- on the card the new
          // data actually lands in, not on every card.
          badge={newDataPeriod !== null && (
            <span className="ml-2 rounded-sm bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
          )}
        >
          <CardBox
            title={defaultBoxTitle("results", phase)}
            question={q.howWell}
            caption={
              phase === "ks2"
                ? undefined
                : englandAvg?.basis === "subject"
                  ? "Average point score per GCSE entry, vs. the England GCSE average for that subject."
                  : "Average point score per entry, vs. the England average for that same qualification."
            }
            source={phase === "ks2" ? undefined : sourceLine()}
          >
            {({ fullscreen }) => (
              <>
                {phase === "ks2" ? (
                  // KS2 has no subject picker -- every pupil sits the same tests -- so this
                  // card used to ask for a subject nobody could pick. Its result is the
                  // school's own headline, read against the nearest primaries (§14: never a
                  // bare number).
                  (() => {
                    const own = neighbours.find((n) => n.isTarget)?.value ?? null;
                    const others = neighbours.filter((n) => !n.isTarget && n.value !== null).map((n) => n.value!);
                    const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : null;
                    return own === null ? (
                      <p className="mt-2 text-sm text-neutral-500">No published {headlineLabel} for this school yet.</p>
                    ) : (
                      <>
                        <p className={`mt-2 font-semibold tabular-nums ${fullscreen ? "text-6xl" : "text-3xl"}`}>{formatHeadline(own)}</p>
                        <p className="text-sm text-neutral-500">
                          {headlineLabel}
                          {avg !== null && ` · nearest primaries average ${formatHeadline(avg)}`}
                        </p>
                      </>
                    );
                  })()
                ) : tickedItems.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-500">Pick a subject below to see its results.</p>
                ) : (
                  // Mockup row: subject · qualification on the left; score in the group
                  // colour on the right, then the delta against England -- green above,
                  // red below.
                  <ul className="flex flex-col gap-2">
                    {tickedItems.map((i) => {
                      const score = resultsFor(i);
                      const england = score ? englandFor(i, score) : null;
                      const delta = score && england !== null ? score.value - england : null;
                      return (
                        <li key={i.key} className="flex items-center justify-between gap-2">
                          <span className={`truncate font-semibold ${fullscreen ? "text-base" : "text-[12.5px]"}`}>
                            {i.subject}{" "}
                            <span className="font-medium text-[var(--muted3)]">&middot; {qualificationShortLabel(phase, i.qualificationType)}</span>
                          </span>
                          {score === null ? (
                            <span className="shrink-0 whitespace-nowrap text-[12.5px] text-[var(--muted3)]">no score</span>
                          ) : (
                            <span className={`shrink-0 font-extrabold tabular-nums ${fullscreen ? "text-xl" : "text-sm"}`} style={{ color: colourOf(i) }}>
                              {score.value.toFixed(1)}
                              {delta !== null && (
                                <span
                                  className="ml-1 text-[10.5px] font-semibold"
                                  style={{ color: delta >= 0 ? DELTA_POSITIVE : DELTA_NEGATIVE }}
                                  title={`England average ${england!.toFixed(1)} (${academicYearLabel(score.period)})`}
                                >
                                  {delta >= 0 ? "+" : "−"}{Math.abs(delta).toFixed(1)}
                                </span>
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {movedResults && (
                  <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    {movedResults.sentence}
                  </p>
                )}
              </>
            )}
          </CardBox>
          <ColumnBuilder columnId={"results" as ColumnId} {...builderProps} pinned={columns["results"] ?? []} onChange={(n) => setColumn("results", n)} />
          <NoteBox schoolUrn={schoolUrn} chartKey={`${phase}:results`} />
        </DashboardColumn>

        <DashboardColumn columnId="context" question={q.nearMe} accented={!!accent}>
          <CardBox
            title={defaultBoxTitle("context", phase)}
            question={q.nearMe}
            // The existing sentence is kept, as the caption under the pie rather than in
            // place of it.
            caption={
              phase === "ks2"
                ? undefined
                : schoolTotal > 0
                  ? `Your subjects are ${Math.round((liveCount / schoolTotal) * 100)}% of ${schoolTotal.toLocaleString()} entries across the ${phase === "ks5" ? "sixth form" : "school"} — share of every entry, not just how many take it.`
                  : "No entries recorded for this school."
            }
            source={phase === "ks2" ? undefined : sourceLine()}
          >
            {({ fullscreen }) =>
              phase === "ks2" ? (
                <>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    The {nearbyOnly.length} nearest primaries, by distance.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {/* Fullscreen has room for the whole set rather than the card's first five. */}
                    {nearbyOnly.slice(0, fullscreen ? nearbyOnly.length : 5).map((n) => (
                      <li key={n.urn} className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{n.name}</span>
                        <span className="tabular-nums text-neutral-500">
                          {n.distanceKm === null ? "" : `${n.distanceKm.toFixed(1)} km`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : schoolTotal > 0 ? (
                <SharePie slices={pieSlices} total={schoolTotal} fullscreen={fullscreen} />
              ) : null
            }
          </CardBox>
          <ColumnBuilder columnId={"context" as ColumnId} {...builderProps} pinned={columns["context"] ?? []} onChange={(n) => setColumn("context", n)} />
          <NoteBox schoolUrn={schoolUrn} chartKey={`${phase}:context`} />
        </DashboardColumn>

        <DashboardColumn columnId="rankings" question={q.wider} accented={!!accent}>
          <CardBox
            title={defaultBoxTitle("rankings", phase)}
            question={q.wider}
            source={phase === "ks2" ? undefined : sourceLine("; school locations from GIAS")}
          >
            {({ fullscreen }) => (
              <>
                {position ? (
                  <>
                    {/* §14: the position IS the anchor -- the figure never stands alone. */}
                    <p className="mt-2 text-3xl font-semibold tabular-nums">
                      {position.position}
                      <span className="ml-1 text-base font-normal text-neutral-500">of {position.outOf}</span>
                    </p>
                    <p className="text-sm text-neutral-500">
                      among the nearest schools with data, on {headlineLabel}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    No nearby schools with comparable published data for this phase.
                  </p>
                )}
                {/* Round 5: the real map, at card size here and near-viewport size in the
                    modal. The map is a live Leaflet map and does not print, so the list
                    below stays as the exportable form of the same ranking. */}
                {schoolUrn && neighbours.length > 0 && (
                  <div className="print:hidden">
                    {/* The mockup's chip row: the map plots one ticked subject at a time.
                        Filled in the subject's qualification colour when chosen, outlined
                        when not. With nothing ticked there are no chips and the map shows
                        the whole-school headline, as it always has. */}
                    {mapChips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-[5px]" role="group" aria-label="Subject shown on the map">
                        {mapChips.map((c) => {
                          const on = c.key === activeMapChip?.key;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setMapChip(c.key)}
                              className="rounded-full px-[9px] py-1 text-[10.5px] font-bold"
                              style={
                                on
                                  ? { background: c.hex, color: "#0a0a0b", border: `1.5px solid ${c.hex}` }
                                  : { background: "transparent", color: c.hex, border: `1.5px solid ${c.hex}80` }
                              }
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <RankingsMap
                      profiles={mapProfiles}
                      targetUrn={schoolUrn}
                      stage={phase}
                      heightClass={fullscreen ? "h-[70vh] min-h-[22rem]" : "h-72"}
                      subject={activeMapChip?.subject ?? null}
                      subjectLabel={activeMapChip?.legend ?? null}
                      subjectBucket={activeMapChip?.bucket ?? null}
                    />
                  </div>
                )}
                {position && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {[...neighbours]
                      .filter((n) => n.value !== null)
                      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                      .slice(0, fullscreen ? neighbours.length : 5)
                      .map((n) => (
                        <li key={n.urn} className={`flex items-baseline justify-between gap-2 ${n.isTarget ? "font-semibold" : ""}`}>
                          <span className="truncate">{n.name}</span>
                          <span className="tabular-nums">{n.value?.toFixed(1)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </CardBox>
          <ColumnBuilder columnId={"rankings" as ColumnId} {...builderProps} pinned={columns["rankings"] ?? []} onChange={(n) => setColumn("rankings", n)} />
          <NoteBox schoolUrn={schoolUrn} chartKey={`${phase}:rankings`} />
        </DashboardColumn>
      </DashboardGrid>

      {phase !== "ks2" && (
        <section id="subjects" className="mt-6 scroll-mt-4 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
          <h2 className="text-sm font-semibold">Which subjects do you teach?</h2>
          <p className="mt-1 text-xs text-neutral-500">Personal to you. Changing it updates every card above.</p>
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
        </section>
      )}
    </main>
  );
}
