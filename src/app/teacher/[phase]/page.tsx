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
import { completeOnboarding, fetchOnboardedPhases, fetchPreferences, savePreferences, fetchNote, saveNote, hasNewData, markPeriodSeen, type ColumnState } from "@/lib/teacher-view-data";
import { ColumnBuilder } from "@/components/teacher/ColumnBuilder";
import { TickList } from "@/components/teacher/TickList";
import { TeacherChrome, useTeacherTheme } from "@/components/teacher/TeacherChrome";
import type { ColumnId, SubjectRef } from "@/lib/teacher-view-catalogue";
import { candidatesMoved, resultsMoved } from "@/lib/teacher-view-this-moved";
import { rankOf, type RankedSchool } from "@/lib/teacher-view-rankings";
import { PHASE_LABELS, PHASE_QUESTIONS, TEACHER_PHASES, type TeacherPhase } from "@/lib/teacher-view-phases";
import { bucketFor, type Ks5Bucket } from "@/lib/dfe-qualification-buckets";
import type { AcademicSubjectHeadlineEntry, SubjectEntry } from "@/lib/academic-data-view";

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

function SubjectPicker({
  items,
  ticked,
  onToggle,
}: {
  items: SubjectItem[];
  ticked: string[];
  onToggle: (key: string) => void;
}) {
  // §14: the same TickList every other pick-list in Teacher view uses.
  return (
    <TickList
      items={items.map((i) => ({ key: i.key, label: i.label, trailing: i.entries }))}
      checked={(k) => ticked.includes(k)}
      onToggle={onToggle}
      empty="No subject entries recorded for this school."
    />
  );
}

// §12: a personal, private note against a specific chart, visible only to its author.
// RLS enforces that at the database, so this component carries no ownership logic of its
// own -- it simply trusts the policy, which is the only place it can be enforced anyway.
function NoteBox({ chartKey }: { chartKey: string }) {
  const supabase = createBrowserSupabaseClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const existing = await fetchNote(supabase, chartKey);
      setBody(existing ?? "");
      setSaved(existing);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey]);

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
          onClick={async () => { await saveNote(supabase, chartKey, body); setSaved(body.trim() || null); setOpen(false); }}
          className="rounded-md bg-blue-700 px-2 py-1 text-xs font-medium text-white"
        >
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500">Cancel</button>
      </div>
    </div>
  );
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
  const [ticked, setTicked] = useState<string[]>([]);
  const [columns, setColumns] = useState<ColumnState>({});
  const [theme, setTheme] = useTeacherTheme();
  // §13: captured once at load. Marking the period seen immediately afterwards would make
  // the banner vanish on the very next render, so what was new at load stays visible for
  // this visit and simply does not reappear on the next one.
  const [newDataPeriod, setNewDataPeriod] = useState<number | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [step, setStep] = useState(0);

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
      } else {
        setError("Could not load this school's data. Try again.");
      }
      const done = await fetchOnboardedPhases(supabase);
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
      const next: ColumnState = { ...columns };
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

  const resultsFor = useCallback(
    (item: SubjectItem): number | null => {
      const bucket: Ks5Bucket | null = phase === "ks5" ? bucketFor(item.qualificationType) : null;
      const rows = headline
        .filter((h) => h.subject === item.subject && (bucket === null || (h.bucket ?? "all") === bucket))
        .sort((a, b) => a.period - b.period);
      return rows.length ? rows[rows.length - 1].avgPointScore : null;
    },
    [headline, phase],
  );

  // §6/§14: never a bare number. The anchor is the school's own average across every
  // subject that has a real figure, so a result always arrives with something to read it
  // against.
  const schoolAnchor = useMemo(() => {
    const vals = items.map(resultsFor).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [items, resultsFor]);

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


  if (!onboarded) {
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

        {step === 0 && phase !== "ks2" && (
          <>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Tick the ones you teach. Everything else follows from this, and you can change it whenever you like.
            </p>
            <p className="mt-4 text-3xl font-semibold tabular-nums">{liveCount.toLocaleString()}</p>
            <p className="text-sm text-neutral-500">
              {liveCount === 1 ? "candidate" : "candidates"} across {tickedItems.length} subject{tickedItems.length === 1 ? "" : "s"}
            </p>
            <div className="mt-4"><SubjectPicker items={items} ticked={ticked} onToggle={toggle} /></div>
          </>
        )}
        {step === 0 && phase === "ks2" && (
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
              if (await completeOnboarding(supabase, phase)) setOnboarded(true);
            }}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            {step < 3 ? "Next" : "Open my dashboard"}
          </button>
        </div>
      </main>
    );
  }

  const builderProps = {
    phase,
    ticked: asRefs(tickedItems),
    allSubjects: asRefs(items),
    headline,
  };

  return (
    // §7: the theme attribute is scoped to Teacher view, never to <html> -- see
    // TeacherChrome for why, and Q15.
    <main id="teacher-root" data-theme={theme} className="mx-auto max-w-4xl bg-white p-4 text-neutral-900 sm:p-6 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{PHASE_LABELS[phase]}</h1>
        <div className="flex items-center gap-3">
          <TeacherChrome theme={theme} onTheme={setTheme} />
          <Link href="/teacher" className="text-sm text-blue-700 hover:underline print:hidden dark:text-blue-400">All dashboards</Link>
        </div>
      </div>
      {schoolName && <p className="mt-1 text-sm text-neutral-500">{schoolName}</p>}

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

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{q.howMany}</h2>
          {phase === "ks2" ? (
            <p className="mt-2 text-3xl font-semibold tabular-nums">{rollAtAge10?.toLocaleString() ?? "—"}</p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{liveCount.toLocaleString()}</p>
              <p className="text-sm text-neutral-500">
                across {tickedItems.length} subject{tickedItems.length === 1 ? "" : "s"}
                {schoolTotal > 0 && ` · ${Math.round((liveCount / schoolTotal) * 100)}% of the school's entries`}
              </p>
            </>
          )}
          {movedCandidates && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {movedCandidates.sentence}
            </p>
          )}
          <ColumnBuilder columnId={"candidates" as ColumnId} {...builderProps} pinned={columns["candidates"] ?? []} onChange={(n) => setColumn("candidates", n)} />
          <NoteBox chartKey={`${phase}:candidates`} />
        </section>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">
            {q.howWell}
            {/* §13's "NEW pill wherever something's actually changed" -- on the card the
                new data actually lands in, not on every card. */}
            {newDataPeriod !== null && (
              <span className="ml-2 rounded-sm bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
            )}
          </h2>
          {tickedItems.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Pick a subject below to see its results.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {tickedItems.map((i) => {
                const v = resultsFor(i);
                return (
                  <li key={i.key} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{i.label}</span>
                    <span className="tabular-nums">
                      {v === null ? <span className="text-neutral-400">no figure</span> : v.toFixed(1)}
                      {v !== null && schoolAnchor !== null && (
                        <span className="ml-2 text-xs text-neutral-500">school avg {schoolAnchor.toFixed(1)}</span>
                      )}
                    </span>
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
          <ColumnBuilder columnId={"results" as ColumnId} {...builderProps} pinned={columns["results"] ?? []} onChange={(n) => setColumn("results", n)} />
          <NoteBox chartKey={`${phase}:results`} />
        </section>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{q.nearMe}</h2>
          {phase === "ks2" ? (
            <>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                The {nearbyOnly.length} nearest primaries, by distance.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {nearbyOnly.slice(0, 5).map((n) => (
                  <li key={n.urn} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{n.name}</span>
                    <span className="tabular-nums text-neutral-500">
                      {n.distanceKm === null ? "" : `${n.distanceKm.toFixed(1)} km`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {schoolTotal > 0
                ? `Your subjects are ${Math.round((liveCount / schoolTotal) * 100)}% of ${schoolTotal.toLocaleString()} entries across the school.`
                : "No entries recorded for this school."}
            </p>
          )}
          <ColumnBuilder columnId={"context" as ColumnId} {...builderProps} pinned={columns["context"] ?? []} onChange={(n) => setColumn("context", n)} />
          <NoteBox chartKey={`${phase}:context`} />
        </section>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{q.wider}</h2>
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
              <ul className="mt-3 space-y-1 text-sm">
                {[...neighbours]
                  .filter((n) => n.value !== null)
                  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                  .slice(0, 5)
                  .map((n) => (
                    <li key={n.urn} className={`flex items-baseline justify-between gap-2 ${n.isTarget ? "font-semibold" : ""}`}>
                      <span className="truncate">{n.name}</span>
                      <span className="tabular-nums">{n.value?.toFixed(1)}</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              No nearby schools with comparable published data for this phase.
            </p>
          )}
          <NoteBox chartKey={`${phase}:rankings`} />
        </section>
      </div>

      {phase !== "ks2" && (
        <section className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Which subjects do you teach?</h2>
          <p className="mt-1 text-xs text-neutral-500">Personal to you. Changing it updates every card above.</p>
          <div className="mt-3"><SubjectPicker items={items} ticked={ticked} onToggle={toggle} /></div>
        </section>
      )}
    </main>
  );
}
