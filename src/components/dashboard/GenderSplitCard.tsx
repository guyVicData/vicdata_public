import { Card, CardHeading, Caption } from "./Card";
import { TAG_COLOURS } from "@/lib/tag-colours";

const GIRLS_COLOUR = TAG_COLOURS.Girls.light[1];
const BOYS_COLOUR = TAG_COLOURS.Boys.light[1];

function donut(girlsPct: number): string {
  return `conic-gradient(${GIRLS_COLOUR} 0% ${girlsPct}%, ${BOYS_COLOUR} ${girlsPct}% 100%)`;
}

function Donut({ girls, boys, label }: { girls: number; boys: number; label: string }) {
  const total = girls + boys;
  const girlsPct = total > 0 ? (girls / total) * 100 : 0;
  const boysPct = total > 0 ? 100 - girlsPct : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-20 w-20 rounded-full" style={{ background: donut(girlsPct) }} />
      <div className="text-center text-[12px] text-stone-500 dark:text-stone-400">
        {label}
        <br />
        <strong className="text-stone-900 dark:text-stone-100">
          {girlsPct.toFixed(0)}% girls · {boysPct.toFixed(0)}% boys
        </strong>
      </div>
    </div>
  );
}

export function GenderSplitCard({
  girls,
  boys,
  peer,
  peerLabel,
}: {
  girls: number;
  boys: number;
  peer: { girls: number; boys: number } | null;
  peerLabel: string;
}) {
  return (
    <Card size="medium" className="flex flex-col gap-4">
      <CardHeading
        title="Gender split"
        subtitle="Full roll, all ages — a different age range from the Shape chart above. Shown as a share, so it's comparable with the peer average."
      />
      <div className="flex gap-6">
        <Donut girls={girls} boys={boys} label="This school" />
        {peer && <Donut girls={peer.girls} boys={peer.boys} label="Peer average" />}
      </div>
      {peer && <Caption>{peerLabel}</Caption>}
    </Card>
  );
}
