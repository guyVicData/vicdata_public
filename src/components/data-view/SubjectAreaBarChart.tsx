"use client";

// Subject area section (Graphs page, per Guy's direct 2026-09-14 brief): a ranked
// horizontal bar chart, same plain HTML/CSS bar look as SortedBarChart.tsx, but for
// a genuinely different shape of item -- a subject CATEGORY or an individual SUBJECT,
// not a school. SortedBarChart itself isn't reused: it's keyed on `urn`/`isTarget`
// (a school identity) and always sorts itself by its own value, which is wrong here
// on both counts -- these items have no urn, and the brief's own explicit
// requirement ("results... ranked in same order as left hand chart, ie we are
// making comparisons") means the RESULTS chart must NOT re-sort by its own value --
// it has to render in whatever order the CANDIDATES chart used, so a viewer can read
// the two bars for the same category/subject off the same row. `order` (an explicit
// list of ids) does that job; when omitted, the chart sorts by its own value
// (descending), same default SortedBarChart would give.
//
// `colourFor` lets the caller tint each bar by the category's own site-wide colour
// (subject-family-colours.ts) -- an identity colour, not a direction/magnitude one
// (that's SubjectAreaDivergingBarChart's job, for the Trends row below this).
//
// Subject deep-dive round, Part 3: `onItemClick` is the real click target the
// navigation drawer hangs off of -- any bar across all four Section 03 rows opens the
// drawer scoped to that real category/subject. Optional and additive: every existing
// call site that doesn't pass it renders exactly as before (no cursor/hover change),
// per the brief's own "reuse this exact machinery" instruction rather than a parallel
// clickable variant.
export default function SubjectAreaBarChart({
  items,
  order,
  colourFor,
  formatValue = (v) => v.toLocaleString(),
  onItemClick,
}: {
  items: { id: string; label: string; value: number }[];
  order?: string[];
  colourFor?: (id: string) => string;
  formatValue?: (v: number) => string;
  onItemClick?: (id: string) => void;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = order ? order.map((id) => byId.get(id)).filter((i): i is { id: string; label: string; value: number } => !!i) : [...items].sort((a, b) => b.value - a.value);
  if (ordered.length === 0) {
    return <p className="text-sm text-neutral-500">No real data to show yet.</p>;
  }
  const max = Math.max(...ordered.map((p) => p.value), 1);

  return (
    <div className="space-y-1.5">
      {ordered.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2${onItemClick ? " cursor-pointer rounded hover:bg-neutral-50 dark:hover:bg-neutral-900" : ""}`}
          title={`${p.label}: ${formatValue(p.value)}${onItemClick ? " — click for detail" : ""}`}
          onClick={onItemClick ? () => onItemClick(p.id) : undefined}
          role={onItemClick ? "button" : undefined}
          tabIndex={onItemClick ? 0 : undefined}
        >
          <span className="w-28 shrink-0 truncate text-xs text-neutral-600 dark:text-neutral-400">{p.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
            <div
              className="h-full rounded"
              style={{ width: `${(p.value / max) * 100}%`, background: colourFor ? colourFor(p.id) : "#525252" }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">{formatValue(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
