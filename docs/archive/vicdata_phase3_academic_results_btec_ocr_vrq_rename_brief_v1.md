# Rename the "BTec & OCR" pill to "BTec, OCR, VRQ"

Small, scoped change following the VRQ-into-btec_ocr round. Guy's call: now that VRQ genuinely sits inside this bucket (entries-wise), the pill's own name should say so rather than implying it's still just Pearson BTEC and OCR Cambridge Technical.

## What to change

The only real user-facing occurrence is `KS5_BUCKET_LABEL.btec_ocr` in `dfe-qualification-buckets.ts` (`"BTec & OCR"` → `"BTec, OCR, VRQ"`). This is the single source used everywhere the pill renders (the TYPE row, any comparator/legend text, tooltips built from it) — confirm it really is the only place, don't assume.

Leave `bucket_ocr`'s internal key name (`btec_ocr`) alone — this is a display-label change only, not a rename of the bucket identifier itself, so no `bucketFor()` logic, database column, or measure key changes.

A few in-code comments reference "BTec & OCR" as prose (`AcademicDataView.tsx`, `dfe-qualification-buckets.ts`) — update these too for consistency while you're in the file, but they're not user-facing and not the priority.

## Verify

- The new label renders correctly in the TYPE row pill, at both its default and active/selected states.
- Check the pill still fits its existing layout at the new, longer length — this file has flagged responsive/wrapping concerns before (`flex-wrap` on the pill row), so confirm nothing overflows or wraps awkwardly, especially alongside the other four pills (A-level / IB / T Level / Other) and the "All" reset pill from the qualification-row UX round, if that's landed by the time this runs.
- The partial-coverage note (the one that now renders for this bucket, from the VRQ round) still reads sensibly with the new label in context.

## Deliverable

The rename, verified rendering and layout, confirmation no other real user-facing string still says "BTec & OCR". Commit and push.
