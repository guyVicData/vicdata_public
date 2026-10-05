"use client";

// Current panel rework round 1: the Candidates card's "Ranked list" view, moved out of
// CandidatesPanels as it was so Context's Current can draw the same list (Column 1's
// Current is Number tiles only now). One row per subject, largest first as the caller
// sorts it. The focused subject's row is marked for CentredOnTarget, so a whole-school
// list that scrolls starts with it in view.
//
// 0.6.1 S3b: the ranking look's columns (`columns`; absent = rank and value, exactly as
// before): rank, value, change (since the previous year), n (entries) and a bar. A row's
// own `rank` is its place in the whole list, for a list a look has cut (top 5, around).
import type { Measure } from "@/lib/teacher-view-panels";

export type RankedListRow = { key: string; label: string; value: number | null; rank?: number | null; change?: string | null; n?: number | null; share?: number | null };
export type RankedListColumn = "rank" | "sector" | "value" | "change" | "distance" | "n" | "bar";

export function RankedList({
  rows,
  measure,
  focusKey = null,
  columns,
}: {
  rows: RankedListRow[];
  measure: Measure;
  focusKey?: string | null;
  columns?: RankedListColumn[];
}) {
  // A headcount reads "231 candidates"; any other measure is its own formatted figure.
  const unit = measure.id === "entries" ? " candidates" : "";
  if (columns) return <ColumnsList rows={rows} measure={measure} focusKey={focusKey} columns={columns} unit={unit} />;
  return (
    <ol className="flex flex-col gap-1.5 px-0.5 text-[12.5px] text-[var(--muted2)]">
      {rows.map((r, i) => (
        <li key={r.key} data-highlight={r.key === focusKey ? "" : undefined}>
          <span className="tabular-nums">{r.rank ?? i + 1}</span>&nbsp;&nbsp;
          <span className="font-medium text-[var(--fg)]">{r.label}</span> —{" "}
          {r.value === null ? "no published figure" : `${measure.format(r.value)}${unit}`}
        </li>
      ))}
    </ol>
  );
}

// The same list with the look's own columns.
function ColumnsList({ rows, measure, focusKey, columns, unit }: { rows: RankedListRow[]; measure: Measure; focusKey: string | null; columns: RankedListColumn[]; unit: string }) {
  const has = (c: RankedListColumn) => columns.includes(c);
  return (
    <ol className="flex flex-col gap-1.5 px-0.5 text-[12.5px] text-[var(--muted2)]">
      {rows.map((r, i) => (
        <li key={r.key} data-highlight={r.key === focusKey ? "" : undefined}>
          {has("rank") && (
            <>
              <span className="tabular-nums">{r.rank ?? i + 1}</span>&nbsp;&nbsp;
            </>
          )}
          <span className="font-medium text-[var(--fg)]">{r.label}</span>
          {has("value") && <> — {r.value === null ? "no published figure" : `${measure.format(r.value)}${unit}`}</>}
          {has("change") && r.change && <span className="tabular-nums"> · {r.change} on the year before</span>}
          {has("n") && r.n !== null && r.n !== undefined && <span className="tabular-nums"> · {Math.round(r.n).toLocaleString()} entries</span>}
          {has("bar") && r.share !== null && r.share !== undefined && (
            <span aria-hidden="true" className="mt-0.5 block h-[4px] rounded-full bg-[var(--muted3)]" style={{ width: `${Math.round(r.share * 100)}%`, background: r.key === focusKey ? "var(--accent,var(--fg))" : undefined }} />
          )}
        </li>
      ))}
    </ol>
  );
}
