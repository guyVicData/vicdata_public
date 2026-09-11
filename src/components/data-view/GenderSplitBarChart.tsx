"use client";

// Sidebar/Graphs/Rankings restructure (2026-09-16), Part B, Graph 10: one 100%-
// stacked horizontal bar per comparison school (or, above the sector-aggregate
// threshold, per represented sector -- see GraphsView.tsx's own comment on that
// fallback), girls%/boys%. No existing component does this; SortedBarChart.tsx is
// the nearest structural precedent (name + bar + value, one row per entry), reused
// here as the layout convention. Colours are the exact TAG_COLOURS.Girls/.Boys
// tokens ShapeChart.tsx/GenderSplitCard.tsx already use, via the same theme-aware
// CSS-custom-property pattern (this file's own small copy of that 6-line
// light/dark pair -- the same pattern now appears in ShapeChart, GenderSplitCard's
// Donut, and here; a third instance of an established convention, not a new one).
import { TAG_COLOURS } from "@/lib/tag-colours";

const GIRLS_COLOUR = { light: TAG_COLOURS.Girls.light[1], dark: TAG_COLOURS.Girls.dark[1] };
const BOYS_COLOUR = { light: TAG_COLOURS.Boys.light[1], dark: TAG_COLOURS.Boys.dark[1] };

export type GenderSplitBarRow = { key: string; label: string; girls: number; boys: number; isTarget?: boolean };

export default function GenderSplitBarChart({ rows }: { rows: GenderSplitBarRow[] }) {
  const real = rows.filter((r) => r.girls + r.boys > 0);
  if (real.length === 0) {
    return <p className="text-sm text-neutral-500">No real gender-split data available for this set.</p>;
  }

  return (
    <div className="gender-stack-root space-y-1.5">
      <style>{`
        .gender-stack-root {
          --girls: ${GIRLS_COLOUR.light};
          --boys: ${BOYS_COLOUR.light};
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .gender-stack-root {
            --girls: ${GIRLS_COLOUR.dark};
            --boys: ${BOYS_COLOUR.dark};
          }
        }
        :root[data-theme="dark"] .gender-stack-root {
          --girls: ${GIRLS_COLOUR.dark};
          --boys: ${BOYS_COLOUR.dark};
        }
      `}</style>
      {real.map((r) => {
        const total = r.girls + r.boys;
        const girlsPct = (r.girls / total) * 100;
        const boysPct = 100 - girlsPct;
        return (
          <div key={r.key} className="flex items-center gap-2" title={`${r.label}: ${girlsPct.toFixed(0)}% girls, ${boysPct.toFixed(0)}% boys`}>
            <span
              className={`w-28 shrink-0 truncate text-xs ${r.isTarget ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}
            >
              {r.label}
            </span>
            <div className="flex h-3 flex-1 overflow-hidden rounded">
              {girlsPct > 0 && <div style={{ width: `${girlsPct}%`, backgroundColor: "var(--girls)" }} />}
              {boysPct > 0 && <div style={{ width: `${boysPct}%`, backgroundColor: "var(--boys)" }} />}
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-neutral-500">
              {girlsPct.toFixed(0)}% / {boysPct.toFixed(0)}%
            </span>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--girls)" }} />
          Girls
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "var(--boys)" }} />
          Boys
        </span>
      </div>
    </div>
  );
}
