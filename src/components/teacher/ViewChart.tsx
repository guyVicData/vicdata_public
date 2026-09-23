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
//
// `layout="labelled"` is the mockups' own bar row: name and qualification on one line,
// then an 8px bar on a --panel-border track, filled in the row's colour, with the figure
// at the end. Same data shape and scaling as the compact rows, so every bar on the
// dashboard still comes from this one component.
// `layout="row"` is round 6's addition (brief §4.1): the same track-fill-value bar as
// `labelled`, but with the name BESIDE the bar rather than above it, and carrying a
// benchmark marker. The marker is genuinely new -- no bar on the dashboard had one before
// this round -- and it is added here rather than in a new component so there is still one
// bar in Teacher view, per §14 and the round-6 brief's own "extend, don't parallel".
// `markerLabel` names what the tick means, once, under the rows.
export function ViewChart({
  computed,
  unit,
  scaleMax,
  layout = "compact",
  markerLabel,
  formatValue,
}: {
  computed: ComputedView;
  unit: string;
  scaleMax?: number;
  layout?: "compact" | "labelled" | "row";
  markerLabel?: string;
  // Round 6: a measure formats its own values ("5.1", "77%", "1,204"), so a chart shared
  // by three measures does not have to infer the format from a unit string.
  formatValue?: (value: number) => string;
}) {
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
  const show = (v: number | null) => (v === null ? "no figure" : formatValue ? formatValue(v) : fmt(v, unit));
  // The scale has to cover the markers too, or a benchmark above every bar sits off the
  // end of its own track and reads as "nobody is near it" rather than "everyone is below".
  const markers = rows.map((r) => r.marker).filter((v): v is number => v !== null && v !== undefined);
  const max = scaleMax ?? (Math.max(...vals, ...markers) || 1);

  if (layout === "row") {
    const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
    return (
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={`${r.label}|${r.sublabel ?? ""}`} className="flex items-center gap-2">
            <span className="flex w-[4.5rem] shrink-0 items-center gap-1.5 overflow-hidden sm:w-[5.5rem]">
              {r.color && <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: r.color }} />}
              <span className={`truncate text-[11px] ${r.emphasis ? "font-bold text-[var(--fg)]" : "text-[var(--muted2)]"}`} title={r.label}>
                {r.label}
              </span>
            </span>
            <span className="relative h-3 flex-grow rounded-[3px] bg-[var(--panel-border)]">
              <span
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{ width: r.value === null ? 0 : `${pct(r.value)}%`, background: r.color ?? "var(--muted)" }}
              />
              {r.marker !== null && r.marker !== undefined && (
                <span
                  // -top/-bottom: the tick overhangs the track top and bottom, as the
                  // wireframe draws it, so it reads as a threshold across the bar rather
                  // than as a segment of it.
                  className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-[1px] bg-[var(--fg)]"
                  style={{ left: `${pct(r.marker)}%` }}
                  title={`${markerLabel ?? "Benchmark"}: ${show(r.marker)}`}
                />
              )}
            </span>
            <span
              className={`w-11 shrink-0 text-right text-xs tabular-nums ${r.value === null ? "text-[var(--muted3)]" : `font-semibold ${r.emphasis ? "font-extrabold" : ""}`}`}
            >
              {r.value === null ? "—" : show(r.value)}
            </span>
          </div>
        ))}
        {markerLabel && markers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-0.5 shrink-0 rounded-[1px] bg-[var(--fg)]" />
            <span className="text-[10.5px] text-[var(--muted3)]">{markerLabel}</span>
          </div>
        )}
      </div>
    );
  }

  if (layout === "labelled") {
    return (
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={`${r.label}|${r.sublabel ?? ""}`}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate font-semibold">{r.label}</span>
              {r.sublabel && <span className="max-w-[50%] shrink-0 truncate text-[var(--muted2)]">{r.sublabel}</span>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-grow overflow-hidden rounded bg-[var(--panel-border)]">
                <div
                  className="h-full"
                  style={{ width: r.value === null ? "0%" : `${Math.max(1, (r.value / max) * 100)}%`, background: r.color ?? "var(--muted)" }}
                />
              </div>
              <span className={`min-w-6 text-right text-[12.5px] font-bold tabular-nums ${r.value === null ? "font-normal text-[var(--muted3)]" : ""}`}>
                {fmt(r.value, unit)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }
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
