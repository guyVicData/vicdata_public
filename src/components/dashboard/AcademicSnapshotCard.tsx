import Link from "next/link";
import { Card, Caption } from "./Card";
import {
  stageYears,
  stagesPresent,
  latestYear,
  headlineValueAt,
  igcseExclusionLikely,
  ks4ExclusionTargetSentence,
  dominantKs5Cohort,
  ks5HeadlineMeasureKey,
  ks5HeadlineSentence,
  HEADLINE_MEASURE,
  type AcademicSchoolProfile,
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

function sentenceFor(schoolName: string, stage: "ks4" | "ks2", period: number, value: number): string {
  return stage === "ks4"
    ? `${schoolName}'s GCSE pupils achieved an average Attainment 8 score of ${value.toFixed(1)} in ${academicYear(period)}.`
    : `${Math.round(value)}% of ${schoolName}'s Year 6 pupils met the expected standard in reading, writing and maths in ${academicYear(period)}.`;
}

// KS5 qualification-type-awareness round, Part 3: replaces the old hardcoded
// "A-level students achieved..." line (which showed a near-empty/misleading figure
// for any school whose KS5 cohort isn't mostly A-level -- the reported bug) with the
// school's own real dominant cohort, honestly labelled (summary-wordings doc §13,
// supersedes §1's own ks5 sentence).
function ks5SentenceFor(profile: AcademicSchoolProfile, schoolName: string): string | null {
  const cohort = dominantKs5Cohort(profile);
  if (!cohort) return null;
  const year = latestYear(profile.ks5);
  if (!year) return null;
  const value = headlineValueAt(profile.ks5, year.period, ks5HeadlineMeasureKey(cohort));
  if (value === null) return null;
  return ks5HeadlineSentence(schoolName, cohort, profile.ks5QualTypes.ib, value, year.period);
}

export function AcademicSnapshotCard({ profile, schoolName, urn }: { profile: AcademicSchoolProfile; schoolName: string; urn: string }) {
  const stages = stagesPresent(profile);
  // GCSE exclusion round (supersedes stage-1's caveat-alongside-a-number Part D): a
  // real DfE methodology exclusion, not a data gap -- see academic-data-view.ts's own
  // igcseExclusionLikely for the evidence/trigger. The GCSE line is left out entirely
  // (not shown with a caveat underneath), replaced by §11's own sentence. "below" is
  // literal here -- stagesPresent's own fixed ks2/ks4/ks5 order means a real KS5 line
  // renders directly under this one on the same card whenever ks5 data exists.
  const ks4Excluded = igcseExclusionLikely(profile);
  const lines = stages
    .map((stage) => {
      if (stage === "ks4" && ks4Excluded) return ks4ExclusionTargetSentence(schoolName, stages.includes("ks5"));
      if (stage === "ks5") return ks5SentenceFor(profile, schoolName);
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
