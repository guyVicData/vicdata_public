# Teacher view Post-16 Part C1: AS level / AEA out of the category and Context lists: build report (v1)

Prompt: `vicdata_phase3_teacher_view_post16_category_context_exclude_as_aea_claude_code_prompt_v1.md` (read in full). Built from `c0040fd` in one commit.

## What changed

- **`src/lib/dfe-qualification-buckets.ts:137`: new `isAsLevelOrAea(qualificationType)`.** It makes the same two checks `bucketFor()` / `displayBucketFor()` already use: `startsWith("GCE AS level")` or `=== "Advanced Extension Award"`. It deliberately does **not** use `displayBucketFor() === "other"`. EPQ, Core Maths, Pre-U, VRQ and the rest of Other are untouched. `bucketFor()`, `displayBucketFor()` and every points path are unchanged.
- **`src/app/teacher/[phase]/page.tsx:869-879`: Column 1's category.** `categoryItems` drops AS/AEA **peers** through a new `comparablePeer()` guard. This runs before the `candidateItems` subject+bucket dedup, so it covers:
  - `candidateItems` / Candidates' bars, trend and category average (computed in `CandidatesPanels` from what it is passed);
  - `categoryPeriods`, `resultsPeriods` and `resultsSeries`;
  - `resultsGroups`' self-computed "{category} average" line (the mean of `resultsSeries`);
  - `categoryShort`. With the AS row gone, an AS + A-level pair no longer collides, so there is no "(GCE A level)" suffix for that pair. A genuinely different qualification that shares a subject name in the same category still collides and still gets its suffix.
- **`page.tsx:1066-1071`: Context's subject list.** `contextItems` drops AS/AEA peers with the same guard, both with "All subjects" and with "Selected subjects".
- **`page.tsx:1000-1020`: Context's group total and average.** A subject that this school runs **only** as AS and/or AEA is removed from `contextMembers`. Its headline row would otherwise be AS figures alone, counted into `contextGroupTotals` (the donut's denominator) and into `contextGroupAverage`. The fallback for "Selected subjects" with nothing ticked gets the same exclusion.

## Not changed (as the prompt says)

- **The subject picker and family tiles:** AS/AEA are still selectable under Other.
- **The focused item is never filtered.** Tick AS Psychology and it is still the focused subject, with its own Results/Trend/% Change figures (still blended, until B-2).
- **Comparisons panel:** untouched.

## `SubjectPanels.tsx`: no copy of the filter needed

Checked in the real code. `SubjectPanels.tsx` and `CandidatesPanels.tsx` build no category or subject lists of their own. They only render and average the `subjects` / `series` / `groups` that `page.tsx` passes them. The whole filter is therefore in `page.tsx`, applied once at the source.

## Checks run

- `tsc --noEmit`: clean.
- `eslint` on both touched files: clean.
- `npm run build`: succeeds.

## Live checks for Guy (localhost is gated)

1. At a school teaching both AS and A-level Psychology (or the Maths example already checked), focus A-level Psychology, then look at Column 1's category chart, on both Candidates and Results:
   - Psychology appears once, with no AS row and no "(GCE A level)" suffix.
   - The "{category} average" line has moved if the AS row used to be in it.
2. At the same school, Context → Current: there is no AS row.
3. Tick AS Psychology in the picker and focus it: its own Results/Trend/% Change still render as before.
4. At a school with an AS-only subject (e.g. AS Further Maths alone): Context's "All subjects" total and average no longer include it.
5. Check that EPQ / Core Maths still appear in Context and in their category as before.

## Open decisions for Guy

1. **Context's group total/average still blends AS entries into a subject that also has a real A level.** Headline rows are per (subject, bucket), and AS sits in the A-level bucket. The only way to separate them is Part B-2, so I have not attempted it here. The AS-only exclusion above is the part of "not counted in any total" that is possible now. **I read "any total/average those lists compute" to include Context's group total and average. Say if you meant Column 1's category line only.**
2. **Focused AS item with an A-level sibling.** If the teacher focuses AS Psychology and the school also runs A-level Psychology, the A-level entry is still a peer. In Column 1 Results they show the same blended bucket figure side by side, with suffixes. In Candidates the A-level peer is deduped into the AS focus. This is pre-existing behaviour that this round leaves alone, because the focused item is never filtered. It is worth a decision once B-2 gives AS its own figure.
3. **Non-KS5 phases.** No phase gate is needed: the AS/AEA qualification strings only occur at Post-16, so the predicate is a no-op at GCSE.
