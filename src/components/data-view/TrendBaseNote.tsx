// R-TREND-FROM-2223 in the Data View (year rules follow-ups, Guy, 13 Oct 2026): a grade or points
// trend that draws 2021/22 carries the same note Teacher's views do (catalogue/notes.ts
// trendNoteFor). `years` are the periods the chart draws; nothing is printed otherwise.
import { trendNoteFor } from "@/catalogue/notes";

export default function TrendBaseNote({ years }: { years: readonly number[] }) {
  const note = trendNoteFor(years);
  return note ? <p className="mt-2 text-xs text-neutral-400" data-trend-note="">{note}</p> : null;
}
