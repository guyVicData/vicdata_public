"use client";

// Teacher view home (design brief v2 §5).
//
// §5: "A school's home screen shows a real, clickable tile for every phase it has genuine
// current data for". An un-onboarded but available phase is still a visible, clickable
// tile that starts that phase's walkthrough; an onboarded one goes straight to its
// dashboard. There is deliberately no third locked/teaser state.
//
// §14: every heading is the real question it answers, not a label.
import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { PHASE_LABELS, PHASE_QUESTIONS, phaseTileState, type TeacherPhase } from "@/lib/teacher-view-phases";

type Membership = {
  id: string;
  school_accounts: { school_urn: string; schools: { current_name: string } | null } | null;
};

export default function TeacherHomePage() {
  const supabase = createBrowserSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolUrn, setSchoolUrn] = useState<string | null>(null);
  const [phases, setPhases] = useState<TeacherPhase[]>([]);
  const [onboarded, setOnboarded] = useState<TeacherPhase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in to see your school's dashboards.");
        setLoading(false);
        return;
      }
      const { data: membership } = await supabase
        .from("school_memberships")
        .select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
        .eq("status", "approved")
        .maybeSingle<Membership>();

      const urn = membership?.school_accounts?.school_urn ?? null;
      setSchoolName(membership?.school_accounts?.schools?.current_name ?? null);
      setSchoolUrn(urn);
      if (!urn) {
        setError("Teacher view is available to verified school staff.");
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/teacher/phases?urn=${encodeURIComponent(urn)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { phases: TeacherPhase[] };
        setPhases(body.phases ?? []);
      } else {
        setError("Could not load your school's data. Try again.");
      }
      setOnboarded(await fetchOnboardedPhases(supabase));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <main className="mx-auto max-w-3xl p-6"><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold sm:text-2xl">What would you like to look at?</h1>
      {schoolName && <p className="mt-1 text-sm text-neutral-500">{schoolName}</p>}

      {error && <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">{error}</p>}

      {!error && phases.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {phases.map((phase) => {
            const state = phaseTileState(phase, onboarded);
            return (
              <Link
                key={phase}
                href={`/teacher/${phase}`}
                className="rounded-lg border border-neutral-200 p-4 transition hover:border-blue-400 dark:border-neutral-800 dark:hover:border-blue-600"
              >
                <p className="text-base font-semibold">{PHASE_LABELS[phase]}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{PHASE_QUESTIONS[phase].howWell}</p>
                <p className="mt-3 text-xs font-medium text-blue-700 dark:text-blue-400">
                  {state === "open-dashboard" ? "Open dashboard" : "Take the 4-step tour to unlock"}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Q10 in the open-questions log, as corrected mid-build. This is NOT a data gap
          to design around: Teacher view is subject-exam-data only, and an independent
          junior/prep has no public exams at that stage and confirmed zero KS2 data (DfE
          publishes none for independent schools at all). So Teacher view simply does not
          apply to this school type, ever -- "no data yet" or "coming soon" would both be
          untrue. Kept deliberately minimal, and careful not to imply the platform has
          nothing for this school: SMT, Finance and Admissions views are built on rolls,
          feeder schools and catchment context, which this school does have. */}
      {!error && phases.length === 0 && (
        <div className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-base font-semibold">Why is Teacher view empty for this school?</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Teacher view is built entirely on subject exam results, and{" "}
            {schoolName ?? "this school"} doesn&rsquo;t sit any &mdash; so there is nothing for it to show.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            That isn&rsquo;t true of the platform as a whole. Roll, feeder-school and catchment data are
            held for your school, and the SMT, Finance and Admissions views are built on those rather
            than on exam results. If that&rsquo;s the view you need, your school&rsquo;s admin can grant it.
          </p>
        </div>
      )}
    </main>
  );
}
