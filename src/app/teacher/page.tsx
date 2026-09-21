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
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { PHASE_LABELS, PHASE_HOME_CARD_DESCRIPTION, phaseTileState, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT, FEATURE_ACCENT } from "@/lib/teacher-view-theme";
import { HomeCard, PhaseGlyph, RecruitmentGlyph, MeetingsGlyph, NEUTRAL_TILE } from "@/components/teacher/HomeCard";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";

type Membership = {
  id: string;
  school_accounts: { school_urn: string; schools: { current_name: string } | null } | null;
};

export default function TeacherHomePage() {
  const supabase = createBrowserSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  // Home.dc.html greets the teacher by name. From their own profiles row (the
  // profiles_select_own policy), falling back to email exactly as the account page does
  // for its member list -- so the greeting line is never blank.
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [phases, setPhases] = useState<TeacherPhase[]>([]);
  const [onboarded, setOnboarded] = useState<TeacherPhase[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The home page has no toggle of its own; it follows the theme chosen on a dashboard, so
  // the cards' tokens (scoped to #teacher-root) resolve here too. Same hook, no new state.
  const [theme] = useTeacherTheme();

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in to see your school's dashboards.");
        setLoading(false);
        return;
      }
      const user = sessionData.session?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", user.id)
          .maybeSingle<{ email: string | null; full_name: string | null }>();
        setDisplayName(profile?.full_name || profile?.email || user.email || null);
      }
      const { data: membership } = await supabase
        .from("school_memberships")
        .select("id, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))")
        .eq("status", "approved")
        .maybeSingle<Membership>();

      const urn = membership?.school_accounts?.school_urn ?? null;
      setSchoolName(membership?.school_accounts?.schools?.current_name ?? null);
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
      setOnboarded(await fetchOnboardedPhases(supabase, urn));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <main className="mx-auto max-w-3xl p-6"><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main id="teacher-root" data-theme={theme} className="mx-auto max-w-3xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6">
      {/* Home.dc.html's order: the teacher's name as the page's headline, their school
          directly under it, then the question as its own line -- a prompt, not a heading. */}
      <div>
        {displayName && <h1 className="text-[22px] font-bold leading-tight">{displayName}</h1>}
        {schoolName && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{schoolName}</p>}
      </div>
      <p className="mt-[22px] text-base font-semibold text-[var(--muted2)]">What would you like to look at?</p>

      {error && <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">{error}</p>}

      {/* Phases and features in one stacked list, as Home.dc.html has it. */}
      {!error && phases.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {phases.map((phase) => {
            const state = phaseTileState(phase, onboarded);
            return (
              <HomeCard
                key={phase}
                href={`/teacher/${phase}`}
                colour={PHASE_ACCENT[phase] ?? NEUTRAL_TILE}
                icon={<PhaseGlyph phase={phase} />}
                title={PHASE_LABELS[phase]}
                description={PHASE_HOME_CARD_DESCRIPTION[phase]}
                footer={state === "open-dashboard" ? "Open dashboard" : "Take the 4-step tour to unlock"}
              />
            );
          })}

          {/* §10 and §11: Recruitment and Meetings are standalone features, not phases.
              They follow the phase cards in the same list, as in the mockup, each in its
              own colour and with no tour line. Shown only where Teacher view itself
              applies -- a school with no exam data has nothing to build a candidate
              comparison or a slide deck from. Titled by name with the question as the
              description, so §14's question still leads the card's reading. */}
          <HomeCard
            href="/teacher/recruitment"
            colour={FEATURE_ACCENT.recruitment}
            icon={<RecruitmentGlyph />}
            title="Recruitment"
            description="Who are we hiring, and how do their current schools compare with ours?"
          />
          <HomeCard
            href="/teacher/meetings"
            colour={FEATURE_ACCENT.meetings}
            icon={<MeetingsGlyph />}
            title="Meetings"
            description="What do you need to show, and to whom?"
          />
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
