# Teacher view: Column 1 qualification match, Trend actual-numbers view (Claude Code prompt v1)

Four decisions from Guy's review of the combined round, one scope confirmation, and one
new feature. Two are logged, not built this round.

## Already decided, no code change here

1. Phone horizontal-bar fallback: leave as-is. A sparse card's rows keep their natural
   height rather than stretching, consistent with what Ranked list already does.
2. Duplicate BTEC-size labels (five BTEC Business Studies sizes at 130448 collapsing to
   one short label): logged for a later round.
3. The per-school "most subjects in one category" query: not needed. §3's horizontal
   trigger is measured-fit, not a threshold, so there's no worst-case number left to
   calibrate against. See §2 below for what replaces it.

## 1. Column 1: same qualification as the focused subject, everywhere in the column

Guy's read: Sciences & Maths at The Chase shows "Math Stud" (Mathematical Studies -- the
label truncation rule, "Sports Studies" -> "Sports Stud", applied to a subject with no
shorter mapping) in the Candidates bar chart, even though it's a different qualification
from the A-level Maths being focused on, and Context (this round's §4c) already leaves it
out for exactly that reason. Decision: Column 1 should show only the focused subject's own
qualification family throughout the whole column -- not just Candidates. Guy's own check:
Results already doesn't show it, so this is about making Candidates match Results, not the
other way round.

Math Stud is not AS level. It's in the "Other" bucket (`bucketFor`/`displayBucketFor` in
`dfe-qualification-buckets.ts`), the same family as Core Maths, EPQ and Pre-U -- genuine
qualifications that the code has always deliberately kept in Column 1's category list
(only AS level and Advanced Extension Award are excluded there, via `comparablePeer` /
`isAsLevelOrAea`). Results already hides it, but only because Other has no points or
threshold figure to show (`ks5BucketHasPointsFigure`) -- an accident of the measure, not a
deliberate filter. Candidates has no such accident, because entries figures exist for
every bucket, so it shows through there.

Fix once, upstream of both: `categoryItems` in `src/app/teacher/[phase]/page.tsx`
(~L899-910) is what both Candidates (`candidateItems`) and Results (`resultsSeries`,
`resultsGroups`) are built from. Its peer filter is currently:

    (i) => i.key !== focusItem.key && comparablePeer(i) && focusFamilyId !== null && familyFor(headline, i.subject)?.id === focusFamilyId

Add a qualification-family match, the same rule Context's §4c already applies
(`contextFamily` / `inContextFamily`, ~L1077-1078, both built from
`familyOfItem(phase, item)` = `qualificationFamilyOf(phase, item.qualificationType)`):
a peer only counts if `familyOfItem(phase, i) === familyOfItem(phase, focusItem)`, gated to
`phase !== "ks2"` (KS2 has no qualification concept) exactly as Context's version is. This
is one filter, so it doesn't matter whether it's a new `categoryFamily`/`inCategoryFamily`
pair mirroring Context's, or a shared helper the two sites both call -- whichever reads
better in the file.

Because `categoryItems` also feeds the category's own average line ("{family} average",
"England {family} average") and Column 1's Trend and % Change panels, this makes all of
Column 1 -- not just the Candidates bars -- same-qualification-only by default, and makes
Results' current behaviour deliberate instead of incidental (its own values still going
null for Other-bucket rows is now redundant with the upstream filter, not the only thing
doing the work).

**Known follow-up, not this round:** if the *focused* subject is itself in the Other
bucket (say, Core Maths), this groups every Other-bucket subject at the school into one
"family" for comparison, even though DfE's own guidance says Other-bucket qualifications
aren't comparable *with each other* (Core Maths, EPQ and Pre-U are different things). Log
it next to the BTEC label issue; it only matters when the focused subject is itself Other.
Build report: confirm a school running *only* Other-bucket qualifications in a category
(e.g. only Core Maths and EPQ, no A-level) still shows something sensible in Column 1 --
worth knowing even though it isn't being fixed this round.

## 2. In place of the per-school query: one real large-category check on a phone

130448's Business & Law (13 subjects) was previewed upright at fullscreen but never at
phone width -- only The Chase's 6 subjects were shot on a phone. Add that screenshot
(130448, Business & Law, 375px) using the same unauthenticated preview method as before, so
the horizontal fallback is confirmed at real scale, not just at 6 subjects. No query, no
sign-off needed -- this is a second screenshot of data the preview already has.

## 3. Trend chart: explain the index, and add a real-numbers view

Guy's read of Column 2's Trend panel: the chart that indexes every line to its own first
year (100 = no change -- `indexTo100`/`shouldIndex` in `teacher-view-trend-styles.ts`,
drawn via `MultiTrend` in `SeriesViews.tsx` whenever the measure's aggregate is `"sum"`,
i.e. entries/headcount measures only -- points and rate measures already draw real values,
untouched) needs a plain-language title explaining what it's showing, and needs a second
graph view beside it showing the real numbers, so a teacher can see both and make sense of
the indexed one. Small subjects bunching near the bottom on a shared real-numbers scale is
fine -- that's what explains the other chart.

Two changes to `MultiTrend`/its caller:

- **A caption when indexed.** Something like "Change since {first real year} -- 100 = no
  change", wherever the panel's tag/caption sits (Column 1's `trend` `PanelRender` in
  `CandidatesPanels.tsx`, and Column 2's equivalent in `ComparisonsPanels.tsx`, both
  currently just tagged "Trends" with no explanation of the axis). Wording is yours to
  land well; the requirement is that a teacher who has never seen this chart before
  understands what "100" means without hovering anything.
- **A real-numbers chart view.** A third option beside the existing Chart/Table toggle
  (`IconButton` pair already in both panels) -- call the three "Indexed" / "Actual" /
  "Table" rather than leaving "Chart" ambiguous once there are two chart forms. "Actual"
  draws `MultiTrend` with indexing forced off (the real values, unindexed -- the same data
  `indexTo100` currently replaces), with its own caption, e.g. "Entries each year -- real
  numbers." Table stays as it is.

Apply this in both places that use the indexed `MultiTrend` -- Column 1 Candidates' Trend
panel and Column 2 Context/Comparisons' Trends panel -- for consistency, since they share
the same component and the same reason to explain themselves. Flag it if that's a bigger
change than intended for one round and you'd rather land Column 2 first.

## Build report

Confirm which of §1's two options you took for the shared filter, and answer §1's
Other-bucket-only check above. Confirm §2's screenshot. Confirm §3 landed in both columns
or state which one, and show both new captions' actual wording plus a screenshot of
"Actual" beside "Indexed" for the same subject so the two numbers visibly correspond
(index falling and real entries falling together, not indexed rising while entries are
flat, which would mean the base year was picked wrong).
