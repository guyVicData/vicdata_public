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
import { PanelMenu, MenuRow, useDismiss } from "@/components/teacher/PanelMenu";
import { GroupSwitcher } from "@/components/dashboard-config/ConfigDashboard";
import { ADMISSIONS_DASHBOARDS } from "@/catalogue/dashboards/admissions";
import type { DashboardConfig } from "@/catalogue/types";
import type { Filters } from "./api";
import { EntryChip, FChip } from "./ui";

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

function MenuChip<T extends string>({ value, options, onPick, label }: { value: T; options: { id: T; label: string; title?: string }[]; onPick: (v: T) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <span className="relative" ref={ref}>
      <FChip onClick={() => setOpen(!open)} title={label} active={value !== options[0].id}>
        {current.label}
      </FChip>
      {open && (
        <PanelMenu label={label} align="right" width={210}>
          {options.map((o) => (
            <MenuRow
              key={o.id}
              label={o.label}
              selected={o.id === value}
              title={o.title}
              onClick={() => {
                setOpen(false);
                onPick(o.id);
              }}
            />
          ))}
        </PanelMenu>
      )}
    </span>
  );
}

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

export function RowHead({ title, context, open, onToggle }: { title: string; context: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 px-[2px] py-1 text-left text-[12.5px] font-bold text-[var(--fg)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ transform: open ? undefined : "rotate(-90deg)" }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {title} <span className="text-[11px] font-medium text-[var(--muted2)]">&middot; {context}</span>
    </button>
  );
}

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
