// Sidebar/Graphs/Rankings restructure (2026-09-16), Part A: extracted from
// GraphsView.tsx (which defined this inline) so the sidebar's new target-roll badge
// can reuse the EXACT same component, per direct instruction ("reusing TrendPill...
// don't invent a new one") -- one real implementation, not two independently-styled
// copies that could drift. GraphsView.tsx now imports this instead of its own local
// copy; its own rendering/behaviour is byte-for-byte unchanged by the move.
import type { TrendBadge } from "@/lib/data-view-cards";

export function academicYearLabel(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

export default function TrendPill({ badge, startPeriod }: { badge: TrendBadge; startPeriod: number }) {
  if (!badge) return <span className="text-xs text-neutral-400">no {academicYearLabel(startPeriod)} comparison</span>;
  const arrow = badge.direction === "up" ? "▲" : badge.direction === "down" ? "▼" : "▬";
  const colour =
    badge.direction === "up" ? "text-blue-600 dark:text-blue-400" : badge.direction === "down" ? "text-red-600 dark:text-red-400" : "text-neutral-500";
  return (
    <span className={`text-xs font-medium ${colour}`}>
      {arrow} {Math.abs(badge.pctChange).toFixed(0)}% since {academicYearLabel(startPeriod)}
    </span>
  );
}
