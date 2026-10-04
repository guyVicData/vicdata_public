"use client";

// VicData 0.6 E: /dashboards/[id] -- a stored dashboard config, drawn live. The config
// comes from dashboards-store's loadDashboard (by uuid or slug; it falls back to the
// configs seeded in code while the S2 tables aren't applied), and is drawn through
// TeacherDashboard in mode "embed": the same column hosts as the Teacher page, under the
// config's own columns, rows and rails.
//
// Chrome: TeacherNav and a slim header naming the dashboard. No control bar and no
// onboarding. The focus subject and pills are read from the person's saved Teacher
// preferences for that phase (never written); open/close and pill changes here last for
// the visit.
//
// What 0.6 can't draw yet is said plainly where it would be (embed.ts): one phase per
// dashboard; each kind of column once; one of Candidates or Results; Rolls and Live
// births are placeholders only.
//
// 0.6 integration: the top bar carries the linked-dashboard switcher (GroupSwitcher) for
// grouped dashboards and, for super-admin, an Edit link to /dashboards/[id]/edit; a
// VicData dashboard shows "Updated — what's changed" and carries per-panel state across a
// new version (DashboardUpdates).
//
// 0.6 snag 2 (B): on a VicData-owned dashboard the super-admin Edit link gives way to the
// footer's (and the trial banner's) Edit switch: off, the page is exactly the member's
// (no Edit link, no placeholder panels); on, the editor is drawn in place on this
// dashboard with this school as its live preview, and the page comes back as it was when
// it goes off, re-read so a Publish shows straight away. Other dashboards keep the link.
import { TrialBanner } from "@/components/trial/TrialBanner";
import { getActiveTrial } from "@/lib/trial";
import { useEffect, useMemo, useState } from "react";
import { setEditOn, useInPlaceEdit } from "@/lib/edit-mode";
import { EditorScreen } from "@/components/editor/EditorScreen";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { groupOf } from "@/catalogue/dashboards";
import type { DashboardConfig } from "@/catalogue/types";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { listDashboards, loadDashboard, type DashboardRow, type VersionRow } from "@/lib/dashboards-store";
import { configsFor, dashboardHref } from "@/components/library/data";
import { DashboardUpdates } from "@/components/editor/DashboardUpdates";
import { mySchool } from "@/lib/meeting-store";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { PHASE_LABELS, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import { useTeacherTheme, type Theme } from "@/components/teacher/TeacherChrome";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboard } from "./TeacherDashboard";
import { GroupSwitcher } from "./ConfigDashboard";
import { dashboardPhase } from "./embed";

type School = { urn: string; name: string };

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "missing" }
  | { status: "no-school" }
  | { status: "error"; message: string }
  | { status: "ready"; config: DashboardConfig; school: School; saved: boolean; phases: TeacherPhase[]; extras: ScreenExtras };

// What the top bar adds around the drawn dashboard (all optional, so a harness can draw
// the view alone).
export type ScreenExtras = {
  // The dashboard's id or slug as routed (for the Edit link).
  routeId?: string;
  row?: DashboardRow | null;
  version?: VersionRow | null;
  superAdmin?: boolean;
  // The linked dashboards, in group order, with where each opens.
  group?: { config: DashboardConfig; href: string }[];
  // VicData owns it: the Edit switch's page (no Edit link; drawn as the member sees it).
  vicData?: boolean;
};

// The group's dashboards: the seeded VicData groups from the catalogue; a stored group
// from the person's own listing (published or draft configs carrying the same group id).
async function linkedDashboards(supabase: ReturnType<typeof createBrowserSupabaseClient>, config: DashboardConfig, saved: boolean): Promise<{ config: DashboardConfig; href: string }[]> {
  if (!config.group) return [];
  const seeded = groupOf(config);
  if (seeded.length > 1) return seeded.map((d) => ({ config: d, href: `/dashboards/${encodeURIComponent(d.id)}` }));
  if (!saved) return [];
  const { rows } = await listDashboards(supabase, { kind: "dashboard" });
  const configs = await configsFor(supabase, rows);
  const out: { config: DashboardConfig; href: string; order: number }[] = [];
  for (const row of rows) {
    const c = configs.get(row.id);
    if (c?.group?.id === config.group.id) out.push({ config: { ...c, id: row.slug ?? row.id }, href: dashboardHref(row), order: c.group.order });
  }
  return out.sort((a, b) => a.order - b.order).map(({ config: c, href }) => ({ config: c, href }));
}

export function CustomDashboardScreen({ id }: { id: string }) {
  const [theme, setTheme] = useTeacherTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const supabaseClient = useMemo(() => createBrowserSupabaseClient(), []);
  const vicDataSlug = state.status === "ready" && state.extras.vicData ? id : null;
  const inPlace = useInPlaceEdit(supabaseClient, vicDataSlug);
  const previewDraft = inPlace.previewDraft;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return setState({ status: "signed-out" });
        // Preview draft (Guy, in a trial): a VicData dashboard's draft, this tab only.
        const [loaded, school] = await Promise.all([loadDashboard(supabase, id, previewDraft), mySchool(supabase)]);
        if (!loaded) return setState({ status: "missing" });
        const vicData = (loaded.available ? loaded.row.owner_scope : loaded.config.owner) === "vicdata";
        const config = previewDraft && vicData && loaded.draft ? loaded.draft : loaded.config;
        if (!school) return setState({ status: "no-school" });
        const [phases, admin, group] = await Promise.all([
          fetchOnboardedPhases(supabase, school.urn),
          // In a "Try VicData as…" trial the page is the member's: no super-admin chrome.
          supabase.rpc("is_platform_admin").then(({ data: a }) => a === true && !getActiveTrial(), () => false),
          linkedDashboards(supabase, config, loaded.available).catch(() => []),
        ]);
        setState({
          status: "ready",
          config,
          school,
          saved: loaded.available,
          phases,
          extras: { routeId: id, row: loaded.available ? loaded.row : null, version: loaded.version, superAdmin: admin, group, vicData },
        });
      } catch (e) {
        setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't load this dashboard." });
      }
    })();
    // Re-read after editing (reloadTick) and when Preview draft flips.
  }, [id, inPlace.reloadTick, previewDraft]);

  const school = state.status === "ready" ? state.school : null;
  const editorSchool = useMemo(() => (school ? { urn: school.urn, name: school.name } : null), [school]);

  if (state.status !== "ready") {
    return (
      <main id="teacher-root" data-theme={theme} className="mx-auto w-full max-w-3xl bg-[var(--bg)] p-6 text-[var(--fg)]">
        <TrialBanner />
        <p className="text-sm text-[var(--muted)]">
          {state.status === "loading" && "Loading…"}
          {state.status === "signed-out" && "Sign in to see this dashboard."}
          {state.status === "missing" && "This dashboard isn't there, or isn't yours to open."}
          {state.status === "no-school" && "Dashboards are available to verified school staff."}
          {state.status === "error" && state.message}
        </p>
        {state.status === "signed-out" && (
          <Link href="/login" className="mr-4 mt-3 inline-block text-sm text-[var(--muted)] underline">
            Log in
          </Link>
        )}
        <Link href="/teacher" className="mt-3 inline-block text-sm text-[var(--muted)] underline">
          Back
        </Link>
      </main>
    );
  }
  return (
    <>
      {inPlace.editing && <EditorScreen id={id} host={{ school: editorSchool, top: <TrialBanner className="" />, onExit: () => setEditOn(false) }} />}
      <CustomDashboardView config={state.config} school={state.school} saved={state.saved} phases={state.phases} theme={theme} onTheme={setTheme} extras={state.extras} hidden={inPlace.editing} reloadKey={inPlace.reloadTick} />
    </>
  );
}

// The drawn dashboard, given its config and school (also what a harness renders).
export function CustomDashboardView({
  config,
  school,
  saved,
  phases,
  theme,
  onTheme,
  extras = {},
  hidden = false,
  reloadKey = 0,
}: {
  config: DashboardConfig;
  school: School;
  // false = the S2 tables aren't applied, and this is the config seeded in code.
  saved: boolean;
  phases: TeacherPhase[];
  theme: Theme;
  onTheme: (t: Theme) => void;
  extras?: ScreenExtras;
  // The Edit switch's editor is drawn in its place: stay mounted, hidden, without the id.
  hidden?: boolean;
  // Bumped after editing, so "Updated — what's changed" re-reads.
  reloadKey?: number;
}) {
  const router = useRouter();
  const phase = dashboardPhase(config);
  const accent = PHASE_ACCENT[phase];
  const [labelsOn, setLabelsOn] = useState(true);
  const navPhases = useMemo(() => (["ks4", "ks5"] as TeacherPhase[]).filter((p) => p === phase || phases.includes(p)), [phase, phases]);
  return (
    <main
      id={hidden ? undefined : "teacher-root"}
      hidden={hidden}
      data-theme={theme}
      style={(accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) as React.CSSProperties}
      className="mx-auto max-w-7xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6"
    >
      <TrialBanner />
      <TeacherNav phase={phase} phases={navPhases} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={onTheme} />
      <header data-dashboard-header="" className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--panel-border)] pb-3">
        <h1 className="text-[17px] font-bold leading-tight">{config.name}</h1>
        <p className="text-[12.5px] text-[var(--muted2)]">
          {PHASE_LABELS[phase]} &middot; {school.name}
          {!saved && " · seeded in code (dashboards not saved yet)"}
        </p>
        {(extras.group?.length ?? 0) > 1 || (extras.superAdmin && !extras.vicData) ? (
          <div className="ml-auto flex items-center gap-2 self-center">
            {extras.group && extras.group.length > 1 && (
              <GroupSwitcher
                dashboards={extras.group.map((g) => g.config)}
                activeId={extras.group.find((g) => g.config.id === config.id || g.config.id === extras.row?.slug || g.config.id === extras.routeId)?.config.id ?? config.id}
                onSwitch={(d) => {
                  const hit = extras.group?.find((g) => g.config.id === d.id);
                  if (hit) router.push(hit.href);
                }}
              />
            )}
            {extras.superAdmin && !extras.vicData && (
              <Link
                href={`/dashboards/${encodeURIComponent(extras.routeId ?? config.id)}/edit`}
                className="rounded-full border border-[var(--panel-border2)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--muted)] hover:text-[var(--fg)] print:hidden"
              >
                Edit
              </Link>
            )}
          </div>
        ) : null}
      </header>
      {extras.row?.owner_scope === "vicdata" && extras.version && (
        <div className="print:hidden [&:not(:empty)]:mt-3">
          <DashboardUpdates key={reloadKey} dashboardId={extras.row.id} version={extras.version} schoolUrn={school.urn} />
        </div>
      )}
      <TeacherDashboard mode="embed" phase={phase} school={school.urn} config={config} settingsFrom="saved" memberView={!!extras.vicData} />
    </main>
  );
}
