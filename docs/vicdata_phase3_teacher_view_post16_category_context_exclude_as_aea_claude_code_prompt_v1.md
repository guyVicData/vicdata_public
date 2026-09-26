# Post-16 Part C1: exclude AS level / AEA from the category/context comparison lists and their totals

Standalone, buildable now — no dependency on Part B-2 (the school's-own-figure backend fix,
still in progress). Ground truth: `vicdata_public` HEAD after Part A shipped
(`displayBucketFor()` already exists in `src/lib/dfe-qualification-buckets.ts`). Full context
in the Claude Project's `vicdata_phase3_teacher_view_post16_qualification_status_v1.md`.

## Decided scope (Guy, 2026-09-26)

AS level and Advanced Extension Award stay individually selectable in the subject
picker/tiles (Part A, already shipped — grouped under "Other" there). This round is about a
DIFFERENT set of views: the "compare with other subjects at this school" lists — Column 1's
category comparison chart (the one showing e.g. "Biology", "Chemistry", "Mathematics" as bars
side by side within a taxonomy category) and Context's equivalent. AS/AEA should not appear in
THESE lists at all, and should not be counted in any total/average those lists compute — e.g. a
category's own self-computed average line. Confirmed live: this is the mechanism producing the
"Biology (GCE A level)" qualification-suffix disambiguation already visible on production for
schools with more than one real qualification type per subject in a category.

**Precision, don't overreach**: this is specifically about AS level and Advanced Extension
Award — not about every "Other"-bucket qualification. EPQ, Core Maths, Pre-U and VRQ were
already "Other" before this round and their existing behaviour in these lists is unrelated;
don't change it. Do NOT filter on `displayBucketFor(qualificationType) === "other"` (too broad
— it would also sweep in genuine Other qualifications that were never part of this complaint).
Instead, add a narrow, explicitly-named predicate — e.g. `isAsLevelOrAea(qualificationType):
boolean` in `dfe-qualification-buckets.ts`, the same two checks `displayBucketFor()` already
uses internally (`q.startsWith("GCE AS level")`, `q === "Advanced Extension Award"`) — and use
THAT predicate to filter these specific lists, not the broader display-bucket function.

## What to change

In `src/app/teacher/[phase]/page.tsx`, the category-comparison construction (~L880-940,
`categoryItems`/`candidateItems` and the `resultsSeries`/`resultsGroups` built from them):
filter out any item where `isAsLevelOrAea(item.qualificationType)` is true, before the existing
subject+bucket dedup logic runs (so an AS row never gets a chance to become the row a same-
subject A-level entry gets deduped INTO, and never contributes to `resultsGroups`' self-computed
category-average line). Re-check whether `SubjectPanels.tsx`'s own category-list construction
(if it duplicates any of this logic rather than only consuming what `page.tsx` passes down)
needs the same filter — read the real current code before assuming, this may all live in one
place already.

Do not change: the subject picker/tiles (Part A's job, already shipped, AS/AEA stay selectable
there), the Results/Trend/%Change panels for the focused subject when a teacher has ticked an
AS/AEA item directly (that's a different, individual view, not a multi-subject comparison list
— those panels should keep working as before, blended-figure caveat and all, until Part B-2
ships), and the Comparisons panel (a separate, already-logged requirement on the not-yet-built
comparator drop-and-replace mechanism — not this round's job).

## Verify

At a school teaching both AS Psychology and A-level Psychology (or AS/A-level Maths, per the
live example already checked): the category comparison chart for that subject's taxonomy area
now shows Psychology/Maths once, from its real A-level entry only, with no AS row and no
qualification-suffix disambiguation needed for that pair any more (a genuinely different
qualification type sharing a subject name with something ELSE, if one exists at that school,
should still disambiguate as before — this round only removes AS/AEA specifically). The
category's own self-computed average line no longer includes the AS/AEA figures in its
arithmetic. Ticking AS Psychology directly in the picker still works and still shows its (for
now, blended) own-school figure in its own Results/Trend/%Change panels, unchanged from before
this round.

## Deliverable

One commit, one build report: what changed, real locations touched, verification steps above,
and anything you had to interpret (in particular whether `SubjectPanels.tsx` needed its own
copy of the filter) flagged as an open decision for Guy.
