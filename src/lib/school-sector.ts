// The sector palette -- state-funded and independent -- as one shared definition. Moved
// here from ComparatorSetChooser (Column 3 round Part 2) when the Comparisons ranking table
// needed the same colours for its sector icon; it is still the only sector palette in the
// app (the Data View's sector filter is text-only).
export const SECTOR = {
  state: { label: "State-funded", hex: "#4b7bd6" },
  independent: { label: "Independent", hex: "#c2478b" },
} as const;

export type SectorId = keyof typeof SECTOR;

export const sectorOf = (m: { independent: boolean }): SectorId => (m.independent ? "independent" : "state");
