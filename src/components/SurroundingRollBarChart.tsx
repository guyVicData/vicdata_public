// Layout/graphs spec v1 §12, round 5: one bar per school in the nearest-matched
// comparison set, showing roll size. Peer schools stay grey and numbered (not named --
// same free-tier "never a named school without membership" rule surrounding-schools.ts
// and SurroundingSchoolsMemberList.tsx already enforce elsewhere in this exact
// module); the focus school is named and coloured distinctly. Static SVG, no client
// JS needed -- exact headcounts are available on hover via native <title> tooltips
// rather than a stateful hover readout (ShapeChart's own pattern), since this chart's
// only interactive need is "the precise number," not a per-row detail panel.
//
// PEER_COLOUR reuses AggregateShapeChart's own "anonymous aggregate" grey (#a3a3a3) --
// same meaning, same value, even though that chart no longer shares this card (see
// ShapeCard.tsx's own comment). FOCUS_COLOUR reuses PhaseBreakdownCard's ACTIVE_BG
// (#a97a1f) -- the same "this one, not the muted field around it" role, just applied
// to a different chart. Light-mode-only fill, matching the round-3/4 precedent of not
// expanding dark-mode CSS-custom-property branching beyond what's explicitly asked
// (RollCard's sector donut and BoardingCard's pie chart both stayed light-only too).
const FOCUS_COLOUR = "#a97a1f";
const PEER_COLOUR = "#a3a3a3";

const WIDTH = 320;
const BAR_GAP = 5;
const CHART_HEIGHT = 84;
const LABEL_HEIGHT = 14;

export default function SurroundingRollBarChart({
  focusName,
  focusRoll,
  peerRolls,
}: {
  focusName: string;
  focusRoll: number;
  peerRolls: number[];
}) {
  const bars = [
    { label: "This school", roll: focusRoll, isFocus: true, title: `${focusName}: ${focusRoll.toLocaleString()} pupils` },
    ...peerRolls.map((roll, i) => ({
      label: String(i + 1),
      roll,
      isFocus: false,
      title: `Matched school ${i + 1}: ${roll.toLocaleString()} pupils`,
    })),
  ];
  if (bars.every((b) => b.roll === 0)) return null;

  const maxRoll = Math.max(1, ...bars.map((b) => b.roll));
  const barWidth = (WIDTH - BAR_GAP * (bars.length - 1)) / bars.length;

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${WIDTH} ${CHART_HEIGHT + LABEL_HEIGHT}`} className="w-full max-w-[320px]">
        {bars.map((b, i) => {
          const h = maxRoll > 0 ? (b.roll / maxRoll) * CHART_HEIGHT : 0;
          const x = i * (barWidth + BAR_GAP);
          const y = CHART_HEIGHT - h;
          return (
            <g key={i}>
              <title>{b.title}</title>
              <rect x={x} y={y} width={barWidth} height={h} rx={2} fill={b.isFocus ? FOCUS_COLOUR : PEER_COLOUR} />
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT + 11}
                fontSize={8.5}
                textAnchor="middle"
                fill="#737373"
                fontWeight={b.isFocus ? 700 : 400}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-neutral-400">
        Roll size, <strong style={{ color: FOCUS_COLOUR }}>{focusName}</strong> vs. the {peerRolls.length} nearest matched
        schools (numbered, not named at this tier — hover a bar for the exact figure).
      </p>
    </div>
  );
}
