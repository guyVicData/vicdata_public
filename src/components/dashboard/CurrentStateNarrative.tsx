import { Card, CardHeading } from "./Card";

// "Current state of the school" free narrative block (state-of-school narrative
// spec v1, built 2026-08-31) -- the eight topic sentences from src/lib/narrative.ts,
// rendered in spec order. Each topic is independently nullable (a school with no
// boarding provision, or with 4b's gender-variation clause not firing, simply omits
// that paragraph) -- callers pass only the strings that actually rendered.
//
// Layout/graphs spec v1 §4, round 3: full (12-col) -> medium (6-col), paired with a
// Roll/Gender split stack to its right in the page's own top row -- see page.tsx's
// own comment at the call site for why that pairing has to be built as sibling
// DashboardGrid children rather than nested here.
// 2026-09-17, FE-sector build: title/subtitle parametrized (defaults preserve the
// mainstream page's exact previous text) -- the FE-sector branch's own narrative
// (page.tsx) is built from DfE ILR/GIAS figures, not "the most recent DfE census",
// so the hardcoded mainstream subtitle would be a real factual error there, not just
// an aesthetic mismatch. The component itself stays generic/reusable, as before --
// no FE-specific logic lives here.
export function CurrentStateNarrative({
  paragraphs,
  title = "Current state of the school",
  subtitle = "A snapshot from the most recent DfE census and GIAS figures -- no trend data, no history.",
}: {
  paragraphs: (string | null)[];
  title?: string;
  subtitle?: string;
}) {
  const real = paragraphs.filter((p): p is string => p !== null);
  if (real.length === 0) return null;
  return (
    <Card size="medium">
      <CardHeading title={title} subtitle={subtitle} />
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
