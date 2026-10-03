"use client";

// /dashboards/[id]/edit (0.6 S5): super-admin only (rpc is_platform_admin); everyone else
// gets the plain 404, as on /platform. Loads the dashboard with its draft through
// dashboards-store; while the S2 tables aren't there it opens the seeded config in memory.
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loadDashboard, type Loaded } from "@/lib/dashboards-store";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { DashboardEditor, type CopyViewHandler } from "./DashboardEditor";
import type { PanelPreviewComponent } from "./PanelPreview";

export function NotFound() {
  return (
    <main className="flex flex-grow items-center justify-center py-32">
      <p className="text-[14px]">
        <span className="mr-4 border-r border-current pr-4 text-[24px] font-medium">404</span>
        This page could not be found.
      </p>
    </main>
  );
}

// Platform admins only: null while asking, then true / false.
export function usePlatformAdmin(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await createBrowserSupabaseClient().rpc("is_platform_admin");
        setAllowed(!error && data === true);
      } catch {
        setAllowed(false);
      }
    })();
  }, []);
  return allowed;
}

export function EditorScreen({ id, Preview, onCopyView }: { id: string; Preview?: PanelPreviewComponent; onCopyView?: CopyViewHandler }) {
  const allowed = usePlatformAdmin();
  const [theme] = useTeacherTheme();
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ready"; loaded: Loaded & { available: boolean } }>({ status: "loading" });

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      try {
        const loaded = await loadDashboard(createBrowserSupabaseClient(), decodeURIComponent(id), true);
        setState(loaded ? { status: "ready", loaded } : { status: "missing" });
      } catch (e) {
        setState({ status: "error", message: (e as { message?: string })?.message ?? "Couldn't load this dashboard." });
      }
    })();
  }, [allowed, id]);

  if (allowed === null) return <main className="flex-grow" />;
  if (!allowed) return <NotFound />;
  if (state.status === "ready") return <DashboardEditor loaded={state.loaded} superAdmin Preview={Preview} onCopyView={onCopyView} />;
  return (
    <main id="teacher-root" data-theme={theme} className="flex min-h-dvh w-full flex-col bg-[var(--bg)] p-6 text-[var(--fg)]">
      <Link href="/dashboards/new" className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
        ← New dashboard
      </Link>
      <p className="mt-4 text-[14px] text-[var(--muted)]">
        {state.status === "loading" && "Loading…"}
        {state.status === "missing" && "This dashboard isn't there, or isn't yours to edit."}
        {state.status === "error" && state.message}
      </p>
    </main>
  );
}
