// VicData 0.6.1 S3c: the series builder for a donut -- Context's Share: the focused subject's
// entries as a share of the compare-against group's own total (self-inclusive), the year
// Current shows; on Grade bands, the group's entries in the range, of all its graded entries.
//
// The figures are the ones SubjectPanels is handed (`donut`: the group's totals, or the
// band share) and draws today, formatted the same way. R-DONUT-COUNTS-ONLY: the host only
// enables it on entries, or bands with a range (shareApplies, teacher-view-measures.ts); off,
// or in a note state (no figure that year, a band with no range, no subjects), the host
// draws, as before.
import type { ViewSpec } from "@/catalogue/viewspec";
import type { SeriesFrame } from "./frames";
import type { ViewSeries } from "./series";
import { currentHeading } from "./subjects";

export function buildDonut(spec: ViewSpec, f: SeriesFrame): ViewSeries | null {
  if (spec.view.kind !== "donut" || f.kind !== "subjects") return null;
  const d = f.donut;
  if (!d || !d.enabled || f.currentBlocked || f.subjects.length === 0) return null;
  const i = f.state.latestIdx;
  const focused = f.subjects.find((s) => s.key === f.focus) ?? f.subjects[0];
  const share = d.share;
  const value = i < 0 ? null : share ? share.values[i] ?? null : focused ? focused.values[i] : null;
  const group = i >= 0 ? (share ? share.totals[i] : d.groupTotals[i]) ?? null : null;
  if (value === null || value === undefined || group === null || !(group > 0)) return null;
  const format = share?.format ?? f.measure.format;
  const cal = f.compareAgainstLabel;
  return {
    kind: "donut",
    heading: currentHeading(f),
    title: !cal
      ? null
      : share
        ? `Entries at ${share.label.toLowerCase()} as a proportion of graded entries in ${cal}`
        : `Entries in ${focused?.label ?? "this subject"} as a proportion of ${cal}`,
    leaf: {
      leaf: "donut",
      percent: (value / group) * 100,
      label: share?.label ?? focused?.label ?? "",
      groupLabel: d.groupLabel,
      valueLabel: format(value),
      ...(share?.otherLabel !== undefined ? { otherLabel: share.otherLabel } : {}),
      // The legend's second line is the rest of the group: its total less the focus.
      groupValueLabel: format(Math.max(0, group - value)),
      colour: focused?.colour ?? "var(--muted2)",
    },
  };
}
