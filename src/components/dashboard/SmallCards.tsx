// The remaining, simpler cards -- one file rather than one-file-per-card since each
// is small and shares the same eyebrow-only heading shape. Still genuinely
// independent components (each takes its own props, renders its own Card), not
// fragments of a shared layout.

import { Card, Eyebrow, Caption } from "./Card";
import type { ShapeLabel } from "@/lib/shape-classifier";
import { TAG_COLOURS } from "@/lib/tag-colours";

// Layout/graphs spec v1 §6, round 3: boarding/day pie chart, TAG_COLOURS.Boarding
// (coral) / .Day (sky) used directly -- light[1] values only, matching RollCard's own
// sector-donut precedent. This round's colour-consistency fix (§5) explicitly scoped
// light/dark CSS-custom-property theme branching to GenderSplitCard alone; this donut
// and RollCard's stay light-only for now, same known gap, not fixed in this round.
const BOARDING_COLOUR = TAG_COLOURS.Boarding.light[1];
const DAY_COLOUR = TAG_COLOURS.Day.light[1];

function boardingDonut(boardingPct: number): string {
  return `conic-gradient(${BOARDING_COLOUR} 0% ${boardingPct}%, ${DAY_COLOUR} ${boardingPct}% 100%)`;
}

// Renders unconditionally for every school (round 3, §6) -- a day-only school is
// boarders=0/day=totalRoll (page.tsx's own call site falls back to this when
// roll.boarding itself is null), which renders as a plain sky-coloured circle at 0%
// boarding, not a missing/blank state.
export function BoardingCard({ boarders, day }: { boarders: number; day: number }) {
  const total = boarders + day;
  const boardingPct = total > 0 ? (boarders / total) * 100 : 0;
  return (
    <Card size="small">
      <Eyebrow>Boarding</Eyebrow>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 rounded-full" style={{ background: boardingDonut(boardingPct) }} />
        <p className="text-[14px] text-stone-800 dark:text-stone-200">
          {boarders.toLocaleString()} boarders, {day.toLocaleString()} day pupils
        </p>
      </div>
      {/* Never colour alone (same discipline TAG_COLOURS' own header comment and
          RollCard's legend list already follow) -- the percentages restate what the
          donut shows, keyed to the same two swatches. */}
      <div className="mt-2.5 flex flex-col gap-1 text-[12px] text-stone-600 dark:text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: BOARDING_COLOUR }} />
          Boarding — {boardingPct.toFixed(0)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: DAY_COLOUR }} />
          Day — {(100 - boardingPct).toFixed(0)}%
        </span>
      </div>
      <Caption className="mt-2">DfE census boarding headcount, same period as the roll above.</Caption>
    </Card>
  );
}

// Layout/graphs spec v1 §7, round 3: this school's boarders as a share of every
// boarder at every school in the LA (all sectors combined, no sector split -- Guy's
// explicit instruction). Denominator is roll_aggregates.boarders_total, the
// already-precomputed LA-level aggregate confirmed to exist in round 2's discovery
// pass -- see page.tsx's own call-site comment for where laBoardersTotal comes from.
// Gated at the call site to schools with real boarders of their own; never rendered
// for a day-only school.
export function LaBoardersCard({
  boarders,
  laBoardersTotal,
  laName,
}: {
  boarders: number;
  laBoardersTotal: number;
  laName: string;
}) {
  const pct = (boarders / laBoardersTotal) * 100;
  return (
    <Card size="small">
      <Eyebrow>Boarders in {laName}</Eyebrow>
      <p className="text-[14px] text-stone-800 dark:text-stone-200">
        <strong className="text-stone-900 dark:text-stone-100">{pct.toFixed(1)}%</strong> of all boarders in {laName}{" "}
        board here.
      </p>
      <Caption className="mt-1">
        {boarders.toLocaleString()} of {laBoardersTotal.toLocaleString()} boarders across every school in the Local
        Authority — DfE census, all sectors combined.
      </Caption>
    </Card>
  );
}

// SurroundingSchoolsCard used to live here (free-tier prose summary + "combined
// shape is X" + member-gated caption + named list). Layout/graphs spec v1 §11, round
// 5: moved wholesale into ShapeCard.tsx's right-hand "Nearest matched schools" slot,
// replacing AggregateShapeChart there -- not duplicated, this function no longer
// exists as a separate page card. See ShapeCard.tsx's own comment for where the
// content landed and page.tsx for the prop wiring.

export function RegionalNationalCard({
  laName,
  regional,
  national,
}: {
  laName: string | null;
  regional: { schoolCount: number; totalRoll: number; shape: ShapeLabel | null } | null;
  national: { schoolCount: number; totalRoll: number; shape: ShapeLabel | null } | null;
}) {
  return (
    <Card size="small">
      <Eyebrow>Regional &amp; national context</Eyebrow>
      <div className="flex flex-col gap-2 text-[13px]">
        {regional && laName && (
          <div className="flex justify-between border-b border-stone-100 pb-1.5 dark:border-stone-800">
            <span className="text-stone-500 dark:text-stone-400">{laName}</span>
            <span className="text-stone-800 dark:text-stone-200">
              {regional.schoolCount} schools · {regional.totalRoll.toLocaleString()} pupils
            </span>
          </div>
        )}
        {national && (
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">England</span>
            <span className="text-stone-800 dark:text-stone-200">
              {national.schoolCount.toLocaleString()} schools · {national.totalRoll.toLocaleString()} pupils
            </span>
          </div>
        )}
      </div>
      <Caption className="mt-2.5">About the world, not about this school — free regardless of tier</Caption>
    </Card>
  );
}

export function IlrParticipationCard({
  eyebrow = "FE participation data (ILR)",
  total,
  period,
  girls,
  boys,
  // 2026-09-12, FE-sector build: "girls"/"boys" reads fine for the original Academy
  // 16-19/under-19 use of this card, but not for a 19+/adult participation stat --
  // adult male/female learners aren't "boys"/"girls". Defaults preserve the existing
  // card's exact wording for every call site that doesn't pass this.
  sexLabels = { female: "girls", male: "boys" },
  reason,
}: {
  eyebrow?: string;
  total: number;
  period: number;
  girls: number | null;
  boys: number | null;
  sexLabels?: { female: string; male: string };
  reason: string;
}) {
  return (
    <Card size="medium">
      <Eyebrow>{eyebrow}</Eyebrow>
      <p className="font-[family-name:var(--font-newsreader)] text-[32px] font-semibold leading-none text-stone-900 dark:text-stone-100">
        {total.toLocaleString()}
      </p>
      <p className="mt-1 text-[13px] text-stone-500 dark:text-stone-400">
        learners, {period}/{String(period + 1).slice(2)}
      </p>
      {girls !== null && boys !== null && (
        <p className="mt-2 text-[13px] text-stone-700 dark:text-stone-300">
          {girls.toLocaleString()} {sexLabels.female}, {boys.toLocaleString()} {sexLabels.male}
        </p>
      )}
      {/* 2026-09-13: DfE rounds every ILR-participation figure independently to the
          nearest 10 (confirmed live -- every value across dfe_fe_participation,
          _adult and _academy is a multiple of 10) -- real institutions' own published
          male/female split doesn't always sum to the published total as a result
          (~22-29% of institutions, checked across all three sources; City Lit 2025,
          urn 130401, is one real example: 15,380 + 6,570 = 21,950 against a published
          total of 21,960). Not a parsing bug and not a hidden third category -- every
          value here is the exact published DfE figure. Flagged only when it actually
          diverges, so the note never appears on the ~75% of cards that do sum. */}
      {girls !== null && boys !== null && girls + boys !== total && (
        <p className="mt-1 text-[11.5px] text-stone-400 dark:text-stone-600">
          DfE rounds each figure to the nearest 10 independently, so this split may not sum exactly to the total above.
        </p>
      )}
      <Caption className="mt-3">
        DfE&rsquo;s own experimental &ldquo;in development&rdquo; statistics (Individualised Learner Record) — not the DfE
        school census figure. A count of learners participating in further education courses across the academic year, not a
        single-day headcount, shown here because {reason}. Shown separately, never combined with the census figure — they
        measure different things.
      </Caption>
    </Card>
  );
}

export function NoCensusDataCard() {
  return (
    <Card size="full" ghost>
      <Caption>
        No DfE census roll data is available for this school — this is expected for standalone 6th-form/FE-corporation
        institutions (a confirmed, permanent gap until the academic-results topic is built), or for a very recently opened
        school.
      </Caption>
    </Card>
  );
}

export function ComingSoonCard({ title }: { title: string }) {
  return (
    <Card size="small" ghost>
      <Eyebrow muted>{title}</Eyebrow>
      <Caption>Coming soon</Caption>
    </Card>
  );
}
