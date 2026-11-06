"use client";

// VicData 0.8 notes and feedback (decision 4): the page's one feedback store -- whether this person
// may give feedback (the audience setting, decided by the server), their own items (for each view's
// icon colour and the window's list), and which view the feedback window is open on. One per page,
// shared by every panel, so a view's icon changes the moment an item is sent.
import { useEffect, useSyncExternalStore } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { pageKey, sameContext, type FeedbackMark, type FeedbackStatus, type ViewRef, type ViewSurface } from "@/lib/view-ref";

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
// 0.8 Admissions feedback round 2, item 3 (F-31): the window is tied to a view AND to the page as it was when
// it was tied -- `surface` (its state: entry point, set) and `address` (path and query) from that moment, and
// `tiedAt` (the store's own counter) so a later click in another panel can be told apart.
export type FeedbackTarget = { surface: ViewSurface; view: ViewRef; viewKey: string; anchor: HTMLElement | null; openedAt: number; tiedAt: number; address: Address; page?: boolean };
export type Address = { path: string; search: string };

// 0.8 SMT feedback round 1 (F-5, R-FEEDBACK-FOLLOWS-VIEW): the view each panel is showing now, keyed by
// dashboard and panel (panelKey), so the window can see when its panel's rail has moved on.
export type PanelView = Omit<FeedbackTarget, "openedAt" | "tiedAt" | "address">;
export const panelKey = (surface: ViewSurface, panelId: string) => `${surface.dashboard.id}:${panelId}`;

// `page`: the page's own surface, for "Feedback on this page" (set by the page's ViewSurfaceProvider, or
// PageSurface on a page without views).
// Round 2, item 3: `surfaces` -- each dashboard's surface on the page as it is NOW (its state changes with the
// entry point, the set, the filters; a panel's own copy in `panels` doesn't); `touched` -- the panel last
// clicked or tabbed into, with the counter.
type State = {
  status: "idle" | "loading" | "ready";
  allowed: boolean;
  items: OwnItem[];
  target: FeedbackTarget | null;
  panels: Record<string, PanelView>;
  page: ViewSurface | null;
  surfaces: Record<string, ViewSurface>;
  touched: { key: string; at: number } | null;
};

let state: State = { status: "idle", allowed: false, items: [], target: null, panels: {}, page: null, surfaces: {}, touched: null };
// The store's clock: a counter, not the time, so two things in the same millisecond still have an order.
let tick = 0;
const here = (): Address => (typeof window === "undefined" ? { path: "", search: "" } : { path: window.location.pathname, search: window.location.search });
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
const SERVER: State = { status: "idle", allowed: false, items: [], target: null, panels: {}, page: null, surfaces: {}, touched: null };

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

/** Open the window on a view, tied to the page as it is now (`address` is for the tests; the page's own
 * otherwise). */
export function openFeedback(target: PanelView, address: Address = here()) {
  setState({ target: { ...target, openedAt: Date.now(), tiedAt: ++tick, address } });
}
/** F-5: the window moves to the view its panel shows now -- the same opening, so the draft is kept. Round 2:
 * it is tied afresh, to the page as it is now. */
export function moveFeedback(to: PanelView, address: Address = here()) {
  if (!state.target) return;
  setState({ target: { ...to, openedAt: state.target.openedAt, tiedAt: ++tick, address } });
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
/** Round 2, item 3: a dashboard says what its page shows now (ViewSurfaceProvider, PageSurface). */
export function setLiveSurface(surface: ViewSurface) {
  if (JSON.stringify(state.surfaces[surface.dashboard.id]) === JSON.stringify(surface)) return;
  setState({ surfaces: { ...state.surfaces, [surface.dashboard.id]: surface } });
}
export function clearLiveSurface(surface: ViewSurface) {
  if (!(surface.dashboard.id in state.surfaces)) return;
  const next = { ...state.surfaces };
  delete next[surface.dashboard.id];
  setState({ surfaces: next });
}
/** The page's surface, kept live in the store while the component is mounted. */
export function useLiveSurface(surface: ViewSurface | null) {
  const json = surface ? JSON.stringify(surface) : null;
  useEffect(() => {
    if (!json) return;
    const s = JSON.parse(json) as ViewSurface;
    setLiveSurface(s);
    return () => clearLiveSurface(s);
  }, [json]);
}
/** Round 2, item 3: someone clicked or tabbed into this panel (CardBox). Only a change is announced. */
export function touchPanel(surface: ViewSurface, panelId: string) {
  const key = panelKey(surface, panelId);
  if (state.touched?.key === key && (!state.target || state.touched.at > state.target.tiedAt)) return;
  setState({ touched: { key, at: ++tick } });
}

/** How the page has moved on from the view the window is tied to, and where the window could move:
 *   rail       its panel's rail shows another view (F-5);
 *   panel      another panel on the same dashboard was clicked into since;
 *   entry      the entry point (or level, phase) or the set changed what the view shows;
 *   dashboard  the page shows another dashboard (no move: that view's own icon opens the window there).
 * `to` is that view on the page as it is now -- never the old state with the new view. */
export type Drift = { kind: "rail" | "panel" | "entry" | "dashboard"; to: PanelView | null; now: ViewSurface };

type DriftState = Pick<State, "target" | "panels"> & Partial<Pick<State, "surfaces" | "touched" | "page">>;
export function driftOf(s: DriftState): Drift | null {
  const t = s.target;
  if (!t) return null;
  const surfaces = s.surfaces ?? {};
  const dash = t.surface.dashboard.id;
  // No surface registered at all (a test, a page without a provider): the page is taken as it was.
  const live = surfaces[dash] ?? (Object.keys(surfaces).length ? null : t.surface);
  if (!live) {
    const now = s.page ?? Object.values(surfaces)[0];
    if (t.page && now) return { kind: "dashboard", to: pageTarget(now), now };
    return now ? { kind: "dashboard", to: null, now } : null;
  }
  if (t.page) return sameContext(t.surface.state, live.state) ? null : { kind: "entry", to: { ...withoutTie(t), surface: live }, now: live };
  const own = s.panels[panelKey(t.surface, t.view.panelId)];
  const touched = s.touched && s.touched.at > t.tiedAt ? s.panels[s.touched.key] : undefined;
  if (touched && touched.view.panelId !== t.view.panelId && touched.surface.dashboard.id === dash && touched.viewKey !== t.viewKey) return { kind: "panel", to: { ...touched, surface: live }, now: live };
  if (own && own.viewKey !== t.viewKey) return { kind: "rail", to: { ...own, surface: live }, now: live };
  if (!sameContext(t.surface.state, live.state)) return { kind: "entry", to: { ...withoutTie(t), anchor: own?.anchor ?? t.anchor, surface: live }, now: live };
  return null;
}
const withoutTie = (t: FeedbackTarget): PanelView => ({ surface: t.surface, view: t.view, viewKey: t.viewKey, anchor: t.anchor, ...(t.page ? { page: true } : {}) });

/** The view the window could move to now (else null): F-5's rail, and since round 2 another panel, the entry
 * point or the set. */
export function movedView(s: DriftState): PanelView | null {
  return driftOf(s)?.to ?? null;
}

/** What Send records (R-FEEDBACK-FOLLOWS-VIEW, round 2): when the page still shows the window's view, the
 * page as it is at the moment of sending (state and address); when it has moved on and the window wasn't
 * moved, the page as it was when the window was tied ("send as it was"). Never the view of one moment with
 * the state or address of another. */
export function sendPlan(s: DriftState, now: Address = here()): { surface: ViewSurface; address: Address; drift: Drift | null } | null {
  const t = s.target;
  if (!t) return null;
  const drift = driftOf(s);
  if (drift) return { surface: t.surface, address: t.address, drift };
  return { surface: (s.surfaces ?? {})[t.surface.dashboard.id] ?? t.surface, address: now, drift: null };
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
  openFeedback(pageTarget(surface));
}
function pageTarget(surface: ViewSurface): PanelView {
  return { surface, view: { panelId: "", panelName: null, instanceId: "", dataview: null, label: surface.dashboard.name }, viewKey: pageKey(surface.dashboard.id), anchor: null, page: true };
}
