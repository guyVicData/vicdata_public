// The remaining, simpler cards -- one file rather than one-file-per-card since each
// is small and shares the same eyebrow-only heading shape. Still genuinely
// independent components (each takes its own props, renders its own Card), not
// fragments of a shared layout.

import { Card, Eyebrow, Caption } from "./Card";
import { ShapeIcon, SHAPE_LABELS } from "./ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import SurroundingSchoolsMemberList from "@/components/SurroundingSchoolsMemberList";

export function BoardingCard({ boarders, day }: { boarders: number; day: number }) {
  return (
    <Card size="small">
      <Eyebrow>Boarding</Eyebrow>
      <p className="text-[14px] text-stone-800 dark:text-stone-200">
        {boarders.toLocaleString()} boarders, {day.toLocaleString()} day pupils
      </p>
      <Caption className="mt-1">DfE census boarding headcount, same period as the roll above.</Caption>
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
