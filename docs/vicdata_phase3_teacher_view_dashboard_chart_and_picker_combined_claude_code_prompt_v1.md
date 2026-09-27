# Teacher view: chart fixes + subject picker, combined round

This supersedes and replaces two draft prompts that were written separately and never sent —
`..._chart_visual_fixes_round3_claude_code_prompt_v1.md` and
`..._subject_picker_compact_modal_claude_code_prompt_v1.md`. Everything in both is folded in here,
plus a new item (§3) from the discussion that produced them. Read this one; the other two are
superseded drafts, not a second round to also do.

Two separable pieces of work, one sitting, your call on one build report or two. Goal: land both
so the next round is refining what exists rather than still building it.

## 1. Tighten bar spacing (round 1's decision 2 — decided: yes)

At the desktop 3-column card (~385px), round 2's own numbers show the row needing 280px against
254px available — 26px over, so the last bar (Fur Maths, on The Chase's Sciences & Maths set)
sits partly behind the fade until scrolled. Guy: still reads as "cropped," and the current
`gap-4` (16px) between six 30px columns now reads as too wide regardless.

Reduce the gap between columns (`gap-4` in the bars row, `src/components/teacher/VerticalBars.tsx`)
to 10px, per round 2's own math (10px fits with room to spare; 12px would still be 6px over).
Recheck against The Chase's real six-bar set that this closes the gap without looking cramped at
widths that previously had room (450px column, phone).

While you're in there: the column is sized to the widest *word* (`colW`), but the *bar* itself is
narrower (`barW`) and centred in that column, so part of what reads as "gap" is empty space
inside each column either side of the bar, on top of `gap-4`. If tightening the gap alone still
looks wide once you can see it (§4 below), that's the other place to look.

## 2. Bars/Trend panel alignment (round 1's decision 1 — decided: widen Trend, don't narrow Bars)

Round 1's left-margin fix made the Bars panel's axis as wide as its widest figure, leaving it
8px *tighter* than the Trend panel below it in the same column (32px vs 40px from the content
edge). Decided: give `TrendChart.tsx`'s y-axis the same "as wide as its widest figure" treatment
`VerticalBars.tsx` already has, rather than reintroducing a fixed floor on the bars axis — the
same fix already shipped and proven safe for Bars, applied consistently, not a fixed constant
reintroduced on one chart to match another chart's fixed constant. This tightens every Trend
panel on the dashboard, not just this one pairing — check a couple of other Trend panels (a KS4
subject, a longer period range) alongside The Chase's to confirm nothing else was relying on the
old fixed width.

## 3. New: a horizontal-bar fallback for categories with too many subjects (net-new, not a tweak)

From the same discussion: some subject-family categories are much bigger than The Chase's
Sciences & Maths set. The DfE subject-family taxonomy (`vicdata`'s
`20260912510000_subject_family_map_data.sql`) tops out at 24 KS4 / 37 KS5 distinct catalogue
subjects in one family (Languages & Literature, Arts/Media/Design) against a low of 4 KS4 / 11
KS5 (Health & Care) — that's the catalogue ceiling, not any one school's real entries, but it
shows the range is real: no single gap value or column width keeps working as subject count
climbs, and a vertical bar chart with many narrow, two-line-wrapped columns gets hard to read well
before it runs out of room.

Rather than chase that with ever-smaller gaps, add a horizontal orientation the Candidates
"Current" bar view switches to automatically when the vertical layout stops working — a genuinely
new small component (there's no horizontal-bar chart in the codebase today; the panel's existing
second view, "Ranked list," is a plain text list with no bars).

- **Trigger on measured fit, not a fixed subject count.** `VerticalBars` already computes column
  width, bar width, gap and available card width; use those same numbers to decide whether the
  vertical layout would need to scroll, or would push column width below a legible floor (e.g.
  close to `barW` itself, no room for the label to breathe) — and switch to horizontal bars at
  that point rather than picking a magic count like "8" or "10" that's only ever right at one
  width. A fullscreen card should be able to hold more vertical bars before flipping than a
  narrow 3-column card, from the same underlying rule.
- **Shape:** one row per subject, value axis along the top (or bars simply proportional with
  figures labelled at the bar end — your call), subject labels to the left, ranked or in the
  chart's existing order — whichever reads better once you can see it. It can grow the panel's
  height and let the card scroll vertically the way the "Ranked list" view already does, rather
  than needing its own horizontal scroll-with-fade mechanism.
- **Leave the manual "bars" vs. "Ranked list" toggle alone** — this is the "bars" view itself
  choosing its own orientation when the vertical form doesn't fit, not a third user-facing choice.
- If a real per-school worst case (most subjects any actual school has entries for in one family
  at once) would help size this, that's a query against `academic_subject_headline` grouped by
  school and family — flag it rather than running it; that needs sign-off first.

## 4. Subject picker: compact modal, and Context reuse

Two pickers exist today, not three (confirmed before this was briefed):

- **The subject picker** — `QualificationFamilyTiles` (qualification-family tiles) +
  `CategorySubjectPicker` (tabbed, categorised subject checklist). Identical in onboarding (two
  wizard steps with "Next" between) and the "±" QuickEdit modal (both stacked, no "Next",
  pre-ticked from the school's current selection rather than onboarding's "everything with data").
- **Context's "Selected subjects" checklist** (`ContextPills.tsx`) — a flat list in a `PillMenu`
  dropdown (shared with Comparisons), Select all / Clear all, no family tiles, no category tabs,
  no chips. Structurally unrelated to the picker above.

Both the onboarding and "±" pickers use `TeacherModal`, the shell also used for a card's
fullscreen view, deliberately sized to `inset-3%`/`inset-5%` of the viewport (its own header
comment: one shell so there aren't "two lookalikes"). Right for a fullscreen chart; wrong for a
subject picker, which is why it's far too wide on a laptop today.

**4a. Give `TeacherModal` a compact size.** A variant (`compact`, or your naming) that floats a
mobile-width panel, centred, over the same dimmed backdrop, instead of `inset-3%/5%` of the
viewport. Fullscreen behaviour stays the default and untouched; the subject picker (onboarding
step 2 / "±" QuickEdit) switches to the new compact size. One shell, two sizes, not a second
modal component.

**4b. Move Context's subject checklist onto the same shell.** A real behaviour change, not a
restyle: today's dropdown checklist becomes the same modal-over-dimmed-backdrop pattern, at the
compact size. The "Compare against" pill still opens the pill menu for "All subjects" / "Selected
subjects"; picking "Selected subjects" (or an "Edit selection" action once already chosen) opens
the compact modal instead of revealing the inline list.

**4c. Context's picker skips the qualification step.** A comparison set is always within the
school's current qualification (Guy: "we need to lose qualification choices as comparison sets
are with same qualification") — so Context's modal goes straight to the categorised subject list,
no `QualificationFamilyTiles` step. Whatever family/qualification the focused subject already has
is implicit, not chosen here.

**4d. Whole-category select/deselect.** A control on each category section's own header row (next
to its "N of M ticked" count) to tick or untick every subject in that category at once. Add it to
`CategorySubjectPicker` itself, not a Context-only fork — generally useful, and Guy's stated goal
is making this picker "the default subject choice picker wherever we ask users to do that," which
argues for one component with options over parallel copies.

**4e. Keep a global Select all / Deselect all.** Not new — today's `ContextPills` already has
Select all / Clear all on the flat list. Carry it over.

**4f. No Apply button.** Decided: selections apply live, closing the modal is just closing it,
same as both existing pickers today (the "±" modal's own code comment: "nothing to save: ticking
updates `ticked` immediately, which is what every card reads"; today's `ContextPills` checklist
also applies each toggle immediately via `onSetSelected`). No pending/committed state to add. If
bulk actions (select-all, category-toggle) make the donut/chart behind the modal feel jumpy as it
recomputes on every click, that's worth a smoothing transition on the chart side, not a reason to
add a commit step.

**Shape of the change to `CategorySubjectPicker`:** it likely needs to work two ways — with family
tabs (subject picker, unchanged) and without them, locked to a single implicit family (Context) —
plus the new per-category select/deselect either way. Exact prop shape is your call.

**Out of scope this round:** `ComparatorSetChooser.tsx` references `CategorySubjectPicker` in a
comment but hasn't been confirmed as a fourth surface. Don't touch it — flag in the build report
whether it turned out to be relevant so it can be scoped separately if so.

## Build report

Both pieces, one report or two, your call. Several of these are look-and-feel calls neither of us
can verify past the login gate (§1's spacing, §3's horizontal-bar shape, §4a/4b's compact modal
sizing) — build yourself an unauthenticated preview (a dev-only route, Storybook-style page,
whatever's fastest) that renders the real components with The Chase's real Sciences & Maths
figures and the subject picker's real data, and screenshot it at a laptop width and a phone width
before calling any of those done, rather than trusting box measurements alone (that's what went
wrong two rounds ago). One preview, reused across §1, §3 and §4.
