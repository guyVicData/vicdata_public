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
//
// Combined round §4: one picker wherever the dashboard asks for subjects, with options
// rather than parallel copies --
//   - `tabs={false}`: one implicit qualification family, no tab row (Context's comparison
//     set, which is always within the focused subject's qualification);
//   - `onSetTicked`: whole-category tick/untick on each category's header row, next to its
//     "N of M ticked" (a bulk change is one write, not one per subject);
//   - `showAllToggle`: a global Select all / Deselect all over every subject offered;
//   - `defaultExpanded`: category ids open on first render.
//   - `single` (0.6 S4, Add a view's 2a "Choose a subject", Ch2Subject.dc.html): pick one --
//     radio rows, no "Selected so far" panel (the chooser's footer names the pick), and a
//     category says "1 picked" instead of "N of M ticked". `onToggle` receives the key.
//   - `search`: a "Search subjects" box between the tabs and the categories (Ch2Subject),
//     narrowing the categories and opening every one that still has a match.
// Changes still apply live: there is no Apply step, as before.
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
  onSetTicked,
  theme,
  tabs: showTabs = true,
  showAllToggle = false,
  defaultExpanded = [],
  single = false,
  search = false,
}: {
  families: QualificationFamily[]; // already filtered to the step-1 selection, in order
  items: PickerItem[];
  ticked: string[];
  onToggle: (key: string) => void;
  // The whole next selection, for bulk changes. Absent = no bulk controls.
  onSetTicked?: (next: string[]) => void;
  theme: "dark" | "light";
  tabs?: boolean;
  showAllToggle?: boolean;
  defaultExpanded?: string[];
  single?: boolean;
  search?: boolean;
}) {
  // Without tabs every item sits under one implicit family: the first given, or a
  // placeholder when the caller has already narrowed the items itself.
  const implicit: QualificationFamily = families[0] ?? { id: "_all", label: "Subjects", hex: "var(--muted)", rgb: "128,128,128", description: "" };
  const tabs = showTabs ? families.filter((f) => items.some((i) => i.familyId === f.id)) : items.length ? [implicit] : [];
  const familyOfItem = (i: PickerItem) => (showTabs ? i.familyId : implicit.id);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(defaultExpanded.map((id) => [`${showTabs ? families[0]?.id : implicit.id}:${id}`, true])),
  );
  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  // Tick or untick a whole set of subjects in one write.
  const setAll = (keys: string[], on: boolean) => {
    if (!onSetTicked) return;
    const set = new Set(ticked);
    for (const k of keys) {
      if (on) set.add(k);
      else set.delete(k);
    }
    onSetTicked(Array.from(set));
  };

  // The category's own colour in the current theme: the saturated half of the pair.
  const catColour = (id: string) => {
    const pair = subjectFamilyColour(id === UNCATEGORISED.id ? null : id);
    return theme === "light" ? pair.light[1] : pair.dark[1];
  };
  const catOf = (i: PickerItem) => i.category ?? UNCATEGORISED;

  if (!active) return <p className="text-sm text-[var(--muted)]">No subject entries under the qualifications you ticked.</p>;

  const q = query.trim().toLowerCase();
  const inTab = items.filter((i) => familyOfItem(i) === active.id && (!q || i.label.toLowerCase().includes(q)));
  const allKeys = items.map((i) => i.key);
  const nAll = allKeys.filter((k) => ticked.includes(k)).length;
  const linkClass = "text-[12.5px] font-semibold text-[var(--accent,var(--fg))] disabled:text-[var(--muted3)]";
  const categories = Array.from(new Map(inTab.map((i) => [catOf(i).id, catOf(i)])).values()).sort((a, b) =>
    a.id === UNCATEGORISED.id ? 1 : b.id === UNCATEGORISED.id ? -1 : a.label.localeCompare(b.label),
  );

  return (
    <div className="flex flex-col gap-4">
      {showAllToggle && onSetTicked && (
        <div className="flex items-center gap-4">
          <button type="button" disabled={nAll === allKeys.length} onClick={() => setAll(allKeys, true)} className={linkClass}>
            Select all
          </button>
          <button type="button" disabled={nAll === 0} onClick={() => setAll(allKeys, false)} className={linkClass}>
            Deselect all
          </button>
          <span className="ml-auto text-[12.5px] text-[var(--muted2)]">{nAll} of {allKeys.length} ticked</span>
        </div>
      )}
      {showTabs && (
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => {
          const on = t.id === active.id;
          // Pick-one: the tab says how many subjects it holds (Ch2Subject's "GCSE · 21").
          const n = items.filter((i) => familyOfItem(i) === t.id && (single || ticked.includes(i.key))).length;
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
      )}

      {search && (
        <label className="flex items-center gap-2 rounded-lg border border-[var(--panel-border2)] px-2.5 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[var(--muted3)]" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects"
            aria-label="Search subjects"
            className="min-w-0 flex-grow bg-transparent text-[13px] outline-none placeholder:text-[var(--muted3)]"
          />
        </label>
      )}

      {!single && (
      <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3.5">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">Selected so far</p>
        {tabs.map((t) => {
          const chosen = items.filter((i) => familyOfItem(i) === t.id && ticked.includes(i.key));
          return (
            <div key={t.id} className="flex flex-col gap-1.5">
              {showTabs && <p className="text-xs font-bold text-[var(--muted2)]">{t.label}</p>}
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
                        aria-label={showTabs ? `Remove ${i.label} (${t.label})` : `Remove ${i.label}`}
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
      )}

      <div className="flex flex-col gap-2.5">
        {categories.map((cat) => {
          const key = `${active.id}:${cat.id}`;
          const open = !!expanded[key] || (!!q && !!search);
          const subjects = inTab.filter((i) => catOf(i).id === cat.id).sort((a, b) => a.label.localeCompare(b.label));
          const n = subjects.filter((i) => ticked.includes(i.key)).length;
          const c = catColour(cat.id);
          const allOn = n === subjects.length;
          return (
            <div key={key} className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
              {/* The header is a row of two controls rather than one button: expanding the
                  section and ticking all of it are different actions, and a button cannot
                  hold another. */}
              <div className="flex items-center gap-2 pr-4">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded({ ...expanded, [key]: !open })}
                  className="flex min-w-0 flex-grow items-center gap-3 py-3.5 pl-4 text-left"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                  <span className="min-w-0 flex-grow text-[14.5px] font-bold">{cat.label}</span>
                  {/* "ticked" drops on a phone, where it pushed the category name onto three lines. */}
                  {single ? (
                    <span className={`shrink-0 text-[12.5px] ${n ? "font-semibold text-[var(--accent,var(--fg))]" : "text-[var(--muted2)]"}`}>{n ? `${n} picked` : subjects.length}</span>
                  ) : (
                  <span className="shrink-0 text-[12.5px] text-[var(--muted2)]">
                    {n} of {subjects.length}<span className="hidden sm:inline"> ticked</span>
                  </span>
                  )}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="shrink-0 text-[var(--muted3)] transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {onSetTicked && !single && (
                  <button
                    type="button"
                    onClick={() => setAll(subjects.map((i) => i.key), !allOn)}
                    aria-label={`${allOn ? "Untick" : "Tick"} every subject in ${cat.label}`}
                    className="shrink-0 rounded-md border px-2 py-1 text-[11.5px] font-semibold"
                    style={{ borderColor: `${c}59`, color: c, background: allOn ? `${c}1F` : "transparent" }}
                  >
                    {allOn ? "Untick all" : "Tick all"}
                  </button>
                )}
              </div>
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
                        <input type={single ? "radio" : "checkbox"} name={single ? "category-subject-picker" : undefined} checked={on} onChange={() => onToggle(i.key)} className="h-[18px] w-[18px] shrink-0" style={{ accentColor: c }} />
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
