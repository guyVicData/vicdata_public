"use client";

// VicData 0.8 groups r1 (G3): the head-office home (docs/wireframes/groups/Home.dc.html), at
// /teacher/group: the shell's nav and the role-home pattern (src/app/teacher/page.tsx). The group card
// (its dashboards shown as coming until rounds 2 and 3, and a summary line that already works), our
// schools (each opening that school's SMT read-only, or its public page), Access, My dashboards and
// Meetings. A platform admin sees it through View as, read-only and never logged.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { effectiveTheme, useThemePref } from "@/components/shell/TeacherChrome";
import { MeetingsGlyph, type TileColour } from "@/components/teacher/HomeCard";
import { HomeFrame, HomeHeading, HomeSection, QuestionTile, walkHref, type AlsoItem, type TileFigure } from "@/components/front-door/home";
import { walksFor } from "@/lib/front-door/walks";
import { FEATURE_ACCENT, GROUP_ACCENT } from "@/lib/teacher-view-theme";
import { GROUP_NOTES, GROUP_SOURCE_LABELS, groupNote } from "@/catalogue/notes";
import { listMeetings } from "@/lib/meeting-store";
import { shortDate } from "@/lib/meeting-ops";
import type { HeadOffice } from "@/lib/groups/access-rules";
import { groupVars } from "./ui";
import { GroupViewAsBanner } from "./GroupViewAsBanner";
import { PageSurface } from "@/components/feedback/PageFeedback";
import { groupSurface } from "@/components/feedback/surface";
import { membersOf } from "@/lib/groups/access-rules";
import { useGroupOffices, type OfficesState } from "./useGroupOffices";
import { arrowed } from "@/lib/signed-delta";

const ACCESS_TILE: TileColour = { hex: "#fbbf24", rgb: "251,191,36" };
const DASHBOARDS_TILE: TileColour = { hex: "#c4b5fd", rgb: "167,139,250" };
export const GROUP_DASHBOARD_NAMES = ["Overview", "Schools", "Academic", "Pupils"] as const;
// 0.8 groups r2: Overview and Schools live; r3: Academic and Pupils too.
export const GROUP_DASHBOARD_LIVE: Record<(typeof GROUP_DASHBOARD_NAMES)[number], string | null> = { Overview: "/teacher/group/overview", Schools: "/teacher/group/schools", Academic: "/teacher/group/academic", Pupils: "/teacher/group/pupils" };

/** The group card's dashboard chips: a live one opens that dashboard for this account; a coming one is dashed. */
export function GroupDashChips({ accountId, size = "md" }: { accountId: string; size?: "md" | "sm" }) {
  const pad = size === "sm" ? "py-[5px]" : "py-[6px]";
  return (
    <>
      {GROUP_DASHBOARD_NAMES.map((n) => {
        const href = GROUP_DASHBOARD_LIVE[n];
        return href ? (
          <Link key={n} href={`${href}?account=${accountId}`} data-group-dash={n} className={`rounded-full border border-[var(--group-card-edge)] bg-[var(--group-switch-on)] px-[11px] ${pad} text-[12px] font-bold text-[var(--group-switch-knob-on)]`}>
            {n}
          </Link>
        ) : (
          <span key={n} title={GROUP_NOTES.coming} className={`rounded-full border border-dashed border-[var(--group-chip-border)] bg-[var(--group-chip-bg)] px-[11px] ${pad} text-[12px] font-bold text-[var(--group-chip-fg)]`}>
            {n}
          </span>
        );
      })}
    </>
  );
}

export type GroupHomeData = {
  office: HeadOffice;
  viewAs: boolean;
  canManage: boolean;
  summary: { schools: number; changePct: number | null; growing: number; compared: number; period: number | null };
  access: { seeing: number; of: number };
  schools: { urn: string; name: string; likely: boolean; vicdata: boolean }[];
  source: string | null;
  lastSeen: string | null;
};

export const GroupGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="6" cy="7" r="3" /><circle cx="18" cy="7" r="3" /><circle cx="12" cy="17" r="3" /><path d="M8.5 9 11 15M15.5 9 13 15" />
  </svg>
);
const SchoolsGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
  </svg>
);
const LockGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const DashboardsGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export function summaryLine(d: Pick<GroupHomeData, "summary">): string {
  const s = d.summary;
  const parts = [`${s.schools} schools`];
  if (s.changePct !== null) parts.push(`roll ${arrowed(s.changePct, (x) => `${x.toFixed(1)}%`, 1)} over 3 years`);
  parts.push(`${s.growing} growing`);
  return parts.join(" · ");
}

// 0.8 front door (B8, built last in milestone 3): head office's home, of plain question tiles like every
// home -- the top level's orange field with head office's deep bronze accent (C18), one card per group
// dashboard, each a question with its walk (B12), then "Our schools" (each opens that school's SMT home
// read-only, as before) and "Also here": My dashboards, Access, Meetings.
//
// Seam for group sets (merging to main first): its "Groups library" link (on GroupDashChips' `library`
// prop there) belongs in "Also here" here -- GROUPS_LIBRARY_HREF, null until that route is on main.
const GROUPS_LIBRARY_HREF: ((accountId: string) => string) | null = null;

export function GroupHome() {
  const [pref] = useThemePref();
  const offices = useGroupOffices();
  return <Body offices={offices} theme={effectiveTheme(pref)} />;
}

function groupFigures(d: GroupHomeData | null): Record<string, TileFigure> {
  if (!d) return {};
  const s = d.summary;
  return {
    "group-overview": { figure: String(s.schools), unit: s.schools === 1 ? "school" : "schools in the group" },
    ...(s.compared > 0 ? { "group-schools": { figure: `${s.growing} of ${s.compared}`, unit: "schools growing" } } : {}),
    ...(s.changePct !== null ? { "group-pupils": { figure: `${s.changePct > 0 ? "+" : s.changePct < 0 ? "−" : ""}${Math.abs(s.changePct).toFixed(1)}%`, unit: "combined roll over 3 years" } } : {}),
  };
}

function Body({ offices, theme }: { offices: OfficesState; theme: "dark" | "light" }) {
  const [data, setData] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: GroupHomeData }>({ status: "loading" });
  const [nextMeeting, setNextMeeting] = useState<{ name: string; date: string | null } | null>(null);
  const office = offices.status === "ready" ? offices.office : null;
  useEffect(() => {
    if (!office || offices.status !== "ready") return;
    let live = true;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`/api/group/home?account=${office.id}`, { headers: { Authorization: `Bearer ${s.session?.access_token ?? ""}` } }).catch(() => null);
      if (!live) return;
      if (!res || !res.ok) setData({ status: "error", message: res?.status === 404 ? "Not found." : "Could not load the group. Try again." });
      else setData({ status: "ready", data: (await res.json()) as GroupHomeData });
      if (!offices.viewAs)
        void listMeetings(supabase)
          .then((r) => {
            const next = r.meetings.find((m) => !m.archived);
            if (live) setNextMeeting(next ? { name: next.name, date: next.meetingDate } : null);
          })
          .catch(() => {});
    })();
    return () => {
      live = false;
    };
  }, [office, offices]);

  const frame = (sections: ReactNode[], also: AlsoItem[] = []) => (
    <HomeFrame heading={null} sections={sections} also={also} banner={<GroupViewAsBanner />} rootStyle={groupVars(theme)} />
  );
  const plain = (text: ReactNode) => [<p key="plain" className="mx-auto w-full max-w-[1160px] px-4 pt-6 text-[13px] text-[var(--muted2)] sm:px-10">{text}</p>];
  if (offices.status === "loading") return frame(plain("Loading…"));
  if (offices.status === "signed-out")
    return frame(
      plain(
        <>
          <Link href="/login?next=/teacher/group" className="font-bold text-[var(--group-accent-text)]">Sign in</Link> to see your group.
        </>,
      ),
    );
  if (offices.status === "none") return frame(plain("The group view comes with a group membership, bought by the group’s head office. You aren’t a member of one."));
  const o = offices.office;
  const d = data.status === "ready" ? data.data : null;
  const walks = walksFor("group");
  const figures = groupFigures(d);
  const params = { account: o.id };
  const heading = <HomeHeading sub="How the group is doing, and how its schools compare. Each question walks you through a few screens." onField />;
  const also: AlsoItem[] = [
    ...(!offices.viewAs ? [{ href: "/dashboards", title: "My dashboards", line: "Yours, and those shared with head office", icon: <DashboardsGlyph />, colour: DASHBOARDS_TILE }] : []),
    ...(GROUPS_LIBRARY_HREF ? [{ href: GROUPS_LIBRARY_HREF(o.id), title: "Groups library", line: "Groups to compare against", icon: <GroupGlyph />, colour: GROUP_ACCENT }] : []),
    ...(!o.noAccount ? [{ href: d && (d.canManage || d.viewAs) ? `/teacher/group/access${offices.all.length > 1 ? `?account=${o.id}` : ""}` : null, title: "Access", line: d ? groupNote("accessCard", { n: d.access.seeing, m: d.access.of }) : "…", icon: <LockGlyph />, colour: ACCESS_TILE }] : []),
    ...(!offices.viewAs ? [{ href: "/teacher/meetings", title: "Meetings", line: nextMeeting ? `Next: ${nextMeeting.name}, ${shortDate(nextMeeting.date)}` : "What do you need to show, and to whom?", icon: <MeetingsGlyph />, colour: FEATURE_ACCENT.meetings }] : []),
  ];
  return (
    <>
      {/* 0.8 SMT feedback round 2 (section 6): feedback on the group home as a whole. */}
      <PageSurface surface={groupSurface({ product: "home", dashboard: { id: "home:head_office", name: "Group home" }, groupId: membersOf(o), ref: o.id, name: o.name, state: {} })} />
      {frame(
        [
          <HomeSection
            key="group"
            field="group"
            accent={GROUP_ACCENT}
            chip="Head office"
            heading={heading}
            controls={
              offices.all.length > 1 ? (
                <span className="flex flex-wrap gap-1.5" role="group" aria-label="Group">
                  {offices.all.map((x) => (
                    <Link key={x.id} href={`/teacher/group?account=${x.id}`} aria-current={x.id === o.id ? "true" : undefined} className={`rounded-full border border-[var(--field-chip-border)] px-3.5 py-1.5 text-[14px] text-[var(--field-chip-fg)] ${x.id === o.id ? "bg-[var(--field-chip-bg)] font-semibold" : ""}`}>
                      {x.name}
                    </Link>
                  ))}
                </span>
              ) : (
                <span className="rounded-full bg-[var(--field-chip-bg)] px-3.5 py-1.5 text-[14px] font-semibold text-[var(--field-chip-fg)]">{o.name}</span>
              )
            }
            dashboard={{ label: "Open the full group dashboards", href: `/teacher/group/overview?account=${o.id}` }}
            cols={2}
            links={walks.map((w) => ({ label: w.question, href: walkHref(w, params) }))}
            tiles={walks.map((w) => (
              <QuestionTile key={w.id} walk={w} figure={figures[w.id] ?? null} ctx={{}} href={walkHref(w, params)} loading={data.status === "loading"} />
            ))}
            note={
              <>
                {o.status === "suspended" && <span className="block">This group account is suspended. VicData can tell you why.</span>}
                {o.noAccount && (
                  <span className="block" data-group-no-account="">
                    <strong>No group account yet.</strong> These are the group&rsquo;s dashboards from the published data, read-only. Access and everything else a group account holds come with one (Platform makes it).
                  </span>
                )}
                {data.status === "error" && <span className="block">{data.message}</span>}
              </>
            }
          >
            {d && d.schools.length > 0 && (
              <div className="flex flex-col gap-3" data-our-schools="">
                <h2 className="flex flex-wrap items-baseline gap-x-3 text-[22px] font-semibold text-[var(--field-ink)]">
                  Our schools <span className="text-[14px] font-normal">{GROUP_NOTES.ourSchools}</span>
                </h2>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" aria-label="Our schools">
                  {d.schools.map((s) => (
                    <li key={s.urn}>
                      <Link href={s.vicdata ? `/teacher/smt?headOffice=${s.urn}` : `/schools/${s.urn}`} className="fd-tile flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[var(--fg)]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--tile-tint)] text-[var(--tile-accent-text)]">
                          <SchoolsGlyph />
                        </span>
                        <span className="min-w-0 flex-grow">
                          <span className="block truncate text-[15px] font-medium">{s.name}</span>
                          <span className="block text-[12.5px] text-[var(--muted2)]">{s.vicdata ? "SMT home, read-only" : "Public page"}</span>
                        </span>
                        {s.likely && <span title={GROUP_NOTES.likelyWhy} className="rounded-[6px] bg-[var(--group-likely-bg)] px-[7px] py-px text-[10.5px] font-bold text-[var(--group-likely-fg)]">{GROUP_NOTES.likely}</span>}
                        <span aria-hidden="true" className="text-[var(--muted2)]">&rarr;</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {d.source && <p className="text-[12px] text-[var(--field-ink)]">{groupNote("membershipAsOf", { date: d.lastSeen ? shortDate(d.lastSeen) : "—", source: GROUP_SOURCE_LABELS[d.source] ?? d.source })}</p>}
              </div>
            )}
          </HomeSection>,
        ],
        also,
      )}
    </>
  );
}
