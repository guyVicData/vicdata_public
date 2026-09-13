import Link from "next/link";
import { Card, Caption } from "./Card";
import {
  stageYears,
  stagesPresent,
  latestYear,
  headlineValueAt,
  HEADLINE_MEASURE,
  type AcademicSchoolProfile,
  type KsStage,
} from "@/lib/academic-data-view";

// Free State of School "Academic snapshot" card (frontend build brief §7, wording per
// summary-wordings doc §1). Snapshot only -- no trend, no comparator context, no map,
// matching the page's own governing rule (state-of-school-page spec §2). One line per
// key stage the school actually has, shown together; a key stage it doesn't have is
// simply omitted (no "N/A"), same discipline as every other gated section on this page.
// KS2 uses the same degraded raw-fact path as the rest of this topic's KS2 support --
// see academic-data-view.ts's own module comment.
function academicYear(period: number): string {
  return `${period}/${String(period + 1).slice(2)}`;
}

function sentenceFor(schoolName: string, stage: KsStage, period: number, value: number): string | null {
  switch (stage) {
    case "ks4":
      return `${schoolName}'s GCSE pupils achieved an average Attainment 8 score of ${value.toFixed(1)} in ${academicYear(period)}.`;
    case "ks5":
      return `${schoolName}'s A-level students achieved an average of ${value.toFixed(1)} UCAS points per entry in ${academicYear(period)}.`;
    case "ks2":
      return `${Math.round(value)}% of ${schoolName}'s Year 6 pupils met the expected standard in reading, writing and maths in ${academicYear(period)}.`;
  }
}

export function AcademicSnapshotCard({ profile, schoolName, urn }: { profile: AcademicSchoolProfile; schoolName: string; urn: string }) {
  const stages = stagesPresent(profile);
  const lines = stages
    .map((stage) => {
      const years = stageYears(profile, stage);
      const year = latestYear(years);
      if (!year) return null;
      const value = headlineValueAt(years, year.period, HEADLINE_MEASURE[stage]);
      if (value === null) return null;
      return sentenceFor(schoolName, stage, year.period, value);
    })
    .filter((s): s is string => s !== null);

  if (lines.length === 0) return null;

  return (
    <Card size="medium" className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Academic snapshot</div>
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-stone-700 dark:text-stone-300">
              {line}
            </p>
          ))}
        </div>
      </div>
      <Caption>
        <Link href={`/schools/${urn}/data`} className="underline">
          See how this compares — become a member.
        </Link>
      </Caption>
    </Card>
  );
}
