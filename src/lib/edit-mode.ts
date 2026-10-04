"use client";

// VicData 0.6 snagging round 2, item B: the Edit switch. Guy (a platform admin, and nobody
// else) can show or hide the dashboard editor on a page that draws a VicData-owned
// dashboard -- /teacher/[phase] and /dashboards/[id] when VicData owns it -- from a small
// switch in the site footer, or from the trial banner while trying VicData as a member.
//
// This file is the one shared store those pieces meet in:
//   * a page REGISTERS the VicData dashboard it is showing (useRegisterVicDataDashboard);
//     the site-wide Footer and the TrialBanner render their switch only while one is
//     registered, so everywhere else it isn't there at all;
//   * the switch's on/off (default off), kept in localStorage. 0.6 snag 4 (A): ONE setting
//     whether Guy is viewing as someone or not, so the Edit switch and the banner's Edit
//     behave identically in both (round 2 kept a separate per-tab one for each trial);
//   * "Preview draft" (trial only): this tab draws the editor's draft instead of the
//     published version -- client-side only, so what members see never changes;
//   * the page side (useInPlaceEdit): whether to show the editor now, the scroll position
//     to come back to, and a tick that says "reload the published config" after editing.
//
// Edits are always Guy's own: the editor writes drafts and versions with his session
// (saveDraft's updated_by, publish_dashboard's created_by = auth.uid()), never through the
// trial's stateUrn / trial_key. The trial's school and role only feed the live preview.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveTrial, TRIAL_EVENT } from "./trial";

const EDIT_EVENT = "vicdata:edit-mode";
const LOCAL_KEY = "vicdata.editMode";
const DRAFT_KEY = (stateKey: string) => `vicdata.previewDraft:${stateKey}`;
const SCROLL_KEY = "vicdata.editMode.scroll";

function emit() {
  try {
    window.dispatchEvent(new Event(EDIT_EVENT));
  } catch {
    // Not in a browser.
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EDIT_EVENT, cb);
  window.addEventListener(TRIAL_EVENT, cb);
  return () => {
    window.removeEventListener(EDIT_EVENT, cb);
    window.removeEventListener(TRIAL_EVENT, cb);
  };
}

function read(storage: "local" | "session", key: string): boolean {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(storage: "local" | "session", key: string, on: boolean) {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (on) s.setItem(key, "1");
    else s.removeItem(key);
  } catch {
    // Blocked storage: the switch still works for this page (memory below).
  }
}

// Memory fallback when storage throws, so the switch still flips for this visit.
const memory = new Map<string, boolean>();

function editKey(): { storage: "local" | "session"; key: string } {
  return { storage: "local", key: LOCAL_KEY };
}

function readEditOn(): boolean {
  const { storage, key } = editKey();
  return memory.get(key) ?? read(storage, key);
}

function readPreviewDraft(): boolean {
  const t = getActiveTrial();
  if (!t) return false;
  const key = DRAFT_KEY(t.stateKey);
  return memory.get(key) ?? read("session", key);
}

export function setEditOn(on: boolean) {
  const { storage, key } = editKey();
  if (on && !readEditOn()) {
    // Where to come back to when the switch goes off again.
    try {
      window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      scrollMemory = window.scrollY;
    }
  }
  memory.set(key, on);
  write(storage, key, on);
  emit();
}

export function setPreviewDraft(on: boolean) {
  const t = getActiveTrial();
  if (!t) return;
  const key = DRAFT_KEY(t.stateKey);
  memory.set(key, on);
  write("session", key, on);
  emit();
}

let scrollMemory: number | null = null;
function takeScroll(): number | null {
  try {
    const v = window.sessionStorage.getItem(SCROLL_KEY);
    window.sessionStorage.removeItem(SCROLL_KEY);
    if (v !== null) return Number(v) || 0;
  } catch {
    // fall through to memory
  }
  const m = scrollMemory;
  scrollMemory = null;
  return m;
}

// ------------------------------------------------------------------ registration

// The VicData dashboard the current page shows (its slug or id), or null.
let registered: string | null = null;

export function useRegisterVicDataDashboard(slug: string | null) {
  useEffect(() => {
    if (!slug) return;
    registered = slug;
    emit();
    return () => {
      if (registered === slug) registered = null;
      emit();
    };
  }, [slug]);
}

const serverFalse = () => false;
const serverNull = () => null;

export function useRegisteredDashboard(): string | null {
  return useSyncExternalStore(subscribe, () => registered, serverNull);
}

export function useEditOn(): boolean {
  return useSyncExternalStore(subscribe, readEditOn, serverFalse);
}

export function usePreviewDraft(): boolean {
  return useSyncExternalStore(subscribe, readPreviewDraft, serverFalse);
}

// ------------------------------------------------------------------ platform admin

// is_platform_admin, asked once per signed-in person per page load.
let adminCache: { uid: string; promise: Promise<boolean> } | null = null;

export async function isPlatformAdminCached(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? "";
  if (!uid) return false;
  if (adminCache?.uid === uid) return adminCache.promise;
  const promise = (async () => {
    try {
      const { data: a, error } = await supabase.rpc("is_platform_admin");
      return !error && a === true;
    } catch {
      return false;
    }
  })();
  adminCache = { uid, promise };
  return promise;
}

export function usePlatformAdminCached(supabase: SupabaseClient): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    isPlatformAdminCached(supabase).then((a) => { if (live) setAdmin(a); }, () => { if (live) setAdmin(false); });
    return () => { live = false; };
  }, [supabase]);
  return admin;
}

// The switch as the footer and the banner draw it: shown only to a platform admin on a
// page that registered a VicData dashboard.
export function useEditSwitch(supabase: SupabaseClient): { shown: boolean; on: boolean; previewDraft: boolean } {
  const admin = usePlatformAdminCached(supabase);
  const slug = useRegisteredDashboard();
  const on = useEditOn();
  const previewDraft = usePreviewDraft();
  const shown = admin && !!slug;
  return { shown, on: shown && on, previewDraft: shown && previewDraft };
}

// ------------------------------------------------------------------ editor writes

// The editor's last autosave, flushed when it closes; a reload after Edit goes off waits
// for it, so "Preview draft" never draws the draft from before the last edit.
let pendingWrites: Promise<unknown> = Promise.resolve();
export function trackEditorWrite(p: Promise<unknown>) {
  pendingWrites = Promise.allSettled([pendingWrites, p]);
}
export function editorWritesSettled(): Promise<unknown> {
  return pendingWrites;
}

// ------------------------------------------------------------------ the page side

// For a page showing VicData dashboard `slug` (null = none, or not ready): registers it,
// and says whether the editor is showing in place now (`editing`), whether this tab
// previews the draft, and `reloadTick`, which goes up each time editing ends so the page
// re-reads what it draws (a Publish shows straight away). Scroll: the page's position is
// remembered when editing starts and put back when it ends.
export function useInPlaceEdit(supabase: SupabaseClient, slug: string | null): { editing: boolean; previewDraft: boolean; reloadTick: number } {
  useRegisterVicDataDashboard(slug);
  const { shown, on, previewDraft } = useEditSwitch(supabase);
  const editing = !!slug && shown && on;
  const [reloadTick, setReloadTick] = useState(0);
  const was = useRef(false);
  useEffect(() => {
    if (editing === was.current) return;
    const ending = was.current;
    was.current = editing;
    if (!ending) {
      window.scrollTo(0, 0);
      return;
    }
    const y = takeScroll();
    let raf = 0;
    (async () => {
      setReloadTick((n) => n + 1);
      // Two frames: the page is shown again, then laid out, before the scroll goes back.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => window.scrollTo(0, y ?? 0));
      });
    })();
    return () => cancelAnimationFrame(raf);
  }, [editing]);
  return { editing, previewDraft, reloadTick };
}
