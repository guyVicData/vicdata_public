"use client";

// Grade bands frontend round: one subject's grade distribution, and the range picker in the
// same place. One row per grade in the subject's own scale order (gradeOrderFrom), each
// row's grade a real <button> -- click one grade, then another, and the inclusive span
// between them is the range; keyboard users Tab and Enter the same buttons. No slider and
// no drag, so nothing beyond a click is needed to pick a span.
//
// The bar is this school's share of its graded entries at that grade (count beside it); the
// tick is the benchmark area's share at the same grade. A grade the benchmark has no row for
// was suppressed by the RPC (fewer than 5 schools), so it shows no tick and says so on
// hover, rather than a zero. The range state belongs to the caller: this draws it and
// reports clicks.
//
// 0.6.1 S3d: 2 · View's spread looks (never a figure), each off by default so every host
// draws as before -- `show` counts (bars by entries, not share), `average` (a marker at the
// mean or median grade drawn), `shade` (a band shaded, no clicking), `values` (false hides
// each row's figure).
import { useLayoutEffect, useRef, useState } from "react";
import { inRange, type GradeRange } from "@/lib/subject-grades";
import type { AverageGrade, GradeRow } from "@/lib/grade-spread";

export type { GradeRow } from "@/lib/grade-spread";

export function GradeDistribution({
  rows,
  total,
  compareTotal,
  compareLabel,
  colour,
  range,
  pending,
  onGradeClick,
  benchLabel,
  fullscreen = false,
  show = "percent",
  average = null,
  shade = null,
  shadeLabel = null,
  values = true,
  clickable,
  clickTitle,
}: {
  rows: GradeRow[];
  // The school's graded entries, for each row's share.
  total: number;
  compareTotal?: number;
  compareLabel?: string;
  colour: string;
  range: GradeRange | null;
  // The first click of a range still waiting for its second.
  pending: string | null;
  onGradeClick?: (grade: string) => void;
  benchLabel: string | null;
  fullscreen?: boolean;
  show?: "percent" | "counts";
  average?: AverageGrade | null;
  shade?: GradeRange | null;
  shadeLabel?: string | null;
  values?: boolean;
  // 0.6.3 S1 (Grade counts' selection): which grades can be clicked, and each grade's
  // tooltip. A grade that can't be a range end (U / Fail / Unclassified) stays visible and
  // focusable with its tooltip saying why, but a click does nothing. Absent = every grade
  // clickable with the two-click range wording, as before (Grade bands' Grades view).
  clickable?: (grade: string) => boolean;
  clickTitle?: (grade: string) => string;
}) {
  const pct = (n: number, of: number) => (of > 0 ? (n / of) * 100 : 0);
  // Counts: every bar, tick and earlier-year line in entries (England's share as the entries
  // this school would have at it); else each as a share of its own total.
  const counts = show === "counts";
  const ownOf = (r: GradeRow) => (counts ? r.ownCount : pct(r.ownCount, total));
  const benchOf = (r: GradeRow) => (r.benchPct === null ? null : counts ? (r.benchPct / 100) * total : r.benchPct);
  const cmpOf = (r: GradeRow) => (!compareTotal ? null : counts ? r.compareCount ?? 0 : pct(r.compareCount ?? 0, compareTotal));
  const top = Math.max(1, ...rows.map((r) => Math.max(ownOf(r), benchOf(r) ?? 0, cmpOf(r) ?? 0)));
  const fmt = (v: number) => (counts ? Math.round(v).toLocaleString() : `${Math.round(v)}%`);
  // The average grade marker, placed by the drawn rows themselves: between the centres of the
  // two rows either side of its value, in proportion (5.3 is 30% of the way from 5 to 6), with
  // its value tagged at the grade column's edge. Until measured (first paint, no layout), the
  // even-rows estimate.
  const wrap = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<{ top: number; tagRight: number } | null>(null);
  const avgPos = average?.position ?? null;
  useLayoutEffect(() => {
    const el = wrap.current;
    if (avgPos === null || !el) return setMark(null);
    const box = el.getBoundingClientRect();
    const items = [...el.querySelectorAll<HTMLLIElement>(":scope > ul > li")];
    if (!items.length) return setMark(null);
    const centre = (i: number) => {
      const r = items[Math.max(0, Math.min(items.length - 1, i))].getBoundingClientRect();
      return r.top + r.height / 2 - box.top;
    };
    const i = Math.floor(avgPos);
    const top = centre(i) + (avgPos - i) * (centre(i + 1) - centre(i));
    const label = items[0].querySelector("button")?.getBoundingClientRect();
    setMark({ top, tagRight: label ? label.right - box.left : 0 });
  }, [avgPos, rows.length, fullscreen, values, show]);
  const list = (
      <ul className={`flex flex-col ${fullscreen ? "gap-1.5" : "gap-1"}`} aria-label="Grades">
        {rows.map((r) => {
          const selected = range ? inRange(range, r.grade) : false;
          const canClick = !!onGradeClick && (clickable ? clickable(r.grade) : true);
          const shaded = shade ? inRange(shade, r.grade) : false;
          const own = ownOf(r);
          const cmp = cmpOf(r);
          const bench = benchOf(r);
          return (
            <li key={r.grade} className={`flex items-center gap-2 rounded-md px-1 ${selected ? "bg-[rgba(var(--accent-rgb,120,120,120),0.14)]" : shaded ? "bg-[rgba(var(--accent-rgb,120,120,120),0.08)]" : ""}`}>
              <button
                type="button"
                onClick={canClick ? () => onGradeClick!(r.grade) : undefined}
                disabled={!onGradeClick}
                aria-disabled={onGradeClick && !canClick ? true : undefined}
                aria-pressed={canClick ? selected : undefined}
                title={onGradeClick ? (clickTitle ? clickTitle(r.grade) : pending ? `End the range at ${r.grade}` : `Start a range at ${r.grade}`) : undefined}
                className={[
                  "shrink-0 truncate rounded-[6px] border px-1.5 py-0.5 text-left text-[11px] font-semibold tabular-nums",
                  fullscreen ? "w-44" : "w-[4.5rem]",
                  pending === r.grade ? "border-[var(--accent,var(--fg))] text-[var(--fg)]" : selected ? "border-transparent text-[var(--fg)]" : "border-transparent text-[var(--muted)]",
                  canClick ? "hover:border-[var(--panel-border2)]" : onGradeClick ? "cursor-not-allowed" : "cursor-default",
                ].join(" ")}
              >
                {r.grade}
              </button>
              <div className="relative h-3.5 min-w-0 flex-1">
                <div className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(own / top) * 100}%`, background: colour, opacity: selected || !range ? 1 : 0.45 }} />
                {cmp !== null && (
                  <div
                    className="absolute bottom-0 left-0 h-[3px] rounded-[2px] bg-[var(--muted2)]"
                    style={{ width: `${(cmp / top) * 100}%` }}
                    title={`${compareLabel ?? "Earlier year"}: ${fmt(cmp)}`}
                  />
                )}
                {bench !== null ? (
                  <div
                    className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded bg-[var(--fg)]"
                    style={{ left: `calc(${(bench / top) * 100}% - 1px)` }}
                    title={`${benchLabel ?? "Benchmark"}: ${Math.round(r.benchPct ?? 0)}%`}
                  />
                ) : benchLabel ? (
                  <span className="sr-only">{benchLabel}: not shown for this grade (fewer than 5 schools)</span>
                ) : null}
              </div>
              {values && (
                <span className={`shrink-0 text-right text-[11px] tabular-nums ${fullscreen ? "w-24" : "w-16"} ${selected ? "text-[var(--fg)]" : "text-[var(--muted)]"}`}>
                  {/* Kept as separate text runs, as drawn before S3d (the same pixels). */}
                  {counts ? <>{r.ownCount.toLocaleString()} · {Math.round(pct(r.ownCount, total))}%</> : <>{Math.round(own)}% · {r.ownCount.toLocaleString()}</>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
  );
  return (
    <div className="flex min-h-0 flex-col">
      {average ? (
        // The average grade: a dashed line across the rows where it falls (between two rows
        // for a mean that isn't a whole grade), named in the key below.
        <div ref={wrap} className="relative">
          {list}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -translate-y-1/2 border-t-2 border-dashed border-[var(--fg)]"
            style={{ top: mark ? mark.top : `${((average.position + 0.5) / rows.length) * 100}%` }}
          />
          {mark && mark.tagRight > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-full -translate-y-1/2 rounded-[4px] bg-[var(--fg)] px-1 text-[10px] leading-[14px] font-semibold tabular-nums text-[var(--bg)]"
              style={{ top: mark.top, left: mark.tagRight }}
            >
              {average.value}
            </span>
          )}
        </div>
      ) : (
        list
      )}
      {(benchLabel || compareLabel || average || (shade && shadeLabel)) && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
          {benchLabel && (
            <>
              <span aria-hidden="true" className="inline-block h-3 w-[2px] rounded bg-[var(--fg)]" />
              {benchLabel}
              {rows.some((r) => r.benchPct === null) && " · no tick where fewer than 5 schools publish that grade"}
            </>
          )}
          {compareLabel && (
            <>
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-[2px]" style={{ background: colour }} />
              this year
              <span aria-hidden="true" className="ml-2 inline-block h-[3px] w-3 rounded bg-[var(--muted2)]" />
              {compareLabel}
            </>
          )}
          {average && (
            <>
              <span aria-hidden="true" className="ml-2 inline-block w-3 border-t-2 border-dashed border-[var(--fg)]" />
              {average.label}
            </>
          )}
          {shade && shadeLabel && (
            <>
              <span aria-hidden="true" className="ml-2 inline-block h-3 w-3 rounded-[2px] bg-[rgba(var(--accent-rgb,120,120,120),0.08)]" />
              {shadeLabel}
            </>
          )}
        </p>
      )}
    </div>
  );
}
