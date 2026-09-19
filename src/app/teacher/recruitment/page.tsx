"use client";

// Teacher view, Phase 6: Recruitment (design brief v2 §10).
//
// "A standalone feature, not one of the four repeating cards -- genuinely new territory
// for the platform (its first named, real individual) but a smart reuse of data that's
// already there."
//
// Three things in §10 shape this file:
//   - Mobile-first "deliberately": "checking a candidate's school comparison on your
//     phone right before an interview". So the layout is a single column that stays
//     readable at 320px, and the comparison is the thing that gets the space.
//   - Retention IS the delete-by date. There is no separate policy machinery, so the
//     field is mandatory at creation and editable afterwards, and the UI says plainly
//     what will happen and when.
//   - Creator-only. Enforced by RLS, not by anything here -- exercised by a non-owning
//     account rather than assumed, see Q14.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import SchoolSearch, { type SchoolSearchResult } from "@/components/SchoolSearch";
import {
  fetchJobs, createJob, extendJobRetention, fetchCandidates, addCandidate, setCandidateInterviewed,
  type RecruitmentJob, type RecruitmentCandidate,
} from "@/lib/teacher-view-data";
import { TeacherChrome, useTeacherTheme } from "@/components/teacher/TeacherChrome";

type Comparison = {
  mine: { urn: string; name: string | null; sector: string | null; gender: string | null; roll: number | null };
  theirs: { urn: string; name: string | null; sector: string | null; gender: string | null; roll: number | null };
  subject: string | null;
  comparisons: {
    phase: "ks2" | "ks4" | "ks5";
    periods: number[];
    mine: { entries: number | null; points: number | null; trend: (number | null)[] };
    theirs: { entries: number | null; points: number | null; trend: (number | null)[] };
  }[];
};

// §10's delete-by default. Three months is long enough for a normal round and short
// enough that a forgotten job does not sit on a real person's name indefinitely.
function defaultDeleteBy(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function num(v: number | null, digits = 1): string {
  return v === null ? "--" : v.toFixed(digits);
}

// §14: never a bare figure. Each row says which way round it is, in words.
function CompareRow({ label, mine, theirs, unit = "" }: { label: string; mine: string; theirs: string; unit?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 border-b border-neutral-100 py-1 text-xs last:border-b-0 dark:border-neutral-900">
      <span className="text-neutral-500">{label}</span>
      <span className="tabular-nums font-medium">{mine}{unit}</span>
      <span className="tabular-nums text-neutral-500">{theirs}{unit}</span>
    </div>
  );
}

function CandidateComparison({ anchorUrn, candidate, subject }: { anchorUrn: string; candidate: RecruitmentCandidate; subject: string | null }) {
  const supabase = createBrowserSupabaseClient();
  const [data, setData] = useState<Comparison | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");

  useEffect(() => {
    (async () => {
      if (!candidate.school_urn) { setState("empty"); return; }
      setState("loading");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setState("error"); return; }
      const qs = new URLSearchParams({ anchorUrn, candidateUrn: candidate.school_urn });
      if (subject) qs.set("subject", subject);
      const res = await fetch(`/api/teacher/recruitment-comparison?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setState("error"); return; }
      const body: Comparison = await res.json();
      setData(body);
      setState("idle");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.school_urn, subject, anchorUrn]);

  if (state === "empty") return <p className="mt-2 text-xs text-neutral-500">No current school recorded, so there is nothing to compare.</p>;
  if (state === "loading") return <p className="mt-2 text-xs text-neutral-500">Loading comparison…</p>;
  if (state === "error" || !data) return <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Could not load the comparison.</p>;

  return (
    <div className="mt-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 pb-1 text-[11px] font-medium">
        <span />
        <span className="truncate">{data.mine.name ?? "Your school"}</span>
        <span className="truncate text-neutral-500">{data.theirs.name ?? "Their school"}</span>
      </div>
      <CompareRow label="Sector" mine={data.mine.sector ?? "--"} theirs={data.theirs.sector ?? "--"} />
      <CompareRow label="Intake" mine={data.mine.gender ?? "--"} theirs={data.theirs.gender ?? "--"} />
      <CompareRow label="Roll" mine={data.mine.roll?.toLocaleString() ?? "--"} theirs={data.theirs.roll?.toLocaleString() ?? "--"} />
      {data.comparisons.length === 0 ? (
        <p className="pt-2 text-xs text-neutral-500">
          No key stage where both schools publish figures for{subject ? ` ${subject}` : " this subject"}, so there is no
          like-for-like result comparison to show.
        </p>
      ) : (
        data.comparisons.map((c) => (
          <div key={c.phase} className="pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{c.phase.toUpperCase()}</p>
            <CompareRow label="Entries" mine={num(c.mine.entries, 0)} theirs={num(c.theirs.entries, 0)} />
            <CompareRow label="Average points" mine={num(c.mine.points)} theirs={num(c.theirs.points)} />
            <CompareRow
              label={`Trend ${c.periods[0]}–${c.periods[c.periods.length - 1]}`}
              mine={c.mine.trend.map((v) => num(v, 0)).join(" ")}
              theirs={c.theirs.trend.map((v) => num(v, 0)).join(" ")}
            />
          </div>
        ))
      )}
    </div>
  );
}

function JobCard({ job, anchorUrn }: { job: RecruitmentJob; anchorUrn: string }) {
  const supabase = createBrowserSupabaseClient();
  const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([]);
  const [name, setName] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [when, setWhen] = useState("");
  const [deleteBy, setDeleteBy] = useState(job.delete_by);
  const [open, setOpen] = useState<string | null>(null);

  // The setState lives inside the async callback, not the effect body -- the same
  // cascading-render fix applied elsewhere in this build.
  const reload = useCallback(async () => {
    const rows = await fetchCandidates(supabase, job.id);
    setCandidates(rows);
  }, [supabase, job.id]);
  useEffect(() => {
    (async () => { await reload(); })();
  }, [reload]);

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold">{job.title}</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        {job.subject ? `Compared on ${job.subject}` : "No subject set, so comparisons are school-level only"}
        {job.ks_stage ? ` · ${job.ks_stage.toUpperCase()}` : ""}
      </p>

      <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span>Delete candidate names on</span>
        <input
          type="date"
          value={deleteBy}
          onChange={async (e) => { setDeleteBy(e.target.value); await extendJobRetention(supabase, job.id, e.target.value); }}
          className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
        />
      </label>

      <ul className="mt-3 space-y-2">
        {candidates.length === 0 && <li className="text-xs text-neutral-500">No candidates yet.</li>}
        {candidates.map((c) => (
          <li key={c.id} className="rounded-md border border-neutral-100 p-2 dark:border-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.interviewed}
                  onChange={async () => { await setCandidateInterviewed(supabase, c.id, !c.interviewed); reload(); }}
                />
                <span className={c.interviewed ? "line-through decoration-neutral-400" : ""}>{c.candidate_name}</span>
              </label>
              {c.interview_at && (
                <span className="text-xs text-neutral-500">
                  {new Date(c.interview_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className="ml-auto text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                {open === c.id ? "Hide" : "Compare"}
              </button>
            </div>
            {open === c.id && <CandidateComparison anchorUrn={anchorUrn} candidate={c} subject={job.subject} />}
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-900">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Candidate name"
          className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
        />
        {/* §10: "their current school (looked up via the existing school-search
            mechanism)" -- the platform's own component, not a second search. */}
        {school ? (
          <p className="text-xs text-neutral-500">
            {school.current_name}{" "}
            <button type="button" onClick={() => setSchool(null)} className="text-blue-700 hover:underline dark:text-blue-400">change</button>
          </p>
        ) : (
          <SchoolSearch onSelect={setSchool} placeholder="Their current school" />
        )}
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={async () => {
            await addCandidate(supabase, job.id, {
              name: name.trim(),
              schoolUrn: school?.urn ?? null,
              interviewAt: when ? new Date(when).toISOString() : null,
            });
            setName(""); setSchool(null); setWhen("");
            reload();
          }}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add candidate
        </button>
      </div>
    </section>
  );
}

export default function RecruitmentPage() {
  const supabase = createBrowserSupabaseClient();
  const [theme, setTheme] = useTeacherTheme();
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [anchorUrn, setAnchorUrn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deleteBy, setDeleteBy] = useState(defaultDeleteBy());

  useEffect(() => {
    (async () => {
      const { data: membership } = await supabase
        .from("school_memberships")
        .select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn)")
        .eq("status", "approved")
        .maybeSingle<{ school_accounts: { school_urn: string } | null }>();
      setAnchorUrn(membership?.school_accounts?.school_urn ?? null);
      setJobs(await fetchJobs(supabase));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <main className="mx-auto max-w-2xl p-6"><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main id="teacher-root" data-theme={theme} className="mx-auto max-w-2xl bg-white p-4 text-neutral-900 sm:p-6 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Recruitment</h1>
        <div className="flex items-center gap-3">
          <TeacherChrome theme={theme} onTheme={setTheme} />
          <Link href="/teacher" className="text-sm text-blue-700 hover:underline print:hidden dark:text-blue-400">All dashboards</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Private to you. Candidate names are deleted on the date you set for each job.
      </p>

      <div className="mt-6 space-y-4">
        {jobs.map((j) => anchorUrn && <JobCard key={j.id} job={j} anchorUrn={anchorUrn} />)}
        {jobs.length === 0 && <p className="text-sm text-neutral-500">No jobs yet. Create one below.</p>}
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4 print:hidden dark:border-neutral-800">
        <h2 className="text-sm font-semibold">New job</h2>
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title, e.g. Maths KS3 & 4 Teacher"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
          />
          {/* §10: the free-text title can name things like KS3 that aren't independently
              measurable; the SUBJECT is what actually drives the comparison. */}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject used for comparison, e.g. Mathematics"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
          />
          <label className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>Delete candidate names on</span>
            <input
              type="date"
              value={deleteBy}
              onChange={(e) => setDeleteBy(e.target.value)}
              className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
            />
          </label>
          <button
            type="button"
            disabled={!title.trim() || !deleteBy}
            onClick={async () => {
              const job = await createJob(supabase, {
                title: title.trim(),
                subject: subject.trim() || null,
                ksStage: null,
                deleteBy,
              });
              if (job) { setJobs([job, ...jobs]); setTitle(""); setSubject(""); setDeleteBy(defaultDeleteBy()); }
            }}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Create job
          </button>
        </div>
      </section>
    </main>
  );
}
