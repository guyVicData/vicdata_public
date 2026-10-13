"use client";

// VicData 0.7 admissions r3 (F4): what Admissions keeps of its own top bar, now that the page wears
// Teacher's chrome -- TeacherNav, and Teacher's ControlBar with the Pipelines | Market share switch
// (GroupSwitcher) and the entry-point chips in the slots where Teacher keeps the Candidates |
// Results switch and the subject chips. Round 2's own nav and header bar (Chrome.tsx) are gone.
// What stays here is Admissions' content, in the bar's chrome slot and the page: the filters (after
// the "±", as before), the row heads, and the phone's switch and chips.
import { useEffect, useState, type ReactNode } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { fetchOnboardedPhases } from "@/lib/teacher-view-data";
import type { TeacherPhase } from "@/lib/teacher-view-phases";
import { TeacherNav, useNavLabels } from "@/components/teacher/TeacherNav";
import type { Theme } from "@/components/teacher/TeacherChrome";
import { GroupSwitcher } from "@/components/dashboard-config/ConfigDashboard";
import { ADMISSIONS_DASHBOARDS } from "@/catalogue/dashboards/admissions";
import type { DashboardConfig } from "@/catalogue/types";
import type { Filters } from "./api";
import { EntryChip } from "./ui";
import { MenuChip } from "@/components/shell/FilterPills";

export type DashKey = "pipelines" | "market-share";
export const DASH_ID: Record<DashKey, string> = { pipelines: ADMISSIONS_DASHBOARDS[0].id, "market-share": ADMISSIONS_DASHBOARDS[1].id };

/** Teacher's nav, as the Recruitment and Meetings pages draw it: no phase of its own, the school's
 * onboarded phases in the switcher, the label setting shared with them. */
export function AdmissionsTeacherNav({ schoolUrn, theme, onTheme }: { schoolUrn: string | null; theme: Theme; onTheme: (t: Theme) => void }) {
  const [phases, setPhases] = useState<TeacherPhase[]>([]);
  useEffect(() => {
    if (!schoolUrn) return;
    let live = true;
    fetchOnboardedPhases(createBrowserSupabaseClient(), schoolUrn).then((p) => {
      if (live) setPhases(p);
    });
    return () => {
      live = false;
    };
  }, [schoolUrn]);
  const [labelsOn, setLabelsOn] = useNavLabels(schoolUrn, phases);
  return <TeacherNav phase={null} phases={phases} labelsOn={labelsOn} onLabelsOn={setLabelsOn} theme={theme} onTheme={onTheme} />;
}

/** Pipelines | Market share: Teacher's linked-dashboard switcher over the two configs. */
export function DashSwitch({ active, onSwitch, configs }: { active: DashKey; onSwitch: (d: DashKey) => void; configs?: Record<DashKey, DashboardConfig> }) {
  const list = configs ? [configs.pipelines, configs["market-share"]] : ADMISSIONS_DASHBOARDS;
  return <GroupSwitcher dashboards={list} activeId={(configs?.[active] ?? ADMISSIONS_DASHBOARDS[active === "pipelines" ? 0 : 1]).id} onSwitch={(d) => onSwitch(d.id === list[1].id ? "market-share" : "pipelines")} />;
}

/** The "A" in the bar's badge, where Teacher draws the phase glyph. */
export const ADMISSIONS_BADGE = <span className="text-[19px] font-extrabold leading-none">A</span>;

export const Divider = () => <span aria-hidden="true" className="mx-1 h-[18px] w-px bg-[var(--adm-rail-on)]" />;

// 0.7 r3 (F2): the filters stay where they are; Day + boarding (and Market share's rivals with
// boarders) only for a boarding school. For a day school it isn't drawn and the others close up.
export function FilterChips({ dash, filters, onFilters, rivalsChip, boardingSchool }: { dash: DashKey; filters: Filters; onFilters: (f: Filters) => void; rivalsChip?: ReactNode; boardingSchool: boolean }) {
  return (
    <>
      {rivalsChip}
      {!boardingSchool ? null : dash === "pipelines" ? (
        <MenuChip
          label="Which feeder lists make the pool"
          value={filters.lists}
          onPick={(lists) => onFilters({ ...filters, lists })}
          options={[
            { id: "both", label: "Day + boarding" },
            { id: "day", label: "Day only" },
            { id: "boarding", label: "Boarding only" },
          ]}
        />
      ) : (
        <MenuChip
          label="Which rivals"
          value={filters.boardingOnly ? "boarding" : "both"}
          onPick={(v) => onFilters({ ...filters, boardingOnly: v === "boarding" })}
          options={[
            { id: "both", label: "Day + boarding" },
            { id: "boarding", label: "Rivals with boarders" },
          ]}
        />
      )}
      <MenuChip
        label="Pupils"
        value={filters.sex}
        onPick={(sex) => onFilters({ ...filters, sex })}
        options={[
          { id: "all", label: "All pupils" },
          { id: "female", label: "Girls", title: "Births have no girl/boy split: a girls' pool from births is an estimate (49%)." },
          { id: "male", label: "Boys", title: "Births have no girl/boy split: a boys' pool from births is an estimate (51%)." },
        ]}
      />
      <MenuChip
        label="Sector"
        value={filters.sector}
        onPick={(sector) => onFilters({ ...filters, sector })}
        options={[
          { id: "all", label: "State + independent" },
          { id: "state", label: "State only" },
          { id: "independent", label: "Independent only" },
        ]}
      />
    </>
  );
}

// 0.8 shell (Part A): the row head moved to src/components/shell/Rows.tsx.
export { RowHead } from "@/components/shell/Rows";

export function PhoneHeader({ dash, onDash, entries, entry, onEntry, onEditEntries }: { dash: DashKey; onDash: (d: DashKey) => void; entries: { id: string; label: string }[]; entry: string; onEntry: (id: string) => void; onEditEntries: (() => void) | null }) {
  return (
    <>
      <div className="self-start">
        <DashSwitch active={dash} onSwitch={onDash} />
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {entries.map((e) => (
          <EntryChip key={e.id} label={e.label} active={e.id === entry} onClick={() => onEntry(e.id)} />
        ))}
        <button type="button" onClick={onEditEntries ?? undefined} disabled={!onEditEntries} aria-label="Choose entry points" className="rounded-full border border-[var(--panel-border2)] bg-[var(--panel-bg)] px-3 py-[6px] text-[12px] font-semibold text-[var(--chip-fg)] disabled:opacity-50">
          &plusmn;
        </button>
      </div>
    </>
  );
}
