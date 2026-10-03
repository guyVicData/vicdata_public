"use client";

// VicData 0.6 integration: the chooser's few words that assume a column. Opened from a
// meeting slot (AddViewChooser `columnless`) there is no column: the context box reads
// "Your choices" and the button "Add to slide".
import { createContext, useContext } from "react";

export type ChooserWords = { from: string; add: string };

export const COLUMN_WORDS: ChooserWords = { from: "From this column", add: "Add to panel" };
export const SLOT_WORDS: ChooserWords = { from: "Your choices", add: "Add to slide" };

export const ChooserWordsContext = createContext<ChooserWords>(COLUMN_WORDS);

export function useChooserWords(): ChooserWords {
  return useContext(ChooserWordsContext);
}
