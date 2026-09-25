Teacher View dashboard content round -- twelve parts in one pass, built on top of the
nav/chrome work (d3b5db3 through a09b58a). Everything here comes from live design review this
morning; none of it has been built before. Full rationale and real-code grounding is in
docs/vicdata_phase3_teacher_view_dashboard_content_round_build_brief_v1.md -- read it in full
before starting. This prompt is the build order and the imperative version of the same spec.

Build in this order -- later parts depend on earlier ones landing first:

=====================================================================
## Part 1 -- four quick, independent fixes
=====================================================================

1a. Main qualification badge icon: ControlBar.tsx's QUALIFICATION_ICON (its own invented
mortarboard, ~line 40) is wrong -- replace it with the real PhaseGlyph({ phase }) already used
on the Teacher home screen (HomeCard.tsx) and in TeacherNav's phase switcher. Keep the 40px box
and rgba(accent.rgb, 0.14) tint; only the glyph changes.

1b. Export as an icon: TeacherChrome.tsx's ExportButton still renders literal text "Export".
Give it the same ExportIcon glyph used by per-panel export (PanelExport/ExportIcon in
PanelFooter.tsx), icon-only, aria-label="Export all visible panels". Keep window.print() and
print:hidden as they are.

1c. "Av. Points 2024/25" Column 1 tag: wireframed (Redesign.dc.html v27), never built. In
SubjectPanels.tsx, the Current panel's tag should read "Av. Points 2024/25" specifically when
Results is on the average-points-per-entry sub-measure -- distinct from the column H2 heading,
which stays "Results"/"Candidates". Other sub-measures keep their current tag wording.

1d. GCSE data bugs, three cases, all live-confirmed and separate from the general exclusion
rule that already shipped (514e285, which covers the public Academic Results pages). The
ComparatorSchool type already has an igcseExcluded?: boolean field (ComparisonsPanels.tsx) --
trace why Teacher View's Comparisons column doesn't apply it consistently:
  - Candidates mode: independent schools that should be excluded (Malvern College, Malvern St
    James) show real numbers with no exclusion at all. Fix: apply the same gate.
  - Results mode: those schools show "not comparable" placeholders instead of being omitted
    entirely, which is what the rule actually calls for. Fix: omit, don't caveat.
  - Post-16: several schools show bare unlabeled "--/--". This is a per-subject gate (a school
    missing data for THIS subject drops from THIS subject's list only) -- add it so the row
    just doesn't render, rather than rendering blank.

Verify all four: badge glyph matches the home-screen tile exactly; whole-dashboard Export looks
like the per-panel Export icon, still prints, still hidden when printing; the Av. Points tag
only changes when that sub-measure is active; at GCSE, Malvern College/Malvern St James never
appear in Comparisons in either measure mode; at Post-16, no bare "--/--" row appears anywhere.

=====================================================================
## Part 2 -- kill "All": single subject, always focused
=====================================================================

Guy, live: "if a teacher teaches 3 subjects they look at each one at a time... lets kill the
ALL view and button." ControlBar.tsx still has a live "All" button (onClick={() =>
onFocus(null)}) as the default state. SubjectPanels.tsx (Column 1) also still runs its OWN
separate "All subjects"/subject chip row -- a local focus state used to pick which subjects
show as bars, unrelated to the shared control bar's chips.

Remove the "All" button from ControlBar.tsx entirely -- a subject is always focused, defaulting
to the first ticked subject rather than null. Remove SubjectPanels.tsx's own local "All
subjects" chip row completely; Column 1 becomes single-subject throughout, reading the same
global focusKey everything else already reads. Keep focusKey's type honestly nullable only if
there's a genuine zero-subjects-ticked empty state to handle -- that's not "All", it's "nothing
ticked yet".

Verify: no "All" affordance exists anywhere in the control bar or Column 1. Every teacher
always sees exactly one subject's data across all three columns.

=====================================================================
## Part 3 -- Column 1: category comparison + England-average extension
=====================================================================

Agreed: Column 1 defaults to comparing the focused subject against other subjects in its own
taxonomy category (e.g. Maths (General) vs. rest of Science & Maths), replacing the
multi-subject bars removed in Part 2. This is NOT new machinery -- Context already built the
category-group computation. In page.tsx, when contextAgainst === "area", contextMembers is
every subject at the school sharing the focused subject's family
(contextAnchorFamily/familyLabelFor/familyFor), and contextGroupTotals/contextGroupAverage come
from those members via groupValueFor. Reuse that shape for Column 1.

Column 1 and Context read different measures (resultsMeasure/valueForResults vs.
contextMeasure/groupValueFor), so build the Column-1-measure equivalent of groupValueFor
(generalised or duplicated consistently with how resultsSeries already computes each subject's
own value), fix its membership to the focused subject's family (not user-selectable), and wire
the result into Column 1's <SubjectPanels> call as groupSeries/groupLabel/groupTotals -- the
exact props Context already passes. Keep Column 1's existing per-subject England-average
benchmark line running alongside it, not replaced by it. In Candidates mode, skip the
England-average overlay ("for candidates the national average is irrelevant") but keep the
category comparison.

Then extend the England-average benchmark itself: today it only covers the focused subject; at
GCSE, extend it to cover every subject in that subject's category (the real per-subject backend
-- academic_subject_geography_aggregate/academic_subject_geography_lookup via p_family_id --
already supports this, it's a frontend wiring change only), surfaced as a second, distinct
overlay from the category-peer line. At Post-16, explicitly skip this extension -- no
per-subject KS5 backend exists yet (a separate, already-logged future round) -- and say so
plainly in the build report.

Verify: Column 1's Current/Trend/%change panels default to showing the focused subject against
its real category peers, matching whatever Context's own former "area" grouping would have
computed for the same subject. At GCSE, an England-average overlay also covers every subject in
the category. At Post-16, only the category-peer comparison appears.

=====================================================================
## Part 4 -- Context: drop the category option
=====================================================================

Depends on Part 3 landing. Context's "other subjects in this area" option moves to Column 1 and
is dropped here, leaving Whole school / Selected subjects only. In ContextPills.tsx, remove the
"area" MenuRow and narrow CompareAgainstId from "whole" | "area" | "selected" to "whole" |
"selected". In page.tsx, remove the "area" branch from contextAgainst/contextMembers/
contextGroupLabel -- Column 1 owns that comparison exclusively now. Keep the existing
reactive/symmetric toggle behaviour (narrowing the selected-subjects checklist already flips the
pill label) unchanged.

Also, same picker, agreed alongside the option-drop: add select-all/clear-all to the
selected-subjects popup, and confirm it only ever lists subjects with real candidates/results at
the school.

Verify: Context's "Compare against" pill offers exactly two options, no "area"/category wording
anywhere in Context. Select-all/clear-all works and never lists a subject with no real data.

=====================================================================
## Part 5 -- Comparisons: real school name, highlight, scroll-to-focus
=====================================================================

Guy, live: "'this school' should be school name; make the colour of that row the highlight
colour (eg GCSE green) -- and if the rankings table is cropped set the scroll to show the school
in focus and some schools above and below." ComparisonsPanels.tsx still literally labels that
row "This school" (r.isTarget ? "This school" : r.name), no highlight or scroll logic exists.

Where r.isTarget is true, use the real school name instead of the literal string. Style that
row with the phase accent colour (PHASE_ACCENT, the same rgba(accent.rgb, ...) pattern used for
the qualification badge and active nav states). Where the table is scrollable and the focused
row would be cropped, scroll it into view with a few rows of context either side on load/change
(scrollIntoView({ block: "center" }) on the target row is the natural approach -- check the
table's actual scroll container first).

Verify: the target school's real name appears, styled in the phase accent colour. On a long
list, the target row is already visible with neighbours either side without the user having to
scroll to find it.

=====================================================================
## Part 6 -- accordion panel mechanism
=====================================================================

Agreed: remove "+Add" and each panel's "x" close button (AddPanelButton.tsx, ColumnPanels.tsx's
remove control using PANEL_ORDER/canRemovePanel/removePanel from teacher-view-panels.ts).
Replace with an independent open/shut toggle per panel -- not a true single-open accordion, more
than one can be open. Default: only "Current" open per column, Trend and % change collapsed
("so teacher builds complexity"). Collapsed panels show their own headline figure (reuse
whatever the panel's tag/lead value already is) inline in the header bar, not a bare title.
Sizing target: 2 panels open + 1 collapsed header should fit without scrolling; 3 open may
scroll. Don't force a fixed height budget that breaks at 3-open.

All three panels always exist and are always listed now -- there's nothing left to "Add back".
Store the open/shut state the same way panel presence is stored today, extended rather than
replaced: anyone with existing saved panel-presence state should have their previously-present
panels come back OPEN, not vanish.

This wasn't wireframed in detail (explicitly deferred this morning -- "only wireframe the
interfaces that need development"). Use your judgement on the exact ColumnPanels/CardBox markup
and say what you built and why in the report, the way earlier rounds have handled real-but-
undrawn decisions.

Verify: no "+Add" or "x" anywhere on a column. Every panel always present, independently
open/shut. 2-open-plus-1-collapsed-header fits without scrolling at a normal laptop width.
Nobody with existing saved state loses a panel they'd added.

=====================================================================
## Part 7 -- heading restructuring
=====================================================================

Depends on Parts 3-5 for wording (needs the real comparators to name). Guy's own list, section
by section:
  - Column headings (H2) become full explanatory sentences, e.g. Column 1: "{Subject}
    Candidates -- how many pupils take {Subject} GCSE." Context and Comparisons get their own
    equivalent sentences naming what they compare against.
  - Context's and Comparisons' Current-row tags name the real, active comparator instead of a
    generic label -- e.g. "Whole School Context 2024/25" / "Selected Subjects Context 2024/25"
    for Context (per Part 4's two options); "Candidates at the Nearest 10 Schools 2024/25" for
    Comparisons, reading the actual comparator-set label from comparatorSetOptions/
    comparisonsSet rather than hardcoding "Nearest 10".
  - Trend and % change rows both become uniform headings -- "Trends" and "% Change" -- each with
    a "From {year}" DROPDOWN (not the current prev/next arrows via nextStart(trendPeriods, ...)
    in SubjectPanels.tsx) listing the available start years, consistent across all three
    top-row panels. Build one shared selector if there isn't already a natural one.

Also fold in: graphs should not overlap explanatory text (check panel body layouts at the space
now available); caveat text should live inside the "i" info popover (SourceNote in
PanelFooter.tsx) alongside the source citation, not repeated inline.

Verify: every column heading is a full sentence naming the subject and the question it answers.
Context/Comparisons Current-row tags name their real active comparator and update when it
changes. Trend and % change both show an openable "From {year}" dropdown everywhere. No caveat
text repeats outside the info popover.

=====================================================================
## Part 8 -- trend line and the growth/decline flag into the bottom row
=====================================================================

Do this last -- it restructures CardBox.tsx's shared footer, used by every panel in every
column. Two relocations:
  - "Trend line can move into bottom row before Info button": the Pill label="Trend line"
    toggle currently sits in SubjectPanels.tsx's Trend-panel controls (top, beside "From:
    {year}"). Move it into the panel's footer row, left of the source/info "i" button
    (SourceNote in PanelFooter.tsx/CardBox.tsx).
  - "The 'declining' message can also go in the bottom row (right aligned)": this message
    already exists as the panel's summary (PanelSummary with DIRECTION_ARROW/DIRECTION_WORD/
    DIRECTION_COLOUR, from trendSaid/trendSentence in teacher-view-panels.ts), currently
    rendered by CardBox.tsx as a captionLine ABOVE the footer row. Move it into the footer row
    instead, right-aligned, alongside the relocated Trend-line toggle and the "i" button.

CardBox.tsx's caption/source/footerActions are used by every panel type, not just Trend -- make
this a deliberate, general restructuring (a free-form leading footer slot the Trend panel fills)
so every other panel's footer renders exactly as it does today.

Verify: Trend panel's top controls show only the "From: {year}" dropdown. "Trend line" and the
growth/decline message both sit in the footer row -- Trend line near the info icon,
growth/decline right-aligned. Every other panel's footer is visually unchanged.

=====================================================================
## Deliverable
=====================================================================

One build report covering all twelve parts in build order: what changed, real files touched,
verification results, and any open decisions where you had to interpret rather than found
explicitly specified (Part 6's accordion markup especially). Confirm the real locations named
above before writing anything. Commit per part (or per small grouped part, your call). Commit
and push, vicdata_public only.
