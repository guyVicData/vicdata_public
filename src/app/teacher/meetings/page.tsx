"use client";

// Teacher view, Phase 7: Meetings (design brief v2 §11).
//
// "A second standalone feature, same shape as Recruitment: a Teacher-view user names a
// Meeting, sets its date, and sets a delete-by date (editable if rescheduled). Within it,
// they select graphs -- from any card, any phase they have access to, not gated to one
// dataset -- and sequence them into linked slides, viewable 1-up (for presenting) or in a
// grid (for an overview)."
//
// The "not gated to one dataset" clause is why the slide picker below gathers pinned
// views across EVERY onboarded phase rather than the phase you happen to be looking at.
// A governor meeting slide deck that could only draw on KS4 would miss the point.
//
// Slides store a chart_key, not a rendered image: the deck re-reads live data every time
// it is opened, so a meeting prepared in September and presented in October shows October's
// figures rather than a stale snapshot.
import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  fetchMeetings, createMeeting, fetchSlides, addSlide, fetchPreferences,
  type Meeting, type MeetingSlide,
} from "@/lib/teacher-view-data";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { availableViews, computeView, COLUMN_MEASURE, type ColumnId, type SubjectRef, type ViewDef } from "@/lib/teacher-view-catalogue";
import { PHASE_LABELS, type TeacherPhase } from "@/lib/teacher-view-phases";
import type { AcademicSubjectHeadlineEntry, SubjectEntry } from "@/lib/academic-data-view";
import { ViewChart } from "@/components/teacher/ViewChart";
import { TeacherChrome, useTeacherTheme } from "@/components/teacher/TeacherChrome";

const COLUMNS: ColumnId[] = ["candidates", "results", "context"];

type PhaseBundle = {
  phase: TeacherPhase;
  subjects: SubjectRef[];
  ticked: SubjectRef[];
  headline: AcademicSubjectHeadlineEntry[];
};

function defaultDeleteBy(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

function subjectRefs(entries: SubjectEntry[]): SubjectRef[] {
  const latest = entries.length ? Math.max(...entries.map((e) => e.period)) : null;
  if (latest === null) return [];
  const m = new Map<string, SubjectRef>();
  for (const e of entries) {
    if (e.period !== latest) continue;
    const key = `${e.subject}::${e.qualificationType}`;
    if (!m.has(key)) m.set(key, { key, subject: e.subject, qualificationType: e.qualificationType, label: e.subject });
  }
  return Array.from(m.values());
}

// A slide's chart_key is "<phase>::<view id>", so a deck can mix phases freely (§11).
function slideKey(phase: TeacherPhase, view: ViewDef): string {
  return `${phase}::${view.id}`;
}

function SlideBody({ slideChartKey, bundles }: { slideChartKey: string; bundles: PhaseBundle[] }) {
  const [phase, viewIdPart] = slideChartKey.split("::");
  const bundle = bundles.find((b) => b.phase === phase);
  if (!bundle) return <p className="text-xs text-neutral-500">This slide&apos;s phase is no longer available to you.</p>;
  const all = COLUMNS.flatMap((c) => availableViews(c, bundle.phase, bundle.ticked, bundle.headline));
  const view = all.find((v) => v.id === viewIdPart);
  if (!view) {
    // Honest rather than silent: a slide can outlive the subject tick that produced it.
    return <p className="text-xs text-neutral-500">This view is no longer available -- the subjects it was built from have changed.</p>;
  }
  const measure = COLUMN_MEASURE[view.columnId];
  const computed = computeView(view, bundle.phase, bundle.ticked, bundle.subjects, bundle.headline, []);
  return (
    <>
      <p className="text-xs font-medium">{view.label}</p>
      <p className="text-[11px] text-neutral-500">{PHASE_LABELS[bundle.phase]} · {view.sublabel}</p>
      <ViewChart computed={computed} unit={measure?.unit ?? ""} />
    </>
  );
}

function MeetingDeck({ meeting, bundles }: { meeting: Meeting; bundles: PhaseBundle[] }) {
  const supabase = createBrowserSupabaseClient();
  const [slides, setSlides] = useState<MeetingSlide[]>([]);
  const [mode, setMode] = useState<"grid" | "one">("grid");
  const [index, setIndex] = useState(0);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    (async () => setSlides(await fetchSlides(supabase, meeting.id)))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  const reload = async () => setSlides(await fetchSlides(supabase, meeting.id));

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{meeting.name}</h2>
        <span className="text-xs text-neutral-500">
          {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "no date set"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs print:hidden">
        {/* §11: "viewable 1-up (for presenting) or in a grid (for an overview)". */}
        <button type="button" onClick={() => setMode("grid")} className={mode === "grid" ? "font-semibold" : "text-neutral-500"}>Grid</button>
        <button type="button" onClick={() => setMode("one")} className={mode === "one" ? "font-semibold" : "text-neutral-500"}>Present</button>
        <button type="button" onClick={() => setPicking(!picking)} className="text-blue-700 hover:underline dark:text-blue-400">
          {picking ? "Done" : "Add slides"}
        </button>
        <span className="text-neutral-500">{slides.length} slide{slides.length === 1 ? "" : "s"}</span>
      </div>

      {slides.length === 0 && <p className="mt-3 text-xs text-neutral-500">No slides yet. Add one below.</p>}

      {mode === "grid" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {slides.map((sl) => (
            <figure key={sl.id} className="rounded-md border border-neutral-100 p-2 dark:border-neutral-900">
              <SlideBody slideChartKey={sl.chart_key} bundles={bundles} />
            </figure>
          ))}
        </div>
      ) : (
        slides.length > 0 && (
          // 1-up is the projector mode: one slide, large, with nothing else competing.
          <div className="mt-3">
            <figure className="rounded-md border border-neutral-100 p-4 dark:border-neutral-900">
              <SlideBody slideChartKey={slides[Math.min(index, slides.length - 1)].chart_key} bundles={bundles} />
            </figure>
            <div className="mt-2 flex items-center justify-between text-xs print:hidden">
              <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} className="disabled:opacity-40">Previous</button>
              <span className="tabular-nums text-neutral-500">{Math.min(index, slides.length - 1) + 1} of {slides.length}</span>
              <button type="button" onClick={() => setIndex(Math.min(slides.length - 1, index + 1))} disabled={index >= slides.length - 1} className="disabled:opacity-40">Next</button>
            </div>
          </div>
        )
      )}

      {picking && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-neutral-200 print:hidden dark:border-neutral-800">
          {bundles.length === 0 && <p className="px-3 py-2 text-xs text-neutral-500">Complete a dashboard walkthrough first -- slides are built from its views.</p>}
          {bundles.map((b) =>
            COLUMNS.flatMap((c) => availableViews(c, b.phase, b.ticked, b.headline)).map((v) => {
              const key = slideKey(b.phase, v);
              const already = slides.some((s) => s.chart_key === key);
              return (
                <label key={key} className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2 text-xs last:border-b-0 dark:border-neutral-900">
                  <input
                    type="checkbox"
                    checked={already}
                    disabled={already}
                    onChange={async () => { await addSlide(supabase, meeting.id, key, slides.length, null); reload(); }}
                  />
                  <span className="flex-1">
                    <span className="block truncate">{v.label}</span>
                    <span className="block text-[11px] text-neutral-500">{PHASE_LABELS[b.phase]} · {v.sublabel}</span>
                  </span>
                </label>
              );
            }),
          )}
        </div>
      )}
    </section>
  );
}

export default function MeetingsPage() {
  const supabase = createBrowserSupabaseClient();
  const [theme, setTheme] = useTeacherTheme();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [bundles, setBundles] = useState<PhaseBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [deleteBy, setDeleteBy] = useState(defaultDeleteBy());

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data: membership } = await supabase
        .from("school_memberships")
        .select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn)")
        .eq("status", "approved")
        .maybeSingle<{ school_accounts: { school_urn: string } | null }>();
      const urn = membership?.school_accounts?.school_urn ?? null;

      setMeetings(await fetchMeetings(supabase));

      // §11's "any phase they have access to" -- every phase this person has actually
      // onboarded, not just one.
      const phases = await fetchOnboardedPhases(supabase);
      const built: PhaseBundle[] = [];
      if (urn && token) {
        for (const phase of phases) {
          const res = await fetch(`/api/teacher/dashboard?urn=${encodeURIComponent(urn)}&phase=${phase}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const body = await res.json();
          const subjects = subjectRefs(body.subjectData?.entries ?? []);
          const prefs = await fetchPreferences(supabase, urn, phase);
          built.push({
            phase,
            subjects,
            ticked: subjects.filter((s) => prefs.subjects.includes(s.key)),
            headline: body.headline ?? [],
          });
        }
      }
      setBundles(built);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <main className="mx-auto max-w-3xl p-6"><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main id="teacher-root" data-theme={theme} className="mx-auto max-w-3xl bg-white p-4 text-neutral-900 sm:p-6 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Meetings</h1>
        <div className="flex items-center gap-3">
          <TeacherChrome theme={theme} onTheme={setTheme} />
          <Link href="/teacher" className="text-sm text-blue-700 hover:underline print:hidden dark:text-blue-400">All dashboards</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Private to you. Slides read live data, so a deck is never out of date.</p>

      <div className="mt-6 space-y-4">
        {meetings.map((m) => <MeetingDeck key={m.id} meeting={m} bundles={bundles} />)}
        {meetings.length === 0 && <p className="text-sm text-neutral-500">No meetings yet.</p>}
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4 print:hidden dark:border-neutral-800">
        <h2 className="text-sm font-semibold">New meeting</h2>
        <div className="mt-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meeting name, e.g. Autumn governors"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700" />
          <label className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700" />
          </label>
          <label className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>Delete on</span>
            <input type="date" value={deleteBy} onChange={(e) => setDeleteBy(e.target.value)}
              className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700" />
          </label>
          <button
            type="button"
            disabled={!name.trim() || !deleteBy}
            onClick={async () => {
              const m = await createMeeting(supabase, { name: name.trim(), meetingDate: date || null, deleteBy });
              if (m) { setMeetings([...meetings, m]); setName(""); setDate(""); setDeleteBy(defaultDeleteBy()); }
            }}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Create meeting
          </button>
        </div>
      </section>
    </main>
  );
}
