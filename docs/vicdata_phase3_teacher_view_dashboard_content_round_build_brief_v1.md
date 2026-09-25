# Teacher View dashboard — content round build brief

Turns the open-items audit (vicdata_phase3_teacher_view_dashboard_open_items_audit_v1.md)
into one build round. Everything here was discussed and agreed live this morning; none of it
has been sent to Claude Code before. Grounded directly against the real code at HEAD (c4ea7a0)
just now, not against memory or the wireframe alone.

Build in this order -- later parts lean on earlier ones:

1. Quick independent fixes (S1-S4)
2. Kill "All" -- single subject always focused (S5)
3. Column 1 -- category comparison + England-average extension (S6-S7)
4. Context -- drop the category option (S8)
5. Comparisons -- real school name, highlight, scroll-to-focus (S9)
6. Accordion panel mechanism (S10)
7. Heading restructuring (S11)
8. Trend line + growth/decline flag into the bottom row (S12)

---

## S1. Main qualification badge icon

ControlBar.tsx defines its own QUALIFICATION_ICON (an invented mortarboard, ~line 40) for
the 40px badge next to "GCSE -- {school}". This is a different, wrong icon from the real
PhaseGlyph already used on the Teacher home screen (HomeCard.tsx) and already used
correctly in TeacherNav.tsx's phase switcher. Guy flagged this live this morning: "GCSE has
the wrong icon -- should be exactly the same as the one used on the teacher home screen." The
per-chip icons already got fixed (b58f653); this badge never did.

Build: replace QUALIFICATION_ICON with PhaseGlyph({ phase }), same source as
TeacherNav/HomeCard. Keep the 40px box and rgba(accent.rgb, 0.14) tint exactly as they are
-- only the glyph itself changes.

Verify: the control-bar badge and the Teacher-home tile for the same phase render the
identical glyph, pixel-for-pixel comparable.

## S2. Export as an icon

TeacherChrome.tsx's ExportButton still renders literal text, "Export", in a bordered
button. Guy's note this morning: "Light dark and export should be icons -- export should [use
the] same icon as the one used on the individual panel." Per-panel export already is an icon --
ExportIcon/PanelExport in PanelFooter.tsx.

Build: give ExportButton the same ExportIcon glyph, icon-only (no visible label),
aria-label="Export all visible panels". Keep its window.print() behaviour and
print:hidden unchanged.

Verify: whole-dashboard Export reads as the same glyph as any panel's own Export button,
just larger/standalone. Still triggers print. Still hidden when printing.

## S3. "Av. Points 2024/25" Column 1 tag

Wireframed already (Redesign.dc.html v27) but never briefed: Column 1's Current-panel tag
should read "Av. Points 2024/25" in Results + average-points-per-entry mode, distinct from the
column H2 heading ("Results"/"Candidates", unchanged). Check SubjectPanels.tsx's tag field
for the Current panel and the measure-label source it reads from (resultsMeasure/similar) --
add the distinct wording for the points sub-measure specifically; other sub-measures keep
their existing tag text.

Verify: switching Results' sub-measure to "Av. Points" changes only the Current panel's own
tag, not the column heading.

## S4. GCSE data bugs -- live-confirmed, real code, not yet fixed

Three related but distinct gaps found live this morning, on top of the general exclusion rule
that already shipped (514e285, which covers the public Academic Results pages -- Free card,
Data View Overview, Rankings, Map). The ComparatorSchool type already carries an
igcseExcluded?: boolean field (ComparisonsPanels.tsx), so the plumbing partially exists --
trace why it isn't applied consistently in Teacher View specifically:

- Candidates mode: independent schools that should be excluded (Malvern College, Malvern
  St James) appear with real-looking numbers and no exclusion at all.
- Results mode: those same schools appear as "not comparable" placeholders instead of
  being omitted entirely, which is what the rule actually calls for (never a placeholder, per
  the existing wording convention -- omit, don't caveat).
- Post-16: several schools show bare, unlabeled "--/--" with no explanation. This is a
  per-subject gate, not a total exclusion -- "they might not do that subject" -- so the fix is
  to hide the row for that subject's view, not blank it.

Build: trace the comparator-set construction Teacher View's Comparisons column actually
uses (start from where comparatorSets/ComparatorSchool rows are built, upstream of
ComparisonsPanels.tsx) and make Candidates mode apply the same igcseExcluded gate Results
mode partially applies, make Results mode omit those rows outright instead of showing a
placeholder, and add the missing per-subject zero-candidate gate for Post-16 so an unlabeled
row never renders -- it should simply not appear in that subject's comparator list.

Verify: at GCSE, Malvern College/Malvern St James are absent from Comparisons entirely in
both Candidates and Results mode -- no row, no placeholder. At Post-16, no row anywhere in the
dashboard shows a bare "--/--"; a school missing data for the focused subject just isn't listed
for that subject, while remaining listed for subjects it does have data for.

---

## S5. Kill "All" -- single subject, always focused

This morning's decision: "if a teacher teaches 3 subjects they look at each one at a time...
lets kill the ALL view and button." ControlBar.tsx still has a live "All" button
(onClick={() => onFocus(null)}) as the default state, and Column 1
(SubjectPanels.tsx) still runs its own separate "All subjects"/subject chip row (a focus
state local to that file, used to pick which subjects show as bars) -- that's the "Column 1's
own multi-subject bars" its own comment flags as untouched by the chip work.

Build: remove the "All" button from ControlBar.tsx's focus-chip row -- a subject is
always focused (default to the first ticked subject rather than null). Remove
SubjectPanels.tsx's own local "All subjects" chip row entirely; it becomes single-subject
throughout, reading the same global focusKey everything else reads. focusKey no longer
needs to be nullable at the UI level, though keep the type honestly nullable if there's a real
zero-subjects-ticked edge case (a teacher with nothing ticked yet) -- that's a distinct,
legitimate empty state, not "All".

Verify: no "All" affordance exists anywhere in the shared control bar or in Column 1. A
teacher with 3 subjects ticked always sees exactly one subject's data across all three
columns, switchable via the chips as today. The zero-ticked-subjects state (if reachable) shows
a sensible empty state, not a silent "All".

## S6. Column 1 -- category comparison

Agreed: Column 1 gains a comparison against "other subjects in the same taxonomy category"
(e.g. Maths (General) vs. rest of Science & Maths) as its default, replacing the multi-subject
bars removed in S5.

This is not new machinery -- Context already built it. In page.tsx, when
contextAgainst === "area", contextMembers is computed as every subject at the school
sharing the focused subject's family (contextAnchorFamily/familyLabelFor/familyFor), and
contextGroupTotals/contextGroupAverage are computed from those members via groupValueFor.
That's exactly the category group Column 1 needs.

Build: compute an equivalent fixed-to-"area" group for Column 1's own measure pipeline
(resultsMeasure/valueForResults/resultsPeriods, not Context's contextMeasure/
groupValueFor -- Column 1 and Context read different measures, so the per-subject value
function needs the Column 1 equivalent of groupValueFor, generalised or duplicated
consistently with how resultsSeries already computes each subject's own value). Wire the
result into Column 1's <SubjectPanels> call as groupSeries/groupLabel/groupTotals --
the same props Context already passes -- anchored on the globally-focused subject's family,
not user-selectable. Keep Column 1's existing per-subject England-average benchmark line
running alongside it (see S7) rather than replacing it -- the category line and the national
line answer different questions and both stay.

Candidates mode: no England-average overlay (per this morning's note, "for candidates the
national average is irrelevant"), but the category-peer comparison still applies -- it's
useful context regardless of measure.

Verify: Column 1's Current/Trend/%change panels for a focused subject all show that
subject against its category peers by default, using the real family taxonomy (no manual
categorisation). Category membership matches what Context's own "area" option already
computes for the same subject (they should agree, since it's the same underlying grouping).

## S7. England-average extension to every subject in category

Agreed: "the England average in results should be applied to all subjects in the category
(and at GCSE as well)" -- i.e. Column 1's Results-mode England-average benchmark, extended from
"just the focused subject" to "every subject in its category," visible as an overlay alongside
the category-peer line from S6. Confirmed the real GCSE per-subject backend already exists
(academic_subject_geography_aggregate/academic_subject_geography_lookup via
p_family_id) -- this is a frontend wiring change at GCSE, not new backend work.

Build: at GCSE, extend the England-average lookup Column 1 already does for the focused
subject to run for every subject in that subject's category, and surface it as a second
overlay (distinct from the category-peer average from S6 -- one is "what this category
actually scores here," the other is "what England scores in this category"). At Post-16,
explicitly skip this -- the real per-subject backend doesn't exist for KS5 yet (a separate,
already-logged future backend round). Say clearly in the build report that Post-16 ships
without this overlay for that reason, not by oversight.

Verify: at GCSE, Column 1 for any subject shows both the category-peer line/bar (S6) and
an England-average line/bar covering every subject in that category, not just the one in
focus. At Post-16, only the category-peer comparison from S6 appears -- no England-average
overlay, and the build report says why.

## S8. Context -- drop the category option

Agreed: Context's "other subjects in this area" option moves to Column 1 (S6) and is dropped
from Context, leaving just Whole school / Selected subjects. ContextPills.tsx currently has
all three (CompareAgainstId = "whole" | "area" | "selected"); its own comment notes "three
compare-against options... category-vs-category still deferred" -- that comment is now stale.

Build: remove the "area" option and its MenuRow from ContextPills.tsx; narrow
CompareAgainstId to "whole" | "selected" and update every place that reads it
(contextAgainst/contextMembers/contextGroupLabel in page.tsx) to drop the "area"
branch -- Column 1 now owns that comparison exclusively via S6's fixed grouping, so nothing
else should compute it against a user-chosen "area" anymore. Keep the toggle
reactive/symmetric behaviour that already exists (narrowing the selected-subjects checklist
below "everything" already flips the pill to "Selected subjects" per the existing
contextMembers/contextSelected logic) -- that part is real and correct already, just
carrying forward, not new work.

Also from this morning, still open and worth doing in the same pass since it touches the same
picker: add a select-all/clear-all control to whichever popup drives "Selected subjects," and
confirm it only lists subjects with real candidates/results at the school (both agreed
alongside the option-drop, not yet built).

Verify: Context's "Compare against" pill offers exactly two options. No trace of "area" or
category wording remains in Context specifically (it now lives only in Column 1's own,
non-optional grouping). Select-all/clear-all works in the selected-subjects popup, and it never
lists a subject with no real data at the school.

## S9. Comparisons -- real school name, highlight, scroll-to-focus

Agreed: "IN rankings view -- 'this school' should be school name; make the colour of that row
the highlight colour (eg GCSE green) -- and if the rankings table is cropped set the scroll to
show the school in focus and some schools above and below." ComparisonsPanels.tsx still
literally labels that row "This school" (r.isTarget ? "This school" : r.name) with no
highlight-colour or scroll logic anywhere in the file.

Build: where r.isTarget is true, use the real school name (already available on the
target row) instead of the literal string "This school." Give that row's colour/background the
phase accent colour (PHASE_ACCENT, the same rgba(accent.rgb, ...) pattern used for the
qualification badge and active nav states) rather than the current highlight styling. Where
the rankings table is scrollable and would crop the focused row out of view, scroll it into
view on load/change with a few rows of context above and below (a standard
scrollIntoView({ block: "center" })-style approach on the target row is the natural fit;
confirm the table's existing scroll container before choosing the exact mechanism).

Verify: the target school's own name appears in its row, styled in the phase accent
colour, distinguishable at a glance from every other row. On a long comparator set that would
otherwise need scrolling to find the school, it's already in view with neighbours on both
sides when the panel opens.

---

## S10. Accordion panel mechanism

Agreed: remove "+Add" and each panel's "x" close button; replace with an independent open/shut
toggle per panel (not a true accordion -- more than one can be open); default only the
"Current" panel open per column ("so teacher builds complexity"); size for 2 panels open + 1
collapsed header fitting without scrolling (3 open may scroll); collapsed panels show a quick
headline number inline in their header bar, not just a bare title.

This is the biggest structural change in this round and touches shared components used by all
three columns -- AddPanelButton.tsx, ColumnPanels.tsx (PANEL_ORDER/canRemovePanel/
removePanel from teacher-view-panels.ts), and CardBox.tsx's header/body rendering.

Build: replace the Add/Remove pair with a per-panel open/shut boolean, stored the same way
panel presence is stored today (teacher-view-panels.ts's panel-state persistence -- extend
rather than replace, so existing saved panel sets migrate sensibly: treat "present" as "open"
for anyone with existing saved state, so nobody's dashboard silently goes blank). All three
panels always exist and are always listed (no more "missing" panels to Add back); the toggle
controls whether each one is expanded or collapsed to a header bar. Collapsed header bars show
the panel's own headline figure (whatever the panel's tag/lead value already is -- reuse it,
don't compute a new one) inline. Default state for a school with no saved preference: only
"Current" open, Trend and % change collapsed. Height: don't force a fixed budget that breaks
at 3-open; let 2-open-plus-a-collapsed-header fit without scrolling as the target, and accept
scrolling at 3-open.

Since this changes the panel model fairly deeply, treat "which exact rows/props change on
ColumnPanels/CardBox" as your call to make and document -- this wasn't wireframed in detail
(explicitly deferred this morning: "only wireframe the interfaces that need development"), so
use your judgement on the concrete markup and say what you built and why in the report, the
same way earlier rounds have handled real-but-undrawn decisions.

Verify: no "+Add" or "x" exists anywhere on a column. Every panel is always present, in a
distinct open/shut state; opening/closing one doesn't affect the others. A school with 2 open
and 1 collapsed doesn't need to scroll to see all three headers plus both open panels'
content, at a normal laptop width. Someone with existing saved panel-presence state doesn't
lose any panel they'd added.

## S11. Heading restructuring

Guy's own detailed list from this morning, section by section:

- Column headings (the H2 per column) become full explanatory sentences, e.g. for
  Column 1: "{Subject} Candidates -- how many pupils take {Subject} GCSE." Context and
  Comparisons get their own equivalent sentences naming what they actually compare against
  (see next point).
- Current-row tag: keep as today structurally, but Context's and Comparisons' should name
  the actual comparator rather than a generic label -- Context: "Whole School Context 2024/25"
  (or "Selected Subjects Context 2024/25" when that's the active choice, per S8); Comparisons:
  "Candidates at the Nearest 10 Schools 2024/25" (or whichever comparator set is actually
  active -- read it from the same comparatorSetOptions/comparisonsSet labelling
  ComparisonsPanels.tsx already has, don't hardcode "Nearest 10").
- Trend and % change rows: both become uniform headings -- "Trends" and "% Change" -- each
  with a "From {year} (dropdown arrow)" selector where there's enough years of data to make
  narrowing worthwhile, replacing the current prev/next-arrow behaviour
  (nextStart(trendPeriods, ...) in SubjectPanels.tsx) with an actual dropdown listing the
  available start years. Consistent across all three top-row panels -- build one selector
  component if there isn't a natural shared one already, rather than three near-identical
  ones.

Also from this morning, general and easy to fold into this pass: graphs should not overlap
explanatory text (check panel body layouts at the space now available); and caveat text should
live inside the "i" info popover (SourceNote in PanelFooter.tsx) alongside the source
citation, not repeated inline multiple times.

Verify: every column heading reads as a full sentence naming the subject and what it
answers. Context's and Comparisons' Current-row tags name their real, current comparator, and
update when the comparator changes. Trend and % change both show "From {year}" as an openable
dropdown, not arrows, everywhere they appear. No caveat text repeats outside the info popover.

## S12. Trend line and the growth/decline flag -> bottom row

Two related relocations, both agreed this morning, both freeing vertical space in the panel
body:

- "Trend line can move into bottom row before Info button" -- the Pill label="Trend line"
  toggle currently sits in SubjectPanels.tsx's Trend-panel controls (top of the panel,
  beside the "From: {year}" pill). Move it down into the panel's footer row, to the left of
  the source/info button (SourceNote, the "i" icon in PanelFooter.tsx/CardBox.tsx).
- "The 'declining' message can also go in the bottom row (right aligned) -- it is the first of
  our flags." This message already exists -- it's the panel's summary (rendered via
  PanelSummary with DIRECTION_ARROW/DIRECTION_WORD/DIRECTION_COLOUR, computed from
  trendSaid/trendSentence in teacher-view-panels.ts). Today CardBox.tsx renders it as
  a captionLine above the source/footer row. Move it into that same footer row instead,
  right-aligned, alongside the relocated Trend-line toggle and the "i" button.

Since CardBox.tsx is shared by every panel in every column, and caption/source/
footerActions are used elsewhere too, do this as an intentional restructuring of that shared
footer layout (not a one-off hack in SubjectPanels.tsx) -- a panel that has no summary or no
Trend-line-style control should render the footer exactly as it does today, just with a
free-form leading slot the Trend panel happens to fill.

Verify: the Trend panel's top controls row shows only the "From: {year}" selector (now a
dropdown per S11); "Trend line" and the growth/decline summary both now sit in the footer row,
Trend line to the left near the info icon, the growth/decline message right-aligned. Every
other panel's footer (source, note, export) is visually unchanged.

---

## Deliverable

One build report covering all twelve parts, in the order built, each with: what changed, real
locations touched, and the verification steps above. Flag anything you had to interpret rather
than found explicitly specified (S10's accordion markup especially) as an open decision for
Guy, the same way earlier rounds have. Commit per part (or per logical group of small parts --
S1-S4 can reasonably be one commit each or grouped, your call), vicdata_public only.
