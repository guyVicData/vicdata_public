# GCSE Results — subject-level national comparison anchor (dashboard, KS4) — build report

Covers `vicdata_phase3_gcse_subject_level_england_average_frontend_brief_v1.md`. Consumes the backend round's `academic_subject_geography_lookup` (vicdata repo, backend build report of the same name), using the confirmed contract as given.

Untouched: `englandAverages()`'s KS5 branch, `englandFor()`'s bucket branch, `comparabilityKey()`, the Round 5 column axes (`AXES`), and `academic_geography_lookup`/`lookupAcademicGeography()` (still the KS5 and whole-school source).

## Changes

1. **`src/lib/vicdata-reference.ts`** — new `AcademicSubjectGeographyRow` type (the RPC's ten return columns) and `lookupAcademicSubjectGeography()`, modelled on `lookupAcademicGeography()`: same paged `fetchPage` loop, same parameters, with `subject` and `familyId` filters, calling `academic_subject_geography_lookup`.
2. **`src/app/api/teacher/dashboard/route.ts`** — `englandAverages()`'s KS4 branch now reads the subject-grain lookup (national, England, `avg_point_score`), keyed by `subject`. The basis is renamed `"family"` → `"subject"` in the function's return type. The header comment now says the GCSE anchor is per subject, and why: the 2026-09-21 backend round's subject-grain aggregate.
3. **`src/app/teacher/[phase]/page.tsx`**
   - The `englandAvg` state type is `"bucket" | "subject"`.
   - `englandFor()` keys the non-bucket branch by `item.subject`. The RPC spells subjects exactly as the headline rows do, so no translation is needed.
   - `resultsFor()` no longer returns `familyId`: `englandFor()` was its only reader (checked; the other `familyId` in the file is the picker's own field).
   - Results card caption: "…vs. the England GCSE average for that subject."
   - Onboarding Step 3 delta line: "…the England GCSE average for this subject."
   - **One beyond the brief's list, flagged:** onboarding Step 3's intro still said "…against the England GCSE average for each subject's family". Its figures switch to subject level automatically (it reuses `resultsFor`/`englandFor`), so that sentence would have become wrong. It now reads "…for each subject". This is a copy change only.
   - A final grep finds no remaining `basis === "family"`, `"bucket" | "family"`, or England-average `familyId`/`family_id` keying in `src/`.

## What the change does to real numbers

The real wrapper was called against the live RPC through the app's own module and anon-key path, exactly as the route calls it. It returned 208 national KS4 rows (52 subjects × 2021–2024), with values as numbers. For 2024/25:

| Subject | New anchor (subject) | Old anchor (family) | Schools |
|---|---|---|---|
| Biology | 6.22 | 5.40 (Sciences & Maths) | 3,426 |
| Maths (General) | 4.77 | 5.40 (Sciences & Maths) | 4,042 |
| History | 4.72 | 4.85 (Humanities) | 3,602 |

Applied to a real school, Acland Burghley's 2024/25 GCSE scores (headline rows):
- **Biology 7.45:** the delta goes from +2.05 to **+1.23**.
- **Maths (General) 5.14:** the delta goes from −0.26 to **+0.37**. It changes sign, so the family anchor was telling this school the wrong story about Maths.

**KS5 regression check:** the KS5 branch is unchanged in code, and the same run read the A-level bucket anchor for 2024/25 as 33.56, the figure it has always shown.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on every changed file (the two long-standing `account/page.tsx` errors, Q20, are untouched); `next build` passes.

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, in both themes:
1. on a GCSE dashboard with Biology and Maths (General) ticked, the Results deltas read against 6.22 and 4.77 (hover a delta for its England figure);
2. both captions say "subject", not "subject family" or "subject's family";
3. a Post-16 dashboard shows the same figures and wording as before.
