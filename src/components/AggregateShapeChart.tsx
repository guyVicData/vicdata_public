"use client";

// Small grey "no-gender" shape chart for the free-tier surrounding-schools summary
// (chart palette doc, "Public View rebuild") -- same horizontal age-on-y-axis layout
// as ShapeChart, but single-sided (no boy/girl split, since it's an aggregate over
// several unnamed schools) and grey, deliberately visually distinct from the
// single-school pupil-count chart so the two are never confused for the same kind of
// figure. Same edge-age tinting (4 and 18 at reduced opacity) for the same reason.

const EDGE_AGE_MIN = 4;
const EDGE_AGE_MAX = 18;
const EDGE_AGES = new Set([EDGE_AGE_MIN, EDGE_AGE_MAX]);

const ROW_HEIGHT = 10;
const ROW_GAP = 1;
const WIDTH = 280;
const PAD = { top: 4, right: 8, bottom: 4, left: 20 };

export default function AggregateShapeChart({ ageCounts }: { ageCounts: Map<number, number> }) {
  const ages: number[] = [];
  for (let age = EDGE_AGE_MAX; age >= EDGE_AGE_MIN; age--) ages.push(age);

  const rows = ages.map((age) => ({ age, total: ageCounts.get(age) ?? 0, isEdge: EDGE_AGES.has(age) }));
  const maxVal = Math.max(1, ...rows.map((r) => r.total));
  const innerH = ages.length * ROW_HEIGHT + (ages.length - 1) * ROW_GAP;
  const height = PAD.top + PAD.bottom + innerH;
  const barAreaW = WIDTH - PAD.left - PAD.right;
  const scale = barAreaW / maxVal;

  const rowY = (i: number) => PAD.top + i * (ROW_HEIGHT + ROW_GAP);

  if (rows.every((r) => r.total === 0)) return null;

  return (
    <div className="agg-shape-root">
      <style>{`
        .agg-shape-root { color-scheme: light; --bar: #a3a3a3; --axis-label: #4d4d4d; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .agg-shape-root { color-scheme: dark; --bar: #737373; --axis-label: #cccccc; }
        }
        :root[data-theme="dark"] .agg-shape-root { color-scheme: dark; --bar: #737373; --axis-label: #cccccc; }
      `}</style>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full max-w-[280px]">
        {rows.map((r, i) => {
          const y = rowY(i);
          const w = r.total * scale;
          return (
            <g key={r.age}>
              <text x={PAD.left - 4} y={y + ROW_HEIGHT / 2 + 3} fontSize={8} fill="var(--axis-label)" textAnchor="end">
                {r.age}
              </text>
              {w > 0 && (
                <rect
                  x={PAD.left}
                  y={y}
                  width={w}
                  height={ROW_HEIGHT}
                  rx={1}
                  fill="var(--bar)"
                  fillOpacity={r.isEdge ? 0.5 : 1}
                />
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-neutral-400">Average shape across the comparison group, no gender split.</p>
    </div>
  );
}
