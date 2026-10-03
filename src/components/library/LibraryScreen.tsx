"use client";

// VicData 0.6 S6: the library (/dashboards; board docs/wireframes/v0.6/Main.dc.html) --
// Dashboards and Meetings tabs, an icon grid filterable by owner (VicData / the school /
// Mine) and colour, and "+ New dashboard" (super-admin: the editor is theirs in 0.6).
// Cards open /dashboards/[id]; meetings open /teacher/meetings/[id].
//
// Colours: the Teacher view tokens for the board's greys (#0a0a0b --bg, #131315
// --panel-bg, #1e1e22 --panel-border, #2a2a2e --panel-border2, #3a3a40 --edge-strong,
// #c9c9ce --chip-fg, #8a8a90 --muted, #9a9aa0 --muted2, #6a6a70 --muted3, #5c5c62
// --source) and the real accent tokens for every tile.
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { TeacherNav, useNavLabels } from "@/components/teacher/TeacherNav";
import { MeetingsGlyph } from "@/components/teacher/HomeCard";
import { FEATURE_ACCENT } from "@/lib/teacher-view-theme";
import { colourKeyOf, DASHBOARD_COLOURS } from "@/lib/dashboard-icons";
import { listMeetings, NOT_APPLIED_LINE, type MeetingSummary } from "@/lib/meeting-store";
import { localToday, shortDate } from "@/lib/meeting-ops";
import { DashboardIcon, IconTile } from "./DashboardIcon";
import { loadLibrary, loadViewer, type LibraryEntry, type Owner, type Viewer } from "./data";
import { LIB } from "./layout";

type Tab = "dashboards" | "meetings";
type OwnerFilter = "all" | Owner;

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; viewer: Viewer; available: boolean; entries: LibraryEntry[]; meetings: { available: boolean; list: MeetingSummary[] } };

export function LibraryScreen() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [theme, setTheme] = useTeacherTheme();
  const [labelsOn, setLabelsOn] = useNavLabels(null, []);
  const [tab, setTab] = useState<Tab>("dashboards");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [colour, setColour] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const today = localToday();

  useEffect(() => {
    (async () => {
      try {
        const viewer = await loadViewer(supabase);
        // ?tab=meetings opens the Meetings tab.
        if (new URLSearchParams(window.location.search).get("tab") === "meetings") setTab("meetings");
        if (!viewer.uid) return setState({ status: "signed-out" });
        const [lib, meetings] = await Promise.all([loadLibrary(supabase, viewer), listMeetings(supabase, today).catch(() => ({ available: false, meetings: [] }))]);
        setState({ status: "ready", viewer, available: lib.available, entries: lib.entries, meetings: { available: meetings.available, list: meetings.meetings.filter((m) => !m.archived) } });
      } catch {
        setError("Couldn't load your dashboards. Check your connection and try again.");
        setState({ status: "signed-out" });
      }
    })();
  }, [supabase, today]);

  const ready = state.status === "ready" ? state : null;
  const entries = ready?.entries ?? [];
  const colours = DASHBOARD_COLOURS.filter((c) => entries.some((e) => colourKeyOf(e.config.colour) === c.key));
  const shown = entries.filter((e) => (owner === "all" || e.owner === owner) && (!colour || colourKeyOf(e.config.colour) === colour));
  const schoolName = ready?.viewer.school?.name ?? "School";

  return (
    <main id="teacher-root" data-theme={theme} className="min-h-dvh w-full bg-[var(--bg)] text-[var(--fg)]">
      <div className="mx-auto max-w-3xl px-5 pb-7 pt-[18px] sm:p-6">
        <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={setTheme} />

        <div className="mt-5 flex flex-col" style={{ gap: LIB.gap }}>
          <div className="flex w-fit rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] p-[3px]" style={{ gap: LIB.tabsGap }} role="tablist">
            <TabButton on={tab === "dashboards"} onClick={() => setTab("dashboards")}>Dashboards</TabButton>
            <TabButton on={tab === "meetings"} onClick={() => setTab("meetings")}>Meetings</TabButton>
          </div>

          {tab === "dashboards" ? (
            <>
              <div>
                <h1 className="text-[20px] font-bold leading-[1.25]">Your dashboards</h1>
                <p className="mt-1.5 text-[13px] leading-[1.45] text-[var(--muted2)]">VicData dashboards, ones shared with your teams, and ones you&rsquo;ve made.</p>
              </div>

              <div className="flex flex-wrap" style={{ gap: 6 }}>
                <Chip on={owner === "all"} onClick={() => setOwner("all")}>All</Chip>
                <Chip on={owner === "vicdata"} onClick={() => setOwner("vicdata")}>VicData</Chip>
                <Chip on={owner === "school"} onClick={() => setOwner("school")}>{schoolName}</Chip>
                <Chip on={owner === "mine"} onClick={() => setOwner("mine")}>Mine</Chip>
                {colours.length > 0 && <span aria-hidden="true" className="h-[22px] w-px self-center bg-[var(--panel-border2)]" />}
                {colours.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={`Filter ${c.label}`}
                    aria-pressed={colour === c.key}
                    title={c.label}
                    onClick={() => setColour(colour === c.key ? null : c.key)}
                    className={`flex items-center justify-center rounded-full border bg-transparent ${colour === c.key ? "border-[var(--fg)]" : "border-[var(--panel-border2)]"}`}
                    style={{ width: LIB.dot, height: LIB.dot }}
                  >
                    <span className="rounded-full" style={{ width: LIB.dotInner, height: LIB.dotInner, background: c.hex }} />
                  </button>
                ))}
              </div>

              {error && <p className="text-[13px] text-[var(--muted)]">{error}</p>}
              {state.status === "loading" && <p className="text-[13px] text-[var(--muted)]">Loading…</p>}
              {state.status === "signed-out" && !error && <p className="text-[13px] text-[var(--muted)]">Sign in to see your dashboards.</p>}
              {ready && !ready.available && (
                <p className="text-[12.5px] leading-[1.45] text-[var(--muted2)]">
                  Saved dashboards arrive once the database update is applied. Until then this shows VicData&rsquo;s dashboards as they&rsquo;re built in code.
                </p>
              )}

              {ready && (
                <div className="grid" style={{ gridTemplateColumns: `repeat(${LIB.gridCols}, minmax(0, 1fr))`, gap: LIB.gridGap }}>
                  {ready.viewer.superAdmin && ready.available && <NewCard href="/dashboards/new" label="New dashboard" />}
                  {shown.map((e) => (
                    <DashboardCard key={e.row.id} entry={e} />
                  ))}
                </div>
              )}
              {ready && shown.length === 0 && entries.length > 0 && <p className="text-[13px] text-[var(--muted)]">Nothing matches those filters.</p>}

              <p className="text-[12px] leading-[1.45] text-[var(--source)]">
                GCSE and Post-16 also stay on Home with their 4-step tour, because they&rsquo;re VicData&rsquo;s key dashboards. Everything else lives here.
              </p>
            </>
          ) : (
            <MeetingsTab state={state} today={today} />
          )}
        </div>
      </div>
    </main>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`rounded-full border-0 px-4 py-[7px] text-[13px] font-bold ${on ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-transparent text-[var(--muted3)]"}`}
    >
      {children}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border text-[12px] ${on ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--bg)]" : "border-[var(--panel-border2)] bg-transparent font-semibold text-[var(--chip-fg)]"}`}
      style={{ padding: LIB.chipPad }}
    >
      {children}
    </button>
  );
}

const CARD = "flex flex-col border-[1.5px] border-[var(--panel-border)] bg-[var(--panel-bg)] transition-colors duration-100 hover:border-[var(--edge-strong)]";
const cardStyle: CSSProperties = { borderRadius: LIB.cardRadius, padding: LIB.cardPad, gap: 10, minHeight: LIB.cardMinHeight, boxSizing: "border-box" };

function OwnerLabel({ children }: { children: ReactNode }) {
  return <span className="truncate pl-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">{children}</span>;
}

function DashboardCard({ entry }: { entry: LibraryEntry }) {
  return (
    <Link href={entry.href} className={CARD} style={cardStyle}>
      <span className="flex items-center justify-between">
        <DashboardIcon config={entry.config} size={LIB.icon} />
        <OwnerLabel>{entry.ownerLabel}</OwnerLabel>
      </span>
      <span className="block">
        <span className="block text-[14px] font-bold leading-[1.25]">{entry.config.name}</span>
        <span className="mt-0.5 block text-[11.5px] text-[var(--muted)]">{entry.sub}</span>
      </span>
    </Link>
  );
}

function NewCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center border-[1.5px] border-dashed border-[var(--edge-strong)] bg-transparent text-[var(--chip-fg)] hover:text-[var(--fg)]"
      style={{ ...cardStyle, gap: 8 }}
    >
      <span className="flex items-center justify-center rounded-[10px]" style={{ width: LIB.icon, height: LIB.icon, background: "color-mix(in srgb, var(--fg) 6%, var(--bg))" }}>
        <svg width={LIB.plus} height={LIB.plus} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <span className="text-[13.5px] font-bold">{label}</span>
    </Link>
  );
}

// The Meetings tab: upcoming meetings as the same cards (rose tile, date where the owner
// goes), "+ New meeting", and the way to the archive. The meetings pages themselves are
// /teacher/meetings (S7).
function MeetingsTab({ state, today }: { state: State; today: string }) {
  const ready = state.status === "ready" ? state : null;
  const rose = FEATURE_ACCENT.meetings;
  return (
    <>
      <div>
        <h1 className="text-[20px] font-bold leading-[1.25]">Your meetings</h1>
        <p className="mt-1.5 text-[13px] leading-[1.45] text-[var(--muted2)]">Coming up first. Past meetings move to the archive the day after.</p>
      </div>
      {state.status === "loading" && <p className="text-[13px] text-[var(--muted)]">Loading…</p>}
      {ready && !ready.meetings.available && <p className="text-[12.5px] leading-[1.45] text-[var(--muted2)]">{NOT_APPLIED_LINE}</p>}
      {ready && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${LIB.gridCols}, minmax(0, 1fr))`, gap: LIB.gridGap }}>
          <NewCard href="/teacher/meetings" label="New meeting" />
          {ready.meetings.list.map((m) => (
            <Link key={m.id} href={`/teacher/meetings/${m.id}`} className={CARD} style={cardStyle}>
              <span className="flex items-center justify-between">
                <IconTile drawing={{ kind: "set", ref: "feature.meetings" }} colour={rose} size={LIB.icon} />
                <OwnerLabel>{shortDate(m.meetingDate, today)}</OwnerLabel>
              </span>
              <span className="block">
                <span className="block text-[14px] font-bold leading-[1.25]">{m.name}</span>
                <span className="mt-0.5 block text-[11.5px] text-[var(--muted)]">
                  {m.slideCount} slide{m.slideCount === 1 ? "" : "s"}
                  {m.dataAsOf ? ` · data as of ${m.dataAsOf}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
      <Link href="/teacher/meetings" className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: rose.hex }}>
        <span className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"><MeetingsGlyph /></span>
        All meetings, and the archive &rarr;
      </Link>
    </>
  );
}

