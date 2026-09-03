import Link from "next/link";
import { Card, CardDivider, Caption, StatNumber } from "./Card";
import type { LaSectorComposition } from "@/lib/la-sector-composition";
import { TAG_COLOURS } from "@/lib/tag-colours";
import { paragraph2SectorSize } from "@/lib/narrative";

// Layout/graphs spec v1 §5, round 3: wiring fix, not a recolour -- this card
// previously defined its own local sector hex values here, which had drifted from
// TAG_COLOURS' own State/Independent/FE (used everywhere else on this page, including
// this school's own TypologyTags pills in the header above). Now reads directly from
// the shared registry instead of a second, conflicting copy. Light[1] values only,
// same as before -- no dark-mode branching added here (round 3 explicitly scoped that
// to GenderSplitCard alone).
const SECTOR_COLOUR: Record<string, string> = {
  State: TAG_COLOURS.State.light[1],
  Independent: TAG_COLOURS.Independent.light[1],
  FE: TAG_COLOURS.FE.light[1],
};

function donutGradient(bySector: LaSectorComposition["bySector"], total: number): string {
  if (total <= 0) return "conic-gradient(#e7e2d9 0% 100%)";
  let acc = 0;
  const stops: string[] = [];
  for (const sector of ["State", "Independent", "FE"] as const) {
    const pupils = bySector[sector].pupils;
    if (pupils <= 0) continue;
    const start = (acc / total) * 100;
    acc += pupils;
    const end = (acc / total) * 100;
    stops.push(`${SECTOR_COLOUR[sector]} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export function RollCard({
  totalRoll,
  period,
  laComposition,
  laSchoolCount,
  laTotalRoll,
  schoolName,
}: {
  totalRoll: number;
  period: number;
  laComposition: LaSectorComposition | null;
  // 2026-09-10, round 16: the SAME LA all-sector figures RegionalNationalCard already
  // reads (context.regional.school_count/total_roll, page.tsx) -- duplicated here, not
  // moved, RegionalNationalCard is untouched. Null whenever the LA has no regional
  // aggregate row at all (context.regional itself null), same as laBoardersTotal
  // elsewhere on this page.
  laSchoolCount: number | null;
  laTotalRoll: number | null;
  // 2026-09-10, round 16: needed for the sector-share sentence below, which now calls
  // narrative.ts's own paragraph2SectorSize directly (the exact sentence already used
  // in the page's main narrative paragraph) instead of a hand-written near-duplicate.
  schoolName: string;
}) {
  const sectorSentence = paragraph2SectorSize(schoolName, laComposition, null);

  return (
    <Card size="medium" className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Roll</div>
        <div className="flex items-baseline gap-2.5">
          <StatNumber>{totalRoll.toLocaleString()}</StatNumber>
          <span className="text-[13px] text-stone-500 dark:text-stone-400">
            pupils, {period}/{String(period + 1).slice(2)}
          </span>
        </div>
      </div>

      {laComposition && laComposition.totalPupils > 0 && (
        <>
          <CardDivider />
          <div>
            <h3 className="mb-2 font-[family-name:var(--font-newsreader)] text-[15px] font-medium text-stone-900 dark:text-stone-100">
              Where this school sits locally
            </h3>
            {laSchoolCount !== null && laTotalRoll !== null && (
              <p className="mb-3 text-[13px] leading-relaxed text-stone-700 dark:text-stone-300">
                There are {laSchoolCount.toLocaleString()} schools in {laComposition.laName}, with{" "}
                {laTotalRoll.toLocaleString()} pupils between them.
              </p>
            )}
            <div className="flex items-center gap-5">
              <div
                className="h-24 w-24 shrink-0 rounded-full"
                style={{ background: donutGradient(laComposition.bySector, laComposition.totalPupils) }}
              />
              <div className="flex flex-col gap-1.5">
                {(["State", "Independent", "FE"] as const).map((sector) => {
                  const pct = (laComposition.bySector[sector].pupils / laComposition.totalPupils) * 100;
                  return (
                    <div key={sector} className="flex items-center gap-2 text-[13px] text-stone-700 dark:text-stone-300">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTOR_COLOUR[sector] }} />
                      {sector === "FE" ? "FE / Technical" : sector} — {pct.toFixed(0)}%
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {sectorSentence && (
            <>
              <CardDivider />
              <Caption>{sectorSentence}</Caption>
            </>
          )}
          <Caption className="italic">
            Schooling across {laComposition.laName}, by sector — not a comparison of this school&rsquo;s own size. Source:{" "}
            <Link href="/sources" className="underline hover:text-stone-700 dark:hover:text-stone-300">
              GIAS
            </Link>
            , the Department for Education&rsquo;s school register, a different snapshot from the pupil figures above.
          </Caption>
        </>
      )}
    </Card>
  );
}
