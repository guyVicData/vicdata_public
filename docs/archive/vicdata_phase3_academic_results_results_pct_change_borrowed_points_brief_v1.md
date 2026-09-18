# Results % change is leaking A-level points under non-A-level TYPE selections

Found via Guy's own live review of Sevenoaks School (URN 118952, TYPE = IB) on the Graphs page's Subjects section (`SubjectAreaSection.tsx`, category mode). Real, precise root cause traced directly in the source — not a data-quality issue and not the bigger "category mode has no real per-bucket points" gap already flagged in this file's own comments. A smaller, specific inconsistency between two sibling computations that should both obey the same suppression rule, and only one of them does.

## What's actually happening (confirmed, not guessed)

`categoryPointsUnavailable` (already correctly computed: `bucketActive && ks5Bucket !== "alevel" && categoryMode`) exists specifically because `academic_subject_family_rollup`'s points figure is always A-level-only, with no bucket dimension — so showing it under TYPE = IB/BTec,OCR,VRQ/T-Level/Other would silently display an A-level number as if it were that bucket's own score. `withoutBorrowedPoints()` correctly nulls both `results` and `resultsPctChange` on every row this gate should cover, and `resultComparisonItems` (the "Results, 2024/25" card) correctly reads from `comparatorRowsByUrn`, which has already had this suppression applied — so the current-value card correctly shows "No real results figure..." for both Sevenoaks and its comparator set under TYPE = IB. That part is working exactly as designed.

`resultsTrendComparisonItems` (the "Results, % change" card, comparator side) does NOT go through the same suppressed data for its default "Average across set" case:

```ts
const resultsTrendComparisonItems = order.map((id) => ({
  id,
  label: labelById.get(id) ?? id,
  pctChange: selectedRows
    ? (selectedRows.find((r) => r.id === id)?.resultsPctChange ?? null)
    : categoryMode
      ? aggregateFamilyTrend(comparableGroup, stage, id, (y) => y.avgPointScore, average)
      : aggregateSubjectTrend(comparatorRowsByUrn, id, (r) => (r.resultsPctChange !== null ? r.results : null), average),
}));
```

When no specific comparator school is selected (the default state — exactly what Guy was looking at, "Boarding schools nationally (by boarding population)", confirmed a real ~60-school quintile-matched comparableGroup, not a precomputed aggregate, in `default-comparator-lists.ts`), the categoryMode branch calls `aggregateFamilyTrend(comparableGroup, stage, id, (y) => y.avgPointScore, average)` — reading `avgPointScore` straight off each profile's raw `familyYearsFor` history, completely bypassing `comparatorRowsByUrn` and therefore bypassing `withoutBorrowedPoints`/`categoryPointsUnavailable` entirely. That's a real, genuine A-level points trend, silently shown under the "Results, % change" card while TYPE = IB is selected — directly contradicting the current-value card right above it, which correctly says there's no real figure at all.

This is why Guy saw exactly the combination he reported: "Results, 2024/25" honestly empty for both sides, but "Results, % change" showing real data for the comparator side specifically — the comparator's default-aggregate branch is the one path that isn't gated.

Contrast with the candidates-trend comparison, right above this in the same file, which is correctly NOT gated (entries are legitimately bucket-scoped already, at a different point in the pipeline, and were never part of `withoutBorrowedPoints`'s suppression in the first place — this one is fine, don't touch it):

```ts
categoryMode
  ? aggregateFamilyTrend(comparableGroup, stage, id, (y) => (y.entriesTotal > 0 ? y.entriesTotal : null), sum)
```

## What to fix

Make `resultsTrendComparisonItems`'s default-aggregate branch respect `categoryPointsUnavailable` the same way `resultComparisonItems` already does — either by gating the call directly (`categoryPointsUnavailable ? null : aggregateFamilyTrend(...)`) or by having it read through the already-suppressed `comparatorRowsByUrn` data instead of `comparableGroup` raw profiles directly, whichever is the smaller, more consistent fix once you're looking at it alongside `aggregateFamilyTrend`'s own signature. Don't touch the candidates-trend line above it, and don't touch the `selectedRows` branch (a specifically-selected single comparator already correctly reads the suppressed `resultsPctChange` off `comparatorRowsByUrn`).

Check the KS4 subject-mode equivalent (`aggregateSubjectTrend(comparatorRowsByUrn, id, (r) => (r.resultsPctChange !== null ? r.results : null), average)`, a few lines below) — this one already reads through `comparatorRowsByUrn`, so it may already be correctly gated (the comment right above it claims the omission is "enforced by the DATA, not a separate mode check"), but confirm that directly rather than assuming the comment is still accurate after your fix.

Also check the two other places the same "Not enough real history to compute growth/decline" message exists — `Ks2DomainSection.tsx` and `SubjectDeepDiveDrawer.tsx` — for the same class of bug (a current-value suppression that isn't mirrored in the corresponding %-change computation). Don't assume they have it; confirm either way and report which.

## What NOT to build this round

The bigger, already-flagged gap — giving category mode a genuine, real per-bucket points figure (so TYPE = IB would show an honest IB-scored category breakdown instead of suppressing to nothing) — needs `academic_subject_family_rollup` itself to gain a bucket dimension, a real structural build on the scale of the last IB round, not a small fix. Out of scope here; this brief is only about making the existing suppression consistent, not about removing the suppression.

## Verify

- Sevenoaks School (URN 118952), TYPE = IB, category mode: confirm both "Results, 2024/25" and "Results, % change" now show the honest unavailable-message on both the school side and the comparator side ("Boarding schools nationally (by boarding population)"), with no default-aggregate leak.
- Confirm TYPE = A-level (or no TYPE filter) is completely unaffected — `categoryPointsUnavailable` is false there, so both cards should still show real data exactly as before, on both sides, default-aggregate included.
- Spot-check TYPE = BTec, OCR, VRQ and T Level at a real school with real entries in one of those buckets, to confirm the fix generalises rather than being IB-specific.

## Deliverable

Confirmation of the exact root cause (re-verified independently, not just re-asserted from this brief), the fix applied, the KS4/Ks2/drawer check and its result, and the verification above. Commit and push.
