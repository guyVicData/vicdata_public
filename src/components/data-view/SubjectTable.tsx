"use client";

// Round 2, Part C: the subject-level table (spec §6), folded into Graphs' Overview via
// the Subject picker rather than a separate page/section. Entries always shown when
// known; value-added shown per real qualification/size-weight row (KS5 only, from
// dfe_ks5_subject_value_added's own self-consistent entries_count), each with its real
// confidence interval, framed the same honest way the summary-wordings doc's own
// Progress 8 sentence template is -- never a bare score. Small-cohort caveat applies
// per real row (entries or value-added's own entries_count), using MINIMUM_SUBJECT_N.
//
// Subject deep-dive round: extracted from AcademicGraphsView.tsx into its own file so
// SubjectDeepDiveDrawer.tsx can reuse this exact real value-added rendering (per the
// frontend brief's own explicit instruction) rather than rebuilding it -- unchanged
// otherwise.
import { MINIMUM_SUBJECT_N, type KsStage, type SubjectEntry, type SubjectValueAdded } from "@/lib/academic-data-view";
import { academicYearLabel } from "./TrendPill";

export default function SubjectTable({
  subject,
  schoolName,
  entryRow,
  valueAddedRows,
  ksStage,
}: {
  subject: string;
  schoolName: string;
  entryRow: SubjectEntry | null;
  valueAddedRows: SubjectValueAdded[];
  ksStage: KsStage;
}) {
  const hasAnyData = entryRow !== null || valueAddedRows.length > 0;
  if (!hasAnyData) {
    return <p className="text-sm text-neutral-500">No real data for {subject} at {schoolName}.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-400 dark:border-neutral-800">
            <th className="px-3 py-2 text-left font-normal">Qualification</th>
            <th className="px-3 py-2 text-right font-normal">Entries</th>
            {ksStage === "ks5" && <th className="px-3 py-2 text-left font-normal">Value-added</th>}
          </tr>
        </thead>
        <tbody>
          {entryRow && (
            <tr className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="px-3 py-2">
                {entryRow.qualificationType} — {academicYearLabel(entryRow.period)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {entryRow.entries}
                {entryRow.entries < MINIMUM_SUBJECT_N && <span className="ml-1 text-amber-600 dark:text-amber-400">†</span>}
              </td>
              {ksStage === "ks5" && <td className="px-3 py-2 text-neutral-400">—</td>}
            </tr>
          )}
          {valueAddedRows.map((v, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-900">
              <td className="px-3 py-2">
                {v.qualificationType} (size {v.sizeWeight}) — {academicYearLabel(v.period)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {v.entriesCount ?? "—"}
                {v.entriesCount !== null && v.entriesCount < MINIMUM_SUBJECT_N && <span className="ml-1 text-amber-600 dark:text-amber-400">†</span>}
              </td>
              <td className="px-3 py-2">
                {v.valueAdded !== null && v.valueAddedLowerCi !== null && v.valueAddedUpperCi !== null
                  ? `${v.valueAdded > 0 ? "+" : ""}${v.valueAdded.toFixed(2)} (likely between ${v.valueAddedLowerCi > 0 ? "+" : ""}${v.valueAddedLowerCi.toFixed(2)} and ${v.valueAddedUpperCi > 0 ? "+" : ""}${v.valueAddedUpperCi.toFixed(2)} once normal year-to-year variation is accounted for)`
                  : "No real value-added figure for this row."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {((entryRow && entryRow.entries < MINIMUM_SUBJECT_N) || valueAddedRows.some((v) => v.entriesCount !== null && v.entriesCount < MINIMUM_SUBJECT_N)) && (
        <p className="border-t border-neutral-200 px-3 py-2 text-xs text-amber-700 dark:border-neutral-800 dark:text-amber-400">
          † Fewer than {MINIMUM_SUBJECT_N} pupils took this subject at {schoolName} — too few to show a meaningful grade breakdown.
        </p>
      )}
    </div>
  );
}
