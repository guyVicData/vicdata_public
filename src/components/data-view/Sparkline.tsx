// Sidebar/Graphs/Rankings restructure (2026-09-16), Part A: a small, genuinely dumb
// line chart -- no axes, gridlines, legend or tooltip, just a line and its real
// end-point dots, at sidebar-panel scale. Deliberately takes a plain `values` array
// (not a school profile / filter state) so it has no data-fetching or filtering
// opinion of its own -- the caller (ComparatorSidebar's own target-roll sparkline
// today; Part C3's own average-rank-over-time mini chart, per the handoff's own
// "same shape, fed rank values instead of roll values" instruction) computes
// whatever real series it needs the same way the full-size charts already do
// (filteredCount/profileToFilterableDataForPeriod, or rankAcrossPeriods), and this
// component only ever draws it -- one real line-drawing implementation, not a
// second bespoke mini-chart per caller.
//
// null values are genuinely missing data (RollTrendsChart's own established
// convention -- ageGenderCountsByPeriod.has(p) ? ... : null), not zero -- gaps are
// skipped (the line breaks, doesn't dip to the axis), matching every other chart in
// this codebase's own "absence isn't a real zero" discipline.

const WIDTH = 120;
const HEIGHT = 32;
const PAD_Y = 4;

export default function Sparkline({ values, colour }: { values: (number | null)[]; colour: string }) {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return null;

  const min = Math.min(...real);
  const max = Math.max(...real);
  const span = max - min;

  const xStep = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  const yFor = (v: number) => {
    if (span === 0) return HEIGHT / 2;
    const t = (v - min) / span;
    return HEIGHT - PAD_Y - t * (HEIGHT - PAD_Y * 2);
  };

  // Real gaps (a period with no data for this school) split the line into separate
  // segments, rather than drawing a straight line across the gap -- same "absence
  // isn't a real zero, don't imply continuity across it" principle as every other
  // chart here.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: i * xStep, y: yFor(v) });
  });
  if (current.length > 0) segments.push(current);

  const dots = values
    .map((v, i) => (v !== null ? { x: i * xStep, y: yFor(v) } : null))
    .filter((p): p is { x: number; y: number } => p !== null);
  const firstDot = dots[0];
  const lastDot = dots[dots.length - 1];

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block">
      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={colour}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {firstDot && <circle cx={firstDot.x} cy={firstDot.y} r={1.75} fill={colour} opacity={0.5} />}
      {lastDot && <circle cx={lastDot.x} cy={lastDot.y} r={2.25} fill={colour} />}
    </svg>
  );
}
