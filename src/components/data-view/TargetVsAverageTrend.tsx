"use client";

// Small, dumb two-line trend chart (target vs. a comparison-set line -- "average"
// historically, but the same real shape works for any second real series). Extracted
// from AcademicGraphsView.tsx (subject deep-dive round) so the deep-dive view
// (SubjectDeepDiveDrawer.tsx) can reuse the exact same real trend chart for a
// subject's own real multi-period line, rather than a second implementation of the
// same "plain inline SVG, no charting library" convention every other chart in this
// directory follows (Sparkline/SpreadStrip's own module comments). Not a shared
// generic chart: this is the one place this codebase needs a two-series line (Rolls'
// own RollTrendsChart draws one line per SCHOOL, not a target-vs-comparison pair).
import { academicYearLabel } from "./TrendPill";

export default function TargetVsAverageTrend({ periods, targetSeries, averageSeries }: { periods: number[]; targetSeries: (number | null)[]; averageSeries: (number | null)[] }) {
  const allReal = [...targetSeries, ...averageSeries].filter((v): v is number => v !== null);
  if (allReal.length < 2 || periods.length < 2) return <p className="text-sm text-neutral-500">Not enough history to show a trend.</p>;
  const min = Math.min(...allReal);
  const max = Math.max(...allReal);
  const span = max - min || 1;
  const W = 320;
  const H = 140;
  const padX = 28;
  const padY = 14;
  const xFor = (i: number) => padX + (i / (periods.length - 1)) * (W - padX * 2);
  const yFor = (v: number) => H - padY - ((v - min) / span) * (H - padY * 2);

  function pathFor(series: (number | null)[]): string {
    const segments: string[] = [];
    let current: string[] = [];
    series.forEach((v, i) => {
      if (v === null) {
        if (current.length > 1) segments.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${i === 0 || current.length === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`);
    });
    if (current.length > 1) segments.push(current.join(" "));
    return segments.join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 480 }}>
      <line x1={padX} x2={W - padX} y1={H - padY} y2={H - padY} stroke="currentColor" strokeOpacity={0.15} />
      <path d={pathFor(averageSeries)} fill="none" stroke="#9ca3af" strokeWidth={2} />
      <path d={pathFor(targetSeries)} fill="none" stroke="#dc2626" strokeWidth={2} />
      {periods.map((p, i) => (
        <text key={p} x={xFor(i)} y={H} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.5}>
          {academicYearLabel(p)}
        </text>
      ))}
    </svg>
  );
}
