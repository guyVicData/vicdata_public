"use client";

// Teacher view, round 6: Context's combined "Compare against + Measure" picker
// (Context.dc.html; brief §4.2).
//
// ONE dropdown covering both dimensions, not two pills -- Guy's explicit choice, and a
// deliberate difference from Comparisons, which keeps two. Worth saying plainly because
// it looks like an inconsistency and is not: Context's two dimensions are read together
// ("Geography against Humanities, on candidates"), so they are chosen together;
// Comparisons' are independent.
//
// §6.1 settled the compare-against list at three options. `category_vs_categories` stays
// deferred -- it compares subject GROUPS to each other rather than a subject to a group,
// which is a different unit of comparison from the one the chip row, the bar-with-marker
// and the 3-column table are all drawn for.
import { useState } from "react";
import { COMING_SOON_MEASURES, type Measure } from "@/lib/teacher-view-panels";
import { ChevronDown } from "./PanelIcons";
import { MenuDivider, MenuHeading, MenuRow, PanelMenu, useDismiss } from "./PanelMenu";

export type CompareAgainstId = "whole" | "area" | "selected";

export function ContextPicker({
  against,
  onAgainst,
  areaLabel,
  candidatesMeasure,
  resultMeasures,
  active,
  // "Selected subjects" needs a set to be selected; the checklist appears under that row
  // only while it is the chosen option, as the wireframe draws it.
  allSubjects,
  selected,
  onToggleSelected,
  onMeasure,
}: {
  against: CompareAgainstId;
  onAgainst: (id: CompareAgainstId) => void;
  // The real subject family of the subject currently in focus, so the row reads
  // "Other subjects in Humanities & Social Sciences" rather than a placeholder.
  areaLabel: string | null;
  candidatesMeasure: Measure;
  resultMeasures: Measure[];
  active: Measure;
  allSubjects: { key: string; label: string; colour: string }[];
  selected: string[];
  onToggleSelected: (key: string) => void;
  onMeasure: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const againstLabel =
    against === "area" ? areaLabel ?? "Its category" : against === "selected" ? "Selected" : "Whole school";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 text-left text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
      >
        {againstLabel} &middot; {active.label}
        {ChevronDown}
      </button>
      {open && (
        <PanelMenu label="Compare against, and measure" width={264}>
          <MenuHeading>Compare against</MenuHeading>
          <MenuRow label="Whole school" selected={against === "whole"} onClick={() => onAgainst("whole")} />
          <MenuRow
            label={areaLabel ? `Other subjects in ${areaLabel}` : "Other subjects in its category"}
            selected={against === "area"}
            disabled={!areaLabel}
            onClick={() => onAgainst("area")}
          />
          <MenuRow label="Selected subjects" selected={against === "selected"} onClick={() => onAgainst("selected")} />
          {against === "selected" && (
            <div className="flex flex-col gap-px py-1 pl-1">
              {allSubjects.map((s) => (
                <MenuRow
                  key={s.key}
                  label={s.label}
                  swatch={s.colour}
                  checkbox
                  selected={selected.includes(s.key)}
                  indented
                  onClick={() => onToggleSelected(s.key)}
                />
              ))}
            </div>
          )}

          <MenuDivider />
          <MenuHeading>Measure</MenuHeading>
          <MenuRow
            label={candidatesMeasure.label}
            selected={active.id === candidatesMeasure.id}
            onClick={() => { onMeasure(candidatesMeasure.id); setOpen(false); }}
          />
          <MenuHeading indented>Results</MenuHeading>
          {resultMeasures.map((m) => (
            <MenuRow
              key={m.id}
              label={m.label}
              indented
              selected={active.id === m.id}
              onClick={() => { onMeasure(m.id); setOpen(false); }}
            />
          ))}
          {COMING_SOON_MEASURES.map((m) => (
            <MenuRow key={m.id} label={m.label} tag="Coming soon" indented disabled onClick={() => {}} />
          ))}
        </PanelMenu>
      )}
    </div>
  );
}
