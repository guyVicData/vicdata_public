// Member Data View: shared UI-state types, kept separate from the fetch/compute
// modules so both the shell and its child components can import just the shapes
// without pulling in server-only fetch code.

import type { DefaultListEntry } from "./default-comparator-lists";
import type { WireDataViewFilterState } from "./data-view-filters";

// A selectable named set in the sidebar's set-picker (brief §4/§6.2): either a
// VicData-recipe default list (computed, never a saved_sets row -- see
// docs/vicdata_data_view_open_questions.md's §6.2 decision) or the member's own
// saved comparator set (a real saved_sets row). Discriminated on `kind` so the UI
// never needs to guess which fetch path a given option came from.
//
// 2026-09-06, UX refinements round 1, A2/B3: "saved" gained an optional `filters`
// snapshot (the wire-safe form -- Sets don't survive a jsonb column, see
// data-view-filters.ts's own serializeFilterState/deserializeFilterState) so
// recalling a saved set can restore BOTH the school list and the filter state it was
// saved with, not just the schools. Optional, not required, so an older saved_sets
// row with no real `config` written yet (every row from before this round, and every
// row /sets/comparator/new/page.tsx's own save flow still writes without one)
// degrades to "just restore the schools," never a runtime crash on a missing field.
export type SetOption =
  | { kind: "recipe"; key: string; label: string; schools: DefaultListEntry[]; note?: string; lazy?: boolean }
  | { kind: "saved"; id: string; label: string; schools: DefaultListEntry[]; filters?: WireDataViewFilterState };

export type ViewKey = "map" | "dashboard" | "rankings";
