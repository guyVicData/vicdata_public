Builds the phone-width nav design that's been fully wireframed (NavPhone.dc.html, several
rounds of Guy's live feedback) but never landed in the real responsive build. Checked directly:
there is no phone-specific breakpoint logic in TeacherNav.tsx or ControlBar.tsx at all today --
they just flex-wrap, which is not the same design as what's wireframed. This is the biggest of
the three follow-ups from the top-nav round; do it after the other two
(vicdata_phase3_teacher_view_subject_chip_qualification_icons and
vicdata_phase3_teacher_view_nav_on_home_recruitment_meetings), since it reuses both -- the
phone subject dropdown wants the same real family-icon/colour derivation the chip-icon prompt
adds to ControlBar, and the phone nav's phase switcher wants the same TeacherPhase|null-capable
PhaseSwitcher the other prompt loosens TeacherNav to use.

## What the wireframe actually specifies

Two rows, on /teacher/[phase] only (this doesn't touch Home/Recruitment/Meetings' own phone
layout, which is a separate, smaller question -- their content isn't columned like the phase
dashboard, so their existing responsive behaviour is probably already fine; check once this
lands, don't rebuild them speculatively).

**Row 1 -- identity/settings, icon-only, no labels at any width:** VicData wordmark on the
left; on the right, as one cluster: Home icon (no label) -> Account icon+dropdown (same
AccountMenu component) -> theme toggle icon. A 1px full-width divider below.

**Row 2 -- what you're looking at:** a phase-switcher badge that IS the dropdown trigger (real
PhaseGlyph icon + chevron, tap opens a menu listing every onboarded phase with the same
rgba(accent.rgb,0.14) active-tint derivation as desktop -- not the wireframe's own eyeballed
Post-16 tint, which was flagged there as an unverified guess); the existing Candidates/Results
measure toggle, unchanged; then, pushed to the row's right edge (margin-left: auto or
justify-between), the subject-focus control as its OWN dropdown -- a chip showing the focused
subject's family icon + label + chevron, tapping it opens a menu listing every subject (same
family icon/colour as the chip-icon prompt gives ControlBar) with a divided-off "± Edit
subjects" row at the bottom of that same menu, opening the existing subject-picker flow. NO
whole-dashboard Export button on this row or anywhere in the phone layout -- per-panel export
(already real, inside each panel's own footer -- see PanelFooter.tsx) is untouched and covers
single-chart export on phone same as always. There is no label-visibility toggle on phone --
the design is icon-only throughout by choice, not a labels-off state of the desktop nav.

## How to build it

Both layouts read from the exact same state (measure, focusKey, subjects, theme, phase,
phases) -- this is a rendering fork, not a data fork. Prefer a CSS-only breakpoint swap
(Tailwind responsive utilities, e.g. two sibling elements toggled with `flex sm:hidden` /
`hidden sm:flex` or equivalent) over JS viewport detection, to avoid a hydration flash. Check
whether the app already has an established breakpoint convention elsewhere (DashboardGrid,
other responsive components) and match it rather than picking a new one from scratch; the
wireframe's own phone frame was drawn at 390-430px, which is narrower than Tailwind's default
`sm` (640px) -- use your judgement on which breakpoint actually reads right once you're looking
at real content at real widths, and say what you picked and why.

Whether this lives as new phone-specific sub-components inside TeacherNav.tsx/ControlBar.tsx,
or as a third pair of components composed alongside them, is your call -- optimise for not
duplicating logic that already exists (the phase-tint derivation, the subject family/colour
derivation, the AccountMenu, the ThemeToggle, the measure toggle, the "±" handler) across two
render paths.

## Verify

At a real phone width (375-430px, test more than one), nothing overlaps or clips, both
dropdowns open and close correctly and don't fight each other if opened in succession, the
phase switcher correctly shows every onboarded phase with the right one visually active, and
switching phase/subject/measure from the phone layout produces the identical state as doing
the same from desktop (same URL, same persisted settings). Confirm the desktop layout above
the breakpoint is completely unchanged by this round. Confirm per-panel export still works
unaffected on phone. Confirm nothing on Home/Recruitment/Meetings changed.

## Deliverable

Build report: the breakpoint chosen and why, how the two layouts are composed without
duplicating logic, the verification above, every file touched. Commit and push, vicdata_public
only.
