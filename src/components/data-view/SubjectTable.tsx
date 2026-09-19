"use client";

// Round 2, Part C: the subject-level table (spec §6), folded into Graphs' Overview via
// the Subject picker rather than a separate page/section. Entries shown when known,
// with the small-cohort caveat per real row (MINIMUM_SUBJECT_N).
//
// Subject deep-dive round: extracted from AcademicGraphsView.tsx into its own file so
// SubjectDeepDiveDrawer.tsx can reuse it rather than rebuilding it.
//
// Value-added removal round: this table used to carry a KS5-only "Value-added" column,
// rendering each real qualification/size-weight row with its confidence interval. That
// whole column is gone. Value-added is deferred to its own future tab, alongside a
// similarly-scoped destinations tab, rather than sitting half-populated inside the main
// academic views -- it is KS5-only and modern-years-only, so many institutions and
// courses never had a figure at all. The raw DfE ingest is deliberately untouched and
// still collecting, ready for that tab.
import { MINIMUM_SUBJECT_N, type SubjectEntry } from "@/lib/academic-data-view";
import { academicYearLabel } from "./TrendPill";

export default function SubjectTable({
  subject,
  schoolName,
  entryRow,
}: {
  subject: string;
  schoolName: string;
  entryRow: SubjectEntry | null;
  // ksStage is no longer read: it only ever gated the value-added column. Kept off the
  // signature entirely rather than accepted and ignored.
}) {
  if (entryRow === null) {
    return <p className="text-sm text-neutral-500">No real data for {subject} at {schoolName}.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-400 dark:border-neutral-800">
            <th className="px-3 py-2 text-left font-normal">Qualification</th>
            <th className="px-3 py-2 text-right font-normal">Entries</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-900">
            <td className="px-3 py-2">
              {entryRow.qualificationType} — {academicYearLabel(entryRow.period)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {entryRow.entries}
              {entryRow.entries < MINIMUM_SUBJECT_N && <span className="ml-1 text-amber-600 dark:text-amber-400">†</span>}
            </td>
          </tr>
        </tbody>
      </table>
      {entryRow.entries < MINIMUM_SUBJECT_N && (
        <p className="border-t border-neutral-200 px-3 py-2 text-xs text-amber-700 dark:border-neutral-800 dark:text-amber-400">
          † Fewer than {MINIMUM_SUBJECT_N} pupils took this subject at {schoolName} — too few to show a meaningful grade breakdown.
        </p>
      )}
    </div>
  );
}
