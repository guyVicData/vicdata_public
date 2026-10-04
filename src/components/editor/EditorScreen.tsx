"use client";

// /dashboards/[id]/edit (0.6 S5): super-admin only (rpc is_platform_admin); everyone else
// gets the plain 404, as on /platform. Loads the dashboard with its draft through
// dashboards-store; while the S2 tables aren't there it opens the seeded config in memory.
//
// 0.6 integration: with a school context (super-admin's look-as school from ?lookAs=, else
// their own membership school) panels preview live (LivePanelPreview), titles resolve with
// the school's name, Add a view draws Pick's previews live with the school's subjects, and
// the panel menu's "Copy view…" opens S6's Copy this view dialog. With no school: the
// data-free previews, and the editor's own copy-within stub.
//
// 0.6 snag 2 (B): `host` opens the same editor IN PLACE on a page showing a VicData
// dashboard (the footer's / trial banner's Edit switch): the page gives the school and the
// subject in focus for the live preview (a trial's school when trying VicData as a member),
// the banner to show on top, and what Exit and the linked-dashboard switcher do.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PanelLabels } from "@/catalogue/pick";
import { dataviewById } from "@/catalogue";
import { contextFromPanel, viewTitle } from "@/catalogue/pick";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loadDashboard, type Loaded } from "@/lib/dashboards-store";
import { confirmLookAs, readLookAs } from "@/lib/look-as";
import { mySchool } from "@/lib/meeting-store";
import { pinFromContext, type PinSchool } from "@/lib/pin-context";
import type { CopyViewSource } from "@/lib/copy-view";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { CopyViewDialog } from "@/components/copy-view/CopyViewDialog";
import { loadSubjectSources } from "@/components/chooser-v06/schoolSubjects";
import type { SubjectSource } from "@/components/chooser-v06/StepScreens";
import { DashboardEditor, type CopyViewHandler } from "./DashboardEditor";
import { EditorSchoolContext, LivePanelPreview } from "./LivePanelPreview";
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

// The school the editor previews for: look-as (confirmed platform admin), else the
// person's own membership school; null = none (data-free).
export function useEditorSchool(enabled: boolean): PinSchool {
  const [school, setSchool] = useState<PinSchool>(null);
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const lookAs = readLookAs(new URLSearchParams(window.location.search));
        if (lookAs && (await confirmLookAs(supabase, lookAs))) {
          const { data } = await supabase.from("schools").select("current_name").eq("urn", lookAs.urn).maybeSingle<{ current_name: string }>();
          setSchool({ urn: lookAs.urn, name: data?.current_name ?? lookAs.urn });
          return;
        }
        const mine = await mySchool(supabase);
        if (mine) setSchool({ urn: mine.urn, name: mine.name });
      } catch {
        /* no school: the data-free previews */
      }
    })();
  }, [enabled]);
  return school;
}

export type InPlaceHost = {
  school: PinSchool;
  // The page's live labels: the subject in focus, the Results pill, its category.
  labels?: Omit<PanelLabels, "school">;
  top?: ReactNode;
  onExit: () => void;
  onSwitch?: (id: string) => void;
};

export function EditorScreen({ id, Preview, onCopyView, host }: { id: string; Preview?: PanelPreviewComponent; onCopyView?: CopyViewHandler; host?: InPlaceHost }) {
  const allowed = usePlatformAdmin();
  const [theme] = useTeacherTheme();
  const ownSchool = useEditorSchool(allowed === true && !host);
  const school = host ? host.school : ownSchool;
  const [subjects, setSubjects] = useState<Partial<Record<"ks4" | "ks5", SubjectSource>> | undefined>(undefined);
  const [copying, setCopying] = useState<CopyViewSource | null>(null);
  const hostLabels = host?.labels;
  const labels = useMemo<PanelLabels | undefined>(() => (school ? { ...hostLabels, school: school.name } : hostLabels), [school, hostLabels]);

  useEffect(() => {
    if (!school) return;
    (async () => setSubjects(await loadSubjectSources(createBrowserSupabaseClient(), school.urn)))();
  }, [school]);

  // Copy view… from the panel menu: S6's dialog, with the view pinned for the school.
  const copyView = useCallback<CopyViewHandler>(
    ({ config, panelId, instance }) => {
      if (instance.kind !== "view") return;
      const dv = dataviewById(instance.dataview);
      const context = contextFromPanel(config, panelId, labels);
      setCopying({ instance, context, pinned: pinFromContext(context, dv, school), title: instance.title ?? (dv ? viewTitle(dv, context) : instance.dataview) });
    },
    [labels, school],
  );
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
  if (!allowed) return host ? null : <NotFound />;
  if (state.status === "ready")
    return (
      <EditorSchoolContext.Provider value={school}>
        <DashboardEditor
          key={state.loaded.row.id}
          top={host?.top}
          onExit={host?.onExit}
          onSwitch={host?.onSwitch}
          writeAsSelf={!!host}
          loaded={state.loaded}
          superAdmin
          Preview={Preview ?? (school ? LivePanelPreview : undefined)}
          onCopyView={onCopyView ?? copyView}
          labels={labels}
          school={school}
          subjects={subjects}
        />
        {copying && <CopyViewDialog open source={copying} superAdmin onClose={() => setCopying(null)} />}
      </EditorSchoolContext.Provider>
    );
  return (
    <main id="teacher-root" data-theme={theme} className="flex min-h-dvh w-full flex-col bg-[var(--bg)] p-6 text-[var(--fg)]">
      {host ? (
        host.top
      ) : (
        <Link href="/dashboards/new" className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
          ← New dashboard
        </Link>
      )}
      <p className="mt-4 text-[14px] text-[var(--muted)]">
        {state.status === "loading" && "Loading…"}
        {state.status === "missing" && "This dashboard isn't there, or isn't yours to edit."}
        {state.status === "error" && state.message}
      </p>
    </main>
  );
}
