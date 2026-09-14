"use client";

// Subject area section, Trends row (Guy's brief: "Candidates % change" / "Results %
// change"). Same real diverging-bar shape as DivergingBarChart.tsx (centre line,
// trendColour's shared red/orange/amber/green direction scale -- colour here means
// DIRECTION, not category identity, same reasoning that component's own header
// comment already gives), generalised the same way SubjectAreaBarChart.tsx
// generalises SortedBarChart: keyed on an arbitrary `id`/`label`, not a school's
// `urn`, and accepts an explicit `order` so this chart can be forced into the same
// row order as its paired absolute-value chart above it, rather than re-sorting
// itself by pctChange.
import { trendColour } from "@/lib/trend-colours";

// Subject deep-dive round, Part 3: `onItemClick`, same real click-target addition as
// SubjectAreaBarChart's own (see that file's own comment) -- optional and additive.
export default function SubjectAreaDivergingBarChart({
  items,
  order,
  formatValue = (v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`,
  onItemClick,
}: {
  items: { id: string; label: string; pctChange: number | null }[];
  order?: string[];
  formatValue?: (v: number) => string;
  onItemClick?: (id: string) => void;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = (order ? order.map((id) => byId.get(id)).filter((i): i is { id: string; label: string; pctChange: number | null } => !!i) : items).filter(
    (i): i is { id: string; label: string; pctChange: number } => i.pctChange !== null,
  );
  if (ordered.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough history to compute growth/decline.</p>;
  }
  const maxAbs = Math.max(...ordered.map((p) => Math.abs(p.pctChange)), 5);

  return (
    <div className="space-y-1.5">
      {ordered.map((p) => {
        const widthPct = (Math.abs(p.pctChange) / maxAbs) * 50;
        return (
          <div
            key={p.id}
            className={`flex items-center gap-2${onItemClick ? " cursor-pointer rounded hover:bg-neutral-50 dark:hover:bg-neutral-900" : ""}`}
            title={`${p.label}: ${formatValue(p.pctChange)}${onItemClick ? " — click for detail" : ""}`}
            onClick={onItemClick ? () => onItemClick(p.id) : undefined}
            role={onItemClick ? "button" : undefined}
            tabIndex={onItemClick ? 0 : undefined}
          >
            <span className="w-28 shrink-0 truncate text-xs text-neutral-600 dark:text-neutral-400">{p.label}</span>
            <div className="relative h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
              <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-300 dark:bg-neutral-700" />
              <div
                className="absolute inset-y-0 rounded"
                style={
                  p.pctChange >= 0
                    ? { left: "50%", width: `${widthPct}%`, background: trendColour(p.pctChange) }
                    : { right: "50%", width: `${widthPct}%`, background: trendColour(p.pctChange) }
                }
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">{formatValue(p.pctChange)}</span>
          </div>
        );
      })}
    </div>
  );
}
