"use client";

// Member Data View (round 1 UX refinements, A2 + B3): "Add a Saved Sets dropdown
// plus a Save set button... this should share one underlying save mechanism with
// the 'Compared with' rework, not be built as a second, separate thing." The
// mechanism itself (the actual saved_sets/saved_set_members read+write) lives in
// DataViewShell -- the exact same tables and RLS policies /sets/comparator/new/
// page.tsx already uses, just with one real addition (a `config` jsonb snapshot of
// the filter state alongside the school list, so recalling a saved set restores
// BOTH what was ticked and what the filters were, not just the school list).
//
// Global filter-row rework (2026-09-16), item 3: moved out of FilterBar.tsx's own
// `extra` slot (the top filter row) into ComparatorSidebar's "My sets" section --
// same component, unchanged, just relocated so Save/recall reads as part of "my
// sets" rather than "the filter row." FilterBar.tsx no longer has an `extra` slot
// at all. This component is still deliberately kept separate from FilterBar
// itself (which stays a pure controlled input over filter state, no set-saving
// concerns of its own).
//
// Deliberately separate from the sidebar's OWN existing set-picker (the per-saved-
// set SetButton list directly above this component in ComparatorSidebar.tsx, which
// already lists recipe lists + saved sets together): that answers "which schools am
// I comparing against," unchanged by this round. This one answers "recall a whole
// bookmarked combination (schools + filters) I saved earlier" -- a genuinely
// different, complementary question -- now sitting right next to that other
// recall mechanism as a second way to do a similar thing, left as-is rather than
// rationalised (per direct instruction, "don't worry about functionality yet").

import { useState } from "react";
import type { SetOption } from "@/lib/data-view-types";

export default function SavedSetsControl({
  savedSets,
  onSelect,
  onSave,
  canSave,
}: {
  savedSets: SetOption[];
  onSelect: (option: SetOption) => void;
  onSave: (name: string) => Promise<{ ok: boolean; error?: string }>;
  canSave: boolean;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSave(name.trim() || "Saved set");
    setSaving(false);
    if (result.ok) {
      setNaming(false);
      setName("");
    } else {
      setError(result.error ?? "Could not save.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Saved sets</span>
      <select
        value=""
        onChange={(e) => {
          const found = savedSets.find((s) => s.kind === "saved" && s.id === e.target.value);
          if (found) onSelect(found);
        }}
        disabled={savedSets.length === 0}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="" disabled>
          {savedSets.length === 0 ? "None saved yet" : "Recall a saved set…"}
        </option>
        {savedSets.map((s) => (
          <option key={s.kind === "saved" ? s.id : ""} value={s.kind === "saved" ? s.id : ""}>
            {s.label}
          </option>
        ))}
      </select>

      {naming ? (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this set…"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setNaming(false);
            }}
          />
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
          <button type="button" onClick={() => setNaming(false)} className="text-xs text-neutral-400 underline">
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={!canSave}
          onClick={() => setNaming(true)}
          title={canSave ? undefined : "Tick at least one school to save a set"}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400"
        >
          Save set
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
