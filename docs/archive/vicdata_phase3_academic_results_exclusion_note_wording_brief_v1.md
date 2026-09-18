# Fix the repeated-label wording in the exclusion note

Small, scoped wording change. Flagged in the `btec_ocr_vrq_rename_build_report_v1.md` and confirmed by Guy: the single-school exclusion sentence now reads awkwardly because the bucket label appears twice, and "BTec, OCR, VRQ" (the longest label, from the rename round) makes the repetition obvious for the first time:

> "Capital City College isn't shown in this BTec, OCR, VRQ comparison — it has no real BTec, OCR, VRQ entries recorded."

## Where this lives

`ks5BucketExclusionNote()` in `src/lib/academic-data-view.ts` (around line 468), current source:

```ts
export function ks5BucketExclusionNote(excludedNames: string[], bucket: Ks5Bucket): string | null {
  if (excludedNames.length === 0) return null;
  const label = KS5_BUCKET_LABEL[bucket];
  if (excludedNames.length === 1) {
    return `${excludedNames[0]} isn't shown in this ${label} comparison — it has no real ${label} entries recorded.`;
  }
  return `${excludedNames.length} schools aren't shown in this ${label} comparison — ${excludedNames.join(", ")}: none have real ${label} entries recorded.`;
}
```

Both branches repeat `${label}` — this isn't unique to `btec_ocr`, it's the shared template every bucket (A-level, IB, T Level, Other, BTec/OCR/VRQ) renders through. The fix has to read well for all of them, not just the one that made it visible.

## What to change

Drop the label from the first clause and keep it only in the second, where it's actually informative (it says what's missing, not just that something's missing):

```ts
  if (excludedNames.length === 1) {
    return `${excludedNames[0]} isn't shown in this comparison — it has no real ${label} entries recorded.`;
  }
  return `${excludedNames.length} schools aren't shown in this comparison — ${excludedNames.join(", ")}: none have real ${label} entries recorded.`;
```

This is a suggestion, not a mandate — if a different rewording reads better once you see it in context (e.g. rendered in the comparator UI, alongside `ks5BucketWholeGroupSentence` which doesn't have this problem and shouldn't change), use your judgement. The only real requirement: the label shouldn't appear twice in one sentence, and the sentence still has to make sense standing alone for every bucket, not just BTec/OCR/VRQ.

## Verify

- Render (or trace) the single-school and multi-school cases for at least two buckets — BTec, OCR, VRQ (longest label, the one that surfaced this) and A-level (shortest, so confirm the shorter sentence doesn't now read oddly-terse).
- Confirm `ks5BucketWholeGroupSentence` is untouched — it's a different function with a different sentence shape and doesn't have this repetition.

## Deliverable

The reworded sentence(s), quick confirmation it reads correctly across buckets. Commit and push.
