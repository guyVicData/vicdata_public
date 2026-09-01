// The remaining, simpler cards -- one file rather than one-file-per-card since each
// is small and shares the same eyebrow-only heading shape. Still genuinely
// independent components (each takes its own props, renders its own Card), not
// fragments of a shared layout.

import { Card, Eyebrow, Caption } from "./Card";
import { ShapeIcon, SHAPE_LABELS } from "./ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import SurroundingSchoolsMemberList from "@/components/SurroundingSchoolsMemberList";
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

export function SurroundingSchoolsCard({
  urn,
  summary,
  aggregateShape,
  found,
}: {
  urn: string;
  summary: string | null;
  aggregateShape: ShapeLabel | null;
  found: number;
}) {
  return (
    <Card size="medium">
      <Eyebrow>Surrounding schools</Eyebrow>
      {found > 0 && summary ? (
        <>
          <p className="text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-300">
            {summary}
            {aggregateShape && (
              <>
                {" "}
                The combined shape is{" "}
                <span className="inline-flex items-center gap-1 align-text-bottom font-semibold">
                  <ShapeIcon shape={aggregateShape} size={14} /> {SHAPE_LABELS[aggregateShape]}
                </span>
                .
              </>
            )}
          </p>
          <Caption className="mt-2.5">The {found} schools behind this comparison are visible to verified members.</Caption>
          <SurroundingSchoolsMemberList urn={urn} />
        </>
      ) : (
        <Caption>Not enough nearby comparable schools with roll data to show this yet.</Caption>
      )}
    </Card>
  );
}

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
  total,
  period,
  girls,
  boys,
  reason,
}: {
  total: number;
  period: number;
  girls: number | null;
  boys: number | null;
  reason: string;
}) {
  return (
    <Card size="medium">
      <Eyebrow>FE participation data (ILR)</Eyebrow>
      <p className="font-[family-name:var(--font-newsreader)] text-[32px] font-semibold leading-none text-stone-900 dark:text-stone-100">
        {total.toLocaleString()}
      </p>
      <p className="mt-1 text-[13px] text-stone-500 dark:text-stone-400">
        learners, {period}/{String(period + 1).slice(2)}
      </p>
      {girls !== null && boys !== null && (
        <p className="mt-2 text-[13px] text-stone-700 dark:text-stone-300">
          {girls.toLocaleString()} girls, {boys.toLocaleString()} boys
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
