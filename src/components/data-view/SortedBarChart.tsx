"use client";

// Graphs redesign v1: Current Roll's chart replaced with a bar chart, sorted
// largest-to-smallest, focus school's bar red against an otherwise neutral field,
// hover shows name+value. Plain HTML/CSS bars (width % of a flex row), same
// established pattern as this page's own MarketShareBar -- not a new SVG chart for
// something this simple. The native `title` attribute is the HTML equivalent of
// SpreadStrip.tsx's SVG `<title>` hover convention already used elsewhere on this
// page.
//
// 2026-09-08: generalised from CurrentRollBarChart -- Section 02's own latest-year
// market-share bar tile is "same pattern as Section 01's Current Roll chart" per the
// redesign doc's own words, so this is the one shared component behind both rather
// than a near-duplicate file. formatValue defaults to a plain integer count (Current
// Roll's own original behaviour); Market Share passes a percentage formatter.

export default function SortedBarChart({
  points,
  formatValue = (v) => v.toLocaleString(),
}: {
  points: { urn: string; name: string; value: number; isTarget: boolean }[];
  formatValue?: (v: number) => string;
}) {
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((p) => p.value), 1);

  return (
    <div className="space-y-1.5">
      {sorted.map((p) => (
        <div key={p.urn} className="flex items-center gap-2" title={`${p.name}: ${formatValue(p.value)}`}>
          <span className={`w-20 shrink-0 truncate text-xs ${p.isTarget ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}>
            {p.name}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
            <div
              className={p.isTarget ? "h-full rounded bg-red-600" : "h-full rounded bg-neutral-300 dark:bg-neutral-700"}
              style={{ width: `${(p.value / max) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">{formatValue(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
