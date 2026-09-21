"use client";

// Teacher view, Phase 4: how a pinned view actually renders (design brief v2 §7, §14).
//
// Deliberately CSS-only rather than a charting library. §7 makes "presentable full-screen
// on a projector" and "universal PDF/print export ... a light, print-safe rendering
// regardless of on-screen theme" first-class requirements, and a canvas/SVG chart library
// fights both: canvas does not reflow for print, and most libraries paint their own
// colours that then have to be re-themed twice over. Bars built from divs scale to any
// width, print exactly as they appear, and inherit the theme tokens for free.
import type { ComputedView } from "@/lib/teacher-view-catalogue";

function fmt(v: number | null, unit: string): string {
  if (v === null) return "no figure";
  if (unit === "percent") return `${Math.round(v)}%`;
  return unit === "entries" ? Math.round(v).toLocaleString() : v.toFixed(1);
}

// `scaleMax` pins the bar scale -- a share of the year group reads against 100%, not
// against whichever subject happens to be largest.
export function ViewChart({ computed, unit, scaleMax }: { computed: ComputedView; unit: string; scaleMax?: number }) {
  if (computed.series && computed.periods) {
    const periods = computed.periods;
    const all = computed.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
    if (!periods.length || !all.length) {
      return <p className="text-xs text-neutral-500">No published figures for this comparison.</p>;
    }
    const max = Math.max(...all);
    const min = Math.min(...all, 0);
    const span = max - min || 1;
    return (
      <div className="mt-2">
        <div className="flex items-end gap-3 overflow-x-auto">
          {periods.map((p, idx) => (
            <div key={p} className="flex min-w-[3rem] flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end justify-center gap-1">
                {computed.series!.map((s) => {
                  const v = s.values[idx];
                  return (
                    <div
                      key={s.label}
                      title={`${s.label} ${p}: ${fmt(v, unit)}`}
                      style={{ height: v === null ? "2px" : `${Math.max(2, ((v - min) / span) * 96)}px` }}
                      className={`w-3 rounded-t ${s.isSubject ? "bg-blue-600 dark:bg-blue-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] tabular-nums text-neutral-500">{p}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-500">
          {computed.series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-sm ${s.isSubject ? "bg-blue-600 dark:bg-blue-500" : "bg-neutral-300 dark:bg-neutral-700"}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const rows = computed.rows;
  const vals = rows.map((r) => r.value).filter((v): v is number => v !== null);
  if (!vals.length) return <p className="mt-2 text-xs text-neutral-500">No published figures for this comparison.</p>;
  const max = scaleMax ?? (Math.max(...vals) || 1);
  return (
    <ul className="mt-2 space-y-1">
      {rows.slice(0, 12).map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
          <span className={`truncate ${r.isSubject ? "font-semibold" : ""}`}>{r.label}</span>
          <span className="h-2 rounded-sm bg-neutral-100 dark:bg-neutral-800">
            <span
              className={`block h-2 rounded-sm ${r.isSubject ? "bg-blue-600 dark:bg-blue-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
              style={{ width: r.value === null ? "0%" : `${Math.max(1, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className={`tabular-nums ${r.value === null ? "text-neutral-400" : ""}`}>{fmt(r.value, unit)}</span>
        </li>
      ))}
      {rows.length > 12 && <li className="text-[11px] text-neutral-500">and {rows.length - 12} more</li>}
    </ul>
  );
}
