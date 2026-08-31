import { Card, CardHeading } from "./Card";

// "Current state of the school" free narrative block (state-of-school narrative
// spec v1, built 2026-08-31) -- the eight topic sentences from src/lib/narrative.ts,
// rendered in spec order. Each topic is independently nullable (a school with no
// boarding provision, or with 4b's gender-variation clause not firing, simply omits
// that paragraph) -- callers pass only the strings that actually rendered.
export function CurrentStateNarrative({ paragraphs }: { paragraphs: (string | null)[] }) {
  const real = paragraphs.filter((p): p is string => p !== null);
  if (real.length === 0) return null;
  return (
    <Card size="full">
      <CardHeading title="Current state of the school" subtitle="A snapshot from the most recent DfE census and GIAS figures -- no trend data, no history." />
      <div className="flex flex-col gap-3">
        {real.map((p, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-stone-700 dark:text-stone-300">
            {p}
          </p>
        ))}
      </div>
    </Card>
  );
}
