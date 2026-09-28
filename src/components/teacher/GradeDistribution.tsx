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
import { inRange, type GradeRange } from "@/lib/subject-grades";

export type GradeRow = {
  grade: string;
  ownCount: number;
  // The benchmark area's share at this grade, 0-100; null = not published for this grade.
  benchPct: number | null;
  // A second school distribution drawn under the first (Grade counts' Trend: an earlier
  // year), as a share of ITS OWN total. Absent = one distribution.
  compareCount?: number;
};

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
}) {
  const pct = (n: number, of: number) => (of > 0 ? (n / of) * 100 : 0);
  const top = Math.max(1, ...rows.map((r) => Math.max(pct(r.ownCount, total), r.benchPct ?? 0, compareTotal ? pct(r.compareCount ?? 0, compareTotal) : 0)));
  return (
    <div className="flex min-h-0 flex-col">
      <ul className={`flex flex-col ${fullscreen ? "gap-1.5" : "gap-1"}`} aria-label="Grades">
        {rows.map((r) => {
          const selected = range ? inRange(range, r.grade) : false;
          const own = pct(r.ownCount, total);
          const cmp = compareTotal ? pct(r.compareCount ?? 0, compareTotal) : null;
          return (
            <li key={r.grade} className={`flex items-center gap-2 rounded-md px-1 ${selected ? "bg-[rgba(var(--accent-rgb,120,120,120),0.14)]" : ""}`}>
              <button
                type="button"
                onClick={onGradeClick ? () => onGradeClick(r.grade) : undefined}
                disabled={!onGradeClick}
                aria-pressed={onGradeClick ? selected : undefined}
                title={onGradeClick ? (pending ? `End the range at ${r.grade}` : `Start a range at ${r.grade}`) : undefined}
                className={[
                  "shrink-0 truncate rounded-[6px] border px-1.5 py-0.5 text-left text-[11px] font-semibold tabular-nums",
                  fullscreen ? "w-44" : "w-[4.5rem]",
                  pending === r.grade ? "border-[var(--accent,var(--fg))] text-[var(--fg)]" : selected ? "border-transparent text-[var(--fg)]" : "border-transparent text-[var(--muted)]",
                  onGradeClick ? "hover:border-[var(--panel-border2)]" : "cursor-default",
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
                    title={`${compareLabel ?? "Earlier year"}: ${Math.round(cmp)}%`}
                  />
                )}
                {r.benchPct !== null ? (
                  <div
                    className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded bg-[var(--fg)]"
                    style={{ left: `calc(${(r.benchPct / top) * 100}% - 1px)` }}
                    title={`${benchLabel ?? "Benchmark"}: ${Math.round(r.benchPct)}%`}
                  />
                ) : benchLabel ? (
                  <span className="sr-only">{benchLabel}: not shown for this grade (fewer than 5 schools)</span>
                ) : null}
              </div>
              <span className={`shrink-0 text-right text-[11px] tabular-nums ${fullscreen ? "w-24" : "w-16"} ${selected ? "text-[var(--fg)]" : "text-[var(--muted)]"}`}>
                {Math.round(own)}% · {r.ownCount.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
      {(benchLabel || compareLabel) && (
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
        </p>
      )}
    </div>
  );
}
