// VicData 0.6 S7: slide editing as pure operations, from the MeetingPlay prototype
// (docs/wireframes/v0.6/MeetingPlay.dc.html, its logic block): click to select, click
// another to swap, move to the previous/next slide, add a slide, layouts, suggested
// titles, shuffle, and undo -- plus redo, drag-and-drop moves, text boxes and
// `addViewToMeeting` for Copy to meeting (S6). G8: undo/redo the last 30 actions.
//
// Every function takes a state and returns a new one; nothing is mutated. Unit-tested
// in meeting-ops.test.ts.
import { CONFIG_SCHEMA_VERSION, type DashboardConfig, type DataviewInstance, type SlideConfig } from "@/catalogue/types";
import { arrangeSlide, arrangementName, fitsLayout, MAX_SLOTS, MEETING_UI, type SlideLayout } from "./meeting-layout";
import { dataviewOf, KIND_WORD, pinnedOf, pinView, rollSlotForward, type PinInput } from "./meeting-views";

export type Slot = SlideConfig["slots"][number];
export type Selection = { slide: number; idx: number } | null;

export type EditorState = {
  slides: SlideConfig[];
  // The slide on show, and the picked-up slot (MeetingPlay's `cur` and `sel`).
  cur: number;
  sel: Selection;
  past: SlideConfig[][];
  future: SlideConfig[][];
  // Consecutive edits with the same key (typing a title) are one undo step.
  lastKey: string | null;
};

let counter = 0;
export function newId(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const rand = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  counter += 1;
  return `${prefix}-${rand}${counter.toString(36)}`;
}

export function emptySlide(): SlideConfig {
  return { id: newId("slide"), title: "", notes: "", layout: "auto", slots: [] };
}

export function initEditor(slides: SlideConfig[], cur = 0): EditorState {
  const s = slides.length ? slides : [emptySlide()];
  return { slides: s, cur: Math.max(0, Math.min(cur, s.length - 1)), sel: null, past: [], future: [], lastKey: null };
}

const clone = (slides: SlideConfig[]): SlideConfig[] => slides.map((s) => ({ ...s, slots: s.slots.slice() }));

// Record `slides` as a new undoable step. A `key` equal to the previous step's coalesces
// into it (one undo for a whole typed title).
export function commit(state: EditorState, slides: SlideConfig[], extra: Partial<EditorState> = {}, key: string | null = null): EditorState {
  const coalesce = key !== null && key === state.lastKey;
  const past = coalesce ? state.past : state.past.concat([state.slides]).slice(-MEETING_UI.undoDepth);
  return { ...state, ...extra, slides, past, future: coalesce ? state.future : [], lastKey: key };
}

export function canUndo(s: EditorState) {
  return s.past.length > 0;
}
export function canRedo(s: EditorState) {
  return s.future.length > 0;
}

export function undo(state: EditorState): EditorState {
  if (!state.past.length) return state;
  const prev = state.past[state.past.length - 1];
  return {
    ...state,
    slides: prev,
    past: state.past.slice(0, -1),
    future: [state.slides].concat(state.future).slice(0, MEETING_UI.undoDepth),
    sel: null,
    cur: Math.min(state.cur, prev.length - 1),
    lastKey: null,
  };
}

export function redo(state: EditorState): EditorState {
  if (!state.future.length) return state;
  const next = state.future[0];
  return {
    ...state,
    slides: next,
    past: state.past.concat([state.slides]).slice(-MEETING_UI.undoDepth),
    future: state.future.slice(1),
    sel: null,
    cur: Math.min(state.cur, next.length - 1),
    lastKey: null,
  };
}

export function goTo(state: EditorState, i: number): EditorState {
  if (i < 0 || i >= state.slides.length) return state;
  return { ...state, cur: i, lastKey: null };
}

// MeetingPlay clickSlot: pick up, put down (same slot), or swap/move onto another.
export function clickSlot(state: EditorState, i: number): EditorState {
  const { sel, cur } = state;
  if (!sel) return { ...state, sel: { slide: cur, idx: i } };
  if (sel.slide === cur && sel.idx === i) return { ...state, sel: null };
  return moveTo(state, cur, i);
}

export function deselect(state: EditorState): EditorState {
  return { ...state, sel: null };
}

// MeetingPlay moveTo: the picked-up slot goes to slide `ts` position `ti`. Onto another
// slot it swaps; past the end it moves to the end (refused when the slide is full).
export function moveTo(state: EditorState, ts: number, ti: number): EditorState {
  const sel = state.sel;
  if (!sel || !state.slides[ts] || !state.slides[sel.slide]?.slots[sel.idx]) return state;
  const S = clone(state.slides);
  const v = S[sel.slide].slots[sel.idx];
  const tgt = S[ts].slots;
  if (ts === sel.slide) {
    if (ti < tgt.length) {
      const t = tgt[ti];
      tgt[ti] = v;
      tgt[sel.idx] = t;
    } else {
      tgt.splice(sel.idx, 1);
      tgt.push(v);
    }
  } else if (ti < tgt.length) {
    const t = tgt[ti];
    tgt[ti] = v;
    S[sel.slide].slots[sel.idx] = t;
  } else {
    if (tgt.length >= MAX_SLOTS) return state;
    S[sel.slide].slots.splice(sel.idx, 1);
    tgt.push(v);
  }
  return commit(state, S, { sel: null });
}

// Drag-and-drop: the same move, from an explicit source. `to.idx` null = the end of
// that slide (an empty cell, or a slide thumbnail).
export function dragMove(state: EditorState, from: { slide: number; idx: number }, to: { slide: number; idx: number | null }): EditorState {
  if (from.slide === to.slide && from.idx === to.idx) return state;
  const target = state.slides[to.slide];
  if (!target) return state;
  const ti = to.idx === null ? target.slots.length : to.idx;
  const moved = moveTo({ ...state, sel: from }, to.slide, ti);
  return moved === state || moved.slides === state.slides ? { ...state, sel: null } : { ...moved, sel: null };
}

// MeetingPlay nudge: move the picked-up slot to the previous/next slide (a new slide past
// the last), and follow it there still selected.
export function nudge(state: EditorState, d: -1 | 1): EditorState {
  const sel = state.sel;
  if (!sel) return state;
  const t = sel.slide + d;
  if (t < 0) return state;
  const S = clone(state.slides);
  if (t >= S.length) S.push(emptySlide());
  if (S[t].slots.length >= MAX_SLOTS) return state;
  const [v] = S[sel.slide].slots.splice(sel.idx, 1);
  S[t].slots.push(v);
  return commit(state, S, { cur: t, sel: { slide: t, idx: S[t].slots.length - 1 } });
}

export function removeSelected(state: EditorState): EditorState {
  const sel = state.sel;
  if (!sel) return state;
  const S = clone(state.slides);
  S[sel.slide].slots.splice(sel.idx, 1);
  return commit(state, S, { sel: null });
}

export function removeSlot(state: EditorState, slide: number, idx: number): EditorState {
  if (!state.slides[slide]?.slots[idx]) return state;
  const S = clone(state.slides);
  S[slide].slots.splice(idx, 1);
  return commit(state, S, { sel: null });
}

export function addSlide(state: EditorState): EditorState {
  const S = clone(state.slides);
  S.push(emptySlide());
  return commit(state, S, { cur: S.length - 1, sel: null });
}

export function deleteSlide(state: EditorState, i: number): EditorState {
  if (!state.slides[i]) return state;
  const S = clone(state.slides);
  S.splice(i, 1);
  if (!S.length) S.push(emptySlide());
  return commit(state, S, { cur: Math.min(state.cur, S.length - 1), sel: null });
}

export function setLayout(state: EditorState, layout: SlideLayout): EditorState {
  const S = clone(state.slides);
  S[state.cur] = { ...S[state.cur], layout };
  return commit(state, S);
}

// MeetingPlay shuffle: the first view to the back.
export function shuffle(state: EditorState): EditorState {
  const slots = state.slides[state.cur].slots;
  if (slots.length < 2) return state;
  const S = clone(state.slides);
  S[state.cur].slots.push(S[state.cur].slots.shift()!);
  return commit(state, S, { sel: null });
}

export function setTitle(state: EditorState, title: string): EditorState {
  const S = clone(state.slides);
  S[state.cur] = { ...S[state.cur], title };
  return commit(state, S, {}, `title:${S[state.cur].id}`);
}

export function setNotes(state: EditorState, notes: string): EditorState {
  const S = clone(state.slides);
  S[state.cur] = { ...S[state.cur], notes };
  return commit(state, S, {}, `notes:${S[state.cur].id}`);
}

export function setText(state: EditorState, slotId: string, text: string): EditorState {
  const S = clone(state.slides);
  const slide = S[state.cur];
  const i = slide.slots.findIndex((s) => s.id === slotId);
  if (i < 0) return state;
  slide.slots[i] = { ...slide.slots[i], text };
  return commit(state, S, {}, `text:${slotId}`);
}

// "+ Text box": a text slot at the end of the slide on show.
export function addTextBox(state: EditorState): EditorState {
  if (state.slides[state.cur].slots.length >= MAX_SLOTS) return state;
  const S = clone(state.slides);
  S[state.cur].slots.push({ id: newId("slot"), text: "" });
  return commit(state, S, { sel: null });
}

// MeetingPlay suggestTitle: "<subject>: graph, ranking and map". The subject prefix is
// the views' shared subject when they have one.
export function suggestedTitle(slide: SlideConfig): string | null {
  const views = slide.slots.filter((s) => s.view);
  if (!views.length) return null;
  const kinds: string[] = [];
  for (const s of views) {
    const dv = dataviewOf(s);
    const k = dv ? KIND_WORD[dv.supports.viewType] : "view";
    if (!kinds.includes(k)) kinds.push(k);
  }
  const list = kinds.length === 1 ? kinds[0] : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
  const subjects = new Set(views.map((s) => pinnedOf(s).subjectLabel || pinnedOf(s).subject || ""));
  const subject = subjects.size === 1 ? [...subjects][0] : "";
  return subject ? `${subject}: ${list}` : list.charAt(0).toUpperCase() + list.slice(1);
}

export function applySuggestedTitle(state: EditorState): EditorState {
  const t = suggestedTitle(state.slides[state.cur]);
  if (!t) return state;
  const S = clone(state.slides);
  S[state.cur] = { ...S[state.cur], title: t };
  return commit(state, S);
}

// The add button's label (MeetingPlay addLabel).
export function addLabel(state: EditorState): string {
  const n = state.slides[state.cur].slots.length;
  if (n >= MAX_SLOTS) return "Slide full";
  if (state.sel && state.sel.slide !== state.cur) return "Move here";
  if (state.sel) return "Move to the end";
  return "+ Add a view";
}

// MeetingPlay addHere with something picked up: move it to the end of the slide on show.
export function moveSelectedHere(state: EditorState): EditorState {
  if (!state.sel) return state;
  return moveTo(state, state.cur, state.slides[state.cur].slots.length);
}

// Add a pinned view to a slide of the editor (the Add a view fallback and S4's chooser).
export function addViewHere(state: EditorState, slideIndex: number, instance: DataviewInstance, pin: PinInput): EditorState {
  const slide = state.slides[slideIndex];
  if (!slide) return state;
  const r = addViewToSlides(state.slides, slide.id, instance, pin);
  if (!r.ok) return state;
  return commit(state, r.slides, { cur: slideIndex, sel: null });
}

// -------------------------------------------------------------------------------------
// Copy to meeting (S6 calls this)

export type AddViewResult =
  | {
      ok: true;
      config: DashboardConfig;
      slideId: string;
      slotId: string;
      // Views on the slide now, and how it arranges itself ("side by side").
      count: number;
      arrangement: string;
      // True when a manual layout couldn't take the view and the slide went back to Auto.
      relaidOut: boolean;
    }
  | { ok: false; reason: "not-a-meeting" | "no-such-slide" | "slide-full" };

function addViewToSlides(
  slides: SlideConfig[],
  slideId: string | "new",
  instance: DataviewInstance,
  pin: PinInput,
): { ok: true; slides: SlideConfig[]; slideId: string; slotId: string; count: number; relaidOut: boolean } | { ok: false; reason: "no-such-slide" | "slide-full" } {
  const S = clone(slides);
  let i = slideId === "new" ? -1 : S.findIndex((s) => s.id === slideId);
  if (slideId === "new") {
    S.push(emptySlide());
    i = S.length - 1;
  }
  if (i < 0) return { ok: false, reason: "no-such-slide" };
  const slide = S[i];
  if (slide.slots.length >= MAX_SLOTS) return { ok: false, reason: "slide-full" };
  const slot: Slot = { id: newId("slot"), view: pinView({ ...instance, id: instance.id || newId("view") }, pin) };
  const slots = slide.slots.concat([slot]);
  // The slide re-arranges itself: Auto already follows the count; a manual layout that
  // can't take one more view goes back to Auto.
  const relaidOut = slide.layout !== "auto" && !fitsLayout(slide.layout, slots);
  S[i] = { ...slide, slots, layout: relaidOut ? "auto" : slide.layout };
  return { ok: true, slides: S, slideId: S[i].id, slotId: slot.id, count: slots.filter((s) => s.view).length, relaidOut };
}

// Put `instance`, pinned with `pin`, in the next free slot of slide `slideId` (or of a new
// slide at the end), and let the slide re-arrange. Returns a new config; the caller
// saves it (meeting-store saveMeeting).
export function addViewToMeeting(config: DashboardConfig, slideId: string | "new", instance: DataviewInstance, pin: PinInput): AddViewResult {
  if (config.kind !== "presentation") return { ok: false, reason: "not-a-meeting" };
  const slides = config.presentation?.slides ?? [];
  const r = addViewToSlides(slides, slideId, instance, pin);
  if (!r.ok) return r;
  const next: DashboardConfig = { ...config, presentation: { ...(config.presentation ?? { slides: [] }), slides: r.slides } };
  const slide = r.slides.find((s) => s.id === r.slideId)!;
  return {
    ok: true,
    config: next,
    slideId: r.slideId,
    slotId: r.slotId,
    count: r.count,
    arrangement: arrangementName(arrangeSlide(slide).cells.length),
    relaidOut: r.relaidOut,
  };
}

// For the Copy to meeting slide picker: "full", "next to the graph", "empty".
export function slideFill(slide: SlideConfig): { full: boolean; count: number } {
  return { full: slide.slots.length >= MAX_SLOTS, count: slide.slots.length };
}

// -------------------------------------------------------------------------------------
// Whole meetings

export function newMeetingConfig(input: { id?: string; name: string; meetingDate: string; slides?: SlideConfig[] }): DashboardConfig {
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    id: input.id ?? newId("meeting"),
    name: input.name,
    kind: "presentation",
    owner: "user",
    colour: { key: "neutral" },
    layout: { preset: "1", tracks: [], accordion: "independent" },
    columns: [],
    rows: [],
    panels: [],
    presentation: { meetingDate: input.meetingDate, slides: input.slides ?? [emptySlide()] },
  };
}

// "Reuse for next meeting": a copy with fresh ids and a new date, optionally with every
// pinned view moved on to the latest data.
export function reuseSlides(slides: SlideConfig[], rollForward: boolean): SlideConfig[] {
  return slides.map((s) => ({
    ...s,
    id: newId("slide"),
    slots: s.slots.map((slot) => {
      const copy = { ...slot, id: newId("slot"), view: slot.view ? { ...slot.view, id: newId("view") } : undefined };
      if (!copy.view) delete copy.view;
      return rollForward ? rollSlotForward(copy) : copy;
    }),
  }));
}

// Archived = the meeting date is before today (it archives the day after, brief §7.5).
// `today` is a local yyyy-mm-dd.
export function isArchived(meetingDate: string | null | undefined, today: string): boolean {
  return !!meetingDate && meetingDate < today;
}

export function localToday(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayAfter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

// "14 Nov" (and the year when it isn't this year's).
export function shortDate(date: string | null | undefined, today = localToday()): string {
  if (!date) return "no date";
  const [y, m, d] = date.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${month}${String(y) === today.slice(0, 4) ? "" : ` ${y}`}`;
}

// A one-line change summary for a published version (brief §4.8).
export function changeSummary(prev: SlideConfig[] | null, next: SlideConfig[]): string {
  if (!prev) return `${next.length} slide${next.length === 1 ? "" : "s"}`;
  const views = (ss: SlideConfig[]) => ss.reduce((n, s) => n + s.slots.filter((x) => x.view).length, 0);
  const parts: string[] = [];
  if (next.length !== prev.length) parts.push(`${next.length > prev.length ? "added" : "removed"} ${Math.abs(next.length - prev.length)} slide${Math.abs(next.length - prev.length) === 1 ? "" : "s"}`);
  const dv = views(next) - views(prev);
  if (dv) parts.push(`${dv > 0 ? "added" : "removed"} ${Math.abs(dv)} view${Math.abs(dv) === 1 ? "" : "s"}`);
  if (!parts.length) parts.push("edited slides");
  return parts.join(", ").replace(/^./, (c) => c.toUpperCase());
}
