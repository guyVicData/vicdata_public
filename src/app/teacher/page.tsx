"use client";

// Teacher view home (design brief v2 §5).
//
// §5: "A school's home screen shows a real, clickable tile for every phase it has genuine
// current data for". An un-onboarded but available phase is still a visible, clickable
// tile that starts that phase's walkthrough; an onboarded one goes straight to its
// dashboard. There is deliberately no third locked/teaser state.
//
// §14: every heading is the real question it answers, not a label.
//
// VicData 0.6 S6: with the 0.6 flag on (configRendererRequested: ?renderer=config or the
// build env), this is the ROLE home (scope brief §4.10; HomeSMT.dc.html): tiles for the
// role's key dashboards (Teacher keeps the GCSE/Post-16 phase tiles and their ≈4-step
// path), Dashboards (the library), Recruitment and Meetings (showing the next one), and
// a role switch only for people holding more than one role. Flag off, the page is exactly
// what it was: the same query, the same tiles.
//
// 0.6 snag 2/4: in View as (src/lib/view-as.ts) this is the role home exactly as a real
// single-membership member of that role at that school lands on it: config renderer
// whatever the flag, that member's lens, no role switch.
import { resolveViewAs } from "@/lib/view-as";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { pickMembership, viewAsMembership } from "@/lib/view-as";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { PHASE_LABELS, PHASE_HOME_CARD_DESCRIPTION, phaseTileState, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT, FEATURE_ACCENT } from "@/lib/teacher-view-theme";
import { HomeCard, PhaseGlyph, RecruitmentGlyph, MeetingsGlyph, NEUTRAL_TILE } from "@/components/teacher/HomeCard";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { TeacherNav, useNavLabels } from "@/components/teacher/TeacherNav";
import { configRendererRequested } from "@/components/dashboard-config/plan";
import { TEACHER_DASHBOARDS } from "@/catalogue/dashboards";
import type { DashboardConfig } from "@/catalogue/types";
import { loadKeyDashboards } from "@/components/library/data";
import {
  initialLens,
  KeyDashboardsEmpty,
  KeyDashboardTile,
  LensSwitch,
  lensesOf,
  LibraryTile,
  readStoredLens,
  storeLens,
  type Lens,
} from "@/components/library/RoleHome";
import { listMeetings } from "@/lib/meeting-store";
import { shortDate } from "@/lib/meeting-ops";

type Membership = {
  id: string;
  school_accounts: { school_urn: string; schools: { current_name: string } | null; account_holder_membership_id?: string | null } | null;
  // Read only with the 0.6 flag on (the role home's lenses).
  roles?: string[] | null;
  role?: string | null;
  is_admin?: boolean | null;
};

// The key dashboards a role home shows beyond Teacher's phase tiles: the VicData ones
// assigned to the role as key, minus the four Teacher dashboards the phase tiles already
// stand for.
const PHASE_TILE_SLUGS = new Set(TEACHER_DASHBOARDS.map((d) => d.id));

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
  const [schoolUrn, setSchoolUrn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Same hook and storage key as every dashboard; since the top-nav completion round the
  // toggle itself is in TeacherNav here too.
  const [theme, setTheme] = useTeacherTheme();
  const [labelsOn, setLabelsOn] = useNavLabels(schoolUrn, onboarded);
  // 0.6 role home (flag on only).
  const [v06, setV06] = useState(false);
  const [lenses, setLenses] = useState<Lens[]>(["teacher"]);
  const [lens, setLensState] = useState<Lens>("teacher");
  const [keyDashboards, setKeyDashboards] = useState<Partial<Record<Lens, { href: string; config: DashboardConfig }[]>>>({});
  const [nextMeeting, setNextMeeting] = useState<{ name: string; date: string | null } | null>(null);
  const setLens = (l: Lens) => {
    setLensState(l);
    storeLens(l);
  };

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
      // VicData 0.6: a confirmed trial (the look-as pair, or this tab's active trial) is
      // that school as that one role, and the phase tiles carry it on.
      const search = new URLSearchParams(window.location.search);
      const trial = await resolveViewAs(supabase);
      // A trial always uses the config renderer: role homes exist only there.
      const on = configRendererRequested(search) || !!trial;
      setV06(on);
      let urn: string | null;
      let myLenses: Lens[] = ["teacher"];
      let lookingAs: Lens | null = null;
      if (trial) {
        urn = trial.urn;
        // The lens a real single-membership member of the role gets (one: no role switch).
        lookingAs = lensesOf(viewAsMembership(trial.role))[0];
        setSchoolUrn(urn);
        setSchoolName(trial.schoolName);
      } else {
        const { data: mine } = await supabase
          .from("school_memberships")
          .select(
            on
              ? "id, approved_at, roles, role, is_admin, school_accounts!school_memberships_school_account_id_fkey(school_urn, account_holder_membership_id, schools(current_name))"
              : "id, approved_at, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))",
          )
          // The signed-in person's own rows: RLS also returns every approved colleague's (S3b
          // fix 2). 0.6 snag 4: with more than one, the page shows ONE school, picked by
          // pickMembership (never "the first row").
          .eq("profile_id", user?.id ?? "")
          .eq("status", "approved");
        const membership = pickMembership((mine ?? []) as unknown as Membership[]);

        urn = membership?.school_accounts?.school_urn ?? null;
        setSchoolUrn(urn);
        setSchoolName(membership?.school_accounts?.schools?.current_name ?? null);
        if (on && membership)
          myLenses = lensesOf({
            roles: membership.roles,
            role: membership.role,
            is_admin: membership.is_admin,
            isAccountHolder: membership.school_accounts?.account_holder_membership_id === membership.id,
          });
      }
      if (on) {
        // A trial: its role is the only lens (no role switch). Otherwise the person's own.
        const ls = lookingAs ? [lookingAs] : myLenses;
        setLenses(ls);
        setLensState(lookingAs ?? initialLens(ls, readStoredLens()));
        // Each lens's key dashboards, and the next meeting, alongside the phases below.
        void Promise.all(ls.map(async (l) => [l, (await loadKeyDashboards(supabase, l).catch(() => ({ entries: [] }))).entries] as const)).then((pairs) =>
          setKeyDashboards(Object.fromEntries(pairs.map(([l, es]) => [l, es.filter((e) => !(e.row.slug && PHASE_TILE_SLUGS.has(e.row.slug))).map((e) => ({ href: e.href, config: e.config }))]))),
        );
        void listMeetings(supabase)
          .then((r) => {
            const next = r.meetings.find((m) => !m.archived);
            setNextMeeting(next ? { name: next.name, date: next.meetingDate } : null);
          })
          .catch(() => {});
      }
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

  if (loading) return <main className="mx-auto max-w-3xl p-6"><ViewAsBanner plain /><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main id="teacher-root" data-theme={theme} className="mx-auto max-w-3xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6">
      <ViewAsBanner />
      {/* No phase switcher here (phases={[]}): the tile list below already is the phase
          picker, and a richer one than the nav's. */}
      <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={setTheme} />
      {/* Home.dc.html's order: the teacher's name as the page's headline, their school
          directly under it, then the question as its own line -- a prompt, not a heading. */}
      <div className="mt-6">
        {displayName && <h1 className="text-[22px] font-bold leading-tight">{displayName}</h1>}
        {schoolName && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{schoolName}</p>}
      </div>
      {/* 0.6: the role switch, only for people holding more than one role (HomeSMT.dc.html
          puts it between the school and the question). */}
      {v06 && !error && lenses.length > 1 && (
        <div className="mt-[18px]">
          <LensSwitch lenses={lenses} lens={lens} onLens={setLens} />
        </div>
      )}

      <p className="mt-[22px] text-base font-semibold text-[var(--muted2)]">What would you like to look at?</p>

      {error && <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">{error}</p>}

      {/* 0.6: SMT and Admissions homes -- their key dashboards (an empty tile until they're
          built), then the same Dashboards, Recruitment and Meetings tiles. */}
      {v06 && !error && lens !== "teacher" && (
        <div className="mt-6 flex flex-col gap-3">
          {(keyDashboards[lens] ?? []).length > 0 ? (
            keyDashboards[lens]!.map((k) => <KeyDashboardTile key={k.href} href={k.href} config={k.config} lens={lens} />)
          ) : (
            <KeyDashboardsEmpty lens={lens} />
          )}
          <LibraryTile lens={lens} />
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
            description={nextMeeting ? `Next: ${nextMeeting.name}, ${shortDate(nextMeeting.date)}` : "What do you need to show, and to whom?"}
          />
        </div>
      )}

      {/* Phases and features in one stacked list, as Home.dc.html has it. */}
      {!error && phases.length > 0 && (!v06 || lens === "teacher") && (
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
          {/* 0.6: any other key dashboard for Teacher, then the library. */}
          {v06 && (keyDashboards.teacher ?? []).map((k) => <KeyDashboardTile key={k.href} href={k.href} config={k.config} lens="teacher" />)}
          {v06 && <LibraryTile lens="teacher" />}
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
            description={v06 && nextMeeting ? `Next: ${nextMeeting.name}, ${shortDate(nextMeeting.date)}` : "What do you need to show, and to whom?"}
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
      {!error && phases.length === 0 && (!v06 || lens === "teacher") && (
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
