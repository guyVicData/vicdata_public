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
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardConfig } from "@/catalogue/types";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { loadDashboard } from "@/lib/dashboards-store";
import { mySchool } from "@/lib/meeting-store";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import { PHASE_LABELS, type TeacherPhase } from "@/lib/teacher-view-phases";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import { useTeacherTheme, type Theme } from "@/components/teacher/TeacherChrome";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboard } from "./TeacherDashboard";
import { dashboardPhase } from "./embed";

type School = { urn: string; name: string };

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "missing" }
  | { status: "no-school" }
  | { status: "error"; message: string }
  | { status: "ready"; config: DashboardConfig; school: School; saved: boolean; phases: TeacherPhase[] };

export function CustomDashboardScreen({ id }: { id: string }) {
  const [theme, setTheme] = useTeacherTheme();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return setState({ status: "signed-out" });
        const [loaded, school] = await Promise.all([loadDashboard(supabase, id), mySchool(supabase)]);
        if (!loaded) return setState({ status: "missing" });
        if (!school) return setState({ status: "no-school" });
        const phases = await fetchOnboardedPhases(supabase, school.urn);
        setState({ status: "ready", config: loaded.config, school, saved: loaded.available, phases });
      } catch (e) {
        setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't load this dashboard." });
      }
    })();
  }, [id]);

  if (state.status !== "ready") {
    return (
      <main id="teacher-root" data-theme={theme} className="mx-auto w-full max-w-3xl bg-[var(--bg)] p-6 text-[var(--fg)]">
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
  return <CustomDashboardView config={state.config} school={state.school} saved={state.saved} phases={state.phases} theme={theme} onTheme={setTheme} />;
}

// The drawn dashboard, given its config and school (also what a harness renders).
export function CustomDashboardView({
  config,
  school,
  saved,
  phases,
  theme,
  onTheme,
}: {
  config: DashboardConfig;
  school: School;
  // false = the S2 tables aren't applied, and this is the config seeded in code.
  saved: boolean;
  phases: TeacherPhase[];
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  const phase = dashboardPhase(config);
  const accent = PHASE_ACCENT[phase];
  const [labelsOn, setLabelsOn] = useState(true);
  const navPhases = useMemo(() => (["ks4", "ks5"] as TeacherPhase[]).filter((p) => p === phase || phases.includes(p)), [phase, phases]);
  return (
    <main
      id="teacher-root"
      data-theme={theme}
      style={(accent ? { "--accent": accent.hex, "--accent-rgb": accent.rgb } : {}) as React.CSSProperties}
      className="mx-auto max-w-7xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6"
    >
      <TeacherNav phase={phase} phases={navPhases} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={onTheme} />
      <header data-dashboard-header="" className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--panel-border)] pb-3">
        <h1 className="text-[17px] font-bold leading-tight">{config.name}</h1>
        <p className="text-[12.5px] text-[var(--muted2)]">
          {PHASE_LABELS[phase]} &middot; {school.name}
          {!saved && " · seeded in code (dashboards not saved yet)"}
        </p>
      </header>
      <TeacherDashboard mode="embed" phase={phase} school={school.urn} config={config} settingsFrom="saved" />
    </main>
  );
}
