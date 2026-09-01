import { Card, CardHeading, Caption } from "./Card";
import { TAG_COLOURS } from "@/lib/tag-colours";

// Layout/graphs spec v1 §5, round 3: colour-consistency wiring fix. The values here
// already matched TAG_COLOURS.Girls/.Boys (same as ShapeChart's gender bars), but only
// the light variant, via a plain inline conic-gradient -- never reacted to dark mode.
// Ported to the SAME scoped-<style> + CSS-custom-property pattern ShapeChart.tsx
// already uses (three blocks: base light, prefers-color-scheme dark, explicit
// data-theme="dark" override), so this donut now reacts to theme the same way the
// Shape chart's own gender bars already do.
const GIRLS_COLOUR = { light: TAG_COLOURS.Girls.light[1], dark: TAG_COLOURS.Girls.dark[1] };
const BOYS_COLOUR = { light: TAG_COLOURS.Boys.light[1], dark: TAG_COLOURS.Boys.dark[1] };

function Donut({ girls, boys, label }: { girls: number; boys: number; label: string }) {
  const total = girls + boys;
  const girlsPct = total > 0 ? (girls / total) * 100 : 0;
  const boysPct = total > 0 ? 100 - girlsPct : 0;
  return (
    <div className="gender-donut-root flex flex-col items-center gap-2">
      <div
        className="h-20 w-20 rounded-full"
        style={{ background: `conic-gradient(var(--girls) 0% ${girlsPct}%, var(--boys) ${girlsPct}% 100%)` }}
      />
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
      <style>{`
        .gender-donut-root {
          --girls: ${GIRLS_COLOUR.light};
          --boys: ${BOYS_COLOUR.light};
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .gender-donut-root {
            --girls: ${GIRLS_COLOUR.dark};
            --boys: ${BOYS_COLOUR.dark};
          }
        }
        :root[data-theme="dark"] .gender-donut-root {
          --girls: ${GIRLS_COLOUR.dark};
          --boys: ${BOYS_COLOUR.dark};
        }
      `}</style>
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
