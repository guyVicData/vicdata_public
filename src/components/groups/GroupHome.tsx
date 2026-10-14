"use client";

// VicData 0.8 groups r1 (G3): the head-office home (docs/wireframes/groups/Home.dc.html), at
// /teacher/group: the shell's nav and the role-home pattern (src/app/teacher/page.tsx). The group card
// (its dashboards shown as coming until rounds 2 and 3, and a summary line that already works), our
// schools (each opening that school's SMT read-only, or its public page), Access, My dashboards and
// Meetings. A platform admin sees it through View as, read-only and never logged.
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { TeacherNav, useNavLabels } from "@/components/teacher/TeacherNav";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { HomeCard, MeetingsGlyph, type TileColour } from "@/components/teacher/HomeCard";
import { FEATURE_ACCENT, GROUP_ACCENT } from "@/lib/teacher-view-theme";
import { GROUP_NOTES, GROUP_SOURCE_LABELS, groupNote } from "@/catalogue/notes";
import { periodLabel } from "@/catalogue/years";
import { listMeetings } from "@/lib/meeting-store";
import { shortDate } from "@/lib/meeting-ops";
import type { HeadOffice } from "@/lib/groups/access-rules";
import { groupVars } from "./ui";
import { GroupViewAsBanner } from "./GroupViewAsBanner";
import { useGroupOffices, type OfficesState } from "./useGroupOffices";

const SCHOOLS_TILE: TileColour = { hex: "#a78bfa", rgb: "167,139,250" };
const ACCESS_TILE: TileColour = { hex: "#fbbf24", rgb: "251,191,36" };
const DASHBOARDS_TILE: TileColour = { hex: "#c4b5fd", rgb: "167,139,250" };
export const GROUP_DASHBOARD_NAMES = ["Overview", "Schools", "Academic", "Pupils"] as const;

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

/** A card drawn as HomeCard draws one: a link, a button (Our schools opens its list), or plain (plain
 * head office's Access count). Spans inside, so it is valid in all three. */
function Card({ colour, icon, title, description, edge, children, href, onClick, expanded }: { colour: TileColour; icon: ReactNode; title: string; description: ReactNode; edge?: boolean; children?: ReactNode; href?: string; onClick?: () => void; expanded?: boolean }) {
  const style = { "--tile": colour.hex, "--tile-rgb": colour.rgb, ...(edge ? { borderColor: "var(--group-card-edge)" } : {}) } as CSSProperties;
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(var(--tile-rgb),0.14)] text-[var(--tile)]">{icon}</span>
        <span className="block min-w-0 flex-grow">
          <span className="block text-[15px] font-bold">{title}</span>
          <span className="mt-0.5 block text-[13px] text-[var(--muted2)]">{description}</span>
        </span>
      </span>
      {children}
    </>
  );
  const cls = "block w-full rounded-[14px] border-[1.5px] border-[var(--panel-border)] bg-[var(--panel-bg)] p-[15px] text-left";
  const live = `${cls} transition-colors duration-100 hover:border-[var(--tile)] hover:bg-[rgba(var(--tile-rgb),0.10)]`;
  if (href)
    return (
      <Link href={href} style={style} className={live}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-expanded={expanded} style={style} className={live}>
        {body}
      </button>
    );
  return (
    <div style={style} className={cls}>
      {body}
    </div>
  );
}

export function summaryLine(d: Pick<GroupHomeData, "summary">): string {
  const s = d.summary;
  const parts = [`${s.schools} schools`];
  if (s.changePct !== null) parts.push(`roll ${s.changePct >= 0 ? "▲" : "▼"} ${Math.abs(s.changePct).toFixed(1)}%`);
  parts.push(`${s.growing} growing`);
  return parts.join(" · ");
}

export function GroupHome() {
  const [theme, setTheme] = useTeacherTheme();
  const [labelsOn, setLabelsOn] = useNavLabels(null, []);
  const offices = useGroupOffices();
  return (
    <main id="teacher-root" data-theme={theme} className="mx-auto min-h-screen max-w-3xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6" style={groupVars(theme)}>
      <GroupViewAsBanner />
      <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={setTheme} />
      <Body offices={offices} />
    </main>
  );
}

function Body({ offices }: { offices: OfficesState }) {
  const [data, setData] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: GroupHomeData }>({ status: "loading" });
  const [name, setName] = useState<string | null>(null);
  const [nextMeeting, setNextMeeting] = useState<{ name: string; date: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const office = offices.status === "ready" ? offices.office : null;
  useEffect(() => {
    if (!office || offices.status !== "ready") return;
    let live = true;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      if (user && !offices.viewAs) {
        const { data: p } = await supabase.from("profiles").select("email, full_name").eq("id", user.id).maybeSingle<{ email: string | null; full_name: string | null }>();
        if (live) setName(p?.full_name || p?.email || user.email || null);
      }
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

  if (offices.status === "loading") return <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>;
  if (offices.status === "signed-out")
    return (
      <p className="mt-6 text-[13px] text-[var(--muted2)]">
        <Link href="/login?next=/teacher/group" className="font-bold text-[var(--group-accent-text)]">Sign in</Link> to see your group.
      </p>
    );
  if (offices.status === "none") return <p className="mt-6 text-[13px] text-[var(--muted2)]">The group view comes with a group membership, bought by the group&rsquo;s head office. You aren&rsquo;t a member of one.</p>;
  const o = offices.office;
  const d = data.status === "ready" ? data.data : null;
  return (
    <>
      <div className="mt-6">
        {!offices.viewAs && name && <h1 className="text-[22px] font-bold leading-tight">{name}</h1>}
        {offices.viewAs && <h1 className="text-[22px] font-bold leading-tight">Head office</h1>}
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">{groupNote("headOffice", { group: o.name })}</p>
      </div>
      {offices.all.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Group">
          {offices.all.map((x) => (
            <Link key={x.id} href={`/teacher/group?account=${x.id}`} aria-current={x.id === o.id ? "true" : undefined} className={`rounded-full border px-3 py-1 text-[12px] font-bold ${x.id === o.id ? "border-[var(--group-card-edge)] bg-[var(--group-chip-bg)] text-[var(--group-chip-fg)]" : "border-[var(--panel-border)] text-[var(--muted2)]"}`}>
              {x.name}
            </Link>
          ))}
        </div>
      )}
      {o.status === "suspended" && <p className="mt-4 text-[13px] text-[var(--muted2)]">This group account is suspended. VicData can tell you why.</p>}

      <p className="mt-[22px] text-base font-semibold text-[var(--muted2)]">What would you like to look at?</p>
      {data.status === "error" && <p className="mt-4 text-[13px] text-[var(--muted2)]">{data.message}</p>}

      <div className="mt-[18px] flex flex-col gap-[10px]">
        <Card colour={GROUP_ACCENT} icon={<GroupGlyph />} title="The group" description={GROUP_NOTES.theGroup} edge>
          <span className="mt-3 flex flex-wrap gap-1.5">
            {GROUP_DASHBOARD_NAMES.map((n) => (
              <span key={n} title={GROUP_NOTES.coming} className="rounded-full border border-dashed border-[var(--group-chip-border)] bg-[var(--group-chip-bg)] px-[11px] py-[6px] text-[12px] font-bold text-[var(--group-chip-fg)]">
                {n}
              </span>
            ))}
          </span>
          <span className="mt-2.5 block text-[12px] text-[var(--muted)]" title={d?.summary.period ? groupNote("summary", { now: periodLabel(d.summary.period), before: periodLabel(d.summary.period - 1), n: d.summary.compared }) : undefined}>
            {d ? summaryLine(d) : "…"}
          </span>
        </Card>

        <div>
          <Card colour={SCHOOLS_TILE} icon={<SchoolsGlyph />} title="Our schools" description={GROUP_NOTES.ourSchools} onClick={() => setOpen((x) => !x)} expanded={open} />
          {open && d && (
            <ul className="mt-1.5 overflow-hidden rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-bg)]" aria-label="Our schools">
              {d.schools.map((s) => (
                <li key={s.urn} className="border-b border-[var(--border)] last:border-0">
                  <Link href={s.vicdata ? `/teacher/smt?headOffice=${s.urn}` : `/schools/${s.urn}`} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--box-bg)]">
                    <span className="min-w-0 flex-grow truncate font-semibold">{s.name}</span>
                    {s.likely && <span title={GROUP_NOTES.likelyWhy} className="rounded-[6px] bg-[var(--group-likely-bg)] px-[7px] py-px text-[10.5px] font-bold text-[var(--group-likely-fg)]">{GROUP_NOTES.likely}</span>}
                    <span className="shrink-0 text-[12px] text-[var(--muted2)]">{s.vicdata ? "SMT, read-only" : "Public page"} &rarr;</span>
                  </Link>
                </li>
              ))}
              {d.source && <li className="px-3 py-2 text-[11.5px] text-[var(--muted2)]">{groupNote("membershipAsOf", { date: d.lastSeen ? shortDate(d.lastSeen) : "—", source: GROUP_SOURCE_LABELS[d.source] ?? d.source })}</li>}
            </ul>
          )}
        </div>

        <Card
          colour={ACCESS_TILE}
          icon={<LockGlyph />}
          title="Access"
          description={d ? groupNote("accessCard", { n: d.access.seeing, m: d.access.of }) : "…"}
          href={d && (d.canManage || d.viewAs) ? `/teacher/group/access${offices.all.length > 1 ? `?account=${o.id}` : ""}` : undefined}
        />

        {!offices.viewAs && (
          <>
            <HomeCard href="/dashboards" colour={DASHBOARDS_TILE} icon={<DashboardsGlyph />} title="My dashboards" description="The ones you’ve made, and those shared with head office" />
            <HomeCard href="/teacher/meetings" colour={FEATURE_ACCENT.meetings} icon={<MeetingsGlyph />} title="Meetings" description={nextMeeting ? `Next: ${nextMeeting.name}, ${shortDate(nextMeeting.date)}` : "What do you need to show, and to whom?"} />
          </>
        )}
      </div>
    </>
  );
}
