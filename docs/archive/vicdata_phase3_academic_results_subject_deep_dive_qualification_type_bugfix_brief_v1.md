# Subject deep-dive: qualification-type blindness — two live bugs, one root gap

Two bugs Guy found live in production, both traced to the same underlying architectural gap in `vicdata_public`. Not two separate fixes — one real gap, two visible symptoms.

## The gap

Every subject-grain raw fact already carries a real `qualificationType` field, correctly parsed from the breakdown string (`academic-data-view.ts:760-870`):

```typescript
export type SubjectEntry = { qualificationType: string; subject: string; period: number; entries: number };
export type SubjectGradeCount = { qualificationType: string; subject: string; period: number; grade: string; entries: number };
export type SubjectValueAdded = { qualificationType: string; subject: string; sizeWeight: string; period: number; entriesCount: number | null; valueAdded: number | null; valueAddedLowerCi: number | null; valueAddedUpperCi: number | null };
```

`parseSubjectEntries` and `parseSubjectGradeDistribution` (same file, same block) split each `qualificationType` out of the breakdown string correctly — the data is right at the parse boundary. Downstream, it's dropped in two different places, producing two different symptoms.

## Bug 1 — IB grade distribution shows empty A-level bands

`SubjectDeepDiveDrawer.tsx` picks grade bands purely by stage, with zero qualification-type awareness:

```typescript
const GCSE_GRADE_ORDER = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"];
const ALEVEL_GRADE_ORDER = ["A*", "A", "B", "C", "D", "E", "U"];
// line 226:
const gradeOrder = stage === "ks4" ? GCSE_GRADE_ORDER : ALEVEL_GRADE_ORDER;
```

Every non-GCSE stage gets forced into `ALEVEL_GRADE_ORDER`. IB's real grades (a 1-7 numeric scale, not A*-E-U) don't match any of those seven bands, so every bar renders at zero — not "no data," but real data that the chart's own hardcoded x-axis can't display.

## Bug 2 — Capital City College's BTEC subject breakdown shows A-level subjects

`SubjectAreaSection.tsx`'s `buildSubjectRows` (lines ~86 on) groups, filters and dedupes subject rows purely by `subject` name string — `qualificationType` is never referenced anywhere in the function despite being present on every input row:

```typescript
const namesInFamily = new Set(
  Object.entries(subjectData.subjectFamilyMap).filter(([, fam]) => fam === familyId).map(([name]) => name),
);
const subjectNames = Array.from(
  new Set([...subjectData.entries.map((e) => e.subject), ...subjectData.valueAdded.map((v) => v.subject)].filter((s) => namesInFamily.has(s))),
);
// ...
const entryRows = subjectData.entries.filter((e) => e.subject === name);
```

Confirmed architecturally, but the exact mechanism behind Capital City College's specific symptom is **not yet confirmed against real data** — two real, different candidate mechanisms:

- **Name collision/merging**: a BTEC subject and an A-level subject that share (or nearly share) a name string get merged into one row by the `Set`/`.filter((e) => e.subject === name)` logic, so a college running mostly BTEC ends up displaying entries/results that are actually A-level's.
- **`subjectFamilyMap` exclusion**: BTEC subject names are absent from `subjectFamilyMap` entirely (if that map was built only from GCSE/A-level rollup data), so `namesInFamily.has(s)` filters every real BTEC subject out, and whatever *does* survive the filter happens to be the college's small residual A-level entry — which is then all that's left to show.

These produce different visible symptoms and need different fixes (dedupe key vs. map construction), so which one is real at Capital City College needs checking against that college's actual ingested data before writing a fix — same discipline as every prior round on this page (the drawer bugfix round's own root-cause work is the precedent: guessing produced a wrong hypothesis there too, checking against real data corrected it fast).

## What's NOT the ask here

- Don't guess a fix for Bug 2 before confirming the mechanism. Query Capital City College's real `SubjectEntry`/`SubjectGradeCount`/`subjectFamilyMap` data directly (URN needed — look it up) and show what's actually happening: are there two rows with the same `subject` string and different `qualificationType`s? Or is every real BTEC subject name simply missing from `subjectFamilyMap`?
- Don't guess IB's real grade set either — confirm the real distinct `grade` values IB entries carry from ingested `SubjectGradeCount` rows before building a qualification-aware band list. IB may not be the only non-GCSE/non-A-level qualification with subject-grain grade data (Core Maths, OCR Cambridge Technical, VRQ are also parsed but per the backend brief's original scope limits may have no rows — check what's real rather than assuming only IB needs a fix).

## Once the mechanism is confirmed — likely shape of the fix

- **Bug 1**: replace the two-item hardcoded `gradeOrder` lookup with something keyed by the real distinct grade values present in that subject's `SubjectGradeCount` rows for its actual `qualificationType`, or at minimum add real band lists per qualification type actually carrying grade data (GCSE, A-level, IB, and whichever others turn out to have real rows) rather than defaulting everything non-GCSE to A-level bands.
- **Bug 2**: incorporate `qualificationType` into `buildSubjectRows`'s grouping key (so two same-named subjects under different qualification types produce two rows, not one merged row) and, if the `subjectFamilyMap` exclusion mechanism is what's real, fix how that map is built/joined so BTEC (and other non-GCSE/A-level) subject names are represented in it rather than filtered out entirely.

Both fixes should preserve the existing GCSE/A-level behaviour exactly (equivalence-checked, same discipline as the timeout fix) — this is about not silently mishandling other qualification types, not about redesigning how GCSE/A-level already work.

## Deliverable

Verify the real mechanism against Capital City College's real data (Bug 2) and IB's real grade values (Bug 1) before writing any fix — show the real query/data evidence in the build report, not just code inspection. Then fix both, preserving existing GCSE/A-level behaviour. Full build report, same shape as every prior round. Commit and push once verified.
