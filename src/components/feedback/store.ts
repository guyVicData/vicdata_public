"use client";

// VicData 0.8 notes and feedback (decision 4): the page's one feedback store -- whether this person
// may give feedback (the audience setting, decided by the server), their own items (for each view's
// icon colour and the window's list), and which view the feedback window is open on. One per page,
// shared by every panel, so a view's icon changes the moment an item is sent.
import { useSyncExternalStore } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { pageKey, type FeedbackMark, type FeedbackStatus, type ViewRef, type ViewSurface } from "@/lib/view-ref";

export type OwnItem = {
  id: string;
  number: number;
  created_at: string;
  view_key: string;
  school_urn: string | null;
  school_name: string | null;
  group_id: string | null;
  group_name: string | null;
  status: FeedbackStatus;
  looks_good: boolean;
  kinds: string[];
  has_text: boolean;
  excerpt: string;
};

/** What the window is open on: the view, the page it is on, and the panel's element (to keep in view). */
// 0.8 SMT feedback round 2 (section 6): `page` -- the window is on the whole page (no panel or view; its
// view is the page's name, its key pageKey).
export type FeedbackTarget = { surface: ViewSurface; view: ViewRef; viewKey: string; anchor: HTMLElement | null; openedAt: number; page?: boolean };

// 0.8 SMT feedback round 1 (F-5, R-FEEDBACK-FOLLOWS-VIEW): the view each panel is showing now, keyed by
// dashboard and panel (panelKey), so the window can see when its panel's rail has moved on.
export type PanelView = Omit<FeedbackTarget, "openedAt">;
export const panelKey = (surface: ViewSurface, panelId: string) => `${surface.dashboard.id}:${panelId}`;

// `page`: the page's own surface, for "Feedback on this page" (set by the page's ViewSurfaceProvider, or
// PageSurface on a page without views).
type State = { status: "idle" | "loading" | "ready"; allowed: boolean; items: OwnItem[]; target: FeedbackTarget | null; panels: Record<string, PanelView>; page: ViewSurface | null };

let state: State = { status: "idle", allowed: false, items: [], target: null, panels: {}, page: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: State = { status: "idle", allowed: false, items: [], target: null, panels: {}, page: null };

export async function feedbackToken(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/** Read once per page: may this person give feedback, and their items. Quietly nothing when signed
 * out, when the server says no, or before the migration is applied. */
export async function loadFeedback(force = false): Promise<void> {
  if (!force && state.status !== "idle") return;
  setState({ status: "loading" });
  try {
    const token = await feedbackToken();
    if (!token) return setState({ status: "ready", allowed: false, items: [] });
    const res = await fetch("/api/feedback", { headers: { Authorization: `Bearer ${token}` } });
    const json = res.ok ? ((await res.json()) as { allowed?: boolean; items?: OwnItem[] }) : null;
    setState({ status: "ready", allowed: json?.allowed === true, items: json?.items ?? [] });
  } catch {
    setState({ status: "ready", allowed: false, items: [] });
  }
}

// The server's snapshot is the store as it stands: on a real page it is only ever filled in the browser
// (loadFeedback runs in an effect), so a server render draws no icon, as before; a unit test's server
// render sees what the test put in it.
/** The store as it stands, outside React (tests). */
export function feedbackSnapshot(): State {
  return state;
}

export function useFeedbackState(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function openFeedback(target: Omit<FeedbackTarget, "openedAt">) {
  setState({ target: { ...target, openedAt: Date.now() } });
}
/** F-5: the window moves to the view its panel shows now -- the same opening, so the draft is kept. */
export function moveFeedback(to: PanelView) {
  if (!state.target) return;
  setState({ target: { ...to, openedAt: state.target.openedAt } });
}
/** A panel says which view it shows (CardBox, as its rail changes). Only a change is announced. */
export function setPanelView(v: PanelView) {
  const k = panelKey(v.surface, v.view.panelId);
  const was = state.panels[k];
  if (was && was.viewKey === v.viewKey && was.anchor === v.anchor && was.view.label === v.view.label) return;
  setState({ panels: { ...state.panels, [k]: v } });
}
export function clearPanelView(v: PanelView) {
  const k = panelKey(v.surface, v.view.panelId);
  if (state.panels[k]?.viewKey !== v.viewKey) return;
  const next = { ...state.panels };
  delete next[k];
  setState({ panels: next });
}
/** The view the target's panel shows now, when it isn't the one the window is on (else null). */
export function movedView(s: Pick<State, "target" | "panels">): PanelView | null {
  if (!s.target) return null;
  const live = s.panels[panelKey(s.target.surface, s.target.view.panelId)];
  return live && live.viewKey !== s.target.viewKey ? live : null;
}
/** Section 6: the page this is (only a change is announced). */
export function setPageSurface(surface: ViewSurface | null) {
  if (JSON.stringify(surface) === JSON.stringify(state.page)) return;
  setState({ page: surface });
}
export function closeFeedback() {
  setState({ target: null });
}
export function addOwnItem(item: OwnItem) {
  setState({ items: [item, ...state.items] });
}

/** The marks the icon's colour reads, for one view. */
export function marksFor(items: OwnItem[], viewKey: string): FeedbackMark[] {
  return items
    .filter((i) => i.view_key === viewKey)
    .map((i) => ({ status: i.status, looksGood: i.looks_good, hasText: i.has_text, kinds: i.kinds, schoolKey: i.school_urn ? `school:${i.school_urn}` : `group:${i.group_id}` }));
}

/** For the unit tests: put the store back as a fresh page has it. */
export function resetFeedbackStore(next: Partial<State> = {}) {
  state = { ...SERVER, ...next };
  emit();
}

/** Section 6 (R-FEEDBACK-PAGE): open the window on the whole page. */
export function openPageFeedback(surface: ViewSurface) {
  openFeedback({ surface, view: { panelId: "", panelName: null, instanceId: "", dataview: null, label: surface.dashboard.name }, viewKey: pageKey(surface.dashboard.id), anchor: null, page: true });
}
