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
import { completeOnboarding, fetchOnboardedPhases, fetchPreferences, savePreferences } from "@/lib/teacher-view-data";
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
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800">
      {items.length === 0 && <p className="px-3 py-3 text-sm text-neutral-500">No subject entries recorded for this school.</p>}
      {items.map((i) => (
        <label
          key={i.key}
          className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 dark:border-neutral-900"
        >
          <input type="checkbox" checked={ticked.includes(i.key)} onChange={() => onToggle(i.key)} />
          <span className="flex-1 truncate">{i.label}</span>
          <span className="tabular-nums text-neutral-500">{i.entries}</span>
        </label>
      ))}
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
  const [ticked, setTicked] = useState<string[]>([]);
  const [onboarded, setOnboarded] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Every setState below lives inside this async callback rather than the effect body,
    // matching React's own guidance and the same fix already applied elsewhere in this
    // codebase -- a synchronous setState here triggers cascading renders.
    (async () => {
      if (!phase) { setError("Unknown phase."); setLoading(false); return; }
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
        setRollAtAge10(body.rollAtAge10 ?? null);
      } else {
        setError("Could not load this school's data. Try again.");
      }
      const done = await fetchOnboardedPhases(supabase);
      setOnboarded(done.includes(phase));
      const prefs = await fetchPreferences(supabase, urn, phase);
      setTicked(prefs.subjects);
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

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{PHASE_LABELS[phase]}</h1>
        <Link href="/teacher" className="text-sm text-blue-700 hover:underline dark:text-blue-400">All dashboards</Link>
      </div>
      {schoolName && <p className="mt-1 text-sm text-neutral-500">{schoolName}</p>}

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
        </section>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{q.howWell}</h2>
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
        </section>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{q.nearMe}</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {phase === "ks2"
              ? "Nearest-primaries comparison is not wired up in this pass."
              : schoolTotal > 0
                ? `Your subjects are ${Math.round((liveCount / schoolTotal) * 100)}% of ${schoolTotal.toLocaleString()} entries across the school.`
                : "No entries recorded for this school."}
          </p>
        </section>

        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{q.wider}</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Comparator sets and rankings exist in the advanced view; this card is not wired to them in this pass.
          </p>
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
