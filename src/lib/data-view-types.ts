// Member Data View: shared UI-state types, kept separate from the fetch/compute
// modules so both the shell and its child components can import just the shapes
// without pulling in server-only fetch code.

import type { DefaultListEntry } from "./default-comparator-lists";

// A selectable named set in the sidebar's set-picker (brief §4/§6.2): either a
// VicData-recipe default list (computed, never a saved_sets row -- see
// docs/vicdata_data_view_open_questions.md's §6.2 decision) or the member's own
// saved comparator set (a real saved_sets row). Discriminated on `kind` so the UI
// never needs to guess which fetch path a given option came from.
export type SetOption =
  | { kind: "recipe"; key: string; label: string; schools: DefaultListEntry[]; note?: string; lazy?: boolean }
  | { kind: "saved"; id: string; label: string; schools: DefaultListEntry[] };

export type ViewKey = "map" | "dashboard" | "rankings";
