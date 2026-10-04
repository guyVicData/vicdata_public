"use client";

// VicData 0.6 S7: one meeting (docs/wireframes/v0.6/Meeting.dc.html, with the behaviour
// of MeetingPlay.dc.html): the slide strip, the 16:9 slide scaled to fit, its title and
// speaker notes, the layout picker, pick-up-and-swap, move to the previous/next slide,
// suggested titles, shuffle, undo/redo (G8), plus drag-and-drop between slots and
// slides. Present (1-up fullscreen), Grid view and Export PDF. An archived meeting is
// read-only but can still be presented and exported.
import { ViewAsBanner } from "@/components/view-as/ViewAsBanner";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DashboardConfig, DataviewInstance, SlideConfig } from "@/catalogue/types";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchNotes, saveNote } from "@/lib/teacher-view-data";
import { DELTA_NEGATIVE } from "@/lib/teacher-view-theme";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { LAYOUT_CELLS, LAYOUT_LABEL, MANUAL_LAYOUTS, MEETING_UI, arrangeSlide, fitScale, CANVAS_HEIGHT, CANVAS_WIDTH, type SlideLayout } from "@/lib/meeting-layout";
import * as ops from "@/lib/meeting-ops";
import { slotTitle, type PinInput } from "@/lib/meeting-views";
import { friendlyMeetingError, loadMeeting, mySchool, NOT_APPLIED_LINE, publishMeeting, saveMeeting, updateMeetingDetails, type LoadedMeeting } from "@/lib/meeting-store";
import { AddViewFallback } from "./AddViewFallback";
import { EBtn, MeetingsTile, ROSE, ROSE_ROOT_STYLE, SlideThumb, usePrintLight } from "./MeetingChrome";
import { SlideCanvas, SlotNotesContext, type SlotNotes } from "./SlideCanvas";
import { useMeasure } from "./useMeasure";

// S4's chooser plugs in here: open it for a slide, and call `add` with the picked view and
// its pinned settings. Absent = the short fallback form.
export type OpenAddView = (slideId: string, add: (instance: DataviewInstance, pin: PinInput) => void) => void;

type School = { urn: string; name: string; accountId: string } | null;

export function MeetingEditorScreen({ id, openAddView }: { id: string; openAddView?: OpenAddView }) {
  const [theme] = useTeacherTheme();
  usePrintLight(theme);
  const [state, setState] = useState<
    { status: "loading" } | { status: "missing" } | { status: "not-applied" } | { status: "error"; message: string } | { status: "ready"; meeting: LoadedMeeting; school: School }
  >({ status: "loading" });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      try {
        const [meeting, school] = await Promise.all([loadMeeting(supabase, id), mySchool(supabase)]);
        if (!meeting) setState({ status: "missing" });
        else if (!meeting.available) setState({ status: "not-applied" });
        else setState({ status: "ready", meeting, school });
      } catch (e) {
        setState({ status: "error", message: friendlyMeetingError(e) });
      }
    })();
  }, [id]);

  return (
    <main id="teacher-root" data-theme={theme} style={ROSE_ROOT_STYLE} className="flex min-h-dvh w-full flex-col bg-[var(--bg)] leading-[1.2] text-[var(--fg)]">
      {/* Only while trying VicData as a member (renders nothing otherwise). */}
      <ViewAsBanner className="mx-4 mt-3" />
      {state.status === "ready" ? (
        <MeetingEditor meeting={state.meeting} school={state.school} openAddView={openAddView} />
      ) : (
        <div className="mx-auto w-full max-w-3xl p-6">
          <Link href="/teacher/meetings" className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
            ← Meetings
          </Link>
          <p className="mt-4 text-[14px] text-[var(--muted)]">
            {state.status === "loading" && "Loading…"}
            {state.status === "missing" && "This meeting isn't there, or isn't yours to open."}
            {state.status === "not-applied" && NOT_APPLIED_LINE}
            {state.status === "error" && state.message}
          </p>
        </div>
      )}
    </main>
  );
}

function MeetingEditor({ meeting, school, openAddView }: { meeting: LoadedMeeting; school: School; openAddView?: OpenAddView }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const today = ops.localToday();
  const [name, setName] = useState(meeting.row.name);
  const [date, setDate] = useState(meeting.row.meeting_date ?? today);
  const archived = ops.isArchived(date, today);
  const readOnly = archived || !meeting.isOwner;
  const [initial] = useState(() => ops.initEditor(meeting.config.presentation?.slides ?? []));
  const [ed, setEd] = useState(initial);
  // What the last successful save wrote: the "Saved" / "Unsaved" line compares with it.
  const [saved, setSaved] = useState({ slides: initial.slides, name: meeting.row.name });
  const [view, setView] = useState<"edit" | "grid">("edit");
  // ?present=1 from the library's Present button. (This component mounts only after the
  // meeting has loaded in the browser, so reading the URL here never meets the server.)
  const [present, setPresent] = useState<number | null>(() => (new URLSearchParams(window.location.search).get("present") ? 0 : null));
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const published = useRef<DashboardConfig | null>(meeting.published);
  const dirtySincePublish = useRef(false);
  const first = useRef(true);

  const config = useMemo<DashboardConfig>(
    () => ({ ...meeting.config, name, presentation: { ...(meeting.config.presentation ?? { slides: [] }), meetingDate: date, slides: ed.slides } }),
    [meeting.config, name, date, ed.slides],
  );
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Autosave the draft after the last edit.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (readOnly) return;
    dirtySincePublish.current = true;
    const t = window.setTimeout(async () => {
      setSaving(true);
      const c = configRef.current;
      try {
        await saveMeeting(supabase, meeting.row.id, c, meeting.version?.id);
        setSaved({ slides: c.presentation?.slides ?? [], name: c.name });
        setError(null);
      } catch (e) {
        setError(friendlyMeetingError(e));
      }
      setSaving(false);
    }, MEETING_UI.autosaveMs);
    return () => window.clearTimeout(t);
  }, [config, readOnly, supabase, meeting.row.id, meeting.version?.id]);

  // A version at each natural checkpoint, when something changed (brief §4.8).
  const checkpoint = useCallback(async () => {
    if (readOnly || !dirtySincePublish.current) return;
    try {
      await publishMeeting(supabase, meeting.row.id, configRef.current, published.current);
      published.current = configRef.current;
      dirtySincePublish.current = false;
    } catch (e) {
      setError(friendlyMeetingError(e));
    }
  }, [readOnly, supabase, meeting.row.id]);
  useEffect(() => () => void checkpoint(), [checkpoint]);

  // Private slot notes (G2), keyed on the view instance in teacher_view_notes.
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!school) return;
    (async () => setNotes(await fetchNotes(supabase, school.urn)))();
  }, [supabase, school]);
  const slotNotes = useMemo<SlotNotes | null>(() => {
    if (!school) return null;
    const key = (viewId: string) => `meeting:${meeting.row.id}:${viewId}`;
    return {
      get: (viewId) => notes[key(viewId)] ?? null,
      save: async (viewId, body) => {
        if (await saveNote(supabase, school.urn, key(viewId), body)) setNotes((n) => ({ ...n, [key(viewId)]: body }));
      },
    };
  }, [school, notes, supabase, meeting.row.id]);

  const apply = (f: (s: ops.EditorState) => ops.EditorState) => {
    if (readOnly) return;
    setEd((s) => f(s));
  };

  // Keyboard: undo/redo, Escape puts a picked-up view down.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (present !== null || readOnly) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t?.closest("input, textarea, select, [contenteditable=true]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        setEd((s) => (e.shiftKey ? ops.redo(s) : ops.undo(s)));
      } else if (e.key === "Escape" && !typing) {
        setEd((s) => ops.deselect(s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, readOnly]);

  // ?print=1 from the library's PDF button.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print")) window.setTimeout(() => window.print(), 400);
  }, []);

  const saveDetails = async (patch: { name?: string; meetingDate?: string }) => {
    try {
      await updateMeetingDetails(supabase, meeting.row.id, patch);
      setError(null);
      return true;
    } catch (e) {
      setError(friendlyMeetingError(e));
      return false;
    }
  };

  const doAddView = (slideId: string) => {
    if (openAddView) {
      openAddView(slideId, (instance, pin) => {
        setEd((s) => {
          const i = s.slides.findIndex((x) => x.id === slideId);
          return i < 0 ? s : ops.addViewHere(s, i, instance, pin);
        });
      });
    } else setAdding(slideId);
  };

  const slide = ed.slides[ed.cur];
  const arrangement = arrangeSlide(slide);
  const slideCount = ed.slides.length;
  const sel = ed.sel;
  const selSlot = sel ? ed.slides[sel.slide]?.slots[sel.idx] : null;
  const layoutNote = arrangement.fellBack
    ? "Too many views for that layout, so Auto is used"
    : slide.layout === "auto"
      ? "Auto: 1, then 2 across, 3 across, 3 × 2"
      : "Slots are the standard panel size. Each holds one specific view: no columns, rows or rail. Darker = a text box";

  const subtitle = [
    `${archived ? "Met" : "Meeting"} ${ops.shortDate(date, today)}`,
    archived ? "read-only" : `archives automatically on ${ops.shortDate(ops.dayAfter(date), today)}`,
    `${slideCount} slide${slideCount === 1 ? "" : "s"}`,
    meeting.isOwner ? "only you" : "shared with you",
  ].join(" · ");

  const exportPdf = async () => {
    await checkpoint();
    window.print();
  };

  return (
    <SlotNotesContext.Provider value={slotNotes}>
      {/* Header (Meeting.dc.html: padding 14 24, border-bottom). */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-3.5 print:hidden">
        <Link href="/teacher/meetings" aria-label="All meetings" title="All meetings">
          <MeetingsTile />
        </Link>
        <div className="min-w-0">
          {readOnly ? (
            <div className="text-[15px] font-bold">{name}</div>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== meeting.row.name && saveDetails({ name: name.trim() })}
              aria-label="Meeting name"
              className="w-[min(520px,60vw)] bg-transparent text-[15px] font-bold text-[var(--fg)] outline-none"
            />
          )}
          <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
            {editingDate && !readOnly ? (
              <input
                type="date"
                value={date}
                min={today}
                autoFocus
                onChange={async (e) => {
                  const v = e.target.value;
                  if (!v) return;
                  if (await saveDetails({ meetingDate: v })) setDate(v);
                  setEditingDate(false);
                }}
                onBlur={() => setEditingDate(false)}
                className="rounded border border-[var(--panel-border2)] bg-transparent px-1 text-[11.5px] text-[var(--fg)]"
              />
            ) : (
              <button type="button" disabled={readOnly} onClick={() => setEditingDate(true)} className="text-left enabled:hover:text-[var(--fg)]" title={readOnly ? undefined : "Change the date"}>
                {subtitle}
              </button>
            )}
            {!readOnly && <span className="text-[var(--muted3)]">· {saving ? "Saving…" : saved.slides === ed.slides && saved.name === name ? "Saved" : "Unsaved"}</span>}
          </div>
        </div>
        <span className="flex-grow" />
        {readOnly && (
          <span className="rounded-full bg-[var(--panel-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--muted)]">Read-only</span>
        )}
        {!readOnly && (
          <>
            <EBtn onClick={() => setEd(ops.undo)} disabled={!ops.canUndo(ed)} title="Undo (⌘Z)">
              Undo{ed.past.length ? ` (${ed.past.length})` : ""}
            </EBtn>
            <EBtn onClick={() => setEd(ops.redo)} disabled={!ops.canRedo(ed)} title="Redo (⇧⌘Z)">
              Redo
            </EBtn>
          </>
        )}
        <EBtn onClick={() => { void checkpoint(); setView(view === "grid" ? "edit" : "grid"); }}>{view === "grid" ? "Slides" : "Grid view"}</EBtn>
        <EBtn disabled title="Sharing a meeting comes with Assign; meetings are personal for now">
          Assign / share
        </EBtn>
        <EBtn onClick={exportPdf}>Export PDF</EBtn>
        <EBtn primary onClick={() => { void checkpoint(); setPresent(ed.cur); }}>
          Present
        </EBtn>
      </header>
      {error && <div className="border-b border-[var(--border)] px-6 py-2 text-[12px] print:hidden" style={{ color: DELTA_NEGATIVE }}>{error}</div>}

      <div className="flex min-h-0 flex-grow print:hidden">
        {view === "edit" && (
          // The slide strip (Meeting.dc.html: 216 wide, padding 16 24, gap 12).
          <aside className="flex shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--border)] px-6 py-4" style={{ width: MEETING_UI.stripWidth }}>
            {ed.slides.map((s, i) => (
              <SlideThumb
                key={s.id}
                slide={s}
                index={i}
                current={i === ed.cur}
                selectedIdx={sel && sel.slide === i ? sel.idx : null}
                onClick={() => setEd((x) => ops.goTo(x, i))}
                onDrop={readOnly ? undefined : (from) => apply((x) => ops.dragMove(x, from, { slide: i, idx: null }))}
              />
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => apply(ops.addSlide)}
                className="ml-[18px] shrink-0 rounded-[7px] border border-dashed border-[var(--edge-strong)] bg-transparent p-2 text-[12px] font-semibold text-[var(--chip-fg)] hover:text-[var(--fg)]"
                style={{ width: MEETING_UI.thumbWidth }}
              >
                + Add slide
              </button>
            )}
          </aside>
        )}

        {view === "edit" ? (
          <section className="flex min-w-0 flex-grow flex-col gap-3 px-6 py-4">
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11.5px] font-semibold text-[var(--muted)]">Slide layout</span>
                <LayoutChoice layout="auto" on={slide.layout === "auto"} onPick={() => apply((s) => ops.setLayout(s, "auto"))} />
                {MANUAL_LAYOUTS.map((l) => (
                  <LayoutChoice key={l} layout={l} on={slide.layout === l} onPick={() => apply((s) => ops.setLayout(s, l))} />
                ))}
                <span className="mx-1.5 h-[18px] w-px bg-[var(--panel-border2)]" />
                <EBtn onClick={() => apply(ops.applySuggestedTitle)} disabled={!slide.slots.some((x) => x.view)}>
                  Suggest a title
                </EBtn>
                <EBtn onClick={() => apply(ops.shuffle)} disabled={slide.slots.length < 2}>
                  Shuffle order
                </EBtn>
                <span className="ml-1.5 text-[11px] text-[var(--muted)]">{layoutNote}</span>
              </div>
            )}

            <FittedSlide>
              {(scale) => (
                <SlideCanvas
                  slide={slide}
                  slideIndex={ed.cur}
                  total={slideCount}
                  scale={scale}
                  mode={readOnly ? "readonly" : "edit"}
                  selectedIdx={sel && sel.slide === ed.cur ? sel.idx : null}
                  handlers={{
                    onSlotClick: (i) => apply((s) => ops.clickSlot(s, i)),
                    onDropOnSlide: (from, toIdx) => apply((s) => ops.dragMove(s, from, { slide: s.cur, idx: toIdx })),
                    onAddView: () => doAddView(slide.id),
                    onAddText: () => apply(ops.addTextBox),
                    onTitle: (t) => apply((s) => ops.setTitle(s, t)),
                    onText: (slotId, t) => apply((s) => ops.setText(s, slotId, t)),
                  }}
                />
              )}
            </FittedSlide>

            {/* MeetingPlay's selection bar. */}
            <div className="flex min-h-[34px] items-center gap-2">
              {readOnly ? (
                <span className="text-[12px] text-[var(--muted)]">
                  {archived ? "This meeting has happened, so it's read-only. Present it or export it; to use it again, Reuse it from Meetings." : "Shared with you to view."}
                </span>
              ) : selSlot ? (
                <>
                  <span className="text-[12.5px] font-bold" style={{ color: ROSE.hex }}>Selected:</span>
                  <span className="max-w-[360px] truncate text-[12.5px] text-[var(--chip-fg)]">{selSlot.view ? slotTitle(selSlot) : `Text: ${selSlot.text || "empty"}`}</span>
                  <EBtn onClick={() => apply((s) => ops.nudge(s, -1))} disabled={sel!.slide === 0}>← To previous slide</EBtn>
                  <EBtn onClick={() => apply((s) => ops.nudge(s, 1))}>To next slide →</EBtn>
                  <EBtn onClick={() => apply(ops.removeSelected)} style={{ color: DELTA_NEGATIVE }}>Remove</EBtn>
                  <EBtn onClick={() => apply(ops.deselect)}>Done</EBtn>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--muted)]">Click another view to swap. Or go to another slide and press &ldquo;Move here&rdquo;.</span>
                </>
              ) : (
                <span className="text-[12px] text-[var(--muted)]">Click a view to pick it up, or drag it onto another slot or slide.</span>
              )}
              <span className="flex-grow" />
              {!readOnly && !selSlot && slideCount > 1 && (
                <button type="button" onClick={() => apply((s) => ops.deleteSlide(s, s.cur))} className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
                  Delete this slide
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  disabled={slide.slots.length >= 6}
                  onClick={() => (sel ? apply(ops.moveSelectedHere) : doAddView(slide.id))}
                  className="rounded-full border border-dashed bg-transparent px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
                  style={{ borderColor: ROSE.hex, color: ROSE.hex }}
                >
                  {ops.addLabel(ed)}
                </button>
              )}
            </div>

            <textarea
              aria-label="Speaker notes"
              rows={2}
              readOnly={readOnly}
              value={slide.notes ?? ""}
              onChange={(e) => apply((s) => ops.setNotes(s, e.target.value))}
              placeholder="Speaker notes — only you see these when presenting"
              className="w-full max-w-[1280px] resize-none rounded-[8px] border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 py-[9px] text-[12.5px] text-[var(--chip-fg)] placeholder:text-[var(--muted3)]"
            />
          </section>
        ) : (
          <GridView slides={ed.slides} onOpen={(i) => { setEd((s) => ops.goTo(s, i)); setView("edit"); }} />
        )}
      </div>

      <PrintDeck slides={ed.slides} />
      {present !== null && <Present slides={ed.slides} start={present} onClose={(i) => { setPresent(null); setEd((s) => ops.goTo(s, i)); }} />}
      {adding && (
        <AddViewFallback
          school={school}
          onClose={() => setAdding(null)}
          onAdd={(instance, pin) => {
            const slideId = adding;
            setAdding(null);
            setEd((s) => {
              const i = s.slides.findIndex((x) => x.id === slideId);
              return i < 0 ? s : ops.addViewHere(s, i, instance, pin);
            });
          }}
        />
      )}
    </SlotNotesContext.Provider>
  );
}

// The slide scaled to the room left in the editor column (decision 7).
function FittedSlide({ children }: { children: (scale: number) => React.ReactNode }) {
  const [ref, size] = useMeasure<HTMLDivElement>();
  const scale = fitScale(size.width, size.height, MEETING_UI.editorMaxScale);
  return (
    <div ref={ref} className="relative min-h-[240px] min-w-0 flex-grow">
      <div className="absolute left-0 top-0">{scale > 0 && children(scale)}</div>
    </div>
  );
}

// One layout choice: the "Auto" pill (MeetingPlay) or a tile drawn from the layout's own
// cells (Meeting.dc.html .lay: 46 x 26, text cells darker).
function LayoutChoice({ layout, on, onPick }: { layout: SlideLayout; on: boolean; onPick: () => void }) {
  if (layout === "auto") {
    return (
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className="rounded-full border px-3 py-[5px] text-[12px] font-bold"
        style={
          on
            ? { borderColor: ROSE.hex, background: `rgba(${ROSE.rgb},0.14)`, color: ROSE.hex }
            : { borderColor: "var(--panel-border2)", background: "var(--panel-bg)", color: "var(--chip-fg)" }
        }
      >
        Auto
      </button>
    );
  }
  const cells = LAYOUT_CELLS[layout];
  const cols = Math.max(...cells.map((c) => c.col + c.cols));
  const rows = Math.max(...cells.map((c) => c.row + c.rows));
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      aria-label={LAYOUT_LABEL[layout]}
      title={LAYOUT_LABEL[layout]}
      className="grid h-[26px] w-[46px] gap-[2px] rounded-[6px] border bg-[var(--panel-bg)] p-1"
      style={{ borderColor: on ? ROSE.hex : "var(--panel-border2)", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {cells.map((c, i) => (
        <i
          key={i}
          className="rounded-[2px]"
          style={{
            gridColumn: `${c.col + 1} / span ${c.cols}`,
            gridRow: `${c.row + 1} / span ${c.rows}`,
            background: on ? (c.kind === "text" ? `rgba(${ROSE.rgb},0.45)` : ROSE.hex) : c.kind === "text" ? "var(--panel-border2)" : "var(--edge-strong)",
          }}
        />
      ))}
    </button>
  );
}

// Grid view: every slide at once, scaled to the column; click one to edit it.
function GridView({ slides, onOpen }: { slides: SlideConfig[]; onOpen: (i: number) => void }) {
  const [ref, size] = useMeasure<HTMLDivElement>();
  const per = MEETING_UI.gridPerRow;
  const cellW = (size.width - (per - 1) * MEETING_UI.gridGap) / per;
  const scale = fitScale(cellW, Infinity, 1);
  return (
    <section ref={ref} className="min-w-0 flex-grow overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap" style={{ gap: MEETING_UI.gridGap }}>
        {scale > 0 &&
          slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[role=dialog], [data-slot-box] button")) return;
                onOpen(i);
              }}
              className="rounded-[10px] text-left outline-offset-2 hover:outline hover:outline-2"
              style={{ outlineColor: ROSE.hex } as CSSProperties}
              aria-label={`Open slide ${i + 1}`}
            >
              <SlideCanvas slide={s} slideIndex={i} total={slides.length} scale={scale} mode="readonly" />
            </button>
          ))}
      </div>
    </section>
  );
}

// Present: 1-up, fullscreen, arrows/Page keys/space to move, Escape to leave, N for notes.
function Present({ slides, start, onClose }: { slides: SlideConfig[]; start: number; onClose: (i: number) => void }) {
  const [i, setI] = useState(Math.min(start, slides.length - 1));
  const [showNotes, setShowNotes] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [stageRef, size] = useMeasure<HTMLDivElement>();
  const iRef = useRef(i);
  useEffect(() => {
    iRef.current = i;
  }, [i]);
  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onClose(iRef.current);
  }, [onClose]);

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      // A slot's own fullscreen modal takes Escape first.
      if (ref.current?.querySelector("[role=dialog]")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setI((n) => Math.min(slides.length - 1, n + 1));
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setI((n) => Math.max(0, n - 1));
      } else if (e.key === "Escape") close();
      else if (e.key.toLowerCase() === "n") setShowNotes((v) => !v);
    };
    const onFs = () => {
      if (!document.fullscreenElement) onClose(iRef.current);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [slides.length, close, onClose]);

  const scale = fitScale(size.width, size.height, MEETING_UI.presentMaxScale);
  const notes = slides[i]?.notes?.trim();
  return (
    <div ref={ref} className="fixed inset-0 z-[1400] flex flex-col bg-[var(--bg)] text-[var(--fg)] print:hidden" role="region" aria-label="Presenting">
      <div ref={stageRef} className="relative min-h-0 flex-grow">
        <div className="absolute inset-0 flex items-center justify-center">
          {scale > 0 && slides[i] && <SlideCanvas slide={slides[i]} slideIndex={i} total={slides.length} scale={scale} mode="present" />}
        </div>
      </div>
      {showNotes && (
        <div className="max-h-[22vh] shrink-0 overflow-y-auto border-t border-[var(--border)] px-6 py-3 text-[14px] leading-relaxed text-[var(--chip-fg)]">
          {notes || <span className="text-[var(--muted3)]">No speaker notes on this slide.</span>}
        </div>
      )}
      <div className="flex shrink-0 items-center justify-end gap-2 px-4 py-2 text-[12px] text-[var(--muted)]">
        <EBtn onClick={() => setShowNotes((v) => !v)}>{showNotes ? "Hide notes" : "Notes (N)"}</EBtn>
        <EBtn onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} aria-label="Previous slide">←</EBtn>
        <span className="tabular-nums">
          {i + 1} / {slides.length}
        </span>
        <EBtn onClick={() => setI((n) => Math.min(slides.length - 1, n + 1))} disabled={i >= slides.length - 1} aria-label="Next slide">→</EBtn>
        <EBtn onClick={close}>Exit (Esc)</EBtn>
      </div>
    </div>
  );
}

// Export PDF through the existing print path (window.print): one slide per page, A4
// landscape, each slide scaled to the page. Hidden on screen; a panel's own "Print this
// graph" (data-print-panel) hides the deck so it prints only that panel.
function PrintDeck({ slides }: { slides: SlideConfig[] }) {
  const page = MEETING_UI.printPage;
  const scale = fitScale(page.width, page.height, 1, CANVAS_WIDTH, CANVAS_HEIGHT);
  return (
    <div className="meeting-print-deck hidden print:block">
      <style>{`@media print {
  @page { size: ${page.cssSize}; margin: ${page.marginMm}mm; }
  #teacher-root { min-height: 0 !important; display: block !important; }
  .meeting-print-page { break-after: page; break-inside: avoid; }
  .meeting-print-page:last-child { break-after: auto; }
  #teacher-root[data-print-panel] .meeting-print-deck { display: none !important; }
}`}</style>
      {slides.map((s, i) => (
        <div key={s.id} className="meeting-print-page" style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}>
          <SlideCanvas slide={s} slideIndex={i} total={slides.length} scale={scale} mode="print" />
        </div>
      ))}
    </div>
  );
}
