"use client";

// VicData 0.6 S7: the meetings list (docs/wireframes/v0.6/MeetingsArchive.dc.html) --
// Upcoming and Archive tabs, "+ New meeting" with a date, and on an archived meeting
// "Reuse for next meeting" (a new date, optionally every pinned view moved on to the
// latest data). Meetings archive themselves the day after their date; there is no
// delete-by date any more (scope brief §7.5).
//
// Before the S2 tables exist (dashboards-store says available: false) the page says so
// plainly and lists the meetings on the old tables, read-only.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchMeetings, type Meeting } from "@/lib/teacher-view-data";
import { DELTA_NEGATIVE } from "@/lib/teacher-view-theme";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { TeacherNav, useNavLabels } from "@/components/teacher/TeacherNav";
import { deleteDashboard } from "@/lib/dashboards-store";
import { localToday, shortDate } from "@/lib/meeting-ops";
import { createMeeting, friendlyMeetingError, listMeetings, meetingCap, NOT_APPLIED_LINE, reuseMeeting, type MeetingSummary } from "@/lib/meeting-store";
import { ROSE, ROSE_INK, ROSE_ROOT_STYLE } from "./MeetingChrome";

type Tab = "upcoming" | "archive";

export function MeetingsLibrary() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const [theme, setTheme] = useTeacherTheme();
  const [labelsOn, setLabelsOn] = useNavLabels(null, []);
  const [state, setState] = useState<{ status: "loading" } | { status: "signed-out" } | { status: "not-applied"; legacy: Meeting[] } | { status: "ready"; meetings: MeetingSummary[] }>({
    status: "loading",
  });
  const [cap, setCap] = useState<number | null>(5);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localToday();

  const load = useMemo(
    () => async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setState({ status: "signed-out" });
      const [list, c] = await Promise.all([listMeetings(supabase, today), meetingCap(supabase)]);
      setCap(c);
      if (!list.available) setState({ status: "not-applied", legacy: await fetchMeetings(supabase) });
      else setState({ status: "ready", meetings: list.meetings });
    },
    [supabase, today],
  );

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError(friendlyMeetingError(e));
        setState({ status: "ready", meetings: [] });
      }
    })();
  }, [load]);

  const meetings = state.status === "ready" ? state.meetings : [];
  const upcoming = meetings.filter((m) => !m.archived);
  const archive = meetings.filter((m) => m.archived);
  const shown = tab === "upcoming" ? upcoming : archive;
  const available = state.status === "ready";

  return (
    <main id="teacher-root" data-theme={theme} style={ROSE_ROOT_STYLE} className="min-h-dvh w-full bg-[var(--bg)] leading-[1.2] text-[var(--fg)]">
      <div className="mx-auto max-w-3xl px-5 pb-7 pt-[18px] sm:p-6">
        <TeacherNav phase={null} phases={[]} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={setTheme} />

        <div className="mt-[18px] flex flex-col gap-3.5">
          <div className="flex items-end justify-between">
            <h1 className="text-[20px] font-bold">Meetings</h1>
            <button
              type="button"
              disabled={!available}
              onClick={() => setCreating(true)}
              className="rounded-full border-0 px-3.5 py-2 text-[13px] font-bold disabled:opacity-45"
              style={{ background: ROSE.hex, color: ROSE_INK }}
            >
              + New meeting
            </button>
          </div>

          {creating && available && (
            <NewMeetingCard
              today={today}
              onCancel={() => setCreating(false)}
              onCreate={async (name, date) => {
                try {
                  const id = await createMeeting(supabase, { name, meetingDate: date });
                  router.push(`/teacher/meetings/${id}`);
                } catch (e) {
                  setError(friendlyMeetingError(e));
                }
              }}
            />
          )}

          <div className="flex w-fit gap-1.5 rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] p-[3px]">
            <TabButton on={tab === "upcoming"} onClick={() => setTab("upcoming")}>
              Upcoming{available ? ` · ${upcoming.length}` : ""}
            </TabButton>
            <TabButton on={tab === "archive"} onClick={() => setTab("archive")}>
              Archive
            </TabButton>
          </div>
          <div className="-mt-1 text-[12px] leading-[1.45] text-[var(--muted3)]">
            Meetings move here the day after they happen. The archive has no limit; only upcoming meetings count towards yours (
            {cap === null ? `${upcoming.length}, no limit` : `${upcoming.length} of ${cap}`}).
          </div>

          {error && <div className="text-[12.5px]" style={{ color: DELTA_NEGATIVE }}>{error}</div>}
          {state.status === "loading" && <p className="text-[13px] text-[var(--muted)]">Loading…</p>}
          {state.status === "signed-out" && <p className="text-[13px] text-[var(--muted)]">Sign in to see your meetings.</p>}
          {state.status === "not-applied" && <NotApplied legacy={state.legacy} />}

          {available && shown.length === 0 && (
            <p className="text-[13px] text-[var(--muted)]">
              {tab === "upcoming" ? "Nothing coming up. What's your next meeting?" : "No meetings have happened yet."}
            </p>
          )}
          {available &&
            shown.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                today={today}
                onReuse={async (date, rollForward) => {
                  try {
                    const id = await reuseMeeting(supabase, { name: m.name, config: m.config }, { meetingDate: date, rollForward });
                    router.push(`/teacher/meetings/${id}`);
                  } catch (e) {
                    setError(friendlyMeetingError(e));
                  }
                }}
                onDelete={async () => {
                  if (!window.confirm(`Delete "${m.name}"? This can't be undone.`)) return;
                  try {
                    await deleteDashboard(supabase, m.id);
                    await load();
                  } catch (e) {
                    setError(friendlyMeetingError(e));
                  }
                }}
              />
            ))}
        </div>
      </div>
    </main>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border-0 px-4 py-[7px] text-[13px] font-bold ${on ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-transparent text-[var(--muted)]"}`}
    >
      {children}
    </button>
  );
}

// MeetingsArchive.dc.html .btn / .btn.rose
function PillBtn({ rose = false, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { rose?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className="rounded-full border bg-transparent px-3 py-1.5 text-[12px] font-semibold disabled:opacity-45"
      style={rose ? { borderColor: ROSE.hex, color: ROSE.hex } : { borderColor: "var(--edge-strong)", color: "var(--fg)" }}
    />
  );
}

const CARD = "flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-[var(--panel-border)] bg-[var(--panel-bg)] p-3.5";
const FIELD = "rounded-[8px] border border-[var(--panel-border2)] bg-transparent px-2.5 py-1.5 text-[12.5px] text-[var(--fg)]";

function MeetingCard({
  meeting: m,
  today,
  onReuse,
  onDelete,
}: {
  meeting: MeetingSummary;
  today: string;
  onReuse: (date: string, rollForward: boolean) => void;
  onDelete: () => void;
}) {
  const [reusing, setReusing] = useState(false);
  const [date, setDate] = useState("");
  const [roll, setRoll] = useState(true);
  const href = `/teacher/meetings/${m.id}`;
  const meta = [
    m.archived ? `Met ${shortDate(m.meetingDate, today)}` : shortDate(m.meetingDate, today),
    `${m.slideCount} slide${m.slideCount === 1 ? "" : "s"}`,
    ...(m.dataAsOf ? [`data as of ${m.dataAsOf}`] : []),
  ].join(" · ");
  return (
    <div className={CARD}>
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-grow">
          <Link href={href} className="text-[14.5px] font-bold hover:underline">
            {m.name}
          </Link>
          <div className="mt-0.5 text-[12px] text-[var(--muted)]">{meta}</div>
        </div>
        {m.archived && (
          <span className="shrink-0 rounded-full bg-[var(--panel-border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--muted)]">Read-only</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!m.archived && (
          <Link href={href} className="rounded-full border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: ROSE.hex, color: ROSE.hex }}>
            Open
          </Link>
        )}
        <Link href={`${href}?present=1`} className="rounded-full border border-[var(--edge-strong)] px-3 py-1.5 text-[12px] font-semibold">
          Present
        </Link>
        <Link href={`${href}?print=1`} className="rounded-full border border-[var(--edge-strong)] px-3 py-1.5 text-[12px] font-semibold">
          PDF
        </Link>
        {m.archived ? (
          <PillBtn rose onClick={() => setReusing(!reusing)} aria-expanded={reusing}>
            Reuse for next meeting
          </PillBtn>
        ) : (
          <button type="button" onClick={onDelete} className="ml-auto text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
            Delete
          </button>
        )}
      </div>
      {reusing && (
        <div className="flex flex-col gap-2 border-t border-[var(--panel-border)] pt-2.5">
          <div className="text-[12px] font-bold" style={{ color: ROSE.hex }}>
            Reuse for next meeting
          </div>
          <label className="flex items-center gap-2 text-[12.5px]">
            <span className="w-[60px] text-[var(--muted)]">Date</span>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--chip-fg)]">
            <Switch on={roll} onChange={setRoll} />
            Move every view on to the latest data
          </label>
          <div className="flex gap-2">
            <PillBtn rose disabled={!date} onClick={() => onReuse(date, roll)}>
              Make the new meeting
            </PillBtn>
            <PillBtn onClick={() => setReusing(false)}>Cancel</PillBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// The board's 34 x 20 switch.
function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative h-5 w-[34px] shrink-0 rounded-full"
      style={{ background: on ? ROSE.hex : "var(--edge-strong)" }}
    >
      <span className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white" style={on ? { right: 3 } : { left: 3 }} />
    </button>
  );
}

function NewMeetingCard({ today, onCreate, onCancel }: { today: string; onCreate: (name: string, date: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className={CARD}>
      <div className="text-[12px] font-bold" style={{ color: ROSE.hex }}>
        New meeting
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meeting name, e.g. Governors' curriculum committee" aria-label="Meeting name" className={FIELD} autoFocus />
      <label className="flex items-center gap-2 text-[12.5px]">
        <span className="w-[60px] text-[var(--muted)]">Date</span>
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={FIELD} />
      </label>
      <div className="text-[11.5px] text-[var(--muted3)]">It moves to the Archive the day after this date.</div>
      <div className="flex gap-2">
        <PillBtn
          rose
          disabled={!name.trim() || !date || busy}
          onClick={async () => {
            setBusy(true);
            await onCreate(name.trim(), date);
            setBusy(false);
          }}
        >
          Create meeting
        </PillBtn>
        <PillBtn onClick={onCancel}>Cancel</PillBtn>
      </div>
    </div>
  );
}

function NotApplied({ legacy }: { legacy: Meeting[] }) {
  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold">{NOT_APPLIED_LINE}</div>
      {legacy.length > 0 ? (
        <>
          <div className="text-[12px] text-[var(--muted)]">Your meetings so far, from the old page (kept as they are until then):</div>
          <ul className="flex flex-col gap-1.5">
            {legacy.map((m) => (
              <li key={m.id} className="text-[13px]">
                <span className="font-semibold">{m.name}</span>
                <span className="text-[var(--muted)]"> · {m.meeting_date ? shortDate(m.meeting_date) : "no date"}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-[12px] text-[var(--muted)]">You have no meetings on the old page.</div>
      )}
    </div>
  );
}
