"use client";

// VicData 0.8 notes and feedback: what every panel on a page needs to put a private note and a
// feedback icon on each view in its rail -- the page's ViewSurface (dashboard, school or group, role,
// state), the person's notes at this school (one read per page), and the feedback store. A dashboard
// wraps its panels in ViewSurfaceProvider; CardBox reads it through useViewMarks. Outside a provider
// (the editor's preview, the chooser's frames, a print-only copy) a panel simply has no note or
// feedback icon, as before.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchNotes, saveNote } from "@/lib/teacher-view-data";
import { viewKey, viewNoteKey, type ViewRef, type ViewSurface } from "@/lib/view-ref";
import type { DashboardConfig } from "@/catalogue/types";
import { loadFeedback } from "./store";
import { FeedbackWindow } from "./FeedbackWindow";
import { FeedbackOpenBanner } from "./FeedbackOpenBanner";
import { useRegisterPage } from "./PageFeedback";

type NotesApi = { enabled: boolean; get: (key: string) => string | null; save: (key: string, body: string) => Promise<void> };
type SurfaceValue = { surface: ViewSurface; config: DashboardConfig | null; notes: NotesApi };

export const ViewSurfaceContext = createContext<SurfaceValue | null>(null);

export function useViewSurface(): SurfaceValue | null {
  return useContext(ViewSurfaceContext);
}

// One feedback window per page, however many surfaces it has (a page with two dashboards' panels):
// the first provider mounted draws it.
let hosts: number[] = [];
let nextHost = 1;
const hostListeners = new Set<() => void>();
const subscribeHosts = (l: () => void) => {
  hostListeners.add(l);
  return () => hostListeners.delete(l);
};
const firstHost = () => hosts[0] ?? 0;
export function useFirstHost(): boolean {
  const [id] = useState(() => nextHost++);
  useEffect(() => {
    hosts = [...hosts, id];
    hostListeners.forEach((l) => l());
    return () => {
      hosts = hosts.filter((h) => h !== id);
      hostListeners.forEach((l) => l());
    };
  }, [id]);
  return useSyncExternalStore(subscribeHosts, firstHost, () => 0) === id;
}

export function ViewSurfaceProvider({ surface, config = null, children }: { surface: ViewSurface; config?: DashboardConfig | null; children: ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const scope = surface.noteScope;
  const [notes, setNotes] = useState<{ scope: string; map: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!scope) return;
    let live = true;
    fetchNotes(supabase, scope).then((map) => live && setNotes({ scope, map }));
    return () => {
      live = false;
    };
  }, [supabase, scope]);
  useEffect(() => {
    void loadFeedback();
  }, []);
  const host = useFirstHost();
  // Section 6: the page's "Feedback on this page" is about the page the first surface is on.
  useRegisterPage(surface, host);

  const map = notes && notes.scope === scope ? notes.map : null;
  const save = useCallback(
    async (key: string, body: string) => {
      if (!scope) return;
      if (await saveNote(supabase, scope, key, body)) {
        setNotes((prev) => {
          const next = { ...(prev && prev.scope === scope ? prev.map : {}) };
          if (body.trim()) next[key] = body;
          else delete next[key];
          return { scope, map: next };
        });
      }
    },
    [supabase, scope],
  );
  const value = useMemo<SurfaceValue>(
    () => ({ surface, config, notes: { enabled: !!scope && !surface.peek, get: (key) => map?.[key] ?? null, save } }),
    [surface, config, scope, map, save],
  );
  return (
    <ViewSurfaceContext.Provider value={value}>
      {children}
      {host && <FeedbackWindow />}
      {host && <FeedbackOpenBanner surface={surface} />}
    </ViewSurfaceContext.Provider>
  );
}

/** One view's note and feedback key, on this page. null outside a provider or without a view. */
export function useViewMarks(view: ViewRef | null | undefined) {
  const s = useViewSurface();
  if (!s || !view || !view.instanceId) return null;
  const noteKey = viewNoteKey(s.surface.dashboard.id, view.panelId, view.instanceId);
  return {
    surface: s.surface,
    view,
    viewKey: viewKey(s.surface.dashboard.id, view.panelId, view.instanceId),
    note: { body: s.notes.get(noteKey), onSave: (body: string) => s.notes.save(noteKey, body), disabled: !s.notes.enabled },
  };
}
