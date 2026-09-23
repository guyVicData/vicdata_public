"use client";

// Teacher view, round 6: the sortable 3-column table (brief §4.1, §4.2, §4.3, §5).
//
// §5 fixes the pattern for every sortable table this round adds: "header buttons with a
// trailing arrow, click to sort, click again to flip; the summary sentence is always
// computed independently of the current sort so it doesn't change as the user reorders
// the table." Both halves are load-bearing and both live outside this component's own
// state on purpose -- the sort belongs to the panel that owns it (so it survives a
// re-render and a measure switch), and the summary is the caller's, computed from the
// unsorted rows.
//
// Three columns because all three users of it have the same shape: a name, its figure,
// and that figure read against something (the England average, the comparison group's
// own average, or the school's rank in the set).

export type SortKey = "name" | "value" | "delta";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

export type SortRow = {
  key: string;
  label: string;
  colour?: string;
  value: number | null;
  valueLabel: string;
  // The third column. `delta` sorts it; `deltaLabel` prints it; `deltaTone` colours it.
  delta: number | null;
  deltaLabel: string;
  deltaTone?: "positive" | "negative" | "neutral";
  emphasis?: boolean;
};

// Each column's natural first direction: names read A-Z, figures read best-first.
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = { name: "asc", value: "desc", delta: "desc" };

export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, dir: DEFAULT_DIR[key] };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

// Nulls sort last whichever way the column is pointing: "no published figure" is not the
// smallest value, and letting it float to the top of an ascending sort says it is.
export function applySort(rows: SortRow[], sort: SortState): SortRow[] {
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.key === "name") return a.label.localeCompare(b.label) * mul;
    const av = sort.key === "value" ? a.value : a.delta;
    const bv = sort.key === "value" ? b.value : b.delta;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * mul;
  });
}

function Header({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className: string;
}) {
  const on = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      // aria-sort belongs on the cell, but this table is a flex layout rather than a real
      // <table>, so the state is announced on the control that changes it instead.
      aria-label={`Sort by ${label}${on ? `, currently ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}
      className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.02em] text-[var(--muted)] hover:text-[var(--fg)] ${className}`}
    >
      {label}
      <span aria-hidden="true" className={on ? "" : "opacity-0"}>{sort.dir === "asc" ? "▲" : "▼"}</span>
    </button>
  );
}

export function SortTable({
  rows,
  sort,
  onSort,
  columns,
  fullscreen = false,
}: {
  rows: SortRow[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  // The three headings, which differ per column ("Subject / Result / vs National" in
  // Results, "School / Result / Rank" in Comparisons).
  columns: { name: string; value: string; delta: string };
  fullscreen?: boolean;
}) {
  const sorted = applySort(rows, sort);
  const tone = (t: SortRow["deltaTone"]) =>
    t === "positive" ? "text-[#0d9488] dark:text-[#2dd4bf]" : t === "negative" ? "text-[#b45309] dark:text-[#fbbf24]" : "text-[var(--muted2)]";

  return (
    <div className={`flex flex-col ${fullscreen ? "text-sm" : "text-[12.5px]"}`}>
      <div className="flex items-center gap-1.5 border-b border-[var(--panel-border2)] px-0.5 pb-1.5 pt-0.5">
        <Header label={columns.name} sortKey="name" sort={sort} onSort={onSort} className="min-w-0 flex-grow text-left" />
        <Header label={columns.value} sortKey="value" sort={sort} onSort={onSort} className="w-14 shrink-0 justify-end text-right" />
        <Header label={columns.delta} sortKey="delta" sort={sort} onSort={onSort} className="w-[5.5rem] shrink-0 justify-end text-right" />
      </div>
      {sorted.map((r) => (
        <div key={r.key} className="flex items-center gap-1.5 border-b border-[var(--panel-border)] px-0.5 py-[7px] last:border-b-0">
          {r.colour && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: r.colour }} />}
          <span className={`min-w-0 flex-grow truncate ${r.emphasis ? "font-bold" : ""}`} title={r.label}>{r.label}</span>
          <span className={`w-14 shrink-0 text-right font-semibold tabular-nums ${r.value === null ? "font-normal text-[var(--muted3)]" : ""}`}>
            {r.valueLabel}
          </span>
          <span className={`w-[5.5rem] shrink-0 text-right font-semibold tabular-nums ${tone(r.deltaTone)}`}>{r.deltaLabel}</span>
        </div>
      ))}
    </div>
  );
}
