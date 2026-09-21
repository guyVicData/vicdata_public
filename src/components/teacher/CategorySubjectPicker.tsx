"use client";

// Teacher view onboarding, step 2 (GCSE/Post16-Step2.dc.html): "Which subjects do you
// teach?", as the mockup builds it --
//   - a tab per qualification family ticked in step 1 (only families with real subjects
//     here), each with its ticked count; the active tab filled in the family colour;
//   - a "Selected so far" panel that always lists every ticked subject, grouped by
//     family, as removable chips, so a gap in another tab is visible without switching;
//   - collapsible category sections for the active family, each with a coloured dot,
//     "N of M ticked" and a chevron, opening to one checkbox row per subject; a checked
//     row takes its category's colour as border and faint tint.
//
// The categories are the platform's real subject-family taxonomy (the headline rows'
// familyId/familyLabel, the same thing familyLabelFor reads and CategoryFilter and
// SubjectAreaSection use), coloured with SUBJECT_FAMILY_COLOURS -- the site-wide
// identity for those eight families -- not the mockup's demo arrays.
//
// Its own component rather than a TickList mode: tabs, grouping and per-row colour are a
// different shape of list, and bending TickList to them would complicate the three
// simpler pickers that share it.
import { useState } from "react";
import { subjectFamilyColour } from "@/lib/subject-family-colours";
import type { QualificationFamily } from "@/lib/teacher-view-theme";

export type PickerItem = {
  key: string;
  label: string;
  entries: number;
  familyId: string; // qualification family (tab)
  category: { id: string; label: string } | null; // subject family (section)
};

const UNCATEGORISED = { id: "_other", label: "Other subjects" };

export function CategorySubjectPicker({
  families,
  items,
  ticked,
  onToggle,
  theme,
}: {
  families: QualificationFamily[]; // already filtered to the step-1 selection, in order
  items: PickerItem[];
  ticked: string[];
  onToggle: (key: string) => void;
  theme: "dark" | "light";
}) {
  const tabs = families.filter((f) => items.some((i) => i.familyId === f.id));
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  // The category's own colour in the current theme: the saturated half of the pair.
  const catColour = (id: string) => {
    const pair = subjectFamilyColour(id === UNCATEGORISED.id ? null : id);
    return theme === "light" ? pair.light[1] : pair.dark[1];
  };
  const catOf = (i: PickerItem) => i.category ?? UNCATEGORISED;

  if (!active) return <p className="text-sm text-[var(--muted)]">No subject entries under the qualifications you ticked.</p>;

  const inTab = items.filter((i) => i.familyId === active.id);
  const categories = Array.from(new Map(inTab.map((i) => [catOf(i).id, catOf(i)])).values()).sort((a, b) =>
    a.id === UNCATEGORISED.id ? 1 : b.id === UNCATEGORISED.id ? -1 : a.label.localeCompare(b.label),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => {
          const on = t.id === active.id;
          const n = items.filter((i) => i.familyId === t.id && ticked.includes(i.key)).length;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiveTab(t.id)}
              className="rounded-full px-3.5 py-2 text-[13px] font-bold"
              style={
                on
                  ? { background: t.hex, color: "#0a0a0b", border: `1.5px solid ${t.hex}` }
                  : { background: "transparent", color: t.hex, border: `1.5px solid ${t.hex}80` }
              }
            >
              {t.label} &middot; {n}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3.5">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">Selected so far</p>
        {tabs.map((t) => {
          const chosen = items.filter((i) => i.familyId === t.id && ticked.includes(i.key));
          return (
            <div key={t.id} className="flex flex-col gap-1.5">
              <p className="text-xs font-bold text-[var(--muted2)]">{t.label}</p>
              {chosen.length === 0 ? (
                <p className="text-[12.5px] italic text-[var(--muted3)]">Nothing ticked yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chosen.map((i) => {
                    const c = catColour(catOf(i).id);
                    return (
                      <button
                        key={i.key}
                        type="button"
                        onClick={() => onToggle(i.key)}
                        aria-label={`Remove ${i.label} (${t.label})`}
                        className="rounded-full border px-2.5 py-[5px] text-[12.5px] font-semibold"
                        style={{ background: `${c}1F`, color: c, borderColor: `${c}59` }}
                      >
                        {i.label} &times;
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5">
        {categories.map((cat) => {
          const key = `${active.id}:${cat.id}`;
          const open = !!expanded[key];
          const subjects = inTab.filter((i) => catOf(i).id === cat.id).sort((a, b) => a.label.localeCompare(b.label));
          const n = subjects.filter((i) => ticked.includes(i.key)).length;
          const c = catColour(cat.id);
          return (
            <div key={key} className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded({ ...expanded, [key]: !open })}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                <span className="flex-grow text-[14.5px] font-bold">{cat.label}</span>
                <span className="text-[12.5px] text-[var(--muted2)]">{n} of {subjects.length} ticked</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 text-[var(--muted3)] transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open && (
                <div className="flex flex-col gap-2 px-4 pb-3.5 pt-0.5">
                  {subjects.map((i) => {
                    const on = ticked.includes(i.key);
                    return (
                      <label
                        key={i.key}
                        className="flex cursor-pointer items-center gap-3 rounded-[9px] border px-3 py-[11px]"
                        style={{ borderColor: on ? c : "var(--panel-border)", background: on ? `${c}14` : "var(--box-bg)" }}
                      >
                        <input type="checkbox" checked={on} onChange={() => onToggle(i.key)} className="h-[18px] w-[18px] shrink-0" style={{ accentColor: c }} />
                        <span className="flex-grow text-sm font-semibold">{i.label}</span>
                        {/* §14: say how big a thing is while you pick it. */}
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted2)]">{i.entries.toLocaleString()}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
