"use client";

// Teacher view, accordion round Part 3 (first draft): the comparator-school chooser.
//
// Built to the conventions of the real "which subjects do you teach" picker
// (CategorySubjectPicker), as Guy asked, and to the wireframe that was rebuilt to match
// it (artifact 8SLvLpLqFUHeaDoiv5yR2v v2):
//   - a tab per SECTOR (state / independent) -- filled pill when active, outline when not,
//     each with its ticked count. Sector stands in for qualification family: it is the one
//     school grouping with a colour of its own;
//   - a "Selected so far" panel of removable coloured chips, grouped the same way;
//   - collapsible cards per LOCAL AUTHORITY (the category level): coloured dot, name,
//     "N of M ticked", chevron; a checked row takes the sector colour as border and tint.
// Candidates are the agreed scope, "ticked set plus nearby": the schools already in the
// set, the nearest schools of this phase, and any school added by search.
//
// Saves to the real saved_sets / saved_set_members rows (see teacher-view-saved-sets.ts).
// First draft, deliberately: no map pane and no "Add area" yet (see the build report).
import { useMemo, useRef, useState } from "react";
import SchoolSearch, { type SchoolSearchResult } from "@/components/SchoolSearch";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { isIndependent } from "@/lib/teacher-view-rankings";
import {
  deleteComparatorSet,
  saveComparatorSet,
  type SavedComparatorSet,
  type SavedSetsPayload,
  type SetMember,
} from "@/lib/teacher-view-saved-sets";
import { ExpandIcon, MODAL_CLOSE_BUTTON_CLASS, TeacherModal } from "./TeacherModal";

// The wireframe's sector colours. There is no shared sector palette in the app yet
// (checked: the Data View's sector filter is text-only), so they are named here.
const SECTOR = {
  state: { label: "State-funded", hex: "#4b7bd6" },
  independent: { label: "Independent", hex: "#c2478b" },
} as const;
type SectorId = keyof typeof SECTOR;
const sectorOf = (m: { independent: boolean }): SectorId => (m.independent ? "independent" : "state");

type Candidate = SetMember & { distanceKm: number | null };

export function ComparatorSetChooser({
  payload,
  editing,
  startingFrom,
  targetUrn,
  targetName,
  onClose,
  onSaved,
}: {
  payload: SavedSetsPayload;
  // An existing set to edit, or null to make a new one.
  editing: SavedComparatorSet | null;
  // What a NEW set starts from: the preset currently selected, so "Nearest 10, minus two,
  // plus one" is two clicks rather than ten. Recorded in the set's config as provenance.
  startingFrom: { label: string; urns: string[] } | null;
  targetUrn: string;
  targetName: string;
  onClose: () => void;
  onSaved: (id: string | null) => void;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [name, setName] = useState(editing?.name ?? (startingFrom ? `My ${startingFrom.label.toLowerCase()}` : "My comparison schools"));
  const [shared, setShared] = useState(editing?.shared ?? false);
  const [ticked, setTicked] = useState<string[]>(
    (editing ? editing.members.map((m) => m.urn) : startingFrom?.urns ?? []).filter((u) => u !== targetUrn),
  );
  const [added, setAdded] = useState<Candidate[]>([]);
  const [tab, setTab] = useState<SectorId>(payload.target.independent ? "independent" : "state");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every school the chooser knows about: the nearby candidates, the set's own members
  // (which may be further away than the candidate list reaches), and search additions.
  const known = useMemo(() => {
    const out = new Map<string, Candidate>();
    for (const c of payload.candidates) out.set(c.urn, { urn: c.urn, name: c.name, laName: c.laName ?? null, independent: c.independent, distanceKm: c.distanceKm });
    for (const s of payload.sets) for (const m of s.members) if (!out.has(m.urn)) out.set(m.urn, { ...m, distanceKm: null });
    for (const a of added) if (!out.has(a.urn)) out.set(a.urn, a);
    out.delete(targetUrn);
    return out;
  }, [payload, added, targetUrn]);

  const toggle = (urn: string) => setTicked((t) => (t.includes(urn) ? t.filter((u) => u !== urn) : [...t, urn]));
  const tickedSchools = ticked.map((u) => known.get(u)).filter((c): c is Candidate => !!c);

  const addNearest = (n: number) => {
    const next = payload.candidates.filter((c) => c.urn !== targetUrn && !ticked.includes(c.urn)).slice(0, n).map((c) => c.urn);
    setTicked((t) => [...t, ...next]);
  };

  // A school found by search is looked up for its LA and sector (schools is public-read),
  // then ticked -- the reason it was searched for.
  const addBySearch = async (school: SchoolSearchResult) => {
    if (school.urn === targetUrn) return;
    const { data } = await supabase.from("schools").select("la_name").eq("urn", school.urn).maybeSingle<{ la_name: string | null }>();
    setAdded((a) => [
      ...a,
      { urn: school.urn, name: school.current_name, laName: data?.la_name ?? null, independent: isIndependent(school.establishment_type_group), distanceKm: null },
    ]);
    setTicked((t) => (t.includes(school.urn) ? t : [...t, school.urn]));
  };

  const inTab = Array.from(known.values()).filter(
    (c) => sectorOf(c) === tab && (!filter.trim() || c.name.toLowerCase().includes(filter.trim().toLowerCase())),
  );
  // LA cards, nearest LA first (by its nearest school), unknown LA last.
  const byLa = new Map<string, Candidate[]>();
  for (const c of inTab) byLa.set(c.laName ?? "Other", [...(byLa.get(c.laName ?? "Other") ?? []), c]);
  const laCards = Array.from(byLa.entries()).sort(([a, as], [b, bs]) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    const near = (xs: Candidate[]) => Math.min(...xs.map((x) => x.distanceKm ?? Infinity));
    return near(as) - near(bs) || a.localeCompare(b);
  });

  const isNew = editing === null;
  const personalFull = isNew && !shared && payload.personalCount >= payload.cap;
  const canSave = !!name.trim() && ticked.length > 0 && !saving && !personalFull;

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveComparatorSet(supabase, {
      id: editing?.id ?? null,
      schoolAccountId: payload.me.schoolAccountId,
      ownerMembershipId: shared ? null : editing && !editing.mine ? null : payload.me.membershipId,
      name: name.trim(),
      urns: ticked,
      config: { ...(editing?.config ?? {}), ...(startingFrom && isNew ? { startedFrom: startingFrom.label } : {}) },
    });
    setSaving(false);
    if ("error" in result) setError(result.error);
    else onSaved(result.id);
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    const err = await deleteComparatorSet(supabase, editing.id);
    setSaving(false);
    if (err) setError(err);
    else onSaved(null);
  };

  const count = (s: SectorId) => tickedSchools.filter((c) => sectorOf(c) === s).length;

  return (
    <TeacherModal label="Choose comparison schools" backdropLabel="Close the school chooser" onClose={onClose} initialFocusRef={closeRef}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{isNew ? "New comparison set" : `Editing: ${editing!.name}`}</h2>
          <p className="mt-1 text-xs text-[var(--muted2)]">
            Which schools should {targetName} be compared against?
            {editing?.config.startedFrom ? ` Started from ${editing.config.startedFrom}.` : startingFrom && isNew ? ` Starting from ${startingFrom.label}.` : ""}
          </p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the school chooser" title="Close" className={`shrink-0 ${MODAL_CLOSE_BUTTON_CLASS}`}>
          <ExpandIcon expanded />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => addNearest(5)} className="rounded-md bg-[var(--accent,#2563eb)] px-3 py-1.5 text-[12.5px] font-semibold text-[#06120c]">
            + 5 nearest
          </button>
          <div className="min-w-[14rem] flex-1">
            <SchoolSearch onSelect={addBySearch} placeholder="Add a school…" />
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter this list…"
            className="w-40 rounded-md border border-[var(--panel-border2)] bg-transparent px-2.5 py-1.5 text-[12.5px]"
          />
        </div>

        {/* "Selected so far": every ticked school, grouped by sector, as removable chips. */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3.5">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted3)]">Selected so far</p>
          {(Object.keys(SECTOR) as SectorId[]).map((s) => {
            const chosen = tickedSchools.filter((c) => sectorOf(c) === s);
            const c = SECTOR[s].hex;
            return (
              <div key={s} className="flex flex-col gap-1.5">
                <p className="text-xs font-bold text-[var(--muted2)]">{SECTOR[s].label}</p>
                {chosen.length === 0 ? (
                  <p className="text-[12.5px] italic text-[var(--muted3)]">None yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {chosen.map((m) => (
                      <button
                        key={m.urn}
                        type="button"
                        onClick={() => toggle(m.urn)}
                        aria-label={`Remove ${m.name}`}
                        className="rounded-full border px-2.5 py-[5px] text-[12.5px] font-semibold"
                        style={{ background: `${c}1F`, color: c, borderColor: `${c}59` }}
                      >
                        {m.name} &times;
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sector tabs, styled exactly like the subject picker's family tabs. */}
        <div className="flex flex-wrap gap-2" role="tablist">
          {(Object.keys(SECTOR) as SectorId[]).map((s) => {
            const on = s === tab;
            const hex = SECTOR[s].hex;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(s)}
                className="rounded-full px-3.5 py-2 text-[13px] font-bold"
                style={on ? { background: hex, color: "#fff", border: `1.5px solid ${hex}` } : { background: "transparent", color: hex, border: `1.5px solid ${hex}80` }}
              >
                {SECTOR[s].label} &middot; {count(s)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          {laCards.length === 0 && <p className="text-sm text-[var(--muted)]">No {SECTOR[tab].label.toLowerCase()} schools nearby{filter ? " match that filter" : ""}. Add one by search above.</p>}
          {laCards.map(([la, schools]) => {
            const n = schools.filter((c) => ticked.includes(c.urn)).length;
            const open = expanded[`${tab}:${la}`] ?? n > 0;
            const c = SECTOR[tab].hex;
            return (
              <div key={la} className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded({ ...expanded, [`${tab}:${la}`]: !open })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                  <span className="flex-grow text-[14px] font-bold">{la}</span>
                  <span className="text-[12.5px] text-[var(--muted2)]">{n} of {schools.length} ticked</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted3)] transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {open && (
                  <div className="flex flex-col gap-2 px-4 pb-3 pt-0.5">
                    {[...schools]
                      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.name.localeCompare(b.name))
                      .map((s) => {
                        const on = ticked.includes(s.urn);
                        return (
                          <label
                            key={s.urn}
                            className="flex cursor-pointer items-center gap-3 rounded-[9px] border px-3 py-2.5"
                            style={{ borderColor: on ? c : "var(--panel-border)", background: on ? `${c}14` : "var(--box-bg)" }}
                          >
                            <input type="checkbox" checked={on} onChange={() => toggle(s.urn)} className="h-[17px] w-[17px] shrink-0" style={{ accentColor: c }} />
                            <span className="flex-grow text-[13.5px] font-semibold">{s.name}</span>
                            {payload.excludedUrns.includes(s.urn) && (
                              <span className="shrink-0 text-[11px] text-[var(--muted3)]" title="IGCSE-heavy independent: left out of GCSE comparison">not compared at GCSE</span>
                            )}
                            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[var(--muted2)]">
                              {s.distanceKm === null ? "—" : `${s.distanceKm.toFixed(1)} km`}
                            </span>
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

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--panel-border)] pt-3 text-[12.5px]">
        <span className="text-[var(--muted)]">Your school + {ticked.length} comparator{ticked.length === 1 ? "" : "s"}</span>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          {isNew ? (
            <span className="flex items-center gap-3" role="radiogroup" aria-label="Who can see this set">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={!shared} onChange={() => setShared(false)} /> Personal
              </label>
              <label className={`flex items-center gap-1.5 ${payload.me.canEditShared ? "" : "opacity-50"}`} title={payload.me.canEditShared ? undefined : "Only the account holder or an admin can make a school set"}>
                <input type="radio" checked={shared} disabled={!payload.me.canEditShared} onChange={() => setShared(true)} /> School (admin)
              </label>
            </span>
          ) : (
            <span className="text-[var(--muted2)]">{editing!.shared ? "School set" : "Personal set"}</span>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Set name"
            className="w-44 rounded-md border border-[var(--panel-border2)] bg-transparent px-2.5 py-1.5"
          />
          {!isNew && editing!.editable && (
            <button type="button" onClick={remove} disabled={saving} className="text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50">
              Delete
            </button>
          )}
          <button type="button" onClick={save} disabled={!canSave} className="rounded-md bg-[var(--accent,#2563eb)] px-3 py-1.5 font-semibold text-[#06120c] disabled:opacity-40">
            {saving ? "Saving…" : "Save set"}
          </button>
          <span className="text-[11px] text-[var(--muted2)]">
            {payload.personalCount} / {payload.cap} personal sets used
          </span>
        </span>
        {personalFull && <p className="w-full text-[11.5px] text-[#b45309]">You have {payload.cap} personal sets already. Delete one to make another.</p>}
        {error && <p className="w-full text-[11.5px] text-[#b45309]">{error}</p>}
      </div>
    </TeacherModal>
  );
}
