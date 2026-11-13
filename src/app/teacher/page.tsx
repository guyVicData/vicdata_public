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
import { checkPlatformAdmin, resolveViewAs } from "@/lib/view-as";
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import { PageSurface } from "@/components/feedback/PageFeedback";
import { schoolSurface } from "@/components/feedback/surface";
import { pickMembership, viewAsMembership } from "@/lib/view-as";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { type TeacherPhase } from "@/lib/teacher-view-phases";
import { FEATURE_ACCENT, ROLE_ACCENT } from "@/lib/teacher-view-theme";
import { RecruitmentGlyph, MeetingsGlyph } from "@/components/teacher/HomeCard";
import { configRendererRequested } from "@/components/dashboard-config/plan";
import { ADMISSIONS_DASHBOARDS, TEACHER_DASHBOARDS } from "@/catalogue/dashboards";
import { HomeFrame, HomeHeading, type AlsoItem } from "@/components/front-door/home";
import { useFirstVisit, WhatsNewStrip } from "@/components/front-door/first-visit";
import { AdmissionsSection, SmtSection, TeacherKs2Section, TeacherPhaseSection } from "@/components/front-door/sections";
import { colourOf, iconOf, LIBRARY_ACCENT, resolveIcon } from "@/lib/dashboard-icons";
import { IconGlyph, LibraryGlyph } from "@/components/library/DashboardIcon";
import { SMT_DASHBOARDS } from "@/catalogue/dashboards/smt";
import type { DashboardConfig } from "@/catalogue/types";
import { loadKeyDashboards } from "@/components/library/data";
import { initialLens, lensesOf, readStoredLens, type Lens } from "@/components/library/RoleHome";
import { listMeetings } from "@/lib/meeting-store";
import { LENS_EVENT } from "@/components/shell/RoleSwitch";
import { shortDate } from "@/lib/meeting-ops";

const HOME_NAME: Record<Lens, string> = { teacher: "Teacher home", smt: "SMT home", admissions: "Admissions home" };

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
// 0.7 admissions r2 (D2): the Admissions dashboards are reached by their own tile (one page,
// Pipelines | Market share), never as two key-dashboard tiles.
const ADMISSIONS_SLUGS = new Set(ADMISSIONS_DASHBOARDS.map((d) => d.id));
// 0.8 SMT r1: the SMT dashboards are The school card's shortcuts, never key-dashboard tiles too.
const SMT_SLUGS = new Set(SMT_DASHBOARDS.map((d) => d.id));

export default function TeacherHomePage() {
  const supabase = createBrowserSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [phases, setPhases] = useState<TeacherPhase[]>([]);
  const [onboarded, setOnboarded] = useState<TeacherPhase[]>([]);
  const [schoolUrn, setSchoolUrn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 0.8 front door: the theme (Mid included) and the nav labels are HomeFrame's.
  // 0.8 front door (A5, A7): the welcome once, then "New since your last visit". Not in View as or a peek.
  const [visitReady, setVisitReady] = useState<{ viewingAs: boolean } | null>(null);
  const whatsNewEntries = useFirstVisit(visitReady !== null, visitReady?.viewingAs ?? true);
  // 0.6 role home (flag on only).
  const [v06, setV06] = useState(false);
  const [lenses, setLenses] = useState<Lens[]>(["teacher"]);
  const [lens, setLensState] = useState<Lens>("teacher");
  const [keyDashboards, setKeyDashboards] = useState<Partial<Record<Lens, { href: string; config: DashboardConfig }[]>>>({});
  const [nextMeeting, setNextMeeting] = useState<{ name: string; date: string | null } | null>(null);
  // 0.7 admissions r2 (D2): the School-Admin's Admissions tile on the Teacher lens (Admissions and
  // SMT get theirs on their own lens; a platform admin through View as as one of those roles).
  const [schoolAdmin, setSchoolAdmin] = useState(false);
  // 0.8 View as (B): the nav's role switch picks the home in place (it stores the choice itself).
  useEffect(() => {
    const on = (e: Event) => setLensState((e as CustomEvent<Lens>).detail);
    window.addEventListener(LENS_EVENT, on);
    return () => window.removeEventListener(LENS_EVENT, on);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in to see your school's dashboards.");
        setLoading(false);
        return;
      }
      // 0.8 front door: the home opens on its question, not a greeting (the boards).
      const user = sessionData.session?.user;
      // VicData 0.6: a confirmed trial (the look-as pair, or this tab's active trial) is
      // that school as that one role, and the phase tiles carry it on.
      const search = new URLSearchParams(window.location.search);
      const trial = await resolveViewAs(supabase);
      setVisitReady({ viewingAs: !!trial || search.get("peek") === "1" });
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
        if (on && membership) setSchoolAdmin(!!membership.is_admin || membership.school_accounts?.account_holder_membership_id === membership.id);
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
          setKeyDashboards(Object.fromEntries(pairs.map(([l, es]) => [l, es.filter((e) => !(e.row.slug && (PHASE_TILE_SLUGS.has(e.row.slug) || ADMISSIONS_SLUGS.has(e.row.slug) || SMT_SLUGS.has(e.row.slug)))).map((e) => ({ href: e.href, config: e.config }))]))),
        );
        void listMeetings(supabase)
          .then((r) => {
            const next = r.meetings.find((m) => !m.archived);
            setNextMeeting(next ? { name: next.name, date: next.meetingDate } : null);
          })
          .catch(() => {});
      }
      if (!urn) {
        // 0.8 groups r1 (G3): head office has no school of its own; its home is the group's.
        if (!trial) {
          const g = await fetch("/api/group/me", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
          const offices = g?.ok ? ((await g.json()) as { offices: unknown[] }).offices : [];
          if (offices.length) {
            window.location.replace("/teacher/group");
            return;
          }
          // 0.8 View as fixes (item 4): a platform admin needs no membership; their home is Platform.
          if ((await checkPlatformAdmin(supabase, 1)) === "yes") {
            window.location.replace("/platform");
            return;
          }
        }
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

  // 0.8 front door (B8): one home for everyone, of plain question tiles. A person with more than one role
  // sees each role's section, stacked (a thin dark gap between them). The heading sits on the field when
  // there is one section, above them when there are more.
  const shown: Lens[] = v06 ? lenses : ["teacher"];
  const teacherPhases = (!error && shown.includes("teacher") ? phases : []) as TeacherPhase[];
  const sectionsWanted = [
    ...(shown.includes("smt") ? ["smt"] : []),
    ...teacherPhases,
    ...(shown.includes("admissions") || (v06 && schoolAdmin && !shown.includes("smt")) ? ["admissions"] : []),
  ];
  const single = sectionsWanted.length === 1;
  const sub = shown.length > 1 ? "Your roles, one after another. Each question walks you through a few screens, one thing at a time." : SUBLINE[shown[0]];
  const onField = single ? <HomeHeading sub={sub} onField /> : undefined;
  const sections = sectionsWanted.map((k) =>
    k === "smt" ? (
      <SmtSection key="smt" heading={onField} />
    ) : k === "admissions" ? (
      schoolUrn ? <AdmissionsSection key="admissions" urn={schoolUrn} heading={onField} /> : null
    ) : k === "ks2" ? (
      <TeacherKs2Section key="ks2" />
    ) : schoolUrn ? (
      <TeacherPhaseSection key={k} urn={schoolUrn} phase={k as "ks4" | "ks5"} heading={onField} />
    ) : null,
  );
  const extraDashboards = shown.flatMap((l) => keyDashboards[l] ?? []);
  const also: AlsoItem[] = [
    { href: "/dashboards", title: "Dashboards", line: "Every dashboard, in full", icon: <span className="flex h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{LibraryGlyph}</span>, colour: LIBRARY_ACCENT },
    ...extraDashboards.map((k) => ({ href: k.href, title: k.config.name, line: "A key VicData dashboard", icon: <IconGlyph drawing={resolveIcon(iconOf(k.config))} size={16} />, colour: colourOf(k.config.colour) })),
    ...(shown.includes("admissions") ? [{ href: "/teacher/admissions/team", title: "Team", line: "Who else works on admissions", icon: <PeopleGlyph />, colour: ROLE_ACCENT.admissions }] : []),
    ...(shown.includes("smt") || shown.includes("teacher") ? [{ href: "/teacher/recruitment", title: "Recruitment", line: "Who joins, and from where", icon: <RecruitmentGlyph />, colour: FEATURE_ACCENT.recruitment }] : []),
    { href: "/teacher/meetings", title: "Meetings", line: nextMeeting ? `Next: ${nextMeeting.name}, ${shortDate(nextMeeting.date)}` : "What do you need to show, and to whom?", icon: <MeetingsGlyph />, colour: FEATURE_ACCENT.meetings },
  ];

  return (
    <>
      <HomeFrame
        strip={<WhatsNewStrip entries={whatsNewEntries} />}
        heading={single ? null : <HomeHeading sub={sub} onField={false} />}
        sections={[
          ...(error ? [<p key="error" className="mx-auto w-full max-w-[1160px] px-4 text-sm text-[var(--muted)] sm:px-10">{error}</p>] : []),
          ...sections,
          // Q10 in the open-questions log: Teacher view is subject-exam-data only, and an independent
          // junior/prep has no public exams at that stage -- so Teacher view simply does not apply.
          ...(!error && phases.length === 0 && shown.includes("teacher") && !shown.includes("smt")
            ? [
                <div key="empty" className="mx-auto w-full max-w-[1160px] px-4 sm:px-10">
                  <div className="rounded-lg border border-[var(--panel-border)] p-5">
                    <h2 className="text-base font-semibold">Why is Teacher view empty for this school?</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                      Teacher view is built entirely on subject exam results, and {schoolName ?? "this school"} doesn&rsquo;t sit any &mdash; so there is nothing for it to show.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                      That isn&rsquo;t true of the platform as a whole. Roll, feeder-school and catchment data are held for your school, and the SMT, Finance and Admissions views are built on those rather than on exam results. If that&rsquo;s the view you need, your school&rsquo;s admin can grant it.
                    </p>
                  </div>
                </div>,
              ]
            : []),
        ]}
        also={also}
        labelsUrn={schoolUrn}
        labelsPhases={onboarded}
      />
      {/* 0.8 SMT feedback round 2 (section 6): feedback on this home as a whole. */}
      {schoolUrn && <PageSurface surface={schoolSurface({ product: "home", dashboard: { id: `home:${lens}`, name: HOME_NAME[lens] }, urn: schoolUrn, name: schoolName ?? schoolUrn, role: lens, state: { lens } })} />}
    </>
  );
}

// Each role's line under the heading (the boards' wording).
const SUBLINE: Record<Lens, string> = {
  teacher: "Pick a question. Each one walks you through a few screens, one thing at a time.",
  smt: "The whole school first, then down to subjects. Each question walks you through a few screens, one thing at a time.",
  admissions: "The pool of children who could join you, and the share you win. Each question walks you through a few screens.",
};

function PeopleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
